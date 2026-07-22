# CLAUDE.md — DriftGP Projesi

Bu dosya, bu proje üzerinde çalışırken Claude Code'un (Fable 5) uyacağı kurallardır.

---

## 1. ÇALIŞMA PRENSİBİ

- Tasarım brief'i (`DriftGP_Tasarim_Brief.md`) bu projenin tek doğruluk kaynağıdır. Kod yazmadan önce oku.
- Faz faz ilerle (brief'teki 7 fazlık plana göre). Bir fazı bitirmeden diğerine geçme.
- **Her fazın sonunda kendi kendini test et.** Hata bulursan, kullanıcıya sormadan düzelt, tekrar test et. Bu döngüyü faz sorunsuz çalışana kadar tekrarla.
- Faz tamamlandığında `PROGRESS.md` dosyasını güncelle (bkz. madde 5).

## 2. OTONOMİ SINIRLARI

- Brief'in "Açık Kalan Kararlar" bölümündeki konularda (fizik motoru, gaz kontrolü detayı, rozet listesi, kilit açma eğrisi, nitro mekaniği) kullanıcıya SORMADAN, profesyonel oyun geliştirme pratiklerine göre karar ver. Kararını ve gerekçesini `PROGRESS.md`'ye yaz.
- Brief'te net olarak tanımlanmış konularda (araba listesi, istatistikler, kişiselleştirme kategorileri, multiplayer oyuncu sayısı, kontrol şeması) brief'ten SAPMA.
- Marka isimleri/logoları konusunda brief'teki kurala kesinlikle uy: gerçek otomotiv markası adı veya logosu hiçbir yerde kullanılmayacak.

## 3. KOD KALİTESİ KURALLARI

- Tüm API çağrılarında (Supabase, external servis) try-catch ve düzgün hata yönetimi kullan.
- Mevcut çalışan kodu bozmadan ilerle — bir fazda yazılan kod, sonraki fazda gereksiz yere yeniden yazılmayacak, sadece genişletilecek.
- Bir hata bulup düzelttiğinde, aynı hatanın başka dosyalarda da olup olmadığını kontrol et.
- Büyük değişiklikleri küçük, test edilebilir adımlara böl.
- Performans kritik: mobil tarayıcıda 6 kişilik multiplayer + 3D sahne çalışacağı için her fazda FPS/performans kontrolü yap.

## 4. TEKNOLOJİ STACK (brief ile aynı)

React + Vite + TypeScript + React Three Fiber + Supabase (Realtime + Auth + DB) + Vercel deploy. 3D asset temeli: Kenney.nl (CC0).

## 5. PROGRESS.md GÜNCELLEME KURALI

Her faz sonunda `PROGRESS.md`'ye şunlar eklenecek:
- Hangi faz tamamlandı, tarih
- Ne yapıldı (kısa madde madde)
- Hangi testler yapıldı, sonuçları
- Bulunup çözülen sorunlar
- Alınan otonom kararlar ve gerekçeleri (madde 2 kapsamında)
- Bir sonraki fazda dikkat edilmesi gereken noktalar

## 6. İLETİŞİM

Bu proje `--dangerously-skip-permissions` ile çalıştırılıyor — yani onay beklemeden ilerleyeceksin. Ancak brief'te olmayan, projenin temel yönünü değiştirecek bir belirsizlikle karşılaşırsan (örn. brief'te çelişen iki talimat), durup `PROGRESS.md`'ye not düş ve kullanıcıya döndüğünde sorulacak sorular listesi oluştur — kod yazmaya devam et ama bu noktayı işaretle.

**Kullanıcının kesin talimatı:** Fazlar arasında geçiş yaparken ASLA onay sorma. Baştan sona bütün fazları bitir. Sadece kullanıcının kendi girmesi gereken bilgiler (örn. Supabase URL/anon key, Google OAuth kimlik bilgileri, Vercel hesabı) eksikse o kısmı `.env.example` ve `KURULUM.md` üzerinden net şekilde işaretle, kod tarafında bekleyen her şeyi tamamla. Kullanıcının yapması gereken adımları (dış servis kurulumu, deploy, mobil cihaz testi) en sona bırak — bunlar dışında hiçbir şey için kullanıcıdan onay veya bilgi bekleme.

---

## İSİM NOTU
Oyunun kullanıcıya görünen adı **DidaGP**'dir. Kod içinde/eski dokümanlarda geçen "DriftGP", projenin eski kod adıdır — kullanıcı arayüzünde her yerde **DidaGP** görünür (menü logosu "DIDAGP").

## HUB ENTEGRASYONU — idaGG Game Center (2026-07-22)

DidaGP artık bağımsız bir repo/site DEĞİL; **idaGG Game Center** (GitHub: `idagggamecenter`) içinde `driftgp/` klasöründe izole bir modüldür. `/driftgp/*` route'una `src/App.jsx`'ten lazy bağlanır.

**Kabuğa bağlı olduğu TEK noktalar (bağımsız repoya ayırırken bunları değiştir):**
- `driftgp/lib/supabase.ts` → Bildim'in paylaşılan client'ını (`../../src/lib/supabase.js`) re-export eder. Bağımsızlaşınca kendi `createClient`'ına dön (realtime `eventsPerSecond: 20`).
- `driftgp/app/DriftGpApp.jsx` → köprü: Bildim `AuthContext` oturumunu okur, görünen adı (`profiles.username`) `profileStore.playerName`'e yazar. DidaGP zaten `supabase.auth.getUser()` ile oturumu okuduğundan ayrı authStore köprüsü yok.
- `driftgp/app/DriftGpInner.tsx` → eski `src/App.tsx`'in kabuk-uyarlaması (import yolları `../`).

**Hub'a taşınırken yapılan değişiklikler:**
- Tüm Supabase tabloları **`dg_` önekli** (migration: `supabase/migrations/20260612000040_driftgp_temel.sql`).
- Kendi Google giriş/çıkış UI'si (`ProfileScreen`) kaldırıldı; isim editörü paylaşılan `profiles.username`'i günceller.
- **HAYALET (ghost) owner kısıtı kaldırıldı:** artık her oyuncunun en iyi turu, Bildim adıyla global hayalet olur (client + RLS açık).
- Realtime kanalları `dg-` namespace'li (`dg-user:*`, `dg-room:*`, `dg-lobby`).
- Global CSS `.dg-root` altına scope'landı (`app/styles/driftgp.css`).
- **Bağımsız leaderboard:** kendi XP/rütbe/hayalet sistemi korunur; yalnız kimlik/giriş ortak.

**Bağımsız geliştirme:** three.js/R3F oyun mantığı olduğu gibi çalışır. Tip kontrolü: `driftgp/tsconfig.json`. Tasarım kaynağı: `DriftGP_Tasarim_Brief.md`. Detaylı günlük: bu klasördeki `PROGRESS.md` + kök `PROGRESS.md` (Faz 3).
