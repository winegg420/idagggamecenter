-- ============================================================
-- TURNUVA MEYDANA TAŞINIYOR + ETKİNLİK ÖDÜLLERİ
--
-- Kupa binası turnuvadan 10 dk önce ışımaya başlar, üstünde geri sayım
-- belirir; binaya dokunan doğrudan lobiye düşer. MEYDAN TEK YOL DEĞİLDİR —
-- klasik düğmeden giriş aynen durur (eski telefon / zayıf internet 3B sahneyi
-- açamayabilir, o oyuncular kaybedilmez).
--
-- ÖDÜL SUNUCUDA DOĞRULANIR. İstemci "ben meydandaydım" diyemez: damgayı
-- `meydan_turnuva_damgasi()` RPC'si basar ve o RPC oyuncunun gerçekten
-- turnuva penceresinde olduğunu kontrol eder.
-- ============================================================

create table if not exists public.meydan_katilim (
  user_id uuid not null references auth.users(id) on delete cascade,
  turnuva_id uuid not null,
  damga timestamptz not null default now(),
  primary key (user_id, turnuva_id)
);

alter table public.meydan_katilim enable row level security;
drop policy if exists meydan_katilim_kendi on public.meydan_katilim;
create policy meydan_katilim_kendi on public.meydan_katilim
  for select to authenticated using (user_id = auth.uid());
-- Yazma politikası YOK: yalnız RPC damgalar.

-- Şampiyon tacı: meydanda 60 sn görünen geçici efekt için damga
alter table public.profiles add column if not exists turnuva_taci_at timestamptz;

-- Ayarlar
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('coin_meydan_katilim', '50'::jsonb, 'Turnuvaya MEYDANDAN katılana verilen coin'),
  ('meydan_kapi_dakika',  '10'::jsonb, 'Kupa binası turnuvadan kaç dakika önce açılır'),
  ('tac_gorunme_sn',      '60'::jsonb, 'Şampiyon tacının meydanda görünme süresi')
on conflict (anahtar) do nothing;

-- Rozet: "meydanda toplandın"
-- badges birincil anahtari `id` (kod değil)
insert into public.badges (id, ad, aciklama, ikon)
values ('meydanda_toplandin', 'Meydanda Toplandın',
        'Turnuvaya meydandan katıldın', 'kisiler')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- MEYDAN DAMGASI
-- Oyuncu kupa binasından lobiye geçerken çağrılır. Turnuva penceresinde
-- değilse damga BASILMAZ — ödül de verilmez.
-- ------------------------------------------------------------
create or replace function public.meydan_turnuva_damgasi()
returns table(damgalandi boolean, turnuva_id uuid, coin bigint)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_dakika int := public.ayar_sayi('meydan_kapi_dakika', 10)::int;
  v_odul bigint := public.ayar_sayi('coin_meydan_katilim', 50);
  t public.tournaments%rowtype;
  v_yeni boolean := false;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('meydan_turnuva_damgasi', 20, interval '60 seconds');

  -- PENCERE KONTROLÜ: kapı açılma anından turnuva bitene kadar.
  -- İstemciye güvenilmez; zamanı sunucu ölçer.
  select * into t
    from public.tournaments
   where durum in ('lobi', 'aktif')
     and now() >= baslangic - (v_dakika || ' minutes')::interval
   order by baslangic asc
   limit 1;

  if not found then
    return query select false, null::uuid, 0::bigint;
    return;
  end if;

  insert into public.meydan_katilim (user_id, turnuva_id)
  values (v_me, t.id)
  on conflict do nothing;
  v_yeni := found;

  -- Ödül yalnız İLK damgada (coin_hareketleri tekilliği de ayrıca korur)
  if v_yeni then
    perform public.coin_ekle(v_me, v_odul, 'etkinlik', 'meydan:' || t.id::text);
    perform public.award_badge(v_me, 'meydanda_toplandin');
  end if;

  return query select v_yeni, t.id, case when v_yeni then v_odul else 0::bigint end;
end;
$fn$;

grant execute on function public.meydan_turnuva_damgasi() to authenticated;

-- ------------------------------------------------------------
-- TURNUVA ÖDÜLLERİ — dereceye göre ETKİNLİK EŞYASI
-- Bu eşyaların coin_fiyat'ı null, nadirlik 'etkinlik': parayla ASLA alınamaz.
-- ------------------------------------------------------------
create or replace function public.turnuva_odullerini_dagit(p_tournament_id uuid, p_kazanan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_sira int := 0;
begin
  -- Şampiyon: Taç + meydanda 60 sn görünen geçici taç damgası
  if p_kazanan is not null then
    perform public.esya_odul_ver(p_kazanan, 'spk_04', 'etkinlik');
    update public.profiles set turnuva_taci_at = now() where id = p_kazanan;
  end if;

  -- İlk üç: Yıldızlar efekti
  for r in
    select tp.user_id
      from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
     order by tp.elendi asc, tp.elenme_sorusu desc nulls first, tp.dogru_sayisi desc
     limit 3
  loop
    v_sira := v_sira + 1;
    perform public.esya_odul_ver(r.user_id, 'efk_02', 'etkinlik');
  end loop;
end;
$fn$;

revoke all on function public.turnuva_odullerini_dagit(uuid, uuid) from public;
revoke all on function public.turnuva_odullerini_dagit(uuid, uuid) from authenticated;
revoke all on function public.turnuva_odullerini_dagit(uuid, uuid) from anon;

-- Turnuva bitisine etkinlik odulleri baglaniyor (canli tanimdan uretildi)
create or replace FUNCTION public.advance_tournament(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;

  -- Süre dolmadıysa: hayatta olup henüz cevaplamayan varsa bekle
  if now() < t.soru_baslangic + interval '16 seconds' then
    if exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = p_tournament_id and not tp.elendi
        and not exists (
          select 1 from public.tournament_answers ta
          where ta.tournament_id = p_tournament_id
            and ta.user_id = tp.user_id
            and ta.soru_index = t.aktif_soru
        )
    ) then
      return;
    end if;
  end if;

  select count(*) into v_elenecek
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id and not tp.elendi
    and not exists (
      select 1 from public.tournament_answers ta
      where ta.tournament_id = p_tournament_id
        and ta.user_id = tp.user_id
        and ta.soru_index = t.aktif_soru
        and ta.dogru
    );

  select count(*) into v_kalan
  from public.tournament_players
  where tournament_id = p_tournament_id and not elendi;

  if v_elenecek < v_kalan then
    update public.tournament_players tp
       set elendi = true, elenme_sorusu = t.aktif_soru
     where tp.tournament_id = p_tournament_id and not tp.elendi
       and not exists (
         select 1 from public.tournament_answers ta
         where ta.tournament_id = p_tournament_id
           and ta.user_id = tp.user_id
           and ta.soru_index = t.aktif_soru
           and ta.dogru
       );
    v_kalan := v_kalan - v_elenecek;
  end if;

  if v_kalan = 1 then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi;
  elsif t.aktif_soru + 1 >= coalesce(array_length(t.soru_ids, 1), 0) then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi
    order by dogru_sayisi desc, joined_at asc
    limit 1;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set puan = puan + 250, puan_hafta = puan_hafta + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
    -- ETKİNLİK ÖDÜLLERİ: dereceye göre eşya + şampiyon tacı damgası.
    -- Bu eşyalar parayla ASLA alınamaz (coin_fiyat null, nadirlik 'etkinlik').
    perform public.turnuva_odullerini_dagit(p_tournament_id, v_kazanan);
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$function$
;
