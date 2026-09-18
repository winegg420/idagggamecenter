-- Paket 26 E — sık çalışan cron işlerine eşzamanlılık kilidi.
--
-- ÖLÇÜLEN DURUM (18 Eyl 2026, cron.job + cron.job_run_details):
--   · Canlıda 24 zamanlanmış iş var. Yinelenen/ölü KAYIT YOK; aynı komutu paylaşan
--     iki çift (hafta-kapat + hafta-kapat-pzt, giysi-rotasyon + giysi-yedek) bilerek
--     kurulmuş yedeklemelerdir ve iki fonksiyon da kendi içinde idempotenttir.
--   · Son 14 günde 6 sık işin 300 binden fazla koşusu içinde TURNUVA ANINDA
--     (TSİ 13:00 ve 21:50 ± birkaç dakika) 3.211 koşu var ve hata sayısı SIFIR;
--     süreler normal dilimden daha da kısa (bot-oyna 0,019 sn / 0,021 sn).
--     Yani turnuva anı bir yük sorunu değil.
--   · Son 48 saatteki 9 başarısız koşunun HEPSİ tek bir saat diliminde:
--     17 Eyl 15:00–16:00 UTC. bot_oyna'nın hatası "compilation of PL/pgSQL function
--     near line 4" — yani fonksiyon DERLENİRKEN kilitte bekliyor. Bu, o sırada
--     uygulanan migration'ların CREATE OR REPLACE'i ile 2 saniyelik cron'un
--     çakışmasıdır: işler birikir ve 120 sn'lik ifade zaman aşımına düşer.
--   · gizli_bot_nabiz ↔ bot_puan_tik deadlock'ları: 30 günde 9 kayıt, SONUNCUSU
--     16 Eyl 11:50. Migration 207'nin düzeltmesinden bu yana (~43 saat, gizli bot
--     nabzının ~2.600 koşusu) SIFIR deadlock. Düzeltme tutuyor.
--
-- BU DOSYA NE YAPIYOR: dört sık işe "aynı işin ikinci kopyası varsa sessizce atla"
-- kapısı koyuyor. İşin kendisi silinmiyor, sıklığı değişmiyor, mantığı değişmiyor —
-- tek eklenen satır en baştaki advisory kilit denemesidir. Böylece bir koşu
-- uzarsa (dağıtım, geçici kilit, ağır tik) arkasına kuyruk birikmez.

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
  -- Paket 26 E: aynı işin iki kopyası aynı anda çalışmasın. Ölçüldü (17 Eyl 15:00 UTC):
  -- migration uygulanırken fonksiyon derlemesi kilitlenince 2 saniyelik işler birikti ve
  -- 9 koşu 120 sn'lik ifade zaman aşımına düştü. Kilidi alamayan koşu sessizce atlar.
  if not pg_try_advisory_xact_lock(hashtext('bot_oyna')) then return; end if;
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
      -- GİZLİ bot daveti hemen kabul etmez: insan gibi biraz düşünür.
      -- Açık bot (adı "...Bot") anında kabul eder, oyuncu zaten biliyor.
      and public.bot_daveti_kabul_etti_mi(p.id, m.created_at, m.id::text,
                                          coalesce(p.bot_turu, 'acik'))
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
                       p.bot_gecikme_min, p.bot_gecikme_max,
                       public.soru_okuma_yuku(
                         m.soru_ids[(case when m.oyuncu1 = p.id
                                          then m.oyuncu1_soru else m.oyuncu2_soru end) + 1])
                     ) * interval '1 second'
    for update of m skip locked
  loop
    v_bot_index := case when r.oyuncu1 = r.bot_id then r.oyuncu1_soru else r.oyuncu2_soru end;
    select * into q from public.questions where id = r.soru_ids[v_bot_index + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
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
            p.bot_gecikme_min, p.bot_gecikme_max,
            public.soru_okuma_yuku(t.soru_ids[t.aktif_soru + 1])) * interval '1 second'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
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
      and public.bot_daveti_kabul_etti_mi(p.id, gmp.joined_at, gmp.group_match_id::text,
                                          coalesce(p.bot_turu, 'acik'))
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
            p.bot_gecikme_min, p.bot_gecikme_max,
            public.soru_okuma_yuku(gm.soru_ids[gm.aktif_soru + 1])) * interval '1 second'
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

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
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
      and public.bot_daveti_kabul_etti_mi(p.id, ho.joined_at, ho.hizli_mac_id::text,
                                          coalesce(p.bot_turu, 'acik'))
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
                       p.bot_gecikme_min, p.bot_gecikme_max,
                       public.soru_okuma_yuku(hm.soru_ids[hm.aktif_soru + 1])
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

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
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

CREATE OR REPLACE FUNCTION public.gizli_bot_nabiz()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n int;
begin
  -- Paket 26 E: aynı işin iki kopyası aynı anda çalışmasın. Ölçüldü (17 Eyl 15:00 UTC):
  -- migration uygulanırken fonksiyon derlemesi kilitlenince 2 saniyelik işler birikti ve
  -- 9 koşu 120 sn'lik ifade zaman aşımına düştü. Kilidi alamayan koşu sessizce atlar.
  if not pg_try_advisory_xact_lock(hashtext('gizli_bot_nabiz')) then return 0; end if;
  update public.profiles p
     set last_seen = now()
   where p.id in (
     select x.id from public.profiles x
      where coalesce(x.is_bot, false) and x.bot_turu = 'gizli' and coalesce(x.bot_aktif, true)
        and (
          exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = x.id and n.bitis > now())
          or exists (select 1 from public.matches m
                      where m.durum in ('aktif','bekliyor') and x.id in (m.oyuncu1, m.oyuncu2))
          or exists (select 1 from public.duellolar d
                      where d.durum = 'aktif' and x.id in (d.oyuncu1, d.oyuncu2))
          or exists (select 1 from public.group_match_players gp
                       join public.group_matches g on g.id = gp.group_match_id
                      where gp.user_id = x.id and g.durum in ('lobi','bekliyor','aktif')
                        and gp.terk_at is null)
          or exists (select 1 from public.hizli_oyuncular ho
                       join public.hizli_maclar h on h.id = ho.hizli_mac_id
                      where ho.user_id = x.id and h.durum in ('lobi','bekliyor','aktif')
                        and ho.terk_at is null)
          or exists (select 1 from public.tournament_players tp
                       join public.tournaments t on t.id = tp.tournament_id
                      where tp.user_id = x.id and t.durum in ('lobi','aktif'))
        )
      order by x.id
      for update of x skip locked
   );
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bot_puan_tik()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_ara int;
  v_puan int;
  v_islenen int := 0;
  v_dk_min int := public.ayar_sayi('bot_puan_mac_dk_min', 55)::int;
  v_dk_max int := public.ayar_sayi('bot_puan_mac_dk_max', 420)::int;
  v_gal numeric := public.ayar_sayi('bot_puan_galibiyet_yuzde', 55)::numeric / 100;
  v_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
begin
  -- Paket 26 E: aynı işin iki kopyası aynı anda çalışmasın. Ölçüldü (17 Eyl 15:00 UTC):
  -- migration uygulanırken fonksiyon derlemesi kilitlenince 2 saniyelik işler birikti ve
  -- 9 koşu 120 sn'lik ifade zaman aşımına düştü. Kilidi alamayan koşu sessizce atlar.
  if not pg_try_advisory_xact_lock(hashtext('bot_puan_tik')) then return 0; end if;
  if v_dk_max < v_dk_min then v_dk_max := v_dk_min; end if;

  -- Yeni botlar tempoya yazılır. Başlangıç anı bota özel geriye kaydırılır
  -- ki ilk tikte hepsi birden puan almasın.
  insert into public.bot_puan_temposu (bot_id, son_mac_at)
  select p.id,
         now() - make_interval(mins => (public.bot_rasgele('puan_baslangic:' || p.id::text)
                                        * v_dk_max)::int)
    from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true)
  on conflict (bot_id) do nothing;

  for r in
    select t.bot_id, t.son_mac_at, p.lig
      from public.bot_puan_temposu t
      join public.profiles p on p.id = t.bot_id
     where p.is_bot and coalesce(p.bot_aktif, true)
  loop
    -- Bota özel sabit tempo: aynı bot hep aynı sıklıkta "oynar".
    v_ara := v_dk_min + (public.bot_rasgele('puan_tempo:' || r.bot_id::text)
                         * (v_dk_max - v_dk_min))::int;
    if now() < r.son_mac_at + make_interval(mins => v_ara) then
      continue;
    end if;

    -- Maçı kazandı mı: maç anına bağlı, aynı tik tekrar çalışsa da aynı.
    v_puan := 0;
    if public.bot_rasgele('puan_sonuc:' || r.bot_id::text || ':'
                          || to_char(r.son_mac_at, 'YYYYMMDDHH24MI')) < v_gal then
      -- Gerçek maçtaki formülün aynısı: galibiyet puanı, bot yüzdesiyle kırpılmış.
      v_puan := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * v_yuzde)::int;
    end if;

    update public.profiles
       set puan = puan + v_puan,
           puan_hafta = puan_hafta + v_puan,
           toplam_mac = coalesce(toplam_mac, 0) + 1
     where id = r.bot_id;

    -- Simüle maç kişiliğe göre kategori istatistiği de üretir (Paket 14, 4.9)
    perform public.bot_mac_istatistik_simule(r.bot_id);

    update public.bot_puan_temposu
       set son_mac_at = r.son_mac_at + make_interval(mins => v_ara),
           mac_sayisi = mac_sayisi + 1
     where bot_id = r.bot_id;

    v_islenen := v_islenen + 1;
  end loop;

  return v_islenen;
end;
$function$;

CREATE OR REPLACE FUNCTION public.duello_tik_hepsi()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  d public.duellolar%rowtype;
  v_bot uuid;
  v_bot_saldiran boolean;
  v_kat text;
  v_cevap smallint;
  v_dogru_cevap smallint;
  v_bas timestamptz;
  v_gecikme double precision;
  v_islenen int := 0;
  v_tur text;
  v_min real;
  v_max real;
begin
  -- Paket 26 E: aynı işin iki kopyası aynı anda çalışmasın. Ölçüldü (17 Eyl 15:00 UTC):
  -- migration uygulanırken fonksiyon derlemesi kilitlenince 2 saniyelik işler birikti ve
  -- 9 koşu 120 sn'lik ifade zaman aşımına düştü. Kilidi alamayan koşu sessizce atlar.
  if not pg_try_advisory_xact_lock(hashtext('duello_tik_hepsi')) then return 0; end if;
  for r in select x.id from public.duellolar x where x.durum = 'aktif' loop
    begin
      select * into d from public.duellolar where id = r.id for update skip locked;
      if not found then continue; end if;
      perform public.duello_ilerlet(r.id);
      select * into d from public.duellolar where id = r.id;
      if d.durum <> 'aktif' then continue; end if;

      select p.id, p.bot_gecikme_min, p.bot_gecikme_max into v_bot, v_min, v_max
        from public.profiles p where p.id in (d.oyuncu1, d.oyuncu2) and coalesce(p.is_bot, false) limit 1;
      if v_bot is null then continue; end if;
      v_bot_saldiran := (d.saldiran = v_bot);

      if d.faz = 'kategori' and v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20));
        if now() >= v_bas + make_interval(secs =>
             public.ayar_ondalik('duello_bot_kategori_min_sn', 2)
             + public.bot_rasgele('dkat:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi)
               * (public.ayar_ondalik('duello_bot_kategori_max_sn', 5) - public.ayar_ondalik('duello_bot_kategori_min_sn', 2))) then
          v_kat := public.duello_bot_kategori(d.id);
          if v_kat is not null then
            perform public.duello_kategori_uygula(d.id, v_kat);
            perform public.duello_sinyal_ver(d.id);
          end if;
        end if;

      elsif d.faz = 'hazirlik' and v_bot_saldiran and not d.zaman_baskisi and not d.savunma_kilidi then
        -- Bir kez zar at (saldırı başına sabit tohum)
        if public.bot_rasgele('djok:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi) * 100
             < public.ayar_sayi('duello_bot_joker_yuzde', 15)
           and (select count(*) from public.joker_kullanimlari k
                 where k.user_id = v_bot and k.mac_tur = 'duello' and k.mac_id = d.id)
               < public.ayar_sayi('duello_saldiri_joker_siniri', 2) then
          v_tur := case when public.bot_rasgele('djt:' || d.id::text || ':' || d.tur) < 0.5
                        then 'zaman_baskisi' else 'savunma_kilidi' end;
          insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
          values (v_bot, 'duello', d.id, d.tur * 2 + d.saldiri_sirasi, v_tur, true);
          update public.duellolar
             set zaman_baskisi = zaman_baskisi or v_tur = 'zaman_baskisi',
                 savunma_kilidi = savunma_kilidi or v_tur = 'savunma_kilidi'
           where id = d.id;
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'cevap' and not v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs =>
                   case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                        else public.ayar_sayi('duello_cevap_sn', 15) end)
                 - case when d.ek_sure then make_interval(secs => public.ayar_sayi('duello_ek_sure_sn', 5)) else interval '0' end;
        v_gecikme := least(
          extract(epoch from (d.faz_bitis - v_bas)) - 0.8,
          public.bot_gecikme_sn(v_bot, 'duello:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          perform public.duello_cozumle(d.id, v_cevap);
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'altin' and not (d.altin_cevaplar ? v_bot::text) then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_altin_sn', 15));
        v_gecikme := least(
          public.ayar_ondalik('duello_altin_sn', 15) - 0.8,
          public.bot_gecikme_sn(v_bot, 'dalt:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          update public.duellolar
             set altin_cevaplar = altin_cevaplar || jsonb_build_object(v_bot::text,
                   jsonb_build_object('cevap', v_cevap, 'dogru', v_cevap = v_dogru_cevap))
           where id = d.id;
          perform public.kategori_istatistik_yaz(v_bot, d.kategori, v_cevap = v_dogru_cevap);
          select * into d from public.duellolar where id = d.id;
          if (d.altin_cevaplar ? d.oyuncu1::text) and (d.altin_cevaplar ? d.oyuncu2::text) then
            perform public.duello_altin_degerlendir(d.id);
          end if;
          perform public.duello_sinyal_ver(d.id);
        end if;
      end if;
      v_islenen := v_islenen + 1;
    exception when others then
      raise warning 'duello_tik_hepsi %: %', r.id, sqlerrm;
    end;
  end loop;

  -- Bota gelen rövanş istekleri: insan gibi gecikmeyle kabul
  for r in
    select x.id, p.id as bot_id, p.bot_turu, x.rovans_at
      from public.duellolar x
      join public.profiles p on p.id in (x.oyuncu1, x.oyuncu2) and coalesce(p.is_bot, false)
     where x.durum = 'bitti' and x.rovans_isteyen is not null and x.rovans_isteyen <> p.id
       and x.rovans_id is null
       and x.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60))
  loop
    begin
      if now() >= r.rovans_at + make_interval(secs => 2 + 4 * public.bot_rasgele('drov:' || r.id::text)) then
        perform public.duello_rovans_baslat(r.id);
      end if;
    exception when others then
      raise warning 'duello rovans %: %', r.id, sqlerrm;
    end;
  end loop;

  return v_islenen;
end $function$;

