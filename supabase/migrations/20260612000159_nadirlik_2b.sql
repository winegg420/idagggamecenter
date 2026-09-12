-- ============================================================
-- NADİRLİK ÇERÇEVESİ 2B PARÇALARI DA SAYSIN
--
-- Çerçeve rengi oyuncunun giydiği EN YÜKSEK nadirlikteki parçadan gelir.
-- 2B sistemde parçalar `gorunum.kozmetik` altında ANAHTARLA duruyor
-- (hat: "fedora"); katalogdaki karşılığı `k2_<yuva>_<anahtar>`.
-- Eski 3B yuvaları aynen sayılmaya devam ediyor; ikisinin en yükseği alınır.
-- ============================================================
create or replace function public.oyuncu_nadirlikleri(p_idler uuid[])
returns table(id uuid, nadirlik text)
language sql stable security definer set search_path to 'public' as $$
  select
    p.id,
    case greatest(
      -- 3B yuvaları (eski sistem)
      coalesce((
        select max(case e.nadirlik when 'etkinlik' then 3 when 'ozel' then 2 else 1 end)
        from public.esyalar e
        where e.kod in (
          p.gorunum->>'sac',   p.gorunum->>'gozluk', p.gorunum->>'kupe',
          p.gorunum->>'sapka', p.gorunum->>'ust',    p.gorunum->>'alt',
          p.gorunum->>'ayakkabi', p.gorunum->>'efekt')
      ), 1),
      -- 2B kozmetik (yeni sistem): renk alanları atlanır
      coalesce((
        select max(case e.nadirlik when 'etkinlik' then 3 when 'ozel' then 2 else 1 end)
        from jsonb_each_text(coalesce(p.gorunum -> 'kozmetik', '{}'::jsonb)) kv(yuva, deger)
        join public.esyalar e
          on e.sistem = '2b' and e.kod = 'k2_' || kv.yuva || '_' || kv.deger
        where kv.deger is not null and kv.deger <> 'yok' and kv.yuva not like '%Color'
      ), 1))
      when 3 then 'etkinlik'
      when 2 then 'ozel'
      else 'sirali'
    end
    from public.profiles p
   where p.id = any(p_idler);
$$;

grant execute on function public.oyuncu_nadirlikleri(uuid[]) to authenticated;
