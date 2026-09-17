# Paket 16 — Dört bağımsız iş (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — push bildirimleri alıcının dilinde | ✅ canlıda · migration 214 uygulandı | `07d905d` |
| B — lig çerçeveleri 4 ekranda | ✅ canlıda | `d6966c7` |
| C — meydanda taç + pelerin | ✅ sahibi onayladı (Paket 17 A), `main`'e birleştirildi | `376f453` |
| D — soru üretim cron'u kapatıldı | ✅ canlıda · migration 215 uygulandı | `157dc37` |

Haritaya (Boğaz, cepheler, yapılar, tramvay, kediler, botlar) dokunulmadı. Karakter gövdesi, iskelet, atlas, `karakter.js` değişmedi. Soru üretimi otomatikleştirilmedi.

---

## A — Push bildirimleri

### A.1 Ölçüm: push noktaları (canlı veritabanından, `pg_proc` + `cron.job`)

> **Önce bilinmesi gereken:** canlıda `push_subscriptions` tablosu **boş (0 abone)**. Yani bugün hiçbir push kimseye ulaşmıyor; aşağıdaki "tetikleniyor" sütunu fonksiyonun çalışıp çalışmadığını gösterir (son 14 günde `bildirimler` / `cron.job_run_details`).

| Push noktası | Hangi fonksiyon | Metin (eski, Türkçe sabit) | Canlıda tetikleniyor mu | Yapılan |
|---|---|---|---|---|
| Öğle turnuvası hatırlatma (11:45 TSİ) | cron `bildim-turnuva-hatirlat-sabah` (doğrudan `http_post`) | "☀️ Öğle turnuvası yaklaşıyor! · Turnuva 12:30'da başlıyor…" | ✅ her gün (saat doğru: 12:30 seansı `turnuva_saatleri`'nde var) | anahtar `turnuva_ogle`, `turnuva_hatirlat()` dile göre gruplar |
| Gece turnuvası hatırlatma (21:15 TSİ) | cron `bildim-turnuva-hatirlat` | "🌙 Gece turnuvası yaklaşıyor! · Büyük turnuva 22:00'de…" | ✅ her gün (22:00 seansı var) | anahtar `turnuva_gece` |
| Meydan okuma daveti | `trg_mac_daveti_bildir` → `bildirim_yaz` | "% sana meydan okudu! ⚔️" / "% rövanş istiyor! ⚔️" | ✅ (17 kayıt) | anahtar `mac_daveti` / `rovans` |
| Meydan okuma daveti (**ikinci kopya**) | `notify_new_challenge` (matches tetikleyicisi) | "⚔️ Meydan okuma! · % sana meydan okudu. Kabul ediyor musun?" | ✅ — **aynı olay için 2. push** | push kaldırıldı (tetikleyici işlevsiz kaldı) |
| Meydan okuma kabul | `respond_challenge` | "% meydan okumanı kabul etti - maç başlıyor!" | ✅ (7) | `meydan_kabul` |
| Sıra sende | `trg_mac_sira_bildir` | "% hamlesini yaptı — sıra sende! ⏳" | ✅ (15) | `sira_sende` |
| Maç iptal (hükmen / puansız) | `mac_iptal` | "% maçı iptal etti — hükmen kazandın! 🏆" / "…Kimseye puan yazılmadı." | ✅ (7) — başlık eski marka "Quizador" idi | `mac_iptal_hukmen` / `mac_iptal_puansiz`, başlık "Quiz Tactics" |
| Grup maçı daveti | `trg_grup_daveti_bildir` → `bildirim_yaz` | "% seni % kişilik grup maçına çağırdı! 👥" | ✅ (2) | `grup_daveti` |
| Grup maçı daveti (**ikinci kopya**) | `notify_new_group_challenge` | "👨‍👩‍👧‍👦 Grup meydan okuması! …" | ✅ — **2. push** | push kaldırıldı |
| Arkadaşlık isteği / kabul | `arkadas_davet_kodu_ile_ekle` | "% sana arkadaşlık isteği gönderdi." / "% arkadaşın oldu! 🤝" | ✅ (7) | `arkadas_istek` / `arkadas_kabul` |
| Ligde geçildin | `trg_gecilme_bildir` | "% haftalık ligde seni geçti! Sıranı geri al. ⚡" | ✅ (7) | `gecildin` |
| Lige girdin (ilk maç) | `mac_sayaci_arttir` | "İlk maçını tamamladın — …liglerindesin! 🏙️" | ✅ (15) | `lige_girdin` |
| Seri arttı | `seri_guncelle` | "🔥 Serin % gün oldu! …" | ✅ | `seri_artti` |
| Seri koruması / kırıldı | `seri_kontrol` | "🛡️ Seri korumanı kullandık …" / "💔 % günlük serin kırıldı…" | ✅ | `seri_koruma` / `seri_kirildi` |
| Seri tehlikede | `seri_hatirlat` → `bildirim_yaz` **ve** ayrı `http_post` | "🔥 % günlük serin tehlikede!…" + "🔥 Serin tehlikede! …" | ✅ (45 seri kaydı) — **2 push** | tek push (`seri_tehlike`), ayrı `http_post` kaldırıldı |
| Ustalık | `kategori_dogru_arttir` | "🎖️ % kategorisinde % oldun!" | ✅ (4) | `ustalik` (kategori + unvan da çevrilir) |
| Hafta sonucu | `haftayi_kapat` | "Geçen hafta % liginde %. oldun…" | ⚠️ cron çalışıyor ama `lig_arsiv` **hiç dolmadı** (0 satır, 0 bildirim) | yine de anahtara geçirildi (`hafta_sonuc_sehir` / `_dunya`), ucuz |
| Haftalık lig push | `haftalik_sonuc_bildir` (cron Pzt 06:00) | "🏆 Haftalık lig sonuçlandı! …" | ❌ **ölü** — `lig_arsiv` boş | **dokunulmadı** |
| Hızlı yarış daveti | `notify_new_hizli_davet` + `trg_hizli_daveti_bildir` | "⚡ Hızlı Olan Kazanır! …" / "% seni hızlı maça çağırdı! ⚡" | ❌ **ölü** — mod donduruldu, `hizli_maclar` hiç satır yok | **dokunulmadı** (eski `bildirim_yaz` bu yüzden duruyor) |

### A.2 Yapılan (migration `20260612000214_push_metinleri_dil.sql`, canlıya uygulandı)
- `push_metinleri(anahtar, dil, baslik, govde)` PK `(anahtar, dil)`; RLS açık, `anon`/`authenticated` erişimi kapalı. 20 anahtar × tr/en + 20 `terim:` satırı.
- `push_metni(p_anahtar, p_dil, p_parametre jsonb default '{}')` → `(baslik, govde)`. Dil yoksa `tr`. Yer tutucu kalıbı **`dil.js › ttSunucu` ile aynı**: `%` sırayla, `%2` numaralı. Parametre `terim:<Türkçe>` satırında varsa çevrilir (ttSunucu da yakaladığı parçayı sözlükten çevirir) — "Rakibin" → "Your opponent", "Coğrafya" → "Geography", "Üstat" → "Grandmaster". Oyuncu adı ve şehir çevrilmez.
- `bildirim_anahtarla(user, tip, anahtar, parametre, yol)`: uygulama içi bildirim **Türkçe kalır** (istemci onu zaten `ttSunucu` ile çeviriyor; kalıplar birebir aynı), push alıcının `profiles.dil`'inde. Aboneliği olmayana `http_post` atılmaz.
- `turnuva_hatirlat(anahtar)`: aboneler dile göre gruplanır, **grup başına tek `send-push`**. İki cron işi bu fonksiyonu çağıracak şekilde güncellendi (`cron.alter_job`).
- `push_gonder` / `bildirim_anahtarla` / `turnuva_hatirlat` istemciye kapalı; `push_metni` yalnız `authenticated`.
- 13 canlı fonksiyon `create or replace` ile yeniden tanımlandı — **canlı tanımlardan üretildi, yalnız çağrı blokları değişti** (betik `.tmp/p16/uret214.mjs`, eşleşmeyen blokta durur).
- `dil.js`: "Üstat" → "Grandmaster" (Usta ile aynı "Master" çıkıyordu).

### A.3 Çeviri
dil.js'teki mevcut İngilizce bildirim karşılıkları esas alındı (uygulama içiyle push aynı cümleyi söylesin). Marka "Quiz Tactics" çevrilmedi; mod adları dil.js'teki gibi (Group Match, Tournament); emojiler aynı.

### A.4 Doğrulama
Canlıda abone olmadığı için gönderilen gövde `net._http_response`'tan okunamaz (orada yalnız send-push'un `{basarili, basarisiz}` cevabı durur). Bunun yerine **tek işlem içinde**: kurucuya geçici abonelik eklendi, dil değiştirildi, push tetiklendi, gövde `net.http_request_queue`'dan okundu, **işlem geri alındı (ROLLBACK — hiçbir istek gönderilmedi, hesap değişmedi)**.

| Dil | Tetik | Gelen gövde |
|---|---|---|
| en | `kategori_dogru_arttir` yolu (ustalık) | "🎖️ Mastery" · "🎖️ You became Grandmaster in Geography!" |
| en | `mac_sayaci_arttir` (gerçek fonksiyon) | "🏙️ You're in the leagues" · "You finished your first match — …" |
| en | hafta sonucu (`%2 %1 %3`) | "Last week you finished #4 in the your city league (120 points)…" |
| en | davet ("Bir oyuncu") | "⚔️ Challenge!" · "A player challenged you! ⚔️" |
| en | `turnuva_hatirlat('turnuva_gece')` | 1 grup · "🌙 Night Tournament coming up!" |
| tr | aynıları | "🎖️ Coğrafya kategorisinde Üstat oldun!" · "⚔️ Meydan okuma!" · "🌙 Gece turnuvası yaklaşıyor!" |
| `de` / `null` | `push_metni('seri_tehlike', …)` | Türkçeye düşüyor ✅ |
| — | `seri_hatirlat()` | kurucuya **1** push (önce 2) ✅ |

`profiles.dil` kolonu `NOT NULL default 'tr'` — null dilli hesap olamaz; null yolu fonksiyon düzeyinde denendi.

---

## B — Lig çerçeveleri

- `FriendsPage` (4), `ChallengesPage` (8), `GroupMatchPage` (4), `HizliMacPage` (4): bütün `<Avatar>` → `<AvatarCerceve>`. Profil nesnesinde `id` olmayan yerlerde `userId` verildi.
- **N+1 yok:** `ligCerceve.js` aynı karede istenen kimlikleri 30 ms kuyrukta toplayıp tek RPC atıyor. Ölçüm (sahte Supabase ile gerçek sayfalar, çağrılar sayıldı):

| Ekran | `oyuncu_lig_cerceveleri` çağrısı | Tek çağrıdaki id | Çerçeveli / toplam avatar |
|---|---:|---:|---|
| Arkadaşlar | **1** | 6 | 4 / 6 |
| Meydan Okuma | **1** | 7 | 15 / 24 |
| Grup Maçı (sonuç) | **1** | 5 | 3 / 5 |
| Hızlı Maç (sonuç) | **1** | 5 | 3 / 5 |

- **Küçük boyut (≤ 40 px):** `bd-cerceve-kucuk` — lig halkası 7 → 4 px (iç renk 2 + beyaz 1 + dış ton 1), nadirlik halkası 3 → 2 px, Efsane parıltısı ve Etkinlik kesik halkası içeri çekildi. Avatar ezilmiyor.
- Çerçevesiz oyuncuda nadirlik halkası aynen (görsellerde "Çerçevesiz Ali", "Yeni Oyuncu").
- `prefers-reduced-motion`: Efsane `::before` → `animation: none; display: none` (ölçüldü).
- **iOS Safari:** WebKit bu makinede kurulu değil, gerçek iOS testi **yapılamadı**. Değişiklik yalnız `box-shadow` ve `inset` değerleri; `position: fixed`, `transform`, `100vh` eklenmedi. Chromium 400 px mobil görünümde denendi.
- Görseller: `gorsel/paket16/b-arkadaslar.jpg`, `b-meydan-okuma.jpg`, `b-grup-maci.jpg`, `b-hizli-mac.jpg` (sahte veri; Altın/Efsane/Elmas/Gümüş çerçeveli ve çerçevesiz oyuncu yan yana). Not: Meydan Okuma görselinde sağ kenar kesik — sahte veride aynı liste birden çok sorguya dönüyor ve sınama sayfasında uygulama kabuğu yok; sayfanın kendisiyle ilgili değil.

---

## C — Taç ve pelerin (Paket 17 A ile onaylandı, `376f453`)

### Paketteki varsayım tutmadı
"Taç ve pelerin mevcut kozmetik InstancedMesh'lerine girmeli" — meydandaki mevcut kozmetikler (şapka, gözlük, atkı) **InstancedMesh değil**: `kozmetik.js` her karaktere ayrı mesh klonluyor (tam karakter başına kozmetik başına 1 çağrı). Ayrıca karakter GLB'sinde taç/pelerin meshi yok ve gövde/atlas/karakter.js değişmeyecek. Yani **sıfır yeni çağrıyla** eklemenin yolu yok.

### Yapılan (dalda: `paket16-tac-pelerin`)
- Yalnız `karakter/meydanAvatar.js`. Karakter malzemesiyle (aynı atlas: `altin` / `tisort` hücresi, **yeni doku yok**) taç 50 üçgen, pelerin 48 üçgen.
- **Oyuncu başına klon değil:** bütün oyuncular için tek taç + tek pelerin InstancedMesh → oyuncu sayısından bağımsız **sabit 2 çağrı**, gölge atmaz.
- Her karede örnek matrisi baş/sırt yuvasından (yalnız ata zinciri güncellenir); pelerin fiziksiz: yürüyüş hızıyla geriye açılır + hafif sallanır; "kısa" pelerin 0,58 boy. Taç varken şapka takılmaz. Yalnız TAM karakterlerde (kozmetik kuralıyla aynı).
- Görseller (dalda): `gorsel/paket16/c-tac-pelerin-arkadan.jpg`, `c-tac-pelerin-onden.jpg` — insan, kaplan, robot.

### Ölçüm (3A-2 düzeneği: üretim, 1536×791, DPR 1, en kötü açı, 25 oyuncunun hepsi taç + pelerin, sınır 20, 120 + 300)

| Sürüm | Çağrı | Üçgen | CPU+GPU ms — sıra 1 (önce → sonra) | CPU+GPU ms — sıra ters (sonra → önce) |
|---|---:|---:|---|---|
| Önce (`d6966c7`) | 152 | 433.731 | 4,5 · 5,2 · 5,3 | 5,5 · 5,7 · 5,8 |
| Sonra (taç + pelerin, 18 örnek) | **154 (+2)** | **435.495 (+1.764)** | 5,0 · 5,3 · 5,7 | 5,6 · 5,6 · 5,6 |

- İlk sırada "sonra" hep yüksek çıktı (+0,1…+0,5), sıra ters çevrilince fark −0,2…+0,1'e indi → farkı ölçüm sırası üretiyor; **süre maliyeti ölçülemiyor**.
- **Çağrı maliyeti var: +2 (sabit).** Paket "yeni çizim çağrısı açmamalı; maliyet çıkarsa ekleme, önce söyle" dediği için `main`'e alınmadı. Onay gelirse dal tek komutla birleşir. Alternatif (oyuncu başına klon, mevcut kozmetik deseni) tam karakter başına +1–2 çağrı olurdu, daha pahalı.
- (Bu sahnede toplam çağrı 152; 3A-2 raporundaki 167'den farkının sebebi incelenmedi — iki sürüm burada aynı sahnede, aynı düzenekle karşılaştırıldı.)

---

## D — Soru üretim cron'u

- Migration `20260612000215_soru_uret_cron_kapat.sql`: iş varsa `cron.unschedule('bildim-soru-uret')`. İki kez çalıştırıldı, ikincisi hatasız (iş yokken sessiz).
- Geri açma satırı dosyanın başında. Canlı gövde birebir; tek fark `x-cron-secret`'in düz metin yerine `gizli_al('cron_secret')` ile yazılması (anahtarı yeni dosyaya kopyalamamak için; iki değerin eşit olduğu SQL'de karşılaştırıldı).
- `generate-questions` ve `net._http_response` kayıtları yerinde.

**Kalan cron işleri (23):** bildim-turnuva-ilerlet · bildim-turnuva-hatirlat · bildim-turnuva-hatirlat-sabah · bildim-seri-kontrol · bildim-seri-hatirlat · bildim-yarim-mac-temizle · bildim-turnuva-lobi-bot · bildim-eski-davet-temizle · bildim-bildirim-temizle · bildim-hafta-kapat · bildim-hafta-kapat-pzt · bildim-hafta-bildir · bildim-kotuye-kullanim · bildim-soru-zorluk · bildim-bot-arkadaslik · bildim-lig-kapat · bildim-ikram-zaman-asimi · **bildim-bot-oyna** · **bildim-bot-turnuva-tik** · **bildim-bot-puan-tik** · **bildim-gizli-bot-nabiz** · **bildim-turnuva-zamanlayici** · **duello_tik** (paketin saydığı altısı kalın).

---

## Bilinen eksikler
- **Push'ların hiçbiri şu an kimseye gitmiyor:** `push_subscriptions` boş. Bildirim izni akışı (`BildirimIzniSor`) ya kullanılmıyor ya da abonelik kaydı bir yerde düşüyor — bu pakette incelenmedi.
- `lig_arsiv` hiç dolmadı → `haftayi_kapat` / `haftalik_sonuc_bildir` hafta sonucu bildirimleri pratikte ölü (163 oyuncuda `puan_hafta > 0` olmasına rağmen). Ayrı inceleme gerekiyor.
- Eski `bildirim_yaz(uuid,text,text,text)` yalnız ölü hızlı davet için duruyor.
- C sahibi kararını bekliyor.
- B'de gerçek iOS Safari testi yapılamadı (WebKit yok).
