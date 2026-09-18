-- Paket 26 C — otomatik testlerin bulduğu uykudaki kusur.
--
-- "Pas" jokeri Paket 14'te "Soru Değiştir" (`soru_degistir`) oldu. `joker_paketleri`
-- tablosundaki üç paketin içeriği de güncellendi:
--   joker_10  → {"elli": 4,  "sure": 3,  "soru_degistir": 3}
--   joker_30  → {"elli": 12, "sure": 9,  "soru_degistir": 9}
--   joker_100 → {"elli": 40, "sure": 30, "soru_degistir": 30}
-- Ama `joker_ekle` hâlâ yalnız ('elli','sure','pas','seri_koruma') kabul ediyordu.
--
-- Sonuç: `satin_alma_isle` (mağaza / gerçek para yolu) ile alınan HER joker paketi
-- "Geçersiz joker türü" hatasıyla düşerdi. Coin ile alma yolu (`joker_coin_ile_al`)
-- `joker_hareket`'i doğrudan çağırdığı için etkilenmiyor — canlıda denendi, çalışıyor.
-- Bu yüzden kusur bugüne kadar görünmedi: mağaza yolu henüz açık değil.
--
-- Eski 'pas' değeri listede BIRAKILIYOR: joker_envanter kısıtı hâlâ kabul ediyor ve
-- geçmiş kayıtlar bozulmasın.

create or replace function public.joker_ekle(
  p_user uuid, p_tur text, p_adet integer,
  p_kaynak text default 'satin_alma', p_ref text default null
) returns integer
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_adet <= 0 then raise exception 'Adet pozitif olmalı'; end if;
  if p_tur not in ('elli', 'sure', 'pas', 'soru_degistir', 'seri_koruma') then
    raise exception 'Geçersiz joker türü';
  end if;
  return public.joker_hareket(p_user, p_tur, p_adet, p_kaynak, p_ref);
end;
$function$;
