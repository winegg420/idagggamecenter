-- ============================================================
-- BOTLARA İKON AVATARI
--
-- Tek karakter sistemine geçişte ölçüldü: 85 bottan yalnız 5'inin
-- `avatar_url`'i vardı (migration ...077 ile atanmış ilk botlar). Sonradan
-- eklenen 80 bot listelerde BAŞ HARFLE görünüyordu.
--
-- Artık listelerde herkes seçilmiş avatar fotoğrafını gösteriyor
-- (src/components/Avatar.jsx), o yüzden botlara da kurulumdaki 31 hazır
-- ikondan biri verilir. Seçim DETERMİNİSTİK: bot adı aynı kaldıkça ikonu
-- da aynı kalır.
--
-- Botun MEYDANDAKİ görünümü bu değildir — orada `gorunum.avatar3d`'den
-- üretilen 3B karakteri çizilir. İkisi ayrı şeydir, ikisi de doğrudur.
--
-- Avatarı ZATEN OLAN bota dokunulmaz.
-- ============================================================

do $$
declare
  r record;
  v_ikonlar text[] := array[
    '/avatars/k01.svg','/avatars/k02.svg','/avatars/k03.svg','/avatars/k04.svg',
    '/avatars/k05.svg','/avatars/k06.svg','/avatars/k07.svg','/avatars/k08.svg',
    '/avatars/k09.svg','/avatars/k10.svg','/avatars/k11.svg','/avatars/k12.svg',
    '/avatars/k13.svg','/avatars/k14.svg','/avatars/k15.svg','/avatars/k16.svg',
    '/avatars/k17.svg','/avatars/k18.svg','/avatars/k19.svg','/avatars/k20.svg',
    '/avatars/k21.svg','/avatars/k22.svg','/avatars/k23.svg','/avatars/k24.svg',
    '/avatars/k25.svg','/avatars/k26.svg','/avatars/k27.svg','/avatars/k28.svg',
    '/avatars/k29.svg','/avatars/k30.svg','/avatars/k31.svg'];
  v_sayi int := 0;
begin
  for r in
    select id, coalesce(takma_ad, id::text) as tohum
      from public.profiles
     where coalesce(is_bot, false)
       and coalesce(avatar_url, '') = ''
  loop
    update public.profiles
       set avatar_url = v_ikonlar[1 + (floor(public.bot_rasgele('ikon:' || r.tohum) * 31))::int],
           -- Onaylı olmayan avatar listelerde gizleniyor (bkz. ...047).
           avatar_onayli = true
     where id = r.id;
    v_sayi := v_sayi + 1;
  end loop;
  raise notice 'Bota ikon avatari verildi: %', v_sayi;
end $$;
