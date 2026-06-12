-- ============================================================
-- Günlük görevler + sabah turnuvası (10:00 TSİ)
-- ============================================================

-- ---------- Sabah turnuvası: günde iki seans ----------

alter table public.tournaments
  add column if not exists seans text not null default 'aksam'
  check (seans in ('sabah', 'aksam'));

alter table public.tournaments drop constraint if exists tournaments_tarih_key;
alter table public.tournaments drop constraint if exists tournaments_tarih_seans_key;
alter table public.tournaments add constraint tournaments_tarih_seans_key unique (tarih, seans);

-- Sıradaki turnuva: 10:00 öncesi bugün/sabah, 22:00 öncesi bugün/akşam, sonrası yarın/sabah
create or replace function public.sonraki_turnuva_bilgi(out o_tarih date, out o_seans text)
language sql
stable
as $$
  select
    case
      when (now() at time zone 'Europe/Istanbul')::time < time '22:00'
        then (now() at time zone 'Europe/Istanbul')::date
      else (now() at time zone 'Europe/Istanbul')::date + 1
    end,
    case
      when (now() at time zone 'Europe/Istanbul')::time < time '10:00' then 'sabah'
      when (now() at time zone 'Europe/Istanbul')::time < time '22:00' then 'aksam'
      else 'sabah'
    end;
$$;

create or replace function public.join_tournament_lobby()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarih date;
  v_seans text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments where tarih = v_tarih and seans = v_seans;

  if (select durum from public.tournaments where id = v_id) <> 'lobi' then
    raise exception 'Turnuva lobisi kapalı';
  end if;

  insert into public.tournament_players (tournament_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  return v_id;
end;
$$;

-- Seans parametreli başlatıcı
drop function if exists public.start_tournament();
create or replace function public.start_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_oyuncu int;
begin
  select * into t
  from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans
    and durum = 'lobi'
  for update;
  if not found then return; end if;

  select count(*) into v_oyuncu from public.tournament_players where tournament_id = t.id;

  if v_oyuncu < 2 then
    update public.tournaments set durum = 'iptal', bitis = now() where id = t.id;
    return;
  end if;

  update public.tournaments
     set durum = 'aktif',
         soru_ids = (select coalesce(array_agg(id), '{}') from
                      (select id from public.questions where aktif order by random() limit 30) q),
         aktif_soru = 0,
         baslangic = now(),
         soru_baslangic = now()
   where id = t.id;
end;
$$;
revoke execute on function public.start_tournament(text) from public, anon, authenticated;

-- Bot katılımı seans parametreli
drop function if exists public.bot_join_tournament();
create or replace function public.bot_join_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot constant uuid := 'b0b00000-0000-4000-8000-000000000001';
  v_id uuid;
begin
  select id into v_id from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans and durum = 'lobi';
  if not found then return; end if;

  if exists (
    select 1 from public.tournament_players
    where tournament_id = v_id and user_id <> v_bot
  ) then
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.bot_join_tournament(text) from public, anon, authenticated;

-- ---------- Günlük görevler ----------

create table if not exists public.quest_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tarih date not null,
  quest_id text not null,
  odul int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tarih, quest_id)
);
alter table public.quest_progress enable row level security;
revoke all on public.quest_progress from authenticated, anon;

-- Görev tanımları tek yerde dursun
create or replace function public.gorev_tanimlari()
returns table (quest_id text, ad text, hedef int, odul int)
language sql
immutable
as $$
  values
    ('mac_oyna_3',  '3 maç oyna', 3, 20),
    ('mac_kazan_5', 'Bugün 5 maç kazan', 5, 50),
    ('dogru_25',    '25 soruyu doğru cevapla', 25, 30);
$$;

create or replace function public.gorev_sayaci(p_quest_id text, p_user uuid, p_tarih date)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case p_quest_id
    when 'mac_oyna_3' then
      (select count(*) from public.matches m
       where m.durum = 'bitti' and p_user in (m.oyuncu1, m.oyuncu2)
         and (m.bitis at time zone 'Europe/Istanbul')::date = p_tarih)
    when 'mac_kazan_5' then
      (select count(*) from public.matches m
       where m.durum = 'bitti' and m.kazanan = p_user
         and (m.bitis at time zone 'Europe/Istanbul')::date = p_tarih)
    when 'dogru_25' then
      (select count(*) from public.match_answers a
       where a.user_id = p_user and a.dogru
         and (a.created_at at time zone 'Europe/Istanbul')::date = p_tarih)
    else 0
  end;
$$;
revoke execute on function public.gorev_sayaci(text, uuid, date) from public, anon, authenticated;

create or replace function public.get_daily_quests()
returns table (quest_id text, ad text, hedef int, odul int, ilerleme bigint, alindi boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  return query
    select g.quest_id, g.ad, g.hedef, g.odul,
           least(public.gorev_sayaci(g.quest_id, auth.uid(), v_bugun), g.hedef::bigint),
           exists (select 1 from public.quest_progress p
                   where p.user_id = auth.uid() and p.tarih = v_bugun and p.quest_id = g.quest_id)
    from public.gorev_tanimlari() g;
end;
$$;

create or replace function public.claim_quest(p_quest_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_hedef int;
  v_odul int;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  select g.hedef, g.odul into v_hedef, v_odul
  from public.gorev_tanimlari() g where g.quest_id = p_quest_id;
  if not found then raise exception 'Görev bulunamadı'; end if;

  if public.gorev_sayaci(p_quest_id, auth.uid(), v_bugun) < v_hedef then
    raise exception 'Görev henüz tamamlanmadı';
  end if;

  insert into public.quest_progress (user_id, tarih, quest_id, odul)
  values (auth.uid(), v_bugun, p_quest_id, v_odul)
  on conflict do nothing;

  if not found then return false; end if; -- zaten alınmış

  update public.profiles
     set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
   where id = auth.uid();
  return true;
end;
$$;

revoke execute on function public.get_daily_quests() from public, anon;
grant execute on function public.get_daily_quests() to authenticated;
revoke execute on function public.claim_quest(text) from public, anon;
grant execute on function public.claim_quest(text) to authenticated;

-- ---------- Cron güncellemeleri ----------

do $$
begin
  -- Akşam turnuvası (mevcut işi parametreli fonksiyona bağla)
  begin perform cron.unschedule('bildim-turnuva-baslat'); exception when others then null; end;
  perform cron.schedule('bildim-turnuva-baslat', '0 19 * * *',
    $c$select public.start_tournament('aksam')$c$);

  -- Sabah turnuvası: 10:00 TSİ = 07:00 UTC
  begin perform cron.unschedule('bildim-turnuva-baslat-sabah'); exception when others then null; end;
  perform cron.schedule('bildim-turnuva-baslat-sabah', '0 7 * * *',
    $c$select public.start_tournament('sabah')$c$);

  -- Bot katılımları
  begin perform cron.unschedule('bildim-bot-turnuva'); exception when others then null; end;
  perform cron.schedule('bildim-bot-turnuva', '55 18 * * *',
    $c$select public.bot_join_tournament('aksam')$c$);
  begin perform cron.unschedule('bildim-bot-turnuva-sabah'); exception when others then null; end;
  perform cron.schedule('bildim-bot-turnuva-sabah', '55 6 * * *',
    $c$select public.bot_join_tournament('sabah')$c$);

  -- Sabah turnuvası hatırlatması: 09:45 TSİ = 06:45 UTC
  begin perform cron.unschedule('bildim-turnuva-hatirlat-sabah'); exception when others then null; end;
  perform cron.schedule('bildim-turnuva-hatirlat-sabah', '45 6 * * *',
    $c$select net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := '{"x-cron-secret": "6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ", "Content-Type": "application/json"}'::jsonb,
      body := '{"baslik": "☀️ Sabah turnuvası yaklaşıyor!", "govde": "Turnuva 10:00''da başlıyor. Lobideki yerini al! 🏆", "url": "/turnuva"}'::jsonb
    )$c$);
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;
