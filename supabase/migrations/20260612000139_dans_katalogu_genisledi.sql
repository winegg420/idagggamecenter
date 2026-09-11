-- ============================================================
-- DANS KATALOĞU GENİŞLEDİ — 7 yeni hareket
--
-- Sahibinin isteği: "bir sürü farklı dans olacak, bunları dükkânda coin ile
-- satacağız, birkaç tane de ücretsiz olacak."
--
-- ÜCRETSİZ (coin_fiyat = 0, herkese otomatik verilir): Selam, Zıplama, Alkış.
-- Satılık: Robot, Twist, Fırıldak, Zafer Dansı, Dalga, Kazak, Kafa Salla,
--          Kayış, Pirouette.
-- Etkinlik ödülü (satılmaz): Şampiyon, Kupa Kaldır.
--
-- Zıplama daha önce 250 coin'di; ücretsiz sete alındı ki yeni oyuncunun
-- elinde tek bir hareketle kalmasın. Parasını ödeyenlerden geri ALINMAZ
-- (oyuncu_esyalari kaydı duruyor).
-- ============================================================

insert into public.esyalar (kod, yuva, ad, coin_fiyat, nadirlik, boyanabilir, varsayilan_renk, sac_kisalt, sira) values
  ('dns_08', 'dans', 'Dalga',        400,  'sirali',   false, '#4A9DD9', false, 8),
  ('dns_09', 'dans', 'Alkış',        0,    'sirali',   false, '#2FBF71', false, 9),
  ('dns_10', 'dans', 'Kazak',        750,  'ozel',     false, '#C0392B', false, 10),
  ('dns_11', 'dans', 'Kafa Salla',   350,  'sirali',   false, '#20324A', false, 11),
  ('dns_12', 'dans', 'Kayış',        800,  'ozel',     false, '#A855F7', false, 12),
  ('dns_13', 'dans', 'Pirouette',    950,  'ozel',     false, '#F4701F', false, 13),
  ('dns_14', 'dans', 'Kupa Kaldır',  null, 'etkinlik', false, '#FFC53D', false, 14)
on conflict (kod) do nothing;

-- Zıplama ücretsiz sete alınıyor (bkz. başlık).
update public.esyalar set coin_fiyat = 0 where kod = 'dns_02';

-- Ücretsiz danslar herkeste olsun.
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.ucretsiz_esyalari_ver(r.id);
  end loop;
end $$;
