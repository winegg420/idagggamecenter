-- ============================================================
-- Düzeltme: group_matches/group_match_players RLS politikaları
-- birbirini kendi üzerinden sorguladığı için Postgres
-- "infinite recursion detected in policy" (42P17) hatası veriyordu.
-- security definer yardımcı fonksiyon RLS'i tetiklemeden
-- üyeliği kontrol eder, döngü kırılır.
-- ============================================================

create or replace function public.grup_mac_uyesi_mi(p_group_match_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.grup_mac_uyesi_mi(uuid) from public, anon;
grant execute on function public.grup_mac_uyesi_mi(uuid) to authenticated;

drop policy if exists "group_matches_select_own" on public.group_matches;
create policy "group_matches_select_own" on public.group_matches for select
  using (public.grup_mac_uyesi_mi(id));

drop policy if exists "group_match_players_select_own" on public.group_match_players;
create policy "group_match_players_select_own" on public.group_match_players for select
  using (public.grup_mac_uyesi_mi(group_match_id));
