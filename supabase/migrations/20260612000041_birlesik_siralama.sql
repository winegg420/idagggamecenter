-- ============================================================
-- BİRLEŞİK SIRALAMA (IDA GG Game Center) — tüm oyunların skorunu user_id
-- üzerinden birleştiren tablo. Faz 6: profil ikonu bu tabloyu açar.
-- Her oyuncunun oyun bazlı puanı + toplam (basit toplam) döner.
-- NOT: pr_users / dg_profiles / meyvekes_skorlar tablolarını gerektirir →
--      bu migration ilgili oyun migration'larından (39/40/38) SONRA çalıştırılmalı.
-- Skorlar heterojendir (ELO/XP/rekor/puan); "toplam" kaba bir birleşimdir.
-- ============================================================

create or replace function public.birlesik_siralama()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  bildim int,
  kafatopu int,
  meyvekes int,
  patirun int,
  driftgp int,
  toplam int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    coalesce(p.puan, 0)                                             as bildim,
    coalesce(kt.puan, 0)                                           as kafatopu,
    coalesce(mk.en_iyi, 0)                                         as meyvekes,
    coalesce(pr.puan, 0)                                           as patirun,
    coalesce(dg.xp, 0)                                             as driftgp,
    ( coalesce(p.puan, 0) + coalesce(kt.puan, 0) + coalesce(mk.en_iyi, 0)
      + coalesce(pr.puan, 0) + coalesce(dg.xp, 0) )                as toplam
  from public.profiles p
  left join public.kafatopu_profiller kt on kt.user_id = p.id
  left join (
    select user_id, sum(en_iyi)::int as en_iyi
    from public.meyvekes_skorlar
    group by user_id
  ) mk on mk.user_id = p.id
  left join public.pr_users pr on pr.id = p.id
  left join (
    select id, coalesce((data ->> 'xp')::int, 0) as xp
    from public.dg_profiles
  ) dg on dg.id = p.id
  where coalesce(p.is_bot, false) = false
  order by toplam desc, p.username asc
  limit 100;
$$;

revoke all on function public.birlesik_siralama() from public;
grant execute on function public.birlesik_siralama() to authenticated;
