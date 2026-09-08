-- ============================================================
-- 1v1 MAÇ ARTIK ASENKRON
--
-- Sorun: `matches.aktif_soru` ve `soru_baslangic` iki oyuncu için ORTAKTI ve
-- soru süresi 16 sn'ydi. Bağlantısı kopan ya da o an oynamayan taraf soruları
-- kaçırıyor, maç onsuz akıp bitiyordu.
--
-- Yeni davranış: her oyuncu KENDİ hızında oynar.
--   * Kendi soru indeksi (oyuncu1_soru / oyuncu2_soru)
--   * Kendi soru başlangıcı → 16 sn kendi ekranını açtığı andan itibaren işler
--   * Maç, İKİ taraf da tüm soruları bitirince biter
--   * Bir taraf bitirip diğeri 24 saat oynamazsa maç kapanır (terk)
--
-- `aktif_soru` kolonu SİLİNMEDİ: "en ileri giden oyuncu" göstergesi olarak
-- güncellenmeye devam ediyor, eski kod ve sorgular kırılmıyor.
-- ============================================================

alter table public.matches
  add column if not exists oyuncu1_soru int not null default 0,
  add column if not exists oyuncu2_soru int not null default 0,
  add column if not exists oyuncu1_baslangic timestamptz,
  add column if not exists oyuncu2_baslangic timestamptz,
  add column if not exists oyuncu1_bitti_at timestamptz,
  add column if not exists oyuncu2_bitti_at timestamptz;

-- Geriye dönük doldurma: mevcut maçlarda herkesin cevap sayısı kendi indeksidir
update public.matches m
   set oyuncu1_soru = coalesce((
         select count(*) from public.match_answers a
         where a.match_id = m.id and a.user_id = m.oyuncu1), 0),
       oyuncu2_soru = coalesce((
         select count(*) from public.match_answers a
         where a.match_id = m.id and a.user_id = m.oyuncu2), 0)
 where m.durum in ('aktif', 'bekliyor');

-- ------------------------------------------------------------
-- Yardımcı: oyuncunun bu maçtaki soru indeksi
-- ------------------------------------------------------------
create or replace function public.mac_oyuncu_indeksi(p_match_id uuid, p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when m.oyuncu1 = p_user then m.oyuncu1_soru else m.oyuncu2_soru end
  from public.matches m where m.id = p_match_id;
$$;

revoke execute on function public.mac_oyuncu_indeksi(uuid, uuid) from public, anon;
grant execute on function public.mac_oyuncu_indeksi(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Soruyu getir — HERKES KENDİ indeksini görür.
-- Süre, oyuncu soruyu ilk kez çektiğinde başlar (kopan bağlantı ceza olmasın).
-- ------------------------------------------------------------
create or replace function public.get_match_question(p_match_id uuid)
returns table (
  question_id uuid, soru text, secenekler jsonb, soru_index integer,
  baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint
)
language plpgsql
security definer
set search_path = public
as $$
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
  v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;

  if v_index >= coalesce(array_length(m.soru_ids, 1), 0) then
    raise exception 'Bu maçta senin sıran bitti';
  end if;

  -- Süre bu oyuncu için ilk görüntülemede başlar
  v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  if v_bas is null then
    v_bas := now();
    if v_ben_p1 then
      update public.matches set oyuncu1_baslangic = v_bas where id = p_match_id;
    else
      update public.matches set oyuncu2_baslangic = v_bas where id = p_match_id;
    end if;
  end if;

  perform public.gorulen_kaydet(m.soru_ids[v_index + 1]);

  return query
    select q.id, q.soru, q.secenekler, v_index, v_bas, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = m.soru_ids[v_index + 1];
end;
$$;

revoke execute on function public.get_match_question(uuid) from public, anon;
grant execute on function public.get_match_question(uuid) to authenticated;

-- ------------------------------------------------------------
-- Cevap — kendi indeksi ve kendi süresiyle; sonra kendi sırası ilerler
-- ------------------------------------------------------------
create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
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
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
  v_bas := coalesce(
    case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end,
    now()
  );
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;
  -- 1 sn ağ payı
  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = m.soru_ids[v_index + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
  else
    v_puan := 0;
  end if;

  -- Kendi sırasını ilerlet, süreyi sıfırla, skoru işle
  if v_ben_p1 then
    update public.matches
       set oyuncu1_skor = oyuncu1_skor + v_puan,
           oyuncu1_soru = v_index + 1,
           oyuncu1_baslangic = null,
           oyuncu1_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
           aktif_soru = greatest(aktif_soru, v_index + 1)
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_skor = oyuncu2_skor + v_puan,
           oyuncu2_soru = v_index + 1,
           oyuncu2_baslangic = null,
           oyuncu2_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
           aktif_soru = greatest(aktif_soru, v_index + 1)
     where id = p_match_id;
  end if;

  perform public.advance_match(p_match_id);

  return query select v_dogru, q.dogru_cevap;
end;
$$;

revoke execute on function public.submit_match_answer(uuid, smallint) from public, anon;
grant execute on function public.submit_match_answer(uuid, smallint) to authenticated;

-- ------------------------------------------------------------
-- Süre dolduğunda kendi sırasını atlat (cevapsız geçmiş sayılır)
-- ------------------------------------------------------------
create or replace function public.mac_soruyu_atla(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
  v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_index >= v_toplam then return; end if;
  -- Yalnız gerçekten süresi dolduysa
  if v_bas is null or now() <= v_bas + interval '17 seconds' then return; end if;

  -- cevap kolonu NOT NULL; -1 = "süre doldu, cevaplanmadı"
  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, -1, false)
  on conflict do nothing;

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

  perform public.advance_match(p_match_id);
end;
$$;

revoke execute on function public.mac_soruyu_atla(uuid) from public, anon;
grant execute on function public.mac_soruyu_atla(uuid) to authenticated;

-- ------------------------------------------------------------
-- advance_match: artik ORTAK ilerletme yok; yalniz BITIS kontrolu
-- (govde mevcut surumden alindi, yalniz bitis kosulu ve else dali degisti)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_toplam int;
  v_ikisi_bitti boolean;
  v_terk boolean;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  -- ASENKRON: maç, İKİ oyuncu da kendi sorularını bitirince biter.
  -- Bir taraf bitirip diğeri 24 saattir oynamıyorsa maç yine kapanır (terk).
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);
  v_ikisi_bitti := (m.oyuncu1_soru >= v_toplam and m.oyuncu2_soru >= v_toplam);
  v_terk := (
    (m.oyuncu1_soru >= v_toplam or m.oyuncu2_soru >= v_toplam)
    and coalesce(m.oyuncu1_bitti_at, m.oyuncu2_bitti_at) < now() - interval '24 hours'
  );

  if not (v_ikisi_bitti or v_terk) then
    return;   -- henüz bitmedi; herkes kendi hızında oynamaya devam eder
  end if;

  if true then
    select * into m from public.matches where id = p_match_id;
    if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
    elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
    else v_kazanan := null;
    end if;

    update public.matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_match_id;

    if v_kazanan is not null then
      update public.profiles
         set puan = puan + 20, puan_hafta = puan_hafta + 20
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.matches where kazanan = v_kazanan and durum = 'bitti') >= 10 then
        perform public.award_badge(v_kazanan, 'mac_10');
      end if;
      if v_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
        perform public.award_badge(v_kazanan, 'bot_avcisi');
      end if;
      if (select count(*) from public.match_answers
          where match_id = p_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(m.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri,
               son_seri_tarihi = v_bugun,
               puan = puan + v_bonus,
               puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    -- Asenkron akışta ortak ilerletme YOK: her oyuncu kendi sırasını
    -- submit_match_answer / mac_soruyu_atla içinde ilerletir.
    null;
  end if;
end;
$function$
;

-- ------------------------------------------------------------
-- bot_oyna: 1v1 bolumu asenkrona uyarlandi (bot kendi indeksiyle oynar,
-- insan oyuncunun sirasini gecemez)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_oyna()
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
           soru_baslangic = now()
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
      -- ASENKRON: botun KENDİ sıra indeksi
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
      -- Bot, insan oyuncunun ulaştığı sırayı GEÇEMEZ
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          <= (case when m.oyuncu1 = p.id then m.oyuncu2_soru else m.oyuncu1_soru end)
      -- 2-6 sn rastgele gecikme (insanın son hamlesinden sonra)
      and now() >= coalesce(m.soru_baslangic, m.created_at)
                   + (2 + random() * 4) * interval '1 second'
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
             aktif_soru = greatest(aktif_soru, v_bot_index + 1),
             soru_baslangic = now()
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_bot_index + 1),
             soru_baslangic = now()
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
      and now() >= hm.soru_baslangic + (2 + random() * 4) * interval '1 second'
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
