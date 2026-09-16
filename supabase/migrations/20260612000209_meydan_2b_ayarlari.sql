-- ============================================================
-- AŞAMA 2B — meydan karakter/kedi ayarları (yalnız oyun_ayarlari satırı; şema değişikliği yok)
--
-- meydan_uc_boyutlu_sinir: katılış sırasıyla ilk N karakter TAM (kozmetik + gölge + göz kırpma), gerisi HAFİF.
--   Ölçüm (ASAMA_2B_RAPOR.md §6, üretim derlemesi, DPR 1, 120 ısınma + 300 örnek, İstiklal ucundan en kötü açı,
--   25 oyuncu): 25 → 5,8 ms (CPU+GPU medyan) 4,0 ms kapısını aşıyor; 8 → 3,7–3,8 ms. Bu yüzden 8.
-- meydan_kedi_sayisi: sokak kedisi sayısı (6–10 aralığı), yerel ve deterministik.
-- ============================================================
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('meydan_uc_boyutlu_sinir', '8'::jsonb, 'Meydanda tam (kozmetik + gölge + göz kırpma) çizilen karakter sayısı; gerisi hafif (Aşama 2B ölçümü: 25 → 5,8 ms, 8 → 3,8 ms)'),
  ('meydan_kedi_sayisi', '8'::jsonb, 'Meydan/İstiklal sokak kedisi sayısı (6–10); yerel, ağ yok')
on conflict (anahtar) do nothing;
