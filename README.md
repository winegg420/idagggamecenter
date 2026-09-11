# Quiz Square 🧠⚡

Türkçe bilgi yarışması uygulaması — her gece 22:00'de eleme usulü **Gece Turnuvası** ve 7/24 **1v1 Meydan Okuma**.

## Özellikler

- 🌙 **Gece Turnuvası** — Her gece 22:00'de (TSİ) otomatik başlar (Supabase pg_cron). Soru başına 15 saniye; yanlış cevap veya süre aşımı = eleme. Son kalan oyuncu kazanır: +250 puan + 🏆 şampiyonluk rozeti.
- ⚔️ **Meydan Okuma (7/24)** — İstediğin oyuncuya meydan oku; kabul ederse 5 soruluk 1v1 başlar. Daha çok doğru yapan kazanır: +20 puan.
- 🎖️ **Rütbeler** — Çaylak → Bilge (100) → Üstat (500) → Kahin (1500) → Efsane (5000).
- 📊 **Sıralama** — Genel ve arkadaşlar arası ayrı liderlik tabloları.
- 👥 **Arkadaş sistemi** — Ekle, isteği kabul et, arkadaşına tek dokunuşla meydan oku.
- 🤖 **Claude API ile soru üretimi** — Sorular Edge Function üzerinden üretilir, veritabanına kaydedilir, asla tekrar sorulmaz.
- 👍 **Soru adillik oylaması** — Her sorunun altında "Bu soru adil miydi?"; 5+ oyda adil oranı %35'in altına düşen sorular otomatik devre dışı kalır.
- 🔐 **Sosyal giriş** — Google, Facebook, X (Twitter) + e-posta sihirli bağlantı.

## Teknolojiler

React + Vite · Supabase (Auth, Realtime, Postgres, Edge Functions, pg_cron) · Vercel · Claude API

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase URL + anon key gir
npm run dev
```

### Supabase

```bash
npx supabase login
npx supabase link --project-ref <PROJE_REF>
npx supabase db push                          # şema + 40 başlangıç sorusu + cron
npx supabase functions deploy generate-questions
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... CRON_SECRET=<rastgele-gizli>
```

Soru üretimini elle tetiklemek için:

```bash
curl -X POST "https://<PROJE_REF>.supabase.co/functions/v1/generate-questions" \
  -H "x-cron-secret: <CRON_SECRET>"
```

Saatlik otomatik üretim için SQL Editor'da (URL ve secret'ı kendi değerlerinle değiştir):

```sql
select cron.schedule('bildim-soru-uret', '30 * * * *', $$
  select net.http_post(
    url := 'https://<PROJE_REF>.supabase.co/functions/v1/generate-questions',
    headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb
  )
$$);
```

### Sosyal giriş (OAuth)

Supabase Dashboard → **Authentication → Providers**:

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)'dan OAuth Client ID oluştur; redirect URL olarak `https://<PROJE_REF>.supabase.co/auth/v1/callback` gir.
2. **Facebook** — [Meta for Developers](https://developers.facebook.com/)'dan uygulama oluştur, Facebook Login ekle, aynı callback URL'i gir.
3. **Twitter/X** — [X Developer Portal](https://developer.x.com/)'dan uygulama oluştur (OAuth 2.0), aynı callback URL'i gir.

Ayrıca **Authentication → URL Configuration**'da Site URL'i Vercel adresinle güncelle.

> Not: Instagram OAuth Supabase tarafından desteklenmediği için bilinçli olarak yoktur.

### Vercel

```bash
npm i -g vercel
vercel link
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

## Mimari notlar

- **Sorular istemciden okunamaz** (doğru cevap sızmasın diye); soru çekme ve cevap kontrolü tamamen `security definer` RPC'lerle yapılır.
- **Zamanlama sunucu taraflıdır**: 15 sn + 1 sn tolerans sunucuda doğrulanır; istemci saat sapması telafi edilir.
- **Turnuva ilerleyişi** istemcilerin tetiklediği idempotent `advance_tournament` RPC'si + dakikalık pg_cron emniyet göreviyle yürür.
- **Puanlar** yalnızca sunucu tarafında değişir (kolon bazlı yetkilerle istemci güncellemesi engellidir).
