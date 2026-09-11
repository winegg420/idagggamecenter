-- ============================================================
-- AVATAR KİŞİSELLEŞTİRME
--
-- TEK DOĞRULUK KAYNAĞI: `profiles.gorunum` (jsonb). Profil avatarı, maç
-- ekranındaki küçük yüz ve 3B meydandaki karakter HEP bundan üretilir.
-- İkinci bir çizim yolu açılmaz.
--
-- EŞYA KATALOĞU KODA GÖMÜLMEZ. `esyalar` tablosuna satır eklenince eşya
-- dükkânda görünür; uygulama güncellemesi gerekmez. Koddaki tek şey her eşya
-- kodunun GEOMETRİ ÜRETİCİSİ (bildim/harita/esyalar.js) — model dosyası
-- indirilmez, hepsi kutu/silindir/küre/koni/halka ile çizilir.
-- ============================================================

alter table public.profiles add column if not exists gorunum jsonb not null
  default '{"ten":"#F3C89B","sac":null,"sac_renk":"#5A3A22","gozluk":null,
            "kupe":null,"sapka":null,"ust":null,"ust_renk":"#F4701F",
            "alt":null,"ayakkabi":null,"efekt":null}'::jsonb;

-- ------------------------------------------------------------
-- KATALOG
-- ------------------------------------------------------------
create table if not exists public.esyalar (
  kod text primary key,          -- 'spk_01'
  yuva text not null,            -- 'sac','gozluk','kupe','sapka','ust','alt','ayakkabi','efekt'
  ad text not null,
  coin_fiyat bigint,             -- null = satın alınamaz (sadece ödül), 0 = ücretsiz
  nadirlik text not null default 'sirali',   -- 'sirali','ozel','etkinlik'
  boyanabilir boolean not null default false,
  varsayilan_renk text,
  sac_kisalt boolean not null default false, -- şapka takılınca saç küçülsün
  sira int not null default 0,
  aktif boolean not null default true
);

create table if not exists public.oyuncu_esyalari (
  user_id uuid not null references auth.users(id) on delete cascade,
  esya_kod text not null references public.esyalar(kod),
  kazanildi timestamptz not null default now(),
  kaynak text not null default 'satin',    -- 'satin','etkinlik','baslangic'
  primary key (user_id, esya_kod)
);

alter table public.esyalar enable row level security;
drop policy if exists esyalar_okuma on public.esyalar;
create policy esyalar_okuma on public.esyalar
  for select to authenticated using (aktif);

alter table public.oyuncu_esyalari enable row level security;
drop policy if exists oyuncu_esyalari_kendi on public.oyuncu_esyalari;
create policy oyuncu_esyalari_kendi on public.oyuncu_esyalari
  for select to authenticated using (user_id = auth.uid());
-- Yazma politikası YOK: yalnız RPC ekler.

-- ------------------------------------------------------------
-- BAŞLANGIÇ SETİ — 15 eşya + 3 saç
-- Hepsi geometrik ilkellerden üretilir (bkz. bildim/harita/esyalar.js).
-- Sahibi beğenmezse değişecek; yapı buna hazır (satır güncellemek yeterli).
-- ------------------------------------------------------------
insert into public.esyalar (kod, yuva, ad, coin_fiyat, nadirlik, boyanabilir, varsayilan_renk, sac_kisalt, sira) values
  -- saç (ücretsiz: herkesin bir saçı olsun)
  ('sac_01', 'sac', 'Kısa Saç',        0,    'sirali', true,  '#5A3A22', false, 1),
  ('sac_02', 'sac', 'Uzun Saç',        0,    'sirali', true,  '#5A3A22', false, 2),
  ('sac_03', 'sac', 'Topuz',           0,    'sirali', true,  '#5A3A22', false, 3),
  -- şapka
  ('spk_01', 'sapka', 'Kasket',        250,  'sirali', true,  '#2F6FB0', true,  1),
  ('spk_02', 'sapka', 'Silindir Şapka',700,  'ozel',   true,  '#20324A', true,  2),
  ('spk_03', 'sapka', 'Bere',          300,  'sirali', true,  '#C0392B', true,  3),
  ('spk_04', 'sapka', 'Taç',           null, 'etkinlik', false, '#FFC53D', true, 4),
  -- gözlük
  ('gzl_01', 'gozluk', 'Yuvarlak Gözlük', 200, 'sirali', true, '#3E4A5C', false, 1),
  ('gzl_02', 'gozluk', 'Güneş Gözlüğü',   350, 'sirali', true, '#1A1A1A', false, 2),
  -- küpe
  ('kup_01', 'kupe', 'Halka Küpe',     150,  'sirali', true,  '#FFC53D', false, 1),
  ('kup_02', 'kupe', 'Tek Taş',        400,  'ozel',   true,  '#8AD6FF', false, 2),
  -- üst
  ('ust_01', 'ust', 'Düz Tişört',      0,    'sirali', true,  '#F4701F', false, 1),
  ('ust_02', 'ust', 'Ceket',           500,  'sirali', true,  '#2B3A55', false, 2),
  ('ust_03', 'ust', 'Kapüşonlu',       650,  'sirali', true,  '#5B4B8A', false, 3),
  -- ayakkabı
  ('ayk_01', 'ayakkabi', 'Spor Ayakkabı', 300, 'sirali', true, '#FFFFFF', false, 1),
  ('ayk_02', 'ayakkabi', 'Terlik',        120, 'sirali', true, '#2FBF71', false, 2),
  -- efekt
  ('efk_01', 'efekt', 'Parıltı Halkası', 900, 'ozel',   true,  '#FFC53D', false, 1),
  ('efk_02', 'efekt', 'Yıldızlar',       null,'etkinlik', true, '#8AD6FF', false, 2)
on conflict (kod) do nothing;

-- ------------------------------------------------------------
-- YARDIMCI — görünüm kaydını doğrula
-- Her yuvadaki eşyanın SAHİPLİĞİ ve YUVA UYUMU denetlenir; renkler
-- #RRGGBB biçiminden geçer. Geçersiz her şey reddedilir.
-- ------------------------------------------------------------
create or replace function public.gorunum_dogrula(p_user uuid, p_gorunum jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_yuvalar text[] := array['sac','gozluk','kupe','sapka','ust','alt','ayakkabi','efekt'];
  v_renkler text[] := array['ten','sac_renk','ust_renk'];
  v_yuva text;
  v_alan text;
  v_kod text;
  v_renk text;
  v_temiz jsonb := '{}'::jsonb;
begin
  if p_gorunum is null or jsonb_typeof(p_gorunum) <> 'object' then
    raise exception 'Geçersiz görünüm';
  end if;

  -- Eşya yuvaları.
  -- YALNIZ GÖNDERİLEN yuvalar işlenir: kısmi kayıt diğer yuvaları silmesin.
  -- Yuvayı boşaltmak için anahtar açıkça null gönderilir ({"sapka": null}).
  foreach v_yuva in array v_yuvalar loop
    if not (p_gorunum ? v_yuva) then
      continue;
    end if;
    v_kod := nullif(p_gorunum ->> v_yuva, '');
    if v_kod is null then
      v_temiz := v_temiz || jsonb_build_object(v_yuva, null);
      continue;
    end if;
    if not exists (select 1 from public.esyalar e where e.kod = v_kod and e.yuva = v_yuva and e.aktif) then
      raise exception 'Bu yuvaya uymayan eşya: % (%)', v_kod, v_yuva;
    end if;
    if not exists (select 1 from public.oyuncu_esyalari o where o.user_id = p_user and o.esya_kod = v_kod) then
      raise exception 'Bu eşyaya sahip değilsin: %', v_kod;
    end if;
    v_temiz := v_temiz || jsonb_build_object(v_yuva, v_kod);
  end loop;

  -- Renk alanları
  foreach v_alan in array v_renkler loop
    v_renk := nullif(p_gorunum ->> v_alan, '');
    if v_renk is null then
      continue;   -- varsayılan kullanılacak
    end if;
    if v_renk !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Geçersiz renk: %', v_renk;
    end if;
    v_temiz := v_temiz || jsonb_build_object(v_alan, upper(v_renk));
  end loop;

  return v_temiz;
end;
$fn$;

-- ------------------------------------------------------------
-- GÖRÜNÜM KAYDET
-- ------------------------------------------------------------
create or replace function public.gorunum_kaydet(p_gorunum jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_temiz jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('gorunum_kaydet', 30, interval '60 seconds');

  v_temiz := public.gorunum_dogrula(v_me, p_gorunum);

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || v_temiz
   where id = v_me
  returning gorunum into v_temiz;

  return v_temiz;
end;
$fn$;

grant execute on function public.gorunum_kaydet(jsonb) to authenticated;

-- ------------------------------------------------------------
-- EŞYA SATIN AL — tek işlem, satır kilitli
-- ------------------------------------------------------------
create or replace function public.esya_satin_al(p_kod text)
returns table(bakiye bigint, alinan_kod text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_esya public.esyalar%rowtype;
  v_bakiye bigint;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('esya_satin_al', 30, interval '60 seconds');

  select * into v_esya from public.esyalar where kod = p_kod and aktif;
  if not found then raise exception 'Eşya bulunamadı'; end if;
  if v_esya.coin_fiyat is null then
    raise exception 'Bu eşya satın alınamaz, yalnız ödül olarak kazanılır';
  end if;
  if exists (select 1 from public.oyuncu_esyalari o where o.user_id = v_me and o.esya_kod = p_kod) then
    raise exception 'Bu eşya zaten sende';
  end if;

  if v_esya.coin_fiyat > 0 then
    v_bakiye := public.coin_harca(v_esya.coin_fiyat, 'esya', p_kod);
  else
    select coin into v_bakiye from public.profiles where id = v_me;
  end if;

  insert into public.oyuncu_esyalari (user_id, esya_kod, kaynak)
  values (v_me, p_kod, case when v_esya.coin_fiyat = 0 then 'baslangic' else 'satin' end)
  on conflict do nothing;

  return query select v_bakiye, p_kod;
end;
$fn$;

grant execute on function public.esya_satin_al(text) to authenticated;

-- ------------------------------------------------------------
-- ÖDÜL OLARAK EŞYA VER — yalnız sunucu içi (etkinlik ödülleri)
-- ------------------------------------------------------------
create or replace function public.esya_odul_ver(p_user uuid, p_kod text, p_kaynak text default 'etkinlik')
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_user is null or p_kod is null then return false; end if;
  if not exists (select 1 from public.esyalar where kod = p_kod) then return false; end if;
  insert into public.oyuncu_esyalari (user_id, esya_kod, kaynak)
  values (p_user, p_kod, p_kaynak)
  on conflict do nothing;
  return true;
end;
$fn$;

revoke all on function public.esya_odul_ver(uuid, text, text) from public;
revoke all on function public.esya_odul_ver(uuid, text, text) from authenticated;
revoke all on function public.esya_odul_ver(uuid, text, text) from anon;

-- ------------------------------------------------------------
-- KATALOG + SAHİPLİK + GÜNCEL GÖRÜNÜM — tek sorguda
-- ------------------------------------------------------------
create or replace function public.esya_katalogum()
returns table(esyalar jsonb, sahip text[], gorunum jsonb, bakiye bigint)
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
          'kod', e.kod, 'yuva', e.yuva, 'ad', e.ad, 'coin_fiyat', e.coin_fiyat,
          'nadirlik', e.nadirlik, 'boyanabilir', e.boyanabilir,
          'varsayilan_renk', e.varsayilan_renk, 'sac_kisalt', e.sac_kisalt, 'sira', e.sira
        ) order by e.yuva, e.sira)
        from public.esyalar e where e.aktif
      ), '[]'::jsonb),
      coalesce((
        select array_agg(o.esya_kod) from public.oyuncu_esyalari o where o.user_id = v_me
      ), '{}'::text[]),
      coalesce((select p.gorunum from public.profiles p where p.id = v_me), '{}'::jsonb),
      coalesce((select p.coin from public.profiles p where p.id = v_me), 0);
end;
$fn$;

grant execute on function public.esya_katalogum() to authenticated;

-- ------------------------------------------------------------
-- ÜCRETSİZ EŞYALAR HERKESE
-- coin_fiyat = 0 olan eşyalar (temel saç ve tişört) otomatik verilir ki
-- kimse çıplak kalmasın; yeni oyuncuya da profil açılışında verilir.
-- ------------------------------------------------------------
create or replace function public.ucretsiz_esyalari_ver(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.oyuncu_esyalari (user_id, esya_kod, kaynak)
  select p_user, e.kod, 'baslangic'
    from public.esyalar e
   where e.aktif and e.coin_fiyat = 0
  on conflict do nothing;
end;
$fn$;

revoke all on function public.ucretsiz_esyalari_ver(uuid) from public;
revoke all on function public.ucretsiz_esyalari_ver(uuid) from authenticated;
revoke all on function public.ucretsiz_esyalari_ver(uuid) from anon;

-- Mevcut oyunculara ücretsiz eşyalar
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.ucretsiz_esyalari_ver(r.id);
  end loop;
end $$;

-- Yeni oyuncuya: başlangıç coini + ücretsiz eşyalar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, username, avatar_url, provider, davet_kodu)
  values (
    new.id,
    'oyuncu_' || substr(md5(new.id::text || random()::text), 1, 8),
    null,                                    -- Google fotoğrafı ALINMAZ
    new.raw_app_meta_data->>'provider',
    public.yeni_davet_kodu()
  );

  begin
    perform public.coin_ekle(new.id, public.ayar_sayi('coin_baslangic', 300), 'baslangic', null);
    perform public.ucretsiz_esyalari_ver(new.id);
  exception when others then
    null;   -- ödül verilemese bile profil oluşturma asla düşmesin
  end;

  return new;
end;
$fn$;

-- ------------------------------------------------------------
-- AVATAR FOTOĞRAFI DEPOSU
-- Görünüm kaydedilince avatarın tek karelik PNG'si buraya yüklenir; lig ve
-- arkadaş listeleri 3B sahne açmak yerine bu fotoğrafı gösterir.
-- Dosya adı kullanıcının kendi kimliği: herkes yalnız kendi dosyasını yazar.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatarlar', 'avatarlar', true)
on conflict (id) do nothing;

drop policy if exists avatarlar_okuma on storage.objects;
create policy avatarlar_okuma on storage.objects
  for select using (bucket_id = 'avatarlar');

drop policy if exists avatarlar_kendi_yaz on storage.objects;
create policy avatarlar_kendi_yaz on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatarlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatarlar_kendi_guncelle on storage.objects;
create policy avatarlar_kendi_guncelle on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatarlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatarlar_kendi_sil on storage.objects;
create policy avatarlar_kendi_sil on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatarlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
