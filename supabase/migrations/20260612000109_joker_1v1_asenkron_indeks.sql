-- ============================================================================
-- DÜZELTME: 1v1 maçlarda jokerler hiç çalışmıyordu
--
-- BELİRTİ: Maç ekranında 50:50 / +10 sn / Pas düğmesine basınca hiçbir şey
-- olmuyordu. Sunucu 'Soru değişti, tekrar dene' hatası dönüyor, istemci bunu
-- joker çubuğunun ALTINDA gösterdiği için hata ekranın dışında kalıyordu.
--
-- KÖK NEDEN: 1v1 maçlar ASENKRONDUR — her oyuncu kendi hızında oynar ve kendi
-- ilerlemesi matches.oyuncu1_soru / oyuncu2_soru sütunlarında tutulur
-- (bkz. get_match_question, mac_oyuncu_indeksi). joker_kullan ise ortak
-- matches.aktif_soru sütununu okuyordu. İstemci doğru olan kendi indeksini
-- gönderdiği için `p_soru_index <> v_aktif_soru` neredeyse her zaman tutuyordu.
-- Ölçüm: düzeltme anında aktif 6 maçın 6'sında da aktif_soru, oyuncuların
-- kendi indekslerinden farklıydı.
--
-- Aynı kök nedenin diğer sonuçları (hepsi bu dosyada düzeltildi):
--   * v_soru_id yanlış sorudan seçiliyordu → indeks şans eseri tutsa bile
--     50:50 BAŞKA bir sorunun şıklarını eleyecekti.
--   * Süre kontrolü ortak soru_baslangic'a bakıyordu → yanlıştan 'Süre doldu'.
--   * 'sure' jokeri ortak soru_baslangic'ı uzatıyordu → jokeri kullanana
--     yaramıyor, RAKİBİN süresini uzatıyordu.
--   * 'pas' jokeri cevabı yanlış soru_index'e yazıyordu.
--   * 'zaten cevapladın' kontrolü yanlış indekse bakıyordu.
--
-- KAPSAM: yalnız 1v1 kolu. Grup, hızlı ve turnuva maçları SENKRONDUR (ortak
-- aktif_soru + soru_baslangic; oyuncuya özel ilerleme sütunu yoktur), o kollar
-- olduğu gibi bırakıldı.
--
-- Bu dosyadaki gövde CANLI tanımdan (pg_get_functiondef) alınıp yalnız yukarıda
-- sayılan yerler değiştirilmiştir; mevcut migration'lar değiştirilmedi.
-- ============================================================================

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
