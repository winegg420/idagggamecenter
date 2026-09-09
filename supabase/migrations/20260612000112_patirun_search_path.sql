-- ============================================================================
-- SERTLEŞTİRME: PatiRun'ın iki security definer fonksiyonunda search_path yoktu
--
-- Denetimde bulundu: projedeki TÜM security definer fonksiyonları
-- `set search_path to 'public'` ile sabitlenmişken bu ikisi açıkta kalmıştı.
-- search_path sabitlenmezse, çağıranın arama yolu fonksiyonun içindeki
-- çözümlemeyi etkileyebilir (klasik security definer tuzağı).
--
-- Gövdeler DEĞİŞTİRİLMEDİ; ikisi de zaten şemayı açıkça yazıyor (public.*),
-- bu yüzden davranış birebir aynı kalır — yalnız arama yolu kilitlendi.
--
-- NOT (düzeltilmedi, kullanıcı kararı bekliyor): pr_apply_race_result puanı
-- istemciden doğrulamasız alıyor (p_puan). auth.uid() ile kendi satırına
-- sınırlı olduğu için başkasının puanı bozulamaz, ama oyuncu kendi puanını
-- şişirebilir ve bu puan hub'daki birlesik_siralama'ya giriyor. Meşru puan
-- aralığı bilinmeden üst sınır koymak oyunu bozabileceği için dokunulmadı.
-- PatiRun'da şu an veri yok (max puan 0), yani henüz istismar edilmemiş.
-- ============================================================================

alter function public.pr_apply_race_result(integer, boolean, date)
  set search_path to 'public';

alter function public.pr_cleanup_error_logs()
  set search_path to 'public';
