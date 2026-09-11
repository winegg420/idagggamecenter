-- ============================================================
-- SENKRON MAÇ + MEYDAN OKUMA KABUL BİLDİRİMİ
--
-- 1) MEYDAN OKUMA KABUL EDİLİNCE MEYDAN OKUYANA HABER VERİLMİYORDU.
--    Rakip kabul edip maça giriyor, meydan okuyanın haberi olmuyor ve maçı
--    ana sayfada arayıp bulamıyordu. Artık bildirim (uygulama içi + telefon)
--    yazılıyor ve `kabul_at` damgası ana sayfada en üste taşınıyor.
--
-- 2) MAÇLAR ARTIK EŞ ZAMANLI.
--    Eski akış asenkrondu: her oyuncu kendi `oyuncuN_soru` indeksinde, kendi
--    saatinde oynuyordu. Rakip önce girip 20 soruyu bitirebiliyordu. İstenen:
--    iki oyuncu AYNI ANDA aynı soruyu görsün, soru ikisi için AYNI ANDA geçsin,
--    kimse öne geçemesin.
--
--    Kurgu:
--      - `basladi` kapısı: maç, İKİ TARAF DA ekranda olana kadar başlamaz
--        (`mac_hazir` nabzı; bot her zaman hazır sayılır).
--      - Ortak indeks `aktif_soru` ve ortak saat `soru_baslangic`.
--      - Soru, İKİSİ DE cevaplayınca ya da 16 sn dolunca geçer (advance_match).
--      - Puan ortak saate göre hesaplanır - hız avantajı adil.
--
--    Devam eden ESKİ maçlar `senkron = false` ile eski kurallarıyla biter;
--    yarım kalmış maç kimsenin elinde patlamaz.
-- ============================================================

alter table public.matches
  add column if not exists senkron boolean not null default true,
  add column if not exists basladi boolean not null default false,
  add column if not exists kabul_at timestamptz,
  add column if not exists oyuncu1_hazir_at timestamptz,
  add column if not exists oyuncu2_hazir_at timestamptz;

-- Şu an oynanan/bekleyen maçlar eski (asenkron) kurallarla bitsin.
update public.matches
   set senkron = false
 where durum in ('aktif', 'bekliyor');

-- Ana sayfada "en yeni kabul edilen meydan okuma" sorgusu bu indeksi kullanır.
create index if not exists idx_matches_kabul_at
  on public.matches (kabul_at desc)
  where kabul_at is not null;

-- ------------------------------------------------------------
-- HAZIR NABZI - maçı iki taraf da ekrandayken başlatır
-- ------------------------------------------------------------
create or replace function public.mac_hazir(p_match_id uuid)
returns table(basladi boolean, rakip_hazir boolean, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_rakip uuid;
  v_rakip_bot boolean;
  v_rakip_hazir boolean;
  v_basladi boolean;
  v_bas timestamptz;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;

  -- Eski (asenkron) maç: kapı yok, herkes kendi hızında.
  if not coalesce(m.senkron, false) then
    return query select true, true, m.soru_baslangic, now();
    return;
  end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_rakip := case when v_ben_p1 then m.oyuncu2 else m.oyuncu1 end;

  -- Kendi nabzımı at
  if v_ben_p1 then
    update public.matches set oyuncu1_hazir_at = now() where id = p_match_id;
  else
    update public.matches set oyuncu2_hazir_at = now() where id = p_match_id;
  end if;

  select coalesce(is_bot, false) into v_rakip_bot from public.profiles where id = v_rakip;
  -- Bot her zaman hazır. İnsan rakip son 12 sn içinde nabız attıysa hazır.
  v_rakip_hazir := coalesce(v_rakip_bot, false) or
    coalesce(case when v_ben_p1 then m.oyuncu2_hazir_at else m.oyuncu1_hazir_at end,
             '-infinity'::timestamptz) > now() - interval '12 seconds';

  v_basladi := m.basladi;
  v_bas := m.soru_baslangic;

  -- İkisi de ekranda: saati şimdi başlat, ilk sorudan.
  if m.durum = 'aktif' and not m.basladi and v_rakip_hazir then
    v_basladi := true;
    v_bas := now();
    update public.matches
       set basladi = true,
           aktif_soru = 0,
           soru_baslangic = v_bas,
           oyuncu1_soru = 0,
           oyuncu2_soru = 0,
           oyuncu1_baslangic = null,
           oyuncu2_baslangic = null
     where id = p_match_id;
  end if;

  return query select v_basladi, v_rakip_hazir, v_bas, now();
end;
$fn$;

grant execute on function public.mac_hazir(uuid) to authenticated;

-- ------------------------------------------------------------
-- MEYDAN OKUMA CEVABI - kabul edilince MEYDAN OKUYANA haber ver
-- ------------------------------------------------------------
create or replace function public.respond_challenge(p_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
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
    perform public.bildirim_yaz(
      m.oyuncu1,
      'meydan_kabul',
      coalesce(v_ad, 'Rakibin') || ' meydan okumanı kabul etti - maç başlıyor!',
      '/bildim/mac/' || p_match_id::text
    );
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$fn$;

-- Bildirim başlığına yeni tip eklenir (telefon bildirimi için).
create or replace function public.bildirim_yaz(p_user uuid, p_tip text, p_metin text, p_yol text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bot boolean;
  v_baslik text;
begin
  if p_user is null then return; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return; end if;

  insert into public.bildirimler (user_id, tip, metin, yol)
  values (p_user, p_tip, p_metin, p_yol);

  v_baslik := case p_tip
    when 'mac_daveti'      then '⚔️ Meydan okuma!'
    when 'meydan_kabul'    then '🔥 Meydan okuman kabul edildi!'
    when 'rovans'          then '⚔️ Rövanş isteği'
    when 'grup_daveti'     then '👥 Grup maçı daveti'
    when 'hizli_daveti'    then '⚡ Hızlı maç daveti'
    when 'sira_sende'      then '⏳ Sıra sende!'
    when 'arkadas_istek'   then '🤝 Arkadaşlık isteği'
    when 'arkadas_kabul'   then '🎉 Yeni arkadaş'
    when 'gecildin'        then '⚡ Sıran düştü'
    when 'hafta_sonuc'     then '🏆 Hafta bitti'
    when 'ustalik'         then '🎖️ Ustalık'
    when 'seri'            then '🔥 Serin'
    when 'lige_girdin'     then '🏙️ Ligdesin'
    else 'Quizador'
  end;

  begin
    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', public.gizli_al('cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(p_user),
        'baslik', v_baslik,
        'govde', p_metin,
        'url', coalesce(p_yol, '/bildim')
      )
    );
  exception when others then
    null;
  end;
end;
$fn$;

-- ------------------------------------------------------------
-- SORUYU GETİR - senkronda ORTAK indeks ve ORTAK saat
-- ------------------------------------------------------------
create or replace function public.get_match_question(p_match_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());

  if coalesce(m.senkron, false) then
    -- SENKRON: iki oyuncu da aynı soruda, aynı saatte.
    if not m.basladi or m.soru_baslangic is null then
      raise exception 'Maç henüz başlamadı';
    end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    -- ESKİ (asenkron) maç: kendi indeksi, kendi saati.
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
    if v_bas is null then
      v_bas := now();
      if v_ben_p1 then
        update public.matches set oyuncu1_baslangic = v_bas where id = p_match_id;
      else
        update public.matches set oyuncu2_baslangic = v_bas where id = p_match_id;
      end if;
    end if;
  end if;

  if v_index >= coalesce(array_length(m.soru_ids, 1), 0) then
    raise exception 'Bu maçta senin sıran bitti';
  end if;

  perform public.gorulen_kaydet(m.soru_ids[v_index + 1]);

  return query
    select q.id, q.soru, q.secenekler, v_index, v_bas, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = m.soru_ids[v_index + 1];
end;
$fn$;

-- ------------------------------------------------------------
-- CEVAP GÖNDER - senkronda sırayı KENDİ BAŞINA ilerletmez
-- ------------------------------------------------------------
create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_senkron boolean;
begin
  perform public.hiz_siniri('submit_match_answer', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi or m.soru_baslangic is null then raise exception 'Maç henüz başlamadı'; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := coalesce(case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end, now());
  end if;

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;
  -- 1 sn ağ payı
  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  -- Senkronda aynı soruya ikinci kez cevap gönderilemez (çift puan olmasın).
  if exists (
    select 1 from public.match_answers a
    where a.match_id = p_match_id and a.user_id = auth.uid() and a.soru_index = v_index
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  select * into q from public.questions where id = m.soru_ids[v_index + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
  else
    v_puan := 0;
  end if;

  -- SENKRON: ortak indeks (aktif_soru) BURADA ilerletilmez; advance_match
  -- iki taraf da cevaplayınca ya da süre dolunca ilerletir. `oyuncuN_soru`
  -- yalnız "bu soruyu cevapladım" göstergesi olarak ilerler.
  if v_ben_p1 then
    update public.matches
       set oyuncu1_skor = oyuncu1_skor + v_puan,
           oyuncu1_soru = v_index + 1,
           oyuncu1_baslangic = case when v_senkron then oyuncu1_baslangic else null end,
           oyuncu1_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_skor = oyuncu2_skor + v_puan,
           oyuncu2_soru = v_index + 1,
           oyuncu2_baslangic = case when v_senkron then oyuncu2_baslangic else null end,
           oyuncu2_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  end if;

  perform public.advance_match(p_match_id);

  return query select v_dogru, q.dogru_cevap;
end;
$fn$;

-- ------------------------------------------------------------
-- SORUYU ATLA (süre doldu) - senkronda ortak indeks
-- ------------------------------------------------------------
create or replace function public.mac_soruyu_atla(p_match_id uuid)
returns table(dogru_cevap integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_soru_id uuid;
  v_senkron boolean;
begin
  perform public.hiz_siniri('mac_soruyu_atla', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi then return; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  end if;

  if v_index >= v_toplam then return; end if;
  -- Yalnız gerçekten süresi dolduysa
  if v_bas is null or now() <= v_bas + interval '17 seconds' then return; end if;

  v_soru_id := m.soru_ids[v_index + 1];

  -- cevap kolonu NOT NULL; -1 = "süre doldu, cevaplanmadı"
  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, -1, false)
  on conflict do nothing;

  -- SENKRON: indeksi advance_match ilerletir (iki tarafı birden).
  if not v_senkron then
    if v_ben_p1 then
      update public.matches
         set oyuncu1_soru = v_index + 1, oyuncu1_baslangic = null,
             oyuncu1_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    else
      update public.matches
         set oyuncu2_soru = v_index + 1, oyuncu2_baslangic = null,
             oyuncu2_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    end if;
  end if;

  perform public.advance_match(p_match_id);

  -- Soru bu oyuncu için kapandı; doğru cevap artık gösterilebilir
  return query select q.dogru_cevap::int from public.questions q where q.id = v_soru_id;
end;
$fn$;

-- ------------------------------------------------------------
-- İLERLET - senkronda soruyu İKİ TARAF İÇİN BİRDEN geçirir
-- ------------------------------------------------------------
create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.matches%rowtype;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_toplam int;
  v_ikisi_bitti boolean;
  v_terk boolean;
  v_cevap_sayisi int;
  v_yeni int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if coalesce(m.senkron, false) then
    -- ---- SENKRON ----
    if not m.basladi or m.soru_baslangic is null then return; end if;

    if m.aktif_soru < v_toplam then
      select count(*) into v_cevap_sayisi
        from public.match_answers a
       where a.match_id = p_match_id and a.soru_index = m.aktif_soru;

      -- İkisi de cevaplamadı VE süre de dolmadı: soru duruyor.
      if v_cevap_sayisi < 2 and now() <= m.soru_baslangic + interval '16 seconds' then
        return;
      end if;

      v_yeni := m.aktif_soru + 1;
      update public.matches
         set aktif_soru = v_yeni,
             soru_baslangic = now(),
             oyuncu1_soru = v_yeni,
             oyuncu2_soru = v_yeni,
             oyuncu1_baslangic = null,
             oyuncu2_baslangic = null,
             oyuncu1_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu1_bitti_at end,
             oyuncu2_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu2_bitti_at end
       where id = p_match_id;

      if v_yeni < v_toplam then return; end if;   -- maç sürüyor
    end if;
    -- Son soru da geçti: aşağıda sonuçlandırılır.
  else
    -- ---- ESKİ (ASENKRON) ----
    -- Maç, İKİ oyuncu da kendi sorularını bitirince biter.
    -- Bir taraf bitirip diğeri 24 saattir oynamıyorsa maç yine kapanır (terk).
    v_ikisi_bitti := (m.oyuncu1_soru >= v_toplam and m.oyuncu2_soru >= v_toplam);
    v_terk := (
      (m.oyuncu1_soru >= v_toplam or m.oyuncu2_soru >= v_toplam)
      and coalesce(m.oyuncu1_bitti_at, m.oyuncu2_bitti_at) < now() - interval '24 hours'
    );
    if not (v_ikisi_bitti or v_terk) then
      return;   -- henüz bitmedi; herkes kendi hızında oynamaya devam eder
    end if;
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
  elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
  else v_kazanan := null; v_kaybeden := null;
  end if;

  perform public.mac_sonuclandir(p_match_id, v_kazanan, v_kaybeden);
end;
$fn$;

-- ------------------------------------------------------------
-- BOT DONGUSU - senkron macta ORTAK soruyu cevaplar, ortak saati sifirlamaz
-- (canli tanimdan uretildi; yalniz senkron dallari eklendi)
-- ------------------------------------------------------------
create or replace FUNCTION public.bot_oyna()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_ilk boolean;
  v_bot_index int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20, array[r.oyuncu1]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla — bot ASLA oyuncunun önüne geçmez.
  --    Bot yalnızca oyuncunun ulaştığı soruyu cevaplar (oyuncunun cevapladığı
  --    en yüksek indeks + 1) ve 2-6 sn arası rastgele gecikmeyle yanıtlar.
  --    (Eski davranış: 3 sn sonra her soruyu cevaplıyordu; 16 sn'lik otomatik
  --     ilerletmeyle birleşince bot 20 soruyu bitirirken oyuncu 2. sorudaydı.)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet,
           case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end as insan_id
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      -- Botun sira indeksi. SENKRONDA ortak soru (aktif_soru) ile ayni olmali:
      -- bot cevapladiginda kendi indeksi bir ilerler ve sira ortak indeksten
      -- one gecer; boylece ayni soruyu ikinci kez cevaplamaz (cift puan yok).
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
      and (
        not coalesce(m.senkron, false)
        or (m.basladi
            and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
                = m.aktif_soru)
      )
      -- Bot, insan oyuncunun ulaştığı sırayı GEÇEMEZ
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          <= (case when m.oyuncu1 = p.id then m.oyuncu2_soru else m.oyuncu1_soru end)
      -- 2-6 sn rastgele gecikme (insanın son hamlesinden sonra)
      -- Gecikme artik ZORLUGA BAGLI ve SORU BASINA SABIT (bkz. bot_gecikme_sn).
      and now() >= coalesce(m.soru_baslangic, m.created_at)
                   + public.bot_gecikme_sn(
                       p.id,
                       m.id::text || ':' ||
                       (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
    for update of m skip locked
  loop
    v_bot_index := case when r.oyuncu1 = r.bot_id then r.oyuncu1_soru else r.oyuncu2_soru end;
    select * into q from public.questions where id = r.soru_ids[v_bot_index + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, v_bot_index, v_cevap, v_dogru)
    on conflict do nothing;

    -- Bot da insan gibi hızına göre puan alır (3-12 sn arası makul bir aralık)
    v_puan := case when v_dogru then 10 + (3 + floor(random() * 10))::int else 0 end;

    if r.oyuncu1 = r.bot_id then
      update public.matches
         set oyuncu1_skor = oyuncu1_skor + v_puan,
             oyuncu1_soru = v_bot_index + 1,
             oyuncu1_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu1_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    end if;

    perform public.advance_match(r.id);

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet — oyuncu cevaplamadan 16 sn'de ilerletme.
  --    İki koşuldan biri: (a) her ikisi de cevapladı, (b) süre doldu VE oyuncu
  --    bu soruyu cevapladı. Oyuncu maçı terk ederse 90 sn'lik güvenlik ağı
  --    devreye girer (maç sonsuza kadar aktif kalmasın).
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (not coalesce(m.senkron, false) or m.basladi)
      and (
        2 <= (select count(*) from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru)
        or (now() > m.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru
                and a.user_id = (case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end)
            ))
        or now() > m.soru_baslangic + interval '90 seconds'
      )
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      and now() >= t.soru_baslangic + interval '3 seconds'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                           from public.group_match_players gmp
                          where gmp.group_match_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif'
      and now() >= gm.soru_baslangic + (2 + random() * 4) * interval '1 second'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ (1v1'deki kural)
      and gm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.group_match_answers a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.group_match_id = gm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of gm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif'
      and (
        -- herkes cevapladi
        not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        )
        -- ya da soru suresi doldu VE en az bir insan bu soruyu fiilen oynadi
        or (now() > gm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.group_match_answers a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.group_match_id = gm.id and a3.soru_index = gm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        -- ya da mac terk edildi (guvenlik agi)
        or now() > gm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_group_match(r.id);
  end loop;

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                           from public.hizli_oyuncular ho
                          where ho.hizli_mac_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif'
      -- Gecikme zorluga bagli ve (mac, soru, bot) icin SABIT: cron her 7 sn'de
      -- calistigi icin random() her tikte yeniden cekiliyordu; bu, dagilimin
      -- alt sinirina yigilmaya (bot hep ~2 sn'de basiyor) yol aciyordu.
      and now() >= hm.soru_baslangic
                   + public.bot_gecikme_sn(
                       p.id, hm.id::text || ':' || hm.aktif_soru::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ
      and hm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.hizli_cevaplar a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.hizli_mac_id = hm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of hm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif'
      and (
        not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        )
        or (now() > hm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.hizli_cevaplar a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.hizli_mac_id = hm.id and a3.soru_index = hm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        or now() > hm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$function$
;
