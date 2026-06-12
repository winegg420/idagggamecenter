-- ============================================================
-- 1v1 maçlar 5 yerine 10 soru sürsün
-- ============================================================

-- İnsan kabulü: respond_challenge
create or replace function public.respond_challenge(p_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.oyuncu2 <> auth.uid() then raise exception 'Bu meydan okuma sana gelmedi'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu meydan okuma artık beklemede değil'; end if;

  if p_kabul then
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions where aktif order by random() limit 10) q),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_match_id;
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$$;

-- Bot kabulü: bot_oyna içindeki soru seçimi de 10 olsun
create or replace function public.bot_oyna()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot constant uuid := 'b0b00000-0000-4000-8000-000000000001';
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
begin
  -- 1) Bota gelen meydan okumaları kabul et
  for r in
    select id from public.matches
    where oyuncu2 = v_bot and durum = 'bekliyor'
    for update skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions where aktif order by random() limit 10) s),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda sırası gelen soruyu cevapla (%70 isabet, 3 sn insansı gecikme)
  for r in
    select m.* from public.matches m
    where m.durum = 'aktif'
      and v_bot in (m.oyuncu1, m.oyuncu2)
      and now() >= m.soru_baslangic + interval '3 seconds'
      and now() <= m.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.match_answers a
        where a.match_id = m.id and a.user_id = v_bot and a.soru_index = m.aktif_soru
      )
    for update skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < 0.7 then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, v_bot, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      if r.oyuncu1 = v_bot then
        update public.matches set oyuncu1_skor = oyuncu1_skor + 1 where id = r.id;
      else
        update public.matches set oyuncu2_skor = oyuncu2_skor + 1 where id = r.id;
      end if;
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet (iki taraf da cevapladıysa veya süre dolduysa)
  for r in
    select m.id from public.matches m
    where m.durum = 'aktif'
      and v_bot in (m.oyuncu1, m.oyuncu2)
      and (now() > m.soru_baslangic + interval '16 seconds'
        or 2 <= (select count(*) from public.match_answers a
                 where a.match_id = m.id and a.soru_index = m.aktif_soru))
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayattaysa cevapla
  for r in
    select t.* from public.tournaments t
    join public.tournament_players tp
      on tp.tournament_id = t.id and tp.user_id = v_bot and not tp.elendi
    where t.durum = 'aktif'
      and now() >= t.soru_baslangic + interval '3 seconds'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = v_bot and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < 0.7 then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, v_bot, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = v_bot;
    end if;
  end loop;
end;
$$;
