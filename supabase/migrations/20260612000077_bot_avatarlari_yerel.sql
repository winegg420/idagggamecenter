-- ============================================================
-- BOT AVATARLARI YEREL DOSYAYA TAŞINDI (9 Eylül 2026)
--
-- Sorun: beş botun avatarı `https://api.dicebear.com/...` adresinden geliyordu.
--  1) Dış bağımlılık — servis yavaşlarsa/kapanırsa oyunun her listesinde
--     avatar boşluğu oluşuyor (lig, meydan okuma, maç ekranı).
--  2) Üretilen robotlar mor tonlu; yeni gece lacivert + altın paletiyle
--     çakışıyordu.
--
-- Çözüm: `public/avatars/bot1..bot5.svg` olarak yerel, palete uygun beş avatar.
-- ============================================================

update public.profiles set avatar_url = '/avatars/bot1.svg'
 where id = 'b0b00000-0000-4000-8000-000000000001';   -- BilgeBot  (mavi)
update public.profiles set avatar_url = '/avatars/bot2.svg'
 where id = 'b0b00000-0000-4000-8000-000000000002';   -- ÇaylakBot (yeşil)
update public.profiles set avatar_url = '/avatars/bot3.svg'
 where id = 'b0b00000-0000-4000-8000-000000000003';   -- UstaBot   (altın)
update public.profiles set avatar_url = '/avatars/bot4.svg'
 where id = 'b0b00000-0000-4000-8000-000000000004';   -- AcemiBot  (turkuaz)
update public.profiles set avatar_url = '/avatars/bot5.svg'
 where id = 'b0b00000-0000-4000-8000-000000000005';   -- KurtBot   (mercan)
