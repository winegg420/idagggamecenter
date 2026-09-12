# AGENTS.md

Bu dosya, bu depoda çalışan AI ajanları (Codex, Claude Code, vb.) için
proje rehberidir. **Her oturuma başlarken oku.**

Claude Code kullanıcısıysan `CLAUDE.md` de aynı içeriği taşır; ikisi
senkron tutulur. Bir kural değişirse **ikisini birden güncelle**.

## Proje

**IDA GG Game Center** — birçok oyunu tek çatı altında toplayan oyun
portalı (PWA). **Quiz Square** hub içindeki bilgi yarışması oyunudur
(klasör adı geriye uyum için `bildim/`). Tüm oyunlar tek kimliği
(`profiles`) ve tek Supabase projesini paylaşır; her oyun kendi
klasöründe bağımsız, izole bir modüldür.

Her modülün kendi `CLAUDE.md` + `PROGRESS.md` dosyası vardır.
**Bir modülde çalışırken önce o modülün `CLAUDE.md`'sini oku.**

## Teknoloji

- React 19 + Vite 7, React Router 7
- Supabase (Auth, Postgres, Realtime, RLS, Edge Functions, pg_cron)
- three.js (3B meydan — `bildim/harita/`)
- Vercel — `main`'e push **otomatik canlı dağıtım** tetikler
- Arayüz, değişken/fonksiyon adları ve yorumlar **Türkçe**

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # production derlemesi — her değişiklikten sonra çalıştır
npm run preview    # derlemeyi yerel önizle

npx supabase db push                             # migration'ları uygula
npx supabase functions deploy generate-questions
```

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

## Kurallar

- **Türkçe yaz** — kod, yorum, commit, yanıtlar.
- **Minimal değişiklik** — mevcut kodu silme/bozma, sınıf adlarını koru.
  Dosyayı baştan yazmak yerine hedefli düzenleme yap.
- **Hata için özür dileme.** Doğrudan bul ve düzelt. Bir hatayı
  düzelttikten sonra aynı hatayı başka dosyalarda da ara.
- Tüm Supabase/API çağrılarında **try-catch** ve hata yönetimi.
- **Emin değilsen tahmin etme — ölç.** "Muhtemelen şudur" diye düzeltme
  yapma; tarayıcıda/veritabanında doğrula, kök sebebi raporla.
- **DB güvenliği:** RLS + RPC'ler `security definer`, yalnız
  `authenticated` rolü. İstemciye güvenme; kritik mantığı (satın alma,
  puanlama, maç durumu) `FOR UPDATE` kilidiyle sunucuda çöz.
- **Migration'lar sıralıdır** — mevcut migration'ı düzenleme, yeni
  numaralı dosya ekle (`20260612000NNN_ad.sql`). Soru eklerken `soru`
  kolonu UNIQUE olduğundan `on conflict (soru) do nothing`.
- **Rakamları koda gömme** — oyun ayarları `oyun_ayarlari` tablosunda,
  eşya kataloğu `esyalar` / `karakterler` tablolarında durur. Yayından
  sonra SQL ile değiştirilebilmeli.
- **Yeni paket kurma.** Tailwind, Framer Motion, styled-components ve
  benzeri yasak. Mevcut yapı: düz CSS + CSS değişkenleri.
- Büyük değişiklikleri küçük adımlara böl, her adımı açıkla.
- Git/teknik terim kullanırken kısa bir sadeleştirme ekle
  (ör. "rebase yaptım (commit'ini güncel hale getirdim)").

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

## Ortam değişkenleri

`.env` içinde: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Edge Function gizli anahtarları Supabase secrets'ta: `ANTHROPIC_API_KEY`,
`CRON_SECRET`. `.env` varyantları ve `.vercel` git'e girmez.

## Proje hafızası

**PROGRESS.md** — yapılan işler, kararlar ve nedenleri. Oturuma
başlarken oku, oturum sonunda **ekleme yaparak** güncelle
(üzerine yazma). Modül klasörlerinde de kendi `PROGRESS.md` dosyaları var.
