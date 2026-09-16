-- ============================================================
-- 201 — PUAN VE COIN EKONOMİSİ YENİDEN DENGELENİYOR (Paket 14, aşama 3)
--
-- Lig = birikimli emek. Günlük lig tavanı yok. Tüm sayılar oyun_ayarlari'nda.
--   Normal Maç (1v1)  dereceli: galibiyet +25, berabere +10 lig; coin 25/10
--   Hızlı Mod         dereceli: doğru×3 lig (tavan 25), doğru×3 coin (tavan 25)
--   Düello            dereceli: galibiyet +50 lig, 50 coin (aşama 4'te bağlanır)
--   Turnuva           1. +150 · 2. +80 · 3. +40 · 4-10. +20 · diğer katılan +10
--   Serbest giriş     lig 0, coin %50 (serbest_coin_carpani)
--   Günlük seri       least(seri×3, 15)  (eski: least(seri×5, 50))
--   Arkadaş daveti    lig puanı YOK → iki tarafa 200 coin ('davet')
--   Grup Maçı         ÖDÜLSÜZ: coin yok, lig yok, seri yok; yalnız rozet
--
-- İNDİRİMLER ÇARPILMAZ (3.7): odul_carpani tek yerde, uygulanabilir
-- çarpanların EN DÜŞÜĞÜNÜ alır (çift koruması / serbest / açık bot);
-- coin_mac_odulu onu kullanır.
-- ÇİFT KORUMASI LİG PUANINDA (3.8): 1v1'de galibiyet lig puanı zaten
-- cift_odul_carpani ile çarpılıyordu (migration 162, ölçüldü); beraberlik
-- puanı da aynı çarpanla. Çift sayacı artık serbest maçları da sayar —
-- serbest giriş de coin veriyor.
--
-- Fonksiyonlar canlıdaki son tanımlarından alınıp hedefli değiştirildi.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('lig_mac_galibiyet', '25', 'Normal Maç (dereceli) galibiyet lig puanı'),
  ('lig_mac_beraberlik', '10', 'Normal Maç (dereceli) beraberlik lig puanı'),
  ('lig_duello_galibiyet', '50', 'Düello (dereceli) galibiyet lig puanı'),
  ('coin_duello_galibiyet', '50', 'Düello galibiyet coin'),
  ('hizli_mod_puan_dogru', '3', 'Hızlı Mod: doğru başına lig puanı'),
  ('hizli_mod_lig_tavan', '25', 'Hızlı Mod: oturum başına lig puanı tavanı'),
  ('hizli_mod_coin_dogru', '3', 'Hızlı Mod: doğru başına coin'),
  ('hizli_mod_coin_tavan', '25', 'Hızlı Mod: oturum başına coin tavanı'),
  ('lig_turnuva_1', '150', 'Turnuva 1.si lig puanı'),
  ('lig_turnuva_2', '80', 'Turnuva 2.si lig puanı'),
  ('lig_turnuva_3', '40', 'Turnuva 3.sü lig puanı'),
  ('lig_turnuva_ilk10', '20', 'Turnuva 4-10. sıra lig puanı'),
  ('lig_turnuva_katilim', '10', 'Turnuva diğer katılımcılar lig puanı'),
  ('seri_carpan', '3', 'Günlük seri bonusu: seri günü × bu'),
  ('seri_tavan', '15', 'Günlük seri bonusu tavanı'),
  ('davet_coin', '200', 'Arkadaş daveti: iki tarafa coin'),
  ('serbest_coin_carpani', '0.5', 'Serbest (derecesiz) girişte coin çarpanı')
on conflict (anahtar) do nothing;

update public.oyun_ayarlari set deger = '25' where anahtar = 'coin_mac_galibiyet';
update public.oyun_ayarlari set deger = '10' where anahtar = 'coin_mac_beraberlik';

-- Tercih: son seçilen Dereceli/Serbest anahtarı profilde de tutulur
alter table public.profiles add column if not exists dereceli_tercih boolean not null default true;

create or replace function public.dereceli_tercih_kaydet(p_dereceli boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  update public.profiles set dereceli_tercih = coalesce(p_dereceli, true) where id = auth.uid();
end;
$$;
revoke execute on function public.dereceli_tercih_kaydet(boolean) from public, anon;
grant execute on function public.dereceli_tercih_kaydet(boolean) to authenticated;

-- Hızlı Mod oturumu: dereceli/serbest + kazanılan ödül
alter table public.hizli_mod_oturumlar add column if not exists dereceli boolean not null default true;
alter table public.hizli_mod_oturumlar add column if not exists lig_puan int not null default 0;
alter table public.hizli_mod_oturumlar add column if not exists kazanilan_coin int not null default 0;

-- Idempotency: aynı oturum / aynı davet iki kez coin yazamaz
create unique index if not exists coin_hareketleri_hizli_mod_tek
  on public.coin_hareketleri (user_id, tur, referans)
  where tur = 'hizli_mod' and referans is not null;
create unique index if not exists coin_hareketleri_davet_tek
  on public.coin_hareketleri (user_id, tur, referans)
  where tur = 'davet' and referans is not null;

CREATE OR REPLACE FUNCTION public.coin_ekle(p_user uuid, p_miktar bigint, p_tur text, p_referans text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bakiye bigint;
  v_bot boolean;
  v_miktar bigint := p_miktar;
  v_kalan bigint;
begin
  if p_user is null or coalesce(p_miktar, 0) <= 0 then return null; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return null; end if;

  -- 'davet' tek seferlik hoş geldin ödülü: günlük tavana takılmaz (Paket 14, 3.4)
  if p_tur not in ('satin_alma', 'baslangic', 'ikram_iade', 'davet') then
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
$function$;


-- ---- İndirimler tek yerde: EN DÜŞÜK çarpan, çarpım yok ----
create or replace function public.odul_carpani(p_cift numeric, p_serbest boolean, p_acik_bot boolean)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select least(
    coalesce(p_cift, 1),
    case when coalesce(p_serbest, false) then public.ayar_ondalik('serbest_coin_carpani', 0.5) else 1 end,
    case when coalesce(p_acik_bot, false) then public.ayar_ondalik('coin_bot_carpani', 0.5) else 1 end
  );
$$;
revoke execute on function public.odul_carpani(numeric, boolean, boolean) from public, anon, authenticated;

drop function if exists public.coin_mac_odulu(text, uuid, uuid[], numeric);
create or replace function public.coin_mac_odulu(
  p_referans text, p_kazanan uuid, p_oyuncular uuid[], p_carpan numeric default 1,
  p_serbest boolean default false, p_acik_bot boolean default false,
  p_galibiyet_anahtar text default 'coin_mac_galibiyet'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_galibiyet bigint := public.ayar_sayi(coalesce(p_galibiyet_anahtar, 'coin_mac_galibiyet'), 25);
  v_beraberlik bigint := public.ayar_sayi('coin_mac_beraberlik', 10);
  v_serbest boolean := coalesce(p_serbest, false);
  v_carpan numeric;
  v_oyuncu uuid;
  v_mac_id uuid;
  v_dereceli boolean;
begin
  if p_referans is null then return; end if;

  -- Referans bir 1v1 maç id'siyse serbest bilgisi maçın kendisinden okunur.
  begin
    v_mac_id := p_referans::uuid;
  exception when others then
    v_mac_id := null;
  end;
  if v_mac_id is not null then
    select coalesce(m.dereceli, true) into v_dereceli from public.matches m where m.id = v_mac_id;
    if found and not v_dereceli then v_serbest := true; end if;
  end if;

  v_carpan := public.odul_carpani(p_carpan, v_serbest, p_acik_bot);
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
revoke execute on function public.coin_mac_odulu(text, uuid, uuid[], numeric, boolean, boolean, text) from public, anon, authenticated;

-- ---- Çift sayacı serbest maçları da sayar ----
create or replace function public.cift_odul_carpani(p_a uuid, p_b uuid, p_mac_id uuid default null)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
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
    and ((m.oyuncu1 = p_a and m.oyuncu2 = p_b) or (m.oyuncu1 = p_b and m.oyuncu2 = p_a))
    and (coalesce(m.bitis, m.created_at) at time zone 'Europe/Istanbul')::date = v_bugun
    and (p_mac_id is null or m.id <> p_mac_id);

  v_sira := v_sira + 1;   -- bu maç kaçıncı olacak

  if v_sira <= v_tam then return 1; end if;
  if v_sira <= v_yari then return 0.5; end if;
  return 0;
end;
$$;

-- ---- Günlük seri bonusu (lig puanı) tek yerde ----
create or replace function public.gunluk_seri_bonusu(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni int;
  v_bonus int;
begin
  select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = p_user and not coalesce(is_bot, false);
  if not found or v_tarih is not distinct from v_bugun then return 0; end if;
  v_yeni := case when v_tarih = v_bugun - 1 then coalesce(v_seri, 0) + 1 else 1 end;
  v_bonus := least(v_yeni * public.ayar_sayi('seri_carpan', 3),
                   public.ayar_sayi('seri_tavan', 15))::int;
  update public.profiles
     set seri = v_yeni, son_seri_tarihi = v_bugun,
         puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
   where id = p_user;
  if v_yeni >= 3 then perform public.award_badge(p_user, 'seri_3'); end if;
  if v_yeni >= 7 then perform public.award_badge(p_user, 'seri_7'); end if;
  return v_bonus;
end;
$$;
revoke execute on function public.gunluk_seri_bonusu(uuid) from public, anon, authenticated;

-- ---- 1v1 maç sonucu ----
create or replace function public.mac_sonuclandir(p_match_id uuid, p_kazanan uuid, p_kaybeden uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_carpan numeric := 1;
  v_lig int;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_bot_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
  v_oyuncu_bot boolean;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (m.oyuncu1, m.oyuncu2);

  if coalesce(v_bot_var, false) then
    v_carpan := 1;                       -- bot maçında çift limiti yok
  else
    v_carpan := public.cift_odul_carpani(m.oyuncu1, m.oyuncu2, p_match_id);
  end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(),
         odul_carpan = v_carpan,
         dostluk = (v_carpan = 0)
   where id = p_match_id;

  -- Coin: dereceli tam, serbest %50; indirimler çarpılmaz (coin_mac_odulu).
  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2],
                                v_carpan, not coalesce(m.dereceli, true), coalesce(v_acik_bot, false));

  if p_kazanan is not null then
    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
  end if;

  -- SERBEST MAÇ: lig puanı yok, seri yok. Yalnız coin (%50) + rozet.
  if not coalesce(m.dereceli, true) then
    return;
  end if;

  -- LİG PUANI: galibiyet / beraberlik; çift çarpanı lig puanına da uygulanır.
  if p_kazanan is not null then
    select coalesce(is_bot, false) into v_oyuncu_bot from public.profiles where id = p_kazanan;
    v_lig := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * v_carpan *
                   (case when v_oyuncu_bot then v_bot_yuzde else 1 end))::int;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = p_kazanan;
    end if;

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
  else
    foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
      select coalesce(is_bot, false) into v_oyuncu_bot from public.profiles where id = v_oyuncu;
      v_lig := floor(public.ayar_sayi('lig_mac_beraberlik', 10) * v_carpan *
                     (case when v_oyuncu_bot then v_bot_yuzde else 1 end))::int;
      if v_lig > 0 then
        update public.profiles
           set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
         where id = v_oyuncu;
      end if;
    end loop;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    perform public.gunluk_seri_bonusu(v_oyuncu);
  end loop;
end;
$$;

-- ---- Arkadaş daveti: lig puanı yok, iki tarafa coin ----
create or replace function public.claim_referral(p_davet_eden uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil public.profiles%rowtype;
  v_coin bigint := public.ayar_sayi('davet_coin', 200);
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_davet_eden = auth.uid() then return false; end if;

  select * into v_profil from public.profiles where id = auth.uid() for update;
  if not found then return false; end if;
  if v_profil.davet_eden is not null then return false; end if;
  if v_profil.created_at < now() - interval '24 hours' then return false; end if;

  if not exists (
    select 1 from public.profiles where id = p_davet_eden and not is_bot
  ) then
    return false;
  end if;

  update public.profiles set davet_eden = p_davet_eden where id = auth.uid();
  update public.profiles set davet_sayisi = davet_sayisi + 1 where id = p_davet_eden;

  -- Aynı cihaz/IP'den açılan ikinci hesap davet coini almaz (sessiz koruma).
  if not public.ayni_cihaz_mi(auth.uid(), p_davet_eden) then
    -- Davet edilen: referans = davet eden (hesap başına bir kez)
    perform public.coin_ekle(auth.uid(), v_coin, 'davet', p_davet_eden::text);
    -- Davet eden: referans = davet edilen (her yeni arkadaş için bir kez)
    perform public.coin_ekle(p_davet_eden, v_coin, 'davet', auth.uid()::text);
  end if;

  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.advance_group_match(p_group_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
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
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found or gm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. grup_mac_nabiz)
  if not coalesce(gm.basladi, true) then return; end if;
  if gm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.group_match_players
  where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.group_match_answers
  where group_match_id = p_group_match_id and soru_index = gm.aktif_soru;

  -- Soru Degistir jokeri: kisisel sayaci dolmamis oyuncu beklenir
  if v_cevap_sayisi < v_toplam_oyuncu
     and now() < public.soru_son_baslangic('grup', p_group_match_id, gm.aktif_soru, gm.soru_baslangic) + interval '16 seconds' then
    return;
  end if;

  if gm.aktif_soru + 1 >= coalesce(array_length(gm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 then
      select user_id into v_kazanan
      from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- birden fazla kişi en yüksek skorda: berabere
    end if;

    update public.group_matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_group_match_id;

    -- GRUP MAÇI = ÖDÜLSÜZ ARKADAŞ MODU (Paket 14, 3.5): coin yok, lig puanı yok,
    -- günlük seri bonusu yok. Yalnız rozetler verilir.
    if v_kazanan is not null then
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.group_match_answers
          where group_match_id = p_group_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(gm.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

  else
    update public.group_matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$function$;


CREATE OR REPLACE FUNCTION public.advance_tournament(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
  v_en_iyi int;
  v_zirve int;
  v_altin uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;

  if now() < t.soru_baslangic + interval '16 seconds' then
    if exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = p_tournament_id and not tp.elendi
        and not exists (
          select 1 from public.tournament_answers ta
          where ta.tournament_id = p_tournament_id
            and ta.user_id = tp.user_id
            and ta.soru_index = t.aktif_soru
        )
    ) then
      return;
    end if;
  end if;

  select count(*) into v_elenecek
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id and not tp.elendi
    and not exists (
      select 1 from public.tournament_answers ta
      where ta.tournament_id = p_tournament_id
        and ta.user_id = tp.user_id
        and ta.soru_index = t.aktif_soru
        and ta.dogru
    );

  select count(*) into v_kalan
  from public.tournament_players
  where tournament_id = p_tournament_id and not elendi;

  -- Hayattakilerin HEPSİ yanlış yaptıysa kimse elenmez (berabere tur).
  if v_elenecek < v_kalan then
    update public.tournament_players tp
       set elendi = true, elenme_sorusu = t.aktif_soru
     where tp.tournament_id = p_tournament_id and not tp.elendi
       and not exists (
         select 1 from public.tournament_answers ta
         where ta.tournament_id = p_tournament_id
           and ta.user_id = tp.user_id
           and ta.soru_index = t.aktif_soru
           and ta.dogru
       );
    v_kalan := v_kalan - v_elenecek;
  end if;

  if v_kalan = 1 then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi;

  elsif t.aktif_soru + 1 >= coalesce(array_length(t.soru_ids, 1), 0) then
    -- SORULAR BİTTİ. Tek bir zirve varsa o kazanır; eşitlik varsa ALTIN SORU.
    select max(dogru_sayisi) into v_en_iyi
      from public.tournament_players
     where tournament_id = p_tournament_id and not elendi;

    select count(*) into v_zirve
      from public.tournament_players
     where tournament_id = p_tournament_id and not elendi
       and dogru_sayisi = v_en_iyi;

    if v_zirve = 1 then
      select user_id into v_kazanan
        from public.tournament_players
       where tournament_id = p_tournament_id and not elendi
         and dogru_sayisi = v_en_iyi;
    else
      -- Zirvenin altındakiler elenir, kalanlar altın soruda kapışır.
      update public.tournament_players
         set elendi = true, elenme_sorusu = t.aktif_soru
       where tournament_id = p_tournament_id and not elendi
         and dogru_sayisi < v_en_iyi;

      v_altin := public.turnuva_altin_soru_ekle(p_tournament_id);
      if v_altin is null then
        -- Havuzda tek soru bile kalmadı: en erken katılan kazansın,
        -- turnuva askıda kalmasın.
        select user_id into v_kazanan
          from public.tournament_players
         where tournament_id = p_tournament_id and not elendi
         order by dogru_sayisi desc, joined_at asc
         limit 1;
      end if;
    end if;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
    perform public.turnuva_odullerini_dagit(p_tournament_id, v_kazanan);
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$function$;


CREATE OR REPLACE FUNCTION public.turnuva_odullerini_dagit(p_tournament_id uuid, p_kazanan uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_sira int := 0;
  v_odul bigint;
  v_lig int;
  v_bot_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
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

  -- LİG PUANI (Paket 14, 3.2): dereceye göre tek miktar —
  -- 1. / 2. / 3. / 4-10. / diğer katılanlar. Botlar gerçek maçtaki gibi
  -- lig_bot_puan_yuzde ile kırpılır.
  v_sira := 0;
  for r in
    select tp.user_id, coalesce(p.is_bot, false) as bot
      from public.tournament_players tp
      join public.profiles p on p.id = tp.user_id
     where tp.tournament_id = p_tournament_id
     order by tp.elendi asc, tp.elenme_sorusu desc nulls first, tp.dogru_sayisi desc
  loop
    v_sira := v_sira + 1;
    v_lig := case
      when v_sira = 1 then public.ayar_sayi('lig_turnuva_1', 150)
      when v_sira = 2 then public.ayar_sayi('lig_turnuva_2', 80)
      when v_sira = 3 then public.ayar_sayi('lig_turnuva_3', 40)
      when v_sira <= 10 then public.ayar_sayi('lig_turnuva_ilk10', 20)
      else public.ayar_sayi('lig_turnuva_katilim', 10) end;
    if r.bot then v_lig := floor(v_lig * v_bot_yuzde)::int; end if;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = r.user_id;
    end if;
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
$function$;


CREATE OR REPLACE FUNCTION public.bot_puan_tik()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_ara int;
  v_puan int;
  v_islenen int := 0;
  v_dk_min int := public.ayar_sayi('bot_puan_mac_dk_min', 55)::int;
  v_dk_max int := public.ayar_sayi('bot_puan_mac_dk_max', 420)::int;
  v_gal numeric := public.ayar_sayi('bot_puan_galibiyet_yuzde', 55)::numeric / 100;
  v_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
begin
  if v_dk_max < v_dk_min then v_dk_max := v_dk_min; end if;

  -- Yeni botlar tempoya yazılır. Başlangıç anı bota özel geriye kaydırılır
  -- ki ilk tikte hepsi birden puan almasın.
  insert into public.bot_puan_temposu (bot_id, son_mac_at)
  select p.id,
         now() - make_interval(mins => (public.bot_rasgele('puan_baslangic:' || p.id::text)
                                        * v_dk_max)::int)
    from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true)
  on conflict (bot_id) do nothing;

  for r in
    select t.bot_id, t.son_mac_at, p.lig
      from public.bot_puan_temposu t
      join public.profiles p on p.id = t.bot_id
     where p.is_bot and coalesce(p.bot_aktif, true)
  loop
    -- Bota özel sabit tempo: aynı bot hep aynı sıklıkta "oynar".
    v_ara := v_dk_min + (public.bot_rasgele('puan_tempo:' || r.bot_id::text)
                         * (v_dk_max - v_dk_min))::int;
    if now() < r.son_mac_at + make_interval(mins => v_ara) then
      continue;
    end if;

    -- Maçı kazandı mı: maç anına bağlı, aynı tik tekrar çalışsa da aynı.
    v_puan := 0;
    if public.bot_rasgele('puan_sonuc:' || r.bot_id::text || ':'
                          || to_char(r.son_mac_at, 'YYYYMMDDHH24MI')) < v_gal then
      -- Gerçek maçtaki formülün aynısı: galibiyet puanı, bot yüzdesiyle kırpılmış.
      v_puan := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * v_yuzde)::int;
    end if;

    update public.profiles
       set puan = puan + v_puan,
           puan_hafta = puan_hafta + v_puan,
           toplam_mac = coalesce(toplam_mac, 0) + 1
     where id = r.bot_id;

    update public.bot_puan_temposu
       set son_mac_at = r.son_mac_at + make_interval(mins => v_ara),
           mac_sayisi = mac_sayisi + 1
     where bot_id = r.bot_id;

    v_islenen := v_islenen + 1;
  end loop;

  return v_islenen;
end;
$function$;


drop function if exists public.hizli_mod_bitir(uuid);
CREATE OR REPLACE FUNCTION public.hizli_mod_bitir(p_oturum_id uuid)
 RETURNS TABLE(skor integer, dogru integer, yanlis integer, en_iyi_hafta integer, lig_puan integer, kazanilan_coin integer, dereceli boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_hafta date := public.hafta_basi();
  v_en_iyi int;
  v_ham int := 0;
  v_lig int := 0;
  v_coin int := 0;
  v_bakiye_once bigint;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() and auth.uid() is not null then
    raise exception 'Bu oturum senin değil';
  end if;

  if o.durum = 'aktif' then
    update public.hizli_mod_oturumlar
       set durum = 'bitti', bitis = now()
     where id = p_oturum_id
    returning * into o;

    insert into public.hizli_mod_skorlar (user_id, oturum_id, kategori, skor, hafta)
    values (o.user_id, o.id, o.kategori, o.dogru, v_hafta);

    -- ÖDÜL (Paket 14, 3.2): skor bazlı, tavanlı. Dereceli → lig puanı + tam
    -- coin; serbest → puan yok, coin serbest_coin_carpani ile.
    if not exists (select 1 from public.profiles pr where pr.id = o.user_id and coalesce(pr.is_bot, false)) then
      v_lig := least(o.dogru * public.ayar_sayi('hizli_mod_puan_dogru', 3),
                     public.ayar_sayi('hizli_mod_lig_tavan', 25))::int;
      v_ham := least(o.dogru * public.ayar_sayi('hizli_mod_coin_dogru', 3),
                     public.ayar_sayi('hizli_mod_coin_tavan', 25))::int;
      if not o.dereceli then
        v_lig := 0;
        v_ham := floor(v_ham * public.odul_carpani(1, true, false))::int;
      end if;
      if v_lig > 0 then
        update public.profiles pr
           set puan = pr.puan + v_lig, puan_hafta = pr.puan_hafta + v_lig
         where pr.id = o.user_id;
      end if;
      if v_ham > 0 then
        select pr.coin into v_bakiye_once from public.profiles pr where pr.id = o.user_id;
        perform public.coin_ekle(o.user_id, v_ham, 'hizli_mod', o.id::text);
        select greatest(0, pr.coin - v_bakiye_once)::int into v_coin from public.profiles pr where pr.id = o.user_id;
      end if;
      update public.hizli_mod_oturumlar h2
         set lig_puan = v_lig, kazanilan_coin = v_coin
       where h2.id = o.id;
    end if;
  end if;

  select max(s.skor) into v_en_iyi
  from public.hizli_mod_skorlar s
  where s.user_id = o.user_id and s.hafta = v_hafta;

  select h2.lig_puan, h2.kazanilan_coin into v_lig, v_coin
    from public.hizli_mod_oturumlar h2 where h2.id = o.id;
  return query select o.dogru, o.dogru, o.yanlis, coalesce(v_en_iyi, o.dogru),
                      coalesce(v_lig, 0), coalesce(v_coin, 0), o.dereceli;
end;
$function$;

revoke execute on function public.hizli_mod_bitir(uuid) from public, anon;
grant execute on function public.hizli_mod_bitir(uuid) to authenticated;

drop function if exists public.hizli_mod_baslat(text);
CREATE OR REPLACE FUNCTION public.hizli_mod_baslat(p_kategori text DEFAULT NULL::text, p_dereceli boolean DEFAULT true)
 RETURNS TABLE(oturum_id uuid, soru_sayisi integer, sure_sn integer, soru_sure_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Okuma yükü tavanı (soru metni + şıkların toplam karakteri): soru başına
  -- verilen süreye sığsın diye var. Değerler oyun_ayarlari'nda (migration 200).
  v_max_okuma int := public.ayar_sayi('hizli_mod_okuma_tavani', 170)::int;
  v_sure int := public.ayar_sayi('hizli_mod_sure_sn', 90)::int;
  v_soru_sure int := public.ayar_sayi('hizli_mod_soru_sure_sn', 10)::int;
  v_me uuid := auth.uid();
  v_kat text;
  v_ids uuid[];
  v_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_baslat', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Devam eden oturumu kapat (tek aktif oturum)
  update public.hizli_mod_oturumlar
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  perform public.mac_kotasi_kontrol();

  -- 90 sn / 10 sn = en çok 9 soru; yedekle birlikte 25 çekilir.
  -- Son parametre: soru süresine sığmayan uzun sorular elenir.
  v_ids := public.soru_sec(v_kat, 25, array[v_me], null, v_max_okuma);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Bu kategoride soru bulunamadı';
  end if;

  insert into public.hizli_mod_oturumlar (user_id, kategori, soru_ids, dereceli)
  values (v_me, v_kat, v_ids, coalesce(p_dereceli, true))
  returning id into v_id;

  return query select v_id, coalesce(array_length(v_ids, 1), 0), v_sure, v_soru_sure;
end;
$function$;;

revoke execute on function public.hizli_mod_baslat(text, boolean) from public, anon;
grant execute on function public.hizli_mod_baslat(text, boolean) to authenticated;

drop function if exists public.create_challenge(uuid, text);
CREATE OR REPLACE FUNCTION public.create_challenge(p_rakip uuid, p_kategori text DEFAULT NULL::text, p_dereceli boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;

  perform public.mac_kotasi_kontrol();

  insert into public.matches (oyuncu1, oyuncu2, kategori, dereceli)
  values (auth.uid(), p_rakip, p_kategori, coalesce(p_dereceli, true))
  returning id into v_id;
  return v_id;
end;
$function$;

revoke execute on function public.create_challenge(uuid, text, boolean) from public, anon;
grant execute on function public.create_challenge(uuid, text, boolean) to authenticated;
