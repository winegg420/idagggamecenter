-- ============================================================
-- YENİ EKİPMAN — GÖZLÜK ÇEŞİTLERİ, SAKAL, AYAKKABI, ALT GİYİM,
-- ATLET/GÖMLEK
--
-- Sahibinin isteği (Revizyon Paketi 5, madde 2): gözlük tek tip değil
-- birkaç çeşit; sakal/bıyık; ayakkabı ve terlik; şort; atlet/gömlek/tişört.
--
-- ÖNCEKİ DURUM: `avatar3d_parcalar.yuva` yalnız 5 değer kabul ediyordu
-- (sac, kiyafet, bas, gozluk, pelerin) ve `gozluk`/`pelerin` MANTIKSAL
-- (true/false) değerdi — tek çeşit taşıyabiliyordu.
--
-- YENİ DURUM: üç yeni yuva (sakal, ayakkabi, alt) + gözlük ve pelerin
-- METİN değere çevrildi.
--
-- ESKİ KAYITLI GÖRÜNÜMLER BOZULMUYOR: aşağıda hem katalogdaki hem
-- `profiles.gorunum->'avatar3d'` içindeki `true` değerleri somut id'ye
-- taşınıyor (gozluk true -> "gunes", pelerin true -> "klasik"),
-- `false` -> "yok". `avatar3d_dogrula` da eski mantıksal değeri hâlâ
-- kabul edip çeviriyor (istemcinin eski sürümü açık kalmış olabilir).
--
-- `is_bot` istemciye sızmaz: burada yalnız katalog ve görünüm alanları
-- değişiyor, istemciye giden hiçbir cevaba bot bayrağı eklenmiyor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) YUVA KISITINI GENİŞLET
-- ------------------------------------------------------------
alter table public.avatar3d_parcalar
  drop constraint if exists avatar3d_parcalar_yuva_check;
alter table public.avatar3d_parcalar
  add constraint avatar3d_parcalar_yuva_check
  check (yuva in ('sac','kiyafet','alt','ayakkabi','bas','gozluk','sakal','pelerin'));

-- ------------------------------------------------------------
-- 2) MANTIKSAL -> METİN (katalog)
-- ------------------------------------------------------------
update public.avatar3d_parcalar
   set deger = '"gunes"'::jsonb
 where yuva = 'gozluk' and deger = 'true'::jsonb;

update public.avatar3d_parcalar
   set deger = '"klasik"'::jsonb
 where yuva = 'pelerin' and deger = 'true'::jsonb;

-- ------------------------------------------------------------
-- 3) MANTIKSAL -> METİN (kayıtlı görünümler)
-- Oyuncular VE botlar. Dokunulmayan alan kalmıyor; eksik yeni yuvalara
-- varsayılan yazılıyor ki istemci ilk açılışta çıplak ayak çizmesin.
-- ------------------------------------------------------------
update public.profiles
   set gorunum = jsonb_set(
         gorunum, '{avatar3d}',
         (gorunum->'avatar3d')
         || jsonb_build_object(
              'gozluk',  case
                           when gorunum->'avatar3d'->'gozluk' = 'true'::jsonb  then '"gunes"'::jsonb
                           when gorunum->'avatar3d'->'gozluk' = 'false'::jsonb then '"yok"'::jsonb
                           when jsonb_typeof(gorunum->'avatar3d'->'gozluk') = 'string'
                             then gorunum->'avatar3d'->'gozluk'
                           else '"yok"'::jsonb
                         end,
              'pelerin', case
                           when gorunum->'avatar3d'->'pelerin' = 'true'::jsonb  then '"klasik"'::jsonb
                           when gorunum->'avatar3d'->'pelerin' = 'false'::jsonb then '"yok"'::jsonb
                           when jsonb_typeof(gorunum->'avatar3d'->'pelerin') = 'string'
                             then gorunum->'avatar3d'->'pelerin'
                           else '"yok"'::jsonb
                         end,
              'sakal',    coalesce(gorunum->'avatar3d'->'sakal',    '"yok"'::jsonb),
              'ayakkabi', coalesce(gorunum->'avatar3d'->'ayakkabi', '"spor"'::jsonb),
              'alt',      coalesce(gorunum->'avatar3d'->'alt',      '"pantolon"'::jsonb)
            ))
 where gorunum ? 'avatar3d'
   and jsonb_typeof(gorunum->'avatar3d') = 'object';

-- ------------------------------------------------------------
-- 4) YENİ KATALOG SATIRLARI
-- Fiyatlar ucuzdan pahalıya. Yuvanın varsayılanı (tişört, pantolon,
-- spor ayakkabı) 0 = ücretsiz; yoksa yeni oyuncu giyinemez.
-- Etkinlik eşyası EKLENMİYOR: taç ve pelerin turnuva ödülü olarak kalır,
-- pelerinin kısa varyantı bilerek satışa çıkarılmadı.
-- id ve değerler bildim/avatar3d/envanter.js › PARCALAR ile birebir aynı.
-- ------------------------------------------------------------
insert into public.avatar3d_parcalar (id, ad, yuva, deger, coin_fiyat, nadirlik, sira)
values
  ('ust_atlet',      'Atlet',            'kiyafet',  '"atlet"'::jsonb,     300,  'sirali', 4),
  ('ust_gomlek',     'Gömlek',           'kiyafet',  '"gomlek"'::jsonb,    800,  'sirali', 5),

  ('alt_pantolon',   'Pantolon',         'alt',      '"pantolon"'::jsonb,  0,    'sirali', 1),
  ('alt_sort',       'Şort',             'alt',      '"sort"'::jsonb,      250,  'sirali', 2),
  ('alt_kapri',      'Kapri',            'alt',      '"kapri"'::jsonb,     300,  'sirali', 3),

  ('ayak_spor',      'Spor ayakkabı',    'ayakkabi', '"spor"'::jsonb,      0,    'sirali', 1),
  ('ayak_terlik',    'Terlik',           'ayakkabi', '"terlik"'::jsonb,    200,  'sirali', 2),
  ('ayak_sandalet',  'Sandalet',         'ayakkabi', '"sandalet"'::jsonb,  250,  'sirali', 3),
  ('ayak_bot',       'Bot',              'ayakkabi', '"bot"'::jsonb,       500,  'sirali', 4),

  ('sakal_biyik',    'Bıyık',            'sakal',    '"biyik"'::jsonb,     300,  'sirali', 1),
  ('sakal_keci',     'Keçi sakalı',      'sakal',    '"keci"'::jsonb,      350,  'sirali', 2),
  ('sakal_favori',   'Favori',           'sakal',    '"favori"'::jsonb,    350,  'sirali', 3),
  ('sakal_tam',      'Tam sakal',        'sakal',    '"tam"'::jsonb,       450,  'sirali', 4),

  ('goz_kare',       'Kare gözlük',      'gozluk',   '"kare"'::jsonb,      350,  'sirali', 2),
  ('goz_okuma',      'Okuma gözlüğü',    'gozluk',   '"okuma"'::jsonb,     400,  'sirali', 3),
  ('goz_yuvarlak',   'Yuvarlak gözlük',  'gozluk',   '"yuvarlak"'::jsonb,  400,  'sirali', 4),
  ('goz_spor',       'Spor gözlük',      'gozluk',   '"spor"'::jsonb,      550,  'sirali', 5)
on conflict (id) do update set
  ad = excluded.ad, yuva = excluded.yuva, deger = excluded.deger,
  coin_fiyat = excluded.coin_fiyat, nadirlik = excluded.nadirlik, sira = excluded.sira;

-- Ücretsiz yuva temelleri herkeste olsun (botlar dahil), yoksa sunucu
-- doğrulaması "bu parçaya sahip değilsin" der.
insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
select pr.id, p.id, 'baslangic'
  from public.profiles pr
 cross join public.avatar3d_parcalar p
 where p.aktif and p.coin_fiyat = 0
on conflict do nothing;

-- ------------------------------------------------------------
-- 5) DOĞRULAMA — yeni yuvalar + eski mantıksal değere geriye uyum
-- ------------------------------------------------------------
create or replace function public.avatar3d_dogrula(p_user uuid, p_gorunum jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_g      jsonb := coalesce(p_gorunum, '{}'::jsonb);
  v_temiz  jsonb;
  r        record;
  v_deger  jsonb;
  v_renk   text := '^#[0-9a-fA-F]{6}$';
  v_gozluk text;
  v_pel    text;
begin
  if p_user is null then raise exception 'Giriş gerekli'; end if;

  -- Eski istemci hâlâ true/false gönderebilir: somut id'ye çevrilir.
  v_gozluk := case
                when v_g->'gozluk' = 'true'::jsonb  then 'gunes'
                when v_g->'gozluk' = 'false'::jsonb then 'yok'
                when v_g->>'gozluk' in ('yok','gunes','kare','yuvarlak','okuma','spor')
                  then v_g->>'gozluk'
                else 'yok'
              end;
  v_pel := case
             when v_g->'pelerin' = 'true'::jsonb  then 'klasik'
             when v_g->'pelerin' = 'false'::jsonb then 'yok'
             when v_g->>'pelerin' in ('yok','klasik','kisa') then v_g->>'pelerin'
             else 'yok'
           end;

  -- Yalnız bilinen alanlar geçer; fazlası atılır (model.js ayarDogrula ile
  -- aynı sözleşme).
  v_temiz := jsonb_build_object(
    'ten',         case when v_g->>'ten'         ~ v_renk then v_g->>'ten'         else '#c58b62' end,
    'sacRenk',     case when v_g->>'sacRenk'     ~ v_renk then v_g->>'sacRenk'     else '#30211c' end,
    'ceketRenk',   case when v_g->>'ceketRenk'   ~ v_renk then v_g->>'ceketRenk'   else '#be542d' end,
    'altRenk',     case when v_g->>'altRenk'     ~ v_renk then v_g->>'altRenk'     else '#253341' end,
    'ayakkabiRenk',case when v_g->>'ayakkabiRenk'~ v_renk then v_g->>'ayakkabiRenk'else '#eee7d8' end,
    'yuz',       case when v_g->>'yuz' in ('dengeli','yumusak','koseli','ince')
                      then v_g->>'yuz' else 'dengeli' end,
    'sac',       case when v_g->>'sac' in ('yok','kisa','uzun','rasta') then v_g->>'sac' else 'kisa' end,
    'bas',       case when v_g->>'bas' in ('yok','kep','bere','tac','duvak') then v_g->>'bas' else 'yok' end,
    'kiyafet',   case when v_g->>'kiyafet' in ('ceket','tisort','gelinlik','atlet','gomlek')
                      then v_g->>'kiyafet' else 'tisort' end,
    'sakal',     case when v_g->>'sakal' in ('yok','tam','keci','biyik','favori')
                      then v_g->>'sakal' else 'yok' end,
    'ayakkabi',  case when v_g->>'ayakkabi' in ('spor','terlik','bot','sandalet')
                      then v_g->>'ayakkabi' else 'spor' end,
    'alt',       case when v_g->>'alt' in ('pantolon','sort','kapri')
                      then v_g->>'alt' else 'pantolon' end,
    'gozluk',    to_jsonb(v_gozluk),
    'pelerin',   to_jsonb(v_pel)
  );
  -- `ceket` türetilmiş alan: model.js kiyafet'ten üretiyor, burada da öyle.
  v_temiz := v_temiz || jsonb_build_object('ceket', v_temiz->>'kiyafet' = 'ceket');

  -- SAHİPLİK: temizlenmiş görünümdeki her yuva değeri için parça aranır.
  for r in select id, yuva, deger from public.avatar3d_parcalar where aktif loop
    v_deger := v_temiz -> r.yuva;
    if v_deger is not null and v_deger = r.deger then
      if not exists (
        select 1 from public.avatar3d_sahip s
         where s.oyuncu_id = p_user and s.parca_id = r.id
      ) then
        raise exception 'Bu parçaya sahip değilsin: %', r.id;
      end if;
    end if;
  end loop;

  return v_temiz;
end;
$fn$;

revoke all on function public.avatar3d_dogrula(uuid, jsonb) from public, authenticated, anon;

-- ------------------------------------------------------------
-- 6) BOT GÖRÜNÜMÜ — yeni parçalar evet, ETKİNLİK EŞYASI HAYIR
-- Taç, duvak ve pelerin listelerde YOK (migration 165'teki karar korundu).
-- ------------------------------------------------------------
create or replace function public.avatar3d_bot_gorunum_uret()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_tohum text;
  v_tenler text[] := array['#f3d6bc','#e8b68e','#c58b62','#995f3c','#70442f','#422c25'];
  v_saclar text[] := array['#30211c','#141318','#cba44d','#9e4026','#ddd2c3'];
  v_ceket  text[] := array['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'];
  v_altr   text[] := array['#253341','#3a3f4a','#5a4632','#2f4a3a','#6b4a55','#1f2933'];
  v_aykr   text[] := array['#eee7d8','#2b2b30','#c04a34','#3a5a8c','#d9c27a','#8a8f98'];
  v_sac    text[] := array['kisa','uzun','rasta','yok'];
  v_yuz    text[] := array['dengeli','yumusak','koseli','ince'];
  v_bas    text[] := array['yok','yok','kep','bere'];
  -- Gelinlik de yok: bot gelin gibi görünmesin (165'teki duvak kararıyla aynı).
  v_kiyafet text[] := array['tisort','tisort','ceket','atlet','gomlek'];
  v_sakal  text[] := array['yok','yok','yok','biyik','keci','tam','favori'];
  v_ayk    text[] := array['spor','spor','bot','terlik','sandalet'];
  v_alt    text[] := array['pantolon','pantolon','pantolon','sort','kapri'];
  v_gzl    text[] := array['gunes','kare','yuvarlak','okuma','spor'];
  v_g jsonb;
  v_sayi int := 0;
begin
  for r in select id, takma_ad from public.profiles where coalesce(is_bot, false) loop
    v_tohum := coalesce(r.takma_ad, r.id::text);
    v_g := jsonb_build_object(
      'ten',       v_tenler[1 + (floor(public.bot_rasgele('3d_ten:'  || v_tohum) * 6))::int],
      'sacRenk',   v_saclar[1 + (floor(public.bot_rasgele('3d_sacr:' || v_tohum) * 5))::int],
      'ceketRenk', v_ceket [1 + (floor(public.bot_rasgele('3d_cekr:' || v_tohum) * 6))::int],
      'altRenk',   v_altr  [1 + (floor(public.bot_rasgele('3d_altr:' || v_tohum) * 6))::int],
      'ayakkabiRenk', v_aykr[1 + (floor(public.bot_rasgele('3d_aykr:'|| v_tohum) * 6))::int],
      'sac',       v_sac   [1 + (floor(public.bot_rasgele('3d_sac:'  || v_tohum) * 4))::int],
      'yuz',       v_yuz   [1 + (floor(public.bot_rasgele('3d_yuz:'  || v_tohum) * 4))::int],
      'bas',       v_bas   [1 + (floor(public.bot_rasgele('3d_bas:'  || v_tohum) * 4))::int],
      'kiyafet',   v_kiyafet[1 + (floor(public.bot_rasgele('3d_kiy:' || v_tohum) * 5))::int],
      'sakal',     v_sakal [1 + (floor(public.bot_rasgele('3d_skl:'  || v_tohum) * 7))::int],
      'ayakkabi',  v_ayk   [1 + (floor(public.bot_rasgele('3d_ayk:'  || v_tohum) * 5))::int],
      'alt',       v_alt   [1 + (floor(public.bot_rasgele('3d_alt:'  || v_tohum) * 5))::int],
      -- Gözlük herkese takılmaz; takılana çeşitlerden biri düşer.
      'gozluk',    case when public.bot_rasgele('3d_gzl:' || v_tohum) > 0.72
                        then v_gzl[1 + (floor(public.bot_rasgele('3d_gzlt:' || v_tohum) * 5))::int]
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
