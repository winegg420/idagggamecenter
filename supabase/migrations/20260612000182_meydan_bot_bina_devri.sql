-- ============================================================
-- MEYDAN BOTLARI — KAPIDAN GİRER, DOLAŞIR, BİR BİNAYA GİRİP GİDER
--
-- Sahibinin isteği (Revizyon Paketi 6, madde 2): "Bir süre sonra bir
-- binaya gidip yok olmalı, yerine başkası girmeli."
--
-- ÖNCEKİ DURUM: nöbet 12-20 dk, bot o süre boyunca çeşme etrafında sabit
-- bir dairede dönüyordu. Yeni hareket planı istemcide (meydanBotlari.js),
-- ama planın ZAMANI buradan gelir: bot `baslangic` anında bir kapıdan
-- girer, `bitis` anında bir binanın kapısına varıp kaybolur.
--
-- DEĞİŞENLER
--   • Nöbet süresi kısa ve ayardan: meydan_bot_nobet_sn_min / _max.
--   • `meydan_bot_devir_sn`: bitmesine bu kadar kalan nöbet dolu sayılmaz,
--     yeni bot ÖNCEDEN yazılır — biri çıkarken öteki kapıdan girer.
--   • Cron 5 dakikada bir çalışıyor; 80-150 sn'lik nöbetler için yetmez.
--     `meydan_botlari()` (meydandaki her istemci 6 sn'de bir çağırıyor)
--     eksik varsa nöbeti kendisi tazeler. Aynı anda çağıranlar çift iş
--     yapmasın diye işlem kilidi (advisory lock) alınır; alamayan atlar.
--   • `meydan_botlari()` artık `baslangic`, `bitis` ve `sunucu_zamani`
--     döndürür: istemci saat farkını düzeltip herkes botu aynı yerde görür.
--     `is_bot` DÖNMEZ.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('meydan_bot_nobet_sn_min', '80'::jsonb,
   'Bir meydan botunun kapıdan girip bir binaya girerek ayrılmasına kadar en kısa süre (sn).'),
  ('meydan_bot_nobet_sn_max', '150'::jsonb,
   'Bir meydan botunun meydanda kalacağı en uzun süre (sn).'),
  ('meydan_bot_devir_sn', '12'::jsonb,
   'Nöbetin bitmesine bu kadar sn kala yerine yeni bot yazılır (biri çıkarken öteki girer).')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

create or replace function public.meydan_bot_nobeti_guncelle()
returns integer
language plpgsql
security definer
set search_path = public
as $mbn$
declare
  v_hedef int := public.ayar_sayi('meydan_bot_tavan', 6)::int;
  v_min numeric := public.ayar_sayi('meydan_bot_nobet_sn_min', 80)::numeric;
  v_max numeric := public.ayar_sayi('meydan_bot_nobet_sn_max', 150)::numeric;
  v_esik timestamptz := now() + make_interval(secs => public.ayar_sayi('meydan_bot_devir_sn', 12)::double precision);
  v_mevcut int;
  v_bot uuid;
  v_n int := 0;
begin
  if v_max < v_min then v_max := v_min; end if;

  delete from public.meydan_bot_nobeti where bitis < now();

  select count(*)::int into v_mevcut
    from public.meydan_bot_nobeti where bitis >= v_esik;
  if v_mevcut >= v_hedef then return v_mevcut; end if;

  for v_bot in
    select p.id from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and not exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = p.id)
     order by random()
     limit (v_hedef - v_mevcut)
  loop
    -- Süreler dağınık: botlar hep birlikte girip çıkmasın.
    insert into public.meydan_bot_nobeti (bot_id, baslangic, bitis, tohum)
    values (v_bot, now(),
            now() + make_interval(secs => (v_min + random() * (v_max - v_min))::double precision),
            md5(v_bot::text || clock_timestamp()::text))
    on conflict (bot_id) do nothing;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$mbn$;

revoke all on function public.meydan_bot_nobeti_guncelle() from public, authenticated, anon;

-- Dönüş tipi değiştiği için önce kaldırılır (tek kullanıcısı meydanBotlari.js).
drop function if exists public.meydan_botlari();

create function public.meydan_botlari()
returns table(user_id uuid, gorunen_ad text, gorunen_avatar text, gorunum jsonb, tohum text,
              baslangic timestamptz, bitis timestamptz, sunucu_zamani timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_esik timestamptz := now() + make_interval(secs => public.ayar_sayi('meydan_bot_devir_sn', 12)::double precision);
begin
  -- Eksik varsa tazele. Kilidi alamayan (başka istemci o an tazeliyor) atlar.
  if (select count(*) from public.meydan_bot_nobeti n where n.bitis >= v_esik)
       < public.ayar_sayi('meydan_bot_tavan', 6)::int
     and pg_try_advisory_xact_lock(hashtext('meydan_bot_nobeti')) then
    perform public.meydan_bot_nobeti_guncelle();
  end if;

  return query
  select p.id, p.gorunen_ad, p.gorunen_avatar, p.gorunum, n.tohum,
         n.baslangic, n.bitis, now()
    from public.meydan_bot_nobeti n
    join public.profiles p on p.id = n.bot_id
   where n.bitis > now()
   order by n.baslangic desc;
end;
$fn$;

revoke all on function public.meydan_botlari() from public, authenticated, anon;
grant execute on function public.meydan_botlari() to authenticated;

-- Eski uzun nöbetler (12-20 dk) yeni kurala çekilir: yeni hareket hemen görünsün.
update public.meydan_bot_nobeti
   set baslangic = least(baslangic, now()),
       bitis = least(bitis, now() + make_interval(secs => (40 + random() * 90)::double precision));

select public.meydan_bot_nobeti_guncelle();
