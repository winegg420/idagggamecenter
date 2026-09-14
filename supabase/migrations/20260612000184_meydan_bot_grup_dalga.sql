-- ============================================================
-- MEYDAN BOTLARI — GRUP GİRİŞİ, KATMAN, ORGANİK DAVRANIŞ AYARLARI
--
-- Sahibinin isteği: "Bazen 1 bot değil 2-3 bot haritaya girsin aynı anda.
-- Gerçek oyuncu hareketli görsün mapi. 2 bot birbiri arasında balon
-- versin, kahve içsin. Botlar birini görünce arada sırada yanına gitsin,
-- emoji atsın, hoplasın zıplasın."
--
-- KATMAN: nöbet artık `meydan_bot_tavan` kadar "katman"a (0..tavan-1)
-- bölünür. Her katmanın kendi devri vardır: katmandaki bot çıkarken
-- (`meydan_bot_devir_sn`) yerine yenisi yazılır. İstemci bir botu
-- `katman < hedef` ise çizer (hedef = zamana bağlı dalga + gerçek oyuncu
-- sayısı) — tüm istemciler aynı kuralı aynı listeye uyguladığı için aynı
-- botları görür; 0. katman hiç boşalmaz, meydan boş kalmaz.
--
-- GRUP: bir katman tazelenirken `meydan_bot_grup_yuzde` olasılıkla tek bot
-- yerine 2..`meydan_bot_grup_en_cok` bot AYNI ANDA yazılır (aynı katman,
-- aynı başlangıç). İstemci onları aynı kapıdan birkaç adım arayla sokar.
-- Grubun en uzun kalanı "lider"dir; eşlikçiler daha önce ayrılır.
--
-- İstemci davranış ayarları (ziyaret, ikram, dalga) `meydan_bot_ayarlari()`
-- ile verilir; dönüş tipi değiştiği için drop/create (tek istemcisi
-- HaritaSayfasi.jsx). `is_bot` hiçbir yerde DÖNMEZ.
-- ============================================================

alter table public.meydan_bot_nobeti
  add column if not exists katman int not null default 0;

-- Mevcut nöbetler katmanlara dağıtılır (en uzun kalan 0. katman).
with s as (
  select bot_id, (row_number() over (order by bitis desc, bot_id) - 1)::int as rn
    from public.meydan_bot_nobeti
)
update public.meydan_bot_nobeti n
   set katman = s.rn
  from s
 where s.bot_id = n.bot_id;

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('meydan_bot_grup_yuzde', '30'::jsonb,
   'Bir meydan katmanı tazelenirken tek bot yerine grup (2+ bot aynı kapıdan) girme olasılığı (%).'),
  ('meydan_bot_grup_en_cok', '3'::jsonb,
   'Meydana birlikte giren bot grubunun en büyük boyu.'),
  ('meydan_bot_dalga_sn', '240'::jsonb,
   'Tek başına oyuncunun gördüğü bot sayısı bu uzunluktaki dilimlerde kararlı bir dalgayla değişir (sn).'),
  ('meydan_bot_dalga_ust', '3'::jsonb,
   'Başka gerçek oyuncu yokken dalganın çıkabileceği en çok katman (alt sınır meydan_bot_taban).'),
  ('meydan_bot_ziyaret_yuzde', '25'::jsonb,
   'Meydan botunun her uygun zaman diliminde yakındaki gerçek bir oyuncunun yanına gidip selam verme olasılığı (%).'),
  ('meydan_bot_ikram_yuzde', '50'::jsonb,
   'Aynı anda meydanda olan iki botun buluşup birbirine kahve/balon ikram etme olasılığı (%).')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

create or replace function public.meydan_bot_nobeti_guncelle()
returns integer
language plpgsql
security definer
set search_path = public
as $mbn$
declare
  v_tavan int := public.ayar_sayi('meydan_bot_tavan', 6)::int;
  v_min numeric := public.ayar_sayi('meydan_bot_nobet_sn_min', 80)::numeric;
  v_max numeric := public.ayar_sayi('meydan_bot_nobet_sn_max', 150)::numeric;
  v_esik timestamptz := now() + make_interval(secs => public.ayar_sayi('meydan_bot_devir_sn', 12)::double precision);
  v_grup_yuzde numeric := public.ayar_sayi('meydan_bot_grup_yuzde', 30)::numeric;
  v_grup_en_cok int := greatest(1, public.ayar_sayi('meydan_bot_grup_en_cok', 3)::int);
  v_k int;
  v_boyut int;
  v_sure numeric;
  v_i int;
  v_bot uuid;
  v_n int := 0;
begin
  if v_max < v_min then v_max := v_min; end if;

  delete from public.meydan_bot_nobeti where bitis < now();

  for v_k in 0 .. v_tavan - 1 loop
    -- Katman dolu: içindeki bot devir eşiğinden sonra çıkıyor.
    if exists (select 1 from public.meydan_bot_nobeti n
                where n.katman = v_k and n.bitis >= v_esik) then
      continue;
    end if;

    v_boyut := 1;
    if v_grup_en_cok >= 2 and random() * 100 < v_grup_yuzde then
      v_boyut := 2 + floor(random() * (v_grup_en_cok - 1))::int;
    end if;
    v_sure := v_min + random() * (v_max - v_min);
    v_i := 0;

    for v_bot in
      select p.id from public.profiles p
       where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
         and not exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = p.id)
       order by random()
       limit v_boyut
    loop
      -- İlk yazılan lider: tam süre. Eşlikçiler sürenin %60-100'ü kadar
      -- kalır, liderden önce bir binaya girip ayrılır.
      insert into public.meydan_bot_nobeti (bot_id, baslangic, bitis, tohum, katman)
      values (v_bot, now(),
              now() + make_interval(secs => (case when v_i = 0 then v_sure
                                                  else v_sure * (0.6 + random() * 0.4) end)::double precision),
              md5(v_bot::text || clock_timestamp()::text),
              v_k)
      on conflict (bot_id) do nothing;
      v_i := v_i + 1;
      v_n := v_n + 1;
    end loop;
  end loop;

  return v_n;
end;
$mbn$;

revoke all on function public.meydan_bot_nobeti_guncelle() from public, authenticated, anon;

-- Dönüş tipi değişti (katman eklendi) → kaldır, yeniden kur.
drop function if exists public.meydan_botlari();

create function public.meydan_botlari()
returns table(user_id uuid, gorunen_ad text, gorunen_avatar text, gorunum jsonb, tohum text,
              baslangic timestamptz, bitis timestamptz, sunucu_zamani timestamptz, katman int)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_tavan int := public.ayar_sayi('meydan_bot_tavan', 6)::int;
  v_esik timestamptz := now() + make_interval(secs => public.ayar_sayi('meydan_bot_devir_sn', 12)::double precision);
begin
  -- Boş katman varsa tazele. Kilidi alamayan (başka istemci o an tazeliyor) atlar.
  if (select count(distinct n.katman) from public.meydan_bot_nobeti n
       where n.bitis >= v_esik and n.katman < v_tavan) < v_tavan
     and pg_try_advisory_xact_lock(hashtext('meydan_bot_nobeti')) then
    perform public.meydan_bot_nobeti_guncelle();
  end if;

  return query
  select p.id, p.gorunen_ad, p.gorunen_avatar, p.gorunum, n.tohum,
         n.baslangic, n.bitis, now(), n.katman
    from public.meydan_bot_nobeti n
    join public.profiles p on p.id = n.bot_id
   where n.bitis > now()
   order by n.baslangic desc;
end;
$fn$;

revoke all on function public.meydan_botlari() from public, authenticated, anon;
grant execute on function public.meydan_botlari() to authenticated;

-- Dönüş tipi değişti (dalga/ziyaret/ikram eklendi) → kaldır, yeniden kur.
drop function if exists public.meydan_bot_ayarlari();

create function public.meydan_bot_ayarlari()
returns table(taban int, ek int, tavan int, dalga_sn int, dalga_ust int,
              grup_en_cok int, ziyaret_yuzde int, ikram_yuzde int)
language sql
stable
security definer
set search_path = public
as $fn$
  select public.ayar_sayi('meydan_bot_taban', 1)::int,
         public.ayar_sayi('meydan_bot_ek', 2)::int,
         public.ayar_sayi('meydan_bot_tavan', 6)::int,
         public.ayar_sayi('meydan_bot_dalga_sn', 240)::int,
         public.ayar_sayi('meydan_bot_dalga_ust', 3)::int,
         public.ayar_sayi('meydan_bot_grup_en_cok', 3)::int,
         public.ayar_sayi('meydan_bot_ziyaret_yuzde', 40)::int,
         public.ayar_sayi('meydan_bot_ikram_yuzde', 50)::int;
$fn$;

revoke all on function public.meydan_bot_ayarlari() from public, authenticated, anon;
grant execute on function public.meydan_bot_ayarlari() to authenticated;

select public.meydan_bot_nobeti_guncelle();
