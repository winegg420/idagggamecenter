-- Paket 28 — canlı testte çıkan hatalar (sunucu tarafı).
--
-- A) Düello açılır açılmaz yanlış "Bağlantın koptu" uyarısı
-- D) joker_tek_al fiyatı ikinci bir yerde tekrar yazılmıştı
-- F) Lig tablosunda hiç maç yapmamış hesaplar

-- ===========================================================================
-- A) YANLIŞ KOPUKLUK UYARISI — ölçülen kök sebep
--
-- İstemci nabzı `src/context/AuthContext.jsx` içinde 60 SANİYEDE BİR atıyor
-- (`kalp_at()` → profiles.last_seen). Düellonun kopukluk eşiği ise
-- `duello_kopuk_sn` = 25 saniye. 60 > 25 olduğu için iki nabız arasında
-- 35 SANİYELİK bir pencere var ve o pencerede tamamen bağlı bir oyuncu
-- "kopuk" sayılıyor. Uyarının ilk tıklamada kaybolmasının sebebi de bu:
-- `duello_kilitle` çağrıldığında last_seen tazeleniyor.
--
-- Bu yalnız korkutmuyor: `duello_kopuk_bekleme_sn` (45 sn) dolarsa bağlı bir
-- oyuncu HAKSIZ YERE maçı kaybedebilir.
--
-- ÇÖZÜM: düello ekranı kendi nabzını atar. Aralık ayardan okunur AMA sunucu
-- her zaman eşiğin yarısına kırpar — iki ayardan biri değişse bile ilişki
-- bozulamaz. Kural tek yerde: duello_nabiz_sn() fonksiyonu.
-- ===========================================================================
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('duello_nabiz_sn', '10'::jsonb,
   'Düello ekranı kaç saniyede bir kalp_at() çağırsın. Sunucu bunu her zaman '
   'duello_kopuk_sn''in YARISINA kırpar; ikisi birbirinden bağımsız bozulamaz.')
on conflict (anahtar) do nothing;

-- Tek kaynak: istemci bu değeri duello_durum().sureler.nabiz'dan okur.
create or replace function public.duello_nabiz_sn()
returns integer
language sql stable security definer set search_path to 'public'
as $function$
  -- KURAL: nabız aralığı kopukluk eşiğinin YARISINDAN küçük olmalı; yoksa
  -- bağlı oyuncu iki nabız arasında kopuk sayılır (Paket 28 A'da yaşandı).
  -- En az 3 sn: sunucuyu gereksiz yere dövmesin.
  select greatest(3,
    least(public.ayar_sayi('duello_nabiz_sn', 10),
          floor(public.ayar_sayi('duello_kopuk_sn', 25) / 2.0)))::int;
$function$;

-- ===========================================================================
-- D) joker_tek_al — fiyat artık tek yerden
--
-- Paket 27'de joker_fiyati() geldi ama joker_tek_al kendi `case` listesini
-- tutmaya devam ediyordu. İki yerde iki liste: biri güncellenmeden kalırsa
-- aynı joker iki farklı fiyata satılır. Tek kaynağa bağlanıyor.
-- (Davranış değişmiyor: iki listedeki fiyatlar bugün aynı — karşılaştırıldı.)
-- ===========================================================================
create or replace function public.joker_tek_al(p_tur text)
returns table(bakiye bigint, adet integer)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_fiyat bigint;
  v_bakiye bigint;
  v_adet int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('joker_tek_al', 20, interval '60 seconds');

  v_fiyat := public.joker_fiyati(p_tur);        -- Paket 28: tek kaynak
  if v_fiyat is null or v_fiyat <= 0 then raise exception 'Bu joker tek tek satılmıyor'; end if;

  v_bakiye := public.coin_harca(v_fiyat, 'joker', 'tek:' || p_tur);
  v_adet := public.joker_hareket(v_me, p_tur, 1, 'satin_alma', 'tek:' || p_tur);

  return query select v_bakiye, v_adet;
end;
$function$;

-- ===========================================================================
-- F) LİG TABLOSU — hiç maç yapmamış hesap görünmesin
--
-- ÖLÇÜLDÜ (18 Eyl 2026, bu hafta):
--   · Gruplar: bronz 1 → 22 kişi, bronz 2 → 22, bronz 3 → 19, gümüş 1 → 8.
--     Yani "12 kişilik grup" diye bir sorun YOK; 25'lik grup kuralı çalışıyor,
--     o ligde 63 kişi olduğu için üç gruba bölünmüş.
--   · Tabloda 12 kişi görünmesinin sebebi AYRI bir kural: `lig_gorunur_mu`
--     yalnız takma adını seçmiş VE avatarı onaylanmış oyuncuyu gösteriyor.
--     Bronz 1'de 22 üyenin 1'i açık bot, 12'si bu süzgeci geçiyor.
--   · Bu 12'nin 3'ü HİÇ MAÇ YAPMAMIŞ. Lig genelinde 0 maçlı üye sayısı: 35.
--
-- HİÇBİR HESAP SİLİNMİYOR. Yalnız görünürlük ölçütü ekleniyor: hiç maç
-- yapmamış hesap tabloda satır tutmasın. Oyuncu KENDİ satırını her durumda
-- görmeye devam eder (yeni oyuncu kendini kaybetmesin).
-- Eşik ayardan: 0 yapılırsa kural kapanır.
-- ===========================================================================
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('lig_gorunur_min_mac', '1'::jsonb,
   'Lig tablosunda görünmek için gereken en az toplam maç. 0 = kural kapalı. '
   'Oyuncu kendi satırını bu ölçütten bağımsız her zaman görür.')
on conflict (anahtar) do nothing;

create or replace function public.lig_grubum()
returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
              puan integer, ben boolean, bot boolean, lig text, grup_boyu integer,
              yukselen integer, dusen integer, sezon_bitis timestamp with time zone,
              gorunum jsonb)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_hafta date := public.hafta_basi();
  v_lig text;
  v_grup int;
  v_boyu int;
  v_min_mac int := public.ayar_sayi('lig_gorunur_min_mac', 1)::int;   -- Paket 28 F
begin
  select u.lig, u.grup_no into v_lig, v_grup
    from public.lig_uyelik u
   where u.user_id = v_me and u.hafta = v_hafta;
  if v_lig is null then return; end if;

  select count(*) into v_boyu
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
     -- Oyuncu kendi satırını her durumda görür.
     and (p.id = v_me
          or (public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
              -- Paket 28 F: hiç maç yapmamış hesap tabloda satır tutmasın.
              and coalesce(p.toplam_mac, 0) >= v_min_mac))
   order by 1;
end;
$function$;

-- ---------------------------------------------------------------------------
-- duello_durum: istemciye nabız aralığını ve kopukluk eşiğini bildir.
-- Gövde canlıdaki hâlinden alındı; tek değişiklik sureler bloğudur.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.duello_durum(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_rakip uuid;
  v_savunan uuid;
  v_dil text := public.oyuncu_dili();
  v_soru_goster boolean;
  v_soru jsonb;
  v_arkadas boolean;
  v_ezeli jsonb;
  v_odul jsonb;
  v_envanter jsonb;
  v_kullanim jsonb;
begin
  perform public.hiz_siniri('duello_durum', 400, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  v_rakip := case when d.oyuncu1 = v_me then d.oyuncu2 else d.oyuncu1 end;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;

  v_soru_goster := d.soru_id is not null and (
       (d.faz = 'hazirlik' and d.saldiran = v_me)
    or d.faz in ('cevap','sonuc','altin')
    or d.durum <> 'aktif');
  if v_soru_goster then
    select jsonb_build_object('soru', sd.soru, 'secenekler', sd.secenekler, 'kategori', sd.kategori)
      into v_soru from public.soru_dilinde(d.soru_id, v_dil) sd;
  end if;

  v_arkadas := exists (select 1 from public.friendships f where f.durum = 'arkadas'
     and ((f.requester = v_me and f.addressee = v_rakip) or (f.requester = v_rakip and f.addressee = v_me)));
  if v_arkadas then
    select jsonb_build_object(
             'ben', count(*) filter (where x.kazanan = v_me),
             'rakip', count(*) filter (where x.kazanan = v_rakip))
      into v_ezeli
      from public.duellolar x
     where x.durum = 'bitti'
       and ((x.oyuncu1 = v_me and x.oyuncu2 = v_rakip) or (x.oyuncu1 = v_rakip and x.oyuncu2 = v_me));
  end if;

  if d.durum = 'bitti' then
    v_odul := jsonb_build_object(
      'lig_puan', case when d.dereceli and d.kazanan = v_me
                       then floor(public.ayar_sayi('lig_duello_galibiyet', 50) * d.odul_carpan)::int else 0 end,
      'coin', coalesce((select sum(h.miktar) from public.coin_hareketleri h
                         where h.user_id = v_me and h.tur = 'mac' and h.referans = 'duello:' || p_id::text), 0));
  end if;

  select coalesce(jsonb_object_agg(e.tur, e.adet), '{}'::jsonb) into v_envanter
    from public.joker_envanter e where e.user_id = v_me;
  select jsonb_build_object(
           'saldiri', count(*) filter (where k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'saldiri_ucretsiz', count(*) filter (where k.ucretsiz and k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'savunma', count(*) filter (where k.tur in ('elli','sure','soru_degistir')),
           'elli_ucretsiz', bool_or(k.tur = 'elli' and k.ucretsiz),
           'soru_degistir', bool_or(k.tur = 'soru_degistir'),
           -- Paket 27 B: aynı tür maçta bir kez — istemci hangi türün
           -- tükendiğini bilsin ki düğmeyi boşuna açmasın.
           'turler', coalesce(jsonb_agg(distinct k.tur) filter (where k.tur is not null), '[]'::jsonb))
    into v_kullanim
    from public.joker_kullanimlari k where k.user_id = v_me and k.mac_tur = 'duello' and k.mac_id = p_id;

  return jsonb_build_object(
    'id', d.id, 'durum', d.durum, 'dereceli', d.dereceli,
    'tur', d.tur, 'max_tur', public.ayar_sayi('duello_max_tur', 10), 'saldiri_sirasi', d.saldiri_sirasi,
    'faz', d.faz, 'faz_bitis', d.faz_bitis, 'sunucu_zamani', now(),
    'ben', v_me, 'saldiran', d.saldiran, 'savunan', v_savunan,
    'oyuncular', jsonb_build_array(
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can1, 'dogru', d.dogru1, 'profil', d.profil1, 'zayif', d.zayif1,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu1),
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can2, 'dogru', d.dogru2, 'profil', d.profil2, 'zayif', d.zayif2,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu2)),
    'kategoriler', to_jsonb(public.duello_kategorileri()),
    'kategori_max', public.ayar_sayi('duello_kategori_max', 2),
    'kullanim', jsonb_build_object(d.oyuncu1::text, public.duello_kategori_kullanimi(p_id, d.oyuncu1),
                                   d.oyuncu2::text, public.duello_kategori_kullanimi(p_id, d.oyuncu2)),
    'kategori', d.kategori,
    'soru', v_soru,
    'elli_kapali', case when v_me = v_savunan and d.faz = 'cevap' then to_jsonb(d.elli_kapali) end,
    'zaman_baskisi', d.zaman_baskisi, 'savunma_kilidi', d.savunma_kilidi, 'ek_sure', d.ek_sure,
    'soru_degisti_saldiri', d.soru_degisti_saldiri,
    'son_hamle', case when d.faz in ('sonuc','kategori','altin') or d.durum <> 'aktif' then d.son_hamle end,
    'altin', case when d.faz = 'altin' then jsonb_build_object(
                    'ben_cevapladim', d.altin_cevaplar ? v_me::text,
                    'benim_cevabim', d.altin_cevaplar -> v_me::text -> 'cevap',
                    'rakip_cevapladi', d.altin_cevaplar ? v_rakip::text) end,
    'jokerler', jsonb_build_object(
       'envanter', v_envanter, 'kullanim', v_kullanim,
       -- Paket 27 B: tek toplam hak. Eski alanlar (saldiri_siniri/savunma_siniri/
       -- ucretsiz_saldiri) eski istemci sürümü kırılmasın diye aynı yapıda
       -- doldurulmaya devam ediyor; yeni istemci 'hak' ve 'kullanilan'a bakar.
       'hak', public.ayar_sayi('duello_joker_hak', 4),
       'kullanilan', (select count(*) from public.joker_kullanimlari k2
                       where k2.user_id = v_me and k2.mac_tur = 'duello' and k2.mac_id = p_id),
       'fiyatlar', public.joker_fiyatlari(),
       'coin', (select coalesce(pr.coin, 0) from public.profiles pr where pr.id = v_me),
       'saldiri_siniri', public.ayar_sayi('duello_joker_hak', 4),
       'savunma_siniri', public.ayar_sayi('duello_joker_hak', 4),
       'ucretsiz_saldiri', public.ayar_sayi('duello_ucretsiz_saldiri_joker', 0)),
    'sureler', jsonb_build_object('cevap', public.ayar_sayi('duello_cevap_sn', 15),
       'zaman_baskisi', public.ayar_sayi('duello_zaman_baskisi_sn', 10),
       'hazirlik', public.ayar_sayi('duello_hazirlik_sn', 4),
       'kategori', public.ayar_sayi('duello_kategori_sn', 20),
       'altin', public.ayar_sayi('duello_altin_sn', 15),
       -- Paket 28 A: düello ekranının kendi nabız aralığı. Sunucu hesaplıyor ki
       -- istemci kopukluk eşiğinden yavaş atıp kendini "kopuk" göstermesin.
       'nabiz', public.duello_nabiz_sn(),
       'kopuk', public.ayar_sayi('duello_kopuk_sn', 25)),
    'kazanan', d.kazanan, 'odul', v_odul, 'ezeli', v_ezeli,
    'rovans', jsonb_build_object('isteyen', d.rovans_isteyen, 'id', d.rovans_id,
       'gecerli', d.rovans_at is not null and d.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60)))
  );
end $function$;

-- Yeni yardımcı fonksiyon sunucuya aittir; istemci değeri duello_durum
-- üzerinden alır (Paket 26 A yetki kuralı).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as imza
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'duello_nabiz_sn'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.imza);
    execute format('grant execute on function %s to postgres, service_role', r.imza);
  end loop;
end $$;
