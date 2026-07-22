-- ============================================================
-- PATIRUN (pati yarışı) — IDA GG Game Center'a taşınan tablolar/RPC'ler.
-- Orijinal PatiRun şeması (001_schema.sql + 002_avatar.sql) pr_ önekiyle.
-- Kimlik (username/avatar fotoğrafı) public.profiles'tan gelir; bu tablolar
-- yalnızca oyuna özgü veriyi tutar. pr_users.username, profiles.username'in
-- senkron kopyasıdır (leaderboard/arkadaş join'leri için; köprü senkronlar).
-- Supabase SQL Editor'de bir kez çalıştırın.
-- ============================================================

-- YARIŞ OYUNU — tam veritabanı şeması (Supabase SQL Editor'de bir kez çalıştır)
-- Tüm tablolarda RLS aktif.

-- ============ USERS ============
create table if not exists public.pr_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 16),
  avatar_config jsonb not null default '{}'::jsonb,
  puan integer not null default 0,
  rutbe text not null default 'Çaylak',
  total_races integer not null default 0,
  total_wins integer not null default 0,
  last_race_date date,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.pr_users enable row level security;

create policy "users_select_all" on public.pr_users
  for select to authenticated using (true);
create policy "users_insert_self" on public.pr_users
  for insert to authenticated with check (auth.uid() = id);
create policy "users_update_self" on public.pr_users
  for update to authenticated using (auth.uid() = id);

-- ============ FRIENDSHIPS ============
create table if not exists public.pr_friendships (
  id bigint generated always as identity primary key,
  user1 uuid not null references public.pr_users(id) on delete cascade,
  user2 uuid not null references public.pr_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (user1, user2),
  check (user1 <> user2)
);
alter table public.pr_friendships enable row level security;

create policy "friendships_select_own" on public.pr_friendships
  for select to authenticated using (auth.uid() in (user1, user2));
create policy "friendships_insert_own" on public.pr_friendships
  for insert to authenticated with check (auth.uid() = user1);
create policy "friendships_update_own" on public.pr_friendships
  for update to authenticated using (auth.uid() in (user1, user2));
create policy "friendships_delete_own" on public.pr_friendships
  for delete to authenticated using (auth.uid() in (user1, user2));

-- ============ BLOCKS ============
create table if not exists public.pr_blocks (
  blocker_id uuid not null references public.pr_users(id) on delete cascade,
  blocked_id uuid not null references public.pr_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.pr_blocks enable row level security;

create policy "blocks_select_own" on public.pr_blocks
  for select to authenticated using (auth.uid() = blocker_id);
create policy "blocks_insert_own" on public.pr_blocks
  for insert to authenticated with check (auth.uid() = blocker_id);
create policy "blocks_delete_own" on public.pr_blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- ============ ROOMS ============
create table if not exists public.pr_rooms (
  code text primary key check (char_length(code) = 6),
  host_id uuid not null references public.pr_users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','racing','closed')),
  mode text not null default 'ozel' check (mode in ('hizli','ozel')),
  created_at timestamptz not null default now()
);
alter table public.pr_rooms enable row level security;

create policy "rooms_select_all" on public.pr_rooms
  for select to authenticated using (true);
create policy "rooms_insert_own" on public.pr_rooms
  for insert to authenticated with check (auth.uid() = host_id);
create policy "rooms_update_host" on public.pr_rooms
  for update to authenticated using (auth.uid() = host_id);
create policy "rooms_delete_host" on public.pr_rooms
  for delete to authenticated using (auth.uid() = host_id);

-- ============ RACES ============
create table if not exists public.pr_races (
  id bigint generated always as identity primary key,
  harita text not null,
  mod text not null default 'hizli' check (mod in ('hizli','ozel','tekli')),
  room_code text,
  baslangic timestamptz not null default now(),
  bitis timestamptz
);
alter table public.pr_races enable row level security;

create policy "races_select_all" on public.pr_races
  for select to authenticated using (true);
create policy "races_insert_auth" on public.pr_races
  for insert to authenticated with check (true);
create policy "races_update_auth" on public.pr_races
  for update to authenticated using (true);

-- ============ RACE PARTICIPANTS ============
create table if not exists public.pr_race_participants (
  race_id bigint not null references public.pr_races(id) on delete cascade,
  user_id uuid not null references public.pr_users(id) on delete cascade,
  karakter text not null default 'sloth',
  takim smallint not null default 0,
  sira smallint,
  bitis_suresi real,
  puan integer not null default 0,
  primary key (race_id, user_id)
);
alter table public.pr_race_participants enable row level security;

create policy "participants_select_all" on public.pr_race_participants
  for select to authenticated using (true);
create policy "participants_insert_self" on public.pr_race_participants
  for insert to authenticated with check (auth.uid() = user_id);

-- ============ CHARACTER CUSTOMIZATIONS ============
create table if not exists public.pr_character_customizations (
  user_id uuid not null references public.pr_users(id) on delete cascade,
  karakter_id text not null,
  kozmetik_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, karakter_id)
);
alter table public.pr_character_customizations enable row level security;

create policy "customizations_select_all" on public.pr_character_customizations
  for select to authenticated using (true);
create policy "customizations_upsert_self" on public.pr_character_customizations
  for insert to authenticated with check (auth.uid() = user_id);
create policy "customizations_update_self" on public.pr_character_customizations
  for update to authenticated using (auth.uid() = user_id);

-- ============ CHARACTER XP ============
create table if not exists public.pr_character_xp (
  user_id uuid not null references public.pr_users(id) on delete cascade,
  karakter_id text not null,
  xp integer not null default 0,
  seviye integer not null default 1,
  primary key (user_id, karakter_id)
);
alter table public.pr_character_xp enable row level security;

create policy "xp_select_all" on public.pr_character_xp
  for select to authenticated using (true);
create policy "xp_insert_self" on public.pr_character_xp
  for insert to authenticated with check (auth.uid() = user_id);
create policy "xp_update_self" on public.pr_character_xp
  for update to authenticated using (auth.uid() = user_id);

-- ============ BADGES ============
create table if not exists public.pr_badges (
  id text primary key,
  isim text not null,
  aciklama text not null,
  kosul text not null
);
alter table public.pr_badges enable row level security;

create policy "badges_select_all" on public.pr_badges
  for select to authenticated using (true);

-- ============ USER BADGES ============
create table if not exists public.pr_user_badges (
  user_id uuid not null references public.pr_users(id) on delete cascade,
  badge_id text not null references public.pr_badges(id) on delete cascade,
  tarih timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.pr_user_badges enable row level security;

create policy "user_badges_select_all" on public.pr_user_badges
  for select to authenticated using (true);
create policy "user_badges_insert_self" on public.pr_user_badges
  for insert to authenticated with check (auth.uid() = user_id);

-- ============ BEST TIMES (hayalet yarış) ============
create table if not exists public.pr_best_times (
  user_id uuid not null references public.pr_users(id) on delete cascade,
  harita text not null,
  sure real not null,
  ghost_data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, harita)
);
alter table public.pr_best_times enable row level security;

create policy "best_times_select_own" on public.pr_best_times
  for select to authenticated using (auth.uid() = user_id);
create policy "best_times_insert_self" on public.pr_best_times
  for insert to authenticated with check (auth.uid() = user_id);
create policy "best_times_update_self" on public.pr_best_times
  for update to authenticated using (auth.uid() = user_id);

-- ============ ERROR LOGS (minimal) ============
create table if not exists public.pr_error_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  message text not null check (char_length(message) <= 500),
  context text check (char_length(context) <= 200),
  created_at timestamptz not null default now()
);
alter table public.pr_error_logs enable row level security;

create policy "error_logs_insert_auth" on public.pr_error_logs
  for insert to authenticated with check (true);

-- Eski logları şişirmemek için: 7 günden eski logları temizleyen fonksiyon
create or replace function public.pr_cleanup_error_logs() returns void
language sql security definer as $$
  delete from public.pr_error_logs where created_at < now() - interval '7 days';
$$;

-- ============ İSTATİSTİK GÜNCELLEME (puan işleme, atomik) ============
create or replace function public.pr_apply_race_result(
  p_puan integer,
  p_won boolean,
  p_race_date date
) returns void
language plpgsql security definer as $$
begin
  update public.pr_users set
    puan = puan + p_puan,
    total_races = total_races + 1,
    total_wins = total_wins + (case when p_won then 1 else 0 end),
    last_race_date = p_race_date,
    rutbe = case
      when puan + p_puan >= 15000 then 'Efsane'
      when puan + p_puan >= 7000 then 'Şampiyon'
      when puan + p_puan >= 3500 then 'Profesyonel'
      when puan + p_puan >= 1500 then 'Yarı Profesyonel'
      when puan + p_puan >= 500 then 'Amatör'
      else 'Çaylak'
    end
  where id = auth.uid();
end;
$$;
-- Profil avatarı: users tablosuna avatar_id (src/lib/avatars.ts id'lerinden biri)
-- Supabase SQL Editor'de çalıştırın. Kolon yokken de uygulama çalışır (yerel fallback).
alter table public.pr_users add column if not exists avatar_id text;
