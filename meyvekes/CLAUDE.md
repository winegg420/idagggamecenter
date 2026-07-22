# CLAUDE.md — Meyve Kes (kamera + el takibi modülü)

Bu dosya, `meyvekes/` modülü için rehberdir. **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an bağımsız geliştirilebilir.

## Modül Özeti

**Meyve Kes** — Fruit Ninja mantığı ama kontrol **gerçek el hareketi**: ön kamera açılır, MediaPipe el takibiyle elin "bıçak" olur, havadaki meyveleri keser. Tekli ve Arkadaşla (yerel, aynı ekran/kamera, 4 el) modu.

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül
- **El takibi:** MediaPipe **Tasks Vision `HandLandmarker`** (GPU delegesi), CDN'den ESM olarak yüklenir — npm bağımlılığı yok, bundle küçük. (Eski `@mediapipe/hands` legacy'den geçildi: kasma + koordinat kayması kök-neden çözümü.)
- Render: HTML5 Canvas (kamera cover + aynalı, üstünde meyveler/kesim/iz/el iskeleti)

## Dizin Yapısı (`meyvekes/`)

- `engine/` — eltakip.js (kamera + HandLandmarker, video karesini doğrudan işler → aspect kayması yok), oyun.js (faz makinesi + fizik + kesim algılama; kimlik eşleştirmeli el takibi, 7 anahtar nokta segmenti), meyveler.js (sprite/emoji önbellek + foto manifest), render.js (kamera + meyve + **el iskeleti** çizimi)
- `app/` — pages (MenuPage, OyunPage [kamera+canvas+HUD+teşhis rozeti], SiralamaPage), styles
- `_test/` — motor-test.mjs (Node başsız, 11 test: faz, kesim, statik el kesmez, hızlı savurma, combo, 60sn tam oyun)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları:
- Rota: `src/App.jsx` → lazy `/meyvekes/*`.
- Oturum/kimlik: `src/context/AuthContext.jsx` (`useAuth`) + `profiles`.
- Supabase: `src/lib/supabase.js`.

## Veritabanı

Tablolar **`meyvekes_` önekli**: `meyvekes_skorlar` (user_id+mod pk, en_iyi, toplam_kesim, oyun_sayisi). Migration: `supabase/migrations/20260612000038_meyvekes_temel.sql`. RLS select-only; yazım `security definer` RPC (`meyvekes_skor_kaydet`, `meyvekes_siralama`). `en_iyi` birleşik sıralamaya katılır.

## Kritik Notlar (kök-neden dersleri)

- **Kasma:** legacy MediaPipe ana thread'i WASM ile bloklardı → Tasks Vision GPU + senkron `detectForVideo` + setTimeout self-throttle.
- **Kesememe:** landmark'lar sabit 320x240 kareye normalize edilince 16:9 kamerada aspect bozulup **kayıyordu** → artık video karesi doğrudan işlenir.
- **Görsel teşhis:** el iskeleti çizimi + "🖐 el görünmüyor" rozeti — kamera/el sorunları anında görünür.
- GPU başarısızsa CPU delegesine otomatik düşüş.

## Kurallar

- Türkçe yaz. Minimal değişiklik. try-catch (kamera izni/model yükleme için ayrı anlaşılır hata mesajları).
- Landmark formatı değişmezse `oyun.js` kesim mantığına dokunma.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Meyve Kes oturumları) + bu klasördeki `PROGRESS.md`.
