-- ============================================================
-- AŞIRI BASİT SORULAR PASİFE ALINDI (9 Eylül 2026)
--
-- Kullanıcı isteği: "aşırı basit soruları oyundan kaldır, tek tük olmalı".
-- Aşağıdaki 53 soru ilkokul seviyesinde ya da herkesin bildiği
-- türden: "bir çeyrek saat kaç dakikadır", "Türkiye'nin başkenti neresidir",
-- "örümceğin kaç bacağı vardır", "kırmızı ve sarı karışınca hangi renk olur"...
--
-- Hiçbiri SİLİNMEDİ; aktif = false yapıldı, gerektiğinde geri alınabilir.
-- Birkaç kolay soru bilerek havuzda bırakıldı (oyunun ısınma soruları).
--
-- Aynı bilgiyi farklı kelimelerle soran 396 KOPYA soru ayrıca
--  betiğiyle teke indirildi (aynı cevap +
-- >=3 ortak anahtar kelime kümelenmesi; en ayrıntılı soru tutuldu).
-- ============================================================

update public.questions set aktif = false where soru in (
  'Ahtapotun kaç kolu vardır?',
  'Böceklerin kaç bacağı vardır?',
  'Dünya Güneş''in etrafındaki turunu yaklaşık kaç günde tamamlar?',
  'Dünya kendi ekseni etrafında bir turunu yaklaşık kaç saatte tamamlar?',
  'En küçük asal sayı hangisidir?',
  'İnsanda kaç duyu organı vardır?',
  'Kanı vücuda pompalayan organ hangisidir?',
  'Örümceklerin kaç bacağı vardır?',
  'Örümceğin kaç bacağı vardır?',
  'Romen rakamlarında "X" kaçı ifade eder?',
  'Sesi algılayan duyu organı hangisidir?',
  'Su deniz seviyesinde kaç derecede kaynar?',
  'Su kaç derecede kaynar (deniz seviyesinde)?',
  'Suyun kaç santigrat derecede kaynadığı bilinir (deniz seviyesinde)?',
  'Suyun kaynama sıcaklığı normal şartlarda kaç derecedir?',
  'Başlangıç meridyeni kaç derecedir?',
  'Bir haritada denizler genellikle hangi renkle gösterilir?',
  'Dünya üzerindeki kıta sayısı kaçtır?',
  'Türkiye kaç coğrafi bölgeye ayrılır?',
  'Türkiye''nin kaç ili vardır?',
  '100 sayısının yarısı kaçtır?',
  'Bir buçuk saat kaç dakikadır?',
  'Bir çeyrek saat kaç dakikadır?',
  'Futbolda bir maç kaç dakikadır (normal süre)?',
  'Futbolda bir maç normal süresi kaç dakikadır?',
  'Bir futbol maçı normal süresi kaç dakikadır?',
  'Futbolda bir devre kaç dakikadır?',
  'Gökkuşağında kaç ana renk vardır?',
  'Gökyüzü genellikle hangi renkte görünür?',
  'Hangi gaz solunumda kullanılır?',
  'Kırmızı ve sarı renkleri karıştırınca hangi renk oluşur?',
  'Mavi ve sarı renkleri karıştırınca hangi renk oluşur?',
  'Pusulada kuzeyin kısaltması hangisidir?',
  'Reklamın temel amacı nedir?',
  'Şubat ayı normal yıllarda kaç gündür?',
  'Trafik ışığında kırmızı ne anlama gelir?',
  'Trafikte kırmızı ışıkta ne yapılır?',
  'Türkiye''nin başkenti neresidir?',
  'Fransa''nın başkenti neresidir?',
  'İtalya''nın başkenti neresidir?',
  'Japonya''nın başkenti neresidir?',
  'İngiltere''nin başkenti neresidir?',
  'Rusya''nın başkenti neresidir?',
  'İspanya''nın başkenti neresidir?',
  'Almanya''nın başkenti neresidir?',
  'Yunanistan''ın başkenti neresidir?',
  'ABD''nin başkenti neresidir?',
  'Hollanda''nın başkenti neresidir?',
  'Çin''in başkenti neresidir?',
  'Kar hangi mevsimde yaygın olarak yağar?',
  'Işığın aynadan geri dönmesine ne denir?',
  'Elementlere örnek hangisidir?',
  'Hangi hayvan sesini taklit edebilir?'
);
