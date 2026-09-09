# YAYIN ÖNCESİ KONTROL LİSTESİ

Denetim tarihi: **9 Eylül 2026** · Canlı: `https://idagg-game-center.vercel.app`
Kapsam: Bildim + paylaşılan kabuk; güvenlik bulguları hub genelini kapsıyor.

---

## A. BU OTURUMDA BULUNDU VE DÜZELTİLDİ

### A1. 🔴 KRİTİK — Sunucu sırrı herkese açık depoda duruyordu
`CRON_SECRET` yedi migration dosyasının içine düz metin yazılmıştı ve depo
GitHub'da **public**. Canlı uçta doğrulandı: repodaki sırla `send-push`
**200**, yanlış sırla **401**. Yani isteyen herkes tüm kullanıcılara push
gönderebilir, `generate-questions`'ı tetikleyip Anthropic kredisi yakabilirdi.
→ Sır RLS'li `sunucu_gizli` tablosuna alındı, 6 canlı fonksiyon temizlendi
(migration 080). **Döndürme adımı hâlâ açık — bkz. B1.**

### A2. 🔴 KRİTİK — Profil verileri girişsiz okunabiliyordu
`profiles` RLS politikası `using (true)` idi ve SELECT `anon` rolüne de
veriliydi. Anon anahtar JS paketinde olduğu için giriş yapmadan
`GET /rest/v1/profiles?select=*` ile 27 kaydın tamamı dökülebiliyordu:
gerçek addan türeyen `username` (ör. "emiralkaya_12cd"), **Google profil
fotoğrafı adresi**, `davet_kodu`, `provider`, `last_seen`, `hile_yetkisi`.
Oyun ekranda "gerçek adın hiçbir zaman gösterilmez" derken API bunu tutmuyordu.
Ayrıca `anon`/`authenticated` rollerinde INSERT/DELETE/**TRUNCATE**/TRIGGER
yetkileri vardı (TRUNCATE RLS'e tabi değildir).
→ anon erişimi tamamen kaldırıldı; `authenticated` yalnız gösterim sütunlarını
okuyor; kendi profil `profilim()` RPC'siyle geliyor (migration 081).
Doğrulandı: anon için `42501 permission denied`.

### A3. Kafa Topu gerçek adı gösteriyor ve doğrulamayı atlıyordu
Oyuncu adı olarak `profiles.username` okunuyor, isim değiştirme doğrudan
tabloya yazıyordu — uzunluk, benzersizlik, yasaklı kelime ve kilit
kontrollerinin hepsini atlayarak. → `gorunen_ad` + `takma_ad_sec` RPC'si.

### A4. Hata sınırı yoktu
Render hatası tüm ağacı söküp kullanıcıyı beyaz ekranda bırakıyordu.
→ `HataSiniri` eklendi (yenile / ana sayfa + konsola kayıt).

### A5. Paylaşım ve arama görünürlüğü
`og:`/`twitter:` etiketi yoktu (link paylaşınca önizleme boş), `robots.txt`
ve `sitemap.xml` yoktu. → Üçü de eklendi.

---

## B. YAYINDAN ÖNCE SENİN YAPMAN GEREKENLER (panel işi)

### B1. 🔴 CRON_SECRET'i döndür — **en kritik madde**
Eski sır git geçmişinde kalıcı; kod temizlense de geçmişten okunabilir.
1. Yeni bir değer üret (ör. `openssl rand -hex 24`).
2. Supabase → **Edge Functions → Secrets** → `CRON_SECRET` = yeni değer.
3. Bana söyle, aynı değeri `sunucu_gizli` tablosuna yazayım (tek satır).

Bu ikisi arasında push bildirimleri kısa süre çalışmaz; sıra önemli değil,
arayı kısa tut.

### B2. 🔴 Depoyu private yap
Oyunun tüm sunucu mantığı (RLS kuralları, puanlama formülleri, bot davranışı,
soru üretim hattı) herkese açık. Güvenlik RLS'e dayandığı için tek başına
açık değil ama ticari bir oyunda gereksiz risk.
GitHub → Settings → Danger Zone → Change visibility.

### B3. 🟠 Giriş sağlayıcıları
Canlı uçta doğrulandı: `twitter` **400**, `facebook` **400**, `apple` **400**,
misafir girişi `anonymous_provider_disabled`. Yalnız Google (302) çalışıyor.
- Supabase → Authentication → Providers → Twitter + Facebook aç
  (X ve Meta geliştirici portalından Client ID + Secret gerekiyor).
  Callback: `https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback`
- Aynı ekranda "Allow anonymous sign-ins" → misafir girişi.
Kod tarafı ikisi için de hazır; kapalıyken dürüst Türkçe mesaj veriyor.

### B4. 🟠 Yasal metinler
- Gizlilik politikası **taslak** (dosyanın başında da öyle yazıyor):
  veri sorumlusu kimliği (şahıs mı şirket mi, adres) doldurulmalı.
- ~~Kullanım Koşulları sayfası hiç yok.~~ **YAPILDI (9 Eylül 2026):** `/kosullar`
  sayfası yazıldı ve giriş duvarının önüne alındı. Hizmet sağlayıcı kimliği
  (şahıs/şirket, unvan, adres) doldurulmayı bekliyor.
- KVKK aydınlatma metni ayrı istenir (Türkiye'ye yayın yapıyorsan).
- Reklam açılınca çerez/izin metni de gerekir.

### B5. 🟠 Para kazanma yapılandırması
- `VITE_H5_ADS_CLIENT` boş → reklam **test modunda**, ödül verilmiyor.
  AdSense/H5 Games Ads hesabı + yayıncı kimliği gerekiyor.
- Play faturalandırma: TWA paketleme (`--enablePlayBilling`) + Play Console'da
  ürün tanımları. Tarayıcıda "yalnız Android uygulamasında" diyor, doğru.

### B6. 🟡 Alan adı
Şu an `*.vercel.app`. Mağaza kaydı, paylaşım ve güven için kendi alan adın
bağlanmalı (Vercel → Domains). `sitemap.xml`, `robots.txt` ve `og:url`
içindeki adresleri de o zaman güncellemek gerekiyor.

---

## C. YAPILMASI İYİ OLUR (yayını engellemez)

| # | Konu | Durum |
|---|---|---|
| ~~C1~~ | ~~**Soru havuzu dengesiz**~~ | ✅ **KAPANDI (10 Eylül 2026).** Tüm kategoriler 1000+ (en düşük teknoloji 1004). Kök neden de düzeltildi: üretici enum'unda sinema/müzik/teknoloji YOKTU ve `HEDEF_HAVUZ=200` toplam eşik olduğu için üretici aylardır hiç çalışmıyordu. Artık kategori başına eşik + kalite/tekrar kapıları. |
| ~~C2~~ | ~~**Hata izleme yok**~~ | ✅ **KAPANDI (10 Eylül 2026).** Sentry eklendi, tamamen `VITE_SENTRY_DSN`'e bağlı (DSN yoksa pakete bile girmiyor). Gizlilik temizliği: davet kodu + e-posta olaydan siliniyor. DSN girilmesi kullanıcıda. |
| C3 | **DidaGP paketi 1.086 KB** | Hub'ın en büyük parçası (diğerleri 50-200 KB). Mobil ilk açılışta hissedilir. |
| ~~C4~~ | ~~**RPC hız sınırı yok**~~ | ✅ **KAPANDI (10 Eylül 2026).** 12 kullanıcı tetikli uca sınır kondu (cevap 60/60sn, joker 20/60sn, başlatma 10/60sn). Limitler gerçek veriden seçildi; 3 tam maç aynı dakikada takılmıyor. Bot/cron akışları muaf. |
| C5 | **Yedekleme planı** | ⚠️ **DURUM NETLEŞTİ (10 Eylül 2026):** proje **Free planda ve HİÇ otomatik yedeği yok** (panelde doğrulandı). Prosedür `YEDEKLEME.md`'ye yazıldı ama döküm/geri dönüş **denenemedi** (bu makinede pg_dump/Docker yok). Yayın öncesi kapatılmalı. |
| C6 | **Diğer oyunlar denetlenmedi** | Bu denetim Bildim + paylaşılan kabuk odaklıydı. Kafa Topu, Meyve Kes, PatiRun, DidaGP, Gladius, RUN, Boks aynı gözle taranmalı (özellikle RLS ve skor doğrulama). |
| C7 | **Service worker önbelleklemiyor** | `fetch` boş; çevrimdışı destek yok, sadece kurulabilirlik var. Bilinçli tercihse sorun değil. |
| ~~C8~~ | ~~**Hesap silme test edilmedi**~~ | ✅ **KAPANDI (10 Eylül 2026).** Uçtan uca test edildi ve **iki engel bulundu**: turnuva kazanmış ya da birini davet etmiş oyuncu hesabını SİLEMİYORDU (FK ihlali). Düzeltildi (migration 117), 5/5 senaryo geçiyor. |

---

## D. BU DENETİMDE TEST EDİLEN VE ÇALIŞAN

- 8 sayfa (ana, meydan, lig, joker, arkadaşlar, turnuva, hızlı mod, profil):
  hepsi yükleniyor, **yatay taşma yok**, boş/hatalı ekran yok.
- 1v1 bot maçı: soru geliyor, cevap kaydediliyor, skor işliyor.
- Takma ad ve şehir değiştirme: form açılıyor, sunucu doğrulaması dönüyor
  (canlıda şehir "Kırklareli" → "Balıkesir" olarak değişti).
- Avatar seçici: 31 karakter, 31/31 görsel yükleniyor.
- Lig sıralaması: bot ve gerçek oyuncular, podyum, 4 sekme.
- RLS: `public` şemasındaki **tüm tablolarda RLS açık**; politikasız tablolar
  (questions, push_subscriptions, quest_progress…) yalnız RPC üzerinden
  erişilebilir durumda — doğru kurgu.
- pg_cron: 17 görevin **hepsi aktif**.
- Depoda TODO/FIXME **yok**, `console.log` **yok**, `.env` git'e **girmiyor**.
- Soru havuzu: **8.224 aktif** soru.
