-- ============================================================
-- RASTGELE BAŞLANGIÇ — TAKILMA DÜZELTMESİ
--
-- `avatar3d_rastgele_baslangic` görünümü ZATEN OLAN oyuncuda erken
-- dönüyordu ve `avatar_onayli` bayrağına dokunmuyordu. Sonuç: karakteri
-- olduğu hâlde bayrağı düşük kalan oyuncuda kurulum sihirbazı 2. adımda
-- sonsuza kadar takılıyordu (ölçüldü: düğmeye basılıyor, adım değişmiyor).
--
-- Artık görünüm varsa ona dokunulmaz ama bayrak her hâlükârda kaldırılır:
-- karakteri olan biri kurulumda tutulmaz.
-- ============================================================

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

  -- Görünümü olan oyuncuda görünüm KORUNUR, yalnız bayrak kaldırılır.
  if v_var is not null then
    update public.profiles set avatar_onayli = true where id = v_me;
    return v_var;
  end if;

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
