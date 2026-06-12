-- ============================================================
-- Dalga 2: Jokerler, kategorili maçlar, rozetler
-- ============================================================

-- ---------- Kategorili maçlar ----------

alter table public.matches add column if not exists kategori text;

create or replace function public.get_categories()
returns table (kategori text, soru_sayisi bigint)
language sql
stable
security definer
set search_path = public
as $$
  select kategori, count(*) from public.questions
  where aktif group by kategori having count(*) >= 15 order by count(*) desc;
$$;

-- create_challenge: kategori parametreli yeni sürüm
create or replace function public.create_challenge(p_rakip uuid, p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;

  insert into public.matches (oyuncu1, oyuncu2, kategori)
  values (auth.uid(), p_rakip, p_kategori)
  returning id into v_id;
  return v_id;
end;
$$;

-- Eski tek parametreli imzayı kaldır (yenisi varsayılan parametreyle karşılıyor)
drop function if exists public.create_challenge(uuid);

-- respond_challenge: kategoriye göre soru seç
create or replace function public.respond_challenge(p_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.oyuncu2 <> auth.uid() then raise exception 'Bu meydan okuma sana gelmedi'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu meydan okuma artık beklemede değil'; end if;

  if p_kabul then
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (m.kategori is null or kategori = m.kategori)
                         order by random() limit 20) q),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_match_id;
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$$;

-- ---------- Jokerler ----------

create table if not exists public.match_jokers (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tip text not null check (tip in ('elli', 'sure')),
  soru_index int not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, tip)
);
alter table public.match_jokers enable row level security;
revoke all on public.match_jokers from authenticated, anon;
drop policy if exists "match_jokers_select_own" on public.match_jokers;
create policy "match_jokers_select_own" on public.match_jokers for select
  using (auth.uid() = user_id);
grant select on public.match_jokers to authenticated;

create or replace function public.use_joker(p_match_id uuid, p_tip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_bedel int;
  v_kapali int[];
begin
  if p_tip not in ('elli', 'sure') then raise exception 'Geçersiz joker'; end if;
  v_bedel := case p_tip when 'elli' then 30 else 20 end;

  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > m.soru_baslangic + interval '16 seconds' then raise exception 'Süre doldu'; end if;
  if exists (
    select 1 from public.match_answers
    where match_id = p_match_id and user_id = auth.uid() and soru_index = m.aktif_soru
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  if (select puan from public.profiles where id = auth.uid()) < v_bedel then
    raise exception 'Yetersiz puan (% gerekli)', v_bedel;
  end if;

  insert into public.match_jokers (match_id, user_id, tip, soru_index)
  values (p_match_id, auth.uid(), p_tip, m.aktif_soru);
  -- pk çakışırsa exception fırlar: maç başına her jokerden 1

  update public.profiles set puan = puan - v_bedel where id = auth.uid();

  if p_tip = 'elli' then
    select * into q from public.questions where id = m.soru_ids[m.aktif_soru + 1];
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 2
    ) s;
    return jsonb_build_object('kapali', to_jsonb(v_kapali));
  else
    update public.matches
       set soru_baslangic = soru_baslangic + interval '10 seconds'
     where id = p_match_id;
    return jsonb_build_object('uzatildi', true);
  end if;
end;
$$;

revoke execute on function public.use_joker(uuid, text) from public, anon;
grant execute on function public.use_joker(uuid, text) to authenticated;
revoke execute on function public.get_categories() from public, anon;
grant execute on function public.get_categories() to authenticated;
revoke execute on function public.create_challenge(uuid, text) from public, anon;
grant execute on function public.create_challenge(uuid, text) to authenticated;

-- ---------- Rozetler ----------

create table if not exists public.badges (
  id text primary key,
  ad text not null,
  aciklama text not null,
  ikon text not null
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
drop policy if exists "badges_select" on public.badges;
create policy "badges_select" on public.badges for select using (true);
drop policy if exists "user_badges_select" on public.user_badges;
create policy "user_badges_select" on public.user_badges for select using (true);
revoke insert, update, delete on public.badges from authenticated, anon;
revoke insert, update, delete on public.user_badges from authenticated, anon;

insert into public.badges (id, ad, aciklama, ikon) values
  ('ilk_galibiyet', 'İlk Galibiyet', 'İlk maçını kazandın', '🏅'),
  ('mac_10',        'Galibiyet Avcısı', '10 maç kazandın', '🎖️'),
  ('seri_3',        'Ateşleniyor', '3 gün üst üste oynadın', '🔥'),
  ('seri_7',        'Durdurulamaz', '7 gün üst üste oynadın', '⚡'),
  ('tam_isabet',    'Kusursuz', 'Bir maçta tüm soruları doğru bildin', '💯'),
  ('bot_avcisi',    'Robot Avcısı', 'UstaBot''u yendin', '🤖'),
  ('sampiyon',      'Gece Şampiyonu', 'Gece turnuvasını kazandın', '👑')
on conflict (id) do nothing;

create or replace function public.award_badge(p_user uuid, p_badge text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_badges (user_id, badge_id)
  select p_user, p_badge
  where not exists (select 1 from public.profiles where id = p_user and is_bot)
  on conflict do nothing;
$$;

revoke execute on function public.award_badge(uuid, text) from public, anon, authenticated;

-- ---------- advance_match: rozet kontrolleriyle ----------

create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  select count(*) into v_cevap_sayisi
  from public.match_answers
  where match_id = p_match_id and soru_index = m.aktif_soru;

  if v_cevap_sayisi < 2 and now() < m.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if m.aktif_soru + 1 >= coalesce(array_length(m.soru_ids, 1), 0) then
    select * into m from public.matches where id = p_match_id; -- skorlar güncel
    if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
    elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
    else v_kazanan := null;
    end if;

    update public.matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_match_id;

    if v_kazanan is not null then
      update public.profiles set puan = puan + 20 where id = v_kazanan;

      -- Rozetler
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.matches where kazanan = v_kazanan and durum = 'bitti') >= 10 then
        perform public.award_badge(v_kazanan, 'mac_10');
      end if;
      if v_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
        perform public.award_badge(v_kazanan, 'bot_avcisi');
      end if;
      if (select count(*) from public.match_answers
          where match_id = p_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(m.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    -- Günlük seri: insan oyuncular, günde bir kez (seri * 5 puan, en çok 50)
    foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        update public.profiles
           set seri = v_yeni_seri,
               son_seri_tarihi = v_bugun,
               puan = puan + least(v_yeni_seri * 5, 50)
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_match_id;
  end if;
end;
$$;

-- ---------- advance_tournament: şampiyon rozetiyle ----------

create or replace function public.advance_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;
  if now() < t.soru_baslangic + interval '16 seconds' then return; end if;

  select count(*) into v_elenecek
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id and not tp.elendi
    and not exists (
      select 1 from public.tournament_answers ta
      where ta.tournament_id = p_tournament_id
        and ta.user_id = tp.user_id
        and ta.soru_index = t.aktif_soru
        and ta.dogru
    );

  select count(*) into v_kalan
  from public.tournament_players
  where tournament_id = p_tournament_id and not elendi;

  if v_elenecek < v_kalan then
    update public.tournament_players tp
       set elendi = true, elenme_sorusu = t.aktif_soru
     where tp.tournament_id = p_tournament_id and not tp.elendi
       and not exists (
         select 1 from public.tournament_answers ta
         where ta.tournament_id = p_tournament_id
           and ta.user_id = tp.user_id
           and ta.soru_index = t.aktif_soru
           and ta.dogru
       );
    v_kalan := v_kalan - v_elenecek;
  end if;

  if v_kalan = 1 then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi;
  elsif t.aktif_soru + 1 >= coalesce(array_length(t.soru_ids, 1), 0) then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi
    order by dogru_sayisi desc, joined_at asc
    limit 1;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set puan = puan + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$$;
