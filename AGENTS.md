# AGENTS.md

Bu dosya, bu depoda çalışan AI ajanları (Codex, Claude Code, vb.) için
proje rehberidir. **Her oturuma başlarken oku.**

Claude Code kullanıcısıysan `CLAUDE.md` de aynı içeriği taşır; ikisi
senkron tutulur. Bir kural değişirse **ikisini birden güncelle**.

## ÇALIŞMA KLASÖRÜ — TEK KURAL

Bu depoda **yalnız tek bir çalışma klasörü** vardır:
`C:UsersidaDesktopidagggamecenter`

Codex, Claude Code ve diğer tüm araçlar **bu klasörde** çalışır.
Ayrı worktree, ayrı kopya, `DocumentsCodex...` altında klasör **açılmaz**.
13 Eyl 2026'da ayrık worktree yüzünden 26 commitlik iş görünmez oldu,
canlıdaki 3B sayfalar silindi ve yanlış sistem geliştirildi.
(O klasörlerden kurtarılan iş: `arsiv/OKU.md`.)

### Her oturumun başı
1. `git pull` — başka araç ne yaptıysa al.
2. `git log --oneline -5` — son ne olmuş, gör.
3. `PROGRESS.md`'nin sonunu oku.

### Her oturumun sonu
1. `npm run build` hatasız.
2. Commit et (Türkçe mesaj), **`main`'e push et**.
3. `PROGRESS.md`'ye ne yapıldığını ekle.

**Commit edilmemiş iş bırakma.** Yarım kalsa bile commit et.

### iOS Safari kontrolü — her arayüz değişikliğinden sonra

**Her arayüz değişikliğinden sonra iOS Safari kontrolü yapılır.**
Özellikle sabitlenmiş alt menü ve üst çubuk, sayfa aşağı-yukarı
kaydırılırken test edilir. `position: fixed` ile `transform` **aynı öğede
kullanılmaz**; yükseklikte `100vh` yerine `100dvh` tercih edilir.

Sebep: iOS'ta bu ikisi birlikte sabitlemeyi bozar ve daralıp genişleyen
adres çubuğuyla birleşince menü kaydırma sırasında yerinden oynar.
13 Eyl 2026'da `.tabbar` bu yüzden "sayfayı bölüyordu".
Aynı tuzak **atalarda** da geçerlidir: `transform`, `filter`,
`perspective` ya da transform'lu bir animasyon içeren bir ata, içindeki
`position: fixed` katmanları kendine göre konumlandırır.

**Bu makinede WebKit ÇALIŞMIYOR (17 Eyl 2026, Paket 18 E):** `npm run test:ios:kur`
Playwright WebKit'i kurar, ama Windows 11 **Akıllı Uygulama Denetimi** açık
(`HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy › VerifiedAndReputablePolicyState = 1`)
ve imzasız WebKit DLL'lerini engelliyor (Kod Bütünlüğü günlüğü olay 3077/3033,
süreç çıkış kodu `0xC0E90002`). Denetimi kapatmak güvenlik ayarıdır ve geri açılamaz
— yapılmaz. WSL de yok. Bu yüzden "WebKit kurulu değil" cümlesi raporlara TEKRAR
yazılmaz. Yerine kontrol listesi Chromium'da iPhone boyutunda hesaplanmış stillerle
denetlenir (sabit öğede transform, dönüşümlü ata, kaydırınca kayan sabit öğe, yatay
taşma) ve gerçek iOS kontrolü sahibinin telefonunda yapılır. Başka makinede
(macOS / Linux / Akıllı Uygulama Denetimi kapalı Windows) `npm run test:ios:kur` yeter.

### Yayın
Canlıya çıkış **yalnız GitHub üzerinden** olur (push → Vercel derler).
**Vercel'e doğrudan kaynak dağıtımı yapılmaz.** Öyle bir dağıtım, bir
sonraki normal push'ta sessizce silinir — 13 Eyl'de tam olarak bu oldu.

### Aynı anda çalışma
Aynı anda **tek araç** çalışır. Codex çalışırken Claude Code'a görev
verilmez, tersi de geçerli. Biri işini bitirip push etmeden diğeri başlamaz.

### İki Vercel projesi
Bu depo iki projeyi besler: `idagg-game-center` (hub) ve `quiztactics`.
Ayrımı **`VITE_MOD`** env değişkeni yapar (quiztactics'te `bildim`, hub'da
tanımsız). `vercel.json`'daki `buildCommand` **moda özel olmamalıdır**.
Ayrıntı: aşağıdaki "İKİ VERCEL PROJESİ" bölümü.

## Proje

**IDA GG Game Center** — birçok oyunu tek çatı altında toplayan oyun
portalı (PWA). **Quiz Tactics** hub içindeki bilgi yarışması oyunudur
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

## İKİ VERCEL PROJESİ — `vercel.json`'a MOD GÖMME

Bu depo **iki Vercel projesini** besler:

| Proje | Adres | Ne derlenir |
|---|---|---|
| `idagg-game-center` | idagg-game-center.vercel.app | **Hub** — tüm oyunlar |
| `quiztactics` | quiztactics.vercel.app | **Yalnız Quiz Tactics** |

Ayrımı **tek şey** yapar: `VITE_MOD` ortam değişkeni. quiztactics
projesinde `bildim` olarak tanımlıdır; hub projesinde **tanımsızdır**.

> 17 Eyl 2026: Vercel projesi `quizsquare` → **`quiztactics`** olarak
> yeniden adlandırıldı; yayın adresi **quiztactics.vercel.app**. Eski
> `quizsquare.vercel.app` alan adı projede duruyor (eski linkler çalışsın
> diye), ama duyurulan/varsayılan adres yenisidir.

`vercel.json`'daki `buildCommand` **moda özel olmamalıdır.** İki proje de
aynı `vercel.json`'u okur ve oradaki komut panel ayarını **ezer**; oraya
`--mode bildim` yazmak hub'ı da Quiz Tactics'e çevirir. 12 Eylül 2026'da
tam olarak bu oldu: idagg-game-center adresinde Quiz Tactics'in gardırobu
açıldı, Kafa Topu / DidaGP / Meyve Kes / PatiRun / RUN / Gladius canlıdan
erişilemez oldu.

Moda bağlı **her şey** `vite.config.js` içinde `VITE_MOD` kontrolüyle
yapılır — giriş noktaları (`rollupOptions.input`) dahil. Quiz Tactics'te
`index.html`'in yanına `bildim/avatar3d/` altındaki üç sayfa da
(gardrop, meydan, atölye) girer; hub'da yalnız `index.html` vardır.

Kökteki `index.html` **hub'ın kimliğini** taşır; Quiz Tactics'in başlık ve
paylaşım alanlarını `vite.config.js`'teki "bildim-modu" eklentisi yazar.

## 3B AVATAR SİSTEMİ — DERLEME AYARINA DOKUNMA

Quiz Tactics'in 3B avatar sistemi `bildim/avatar3d/` altındadır. O sayfaların
(`atolye` + `meydan` + `gardrop`) derlemeye girmesi **çok girişli**
yapılandırmaya bağlıdır ve bu yapılandırma `vite.config.js` içindeki
`rollupOptions.input` bloğundadır — **yalnız `VITE_MOD === 'bildim'` iken**.
Orası bozulursa gardırop/atölye/meydan sayfaları canlıdan silinir; istekler
SPA kabuğuna düşer ve sayfa yokmuş gibi davranır. 12 Eylül 2026'da tam olarak
bu oldu.

Giriş listesi **`vercel.json`'a taşınmaz** — sebebi yukarıdaki
"İKİ VERCEL PROJESİ" bölümünde.

`npm run build:bildim` (`bildim/avatar3d/vite.prototip.config.js`) yerel
geliştirme için durur; canlı derlemeyle aynı girişleri üretir.

Depo dışındaki Codex worktree'si **artık kaynak değildir**; her şey bu
depodadır.

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

## Quiz Tactics — yerleşik ürün kararları

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

### Modlar (Paket 14, 15 Eyl 2026)

- **2 mod (Paket 24, 18 Eyl 2026): Normal Maç ve Düello (Taktik Maçı).**
  Turnuva mod değil, etkinlik. **Grup Maçı ödülsüz arkadaş modu**
  (coin/lig/seri yok, rozet var).
- **DONDURULMUŞ İKİ MOD** — dosyalar ve veri durur, arayüzden giriş yoktur:
  **Hızlı Mod** (Paket 24) ve **"Hızlı Olan Kazanır"** (Paket 14).
  Dondurma yöntemi: ana sayfa düğmesi ve harita binası kaldırıldı, rotalar
  (`/hizli-mod`, `/hizli-mac/:id`) ana sayfaya yönlendiriyor, sayfa dosyaları
  (`HizliModPage.jsx`, `HizliMacPage.jsx`) SİLİNMEDİ, tablolar
  (`hizli_mod_oturumlar`, `hizli_mod_skorlar`, `hizli_maclar`, `hizli_oyuncular`)
  boşaltılmadı. Sunucu kapısı: `hizli_mod_acik` / `hizli_mac_acik` ayarları false;
  tablolardaki BEFORE INSERT tetikleyicisi yeni oturumu reddeder, devam eden
  oturum sorunsuz biter. **Geri açmak:** ayarı `true` yap + ana sayfa düğmesini,
  harita binasını ve rotayı geri koy (her birinin yanında yorum var).
  Ölçüldü (18 Eyl 2026): Hızlı Mod son 30 günde 4 oturum / 2 oyuncu,
  "Hızlı Olan Kazanır" 0 kayıt — kapanışın denge etkisi ölçülebilir değil.
- Her mod iki girişli: **Dereceli** (lig puanı + tam coin) / **Serbest**
  (puan yok, coin %50). Arayüzde tek "Dereceli" anahtarı, son tercih
  hatırlanır (localStorage + `profiles.dereceli_tercih`).
- Hızlı Mod (dondurulmuş): soru 10 sn, oturum 90 sn, okuma tavanı 170 karakter.
- **Düello:** 3 can, en çok 10 tur (çift hamle — eşit hamle kuralı); 4 sn
  Saldırı Hazırlığı; savunan 15 sn (Zaman Baskısı 10). Saldırı jokerleri:
  Zaman Baskısı, Soru Değiştir (bir kez), Savunma Kilidi. **Saldırı riski:**
  savunan kendi EN ZAYIF kategorisinde (maç başında sabitlenir) bilirse
  SALDIRAN can kaybeder. Aynı kategori üst üste yok, maçta en çok 2 kez.
  Eşitlikte turnuvanın altın soru mekaniği. Botlar kategoriye göre isabetle
  cevaplar (`bot_kategori_sapma`) — profil hem görünen hem gerçek.
- Kategori yüzdesi için asgari örneklem 10 soru; altı "veri yok".

### Ekonomi (hepsi `oyun_ayarlari`'nda)

- Lig = birikimli emek, **günlük lig tavanı yok**
- Normal Maç galibiyet 25 · berabere 10 · mağlubiyet 0 (teselli yok) — lig ve coin
- Düello galibiyet +50 lig / 50 coin (en çok veren mod)
- Hızlı Mod doğru×3 lig ve coin, oturum başına tavan 25 — **mod dondurulduğu için bu kaynak kapalı** (ayarlar duruyor, değiştirilmedi)
- Turnuva lig: 1. 150 · 2. 80 · 3. 40 · 4-10. 20 · diğer katılan 10
- Günlük seri bonusu `least(gün×3, 15)`
- Arkadaş daveti lig puanı VERMEZ — iki tarafa 200 coin
- İndirimler çarpılmaz: çift koruması / serbest / açık bot → en düşüğü
- Çift koruması (1-5 tam, 6-10 %50, 11+ yok) lig puanına da uygulanır
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

- Marka adı her dilde **"Quiz Tactics"**, çevrilmez
- İlk yayın: Türkçe + İngilizce
- Dil kuralı: giriş yapmışsa profildeki tercih; yoksa tarayıcı dili
  `tr` ile başlıyorsa Türkçe, başka her şeyde İngilizce. IP/ülkeye
  bakılmaz.
- Özel isimler asla çevrilmez (şair "Cami" → "Jami", "Mosque" DEĞİL)

### Reddedilmiş fikirler — tekrar önerme

- "Hızlı cevap modu" (herkese aynı anda aynı soru)
- Loot box / şans kutusu
- Nötr gri/mavi palet, düzleşmiş butonlar

## DONDURULMUŞLAR — tek liste (Paket 26 D, 18 Eyl 2026)

**Hiçbiri silinmez.** Dosyalar ve veri yerinde durur; yalnız arayüzden girişi yoktur.
Her dosyanın başında aynı biçimde bir dondurma bloğu vardır (neden · tarih · paket ·
dosyalar · geri açma adımları). Dağınık not bırakma, buraya ekle.

| Modül | Tarih | Paket | Dosyalar | Sunucu kapısı | Geri açma |
|---|---|---|---|---|---|
| **Hızlı Mod** | 18 Eyl 2026 | 24 B | `bildim/pages/HizliModPage.jsx` | `oyun_ayarlari.hizli_mod_acik = false` + tabloda BEFORE INSERT kapısı | Ayarı `true` yap · rotayı, ana sayfa düğmesini ve harita binasını geri koy · joker testindeki TEST 9 yorumunu aç |
| **"Hızlı Olan Kazanır"** | 15 Eyl 2026 | 14 | `bildim/pages/HizliMacPage.jsx` | `oyun_ayarlari.hizli_mac_acik = false` + BEFORE INSERT kapısı | Ayarı `true` yap · `/hizli-mac/:id` rotasını geri bağla · davet akışındaki `hizli` türünü aç |
| **Eski 3B gardırop / atölye / yerel meydan** | 17 Eyl 2026 | 17 §D | `bildim/avatar3d/**` | yok (HTML girişleri yönlendiriyor) | Üç HTML'deki `location.replace` satırını kaldır · `/gorunum` ve `/gorunum-3b` rotalarını geri bağla · Dükkân › Görünüm sekmesini geri koy |

**Donmuş rotaların davranışı tutarlıdır (ölçüldü):** donmuş oyun modları `/bildim`'e,
donmuş gardırop sayfaları `/bildim/gorunum`'a gider — her biri kendi modülünün
yerine geçen sayfaya. Dört giriş de (iki React rotası + üç HTML) aynı biçimde
`replace` ile yönlendirir, geri tuşuna basınca döngü olmaz.

### Asenkron 1v1 maç dalı — DONDURULMUŞ DEĞİL, KULLANILMIYOR

Paket 26'da canlıdan ölçüldü, önceki varsayım doğru çıkmadı:

- `matches` tablosunda **48 satırın tamamı `senkron = true`**; `senkron = false` olan
  **hiç maç yok** (son 30 günde de 0).
- Ama dal **ölü değil, erişilebilir**: `mac_asenkrona_gec()` `senkron = false` yazan tek
  canlı yoldur ve `bildim/pages/MatchPage.jsx:428` üzerinden, rakip maça gelmediğinde
  (rakip bot değilse) oyuncuya düğme olarak sunulur.

Yani "kimse kullanmamış" ile "çağrılamaz" ayrı şeylerdir. Dalı kaldırmadan önce o
düğmenin ne olacağına karar verilmelidir; bu pakette **dokunulmadı**.

## Ortam değişkenleri

`.env` içinde: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Edge Function gizli anahtarları Supabase secrets'ta: `ANTHROPIC_API_KEY`,
`CRON_SECRET`. `.env` varyantları ve `.vercel` git'e girmez.

## Proje hafızası

**PROGRESS.md** — yapılan işler, kararlar ve nedenleri. Oturuma
başlarken oku, oturum sonunda **ekleme yaparak** güncelle
(üzerine yazma). Modül klasörlerinde de kendi `PROGRESS.md` dosyaları var.
