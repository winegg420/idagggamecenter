-- ============================================================
-- GİZLİ BOT SİSTEMİ — 80 bot, iki katman
--
-- Şu ana kadar tek bir bot tipi vardı: adında "Bot" geçen, oyuncunun bot
-- olduğunu bildiği rakipler. Artık iki katman var:
--
--   'acik'  — mevcut botlar (BilgeBot, ÜstatBot…). Oyuncu bot olduğunu
--             bilir, anında cevaplar (0.3–0.8 sn), kazanılan coin yarıya
--             iner (oyun_ayarlari.coin_bot_carpani).
--   'gizli' — yeni 80 bot. Gerçek oyuncu gibi görünür: normal takma ad,
--             ülke/şehir, gerçekçi cevap süresi, TAM coin. Coin farkı
--             olsaydı oyuncu bot olduklarını coinden anlardı.
--
-- Gizli bot yalnız GERÇEK OYUNCU BULUNAMAZSA devreye girer (quick_match
-- önce kuyruğa bakar).
--
-- LİG SINIRI kesin: oyuncu yalnız kendi ligi + bir alt + bir üst lig ile
-- eşleşir. Efsane'deki oyuncuya asla Bronz botu düşmez.
--
-- AVATAR KURALI (avatar sistemi henüz yok — geldiğinde uygulanacak):
--   · Avatar bot adından DETERMİNİSTİK üretilir ve sabit kalır.
--   · Kıyafet dağılımı: %30 başlangıç kıyafeti · %50 2-3 sıradan eşya ·
--     %20 bir özel eşya + sıradanlar. Hepsi başlangıç kıyafetiyle olursa
--     sahte anlaşılır.
--   · Etkinlik eşyalarını ASLA giymezler (onlar turnuva ödülü).
--   · Seviye ile görünüm uyumlu olmalı: efsane ligindeki bot başlangıç
--     kıyafetiyle gezmemeli.
-- ============================================================

alter table public.profiles
  add column if not exists bot_turu text,
  add column if not exists bot_seviye_puan smallint,
  add column if not exists cinsiyet text,
  add column if not exists lig text not null default 'bronz';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bot_turu_check') then
    alter table public.profiles
      add constraint profiles_bot_turu_check check (bot_turu is null or bot_turu in ('acik','gizli'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cinsiyet_check') then
    alter table public.profiles
      add constraint profiles_cinsiyet_check check (cinsiyet is null or cinsiyet in ('k','e'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_lig_check') then
    alter table public.profiles
      add constraint profiles_lig_check
      check (lig in ('bronz','gumus','altin','elmas','efsane'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bot_seviye_puan_check') then
    alter table public.profiles
      add constraint profiles_bot_seviye_puan_check
      check (bot_seviye_puan is null or bot_seviye_puan between 1 and 100);
  end if;
end $$;

-- Mevcut botlar açık bot; ligleri isabetlerine göre sabitlenir.
update public.profiles
   set bot_turu = 'acik',
       lig = case
         when coalesce(bot_isabet, 0.5) >= 0.85 then 'elmas'
         when coalesce(bot_isabet, 0.5) >= 0.70 then 'altin'
         when coalesce(bot_isabet, 0.5) >= 0.55 then 'gumus'
         else 'bronz' end
 where is_bot and bot_turu is null;

create index if not exists profiles_bot_eslesme_idx
  on public.profiles (lig, bot_seviye_puan) where is_bot;

insert into public.oyun_ayarlari (anahtar, deger) values
  ('coin_bot_carpani',    '0.5'::jsonb),
  ('lig_bot_puan_yuzde',  '40'::jsonb),
  ('bot_eslesme_yakin_yuzde', '80'::jsonb),
  ('bot_seviye_toleransi', '10'::jsonb),
  ('bot_arkadaslik_omru_gun', '2'::jsonb),
  ('bot_turnuva_katilim_yuzde', '20'::jsonb),
  ('meydan_bot_sayisi', '2'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;

-- Ondalık ayar okuyucu (ayar_sayi yalnız tam sayı döndürüyor).
create or replace function public.ayar_ondalik(p_anahtar text, p_varsayilan numeric default 0)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (deger #>> '{}')::numeric from public.oyun_ayarlari
                    where anahtar = p_anahtar), p_varsayilan);
$$;

-- Lig sırası: bronz 1 … efsane 5. Eşleşme sınırı bunun ±1'i.
create or replace function public.lig_sirasi(p_lig text)
returns integer language sql immutable as $$
  select case p_lig
    when 'bronz' then 1 when 'gumus' then 2 when 'altin' then 3
    when 'elmas' then 4 when 'efsane' then 5 else 1 end;
$$;

create or replace function public.lig_adi(p_sira integer)
returns text language sql immutable as $$
  select case p_sira
    when 1 then 'bronz' when 2 then 'gumus' when 3 then 'altin'
    when 4 then 'elmas' else 'efsane' end;
$$;

-- ---- 80 GİZLİ BOT ----
-- Takma adlar ve ülkeler sahibinin listesinden birebir alındı.
-- Seviye/isabet/gecikme değerleri lig bandından TÜRETİLDİ (bkz. yorum):
--   bronz 1-25 %45-55 8-14sn · gümüş 26-45 %58-68 5-10sn ·
--   altın 46-65 %70-80 4-8sn · elmas 66-85 %80-88 3-7sn ·
--   efsane 86-100 %88-95 2-5sn.
-- Her botun kendi isabeti ve kendi süre penceresi var (ada bağlı küçük
-- sapma); hepsi aynı olsaydı sahte durur. İsabet tavanı 0.95 —
-- en güçlü bot bile ara sıra kaybetsin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('b17b0000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_mrkaya@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_hatice16@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_priya@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_elenaa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_elifsu@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ayseglm@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kaptan61@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ines@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_onurcan16@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_zeynoo@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kovalenko@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ferhat27@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_okanx@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_baranowski@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_marcopolo07@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000016', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_sofiaa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_nazlican@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_turhan@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000019', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_gizemsu@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_serena@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_tomasz@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_pastaci16@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000023', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_hasanim@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000024', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_mehmetcan34@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000025', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kingjames@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000026', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_emirhann@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000027', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_nikita@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000028', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_yukii@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000029', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_cileksi@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_sarikafa55@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000031', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_alperr23@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000032', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_bertan55@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000033', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_mariaa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000034', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_luna@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000035', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_dilaraa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000036', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_musti34@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_mateo@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ege@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_amelie@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000040', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_manifestsueda@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_esrahanim@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000042', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kwame@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000043', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_zehraabla@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000044', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_diego@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000045', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_sefikzade@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000046', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_jordan@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000047', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_berrak61@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000048', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_pinar35@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000049', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_meryemm@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000050', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ebrusu@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000051', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_danielx@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000052', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_andrei@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000053', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_hakanbaba@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000054', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kunduraci42@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000055', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_demirhanoglu@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000056', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ozlem1907@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000057', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kadircan@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000058', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_serkan06@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000059', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_baro@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000060', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_tugcemm@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_melisaa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000062', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_tolgahan55@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000063', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_balikci35@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000064', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_kaan07@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000065', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_burakkk@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000066', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_sudenur@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000067', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_nurcan42@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000068', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_cemilbey@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000069', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_oguzhn@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000070', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ismailusta@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000071', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_betulcann@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000072', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_lukas@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000073', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_ogretmenali@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000074', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_fadimee@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000075', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_taksici34@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000076', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_sevdaa@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000077', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_hulyaabla@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000078', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_yakisiklibankaci10@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000079', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_katya@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb),
  ('b17b0000-0000-4000-8000-000000000080', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gb_seherr@bildim.local', '', now(), now(), now(),
   '{"provider":"bot"}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles
  (id, username, takma_ad, takma_ad_secildi, is_bot, bot_isabet, bot_seviye,
   bot_gecikme_min, bot_gecikme_max, ulke, sehir, cinsiyet, bot_turu,
   bot_seviye_puan, lig)
values
  ('b17b0000-0000-4000-8000-000000000001', 'mrkaya', 'mrkaya', true, true, 0.461, 'kolay', 11.3, 13.8, 'TR', 'Konya', 'e', 'gizli', 1, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000002', 'hatice16', 'hatice16', true, true, 0.468, 'kolay', 11.5, 14, 'TR', 'Bursa', 'k', 'gizli', 2, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000003', 'priya', 'priya', true, true, 0.452, 'kolay', 10.9, 13.4, 'IN', null, 'k', 'gizli', 4, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000004', 'elenaa', 'elenaa', true, true, 0.459, 'kolay', 10.7, 13.2, 'GR', null, 'k', 'gizli', 5, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000005', 'elifsu', 'elifsu', true, true, 0.457, 'kolay', 10.5, 13, 'TR', 'Konya', 'k', 'gizli', 6, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000006', 'ayseglm', 'ayseglm', true, true, 0.466, 'kolay', 10.9, 13.4, 'TR', 'İzmir', 'k', 'gizli', 7, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000007', 'kaptan61', 'kaptan61', true, true, 0.476, 'kolay', 10.1, 12.6, 'TR', 'Trabzon', 'e', 'gizli', 9, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000008', 'ines', 'ines', true, true, 0.491, 'kolay', 10.5, 13, 'PT', null, 'k', 'gizli', 10, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000009', 'onurcan16', 'onurcan16', true, true, 0.495, 'kolay', 10.3, 12.8, 'TR', 'Bursa', 'e', 'gizli', 11, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000010', 'zeynoo', 'zeynoo', true, true, 0.495, 'kolay', 9.7, 12.2, 'TR', 'Denizli', 'k', 'gizli', 12, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000011', 'kovalenko', 'kovalenko', true, true, 0.513, 'kolay', 9.9, 12.4, 'UA', null, 'e', 'gizli', 14, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000012', 'ferhat27', 'ferhat27', true, true, 0.509, 'kolay', 9.6, 12.1, 'TR', 'Gaziantep', 'e', 'gizli', 15, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000013', 'okanx', 'okanx', true, true, 0.527, 'kolay', 9.5, 12, 'TR', 'Gaziantep', 'e', 'gizli', 16, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000014', 'Baranowski', 'Baranowski', true, true, 0.509, 'kolay', 9.4, 11.9, 'PL', null, 'e', 'gizli', 17, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000015', 'marcopolo07', 'marcopolo07', true, true, 0.516, 'kolay', 9.2, 11.7, 'IT', null, 'e', 'gizli', 19, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000016', 'sofiaa', 'sofiaa', true, true, 0.518, 'kolay', 8.7, 11.2, 'IT', null, 'k', 'gizli', 20, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000017', 'nazlican', 'nazlican', true, true, 0.519, 'kolay', 8.6, 11.1, 'TR', 'İzmir', 'k', 'gizli', 21, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000018', 'turhan', 'turhan', true, true, 0.547, 'kolay', 8.2, 10.7, 'TR', 'Konya', 'e', 'gizli', 22, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000019', 'gizemsu', 'gizemsu', true, true, 0.549, 'kolay', 8.4, 10.9, 'TR', 'Antalya', 'k', 'gizli', 24, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000020', 'serena', 'serena', true, true, 0.56, 'kolay', 8, 10.5, 'IT', null, 'k', 'gizli', 25, 'bronz'),
  ('b17b0000-0000-4000-8000-000000000021', 'tomasz', 'tomasz', true, true, 0.593, 'kolay', 7.5, 10, 'PL', null, 'e', 'gizli', 26, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000022', 'pastaci16', 'pastaci16', true, true, 0.59, 'kolay', 7.4, 9.9, 'TR', 'Bursa', 'e', 'gizli', 27, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000023', 'hasanim', 'hasanim', true, true, 0.599, 'kolay', 7.1, 9.6, 'TR', 'İstanbul', 'e', 'gizli', 28, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000024', 'mehmetcan34', 'mehmetcan34', true, true, 0.586, 'kolay', 7.1, 9.6, 'TR', 'İstanbul', 'e', 'gizli', 29, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000025', 'kingjames', 'kingjames', true, true, 0.593, 'kolay', 6.9, 9.4, 'US', null, 'e', 'gizli', 30, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000026', 'emirhann', 'emirhann', true, true, 0.594, 'kolay', 6.9, 9.4, 'TR', 'Denizli', 'e', 'gizli', 31, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000027', 'nikita', 'nikita', true, true, 0.62, 'kolay', 6.8, 9.3, 'RU', null, 'k', 'gizli', 32, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000028', 'yukii', 'yukii', true, true, 0.618, 'kolay', 6.6, 9.1, 'JP', null, 'k', 'gizli', 33, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000029', 'cileksi', 'cileksi', true, true, 0.628, 'kolay', 6.4, 8.9, 'TR', 'Sakarya', 'k', 'gizli', 34, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000030', 'sarikafa55', 'sarikafa55', true, true, 0.621, 'kolay', 6.1, 8.6, 'TR', 'Samsun', 'e', 'gizli', 35, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000031', 'alperr23', 'alperr23', true, true, 0.63, 'kolay', 6.1, 8.6, 'TR', 'Elazığ', 'e', 'gizli', 36, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000032', 'bertan55', 'bertan55', true, true, 0.638, 'kolay', 5.8, 8.3, 'TR', 'Samsun', 'e', 'gizli', 37, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000033', 'mariaa', 'mariaa', true, true, 0.655, 'kolay', 6, 8.5, 'ES', null, 'k', 'gizli', 38, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000034', 'Luna', 'Luna', true, true, 0.641, 'kolay', 5.6, 8.1, 'ES', null, 'k', 'gizli', 39, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000035', 'dilaraa', 'dilaraa', true, true, 0.663, 'kolay', 5.9, 8.4, 'TR', 'Gaziantep', 'k', 'gizli', 40, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000036', 'Musti34', 'Musti34', true, true, 0.66, 'kolay', 5.4, 7.9, 'TR', 'İstanbul', 'e', 'gizli', 41, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000037', 'mateo', 'mateo', true, true, 0.679, 'kolay', 5.3, 7.8, 'AR', null, 'e', 'gizli', 42, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000038', 'ege', 'ege', true, true, 0.681, 'kolay', 5.2, 7.7, 'TR', 'Trabzon', 'e', 'gizli', 43, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000039', 'amelie', 'amelie', true, true, 0.681, 'kolay', 5.3, 7.8, 'FR', null, 'k', 'gizli', 44, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000040', 'manifestsueda', 'manifestsueda', true, true, 0.688, 'kolay', 5, 7.5, 'TR', 'Konya', 'k', 'gizli', 45, 'gumus'),
  ('b17b0000-0000-4000-8000-000000000041', 'esrahanim', 'esrahanim', true, true, 0.688, 'orta', 5.5, 8, 'TR', 'Bursa', 'k', 'gizli', 46, 'altin'),
  ('b17b0000-0000-4000-8000-000000000042', 'kwame', 'kwame', true, true, 0.717, 'orta', 5.4, 7.9, 'GH', null, 'e', 'gizli', 47, 'altin'),
  ('b17b0000-0000-4000-8000-000000000043', 'zehraabla', 'zehraabla', true, true, 0.716, 'orta', 5.1, 7.6, 'TR', 'Kayseri', 'k', 'gizli', 48, 'altin'),
  ('b17b0000-0000-4000-8000-000000000044', 'diego', 'diego', true, true, 0.701, 'orta', 5.5, 8, 'MX', null, 'e', 'gizli', 49, 'altin'),
  ('b17b0000-0000-4000-8000-000000000045', 'sefikzade', 'sefikzade', true, true, 0.731, 'orta', 5, 7.5, 'TR', 'Trabzon', 'e', 'gizli', 50, 'altin'),
  ('b17b0000-0000-4000-8000-000000000046', 'jordan', 'jordan', true, true, 0.721, 'orta', 5.2, 7.7, 'US', null, 'e', 'gizli', 52, 'altin'),
  ('b17b0000-0000-4000-8000-000000000047', 'berrak61', 'berrak61', true, true, 0.728, 'orta', 4.7, 7.2, 'TR', 'Trabzon', 'k', 'gizli', 53, 'altin'),
  ('b17b0000-0000-4000-8000-000000000048', 'pinar35', 'pinar35', true, true, 0.746, 'orta', 4.9, 7.4, 'TR', 'İzmir', 'k', 'gizli', 54, 'altin'),
  ('b17b0000-0000-4000-8000-000000000049', 'meryemm', 'meryemm', true, true, 0.743, 'orta', 4.7, 7.2, 'TR', 'Adana', 'k', 'gizli', 55, 'altin'),
  ('b17b0000-0000-4000-8000-000000000050', 'ebrusu', 'ebrusu', true, true, 0.756, 'orta', 4.7, 7.2, 'TR', 'Gaziantep', 'k', 'gizli', 56, 'altin'),
  ('b17b0000-0000-4000-8000-000000000051', 'danielx', 'danielx', true, true, 0.77, 'orta', 4.6, 7.1, 'GB', null, 'e', 'gizli', 57, 'altin'),
  ('b17b0000-0000-4000-8000-000000000052', 'andrei', 'andrei', true, true, 0.775, 'orta', 4.4, 6.9, 'RO', null, 'e', 'gizli', 58, 'altin'),
  ('b17b0000-0000-4000-8000-000000000053', 'hakanbaba', 'hakanbaba', true, true, 0.767, 'orta', 4.7, 7.2, 'TR', 'Adana', 'e', 'gizli', 59, 'altin'),
  ('b17b0000-0000-4000-8000-000000000054', 'kunduraci42', 'kunduraci42', true, true, 0.779, 'orta', 4.3, 6.8, 'TR', 'Konya', 'e', 'gizli', 61, 'altin'),
  ('b17b0000-0000-4000-8000-000000000055', 'demirhanoglu', 'demirhanoglu', true, true, 0.79, 'orta', 4.1, 6.6, 'TR', 'Adana', 'e', 'gizli', 62, 'altin'),
  ('b17b0000-0000-4000-8000-000000000056', 'ozlem1907', 'ozlem1907', true, true, 0.804, 'orta', 4.2, 6.7, 'TR', 'Antalya', 'k', 'gizli', 63, 'altin'),
  ('b17b0000-0000-4000-8000-000000000057', 'kadircan', 'kadircan', true, true, 0.785, 'orta', 4.1, 6.6, 'TR', 'Antalya', 'e', 'gizli', 64, 'altin'),
  ('b17b0000-0000-4000-8000-000000000058', 'serkan06', 'serkan06', true, true, 0.802, 'orta', 4, 6.5, 'TR', 'Ankara', 'e', 'gizli', 65, 'altin'),
  ('b17b0000-0000-4000-8000-000000000059', 'baro', 'baro', true, true, 0.785, 'zor', 4.5, 7, 'TR', 'Samsun', 'e', 'gizli', 66, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000060', 'tugcemm', 'tugcemm', true, true, 0.81, 'zor', 4.2, 6.7, 'TR', 'Bursa', 'k', 'gizli', 67, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000061', 'melisaa', 'melisaa', true, true, 0.826, 'zor', 4.3, 6.8, 'TR', 'Eskişehir', 'k', 'gizli', 69, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000062', 'tolgahan55', 'tolgahan55', true, true, 0.811, 'zor', 4.1, 6.6, 'TR', 'Samsun', 'e', 'gizli', 70, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000063', 'balikci35', 'balikci35', true, true, 0.816, 'zor', 4.1, 6.6, 'TR', 'İzmir', 'e', 'gizli', 72, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000064', 'kaan07', 'kaan07', true, true, 0.835, 'zor', 4, 6.5, 'TR', 'Antalya', 'e', 'gizli', 73, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000065', 'burakkk', 'burakkk', true, true, 0.823, 'zor', 3.8, 6.3, 'TR', 'Ankara', 'e', 'gizli', 75, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000066', 'sudenur', 'sudenur', true, true, 0.841, 'zor', 3.7, 6.2, 'TR', 'Adana', 'k', 'gizli', 76, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000067', 'nurcan42', 'nurcan42', true, true, 0.852, 'zor', 3.8, 6.3, 'TR', 'Konya', 'k', 'gizli', 78, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000068', 'cemilbey', 'cemilbey', true, true, 0.869, 'zor', 3.7, 6.2, 'TR', 'Sakarya', 'e', 'gizli', 79, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000069', 'oguzhn', 'oguzhn', true, true, 0.862, 'zor', 3.1, 5.6, 'TR', 'Eskişehir', 'e', 'gizli', 81, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000070', 'ismailusta', 'ismailusta', true, true, 0.88, 'zor', 3.3, 5.8, 'TR', 'Trabzon', 'e', 'gizli', 82, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000071', 'betulcann', 'betulcann', true, true, 0.888, 'zor', 3.2, 5.7, 'TR', 'Ankara', 'k', 'gizli', 84, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000072', 'lukas', 'lukas', true, true, 0.878, 'zor', 3.3, 5.8, 'DE', null, 'e', 'gizli', 85, 'elmas'),
  ('b17b0000-0000-4000-8000-000000000073', 'ogretmenali', 'ogretmenali', true, true, 0.869, 'zor', 2.5, 5, 'TR', 'Kayseri', 'e', 'gizli', 86, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000074', 'fadimee', 'fadimee', true, true, 0.891, 'zor', 2.5, 5, 'TR', 'Denizli', 'k', 'gizli', 88, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000075', 'taksici34', 'taksici34', true, true, 0.914, 'zor', 2.4, 4.9, 'TR', 'İstanbul', 'e', 'gizli', 90, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000076', 'sevdaa', 'sevdaa', true, true, 0.924, 'zor', 2.4, 4.9, 'TR', 'Eskişehir', 'k', 'gizli', 92, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000077', 'hulyaabla', 'hulyaabla', true, true, 0.92, 'zor', 2.4, 4.9, 'TR', 'Sakarya', 'k', 'gizli', 94, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000078', 'yakisiklibankaci10', 'yakisiklibankaci10', true, true, 0.927, 'zor', 2.4, 4.9, 'TR', 'Balıkesir', 'e', 'gizli', 96, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000079', 'katya', 'katya', true, true, 0.95, 'zor', 2.3, 4.8, 'RU', null, 'k', 'gizli', 98, 'efsane'),
  ('b17b0000-0000-4000-8000-000000000080', 'seherr', 'seherr', true, true, 0.95, 'zor', 2.1, 4.6, 'TR', 'Sakarya', 'k', 'gizli', 100, 'efsane')
on conflict (id) do update set
  takma_ad = excluded.takma_ad,
  takma_ad_secildi = true,
  is_bot = true,
  bot_isabet = excluded.bot_isabet,
  bot_seviye = excluded.bot_seviye,
  bot_gecikme_min = excluded.bot_gecikme_min,
  bot_gecikme_max = excluded.bot_gecikme_max,
  ulke = excluded.ulke,
  sehir = excluded.sehir,
  cinsiyet = excluded.cinsiyet,
  bot_turu = excluded.bot_turu,
  bot_seviye_puan = excluded.bot_seviye_puan,
  lig = excluded.lig;

-- Botların hesap açılış coini geri alınır (bot ekonomisi şişmesin).
-- handle_new_user tetikleyicisi profil oluştururken coin veriyor; profil
-- o an henüz bot işaretli olmadığı için coin_ekle'nin bot kontrolü
-- devreye girmiyor.
do $bc$
begin
  perform set_config('app.coin_izin', '1', true);
  update public.profiles set coin = 0 where is_bot and coin <> 0;
  delete from public.coin_hareketleri h
   using public.profiles p
   where p.id = h.user_id and p.is_bot;
end
$bc$;

-- ---- Oyuncunun 1–100 seviye karşılığı ----
-- Botlarda bu doğrudan bot_seviye_puan. Gerçek oyuncuda liginin bandı +
-- lig içindeki haftalık puanı kadar ilerleme. Eşleştirme bunu kullanır.
create or replace function public.oyuncu_seviye_puani(p_user uuid)
returns integer language plpgsql stable security definer set search_path to 'public' as $osp$
declare
  p public.profiles%rowtype;
  v_alt int; v_ust int;
begin
  select * into p from public.profiles where id = p_user;
  if not found then return 1; end if;
  if p.bot_seviye_puan is not null then return p.bot_seviye_puan; end if;

  case coalesce(p.lig, 'bronz')
    when 'bronz'  then v_alt := 1;  v_ust := 25;
    when 'gumus'  then v_alt := 26; v_ust := 45;
    when 'altin'  then v_alt := 46; v_ust := 65;
    when 'elmas'  then v_alt := 66; v_ust := 85;
    else               v_alt := 86; v_ust := 100;
  end case;

  -- Lig içindeki yeri: her 40 haftalık puan bir kademe.
  return least(v_ust, v_alt + floor(coalesce(p.puan_hafta, 0) / 40.0)::int);
end;
$osp$;

-- ---- Rakip bot seçimi ----
-- %80 ihtimalle oyuncunun seviyesinin ±10 aralığından, %20 ihtimalle
-- rastgele — ama HER İKİ DURUMDA DA lig sınırı içinde (kendi lig ±1).
-- Önce gizli botlar denenir; hiç yoksa açık botlara düşülür.
create or replace function public.bot_sec(p_user uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $bs$
declare
  v_lig int;
  v_sev int;
  v_tol int := public.ayar_sayi('bot_seviye_toleransi', 10)::int;
  v_yakin numeric := public.ayar_sayi('bot_eslesme_yakin_yuzde', 80)::numeric / 100;
  v_bot uuid;
begin
  select public.lig_sirasi(coalesce(lig, 'bronz')) into v_lig
    from public.profiles where id = p_user;
  v_lig := coalesce(v_lig, 1);
  v_sev := public.oyuncu_seviye_puani(p_user);

  if random() < v_yakin then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
       and abs(coalesce(p.bot_seviye_puan, 1) - v_sev) <= v_tol
     order by random() limit 1;
  end if;

  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
     order by random() limit 1;
  end if;

  -- Gizli bot yoksa açık bota düş (lig sınırı yine geçerli).
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true)
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
     order by random() limit 1;
  end if;

  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true)
     order by random() limit 1;
  end if;

  return v_bot;
end;
$bs$;

-- ---- quick_match: bot seçimi lig sınırlı ----
create or replace function public.quick_match(p_kategori text default null, p_dereceli boolean default true)
 returns uuid language plpgsql security definer set search_path to 'public'
as $qm$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
  v_kat text;
  v_puan int;
begin
  perform public.hiz_siniri('quick_match', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );
  select coalesce(pr.puan, 0) into v_puan from public.profiles pr where pr.id = auth.uid();

  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- ÖNCE GERÇEK OYUNCU: bot yalnız kuyruk boşsa devreye girer.
  select q.user_id into v_rakip
  from public.matchmaking_queue q
  join public.profiles pr on pr.id = q.user_id
  where q.user_id <> auth.uid()
    and (not p_dereceli or coalesce(q.dereceli, true) = p_dereceli)
    and (
      not p_dereceli
      or public.seviye_basamagi(pr.puan) <= public.seviye_basamagi(v_puan)
    )
  order by abs(public.seviye_basamagi(pr.puan) - public.seviye_basamagi(v_puan)), q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches
      (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now(), p_dereceli
    )
    returning id into v_id;
    return v_id;
  end if;

  delete from public.matchmaking_queue where user_id = auth.uid();

  -- Bot: lig sınırı içinde, %80 seviye yakınlığıyla (bkz. bot_sec).
  -- Dereceli olmayan maçta da lig sınırı geçerli — Efsane oyuncusuna
  -- Bronz botu düşmesin.
  v_bot := public.bot_sec(auth.uid());

  insert into public.matches
    (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now(), p_dereceli
  )
  returning id into v_id;
  return v_id;
end;
$qm$;

-- ---- Maç sonucu: bot katmanına göre coin ve lig puanı ----
-- · Açık bota karşı kazanılan coin yarıya iner (coin_bot_carpani).
--   Gizli bot TAM coin verir — coin farkı olsaydı oyuncu bot olduğunu
--   coinden anlardı.
-- · Botun kazandığı lig puanı düşük kalır (lig_bot_puan_yuzde): gerçek
--   oyuncular botları geçebilsin.
-- · Çift bazlı ödül limiti (migration 145) bot maçlarına UYGULANMAZ:
--   o kural iki hesabın birbirine galibiyet servis etmesine karşı. Bota
--   karşı üst üste oynamak normal oyun; onu günlük coin tavanı sınırlar.
create or replace function public.mac_sonuclandir(p_match_id uuid, p_kazanan uuid, p_kaybeden uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $ms$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_carpan numeric := 1;
  v_coin_carpan numeric := 1;
  v_lig int;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_kazanan_bot boolean := false;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (m.oyuncu1, m.oyuncu2);

  if coalesce(v_bot_var, false) then
    v_carpan := 1;                       -- bot maçında çift limiti yok
  else
    v_carpan := public.cift_odul_carpani(m.oyuncu1, m.oyuncu2, p_match_id);
  end if;

  v_coin_carpan := v_carpan;
  if coalesce(v_acik_bot, false) then
    v_coin_carpan := v_coin_carpan * public.ayar_ondalik('coin_bot_carpani', 0.5);
  end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(),
         odul_carpan = v_carpan,
         dostluk = (v_carpan = 0)
   where id = p_match_id;

  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2], v_coin_carpan);

  if not coalesce(m.dereceli, true) then
    if p_kazanan is not null then
      perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    end if;
    return;
  end if;

  if p_kazanan is not null then
    select coalesce(is_bot, false) into v_kazanan_bot from public.profiles where id = p_kazanan;
    v_lig := floor(20 * v_carpan *
      (case when v_kazanan_bot
            then public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100
            else 1 end))::int;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = p_kazanan;
    end if;

    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    if (select count(*) from public.matches where kazanan = p_kazanan and durum = 'bitti') >= 10 then
      perform public.award_badge(p_kazanan, 'mac_10');
    end if;
    if p_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
      perform public.award_badge(p_kazanan, 'bot_avcisi');
    end if;
    if (select count(*) from public.match_answers
        where match_id = p_match_id and user_id = p_kazanan and dogru)
       >= coalesce(array_length(m.soru_ids, 1), 0) then
      perform public.award_badge(p_kazanan, 'tam_isabet');
    end if;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = v_oyuncu and not is_bot;
    if found and v_tarih is distinct from v_bugun then
      v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
      v_bonus := least(v_yeni_seri * 5, 50);
      update public.profiles
         set seri = v_yeni_seri,
             son_seri_tarihi = v_bugun,
             puan = puan + v_bonus,
             puan_hafta = puan_hafta + v_bonus
       where id = v_oyuncu;
      if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
      if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
    end if;
  end loop;
end;
$ms$;

-- ---- Botlar arkadaşlık isteği KABUL ETMEZ ----
-- Oyuncu istek gönderebilir (düğme pasif değil, kafa karıştırmasın);
-- istek 1–2 gün sonra sessizce silinir, bot kabul etmemiş gibi görünür.
-- Süre bot+istek çiftine bağlı olduğundan hepsi aynı anda kaybolmaz.
create or replace function public.bot_arkadaslik_temizle()
returns integer language plpgsql security definer set search_path to 'public' as $bat$
declare v_n int;
begin
  delete from public.friendships f
   using public.profiles p
   where p.id = f.addressee
     and coalesce(p.is_bot, false)
     and f.durum = 'bekliyor'
     and f.created_at < now() - (
       (1 + public.bot_rasgele(f.id::text) *
            greatest(0, public.ayar_sayi('bot_arkadaslik_omru_gun', 2) - 1))
       * interval '1 day');
  get diagnostics v_n = row_count;
  return v_n;
end;
$bat$;

revoke all on function public.bot_arkadaslik_temizle() from public, authenticated, anon;

select cron.unschedule('bildim-bot-arkadaslik')
  where exists (select 1 from cron.job where jobname = 'bildim-bot-arkadaslik');
select cron.schedule('bildim-bot-arkadaslik', '25 * * * *',
                     'select public.bot_arkadaslik_temizle()');

-- ---- Turnuvaya gizli botların yalnız %20'si girer, her seferinde farklı ----
-- Sıra turnuva id'sine bağlı: aynı turnuvada tutarlı, turnuvadan turnuvaya
-- değişir. Açık botlar havuzda her zaman var (zaten bot oldukları belli).
create or replace function public.turnuva_bot_havuzu(p_tournament_id uuid)
returns table(bot_id uuid) language sql stable security definer set search_path to 'public' as $tbh$
  select p.id from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true) and coalesce(p.bot_turu, 'acik') = 'acik'
  union all
  select s.id from (
    select p.id
      from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
     order by public.bot_rasgele(p_tournament_id::text || p.id::text)
     limit greatest(1, (
       (select count(*) from public.profiles
         where is_bot and coalesce(bot_aktif, true) and bot_turu = 'gizli')
       * public.ayar_sayi('bot_turnuva_katilim_yuzde', 20) / 100)::int))
  s;
$tbh$;

create or replace function public.bot_join_tournament(p_seans text)
returns void language plpgsql security definer set search_path to 'public' as $bjt$
declare
  v_id uuid;
  v_bot uuid;
begin
  select id into v_id from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans and durum = 'lobi';
  if not found then return; end if;

  for v_bot in select bot_id from public.turnuva_bot_havuzu(v_id) loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$bjt$;

-- turnuva_lobi_botlari da aynı havuzu kullansın (lobi dolarken de
-- gizli botların yalnız o turnuvaya seçilen %20'si görünsün).
create or replace function public.turnuva_lobi_botlari()
returns void language plpgsql security definer set search_path to 'public' as $tlb$
declare
  v_seans text;
  v_tarih date;
  v_id uuid;
  v_baslangic timestamptz;
  v_kalan_dk numeric;
  v_hedef int;
  v_mevcut int;
  v_havuz int;
  v_bot uuid;
begin
  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments
  where tarih = v_tarih and seans = v_seans and durum = 'lobi';
  if not found then return; end if;

  v_baslangic := (v_tarih + public.turnuva_saati(v_seans)) at time zone 'Europe/Istanbul';
  v_kalan_dk := extract(epoch from (v_baslangic - now())) / 60.0;
  if v_kalan_dk > 120 then return; end if;

  select count(*)::int into v_havuz from public.turnuva_bot_havuzu(v_id);

  v_hedef := floor((120 - greatest(v_kalan_dk, 0)) / 15.0)::int + 1;
  v_hedef := greatest(0, least(v_hedef, v_havuz));

  select count(*)::int into v_mevcut
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = v_id and coalesce(p.is_bot, false);

  if v_mevcut >= v_hedef then return; end if;

  for v_bot in
    select b.bot_id from public.turnuva_bot_havuzu(v_id) b
    where not exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = v_id and tp.user_id = b.bot_id
    )
    order by public.bot_rasgele(v_id::text || b.bot_id::text)
    limit (v_hedef - v_mevcut)
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$tlb$;

-- Turnuva saati tek kaynaktan okunur (madde 4'te değerler güncellenecek).
-- Türkiye saati (Europe/Istanbul) — oyuncunun yerel saatine göre DEĞİL.
insert into public.oyun_ayarlari (anahtar, deger) values
  ('turnuva_saat_sabah', '"10:00"'::jsonb),
  ('turnuva_saat_aksam', '"22:00"'::jsonb)
on conflict (anahtar) do nothing;

create or replace function public.turnuva_saati(p_seans text)
returns time language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select (deger #>> '{}')::time from public.oyun_ayarlari
      where anahtar = case when p_seans = 'sabah' then 'turnuva_saat_sabah'
                           else 'turnuva_saat_aksam' end),
    case when p_seans = 'sabah' then time '10:00' else time '22:00' end);
$$;

-- ---- Meydanda bot nöbeti ----
-- Haritaya bütün botlar girmez: turnuva saatine yakın 1–2 gizli bot
-- "meydanda" görünür, yarı pasif dolaşır, nadiren emoji/dans yapar.
-- Botlar gerçek istemci olmadığı için Realtime presence'a katılamaz;
-- bunun yerine nöbet listesi burada tutulur, harita istemcisi listeyi
-- okuyup TOHUMDAN türeyen bir gezinme uygular. Böylece herkes aynı botu
-- aynı yerde görür ve mantık 3B modelden bağımsız kalır.
create table if not exists public.meydan_bot_nobeti (
  bot_id    uuid primary key references public.profiles(id) on delete cascade,
  baslangic timestamptz not null default now(),
  bitis     timestamptz not null,
  tohum     text not null
);
alter table public.meydan_bot_nobeti enable row level security;

drop policy if exists meydan_bot_nobeti_oku on public.meydan_bot_nobeti;
create policy meydan_bot_nobeti_oku on public.meydan_bot_nobeti
  for select to authenticated using (true);

create or replace function public.meydan_bot_nobeti_guncelle()
returns integer language plpgsql security definer set search_path to 'public' as $mbn$
declare
  v_simdi time := (now() at time zone 'Europe/Istanbul')::time;
  v_yakin boolean;
  v_hedef int := public.ayar_sayi('meydan_bot_sayisi', 2)::int;
  v_mevcut int;
  v_bot uuid;
  v_n int := 0;
begin
  delete from public.meydan_bot_nobeti where bitis < now();

  -- Turnuva saatinden 45 dk önce / 15 dk sonra "meydan kalabalık" sayılır.
  v_yakin := exists (
    select 1 from (values (public.turnuva_saati('sabah')), (public.turnuva_saati('aksam'))) t(s)
    where v_simdi between (t.s - interval '45 minutes')::time
                      and (t.s + interval '15 minutes')::time);

  if not v_yakin then
    delete from public.meydan_bot_nobeti;
    return 0;
  end if;

  select count(*)::int into v_mevcut from public.meydan_bot_nobeti;
  if v_mevcut >= v_hedef then return v_mevcut; end if;

  for v_bot in
    select p.id from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and not exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = p.id)
     order by random()
     limit (v_hedef - v_mevcut)
  loop
    insert into public.meydan_bot_nobeti (bot_id, bitis, tohum)
    values (v_bot, now() + interval '12 minutes', md5(v_bot::text || now()::text))
    on conflict (bot_id) do nothing;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$mbn$;

revoke all on function public.meydan_bot_nobeti_guncelle() from public, authenticated, anon;

-- Harita istemcisinin okuduğu liste (görsel katman bundan bağımsız).
create or replace function public.meydan_botlari()
returns table(user_id uuid, gorunen_ad text, gorunen_avatar text, gorunum jsonb, tohum text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.gorunen_ad, p.gorunen_avatar, p.gorunum, n.tohum
  from public.meydan_bot_nobeti n
  join public.profiles p on p.id = n.bot_id
  where n.bitis > now();
$$;

grant execute on function public.meydan_botlari() to authenticated;

select cron.unschedule('bildim-meydan-bot')
  where exists (select 1 from cron.job where jobname = 'bildim-meydan-bot');
select cron.schedule('bildim-meydan-bot', '*/5 * * * *',
                     'select public.meydan_bot_nobeti_guncelle()');

-- ---- Botlar turnuvada ve grup macinda da KENDI gecikmeleriyle cevaplar ----
-- Eskiden turnuvada herkes 3 sn'de, grup macinda 2-6 sn'de cevapliyordu:
-- gizli botun 8-14 sn'lik gercekci suresi yalniz 1v1'de gecerliydi.

CREATE OR REPLACE FUNCTION public.bot_oyna()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_ilk boolean;
  v_bot_index int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20, array[r.oyuncu1]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla — bot ASLA oyuncunun önüne geçmez.
  --    Bot yalnızca oyuncunun ulaştığı soruyu cevaplar (oyuncunun cevapladığı
  --    en yüksek indeks + 1) ve 2-6 sn arası rastgele gecikmeyle yanıtlar.
  --    (Eski davranış: 3 sn sonra her soruyu cevaplıyordu; 16 sn'lik otomatik
  --     ilerletmeyle birleşince bot 20 soruyu bitirirken oyuncu 2. sorudaydı.)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet,
           case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end as insan_id
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      -- Botun sira indeksi. SENKRONDA ortak soru (aktif_soru) ile ayni olmali:
      -- bot cevapladiginda kendi indeksi bir ilerler ve sira ortak indeksten
      -- one gecer; boylece ayni soruyu ikinci kez cevaplamaz (cift puan yok).
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
      and (
        not coalesce(m.senkron, false)
        or (m.basladi
            and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
                = m.aktif_soru)
      )
      -- Bot, insan oyuncunun ulaştığı sırayı GEÇEMEZ
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          <= (case when m.oyuncu1 = p.id then m.oyuncu2_soru else m.oyuncu1_soru end)
      -- 2-6 sn rastgele gecikme (insanın son hamlesinden sonra)
      -- Gecikme artik ZORLUGA BAGLI ve SORU BASINA SABIT (bkz. bot_gecikme_sn).
      and now() >= coalesce(m.soru_baslangic, m.created_at)
                   + public.bot_gecikme_sn(
                       p.id,
                       m.id::text || ':' ||
                       (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
    for update of m skip locked
  loop
    v_bot_index := case when r.oyuncu1 = r.bot_id then r.oyuncu1_soru else r.oyuncu2_soru end;
    select * into q from public.questions where id = r.soru_ids[v_bot_index + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, v_bot_index, v_cevap, v_dogru)
    on conflict do nothing;

    -- HIZ BONUSU YOK: bot da insanla ayni sabit puani alir
    v_puan := case when v_dogru then 10 else 0 end;

    if r.oyuncu1 = r.bot_id then
      update public.matches
         set oyuncu1_skor = oyuncu1_skor + v_puan,
             oyuncu1_soru = v_bot_index + 1,
             oyuncu1_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu1_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    end if;

    perform public.advance_match(r.id);

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet — oyuncu cevaplamadan 16 sn'de ilerletme.
  --    İki koşuldan biri: (a) her ikisi de cevapladı, (b) süre doldu VE oyuncu
  --    bu soruyu cevapladı. Oyuncu maçı terk ederse 90 sn'lik güvenlik ağı
  --    devreye girer (maç sonsuza kadar aktif kalmasın).
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (not coalesce(m.senkron, false) or m.basladi)
      and (
        2 <= (select count(*) from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru)
        or (now() > m.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru
                and a.user_id = (case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end)
            ))
        or now() > m.soru_baslangic + interval '90 seconds'
      )
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      -- Gecikme BOTA OZEL (bkz. bot_gecikme_sn): acik botlar aninda,
      -- gizli botlar lig seviyelerine uygun gercekci surede cevaplar.
      and now() >= t.soru_baslangic + public.bot_gecikme_sn(
            p.id, t.id::text || ':' || t.aktif_soru::text,
            p.bot_gecikme_min, p.bot_gecikme_max) * interval '1 second'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                           from public.group_match_players gmp
                          where gmp.group_match_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id
      and gmp.davet_durumu = 'kabul' and gmp.terk_at is null
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      -- Gecikme BOTA OZEL (1v1 ve turnuvadaki kuralin aynisi)
      and now() >= gm.soru_baslangic + public.bot_gecikme_sn(
            p.id, gm.id::text || ':' || gm.aktif_soru::text,
            p.bot_gecikme_min, p.bot_gecikme_max) * interval '1 second'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ (1v1'deki kural)
      and gm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.group_match_answers a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.group_match_id = gm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of gm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      and (
        -- herkes cevapladi
        not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and gmp.terk_at is null
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        )
        -- ya da soru suresi doldu VE en az bir insan bu soruyu fiilen oynadi
        or (now() > gm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.group_match_answers a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.group_match_id = gm.id and a3.soru_index = gm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        -- ya da mac terk edildi (guvenlik agi)
        or now() > gm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_group_match(r.id);
  end loop;

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                           from public.hizli_oyuncular ho
                          where ho.hizli_mac_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id
      and ho.davet_durumu = 'kabul' and ho.terk_at is null
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      -- Gecikme zorluga bagli ve (mac, soru, bot) icin SABIT: cron her 7 sn'de
      -- calistigi icin random() her tikte yeniden cekiliyordu; bu, dagilimin
      -- alt sinirina yigilmaya (bot hep ~2 sn'de basiyor) yol aciyordu.
      and now() >= hm.soru_baslangic
                   + public.bot_gecikme_sn(
                       p.id, hm.id::text || ':' || hm.aktif_soru::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ
      and hm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.hizli_cevaplar a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.hizli_mac_id = hm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of hm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      and (
        not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and ho.terk_at is null
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        )
        or (now() > hm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.hizli_cevaplar a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.hizli_mac_id = hm.id and a3.soru_index = hm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        or now() > hm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$function$;
