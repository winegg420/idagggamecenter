-- ============================================================
-- 198 — Günde 7 turnuva (Revizyon Paketi 12, madde 7)
--
-- Saatler (TSİ): 10:00, 12:30, 15:00, 18:00, 20:00, 22:00, 24:00.
-- Tek kaynak: oyun_ayarlari.turnuva_saatleri (JSON dizi). Eski
-- turnuva_saat_sabah/aksam anahtarları SİLİNMEZ ama artık okunmaz
-- (yalnız eski 'sabah'/'aksam' satırlarının anını hesaplamak için).
-- Ödüller (150/75/40 + 10) ve günlük 400 tavanı değişmez.
--
-- SEANS: yeni turnuvalarda `tournaments.seans` = saat metni ("12:30").
-- "24:00" o TARİHİN gece yarısıdır (ertesi gün 00:00). (tarih, seans)
-- tekilliği aynen işler.
--
-- BAŞLATMA: saat başına sabit cron yerine dakikalık zamanlayıcı
-- (turnuva_zamanlayici_tik): anı gelen lobiyi başlatır (2 kişiden azsa
-- iptal), 15 dk'dan eski unutulmuş lobiyi iptal eder, sıradaki lobiyi açar.
--
-- BOTLAR: katılım (38-66, yayılmış) her turnuvada mevcut dakikalık
-- bot_turnuva_katilim_tik + turnuva_lobi_botlari ile olur. Havuz artık
-- (a) başka lobide/aktif turnuvada olan botu, (b) en son biten turnuvada
-- oynamış botu dışarıda bırakır: aynı bot iki turnuvada birden olmaz,
-- art arda turnuvalarda aynı kadro dönmez. 155 gizli bot, en çok 66'lık
-- iki kadro düşülünce de hedefe yeter.
--
-- HATIRLATMA: günde en çok 2 push — 12:30 ve 22:00 turnuvalarından
-- 45 dk önce. Mevcut iki işin YALNIZ zamanı ve metni değişir; gizli
-- anahtarlı başlık dokunulmadan kalır.
-- ============================================================

-- Seans sütunu yalnız 'sabah'/'aksam' kabul ediyordu; saat metni de kabul edilir.
alter table public.tournaments drop constraint if exists tournaments_seans_check;
alter table public.tournaments add constraint tournaments_seans_check
  check (seans in ('sabah', 'aksam') or seans ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or seans = '24:00');

insert into public.oyun_ayarlari (anahtar, deger, aciklama)
values ('turnuva_saatleri', '["10:00","12:30","15:00","18:00","20:00","22:00","24:00"]'::jsonb,
        'Günlük turnuva saatleri (TSİ, HH:MM; 24:00 = o günün gece yarısı)')
on conflict (anahtar) do update set deger = excluded.deger, aciklama = excluded.aciklama;

-- ---------- Seans → günün başından aralık ----------
create or replace function public.turnuva_seans_araligi(p_seans text)
returns interval
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- Eski satırlar (geçiş öncesi): ayardaki sabah/aksam saati.
  if p_seans in ('sabah', 'aksam') then
    return public.turnuva_saati(p_seans) - time '00:00';
  end if;
  if p_seans ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' or p_seans = '24:00' then
    return make_interval(hours => split_part(p_seans, ':', 1)::int,
                         mins  => split_part(p_seans, ':', 2)::int);
  end if;
  return interval '13 hours';
end;
$$;

-- ---------- Günün saat listesi (sıralı, geçersizler atılır) ----------
create or replace function public.turnuva_saatleri_listesi()
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select array_agg(distinct s order by s)
       from (select s from public.oyun_ayarlari o, jsonb_array_elements_text(o.deger) s
              where o.anahtar = 'turnuva_saatleri' and jsonb_typeof(o.deger) = 'array'
                and (s ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or s = '24:00')) x),
    array['10:00','12:30','15:00','18:00','20:00','22:00','24:00']);
$$;
-- Not: sıralama metinle yapılır; "HH:MM" iki haneli yazıldığında metin
-- sırası saat sırasıdır (tek haneli "9:00" bu yüzden kabul edilmez).

-- ---------- Turnuvanın başlangıç anı ----------
create or replace function public.turnuva_an(p_tournament_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $$
  select (t.tarih + public.turnuva_seans_araligi(t.seans)) at time zone 'Europe/Istanbul'
    from public.tournaments t
   where t.id = p_tournament_id;
$$;

-- ---------- Sıradaki turnuva (tarih + seans) ----------
create or replace function public.sonraki_turnuva_bilgi(out o_tarih date, out o_seans text)
returns record
language sql
stable
security definer
set search_path to 'public'
as $$
  with simdi as (select (now() at time zone 'Europe/Istanbul') as yerel)
  select g.gun, s.saat
    from simdi,
         lateral (values (simdi.yerel::date - 1), (simdi.yerel::date), (simdi.yerel::date + 1)) g(gun),
         unnest(public.turnuva_saatleri_listesi()) s(saat)
   where g.gun + public.turnuva_seans_araligi(s.saat) > simdi.yerel
   order by g.gun + public.turnuva_seans_araligi(s.saat)
   limit 1;
$$;

create or replace function public.sonraki_turnuva_tarihi()
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select o_tarih from public.sonraki_turnuva_bilgi();
$$;

-- Dönüş tipi aynı (eski istemciler saat_sabah/aksam okur); başlangıç yeni hesapla.
create or replace function public.sonraki_turnuva_ani()
returns table(seans text, baslangic timestamptz, saat_sabah time, saat_aksam time)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.o_seans,
         (b.o_tarih + public.turnuva_seans_araligi(b.o_seans)) at time zone 'Europe/Istanbul',
         public.turnuva_saati('sabah'),
         public.turnuva_saati('aksam')
    from public.sonraki_turnuva_bilgi() b;
$$;

-- ---------- Lobi botları: başlangıç anı genel hesaptan ----------
create or replace function public.turnuva_lobi_botlari()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_seans text;
  v_tarih date;
  v_id uuid;
  v_baslangic timestamptz;
  v_kalan_dk numeric;
  v_hedef int;
  v_mevcut int;
  v_havuz int;
  v_bot uuid;
begin
  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments
  where tarih = v_tarih and seans = v_seans and durum = 'lobi';
  if not found then return; end if;

  -- ESKİDEN: tarih + turnuva_saati(seans) — "24:00" ve saat metni seansı bilmiyordu.
  v_baslangic := public.turnuva_an(v_id);
  v_kalan_dk := extract(epoch from (v_baslangic - now())) / 60.0;
  if v_kalan_dk > 120 then return; end if;

  select count(*)::int into v_havuz from public.turnuva_bot_havuzu(v_id);

  v_hedef := floor((120 - greatest(v_kalan_dk, 0)) / 15.0)::int + 1;
  v_hedef := greatest(0, least(v_hedef, v_havuz));

  select count(*)::int into v_mevcut
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = v_id and coalesce(p.is_bot, false);

  if v_mevcut >= v_hedef then return; end if;

  for v_bot in
    select b.bot_id from public.turnuva_bot_havuzu(v_id) b
    where not exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = v_id and tp.user_id = b.bot_id
    )
    order by public.bot_rasgele(v_id::text || b.bot_id::text)
    limit (v_hedef - v_mevcut)
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$$;

-- ---------- Bot havuzu: eşzamanlı ve art arda tekrar yok ----------
create or replace function public.turnuva_bot_havuzu(p_tournament_id uuid)
returns table(bot_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  with son_biten as (
    select t3.id from public.tournaments t3
     where t3.id <> p_tournament_id and t3.durum in ('bitti', 'iptal')
       and t3.bitis > now() - interval '3 hours'
     order by t3.bitis desc
     limit 1
  )
  select s.id
    from (
      select p.id,
             public.bot_rasgele(p_tournament_id::text || p.id::text) as sira
        from public.profiles p
       where p.is_bot and coalesce(p.bot_aktif, true)
         and p.bot_turu = 'gizli'          -- ESKİDEN: açık botlar öncelikliydi
         -- Bu turnuvaya zaten katılmış bot her zaman havuzda kalır.
         and (exists (select 1 from public.tournament_players tp0
                       where tp0.tournament_id = p_tournament_id and tp0.user_id = p.id)
              or not exists (
                select 1 from public.tournament_players tp
                  join public.tournaments t2 on t2.id = tp.tournament_id
                 where tp.user_id = p.id and t2.id <> p_tournament_id
                   and (t2.durum in ('lobi', 'aktif') or t2.id in (select id from son_biten))))
       order by sira
       limit (select public.turnuva_hedef_bot(p_tournament_id))
    ) s;
$$;

-- ---------- Dakikalık zamanlayıcı ----------
create or replace function public.turnuva_zamanlayici_tik()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_oyuncu int;
  v_baslayan int := 0;
begin
  for r in
    select t.id from public.tournaments t
     where t.durum = 'lobi' and public.turnuva_an(t.id) <= now()
     for update skip locked
  loop
    if public.turnuva_an(r.id) < now() - interval '15 minutes' then
      -- Zamanında başlatılamamış eski lobi: açık kalıp kafa karıştırmasın.
      update public.tournaments set durum = 'iptal', bitis = now() where id = r.id;
      continue;
    end if;

    select count(*) into v_oyuncu from public.tournament_players where tournament_id = r.id;
    if v_oyuncu < 2 then
      update public.tournaments set durum = 'iptal', bitis = now() where id = r.id;
      continue;
    end if;

    -- start_tournament ile aynı başlangıç (karışık havuz, 30 soru, 'tr').
    update public.tournaments
       set durum = 'aktif',
           soru_ids = public.turnuva_soru_sec(30, 'tr'),
           aktif_soru = 0,
           baslangic = now(),
           soru_baslangic = now()
     where id = r.id;
    v_baslayan := v_baslayan + 1;
  end loop;

  -- Sıradaki lobi hazır olsun (oyuncu ana sayfadan hemen katılabilsin).
  insert into public.tournaments (tarih, seans)
  select o_tarih, o_seans from public.sonraki_turnuva_bilgi()
  on conflict (tarih, seans) do nothing;

  return v_baslayan;
end;
$$;

revoke all on function public.turnuva_zamanlayici_tik() from public, anon, authenticated;
revoke all on function public.turnuva_seans_araligi(text) from public, anon;
revoke all on function public.turnuva_saatleri_listesi() from public, anon;

-- ---------- Geçiş: bugünkü açık sabah/akşam lobisi yeni saate taşınır ----------
-- (içindeki oyuncular yerini korur; 21:50 → 22:00, 13:00 → 12:30)
update public.tournaments t
   set seans = case t.seans when 'aksam' then '22:00' else '12:30' end
 where t.durum = 'lobi' and t.seans in ('sabah', 'aksam')
   and t.tarih >= (now() at time zone 'Europe/Istanbul')::date
   and not exists (select 1 from public.tournaments x
                    where x.tarih = t.tarih
                      and x.seans = case t.seans when 'aksam' then '22:00' else '12:30' end);

-- ---------- Cron ----------
do $$
declare
  v_job bigint;
begin
  -- Sabit saatli başlatma ve bot çağrıları kalkar (bot katılımı zaten dakikalık).
  for v_job in
    select jobid from cron.job
     where jobname in ('bildim-turnuva-baslat-sabah', 'bildim-turnuva-baslat',
                       'bildim-bot-turnuva-sabah', 'bildim-bot-turnuva')
  loop
    perform cron.unschedule(v_job);
  end loop;

  if not exists (select 1 from cron.job where jobname = 'bildim-turnuva-zamanlayici') then
    perform cron.schedule('bildim-turnuva-zamanlayici', '* * * * *',
                          'select public.turnuva_zamanlayici_tik()');
  end if;

  -- Hatırlatmalar: 12:30 TSİ turnuvası için 11:45 TSİ (08:45 UTC),
  -- 22:00 TSİ turnuvası için 21:15 TSİ (18:15 UTC). Günde en çok 2.
  select jobid into v_job from cron.job where jobname = 'bildim-turnuva-hatirlat-sabah';
  if v_job is not null then
    perform cron.alter_job(v_job, schedule := '45 8 * * *',
      command := (select replace(replace(command, 'Sabah turnuvası', 'Öğle turnuvası'), '10:00', '12:30')
                    from cron.job where jobid = v_job));
  end if;
  select jobid into v_job from cron.job where jobname = 'bildim-turnuva-hatirlat';
  if v_job is not null then
    perform cron.alter_job(v_job, schedule := '15 18 * * *');
  end if;
end;
$$;
