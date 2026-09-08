-- ============================================================
-- MEYDAN OKUMA BİLDİRİMLERİ
--
-- Sorun: birisi sana meydan okuduğunda hiçbir bildirim yazılmıyordu;
-- yalnızca alt menüdeki "Meydan Oku" sekmesinde küçük bir rozet çıkıyordu
-- ve bu gözden kaçıyordu.
--
-- Çözüm:
--   1) matches / group_match_players / hizli_oyuncular davet insert'lerinde
--      otomatik bildirim yazan tetikleyiciler
--   2) bekleyen_davetlerim() — üstteki davet bandının tek çağrıda beslenmesi
--   3) rovans kolonu: rövanş daveti ile normal meydan okumayı ayırmak için
--      (rovans_iste içindeki elle yazılan bildirim kaldırıldı; artık tek
--       kaynak tetikleyici — çift bildirim olmuyor)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Rövanş işareti
-- ------------------------------------------------------------
alter table public.matches
  add column if not exists rovans boolean not null default false;

-- ------------------------------------------------------------
-- 2) 1v1 meydan okuma / rövanş bildirimi
-- ------------------------------------------------------------
create or replace function public.trg_mac_daveti_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad text;
begin
  -- Yalnız davet aşamasındaki (henüz başlamamış) maçlar
  if new.durum is distinct from 'bekliyor' then return new; end if;
  if new.oyuncu2 is null or new.oyuncu2 = new.oyuncu1 then return new; end if;
  -- Bota bildirim gitmez
  if exists (select 1 from public.profiles where id = new.oyuncu2 and coalesce(is_bot, false)) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = new.oyuncu1;

  perform public.bildirim_yaz(
    new.oyuncu2,
    case when new.rovans then 'rovans' else 'mac_daveti' end,
    coalesce(v_ad, 'Bir oyuncu') ||
      case when new.rovans then ' rövanş istiyor! ⚔️' else ' sana meydan okudu! ⚔️' end,
    '/bildim/meydan'
  );
  return new;
end;
$$;

drop trigger if exists trg_matches_davet_bildir on public.matches;
create trigger trg_matches_davet_bildir
  after insert on public.matches
  for each row execute function public.trg_mac_daveti_bildir();

-- ------------------------------------------------------------
-- 3) Grup maçı daveti bildirimi
-- ------------------------------------------------------------
create or replace function public.trg_grup_daveti_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kurucu uuid;
  v_ad text;
  v_kisi int;
begin
  if new.davet_durumu is distinct from 'bekliyor' then return new; end if;

  select g.kurucu, g.oyuncu_sayisi into v_kurucu, v_kisi
  from public.group_matches g where g.id = new.group_match_id;

  if v_kurucu is null or v_kurucu = new.user_id then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and coalesce(is_bot, false)) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_kurucu;

  perform public.bildirim_yaz(
    new.user_id, 'grup_daveti',
    coalesce(v_ad, 'Bir oyuncu') || ' seni ' || coalesce(v_kisi, 3) ||
      ' kişilik grup maçına çağırdı! 👥',
    '/bildim/meydan'
  );
  return new;
end;
$$;

drop trigger if exists trg_grup_oyuncu_davet_bildir on public.group_match_players;
create trigger trg_grup_oyuncu_davet_bildir
  after insert on public.group_match_players
  for each row execute function public.trg_grup_daveti_bildir();

-- ------------------------------------------------------------
-- 4) Hızlı maç daveti bildirimi
-- ------------------------------------------------------------
create or replace function public.trg_hizli_daveti_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kurucu uuid;
  v_ad text;
begin
  if new.davet_durumu is distinct from 'bekliyor' then return new; end if;

  select h.kurucu into v_kurucu from public.hizli_maclar h where h.id = new.hizli_mac_id;
  if v_kurucu is null or v_kurucu = new.user_id then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and coalesce(is_bot, false)) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_kurucu;

  perform public.bildirim_yaz(
    new.user_id, 'hizli_daveti',
    coalesce(v_ad, 'Bir oyuncu') || ' seni hızlı maça çağırdı! ⚡',
    '/bildim/meydan'
  );
  return new;
end;
$$;

drop trigger if exists trg_hizli_oyuncu_davet_bildir on public.hizli_oyuncular;
create trigger trg_hizli_oyuncu_davet_bildir
  after insert on public.hizli_oyuncular
  for each row execute function public.trg_hizli_daveti_bildir();

-- ------------------------------------------------------------
-- 5) rovans_iste — rovans=true işaretler, bildirimi tetikleyiciye bırakır
--    (053'teki gövde birebir korundu; yalnız bu iki nokta değişti)
-- ------------------------------------------------------------
create or replace function public.rovans_iste(p_mac_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_rakip uuid;
  v_bot boolean;
  v_id uuid;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into m from public.matches where id = p_mac_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if v_me not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'bitti' then raise exception 'Maç henüz bitmedi'; end if;
  if m.kazanan is null or m.kazanan = v_me then
    raise exception 'Rövanş yalnızca kaybettiğin maç için istenebilir';
  end if;
  if m.bitis is null or m.bitis < now() - interval '24 hours' then
    raise exception 'Rövanş süresi doldu (24 saat)';
  end if;

  v_rakip := case when m.oyuncu1 = v_me then m.oyuncu2 else m.oyuncu1 end;
  select coalesce(is_bot, false) into v_bot from public.profiles where id = v_rakip;

  if exists (
    select 1 from public.matches x
    where x.durum in ('bekliyor','aktif')
      and ((x.oyuncu1 = v_me and x.oyuncu2 = v_rakip) or (x.oyuncu1 = v_rakip and x.oyuncu2 = v_me))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir maçın var';
  end if;

  perform public.mac_kotasi_kontrol();

  if v_bot then
    -- Bot: rövanş anında başlar
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, rovans)
    values (
      v_me, v_rakip, 'aktif', m.kategori,
      public.soru_sec(m.kategori, 20, array[v_me]),
      0, now(), true
    )
    returning id into v_id;
  else
    -- Bildirimi trg_matches_davet_bildir yazar (tek kaynak)
    insert into public.matches (oyuncu1, oyuncu2, kategori, rovans)
    values (v_me, v_rakip, m.kategori, true)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.rovans_iste(uuid) from public, anon;
grant execute on function public.rovans_iste(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6) bekleyen_davetlerim() — üstteki davet bandı için tek çağrı
--    1v1 + grup + hızlı davetleri, davet edenin adı/avatarıyla döndürür.
-- ------------------------------------------------------------
create or replace function public.bekleyen_davetlerim()
returns table (
  tur text,             -- 'mac' | 'rovans' | 'grup' | 'hizli'
  kayit_id uuid,        -- maç / grup maçı / hızlı maç id'si
  davet_eden uuid,
  gorunen_ad text,
  gorunen_avatar text,
  kategori text,
  kisi_sayisi int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- 1v1 meydan okuma / rövanş
  select
    case when m.rovans then 'rovans' else 'mac' end,
    m.id, m.oyuncu1, p.gorunen_ad, p.gorunen_avatar, m.kategori, 2, m.created_at
  from public.matches m
  join public.profiles p on p.id = m.oyuncu1
  where m.oyuncu2 = auth.uid()
    and m.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  union all

  -- Grup maçı daveti
  select
    'grup', g.id, g.kurucu, p.gorunen_ad, p.gorunen_avatar, g.kategori,
    g.oyuncu_sayisi, gp.joined_at
  from public.group_match_players gp
  join public.group_matches g on g.id = gp.group_match_id
  join public.profiles p on p.id = g.kurucu
  where gp.user_id = auth.uid()
    and gp.davet_durumu = 'bekliyor'
    and g.durum in ('lobi', 'bekliyor')

  union all

  -- Hızlı maç daveti
  select
    'hizli', h.id, h.kurucu, p.gorunen_ad, p.gorunen_avatar, h.kategori,
    h.oyuncu_sayisi, ho.joined_at
  from public.hizli_oyuncular ho
  join public.hizli_maclar h on h.id = ho.hizli_mac_id
  join public.profiles p on p.id = h.kurucu
  where ho.user_id = auth.uid()
    and ho.davet_durumu = 'bekliyor'
    and h.durum in ('lobi', 'bekliyor')

  order by 8 desc
  limit 20;
$$;

revoke execute on function public.bekleyen_davetlerim() from public, anon;
grant execute on function public.bekleyen_davetlerim() to authenticated;
