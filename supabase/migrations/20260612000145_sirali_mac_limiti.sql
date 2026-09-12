-- ============================================================
-- Sıralı (dereceli) maç kötüye kullanım limiti
--
-- TEMEL İLKE: oyuncular yalnız arkadaşlarıyla oynayabilir ve biri bu oyunu
-- SADECE arkadaşlarıyla maç yapmak için oynuyor olabilir. Limit onu
-- cezalandırmamalı — maç her zaman oynanır, yalnız ÖDÜLÜ azalır.
--
-- 6.1 Çift bazlı azalan ödül (aynı gün, aynı iki kişi):
--       1–5. maç   → tam ödül
--       6–10. maç  → yarım ödül
--       11+        → ödül yok, maç "dostluk maçı" olarak işaretlenir
--     Haftalık ek tavan YOK.
--
-- 6.2 Sessiz korumalar (oyuncuya gösterilmez):
--     • Aynı cihaz/IP'den iki hesap arasında sıralı maç hiç puan/coin vermez.
--       Asıl kötüye kullanım yöntemi budur.
--     • Haftalık maçlarının %70'inden fazlası tek kişiyle olan oyuncu
--       yönetim paneline işaretlenir. Otomatik ceza YOK, sadece kayıt.
--
-- Bütün sayılar oyun_ayarlari'nda; kod oradan okur.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger) values
  ('mac_cift_tam_sinir',       '5'::jsonb),
  ('mac_cift_yari_sinir',      '10'::jsonb),
  ('mac_haftalik_tekil_yuzde', '70'::jsonb)
on conflict (anahtar) do nothing;

alter table public.matches
  add column if not exists odul_carpan numeric(3,2) not null default 1,
  add column if not exists dostluk boolean not null default false;

-- ---- Cihaz/IP defteri ----
-- İstemci açılışta cihaz_bildir() çağırır; IP sunucuda başlıktan okunur.
create table if not exists public.oyuncu_cihazlari (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  cihaz_id text not null,
  ip       text,
  son_at   timestamptz not null default now(),
  primary key (user_id, cihaz_id)
);
alter table public.oyuncu_cihazlari enable row level security;
create index if not exists oyuncu_cihazlari_cihaz_idx on public.oyuncu_cihazlari (cihaz_id);
create index if not exists oyuncu_cihazlari_ip_idx on public.oyuncu_cihazlari (ip);

create or replace function public.cihaz_bildir(p_cihaz text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_me uuid := auth.uid();
  v_ip text;
begin
  if v_me is null then return; end if;
  if nullif(btrim(coalesce(p_cihaz, '')), '') is null then return; end if;

  begin
    v_ip := split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1);
  exception when others then
    v_ip := null;   -- başlık yoksa (doğrudan bağlantı) sessizce geç
  end;

  insert into public.oyuncu_cihazlari (user_id, cihaz_id, ip, son_at)
  values (v_me, left(p_cihaz, 64), nullif(btrim(coalesce(v_ip, '')), ''), now())
  on conflict (user_id, cihaz_id)
    do update set ip = coalesce(excluded.ip, public.oyuncu_cihazlari.ip), son_at = now();
end;
$$;

grant execute on function public.cihaz_bildir(text) to authenticated;

-- İki hesap aynı cihazı ya da aynı IP'yi paylaşıyor mu?
create or replace function public.ayni_cihaz_mi(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.oyuncu_cihazlari a
    join public.oyuncu_cihazlari b
      on (a.cihaz_id = b.cihaz_id or (a.ip is not null and a.ip = b.ip))
    where a.user_id = p_a and b.user_id = p_b
  );
$$;

-- ---- Çift bazlı ödül çarpanı ----
-- p_dahil: bu maçın kendisi sayıma dahil mi (maç bitişinde true).
create or replace function public.cift_odul_carpani(p_a uuid, p_b uuid, p_mac_id uuid default null)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_tam  int := public.ayar_sayi('mac_cift_tam_sinir', 5)::int;
  v_yari int := public.ayar_sayi('mac_cift_yari_sinir', 10)::int;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sira int;
begin
  -- Aynı cihaz/IP: sıralı maç hiç ödül vermez (sessiz koruma).
  if public.ayni_cihaz_mi(p_a, p_b) then return 0; end if;

  select count(*) into v_sira
  from public.matches m
  where m.durum = 'bitti'
    and coalesce(m.dereceli, true)
    and ((m.oyuncu1 = p_a and m.oyuncu2 = p_b) or (m.oyuncu1 = p_b and m.oyuncu2 = p_a))
    and (coalesce(m.bitis, m.created_at) at time zone 'Europe/Istanbul')::date = v_bugun
    and (p_mac_id is null or m.id <> p_mac_id);

  v_sira := v_sira + 1;   -- bu maç kaçıncı olacak

  if v_sira <= v_tam then return 1; end if;
  if v_sira <= v_yari then return 0.5; end if;
  return 0;
end;
$$;

-- Oyuncuya BAŞTAN gösterilecek bilgi: "Bugün bu rakiple 6. maçın".
create or replace function public.cift_mac_durumu(p_rakip uuid)
returns table(bugun integer, sira integer, carpan numeric)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_me uuid := auth.uid();
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sayi int;
begin
  if v_me is null or p_rakip is null then return; end if;

  select count(*) into v_sayi
  from public.matches m
  where m.durum = 'bitti'
    and coalesce(m.dereceli, true)
    and ((m.oyuncu1 = v_me and m.oyuncu2 = p_rakip) or (m.oyuncu1 = p_rakip and m.oyuncu2 = v_me))
    and (coalesce(m.bitis, m.created_at) at time zone 'Europe/Istanbul')::date = v_bugun;

  return query select
    v_sayi,
    v_sayi + 1,
    case
      when public.ayni_cihaz_mi(v_me, p_rakip) then 0::numeric
      when v_sayi + 1 <= public.ayar_sayi('mac_cift_tam_sinir', 5)::int then 1::numeric
      when v_sayi + 1 <= public.ayar_sayi('mac_cift_yari_sinir', 10)::int then 0.5::numeric
      else 0::numeric
    end;
end;
$$;

grant execute on function public.cift_mac_durumu(uuid) to authenticated;

-- ---- Yönetim işareti: haftalık maçların %70'inden fazlası tek kişiyle ----
create table if not exists public.kotuye_kullanim_isaretleri (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  hafta     date not null,
  rakip     uuid references public.profiles(id) on delete set null,
  oran      numeric(5,2) not null,
  mac_sayisi int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, hafta)
);
alter table public.kotuye_kullanim_isaretleri enable row level security;
-- Okuma yalnız yönetim panelinden (service_role); oyuncuya gösterilmez.

create or replace function public.kotuye_kullanim_tara()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_yuzde numeric := public.ayar_sayi('mac_haftalik_tekil_yuzde', 70)::numeric / 100;
  v_hafta date := date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date;
  v_sayi int := 0;
begin
  with maclarim as (
    select p.id as user_id,
           case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end as rakip
    from public.matches m
    join public.profiles p on p.id in (m.oyuncu1, m.oyuncu2) and not coalesce(p.is_bot, false)
    where m.durum = 'bitti' and coalesce(m.dereceli, true)
      and coalesce(m.bitis, m.created_at) >= v_hafta
  ), ozet as (
    select user_id, rakip, count(*)::int as ikili,
           sum(count(*)) over (partition by user_id)::int as toplam
    from maclarim group by user_id, rakip
  )
  insert into public.kotuye_kullanim_isaretleri (user_id, hafta, rakip, oran, mac_sayisi)
  select user_id, v_hafta, rakip, round(ikili::numeric / toplam * 100, 2), toplam
  from ozet
  where toplam >= 10 and ikili::numeric / toplam > v_yuzde
  on conflict (user_id, hafta) do update
    set rakip = excluded.rakip, oran = excluded.oran,
        mac_sayisi = excluded.mac_sayisi, created_at = now();

  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$$;

revoke all on function public.kotuye_kullanim_tara() from public, authenticated, anon;

-- ---- Coin ödülü çarpanı kabul etsin ----
-- Eski 3 parametreli sürüm düşürülüyor: varsayılanlı 4. parametre eklenince
-- iki imza birden var olsaydı çağrılar belirsiz kalırdı.
drop function if exists public.coin_mac_odulu(text, uuid, uuid[]);

create or replace function public.coin_mac_odulu(
  p_referans text, p_kazanan uuid, p_oyuncular uuid[], p_carpan numeric default 1)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_galibiyet bigint := public.ayar_sayi('coin_mac_galibiyet', 20);
  v_beraberlik bigint := public.ayar_sayi('coin_mac_beraberlik', 10);
  v_carpan numeric := coalesce(p_carpan, 1);
  v_oyuncu uuid;
begin
  if p_referans is null then return; end if;
  if v_carpan <= 0 then return; end if;      -- dostluk maçı: coin yok

  if p_kazanan is not null then
    perform public.coin_ekle(p_kazanan, floor(v_galibiyet * v_carpan)::bigint, 'mac', p_referans);
  else
    foreach v_oyuncu in array coalesce(p_oyuncular, '{}'::uuid[]) loop
      perform public.coin_ekle(v_oyuncu, floor(v_beraberlik * v_carpan)::bigint, 'mac', p_referans);
    end loop;
  end if;
end;
$$;

-- ---- Maç sonucu: çarpan uygulanır, dostluk maçı işaretlenir ----
create or replace function public.mac_sonuclandir(p_match_id uuid, p_kazanan uuid, p_kaybeden uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_carpan numeric := 1;
  v_lig int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  -- Aynı çiftin o günkü kaçıncı maçı olduğuna göre ödül çarpanı
  -- (1 / 0.5 / 0). Aynı cihaz-IP ise doğrudan 0.
  v_carpan := public.cift_odul_carpani(m.oyuncu1, m.oyuncu2, p_match_id);

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(),
         odul_carpan = v_carpan,
         dostluk = (v_carpan = 0)
   where id = p_match_id;

  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2], v_carpan);

  -- NORMAL MAÇ: rozet verilir ama PUAN ve SERİ yazılmaz.
  if not coalesce(m.dereceli, true) then
    if p_kazanan is not null then
      perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    end if;
    return;
  end if;

  if p_kazanan is not null then
    v_lig := floor(20 * v_carpan)::int;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = p_kazanan;
    end if;

    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    if (select count(*) from public.matches where kazanan = p_kazanan and durum = 'bitti') >= 10 then
      perform public.award_badge(p_kazanan, 'mac_10');
    end if;
    if p_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
      perform public.award_badge(p_kazanan, 'bot_avcisi');
    end if;
    if (select count(*) from public.match_answers
        where match_id = p_match_id and user_id = p_kazanan and dogru)
       >= coalesce(array_length(m.soru_ids, 1), 0) then
      perform public.award_badge(p_kazanan, 'tam_isabet');
    end if;
  end if;

  -- Günlük seri bonusu limitten etkilenmez: oyuna gelmenin ödülü,
  -- maçın değil.
  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = v_oyuncu and not is_bot;
    if found and v_tarih is distinct from v_bugun then
      v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
      v_bonus := least(v_yeni_seri * 5, 50);
      update public.profiles
         set seri = v_yeni_seri,
             son_seri_tarihi = v_bugun,
             puan = puan + v_bonus,
             puan_hafta = puan_hafta + v_bonus
       where id = v_oyuncu;
      if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
      if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
    end if;
  end loop;
end;
$function$;

-- Günde bir kez tara: yönetim paneli haftalık tabloyu okur.
select cron.unschedule('bildim-kotuye-kullanim')
  where exists (select 1 from cron.job where jobname = 'bildim-kotuye-kullanim');
select cron.schedule('bildim-kotuye-kullanim', '40 3 * * *',
                     'select public.kotuye_kullanim_tara()');
