-- ============================================================
-- Dalga 1: Günlük seri, hız puanı, hızlı eşleşme, bot kardeşler
-- ============================================================

-- ---------- Profil sütunları ----------

alter table public.profiles
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_isabet real,
  add column if not exists seri int not null default 0,
  add column if not exists son_seri_tarihi date;

-- ---------- Bot kardeşler ----------

update public.profiles
   set is_bot = true, bot_isabet = 0.7
 where id = 'b0b00000-0000-4000-8000-000000000001';

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'caylakbot@bildim.app', now(),
   '{"provider":"bot","providers":["bot"]}', '{"full_name":"CaylakBot"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'ustabot@bildim.app', now(),
   '{"provider":"bot","providers":["bot"]}', '{"full_name":"UstaBot"}', now(), now())
on conflict (id) do nothing;

update public.profiles
   set username = 'ÇaylakBot', is_bot = true, bot_isabet = 0.4,
       avatar_url = 'https://api.dicebear.com/9.x/bottts/svg?seed=CaylakBot'
 where id = 'b0b00000-0000-4000-8000-000000000002' and username <> 'ÇaylakBot';

update public.profiles
   set username = 'UstaBot', is_bot = true, bot_isabet = 0.9,
       avatar_url = 'https://api.dicebear.com/9.x/bottts/svg?seed=UstaBot'
 where id = 'b0b00000-0000-4000-8000-000000000003' and username <> 'UstaBot';

-- ---------- Hız puanı: doğru cevap 10 + kalan saniye ----------

create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > m.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = m.soru_ids[m.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), m.aktif_soru, p_cevap, v_dogru);

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (m.soru_baslangic + interval '16 seconds' - now())))))::int;
    if auth.uid() = m.oyuncu1 then
      update public.matches set oyuncu1_skor = oyuncu1_skor + v_puan where id = p_match_id;
    else
      update public.matches set oyuncu2_skor = oyuncu2_skor + v_puan where id = p_match_id;
    end if;
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$$;

-- ---------- Maç bitince: kazanan +20, insan oyunculara günlük seri ----------

create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  select count(*) into v_cevap_sayisi
  from public.match_answers
  where match_id = p_match_id and soru_index = m.aktif_soru;

  if v_cevap_sayisi < 2 and now() < m.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if m.aktif_soru + 1 >= coalesce(array_length(m.soru_ids, 1), 0) then
    select * into m from public.matches where id = p_match_id; -- skorlar güncel
    if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1;
    elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2;
    else v_kazanan := null;
    end if;

    update public.matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_match_id;

    if v_kazanan is not null then
      update public.profiles set puan = puan + 20 where id = v_kazanan;
    end if;

    -- Günlük seri: insan oyuncular, günde bir kez (seri * 5 puan, en çok 50)
    foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        update public.profiles
           set seri = v_yeni_seri,
               son_seri_tarihi = v_bugun,
               puan = puan + least(v_yeni_seri * 5, 50)
         where id = v_oyuncu;
      end if;
    end loop;
  else
    update public.matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_match_id;
  end if;
end;
$$;

-- ---------- Hızlı eşleşme ----------

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.matchmaking_queue enable row level security;
revoke all on public.matchmaking_queue from authenticated, anon;

create or replace function public.quick_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  -- Devam eden hızlı maçım varsa ona dön
  select m.id into v_id from public.matches m
  join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then return v_id; end if;

  -- Kuyrukta bekleyen gerçek oyuncu var mı? (90 sn tazelik)
  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  select user_id into v_rakip from public.matchmaking_queue
  where user_id <> auth.uid()
  order by created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches (oyuncu1, oyuncu2, durum, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif',
      (select coalesce(array_agg(id), '{}') from
        (select id from public.questions where aktif order by random() limit 20) q),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Kimse yoksa rastgele botla hemen başla
  select id into v_bot from public.profiles where is_bot order by random() limit 1;

  insert into public.matches (oyuncu1, oyuncu2, durum, soru_ids, aktif_soru, soru_baslangic)
  values (
    auth.uid(), v_bot, 'aktif',
    (select coalesce(array_agg(id), '{}') from
      (select id from public.questions where aktif order by random() limit 20) q),
    0, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.quick_match() from public, anon;
grant execute on function public.quick_match() to authenticated;

-- ---------- bot_oyna: çoklu bot + hız puanı ----------

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
begin
  -- 1) Botlara gelen meydan okumaları kabul et
  for r in
    select m.id from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions where aktif order by random() limit 20) s),
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
end;
$$;
