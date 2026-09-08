-- ============================================================
-- "HIZLI OLAN KAZANIR" HİÇ OYNANAMIYORDU — 2 YENİ BOT
--
-- Kanıt (canlı test): mod 5 kişilik, "0/4 rakip seçildi" diyor. Sistemde
-- yalnız 3 bot var (ÇaylakBot, BilgeBot, UstaBot). Üçü de seçilince "3/4"te
-- kalıyor ve "Yarışı Kur ve Davet Et" düğmesi devre dışı kalıyordu.
-- Arkadaşı olmayan bir oyuncu bu modu ASLA kuramıyordu. Aynı sorun 5 kişilik
-- grup maçında da vardı (o da 4 rakip ister).
--
-- Seçenek (b) uygulandı: iki bot daha eklendi (toplam 5).
-- GEREKÇE: (a) modu 3-5 esnek yapmak `hizli_maclar_oyuncu_sayisi_check`
-- kısıtını, ilk-doğru puanlamasını ve "5 kişi" yazan tüm arayüz metinlerini
-- değiştirmeyi gerektirirdi; (c) otomatik doldurma yeni bir arayüz akışı
-- demekti. İki satır profil eklemek mevcut kısıtlara, akışa ve metinlere
-- HİÇ dokunmadan her iki modu da açıyor; ayrıca ligdeki rakip çeşitliliğini
-- artırıyor.
--
-- Zorluk dağılımı (bot_isabet): 0.25 · 0.40 · 0.55 · 0.70 · 0.90
-- ============================================================

-- Botların auth kaydı da var (mevcut üçünde olduğu gibi)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('b0b00000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'acemibot@bildim.local', '',
   now(), now(), now(), '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b0b00000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kurtbot@bildim.local', '',
   now(), now(), now(), '{"provider":"bot"}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles
  (id, username, takma_ad, takma_ad_secildi, avatar_url, avatar_onayli,
   is_bot, bot_isabet, puan, puan_hafta, toplam_mac, ulke, sehir)
values
  ('b0b00000-0000-4000-8000-000000000004', 'AcemiBot', 'AcemiBot', true,
   'https://api.dicebear.com/9.x/bottts/svg?seed=AcemiBot', true,
   true, 0.25, 90, 0, 4, 'TR', 'Bursa'),
  ('b0b00000-0000-4000-8000-000000000005', 'KurtBot', 'KurtBot', true,
   'https://api.dicebear.com/9.x/bottts/svg?seed=KurtBot', true,
   true, 0.55, 480, 0, 9, 'TR', 'Antalya')
on conflict (id) do update
  set is_bot = true,
      bot_isabet = excluded.bot_isabet,
      takma_ad = excluded.takma_ad,
      takma_ad_secildi = true,
      avatar_url = excluded.avatar_url,
      avatar_onayli = true,
      ulke = excluded.ulke,
      sehir = excluded.sehir;
