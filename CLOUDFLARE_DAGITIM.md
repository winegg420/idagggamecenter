# Cloudflare Pages'e dağıtım

Depo aynı kalıyor. Vercel'deki dağıtım bozulmuyor — aynı depo iki yerde birden
yayınlanabilir. Cloudflare için gereken dosyalar eklendi ve **yerelde Cloudflare
Pages çalışma zamanıyla test edildi** (`wrangler pages dev`).

---

## ⚠️ Giriş izin listesi — DURUM GÜNCEL (10 Eylül 2026 ölçümü)

> Bu bölümün eski hâli "izin listesinde yalnız `bildim.vercel.app` var" diyordu.
> **Artık geçerli değil.** Panel güncellenmiş; aşağısı yeni ölçüm.

Supabase'in **Site URL**'i artık `https://quizador.pages.dev/`. Ölçüm yöntemi
(dışarıdan, panele girmeden): `auth/v1/callback` ucuna geçersiz istek atılır,
Supabase kullanıcıyı Site URL'e düşürür ve `Location` başlığı onu ele verir:

```bash
curl -sSI https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback | grep -i location
# location: https://quizador.pages.dev/?error=invalid_request&...
```

Bunun iki sonucu var:

- **Cloudflare (Quizador) tarafı sağlam.** Giriş sonrası dönüş buraya düşüyor;
  eskiden korkulan "Vercel'e düşer" durumu geçti.
- **`bildim.vercel.app` ÖLDÜ.** Artık 404 (`DEPLOYMENT_NOT_FOUND`). Eskiden
  girişleri ayakta tutan 307 yönlendirmesi yok. Bu adresi kimseye vermeyin;
  Supabase izin listesinde duruyorsa temizlenebilir.

Hâlâ kontrol edilmesi gereken: hub (`idagg-game-center.vercel.app`) **Redirect
URLs** listesinde mi? Değilse hub'da giriş yapan oyuncu Quizador sitesine
düşer. İzin listesi dışarıdan okunamaz (doğrulama Google dönüşünde yapılır),
panelden bakmak gerekir:

Supabase → Authentication → **URL Configuration** → Redirect URLs
- `https://quizador.pages.dev/**`  ← asıl site
- `https://idagg-game-center.vercel.app/**`  ← hub
- özel alan adı bağlanınca onu da ekle

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
npx wrangler pages deploy dist --project-name=bildim
```

---

## Eklenen dosyalar ve nedenleri

| Dosya | Ne işe yarıyor |
|---|---|
| `public/_redirects` | **SPA yönlendirmesi.** React Router istemcide çalışır; `/bildim/calisma` sunucuda dosya değil. Bu kural olmadan tüm derin bağlantılar 404 döner. Vercel aynı işi `vercel.json` ile yapar ve bu dosyayı yok sayar. |
| `public/_headers` | `sw.js` için `no-cache` (eski service worker takılı kalmasın), `/assets/*` için 1 yıl `immutable` (Vite hash'li ad üretiyor, güvenli), `nosniff` / `Referrer-Policy` / `X-Frame-Options`. |
| `.node-version` → `22` | **Kritik.** Vite 7, Node `^20.19 \|\| >=22.12` istiyor; Cloudflare Pages varsayılanı daha eski. Sabitlenmezse **ilk derleme hata verir.** Vercel de bu dosyayı okur, uyumlu. |
| ~~`wrangler.toml`~~ | **KALDIRILDI — zararsız değilmiş.** Cloudflare Pages depoda `wrangler.toml` bulunca panel yapılandırmasını (derleme komutu **ve ortam değişkenleri dahil**) tamamen yok sayıyor. Derleme günlüğü: `Found wrangler.toml file. Reading build configuration...` → `Build environment variables: (none found)`. Sonuç: `VITE_MOD` gitmediği için Bildim modu yerine **hub** derlemesi çıkıyor, Supabase anahtarları gitmediği için site "Supabase yapılandırması eksik" diyordu. Panelden bağlı bir projede bu dosya bulunmamalı. |

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

---

## Bildim'i kendi sitesi olarak yayınlama (VITE_MOD=bildim)

Aynı depo iki siteyi besler. Fark yalnız **derleme anındaki ortam
değişkenidir**; ayrı dal veya ayrı depo gerekmez.

| | idaGG Game Center (Vercel) | Bildim (Cloudflare Pages) |
|---|---|---|
| Derleme komutu | `npm run build` | `npm run build` |
| `VITE_MOD` | **yok** | `bildim` |
| `VITE_SITE_URL` | yok | yayın adresi, ör. `https://bildim.pages.dev` |
| Quiz rotaları | `/bildim/turnuva` | `/turnuva` |
| Diğer oyunlar | var | **pakete hiç girmez** (3D DriftGP dahil) |
| Manifest | `manifest.webmanifest` | `bildim.webmanifest` (`start_url: /`) |

### Nasıl çalışıyor

- `bildim/lib/yol.js` → `y("/meydan")` yardımcısı. Hub'da `/bildim/meydan`,
  Bildim sitesinde `/meydan` üretir. Bileşenlerdeki 76 sabit yol buna çevrildi.
- `src/BildimApp.jsx` → yalnız Bildim rotalarını **kökte** kuran uygulama.
  `src/App.jsx` (hub) hiç değiştirilmedi.
- `src/main.jsx` → `VITE_MOD`'a göre birini `lazy` yükler; seçilmeyen taraf
  pakete girmez.
- `vite.config.js` içindeki `bildimModuEklentisi` → `index.html` başlığı,
  paylaşım kartı, manifest bağlantısı, ikon, `canonical`; ayrıca çıktıdaki
  `bildim.webmanifest`, `robots.txt` ve `sitemap.xml` yeniden yazılır.
- Eski `/bildim/*` adresleri Bildim sitesinde köke yönlendirilir
  (`OnekiAt`) — bookmark, push bildirimi ve paylaşılmış davet linkleri kırılmaz.

### Cloudflare panelinde girilecekler

```
Build command:        npm run build
Build output:         dist
Environment variables:
  VITE_MOD              = bildim
  VITE_SITE_URL         = https://<proje>.pages.dev   (domain alınca güncelle)
  VITE_SUPABASE_URL     = https://zfpnxzybcpkxsotwdsey.supabase.co
  VITE_SUPABASE_ANON_KEY= <anon anahtar>
  VITE_SENTRY_DSN       = (isteğe bağlı — aşağıya bak)
```

`CRON_SECRET` buraya **konmaz** (sunucu sırrı, Supabase tarafında durur).

### Hata izleme (Sentry) — isteğe bağlı

Canlıda bir şey kırıldığında kullanıcı söylemeden haberimiz olsun diye
Sentry bağlanabilir. **Tamamen isteğe bağlıdır:**

- `VITE_SENTRY_DSN` **boşsa ya da hiç tanımlı değilse** Sentry kurulmaz.
  Paket derlemeye bile girmez (doğrulandı: DSN'siz derlemede `sentry`
  dizgisi hiçbir pakette geçmiyor), konsola uyarı da basılmaz.
- Açmak için: [sentry.io](https://sentry.io) → yeni proje (platform: React) →
  verilen **DSN**'i Cloudflare Pages ortam değişkenlerine
  `VITE_SENTRY_DSN` adıyla ekle ve yeniden dağıt.
- DSN gizli bir sır DEĞİLDİR (tarayıcıya gider), ama yine de panelde tutulur.

Gizlilik ayarları kodda sabit (`src/lib/hataIzleme.js`):
`sendDefaultPii: false`, oturum tekrarı kapalı (`replaysSessionSampleRate: 0`),
performans örneklemesi `0.1`. Gönderilmeden önce olaydan **davet kodları ve
e-posta benzeri dizgiler temizlenir** — oyunun "gerçek adın hiçbir zaman
gösterilmez" vaadi hata raporlarında da geçerli.

### Dağıtımdan sonra ŞART

1. **Supabase → Authentication → URL Configuration → Redirect URLs**'e
   `https://<proje>.pages.dev/**` ekle. Eklenmezse giriş yapan oyuncu
   Vercel sitesine düşer.
2. `VITE_SITE_URL`'i gerçek adresle güncelle (sitemap ve canonical onu yazar).
3. Domain alınınca aynı iki adımı yeni alan adı için tekrarla.

### Yerel test

```bash
npm run build:bildim     # .env.bildim sayesinde Windows'ta da çalışır
npx wrangler pages dev dist
```

---

## quizador.pages.dev HER ZAMAN en güncel olmalı — nasıl garantiye alınır

**Kural:** Quizador'un asıl sitesi `https://quizador.pages.dev`. Kod deposunda
ne varsa burada yayında olmalı; hub (Vercel) ikincildir.

### Önce şunu kontrol et: dağıtım elle mi, otomatik mi?

Cloudflare panelinde **Workers & Pages → quizador → Settings → Builds &
deployments** bölümüne bak:

- **"Connected to Git" yazıyorsa** → `main`'e her push otomatik dağıtılır,
  ekstra iş yok. Yalnız *Build configuration*'ın doğru olduğundan emin ol
  (aşağıdaki tablo).
- **"Direct Upload" yazıyorsa** → dağıtım **elle** yapılıyor demektir. Bu
  durumda her `git push` sonrası site kendiliğinden güncellenmez; unutulursa
  yayındaki sürüm eskir. **Git'e bağlamak gerekir** (Yol A) — tek kalıcı çözüm.

### Git'e bağlıyken olması gereken derleme ayarı

| Alan | Değer |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |
| `VITE_MOD` | `bildim` ← **bu yoksa hub sürümü yayınlanır, yanlış olur** |
| `VITE_SITE_URL` | `https://quizador.pages.dev` |
| `VITE_SUPABASE_URL` | `https://zfpnxzybcpkxsotwdsey.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon anahtar (aşağıdaki nota bak) |

Ortam değişkenleri **Production ve Preview için ayrı ayrı** girilir.

### Anahtar tutarsızlığı (10 Eylül 2026'da ölçüldü)

İki yayın farklı türde anon anahtar kullanıyor:

| Yayın | Anahtar | Kaynak |
|---|---|---|
| Vercel (hub) | `sb_publishable_…` | Vercel paneli |
| Cloudflare (Quizador) | `eyJ…` (eski JWT) | yerel `.env` |

**Şu an ikisi de çalışıyor** (ölçüldü: `auth/v1/settings` her ikisiyle de 200).
Ama Supabase eski JWT anahtarlarını aşamalı kaldırıyor. Cloudflare panelindeki
`VITE_SUPABASE_ANON_KEY` yeni `sb_publishable_…` değeriyle güncellenmeli;
yerel `.env` de aynı şekilde. Aksi hâlde anahtar kapandığı gün Quizador
sitesi giriş yapamaz duruma gelir.

### Dağıtımın gerçekten güncel olduğunu doğrulama

Yayındaki paket adları yerel derlemeyle birebir aynı olmalı:

```bash
npm run build:bildim
grep -oE '/assets/[A-Za-z0-9_.-]+\.js' dist/index.html | sort -u
curl -s https://quizador.pages.dev/ | grep -oE '/assets/[A-Za-z0-9_.-]+\.js' | sort -u
```

İki liste aynıysa yayın günceldir. (Vite dosya adına içerik özeti koyar; kod
değişince ad da değişir.)
