-- ============================================================
-- ARKADAŞ EKLEME ÇALIŞMIYORDU (KRİTİK)
--
-- Hata: `column reference "gorunen_ad" is ambiguous`
--
-- Kök neden: `arkadas_davet_kodu_ile_ekle` fonksiyonu
--   returns table (durum text, gorunen_ad text)
-- tanımlıyor; gövdede bildirim metni kurulurken
--   (select gorunen_ad from public.profiles where id = auth.uid())
-- NİTELİKSİZ yazılmış. `gorunen_ad` hem out-parametre hem kolon olduğu için
-- PL/pgSQL karar veremiyor ve fonksiyon patlıyor.
--
-- Etkisi: davet kodu/linki ile arkadaş eklemenin ÜÇ yolundan ikisi
-- ("arkadas_oldu" ve "istek_gonderildi") tamamen kırıktı; yalnız
-- "zaten_arkadas" yolu çalışıyordu (o dalda alt sorgu yok). Yani pratikte
-- hiç kimse arkadaş ekleyemiyordu.
--
-- Düzeltme: alt sorgular tablo takma adıyla nitelendirildi ve fonksiyona
-- `#variable_conflict use_column` eklendi (aynı sınıf hataya karşı kalkan).
--
-- Not: Bu, aynı desendeki üçüncü hata (önce `hizli_mod_cevap.dogru`).
-- Diğer `returns table` fonksiyonları da tarandı; sonuç PROGRESS.md'de.
-- ============================================================

create or replace function public.arkadas_davet_kodu_ile_ekle(p_kod text)
returns table (durum text, gorunen_ad text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hedef public.profiles%rowtype;
  v_kod text;
  v_ters uuid;
  v_mevcut text;
  v_ben_ad text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_kod := upper(btrim(coalesce(p_kod, '')));
  if length(v_kod) <> 8 then raise exception 'Davet kodu 8 karakter olmalı.'; end if;

  select * into v_hedef from public.profiles p where p.davet_kodu = v_kod;
  if not found then raise exception 'Böyle bir davet kodu yok.'; end if;
  if v_hedef.id = auth.uid() then raise exception 'Kendi davet kodunu kullanamazsın.'; end if;
  if coalesce(v_hedef.is_bot, false) then raise exception 'Bu kod kullanılamaz.'; end if;

  -- Kendi görünen adımızı bir kez, NİTELİKLİ olarak alalım
  select me.gorunen_ad into v_ben_ad
    from public.profiles me where me.id = auth.uid();

  select f.durum into v_mevcut from public.friendships f
  where (f.requester = auth.uid() and f.addressee = v_hedef.id)
     or (f.requester = v_hedef.id and f.addressee = auth.uid());

  if v_mevcut = 'arkadas' then
    return query select 'zaten_arkadas'::text, v_hedef.gorunen_ad;
    return;
  end if;

  -- Karşı taraf zaten istek gönderdiyse doğrudan arkadaş ol
  select f.id into v_ters from public.friendships f
  where f.requester = v_hedef.id and f.addressee = auth.uid();
  if found then
    update public.friendships f set durum = 'arkadas' where f.id = v_ters;
    perform public.bildirim_yaz(
      v_hedef.id, 'arkadas_kabul',
      coalesce(v_ben_ad, 'Bir oyuncu') || ' arkadaşın oldu! 🤝',
      '/bildim/arkadaslar'
    );
    return query select 'arkadas_oldu'::text, v_hedef.gorunen_ad;
    return;
  end if;

  insert into public.friendships (requester, addressee)
  values (auth.uid(), v_hedef.id)
  on conflict (requester, addressee) do nothing;

  perform public.bildirim_yaz(
    v_hedef.id, 'arkadas_istek',
    coalesce(v_ben_ad, 'Bir oyuncu') || ' sana arkadaşlık isteği gönderdi.',
    '/bildim/arkadaslar'
  );

  return query select 'istek_gonderildi'::text, v_hedef.gorunen_ad;
end;
$$;

revoke execute on function public.arkadas_davet_kodu_ile_ekle(text) from public, anon;
grant execute on function public.arkadas_davet_kodu_ile_ekle(text) to authenticated;
