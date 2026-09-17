-- ============================================================
-- 211 — Aşama 2D-A: meydan_uc_boyutlu_sinir 8 → 20
--
-- 8, masaüstü ölçümüne göre konmuştu (migration 209). Telefon ölçümü
-- (Galaxy S24 FE, /harita-deneme, 25 karakter) 2,20 ms CPU+GPU verdi;
-- aynı sahne masaüstü tümleşik GPU'da 3,70 ms. Ölçüm makinesi kötümserdi.
-- 20: ölçülen değerle oda hedefi 25 arasında pay. 25 için ikinci (orta-alt)
-- cihaz ölçümü gerekir.
--
-- GERİ ALMA (tek satır):
--   update public.oyun_ayarlari set deger = '8'::jsonb where anahtar = 'meydan_uc_boyutlu_sinir';
-- ============================================================
update public.oyun_ayarlari
   set deger = '20'::jsonb,
       aciklama = 'Meydanda tam (kozmetik + gölge + göz kırpma) çizilen karakter sayısı; gerisi hafif (2D: telefon ölçümüyle 8 → 20)'
 where anahtar = 'meydan_uc_boyutlu_sinir';
