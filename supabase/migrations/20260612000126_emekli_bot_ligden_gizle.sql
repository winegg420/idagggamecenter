-- ============================================================
-- EMEKLİ BOT LİG SIRALAMASINDA GÖRÜNMESİN
--
-- Migration 125 beşinci botu emekliye ayırdı (bot_aktif = false) ve adına
-- "(emekli)" ekledi. Ama lig sıralaması botları ayırmadan listeliyor:
-- canlı testte lig 3.'sü olarak "ÇaylakBot (emekli)" göründü. Oyuncunun
-- iç işleyişimizi okuması gerekmez.
--
-- İki düzeltme:
--   1. "(emekli)" ibaresi kalkıyor, ad "BilgeBot" oluyor.
--      NEDEN eski adı "ÇaylakBot" geri verilmedi: takma_ad üzerinde
--      küçük/büyük harf duyarsız bir UNIQUE indeks var
--      (idx_profiles_takma_ad_ci) ve o ad artık AKTİF orta seviye bota
--      ait — ilk deneme tam bu kısıta takıldı. "BilgeBot" migration 125'te
--      boşa çıkmıştı (eski BilgeBot artık EfsaneBot), maç geçmişinde de
--      tanıdık bir ad olarak duruyor.
--   2. lig_siralama emekli botları atlıyor. Aktif botlar listede KALIR —
--      lig boş görünmesin.
--
-- birlesik_siralama zaten `is_bot = false` süzüyor, dokunulmadı.
-- hizli_mod_siralama hızlı mod skorlarından okuyor; botlar o modu oynamıyor.
-- ============================================================

begin;

-- 1) "(emekli)" ibaresini kaldır (bkz. yukarıdaki UNIQUE notu)
update public.profiles
   set takma_ad = 'BilgeBot'
 where id = 'b0b00000-0000-4000-8000-000000000002';

-- 2) Lig sıralaması: emekli botlar listelenmesin
-- Parametre VARSAYILANLARI da korunmalı: 'create or replace' bunları da
-- değiştiremiyor (ikinci deneme burada patladı).
create or replace function public.lig_siralama(
  p_kapsam text default 'global',
  p_donem text default 'hafta'
)
-- DİKKAT: kolon adları mevcut fonksiyonla BİREBİR aynı olmalı —
-- "create or replace" dönüş tipini değiştiremez (ilk deneme burada patladı).
returns table (
  sira bigint,
  user_id uuid,
  gorunen_ad text,
  gorunen_avatar text,
  puan integer,
  sehir text,
  ulke text,
  ben boolean,
  bot boolean
)
language plpgsql
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
      -- EKLENEN: emekli bot listelenmez (aktif botlar kalır)
      and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
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

commit;
