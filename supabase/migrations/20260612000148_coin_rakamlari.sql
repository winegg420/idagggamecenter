-- ============================================================
-- Coin rakamları oyun_ayarlari'na taşındı
--
-- Onaylanmış ekonomi. Hiçbir rakam koda gömülü değil: kod bu tablodan
-- okur, değer SQL ile değiştirilince oyun anında yeni değeri kullanır.
--
--   Kazanç: galibiyet 25 · beraberlik 10 · mağlubiyet 0 · günlük görev 15
--           turnuva 1./2./3. 150/75/40 · turnuva katılım 10
--           meydandan turnuvaya 20 · reklam 25 (günde 5) · başlangıç 500
--           günlük coin tavanı 400
--   Günlük seri (yeni — şu ana kadar yalnız puan veriyordu):
--           1–2. gün 5 · 3–4. gün 10 · 5–6. gün 15 · 7+ 25 (sabit)
--   Jokerler: 50:50 40 · +10 sn 60 · Soru Değiştir 80
--   Paketler: 10'luk 400 · 30'luk 1.000 · 100'lük 3.000
--   Reklam: geçiş reklamı her 3 maçta bir, ilk 3 gün hiç reklam yok
--   Eşya fiyat aralıkları (katalog referansı): sıradan 300–600,
--           özel 1.200–2.500; etkinlik eşyaları satılmaz.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger) values
  ('coin_mac_galibiyet',       '25'::jsonb),
  ('coin_mac_beraberlik',      '10'::jsonb),
  ('coin_mac_maglubiyet',      '0'::jsonb),
  ('coin_gunluk_gorev',        '15'::jsonb),
  ('coin_turnuva_1',           '150'::jsonb),
  ('coin_turnuva_2',           '75'::jsonb),
  ('coin_turnuva_3',           '40'::jsonb),
  ('coin_turnuva_katilim',     '10'::jsonb),
  ('coin_meydan_katilim',      '20'::jsonb),
  ('coin_reklam',              '25'::jsonb),
  ('reklam_gunluk_tavan',      '5'::jsonb),
  ('coin_baslangic',           '500'::jsonb),
  ('coin_gunluk_tavan',        '400'::jsonb),
  ('coin_seri_1',              '5'::jsonb),
  ('coin_seri_3',              '10'::jsonb),
  ('coin_seri_5',              '15'::jsonb),
  ('coin_seri_7',              '25'::jsonb),
  ('coin_joker_elli',          '40'::jsonb),
  ('coin_joker_sure',          '60'::jsonb),
  ('coin_joker_soru_degistir', '80'::jsonb),
  ('reklam_gecis_mac_araligi', '3'::jsonb),
  ('reklam_muafiyet_gun',      '3'::jsonb),
  ('esya_fiyat_siradan_min',   '300'::jsonb),
  ('esya_fiyat_siradan_max',   '600'::jsonb),
  ('esya_fiyat_ozel_min',      '1200'::jsonb),
  ('esya_fiyat_ozel_max',      '2500'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;

-- Paket fiyatları (10'luk / 30'luk / 100'lük)
update public.joker_paketleri set coin_fiyat = 400  where urun_id = 'joker_10';
update public.joker_paketleri set coin_fiyat = 1000 where urun_id = 'joker_30';
update public.joker_paketleri set coin_fiyat = 3000 where urun_id = 'joker_100';

-- ---- Günlük coin tavanı ----
-- Oyunla kazanılan coin günde `coin_gunluk_tavan` ile sınırlı. Satın alma
-- ve hesap açılış hediyesi tavana TABİ DEĞİL (para ödeyen sınırlanmaz).
create or replace function public.coin_gunluk_kalan(p_user uuid)
returns bigint language sql stable security definer set search_path to 'public' as $$
  select greatest(0, public.ayar_sayi('coin_gunluk_tavan', 400) - coalesce((
    select sum(h.miktar) from public.coin_hareketleri h
    where h.user_id = p_user and h.miktar > 0
      and h.tur not in ('satin_alma', 'baslangic')
      and (h.olusturuldu at time zone 'Europe/Istanbul')::date
          = (now() at time zone 'Europe/Istanbul')::date
  ), 0));
$$;

grant execute on function public.coin_gunluk_kalan(uuid) to authenticated;

create or replace function public.coin_ekle(p_user uuid, p_miktar bigint, p_tur text, p_referans text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare
  v_bakiye bigint;
  v_bot boolean;
  v_miktar bigint := p_miktar;
  v_kalan bigint;
begin
  if p_user is null or coalesce(p_miktar, 0) <= 0 then return null; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return null; end if;

  -- GÜNLÜK TAVAN: oyunla kazanılan coin sınırlı, satın alınan değil.
  if p_tur not in ('satin_alma', 'baslangic') then
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
$$;

-- ---- Günlük görev ödülüne coin eklendi ----
create or replace function public.claim_quest(p_quest_id text)
returns boolean language plpgsql security definer set search_path to 'public' as $gorev$
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

  -- Coin ödülü de var artık; miktar ayar tablosundan gelir.
  -- Referans gün+görev: aynı görev iki kez ödüllendirilemez.
  perform public.coin_ekle(auth.uid(),
    public.ayar_sayi('coin_gunluk_gorev', 15), 'gorev',
    v_bugun::text || ':' || p_quest_id);
  return true;
end;
$gorev$;

grant execute on function public.claim_quest(text) to authenticated;

-- ---- Günlük seri artık coin de veriyor ----
-- Mevcut puan ödülü (seri * 5, tavan 50) aynen duruyor; coin ona eklendi.
-- 1–2. gün 5 · 3–4. gün 10 · 5–6. gün 15 · 7+ 25 (sabitlenir, artmaz).
-- Bir gün kaçırılırsa seri zaten 1'e dönüyor.
create or replace function public.seri_guncelle(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $seri$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  p public.profiles%rowtype;
  v_yeni int;
  v_coin bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found or coalesce(p.is_bot, false) then return; end if;
  if p.seri_son_gun = v_bugun then return; end if;   -- bugün zaten sayıldı

  if p.seri_son_gun = v_bugun - 1 then
    v_yeni := coalesce(p.seri_gun, 0) + 1;
  else
    v_yeni := 1;
  end if;

  update public.profiles
     set seri_gun = v_yeni,
         seri_son_gun = v_bugun,
         seri_en_uzun = greatest(coalesce(seri_en_uzun, 0), v_yeni),
         seri = v_yeni,
         son_seri_tarihi = v_bugun
   where id = p_user;

  v_coin := case
    when v_yeni >= 7 then public.ayar_sayi('coin_seri_7', 25)
    when v_yeni >= 5 then public.ayar_sayi('coin_seri_5', 15)
    when v_yeni >= 3 then public.ayar_sayi('coin_seri_3', 10)
    else public.ayar_sayi('coin_seri_1', 5)
  end;
  perform public.coin_ekle(p_user, v_coin, 'seri', v_bugun::text);

  if v_yeni in (3, 7, 14, 30, 60, 100) then
    perform public.bildirim_yaz(
      p_user, 'seri',
      '🔥 Serin ' || v_yeni || ' gün oldu! Yarın da gel, bozma.',
      '/bildim'
    );
  end if;
  if v_yeni >= 3 then perform public.award_badge(p_user, 'seri_3'); end if;
  if v_yeni >= 7 then perform public.award_badge(p_user, 'seri_7'); end if;
end;
$seri$;

-- ---- Turnuva coin ödülleri ----
-- Şampiyon 150, ikinci 75, üçüncü 40; katılan herkese 10.
-- (Eşyalar aynen duruyor; bu fonksiyon turnuva biterken çağrılıyor.)
create or replace function public.turnuva_odullerini_dagit(p_tournament_id uuid, p_kazanan uuid)
returns void language plpgsql security definer set search_path to 'public' as $tod$
declare
  r record;
  v_sira int := 0;
  v_odul bigint;
begin
  if p_kazanan is not null then
    perform public.esya_odul_ver(p_kazanan, 'spk_04', 'etkinlik');
    update public.profiles set turnuva_taci_at = now() where id = p_kazanan;
  end if;

  -- İlk üç: Yıldızlar efekti + dereceye göre coin
  for r in
    select tp.user_id
      from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
     order by tp.elendi asc, tp.elenme_sorusu desc nulls first, tp.dogru_sayisi desc
     limit 3
  loop
    v_sira := v_sira + 1;
    perform public.esya_odul_ver(r.user_id, 'efk_02', 'etkinlik');
    v_odul := case v_sira
      when 1 then public.ayar_sayi('coin_turnuva_1', 150)
      when 2 then public.ayar_sayi('coin_turnuva_2', 75)
      else public.ayar_sayi('coin_turnuva_3', 40) end;
    perform public.coin_ekle(r.user_id, v_odul, 'turnuva',
                             'derece:' || p_tournament_id::text || ':' || v_sira::text);
  end loop;

  -- Katılım ödülü: turnuvaya girmiş herkese (botlara coin_ekle zaten vermez).
  for r in
    select tp.user_id from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
  loop
    perform public.coin_ekle(r.user_id, public.ayar_sayi('coin_turnuva_katilim', 10),
                             'turnuva', 'katilim:' || p_tournament_id::text);
  end loop;
end;
$tod$;

-- ---- Tek joker satın alma ----
-- Paketler toplu alım; tek tek almak isteyen için birim fiyatlar
-- oyun_ayarlari'nda (50:50 40 · +10 sn 60 · Soru Değiştir 80).
create or replace function public.joker_tek_al(p_tur text)
returns table(bakiye bigint, adet integer)
language plpgsql security definer set search_path to 'public' as $jta$
declare
  v_me uuid := auth.uid();
  v_fiyat bigint;
  v_bakiye bigint;
  v_adet int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('joker_tek_al', 20, interval '60 seconds');

  v_fiyat := case p_tur
    when 'elli' then public.ayar_sayi('coin_joker_elli', 40)
    when 'sure' then public.ayar_sayi('coin_joker_sure', 60)
    when 'soru_degistir' then public.ayar_sayi('coin_joker_soru_degistir', 80)
    else null end;
  if v_fiyat is null then raise exception 'Bu joker tek tek satılmıyor'; end if;

  v_bakiye := public.coin_harca(v_fiyat, 'joker', 'tek:' || p_tur);
  v_adet := public.joker_hareket(v_me, p_tur, 1, 'satin_alma', 'tek:' || p_tur);

  return query select v_bakiye, v_adet;
end;
$jta$;

grant execute on function public.joker_tek_al(text) to authenticated;
