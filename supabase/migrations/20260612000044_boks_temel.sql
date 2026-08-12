-- ============================================================
-- GÖLGE BOKS — DB temeli
-- Tüm tablolar boks_ önekli; Bildim/Kafa Topu/Meyve Kes şemalarına dokunmaz.
-- Yazımlar YALNIZ security-definer RPC'lerle yapılır (istemciye güvenilmez).
-- Bildim kullanıcı/avatar sistemi (public.profiles) sıralama için kullanılır.
--
-- Tablolar:
--   boks_tercihler   kullanıcı tercihleri (duruş, eldiven, koç kişiliği, kilo)
--   boks_oturumlar   tamamlanan antrenman oturumları (özet)
--   boks_roundlar    round başına HAM OLAY SAYAÇLARI (analiz motorunun kaynağı)
--   boks_kariyer     kümülatif kariyer profili + streak
--   boks_skorlar     mod bazlı en iyi skor (leaderboard)
--   boks_zayifliklar takip edilen teknik açıklar (koçluk geri bildirim döngüsü)
--   boks_rozetler    kazanılan başarım rozetleri
--   boks_sezon       sezonluk (aylık) puan birikimi
-- ============================================================

-- ---------------- tercihler ----------------
create table if not exists public.boks_tercihler (
  user_id uuid primary key references auth.users(id) on delete cascade,
  durus text not null default 'ortodoks' check (durus in ('ortodoks','guney_pence')),
  eldiven_turu text not null default 'boks' check (eldiven_turu in ('boks','mma')),
  eldiven_renk text not null default '#ff4d3d',
  koc_kisilik text not null default 'agresif' check (koc_kisilik in ('agresif','sakin')),
  kilo_kg int check (kilo_kg is null or (kilo_kg between 25 and 250)),
  onerilen_zorluk text check (onerilen_zorluk is null or onerilen_zorluk in ('kolay','orta','zor','pro')),
  ses_acik boolean not null default true,
  koc_acik boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------- oturumlar ----------------
create table if not exists public.boks_oturumlar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mod text not null check (mod in ('serbest','koc','savunma','ritim')),
  zorluk text not null check (zorluk in ('kolay','orta','zor','pro','test')),
  round_sayisi int not null default 0,
  puan int not null default 0,
  toplam_yumruk int not null default 0,
  isabet int not null default 0,
  kacirma int not null default 0,
  sure_sn int not null default 0,
  kalori int not null default 0,
  ort_siddet int not null default 0,
  max_siddet int not null default 0,
  en_iyi_combo int not null default 0,
  stil_kod text,
  eslesen_dovuscu text,
  created_at timestamptz not null default now()
);
create index if not exists boks_oturumlar_user_idx on public.boks_oturumlar (user_id, created_at desc);

-- ---------------- roundlar (ham olay sayaçları) ----------------
create table if not exists public.boks_roundlar (
  id bigserial primary key,
  oturum_id uuid not null references public.boks_oturumlar(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_no int not null,
  puan int not null default 0,
  y1 int not null default 0,
  y2 int not null default 0,
  y3 int not null default 0,
  y4 int not null default 0,
  y5 int not null default 0,
  y6 int not null default 0,
  toplam_yumruk int not null default 0,
  isabet int not null default 0,
  kacirma int not null default 0,
  yanlis_tur int not null default 0,
  sol_yumruk int not null default 0,
  sag_yumruk int not null default 0,
  siddet_toplam int not null default 0,
  siddet_max int not null default 0,
  dusuk_gard_olay int not null default 0,
  vurusta_acik_gard int not null default 0,
  gard_dusuk_sure real not null default 0,
  gard_olcu_sure real not null default 0,
  kacinma_deneme int not null default 0,
  kacinma_basari int not null default 0,
  blok int not null default 0,
  postur_uyari int not null default 0,
  en_iyi_combo int not null default 0,
  sure_sn int not null default 0,
  tempo_dilim int[] not null default '{}',
  kalca_gorundu boolean not null default false,
  bacak_gorundu boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists boks_roundlar_user_idx on public.boks_roundlar (user_id, created_at desc);
create index if not exists boks_roundlar_oturum_idx on public.boks_roundlar (oturum_id);

-- ---------------- kariyer (kümülatif) ----------------
create table if not exists public.boks_kariyer (
  user_id uuid primary key references auth.users(id) on delete cascade,
  toplam_oturum int not null default 0,
  toplam_round int not null default 0,
  toplam_puan bigint not null default 0,
  toplam_yumruk bigint not null default 0,
  toplam_isabet bigint not null default 0,
  toplam_kacirma bigint not null default 0,
  toplam_yanlis_tur bigint not null default 0,
  toplam_sure bigint not null default 0,
  toplam_kalori bigint not null default 0,
  y1 bigint not null default 0,
  y2 bigint not null default 0,
  y3 bigint not null default 0,
  y4 bigint not null default 0,
  y5 bigint not null default 0,
  y6 bigint not null default 0,
  sol_yumruk bigint not null default 0,
  sag_yumruk bigint not null default 0,
  siddet_toplam bigint not null default 0,
  siddet_max int not null default 0,
  dusuk_gard_olay bigint not null default 0,
  vurusta_acik_gard bigint not null default 0,
  gard_dusuk_sure real not null default 0,
  gard_olcu_sure real not null default 0,
  kacinma_deneme bigint not null default 0,
  kacinma_basari bigint not null default 0,
  blok bigint not null default 0,
  postur_uyari bigint not null default 0,
  en_iyi_combo int not null default 0,
  kalca_gorundu boolean not null default false,
  bacak_gorundu boolean not null default false,
  stil_kod text,
  eslesen_dovuscu text,
  -- streak (günlük antrenman serisi)
  seri_gun int not null default 0,
  en_uzun_seri int not null default 0,
  son_gun date,
  antrenman_gun int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------- skorlar (leaderboard) ----------------
create table if not exists public.boks_skorlar (
  user_id uuid not null references auth.users(id) on delete cascade,
  mod text not null check (mod in ('serbest','koc','savunma','ritim')),
  en_iyi int not null default 0,
  toplam_yumruk int not null default 0,
  oyun_sayisi int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mod)
);
create index if not exists boks_skorlar_sira_idx on public.boks_skorlar (mod, en_iyi desc);

-- ---------------- zayıflık takibi (koçluk döngüsü) ----------------
create table if not exists public.boks_zayifliklar (
  user_id uuid not null references auth.users(id) on delete cascade,
  kod text not null,
  gorulme_sayisi int not null default 1,
  son_olcum text,
  durum text not null default 'aktif' check (durum in ('aktif','duzeldi')),
  ilk_gorulme timestamptz not null default now(),
  son_gorulme timestamptz not null default now(),
  primary key (user_id, kod)
);

-- ---------------- rozetler ----------------
create table if not exists public.boks_rozetler (
  user_id uuid not null references auth.users(id) on delete cascade,
  kod text not null,
  kazanildi_at timestamptz not null default now(),
  primary key (user_id, kod)
);

-- ---------------- sezon (aylık) ----------------
create table if not exists public.boks_sezon (
  user_id uuid not null references auth.users(id) on delete cascade,
  sezon int not null, -- yil*12 + ay
  puan bigint not null default 0,
  round_sayisi int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, sezon)
);
create index if not exists boks_sezon_sira_idx on public.boks_sezon (sezon, puan desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.boks_tercihler enable row level security;
alter table public.boks_oturumlar enable row level security;
alter table public.boks_roundlar enable row level security;
alter table public.boks_kariyer enable row level security;
alter table public.boks_skorlar enable row level security;
alter table public.boks_zayifliklar enable row level security;
alter table public.boks_rozetler enable row level security;
alter table public.boks_sezon enable row level security;

-- Kendi verisini okuyabilir (yazım yalnız RPC ile).
drop policy if exists "boks_tercihler_select_own" on public.boks_tercihler;
create policy "boks_tercihler_select_own" on public.boks_tercihler
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "boks_oturumlar_select_own" on public.boks_oturumlar;
create policy "boks_oturumlar_select_own" on public.boks_oturumlar
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "boks_roundlar_select_own" on public.boks_roundlar;
create policy "boks_roundlar_select_own" on public.boks_roundlar
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "boks_kariyer_select_own" on public.boks_kariyer;
create policy "boks_kariyer_select_own" on public.boks_kariyer
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "boks_zayifliklar_select_own" on public.boks_zayifliklar;
create policy "boks_zayifliklar_select_own" on public.boks_zayifliklar
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "boks_rozetler_select_own" on public.boks_rozetler;
create policy "boks_rozetler_select_own" on public.boks_rozetler
  for select to authenticated using (user_id = auth.uid());

-- Skorlar ve sezon herkese açık okunur (sıralama).
drop policy if exists "boks_skorlar_select" on public.boks_skorlar;
create policy "boks_skorlar_select" on public.boks_skorlar
  for select to authenticated using (true);

drop policy if exists "boks_sezon_select" on public.boks_sezon;
create policy "boks_sezon_select" on public.boks_sezon
  for select to authenticated using (true);

revoke insert, update, delete on public.boks_tercihler from authenticated, anon;
revoke insert, update, delete on public.boks_oturumlar from authenticated, anon;
revoke insert, update, delete on public.boks_roundlar from authenticated, anon;
revoke insert, update, delete on public.boks_kariyer from authenticated, anon;
revoke insert, update, delete on public.boks_skorlar from authenticated, anon;
revoke insert, update, delete on public.boks_zayifliklar from authenticated, anon;
revoke insert, update, delete on public.boks_rozetler from authenticated, anon;
revoke insert, update, delete on public.boks_sezon from authenticated, anon;

-- ============================================================
-- RPC: tercih kaydet
-- ============================================================
create or replace function public.boks_tercih_kaydet(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durus text := coalesce(p->>'durus', 'ortodoks');
  v_eldiven text := coalesce(p->>'eldiven_turu', 'boks');
  v_renk text := coalesce(p->>'eldiven_renk', '#ff4d3d');
  v_koc text := coalesce(p->>'koc_kisilik', 'agresif');
  v_kilo int := nullif(p->>'kilo_kg','')::int;
  v_zorluk text := nullif(p->>'onerilen_zorluk','');
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if v_durus not in ('ortodoks','guney_pence') then v_durus := 'ortodoks'; end if;
  if v_eldiven not in ('boks','mma') then v_eldiven := 'boks'; end if;
  if v_koc not in ('agresif','sakin') then v_koc := 'agresif'; end if;
  if v_kilo is not null and (v_kilo < 25 or v_kilo > 250) then v_kilo := null; end if;
  if v_zorluk is not null and v_zorluk not in ('kolay','orta','zor','pro') then v_zorluk := null; end if;
  -- renk yalnız #rrggbb biçiminde kabul edilir (istemciye güvenme)
  if v_renk !~ '^#[0-9a-fA-F]{6}$' then v_renk := '#ff4d3d'; end if;

  insert into public.boks_tercihler (
    user_id, durus, eldiven_turu, eldiven_renk, koc_kisilik, kilo_kg, onerilen_zorluk,
    ses_acik, koc_acik, updated_at
  ) values (
    auth.uid(), v_durus, v_eldiven, v_renk, v_koc, v_kilo, v_zorluk,
    coalesce((p->>'ses_acik')::boolean, true), coalesce((p->>'koc_acik')::boolean, true), now()
  )
  on conflict (user_id) do update set
    durus = excluded.durus,
    eldiven_turu = excluded.eldiven_turu,
    eldiven_renk = excluded.eldiven_renk,
    koc_kisilik = excluded.koc_kisilik,
    kilo_kg = coalesce(excluded.kilo_kg, public.boks_tercihler.kilo_kg),
    onerilen_zorluk = coalesce(excluded.onerilen_zorluk, public.boks_tercihler.onerilen_zorluk),
    ses_acik = excluded.ses_acik,
    koc_acik = excluded.koc_acik,
    updated_at = now();
end;
$$;

-- ============================================================
-- RPC: oturum kaydet (oturum + roundlar + kariyer + streak + skor + sezon + rozet)
-- Tek çağrıda atomik olarak yazılır. Sunucu tarafında makul sınır denetimi yapılır:
-- istemciden gelen değerler fiziksel olarak imkânsız aralıktaysa reddedilir.
-- ============================================================
create or replace function public.boks_oturum_kaydet(
  p_mod text,
  p_zorluk text,
  p_ozet jsonb,
  p_roundlar jsonb,
  p_zayifliklar jsonb default '[]'::jsonb,
  p_rozetler text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_oturum uuid;
  v_round jsonb;
  v_no int := 0;
  v_puan int := coalesce((p_ozet->>'puan')::int, 0);
  v_yumruk int := coalesce((p_ozet->>'toplamYumruk')::int, 0);
  v_sure int := coalesce((p_ozet->>'sure')::int, 0);
  v_kalori int := coalesce((p_ozet->>'kalori')::int, 0);
  v_bugun date := (now() at time zone 'utc')::date;
  v_son_gun date;
  v_seri int;
  v_sezon int := extract(year from now())::int * 12 + extract(month from now())::int;
  v_yeni_rozet text[] := '{}';
  v_kod text;
  v_z jsonb;
begin
  if v_uid is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('serbest','koc','savunma','ritim') then raise exception 'Geçersiz mod'; end if;
  if p_zorluk not in ('kolay','orta','zor','pro','test') then raise exception 'Geçersiz zorluk'; end if;
  -- Üst sınırlar: 5 round × 90 sn'de teorik tavanın çok üstünü reddet.
  if v_puan < 0 or v_puan > 200000 then raise exception 'Geçersiz puan'; end if;
  if v_yumruk < 0 or v_yumruk > 5000 then raise exception 'Geçersiz yumruk sayısı'; end if;
  if v_sure < 0 or v_sure > 3600 then raise exception 'Geçersiz süre'; end if;
  if v_kalori < 0 or v_kalori > 3000 then v_kalori := 0; end if;

  insert into public.boks_oturumlar (
    user_id, mod, zorluk, round_sayisi, puan, toplam_yumruk, isabet, kacirma,
    sure_sn, kalori, ort_siddet, max_siddet, en_iyi_combo, stil_kod, eslesen_dovuscu
  ) values (
    v_uid, p_mod, p_zorluk,
    coalesce(jsonb_array_length(p_roundlar), 0),
    v_puan, v_yumruk,
    coalesce((p_ozet->>'isabet')::int, 0),
    coalesce((p_ozet->>'kacirma')::int, 0),
    v_sure, v_kalori,
    least(100, greatest(0, coalesce((p_ozet->>'ortSiddet')::int, 0))),
    least(100, greatest(0, coalesce((p_ozet->>'siddetMax')::int, 0))),
    least(999, greatest(0, coalesce((p_ozet->>'enIyiCombo')::int, 0))),
    nullif(p_ozet->>'stilKod',''),
    nullif(p_ozet->>'eslesenDovuscu','')
  ) returning id into v_oturum;

  -- ---- roundlar ----
  for v_round in select * from jsonb_array_elements(coalesce(p_roundlar, '[]'::jsonb))
  loop
    v_no := v_no + 1;
    insert into public.boks_roundlar (
      oturum_id, user_id, round_no, puan,
      y1, y2, y3, y4, y5, y6,
      toplam_yumruk, isabet, kacirma, yanlis_tur, sol_yumruk, sag_yumruk,
      siddet_toplam, siddet_max, dusuk_gard_olay, vurusta_acik_gard,
      gard_dusuk_sure, gard_olcu_sure, kacinma_deneme, kacinma_basari, blok,
      postur_uyari, en_iyi_combo, sure_sn, tempo_dilim, kalca_gorundu, bacak_gorundu
    ) values (
      v_oturum, v_uid, v_no,
      greatest(0, coalesce((v_round->>'puan')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'1')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'2')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'3')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'4')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'5')::int, 0)),
      greatest(0, coalesce((v_round->'yumruk'->>'6')::int, 0)),
      greatest(0, coalesce((v_round->>'toplamYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'isabet')::int, 0)),
      greatest(0, coalesce((v_round->>'kacirma')::int, 0)),
      greatest(0, coalesce((v_round->>'yanlisTur')::int, 0)),
      greatest(0, coalesce((v_round->>'solYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'sagYumruk')::int, 0)),
      greatest(0, coalesce((v_round->>'siddetToplam')::int, 0)),
      least(100, greatest(0, coalesce((v_round->>'siddetMax')::int, 0))),
      greatest(0, coalesce((v_round->>'dusukGardOlay')::int, 0)),
      greatest(0, coalesce((v_round->>'vurustaAcikGard')::int, 0)),
      greatest(0, coalesce((v_round->>'gardDusukSure')::real, 0)),
      greatest(0, coalesce((v_round->>'gardOlcuSure')::real, 0)),
      greatest(0, coalesce((v_round->>'kacinmaDeneme')::int, 0)),
      greatest(0, coalesce((v_round->>'kacinmaBasari')::int, 0)),
      greatest(0, coalesce((v_round->>'blok')::int, 0)),
      greatest(0, coalesce((v_round->>'posturUyari')::int, 0)),
      greatest(0, coalesce((v_round->>'enIyiCombo')::int, 0)),
      greatest(0, coalesce((v_round->>'sure')::int, 0)),
      coalesce((select array_agg(x)::int[] from jsonb_array_elements_text(coalesce(v_round->'tempoDilim','[]'::jsonb)) as t(x)), '{}'),
      coalesce((v_round->'kapsam'->>'kalca')::boolean, false),
      coalesce((v_round->'kapsam'->>'bacaklar')::boolean, false)
    );
  end loop;

  -- ---- kariyer + streak ----
  select son_gun, seri_gun into v_son_gun, v_seri
    from public.boks_kariyer where user_id = v_uid for update;

  if v_son_gun is null then
    v_seri := 1;
  elsif v_son_gun = v_bugun then
    v_seri := greatest(1, coalesce(v_seri, 1));
  elsif v_son_gun = v_bugun - 1 then
    v_seri := coalesce(v_seri, 0) + 1;
  else
    v_seri := 1;
  end if;

  insert into public.boks_kariyer as k (
    user_id, toplam_oturum, toplam_round, toplam_puan, toplam_yumruk, toplam_isabet,
    toplam_kacirma, toplam_yanlis_tur, toplam_sure, toplam_kalori,
    y1, y2, y3, y4, y5, y6, sol_yumruk, sag_yumruk, siddet_toplam, siddet_max,
    dusuk_gard_olay, vurusta_acik_gard, gard_dusuk_sure, gard_olcu_sure,
    kacinma_deneme, kacinma_basari, blok, postur_uyari, en_iyi_combo,
    kalca_gorundu, bacak_gorundu, stil_kod, eslesen_dovuscu,
    seri_gun, en_uzun_seri, son_gun, antrenman_gun, updated_at
  )
  select
    v_uid, 1, coalesce(jsonb_array_length(p_roundlar),0), v_puan, v_yumruk,
    coalesce(sum(r.isabet),0), coalesce(sum(r.kacirma),0), coalesce(sum(r.yanlis_tur),0),
    v_sure, v_kalori,
    coalesce(sum(r.y1),0), coalesce(sum(r.y2),0), coalesce(sum(r.y3),0),
    coalesce(sum(r.y4),0), coalesce(sum(r.y5),0), coalesce(sum(r.y6),0),
    coalesce(sum(r.sol_yumruk),0), coalesce(sum(r.sag_yumruk),0),
    coalesce(sum(r.siddet_toplam),0), coalesce(max(r.siddet_max),0),
    coalesce(sum(r.dusuk_gard_olay),0), coalesce(sum(r.vurusta_acik_gard),0),
    coalesce(sum(r.gard_dusuk_sure),0), coalesce(sum(r.gard_olcu_sure),0),
    coalesce(sum(r.kacinma_deneme),0), coalesce(sum(r.kacinma_basari),0),
    coalesce(sum(r.blok),0), coalesce(sum(r.postur_uyari),0), coalesce(max(r.en_iyi_combo),0),
    coalesce(bool_or(r.kalca_gorundu), false), coalesce(bool_or(r.bacak_gorundu), false),
    nullif(p_ozet->>'stilKod',''), nullif(p_ozet->>'eslesenDovuscu',''),
    v_seri, v_seri, v_bugun, 1, now()
  from public.boks_roundlar r where r.oturum_id = v_oturum
  on conflict (user_id) do update set
    toplam_oturum = k.toplam_oturum + 1,
    toplam_round = k.toplam_round + excluded.toplam_round,
    toplam_puan = k.toplam_puan + excluded.toplam_puan,
    toplam_yumruk = k.toplam_yumruk + excluded.toplam_yumruk,
    toplam_isabet = k.toplam_isabet + excluded.toplam_isabet,
    toplam_kacirma = k.toplam_kacirma + excluded.toplam_kacirma,
    toplam_yanlis_tur = k.toplam_yanlis_tur + excluded.toplam_yanlis_tur,
    toplam_sure = k.toplam_sure + excluded.toplam_sure,
    toplam_kalori = k.toplam_kalori + excluded.toplam_kalori,
    y1 = k.y1 + excluded.y1, y2 = k.y2 + excluded.y2, y3 = k.y3 + excluded.y3,
    y4 = k.y4 + excluded.y4, y5 = k.y5 + excluded.y5, y6 = k.y6 + excluded.y6,
    sol_yumruk = k.sol_yumruk + excluded.sol_yumruk,
    sag_yumruk = k.sag_yumruk + excluded.sag_yumruk,
    siddet_toplam = k.siddet_toplam + excluded.siddet_toplam,
    siddet_max = greatest(k.siddet_max, excluded.siddet_max),
    dusuk_gard_olay = k.dusuk_gard_olay + excluded.dusuk_gard_olay,
    vurusta_acik_gard = k.vurusta_acik_gard + excluded.vurusta_acik_gard,
    gard_dusuk_sure = k.gard_dusuk_sure + excluded.gard_dusuk_sure,
    gard_olcu_sure = k.gard_olcu_sure + excluded.gard_olcu_sure,
    kacinma_deneme = k.kacinma_deneme + excluded.kacinma_deneme,
    kacinma_basari = k.kacinma_basari + excluded.kacinma_basari,
    blok = k.blok + excluded.blok,
    postur_uyari = k.postur_uyari + excluded.postur_uyari,
    en_iyi_combo = greatest(k.en_iyi_combo, excluded.en_iyi_combo),
    kalca_gorundu = k.kalca_gorundu or excluded.kalca_gorundu,
    bacak_gorundu = k.bacak_gorundu or excluded.bacak_gorundu,
    stil_kod = coalesce(excluded.stil_kod, k.stil_kod),
    eslesen_dovuscu = coalesce(excluded.eslesen_dovuscu, k.eslesen_dovuscu),
    seri_gun = v_seri,
    en_uzun_seri = greatest(k.en_uzun_seri, v_seri),
    antrenman_gun = k.antrenman_gun + (case when k.son_gun is distinct from v_bugun then 1 else 0 end),
    son_gun = v_bugun,
    updated_at = now();

  -- ---- leaderboard + sezon (test round'u sayılmaz) ----
  if p_zorluk <> 'test' then
    insert into public.boks_skorlar (user_id, mod, en_iyi, toplam_yumruk, oyun_sayisi, updated_at)
    values (v_uid, p_mod, v_puan, v_yumruk, 1, now())
    on conflict (user_id, mod) do update set
      en_iyi = greatest(public.boks_skorlar.en_iyi, excluded.en_iyi),
      toplam_yumruk = public.boks_skorlar.toplam_yumruk + excluded.toplam_yumruk,
      oyun_sayisi = public.boks_skorlar.oyun_sayisi + 1,
      updated_at = now();

    insert into public.boks_sezon (user_id, sezon, puan, round_sayisi, updated_at)
    values (v_uid, v_sezon, v_puan, coalesce(jsonb_array_length(p_roundlar),0), now())
    on conflict (user_id, sezon) do update set
      puan = public.boks_sezon.puan + excluded.puan,
      round_sayisi = public.boks_sezon.round_sayisi + excluded.round_sayisi,
      updated_at = now();
  end if;

  -- ---- zayıflık takibi (koçluk döngüsü) ----
  for v_z in select * from jsonb_array_elements(coalesce(p_zayifliklar, '[]'::jsonb))
  loop
    insert into public.boks_zayifliklar (user_id, kod, gorulme_sayisi, son_olcum, durum, son_gorulme)
    values (v_uid, left(coalesce(v_z->>'kod','?'), 40), 1, left(coalesce(v_z->>'olcum',''), 120), 'aktif', now())
    on conflict (user_id, kod) do update set
      gorulme_sayisi = public.boks_zayifliklar.gorulme_sayisi + 1,
      son_olcum = excluded.son_olcum,
      durum = 'aktif',
      son_gorulme = now();
  end loop;

  -- Bu oturumda görülmeyen aktif zayıflıklar "düzeldi" işaretlenir.
  update public.boks_zayifliklar z set durum = 'duzeldi'
   where z.user_id = v_uid and z.durum = 'aktif'
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_zayifliklar,'[]'::jsonb)) e
        where e->>'kod' = z.kod
     );

  -- ---- rozetler ----
  foreach v_kod in array coalesce(p_rozetler, '{}'::text[])
  loop
    if length(v_kod) between 1 and 40 then
      insert into public.boks_rozetler (user_id, kod) values (v_uid, v_kod)
      on conflict (user_id, kod) do nothing;
      if found then v_yeni_rozet := array_append(v_yeni_rozet, v_kod); end if;
    end if;
  end loop;

  return jsonb_build_object(
    'oturum_id', v_oturum,
    'seri_gun', v_seri,
    'yeni_rozetler', to_jsonb(v_yeni_rozet)
  );
end;
$$;

-- ============================================================
-- RPC: sıralama (mod bazlı)
-- ============================================================
create or replace function public.boks_siralama(p_mod text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  en_iyi int,
  toplam_yumruk int,
  oyun_sayisi int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('serbest','koc','savunma','ritim') then raise exception 'Geçersiz mod'; end if;

  return query
    select s.user_id, p.username, p.avatar_url, s.en_iyi, s.toplam_yumruk, s.oyun_sayisi
      from public.boks_skorlar s
      join public.profiles p on p.id = s.user_id
     where s.mod = p_mod and s.en_iyi > 0
     order by s.en_iyi desc, s.updated_at asc
     limit 100;
end;
$$;

-- ============================================================
-- RPC: sezon sıralaması (dönemsel lig)
-- ============================================================
create or replace function public.boks_sezon_siralama()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  puan bigint,
  round_sayisi int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sezon int := extract(year from now())::int * 12 + extract(month from now())::int;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  return query
    select s.user_id, p.username, p.avatar_url, s.puan, s.round_sayisi
      from public.boks_sezon s
      join public.profiles p on p.id = s.user_id
     where s.sezon = v_sezon
     order by s.puan desc, s.updated_at asc
     limit 100;
end;
$$;

-- ============================================================
-- RPC: kariyer paketi (kariyer + zayıflıklar + rozetler + son roundlar)
-- Tek çağrıda tüm Kariyer sayfası verisi.
-- ============================================================
create or replace function public.boks_kariyer_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kariyer jsonb;
  v_zayif jsonb;
  v_rozet jsonb;
  v_roundlar jsonb;
  v_tercih jsonb;
begin
  if v_uid is null then raise exception 'Oturum yok'; end if;

  select to_jsonb(k) into v_kariyer from public.boks_kariyer k where k.user_id = v_uid;
  select coalesce(jsonb_agg(to_jsonb(z) order by z.gorulme_sayisi desc), '[]'::jsonb)
    into v_zayif from public.boks_zayifliklar z where z.user_id = v_uid;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.kazanildi_at desc), '[]'::jsonb)
    into v_rozet from public.boks_rozetler r where r.user_id = v_uid;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_roundlar from (
      select id, round_no, toplam_yumruk, isabet, en_iyi_combo, siddet_toplam,
             gard_dusuk_sure, gard_olcu_sure, sure_sn, created_at
        from public.boks_roundlar
       where user_id = v_uid
       order by created_at desc
       limit 40
    ) x;
  select to_jsonb(t) into v_tercih from public.boks_tercihler t where t.user_id = v_uid;

  return jsonb_build_object(
    'kariyer', coalesce(v_kariyer, 'null'::jsonb),
    'zayifliklar', v_zayif,
    'rozetler', v_rozet,
    'son_roundlar', v_roundlar,
    'tercih', coalesce(v_tercih, 'null'::jsonb)
  );
end;
$$;

-- ============================================================
-- RPC yetkileri — yalnız authenticated
-- ============================================================
revoke execute on function public.boks_tercih_kaydet(jsonb) from public, anon;
grant execute on function public.boks_tercih_kaydet(jsonb) to authenticated;

revoke execute on function public.boks_oturum_kaydet(text, text, jsonb, jsonb, jsonb, text[]) from public, anon;
grant execute on function public.boks_oturum_kaydet(text, text, jsonb, jsonb, jsonb, text[]) to authenticated;

revoke execute on function public.boks_siralama(text) from public, anon;
grant execute on function public.boks_siralama(text) to authenticated;

revoke execute on function public.boks_sezon_siralama() from public, anon;
grant execute on function public.boks_sezon_siralama() to authenticated;

revoke execute on function public.boks_kariyer_getir() from public, anon;
grant execute on function public.boks_kariyer_getir() to authenticated;
