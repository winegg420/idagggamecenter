-- ============================================================
-- MEYDAN BOTLARI — DAİMA EN AZ BİR BOT, KALABALIKLA ARTAR
--
-- Sahibinin isteği: "Haritada her zaman bir tane fake bot olsun, gerçek
-- kullanıcı gibi hareket etsin" + gerçek oyuncu girdiğinde bot sayısı
-- artsın (meydan şenlikli görünsün).
--
-- ÖNCEKİ DURUM (ölçüldü): `meydan_bot_sayisi = 2` sabitti AMA nöbet
-- yalnız turnuva saatine yakın (45 dk önce – 15 dk sonra) doluyordu;
-- günün geri kalanında `delete from meydan_bot_nobeti` ile meydan
-- TAMAMEN BOŞ kalıyordu. "Her zaman bir bot" isteği bu yüzden tutmuyordu.
--
-- YENİ DURUM:
--   • Nöbet HER ZAMAN dolu tutulur (turnuva kısıtı kalktı).
--   • Sunucu TAVAN kadar bot nöbete yazar; kaçının ÇİZİLECEĞİNE istemci
--     karar verir (meydandaki gerçek oyuncu sayısına göre). Sunucu
--     presence'ı görmediği için sayım orada yapılamaz; istemcide
--     yapılınca herkes aynı `kisi` değerini kullandığı için tutarlıdır.
--
-- `meydan_bot_sayisi` SİLİNMEDİ, kullanımdan çıktı.
-- Botlar etkinlik eşyası (taç, pelerin) giymez — bu zaten
-- `avatar3d_bot_gorunum_uret` tarafından garanti ediliyor (migration 165).
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('meydan_bot_taban', '1'::jsonb,
   'Meydanda başka gerçek oyuncu yokken çizilecek bot sayısı. Meydan asla boş görünmez.'),
  ('meydan_bot_ek', '2'::jsonb,
   'Meydandaki her EK gerçek oyuncu için çizilecek fazladan bot sayısı.'),
  ('meydan_bot_tavan', '6'::jsonb,
   'Aynı anda çizilecek en çok bot. 3B gövde sınırını (UC_BOYUTLU_SINIR) zorlamamak için düşük tutulur.')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

update public.oyun_ayarlari
   set aciklama = 'KULLANILMIYOR (13 Eyl 2026). Yerine meydan_bot_taban / _ek / _tavan geldi.'
 where anahtar = 'meydan_bot_sayisi';

-- ------------------------------------------------------------
-- Nöbet artık her zaman dolu
-- ------------------------------------------------------------
create or replace function public.meydan_bot_nobeti_guncelle()
returns integer
language plpgsql
security definer
set search_path = public
as $mbn$
declare
  v_hedef int := public.ayar_sayi('meydan_bot_tavan', 6)::int;
  v_mevcut int;
  v_bot uuid;
  v_n int := 0;
begin
  delete from public.meydan_bot_nobeti where bitis < now();

  -- TURNUVA SAATİ KISITI KALKTI: eskiden gün boyu nöbet siliniyordu ve
  -- meydan boş kalıyordu. Artık nöbet sürekli dolu.
  select count(*)::int into v_mevcut from public.meydan_bot_nobeti;
  if v_mevcut >= v_hedef then return v_mevcut; end if;

  for v_bot in
    select p.id from public.profiles p
     where p.is_bot and coalesce(p.bot_aktif, true) and p.bot_turu = 'gizli'
       and not exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = p.id)
     order by random()
     limit (v_hedef - v_mevcut)
  loop
    -- Nöbet 12 dk: cron 5 dakikada bir tazeliyor, boşluk oluşmuyor.
    -- Bitişler farklı anlara düşsün ki botlar hep birlikte değişmesin.
    insert into public.meydan_bot_nobeti (bot_id, bitis, tohum)
    values (v_bot,
            now() + make_interval(mins => 12 + (random() * 8)::int),
            md5(v_bot::text || now()::text))
    on conflict (bot_id) do nothing;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$mbn$;

revoke all on function public.meydan_bot_nobeti_guncelle() from public, authenticated, anon;

-- Nöbet hemen dolsun (cron'un ilk turunu bekleme).
select public.meydan_bot_nobeti_guncelle();

-- ------------------------------------------------------------
-- Meydan bot ayarlarını istemciye ver
-- `is_bot` DÖNMEZ: yalnız kaç bot çizileceğinin kuralı.
-- ------------------------------------------------------------
create or replace function public.meydan_bot_ayarlari()
returns table(taban int, ek int, tavan int)
language sql
stable
security definer
set search_path = public
as $fn$
  select public.ayar_sayi('meydan_bot_taban', 1)::int,
         public.ayar_sayi('meydan_bot_ek', 2)::int,
         public.ayar_sayi('meydan_bot_tavan', 6)::int;
$fn$;

grant execute on function public.meydan_bot_ayarlari() to authenticated;
