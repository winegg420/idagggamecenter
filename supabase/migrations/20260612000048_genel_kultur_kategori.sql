-- ============================================================
-- 48 — GENEL KÜLTÜR kategorisi + kategoriye göre eşleştirme
--
-- 'genel' kategorisine DOKUNULMADI (mevcut anlamı ne olursa olsun korunuyor).
-- Yeni anahtar: 'genel_kultur' — arayüz etiketi "Genel Kültür", ikon 🧠,
-- listede her zaman en üstte.
--
-- "Hemen Oyna": oyuncunun `tercih_kategori`siyle eşleşme aranır; 20 saniye
-- içinde aynı kategoride insan rakip bulunamazsa karışığa/bota düşer.
-- Bunun için `matchmaking_queue` ilk kez GERÇEKTEN kullanılıyor: bugüne kadar
-- hiçbir yer kuyruğa satır EKLEMİYORDU, dolayısıyla quick_match her seferinde
-- doğrudan bota düşüyordu. `kuyruga_gir` / `kuyruktan_cik` bunu düzeltir.
-- ============================================================

-- ============================================================
-- 1) get_categories: genel_kultur en üstte
-- ============================================================

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
  -- Genel Kültür her zaman ilk sırada
  order by (q.kategori = 'genel_kultur') desc, count(*) desc;
$$;

revoke execute on function public.get_categories() from public, anon;
grant execute on function public.get_categories() to authenticated;

-- ============================================================
-- 2) Eşleştirme kuyruğu: kategori kolonu
-- ============================================================

alter table public.matchmaking_queue
  add column if not exists kategori text;

create index if not exists idx_kuyruk_kategori
  on public.matchmaking_queue (kategori, created_at);

-- Kuyruğa gir ve hemen eşleşme dene.
-- Dönüş: eşleşme olduysa maç id'si, olmadıysa null (istemci beklemeye geçer).
create or replace function public.kuyruga_gir(p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kat text;
  v_id uuid;
  v_rakip uuid;
  v_rakip_kat text;
  v_secilen_kat text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  -- Kategori: açıkça verilmezse oyuncunun varsayılan tercihi
  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  -- Bayat kayıtları temizle
  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- 1) Aynı kategoride bekleyen rakip
  select q.user_id, q.kategori into v_rakip, v_rakip_kat
  from public.matchmaking_queue q
  where q.user_id <> auth.uid()
    and q.kategori is not distinct from v_kat
  order by q.created_at
  limit 1
  for update skip locked;

  -- 2) Yoksa: 20 saniyedir bekleyen herhangi bir rakip (karışığa düşer)
  if not found then
    select q.user_id, null::text into v_rakip, v_rakip_kat
    from public.matchmaking_queue q
    where q.user_id <> auth.uid()
      and q.created_at < now() - interval '20 seconds'
    order by q.created_at
    limit 1
    for update skip locked;
  end if;

  if found and v_rakip is not null then
    v_secilen_kat := v_rakip_kat;
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());

    if not public.hileli_mi() then
      perform public.mac_kotasi_kontrol();
    end if;

    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif', v_secilen_kat,
      public.soru_sec(v_secilen_kat, 20, array[auth.uid(), v_rakip]),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Eşleşme yok: kuyruğa gir (varsa süreyi koru — 20 sn sayacı sıfırlanmasın)
  insert into public.matchmaking_queue (user_id, kategori)
  values (auth.uid(), v_kat)
  on conflict (user_id) do update set kategori = excluded.kategori;

  return null;
end;
$$;

revoke execute on function public.kuyruga_gir(text) from public, anon;
grant execute on function public.kuyruga_gir(text) to authenticated;

create or replace function public.kuyruktan_cik()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

revoke execute on function public.kuyruktan_cik() from public, anon;
grant execute on function public.kuyruktan_cik() to authenticated;

-- Kuyrukta ne kadar bekledim? (istemci 20 sn'yi buradan görür)
create or replace function public.kuyruk_durumum()
returns table (bekliyor boolean, saniye int, kategori text)
language sql
stable
security definer
set search_path = public
as $$
  select true,
         greatest(0, extract(epoch from (now() - q.created_at))::int),
         q.kategori
  from public.matchmaking_queue q
  where q.user_id = auth.uid()
  union all
  select false, 0, null::text
  where not exists (select 1 from public.matchmaking_queue where user_id = auth.uid())
  limit 1;
$$;

revoke execute on function public.kuyruk_durumum() from public, anon;
grant execute on function public.kuyruk_durumum() to authenticated;

-- ============================================================
-- 3) quick_match: kategori bilinçli son çare (bot maçı)
--    İmza korundu; p_kategori verilmezse tercih_kategori kullanılır.
-- ============================================================

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
  v_kat text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Bekleyen herhangi bir gerçek oyuncu varsa onunla eşleş (karışık)
  select q.user_id into v_rakip from public.matchmaking_queue q
  where q.user_id <> auth.uid()
  order by q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Kimse yoksa rastgele botla başla (oyuncunun tercih ettiği kategoride)
  delete from public.matchmaking_queue where user_id = auth.uid();

  select id into v_bot from public.profiles where is_bot order by random() limit 1;

  insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.quick_match(text) from public, anon;
grant execute on function public.quick_match(text) to authenticated;
