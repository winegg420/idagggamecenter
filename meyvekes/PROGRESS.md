# Meyve Kes — Modül İlerleme Günlüğü

> Özet günlük. **Ayrıntılı oturum-oturum geçmiş** repo kökü `PROGRESS.md`'de (2026-07-22 oturumları).

## Modül durumu

- **Oynanış:** Tekli (2 el) + Arkadaşla (yerel, 4 el, sol/sağ ayrı skor). Faz makinesi (geri 3-2-1 → oyun 60sn → bitti), yerçekimi fiziği, combo (0.55sn penceresi), altın meyve bonusu, ceza yok.
- **El takibi:** MediaPipe Tasks Vision `HandLandmarker` (GPU, CPU fallback), video karesini doğrudan işler. Kesim = kimlik eşleştirmeli el takibi + 7 anahtar nokta segmenti meyve hitbox'ıyla kesişince.
- **Render:** kamera (cover, aynalı) + meyveler/yarımlar/parçacıklar/bıçak izi + **tam el iskeleti** (görsel teşhis) + "🖐 el görünmüyor" rozeti.

## Kök-neden düzeltmeleri (2026-07-22)

1. **Kasma:** legacy `@mediapipe/hands` (ana thread WASM blok) → **Tasks Vision GPU** (senkron detectForVideo + self-throttle).
2. **Kesememe:** sabit 320x240 çıkarım karesi 16:9 kamerada aspect bozup landmark'ları kaydırıyordu → **video doğrudan işlenir** (kayma yok).
3. **Teşhis:** el iskeleti + el sayacı rozeti eklendi.

## Migration (repo kökü)

- `20260612000038_meyvekes_temel.sql` — `meyvekes_skorlar` + `meyvekes_skor_kaydet` / `meyvekes_siralama` RPC'leri. `en_iyi` birleşik sıralamaya katılır.

## Test

`node meyvekes/_test/motor-test.mjs` → 11 test (son: 11/11 ✓). CDN URL'leri (vision_bundle.mjs + wasm + model.task) doğrulandı.

## Kalan / manuel

- **Gerçek kamera + el testi kullanıcıda** (otomasyonda kamera yok): iskelet elde mi, "🖐" rozeti yanıyor mu, meyve kesiliyor mu, kasma var mı.
- Gerçek meyve fotoğrafları istenirse `public/meyve/` + manifest (şu an emoji sprite ile tam çalışır).

## 2026-07-24 — Kol=bıçak, gecikme telafisi, agresif savurma

Kullanıcı: "eller kollar komple bıçak olmalı; el kadrajdan çıkıp girince hemen senkron olmalı;
meyveleri hızlı kesemiyorum, koca bıçakları çılgınca savurmak istiyorum."

- **Kılıç modeli:** kol, bilek→avuç ekseninin tersine türetilir (`KOL_ORAN 3.4` × el boyu), uç
  parmak ucundan ileri uzatılır (`UC_ORAN 1.35`). Kesim = kılıç boyunca 9 örnek + 5 parmak ucu
  segmentleri. El hızı > 360 px/s ise **kılıç gövdesinin tamamı** da keser (kareler arası boşluk
  sorunu). `MAX_ORAN` 1.05, `MIN_SEGMENT` 6, `KILIC_KALINLIK` 34.
- **Gecikme telafisi:** `eltakip.gecikmeSn` (kare yaşı + çıkarım + yarım kare) kadar el ileri
  sarılır (tavan 100 px); çizimde ayrıca 50 ms'e kadar ekstrapolasyon. Render artık ham landmark
  değil **motor geometrisini** çizer → görülen bıçak = kesen bıçak.
- **Yeniden yakalama:** MediaPipe eşikleri 0.3; döngü `requestVideoFrameCallback` ile kare-güdümlü;
  aynı video karesi iki kez işlenmez; kamera `frameRate ideal 60`.
- **Görsel:** `kilicCiz` (hâle/gövde/çekirdek 3 katman pala), iskelet inceltildi (daha ucuz), iz
  kılıç ucundan çıkıyor. Spawn temposu artırıldı (tekli 0.80→0.50, arkadaş 0.52→0.32).
- **Test:** motor-test 16/16 ✓ (yeni: kol bıçağı, gecikme telafisi, kadraj dışı→geri dönüş).
  `_test/kilic-test.html` — kamera/oturum gerektirmeyen görsel test (Chrome'da doğrulandı).
- **Kalan:** gerçek kamera + iPhone testi kullanıcıda.

---

## 25 Temmuz 2026 — Fruit Ninja bıçak izi + boşta bıçak yok + kasma

Kullanıcı geri bildirimi: (1) el dururken bıçak görünmemeli, (2) bıçak efekti "elektrik gibi berbat" → Fruit Ninja izi, (3) hâlâ kasma.

- **Elektrik efekti kaldırıldı:** Her algılanan el için sürekli çizilen dev enerji-kılıcı (`kilicCiz`) + el iskeleti (`elIskeletCiz`) silindi. Bunlar el hareketsizken bile landmark jitter'ıyla titreyip "elektrik" görüntüsü veriyordu. Artık gerçek kol zaten kamerada görünür; üzerine sadece iz çizilir.
- **Fruit Ninja izi (`render.js izCiz` yeniden yazıldı):** Uçlarda sivri, ortada dolgun BEYAZ pala şeridi + altında mavimsi additif parıltı (shadowBlur yok → mobilde ucuz). Tazelikle incelir, 0.18 sn'de söner.
- **Boşta bıçak yok (`oyun.js`):** İz noktası artık orta parmak ucundan (elin doğal öncü noktası) ve YALNIZ son noktadan >5px hareket varsa eklenir (`IZ_MIN_HAREKET`). El dururken yeni nokta eklenmez, mevcut noktalar kısa sürede söner → ekranda hiç iz kalmaz. Kesim mantığı (kol bıçağı + MIN_SEGMENT) değişmedi.
- **Kasma:** `eltakip.js` throttle'ı çıkarım süresinin ~1.8 katına çıkarıldı (eski: 1×, tavan 110ms → yeni: 1.8×, tavan 150ms). detectForVideo ana thread'de senkron olduğundan yavaş/CPU cihazda süresi boyunca render donuyordu; artık daha seyrek işlenip ana thread'e nefes bırakılıyor (kasma yerine akıcı render).

**Test:** motor-test 16/16 ✓ (kesim/kol bıçağı/statik el/gecikme telafisi regresyonsuz). `npm run build` temiz (bundle 24.5→23.8 KB).
