-- ============================================================
-- Grup maçlarına 1v1 ile eşitlik:
--  - canlı sohbet (emoji + kalıp mesajlar, balonlar)
--  - jokerler (50:50 ücretsiz, +10 sn 20 puan)
--  - botlar grup maçında da ara sıra tepki versin
-- ============================================================

-- ---------- Sohbet: group_match_messages ----------

create table if not exists public.group_match_messages (
  id uuid primary key default gen_random_uuid(),
  group_match_id uuid not null references public.group_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mesaj text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_group_match_messages_mac
  on public.group_match_messages (group_match_id, created_at desc);

alter table public.group_match_messages enable row level security;
revoke all on public.group_match_messages from authenticated, anon;
drop policy if exists "group_match_messages_select" on public.group_match_messages;
create policy "group_match_messages_select" on public.group_match_messages for select
  using (exists (
    select 1 from public.group_match_players gmp
    where gmp.group_match_id = public.group_match_messages.group_match_id
      and gmp.user_id = auth.uid()
  ));
grant select on public.group_match_messages to authenticated;

create or replace function public.send_group_match_message(p_group_match_id uuid, p_mesaj text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if not (p_mesaj = any (public.izinli_mesajlar())) then
    raise exception 'Geçersiz mesaj';
  end if;

  select * into gm from public.group_matches where id = p_group_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  -- Hız sınırı: 2 saniyede en fazla 1 mesaj
  if exists (
    select 1 from public.group_match_messages
    where group_match_id = p_group_match_id and user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Biraz yavaş 🙂';
  end if;

  insert into public.group_match_messages (group_match_id, user_id, mesaj)
  values (p_group_match_id, auth.uid(), p_mesaj);
end;
$$;

revoke execute on function public.send_group_match_message(uuid, text) from public, anon;
grant execute on function public.send_group_match_message(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.group_match_messages;
exception when duplicate_object then null;
end $$;

-- ---------- Jokerler: group_match_jokers ----------

create table if not exists public.group_match_jokers (
  group_match_id uuid not null references public.group_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tip text not null check (tip in ('elli', 'sure')),
  soru_index int not null,
  created_at timestamptz not null default now(),
  primary key (group_match_id, user_id, tip)
);
alter table public.group_match_jokers enable row level security;
revoke all on public.group_match_jokers from authenticated, anon;
drop policy if exists "group_match_jokers_select_own" on public.group_match_jokers;
create policy "group_match_jokers_select_own" on public.group_match_jokers for select
  using (auth.uid() = user_id);
grant select on public.group_match_jokers to authenticated;

-- 1v1 ile aynı kurallar: 50:50 ücretsiz (maç başına 1), +10 sn 20 puan
create or replace function public.use_group_joker(p_group_match_id uuid, p_tip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
  q public.questions%rowtype;
  v_bedel int;
  v_kapali int[];
begin
  if p_tip not in ('elli', 'sure') then raise exception 'Geçersiz joker'; end if;
  v_bedel := case p_tip when 'elli' then 0 else 20 end;

  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > gm.soru_baslangic + interval '16 seconds' then raise exception 'Süre doldu'; end if;
  if exists (
    select 1 from public.group_match_answers
    where group_match_id = p_group_match_id and user_id = auth.uid() and soru_index = gm.aktif_soru
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  if v_bedel > 0 and (select puan from public.profiles where id = auth.uid()) < v_bedel then
    raise exception 'Yetersiz puan (% gerekli)', v_bedel;
  end if;

  insert into public.group_match_jokers (group_match_id, user_id, tip, soru_index)
  values (p_group_match_id, auth.uid(), p_tip, gm.aktif_soru);
  -- pk çakışırsa exception fırlar: maç başına her jokerden 1

  if v_bedel > 0 then
    update public.profiles set puan = puan - v_bedel where id = auth.uid();
  end if;

  if p_tip = 'elli' then
    select * into q from public.questions where id = gm.soru_ids[gm.aktif_soru + 1];
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 2
    ) s;
    return jsonb_build_object('kapali', to_jsonb(v_kapali));
  else
    update public.group_matches
       set soru_baslangic = soru_baslangic + interval '10 seconds'
     where id = p_group_match_id;
    return jsonb_build_object('uzatildi', true);
  end if;
end;
$$;

revoke execute on function public.use_group_joker(uuid, text) from public, anon;
grant execute on function public.use_group_joker(uuid, text) to authenticated;

-- ---------- bot_oyna: grup maçlarında da tepki versin ----------
-- (20260612000025'teki gövdenin aynısı; tek fark 8. bölümde botların
--  %15 ihtimalle group_match_messages'a tepki yazması)

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
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (r.kategori is null or kategori = r.kategori)
                         order by random() limit 20) s),
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
      and now() >= gm.soru_baslangic + interval '3 seconds'
      and now() <= gm.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
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
      and (now() > gm.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        ))
  loop
    perform public.advance_group_match(r.id);
  end loop;
end;
$$;
