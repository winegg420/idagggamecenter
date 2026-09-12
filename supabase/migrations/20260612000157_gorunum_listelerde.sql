-- ============================================================
-- GÖRÜNÜM LİSTE EKRANLARINDA
--
-- 2B avatar `profiles.gorunum`dan üretiliyor; liste ekranlarının bu
-- alanı okuyabilmesi gerek. Alan yalnız KOZMETİKTİR (karakter + parça +
-- renk); kimlik ya da bot bilgisi taşımaz — gizli botun görünümü gerçek
-- oyuncununkinden ayırt edilemez (bkz. migration 155).
--
-- `is_bot`, `bot_isabet`, `bot_seviye` istemciye KAPALI kalmaya devam
-- ediyor; burada yalnız `gorunum` açılıyor.
-- ============================================================

grant select (gorunum) on public.profiles to authenticated;

-- Lig tabloları avatarı da döndürsün (satır başına ek sorgu olmasın).
-- Dönüş tipine `gorunum` eklendiği için önce düşürülmeleri gerekiyor.
drop function if exists public.lig_siralama(text, text);
drop function if exists public.lig_grubum();
create or replace function public.lig_siralama(p_kapsam text default 'global', p_donem text default 'hafta')
 returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
               puan integer, sehir text, ulke text, ben boolean, bot boolean, gorunum jsonb)
 language plpgsql security definer set search_path to 'public'
as $ls$
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
           (coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik') as p_bot,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.puan desc, p.gorunen_ad asc) as p_sira
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1
      and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
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
$ls$;

create or replace function public.lig_grubum()
returns table(sira bigint, user_id uuid, gorunen_ad text, gorunen_avatar text,
              puan integer, ben boolean, bot boolean,
              lig text, grup_boyu integer, yukselen integer, dusen integer,
              sezon_bitis timestamptz, gorunum jsonb)
language plpgsql security definer set search_path to 'public' as $lg$
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

  select count(*)::int into v_boyu
    from public.lig_uyelik u
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup;

  return query
  select row_number() over (order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc),
         p.id, p.gorunen_ad, p.gorunen_avatar, p.puan_hafta,
         (p.id = v_me),
         (coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik'),
         v_lig, v_boyu,
         public.ayar_sayi('lig_yukselen', 5)::int,
         public.ayar_sayi('lig_dusen', 5)::int,
         public.lig_sezon_bitisi(),
         p.gorunum
    from public.lig_uyelik u
    join public.profiles p on p.id = u.user_id
   where u.hafta = v_hafta and u.lig = v_lig and u.grup_no = v_grup
   order by 1;
end;
$lg$;

grant execute on function public.lig_grubum() to authenticated;

grant execute on function public.lig_siralama(text, text) to authenticated;
