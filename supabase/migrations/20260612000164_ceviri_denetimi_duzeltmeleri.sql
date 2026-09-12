-- ============================================================
-- İNGİLİZCE ÇEVİRİ DENETİMİ — BULUNAN HATALARIN DÜZELTİLMESİ
--
-- 7.682 İngilizce çevirinin tamamı dört ayrı yöntemle tarandı
-- (rapor: oturum özeti). Bildirilen "Cami → Mosque" hatası CANLI
-- VERİTABANINDA YOK: o soruda şık zaten "Jami" yazıyor. Özel isimler
-- (Çehov→Chekhov, Sadi→Saadi, Hafız→Hafez, Basra Körfezi→Persian Gulf,
-- Sur→Tyre, Sancak→Sandžak) doğru yazılmış.
--
-- Tarama BAŞKA iki gerçek hata buldu. İkisi de "özel isim çevrildi"
-- değil, ÇELDİRİCİ İÇERİĞİ KAYMASI: İngilizce şık Türkçesinden başka
-- bir şey söylüyor. Doğru cevap ikisinde de yerinde, yani puanlama
-- bozulmamış; ama oyuncu iki dilde farklı soru görüyor.
--
-- Bir de tutarlılık düzeltmesi: aynı şair bir soruda "Hafiz", yedi
-- soruda "Hafez" yazılmış. Hepsi "Hafez" oldu.
-- ============================================================

begin;

-- ---------------------------------------------------------------- 1) hata
-- 'Parazit' filmi hangi ülkenin yapımıdır?
-- TR şıkları: Japonya · Güney Kore · ENDONEZYA · Tayland
-- EN şıkları: Japan   · South Korea · THE PHILIPPINES · Thailand
-- Üçüncü çeldirici başka bir ülkeye dönmüş. Doğrusu Indonesia.
update public.question_translations
   set secenekler = '["Japan", "South Korea", "Indonesia", "Thailand"]'::jsonb
 where question_id = 'a7b02cfd-6fe0-44bd-bd14-7fa3a83fe3fe'
   and dil = 'en'
   and secenekler::text like '%Philippines%';

-- ---------------------------------------------------------------- 2) hata
-- El Nino olayı neyi etkiler?
-- TR: Yalnız kutup buzullarını · Yalnız Akdeniz havzasını ·
--     Küresel iklim düzenini · Yalnız okyanus akıntılarını
-- EN: Only Turkey · Only the poles · The global climate system · Nothing
-- Dört şıktan üçü Türkçesiyle ilgisiz. Doğru cevap (2. indeks) yerinde,
-- ama çeldiriciler baştan yazılmalı.
update public.question_translations
   set secenekler = '["Only the polar ice", "Only the Mediterranean basin", "The global climate system", "Only ocean currents"]'::jsonb
 where question_id = '003e2733-e66c-4c32-96ed-f43b8373028f'
   and dil = 'en';

-- --------------------------------------------------------- 3) tutarlılık
-- Aynı İranlı şair: 1 soruda "Hafiz", 7 soruda "Hafez". Tek yazıma indi.
update public.question_translations
   set secenekler = (
     select jsonb_agg(case when x = 'Hafiz' then to_jsonb('Hafez'::text) else to_jsonb(x) end
                      order by o)
       from jsonb_array_elements_text(secenekler) with ordinality s(x, o)
   )
 where dil = 'en'
   and secenekler ? 'Hafiz';

commit;
