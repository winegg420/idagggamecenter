-- ============================================================
-- GÖNDERDİĞİM DAVETLER — "isteğin ne durumda?"
--
-- `bekleyen_davetlerim()` BANA GELEN davetleri veriyordu. Oyuncu birini maça
-- davet edince ana sayfada isteğin durumunu göremiyordu: kabul edildi mi,
-- hâlâ bekleniyor mu belli değildi.
--
-- Bu fonksiyon GÖNDERDİĞİM ve hâlâ cevap bekleyen davetleri döndürür.
-- Bota gönderilenler listelenmez (bot saniyeler içinde kabul eder).
-- ============================================================
create or replace function public.gonderdigim_davetler()
returns table(
  tur text,
  kayit_id uuid,
  rakip uuid,
  gorunen_ad text,
  gorunen_avatar text,
  kategori text,
  bekleyen_sayisi int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  -- 1v1 meydan okuma / rövanş: karşı taraf henüz cevaplamadı
  select
    case when m.rovans then 'rovans' else 'mac' end,
    m.id, m.oyuncu2, p.gorunen_ad, p.gorunen_avatar, m.kategori, 1, m.created_at
  from public.matches m
  join public.profiles p on p.id = m.oyuncu2
  where m.oyuncu1 = auth.uid()
    and m.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  union all

  -- Grup maçı: kurucu benim, hâlâ cevap vermeyen var
  select
    'grup', g.id, null::uuid, null::text, null::text, g.kategori,
    (select count(*)::int from public.group_match_players x
      where x.group_match_id = g.id and x.davet_durumu = 'bekliyor'),
    g.created_at
  from public.group_matches g
  where g.kurucu = auth.uid()
    and g.durum in ('lobi', 'bekliyor')
    and exists (
      select 1 from public.group_match_players gp
      join public.profiles pp on pp.id = gp.user_id
      where gp.group_match_id = g.id
        and gp.davet_durumu = 'bekliyor'
        and not coalesce(pp.is_bot, false)
    )

  union all

  -- Hızlı maç: kurucu benim, hâlâ cevap vermeyen var
  select
    'hizli', h.id, null::uuid, null::text, null::text, h.kategori,
    (select count(*)::int from public.hizli_oyuncular x
      where x.hizli_mac_id = h.id and x.davet_durumu = 'bekliyor'),
    h.created_at
  from public.hizli_maclar h
  where h.kurucu = auth.uid()
    and h.durum in ('lobi', 'bekliyor')
    and exists (
      select 1 from public.hizli_oyuncular ho
      join public.profiles pp on pp.id = ho.user_id
      where ho.hizli_mac_id = h.id
        and ho.davet_durumu = 'bekliyor'
        and not coalesce(pp.is_bot, false)
    )

  order by 8 desc
  limit 20;
$fn$;

grant execute on function public.gonderdigim_davetler() to authenticated;
