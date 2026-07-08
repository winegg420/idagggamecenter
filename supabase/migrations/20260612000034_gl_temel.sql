-- ============================================================
-- GLADIUS Battle Royale — DB temeli (Faz 1)
-- Tüm tablolar gl_ önekli, Bildim şemasına dokunmaz.
-- Kritik yazımlar security-definer RPC'lerle yapılır (Bildim deseni).
-- Süper admin doğrulaması İda'nın sabit UUID'sine bağlıdır (sunucu tarafı).
-- ============================================================

-- ---------- Süper admin yardımcısı ----------
-- Tasarım 3.2.6: tüm admin yetkileri İstisnasız sunucuda, İda'nın hesabına
-- bağlı doğrulanır. Bildim'deki gelistirici UUID'si ile aynı hesap.
create or replace function public.gl_admin_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'e4f6006f-d6bb-4ca8-be67-3bdf9efc9708'::uuid;
$$;

revoke execute on function public.gl_admin_mi() from public, anon;
grant execute on function public.gl_admin_mi() to authenticated;

-- ---------- Tablolar ----------

-- Kalıcı oyuncu profili (Gladius'a özel; Bildim profiles'tan ayrı).
create table public.gl_profiller (
  user_id uuid primary key references auth.users(id) on delete cascade,
  karakter text not null default 'gladyator_01',
  silah text not null default 'kilic',
  silah_varyant text not null default 'kilic_1',
  kalkan text not null default 'yuvarlak',
  kalkan_varyant text not null default 'yuvarlak_1',
  -- Miğfer, pelerin rengi, amblem, zırh, saç, dövme vb. tek jsonb'de.
  kozmetik jsonb not null default '{}'::jsonb,
  lig text not null default 'cirak',           -- cirak/gladyator/sampiyon/efsane/imparator
  puan int not null default 0,
  mac_sayisi int not null default 0,
  galibiyet int not null default 0,
  toplam_eleme int not null default 0,
  gunluk_seri int not null default 0,
  son_giris_tarihi date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maç odası (hızlı eşleşme veya özel/davetli).
create table public.gl_odalar (
  id uuid primary key default gen_random_uuid(),
  mod text not null check (mod in ('battle_royale','deathmatch')),
  tur text not null default 'hizli' check (tur in ('hizli','ozel')),
  host uuid references auth.users(id) on delete set null,
  durum text not null default 'bekliyor'
    check (durum in ('bekliyor','basladi','bitti','iptal')),
  katilim_kodu text,                            -- özel odalar için opsiyonel kod
  created_at timestamptz not null default now(),
  baslangic timestamptz,
  bitis timestamptz
);
create index gl_odalar_durum_idx on public.gl_odalar (durum, mod);

-- Odadaki oyuncular (gerçek oyuncu veya bot).
create table public.gl_oda_oyunculari (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.gl_odalar(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,  -- null => bot
  bot boolean not null default false,
  bot_ad text,
  hazir boolean not null default false,
  slot int,                                     -- düello/takım ve konum ataması için
  katilma timestamptz not null default now()
);
-- Aynı gerçek oyuncu bir odaya iki kez giremez.
create unique index gl_oda_oyunculari_uniq
  on public.gl_oda_oyunculari (oda_id, user_id)
  where user_id is not null;
create index gl_oda_oyunculari_oda_idx on public.gl_oda_oyunculari (oda_id);

-- Biten maç kaydı (leaderboard/rozet/geçmiş).
create table public.gl_maclar (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid references public.gl_odalar(id) on delete set null,
  mod text not null check (mod in ('battle_royale','deathmatch')),
  kazanan uuid references auth.users(id) on delete set null,
  -- [{ "user_id|bot": ..., "sira": 1, "eleme": 3, "hayatta_sn": 214 }, ...]
  siralama jsonb not null default '[]'::jsonb,
  bitis timestamptz not null default now()
);
create index gl_maclar_bitis_idx on public.gl_maclar (bitis desc);

-- ---------- RLS ----------

alter table public.gl_profiller enable row level security;
alter table public.gl_odalar enable row level security;
alter table public.gl_oda_oyunculari enable row level security;
alter table public.gl_maclar enable row level security;

-- Profiller: herkes okuyabilir (kozmetik/lig görünürlüğü), yazım RPC ile.
create policy "gl_profiller_select" on public.gl_profiller for select
  to authenticated using (true);

-- Odalar: giriş yapmış herkes görebilir (lobi listesi), yazım RPC ile.
create policy "gl_odalar_select" on public.gl_odalar for select
  to authenticated using (true);

-- Oda oyuncuları: giriş yapmış herkes görebilir (lobi kadrosu), yazım RPC ile.
create policy "gl_oda_oyunculari_select" on public.gl_oda_oyunculari for select
  to authenticated using (true);

-- Maç kayıtları: giriş yapmış herkes görebilir (leaderboard), yazım RPC ile.
create policy "gl_maclar_select" on public.gl_maclar for select
  to authenticated using (true);

-- Doğrudan yazım kapalı; tüm değişiklikler security-definer RPC'lerden geçer.
revoke insert, update, delete on public.gl_profiller from authenticated, anon;
revoke insert, update, delete on public.gl_odalar from authenticated, anon;
revoke insert, update, delete on public.gl_oda_oyunculari from authenticated, anon;
revoke insert, update, delete on public.gl_maclar from authenticated, anon;

-- ---------- Profil RPC'leri ----------

-- Profil yoksa oluşturup döndürür (otomatik provisyon). Günlük seri de burada güncellenir.
create or replace function public.gl_profil_al()
returns public.gl_profiller
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.gl_profiller%rowtype;
  bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.uid() is null then
    raise exception 'Oturum yok';
  end if;

  insert into public.gl_profiller (user_id, son_giris_tarihi, gunluk_seri)
  values (auth.uid(), bugun, 1)
  on conflict (user_id) do nothing;

  select * into p from public.gl_profiller where user_id = auth.uid();

  -- Günlük seri: dün girmişse +1, bugün zaten girmişse aynı, daha eskiyse sıfırla.
  if p.son_giris_tarihi is distinct from bugun then
    if p.son_giris_tarihi = bugun - 1 then
      p.gunluk_seri := p.gunluk_seri + 1;
    else
      p.gunluk_seri := 1;
    end if;
    update public.gl_profiller
       set son_giris_tarihi = bugun, gunluk_seri = p.gunluk_seri, updated_at = now()
     where user_id = auth.uid()
     returning * into p;
  end if;

  return p;
end;
$$;

-- Karakter/silah/kalkan/kozmetik kaydı (yalnızca kendi profili).
create or replace function public.gl_profil_kaydet(
  p_karakter text,
  p_silah text,
  p_silah_varyant text,
  p_kalkan text,
  p_kalkan_varyant text,
  p_kozmetik jsonb
)
returns public.gl_profiller
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.gl_profiller%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Oturum yok';
  end if;

  -- Profil garanti olsun.
  insert into public.gl_profiller (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.gl_profiller
     set karakter       = coalesce(p_karakter, karakter),
         silah          = coalesce(p_silah, silah),
         silah_varyant  = coalesce(p_silah_varyant, silah_varyant),
         kalkan         = coalesce(p_kalkan, kalkan),
         kalkan_varyant = coalesce(p_kalkan_varyant, kalkan_varyant),
         kozmetik       = coalesce(p_kozmetik, kozmetik),
         updated_at     = now()
   where user_id = auth.uid()
   returning * into p;

  return p;
end;
$$;

-- RPC yetkileri: yalnızca giriş yapmış kullanıcı.
revoke execute on function public.gl_profil_al() from public, anon;
grant execute on function public.gl_profil_al() to authenticated;
revoke execute on function public.gl_profil_kaydet(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.gl_profil_kaydet(text, text, text, text, text, jsonb) to authenticated;
