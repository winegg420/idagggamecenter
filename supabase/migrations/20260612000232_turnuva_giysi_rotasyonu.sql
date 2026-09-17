-- ============================================================
-- Paket 24 · D — TURNUVA HAFTALIK GİYSİSİ: ROTASYON
--
-- ÖLÇÜLEN DURUM: sistem ZATEN VAR (migration 213) — turnuva_giysi_odulu tablosu,
-- turnuva_haftalik_giysi(), "tabloya giren giysi satılmaz olur" tetikleyicisi ve
-- lig çerçeveleri. Bunlar YENİDEN YAZILMADI.
--
-- EKSİK OLAN TEK ŞEY: tabloda tek satır vardı (2026-09-14 → sirt_pelerin).
-- turnuva_haftalik_giysi() "hafta <= bugün" olan EN SON satırı döndürüyor; yeni satır
-- eklenmediği için ödül hiç değişmiyordu. "Ödül her hafta değişecek" kararı bu yüzden
-- çalışmıyordu. Bu dosya yalnız o boşluğu dolduruyor.
--
-- ADAY HAVUZ: avatar3d_parcalar içinde aktif + nadirlik = 'etkinlik' olan parçalar
-- (bugün: bas_tac "Taç", sirt_pelerin "Pelerin"). Havuz sıra ile döner, bitince başa
-- sarar. Yeni etkinlik parçası eklendiğinde (ör. Uzay Kıyafeti) rotasyona kendiliğinden
-- katılır — bu dosyaya dokunmak gerekmez.
--
-- KURALLAR:
--   · Aynı giysi üst üste iki hafta gelmez (havuzda birden çok aday varsa).
--   · Havuzda uygun parça yoksa SESSİZCE BOŞ GEÇİLMEZ: mevcut giysi korunur ve
--     uyarı günlüğe yazılır (raise warning).
--   · turnuva_giysi_tekrar_coin (0) DEĞİŞTİRİLMEDİ — zaten sahip olan ilk-3 oyuncuya
--     eşya tekrar verilmiyor, yalnız derece coin'i alıyor. Bu doğru davranış.
--   · Fonksiyon idempotenttir: bu haftanın satırı varsa hiçbir şey yapmaz.
-- ============================================================

create or replace function public.turnuva_giysi_rotasyon()
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_hafta date := public.hafta_basi();
  v_son text;
  v_son_sira int;
  v_yeni text;
  v_aday int;
begin
  -- Bu haftanın ödülü zaten belirlenmişse dokunma (cron birden çok kez çalışabilir)
  if exists (select 1 from public.turnuva_giysi_odulu where hafta = v_hafta) then
    return null;
  end if;

  select count(*) into v_aday
    from public.avatar3d_parcalar p
   where p.aktif and p.nadirlik = 'etkinlik';

  if v_aday = 0 then
    raise warning 'turnuva_giysi_rotasyon: aday etkinlik parçası yok — bu hafta (%) mevcut giysi korunuyor', v_hafta;
    return null;
  end if;

  -- En son verilen giysi (rotasyonun nerede kaldığı)
  select t.parca_id into v_son
    from public.turnuva_giysi_odulu t
   order by t.hafta desc
   limit 1;

  select p.sira into v_son_sira
    from public.avatar3d_parcalar p
   where p.id = v_son and p.aktif and p.nadirlik = 'etkinlik';

  -- Sıradaki aday: (sira, id) düzeninde son verilenden sonraki. Yoksa başa sar.
  select p.id into v_yeni
    from public.avatar3d_parcalar p
   where p.aktif and p.nadirlik = 'etkinlik'
     and (v_son_sira is null or (p.sira, p.id) > (v_son_sira, v_son))
     -- Aynı giysi üst üste gelmesin (havuzda tek aday varsa bu kural uygulanamaz)
     and (v_aday = 1 or p.id is distinct from v_son)
   order by p.sira, p.id
   limit 1;

  if v_yeni is null then
    -- Havuzun sonuna gelindi: başa sar
    select p.id into v_yeni
      from public.avatar3d_parcalar p
     where p.aktif and p.nadirlik = 'etkinlik'
       and (v_aday = 1 or p.id is distinct from v_son)
     order by p.sira, p.id
     limit 1;
  end if;

  if v_yeni is null then
    raise warning 'turnuva_giysi_rotasyon: sıradaki giysi seçilemedi — bu hafta (%) mevcut giysi korunuyor', v_hafta;
    return null;
  end if;

  insert into public.turnuva_giysi_odulu (hafta, parca_id, aciklama)
  values (v_hafta, v_yeni, 'Haftalık rotasyon')
  on conflict (hafta) do nothing;

  return v_yeni;
end;
$fn$;

-- ------------------------------------------------------------
-- Arayüz için: "Bu haftanın ilk 3 ödülü: <giysi adı>"
-- ------------------------------------------------------------
create or replace function public.turnuva_haftalik_giysi_bilgi()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select jsonb_build_object('parca_id', p.id, 'ad', p.ad, 'yuva', p.yuva)
    from public.avatar3d_parcalar p
   where p.id = public.turnuva_haftalik_giysi();
$fn$;

revoke all on function public.turnuva_giysi_rotasyon() from public, anon, authenticated;
revoke all on function public.turnuva_haftalik_giysi_bilgi() from public, anon;
grant execute on function public.turnuva_haftalik_giysi_bilgi() to authenticated;

-- ------------------------------------------------------------
-- Zamanlama — hafta_basi() ile aynı sınır (Pazartesi 00:00 TSİ = Pazar 21:00 UTC)
--
-- İKİ İŞ, TEK FONKSİYON: ana iş hafta döner dönmez çalışır; günlük iş yalnız
-- güvenlik ağıdır (cron bir kez kaçarsa hafta boyu eski giysi kalmasın).
-- Fonksiyon idempotent olduğu için ikisinin birden çalışması zararsızdır.
-- ------------------------------------------------------------
do $$
begin
  perform cron.unschedule('bildim-turnuva-giysi-rotasyon');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('bildim-turnuva-giysi-yedek');
exception when others then null;
end $$;

select cron.schedule('bildim-turnuva-giysi-rotasyon', '5 21 * * 0', $$select public.turnuva_giysi_rotasyon()$$);
select cron.schedule('bildim-turnuva-giysi-yedek', '10 4 * * *', $$select public.turnuva_giysi_rotasyon()$$);
