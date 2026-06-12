-- Şıkların sırasını rastgele karıştır (doğru cevap hep A olmasın).
-- NOT: Aktif maç yokken çalıştırılmalı; şık sırası değişince devam eden
-- sorulardaki indeksler kayar.

with karisik as (
  select q.id,
         jsonb_agg(s.value order by s.rnd) as yeni_secenekler,
         (array_position(array_agg(s.idx order by s.rnd), q.dogru_cevap::int) - 1)::smallint as yeni_dogru
  from public.questions q
  cross join lateral (
    select value, (ordinality - 1)::int as idx, random() as rnd
    from jsonb_array_elements(q.secenekler) with ordinality
  ) s
  group by q.id, q.dogru_cevap
)
update public.questions q
   set secenekler = k.yeni_secenekler,
       dogru_cevap = k.yeni_dogru
  from karisik k
 where q.id = k.id;
