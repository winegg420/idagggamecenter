-- ============================================================
-- OYUN İÇİNDE İSİM VE ŞEHİR DEĞİŞTİRME (9 Eylül 2026)
--
-- Sorun: her ikisi de Profil sayfasında vardı ama pratikte kullanılamıyordu.
--  - Takma ad kilidi **30 gün**: canlı testte hesapta "29 gün 1 saat kaldı"
--    yazıyordu; oyuncu adını değiştiremiyordu.
--  - Konum kilidi **7 gün**.
--
-- Karar: kilitler kimlik istikrarı ve lig sömürüsü için var, tamamen
-- kaldırılmıyor; ikisi de **24 saate** indiriliyor. 24 saat, adını sürekli
-- değiştirip başkasını taklit etmeyi ve haftalık ligde şehir zıplamayı
-- caydırmaya yetiyor, ama oyuncuyu bir ay boyunca hapsetmiyor.
--
-- Doğrulama, benzersizlik, yasaklı kelime ve şehir listesi kuralları AYNEN
-- korundu; yalnız kilit penceresi ve hata metni değişti.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Takma ad: 30 gün -> 24 saat
-- ------------------------------------------------------------
create or replace function public.takma_ad_sec(p_ad text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad text;
  v_p public.profiles%rowtype;
  v_kalan interval;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_ad := btrim(coalesce(p_ad, ''));

  if length(v_ad) < 3 or length(v_ad) > 16 then
    raise exception 'Takma ad 3-16 karakter olmalı.';
  end if;
  -- Harf (Türkçe dahil), rakam ve alt çizgi
  if v_ad !~ '^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]+$' then
    raise exception 'Takma adda yalnız harf, rakam ve alt çizgi kullanabilirsin.';
  end if;
  if v_ad ~ '^[0-9_]+$' then
    raise exception 'Takma ad en az bir harf içermeli.';
  end if;

  if exists (
    select 1 from public.yasakli_kelimeler y
    where lower(v_ad) like '%' || y.kelime || '%'
  ) then
    raise exception 'Bu takma ad kullanılamaz. Başka bir tane dene.';
  end if;

  select * into v_p from public.profiles where id = auth.uid();
  if not found then raise exception 'Profil bulunamadı'; end if;

  -- Aynı adı tekrar göndermek kilidi harcamasın
  if v_p.takma_ad_secildi and lower(coalesce(v_p.takma_ad, '')) = lower(v_ad) then
    return;
  end if;

  -- KİLİT: 30 gün -> 24 saat
  if v_p.takma_ad_secildi
     and v_p.takma_ad_degisti_at is not null
     and v_p.takma_ad_degisti_at > now() - interval '24 hours'
  then
    v_kalan := (v_p.takma_ad_degisti_at + interval '24 hours') - now();
    raise exception 'Takma adını günde bir kez değiştirebilirsin. Kalan: % saat % dakika',
      extract(hour from v_kalan)::int, extract(minute from v_kalan)::int;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.takma_ad) = lower(v_ad) and p.id <> auth.uid()
  ) then
    raise exception 'Bu takma ad alınmış. Başka bir tane dene.';
  end if;

  begin
    update public.profiles
       set takma_ad = v_ad,
           takma_ad_secildi = true,
           takma_ad_degisti_at = now()
     where id = auth.uid();
  exception when unique_violation then
    raise exception 'Bu takma ad alınmış. Başka bir tane dene.';
  end;
end;
$$;

revoke execute on function public.takma_ad_sec(text) from public, anon;
grant execute on function public.takma_ad_sec(text) to authenticated;

-- ------------------------------------------------------------
-- 2) Konum (şehir/ülke): 7 gün -> 24 saat
-- ------------------------------------------------------------
create or replace function public.profil_konum_kaydet(p_ulke text, p_sehir text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ulke text;
  v_sehir text;
  v_son timestamptz;
  v_mevcut_ulke text;
  v_kalan interval;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_ulke := upper(nullif(btrim(coalesce(p_ulke, '')), ''));
  v_sehir := nullif(btrim(coalesce(p_sehir, '')), '');

  if v_ulke is null then raise exception 'Ülke seçmelisin'; end if;
  if not exists (select 1 from public.ulkeler u where u.kod = v_ulke) then
    raise exception 'Geçersiz ülke kodu';
  end if;

  -- O ülkenin şehir listesi varsa (şu an yalnızca TR) listeden seçim zorunlu,
  -- yoksa serbest metin (kısıtlı uzunluk).
  if exists (select 1 from public.sehirler s where s.ulke = v_ulke) then
    if v_sehir is null
       or not exists (select 1 from public.sehirler s where s.ulke = v_ulke and s.ad = v_sehir)
    then
      raise exception 'Geçersiz şehir';
    end if;
  else
    if v_sehir is null or length(v_sehir) < 2 or length(v_sehir) > 40 then
      raise exception 'Şehir adı 2-40 karakter olmalı';
    end if;
  end if;

  select p.konum_degisti_at, p.ulke into v_son, v_mevcut_ulke
  from public.profiles p where p.id = auth.uid();

  -- Aynı değerler tekrar gönderildiyse sessizce geç (kilidi harcama)
  if v_mevcut_ulke is not null
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.ulke = v_ulke and p.sehir is not distinct from v_sehir
     )
  then
    return;
  end if;

  -- KİLİT: 7 gün -> 24 saat
  if v_son is not null and v_son > now() - interval '24 hours' then
    v_kalan := (v_son + interval '24 hours') - now();
    raise exception 'Konumunu günde bir kez değiştirebilirsin. Kalan: % saat % dakika',
      extract(hour from v_kalan)::int, extract(minute from v_kalan)::int;
  end if;

  update public.profiles
     set ulke = v_ulke,
         sehir = v_sehir,
         konum_degisti_at = now()
   where id = auth.uid();
end;
$$;

revoke execute on function public.profil_konum_kaydet(text, text) from public, anon;
grant execute on function public.profil_konum_kaydet(text, text) to authenticated;
