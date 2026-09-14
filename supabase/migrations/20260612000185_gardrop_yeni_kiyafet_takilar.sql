-- ============================================================
-- GARDIROP — YENİ ÜST GİYİMLER, KOSTÜMLER, AYAKKABILAR, TAKILAR
--
-- Sahibinin isteği (birebir): "Yeni gömlek, t-shirtler istiyorum
-- gardıroba. Havai gömleği renkli. Çeşitlendir giysileri, farklı renkler
-- olsun. Şeytan kostümü yarat bir tane. Damatlık yarat. Tokyo terlik ekle.
-- Topuklu ayakkabı ekle. Altın kolye, saat, küpe bunları da ekle."
--
-- YENİ DEĞERLER (bildim/avatar3d/model.js › YUVA_DEGERLERI ile birebir):
--   kiyafet  : havai, cizgili, oduncu, polo, kapusonlu, kot,
--              tisort_mavi, tisort_sari, seytan, damatlik
--   bas      : boynuz
--   ayakkabi : tokyo, topuklu
-- YENİ YUVALAR (birbirinden bağımsız takılır, boş hâli 'yok'):
--   kolye, saat, kupe  → değerler: yok | altin | gumus
--
-- Etkinlik eşyası YOK: hepsi satılır. Coin 0 parça YOK: sahiplik dağıtımı
-- gerekmez. Bedava test dönemi anahtarına dokunulmadı.
--
-- `is_bot` istemciye sızmaz: yalnız katalog, doğrulama ve bot görünüm
-- üreticisi değişiyor; istemciye giden hiçbir cevaba bot bayrağı eklenmiyor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) YUVA KISITINI GENİŞLET
-- ------------------------------------------------------------
alter table public.avatar3d_parcalar
  drop constraint if exists avatar3d_parcalar_yuva_check;
alter table public.avatar3d_parcalar
  add constraint avatar3d_parcalar_yuva_check
  check (yuva in ('sac','kiyafet','alt','ayakkabi','bas','gozluk','sakal','pelerin',
                  'kolye','saat','kupe'));

-- ------------------------------------------------------------
-- 2) YENİ KATALOG SATIRLARI
-- Ekonomi: sıradan 300–600, özel 1.200–2.500. Kostümler ve altın takılar
-- özel; gümüş takılar ve gündelik üstler sıradan.
-- id ve değerler bildim/avatar3d/envanter.js › PARCALAR ile birebir aynı.
-- ------------------------------------------------------------
insert into public.avatar3d_parcalar (id, ad, yuva, deger, coin_fiyat, nadirlik, sira)
values
  ('ust_tisort_mavi', 'Mavi tişört',          'kiyafet',  '"tisort_mavi"'::jsonb, 300,  'sirali', 6),
  ('ust_tisort_sari', 'Sarı tişört',          'kiyafet',  '"tisort_sari"'::jsonb, 300,  'sirali', 7),
  ('ust_cizgili',     'Çizgili tişört',       'kiyafet',  '"cizgili"'::jsonb,     350,  'sirali', 8),
  ('ust_polo',        'Polo tişört',          'kiyafet',  '"polo"'::jsonb,        400,  'sirali', 9),
  ('ust_kot',         'Kot gömlek',           'kiyafet',  '"kot"'::jsonb,         450,  'sirali', 10),
  ('ust_oduncu',      'Oduncu gömleği',       'kiyafet',  '"oduncu"'::jsonb,      500,  'sirali', 11),
  ('ust_havai',       'Havai gömleği',        'kiyafet',  '"havai"'::jsonb,       550,  'sirali', 12),
  ('ust_kapusonlu',   'Kapüşonlu sweatshirt', 'kiyafet',  '"kapusonlu"'::jsonb,   600,  'sirali', 13),
  ('ust_seytan',      'Şeytan kostümü',       'kiyafet',  '"seytan"'::jsonb,      1800, 'ozel',   14),
  ('ust_damatlik',    'Damatlık',             'kiyafet',  '"damatlik"'::jsonb,    2200, 'ozel',   15),

  ('bas_boynuz',      'Şeytan boynuzu',       'bas',      '"boynuz"'::jsonb,      600,  'sirali', 5),

  ('ayak_tokyo',      'Tokyo terlik',         'ayakkabi', '"tokyo"'::jsonb,       300,  'sirali', 5),
  ('ayak_topuklu',    'Topuklu ayakkabı',     'ayakkabi', '"topuklu"'::jsonb,     550,  'sirali', 6),

  ('kupe_gumus',      'Gümüş küpe',           'kupe',     '"gumus"'::jsonb,       400,  'sirali', 1),
  ('kupe_altin',      'Altın küpe',           'kupe',     '"altin"'::jsonb,       1200, 'ozel',   2),
  ('kolye_gumus',     'Gümüş kolye',          'kolye',    '"gumus"'::jsonb,       500,  'sirali', 1),
  ('kolye_altin',     'Altın kolye',          'kolye',    '"altin"'::jsonb,       1500, 'ozel',   2),
  ('saat_gumus',      'Gümüş saat',           'saat',     '"gumus"'::jsonb,       600,  'sirali', 1),
  ('saat_altin',      'Altın saat',           'saat',     '"altin"'::jsonb,       1800, 'ozel',   2)
on conflict (id) do update set
  ad = excluded.ad, yuva = excluded.yuva, deger = excluded.deger,
  coin_fiyat = excluded.coin_fiyat, nadirlik = excluded.nadirlik, sira = excluded.sira;

-- ------------------------------------------------------------
-- 3) KAYITLI GÖRÜNÜMLER — eksik yeni yuvalara 'yok'
-- Oyuncular VE botlar. Mevcut değer varsa korunur.
-- ------------------------------------------------------------
update public.profiles
   set gorunum = jsonb_set(
         gorunum, '{avatar3d}',
         (gorunum->'avatar3d')
         || jsonb_build_object(
              'kolye', coalesce(gorunum->'avatar3d'->'kolye', '"yok"'::jsonb),
              'saat',  coalesce(gorunum->'avatar3d'->'saat',  '"yok"'::jsonb),
              'kupe',  coalesce(gorunum->'avatar3d'->'kupe',  '"yok"'::jsonb)
            ))
 where gorunum ? 'avatar3d'
   and jsonb_typeof(gorunum->'avatar3d') = 'object';

-- ------------------------------------------------------------
-- 4) DOĞRULAMA — canlı tanım (176) temel alındı; yeni değerler + 3 yuva
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
    'bas',       case when v_g->>'bas' in ('yok','kep','bere','tac','duvak','boynuz')
                      then v_g->>'bas' else 'yok' end,
    'kiyafet',   case when v_g->>'kiyafet' in ('ceket','tisort','gelinlik','atlet','gomlek',
                                               'havai','cizgili','oduncu','polo','kapusonlu','kot',
                                               'tisort_mavi','tisort_sari','seytan','damatlik')
                      then v_g->>'kiyafet' else 'tisort' end,
    'sakal',     case when v_g->>'sakal' in ('yok','tam','keci','biyik','favori')
                      then v_g->>'sakal' else 'yok' end,
    'ayakkabi',  case when v_g->>'ayakkabi' in ('spor','terlik','bot','sandalet','tokyo','topuklu')
                      then v_g->>'ayakkabi' else 'spor' end,
    'alt',       case when v_g->>'alt' in ('pantolon','sort','kapri')
                      then v_g->>'alt' else 'pantolon' end,
    'kolye',     case when v_g->>'kolye' in ('yok','altin','gumus') then v_g->>'kolye' else 'yok' end,
    'saat',      case when v_g->>'saat'  in ('yok','altin','gumus') then v_g->>'saat'  else 'yok' end,
    'kupe',      case when v_g->>'kupe'  in ('yok','altin','gumus') then v_g->>'kupe'  else 'yok' end,
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
-- 5) BOT GÖRÜNÜMÜ — gündelik yeni parçalar evet, dikkat çeken kostüm HAYIR
-- Şeytan kostümü, boynuz, damatlık ve topuklu botlara verilmez: gizli bot
-- gerçek oyuncu gibi dursun. Takılar seyrek, altın gümüşten de seyrek.
-- Eski listeler ve tohum anahtarları aynen korundu.
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
      -- Botların yarısı yeni gündelik üstlerden birini giyer.
      'kiyafet',   case when public.bot_rasgele('3d_kiy2:' || v_tohum) < 0.5
                        then v_kiy_yeni[1 + (floor(public.bot_rasgele('3d_kiyy:' || v_tohum) * 8))::int]
                        else v_kiyafet[1 + (floor(public.bot_rasgele('3d_kiy:' || v_tohum) * 5))::int] end,
      'sakal',     v_sakal [1 + (floor(public.bot_rasgele('3d_skl:'  || v_tohum) * 7))::int],
      'ayakkabi',  case when public.bot_rasgele('3d_ayk2:' || v_tohum) < 0.15
                        then 'tokyo'
                        else v_ayk[1 + (floor(public.bot_rasgele('3d_ayk:' || v_tohum) * 5))::int] end,
      'alt',       v_alt   [1 + (floor(public.bot_rasgele('3d_alt:'  || v_tohum) * 5))::int],
      -- Gözlük herkese takılmaz; takılana çeşitlerden biri düşer.
      'gozluk',    case when public.bot_rasgele('3d_gzl:' || v_tohum) > 0.72
                        then v_gzl[1 + (floor(public.bot_rasgele('3d_gzlt:' || v_tohum) * 5))::int]
                        else 'yok' end,
      -- Takılar seyrek: saat ~%22, kolye ve küpe ~%10.
      'saat',      case when public.bot_rasgele('3d_saat:' || v_tohum) > 0.78
                        then v_taki[1 + (floor(public.bot_rasgele('3d_saatt:' || v_tohum) * 3))::int]
                        else 'yok' end,
      'kolye',     case when public.bot_rasgele('3d_kly:' || v_tohum) > 0.9
                        then v_taki[1 + (floor(public.bot_rasgele('3d_klyt:' || v_tohum) * 3))::int]
                        else 'yok' end,
      'kupe',      case when public.bot_rasgele('3d_kupe:' || v_tohum) > 0.9
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

-- ------------------------------------------------------------
-- 6) BOTLARI YENİDEN GİYDİR
-- Görünümü değişen botun eski portre PNG'si artık ona benzemez; portre
-- adresi silinir (Avatar.jsx bu alanı okumuyor; `avatar3d_portresiz_botlar`
-- listesine düşer ve portre üretici çalıştırılırsa yeniden çizilir).
-- ------------------------------------------------------------
create temp table _bot_eski_gorunum as
  select id, gorunum->'avatar3d' as eski
    from public.profiles
   where coalesce(is_bot, false);

select public.avatar3d_bot_gorunum_uret();

update public.profiles p
   set gorunum = p.gorunum - 'portre_url'
  from _bot_eski_gorunum e
 where p.id = e.id
   and coalesce(p.gorunum->>'portre_url', '') <> ''
   and (p.gorunum->'avatar3d') is distinct from e.eski;

drop table _bot_eski_gorunum;
