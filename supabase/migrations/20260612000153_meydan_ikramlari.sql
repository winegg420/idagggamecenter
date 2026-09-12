-- ============================================================
-- MEYDANDA İKRAM — kahve ve balon
--
-- Haritada başka bir avatara dokununca açılan menüde üç seçenek var:
-- "Meydan oku" (mevcut maç daveti akışı), "Kahve ikram et" ve
-- "Balon ikram et". İkramlar 5 coin.
--
-- KURALLAR
--   · Aynı kişiye sınırsız yapılabilir, bekleme süresi yok.
--   · Coin SUNUCUDA düşülür; istemciye güvenilmez.
--   · Reddedilirse coin iade edilir.
--   · 20 saniye yanıtsız kalırsa teklif iptal olur ve coin iade edilir.
--   · Oyuncunun "Rahatsız etme" ayarı varsa ona ikram gönderilemez
--     (varsayılan KAPALI = ikramlar açık).
--
-- MİMARİ: burada yalnız KURAL ve COİN var. Kahve içme jesti, kahkaha
-- animasyonu, balonların uçuşu tamamen istemcinin görsel katmanında
-- (bkz. bildim/harita/etkilesim.js ve ikramGorsel.js). Karakter modelleri
-- baştan değişse de bu tablo ve RPC'ler aynen çalışır.
-- ============================================================

alter table public.profiles
  add column if not exists rahatsiz_etme boolean not null default false;

insert into public.oyun_ayarlari (anahtar, deger) values
  ('coin_ikram',         '5'::jsonb),
  ('ikram_zaman_asimi_sn', '20'::jsonb),
  ('ikram_sure_sn',      '15'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;

create table if not exists public.meydan_ikramlari (
  id         uuid primary key default gen_random_uuid(),
  gonderen   uuid not null references public.profiles(id) on delete cascade,
  alan       uuid not null references public.profiles(id) on delete cascade,
  tur        text not null check (tur in ('kahve','balon')),
  durum      text not null default 'bekliyor'
             check (durum in ('bekliyor','kabul','red','zaman_asimi')),
  coin       int  not null default 0,
  created_at timestamptz not null default now(),
  yanit_at   timestamptz
);
alter table public.meydan_ikramlari enable row level security;
create index if not exists meydan_ikramlari_alan_idx
  on public.meydan_ikramlari (alan, durum, created_at desc);

drop policy if exists meydan_ikramlari_oku on public.meydan_ikramlari;
create policy meydan_ikramlari_oku on public.meydan_ikramlari
  for select to authenticated
  using (gonderen = auth.uid() or alan = auth.uid());

-- ---- Teklif gönder ----
-- Dönüş kolonları tablo kolonlarıyla çakışmayacak adlarla: `id` deseydik
-- insert ... returning içinde belirsiz kalırdı.
drop function if exists public.ikram_gonder(uuid, text);
create or replace function public.ikram_gonder(p_alan uuid, p_tur text)
returns table(ikram_id uuid, ikram_coin int, bakiye bigint)
language plpgsql security definer set search_path to 'public' as $ig$
declare
  v_me uuid := auth.uid();
  v_fiyat int := public.ayar_sayi('coin_ikram', 5)::int;
  v_bakiye bigint;
  v_id uuid;
  v_kapali boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('ikram_gonder', 30, interval '60 seconds');
  if p_tur not in ('kahve','balon') then raise exception 'Geçersiz ikram'; end if;
  if p_alan is null or p_alan = v_me then raise exception 'Kendine ikram edemezsin'; end if;

  select coalesce(rahatsiz_etme, false) into v_kapali from public.profiles where id = p_alan;
  if v_kapali is null then raise exception 'Oyuncu bulunamadı'; end if;
  if v_kapali then raise exception 'Bu oyuncu şu an ikram almak istemiyor'; end if;

  -- Coin ÖNCE düşülür; reddedilir ya da zaman aşımına uğrarsa iade edilir.
  v_bakiye := public.coin_harca(v_fiyat, 'ikram', p_tur || ':' || p_alan::text || ':' || clock_timestamp()::text);

  insert into public.meydan_ikramlari (gonderen, alan, tur, coin)
  values (v_me, p_alan, p_tur, v_fiyat)
  returning meydan_ikramlari.id into v_id;

  return query select v_id, v_fiyat, v_bakiye;
  return;
end;
$ig$;

grant execute on function public.ikram_gonder(uuid, text) to authenticated;

-- ---- Teklifi yanıtla ----
create or replace function public.ikram_yanitla(p_id uuid, p_kabul boolean)
returns text language plpgsql security definer set search_path to 'public' as $iy$
declare
  v_me uuid := auth.uid();
  r public.meydan_ikramlari%rowtype;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  select * into r from public.meydan_ikramlari where id = p_id for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;
  if r.alan <> v_me then raise exception 'Bu teklif sana değil'; end if;
  if r.durum <> 'bekliyor' then return r.durum; end if;

  if r.created_at < now() - (public.ayar_sayi('ikram_zaman_asimi_sn', 20) * interval '1 second') then
    update public.meydan_ikramlari
       set durum = 'zaman_asimi', yanit_at = now() where id = p_id;
    perform public.coin_ekle(r.gonderen, r.coin, 'ikram_iade', p_id::text);
    return 'zaman_asimi';
  end if;

  update public.meydan_ikramlari
     set durum = case when p_kabul then 'kabul' else 'red' end, yanit_at = now()
   where id = p_id;

  if not p_kabul then
    perform public.coin_ekle(r.gonderen, r.coin, 'ikram_iade', p_id::text);
  end if;

  return case when p_kabul then 'kabul' else 'red' end;
end;
$iy$;

grant execute on function public.ikram_yanitla(uuid, boolean) to authenticated;

-- ---- Bekleyen teklifler (istemci yoklaması; broadcast kaçarsa yedek) ----
create or replace function public.ikramlarim()
returns table(id uuid, gonderen uuid, gonderen_ad text, tur text, kalan_sn int)
language sql stable security definer set search_path to 'public' as $$
  select i.id, i.gonderen, p.gorunen_ad, i.tur,
         greatest(0, public.ayar_sayi('ikram_zaman_asimi_sn', 20)::int
                     - floor(extract(epoch from (now() - i.created_at)))::int)
  from public.meydan_ikramlari i
  join public.profiles p on p.id = i.gonderen
  where i.alan = auth.uid() and i.durum = 'bekliyor'
    and i.created_at > now() - (public.ayar_sayi('ikram_zaman_asimi_sn', 20) * interval '1 second')
  order by i.created_at;
$$;

grant execute on function public.ikramlarim() to authenticated;

-- ---- Zaman aşımı: yanıtsız teklifler iptal, coin iade ----
create or replace function public.ikram_zaman_asimi()
returns integer language plpgsql security definer set search_path to 'public' as $iza$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select * from public.meydan_ikramlari
     where durum = 'bekliyor'
       and created_at < now() - (public.ayar_sayi('ikram_zaman_asimi_sn', 20) * interval '1 second')
     for update skip locked
  loop
    update public.meydan_ikramlari
       set durum = 'zaman_asimi', yanit_at = now() where id = r.id;
    perform public.coin_ekle(r.gonderen, r.coin, 'ikram_iade', r.id::text);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$iza$;

revoke all on function public.ikram_zaman_asimi() from public, authenticated, anon;

select cron.unschedule('bildim-ikram-zaman-asimi')
  where exists (select 1 from cron.job where jobname = 'bildim-ikram-zaman-asimi');
select cron.schedule('bildim-ikram-zaman-asimi', '* * * * *',
                     'select public.ikram_zaman_asimi()');

-- İkram iadesi günlük coin tavanına TAKILMAZ: oyuncunun kendi parası,
-- kazanç değil. (Tavan yalnız oyunla kazanılan coini sınırlar.)
create or replace function public.coin_ekle(p_user uuid, p_miktar bigint, p_tur text, p_referans text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $ce$
declare
  v_bakiye bigint;
  v_bot boolean;
  v_miktar bigint := p_miktar;
  v_kalan bigint;
begin
  if p_user is null or coalesce(p_miktar, 0) <= 0 then return null; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return null; end if;

  if p_tur not in ('satin_alma', 'baslangic', 'ikram_iade') then
    v_kalan := public.coin_gunluk_kalan(p_user);
    v_miktar := least(v_miktar, v_kalan);
    if v_miktar <= 0 then return (select coin from public.profiles where id = p_user); end if;
  end if;

  perform set_config('app.coin_izin', '1', true);
  update public.profiles
     set coin = coin + v_miktar
   where id = p_user
  returning coin into v_bakiye;
  if v_bakiye is null then return null; end if;

  begin
    insert into public.coin_hareketleri (user_id, miktar, tur, referans, bakiye_sonra)
    values (p_user, v_miktar, p_tur, p_referans, v_bakiye);
  exception when unique_violation then
    update public.profiles set coin = coin - v_miktar where id = p_user
    returning coin into v_bakiye;
    return v_bakiye;
  end;

  return v_bakiye;
end;
$ce$;

-- Günlük tavan hesabı iadeyi saymamalı (yoksa iade tavanı doldururdu).
create or replace function public.coin_gunluk_kalan(p_user uuid)
returns bigint language sql stable security definer set search_path to 'public' as $$
  select greatest(0, public.ayar_sayi('coin_gunluk_tavan', 400) - coalesce((
    select sum(h.miktar) from public.coin_hareketleri h
    where h.user_id = p_user and h.miktar > 0
      and h.tur not in ('satin_alma', 'baslangic', 'ikram_iade')
      and (h.olusturuldu at time zone 'Europe/Istanbul')::date
          = (now() at time zone 'Europe/Istanbul')::date
  ), 0));
$$;

-- ---- "Rahatsız etme" ayarı ----
create or replace function public.rahatsiz_etme_ayarla(p_kapali boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $rea$
declare v_yeni boolean;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  update public.profiles set rahatsiz_etme = coalesce(p_kapali, false)
   where id = auth.uid()
  returning rahatsiz_etme into v_yeni;
  return v_yeni;
end;
$rea$;

grant execute on function public.rahatsiz_etme_ayarla(boolean) to authenticated;
