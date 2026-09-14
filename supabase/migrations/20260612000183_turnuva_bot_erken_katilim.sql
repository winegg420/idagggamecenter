-- ============================================================
-- TURNUVA BOTLARI LOBİ AÇILDIĞI ANDAN İTİBAREN KATILIR
--
-- Sahibinin gözlemi (14 Eyl 2026, 13:30): "Gece turnuvasına 8 saat var ama
-- turnuvaya katılmış kimse yok. Bu saatten başlamalı botlar katılmaya."
--
-- ÖLÇÜLEN: akşam turnuvasının lobisi 13:00'te açıldı (sabah turnuvası
-- başlayınca), 13:30'da lobide 1 kişi vardı. `turnuva_bot_katilim_ani`
-- botların TÜMÜNÜ turnuvadan önceki son 25 dakikaya yayıyordu
-- (`bot_turnuva_katilim_yayilma_dk`=25) — lobi ~9 saat boş duruyordu.
--
-- YENİ DAĞILIM (organik):
--   • "Erken gelenler" (`bot_turnuva_erken_yuzde`, %30): lobi açıldığı
--     andan başlangıca kadar yayılır, AÇILIŞA YAKIN yoğun (karekök
--     eğrisi): açılıştan 30 dk sonra erkencilerin ~%24'ü, 4 saat sonra
--     ~%70'i lobide.
--   • Geri kalanı son `bot_turnuva_katilim_yayilma_dk` dakikada gelir;
--     son dakikalar kalabalıklaşsın diye bu pencere 25 → 60 dk.
-- Hedef bot sayısı ve havuz (38-66, `turnuva_hedef_bot`) DEĞİŞMEDİ.
-- Kararlı: aynı turnuva + bot için an hep aynı (bot_rasgele).
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('bot_turnuva_erken_yuzde', '30'::jsonb,
   'Turnuva botlarının yüzde kaçı lobi açılır açılmaz gün boyu yavaş yavaş katılır (açılışa yakın yoğun). Kalanı son dakikalarda gelir.')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

update public.oyun_ayarlari
   set deger = '60'::jsonb,
       aciklama = 'Erken gelmeyen turnuva botları başlangıçtan önceki bu kadar dakikaya yayılır.'
 where anahtar = 'bot_turnuva_katilim_yayilma_dk';

create or replace function public.turnuva_bot_katilim_ani(p_tournament_id uuid, p_bot uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_an      timestamptz := public.turnuva_an(p_tournament_id);
  v_acilis  timestamptz;
  v_son_dk  int := public.ayar_sayi('bot_turnuva_katilim_yayilma_dk', 60)::int;
  v_erken   numeric := public.ayar_sayi('bot_turnuva_erken_yuzde', 30)::numeric / 100;
  v_anahtar text := p_tournament_id::text || p_bot::text;
  v_pencere double precision;
begin
  select t.created_at into v_acilis from public.tournaments t where t.id = p_tournament_id;

  -- Erken gelen: açılış → başlangıç, açılışa yakın yoğun (r²).
  if v_acilis is not null and v_acilis < v_an
     and public.bot_rasgele('turnuva_erken:' || v_anahtar) < v_erken then
    v_pencere := extract(epoch from (v_an - v_acilis));
    return v_acilis + make_interval(secs =>
      power(public.bot_rasgele('turnuva_erken_an:' || v_anahtar), 2) * v_pencere);
  end if;

  -- Diğerleri: son `v_son_dk` dakikaya düz yayılır (eski davranışın aynısı).
  return v_an
       - make_interval(mins => v_son_dk)
       + make_interval(secs => (public.bot_rasgele('turnuva_an:' || v_anahtar) * v_son_dk * 60)::int);
end;
$fn$;

revoke all on function public.turnuva_bot_katilim_ani(uuid, uuid) from public, authenticated, anon;

-- Açık lobiler hemen dolmaya başlasın (cron'un dakikalık turunu bekleme).
select public.bot_turnuva_katilim_tik();
