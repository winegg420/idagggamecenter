-- ============================================================
-- 45 — LİG ve KATEGORİ paketi (Bildim! farklılaştırma)
--
-- Bu migration mevcut yapıyı BOZMADAN üstüne inşa eder:
--   1) profiles: ulke / sehir / dil / konum_degisti_at (+ haftada 1 değişim kilidi)
--   2) ulkeler + sehirler statik tabloları (81 il) — sunucu tarafı doğrulama
--   3) Haftalık lig: lig_arsiv + haftayi_kapat() (eski "puan_hafta sıfırla"
--      cron'unun yerine geçer) + haftalik_sonuc_bildir()
--   4) lig_siralama() / sehir_lig_sirasi() — şehir / ülke / dünya, hafta / tüm zamanlar
--   5) Kategori seçmeli yarış: soru seçimi tek yerden (soru_sec)
--   6) gorulen_sorular — görülen soru tekrarını azaltır
--   7) Saatlik maç başlatma kotası (rank kasmaya karşı)
--   8) questions.dil (şema hazırlığı; arayüz çevirisi bu pakette YOK)
--
-- Puanlama mantığına DOKUNULMADI.
-- ============================================================

-- ============================================================
-- 1) PROFİL: konum ve dil alanları
-- ============================================================

alter table public.profiles
  add column if not exists ulke text,                    -- ISO-3166 alpha-2, ör. 'TR'
  add column if not exists sehir text,
  add column if not exists dil text not null default 'tr',
  add column if not exists konum_degisti_at timestamptz;

-- NOT: profiles üzerinde authenticated'a yalnızca (username, avatar_url) update
-- yetkisi var (init.sql). ulke/sehir bilerek doğrudan yazılamaz; sadece
-- profil_konum_kaydet() RPC'si üzerinden ve haftada 1 kez değişir.

create index if not exists idx_profiles_ulke_hafta
  on public.profiles (ulke, puan_hafta desc);
create index if not exists idx_profiles_sehir_hafta
  on public.profiles (ulke, sehir, puan_hafta desc);
create index if not exists idx_profiles_ulke_puan
  on public.profiles (ulke, puan desc);
create index if not exists idx_profiles_sehir_puan
  on public.profiles (ulke, sehir, puan desc);

-- ============================================================
-- 2) ÜLKE ve ŞEHİR listeleri (statik tablo)
--
-- Karar: frontend sabit dosyası yerine TABLO seçildi. Gerekçe: şehir/ülke
-- haftada 1 kez değişebiliyor ve tüm lig sıralaması buna dayanıyor; istemciye
-- güvenilemez. Tablo olunca profil_konum_kaydet() sunucuda doğrulayabiliyor
-- ve yeni ülke eklemek için yeniden deploy gerekmiyor. Bayrak emojisi ISO
-- kodundan istemcide türetilir (saklanmaz) — ek kolon/kod maliyeti yok.
-- ============================================================

create table if not exists public.ulkeler (
  kod text primary key,          -- ISO-3166 alpha-2, büyük harf
  ad text not null
);

create table if not exists public.sehirler (
  ulke text not null references public.ulkeler(kod) on delete cascade,
  ad text not null,
  primary key (ulke, ad)
);

alter table public.ulkeler enable row level security;
alter table public.sehirler enable row level security;

drop policy if exists "ulkeler_select" on public.ulkeler;
create policy "ulkeler_select" on public.ulkeler for select using (true);
drop policy if exists "sehirler_select" on public.sehirler;
create policy "sehirler_select" on public.sehirler for select using (true);

revoke all on public.ulkeler from authenticated, anon;
revoke all on public.sehirler from authenticated, anon;
grant select on public.ulkeler to authenticated;
grant select on public.sehirler to authenticated;

insert into public.ulkeler (kod, ad) values
  ('TR','Türkiye'),('DE','Almanya'),('US','Amerika Birleşik Devletleri'),
  ('GB','Birleşik Krallık'),('FR','Fransa'),('NL','Hollanda'),('BE','Belçika'),
  ('AT','Avusturya'),('CH','İsviçre'),('SE','İsveç'),('NO','Norveç'),
  ('DK','Danimarka'),('FI','Finlandiya'),('IT','İtalya'),('ES','İspanya'),
  ('PT','Portekiz'),('PL','Polonya'),('RO','Romanya'),('BG','Bulgaristan'),
  ('GR','Yunanistan'),('RU','Rusya'),('UA','Ukrayna'),('AZ','Azerbaycan'),
  ('KZ','Kazakistan'),('UZ','Özbekistan'),('KG','Kırgızistan'),('TM','Türkmenistan'),
  ('GE','Gürcistan'),('IR','İran'),('IQ','Irak'),('SY','Suriye'),('LB','Lübnan'),
  ('JO','Ürdün'),('IL','İsrail'),('SA','Suudi Arabistan'),('AE','Birleşik Arap Emirlikleri'),
  ('QA','Katar'),('KW','Kuveyt'),('EG','Mısır'),('LY','Libya'),('TN','Tunus'),
  ('DZ','Cezayir'),('MA','Fas'),('NG','Nijerya'),('ZA','Güney Afrika'),
  ('IN','Hindistan'),('PK','Pakistan'),('BD','Bangladeş'),('ID','Endonezya'),
  ('MY','Malezya'),('SG','Singapur'),('TH','Tayland'),('VN','Vietnam'),
  ('PH','Filipinler'),('CN','Çin'),('JP','Japonya'),('KR','Güney Kore'),
  ('AU','Avustralya'),('NZ','Yeni Zelanda'),('CA','Kanada'),('MX','Meksika'),
  ('BR','Brezilya'),('AR','Arjantin'),('CL','Şili'),('CO','Kolombiya'),
  ('CY','Kıbrıs'),('MK','Kuzey Makedonya'),('AL','Arnavutluk'),('RS','Sırbistan'),
  ('BA','Bosna-Hersek'),('XK','Kosova'),('MD','Moldova'),('HU','Macaristan'),
  ('CZ','Çekya'),('SK','Slovakya'),('HR','Hırvatistan'),('SI','Slovenya'),
  ('IE','İrlanda'),('IS','İzlanda'),('LU','Lüksemburg'),('EE','Estonya'),
  ('LV','Letonya'),('LT','Litvanya'),('BY','Belarus'),('AM','Ermenistan')
on conflict (kod) do nothing;

-- Türkiye'nin 81 ili
insert into public.sehirler (ulke, ad) values
  ('TR','Adana'),('TR','Adıyaman'),('TR','Afyonkarahisar'),('TR','Ağrı'),
  ('TR','Aksaray'),('TR','Amasya'),('TR','Ankara'),('TR','Antalya'),
  ('TR','Ardahan'),('TR','Artvin'),('TR','Aydın'),('TR','Balıkesir'),
  ('TR','Bartın'),('TR','Batman'),('TR','Bayburt'),('TR','Bilecik'),
  ('TR','Bingöl'),('TR','Bitlis'),('TR','Bolu'),('TR','Burdur'),
  ('TR','Bursa'),('TR','Çanakkale'),('TR','Çankırı'),('TR','Çorum'),
  ('TR','Denizli'),('TR','Diyarbakır'),('TR','Düzce'),('TR','Edirne'),
  ('TR','Elazığ'),('TR','Erzincan'),('TR','Erzurum'),('TR','Eskişehir'),
  ('TR','Gaziantep'),('TR','Giresun'),('TR','Gümüşhane'),('TR','Hakkâri'),
  ('TR','Hatay'),('TR','Iğdır'),('TR','Isparta'),('TR','İstanbul'),
  ('TR','İzmir'),('TR','Kahramanmaraş'),('TR','Karabük'),('TR','Karaman'),
  ('TR','Kars'),('TR','Kastamonu'),('TR','Kayseri'),('TR','Kilis'),
  ('TR','Kırıkkale'),('TR','Kırklareli'),('TR','Kırşehir'),('TR','Kocaeli'),
  ('TR','Konya'),('TR','Kütahya'),('TR','Malatya'),('TR','Manisa'),
  ('TR','Mardin'),('TR','Mersin'),('TR','Muğla'),('TR','Muş'),
  ('TR','Nevşehir'),('TR','Niğde'),('TR','Ordu'),('TR','Osmaniye'),
  ('TR','Rize'),('TR','Sakarya'),('TR','Samsun'),('TR','Şanlıurfa'),
  ('TR','Siirt'),('TR','Sinop'),('TR','Şırnak'),('TR','Sivas'),
  ('TR','Tekirdağ'),('TR','Tokat'),('TR','Trabzon'),('TR','Tunceli'),
  ('TR','Uşak'),('TR','Van'),('TR','Yalova'),('TR','Yozgat'),('TR','Zonguldak')
on conflict (ulke, ad) do nothing;

-- ---------- Konum kaydetme (haftada 1 kez) ----------

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

  -- Aynı değerler tekrar gönderildiyse sessizce geç (haftalık kilidi harcama)
  if v_mevcut_ulke is not null
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.ulke = v_ulke and p.sehir is not distinct from v_sehir
     )
  then
    return;
  end if;

  if v_son is not null and v_son > now() - interval '7 days' then
    v_kalan := (v_son + interval '7 days') - now();
    raise exception 'Konumunu haftada bir kez değiştirebilirsin. Kalan: % gün % saat',
      extract(day from v_kalan)::int, extract(hour from v_kalan)::int;
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

-- ============================================================
-- 8) SORU DİLİ (şema hazırlığı — arayüz çevirisi bu pakette yok)
-- ============================================================

alter table public.questions
  add column if not exists dil text not null default 'tr';

create index if not exists idx_questions_dil_kategori
  on public.questions (dil, kategori) where aktif;

-- ============================================================
-- 6) GÖRÜLEN SORULAR + tek noktadan soru seçimi
-- ============================================================

create table if not exists public.gorulen_sorular (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  gorulen_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.gorulen_sorular enable row level security;
drop policy if exists "gorulen_select_own" on public.gorulen_sorular;
create policy "gorulen_select_own" on public.gorulen_sorular for select
  using (auth.uid() = user_id);
revoke all on public.gorulen_sorular from authenticated, anon;
grant select on public.gorulen_sorular to authenticated;   -- yazma yalnızca RPC ile

create index if not exists idx_gorulen_question on public.gorulen_sorular (question_id);

-- Soru GÖSTERİLDİĞİ anda kaydedilir (maç bitince değil).
create or replace function public.gorulen_kaydet(p_question_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.gorulen_sorular (user_id, question_id)
  select auth.uid(), p_question_id
  where auth.uid() is not null and p_question_id is not null
  on conflict do nothing;
$$;

revoke execute on function public.gorulen_kaydet(uuid) from public, anon;
grant execute on function public.gorulen_kaydet(uuid) to authenticated;

-- Tüm modların soru seçimi buradan geçer:
--   * kategori filtresi (null = karışık)
--   * dil filtresi (oyuncunun profiles.dil değeri)
--   * verilen oyuncuların GÖRMEDİĞİ sorular önce; bitince en eski görülenler
--   * asla boş dönmez: yetersizse önce kategori, sonra dil gevşetilir
create or replace function public.soru_sec(
  p_kategori text,
  p_adet int,
  p_oyuncular uuid[] default '{}'::uuid[],
  p_dil text default null
)
returns uuid[]
language plpgsql
volatile          -- random() kullanıyor; planlayıcı sonucu önbelleklememeli
security definer
set search_path = public
as $$
declare
  v_oyn uuid[] := coalesce(p_oyuncular, '{}'::uuid[]);
  v_adet int := greatest(1, coalesce(p_adet, 1));
  v_kat text := p_kategori;
  v_dil text;
  v_ids uuid[] := '{}'::uuid[];
  v_deneme int;
begin
  v_dil := coalesce(
    nullif(btrim(coalesce(p_dil, '')), ''),
    (select pr.dil from public.profiles pr where pr.id = v_oyn[1]),
    'tr'
  );

  for v_deneme in 1..3 loop
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_ids
    from (
      select q.id
      from public.questions q
      left join lateral (
        select max(g.gorulen_at) as son
        from public.gorulen_sorular g
        where g.question_id = q.id and g.user_id = any(v_oyn)
      ) gs on true
      where q.aktif
        and (v_kat is null or q.kategori = v_kat)
        and q.dil = v_dil
      order by (gs.son is not null), gs.son asc, random()
      limit v_adet
    ) s;

    exit when coalesce(array_length(v_ids, 1), 0) >= v_adet;

    if v_kat is not null then
      v_kat := null;              -- kategoride yeterli soru yok → karışık
    elsif v_dil <> 'tr' then
      v_dil := 'tr';              -- o dilde havuz yok → Türkçeye düş
    else
      exit;
    end if;
  end loop;

  return v_ids;
end;
$$;

revoke execute on function public.soru_sec(text, int, uuid[], text) from public, anon, authenticated;

-- ============================================================
-- 7) KÖTÜYE KULLANIM KOTASI (saatlik maç başlatma)
-- ============================================================

create index if not exists idx_matches_oyuncu1_created
  on public.matches (oyuncu1, created_at desc);
create index if not exists idx_group_matches_kurucu_created
  on public.group_matches (kurucu, created_at desc);
create index if not exists idx_hizli_maclar_kurucu_created
  on public.hizli_maclar (kurucu, created_at desc);

-- Saat başına en fazla v_sinir maç başlatılabilir.
-- hileli_mi() (kurucu/geliştirici hesabı) muaftır.
create or replace function public.mac_kotasi_kontrol()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sinir constant int := 30;   -- SAATLİK MAÇ SINIRI
  v_sayi int;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if public.hileli_mi() then return; end if;

  select
      (select count(*) from public.matches m
        where m.oyuncu1 = auth.uid() and m.created_at > now() - interval '1 hour')
    + (select count(*) from public.group_matches gm
        where gm.kurucu = auth.uid() and gm.created_at > now() - interval '1 hour')
    + (select count(*) from public.hizli_maclar hm
        where hm.kurucu = auth.uid() and hm.created_at > now() - interval '1 hour')
    into v_sayi;

  if v_sayi >= v_sinir then
    raise exception 'Saatlik maç sınırına ulaştın (% maç/saat). Biraz sonra tekrar dene.', v_sinir;
  end if;
end;
$$;

revoke execute on function public.mac_kotasi_kontrol() from public, anon, authenticated;

-- ============================================================
-- 5) KATEGORİ + GÖRÜLMEMİŞ SORU: soru seçen fonksiyonların yenilenmesi
--    (yalnızca soru_ids seçimi ve kota kontrolü değişti; puanlama aynı)
-- ============================================================

-- ---------- Kategoriler: soru sayısı + oyuncunun çözdüğü sayı ----------

drop function if exists public.get_categories();
create or replace function public.get_categories()
returns table (kategori text, soru_sayisi bigint, gorulen_sayisi bigint)
language sql
stable
security definer
set search_path = public
as $$
  select q.kategori,
         count(*) as soru_sayisi,
         count(*) filter (where g.user_id is not null) as gorulen_sayisi
  from public.questions q
  left join public.gorulen_sorular g
    on g.question_id = q.id and g.user_id = auth.uid()
  where q.aktif
    and q.dil = coalesce((select pr.dil from public.profiles pr where pr.id = auth.uid()), 'tr')
  group by q.kategori
  having count(*) >= 15
  order by count(*) desc;
$$;

revoke execute on function public.get_categories() from public, anon;
grant execute on function public.get_categories() to authenticated;

-- ---------- 1v1: meydan okuma oluştur (kota) ----------

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

-- ---------- 1v1: daveti kabul et → iki oyuncunun da görmediği sorular ----------

create or replace function public.respond_challenge(p_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.oyuncu2 <> auth.uid() then raise exception 'Bu meydan okuma sana gelmedi'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu meydan okuma artık beklemede değil'; end if;

  if p_kabul then
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(m.kategori, 20, array[m.oyuncu1, m.oyuncu2]),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_match_id;
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$$;

revoke execute on function public.respond_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;

-- ---------- Hemen Oyna (quick_match): kategori + görülmemiş soru + kota ----------

drop function if exists public.quick_match();
create or replace function public.quick_match(p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  -- Devam eden hızlı maçım varsa ona dön
  select m.id into v_id from public.matches m
  join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then return v_id; end if;

  perform public.mac_kotasi_kontrol();

  -- Kuyrukta bekleyen gerçek oyuncu var mı? (90 sn tazelik)
  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  select user_id into v_rakip from public.matchmaking_queue
  where user_id <> auth.uid()
  order by created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif', p_kategori,
      public.soru_sec(p_kategori, 20, array[auth.uid(), v_rakip]),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Kimse yoksa rastgele botla hemen başla
  select id into v_bot from public.profiles where is_bot order by random() limit 1;

  insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
  values (
    auth.uid(), v_bot, 'aktif', p_kategori,
    public.soru_sec(p_kategori, 20, array[auth.uid()]),
    0, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.quick_match(text) from public, anon;
grant execute on function public.quick_match(text) to authenticated;

-- ---------- Grup maçı: oluştur (kota) ----------

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

-- ---------- Grup maçı: davete yanıt → grubun görmediği sorular ----------

create or replace function public.respond_group_challenge(p_group_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
  gp public.group_match_players%rowtype;
  v_toplam int;
  v_kabul_eden int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Grup maçı bulunamadı'; end if;
  if gm.durum <> 'bekliyor' then raise exception 'Bu davet artık beklemede değil'; end if;

  select * into gp from public.group_match_players
  where group_match_id = p_group_match_id and user_id = auth.uid();
  if not found then raise exception 'Bu davet sana gelmedi'; end if;
  if gp.davet_durumu <> 'bekliyor' then raise exception 'Bu davete zaten yanıt verdin'; end if;

  if not p_kabul then
    update public.group_match_players
       set davet_durumu = 'red'
     where group_match_id = p_group_match_id and user_id = auth.uid();
    -- Biri reddederse grup tamamlanamaz: tüm davet iptal olur
    update public.group_matches set durum = 'iptal' where id = p_group_match_id;
    return;
  end if;

  update public.group_match_players
     set davet_durumu = 'kabul'
   where group_match_id = p_group_match_id and user_id = auth.uid();

  select count(*) into v_toplam from public.group_match_players where group_match_id = p_group_match_id;
  select count(*) into v_kabul_eden from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul';

  if v_kabul_eden = v_toplam then
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(
             gm.kategori, 20,
             (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                from public.group_match_players gmp
               where gmp.group_match_id = p_group_match_id)
           ),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$$;

revoke execute on function public.respond_group_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_group_challenge(uuid, boolean) to authenticated;

-- ---------- Hızlı mod: oluştur (kota) ----------

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

-- ---------- Hızlı mod: davete yanıt → grubun görmediği sorular ----------

create or replace function public.respond_hizli_davet(p_hizli_mac_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
  hp public.hizli_oyuncular%rowtype;
  v_toplam int;
  v_kabul_eden int;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Hızlı maç bulunamadı'; end if;
  if hm.durum <> 'bekliyor' then raise exception 'Bu davet artık beklemede değil'; end if;

  select * into hp from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();
  if not found then raise exception 'Bu davet sana gelmedi'; end if;
  if hp.davet_durumu <> 'bekliyor' then raise exception 'Bu davete zaten yanıt verdin'; end if;

  if not p_kabul then
    update public.hizli_oyuncular
       set davet_durumu = 'red'
     where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();
    update public.hizli_maclar set durum = 'iptal' where id = p_hizli_mac_id;
    return;
  end if;

  update public.hizli_oyuncular
     set davet_durumu = 'kabul'
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  select count(*) into v_toplam from public.hizli_oyuncular where hizli_mac_id = p_hizli_mac_id;
  select count(*) into v_kabul_eden from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul';

  if v_kabul_eden = v_toplam then
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(
             hm.kategori, 20,
             (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                from public.hizli_oyuncular ho
               where ho.hizli_mac_id = p_hizli_mac_id)
           ),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$$;

revoke execute on function public.respond_hizli_davet(uuid, boolean) from public, anon;
grant execute on function public.respond_hizli_davet(uuid, boolean) to authenticated;

-- ---------- Turnuva: karışık kalır, yalnızca dil filtresi uygulanır ----------

create or replace function public.start_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_oyuncu int;
begin
  select * into t
  from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans
    and durum = 'lobi'
  for update;
  if not found then return; end if;

  select count(*) into v_oyuncu from public.tournament_players where tournament_id = t.id;

  if v_oyuncu < 2 then
    update public.tournaments set durum = 'iptal', bitis = now() where id = t.id;
    return;
  end if;

  update public.tournaments
     set durum = 'aktif',
         -- Turnuva KARIŞIK: kategori yok, ortak havuz (dil 'tr')
         soru_ids = public.soru_sec(null, 30, '{}'::uuid[], 'tr'),
         aktif_soru = 0,
         baslangic = now(),
         soru_baslangic = now()
   where id = t.id;
end;
$$;
revoke execute on function public.start_tournament(text) from public, anon, authenticated;

-- ============================================================
-- Soru çeken 4 RPC: gösterim anında gorulen_sorular'a yaz
-- (imzalar değişmedi; yalnız gorulen_kaydet çağrısı eklendi)
-- ============================================================

create or replace function public.get_match_question(p_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' or m.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  perform public.gorulen_kaydet(m.soru_ids[m.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, m.aktif_soru, m.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = m.soru_ids[m.aktif_soru + 1];
end;
$$;

create or replace function public.get_tournament_question(p_tournament_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' or t.aktif_soru < 0 then raise exception 'Turnuva aktif değil'; end if;

  perform public.gorulen_kaydet(t.soru_ids[t.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, t.aktif_soru, t.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = t.soru_ids[t.aktif_soru + 1];
end;
$$;

create or replace function public.get_group_match_question(p_group_match_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.group_matches%rowtype;
begin
  select * into gm from public.group_matches where id = p_group_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' or gm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  perform public.gorulen_kaydet(gm.soru_ids[gm.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, gm.aktif_soru, gm.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = gm.soru_ids[gm.aktif_soru + 1];
end;
$$;

create or replace function public.get_hizli_soru(p_hizli_mac_id uuid)
returns table (question_id uuid, soru text, secenekler jsonb, soru_index int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  hm public.hizli_maclar%rowtype;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' or hm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  perform public.gorulen_kaydet(hm.soru_ids[hm.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, hm.aktif_soru, hm.soru_baslangic, now()
    from public.questions q
    where q.id = hm.soru_ids[hm.aktif_soru + 1];
end;
$$;

-- ============================================================
-- 3) HAFTALIK LİG: arşiv + hafta kapatma
--
-- Mevcut durum: pg_cron işi 'bildim-hafta-sifirla' (Pazar 21:00 UTC =
-- Pazartesi 00:00 TSİ) yalnızca `puan_hafta = 0` yapıyordu — geçmiş
-- kayboluyordu. Onun yerine haftayi_kapat() geçiyor: önce arşivle + rozet
-- ver, sonra sıfırla.
-- ============================================================

create table if not exists public.lig_arsiv (
  user_id uuid not null references public.profiles(id) on delete cascade,
  hafta date not null,               -- kapanan haftanın Pazartesi'si (TSİ)
  puan int not null default 0,
  sehir text,
  ulke text,
  sira_sehir int,
  sira_ulke int,
  sira_global int,
  primary key (user_id, hafta)
);

alter table public.lig_arsiv enable row level security;
drop policy if exists "lig_arsiv_select" on public.lig_arsiv;
create policy "lig_arsiv_select" on public.lig_arsiv for select using (true);
revoke all on public.lig_arsiv from authenticated, anon;
grant select on public.lig_arsiv to authenticated;

create index if not exists idx_lig_arsiv_hafta on public.lig_arsiv (hafta desc);

insert into public.badges (id, ad, aciklama, ikon) values
  ('hafta_1',     'Haftanın Birincisi', 'Haftalık dünya ligini 1. bitirdin', '🥇'),
  ('hafta_2',     'Haftanın İkincisi',  'Haftalık dünya ligini 2. bitirdin', '🥈'),
  ('hafta_3',     'Haftanın Üçüncüsü',  'Haftalık dünya ligini 3. bitirdin', '🥉'),
  ('sehir_krali', 'Şehrin Kralı',       'Şehrinin haftalık ligini 1. bitirdin', '🏙️')
on conflict (id) do nothing;

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
  -- Pazartesi 00:00 TSİ'de çalışır → kapanan hafta bir önceki Pazartesi
  v_hafta := (date_trunc('week', (now() at time zone 'Europe/Istanbul') - interval '1 day'))::date;

  -- Aynı hafta ikinci kez kapatılmasın (cron tekrarına karşı)
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
    and p.puan_hafta > 0
  on conflict (user_id, hafta) do nothing;

  -- İlk 3'e (dünya) rozet
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

  -- Şehir birincilerine rozet
  for r in
    select a.user_id from public.lig_arsiv a
    where a.hafta = v_hafta and a.sira_sehir = 1
  loop
    perform public.award_badge(r.user_id, 'sehir_krali');
  end loop;

  -- Haftayı sıfırla
  update public.profiles set puan_hafta = 0 where puan_hafta <> 0;
end;
$$;

revoke execute on function public.haftayi_kapat() from public, anon, authenticated;

-- ---------- Pazartesi sabahı haftalık sonuç bildirimi ----------

create or replace function public.haftalik_sonuc_bildir()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hafta date;
  r record;
begin
  v_hafta := (date_trunc('week', (now() at time zone 'Europe/Istanbul')) - interval '7 days')::date;

  for r in
    select a.user_id, a.sira_sehir, a.sira_ulke, a.sira_global, a.sehir, a.puan
    from public.lig_arsiv a
    where a.hafta = v_hafta
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = a.user_id)
      and (a.sira_sehir <= 10 or a.sira_global <= 100)
  loop
    begin
      perform net.http_post(
        url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'user_ids', jsonb_build_array(r.user_id),
          'baslik', '🏆 Haftalık lig sonuçlandı!',
          'govde', case
            when r.sira_sehir is not null
              then 'Geçen hafta ' || coalesce(r.sehir, 'şehrinde') || ' liginde ' ||
                   r.sira_sehir || '. oldun (' || r.puan || ' puan). Yeni hafta başladı!'
            else 'Geçen hafta dünya ligindeki sıran: ' || r.sira_global ||
                 ' (' || r.puan || ' puan). Yeni hafta başladı!'
          end,
          'url', '/bildim/siralama'
        )
      );
    exception when others then
      -- Tek bir bildirim hatası tüm işi düşürmesin
      raise notice 'haftalik_sonuc_bildir hata (%): %', r.user_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.haftalik_sonuc_bildir() from public, anon, authenticated;

-- ---------- pg_cron: eski sıfırlamayı haftayi_kapat ile değiştir ----------

do $$
begin
  begin
    perform cron.unschedule('bildim-hafta-sifirla');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('bildim-hafta-kapat');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('bildim-hafta-bildir');
  exception when others then null;
  end;

  -- Pazar 21:00 UTC = Pazartesi 00:00 TSİ (TSİ yıl boyu UTC+3)
  perform cron.schedule('bildim-hafta-kapat', '0 21 * * 0',
    'select public.haftayi_kapat()');

  -- Pazartesi 06:00 UTC = 09:00 TSİ
  perform cron.schedule('bildim-hafta-bildir', '0 6 * * 1',
    'select public.haftalik_sonuc_bildir()');
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;

-- ============================================================
-- 4) SIRALAMA RPC'leri (şehir / ülke / dünya × hafta / tüm zamanlar)
-- ============================================================

-- İlk 100 + çağıranın kendi satırı (top 100'de değilse sona eklenir).
create or replace function public.lig_siralama(
  p_kapsam text default 'global',
  p_donem text default 'hafta'
)
returns table (
  sira bigint,
  user_id uuid,
  username text,
  avatar_url text,
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
           p.username,
           p.avatar_url,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as p_puan,
           p.sehir,
           p.ulke,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.username asc
           ) as p_sira
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.username, s.avatar_url, s.p_puan, s.sehir, s.ulke, (s.id = v_me)
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$$;

revoke execute on function public.lig_siralama(text, text) from public, anon;
grant execute on function public.lig_siralama(text, text) to authenticated;

-- Şehirlerin ülke içi sıralaması ("Balıkesir bu hafta Türkiye'de 12.")
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

-- ============================================================
-- BOTLAR: bot_oyna içindeki 3 soru seçimi de soru_sec'ten geçsin
-- (kategori + dil + görülmemiş soru). Fonksiyonun geri kalanı
-- 20260612000032 sürümüyle birebir aynıdır; yalnızca soru seçimi
-- ve site 1'deki insan oyuncu alanı (m.oyuncu1) değişti.
-- ============================================================

create or replace function public.bot_oyna()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_ilk boolean;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20, array[r.oyuncu1]),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla (bot isabetine göre, hız puanlı)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and now() >= m.soru_baslangic + interval '3 seconds'
      and now() <= m.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.match_answers a
        where a.match_id = m.id and a.user_id = p.id and a.soru_index = m.aktif_soru
      )
    for update of m skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      if r.oyuncu1 = r.bot_id then
        update public.matches set oyuncu1_skor = oyuncu1_skor + v_puan where id = r.id;
      else
        update public.matches set oyuncu2_skor = oyuncu2_skor + v_puan where id = r.id;
      end if;
    end if;

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (now() > m.soru_baslangic + interval '16 seconds'
        or 2 <= (select count(*) from public.match_answers a
                 where a.match_id = m.id and a.soru_index = m.aktif_soru))
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      and now() >= t.soru_baslangic + interval '3 seconds'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                           from public.group_match_players gmp
                          where gmp.group_match_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif'
      and now() >= gm.soru_baslangic + interval '3 seconds'
      and now() <= gm.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
    for update of gm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif'
      and (now() > gm.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        ))
  loop
    perform public.advance_group_match(r.id);
  end loop;

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                           from public.hizli_oyuncular ho
                          where ho.hizli_mac_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif'
      and now() >= hm.soru_baslangic + interval '2 seconds'
      and now() <= hm.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
    for update of hm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif'
      and (now() > hm.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        ))
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$$;

-- ============================================================
-- Ana sayfa özeti: oyuncunun kendi lig durumu (tek satır, ucuz)
-- Home hero'sunda "şehrinde 4., dünyada 812." göstermek için.
-- ============================================================

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
  select
    coalesce(v_puan, 0),
    v_sehir,
    v_ulke,
    case when v_sehir is null then null else (
      select count(*) + 1 from public.profiles p
      where coalesce(p.is_bot,false) = false and p.ulke = v_ulke and p.sehir = v_sehir
        and (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) > coalesce(v_puan, 0)
    ) end,
    case when v_sehir is null then null else (
      select count(*) from public.profiles p
      where coalesce(p.is_bot,false) = false and p.ulke = v_ulke and p.sehir = v_sehir
    ) end,
    case when v_ulke is null then null else (
      select count(*) + 1 from public.profiles p
      where coalesce(p.is_bot,false) = false and p.ulke = v_ulke
        and (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) > coalesce(v_puan, 0)
    ) end,
    case when v_ulke is null then null else (
      select count(*) from public.profiles p
      where coalesce(p.is_bot,false) = false and p.ulke = v_ulke
    ) end,
    (select count(*) + 1 from public.profiles p
      where coalesce(p.is_bot,false) = false
        and (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) > coalesce(v_puan, 0)),
    (select count(*) from public.profiles p where coalesce(p.is_bot,false) = false),
    case when v_sehir is null then null else (
      with t as (
        select p.sehir as s,
               sum(case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as sp
        from public.profiles p
        where coalesce(p.is_bot,false) = false and p.ulke = v_ulke and p.sehir is not null
        group by p.sehir
      )
      select count(*) + 1 from t
      where t.sp > (select t2.sp from t t2 where t2.s = v_sehir)
    ) end,
    case when v_ulke is null then null else (
      select count(distinct p.sehir) from public.profiles p
      where coalesce(p.is_bot,false) = false and p.ulke = v_ulke and p.sehir is not null
    ) end;
end;
$$;

revoke execute on function public.benim_lig_durumum(text) from public, anon;
grant execute on function public.benim_lig_durumum(text) to authenticated;
