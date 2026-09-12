# CLAUDE.md

> Bu depoda `AGENTS.md` de aynı kuralları taşır (Codex için). Bir kural
> değişirse **ikisini birden güncelle**.

Bu dosya, bu depoda çalışan Claude Code (ve diğer AI ajanları) için proje rehberidir.

## Proje

**IDA GG Game Center** (GitHub: `idagggamecenter`) — birçok oyunu tek çatı altında toplayan bir oyun portalı (PWA). Site adı artık "Bildim" değil; **Quiz Square yalnızca hub içindeki oyunlardan biridir** (bilgi yarışması; klasör adı geriye uyum için `bildim/`). Tüm oyunlar tek kimliği (`profiles`: username + avatar) ve tek Supabase projesini paylaşır; her oyun kendi klasöründe **bağımsız geliştirilebilir izole bir modüldür** ve her an ayrı repoya taşınabilir.

**Her modülün kendi `CLAUDE.md` + `PROGRESS.md` dosyası vardır** (o klasörde). Bu kök dosyalar hub geneli içindir; modülde çalışırken önce o modülün `CLAUDE.md`'sini oku.

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
- `run/` — RUN (karanlık labirent kaçış, tek-oyunculu prototip). Route: `/run/*`. Backend yok. **DEMO**.
- `gladius/` — Gladius (arena dövüş, Faz 0 iskelet). Route: `/gladius/*`. DB öneki `gl_`. **DEMO**.
- `patirun/` — PatiRun (2D pati yarışı, multiplayer; React+TS+Zustand). Route: `/patirun/*`. DB öneki `pr_`. Bildim oturumuna köprüyle bağlı (`app/PatiRunApp.jsx`).
- `driftgp/` — DidaGP (3D drift yarışı; three.js/R3F+Zustand). Route: `/driftgp/*`. DB öneki `dg_`. Bildim oturumuna köprüyle bağlı (`app/DriftGpApp.jsx`). Not: kullanıcıya görünen ad **DidaGP** (eski kod adı "DriftGP").

Her modül yalnızca paylaşılan kabuğa (`src/`: `App.jsx` lazy route + `context/AuthContext` + `lib/supabase` + `components/Avatar`) bağlıdır; hiçbiri diğer oyunun klasöründen import etmez. Bağımsız repoya ayırma yolu her modülün kendi `CLAUDE.md`'sinde yazılıdır.

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
- **Riskli işlemlerde onay iste:** dosya silme, deploy, DB migration uygulama. `main`'e push = canlıya deploy. (Sahibi bu üçü için **kalıcı onay verdi** — bkz. "Çalışma düzeni". Adım adım onay sorma; yalnız listede olmayan geri dönüşsüz bir işlem çıkarsa sor.)
- **Rakamları koda gömme** — oyun ayarları `oyun_ayarlari` tablosunda, eşya kataloğu `esyalar` / `karakterler` tablolarında durur. Yayından sonra SQL ile değiştirilebilmeli.
- **Yeni paket kurma.** Tailwind, Framer Motion, styled-components ve benzeri yasak. Mevcut yapı: düz CSS + CSS değişkenleri.
- **Emin değilsen tahmin etme — ölç.** "Muhtemelen şudur" diye düzeltme yapma; tarayıcıda/veritabanında doğrula, kök sebebi raporla.

## Çalışma düzeni — SAHİBİNİN İSTEDİĞİ AKIŞ

Sahibi kod yazmaz, dosya taşımaz. Verilen görevi baştan sona kendin
bitirirsin:

- **Durma, adım adım onay isteme.** Görev bitene kadar devam et.
- Her mantıksal adım **ayrı commit**, commit mesajları Türkçe.
- `npm run build` hatasız olmalı.
- Migration'ları **canlıya uygula** (`npx supabase db push`).
- İşi bitirince `main`'e **push et**. Push = canlıya dağıtım;
  dağıtımın başarılı bittiğini doğrula.
- **Kendi kendini test et.** Sahibinden bir şey kontrol etmesini isteme.
  Tarayıcı testi gerekiyorsa Playwright kurulu (`/opt/pw-browsers`).
- Bitince **tek kısa özet**: hangi dosyalar değişti, kaç migration
  eklendi ve uygulandı, build sonucu, push/dağıtım durumu, ne doğrulandı.

**İstisna:** yalnızca sahibinin bilebileceği bir şey varsa (gerçek bir
şifre, API anahtarı doğruluğu, ürün kararı) sor. Onun dışında sorma.

Ayrıca: hata için özür dileme, doğrudan bul ve düzelt; bir hatayı
düzelttikten sonra aynı hatayı başka dosyalarda da ara. Büyük
değişiklikleri küçük adımlara böl. Git/teknik terim kullanırken kısa bir
sadeleştirme ekle (ör. "rebase yaptım (commit'ini güncel hale getirdim)").

## Tasarım dili — "Şenlik"

Değiştirme, koru:

- Açık gökyüzü zemin, beyaz kartlar + alt kalınlık (`0 4px 0`)
- Kabartmalı butonlar (basınca `translateY(4px)`)
- Baloo 2 başlık / Nunito gövde
- Turuncu vurgu (`--bd-vurgu: #F4701F`) — marka rengi

Oyun, bilgi yarışması gibi görünmeli; sakin/nötr "uygulama" estetiğine
kaydırma. Kontrast WCAG AA: küçük metin ≥ 4.5, 24px+ veya 19px+ kalın
metin ≥ 3.0. `prefers-reduced-motion` ve `prefers-reduced-transparency`
desteklenir.

## Quiz Square — yerleşik ürün kararları

Bunlar onaylanmış kararlardır, aksini yapma:

### Oyun mekaniği

- **Hız bonusu yok** — süre içinde doğru cevaplayan herkes aynı puanı alır
- Normal maçta **berabere olabilir**; turnuvada **altın soru**
  (biri kazanana kadar, jokersiz, kullanılmamış sorulardan)
- "Pas" jokeri **"Soru Değiştir"** oldu — maç başına 1 kez
- Turnuvada ilk 5 soru en kolaydan, sonra zorlaşır (`questions.zorluk`)
- Yanlış cevap sonrası bekleme **1 sn**

### Sosyal

- **Oyuncular sadece arkadaşlarıyla da oynayabilir** — biri bu oyunu
  yalnızca arkadaşlarıyla maç yapmak için oynuyor olabilir.
  Arkadaşlar alt sekmeden kaldırılmaz, hiçbir limit onu cezalandırmaz.
- "Ezeli rakip" istatistiği yalnız arkadaşlar için tutulur
- Aynı çift aynı gün: 1-5. maç tam ödül, 6-10. %50, 11+ ödülsüz.
  Aynı cihaz/IP'den iki hesap arasında sıralı maç hiç ödül vermez.

### Ekonomi (hepsi `oyun_ayarlari`'nda)

- Galibiyet 25 · berabere 10 · mağlubiyet 0 (teselli yok)
- Günlük tavan 400 · başlangıç 500 · reklam 25 (günde 5)
- Turnuva 150/75/40 + katılana 10 · meydandan katılma 20
- Eşya: sıradan 300–600, özel 1.200–2.500
- **Etkinlik eşyaları satılmaz** (Taç, Pelerin, Uzay Kıyafeti) —
  yalnız turnuva ödülü. Dükkânda kilitli görünür.
- Dükkândaki her şey yalnız coin ile alınır

### Botlar

- İki katman: **açık botlar** (adında "Bot" geçer, %50 coin, anında
  cevaplar) ve **gizli botlar** (gerçek oyuncu gibi, tam coin,
  gerçekçi sürede cevaplar)
- `is_bot` istemciye **ASLA sızmaz** — gizli botun bot olduğu
  anlaşılmamalı
- Gizli botlar arkadaşlık kabul etmez, lig değiştirmez

### Lig

- 5 kademe: Bronz → Gümüş → Altın → Elmas → Efsane
- 25 kişilik gruplar; grup = yalnız sıralama tablosu, eşleşmeyle
  ilgisi yok. İlk 5 yükselir, son 5 düşer. Pazartesi 00:00 (TSİ) sıfırlanır
- Eşleşme kendi ligi ± 1 lig ile sınırlı
- **Toplam oyuncu sayısı hiçbir yerde gösterilmez**

### Meydan (3B harita)

- Turnuva saatleri **13:00 ve 21:50 TSİ**, sabit
- Yön topuzu sol altta, eylem düğmeleri sağ altta
- **MİMARİ ŞARTI:** haritanın görseli ve karakterler ileride baştan
  değişecek. Meydan özellikleri (kahve/balon ikramı, emoji, dans,
  meydan okuma, zıplama) görselden bağımsız yazılır: mantık + ağ
  katmanı bir yerde, 3B modeller başka yerde.

### Dil

- Marka adı her dilde **"Quiz Square"**, çevrilmez
- İlk yayın: Türkçe + İngilizce
- Dil kuralı: giriş yapmışsa profildeki tercih; yoksa tarayıcı dili
  `tr` ile başlıyorsa Türkçe, başka her şeyde İngilizce. IP/ülkeye
  bakılmaz.
- Özel isimler asla çevrilmez (şair "Cami" → "Jami", "Mosque" DEĞİL)

### Reddedilmiş fikirler — tekrar önerme

- "Hızlı cevap modu" (herkese aynı anda aynı soru)
- Loot box / şans kutusu
- Nötr gri/mavi palet, düzleşmiş butonlar

## Proje Hafızası

- **PROGRESS.md** — Yapılan işler, kararlar ve nedenleri burada tutulur. Oturuma başlarken **önce oku**, oturum sonunda **ekleme yaparak güncelle** (üzerine yazma).
