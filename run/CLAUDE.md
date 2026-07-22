# CLAUDE.md — RUN (karanlık labirent kaçış modülü)

Bu dosya, `run/` modülü için rehberdir. **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an bağımsız geliştirilebilir. **DEMO** olarak işaretli (multiplayer henüz yok).

## Modül Özeti

**RUN** — Karanlık bir tesisten kaçış: fener/çevre ışığı stealth görünürlüğü, devriye drone'ları (tarama konisi), enerji kılıcı + dash + kalkan, kapılar/EMP makineleri, veri çipleri, hazırlık lobisi + round sistemi. Şu an **tek-oyunculu prototip** (botlarla); multiplayer bilinçli olarak en son faz.

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül
- Saf HTML5 Canvas motoru (kendi döngüsü) — **backend/Supabase KULLANMAZ**
- Işık oklüzyonu (gölge dörtgenleri + ışık maskesi), BFS akış-alanı navigasyonu

## Dizin Yapısı (`run/`)

- `engine/` — motor.js (ana simülasyon), durum.js, harita.js (duvarlı odalar + kapılar), navigasyon.js (BFS akış alanı, %100 ulaşılabilirlik), girdi.js, render.js (ışık/gölge), ses.js, sabitler.js
- `app/` — RunApp.jsx (kök), pages (MenuPage, GamePage), styles
- `_test/` — run-test.html (Supabase'siz tarayıcı test)

## Kabuğa Bağlantı (paylaşılan `src/`)

RUN **bağımsız modüldür**: Supabase/oturum KULLANMAZ, giriş duvarının önünde de açılır. TEK bağlantı: `src/App.jsx` → lazy `/run/*` (tek satır). Bağımsız repoya ayırmak en kolay olan modül (paylaşılan bağımlılığı yok).

## Veritabanı

Yok. Skor kalıcı değil (birleşik sıralamaya katılmaz). Multiplayer eklenince `run_` önekli tablolar gerekecek.

## Kurallar

- Türkçe yaz. Minimal değişiklik. Görünürlük kuralı (yalnız ışıkta + görüş hattı açık) hile olmaması için korunur.
- Mobil cila (tam ekran, yatay kilit, iOS webkit fullscreen, native touch, wake lock) Kafa Topu'ndan taşınan derslerle uyumlu.
- Değişiklik sonrası başsız Node motor testi + build doğrula.

## İlerleme

Ayrıntılı günlük: bu klasördeki `PROGRESS.md` (modülün kendi kapsamlı geçmişi) + repo kökü `PROGRESS.md` (RUN oturumları).

## Kalan büyük iş

Multiplayer (backend gerektirir) — bilinçli olarak en son faz. Bu yüzden hub'da **DEMO** rozetli.
