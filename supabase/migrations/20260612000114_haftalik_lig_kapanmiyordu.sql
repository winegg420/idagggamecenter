-- ============================================================================
-- DÜZELTME: Haftalık lig 3 aydır hiç kapanmıyordu
--
-- BELİRTİ: Ana sayfa "Haftalık lig bitimine N gün" diye geri sayıyor, sıralama
-- ekranı "ilk 3 rozet kazanır" diyor — ama hafta hiç kapanmıyor. Sonuç:
--   * lig_arsiv tablosu TAMAMEN BOŞ (3 aylık veri, tek satır yok)
--   * "Haftanın Birincisi/İkincisi/Üçüncüsü" ve "Şehrin Kralı" rozetleri
--     kazanılması İMKANSIZ (16 rozetin 4'ü ölü)
--   * Hiç 'hafta_sonuc' bildirimi gönderilmemiş
--   * puan_hafta hiç sıfırlanmamış
--
-- TEŞHİS: Sorun fonksiyonda DEĞİL. haftayi_kapat() kuru çalıştırmada
-- (transaction + rollback) kusursuz çalıştı: haftayı arşivledi, 4 rozet
-- dağıttı, 3 bildirim yazdı, puan_hafta'yı sıfırladı.
-- Sorun TETİKLENMEDE: 'bildim-hafta-kapat' işi cron.job'da active=true,
-- doğru schedule ('0 21 * * 0'), doğru database/username ile duruyor ama
-- cron.job_run_details'te TEK BİR çalışma kaydı yok.
-- pg_cron'un kendisi sağlıklı: test işi ('* * * * *') kurulur kurulmaz
-- 1 dakika içinde çalıştı. Dahası, 30 Ağustos ve 6 Eylül Pazar günleri
-- TAM 21:00:00'da 'bildim-turnuva-ilerlet' çalışmış — yani o anda cron
-- ayaktaydı ve haftalık iş yine tetiklenmedi.
--
-- ÇÖZÜM: İşi yeniden kur (yeni jobid alsın, çalışan işlerle aynı yoldan) VE
-- tek bir dakikaya bağımlılığı kaldır. haftayi_kapat ZATEN fikir olarak
-- tekrar-güvenli:
--     if exists (select 1 from lig_arsiv where hafta = v_hafta) then return;
-- Yani hafta zaten kapanmışsa hiçbir şey yapmadan çıkar. Bu sayede işi
-- pencereye yayabiliyoruz: ilk çalışan işi yapar, kalanlar boşa döner.
--
-- PENCERE NEDEN DAR (Pazar 21:00–23:00 UTC + Pazartesi 00:00–03:00 UTC):
-- Fonksiyon v_hafta'yı "şimdi - 1 gün"den türetiyor ve puan_hafta'nın O ANKİ
-- değerini arşivliyor. Çok geç çalışırsa yeni haftanın puanları birikmiş olur
-- ve yanlış hafta arşivlenip sıfırlanır. Bu yüzden pencere sınırın hemen
-- ardındaki birkaç saatle sınırlı tutuldu (7 şans, ihmal edilebilir sapma).
--
-- 'bildim-hafta-bildir' ÇOĞALTILMADI: haftalik_sonuc_bildir() tekrar-güvenli
-- DEĞİL (her çalışmada yeniden push atar), mükerrer bildirim gönderirdi.
-- Yalnız yeniden kuruldu. (Şu an push abonesi 0 olduğu için pratikte sessiz.)
--
-- GEÇMİŞ HAFTALAR GERİ GETİRİLEMEZ: arşiv, puan_hafta'nın o haftanın
-- sonundaki değerini ister; o değerler artık yok. Bilerek dokunulmadı.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron yok, haftalik isler kurulmadi';
    return;
  end if;

  -- Eskileri temizle (yoksa hata vermesin)
  begin perform cron.unschedule('bildim-hafta-kapat');      exception when others then null; end;
  begin perform cron.unschedule('bildim-hafta-kapat-pzt');  exception when others then null; end;
  begin perform cron.unschedule('bildim-hafta-bildir');     exception when others then null; end;

  -- Hafta kapanışı: Pazar 21:00 UTC = Pazartesi 00:00 TSİ (TSİ yıl boyu UTC+3).
  -- 21, 22 ve 23'te üç deneme; ilki iş görür, diğerleri boşa döner.
  perform cron.schedule('bildim-hafta-kapat', '0 21,22,23 * * 0',
    'select public.haftayi_kapat()');

  -- Pazartesi ilk saatler: Pazar denemelerinin hepsi kaçarsa yakalayıcı.
  perform cron.schedule('bildim-hafta-kapat-pzt', '0 0,1,2,3 * * 1',
    'select public.haftayi_kapat()');

  -- Haftalık push: TEK sefer (fonksiyon tekrar-güvenli degil).
  perform cron.schedule('bildim-hafta-bildir', '0 6 * * 1',
    'select public.haftalik_sonuc_bildir()');
end $$;
