-- ============================================================================
-- RPC HIZ SINIRI — sınırların uygulanması
--
-- Her fonksiyonun gövdesi CANLI tanımdan (pg_get_functiondef) alındı ve
-- yalnızca 'begin' satırının hemen ardına TEK bir satır eklendi:
--     perform public.hiz_siniri('<uc>', <limit>, interval '60 seconds');
-- Başka hiçbir yeri değiştirilmedi.
--
-- LİMİTLER GERÇEK VERİDEN SEÇİLDİ (tahmin değil). Canlı veritabanında,
-- kullanıcı başına 60 saniyelik kayan pencerede gözlenen EN YÜKSEK değerler:
--     match_answers ............ 15   (ortalama 4,4)
--     group_match_answers ......  9
--     tournament_answers .......  7
--     hizli_cevaplar ...........  3
-- Cevap uçlarına 60/60sn kondu → gözlenen en yüksek değerin 4 KATI pay.
-- (Hızlı Mod 60 saniyelik tur; soru başına ~1,5 sn'lik insan üstü bir tempo
--  bile 40 cevap eder, yine sınırın altında kalır.)
--
--     joker_kullan ... 20/60sn. Lig maçında maç başına EN FAZLA 2 joker
--     hakkı var; arkadaş maçında sınırsız ama insan eliyle dakikada 20 joker
--     kullanmak mümkün değil. Gerçek tavanın 10 katından fazla pay.
--
--     başlatma uçları ... 10/60sn. Normal oyuncu dakikada 1-2 maç/oturum
--     başlatır. 5 kat pay.
--
-- SINIR KONMAYANLAR (bilerek):
--   advance_match / advance_group_match / advance_hizli_mac /
--   advance_tournament — bunlar hem istemci yoklamasıyla hem de sunucu
--   tarafından (bot_oyna, cron) çağrılıyor; sınıra takılsalardı maçlar yarım
--   kalırdı. Zaten hiz_siniri auth.uid() NULL iken sessizce çıkıyor, yani
--   bot/cron akışları her hâlükârda muaf.
--
-- Mevcut migration'lar değiştirilmedi.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_match_answer(p_match_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint)
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
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('submit_match_answer', 60, interval '60 seconds');
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

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

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
$function$
;

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
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
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
  if now() > gm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = gm.soru_ids[gm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
  values (p_group_match_id, auth.uid(), gm.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (gm.soru_baslangic + interval '16 seconds' - now())))))::int;
    update public.group_match_players
       set skor = skor + v_puan
     where group_match_id = p_group_match_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$
;

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
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
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
  if now() > hm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = hm.soru_ids[hm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  -- İlk doğru mu? (satır kilidi altında kontrol edilir)
  -- `hc.dogru` NİTELİKLİ: out-parametre ile çakışmasın.
  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar hc
      where hc.hizli_mac_id = p_hizli_mac_id
        and hc.soru_index = hm.aktif_soru
        and hc.dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_ilk then
    update public.hizli_oyuncular ho
       set skor = ho.skor + 10
     where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$function$
;

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
$function$
;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.mac_soruyu_atla(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('mac_soruyu_atla', 60, interval '60 seconds');
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
$function$
;

CREATE OR REPLACE FUNCTION public.joker_kullan(p_mac_tur text, p_mac_id uuid, p_soru_index integer, p_tur text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_sinir int;
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_soru_id uuid;
  v_dogru smallint;
  v_kapali int[];
  v_baslangic timestamptz;
  v_aktif_soru int;
  m public.matches%rowtype;
  gm public.group_matches%rowtype;
  hm public.hizli_maclar%rowtype;
  t public.tournaments%rowtype;
  v_ben_p1 boolean;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('joker_kullan', 20, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_tur not in ('elli','sure','pas') then
    raise exception 'Bu joker maç içinde kullanılamaz';
  end if;
  if p_mac_tur not in ('1v1','grup','hizli','turnuva') then
    raise exception 'Geçersiz maç türü';
  end if;
  if p_mac_tur = 'turnuva' and p_tur = 'pas' then
    raise exception 'Turnuvada pas jokeri kullanılamaz';
  end if;

  -- ---- Maçı doğrula, aktif soruyu ve süreyi al ----
  if p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if v_me not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
    if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    -- 1v1 ASENKRONDUR: her oyuncu kendi hızında oynar. Ortak m.aktif_soru
    -- bu oyuncunun bulunduğu soru DEĞİLDİR; get_match_question ile aynı
    -- oyuncuya özel sütunlar kullanılmalı. (Eskiden ortak sütun okunuyordu;
    -- indeks tutmadığı için joker 'Soru değişti, tekrar dene' ile reddediliyordu.)
    v_ben_p1 := (m.oyuncu1 = v_me);
    v_aktif_soru := coalesce(case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end, 0);
    v_baslangic := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
    v_soru_id := m.soru_ids[v_aktif_soru + 1];
    if exists (select 1 from public.match_answers
               where match_id = p_mac_id and user_id = v_me and soru_index = v_aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'grup' then
    select * into gm from public.group_matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.group_match_players
                   where group_match_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := gm.aktif_soru; v_baslangic := gm.soru_baslangic;
    v_soru_id := gm.soru_ids[gm.aktif_soru + 1];
    if exists (select 1 from public.group_match_answers
               where group_match_id = p_mac_id and user_id = v_me and soru_index = gm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'hizli' then
    select * into hm from public.hizli_maclar where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.hizli_oyuncular
                   where hizli_mac_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := hm.aktif_soru; v_baslangic := hm.soru_baslangic;
    v_soru_id := hm.soru_ids[hm.aktif_soru + 1];
    if exists (select 1 from public.hizli_cevaplar
               where hizli_mac_id = p_mac_id and user_id = v_me and soru_index = hm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  else -- turnuva
    select * into t from public.tournaments where id = p_mac_id for update;
    if not found then raise exception 'Turnuva bulunamadı'; end if;
    if not exists (select 1 from public.tournament_players
                   where tournament_id = p_mac_id and user_id = v_me and not elendi) then
      raise exception 'Turnuvada değilsin ya da elendin';
    end if;
    if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;
    v_aktif_soru := t.aktif_soru; v_baslangic := t.soru_baslangic;
    v_soru_id := t.soru_ids[t.aktif_soru + 1];
    if exists (select 1 from public.tournament_answers
               where tournament_id = p_mac_id and user_id = v_me and soru_index = t.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;
  end if;

  if p_soru_index is not null and p_soru_index <> v_aktif_soru then
    raise exception 'Soru değişti, tekrar dene';
  end if;
  if now() > v_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  -- ---- Maç kuralı ----
  v_sinir := public.joker_mac_siniri(p_mac_tur, p_mac_id);
  select count(*) into v_kullanilan
  from public.joker_kullanimlari
  where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id;

  if v_sinir = 0 then
    raise exception 'Turnuva finalinde joker kullanılamaz';
  end if;
  if v_sinir is not null and v_kullanilan >= v_sinir then
    raise exception 'Bu maçta en fazla % joker kullanabilirsin', v_sinir;
  end if;

  -- ---- Ücretsiz elli hakkı (maç başına 1, birikmez) ----
  if p_tur = 'elli' and not exists (
    select 1 from public.joker_kullanimlari
    where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id
      and tur = 'elli' and ucretsiz
  ) then
    v_ucretsiz := true;
  end if;

  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', p_mac_tur || ':' || p_mac_id::text);
  end if;

  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, p_mac_tur, p_mac_id, v_aktif_soru, p_tur, v_ucretsiz);

  -- ---- Etki ----
  select q.dogru_cevap into v_dogru from public.questions q where q.id = v_soru_id;

  if p_tur = 'elli' then
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> v_dogru order by random() limit 2
    ) s;
    return jsonb_build_object('tur','elli','ucretsiz',v_ucretsiz,'kapali',to_jsonb(v_kapali));

  elsif p_tur = 'sure' then
    if p_mac_tur = '1v1' then
      -- Asenkron maçta süre oyuncuya özeldir: ortak soru_baslangic'ı uzatmak
      -- jokeri kullanana yaramaz, RAKİBİN süresini uzatırdı.
      if v_ben_p1 then
        update public.matches set oyuncu1_baslangic = oyuncu1_baslangic + interval '10 seconds' where id = p_mac_id;
      else
        update public.matches set oyuncu2_baslangic = oyuncu2_baslangic + interval '10 seconds' where id = p_mac_id;
      end if;
    elsif p_mac_tur = 'grup' then
      update public.group_matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    elsif p_mac_tur = 'hizli' then
      update public.hizli_maclar set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    else
      update public.tournaments set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    end if;
    return jsonb_build_object('tur','sure','ucretsiz',false,'uzatildi',true);

  else -- pas: soruyu atla, puan yok (cevap -1 olarak işaretlenir)
    if p_mac_tur = '1v1' then
      insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    elsif p_mac_tur = 'grup' then
      insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    else
      insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    end if;
    return jsonb_build_object('tur','pas','ucretsiz',false,'atlandi',true,'dogru_cevap',v_dogru);
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.quick_match(p_kategori text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
  v_kat text;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('quick_match', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Bekleyen herhangi bir gerçek oyuncu varsa onunla eşleş (karışık)
  select q.user_id into v_rakip from public.matchmaking_queue q
  where q.user_id <> auth.uid()
  order by q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Kimse yoksa rastgele botla başla (oyuncunun tercih ettiği kategoride)
  delete from public.matchmaking_queue where user_id = auth.uid();

  select id into v_bot from public.profiles where is_bot order by random() limit 1;

  insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now()
  )
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_hizli_mac(p_rakipler uuid[], p_kategori text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('create_hizli_mac', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi <> 4 then
    raise exception 'Hızlı mod için tam 4 rakip seçmelisin (toplam 5 kişi)';
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
      raise exception 'Hızlı maça yalnız arkadaşlarını ve botları çağırabilirsin.';
    end if;
  end loop;

  perform public.mac_kotasi_kontrol();

  insert into public.hizli_maclar (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), 5, p_kategori)
  returning id into v_id;

  insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calisma_baslat(p_kategori text DEFAULT NULL::text, p_soru_sayisi integer DEFAULT 10)
 RETURNS TABLE(oturum_id uuid, soru_sayisi integer, bankadan integer, havuzdan integer, soru_sure_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_kat text;
  v_adet int;
  v_banka uuid[] := '{}'::uuid[];
  v_havuz uuid[] := '{}'::uuid[];
  v_tum uuid[] := '{}'::uuid[];
  v_eksik int;
  v_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('calisma_baslat', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_adet := least(50, greatest(5, coalesce(p_soru_sayisi, 10)));
  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Aynı anda tek aktif oturum
  update public.calisma_oturumlari
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  -- Bankadan: öğrenilmemiş; eski yanlışlar ve çok yanlışlananlar önce
  select coalesce(array_agg(s.question_id), '{}'::uuid[]) into v_banka
  from (
    select ys.question_id
    from public.yanlis_sorular ys
    join public.questions q on q.id = ys.question_id
    where ys.user_id = v_me
      and ys.ogrenildi_at is null
      and q.aktif
      and (v_kat is null or q.kategori = v_kat)
    order by ys.son_yanlis_at asc, ys.yanlis_sayisi desc
    limit v_adet
  ) s;

  v_eksik := v_adet - coalesce(array_length(v_banka, 1), 0);

  -- Yetmezse normal havuzdan (soru_sec görülmemişleri öne alır).
  -- LIMIT, id'lerin satır satır açıldığı iç sorguda olmalı.
  if v_eksik > 0 then
    select coalesce(array_agg(t.x), '{}'::uuid[]) into v_havuz
    from (
      select s.x
      from (
        select unnest(
          public.soru_sec(
            v_kat,
            v_eksik + coalesce(array_length(v_banka, 1), 0) + 5,
            array[v_me]
          )
        ) as x
      ) s
      where not (s.x = any(v_banka))
      limit v_eksik
    ) t;
  end if;

  v_tum := v_banka || coalesce(v_havuz, '{}'::uuid[]);

  if coalesce(array_length(v_tum, 1), 0) = 0 then
    raise exception 'Çalışılacak soru bulunamadı';
  end if;

  insert into public.calisma_oturumlari (user_id, kategori, soru_ids, banka_ids)
  values (v_me, v_kat, v_tum, v_banka)
  returning id into v_id;

  return query
  select v_id,
         coalesce(array_length(v_tum, 1), 0),
         coalesce(array_length(v_banka, 1), 0),
         coalesce(array_length(v_havuz, 1), 0),
         20;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hizli_mod_baslat(p_kategori text DEFAULT NULL::text)
 RETURNS TABLE(oturum_id uuid, soru_sayisi integer, sure_sn integer, soru_sure_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_kat text;
  v_ids uuid[];
  v_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_baslat', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Devam eden oturumu kapat (tek aktif oturum)
  update public.hizli_mod_oturumlar
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  perform public.mac_kotasi_kontrol();

  -- 60 sn / 5 sn = en çok 12 soru; yedekle birlikte 25 çekilir
  v_ids := public.soru_sec(v_kat, 25, array[v_me]);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Bu kategoride soru bulunamadı';
  end if;

  insert into public.hizli_mod_oturumlar (user_id, kategori, soru_ids)
  values (v_me, v_kat, v_ids)
  returning id into v_id;

  return query select v_id, coalesce(array_length(v_ids, 1), 0), 60, 5;
end;
$function$
;
