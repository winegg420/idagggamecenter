-- ============================================================
-- PAKET 19 §A — Kozmetik ekonomisi açıldı: kozmetik_bedava_test = false
--
-- Açıkken avatar3d_satin_al bütün kozmetikleri coin düşmeden veriyordu (Paket 18 D'de fiyatlanan Atkı 400 /
-- Kanat 2.000 dahil). Ödül eşyası (Taç, Pelerin) kuralı bu anahtardan bağımsız, dokunulmadı.
-- Geri açmak (yalnız test için): update oyun_ayarlari set deger = 'true'::jsonb where anahtar = 'kozmetik_bedava_test';
-- ============================================================
insert into public.oyun_ayarlari (anahtar, deger) values ('kozmetik_bedava_test', 'false'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;
