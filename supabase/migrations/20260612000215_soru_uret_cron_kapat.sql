-- ============================================================
-- PAKET 16 §D — bildim-soru-uret cron işi kapatılır (temizlik, arıza değil)
--
-- Soru üretimi ve çeviri sahibinin kararıyla ELLE yapılıyor; ANTHROPIC_API_KEY Supabase'e eklenmeyecek.
-- İş saatte bir generate-questions'ı çağırıp 500 "ANTHROPIC_API_KEY tanımlı değil" alıyor ve net._http_response'a
-- boş hata kaydı biriktiriyordu. Edge Function (generate-questions) SİLİNMEDİ; elle tetiklenerek kullanılır.
-- Eski net._http_response kayıtları silinmedi.
--
-- Geri açmak için (anahtar eklendiği gün):
-- select cron.schedule('bildim-soru-uret', '30 * * * *', $$select net.http_post(
--     url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/generate-questions',
--     headers := jsonb_build_object('x-cron-secret', public.gizli_al('cron_secret'), 'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   )$$);
--
-- Not: canlıdaki gövde (jobid 3) bununla aynıdır; tek fark x-cron-secret değerinin düz metin yazılmış olmasıydı.
-- Anahtar yeni dosyaya kopyalanmadı; gizli_al('cron_secret') aynı değeri döndürür (17 Eyl 2026'da karşılaştırıldı: eşit).
-- ============================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'bildim-soru-uret') then
    perform cron.unschedule('bildim-soru-uret');
  end if;
end $$;
