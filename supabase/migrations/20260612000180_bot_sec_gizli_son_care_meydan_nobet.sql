-- ============================================================
-- 1) bot_sec SON ÇARESİ ARTIK AÇIK BOT DEĞİL, GİZLİ BOT
-- 2) MEYDAN NÖBETİ BİTMEDEN TAZELENİR (boşluk kalmaz)
--
-- (1) Sahibinin kuralı: otomatik eşleşmede (8 sn bekleyip sunucuya
--     düşen yol, `quick_match`) karşıya ASLA açık bot ("...Bot")
--     çıkmamalı (gizli bot kuralı, migration 155). `bot_sec`'in (d)
--     adımı "tüm botlar" arasından seçtiği için lig filtresi boş
--     kalırsa ÇaylakBot/ToyBot gelebiliyordu.
--     Ölçüm (14 Eyl 2026): 155 gizli bot 5 lige yayılı, yeni hesapla
--     300 denemede 300 gizli bot — (d)'ye pratikte düşülmüyor. Yine de
--     güvence: (d) artık lig/seviye sınırı olmadan TÜM GİZLİ botlar.
--     Açık bot yalnız `hemen_bot_mac` ("Beklemeden bot ile oyna") ve
--     bilerek yapılan meydan okumada gelir.
--
-- (2) `meydan_bot_nobeti_guncelle` yalnız süresi GEÇMİŞ satırları
--     siliyor, doluluğu da onlara göre sayıyordu. Cron 5 dakikada bir
--     çalıştığı için bir nöbet bittiği an ile sonraki tur arasında
--     `meydan_botlari()` o botu döndürmüyordu; nöbetler üst üste
--     biterse meydan birkaç dakika botsuz kalabiliyordu.
--     Artık "önümüzdeki cron turundan önce bitecek" satırlar dolu
--     sayılmaz; yenisi önceden yazılır. Eski satır süresi dolana kadar
--     görünür kalır — istemci zaten `tavan`dan fazlasını çizmez.
-- ============================================================

create or replace function public.bot_sec(p_user uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $bs$
declare
  v_lig int;
  v_alt int;
  v_ust int;
  v_yakin numeric := public.ayar_sayi('bot_eslesme_yakin_yuzde', 80)::numeric / 100;
  v_pencere int := public.ayar_sayi('bot_tekrar_penceresi', 8)::int;
  v_son uuid[];
  v_bot uuid;
begin
  select public.lig_sirasi(coalesce(lig, 'bronz')) into v_lig
    from public.profiles where id = p_user;
  v_lig := coalesce(v_lig, 1);

  select a.alt, a.ust into v_alt, v_ust from public.bot_seviye_araligi(p_user) a;

  -- Son maçlardaki rakipler (aynı bot üst üste gelmesin)
  select coalesce(array_agg(r), '{}'::uuid[]) into v_son from (
    select case when m.oyuncu1 = p_user then m.oyuncu2 else m.oyuncu1 end as r
    from public.matches m
    where p_user in (m.oyuncu1, m.oyuncu2)
    order by m.created_at desc
    limit v_pencere
  ) s;

  -- (a) Seviyeye yakın gizli bot
  if random() < v_yakin then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
       and p.bot_seviye_puan between v_alt and v_ust
       and p.id <> all(v_son)
     order by random() limit 1;
  end if;

  -- (b) Lig sınırı içinde rastgele gizli bot
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
       and p.id <> all(v_son)
     order by random() limit 1;
  end if;

  -- (c) Tekrar engelini gevşet (havuz daraldıysa maç yine kurulsun)
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
     order by random() limit 1;
  end if;

  -- (d) Son çare: lig/seviye sınırı olmadan GİZLİ bot.
  -- ESKİDEN: tüm botlar (açık dahil) — otomatik yolda ÇaylakBot çıkabiliyordu.
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
     order by random() limit 1;
  end if;

  return v_bot;
end;
$bs$;

revoke all on function public.bot_sec(uuid) from public, authenticated, anon;

create or replace function public.meydan_bot_nobeti_guncelle()
returns integer
language plpgsql
security definer
set search_path = public
as $mbn$
declare
  v_hedef int := public.ayar_sayi('meydan_bot_tavan', 6)::int;
  -- Cron 5 dakikada bir: bu süreden önce bitecek nöbet "dolu" sayılmaz.
  v_esik timestamptz := now() + interval '6 minutes';
  v_mevcut int;
  v_bot uuid;
  v_n int := 0;
begin
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
    -- Nöbet 12-20 dk; bitişler dağınık olsun ki botlar hep birlikte değişmesin.
    insert into public.meydan_bot_nobeti (bot_id, bitis, tohum)
    values (v_bot,
            now() + make_interval(mins => 12 + (random() * 8)::int),
            md5(v_bot::text || now()::text))
    on conflict (bot_id) do nothing;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$mbn$;

revoke all on function public.meydan_bot_nobeti_guncelle() from public, authenticated, anon;

select public.meydan_bot_nobeti_guncelle();
