-- ============================================================
-- YENİ KARAKTER AVATARLARI (9 Eylül 2026)
--
-- Eski hazır avatarlar (av1-av8) düz siluetti: renkli bir kare içinde
-- daire + omuz. Yerlerine 31 karakterli çizim avatar geldi
-- (`/avatars/k01..k31.svg`) — tamamı özgün SVG, dış servis yok.
--
-- Eski siluet seçmiş oyuncular yeni sette karşılığı olan karaktere taşınıyor.
-- av*.svg dosyaları silinmedi; elle o adresi taşıyan bir kayıt kalırsa
-- kırılmasın.
-- ============================================================

update public.profiles set avatar_url = '/avatars/k01.svg' where avatar_url = '/avatars/av1.svg';
update public.profiles set avatar_url = '/avatars/k08.svg' where avatar_url = '/avatars/av2.svg';
update public.profiles set avatar_url = '/avatars/k07.svg' where avatar_url = '/avatars/av3.svg';
update public.profiles set avatar_url = '/avatars/k03.svg' where avatar_url = '/avatars/av4.svg';
update public.profiles set avatar_url = '/avatars/k30.svg' where avatar_url = '/avatars/av5.svg';
update public.profiles set avatar_url = '/avatars/k11.svg' where avatar_url = '/avatars/av6.svg';
update public.profiles set avatar_url = '/avatars/k13.svg' where avatar_url = '/avatars/av7.svg';
update public.profiles set avatar_url = '/avatars/k15.svg' where avatar_url = '/avatars/av8.svg';
