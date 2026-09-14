-- ============================================================
-- GİZLİ BOT CİNSİYETİ ADIYLA UYUŞSUN
--
-- Paket 7 madde 2a doğrulamasında ölçüldü: botların `cinsiyet` alanı adlarından
-- bağımsız atanmıştı. Migration 188 görünümü cinsiyete bağlayınca bu hata
-- görünür oldu — "mert41" (k) uzun saçlı, "esra16" (e) sakallı çıkabiliyordu.
--   • cinsiyeti 'e' olan 16 açıkça kadın adı
--   • cinsiyeti 'k' olan 23 açıkça erkek adı
-- Adı iki cinsiyete de uyan / takma ad olanlara (nikita, Rasta4, Legends,
-- kovalenko, Raymalifalitikko…) dokunulmadı. Ardından 3B görünüm yeniden
-- üretilir (migration 188'deki cinsiyete duyarlı üretici).
-- `cinsiyet` istemciye açılmaz.
-- ============================================================

update public.profiles
   set cinsiyet = 'k'
 where is_bot and bot_turu = 'gizli'
   and gorunen_ad in ('aleyna35','ayla_','cansu41','cansu99','ceren99','cerenx','damla','damla99',
                      'duygu2','esra16','gizem2','iremtr','melek16','merve07','selin01','sena_');

update public.profiles
   set cinsiyet = 'e'
 where is_bot and bot_turu = 'gizli'
   and gorunen_ad in ('Acunn','alper41','baris61','Batista666','batuhan06','berk35','burak55',
                      'cagatay06','cagatay16','doruk61','furkan.','kaan55','kerem55','koray',
                      'kuzey35','leventtr','mert41','Muhammedsalah','ozan06','tolga07',
                      'umut','umut01','umut61');

select public.avatar3d_bot_gorunum_uret();
