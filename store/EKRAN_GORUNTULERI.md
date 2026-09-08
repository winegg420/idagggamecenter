# Bildim! — Ekran görüntüsü planı (Play Store)

Play, telefon için **en az 2, en fazla 8** ekran görüntüsü ister.
Önerilen boyut: **1080×1920** (9:16, portrait). Her görüntünün üstüne
kısa bir başlık bindirilir (aşağıdaki "Başlık" sütunu).

Çekim: Chrome DevTools → cihaz modu → "Pixel 5" (393×851) → yakınlaştırma %100 →
ekran görüntüsü → 1080×1920'ye ölçekle.

| # | Sayfa | Yol | Başlık (görüntü üstüne) |
|---|---|---|---|
| 1 | Ana sayfa (hero + mod kartları) | `/bildim` | **Bilgini kanıtla** |
| 2 | Maç ekranı (soru + 4 şık + joker) | `/bildim/mac/:id` | **20 soruluk kapışma** |
| 3 | Maç sonucu (kazandın + konfeti) | `/bildim/mac/:id` (bitmiş) | **Rakibini yen, puanı topla** |
| 4 | Lig — podyum | `/bildim/siralama` | **Şehrini zirveye taşı** |
| 5 | Meydan Oku — kategoriler | `/bildim/meydan` | **10 kategori, 5.000+ soru** |
| 6 | Turnuva lobisi / geri sayım | `/bildim/turnuva` | **Her gün iki büyük turnuva** |
| 7 | Hızlı Mod (60 sn sayaç) | `/bildim/hizli-mod` | **60 saniyede kaç doğru?** |
| 8 | Profil — rozetler + ustalık | `/bildim/profil` | **Ustalığını göster** |

## Notlar
- Ekran görüntülerinde **gerçek takma adlar** görünmesin; test hesabı kullan.
- Bot satırlarındaki 🤖 rozeti kalabilir, sorun değil.
- Yatay (tablet) görüntü zorunlu değil; TWA portrait kilitli.
- Uygulama içi satın alma ekranı görüntüsü koyma (Play politikası gereği
  fiyat gösterimi yanıltıcı olabilir).
