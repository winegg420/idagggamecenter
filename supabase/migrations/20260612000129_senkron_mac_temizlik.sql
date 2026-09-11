-- ============================================================
-- SENKRON MAÇ TEMİZLİĞİ
--
-- Senkron maçta soruyu ilerleten taraf İSTEMCİDİR (süre dolunca
-- mac_soruyu_atla → advance_match). İki oyuncu da sekmeyi kapatırsa maçı
-- ilerletecek kimse kalmıyor ve maç sonsuza kadar "aktif" kalıyor:
-- ana sayfada "Seni bekleyenler" listesinde takılı duruyor.
--
-- Asenkron maçlarda bunun karşılığı advance_match içindeki 24 saatlik terk
-- kuralıydı; senkronda ortak saat olduğu için çok daha kısa bir pencere
-- yetiyor. Saatlik cron'a bağlanır.
-- ============================================================

create or replace function public.senkron_mac_temizle()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_kazanan uuid;
  v_kaybeden uuid;
begin
  -- 1) Hiç başlamamış maç: taraflardan biri bir saattir ekrana gelmedi.
  --    Kimse mağdur olmaz, puan yazılmaz; maç iptal edilir.
  update public.matches
     set durum = 'iptal'
   where durum = 'aktif'
     and coalesce(senkron, false)
     and not basladi
     and created_at < now() - interval '1 hour';

  -- 2) Başlamış ama 10 dakikadır ilerlememiş maç: iki taraf da terk etti.
  --    O ana kadarki skorlarla sonuçlandırılır.
  for r in
    select id, oyuncu1, oyuncu2, oyuncu1_skor, oyuncu2_skor
      from public.matches
     where durum = 'aktif'
       and coalesce(senkron, false)
       and basladi
       and soru_baslangic < now() - interval '10 minutes'
     for update skip locked
  loop
    if r.oyuncu1_skor > r.oyuncu2_skor then
      v_kazanan := r.oyuncu1; v_kaybeden := r.oyuncu2;
    elsif r.oyuncu2_skor > r.oyuncu1_skor then
      v_kazanan := r.oyuncu2; v_kaybeden := r.oyuncu1;
    else
      v_kazanan := null; v_kaybeden := null;
    end if;
    perform public.mac_sonuclandir(r.id, v_kazanan, v_kaybeden);
  end loop;
end;
$fn$;

-- Saatlik temizlik cron'una ekle (mevcut iki çağrı korunur).
select cron.alter_job(
  (select jobid from cron.job where jobname = 'bildim-yarim-mac-temizle'),
  command := 'select public.hizli_mac_temizle(); select public.grup_mac_temizle(); select public.senkron_mac_temizle();'
);
