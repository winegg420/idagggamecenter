# BİLDİM — Görev 4: Soru kütüphanesini 2.000 soru zenginleştirme

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Hedef: **her kategoriye 200 soru → toplam 2.000**. Havuz 3.193 → ~5.193.
>
> **Kalite şartı (pazarlıksız):** tek ve tartışmasız doğru cevap; zamanla değişen
> bilgi yok; yoruma açık ifade yok; mevcut havuzla tekrar yok; emin olmadığın
> soruyu YAZMA. Her parti otomatik denetimden geçer.

## Dağılım (her kategoriye 200)
| Kategori | Mevcut | +Yeni | Sonuç |
|---|---:|---:|---:|
| genel_kultur | 1154 | 200 | 1354 |
| bilim | 396 | 200 | 596 |
| tarih | 334 | 200 | 534 |
| cografya | 285 | 200 | 485 |
| edebiyat | 237 | 200 | 437 |
| spor | 226 | 200 | 426 |
| sanat | 200 | 200 | 400 |
| sinema | 120 | 200 | 320 |
| teknoloji | 120 | 200 | 320 |
| muzik | 120 | 200 | 320 |

## Faz 0 — Hazırlık
- [x] `BILDIM_GOREV4.md` oluşturuldu
- [x] Canlı DB'den güncel soru listesi çekildi (`mevcut-sorular.txt`)
- [x] Denetim araçları hazır (denetle / temizle / birebir / tamamla / ekle-dengele)

## Faz 1 — Parti 13: `20260612000059_soru_parti13.sql` (500)
- [x] 1.1 genel_kultur 200 + bilim 200 + tarih 100 yazıldı
- [x] 1.2 Denetim temiz (çakışma 0, hata 0, doğru şık dengeli)
- [x] 1.3 Canlı DB'de rollback provası: 500/500 eklendi

## Faz 2 — Parti 14: `20260612000060_soru_parti14.sql` (500)
- [x] 2.1 tarih 100 + cografya 200 + edebiyat 200 yazıldı
- [x] 2.2 Denetim temiz
- [x] 2.3 Rollback provası: 500/500

## Faz 3 — Parti 15: `20260612000061_soru_parti15.sql` (500)
- [x] 3.1 spor 200 + sanat 200 + sinema 100 yazıldı
- [x] 3.2 Denetim temiz
- [x] 3.3 Rollback provası: 500/500

## Faz 4 — Parti 16: `20260612000062_soru_parti16.sql` (500)
- [x] 4.1 sinema 100 + teknoloji 200 + muzik 200 yazıldı
- [x] 4.2 Denetim temiz
- [x] 4.3 Rollback provası: 500/500

## Faz 5 — Kapanış
- [x] 5.1 Dört parti birlikte prova: 2000/2000
- [x] 5.2 Migration'lar canlıya uygulandı (059 → 060 → 061 → 062) ve geçmişe kaydedildi
- [x] 5.3 Kategori dağılımı doğrulandı
- [x] 5.4 `npm run build` temiz
- [x] 5.5 PROGRESS.md raporu (üretilen/elenen, dağılım) + commit
