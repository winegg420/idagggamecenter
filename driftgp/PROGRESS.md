# PROGRESS.md — DriftGP

Proje: DriftGP — Arcade Racing
Durum: **Tüm 7 faz tamamlandı** — offline modda tam çalışır (Supabase anahtarı bekleniyor)

---

## Faz 1 — Temel Altyapı
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] Proje kurulumu (Vite + R3F + TS + Supabase bağlantısı, env-korumalı offline mod)
- [x] Tek araba, tek pist, temel sürüş fiziği
- [x] Gyro kontrolü + drift butonu
- Test sonucu: Headless fizik simülasyonu 12/12 ✓, Chrome'da uçtan uca doğrulandı
- Bulunan sorunlar / çözümler: Yüksek hızda grip azalmıyordu → hıza duyarlı grip + kayma cezası eklendi. Araç arkası çok karanlıktı → dolgu ışığı eklendi.
- Otonom kararlar: Fizik motoru olarak cannon-es/rapier yerine custom arcade model seçildi (drift hissi + mobil performans için).

---

## Faz 2 — Araba Sistemi
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] 30 araba, kategori bazlı gerçek fizik farklarıyla
- [x] Kart görünümlü seçim ekranı (filtre/sıralama/stat barları)
- [x] XP kilit eğrisi (4 araç baştan açık → Toro Nihai 15.000 XP)
- Test sonucu: Aynı AI sürücüyle Chiron 21.7 sn, Civic 24.9 sn, Wrangler 31.3 sn tur — araçlar gerçekten farklı hissediyor.

---

## Faz 3 — Kişiselleştirme
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] 13 kategori, canlı 3D önizlemeli garaj
- [x] Lastik seçimi fiziği etkiliyor (drift lastiği kaymayı artırır)
- [x] Polis/ambulans/taksi temaları (tepe lambası, siren butonu)
- Test sonucu: Kayıtlar kalıcı (localStorage, Supabase bağlanınca buluta geçecek).

---

## Faz 4 — Pist ve Ortam
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] 4 tematik pist: gece şehri, volkan (lav akışı + 120 kor partikülü), sahil, orman rallisi
- [x] F1 start sistemi, tur sayacı (1/3/5 seçilebilir)
- [x] Görsel efektler
- Test sonucu: Production build temiz, FPS sorunu bildirilmedi (mobilde henüz test edilmedi — deploy sonrası yapılacak).

---

## Faz 5 — Multiplayer
**Durum:** ✅ Kodlandı, canlı test Supabase kurulumunu bekliyor

- [x] 6 kişilik oda (kod ile katılım), hızlı eşleşme, davet
- [x] 10Hz pozisyon senkronu
- [x] Host zaman damgasına hizalı senkron F1 start
- [x] Kopan oyuncu diğerlerini etkilemiyor (DNF)
- Test sonucu: Kod tarafında hazır, gerçek çoklu-cihaz testi Supabase anahtarları eklendikten sonra yapılacak.

---

## Faz 6 — İlerleme Sistemi
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] XP hesaplama (sıralama + drift + temiz yarış)
- [x] 7 rank, 12 rozet
- [x] Profil ekranı
- Test sonucu: Tarayıcıda doğrulandı — 1.lik yarışta tam 230 XP ve 4 rozet doğru verildi.

---

## Faz 7 — Cilalama ve QA
**Durum:** ✅ Tamamlandı (2026-07-04)

- [x] Tamamen prosedürel WebAudio (7 motor profili, drift, nitro, çarpma, start bip, siren) — harici ses dosyası yok
- [x] HUD pozisyon göstergesi, neon gösterge teması
- [x] Uçtan uca test: menü → garaj → özelleştir → pist → yarış → sonuç → profil, hatasız
- Genel test durumu: Headless simülasyon 28/28 ✓ · TypeScript temiz ✓ · Production build ✓ · Test verileri temizlendi, sıfır profille başlıyor.

---

## 2026-07-04 — Araç Görselleri: Gerçek 3D Model Entegrasyonu (kritik kalite düzeltmesi)

### Kök neden teşhisi
- Eski `CarModel.tsx` tüm araçları ilkel `BoxGeometry/CylinderGeometry` ile çiziyordu (29 primitive geometri). GLTF/GLB yüklemesi YOKTU. Bu yüzden 30 araç kutu/blok gibi görünüyordu — brief'in "profesyonel kalite" hedefiyle çelişiyordu.

### Çözüm
- **Kenney.nl CC0 modelleri indirildi** (Car Kit v2 + Racing Kit), `public/models/` altına 13 benzersiz GLB + `Textures/colormap.png` kopyalandı. Kenney atıf gerektirmez (CC0), marka ismi/logosu yok — brief kuralına uygun.
- `src/game/carModels.ts`: 30 aracın kategoriye göre model eşleştirmesi (tablo aşağıda) + hedef uzunluk (bbox'a göre otomatik ölçek).
- `CarModel.tsx` tamamen yeniden yazıldı (R3F + `useGLTF`):
  - **Car Kit** modelleri tek "colormap" atlas dokusu paylaşır → kaporta rengi, atlastaki baskın boya tonunu **shader'da hedef-renk değiştirme** (`onBeforeCompile`) ile özelleştirilir; pencere/far/tampon korunur. Metalik/mat/parlak finish + cam filmi tonu desteklenir.
  - **Racing Kit "formula"** modeli ayrık malzemeli → glass/grey(jant)/tire/boya doğrudan değiştirilir.
  - PBR: `MeshStandardMaterial` (mobil/entegre GPU dostu — Physical'ın clearcoat maliyeti yok), farlar emissive, jant metalik.
  - Tekerlekler model-yerel uzayda döner + ön teker direksiyona döner.
- **TEK MODEL KAYNAĞI**: garaj kartları (drei `<View>` ile tek WebGL context'te 30 kart), garaj turntable önizlemesi, pist içi araçlar, botlar ve uzak oyuncular HEPSİ aynı `CarModel` bileşenini kullanır.
- **Kilit sistemi kaldırıldı**: `cars.ts` tüm `xpRequired: 0`; kart UI'ından asma kilit/XP overlay'i silindi. XP/rank/rozet sistemi korundu (sadece araçları kilitlemiyor).

### Bulunan ve çözülen sağlamlık sorunları (R3F)
1. **Klon churn**: GLB klonu her render'da yeniden üretiliyordu → primitive swap fırtınası. Çözüm: klon `useMemo([gltf.scene])` ile STABİL, malzemeler `useLayoutEffect` ile mevcut klona mutasyonla uygulanıyor (nesne referansı sabit).
2. **Paylaşılan geometri dispose**: `<primitive dispose={null}>` — klon geometriyi kaynak GLTF ile paylaşır; unmount'ta dispose kaynağı bozmasın.
3. **Suspense**: her CarModel kendi `<Suspense fallback={null}>` sınırında; tüm modeller `useGLTF.preload` ile önden yükleniyor.

### Testler
- Headless fizik/oyun: **28/28** ✓ (araç değişimi fiziği etkilemedi).
- `tsc -b` temiz, production build ✓.
- **Ham three.js render doğrulaması** (occluded sekmede `setInterval`+`readPixels`): `hatchback-sports.glb` yüklendi, ölçek 1.47, atlas boya-değiştirme çalıştı → 400×300 karede **10.110 kırmızı (kaporta) + 7.832 detay (tekerlek/cam) piksel**. Model + malzeme boru hattı DOĞRULANDI.

### ⚠️ ÖNEMLİ test-ortamı notu
Chrome otomasyon penceresi **occluded/gizli** (`visibilityState==='hidden'`) → `requestAnimationFrame` durur → R3F canvas TAMAMEN SİYAH render eder ve `useFrame` (fizik) donar. Bu bir KOD HATASI DEĞİL. Görsel doğrulama görünür/foreground pencere gerektirir. (Detay: hafıza notu `browser-test-background-tab`.) Bu görevde ~2 saat bu yanılgıya harcandı; ilk iş `visibilityState`+RAF kontrolü yapılmalıydı.

### Araç → Model Eşleştirme Tablosu
| Kategori | Araçlar | Kenney Model |
|---|---|---|
| Hyper/Süper (yarış) | Chiron Ghost, Toro Nihai, Huracán Toro, McClaw 720 | race-future.glb |
| Süper | SF Rosso, Turbo Wolf, Corvette Şahin | race.glb |
| Hyper (formula) | Jesko Storm | race-formula.glb (Racing Kit) |
| Spor/Kas | GTR Kaplan, Supra Kartal, Demon Reaper, Mustang Vahşi, Camaro Boğa, Taycan Şimşek | sedan-sports.glb |
| Sedan/Elektrikli | M-Wolf 4, RS Şimşek, Alfa Kartal, Orman Kurdu, Volt Plaid | sedan.glb |
| Kompakt/Roadster | Civic Ok, Mini Şimşek, Rüzgar MX | hatchback-sports.glb |
| Arazi/SUV | Wrangler Kaya, Rivian Yaban | suv.glb |
| Lüks Arazi | Defender Fırtına | suv-luxury.glb |
| E-Pickup | Cyber Kaya | truck-flat.glb |
| Polis | Devriye X | police.glb (hazır temalı) |
| Ambulans | Acil Şahin | ambulance.glb (hazır temalı) |
| Taksi | Sarı Kartal | taxi.glb (hazır sarı) |

### Sonraki: kullanıcı GÖRÜNÜR tarayıcıda görsel onay verecek (araç kaliteleri/renkleri)

## 2026-07-04 — Üç görsel/oynanış düzeltmesi

### SORUN 1 — Garaj kartlarında araçlar görünmüyordu
- **Kök neden:** `CardScene` kamerası (`<PerspectiveCamera position={[4.6,2.5,5]}>`) arabaya BAKMIYORDU; drei kamerası varsayılan -Z'ye bakar → araç kadraj dışında, sadece dönerken bir parçası girince siluet görünüyordu.
- **Çözüm:** `onUpdate={(c)=>c.lookAt(0,0.15,0)}` ile kamera araç merkezine bakar; ışıklar artırıldı (hemisphere 1.15→2.0, key directional 1.8→3.0, fill 0.5→1.1, + ön point light).
- **Doğrulama (ham three.js readPixels):** 5 temsili model — merkez kaplama %67-86 (araç kadraj ortasında), ortalama parlaklık 137-166/255 (net ve aydınlık).

### SORUN 2 — Gece şehir pisti çok karanlıktı
- **Çözüm (gece atmosferi korunarak):** Scene gece ışıkları — hemisphere 0.55→1.15, ay ışığı directional 0.35→0.7, + karşı yönden dolgu (0.45). **Oyuncu arabasını takip eden sıcak point light** eklendi (`carLightRef`, intensity 130, distance 48, useFrame'de araç pozisyonunu takip eder) → araç ve etrafındaki yol geniş alanda aydınlanır. Şehir asfaltı biraz açıldı (#26262e→#3a3a46), sokak lambalarının hepsi ışık verir + emissive artırıldı.
- **Doğrulama (ham three.js, chase kamera + koyu asfalt zemin):** araç bölgesi parlaklık **10→118**, sürülen yol bölgesi **22→69** (3 kat). Arka plan koyu kalır, uzak yol kararır → gece hissi korunur.

### SORUN 3 — Araç-araç çarpışması eklendi (önceki "çarpışma yok" kararı geri alındı)
- **Önceki karar geri alındı:** Kullanıcı arcade çarpışma istedi.
- **Uygulama (`carPhysics.ts`):**
  - `resolveCarCollision(a,b)`: oyuncu↔bot — pozisyonlar eşit ayrılır (üst üste binme yok) + hafif yön sekmesi (bump hissi).
  - `resolveGhostCollision(a,bx,bz)`: oyuncu↔uzak araç — sadece YEREL oyuncu itilir.
  - **KRİTİK — adalet:** Hiçbir varyantta HIZ CEZASI YOK. Çarpışma yalnızca pozisyon/görsel + minik yön sekmesi verir. Gerekçe: MP'de uzak oyuncu pozisyonu lag'li/otoriter; hız cezası verseydik lag'li rakiple çarpışan yerel oyuncu haksız yavaşlardı. Bu yüzden çarpışma "duvar gibi ölümcül" değil, arcade "bump".
  - Scene useFrame'de tüm araçlar adımlandıktan SONRA çözülür (solo: oyuncu-bot + bot-bot; multi: oyuncu-uzak), sonra görseller güncellenir. Hafif bump sesi (`audio.crash(0.28)`, 250ms rate-limit).
- **Doğrulama (headless, 34/34 test):** araçlar tam min mesafeye (2.90m = 2×CAR_RADIUS) ayrılıyor, hız korunuyor (30→30, 25→25), hayalet çarpışmada sadece yerel itiliyor + hız korunuyor, uzak araçlar çarpışmıyor.

### Test-ortamı notu (tekrar)
Görsel doğrulamalar ham three.js + `setInterval` + `readPixels` ile yapıldı çünkü otomasyon penceresi occluded (`visibilityState==='hidden'`) → R3F RAF döngüsü durur, canvas siyah render eder. Bu kod hatası değil (bkz. hafıza notu). Kullanıcı görünür tarayıcıda test edecek.

## 2026-07-04 — Beş sorun: araç çeşitliliği, isim, şehir zenginliği, yarış süresi, yeni pist

### SORUN 1 — Araç çeşitliliği (tüm araçlar aynı F1 görünüyordu)
- **Kök neden:** `race`/`race-future` Kenney gövdesi çok DAR (W1.20) → tekerlekler dışarı taşıp açık-tekerlekli/F1 görünüyor; bunlar 8+ araca atanmıştı, ayrıca `sedan-sports` 6 araçta → çeşitlilik düşük.
- **Çözüm:** Yeni `carModels.ts` eşleştirmesi — açık-tekerlekli modeller yalnızca **3 hyper aracında**; geri kalanı **11 farklı kapalı gövdeye** yayıldı. Ayrıca `CarModel.tsx`'e polis/ambulans/taksi **tepe lambası + taksi tabelası** temaları eklendi.
- **Eşleştirme (silüet grubu → araçlar):**
  - `race-future.glb` (alçak hypercar): Chiron Ghost, Toro Nihai
  - `race-formula.glb` (F1, açık tekerlek): Jesko Storm
  - `sedan-sports.glb` (spor coupe + spoiler): SF Rosso, Huracán Toro, Turbo Wolf, McClaw 720, GTR Kaplan, Taycan Şimşek, Gölge Aston
  - `hatchback-sports.glb` (hatchback): Corvette Şahin, Supra Kartal, Civic Ok, Mini Şimşek, Rüzgar MX
  - `sedan.glb` (dik sedan, kaslılar uzun): Demon Reaper, Mustang Vahşi, Camaro Boğa, M-Wolf 4, RS Şimşek, Alfa Kartal, Volt Plaid
  - `suv.glb` (SUV): Wrangler Kaya, Orman Kurdu, Rivian Yaban
  - `suv-luxury.glb` (lüks SUV): Defender Fırtına
  - `truck-flat.glb` (pickup): Cyber Kaya
  - `police.glb` + tepe lambası: Devriye X
  - `ambulance.glb` + tepe lambası: Acil Şahin
  - `taxi.glb` + tabela: Sarı Kartal
- **Doğrulama (ham three.js silüet ölçümü):** 11 model, yandan H/W oranları **0.557 → 1.172** (F1 en alçak → ambulans en uzun kutu), 6-8'den fazla belirgin farklı silüet. ✓

### SORUN 2 — İsimlendirme (DÜZELTME: her yer "DidaGP")
- Görünür oyun adı **"DidaGP"** yapıldı: menü başlığı "DIDAGP", `index.html` sekme başlığı "DidaGP — Arcade Racing", tüm `[DriftGP]` konsol prefixleri `[DidaGP]`. HUD'daki "DRIFT" (drift mekaniği, oyun adı değil) korundu.
- **Doğrulama (DOM):** başlık "DIDAGP", sayfada hiç "DriftGP" yok. ✓

### SORUN 3 — Şehir ortamı zenginleştirildi
- İki sıra bina (yakın alçak + uzak gökdelen), 4 farklı pencere dokusu, çeşitli boyut/renk, **neon dikey tabelalar + çatı kenarı neon şeritleri** (emissive, ışık maliyeti yok), çatı antenleri; her 3. sokak lambasında **trafik ışığı**; yol kenarı **reklam panoları**; tüm pistlere **kesikli yol orta çizgisi** eklendi.

### SORUN 4 — Yarış süresi (çok kısaydı → ≥1 dk/tur)
- **Yöntem:** Araç hızları SABİT; pist koordinatları `TRACK_SCALE=3.2` ile ölçeklendi (yol genişliği aynı). Örnek sayısı 720→1120 (yoğunluk). Zemin düzlemi pist sınırlarından dinamik hesaplanır.
- **Bot dengesi:** Uzayan pistte superhuman AI oyuncuyu tur bindirmesin diye botlara **hız governor'ı** (34-44 m/s) eklendi → oyuncu temposu etrafında rekabetçi yarış.
- **Varsayılan tur 3→2** (toplam ~2.5 dk hedefi için), tur seçenekleri 1/3/5 → 2/3/5.
- **Doğrulama (simTest, governor'lı gerçekçi tempo):** tüm 5 pistte tur **≥60s** (Neon 66s, Lav 68s, Sahil 82s, Orman 73s, Liman 62s). Kullanıcının ~36 m/s temposuyla ~81-100s. NaN yok.
- **Not:** ≥60s/tur (sert gereksinim) önceliklidir; toplam 2 tur × ~75-90s ≈ 2.5-3 dk. Oyuncu tur sayısını ayarlayabilir.

### SORUN 5 — Yeni 5. pist: "Liman Turu" (Monaco karakteri, KOPYA DEĞİL)
- Kurgu isim "Liman Turu" (gerçek "Monaco Grand Prix" adı/logosu KULLANILMADI). Dar (halfWidth 6.2 vs 9) ve bükümlü devre — Monaco karakteri (hairpin'ler, dar sokaklar, liman düzlüğü).
- **Yeni `riviera` teması** (`Environments.tsx`): animasyonlu deniz, **marina yatları** (gövde+kabin+direk), lüks kıyı binaları, **tribünler + instanced seyirci kalabalığı** (renkli, performans dostu), palmiyeler.
- **Doğrulama (simTest):** 2585m, NaN yok, tur 62s ≥60s, geçerli kapalı devre. ✓

### Genel
- tsc temiz, production build ✓, headless testler **35/35** ✓ (6 çarpışma + tur süresi + araç/pist testleri dahil).
- DOM smoke test: "DIDAGP", 30 kart, 5 pist, varsayılan 2 tur, konsol hatasız.
- **Görsel onay** (araç silüetleri kartlarda, zengin şehir, Liman yatları/kalabalığı) görünür tarayıcıda kullanıcı tarafından yapılacak — occluded otomasyon penceresinde R3F render etmiyor (RAF durur; bkz. hafıza notu).

## 2026-07-04 — Start grid bug + yol genişliği + araç/çevre kalitesi (yayına hazırlık) + fren farları

### SORUN 1 — Başlangıçta araçlar iç içe geçiyordu (KRİTİK BUG)
- **Kök neden:** `startPose` 6 aracı da AYNI z-noktasına (sample 8) koyup sadece 1.6m yanal aralıkla diziyordu; araç genişliği ~1.9m > 1.6m → çakışma.
- **Çözüm:** F1/Asphalt tarzı 2 kolonlu kademeli grid — kolonlar 5.6m yanal ayrı, sıralar 7m arkada (`-tangent*back` ile geriye).
- **Doğrulama (headless, Test 12):** 6 aracın min ikili mesafesi **5.60m > 2×CAR_RADIUS (2.90m)**, tümü yol içinde. ✓

### SORUN 2 — Yol çok dardı → %45 genişletildi
- `TRACK_HALF_WIDTH` 9→13 (yol 18m→26m). Liman Turu 6.2→9. Yol kenarı objeleri (bariyer/kerb/bina/ağaç) `halfWidth+offset` kullandığından otomatik dışarı kaydı; çarpışma sınırı da otomatik ölçeklendi.

### SORUN 3 — Araç kalitesi (EN ÖNEMLİ) — render yükseltmesi
- **Kaynak değerlendirmesi (istenildiği gibi):** Quaternius (CC0, ama FBX/OBJ + JS-gated indirme), Poly Pizza (CC0/CC-BY karışık, GLB CDN'de ama model başına lisans doğrulaması gerekir) incelendi. İkisi de Kenney gibi low-poly; mesh takası marjinal kazanç + lisans/format yükü getirirdi.
- **Profesyonel karar:** "kutu/oyuncak" hissi ağırlıkla RENDER'dan (düz malzeme, yansıma yok, IBL yok) kaynaklanıyordu. En yüksek ROI = render yükseltmesi (CC0 Kenney GLB'leri güvenilir yükleniyor):
  1. **Prosedürel çevre-haritası (PMREM IBL)** — `ProceduralEnv.tsx`, tema renklerinden gradient. Araç boyası/jant gerçek çevreyi yansıtır. **Kritik bug düzeltildi:** equirect canvas 2:1 oranında OLMALI (8×64 yanlıştı → siyah PMREM; 128×64 doğru).
  2. **Clearcoat physical boya** — `MeshPhysicalMaterial` (metalness 0.15, clearcoat 1.0) = camsı vernikli gerçek araba boyası (krom değil). Atlas boya-değiştirme shader'ı Physical + env ile sorunsuz derleniyor.
  3. **ACES filmic ton eşleme** (sinematik renk), **jant/cam env yansıması**, **soft gölge**.
- **Fren farları (kullanıcının özellikle belirttiği detay):** Arka fren/stop farları + orta stop lambası eklendi. `brakeRef` ile frende parlak kırmızıya, bırakınca sönük stop lambasına yumuşak geçer. Oyuncu VE botlar için.
- **Doğrulama (ham three.js readPixels):** env yansıması çalışıyor (krom küre env'siz 0 → env'li 194); tam malzeme yolu (atlas shader + physical clearcoat + env): avgLum 58→**141**, kırmızı boya %88 korunuyor, **clearcoat parlamaları 3242px**, shader/GL hatası YOK. Düz "oyuncak" → parlak gerçekçi boya.

### SORUN 4 — Çevre kalitesi cilası
- **Oyuncuyu takip eden gölge ışığı** — büyük pistlerde statik ±140 frustum oyuncuyu kapsamıyordu → dar ±32 frustum, 2048 çözünürlük, shadow-bias/normalBias ile oyuncuyu takip → her yerde keskin araç gölgesi.
- ACES ton eşleme + IBL çevre ışığı → dengeli, sinematik sahne. Tema bazlı sis/derinlik korundu.

### Lisans notu
- Tüm 3D modeller: **Kenney.nl Car Kit v2 + Racing Kit — CC0** (atıf gerektirmez, ticari kullanıma açık). Alternatif kaynaklar değerlendirildi, mevcut CC0 GLB'lerin render'ı yükseltildi.

### Genel
- tsc temiz, production build ✓, headless testler **37/37** ✓ (start grid çakışma testi dahil).
- DOM smoke test: 30 kart, 5 pist, yarış sahnesi hatasız mount, shader/runtime hatası yok.
- **Görsel onay** (parlak yansımalı araçlar, geniş yol, çakışmasız grid, fren farları, keskin gölgeler) görünür tarayıcıda kullanıcı tarafından yapılacak — occluded otomasyon penceresinde R3F render etmiyor (RAF durur).

## 2026-07-04 — ARAÇ MODELİ ARAŞTIRMASI (sadece araştırma, kod değişikliği YOK)

Amaç: mevcut Kenney (CC0, ~500 yüz, "oyuncak/kutu" hissi) yerine ÜCRETSİZ, ticari kullanıma açık,
marka-belirsiz, GERÇEKÇİ araç modeli kaynakları bulmak. (Markalı modeller — BMW/Ferrari vb. — kural
gereği aranmadı/önerilmedi.)

### 🥇 EN İYİ ADAY — DanielZhabotinsky (Sketchfab)
- **Link:** https://sketchfab.com/DanielZhabotinsky/models
- **Lisans:** 23 model CC-BY (CC Attribution — atıf zorunlu, TİCARİ KULLANIM SERBEST) + 1 "Free Standard".
- **Kaç araç / kategori:** 24+ indirilebilir araç, HEPSİ KURGU İSİMLİ (El Triello '70, Eagle Turbo '92,
  Tipo 400, Chapman '73, Kiri '94, Compact '07, Asti Stradale '89, Ace '11, Rancher '50 pickup,
  Eugene MK6 '65, Shvan '92 Traveller, Hazer Turbo '81, Cheetah '84, Stallion '70 kas, JDM Sport '99,
  Roadster '00, Maureen '67, Lolita '91 + RC Annihilator/Highwayman yarış). Kategoriler: retro/klasik,
  spor, kas, kompakt, pickup, yarış — projedeki kategorilerle birebir örtüşüyor.
- **Poligon/detay:** 2.000–27.000 yüz (retro'lar ~2-4k, detaylılar ~13-27k). Kenney'nin ~500'ünün
  **5-50 katı detay**. Panel çizgileri, gerçek oranlar, detaylı jantlar.
- **Gerçekçilik (1-10):** **8-9** (Kenney: 4). İndie yarış oyunu kalitesinde, "kutu" değil gerçek araba
  silüeti. **Projenin kurgu-isim kuralıyla mükemmel uyum** (araçların zaten kurgu isimleri var).
- **Format:** Sketchfab glTF/GLB indirir → R3F ile doğrudan uyumlu.

### 🥈 İKİNCİ ADAY — Comrade1280 (Sketchfab)
- **Link:** https://sketchfab.com/comrade1280
- **Modeller:** "Generic passenger car pack" (69k yüz toplam, ~4-5 araç, 2085 beğeni, CC-BY) +
  "Generic civil service vehicles pack" (92k yüz, polis/ambulans/servis, 1101 beğeni, CC-BY).
- **Lisans:** CC-BY (atıf zorunlu, ticari serbest). **Marka-belirsiz** ("generic").
- **Detay:** paket başına 69-92k yüz → araç başına ~12-18k. Gerçekçi.
- **Gerçekçilik:** **7-8**. Polis/ambulans/servis paketi özel araçlar için ideal.

### Diğer kaynaklar (daha zayıf)
- **OpenGameArt.org:** Karışık. Bazı CC0 bireysel araçlar var ("sports-car-lowpoly" CC0/.obj,
  "car-kit" CC0/.zip — muhtemelen Kenney'nin aynısı), "muscle-car" CC-BY/.blend, "lowpoly-car" CC-BY.
  Hobici seviye, değişken kalite, tek tek modeller. **Gerçekçilik 4-6.** Kenney'ye net üstünlük yok.
- **Quaternius (quaternius.com):** Sadece 1 "Cars" paketi (CC0, FBX/OBJ, JS-gated indirme). Low-poly,
  Kenney tarzı. "Ultimate Vehicles" gibi detaylı araç paketi YOK. **Gerçekçilik 4** (mevcutla aynı).
- **Poly Pizza (poly.pizza):** CC0/CC-BY low-poly modelleri toplar (çoğu Kenney/Quaternius/arşiv Google
  Poly kaynaklı), GLB indirir ama model başına lisans doğrulaması gerekir. **Gerçekçilik 4.**
- **itch.io:** Çok sayıda ücretsiz low-poly araç paketi (çoğu Kenney/Quaternius seviyesi, bazıları CC0).
  Sayfa JS-render, curl ile listelenemedi; manuel tarama gerekir. Genelde mevcut kaliteye yakın.

### Önemli uyarılar (uygulama kararı için)
1. **İndirme sürtünmesi:** Sketchfab indirmesi ücretsiz HESAP + giriş gerektirir (doğrudan curl inmez).
   Modeller manuel indirilip `public/models/`'e konmalı (glTF/GLB olarak).
2. **CC-BY = atıf zorunlu:** Ticari kullanım serbest AMA yazarlara kredi verilmeli (ör. oyun içi
   "Krediler" ekranı veya README). Mevcut Kenney CC0 (atıf gerektirmez); CC-BY'ye geçince kredi ekranı
   eklemek gerekir. Ticari açıdan sorun değil.
3. **Poligon/performans:** 15-27k yüz/araç × pistte 6 + garajda 30 kart = mobilde daha ağır. Kenney'nin
   ~500'ü çok hafif. Pistteki 6 araç için modern cihazlarda sorun olmaz; garajdaki 30 kart için LOD/
   düşük-detay veya önden-render'lı thumbnail gerekebilir.
4. **Malzeme:** Sketchfab modelleri kendi PBR dokularıyla gelir (Kenney'nin tek atlas'ı yerine) →
   boya-değiştirme sistemi (`buildAtlasPaintMaterial`) bu modeller için yeniden yazılmalı (gövde
   mesh'ine renk uygula, doku korunur).

### TAVSİYE (kullanıcı kararına sunulur)
- **En yüksek kalite/uyum:** DanielZhabotinsky'nin kurgu-isimli araçları (CC-BY). Projedeki 30 araca
  6-8 farklı gerçekçi model eşlenebilir; kredi ekranı + boya sistemi güncellemesi gerekir.
- **Özel araçlar (polis/ambulans):** Comrade1280 "civil service" paketi.
- Bunlar Kenney'den objektif olarak DAHA GERÇEKÇİ. Karar verilirse: (a) modelleri indir, (b) lisans
  kredisi ekle, (c) boya-değiştirme sistemini PBR-dokulu modellere uyarla, (d) garaj kartları için
  performans (LOD/thumbnail) çöz. Onay verilirse uygularım.

## 2026-07-04 — DanielZhabotinsky modellerine geçiş (ADIM B tamam; A/C/D dosya bekliyor)

### ⛔ KRİTİK BLOKAJ — Sketchfab indirmesi yalnızca KULLANICI hesabıyla mümkün
Sketchfab indirme API'si kimlik doğrulama zorunlu kılıyor (`/v3/models/{uid}/download` → **HTTP 401**
"Authentication credentials were not provided"). curl ile indirilemez; otomasyonla da güvenilir değil
(viewer WebGL gerektirir, indirme modal akışı kırılgan, dosya indirme açık izin ister). Bu modelleri
**yalnızca sen** (Sketchfab hesabına girişle) indirebilirsin. Bu, yalnızca kullanıcının yapabileceği
bir adımdır.

### ✅ ADIM B — Krediler ekranı (TAMAMLANDI + test edildi)
- Ana menüde küçük "ⓘ Krediler" linki → `CreditsScreen`. Oynanışı engellemez.
- İçerik: Daniel Zhabotinsky (CC BY 4.0, sketchfab.com/DanielZhabotinsky), Comrade1280 (CC BY 4.0,
  sketchfab.com/comrade1280), Kenney (CC0). CC-BY atıf yükümlülüğü karşılandı.
- Doğrulama (DOM): link + ekran + isimler + lisanslar + linkler doğru. tsc/build/37 test temiz.

### 📋 ADIM A — Model eşleştirme tablosu (dosyalar eklenince aktifleşecek)
Her araç kategorisine uygun kurgu-isimli model atandı. Tümü marka-belirsiz, CC-BY (Comrade "Generic"
paketleri dahil). **Markalı modeller (Opel/Jaguar/Harley — Comrade'de mevcut) KULLANILMADI.**

| Araç (kategori) | Sketchfab modeli | Kaydedilecek dosya | Link |
|---|---|---|---|
| Chiron Ghost (Hyper) | Ace '11 | ace.glb | sketchfab.com/3d-models/none-055ff8a21b8d4d279debca089e2fafcd |
| Jesko Storm (Hyper) | Kiri '94 Racemod | kiri-racemod.glb | none-64d5d6f074a84717ac6d764f35c95285 |
| Toro Nihai (Flagship) | Cheetah '84 | cheetah.glb | none-c967ab4abbc54ae4b7933fd81a86c99c |
| SF Rosso (Süper) | Asti Stradale '89 | asti-stradale.glb | none-97b15b067111443ebe05840137b49c65 |
| Huracán Toro (Süper) | Hazer Turbo '81 | hazer-turbo.glb | none-ef6411864cd24046aad6ae75dbdb7ea7 |
| Turbo Wolf (Süper) | Eagle Turbo '92 | eagle-turbo.glb | none-eb7d6c072bf54d9ba6a48f6d49e6abeb |
| McClaw 720 (Süper) | JDM Sport '99 | jdm-sport.glb | none-6dd4ae19c454414d9eed2bc524515d78 |
| GTR Kaplan (Spor) | Chapman '73 | chapman.glb | none-f30b644b59b54e809355009dce463d47 |
| Corvette Şahin (Spor) | Stallion '70 | stallion.glb | none-0a7e200181db468495485d09121029dc |
| Supra Kartal (Spor) | Lolita '91 | lolita.glb | none-128691a403ec4dd5af28c2e7c9037a3a |
| Demon Reaper (Kas) | Suggan '53 Modified | suggan.glb | none-dd4a4752aa254249990882159a014683 |
| Mustang Vahşi (Kas) | Maureen '67 | maureen.glb | none-e9abc7cb4713498ab04edd9678c44998 |
| Camaro Boğa (Kas) | Stallion '70 (tekrar) | stallion.glb | (aynı) |
| M-Wolf 4 (Sedan) | Eugene MK6 '65 | eugene.glb | none-22732575b0644cc9b65cf21857288189 |
| RS Şimşek (Sedan) | Ukrainer '79 | ukrainer.glb | none-7129af29b710479ca62cd5376fbc4aa4 |
| Volt Plaid (Elektrikli) | Generic passenger pack | sedan-generic.glb | comrade: none-20f9af9b8a404d5cb022ac6fe87f21f5 |
| Taycan Şimşek (Elektrikli) | Generic passenger pack (tekrar) | sedan-generic.glb | (aynı) |
| Rivian Yaban (Elektrikli) | Shvan 92 Traveller | shvan.glb | none-c5134fcf8d2944b4b8800ec46fa02e17 |
| Wrangler Kaya (Arazi) | Shvan 92 Traveller (tekrar) | shvan.glb | (aynı) |
| Defender Fırtına (Arazi) | Rancher '50 Custom | rancher.glb | none-7f75854aba96417f8279bd9f1b24e6b2 |
| Civic Ok (Kompakt) | Compact '07 | compact.glb | none-25c6874d173a4f6ca63e150bbd505686 |
| Mini Şimşek (Kompakt) | Kiri '94 | kiri.glb | none-b92072c8cd9d4ee6b3c0be45de48223c |
| Cyber Kaya (E-Pickup) | Rancher '50 (tekrar) | rancher.glb | (aynı) |
| Devriye X (Polis) | Generic civil service pack | police-generic.glb | comrade: none-8ff2a13f30914932a70c7950cfa58465 |
| Acil Şahin (Ambulans) | Generic civil service pack | ambulance-generic.glb | (aynı pack, ambulans mesh'i) |
| Sarı Kartal (Taksi) | Generic passenger pack (sarı) | sedan-generic.glb | (aynı) |
| Rüzgar MX (Roadster) | Roadster '00 | roadster.glb | none-82fd2008ce304df688ec4dfcd42d41ce |
| Alfa Kartal (Sedan Spor) | El Triello '70 | el-triello.glb | none-fefa94b06cce47ab8ce4d96b973336dd |
| Gölge Aston (Lüks GT) | Tipo 400 '74 | tipo-400.glb | none-80364d5d34724737b2b7a5a4da769e57 |
| Orman Kurdu (Rally) | Slater MK1 '93 | slater.glb | none-8b0db2a59de243dab175090e3c9c98a7 |

**~25 farklı model (30 araç için, birkaç tekrar).** Link ön eki: `https://sketchfab.com/3d-models/`

### İNDİRME TALİMATI (kullanıcı için)
1. Yukarıdaki her linke gir (Sketchfab hesabınla giriş yaparak).
2. "Download 3D Model" → **glTF (.glb)** formatını seç, indir.
3. İndirilen `.glb`'yi tabloda belirtilen dosya adıyla `public/models/sketchfab/` klasörüne koy.
4. Comrade paketleri ÇOK ARAÇLI tek dosya — pack'i indir, `public/models/sketchfab/` içine
   `sedan-generic.glb` / `civil-service.glb` olarak koy (entegrasyonda doğru alt-mesh seçilecek).
5. Bittiğinde bana haber ver → ADIM A (eşleştirmeyi aktive), C (boya sistemi bu modellere uyarlama)
   ve D (garaj performansı) adımlarını gerçek modellerle test ederek tamamlarım.

### ⏳ ADIM C — Boya/renk sistemi (dosya bekliyor)
Mevcut sistem Kenney'nin tek "colormap" atlas dokusuna göre (`buildAtlasPaintMaterial`, shader ile
baskın renk değiştirme). Sketchfab modelleri ayrı PBR dokular + isimli malzemeler kullanır → gövde
malzemesini (isim: body/paint/carpaint veya en büyük yüzeyli mesh) hedefleyip renk uygulayan, dokuyu
koruyan GENEL bir yol yazılacak. Jant/spoiler/egzoz gibi eklentiler bbox-tabanlı olduğundan yeni
modellerle çalışmaya devam eder; gerçek malzeme yapısı görülünce ince ayar yapılacak.

### ⏳ ADIM D — Garaj performansı (dosya bekliyor)
Yeni modeller 2k-27k yüz (Kenney ~500). Garajdaki 30 canlı 3D `<View>` ağır olur. Çözüm: her aracı
tek sefer offscreen render edip **statik thumbnail (data-URL) cache**'le, kartlarda `<img>` göster;
seçili kart isteğe bağlı canlı 3D. Pist içi 6 araç tam kalite. Model-agnostik olduğundan gerçek
modellerle kurulup mobil FPS test edilecek.

### Neden şimdi tamamlanmadı
ADIM A/C/D'nin görünür sonucu (araçların yeni görünmesi) TAMAMEN model dosyalarına bağlı; dosyalar
gelmeden C'yi (gerçek malzeme yapısına göre) ve D'yi (gerçek modelleri render eden thumbnail) doğru
kurup TEST edemem. Kenney'yi placeholder tutup kör kod yazmak görünür iyileştirme sağlamaz + yeniden
iş çıkarır. Bu yüzden: B tamamlandı, A tablo+talimat hazır, C/D dosya gelince test edilerek bitirilecek.

## Kullanıcının Yapması Gerekenler (KURULUM.md'de adım adım)

1. Supabase projesi kur → `supabase/schema.sql`'i SQL Editor'de çalıştır → URL + anon key'i `.env`'e yaz
2. Google OAuth'u Supabase Authentication'da etkinleştir
3. Vercel deploy (`npm i -g vercel` → `vercel --prod`) + env değişkenlerini panele ekle
4. Telefonda gyro testi ve iki cihazla multiplayer testi (HTTPS gerektiği için deploy sonrası)

## Kullanıcıya Sorulacak Açık Sorular

- (yok — tüm otonom kararlar aşağıda gerekçeleriyle not edildi)

---

## Ek: Detaylı Karar Günlüğü ve Notlar (CLAUDE.md madde 2/5 kapsamı)

### Otonom kararlar ve gerekçeleri
1. **Fizik motoru: custom arcade kinematik model** (cannon-es/rapier değil). Pist yarışı düz zeminde 2.5D modelle çözülür; rigid-body motoru mobilde gereksiz CPU yükü + drift hissinde kontrol kaybı. Model: hız skaler + yön vektörü; drift = hız yönünün heading'i gecikmeli takibi (grip parametresi); hıza duyarlı grip → yüksek hızda viraj doğal kayma/scrub üretir. Duvar + tur ilerlemesi aynı Catmull-Rom merkez çizgisi verisinden (`src/game/track.ts`).
2. **Gaz: otomatik** (brief'in önerdiği varsayılan). Sol-alt FREN, sağ-alt DRIFT, ⚡ NİTRO butonu. Klavye fallback: A/D, S, Space, Shift.
3. **Nitro mekaniği:** Drift sırasında slip açısı × hız oranında enerji birikir (maks 1.0); nitro basılıyken 0.35/sn harcanır, +%30 hız limiti ve 1.8× ivme verir. Drift'te hız kaybı cezası normale göre %60 daha az → drift ödüllendirilir.
4. **Kilit açma eğrisi:** 4 başlangıç aracı (Civic Ok, Sarı Kartal, Rüzgar MX, Mini Şimşek). Performansa göre kademeli artış; zirve: Chiron Ghost 11k, Jesko Storm 13k, Toro Nihai 15k XP. Bazı özelleştirme varyantları da XP kilitli (turbofan jant 2k, yarış lastiği 1.5k, GT kanat 3k vb.).
5. **Rozet listesi (12):** İlk Yarış, İlk Zafer, Pist Aşinası (10), Pist Kurdu (50), Drift Çırağı (5k), Drift Ustası (50k), Hız Şeytanı (350+ km/s), Nitro Bağımlısı (50), Temiz Tur, Gece Sürücüsü, Volkan Fatihi, Koleksiyoncu (10 araç).
6. **Ses: tamamen prosedürel WebAudio** — harici CC0 ses dosyası indirme riski/bağımlılığı yerine osilatör+noise sentezi; bundle'a sıfır ek yük.
7. **Solo modda 5 AI rakip** eklendi (brief'te zorunlu değildi): pozisyon/XP sisteminin offline da anlamlı olması için. Bot AI = headless testteki yol takipçisi; beceri kademesi 0.82-1.0.
8. **Araç-araç çarpışması yok** (ghost geçiş) — 6 kişilik realtime senkronda pozisyon çakışması adaleti bozardı; arcade türde yaygın çözüm.

### Teknik notlar
- Kalıcılık katmanı: localStorage anında; Supabase varsa `cloudSync.ts` üzerinden upsert (tüm çağrılar try-catch, oturum yoksa no-op).
- Multiplayer senkron start: host `startAt` epoch yayınlar, tüm istemciler F1 ışıklarını buna hizalar (`StartLights` multi modu).
- `main.tsx`'te dev-only `window.__driftgp` test kancası (production'a girmez).
- `public/gputest.html`: GPU teşhis yardımcısı (silinebilir).
- Bundle 1.1MB tek chunk (three.js) — istenirse code-split sonraki iterasyonda.

### Test ortamı uyarısı
Chrome otomasyon sekmesi arka planda kalırsa rAF durur → oyun "donmuş", kronometre yavaş görünür; bu performans sorunu DEĞİL, sekme görünürlüğü. FPS ölçümü sadece görünür sekmede anlamlı. Fizik/oyun mantığı testi: `node --experimental-strip-types scripts/simTest.ts` (28 test).

---

## Faz 8 — Gerçekçi Araç Modelleri + Görsel Kalite (2026-07-04)
**Durum:** ✅ Tamamlandı

### Karar: Model kaynağı = Quaternius (poly.pizza üzerinden, CC0)
- **Neden bu kaynak:** Kullanıcı manuel indirme / hesap / giriş istemedi — tamamen otomatik indirilebilir kaynak şartı.
  - Sketchfab (DanielZhabotinsky vb.) denendi → indirme API'si OAuth/giriş istiyor (HTTP 401), otomatik indirilemedi → **elendi**.
  - Poly Pizza statik CDN (`https://static.poly.pizza/{uuid}.glb`) girişsiz 200 döndürüyor → **seçildi**.
- **Lisans:** CC0 (atıf gerektirmez, ticari serbest, marka-belirsiz). Yine de Krediler ekranında teşekkür olarak listelendi.
- **Neden Kenney'den daha iyi:** Daha gerçekçi araç oranları (~4.2m gövde) + **isimli malzemeler** (Blue/White gövde, Windows, Headlights, TailLights). Bu yapı temiz renk değiştirme ve fren farı entegrasyonuna birebir uyuyor (Kenney tek "colormap" atlas'ına karşı).
- **Sınır:** 7 model / ~5 silüet (sedan, kompakt, SUV, 2 spor coupe, taksi, polis). Kenney'in 11 silüetinden az çeşitlilik; 30 araç kategoriye göre dağıtıldı, çeşitlilik renk + ölçek + tepe temalarıyla sağlandı.

### Model eşleştirmesi (`src/game/carModels.ts`)
| Kategori | Model | Örnek |
|---|---|---|
| Hyper/Süper/Spor | sports1 / sports2 | Chiron Ghost, SF Rosso, GTR Kaplan |
| Kas/Sedan/Elektrikli | sedan | Demon Reaper, M Wolf 4, Volt Plaid |
| Kompakt/Roadster | compact | Civic Ok, Mini Şimşek |
| Arazi/Rally/E-Pickup | suv | Wrangler Kaya, Cyber Kaya, Orman Kurdu |
| Polis | police | Devriye X |
| Taksi | taxi | Sarı Kartal |
| Ambulans | suv + beyaz tepe teması | Acil Şahin |

7 GLB `public/models/pizza/` altında (~1.2 MB toplam, marka-belirsiz doğrulandı).

### ADIM C — Boya/renk sistemi (isimli-malzeme dalı)
- `CarModel.tsx`'e `isNamedMaterial` tespiti + yeni useLayoutEffect dalı: her malzeme adına göre sınıflanır →
  gövde→MeshPhysical clearcoat boya (parlak/metalik/mat finish), Windows→cam, TailLights→fren farı (emissive, frende 1.1→5.5), Headlights→emissive far, Grey→krom jant, Black/tire→koyu.
- **Ham three.js + readPixels doğrulaması (occluded sekme):** sedan kırmızıya boyandı %84 kırmızı; sports1 mavi %0 kırmızı; SUV yeşil → boya doğru uygulanıyor. avgLum ~140 (aydınlık), clearcoat parlaması 292–551px, fren farı kırmızı, **shader hatası yok**.
- Kenney (formula/atlas) dalları fallback olarak korundu — eski modeller bozulmadı.

### ADIM D — Garaj performansı
- **PMREM env cache** (`ProceduralEnv.tsx`): env haritası renderer+renk anahtarına göre bir kez üretilip WeakMap'te paylaşılıyor. Garajda 30 kart aynı renkleri kullanıyor → **30 PMREM üretimi yerine 1**. İlk açılış takılması ortadan kalktı.
- Modeller hafif (~2k üçgen), drei `<View>` ekran-dışı kartları render etmiyor → ek LOD/thumbnail gerekmedi.
- Canlı smoke: carSelect'te 30 kart, tek WebGL context, gerçek konsol hatası yok.

### Krediler ekranı güncellendi
- CC-BY (Sketchfab) atıfları kaldırıldı; Quaternius + Poly Pizza (CC0) + Kenney (CC0) olarak güncellendi. Giriş metni CC0'a göre düzeltildi.

### Test
- `npx tsc -b` temiz, `npm run build` başarılı (534ms), `scripts/simTest.ts` 37/37 ✓.
- Geçici doğrulama harness'i (`GltfVerify.tsx` + main.tsx kancası) temizlendi — üretime kod bırakılmadı.

### Test edilmesi gerekenler (kullanıcı)
1. Görünür sekmede garajı aç → 30 kartın hepsi parlak/doğru renkte ve dönüyor mu?
2. Bir araç seç → yarışta frene bas → arka fren farları kırmızı parlıyor mu?
3. Özelleştir ekranında boya rengi/finish (parlak/metalik/mat) değiştir → anlık yansıyor mu?
4. Polis (Devriye X) / taksi (Sarı Kartal) / ambulans (Acil Şahin) temaları doğru mu?

---

## Faz 9 — Tekerlek Pozisyon Bug'ı + Boş Pist Düzeltmesi (2026-07-04)
**Durum:** ✅ Tamamlandı

### SORUN 1 — Tekerlekler yanlış konumda (KRİTİK BUG, düzeltildi)
- **Kök neden (kanıtlandı, tahmin değil):** Quaternius modellerinde tekerlek düğümleri orijinde (`T=[0,0,0]`)
  ama tekerlek GEOMETRİSİ gövde altına ofsetli (ör. FrontLeftWheel geoCenter=`[0.75, 0.27, 1.20]`).
  Eski `useFrame` kodu `node.rotation.x = spinAngle` uygulayınca tekerlek, araç merkezinden geçen X ekseni
  etrafında ~1.23 birim yarıçapla YÖRÜNGEYE giriyordu → araç hareket edince tekerlekler üstte/içeride uçuşuyordu.
  Dururken (garaj, hız=0) spinAngle=0 olduğu için fark edilmiyordu. Kenney→Poly Pizza geçişinden kalma bir uyumsuzluk.
- **Çözüm:** Her tekerlek mesh'i, kendi geometrik merkezine yerleştirilmiş bir pivot grubuna reparent edildi;
  `useFrame` artık düğüm yerine pivotu döndürüyor → tekerlek kendi ekseninde döner. Paylaşılan geometri
  MUTASYONA UĞRATILMADI (diğer araç örnekleri bozulmaz), yalnızca sahne grafiği reparent edildi.
- **Doğrulama (piksel/pozisyon):** Tekerlek 1.5 rad (~86°) döndürülüp world bbox ölçüldü:
  - Eski: arka tekerlek merkez-Y **1.26** (havada), ön tekerlek **-1.17** (yerin altında).
  - Yeni: TÜM tekerlekler merkez-Y **0.27** (doğru), alt-Y ~0.00 (yere değiyor). ✓
- **Bot/uzak oyuncu kontrolü:** Tüm araçlar tek `CarModel` bileşenini kullandığından bot ve uzak oyuncu
  araçları da otomatik düzeldi.
- **Yan bug (canlı test yakaladı):** Pivot grubunu `w.name + '_pivot'` diye adlandırınca adı 'wheel' içeriyordu;
  StrictMode ikinci render'ında traverse pivot GRUBUNU (geometrisiz) da "wheel" sanıp `computeBoundingBox`
  çağırıyor → çökme. `isMesh` kontrolü eklendi (pivot grubu Group olduğu için hariç). Düzeltildi.

### SORUN 2 — Boş/detaysız pist (düzeltildi)
- **Tespit (audit script ile, `scripts/envAudit.ts`):** `scatter` reddetme eşiği `halfWidth + minD*0.55` idi;
  bu, obje hayatta kalması için `minD ≥ halfWidth/0.45 ≈ 29` gerektiriyordu. halfWidth 9→13 büyütülünce yola
  yakın objelerin minD'leri güncellenmemişti → **city lambaları %3, reklam panoları %0 kabul** (regresyon).
  En seyrek tema: coast (sadece 60 palmiye + tek taraflı deniz, hiç bina yok) → "boş" algısının asıl kaynağı.
- **Düzeltme A (regresyon):** `scatter` reddetme eşiği sabit `halfWidth + clearance`'a çevrildi
  (ince objeler clearance=2.5, binalar clearance=6). Tüm çağrıların minD değerleri buna göre ayarlandı.
  Sonuç (obje sayısı): city 131→260, volcano 44→80, coast 60→114, forest 156→187, riviera 75→97.
- **Düzeltme B (coast zenginleştirme):** Coast tema olarak çıplaktı → eklendi: uzak kıyı tepeleri (derinlik),
  plaj kayaları, renkli plaj kulübeleri/kabanalar, cankurtaran kuleleri. Artık diğer pistlerle tutarlı kalite.
- **Düzeltme C (zemin dokusu):** TrackMesh zemini düz tek renkti → deterministik prosedürel benek/leke dokusu
  eklendi (renge göre koyu/açık varyasyon, ~28m/karo tekrar). Tüm pistlere fayda.

### Test
- `npx tsc -b` temiz, `npm run build` başarılı (545ms), `scripts/simTest.ts` 37/37 ✓.
- Canlı: 5 pistin (coast/city/volcano/forest/riviera) hepsi SIFIR konsol hatasıyla mount oldu.
- `scripts/envAudit.ts` obje yoğunluğu denetimi için korundu.

### Bir sonraki oturumda dikkat
- Görsel doğrulama occluded otomasyon sekmesinde yapılamaz (rAF durur, R3F siyah). Sahne grafiği/piksel
  matematiği ile doğrulandı. Kullanıcının görünür sekmede göz testi yapması önerilir (aşağıdaki liste).

---

## Faz 10 — Ekran Kararması + Egzoz Bug'ı + Çevre/Araç Kalitesi (2026-07-04)
**Durum:** ✅ Tamamlandı

### SORUN 1 — Ekran kararması (KRİTİK, düzeltildi)
- **Kök neden (kanıtlandı):** Pistler büyük (araç/kamera origin'den maxR 837–1049 birim uzaklaşıyor —
  `scripts/trackBounds` ile ölçüldü). Kamera `far=700` ve drei `<Sky>` origin-merkezli ±500 birimlik kutu.
  Araç origin'den >500 birim uzaklaşınca kamera Sky kutusunun DIŞINA çıkıyor + uzak geometri far'ı aşıyor
  → o pikseller (üst/ufuk) siyah kalıyor. City/volcano `<color background>` kullandığından bağışıktı;
  Sky'lı pistler (coast/forest/riviera) etkileniyordu.
- **Çözüm (3 katman):**
  1. **Garanti arka plan:** TÜM pistlerde `<color attach="background">` her zaman set → WebGL clear rengi
     gökyüzü rengi olur, geometri olmayan piksel asla siyah kalmaz.
  2. **SkyFollow:** Sky + Stars kameranın X-Z konumunu takip eder → kamera her zaman dome merkezinde.
  3. Kamera `far` 700 → 1600 (uzak geometri kırpılmaz, sis zaten mesafeyi kapatır).
- **Piksel kanıtı (ham three, ufka bakan uzak kamera):** background YOK → ekran üstü avgLum **0, %100 siyah**;
  background VAR → avgLum **197, %0 siyah**. 5 pist de sıfır konsol hatasıyla mount oldu.

### SORUN 2 — Egzoz havada asılı (düzeltildi)
- **Kök neden:** Egzoz YAPISAL olarak `<group ref>` çocuğuydu (araçla hareket ediyordu — parent bug DEĞİL).
  Gerçek sorun: egzoz/splitter/skirt SABİT alçak y-offset (0.18/0.1/0.12) kullanıyordu; Kenney için ayarlıydı.
  Quaternius modeli ölçeklenince gövde tabanı y≈0.19–0.30'a çıktı → egzoz gövdenin ALTINDA, yere yakın
  boşlukta asılı kaldı (tekerlekle aynı "model değişince eskiyen offset" sınıfı).
- **Çözüm:** `geo` useMemo'da gövde (tekerlek hariç) bbox'ı hesaplanıp add-on'lar gerçek gövdeye oturtuldu:
  `dims.floorY/rearX/frontX/sideZ`. Egzoz → `[rearX+0.05, floorY+0.1]`, splitter → ön-alt, skirt → yan-alt.
- **Analitik kanıt (7 modelin hepsi):** ESKİ egzoz gövde tabanının 0.01–0.12m ALTINDA (SUV'de en kötü);
  YENİ egzoz her modelde gövde tabanında. Tek araçta değil TÜM araçlarda düzeldi (tek bileşen).
- **Benzer parça kontrolü:** spoiler/hood/decal zaten `topY`'ye göreceli (üstte) → sorun yok, dokunulmadı.

### SORUN 3 — Her pist kendine özgü zengin çevre (düzeltildi)
- **Ortak seyirci sistemi:** Instanced düşük-poligon siluetler (gövde kapsül + kafa küre), pist kenarına
  dizilir. 5 pistin hepsine eklendi (`Crowd` bileşeni, performans dostu instancing).
- **İmza landmark'lar (her pist uzaktan tanınır):**
  - **Şehir:** infield downtown gökdelen çekirdeği (9 kümelenmiş süpergökdelen, anten+ikaz ışığı) + tribün + kalabalık.
  - **Volkan:** lav fıskiyesi (kraterden yükselen kor konileri) + bazalt sütunları + mevcut volkan/lav/kor.
  - **Sahil:** denize uzanan ahşap iskele + kulübe + demirlemiş tekneler + kıyı tepeleri + kabanalar.
  - **Orman:** kayalık uçurum + akan şelale + dip havuzu + kütük kulübeler + yoğun ağaç/dağlar.
  - **Liman Turu:** kırmızı-beyaz deniz feneri (dönen ışık huzmesi) + yatlar + tribün + kalabalık.
- **Landmark konumları** `scripts/landmarkClearance.ts` ile pistten güvenli mesafede doğrulandı (çakışma yok).
- Zemin dokusu (Faz 9) + genişletilmiş obje sayıları (Faz 9) korunuyor.

### SORUN 4 — Araç detayı (araştırma + iyileştirme)
- **Kaynak araştırması (sonuç: daha iyi CC0 oto-indirilebilir kaynak YOK):** Quaternius zaten tasarım gereği
  low-poly; markası bu. Girişsiz + otomatik indirilebilir + CC0 FOTOGERÇEKÇİ tutarlı araç seti pratikte yok.
  Yüksek poligon bireysel modeller dağınık (Pixabay/Sketchfab CC0) ama tutarlı 7-silüetlik set + tutarlı
  isimli-malzeme yapısı olarak bulunamadı; Sketchfab indirmesi giriş istiyor (401). **Karar: kaynak
  değiştirilmedi, mevcut modeller prosedürel detay + malzeme/gölge ile zenginleştirildi.**
- **Eklenen detaylar:**
  - **Yan aynalar** (isimli-malzeme modellerde, gövde yan-üst köşesine, gerçek gövde bbox'ından).
  - **Temas gölgesi (fake AO):** aracın altına radyal gradient blob → aracı yere oturtur, botlarda dinamik
    gölge kapalı olsa bile derinlik/gerçekçilik verir. Tek doku, tüm örneklerce paylaşılır.
  - Mevcut clearcoat boya + krom jant + fren farı + PMREM yansıma (önceki fazlar) korunuyor.

### Test
- `npx tsc -b` temiz, `npm run build` başarılı (525ms), `scripts/simTest.ts` 37/37 ✓.
- Canlı: 5 pist (city/coast/forest/riviera/volcano) SIFIR konsol hatasıyla mount; ayna+temas gölgesi hatasız.
- Bir kerelik proof script'leri (bodyAnchors, trackBounds) temizlendi; envAudit + landmarkClearance korundu.

### Kullanıcının görünür sekmede göz testi (occluded otomasyonda R3F siyah render eder)
1. Uzun yarış (pistin sonuna dek): üst ekran artık siyah kesilmiyor mu?
2. Egzoz + aynalar araca sabit, gövdeye oturuyor mu (havada değil)?
3. 5 pist birbirinden belirgin farklı mı (downtown / lav fıskiyesi / iskele+tekne / şelale / deniz feneri)?
4. Seyirci kalabalığı pist kenarlarında görünüyor mu?

---

## Faz 11 — Kontrol Seçenekleri + Mobil Optimizasyon + Pist Zenginleştirme (2026-07-04)
**Durum:** ✅ Tamamlandı

### SORUN — Telefonda araba dönmüyordu (KRİTİK)
- **Kök neden:** HUD'da SOL/SAĞ yön butonu yoktu; direksiyon TAMAMEN gyro'ya bağlıydı. Gyro çalışmayan/izin
  vermeyen cihazda (kullanıcının telefonu) direksiyon imkânsızdı. `launchRace` her dokunmatik cihazda gyro
  zorluyordu; başarısız olunca butona düşmüyordu.
- **Çözüm — iki kontrol modu (kullanıcı seçer, kalıcı):**
  1. **🔘 Ekran Butonu (varsayılan):** Sol altta ◀ ▶ dokunmatik yön butonları. Her cihazda çalışır.
     Buton girdisi kademeli yumuşatılır (ani -1/+1 yerine 0.25→0.9 rampası → kontrollü his; readPixels/logic
     testiyle doğrulandı).
  2. **📱 Telefonu Eğ (gyro):** Kalibrasyon + eğme. Sensör hassasiyeti artırıldı (maxTilt 22→18).
- **Menüde seçici** eklendi (Direksiyon: Ekran Butonu / Telefonu Eğ), `controlMode` localStorage'da kalıcı.
- **Akış düzeltildi (`flow.ts`):** Gyro/kalibrasyon YALNIZCA 'tilt' modunda; buton modunda doğrudan yarışa
  girilir. Gyro izni alınamazsa otomatik butona düşer.
- **Kalibrasyon ekranı:** canlı sensör durumu ("✓ aktif" / "⚠ veri gelmiyor") + "ekran butonlarına geç"
  fallback butonu eklendi (gyro çalışmayan cihazda kullanıcı sıkışmaz).

### Mobil optimizasyon (`src/game/quality.ts`)
- Cihaz tespiti (UA + hardwareConcurrency) → mobil/low-end kademeleri.
- **Adaptif kalite:** DPR (masaüstü 1.9 / mobil 1.35 / low-end 1.1), antialias mobilde kapalı,
  gölge haritası (2048/1536/1024), çevre objesi seyreltme (scatter step ×1.6–2.0), seyirci seyreltme.
- Masaüstünde tam kalite korunur; tek yerden yönetilir, sahne+çevre okur.

### Harita çevresi — daha fazla geliştirme
- **Lastik bariyerleri (tüm pistler):** Yol kenarına instanced kırmızı-beyaz lastik yığınları (tek çizim
  çağrısı → performans dostu). Her piste "gerçek yarış pisti" hissi verir. `Environment` sarmalayıcısına
  eklendi (5 pistte de).
- Faz 10 imza landmark'ları + seyirci + Faz 9 obje yoğunluğu korunuyor.

### Test
- `npx tsc -b` temiz, `npm run build` başarılı (556ms), `simTest.ts` 37/37 ✓.
- Canlı: menü kontrol seçici + yarışta ◀▶/FREN/⚡/DRIFT butonları render; tilt kalibrasyon fallback çalışıyor;
  buton direksiyon mantığı doğrulandı (sağ 0.25→0.9 rampa, bırak→0, sol negatif); 5 pist sıfır konsol hatası.

### Kullanıcının telefonda test etmesi
1. Menü → "Direksiyon: 🔘 Ekran Butonu" seçili mi (varsayılan). Yarışta sol alt ◀ ▶ ile dönebiliyor musun?
2. "📱 Telefonu Eğ" seçersen: kalibrasyon ekranında telefonu eğince ibre oynuyor + "✓ Sensör aktif" mi?
   Oynamazsa "ekran butonlarına geç" ile devam et.
3. Performans mobilde akıcı mı (DPR/gölge/obje otomatik düştü)?

---

## Faz 12 — Cam Bug'ı + Monaco + Yatlar/Şehir + Özelleştirme Önizlemeleri (2026-07-04)
**Durum:** ✅ Tamamlandı

### Cam rengi bug'ı (düzeltildi)
- **Kök neden:** İsimli-malzeme cam malzemesi metalness 0.9 + roughness 0.05 (ayna) + yarı-saydamdı →
  parlak ortamı yansıtıp açık renkli araçta gövdeyle neredeyse aynı görünüyordu (ham render: cam bandı vs
  gövde farkı sadece ~11 luminance).
- **Çözüm:** Opak KOYU tonlu oto camı (metalness 0, clearcoat 1, envMapIntensity 0.8, Cam Filmi'ne göre
  açık/orta/koyu tonlama). Doğrulama: cam-gövde farkı ~11 → **~49** (belirgin koyu, asla gövde rengi).

### Liman Turu → Monaco
- Pist adı gerçek adıyla "Monaco" olarak değiştirildi (kullanıcı talebi).

### Monaco: deniz yakınlaştırma + partili yatlar
- Deniz düzlemi pise yaklaştırıldı (cz-260 → cz-150, 1100×720, hafif yükseltildi).
- Yatlar pist kenarına yakınlaştırıldı (mesafe 18-38 → 9-25) ve sıklaştırıldı.
- **PartyYacht bileşeni:** güvertede 6 parti konuğu (kapsül+kafa siluet), renkli parti ışık dizisi,
  gölgelik, kabin, su hattı gövde. Marina şenlikli görünüyor.

### Şehir: daha fazla bina + balkonda insanlar
- İki sıra → ÜÇ sıra bina (yakın/orta/uzak), yoğunluk artırıldı (near step 12→9, +mid sıra, far 16→13).
- Yakın binalar daha yüksek varyasyon (10+26 birim).
- **Balkonlar + insanlar:** yakın binaların cephesinde 3 balkon (döşeme+korkuluk) + her balkonda bir kişi
  (kapsül+kafa). Düşük-uçlu cihazda atlanır (performans).

### Özelleştirme önizleme ikonları (her parça)
- **PartIcon bileşeni:** her kategori+varyant için özel SVG ikon — Jant (5 kollu/örgü/turbofan çizimi),
  Lastik (tread deseni), Egzoz (tek/çift/orta çıkış), Splitter/Spoiler/Skirt (araç yan-profil), Kaput
  (karbon çizgileri), Cam Filmi (tonlama swatch), Far (renk+huzme), Nitro (alev), Dekal (şerit), Gösterge.
- Garajda artık her seçeneğin **ismi üstünde parçanın görseli** var. Boya kaplama butonlarına da
  parlak/mat/metalik sheen swatch'ı eklendi.
- **Jant 3D notu:** SVG önizleme her tasarımı gösterir; 3D araçta jant malzemesi (krom/siyah/altın) belirgin
  değişir. Ancak Quaternius modelinde arka tekerlekler TEK birleşik mesh olduğundan gerçek 3D pervane
  geometrisi eklenemedi (pivot ikisinin ortasında) — düşük-poligon kaynağın sınırı.

### Test
- `npx tsc -b` temiz, `npm run build` başarılı (576ms), `simTest.ts` 37/37 ✓.
- Canlı: garaj jant ikonları render (SVG'li), Monaco adı track select'te, şehir+Monaco yarışı 0 konsol hatası.

### Git/Deploy notu
- Proje git repo yapıldı (`git init`, master). GitHub remote YOK → `git push` için kullanıcının remote eklemesi
  gerekir (`gh` kurulu değil). `vercel --prod` git'siz deploy ediyor (canlıya alma bununla yapılır).

---

## Faz 13 — Garaj Kalitesi + Monaco Pist Bug'ı + Kategori Gövde Farkı (2026-07-04)
**Durum:** ✅ Tamamlandı

### SORUN 1 — Kategoriler arası gövde farkı yoktu (KÖK NEDEN + çözüm)
- **Kök neden:** carModels.ts doğru eşleşiyordu AMA 13 spor araç (hyper/süper/spor) sadece 2 Quaternius
  modeline (sports1/sports2) düşüyordu ve bunlar neredeyse aynı silüet. Toplam 7 model / ~5 silüet.
- **Çözüm — HİBRİT kaynak:** Kenney Car Kit modelleri (projede zaten mevcuttu, atlas colormap malzemeli,
  CarModel'in atlas dalı destekliyor) devreye alındı. 30 araç ~14 FARKLI silüete dağıtıldı:
  Quaternius (sports1/2, sedan, compact, suv, taxi, police) + Kenney (hatchback, sedan-sports coupe,
  suv-luxury, race, race-future, truck-flat PICKUP, ambulance).
- **Objektif kanıt (bbox H/L oranı):** sedan 0.28 (alçak) → ambulans 0.55 (yüksek kutu) arası geniş yelpaze;
  pickup/coupe/hatchback/SUV/race hepsi ayırt edilir. 30 kart 0 hata, atlas recolor çalışıyor (colormap
  uyarısı yok).

### SORUN 2/3 — Cam/far/jant garajda görünmüyor
- Garaj kartı (CarSelectScreen) ve garaj önizlemesi (GarageScreen) AYNI CarModel + malzeme setini kullanıyor
  (tek kaynak kuralı korunuyor). Faz 12 cam düzeltmesi + emissive far/stop + jant malzemesi her ikisinde
  geçerli. Kenney modellerinde cam atlas dokusunda, far/stop JSX emissive kutularıyla (isimli-malzeme değil).

### SORUN 4 — Garaj kartı tasarımı sade
- Her karta **kategori bazlı radyal parıltı** eklendi (Hyper kırmızı, Elektrikli camgöbeği, Arazi yeşil,
  Lüks GT altın... 17 kategori). Üstte parlak çizgi + alt vinyet → profesyonel mobil kart hissi.

### Monaco pisti — bozuk bölüm + deniz + süper yatlar
- **Bozuk "kavşak" bulundu (proximity script):** eski riviera dar hairpin'de yollar üst üste biniyordu
  (en yakın merkez mesafesi 5.9 birim, halfWidth 9 → ~12 birim örtüşme). Pist TEMİZ bir Monaco devresi
  olarak yeniden tasarlandı (min self-mesafe 5.9 → **74.3**, kesişim yok). Ölçek 2.7→3.0 (tur ≥60s korundu).
- **Liman Turu → Monaco** (Faz 12) + alt kenar (min-z) = liman düzlüğü.
- **Deniz pise çok yaklaştırıldı** (liman kenarının hemen dışına, 1300×700) + rıhtım taş şeridi.
- **Süper yatlar:** çok katlı gövde, havuz, helipad (H işaretli), köprü camı, parti ışıkları, 12 konuk.
  Her 3. yat süper yat; diğerleri PartyYacht. Liman boyunca pist kenarına yakın.
- **Binalar iyileştirildi ("lego" azaltma):** pencere dokusu (emissive), kademeli çatı katı, teras
  korkuluğu, ön cephe balkonları, 5 renk tonu, rastgele rotasyon.

### Test
- `npx tsc -b` temiz, `simTest.ts` 37/37 ✓ (Monaco tur ≥60s), `npm run build` başarılı.
- Canlı: garaj 30 kart + kategori parıltısı 0 hata; Monaco yarışı 0 hata; hibrit modeller yükleniyor.
- Yeni tanı script'leri: trackProximity.ts, trackSelfIntersect.ts (pist doğrulama).

### Not — genel "lego" görünüm
- Prosedürel düşük-poligon geometri (kutu/koni) doğası gereği stilize; binalar/yatlar/kalabalık zenginleştirildi
  ama fotogerçekçi değil (CC0 + prosedürel sınırı, Faz 10'da belgelendi).

---

## Faz 14 — Cam/Jant/Far Garajda Görünmüyor: İDEMPOTENTLİK BUG'I (2026-07-04)
**Durum:** ✅ Tamamlandı — SAYISAL KANITLA

### Kök neden (satır satır bulundu)
CarModel isimli-malzeme swap'ı malzemeyi MEVCUT malzemenin `.name`'ine göre seçiyordu
(`Windows`→glass). Ama yeni oluşturulan `glassMat`/`rimMat`/`paintMat`'in adı `''` (boş).
Effect İKİNCİ kez çalışınca (StrictMode dev + herhangi re-render/dep değişimi), mesh'in malzemesi
artık adsız glassMat olduğundan swap onu tanımıyor → `paintMat`'e düşüyor → **cam/jant/far gövde
rengine dönüyor.** Swap idempotent değildi. Faz 12'deki testim TEK uygulama yaptığı için bug'ı kaçırmıştı.

### Sayısal kanıt (yan görünüm, beyaz gövde #f8f9fa, cam bandı ort. parlaklık)
- **BUG (eski, swap 2 kez):** cam 180 → **229** (gövdeye döndü) ❌
- **FIX (yeni, swap 2 kez):** sedan cam 177 → **177** (sabit koyu), gövde 226 → fark **49** ✓
- **FIX sports1:** cam 187 → **187** (sabit). İki uygulamada da cam gövdeden ~49 birim koyu.

### Çözüm
- `geo` useMemo'da her mesh'in ORİJİNAL malzeme adları `mesh.userData.origMatNames`'e bir kez
  yakalanıyor (malzemeler henüz orijinal iken, swap'tan önce).
- Swap artık mevcut malzemenin adına değil, `origMatNames`'e göre seçiyor → kaç kez çalışırsa çalışsın
  cam/jant/far doğru kalıyor (idempotent). Named + formula dallarının ikisi de düzeltildi.
- Atlas (Kenney) dalı zaten obje adına göre çalıştığından etkilenmiyordu.

### Test
- `npx tsc -b` temiz, canlı carSelect 30 kart 0 hata.
- Kanıt yukarıda sayısal (cam re-run'da 177→177 sabit, gövdeden 49 koyu).

---

## Faz 15 — Minimap + Özelleştirme Tıklama Bug'ı + Görsel Revize (2026-07-04)
**Durum:** ✅ Tamamlandı

### Minimap (yeni özellik)
- Yarış HUD'ına minimap eklendi (sağ üst): parkur şeması (trackId örneklerinden 3 katman) +
  oyuncu yön oku (kırmızı, heading rotasyonlu) + rakip noktaları (sarı, ~10Hz store'dan).
- Store'a `mmPlayer`/`mmRacers` + `setMinimap`; Scene HUD tick'inde güncelleniyor.
- Kanıt: oyuncu [100,50,1.2rad] → SVG translate(53,16) rotate(68.75°); 3 rakip doğru projeksiyon.

### SORUN 1 (öncelikli bug) — Özelleştirmede tıklanmayan seçenekler (KÖK NEDEN + çözüm)
- **Kök neden 1 (kilit):** Oyuncu 362 XP. 5 kategoride 3. seçenek XP-kilitliydi (Jant Turbofan 2000,
  Lastik Yarış 1500, Egzoz 2500, Spoiler GT 3000, Dekal 1000). `onClick={()=>!locked&&...}` → kilitliler
  tıklamaya yanıt vermiyordu. **Çözüm:** Tüm XP kilitleri kaldırıldı (araçlar gibi özelleştirme de baştan açık).
- **Kök neden 2 (layout):** `.screen` `position:absolute; inset:0; justify-content:center` + overflow tanımsız →
  kısa (landscape telefon) ekranda seçenekler ekran altına taşıp erişilemiyordu. **Çözüm:** `.garage-screen`
  `overflow-y:auto` + sekmeler `flex-wrap:wrap` (hepsi görünür) + kısa ekranda önizleme küçülür.
- **Test:** 13 kategori, HEPSİNDE 0 kilitli seçenek; eskiden kilitli Turbofan tıklanınca `rim:2` uygulanıyor.

### SORUN 2 — Görsel revize
- **Jant:** 3 net ayrışan stil — parlak KROM (#eef2f8, çok yansıtıcı) / gloss SİYAH (#14151a) / ALTIN (#e6b422).
  Not: Quaternius/Kenney birleşik-tekerlek low-poly'de gerçek 3D pervane geometrisi eklenemiyor; malzeme +
  SVG önizleme ile ayrışma sağlandı.
- **Şehir binaları:** pencere dokusu üreteci 3 cephe tipi (grid / yatay şerit / geniş cam) + 8 doku seed'i;
  yüksek binalara kademeli üst kat (setback) + gövde renk varyasyonu → tekrar hissi azaldı.
- **Garaj kart renkleri:** 17 kategori → 17 BENZERSİZ renk (hue spektrumuna yayıldı); spor kademeleri
  kırmızı→macenta→turuncu→sarı net ayrık; parıltı güçlendirildi (aa/99 alpha).

### Test
- `npx tsc -b` temiz, `simTest.ts` 37/37, `npm run build` başarılı.
- Canlı: garaj 0 kilitli/scroll ok, 17 benzersiz kart rengi, minimap render+projeksiyon, şehir yarışı 0 hata.

### Git push notu
- Bu oturumda `git push` kimlik doğrulaması başarısız (credential helper interaktif prompt istiyor,
  önceki cache süresi dolmuş). Commit'ler yerelde. Deploy `vercel --prod` ile yapıldı. Kullanıcının
  kendi terminalinde `git push origin main` çalıştırması gerekiyor (interaktif auth için).

---

## Faz 16 — Ses Motoru Gerçekçilik Revizyonu (2026-07-04)
**Durum:** ✅ Tamamlandı

### Sorun
Sesler prosedüreldi ama motor 2 osilatör + lowpass = düz "uğultu" (gerçekçi değil).

### Kaynak notu
Girişsiz + otomatik indirilebilir + CC0 + RPM'e tepki veren GERÇEK motor ses SETİ pratikte yok
(freesound giriş ister; tek örnek pitch-shift chiptune olur). Bu yüzden prosedürel sentez KÖKTEN
iyileştirildi (kayıtlı örnek istenirse Kenney Audio CC0 ayrı entegrasyon gerektirir — bundle + RPM
crossfade karmaşıklığı; kullanıcıya opsiyon olarak sunuldu).

### Motor (yeniden yazıldı)
- 3 osilatör: ana ateşleme tonu (saw) + alt-oktav lope (V8 hissi) + üst harmonik (parlaklık).
- **Ateşleme-frekanslı AM yanma gürültüsü:** subRatio frekansında saw modülatör noise gain'ini çarpar →
  "putput" ritmi + raspy doku (motorun karakterini veren asıl kısım).
- Egzoz **growl** peaking-filter (rpm ile frekansı yükselir) + rpm ile açılan lowpass → gürleme.
- Profil bazlı karakter: v8 derin/lopey, v10 haykırış, v12 pürüzsüz, inline4 turbo-buzz, electric whine.

### Diğer sesler
- **Drift:** yüksek-Q bandpass (1550Hz) + LFO ile dalgalanan tiz lastik çığlığı + alt kazıma dokusu.
- **Çarpışma:** düşük gümbürtü + 2 rezonanslı metalik çınlama (sac/tampon tınısı, hızlı sönüm).

### Test
- `npx tsc -b` temiz. Tarayıcıda 7 profil + rpm süpürme + crash + beep → **0 hata** (graf sağlam).
- NOT: Ses kalitesi sayısal kanıtlanamaz (işitsel); sentez öncekinden belirgin zengin.

---

## Faz 17 — A-Sınıfı Menü + Yarış Aksiyonu + Per-Araç Ses İmzası (2026-07-04)
**Durum:** ✅ Tamamlandı

### Ana menü — "panel" → A-sınıfı oyun ekranı (baştan yazıldı)
- Animasyonlu arka plan: perspektif ızgara zemin (aşağı akan) + kayan hız çizgileri + vinyet.
- **Dönen 3D kahraman araç** (seçili araç, canlı CarModel) — menünün merkezi.
- Gradient/glow başlık, rütbe kartı (üst bar), nabız atan "YARIŞA BAŞLA" CTA, kart-menü (Garaj/MP/Profil),
  kompakt kontrol modu + krediler. Landscape-dostu flex düzen.

### Yarış aksiyonu/heyecanı (görsel + kamera)
- **Hız çizgileri:** merkezden yayılan warp efekti, hızla belirginleşir (RaceFx, speedKmh'e bağlı).
- **Nitro boost:** mavi kenar parlaması + nabız + hız çizgileri maviye döner + FOV punch (nitro'da +11°, hız +18°).
- **Çarpışma:** kamera SARSINTISI (decay'li titreme) + kırmızı-beyaz ekran flaşı (store crashFx sayacı).
- Store: `boosting`, `crashFx` + `triggerCrash`; Scene çarpışma/duvar temasında tetikliyor.

### Per-araç ses imzası
- `startEngine(profile, tune)` — araç id'sinden deterministik tune (±): temel perde ±8%, growl ±12%,
  üst harmonik ±18%. Aynı motor ailesindeki araçlar bile farklı seslenir.
- **Dürüstlük notu (tekrar):** Bu prosedürel; girişsiz+CC0+RPM-tepkili GERÇEK kayıtlı egzoz seti yok.
  Asphalt tarzı kayıtlı ses için kullanıcı ses dosyası sağlamalı ya da Kenney Audio CC0 ayrı entegre
  edilmeli (bundle + RPM crossfade). Prosedürel tarafta yapılabilecek gerçekçilik/çeşitlilik uygulandı.

### Test
- `npx tsc -b` temiz, `simTest.ts` 37/37, `npm run build` başarılı.
- Canlı: menü (CTA+3D araç) + ses (farklı tune) + yarış efektleri (hız çizgisi/boost/flaş) 0 hata.

---

## Faz 18 — Örnek-Tabanlı Motor Sesi (WAV loop + RPM crossfade) (2026-07-04)
**Durum:** ✅ Tamamlandı (işitsel onay kullanıcıda)

### Bağlam (PC kapanınca yarım kalan iş bu oturumda tamamlandı)
Faz 17 sonrası prosedürel motor yerine gerçek örnek-tabanlı motor sistemine geçiş başlanmıştı ama
commit edilmemişti. `audio.ts`'e sample motoru + `public/sounds/engine0-5.wav` eklenmişti.

### Sorun tespiti (yarım kalan işte)
Mevcut `public/sounds/engine0-5.wav` dosyalarının hepsinde `INAM="start up"` metadata'sı vardı ve
süreleri düzensizdi (0.62-0.86s) → RPM-kademeli LOOP seti değil, belirsiz kaynaklı/telifi belirsiz
placeholder sesler. Kod bunları "0=düşük RPM → 5=yüksek RPM sıralı seamless loop" varsayıyor; placeholder
loop'lanınca kötü/tık'lı ses verirdi.

### Karar (otonom): sentetik loop üreteci (belirsiz WAV → deterministik, telif-temiz)
- Belirsiz WAV'lar scratchpad'e yedeklendi, yerine `scripts/genEngineSamples.ts` ile üretilen 6
  seamless-loop motor tonu kondu. Gerekçe: girişsiz+CC0+RPM-kademeli GERÇEK kayıt seti pratikte yok
  (Faz 16/17 notu); en yüksek ROI = additive sentezi WAV'a "bake" etmek (gerçek-zamanlı 3 osilatörden
  çok daha zengin: 44 harmonik + alt-oktav lope + firing-senkron yanma darbeleri). Tamamen sentetik →
  telif/CC0 sorunu yok, tekrar-üretilebilir (script repo'da), `npm run gen:engine`.
- **Seamless loop garantisi:** loop uzunluğu temel periyodun TAM katı + tüm bileşenler f0-harmonik +
  alt-oktav için cycles ÇİFT → faz-sürekli, tık/pop yok.
- 6 kademe: f0 = 52→78→108→148→190→232 Hz (idle→redline). `audio.ts` playbackRate (0.9..1.45) ile
  RPM ince ayarı + üçgen-pencere gain crossfade yapıyor.

### `audio.ts` sağlamlık iyileştirmesi
- Motor ilk `startEngine`'de örnekler henüz async yüklenmemişse prosedürele düşüyor, ama önceden o yarış
  boyunca prosedürel kalıyordu (tutarsız). Eklendi: `loadEngineSamples` bitince motor prosedürel çalışıyorsa
  son `profile/tune` ile sample motoruna otomatik geçiş (`engineRunning`/`lastProfile`/`lastTune`).
- Fallback korundu: örnekler yüklenemezse (fetch/decode hatası) prosedürel 3-osilatör motoru devrede.

### Doğrulama (sayısal)
- Üretim: 6 WAV, mono/44100/16-bit, ~0.69-0.77s, NaN yok, peak 0.62 (headroom, clipping yok).
- **Seamless dikiş:** loop başı↔sonu farkı seamGap 0.0022-0.0261 (≤%2 tepe, duyulmaz), türev sıçraması
  ≤0.0135 → loop'ta pop yok.
- `npx tsc -b` temiz, `npm run build` başarılı, `simTest.ts` 37/37.
- **İşitsel test kullanıcıda:** ses işitsel olduğu + otomasyon penceresi occluded (RAF durur) olduğu için
  gerçek dinleme görünür sekmede yapılmalı. Kod: WAV header geçerli PCM, graph node kurulumu build-temiz.

### Test edilmesi gerekenler (kullanıcı — görünür sekme)
1. Yarışa gir → motor sesi gerçek "loop" gibi mi (prosedürel uğultudan zengin mi)?
2. Gaz/RPM değişiminde perde ve crossfade pürüzsüz mü, tık/pop var mı?
3. Farklı araçlar (farklı tune) hafif farklı seslenmeli.
4. Drift/nitro/çarpışma sesleri sample modunda da çalışıyor mu?

---

## Faz 19 — Mobil Kontrol Düzeltmesi (buton+gyro birlikte + gyro işaret) (2026-07-05)
**Durum:** ✅ Kodlandı (gyro işaret yönü gerçek cihazda doğrulanmalı)

### Kullanıcı şikayeti
"Mobilde kontrol sıkıntısı: hem yön tuşu hem ekran döndürme (gyro) aynı anda olmalı; gyro ters/ayna
çalışıyor, normal düz olmalı."

### Kök neden
- `input.ts read()`: `controlMode` 'tilt' ise SADECE gyro, 'buttons' ise SADECE buton okunuyordu →
  ikisi asla birlikte çalışmıyordu.
- `HUD.tsx`: yön butonları yalnızca `controlMode === 'buttons'` iken render ediliyordu → tilt modunda
  ekranda yön tuşu yoktu.
- `input.ts onOrientation`: landscape işareti (`angle===90 → +e.beta`) kullanıcının cihazında ters
  yönde direksiyon veriyordu.

### Çözüm
- **read() birleştirildi:** öncelik klavye > dokunmatik buton > gyro. Buton ve gyro AYNI ANDA aktif;
  butona basılıyken buton kazanır, bırakınca telefon eğme devreye girer (`gyroLive()` kontrolüyle).
  Artık `controlMode` read()'i gate'lemiyor.
- **HUD:** yön butonları HER ZAMAN görünür + buton-layout (`hud-buttons`) her zaman uygulanır (fren/nitro/
  drift steer ile çakışmaz).
- **Gyro işaret çevrildi:** `angle===90 → -e.beta`, `angle===270/-90 → +e.beta` (her iki landscape yönü
  simetrik) → sağa yatır = araç sağa (düz, ters ayna değil).
- **MenuScreen:** "📱 Eğ" → "📱 Eğ + Buton" (bu mod artık gyro + buton birlikte).

### Test
- `npx tsc -b` temiz, `npm run build` başarılı.
- **Gerçek cihaz testi (kullanıcı — HTTPS/deploy gerekir):** (1) tilt modunda hem eğme hem yön tuşu
  çalışıyor mu, (2) sağa yatırınca araç sağa mı (düz), (3) buton modu tek başına çalışıyor mu.
- NOT: gyro işaret yönü cihaz/tutuşa göre değişebilir; hâlâ ters gelirse `input.ts onOrientation`'daki
  iki `e.beta` işareti tek adımda geri çevrilir.

---

## Faz 20 — Gerçekçi SFX (drift/nitro/crash offline-render WAV) (2026-07-05)
**Durum:** ✅ Kodlandı (işitsel onay kullanıcıda)

### Kullanıcı şikayeti
"Drift sesleri hâlâ saçma; bütün sesleri gerçekçi yap dedim."

### Kök neden
Motor Faz 18'de WAV'a taşındı ama drift/nitro/crash HÂLÂ gerçek-zamanlı prosedüreldi. Drift'te
bandpass + LFO frekans süpürmesi (8.5Hz, depth 350) müzikal "wiii-woo" artefaktı üretiyordu — gerçek
lastik cızırtısı değil.

### Çözüm — `scripts/genSfx.ts` (offline çok-katmanlı sentez → WAV)
Gerçek-zamanlı 2-3 filtreyle imkânsız olan katmanlamayı offline render ile yaptım:
- **drift.wav (loop 2.4s):** geniş bant "shhh" (asfalt) + 3 yüksek formant bandpass (2.25/3.3/4.7kHz
  stick-slip screech) + alt "grind" (300Hz gövde), hepsi YAVAŞ KAOTİK zarfla modüle (band-limitli gürültü,
  müzikal LFO YOK → doğal titrek karakter). Seamless loop (0.2s crossfade).
- **nitro.wav (loop 2.0s):** basınçlı hava/jet — highpass + peaking rezonans + orta bant, whoosh.
- **crash.wav (one-shot 0.7s):** impact (thud+crack) + MODAL metalik çınlama (5 inharmonik decaying
  sinüs: 1.28/2.13/3.56/5.18/6.42kHz, onset zarflı) + debris kuyruğu → gerçek sac/tampon tınısı.
- RBJ biquad (Direct Form I) Node'da elle uygulandı; deterministik (tekrar-üretilebilir), CC0.

### `audio.ts` entegrasyonu
- `loadSfx()` drift/nitro/crash decode; `setupSfxLoops()` drift+nitro loop kaynaklarını (gain 0) sürekli
  çalar başlatır, `update()` mevcut gain mantığıyla açar. init()'teki eski prosedürel drift/nitro sentezi
  kaldırıldı.
- `crash()` örnek öncelikli (intensity gain ile), örnek yoksa prosedürel fallback korundu.
- `npm run gen:sfx` scripti eklendi.

### Doğrulama
- Üretim: 3 WAV, mono/44100/16-bit, NaN/clipping yok, peak ≤0.92. Loop dikişleri gürültü-tabanlı sinyal
  için beklenen seviyede (crossfade zarf sürekliliğini sağlar; broadband içerikte tek-örnek farkı duyulmaz).
- `npx tsc -b` temiz, `npm run build` başarılı, `simTest.ts` 37/37.
- İşitsel test kullanıcıda (görünür sekme): drift artık lastik cızırtısı mı, crash metalik mi?

---

## Faz 21 — Mobil Görsel Kalite (PC'ye eşitleme) (2026-07-05)
**Durum:** ✅ Kodlandı

### Kullanıcı şikayeti
"Mobildeki görüntü PC'den farklı, resmen eski sürüm; PC kalitesiyle aynı olsun."

### Kök neden (kanıt: `quality.ts`)
Service worker/PWA cache YOK → "eski sürüm" cache değil, mobil RENDER ayarları:
`antialias` mobilde TAMAMEN kapalı (tırtıklı kenar = ucuz görünüm), `dpr` 1.35 (PC 1.9, bulanık),
gölge `soft` değil, çevre objeleri seyrek (`stepMul` 1.6 → boş sahne). Toplamı mobili ilkel gösteriyordu.

### Çözüm (`quality.ts` + `App.tsx`)
Mobil kalite PC'ye yaklaştırıldı, yalnızca gerçekten zayıf cihaz (`lowEnd`, ≤4 çekirdek) için güvenlik:
- `dpr`: mobil 1.35→**2.0** (lowEnd 1.5), `antialias`: mobilde artık **açık** (yalnızca lowEnd kapalı),
  `shadows`: mobilde **soft** (lowEnd hariç), `shadowMap` mobil 1536→**2048**, `stepMul` 1.6→**1.15**
  (daha dolu sahne), `crowdMul` 1.5→**1.2**.
- **Not:** modern telefon bunu kaldırır; lowEnd güvenlik ağı var. FPS düşerse eşikler ayarlanır.

### Cache-control (`vercel.json` — yeni)
"Eski sürüm" cache riskine karşı: `/assets/*` (hash'li) immutable, `/index.html` + `/` no-cache →
her deploy'da mobil taze index alır. (Service worker olmadığından asıl mesele deploy edilmiş kod.)

### ⚠️ Kullanıcı aksiyonu (KRİTİK)
Yeni kod mobilde ancak **deploy sonrası** görünür. `git push` yeter değil — `vercel --prod` ile deploy
edilmeli. Mobilde hâlâ eski görünüyorsa tarayıcı sekmesini kapatıp yeniden aç (hard refresh).

### Doğrulama
- `npx tsc -b` temiz, `npm run build` başarılı, `simTest.ts` 37/37.
- Görsel/FPS testi kullanıcıda (gerçek telefon, deploy sonrası): kenarlar pürüzsüz mü, sahne dolu mu, FPS iyi mi?

---

## Faz 22 — Gerçekçi ses + çarpışma fiziği + yüksek hız performansı (2026-07-05)

### Yapılanlar
- **crash.wav yeniden yazıldı** (`scripts/genSfx.ts` → `renderCrash`): Kullanıcının "zil/çan sesi" şikayetinin
  kök nedeni, uzun sönümlü (0.34s'ye kadar) saf sinüs modal çınlamalardı. Tamamen kaldırıldı. Yerine:
  düşük darbe (thud) + geniş bant çatırtı (crack) + KISA sönümlü (≤0.13s) dar-bant GÜRÜLTÜ rezonansları
  (metal karakteri ama çınlamayan) + kaotik "kırılma" dokusu + debris. Süre 0.7→0.6s. Artık gerçek
  metal-ezilme sesi, zil değil.
- **drift.wav yeniden yazıldı** (`renderDrift`): Önceki saf filtrelenmiş gürültü ("shhh") lastik
  cıyaklaması gibi değildi. Gerçek stick-slip squeal TONAL: 600-1180Hz arası yavaş dalgalanan temel +
  2./3. harmonik + hızlı mikro-titreşim, kesik kesik (kaotik) genlik kapısı. Üstüne kısık asfalt
  sürtünme + alt grind. Artık tanınır lastik cıyaklaması.
- **Araç-araç çarpışması gerçekçi** (`carPhysics.ts` → `resolveCarCollision`): Eskiden sadece pozisyon
  ayrımı + minik açı sekmesi vardı (yetersiz). Şimdi hız vektörleri üzerinden MOMENTUM AKTARIMI:
  arkadan çarpan öndekini iter + kendi yavaşlar, yandan çarpma yanal savurur. Eşit kütle, restitution
  0.25, sert darbede kapanma hızıyla orantılı küçük enerji kaybı. Fonksiyon artık şiddet (m/s) döndürür.
  `resolveGhostCollision` (MP) da şiddet döndürür ama adalet için yerel hıza CEZA YOK.
- **Araç-araç için ayrı ses** (`audio.ts` → `bump()`): Duvar crash'inden farklı, daha tok gövde darbesi
  (düşük whump + düşük-Q gövde sürtmesi, çınlama yok). Gerçek-zamanlı prosedürel, şiddetle ölçeklenir.
  `Scene.tsx` çarpışma şiddetine göre ses volümü + kamera sarsıntısı uygular (200ms throttle).
- **260+ km/h kasma düzeltildi** (`index.css` `.fx-speedlines`/`.fx-boost`): Nitroda (yüksek hız) devreye
  giren `.fx-speedlines.boost` tam-ekran `conic-gradient` background swap'ı her seferinde full-screen
  yeniden raster tetikliyordu → kasma. Boost background swap kaldırıldı (mavi his zaten `.fx-boost`
  radial katmanından geliyor). Ayrıca FX katmanları GPU'ya terfi (`will-change:opacity` + `translateZ(0)`
  + `contain:strict`) → opaklık değişimleri artık repaint tetiklemiyor.

### Doğrulama
- `npm run gen:sfx` → drift/nitro/crash.wav yeniden üretildi (geçerli RIFF/WAVE).
- `npx tsc -p tsconfig.app.json` → değiştirdiğim dosyalarda (audio/carPhysics/Scene/genSfx) hata YOK.
- `npm run dev` → HTTP 200, sorunsuz açılıyor.
- Ses karakteri (crash/drift/bump) gerçek cihazda kullanıcı testi gerektirir (otomatik "duyulamaz").

### ÖNEMLİ NOT — klasöre karışmış yabancı kod ("yakala-beni")
- Klasör yeniden adlandırma/birleştirme sırasında **başka bir projenin (yakala-beni) 2D koşucu kaynak
  kodu** DidaGP/src içine karışmış: `src/game/engine.ts`, `physics.ts`, `scoring.ts`, `ghost.ts`,
  `bots/`, `skills/`, `characters/`, `track2d/`, `src/screens/`, `src/render2d/`, `src/net/`,
  `src/stores/`, `src/services/`, `GameCanvas2D.tsx`, `HUD.tsx`, `useInput.ts` vb.
- Bunlar App.tsx tarafından IMPORT EDİLMİYOR (oyun çalışır), AMA farklı bir `types.ts` beklediklerinden
  `tsc`/`npm run build`'i kırıyorlar. Gerçek DidaGP = 3D araba yarışı (`App.tsx`→`Scene`, `src/store/`
  tekil, `carPhysics.ts`, `audio.ts`). Bir sonraki oturumda bu yabancı dosyaların temizlenmesi
  kullanıcı onayıyla değerlendirilmeli (build'i düzeltir).

---

## Faz 23 — PatiRun yabancı kodunun temizlenmesi (2026-07-05)

### Sorun
Masaüstü klasör yeniden adlandırma/birleştirme kazasında **PatiRun** (2D koşucu oyunu) projesinin
kaynak kodu DidaGP/src içine karışmıştı. App.tsx bunları import ETMİYORDU (oyun çalışıyordu) ama farklı
bir `types.ts` (RunnerInput/SkillId/createRunner) beklediklerinden `tsc -b` / `npm run build`'i kırıyorlardı.

### Yöntem (silmeden önce doğrulama)
- `main.tsx`→`App.tsx` giriş noktasından gerçek import zinciri BFS ile izlendi (path alias YOK → izleme eksiksiz).
- Ulaşılabilen **42 dosya = DidaGP gerçek kodu**; ulaşılamayan **65 dosya = PatiRun**.
- DidaGP'nin 42 dosyasının HİÇBİRİNİN bu 65 dosyayı import etmediği doğrulandı → silme güvenli, DidaGP kodu değişmedi.
- `scripts/` de PatiRun'a bağımlı değil (`simTest.ts` yalnızca DidaGP carPhysics/track/cars kullanıyor).

### Silinen 65 dosya (55 kaynak + 10 test)
- **Komple klasörler:** `src/config/`, `src/render2d/`, `src/screens/` (13), `src/services/`, `src/stores/` (çoğul, 8),
  `src/game/bots/`, `src/game/characters/`, `src/game/skills/`, `src/game/track2d/`, `src/game/__tests__/` (10 test).
- **Ortak klasörlerdeki tekil dosyalar:** `src/components/{GameButtons,GameCanvas2D,HUD,RaceIntro,RotateOverlay,SettingsModal}.tsx`;
  `src/game/{badges,engine,ghost,physics,scoring,useInput}.ts`; `src/lib/{avatars,monitoring,profanity,shareCard,sound,tips}.ts`;
  `src/net/{interpolation,protocol,quickMatch,roomClient}.ts`.
- **Korunanlar:** `components/game/`, `components/ui/`, DidaGP `game/*` (audio, carPhysics, cars, track, types, xp...),
  `lib/{cloudSync,storage,supabase}`, `net/multiplayer.ts` (DidaGP MP), `store/` (tekil, 3 dosya).

### Doğrulama
- `npm run build` → **BAŞARILI** (exit 0): `tsc -b` temiz + `vite build` 648 modül, dist üretildi.
- `src/` artık tam olarak DidaGP'nin 41 kod dosyası + `index.css` içeriyor.

### Not
- PatiRun'ın kendi ayrı proje klasörüne / git deposuna DOKUNULMADI (kullanıcı talimatı — canlıda aktif proje).
- Bu silinen dosyalar zaten git'e commit'lenmemiş (untracked) yanlış kopyalardı; DidaGP git geçmişi etkilenmedi.

---

## Faz 24 — Gerçekçi Ses Sistemi (tam revizyon) (2026-07-10)
**Durum:** ✅ Tamamlandı

### Kullanıcı şikayeti
"Sesler çarpma egzoz vs. tüm sesler berbat; hepsi full gerçekçi olsun."

### Kök neden
Motor sesi statikti: rpm = hız/topSpeed LİNEER → tekdüze uğultu (gerçek araç sesi vites atarken
devir iner-çıkar). Tüm SFX tek katmanlıydı; egzoz/turbo/rüzgar/cam yoktu.

### Yapılanlar (`audio.ts` köklü revizyon + üreteçler)
- **SANAL 6 VİTESLİ ŞANZIMAN** (en büyük gerçekçilik kazancı): normalize hız → vites bandı +
  bant içi devir. Her viteste devir 0→redline tarar, vites atınca düşer; yükseltmede kısa gaz
  kesme (shiftCut), düşürmede rev-match blip. Histerezisli (bant sınırında titremez). HUD'a
  vites göstergesi eklendi (`hud-gear`, ses motoruyla senkron).
- **3 motor ailesi × 6 RPM loop** (`genEngineSamples.ts` yeniden yazıldı): muscle (V8 crossplane
  — çeyrek-oktav burble + güçlü lope), race (V10/V12 scream bandı), sport (I4/I6 çift-harmonik
  buzz). Profil → aile eşleşmesi + per-profil perde çarpanı (v8 0.86 … v12 1.22). Elektrikli
  prosedürel whine kaldı.
- **Turbo**: devirle yükselen ıslık (inline4/6, flat6) + vites yükseltmede blow-off "psshh".
- **Decel egzoz patlamaları (crackle)**: hız düşerken + devir yüksekken rastgele pop'lar
  (profil bazlı eğilim: V8 en çok, elektrik hiç).
- **Rüzgar + yol gürültüsü**: hızla açılan iki gürültü katmanı (hız hissi).
- **Duvar sürtme loop'u** (`scrape.wav`): sürekli duvar temasında grind + kıvılcım cızırtısı.
- **Cam kırılması** (`glass.wav`): sert çarpışmada (şiddet>0.55) crash'e katman.
- **Crash varyasyonu**: her çarpışma ±%15 playbackRate ile farklı tınlar.
- **Lastik sesi hız/kayma duyarlı**: drift loop gain slip+hızla, playbackRate hızla değişir.
- **Master compressor**: katmanlar toplanınca kırpılma yok, ses "yapışık".
- Yeni WAV'lar: engine-{muscle,race,sport}{0..5} (18), scrape, glass, pop, blowoff.
  Eski engine0-5.wav silindi. Tümü deterministik script üretimi (CC0, `npm run gen:engine/gen:sfx`).

### Test
- `tsc -b` temiz, build ✓, simTest 37/37 ✓ (eski "hız cezası yok" testi Faz 22 momentum
  fiziğine göre güncellendi). İşitsel onay kullanıcıda (görünür sekme + ses açık).

---

## Faz 25 — Gerçekçi Prosedürel Araç Gövdeleri (2026-07-10)
**Durum:** ✅ Tamamlandı — GÖRÜNTÜLÜ doğrulama ile

### Kullanıcı şikayeti
"Arabalar istediğim gibi olmadı, daha gerçekçi araba istiyorum."

### Karar (otonom): GLB → prosedürel loft gövde üreteci (`src/game/carBody.ts`)
Gerekçe: girişsiz+CC0+otomatik indirilebilir GERÇEKÇİ model seti yok (defalarca araştırıldı,
Sketchfab 401). Kenney/Quaternius low-poly "oyuncak" sınırı aşılamıyordu. Prosedürel üreteç:
- **Loft gövde**: yan profil spline'ı boyunca süperelips kesit süpürme (spor: yuvarlak kesit,
  arazi/pickup/van: köşeli). Plan görünümünde burun/kuyruk doğal incelir, yaklaşma açıları,
  pürüzsüz normaller. (İlk deneme ExtrudeGeometry+bevel idi — keskin köşelerde "diken" artefaktı
  üretti, loft'a geçildi.)
- **11 stil**: hyper, super, coupe, muscle, sedan, hatch, roadster, suv, offroad, pickup, van —
  hepsi çamurluk kabartılı profiller (tekerlek üstü fender çizgisi), 30 araca eşlendi.
- **Koyu cam kabin** (tumblehome: yukarı doğru içe eğik — gövdeyle z-fighting da çözer).
- **Görünür detaylı tekerlek**: lastik HALKA (torus, dolu silindir jantı örtüyordu → düzeltildi),
  krom jant çemberi + 6 tel + göbek dış yüzde, fren diski + kırmızı kaliper tellerin arasından
  görünür, arch açıklığı diski + çamurluk kavisi (flare).
- **LED far/stop**: far yuvası+mercek+DRL şeridi önde; tam genişlik LED stop barı arkada
  (fren farı animasyonu korundu), ızgara, tampon, difüzör (spor), yan etek, pickup kasası.
- `CarModel.tsx` yeniden yazıldı: aynı arayüz (Scene/garaj değişmedi), userData.role →
  malzeme ataması, tekerlek holder(direksiyon Y)/spin(yanal Z) grupları. GLTF/atlas/preload
  kodu kaldırıldı → ağ isteği yok, Suspense gerekmez.
- `public/models/` (tüm GLB'ler) + `carModels.ts` kaldırıldı (~1.2MB deploy küçüldü).
  Krediler ekranı güncellendi (özgün prosedürel üretim + eski sürüm teşekkürü).

### Görsel doğrulama yöntemi (YENİ — bu projede ilk)
`carview.html` + `src/dev/carview.ts` (dev-only harness, occluded sekmede setInterval render) +
scratchpad'e PNG kaydeden yerel sunucu → ekran görüntüleri GÖZLE incelendi, 5 iterasyon yapıldı:
(1) kutu gövdeler ✓ → (2) çamurluk diskleri kaputa taşıyor → profillere fender kabartısı,
(3) spline uç taşması "boynuz" → loft'a geçiş, (4) alt gövde/tamponlar taşıyor → küçültüldü,
(5) jantlar kara delik → lastik torus + jant dış yüze. Son durum: sedan/hyper/offroad/muscle
gerçek araç gibi okunuyor (krom jant, kavisli boya, cam kabin).

### Test
- tsc/build/simTest 37/37 ✓. Canlı: menü + garaj 30 kart + yarış sahnesi 0 konsol hatası.

---

## Faz 26 — Performans (kasma) + Multiplayer Tam Senkron (2026-07-10)
**Durum:** ✅ Tamamlandı

### Kullanıcı şikayeti
"Oyun kasıyor" + "telefonda full senkron olsun."

### Performans — Adaptif Kalite (`App.tsx` AdaptiveQuality)
- Kök neden: Faz 21 mobil kaliteyi PC'ye eşitlerken (dpr 2.0 + AA + soft gölge) zayıf cihazlarda
  kasma yarattı. Sabit ayar iki hedefi birden tutturamaz.
- Çözüm: FPS 1.5 sn pencerelerle ölçülür; <42 FPS → render çözünürlüğü kademeli düşer (×0.85),
  >56 FPS → geri yükselir. Her cihaz kendi dengesini bulur; görsel kalite ayarları (AA, gölge,
  çevre yoğunluğu) korunur. Başlangıç dpr: PC 2.0 / mobil 1.8 / zayıf 1.4; gölge haritası
  mobil 1536 (2048 pahalıydı). Prosedürel araçlar da GLB fetch'i kaldırarak yüklemeyi hızlandırdı.

### Multiplayer senkron
- Gönderim 10Hz → **15Hz** (`sendState` 66ms throttle; Supabase istemcisi `eventsPerSecond: 20`).
- **Snapshot interpolasyonu**: son 2 paket tamponlanır (`snapPrev/snapCur`), uzak araçlar
  130ms render gecikmesiyle iki örnek ARASINDA sürekli interpolasyonla çizilir → paket aralığında
  ışınlanma/titreme yok. Paket gecikirse hız yönünde maks 300ms dead-reckoning ekstrapolasyonu.
  Adalet modeli değişmedi (uzak pozisyon otoriter, yerel hız cezası yok).

### Test
- tsc/build ✓, simTest 37/37 ✓, canlı smoke (menü→yarış+HUD+vites göstergesi) 0 konsol hatası.
- Gerçek FPS/senkron testi kullanıcıda (deploy sonrası, 2 cihaz).

### Kullanıcının yapması gerekenler
1. **Deploy**: `vercel --prod` (yeni kod telefonda ancak deploy sonrası görünür; index.html
   no-cache olduğundan hard refresh gerekmeyebilir, gerekirse sekmeyi kapat-aç).
2. Telefonda test: kasma bitti mi (adaptif sistem ilk ~5 sn içinde dengeyi bulur), araç
   görselleri, motor sesi (vites atışları duyulmalı), drift/çarpma/cam/duvar sürtme sesleri.
3. İki cihazla multiplayer: rakip araçlar akıcı mı (ışınlanma yok)?
4. Not: `supabase/migrations/` klasörü PatiRun'a aitti, kaldırıldı (DidaGP şeması `supabase/schema.sql`).

---

## Faz 27 — KASMA KÖK NEDENİ: draw call patlaması (2026-07-10)
**Durum:** ✅ Düzeltildi — sayısal kanıtla

### Kullanıcı şikayeti
"Oyun inanılmaz kasıyor, oynanmıyor." (Not: Claude Code'un arkada çalışması İLGİSİZ — oyun
tarayıcıda çalışır; kasma oyunun render yükünden.)

### Kök neden (ölçüldü)
Faz 25 prosedürel araçları ARAÇ BAŞINA 76 AYRI MESH üretiyordu (jant telleri×24, arch diskleri,
tampon/far/fin parçaları...). 11 araçlık test sahnesinde 326 draw call; yarışta 6 araç + gölge
geçişi + çevre → CPU draw-call darboğazı. AdaptiveQuality (Faz 26) GPU çözünürlüğünü düşürür ama
CPU draw-call yükünü ÇÖZEMEZ — bu yüzden kasma sürdü.

### Çözüm (`carBody.ts`)
1. **Rol bazlı geometri birleştirme** (`consolidateStatic` + `bakeGeo`): tüm statik parçalar
   (gövde+flare→paint, tamponlar/arch/ızgara→dark, farlar→head...) malzeme rolü başına TEK
   mesh'e merge edilir (BufferGeometryUtils.mergeGeometries, transform bake + uv temizliği).
2. **Tekerlek birleştirme**: 11 mesh/teker → tire(torus+kapak) 1 + rim(göbek+çember+6 tel) 1
   (+ detaylı modda disk+kaliper 2). Bot/uzak oyuncu tekerleri 2 mesh.
3. **Gövde cache'i**: spec+detay anahtarıyla bir kez üretilir, örnekler `.clone(true)` ile
   GEOMETRİYİ PAYLAŞIR (garaj 30 kart + botlar). `<primitive dispose={null}>` eklendi —
   paylaşılan geometri unmount'ta dispose edilmez (aksi diğer örnekleri bozar).

### Sayısal kanıt (carview stats, 11 araç aynı sahne)
- Draw call: **326 → 55** (~6×), mesh/araç: **76 → 22**, üçgen sayısı aynı (~77k, görsel fark yok).
- Görsel doğrulama: v6 ekran görüntüleri v5 ile birebir (sedan yan + genel bakış).

### Test
- tsc temiz, build ✓, simTest 37/37 ✓, canlı smoke (garaj 30 kart + yarış) 0 konsol hatası.

---

## Faz 28 — KASMANIN GERÇEK KÖK NEDENİ: Chrome donanım hızlandırma KAPALI (2026-07-10)
**Durum:** ✅ Teşhis kanıtlı + oyun tarafı önlem alındı; ASIL ÇÖZÜM KULLANICIDA

### Teşhis süreci (kanıt zinciri)
1. Faz 27 (draw call 326→55) canlıdaydı ama kasma sürdü → araç/draw-call hipotezi yetersiz.
2. Görünür sekmede canlı ölçüm: yarış süresi 1 dakikada yalnızca 0.3 sn ilerledi → kare başına ~10 SANİYE.
3. Çözünürlük 4× düşürüldü → HİÇ değişmedi → piksel maliyeti değil.
4. `gl.render` süresi ölçüldü: **42ms** (normal) → three.js/fizik/sahne DEĞİL.
5. WebGL kimliği: **"ANGLE (Microsoft, Microsoft Basic Render Driver ...)"** → WebGL YAZILIMDA
   (CPU) çalışıyor. Windows'ta `Win32_VideoController`: AMD Radeon Graphics, sürücü OK →
   GPU sağlam, **Chrome donanım hızlandırmayı kullanmıyor** (ayar kapalı veya GPU süreci düşmüş).

### Oyun tarafı önlem (`quality.ts` + App/Scene/CarModel)
- `detectSoftwareGL()`: UNMASKED_RENDERER'da basic render/swiftshader/llvmpipe tespiti.
- softwareGL modunda: dpr 0.6, antialias kapalı, GÖLGE tamamen kapalı, Sky/Stars/IBL env yok,
  clearcoat Physical yerine Standard malzeme, çevre yoğunluğu stepMul 3 / crowdMul 3.
- Menüde kalıcı kırmızı uyarı: "donanım hızlandırma kapalı — Chrome → Ayarlar → Sistem →
  grafik hızlandırmayı açın".
- Dev-only teşhis kancası (`window.__didagpStats` + gl.render süre ölçümü) App.tsx'te (yalnız DEV).

### KULLANICI AKSİYONU (asıl çözüm — bunsuz oyun bu PC'de akıcı OLMAZ)
1. Chrome → Ayarlar → Sistem → "Kullanılabilir olduğunda grafik hızlandırmayı kullan" AÇIK →
   Chrome'u tamamen kapat-aç.
2. Doğrulama: chrome://gpu → "WebGL: Hardware accelerated" görülmeli.
3. Hâlâ Basic Render Driver ise: Windows Ayarlar → Sistem → Ekran → Grafik → Chrome için
   "Yüksek performans" seç; AMD sürücüsünü güncelle.

---

## Faz 29 — Multiplayer isim etiketleri (2026-07-11)
**Durum:** ✅ Tamamlandı, görsel doğrulama yapıldı

### Ne yapıldı
- `CarModel`'e opsiyonel `label` prop'u: aracın üstünde kameraya dönük isim etiketi
  (THREE.Sprite + tek seferlik CanvasTexture — draw call maliyeti ~0, useFrame'de ek iş yok).
- `Scene.tsx` RemoteCars: her uzak oyuncuya `label={p.name}` bağlandı (isim zaten presence'ta vardı).
- Etiket: yuvarlak köşeli yarı saydam koyu arka plan + beyaz kalın yazı; 16+ karakter "…" ile
  kısaltılır; depthTest kapalı (duvar/araç arkasında da okunur), fog'dan etkilenmez.

### Otonom kararlar
- Kendi ekranında KENDİ adın gösterilmiyor (kamera arkadan baktığı için görüşü kapatırdı;
  yaygın oyun pratiği). Arkadaşların ekranında senin arabanın üstünde adın görünür.
- Solo modda botlara etiket eklenmedi (istek "arkadaşlarla oynarken" idi; istenirse tek satır).

### Test
- tsc temiz, build ✓.
- Görsel doğrulama (carview + snapserver düzeneği): etiket konumu/okunurluğu/kısaltma
  ekran görüntüsüyle kanıtlandı; test kodu doğrulama sonrası carview'dan geri alındı.

---

## Faz 30 — Multiplayer akış boşlukları: pause/çıkış, lobiye dönüş, oda doğrulama (2026-07-11)
**Durum:** ✅ Tamamlandı, 2 sekmeli canlı Supabase testiyle uçtan uca doğrulandı

Kullanıcı şikâyeti: "yarış bitmeden çıkamıyorum, ana menüye dönemiyorum, oda kurma sorunlu —
arkadaşlarımla oynayamadım." Tespit edilen 7 boşluk ve çözümleri:

### 1. KRİTİK — "Lobiye Dön" aynı yarışı anında yeniden başlatıyordu
- **Kök neden:** `multiplayer.raceStart` yarış sonrası temizlenmiyordu; lobi ekranı her presence
  sync'te "raceStart var → yarışa gir" diyordu. Arkadaş grubu yarış sonrası lobiye dönemiyordu.
- **Çözüm:** `returnToLobby()` (raceStart=null + roomStatus='waiting' + lobi ilanı güncelle) —
  ResultsScreen "LOBİYE DÖN" ve pause menüsünden çağrılır. Ek güvenlik: yarışa geçiş artık
  App seviyesinde `startAt` damgası ile korunur (aynı yarış iki kez başlatılamaz).

### 2. KRİTİK — Yarış içinden çıkış yoktu (pause menüsü eklendi)
- HUD'a ⏸ butonu + Escape kısayolu → `PauseOverlay`: DEVAM ET / YENİDEN BAŞLAT (solo) /
  YARIŞI BIRAK—LOBİYE DÖN (multi) / ANA MENÜ.
- **Solo:** fizik + kronometre tamamen donar (bot dahil), motor sesi rölantiye iner.
- **Multi (otonom karar):** diğer oyuncular bekletilemeyeceği için yarış arka planda sürer;
  menüde bu açıkça yazar ("çıkarsan DNF sayılırsın"). Endüstri standardı davranış.

### 3. Yarıda bırakan oyuncu = DNF (yeni 'quit' broadcast'i)
- Çıkan oyuncu `quit` yayını yapar → diğerlerinde aracı pistten kalkar (RemoteCars filtresi),
  minimap'ten düşer, çarpışma hedefi olmaz, sonuç tablosunda DNF yazar, sıralamayı bozmaz.
- Ayrıca DNF pozisyon bug'ı düzeltildi: finishTime<0 olan "bitmiş" oyuncu öne geçmiş sayılmaz.

### 4. İkinci yarışta önceki yarışın durumu taşınıyordu
- 'start' geldiğinde/gönderildiğinde tüm uzak oyuncuların yarış alanları sıfırlanır
  (finished/finishTime/quit/lap/trackIndex/snapshot'lar) → art arda yarışlar temiz başlar.

### 5. Olmayan oda koduna katılım "başarılı" görünüyordu
- Supabase kanalları anında var olduğundan yanlış kod sessizce boş odaya düşüyordu (arkadaşlar
  "aynı odadayız" sanıp birbirini göremiyordu — şikâyetin muhtemel ana kaynağı).
- **Çözüm:** katılımda presence sync beklenir (3 sn'ye kadar); host meta'lı üye yoksa
  "Oda bulunamadı — kodu kontrol et" hatasıyla geri çıkılır. Kapasite kontrolü de artık sync
  SONRASI yapılır (önceden players.size=0 iken kontrol ediliyordu → 6/6 engeli çalışmıyordu).

### 6. Host odadan çıkınca oda ölüyordu → host devri
- Presence sync'te host meta'sı görünmüyorsa en küçük id'li üye otomatik yeni host olur
  (deterministik — çakışma yok), presence'ını host=true ile tazeler ve odayı lobide ilan eder.

### 7. Küçük onarımlar
- Lobi ilanındaki oyuncu sayısı/durum artık her presence değişiminde güncellenir (önceden oda
  kurulurken 1/6 yazıp öyle kalıyordu).
- Kanal koptuğunda (CHANNEL_ERROR/TIMED_OUT) "Sunucu bağlantısı koptu" hatası gösterilir.
- Sonuç ekranı multi'de CANLI: arkadaşlar bitirdikçe süreleri tabloya düşer (önceden senin
  bitirdiğin andaki donmuş görüntü kalıyordu). Sonuç ekranındayken host yeni yarış başlatırsa
  otomatik katılırsın.
- Açık odalar listesindeki KATIL butonuna busy koruması; oda içinde bekleyen oyuncuya durum
  metni ("Yarış sürüyor…"); ölü `lobby-scan` kanalı kaldırıldı.

### Test (canlı Supabase, 2 sekme)
- tsc temiz, production build ✓, headless simTest **37/37** ✓.
- Uçtan uca: oda kur (ASEJ3) → yanlış kodla katıl ("Oda bulunamadı" ✓) → doğru kodla katıl
  (2/6 iki tarafta ✓) → host yarışı başlattı (ikisi de yarışa girdi ✓) → katılan pause→lobiye
  döndü (yarış YENİDEN BAŞLAMADI ✓ — eski kritik bug) → host da döndü → host 2. yarışı başlattı
  (lobidekiler otomatik girdi ✓) → host ANA MENÜ ile çıktı → kalan oyuncu otomatik host oldu
  (YARIŞI BAŞLAT görünür ✓). Solo: pause→YENİDEN BAŞLAT ✓, pause→ANA MENÜ ✓. Konsol hatası 0.

### Sonraki oturum notu
- Gerçek çoklu-cihaz (telefon) testi kullanıcıda; kod tarafı tamam.

---

## Faz 31 — Hasar sistemi + profesyonel bot AI + çarpışma sesleri + radikal araç görsel revizyonu (2026-07-11)
**Durum:** ✅ Tamamlandı — carview görsel iterasyonu (6 sürüm) + 44/44 headless test + canlı smoke

Kullanıcı istekleri: (1) çarpma sesleri hâlâ yetersiz, (2) aşırı çarpışmada hasar → duman → yangın,
(3) botlar çok kolay yeniliyor — profesyonel rekabet, (4) araç görsellerinde radikal değişiklik,
gerçek/orijinal araçlara çok daha fazla benzesin.

### 1. Çarpışma sesleri (genSfx.ts + audio.ts)
- **crash.wav yeniden üretildi:** sub-bas şok dalgası (120→48Hz çöküş — "göğüste hissedilen"
  ağırlık) + gecikmeli ikinci sac buruşma dalgası + daha uzun debris (0.6→0.85s). Çalınırken 1.3×
  gain (master compressor kırpılmayı önler).
- **bump.wav YENİ (araç-araç):** offline render tok gövde darbesi (sub 105→45Hz + panel + sac
  takırtısı). `audio.bump()` artık örnek-öncelikli; 0.6+ şiddette crash katmanı da eklenir.
  Prosedürel fallback korundu.
- **Şiddet eşlemesi gerçek darbeye bağlandı:** duvar sesi artık hıza değil YANAL çarpma hızına
  (`wallImpact`) orantılı — sıyırma scrape loop'unda kalır, dik dalış gümbürder.

### 2. Hasar sistemi (carPhysics + DamageFx + HUD + MP)
- `CarState.damage` (0..1) + `wallImpact`. Birikim: araç-araç `resolveCarCollision` iki tarafa
  (kapanma hızı >4 m/s eşiği — hafif bump'lar cezasız), MP hayalet çarpışması yerel araca (0.55×),
  duvara dik dalış `vLat×1.5`, sürekli duvar sürtmesi yavaş birikim.
- **Eşikler:** 0.35+ kaputtan duman (hasarla koyulaşır/yoğunlaşır), 0.8+ YANGIN (alev + kara
  duman + HUD'da yanıp sönen 🔥 HASAR barı).
- **Performans cezası:** tam hasarda maks. hız −%18, ivme −%30 (lineer) — yarışı bitirmez ama
  pervasız sürüş cezalandırılır. Doğrulama: 10 sn'de sağlam 154 km/s vs tam hasarlı 113 km/s.
- **DamageFx.tsx (yeni):** instanced duman (96) + additive alev (48) havuzları = 2 draw call.
  Oyuncu + botlar + uzak oyuncular aynı sistemden emit eder.
- **MP senkronu:** `damage` pos paketine ve `RemotePlayerState`'e eklendi → arkadaşının dumanı/
  alevi senin ekranında görünür. Yarış resetinde sıfırlanır.
- **HUD:** nitro barının üstünde hasar barı (sarı→turuncu→kırmızı, yangında blink animasyonu).
- **Yan bug düzeltmesi:** `wallHits` temas süresince HER KAREDE artıyordu → kenar tespitli
  (temasın ilk anı) yapıldı; temiz tur/XP istatistiği artık doğru.

### 3. Profesyonel bot AI (`src/game/botAI.ts` — yeni saf modül)
- **Viraj eğriliği analizi:** pist örneklerinden önceden hesaplanan eğrilik → viraj hız limiti
  (√(aLat/curv)) + fren mesafesi planı → botlar viraja GİRMEDEN fren yapar, düzlükte tam gaz.
- **Yarış hattı:** pure-pursuit hedefi yakın+uzak örnek kirişi → apex'i doğal keser; düzlükte
  kendi şeridine döner (sollama çeşitliliği). Hedef pist sınırına kenetlenir.
- **Nitro yönetimi:** yalnız düzlükte, enerji >0.4 iken.
- **Rubber-band (`updatePace`):** oyuncuya göre tur farkı → geride kalan bot +%16'ya dek hızlanır;
  öne kaçan bot mesafeyle orantılı nefes bırakır (usta bot maks −%9, çaylak −%17) → yarış hep
  temaslı ama 1.lik kazanılması gereken şey.
- **Kademe:** skill 0.78-1.0, hız tavanı 37-47 m/s (eski 34-44; throttle artık hep 1.0 — eski
  botlar 0.82 gazla sürüyordu). Doğrulama (`scripts/botTune.ts`, yeni): 5 pistte 9 koşu — SIFIR
  duvar teması, NaN yok; usta bot turu 60-80s (oyuncu iyi temposu), kademeler ayrışıyor.
- simTest'in eski bot yol-takipçisi test amaçlı korundu (Scene artık botAI kullanır).

### 4. Radikal araç görsel revizyonu (`carBody.ts` — 6 iterasyonlu carview doğrulaması)
- **Boyalı tavan + A/B/C sütunları (en büyük kazanç):** kabin artık tek cam fanus değil —
  tavan kaporta renginde panel, A/C sütunları kaporta (süper/hiperde blackout), B sütunu siyah.
  Sütunlar iki 3D uç noktadan quaternion ile hizalanır (tumblehome'u izler, dışarı taşmaz).
- **Beltline omuz çizgisi:** loft kesitine belt hizasında dışa kabartı → "tüp/sabun" yan yüzey
  bitti, gerçek kaporta omzu geldi (uçlara doğru söner).
- **Yüz karakterleri (`FaceKind`):** sport (geniş alçak ağız + çekik far + DRL), muscle (dik
  ızgara + ÇİFT YUVARLAK far), classic (krom bar + dikdörtgen far), ev (kapalı burun + tam
  genişlik ışık barı), offroad (dikey dilim ızgara + yuvarlak far + kırmızı çeki kancaları),
  cyber (tek LED şerit).
- **İmza parçalar (`FeatKind`):** wing (uç plakalı yarış kanadı — Jesko/Toro/GTR/Orman Kurdu),
  hoodScoop (kas), roofScoop + sideIntake (orta motor süper), spare + roofRack (Wrangler/
  Defender/Rivian), twoToneRoof (Mini/taksi), ducktail (Chiron/SF Rosso/Supra...).
- **YENİ 'cyber' gövde stili:** spline'sız keskin kırık profil + az dilim + creased normals =
  düz metal facetler; ön cam kanopi değil GÖVDE EĞİMİNE YATIK panel (paslanmaz kama karakteri).
  Cyber Kaya artık gerçek muadili gibi okunuyor.
- **EV'ler:** Volt Plaid/Taycan/Rivian kapalı burun + ışık barı; sedanlara spor yüz (M-Wolf, RS).
- **Performans korundu:** rol bazlı merge sayesinde araç başına hâlâ 22 mesh (Faz 27 disiplini);
  14 araçlık test sahnesi 77 draw call (~5.5/araç).
- Düzeltilen iterasyon hataları: kalın kafes-gibi sütunlar → ince/gömülü/quaternion; cyber camı
  gövdeye gömülüydü → profilden konumlandırıldı; van'da tavan paneli ön camı kapatıyordu →
  noPillars; kas ızgarası taşıyordu → daraltıldı.

### Test
- `tsc -b` temiz, production build ✓, **simTest 44/44** (yeni Test 13: hasar eşikleri, hafif
  temas hasarsızlığı, duvar darbesi, kenar tespitli wallHits, performans cezası, 1.0 tavanı).
- `scripts/botTune.ts`: 5 pist × 3 bot — hepsi turu tamamladı, 0 duvar teması.
- Canlı smoke (dev): menü → pist seç → yarış HUD mount ✓, garaj 30 kart ✓, 0 konsol hatası.
- Görsel doğrulama: carview + snapserver, v1→v6 ekran görüntüleriyle GÖZLE (scratchpad PNG'leri).

---

## Faz 32 — Kişiselleştirme canlı güncellenmiyordu (KRİTİK BUG, düzeltildi) (2026-07-11)
**Durum:** ✅ Tamamlandı — canlı DOM + store doğrulamasıyla

### Kullanıcı şikayeti
"Araba kişiselleştirmelerin hiçbiri çalışmıyor — neyi kişiselleştirirsem anında ekranda değişmeli."

### Kök neden (kanıtlandı)
Zustand'da `useGarageStore((s) => s.getCustomization)` gibi abonelikler **fonksiyon referansı**
seçiyordu; fonksiyon referansı store güncellemesinde DEĞİŞMEDİĞİ için bileşen asla yeniden render
olmuyordu. Canlı test: renk tıklanınca store güncelleniyor (`paintColor` değişti) ama aktif işaret
eski renkte kalıyordu (activeIdx 6, tıklanan 0). GarageScreen paneli ve dolayısıyla kullanıcının
gördüğü her şey donuktu; önizleme aracı da panelden bağımsız ayrı abonelikteydi.

### Çözüm — VERİYE abone ol, fonksiyona değil
- **GarageScreen:** `s.customizations[s.selectedCarId]`'ye abone (yoksa `defaultCustomization`
  fallback). `TurntableCar` artık kendi aboneliği yerine ebeveynden `custom` PROP'u alır →
  panel + 3D önizleme AYNI canlı veriden beslenir, her tıklama anında yansır.
- **Scene:** `playerCustom` aynı canlı aboneliğe geçirildi (mount-anı okuması kırılgandı).
- **MultiplayerScreen:** kimlik boyası (`setIdentity`) canlı `paintColor` aboneliğine geçirildi —
  garaja girip renk değiştiren oyuncunun MP rengi de günceldir.
- CarSelectScreen zaten `customizations` objesine abone olduğundan sağlamdı; HUD dashTheme
  seçicisi primitive döndürdüğünden sağlamdı (dokunulmadı).

### Doğrulama (canlı, dev)
- Renk noktası 3 tıklandı → aktif işaret ANINDA 3'e geçti; "Mat" finish → anında aktif;
  Spoiler sekmesi → varyant 2 → anında aktif. Store ile DOM birebir tutarlı
  (`{paintColor:#38b000, paintFinish:mat, spoiler:2}`). Konsol hatası 0.
- `tsc -b` temiz, production build ✓, simTest 44/44 ✓.
- NOT: 3D önizlemenin görsel dönüşü occluded otomasyon sekmesinde izlenemez (RAF durur — bilinen
  ortam kısıtı); veri akışı tek kaynağa bağlandığı için panelle aynı anda güncellenir.

---

### Kullanıcının test etmesi gerekenler (görünür sekme + ses açık)
0. **Garaj → Özelleştir:** renk/kaplama/jant/spoiler/egzoz... hangi seçeneğe tıklarsan tıkla,
   hem seçim işareti hem 3D araç ANINDA değişmeli.
1. Duvara sertçe çarp → gümbürtü + hasar barı; botlara çarp → tok gövde darbesi sesi.
2. Hasarı 0.35+ yap → kaputtan duman; 0.8+ → alev + kara duman + yanıp sönen 🔥 bar; hızın
   düştüğünü hisset (tam hasarda ~%18 maks. hız kaybı).
3. Solo yarış: botlar viraj öncesi fren yapıyor mu, düzlükte hızlı mı, yarış sonuna kadar
   rekabetçi mi (artık kolayca 1. olamamalısın; usta bot "Baran" en güçlüsü).
4. Garaj: boyalı tavan/sütunlar, kas araçta çift yuvarlak far, EV ışık barı, Cyber Kaya kaması,
   Wrangler/Defender yedek teker + tavan rayı, Jesko kanadı.

---

## Faz 35 — Yangın geri açıldı, hasar dengesi "uzun vade" ayarı (2026-07-15)
**Durum:** ✅ Tamamlandı — 54/54 headless test, tsc/build temiz

Kullanıcı isteği: yangını geri aç; duman 10 kat zor, yangın dumandan 5 kat zor olsun —
hemen değil, yarışın sonlarına doğru çıksın.

### Yeni denge (carPhysics.ts)
- `addDamage` böleni 46 → **805** (birikim ~17.5x yavaş) + duvar sıyırma birikimi
  0.014 → **0.0014**/sn. Eşikler: `DAMAGE_SMOKE` 0.35 → **0.2**, `DAMAGE_FIRE` yeniden
  eklendi = **0.99** (eşik oranı 4.95 ≈ 5).
- Sonuç (testle kanıtlı): duman ~**11 sert darbe** (20 m/s) veya ~2.5 dk sürekli duvar
  sıyırma ister (eski: TEK darbe!); yangın **~50 darbe eşdeğeri** = duman istismarının
  tam 5 katı → yalnızca yarış boyu pervasız sürüşte, en sonda görülür.
- Performans cezası mekanikleri aynı (tam hasar −%18 hız) ama tam hasara ulaşmak artık
  çok daha uzun sürer — ceza da doğal olarak kademeli geldi.

### Geri açılanlar
- `DamageFx`: alev havuzu + additive alev mesh'i (2 draw call'a dönüş), Scene fire emit,
  HUD 🔥 + blink (artık eşik sabitleri `carPhysics`'ten import ediliyor — tek kaynak),
  index.css damage-blink animasyonu.
- HUD renk merdiveni yeni eşiklere oturtuldu: sarı < 0.2 (duman) < turuncu < 0.6 < kırmızı,
  0.99+ yanıp sönen 🔥.

### Test
- simTest **54/54** ✓ (yeni: tek çarpışma duman çıkarmaz, eşik oranı ~5, dumana ~10 darbe,
  yangına ~50 darbe). tsc temiz, production build ✓.

---

## Faz 34 — Yangın kaldırıldı + yetişme nitrosu + mobil performans paketi (2026-07-15)
**Durum:** ✅ Tamamlandı — 50/50 headless test + tsc/build temiz + canlı smoke 0 hata

Kullanıcı istekleri: (1) araç yanma özelliğini kapat, (2) çok geride kalan TÜM oyunculara
kademeli otomatik nitro dolumu (1. farkı açamasın), (3) tüm oyun + mobil kontrol, kasma
olmasın (bazı telefonlarda kasıyor), (4) push + canlıya al.

### 1. Yangın özelliği kaldırıldı
- `DamageFx.tsx`: alev havuzu/mesh'i tamamen silindi (1 draw call kazancı); hasar dumanı
  (0.35+, hasarla koyulaşan) KORUNDU. `carPhysics.ts`: `DAMAGE_FIRE` kaldırıldı.
- `Scene.tsx`: fire emit satırı kaldırıldı. `HUD.tsx` + `index.css`: 🔥/blink kaldırıldı,
  hasar barı (sarı→turuncu→kırmızı) ve performans cezası (hasar sistemi) aynen duruyor.

### 2. Yetişme nitrosu (rubber-band, yeni özellik)
- `carPhysics.ts` → `catchupNitroRate(gapLaps)`: liderle fark 0.05 turdan (~3-5 sn) sonra
  başlar, 0.35 turda (~25-30 sn) tavan; eğri t^1.5 (kademeli: az geridekine az, çok
  geridekine çok). Tavan 0.28 nitro/sn < harcama 0.35/sn → bedava sonsuz nitro yok.
- `Scene.tsx`: pozisyon döngüsünde lider ilerlemesi bulunur; running && !finished iken
  oyuncunun nitrosu bu hızla dolar. Her istemci KENDİ aracı için yerel hesaplar → MP'de
  senkron veri gerektirmez, herkese aynı kural (adil). Lider/öndeki HİÇ yardım almaz.
- simTest Test 14 (6 kontrol): lider 0, eşik altı 0, monoton artış, tavan, harcama dengesi.

### 3. Mobil performans paketi (bazı telefonlarda kasma)
- `quality.ts`: mobil başlangıç dpr 1.8→1.5, lowEnd 1.4→1.2 (yüksek dpr kasmanın ana
  kaynağı; güçlü cihazda AdaptiveQuality zaten tavana çıkar). lowEnd (≤4 çekirdek mobil):
  gölge tamamen kapalı (araç altı temas gölgesi kalıyor) + cheapMaterials (clearcoat/Sky/
  Stars/IBL yok — softwareGL ile aynı kanıtlanmış yol). Mobil gölge haritası 1536→1024.
- `App.tsx`: mobilde 'soft' yerine ucuz PCF gölge; AdaptiveQuality penceresi 1.5→1.0 sn,
  fps<30'da büyük adım (−0.25) → kasan cihaz saniyeler içinde dengeye oturur; mobil taban
  pixel ratio 0.9→0.75 (akıcılık netlikten önce).

### Test
- tsc temiz, production build ✓, simTest **50/50** ✓ (6 yeni yetişme nitrosu testi).
- Canlı smoke (dev, Chrome): menü → garaj → yarış (racing fazı) 0 konsol hatası.
- Gerçek telefon FPS testi kullanıcıda (deploy sonrası); adaptif sistem ilk ~3 sn içinde
  çözünürlüğü cihaza göre ayarlar.

---

## Faz 33 — Canlıda "Odaya bağlanılamadı" (KÖK NEDEN: Vercel env typo, düzeltildi) (2026-07-13)
**Durum:** ✅ Tamamlandı — canlı sitede uçtan uca doğrulandı

### Kullanıcı şikayeti
"Hâlâ oda kuramıyorum, bağlanılamıyor diyor." (Önceki oturumda kod tarafı düzeltilmişti ama
sorun kodda değildi.)

### Teşhis süreci (kanıt zinciri)
1. Node'dan aynı anahtarlarla Realtime kanal aboneliği → BAŞARILI (Supabase tarafı sağlam).
2. localhost:5199'da tarayıcıda ODA KUR → oda kuruldu (BY4DC). Yerel sorunsuz.
3. **didagp.vercel.app'te ODA KUR → "⚠️ Odaya bağlanılamadı" BİREBİR YENİDEN ÜRETİLDİ.**
4. Ağ trafiği: canlı site `https://kevfltjxlfojq.supabase.co` adresine istek atıyordu —
   doğrusu `kevfltjxlfirbnxlfojq` ("irbnxlf" parçası eksik, kötü yapıştırma). Host DNS'te yok
   (curl exit 6) → WebSocket hiç kurulamıyor → her oda işlemi başarısız.

### Kök neden
Vercel'deki `VITE_SUPABASE_URL` production env değişkeni eksik karakterli girilmişti.
Vite env'i build anında gömdüğü için canlı paket yanlış adresle derlenmişti. Yerel `.env`
doğru olduğundan localhost'ta hata görünmüyordu.

### Çözüm
- `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` Vercel'de silinip yereldeki (Node testiyle
  çalıştığı kanıtlı) değerlerle Production + Preview ortamlarına yeniden eklendi.
- `npx vercel --prod` ile production yeniden deploy edildi (env ancak yeni build ile işler).
- Not: Değişkenler "Sensitive" olduğundan `vercel env pull` değerleri boş döndürür — doğrulama
  değer okuyarak değil canlı sitede davranış testiyle yapıldı.

### Doğrulama (CANLI, didagp.vercel.app)
- ODA KUR → oda kuruldu (U5CUM), OYUNCULAR 1/6, host rozeti ✓; ağ istekleri artık doğru
  hosta gidiyor (profiles GET 200).
- İkinci istemci (Node) `room:U5CUM` kanalına katıldı, presence sync'te host'u gördü →
  odaya katılma akışı da canlıda çalışıyor.

### Ders / sonraki oturumlara not
- "Bağlanılamadı" sınıfı şikayetlerde önce KULLANICININ test ettiği ortamı (canlı vs yerel)
  ayırt et; Vite projelerinde env typo'ları sadece o ortamın build'inde görünür.
- Vercel deploy artık CLI ile yapılabiliyor (hesap: idagureli-4647, `npx vercel --prod`).

---

## Faz 36 — Senkron Multiplayer Start + Giriş Efekti + İsim Sistemi (2026-07-16)
**Durum:** ✅ Tamamlandı

### İstek
Oda kurup oynarken herkes AYNI ANDA başlasın; maç girişinde giriş efekti + yarış başlama ekranı;
kırmızı/yeşil ışıklar + 3-2-1 geri sayım; herkes birbirini görsün (kasma yok); araç üstü isimler
belirgin; maça girişte isim değiştirilebilsin.

### Yapılanlar
1. **İki fazlı senkron start el sıkışması (`multiplayer.ts`):**
   - Eski: `startAt = Date.now()+1500` → yavaş yüklenen cihaz geri sayımı kaçırıyordu.
   - Yeni: Host `start` yayınlar → her istemci yarış sahnesi İLK KAREYİ render edince `ready`
     yollar → host herkes hazır olunca (veya 12 sn güvenlik zaman aşımında) `go {goAt}` yayınlar →
     tüm istemciler goAt epoch'una hizalı geri sayımla AYNI ANDA başlar. goAt = now+4400ms
     (~0.9s "HAZIR OL" + 3s sayım + yayın gecikme payı). Oyuncu bekleme fazında odadan düşerse
     host onu beklemez (presence sync'te yeniden değerlendirme).
2. **Giriş efekti + 3-2-1 ışıklı sayım (`StartLights.tsx` yeniden yazıldı):**
   - Multi: tam ekran "YARIŞ BAŞLIYOR" girişi (pist adı + "n/m hazır" spinner'ı) → 3 kırmızı ışık
     teker teker + büyük 3-2-1 sayı animasyonu + bip → hepsi YEŞİL + "BAŞLA!" (uzun bip).
   - Solo: eski F1 5-ışık sistemi aynen korundu.
3. **Grid dizilimi düzeltmesi (KRİTİK BUG):** Multi'de herkes `startPose(track, 0)`'a doğuyordu
   (üst üste). Artık id-sıralı deterministik slot: herkes aynı dizilimi görür, kimse çakışmaz.
   Uzak araçlar ilk pozisyon paketi gelene dek (0,0) yerine KENDİ grid slotlarında gösterilir;
   paketsiz araçla çarpışma ve minimap noktası da engellendi.
4. **"Oda bulunamadı" YARIŞ DURUMU BUG'ı (testin yakaladığı gerçek üretim hatası):**
   `joinChannel`'da `this.hostPresent = asHost` satırı, presence sync'in track()'ten ÖNCE gelip
   yazdığı `hostPresent=true` değerini eziyordu → katılan istemci 3 sn bekleyip yanlışlıkla
   "Oda bulunamadı" alıyordu. Düzeltme: değer artık ezilmiyor (yalnızca host true yazar);
   doğrulama süresi 3s→5s (yavaş mobil ağ payı).
5. **Belirgin araç üstü isim:** etiket %38 büyütüldü (58px font, 0.72 sprite ölçeği), koyu zemin +
   neon camgöbeği kenarlık + siyah konturlu beyaz metin — her pistte uzaktan okunur.
6. **Lobide isim değiştirme:** ÇOK OYUNCULU ekranına "SÜRÜCÜ ADIN" alanı (maks 14, boşsa 'Sürücü').
   `setIdentity` odadayken presence'ı 400ms debounce ile yeniden track eder → diğerleri canlı görür.

### Testler
- `tsc -b` temiz, production build ✓, headless simTest **54/54** ✓.
- **Gerçek Supabase üzerinde iki Node süreçli entegrasyon testi** (Chrome eklentisi bu oturumda
  bağlanamadı → alternatif): oda kur/katıl + start/ready/go akışı canlı doğrulandı, 6/6 kontrol:
  aynı goAt iki tarafta, host yavaş istemciyi bekledi (2.5s işaretinde GO yok), GO client ready
  sonrası ~4.5s ileriye verildi, 2/2 hazır sayıldı, zaman aşımına düşmedi.

### Kullanıcının test etmesi gerekenler (2 cihaz, canlı didagp.vercel.app)
1. Oda kur + katıl → host "YARIŞI BAŞLAT" → iki cihazda da "YARIŞ BAŞLIYOR … n/m hazır" ekranı,
   ardından AYNI ANDA 3-2-1 kırmızı → yeşil BAŞLA! geliyor mu?
2. Geri sayımda iki araç grid'de yan yana (üst üste değil) görünüyor mu?
3. Rakip aracın üstünde ismi net okunuyor mu?
4. Lobide "SÜRÜCÜ ADIN" değiştirilince karşı cihazın lobi listesinde ve yarışta güncelleniyor mu?

### Faz 36 devamı (aynı gün)
- Solo botlara da araç üstü isim etiketi eklendi (Kaan/Derya/… — "arabaların üzerinde isimler" isteğinin solo ayağı).
- Bundle chunk ayrıştırma (rolldown advancedChunks): tek 1.468KB → index 171KB + react 178KB + supabase 204KB + three 914KB. Paralel indirme + deploy'lar arası cache → mobilde daha hızlı açılış, senkron startta daha az bekleme.

---

## Faz 37 — Rekabet Paketi: Bot Araç Eşleştirme + idagg Hayalet Arabası + Yetişme Nitrosu Finali (2026-07-17)
**Durum:** ✅ Kod tamam, canlıya alındı — hayalet için 1 kullanıcı adımı var (aşağıda)

### İstek
1. Botların araçları oyuncunun seçtiği araca göre seçilsin (hızlıya hızlı) — rekabet hiç bitmesin.
2. Oyun sahibinin her moddaki en iyi sürüşü "idagg" etiketli hayalet araba olarak HERKESE görünsün, hayalet skoru da görünsün.
3. Geride kalanlara daha çok nitro (drift yapmasa bile otomatik dolsun, 1.'yi yakalamaya yaklaşsın); son turun yarısında kesilsin, normal yarışa dönsün.

### Yapılanlar
1. **Bot araç eşleştirme (`cars.ts` + `Scene.tsx`):** `carPerformanceScore` (hız %55 + ivme %30 +
   tutuş %15) ve `pickMatchedBotCars` — botlar oyuncunun aracına performansça EN YAKIN 5 aracı alır.
   Chiron seçen 366 km/s ort. botlarla, Wrangler seçen 209 km/s ort. botlarla yarışır.
   `createBotDriver` artık araç fiziksel limitiyle de sınırlı (yavaş araçlı bot "hile" yapamaz).
2. **Hayalet araba sistemi (`ghost.ts` yeni, saf modül):** 8Hz kayıt (GhostRecorder), açı sarmallı
   lineer interpolasyonla oynatma (ghostPoseAt). Oyuncunun sürüşü her yarışta kaydedilir; yarış
   bittiğinde SADECE oyun sahibi hesabı (idagureli@gmail.com, istemci + RLS çift kontrol) buluttaki
   süreden hızlıysa `ghosts` tablosuna yazar (pist+tur başına 1 hayalet). Her yarış başında herkes
   (misafir dahil) hayaleti indirir: yarı saydam (opacity 0.38), çarpışmasız, gölgesiz araç;
   altın kenarlıklı "idagg · 1:23.456" etiketi (isim + hayalet skoru). Geri sayımda ve hayalet
   bitince gizlenir. Solo + multi her modda görünür.
3. **Yetişme nitrosu güçlendirme + final kesintisi:** `CATCHUP_MAX_RATE` 0.28→0.34 (harcama 0.35/sn
   → çok geride kalan neredeyse kesintisiz nitro basar, 1.'yi yakalamaya yaklaşır ama bedava sonsuz
   nitro yok). YENİ: lider son turun İKİNCİ YARISINA girince (leadEst ≥ (totalLaps+0.5)·count) hem
   oyuncu yetişme nitrosu hem bot rubber-band tamamen kesilir → dürüst final sprint.
4. **Şema:** `supabase/2026-07-17-ghosts.sql` (idempotent) + `schema.sql`'e eklendi. RLS: select
   herkese, insert/update sadece `auth.jwt()->>'email' = idagureli@gmail.com`.

### Test
- `tsc -b` + production build temiz, oxlint temiz.
- simTest **68/68** ✓ (14 yeni test: bot eşleştirme 6, hayalet kayıt/oynatma/sarmal 8).
- Canlı Supabase'e anon anahtarla `ghosts` sorgusu → "tablo yok" hatası istemcide sessizce
  tolere ediliyor (fetchGhost null döner, oyun normal akar) — kademeli düşüş doğrulandı.
- Chrome eklentisi bu oturumda da bağlanamadı → canlı görsel doğrulama kullanıcıda.

### Kullanıcının yapması gerekenler
1. **Supabase SQL (tek sefer):** Dashboard → SQL Editor → `supabase/2026-07-17-ghosts.sql` içeriğini
   çalıştır. (Yapılmazsa oyun normal çalışır ama hayalet hiç görünmez.)
2. Canlı sitede Google (idagureli@gmail.com) ile giriş yapıp her pistte bir yarış bitir → hayalet
   rekorların oluşur; sonraki yarışlarda "idagg · süre" etiketli yarı saydam araba herkese görünür.
3. Test: yavaş araç seç → botlar da yavaş mı; kasten geride kal → nitro otomatik doluyor mu;
   son turun ikinci yarısında dolum kesiliyor mu.

### Otonom kararlar
- Hayalet anahtarı pist+tur sayısı (`track_id, laps`) — farklı tur sayısı farklı yarış uzunluğu
  olduğundan ayrı rekor tutulur; solo/multi aynı rekoru paylaşır (aynı pist/fizik).
- Hayalet, oyuncu bitirse de kendi bağımsız yarış saatiyle (raceClock) oynatılır.
- Bot rubber-band final kesintisi lider ilerlemesine bakar (oyuncu değil) — mod bağımsız tutarlı.

---

## Faz 37.1 — "En hızlı arabayla rakipsiz kalma" düzeltmesi (2026-07-17)
**Durum:** ✅ Tamamlandı, canlıda

### Kullanıcı şikayeti
"En hızlı arabayı alıp baştan sona 1. bitiriyorum, rakipler yetişemiyor. Başka oyuncular da
aynı en hızlı arabayı alabilir — rekabet hiç bitmemeli."

### Kök neden
1. Bot sürücü hız tavanı SABİT 37-47 m/s (133-169 km/s) idi — araçtan bağımsız. Hyper araçlı
   oyuncu düzlükte 250+ km/s yaparken botlar fiziksel olarak yetişemiyordu (rubber-band +%16
   bile yetmiyordu).
2. Bot araç havuzu oyuncunun aracını HARİÇ tutuyordu — en hızlı arabayı alan otomatik olarak
   "sınıfın tek en hızlı arabası"na sahip oluyordu.

### Çözüm
1. **Araca göreli bot hızı (`botAI.ts`):** tavan artık aracın fiziksel limitinin %80-97'si
   (bot ustalığına göre). Hyper botlar düzlükte 240-311 km/s'ye çıkıyor. Viraj limiti (skill
   bazlı aLat) aynen — farkı artık düz yol hilesi değil sürüş ustalığı belirliyor.
2. **Oyuncunun kendi aracı bot havuzunda (`cars.ts` + `Scene.tsx`):** performans mesafesi 0
   olduğundan her zaman seçilir; ters atamayla EN USTA bot (skill 1.0) oyuncuyla AYNI arabayı
   sürer → her yarışta "aynı arabayı almış baş rakip" var.

### Test
- simTest **74/74** ✓ (6 yeni: kendi araç havuzda, göreli tavan, hyper bot tam tur simülasyonu —
  bot 58.2s ≤ oyuncu-proxy 59.7s, zirve 260 km/s, 0 duvar, 0 hasar).
- Scratchpad tam tarama: 3 hızlı araç × 5 pist × 2 bot kademesi = 30 koşu, HEPSİ temiz
  (tur tamam, 0 duvar teması, 0 hasar, zirve 240-311 km/s).
- tsc + build + oxlint temiz.

---

## Faz 37.2 — Bot kovalama sertleştirmesi (2026-07-17)
**Durum:** ✅ Tamamlandı

### Bağlam
Kullanıcı 37.1 sonrası hâlâ "herkese fark atıyorum" dedi. Canlının güncel olduğu kanıtlandı
(canlı bundle hash = HEAD build, içinde yeni kod). İki aksiyon: (1) kullanıcıya sert yenileme
notu (tarayıcı önbelleği), (2) denge bir kademe sertleştirildi:
- Bot tavanı %80-97 → %84-97 (orta kademe botlar da yarışta kalır).
- Usta bot viraj cesareti aLat 10+skill*8 → 10+skill*9.
- Geride kalan bot tempo artışı %16 → %30 (gap*2.0).
- Botlara da OYUNCUYLA AYNI yetişme nitrosu işliyor (catchupNitroRate, finalSprint'te kesilir).
- Kovalayan bot (pace>1.02) nitroyu 0.25 enerjiden itibaren basar (önce 0.4).

### Test
- simTest 74/74 ✓; 30 koşuluk tam tarama yine hepsi temiz (0 duvar, 0 hasar, zirve 245-315 km/s,
  city ace bot 58.2→57.2s).

---

## Faz 37.3 — Botlar tam güç (2026-07-17)
**Durum:** ✅ Tamamlandı

### Bağlam
Kullanıcı 37.2 sonrası da "hâlâ 1. oluyorum ve fark atıyorum" dedi. Kök neden analizi bu kez
DENGE ayarı değil, 3 YAPISAL açık buldu — botlar oyuncunun kullandığı iki büyük hız kaynağından
(nitro ile tavan üstü hız + driftle sürekli nitro geliri) tamamen mahrumdu:
1. **Bot nitroyla bile kendi tavanında frenliyordu:** `vLimit = cap` ve nitro şartı
   `speed < cap*0.99` → oyuncu nitroyla topSpeed×1.3'e çıkarken bot ×0.97'de fren basıyordu.
2. **Tavan hiçbir botta %100 değildi** (%84-97) — en usta bot bile aynı arabayla düzlükte kaybediyordu.
3. **Bot nitro enerjisi kazanamıyordu:** oyuncu driftle ~0.2/sn dolduruyor; bot yalnızca
   geride kalınca catchup alıyordu. Öndeyken/dengede depo hep boştu.

### Yapılan (botAI.ts + Scene.tsx + simTest.ts)
- **Nitro tavan üstü hız:** nitro aktifken düzlük limiti `cap×1.28` (fizik ×1.3'ün hemen altı);
  nitro basma şartı `speed < cap×1.27` — bot artık oyuncu gibi nitroyla tavanı aşıyor.
- **Nitro histerezisi:** basmaya başlayınca depo 0.03'e inene dek sürdürür (önceden eşikte
  kare-kare açılıp kapanıyordu — tur başına ~250 titrek aktivasyon → şimdi 10-16 dolu yakış).
- **Pasif nitro geliri (Scene):** botlara 0.055/sn sabit dolum — oyuncunun drift gelirinin
  karşılığı; catchup DEĞİL, final sprintte de sürer (oyuncu da driftle kazanmaya devam ediyor).
- **Tavan %90-100:** usta bot aracın TAM hızını kullanır (önce %84-97).
- **Skill 0.82-1.0** (önce 0.78-1.0), **aLat 11+skill×10** (önce 10+skill×9),
  **aBrake 23.5+skill×2.5** (önce sabit 23) — usta bot daha geç frenler, virajı daha hızlı döner.
- **Öndeyken nefes çok kısıldı:** maxEase 0.09+(1-skill)×0.08 → 0.02+(1-skill)×0.07 —
  öne geçen usta bot artık neredeyse hiç yavaşlamıyor; 1.lik sökülüp alınması gereken şey.
- simTest güncellendi: "%97 tavan" varsayımı yeni "%100 tavan" kuralına çevrildi.

### Test
- simTest **74/74** ✓, botTune 15/15 tur temiz (0 duvar, 0 NaN).
- Scratchpad tam koşu: 3 araç (hyper/spor/orta) × 5 pist × 2 bot kademesi = 30 koşu HEPSİ temiz;
  tur süreleri belirgin düştü (ör. Jesko usta bot Monaco 46.4s, Neon 53.9s; nitro zirvesi
  339 km/s — nitrosuz tavan üstü), 0 duvar teması.
- tsc + build temiz.

### Sonraki faz notu
Bu, botların yapısal hız açıklarını kapatan son kademe. Kullanıcı hâlâ kolay kazanıyorsa
sıradaki adım denge değil ZORLUK SEÇİMİ olmalı (Kolay/Normal/Usta) — daha fazla global
sertleştirme yeni oyuncular için oyunu oynanmaz yapar.

---

## Faz 37.4 — Bot hızı fizik limitine kalibre edildi (2026-07-17)

### Şikayet
"Neredeyse tur bindiriyorum, rekabet yok." Faz 37.3 sonrası bile botlar yavaştı.

### Kök neden (ölçümle bulundu)
Scratchpad'e "usta oyuncu vekili" simülasyonu yazıldı (playerProxy: aynı botInput,
şişirilmiş skill + SÜREKLİ DOLU nitro): fiziğin izin verdiği pratik tur süresi ölçüldü.
Sonuç: aynı araçla usta bot 64.0s atarken fizik limiti 47-51s idi (Neon). İki açık:
1. **Nitro geliri kırıntıydı:** 0.055/sn gelir vs 0.35/sn harcama → bot düzlüklerin
   yalnızca %16'sında nitro basabiliyordu; driftçi oyuncu ~sürekli basıyor (fark tek başına ~13s/tur).
2. **Viraj çekingenliği:** aLat 11+skill×10 (maks 21 m/s²) — arcade fizik 27'ye dek
   duvarsız dönüyor (proxy ölçümü); botlar viraja gereksiz erken/sert fren yapıyordu.

### Yapılan (botAI.ts + Scene.tsx)
- **botNitroIncome(skill)** botAI'ye taşındı (Scene kullanır): 0.05 + (skill-0.82)×0.65
  → 0.05..0.167/sn (nitro payı %14..%48, skill ile dik ölçekli — kademeler ayrışsın diye).
- **aLat 10+skill×15** (22.3..25 m/s²), **aBrake 24.5+skill×3**, fren tamponu 4m→2.5m,
  fren tetiği +0.8→+1.2, ufuk +18→+14 — geç fren, cesur viraj.
- **Nitro basma penceresi genişledi:** cAhead<0.012 (önce 0.008), |diff|<0.14 — kazandığı
  nitroyu gerçekten yakıyor.
- **Tavan %92-100** (önce %90-100); simTest'in "tavan araç limitini aşamaz" kuralı korundu.

### Kalibrasyon sonucu (jesko, tur/s — optimal = sınırsız nitrolu proxy)
| Pist | Optimal | Bot#4 (usta) | Bot#0 (acemi) |
|---|---|---|---|
| Neon | 47.1 | 48.9 (+%4) | 52.9 (+%12) |
| Monaco | 40.1 | 41.9 (+%4) | 45.4 (+%13) |
| Turkuaz | 53.8 | 56.4 (+%5) | 61.3 (+%14) |
Önceki oyun-içi usta bot ~60-64s idi → ~%20 hızlandı. Beş kademe düzgün ayrışıyor.

### Test
- simTest 74/74 ✓, botTune 15/15 tur temiz (0 duvar, 0 NaN), kalibrasyon 25/25 temiz, tsc + build ✓.

### Denge notu
Usta bot artık optimalin %4-5 üstünde — 1.lik gerçekten zor. Oyuncu gerideyken catchup
nitrosu (0.34/sn'e dek) + botların önde nefesi (%2-9) dengeyi koruyor. Kullanıcı bu sefer
ÇOK ZOR derse global ayara dokunma: Kolay/Normal/Usta zorluk seçimi ekle (37.3 notuyla aynı).

---

## Faz 37.5 — Rubber-band sertleştirme: geride kalan bot YAPIŞIR (2026-07-18)

### Şikayet
37.4 sonrası botlar hızlı başlıyor ama oyuncu farkı hemen açıp açık ara 1. bitiriyor.

### Kök neden (yarış simülasyonuyla bulundu)
Scene döngüsünün birebir kopyası scratchpad'de koşturuldu (raceSim: oyuncu vekili vs 5 bot,
3 tur, tüm yardım mantığıyla). İki açık:
1. **Bot yetişme nitrosu oyuncu eğrisini kullanıyordu** (0.05 turda başlar, 0.35 turda tavan):
   oyuncu saniyelerle fark açarken bot neredeyse hiç yardım almıyordu.
2. **Rubber-band pace sadece düz hız tavanını artırıyordu** — fizik zaten ×1.3'te kilitli;
   asıl fark VİRAJDA açılıyordu ve kovalayan botun viraj cesareti (aLat) sabitti.
   Usta oyuncu vekiline karşı fark t100'de tur %14-23'e açılıyordu (kesintisiz nitroya rağmen).

### Yapılan (botAI.ts + Scene.tsx)
- **botCatchupNitroRate(gap):** bota özel eğri — ~1 sn geride başlar, ~7-8 sn geride tavan
  0.38/sn (harcama 0.35'i aşar → depo hep dolu, fiilen KESİNTİSİZ nitro kovalaması).
  Scene bot tarafında oyuncu eğrisi yerine bunu kullanır; oyuncunun kendi catchup'ı değişmedi.
- **Kovalarken viraj cesareti:** aLat = min(28, (10+skill×15) × max(1, pace)) — geride kalan
  bot virajı da lider gibi alır; fark kapanınca pace→1, dürüst temposuna döner.
- **updatePace eğimi ×2→×4:** saniyeler mertebesindeki fark tam kovalama temposunu tetikler.
- **Nitro yakışı gevşedi:** kovalarken nitroMin 0.12→0.08, hafif virajda da basar (cAhead<0.02).

### Simülasyon sonucu (3 tur, jesko, bitiş farkları)
| Oyuncu profili | Önce (t100 fark) | Sonra (bitiş farkı) |
|---|---|---|
| USTA (insanüstü vekil) | tur %14-23 açılıyor | +5.7..9.1s, fark sabitleniyor, oyuncu kazanır |
| İYİ | %4-12 | +0.5..6.7s — usta bot tamponda |
| ORTA | botlar önde ~4s | -5..+2s — orta sıra, çekişmeli |
Duvar teması: tüm koşularda 0 (yükseltilmiş aLat güvenli). Final sprint kesintisi korunduğu
için son yarım turda yardım yok → bitiş dürüst, yapışan bot son düzlükte "hediye" alamaz.

### Test
simTest 74/74 ✓, botTune 15/15 temiz, kalibrasyon 25/25 temiz, tsc + build ✓.

---

## idaGG Game Center'a taşındı (2026-07-22)
DidaGP, idaGG Game Center hub'ına `driftgp/` modülü olarak entegre edildi. Paylaşılan Supabase client + Bildim oturumu; tablolar `dg_` önekli; hayalet owner kısıtı kaldırıldı (herkes); CSS `.dg-root` scope. Ayrıntı: repo kökü `PROGRESS.md` (Faz 3) + `driftgp/CLAUDE.md` "HUB ENTEGRASYONU".

---

## Hub'da mobil kasma düzeltmeleri (2026-07-22)
- **Ses varlıkları taşındı:** bağımsız projeden hub'a geçerken `public/sounds/` (26 wav) taşınmamıştı; `game/audio.ts` `/sounds/*.wav` fetch'i başarısız olup sentetik sese düşüyordu. Hub `public/sounds/`'a kopyalandı → gerçek motor/drift/çarpma sesleri geri geldi.
- **Adaptif gölge kapatma:** `app/DriftGpInner.tsx` içindeki `AdaptiveQuality`, çözünürlüğü minimuma (scale≤0.55) indirdiği halde FPS<42 ise dinamik gölgeyi runtime'da kapatır (`gl.shadowMap.enabled=false` + ışık `castShadow=false`). Neden: `game/quality.ts` gölgeyi yalnız `lowEnd` (≤4 çekirdek) cihazda kapatıyor; 6+ çekirdekli orta-seviye iPhone'larda gölge açık kalıp kasmaya yol açıyordu. Bir kez kapatılır (aç/kapa titremesi önlemi); temas gölgesi kaldığından görsel kabul edilebilir.

## 2026-07-24 — GO mesajında saat farkı telafisi

- `net/multiplayer.ts`: host `go` yayınına gönderim anını (`t0`) ekliyor; alıcılar `goAt`ı epoch
  olarak değil **kalan süre** olarak alıp yerel saate çeviriyor (`Date.now() + (goAt - t0)`).
  Telefon saatleri saptığında geri sayım kayıyordu; ready-gate mimarisi aynen korundu.

---

## 24 Temmuz 2026 — Senkron start düzeltmesi (NTP saat-offset)

"1 saniye erken başlama" bug'ı çözüldü. Kök neden: `raceGoAt` host'ta gönderim, istemcide alım anında ayarlanıyordu → fark = 'go' mesajının tek yönlü ağ gecikmesi. Çözüm: bekleme fazında `syncClock()` birkaç ping/pong ile host−self saat-offset'ini ölçer (en düşük RTT örneği); 'go' handler epoch'u `goAt − clockOffset` ile yerel saate çevirir. Offset yoksa eski göreli yönteme düşer. Değişen: `net/multiplayer.ts`. Build temiz.
