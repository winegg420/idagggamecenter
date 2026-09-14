-- ============================================================
-- GİZLİ BOT GÖRÜNÜMÜ CİNSİYETE UYGUN
--
-- Revizyon Paketi 7, madde 2a: "Esra" gibi kadın isimli bot erkeksi
-- görünebiliyordu.
--
-- ÖLÇÜLEN KÖK SEBEP: botların 3B görünümü istemcideki KOLEKSIYON hash'inden
-- DEĞİL, sunucudaki `profiles.gorunum.avatar3d` kaydından geliyor (155 gizli
-- botun 155'inde kayıt var; hash yalnız kayıt yokken yedek). O kaydı üreten
-- `avatar3d_bot_gorunum_uret()` `cinsiyet`e hiç bakmıyordu: 73 kadın botun
-- 37'si sakallı, 41'i kısa saçlı/saçsızdı.
--
-- `cinsiyet` istemciye AÇILMADI (açılsaydı: gerçek oyuncuda boş, botta dolu →
-- botu ele verirdi). Karar tamamen sunucuda verilir.
--
-- YENİ DAĞILIM
--   kadın (k): uzun saç ağırlıklı (+ rasta), sakal YOK, yumuşak/ince/dengeli
--              yüz, küpe daha sık.
--   erkek (e) ve cinsiyetsiz: kısa/saçsız ağırlıklı (+ rasta, seyrek uzun),
--              sakal eskisi gibi olası, tüm yüz tipleri.
-- Diğer her şey (kıyafet, kostüm yasağı, takı oranları) 185'teki gibi.
-- ============================================================

create or replace function public.avatar3d_bot_gorunum_uret()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r record;
  v_tohum text;
  v_kadin boolean;
  v_tenler text[] := array['#f3d6bc','#e8b68e','#c58b62','#995f3c','#70442f','#422c25'];
  v_saclar text[] := array['#30211c','#141318','#cba44d','#9e4026','#ddd2c3'];
  v_ceket  text[] := array['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'];
  v_altr   text[] := array['#253341','#3a3f4a','#5a4632','#2f4a3a','#6b4a55','#1f2933'];
  v_aykr   text[] := array['#eee7d8','#2b2b30','#c04a34','#3a5a8c','#d9c27a','#8a8f98'];
  -- Cinsiyete göre saç ve yüz (Paket 7).
  v_sac_k  text[] := array['uzun','uzun','uzun','rasta'];
  v_sac_e  text[] := array['kisa','kisa','kisa','yok','rasta','uzun'];
  v_yuz_k  text[] := array['yumusak','ince','dengeli'];
  v_yuz_e  text[] := array['dengeli','yumusak','koseli','ince'];
  v_bas    text[] := array['yok','yok','kep','bere'];
  -- Gelinlik de yok: bot gelin gibi görünmesin (165'teki duvak kararıyla aynı).
  v_kiyafet text[] := array['tisort','tisort','ceket','atlet','gomlek'];
  -- Paket 7: gündelik yeni üstler (kostümler bilerek yok).
  v_kiy_yeni text[] := array['havai','cizgili','oduncu','polo','kapusonlu','kot','tisort_mavi','tisort_sari'];
  v_sakal  text[] := array['yok','yok','yok','biyik','keci','tam','favori'];
  v_ayk    text[] := array['spor','spor','bot','terlik','sandalet'];
  v_alt    text[] := array['pantolon','pantolon','pantolon','sort','kapri'];
  v_gzl    text[] := array['gunes','kare','yuvarlak','okuma','spor'];
  -- Takı cinsi: gümüş iki kat daha olası.
  v_taki   text[] := array['gumus','gumus','altin'];
  v_g jsonb;
  v_sayi int := 0;
begin
  for r in select id, takma_ad, cinsiyet from public.profiles where coalesce(is_bot, false) loop
    v_tohum := coalesce(r.takma_ad, r.id::text);
    v_kadin := r.cinsiyet = 'k';
    v_g := jsonb_build_object(
      'ten',       v_tenler[1 + (floor(public.bot_rasgele('3d_ten:'  || v_tohum) * 6))::int],
      'sacRenk',   v_saclar[1 + (floor(public.bot_rasgele('3d_sacr:' || v_tohum) * 5))::int],
      'ceketRenk', v_ceket [1 + (floor(public.bot_rasgele('3d_cekr:' || v_tohum) * 6))::int],
      'altRenk',   v_altr  [1 + (floor(public.bot_rasgele('3d_altr:' || v_tohum) * 6))::int],
      'ayakkabiRenk', v_aykr[1 + (floor(public.bot_rasgele('3d_aykr:'|| v_tohum) * 6))::int],
      'sac',       case when v_kadin
                        then v_sac_k[1 + (floor(public.bot_rasgele('3d_sac:' || v_tohum) * 4))::int]
                        else v_sac_e[1 + (floor(public.bot_rasgele('3d_sac:' || v_tohum) * 6))::int] end,
      'yuz',       case when v_kadin
                        then v_yuz_k[1 + (floor(public.bot_rasgele('3d_yuz:' || v_tohum) * 3))::int]
                        else v_yuz_e[1 + (floor(public.bot_rasgele('3d_yuz:' || v_tohum) * 4))::int] end,
      'bas',       v_bas   [1 + (floor(public.bot_rasgele('3d_bas:'  || v_tohum) * 4))::int],
      -- Botların yarısı yeni gündelik üstlerden birini giyer.
      'kiyafet',   case when public.bot_rasgele('3d_kiy2:' || v_tohum) < 0.5
                        then v_kiy_yeni[1 + (floor(public.bot_rasgele('3d_kiyy:' || v_tohum) * 8))::int]
                        else v_kiyafet[1 + (floor(public.bot_rasgele('3d_kiy:' || v_tohum) * 5))::int] end,
      -- Kadın botta sakal YOK.
      'sakal',     case when v_kadin then 'yok'
                        else v_sakal[1 + (floor(public.bot_rasgele('3d_skl:' || v_tohum) * 7))::int] end,
      'ayakkabi',  case when public.bot_rasgele('3d_ayk2:' || v_tohum) < 0.15
                        then 'tokyo'
                        else v_ayk[1 + (floor(public.bot_rasgele('3d_ayk:' || v_tohum) * 5))::int] end,
      'alt',       v_alt   [1 + (floor(public.bot_rasgele('3d_alt:'  || v_tohum) * 5))::int],
      -- Gözlük herkese takılmaz; takılana çeşitlerden biri düşer.
      'gozluk',    case when public.bot_rasgele('3d_gzl:' || v_tohum) > 0.72
                        then v_gzl[1 + (floor(public.bot_rasgele('3d_gzlt:' || v_tohum) * 5))::int]
                        else 'yok' end,
      -- Takılar seyrek: saat ~%22, kolye ~%10; küpe kadında ~%45, erkekte ~%10.
      'saat',      case when public.bot_rasgele('3d_saat:' || v_tohum) > 0.78
                        then v_taki[1 + (floor(public.bot_rasgele('3d_saatt:' || v_tohum) * 3))::int]
                        else 'yok' end,
      'kolye',     case when public.bot_rasgele('3d_kly:' || v_tohum) > 0.9
                        then v_taki[1 + (floor(public.bot_rasgele('3d_klyt:' || v_tohum) * 3))::int]
                        else 'yok' end,
      'kupe',      case when public.bot_rasgele('3d_kupe:' || v_tohum) > (case when v_kadin then 0.55 else 0.9 end)
                        then v_taki[1 + (floor(public.bot_rasgele('3d_kupet:' || v_tohum) * 3))::int]
                        else 'yok' end,
      'pelerin',   'yok'
    );
    v_g := v_g || jsonb_build_object('ceket', v_g->>'kiyafet' = 'ceket');

    update public.profiles
       set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('avatar3d', v_g)
     where id = r.id;
    v_sayi := v_sayi + 1;
  end loop;
  return v_sayi;
end;
$fn$;

revoke all on function public.avatar3d_bot_gorunum_uret() from public, authenticated, anon;

select public.avatar3d_bot_gorunum_uret();
