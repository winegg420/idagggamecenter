-- ============================================================
-- 205 — DÜELLO (TAKTİK MAÇI) (Paket 14, aşama 4)
--
-- İki oyuncu sırayla birbirine soru gönderir. Saldıran, rakibin kategori
-- profilini görür (maç başında sabitlenmiş), kategori seçer; 4 sn Saldırı
-- Hazırlığı (saldırı jokerleri), sonra savunan 15 sn (Zaman Baskısı: 10) cevap
-- verir. Yanlışsa savunan can kaybeder.
-- SALDIRI RİSKİ: savunan KENDİ EN ZAYIF kategorisinde (maç başında
-- hesaplanır, sabittir) gelen saldırıyı savuşturursa SALDIRAN can kaybeder.
--
-- Yapı: 3 can, en çok 10 tur; turlar çift hamle (oyuncu1 sonra oyuncu2
-- saldırır). Bitiş yalnız tur sonunda denetlenir (eşit hamle kuralı).
-- 10 tur / can bitince: çok can → çok doğru → ALTIN SORU (turnuvadaki
-- mekanik: iki oyuncuya aynı soru, jokersiz, kullanılmamış sorudan; tek
-- doğru bilen kazanır, yoksa yeni altın soru).
--
-- Kategori kısıtı (saldıran başına): son kendi saldırı kategorisi tekrar
-- seçilemez; maç başına aynı kategori en çok 2 kez.
--
-- GÜVENLİK: tüm durum sunucuda. duellolar istemciye KAPALI; istemci
-- duello_durum() ile kendine göre süzülmüş görünümü alır (savunan soruyu
-- hazırlıkta görmez, doğru cevap açıklanana kadar gelmez, is_bot HİÇBİR
-- yerde yok). Canlı bildirim duello_sinyal (yalnız sürüm numarası) üzerinden.
-- Süreler oyuncu çağrılarında ve 2 sn'lik cron'da (duello_tik_hepsi) işler.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('duello_can', '3', 'Düello: başlangıç canı'),
  ('duello_max_tur', '10', 'Düello: en çok tur (her tur iki saldırı)'),
  ('duello_cevap_sn', '15', 'Düello: savunanın cevap süresi'),
  ('duello_zaman_baskisi_sn', '10', 'Düello: Zaman Baskısı jokeriyle cevap süresi'),
  ('duello_ek_sure_sn', '5', 'Düello: savunmadaki Ek Süre jokerinin eklediği saniye'),
  ('duello_hazirlik_sn', '4', 'Düello: Saldırı Hazırlığı süresi'),
  ('duello_kategori_sn', '20', 'Düello: kategori seçme süresi (dolunca otomatik seçilir)'),
  ('duello_sonuc_sn', '3', 'Düello: hamle sonucunun ekranda kalma süresi'),
  ('duello_altin_sn', '15', 'Düello: altın soru cevap süresi'),
  ('duello_kategori_max', '2', 'Düello: maç başına aynı kategori en çok'),
  ('duello_savunma_joker_siniri', '2', 'Düello: maç başına savunma jokeri hakkı'),
  ('duello_saldiri_joker_siniri', '2', 'Düello: maç başına saldırı jokeri hakkı'),
  ('duello_ucretsiz_saldiri_joker', '1', 'Düello: maç başına envanter harcamadan kullanılan saldırı jokeri'),
  ('coin_joker_zaman_baskisi', '60', 'Joker fiyatı: Zaman Baskısı'),
  ('coin_joker_saldiri_degistir', '60', 'Joker fiyatı: Soru Değiştir (saldırı)'),
  ('coin_joker_savunma_kilidi', '80', 'Joker fiyatı: Savunma Kilidi'),
  ('duello_arama_sn', '8', 'Düello: gerçek rakip arama süresi'),
  ('duello_rovans_sn', '60', 'Düello: rövanş isteğinin geçerlilik süresi'),
  ('duello_bot_kategori_min_sn', '2', 'Düello botu: kategori seçme gecikmesi alt'),
  ('duello_bot_kategori_max_sn', '5', 'Düello botu: kategori seçme gecikmesi üst'),
  ('duello_bot_joker_yuzde', '15', 'Düello botu: hazırlıkta saldırı jokeri kullanma olasılığı'),
  ('duello_bot_riskten_kacma_yuzde', '65', 'Düello botu: rakibin en zayıf kategorisinden kaçınma olasılığı'),
  ('duello_zaman_asimi_dk', '60', 'Düello: bu süreyi aşan aktif düello iptal edilir')
on conflict (anahtar) do nothing;

-- ---- Joker türleri: saldırı jokerleri + (ölçülen hata) soru_degistir ----
-- joker_envanter_tur_check 'soru_degistir'i içermiyordu: dükkândaki joker
-- paketleri (içerikte soru_degistir var) satın alınamıyordu.
alter table public.joker_envanter drop constraint if exists joker_envanter_tur_check;
alter table public.joker_envanter add constraint joker_envanter_tur_check
  check (tur = any (array['elli','sure','pas','seri_koruma','soru_degistir',
                          'zaman_baskisi','saldiri_degistir','savunma_kilidi']));
alter table public.joker_kullanimlari drop constraint if exists joker_kullanimlari_mac_tur_check;
alter table public.joker_kullanimlari add constraint joker_kullanimlari_mac_tur_check
  check (mac_tur = any (array['1v1','grup','hizli','turnuva','duello']));

-- Ölçülen hata: envanterinde o türden hiç satır olmayan oyuncu için negatif
-- hareket (kullanım) satırı adet 0 ile ekleniyor ve HATA VERMİYORDU — ilk
-- kullanım bedava geçiyor, ikincisinde ham kısıt hatası çıkıyordu.
create or replace function public.joker_hareket(p_user uuid, p_tur text, p_delta integer, p_kaynak text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
begin
  if p_delta = 0 then
    return coalesce((select adet from public.joker_envanter where user_id = p_user and tur = p_tur), 0);
  end if;

  if p_delta < 0 then
    update public.joker_envanter
       set adet = adet + p_delta
     where user_id = p_user and tur = p_tur and adet + p_delta >= 0
    returning adet into v_yeni;
    if v_yeni is null then
      raise exception 'Yetersiz joker';
    end if;
  else
    insert into public.joker_envanter (user_id, tur, adet)
    values (p_user, p_tur, p_delta)
    on conflict (user_id, tur) do update
      set adet = public.joker_envanter.adet + p_delta
    returning adet into v_yeni;
  end if;

  insert into public.joker_islemleri (user_id, tur, delta, kaynak, ref)
  values (p_user, p_tur, p_delta, p_kaynak, p_ref);

  return v_yeni;
end;
$$;

create or replace function public.joker_tek_al(p_tur text)
returns table(bakiye bigint, adet integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_fiyat bigint;
  v_bakiye bigint;
  v_adet int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('joker_tek_al', 20, interval '60 seconds');

  v_fiyat := case p_tur
    when 'elli' then public.ayar_sayi('coin_joker_elli', 40)
    when 'sure' then public.ayar_sayi('coin_joker_sure', 60)
    when 'soru_degistir' then public.ayar_sayi('coin_joker_soru_degistir', 80)
    when 'zaman_baskisi' then public.ayar_sayi('coin_joker_zaman_baskisi', 60)
    when 'saldiri_degistir' then public.ayar_sayi('coin_joker_saldiri_degistir', 60)
    when 'savunma_kilidi' then public.ayar_sayi('coin_joker_savunma_kilidi', 80)
    else null end;
  if v_fiyat is null then raise exception 'Bu joker tek tek satılmıyor'; end if;

  v_bakiye := public.coin_harca(v_fiyat, 'joker', 'tek:' || p_tur);
  v_adet := public.joker_hareket(v_me, p_tur, 1, 'satin_alma', 'tek:' || p_tur);

  return query select v_bakiye, v_adet;
end;
$$;

-- ============================================================
-- TABLOLAR
-- ============================================================
create table if not exists public.duellolar (
  id uuid primary key default gen_random_uuid(),
  oyuncu1 uuid not null references public.profiles(id) on delete cascade,
  oyuncu2 uuid not null references public.profiles(id) on delete cascade,
  durum text not null default 'aktif' check (durum in ('aktif','bitti','iptal')),
  dereceli boolean not null default true,
  can1 int not null default 3,
  can2 int not null default 3,
  dogru1 int not null default 0,
  dogru2 int not null default 0,
  tur int not null default 1,
  saldiri_sirasi int not null default 0,          -- 0: oyuncu1 saldırır, 1: oyuncu2
  saldiran uuid,
  faz text not null default 'kategori' check (faz in ('kategori','hazirlik','cevap','sonuc','altin')),
  faz_bitis timestamptz,
  kategori text,
  soru_id uuid,
  soru_degisti_saldiri boolean not null default false,
  soru_degisti_savunma boolean not null default false,
  zaman_baskisi boolean not null default false,
  savunma_kilidi boolean not null default false,
  ek_sure boolean not null default false,
  elli_kapali int[],
  profil1 jsonb,
  profil2 jsonb,
  zayif1 text,
  zayif2 text,
  son_hamle jsonb,
  altin_cevaplar jsonb not null default '{}'::jsonb,
  kullanilan_sorular uuid[] not null default '{}',
  kazanan uuid,
  odul_carpan numeric not null default 1,
  bitis timestamptz,
  son_hareket timestamptz not null default now(),
  rovans_isteyen uuid,
  rovans_at timestamptz,
  rovans_id uuid,
  onceki_id uuid,
  created_at timestamptz not null default now(),
  check (oyuncu1 <> oyuncu2)
);
create index if not exists idx_duello_aktif on public.duellolar (durum) where durum = 'aktif';
create index if not exists idx_duello_oyuncu1 on public.duellolar (oyuncu1, created_at desc);
create index if not exists idx_duello_oyuncu2 on public.duellolar (oyuncu2, created_at desc);
alter table public.duellolar enable row level security;
revoke all on public.duellolar from anon, authenticated;

create table if not exists public.duello_hamleler (
  id bigserial primary key,
  duello_id uuid not null references public.duellolar(id) on delete cascade,
  tur int not null,
  saldiran uuid not null,
  savunan uuid not null,
  kategori text,
  soru_id uuid,
  cevap smallint,
  dogru boolean not null,
  riskli boolean not null default false,
  can_kaybeden uuid,
  zaman_baskisi boolean not null default false,
  savunma_kilidi boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_duello_hamle on public.duello_hamleler (duello_id, id);
alter table public.duello_hamleler enable row level security;
revoke all on public.duello_hamleler from anon, authenticated;

-- Canlı bildirim: yalnız sürüm numarası (sır yok)
create table if not exists public.duello_sinyal (
  duello_id uuid primary key references public.duellolar(id) on delete cascade,
  oyuncu1 uuid not null,
  oyuncu2 uuid not null,
  surum bigint not null default 0,
  guncellendi timestamptz not null default now()
);
alter table public.duello_sinyal enable row level security;
drop policy if exists duello_sinyal_oku on public.duello_sinyal;
create policy duello_sinyal_oku on public.duello_sinyal for select to authenticated
  using (auth.uid() in (oyuncu1, oyuncu2));
revoke all on public.duello_sinyal from anon, authenticated;
grant select on public.duello_sinyal to authenticated;
do $$
begin
  alter publication supabase_realtime add table public.duello_sinyal;
exception when duplicate_object then null;
end $$;

create table if not exists public.duello_kuyrugu (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dereceli boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.duello_kuyrugu enable row level security;
revoke all on public.duello_kuyrugu from anon, authenticated;

-- ============================================================
-- YARDIMCILAR
-- ============================================================
create or replace function public.duello_sinyal_ver(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.duello_sinyal set surum = surum + 1, guncellendi = now() where duello_id = p_id;
$$;

create or replace function public.duello_kategorileri()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k order by k), '{}') from (
    select distinct kategori as k from public.questions where aktif and kategori is not null
  ) s;
$$;

-- Oyuncunun en zayıf kategorisi: asgari örneklemi olanlar içinde en düşük yüzde.
create or replace function public.duello_en_zayif(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select k.kategori from public.kategori_istatistik k
   where k.user_id = p_user
     and k.toplam >= public.ayar_sayi('kategori_istatistik_min_ornek', 10)
   order by k.dogru::numeric / k.toplam asc, k.toplam desc
   limit 1;
$$;

-- Saldıranın kategori kullanımı: { kategori: adet }, son kategori
create or replace function public.duello_kategori_kullanimi(p_id uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sayim', coalesce((select jsonb_object_agg(kategori, n) from (
               select h.kategori, count(*) n from public.duello_hamleler h
                where h.duello_id = p_id and h.saldiran = p_user group by h.kategori) s), '{}'::jsonb),
    'son', (select h.kategori from public.duello_hamleler h
             where h.duello_id = p_id and h.saldiran = p_user order by h.id desc limit 1)
  );
$$;

create or replace function public.duello_kategori_uygun_mu(p_id uuid, p_user uuid, p_kategori text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_kategori = any(public.duello_kategorileri())
     and p_kategori is distinct from (select h.kategori from public.duello_hamleler h
                                       where h.duello_id = p_id and h.saldiran = p_user
                                       order by h.id desc limit 1)
     and (select count(*) from public.duello_hamleler h
           where h.duello_id = p_id and h.saldiran = p_user and h.kategori = p_kategori)
         < public.ayar_sayi('duello_kategori_max', 2);
$$;

-- Kategoriden, maçta kullanılmamış soru
create or replace function public.duello_soru_bul(p_id uuid, p_kategori text, p_oyuncular uuid[], p_haric uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_adaylar uuid[];
  v_s uuid;
begin
  v_adaylar := public.soru_sec(p_kategori, 8, p_oyuncular);
  foreach v_s in array coalesce(v_adaylar, '{}') loop
    if not (v_s = any(coalesce(p_haric, '{}'))) then return v_s; end if;
  end loop;
  select q.id into v_s from public.questions q
   where q.aktif and q.kategori = p_kategori and not (q.id = any(coalesce(p_haric, '{}')))
   order by random() limit 1;
  return v_s;
end $$;

-- Kategori profili (iç): oturum gerektirmez — cron'dan (bot rövanşı) da çağrılır.
create or replace function public.oyuncu_kategori_profili_ic(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_min int := public.ayar_sayi('kategori_istatistik_min_ornek', 10)::int;
begin
  if not exists (select 1 from public.profiles where id = p_user) then return null; end if;
  return jsonb_build_object(
    'toplam_mac', coalesce((select toplam_mac from public.profiles where id = p_user), 0),
    'istatistikli_mac', coalesce((select istatistikli_mac from public.oyuncu_istatistik where user_id = p_user), 0),
    'unvan', public.oyuncu_unvani(p_user),
    'min_ornek', v_min,
    'kategoriler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kategori', k.kategori, 'toplam', k.toplam,
               'yuzde', case when k.toplam >= v_min then round(100.0 * k.dogru / k.toplam)::int end)
             order by k.kategori)
        from public.kategori_istatistik k where k.user_id = p_user), '[]'::jsonb));
end $$;
revoke execute on function public.oyuncu_kategori_profili_ic(uuid) from public, anon, authenticated;

create or replace function public.oyuncu_kategori_profili(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  return public.oyuncu_kategori_profili_ic(coalesce(p_user, auth.uid()));
end $$;

-- ============================================================
-- OLUŞTURMA
-- ============================================================
create or replace function public.duello_olustur(p_a uuid, p_b uuid, p_dereceli boolean, p_onceki uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_can int := public.ayar_sayi('duello_can', 3)::int;
  v_p1 jsonb;
  v_p2 jsonb;
begin
  -- Profil ve en zayıf kategori MAÇ BAŞINDA sabitlenir.
  select public.oyuncu_kategori_profili_ic(p_a) into v_p1;
  select public.oyuncu_kategori_profili_ic(p_b) into v_p2;

  insert into public.duellolar (oyuncu1, oyuncu2, dereceli, can1, can2, saldiran, faz, faz_bitis,
                                profil1, profil2, zayif1, zayif2, onceki_id)
  values (p_a, p_b, coalesce(p_dereceli, true), v_can, v_can, p_a, 'kategori',
          now() + make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20)),
          v_p1, v_p2, public.duello_en_zayif(p_a), public.duello_en_zayif(p_b), p_onceki)
  returning id into v_id;

  insert into public.duello_sinyal (duello_id, oyuncu1, oyuncu2) values (v_id, p_a, p_b);
  delete from public.duello_kuyrugu where user_id in (p_a, p_b);
  return v_id;
end $$;

-- ============================================================
-- FAZ MAKİNESİ (iç)
-- ============================================================
create or replace function public.duello_kategori_uygula(p_id uuid, p_kategori text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_savunan uuid;
  v_soru uuid;
begin
  select * into d from public.duellolar where id = p_id;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
  v_soru := public.duello_soru_bul(p_id, p_kategori, array[v_savunan, d.saldiran], d.kullanilan_sorular);
  if v_soru is null then raise exception 'Bu kategoride soru kalmadı'; end if;

  update public.duellolar
     set kategori = p_kategori, soru_id = v_soru, faz = 'hazirlik',
         faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_hazirlik_sn', 4)),
         soru_degisti_saldiri = false, soru_degisti_savunma = false,
         zaman_baskisi = false, savunma_kilidi = false, ek_sure = false, elli_kapali = null,
         kullanilan_sorular = kullanilan_sorular || v_soru,
         son_hareket = now()
   where id = p_id;
end $$;

create or replace function public.duello_bitir(p_id uuid, p_kazanan uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_carpan numeric := 1;
  v_lig int;
  v_kazanan_bot boolean;
  v_oyuncu uuid;
begin
  select * into d from public.duellolar where id = p_id for update;
  if not found or d.durum <> 'aktif' then return; end if;

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (d.oyuncu1, d.oyuncu2);

  if not coalesce(v_bot_var, false) then
    v_carpan := public.cift_odul_carpani(d.oyuncu1, d.oyuncu2, null);
  end if;

  update public.duellolar
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(), odul_carpan = v_carpan,
         faz = case when faz = 'altin' then 'sonuc' else faz end, son_hareket = now()
   where id = p_id;

  -- Coin: dereceli tam, serbest yarı; indirimler çarpılmaz (coin_mac_odulu).
  perform public.coin_mac_odulu('duello:' || p_id::text, p_kazanan, array[d.oyuncu1, d.oyuncu2],
                                v_carpan, not d.dereceli, coalesce(v_acik_bot, false),
                                'coin_duello_galibiyet');

  foreach v_oyuncu in array array[d.oyuncu1, d.oyuncu2] loop
    perform public.mac_sayaci_arttir(v_oyuncu, true);
    perform public.istatistikli_mac_arttir(v_oyuncu);
  end loop;

  if p_kazanan is not null then
    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
  end if;

  if d.dereceli then
    if p_kazanan is not null then
      select coalesce(is_bot, false) into v_kazanan_bot from public.profiles where id = p_kazanan;
      v_lig := floor(public.ayar_sayi('lig_duello_galibiyet', 50) * v_carpan *
                     (case when v_kazanan_bot then public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100 else 1 end))::int;
      if v_lig > 0 then
        update public.profiles set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig where id = p_kazanan;
      end if;
    end if;
    foreach v_oyuncu in array array[d.oyuncu1, d.oyuncu2] loop
      perform public.gunluk_seri_bonusu(v_oyuncu);
    end loop;
  end if;

  perform public.duello_sinyal_ver(p_id);
end $$;

-- Tur sonu / 10 tur: kazanan belirle ya da altın soru
create or replace function public.duello_tur_sonu(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_soru uuid;
begin
  select * into d from public.duellolar where id = p_id;
  if d.can1 > 0 and d.can2 > 0 and d.tur < public.ayar_sayi('duello_max_tur', 10) then
    update public.duellolar
       set tur = tur + 1, saldiri_sirasi = 0, saldiran = oyuncu1, faz = 'kategori',
           faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20)),
           kategori = null, soru_id = null, son_hareket = now()
     where id = p_id;
    return;
  end if;

  if d.can1 <> d.can2 then
    perform public.duello_bitir(p_id, case when d.can1 > d.can2 then d.oyuncu1 else d.oyuncu2 end);
  elsif d.dogru1 <> d.dogru2 then
    perform public.duello_bitir(p_id, case when d.dogru1 > d.dogru2 then d.oyuncu1 else d.oyuncu2 end);
  else
    -- ALTIN SORU (turnuva mekaniği): kullanılmamış sorudan, jokersiz.
    select q.id into v_soru from public.questions q
     where q.aktif and not (q.id = any(d.kullanilan_sorular))
     order by random() limit 1;
    if v_soru is null then
      perform public.duello_bitir(p_id, d.oyuncu1);
      return;
    end if;
    update public.duellolar
       set faz = 'altin', soru_id = v_soru, kategori = (select kategori from public.questions where id = v_soru),
           altin_cevaplar = '{}'::jsonb, elli_kapali = null,
           kullanilan_sorular = kullanilan_sorular || v_soru,
           faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_altin_sn', 15)),
           son_hareket = now()
     where id = p_id;
  end if;
end $$;

-- Savunanın cevabını işle (p_cevap null = süre doldu)
create or replace function public.duello_cozumle(p_id uuid, p_cevap smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_savunan uuid;
  v_dogru_cevap smallint;
  v_dogru boolean;
  v_riskli boolean;
  v_kaybeden uuid;
begin
  select * into d from public.duellolar where id = p_id;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
  select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
  v_dogru := p_cevap is not null and p_cevap = v_dogru_cevap;
  v_riskli := d.kategori is not distinct from (case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end)
              and d.kategori is not null;

  if v_dogru then
    v_kaybeden := case when v_riskli then d.saldiran else null end;
  else
    v_kaybeden := v_savunan;
  end if;

  update public.duellolar
     set can1 = can1 - (case when v_kaybeden = oyuncu1 then 1 else 0 end),
         can2 = can2 - (case when v_kaybeden = oyuncu2 then 1 else 0 end),
         dogru1 = dogru1 + (case when v_dogru and v_savunan = oyuncu1 then 1 else 0 end),
         dogru2 = dogru2 + (case when v_dogru and v_savunan = oyuncu2 then 1 else 0 end),
         faz = 'sonuc',
         faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_sonuc_sn', 3)),
         son_hamle = jsonb_build_object(
           'tur', d.tur, 'saldiran', d.saldiran, 'savunan', v_savunan, 'kategori', d.kategori,
           'soru_id', d.soru_id, 'cevap', p_cevap, 'dogru', v_dogru, 'dogru_cevap', v_dogru_cevap,
           'riskli', v_riskli, 'can_kaybeden', v_kaybeden),
         son_hareket = now()
   where id = p_id;

  insert into public.duello_hamleler (duello_id, tur, saldiran, savunan, kategori, soru_id, cevap, dogru,
                                      riskli, can_kaybeden, zaman_baskisi, savunma_kilidi)
  values (p_id, d.tur, d.saldiran, v_savunan, d.kategori, d.soru_id, p_cevap, v_dogru,
          v_riskli, v_kaybeden, d.zaman_baskisi, d.savunma_kilidi);

  perform public.kategori_istatistik_yaz(v_savunan, d.kategori, v_dogru);
  if p_cevap is not null then perform public.soru_sayac(d.soru_id, v_dogru); end if;
  if not v_dogru and auth.uid() = v_savunan then perform public.yanlis_kaydet(d.soru_id); end if;
end $$;

-- Altın soru değerlendirmesi
create or replace function public.duello_altin_degerlendir(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_d1 boolean;
  v_d2 boolean;
  v_soru uuid;
begin
  select * into d from public.duellolar where id = p_id;
  v_d1 := coalesce((d.altin_cevaplar -> d.oyuncu1::text ->> 'dogru')::boolean, false);
  v_d2 := coalesce((d.altin_cevaplar -> d.oyuncu2::text ->> 'dogru')::boolean, false);

  update public.duellolar
     set son_hamle = jsonb_build_object('altin', true, 'soru_id', d.soru_id,
                       'dogru_cevap', (select dogru_cevap from public.questions where id = d.soru_id),
                       'cevaplar', d.altin_cevaplar)
   where id = p_id;

  if v_d1 <> v_d2 then
    perform public.duello_bitir(p_id, case when v_d1 then d.oyuncu1 else d.oyuncu2 end);
    return;
  end if;

  select q.id into v_soru from public.questions q
   where q.aktif and not (q.id = any(d.kullanilan_sorular))
   order by random() limit 1;
  if v_soru is null then
    perform public.duello_bitir(p_id, d.oyuncu1);
    return;
  end if;
  update public.duellolar
     set soru_id = v_soru, kategori = (select kategori from public.questions where id = v_soru),
         altin_cevaplar = '{}'::jsonb, kullanilan_sorular = kullanilan_sorular || v_soru,
         faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_altin_sn', 15)),
         son_hareket = now()
   where id = p_id;
end $$;

-- Süresi dolan fazları ilerletir. Kilit çağırana ait (FOR UPDATE).
create or replace function public.duello_ilerlet(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_kat text;
  v_adim int := 0;
  v_savunan uuid;
begin
  loop
    v_adim := v_adim + 1;
    exit when v_adim > 12;
    select * into d from public.duellolar where id = p_id;
    exit when not found or d.durum <> 'aktif';

    if d.created_at < now() - make_interval(mins => public.ayar_sayi('duello_zaman_asimi_dk', 60)::int) then
      update public.duellolar set durum = 'iptal', bitis = now() where id = p_id;
      perform public.duello_sinyal_ver(p_id);
      exit;
    end if;

    exit when d.faz_bitis is not null and now() < d.faz_bitis
              and not (d.faz = 'cevap');
    if d.faz = 'cevap' then
      -- 1 sn ağ payı
      exit when now() <= d.faz_bitis + interval '1 second';
    end if;

    if d.faz = 'kategori' then
      -- Süre doldu: uygun kategorilerden, mümkünse riskli olmayan, rastgele
      v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
      select k into v_kat from unnest(public.duello_kategorileri()) k
       where public.duello_kategori_uygun_mu(p_id, d.saldiran, k)
       order by (k is not distinct from (case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end)), random()
       limit 1;
      perform public.duello_kategori_uygula(p_id, v_kat);
    elsif d.faz = 'hazirlik' then
      update public.duellolar
         set faz = 'cevap',
             -- geç ilerletilse de savunan tam süresini alır
             faz_bitis = greatest(d.faz_bitis, now()) + make_interval(secs =>
               case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                    else public.ayar_sayi('duello_cevap_sn', 15) end),
             son_hareket = now()
       where id = p_id;
    elsif d.faz = 'cevap' then
      perform public.duello_cozumle(p_id, null);
    elsif d.faz = 'sonuc' then
      if d.saldiri_sirasi = 0 then
        update public.duellolar
           set saldiri_sirasi = 1, saldiran = oyuncu2, faz = 'kategori', kategori = null, soru_id = null,
               faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20)),
               son_hareket = now()
         where id = p_id;
      else
        perform public.duello_tur_sonu(p_id);
      end if;
    elsif d.faz = 'altin' then
      perform public.duello_altin_degerlendir(p_id);
    end if;
    perform public.duello_sinyal_ver(p_id);
  end loop;
end $$;

-- ============================================================
-- OYUNCU EYLEMLERİ
-- ============================================================
create or replace function public.duello_kilitle(p_id uuid)
returns public.duellolar language plpgsql security definer set search_path = public as $$
declare d public.duellolar%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  select * into d from public.duellolar where id = p_id for update;
  if not found then raise exception 'Düello bulunamadı'; end if;
  if auth.uid() not in (d.oyuncu1, d.oyuncu2) then raise exception 'Bu düelloda değilsin'; end if;
  perform public.duello_ilerlet(p_id);
  select * into d from public.duellolar where id = p_id;
  return d;
end $$;

create or replace function public.duello_kategori_sec(p_id uuid, p_kategori text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.duellolar%rowtype;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' then raise exception 'Düello bitti'; end if;
  if d.faz <> 'kategori' or d.saldiran <> auth.uid() then raise exception 'Şu an kategori seçme sırası sende değil'; end if;
  if not public.duello_kategori_uygun_mu(p_id, auth.uid(), p_kategori) then
    raise exception 'Bu kategori şu an seçilemez';
  end if;
  perform public.duello_kategori_uygula(p_id, p_kategori);
  select * into d from public.duellolar where id = p_id;
  perform public.gorulen_kaydet(d.soru_id);
  perform public.duello_sinyal_ver(p_id);
end $$;

create or replace function public.duello_saldiri_jokeri(p_id uuid, p_tur text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_kullanilan int;
  v_ucretsiz boolean;
  v_soru uuid;
  v_savunan uuid;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_tur not in ('zaman_baskisi','saldiri_degistir','savunma_kilidi') then raise exception 'Geçersiz joker'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' or d.faz <> 'hazirlik' or d.saldiran <> v_me or now() >= d.faz_bitis then
    raise exception 'Saldırı jokerleri yalnız Saldırı Hazırlığı sırasında kullanılır';
  end if;
  if (p_tur = 'zaman_baskisi' and d.zaman_baskisi) or (p_tur = 'savunma_kilidi' and d.savunma_kilidi) then
    raise exception 'Bu joker bu saldırıda zaten kullanıldı';
  end if;
  if p_tur = 'saldiri_degistir' and d.soru_degisti_saldiri then
    raise exception 'Yeni gelen soru ikinci kez değiştirilemez';
  end if;

  select count(*) into v_kullanilan from public.joker_kullanimlari
   where user_id = v_me and mac_tur = 'duello' and mac_id = p_id
     and tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi');
  if v_kullanilan >= public.ayar_sayi('duello_saldiri_joker_siniri', 2) then
    raise exception 'Bu maçta en fazla % saldırı jokeri kullanabilirsin', public.ayar_sayi('duello_saldiri_joker_siniri', 2);
  end if;

  v_ucretsiz := (select count(*) from public.joker_kullanimlari
                  where user_id = v_me and mac_tur = 'duello' and mac_id = p_id and ucretsiz
                    and tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi'))
                < public.ayar_sayi('duello_ucretsiz_saldiri_joker', 1);
  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', 'duello:' || p_id::text);
  end if;
  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, 'duello', p_id, d.tur * 2 + d.saldiri_sirasi, p_tur, v_ucretsiz);

  if p_tur = 'zaman_baskisi' then
    update public.duellolar set zaman_baskisi = true, son_hareket = now() where id = p_id;
  elsif p_tur = 'savunma_kilidi' then
    update public.duellolar set savunma_kilidi = true, son_hareket = now() where id = p_id;
  else
    v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
    v_soru := public.duello_soru_bul(p_id, d.kategori, array[v_savunan, v_me], d.kullanilan_sorular);
    if v_soru is null then raise exception 'Bu kategoride başka soru kalmadı'; end if;
    update public.duellolar
       set soru_id = v_soru, soru_degisti_saldiri = true,
           kullanilan_sorular = kullanilan_sorular || v_soru, son_hareket = now()
     where id = p_id;
    perform public.gorulen_kaydet(v_soru);
  end if;
  perform public.duello_sinyal_ver(p_id);
end $$;

create or replace function public.duello_savunma_jokeri(p_id uuid, p_tur text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_dogru smallint;
  v_soru uuid;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_tur not in ('elli','sure','soru_degistir') then raise exception 'Geçersiz joker'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' or d.faz <> 'cevap' or d.saldiran = v_me or now() > d.faz_bitis then
    raise exception 'Savunma jokerleri yalnız cevap verirken kullanılır';
  end if;
  if d.savunma_kilidi then raise exception 'Rakip bu soruda savunma jokeri kullanamaz'; end if;
  if p_tur = 'elli' and d.elli_kapali is not null then raise exception 'Bu soruda 50:50 zaten kullanıldı'; end if;
  if p_tur = 'sure' and d.ek_sure then raise exception 'Bu soruda Ek Süre zaten kullanıldı'; end if;

  select count(*) into v_kullanilan from public.joker_kullanimlari
   where user_id = v_me and mac_tur = 'duello' and mac_id = p_id and tur in ('elli','sure','soru_degistir');
  if v_kullanilan >= public.ayar_sayi('duello_savunma_joker_siniri', 2) then
    raise exception 'Bu maçta en fazla % savunma jokeri kullanabilirsin', public.ayar_sayi('duello_savunma_joker_siniri', 2);
  end if;
  if p_tur = 'soru_degistir' and exists (select 1 from public.joker_kullanimlari
      where user_id = v_me and mac_tur = 'duello' and mac_id = p_id and tur = 'soru_degistir') then
    raise exception 'Bu maçta soruyu bir kez değiştirebilirsin';
  end if;
  -- 50:50 maç başına ilk kullanımda ücretsiz (1v1 kuralı)
  if p_tur = 'elli' and not exists (select 1 from public.joker_kullanimlari
      where user_id = v_me and mac_tur = 'duello' and mac_id = p_id and tur = 'elli' and ucretsiz) then
    v_ucretsiz := true;
  end if;
  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', 'duello:' || p_id::text);
  end if;
  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, 'duello', p_id, d.tur * 2 + d.saldiri_sirasi, p_tur, v_ucretsiz);

  if p_tur = 'elli' then
    select dogru_cevap into v_dogru from public.questions where id = d.soru_id;
    update public.duellolar
       set elli_kapali = (select array_agg(x) from (select x from generate_series(0, 3) x
                            where x <> v_dogru order by random() limit 2) s),
           son_hareket = now()
     where id = p_id;
  elsif p_tur = 'sure' then
    update public.duellolar
       set ek_sure = true, faz_bitis = faz_bitis + make_interval(secs => public.ayar_sayi('duello_ek_sure_sn', 5)),
           son_hareket = now()
     where id = p_id;
  else
    v_soru := public.duello_soru_bul(p_id, d.kategori, array[v_me, d.saldiran], d.kullanilan_sorular);
    if v_soru is null then raise exception 'Bu kategoride başka soru kalmadı'; end if;
    update public.duellolar
       set soru_id = v_soru, soru_degisti_savunma = true, elli_kapali = null,
           kullanilan_sorular = kullanilan_sorular || v_soru,
           faz_bitis = now() + make_interval(secs =>
             case when zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                  else public.ayar_sayi('duello_cevap_sn', 15) end),
           son_hareket = now()
     where id = p_id;
  end if;
  perform public.duello_sinyal_ver(p_id);
end $$;

create or replace function public.duello_cevap(p_id uuid, p_cevap smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_dogru boolean;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_cevap is null or p_cevap not between 0 and 3 then raise exception 'Geçersiz cevap'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' then raise exception 'Düello bitti'; end if;

  if d.faz = 'cevap' then
    if d.saldiran = v_me then raise exception 'Kendi saldırını cevaplayamazsın'; end if;
    perform public.gorulen_kaydet(d.soru_id);
    perform public.duello_cozumle(p_id, p_cevap);
  elsif d.faz = 'altin' then
    if d.altin_cevaplar ? v_me::text then raise exception 'Bu soruyu zaten cevapladın'; end if;
    v_dogru := p_cevap = (select dogru_cevap from public.questions where id = d.soru_id);
    update public.duellolar
       set altin_cevaplar = altin_cevaplar || jsonb_build_object(v_me::text,
             jsonb_build_object('cevap', p_cevap, 'dogru', v_dogru)),
           son_hareket = now()
     where id = p_id;
    perform public.gorulen_kaydet(d.soru_id);
    perform public.kategori_istatistik_yaz(v_me, d.kategori, v_dogru);
    select * into d from public.duellolar where id = p_id;
    if (d.altin_cevaplar ? d.oyuncu1::text) and (d.altin_cevaplar ? d.oyuncu2::text) then
      perform public.duello_altin_degerlendir(p_id);
    end if;
  else
    raise exception 'Şu an cevap verilemez';
  end if;
  perform public.duello_sinyal_ver(p_id);
end $$;

create or replace function public.duello_terk(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.duellolar%rowtype;
begin
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' then return; end if;
  -- Terk eden hükmen kaybeder.
  perform public.duello_bitir(p_id, case when d.oyuncu1 = auth.uid() then d.oyuncu2 else d.oyuncu1 end);
end $$;

-- ============================================================
-- GÖRÜNÜM (oyuncuya süzülmüş)
-- ============================================================
create or replace function public.duello_durum(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_rakip uuid;
  v_savunan uuid;
  v_dil text := public.oyuncu_dili();
  v_soru_goster boolean;
  v_soru jsonb;
  v_arkadas boolean;
  v_ezeli jsonb;
  v_odul jsonb;
  v_envanter jsonb;
  v_kullanim jsonb;
begin
  perform public.hiz_siniri('duello_durum', 400, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  v_rakip := case when d.oyuncu1 = v_me then d.oyuncu2 else d.oyuncu1 end;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;

  v_soru_goster := d.soru_id is not null and (
       (d.faz = 'hazirlik' and d.saldiran = v_me)
    or d.faz in ('cevap','sonuc','altin')
    or d.durum <> 'aktif');
  if v_soru_goster then
    select jsonb_build_object('soru', sd.soru, 'secenekler', sd.secenekler, 'kategori', sd.kategori)
      into v_soru from public.soru_dilinde(d.soru_id, v_dil) sd;
  end if;

  v_arkadas := exists (select 1 from public.friendships f where f.durum = 'arkadas'
     and ((f.requester = v_me and f.addressee = v_rakip) or (f.requester = v_rakip and f.addressee = v_me)));
  if v_arkadas then
    select jsonb_build_object(
             'ben', count(*) filter (where x.kazanan = v_me),
             'rakip', count(*) filter (where x.kazanan = v_rakip))
      into v_ezeli
      from public.duellolar x
     where x.durum = 'bitti'
       and ((x.oyuncu1 = v_me and x.oyuncu2 = v_rakip) or (x.oyuncu1 = v_rakip and x.oyuncu2 = v_me));
  end if;

  if d.durum = 'bitti' then
    v_odul := jsonb_build_object(
      'lig_puan', case when d.dereceli and d.kazanan = v_me
                       then floor(public.ayar_sayi('lig_duello_galibiyet', 50) * d.odul_carpan)::int else 0 end,
      'coin', coalesce((select sum(h.miktar) from public.coin_hareketleri h
                         where h.user_id = v_me and h.tur = 'mac' and h.referans = 'duello:' || p_id::text), 0));
  end if;

  select coalesce(jsonb_object_agg(e.tur, e.adet), '{}'::jsonb) into v_envanter
    from public.joker_envanter e where e.user_id = v_me;
  select jsonb_build_object(
           'saldiri', count(*) filter (where k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'saldiri_ucretsiz', count(*) filter (where k.ucretsiz and k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'savunma', count(*) filter (where k.tur in ('elli','sure','soru_degistir')),
           'elli_ucretsiz', bool_or(k.tur = 'elli' and k.ucretsiz),
           'soru_degistir', bool_or(k.tur = 'soru_degistir'))
    into v_kullanim
    from public.joker_kullanimlari k where k.user_id = v_me and k.mac_tur = 'duello' and k.mac_id = p_id;

  return jsonb_build_object(
    'id', d.id, 'durum', d.durum, 'dereceli', d.dereceli,
    'tur', d.tur, 'max_tur', public.ayar_sayi('duello_max_tur', 10), 'saldiri_sirasi', d.saldiri_sirasi,
    'faz', d.faz, 'faz_bitis', d.faz_bitis, 'sunucu_zamani', now(),
    'ben', v_me, 'saldiran', d.saldiran, 'savunan', v_savunan,
    'oyuncular', jsonb_build_array(
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can1, 'dogru', d.dogru1, 'profil', d.profil1, 'zayif', d.zayif1,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu1),
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can2, 'dogru', d.dogru2, 'profil', d.profil2, 'zayif', d.zayif2,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu2)),
    'kategoriler', to_jsonb(public.duello_kategorileri()),
    'kategori_max', public.ayar_sayi('duello_kategori_max', 2),
    'kullanim', jsonb_build_object(d.oyuncu1::text, public.duello_kategori_kullanimi(p_id, d.oyuncu1),
                                   d.oyuncu2::text, public.duello_kategori_kullanimi(p_id, d.oyuncu2)),
    'kategori', d.kategori,
    'soru', v_soru,
    'elli_kapali', case when v_me = v_savunan and d.faz = 'cevap' then to_jsonb(d.elli_kapali) end,
    'zaman_baskisi', d.zaman_baskisi, 'savunma_kilidi', d.savunma_kilidi, 'ek_sure', d.ek_sure,
    'soru_degisti_saldiri', d.soru_degisti_saldiri,
    'son_hamle', case when d.faz in ('sonuc','kategori','altin') or d.durum <> 'aktif' then d.son_hamle end,
    'altin', case when d.faz = 'altin' then jsonb_build_object(
                    'ben_cevapladim', d.altin_cevaplar ? v_me::text,
                    'benim_cevabim', d.altin_cevaplar -> v_me::text -> 'cevap',
                    'rakip_cevapladi', d.altin_cevaplar ? v_rakip::text) end,
    'jokerler', jsonb_build_object(
       'envanter', v_envanter, 'kullanim', v_kullanim,
       'saldiri_siniri', public.ayar_sayi('duello_saldiri_joker_siniri', 2),
       'savunma_siniri', public.ayar_sayi('duello_savunma_joker_siniri', 2),
       'ucretsiz_saldiri', public.ayar_sayi('duello_ucretsiz_saldiri_joker', 1)),
    'sureler', jsonb_build_object('cevap', public.ayar_sayi('duello_cevap_sn', 15),
       'zaman_baskisi', public.ayar_sayi('duello_zaman_baskisi_sn', 10),
       'hazirlik', public.ayar_sayi('duello_hazirlik_sn', 4),
       'kategori', public.ayar_sayi('duello_kategori_sn', 20),
       'altin', public.ayar_sayi('duello_altin_sn', 15)),
    'kazanan', d.kazanan, 'odul', v_odul, 'ezeli', v_ezeli,
    'rovans', jsonb_build_object('isteyen', d.rovans_isteyen, 'id', d.rovans_id,
       'gecerli', d.rovans_at is not null and d.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60)))
  );
end $$;

-- ============================================================
-- EŞLEŞME
-- ============================================================
create or replace function public.duello_ara(p_dereceli boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_lig int;
  v_rakip uuid;
  v_bas timestamptz;
  v_bot uuid;
begin
  perform public.hiz_siniri('duello_ara', 90, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  -- Devam eden düellom varsa ona dön
  select x.id into v_id from public.duellolar x
   where x.durum = 'aktif' and v_me in (x.oyuncu1, x.oyuncu2) limit 1;
  if found then
    delete from public.duello_kuyrugu where user_id = v_me;
    return v_id;
  end if;

  delete from public.duello_kuyrugu where created_at < now() - interval '90 seconds';
  select public.lig_sirasi(coalesce(lig, 'bronz')) into v_lig from public.profiles where id = v_me;
  v_lig := coalesce(v_lig, 1);

  -- Gerçek rakip: aynı giriş türü, kendi ligi ± 1
  select q.user_id into v_rakip
    from public.duello_kuyrugu q
    join public.profiles pr on pr.id = q.user_id
   where q.user_id <> v_me
     and q.dereceli = coalesce(p_dereceli, true)
     and public.lig_sirasi(coalesce(pr.lig, 'bronz')) between v_lig - 1 and v_lig + 1
   order by q.created_at
   limit 1
   for update of q skip locked;

  if v_rakip is not null then
    perform public.mac_kotasi_kontrol();
    return public.duello_olustur(v_rakip, v_me, p_dereceli);
  end if;

  select q.created_at into v_bas from public.duello_kuyrugu q where q.user_id = v_me;
  if v_bas is null then
    insert into public.duello_kuyrugu (user_id, dereceli) values (v_me, coalesce(p_dereceli, true))
    on conflict (user_id) do update set dereceli = excluded.dereceli, created_at = now();
    return null;
  end if;
  update public.duello_kuyrugu set dereceli = coalesce(p_dereceli, true) where user_id = v_me;

  -- Kimse yoksa: arama süresi + insan gibi gecikme sonra gizli bot (lig ± 1).
  if now() < v_bas + make_interval(secs => public.ayar_sayi('duello_arama_sn', 8))
              + public.bot_eslesme_gecikmesi(v_me, v_bas) * interval '1 second' then
    return null;
  end if;

  v_bot := public.bot_sec(v_me);
  if v_bot is null then raise exception 'Şu an uygun rakip yok, birazdan tekrar dene.'; end if;
  perform public.mac_kotasi_kontrol();
  perform public.bot_kisilik_tohumla(v_bot);
  return public.duello_olustur(v_me, v_bot, p_dereceli);
end $$;

create or replace function public.duello_aramadan_cik()
returns void language sql security definer set search_path = public as $$
  delete from public.duello_kuyrugu where user_id = auth.uid();
$$;

-- ============================================================
-- RÖVANŞ
-- ============================================================
create or replace function public.duello_rovans_iste(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.duellolar%rowtype;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  if d.durum <> 'bitti' then raise exception 'Düello henüz bitmedi'; end if;
  if d.rovans_id is not null then return; end if;
  if d.bitis < now() - interval '24 hours' then raise exception 'Rövanş süresi doldu'; end if;
  update public.duellolar set rovans_isteyen = auth.uid(), rovans_at = now() where id = p_id;
  perform public.duello_sinyal_ver(p_id);
end $$;

create or replace function public.duello_rovans_baslat(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_yeni uuid;
begin
  select * into d from public.duellolar where id = p_id for update;
  if d.rovans_id is not null then return d.rovans_id; end if;
  if exists (select 1 from public.duellolar x where x.durum = 'aktif'
               and (x.oyuncu1 in (d.oyuncu1, d.oyuncu2) or x.oyuncu2 in (d.oyuncu1, d.oyuncu2))) then
    raise exception 'Oyunculardan birinin devam eden düellosu var';
  end if;
  -- Rövanşta ilk saldırı sırası değişir
  v_yeni := public.duello_olustur(d.oyuncu2, d.oyuncu1, d.dereceli, p_id);
  update public.duellolar set rovans_id = v_yeni where id = p_id;
  perform public.duello_sinyal_ver(p_id);
  return v_yeni;
end $$;

create or replace function public.duello_rovans_yanitla(p_id uuid, p_kabul boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.duellolar%rowtype;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  if d.rovans_isteyen is null or d.rovans_isteyen = auth.uid() then raise exception 'Yanıtlanacak rövanş yok'; end if;
  if d.rovans_id is not null then return d.rovans_id; end if;
  if d.rovans_at < now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60)) then
    raise exception 'Rövanş isteğinin süresi doldu';
  end if;
  if not coalesce(p_kabul, false) then
    update public.duellolar set rovans_isteyen = null, rovans_at = null where id = p_id;
    perform public.duello_sinyal_ver(p_id);
    return null;
  end if;
  perform public.mac_kotasi_kontrol();
  return public.duello_rovans_baslat(p_id);
end $$;

-- ============================================================
-- ÇİFT KORUMASI DÜELLOYU DA SAYAR
-- ============================================================
create or replace function public.cift_odul_carpani(p_a uuid, p_b uuid, p_mac_id uuid default null)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tam  int := public.ayar_sayi('mac_cift_tam_sinir', 5)::int;
  v_yari int := public.ayar_sayi('mac_cift_yari_sinir', 10)::int;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sira int;
begin
  -- Aynı cihaz/IP: sıralı maç hiç ödül vermez (sessiz koruma).
  if public.ayni_cihaz_mi(p_a, p_b) then return 0; end if;

  select
    (select count(*) from public.matches m
      where m.durum = 'bitti'
        and ((m.oyuncu1 = p_a and m.oyuncu2 = p_b) or (m.oyuncu1 = p_b and m.oyuncu2 = p_a))
        and (coalesce(m.bitis, m.created_at) at time zone 'Europe/Istanbul')::date = v_bugun
        and (p_mac_id is null or m.id <> p_mac_id))
  + (select count(*) from public.duellolar x
      where x.durum = 'bitti'
        and ((x.oyuncu1 = p_a and x.oyuncu2 = p_b) or (x.oyuncu1 = p_b and x.oyuncu2 = p_a))
        and (coalesce(x.bitis, x.created_at) at time zone 'Europe/Istanbul')::date = v_bugun
        and (p_mac_id is null or x.id <> p_mac_id))
  into v_sira;

  v_sira := v_sira + 1;   -- bu maç kaçıncı olacak

  if v_sira <= v_tam then return 1; end if;
  if v_sira <= v_yari then return 0.5; end if;
  return 0;
end;
$$;

-- Ezeli rakip: arkadaşlar arası 1v1 + düello
create or replace function public.ezeli_rakip()
returns table(user_id uuid, gorunen_ad text, gorunen_avatar text, toplam integer, galibiyet integer, maglubiyet integer, beraberlik integer)
language sql
stable
security definer
set search_path = public
as $$
  with maclar as (
    select case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end as rakip, m.kazanan
      from public.matches m
     where m.durum = 'bitti' and auth.uid() in (m.oyuncu1, m.oyuncu2)
    union all
    select case when x.oyuncu1 = auth.uid() then x.oyuncu2 else x.oyuncu1 end, x.kazanan
      from public.duellolar x
     where x.durum = 'bitti' and auth.uid() in (x.oyuncu1, x.oyuncu2)
  ), arkadas as (
    select mc.* from maclar mc
     where exists (
       select 1 from public.friendships f
        where f.durum = 'arkadas'
          and ((f.requester = auth.uid() and f.addressee = mc.rakip)
            or (f.addressee = auth.uid() and f.requester = mc.rakip)))
  ), ozet as (
    select rakip,
           count(*)::int as toplam,
           count(*) filter (where kazanan = auth.uid())::int as galibiyet,
           count(*) filter (where kazanan is not null and kazanan <> auth.uid())::int as maglubiyet,
           count(*) filter (where kazanan is null)::int as beraberlik
      from arkadas
     group by rakip
    having count(*) >= 3
  )
  select o.rakip, p.gorunen_ad, p.gorunen_avatar, o.toplam, o.galibiyet, o.maglubiyet, o.beraberlik
    from ozet o
    join public.profiles p on p.id = o.rakip
   order by o.toplam desc, o.maglubiyet desc
   limit 1;
$$;

-- ============================================================
-- BOT + ZAMANLAYICI (cron, 2 sn)
-- ============================================================
create or replace function public.duello_bot_kategori(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.duellolar%rowtype;
  v_savunan uuid;
  v_profil jsonb;
  v_zayif text;
  v_kat text;
begin
  select * into d from public.duellolar where id = p_id;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
  v_profil := case when v_savunan = d.oyuncu1 then d.profil1 else d.profil2 end;
  v_zayif := case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end;

  -- Rakibin düşük yüzdeli kategorilerine yönelir; en zayıftan çoğu zaman
  -- kaçınır (saldırı riski). Veri olmayan kategori ortalama sayılır.
  select k into v_kat
    from unnest(public.duello_kategorileri()) k
    left join lateral (
      select (e ->> 'yuzde')::int as yuzde from jsonb_array_elements(coalesce(v_profil -> 'kategoriler', '[]'::jsonb)) e
       where e ->> 'kategori' = k
    ) pr on true
   where public.duello_kategori_uygun_mu(p_id, d.saldiran, k)
     and not (k is not distinct from v_zayif and random() * 100 < public.ayar_sayi('duello_bot_riskten_kacma_yuzde', 65))
   order by coalesce(pr.yuzde, 60) + random() * 25
   limit 1;

  if v_kat is null then
    select k into v_kat from unnest(public.duello_kategorileri()) k
     where public.duello_kategori_uygun_mu(p_id, d.saldiran, k) order by random() limit 1;
  end if;
  return v_kat;
end $$;

create or replace function public.duello_tik_hepsi()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  d public.duellolar%rowtype;
  v_bot uuid;
  v_bot_saldiran boolean;
  v_kat text;
  v_cevap smallint;
  v_dogru_cevap smallint;
  v_bas timestamptz;
  v_gecikme double precision;
  v_islenen int := 0;
  v_tur text;
  v_min real;
  v_max real;
begin
  for r in select x.id from public.duellolar x where x.durum = 'aktif' loop
    begin
      select * into d from public.duellolar where id = r.id for update skip locked;
      if not found then continue; end if;
      perform public.duello_ilerlet(r.id);
      select * into d from public.duellolar where id = r.id;
      if d.durum <> 'aktif' then continue; end if;

      select p.id, p.bot_gecikme_min, p.bot_gecikme_max into v_bot, v_min, v_max
        from public.profiles p where p.id in (d.oyuncu1, d.oyuncu2) and coalesce(p.is_bot, false) limit 1;
      if v_bot is null then continue; end if;
      v_bot_saldiran := (d.saldiran = v_bot);

      if d.faz = 'kategori' and v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20));
        if now() >= v_bas + make_interval(secs =>
             public.ayar_ondalik('duello_bot_kategori_min_sn', 2)
             + public.bot_rasgele('dkat:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi)
               * (public.ayar_ondalik('duello_bot_kategori_max_sn', 5) - public.ayar_ondalik('duello_bot_kategori_min_sn', 2))) then
          v_kat := public.duello_bot_kategori(d.id);
          if v_kat is not null then
            perform public.duello_kategori_uygula(d.id, v_kat);
            perform public.duello_sinyal_ver(d.id);
          end if;
        end if;

      elsif d.faz = 'hazirlik' and v_bot_saldiran and not d.zaman_baskisi and not d.savunma_kilidi then
        -- Bir kez zar at (saldırı başına sabit tohum)
        if public.bot_rasgele('djok:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi) * 100
             < public.ayar_sayi('duello_bot_joker_yuzde', 15)
           and (select count(*) from public.joker_kullanimlari k
                 where k.user_id = v_bot and k.mac_tur = 'duello' and k.mac_id = d.id)
               < public.ayar_sayi('duello_saldiri_joker_siniri', 2) then
          v_tur := case when public.bot_rasgele('djt:' || d.id::text || ':' || d.tur) < 0.5
                        then 'zaman_baskisi' else 'savunma_kilidi' end;
          insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
          values (v_bot, 'duello', d.id, d.tur * 2 + d.saldiri_sirasi, v_tur, true);
          update public.duellolar
             set zaman_baskisi = zaman_baskisi or v_tur = 'zaman_baskisi',
                 savunma_kilidi = savunma_kilidi or v_tur = 'savunma_kilidi'
           where id = d.id;
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'cevap' and not v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs =>
                   case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                        else public.ayar_sayi('duello_cevap_sn', 15) end)
                 - case when d.ek_sure then make_interval(secs => public.ayar_sayi('duello_ek_sure_sn', 5)) else interval '0' end;
        v_gecikme := least(
          extract(epoch from (d.faz_bitis - v_bas)) - 0.8,
          public.bot_gecikme_sn(v_bot, 'duello:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          perform public.duello_cozumle(d.id, v_cevap);
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'altin' and not (d.altin_cevaplar ? v_bot::text) then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_altin_sn', 15));
        v_gecikme := least(
          public.ayar_ondalik('duello_altin_sn', 15) - 0.8,
          public.bot_gecikme_sn(v_bot, 'dalt:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          update public.duellolar
             set altin_cevaplar = altin_cevaplar || jsonb_build_object(v_bot::text,
                   jsonb_build_object('cevap', v_cevap, 'dogru', v_cevap = v_dogru_cevap))
           where id = d.id;
          perform public.kategori_istatistik_yaz(v_bot, d.kategori, v_cevap = v_dogru_cevap);
          select * into d from public.duellolar where id = d.id;
          if (d.altin_cevaplar ? d.oyuncu1::text) and (d.altin_cevaplar ? d.oyuncu2::text) then
            perform public.duello_altin_degerlendir(d.id);
          end if;
          perform public.duello_sinyal_ver(d.id);
        end if;
      end if;
      v_islenen := v_islenen + 1;
    exception when others then
      raise warning 'duello_tik_hepsi %: %', r.id, sqlerrm;
    end;
  end loop;

  -- Bota gelen rövanş istekleri: insan gibi gecikmeyle kabul
  for r in
    select x.id, p.id as bot_id, p.bot_turu, x.rovans_at
      from public.duellolar x
      join public.profiles p on p.id in (x.oyuncu1, x.oyuncu2) and coalesce(p.is_bot, false)
     where x.durum = 'bitti' and x.rovans_isteyen is not null and x.rovans_isteyen <> p.id
       and x.rovans_id is null
       and x.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60))
  loop
    begin
      if now() >= r.rovans_at + make_interval(secs => 2 + 4 * public.bot_rasgele('drov:' || r.id::text)) then
        perform public.duello_rovans_baslat(r.id);
      end if;
    exception when others then
      raise warning 'duello rovans %: %', r.id, sqlerrm;
    end;
  end loop;

  return v_islenen;
end $$;

-- ============================================================
-- YETKİLER
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'duello_sinyal_ver(uuid)', 'duello_kategorileri()', 'duello_en_zayif(uuid)',
    'duello_kategori_kullanimi(uuid,uuid)', 'duello_kategori_uygun_mu(uuid,uuid,text)',
    'duello_soru_bul(uuid,text,uuid[],uuid[])', 'duello_olustur(uuid,uuid,boolean,uuid)',
    'duello_kategori_uygula(uuid,text)', 'duello_bitir(uuid,uuid)', 'duello_tur_sonu(uuid)',
    'duello_cozumle(uuid,smallint)', 'duello_altin_degerlendir(uuid)', 'duello_ilerlet(uuid)',
    'duello_kilitle(uuid)', 'duello_rovans_baslat(uuid)', 'duello_bot_kategori(uuid)', 'duello_tik_hepsi()'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array[
    'duello_kategori_sec(uuid,text)', 'duello_saldiri_jokeri(uuid,text)', 'duello_savunma_jokeri(uuid,text)',
    'duello_cevap(uuid,smallint)', 'duello_terk(uuid)', 'duello_durum(uuid)', 'duello_ara(boolean)',
    'duello_aramadan_cik()', 'duello_rovans_iste(uuid)', 'duello_rovans_yanitla(uuid,boolean)'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

select cron.schedule('duello_tik', '2 seconds', 'select public.duello_tik_hepsi()');
