-- Paket 27 — testin yakaladığı tutarsızlık.
--
-- `joker_mac_durumu().ucretsiz_elli_kaldi` hâlâ ESKİ tanımı kullanıyordu:
-- "bu maçta ücretsiz elli kullanılmadıysa hak var". Paket 27 B.1.2'den sonra
-- ücretsiz 50:50 YALNIZ SERBEST Klasik Mod'da var; dereceli maçta yok.
-- Eski tanımla dereceli maçta arayüz "ÜCRETSİZ" rozeti gösteriyor, oyuncu
-- basınca envanterden joker düşüyordu — yani yalan söylüyordu.
--
-- Artık tek kaynak: joker_ucretsiz_elli_hakki(). Kural iki yerde iki türlü durmaz.
create or replace function public.joker_mac_durumu(p_mac_tur text, p_mac_id uuid)
returns table(sinir integer, kullanilan integer, ucretsiz_elli_kaldi boolean)
language sql stable security definer set search_path to 'public'
as $function$
  select
    public.joker_mac_siniri(p_mac_tur, p_mac_id),
    (select count(*)::int from public.joker_kullanimlari
      where user_id = auth.uid() and mac_tur = p_mac_tur and mac_id = p_mac_id),
    public.joker_ucretsiz_elli_hakki(p_mac_tur, p_mac_id);
$function$;
