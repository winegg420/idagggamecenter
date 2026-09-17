-- ============================================================
-- PAKET 18 §D — Atkı ve Kanat satışa açıldı (sahibi fiyat kararı)
--
-- Modeller karakter GLB'lerinde zaten vardı (kozmetik_atki, kozmetik_kanat); vitrinde "Yakında" kilitliydi.
-- Fiyatlar KATALOGDA (avatar3d_parcalar.coin_fiyat) — koda gömülü değil, SQL ile değişir:
--   Atkı  400 coin   · sıradan aralık 300–600, küçük, efektsiz
--   Kanat 2.000 coin · özel; oyundaki tek süzülme kozmetiği + parıltı VFX (vfx.js RECETE.kanat)
-- Kanat OYNANIŞI DEĞİŞTİRMEZ ("para ile güç satılmaz"): koordinat, çarpışma, hız aynı; yalnız çizilen gövde süzülür
-- (karakter.js kare), temas gölgesi zeminde kalır.
-- Kanat ile Pelerin birlikte takılabilir (sırt yuvasında görsel olarak ayrışıyor — Paket 18 raporunda görüntü).
-- ============================================================

-- Eski gardırop parça tablosunun yuva listesi bu iki yuvayı tanımıyordu; genişletilir (değer silinmez).
alter table public.avatar3d_parcalar drop constraint if exists avatar3d_parcalar_yuva_check;
alter table public.avatar3d_parcalar add constraint avatar3d_parcalar_yuva_check
  check (yuva = any (array['sac','kiyafet','alt','ayakkabi','bas','gozluk','sakal','pelerin','kolye','saat','kupe','atki','kanat']));

insert into public.avatar3d_parcalar (id, ad, yuva, deger, coin_fiyat, nadirlik, sira, aktif) values
  ('boyun_atki', 'Atkı',  'atki',  to_jsonb('atki'::text),  400,  'sirali', 1, true),
  ('sirt_kanat', 'Kanat', 'kanat', to_jsonb('kanat'::text), 2000, 'ozel',   1, true)
on conflict (id) do nothing;

update public.vitrin_kozmetikleri
   set durum = 'aktif', parcalar = '{boyun_atki}', satis_parca = 'boyun_atki', aciklama = null
 where kod = 'atki';
update public.vitrin_kozmetikleri
   set durum = 'aktif', parcalar = '{sirt_kanat}', satis_parca = 'sirt_kanat', aciklama = 'Süzülme + parıltı'
 where kod = 'kanat';
