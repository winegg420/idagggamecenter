-- ============================================================
-- LİG TABLOSUNDA AÇIK BOT GÖRÜNMEZ
--
-- Ölçülen durum (14 Eyl 2026, canlı): /siralama › Bronz Lig 2. sırada
-- "ToyBot" (robot rozetiyle). `lig_gruplarini_kur` grupları doldururken
-- `bot_turu` ayırmadan TÜM botları alıyordu; `lig_grubum` ve
-- `lig_siralama` açık botu süzmüyor, yalnız `bot=true` diye işaretliyordu.
--
-- Kural: lig tablosunda yalnız gerçek oyuncular ve GİZLİ botlar olur.
-- Açık botların puanı/ligi ve mevcut `lig_uyelik` satırları SİLİNMEZ;
-- yalnız gösterimden, grup sayımından ve haftalık sıralamadan çıkarılır.
-- `bot` kolonu istemci uyumu için kalır (artık hep false döner).
-- ============================================================

-- ---- Açık bot mu? (tek yerde) ----
create or replace function public.acik_bot_mu(p_is_bot boolean, p_bot_turu text)
returns boolean
language sql
immutable
as $fn$
  select coalesce(p_is_bot, false) and coalesce(p_bot_turu, 'acik') = 'acik';
$fn$;

revoke all on function public.acik_bot_mu(boolean, text) from public, authenticated, anon;

-- ---- 1) Grubum ----
create or replace function public.lig_grubum()
returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text, puan integer,
              ben boolean, bot boolean, lig text, grup_boyu integer, yukselen integer,
              dusen integer, sezon_bitis timestamptz, gorunum jsonb)
language plpgsql
security definer
set search_path to 'public'
as $fn$
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

  -- Grup boyu da açık botsuz sayılır (yükselme/düşme çizgisi buna bakar).
  select count(*)::int into v_boyu
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
     and not public.acik_bot_mu(p.is_bot, p.bot_turu);

  return query
  select row_number() over (order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc),
         p.id, p.gorunen_ad, p.gorunen_avatar, p.puan_hafta,
         (p.id = v_me),
         public.acik_bot_mu(p.is_bot, p.bot_turu),
         v_lig, v_boyu,
         public.ayar_sayi('lig_yukselen', 5)::int,
         public.ayar_sayi('lig_dusen', 5)::int,
         public.lig_sezon_bitisi(),
         p.gorunum
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
     and not public.acik_bot_mu(p.is_bot, p.bot_turu)
   order by 1;
end;
$fn$;

-- ---- 2) Genel sıralama ----
create or replace function public.lig_siralama(p_kapsam text default 'global', p_donem text default 'hafta')
returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text, puan integer,
              sehir text, ulke text, ben boolean, bot boolean, gorunum jsonb)
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
           p.sehir, p.ulke, p.gorunum as p_gorunum,
           public.acik_bot_mu(p.is_bot, p.bot_turu) as p_bot,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.puan desc, p.gorunen_ad asc) as p_sira
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1
      and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
      and not public.acik_bot_mu(p.is_bot, p.bot_turu)
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.p_ad, s.p_avatar, s.p_puan, s.sehir, s.ulke,
         (s.id = v_me), s.p_bot, s.p_gorunum
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$fn$;

-- ---- 3) Yeni üye yerleşimi: kapasite açık botsuz sayılır ----
create or replace function public.lig_uyeligim_kur(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig
     and not public.acik_bot_mu(p.is_bot, p.bot_turu)
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
$fn$;

-- ---- 4) Haftalık grup kurulumu: boşlukları YALNIZ gizli bot doldurur ----
create or replace function public.lig_gruplarini_kur(p_hafta date default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
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

    -- Boşlukları GİZLİ bot doldurur (grup başına tavan kadar).
    -- ESKİDEN: tüm botlar — ToyBot gibi açık botlar lig tablosuna giriyordu.
    for v_i in 1..v_grup_sayisi loop
      for r in
        select p.id from public.profiles p
         where coalesce(p.is_bot, false) and coalesce(p.bot_aktif, true)
           and p.bot_turu = 'gizli'
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
$fn$;

-- ---- 5) Hafta kapanışı: açık bot sıralamaya ve ödüle girmez ----
create or replace function public.lig_haftayi_kapat()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
       -- Açık bot tabloda görünmediği için sıraya da girmez.
       and not public.acik_bot_mu(p.is_bot, p.bot_turu)
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
$fn$;
