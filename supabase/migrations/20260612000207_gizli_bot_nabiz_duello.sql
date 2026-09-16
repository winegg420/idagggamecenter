-- ============================================================
-- 207 — gizli_bot_nabiz: düello + kilitlenme (Paket 14, aşama 4)
--
-- · Düellodaki gizli bot da "şu an oyunda" (last_seen) görünür. Görünmeseydi
--   rakip oyuncu kartında çevrimdışı görünür ve bot olduğu anlaşılırdı.
-- · ÖLÇÜLEN: son 7 günde 8 kez `deadlock detected` (gizli_bot_nabiz ↔
--   bot_puan_tik, ikisi de profiles satırlarını farklı sırayla kilitliyor).
--   last_seen güncellemesi kilitli satırı ATLAR (sabit sıra + SKIP LOCKED);
--   atlanan bot bir sonraki dakikada güncellenir.
-- ============================================================

create or replace function public.gizli_bot_nabiz()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
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
$$;
