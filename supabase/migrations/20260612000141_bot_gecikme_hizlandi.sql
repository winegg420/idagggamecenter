-- ============================================================
-- Adı bot olan botlar anında cevaplasın
--
-- Migration 074'te bot gecikmeleri zorluğa göre 2.0–7.0 sn arasına
-- ayarlanmıştı. Oyuncu zaten karşısındakinin bot olduğunu biliyor; bu
-- bekleme "gerçekçilik" katmıyor, yalnız oyunu yavaşlatıyor.
--
-- Yeni aralık herkes için 0.3 – 0.8 sn.
--
-- NOT: Bu yalnız ADI BOT OLAN açık botlar içindir (is_bot = true).
-- İleride eklenecek "gizli insansı botlar" gerçekçi sürelerde cevaplamalı;
-- onlar için ayrı bir alan (ör. profiles.insansi_bot) gerekecek.
-- `bot_gecikme_sn()` fonksiyonuna dokunulmadı — yalnız veri değişti.
-- ============================================================

alter table public.profiles
  alter column bot_gecikme_min set default 0.3,
  alter column bot_gecikme_max set default 0.8;

update public.profiles
   set bot_gecikme_min = 0.3,
       bot_gecikme_max = 0.8
 where is_bot = true;
