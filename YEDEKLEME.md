# Yedekleme ve geri dönüş

> **Denenmemiş yedek, yedek değildir.** Bu belgede hangi adımın **fiilen
> doğrulandığı**, hangisinin **doğrulanamadığı** açıkça ayrılmıştır. Doğrulanmamış
> bir adımı "çalışıyor" diye kabul etme.

Son güncelleme: 18 Eylül 2026 (Paket 26 B)

---

## 18 Eylül 2026 — gece yedeği kuruldu (bir adım sahipte)

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

### 🔴 SAHİBİNİN YAPMASI GEREKEN TEK ADIM

GitHub deposunda **Settings → Secrets and variables → Actions → New repository secret**:

- Ad: `SUPABASE_DB_URL`
- Değer: `postgresql://postgres.zfpnxzybcpkxsotwdsey:<SIFRE>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`
  (`<SIFRE>` = `.env.local` içindeki `SUPABASE_DB_PASSWORD`)

Bu sır konmadan iş ilk adımda **bilerek** durur ve "sır tanımlı değil" der.
Sır depoya, workflow dosyasına ya da migration'a **yazılmaz**.

Sır konduktan sonra Actions sekmesinden **Run workflow** ile bir kez elle çalıştırıp
"Geri yükleme doğrulandı." satırının çıktığı görülmeli; sonucu bu belgeye yaz.

**Bu makinede çalıştırılamadı, sebebi ölçüldü (18 Eyl 2026):** Docker yok, `pg_dump`
yok, `psql` yok, `gh` (GitHub CLI) yok — yani ne döküm alınabiliyor ne de depo sırrı
kurulup iş tetiklenebiliyor. İş GitHub'ın kendi makinesinde çalışacak; orada üçü de var.

---

## 🔴 EN ÖNEMLİ GERÇEK: elle yedek alınmadı

Supabase panelinde **Database → Backups** ekranında yazan (10 Eylül 2026'da
ekrandan doğrulandı):

> **Free Plan does not include project backups.**
> Upgrade to the Pro Plan for up to 7 days of scheduled backups.

Proje **Free** planda. Yani:

- **Otomatik günlük yedek yok.**
- **Point-in-time recovery yok.**
- Veritabanı silinir/bozulursa **geri dönüş yolu yok** — 3 aylık soru havuzu,
  oyuncu hesapları, maç geçmişi, rozetler kalıcı olarak kaybolur.

Bu, yayına çıkmadan kapatılması gereken bir açıktır. İki seçenek var:

1. **Pro plana geç** (aylık ücretli) → 7 günlük otomatik yedek + PITR.
2. **Kendi düzenli dökümünü al** (aşağıdaki prosedür) ve dosyayı Supabase
   dışında sakla. Ücretsiz ama disiplin ister; en az haftalık olmalı.

En sağlıklısı ikisi birden: Pro plan otomatik yedeği verir, kendi dökümün de
sağlayıcıdan bağımsız bir kopya bırakır.

---

## Yedeğin kapsaması gereken şey (10 Eylül 2026 ölçümü)

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
