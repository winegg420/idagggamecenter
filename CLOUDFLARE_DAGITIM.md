# Cloudflare Pages'e dağıtım

Depo aynı kalıyor. Vercel'deki dağıtım bozulmuyor — aynı depo iki yerde birden
yayınlanabilir. Cloudflare için gereken dosyalar eklendi ve **yerelde Cloudflare
Pages çalışma zamanıyla test edildi** (`wrangler pages dev`).

---

## ⚠️ ÖNCE BUNU OKU — yoksa Cloudflare'de giriş çalışmaz

Supabase Auth izin listesinde şu an **yalnız `bildim.vercel.app`** var
(9 Eylül'de ölçüldü). Vercel'de girişlerin çalışmasının nedeni o alan adının
307 ile yönlendirmesi. **Cloudflare'de böyle bir yedek yok:** kullanıcı giriş
yapınca Vercel sitesine düşer, Cloudflare sitesine değil.

Cloudflare alan adın belli olur olmaz, **yayına açmadan önce**:

Supabase → Authentication → **URL Configuration**
- **Redirect URLs**'e ekle: `https://<PROJE>.pages.dev/**`
  (özel alan adı bağlarsan onu da: `https://alanadin.com/**`)
- Site URL'i hangi alan adı **asıl** olacaksa ona çevir.
- Eski adresleri bir süre listede tut ki mevcut linkler bozulmasın.

Bu yapılmadan Cloudflare kopyası "giriş yapılamıyor" gibi görünür — ama sorun
Cloudflare'de değil, izin listesindedir.

---

## Yol A — Panelden bağla (önerilen, ~2 dakika)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → `winegg420/idagggamecenter`
2. Derleme ayarları:

   | Alan | Değer |
   |---|---|
   | Framework preset | **None** (veya Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | (boş) |

3. **Environment variables** (Production **ve** Preview için ayrı ayrı):

   | Ad | Değer |
   |---|---|
   | `VITE_SUPABASE_URL` | `.env` dosyandaki değer |
   | `VITE_SUPABASE_ANON_KEY` | `.env` dosyandaki değer |

   Bunlar derleme sırasında pakete gömülür; eksikse site açılır ama
   "Supabase yapılandırması eksik" ekranı gelir.

   > `CRON_SECRET` ve `SUPABASE_DB_PASSWORD` **buraya konmaz** — onlar sunucu
   > sırrıdır, Supabase tarafında durur.

4. **Save and Deploy.** İlk derleme ~1-2 dk.

## Yol B — Komut satırından

```bash
npx wrangler login          # tarayıcıda Cloudflare oturumu açar (senin yapman gerek)
npm run build
npx wrangler pages deploy   # wrangler.toml'daki ayarları kullanır
```

---

## Eklenen dosyalar ve nedenleri

| Dosya | Ne işe yarıyor |
|---|---|
| `public/_redirects` | **SPA yönlendirmesi.** React Router istemcide çalışır; `/bildim/calisma` sunucuda dosya değil. Bu kural olmadan tüm derin bağlantılar 404 döner. Vercel aynı işi `vercel.json` ile yapar ve bu dosyayı yok sayar. |
| `public/_headers` | `sw.js` için `no-cache` (eski service worker takılı kalmasın), `/assets/*` için 1 yıl `immutable` (Vite hash'li ad üretiyor, güvenli), `nosniff` / `Referrer-Policy` / `X-Frame-Options`. |
| `.node-version` → `22` | **Kritik.** Vite 7, Node `^20.19 \|\| >=22.12` istiyor; Cloudflare Pages varsayılanı daha eski. Sabitlenmezse **ilk derleme hata verir.** Vercel de bu dosyayı okur, uyumlu. |
| `wrangler.toml` | CLI ile dağıtım için (`pages_build_output_dir = "dist"`). Panelden bağlarsan gerekmez, zararı yok. |

---

## Yerelde yapılan doğrulama

`npx wrangler pages dev dist` ile Cloudflare Pages çalışma zamanı ayağa
kaldırıldı ve ölçüldü:

| Test | Sonuç |
|---|---|
| `/`, `/bildim`, `/bildim/calisma`, `/bildim/mac/abc-123`, `/kosullar`, `/gizlilik`, `/kafatopu` | hepsi **200** + `text/html` (SPA yönlendirmesi çalışıyor) |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/icon-192.png` | hepsi **200** |
| `sw.js` başlığı | `Cache-Control: no-cache, no-store, must-revalidate` ✔ |
| `/assets/*.js` başlığı | `Cache-Control: public, max-age=31536000, immutable` ✔ |
| Güvenlik başlıkları | `x-content-type-options: nosniff` ✔ |
| Uygulama tarayıcıda açıldı mı | ✔ (`/bildim/calisma` derin bağlantısından React yüklendi, giriş ekranı geldi) |

---

## Dağıtımdan sonra yapılacaklar

1. **Supabase Redirect URLs** (yukarıdaki uyarı) — bu olmadan giriş çalışmaz.
2. Asıl alan adı Cloudflare olacaksa şunları güncelle:
   - `public/sitemap.xml` içindeki 11 adres
   - `public/robots.txt` içindeki `Sitemap:` satırı
   - `index.html` içindeki `og:url` ve `og:image`
   (Şu an hepsi `idagg-game-center.vercel.app` gösteriyor.)
3. Google Search Console'a yeni alan adını ekle.
4. İki site birden yayında kalacaksa, arama motorunun ikisini birden
   dizinlememesi için **ikincil olanda** `robots.txt`'e `Disallow: /` koy ya da
   asıl alan adına `rel=canonical` ver — yoksa yinelenen içerik sayılır.
