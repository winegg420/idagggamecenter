-- ============================================================
-- Grup Maçı'nı 5 kişiye çıkar
-- (mevcut RLS, realtime, puanlama mantığına dokunmadan sadece
--  oyuncu sayısı limitini 3-4'ten 3-4-5'e yükselt)
-- ============================================================

-- ---------- oyuncu_sayisi kısıtını genişlet ----------

alter table public.group_matches
  drop constraint if exists group_matches_oyuncu_sayisi_check;

alter table public.group_matches
  add constraint group_matches_oyuncu_sayisi_check
  check (oyuncu_sayisi in (3, 4, 5));

-- ---------- create_group_challenge: 4 rakibe kadar izin ver ----------

create or replace function public.create_group_challenge(p_rakipler uuid[], p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi not in (2, 3, 4) then
    raise exception 'Grup için 2, 3 veya 4 rakip seçmelisin (toplam 3-5 kişi)';
  end if;
  if auth.uid() = any(p_rakipler) then
    raise exception 'Kendini seçemezsin';
  end if;
  if v_sayi <> (select count(distinct x) from unnest(p_rakipler) x) then
    raise exception 'Aynı oyuncuyu birden fazla seçemezsin';
  end if;
  foreach v_r in array p_rakipler loop
    if not exists (select 1 from public.profiles where id = v_r) then
      raise exception 'Oyuncu bulunamadı';
    end if;
  end loop;

  insert into public.group_matches (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), v_sayi + 1, p_kategori)
  returning id into v_id;

  insert into public.group_match_players (group_match_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.group_match_players (group_match_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.create_group_challenge(uuid[], text) from public, anon;
grant execute on function public.create_group_challenge(uuid[], text) to authenticated;
