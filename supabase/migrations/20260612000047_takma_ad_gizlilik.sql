-- ============================================================
-- 47 — GİZLİLİK + TAKMA AD + DAVET + BİLDİRİM DÜZENİ (Bildim!)
--
-- Kök sorun: handle_new_user kullanıcı adını Google `full_name`'den üretiyor ve
-- Google fotoğrafını otomatik alıyordu → herkes gerçek adı ve yüzü görüyordu.
-- Ayrıca hiç oynamamış 0 puanlı üyeler ligde listeleniyordu.
--
-- Çözüm mimarisi (kararlar PROGRESS.md'de):
--   * `profiles.gorunen_ad` / `gorunen_avatar` **STORED GENERATED** kolonlar.
--     Böylece yalnız RPC'ler değil, PostgREST gömülü join'leri ve realtime
--     yayınları da otomatik olarak güvenli değeri döndürür — tek noktadan
--     gizlilik. Hiçbir yerde ham `username`/`avatar_url` sızmaz.
--   * `profiles_select` politikasına DOKUNULMADI (diğer oyun modülleri kırılmasın).
--     Bunun yerine anon rolünden kolon bazlı SELECT yetkisi alındı.
--   * `toplam_mac` maç bitiş TRIGGER'larıyla artar — mevcut büyük advance_*
--     fonksiyonları yeniden yazılmadı (minimal değişiklik).
--
-- KAPSAM: yalnız Bildim. Diğer oyunların tablo/RPC'lerine dokunulmadı.
-- Puanlama mantığına dokunulmadı.
-- ============================================================

-- ============================================================
-- 1) PROFİL KOLONLARI
-- ============================================================

alter table public.profiles
  add column if not exists takma_ad text,
  add column if not exists takma_ad_secildi boolean not null default false,
  add column if not exists takma_ad_degisti_at timestamptz,
  add column if not exists avatar_onayli boolean not null default false,
  add column if not exists davet_kodu text,
  add column if not exists toplam_mac int not null default 0,
  add column if not exists tercih_kategori text;

-- Takma ad: büyük-küçük harf duyarsız benzersiz
create unique index if not exists idx_profiles_takma_ad_ci
  on public.profiles (lower(takma_ad)) where takma_ad is not null;

-- ---------- Davet kodu (8 karakter, çakışmasız) ----------

create or replace function public.yeni_davet_kodu()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kod text;
  v_deneme int := 0;
begin
  loop
    -- Karışması kolay karakterler (0/O, 1/I) dışarıda
    -- pgcrypto Supabase'de 'extensions' şemasında; search_path=public olduğu için
    -- gen_random_bytes yerine md5 kullanılıyor (bağımlılık yok).
    v_kod := upper(substr(translate(md5(random()::text || clock_timestamp()::text), 'abcdef', 'JKMNPR'), 1, 8));
    exit when not exists (select 1 from public.profiles p where p.davet_kodu = v_kod);
    v_deneme := v_deneme + 1;
    if v_deneme > 20 then
      v_kod := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit;
    end if;
  end loop;
  return v_kod;
end;
$$;

revoke execute on function public.yeni_davet_kodu() from public, anon, authenticated;

-- Mevcut satırlara davet kodu doldur
do $$
declare r record;
begin
  for r in select id from public.profiles where davet_kodu is null loop
    update public.profiles set davet_kodu = public.yeni_davet_kodu() where id = r.id;
  end loop;
end $$;

create unique index if not exists idx_profiles_davet_kodu
  on public.profiles (davet_kodu) where davet_kodu is not null;

-- ---------- Botlar: takma adı hazır kabul edilir ----------
-- NOT: Şemada bot işareti `is_bot` kolonudur (`provider` değil); mevcut kodun
-- tamamı is_bot kullanıyor, o yüzden bu kolon esas alındı.
update public.profiles
   set takma_ad = username,
       takma_ad_secildi = true,
       avatar_onayli = true
 where coalesce(is_bot, false)
   and (takma_ad is null or not takma_ad_secildi);

-- ============================================================
-- 2) GÖRÜNEN AD / GÖRÜNEN AVATAR (stored generated)
-- Gerçek ad ve Google fotoğrafı hiçbir okuma yolundan çıkmaz.
-- ============================================================

alter table public.profiles
  add column if not exists gorunen_ad text
    generated always as (
      case when takma_ad_secildi and takma_ad is not null then takma_ad else 'Oyuncu' end
    ) stored;

alter table public.profiles
  add column if not exists gorunen_avatar text
    generated always as (
      case when avatar_onayli then avatar_url else null end
    ) stored;

-- Anon rolü gerçek adı/fotoğrafı hiç görmesin (authenticated'a DOKUNULMADI;
-- `profiles_select` politikası da aynen duruyor — diğer modüller etkilenmez).
revoke select (username, avatar_url) on public.profiles from anon;

-- ============================================================
-- 3) YENİ KULLANICI: gerçek ad/fotoğraf ALINMAZ
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, provider, davet_kodu)
  values (
    new.id,
    'oyuncu_' || substr(md5(new.id::text || random()::text), 1, 8),
    null,                                    -- Google fotoğrafı ALINMAZ
    new.raw_app_meta_data->>'provider',
    public.yeni_davet_kodu()
  );
  return new;
end;
$$;

-- ============================================================
-- 4) YASAKLI KELİMELER + TAKMA AD SEÇİMİ
-- ============================================================

create table if not exists public.yasakli_kelimeler (
  kelime text primary key
);

alter table public.yasakli_kelimeler enable row level security;
revoke all on public.yasakli_kelimeler from authenticated, anon;
-- İstemci listeyi görmez; doğrulama yalnız sunucuda (RPC) yapılır.

insert into public.yasakli_kelimeler (kelime) values
  ('admin'),('administrator'),('moderator'),('mod'),('bildim'),('bot'),
  ('sistem'),('system'),('destek'),('support'),('yonetici'),('yönetici'),
  ('amk'),('aq'),('oc'),('orospu'),('pic'),('piç'),('sik'),('sikik'),('sikeyim'),
  ('yarrak'),('yarak'),('gotveren'),('götveren'),('got'),('amcik'),('amcık'),
  ('amina'),('amına'),('anani'),('ananı'),('avrat'),('kahpe'),('kaltak'),
  ('serefsiz'),('şerefsiz'),('pezevenk'),('gavat'),('ibne'),('top'),('nonos'),
  ('salak'),('aptal'),('gerizekali'),('gerizekalı'),('mal'),('embesil'),
  ('fuck'),('shit'),('bitch'),('cunt'),('dick'),('pussy'),('nigger'),('nazi'),
  ('hitler'),('pkk'),('isis'),('terorist'),('terörist')
on conflict (kelime) do nothing;

-- Takma ad seçimi/değişimi. 30 günde bir değiştirilebilir.
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

  if v_p.takma_ad_secildi
     and v_p.takma_ad_degisti_at is not null
     and v_p.takma_ad_degisti_at > now() - interval '30 days'
  then
    v_kalan := (v_p.takma_ad_degisti_at + interval '30 days') - now();
    raise exception 'Takma adını 30 günde bir değiştirebilirsin. Kalan: % gün',
      greatest(1, extract(day from v_kalan)::int);
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

-- ============================================================
-- 5) AVATAR ONAYI
-- p_url null  -> avatar yok (harf rozeti gösterilir)
-- p_url '/…'  -> uygulamadaki hazır avatar
-- p_url https -> kullanıcının onayladığı Google fotoğrafı
-- ============================================================

create or replace function public.avatar_onayla(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_url := nullif(btrim(coalesce(p_url, '')), '');

  if v_url is null then
    update public.profiles
       set avatar_url = null, avatar_onayli = false
     where id = auth.uid();
    return;
  end if;

  if length(v_url) > 500 then raise exception 'Avatar adresi çok uzun'; end if;
  if v_url !~ '^(/[A-Za-z0-9._/-]+|https://[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]+)$' then
    raise exception 'Geçersiz avatar adresi';
  end if;

  update public.profiles
     set avatar_url = v_url, avatar_onayli = true
   where id = auth.uid();
end;
$$;

revoke execute on function public.avatar_onayla(text) from public, anon;
grant execute on function public.avatar_onayla(text) to authenticated;

-- ============================================================
-- 6) KENDİ PROFİLİ + VARSAYILAN KATEGORİ
-- ============================================================

create or replace function public.profil_al()
returns table (
  id uuid,
  username text,
  takma_ad text,
  takma_ad_secildi boolean,
  takma_ad_degisti_at timestamptz,
  gorunen_ad text,
  avatar_url text,
  avatar_onayli boolean,
  gorunen_avatar text,
  davet_kodu text,
  puan int,
  puan_hafta int,
  sampiyonluk int,
  seri int,
  toplam_mac int,
  tercih_kategori text,
  ulke text,
  sehir text,
  konum_degisti_at timestamptz,
  dil text,
  davet_sayisi int,
  hile_yetkisi boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.takma_ad, p.takma_ad_secildi, p.takma_ad_degisti_at,
         p.gorunen_ad, p.avatar_url, p.avatar_onayli, p.gorunen_avatar,
         p.davet_kodu, p.puan, p.puan_hafta, p.sampiyonluk, coalesce(p.seri, 0),
         p.toplam_mac, p.tercih_kategori, p.ulke, p.sehir, p.konum_degisti_at,
         p.dil, coalesce(p.davet_sayisi, 0), coalesce(p.hile_yetkisi, false)
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.profil_al() from public, anon;
grant execute on function public.profil_al() to authenticated;

create or replace function public.tercih_kategori_kaydet(p_kategori text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kat text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');

  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat)
  then
    raise exception 'Geçersiz kategori';
  end if;

  update public.profiles set tercih_kategori = v_kat where id = auth.uid();
end;
$$;

revoke execute on function public.tercih_kategori_kaydet(text) from public, anon;
grant execute on function public.tercih_kategori_kaydet(text) to authenticated;

-- ============================================================
-- 7) BİLDİRİMLER (uygulama içi)
-- ============================================================

create table if not exists public.bildirimler (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tip text not null,
  metin text not null,
  yol text,
  okundu boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bildirimler enable row level security;
drop policy if exists "bildirimler_select_own" on public.bildirimler;
create policy "bildirimler_select_own" on public.bildirimler for select
  using (auth.uid() = user_id);
revoke all on public.bildirimler from authenticated, anon;
grant select on public.bildirimler to authenticated;   -- yazma yalnız sunucuda

create index if not exists idx_bildirimler_kullanici
  on public.bildirimler (user_id, okundu, created_at desc);

create or replace function public.bildirim_yaz(p_user uuid, p_tip text, p_metin text, p_yol text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.bildirimler (user_id, tip, metin, yol)
  select p_user, p_tip, p_metin, p_yol
  where p_user is not null
    and not exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false));
$$;

revoke execute on function public.bildirim_yaz(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.bildirimleri_oku()
returns void
language sql
security definer
set search_path = public
as $$
  update public.bildirimler set okundu = true
  where user_id = auth.uid() and not okundu;
$$;

revoke execute on function public.bildirimleri_oku() from public, anon;
grant execute on function public.bildirimleri_oku() to authenticated;

-- ============================================================
-- 8) toplam_mac — maç bitişlerinde TRIGGER ile artar
--    (mevcut advance_* fonksiyonları değiştirilmedi)
-- ============================================================

-- Geriye dönük doldurma: bitmiş 1v1 + grup + hızlı + turnuva katılımları
with sayim as (
  select k.uid, count(*)::int as adet
  from (
    select m.oyuncu1 as uid from public.matches m where m.durum = 'bitti'
    union all
    select m.oyuncu2 from public.matches m where m.durum = 'bitti'
    union all
    select gmp.user_id
      from public.group_match_players gmp
      join public.group_matches gm on gm.id = gmp.group_match_id
     where gm.durum = 'bitti' and gmp.davet_durumu = 'kabul'
    union all
    select ho.user_id
      from public.hizli_oyuncular ho
      join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
     where hm.durum = 'bitti' and ho.davet_durumu = 'kabul'
    union all
    select tp.user_id
      from public.tournament_players tp
      join public.tournaments t on t.id = tp.tournament_id
     where t.durum = 'bitti'
  ) k
  group by k.uid
)
update public.profiles p
   set toplam_mac = s.adet
  from sayim s
 where p.id = s.uid;

create or replace function public.mac_sayaci_arttir(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  update public.profiles
     set toplam_mac = toplam_mac + 1
   where id = p_user
  returning toplam_mac into v_yeni;

  -- İlk maç: artık ligde görünüyor
  if v_yeni = 1 then
    perform public.bildirim_yaz(
      p_user, 'lige_girdin',
      'İlk maçını tamamladın — artık şehir, ülke ve dünya liglerindesin! 🏙️',
      '/bildim/siralama'
    );
  end if;
end;
$$;

revoke execute on function public.mac_sayaci_arttir(uuid) from public, anon, authenticated;

-- 1v1
create or replace function public.trg_mac_bitti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    perform public.mac_sayaci_arttir(new.oyuncu1);
    perform public.mac_sayaci_arttir(new.oyuncu2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matches_bitti on public.matches;
create trigger trg_matches_bitti
  after update of durum on public.matches
  for each row execute function public.trg_mac_bitti();

-- Grup maçı
create or replace function public.trg_grup_bitti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in
      select gmp.user_id from public.group_match_players gmp
      where gmp.group_match_id = new.id and gmp.davet_durumu = 'kabul'
    loop
      perform public.mac_sayaci_arttir(r.user_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_matches_bitti on public.group_matches;
create trigger trg_group_matches_bitti
  after update of durum on public.group_matches
  for each row execute function public.trg_grup_bitti();

-- Hızlı mod
create or replace function public.trg_hizli_bitti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in
      select ho.user_id from public.hizli_oyuncular ho
      where ho.hizli_mac_id = new.id and ho.davet_durumu = 'kabul'
    loop
      perform public.mac_sayaci_arttir(r.user_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hizli_maclar_bitti on public.hizli_maclar;
create trigger trg_hizli_maclar_bitti
  after update of durum on public.hizli_maclar
  for each row execute function public.trg_hizli_bitti();

-- Turnuva
create or replace function public.trg_turnuva_bitti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in
      select tp.user_id from public.tournament_players tp
      where tp.tournament_id = new.id
    loop
      perform public.mac_sayaci_arttir(r.user_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tournaments_bitti on public.tournaments;
create trigger trg_tournaments_bitti
  after update of durum on public.tournaments
  for each row execute function public.trg_turnuva_bitti();

-- ============================================================
-- 9) "Haftalık ligde biri seni geçti" bildirimi (saatte en fazla 1)
-- ============================================================

create or replace function public.trg_gecilme_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.puan_hafta <= old.puan_hafta then return new; end if;
  if coalesce(new.is_bot, false) then return new; end if;
  if coalesce(new.toplam_mac, 0) < 1 then return new; end if;

  -- Yalnız bu güncellemeyle geçilen, en yakın birkaç oyuncu
  for r in
    select p.id
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and p.id <> new.id
      and coalesce(p.toplam_mac, 0) >= 1
      and p.ulke is not distinct from new.ulke
      and p.puan_hafta > old.puan_hafta
      and p.puan_hafta <= new.puan_hafta
    order by p.puan_hafta desc
    limit 3
  loop
    if not exists (
      select 1 from public.bildirimler b
      where b.user_id = r.id and b.tip = 'gecildin'
        and b.created_at > now() - interval '1 hour'
    ) then
      perform public.bildirim_yaz(
        r.id, 'gecildin',
        new.gorunen_ad || ' haftalık ligde seni geçti! Sıranı geri al. ⚡',
        '/bildim/siralama'
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_profiles_gecilme on public.profiles;
create trigger trg_profiles_gecilme
  after update of puan_hafta on public.profiles
  for each row execute function public.trg_gecilme_bildir();

-- ============================================================
-- 10) DAVET KODUYLA ARKADAŞ EKLEME (kullanıcı adıyla arama KALKTI)
-- ============================================================

create or replace function public.arkadas_davet_kodu_ile_ekle(p_kod text)
returns table (durum text, gorunen_ad text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hedef public.profiles%rowtype;
  v_kod text;
  v_ters uuid;
  v_mevcut text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_kod := upper(btrim(coalesce(p_kod, '')));
  if length(v_kod) <> 8 then raise exception 'Davet kodu 8 karakter olmalı.'; end if;

  select * into v_hedef from public.profiles p where p.davet_kodu = v_kod;
  if not found then raise exception 'Böyle bir davet kodu yok.'; end if;
  if v_hedef.id = auth.uid() then raise exception 'Kendi davet kodunu kullanamazsın.'; end if;
  if coalesce(v_hedef.is_bot, false) then raise exception 'Bu kod kullanılamaz.'; end if;

  select f.durum into v_mevcut from public.friendships f
  where (f.requester = auth.uid() and f.addressee = v_hedef.id)
     or (f.requester = v_hedef.id and f.addressee = auth.uid());

  if v_mevcut = 'arkadas' then
    return query select 'zaten_arkadas'::text, v_hedef.gorunen_ad;
    return;
  end if;

  -- Karşı taraf zaten istek gönderdiyse doğrudan arkadaş ol
  select f.id into v_ters from public.friendships f
  where f.requester = v_hedef.id and f.addressee = auth.uid();
  if found then
    update public.friendships set durum = 'arkadas' where id = v_ters;
    perform public.bildirim_yaz(
      v_hedef.id, 'arkadas_kabul',
      (select gorunen_ad from public.profiles where id = auth.uid()) || ' arkadaşın oldu! 🤝',
      '/bildim/arkadaslar'
    );
    return query select 'arkadas_oldu'::text, v_hedef.gorunen_ad;
    return;
  end if;

  insert into public.friendships (requester, addressee)
  values (auth.uid(), v_hedef.id)
  on conflict (requester, addressee) do nothing;

  perform public.bildirim_yaz(
    v_hedef.id, 'arkadas_istek',
    (select gorunen_ad from public.profiles where id = auth.uid()) || ' sana arkadaşlık isteği gönderdi.',
    '/bildim/arkadaslar'
  );

  return query select 'istek_gonderildi'::text, v_hedef.gorunen_ad;
end;
$$;

revoke execute on function public.arkadas_davet_kodu_ile_ekle(text) from public, anon;
grant execute on function public.arkadas_davet_kodu_ile_ekle(text) to authenticated;

-- Kullanıcı adıyla oyuncu arama KAPATILDI (gerçek ad sızdırıyordu).
revoke execute on function public.oyuncu_ara(text) from authenticated;

-- ============================================================
-- 11) MAÇ HEDEFİ: yalnız arkadaş ya da bot
-- ============================================================

create or replace function public.oynanabilir_mi(p_hedef uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select is_bot from public.profiles where id = p_hedef), false)
    or exists (
      select 1 from public.friendships f
      where f.durum = 'arkadas'
        and ((f.requester = auth.uid() and f.addressee = p_hedef)
          or (f.requester = p_hedef and f.addressee = auth.uid()))
    );
$$;

revoke execute on function public.oynanabilir_mi(uuid) from public, anon, authenticated;

create or replace function public.create_challenge(p_rakip uuid, p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;

  perform public.mac_kotasi_kontrol();

  insert into public.matches (oyuncu1, oyuncu2, kategori)
  values (auth.uid(), p_rakip, p_kategori)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_challenge(uuid, text) from public, anon;
grant execute on function public.create_challenge(uuid, text) to authenticated;

create or replace function public.create_group_challenge(p_rakipler uuid[], p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi not in (2, 3, 4) then
    raise exception 'Grup için 2, 3 veya 4 rakip seçmelisin (toplam 3-5 kişi)';
  end if;
  if auth.uid() = any(p_rakipler) then
    raise exception 'Kendini seçemezsin';
  end if;
  if v_sayi <> (select count(distinct x) from unnest(p_rakipler) x) then
    raise exception 'Aynı oyuncuyu birden fazla seçemezsin';
  end if;
  foreach v_r in array p_rakipler loop
    if not exists (select 1 from public.profiles where id = v_r) then
      raise exception 'Oyuncu bulunamadı';
    end if;
    if not public.oynanabilir_mi(v_r) then
      raise exception 'Gruba yalnız arkadaşlarını ve botları çağırabilirsin.';
    end if;
  end loop;

  perform public.mac_kotasi_kontrol();

  insert into public.group_matches (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), v_sayi + 1, p_kategori)
  returning id into v_id;

  insert into public.group_match_players (group_match_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.group_match_players (group_match_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.create_group_challenge(uuid[], text) from public, anon;
grant execute on function public.create_group_challenge(uuid[], text) to authenticated;

create or replace function public.create_hizli_mac(p_rakipler uuid[], p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi <> 4 then
    raise exception 'Hızlı mod için tam 4 rakip seçmelisin (toplam 5 kişi)';
  end if;
  if auth.uid() = any(p_rakipler) then
    raise exception 'Kendini seçemezsin';
  end if;
  if v_sayi <> (select count(distinct x) from unnest(p_rakipler) x) then
    raise exception 'Aynı oyuncuyu birden fazla seçemezsin';
  end if;
  foreach v_r in array p_rakipler loop
    if not exists (select 1 from public.profiles where id = v_r) then
      raise exception 'Oyuncu bulunamadı';
    end if;
    if not public.oynanabilir_mi(v_r) then
      raise exception 'Hızlı maça yalnız arkadaşlarını ve botları çağırabilirsin.';
    end if;
  end loop;

  perform public.mac_kotasi_kontrol();

  insert into public.hizli_maclar (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), 5, p_kategori)
  returning id into v_id;

  insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.hizli_oyuncular (hizli_mac_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.create_hizli_mac(uuid[], text) from public, anon;
grant execute on function public.create_hizli_mac(uuid[], text) to authenticated;

-- ============================================================
-- 12) LİG GÖRÜNÜRLÜĞÜ: yalnız en az 1 maç oynamışlar
--     + görünen ad/avatar döndürülür
-- ============================================================

drop function if exists public.lig_siralama(text, text);
create or replace function public.lig_siralama(
  p_kapsam text default 'global',
  p_donem text default 'hafta'
)
returns table (
  sira bigint,
  user_id uuid,
  gorunen_ad text,
  gorunen_avatar text,
  puan int,
  sehir text,
  ulke text,
  ben boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ulke text;
  v_sehir text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_kapsam not in ('sehir', 'ulke', 'global') then raise exception 'Geçersiz kapsam'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir into v_ulke, v_sehir from public.profiles p where p.id = v_me;

  if p_kapsam in ('sehir', 'ulke') and v_ulke is null then
    raise exception 'Önce ülkeni ve şehrini seçmelisin';
  end if;
  if p_kapsam = 'sehir' and v_sehir is null then
    raise exception 'Önce şehrini seçmelisin';
  end if;

  return query
  with sirali as (
    select p.id,
           p.gorunen_ad as p_ad,
           p.gorunen_avatar as p_avatar,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as p_puan,
           p.sehir,
           p.ulke,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.gorunen_ad asc
           ) as p_sira
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.toplam_mac, 0) >= 1            -- hiç oynamamışlar ligde yok
      and (p_donem <> 'hafta' or p.puan_hafta > 0)  -- haftalıkta ayrıca puan şartı
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.p_ad, s.p_avatar, s.p_puan, s.sehir, s.ulke, (s.id = v_me)
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$$;

revoke execute on function public.lig_siralama(text, text) from public, anon;
grant execute on function public.lig_siralama(text, text) to authenticated;

-- Şehir toplamları da yalnız oynamışları saysın
create or replace function public.sehir_lig_sirasi(p_donem text default 'hafta')
returns table (
  sehir text,
  ulke text,
  sira bigint,
  sehir_sayisi bigint,
  toplam_puan bigint,
  oyuncu_sayisi bigint,
  benim_sehrim boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ulke text;
  v_sehir text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir into v_ulke, v_sehir from public.profiles p where p.id = v_me;
  if v_ulke is null then raise exception 'Önce ülkeni ve şehrini seçmelisin'; end if;

  return query
  with toplamlar as (
    select p.sehir as s_sehir,
           p.ulke as s_ulke,
           sum(case when p_donem = 'hafta' then p.puan_hafta else p.puan end)::bigint as s_puan,
           count(*)::bigint as s_oyuncu
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.toplam_mac, 0) >= 1
      and p.ulke = v_ulke
      and p.sehir is not null
    group by p.sehir, p.ulke
  ), sirali as (
    select t.*,
           row_number() over (order by t.s_puan desc, t.s_sehir asc) as t_sira,
           count(*) over () as t_toplam
    from toplamlar t
  )
  select s.s_sehir, s.s_ulke, s.t_sira, s.t_toplam, s.s_puan, s.s_oyuncu,
         (s.s_sehir is not distinct from v_sehir)
  from sirali s
  where s.t_sira <= 100 or s.s_sehir is not distinct from v_sehir
  order by s.t_sira;
end;
$$;

revoke execute on function public.sehir_lig_sirasi(text) from public, anon;
grant execute on function public.sehir_lig_sirasi(text) to authenticated;

-- benim_lig_durumum: aynı görünürlük kuralları
create or replace function public.benim_lig_durumum(p_donem text default 'hafta')
returns table (
  puan int,
  sehir text,
  ulke text,
  sira_sehir bigint,
  sehir_oyuncu bigint,
  sira_ulke bigint,
  ulke_oyuncu bigint,
  sira_global bigint,
  global_oyuncu bigint,
  sehrin_ulke_sirasi bigint,
  ulkedeki_sehir_sayisi bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ulke text;
  v_sehir text;
  v_puan int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir,
         case when p_donem = 'hafta' then p.puan_hafta else p.puan end
    into v_ulke, v_sehir, v_puan
  from public.profiles p where p.id = v_me;

  return query
  with lig as (
    select p.id, p.ulke, p.sehir,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as lp
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.toplam_mac, 0) >= 1
      and (p_donem <> 'hafta' or p.puan_hafta > 0)
  )
  select
    coalesce(v_puan, 0),
    v_sehir,
    v_ulke,
    case when v_sehir is null then null else
      (select count(*) + 1 from lig l where l.ulke = v_ulke and l.sehir = v_sehir and l.lp > coalesce(v_puan, 0)) end,
    case when v_sehir is null then null else
      (select count(*) from lig l where l.ulke = v_ulke and l.sehir = v_sehir) end,
    case when v_ulke is null then null else
      (select count(*) + 1 from lig l where l.ulke = v_ulke and l.lp > coalesce(v_puan, 0)) end,
    case when v_ulke is null then null else
      (select count(*) from lig l where l.ulke = v_ulke) end,
    (select count(*) + 1 from lig l where l.lp > coalesce(v_puan, 0)),
    (select count(*) from lig l),
    case when v_sehir is null then null else (
      with t as (
        select l.sehir as s, sum(l.lp) as sp from lig l
        where l.ulke = v_ulke and l.sehir is not null
        group by l.sehir
      )
      select count(*) + 1 from t
      where t.sp > coalesce((select t2.sp from t t2 where t2.s = v_sehir), 0)
    ) end,
    case when v_ulke is null then null else
      (select count(distinct l.sehir) from lig l where l.ulke = v_ulke and l.sehir is not null) end;
end;
$$;

revoke execute on function public.benim_lig_durumum(text) from public, anon;
grant execute on function public.benim_lig_durumum(text) to authenticated;

-- ============================================================
-- 13) Hub birleşik sıralaması: Bildim kısmı yalnız oynamışları sayar,
--     ad/avatar görünen değerlerden gelir.
--     (Diğer oyunların skor kaynaklarına DOKUNULMADI.)
-- ============================================================

drop function if exists public.birlesik_siralama();
create or replace function public.birlesik_siralama()
returns table (
  user_id uuid,
  gorunen_ad text,
  gorunen_avatar text,
  bildim int,
  kafatopu int,
  meyvekes int,
  patirun int,
  driftgp int,
  toplam int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.gorunen_ad,
    p.gorunen_avatar,
    (case when coalesce(p.toplam_mac, 0) >= 1 then coalesce(p.puan, 0) else 0 end) as bildim,
    coalesce(kt.puan, 0)                                           as kafatopu,
    coalesce(mk.en_iyi, 0)                                         as meyvekes,
    coalesce(pr.puan, 0)                                           as patirun,
    coalesce(dg.xp, 0)                                             as driftgp,
    ( (case when coalesce(p.toplam_mac, 0) >= 1 then coalesce(p.puan, 0) else 0 end)
      + coalesce(kt.puan, 0) + coalesce(mk.en_iyi, 0)
      + coalesce(pr.puan, 0) + coalesce(dg.xp, 0) )                as toplam
  from public.profiles p
  left join public.kafatopu_profiller kt on kt.user_id = p.id
  left join (
    select user_id, sum(en_iyi)::int as en_iyi
    from public.meyvekes_skorlar
    group by user_id
  ) mk on mk.user_id = p.id
  left join public.pr_users pr on pr.id = p.id
  left join (
    select id, coalesce((data ->> 'xp')::int, 0) as xp
    from public.dg_profiles
  ) dg on dg.id = p.id
  where coalesce(p.is_bot, false) = false
  order by toplam desc, p.gorunen_ad asc
  limit 100;
$$;

revoke all on function public.birlesik_siralama() from public;
grant execute on function public.birlesik_siralama() to authenticated;

-- ============================================================
-- 14) Haftalık kapanış: arşiv + Pazartesi bildirimi (uygulama içi de yazılır)
-- ============================================================

create or replace function public.haftayi_kapat()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hafta date;
  r record;
begin
  v_hafta := (date_trunc('week', (now() at time zone 'Europe/Istanbul') - interval '1 day'))::date;

  if exists (select 1 from public.lig_arsiv where hafta = v_hafta) then
    return;
  end if;

  insert into public.lig_arsiv (user_id, hafta, puan, sehir, ulke, sira_sehir, sira_ulke, sira_global)
  select p.id, v_hafta, p.puan_hafta, p.sehir, p.ulke,
         case when p.sehir is not null and p.ulke is not null
              then rank() over (partition by p.ulke, p.sehir order by p.puan_hafta desc) end,
         case when p.ulke is not null
              then rank() over (partition by p.ulke order by p.puan_hafta desc) end,
         rank() over (order by p.puan_hafta desc)
  from public.profiles p
  where coalesce(p.is_bot, false) = false
    and coalesce(p.toplam_mac, 0) >= 1
    and p.puan_hafta > 0
  on conflict (user_id, hafta) do nothing;

  for r in
    select a.user_id, a.sira_global
    from public.lig_arsiv a
    where a.hafta = v_hafta and a.sira_global <= 3
  loop
    perform public.award_badge(
      r.user_id,
      case r.sira_global when 1 then 'hafta_1' when 2 then 'hafta_2' else 'hafta_3' end
    );
  end loop;

  for r in
    select a.user_id from public.lig_arsiv a
    where a.hafta = v_hafta and a.sira_sehir = 1
  loop
    perform public.award_badge(r.user_id, 'sehir_krali');
  end loop;

  -- Uygulama içi haftalık sonuç bildirimi (push'tan bağımsız, herkese)
  for r in
    select a.user_id, a.sira_sehir, a.sira_global, a.sehir, a.puan
    from public.lig_arsiv a
    where a.hafta = v_hafta
  loop
    perform public.bildirim_yaz(
      r.user_id, 'hafta_sonuc',
      case
        when r.sira_sehir is not null
          then 'Geçen hafta ' || coalesce(r.sehir, 'şehrinde') || ' liginde ' ||
               r.sira_sehir || '. oldun (' || r.puan || ' puan). Yeni hafta başladı!'
        else 'Geçen hafta dünya ligindeki sıran: ' || r.sira_global ||
             ' (' || r.puan || ' puan). Yeni hafta başladı!'
      end,
      '/bildim/siralama'
    );
  end loop;

  update public.profiles set puan_hafta = 0 where puan_hafta <> 0;
end;
$$;

revoke execute on function public.haftayi_kapat() from public, anon, authenticated;
