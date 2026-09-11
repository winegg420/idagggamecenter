-- ============================================================
-- BOTLAR: 5 dağınık bot -> 4 net zorluk seviyesi
--
-- ÖNCE (canlı ölçüm): AcemiBot %45, ÇaylakBot %45, KurtBot %65,
-- BilgeBot %65, UstaBot %85 — beş bot, üç farklı isabet, adlar
-- birbirini tekrarlıyor ("KurtBot" hangi seviye belli değil).
--
-- SONRA: dört bot, dört ayrı seviye, adları oyunun rütbe dilinden:
--   ToyBot    %42  kolay
--   ÇaylakBot %58  orta
--   ÜstatBot  %75  zor
--   EfsaneBot %90  çok zor
--
-- BOTLAR SİLİNMEZ. Beşincisi (eski ÇaylakBot, id …0002) 19 maçta,
-- 347 cevapta ve 6 turnuvada geçiyor; silinirse maç geçmişi ve dökümler
-- bozulur. Onun yerine yeni `bot_aktif` bayrağı false yapılır: kayıt
-- yerinde kalır, geçmiş maçlarda görünmeye devam eder, ama yeni maç ve
-- turnuvalarda artık seçilmez.
--
-- NOT: gorunen_ad URETILMIS (generated) kolon — takma_ad'dan hesaplanir,
-- dogrudan yazilamaz. Bu yuzden takma_ad guncelleniyor.
--
-- id'ler korunuyor — her bot kendi geçmişini taşımayı sürdürsün diye
-- mevcut puanına en yakın seviyeye eşlendi (puan sırası = zorluk sırası).
-- ============================================================

begin;

-- ---------------------------------------------------------------- bayrak
alter table public.profiles
  add column if not exists bot_aktif boolean not null default true;

comment on column public.profiles.bot_aktif is
  'Yalnız botlar için: false ise yeni maç/turnuvalarda seçilmez. Geçmiş kayıtlar korunur.';

-- ------------------------------------------------- 1) beşinciyi emekli et
-- Adı önce boşaltılmalı: username UNIQUE ve "ÇaylakBot" aşağıda başka
-- bota veriliyor.
update public.profiles
   set username = 'bot_emekli_0002',
       takma_ad = 'ÇaylakBot (emekli)',
       bot_aktif = false
 where id = 'b0b00000-0000-4000-8000-000000000002';

-- --------------------------------------------- 2) dört seviyeyi adlandır
-- kolay — en düşük puanlı bot (50)
update public.profiles
   set username = 'ToyBot', takma_ad = 'ToyBot',
       bot_isabet = 0.42, bot_aktif = true
 where id = 'b0b00000-0000-4000-8000-000000000004';

-- orta (eski KurtBot, 250)
update public.profiles
   set username = 'ÇaylakBot', takma_ad = 'ÇaylakBot',
       bot_isabet = 0.58, bot_aktif = true
 where id = 'b0b00000-0000-4000-8000-000000000005';

-- zor (eski UstaBot, 1110)
update public.profiles
   set username = 'ÜstatBot', takma_ad = 'ÜstatBot',
       bot_isabet = 0.75, bot_aktif = true
 where id = 'b0b00000-0000-4000-8000-000000000003';

-- çok zor (eski BilgeBot, 1450)
update public.profiles
   set username = 'EfsaneBot', takma_ad = 'EfsaneBot',
       bot_isabet = 0.90, bot_aktif = true
 where id = 'b0b00000-0000-4000-8000-000000000001';

-- --------------------------------------- 3) bot seçen üç RPC'ye filtre
-- Üçü de yalnız `is_bot` bakıyordu; emekli bot da seçilmeye devam ederdi.

-- 3a) Hızlı eşleşme: kimse yoksa rastgele bot
create or replace function public.quick_match(p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
  v_kat text;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('quick_match', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Bekleyen herhangi bir gerçek oyuncu varsa onunla eşleş (karışık)
  select q.user_id into v_rakip from public.matchmaking_queue q
  where q.user_id <> auth.uid()
  order by q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Kimse yoksa rastgele botla başla (oyuncunun tercih ettiği kategoride)
  delete from public.matchmaking_queue where user_id = auth.uid();

  -- DEĞİŞEN SATIR: emekli botlar artık seçilmiyor
  select id into v_bot from public.profiles
   where is_bot and coalesce(bot_aktif, true)
   order by random() limit 1;

  insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 3b) Turnuva lobisine botları doldur (cron)
create or replace function public.turnuva_lobi_botlari()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seans text;
  v_tarih date;
  v_id uuid;
  v_baslangic timestamptz;
  v_kalan_dk numeric;
  v_hedef int;
  v_mevcut int;
  v_bot uuid;
begin
  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  -- Lobi henüz açılmadıysa aç (oyuncu girmeden de botlar birikebilsin)
  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments
  where tarih = v_tarih and seans = v_seans and durum = 'lobi';
  if not found then return; end if;

  -- Seansın başlangıç anı (Europe/Istanbul: sabah 10:00, akşam 22:00)
  v_baslangic := (v_tarih + (case when v_seans = 'sabah' then time '10:00' else time '22:00' end))
                 at time zone 'Europe/Istanbul';
  v_kalan_dk := extract(epoch from (v_baslangic - now())) / 60.0;

  -- 2 saatten uzak: henüz kimse girmesin
  if v_kalan_dk > 120 then return; end if;

  v_hedef := floor((120 - greatest(v_kalan_dk, 0)) / 15.0)::int + 1;
  v_hedef := greatest(0, least(v_hedef, (
    select count(*)::int from public.profiles
     where coalesce(is_bot, false) and coalesce(bot_aktif, true)
  )));

  select count(*)::int into v_mevcut
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = v_id and coalesce(p.is_bot, false);

  if v_mevcut >= v_hedef then return; end if;

  -- Güçlüden zayıfa değil, karışık bir sırayla girsinler (lobi doğal görünsün);
  -- sıra turnuva id'sine bağlı olduğundan aynı turnuvada tutarlı kalır.
  for v_bot in
    select p.id from public.profiles p
    where coalesce(p.is_bot, false)
      and coalesce(p.bot_aktif, true)
      and not exists (
        select 1 from public.tournament_players tp
        where tp.tournament_id = v_id and tp.user_id = p.id
      )
    order by public.bot_rasgele(v_id::text || p.id::text)
    limit (v_hedef - v_mevcut)
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$$;

-- 3c) Turnuvaya tüm botları kat (seans başlangıcı)
create or replace function public.bot_join_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bot uuid;
begin
  select id into v_id from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans and durum = 'lobi';
  if not found then return; end if;

  for v_bot in
    select p.id from public.profiles p
     where coalesce(p.is_bot, false)
       and coalesce(p.bot_aktif, true)
     order by p.puan desc
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$$;

commit;
