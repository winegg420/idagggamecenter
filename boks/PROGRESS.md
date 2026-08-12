# Gölge Boks — Modül İlerleme Kaydı

## 2026-08-12 — Modülün ilk tam sürümü (sıfırdan uçtan uca)

Hub'a **8. oyun** olarak eklendi: `boks/` (rota `/boks/*`, DB öneki `boks_`, ana sayfada
"Gece Antrenmanı" kimliğiyle kart).

### Yapılanlar

**1) Takip motoru**
- `kamera.js`: TEK kamera akışı (960×540 ideal, 60 fps ideal) + rVFC kare döngüsü; el ve poz
  takibi aynı akışa abone olur. *Karar:* iki modül kendi `getUserMedia`'sını açsaydı çift kod
  çözme + bazı cihazlarda "kamera meşgul" hatası olurdu.
- `takip-worker.js` / `takip-cekirdek.js`: Meyve Kes'in worker altyapısının **izole kopyası**
  (meyvekes/ klasörüne dokunulmadı), iki eklemeyle: kare boyutu parametresi ve `asgariAralik`
  (kısma). Poz worker'ı ~30 Hz'e kısılır ve 384 px kareyle beslenir; el tam hızda, 480 px.
- `posetakip.js`: `PoseLandmarker lite` + **kapsam** üretimi (üst gövde / kollar / kalça /
  bacaklar) — adaptif analiz kapsamının kaynağı.

**2) `yumrukTanima.js` — 6 numara sınıflandırma**
- Kol başına durum makinesi: bekle → itme → **darbe** → toparla.
- Sınıflandırma girdileri: derinlik ilerlemesi (ileri), yanal yol, yukarı yol, dirsek açılması.
- Ön/arka el kimliği duruştan gelir → 1..6; **solak modda numaralandırma aynalanır**.
- Gerçek zamanlı gard izleme (her karede) + vuruş anında karşı elin durumu ayrı sayaçta.
- Postür yalnız kalça görünüyorsa üretilir.

**3) `oyun.js` — 4 mod + faz makinesi**
- isinma(18 sn ilk / 8 sn ara) → round → mola → … → bitti.
- Serbest / Koç (gerçek kombinasyon havuzları, zorlukla uzar) / Savunma (telegraph + kaçış-blok
  değerlendirmesi) / Ritim (BPM'e senkron pad + zamanlama bonusu).
- Combo eğrisi: 3-5 ×1.2, 6-9 ×1.5, 10-14 ×1.8, 15+ ×2.2; şiddet çarpanı 0.8-1.3.
- Round başına ham olay sayaçları (`bosIstatistik`) — analiz motorunun tek kaynağı.
- MET tabanlı kalori, anlık tempo, yorgunluk/efor/postür uyarıları, nefes ritmi.

**4) Görsel/ses**
- `render.js`: "Gece Antrenmanı" paleti, mitt pedleri (numara + kalan süre yayı), **darbe halkası**
  (renk/genişlik şiddete göre kırmızı→camgöbeği), AR eldiven (boks/MMA, renk seçimli), gard
  göstergesi, kol zinciri, nefes ve "geçen seferki tempon" şeridi.
- `ses.js`: WebAudio efektleri (gong, deri teması, combo, beat…) + **sesli koç** (tr-TR TTS),
  iki kişilik için ayrı replik setleri.

**5) Antrenör Modu**
- `antrenorAnalizi.js`: 8 boyutlu stil vektörü, 8 arketip (Rus amatör okulu, peek-a-boo, Meksika
  baskı, kontra, düşük gard, kickboks, muaythai, klasik), round/oturum/kariyer raporu, 12 maddelik
  **zayıflık kataloğu** (her biri ölçüt + teknik tavsiye), koçluk karşılaştırması, zorluk önerisi.
- `dovusculKutuphanesi.js`: **248 dövüşçü** (122 boks · 101 MMA/UFC · 25 kickboks/muaythai),
  ağırlıklı mesafeyle eşleştirme + duruş uyumu bonusu.

**6) Veri katmanı ve DB**
- `20260612000044_boks_temel.sql`: 8 tablo, RLS, 5 RPC. `boks_oturum_kaydet` tek çağrıda oturum +
  roundlar + kariyer + streak + skor + sezon + zayıflık takibi + rozetleri atomik yazar; sunucuda
  makul-sınır denetimi yapar.
- `lib/depo.js`: tercih senkronu, **çevrimdışı kuyruk**, kariyer önbelleği, program ilerlemesi.

**7) Büyüme özellikleri**
- Story paylaşım kartı (1080×1920 canvas) + en iyi combo klibi (MediaRecorder, kütüphanesiz),
  günlük streak, 18 rozet, 3 kürasyonlu program (7/14/30 gün), aylık sezon ligi, seviye testi,
  teknik rehberi sayfası, alan-güvenliği kontrol listesi.

### Alınan Kararlar ve Nedenleri

- **Isınma "round başına":** ilk round öncesi 18 sn tam ısınma, sonraki roundlarda 8 sn hazırlık.
  Mola zaten dinlendiriyor; her round önüne 18 sn koymak akışı gereksiz uzatıyordu.
- **Mod bazlı leaderboard:** Serbest/Koç/Savunma/Ritim puan ölçekleri farklı; tek listede
  birleştirmek adaletsiz olurdu. Sezon sekmesi tüm modların puanını toplar.
- **Seviye testi sıralamaya yazılmaz** (`zorluk='test'` skor/sezon güncellemesini atlar).
- **Klip için MediaRecorder:** GIF encoder kütüphanesi eklemek yerine tarayıcının yerel WebM
  kaydı kullanıldı; combo ≥ 5 olduğunda 4 sn kaydeder, daha iyi combo gelirse yeniler.
- **Font:** afiş fontu Google Fonts `@import` ile; çevrimdışında sessizce Impact/Arial Narrow'a
  düşer (offline mod bozulmaz).

### Doğrulama

- `node boks/_test/motor-test.mjs` → **72/72 geçti** (sınıflandırma, güney pençe aynalama, gard,
  faz makinesi ×4 zorluk, puanlama/combo, koç dizisi, savunma kaçış/blok, kalori, analiz kapsam
  kuralı, dövüşçü eşleştirme, rozetler, uçtan uca poz akışı).
- `npm run build` → başarılı; `BoksApp` chunk'ı 140 kB (48 kB gzip), ayrı chunk (diğer oyunlar
  etkilenmiyor).

### Sıradaki İşler

- Gerçek cihazda kamera testi: iPhone/Android'de iki modelin birlikte fps davranışı, HUD teşhis
  rozetindeki `poz/el Hz` değerleri (⚠ ana-thread yedeğine düşülüp düşülmediği).
- Migration Supabase Dashboard'dan uygulanmalı (CLI `db push` bu projede 403 veriyor).
- Haftalık özet push bildirimi (`send-push` Edge Function'a `boks` kancası) — hub geneli görev.
- Hub birleşik sıralamasına `boks_skorlar.en_iyi` eklenmesi (ayrı görev olarak planlandı).

## 2026-08-12 (2. oturum) — RADİKAL PERFORMANS REVİZYONU: tek model, eldivenler kaldırıldı

Kullanıcı geri bildirimi: *"kamera kasıyor, akıcı değil, eldivenleri sil, oyun akmıyor
oynanmıyor."* Kozmetik düzeltme yerine mimari karar değiştirildi.

### 1) İki model → TEK model (asıl kasma kaynağı)

Eskiden `HandLandmarker` + `PoseLandmarker` aynı kamera akışı üzerinde AYNI ANDA koşuyordu:
iki worker, iki çıkarım, her kare için iki ayrı `createImageBitmap` kopyası. Mobilde bu
bütçeyi karşılamak mümkün değildi.

El modelinden gerçekte kullanılan tek veri **el ölçeği**ydi (bilek→parmak kökü mesafesi =
derinlik proxy'si; düz yumrukta bilek ekranda yer değiştirmediği için şart). Bu ölçü poz
modelinde ZATEN var: bilek (15/16) ↔ serçe kökü (17/18) / işaret kökü (19/20).

- `eltakip.js` **silindi**; `CDN_KOK` sabiti `posetakip.js`'e taşındı.
- `takip-worker.js` yalnız poz modelini kurar; `POZ_INDEKS`'e 17/18 eklendi.
- `takip-cekirdek.js`'ten `model`/`maxEl` parametreleri kalktı.
- `yumrukTanima.js`: el→kol atama bloğu tamamen kaldırıldı; ölçek kol tanımından okunuyor
  (gevşek görünürlük eşiği 0.35 + EMA 0.5, okunamazsa 0 → sessizce 2D'ye düşer).
- **Yan kazanç:** eski atama kuralının gard pozisyonunda ürettiği sahte yumruk riski bitti.

Sonuç: CPU ~yarıya indi, poz artık kısılmadan (`asgariAralik: 0`) her kamera karesinde
koşuyor — yani yumruk tespiti eskisinden HIZLI, üstelik daha akıcı.

### 2) Kare/piksel bütçesi

- Kamera 960×540@60 → **640×360@30** (poz zaten 320 px'e küçültüyordu; büyük kare sadece
  kod çözme + kopyalama maliyetiydi).
- Worker karesi 384 → **320** px uzun kenar.
- Canvas piksel bütçesi 1.1 M → **900 k**; kalite tabanı 0.5 → 0.45; adaptif eşikler
  akıcılık lehine sıkıldı (45 fps altına düşünce kırp, 58 fps üstünde aç).
- Tam ekran vinyet gradyanı artık yalnız `kalite ≈ 1` iken çiziliyor; karartma 0.42 → 0.30
  (oyuncu kendini daha net görüyor).
- `oyun.guncelle` dt tavanı 0.05 → **0.1** sn: kare atlandığında oyun ağır çekime düşmüyordu.

### 3) Eldivenler kaldırıldı (kullanıcı talebi)

`eldivenCiz` (kare başına onlarca ellipse/stroke) silindi. Yerine **bilek nişanı**: her
bileğin üzerinde ince halka, kol "itme/toparla" fazındayken kalınlaşıp darbe rengine
dönüyor — kare başına 4 arc. Kol zinciri de tek `stroke()` geçişine indirildi.
Menüdeki eldiven türü/rengi ayarı ve `.bx-renk*` CSS'i kaldırıldı. `depo.js`'teki
`eldiven_*` alanları DB kolonlarıyla uyum için duruyor (RPC şeması bozulmasın).

### 4) "Oynanmıyor" tarafı — tespit ve akış kalibrasyonu

30 Hz örneklemede hızlı bir yumruk 4-5 kare sürer; ilk sürümün eşikleri gerçek yumrukları
eliyordu ("vurdum ama saymadı").

- `ITME_UZANMA_HIZ` 1.35→1.1 · `ITME_BILEK_HIZ` 1.9→1.55 · `MIN_TEPE_HIZ` 2.1→1.7 ·
  `MIN_UZANMA_ARTIS` 0.16→0.13
- `PAD_TOLERANS` 0.62 → **0.85** birim (isabet kabul yarıçapı)
- Pad ömürleri ~%25 uzun: kolay 2.9 · orta 2.3 · zor 1.8 · pro 1.4
- Isınma 18→**10** sn, ara ısınma 8→**5** sn, molalar 15/14/12/12 → 12/11/10/9

### Doğrulama

- `node boks/_test/motor-test.mjs` → **72/72 geçti** (testler yeni mimariye uyarlandı:
  sahte el landmark'ları yerine `govde({ solOlcek, sagOlcek })` parmak kökü simülasyonu).
  "Durgun vücutta yumruk üretilmiyor" testi gevşetilen eşiklerin sahte tespit bekçisidir.
- `npm run build` → başarılı; BoksApp chunk 135 kB (47 kB gzip), worker ayrı chunk.

### Sıradaki İşler

- **Gerçek cihazda ölç:** HUD teşhis rozetindeki `Hz` değeri artık tek sayı (poz).
  Beklenen: telefonda 25-30 Hz, `⚠` (ana-thread yedeği) çıkmamalı.
- Eşikler hâlâ ıskalıyorsa bir sonraki adım `birim` EMA'sını hızlandırmak (0.12 → 0.2).
- Migration Supabase Dashboard'dan uygulanmalı (CLI `db push` bu projede 403 veriyor).
