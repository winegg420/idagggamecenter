-- ============================================================
-- KURULUM: "AVATARINI SEÇ" YERİNE "KARAKTERİNİ OLUŞTUR"
--
-- İlk girişteki 31 düz SVG ikonluk avatar adımı kalktı; yerine oyuncu
-- gardıroba gidip karakterini kuruyor. Sihirbazın 2. adımı hâlâ
-- `profiles.avatar_onayli` bayrağına bakıyor, o yüzden:
--
--   • 3B görünüm kaydedilince `avatar_onayli` da true olur — oyuncu
--     gardıroptan dönünce sihirbaz 3. adıma geçer.
--   • Sihirbazı atlayan oyuncu engellenmesin diye rastgele bir başlangıç
--     görünümü veren RPC eklendi (yalnız ÜCRETSİZ parçalardan kurulur;
--     etkinlik parçası asla verilmez).
--
-- `avatar_onayla` (Google fotoğrafı / hazır SVG) BOZULMADI, duruyor.
-- ============================================================

-- ------------------------------------------------------------
-- Görünüm kaydedince avatar adımı da tamamlanmış sayılır
-- ------------------------------------------------------------
create or replace function public.avatar3d_gorunum_kaydet(p_gorunum jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_temiz jsonb;
  v_sonuc jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('avatar3d_gorunum_kaydet', 30, interval '60 seconds');

  v_temiz := public.avatar3d_dogrula(v_me, p_gorunum);

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('avatar3d', v_temiz),
         -- Karakterini kuran oyuncu için kurulum sihirbazının avatar adımı biter.
         avatar_onayli = true
   where id = v_me
  returning gorunum -> 'avatar3d' into v_sonuc;

  return v_sonuc;
end;
$fn$;

grant execute on function public.avatar3d_gorunum_kaydet(jsonb) to authenticated;

-- ------------------------------------------------------------
-- RASTGELE BAŞLANGIÇ GÖRÜNÜMÜ — sihirbazı atlayan engellenmesin
-- Yalnız ücretsiz parçalardan kurulur: saç 'kisa', kıyafet 'tisort',
-- baş 'yok'. Ten/saç/ceket rengi ve yüz biçimi zaten ücretsiz.
-- Zaten görünümü olan oyuncuda hiçbir şey değiştirmez.
-- ------------------------------------------------------------
create or replace function public.avatar3d_rastgele_baslangic()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_tenler text[] := array['#f3d6bc','#e8b68e','#c58b62','#995f3c','#70442f','#422c25'];
  v_saclar text[] := array['#30211c','#141318','#cba44d','#9e4026','#ddd2c3'];
  v_ceket  text[] := array['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'];
  v_yuz    text[] := array['dengeli','yumusak','koseli','ince'];
  v_g jsonb;
  v_var jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select gorunum -> 'avatar3d' into v_var from public.profiles where id = v_me;
  if v_var is not null then return v_var; end if;

  perform public.avatar3d_ucretsizleri_ver(v_me);

  v_g := jsonb_build_object(
    'ten',       v_tenler[1 + floor(random() * 6)::int],
    'sacRenk',   v_saclar[1 + floor(random() * 5)::int],
    'ceketRenk', v_ceket [1 + floor(random() * 6)::int],
    'yuz',       v_yuz   [1 + floor(random() * 4)::int],
    'sac',       'kisa',
    'bas',       'yok',
    'kiyafet',   'tisort',
    'gozluk',    false,
    'pelerin',   false,
    'ceket',     false
  );

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('avatar3d', v_g),
         avatar_onayli = true
   where id = v_me;

  return v_g;
end;
$fn$;

grant execute on function public.avatar3d_rastgele_baslangic() to authenticated;
