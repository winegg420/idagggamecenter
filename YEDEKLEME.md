# Yedekleme ve geri dönüş

> **Denenmemiş yedek, yedek değildir.** Bu belgede hangi adımın **fiilen
> doğrulandığı**, hangisinin **doğrulanamadığı** açıkça ayrılmıştır. Doğrulanmamış
> bir adımı "çalışıyor" diye kabul etme.

Son güncelleme: 18 Eylül 2026 — gece yedeği kuruldu, çalıştırıldı ve geri yükleme doğrulandı.

---

## ✅ 18 Eylül 2026 — gece yedeği KURULDU ve GERÇEKTEN DOĞRULANDI

Sır eklendi, iş elle çalıştırıldı, döküm alındı ve **boş bir Postgres 17 kabına
geri yüklendi**. Ölçülen sonuç (çalıştırma `35328481162`, 18 Eyl 2026 09:16 UTC):

```
auth.users — kaynak 205, geri yüklenen 205
Hesaplar doğrulandı.
toplam satır — kaynak 43783, geri yüklenen 43783, fark 0 (%0.000)
Geri yükleme doğrulandı.
```

| Ölçüm | Değer |
|---|---|
| Döküm dosyası | **3,0 MB** (`-Fc`, sıkıştırılmış) |
| Artifact boyutu | 2.192.322 bayt · 14 gün saklanıyor |
| Döküm + geri yükleme süresi | ~2 dk |
| `pg_dump` / `psql` sürümü | 17.11 (sunucu 17.6) |
| public tablo satırı | 43.783 → 43.783 (fark 0) |
| Hesap (`auth.users`) | 205 → 205 |
| `npm test` (aynı işte) | 43 node testi + 13 joker kuralı, hepsi geçti |

**Yedek artık hesapları da kapsıyor ve doğruluyor.** `auth` şeması hem döküme hem
geri yüklemeye dahil; hesap sayısı kaynakla birebir tutmazsa iş **kırılır**.

### İlk gerçek koşuda çıkan üç kusur (düzeltildi)

1. **`pg_dump` sürüm uyuşmazlığı.** `postgresql-client-17` kuruluyordu ama
   runner'ın kendi 16.15 istemcisi PATH'te öndeydi; sunucu 17.6 olunca
   `aborting because of server version mismatch` ile düşüyordu.
   `/usr/lib/postgresql/17/bin` PATH'in başına alındı + sürüm kontrolü adımı eklendi.
2. **Testler sessizce atlanıyordu.** `uses:` ile çağrılan workflow, çağıranın
   sırlarını kendiliğinden almaz; `SUPABASE_DB_URL` boş geldiği için 43 sunucu
   testi "skipped" olup iş yeşil görünüyordu — yani hiçbir şey denenmemişti.
   `secrets: inherit` eklendi.
3. **`test:bildim` CI'da kırıyordu**: yalnız `.env.local` arıyor, bulamayınca
   `exit 1` veriyordu. Artık ortak `baglantiDizgisi()` kullanıyor ve bağlantı
   yoksa **atlıyor**.

### Geri yükleme günlüğündeki uyarılar hakkında

Boş bir Postgres kabı Supabase değildir; dökümdeki bazı nesnelerin karşılığı orada
yoktur. İlk koşuda **112 hata** atlanmıştı (RLS politikaları `authenticated` rolü
olmadan kurulamıyordu). Hedefe `anon`/`authenticated`/`service_role` rolleri ve
`extensions` şeması kurulunca günlük **480 → 41 satıra**, `pg_trgm` de eklenince
**37 satıra** indi (son koşu `35328927572`). Geriye yalnız kendi kurduğumuz
`auth.uid/role/jwt` iskeletlerinin dökümdekiyle çakışması kaldı — **hiçbiri veri
değil**. Asıl kapı satır sayısı karşılaştırmasıdır ve o birebir tutuyor:
son koşuda 43.786 → 43.786, hesaplar 205 → 205.

---

## 18 Eylül 2026 — kurulum notları

`.github/workflows/veritabani-yedek.yml` her gece **00:00 UTC (03:00 TSİ)** çalışır:

1. PostgreSQL 17 istemcisini kurar.
2. Dökümden hemen önce kaynaktaki **tablo başına satır sayısını** yazar.
3. `pg_dump -Fc` ile `public` + `auth` + `cron` şemalarını alır.
4. Dökümü **boş bir Postgres 17 kabına GERÇEKTEN geri yükler** ve satır sayılarını
   kaynakla karşılaştırır. Üç kapı: tablo kümesi birebir aynı olmalı · kaynakta
   dolu hiçbir tablo boş geri yüklenmemeli · toplam satır farkı %1'i aşmamalı.
   (%1 payı, döküm ile sayım arasında botların yazdığı satırlar içindir.)
5. Ancak bu doğrulama geçerse dökümü **artifact** olarak 14 gün saklar.
   **Döküm depoya commit edilmez** — depo şişmez, oyuncu verisi git geçmişine düşmez.
6. Kırılırsa sessiz kalmaz: depoda "Gece yedeği başarısız" konusu açılır/güncellenir.

Yani "denenmemiş yedek" sorunu yapısal olarak çözüldü: geri yükleme bir kez değil,
**her gece** deneniyor.

### ✅ Sır kuruldu (18 Eyl 2026)

`SUPABASE_DB_URL` deposunun Actions sırlarında tanımlı:

```
postgresql://postgres.zfpnxzybcpkxsotwdsey:<SIFRE>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

`<SIFRE>` = `.env.local` içindeki `SUPABASE_DB_PASSWORD`. **Değer hiçbir yere
yazılmadı**: `.env.local`'den okunup doğrudan `gh secret set`'in girdisine
borulandı, ekrana ve günlüğe düşmedi. Sır depoya, workflow dosyasına ya da
migration'a **yazılmaz**.

Değiştirmek gerekirse (şifre döndürülürse) aynı yolla:

```bash
node -e "const fs=require('fs');const p=fs.readFileSync('.env.local','utf8').match(/SUPABASE_DB_PASSWORD=(.*)/)[1].trim();process.stdout.write('postgresql://postgres.zfpnxzybcpkxsotwdsey:'+encodeURIComponent(p)+'@aws-1-eu-central-1.pooler.supabase.com:5432/postgres')" \
  | gh secret set SUPABASE_DB_URL --repo winegg420/idagggamecenter
```

Sır tanımlı değilse iş ilk adımda **bilerek** durur ve "sır tanımlı değil" der.

**Bu makinede döküm hâlâ alınamıyor** (Docker yok, `pg_dump` yok, `psql` yok —
18 Eyl 2026'da ölçüldü); `gh` ise **kuruldu** (winget, 2.101.0) ve tarayıcı
akışıyla giriş yapıldı; token keyring'de, dosyada değil. Döküm GitHub'ın kendi
makinesinde alınıyor — orada üçü de var.

---

## Supabase planı — sağlayıcı tarafında hâlâ yedek yok

Supabase panelinde **Database → Backups** ekranında yazan (10 Eylül 2026'da
ekrandan doğrulandı):

> **Free Plan does not include project backups.**
> Upgrade to the Pro Plan for up to 7 days of scheduled backups.

Proje **Free** planda. Yani:

- **Otomatik günlük yedek yok.**
- **Point-in-time recovery yok.**
- Sağlayıcı tarafında geri dönüş yolu yok.

**ARTIK AÇIK DEĞİL:** 18 Eyl 2026'dan beri gece yedeği çalışıyor ve her gece
geri yüklenebilirliği deneniyor (yukarıdaki bölüm). Aşağıdaki iki seçenek hâlâ
geçerli ama artık "hiç yedek yok" durumu yok.

Sağlayıcıdan bağımsız bir kopya için iki seçenek var:

1. **Pro plana geç** (aylık ücretli) → 7 günlük otomatik yedek + PITR.
2. **Kendi düzenli dökümünü al** (aşağıdaki prosedür) ve dosyayı Supabase
   dışında sakla. Ücretsiz ama disiplin ister; en az haftalık olmalı.

En sağlıklısı ikisi birden: Pro plan otomatik yedeği verir, kendi dökümün de
sağlayıcıdan bağımsız bir kopya bırakır.

---

## Yedeğin kapsaması gereken şey (10 Eylül 2026 ölçümü — ESKİ)

> Güncel sayılar yukarıdaki doğrulama bölümünde: 43.783 public satırı, 205 hesap.
> Aşağıdaki tablo tarihsel kayıttır, referans için dokunulmadı.

| Ne | Miktar |
|---|---|
| Veritabanı boyutu | **206 MB** |
| `public` tablo sayısı | 75 |
| Fonksiyon (RPC/tetikleyici) | 170 |
| RLS politikası | 97 |
| Tetikleyici | 23 |
| `pg_cron` işi | 18 |
| Auth kullanıcısı | 29 |
| Storage dosyası | 0 |

En büyük tablolar: `questions` 11.982, `match_answers` 1.674,
`yanlis_sorular` 344, `gorulen_sorular` 322, `group_match_answers` 319.

**Bir geri dönüş bu sayıları tutturmalı.** Restore sonrası doğrulama için
yukarıdaki tabloyu referans al.

---

## Yedeğin KAPSAMADIĞI şeyler (ayrı ayrı ele alınmalı)

`pg_dump` yalnız veritabanını alır. Aşağıdakiler **döküme girmez**:

| Ne | Nerede durur | Ne yapmalı |
|---|---|---|
| **Edge Function sırları** | Supabase → Edge Functions → Secrets | Elle not et: `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. (`ANTHROPIC_API_KEY` ve `PLAY_*` şu an tanımlı değil.) |
| **Edge Function kodu** | Bu depo: `supabase/functions/` | Git'te duruyor, ayrıca yedeklemeye gerek yok |
| **Auth kullanıcıları** | `auth` şeması | `pg_dump`'a `--schema=auth` eklenmezse **GİTMEZ**. Aşağıdaki komutta dahil edildi. |
| **Storage dosyaları** | Supabase Storage | Şu an **0 dosya** — bugün için sorun değil, avatar yüklemesi eklenirse değişir |
| **Ortam değişkenleri** | Cloudflare Pages + Vercel panelleri | Elle not et (bkz. `CLOUDFLARE_DAGITIM.md`) |
| **`pg_cron` işleri** | `cron` şeması | `--schema=cron` eklenmeli, yoksa 18 zamanlanmış iş gitmez |

---

## Döküm alma prosedürü

### Gereksinim (ŞU AN BU MAKİNEDE YOK)

Aşağıdaki üçünden **en az biri** gerekli:

- `pg_dump` (PostgreSQL 17 istemci araçları), veya
- **Docker Desktop** (Supabase CLI dökümü Docker üzerinden alıyor), veya
- Dökümü alacak başka bir makine

Bu makinede kontrol edildi (10 Eylül 2026): `pg_dump` **yok**, `psql` **yok**,
`docker` **yok**. `npx supabase db dump` denendi, şu hatayı verdi:

```
failed to inspect docker image: ... open //./pipe/docker_engine:
Sistem belirtilen dosyayı bulamıyor.
Docker Desktop is a prerequisite for local development.
```

**Bu yüzden döküm FİİLEN ALINAMADI ve geri dönüş DENENEMEDİ.**
Aşağıdaki komutlar doğru komutlardır ama bu makinede çalıştırılıp
doğrulanmamıştır — ilk fırsatta çalıştırıp bu belgeyi güncelle.

### Bağlantı dizgisi

Şifre `.env.local` içindeki `SUPABASE_DB_PASSWORD`:

```
postgresql://postgres.zfpnxzybcpkxsotwdsey:<SIFRE>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

### Komut (pg_dump kuruluysa)

```bash
# Tam mantıksal yedek: şema + veri + auth kullanıcıları + cron işleri
pg_dump "postgresql://postgres.zfpnxzybcpkxsotwdsey:<SIFRE>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" \
  --schema=public --schema=auth --schema=cron \
  --no-owner --no-privileges \
  -Fc -f quizador-$(date +%Y%m%d).dump
```

- `-Fc` sıkıştırılmış özel biçim (geri dönüşte `pg_restore` ile seçmeli
  kullanılabilir). Düz SQL istersen `-Fp -f ...sql`.
- `--no-owner --no-privileges`: hedefte rol adları farklı olacağı için şart.
- 206 MB'lık veritabanı için beklenen dosya boyutu kabaca **30-60 MB**
  (sıkıştırılmış). **Gerçek boyutu ilk dökümde buraya yaz.**

### Komut (Docker kuruluysa, pg_dump yoksa)

```bash
npx supabase db dump --db-url "<yukarıdaki dizgi>" -f quizador-sema.sql          # şema
npx supabase db dump --db-url "<yukarıdaki dizgi>" --data-only -f quizador-veri.sql  # veri
```

---

## Geri dönüş prosedürü (BOŞ HEDEFTE)

> ⚠️ **CANLI VERİTABANINA ASLA RESTORE ETME.** Geri dönüş, canlıyı ezer.
> Önce boş bir hedefte dene.

### Hedef seçenekleri

1. **Yerel Postgres** (`docker run -p 5433:5432 -e POSTGRES_PASSWORD=x postgres:17`)
2. **`supabase start`** (yerel Supabase, Docker ister)
3. **Yeni, boş bir Supabase projesi** (Free plan yeterli)

### Komut

```bash
pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres:x@localhost:5433/postgres" \
  quizador-YYYYMMDD.dump
```

### Geri dönüş sonrası DOĞRULAMA (bu adım atlanamaz)

```sql
select count(*) from questions;              -- beklenen ~11.982
select count(*) from auth.users;             -- beklenen ~29
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public';                  -- beklenen ~170
select count(*) from pg_policy;              -- beklenen ~97
select count(*) from cron.job;               -- beklenen ~18
```

Sayılar tutmuyorsa yedek **eksiktir** — hangi şemanın atlandığını bul.

---

## Felaket anında adım adım

1. **Dur.** Panikle bir şey silme; durumu kötüleştirebilirsin.
2. Supabase panelinden projenin **hâlâ var olup olmadığını** kontrol et.
   Proje duruyorsa ve yalnız veri bozulduysa, en son dökümü hazırla.
3. **Yeni ve BOŞ** bir Supabase projesi aç. Bozuk projeye restore etme —
   önce sağlam bir kopya elde et.
4. En son dökümü yeni projeye `pg_restore` ile yükle.
5. Yukarıdaki **doğrulama sorgularını** çalıştır. Sayılar tutmuyorsa dur.
6. Edge Function'ları yeniden dağıt (`supabase/functions/` depoda) ve
   **sırları elle gir** (`CRON_SECRET`, `VAPID_*`).
7. Yeni proje URL'i ve anon anahtarını Cloudflare Pages ortam değişkenlerine
   yaz, yeniden dağıt (bkz. `CLOUDFLARE_DAGITIM.md`).
8. Supabase → Authentication → URL Configuration'a yayın adreslerini ekle.
9. Bir maç oynayarak uçtan uca dene.

---

## Yapılacaklar

- [ ] **Pro plana geçmeye karar ver** (otomatik yedek + PITR) — en kritik madde
- [ ] Bu makineye `pg_dump` veya Docker kur
- [ ] İlk gerçek dökümü al, **boyutunu ve süresini bu belgeye yaz**
- [ ] Boş bir hedefte geri dönüşü **fiilen dene**, doğrulama sorgularını çalıştır
      ve sonucu bu belgeye yaz
- [ ] Düzenli döküm için bir hatırlatıcı kur (en az haftalık)
- [ ] Döküm dosyasını Supabase dışında bir yerde sakla (aynı sağlayıcıda
      tutulan yedek, sağlayıcı kaybında işe yaramaz)
