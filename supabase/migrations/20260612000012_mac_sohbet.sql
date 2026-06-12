-- ============================================================
-- Maç içi hazır mesajlar (emoji + kalıp cümleler) ve
-- botların ara sıra tepki vermesi
-- ============================================================

create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mesaj text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_match_messages_mac on public.match_messages (match_id, created_at desc);

alter table public.match_messages enable row level security;
revoke all on public.match_messages from authenticated, anon;
drop policy if exists "match_messages_select" on public.match_messages;
create policy "match_messages_select" on public.match_messages for select
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and auth.uid() in (m.oyuncu1, m.oyuncu2)
  ));
grant select on public.match_messages to authenticated;

-- Sadece hazır mesajlar gönderilebilir (küfür/taciz riski yok)
create or replace function public.izinli_mesajlar()
returns text[]
language sql
immutable
as $$
  select array[
    '👍','😂','😮','😡','🔥','😎',
    'İyi şanslar!','Bunu biliyordum!','Şanslıydın! 😏',
    'İyi oyun!','Hadi bakalım!','Vay be! 🤯'
  ];
$$;

create or replace function public.send_match_message(p_match_id uuid, p_mesaj text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if not (p_mesaj = any (public.izinli_mesajlar())) then
    raise exception 'Geçersiz mesaj';
  end if;

  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  -- Hız sınırı: 2 saniyede en fazla 1 mesaj
  if exists (
    select 1 from public.match_messages
    where match_id = p_match_id and user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Biraz yavaş 🙂';
  end if;

  insert into public.match_messages (match_id, user_id, mesaj)
  values (p_match_id, auth.uid(), p_mesaj);
end;
$$;

revoke execute on function public.send_match_message(uuid, text) from public, anon;
grant execute on function public.send_match_message(uuid, text) to authenticated;

-- Realtime yayınına ekle
do $$
begin
  alter publication supabase_realtime add table public.match_messages;
exception when duplicate_object then null;
end $$;

-- ---------- Botlar ara sıra tepki versin ----------

create or replace function public.bot_oyna()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (r.kategori is null or kategori = r.kategori)
                         order by random() limit 20) s),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla (bot isabetine göre, hız puanlı)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and now() >= m.soru_baslangic + interval '3 seconds'
      and now() <= m.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.match_answers a
        where a.match_id = m.id and a.user_id = p.id and a.soru_index = m.aktif_soru
      )
    for update of m skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      if r.oyuncu1 = r.bot_id then
        update public.matches set oyuncu1_skor = oyuncu1_skor + v_puan where id = r.id;
      else
        update public.matches set oyuncu2_skor = oyuncu2_skor + v_puan where id = r.id;
      end if;
    end if;

    -- %15 ihtimalle tepki ver
    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (now() > m.soru_baslangic + interval '16 seconds'
        or 2 <= (select count(*) from public.match_answers a
                 where a.match_id = m.id and a.soru_index = m.aktif_soru))
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      and now() >= t.soru_baslangic + interval '3 seconds'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;
end;
$$;
