-- ============================================================
-- ESKİ KOZMETİKLERİN COIN İADESİ
--
-- Tek karakter sistemine geçildi: 2B karakter/kozmetikler ve eski 3B
-- kozmetikler arayüzden kalktı, artık hiçbir yerde görünmüyorlar.
-- Onlara coin harcamış oyunculara ödedikleri tutar geri yazılır.
--
-- SAHİPLİK KAYITLARI SİLİNMEZ (`oyuncu_esyalari`, `oyuncu_karakterleri`):
-- ileride bir gün geri dönülürse ya da "eski koleksiyon" rozeti verilirse
-- lazım olur. Yalnız coin iade edilir.
--
-- ÖLÇÜM (uygulanmadan önce, canlı veritabanı):
--   2B kozmetik/karakter ücretli alım: 0 kayıt, 0 hesap, 0 coin
--     (2B kayıtların tamamı kaynak='baslangic', yani bedava verilmiş)
--   Eski 3B kozmetik ücretli alım: 2 kayıt, 2 hesap, 450 coin
--
-- YENİDEN ÇALIŞTIRILABİLİR: iade `coin_hareketleri`'ne 'eski_kozmetik_iade'
-- türüyle yazılır; aynı kayıt için ikinci kez iade yapılmaz.
-- Botlara iade gitmez (coin_ekle zaten botu reddediyor).
-- ============================================================

do $$
declare
  r record;
  v_sonuc bigint;
  v_hesap int := 0;
  v_toplam bigint := 0;
begin
  for r in
    -- Ücretli alınmış 2B eşyalar + eski 3B eşyalar
    select o.user_id, 'esya:' || o.esya_kod as referans, e.coin_fiyat as tutar
      from public.oyuncu_esyalari o
      join public.esyalar e on e.kod = o.esya_kod
      join public.profiles p on p.id = o.user_id
     where o.kaynak = 'satin'
       and coalesce(e.coin_fiyat, 0) > 0
       and not coalesce(p.is_bot, false)
    union all
    -- Ücretli alınmış 2B karakterler
    select k.user_id, 'karakter:' || k.karakter_id, c.coin_fiyat
      from public.oyuncu_karakterleri k
      join public.karakterler c on c.id = k.karakter_id
      join public.profiles p on p.id = k.user_id
     where k.kaynak = 'satin'
       and coalesce(c.coin_fiyat, 0) > 0
       and not coalesce(p.is_bot, false)
  loop
    -- Aynı kayıt için daha önce iade yapıldıysa atla
    if exists (
      select 1 from public.coin_hareketleri h
       where h.user_id = r.user_id
         and h.tur = 'eski_kozmetik_iade'
         and h.referans = r.referans
    ) then
      continue;
    end if;

    begin
      v_sonuc := public.coin_ekle(r.user_id, r.tutar, 'eski_kozmetik_iade', r.referans);
      if v_sonuc is not null then
        v_hesap := v_hesap + 1;
        v_toplam := v_toplam + r.tutar;
      end if;
    exception when others then
      -- Tek bir iade patlarsa migration düşmesin, kalanlar yapılsın.
      raise warning 'iade yapilamadi (% / %): %', r.user_id, r.referans, sqlerrm;
    end;
  end loop;

  raise notice 'Eski kozmetik iadesi: % kayit, % coin', v_hesap, v_toplam;
end $$;
