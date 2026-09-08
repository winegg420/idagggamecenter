-- ============================================================
-- 53 — SERİ + RÖVANŞ/EZELİ RAKİP + KATEGORİ USTALIĞI (Bildim!)
--
-- Seri: Europe/Istanbul gününe göre; günde en az 1 BİTMİŞ maç = gün sayılır.
-- Kaçırılan gün varsa `seri_koruma` jokeri otomatik harcanır — ama yalnızca
-- BİR günü kapatır; iki ve daha fazla gün kaçırılmışsa seri sıfırlanır.
--
-- Mevcut `profiles.seri` / `son_seri_tarihi` kolonları BOZULMADI; eski arayüz
-- çalışmaya devam etsin diye yeni alanlarla senkron tutuluyor.
-- ============================================================

-- ============================================================
-- 1) SERİ
-- ============================================================

alter table public.profiles
  add column if not exists seri_gun int not null default 0,
  add column if not exists seri_son_gun date,
  add column if not exists seri_en_uzun int not null default 0;

-- Mevcut seri verisini yeni alanlara taşı (bir kez)
update public.profiles
   set seri_gun = greatest(coalesce(seri_gun, 0), coalesce(seri, 0)),
       seri_son_gun = coalesce(seri_son_gun, son_seri_tarihi),
       seri_en_uzun = greatest(coalesce(seri_en_uzun, 0), coalesce(seri, 0))
 where coalesce(seri, 0) > 0;

create index if not exists idx_profiles_seri_son_gun
  on public.profiles (seri_son_gun) where coalesce(is_bot, false) = false;

-- Maç bitince çağrılır (mac_sayaci_arttir içinden).
create or replace function public.seri_guncelle(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  p public.profiles%rowtype;
  v_yeni int;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found or coalesce(p.is_bot, false) then return; end if;
  if p.seri_son_gun = v_bugun then return; end if;   -- bugün zaten sayıldı

  if p.seri_son_gun = v_bugun - 1 then
    v_yeni := coalesce(p.seri_gun, 0) + 1;
  else
    v_yeni := 1;
  end if;

  update public.profiles
     set seri_gun = v_yeni,
         seri_son_gun = v_bugun,
         seri_en_uzun = greatest(coalesce(seri_en_uzun, 0), v_yeni),
         -- eski alanlar geriye uyumluluk için senkron
         seri = v_yeni,
         son_seri_tarihi = v_bugun
   where id = p_user;

  if v_yeni in (3, 7, 14, 30, 60, 100) then
    perform public.bildirim_yaz(
      p_user, 'seri',
      '🔥 Serin ' || v_yeni || ' gün oldu! Yarın da gel, bozma.',
      '/bildim'
    );
  end if;
  if v_yeni >= 3 then perform public.award_badge(p_user, 'seri_3'); end if;
  if v_yeni >= 7 then perform public.award_badge(p_user, 'seri_7'); end if;
end;
$$;

revoke execute on function public.seri_guncelle(uuid) from public, anon, authenticated;

-- Maç sayacı artışına seri güncellemesini de bağla (047'deki fonksiyon genişletildi).
create or replace function public.mac_sayaci_arttir(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  update public.profiles
     set toplam_mac = toplam_mac + 1
   where id = p_user
  returning toplam_mac into v_yeni;

  if v_yeni = 1 then
    perform public.bildirim_yaz(
      p_user, 'lige_girdin',
      'İlk maçını tamamladın — artık şehir, ülke ve dünya liglerindesin! 🏙️',
      '/bildim/siralama'
    );
  end if;

  -- Günlük seri (Europe/Istanbul)
  perform public.seri_guncelle(p_user);
end;
$$;

revoke execute on function public.mac_sayaci_arttir(uuid) from public, anon, authenticated;

-- Gece yarısı kontrolü: dün oynamayanların serisi.
-- Koruma YALNIZCA bir günü kapatır (tam olarak 1 gün kaçırılmışsa).
create or replace function public.seri_kontrol()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  r record;
  v_koruma int;
begin
  for r in
    select p.id, p.seri_gun, p.seri_son_gun
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.seri_gun, 0) > 0
      and p.seri_son_gun is not null
      and p.seri_son_gun < v_bugun - 1        -- dün oynamamış
  loop
    v_koruma := coalesce(
      (select adet from public.joker_envanter
        where user_id = r.id and tur = 'seri_koruma'), 0);

    if r.seri_son_gun = v_bugun - 2 and v_koruma > 0 then
      -- Tam olarak 1 gün kaçırılmış ve koruma var → o günü kapat
      perform public.joker_hareket(r.id, 'seri_koruma', -1, 'seri', 'seri_kontrol:' || v_bugun::text);
      update public.profiles
         set seri_son_gun = v_bugun - 1,
             son_seri_tarihi = v_bugun - 1
       where id = r.id;
      perform public.bildirim_yaz(
        r.id, 'seri',
        '🛡️ Seri korumanı kullandık — ' || r.seri_gun || ' günlük serin sürüyor. Bugün oynamayı unutma!',
        '/bildim'
      );
    else
      update public.profiles
         set seri_gun = 0, seri = 0
       where id = r.id;
      perform public.bildirim_yaz(
        r.id, 'seri',
        '💔 ' || r.seri_gun || ' günlük serin kırıldı. Bugün yeniden başla!',
        '/bildim'
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.seri_kontrol() from public, anon, authenticated;

do $$
begin
  begin perform cron.unschedule('bildim-seri-kontrol'); exception when others then null; end;
  -- 00:05 TSİ = 21:05 UTC (Türkiye yıl boyu UTC+3)
  perform cron.schedule('bildim-seri-kontrol', '5 21 * * *', 'select public.seri_kontrol()');
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;

create or replace function public.seri_durumum()
returns table (seri_gun int, seri_en_uzun int, bugun_oynadi boolean, koruma int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.seri_gun, 0),
    coalesce(p.seri_en_uzun, 0),
    p.seri_son_gun = (now() at time zone 'Europe/Istanbul')::date,
    coalesce((select adet from public.joker_envanter
              where user_id = p.id and tur = 'seri_koruma'), 0)
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.seri_durumum() from public, anon;
grant execute on function public.seri_durumum() to authenticated;

-- ============================================================
-- 2) RÖVANŞ + EZELİ RAKİP
-- ============================================================

-- Son 24 saatte kaybettiğin maç için rövanş daveti (aynı kategori).
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
    insert into public.matches (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic)
    values (
      v_me, v_rakip, 'aktif', m.kategori,
      public.soru_sec(m.kategori, 20, array[v_me]),
      0, now()
    )
    returning id into v_id;
  else
    insert into public.matches (oyuncu1, oyuncu2, kategori)
    values (v_me, v_rakip, m.kategori)
    returning id into v_id;

    perform public.bildirim_yaz(
      v_rakip, 'rovans',
      (select gorunen_ad from public.profiles where id = v_me) || ' rövanş istiyor! ⚔️',
      '/bildim/meydan'
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.rovans_iste(uuid) from public, anon;
grant execute on function public.rovans_iste(uuid) to authenticated;

-- Ezeli rakip: en çok karşılaştığın oyuncu (en az 3 maç)
create or replace function public.ezeli_rakip()
returns table (
  user_id uuid,
  gorunen_ad text,
  gorunen_avatar text,
  toplam int,
  galibiyet int,
  maglubiyet int,
  beraberlik int
)
language sql
stable
security definer
set search_path = public
as $$
  with maclar as (
    select
      case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end as rakip,
      m.kazanan
    from public.matches m
    where m.durum = 'bitti'
      and auth.uid() in (m.oyuncu1, m.oyuncu2)
  ), ozet as (
    select rakip,
           count(*)::int as toplam,
           count(*) filter (where kazanan = auth.uid())::int as galibiyet,
           count(*) filter (where kazanan is not null and kazanan <> auth.uid())::int as maglubiyet,
           count(*) filter (where kazanan is null)::int as beraberlik
    from maclar
    group by rakip
    having count(*) >= 3
  )
  select o.rakip, p.gorunen_ad, p.gorunen_avatar, o.toplam, o.galibiyet, o.maglubiyet, o.beraberlik
  from ozet o
  join public.profiles p on p.id = o.rakip
  order by o.toplam desc, o.maglubiyet desc
  limit 1;
$$;

revoke execute on function public.ezeli_rakip() from public, anon;
grant execute on function public.ezeli_rakip() to authenticated;

-- ============================================================
-- 3) KATEGORİ USTALIĞI
-- ============================================================

create table if not exists public.kategori_dogru (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kategori text not null,
  dogru_sayisi int not null default 0,
  primary key (user_id, kategori)
);

alter table public.kategori_dogru enable row level security;
drop policy if exists "kategori_dogru_own" on public.kategori_dogru;
create policy "kategori_dogru_own" on public.kategori_dogru for select using (auth.uid() = user_id);
revoke all on public.kategori_dogru from authenticated, anon;
grant select on public.kategori_dogru to authenticated;

insert into public.badges (id, ad, aciklama, ikon) values
  ('ustalik_cirak',  'Çırak',  'Bir kategoride 25 doğru',   '🔰'),
  ('ustalik_kalfa',  'Kalfa',  'Bir kategoride 100 doğru',  '🛠️'),
  ('ustalik_usta',   'Usta',   'Bir kategoride 300 doğru',  '🎓'),
  ('ustalik_ustat',  'Üstat',  'Bir kategoride 750 doğru',  '🏅'),
  ('ustalik_efsane', 'Efsane', 'Bir kategoride 2000 doğru', '👑')
on conflict (id) do nothing;

-- Seviye eşikleri: Çırak 25 → Kalfa 100 → Usta 300 → Üstat 750 → Efsane 2000
create or replace function public.ustalik_seviye(p_dogru int)
returns text
language sql
immutable
as $$
  select case
    when p_dogru >= 2000 then 'Efsane'
    when p_dogru >= 750  then 'Üstat'
    when p_dogru >= 300  then 'Usta'
    when p_dogru >= 100  then 'Kalfa'
    when p_dogru >= 25   then 'Çırak'
    else null
  end;
$$;

create or replace function public.kategori_dogru_arttir(p_user uuid, p_kategori text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
  v_onceki text;
  v_simdi text;
begin
  if p_user is null or p_kategori is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  insert into public.kategori_dogru (user_id, kategori, dogru_sayisi)
  values (p_user, p_kategori, 1)
  on conflict (user_id, kategori) do update
    set dogru_sayisi = public.kategori_dogru.dogru_sayisi + 1
  returning dogru_sayisi into v_yeni;

  v_onceki := public.ustalik_seviye(v_yeni - 1);
  v_simdi := public.ustalik_seviye(v_yeni);

  if v_simdi is not null and v_simdi is distinct from v_onceki then
    perform public.bildirim_yaz(
      p_user, 'ustalik',
      '🎖️ ' || p_kategori || ' kategorisinde ' || v_simdi || ' oldun!',
      '/bildim/profil'
    );
    perform public.award_badge(
      p_user,
      case v_simdi
        when 'Çırak' then 'ustalik_cirak'
        when 'Kalfa' then 'ustalik_kalfa'
        when 'Usta' then 'ustalik_usta'
        when 'Üstat' then 'ustalik_ustat'
        else 'ustalik_efsane'
      end
    );
  end if;
end;
$$;

revoke execute on function public.kategori_dogru_arttir(uuid, text)
  from public, anon, authenticated;

-- Doğru cevaplar TÜM modlarda trigger ile sayılır (cevap RPC'leri değiştirilmedi).
create or replace function public.trg_kategori_1v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  if not new.dogru then return new; end if;
  select q.kategori into v_kat
  from public.matches m
  join public.questions q on q.id = m.soru_ids[new.soru_index + 1]
  where m.id = new.match_id;
  perform public.kategori_dogru_arttir(new.user_id, v_kat);
  return new;
end $$;

drop trigger if exists trg_match_answers_kategori on public.match_answers;
create trigger trg_match_answers_kategori
  after insert on public.match_answers
  for each row execute function public.trg_kategori_1v1();

create or replace function public.trg_kategori_grup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  if not new.dogru then return new; end if;
  select q.kategori into v_kat
  from public.group_matches gm
  join public.questions q on q.id = gm.soru_ids[new.soru_index + 1]
  where gm.id = new.group_match_id;
  perform public.kategori_dogru_arttir(new.user_id, v_kat);
  return new;
end $$;

drop trigger if exists trg_group_answers_kategori on public.group_match_answers;
create trigger trg_group_answers_kategori
  after insert on public.group_match_answers
  for each row execute function public.trg_kategori_grup();

create or replace function public.trg_kategori_hizli()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  if not new.dogru then return new; end if;
  select q.kategori into v_kat
  from public.hizli_maclar hm
  join public.questions q on q.id = hm.soru_ids[new.soru_index + 1]
  where hm.id = new.hizli_mac_id;
  perform public.kategori_dogru_arttir(new.user_id, v_kat);
  return new;
end $$;

drop trigger if exists trg_hizli_cevaplar_kategori on public.hizli_cevaplar;
create trigger trg_hizli_cevaplar_kategori
  after insert on public.hizli_cevaplar
  for each row execute function public.trg_kategori_hizli();

create or replace function public.trg_kategori_turnuva()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  if not new.dogru then return new; end if;
  select q.kategori into v_kat
  from public.tournaments t
  join public.questions q on q.id = t.soru_ids[new.soru_index + 1]
  where t.id = new.tournament_id;
  perform public.kategori_dogru_arttir(new.user_id, v_kat);
  return new;
end $$;

drop trigger if exists trg_tournament_answers_kategori on public.tournament_answers;
create trigger trg_tournament_answers_kategori
  after insert on public.tournament_answers
  for each row execute function public.trg_kategori_turnuva();

create or replace function public.ustalik_seviyelerim()
returns table (
  kategori text,
  dogru_sayisi int,
  seviye text,
  sonraki_seviye text,
  sonraki_esik int,
  ilerleme int
)
language sql
stable
security definer
set search_path = public
as $$
  with esikler as (
    select * from (values
      ('Çırak', 25), ('Kalfa', 100), ('Usta', 300), ('Üstat', 750), ('Efsane', 2000)
    ) as e(ad, esik)
  ), sayim as (
    select k.kategori, coalesce(kd.dogru_sayisi, 0) as adet
    from (select distinct q.kategori from public.questions q where q.aktif) k
    left join public.kategori_dogru kd
      on kd.kategori = k.kategori and kd.user_id = auth.uid()
  )
  select
    s.kategori,
    s.adet,
    public.ustalik_seviye(s.adet),
    (select e.ad from esikler e where e.esik > s.adet order by e.esik limit 1),
    (select e.esik from esikler e where e.esik > s.adet order by e.esik limit 1),
    case
      when (select e.esik from esikler e where e.esik > s.adet order by e.esik limit 1) is null then 100
      else least(100, (s.adet * 100)
        / nullif((select e.esik from esikler e where e.esik > s.adet order by e.esik limit 1), 0))
    end
  from sayim s
  order by s.adet desc, s.kategori;
$$;

revoke execute on function public.ustalik_seviyelerim() from public, anon;
grant execute on function public.ustalik_seviyelerim() to authenticated;
