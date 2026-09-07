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

---

## 25 Temmuz 2026 — Çıkarım WORKER'a taşındı + kadraj dışı köprüsü

Kullanıcı: *"kollarım ekrandan çıkıp hızlıca ekrana girdiğinde oyun kollarımı tanıyamıyor;
gerekirse baştan yaz, A kalite yap"*.

**Kök neden (iki katman):**
1. **Algılama katmanı:** `detectForVideo` SENKRON çalışır; ana thread'de çağrıldığında çıkarım
   süresi boyunca (10-60 ms) render donar. Bu yüzden algılama, çıkarım süresinin ~1.5 katına
   kısılmak zorundaydı (tavan 130 ms → zayıf cihazda ~7 algılama/sn). El kadrajdan çıkıp geri
   girdiğinde **130 ms'ye kadar kör pencere** oluşuyordu.
2. **Motor katmanı:** el kaybolunca takip kimliği yalnız bıçak izi tazeyken saklanıyordu; iz
   yoksa kimlik ANINDA düşüyordu. Geri girişte yeni kimlik hızsız/segmentsiz doğduğu için
   **dönüş savurması boşa gidiyordu** (ilk kare hiç kesmiyordu).

**Çözüm 1 — worker çıkarımı (yeni `engine/takip-worker.js` + `engine/takip-cekirdek.js`):**
- Çıkarım ayrı thread'de koşar → **kısma tamamen kaldırıldı**: kameranın her karesi işlenir
  (30-60 algılama/sn) ve render 60 fps akıcı kalır. Yeniden yakalama 1-2 kare.
- Ana thread yalnız `createImageBitmap(video)` ile kareyi kopyalayıp **transfer** eder.
  Uçuşta tek kare tutulur (kuyruk birikmez) → her zaman EN TAZE kare işlenir.
- Aynı worker iki modeli de kurar: `model:'el'` HandLandmarker, `model:'yuz'` FaceLandmarker →
  **Meyve Ye modundaki kasma da aynı çözümden faydalanıyor** (`yuztakip.js` de çekirdeğe bağlandı).
- **Üç kademeli emniyet:** (a) Worker/`createImageBitmap` yoksa veya kurulum başarısızsa eski
  ana-thread yolu (kısmalı) devreye girer; (b) worker kurulup da 10 kare üst üste sonuç
  üretemezse ÇALIŞMA ANINDA ana thread'e geçilir (`_yedegeDus`); (c) GPU delegesi başarısızsa
  worker içinde CPU'ya düşülür — worker'da CPU artık kasma demek değil.
- Public API (`eller`, `damga`, `gecikmeSn`, `elSayisi`, `video`) DEĞİŞMEDİ → `oyun.js`/`OyunPage`
  dokunulmadı.

**Çözüm 2 — kadraj dışı köprüsü (`engine/oyun.js`):**
- Eşleşmeyen el kimliği `KAYIP_SURE = 0.4 sn` boyunca "kayıp" olarak saklanır; el geri girdiğinde
  **aynı kimliğe bağlanır** → dönüş savurması İLK karede keser.
- Eşleştirme iki geçişli: önce canlı eller (kimlik takası olmaz), sonra kayıp eller.
- İstismar önlemi: köprü segmentinin tavanı köşegenin %50'si (`KOPRU_MAX_ORAN`) → ekranın bir
  ucundan diğerine "bedava kesim" yok; büyük atlamada eski iz noktaları silinir (yapay şerit yok).
- `MIN_HIZ = 170 px/s` eklendi: algılama 60 Hz'e çıktığında kare başına mesafe küçüldüğü için
  sabit 6 px tabanı gerçek savurmaları reddediyordu. Artık mesafe tabanı algılama aralığıyla
  ölçeklenir (60 Hz'de ~3 px), gürültüyü hız tabanı eler.

**Test:** `node meyvekes/_test/motor-test.mjs` → **36/36 ✓** (yeni: hızlı geri giriş köprüsü,
uzun kayıpta köprü kurulmaması, uçtan uca bedava kesim olmaması, 60 Hz'de ölçülü savurmanın
kesmesi, 60 Hz'de duran elin kesmemesi). Build temiz (worker ayrı chunk, 1.9 kB).

**Kalan (kullanıcıda):** gerçek kamera + iPhone testi. Konsolda `[MeyveKes] Worker ... ana thread'e
düşülüyor` uyarısı görürsen worker yolu o cihazda kurulamamış demektir (oyun yine çalışır).

### Aynı gün düzeltme — DURAN EL KESİYORDU (hareket kapısı)

Kullanıcı: *"elim sabit dururken bile meyveleri kesiyor; SADECE elimi kolumu kıpırdattığımda
kesmeli"*. **Benim yaptığım düzeltmenin yan etkisiydi:**

- Algılama worker sayesinde ~15 Hz'den 60 Hz'e çıktı. MediaPipe landmark'ları el sabit dururken
  de 2-5 px titrer. Kare başına 6 px'lik mesafe eşiği 15 Hz'de titremeyi eliyordu; 60 Hz'de aynı
  titreme "kare başına 4 px = 250 px/s" gibi göründü ve eklediğim 170 px/s hız tabanını aştı.
- Üstüne gecikme telafisi (`hiz × telafiSn`) titremeyi ~3 kat büyütüyordu (dtA küçüldükçe daha
  fazla). Sonuç: duran elin dev kılıcı önünden geçen her meyveyi kesiyordu.

**Kalıcı çözüm — hareket kapısı:** kesim izni artık ANLIK kare mesafesine değil,
`HAREKET_PENCERE = 0.12 sn` boyunca biriken **NET (yönlü) yer değiştirmeye** bakıyor. Titreme
sıfır ortalamalı olduğu için net yolu birkaç px'te kalır; gerçek savurma aynı pencerede 100+ px
yol alır. Kapı kapalıyken **kesim de, gecikme telafisi de, bıçak izi de** üretilmez (hepsi tek
karardan besleniyor → duran elde ekranda hiçbir şey olmuyor).

- Eşikler **ekran köşegenine oranlı** (`SAVURMA_ORAN 0.3/sn`, `IZ_HIZ_ORAN 0.09`,
  `SUPURME_ORAN 0.36`): landmark titremesi normalize uzayda sabit olduğu için px'e çevrilince
  ekranla birlikte büyüyor. Sabit px eşiği telefonda katı, geniş masaüstü ekranda gevşek kalıyordu.
- **Pencere dolmadan anlık hıza güvenilmez** (`SAVURMA_MIN_PENCERE 0.05 sn`): elin yeni
  yakalandığı ilk karede tek karelik titreme "480 px/s" görünüp kapıyı açıyordu (telefon
  testinde yakalandı). Kapı ya 50 ms örnek birikmesini ya da titremenin asla üretemeyeceği
  net yolu (`SAVURMA_NET_ORAN 0.05 × köşegen`) ister — ikinci koşul köprüden dönen elin ilk
  karede kesmesini korur.
- `MIN_HIZ` (kare-başı hız tabanı) kaldırıldı; yerini bu kapı aldı.

**Test:** 39/39 ✓ — yeni: duran el ±4 px titremeyle 1 sn boyunca (meyve kılıcın TAM üstünde)
kesmiyor ve iz üretmiyor; aynı sınama telefon çözünürlüğünde (390×844) de geçiyor; ölçülü ve
hızlı savurmalar kesmeye devam ediyor; 60 sn tam maç simülasyonunda 103 kesim.

**Ders (kritik):** algılama frekansını değiştirmek, kare-başı mesafe/hız eşiklerinin anlamını
değiştirir. Bu tür eşikler ya zaman penceresine ya ekran boyuna oranlı olmalı — sabit px/kare
eşikleri frekans veya çözünürlük değişince sessizce bozulur.

---

## 8 Ağustos 2026 — Agresif oynanış: salınımlı hareket, kadraj dışı dönüş, kasma

Kullanıcı: *"her aşamada kasıyor; ellerim kadrajdan çıkıp girince bıçak olmuyor; çılgınca dans
eder / yumruk atar gibi sallayacağız, oyun hepsini algılamalı."*

**1) Hareket kapısı NET yol → YAYILIM.** Net (yönlü) yer değiştirme, ileri-geri salınımı
eliyordu (pencereye tam periyot sığınca net yol ≈ 0 → kapı kapalı → ne kesim ne iz). Kapı artık
`HAREKET_PENCERE` (0.14 sn) içindeki konum yayılımına bakar (`YAYILIM_ORAN 0.035 × köşegen`):
yön bağımsız olduğu için savurma da salınım da geçer, titreme (±4 px ≈ 11 px yayılım) geçmez.
Yön/hız ayrı ve kısa pencereden (`HIZ_PENCERE 0.04`) okunur. `SUPURME_ORAN` 0.36→0.28,
`KILIC_KALINLIK` 34→38.

**2) Kadraj dışı köprüsü güçlendirildi.** `KAYIP_SURE` 0.4→**1.2 sn**; dönüşte kayıp-öncesi
konum `KOPRU_REF_DT` yaşında örnek olarak geçmişe konur (kapı ilk karede açılır);
`KOPRU_SEGMENT_SURE` (0.25 sn) üstü kayıpta ışınlanma segmenti kesmez, kesimi yalnız kılıcın o
anki gövdesi yapar. Eşleştirme hız-tahminli (kayıp elde tahmin yok). Meyve kenar payı
`max(60, W×0.1)`.

**3) Kasma.** Worker'a giden kare `HEDEF_UZUN_KENAR 480`'e (oran korunarak) küçültülür;
`shadowBlur` → additif halka; parçacıklar tek geçiş + `MAX_PARCACIK 260`; iz hale katmanı düşük
kalitede kapalı; canvas `desynchronized`; piksel bütçesi 1.1M; kalite tepkisi 1 sn; HUD state
yalnız değişimde; aynı karede aynı sesten en fazla 2; menüde model prefetch.

**4) Teşhis.** Rozette algılama frekansı (Hz) + `⚠` (ana-thread yedeğine düşüldü) gösterimi;
`ElTakip.yol` / `YuzTakip.yol` alanı eklendi.

**Test:** motor-test **43/43 ✓** (yeni Test 17 salınımlı yumruk, 18 uzun kayıptan dönüş +
aynı yerden dönen duran el, 19 art arda 5 çıkış/giriş). Build temiz.

---

## 8 Eylül 2026 — Kasma + gecikme KÖK NEDEN: worker hiç kurulamıyordu (module worker)

**Belirti (canlı ölçüm, Windows/Chrome 152, AMD GPU; tüm cihazlarda aynı):** HUD rozeti
"10 Hz ⚠"; konsolda worker iki kez kurulmaya çalışıp ikisi de
`Failed to execute 'importScripts' on 'WorkerGlobalScope': Module scripts don't support
importScripts()` ile ölüyor. 400 karenin 80'i 35–60 ms takılıyor, bıçak ~100 ms geride, kadrajdan
çıkan el kör pencerede kayboluyor.

**Kök neden:** `takip-cekirdek.js` worker'ı `{ type: "module" }` ile açıyordu. MediaPipe Tasks
Vision'ın wasm yükleyicisi worker içinde `importScripts` kullanır; module worker'da bu yasak.
"İki kez kurulma" = worker'daki GPU → CPU denemesi (ikisi de aynı yerde patlıyor). Worker HER
cihazda kurulamıyor, kod sessizce kısmalı ana-thread yedeğine düşüyordu (~10 Hz). Donanım
sorunu değildi: aynı makinede saf ölçüm ana thread GPU 8.7 ms/kare, klasik Blob worker'da
10.4 ms/kare, createImageBitmap 0.1 ms.

**Yapılanlar:**
1. **Worker klasik tipe çevrildi** (`takip-cekirdek.js`: `type` seçeneği kaldırıldı). Vite
   build'de worker zaten IIFE çıkıyordu (`(function(){...})()`, `import()` korunur, static
   import/export yok); dev'de `?worker_file&type=classic` + `importScripts("/@vite/env")` ile
   servis ediliyor — ikisi de doğrulandı. `takip-worker.js`: dinamik `import()` başarısızsa
   (çok eski tarayıcı) `self.exports` tanımlanıp `importScripts(cdnKok + "/vision_bundle.cjs")`
   denenir; o da olmazsa mevcut "hata" mesajı (ana-thread yedeği aynen duruyor).
   `kur()` yeniden girişe dayanıklı (`_kurSozu`); `ElTakip/YuzTakip.baslat()` ve
   `OyunPage.baslat` çift tetiklenmeye karşı korumalı (kamera/worker bir kez açılır); kurulum
   sürerken sayfadan çıkılırsa worker/landmarker sızmaz.
2. **Teşhis dürüst:** worker "hazir" mesajı `delege: "GPU"|"CPU"` taşır; `ElTakip/YuzTakip.delege`
   (ana-thread yolunda da dolar). HUD rozeti artık **"48 Hz · worker/GPU"**; ana-thread yedeğine
   düşülmüşse **"10 Hz · ana/CPU ⚠"**. Worker kurulum hatası, zaman aşımı, sonuç üretememe ve
   oluşturma hatası hepsi `console.warn` ile yazılır — sessiz düşüş yok.
3. **Kesim anı efekt bütçesi:** parçacık 12→8, altın 20→12 (yeme: 9→6, 16→10);
   `MAX_PARCACIK` 260→160; iz additif katmanı 3→2 (geniş dış hale yalnız `kalite === 1`);
   sarsıntı artık yalnız oyun/efekt canvas'ını kaydırır (kamera ayrı katmanda, yeniden
   çizilmez); `navigator.vibrate` en fazla 100 ms'de bir.
4. **Kamera kopyası kaldırıldı:** `<video>` artık canvas'ın ALTINDA görünür katman
   (`.mk-video`: `object-fit: cover; transform: scaleX(-1)` = `koordinatHesap` ile birebir aynı
   cover/ayna eşlemesi); `%12` karartma CSS katmanı (`.mk-video-karartma`); canvas `alpha: true`,
   `ciz(..., video = null)` → kopya ve fillRect yok. `ElTakip.baslat(maxEl, kapsayici)` /
   `YuzTakip.baslat(kapsayici)`: kapsayıcı verilmezse eski gizli-video yolu aynen çalışır
   (`ciz`'e video geçilirse eski kopya yolu da korunur — `_test/*.html` null geçer).
5. **Aynı hata başka modülde:** `boks/engine/takip-cekirdek.js` de module worker açıyordu →
   aynı tek satırlık düzeltme uygulandı (boks motor-test 93/93).

**Ölçüm (Chrome, dev sunucusu, sentetik 480×360 kareler, worker klasik):** el modeli
**worker/GPU 66 Hz** (ort. çıkarım 14.7 ms), yüz modeli **35 Hz**; kurulum 3.5 sn; her karede
`veri` geliyor. Worker "hazir" mesajı `delege: "GPU"` ile döndü.

**Test:** motor-test **43/43 ✓**, `npm run build` temiz (worker chunk 2.4 kB, IIFE).

**Kalan (kullanıcıda, gerçek kamera):** rozetin **30+ Hz · worker/GPU** göstermesi ve `⚠`'ın
kaybolması; meyvelerin elin üstüne denk gelmeye devam etmesi (CSS cover/ayna ↔ koordinatHesap);
kesim anında takılma olmaması; Meyve Ye'de aynı video düzeni; iPhone Safari'de klasik
worker + `import()` yolu. Deploy/push yapılmadı.

### Aynı gün, 2. tur — telefonda 13-14 Hz: rVFC basamaklanması + kare boyutu + delege yarışı

Kullanıcı: *"telefonda 13 14 hz. yetersiz."* (rozet yol/delege bilgisi iletilmedi.)

**Analiz:** telefon kamerası 30 fps → rVFC 33 ms'de bir gelir. Tek kare uçuşta + "meşgulse
atla" ile çevrim (bitmap + çıkarım) 33 ms'i aşınca her ikinci kare düşer ve Hz **30/15/10
basamaklarına kilitlenir**: 13-14 Hz = çevrim 34-66 ms. Çıkarım ne kadar hızlansa da 33 ms
altına inmeden 15'ten yukarı çıkılamıyordu.

**Yapılanlar (`engine/takip-cekirdek.js`, `engine/takip-worker.js`):**
1. **Boşalınca hemen gönder:** her rVFC karesi (meşgulken bile) kaydedilir; worker sonucu
   döndürür döndürmez en taze kare gönderilir → Hz ≈ min(kamera fps, 1000/çıkarım).
2. **Ön hazırlık:** worker meşgulken gelen taze karenin `createImageBitmap`'i önceden
   çıkarılır (tek hazırlık uçuşta, yenisi gelince eskisi kapatılır); sonuçta sıfır beklemeyle
   gider → çevrim = yalnız çıkarım süresi (bitmap 5-15 ms telefonda gizlenir). Aynı karenin
   iki yoldan işlenmesine karşı `sonVideoZaman` eşitlik kilidi; bitmap sızıntısı yok.
3. **Kare boyutu:** dokunmatik cihazda baştan **352 px** uzun kenar; masaüstü 480, ısınma
   sonrası çıkarım EMA'sı 30 ms'i aşarsa 352'ye iner. Ölçüm (bu makine, GPU): 480 px 14.7 ms →
   352 px **7.9 ms** (yaklaşık yarı).
4. **Delege yarışı (worker):** GPU ile kurulur; ısınmadan sonra 24 karede ortalama > 34 ms
   ise CPU delegesi de kurulup 24 kare ölçülür (bu sırada kareler adaydan işlenir, akış
   kesilmez), belirgin (>%15) hızlıysa CPU'ya geçilir, yenilen kapatılır. Sonuç `tip:"delege"`
   mesajıyla bildirilir (konsolda `yarış: GPU x ms, CPU y ms`), rozet güncellenir. Test kancası:
   `kur` mesajında `yarisEsikMs`.
5. **Rozet:** `"22 Hz · worker/GPU · 42ms"` — ms = tek kare çıkarım süresi (Hz'i sınırlayan
   çıkarım mı, kamera fps'i mi görünür). `ElTakip/YuzTakip.cikarimMs`.

**Doğrulama:**
- Yeni **`_test/cekirdek-test.mjs`** (Node, sanal saat, sahte worker/kamera): 30 fps + 45 ms
  çıkarımda eski 14.9 Hz → **22.1 Hz**; 36 ms: 14.9 → **27.6**; 70 ms: 9.9 → 14.2; 45 ms +
  12 ms bitmap: 14.9 → 22.1 (ön hazırlık); masaüstü 30/60 fps kamerada aynı kare iki kez
  işlenmiyor (29.9 / 59.8 Hz); bitmap sızıntısı yok. **11/11 ✓**
- Chrome (gizli sekme, sıralı): worker el 352 px **96 Hz / 7.9 ms**, yüz 112 Hz; `yarisEsikMs:0`
  ile yarış zorlandı → "GPU 8 ms, CPU 43 ms", GPU kaldı, 150/150 kare veri üretti.
- motor-test 43/43, boks 93/93, build temiz.

**Beklenti (telefon):** çıkarım 40-50 ms olan telefonda 13-14 → **20-25 Hz**; 352 px kare ile
çıkarım düşerse daha yukarı. Rozet artık ms de gösterdiği için bir sonraki geri bildirimde
**"xx Hz · worker/GPU · yy ms"** metnini olduğu gibi ilet: yol "ana" ise sorun worker
kurulumu (konsol uyarısı), ms > 33 ise sorun cihazın çıkarım hızı (delege yarışı devreye girer).
Kalan büyük kaldıraç: Tekli modda tek el görünürken `numHands=2` her karede avuç dedektörünü
koşturur (~2× maliyet) — `numHands=1` seçeneği tasarım kararı gerektirir.
