# CLAUDE.md

Bu dosya, bu depoda çalışan Claude Code (ve diğer AI ajanları) için proje rehberidir.

## Proje

**Bildim!** — Türkçe bilgi yarışması web uygulaması. Gece turnuvası, 1v1 meydan okuma, grup maçı, "Hızlı Olan Kazanır" ve arkadaş sistemi içerir. PWA olarak çalışır (push bildirimi + service worker).

## Teknoloji Yığını

- **Frontend:** React 19 + Vite 7, React Router 7 (`react-router-dom`)
- **Backend/DB:** Supabase (Auth, Postgres, Realtime, RLS, Edge Functions, pg_cron)
- **Soru üretimi:** Claude API, Supabase Edge Function (`generate-questions`) üzerinden
- **Dağıtım:** Vercel — `main` dalına `git push` **otomatik production deploy** tetikler
- **Dil:** Tüm arayüz, değişken/fonksiyon adları ve yorumlar Türkçe

## Komutlar

```bash
npm run dev        # Geliştirme sunucusu (Vite)
npm run build      # Production derlemesi (dist/) — değişiklikten sonra doğrula
npm run preview    # Derlemeyi yerel önizle
```

Supabase (migration/fonksiyon):

```bash
npx supabase db push                            # Migration'ları uygula
npx supabase functions deploy generate-questions
```

## Dizin Yapısı

Site bir **oyun portalıdır** (idaGG Game Center). **Her oyun kendi kök klasöründe, bağımsız geliştirilebilir bir modüldür** — hiçbiri diğerinin klasöründen import etmez; her biri kabuğa (`src/App.jsx`) tek bir lazy route satırıyla bağlanır.

Paylaşılan kabuk (`src/` — tüm oyunlar buna bağlıdır, tersi değil):
- `src/main.jsx` — Uygulama girişi (BrowserRouter + AuthProvider + `styles.css`)
- `src/App.jsx` — Route tanımları; her oyun buraya tek satırla bağlanır
- `src/pages/GameCenter.jsx` — Ana giriş sayfası (oyun portalı); `src/pages/Login.jsx` — site giriş kapısı
- `src/context/AuthContext.jsx` — Kimlik doğrulama durumu (tüm oyunlar paylaşır)
- `src/lib/supabase.js` — Supabase client (tüm oyunlar paylaşır)
- `src/components/Avatar.jsx` — Paylaşılan avatar bileşeni
- `src/styles.css` — Global stiller (`.gc-*` Game Center dahil)

Oyun modülleri (her biri izole; `app/` + `engine/` + gerektikçe `shared/`/`net/`/`lib/`):
- `bildim/` — **Bildim!** bilgi yarışması (`pages/`, `components/` [Layout, QuestionCard, RankBadge, Countdown, RankUpOverlay], `lib/` [ranks, push, zaman]). Route: `/bildim` ve quiz alt rotaları.
- `kafatopu/` — Kafa Topu (2D fizik futbol, multiplayer). Route: `/kafatopu/*`. DB öneki `kafatopu_`.
- `meyvekes/` — Meyve Kes (kamera + MediaPipe el takibi). Route: `/meyvekes/*`. DB öneki `meyvekes_`.
- `run/` — RUN (karanlık labirent kaçış). Route: `/run/*`.
- `gladius/` — Gladius (arena dövüş). Route: `/gladius/*`. DB öneki `gl_`.

Ortak:
- `supabase/migrations/` — Sıralı SQL migration'ları (tek DB; her oyunun tabloları önekli, ayrı dosyada)
- `supabase/functions/` — Edge Functions (`generate-questions`, `send-push`)
- `public/` — PWA varlıkları (`sw.js`, `manifest.webmanifest`, ikonlar); oyun varlıkları namespace'li (`heads/`, `map/`, `meyve/`)

## Ortam Değişkenleri

`.env` içinde (bkz. `.env.example`), Vite ön ekiyle:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Edge Function gizli anahtarları Supabase secrets'ta: `ANTHROPIC_API_KEY`, `CRON_SECRET`.

`.env` varyantları ve `.vercel` git'e **girmez** (`.gitignore`); yalnızca `.env.example` istisna.

## Kurallar ve Konvansiyonlar

- **Türkçe yaz** — kod, yorum, commit ve yanıtlar.
- **Minimal değişiklik** — mevcut kodu silme/bozma; sadece gerekli yeri düzenle. Dosyayı baştan yazmak yerine hedefli düzenleme yap.
- **Tüm Supabase/API çağrılarında** try-catch ve hata yönetimi kullan.
- **DB güvenliği:** RLS politikaları ve RPC'ler `security definer`, sadece `authenticated` rolü. İstemciye güvenme; kritik mantığı (ör. yarış durumu) `FOR UPDATE` kilidiyle sunucuda çöz.
- **Migration'lar sıralıdır** — mevcut migration'ı düzenleme; her değişiklik için yeni numaralı dosya ekle (`20260612000NNN_ad.sql`). Soru eklerken `soru` kolonu UNIQUE olduğundan `on conflict (soru) do nothing` kullan.
- **Puanlama/RLS/realtime mantığına** dokunurken dikkatli ol; ödüller ölçeklenebilir formüllerle bağlıdır.
- **Riskli işlemlerde onay iste:** dosya silme, deploy, DB migration uygulama. `main`'e push = canlıya deploy.

## Proje Hafızası

- **PROGRESS.md** — Yapılan işler, kararlar ve nedenleri burada tutulur. Oturuma başlarken **önce oku**, oturum sonunda **ekleme yaparak güncelle** (üzerine yazma).
