-- ============================================================================
-- DÜZELTME: Noktalama farkıyla ikizlenmiş sorular
--
-- BELİRTİ: Oyuncu tek maçta aynı soruyu iki kez görebiliyordu; "Hatalarım"da
-- bir ikizi öğrenip diğerini bankasında bulmaya devam ediyordu.
--
-- KÖK NEDEN: questions.soru sütunu UNIQUE olduğu için BİREBİR aynı metinler
-- engelleniyor, ama tırnak/tire/boşluk farkı olanlar farklı satır sayılıyor:
--   "'Guernica' tablosunun ressamı kimdir?"  ve
--   '"Guernica" tablosunun ressamı kimdir?'
-- Denetimde 15 çift (30 soru) bulundu. Biri kategori bile değiştirmiş
-- (Stop motion: sinema + sanat).
--
-- KARAR: Soru SİLİNMİYOR, yalnız `aktif = false` yapılıyor — silmek
-- match_answers / yanlis_sorular gibi geçmiş kayıtları öksüz bırakırdı.
-- Her çiftte EN ESKİ kayıt korunuyor (özgün olan), sonradan eklenen ikiz
-- pasifleştiriliyor. Doğrulandı: 30 sorunun tamamında toplam_oy = 0, yani
-- hiçbiri oylanmamış; kalite verisi kaybı yok.
--
-- Not: Kalıcı çözüm için üretim akışına normalize edilmiş benzersizlik
-- kontrolü eklenmeli; bu dosya yalnız mevcut kirliliği temizler.
-- ============================================================================

with normalize as (
  select id,
         created_at,
         lower(regexp_replace(soru, '[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]', '', 'g')) as anahtar
  from public.questions
  where aktif
),
gruplar as (
  select anahtar from normalize group by anahtar having count(*) > 1
),
korunacak as (
  -- Her gruptan en eski kayıt kalır
  select distinct on (n.anahtar) n.id
  from normalize n
  join gruplar g on g.anahtar = n.anahtar
  order by n.anahtar, n.created_at asc, n.id asc
)
update public.questions q
   set aktif = false
  from normalize n
  join gruplar g on g.anahtar = n.anahtar
 where q.id = n.id
   and q.aktif
   and n.id not in (select id from korunacak);
