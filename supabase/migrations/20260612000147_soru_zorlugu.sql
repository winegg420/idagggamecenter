-- ============================================================
-- Soru zorluğu + turnuvada artan zorluk
--
-- `questions` tablosunda zorluk alanı yoktu: 8.400+ sorunun hiçbirinde
-- kolay/zor işareti yok, bu yüzden "turnuvada ilk sorular kolay olsun"
-- yapılamıyordu.
--
--   zorluk 1 = çok kolay … 5 = çok zor, varsayılan 3.
--
-- Turnuvada soru sırası → zorluk:  1–5 → 1-2,  6–10 → 3,  11+ → 4-5.
-- O zorlukta yeterli soru yoksa bant genişler; maç asla bozulmaz.
--
-- Zorluk kendi kendini kalibre eder: her soru için doğru cevaplanma oranı
-- tutulur, günlük bir işle (pg_cron) en az 30 cevap almış sorular yeniden
-- sınıflanır. Böylece sonradan eklenen sorular da kendiliğinden yerleşir.
-- ============================================================

alter table public.questions
  add column if not exists zorluk smallint not null default 3,
  add column if not exists dogru_sayisi integer not null default 0,
  add column if not exists cevap_sayisi integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_zorluk_check') then
    alter table public.questions
      add constraint questions_zorluk_check check (zorluk between 1 and 5);
  end if;
end $$;

-- Kategori + zorluk birlikte sorgulanıyor (soru_sec, turnuva_soru_sec).
create index if not exists questions_kategori_zorluk_idx
  on public.questions (kategori, zorluk) where aktif;
create index if not exists questions_zorluk_idx
  on public.questions (zorluk) where aktif;

-- ---- Doğru oranı sayacı ----
create or replace function public.soru_sayac(p_question uuid, p_dogru boolean)
returns void language sql security definer set search_path to 'public' as $$
  update public.questions
     set cevap_sayisi = cevap_sayisi + 1,
         dogru_sayisi = dogru_sayisi + case when p_dogru then 1 else 0 end
   where id = p_question;
$$;

revoke all on function public.soru_sayac(uuid, boolean) from public, authenticated, anon;

-- ---- Günlük kalibrasyon ----
-- En az 30 cevap almış sorular güncellenir; azı ELLE atanan değerde kalır.
create or replace function public.soru_zorluk_kalibre()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_sayi int;
begin
  update public.questions q
     set zorluk = case
       when q.dogru_sayisi::numeric / q.cevap_sayisi > 0.85 then 1
       when q.dogru_sayisi::numeric / q.cevap_sayisi > 0.70 then 2
       when q.dogru_sayisi::numeric / q.cevap_sayisi > 0.45 then 3
       when q.dogru_sayisi::numeric / q.cevap_sayisi > 0.35 then 4
       else 5 end
   where q.cevap_sayisi >= 30;
  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$$;

revoke all on function public.soru_zorluk_kalibre() from public, authenticated, anon;

select cron.unschedule('bildim-soru-zorluk')
  where exists (select 1 from cron.job where jobname = 'bildim-soru-zorluk');
select cron.schedule('bildim-soru-zorluk', '10 4 * * *',
                     'select public.soru_zorluk_kalibre()');

-- ---- 082'de pasife alınan 53 "aşırı basit" soru geri açılıyor ----
-- Turnuva açılışında ilk sorular kolay olmalı ("insanlar ilk sorudan
-- elenmesin"). Bu sorular zorluk 1 olarak işaretlenip aktif ediliyor;
-- turnuva DIŞI seçimlerde zorluk >= 2 filtresi olduğu için normal
-- maçlarda yine çıkmayacaklar.
update public.questions set aktif = true, zorluk = 1 where soru in (
  'Ahtapotun kaç kolu vardır?',
  'Böceklerin kaç bacağı vardır?',
  'Dünya Güneş''in etrafındaki turunu yaklaşık kaç günde tamamlar?',
  'Dünya kendi ekseni etrafında bir turunu yaklaşık kaç saatte tamamlar?',
  'En küçük asal sayı hangisidir?',
  'İnsanda kaç duyu organı vardır?',
  'Kanı vücuda pompalayan organ hangisidir?',
  'Örümceklerin kaç bacağı vardır?',
  'Örümceğin kaç bacağı vardır?',
  'Romen rakamlarında "X" kaçı ifade eder?',
  'Sesi algılayan duyu organı hangisidir?',
  'Su deniz seviyesinde kaç derecede kaynar?',
  'Su kaç derecede kaynar (deniz seviyesinde)?',
  'Suyun kaç santigrat derecede kaynadığı bilinir (deniz seviyesinde)?',
  'Suyun kaynama sıcaklığı normal şartlarda kaç derecedir?',
  'Başlangıç meridyeni kaç derecedir?',
  'Bir haritada denizler genellikle hangi renkle gösterilir?',
  'Dünya üzerindeki kıta sayısı kaçtır?',
  'Türkiye kaç coğrafi bölgeye ayrılır?',
  'Türkiye''nin kaç ili vardır?',
  '100 sayısının yarısı kaçtır?',
  'Bir buçuk saat kaç dakikadır?',
  'Bir çeyrek saat kaç dakikadır?',
  'Futbolda bir maç kaç dakikadır (normal süre)?',
  'Futbolda bir maç normal süresi kaç dakikadır?',
  'Bir futbol maçı normal süresi kaç dakikadır?',
  'Futbolda bir devre kaç dakikadır?',
  'Gökkuşağında kaç ana renk vardır?',
  'Gökyüzü genellikle hangi renkte görünür?',
  'Hangi gaz solunumda kullanılır?',
  'Kırmızı ve sarı renkleri karıştırınca hangi renk oluşur?',
  'Mavi ve sarı renkleri karıştırınca hangi renk oluşur?',
  'Pusulada kuzeyin kısaltması hangisidir?',
  'Reklamın temel amacı nedir?',
  'Şubat ayı normal yıllarda kaç gündür?',
  'Trafik ışığında kırmızı ne anlama gelir?',
  'Trafikte kırmızı ışıkta ne yapılır?',
  'Türkiye''nin başkenti neresidir?',
  'Fransa''nın başkenti neresidir?',
  'İtalya''nın başkenti neresidir?',
  'Japonya''nın başkenti neresidir?',
  'İngiltere''nin başkenti neresidir?',
  'Rusya''nın başkenti neresidir?',
  'İspanya''nın başkenti neresidir?',
  'Almanya''nın başkenti neresidir?',
  'Yunanistan''ın başkenti neresidir?',
  'ABD''nin başkenti neresidir?',
  'Hollanda''nın başkenti neresidir?',
  'Çin''in başkenti neresidir?',
  'Kar hangi mevsimde yaygın olarak yağar?',
  'Işığın aynadan geri dönmesine ne denir?',
  'Elementlere örnek hangisidir?',
  'Hangi hayvan sesini taklit edebilir?'
);

-- ---- Normal seçimlerde zorluk >= 2 ----
-- Aşırı basit sorular (zorluk 1) yalnız turnuva açılışında kullanılır.
create or replace function public.soru_sec(p_kategori text, p_adet integer, p_oyuncular uuid[] default '{}'::uuid[], p_dil text default null, p_max_okuma integer default null)
 returns uuid[] language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_oyn uuid[] := coalesce(p_oyuncular, '{}'::uuid[]);
  v_adet int := greatest(1, coalesce(p_adet, 1));
  v_kat text := p_kategori;
  v_dil text;
  v_max int := p_max_okuma;
  v_ids uuid[] := '{}'::uuid[];
  v_deneme int;
begin
  v_dil := coalesce(
    nullif(btrim(coalesce(p_dil, '')), ''),
    (select pr.dil from public.profiles pr where pr.id = v_oyn[1]),
    'tr'
  );

  for v_deneme in 1..4 loop
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_ids
    from (
      select q.id
      from public.questions q
      left join lateral (
        select max(g.gorulen_at) as son
        from public.gorulen_sorular g
        where g.question_id = q.id and g.user_id = any(v_oyn)
      ) gs on true
      where q.aktif
        and q.zorluk >= 2
        and (v_kat is null or q.kategori = v_kat)
        and q.dil = v_dil
        and (
          v_max is null
          or length(q.soru)
             + (select coalesce(sum(length(x)), 0)
                  from jsonb_array_elements_text(q.secenekler) x) <= v_max
        )
      order by (gs.son is not null), gs.son asc, random()
      limit v_adet
    ) s;

    exit when coalesce(array_length(v_ids, 1), 0) >= v_adet;

    if v_max is not null then
      v_max := null;
    elsif v_kat is not null then
      v_kat := null;
    elsif v_dil <> 'tr' then
      v_dil := 'tr';
    else
      exit;
    end if;
  end loop;

  return v_ids;
end;
$function$;

-- ---- Turnuvada artan zorluk ----
-- Sıra 1–5 → zorluk 1-2, 6–10 → 3, 11+ → 4-5. Bantta yeterli soru yoksa
-- bant bir kademe genişler; sorular yine de tamamlanır.
create or replace function public.turnuva_soru_sec(p_adet integer, p_dil text default 'tr')
 returns uuid[] language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_ids uuid[] := '{}'::uuid[];
  v_parca uuid[];
  v_bant int[][] := array[array[1,2], array[3,3], array[4,5]];
  v_i int;
  v_alt int; v_ust int; v_istenen int; v_kalan int;
  v_genislet int;
begin
  for v_i in 1..3 loop
    v_alt := v_bant[v_i][1];
    v_ust := v_bant[v_i][2];
    v_istenen := case
      when v_i = 1 then least(5, p_adet)
      when v_i = 2 then least(5, greatest(0, p_adet - 5))
      else greatest(0, p_adet - 10)
    end;
    if v_istenen <= 0 then continue; end if;

    for v_genislet in 0..4 loop
      select coalesce(array_agg(s.id), '{}'::uuid[]) into v_parca
      from (
        select q.id from public.questions q
        where q.aktif and q.dil = coalesce(p_dil, 'tr')
          and q.zorluk between greatest(1, v_alt - v_genislet) and least(5, v_ust + v_genislet)
          and q.id <> all(v_ids)
        order by random()
        limit v_istenen
      ) s;
      exit when coalesce(array_length(v_parca, 1), 0) >= v_istenen;
    end loop;

    v_ids := v_ids || coalesce(v_parca, '{}'::uuid[]);
  end loop;

  -- Havuz yine de yetmediyse kalanı serbest doldur (turnuva bozulmasın).
  v_kalan := p_adet - coalesce(array_length(v_ids, 1), 0);
  if v_kalan > 0 then
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_parca
    from (
      select q.id from public.questions q
      where q.aktif and q.id <> all(v_ids)
      order by random() limit v_kalan
    ) s;
    v_ids := v_ids || coalesce(v_parca, '{}'::uuid[]);
  end if;

  return v_ids;
end;
$function$;

revoke all on function public.turnuva_soru_sec(integer, text) from public, authenticated, anon;

-- ---- Cevap sayaclari: her cevap zorluk kalibrasyonunu besler ----

CREATE OR REPLACE FUNCTION public.submit_match_answer(p_match_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, puan integer, benim_skor integer, rakip_skor integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_s1 int;
  v_s2 int;
  v_soru_id uuid;
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
    if m.duraklatildi_at is not null then
      raise exception 'Rakip bağlantısı koptu — maç duraklatıldı';
    end if;
    if now() < m.soru_baslangic then raise exception 'Maç başlamak üzere'; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := coalesce(case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end, now());
  end if;

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;

  v_soru_id := public.soru_id_coz('1v1', p_match_id, auth.uid(), v_index, m.soru_ids[v_index + 1]);
  v_bas := public.soru_baslangic_coz('1v1', p_match_id, auth.uid(), v_index, v_bas);

  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  if exists (
    select 1 from public.match_answers a
    where a.match_id = p_match_id and a.user_id = auth.uid() and a.soru_index = v_index
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);
  -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
  perform public.soru_sayac(q.id, v_dogru);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    -- HIZ BONUSU YOK: dogru = sabit 10 puan (bkz. migration 143).
    v_puan := 10;
  else
    v_puan := 0;
  end if;

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

  select oyuncu1_skor, oyuncu2_skor into v_s1, v_s2
    from public.matches where id = p_match_id;

  return query select
    v_dogru, q.dogru_cevap, v_puan,
    case when v_ben_p1 then v_s1 else v_s2 end,
    case when v_ben_p1 then v_s2 else v_s1 end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_group_match_answer(p_group_match_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  perform public.hiz_siniri('submit_group_match_answer', 60, interval '60 seconds');
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_soru_id := public.soru_id_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_ids[gm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_baslangic);

  if now() > v_bas + interval '16 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);
  -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
  perform public.soru_sayac(q.id, v_dogru);

  insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
  values (p_group_match_id, auth.uid(), gm.aktif_soru, p_cevap, v_dogru);

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    -- HIZ BONUSU YOK: dogru = sabit 10 puan (bkz. migration 143).
    v_puan := 10;
    update public.group_match_players
       set skor = skor + v_puan
     where group_match_id = p_group_match_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_hizli_cevap(p_hizli_mac_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, ilk boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_ilk boolean := false;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  perform public.hiz_siniri('submit_hizli_cevap', 60, interval '60 seconds');
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid()
      and ho.davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_soru_id := public.soru_id_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_ids[hm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_baslangic);

  if now() > v_bas + interval '16 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);
  -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
  perform public.soru_sayac(q.id, v_dogru);

  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar hc
      where hc.hizli_mac_id = p_hizli_mac_id
        and hc.soru_index = hm.aktif_soru and hc.dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_ilk then
    update public.hizli_oyuncular ho
       set skor = ho.skor + 10
     where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_tournament_answer(p_tournament_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.tournaments%rowtype;
  q public.questions%rowtype;
  p public.tournament_players%rowtype;
  v_dogru boolean;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('submit_tournament_answer', 60, interval '60 seconds');
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;

  select * into p from public.tournament_players
  where tournament_id = p_tournament_id and user_id = auth.uid();
  if not found then raise exception 'Turnuvada değilsin'; end if;
  if p.elendi then raise exception 'Elendin'; end if;

  if now() > t.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = t.soru_ids[t.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);
  -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
  perform public.soru_sayac(q.id, v_dogru);

  insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
  values (p_tournament_id, auth.uid(), t.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    update public.tournament_players
       set dogru_sayisi = dogru_sayisi + 1
     where tournament_id = p_tournament_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hizli_mod_cevap(p_oturum_id uuid, p_soru_index integer, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, skor integer, kalan_toplam_sn integer, bitti boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.hizli_mod_oturumlar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_kalan int;
  v_bitti boolean := false;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_cevap', 60, interval '60 seconds');
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  v_kalan := greatest(0, 60 - floor(extract(epoch from (now() - o.baslangic)))::int);

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];

  -- Soru başına 5 sn (1 sn ağ payı); süre geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '6 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
    -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
    perform public.soru_sayac(q.id, v_dogru);
  end if;

  -- Kategori ustalığı: hızlı modda da doğrular sayılır
  if v_dogru then
    perform public.kategori_dogru_arttir(auth.uid(), q.kategori);
  else
    -- Hatalarım bankası
    perform public.yanlis_kaydet(q.id);
  end if;

  update public.hizli_mod_oturumlar h
     set dogru = h.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = h.yanlis + (case when v_dogru then 0 else 1 end),
         aktif_soru = h.aktif_soru + 1,
         soru_baslangic = now()
   where h.id = p_oturum_id
  returning h.* into o;

  if v_kalan <= 0 or o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    perform public.hizli_mod_bitir(p_oturum_id);
    v_bitti := true;
    v_kalan := 0;
  end if;

  return query select v_dogru, q.dogru_cevap, o.dogru, v_kalan, v_bitti;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calisma_cevap(p_oturum_id uuid, p_soru_index integer, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, bankadan boolean, yeni_seri integer, ogrenildi boolean, onceki_yanlis integer, bitti boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.calisma_oturumlari%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_bankadan boolean;
  v_seri int := 0;
  v_yanlis int := 0;
  v_ogrenildi boolean := false;
  v_bitti boolean := false;
  v_var boolean;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('calisma_cevap', 60, interval '60 seconds');
  select * into o from public.calisma_oturumlari where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];
  v_bankadan := q.id = any(o.banka_ids);

  -- Süre 20 sn (+1 sn ağ payı); geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '21 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
    -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
    perform public.soru_sayac(q.id, v_dogru);
  end if;

  -- Bankadaki satırın önceki durumunu al
  select true, ys.yanlis_sayisi, ys.dogru_serisi
    into v_var, v_yanlis, v_seri
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id and ys.question_id = q.id;

  if v_dogru then
    -- Kategori ustalığı: çalışma modunda da doğrular sayılır
    perform public.kategori_dogru_arttir(o.user_id, q.kategori);

    if coalesce(v_var, false) then
      v_seri := coalesce(v_seri, 0) + 1;
      if v_seri >= 2 then
        v_ogrenildi := true;
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = now()
         where ys.user_id = o.user_id and ys.question_id = q.id;
      else
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = null
         where ys.user_id = o.user_id and ys.question_id = q.id;
      end if;
    end if;
    -- Havuzdan gelen soru doğru bilindiyse bankaya hiç girmez.
  else
    -- Yanlış: seri sıfırlanır, banka satırı açılır/güncellenir
    perform public.yanlis_kaydet(q.id);
    v_seri := 0;
    v_yanlis := coalesce(v_yanlis, 0) + 1;
    v_ogrenildi := false;
  end if;

  update public.calisma_oturumlari c
     set dogru = c.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = c.yanlis + (case when v_dogru then 0 else 1 end),
         ogrenilen = c.ogrenilen + (case when v_ogrenildi then 1 else 0 end),
         aktif_soru = c.aktif_soru + 1,
         soru_baslangic = now()
   where c.id = p_oturum_id
  returning c.* into o;

  if o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    v_bitti := true;
  end if;

  return query select v_dogru, q.dogru_cevap, v_bankadan,
                      coalesce(v_seri, 0), v_ogrenildi,
                      coalesce(v_yanlis, 0), v_bitti;
end;
$function$;

-- ---- Turnuva sorulari artan zorlukla secilir ----

CREATE OR REPLACE FUNCTION public.start_tournament(p_seans text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.tournaments%rowtype;
  v_oyuncu int;
begin
  select * into t
  from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans
    and durum = 'lobi'
  for update;
  if not found then return; end if;

  select count(*) into v_oyuncu from public.tournament_players where tournament_id = t.id;

  if v_oyuncu < 2 then
    update public.tournaments set durum = 'iptal', bitis = now() where id = t.id;
    return;
  end if;

  update public.tournaments
     set durum = 'aktif',
         -- Turnuva KARIŞIK: kategori yok, ortak havuz (dil 'tr')
         soru_ids = public.turnuva_soru_sec(30, 'tr'),
         aktif_soru = 0,
         baslangic = now(),
         soru_baslangic = now()
   where id = t.id;
end;
$function$;
