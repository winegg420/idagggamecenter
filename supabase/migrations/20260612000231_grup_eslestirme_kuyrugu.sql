-- ============================================================
-- Paket 24 · C — GRUP MAÇI EŞLEŞTİRME KUYRUĞU
--
-- ÖLÇÜLEN DURUM: Grup Maçı yalnız DAVETLE oynanabiliyordu. Eşleştirme kuyruğu arandı,
-- bulunamadı — grup için kuyruk kodu hiç yoktu. Kuyruk bugün yalnız düelloda var
-- (duello_kuyrugu). Arkadaşı çevrimiçi olmayan oyuncu grup maçı oynayamıyordu.
--
-- Bu dosya duello_kuyrugu kalıbını birebir izler, yeniden icat etmez:
--   kuyruğa gir → yeterli kişi toplanınca grup kur → toplanmazsa gizli botlarla tamamla.
--
-- ÖDÜL KURALI DEĞİŞMEDİ: Grup Maçı ödülsüz arkadaş modudur (coin yok, lig puanı yok,
-- seri yok; rozet var). Eşleştirme eklenmesi bunu değiştirmez — ödül zinciri
-- trg_grup_bitti'dedir ve ona DOKUNULMADI.
--
-- C.2 ÖLÇÜLDÜ, AÇIK YOK: gunluk_seri_bonusu canlı veritabanında yalnız duello_bitir
-- ve mac_sonuclandir içinde çağrılıyor. trg_grup_bitti yalnız mac_sayaci_arttir(false)
-- çağırıyor — grup maçı bedava seri koruma kapısı DEĞİL. Aynı şey Hızlı Mod için de
-- geçerli (hizli_mod_bitir'de seri bonusu yok).
--
-- is_bot SIZMAZ: botlar group_match_players'a normal oyuncu gibi girer; profiles'ın
-- is_bot kolonu istemciye zaten kapalı (migration 081 profil gizliliği).
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('grup_arama_sn', '12'::jsonb, 'Grup Maçı: gerçek oyuncu arama süresi (dolunca gizli botlarla tamamlanır)'),
  ('grup_hedef_kisi', '3'::jsonb, 'Grup Maçı kuyruğu: bir grup kaç kişiyle kurulur (3-5)'),
  ('grup_kuyruk_omru_sn', '90'::jsonb, 'Grup Maçı kuyruğu: bu süreden eski kayıtlar düşer')
on conflict (anahtar) do nothing;

create table if not exists public.grup_kuyrugu (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kategori text,
  created_at timestamptz not null default now()
);
alter table public.grup_kuyrugu enable row level security;
revoke all on public.grup_kuyrugu from anon, authenticated;   -- yazma yalnız RPC ile

-- ------------------------------------------------------------
-- Grubu kur: verilen oyuncularla group_matches + group_match_players yazar.
-- respond_group_challenge'ın "son kabul geldi" dalıyla AYNI sonucu üretir:
-- durum='aktif', soru_ids seçilmiş, basladi=false → mevcut lobi akışı devralır.
-- ------------------------------------------------------------
create or replace function public.grup_kur_kuyruktan(p_oyuncular uuid[], p_kategori text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_u uuid;
begin
  if coalesce(array_length(p_oyuncular, 1), 0) < 3 then
    raise exception 'Grup için en az 3 oyuncu gerekir';
  end if;

  insert into public.group_matches (kurucu, oyuncu_sayisi, kategori)
  values (p_oyuncular[1], array_length(p_oyuncular, 1), p_kategori)
  returning id into v_id;

  foreach v_u in array p_oyuncular loop
    insert into public.group_match_players (group_match_id, user_id, davet_durumu)
    values (v_id, v_u, 'kabul');
  end loop;

  update public.group_matches
     set durum = 'aktif',
         soru_ids = public.soru_sec(p_kategori, 20, p_oyuncular),
         aktif_soru = 0,
         soru_baslangic = now()
   where id = v_id;

  return v_id;
end;
$fn$;

-- ------------------------------------------------------------
-- grup_ara — kuyruğa gir / grup kur / botla tamamla
-- Dönüş: grup maçı id'si, ya da henüz oluşmadıysa null (istemci beklemeye devam eder).
-- ------------------------------------------------------------
create or replace function public.grup_ara(p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_bas timestamptz;
  v_hedef int := greatest(3, least(5, public.ayar_sayi('grup_hedef_kisi', 3)::int));
  v_liste uuid[];
  v_bot uuid;
  v_deneme int;
begin
  perform public.hiz_siniri('grup_ara', 90, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  -- Devam eden grup maçım varsa ona dön (kuyrukta kalmayayım)
  select g.id into v_id
    from public.group_matches g
    join public.group_match_players gp on gp.group_match_id = g.id
   where gp.user_id = v_me and gp.davet_durumu = 'kabul' and gp.terk_at is null
     and g.durum in ('bekliyor', 'lobi', 'aktif')
   limit 1;
  if v_id is not null then
    delete from public.grup_kuyrugu where user_id = v_me;
    return v_id;
  end if;

  -- Eski kuyruk kayıtları düşer (duello_kuyrugu ile aynı ilke)
  delete from public.grup_kuyrugu
   where created_at < now() - make_interval(secs => public.ayar_sayi('grup_kuyruk_omru_sn', 90));

  -- Kuyruğa gir / kaydı tazele
  select q.created_at into v_bas from public.grup_kuyrugu q where q.user_id = v_me;
  if v_bas is null then
    insert into public.grup_kuyrugu (user_id, kategori) values (v_me, p_kategori)
    on conflict (user_id) do update set kategori = excluded.kategori, created_at = now();
    return null;
  end if;
  update public.grup_kuyrugu set kategori = p_kategori where user_id = v_me;

  -- Yeterli gerçek oyuncu var mı? (kategori uyumlu: aynı kategori ya da ikisinden biri "farketmez")
  select coalesce(array_agg(q.user_id), '{}'::uuid[]) into v_liste
    from (
      select q.user_id
        from public.grup_kuyrugu q
       where q.user_id <> v_me
         and (p_kategori is null or q.kategori is null or q.kategori = p_kategori)
       order by q.created_at
       limit v_hedef - 1
       for update skip locked
    ) q;

  if coalesce(array_length(v_liste, 1), 0) >= v_hedef - 1 then
    perform public.mac_kotasi_kontrol();
    v_id := public.grup_kur_kuyruktan(array_prepend(v_me, v_liste), coalesce(p_kategori, (select kategori from public.grup_kuyrugu where user_id = v_liste[1])));
    delete from public.grup_kuyrugu where user_id = v_me or user_id = any(v_liste);
    return v_id;
  end if;

  -- Arama süresi dolmadıysa beklemeye devam
  if now() < v_bas + make_interval(secs => public.ayar_sayi('grup_arama_sn', 12)) then
    return null;
  end if;

  -- Süre doldu: kalan yerleri GİZLİ botlarla tamamla (1v1'deki "kimse yoksa botla başla"
  -- davranışının aynısı). Aynı bot iki kez seçilmesin diye tekrar denenir.
  v_liste := coalesce(v_liste, '{}'::uuid[]);
  while coalesce(array_length(v_liste, 1), 0) < v_hedef - 1 loop
    v_bot := null;
    for v_deneme in 1..6 loop
      v_bot := public.bot_sec(v_me);
      exit when v_bot is not null and not (v_bot = any(v_liste));
      v_bot := null;
    end loop;
    if v_bot is null then
      -- Son çare: seviyeye bakmadan uygun bir gizli bot
      select p.id into v_bot from public.profiles p
       where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
         and p.id <> all(v_liste)
       order by random() limit 1;
    end if;
    if v_bot is null then
      raise exception 'Şu an uygun oyuncu yok, birazdan tekrar dene.';
    end if;
    perform public.bot_kisilik_tohumla(v_bot);
    v_liste := array_append(v_liste, v_bot);
  end loop;

  perform public.mac_kotasi_kontrol();
  v_id := public.grup_kur_kuyruktan(array_prepend(v_me, v_liste), p_kategori);
  delete from public.grup_kuyrugu where user_id = v_me or user_id = any(v_liste);
  return v_id;
end;
$fn$;

-- Kuyruktan çık (sayfadan ayrılma / vazgeçme)
create or replace function public.grup_aramadan_cik()
returns void
language sql
security definer
set search_path = public
as $fn$
  delete from public.grup_kuyrugu where user_id = auth.uid();
$fn$;

-- Kuyrukta kaç kişi bekliyor (arayüzde "3 kişiden 2'si hazır" göstergesi).
-- TOPLAM OYUNCU SAYISI DEĞİL — yalnız bu kuyruktaki anlık bekleyen sayısı.
create or replace function public.grup_kuyruk_durumu()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'bekleyen', (select count(*)::int from public.grup_kuyrugu
                  where created_at > now() - make_interval(secs => public.ayar_sayi('grup_kuyruk_omru_sn', 90))),
    'hedef', greatest(3, least(5, public.ayar_sayi('grup_hedef_kisi', 3)::int)),
    'arama_sn', public.ayar_sayi('grup_arama_sn', 12)::int,
    'sirada_miyim', exists (select 1 from public.grup_kuyrugu where user_id = auth.uid())
  );
$fn$;

revoke all on function public.grup_kur_kuyruktan(uuid[], text) from public, anon, authenticated;
revoke all on function public.grup_ara(text) from public, anon;
revoke all on function public.grup_aramadan_cik() from public, anon;
revoke all on function public.grup_kuyruk_durumu() from public, anon;
grant execute on function public.grup_ara(text) to authenticated;
grant execute on function public.grup_aramadan_cik() to authenticated;
grant execute on function public.grup_kuyruk_durumu() to authenticated;
