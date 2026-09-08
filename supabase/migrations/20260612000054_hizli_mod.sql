-- ============================================================
-- 54 — HIZLI MOD (tek kişilik, 60 saniye)
--
-- Kurallar: 60 sn toplam, soru başına 5 sn, doğru +1, yanlış ceza YOK.
-- LİG PUANINA GİRMEZ (profiles.puan / puan_hafta'ya dokunulmaz) — kendi
-- haftalık sıralaması vardır. Kategori seçilebilir; sorular oyuncunun
-- görmediklerinden seçilir (soru_sec) ve gösterildikçe gorulen_sorular'a yazılır.
--
-- Süre kontrolü SUNUCUDA: her cevap `hizli_mod_cevap` içinde oturum
-- başlangıcına ve soru gösterim zamanına göre doğrulanır.
--
-- NOT: Mevcut çok oyunculu "Hızlı Olan Kazanır" modu (`hizli_maclar`) ayrıdır
-- ve bu migration ona DOKUNMAZ.
-- ============================================================

create table if not exists public.hizli_mod_oturumlar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kategori text,
  soru_ids uuid[] not null default '{}',
  aktif_soru int not null default 0,
  soru_baslangic timestamptz not null default now(),
  baslangic timestamptz not null default now(),
  bitis timestamptz,
  dogru int not null default 0,
  yanlis int not null default 0,
  durum text not null default 'aktif' check (durum in ('aktif','bitti')),
  created_at timestamptz not null default now()
);

create index if not exists idx_hizli_mod_oturum_kullanici
  on public.hizli_mod_oturumlar (user_id, created_at desc);

create table if not exists public.hizli_mod_skorlar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  oturum_id uuid not null references public.hizli_mod_oturumlar(id) on delete cascade,
  kategori text,
  skor int not null,
  hafta date not null,               -- o haftanın Pazartesi'si (TSİ)
  created_at timestamptz not null default now()
);

create index if not exists idx_hizli_mod_skor_hafta
  on public.hizli_mod_skorlar (hafta, skor desc);
create index if not exists idx_hizli_mod_skor_kullanici
  on public.hizli_mod_skorlar (user_id, hafta);

alter table public.hizli_mod_oturumlar enable row level security;
alter table public.hizli_mod_skorlar enable row level security;

drop policy if exists "hizli_mod_oturum_own" on public.hizli_mod_oturumlar;
create policy "hizli_mod_oturum_own" on public.hizli_mod_oturumlar for select
  using (auth.uid() = user_id);
drop policy if exists "hizli_mod_skor_own" on public.hizli_mod_skorlar;
create policy "hizli_mod_skor_own" on public.hizli_mod_skorlar for select
  using (auth.uid() = user_id);

revoke all on public.hizli_mod_oturumlar from authenticated, anon;
revoke all on public.hizli_mod_skorlar from authenticated, anon;
grant select on public.hizli_mod_oturumlar to authenticated;
grant select on public.hizli_mod_skorlar to authenticated;

-- Haftanın başlangıcı (Pazartesi, TSİ) — lig arşiviyle aynı tanım
create or replace function public.hafta_basi()
returns date
language sql
stable
as $$
  select (date_trunc('week', (now() at time zone 'Europe/Istanbul')))::date;
$$;

-- ============================================================
-- Oturum başlat
-- ============================================================

create or replace function public.hizli_mod_baslat(p_kategori text default null)
returns table (oturum_id uuid, soru_sayisi int, sure_sn int, soru_sure_sn int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_kat text;
  v_ids uuid[];
  v_id uuid;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Devam eden oturumu kapat (tek aktif oturum)
  update public.hizli_mod_oturumlar
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  perform public.mac_kotasi_kontrol();

  -- 60 sn / 5 sn = en çok 12 soru; yedekle birlikte 25 çekilir
  v_ids := public.soru_sec(v_kat, 25, array[v_me]);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Bu kategoride soru bulunamadı';
  end if;

  insert into public.hizli_mod_oturumlar (user_id, kategori, soru_ids)
  values (v_me, v_kat, v_ids)
  returning id into v_id;

  return query select v_id, coalesce(array_length(v_ids, 1), 0), 60, 5;
end;
$$;

revoke execute on function public.hizli_mod_baslat(text) from public, anon;
grant execute on function public.hizli_mod_baslat(text) to authenticated;

-- ============================================================
-- Aktif soruyu getir (gösterildiğinde gorulen_sorular'a yazılır)
-- ============================================================

create or replace function public.hizli_mod_soru(p_oturum_id uuid)
returns table (
  question_id uuid, soru text, secenekler jsonb, soru_index int,
  baslangic timestamptz, sunucu_zamani timestamptz, kalan_toplam_sn int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_kalan int;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;

  v_kalan := greatest(0, 60 - floor(extract(epoch from (now() - o.baslangic)))::int);
  if v_kalan <= 0 then
    perform public.hizli_mod_bitir(p_oturum_id);
    raise exception 'Süre doldu';
  end if;

  perform public.gorulen_kaydet(o.soru_ids[o.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, o.aktif_soru, o.soru_baslangic, now(), v_kalan
    from public.questions q
    where q.id = o.soru_ids[o.aktif_soru + 1];
end;
$$;

revoke execute on function public.hizli_mod_soru(uuid) from public, anon;
grant execute on function public.hizli_mod_soru(uuid) to authenticated;

-- ============================================================
-- Cevap (süre kontrolü sunucuda)
-- ============================================================

create or replace function public.hizli_mod_cevap(
  p_oturum_id uuid, p_soru_index int, p_cevap smallint
)
returns table (dogru boolean, dogru_cevap smallint, skor int, kalan_toplam_sn int, bitti boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hizli_mod_oturumlar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_kalan int;
  v_bitti boolean := false;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  v_kalan := greatest(0, 60 - floor(extract(epoch from (now() - o.baslangic)))::int);

  -- Soru başına 5 sn (1 sn ağ payı)
  if now() > o.soru_baslangic + interval '6 seconds' then
    v_dogru := false;                                   -- süre geçti: yanlış sayılır
  else
    select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];
    v_dogru := (p_cevap = q.dogru_cevap);
  end if;

  if q.id is null then
    select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];
  end if;

  -- Kategori ustalığı: hızlı modda da doğrular sayılır
  if v_dogru then
    perform public.kategori_dogru_arttir(auth.uid(), q.kategori);
  end if;

  update public.hizli_mod_oturumlar
     set dogru = dogru + (case when v_dogru then 1 else 0 end),
         yanlis = yanlis + (case when v_dogru then 0 else 1 end),
         aktif_soru = aktif_soru + 1,
         soru_baslangic = now()
   where id = p_oturum_id
  returning * into o;

  if v_kalan <= 0 or o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    perform public.hizli_mod_bitir(p_oturum_id);
    v_bitti := true;
    v_kalan := 0;
  end if;

  return query select v_dogru, q.dogru_cevap, o.dogru, v_kalan, v_bitti;
end;
$$;

revoke execute on function public.hizli_mod_cevap(uuid, int, smallint) from public, anon;
grant execute on function public.hizli_mod_cevap(uuid, int, smallint) to authenticated;

-- ============================================================
-- Bitir (lig puanına DOKUNMAZ)
-- ============================================================

create or replace function public.hizli_mod_bitir(p_oturum_id uuid)
returns table (skor int, dogru int, yanlis int, en_iyi_hafta int)
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_hafta date := public.hafta_basi();
  v_en_iyi int;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() and auth.uid() is not null then
    raise exception 'Bu oturum senin değil';
  end if;

  if o.durum = 'aktif' then
    update public.hizli_mod_oturumlar
       set durum = 'bitti', bitis = now()
     where id = p_oturum_id
    returning * into o;

    insert into public.hizli_mod_skorlar (user_id, oturum_id, kategori, skor, hafta)
    values (o.user_id, o.id, o.kategori, o.dogru, v_hafta);
  end if;

  select max(s.skor) into v_en_iyi
  from public.hizli_mod_skorlar s
  where s.user_id = o.user_id and s.hafta = v_hafta;

  return query select o.dogru, o.dogru, o.yanlis, coalesce(v_en_iyi, o.dogru);
end;
$$;

revoke execute on function public.hizli_mod_bitir(uuid) from public, anon;
grant execute on function public.hizli_mod_bitir(uuid) to authenticated;

-- ============================================================
-- Haftalık sıralama (şehir / ülke / dünya) — oyuncu başına en iyi skor
-- ============================================================

create or replace function public.hizli_mod_siralama(p_kapsam text default 'global')
returns table (
  sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
  skor int, sehir text, ulke text, ben boolean
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
  v_hafta date := public.hafta_basi();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_kapsam not in ('sehir','ulke','global') then raise exception 'Geçersiz kapsam'; end if;

  select p.ulke, p.sehir into v_ulke, v_sehir from public.profiles p where p.id = v_me;
  if p_kapsam in ('sehir','ulke') and v_ulke is null then
    raise exception 'Önce ülkeni ve şehrini seçmelisin';
  end if;

  return query
  with eniyi as (
    select s.user_id, max(s.skor) as skor
    from public.hizli_mod_skorlar s
    where s.hafta = v_hafta
    group by s.user_id
  ), sirali as (
    select e.user_id, p.gorunen_ad, p.gorunen_avatar, e.skor, p.sehir, p.ulke,
           row_number() over (order by e.skor desc, p.gorunen_ad asc) as p_sira
    from eniyi e
    join public.profiles p on p.id = e.user_id
    where coalesce(p.is_bot, false) = false
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.user_id, s.gorunen_ad, s.gorunen_avatar, s.skor, s.sehir, s.ulke,
         (s.user_id = v_me)
  from sirali s
  where s.p_sira <= 100 or s.user_id = v_me
  order by s.p_sira;
end;
$$;

revoke execute on function public.hizli_mod_siralama(text) from public, anon;
grant execute on function public.hizli_mod_siralama(text) to authenticated;

create or replace function public.hizli_mod_ozetim()
returns table (bu_hafta_en_iyi int, tum_zaman_en_iyi int, oynanan int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select max(skor) from public.hizli_mod_skorlar
              where user_id = auth.uid() and hafta = public.hafta_basi()), 0),
    coalesce((select max(skor) from public.hizli_mod_skorlar where user_id = auth.uid()), 0),
    coalesce((select count(*)::int from public.hizli_mod_skorlar where user_id = auth.uid()), 0);
$$;

revoke execute on function public.hizli_mod_ozetim() from public, anon;
grant execute on function public.hizli_mod_ozetim() to authenticated;
