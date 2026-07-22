# CLAUDE.md — PatiRun

Bu dosya, bu proje üzerinde çalışırken her oturumda geçerli olan kalıcı kurallardır. Claude Code bu dosyayı proje kök dizininde her başladığında otomatik okumalı ve buradaki kurallara uymalıdır.

## Proje Özeti

**PatiRun** — Fun Run tarzı, 2D yan görünümlü, mobil öncelikli, gerçek zamanlı çok oyunculu bir web yarış oyunu.

- **Frontend:** React + Vite + TypeScript
- **2D Render:** HTML5 Canvas (kendi render döngüsü) + SVG tabanlı karakterler
- **State:** Zustand
- **Backend:** Supabase (auth, database, realtime) — ücretsiz plan
- **Deploy:** Vercel
- **Giriş:** Sadece Google OAuth

## Mevcut Durum

Faz 1-6 + 2D revizyon + Fun Run tür uyarlaması tamamlandı. Canlı: https://yakala-beni.vercel.app — detaylı iş günlüğü `PROGRESS.md` dosyasında tutulur.

## ÇALIŞMA KURALLARI (ZORUNLU — HER OTURUMDA GEÇERLİ)

- Her zaman Türkçe yanıt ver.
- Adım adım, sade bir dille açıkla.
- Değişiklik yapmadan önce ne yapacağını açıkla, onay bekle (kullanıcı açıkça otonom çalış demediyse).
- Mevcut kodu silme veya bozma. Sadece gerekli yerleri değiştir, minimal değişiklik yap.
- Dosya silme veya yeniden yazma yerine düzenlemeyi tercih et.
- Her zaman en az kod değişikliğiyle sorunu çöz.
- Tüm API çağrılarında try-catch ve hata yönetimi kullan.
- Emin olmadığın bir şey varsa tahmin etme, bana sor.
- Hata için özür dileme. Direkt hatayı bul ve düzelt.
- Bir hatayı düzelttikten sonra aynı hatayı başka dosyalarda da kontrol et.
- Büyük değişiklikleri küçük adımlara bölerek yap, her adımı açıkla.
- Her düzeltme/özellik için ayrı git commit at.
- İşlem bittikten sonra neyi test etmem gerektiğini söyle.
- Skill sisteminin mantığına (catch-up oranı, altın skill nadirliği, puanlama) istenmedikçe dokunma.

## ZORUNLU ÖN-RAPOR SELF-TEST PROTOKOLÜ

Her güncellemede, kullanıcıya rapor vermeden ÖNCE kendi kendine uçtan uca test yap:

1. `npm test` — tüm birim testleri + `fullMatch.test.ts` TAM MAÇ SİMÜLASYONU (4 haritada: yarış başlat, tüm skill'leri kullan, engel/duvar/platform etkileşimi, finiş, sıralama tutarlılığı) geçmeli.
2. `npm run build` — sıfır hata.
3. UI akışlarını kod düzeyinde gözden geçir: maç sonu ekranındaki her buton (Revanş, Ana Menü) ulaşılabilir mi; karakter özelleştirme ekranındaki her kategori (şapka, gözlük, saç, sakal, üst giyim, ayakkabı...) gerçek görsel üretiyor mu; orientation kilidi yarış sonrası açılıyor mu.
4. Bu testte bulduğun hataları KULLANICIYA SORMADAN düzelt; sadece emin olmadığın tasarım kararlarını sor.
5. Kritik akış değişikliklerinde mümkünse tarayıcıda gerçek sayfa kontrolü de yap.

Amaç: kullanıcı hataları tek tek bulup bildirmeden, bunları kendi testinle yakalayıp düzeltmiş olman.

## PROGRESS.md Protokolü

Her önemli değişiklikten sonra (yeni özellik, hata düzeltme, mimari değişiklik) `PROGRESS.md` dosyasını güncelle:
- Tarih
- Ne yapıldı (kısa açıklama)
- Hangi dosyalar değişti
- Bilinen sorunlar / yapılacaklar (varsa)

Bu dosya, projeye ara verip geri dönüldüğünde "kaldığımız yer neresiydi" sorusuna cevap vermek için var — eksiksiz tutulmalı.

---

## HUB ENTEGRASYONU — idaGG Game Center (2026-07-22)

PatiRun artık bağımsız bir repo/site DEĞİL; **idaGG Game Center** (eski Bildim reposu, GitHub: `idagggamecenter`) içinde `patirun/` klasöründe izole bir modüldür. `/patirun/*` route'una `src/App.jsx`'ten lazy bağlanır. Kod tamamen bu klasörde; kabuğa yalnızca 2 noktadan bağlıdır.

**Kabuğa bağlı olduğu TEK noktalar (bağımsız repoya ayırırken bunları değiştir):**
- `patirun/lib/supabase.ts` → Bildim'in paylaşılan client'ını (`../../src/lib/supabase.js`) re-export eder. Bağımsızlaşınca eski kendi `createClient`'ına dön.
- `patirun/app/PatiRunApp.jsx` → köprü: Bildim `AuthContext` (`../../src/context/AuthContext.jsx`) oturumunu okur, `pr_users` satırını upsert eder, `authStore.setBridgedUser` ile besler. Bağımsızlaşınca eski Google-OAuth `authStore` + `AuthScreen` geri gelir (git geçmişinde `stores/authStore.ts` eski hali).

**Hub'a taşınırken yapılan değişiklikler:**
- Tüm Supabase tabloları **`pr_` önekli** (migration: repo kökü `supabase/migrations/20260612000039_patirun_temel.sql`). Kimlik (username) `profiles`'tan gelir; `pr_users.username` senkron kopyadır.
- Kendi Google-OAuth giriş ekranı (`AuthScreen.tsx`) **kaldırıldı**; `RunnerStrip` → `components/RunnerStrip.tsx`. appStore başlangıç ekranı `menu`.
- Realtime kanalları `pr-` namespace'li (`pr-quickmatch`, `pr-room:*`, `pr-online`).
- Global CSS `.pr-root` altına scope'landı (`app/styles/patirun.css`) — kabuğun stillerini bozmaz.
- **Bağımsız leaderboard:** kendi puan/rütbe sistemi korunur; yalnız kimlik/giriş ortak.

**Bağımsız geliştirme:** `patirun/` içindeki tüm oyun mantığı (fizik, net, stores, screens) olduğu gibi çalışır. Tip kontrolü: `patirun/tsconfig.json`. Detaylı modül günlüğü: bu klasördeki `PROGRESS.md` + kök `PROGRESS.md` (7. oturum, Faz 2).
