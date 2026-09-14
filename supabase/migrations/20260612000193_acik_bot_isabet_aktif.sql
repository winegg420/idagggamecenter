-- ============================================================
-- AÇIK BOT İSABETİ: EMEKLİ BOT HARİÇ
--
-- Migration 192'den sonra ölçüldü: Meydan Okuma listesinde emekliye ayrılmış
-- "BilgeBot" (bot_aktif=false, isabet 0.45) görünüyor ve ToyBot (0.42) ile
-- aynı "Kolay" etiketine düşüyordu. Emekli botlar lig/eşleşme/turnuvada zaten
-- atlanıyor; bot listesinde de olmamalı. `bot_aktif` istemciye kapalı, bu
-- yüzden süzgeç türetilmiş sütuna gömülür: pasif botta da NULL.
-- (Türetilmiş sütunun ifadesi değiştirilemez → sütun yeniden kurulur.)
-- ============================================================

alter table public.profiles drop column if exists acik_bot_isabet;

alter table public.profiles
  add column acik_bot_isabet numeric
  generated always as (
    case when coalesce(is_bot, false) and coalesce(bot_turu, 'acik') = 'acik'
              and coalesce(bot_aktif, true)
         then bot_isabet::numeric end
  ) stored;

grant select (acik_bot_isabet) on public.profiles to authenticated;
