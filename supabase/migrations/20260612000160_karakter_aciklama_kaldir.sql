-- ============================================================
-- KARAKTER TANITIM METİNLERİ KALDIRILDI
--
-- karakterler.aciklama değerleri PatiRun'dan (yarış oyunu) taşınmıştı:
-- "Plajdan yarışa geldi", "Isınma turu diye pisti üç kez koştu",
-- "Her checkpoint'te yeni bir dörtlük yazıyor"… Bilgi yarışmasında
-- anlamsız kalıyor. Yeni metin yazılmıyor, alan boşaltılıyor.
--
-- Kolon DÜŞÜRÜLMÜYOR: karakter_katalogum RPC'si onu döndürüyor ve
-- ileride gerekirse yeniden doldurulabilir. Arayüz artık göstermiyor.
-- ============================================================

-- Kolon not null kurulmuştu; boşaltabilmek için kısıt kalkıyor.
alter table public.karakterler alter column aciklama drop not null;
alter table public.karakterler alter column aciklama drop default;

update public.karakterler set aciklama = null where aciklama is not null;
