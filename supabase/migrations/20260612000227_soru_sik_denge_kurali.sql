-- Paket 25 — "Doğru şık kendini ele veriyor" kusuru
--
-- SORUN: bir oyuncu fark etti, ölçümle doğrulandı. Bugünkü havuzda (9.290 aktif soru)
-- doğru şık ortalama 17,15 karakter, yanlış şıklar 10,41 karakter. Bunun bedeli:
-- "soruyu hiç okumadan en uzun şıkkı seç" stratejisi %63,1 başarıyla oynuyordu
-- (4 şıkta rastlantı %25). Oyun bilgiyle değil, şık uzunluğuyla kazanılıyordu.
--
-- Bu dosya üç şeyi düzeltir:
--   1) `dogru_en_uzun` kuralı, Edge Function'daki DOĞRULANMIŞ eşiklere çekilir
--      (generate-questions/kalite.ts › DENGE_ORANI / DENGE_MUAF_FARK). İki yerde
--      iki farklı tanım kalmaz.
--   2) Yeni kural `dogru_coklu_kelime`: doğru şık HER çeldiriciden daha çok kelimeli.
--      (Şikâyet tam buydu: bütün şıklar tek kelime, doğru cevap 2-3 kelime.)
--   3) Her iki işaretin ağırlığı 2'ye çıkar — böylece denetlenmemiş hâlde
--      Dereceli/Düello/Turnuva havuzuna GİRMEZLER (eşik: soru_rekabetci_haric_agirlik = 2).
--
-- FORMÜL (tek cümle): doğru şık, yanlış şıkların ORTALAMASININ `soru_uzun_sik_oran`
-- katından uzunsa VE aradaki mutlak fark `soru_uzun_sik_fark` karakteri aşıyorsa işaret.
--
-- ESKİ SQL KURALI ÜÇ YÖNDEN GEVŞEKTİ: oran 1,6 (1,4 yerine), karşılaştırma EN UZUN
-- diğer şıkla (ortalama yerine), mutlak fark 8 karakter (3 yerine). 8 karakterlik taban
-- tam da şikâyet edilen durumu kaçırıyordu: tek kelimelik çeldiricilerden yalnız 4-6
-- karakter uzun, iki kelimelik doğru cevap.
--
-- ÖLÇÜLEN ETKİ (uygulamadan önce simüle edildi, sahibi onayladı):
--   rekabetçi havuz 9.237 → 4.392 soru · "en uzun şıkkı seç" %63,3 → %27,5 (rastlantı %25)
--   Havuzun yarısı düşüyor; denetimden geçen ("onaylandi"/"duzeltildi") soru geri döner.
--   Doğru hamle soruyu atmak değil, ÇELDİRİCİLERİ doğru şıkla aynı biçime getirmektir
--   (araclar/soru_denetim › karar: 'duzelt'). 'kaldir' yalnız kurtarılamaz sorular için.
--
-- Veri silinmez. Eşikler koda gömülmez, oyun_ayarlari'ndan okunur.

-- ---------- Eşikler ----------
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('soru_uzun_sik_fark', '3'::jsonb, 'Doğru şık, yanlışların ortalamasından bu kadar karakterden fazla uzunsa işaret (oranla birlikte aranır)')
on conflict (anahtar) do nothing;

update public.oyun_ayarlari
   set deger = '1.4'::jsonb,
       aciklama = 'Doğru şık, YANLIŞ şıkların ORTALAMASININ bu katından uzunsa işaret (soru_uzun_sik_fark ile birlikte aranır)'
 where anahtar = 'soru_uzun_sik_oran';

-- ---------- Kelime sayısı yardımcısı ----------
-- soru_kelimeler() Türkçe karakterleri zaten normalize edip noktalamayı boşluğa çeviriyor;
-- burada yalnız boş olmayan kelimeler sayılır (boş metin 0 döner, 1 değil).
create or replace function public.soru_kelime_sayisi(p text)
 returns integer language sql immutable security definer set search_path to 'public'
as $$
  select coalesce((select count(*)::int from unnest(string_to_array(public.soru_kelimeler(p), ' ')) k where k <> ''), 0);
$$;

-- ---------- İşaret ağırlıkları ----------
-- dogru_en_uzun 1 → 2 ve yeni dogru_coklu_kelime = 2: tek başlarına rekabetçi havuzdan
-- çıkarmaya yetsinler (soru_rekabetci_haric_agirlik = 2). Eski hâlde `dogru_en_uzun`
-- 2.548 soruyu işaretliyor ama ağırlığı 1 olduğu için hiçbirini havuzdan düşürmüyordu.
create or replace function public.soru_isaret_agirligi(p_isaret text)
 returns smallint language sql immutable
as $$
  select (case p_isaret
    when 'sik_sayisi' then 3 when 'ayni_sik' then 3 when 'celiski' then 3 when 'ters_anahtar' then 3
    when 'cevap_sizmasi' then 2 when 'hepsi_hicbiri' then 2 when 'dusuk_dogruluk' then 2
    when 'dogru_en_uzun' then 2 when 'dogru_coklu_kelime' then 2
    when 'sayisal_uc' then 1 when 'yakin_varyant' then 1 when 'kategori_carpik' then 1
    else 1 end)::smallint;
$$;

-- ---------- Kural taraması ----------
create or replace function public.soru_kural_isaretleri(p_soru text, p_secenekler jsonb, p_dogru smallint)
 returns text[] language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_isaret text[] := '{}';
  v_sik text[];
  v_n int;
  v_dogru text;
  v_diger_ort numeric;
  v_dogru_uz int;
  v_dogru_kel int;
  v_diger_kel_max int;
  v_oran numeric := public.ayar_ondalik('soru_uzun_sik_oran', 1.4);
  v_fark numeric := public.ayar_ondalik('soru_uzun_sik_fark', 3);
  v_sayilar numeric[];
begin
  if p_secenekler is null or jsonb_typeof(p_secenekler) <> 'array' then return array['sik_sayisi']; end if;
  select array_agg(x order by o) into v_sik from jsonb_array_elements_text(p_secenekler) with ordinality e(x, o);
  v_n := coalesce(array_length(v_sik, 1), 0);
  if v_n <> 4 or p_dogru is null or p_dogru < 0 or p_dogru >= v_n then return array['sik_sayisi']; end if;
  v_dogru := v_sik[p_dogru + 1];
  v_dogru_uz := length(btrim(v_dogru));

  -- İki şık birebir ya da normalize edilince aynı
  if (select count(distinct public.soru_normalize(x)) from unnest(v_sik) x) < v_n then
    v_isaret := array_append(v_isaret, 'ayni_sik');
  end if;

  -- UZUNLUK DENGESİ (kalite.ts › uzunlukEleVeriyorMu ile aynı formül):
  -- doğru şık / yanlışların ortalaması > oran  VE  aradaki fark > fark karakteri.
  select avg(length(btrim(x))) into v_diger_ort
    from unnest(v_sik) with ordinality u(x, o) where o <> p_dogru + 1;
  if v_diger_ort is not null
     and v_dogru_uz > v_oran * greatest(v_diger_ort, 1)
     and v_dogru_uz - v_diger_ort > v_fark then
    v_isaret := array_append(v_isaret, 'dogru_en_uzun');
  end if;

  -- KELİME SAYISI: doğru şık her çeldiriciden daha çok kelimeli mi?
  -- Şikâyetin çekirdeği: çeldiriciler tek kelime, doğru cevap 2-3 kelime → soruyu
  -- okumadan seçilebiliyor. Eşik yok, karşılaştırma mutlak (kelime sayısı tam sayıdır).
  v_dogru_kel := public.soru_kelime_sayisi(v_dogru);
  select max(public.soru_kelime_sayisi(x)) into v_diger_kel_max
    from unnest(v_sik) with ordinality u(x, o) where o <> p_dogru + 1;
  if v_diger_kel_max is not null and v_dogru_kel > v_diger_kel_max then
    v_isaret := array_append(v_isaret, 'dogru_coklu_kelime');
  end if;

  -- Soru metninde doğru şık TAM KELİME olarak geçiyor (cevap sızıyor); başka şık da geçiyorsa sayılmaz.
  if length(public.soru_normalize(v_dogru)) >= 4
     and ' ' || public.soru_kelimeler(p_soru) || ' ' like '% ' || public.soru_kelimeler(v_dogru) || ' %'
     and not exists (select 1 from unnest(v_sik) with ordinality u(x, o)
                      where o <> p_dogru + 1 and length(public.soru_normalize(x)) >= 4
                        and ' ' || public.soru_kelimeler(p_soru) || ' ' like '% ' || public.soru_kelimeler(x) || ' %') then
    v_isaret := array_append(v_isaret, 'cevap_sizmasi');
  end if;

  -- "Hepsi" / "hiçbiri"
  if exists (select 1 from unnest(v_sik) x
              where ' ' || public.soru_kelimeler(x) || ' ' ~ ' (hiçbiri|hicbiri|yukarıdakilerin|all of the above|none of the above) '
                 or public.soru_kelimeler(x) in ('hepsi', 'tümü', 'hepsi doğru', 'ikisi de', 'hiçbiri')) then
    v_isaret := array_append(v_isaret, 'hepsi_hicbiri');
  end if;

  -- Şıklar sayısal ve doğru cevap uç değer (zayıf işaret)
  if (select bool_and(btrim(x) ~ '^-?[0-9]+([.,][0-9]+)?$') from unnest(v_sik) x) then
    select array_agg(replace(btrim(x), ',', '.')::numeric) into v_sayilar from unnest(v_sik) x;
    if replace(btrim(v_dogru), ',', '.')::numeric in ((select min(s) from unnest(v_sayilar) s), (select max(s) from unnest(v_sayilar) s)) then
      v_isaret := array_append(v_isaret, 'sayisal_uc');
    end if;
  end if;

  return v_isaret;
end $$;

grant execute on function public.soru_kelime_sayisi(text) to service_role;
revoke all on function public.soru_kelime_sayisi(text) from public, anon, authenticated;

-- ---------- Tüm havuzu yeniden tara ----------
-- Tetikleyici yalnız soru/secenekler/dogru_cevap değişince çalışır; kural değiştiği için
-- mevcut satırların işaretleri elle tazelenir.
update public.questions q
   set supheli_isaretler = s.isaret,
       supheli_agirlik = coalesce((select max(public.soru_isaret_agirligi(i)) from unnest(s.isaret) i), 0)
  from (select id, public.soru_kural_isaretleri(soru, secenekler, dogru_cevap) isaret from public.questions) s
 where s.id = q.id
   and (q.supheli_isaretler is distinct from s.isaret
        or q.supheli_agirlik is distinct from coalesce((select max(public.soru_isaret_agirligi(i)) from unnest(s.isaret) i), 0));
