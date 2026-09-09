-- ============================================================
-- REVİZE PAKETİ #3 (9 Eylül 2026)
--
-- 1) "Hızlı Olan Kazanır"da insan oyuncu hiç kazanamıyordu.
--    KÖK NEDEN: bot gecikmesi `now() >= soru_baslangic + (2 + random()*4)s`
--    biçimindeydi. `bot_oyna` cron'u 7 saniyede bir çalışıyor ve random()
--    HER TİKTE yeniden çekiliyor; bu da dağılımın alt sınırına yığılma
--    demek — bot pratikte hep ~2 sn'de basıyordu. Üstelik gecikme zorluktan
--    bağımsızdı.
--    ÇÖZÜM: gecikme (a) zorluk seviyesine bağlı, (b) (maç, soru, bot) üçlüsü
--    için SABİT (md5 tabanlı deterministik) hale getirildi.
--      Kolay 4.5–7.0 sn · Orta 3.0–5.0 sn · Zor 2.0–3.5 sn
--    İsabet oranları da zorluğa bağlandı: Kolay %45 · Orta %65 · Zor %85.
--
-- 3) Turnuva lobisi ölü görünüyordu (botlar 30 dk kala hep birden giriyordu).
--    Artık 2 saat önce başlayıp 15 dk aralıklarla kademeli giriyorlar.
--
-- 5) Bekleyen grup/hızlı davetler birikiyordu. 24 saatten eski "bekliyor"
--    davetleri temizleyen RPC + saatlik cron eklendi.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Bot zorluk seviyesi ve deterministik gecikme
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists bot_seviye text,
  add column if not exists bot_gecikme_min real,
  add column if not exists bot_gecikme_max real;

comment on column public.profiles.bot_seviye is
  'Bot zorluk seviyesi: kolay | orta | zor (isabet ve cevap gecikmesini belirler)';

-- (bot, tohum) çiftinden 0..1 arası deterministik sayı.
-- md5'in ilk 7 hex hanesi = 28 bit; bit(28)::int daima pozitiftir.
create or replace function public.bot_rasgele(p_tohum text)
returns double precision
language sql
immutable
as $$
  select (('x' || substr(md5(p_tohum), 1, 7))::bit(28)::int)::double precision / 268435456.0;
$$;

-- Botun bu soru için cevap gecikmesi (saniye). Aynı (bot, tohum) için hep
-- aynı değeri döndürür; cron her 7 sn'de çalışsa da gecikme kaymaz.
--
-- KAVRAMA PAYI (1 sn): gecikme penceresi "oyuncu soruyu GÖRDÜĞÜ andan itibaren"
-- tanımlıdır. Sunucu ise saymaya soru_baslangic ile başlar; arada realtime
-- yayını + get_hizli_soru + render var. Bu pay olmadan bot, insanın hiç
-- görmediği saniyelerde cevaplamış sayılıyor ve hızlı oyuncu bile geç kalıyor.
create or replace function public.bot_gecikme_sn(
  p_bot uuid,
  p_tohum text,
  p_min real,
  p_max real
)
returns double precision
language sql
immutable
as $$
  select 1.0::double precision
       + coalesce(p_min, 3.0)::double precision
       + (coalesce(p_max, 5.0) - coalesce(p_min, 3.0))::double precision
         * public.bot_rasgele(p_bot::text || '|' || p_tohum);
$$;

-- Zorluk dağılımı: 2 kolay, 2 orta, 1 zor (5 bot)
update public.profiles set
  bot_seviye = 'kolay', bot_isabet = 0.45, bot_gecikme_min = 4.5, bot_gecikme_max = 7.0
where id in ('b0b00000-0000-4000-8000-000000000002',   -- ÇaylakBot
             'b0b00000-0000-4000-8000-000000000004');  -- AcemiBot

update public.profiles set
  bot_seviye = 'orta', bot_isabet = 0.65, bot_gecikme_min = 3.0, bot_gecikme_max = 5.0
where id in ('b0b00000-0000-4000-8000-000000000001',   -- BilgeBot
             'b0b00000-0000-4000-8000-000000000005');  -- KurtBot

update public.profiles set
  bot_seviye = 'zor', bot_isabet = 0.85, bot_gecikme_min = 2.0, bot_gecikme_max = 3.5
where id = 'b0b00000-0000-4000-8000-000000000003';     -- UstaBot

-- Sonradan eklenecek botlar için güvenli varsayılan (orta)
update public.profiles set
  bot_seviye = coalesce(bot_seviye, 'orta'),
  bot_gecikme_min = coalesce(bot_gecikme_min, 3.0),
  bot_gecikme_max = coalesce(bot_gecikme_max, 5.0),
  bot_isabet = coalesce(bot_isabet, 0.65)
where coalesce(is_bot, false);

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
           soru_baslangic = now()
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
      -- ASENKRON: botun KENDİ sıra indeksi
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
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

    -- Bot da insan gibi hızına göre puan alır (3-12 sn arası makul bir aralık)
    v_puan := case when v_dogru then 10 + (3 + floor(random() * 10))::int else 0 end;

    if r.oyuncu1 = r.bot_id then
      update public.matches
         set oyuncu1_skor = oyuncu1_skor + v_puan,
             oyuncu1_soru = v_bot_index + 1,
             oyuncu1_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu1_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_bot_index + 1),
             soru_baslangic = now()
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_bot_index + 1),
             soru_baslangic = now()
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
      and now() >= t.soru_baslangic + interval '3 seconds'
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
    join public.group_match_players gmp on gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif'
      and now() >= gm.soru_baslangic + (2 + random() * 4) * interval '1 second'
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
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
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
    where gm.durum = 'aktif'
      and (
        -- herkes cevapladi
        not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
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
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif'
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
    where hm.durum = 'aktif'
      and (
        not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
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
$function$
;

-- ------------------------------------------------------------
-- 3) Turnuva lobisi: botlar 2 saat önce kademeli girsin
--
-- Eski davranış: 'bildim-bot-turnuva' cron'u turnuvadan 30 dk önce BİR KEZ
-- çalışıp beş botu aynı anda ekliyordu. Turnuvaya 1 saat kala lobide tek
-- kişi (oyuncunun kendisi) görünüyordu; lobi ölü hissettiriyordu.
--
-- Yeni davranış: 10 dakikada bir çalışan bir görev, turnuvaya kalan süreye
-- göre lobide kaç bot olması gerektiğini hesaplar ve eksikse birer birer
-- ekler. Botlar 15 dk arayla sızar:
--   T-120 → 1 bot ·  T-105 → 2 ·  T-90 → 3 ·  T-75 → 4 ·  T-60 → 5
-- ------------------------------------------------------------

create or replace function public.turnuva_lobi_botlari()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seans text;
  v_tarih date;
  v_id uuid;
  v_baslangic timestamptz;
  v_kalan_dk numeric;
  v_hedef int;
  v_mevcut int;
  v_bot uuid;
begin
  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  -- Lobi henüz açılmadıysa aç (oyuncu girmeden de botlar birikebilsin)
  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments
  where tarih = v_tarih and seans = v_seans and durum = 'lobi';
  if not found then return; end if;

  -- Seansın başlangıç anı (Europe/Istanbul: sabah 10:00, akşam 22:00)
  v_baslangic := (v_tarih + (case when v_seans = 'sabah' then time '10:00' else time '22:00' end))
                 at time zone 'Europe/Istanbul';
  v_kalan_dk := extract(epoch from (v_baslangic - now())) / 60.0;

  -- 2 saatten uzak: henüz kimse girmesin
  if v_kalan_dk > 120 then return; end if;

  v_hedef := floor((120 - greatest(v_kalan_dk, 0)) / 15.0)::int + 1;
  v_hedef := greatest(0, least(v_hedef, (select count(*)::int from public.profiles where coalesce(is_bot, false))));

  select count(*)::int into v_mevcut
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = v_id and coalesce(p.is_bot, false);

  if v_mevcut >= v_hedef then return; end if;

  -- Güçlüden zayıfa değil, karışık bir sırayla girsinler (lobi doğal görünsün);
  -- sıra turnuva id'sine bağlı olduğundan aynı turnuvada tutarlı kalır.
  for v_bot in
    select p.id from public.profiles p
    where coalesce(p.is_bot, false)
      and not exists (
        select 1 from public.tournament_players tp
        where tp.tournament_id = v_id and tp.user_id = p.id
      )
    order by public.bot_rasgele(v_id::text || p.id::text)
    limit (v_hedef - v_mevcut)
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$$;

revoke execute on function public.turnuva_lobi_botlari() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5) Bekleyen davet temizliği
--
-- 24 saatten eski ve hâlâ "bekliyor" durumundaki grup/hızlı maç davetleri
-- otomatik iptal edilir. Hem saatlik cron hem de oyuncunun Meydan Oku
-- sayfasını açtığında çağırdığı RPC ile (cron durursa liste yine temizlenir).
-- ------------------------------------------------------------

create or replace function public.eski_davetleri_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sayi int := 0;
  v_n int;
begin
  update public.group_matches
     set durum = 'iptal', bitis = coalesce(bitis, now())
   where durum = 'bekliyor'
     and created_at < now() - interval '24 hours';
  get diagnostics v_n = row_count; v_sayi := v_sayi + v_n;

  update public.hizli_maclar
     set durum = 'iptal', bitis = coalesce(bitis, now())
   where durum = 'bekliyor'
     and created_at < now() - interval '24 hours';
  get diagnostics v_n = row_count; v_sayi := v_sayi + v_n;

  -- Karşı taraf 24 saattir yanıtlamadıysa 1v1 daveti de düşsün
  update public.matches
     set durum = 'iptal'
   where durum = 'bekliyor'
     and created_at < now() - interval '24 hours';
  get diagnostics v_n = row_count; v_sayi := v_sayi + v_n;

  return v_sayi;
end;
$$;

revoke execute on function public.eski_davetleri_temizle() from public, anon;
grant execute on function public.eski_davetleri_temizle() to authenticated;

-- ------------------------------------------------------------
-- Zamanlanmış görevler
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Lobi botları: 10 dakikada bir
    perform cron.unschedule('bildim-turnuva-lobi-bot')
      where exists (select 1 from cron.job where jobname = 'bildim-turnuva-lobi-bot');
    perform cron.schedule('bildim-turnuva-lobi-bot', '*/10 * * * *',
      'select public.turnuva_lobi_botlari()');

    -- Eski davet temizliği: saat başı
    perform cron.unschedule('bildim-eski-davet-temizle')
      where exists (select 1 from cron.job where jobname = 'bildim-eski-davet-temizle');
    perform cron.schedule('bildim-eski-davet-temizle', '5 * * * *',
      'select public.eski_davetleri_temizle()');
  end if;
end $$;
