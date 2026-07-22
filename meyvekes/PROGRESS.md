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
