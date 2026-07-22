-- ============================================================
-- DRIFTGP (DidaGP · araba yarışı) — IDA GG Game Center'a taşınan tablolar.
-- Orijinal DidaGP şeması (schema.sql) dg_ önekiyle. Kimlik (username/avatar)
-- public.dg_profiles'tan gelir; bu tablolar yalnızca oyuna özgü veriyi tutar.
-- HAYALET (ghost): artık HERKESİN en iyi turu kaydedilir (eski owner-email
-- kısıtı kaldırıldı) — en hızlı tur, sahibinin Bildim adıyla global hayalet olur.
-- Supabase SQL Editor'de bir kez çalıştırın.
-- ============================================================

-- DriftGP Supabase şeması
-- Uygulama: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run

-- Profiller (oyuncu adı, XP, rozetler JSON olarak)
create table if not exists public.dg_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Araç kişiselleştirmeleri
create table if not exists public.dg_customizations (
  user_id uuid not null references auth.users (id) on delete cascade,
  car_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, car_id)
);

-- Yarış sonuçları (geçmiş / istatistik)
create table if not exists public.dg_race_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null,
  car_id text not null,
  position int not null,
  race_time double precision not null,
  best_lap double precision not null,
  drift_score int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.dg_profiles enable row level security;
alter table public.dg_customizations enable row level security;
alter table public.dg_race_results enable row level security;

-- Profiller: herkes okuyabilir (kullanıcı listesi/davet için), sadece sahibi yazabilir
create policy "profiles_select_all" on public.dg_profiles for select using (true);
create policy "profiles_upsert_own" on public.dg_profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.dg_profiles for update using (auth.uid() = id);

-- Kişiselleştirme: sadece sahibi
create policy "customizations_select_own" on public.dg_customizations for select using (auth.uid() = user_id);
create policy "customizations_insert_own" on public.dg_customizations for insert with check (auth.uid() = user_id);
create policy "customizations_update_own" on public.dg_customizations for update using (auth.uid() = user_id);

-- Yarış sonuçları: herkes okuyabilir (liderlik tablosu için), sadece sahibi ekleyebilir
create policy "race_results_select_all" on public.dg_race_results for select using (true);
create policy "race_results_insert_own" on public.dg_race_results for insert with check (auth.uid() = user_id);

-- Realtime yayınları için (oda kanalları broadcast/presence kullanır, tablo gerekmez)

-- Hayalet arabalar (oyun sahibinin pist+tur başına en iyi sürüşü — herkes okur, sadece sahip yazar)
create table if not exists public.dg_ghosts (
  track_id text not null,
  laps int not null,
  name text not null default 'idagg',
  car_id text not null,
  paint_color text,
  race_time double precision not null,
  dt double precision not null default 0.125,
  samples jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (track_id, laps)
);

alter table public.dg_ghosts enable row level security;

-- Herkes hayaleti okur; her authenticated oyuncu (en hizli tur) yazabilir
create policy "ghosts_select_all" on public.dg_ghosts for select using (true);
create policy "ghosts_insert_auth" on public.dg_ghosts for insert to authenticated
  with check (auth.uid() is not null);
create policy "ghosts_update_auth" on public.dg_ghosts for update to authenticated
  using (auth.uid() is not null);
