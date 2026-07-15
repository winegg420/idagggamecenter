-- ============================================================
-- KAFA TOPU — skor sahteciliği yaması + 2v2 takım dengesi
-- (Kod inceleme raporu Madde 1 ve 5)
--
-- Eski model: host tek başına final skoru bildirir, sunucu doğrulamadan
-- ELO işlerdi. Yeni model: HER oyuncu maç sonunda kendi gördüğü skoru
-- bildirir; sunucu ancak İKİ TAKIMDAN da uyuşan rapor gelince kesinleştirir.
--  - Raporlar uyuşmazsa maç 'iptal' olur, ELO işlenmez (hile kâr etmez).
--  - Tek taraflı kesinleştirme yalnızca rakip gerçekten koptuysa mümkündür:
--    rakip takımın son nabzı 25 sn'den eski VE rapor 15 sn beklemişse.
--    Nabız, maç sırasında istemcilerin 10 sn'de bir çağırdığı
--    kafatopu_nabiz ile tazelenir — rakip oyundayken sahte skor
--    kesinleştirilemez.
--  - Oyuncunun İLK bildirimi sabitlenir (sonradan değiştirilemez).
--  - Skor tavanı 50 → 20'ye indirildi (2 dk maçta gerçekçi üst sınır).
-- ============================================================

-- ---------- Kolonlar ----------
alter table public.kafatopu_mac_oyunculari
  add column if not exists bildirilen_skor1 int,
  add column if not exists bildirilen_skor2 int,
  add column if not exists bildirim_zamani timestamptz,
  add column if not exists nabiz_zamani timestamptz;

-- ---------- Nabız (maç sırasında canlılık kanıtı) ----------
create or replace function public.kafatopu_nabiz(p_mac_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  update public.kafatopu_mac_oyunculari
     set nabiz_zamani = now()
   where mac_id = p_mac_id and user_id = auth.uid();
end;
$$;
revoke execute on function public.kafatopu_nabiz(uuid) from public, anon;
grant execute on function public.kafatopu_nabiz(uuid) to authenticated;

-- ---------- Sonuç kaydı: iki taraflı onay ----------
-- Dönüş tipi değiştiği için eski fonksiyon düşürülür.
drop function if exists public.kafatopu_sonuc_kaydet(uuid, int, int);

create function public.kafatopu_sonuc_kaydet(
  p_mac_id uuid, p_skor1 int, p_skor2 int
)
returns text  -- 'bitti' | 'onay_bekliyor' | 'iptal'
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.kafatopu_maclar%rowtype;
  rapor_takim_sayisi int;
  ilk_bildirim timestamptz;
  rakip_nabiz timestamptz;
  f1 int; f2 int;          -- kesinleşecek skor (uyuşan raporlardan)
  onayli boolean := false;
  r1 numeric; r2 numeric; e1 numeric; s1 numeric;
  kazanan smallint; o record; delta int;
  k constant numeric := 32;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_skor1 < 0 or p_skor2 < 0 or p_skor1 > 20 or p_skor2 > 20 then
    raise exception 'Geçersiz skor';
  end if;

  select * into m from public.kafatopu_maclar where id = p_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.durum = 'bitti' then return 'bitti'; end if;
  if m.durum = 'iptal' then return 'iptal'; end if;

  -- Raporu yaz: ilk bildirim sabit kalır (coalesce), nabız tazelenir.
  update public.kafatopu_mac_oyunculari
     set bildirilen_skor1 = coalesce(bildirilen_skor1, p_skor1),
         bildirilen_skor2 = coalesce(bildirilen_skor2, p_skor2),
         bildirim_zamani  = coalesce(bildirim_zamani, now()),
         nabiz_zamani     = now()
   where mac_id = p_mac_id and user_id = auth.uid();
  if not found then raise exception 'Bu maçta değilsin'; end if;

  -- Uyuşmazlık: herhangi iki rapor farklıysa maç iptal, ELO işlenmez.
  if exists (
    select 1
      from public.kafatopu_mac_oyunculari a
      join public.kafatopu_mac_oyunculari b
        on b.mac_id = a.mac_id and b.id > a.id
     where a.mac_id = p_mac_id
       and a.bildirim_zamani is not null and b.bildirim_zamani is not null
       and (a.bildirilen_skor1 <> b.bildirilen_skor1
         or a.bildirilen_skor2 <> b.bildirilen_skor2)
  ) then
    update public.kafatopu_maclar
       set durum = 'iptal', bitis = now() where id = p_mac_id;
    return 'iptal';
  end if;

  -- Onay durumu: kaç takımdan rapor var?
  select count(distinct takim), min(bildirim_zamani)
    into rapor_takim_sayisi, ilk_bildirim
    from public.kafatopu_mac_oyunculari
   where mac_id = p_mac_id and bildirim_zamani is not null;

  select bildirilen_skor1, bildirilen_skor2 into f1, f2
    from public.kafatopu_mac_oyunculari
   where mac_id = p_mac_id and bildirim_zamani is not null
   limit 1;

  if rapor_takim_sayisi >= 2 then
    onayli := true; -- iki taraf da aynı skoru onayladı
  else
    -- Tek taraflı: rapor vermeyen takım(lar) gerçekten kopuk mu?
    select max(o2.nabiz_zamani) into rakip_nabiz
      from public.kafatopu_mac_oyunculari o2
     where o2.mac_id = p_mac_id
       and o2.takim not in (
         select distinct t.takim from public.kafatopu_mac_oyunculari t
          where t.mac_id = p_mac_id and t.bildirim_zamani is not null
       );
    if (rakip_nabiz is null or rakip_nabiz < now() - interval '25 seconds')
       and ilk_bildirim < now() - interval '15 seconds' then
      onayli := true;
    end if;
  end if;

  if not onayli then return 'onay_bekliyor'; end if;

  -- ---------- Kesinleştirme (ELO) ----------
  kazanan := case when f1 > f2 then 1 when f2 > f1 then 2 else null end;
  s1 := case when kazanan = 1 then 1 when kazanan = 2 then 0 else 0.5 end;

  update public.kafatopu_maclar
     set durum = 'bitti', skor1 = f1, skor2 = f2,
         kazanan_takim = kazanan, bitis = now()
   where id = p_mac_id;

  select avg(puan_once) filter (where takim = 1),
         avg(puan_once) filter (where takim = 2)
    into r1, r2
    from public.kafatopu_mac_oyunculari where mac_id = p_mac_id;
  e1 := 1 / (1 + power(10, (r2 - r1) / 400.0));

  for o in
    select * from public.kafatopu_mac_oyunculari where mac_id = p_mac_id
  loop
    if m.tur = 'ranked' then
      delta := round(k * ((case when o.takim = 1 then s1 else 1 - s1 end)
                        - (case when o.takim = 1 then e1 else 1 - e1 end)));
    else
      delta := 0;
    end if;

    update public.kafatopu_mac_oyunculari
       set puan_degisim = delta where id = o.id;

    update public.kafatopu_profiller
       set puan = greatest(100, puan + delta),
           mac_sayisi = mac_sayisi + 1,
           galibiyet = galibiyet + case when kazanan = o.takim then 1 else 0 end,
           beraberlik = beraberlik + case when kazanan is null then 1 else 0 end,
           maglubiyet = maglubiyet + case when kazanan is not null and kazanan <> o.takim then 1 else 0 end,
           atilan_gol = atilan_gol + case when o.takim = 1 then f1 else f2 end,
           yenen_gol = yenen_gol + case when o.takim = 1 then f2 else f1 end,
           updated_at = now()
     where user_id = o.user_id;
  end loop;

  return 'bitti';
end;
$$;

revoke execute on function public.kafatopu_sonuc_kaydet(uuid, int, int) from public, anon;
grant execute on function public.kafatopu_sonuc_kaydet(uuid, int, int) to authenticated;

-- ---------- 2v2 takım dengesi (rapor Madde 5) ----------
-- Eşleşen 4 kişi, ELO toplamları en dengeli olacak şekilde takımlara bölünür:
-- ben + en uygun partner bir takımda, kalan ikisi diğerinde.
create or replace function public.kafatopu_mac_bul(p_mod text, p_tur text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  benim_puan int;
  benim_kafa text;
  benim_yetenek text;
  aktif_mac uuid;
  yeni_mac uuid;
  gereken int;
  adaylar uuid[];
  puanlar int[];
  i int;
  u uuid;
  en_iyi_i int := 1;
  en_iyi_fark int := 2147483647;
  fark int;
  toplam int;
  partner uuid;
  digerler uuid[];
begin
  if ben is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('1v1','2v2') then raise exception 'Geçersiz mod'; end if;
  if p_tur not in ('ranked','hizli') then raise exception 'Geçersiz tür'; end if;

  select m.id into aktif_mac
    from public.kafatopu_maclar m
    join public.kafatopu_mac_oyunculari o on o.mac_id = m.id
   where o.user_id = ben and m.durum = 'aktif'
   order by m.created_at desc
   limit 1;
  if aktif_mac is not null then
    delete from public.kafatopu_kuyruk where user_id = ben;
    return aktif_mac;
  end if;

  insert into public.kafatopu_profiller (user_id)
  values (ben) on conflict (user_id) do nothing;
  select puan, kafa, yetenek into benim_puan, benim_kafa, benim_yetenek
    from public.kafatopu_profiller where user_id = ben;

  perform pg_advisory_xact_lock(hashtext('kafatopu_kuyruk'));

  insert into public.kafatopu_kuyruk (user_id, mod, tur, puan)
  values (ben, p_mod, p_tur, benim_puan)
  on conflict (user_id) do update
    set mod = excluded.mod, tur = excluded.tur, puan = excluded.puan;

  gereken := case when p_mod = '1v1' then 2 else 4 end;

  select array_agg(s.user_id), array_agg(s.puan) into adaylar, puanlar from (
    select k2.user_id, k2.puan
      from public.kafatopu_kuyruk k2
     where k2.mod = p_mod and k2.tur = p_tur and k2.user_id <> ben
     order by case when p_tur = 'ranked' then abs(k2.puan - benim_puan) else 0 end,
              k2.created_at
     limit gereken - 1
  ) s;

  if adaylar is null or array_length(adaylar, 1) < gereken - 1 then
    return null;
  end if;

  insert into public.kafatopu_maclar (mod, tur)
  values (p_mod, p_tur)
  returning id into yeni_mac;

  if p_mod = '1v1' then
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    values (yeni_mac, ben, 1, 0, benim_kafa, benim_yetenek, benim_puan);
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    select yeni_mac, adaylar[1], 2, 1, p.kafa, p.yetenek, p.puan
      from public.kafatopu_profiller p where p.user_id = adaylar[1];
  else
    -- En dengeli bölünme: partner adayı seç (|takım1 - takım2| toplam farkı min).
    toplam := puanlar[1] + puanlar[2] + puanlar[3];
    for i in 1..3 loop
      fark := abs((benim_puan + puanlar[i]) - (toplam - puanlar[i]));
      if fark < en_iyi_fark then
        en_iyi_fark := fark;
        en_iyi_i := i;
      end if;
    end loop;
    partner := adaylar[en_iyi_i];
    digerler := array(select x from unnest(adaylar) x where x <> partner);

    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    values (yeni_mac, ben, 1, 0, benim_kafa, benim_yetenek, benim_puan);
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    select yeni_mac, partner, 1, 2, p.kafa, p.yetenek, p.puan
      from public.kafatopu_profiller p where p.user_id = partner;
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    select yeni_mac, digerler[1], 2, 1, p.kafa, p.yetenek, p.puan
      from public.kafatopu_profiller p where p.user_id = digerler[1];
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    select yeni_mac, digerler[2], 2, 3, p.kafa, p.yetenek, p.puan
      from public.kafatopu_profiller p where p.user_id = digerler[2];
  end if;

  delete from public.kafatopu_kuyruk
   where user_id = ben or user_id = any(adaylar);

  return yeni_mac;
end;
$$;
