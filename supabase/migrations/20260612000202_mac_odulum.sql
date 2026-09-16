-- ============================================================
-- 202 — MAÇ SONU ÖDÜL BİLGİSİ + çift sayacı eşitleme (Paket 14, aşama 3)
--
-- · mac_odulum(maç): oturumdaki oyuncunun o 1v1 maçta kazandığı lig puanı
--   ve coin. Ekranda sabit "+20 puan" yazıyordu; artık sunucunun gerçekte
--   yazdığı değer gösterilir (dereceli/serbest, çift çarpanı, beraberlik).
--   Coin coin_hareketleri'nden okunur (günlük tavan dahil gerçek miktar).
-- · cift_mac_durumu: migration 201'de cift_odul_carpani serbest maçları da
--   saymaya başladı; maç öncesi uyarı aynı sayımı kullanmalı.
-- ============================================================

create or replace function public.mac_odulum(p_match_id uuid)
returns table (dereceli boolean, lig_puan int, coin int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_lig int := 0;
  v_coin int := 0;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  select * into m from public.matches where id = p_match_id;
  if not found or v_me not in (m.oyuncu1, m.oyuncu2) then return; end if;
  if m.durum <> 'bitti' then return; end if;

  if coalesce(m.dereceli, true) then
    if m.kazanan = v_me then
      v_lig := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * coalesce(m.odul_carpan, 1))::int;
    elsif m.kazanan is null then
      v_lig := floor(public.ayar_sayi('lig_mac_beraberlik', 10) * coalesce(m.odul_carpan, 1))::int;
    end if;
  end if;

  select coalesce(sum(h.miktar), 0)::int into v_coin
    from public.coin_hareketleri h
   where h.user_id = v_me and h.tur = 'mac' and h.referans = p_match_id::text;

  return query select coalesce(m.dereceli, true), v_lig, v_coin;
end;
$$;
revoke execute on function public.mac_odulum(uuid) from public, anon;
grant execute on function public.mac_odulum(uuid) to authenticated;

create or replace function public.cift_mac_durumu(p_rakip uuid)
returns table(bugun integer, sira integer, carpan numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_sayi int;
begin
  if v_me is null or p_rakip is null then return; end if;

  select count(*) into v_sayi
  from public.matches m
  where m.durum = 'bitti'
    and ((m.oyuncu1 = v_me and m.oyuncu2 = p_rakip) or (m.oyuncu1 = p_rakip and m.oyuncu2 = v_me))
    and (coalesce(m.bitis, m.created_at) at time zone 'Europe/Istanbul')::date = v_bugun;

  return query select
    v_sayi,
    v_sayi + 1,
    case
      when public.ayni_cihaz_mi(v_me, p_rakip) then 0::numeric
      when v_sayi + 1 <= public.ayar_sayi('mac_cift_tam_sinir', 5)::int then 1::numeric
      when v_sayi + 1 <= public.ayar_sayi('mac_cift_yari_sinir', 10)::int then 0.5::numeric
      else 0::numeric
    end;
end;
$$;
