-- ============================================================
-- GİZLİ BOTLAR — gizlilik, eşleşme gecikmesi, çeşitlilik
--
-- 80 gizli bot migration 150'de eklendi. Bu migration onları GERÇEKTEN
-- gizli yapan eksikleri kapatıyor:
--
--   1. GİZLİLİK: `is_bot` istemciye açıktı — oyuncu profil sorgusuyla
--      rakibinin bot olduğunu görebiliyordu. Artık kapalı; istemci yalnız
--      `acik_bot` (adında "Bot" geçen, zaten belli olan botlar) görüyor.
--   2. EŞLEŞME GECİKMESİ: "rakip aranıyor" der demez bota bağlanmak sahte
--      duruyordu. Bot devreye girmeden önce sunucu 2-5 sn bekletiyor.
--   3. YENİ HESAP: seviyesi olmayan oyuncuya 20-45 bandından bot geliyor
--      (eskiden 1. seviye botlar düşüyordu, oyun ölü görünüyordu).
--   4. TEKRAR: art arda maçlarda aynı bot gelmiyor.
--   5. ÇEŞİTLİLİK: 80 botun hepsi aynı varsayılan görünümdeydi.
--
-- Bant hesabı TEK YERDE (`bot_seviye_araligi`): lig sistemi geldiğinde
-- "kendi ligi + bir alt/bir üst" sınırı oraya eklenecek.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger) values
  ('bot_eslesme_gecikme_min', '2'::jsonb),
  ('bot_eslesme_gecikme_max', '5'::jsonb),
  ('bot_yeni_hesap_alt',     '20'::jsonb),
  ('bot_yeni_hesap_ust',     '45'::jsonb),
  ('bot_tekrar_penceresi',    '8'::jsonb)
on conflict (anahtar) do update set deger = excluded.deger;

-- ---- 1) GİZLİLİK ----
-- İstemciye yalnız "açık bot mu" bilgisi verilir. Gizli bot bu bayrakta da
-- false görünür; oyuncu onu gerçek oyuncudan ayırt edemez.
alter table public.profiles
  add column if not exists acik_bot boolean
  generated always as (coalesce(is_bot, false) and coalesce(bot_turu, 'acik') = 'acik') stored;

grant select (acik_bot) on public.profiles to authenticated;

-- Bot iç bilgileri istemciden KALDIRILIYOR. (Fonksiyonlar security definer
-- olduğu için sunucu tarafı etkilenmez.)
revoke select (is_bot) on public.profiles from authenticated;
revoke select (bot_isabet) on public.profiles from authenticated;
revoke select (bot_seviye) on public.profiles from authenticated;

-- ---- 2) Seviye bandı — TEK KAYNAK ----
-- Oyuncunun karşısına hangi seviye aralığından bot çıkacağı burada
-- kararlaştırılır. Lig sistemi gelince sınır BURAYA eklenecek; bot_sec
-- ve ileride kullanacak her yer aynı bandı okuyacak.
create or replace function public.bot_seviye_araligi(p_user uuid)
returns table(alt integer, ust integer)
language plpgsql stable security definer set search_path to 'public' as $bsa$
declare
  p public.profiles%rowtype;
  v_sev int;
  v_tol int := public.ayar_sayi('bot_seviye_toleransi', 10)::int;
begin
  select * into p from public.profiles where id = p_user;

  -- Yeni hesap: henüz maçı yok, seviyesi anlamsız. 1. seviye botlar
  -- düşerse oyun ölü görünür; orta banttan başlatıyoruz.
  if not found or coalesce(p.toplam_mac, 0) = 0 then
    return query select
      public.ayar_sayi('bot_yeni_hesap_alt', 20)::int,
      public.ayar_sayi('bot_yeni_hesap_ust', 45)::int;
    return;
  end if;

  v_sev := public.oyuncu_seviye_puani(p_user);
  return query select
    greatest(1, v_sev - v_tol),
    least(100, v_sev + v_tol);
end;
$bsa$;

revoke all on function public.bot_seviye_araligi(uuid) from public, authenticated, anon;

-- ---- 3) Bot seçimi: bant + tekrar engeli ----
-- %80 seviyeye yakın, %20 rastgele ("kırk yılın başı alakasız rakip",
-- inandırıcılık için) — her ikisinde de lig sınırı geçerli.
-- Son maçlarda karşılaşılan botlar elenir: art arda aynı isim gelirse
-- oyuncu bunların bot olduğunu hemen anlar.
create or replace function public.bot_sec(p_user uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $bs$
declare
  v_lig int;
  v_alt int;
  v_ust int;
  v_yakin numeric := public.ayar_sayi('bot_eslesme_yakin_yuzde', 80)::numeric / 100;
  v_pencere int := public.ayar_sayi('bot_tekrar_penceresi', 8)::int;
  v_son uuid[];
  v_bot uuid;
begin
  select public.lig_sirasi(coalesce(lig, 'bronz')) into v_lig
    from public.profiles where id = p_user;
  v_lig := coalesce(v_lig, 1);

  select a.alt, a.ust into v_alt, v_ust from public.bot_seviye_araligi(p_user) a;

  -- Son maçlardaki rakipler (aynı bot üst üste gelmesin)
  select coalesce(array_agg(r), '{}'::uuid[]) into v_son from (
    select case when m.oyuncu1 = p_user then m.oyuncu2 else m.oyuncu1 end as r
    from public.matches m
    where p_user in (m.oyuncu1, m.oyuncu2)
    order by m.created_at desc
    limit v_pencere
  ) s;

  -- (a) Seviyeye yakın gizli bot
  if random() < v_yakin then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
       and p.bot_seviye_puan between v_alt and v_ust
       and p.id <> all(v_son)
     order by random() limit 1;
  end if;

  -- (b) Lig sınırı içinde rastgele gizli bot
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
       and p.id <> all(v_son)
     order by random() limit 1;
  end if;

  -- (c) Tekrar engelini gevşet (havuz daraldıysa maç yine kurulsun)
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and public.lig_sirasi(p.lig) between v_lig - 1 and v_lig + 1
     order by random() limit 1;
  end if;

  -- (d) Son çare: açık bot
  if v_bot is null then
    select p.id into v_bot from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true)
     order by random() limit 1;
  end if;

  return v_bot;
end;
$bs$;

-- ---- 4) Eşleşme gecikmesi ----
-- Bot devreye girmeden önce gerçekten aranmış gibi 2-5 sn beklenir.
-- Süre oyuncuya + arama anına bağlı olduğundan aynı aramada sabittir.
-- Sunucuda tutuluyor: istemci atlayamaz.
create or replace function public.bot_eslesme_gecikmesi(p_user uuid, p_baslangic timestamptz)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select public.ayar_sayi('bot_eslesme_gecikme_min', 2)::numeric
       + public.bot_rasgele(p_user::text || ':' || p_baslangic::text)
         * greatest(0, public.ayar_sayi('bot_eslesme_gecikme_max', 5)
                       - public.ayar_sayi('bot_eslesme_gecikme_min', 2))::numeric;
$$;

-- quick_match: bot düşmeden önce sunucu bekletir.
-- Oyuncu kuyrukta değilse önce kuyruğa yazılır ve NULL döner ("aranıyor");
-- gecikme dolunca çağrı botu kurar. İstemci bu arada yoklamaya devam eder.
create or replace function public.quick_match(p_kategori text default null, p_dereceli boolean default true)
 returns uuid language plpgsql security definer set search_path to 'public'
as $qm$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
  v_kat text;
  v_puan int;
  v_arama_bas timestamptz;
begin
  perform public.hiz_siniri('quick_match', 30, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );
  select coalesce(pr.puan, 0) into v_puan from public.profiles pr where pr.id = auth.uid();

  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- ÖNCE GERÇEK OYUNCU: bot yalnız kuyruk boşsa devreye girer.
  select q.user_id into v_rakip
  from public.matchmaking_queue q
  join public.profiles pr on pr.id = q.user_id
  where q.user_id <> auth.uid()
    and (not p_dereceli or coalesce(q.dereceli, true) = p_dereceli)
    and (
      not p_dereceli
      or public.seviye_basamagi(pr.puan) <= public.seviye_basamagi(v_puan)
    )
  order by abs(public.seviye_basamagi(pr.puan) - public.seviye_basamagi(v_puan)), q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches
      (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now(), p_dereceli
    )
    returning id into v_id;
    return v_id;
  end if;

  -- ---- ARAMA GECİKMESİ ----
  -- Oyuncu "rakip aranıyor" der demez bota bağlanırsa sahte olduğu anlaşılır.
  select q.created_at into v_arama_bas
    from public.matchmaking_queue q where q.user_id = auth.uid();

  if v_arama_bas is null then
    insert into public.matchmaking_queue (user_id, kategori, dereceli)
    values (auth.uid(), v_kat, p_dereceli)
    on conflict (user_id) do update set created_at = now()
    returning created_at into v_arama_bas;
    return null;                     -- aranıyor
  end if;

  if now() < v_arama_bas + public.bot_eslesme_gecikmesi(auth.uid(), v_arama_bas) * interval '1 second' then
    return null;                     -- hâlâ aranıyor
  end if;

  delete from public.matchmaking_queue where user_id = auth.uid();

  -- Bot: bant + lig sınırı + tekrar engeli (bkz. bot_sec).
  v_bot := public.bot_sec(auth.uid());

  insert into public.matches
    (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now(), p_dereceli
  )
  returning id into v_id;
  return v_id;
end;
$qm$;

-- ---- 5) Görünüm çeşitliliği ----
-- 80 botun hepsi varsayılan görünümle duruyordu: aynı ten, aynı saç, aynı
-- turuncu tişört. Yan yana geldiklerinde sahte oldukları anlaşılıyordu.
--
-- Görünüm bot ADINDAN deterministik türetilir, yani her zaman aynı kalır
-- (avatar sistemi geldiğinde de aynı kural geçerli olacak).
--
-- AVATAR SİSTEMİ GELDİĞİNDE UYGULANACAK KURALLAR (bkz. migration 150):
--   · Avatar bot adından deterministik üretilir ve SABİT kalır.
--   · Kıyafet dağılımı: %30 başlangıç kıyafeti · %50 2-3 sıradan eşya ·
--     %20 bir özel eşya + sıradanlar. Hepsi başlangıç kıyafetiyle olursa
--     sahte anlaşılır.
--   · Etkinlik eşyaları ASLA giyilmez (onlar turnuva ödülü).
--   · Seviye ile görünüm uyumlu: yüksek seviyeli bot başlangıç
--     kıyafetiyle gezmez.
-- Aşağıdaki dağılım bu kurala göre kuruluyor; yalnız katalog küçük olduğu
-- için "özel eşya" şimdilik şapka/gözlük/küpe ile temsil ediliyor.
do $gorunum$
declare
  r record;
  v_ten text[] := array['#F3C89B','#E8B98A','#D9A273','#C08552','#8D5524','#FFE0BD','#A66A3D'];
  v_sac text[] := array['#2B2B2B','#5A3A22','#8A5A36','#3A2A18','#6B4226','#B08040','#1A1A1A','#7A4A2A'];
  v_ust text[] := array['#F4701F','#2563EB','#16A34A','#DC2626','#7C3AED','#0891B2','#DB2777','#CA8A04','#475569'];
  v_p numeric;
  v_seviye int;
  v_yeni jsonb;
begin
  for r in
    select id, takma_ad, coalesce(bot_seviye_puan, 1) as seviye
      from public.profiles where bot_turu = 'gizli'
  loop
    v_p := public.bot_rasgele('gorunum:' || r.takma_ad);
    v_seviye := r.seviye;

    v_yeni := jsonb_build_object(
      'ten',      v_ten[1 + (floor(public.bot_rasgele('ten:'  || r.takma_ad) * array_length(v_ten, 1)))::int],
      'sac_renk', v_sac[1 + (floor(public.bot_rasgele('sacr:' || r.takma_ad) * array_length(v_sac, 1)))::int],
      'ust_renk', v_ust[1 + (floor(public.bot_rasgele('ustr:' || r.takma_ad) * array_length(v_ust, 1)))::int],
      'sac',      (array['sac_01','sac_02','sac_03'])[
                    1 + (floor(public.bot_rasgele('sac:' || r.takma_ad) * 3))::int],
      'ust', null, 'alt', null, 'ayakkabi', null,
      'sapka', null, 'gozluk', null, 'kupe', null, 'efekt', null
    );

    -- %30 başlangıç kıyafeti (yalnız renk/saç değişir) — düşük seviyelerde.
    -- %50 sıradan eşyalar · %20 bir "özel" dokunuş (şapka/gözlük/küpe).
    -- Seviye yükseldikçe giyinik olma ihtimali artar (seviye-görünüm uyumu).
    if v_p >= 0.30 - least(0.20, v_seviye::numeric / 500) then
      v_yeni := v_yeni
        || jsonb_build_object(
             'ust', (array['ust_01','ust_02','ust_03'])[
                      1 + (floor(public.bot_rasgele('u:' || r.takma_ad) * 3))::int],
             'ayakkabi', (array['ayk_01','ayk_02'])[
                      1 + (floor(public.bot_rasgele('a:' || r.takma_ad) * 2))::int]);
    end if;

    if v_p >= 0.80 then
      -- "Özel" dokunuş: etkinlik eşyası ASLA (spk_04 bilerek yok).
      if public.bot_rasgele('oz:' || r.takma_ad) < 0.5 then
        v_yeni := v_yeni || jsonb_build_object('sapka',
          (array['spk_01','spk_02','spk_03'])[
            1 + (floor(public.bot_rasgele('s:' || r.takma_ad) * 3))::int]);
      else
        v_yeni := v_yeni || jsonb_build_object('gozluk',
          (array['gzl_01','gzl_02'])[
            1 + (floor(public.bot_rasgele('g:' || r.takma_ad) * 2))::int]);
      end if;
    end if;

    update public.profiles set gorunum = v_yeni where id = r.id;
  end loop;
end
$gorunum$;
