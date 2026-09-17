-- ============================================================
-- PAKET 16 §A — Push bildirimleri alıcının dilinde (anahtar tabanlı)
--
-- Önce: metinler SQL içinde sabit Türkçe dizgeydi; İngilizce oynayan oyuncu Türkçe push alıyordu.
-- Şimdi: metin ANAHTARLA üretilir → push_metinleri(anahtar, dil, baslik, govde).
--   • Yer tutucu kalıbı dil.js › ttSunucu ile AYNI: "%" sırayla, "%2" numaralı (sırası değişen diller için).
--     Parametre `terim:<Türkçe>` satırı olarak sözlükte varsa o da çevrilir (ttSunucu da yakaladığı parçayı çevirir).
--   • Uygulama içi bildirim (bildirimler.metin) Türkçe kalır: istemci onu ttSunucu ile çeviriyor, kalıplar değişmedi.
--   • Alıcının dili profiles.dil; dil satırı yoksa 'tr'.
--   • Çok alıcılı push (turnuva hatırlatma) dile göre gruplanır: tek send-push çağrısında tek dil.
-- Ek (ölçümde bulundu): aynı olay iki kez push atılıyordu — matches daveti (notify_new_challenge + trg_mac_daveti_bildir),
--   grup daveti (notify_new_group_challenge + trg_grup_daveti_bildir), seri hatırlatma (bildirim_yaz + ayrı http_post).
--   Fazla olan yollar kaldırıldı.
-- Dokunulmayan (ölü): notify_new_hizli_davet / trg_hizli_daveti_bildir ("Hızlı Olan Kazanır" donduruldu, hizli_maclar hiç satır yok),
--   haftalik_sonuc_bildir (lig_arsiv hiç dolmadı). bildirim_yaz(uuid,text,text,text) duruyor (ölü hızlı davet onu çağırıyor).
-- ============================================================

create table if not exists public.push_metinleri (
  anahtar text not null,
  dil     text not null,
  baslik  text,
  govde   text not null,
  primary key (anahtar, dil)
);
alter table public.push_metinleri enable row level security;
revoke all on public.push_metinleri from anon, authenticated;

insert into public.push_metinleri (anahtar, dil, baslik, govde) values
  -- ---- 1v1 meydan okuma
  ('mac_daveti',  'tr', '⚔️ Meydan okuma!', '% sana meydan okudu! ⚔️'),
  ('mac_daveti',  'en', '⚔️ Challenge!', '% challenged you! ⚔️'),
  ('rovans',      'tr', '⚔️ Rövanş isteği', '% rövanş istiyor! ⚔️'),
  ('rovans',      'en', '⚔️ Rematch request', '% wants a rematch! ⚔️'),
  ('meydan_kabul','tr', '🔥 Meydan okuman kabul edildi!', '% meydan okumanı kabul etti - maç başlıyor!'),
  ('meydan_kabul','en', '🔥 Challenge accepted!', '% accepted your challenge — the match is starting!'),
  ('sira_sende',  'tr', '⏳ Sıra sende!', '% hamlesini yaptı — sıra sende! ⏳'),
  ('sira_sende',  'en', '⏳ Your turn!', '% made their move — your turn! ⏳'),
  ('mac_iptal_hukmen',  'tr', 'Quiz Tactics', '% maçı iptal etti — hükmen kazandın! 🏆'),
  ('mac_iptal_hukmen',  'en', 'Quiz Tactics', '% cancelled the match — you win by forfeit! 🏆'),
  ('mac_iptal_puansiz', 'tr', 'Quiz Tactics', '% maçı iptal etti. Kimseye puan yazılmadı.'),
  ('mac_iptal_puansiz', 'en', 'Quiz Tactics', '% cancelled the match. Nobody got any points.'),
  -- ---- grup maçı
  ('grup_daveti', 'tr', '👥 Grup maçı daveti', '% seni % kişilik grup maçına çağırdı! 👥'),
  ('grup_daveti', 'en', '👥 Group Match invite', '% invited you to a %-player Group Match! 👥'),
  -- ---- arkadaşlık
  ('arkadas_istek', 'tr', '🤝 Arkadaşlık isteği', '% sana arkadaşlık isteği gönderdi.'),
  ('arkadas_istek', 'en', '🤝 Friend request', '% sent you a friend request.'),
  ('arkadas_kabul', 'tr', '🎉 Yeni arkadaş', '% arkadaşın oldu! 🤝'),
  ('arkadas_kabul', 'en', '🎉 New friend', '% is now your friend! 🤝'),
  -- ---- lig / seri / ustalık
  ('gecildin',    'tr', '⚡ Sıran düştü', '% haftalık ligde seni geçti! Sıranı geri al. ⚡'),
  ('gecildin',    'en', '⚡ You dropped a place', '% passed you in the weekly league! Take your place back. ⚡'),
  ('lige_girdin', 'tr', '🏙️ Ligdesin', 'İlk maçını tamamladın — artık şehir, ülke ve dünya liglerindesin! 🏙️'),
  ('lige_girdin', 'en', '🏙️ You''re in the leagues', 'You finished your first match — you''re now in the city, country and world leagues! 🏙️'),
  ('hafta_sonuc_sehir', 'tr', '🏆 Hafta bitti', 'Geçen hafta % liginde %. oldun (% puan). Yeni hafta başladı!'),
  ('hafta_sonuc_sehir', 'en', '🏆 The week is over', 'Last week you finished #%2 in the %1 league (%3 points). A new week has begun!'),
  ('hafta_sonuc_dunya', 'tr', '🏆 Hafta bitti', 'Geçen hafta dünya ligindeki sıran: % (% puan). Yeni hafta başladı!'),
  ('hafta_sonuc_dunya', 'en', '🏆 The week is over', 'Your place in last week''s world league: #% (% points). A new week has begun!'),
  ('seri_artti',   'tr', '🔥 Serin', '🔥 Serin % gün oldu! Yarın da gel, bozma.'),
  ('seri_artti',   'en', '🔥 Your streak', '🔥 Your streak is now % days! Come back tomorrow to keep it going.'),
  ('seri_koruma',  'tr', '🔥 Serin', '🛡️ Seri korumanı kullandık — % günlük serin sürüyor. Bugün oynamayı unutma!'),
  ('seri_koruma',  'en', '🔥 Your streak', '🛡️ We used your streak shield — your %-day streak continues. Don''t forget to play today!'),
  ('seri_kirildi', 'tr', '🔥 Serin', '💔 % günlük serin kırıldı. Bugün yeniden başla!'),
  ('seri_kirildi', 'en', '🔥 Your streak', '💔 Your %-day streak was broken. Start again today!'),
  ('seri_tehlike', 'tr', '🔥 Serin', '🔥 % günlük serin tehlikede! Bugün bir maç yap, bozulmasın.'),
  ('seri_tehlike', 'en', '🔥 Your streak', '🔥 Your %-day streak is in danger! Play a match today to keep it.'),
  ('ustalik', 'tr', '🎖️ Ustalık', '🎖️ % kategorisinde % oldun!'),
  ('ustalik', 'en', '🎖️ Mastery', '🎖️ You became %2 in %1!'),
  -- ---- turnuva hatırlatma (cron; saatler turnuva_saatleri'ndeki 12:30 ve 22:00 seanslarıyla aynı)
  ('turnuva_ogle', 'tr', '☀️ Öğle turnuvası yaklaşıyor!', 'Turnuva 12:30''da başlıyor. Lobideki yerini al! 🏆'),
  ('turnuva_ogle', 'en', '☀️ Midday Tournament coming up!', 'The tournament starts at 12:30. Grab your spot in the lobby! 🏆'),
  ('turnuva_gece', 'tr', '🌙 Gece turnuvası yaklaşıyor!', 'Büyük turnuva 22:00''de başlıyor. Lobideki yerini al! 🏆'),
  ('turnuva_gece', 'en', '🌙 Night Tournament coming up!', 'The big tournament starts at 22:00. Grab your spot in the lobby! 🏆'),
  -- ---- parametre terimleri (dil.js ile aynı karşılıklar; özel isimler — oyuncu adı, şehir — terim değildir, çevrilmez)
  ('terim:Rakibin',    'en', null, 'Your opponent'),
  ('terim:Bir oyuncu', 'en', null, 'A player'),
  ('terim:şehrinde',   'en', null, 'your city'),
  ('terim:Genel Kültür','en', null, 'General Knowledge'),
  ('terim:Genel',      'en', null, 'General'),
  ('terim:Bilim',      'en', null, 'Science'),
  ('terim:Tarih',      'en', null, 'History'),
  ('terim:Coğrafya',   'en', null, 'Geography'),
  ('terim:Edebiyat',   'en', null, 'Literature'),
  ('terim:Spor',       'en', null, 'Sports'),
  ('terim:Sanat',      'en', null, 'Art'),
  ('terim:Sinema',     'en', null, 'Cinema'),
  ('terim:Müzik',      'en', null, 'Music'),
  ('terim:Teknoloji',  'en', null, 'Technology'),
  ('terim:Karışık',    'en', null, 'Mixed'),
  ('terim:Çırak',      'en', null, 'Apprentice'),
  ('terim:Kalfa',      'en', null, 'Journeyman'),
  ('terim:Usta',       'en', null, 'Master'),
  ('terim:Üstat',      'en', null, 'Grandmaster'),
  ('terim:Efsane',     'en', null, 'Legend')
on conflict (anahtar, dil) do update set baslik = excluded.baslik, govde = excluded.govde;

-- ------------------------------------------------------------
-- push_metni(anahtar, dil, parametre) → (baslik, govde)
-- parametre: jsonb dizi ["Ali", 5] (ya da {"1":"Ali","2":5}). "%" sırayla, "%N" N. parametre.
-- ------------------------------------------------------------
create or replace function public.push_metni(p_anahtar text, p_dil text, p_parametre jsonb default '{}'::jsonb)
returns table (baslik text, govde text)
language plpgsql stable security definer
set search_path = public
as $fn$
declare
  v_dil   text := lower(coalesce(nullif(trim(p_dil), ''), 'tr'));
  v_b     text;
  v_g     text;
  v_sonuc text := '';
  v_i     int := 1;
  v_sira  int := 0;
  v_no    int;
  v_ham   text;
  v_ceviri text;
  v_c     text;
begin
  select m.baslik, m.govde into v_b, v_g from public.push_metinleri m where m.anahtar = p_anahtar and m.dil = v_dil;
  if v_g is null then
    v_dil := 'tr';
    select m.baslik, m.govde into v_b, v_g from public.push_metinleri m where m.anahtar = p_anahtar and m.dil = 'tr';
  end if;
  if v_g is null then
    return query select 'Quiz Tactics'::text, p_anahtar;
    return;
  end if;

  while v_i <= length(v_g) loop
    v_c := substr(v_g, v_i, 1);
    if v_c = '%' then
      if substr(v_g, v_i + 1, 1) ~ '^[0-9]$' then
        v_no := substr(v_g, v_i + 1, 1)::int; v_i := v_i + 2;
      else
        v_sira := v_sira + 1; v_no := v_sira; v_i := v_i + 1;
      end if;
      v_ham := case when jsonb_typeof(p_parametre) = 'array' then p_parametre ->> (v_no - 1) else p_parametre ->> v_no::text end;
      v_ceviri := null;
      if v_ham is not null and v_dil <> 'tr' then
        select m.govde into v_ceviri from public.push_metinleri m where m.anahtar = 'terim:' || v_ham and m.dil = v_dil;
      end if;
      v_sonuc := v_sonuc || coalesce(v_ceviri, v_ham, '');
    else
      v_sonuc := v_sonuc || v_c; v_i := v_i + 1;
    end if;
  end loop;

  return query select coalesce(v_b, 'Quiz Tactics'), v_sonuc;
end;
$fn$;
revoke all on function public.push_metni(text, text, jsonb) from public, anon;
grant execute on function public.push_metni(text, text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- push_gonder: tek send-push çağrısı (tek dil). İstemciye kapalı.
-- ------------------------------------------------------------
create or replace function public.push_gonder(p_user_ids jsonb, p_baslik text, p_govde text, p_url text)
returns bigint
language plpgsql security definer
set search_path = public
as $fn$
begin
  return net.http_post(
    url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('x-cron-secret', public.gizli_al('cron_secret'), 'Content-Type', 'application/json'),
    body := jsonb_build_object('user_ids', p_user_ids, 'baslik', p_baslik, 'govde', p_govde, 'url', coalesce(p_url, '/bildim'))
  );
end;
$fn$;
revoke all on function public.push_gonder(jsonb, text, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- bildirim_anahtarla: uygulama içi bildirim (Türkçe metin — istemci ttSunucu ile çevirir) + alıcının dilinde push.
-- bildirim_yaz'ın anahtarlı karşılığı. İstemciye kapalı.
-- ------------------------------------------------------------
create or replace function public.bildirim_anahtarla(p_user uuid, p_tip text, p_anahtar text, p_parametre jsonb, p_yol text default null)
returns void
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_bot boolean;
  v_dil text;
  v_tr  record;
  v_m   record;
begin
  if p_user is null then return; end if;
  select coalesce(is_bot, false), dil into v_bot, v_dil from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return; end if;

  select * into v_tr from public.push_metni(p_anahtar, 'tr', p_parametre);
  insert into public.bildirimler (user_id, tip, metin, yol) values (p_user, p_tip, v_tr.govde, p_yol);

  if not exists (select 1 from public.push_subscriptions where user_id = p_user) then return; end if;
  select * into v_m from public.push_metni(p_anahtar, v_dil, p_parametre);
  begin
    perform public.push_gonder(jsonb_build_array(p_user), v_m.baslik, v_m.govde, coalesce(p_yol, '/bildim'));
  exception when others then
    raise notice 'bildirim_anahtarla push hatası (%): %', p_user, sqlerrm;
  end;
end;
$fn$;
revoke all on function public.bildirim_anahtarla(uuid, text, text, jsonb, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- turnuva_hatirlat: bütün abonelere, DİLE GÖRE GRUPLANMIŞ (grup başına tek send-push).
-- Önce cron doğrudan user_ids'siz Türkçe gövde yolluyordu.
-- ------------------------------------------------------------
create or replace function public.turnuva_hatirlat(p_anahtar text)
returns int
language plpgsql security definer
set search_path = public
as $fn$
declare
  r record;
  v_m record;
  v_grup int := 0;
begin
  for r in
    select case when exists (select 1 from public.push_metinleri m where m.anahtar = p_anahtar and m.dil = p.dil)
                then p.dil else 'tr' end as dil,
           jsonb_agg(distinct ps.user_id) as ids
      from public.push_subscriptions ps
      left join public.profiles p on p.id = ps.user_id
     where not coalesce(p.is_bot, false)
     group by 1
  loop
    select * into v_m from public.push_metni(p_anahtar, r.dil, '{}'::jsonb);
    begin
      perform public.push_gonder(r.ids, v_m.baslik, v_m.govde, '/turnuva');
      v_grup := v_grup + 1;
    exception when others then
      raise notice 'turnuva_hatirlat push hatası (%): %', r.dil, sqlerrm;
    end;
  end loop;
  return v_grup;
end;
$fn$;
revoke all on function public.turnuva_hatirlat(text) from public, anon, authenticated;

-- Cron: sabit Türkçe gövde yerine anahtar
do $$
declare v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'bildim-turnuva-hatirlat';
  if v_id is not null then perform cron.alter_job(v_id, command := $c$select public.turnuva_hatirlat('turnuva_gece')$c$); end if;
  select jobid into v_id from cron.job where jobname = 'bildim-turnuva-hatirlat-sabah';
  if v_id is not null then perform cron.alter_job(v_id, command := $c$select public.turnuva_hatirlat('turnuva_ogle')$c$); end if;
end $$;

-- ============================================================
-- Push gönderen fonksiyonlar: sabit Türkçe dizge → bildirim_anahtarla (canlı tanımlardan, yalnız çağrı blokları değişti)
-- ============================================================

-- public.respond_challenge(uuid,boolean)
CREATE OR REPLACE FUNCTION public.respond_challenge(p_match_id uuid, p_kabul boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_ad text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.oyuncu2 <> auth.uid() then raise exception 'Bu meydan okuma sana gelmedi'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu meydan okuma artık beklemede değil'; end if;

  if p_kabul then
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(m.kategori, 20, array[m.oyuncu1, m.oyuncu2]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = p_match_id;

    -- Meydan okuyan bunu GÖRMELİ: maç başladı, karşı taraf ekranda bekliyor.
    select gorunen_ad into v_ad from public.profiles where id = auth.uid();
    perform public.bildirim_anahtarla(
      m.oyuncu1, 'meydan_kabul', 'meydan_kabul',
      jsonb_build_array(coalesce(v_ad, 'Rakibin')),
      '/bildim/mac/' || p_match_id::text
    );
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$function$;

-- public.trg_gecilme_bildir()
CREATE OR REPLACE FUNCTION public.trg_gecilme_bildir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if new.puan_hafta <= old.puan_hafta then return new; end if;
  if coalesce(new.is_bot, false) then return new; end if;
  if coalesce(new.toplam_mac, 0) < 1 then return new; end if;

  -- Yalnız bu güncellemeyle geçilen, en yakın birkaç oyuncu
  for r in
    select p.id
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and p.id <> new.id
      and coalesce(p.toplam_mac, 0) >= 1
      and p.ulke is not distinct from new.ulke
      and p.puan_hafta > old.puan_hafta
      and p.puan_hafta <= new.puan_hafta
    order by p.puan_hafta desc
    limit 3
  loop
    if not exists (
      select 1 from public.bildirimler b
      where b.user_id = r.id and b.tip = 'gecildin'
        and b.created_at > now() - interval '1 hour'
    ) then
      perform public.bildirim_anahtarla(
      r.id, 'gecildin', 'gecildin',
      jsonb_build_array(new.gorunen_ad),
      '/bildim/siralama'
    );
    end if;
  end loop;
  return new;
end;
$function$;

-- public.haftayi_kapat()
CREATE OR REPLACE FUNCTION public.haftayi_kapat()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hafta date;
  r record;
begin
  v_hafta := (date_trunc('week', (now() at time zone 'Europe/Istanbul') - interval '1 day'))::date;

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

-- public.seri_guncelle(uuid)
CREATE OR REPLACE FUNCTION public.seri_guncelle(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    perform public.bildirim_anahtarla(
      p_user, 'seri', 'seri_artti',
      jsonb_build_array(v_yeni),
      '/bildim'
    );
  end if;
  if v_yeni >= 3 then perform public.award_badge(p_user, 'seri_3'); end if;
  if v_yeni >= 7 then perform public.award_badge(p_user, 'seri_7'); end if;
end;
$function$;

-- public.seri_kontrol()
CREATE OR REPLACE FUNCTION public.seri_kontrol()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  r record;
  v_koruma int;
begin
  for r in
    select p.id, p.seri_gun, p.seri_son_gun
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.seri_gun, 0) > 0
      and p.seri_son_gun is not null
      and p.seri_son_gun < v_bugun - 1        -- dün oynamamış
  loop
    v_koruma := coalesce(
      (select adet from public.joker_envanter
        where user_id = r.id and tur = 'seri_koruma'), 0);

    if r.seri_son_gun = v_bugun - 2 and v_koruma > 0 then
      -- Tam olarak 1 gün kaçırılmış ve koruma var → o günü kapat
      perform public.joker_hareket(r.id, 'seri_koruma', -1, 'seri', 'seri_kontrol:' || v_bugun::text);
      update public.profiles
         set seri_son_gun = v_bugun - 1,
             son_seri_tarihi = v_bugun - 1
       where id = r.id;
      perform public.bildirim_anahtarla(
      r.id, 'seri', 'seri_koruma',
      jsonb_build_array(r.seri_gun),
      '/bildim'
    );
    else
      update public.profiles
         set seri_gun = 0, seri = 0
       where id = r.id;
      perform public.bildirim_anahtarla(
      r.id, 'seri', 'seri_kirildi',
      jsonb_build_array(r.seri_gun),
      '/bildim'
    );
    end if;
  end loop;
end;
$function$;

-- public.seri_hatirlat()
CREATE OR REPLACE FUNCTION public.seri_hatirlat()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  r record;
begin
  for r in
    select p.id, p.seri_gun
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.seri_gun, 0) > 0
      and (p.seri_son_gun is null or p.seri_son_gun < v_bugun)   -- bugün oynamadı
  loop
    perform public.bildirim_anahtarla(
      r.id, 'seri', 'seri_tehlike',
      jsonb_build_array(r.seri_gun),
      '/bildim'
    );

    -- (Paket 16) Ayrı push kaldırıldı: bildirim_anahtarla zaten push atıyor; aynı olay iki kez gidiyordu.
  end loop;
end;
$function$;

-- public.trg_mac_daveti_bildir()
CREATE OR REPLACE FUNCTION public.trg_mac_daveti_bildir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ad text;
begin
  -- Yalnız davet aşamasındaki (henüz başlamamış) maçlar
  if new.durum is distinct from 'bekliyor' then return new; end if;
  if new.oyuncu2 is null or new.oyuncu2 = new.oyuncu1 then return new; end if;
  -- Bota bildirim gitmez
  if exists (select 1 from public.profiles where id = new.oyuncu2 and coalesce(is_bot, false)) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = new.oyuncu1;

  perform public.bildirim_anahtarla(
      new.oyuncu2, case when new.rovans then 'rovans' else 'mac_daveti' end, case when new.rovans then 'rovans' else 'mac_daveti' end,
      jsonb_build_array(coalesce(v_ad, 'Bir oyuncu')),
      '/bildim/meydan'
    );
  return new;
end;
$function$;

-- public.trg_grup_daveti_bildir()
CREATE OR REPLACE FUNCTION public.trg_grup_daveti_bildir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kurucu uuid;
  v_ad text;
  v_kisi int;
begin
  if new.davet_durumu is distinct from 'bekliyor' then return new; end if;

  select g.kurucu, g.oyuncu_sayisi into v_kurucu, v_kisi
  from public.group_matches g where g.id = new.group_match_id;

  if v_kurucu is null or v_kurucu = new.user_id then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and coalesce(is_bot, false)) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_kurucu;

  perform public.bildirim_anahtarla(
      new.user_id, 'grup_daveti', 'grup_daveti',
      jsonb_build_array(coalesce(v_ad, 'Bir oyuncu'), coalesce(v_kisi, 3)),
      '/bildim/meydan'
    );
  return new;
end;
$function$;

-- public.kategori_dogru_arttir(uuid,text)
CREATE OR REPLACE FUNCTION public.kategori_dogru_arttir(p_user uuid, p_kategori text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_yeni int;
  v_onceki text;
  v_simdi text;
begin
  if p_user is null or p_kategori is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  insert into public.kategori_dogru (user_id, kategori, dogru_sayisi)
  values (p_user, p_kategori, 1)
  on conflict (user_id, kategori) do update
    set dogru_sayisi = public.kategori_dogru.dogru_sayisi + 1
  returning dogru_sayisi into v_yeni;

  v_onceki := public.ustalik_seviye(v_yeni - 1);
  v_simdi := public.ustalik_seviye(v_yeni);

  if v_simdi is not null and v_simdi is distinct from v_onceki then
    perform public.bildirim_anahtarla(
      p_user, 'ustalik', 'ustalik',
      jsonb_build_array(public.kategori_adi(p_kategori), v_simdi),
      '/bildim/profil'
    );
    perform public.award_badge(
      p_user,
      case v_simdi
        when 'Çırak' then 'ustalik_cirak'
        when 'Kalfa' then 'ustalik_kalfa'
        when 'Usta' then 'ustalik_usta'
        when 'Üstat' then 'ustalik_ustat'
        else 'ustalik_efsane'
      end
    );
  end if;
end;
$function$;

-- public.arkadas_davet_kodu_ile_ekle(text)
CREATE OR REPLACE FUNCTION public.arkadas_davet_kodu_ile_ekle(p_kod text)
 RETURNS TABLE(durum text, gorunen_ad text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_hedef public.profiles%rowtype;
  v_kod text;
  v_ters uuid;
  v_mevcut text;
  v_ben_ad text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_kod := upper(btrim(coalesce(p_kod, '')));
  if length(v_kod) <> 8 then raise exception 'Davet kodu 8 karakter olmalı.'; end if;

  select * into v_hedef from public.profiles p where p.davet_kodu = v_kod;
  if not found then raise exception 'Böyle bir davet kodu yok.'; end if;
  if v_hedef.id = auth.uid() then raise exception 'Kendi davet kodunu kullanamazsın.'; end if;
  if coalesce(v_hedef.is_bot, false) then raise exception 'Bu kod kullanılamaz.'; end if;

  -- Kendi görünen adımızı bir kez, NİTELİKLİ olarak alalım
  select me.gorunen_ad into v_ben_ad
    from public.profiles me where me.id = auth.uid();

  select f.durum into v_mevcut from public.friendships f
  where (f.requester = auth.uid() and f.addressee = v_hedef.id)
     or (f.requester = v_hedef.id and f.addressee = auth.uid());

  if v_mevcut = 'arkadas' then
    return query select 'zaten_arkadas'::text, v_hedef.gorunen_ad;
    return;
  end if;

  -- Karşı taraf zaten istek gönderdiyse doğrudan arkadaş ol
  select f.id into v_ters from public.friendships f
  where f.requester = v_hedef.id and f.addressee = auth.uid();
  if found then
    update public.friendships f set durum = 'arkadas' where f.id = v_ters;
    perform public.bildirim_anahtarla(
      v_hedef.id, 'arkadas_kabul', 'arkadas_kabul',
      jsonb_build_array(coalesce(v_ben_ad, 'Bir oyuncu')),
      '/bildim/arkadaslar'
    );
    return query select 'arkadas_oldu'::text, v_hedef.gorunen_ad;
    return;
  end if;

  insert into public.friendships (requester, addressee)
  values (auth.uid(), v_hedef.id)
  on conflict (requester, addressee) do nothing;

  perform public.bildirim_anahtarla(
      v_hedef.id, 'arkadas_istek', 'arkadas_istek',
      jsonb_build_array(coalesce(v_ben_ad, 'Bir oyuncu')),
      '/bildim/arkadaslar'
    );

  return query select 'istek_gonderildi'::text, v_hedef.gorunen_ad;
end;
$function$;

-- public.mac_iptal(uuid)
CREATE OR REPLACE FUNCTION public.mac_iptal(p_match_id uuid)
 RETURNS TABLE(sonuc text, kazanan uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_rakip uuid;
  v_rakip_bot boolean;
  v_cevap_sayisi int;
  v_ad text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  -- Kullanıcı tetikli uç: hız sınırı (bkz. migration 115)
  perform public.hiz_siniri('mac_iptal', 20, interval '60 seconds');

  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if v_me not in (m.oyuncu1, m.oyuncu2) then
    raise exception 'Bu maçta değilsin';
  end if;
  if m.durum in ('bitti', 'iptal', 'reddedildi') then
    raise exception 'Bu maç zaten kapanmış';
  end if;

  v_rakip := case when m.oyuncu1 = v_me then m.oyuncu2 else m.oyuncu1 end;
  select coalesce(is_bot, false) into v_rakip_bot from public.profiles where id = v_rakip;

  -- Gelen daveti reddetmek bu RPC'nin işi değil; mevcut reddetme akışı var.
  if m.durum = 'bekliyor' and m.oyuncu2 = v_me then
    raise exception 'Gelen daveti reddetme akışını kullan';
  end if;

  select count(*) into v_cevap_sayisi
    from public.match_answers where match_id = p_match_id;

  -- HÜKMEN MAĞLUBİYET yalnız: aktif maç + gerçek rakip + en az bir cevap
  if m.durum = 'aktif'
     and not coalesce(v_rakip_bot, false)
     and v_cevap_sayisi > 0
  then
    perform public.mac_sonuclandir(p_match_id, v_rakip, v_me);

    select gorunen_ad into v_ad from public.profiles where id = v_me;
    perform public.bildirim_anahtarla(
      v_rakip, 'mac_bitti', 'mac_iptal_hukmen',
      jsonb_build_array(coalesce(v_ad, 'Rakibin')),
      '/bildim/mac/' || p_match_id::text
    );

    return query select 'hukmen'::text, v_rakip;
    return;
  end if;

  -- Sade iptal: puan yok, mağlubiyet yazılmaz
  update public.matches
     set durum = 'iptal', kazanan = null, bitis = now()
   where id = p_match_id;

  if not coalesce(v_rakip_bot, false) then
    select gorunen_ad into v_ad from public.profiles where id = v_me;
    perform public.bildirim_anahtarla(
      v_rakip, 'mac_bitti', 'mac_iptal_puansiz',
      jsonb_build_array(coalesce(v_ad, 'Rakibin')),
      '/bildim/meydan'
    );
  end if;

  return query select 'iptal'::text, null::uuid;
end;
$function$;

-- public.trg_mac_sira_bildir()
CREATE OR REPLACE FUNCTION public.trg_mac_sira_bildir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bekleyen uuid;
  v_ilerleyen uuid;
  v_ad text;
  v_toplam int;
  v_bot boolean;
begin
  if new.durum <> 'aktif' then return new; end if;
  v_toplam := coalesce(array_length(new.soru_ids, 1), 0);
  if v_toplam = 0 then return new; end if;

  -- Kim ilerledi, kim geride kaldı?
  if new.oyuncu1_soru > old.oyuncu1_soru and new.oyuncu2_soru < v_toplam
     and new.oyuncu1_soru > new.oyuncu2_soru then
    v_ilerleyen := new.oyuncu1; v_bekleyen := new.oyuncu2;
  elsif new.oyuncu2_soru > old.oyuncu2_soru and new.oyuncu1_soru < v_toplam
     and new.oyuncu2_soru > new.oyuncu1_soru then
    v_ilerleyen := new.oyuncu2; v_bekleyen := new.oyuncu1;
  else
    return new;
  end if;

  -- BOT ilerlemesi bildirim üretmez: bot her an hazır, "sıra sende" demenin
  -- bilgi değeri yok; üstelik her soruda tetiklenip paneli dolduruyordu.
  select coalesce(is_bot, false) into v_bot from public.profiles where id = v_ilerleyen;
  if coalesce(v_bot, false) then return new; end if;

  -- Saatte bir defadan fazla rahatsız etme
  if exists (
    select 1 from public.bildirimler b
    where b.user_id = v_bekleyen and b.tip = 'sira_sende'
      and b.yol = '/bildim/mac/' || new.id::text
      and b.created_at > now() - interval '1 hour'
  ) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_ilerleyen;

  perform public.bildirim_anahtarla(
      v_bekleyen, 'sira_sende', 'sira_sende',
      jsonb_build_array(coalesce(v_ad, 'Rakibin')),
      '/bildim/mac/' || new.id::text
    );
  return new;
end;
$function$;

-- public.mac_sayaci_arttir(uuid,boolean)
CREATE OR REPLACE FUNCTION public.mac_sayaci_arttir(p_user uuid, p_seri boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_yeni int;
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  update public.profiles
     set toplam_mac = toplam_mac + 1
   where id = p_user
  returning toplam_mac into v_yeni;

  if v_yeni = 1 then
    perform public.bildirim_anahtarla(
      p_user, 'lige_girdin', 'lige_girdin',
      '[]'::jsonb,
      '/bildim/siralama'
    );
  end if;

  -- Günlük seri (Europe/Istanbul) — ödüllü modlarda
  if coalesce(p_seri, true) then
    perform public.seri_guncelle(p_user);
  end if;
end;
$function$;

-- public.notify_new_challenge()
CREATE OR REPLACE FUNCTION public.notify_new_challenge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gonderen text;
begin
  -- (Paket 16) Push kaldırıldı: trg_mac_daveti_bildir → bildirim_anahtarla aynı daveti zaten alıcının dilinde gönderiyor;
  -- ikisi birlikte aynı meydan okumayı iki kez push'luyordu. Tetikleyici yerinde kalır, işlevsiz.
  return new;
end;
$function$;

-- public.notify_new_group_challenge()
CREATE OR REPLACE FUNCTION public.notify_new_group_challenge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gonderen text;
begin
  -- (Paket 16) Push kaldırıldı: trg_grup_daveti_bildir → bildirim_anahtarla aynı daveti zaten gönderiyor (çift push).
  return new;
end;
$function$;

