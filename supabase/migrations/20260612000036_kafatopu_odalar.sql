-- ============================================================
-- KAFA TOPU — özel odalar + arkadaş davetleri
-- Oda: kodla kurulur/katılınır, kurucu başlatınca hızlı (puansız) maç açılır.
-- Davet: oyun içi banner ile alıcıya düşer; kabul = odaya katılım.
-- ============================================================

-- ---------- Tablolar ----------

create table public.kafatopu_odalar (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  kurucu uuid not null references auth.users(id) on delete cascade,
  mod text not null check (mod in ('1v1','2v2')),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','basladi','iptal')),
  mac_id uuid references public.kafatopu_maclar(id) on delete set null,
  created_at timestamptz not null default now()
);
create index kafatopu_odalar_durum_idx on public.kafatopu_odalar (durum, created_at desc);

create table public.kafatopu_oda_oyunculari (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.kafatopu_odalar(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 0 and 3),
  takim smallint not null check (takim in (1,2)),
  katilma timestamptz not null default now(),
  unique (oda_id, user_id),
  unique (oda_id, slot)
);
create index kafatopu_oda_oyunculari_user_idx on public.kafatopu_oda_oyunculari (user_id);

create table public.kafatopu_davetler (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.kafatopu_odalar(id) on delete cascade,
  gonderen uuid not null references auth.users(id) on delete cascade,
  alici uuid not null references auth.users(id) on delete cascade,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','kabul','red')),
  created_at timestamptz not null default now(),
  unique (oda_id, alici)
);
create index kafatopu_davetler_alici_idx on public.kafatopu_davetler (alici, durum);

-- ---------- RLS ----------
alter table public.kafatopu_odalar enable row level security;
alter table public.kafatopu_oda_oyunculari enable row level security;
alter table public.kafatopu_davetler enable row level security;

create policy "kafatopu_odalar_select" on public.kafatopu_odalar for select
  to authenticated using (true);
create policy "kafatopu_oda_oyunculari_select" on public.kafatopu_oda_oyunculari for select
  to authenticated using (true);
create policy "kafatopu_davetler_select" on public.kafatopu_davetler for select
  to authenticated using (alici = auth.uid() or gonderen = auth.uid());

revoke insert, update, delete on public.kafatopu_odalar from authenticated, anon;
revoke insert, update, delete on public.kafatopu_oda_oyunculari from authenticated, anon;
revoke insert, update, delete on public.kafatopu_davetler from authenticated, anon;

-- ---------- İç yardımcı: odaya oyuncu ekle (kilit altında çağrılır) ----------
create or replace function public.kafatopu_oda_katil_ic(p_oda uuid, p_kisi uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.kafatopu_odalar%rowtype;
  dolu int;
  kapasite int;
  yeni_slot int;
begin
  select * into o from public.kafatopu_odalar where id = p_oda for update;
  if not found or o.durum <> 'bekliyor' then raise exception 'Oda aktif değil'; end if;

  if exists (select 1 from public.kafatopu_oda_oyunculari where oda_id = p_oda and user_id = p_kisi) then
    return; -- zaten içeride
  end if;

  kapasite := case when o.mod = '1v1' then 2 else 4 end;
  select count(*) into dolu from public.kafatopu_oda_oyunculari where oda_id = p_oda;
  if dolu >= kapasite then raise exception 'Oda dolu'; end if;

  -- İlk boş slot: 0..3 (takım: slot 0,2 → 1; slot 1,3 → 2)
  select s into yeni_slot from generate_series(0, kapasite - 1) s
   where not exists (select 1 from public.kafatopu_oda_oyunculari where oda_id = p_oda and slot = s)
   order by s limit 1;

  insert into public.kafatopu_oda_oyunculari (oda_id, user_id, slot, takim)
  values (p_oda, p_kisi, yeni_slot, case when yeni_slot in (0,2) then 1 else 2 end);
end;
$$;
revoke execute on function public.kafatopu_oda_katil_ic(uuid, uuid) from public, anon, authenticated;

-- ---------- Oda kur ----------
create or replace function public.kafatopu_oda_kur(p_mod text)
returns table (oda_id uuid, kod text)
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  yeni_kod text;
  yeni_oda uuid;
  harfler constant text := 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  i int;
begin
  if ben is null then raise exception 'Oturum yok'; end if;
  if p_mod not in ('1v1','2v2') then raise exception 'Geçersiz mod'; end if;

  -- Önce eski bekleyen odalarımdan çık (kurucusuysam iptal olur).
  perform public.kafatopu_odadan_ayril_ic(ben);
  delete from public.kafatopu_kuyruk where user_id = ben;

  -- Benzersiz 6 haneli kod üret.
  loop
    yeni_kod := '';
    for i in 1..6 loop
      yeni_kod := yeni_kod || substr(harfler, 1 + floor(random() * length(harfler))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.kafatopu_odalar o where o.kod = yeni_kod and o.durum = 'bekliyor'
    );
  end loop;

  insert into public.kafatopu_odalar (kod, kurucu, mod)
  values (yeni_kod, ben, p_mod)
  returning id into yeni_oda;

  perform public.kafatopu_oda_katil_ic(yeni_oda, ben);
  return query select yeni_oda, yeni_kod;
end;
$$;

-- ---------- İç yardımcı: bekleyen odalardan ayrıl ----------
create or replace function public.kafatopu_odadan_ayril_ic(p_kisi uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select o.id, o.kurucu from public.kafatopu_odalar o
    join public.kafatopu_oda_oyunculari op on op.oda_id = o.id
   where op.user_id = p_kisi and o.durum = 'bekliyor'
  loop
    delete from public.kafatopu_oda_oyunculari where oda_id = r.id and user_id = p_kisi;
    -- Kurucu ayrılırsa ya da oda boşalırsa oda iptal olur.
    if r.kurucu = p_kisi or not exists (
      select 1 from public.kafatopu_oda_oyunculari where oda_id = r.id
    ) then
      update public.kafatopu_odalar set durum = 'iptal' where id = r.id;
    end if;
  end loop;
end;
$$;
revoke execute on function public.kafatopu_odadan_ayril_ic(uuid) from public, anon, authenticated;

-- ---------- Odaya katıl (kodla) ----------
create or replace function public.kafatopu_odaya_katil(p_kod text)
returns table (oda_id uuid, kod text)
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  o public.kafatopu_odalar%rowtype;
begin
  if ben is null then raise exception 'Oturum yok'; end if;

  select * into o from public.kafatopu_odalar
   where upper(kafatopu_odalar.kod) = upper(trim(p_kod)) and durum = 'bekliyor'
   order by created_at desc limit 1;
  if not found then raise exception 'Oda bulunamadı ya da kapanmış'; end if;

  -- Başka bekleyen odadaysam önce çık (aynı odadaysam katil_ic zaten no-op).
  if not exists (
    select 1 from public.kafatopu_oda_oyunculari where kafatopu_oda_oyunculari.oda_id = o.id and user_id = ben
  ) then
    perform public.kafatopu_odadan_ayril_ic(ben);
  end if;
  delete from public.kafatopu_kuyruk where user_id = ben;

  perform public.kafatopu_oda_katil_ic(o.id, ben);
  return query select o.id, o.kod;
end;
$$;

-- ---------- Odadan ayrıl ----------
create or replace function public.kafatopu_odadan_ayril()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  perform public.kafatopu_odadan_ayril_ic(auth.uid());
end;
$$;

-- ---------- Odayı başlat (sadece kurucu, oda doluyken) ----------
create or replace function public.kafatopu_oda_baslat(p_oda uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  o public.kafatopu_odalar%rowtype;
  kapasite int;
  dolu int;
  yeni_mac uuid;
begin
  if ben is null then raise exception 'Oturum yok'; end if;

  select * into o from public.kafatopu_odalar where id = p_oda for update;
  if not found then raise exception 'Oda bulunamadı'; end if;
  if o.kurucu <> ben then raise exception 'Sadece oda kurucusu başlatabilir'; end if;
  if o.durum = 'basladi' and o.mac_id is not null then return o.mac_id; end if;
  if o.durum <> 'bekliyor' then raise exception 'Oda aktif değil'; end if;

  kapasite := case when o.mod = '1v1' then 2 else 4 end;
  select count(*) into dolu from public.kafatopu_oda_oyunculari where oda_id = p_oda;
  if dolu < kapasite then raise exception 'Oda henüz dolu değil (%/%)', dolu, kapasite; end if;

  -- Özel oda maçları puansızdır (hizli).
  insert into public.kafatopu_maclar (mod, tur) values (o.mod, 'hizli')
  returning id into yeni_mac;

  insert into public.kafatopu_mac_oyunculari
    (mac_id, user_id, takim, slot, kafa, yetenek, puan_once)
  select yeni_mac, op.user_id, op.takim, op.slot,
         coalesce(p.kafa, 'volkan'), coalesce(p.yetenek, 'ates_sutu'), coalesce(p.puan, 1000)
    from public.kafatopu_oda_oyunculari op
    left join public.kafatopu_profiller p on p.user_id = op.user_id
   where op.oda_id = p_oda;

  update public.kafatopu_odalar
     set durum = 'basladi', mac_id = yeni_mac where id = p_oda;

  return yeni_mac;
end;
$$;

-- ---------- Davet gönder ----------
create or replace function public.kafatopu_davet_gonder(p_oda uuid, p_alici uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
begin
  if ben is null then raise exception 'Oturum yok'; end if;
  if p_alici = ben then raise exception 'Kendini davet edemezsin'; end if;
  if not exists (
    select 1 from public.kafatopu_oda_oyunculari where oda_id = p_oda and user_id = ben
  ) then
    raise exception 'Bu odada değilsin';
  end if;
  if not exists (
    select 1 from public.kafatopu_odalar where id = p_oda and durum = 'bekliyor'
  ) then
    raise exception 'Oda aktif değil';
  end if;

  insert into public.kafatopu_davetler (oda_id, gonderen, alici)
  values (p_oda, ben, p_alici)
  on conflict (oda_id, alici) do update set durum = 'bekliyor', created_at = now();
end;
$$;

-- ---------- Bekleyen davetlerim (banner için) ----------
create or replace function public.kafatopu_davetlerim()
returns table (davet_id uuid, oda_id uuid, kod text, mod text, gonderen_ad text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok'; end if;
  return query
    select d.id, o.id, o.kod, o.mod, coalesce(pr.username, 'Oyuncu')
      from public.kafatopu_davetler d
      join public.kafatopu_odalar o on o.id = d.oda_id and o.durum = 'bekliyor'
      left join public.profiles pr on pr.id = d.gonderen
     where d.alici = auth.uid() and d.durum = 'bekliyor'
     order by d.created_at desc
     limit 5;
end;
$$;

-- ---------- Daveti yanıtla (kabul = odaya katıl) ----------
create or replace function public.kafatopu_davet_yanitla(p_davet uuid, p_kabul boolean)
returns table (oda_id uuid, kod text)
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
  d public.kafatopu_davetler%rowtype;
  o public.kafatopu_odalar%rowtype;
begin
  if ben is null then raise exception 'Oturum yok'; end if;

  select * into d from public.kafatopu_davetler where id = p_davet and alici = ben for update;
  if not found then raise exception 'Davet bulunamadı'; end if;

  update public.kafatopu_davetler
     set durum = case when p_kabul then 'kabul' else 'red' end
   where id = p_davet;

  if not p_kabul then return; end if;

  select * into o from public.kafatopu_odalar where id = d.oda_id;
  if not found or o.durum <> 'bekliyor' then raise exception 'Oda kapanmış'; end if;

  if not exists (
    select 1 from public.kafatopu_oda_oyunculari where kafatopu_oda_oyunculari.oda_id = o.id and user_id = ben
  ) then
    perform public.kafatopu_odadan_ayril_ic(ben);
  end if;
  perform public.kafatopu_oda_katil_ic(o.id, ben);
  return query select o.id, o.kod;
end;
$$;

-- ---------- RPC yetkileri ----------
revoke execute on function public.kafatopu_oda_kur(text) from public, anon;
grant execute on function public.kafatopu_oda_kur(text) to authenticated;
revoke execute on function public.kafatopu_odaya_katil(text) from public, anon;
grant execute on function public.kafatopu_odaya_katil(text) to authenticated;
revoke execute on function public.kafatopu_odadan_ayril() from public, anon;
grant execute on function public.kafatopu_odadan_ayril() to authenticated;
revoke execute on function public.kafatopu_oda_baslat(uuid) from public, anon;
grant execute on function public.kafatopu_oda_baslat(uuid) to authenticated;
revoke execute on function public.kafatopu_davet_gonder(uuid, uuid) from public, anon;
grant execute on function public.kafatopu_davet_gonder(uuid, uuid) to authenticated;
revoke execute on function public.kafatopu_davetlerim() from public, anon;
grant execute on function public.kafatopu_davetlerim() to authenticated;
revoke execute on function public.kafatopu_davet_yanitla(uuid, boolean) from public, anon;
grant execute on function public.kafatopu_davet_yanitla(uuid, boolean) to authenticated;
