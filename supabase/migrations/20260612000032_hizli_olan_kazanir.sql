-- ============================================================
-- Yeni mod: "Hızlı Olan Kazanır"
--  - Sabit 5 kişi
--  - Herkese aynı soru aynı anda; sadece o soruya İLK doğru cevabı
--    veren oyuncu puan alır (yarış durumu DB'de row-lock ile çözülür)
--  - Joker YOK, sohbet YOK
--  - Grup Maçı deseninin kopyası; ayrı tablo/fonksiyon seti
-- ============================================================

-- ---------- Tablolar ----------

create table public.hizli_maclar (
  id uuid primary key default gen_random_uuid(),
  kurucu uuid not null references public.profiles(id) on delete cascade,
  oyuncu_sayisi int not null default 5 check (oyuncu_sayisi = 5),
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

create table public.hizli_oyuncular (
  hizli_mac_id uuid not null references public.hizli_maclar(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  davet_durumu text not null default 'bekliyor'
    check (davet_durumu in ('bekliyor','kabul','red')),
  skor int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (hizli_mac_id, user_id)
);

create table public.hizli_cevaplar (
  hizli_mac_id uuid not null references public.hizli_maclar(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  soru_index int not null,
  cevap smallint not null,
  dogru boolean not null,
  created_at timestamptz not null default now(),
  primary key (hizli_mac_id, user_id, soru_index)
);

create index idx_hizli_maclar_durum on public.hizli_maclar (durum);
create index idx_hizli_oyuncular_user on public.hizli_oyuncular (user_id);
-- İlk doğru cevap kontrolü için hızlandırıcı
create index idx_hizli_cevaplar_dogru
  on public.hizli_cevaplar (hizli_mac_id, soru_index) where dogru;

-- ---------- RLS ----------

alter table public.hizli_maclar enable row level security;
alter table public.hizli_oyuncular enable row level security;
alter table public.hizli_cevaplar enable row level security;

create policy "hizli_maclar_select_own" on public.hizli_maclar for select
  using (exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = id and ho.user_id = auth.uid()
  ));

create policy "hizli_oyuncular_select_own" on public.hizli_oyuncular for select
  using (exists (
    select 1 from public.hizli_oyuncular ho2
    where ho2.hizli_mac_id = public.hizli_oyuncular.hizli_mac_id
      and ho2.user_id = auth.uid()
  ));

create policy "hizli_cevaplar_select_own" on public.hizli_cevaplar for select
  using (exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = public.hizli_cevaplar.hizli_mac_id
      and ho.user_id = auth.uid()
  ));

revoke insert, update, delete on public.hizli_maclar from authenticated, anon;
revoke insert, update, delete on public.hizli_oyuncular from authenticated, anon;
revoke insert, update, delete on public.hizli_cevaplar from authenticated, anon;

-- ---------- Maç kur (4 rakip + kurucu = 5 kişi) ----------

create or replace function public.create_hizli_mac(p_rakipler uuid[], p_kategori text default null)
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
  if v_sayi <> 4 then
    raise exception 'Hızlı mod için tam 4 rakip seçmelisin (toplam 5 kişi)';
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

  insert into public.hizli_maclar (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), 5, p_kategori)
  returning id into v_id;

  insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$$;

-- ---------- Davete yanıt: herkes kabul edince otomatik başlar ----------

create or replace function public.respond_hizli_davet(p_hizli_mac_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
  hp public.hizli_oyuncular%rowtype;
  v_toplam int;
  v_kabul_eden int;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Hızlı maç bulunamadı'; end if;
  if hm.durum <> 'bekliyor' then raise exception 'Bu davet artık beklemede değil'; end if;

  select * into hp from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();
  if not found then raise exception 'Bu davet sana gelmedi'; end if;
  if hp.davet_durumu <> 'bekliyor' then raise exception 'Bu davete zaten yanıt verdin'; end if;

  if not p_kabul then
    update public.hizli_oyuncular
       set davet_durumu = 'red'
     where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();
    update public.hizli_maclar set durum = 'iptal' where id = p_hizli_mac_id;
    return;
  end if;

  update public.hizli_oyuncular
     set davet_durumu = 'kabul'
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  select count(*) into v_toplam from public.hizli_oyuncular where hizli_mac_id = p_hizli_mac_id;
  select count(*) into v_kabul_eden from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul';

  if v_kabul_eden = v_toplam then
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (hm.kategori is null or kategori = hm.kategori)
                         order by random() limit 20) q),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$$;

-- ---------- Soru çek ----------

create or replace function public.get_hizli_soru(p_hizli_mac_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' or hm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  return query
    select q.id, q.soru, q.secenekler, hm.aktif_soru, hm.soru_baslangic, now()
    from public.questions q
    where q.id = hm.soru_ids[hm.aktif_soru + 1];
end;
$$;

-- ---------- Cevap gönder: SADECE ilk doğru cevap puan alır ----------
-- Yarış durumu: hizli_maclar satırı FOR UPDATE ile kilitlenir; o soru
-- index'ine daha önce doğru cevap girilmişse puan verilmez.

create or replace function public.submit_hizli_cevap(p_hizli_mac_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint, ilk boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_ilk boolean := false;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > hm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = hm.soru_ids[hm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  -- İlk doğru mu? (satır kilidi altında kontrol edilir)
  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar
      where hizli_mac_id = p_hizli_mac_id and soru_index = hm.aktif_soru and dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  if v_ilk then
    update public.hizli_oyuncular
       set skor = skor + 10
     where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$$;

-- ---------- İlerlet: herkes cevapladıysa/süre dolduysa ----------

create or replace function public.advance_hizli_mac(p_hizli_mac_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
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
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found or hm.durum <> 'aktif' then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul';

  select count(*) into v_cevap_sayisi
  from public.hizli_cevaplar
  where hizli_mac_id = p_hizli_mac_id and soru_index = hm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < hm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if hm.aktif_soru + 1 >= coalesce(array_length(hm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul';

    select count(*) into v_kazanan_sayisi
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 and v_en_yuksek > 0 then
      select user_id into v_kazanan
      from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and skor = v_en_yuksek;
    else
      v_kazanan := null; -- berabere veya kimse puan almadı
    end if;

    update public.hizli_maclar
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_hizli_mac_id;

    if v_kazanan is not null then
      v_odul := 50; -- 5 kişilik yarış galibi
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul'
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
    update public.hizli_maclar
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$$;

-- ---------- RPC yetkileri ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_hizli_mac(uuid[], text)',
    'respond_hizli_davet(uuid, boolean)',
    'get_hizli_soru(uuid)',
    'submit_hizli_cevap(uuid, smallint)',
    'advance_hizli_mac(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ---------- Realtime ----------

do $$
begin
  alter publication supabase_realtime add table public.hizli_maclar;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.hizli_oyuncular;
exception when duplicate_object then null;
end $$;

-- ---------- Yeni davet geldiğinde bildir ----------

create or replace function public.notify_new_hizli_davet()
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
    from public.hizli_maclar hm
    join public.profiles p on p.id = hm.kurucu
    where hm.id = new.hizli_mac_id;

    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(new.user_id),
        'baslik', '⚡ Hızlı Olan Kazanır!',
        'govde', coalesce(v_gonderen, 'Biri') || ' seni hızlı yarışa davet etti. İlk bilen kazanır!',
        'url', '/meydan'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_hizli_davet on public.hizli_oyuncular;
create trigger trg_notify_hizli_davet
  after insert on public.hizli_oyuncular
  for each row execute function public.notify_new_hizli_davet();

-- ============================================================
-- bot_oyna: hızlı maçları da yönetsin
-- (20260612000030'daki gövdenin aynısı + 10-13. bölümlerde hızlı mod)
-- ============================================================

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
  v_ilk boolean;
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

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
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

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
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

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = (select coalesce(array_agg(id), '{}') from
                        (select id from public.questions
                         where aktif and (r.kategori is null or kategori = r.kategori)
                         order by random() limit 20) s),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif'
      and now() >= hm.soru_baslangic + interval '2 seconds'
      and now() <= hm.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
    for update of hm skip locked
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

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif'
      and (now() > hm.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        ))
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$$;
