-- ============================================================
-- MEYDAN BOTLARI: KİMSE YOKKEN SUNUCU İŞİ YOK + DAHA AZ BOT
--
-- Sahibinin isteği (14 Eyl 2026): "Kimse yokken gezinmesinler, Supabase
-- limitimiz düşmesin. Bot inandırıcı dolaşmıyor, sayılarını düşürelim:
-- bir, bazen iki tane girip dolaşsın."
--
-- ÖLÇÜLEN:
--   • Botların YÜRÜMESİ tamamen haritayı açan istemcide hesaplanır; sunucuda
--     hareket yok. Kimse yokken aktif nöbet 0'dı.
--   • AMA `bildim-meydan-bot` cron'u 5 dk'da bir, meydanda kimse yokken de
--     6 katmanı dolduruyordu (her turda satır silme/yazma), dakikalık
--     `gizli_bot_nabiz` da o botların last_seen'ine yazıyordu — boşa iş.
--
-- YENİ:
--   • Cron kaldırıldı. Nöbet YALNIZ biri haritadayken dolar: `meydan_botlari()`
--     (açık haritadan 6 sn'de bir çağrılıyor) eksik varsa tazeliyor
--     (migration 182/184). Kimse yokken tablo boşalır, nabız da yazacak
--     meydan botu bulamaz.
--   • Sayı: aynı anda en çok 2 bot; tek oyuncuda dalga 1-2; ek oyuncu +1
--     (yine en çok 2); grup girişi en çok 2 kişi, %20.
-- ============================================================

do $$
begin
  perform cron.unschedule('bildim-meydan-bot');
exception when others then
  null;   -- yoksa sorun değil
end $$;

update public.oyun_ayarlari set deger = '2'::jsonb  where anahtar = 'meydan_bot_tavan';
update public.oyun_ayarlari set deger = '2'::jsonb  where anahtar = 'meydan_bot_dalga_ust';
update public.oyun_ayarlari set deger = '1'::jsonb  where anahtar = 'meydan_bot_taban';
update public.oyun_ayarlari set deger = '1'::jsonb  where anahtar = 'meydan_bot_ek';
update public.oyun_ayarlari set deger = '2'::jsonb  where anahtar = 'meydan_bot_grup_en_cok';
update public.oyun_ayarlari set deger = '20'::jsonb where anahtar = 'meydan_bot_grup_yuzde';

-- Tavanın üstündeki katmanlarda kalmış nöbetler temizlenir.
delete from public.meydan_bot_nobeti
 where bitis < now() or katman >= public.ayar_sayi('meydan_bot_tavan', 2)::int;
