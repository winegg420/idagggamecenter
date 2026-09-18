-- Paket 27 A0 — mod adı "Normal Maç" → "Klasik Mod" (EN: "Classic Mode").
--
-- YALNIZ KULLANICIYA GÖRÜNEN AD DEĞİŞİR. Veritabanı değerleri, kolon adları,
-- ayar anahtarları ve `mac_tur = '1v1'` AYNEN KALIR; rota adları (/mac/:id) da
-- değişmez — eski linkler kırılmaz.
--
-- Ölçüldü: `push_metinleri` içinde mod adı HİÇ geçmiyor (0 satır), o yüzden
-- orada değişecek bir şey yok. Mod adı yalnız iki ayar açıklamasında ve
-- çeviri sözlüğünde geçiyor; ikisi de aşağıda.

-- 1) Çeviri sözlüğü (migration 210'daki terim listesi).
--    Uygulanmış migration düzenlenmez; sözlük burada güncelleniyor.
--    'Normal Maç' girdisi SİLİNMİYOR: eskiden üretilmiş içerikte geçebilir,
--    geçerse yine "Classic Mode" diye çevrilsin.
update public.ceviri_dil_kurallari
   set sozluk = sozluk
              || jsonb_build_object('Klasik Mod', 'Classic Mode')
              || jsonb_build_object('Normal Maç', 'Classic Mode')
 where dil = 'en';

-- 2) Ayar açıklamaları (değerler değişmiyor, yalnız metin).
update public.oyun_ayarlari
   set aciklama = replace(aciklama, 'Normal Maç', 'Klasik Mod')
 where aciklama like '%Normal Maç%';
