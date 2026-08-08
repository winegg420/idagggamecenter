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
- **Duran el kesmemeli, ama SALINIMLI hareket kesmeli:** kare-başı mesafe/hız eşikleri algılama frekansına bağımlıdır — algılama 15→60 Hz olunca landmark titremesi (2-5 px) eşiği aşıp DURAN ELDE kesim yaptı. İlk çözüm "NET (yönlü) yer değiştirme"ydi; ama net yol, yumruk/dans gibi **ileri-geri hareketleri de eledi** (pencerede net yol ~0 → kapı kapalı). Nihai ölçüt: `HAREKET_PENCERE` (0.14 sn) içindeki konum **YAYILIMI** (bbox köşegeni) > `YAYILIM_ORAN × köşegen`. Yayılım yön bağımsızdır (savurma da salınım da geçer), titreme asla eşiğe ulaşamaz. Yön/hız ayrı ve KISA pencereden (`HIZ_PENCERE`) okunur — uzun pencere ortalaması salınımda yönü sıfırlıyordu. Kapı kapalıyken kesim/telafi/iz üçü birlikte kapanır.
- **El kadrajdan çıkıp geri girince tanınmaması:** üç katmanlı sorundu — (a) algılama kör penceresi (worker çözümü), (b) el kaybolunca takip kimliğinin düşmesi, (c) köprü kurulsa bile dönüş karesinde hareket penceresinde tek örnek kalması → kapı kapalı → savurma boşa. Çözüm: `KAYIP_SURE` **1.2 sn** köprüsü + iki geçişli, **hız-tahminli** eşleştirme + dönüşte kayıp-öncesi konumun `KOPRU_REF_DT` yaşında örnek olarak geçmişe konması (kapı ilk karede açılır). Kayıp `KOPRU_SEGMENT_SURE`'yi (0.25 sn) aşarsa "ışınlanma segmenti" kesmez; kesimi yalnız kılıcın o anki gövdesi yapar.
- **Kesememe:** landmark'lar sabit 320x240 kareye normalize edilince 16:9 kamerada aspect bozulup **kayıyordu** → artık video karesi doğrudan işlenir.
- **Kare kopyalama maliyeti:** worker'a gönderilen `createImageBitmap` kopyası kamera çözünürlüğündeydi; uzun kenar `HEDEF_UZUN_KENAR` (480) ile **en-boy oranı korunarak** küçültülür (sabit ölçüye sıkıştırmak landmark'ları kaydırır — bkz. aşağıdaki "Kesememe" dersi). Model girdiyi zaten ~200 px'e indirdiği için doğruluk değişmez.
- **Çizim maliyeti (mobil):** altın meyvede `shadowBlur` (kare başına ayrı blur geçişi) → tek additif halka; parçacıklar tek geçişte (parçacık başına `save/restore` yok) + `MAX_PARCACIK` tavanı; iz'in geniş additif hale katmanı düşük kalitede kapanır; canvas `desynchronized`; HUD state'i yalnız değer değişince yazılır.
- **Görsel teşhis:** "🖐 el görünmüyor" / "😐 yüz görünmüyor" rozeti + **algılama frekansı (Hz)** ve `⚠` (worker yerine ana-thread yoluna düşüldü) göstergesi — kasma/ıskalama şikâyetinde ilk bakılacak yer burasıdır.
- GPU başarısızsa CPU delegesine otomatik düşüş.
- **İz görünmemesi:** Bıçak izi noktaları bir zamanlar yalnız ALGILAMA karesinde ekleniyordu; algılama 10-12 fps'e düşünce 0.18 sn'lik iz ömrüne 1 nokta sığıyor ve ekranda hiçbir efekt görünmüyordu. Artık noktalar **çizim karesinde (60 fps)** üretilir; ölçüt mesafe değil **el hızı** (`IZ_HIZ_ESIK`) → duran elde iz yok, savururken kesintisiz şerit.

## Kurallar

- Türkçe yaz. Minimal değişiklik. try-catch (kamera izni/model yükleme için ayrı anlaşılır hata mesajları).
- Landmark formatı değişmezse `oyun.js` kesim mantığına dokunma.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Meyve Kes oturumları) + bu klasördeki `PROGRESS.md`.
