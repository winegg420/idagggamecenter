# CLAUDE.md — Quizador Meydanı (`bildim/harita/`)

3B çok oyunculu buluşma alanı. Oyuncu kendi avatarıyla yürür, o an meydanda
olanları canlı görür, emoji atar, mod binalarına girerek o moda geçer.
Onaylanmış görsel referans: repo kökünde `QUIZADOR_MEYDAN_REFERANS.html`
(sahne oradan **birebir** taşındı — yeniden tasarlama). Görev metni:
`QUIZADOR_MEYDAN_GOREV.md`.

## Dosyalar

| Dosya | Sorumluluk |
|---|---|
| `HaritaSayfasi.jsx` | Yalnız React yaşam döngüsü + HUD. three.js'e dokunmaz. |
| `dunya.js` | Saf three.js: sahne, ışık, havuz, 7 bina, ağaç/bank/lamba/bulut, avatar, emoji balonu, çarpışma, kamera, `yokEt()`. |
| `kontrol.js` | Ekran topuzu + WASD/yön tuşları → `{ix, iz}`. |
| `coklu.js` | Supabase Realtime `meydan` kanalı: presence (kim burada) + broadcast `poz` / `emoji`. |
| `renk.js` | `user.id`'den deterministik avatar rengi (profilde renk kolonu yok, eklenmedi). |
| `harita.css` | HUD; tüm sınıflar `.bd-harita-` önekli. |

Bağlantı: `src/App.jsx` (`/bildim/harita`) ve `src/BildimApp.jsx` (`/harita`)
**lazy** route; `Layout.jsx`'te "Harita" sekmesi. Harita'ya girmeyen oyuncu
three.js indirmez — `three.module-*.js` ayrı chunk'tır (driftgp ile paylaşılır).

## Kurallar
- **Veritabanı değişikliği yok.** Konum kalıcı tutulmaz; presence + broadcast.
- Başka oyun modülünden import yok; yalnız `src/` kabuğu + `bildim/lib`.
- Bina listesi/renkleri `dunya.js › BINALAR` — mod renkleriyle aynı, değiştirme.
- Tüm Supabase çağrıları try-catch; kanal kopsa da sahne çalışır ("bağlantı yok").
- Sekme gizliyken (`document.hidden`) RAF render atlanır ve konum yayını durur.

## Bilinmesi gereken tuzaklar
- **three r128 → 0.185:** yeni sürümde ışıklar fiziksel birim; referanstaki
  yoğunluklar `π` ile çarpıldı, yoksa sahne karanlık çıkar.
- **"İlk paket" NaN tuzağı (`coklu.js`):** `sonPoz` "gönderilmedi" için NaN
  tutulur; `Math.abs(x - NaN) > 0.01` **her zaman false**. Değişiklik kontrolünden
  önce `Number.isFinite` ile ayrıca bakılır — yoksa hiç konum gitmez.
- **Otomasyon/arka plan sekmesi:** Chrome RAF'ı durdurur, sayfa "hazırlanıyor"
  perdesinde kalır (ilk kare gelmedi). Ürün hatası değil.
- `.app` sarmalayıcısı içindeyiz ama sayfa `position: fixed; z-index: 70` ile
  tam ekran; `useOyunModu(true)` sekme çubuğunu/davet bandını gizler.
- Yeni hesabın ilk-giriş tanıtımı (`Tanitim`, z-index 210) haritanın
  üstünde çıkar; bir kez kapatılır, harita hatası değil.

## Test
`.tmp/harita-test/` (git dışı) uygulamanın gerçek modüllerini React'siz
yükler; `?kim=a` / `?kim=b` iki ayrı anonim oyuncu, `?dusuk=1` düşük donanım.
`window.__test.tick(dt, n)` kareleri elle ilerletir (gizli sekmede RAF yok),
`__test.girdi = {ix, iz}` yürütür, `__test.emoji("🔥")`, `__test.yik()/kur()`.
Dev sunucu açıkken: `http://localhost:5173/.tmp/harita-test/index.html?kim=a`.
