-- ============================================================
-- 195 — Lig: kurulumu bitmemiş hesaplar ve şüpheli test hesapları görünmez
-- (Revizyon Paketi 12, madde 3)
--
-- Şikâyet: lig tablosunda adı "Oyuncu", avatarı olmayan satırlar ve
-- "hhhjj", "TestOyuncu" gibi test adları görünüyordu.
--
-- Ölçüm (14 Eyl 2026): 55 gerçek hesabın 28'inde takma ad seçilmemiş,
-- 27'sinde avatar onaylanmamış; hepsi bu haftanın lig_uyelik'inde.
-- DİKKAT: 75 GİZLİ botun avatar_onayli'si false — kural botlara
-- uygulanırsa gizli botlar ligden düşerdi (gizli bot = gerçek oyuncu gibi).
-- Bu yüzden kural yalnız gerçek hesaplara bakar.
--
-- KALICI KURAL (acik_bot_mu deseni, 181):
--   lig_gorunur_mu = lig_gizli değil VE (bot VEYA takma ad + avatar tamam)
-- Açık botlar ayrıca acik_bot_mu ile zaten dışarıda.
-- Oyuncu kurulumu bitirince kendiliğinden görünür; üyeliği silinmez.
-- `lig_gizli`: silinmeyen ama şüpheli hesaplar için elle konan bayrak.
-- Sütun yetkisi verilmez (profiles sütun bazlı grant'lı) — istemci okuyamaz.
-- ============================================================

alter table public.profiles add column if not exists lig_gizli boolean not null default false;

create or replace function public.lig_gorunur_mu(
  p_is_bot boolean, p_takma_ad_secildi boolean, p_avatar_onayli boolean, p_lig_gizli boolean
) returns boolean
language sql immutable
as $$
  select not coalesce(p_lig_gizli, false)
     and (coalesce(p_is_bot, false)
          or (coalesce(p_takma_ad_secildi, false) and coalesce(p_avatar_onayli, false)));
$$;
revoke all on function public.lig_gorunur_mu(boolean, boolean, boolean, boolean) from public, anon;

-- ---------- lig_grubum: satırlar ve grup boyu görünür üyelerden ----------
create or replace function public.lig_grubum()
 returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text, puan integer, ben boolean, bot boolean, lig text, grup_boyu integer, yukselen integer, dusen integer, sezon_bitis timestamp with time zone, gorunum jsonb)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_hafta date := public.hafta_basi();
  v_lig text;
  v_grup int;
  v_boyu int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.lig_uyeligim_kur(v_me);

  select u.lig, u.grup_no into v_lig, v_grup
    from public.lig_uyelik u where u.user_id = v_me and u.hafta = v_hafta;
  if v_lig is null then return; end if;

  -- Grup boyu açık botsuz VE kurulumu bitmemiş hesapsız sayılır.
  select count(*)::int into v_boyu
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
     and not public.acik_bot_mu(p.is_bot, p.bot_turu)
     and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli);

  return query
  select row_number() over (order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc),
         p.id, p.gorunen_ad, p.gorunen_avatar, p.puan_hafta,
         (p.id = v_me),
         public.acik_bot_mu(p.is_bot, p.bot_turu),
         v_lig, v_boyu,
         public.ayar_sayi('lig_yukselen', 5)::int,
         public.ayar_sayi('lig_dusen', 5)::int,
         public.lig_sezon_bitisi(),
         p.gorunum
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
     and not public.acik_bot_mu(p.is_bot, p.bot_turu)
     -- Oyuncu kendi satırını her durumda görür.
     and (public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli) or p.id = v_me)
   order by 1;
end;
$function$;

-- ---------- lig_siralama ----------
create or replace function public.lig_siralama(p_kapsam text default 'global'::text, p_donem text default 'hafta'::text)
 returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text, puan integer, sehir text, ulke text, ben boolean, bot boolean, gorunum jsonb)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_ulke text;
  v_sehir text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_kapsam not in ('sehir', 'ulke', 'global') then raise exception 'Geçersiz kapsam'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir into v_ulke, v_sehir from public.profiles p where p.id = v_me;

  if p_kapsam in ('sehir', 'ulke') and v_ulke is null then
    raise exception 'Önce ülkeni ve şehrini seçmelisin';
  end if;
  if p_kapsam = 'sehir' and v_sehir is null then
    raise exception 'Önce şehrini seçmelisin';
  end if;

  return query
  with sirali as (
    select p.id,
           p.gorunen_ad as p_ad,
           p.gorunen_avatar as p_avatar,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as p_puan,
           p.sehir, p.ulke, p.gorunum as p_gorunum,
           public.acik_bot_mu(p.is_bot, p.bot_turu) as p_bot,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.puan desc, p.gorunen_ad asc) as p_sira
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1
      and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
      and not public.acik_bot_mu(p.is_bot, p.bot_turu)
      and (public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli) or p.id = v_me)
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.p_ad, s.p_avatar, s.p_puan, s.sehir, s.ulke,
         (s.id = v_me), s.p_bot, s.p_gorunum
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$function$;

-- ---------- lig_uyeligim_kur: grup doluluğu görünür üyelerden ----------
create or replace function public.lig_uyeligim_kur(p_user uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_hafta date := public.hafta_basi();
  v_lig text;
  v_boyu int;
  v_gercek int;
  v_grup int;
begin
  if exists (select 1 from public.lig_uyelik where user_id = p_user and hafta = v_hafta) then
    return;
  end if;

  select coalesce(lig, 'bronz') into v_lig from public.profiles where id = p_user;
  if v_lig is null then return; end if;

  select count(*) into v_gercek
    from public.profiles p
   where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
     and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli);
  v_boyu := case when v_gercek < public.ayar_sayi('lig_kucuk_esik', 10)::int
                 then public.ayar_sayi('lig_grup_boyu_kucuk', 15)::int
                 else public.ayar_sayi('lig_grup_boyu', 25)::int end;

  -- Yeri olan en dolu grup; kurulumu bitmemiş hesaplar yer kaplamaz.
  select u.grup_no into v_grup
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig
     and not public.acik_bot_mu(p.is_bot, p.bot_turu)
     and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
   group by u.grup_no
  having count(*) < v_boyu
   order by count(*) desc
   limit 1;

  if v_grup is null then
    select coalesce(max(u.grup_no), 0) + 1 into v_grup
      from public.lig_uyelik u where u.hafta = v_hafta and u.lig = v_lig;
  end if;

  insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
  values (p_user, v_hafta, v_lig, v_grup)
  on conflict (user_id, hafta) do nothing;
end;
$function$;

-- ---------- lig_gruplarini_kur: grup sayısı/doluluk görünür oyunculardan ----------
-- Kurulumu bitmemiş hesaplar da üye yazılır (bitirince görünsünler) ama
-- grup boyu hesabına ve doluluk sayımına girmez.
create or replace function public.lig_gruplarini_kur(p_hafta date default null::date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_hafta date := coalesce(p_hafta, public.hafta_basi());
  v_boyu int := public.ayar_sayi('lig_grup_boyu', 25)::int;
  v_kucuk int := public.ayar_sayi('lig_grup_boyu_kucuk', 15)::int;
  v_esik int := public.ayar_sayi('lig_kucuk_esik', 10)::int;
  v_bot_tavan int := public.ayar_sayi('lig_grup_bot_tavani', 15)::int;
  v_lig text;
  v_gercek int;
  v_grup_boyu int;
  v_grup_sayisi int;
  v_bot_sinir int;
  v_toplam int := 0;
  r record;
  v_i int;
begin
  foreach v_lig in array array['bronz','gumus','altin','elmas','efsane'] loop
    select count(*) into v_gercek
      from public.profiles p
     where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
       and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli);

    -- Görünür gerçek oyuncu yoksa grup açma: bot dolu tablo kimseye bir şey anlatmaz.
    if v_gercek = 0 then continue; end if;

    v_grup_boyu := case when v_gercek < v_esik then v_kucuk else v_boyu end;
    v_grup_sayisi := greatest(1, ceil(v_gercek::numeric / v_grup_boyu)::int);
    v_bot_sinir := least(v_bot_tavan, floor((v_grup_boyu - 1) / 2.0)::int);

    -- Görünür gerçek oyuncular gruplara sırayla (karışık) dağıtılır
    v_i := 0;
    for r in
      select p.id from public.profiles p
       where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
         and public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
       order by random()
    loop
      insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
      values (r.id, v_hafta, v_lig, (v_i % v_grup_sayisi) + 1)
      on conflict (user_id, hafta) do update
        set lig = excluded.lig, grup_no = excluded.grup_no;
      v_i := v_i + 1;
      v_toplam := v_toplam + 1;
    end loop;

    -- Kurulumu bitmemiş / gizli hesaplar: üyelik yazılır, yer kaplamaz.
    for r in
      select p.id from public.profiles p
       where not coalesce(p.is_bot, false) and coalesce(p.lig, 'bronz') = v_lig
         and not public.lig_gorunur_mu(p.is_bot, p.takma_ad_secildi, p.avatar_onayli, p.lig_gizli)
    loop
      insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
      values (r.id, v_hafta, v_lig, 1)
      on conflict (user_id, hafta) do nothing;
    end loop;

    -- Boşlukları GİZLİ bot doldurur; doluluk yalnız görünür üyelerle sayılır.
    for v_i in 1..v_grup_sayisi loop
      for r in
        select p.id from public.profiles p
         where coalesce(p.is_bot, false) and coalesce(p.bot_aktif, true)
           and p.bot_turu = 'gizli'
           and coalesce(p.lig, 'bronz') = v_lig
           and not exists (select 1 from public.lig_uyelik u
                            where u.user_id = p.id and u.hafta = v_hafta)
         order by random()
         limit least(
           v_bot_sinir,
           greatest(0, v_grup_boyu - (select count(*) from public.lig_uyelik u
                                       join public.profiles q on q.id = u.user_id
                                       where u.hafta = v_hafta and u.lig = v_lig
                                         and u.grup_no = v_i
                                         and public.lig_gorunur_mu(q.is_bot, q.takma_ad_secildi, q.avatar_onayli, q.lig_gizli))))
      loop
        insert into public.lig_uyelik (user_id, hafta, lig, grup_no)
        values (r.id, v_hafta, v_lig, v_i)
        on conflict (user_id, hafta) do nothing;
        v_toplam := v_toplam + 1;
      end loop;
    end loop;
  end loop;

  return v_toplam;
end;
$function$;

-- Silinmeyen şüpheli test hesapları (maçı/arkadaşı olan ya da son 24 saatte
-- görülen): yalnız gizlenir.
update public.profiles set lig_gizli = true
 where not coalesce(is_bot, false)
   and gorunen_ad in ('SquareTest12', 'QuizTestIda', 'ssss', 'DenekKartal', 'YüceBaran');
