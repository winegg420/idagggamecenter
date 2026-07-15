-- ============================================================
-- KAFA TOPU — DB temeli
-- Tüm tablolar kafatopu_ önekli, Bildim/Gladius şemalarına dokunmaz.
-- Yazımlar security-definer RPC'lerle yapılır (Bildim deseni).
-- Admin doğrulaması sunucu tarafında, sabit geliştirici UUID'sine bağlı.
-- ============================================================

-- ---------- Admin yardımcısı ----------
create or replace function public.kafatopu_admin_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'e4f6006f-d6bb-4ca8-be67-3bdf9efc9708'::uuid;
$$;

revoke execute on function public.kafatopu_admin_mi() from public, anon;
grant execute on function public.kafatopu_admin_mi() to authenticated;

-- ---------- Tablolar ----------

-- Kalıcı oyuncu profili (Kafa Topu'na özel; Bildim profiles'tan ayrı).
create table public.kafatopu_profiller (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kafa text not null default 'volkan',          -- seçili karakter/kafa id'si
  yetenek text not null default 'ates_sutu',    -- foto kafalar için seçilen yetenek
  puan int not null default 1000,               -- ELO (ranked)
  mac_sayisi int not null default 0,
  galibiyet int not null default 0,
  beraberlik int not null default 0,
  maglubiyet int not null default 0,
  atilan_gol int not null default 0,
  yenen_gol int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eşleştirme kuyruğu (1v1 / 2v2 × ranked / hızlı ayrı kuyruklar).
create table public.kafatopu_kuyruk (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mod text not null check (mod in ('1v1','2v2')),
  tur text not null check (tur in ('ranked','hizli')),
  puan int not null default 1000,               -- eşleşme anındaki ELO (yakın rakip için)
  created_at timestamptz not null default now()
);
create index kafatopu_kuyruk_idx on public.kafatopu_kuyruk (mod, tur, created_at);

-- Maçlar.
create table public.kafatopu_maclar (
  id uuid primary key default gen_random_uuid(),
  mod text not null check (mod in ('1v1','2v2')),
  tur text not null check (tur in ('ranked','hizli')),
  durum text not null default 'aktif' check (durum in ('aktif','bitti','iptal')),
  skor1 int not null default 0,
  skor2 int not null default 0,
  kazanan_takim smallint,                       -- 1, 2 veya null (berabere/iptal)
  created_at timestamptz not null default now(),
  bitis timestamptz
);
create index kafatopu_maclar_durum_idx on public.kafatopu_maclar (durum, created_at desc);

-- Maçtaki oyuncular. slot 0..3; takım 1 = slot 0,2 (sol/kırmızı), takım 2 = slot 1,3 (sağ/mavi).
create table public.kafatopu_mac_oyunculari (
  id uuid primary key default gen_random_uuid(),
  mac_id uuid not null references public.kafatopu_maclar(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  takim smallint not null check (takim in (1,2)),
  slot smallint not null check (slot between 0 and 3),
  kafa text not null default 'volkan',
  yetenek text not null default 'ates_sutu',
  puan_once int not null default 1000,
  puan_degisim int not null default 0,
  unique (mac_id, user_id),
  unique (mac_id, slot)
);
create index kafatopu_mac_oyunculari_user_idx on public.kafatopu_mac_oyunculari (user_id);

-- ---------- RLS ----------

alter table public.kafatopu_profiller enable row level security;
alter table public.kafatopu_kuyruk enable row level security;
alter table public.kafatopu_maclar enable row level security;
alter table public.kafatopu_mac_oyunculari enable row level security;

-- Profiller: herkes okuyabilir (leaderboard), yazım RPC ile.
create policy "kafatopu_profiller_select" on public.kafatopu_profiller for select
  to authenticated using (true);

-- Kuyruk: sadece kendi kaydını görebilir (admin RPC ile tümünü görür).
create policy "kafatopu_kuyruk_select" on public.kafatopu_kuyruk for select
  to authenticated using (user_id = auth.uid());

-- Maçlar ve oyuncuları: giriş yapmış herkes okuyabilir.
create policy "kafatopu_maclar_select" on public.kafatopu_maclar for select
  to authenticated using (true);
create policy "kafatopu_mac_oyunculari_select" on public.kafatopu_mac_oyunculari for select
  to authenticated using (true);

-- Doğrudan yazım kapalı; tüm değişiklikler security-definer RPC'lerden geçer.
revoke insert, update, delete on public.kafatopu_profiller from authenticated, anon;
revoke insert, update, delete on public.kafatopu_kuyruk from authenticated, anon;
revoke insert, update, delete on public.kafatopu_maclar from authenticated, anon;
revoke insert, update, delete on public.kafatopu_mac_oyunculari from authenticated, anon;

-- ---------- Profil RPC'leri ----------

-- Profil yoksa oluşturup döndürür.
create or replace function public.kafatopu_profil_al()
returns public.kafatopu_profiller
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.kafatopu_profiller%rowtype;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;

  insert into public.kafatopu_profiller (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into p from public.kafatopu_profiller where user_id = auth.uid();
  return p;
end;
$$;

-- Kafa/yetenek seçimi kaydı.
create or replace function public.kafatopu_profil_kaydet(p_kafa text, p_yetenek text)
returns public.kafatopu_profiller
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.kafatopu_profiller%rowtype;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_yetenek is not null and p_yetenek not in
     ('ates_sutu','buz','isinlanma','kalkan','dev_kafa') then
    raise exception 'Geçersiz yetenek';
  end if;

  insert into public.kafatopu_profiller (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.kafatopu_profiller
     set kafa = coalesce(p_kafa, kafa),
         yetenek = coalesce(p_yetenek, yetenek),
         updated_at = now()
   where user_id = auth.uid()
   returning * into p;
  return p;
end;
$$;

-- ---------- Eşleştirme RPC'leri ----------

-- Kuyruğa girer ve eşleşme dener. Aktif maç varsa onu döndürür,
-- eşleşme olursa yeni maç id'sini, olmazsa null döndürür.
-- İstemci bu fonksiyonu birkaç saniyede bir çağırarak bekler (poll).
create or replace function public.kafatopu_mac_bul(p_mod text, p_tur text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  benim_puan int;
  benim_kafa text;
  benim_yetenek text;
  aktif_mac uuid;
  yeni_mac uuid;
  gereken int;
  adaylar uuid[];
  i int;
  u uuid;
begin
  if ben is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('1v1','2v2') then raise exception 'Geçersiz mod'; end if;
  if p_tur not in ('ranked','hizli') then raise exception 'Geçersiz tür'; end if;

  -- Zaten aktif bir maçta mıyım? (eşleşme başka istemcide kurulmuş olabilir)
  select m.id into aktif_mac
    from public.kafatopu_maclar m
    join public.kafatopu_mac_oyunculari o on o.mac_id = m.id
   where o.user_id = ben and m.durum = 'aktif'
   order by m.created_at desc
   limit 1;
  if aktif_mac is not null then
    -- Kuyrukta kayıt kaldıysa temizle.
    delete from public.kafatopu_kuyruk where user_id = ben;
    return aktif_mac;
  end if;

  -- Profil garanti + puanı al.
  insert into public.kafatopu_profiller (user_id)
  values (ben) on conflict (user_id) do nothing;
  select puan, kafa, yetenek into benim_puan, benim_kafa, benim_yetenek
    from public.kafatopu_profiller where user_id = ben;

  -- Eşleştirme kritik bölge: tek kilitle serileştir (yarış durumu olmasın).
  perform pg_advisory_xact_lock(hashtext('kafatopu_kuyruk'));

  -- Kuyruğa gir/güncelle (mod değiştirmiş olabilir).
  insert into public.kafatopu_kuyruk (user_id, mod, tur, puan)
  values (ben, p_mod, p_tur, benim_puan)
  on conflict (user_id) do update
    set mod = excluded.mod, tur = excluded.tur, puan = excluded.puan;

  gereken := case when p_mod = '1v1' then 2 else 4 end;

  -- Adaylar: ben + aynı kuyruktaki diğerleri.
  -- Ranked'ta puanı en yakın olanlar, hızlıda en uzun bekleyenler öncelikli.
  select array_agg(user_id) into adaylar from (
    select user_id
      from public.kafatopu_kuyruk
     where mod = p_mod and tur = p_tur and user_id <> ben
     order by case when p_tur = 'ranked' then abs(puan - benim_puan) else 0 end,
              created_at
     limit gereken - 1
  ) s;

  if adaylar is null or array_length(adaylar, 1) < gereken - 1 then
    return null; -- yeterli oyuncu yok, beklemeye devam
  end if;

  -- Maçı kur: ben slot 0 (host), adaylar 1..3.
  insert into public.kafatopu_maclar (mod, tur)
  values (p_mod, p_tur)
  returning id into yeni_mac;

  insert into public.kafatopu_mac_oyunculari
    (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
  values (yeni_mac, ben, 1, 0, benim_kafa, benim_yetenek, benim_puan);

  i := 1;
  foreach u in array adaylar loop
    insert into public.kafatopu_mac_oyunculari
      (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
    select yeni_mac, u,
           case when i in (1,3) then 2 else 1 end,  -- slot 1,3 → takım 2; slot 2 → takım 1
           i, p.kafa, p.yetenek, p.puan
      from public.kafatopu_profiller p where p.user_id = u;
    i := i + 1;
  end loop;

  -- Eşleşenleri kuyruktan çıkar.
  delete from public.kafatopu_kuyruk
   where user_id = ben or user_id = any(adaylar);

  return yeni_mac;
end;
$$;

-- Kuyruktan ayrıl.
create or replace function public.kafatopu_kuyruktan_cik()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  delete from public.kafatopu_kuyruk where user_id = auth.uid();
end;
$$;

-- ---------- Sonuç + ELO ----------

-- Maç sonucunu kaydeder; ranked ise ELO günceller.
-- İlk raporlayan kazanır (FOR UPDATE kilidi + durum kontrolü ile çift kayıt engellenir).
create or replace function public.kafatopu_sonuc_kaydet(
  p_mac_id uuid, p_skor1 int, p_skor2 int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.kafatopu_maclar%rowtype;
  r1 numeric; r2 numeric;   -- takım ortalama puanları
  e1 numeric;               -- takım 1 beklenen skor
  s1 numeric;               -- takım 1 gerçek skor (1 / 0.5 / 0)
  kazanan smallint;
  o record;
  delta int;
  k constant numeric := 32;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  if p_skor1 < 0 or p_skor2 < 0 or p_skor1 > 50 or p_skor2 > 50 then
    raise exception 'Geçersiz skor';
  end if;

  select * into m from public.kafatopu_maclar where id = p_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.kafatopu_mac_oyunculari
     where mac_id = p_mac_id and user_id = auth.uid()
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if m.durum <> 'aktif' then return; end if; -- zaten kapatılmış, sessizce çık

  kazanan := case when p_skor1 > p_skor2 then 1
                  when p_skor2 > p_skor1 then 2
                  else null end;
  s1 := case when kazanan = 1 then 1 when kazanan = 2 then 0 else 0.5 end;

  update public.kafatopu_maclar
     set durum = 'bitti', skor1 = p_skor1, skor2 = p_skor2,
         kazanan_takim = kazanan, bitis = now()
   where id = p_mac_id;

  -- Takım ortalama ELO'ları.
  select avg(puan_once) filter (where takim = 1),
         avg(puan_once) filter (where takim = 2)
    into r1, r2
    from public.kafatopu_mac_oyunculari where mac_id = p_mac_id;
  e1 := 1 / (1 + power(10, (r2 - r1) / 400.0));

  for o in
    select * from public.kafatopu_mac_oyunculari where mac_id = p_mac_id
  loop
    if m.tur = 'ranked' then
      delta := round(k * ((case when o.takim = 1 then s1 else 1 - s1 end)
                        - (case when o.takim = 1 then e1 else 1 - e1 end)));
    else
      delta := 0; -- hızlı maç puanı etkilemez
    end if;

    update public.kafatopu_mac_oyunculari
       set puan_degisim = delta where id = o.id;

    update public.kafatopu_profiller
       set puan = greatest(100, puan + delta),
           mac_sayisi = mac_sayisi + 1,
           galibiyet = galibiyet + case when kazanan = o.takim then 1 else 0 end,
           beraberlik = beraberlik + case when kazanan is null then 1 else 0 end,
           maglubiyet = maglubiyet + case when kazanan is not null and kazanan <> o.takim then 1 else 0 end,
           atilan_gol = atilan_gol + case when o.takim = 1 then p_skor1 else p_skor2 end,
           yenen_gol = yenen_gol + case when o.takim = 1 then p_skor2 else p_skor1 end,
           updated_at = now()
     where user_id = o.user_id;
  end loop;
end;
$$;

-- Maç iptali (rakip hiç bağlanmadı / erken kopma). Puan işlenmez.
create or replace function public.kafatopu_mac_iptal(p_mac_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.kafatopu_maclar%rowtype;
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  select * into m from public.kafatopu_maclar where id = p_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.kafatopu_mac_oyunculari
     where mac_id = p_mac_id and user_id = auth.uid()
  ) and not public.kafatopu_admin_mi() then
    raise exception 'Bu maçta değilsin';
  end if;
  if m.durum = 'aktif' then
    update public.kafatopu_maclar
       set durum = 'iptal', bitis = now() where id = p_mac_id;
  end if;
end;
$$;

-- ---------- Admin RPC'leri ----------

-- Kuyruğun tamamını görüntüle (panel).
create or replace function public.kafatopu_admin_kuyruk()
returns setof public.kafatopu_kuyruk
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.kafatopu_admin_mi() then raise exception 'Yetki yok'; end if;
  return query select * from public.kafatopu_kuyruk order by created_at;
end;
$$;

-- Bir oyuncunun puanını elle ayarla (panel).
create or replace function public.kafatopu_admin_puan_ayarla(p_user uuid, p_puan int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.kafatopu_admin_mi() then raise exception 'Yetki yok'; end if;
  if p_puan < 0 or p_puan > 5000 then raise exception 'Geçersiz puan'; end if;
  update public.kafatopu_profiller
     set puan = p_puan, updated_at = now() where user_id = p_user;
end;
$$;

-- Takılı kalmış aktif maçları toplu iptal et (panel).
create or replace function public.kafatopu_admin_maclari_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sayi int;
begin
  if not public.kafatopu_admin_mi() then raise exception 'Yetki yok'; end if;
  update public.kafatopu_maclar
     set durum = 'iptal', bitis = now()
   where durum = 'aktif' and created_at < now() - interval '10 minutes';
  get diagnostics sayi = row_count;
  delete from public.kafatopu_kuyruk where created_at < now() - interval '10 minutes';
  return sayi;
end;
$$;

-- ---------- RPC yetkileri ----------
revoke execute on function public.kafatopu_profil_al() from public, anon;
grant execute on function public.kafatopu_profil_al() to authenticated;
revoke execute on function public.kafatopu_profil_kaydet(text, text) from public, anon;
grant execute on function public.kafatopu_profil_kaydet(text, text) to authenticated;
revoke execute on function public.kafatopu_mac_bul(text, text) from public, anon;
grant execute on function public.kafatopu_mac_bul(text, text) to authenticated;
revoke execute on function public.kafatopu_kuyruktan_cik() from public, anon;
grant execute on function public.kafatopu_kuyruktan_cik() to authenticated;
revoke execute on function public.kafatopu_sonuc_kaydet(uuid, int, int) from public, anon;
grant execute on function public.kafatopu_sonuc_kaydet(uuid, int, int) to authenticated;
revoke execute on function public.kafatopu_mac_iptal(uuid) from public, anon;
grant execute on function public.kafatopu_mac_iptal(uuid) to authenticated;
revoke execute on function public.kafatopu_admin_kuyruk() from public, anon;
grant execute on function public.kafatopu_admin_kuyruk() to authenticated;
revoke execute on function public.kafatopu_admin_puan_ayarla(uuid, int) from public, anon;
grant execute on function public.kafatopu_admin_puan_ayarla(uuid, int) to authenticated;
revoke execute on function public.kafatopu_admin_maclari_temizle() from public, anon;
grant execute on function public.kafatopu_admin_maclari_temizle() to authenticated;
