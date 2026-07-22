-- ============================================================
-- GÖRÜNÜRLÜK KURALI (Faz 5) — oyuncu arama / liste ekranları.
--  - Admin (hile_yetkisi / founder) TÜM kullanıcıları görebilir.
--  - Normal oyuncular birbirini SADECE ikisi de o an ONLINE ise görebilir.
--  - Bu kural yalnızca ARAMA/LİSTE ekranlarını kapsar; sıralama/leaderboard
--    HERKESE AÇIK kalır (profiles select RLS'i değiştirilmez).
-- Online = son 2 dakikada kalp_at() ile yenilenmiş last_seen.
-- ============================================================

-- 1) Online takibi: profiles.last_seen
alter table public.profiles
  add column if not exists last_seen timestamptz not null default now();

create index if not exists profiles_last_seen_idx on public.profiles (last_seen);

-- 2) Kalp atışı — çağıran kendi last_seen'ini tazeler (istemci ~60 sn'de bir çağırır)
create or replace function public.kalp_at()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

revoke execute on function public.kalp_at() from public, anon;
grant execute on function public.kalp_at() to authenticated;

-- 3) Oyuncu arama — admin hepsini, normal oyuncu yalnız online olanları görür.
--    (Arkadaş arama / oyuncu listesi ekranları bu RPC'yi kullanır.)
create or replace function public.oyuncu_ara(p_arama text)
returns table (id uuid, username text, avatar_url text, puan int, online boolean)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    p.puan,
    (p.last_seen > now() - interval '2 minutes') as online
  from public.profiles p
  where p.id <> auth.uid()
    and coalesce(p.is_bot, false) = false
    and length(coalesce(p_arama, '')) >= 2
    and p.username ilike '%' || p_arama || '%'
    and (
      public.hileli_mi()                                   -- admin: herkesi görür
      or p.last_seen > now() - interval '2 minutes'        -- normal: yalnız online
    )
  order by (p.last_seen > now() - interval '2 minutes') desc, p.username asc
  limit 20;
$$;

revoke execute on function public.oyuncu_ara(text) from public, anon;
grant execute on function public.oyuncu_ara(text) to authenticated;
