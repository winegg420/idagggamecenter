-- ============================================================
-- 2B KARAKTER VE KOZMETİK SİSTEMİ (PatiRun'dan taşındı)
--
-- PatiRun'da çalışan, tamamı KODLA ÜRETİLEN vektör karakter sistemi
-- Quiz Square'e alındı: 20 karakter + 39 kozmetik parça. Hazır görsel
-- dosyası yok, her şey SVG olarak çiziliyor (bildim/karakter/).
--
-- MEVCUT 3B AVATAR SİSTEMİ BOZULMADI: `esyalar` tablosuna `sistem`
-- kolonu eklendi, eski satırlar '3b' olarak işaretlendi. Meydan (3B
-- harita) yalnız '3b' satırlarını okur; 2B ekranlar yalnız '2b'.
-- İki sistem aynı tabloda yan yana yaşar, satın alma akışı ortaktır
-- (esya_satin_al zaten sunucuda doğruluyor).
--
-- Renkler ÜCRETSİZDİR: parça satılır, rengi hediye edilir.
-- Etkinlik parçaları (Taç, Pelerin, Uzay Kıyafeti) coin_fiyat = null —
-- esya_satin_al bunları zaten reddediyor, yalnız turnuva ödülü.
-- ============================================================

alter table public.esyalar
  add column if not exists anahtar text,
  add column if not exists sistem text not null default '3b';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'esyalar_sistem_check') then
    alter table public.esyalar add constraint esyalar_sistem_check check (sistem in ('2b','3b'));
  end if;
end $$;

create index if not exists esyalar_sistem_idx on public.esyalar (sistem, yuva, sira) where aktif;

-- ---- Karakterler ----
create table if not exists public.karakterler (
  id         text primary key,
  ad         text not null,
  aciklama   text not null default '',
  emoji      text not null default '',
  coin_fiyat bigint,
  nadirlik   text not null default 'sirali' check (nadirlik in ('sirali','ozel','etkinlik')),
  baslangic  boolean not null default false,
  sira       int not null default 0,
  aktif      boolean not null default true
);
alter table public.karakterler enable row level security;
drop policy if exists karakterler_oku on public.karakterler;
create policy karakterler_oku on public.karakterler
  for select to authenticated using (true);

create table if not exists public.oyuncu_karakterleri (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  karakter_id text not null references public.karakterler(id) on delete cascade,
  kazanildi   timestamptz not null default now(),
  kaynak      text not null default 'satin',
  primary key (user_id, karakter_id)
);
alter table public.oyuncu_karakterleri enable row level security;
drop policy if exists oyuncu_karakterleri_oku on public.oyuncu_karakterleri;
create policy oyuncu_karakterleri_oku on public.oyuncu_karakterleri
  for select to authenticated using (user_id = auth.uid());

-- ---- 20 karakter (fiyatlar tabloda, koda gömülmez) ----
insert into public.karakterler (id, ad, aciklama, emoji, coin_fiyat, nadirlik, baslangic, sira)
values
  ('sloth', 'Keyif Tembel', 'Plajdan yarışa geldi, acelesi yok ama nedense hep önde.', '🦥', 0, 'sirali', true, 1),
  ('tavsan', 'Koç Tavşan', 'Kas yapmış, havuç yerine protein tozu taşıyor.', '🐰', 0, 'sirali', true, 2),
  ('kedi', 'Rocker Kedi', 'Konserine yetişmek için yarışıyor, gitarı kulise bıraktı.', '🐱', 0, 'sirali', true, 3),
  ('tilki', 'Ninja Tilki', 'Sessiz, hızlı... ama her seferinde bir yere takılıyor.', '🦊', 0, 'sirali', true, 4),
  ('kaplumbaga', 'Sörfçü Tosbi', 'Dalga yoksa yarış var. Rastaları rüzgarda savruluyor.', '🐢', 0, 'sirali', true, 5),
  ('penguen', 'Müdür Penguen', 'Toplantısı var, yarışı hızlı bitirmesi lazım.', '🐧', 800, 'sirali', false, 6),
  ('ayi', 'Şef Ayı', 'Yarışı bitirince herkese mantı sözü verdi.', '🐻', 800, 'sirali', false, 7),
  ('fare', 'Astro Fare', 'Ay''a gitti geldi, şimdi hedef podyum.', '🐭', 900, 'sirali', false, 8),
  ('ordek', 'Kont Vakvak', 'Gündüz yarışlarından nefret ediyor ama katılmadan da duramıyor.', '🦆', 900, 'sirali', false, 9),
  ('keci', 'Kaykaycı Keçi', 'Rampaları kaykay parkı sanıyor, haksız da değil.', '🐐', 1000, 'sirali', false, 10),
  ('rakun', 'Dedektif Rakun', 'Kimin engel koyduğunu her zaman biliyor. Kanıtı da var.', '🦝', 1200, 'ozel', false, 11),
  ('papagan', 'DJ Papağan', 'Kendi koşu ritmini kendisi mixliyor.', '🦜', 1200, 'ozel', false, 12),
  ('timsah', 'Emlakçı Timsah', '"Bu pist satılık olsa çoktan satmıştım" diyor.', '🐊', 1200, 'ozel', false, 13),
  ('flamingo', 'Topuklu Flamingo', 'Topuklularla koşabildiğini kanıtlamak için burada.', '🦩', 1400, 'ozel', false, 14),
  ('mors', 'Bıyıklı Mors', 'Kel ama bıyığıyla gurur duyuyor. Pos bıyık, dolgun özgüven.', '🦭', 1400, 'ozel', false, 15),
  ('kurbaga', 'MC Vırak', 'Her checkpoint''te yeni bir dörtlük yazıyor.', '🐸', 1600, 'ozel', false, 16),
  ('aslan', 'Peruklu Aslan', 'Yelesi döküldü diye sarı peruk taktı, kimse fark etmedi sanıyor.', '🦁', 1800, 'ozel', false, 17),
  ('goril', 'Halterci Gori', 'Isınma turu diye pisti üç kez koştu.', '🦍', 2000, 'ozel', false, 18),
  ('baykus', 'Prof. Baykuş', 'Yarışın optimal rotasını hesapladı, uygulamak ayrı konu.', '🦉', 2200, 'ozel', false, 19),
  ('sihirbaz', 'Sihirbaz Pofuduk', 'Şapkadan tavşan çıkaramıyor çünkü kendisi tavşan.', '🎩', 2500, 'ozel', false, 20)
on conflict (id) do update set
  ad = excluded.ad, aciklama = excluded.aciklama, emoji = excluded.emoji,
  coin_fiyat = excluded.coin_fiyat, nadirlik = excluded.nadirlik,
  baslangic = excluded.baslangic, sira = excluded.sira;

-- ---- 39 kozmetik parça (2B sistem) ----
insert into public.esyalar (kod, yuva, anahtar, ad, coin_fiyat, nadirlik, sira, sistem)
values
  ('k2_hat_kep', 'hat', 'kep', 'Kep', 0, 'sirali', 1, '2b'),
  ('k2_hat_bere', 'hat', 'bere', 'Bere', 300, 'sirali', 2, '2b'),
  ('k2_hat_ascibone', 'hat', 'ascibone', 'Aşçı Bonesi', 350, 'sirali', 3, '2b'),
  ('k2_hat_fedora', 'hat', 'fedora', 'Fedora', 550, 'sirali', 4, '2b'),
  ('k2_hat_kask', 'hat', 'kask', 'Kask', 1300, 'ozel', 5, '2b'),
  ('k2_hat_silindir', 'hat', 'silindir', 'Silindir Şapka', 1800, 'ozel', 6, '2b'),
  ('k2_hat_tac', 'hat', 'tac', 'Taç', null, 'etkinlik', 7, '2b'),
  ('k2_glasses_yuvarlak', 'glasses', 'yuvarlak', 'Yuvarlak Gözlük', 0, 'sirali', 1, '2b'),
  ('k2_glasses_kare', 'glasses', 'kare', 'Kare Gözlük', 350, 'sirali', 2, '2b'),
  ('k2_glasses_gunes', 'glasses', 'gunes', 'Güneş Gözlüğü', 450, 'sirali', 3, '2b'),
  ('k2_glasses_pilot', 'glasses', 'pilot', 'Pilot Gözlük', 1200, 'ozel', 4, '2b'),
  ('k2_necklace_papyon', 'necklace', 'papyon', 'Papyon', 0, 'sirali', 1, '2b'),
  ('k2_necklace_atki', 'necklace', 'atki', 'Atkı', 400, 'sirali', 2, '2b'),
  ('k2_necklace_kravat', 'necklace', 'kravat', 'Kravat', 400, 'sirali', 3, '2b'),
  ('k2_necklace_altin', 'necklace', 'altin', 'Altın Kolye', 1500, 'ozel', 4, '2b'),
  ('k2_wristband_bant', 'wristband', 'bant', 'Bileklik', 0, 'sirali', 1, '2b'),
  ('k2_wristband_saat', 'wristband', 'saat', 'Saat', 500, 'sirali', 2, '2b'),
  ('k2_hair_kisa', 'hair', 'kisa', 'Kısa Saç', 0, 'sirali', 1, '2b'),
  ('k2_hair_sari', 'hair', 'sari', 'Sarı Peruk', 500, 'sirali', 2, '2b'),
  ('k2_hair_rasta', 'hair', 'rasta', 'Rasta', 600, 'sirali', 3, '2b'),
  ('k2_hair_mohawk', 'hair', 'mohawk', 'Mohawk', 1400, 'ozel', 4, '2b'),
  ('k2_hair_peruk', 'hair', 'peruk', 'Kabarık Peruk', 1600, 'ozel', 5, '2b'),
  ('k2_mustache_ince', 'mustache', 'ince', 'İnce Bıyık', 0, 'sirali', 1, '2b'),
  ('k2_mustache_pos', 'mustache', 'pos', 'Pos Bıyık', 350, 'sirali', 2, '2b'),
  ('k2_beard_keci', 'beard', 'keci', 'Keçi Sakal', 0, 'sirali', 1, '2b'),
  ('k2_beard_tam', 'beard', 'tam', 'Tam Sakal', 400, 'sirali', 2, '2b'),
  ('k2_top_tisort', 'top', 'tisort', 'Tişört', 0, 'sirali', 1, '2b'),
  ('k2_top_atlet', 'top', 'atlet', 'Atlet', 300, 'sirali', 2, '2b'),
  ('k2_top_esofman', 'top', 'esofman', 'Eşofman', 350, 'sirali', 3, '2b'),
  ('k2_top_gomlek', 'top', 'gomlek', 'Gömlek', 450, 'sirali', 4, '2b'),
  ('k2_top_onluk', 'top', 'onluk', 'Aşçı Önlüğü', 450, 'sirali', 5, '2b'),
  ('k2_top_takim', 'top', 'takim', 'Takım Elbise', 2000, 'ozel', 6, '2b'),
  ('k2_top_ceket', 'top', 'ceket', 'Deri Ceket', 2200, 'ozel', 7, '2b'),
  ('k2_top_pelerin', 'top', 'pelerin', 'Pelerin', null, 'etkinlik', 8, '2b'),
  ('k2_top_uzaykiyafeti', 'top', 'uzaykiyafeti', 'Uzay Kıyafeti', null, 'etkinlik', 9, '2b'),
  ('k2_shoes_spor', 'shoes', 'spor', 'Spor Ayakkabı', 0, 'sirali', 1, '2b'),
  ('k2_shoes_terlik', 'shoes', 'terlik', 'Terlik', 300, 'sirali', 2, '2b'),
  ('k2_shoes_bot', 'shoes', 'bot', 'Bot', 500, 'sirali', 3, '2b'),
  ('k2_shoes_topuklu', 'shoes', 'topuklu', 'Topuklu', 550, 'sirali', 4, '2b')
on conflict (kod) do update set
  yuva = excluded.yuva, anahtar = excluded.anahtar, ad = excluded.ad,
  coin_fiyat = excluded.coin_fiyat, nadirlik = excluded.nadirlik,
  sira = excluded.sira, sistem = excluded.sistem;

-- ---- Bedava içerik: 5 karakter + 9 kozmetik ----
create or replace function public.ucretsiz_karakter_ve_parca_ver(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $ukp$
begin
  if p_user is null then return; end if;

  insert into public.oyuncu_karakterleri (user_id, karakter_id, kaynak)
  select p_user, k.id, 'baslangic'
    from public.karakterler k where k.aktif and k.baslangic
  on conflict do nothing;

  insert into public.oyuncu_esyalari (user_id, esya_kod, kaynak)
  select p_user, e.kod, 'baslangic'
    from public.esyalar e
   where e.aktif and e.sistem = '2b' and e.coin_fiyat = 0
  on conflict do nothing;
end;
$ukp$;

revoke all on function public.ucretsiz_karakter_ve_parca_ver(uuid) from public, authenticated, anon;

-- Mevcut oyunculara da ver (bot dahil: botlar da bu sistemi kullanacak)
do $bas$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.ucretsiz_karakter_ve_parca_ver(r.id);
  end loop;
end
$bas$;

-- ---- Karakter satın alma (sunucuda doğrulanır) ----
create or replace function public.karakter_satin_al(p_id text)
returns table(bakiye bigint, alinan_id text)
language plpgsql security definer set search_path to 'public' as $ksa$
declare
  v_me uuid := auth.uid();
  k public.karakterler%rowtype;
  v_bakiye bigint;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('karakter_satin_al', 30, interval '60 seconds');

  select * into k from public.karakterler where id = p_id and aktif;
  if not found then raise exception 'Karakter bulunamadı'; end if;
  if k.coin_fiyat is null then
    raise exception 'Bu karakter satın alınamaz, yalnız ödül olarak kazanılır';
  end if;
  if exists (select 1 from public.oyuncu_karakterleri o
              where o.user_id = v_me and o.karakter_id = p_id) then
    raise exception 'Bu karakter zaten sende';
  end if;

  if k.coin_fiyat > 0 then
    v_bakiye := public.coin_harca(k.coin_fiyat, 'karakter', p_id);
  else
    select coin into v_bakiye from public.profiles where id = v_me;
  end if;

  insert into public.oyuncu_karakterleri (user_id, karakter_id, kaynak)
  values (v_me, p_id, case when k.coin_fiyat = 0 then 'baslangic' else 'satin' end)
  on conflict do nothing;

  return query select v_bakiye, p_id;
end;
$ksa$;

grant execute on function public.karakter_satin_al(text) to authenticated;

-- ---- Görünüm doğrulama: 2B karakter + kozmetik ----
-- Eski 3B yuvaları AYNEN korunur (meydan onları okuyor); üstüne iki yeni
-- anahtar geliyor: `karakter` ve `kozmetik`. Sahiplik SUNUCUDA denetlenir;
-- istemci sahip olmadığı parçayı gönderirse istek reddedilir.
-- Renkler serbesttir: yalnız #rrggbb biçimi doğrulanır, ücret alınmaz.
create or replace function public.gorunum_dogrula(p_user uuid, p_gorunum jsonb)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $gd$
declare
  v_yuvalar text[] := array['sac','gozluk','kupe','sapka','ust','alt','ayakkabi','efekt'];
  v_renkler text[] := array['ten','sac_renk','ust_renk'];
  v_2b text[] := array['hat','glasses','necklace','wristband','hair','mustache','beard','top','shoes'];
  v_yuva text;
  v_alan text;
  v_kod text;
  v_renk text;
  v_deger text;
  v_koz jsonb;
  v_koz_temiz jsonb := '{}'::jsonb;
  v_temiz jsonb := '{}'::jsonb;
begin
  if p_gorunum is null or jsonb_typeof(p_gorunum) <> 'object' then
    raise exception 'Geçersiz görünüm';
  end if;

  -- ---- 3B eşya yuvaları (eski sistem, dokunulmadı) ----
  foreach v_yuva in array v_yuvalar loop
    if not (p_gorunum ? v_yuva) then continue; end if;
    v_kod := nullif(p_gorunum ->> v_yuva, '');
    if v_kod is null then
      v_temiz := v_temiz || jsonb_build_object(v_yuva, null);
      continue;
    end if;
    if not exists (select 1 from public.esyalar e
                    where e.kod = v_kod and e.yuva = v_yuva and e.aktif) then
      raise exception 'Bu yuvaya uymayan eşya: % (%)', v_kod, v_yuva;
    end if;
    if not exists (select 1 from public.oyuncu_esyalari o
                    where o.user_id = p_user and o.esya_kod = v_kod) then
      raise exception 'Bu eşyaya sahip değilsin: %', v_kod;
    end if;
    v_temiz := v_temiz || jsonb_build_object(v_yuva, v_kod);
  end loop;

  -- ---- Renk alanları (eski sistem) ----
  foreach v_alan in array v_renkler loop
    v_renk := nullif(p_gorunum ->> v_alan, '');
    if v_renk is null then continue; end if;
    if v_renk !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Geçersiz renk: %', v_renk;
    end if;
    v_temiz := v_temiz || jsonb_build_object(v_alan, upper(v_renk));
  end loop;

  -- ---- 2B karakter ----
  if p_gorunum ? 'karakter' then
    v_deger := nullif(p_gorunum ->> 'karakter', '');
    if v_deger is not null then
      if not exists (select 1 from public.karakterler k where k.id = v_deger and k.aktif) then
        raise exception 'Karakter bulunamadı: %', v_deger;
      end if;
      if not exists (select 1 from public.oyuncu_karakterleri o
                      where o.user_id = p_user and o.karakter_id = v_deger) then
        raise exception 'Bu karaktere sahip değilsin: %', v_deger;
      end if;
      v_temiz := v_temiz || jsonb_build_object('karakter', v_deger);
    end if;
  end if;

  -- ---- 2B kozmetik ----
  if p_gorunum ? 'kozmetik' then
    v_koz := p_gorunum -> 'kozmetik';
    if jsonb_typeof(v_koz) <> 'object' then raise exception 'Geçersiz kozmetik'; end if;

    foreach v_yuva in array v_2b loop
      -- Parça anahtarı (ör. "hat": "fedora"); 'yok' = çıplak yuva
      if v_koz ? v_yuva then
        v_deger := coalesce(nullif(v_koz ->> v_yuva, ''), 'yok');
        if v_deger <> 'yok' then
          select e.kod into v_kod from public.esyalar e
           where e.sistem = '2b' and e.yuva = v_yuva and e.anahtar = v_deger and e.aktif;
          if v_kod is null then
            raise exception 'Bu yuvaya uymayan parça: % (%)', v_deger, v_yuva;
          end if;
          if not exists (select 1 from public.oyuncu_esyalari o
                          where o.user_id = p_user and o.esya_kod = v_kod) then
            raise exception 'Bu parçaya sahip değilsin: %', v_deger;
          end if;
        end if;
        v_koz_temiz := v_koz_temiz || jsonb_build_object(v_yuva, v_deger);
      end if;
      -- Renk alanı (hatColor, glassesColor, …) — ÜCRETSİZ, yalnız biçim
      v_alan := v_yuva || 'Color';
      if v_koz ? v_alan then
        v_renk := nullif(v_koz ->> v_alan, '');
        if v_renk is not null then
          if v_renk !~ '^#[0-9A-Fa-f]{6}$' then
            raise exception 'Geçersiz renk: %', v_renk;
          end if;
          v_koz_temiz := v_koz_temiz || jsonb_build_object(v_alan, lower(v_renk));
        end if;
      end if;
    end loop;

    v_temiz := v_temiz || jsonb_build_object('kozmetik', v_koz_temiz);
  end if;

  return v_temiz;
end;
$gd$;

-- Kısmi kayıt `kozmetik` nesnesini SİLMESİN: üst düzey birleştirme
-- (`||`) iç içe nesneyi olduğu gibi değiştiriyor. Gelen yuvalar
-- mevcutların ÜSTÜNE yazılır, gönderilmeyenler yerinde kalır.
create or replace function public.gorunum_kaydet(p_gorunum jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $gk$
declare
  v_me uuid := auth.uid();
  v_temiz jsonb;
  v_eski jsonb;
  v_sonuc jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('gorunum_kaydet', 30, interval '60 seconds');

  v_temiz := public.gorunum_dogrula(v_me, p_gorunum);
  select coalesce(gorunum, '{}'::jsonb) into v_eski from public.profiles where id = v_me;

  if v_temiz ? 'kozmetik' then
    v_temiz := v_temiz || jsonb_build_object(
      'kozmetik', coalesce(v_eski -> 'kozmetik', '{}'::jsonb) || (v_temiz -> 'kozmetik'));
  end if;

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || v_temiz
   where id = v_me
  returning gorunum into v_sonuc;

  return v_sonuc;
end;
$gk$;

-- ---- 2B katalog: karakterler + parçalar + sahiplik + görünüm + coin ----
create or replace function public.karakter_katalogum()
returns table(karakterler jsonb, karakter_sahip text[], parcalar jsonb,
              parca_sahip text[], gorunum jsonb, bakiye bigint)
language plpgsql stable security definer set search_path to 'public' as $kk$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return query
    select
      coalesce((select jsonb_agg(jsonb_build_object(
                 'id', k.id, 'ad', k.ad, 'aciklama', k.aciklama, 'emoji', k.emoji,
                 'coin_fiyat', k.coin_fiyat, 'nadirlik', k.nadirlik,
                 'baslangic', k.baslangic, 'sira', k.sira) order by k.sira)
               from public.karakterler k where k.aktif), '[]'::jsonb),
      coalesce((select array_agg(o.karakter_id) from public.oyuncu_karakterleri o
                 where o.user_id = v_me), '{}'::text[]),
      coalesce((select jsonb_agg(jsonb_build_object(
                 'kod', e.kod, 'yuva', e.yuva, 'anahtar', e.anahtar, 'ad', e.ad,
                 'coin_fiyat', e.coin_fiyat, 'nadirlik', e.nadirlik, 'sira', e.sira)
                 order by e.yuva, e.sira)
               from public.esyalar e where e.aktif and e.sistem = '2b'), '[]'::jsonb),
      coalesce((select array_agg(o.esya_kod) from public.oyuncu_esyalari o
                 join public.esyalar e on e.kod = o.esya_kod and e.sistem = '2b'
                 where o.user_id = v_me), '{}'::text[]),
      coalesce((select p.gorunum from public.profiles p where p.id = v_me), '{}'::jsonb),
      coalesce((select p.coin from public.profiles p where p.id = v_me), 0);
end;
$kk$;

grant execute on function public.karakter_katalogum() to authenticated;

-- ---- Yeni oyuncu: 5 bedava karakter + 9 bedava parça ----
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $hnu$
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
    perform public.ucretsiz_karakter_ve_parca_ver(new.id);
  exception when others then
    null;   -- ödül verilemese bile profil oluşturma asla düşmesin
  end;

  return new;
end;
$hnu$;

-- ============================================================
-- BOT GÖRÜNÜMLERİ
-- Avatar bot ADINDAN deterministik türer ve sabit kalır.
-- Kıyafet dağılımı: %30 yalnız bedava parçalar · %50 2-3 sıradan parça ·
-- %20 bir özel parça + sıradanlar. Etkinlik parçaları ASLA giyilmez.
-- Seviye ile görünüm uyumlu: seviye yükseldikçe giyinme ihtimali artar.
-- ============================================================
create or replace function public.bot_gorunum_uret()
returns integer language plpgsql security definer set search_path to 'public' as $bgu$
declare
  r record;
  v_p numeric;
  v_sev int;
  v_kar text;
  v_koz jsonb;
  v_renkler text[] := array['#e63946','#f4a261','#e9c46a','#2a9d8f','#457b9d','#8338ec',
                            '#ff006e','#fb5607','#ffbe0b','#3a86ff','#111111','#ffffff',
                            '#8d5524','#c68642','#25d366','#ffd700'];
  v_karakterler text[];
  v_sayi int := 0;
begin
  select array_agg(id order by sira) into v_karakterler from public.karakterler where aktif;

  for r in select id, takma_ad, coalesce(bot_seviye_puan, 30) as seviye
             from public.profiles where coalesce(is_bot, false)
  loop
    v_p := public.bot_rasgele('kiyafet:' || coalesce(r.takma_ad, r.id::text));
    v_sev := r.seviye;
    v_kar := v_karakterler[1 + (floor(public.bot_rasgele('kar:' || coalesce(r.takma_ad, r.id::text))
                                      * array_length(v_karakterler, 1)))::int];

    -- Temel: bedava parçalar
    v_koz := jsonb_build_object(
      'hat', 'yok', 'glasses', 'yok', 'necklace', 'yok', 'wristband', 'yok',
      'hair', 'yok', 'mustache', 'yok', 'beard', 'yok',
      'top', 'tisort', 'shoes', 'spor',
      'topColor', v_renkler[1 + (floor(public.bot_rasgele('ust:' || coalesce(r.takma_ad, '')) * 16))::int],
      'shoesColor', v_renkler[1 + (floor(public.bot_rasgele('ayk:' || coalesce(r.takma_ad, '')) * 16))::int],
      'hatColor', v_renkler[1 + (floor(public.bot_rasgele('sap:' || coalesce(r.takma_ad, '')) * 16))::int],
      'hairColor', v_renkler[1 + (floor(public.bot_rasgele('sac:' || coalesce(r.takma_ad, '')) * 16))::int],
      'glassesColor', '#111111', 'necklaceColor', '#ffd700', 'wristbandColor', '#e63946');

    -- %30 sade kalır; seviye yükseldikçe bu oran düşer (görünüm-seviye uyumu)
    if v_p >= 0.30 - least(0.18, v_sev::numeric / 550) then
      -- 2-3 sıradan parça
      v_koz := v_koz || jsonb_build_object(
        'hat', (array['kep','bere','ascibone','fedora'])[
                 1 + (floor(public.bot_rasgele('h:' || coalesce(r.takma_ad, '')) * 4))::int],
        'glasses', (array['yok','yuvarlak','kare','gunes'])[
                 1 + (floor(public.bot_rasgele('g:' || coalesce(r.takma_ad, '')) * 4))::int],
        'top', (array['tisort','atlet','esofman','gomlek','onluk'])[
                 1 + (floor(public.bot_rasgele('t:' || coalesce(r.takma_ad, '')) * 5))::int],
        'shoes', (array['spor','terlik','bot'])[
                 1 + (floor(public.bot_rasgele('s:' || coalesce(r.takma_ad, '')) * 3))::int]);
    end if;

    -- %20 bir ÖZEL parça ekler (etkinlik parçası ASLA)
    if v_p >= 0.80 then
      if public.bot_rasgele('oz:' || coalesce(r.takma_ad, '')) < 0.5 then
        v_koz := v_koz || jsonb_build_object('top',
          (array['takim','ceket'])[1 + (floor(public.bot_rasgele('o1:' || coalesce(r.takma_ad, '')) * 2))::int]);
      else
        v_koz := v_koz || jsonb_build_object('hat',
          (array['silindir','kask'])[1 + (floor(public.bot_rasgele('o2:' || coalesce(r.takma_ad, '')) * 2))::int]);
      end if;
    end if;

    update public.profiles
       set gorunum = coalesce(gorunum, '{}'::jsonb)
                     || jsonb_build_object('karakter', v_kar, 'kozmetik', v_koz)
     where id = r.id;
    v_sayi := v_sayi + 1;
  end loop;

  return v_sayi;
end;
$bgu$;

revoke all on function public.bot_gorunum_uret() from public, authenticated, anon;

select public.bot_gorunum_uret();
