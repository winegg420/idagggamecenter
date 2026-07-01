-- ============================================================
-- Geliştirici/kurucu yetkisi: yalnızca işaretli hesap için
-- soru RPC'leri doğru cevabı önceden döndürür (istemci tarafında
-- şık 3 saniye basılı tutulunca otomatik seçilir). Diğer tüm
-- kullanıcılar için bu alan her zaman null döner, davranış değişmez.
-- ============================================================

alter table public.profiles
  add column if not exists hile_yetkisi boolean not null default false;

-- Kullanıcılar kendi hile_yetkisi'ni değiştiremesin (yalnızca username/avatar_url yetkili)
-- (init.sql'deki grant zaten bu kolonu kapsamıyor, ekstra bir şey gerekmiyor)

update public.profiles
   set hile_yetkisi = true
 where id = 'e4f6006f-d6bb-4ca8-be67-3bdf9efc9708';

create or replace function public.hileli_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select hile_yetkisi from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.hileli_mi() from public, anon;
grant execute on function public.hileli_mi() to authenticated;

-- ---------- 1v1 maç sorusu ----------

drop function if exists public.get_match_question(uuid);
create or replace function public.get_match_question(p_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' or m.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, m.aktif_soru, m.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = m.soru_ids[m.aktif_soru + 1];
end;
$$;

-- ---------- Turnuva sorusu ----------

drop function if exists public.get_tournament_question(uuid);
create or replace function public.get_tournament_question(p_tournament_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' or t.aktif_soru < 0 then raise exception 'Turnuva aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, t.aktif_soru, t.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = t.soru_ids[t.aktif_soru + 1];
end;
$$;

-- ---------- Grup maçı sorusu ----------

drop function if exists public.get_group_match_question(uuid);
create or replace function public.get_group_match_question(p_group_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
begin
  select * into gm from public.group_matches where id = p_group_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' or gm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, gm.aktif_soru, gm.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = gm.soru_ids[gm.aktif_soru + 1];
end;
$$;
