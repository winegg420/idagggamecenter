-- ============================================================
-- KADEMELİ LİG — 5 kademe + haftalık sezon
--
-- Şu ana kadar tek bir puan havuzu vardı, üç görünüm olarak gösteriliyordu
-- (Şehir / Ülke / Dünya). O görünümler AYNEN KALIYOR ama ödülsüz "gurur
-- tablosu" oldular; üstüne kademeli lig geliyor.
--
--   Bronz → Gümüş → Altın → Elmas → Efsane
--
-- Her lig 25 kişilik GRUPLARA bölünür. Lig başına oyuncu sınırı YOK,
-- sınır gruptadır: Bronz'da 400 kişi varsa 16 grup açılır. Grup yalnız
-- haftalık sıralama tablosudur — kiminle eşleştiğinle HİÇBİR ilgisi yok
-- (eşleşme lig sınırına bakar, bkz. migration 150).
--
-- Hafta sonunda grubun ilk 5'i yükselir, son 5'i düşer, ortadakiler kalır.
-- Üst lige çıkmak için 400 kişi arasında birinci olmak gerekmez; kendi
-- 25 kişilik grubunda ilk 5 yeterli. Sezon pazartesi 00:00 TSİ sıfırlanır.
--
-- Grup doldurma: ÖNCE GERÇEK OYUNCULAR, botlar yalnız boşluğu kapatır.
-- Bir grupta en fazla 15 bot ve asla yarıdan fazlası bot olamaz. Gerçek
-- oyuncu azsa grup 25 yerine 15 kişilik açılır, botla şişirilmez —
-- oyun büyüdükçe botlar kendiliğinden seyrelir.
--
-- BOTLAR LİG DEĞİŞTİRMEZ: sabit ligde kalır, yalnız grup içinde yer
-- değiştirir. Yoksa zamanla hepsi Efsane'ye çıkar ve gerçek oyuncular
-- bot denizinde boğulur.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger) values
  ('lig_odul_bronz_1',  '100'::jsonb), ('lig_odul_bronz_2',  '50'::jsonb),  ('lig_odul_bronz_3',  '25'::jsonb),
  ('lig_odul_gumus_1',  '125'::jsonb), ('lig_odul_gumus_2',  '65'::jsonb),  ('lig_odul_gumus_3',  '30'::jsonb),
  ('lig_odul_altin_1',  '150'::jsonb), ('lig_odul_altin_2',  '75'::jsonb),  ('lig_odul_altin_3',  '40'::jsonb),
  ('lig_odul_elmas_1',  '200'::jsonb), ('lig_odul_elmas_2',  '100'::jsonb), ('lig_odul_elmas_3',  '50'::jsonb),
  ('lig_odul_efsane_1', '250'::jsonb), ('lig_odul_efsane_2', '125'::jsonb), ('lig_odul_efsane_3', '60'::jsonb),
  ('lig_grup_boyu',        '25'::jsonb),
  ('lig_grup_boyu_kucuk',  '15'::jsonb),
  ('lig_kucuk_esik',       '10'::jsonb),
  ('lig_grup_bot_tavani',  '15'::jsonb),
  ('lig_yukselen',          '5'::jsonb),
  ('lig_dusen',             '5'::jsonb),
  ('lig_pasif_dusme_hafta',  '2'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;

-- ---- Haftalık grup üyeliği ----
create table if not exists public.lig_uyelik (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  hafta       date not null,
  lig         text not null,
  grup_no     int  not null,
  mac_sayisi  int  not null default 0,
  pasif_hafta int  not null default 0,
  primary key (user_id, hafta)
);
alter table public.lig_uyelik enable row level security;
create index if not exists lig_uyelik_grup_idx on public.lig_uyelik (hafta, lig, grup_no);

drop policy if exists lig_uyelik_oku on public.lig_uyelik;
create policy lig_uyelik_oku on public.lig_uyelik
  for select to authenticated using (true);

-- Sezon pazartesi 00:00 TSİ başlar/biter.
create or replace function public.lig_sezon_bitisi()
returns timestamptz language sql stable as $$
  select ((date_trunc('week', (now() at time zone 'Europe/Istanbul')) + interval '7 days')
          at time zone 'Europe/Istanbul');
$$;

grant execute on function public.lig_sezon_bitisi() to authenticated;

-- ---- Grupları kur ----
-- Bir lig için: gerçek oyuncular gruplara dağıtılır, kalan yerler botla
-- (tavana kadar) doldurulur. Gerçek oyuncu yoksa o ligde grup açılmaz.
create or replace function public.lig_gruplarini_kur(p_hafta date default null)
returns integer language plpgsql security definer set search_path to 'public' as $lgk$
declare
  v_hafta date := coalesce(p_hafta, public.hafta_basi());
  v_boyu int := public.ayar_sayi('lig_grup_boyu', 25)::int;
  v_kucuk int := public.ayar_sayi('lig_grup_boyu_kucuk', 15)::int;
  v_esik int := public.ayar_sayi('lig_kucuk_esik', 10)::int;
  v_bot_tavan int := public.ayar_sayi('lig_grup_bot_tavani', 15)::int;
  v_lig text;
  v_gercek int;
  v_grup_boyu int;
  v_grup_sayisi int;
  v_bot_sinir int;
  v_toplam int := 0;
  r record;
  v_i int;
begin
  foreach v_lig in array array['bronz','gumus','altin','elmas','efsane'] loop
    select count(*) into v_gercek
      from public.profiles p
     where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig;

    -- Gerçek oyuncu yoksa grup açma: bot dolu tablo kimseye bir şey anlatmaz.
    if v_gercek = 0 then continue; end if;

    -- Gerçek oyuncu azsa küçük grup: botla şişirmek yerine daralt.
    v_grup_boyu := case when v_gercek < v_esik then v_kucuk else v_boyu end;
    v_grup_sayisi := greatest(1, ceil(v_gercek::numeric / v_grup_boyu)::int);
    -- "asla yarıdan fazlası bot olmasın" + "en fazla 15 bot"
    v_bot_sinir := least(v_bot_tavan, floor((v_grup_boyu - 1) / 2.0)::int);

    -- Gerçek oyuncular gruplara sırayla (karışık) dağıtılır
    v_i := 0;
    for r in
      select p.id from public.profiles p
       where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
       order by random()
    loop
      insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
      values (r.id, v_hafta, v_lig, (v_i % v_grup_sayisi) + 1)
      on conflict (user_id, hafta) do update
        set lig = excluded.lig, grup_no = excluded.grup_no;
      v_i := v_i + 1;
      v_toplam := v_toplam + 1;
    end loop;

    -- Boşlukları bot doldurur (grup başına tavan kadar)
    for v_i in 1..v_grup_sayisi loop
      for r in
        select p.id from public.profiles p
         where coalesce(p.is_bot, false) and coalesce(p.bot_aktif, true)
           and coalesce(p.lig, 'bronz') = v_lig
           and not exists (select 1 from public.lig_uyelik u
                            where u.user_id = p.id and u.hafta = v_hafta)
         order by random()
         limit least(
           v_bot_sinir,
           greatest(0, v_grup_boyu - (select count(*) from public.lig_uyelik u
                                       where u.hafta = v_hafta and u.lig = v_lig
                                         and u.grup_no = v_i)))
      loop
        insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
        values (r.id, v_hafta, v_lig, v_i)
        on conflict (user_id, hafta) do nothing;
        v_toplam := v_toplam + 1;
      end loop;
    end loop;
  end loop;

  return v_toplam;
end;
$lgk$;

revoke all on function public.lig_gruplarini_kur(date) from public, authenticated, anon;

-- ---- Üyelik yoksa aç (yeni oyuncu: Bronz, boş kontenjanlı grup) ----
create or replace function public.lig_uyeligim_kur(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $luk$
declare
  v_hafta date := public.hafta_basi();
  v_lig text;
  v_boyu int;
  v_gercek int;
  v_grup int;
begin
  if exists (select 1 from public.lig_uyelik where user_id = p_user and hafta = v_hafta) then
    return;
  end if;

  select coalesce(lig, 'bronz') into v_lig from public.profiles where id = p_user;
  if v_lig is null then return; end if;

  select count(*) into v_gercek
    from public.profiles p
   where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig;
  v_boyu := case when v_gercek < public.ayar_sayi('lig_kucuk_esik', 10)::int
                 then public.ayar_sayi('lig_grup_boyu_kucuk', 15)::int
                 else public.ayar_sayi('lig_grup_boyu', 25)::int end;

  -- Yeri olan en dolu grup (gruplar dengeli dolsun, yeni grup en son açılsın)
  select u.grup_no into v_grup
    from public.lig_uyelik u
   where u.hafta = v_hafta and u.lig = v_lig
   group by u.grup_no
  having count(*) < v_boyu
   order by count(*) desc
   limit 1;

  if v_grup is null then
    select coalesce(max(u.grup_no), 0) + 1 into v_grup
      from public.lig_uyelik u where u.hafta = v_hafta and u.lig = v_lig;
  end if;

  insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
  values (p_user, v_hafta, v_lig, v_grup)
  on conflict (user_id, hafta) do nothing;
end;
$luk$;

-- ---- Lig ekranının okuduğu grup tablosu ----
-- TOPLAM OYUNCU SAYISI BİLEREK DÖNDÜRÜLMÜYOR: oyuncu yalnız kendi
-- grubunu görür ("Gümüş Lig · 7/25"), oyunun ne kadar kalabalık olduğunu
-- tahmin edemez.
create or replace function public.lig_grubum()
returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
              puan integer, ben boolean, bot boolean,
              lig text, grup_boyu integer, yukselen integer, dusen integer,
              sezon_bitis timestamptz)
language plpgsql security definer set search_path to 'public' as $lg$
declare
  v_me uuid := auth.uid();
  v_hafta date := public.hafta_basi();
  v_lig text;
  v_grup int;
  v_boyu int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  perform public.lig_uyeligim_kur(v_me);

  select u.lig, u.grup_no into v_lig, v_grup
    from public.lig_uyelik u where u.user_id = v_me and u.hafta = v_hafta;
  if v_lig is null then return; end if;

  select count(*)::int into v_boyu
    from public.lig_uyelik u
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup;

  return query
  select row_number() over (order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc),
         p.id, p.gorunen_ad, p.gorunen_avatar, p.puan_hafta,
         (p.id = v_me),
         -- Robot rozeti yalnız AÇIK botlara: gizli bot ayırt edilmemeli.
         (coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik'),
         v_lig, v_boyu,
         public.ayar_sayi('lig_yukselen', 5)::int,
         public.ayar_sayi('lig_dusen', 5)::int,
         public.lig_sezon_bitisi()
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
   order by 1;
end;
$lg$;

grant execute on function public.lig_grubum() to authenticated;

-- ---- Haftalık sezonu kapat ----
-- Grup içi sıralamaya göre: ilk 5 yükselir, son 5 düşer, ortadakiler kalır.
-- Efsane'nin üstü yok: son 5 Elmas'a düşer, ilk 5 kalır ve rozet alır.
-- Pasif oyuncu: 1 hafta hiç maç yapmazsa DÜŞMEZ, yerinde kalır;
-- 2 hafta üst üste pasifse bir lig düşer.
-- Botlar lig DEĞİŞTİRMEZ (bkz. başlık).
create or replace function public.lig_haftayi_kapat()
returns integer language plpgsql security definer set search_path to 'public' as $lhk$
declare
  v_hafta date := public.hafta_basi();
  v_yuk int := public.ayar_sayi('lig_yukselen', 5)::int;
  v_dus int := public.ayar_sayi('lig_dusen', 5)::int;
  v_pasif_esik int := public.ayar_sayi('lig_pasif_dusme_hafta', 2)::int;
  v_islenen int := 0;
  r record;
begin
  -- Aynı hafta iki kez kapanmasın (cron birden çok kez deneniyor).
  if (select deger #>> '{}' from public.oyun_ayarlari where anahtar = 'lig_son_kapanis')
     = v_hafta::text then
    return 0;
  end if;

  -- Haftalık maç sayısı: pasiflik buna bakar.
  update public.lig_uyelik u
     set mac_sayisi = (
       select count(*) from public.matches m
        where m.durum = 'bitti' and u.user_id in (m.oyuncu1, m.oyuncu2)
          and coalesce(m.bitis, m.created_at) >= v_hafta)
   where u.hafta = v_hafta;

  for r in
    select u.user_id, u.lig, u.grup_no, u.mac_sayisi, u.pasif_hafta,
           coalesce(p.is_bot, false) as bot,
           row_number() over (partition by u.lig, u.grup_no
                              order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc) as sira,
           count(*) over (partition by u.lig, u.grup_no) as grup_boyu,
           p.puan_hafta
      from public.lig_uyelik u
      join public.profiles p on p.id = u.user_id
     where u.hafta = v_hafta
  loop
    v_islenen := v_islenen + 1;

    -- Grup içi ödül (ilk üç) — botlara coin_ekle zaten vermiyor.
    if r.sira <= 3 then
      perform public.coin_ekle(
        r.user_id,
        public.ayar_sayi('lig_odul_' || r.lig || '_' || r.sira::text, 0),
        'lig', v_hafta::text || ':' || r.lig || ':' || r.grup_no::text);
    end if;

    if r.bot then
      continue;                      -- BOTLAR LİG DEĞİŞTİRMEZ
    end if;

    -- Pasiflik takibi
    if coalesce(r.mac_sayisi, 0) = 0 then
      update public.lig_uyelik set pasif_hafta = coalesce(pasif_hafta, 0) + 1
       where user_id = r.user_id and hafta = v_hafta;
    else
      update public.lig_uyelik set pasif_hafta = 0
       where user_id = r.user_id and hafta = v_hafta;
    end if;

    if coalesce(r.mac_sayisi, 0) = 0 then
      -- 1 hafta pasif: düşmez, yerinde kalır. Üst üste 2. haftada bir lig düşer.
      if coalesce(r.pasif_hafta, 0) + 1 >= v_pasif_esik then
        update public.profiles
           set lig = public.lig_adi(greatest(1, public.lig_sirasi(r.lig) - 1))
         where id = r.user_id;
      end if;
      continue;
    end if;

    if r.sira <= v_yuk then
      if r.lig = 'efsane' then
        perform public.award_badge(r.user_id, 'efsane_zirve');   -- üstü yok
      else
        update public.profiles
           set lig = public.lig_adi(least(5, public.lig_sirasi(r.lig) + 1))
         where id = r.user_id;
      end if;
    elsif r.sira > r.grup_boyu - v_dus then
      update public.profiles
         set lig = public.lig_adi(greatest(1, public.lig_sirasi(r.lig) - 1))
       where id = r.user_id;
    end if;
  end loop;

  -- Kapanış damgası (tekrar çalıştırmaya karşı)
  insert into public.oyun_ayarlari (anahtar, deger)
  values ('lig_son_kapanis', to_jsonb(v_hafta::text))
  on conflict (anahtar) do update set deger = excluded.deger;

  -- Yeni haftanın grupları: gruplar HER HAFTA yeniden karılır.
  perform public.lig_gruplarini_kur(v_hafta + 7);

  return v_islenen;
end;
$lhk$;

revoke all on function public.lig_haftayi_kapat() from public, authenticated, anon;

-- haftayi_kapat() 21:00 UTC'de puan_hafta'yı sıfırlıyor; lig kapanışı
-- ondan ÖNCE çalışmalı, yoksa sıralama boş puanlarla hesaplanır.
select cron.unschedule('bildim-lig-kapat')
  where exists (select 1 from cron.job where jobname = 'bildim-lig-kapat');
select cron.schedule('bildim-lig-kapat', '45 20 * * 0',
                     'select public.lig_haftayi_kapat()');

-- Bu haftanın grupları hemen kurulsun (sistem ilk günden çalışsın).
select public.lig_gruplarini_kur();

-- ---- Sıralamada robot rozeti YALNIZ açık botlara ----
-- Lig tablosu bot bayrağını gösteriyor (podyumda robot rozeti). Gizli
-- botun bayrağı açık olsaydı arayüz onları ele verirdi; gizli bot lig
-- tablosunda GÖRÜNÜR ama gerçek oyuncudan ayırt edilmez.
create or replace function public.lig_siralama(p_kapsam text default 'global', p_donem text default 'hafta')
 returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
               puan integer, sehir text, ulke text, ben boolean, bot boolean)
 language plpgsql security definer set search_path to 'public'
as $ls$
declare
  v_me uuid := auth.uid();
  v_ulke text;
  v_sehir text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_kapsam not in ('sehir', 'ulke', 'global') then raise exception 'Geçersiz kapsam'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir into v_ulke, v_sehir from public.profiles p where p.id = v_me;

  if p_kapsam in ('sehir', 'ulke') and v_ulke is null then
    raise exception 'Önce ülkeni ve şehrini seçmelisin';
  end if;
  if p_kapsam = 'sehir' and v_sehir is null then
    raise exception 'Önce şehrini seçmelisin';
  end if;

  return query
  with sirali as (
    select p.id,
           p.gorunen_ad as p_ad,
           p.gorunen_avatar as p_avatar,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as p_puan,
           p.sehir,
           p.ulke,
           (coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik') as p_bot,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.puan desc,
                      p.gorunen_ad asc
           ) as p_sira
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1
      and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.p_ad, s.p_avatar, s.p_puan, s.sehir, s.ulke,
         (s.id = v_me), s.p_bot
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$ls$;
