-- ============================================================
-- BOT PORTRELERİ — listelerin WebGL açmaması için
--
-- Gerçek oyuncunun portresi gardıropta kaydederken üretilip kendi
-- klasörüne yükleniyor (`avatarlar/<uid>/portre3b.png`). Botun gardırobu
-- yok: portresi olmayınca lig tablosundaki 25 satırın çoğu istemcide
-- WebGL ile çiziliyordu (portre başına ~55 ms — ölçüldü).
--
-- Bot portreleri `avatarlar/botlar/<bot_id>.png` altında durur ve BİR KEZ
-- üretilir. Yazma izni DAR: yalnız gerçekten bot olan bir profilin id'si
-- dosya adı olabilir. Gerçek oyuncu klasörlerine dokunulamaz, bot
-- portresinin üzerine yazmanın etkisi yalnız görseldir.
--
-- `gorunum.portre_url` alanı botlara buradan yazılır; Avatar.jsx zaten
-- önce o alana bakıyor.
-- ============================================================

-- ------------------------------------------------------------
-- Bot portresi yazma izni
-- ------------------------------------------------------------
drop policy if exists avatarlar_bot_portre_yaz on storage.objects;
create policy avatarlar_bot_portre_yaz on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatarlar'
    and (storage.foldername(name))[1] = 'botlar'
    and exists (
      select 1 from public.profiles p
       where coalesce(p.is_bot, false)
         and name = 'botlar/' || p.id::text || '.png'
    )
  );

drop policy if exists avatarlar_bot_portre_guncelle on storage.objects;
create policy avatarlar_bot_portre_guncelle on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatarlar'
    and (storage.foldername(name))[1] = 'botlar'
    and exists (
      select 1 from public.profiles p
       where coalesce(p.is_bot, false)
         and name = 'botlar/' || p.id::text || '.png'
    )
  );

-- ------------------------------------------------------------
-- Bot portre adresini profile yazar
-- Yalnız BOT profiline, yalnız kendi bucket'ımızdaki adres.
-- ------------------------------------------------------------
create or replace function public.avatar3d_bot_portre_kaydet(p_bot uuid, p_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_bot is null or p_url is null then return false; end if;
  if p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatarlar/botlar/' then
    raise exception 'Geçersiz portre adresi';
  end if;
  if not exists (select 1 from public.profiles where id = p_bot and coalesce(is_bot, false)) then
    raise exception 'Bot bulunamadı';
  end if;

  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('portre_url', p_url)
   where id = p_bot;
  return true;
end;
$fn$;

grant execute on function public.avatar3d_bot_portre_kaydet(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Portresi olmayan botları listeler (üretim işi bunu okur)
-- ------------------------------------------------------------
create or replace function public.avatar3d_portresiz_botlar()
returns table(id uuid, gorunum jsonb)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id, p.gorunum -> 'avatar3d'
    from public.profiles p
   where coalesce(p.is_bot, false)
     and p.gorunum -> 'avatar3d' is not null
     and coalesce(p.gorunum ->> 'portre_url', '') = ''
   order by p.id;
$fn$;

grant execute on function public.avatar3d_portresiz_botlar() to authenticated;
