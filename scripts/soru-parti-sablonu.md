# Soru Partisi Şablonu (Bildim!)

Bu dosya, **500'lük soru partileri** üreten oturumlar için tekrar kullanılabilir prompt +
migration şablonudur. Hedef: soru havuzunu **10.000** soruya çıkarmak.
Her parti ayrı bir migration dosyasıdır; mevcut migration'lar **düzenlenmez**.

---

## 1. Mevcut durum (8 Eylül 2026 — **canlı veritabanından okundu**)

> `select kategori, count(*) from public.questions where aktif group by kategori order by 2 desc;`
> Tümü `dil = 'tr'`.

| Kategori     | Mevcut | 10.000 hedefi | Eklenecek |
|--------------|-------:|--------------:|----------:|
| bilim        | 329    | 1.000         | 671       |
| tarih        | 266    | 1.000         | 734       |
| genel        | 221    | 1.000         | 779       |
| cografya     | 217    | 1.000         | 783       |
| edebiyat     | 172    | 1.000         | 828       |
| spor         | 161    | 1.000         | 839       |
| sanat        | 136    | 1.000         | 864       |
| sinema       | 55     | 1.000         | 945       |
| teknoloji    | 54     | 1.000         | 946       |
| muzik        | 54     | 1.000         | 946       |
| karisik      | 36     | (kategori değil, dağıtılacak) | — |
| **TOPLAM**   | **1.701** | **10.000** | **~8.300** |

**Karar:** 10 kategori × ~1.000 soru. `karisik` ayrı bir kategori olarak büyütülmez;
yeni sorular 10 gerçek kategoriye dağıtılır (kullanıcı "karışık" modu zaten kategori
seçmeyerek oynar). Mevcut `karisik` satırlarına dokunulmaz.

**Parti planı:** ~17 parti × 500 soru. Her partide tek kategori ya da en çok 2 kategori
olsun — hem doğrulaması hem tekrar kontrolü kolay olur.

---

## 2. Parti üretim promptu (kopyala-yapıştır)

> Aşağıdaki `{KATEGORI}`, `{PARTI_NO}` ve `{MIGRATION_NO}` alanlarını doldur.

```
Bildim! bilgi yarışması için {KATEGORI} kategorisinde 500 Türkçe çoktan seçmeli soru üret.

KURALLAR
- Dil: Türkçe. Sorular kısa, tek cümle, net; belirsiz/tartışmalı ifade yok.
- Her soruda tam 4 şık. Şıklar birbirine yakın uzunlukta, hepsi makul görünsün
  (bariz saçma çeldirici yok).
- Zorluk dağılımı: %40 kolay (200), %40 orta (200), %20 zor (100).
  Kolay = ortaokul düzeyi genel kültür. Zor = konuya ilgi duyan birinin bileceği ayrıntı.
- Doğru şık dengesi: doğru cevap indeksleri 0/1/2/3 arasında yaklaşık eşit dağılsın
  (her biri ~125 kez). Migration sonundaki karıştırma adımı bunu ayrıca garanti eder,
  ama üretirken de dengeli yaz.
- Zamana bağlı ("şu anki cumhurbaşkanı", "son dünya şampiyonu") soru YOK — cevabı
  yıllar sonra da doğru kalacak sorular yaz.
- Kişisel/hassas içerik, siyasi tartışma, dini hüküm sorusu yok.
- Tarih/sayı içeren sorularda kaynak kontrolü yap; emin olmadığın soruyu yazma.
- Soru metinlerinde tek tırnak varsa SQL için '' olarak kaçır (ör. Osmanlı''nın).

ÇIKTI BİÇİMİ
Sadece SQL üret; `supabase/migrations/{MIGRATION_NO}_soru_parti{PARTI_NO}_{KATEGORI}.sql`
dosyasının tam içeriği olsun. Aşağıdaki iskeleti birebir kullan.
```

---

## 3. Migration iskeleti

```sql
-- ============================================================
-- Soru Partisi {PARTI_NO} — {KATEGORI} (500 soru)
-- Zorluk: %40 kolay / %40 orta / %20 zor
-- ============================================================

insert into public.questions (soru, secenekler, dogru_cevap, kategori) values
-- ===================== KOLAY (200) =====================
('Soru metni?', '["Doğru","Çeldirici 1","Çeldirici 2","Çeldirici 3"]'::jsonb, 0, '{KATEGORI}'),
-- ...
-- ===================== ORTA (200) ======================
-- ...
-- ===================== ZOR (100) =======================
-- ...
('Son soru?', '["A","B","C","D"]'::jsonb, 2, '{KATEGORI}')
on conflict (soru) do nothing;

-- Doğru cevap hep aynı şıkta olmasın: SADECE bu partide eklenen soruların
-- şıklarını karıştır (parti 9'daki yöntem). Yeni sorular henüz hiçbir aktif
-- maçta yer almadığı için devam eden maçlar etkilenmez.
with karisik as (
  select q.id,
         jsonb_agg(s.value order by s.rnd) as yeni_secenekler,
         (array_position(array_agg(s.idx order by s.rnd), q.dogru_cevap::int) - 1)::smallint as yeni_dogru
  from public.questions q
  cross join lateral (
    select value, (ordinality - 1)::int as idx, random() as rnd
    from jsonb_array_elements(q.secenekler) with ordinality
  ) s
  where q.created_at >= transaction_timestamp()
  group by q.id, q.dogru_cevap
)
update public.questions q
   set secenekler = k.yeni_secenekler,
       dogru_cevap = k.yeni_dogru
  from karisik k
 where q.id = k.id;
```

> **Dikkat:** `where q.created_at >= transaction_timestamp()` satırı ZORUNLUDUR.
> Onsuz tüm havuzun şıkları karışır ve o an oynanan maçlarda şık indeksleri kayar.
>
> **Dil kolonu:** `questions.dil` varsayılanı `'tr'`. Türkçe partilerde yazmaya gerek yok.
> Başka dilde parti üretilirse `insert` kolon listesine `dil` eklenip `'en'` gibi verilmeli.

---

## 4. Parti ÖNCESİ tekrar kontrolü (zorunlu adım)

`soru` kolonu UNIQUE olduğu için birebir aynı metin zaten eklenmez; asıl risk **aynı soruyu
farklı kelimelerle** tekrar yazmaktır. Parti dosyasını yazmadan önce Supabase Studio'da
şunu çalıştır ve çıkan listeyi prompta "bunları tekrar etme" diye ver:

```sql
-- O kategorideki mevcut soruların normalize edilmiş anahtar kelimeleri
select lower(regexp_replace(soru, '[^[:alnum:] ]', '', 'g')) as normal
from public.questions
where aktif and kategori = '{KATEGORI}'
order by 1;
```

Parti dosyası hazır olduğunda, **uygulamadan önce** çakışma taraması:

```sql
-- Yeni partideki metinlerin mevcutlarla anahtar kelime örtüşmesi
-- (dosyayı geçici tabloya yükleyip çalıştır)
create temp table yeni_sorular (soru text);
-- \copy ya da insert ile parti sorularının SADECE metinlerini yükle

select y.soru, q.soru as benzer_mevcut
from yeni_sorular y
join public.questions q
  on similarity(
       lower(regexp_replace(y.soru, '[^[:alnum:] ]', '', 'g')),
       lower(regexp_replace(q.soru, '[^[:alnum:] ]', '', 'g'))
     ) > 0.55
where q.aktif;
-- Not: pg_trgm gerekir → create extension if not exists pg_trgm;
```

Eşleşenler elenir ya da yeniden yazılır; sonra migration uygulanır.

---

## 5. Parti sonrası doğrulama

```sql
-- 1) Kategori dağılımı
select kategori, count(*) from public.questions where aktif group by kategori order by 2 desc;

-- 2) Doğru şık dengesi (0/1/2/3 yaklaşık eşit olmalı)
select dogru_cevap, count(*) from public.questions where aktif group by 1 order by 1;

-- 3) Bozuk kayıt var mı (4 şık değilse)
select id, soru from public.questions where jsonb_array_length(secenekler) <> 4;

-- 4) Toplam
select count(*) from public.questions where aktif;
```

---

## 6. Parti kayıt defteri

Her parti uygulandıktan sonra bu tabloya bir satır ekle.

| Parti | Migration | Kategori | Adet | Tarih | Not |
|------:|-----------|----------|-----:|-------|-----|
| 1-9   | 000014-000033 | karışık | ~1.700 | 2026-06/07 | mevcut havuz |
| 10    |           |          |      |       |     |
