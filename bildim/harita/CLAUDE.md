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
| `dunya.js` | Saf three.js: sahne, ışık, karakterler, emoji balonu, çarpışma, kamera, `yokEt()`. Dünya manifestten (Taksim). |
| `cevre.js` | **2B:** manifest alanlarından GLB proplar (InstancedMesh), atlaslı zemin, boyalı binalar, sokak kedileri. |
| `karakter/` | **2B:** ortak karakter sistemi (karakter, kozmetik, ifade, pet, vfx, temas, meydanAvatar) — deneme sayfası da bunu kullanır. |
| `kontrol.js` | Ekran topuzu + WASD/yön tuşları → `{ix, iz}`. |
| `coklu.js` | Supabase Realtime `meydan` kanalı: presence (kim burada) + broadcast `poz` / `emoji`. |
| `renk.js` | `user.id`'den deterministik avatar rengi (profilde renk kolonu yok, eklenmedi). |
| `harita.css` | HUD; tüm sınıflar `.bd-harita-` önekli. |
| `yerlesim.json` | **Aşama 2A:** Taksim haritasının TEK doğruluk kaynağı (bölge, parsel, nokta, alan, tramvay, arka plan). Elle düzenlenir. |
| `yerlesimDunya.js` | Manifestten greybox dünya kurar; konum HESAPLAMAZ. Yönlü kutu çarpışması + birleşik sınır + kapı önü ipucu. |
| `olcum/greybox.*` | Greybox ölçüm sayfası (üretim derlemesi, yerel; canlıya çıkmaz). |
| `olcumSayaci.js` + `OlcumGostergesi.jsx` | **2C-A:** canlı haritada `?olcum=1` göstergesi (cihazda hatırlanır, `?olcum=0` kapatır). `CPU` = yalnız gönderim (sürekli); `CPU+GPU` = kare + `gl.finish` (yalnız düğmeyle). İki sayıyı karıştırma. |
| `olcum/meydan-test/katman2c.js` | **2C-B:** katman katman ölçüm (`katmanKos`, `propDetay`, `cozunurlukEgrisi`); rapor `ASAMA_2C_RAPOR.md`. |

Bağlantı: `src/App.jsx` (`/bildim/harita`) ve `src/BildimApp.jsx` (`/harita`)
**lazy** route; `Layout.jsx`'te "Harita" sekmesi. Harita'ya girmeyen oyuncu
three.js indirmez — `three.module-*.js` ayrı chunk'tır (driftgp ile paylaşılır).

## Kurallar
- **Tek harita Taksim (2B):** harita seçimi (`?harita=`) ve Paket 13 dünyası (göl, köprü, 7 bina) kaldırıldı. **Balıkçı/su iptal — geri getirilmez.** `avatar.js` silinmez (portre.js, onizleme.js kullanır).
- **Taksim yerleşimi koda gömülmez:** bina/nokta/alan konumu `yerlesim.json`'da değişir, `yerlesimDunya.js`'te değil.
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
