-- Paket 27 — 238'in test sırasında yakalanan iki kusuru.
--
-- 1) `joker_islemleri.kaynak` kısıtı yalnız altı değer tanıyordu
--    ('ucretsiz','reklam','satin_alma','kullanim','seri','hediye').
--    238'in başlangıç jokeri 'baslangic', 239'un maç içi satın alması 'mac_ici'
--    yazıyor → kısıt ihlali. İki değer ekleniyor (kısıt genişletiliyor, veri
--    silinmiyor). Ayrı kaynak adları bilerek: "maç içi satış ne kadar tuttu"
--    sorusu joker tarafından da ölçülebilsin.
--
-- 2) DAHA ÖNEMLİSİ: `handle_new_user` içindeki tek `exception when others`
--    bloğu coin, eşya, karakter ve joker ödüllerinin HEPSİNİ kapsıyordu.
--    plpgsql'de bu blok örtük bir alt-işlemdir: içindeki HERHANGİ bir çağrı
--    hata verirse bloğun BAŞINA kadar her şey geri alınır. Yani joker verme
--    kısıt yüzünden patlayınca yeni oyuncunun COIN'i de eşyası da geri alınıyordu
--    — testte yakalandı, canlıda bu aralıkta hesap açılmadığı için kimse
--    etkilenmedi (ölçüldü: 0 yeni profil).
--    Her ödül artık KENDİ bloğunda: biri düşerse diğerleri ayakta kalır.

alter table public.joker_islemleri drop constraint if exists joker_islemleri_kaynak_check;
alter table public.joker_islemleri add constraint joker_islemleri_kaynak_check
  check (kaynak = any (array[
    'ucretsiz', 'reklam', 'satin_alma', 'kullanim', 'seri', 'hediye',
    'baslangic',   -- Paket 27 A: hesap açılışında verilen stok
    'mac_ici'      -- Paket 27 C: maç içinde satın alınan joker
  ]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, username, avatar_url, provider, davet_kodu)
  values (
    new.id,
    'oyuncu_' || substr(md5(new.id::text || random()::text), 1, 8),
    null,                                    -- Google fotoğrafı ALINMAZ
    new.raw_app_meta_data->>'provider',
    public.yeni_davet_kodu()
  );

  -- Her ödül AYRI blokta. Tek blok olsaydı birinin hatası ötekileri de geri alırdı
  -- (plpgsql'de exception bloğu örtük alt-işlemdir) — Paket 27'de tam bu oldu.
  begin perform public.coin_ekle(new.id, public.ayar_sayi('coin_baslangic', 300), 'baslangic', null);
  exception when others then null; end;

  begin perform public.ucretsiz_esyalari_ver(new.id);
  exception when others then null; end;

  begin perform public.ucretsiz_karakter_ve_parca_ver(new.id);
  exception when others then null; end;

  begin perform public.baslangic_jokerleri_ver(new.id);   -- Paket 27 A
  exception when others then null; end;

  return new;
end;
$function$;
