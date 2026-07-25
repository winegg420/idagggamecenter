# CLAUDE.md — Meyve Kes (kamera + el takibi modülü)

Bu dosya, `meyvekes/` modülü için rehberdir. **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an bağımsız geliştirilebilir.

## Modül Özeti

**Meyve Kes** — Fruit Ninja mantığı ama kontrol **gerçek el hareketi**: ön kamera açılır, MediaPipe el takibiyle elin "bıçak" olur, havadaki meyveleri keser. Modlar: **Tekli** (2 el), **Arkadaşla** (yerel, aynı ekran/kamera, 4 el), **Meyve Ye** (el yok — meyveler ağza nişan alarak gelir, ağzını açıp yutarsın).

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül
- **El takibi:** MediaPipe **Tasks Vision `HandLandmarker`** (GPU delegesi), CDN'den ESM olarak yüklenir — npm bağımlılığı yok, bundle küçük. (Eski `@mediapipe/hands` legacy'den geçildi: kasma + koordinat kayması kök-neden çözümü.)
- **Ağız takibi (Meyve Ye):** aynı CDN'den **`FaceLandmarker`** — yalnız 4 ağız noktası kullanılır (iç dudak üst/alt + iki köşe); açıklık = dikey açıklık / ağız genişliği (yüz uzaklığından bağımsız), histerezisli.
- Render: HTML5 Canvas (kamera cover + aynalı, üstünde meyveler/kesim/iz/efektler)
- Ses: `engine/ses.js` — WebAudio ile sentezlenir (dosya yok); motor DOM'a dokunmaz, `oyun.sesler` kuyruğunu OyunPage tüketir.

## Dizin Yapısı (`meyvekes/`)

- `engine/` — **takip-worker.js** (çıkarım worker'ı: el/yüz landmarker, ana thread bloklanmaz), **takip-cekirdek.js** (worker yaşam döngüsü + kare transferi, iki takip modülünün ortak altyapısı), eltakip.js (kamera + HandLandmarker; çıkarım önce worker'da, olmazsa ana thread), yuztakip.js (kamera + FaceLandmarker → ağız noktaları; aynı worker yolu), oyun.js (faz makinesi + fizik + kesim/yutma algılama; kimlik eşleştirmeli el takibi, kol bıçağı), meyveler.js (sprite/emoji önbellek + foto manifest), render.js (kamera + meyve + iz + kesim efektleri + ağız halkası), ses.js (WebAudio efektleri)
- `app/` — pages (MenuPage, OyunPage [kamera+canvas+HUD+teşhis rozeti+ses düğmesi], SiralamaPage), styles
- `_test/` — motor-test.mjs (Node başsız, 31 doğrulama: faz, kesim, statik el, hızlı savurma, combo, gecikme telafisi, iz üretimi, meyve ye, efektler), kilic-test.html + yeme-test.html (kamerasız görsel testler)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları:
- Rota: `src/App.jsx` → lazy `/meyvekes/*`.
- Oturum/kimlik: `src/context/AuthContext.jsx` (`useAuth`) + `profiles`.
- Supabase: `src/lib/supabase.js`.

## Veritabanı

Tablolar **`meyvekes_` önekli**: `meyvekes_skorlar` (user_id+mod pk, en_iyi, toplam_kesim, oyun_sayisi). Migration: `supabase/migrations/20260612000038_meyvekes_temel.sql` + `20260612000043_meyvekes_yeme_modu.sql` (mod check'e `'yeme'` eklendi). RLS select-only; yazım `security definer` RPC (`meyvekes_skor_kaydet`, `meyvekes_siralama`). `en_iyi` birleşik sıralamaya katılır (tüm modların toplamı).

## Kritik Notlar (kök-neden dersleri)

- **Kasma:** legacy MediaPipe ana thread'i WASM ile bloklardı → Tasks Vision. Ama `detectForVideo` SENKRON olduğu için ana thread'de çağrıldığı sürece render donuyor, bu yüzden algılama kendini kısmak zorunda kalıyordu (zayıf cihazda ~7 algılama/sn). **Nihai çözüm: çıkarım worker'da** (`takip-worker.js`) → kısma yok, kameranın her karesi işlenir. Ana thread yalnız `createImageBitmap` + transfer yapar. Worker kurulamazsa/sonuç üretmezse otomatik ana-thread yedeği.
- **Duran el kesmemeli:** kare-başı mesafe/hız eşikleri algılama frekansına bağımlıdır — algılama 15→60 Hz olunca landmark titremesi (2-5 px) eşiği aşıp DURAN ELDE kesim yaptı. Kesim izni artık 0.12 sn penceredeki NET (yönlü) yer değiştirmeye bakar (`HAREKET_PENCERE` + `SAVURMA_ORAN`, ekran köşegenine oranlı); kapı kapalıyken kesim/telafi/iz üçü birlikte kapanır. Pencere dolmadan anlık hıza güvenilmez.
- **El kadrajdan çıkıp geri girince tanınmaması:** iki katmanlı sorundu — (a) algılama kör penceresi (yukarıdaki worker çözümü), (b) `oyun.js`'te el kaybolunca takip kimliğinin ANINDA düşmesi → geri gelen el hızsız/segmentsiz yeni kimlik olduğu için ilk savurma kesmiyordu. Çözüm: `KAYIP_SURE` (0.4 sn) köprüsü + iki geçişli eşleştirme; köprü segmentinin tavanı köşegenin %50'si (uçtan uca bedava kesim olmasın).
- **Kesememe:** landmark'lar sabit 320x240 kareye normalize edilince 16:9 kamerada aspect bozulup **kayıyordu** → artık video karesi doğrudan işlenir.
- **Görsel teşhis:** "🖐 el görünmüyor" / "😐 yüz görünmüyor" rozeti — kamera/takip sorunları anında görünür.
- GPU başarısızsa CPU delegesine otomatik düşüş.
- **İz görünmemesi:** Bıçak izi noktaları bir zamanlar yalnız ALGILAMA karesinde ekleniyordu; algılama 10-12 fps'e düşünce 0.18 sn'lik iz ömrüne 1 nokta sığıyor ve ekranda hiçbir efekt görünmüyordu. Artık noktalar **çizim karesinde (60 fps)** üretilir; ölçüt mesafe değil **el hızı** (`IZ_HIZ_ESIK`) → duran elde iz yok, savururken kesintisiz şerit.

## Kurallar

- Türkçe yaz. Minimal değişiklik. try-catch (kamera izni/model yükleme için ayrı anlaşılır hata mesajları).
- Landmark formatı değişmezse `oyun.js` kesim mantığına dokunma.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Meyve Kes oturumları) + bu klasördeki `PROGRESS.md`.
