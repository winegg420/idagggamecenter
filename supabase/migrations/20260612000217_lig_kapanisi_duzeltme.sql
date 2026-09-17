-- ============================================================
-- PAKET 18 §A — Lig kapanışı: dört düzeltme (sahibi onayladı)
--
-- A.1 Pasif sayacı haftadan haftaya TAŞINIR (lig_gruplarini_kur önceki haftanın pasif_hafta'sını yazar). Eskiden yeni
--     satır 0 başlıyordu → "üst üste 2 hafta pasif düşer" hiç tetiklenmiyordu. Aktif hafta sayacı sıfırlar (zaten öyleydi);
--     düşen oyuncunun sayacı da sıfırlanır (pasiflik sürerse her 2 haftada bir düşer, her hafta değil).
-- A.2 Aktiflik BÜTÜN modları sayar: lig_aktif_mac_sayisi(user, hafta). Eskiden yalnız matches → Düello oynayan "pasif"
--     görünüp yükselemiyordu. A.1 ile birlikte: tek başına A.1, Düello oyuncularını iki hafta sonra düşürürdü.
-- A.3 Kapanış ile puan_hafta sıfırlaması TEK işlemde: haftalik_kapanis(), Pazartesi 00:00 TSİ (Pazar 21:00 UTC).
--     Eskiden lig 20:45 UTC'de kapanıyor, sıfırlama 21:00'de → aradaki 15 dk'nın puanı hiçbir haftaya sayılmıyordu.
--     Kapanış profiles satırlarını FOR UPDATE kilitler: sınırda gelen puan ya kilitten ÖNCE işlenir (kapanan haftaya
--     sayılır, sıfırlamayla silinmez çünkü sıralamada zaten kullanıldı) ya da kilidi bekleyip SONRA yazılır (yeni haftaya).
--     Tekrar-güvenlik tek damga: oyun_ayarlari.hafta_son_kapanis. (Eskiden haftayi_kapat lig_arsiv boşsa 22:00'de yeniden
--     çalışıp yeni haftanın ilk saatinin puanını da sıfırlayabiliyordu.)
-- A.4 puan_hafta = 0 olan oyuncu yükselmez (sıralama o durumda ada göre kalıyordu). Düşme kuralı aynı.
-- ============================================================

-- ------------------------------------------------------------
-- A.2 — haftalık aktiflik: [hafta başı TSİ, +7 gün) içinde BİTEN oyun sayısı
--   matches            : durum='bitti', oyuncu1/oyuncu2, bitis            (Normal Maç / 1v1)
--   duellolar          : durum='bitti', oyuncu1/oyuncu2, bitis            (Düello)
--   hizli_mod_oturumlar: durum='bitti', user_id, bitis                    (Hızlı Mod)
--   group_matches      : durum='bitti' + group_match_players kabul eden, bitis   (Grup Maçı)
--   tournaments        : durum='bitti' + tournament_players, bitis        (Turnuva)
--   İptal / reddedilen / yarım kalan sayılmaz. "Hızlı Olan Kazanır" (hizli_maclar) donduruldu, sayılmaz.
-- ------------------------------------------------------------
create or replace function public.lig_aktif_mac_sayisi(p_user uuid, p_hafta date)
returns integer
language sql stable security definer
set search_path = public
as $fn$
  with sinir as (
    select (p_hafta::timestamp at time zone 'Europe/Istanbul') as bas,
           ((p_hafta + 7)::timestamp at time zone 'Europe/Istanbul') as son
  )
  select (
    (select count(*) from public.matches m, sinir s
      where m.durum = 'bitti' and p_user in (m.oyuncu1, m.oyuncu2) and coalesce(m.bitis, m.created_at) >= s.bas and coalesce(m.bitis, m.created_at) < s.son)
  + (select count(*) from public.duellolar d, sinir s
      where d.durum = 'bitti' and p_user in (d.oyuncu1, d.oyuncu2) and d.bitis >= s.bas and d.bitis < s.son)
  + (select count(*) from public.hizli_mod_oturumlar h, sinir s
      where h.durum = 'bitti' and h.user_id = p_user and h.bitis >= s.bas and h.bitis < s.son)
  + (select count(*) from public.group_matches g join public.group_match_players gp on gp.group_match_id = g.id, sinir s
      where g.durum = 'bitti' and gp.user_id = p_user and gp.davet_durumu = 'kabul' and g.bitis >= s.bas and g.bitis < s.son)
  + (select count(*) from public.tournaments t join public.tournament_players tp on tp.tournament_id = t.id, sinir s
      where t.durum = 'bitti' and tp.user_id = p_user and t.bitis >= s.bas and t.bitis < s.son)
  )::int;
$fn$;
revoke all on function public.lig_aktif_mac_sayisi(uuid, date) from public, anon, authenticated;

-- Eski argümansız imzalar kalkar (tarihli yeni imzalar varsayılanlı; ikisi birden olursa çağrı belirsiz olur).
drop function if exists public.lig_haftayi_kapat();
drop function if exists public.haftayi_kapat();

-- lig_haftayi_kapat(date)
CREATE OR REPLACE FUNCTION public.lig_haftayi_kapat(p_hafta date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hafta date := coalesce(p_hafta, public.hafta_basi());   -- 217: haftalik_kapanis kapanan haftayı açıkça verir (Pazartesi 00:00'dan sonra çalışır)
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

  -- Haftalık maç sayısı: pasiflik buna bakar. 217: BÜTÜN modlar (Normal Maç · Düello · Hızlı Mod · Grup · Turnuva),
  -- hafta sınırı TSİ (eskiden yalnız matches ve UTC gece yarısı).
  update public.lig_uyelik u
     set mac_sayisi = public.lig_aktif_mac_sayisi(u.user_id, v_hafta)
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
        -- 217: düşünce sayaç sıfırlanır → pasiflik sürerse her v_pasif_esik haftada bir düşer (her hafta değil)
        update public.lig_uyelik set pasif_hafta = 0 where user_id = r.user_id and hafta = v_hafta;
      end if;
      continue;
    end if;

    if r.sira <= v_yuk and coalesce(r.puan_hafta, 0) > 0 then   -- 217: 0 puanla yükselme yok (sıra ada göre kalıyordu)
      if r.lig = 'efsane' then
        perform public.award_badge(r.user_id, 'efsane_zirve');   -- üstü yok
      else
        update public.profiles
           set lig = public.lig_adi(least(5, public.lig_sirasi(r.lig) + 1))
         where id = r.user_id;
        -- 213: lig atlayınca o ligin KALICI çerçevesi (düşse de kalır)
        perform public.lig_cerceve_ver(r.user_id, public.lig_adi(least(5, public.lig_sirasi(r.lig) + 1)), 'lig_yukselme');
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
$function$;

-- lig_gruplarini_kur(date)
CREATE OR REPLACE FUNCTION public.lig_gruplarini_kur(p_hafta date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
       and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli);

    -- Görünür gerçek oyuncu yoksa grup açma: bot dolu tablo kimseye bir şey anlatmaz.
    if v_gercek = 0 then continue; end if;

    v_grup_boyu := case when v_gercek < v_esik then v_kucuk else v_boyu end;
    v_grup_sayisi := greatest(1, ceil(v_gercek::numeric / v_grup_boyu)::int);
    v_bot_sinir := least(v_bot_tavan, floor((v_grup_boyu - 1) / 2.0)::int);

    -- Görünür gerçek oyuncular gruplara sırayla (karışık) dağıtılır
    v_i := 0;
    for r in
      select p.id from public.profiles p
       where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
         and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
       order by random()
    loop
      -- 217: pasif sayacı önceki haftanın (kapanışta güncellenmiş) değerinden TAŞINIR; yoksa 0
      insert into public.lig_uyelik (user_id, hafta, lig, grup_no, pasif_hafta)
      values (r.id, v_hafta, v_lig, (v_i % v_grup_sayisi) + 1,
              coalesce((select o.pasif_hafta from public.lig_uyelik o where o.user_id = r.id and o.hafta = v_hafta - 7), 0))
      on conflict (user_id, hafta) do update
        set lig = excluded.lig, grup_no = excluded.grup_no, pasif_hafta = excluded.pasif_hafta;
      v_i := v_i + 1;
      v_toplam := v_toplam + 1;
    end loop;

    -- Kurulumu bitmemiş / gizli hesaplar: üyelik yazılır, yer kaplamaz.
    for r in
      select p.id from public.profiles p
       where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
         and not public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
    loop
      insert into public.lig_uyelik (user_id, hafta, lig, grup_no, pasif_hafta)
      values (r.id, v_hafta, v_lig, 1,
              coalesce((select o.pasif_hafta from public.lig_uyelik o where o.user_id = r.id and o.hafta = v_hafta - 7), 0))
      on conflict (user_id, hafta) do nothing;
    end loop;

    -- Boşlukları GİZLİ bot doldurur; doluluk yalnız görünür üyelerle sayılır.
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
                                       join public.profiles q on q.id = u.user_id
                                       where u.hafta = v_hafta and u.lig = v_lig
                                         and u.grup_no = v_i
                                         and public.lig_gorunur_mu(q.is_bot, q.takma_ad_secildi, q.avatar_onayli, q.lig_gizli))))
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
$function$;

-- haftayi_kapat(date)
CREATE OR REPLACE FUNCTION public.haftayi_kapat(p_hafta date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hafta date;
  r record;
begin
  v_hafta := coalesce(p_hafta, (date_trunc('week', (now() at time zone 'Europe/Istanbul') - interval '1 day'))::date);

  if exists (select 1 from public.lig_arsiv where hafta = v_hafta) then
    return;
  end if;

  insert into public.lig_arsiv (user_id, hafta, puan, sehir, ulke, sira_sehir, sira_ulke, sira_global)
  select p.id, v_hafta, p.puan_hafta, p.sehir, p.ulke,
         case when p.sehir is not null and p.ulke is not null
              then rank() over (partition by p.ulke, p.sehir order by p.puan_hafta desc) end,
         case when p.ulke is not null
              then rank() over (partition by p.ulke order by p.puan_hafta desc) end,
         rank() over (order by p.puan_hafta desc)
  from public.profiles p
  where coalesce(p.is_bot, false) = false
    and coalesce(p.toplam_mac, 0) >= 1
    and p.puan_hafta > 0
  on conflict (user_id, hafta) do nothing;

  for r in
    select a.user_id, a.sira_global
    from public.lig_arsiv a
    where a.hafta = v_hafta and a.sira_global <= 3
  loop
    perform public.award_badge(
      r.user_id,
      case r.sira_global when 1 then 'hafta_1' when 2 then 'hafta_2' else 'hafta_3' end
    );
  end loop;

  for r in
    select a.user_id from public.lig_arsiv a
    where a.hafta = v_hafta and a.sira_sehir = 1
  loop
    perform public.award_badge(r.user_id, 'sehir_krali');
  end loop;

  -- Uygulama içi haftalık sonuç bildirimi (push'tan bağımsız, herkese)
  for r in
    select a.user_id, a.sira_sehir, a.sira_global, a.sehir, a.puan
    from public.lig_arsiv a
    where a.hafta = v_hafta
  loop
    perform public.bildirim_anahtarla(
      r.user_id, 'hafta_sonuc', case when r.sira_sehir is not null then 'hafta_sonuc_sehir' else 'hafta_sonuc_dunya' end,
      case when r.sira_sehir is not null
        then jsonb_build_array(coalesce(r.sehir, 'şehrinde'), r.sira_sehir, r.puan)
        else jsonb_build_array(r.sira_global, r.puan) end,
      '/bildim/siralama'
    );
  end loop;

  update public.profiles set puan_hafta = 0 where puan_hafta <> 0;
end;
$function$;

-- ------------------------------------------------------------
-- A.3 — tek haftalık kapanış
-- ------------------------------------------------------------
create or replace function public.haftalik_kapanis()
returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  -- Pazartesi 00:00–06:00 TSİ penceresinde "şimdi − 1 gün" kapanan haftanın içindedir.
  v_hafta date := (date_trunc('week', (now() at time zone 'Europe/Istanbul') - interval '1 day'))::date;
  v_lig int;
begin
  perform pg_advisory_xact_lock(hashtext('haftalik_kapanis'));
  if (select deger #>> '{}' from public.oyun_ayarlari where anahtar = 'hafta_son_kapanis') = v_hafta::text then
    return jsonb_build_object('hafta', v_hafta, 'durum', 'zaten_kapandi');
  end if;

  -- Sınırda puan yazan işlemler bu kilidi bekler → kapanıştan SONRA yeni haftaya yazılır.
  perform 1 from public.profiles for update;

  v_lig := public.lig_haftayi_kapat(v_hafta);   -- sıralama + ödül + yükselme/düşme + yeni gruplar (puan_hafta henüz sıfırlanmadı)
  perform public.haftayi_kapat(v_hafta);        -- şehir/dünya arşivi + rozetler + puan_hafta = 0

  insert into public.oyun_ayarlari (anahtar, deger) values ('hafta_son_kapanis', to_jsonb(v_hafta::text))
  on conflict (anahtar) do update set deger = excluded.deger;
  return jsonb_build_object('hafta', v_hafta, 'durum', 'kapandi', 'lig_islenen', v_lig);
end;
$fn$;
revoke all on function public.haftalik_kapanis() from public, anon, authenticated;

-- Damga: son kapanan hafta (7 Eylül). Bir sonraki kapanış 14 Eylül haftası.
insert into public.oyun_ayarlari (anahtar, deger) values ('hafta_son_kapanis', to_jsonb('2026-09-07'::text))
on conflict (anahtar) do nothing;

-- Cron: 20:45'teki ayrı lig kapanışı kalkar; Pazar 21–23 UTC + Pazartesi 00–03 UTC penceresi tek kapanışı çağırır.
do $$
declare v_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'bildim-lig-kapat') then perform cron.unschedule('bildim-lig-kapat'); end if;
  select jobid into v_id from cron.job where jobname = 'bildim-hafta-kapat';
  if v_id is not null then perform cron.alter_job(v_id, command := 'select public.haftalik_kapanis()'); end if;
  select jobid into v_id from cron.job where jobname = 'bildim-hafta-kapat-pzt';
  if v_id is not null then perform cron.alter_job(v_id, command := 'select public.haftalik_kapanis()'); end if;
end $$;
