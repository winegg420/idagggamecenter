-- ============================================================
-- 200 — HIZLI MOD: soru başına 5 sn → 10 sn, oturum 60 sn → 90 sn (Paket 14 aşama 2)
--
-- Süreler ve okuma yükü tavanı artık koda gömülü değil, oyun_ayarlari'nda:
--   hizli_mod_sure_sn = 90, hizli_mod_soru_sure_sn = 10 → en çok 9 soru
--   hizli_mod_okuma_tavani = 170 (eski 110; 10 sn'de 170 karakter rahat okunur)
-- Ölçüm (16 Eyl 2026, aktif + zorluk>=2): 170 tavanıyla en küçük havuz
-- TR 761 (spor), EN 476 (tarih) — hiçbir kategori 300'ün altında değil.
-- Fonksiyonlar canlıdaki son tanımlarından (123/163/116/147/105) alınıp
-- yalnız sabitler değiştirildi.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('hizli_mod_sure_sn', '90', 'Hızlı Mod oturum süresi (sn)'),
  ('hizli_mod_soru_sure_sn', '10', 'Hızlı Mod soru başına süre (sn)'),
  ('hizli_mod_okuma_tavani', '170', 'Hızlı Mod okuma yükü tavanı: soru + şıklar toplam karakter')
on conflict (anahtar) do nothing;

CREATE OR REPLACE FUNCTION public.hizli_mod_baslat(p_kategori text DEFAULT NULL::text)
 RETURNS TABLE(oturum_id uuid, soru_sayisi integer, sure_sn integer, soru_sure_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Okuma yükü tavanı (soru metni + şıkların toplam karakteri): soru başına
  -- verilen süreye sığsın diye var. Değerler oyun_ayarlari'nda (migration 200).
  v_max_okuma int := public.ayar_sayi('hizli_mod_okuma_tavani', 170)::int;
  v_sure int := public.ayar_sayi('hizli_mod_sure_sn', 90)::int;
  v_soru_sure int := public.ayar_sayi('hizli_mod_soru_sure_sn', 10)::int;
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

  -- 90 sn / 10 sn = en çok 9 soru; yedekle birlikte 25 çekilir.
  -- Son parametre: soru süresine sığmayan uzun sorular elenir.
  v_ids := public.soru_sec(v_kat, 25, array[v_me], null, v_max_okuma);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Bu kategoride soru bulunamadı';
  end if;

  insert into public.hizli_mod_oturumlar (user_id, kategori, soru_ids)
  values (v_me, v_kat, v_ids)
  returning id into v_id;

  return query select v_id, coalesce(array_length(v_ids, 1), 0), v_sure, v_soru_sure;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hizli_mod_soru(p_oturum_id uuid)
 RETURNS TABLE(question_id uuid, soru text, secenekler jsonb, soru_index integer, baslangic timestamp with time zone, sunucu_zamani timestamp with time zone, kalan_toplam_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_kalan int;
  v_soru_id uuid;
  v_sure int := public.ayar_sayi('hizli_mod_sure_sn', 90)::int;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;

  v_kalan := greatest(0, v_sure - floor(extract(epoch from (now() - o.baslangic)))::int);
  if v_kalan <= 0 then
    perform public.hizli_mod_bitir(p_oturum_id);
    raise exception 'Süre doldu';
  end if;

  v_soru_id := o.soru_ids[o.aktif_soru + 1];
  perform public.gorulen_kaydet(v_soru_id);

  return query
    select v_soru_id, sd.soru, sd.secenekler, o.aktif_soru, o.soru_baslangic, now(), v_kalan
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
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
  v_sure int := public.ayar_sayi('hizli_mod_sure_sn', 90)::int;
  v_soru_sure int := public.ayar_sayi('hizli_mod_soru_sure_sn', 10)::int;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_cevap', 60, interval '60 seconds');
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  v_kalan := greatest(0, v_sure - floor(extract(epoch from (now() - o.baslangic)))::int);

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];

  -- Soru başına süre + 1 sn ağ payı; süre geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + make_interval(secs => v_soru_sure + 1) then
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
