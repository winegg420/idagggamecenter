-- Paket 26 A.5 — Hız sınırı kapsamı genişletildi.
-- Ölçüm: istemcinin çağırdığı 170 RPC'nin yalnız 39'unda hiz_siniri vardı.
-- Buraya, tekrarlanabilir ve kötüye kullanılabilir uçlar eklendi: davet atma,
-- arkadaşlık istekleri, kuyruğa girme, turnuva lobisine girip çıkma, sohbet,
-- ödül alma, takma ad / avatar değiştirme, push kaydı, skor gönderme.
--
-- BİLEREK EKLENMEDİ: nabız uçları (mac_nabiz, grup_mac_nabiz, hizli_mac_nabiz) ve
-- advance_* — bunlar oyun sırasında saniyede bir çağrılır, sınır konursa maç kırılır.
--
-- Gövdeler canlıdaki hâlinden alındı; tek değişiklik her fonksiyonun ilk satırına
-- eklenen hiz_siniri çağrısıdır. hiz_siniri oturumsuz çağrılarda (bot/cron) çalışmaz.

CREATE OR REPLACE FUNCTION public.send_friend_request(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ters uuid;
begin
  perform public.hiz_siniri('send_friend_request', 30, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_target = auth.uid() then raise exception 'Kendini ekleyemezsin'; end if;

  -- Karşı taraf zaten istek gönderdiyse direkt arkadaş yap
  select id into v_ters from public.friendships
  where requester = p_target and addressee = auth.uid();
  if found then
    update public.friendships set durum = 'arkadas' where id = v_ters;
    return;
  end if;

  insert into public.friendships (requester, addressee)
  values (auth.uid(), p_target)
  on conflict (requester, addressee) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_id uuid, p_kabul boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f public.friendships%rowtype;
begin
  perform public.hiz_siniri('respond_friend_request', 30, interval '60 seconds');
  select * into f from public.friendships where id = p_id for update;
  if not found then raise exception 'İstek bulunamadı'; end if;
  if f.addressee <> auth.uid() then raise exception 'Bu istek sana gelmedi'; end if;
  if f.durum <> 'bekliyor' then return; end if;

  if p_kabul then
    update public.friendships set durum = 'arkadas' where id = p_id;
  else
    delete from public.friendships where id = p_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.hiz_siniri('remove_friend', 30, interval '60 seconds');
  delete from public.friendships
  where id = p_id and (requester = auth.uid() or addressee = auth.uid());
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_group_challenge(p_rakipler uuid[], p_kategori text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
  v_ad text;
begin
  perform public.hiz_siniri('create_group_challenge', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi not in (2, 3, 4) then
    raise exception 'Grup için 2, 3 veya 4 rakip seçmelisin (toplam 3-5 kişi)';
  end if;
  if auth.uid() = any(p_rakipler) then
    raise exception 'Kendini seçemezsin';
  end if;
  if v_sayi <> (select count(distinct x) from unnest(p_rakipler) x) then
    raise exception 'Aynı oyuncuyu birden fazla seçemezsin';
  end if;
  foreach v_r in array p_rakipler loop
    if not exists (select 1 from public.profiles where id = v_r) then
      raise exception 'Oyuncu bulunamadı';
    end if;
    if not public.oynanabilir_mi(v_r) then
      raise exception 'Gruba yalnız arkadaşlarını ve botlarını çağırabilirsin.';
    end if;
    -- Kural 2: hangi oyuncunun engellediği söylensin (Paket 24 · A.2)
    begin
      perform public.davet_siniri_kontrol(v_r);
    exception when others then
      select gorunen_ad into v_ad from public.profiles where id = v_r;
      raise exception '% ile zaten 2 bekleyen davetin var.', coalesce(v_ad, 'Bir oyuncu');
    end;
  end loop;

  perform public.mac_kotasi_kontrol();

  insert into public.group_matches (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), v_sayi + 1, p_kategori)
  returning id into v_id;

  insert into public.group_match_players (group_match_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.group_match_players (group_match_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.kuyruga_gir(p_kategori text DEFAULT NULL::text, p_dereceli boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kat text;
  v_id uuid;
  v_rakip uuid;
  v_rakip_kat text;
  v_secilen_kat text;
  v_puan int;
  v_bekleme int;
begin
  perform public.hiz_siniri('kuyruga_gir', 30, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );
  select coalesce(pr.puan, 0) into v_puan from public.profiles pr where pr.id = auth.uid();

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Kuyrukta ne kadardır bekliyorum? (saniye) Aralık buna göre genişler.
  select coalesce(extract(epoch from (now() - q.created_at))::int, 0)
    into v_bekleme
    from public.matchmaking_queue q where q.user_id = auth.uid();
  v_bekleme := coalesce(v_bekleme, 0);

  -- 1) Aynı kategori + (dereceliyse) uygun seviye
  select q.user_id, q.kategori into v_rakip, v_rakip_kat
  from public.matchmaking_queue q
  join public.profiles pr on pr.id = q.user_id
  where q.user_id <> auth.uid()
    and q.kategori is not distinct from v_kat
    and (
      not p_dereceli
      or coalesce(q.dereceli, true) = p_dereceli
    )
    and (
      not p_dereceli
      -- DERECELİ: kendi basamağım ya da ALTI. Yukarı çıkma yok.
      -- 20 sn'den fazla bekledimse bir basamak daha aşağı açılır.
      or public.seviye_basamagi(pr.puan) between
           greatest(0, public.seviye_basamagi(v_puan) - (case when v_bekleme > 20 then 2 else 1 end))
           and public.seviye_basamagi(v_puan)
    )
  order by
    -- En yakın seviyeden başla
    abs(public.seviye_basamagi(pr.puan) - public.seviye_basamagi(v_puan)),
    q.created_at
  limit 1
  for update skip locked;

  -- 2) Yoksa: 20 saniyedir bekleyen herhangi bir rakip (karışık kategori)
  if not found then
    select q.user_id, null::text into v_rakip, v_rakip_kat
    from public.matchmaking_queue q
    join public.profiles pr on pr.id = q.user_id
    where q.user_id <> auth.uid()
      and q.created_at < now() - interval '20 seconds'
      and (not p_dereceli or coalesce(q.dereceli, true) = p_dereceli)
      and (
        not p_dereceli
        or public.seviye_basamagi(pr.puan) <= public.seviye_basamagi(v_puan)
      )
    order by q.created_at
    limit 1
    for update skip locked;
  end if;

  if found and v_rakip is not null then
    v_secilen_kat := v_rakip_kat;
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());

    if not public.hileli_mi() then
      perform public.mac_kotasi_kontrol();
    end if;

    insert into public.matches
      (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
    values (
      v_rakip, auth.uid(), 'aktif', v_secilen_kat,
      public.soru_sec(v_secilen_kat, 20, array[auth.uid(), v_rakip]),
      0, now(), p_dereceli
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Eşleşme yok: kuyruğa gir (varsa süreyi koru — 20 sn sayacı sıfırlanmasın)
  insert into public.matchmaking_queue (user_id, kategori, dereceli)
  values (auth.uid(), v_kat, p_dereceli)
  on conflict (user_id) do update
    set kategori = excluded.kategori,
        dereceli = excluded.dereceli;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_tournament_lobby()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tarih date;
  v_seans text;
  v_id uuid;
begin
  perform public.hiz_siniri('join_tournament_lobby', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  select o_tarih, o_seans into v_tarih, v_seans from public.sonraki_turnuva_bilgi();

  insert into public.tournaments (tarih, seans)
  values (v_tarih, v_seans)
  on conflict (tarih, seans) do nothing;

  select id into v_id from public.tournaments where tarih = v_tarih and seans = v_seans;

  if (select durum from public.tournaments where id = v_id) <> 'lobi' then
    raise exception 'Turnuva lobisi kapalı';
  end if;

  insert into public.tournament_players (tournament_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.leave_tournament_lobby()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.hiz_siniri('leave_tournament_lobby', 20, interval '60 seconds');
  delete from public.tournament_players tp
  using public.tournaments t
  where tp.tournament_id = t.id
    and tp.user_id = auth.uid()
    and t.durum = 'lobi';
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_match_message(p_match_id uuid, p_mesaj text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
begin
  perform public.hiz_siniri('send_match_message', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if not (p_mesaj = any (public.izinli_mesajlar())) then
    raise exception 'Geçersiz mesaj';
  end if;

  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  -- Hız sınırı: 2 saniyede en fazla 1 mesaj
  if exists (
    select 1 from public.match_messages
    where match_id = p_match_id and user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Biraz yavaş 🙂';
  end if;

  insert into public.match_messages (match_id, user_id, mesaj)
  values (p_match_id, auth.uid(), p_mesaj);
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_group_match_message(p_group_match_id uuid, p_mesaj text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
begin
  perform public.hiz_siniri('send_group_match_message', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if not (p_mesaj = any (public.izinli_mesajlar())) then
    raise exception 'Geçersiz mesaj';
  end if;

  select * into gm from public.group_matches where id = p_group_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  -- Hız sınırı: 2 saniyede en fazla 1 mesaj
  if exists (
    select 1 from public.group_match_messages
    where group_match_id = p_group_match_id and user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Biraz yavaş 🙂';
  end if;

  insert into public.group_match_messages (group_match_id, user_id, mesaj)
  values (p_group_match_id, auth.uid(), p_mesaj);
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_hedef int;
  v_odul int;
begin
  perform public.hiz_siniri('claim_quest', 30, interval '60 seconds');
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
$function$;

CREATE OR REPLACE FUNCTION public.reklam_odulu_al(p_reklam_ref text)
 RETURNS TABLE(verilen integer, bugun integer, tavan integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_tavan int := public.ayar_sayi('reklam_gunluk_tavan', 5)::int;
  v_odul bigint := public.ayar_sayi('coin_reklam', 25);
  v_gun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sayac int;
  v_ref text;
begin
  perform public.hiz_siniri('reklam_odulu_al', 20, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  v_ref := nullif(btrim(coalesce(p_reklam_ref, '')), '');
  if v_ref is null then raise exception 'Geçersiz reklam referansı'; end if;

  -- Aynı reklam referansı iki kez ödüllendirilemez
  if exists (
    select 1 from public.coin_hareketleri
    where user_id = v_me and tur = 'reklam' and referans = v_ref
  ) then
    raise exception 'Bu reklam ödülü zaten alındı';
  end if;

  insert into public.reklam_odulleri (user_id, gun, sayac)
  values (v_me, v_gun, 0)
  on conflict (user_id, gun) do nothing;

  select r.sayac into v_sayac
  from public.reklam_odulleri r
  where r.user_id = v_me and r.gun = v_gun
  for update;

  if v_sayac >= v_tavan then
    raise exception 'Bugünkü reklam ödülü hakkın doldu (%/%)', v_sayac, v_tavan;
  end if;

  update public.reklam_odulleri
     set sayac = sayac + 1
   where user_id = v_me and gun = v_gun
  returning sayac into v_sayac;

  perform public.coin_ekle(v_me, v_odul, 'reklam', v_ref);

  return query select v_odul::int, v_sayac, v_tavan;
end;
$function$;

CREATE OR REPLACE FUNCTION public.takma_ad_sec(p_ad text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ad text;
  v_p public.profiles%rowtype;
  v_kalan interval;
begin
  perform public.hiz_siniri('takma_ad_sec', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_ad := btrim(coalesce(p_ad, ''));

  if length(v_ad) < 3 or length(v_ad) > 16 then
    raise exception 'Takma ad 3-16 karakter olmalı.';
  end if;
  -- Harf (Türkçe dahil), rakam ve alt çizgi
  if v_ad !~ '^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]+$' then
    raise exception 'Takma adda yalnız harf, rakam ve alt çizgi kullanabilirsin.';
  end if;
  if v_ad ~ '^[0-9_]+$' then
    raise exception 'Takma ad en az bir harf içermeli.';
  end if;

  if exists (
    select 1 from public.yasakli_kelimeler y
    where lower(v_ad) like '%' || y.kelime || '%'
  ) then
    raise exception 'Bu takma ad kullanılamaz. Başka bir tane dene.';
  end if;

  select * into v_p from public.profiles where id = auth.uid();
  if not found then raise exception 'Profil bulunamadı'; end if;

  -- Aynı adı tekrar göndermek kilidi harcamasın
  if v_p.takma_ad_secildi and lower(coalesce(v_p.takma_ad, '')) = lower(v_ad) then
    return;
  end if;

  -- KİLİT: 30 gün -> 24 saat
  if v_p.takma_ad_secildi
     and v_p.takma_ad_degisti_at is not null
     and v_p.takma_ad_degisti_at > now() - interval '24 hours'
  then
    v_kalan := (v_p.takma_ad_degisti_at + interval '24 hours') - now();
    raise exception 'Takma adını günde bir kez değiştirebilirsin. Kalan: % saat % dakika',
      extract(hour from v_kalan)::int, extract(minute from v_kalan)::int;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.takma_ad) = lower(v_ad) and p.id <> auth.uid()
  ) then
    raise exception 'Bu takma ad alınmış. Başka bir tane dene.';
  end if;

  begin
    update public.profiles
       set takma_ad = v_ad,
           takma_ad_secildi = true,
           takma_ad_degisti_at = now()
     where id = auth.uid();
  exception when unique_violation then
    raise exception 'Bu takma ad alınmış. Başka bir tane dene.';
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.hiz_siniri('save_push_subscription', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$function$;

CREATE OR REPLACE FUNCTION public.kafatopu_davet_gonder(p_oda uuid, p_alici uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ben uuid := auth.uid();
begin
  perform public.hiz_siniri('kafatopu_davet_gonder', 20, interval '60 seconds');
  if ben is null then raise exception 'Oturum yok'; end if;
  if p_alici = ben then raise exception 'Kendini davet edemezsin'; end if;
  if not exists (
    select 1 from public.kafatopu_oda_oyunculari where oda_id = p_oda and user_id = ben
  ) then raise exception 'Bu odada değilsin'; end if;
  if not exists (
    select 1 from public.kafatopu_odalar where id = p_oda and durum = 'bekliyor'
  ) then raise exception 'Oda aktif değil'; end if;
  insert into public.kafatopu_davetler (oda_id, gonderen, alici)
  values (p_oda, ben, p_alici)
  on conflict (oda_id, alici) do update set durum = 'bekliyor', created_at = now();
end; $function$;

CREATE OR REPLACE FUNCTION public.meyvekes_skor_kaydet(p_mod text, p_skor integer, p_kesim integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.hiz_siniri('meyvekes_skor_kaydet', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('tekli','arkadas','yeme') then raise exception 'Geçersiz mod'; end if;
  -- makul sınırlar (istemciye güvenme)
  if p_skor < 0 or p_skor > 5000 then raise exception 'Geçersiz skor'; end if;
  if p_kesim < 0 or p_kesim > 5000 then p_kesim := 0; end if;

  insert into public.meyvekes_skorlar (user_id, mod, en_iyi, toplam_kesim, oyun_sayisi, updated_at)
  values (auth.uid(), p_mod, greatest(p_skor, 0), greatest(p_kesim, 0), 1, now())
  on conflict (user_id, mod) do update
    set en_iyi = greatest(public.meyvekes_skorlar.en_iyi, excluded.en_iyi),
        toplam_kesim = public.meyvekes_skorlar.toplam_kesim + excluded.toplam_kesim,
        oyun_sayisi = public.meyvekes_skorlar.oyun_sayisi + 1,
        updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.boks_oturum_kaydet(p_mod text, p_zorluk text, p_ozet jsonb, p_roundlar jsonb, p_zayifliklar jsonb DEFAULT '[]'::jsonb, p_rozetler text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_oturum uuid;
  v_round jsonb;
  v_no int := 0;
  v_puan int := coalesce((p_ozet->>'puan')::int, 0);
  v_yumruk int := coalesce((p_ozet->>'toplamYumruk')::int, 0);
  v_sure int := coalesce((p_ozet->>'sure')::int, 0);
  v_kalori int := coalesce((p_ozet->>'kalori')::int, 0);
  v_bugun date := (now() at time zone 'utc')::date;
  v_son_gun date;
  v_seri int;
  v_sezon int := extract(year from now())::int * 12 + extract(month from now())::int;
  v_yeni_rozet text[] := '{}';
  v_kod text;
  v_z jsonb;
begin
  perform public.hiz_siniri('boks_oturum_kaydet', 20, interval '60 seconds');
  if v_uid is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('serbest','koc','savunma','ritim') then raise exception 'Geçersiz mod'; end if;
  if p_zorluk not in ('kolay','orta','zor','pro','test') then raise exception 'Geçersiz zorluk'; end if;
  -- Üst sınırlar: 5 round × 90 sn'de teorik tavanın çok üstünü reddet.
  if v_puan < 0 or v_puan > 200000 then raise exception 'Geçersiz puan'; end if;
  if v_yumruk < 0 or v_yumruk > 5000 then raise exception 'Geçersiz yumruk sayısı'; end if;
  if v_sure < 0 or v_sure > 3600 then raise exception 'Geçersiz süre'; end if;
  if v_kalori < 0 or v_kalori > 3000 then v_kalori := 0; end if;

  insert into public.boks_oturumlar (
    user_id, mod, zorluk, round_sayisi, puan, toplam_yumruk, isabet, kacirma,
    sure_sn, kalori, ort_siddet, max_siddet, en_iyi_combo, stil_kod, eslesen_dovuscu
  ) values (
    v_uid, p_mod, p_zorluk,
    coalesce(jsonb_array_length(p_roundlar), 0),
    v_puan, v_yumruk,
    coalesce((p_ozet->>'isabet')::int, 0),
    coalesce((p_ozet->>'kacirma')::int, 0),
    v_sure, v_kalori,
    least(100, greatest(0, coalesce((p_ozet->>'ortSiddet')::int, 0))),
    least(100, greatest(0, coalesce((p_ozet->>'siddetMax')::int, 0))),
    least(999, greatest(0, coalesce((p_ozet->>'enIyiCombo')::int, 0))),
    nullif(p_ozet->>'stilKod',''),
    nullif(p_ozet->>'eslesenDovuscu','')
  ) returning id into v_oturum;

  -- ---- roundlar ----
  for v_round in select * from jsonb_array_elements(coalesce(p_roundlar, '[]'::jsonb))
  loop
    v_no := v_no + 1;
    insert into public.boks_roundlar (
      oturum_id, user_id, round_no, puan,
      y1, y2, y3, y4, y5, y6,
      toplam_yumruk, isabet, kacirma, yanlis_tur, sol_yumruk, sag_yumruk,
      siddet_toplam, siddet_max, dusuk_gard_olay, vurusta_acik_gard,
      gard_dusuk_sure, gard_olcu_sure, kacinma_deneme, kacinma_basari, blok,
      postur_uyari, en_iyi_combo, sure_sn, tempo_dilim, kalca_gorundu, bacak_gorundu
    ) values (
      v_oturum, v_uid, v_no,
      greatest(0, coalesce((v_round->>'puan')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'1')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'2')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'3')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'4')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'5')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'6')::int, 0)),
      greatest(0, coalesce((v_round->>'toplamYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'isabet')::int, 0)),
      greatest(0, coalesce((v_round->>'kacirma')::int, 0)),
      greatest(0, coalesce((v_round->>'yanlisTur')::int, 0)),
      greatest(0, coalesce((v_round->>'solYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'sagYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'siddetToplam')::int, 0)),
      least(100, greatest(0, coalesce((v_round->>'siddetMax')::int, 0))),
      greatest(0, coalesce((v_round->>'dusukGardOlay')::int, 0)),
      greatest(0, coalesce((v_round->>'vurustaAcikGard')::int, 0)),
      greatest(0, coalesce((v_round->>'gardDusukSure')::real, 0)),
      greatest(0, coalesce((v_round->>'gardOlcuSure')::real, 0)),
      greatest(0, coalesce((v_round->>'kacinmaDeneme')::int, 0)),
      greatest(0, coalesce((v_round->>'kacinmaBasari')::int, 0)),
      greatest(0, coalesce((v_round->>'blok')::int, 0)),
      greatest(0, coalesce((v_round->>'posturUyari')::int, 0)),
      greatest(0, coalesce((v_round->>'enIyiCombo')::int, 0)),
      greatest(0, coalesce((v_round->>'sure')::int, 0)),
      coalesce((select array_agg(x)::int[] from jsonb_array_elements_text(coalesce(v_round->'tempoDilim','[]'::jsonb)) as t(x)), '{}'),
      coalesce((v_round->'kapsam'->>'kalca')::boolean, false),
      coalesce((v_round->'kapsam'->>'bacaklar')::boolean, false)
    );
  end loop;

  -- ---- kariyer + streak ----
  select son_gun, seri_gun into v_son_gun, v_seri
    from public.boks_kariyer where user_id = v_uid for update;

  if v_son_gun is null then
    v_seri := 1;
  elsif v_son_gun = v_bugun then
    v_seri := greatest(1, coalesce(v_seri, 1));
  elsif v_son_gun = v_bugun - 1 then
    v_seri := coalesce(v_seri, 0) + 1;
  else
    v_seri := 1;
  end if;

  insert into public.boks_kariyer as k (
    user_id, toplam_oturum, toplam_round, toplam_puan, toplam_yumruk, toplam_isabet,
    toplam_kacirma, toplam_yanlis_tur, toplam_sure, toplam_kalori,
    y1, y2, y3, y4, y5, y6, sol_yumruk, sag_yumruk, siddet_toplam, siddet_max,
    dusuk_gard_olay, vurusta_acik_gard, gard_dusuk_sure, gard_olcu_sure,
    kacinma_deneme, kacinma_basari, blok, postur_uyari, en_iyi_combo,
    kalca_gorundu, bacak_gorundu, stil_kod, eslesen_dovuscu,
    seri_gun, en_uzun_seri, son_gun, antrenman_gun, updated_at
  )
  select
    v_uid, 1, coalesce(jsonb_array_length(p_roundlar),0), v_puan, v_yumruk,
    coalesce(sum(r.isabet),0), coalesce(sum(r.kacirma),0), coalesce(sum(r.yanlis_tur),0),
    v_sure, v_kalori,
    coalesce(sum(r.y1),0), coalesce(sum(r.y2),0), coalesce(sum(r.y3),0),
    coalesce(sum(r.y4),0), coalesce(sum(r.y5),0), coalesce(sum(r.y6),0),
    coalesce(sum(r.sol_yumruk),0), coalesce(sum(r.sag_yumruk),0),
    coalesce(sum(r.siddet_toplam),0), coalesce(max(r.siddet_max),0),
    coalesce(sum(r.dusuk_gard_olay),0), coalesce(sum(r.vurusta_acik_gard),0),
    coalesce(sum(r.gard_dusuk_sure),0), coalesce(sum(r.gard_olcu_sure),0),
    coalesce(sum(r.kacinma_deneme),0), coalesce(sum(r.kacinma_basari),0),
    coalesce(sum(r.blok),0), coalesce(sum(r.postur_uyari),0), coalesce(max(r.en_iyi_combo),0),
    coalesce(bool_or(r.kalca_gorundu), false), coalesce(bool_or(r.bacak_gorundu), false),
    nullif(p_ozet->>'stilKod',''), nullif(p_ozet->>'eslesenDovuscu',''),
    v_seri, v_seri, v_bugun, 1, now()
  from public.boks_roundlar r where r.oturum_id = v_oturum
  on conflict (user_id) do update set
    toplam_oturum = k.toplam_oturum + 1,
    toplam_round = k.toplam_round + excluded.toplam_round,
    toplam_puan = k.toplam_puan + excluded.toplam_puan,
    toplam_yumruk = k.toplam_yumruk + excluded.toplam_yumruk,
    toplam_isabet = k.toplam_isabet + excluded.toplam_isabet,
    toplam_kacirma = k.toplam_kacirma + excluded.toplam_kacirma,
    toplam_yanlis_tur = k.toplam_yanlis_tur + excluded.toplam_yanlis_tur,
    toplam_sure = k.toplam_sure + excluded.toplam_sure,
    toplam_kalori = k.toplam_kalori + excluded.toplam_kalori,
    y1 = k.y1 + excluded.y1, y2 = k.y2 + excluded.y2, y3 = k.y3 + excluded.y3,
    y4 = k.y4 + excluded.y4, y5 = k.y5 + excluded.y5, y6 = k.y6 + excluded.y6,
    sol_yumruk = k.sol_yumruk + excluded.sol_yumruk,
    sag_yumruk = k.sag_yumruk + excluded.sag_yumruk,
    siddet_toplam = k.siddet_toplam + excluded.siddet_toplam,
    siddet_max = greatest(k.siddet_max, excluded.siddet_max),
    dusuk_gard_olay = k.dusuk_gard_olay + excluded.dusuk_gard_olay,
    vurusta_acik_gard = k.vurusta_acik_gard + excluded.vurusta_acik_gard,
    gard_dusuk_sure = k.gard_dusuk_sure + excluded.gard_dusuk_sure,
    gard_olcu_sure = k.gard_olcu_sure + excluded.gard_olcu_sure,
    kacinma_deneme = k.kacinma_deneme + excluded.kacinma_deneme,
    kacinma_basari = k.kacinma_basari + excluded.kacinma_basari,
    blok = k.blok + excluded.blok,
    postur_uyari = k.postur_uyari + excluded.postur_uyari,
    en_iyi_combo = greatest(k.en_iyi_combo, excluded.en_iyi_combo),
    kalca_gorundu = k.kalca_gorundu or excluded.kalca_gorundu,
    bacak_gorundu = k.bacak_gorundu or excluded.bacak_gorundu,
    stil_kod = coalesce(excluded.stil_kod, k.stil_kod),
    eslesen_dovuscu = coalesce(excluded.eslesen_dovuscu, k.eslesen_dovuscu),
    seri_gun = v_seri,
    en_uzun_seri = greatest(k.en_uzun_seri, v_seri),
    antrenman_gun = k.antrenman_gun + (case when k.son_gun is distinct from v_bugun then 1 else 0 end),
    son_gun = v_bugun,
    updated_at = now();

  -- ---- leaderboard + sezon (test round'u sayılmaz) ----
  if p_zorluk <> 'test' then
    insert into public.boks_skorlar (user_id, mod, en_iyi, toplam_yumruk, oyun_sayisi, updated_at)
    values (v_uid, p_mod, v_puan, v_yumruk, 1, now())
    on conflict (user_id, mod) do update set
      en_iyi = greatest(public.boks_skorlar.en_iyi, excluded.en_iyi),
      toplam_yumruk = public.boks_skorlar.toplam_yumruk + excluded.toplam_yumruk,
      oyun_sayisi = public.boks_skorlar.oyun_sayisi + 1,
      updated_at = now();

    insert into public.boks_sezon (user_id, sezon, puan, round_sayisi, updated_at)
    values (v_uid, v_sezon, v_puan, coalesce(jsonb_array_length(p_roundlar),0), now())
    on conflict (user_id, sezon) do update set
      puan = public.boks_sezon.puan + excluded.puan,
      round_sayisi = public.boks_sezon.round_sayisi + excluded.round_sayisi,
      updated_at = now();
  end if;

  -- ---- zayıflık takibi (koçluk döngüsü) ----
  for v_z in select * from jsonb_array_elements(coalesce(p_zayifliklar, '[]'::jsonb))
  loop
    insert into public.boks_zayifliklar (user_id, kod, gorulme_sayisi, son_olcum, durum, son_gorulme)
    values (v_uid, left(coalesce(v_z->>'kod','?'), 40), 1, left(coalesce(v_z->>'olcum',''), 120), 'aktif', now())
    on conflict (user_id, kod) do update set
      gorulme_sayisi = public.boks_zayifliklar.gorulme_sayisi + 1,
      son_olcum = excluded.son_olcum,
      durum = 'aktif',
      son_gorulme = now();
  end loop;

  -- Bu oturumda görülmeyen aktif zayıflıklar "düzeldi" işaretlenir.
  update public.boks_zayifliklar z set durum = 'duzeldi'
   where z.user_id = v_uid and z.durum = 'aktif'
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_zayifliklar,'[]'::jsonb)) e
        where e->>'kod' = z.kod
     );

  -- ---- rozetler ----
  foreach v_kod in array coalesce(p_rozetler, '{}'::text[])
  loop
    if length(v_kod) between 1 and 40 then
      insert into public.boks_rozetler (user_id, kod) values (v_uid, v_kod)
      on conflict (user_id, kod) do nothing;
      if found then v_yeni_rozet := array_append(v_yeni_rozet, v_kod); end if;
    end if;
  end loop;

  return jsonb_build_object(
    'oturum_id', v_oturum,
    'seri_gun', v_seri,
    'yeni_rozetler', to_jsonb(v_yeni_rozet)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.avatar_onayla(p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_url text;
begin
  perform public.hiz_siniri('avatar_onayla', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_url := nullif(btrim(coalesce(p_url, '')), '');

  if v_url is null then
    update public.profiles
       set avatar_url = null, avatar_onayli = false
     where id = auth.uid();
    return;
  end if;

  if length(v_url) > 500 then raise exception 'Avatar adresi çok uzun'; end if;
  if v_url !~ '^(/[A-Za-z0-9._/-]+|https://[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]+)$' then
    raise exception 'Geçersiz avatar adresi';
  end if;

  update public.profiles
     set avatar_url = v_url, avatar_onayli = true
   where id = auth.uid();
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_challenge(p_rakip uuid, p_kategori text DEFAULT NULL::text, p_dereceli boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  perform public.hiz_siniri('create_challenge', 20, interval '60 seconds');
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

CREATE OR REPLACE FUNCTION public.create_challenge(p_rakip uuid, p_kategori text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  perform public.hiz_siniri('create_challenge', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;
  -- Kural 5: aynı modda ikinci davet yok (mevcut kontrol, korunur)
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;
  -- Kural 2: modlar toplamı (Paket 24 · A.2)
  perform public.davet_siniri_kontrol(p_rakip);

  perform public.mac_kotasi_kontrol();

  insert into public.matches (oyuncu1, oyuncu2, kategori)
  values (auth.uid(), p_rakip, p_kategori)
  returning id into v_id;
  return v_id;
end;
$function$;

