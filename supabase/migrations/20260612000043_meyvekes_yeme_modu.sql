-- ============================================================
-- MEYVE KES — "Meyve Ye" modu (ağızla yutma) için mod genişletmesi
-- meyvekes_skorlar.mod artık 'yeme' değerini de kabul eder; RPC'lerdeki
-- mod doğrulaması da güncellenir. Mevcut veri etkilenmez.
-- ============================================================

alter table public.meyvekes_skorlar
  drop constraint if exists meyvekes_skorlar_mod_check;

alter table public.meyvekes_skorlar
  add constraint meyvekes_skorlar_mod_check
  check (mod in ('tekli', 'arkadas', 'yeme'));

-- ---------- RPC: skor kaydet (yeme modu eklendi) ----------
create or replace function public.meyvekes_skor_kaydet(
  p_mod text, p_skor int, p_kesim int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('tekli','arkadas','yeme') then raise exception 'Geçersiz mod'; end if;
  -- makul sınırlar (istemciye güvenme)
  if p_skor < 0 or p_skor > 5000 then raise exception 'Geçersiz skor'; end if;
  if p_kesim < 0 or p_kesim > 5000 then p_kesim := 0; end if;

  insert into public.meyvekes_skorlar (user_id, mod, en_iyi, toplam_kesim, oyun_sayisi, updated_at)
  values (auth.uid(), p_mod, greatest(p_skor, 0), greatest(p_kesim, 0), 1, now())
  on conflict (user_id, mod) do update
    set en_iyi = greatest(public.meyvekes_skorlar.en_iyi, excluded.en_iyi),
        toplam_kesim = public.meyvekes_skorlar.toplam_kesim + excluded.toplam_kesim,
        oyun_sayisi = public.meyvekes_skorlar.oyun_sayisi + 1,
        updated_at = now();
end;
$$;

-- ---------- RPC: sıralama (yeme modu eklendi) ----------
create or replace function public.meyvekes_siralama(p_mod text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  en_iyi int,
  oyun_sayisi int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('tekli','arkadas','yeme') then raise exception 'Geçersiz mod'; end if;

  return query
    select s.user_id, p.username, p.avatar_url, s.en_iyi, s.oyun_sayisi
      from public.meyvekes_skorlar s
      join public.profiles p on p.id = s.user_id
     where s.mod = p_mod and s.en_iyi > 0
     order by s.en_iyi desc, s.updated_at asc
     limit 100;
end;
$$;

-- ---------- RPC yetkileri (create or replace sonrası tazele) ----------
revoke execute on function public.meyvekes_skor_kaydet(text, int, int) from public, anon;
grant execute on function public.meyvekes_skor_kaydet(text, int, int) to authenticated;
revoke execute on function public.meyvekes_siralama(text) from public, anon;
grant execute on function public.meyvekes_siralama(text) to authenticated;
