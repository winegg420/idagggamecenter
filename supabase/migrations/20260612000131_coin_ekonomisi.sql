-- ============================================================
-- COIN EKONOMİSİ
--
-- Oyunun tek para birimi: coin. Dükkândaki her şey coin ile alınır.
-- Coin ya oynayarak kazanılır (maç, reklam, etkinlik) ya gerçek parayla
-- satın alınır (Play Billing → coin paketi).
--
-- TASARIM KARARLARI
--  • Bakiye `profiles.coin` üzerinde tek satırda durur: harcama sırasında
--    `for update` ile kilitlenebiliyor, çift harcama yarışı kapanıyor.
--  • Her hareket `coin_hareketleri`'ne yazılır — denetim ve hata ayıklama
--    olmadan para birimi yönetilemez.
--  • Bakiyeye İSTEMCİ DOKUNAMAZ. RLS kolon bazlı çalışmadığı için koruma
--    trigger ile yapılıyor: `coin` ancak işlem-yerel `app.coin_izin` bayrağı
--    açıkken değişebilir, o bayrağı da yalnız buradaki security definer
--    fonksiyonlar açar.
--  • Rakamlar KODA GÖMÜLMEZ. Hepsi `oyun_ayarlari` tablosundan okunur;
--    sahibi tek satır güncelleyerek dengeyi değiştirebilir.
-- ============================================================

-- ------------------------------------------------------------
-- AYAR TABLOSU — dengeleme sayıları tek yerde
-- ------------------------------------------------------------
create table if not exists public.oyun_ayarlari (
  anahtar text primary key,
  deger jsonb not null,
  aciklama text
);

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('coin_mac_galibiyet',  '20'::jsonb,  'Maç kazanınca verilen coin'),
  ('coin_mac_beraberlik', '10'::jsonb,  'Berabere biten maç'),
  ('coin_mac_maglubiyet', '0'::jsonb,   'Kaybedince coin yok'),
  ('coin_baslangic',      '300'::jsonb, 'Yeni oyuncuya verilen coin'),
  ('coin_reklam',         '25'::jsonb,  'Bir ödüllü reklam'),
  ('reklam_gunluk_tavan', '5'::jsonb,   'Günde en fazla kaç reklam ödülü')
on conflict (anahtar) do nothing;

alter table public.oyun_ayarlari enable row level security;
drop policy if exists oyun_ayarlari_okuma on public.oyun_ayarlari;
create policy oyun_ayarlari_okuma on public.oyun_ayarlari
  for select to authenticated using (true);
-- Yazma politikası YOK: ayarlar yalnız migration / panel üzerinden değişir.

/** Ayarı sayı olarak okur; satır yoksa verilen varsayılana düşer. */
create or replace function public.ayar_sayi(p_anahtar text, p_varsayilan bigint default 0)
returns bigint
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select (deger #>> '{}')::bigint from public.oyun_ayarlari where anahtar = p_anahtar),
                  p_varsayilan);
$fn$;

grant execute on function public.ayar_sayi(text, bigint) to authenticated;

-- ------------------------------------------------------------
-- BAKİYE VE HAREKETLER
-- ------------------------------------------------------------
alter table public.profiles add column if not exists coin bigint not null default 0;

create table if not exists public.coin_hareketleri (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  miktar bigint not null,               -- + kazanç, - harcama
  tur text not null,                    -- 'mac','reklam','baslangic','satin_alma','esya','joker','etkinlik'
  referans text,                        -- mac_id, urun_id, esya_kodu vb.
  bakiye_sonra bigint not null,
  olusturuldu timestamptz not null default now()
);

create index if not exists coin_hareketleri_user_idx
  on public.coin_hareketleri(user_id, olusturuldu desc);

-- Aynı maç için iki kez coin verilmesini VERİTABANI engeller.
create unique index if not exists coin_hareketleri_mac_tek
  on public.coin_hareketleri(user_id, tur, referans)
  where tur = 'mac' and referans is not null;

-- Başlangıç coini de bir kez verilir.
create unique index if not exists coin_hareketleri_baslangic_tek
  on public.coin_hareketleri(user_id, tur)
  where tur = 'baslangic';

alter table public.coin_hareketleri enable row level security;
drop policy if exists coin_hareketleri_kendi on public.coin_hareketleri;
create policy coin_hareketleri_kendi on public.coin_hareketleri
  for select to authenticated using (user_id = auth.uid());
-- Yazma politikası YOK: yalnız security definer RPC yazar.

-- ------------------------------------------------------------
-- BAKİYE KORUMASI
-- RLS kolon bazlı değildir; `profiles` üzerinde kendi satırını güncelleme
-- izni olan oyuncu coin'i de yazabilirdi. Trigger bunu kapatır.
-- ------------------------------------------------------------
create or replace function public.coin_koru()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.coin is distinct from old.coin
     and coalesce(current_setting('app.coin_izin', true), '') <> '1' then
    raise exception 'coin doğrudan değiştirilemez';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_profiles_coin_koru on public.profiles;
create trigger trg_profiles_coin_koru
  before update on public.profiles
  for each row execute function public.coin_koru();

-- ------------------------------------------------------------
-- COIN EKLE — YALNIZ SUNUCU İÇİ. Dışarıya grant VERİLMEZ.
-- ------------------------------------------------------------
create or replace function public.coin_ekle(
  p_user uuid,
  p_miktar bigint,
  p_tur text,
  p_referans text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bakiye bigint;
  v_bot boolean;
begin
  if p_user is null or coalesce(p_miktar, 0) <= 0 then return null; end if;

  -- Botlara coin yazılmaz (lig/ekonomi şişmesin)
  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return null; end if;

  perform set_config('app.coin_izin', '1', true);   -- işlem-yerel
  update public.profiles
     set coin = coin + p_miktar
   where id = p_user
  returning coin into v_bakiye;
  if v_bakiye is null then return null; end if;

  begin
    insert into public.coin_hareketleri (user_id, miktar, tur, referans, bakiye_sonra)
    values (p_user, p_miktar, p_tur, p_referans, v_bakiye);
  exception when unique_violation then
    -- Bu ödül daha önce verilmiş (maç/başlangıç tekilliği): bakiyeyi geri al.
    update public.profiles set coin = coin - p_miktar where id = p_user
    returning coin into v_bakiye;
    return v_bakiye;
  end;

  return v_bakiye;
end;
$fn$;

revoke all on function public.coin_ekle(uuid, bigint, text, text) from public;
revoke all on function public.coin_ekle(uuid, bigint, text, text) from authenticated;
revoke all on function public.coin_ekle(uuid, bigint, text, text) from anon;

-- ------------------------------------------------------------
-- COIN HARCA — oyuncunun kendi bakiyesinden düşer
-- ------------------------------------------------------------
create or replace function public.coin_harca(
  p_miktar bigint,
  p_tur text,
  p_referans text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_bakiye bigint;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if coalesce(p_miktar, 0) <= 0 then raise exception 'Geçersiz tutar'; end if;

  -- Yarış durumu: iki sekmeden aynı anda harcama denemesi
  select coin into v_bakiye from public.profiles where id = v_me for update;
  if v_bakiye is null then raise exception 'Profil bulunamadı'; end if;
  if v_bakiye < p_miktar then raise exception 'Yetersiz coin'; end if;

  perform set_config('app.coin_izin', '1', true);
  update public.profiles set coin = coin - p_miktar where id = v_me
  returning coin into v_bakiye;

  insert into public.coin_hareketleri (user_id, miktar, tur, referans, bakiye_sonra)
  values (v_me, -p_miktar, p_tur, p_referans, v_bakiye);

  return v_bakiye;
end;
$fn$;

grant execute on function public.coin_harca(bigint, text, text) to authenticated;

-- ------------------------------------------------------------
-- BAKİYE + SON HAREKETLER
-- ------------------------------------------------------------
create or replace function public.coin_bakiyem()
returns table(bakiye bigint, hareketler jsonb)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return query
    select
      coalesce((select p.coin from public.profiles p where p.id = v_me), 0),
      coalesce((
        select jsonb_agg(x order by x->>'olusturuldu' desc)
        from (
          select jsonb_build_object(
                   'miktar', h.miktar, 'tur', h.tur, 'referans', h.referans,
                   'bakiye_sonra', h.bakiye_sonra, 'olusturuldu', h.olusturuldu
                 ) as x
          from public.coin_hareketleri h
          where h.user_id = v_me
          order by h.olusturuldu desc
          limit 20
        ) t
      ), '[]'::jsonb);
end;
$fn$;

grant execute on function public.coin_bakiyem() to authenticated;

-- ------------------------------------------------------------
-- MAÇ ÖDÜLÜ — tek yerden, sunucu tarafında
-- İstemci "ben kazandım" diyemez; maçı bitiren fonksiyon çağırır.
-- ------------------------------------------------------------
create or replace function public.coin_mac_odulu(
  p_referans text,
  p_kazanan uuid,
  p_oyuncular uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_galibiyet bigint := public.ayar_sayi('coin_mac_galibiyet', 20);
  v_beraberlik bigint := public.ayar_sayi('coin_mac_beraberlik', 10);
  v_oyuncu uuid;
begin
  if p_referans is null then return; end if;

  if p_kazanan is not null then
    -- Kaybedene coin YOK.
    perform public.coin_ekle(p_kazanan, v_galibiyet, 'mac', p_referans);
  else
    -- Berabere: herkese yarısı (ayar tablosundan)
    foreach v_oyuncu in array coalesce(p_oyuncular, '{}'::uuid[]) loop
      perform public.coin_ekle(v_oyuncu, v_beraberlik, 'mac', p_referans);
    end loop;
  end if;
end;
$fn$;

revoke all on function public.coin_mac_odulu(text, uuid, uuid[]) from public;
revoke all on function public.coin_mac_odulu(text, uuid, uuid[]) from authenticated;
revoke all on function public.coin_mac_odulu(text, uuid, uuid[]) from anon;

-- ------------------------------------------------------------
-- YENİ OYUNCUYA BAŞLANGIÇ COİNİ
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, username, avatar_url, provider, davet_kodu)
  values (
    new.id,
    'oyuncu_' || substr(md5(new.id::text || random()::text), 1, 8),
    null,                                    -- Google fotoğrafı ALINMAZ
    new.raw_app_meta_data->>'provider',
    public.yeni_davet_kodu()
  );

  -- Başlangıç coini. Tekillik indeksi ikinci kez verilmesini zaten engeller;
  -- burada hata yutulur ki profil oluşturma asla düşmesin.
  begin
    perform public.coin_ekle(new.id, public.ayar_sayi('coin_baslangic', 300), 'baslangic', null);
  exception when others then
    null;
  end;

  return new;
end;
$fn$;

-- Mevcut oyunculara da başlangıç coini (tek seferlik, tekillik indeksi korur)
do $$
declare r record;
begin
  for r in select id from public.profiles where not coalesce(is_bot, false) loop
    begin
      perform public.coin_ekle(r.id, public.ayar_sayi('coin_baslangic', 300), 'baslangic', null);
    exception when others then null;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- REKLAM ÖDÜLÜ — artık joker değil COİN veriyor
-- (eski sürüm silinmiyor, aynı imza yeni gövdeyle değiştiriliyor)
-- ------------------------------------------------------------
create or replace function public.reklam_odulu_al(p_reklam_ref text)
returns table(verilen integer, bugun integer, tavan integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_tavan int := public.ayar_sayi('reklam_gunluk_tavan', 5)::int;
  v_odul bigint := public.ayar_sayi('coin_reklam', 25);
  v_gun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sayac int;
  v_ref text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  v_ref := nullif(btrim(coalesce(p_reklam_ref, '')), '');
  if v_ref is null then raise exception 'Geçersiz reklam referansı'; end if;

  -- Aynı reklam referansı iki kez ödüllendirilemez
  if exists (
    select 1 from public.coin_hareketleri
    where user_id = v_me and tur = 'reklam' and referans = v_ref
  ) then
    raise exception 'Bu reklam ödülü zaten alındı';
  end if;

  insert into public.reklam_odulleri (user_id, gun, sayac)
  values (v_me, v_gun, 0)
  on conflict (user_id, gun) do nothing;

  select r.sayac into v_sayac
  from public.reklam_odulleri r
  where r.user_id = v_me and r.gun = v_gun
  for update;

  if v_sayac >= v_tavan then
    raise exception 'Bugünkü reklam ödülü hakkın doldu (%/%)', v_sayac, v_tavan;
  end if;

  update public.reklam_odulleri
     set sayac = sayac + 1
   where user_id = v_me and gun = v_gun
  returning sayac into v_sayac;

  perform public.coin_ekle(v_me, v_odul, 'reklam', v_ref);

  return query select v_odul::int, v_sayac, v_tavan;
end;
$fn$;

-- ------------------------------------------------------------
-- JOKER PAKETLERİ ARTIK COİN İLE
-- ------------------------------------------------------------
alter table public.joker_paketleri add column if not exists coin_fiyat bigint;

update public.joker_paketleri set coin_fiyat = 250  where urun_id = 'joker_10'  and coin_fiyat is null;
update public.joker_paketleri set coin_fiyat = 650  where urun_id = 'joker_30'  and coin_fiyat is null;
update public.joker_paketleri set coin_fiyat = 1900 where urun_id = 'joker_100' and coin_fiyat is null;
update public.joker_paketleri set coin_fiyat = 400  where urun_id = 'seri_koruma_3' and coin_fiyat is null;
-- Fiyatı verilmemiş paketler dükkânda coin ile satılmaz (coin_fiyat null).

create or replace function public.joker_coin_ile_al(p_urun_id text)
returns table(bakiye bigint, icerik jsonb)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_paket public.joker_paketleri%rowtype;
  v_bakiye bigint;
  v_tip text;
  v_adet int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('joker_coin_ile_al', 20, interval '60 seconds');

  select * into v_paket from public.joker_paketleri where urun_id = p_urun_id and aktif;
  if not found then raise exception 'Paket bulunamadı'; end if;
  if v_paket.coin_fiyat is null then raise exception 'Bu paket coin ile satılmıyor'; end if;

  v_bakiye := public.coin_harca(v_paket.coin_fiyat, 'joker', p_urun_id);

  -- Paket içeriğindeki her joker türünü ekle
  for v_tip, v_adet in select key, (value #>> '{}')::int from jsonb_each(v_paket.icerik) loop
    -- kaynak 'satin_alma' olmali: joker_islemleri_kaynak_check yalniz
    -- ucretsiz/reklam/satin_alma/kullanim/seri/hediye kabul ediyor.
    perform public.joker_hareket(v_me, v_tip, v_adet, 'satin_alma', p_urun_id);
  end loop;

  return query select v_bakiye, v_paket.icerik;
end;
$fn$;

grant execute on function public.joker_coin_ile_al(text) to authenticated;

-- ------------------------------------------------------------
-- GERÇEK PARA → COİN (Play Billing)
-- Fiyatlar KODDA YOK, Play Console'da. Burada yalnız ürün → coin eşlemesi.
-- ------------------------------------------------------------
create table if not exists public.coin_paketleri (
  urun_id text primary key,      -- Play Console ürün kimliği
  ad text not null,
  coin bigint not null,
  bonus bigint not null default 0,
  sira int not null default 0,
  aktif boolean not null default true
);

insert into public.coin_paketleri (urun_id, ad, coin, bonus, sira) values
  ('coin_500',   'Küçük Kese',  500,     0, 1),
  ('coin_1200',  'Orta Kese',   1200,  100, 2),
  ('coin_3000',  'Büyük Kese',  3000,  400, 3),
  ('coin_8000',  'Hazine',      8000, 1500, 4)
on conflict (urun_id) do nothing;

alter table public.coin_paketleri enable row level security;
drop policy if exists coin_paketleri_okuma on public.coin_paketleri;
create policy coin_paketleri_okuma on public.coin_paketleri
  for select to authenticated using (aktif);

/**
 * Coin paketi satın alımını işler. Edge Function (satin_alma_dogrula) Google
 * ile doğruladıktan SONRA service_role ile çağırır; mevcut satin_alma_isle
 * fonksiyonuna dokunulmadı (joker paketleri hâlâ o yoldan işlenebilir).
 */
create or replace function public.coin_satin_alma_isle(
  p_user uuid,
  p_urun_id text,
  p_token text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_paket public.coin_paketleri%rowtype;
  v_toplam bigint;
begin
  select * into v_paket from public.coin_paketleri where urun_id = p_urun_id and aktif;
  if not found then raise exception 'Coin paketi bulunamadı: %', p_urun_id; end if;

  -- Aynı satın alma belirteci iki kez işlenemez
  if exists (
    select 1 from public.coin_hareketleri
    where user_id = p_user and tur = 'satin_alma' and referans = p_token
  ) then
    raise exception 'Bu satın alma zaten işlendi';
  end if;

  v_toplam := v_paket.coin + v_paket.bonus;
  return public.coin_ekle(p_user, v_toplam, 'satin_alma', p_token);
end;
$fn$;

revoke all on function public.coin_satin_alma_isle(uuid, text, text) from public;
revoke all on function public.coin_satin_alma_isle(uuid, text, text) from authenticated;
revoke all on function public.coin_satin_alma_isle(uuid, text, text) from anon;
grant execute on function public.coin_satin_alma_isle(uuid, text, text) to service_role;

-- ============================================================
-- MAÇ BİTİŞLERİNE COİN ÖDÜLÜ BAĞLANIYOR
-- (canlı tanımdan üretildi; yalnız coin_mac_odulu çağrısı eklendi)
-- ============================================================

-- 1v1
create or replace FUNCTION public.mac_sonuclandir(p_match_id uuid, p_kazanan uuid, p_kaybeden uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now()
   where id = p_match_id;

  -- COİN: kazanana verilir, kaybedene YOK, berabere ikisine yarısı.
  -- Dereceli/normal ayrımından bağımsız — coin oynayarak kazanılır.
  -- Aynı maç için ikinci kez verilmesini coin_hareketleri tekilliği engeller.
  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2]);

  -- NORMAL MAÇ: rozet verilir ama PUAN ve SERİ yazılmaz.
  if not coalesce(m.dereceli, true) then
    if p_kazanan is not null then
      perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    end if;
    return;
  end if;

  if p_kazanan is not null then
    update public.profiles
       set puan = puan + 20, puan_hafta = puan_hafta + 20
     where id = p_kazanan;

    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    if (select count(*) from public.matches where kazanan = p_kazanan and durum = 'bitti') >= 10 then
      perform public.award_badge(p_kazanan, 'mac_10');
    end if;
    if p_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
      perform public.award_badge(p_kazanan, 'bot_avcisi');
    end if;
    if (select count(*) from public.match_answers
        where match_id = p_match_id and user_id = p_kazanan and dogru)
       >= coalesce(array_length(m.soru_ids, 1), 0) then
      perform public.award_badge(p_kazanan, 'tam_isabet');
    end if;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = v_oyuncu and not is_bot;
    if found and v_tarih is distinct from v_bugun then
      v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
      v_bonus := least(v_yeni_seri * 5, 50);
      update public.profiles
         set seri = v_yeni_seri,
             son_seri_tarihi = v_bugun,
             puan = puan + v_bonus,
             puan_hafta = puan_hafta + v_bonus
       where id = v_oyuncu;
      if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
      if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
    end if;
  end loop;
end;
$function$
;

-- Grup maçı
create or replace FUNCTION public.advance_group_match(p_group_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found or gm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. grup_mac_nabiz)
  if not coalesce(gm.basladi, true) then return; end if;
  if gm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.group_match_players
  where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.group_match_answers
  where group_match_id = p_group_match_id and soru_index = gm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < gm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if gm.aktif_soru + 1 >= coalesce(array_length(gm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 then
      select user_id into v_kazanan
      from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- birden fazla kişi en yüksek skorda: berabere
    end if;

    update public.group_matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_group_match_id;

    -- COİN ödülü (bkz. coin_mac_odulu): kazanana tam, berabere herkese yarım.
    perform public.coin_mac_odulu(
      p_group_match_id::text, v_kazanan,
      (select coalesce(array_agg(user_id), '{}'::uuid[])
         from public.group_match_players
        where group_match_id = p_group_match_id
          and davet_durumu = 'kabul' and terk_at is null));

    if v_kazanan is not null then
      v_odul := 10 * gm.oyuncu_sayisi; -- 3 kişi: +30, 4 kişi: +40
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.group_match_answers
          where group_match_id = p_group_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(gm.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.group_matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$function$
;

-- Hızlı maç
create or replace FUNCTION public.advance_hizli_mac(p_hizli_mac_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hm public.hizli_maclar%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found or hm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. hizli_mac_nabiz)
  if not coalesce(hm.basladi, true) then return; end if;
  if hm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.hizli_cevaplar
  where hizli_mac_id = p_hizli_mac_id and soru_index = hm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < hm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if hm.aktif_soru + 1 >= coalesce(array_length(hm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 and v_en_yuksek > 0 then
      select user_id into v_kazanan
      from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- berabere veya kimse puan almadı
    end if;

    update public.hizli_maclar
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_hizli_mac_id;

    -- COİN ödülü (bkz. coin_mac_odulu)
    perform public.coin_mac_odulu(
      p_hizli_mac_id::text, v_kazanan,
      (select coalesce(array_agg(user_id), '{}'::uuid[])
         from public.hizli_oyuncular
        where hizli_mac_id = p_hizli_mac_id
          and davet_durumu = 'kabul' and terk_at is null));

    if v_kazanan is not null then
      v_odul := 50; -- 5 kişilik yarış galibi
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.hizli_maclar
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$function$
;
