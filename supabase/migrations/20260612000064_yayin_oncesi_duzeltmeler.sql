-- ============================================================
-- YAYIN ÖNCESİ DÜZELTMELER (Görev 4 / Faz 1 — sunucu tarafı)
--
-- 1) hizli_mod_cevap: "column reference dogru is ambiguous"
--    returns table (dogru boolean, ...) out-parametresi ile
--    hizli_mod_oturumlar.dogru kolonu çakışıyordu → Hızlı Mod tamamen bozuktu.
--
-- 2) Lig boş görünüyordu. İki gerçek sebep:
--    a) `coalesce(is_bot,false) = false` → botlar ligde hiç yoktu
--    b) haftalıkta `puan_hafta > 0` şartı → hafta başında lig boşalıyor,
--       canlıda bu şarta uyan tek gerçek oyuncu vardı.
--    Karar (BILDIM_GOREV4 "varsayılan kararlar"): botlar ligde GÖRÜNÜR,
--    haftalık puan şartı kalkar (sıralama yine puan_hafta'ya göre; eşitlik
--    toplam puanla kırılır) → lig hafta başında da dolu görünür.
--
-- 3) Botların ülke/şehri yoktu → şehir ve ülke liglerinde hiç çıkmıyorlardı.
--
-- 4) Turnuva lobisine tek bot, turnuvadan 5 dk önce giriyordu → lobi
--    "tek kişilik" görünüyordu. Üç bot, 30 dk önce.
-- ============================================================

-- ------------------------------------------------------------
-- 1) HIZLI MOD — ambiguous kolon düzeltmesi
--    Gövde 054'teki ile aynı; yalnız UPDATE ... SET sağ tarafları
--    tablo adıyla nitelendi ve #variable_conflict eklendi.
-- ------------------------------------------------------------
create or replace function public.hizli_mod_cevap(
  p_oturum_id uuid, p_soru_index int, p_cevap smallint
)
returns table (dogru boolean, dogru_cevap smallint, skor int, kalan_toplam_sn int, bitti boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];

  -- Soru başına 5 sn (1 sn ağ payı); süre geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '6 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
  end if;

  -- Kategori ustalığı: hızlı modda da doğrular sayılır
  if v_dogru then
    perform public.kategori_dogru_arttir(auth.uid(), q.kategori);
  end if;

  update public.hizli_mod_oturumlar h
     set dogru = h.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = h.yanlis + (case when v_dogru then 0 else 1 end),
         aktif_soru = h.aktif_soru + 1,
         soru_baslangic = now()
   where h.id = p_oturum_id
  returning h.* into o;

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

-- ------------------------------------------------------------
-- 2) LİG SIRALAMASI — botlar dahil, haftalık puan şartı kalktı
--    is_bot kolonu eklendiği için imza değişiyor → önce drop.
-- ------------------------------------------------------------
drop function if exists public.lig_siralama(text, text);

create or replace function public.lig_siralama(
  p_kapsam text default 'global',
  p_donem text default 'hafta'
)
returns table (
  sira bigint,
  user_id uuid,
  gorunen_ad text,
  gorunen_avatar text,
  puan int,
  sehir text,
  ulke text,
  ben boolean,
  bot boolean
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
           p.sehir,
           p.ulke,
           coalesce(p.is_bot, false) as p_bot,
           row_number() over (
             order by (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) desc,
                      p.puan desc,          -- haftalık eşitlikte toplam puan
                      p.gorunen_ad asc
           ) as p_sira
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1     -- hiç oynamamışlar ligde yok
      and (
        p_kapsam = 'global'
        or (p_kapsam = 'ulke'  and p.ulke = v_ulke)
        or (p_kapsam = 'sehir' and p.ulke = v_ulke and p.sehir = v_sehir)
      )
  )
  select s.p_sira, s.id, s.p_ad, s.p_avatar, s.p_puan, s.sehir, s.ulke,
         (s.id = v_me), s.p_bot
  from sirali s
  where s.p_sira <= 100 or s.id = v_me
  order by s.p_sira;
end;
$$;

revoke execute on function public.lig_siralama(text, text) from public, anon;
grant execute on function public.lig_siralama(text, text) to authenticated;

-- ------------------------------------------------------------
-- 3) BENİM LİG DURUMUM — aynı kural (botlar dahil, puan şartı yok)
--    İmza değişmiyor, replace yeterli.
-- ------------------------------------------------------------
create or replace function public.benim_lig_durumum(p_donem text default 'hafta')
returns table (
  puan integer, sehir text, ulke text,
  sira_sehir bigint, sehir_oyuncu bigint,
  sira_ulke bigint, ulke_oyuncu bigint,
  sira_global bigint, global_oyuncu bigint,
  sehrin_ulke_sirasi bigint, ulkedeki_sehir_sayisi bigint
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
  v_puan int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_donem not in ('hafta', 'tum_zamanlar') then raise exception 'Geçersiz dönem'; end if;

  select p.ulke, p.sehir,
         case when p_donem = 'hafta' then p.puan_hafta else p.puan end
    into v_ulke, v_sehir, v_puan
  from public.profiles p where p.id = v_me;

  return query
  with lig as (
    select p.id, p.ulke, p.sehir,
           (case when p_donem = 'hafta' then p.puan_hafta else p.puan end) as lp
    from public.profiles p
    where coalesce(p.toplam_mac, 0) >= 1
  )
  select
    coalesce(v_puan, 0),
    v_sehir,
    v_ulke,
    case when v_sehir is null then null else
      (select count(*) + 1 from lig l where l.ulke = v_ulke and l.sehir = v_sehir and l.lp > coalesce(v_puan, 0)) end,
    case when v_sehir is null then null else
      (select count(*) from lig l where l.ulke = v_ulke and l.sehir = v_sehir) end,
    case when v_ulke is null then null else
      (select count(*) + 1 from lig l where l.ulke = v_ulke and l.lp > coalesce(v_puan, 0)) end,
    case when v_ulke is null then null else
      (select count(*) from lig l where l.ulke = v_ulke) end,
    (select count(*) + 1 from lig l where l.lp > coalesce(v_puan, 0)),
    (select count(*) from lig l),
    case when v_sehir is null then null else (
      with t as (
        select l.sehir as s, sum(l.lp) as sp from lig l
        where l.ulke = v_ulke and l.sehir is not null
        group by l.sehir
      )
      select count(*) + 1 from t
      where t.sp > coalesce((select t2.sp from t t2 where t2.s = v_sehir), 0)
    ) end,
    case when v_ulke is null then null else
      (select count(distinct l.sehir) from lig l where l.ulke = v_ulke and l.sehir is not null) end;
end;
$$;

revoke execute on function public.benim_lig_durumum(text) from public, anon;
grant execute on function public.benim_lig_durumum(text) to authenticated;

-- ------------------------------------------------------------
-- 4) Botlara konum — şehir ve ülke liglerinde de görünsünler
-- ------------------------------------------------------------
update public.profiles set ulke = 'TR', sehir = 'İstanbul'
 where id = 'b0b00000-0000-4000-8000-000000000001' and ulke is null;
update public.profiles set ulke = 'TR', sehir = 'Ankara'
 where id = 'b0b00000-0000-4000-8000-000000000002' and ulke is null;
update public.profiles set ulke = 'TR', sehir = 'İzmir'
 where id = 'b0b00000-0000-4000-8000-000000000003' and ulke is null;

-- ------------------------------------------------------------
-- 5) Turnuva lobisi — üç bot da girsin, lobide kimse olmasa bile
--    (kullanıcı lobiyi "tek kişilik" görmesin)
-- ------------------------------------------------------------
create or replace function public.bot_join_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bot uuid;
begin
  select id into v_id from public.tournaments
  where tarih = (now() at time zone 'Europe/Istanbul')::date
    and seans = p_seans and durum = 'lobi';
  if not found then return; end if;

  for v_bot in
    select p.id from public.profiles p where coalesce(p.is_bot, false) order by p.puan desc
  loop
    insert into public.tournament_players (tournament_id, user_id)
    values (v_id, v_bot)
    on conflict do nothing;
  end loop;
end;
$$;

-- Botlar turnuvadan 30 dk önce lobide olsun (eskiden 5 dk kalaydı)
select cron.alter_job(
  (select jobid from cron.job where jobname = 'bildim-bot-turnuva'),
  schedule := '30 18 * * *'
);
select cron.alter_job(
  (select jobid from cron.job where jobname = 'bildim-bot-turnuva-sabah'),
  schedule := '30 6 * * *'
);
