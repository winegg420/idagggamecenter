# Kafa Topu — Modül İlerleme Günlüğü

> Özet günlük. **Ayrıntılı oturum-oturum geçmiş** repo kökü `PROGRESS.md`'de (2026-07-15 → 07-17, ~20 oturum).

## Modül durumu

- **Oynanış:** 1v1 & 2v2, ranked (ELO, taban 1000) + hızlı maç, özel oda/davet, antrenman botu (rakip seçimli). Ligler: Bronz/Gümüş/Altın/Platin/Elmas.
- **Fizik:** Matter.js, saha 1000x560, Head Ball hissi (yerçekimi 2.0, zıplama tepe ~140px). Zıplama/uçma bug'ları kök-nedenden çözüldü (deterministik yerdeMi()).
- **Multiplayer:** host-otoriter, 20Hz durum yayını, interpolasyon, kopma telafisi (hükmen). Skor: iki-taraflı onay + `FOR UPDATE` (sahtecilik kapalı, migration `20260612000037`).
- **Foto kafalar:** İda + Baran + Aykut + Emirhan + Adenis — arka plan silme + karikatürize (v1: posterize+kontur) araç zinciri (`scripts/kafatopu-karikatur.mjs`). manifest odak/yarıçap ile daire kırpma.
- **Mobil/iOS:** native touch (çoklu parmak), webkit fullscreen, wake lock, alpha:false, statik sahne bake (kök-neden kasma düzeltmesi), fit-to-viewport/tam ekran, dokunmatik tuş ergonomisi (kullanıcı onaylı düzen).

## Migration'lar (repo kökü)

- `20260612000035_kafatopu_temel.sql` — profiller/kuyruk/maclar/mac_oyunculari + eşleşme/ELO RPC'leri
- `20260612000036_kafatopu_odalar.sql` — özel oda/davet
- `20260612000037_kafatopu_skor_onay.sql` — iki-taraflı skor onayı (sahtecilik kapatma)

## Test

`node kafatopu/_test/motor-test.mjs` → 27 test (son çalıştırma: 27/27 ✓). ELO JS eşleniği SQL ile senkron tutulur.

## Hub taşıması (2026-07-22)

idaGG Game Center'a entegre; ELO puanı birleşik sıralamaya (`birlesik_siralama()`) katılır. Ayrıntı kök `PROGRESS.md`.

## Kalan / manuel

- Gerçek 2 cihazla online 1v1/2v2 + kopma senaryosu testi (kullanıcıda).

## 2026-07-24 — Misafir tarafı takılma + girdi gecikmesi

- `net/interpolasyon.js`: sabit 120 ms tampon → **jitter'a adaptif** (70-260 ms; yukarı hızlı,
  aşağı yavaş uyum). Paket gecikirse son iki paketin hızıyla **90 ms'ye kadar ekstrapolasyon**
  (donma/zıplama yerine akış). Tek paket durumunda snap'in kopyası döner (tüketici mutasyonu
  orijinali bozmasın).
- `app/pages/MacPage.jsx`: misafirde **girdi gecikmesi maskeleme** — kendi kafan tuşa anında tepki
  verir; yalnız görsel yatay ofset, her karede `0.94^kare` sönümlenir, ±1.1 kafa yarıçapı ile
  sınırlı. Otorite host'ta kalır (skor/fizik değişmedi), sapma birikmez.
- Motor testleri 27/27 ✓ (regresyon yok). Gerçek 2 cihaz testi kullanıcıda.

---

## 24 Temmuz 2026 — 2 yeni foto kafa + görsel kasma düzeltmesi

`emirali` (Emir Ali) ve `bedo` (Bedo) `public/heads/manifest.json`'a eklendi. Görseller 2250×3000 / ~3 MB idi (yavaş operatörde kasma) → 825×1100 JPEG, ~120 KB (~25× küçük). Tam foto oldukları (şeffaflık yok, daireye kırpılıyor) için JPEG güvenli; manifest `.jpg`'ye güncellendi. Host-otoriter senkron modeli değişmedi (erken başlama sorunu bu oyunda yok).
