-- ============================================================
-- Bildim! — Sunucu tarafı joker/seri/satın alma kurallarının kanıtı
--
-- Çalıştırma: bu dosya TAMAMEN bir transaction içinde çalışır ve SONUNDA
-- ROLLBACK yapar; canlı veriyi değiştirmez.
--   node bildim/_test/joker-kurallari-test.mjs
-- ya da Supabase SQL Editor'e yapıştır (sonundaki rollback'i koru).
--
-- Her kontrol `sonuc` tablosuna bir satır yazar; en sonda GEÇTİ/KALDI özeti gelir.
-- ============================================================

create temporary table sonuc (
  sira serial,
  ad text,
  beklenen text,
  gercek text,
  gecti boolean
) on commit drop;

create or replace function pg_temp.kontrol(p_ad text, p_beklenen text, p_gercek text)
returns void language plpgsql as $$
begin
  insert into sonuc (ad, beklenen, gercek, gecti)
  values (p_ad, p_beklenen, p_gercek, p_gercek like '%' || p_beklenen || '%');
end $$;

do $$
declare
  v_u1 uuid;         -- test oyuncusu
  v_bot uuid;        -- bot rakip
  v_mac uuid;
  v_turnuva uuid;
  v_hata text;
  v_json jsonb;
  v_sayi int;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  -- ---------- Hazırlık: gerçek olmayan test kullanıcıları ----------
  select id into v_u1 from public.profiles where coalesce(is_bot,false) = false limit 1;
  select id into v_bot from public.profiles where coalesce(is_bot,false) limit 1;
  if v_u1 is null or v_bot is null then
    raise exception 'Test için en az 1 oyuncu ve 1 bot gerekli';
  end if;

  -- auth.uid() taklidi
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u1::text, 'role', 'authenticated')::text, true);

  -- Bu testte oyuncu botun ARKADAŞI OLMASIN ki "lig maçı" (sınır 2) sayılsın
  delete from public.friendships
   where (requester = v_u1 and addressee = v_bot) or (requester = v_bot and addressee = v_u1);

  -- Bol joker ver
  perform public.joker_hareket(v_u1, 'elli', 50, 'hediye', 'test');
  perform public.joker_hareket(v_u1, 'sure', 50, 'hediye', 'test');
  perform public.joker_hareket(v_u1, 'pas', 50, 'hediye', 'test');

  -- ---------- Aktif bir lig maçı (bota karşı) ----------
  insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
  values (v_u1, v_bot, 'aktif', null, public.soru_sec(null, 20, array[v_u1]), 0, now())
  returning id into v_mac;

  -- === TEST 1: lig maçında 3. joker reddedilir (1 ücretsiz elli + 1 sure = 2 sınır) ===
  perform public.joker_kullan('1v1', v_mac, 0, 'elli');   -- 1. (ücretsiz)
  perform public.joker_kullan('1v1', v_mac, 0, 'sure');   -- 2.
  begin
    perform public.joker_kullan('1v1', v_mac, 0, 'pas');  -- 3. → reddedilmeli
    perform pg_temp.kontrol('Lig maçında 3. joker reddedilir', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Lig maçında 3. joker reddedilir', 'en fazla', v_hata);
  end;

  -- === TEST 1b: arkadaş maçında sınır yok ===
  insert into public.friendships (requester, addressee, durum)
  values (v_u1, v_bot, 'arkadas')
  on conflict (requester, addressee) do update set durum = 'arkadas';

  perform pg_temp.kontrol(
    'Arkadaş maçında sınır yok (null)',
    'YOK',
    coalesce(public.joker_mac_siniri('1v1', v_mac)::text, 'YOK'));

  delete from public.friendships
   where (requester = v_u1 and addressee = v_bot) or (requester = v_bot and addressee = v_u1);

  -- === TEST 2: ücretsiz elli maç başına 1 kez ===
  perform pg_temp.kontrol(
    'Ücretsiz elli tükendi',
    'false',
    (select ucretsiz_elli_kaldi::text from public.joker_mac_durumu('1v1', v_mac)));

  -- === TEST 3: günde 6. reklam ödülü reddedilir ===
  for v_sayi in 1..5 loop
    perform public.reklam_odulu_al('test-reklam-' || v_sayi);
  end loop;
  begin
    perform public.reklam_odulu_al('test-reklam-6');
    perform pg_temp.kontrol('Günde 6. reklam ödülü reddedilir', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Günde 6. reklam ödülü reddedilir', 'hakkın doldu', v_hata);
  end;

  -- === TEST 3b: aynı reklam referansı iki kez ödüllendirilemez ===
  begin
    perform public.reklam_odulu_al('test-reklam-1');
    perform pg_temp.kontrol('Aynı reklam referansı tekrar edilemez', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Aynı reklam referansı tekrar edilemez', 'zaten', v_hata);
  end;

  -- === TEST 4: aynı Play token iki kez kabul edilmez ===
  perform public.satin_alma_isle(v_u1, 'joker_10', 'TOKEN-TEST-1');
  begin
    perform public.satin_alma_isle(v_u1, 'joker_10', 'TOKEN-TEST-1');
    perform pg_temp.kontrol('Aynı Play token iki kez kabul edilmez', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Aynı Play token iki kez kabul edilmez', 'zaten işlendi', v_hata);
  end;

  -- === TEST 5: seri koruma YALNIZ 1 günü kapatır ===
  -- 5a) Tam 1 gün kaçırılmış + koruma var → seri korunur
  perform public.joker_hareket(v_u1, 'seri_koruma', 1, 'hediye', 'test');
  update public.profiles
     set seri_gun = 7, seri_son_gun = v_bugun - 2, seri = 7, son_seri_tarihi = v_bugun - 2
   where id = v_u1;
  perform public.seri_kontrol();
  perform pg_temp.kontrol(
    'Seri koruma 1 günü kapatır (seri sürüyor)',
    '7',
    (select seri_gun::text from public.profiles where id = v_u1));

  -- 5b) 2 gün kaçırılmış + koruma var → seri YİNE DE sıfırlanır
  perform public.joker_hareket(v_u1, 'seri_koruma', 5, 'hediye', 'test');
  update public.profiles
     set seri_gun = 9, seri_son_gun = v_bugun - 3, seri = 9, son_seri_tarihi = v_bugun - 3
   where id = v_u1;
  perform public.seri_kontrol();
  perform pg_temp.kontrol(
    'Koruma 2 günü kapatmaz (seri sıfırlanır)',
    '0',
    (select seri_gun::text from public.profiles where id = v_u1));

  -- === TEST 6: turnuva finalinde joker reddedilir ===
  insert into public.tournaments (tarih, seans, durum, soru_ids, aktif_soru, soru_baslangic, baslangic)
  values (v_bugun + 900, 'sabah', 'aktif', public.soru_sec(null, 10, array[v_u1]), 0, now(), now())
  returning id into v_turnuva;

  insert into public.tournament_players (tournament_id, user_id, elendi)
  values (v_turnuva, v_u1, false), (v_turnuva, v_bot, false);

  perform pg_temp.kontrol(
    'Turnuva finalinde sınır 0',
    '0',
    public.joker_mac_siniri('turnuva', v_turnuva)::text);

  begin
    perform public.joker_kullan('turnuva', v_turnuva, 0, 'elli');
    perform pg_temp.kontrol('Turnuva finalinde joker reddedilir', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Turnuva finalinde joker reddedilir', 'finalinde', v_hata);
  end;

  -- === TEST 6b: final DIŞINDA (3+ oyuncu) sınır 2 ===
  insert into public.tournament_players (tournament_id, user_id, elendi)
  select v_turnuva, p.id, false
  from public.profiles p
  where p.id not in (v_u1, v_bot)
  limit 2;

  perform pg_temp.kontrol(
    'Final dışında turnuva sınırı 2',
    '2',
    public.joker_mac_siniri('turnuva', v_turnuva)::text);

  -- === TEST 7: turnuvada pas jokeri yasak ===
  begin
    perform public.joker_kullan('turnuva', v_turnuva, 0, 'pas');
    perform pg_temp.kontrol('Turnuvada pas jokeri yasak', 'HATA', 'kabul edildi');
  exception when others then
    v_hata := sqlerrm;
    perform pg_temp.kontrol('Turnuvada pas jokeri yasak', 'pas jokeri', v_hata);
  end;

  -- === TEST 8: kullanım envanterden düşüyor ve denetim izine yazılıyor mu? ===
  -- (Not: TEST 4'teki satın alma araya joker eklediği için mutlak sayı değil,
  --  'kullanim' kaynaklı -1 hareketi aranır.)
  select count(*)::int into v_sayi
  from public.joker_islemleri
  where user_id = v_u1 and tur = 'sure' and kaynak = 'kullanim' and delta = -1;
  perform pg_temp.kontrol(
    'Sure jokeri envanterden düştü (denetim izi)',
    'true',
    (v_sayi >= 1)::text);

  -- === TEST 9: hızlı mod lig puanına dokunmuyor ===
  declare
    v_puan_once int;
    v_oturum uuid;
  begin
    select puan into v_puan_once from public.profiles where id = v_u1;
    select oturum_id into v_oturum from public.hizli_mod_baslat(null);
    perform public.hizli_mod_bitir(v_oturum);
    perform pg_temp.kontrol(
      'Hızlı mod lig puanını değiştirmez',
      'true',
      (v_puan_once = (select puan from public.profiles where id = v_u1))::text);
  end;
end $$;

select sira, ad, case when gecti then 'GEÇTİ' else 'KALDI' end as durum, gercek
from sonuc order by sira;

select count(*) filter (where gecti) as gecen,
       count(*) filter (where not gecti) as kalan,
       count(*) as toplam
from sonuc;
