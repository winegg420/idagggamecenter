# CLAUDE.md — Kafa Topu (2D fizik futbol modülü)

Bu dosya, `kafatopu/` modülü için rehberdir. Modül **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an bağımsız geliştirilebilir.

## Modül Özeti

**Kafa Topu** — Head Soccer tarzı 2D fizik futbolu. 1v1 & 2v2, ranked (ELO) + hızlı maç, özel oda/davet, foto kafa (kendi fotoğrafınla oyna), güçler + karakter yetenekleri, antrenman botu. Host-otoriter multiplayer.

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül
- Fizik: **Matter.js** (`matter-js`)
- Multiplayer: Supabase Realtime (broadcast + presence, host-otoriter)
- Render: HTML5 Canvas (kendi döngüsü)

## Dizin Yapısı (`kafatopu/`)

- `engine/` — fizik.js (Matter dünyası), oyun.js (faz makinesi, 60Hz sabit adım), gucler.js (düşen güçler + yetenekler), bot.js (balistik tahminli bot), girdi.js (klavye+dokunmatik), render.js + kafaCizim.js (sahne + foto kafa çizimi), sabitler.js
- `net/` — kanal.js (Realtime broadcast+presence), interpolasyon.js (100-120 ms geriden lerp)
- `app/` — pages (Menu, Karakter, Kuyruk, Mac, Siralama, Admin, Oda), styles, shared bileşenler
- `_test/` — motor-test.mjs (Node başsız, 27 test: golKontrol, faz geçişleri, ELO JS eşleniği, tam maçlar, zıpla-tut regresyonu)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları — bağımsızlaşırken bunları değiştir:
- Rota: `src/App.jsx` → lazy `/kafatopu/*` (tek satır).
- Oturum: `src/context/AuthContext.jsx` (`useAuth`) — Bildim oturumunu kullanır (giriş duvarı arkasında).
- Supabase: `src/lib/supabase.js`.
- Kimlik: `profiles` (username/avatar) — oyun içi isim değiştirme `profiles.username`'i günceller.

## Veritabanı

Tüm tablolar **`kafatopu_` önekli** (`kafatopu_profiller`, `kafatopu_kuyruk`, `kafatopu_maclar`, `kafatopu_mac_oyunculari`, `kafatopu_odalar`, `kafatopu_oda_oyunculari`, `kafatopu_davetler`). Migration'lar repo kökü `supabase/migrations/` (35, 36, 37 numaralı). ELO puanı `kafatopu_profiller.puan` (birleşik sıralamaya katılır).

- RLS select-only; yazımlar `security definer` RPC. Skor `FOR UPDATE` + iki-taraflı onay ile (skor sahteciliği kapalı, migration 37).
- Realtime kanalı: `kt-mac-<id>`. Global online: `kafatopu:cevrimici` presence.

## Kurallar

- Türkçe yaz. Minimal değişiklik. try-catch. Fizik sabitleri `sabitler.js`'te tek yerde.
- Skor/ELO mantığı hassas — SQL ile `_test/motor-test.mjs`'teki JS eşleniği **birlikte** güncellenir.
- Mobil/iOS cila (native touch, webkit fullscreen, wake lock, alpha:false, statik sahne bake) korunur — regresyon yapma.

## Varlıklar

`public/heads/` (foto kafalar + manifest.json) ve `public/map/` (sahne görselleri) — namespace'li, hub `public/` altında.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Kafa Topu oturumları, 15-17 Temmuz) + bu klasördeki `PROGRESS.md` (modül özeti).
