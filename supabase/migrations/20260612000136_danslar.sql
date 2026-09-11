-- ============================================================
-- DANSLAR — meydanda oynanan kısa hareketler
--
-- Danslar EŞYA KATALOĞUNUN bir yuvasıdır (`esyalar.yuva = 'dans'`). Böylece
-- satın alma, sahiplik ve ücretsiz dağıtım için AYRI bir düzenek gerekmez;
-- `esya_satin_al`, `oyuncu_esyalari` ve `ucretsiz_esyalari_ver` olduğu gibi
-- çalışır.
--
-- ÖNEMLİ — dans GİYİLMEZ. `gorunum_dogrula` içindeki yuva listesinde 'dans'
-- YOKTUR; bu yüzden bir dans kodu hiçbir zaman `profiles.gorunum`a yazılamaz.
-- Meydan, sahip olunan dansları kataloğdan okuyup dans tepsisinde listeler.
--
-- Animasyon dosyası indirilmez: her dansın hareketi kodda
-- (bildim/harita/danslar.js). Katalogda olup kodda oynatıcısı olmayan bir
-- dans istemcide sessizce listelenmez — yani satır eklemek tek başına
-- yetmez, hareketi de yazılmalıdır.
-- ============================================================

insert into public.esyalar (kod, yuva, ad, coin_fiyat, nadirlik, boyanabilir, varsayilan_renk, sac_kisalt, sira) values
  ('dns_01', 'dans', 'Selam',      0,    'sirali',   false, '#4A9DD9', false, 1),
  ('dns_02', 'dans', 'Zıplama',    250,  'sirali',   false, '#2FBF71', false, 2),
  ('dns_03', 'dans', 'Robot',      450,  'sirali',   false, '#20324A', false, 3),
  ('dns_04', 'dans', 'Twist',      500,  'sirali',   false, '#F4701F', false, 4),
  ('dns_05', 'dans', 'Fırıldak',   650,  'ozel',     false, '#A855F7', false, 5),
  ('dns_06', 'dans', 'Zafer Dansı',900,  'ozel',     false, '#FFC53D', false, 6),
  ('dns_07', 'dans', 'Şampiyon',   null, 'etkinlik', false, '#EF4B4B', false, 7)
on conflict (kod) do nothing;

-- Ücretsiz dans (Selam) herkeste olsun: dans tepsisi ilk açılışta boş kalmasın.
-- `ucretsiz_esyalari_ver` coin_fiyat = 0 olan her şeyi verir; yeni oyuncuya
-- zaten kayıt anında çalışıyor, mevcut oyunculara burada bir kez veriliyor.
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.ucretsiz_esyalari_ver(r.id);
  end loop;
end $$;
