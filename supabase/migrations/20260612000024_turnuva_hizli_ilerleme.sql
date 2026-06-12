-- ============================================================
-- Turnuva ilerleme düzeltmesi:
-- 1) Hayattaki herkes cevapladıysa 16 sn beklemeden ilerle
-- 2) bot_oyna (7 sn'de bir) turnuvaları da ilerletsin
-- ============================================================

create or replace function public.advance_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;

  -- Süre dolmadıysa: hayatta olup henüz cevaplamayan varsa bekle
  if now() < t.soru_baslangic + interval '16 seconds' then
    if exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = p_tournament_id and not tp.elendi
        and not exists (
          select 1 from public.tournament_answers ta
          where ta.tournament_id = p_tournament_id
            and ta.user_id = tp.user_id
            and ta.soru_index = t.aktif_soru
        )
    ) then
      return;
    end if;
  end if;

  select count(*) into v_elenecek
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id and not tp.elendi
    and not exists (
      select 1 from public.tournament_answers ta
      where ta.tournament_id = p_tournament_id
        and ta.user_id = tp.user_id
        and ta.soru_index = t.aktif_soru
        and ta.dogru
    );

  select count(*) into v_kalan
  from public.tournament_players
  where tournament_id = p_tournament_id and not elendi;

  if v_elenecek < v_kalan then
    update public.tournament_players tp
       set elendi = true, elenme_sorusu = t.aktif_soru
     where tp.tournament_id = p_tournament_id and not tp.elendi
       and not exists (
         select 1 from public.tournament_answers ta
         where ta.tournament_id = p_tournament_id
           and ta.user_id = tp.user_id
           and ta.soru_index = t.aktif_soru
           and ta.dogru
       );
    v_kalan := v_kalan - v_elenecek;
  end if;

  if v_kalan = 1 then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi;
  elsif t.aktif_soru + 1 >= coalesce(array_length(t.soru_ids, 1), 0) then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi
    order by dogru_sayisi desc, joined_at asc
    limit 1;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set puan = puan + 250, puan_hafta = puan_hafta + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$$;

-- bot_oyna: 5. adım olarak turnuva ilerletme eklendi
create or replace function public.bot_oyna()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (r.kategori is null or kategori = r.kategori)
                         order by random() limit 20) s),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla (bot isabetine göre, hız puanlı)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and now() >= m.soru_baslangic + interval '3 seconds'
      and now() <= m.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.match_answers a
        where a.match_id = m.id and a.user_id = p.id and a.soru_index = m.aktif_soru
      )
    for update of m skip locked
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

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      if r.oyuncu1 = r.bot_id then
        update public.matches set oyuncu1_skor = oyuncu1_skor + v_puan where id = r.id;
      else
        update public.matches set oyuncu2_skor = oyuncu2_skor + v_puan where id = r.id;
      end if;
    end if;

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (now() > m.soru_baslangic + interval '16 seconds'
        or 2 <= (select count(*) from public.match_answers a
                 where a.match_id = m.id and a.soru_index = m.aktif_soru))
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
end;
$$;
