-- ============================================================
-- ESKİ KURALLA HARCANAN KİLİTLER SIFIRLANIYOR (9 Eylül 2026)
--
-- Migration 076 takma ad kilidini 30 günden, konum kilidini 7 günden
-- 24 saate indirdi. Ama mevcut oyuncuların sayaçları ESKİ kural altında
-- işlemişti: adını 20 gün önce değiştiren biri yeni kuralda çoktan
-- serbest olmalıyken, sayaç tutulduğu için hâlâ bekliyor gibi görünüyordu.
--
-- Bu yüzden gerçek oyuncuların sayaçları bir kez sıfırlanıyor: herkes yeni
-- 24 saatlik kuralla temiz başlıyor. Bir sonraki değişiklikte sayaç normal
-- işlemeye devam eder.
-- ============================================================

update public.profiles
   set takma_ad_degisti_at = null
 where not coalesce(is_bot, false)
   and takma_ad_degisti_at is not null;

update public.profiles
   set konum_degisti_at = null
 where not coalesce(is_bot, false)
   and konum_degisti_at is not null;
