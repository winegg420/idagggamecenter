-- ============================================================
-- Bildim! — Türkçe bilgi yarışması: şema + oyun mantığı
-- ============================================================

-- ---------- Yardımcılar ----------

-- Puana göre rütbe
create or replace function public.rutbe(p_puan int)
returns text
language sql
immutable
as $$
  select case
    when p_puan >= 5000 then 'Efsane'
    when p_puan >= 1500 then 'Kahin'
    when p_puan >= 500  then 'Üstat'
    when p_puan >= 100  then 'Bilge'
    else 'Çaylak'
  end;
$$;

-- Bir sonraki turnuvanın tarihi (İstanbul saatiyle 22:00 öncesi: bugün, sonrası: yarın)
create or replace function public.sonraki_turnuva_tarihi()
returns date
language sql
stable
as $$
  select case
    when (now() at time zone 'Europe/Istanbul')::time < time '22:00'
      then (now() at time zone 'Europe/Istanbul')::date
    else (now() at time zone 'Europe/Istanbul')::date + 1
  end;
$$;

-- ---------- Tablolar ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  puan int not null default 0,
  sampiyonluk int not null default 0,
  provider text,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  soru text not null unique,
  secenekler jsonb not null,           -- ["A","B","C","D"]
  dogru_cevap smallint not null check (dogru_cevap between 0 and 3),
  kategori text not null default 'genel',
  adil_oy int not null default 0,
  toplam_oy int not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.question_votes (
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  adil boolean not null,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  oyuncu1 uuid not null references public.profiles(id) on delete cascade,
  oyuncu2 uuid not null references public.profiles(id) on delete cascade,
  durum text not null default 'bekliyor'
    check (durum in ('bekliyor','aktif','bitti','reddedildi','iptal')),
  soru_ids uuid[] not null default '{}',
  aktif_soru int not null default -1,
  soru_baslangic timestamptz,
  oyuncu1_skor int not null default 0,
  oyuncu2_skor int not null default 0,
  kazanan uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  bitis timestamptz,
  check (oyuncu1 <> oyuncu2)
);

create table public.match_answers (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  soru_index int not null,
  cevap smallint not null,
  dogru boolean not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, soru_index)
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  tarih date not null unique,
  durum text not null default 'lobi'
    check (durum in ('lobi','aktif','bitti','iptal')),
  soru_ids uuid[] not null default '{}',
  aktif_soru int not null default -1,
  soru_baslangic timestamptz,
  kazanan uuid references public.profiles(id),
  baslangic timestamptz,
  bitis timestamptz,
  created_at timestamptz not null default now()
);

create table public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  elendi boolean not null default false,
  elenme_sorusu int,
  dogru_sayisi int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table public.tournament_answers (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  soru_index int not null,
  cevap smallint not null,
  dogru boolean not null,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id, soru_index)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','arkadas')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);

create index idx_profiles_puan on public.profiles (puan desc);
create index idx_matches_oyuncu1 on public.matches (oyuncu1);
create index idx_matches_oyuncu2 on public.matches (oyuncu2);
create index idx_questions_aktif on public.questions (aktif) where aktif;
create index idx_friendships_addressee on public.friendships (addressee);

-- ---------- Yeni kullanıcı -> profil ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
begin
  base := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, 'oyuncu'), '@', 1)
  );
  base := regexp_replace(lower(base), '[^a-z0-9_çğıöşü]', '', 'g');
  if base = '' or base is null then base := 'oyuncu'; end if;
  insert into public.profiles (id, username, avatar_url, provider)
  values (
    new.id,
    left(base, 20) || '_' || substr(md5(random()::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_app_meta_data->>'provider'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_votes enable row level security;
alter table public.matches enable row level security;
alter table public.match_answers enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_answers enable row level security;
alter table public.friendships enable row level security;

-- Profiller: herkes okur, sahibi sadece username/avatar günceller
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar_url) on public.profiles to authenticated;

-- Sorular: istemciden DOĞRUDAN ERİŞİM YOK (cevap sızmasın) — sadece RPC
revoke all on public.questions from authenticated, anon;
revoke all on public.question_votes from authenticated, anon;

-- Maçlar: sadece taraflar görür
create policy "matches_select_own" on public.matches for select
  using (auth.uid() = oyuncu1 or auth.uid() = oyuncu2);

create policy "match_answers_select_own" on public.match_answers for select
  using (auth.uid() = user_id);

-- Turnuvalar: herkes izleyebilir
create policy "tournaments_select" on public.tournaments for select using (true);
create policy "tournament_players_select" on public.tournament_players for select using (true);
create policy "tournament_answers_select_own" on public.tournament_answers for select
  using (auth.uid() = user_id);

-- Arkadaşlık: taraflar görür
create policy "friendships_select_own" on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);

-- Tüm yazma işlemleri security definer RPC üzerinden:
revoke insert, update, delete on public.matches from authenticated, anon;
revoke insert, update, delete on public.match_answers from authenticated, anon;
revoke insert, update, delete on public.tournaments from authenticated, anon;
revoke insert, update, delete on public.tournament_players from authenticated, anon;
revoke insert, update, delete on public.tournament_answers from authenticated, anon;
revoke insert, update, delete on public.friendships from authenticated, anon;

-- ---------- Soru oylama ----------

create or replace function public.vote_question(p_question_id uuid, p_adil boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adil int; v_toplam int;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  insert into public.question_votes (question_id, user_id, adil)
  values (p_question_id, auth.uid(), p_adil)
  on conflict (question_id, user_id) do update set adil = excluded.adil;

  select count(*) filter (where adil), count(*)
    into v_adil, v_toplam
  from public.question_votes where question_id = p_question_id;

  update public.questions
     set adil_oy = v_adil,
         toplam_oy = v_toplam,
         -- Eşik: en az 5 oy ve adil oranı %35'in altındaysa soru kaldırılır
         aktif = not (v_toplam >= 5 and v_adil::float / v_toplam < 0.35)
   where id = p_question_id;
end;
$$;

-- ---------- Meydan okuma (1v1) ----------

create or replace function public.create_challenge(p_rakip uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;

  insert into public.matches (oyuncu1, oyuncu2)
  values (auth.uid(), p_rakip)
  returning id into v_id;
  return v_id;
end;
$$;

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
                        (select id from public.questions where aktif order by random() limit 5) q),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_match_id;
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$$;

create or replace function public.get_match_question(p_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' or m.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, m.aktif_soru, m.soru_baslangic, now()
    from public.questions q
    where q.id = m.soru_ids[m.aktif_soru + 1];
end;
$$;

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
    if auth.uid() = m.oyuncu1 then
      update public.matches set oyuncu1_skor = oyuncu1_skor + 1 where id = p_match_id;
    else
      update public.matches set oyuncu2_skor = oyuncu2_skor + 1 where id = p_match_id;
    end if;
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$$;

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
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  select count(*) into v_cevap_sayisi
  from public.match_answers
  where match_id = p_match_id and soru_index = m.aktif_soru;

  -- İki oyuncu da cevapladıysa veya süre dolduysa ilerle
  if v_cevap_sayisi < 2 and now() < m.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if m.aktif_soru + 1 >= coalesce(array_length(m.soru_ids, 1), 0) then
    -- Maç bitti
    select * into m from public.matches where id = p_match_id; -- skorlar güncel
    if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1;
    elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2;
    else v_kazanan := null; -- berabere
    end if;

    update public.matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_match_id;

    if v_kazanan is not null then
      update public.profiles set puan = puan + 20 where id = v_kazanan;
    end if;
  else
    update public.matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_match_id;
  end if;
end;
$$;

-- ---------- Turnuva ----------

create or replace function public.join_tournament_lobby()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarih date := public.sonraki_turnuva_tarihi();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  insert into public.tournaments (tarih)
  values (v_tarih)
  on conflict (tarih) do nothing;

  select id into v_id from public.tournaments where tarih = v_tarih;

  if (select durum from public.tournaments where id = v_id) <> 'lobi' then
    raise exception 'Turnuva lobisi kapalı';
  end if;

  insert into public.tournament_players (tournament_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.leave_tournament_lobby()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tournament_players tp
  using public.tournaments t
  where tp.tournament_id = t.id
    and tp.user_id = auth.uid()
    and t.durum = 'lobi';
end;
$$;

-- pg_cron 19:00 UTC'de (22:00 TSİ) çağırır
create or replace function public.start_tournament()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_oyuncu int;
begin
  select * into t
  from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date and durum = 'lobi'
  for update;
  if not found then return; end if;

  select count(*) into v_oyuncu from public.tournament_players where tournament_id = t.id;

  if v_oyuncu < 2 then
    update public.tournaments set durum = 'iptal', bitis = now() where id = t.id;
    return;
  end if;

  update public.tournaments
     set durum = 'aktif',
         soru_ids = (select coalesce(array_agg(id), '{}') from
                      (select id from public.questions where aktif order by random() limit 30) q),
         aktif_soru = 0,
         baslangic = now(),
         soru_baslangic = now()
   where id = t.id;
end;
$$;

create or replace function public.get_tournament_question(p_tournament_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' or t.aktif_soru < 0 then raise exception 'Turnuva aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, t.aktif_soru, t.soru_baslangic, now()
    from public.questions q
    where q.id = t.soru_ids[t.aktif_soru + 1];
end;
$$;

create or replace function public.submit_tournament_answer(p_tournament_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  q public.questions%rowtype;
  p public.tournament_players%rowtype;
  v_dogru boolean;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;

  select * into p from public.tournament_players
  where tournament_id = p_tournament_id and user_id = auth.uid();
  if not found then raise exception 'Turnuvada değilsin'; end if;
  if p.elendi then raise exception 'Elendin'; end if;

  if now() > t.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = t.soru_ids[t.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
  values (p_tournament_id, auth.uid(), t.aktif_soru, p_cevap, v_dogru);

  if v_dogru then
    update public.tournament_players
       set dogru_sayisi = dogru_sayisi + 1
     where tournament_id = p_tournament_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$$;

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
  if now() < t.soru_baslangic + interval '16 seconds' then return; end if;

  -- Bu soruda doğru cevabı OLMAYAN hayattaki oyuncular elenir
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

  -- Herkes yanlışsa kimse elenmez (tur tekrarı), aksi halde ele
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
    -- Sorular bitti: en çok doğrusu olan kazanır
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
       set puan = puan + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$$;

-- Cron güvencesi: takılı kalmış aktif turnuvaları ilerlet
create or replace function public.advance_due_tournaments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.tournaments
    where durum = 'aktif' and now() > soru_baslangic + interval '16 seconds'
  loop
    perform public.advance_tournament(r.id);
  end loop;
end;
$$;

-- ---------- Arkadaşlık ----------

create or replace function public.send_friend_request(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ters uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_target = auth.uid() then raise exception 'Kendini ekleyemezsin'; end if;

  -- Karşı taraf zaten istek gönderdiyse direkt arkadaş yap
  select id into v_ters from public.friendships
  where requester = p_target and addressee = auth.uid();
  if found then
    update public.friendships set durum = 'arkadas' where id = v_ters;
    return;
  end if;

  insert into public.friendships (requester, addressee)
  values (auth.uid(), p_target)
  on conflict (requester, addressee) do nothing;
end;
$$;

create or replace function public.respond_friend_request(p_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.friendships%rowtype;
begin
  select * into f from public.friendships where id = p_id for update;
  if not found then raise exception 'İstek bulunamadı'; end if;
  if f.addressee <> auth.uid() then raise exception 'Bu istek sana gelmedi'; end if;
  if f.durum <> 'bekliyor' then return; end if;

  if p_kabul then
    update public.friendships set durum = 'arkadas' where id = p_id;
  else
    delete from public.friendships where id = p_id;
  end if;
end;
$$;

create or replace function public.remove_friend(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where id = p_id and (requester = auth.uid() or addressee = auth.uid());
end;
$$;

-- ---------- RPC yetkileri ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'vote_question(uuid, boolean)',
    'create_challenge(uuid)',
    'respond_challenge(uuid, boolean)',
    'get_match_question(uuid)',
    'submit_match_answer(uuid, smallint)',
    'advance_match(uuid)',
    'join_tournament_lobby()',
    'leave_tournament_lobby()',
    'get_tournament_question(uuid)',
    'submit_tournament_answer(uuid, smallint)',
    'advance_tournament(uuid)',
    'send_friend_request(uuid)',
    'respond_friend_request(uuid, boolean)',
    'remove_friend(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  -- Sadece cron/sunucu çağırır:
  revoke execute on function public.start_tournament() from public, anon, authenticated;
  revoke execute on function public.advance_due_tournaments() from public, anon, authenticated;
end $$;

-- ---------- Realtime ----------

alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.tournament_players;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.friendships;

-- ---------- pg_cron: her gece 22:00 TSİ (19:00 UTC) ----------

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('bildim-turnuva-baslat', '0 19 * * *', 'select public.start_tournament()');
  perform cron.schedule('bildim-turnuva-ilerlet', '* * * * *', 'select public.advance_due_tournaments()');
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;
