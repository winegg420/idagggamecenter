-- ============================================================
-- Grup Meydan Okuma: 3 veya 4 kişilik meydan okuma
-- (mevcut 1v1 "matches" akışına dokunmadan, tournament_players
--  ile aynı N-oyunculu deseni izleyen ayrı bir tablo seti)
-- ============================================================

-- ---------- Tablolar ----------

create table public.group_matches (
  id uuid primary key default gen_random_uuid(),
  kurucu uuid not null references public.profiles(id) on delete cascade,
  oyuncu_sayisi int not null check (oyuncu_sayisi in (3, 4)),
  durum text not null default 'bekliyor'
    check (durum in ('bekliyor','aktif','bitti','iptal')),
  kategori text,
  soru_ids uuid[] not null default '{}',
  aktif_soru int not null default -1,
  soru_baslangic timestamptz,
  kazanan uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  bitis timestamptz
);

create table public.group_match_players (
  group_match_id uuid not null references public.group_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  davet_durumu text not null default 'bekliyor'
    check (davet_durumu in ('bekliyor','kabul','red')),
  skor int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (group_match_id, user_id)
);

create table public.group_match_answers (
  group_match_id uuid not null references public.group_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  soru_index int not null,
  cevap smallint not null,
  dogru boolean not null,
  created_at timestamptz not null default now(),
  primary key (group_match_id, user_id, soru_index)
);

create index idx_group_matches_durum on public.group_matches (durum);
create index idx_group_match_players_user on public.group_match_players (user_id);

-- ---------- RLS ----------

alter table public.group_matches enable row level security;
alter table public.group_match_players enable row level security;
alter table public.group_match_answers enable row level security;

create policy "group_matches_select_own" on public.group_matches for select
  using (exists (
    select 1 from public.group_match_players gmp
    where gmp.group_match_id = id and gmp.user_id = auth.uid()
  ));

create policy "group_match_players_select_own" on public.group_match_players for select
  using (exists (
    select 1 from public.group_match_players gmp2
    where gmp2.group_match_id = public.group_match_players.group_match_id
      and gmp2.user_id = auth.uid()
  ));

create policy "group_match_answers_select_own" on public.group_match_answers for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.group_matches from authenticated, anon;
revoke insert, update, delete on public.group_match_players from authenticated, anon;
revoke insert, update, delete on public.group_match_answers from authenticated, anon;

-- ---------- Grup kur ----------

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
  if v_sayi not in (2, 3) then
    raise exception 'Grup için 2 veya 3 rakip seçmelisin (toplam 3-4 kişi)';
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

-- ---------- Davete yanıt: herkes kabul edince otomatik başlar ----------

create or replace function public.respond_group_challenge(p_group_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
  gp public.group_match_players%rowtype;
  v_toplam int;
  v_kabul_eden int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Grup maçı bulunamadı'; end if;
  if gm.durum <> 'bekliyor' then raise exception 'Bu davet artık beklemede değil'; end if;

  select * into gp from public.group_match_players
  where group_match_id = p_group_match_id and user_id = auth.uid();
  if not found then raise exception 'Bu davet sana gelmedi'; end if;
  if gp.davet_durumu <> 'bekliyor' then raise exception 'Bu davete zaten yanıt verdin'; end if;

  if not p_kabul then
    update public.group_match_players
       set davet_durumu = 'red'
     where group_match_id = p_group_match_id and user_id = auth.uid();
    -- Biri reddederse grup tamamlanamaz: tüm davet iptal olur
    update public.group_matches set durum = 'iptal' where id = p_group_match_id;
    return;
  end if;

  update public.group_match_players
     set davet_durumu = 'kabul'
   where group_match_id = p_group_match_id and user_id = auth.uid();

  select count(*) into v_toplam from public.group_match_players where group_match_id = p_group_match_id;
  select count(*) into v_kabul_eden from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul';

  if v_kabul_eden = v_toplam then
    update public.group_matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (gm.kategori is null or kategori = gm.kategori)
                         order by random() limit 20) q),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$$;

-- ---------- Soru çek ----------

create or replace function public.get_group_match_question(p_group_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz)
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
    select q.id, q.soru, q.secenekler, gm.aktif_soru, gm.soru_baslangic, now()
    from public.questions q
    where q.id = gm.soru_ids[gm.aktif_soru + 1];
end;
$$;

-- ---------- Cevap gönder: hız puanı (10 + kalan saniyeye göre en çok 15) ----------

create or replace function public.submit_group_match_answer(p_group_match_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > gm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = gm.soru_ids[gm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
  values (p_group_match_id, auth.uid(), gm.aktif_soru, p_cevap, v_dogru);

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (gm.soru_baslangic + interval '16 seconds' - now())))))::int;
    update public.group_match_players
       set skor = skor + v_puan
     where group_match_id = p_group_match_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$$;

-- ---------- İlerlet: herkes cevapladıysa/süre dolduysa; bitişte kazananı belirle ----------

create or replace function public.advance_group_match(p_group_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found or gm.durum <> 'aktif' then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.group_match_players
  where group_match_id = p_group_match_id and davet_durumu = 'kabul';

  select count(*) into v_cevap_sayisi
  from public.group_match_answers
  where group_match_id = p_group_match_id and soru_index = gm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < gm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if gm.aktif_soru + 1 >= coalesce(array_length(gm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul';

    select count(*) into v_kazanan_sayisi
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 then
      select user_id into v_kazanan
      from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and skor = v_en_yuksek;
    else
      v_kazanan := null; -- birden fazla kişi en yüksek skorda: berabere
    end if;

    update public.group_matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_group_match_id;

    if v_kazanan is not null then
      v_odul := 10 * gm.oyuncu_sayisi; -- 3 kişi: +30, 4 kişi: +40
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.group_match_answers
          where group_match_id = p_group_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(gm.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul'
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.group_matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$$;

-- ---------- RPC yetkileri ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_group_challenge(uuid[], text)',
    'respond_group_challenge(uuid, boolean)',
    'get_group_match_question(uuid)',
    'submit_group_match_answer(uuid, smallint)',
    'advance_group_match(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ---------- Realtime ----------

do $$
begin
  alter publication supabase_realtime add table public.group_matches;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_match_players;
exception when duplicate_object then null;
end $$;

-- ---------- Grup daveti geldiğinde bildir ----------

create or replace function public.notify_new_group_challenge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gonderen text;
begin
  if new.davet_durumu = 'bekliyor'
     and not exists (select 1 from public.profiles where id = new.user_id and is_bot)
     and exists (select 1 from public.push_subscriptions where user_id = new.user_id)
  then
    select p.username into v_gonderen
    from public.group_matches gm
    join public.profiles p on p.id = gm.kurucu
    where gm.id = new.group_match_id;

    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(new.user_id),
        'baslik', '👨‍👩‍👧‍👦 Grup meydan okuması!',
        'govde', coalesce(v_gonderen, 'Biri') || ' seni grup maçına davet etti. Kabul ediyor musun?',
        'url', '/meydan'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_group_challenge on public.group_match_players;
create trigger trg_notify_group_challenge
  after insert on public.group_match_players
  for each row execute function public.notify_new_group_challenge();

-- ---------- bot_oyna: grup maçlarını da yönetsin ----------

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

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (r.kategori is null or kategori = r.kategori)
                         order by random() limit 20) s),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif'
      and now() >= gm.soru_baslangic + interval '3 seconds'
      and now() <= gm.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
    for update of gm skip locked
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

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif'
      and (now() > gm.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        ))
  loop
    perform public.advance_group_match(r.id);
  end loop;
end;
$$;
