-- ============================================================
-- BOTLARIN GERÇEKÇİLİĞİ — SABIRSIZ EŞLEŞME, HAZIR GECİKMESİ, PUAN
--
-- Sahibinin isteği (Revizyon Paketi 5, madde 4):
--   1. "Beklemeden eşleş"e basılırsa karşıya SEVİYELİ AÇIK bot gelsin
--      (ÜstatBot, ÇaylakBot gibi) — anında.
--   2. Bot lobide "otomatik hazır" olmasın; bir insan gibi 0.5-3 sn sonra
--      hazıra bassın.
--   3. Botlar canlı şekilde puan kassın, zamana yayılarak.
--
-- ÖLÇÜLEN ÖNCEKİ DURUM:
--   • `quick_match` botu ancak `bot_eslesme_gecikmesi` (2-5 sn) sonra
--     kuruyordu; "Beklemeden eşleş" düğmesi de aynı yolu çağırdığı için
--     ANINDA değildi ve GİZLİ bot getiriyordu (oyuncu bot istediğini
--     bilerek bastığı hâlde).
--   • `hizli_mac_nabiz` / `grup_mac_nabiz`: `hazir or is_bot` — bot sıfırıncı
--     saniyede hazır sayılıyordu.
--   • Botların puanı: 160 botun yalnız 6'sında puan vardı, en yüksek 250.
--     Doğal yol (mac_sonuclandir → lig_bot_puan_yuzde) ÇALIŞIYOR ama
--     gerçek maç trafiği yok; lig tablosunda botlar 0 puanla duruyordu.
--
-- `is_bot` İSTEMCİYE SIZMAZ: aşağıdaki hiçbir fonksiyon `is_bot`
-- döndürmez. `hemen_bot_mac` yalnız AÇIK bot seçer — onlar zaten adından
-- belli ("...Bot") ve oyuncu o düğmeye bilerek basar.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('bot_hazir_gecikme_min', '0.5'::jsonb,
   'Bot lobide hazıra basmadan önceki en kısa bekleme (sn). İnsan tepki süresi taklidi.'),
  ('bot_hazir_gecikme_max', '3'::jsonb,
   'Bot lobide hazıra basmadan önceki en uzun bekleme (sn).'),
  ('bot_puan_mac_dk_min', '55'::jsonb,
   'Bir botun "maç oynadığı" varsayılan en sık aralık (dakika). Puan buna göre artar.'),
  ('bot_puan_mac_dk_max', '420'::jsonb,
   'Bir botun "maç oynadığı" en seyrek aralık (dakika). Her bota bu bandan sabit bir tempo düşer.'),
  ('bot_puan_galibiyet_yuzde', '55'::jsonb,
   'Simüle maçlarda botun kazanma yüzdesi. Kazanınca puan alır, kaybedince almaz.')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

-- ------------------------------------------------------------
-- 1) SABIRSIZ TIKLAMA → SEVİYELİ AÇIK BOT, ANINDA
--
-- Yeni eşleştirme algoritması YAZILMADI: oyuncunun ligi ile açık botun
-- ligi karşılaştırılıp en yakını seçiliyor (ToyBot/BilgeBot bronz,
-- ÇaylakBot gümüş, ÜstatBot altın, EfsaneBot elmas).
-- Ödül tarafı da mevcut kuralda kalır: açık bot maçında coin yarıya iner
-- (`coin_bot_carpani`, mac_sonuclandir içinde).
-- ------------------------------------------------------------
create or replace function public.hemen_bot_mac(p_kategori text default null, p_dereceli boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_bot uuid;
  v_kat text;
  v_lig int;
begin
  perform public.hiz_siniri('hemen_bot_mac', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  -- Zaten aktif maçı varsa oraya döndür (çift maç açılmasın).
  select m.id into v_id from public.matches m
   where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
   limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  select public.lig_sirasi(coalesce(lig, 'bronz')) into v_lig
    from public.profiles where id = auth.uid();
  v_lig := coalesce(v_lig, 1);

  -- Seviyesi en yakın AÇIK bot. Eşitlikte rastgele: hep aynı bot gelmesin.
  select p.id into v_bot
    from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true)
     and coalesce(p.bot_turu, 'acik') = 'acik'
   order by abs(public.lig_sirasi(coalesce(p.lig, 'bronz')) - v_lig), random()
   limit 1;

  -- Açık bot havuzu boşsa oyuncu düğmeye bassın da bir şey olsun:
  -- gizli bot seçicisine düşülür (mevcut mantık, yeni algoritma değil).
  if v_bot is null then
    v_bot := public.bot_sec(auth.uid());
  end if;
  if v_bot is null then
    raise exception 'Şu an uygun rakip yok, birazdan tekrar dene.';
  end if;

  delete from public.matchmaking_queue where user_id = auth.uid();

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
$fn$;

revoke all on function public.hemen_bot_mac(text, boolean) from public, authenticated, anon;
grant execute on function public.hemen_bot_mac(text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 2) BOT HAZIR GECİKMESİ
-- Bot lobiye girdiği andan (joined_at) itibaren deterministik bir süre
-- sonra hazır sayılır. Deterministik: aynı bot aynı lobide her yoklamada
-- aynı anda hazır olur, zıplama olmaz.
-- ------------------------------------------------------------
create or replace function public.bot_hazir_mi(p_bot uuid, p_katilim timestamptz, p_tohum text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select now() >= coalesce(p_katilim, now())
       + make_interval(secs =>
           public.ayar_ondalik('bot_hazir_gecikme_min', 0.5)::double precision
         + public.bot_rasgele('hazir:' || p_bot::text || ':' || coalesce(p_tohum, ''))
           * greatest(0, public.ayar_ondalik('bot_hazir_gecikme_max', 3)
                         - public.ayar_ondalik('bot_hazir_gecikme_min', 0.5))::double precision);
$fn$;

revoke all on function public.bot_hazir_mi(uuid, timestamptz, text) from public, authenticated, anon;

-- HIZLI MAÇ NABZI — yalnız "bot hazır mı" kuralı değişti, gerisi aynı.
create or replace function public.hizli_mac_nabiz(p_hizli_mac_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, hazir_sayisi integer,
              toplam_oyuncu integer, bekleyenler text[], duraklatildi boolean,
              duraklama_sn integer, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  v_ben_hazir boolean;
  v_hazir int;
  v_toplam int;
  v_kopuk int;
  v_bekleyenler text[];
  v_duraklama int := 0;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid()
  ) then raise exception 'Bu maçta değilsin'; end if;

  update public.hizli_oyuncular
     set nabiz_at = now(),
         hazir = hazir or coalesce(p_hazir, false)
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  select count(*),
         -- ESKİDEN: `or coalesce(pr.is_bot,false)` — bot 0. saniyede hazırdı.
         count(*) filter (where ho.hazir or (coalesce(pr.is_bot, false)
                            and public.bot_hazir_mi(pr.id, ho.joined_at, p_hizli_mac_id::text))),
         count(*) filter (where not coalesce(pr.is_bot, false)
                            and coalesce(ho.nabiz_at, '-infinity'::timestamptz)
                                <= now() - interval '12 seconds'),
         coalesce(array_agg(pr.gorunen_ad) filter (
           where not coalesce(pr.is_bot, false)
             and coalesce(ho.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds'
         ), '{}'::text[])
    into v_toplam, v_hazir, v_kopuk, v_bekleyenler
    from public.hizli_oyuncular ho
    join public.profiles pr on pr.id = ho.user_id
   where ho.hizli_mac_id = p_hizli_mac_id
     and ho.davet_durumu = 'kabul'
     and ho.terk_at is null;

  select (hazir or coalesce((select is_bot from public.profiles where id = auth.uid()), false))
    into v_ben_hazir
    from public.hizli_oyuncular
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  if hm.durum = 'aktif' and not hm.basladi then
    if v_toplam > 0 and v_hazir >= v_toplam and v_kopuk = 0 then
      update public.hizli_maclar
         set basladi = true, aktif_soru = 0, soru_baslangic = now()
       where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
    end if;

  elsif hm.durum = 'aktif' and hm.basladi then
    if v_kopuk > 0 and hm.duraklatildi_at is null then
      update public.hizli_maclar set duraklatildi_at = now() where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;

    elsif v_kopuk = 0 and hm.duraklatildi_at is not null then
      update public.hizli_maclar
         set soru_baslangic = soru_baslangic + (now() - hm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;

    elsif v_kopuk > 0 and hm.duraklatildi_at is not null
          and now() > hm.duraklatildi_at + interval '45 seconds' then
      update public.hizli_oyuncular ho
         set terk_at = now()
        from public.profiles pr
       where ho.hizli_mac_id = p_hizli_mac_id
         and pr.id = ho.user_id
         and ho.davet_durumu = 'kabul'
         and ho.terk_at is null
         and not coalesce(pr.is_bot, false)
         and coalesce(ho.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds';

      update public.hizli_maclar
         set soru_baslangic = soru_baslangic + (now() - hm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_hizli_mac_id;

      if (select count(*) from public.hizli_oyuncular
           where hizli_mac_id = p_hizli_mac_id
             and davet_durumu = 'kabul' and terk_at is null) <= 1 then
        perform public.advance_hizli_mac(p_hizli_mac_id);
      end if;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
      v_kopuk := 0;
      v_bekleyenler := '{}'::text[];
    end if;
  end if;

  if hm.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - hm.duraklatildi_at))::int);
  end if;

  return query select hm.durum, hm.basladi, coalesce(v_ben_hazir, false), v_hazir, v_toplam,
                      v_bekleyenler, (hm.duraklatildi_at is not null), v_duraklama,
                      hm.soru_baslangic, now();
end;
$fn$;

-- GRUP MAÇI NABZI — aynı düzeltme.
create or replace function public.grup_mac_nabiz(p_group_match_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, hazir_sayisi integer,
              toplam_oyuncu integer, bekleyenler text[], duraklatildi boolean,
              duraklama_sn integer, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  gm public.group_matches%rowtype;
  v_ben_hazir boolean;
  v_hazir int;
  v_toplam int;
  v_kopuk int;
  v_bekleyenler text[];
  v_duraklama int := 0;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid()
  ) then raise exception 'Bu maçta değilsin'; end if;

  update public.group_match_players
     set nabiz_at = now(),
         hazir = hazir or coalesce(p_hazir, false)
   where group_match_id = p_group_match_id and user_id = auth.uid();

  select count(*),
         count(*) filter (where gp.hazir or (coalesce(pr.is_bot, false)
                            and public.bot_hazir_mi(pr.id, gp.joined_at, p_group_match_id::text))),
         count(*) filter (where not coalesce(pr.is_bot, false)
                            and coalesce(gp.nabiz_at, '-infinity'::timestamptz)
                                <= now() - interval '12 seconds'),
         coalesce(array_agg(pr.gorunen_ad) filter (
           where not coalesce(pr.is_bot, false)
             and coalesce(gp.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds'
         ), '{}'::text[])
    into v_toplam, v_hazir, v_kopuk, v_bekleyenler
    from public.group_match_players gp
    join public.profiles pr on pr.id = gp.user_id
   where gp.group_match_id = p_group_match_id
     and gp.davet_durumu = 'kabul'
     and gp.terk_at is null;

  select (hazir or coalesce((select is_bot from public.profiles where id = auth.uid()), false))
    into v_ben_hazir
    from public.group_match_players
   where group_match_id = p_group_match_id and user_id = auth.uid();

  if gm.durum = 'aktif' and not gm.basladi then
    if v_toplam > 0 and v_hazir >= v_toplam and v_kopuk = 0 then
      update public.group_matches
         set basladi = true, aktif_soru = 0, soru_baslangic = now()
       where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;
    end if;

  elsif gm.durum = 'aktif' and gm.basladi then
    if v_kopuk > 0 and gm.duraklatildi_at is null then
      update public.group_matches set duraklatildi_at = now() where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;

    elsif v_kopuk = 0 and gm.duraklatildi_at is not null then
      update public.group_matches
         set soru_baslangic = soru_baslangic + (now() - gm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;

    elsif v_kopuk > 0 and gm.duraklatildi_at is not null
          and now() > gm.duraklatildi_at + interval '45 seconds' then
      update public.group_match_players gp
         set terk_at = now()
        from public.profiles pr
       where gp.group_match_id = p_group_match_id
         and pr.id = gp.user_id
         and gp.davet_durumu = 'kabul'
         and gp.terk_at is null
         and not coalesce(pr.is_bot, false)
         and coalesce(gp.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds';

      update public.group_matches
         set soru_baslangic = soru_baslangic + (now() - gm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_group_match_id;

      if (select count(*) from public.group_match_players
           where group_match_id = p_group_match_id
             and davet_durumu = 'kabul' and terk_at is null) <= 1 then
        perform public.advance_group_match(p_group_match_id);
      end if;
      select * into gm from public.group_matches where id = p_group_match_id;
      v_kopuk := 0;
      v_bekleyenler := '{}'::text[];
    end if;
  end if;

  if gm.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - gm.duraklatildi_at))::int);
  end if;

  return query select gm.durum, gm.basladi, coalesce(v_ben_hazir, false), v_hazir, v_toplam,
                      v_bekleyenler, (gm.duraklatildi_at is not null), v_duraklama,
                      gm.soru_baslangic, now();
end;
$fn$;

-- ------------------------------------------------------------
-- 3) BOTLAR YAVAŞ YAVAŞ PUAN KAZANIR
--
-- Gerçek maç sonucundan gelen doğal puan (mac_sonuclandir →
-- lig_bot_puan_yuzde) OLDUĞU GİBİ DURUYOR. Burası yalnız boşta geçen
-- zamanı dolduruyor: her botun kendine ait sabit bir "oynama temposu"
-- var; temposu geldiyse bir maç oynamış sayılır.
--
-- Zamana yayılır: tempo bot başına farklı (55 dk - 7 saat) ve son maç anı
-- bota özel bir kayma ile başlar, hepsi aynı anda sıçramaz.
-- Lig DEĞİŞTİRİLMEZ (yerleşik karar: gizli botlar lig değiştirmez);
-- yalnız puan / puan_hafta / toplam_mac artar.
-- ------------------------------------------------------------
create table if not exists public.bot_puan_temposu (
  bot_id     uuid primary key references public.profiles(id) on delete cascade,
  son_mac_at timestamptz not null default now(),
  mac_sayisi int not null default 0
);
alter table public.bot_puan_temposu enable row level security;
-- İstemci bu tabloyu GÖRMEZ: bot olduğunu ele verir. Politika yok = erişim yok.

create or replace function public.bot_puan_tik()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
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
      -- Gerçek maçtaki formülün aynısı: 20 puan, bot yüzdesiyle kırpılmış.
      v_puan := floor(20 * v_yuzde)::int;
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
$fn$;

revoke all on function public.bot_puan_tik() from public, authenticated, anon;

do $$
begin
  perform cron.unschedule('bildim-bot-puan-tik');
exception when others then
  null;   -- yoksa sorun değil
end $$;

-- 10 dakikada bir: tempo zaten bot başına saatler mertebesinde, sık
-- çalışması yalnız "anı gelmiş" olanları zamanında yakalamak için.
select cron.schedule('bildim-bot-puan-tik', '*/10 * * * *',
                     'select public.bot_puan_tik()');

-- Tablo doldurulsun ki botlar hemen tempoya girsin (puan hemen artmaz:
-- her botun anı kendi temposuna göre gelir).
select public.bot_puan_tik();
