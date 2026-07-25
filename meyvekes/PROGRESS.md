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

---

## 25 Temmuz 2026 (2. oturum) — Efektler geri geldi + "Meyve Ye" modu

Kullanıcı: "efektler silinmiş, elimi hareket ettirdiğimde ekranda hiçbir şey olmuyor; meyve kesmeyi
en iyi haline getir; ayrıca tekli bir mod daha ekle: Meyve Ye — telefonu tek elle tut, meyveler aynı
şekilde gelsin, ağzımızı açıp yutalım."

### 1) Kök neden: iz noktaları algılama hızında üretiliyordu
Önceki oturumda iz noktası YALNIZ yeni algılama karesinde ve "son noktadan >5 px hareket" koşuluyla
ekleniyordu. Aynı oturumda throttle 1.8×/150 ms'e çıkarılınca algılama 8-12 fps'e düşebiliyor; 0.18 sn
iz ömrüne 1-2 nokta sığıyor, `izCiz` ise `n < 2` ise hiç çizmiyordu → **ekranda hiçbir efekt yok**.
Ek olarak eski taper formülünde son noktanın kalınlığı tam 0 oluyordu (2 noktalı izde görünmez şerit).

- **Çözüm:** iz noktaları artık **her çizim karesinde (60 fps)**, gecikme telafili konumdan üretilir.
  Ölçüt mesafe değil **el hızı** (`IZ_HIZ_ESIK = 90 px/s`); el görülmeyeli 0.12 sn'den fazla olduysa
  üretim durur. Ömür 0.18 → 0.30 sn, tavan 26 nokta. Duran elde hâlâ hiç iz yok.
- `render.js izCiz` yeniden yazıldı: Catmull-Rom yumuşatma + 3 katman (geniş mavi hale, iç parıltı,
  beyaz pala gövdesi), kuyrukta sivri/uçta dolgun profil, `IZ_MAKS_EN` 16 → 22.
- `eltakip.js` throttle 1.8×/150 ms → **1.5×/130 ms** (iz artık algılama fps'ine bağlı olmadığı için
  kasma riski yaratmadan kesim isabeti arttı).

### 2) Kesim "juice"i (istenen: en iyi hâli)
- Kesim anında: **bıçak yönünde beyaz flaş** (`slashlar`), **halka dalgası** (`dalgalar`),
  **ekran sarsıntısı** (`sarsinti`, hızla söner), **titreşim** (`navigator.vibrate`).
- Yarımlar artık kesim çizgisine **dik** ayrılıyor ve kesik yüzeyi bıçağın geçtiği açıda duruyor
  (`kesimAci`; render'da clip kesim açısıyla, sprite meyvenin kendi açısıyla çizilir).
- **Ses:** `engine/ses.js` — WebAudio ile sentezlenen kes/altın/combo/yut/bitti efektleri (dosya yok).
  Motor DOM'a dokunmaz: `oyun.sesler` kuyruğunu OyunPage tüketir. HUD'da 🔊/🔇 düğmesi.

### 3) Yeni mod: MEYVE YE (`/meyvekes/oyun/yeme`)
- `engine/yuztakip.js` (yeni): MediaPipe **FaceLandmarker**, yalnız 4 ağız noktası (13/14/61/291).
  El takibi bu modda hiç yüklenmez → daha hafif.
- Ağız açıklığı = dikey açıklık / ağız genişliği (yüz uzaklığından bağımsız), **histerezisli**
  (aç 0.30 / kapa 0.20) → titreme yok, yutma anı kaçmaz. Yutma yarıçapı = ağız genişliği × 0.85.
- Meyveler **ağza nişan alarak balistik** fırlatılır (T sn sonra hedefte olacak hız) → meyve ağız
  hizasından geçer; oyuncunun tek işi doğru anda ağzını açmak. Spawn temposu 0.95 → 0.60 sn.
- Görsel: ağız açıkken nabız atan yeşil halka, kapalıyken kesikli sönük halka; yutulan meyve ağza
  doğru büzülerek akar (`yutulanlar`). Rozet: "😋 ağız açık / 🙂 hazır / 😐 yüz görünmüyor".
- DB: `20260612000043_meyvekes_yeme_modu.sql` — mod check + iki RPC'ye `'yeme'` eklendi.
  Menü ve Sıralama'ya "Meyve Ye" eklendi (birleşik sıralamaya toplam olarak katılır).

### Test
- `node meyvekes/_test/motor-test.mjs` → **31/31 ✓** (yeni: iz üretimi hareket/durgunluk, 60 fps iz
  akışı, ağızla yutma + histerezis + uzaklık, ağza nişan, kesim efektleri ve sönümü).
- `npm run build` temiz (MeyveKesApp 23.8 → 35.9 KB; yüz takibi + ses + efektler dahil).
- `_test/yeme-test.html` (yeni): kamerasız görsel test — sentetik ağız açılıp kapanır, meyveler nişan alır.
- **Kalan:** gerçek kamera testi kullanıcıda (iz görünürlüğü, yutma isabeti, kasma).
