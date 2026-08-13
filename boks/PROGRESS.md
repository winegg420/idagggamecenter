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

## 2026-08-13 — OYNANABİLİRLİK VE SENKRON REVİZYONU

Kullanıcı geri bildirimi: *"hedeflere yumruk denk getirmek zor. bazı vuruşlarımı oyun kamera
göremiyor. senkron yeterince iyi değil. kasma düzelmiş ama daha iyi olmalı, yeterli akıcılık yok."*
Dört şikâyetin her biri ayrı bir kök nedene bağlandı.

### 1) "Hedefe denk getirmek zor" — üç ayrı kök neden

**(a) AYNA YÖNÜ HATASI (asıl sebep).** `padKonum` pad'i yanlış tarafa koyuyordu:
`x = 0.5 + (sol el ? +1 : -1) * ...` → sol el pedi ekranın SAĞINDA beliriyordu. Oysa selfie
görüntüsünde oyuncunun sol eli ekranın SOLUNDA görünür. Yani her pede vücudun karşısına
uzanmak gerekiyordu. `kenar` işareti düzeltildi (`sol → -1`).

**(b) Pad'ler ekranın sabit yüzdesindeydi.** Oyuncu kadrajda kenarda/yakında/uzakta durunca
pedler kolunun ulaşamayacağı yerde çıkıyordu. Artık pedler **kafa + `birim`'e göre**
konumlanıyor (`_ankor()`), kadraj dışına taşmayacak şekilde kırpılıyor. Vücut görünmüyorsa
eski ekran-oranı yedeği kullanılıyor.

**(c) Düz yumrukta bilek EKRANDA yer değiştirmiyor.** İsabet testi ham bilek konumunu
kullandığı için jab/cross ped merkezine hiç yaklaşmıyordu. İki değişiklik:
- **Nişan noktası (`nx/ny`):** darbe anında bilek, kol yönünde (omuz→bilek) derinlik
  ilerlemesi kadar ileri taşınır — yumruğun gerçekte "vardığı" nokta.
- **Tür öncelikli eşleştirme:** doğru numaralı pad cömert yarıçapla (2.6 birim) aranır;
  doğru numara yoksa yakındaki yanlış numaralı pad dar yarıçapla (1.05 birim) sadece geri
  bildirim (titreme) için eşleşir. *Karar gerekçesi:* bu oyunun ölçtüğü beceri "doğru
  yumruğu doğru elle atmak"tır; kamerada 2D bilek konumu piksel hassasiyetinde bir nişan
  aracı değildir. Ceza yok ilkesiyle de tutarlı.

Pad yarıçapı da 0.075 → 0.085 (min(W,H) oranı) büyütüldü.

### 2) "Bazı vuruşları göremiyor"

- **Kol noktası hafızası (asıl sebep):** hızlı yumrukta bilek hareket bulanıklığına giriyor ve
  modelin görünürlük skoru 1-2 kare 0.55'in altına düşüyor. Eski kod kolu "görünmüyor" sayıp
  durum makinesini **tam darbe anında** sıfırlıyordu. Artık kol noktaları gevşek eşikle (0.3)
  okunuyor ve kaybolduğunda son bilinen konum 0.22 sn geçerli sayılıyor; faz korunuyor.
- **İkinci darbe kapısı:** 30 Hz'de tepe/yavaşlama karesi tamamen atlanabiliyor. "Kol geri
  dönmeye başladı" (`GERI_BASLADI` 0.05 birim) da biraz düşük eşiklerle darbe sayılıyor.
- **Eşikler ikinci turda gevşetildi:** `ITME_UZANMA_HIZ` 1.1→0.85 · `ITME_BILEK_HIZ` 1.55→1.25 ·
  `MIN_TEPE_HIZ` 1.7→1.35 · `MIN_UZANMA_ARTIS` 0.13→0.1 · `ITME_MAX_SURE` 0.55→0.6.
- **Hızlı çift jab:** `GERI_CEKME` 0.1→0.06 ve toparlanma tavanı 0.5→0.28 sn — ikinci yumruk
  artık yutulmuyor.
- **`BIRIM_EMA` 0.12 → 0.2** (bir önceki oturumda "sıradaki iş" olarak not edilmişti): gövde
  dönerken ölçü birimi geç uyum sağladığı için tüm eşikler kayıyordu.

### 3) "Senkron yeterince iyi değil" — gecikme telafisi

Poz sonucu ait olduğu kameradan ~30-70 ms sonra geliyor (kare yaşı + çıkarım). Bu süre boyunca
el ilerlemiş oluyor; hem çizim hem isabet noktası geride kalıyordu. `gecikmeSn` hesaplanıyordu
ama **hiç kullanılmıyordu**.

- `posetakip` artık her nokta için EMA'lı hız (`vx/vy`, normalize birim/sn) üretiyor.
- `oyun.guncelle` noktaları `gecikme + paket yaşı` kadar ileri sarıyor (tavan 0.11 sn, azami
  yer değiştirme 0.07 normalize — ötesi telafi değil gürültü).
- Ölçülen gecikme EMA'lanıyor: sabit kayma tanımanın hız ölçümünü bozmaz, jitter bozar.
- **Yan kazanç:** ~30 Hz'lik poz akışı 60 fps çizimde kesintisiz akıyor (algılanan akıcılık).

### 4) Akıcılık

- Karartma katmanı kaldırıldı: tuval `alpha:false` olduğundan video doğrudan alfayla çiziliyor →
  **kare başına bir tam ekran geçişi eksildi**. Sıcak ton `RENK.arka` zemin dolgusuyla korunuyor
  (clearRect ile aynı maliyet).
- Piksel bütçesi 900 k → 820 k, dpr tavanı 1.5 → 1.4 (kaynak zaten 640×360; fazla piksel netlik
  katmıyordu).
- **Kalıcı nokta nesneleri:** ekran uzayı eşlemesi kare başına 18 yeni nesne ayırıyordu
  (60 fps'te ~1100 nesne/sn GC baskısı). Artık aynı nesneler yerinde güncelleniyor.
- **Adaptif çıkarım karesi:** render kalitesi 0.7'nin altına düşerse worker karesi 320 → 256 px
  (`PozTakip.kaliteAyarla`) — çıkarım hızlanır, gecikme düşer, poz akışı seyrelmez.
- `kamera.js`: `frameRate.min` kaldırıldı (zorunlu kısıt; bazı cihazlarda kamerayı hiç
  açtırmıyordu).

### Doğrulama

- `node boks/_test/motor-test.mjs` → **83/83 geçti**. Yeni 11 test (bölüm 12): ayna yönü,
  vücuda göre pad konumu + kadraj kırpması, doğru/yanlış numara toleransları, nişan noktası,
  bir kare kaybolan bilekte yumruk üretimi, gecikme telafisi ve hız bilgisi yokken bozulmama.
- `npm run build` → başarılı; BoksApp chunk 138 kB (48 kB gzip).

### Sıradaki İşler

- Gerçek cihazda ölç: HUD teşhis rozetinde artık **Hz ve ms** birlikte görünüyor
  (`25 Hz · 60 ms`). Beklenen: telefonda 25-30 Hz, 40-80 ms, `⚠` (ana-thread yedeği) çıkmamalı.
- Tür öncelikli isabet fazla kolay gelirse `PAD_DOGRU_TOLERANS` 2.6 → 1.8 aralığında kısılabilir
  (tek sabit, tek yerde).
- Migration Supabase Dashboard'dan uygulanmalı (CLI `db push` bu projede 403 veriyor).

## 2026-08-13 (2. oturum) — "denk gelse de vurulmuyor" + hedef boyutu + senkron titremesi

Kullanıcı: *"yumruğum denk gelse de hedefe bazen vurulmuyor. hedefler çok ufak, büyült.
senkron hataları var."* Önceki turda pad tarafı/konumu düzeltilmişti; kalan boşluk **tespit**
tarafındaydı.

### 1) Kalan tespit boşluğu: KOL DÜZLÜĞÜ (üçüncü derinlik kanıtı)

Kök neden: düz yumrukta sistemin elinde iki sinyal vardı — 2D bilek hızı (kameraya doğru
yumrukta ~sıfır) ve **el ölçeği** (bilek↔parmak kökü). Poz *lite* modeli parmak köklerini sık
kaybeder (`PARMAK_ESIK` altına düşer) → `elOlcek = 0` → `zProxy = 0`. O anda uzanma artışı
`MIN_UZANMA_ARTIS`'ı geçemiyor ve **hiç yumruk olayı üretilmiyordu**. Ped konumu ne kadar doğru
olursa olsun olay yoksa isabet de yoktu.

Çözüm — izdüşümden bağımsız üçüncü ölçüt:

    duzluk = |bilek−omuz| / (|bilek−dirsek| + |dirsek−omuz|)   ∈ [0,1]

Kol kameraya doğru uzanınca iki segment de kısalır, ama üç nokta aynı hizaya geldiği için oran
1'e yaklaşır. Yani **kamera açısından bağımsız** olarak "kol açıldı mı" sorusunu yanıtlar.
İki yere bağlandı:
- `uzanma`ya sabit katkı (`DUZLUK_KATKI` 0.75) → `artis` gerçek değer üretiyor.
- `etkinHiz`e düzleşme HIZI (`DUZLUK_HIZ_KATKI` 0.5) → tepe hız eşiği aşılabiliyor.
Dirsek gürültüsü için hızlı EMA (0.7) — gecikme yaratmadan sönümler.

*Neden bu kadar güvenli:* düzlük ne kameraya uzaklığa ne gövde dönüşüne ne de parmak
görünürlüğüne bağlıdır; el ölçeği ve 2D hızdan tamamen bağımsız bir kanaldır.

### 2) Hedefler büyütüldü

- Pad yarıçapı `min(W,H)×0.085` → `max(min(W,H)×0.115, birim×0.55)`, tavan `min(W,H)×0.2`.
  Telefon kadrajında `min(W,H)` küçük olduğu için sabit oran hedefleri "ufak" bırakıyordu;
  ayrıca oyuncu kameraya yaklaştıkça hedef de büyüyor.
- Çakışma mesafesi pad yarıçapına bağlandı (`r × 1.9`) — büyük pedler üst üste binmiyor.
- **Ped ömrüne tespit payı** (`PAD_TESPIT_PAYI` 0.3 sn): darbe olayı gerçek temastan ~100 ms
  sonra üretiliyor; ped tam o anda sönerse "vurdum ama kaçtı" oluyordu.

### 3) Doğru numaralı pedde mesafe koşulu kaldırıldı

Önceki turda 2.6 birim yarıçap konmuştu; hâlâ sınırda kalan vuruşlar eleniyordu. Artık doğru
numaralı ped **mesafeden bağımsız** eşleşiyor (birden fazlaysa en yakını). Yanlış numaralı ped
dar yarıçapta (1.05 birim) yalnız geri bildirim (titreme) için eşleşiyor.
*Karar gerekçesi:* ölçülen beceri "doğru yumruğu doğru elle, süresi içinde atmak"tır; ped zaten
doğru elin tarafında ve gövdeye göre konumlanıyor, dolayısıyla yönlendirme görsel olarak
korunuyor. 2D bilek konumu piksel hassasiyetinde bir nişan aracı değil.

### 4) Senkron titremesi

Fazla ileri sarma, yön değiştiren yumrukta (darbe → geri çekiş) aşırı atıp yeni paket gelince
geri sıçrıyordu; ekranda "senkron hatası" olarak görünen buydu.
- İleri sarma tavanı 0.11 → **0.09 sn**, paket yaşı katkısı **0.03 sn** ile sınırlandı.
- Azami yer değiştirme 0.07 → **0.05** normalize.
- Hız EMA'sı 0.5 → **0.62** (daha çevik; yön değişiminde daha az gecikme).

### Doğrulama

- `node boks/_test/motor-test.mjs` → **88/88 geçti**. Yeni testler:
  - *"El ölçeği okunamasa da düz yumruk tespit ediliyor"* — parmak kökleri `g=0.1`, bilek
    ekranda 2 px kayıyor, yalnız dirsek hizaya giriyor → jab üretiliyor.
  - *"Gardda salınan eller yumruk üretmiyor"* — 1.5 Hz ±0.02 salınım, 100 kare, 0 olay.
    **Eşikler iki kez gevşetildi ve yeni bir sinyal eklendi; bu test sahte tespit bekçisidir.**
  - Pad yarıçapı tabanı/tavanı ve ömür payı.
- `npm run build` → başarılı; BoksApp chunk 138 kB (48 kB gzip).

### Not

`boks/CLAUDE.md` bir ara PowerShell `Get-Content | Set-Content -Encoding utf8` ile bozuldu
(ANSI olarak okundu → mojibake). `git checkout` ile geri alındı. **Bu depodaki Türkçe dosyalarda
PowerShell metin boru hattı kullanma**, düzenleme aracıyla değiştir.

## 2026-08-13 (3. oturum) — RADİKAL: tespit çekirdeği değiştirildi (hız kapıları → tepe yakalama)

Kullanıcı: *"olmuyor, yumruklarımı doğru algılayamıyor. radikal revizyon yap!"*
Önceki iki turda eşikler gevşetildi, sinyal eklendi, ped konumu düzeltildi — ama **mimari aynı
kaldığı için** sorun sürdü. Bu turda mimari değişti.

### Neden eski yaklaşım kurtarılamazdı

Yumruğun sayılması için AYNI ANDA dört kapının geçilmesi gerekiyordu:
(a) uzanma hızı eşiği, (b) bilek/etkin hız eşiği, (c) tepe ya da yavaşlama karesinin
yakalanması, (d) asgari uzanma artışı. 30 Hz'de bir yumruk 3-4 kare sürer; **her kapı ayrı
ayrı ıskalanabiliyordu** ve dördünün birlikte tutma olasılığı gerçek koşullarda düşüktü.
Eşikleri gevşetmek yalnız sahte tespit riskini büyütüyordu — problem eşiklerde değil,
kapı sayısındaydı.

### Yeni çekirdek: TEK SİNYAL + TEPE YAKALAMA

Kol başına tek bir ölçek üretiliyor ve yumruk bu sinyalin bir TEPESİ olarak yakalanıyor.
**Hiçbir hız eşiği yok:** yavaş da atsan hızlı da atsan, kol açılıp geri döndüyse yumruktur.
Kare atlanması sonucu değiştirmez (tepe = örneklenen en yüksek değer).

    uzanim = 0.45×(|bilek−omuz|/birim) + 0.85×duzluk + 0.50×(el ölçeği büyümesi)
    duzluk = |bilek−omuz| / (|bilek−dirsek| + |dirsek−omuz|)   ∈ [0,1]

Üç kanal birbirinden bağımsız: parmak kökleri kaybolsa, dirsek görünmese ya da yumruk
kameraya dik gelse bile kalanlar sinyali taşır. Tipik değerler: gard ≈ 0.45 · jab ≈ 1.25 ·
hook ≈ 1.10 · uppercut ≈ 0.90 · gard salınımı ≈ ±0.07. Eşik 0.28 → her yumruk türü rahat
geçiyor, gürültü 4 kat altında kalıyor.

Darbe anı iki kapıdan erken olanı: sinyal geri dönmeye başladı (`GERI_ESIK`) **ya da** tepede
belirgin artmadan durdu (`TEPE_BEKLEME` — gerçek temas anı, gecikmeyi de kısaltır).
Sınıflandırma artık tepe karesinin ham konumuna değil, **taban ve tepe kayıtları arasındaki
yola** bakıyor (yanal / yukarı / derinlik).

### Geliştirme sırasında çıkan iki tuzak (ikisi de teste bağlandı)

1. **Taban sıkışması.** Yumruk sonrası el ölçeği referansı sıfırlandığı için `uzanim` bir
   kademe düşüyor, sonra gard değerine dönüyor ve tabanın biraz üstünde takılı kalıyordu.
   O zaman "yükseliş" saniyelerce sürmüş görünüyor ve bir sonraki GERÇEK yumruk
   `YUKSELIS_MAX_SURE` kapısına takılıp eleniyordu (testte hook ve uppercut böyle kayboldu).
   Çözüm: sinyal DURGUNSA (`TABAN_DURGUN` 0.2 sn tepe ilerlemiyor) ve yükseliş yumruk eşiğine
   ulaşmadıysa taban bugüne çekiliyor. Gerçek yumrukta tetiklenmiyor (tepe sürekli ilerler).
2. **Gardı indirme.** Kol yana sarkarken de DÜZLEŞİR ve uzanım büyür — düzlük kanıtı bu
   hareketi yumruktan ayırt EDEMEZ. Ayırt eden tek şey gerçek derinlik (el ölçeği) ve yön:
   baskın biçimde aşağı inen, kameraya yaklaşmayan kol reddediliyor (`DUSUS_RED_*`).

### Eşleştirme: üç aşama + görünür tespit

- Sınıflandırma kamerada asla %100 değildir. **Doğru elle atılan ama yanlış türe düşen yumruk**
  eskiden HİÇ sayılmıyordu → "algılamıyor" hissinin büyük bölümü buradandı. Artık **kısmi
  isabet**: ped düşer, azaltılmış puan verilir, ekranda "N İSTENDİ" yazar. Ceza yok ilkesiyle
  tutarlı, üstelik öğretici.
- **Her algılanan yumruk**, pede denk gelmese bile adıyla (JAB/CROSS/HOOK/UPPER) bilek
  hizasında beliriyor. Oyuncu "sistem gördü mü?" sorusunu anında yanıtlıyor; ısınma artık bir
  kalibrasyon/güven anı.

### Çıkarım karesi çift yönlü adaptif

Poz modeli kişiyi kırpıp 256×256'ya ölçekler → kaynak kare büyüdükçe bilek/dirsek keskinleşir.
Cihaz rahatsa 384, normalde 320, zorlanıyorsa 256 px. (Tek yönlüydü, yalnız küçültüyordu.)

### Doğrulama

- `node boks/_test/motor-test.mjs` → **92/92 geçti**. Yeni kritik testler:
  - "Tek karede tamamlanan hızlı yumruk yakalanıyor" ve "Yavaş atılan yumruk da yakalanıyor"
    — eski mimarinin iki kör noktası, artık ikisi de kapalı.
  - "Gardı indirmek yumruk sayılmıyor" (yeni sahte tespit bekçisi).
  - "Aynı el + yanlış tür → kısmi isabet" / "Yanlış el pedi → titreme, puan yok".
- `npm run build` → başarılı; BoksApp chunk 138 kB (49 kB gzip).

### Sıradaki İşler

- Gerçek cihazda: ısınmada 10 yumruk at, ekranda kaç tanesinin adı belirdiğini say. Hepsi
  beliriyorsa tespit tamam; belirmiyorsa `HUD`'daki `Hz · ms` değerini not al.
- Tespit hâlâ eksikse ayarlanacak TEK sabit `YUKSELIS_ESIK` (0.28). Düşürmek daha çok yumruk
  yakalar; sahte tespit bekçisi üç test bunu sınırlar.

## 2026-08-13 (4. oturum) — Sahte tespitin kökü + görsel katmanın tamamen kaldırılması

Kullanıcı: *"ellerimdeki yuvarlak daireyi kaldır, hiç profesyonelce görünmüyor. profesyonelce
görünmeyen her şeyi kaldır. bazı vuruşları algılayamıyor. GARDIM KAPALIYKEN BAZI HEDEFLER
PATLIYOR."*

Son cümle teşhisin kendisiydi: **gard kapalıyken hedef patlıyorsa sistem yumruk atmadığın anda
yumruk üretiyor demektir.** Yani asıl sorun eksik tespit değil, SAHTE tespitti — ve önceki turda
eşleştirmeyi gevşettiğim için (doğru numaralı ped mesafeden bağımsız eşleşiyor) her sahte tespit
doğrudan bir pedi patlatıyordu.

### 1) Sahte tespitin kökü: el ölçeği kanalı

`uzanim` sinyalinin üçüncü kanalı bilek↔parmak kökü mesafesiydi. Poz **lite** modelinde parmak
kökleri (17-20) en gürültülü noktalardır; bu mesafe ekranda ~20 px'tir ve ±%20 seğirme
taban/tepe farkına **0.2'ye varan sahte yükseliş** ekliyordu — eşik 0.28'ken bu tek başına
neredeyse yeterliydi. Gard içinde el kıpırdadıkça yumruk üretiliyordu.

- **El ölçeği tespit sinyalinden çıkarıldı.** Artık yalnız iki KARARLI kanal var: 2D açılım
  (0.45) + kol düzlüğü (0.85). El ölçeği yalnız sınıflandırmada (derinlik kanıtı) ve
  gard-indirme reddinde kullanılıyor.
- `DUZLUK_EMA` 0.7 → 0.55 (hız eşiği olmadığı için gecikme zararsız, gürültü azalıyor).

### 2) Fiziksel doğrulama kapısı (ikinci kilit)

Yükseliş eşiğini geçmek tek başına yetmiyor artık. Gerçek yumrukta ya kol **belirgin düzleşir**
(`DOGRULAMA_DUZLUK` 0.18) ya da bilek **kayda değer yol alır** (`DOGRULAMA_YOL` 0.35 birim).
Gard içindeki seğirme ikisini de yapamaz — tipik gürültü sırasıyla ~0.06 ve ~0.05, yani kapı
3 kat üstünde.

### 3) Test fikstürü fiziksel hale getirildi (önemli bulgu)

Motor artık yumruğu kol düzlüğünden okuduğu için, **bileği oynatıp dirseği sabit tutan eski
sahte gövde fiziksel olarak yumruk DEĞİLDİ** — yalnız el seğirmesiydi ve eski motorun onu
"yumruk" sayması aslında bir kusurdu. Fikstür artık dirseği de hareket ettiriyor:
düz yumrukta dirsek omuz-bilek hattına girer, hook ve uppercut'ta bükülü kalıp yumrukla
savrulur (ikisi de bükülü kollu yumruklardır). Uppercut'ın "düz yumruk" olarak sınıflanması da
buradan çözüldü: `ILERI_DUZLUK` 1.2 → 0.5, çünkü düzlük "kameraya yaklaştı"nın ZAYIF kanıtıdır
(uppercut ve hook'ta da kol bir miktar açılır); güçlü kanıt el ölçeğidir.

### 4) Görsel: oyuncunun üzerine hiçbir şey çizilmiyor

Yeni kural — **kamera görüntüsünün üstüne yalnız oyunun kendi nesneleri çizilir.**
- **Kaldırıldı:** bileklerdeki halkalar, kol iskeleti (omuz-dirsek-bilek çizgileri), kafanın
  etrafındaki kesikli "gard bölgesi" çemberi, nefes al/ver şeridi, pedlerdeki "→ ↷ ↑" okları,
  pedlerin parlayan hale katmanı, popup'lardaki kalın siyah kontur.
- **Geldi:** ped = koyu disk + ince kalan-süre yayı + numara + **yumruğun adı** (JAB/CROSS/
  HOOK/UPPER — hem net hem öğretici). Durum bilgisi (gard uyarısı, tempo) kadrajın altında tek
  satırlık sakin bir şeritte. Popup'lar harf aralıklı, ince gölgeli.
- Oyun ekranındaki **tüm emojiler kaldırıldı** (🔊/🗣️ → "SES"/"KOÇ" metin butonları, 🔥 SERİ →
  "SERİ ×5", 🧍 → "TAKİP AKTİF", ⚠/💡/🎯/✅/🏅/🎬/🧠/🔄/🏠 → düz metin).

### Doğrulama

- `node boks/_test/motor-test.mjs` → **92/92 geçti**. Sahte tespit bekçileri artık üç tane:
  durgun vücut, gardda salınan eller, gardı indirme.
- `npm run build` → başarılı; BoksApp chunk 137 kB (48 kB gzip).

### Bilinen sınır (dürüstlük notu)

`duzluk` dirseği gerektirir. Dirsek hiç görünmezse yalnız 2D kanal kalır; hook/uppercut yine
yakalanır ama kameraya dik jab yakalanamaz. Hazır ekranındaki kadraj uyarısı artık
"dirseklerin görünsün" diyor.

### Sıradaki İşler

- Gerçek cihazda: gard kapalı dur ve 20 saniye hiç yumruk atma — **hiçbir ped patlamamalı**.
  Sonra 10 yumruk at, kaç tanesinin adının ekranda belirdiğini say.
- Hâlâ sahte tespit varsa `DOGRULAMA_DUZLUK`/`DOGRULAMA_YOL` yükseltilir; eksik tespit varsa
  `YUKSELIS_ESIK` düşürülür. İkisi ayrı kilit olduğu için birbirini bozmadan ayarlanabilir.
