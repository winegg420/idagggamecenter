-- ============================================================
-- AÇIK BOT İSABETİ İSTEMCİYE — GİZLİ BOT HÂLÂ GİZLİ
--
-- Revizyon Paketi 9, madde 1: Meydan Okuma sayfasında 5 açık botun 5'i de
-- "Çok zor" görünüyordu. İstemci `bot_isabet` okumuyordu → botZorluk(undefined)
-- son dala düşüyordu.
--
-- Görevdeki öneri (`select`'e bot_isabet eklemek) UYGULANAMAZ: migration 155
-- `bot_isabet` sütununun okuma yetkisini authenticated'dan geri aldı; eklemek
-- PostgREST yetki hatası verir ve sayfadaki bot listesi tamamen boşalır.
-- Yetkiyi açmak da gizli botların isabetini (dolayısıyla bot olduklarını)
-- sızdırır.
--
-- Çözüm `acik_bot` sütunuyla aynı kalıp: türetilmiş, saklanan bir sütun.
-- Yalnız AÇIK botta isabeti taşır; gerçek oyuncuda ve gizli botta NULL.
-- İstemciye yalnız bu sütun açılır.
-- ============================================================

alter table public.profiles
  add column if not exists acik_bot_isabet numeric
  generated always as (
    case when coalesce(is_bot, false) and coalesce(bot_turu, 'acik') = 'acik'
         then bot_isabet::numeric end
  ) stored;

grant select (acik_bot_isabet) on public.profiles to authenticated;
