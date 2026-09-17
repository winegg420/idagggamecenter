-- ============================================================
-- PAKET 17 §D — Eski gardırop dondurma + yeni karakter vitrini
--
-- ESKİ SİSTEM DONDURULDU, VERİSİ SİLİNMEDİ: avatar3d_parcalar, avatar3d_sahip, karakterler,
-- oyuncu_karakterleri, profiles.gorunum.avatar3d olduğu gibi durur (drop / delete YOK).
--
-- YENİ VİTRİN: meydanın karakter sistemi (bildim/harita/karakter/) — tür (insan / kaplan / robot) + o sistemde
-- MODELİ OLAN kozmetikler. Kayıt profiles.gorunum.harita = { tur, koz: { sapka, gozluk, ... } } alanına yazılır;
-- meydan (meydanAvatar.profildenGorunum) bu alanı eski avatar3d kaydından ÖNCE okur.
--
-- EKONOMİ KORUNUR: yeni kozmetikler eski parçalara eşlenir (vitrin_kozmetikleri.parcalar). Oyuncu eşlenen
-- parçalardan birine sahipse kozmetik onundur; değilse satis_parca eski avatar3d_satin_al ile satın alınır
-- (fiyat avatar3d_parcalar.coin_fiyat'tan — koda gömülmez). Ödül eşyaları (Taç, Pelerin) satılmaz: o kural
-- avatar3d_satin_al'da zaten var.
--
-- GENİŞLETME: yeni kozmetik modeli üretildiğinde bu tabloya satır (ya da 'yakinda' satırı 'aktif'e çekilir) +
-- meydanAvatar.js KOZ_ANAHTARLARI'na anahtar eklenir. İstemci kataloğu buradan çizer.
-- ============================================================

create table if not exists public.vitrin_kozmetikleri (
  kod         text primary key,               -- meydanAvatar koz anahtarı (sapka, gozluk …) ya da tür (tur_insan …)
  ad          text not null,
  grup        text not null check (grup in ('tur', 'kozmetik')),
  durum       text not null default 'aktif' check (durum in ('aktif', 'yakinda')),
  parcalar    text[] not null default '{}',   -- sahiplik: bunlardan biri oyuncudaysa kozmetik onundur (boş = herkese açık)
  satis_parca text,                           -- satın alınırken kullanılan eski parça (null = satılmaz / ücretsiz)
  cakisir     text[] not null default '{}',   -- aynı yuvayı paylaşanlar (birlikte takılamaz)
  aciklama    text,
  sira        int not null default 0
);
alter table public.vitrin_kozmetikleri enable row level security;
revoke all on public.vitrin_kozmetikleri from anon, authenticated;

insert into public.vitrin_kozmetikleri (kod, ad, grup, durum, parcalar, satis_parca, cakisir, aciklama, sira) values
  ('tur_insan',     'İnsan',          'tur',      'aktif',   '{}', null, '{}', null, 1),
  ('tur_kaplan',    'Kaplan',         'tur',      'aktif',   '{}', null, '{}', null, 2),
  ('tur_robot',     'Robot',          'tur',      'aktif',   '{}', null, '{}', null, 3),
  ('sapka',         'Şapka',          'kozmetik', 'aktif',   '{bas_kep,bas_bere}', 'bas_kep', '{tac}', null, 10),
  ('gozluk',        'Gözlük',         'kozmetik', 'aktif',   '{goz_kare,goz_okuma,goz_yuvarlak}', 'goz_kare', '{gozlukPremium}', null, 20),
  ('gozlukPremium', 'Güneş gözlüğü',  'kozmetik', 'aktif',   '{goz_gunes,goz_spor}', 'goz_gunes', '{gozluk}', null, 30),
  ('tac',           'Taç',            'kozmetik', 'aktif',   '{bas_tac}', null, '{sapka}', 'Turnuva ödülü', 40),
  ('pelerin',       'Pelerin',        'kozmetik', 'aktif',   '{sirt_pelerin}', null, '{}', 'Turnuva ödülü', 50),
  ('atki',          'Atkı',           'kozmetik', 'yakinda', '{}', null, '{}', 'Model hazır, dükkâna girmedi', 60),
  ('kanat',         'Kanat',          'kozmetik', 'yakinda', '{}', null, '{}', 'Model hazır, dükkâna girmedi', 70),
  ('sac',           'Saç',            'kozmetik', 'yakinda', '{}', null, '{}', null, 80),
  ('elbise',        'Elbise',         'kozmetik', 'yakinda', '{}', null, '{}', null, 90),
  ('alt',           'Alt',            'kozmetik', 'yakinda', '{}', null, '{}', null, 100)
on conflict (kod) do nothing;

-- ------------------------------------------------------------
-- vitrin_katalogum → { kalemler: [...], harita: gorunum.harita | null, coin, bedava_test }
-- ------------------------------------------------------------
create or replace function public.vitrin_katalogum()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return jsonb_build_object(
    'kalemler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kod', k.kod, 'ad', k.ad, 'grup', k.grup, 'durum', k.durum, 'cakisir', k.cakisir, 'aciklama', k.aciklama,
        'satis_parca', k.satis_parca,
        'fiyat', (select p.coin_fiyat from public.avatar3d_parcalar p where p.id = k.satis_parca and p.aktif),
        'odul', exists (select 1 from public.avatar3d_parcalar p where p.id = any (k.parcalar) and p.nadirlik = 'etkinlik'),
        'sahip', k.durum = 'aktif' and (cardinality(k.parcalar) = 0
                 or exists (select 1 from public.avatar3d_sahip s where s.oyuncu_id = v_me and s.parca_id = any (k.parcalar)))
      ) order by k.sira)
      from public.vitrin_kozmetikleri k
    ), '[]'::jsonb),
    'harita', (select pr.gorunum -> 'harita' from public.profiles pr where pr.id = v_me),
    'coin', coalesce((select pr.coin from public.profiles pr where pr.id = v_me), 0),
    'bedava_test', coalesce((select (o.deger)::boolean from public.oyun_ayarlari o where o.anahtar = 'kozmetik_bedava_test'), false)
  );
end;
$fn$;
revoke all on function public.vitrin_katalogum() from public, anon;
grant execute on function public.vitrin_katalogum() to authenticated;

-- ------------------------------------------------------------
-- meydan_gorunum_kaydet(tur, koz[]) — sahiplik + çakışma sunucuda doğrulanır; yalnız gorunum.harita yazılır.
-- Bilinmeyen / 'yakinda' / sahip olunmayan kod hata verir (istemciye güvenilmez). Eski avatar3d alanı korunur.
-- ------------------------------------------------------------
create or replace function public.meydan_gorunum_kaydet(p_tur text, p_koz text[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_koz jsonb := '{}'::jsonb;
  v_kod text;
  k public.vitrin_kozmetikleri%rowtype;
  v_harita jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('meydan_gorunum_kaydet', 30, interval '60 seconds');

  select * into k from public.vitrin_kozmetikleri where kod = 'tur_' || coalesce(p_tur, '') and grup = 'tur' and durum = 'aktif';
  if not found then raise exception 'Geçersiz tür'; end if;

  foreach v_kod in array coalesce(p_koz, '{}') loop
    select * into k from public.vitrin_kozmetikleri where kod = v_kod and grup = 'kozmetik';
    if not found then raise exception 'Bilinmeyen kozmetik'; end if;
    if k.durum <> 'aktif' then raise exception 'Bu kozmetik henüz açılmadı'; end if;
    if cardinality(k.parcalar) > 0 and not exists (
      select 1 from public.avatar3d_sahip s where s.oyuncu_id = v_me and s.parca_id = any (k.parcalar)
    ) then
      raise exception 'Bu kozmetik sende yok';
    end if;
    if exists (select 1 from jsonb_object_keys(v_koz) x where x = any (k.cakisir)) then
      raise exception 'Bu iki kozmetik birlikte takılamaz';
    end if;
    v_koz := v_koz || jsonb_build_object(v_kod, case when v_kod = 'pelerin' then to_jsonb('klasik'::text) else to_jsonb(true) end);
  end loop;

  v_harita := jsonb_build_object('tur', p_tur, 'koz', v_koz);
  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('harita', v_harita)
   where id = v_me;
  return v_harita;
end;
$fn$;
revoke all on function public.meydan_gorunum_kaydet(text, text[]) from public, anon;
grant execute on function public.meydan_gorunum_kaydet(text, text[]) to authenticated;
