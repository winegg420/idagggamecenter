-- ============================================================
-- 57 — SORU KALİTESİ TARAMASI
--
-- Bozuk soruları SİLMEZ, `aktif = false` yaparak pasife alır. `questions.aktif`
-- kolonu zaten vardı ve soru çeken tek nokta (`soru_sec`) onu filtreliyor;
-- ek şema değişikliği gerekmedi. Pasife alınan sorular geçmiş maçlarda
-- referans olarak durmaya devam eder (silinseydi eski maçlar bozulurdu).
--
-- TARAMA SONUÇLARI (canlı veritabanı, 3.201 aktif soru):
--   * anlamsiz_degil_kalibi : 6  — eski üretimden kalma "X değil, Y" kalıbı
--                                  (ör. "'Kaç Para Kaç' değil, 'Vizontele' ...")
--   * meta_sik              : 2  — şıklardan biri "Hiçbiri"/"Hepsi" (belirsiz)
--   TOPLAM PASİFE ALINAN    : 8
--
-- BİLEREK DOKUNULMAYANLAR (tarama uyarı verdi ama sorular SAĞLAM):
--   * "3'ten kısa şık" (265 soru): "Na", "K", "C", "Ud", "Ney", "Su", "At" gibi
--     tamamen geçerli cevaplar ve sayısal şıklar. Körlemesine pasife almak
--     yüzlerce sağlam soruyu yok ederdi.
--   * "parantezli şık" (37 soru): "Boşluk (space)" gibi meşru kullanımlar;
--     kapanmamış parantez hiç bulunmadı.
--   * "yanlış" geçen şık (0), boş şık (0), tekrar eden şık (0),
--     soru işareti eksiği (0), 4'ten farklı şık sayısı (0).
-- ============================================================

-- Kuralları deterministik olarak yeniden uygular (tekrar çalıştırılabilir).
with s as (
  select q.id, q.soru,
         (select array_agg(x.value::text)
            from jsonb_array_elements_text(q.secenekler) x(value)) as sik
  from public.questions q
  where q.aktif
), bozuk as (
  select id from s
  where
    -- 1) Anlamsız "X değil, Y" kalıbı ve iç içe soru
    soru ilike '%değil,%'
    or soru ilike '% DEĞİL%'
    or soru ilike '%sorusunda%'
    -- 2) Belirsiz meta şık
    or exists (
      select 1 from unnest(sik) k
      where lower(btrim(k)) in ('hiçbiri', 'hicbiri', 'hepsi',
                                'yukarıdakilerin hiçbiri', 'yukarıdakilerin hepsi')
    )
    -- 3) Yapısal bozukluklar
    or exists (select 1 from unnest(sik) k where btrim(k) = '')
    or (select count(distinct lower(btrim(k))) from unnest(sik) k) < 4
    or btrim(soru) not like '%?'
    or exists (select 1 from unnest(sik) k where k like '%(%' and k not like '%)%')
)
update public.questions q
   set aktif = false
  from bozuk b
 where q.id = b.id;

-- Pasife alınan soruların "görüldü" kaydı kalabilir; zararsızdır
-- (soru_sec zaten aktif olmayanları hiç seçmez).

-- ---------- Denetim: kaç soru kaldı? ----------
do $$
declare
  v_aktif int;
  v_pasif int;
begin
  select count(*) filter (where aktif), count(*) filter (where not aktif)
    into v_aktif, v_pasif
  from public.questions;
  raise notice 'Soru havuzu: % aktif, % pasif', v_aktif, v_pasif;
end $$;
