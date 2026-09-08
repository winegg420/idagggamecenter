# Bildim! — Play Billing ürünleri

Play Console → Monetize → Products → In-app products.
Ürün kimlikleri **birebir** aşağıdaki gibi olmalı; sunucu doğrulaması bu
kimliklere göre çalışır (`joker_paketleri` tablosu).

| Ürün kimliği | Ad | Açıklama | Önerilen fiyat |
|---|---|---|---|
| `joker_kucuk` | 5 Joker | 5 karışık joker | ₺29,99 |
| `joker_orta` | 15 Joker | 15 karışık joker (+%20 bonus) | ₺69,99 |
| `joker_buyuk` | 40 Joker | 40 karışık joker (+%33 bonus) | ₺149,99 |

> Kesin liste için veritabanındaki `joker_paketleri` tablosuna bak:
> `select kod, ad, adet from joker_paketleri order by adet;`
> Play'deki ürün kimliği = tablodaki `kod` sütunu.

## Kurulum sırası
1. Play Console'da uygulamayı bir kez **iç test** kanalına yükle
   (ürünler ancak yüklenmiş bir pakette tanımlanabilir).
2. Ürünleri yukarıdaki kimliklerle oluştur, etkinleştir.
3. Lisans test hesaplarını ekle (Setup → License testing) — test satın almaları
   ücretsiz olur.
4. Sunucu tarafı doğrulama için Play Developer API servis hesabı anahtarını
   Supabase secrets'a ekle.
