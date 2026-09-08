-- ============================================================
-- 52 — JOKER EKONOMİSİ (Bildim!)
--
-- Joker türleri: elli (%50), sure (+10 sn), pas (soruyu atla), seri_koruma.
-- TÜM kararlar sunucuda: envanter, maç başına sınır, ücretsiz hak, silinecek
-- şıklar. İstemci hiçbir şey hesaplamaz.
--
-- Mevcut `use_joker` / `use_group_joker` RPC'leri ve `match_jokers` /
-- `group_match_jokers` tabloları BOZULMADI (geriye uyumluluk). Yeni akış
-- `joker_kullan()` + `joker_kullanimlari` üzerinden ilerler; eski tabloların
-- (match_id, user_id, tip) birincil anahtarı "arkadaş maçında sınırsız"
-- kuralıyla çeliştiği için yeni bir kayıt tablosu kullanılıyor.
--
-- Maç kuralları (VARSAYILAN KARARLAR):
--   * 1v1 arkadaş maçı ve grup maçı  → sınırsız joker
--   * Hemen Oyna / bot / hızlı mod / turnuva (lig maçları) → maç başına en çok 2
--   * Turnuva FİNALİ (hayatta ≤ 2 oyuncu) → joker YASAK
--   * Her maçta 1 adet ÜCRETSİZ `elli` (envanterden düşmez, birikmez)
--   * `pas` turnuvada kullanılamaz (yanlış cevap elenmek demek)
-- ============================================================

-- ============================================================
-- 1) TABLOLAR
-- ============================================================

create table if not exists public.joker_envanter (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tur text not null check (tur in ('elli', 'sure', 'pas', 'seri_koruma')),
  adet int not null default 0 check (adet >= 0),
  primary key (user_id, tur)
);

create table if not exists public.joker_islemleri (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tur text not null,
  delta int not null,
  kaynak text not null check (kaynak in ('ucretsiz','reklam','satin_alma','kullanim','seri','hediye')),
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists idx_joker_islem_kullanici
  on public.joker_islemleri (user_id, created_at desc);

create table if not exists public.reklam_odulleri (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gun date not null,
  sayac int not null default 0,
  primary key (user_id, gun)
);

create table if not exists public.satin_almalar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  urun_id text not null,
  play_token text not null unique,          -- aynı makbuz iki kez işlenemez
  durum text not null default 'onaylandi' check (durum in ('onaylandi','reddedildi','beklemede')),
  created_at timestamptz not null default now()
);
create index if not exists idx_satin_alma_kullanici
  on public.satin_almalar (user_id, created_at desc);

-- Yeni joker kullanım kaydı (maç başına sınır ve ücretsiz hak buradan sayılır)
create table if not exists public.joker_kullanimlari (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mac_tur text not null check (mac_tur in ('1v1','grup','hizli','turnuva')),
  mac_id uuid not null,
  soru_index int not null,
  tur text not null,
  ucretsiz boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_joker_kullanim_mac
  on public.joker_kullanimlari (user_id, mac_tur, mac_id);

-- ---------- RLS: yalnız sahibi okur, yazma yalnız RPC ile ----------

alter table public.joker_envanter enable row level security;
alter table public.joker_islemleri enable row level security;
alter table public.reklam_odulleri enable row level security;
alter table public.satin_almalar enable row level security;
alter table public.joker_kullanimlari enable row level security;

drop policy if exists "joker_envanter_own" on public.joker_envanter;
create policy "joker_envanter_own" on public.joker_envanter for select using (auth.uid() = user_id);
drop policy if exists "joker_islemleri_own" on public.joker_islemleri;
create policy "joker_islemleri_own" on public.joker_islemleri for select using (auth.uid() = user_id);
drop policy if exists "reklam_odulleri_own" on public.reklam_odulleri;
create policy "reklam_odulleri_own" on public.reklam_odulleri for select using (auth.uid() = user_id);
drop policy if exists "satin_almalar_own" on public.satin_almalar;
create policy "satin_almalar_own" on public.satin_almalar for select using (auth.uid() = user_id);
drop policy if exists "joker_kullanimlari_own" on public.joker_kullanimlari;
create policy "joker_kullanimlari_own" on public.joker_kullanimlari for select using (auth.uid() = user_id);

revoke all on public.joker_envanter from authenticated, anon;
revoke all on public.joker_islemleri from authenticated, anon;
revoke all on public.reklam_odulleri from authenticated, anon;
revoke all on public.satin_almalar from authenticated, anon;
revoke all on public.joker_kullanimlari from authenticated, anon;
grant select on public.joker_envanter to authenticated;
grant select on public.joker_islemleri to authenticated;
grant select on public.reklam_odulleri to authenticated;
grant select on public.satin_almalar to authenticated;
grant select on public.joker_kullanimlari to authenticated;

-- ============================================================
-- 2) ENVANTER YARDIMCILARI
-- ============================================================

-- Envantere ekleme/çıkarma + denetim izi. Yalnız sunucu tarafı çağırır.
create or replace function public.joker_hareket(
  p_user uuid, p_tur text, p_delta int, p_kaynak text, p_ref text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
begin
  if p_delta = 0 then
    return coalesce((select adet from public.joker_envanter where user_id = p_user and tur = p_tur), 0);
  end if;

  insert into public.joker_envanter (user_id, tur, adet)
  values (p_user, p_tur, greatest(0, p_delta))
  on conflict (user_id, tur) do update
    set adet = public.joker_envanter.adet + p_delta
  returning adet into v_yeni;

  if v_yeni < 0 then
    raise exception 'Yetersiz joker';
  end if;

  insert into public.joker_islemleri (user_id, tur, delta, kaynak, ref)
  values (p_user, p_tur, p_delta, p_kaynak, p_ref);

  return v_yeni;
end;
$$;

revoke execute on function public.joker_hareket(uuid, text, int, text, text)
  from public, anon, authenticated;

-- Edge Function / service_role tarafından çağrılır (satın alma sonrası).
create or replace function public.joker_ekle(
  p_user uuid, p_tur text, p_adet int, p_kaynak text default 'satin_alma', p_ref text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_adet <= 0 then raise exception 'Adet pozitif olmalı'; end if;
  if p_tur not in ('elli','sure','pas','seri_koruma') then raise exception 'Geçersiz joker türü'; end if;
  return public.joker_hareket(p_user, p_tur, p_adet, p_kaynak, p_ref);
end;
$$;

-- authenticated'a VERİLMEZ: yalnız service_role (Edge Function) çağırabilir.
revoke execute on function public.joker_ekle(uuid, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.joker_ekle(uuid, text, int, text, text) to service_role;

create or replace function public.envanterim()
returns table (tur text, adet int)
language sql
stable
security definer
set search_path = public
as $$
  select t.tur, coalesce(e.adet, 0)
  from (values ('elli'), ('sure'), ('pas'), ('seri_koruma')) as t(tur)
  left join public.joker_envanter e on e.tur = t.tur and e.user_id = auth.uid();
$$;

revoke execute on function public.envanterim() from public, anon;
grant execute on function public.envanterim() to authenticated;

-- ============================================================
-- 3) MAÇ KURALLARI
-- ============================================================

-- Bu maçta joker sınırı kaç? (null = sınırsız, 0 = yasak)
create or replace function public.joker_mac_siniri(p_mac_tur text, p_mac_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_rakip uuid;
  v_hayatta int;
begin
  if p_mac_tur = 'grup' then
    return null;                                   -- grup maçları arkadaş maçıdır
  elsif p_mac_tur = 'hizli' then
    return 2;                                      -- lig maçı
  elsif p_mac_tur = 'turnuva' then
    select count(*) into v_hayatta
    from public.tournament_players tp
    where tp.tournament_id = p_mac_id and not tp.elendi;
    if v_hayatta <= 2 then
      return 0;                                    -- FİNAL: joker yasak
    end if;
    return 2;
  elsif p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id;
    if not found then raise exception 'Maç bulunamadı'; end if;
    v_rakip := case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end;
    -- Arkadaş maçı mı? (bot ve rastgele eşleşme = lig maçı)
    if exists (
      select 1 from public.friendships f
      where f.durum = 'arkadas'
        and ((f.requester = auth.uid() and f.addressee = v_rakip)
          or (f.requester = v_rakip and f.addressee = auth.uid()))
    ) then
      return null;                                 -- sınırsız
    end if;
    return 2;
  end if;
  raise exception 'Geçersiz maç türü';
end;
$$;

revoke execute on function public.joker_mac_siniri(text, uuid) from public, anon;
grant execute on function public.joker_mac_siniri(text, uuid) to authenticated;

-- ============================================================
-- 4) JOKER KULLANIMI (tek giriş noktası)
-- ============================================================

create or replace function public.joker_kullan(
  p_mac_tur text, p_mac_id uuid, p_soru_index int, p_tur text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sinir int;
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_soru_id uuid;
  v_dogru smallint;
  v_kapali int[];
  v_baslangic timestamptz;
  v_aktif_soru int;
  m public.matches%rowtype;
  gm public.group_matches%rowtype;
  hm public.hizli_maclar%rowtype;
  t public.tournaments%rowtype;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_tur not in ('elli','sure','pas') then
    raise exception 'Bu joker maç içinde kullanılamaz';
  end if;
  if p_mac_tur not in ('1v1','grup','hizli','turnuva') then
    raise exception 'Geçersiz maç türü';
  end if;
  if p_mac_tur = 'turnuva' and p_tur = 'pas' then
    raise exception 'Turnuvada pas jokeri kullanılamaz';
  end if;

  -- ---- Maçı doğrula, aktif soruyu ve süreyi al ----
  if p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if v_me not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
    if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := m.aktif_soru; v_baslangic := m.soru_baslangic;
    v_soru_id := m.soru_ids[m.aktif_soru + 1];
    if exists (select 1 from public.match_answers
               where match_id = p_mac_id and user_id = v_me and soru_index = m.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'grup' then
    select * into gm from public.group_matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.group_match_players
                   where group_match_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := gm.aktif_soru; v_baslangic := gm.soru_baslangic;
    v_soru_id := gm.soru_ids[gm.aktif_soru + 1];
    if exists (select 1 from public.group_match_answers
               where group_match_id = p_mac_id and user_id = v_me and soru_index = gm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'hizli' then
    select * into hm from public.hizli_maclar where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.hizli_oyuncular
                   where hizli_mac_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := hm.aktif_soru; v_baslangic := hm.soru_baslangic;
    v_soru_id := hm.soru_ids[hm.aktif_soru + 1];
    if exists (select 1 from public.hizli_cevaplar
               where hizli_mac_id = p_mac_id and user_id = v_me and soru_index = hm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  else -- turnuva
    select * into t from public.tournaments where id = p_mac_id for update;
    if not found then raise exception 'Turnuva bulunamadı'; end if;
    if not exists (select 1 from public.tournament_players
                   where tournament_id = p_mac_id and user_id = v_me and not elendi) then
      raise exception 'Turnuvada değilsin ya da elendin';
    end if;
    if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;
    v_aktif_soru := t.aktif_soru; v_baslangic := t.soru_baslangic;
    v_soru_id := t.soru_ids[t.aktif_soru + 1];
    if exists (select 1 from public.tournament_answers
               where tournament_id = p_mac_id and user_id = v_me and soru_index = t.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;
  end if;

  if p_soru_index is not null and p_soru_index <> v_aktif_soru then
    raise exception 'Soru değişti, tekrar dene';
  end if;
  if now() > v_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  -- ---- Maç kuralı ----
  v_sinir := public.joker_mac_siniri(p_mac_tur, p_mac_id);
  select count(*) into v_kullanilan
  from public.joker_kullanimlari
  where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id;

  if v_sinir = 0 then
    raise exception 'Turnuva finalinde joker kullanılamaz';
  end if;
  if v_sinir is not null and v_kullanilan >= v_sinir then
    raise exception 'Bu maçta en fazla % joker kullanabilirsin', v_sinir;
  end if;

  -- ---- Ücretsiz elli hakkı (maç başına 1, birikmez) ----
  if p_tur = 'elli' and not exists (
    select 1 from public.joker_kullanimlari
    where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id
      and tur = 'elli' and ucretsiz
  ) then
    v_ucretsiz := true;
  end if;

  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', p_mac_tur || ':' || p_mac_id::text);
  end if;

  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, p_mac_tur, p_mac_id, v_aktif_soru, p_tur, v_ucretsiz);

  -- ---- Etki ----
  select q.dogru_cevap into v_dogru from public.questions q where q.id = v_soru_id;

  if p_tur = 'elli' then
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> v_dogru order by random() limit 2
    ) s;
    return jsonb_build_object('tur','elli','ucretsiz',v_ucretsiz,'kapali',to_jsonb(v_kapali));

  elsif p_tur = 'sure' then
    if p_mac_tur = '1v1' then
      update public.matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    elsif p_mac_tur = 'grup' then
      update public.group_matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    elsif p_mac_tur = 'hizli' then
      update public.hizli_maclar set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    else
      update public.tournaments set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    end if;
    return jsonb_build_object('tur','sure','ucretsiz',false,'uzatildi',true);

  else -- pas: soruyu atla, puan yok (cevap -1 olarak işaretlenir)
    if p_mac_tur = '1v1' then
      insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    elsif p_mac_tur = 'grup' then
      insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    else
      insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
      values (p_mac_id, v_me, v_aktif_soru, -1, false) on conflict do nothing;
    end if;
    return jsonb_build_object('tur','pas','ucretsiz',false,'atlandi',true,'dogru_cevap',v_dogru);
  end if;
end;
$$;

revoke execute on function public.joker_kullan(text, uuid, int, text) from public, anon;
grant execute on function public.joker_kullan(text, uuid, int, text) to authenticated;

-- Bu maçta ne kullandım / hakkım ne? (arayüz butonları için)
create or replace function public.joker_mac_durumu(p_mac_tur text, p_mac_id uuid)
returns table (sinir int, kullanilan int, ucretsiz_elli_kaldi boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.joker_mac_siniri(p_mac_tur, p_mac_id),
    (select count(*)::int from public.joker_kullanimlari
      where user_id = auth.uid() and mac_tur = p_mac_tur and mac_id = p_mac_id),
    not exists (select 1 from public.joker_kullanimlari
      where user_id = auth.uid() and mac_tur = p_mac_tur and mac_id = p_mac_id
        and tur = 'elli' and ucretsiz);
$$;

revoke execute on function public.joker_mac_durumu(text, uuid) from public, anon;
grant execute on function public.joker_mac_durumu(text, uuid) to authenticated;

-- ============================================================
-- 5) REKLAM ÖDÜLÜ (günde en fazla 5, video başına 1 `elli`)
-- ============================================================

create or replace function public.reklam_odulu_al(p_reklam_ref text)
returns table (verilen int, bugun int, tavan int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_tavan constant int := 5;
  v_gun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sayac int;
  v_ref text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  v_ref := nullif(btrim(coalesce(p_reklam_ref, '')), '');
  if v_ref is null then raise exception 'Geçersiz reklam referansı'; end if;

  -- Aynı reklam referansı iki kez ödüllendirilemez
  if exists (
    select 1 from public.joker_islemleri
    where user_id = v_me and kaynak = 'reklam' and ref = v_ref
  ) then
    raise exception 'Bu reklam ödülü zaten alındı';
  end if;

  insert into public.reklam_odulleri (user_id, gun, sayac)
  values (v_me, v_gun, 0)
  on conflict (user_id, gun) do nothing;

  select r.sayac into v_sayac
  from public.reklam_odulleri r
  where r.user_id = v_me and r.gun = v_gun
  for update;

  if v_sayac >= v_tavan then
    raise exception 'Bugünkü reklam ödülü hakkın doldu (%/%)', v_sayac, v_tavan;
  end if;

  update public.reklam_odulleri
     set sayac = sayac + 1
   where user_id = v_me and gun = v_gun
  returning sayac into v_sayac;

  perform public.joker_hareket(v_me, 'elli', 1, 'reklam', v_ref);

  return query select 1, v_sayac, v_tavan;
end;
$$;

revoke execute on function public.reklam_odulu_al(text) from public, anon;
grant execute on function public.reklam_odulu_al(text) to authenticated;

create or replace function public.reklam_durumum()
returns table (bugun int, tavan int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select r.sayac from public.reklam_odulleri r
              where r.user_id = auth.uid()
                and r.gun = (now() at time zone 'Europe/Istanbul')::date), 0),
    5;
$$;

revoke execute on function public.reklam_durumum() from public, anon;
grant execute on function public.reklam_durumum() to authenticated;

-- ============================================================
-- 6) SATIN ALMA PAKETLERİ (fiyat Play Console'da; kodda fiyat yok)
-- ============================================================

create table if not exists public.joker_paketleri (
  urun_id text primary key,          -- Play Console ürün kimliği
  ad text not null,
  aciklama text not null,
  icerik jsonb not null,             -- {"elli":4,"sure":3,"pas":3}
  sira int not null default 0,
  aktif boolean not null default true
);

alter table public.joker_paketleri enable row level security;
drop policy if exists "joker_paketleri_select" on public.joker_paketleri;
create policy "joker_paketleri_select" on public.joker_paketleri for select using (aktif);
revoke all on public.joker_paketleri from authenticated, anon;
grant select on public.joker_paketleri to authenticated;

insert into public.joker_paketleri (urun_id, ad, aciklama, icerik, sira) values
  ('joker_10',       'Başlangıç Paketi', '10 karışık joker',            '{"elli":4,"sure":3,"pas":3}'::jsonb,     1),
  ('joker_30',       'Oyuncu Paketi',    '30 karışık joker',            '{"elli":12,"sure":9,"pas":9}'::jsonb,    2),
  ('joker_100',      'Usta Paketi',      '100 karışık joker',           '{"elli":40,"sure":30,"pas":30}'::jsonb,  3),
  ('seri_koruma_3',  'Seri Kalkanı',     '3 adet seri koruma',          '{"seri_koruma":3}'::jsonb,               4)
on conflict (urun_id) do nothing;

-- Edge Function doğrulamadan SONRA çağırır (service_role).
create or replace function public.satin_alma_isle(
  p_user uuid, p_urun_id text, p_play_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paket public.joker_paketleri%rowtype;
  v_tur text;
  v_adet int;
begin
  if p_user is null or p_play_token is null then
    raise exception 'Eksik parametre';
  end if;

  select * into v_paket from public.joker_paketleri where urun_id = p_urun_id and aktif;
  if not found then raise exception 'Bilinmeyen ürün: %', p_urun_id; end if;

  -- Token tekrarı: unique kısıt + açık kontrol
  if exists (select 1 from public.satin_almalar where play_token = p_play_token) then
    raise exception 'Bu satın alma zaten işlendi';
  end if;

  insert into public.satin_almalar (user_id, urun_id, play_token, durum)
  values (p_user, p_urun_id, p_play_token, 'onaylandi');

  for v_tur, v_adet in select key, value::int from jsonb_each_text(v_paket.icerik) loop
    perform public.joker_ekle(p_user, v_tur, v_adet, 'satin_alma', p_play_token);
  end loop;

  return jsonb_build_object('urun_id', p_urun_id, 'icerik', v_paket.icerik);
end;
$$;

revoke execute on function public.satin_alma_isle(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.satin_alma_isle(uuid, text, text) to service_role;
