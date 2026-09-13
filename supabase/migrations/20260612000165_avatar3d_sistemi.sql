-- ============================================================
-- 3B AVATAR SİSTEMİ — KATALOG, SAHİPLİK, GÖRÜNÜM
--
-- `bildim/avatar3d/` altındaki 3B sistem bugüne kadar YEREL DENEME
-- CÜZDANIYLA çalışıyordu (localStorage, sahte coin): oyuncunun kurduğu
-- karakter hiçbir yere yazılmıyordu. Bu migration onu gerçek ekonomiye
-- bağlar.
--
-- SÖZLEŞME `bildim/avatar3d/envanter-sunucu.js`'ten gelir, SQL ona uyar:
--   avatar3d_katalogum()            → {avatar3d_parcalar, avatar3d_sahip,
--                                      bakiye, avatar3d_gorunum}
--   avatar3d_satin_al(p_id)
--   avatar3d_gorunum_kaydet(p_gorunum)
--
-- 2B SİSTEM SİLİNMEDİ: `esyalar`(sistem='2b'), `karakterler`,
-- `oyuncu_karakterleri` yerinde duruyor; yalnız arayüzden çıkıyorlar.
-- `profiles.gorunum.karakter` (2B) alanına da dokunulmaz — 3B görünüm
-- `gorunum.avatar3d` altına yazılır.
-- ============================================================

-- ------------------------------------------------------------
-- 1) KATALOG
-- Fiyatlar TABLODA durur, koda gömülmez: yayından sonra SQL ile değişir.
-- ------------------------------------------------------------
create table if not exists public.avatar3d_parcalar (
  id         text primary key,
  ad         text not null,
  yuva       text not null check (yuva in ('sac','kiyafet','bas','gozluk','pelerin')),
  -- `deger` model.js'in ayarDogrula sözleşmesindeki değer: metin ('kisa',
  -- 'ceket'…) ya da mantıksal ('true'). jsonb tutulur ki ikisi de sığsın.
  deger      jsonb not null,
  coin_fiyat bigint,
  nadirlik   text not null default 'sirali' check (nadirlik in ('sirali','ozel','etkinlik')),
  sira       int not null default 0,
  aktif      boolean not null default true
);
alter table public.avatar3d_parcalar enable row level security;
drop policy if exists avatar3d_parcalar_oku on public.avatar3d_parcalar;
create policy avatar3d_parcalar_oku on public.avatar3d_parcalar
  for select to authenticated using (true);

-- 12 parça — bildim/avatar3d/envanter.js içindeki PARCALAR listesiyle
-- BİREBİR aynı id ve yuva/değer çiftleri. Fiyatlar deneme-katalog.json'dan.
-- Taç ve Pelerin SATILMAZ (coin_fiyat null + nadirlik 'etkinlik'):
-- yalnız turnuva ödülü, dükkânda kilitli görünür.
insert into public.avatar3d_parcalar (id, ad, yuva, deger, coin_fiyat, nadirlik, sira)
values
  ('sac_kisa',     'Kısa saç',        'sac',     '"kisa"'::jsonb,     0,    'sirali',   1),
  ('sac_uzun',     'Uzun saç',        'sac',     '"uzun"'::jsonb,     500,  'sirali',   2),
  ('sac_rasta',    'Rasta saç',       'sac',     '"rasta"'::jsonb,    600,  'sirali',   3),
  ('ust_tisort',   'Tişört',          'kiyafet', '"tisort"'::jsonb,   0,    'sirali',   1),
  ('ust_ceket',    'Ceket',           'kiyafet', '"ceket"'::jsonb,    2200, 'ozel',     2),
  ('ust_gelinlik', 'Gelinlik',        'kiyafet', '"gelinlik"'::jsonb, 2000, 'ozel',     3),
  ('bas_kep',      'Kep',             'bas',     '"kep"'::jsonb,      0,    'sirali',   1),
  ('bas_bere',     'Bere',            'bas',     '"bere"'::jsonb,     300,  'sirali',   2),
  ('bas_tac',      'Taç',             'bas',     '"tac"'::jsonb,      null, 'etkinlik', 3),
  ('bas_duvak',    'Duvak',           'bas',     '"duvak"'::jsonb,    500,  'sirali',   4),
  ('goz_gunes',    'Güneş gözlüğü',   'gozluk',  'true'::jsonb,       450,  'sirali',   1),
  ('sirt_pelerin', 'Pelerin',         'pelerin', 'true'::jsonb,       null, 'etkinlik', 1)
on conflict (id) do update set
  ad = excluded.ad, yuva = excluded.yuva, deger = excluded.deger,
  coin_fiyat = excluded.coin_fiyat, nadirlik = excluded.nadirlik, sira = excluded.sira;

-- ------------------------------------------------------------
-- 2) SAHİPLİK
-- ------------------------------------------------------------
create table if not exists public.avatar3d_sahip (
  oyuncu_id uuid not null references public.profiles(id) on delete cascade,
  parca_id  text not null references public.avatar3d_parcalar(id) on delete cascade,
  alindi    timestamptz not null default now(),
  kaynak    text not null default 'satin',
  primary key (oyuncu_id, parca_id)
);
alter table public.avatar3d_sahip enable row level security;
drop policy if exists avatar3d_sahip_oku on public.avatar3d_sahip;
create policy avatar3d_sahip_oku on public.avatar3d_sahip
  for select to authenticated using (oyuncu_id = auth.uid());

-- ------------------------------------------------------------
-- 3) ÜCRETSİZ PARÇALAR — kimse çıplak kalmasın
-- ------------------------------------------------------------
create or replace function public.avatar3d_ucretsizleri_ver(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_user is null then return; end if;
  insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
  select p_user, p.id, 'baslangic'
    from public.avatar3d_parcalar p
   where p.aktif and p.coin_fiyat = 0
  on conflict do nothing;
end;
$fn$;

revoke all on function public.avatar3d_ucretsizleri_ver(uuid) from public, authenticated, anon;

-- Mevcut oyunculara da verilsin (bot dahil: botlar da giyinik görünmeli).
insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
select pr.id, p.id, 'baslangic'
  from public.profiles pr
 cross join public.avatar3d_parcalar p
 where p.aktif and p.coin_fiyat = 0
on conflict do nothing;

-- Yeni oyuncuya profil açılışında ver. `ucretsiz_esyalari_ver` (2B/eski 3B)
-- bozulmadan duruyor; buraya yalnız 3B eklenir.
create or replace function public.avatar3d_yeni_oyuncu()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    perform public.avatar3d_ucretsizleri_ver(new.id);
  exception when others then
    -- Parça verilemezse profil açılışı düşmesin; oyuncu girebilsin.
    raise warning 'avatar3d ucretsiz parcalar verilemedi: %', sqlerrm;
  end;
  return new;
end;
$fn$;

drop trigger if exists avatar3d_yeni_oyuncu_trg on public.profiles;
create trigger avatar3d_yeni_oyuncu_trg
  after insert on public.profiles
  for each row execute function public.avatar3d_yeni_oyuncu();

-- ------------------------------------------------------------
-- 4) GÖRÜNÜM DOĞRULAMA
-- İstemciye GÜVENİLMEZ: gönderilen her parça için sahiplik aranır.
-- Renk/yüz alanları ücretsizdir (parça satılır, rengi hediye edilir).
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
begin
  if p_user is null then raise exception 'Giriş gerekli'; end if;

  -- Yalnız bilinen alanlar geçer; fazlası atılır (model.js ayarDogrula ile
  -- aynı sözleşme).
  v_temiz := jsonb_build_object(
    'ten',       case when v_g->>'ten'       ~ v_renk then v_g->>'ten'       else '#c58b62' end,
    'sacRenk',   case when v_g->>'sacRenk'   ~ v_renk then v_g->>'sacRenk'   else '#30211c' end,
    'ceketRenk', case when v_g->>'ceketRenk' ~ v_renk then v_g->>'ceketRenk' else '#be542d' end,
    'yuz',       case when v_g->>'yuz' in ('dengeli','yumusak','koseli','ince')
                      then v_g->>'yuz' else 'dengeli' end,
    'sac',       case when v_g->>'sac' in ('yok','kisa','uzun','rasta') then v_g->>'sac' else 'kisa' end,
    'bas',       case when v_g->>'bas' in ('yok','kep','bere','tac','duvak') then v_g->>'bas' else 'yok' end,
    'kiyafet',   case when v_g->>'kiyafet' in ('ceket','tisort','gelinlik') then v_g->>'kiyafet' else 'tisort' end,
    'gozluk',    coalesce(v_g->'gozluk'  = 'true'::jsonb, false),
    'pelerin',   coalesce(v_g->'pelerin' = 'true'::jsonb, false)
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
-- 5) KATALOĞUM
-- ------------------------------------------------------------
create or replace function public.avatar3d_katalogum()
returns table(
  avatar3d_parcalar jsonb,
  avatar3d_sahip    text[],
  avatar3d_gorunum  jsonb,
  bakiye            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return query
    select
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'ad', p.ad, 'yuva', p.yuva, 'deger', p.deger,
          'coin_fiyat', p.coin_fiyat, 'nadirlik', p.nadirlik,
          'aktif', p.aktif, 'sira', p.sira
        ) order by p.yuva, p.sira)
        from public.avatar3d_parcalar p where p.aktif
      ), '[]'::jsonb),
      coalesce((
        select array_agg(s.parca_id) from public.avatar3d_sahip s where s.oyuncu_id = v_me
      ), '{}'::text[]),
      coalesce((select pr.gorunum -> 'avatar3d' from public.profiles pr where pr.id = v_me), 'null'::jsonb),
      coalesce((select pr.coin from public.profiles pr where pr.id = v_me), 0);
end;
$fn$;

grant execute on function public.avatar3d_katalogum() to authenticated;

-- ------------------------------------------------------------
-- 6) SATIN AL — tek işlem, satır kilitli (coin_harca FOR UPDATE alıyor)
-- ------------------------------------------------------------
create or replace function public.avatar3d_satin_al(p_id text)
returns table(bakiye bigint, alinan_id text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_parca public.avatar3d_parcalar%rowtype;
  v_bakiye bigint;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('avatar3d_satin_al', 30, interval '60 seconds');

  select * into v_parca from public.avatar3d_parcalar where id = p_id and aktif;
  if not found then raise exception 'Parça bulunamadı'; end if;
  if v_parca.coin_fiyat is null then
    raise exception 'Bu parça satın alınamaz, yalnız ödül olarak kazanılır';
  end if;
  if exists (select 1 from public.avatar3d_sahip s where s.oyuncu_id = v_me and s.parca_id = p_id) then
    raise exception 'Bu parça zaten sende';
  end if;

  if v_parca.coin_fiyat > 0 then
    v_bakiye := public.coin_harca(v_parca.coin_fiyat, 'avatar3d', p_id);
  else
    select coin into v_bakiye from public.profiles where id = v_me;
  end if;

  insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
  values (v_me, p_id, case when v_parca.coin_fiyat = 0 then 'baslangic' else 'satin' end)
  on conflict do nothing;

  return query select v_bakiye, p_id;
end;
$fn$;

grant execute on function public.avatar3d_satin_al(text) to authenticated;

-- ------------------------------------------------------------
-- 7) GÖRÜNÜM KAYDET
-- `gorunum.avatar3d` altına yazar; `gorunum.karakter` (2B) korunur.
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
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('avatar3d', v_temiz)
   where id = v_me
  returning gorunum -> 'avatar3d' into v_sonuc;

  return v_sonuc;
end;
$fn$;

grant execute on function public.avatar3d_gorunum_kaydet(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 8) PORTRE URL — gardırop kaydederken ürettiği PNG'nin adresi
-- Lig tablosunda 25 satır için WebGL render etmek kabul edilemez;
-- portre BİR KEZ üretilip Storage'a yüklenir, listeler düz <img> çizer.
-- ------------------------------------------------------------
create or replace function public.avatar3d_portre_kaydet(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_sonuc jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('avatar3d_portre_kaydet', 30, interval '60 seconds');
  -- Yalnız kendi Storage kovamızdaki adres kabul edilir: istemci buraya
  -- rastgele bir adres yazamasın (listelerde herkese gösteriliyor).
  if p_url is null or p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatarlar/' then
    raise exception 'Geçersiz portre adresi';
  end if;

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('portre_url', p_url)
   where id = v_me
  returning gorunum into v_sonuc;

  return v_sonuc;
end;
$fn$;

grant execute on function public.avatar3d_portre_kaydet(text) to authenticated;

-- ------------------------------------------------------------
-- 9) ÖDÜL OLARAK PARÇA VER — yalnız sunucu içi (taç, pelerin)
-- ------------------------------------------------------------
create or replace function public.avatar3d_odul_ver(p_user uuid, p_id text, p_kaynak text default 'etkinlik')
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_user is null or p_id is null then return false; end if;
  if not exists (select 1 from public.avatar3d_parcalar where id = p_id) then return false; end if;
  insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
  values (p_user, p_id, p_kaynak)
  on conflict do nothing;
  return true;
end;
$fn$;

revoke all on function public.avatar3d_odul_ver(uuid, text, text) from public, authenticated, anon;

-- ------------------------------------------------------------
-- 10) BOT GÖRÜNÜMÜ — deterministik, sabit, ETKİNLİK PARÇASI YOK
-- `bot_gorunum_uret` (migration ...156) 2B görünüm üretiyor; o bozulmadı.
-- Burası aynı `bot_rasgele` tohumunu kullanır: bot adı aynı kaldıkça
-- görünüm de aynı kalır.
-- Taç ve Pelerin ASLA verilmez — onlar turnuva ödülü, bot kazanamaz.
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
  v_sac    text[] := array['kisa','uzun','rasta','yok'];
  v_yuz    text[] := array['dengeli','yumusak','koseli','ince'];
  -- Etkinlik parçaları listede YOK: 'tac' ve 'duvak' dışarıda bırakıldı
  -- (duvak satılık ama bota gelinlik/duvak yakıştırmak istenmiyor).
  v_bas    text[] := array['yok','yok','kep','bere'];
  v_kiyafet text[] := array['tisort','tisort','ceket'];
  v_g jsonb;
  v_sayi int := 0;
begin
  for r in select id, takma_ad from public.profiles where coalesce(is_bot, false) loop
    v_tohum := coalesce(r.takma_ad, r.id::text);
    v_g := jsonb_build_object(
      'ten',       v_tenler[1 + (floor(public.bot_rasgele('3d_ten:'  || v_tohum) * 6))::int],
      'sacRenk',   v_saclar[1 + (floor(public.bot_rasgele('3d_sacr:' || v_tohum) * 5))::int],
      'ceketRenk', v_ceket [1 + (floor(public.bot_rasgele('3d_cekr:' || v_tohum) * 6))::int],
      'sac',       v_sac   [1 + (floor(public.bot_rasgele('3d_sac:'  || v_tohum) * 4))::int],
      'yuz',       v_yuz   [1 + (floor(public.bot_rasgele('3d_yuz:'  || v_tohum) * 4))::int],
      'bas',       v_bas   [1 + (floor(public.bot_rasgele('3d_bas:'  || v_tohum) * 4))::int],
      'kiyafet',   v_kiyafet[1 + (floor(public.bot_rasgele('3d_kiy:' || v_tohum) * 3))::int],
      'gozluk',    public.bot_rasgele('3d_gzl:' || v_tohum) > 0.78,
      'pelerin',   false
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
