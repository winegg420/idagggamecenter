# CLAUDE.md — Gölge Boks (kamera + el/vücut takibi modülü)

Bu dosya `boks/` modülü için rehberdir. **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an ayrı repoya taşınabilir.

## Modül Özeti

**Gölge Boks** — kamera karşısında gerçek gölge boksu yapılan bir **antrenman oyunu ve analiz aracı**. Ekranda beliren antrenör pedlerine doğru yumruk türüyle vurulur; sistem yumruğu gerçek zamanlı sınıflandırır (6 standart boks numarası), puanlar ve oyuncunun dövüş stilini profesyonel bir antrenör gibi analiz eder. Prototip değil; **ticari ürün hedefiyle** yazılmıştır.

Modlar: **Serbest** · **Koç** (yönlendirmeli kombinasyon) · **Savunma** (gelen yumruktan kaçma) · **Ritim** (müziğe senkron).
Zorluk: kolay(2 round/90 sn) · orta(3/75) · zor(4/60) · pro(5/45) + `test` (30 sn seviye kalibrasyonu). Mola 12-15 sn, ilk round öncesi 18 sn ısınma.

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül; DB öneki `boks_`
- **Takip:** MediaPipe **Tasks Vision** — yalnız `PoseLandmarker lite` (vücut, 33 nokta), CDN'den ESM. npm bağımlılığı yok. **El modeli (HandLandmarker) YOKTUR** — bkz. Kritik Tasarım Kararları.
- **Mimari:** TEK kamera akışı (`kamera.js`, 640×360@30) → TEK **worker** (poz) → ana thread yalnız kare kopyalar ve 60 fps render'da kalır.
- Render: HTML5 Canvas (kamera cover + aynalı; üstünde pedler, bilek nişanı, darbe halkası, gard göstergesi)
- Ses: WebAudio ile sentezlenir (dosya yok) + **sesli koç** `speechSynthesis` (tr-TR), iki kişilik (agresif / sakin)

## Dizin Yapısı (`boks/`)

- `engine/`
  - `kamera.js` — tek kamera akışı + kare dağıtımı (rVFC); takip modülü buna abone olur
  - `takip-worker.js` — poz çıkarım worker'ı (yalnız gerekli landmark indeksleri paketlenir)
  - `takip-cekirdek.js` — worker yaşam döngüsü, kare transferi, kısma (`asgariAralik`), ana-thread yedeği
  - `posetakip.js` — model sarmalayıcısı + CDN sabitleri; ayrıca **kapsam** (görünürlük) üretir
  - `yumrukTanima.js` — kol başına durum makinesi (bekle→itme→darbe→toparla), 6 numara sınıflandırma, el ölçeği (derinlik proxy'si), gard/postür izleme, görece şiddet
  - `oyun.js` — faz makinesi, 4 mod, pad/tehdit üretimi, puanlama/combo, ham olay sayaçları, MET kalori, sağlık gözetimi
  - `render.js` — "Gece Antrenmanı" görsel kimliği, pedler, **darbe halkası** (imza efekt), bilek nişanı, nefes/tempo göstergeleri
  - `ses.js` — WebAudio efektleri + TTS koç replikleri
  - `antrenorAnalizi.js` — stil vektörü (8 boyut), arketip, round/oturum/kariyer raporu, zayıflık kataloğu, zorluk önerisi
  - `dovusculKutuphanesi.js` — **248 profesyonel dövüşçü** (122 boks · 101 MMA · 25 kickboks/muaythai) stil vektörleriyle
  - `ilerleme.js` — rozetler, streak, kürasyonlu programlar
  - `paylasim.js` — Story paylaşım kartı (canvas) + en iyi combo klibi (MediaRecorder)
- `lib/depo.js` — Supabase RPC'leri + localStorage (tercih, **çevrimdışı kuyruk**, kariyer önbelleği, program ilerlemesi)
- `app/` — `BoksApp.jsx` (rotalar + tercih context), `pages/` (Menu, Oyun, Antrenor, Kariyer, Siralama, Rehber), `styles/boks.css`
- `_test/motor-test.mjs` — Node başsız test (83 doğrulama: sınıflandırma, gard, faz, puanlama, savunma, kalori, analiz, eşleştirme, uçtan uca + oynanabilirlik regresyonları)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları: `src/App.jsx` → lazy `/boks/*` · `src/context/AuthContext.jsx` (`useAuth`) · `src/lib/supabase.js` · `src/components/Avatar.jsx`. Başka hiçbir oyun klasöründen import yoktur.

## Veritabanı

Migration: `supabase/migrations/20260612000044_boks_temel.sql`. Tablolar: `boks_tercihler`, `boks_oturumlar`, `boks_roundlar` (ham olay sayaçları), `boks_kariyer` (kümülatif + streak), `boks_skorlar` (leaderboard), `boks_zayifliklar` (koçluk döngüsü), `boks_rozetler`, `boks_sezon` (aylık lig). RLS: kendi satırını okuma; skor/sezon herkese açık okuma; **tüm yazımlar `security definer` RPC ile** (`boks_tercih_kaydet`, `boks_oturum_kaydet`, `boks_siralama`, `boks_sezon_siralama`, `boks_kariyer_getir`), yalnız `authenticated`.

## Kritik Tasarım Kararları

- **Adaptif kapsam:** analiz SADECE kameranın gördüğü bölgelere dayanır. `posetakip.kapsamHesap` üst gövde/kollar/kalça/bacak görünürlüğünü ayrı ayrı verir; kalça görünmüyorsa duruş-denge analizi **hiç üretilmez** (varsayım yok). Rapor bunu kullanıcıya açıkça söyler.
- **TEK MODEL (2026-08-12 radikal değişiklik):** `HandLandmarker` kaldırıldı. İki model aynı anda koşarken (iki çıkarım + iki bitmap kopyası) oyun mobilde akmıyordu. El modelinden gereken tek şey **el ölçeği**ydi; o da poz modelinin kendi noktalarından okunuyor: bilek (15/16) ↔ serçe kökü (17/18) / işaret kökü (19/20). CPU ~yarıya indi, poz kısılmadan (asgariAralik 0) koşuyor, yumruk tespiti ESKİSİNDEN hızlı. Yeni bir el modeli eklemeden önce bu kararı oku.
- **Derinlik ekseni:** kameraya doğru atılan düz yumrukta bilek ekranda neredeyse hiç yer değiştirmez. Bu yüzden **el ölçeğinin göreli büyüme hızı** ekran hızına eklenip "etkin hız" elde edilir; jab/cross bu olmadan ıskalanır (test 1'de doğrulanır). Ölçek parmak köklerinden gelir, hafif EMA ile yumuşatılır (poz modelinde parmaklar bilekten gürültülüdür) ve okunamazsa 0 döner — uydurma derinlik üretilmez.
- **El → kol ataması yok:** ölçü zaten doğru kola aittir (aynı landmark ailesi). Eski "el landmark'ını en yakın bileğe ata" adımı ve onun gard pozisyonunda ürettiği **sahte yumruk** riski tümüyle ortadan kalktı.
- **Ölçü birimi:** `birim = max(omuz genişliği, kulaklar arası × 2.55)`, EMA ile yumuşatılmış. Boks duruşunda gövde yana döner ve 2D omuz genişliği %40'a kadar küçülür — tek başına omuz genişliği tüm eşikleri kaydırırdı.
- **Tanıma yalnız yeni poz karesinde:** `oyun.guncelle` her karede çağrılır ama `tanima.guncelle` yalnız `damga` değişince, biriken `dt` ile. Aynı landmark'la tekrar hesaplamak hızı sıfıra çeker ve darbe tespitini bozar.
- **Kare bütçesi:** kamera 640×360@30 (`frameRate` yalnız `ideal` — `min` zorunlu kısıttır ve kamerayı hiç açtırmayabilir), worker'a giden kare 320 px uzun kenar (cihaz zorlanırsa `kaliteAyarla` ile 256'ya iner), `asgariAralik: 0` (uçuştaki tek kare kuralı doğal tavanı koyar). Ana-thread yedeğinde tavan 70 ms. Canvas piksel bütçesi 820 k, dpr tavanı 1.4, kalite tabanı 0.45. Karartma ayrı `fillRect` değil, video çiziminin alfası (kare başına bir tam ekran geçişi eksildi).
- **Tespit eşikleri oynanabilirlik için kalibre edildi:** 30 Hz örneklemede hızlı yumruk 3-5 kare sürer; sıkı eşikler gerçek yumrukları eliyordu. Eşikler iki turda gevşetildi (`ITME_UZANMA_HIZ` 0.85 · `ITME_BILEK_HIZ` 1.25 · `MIN_TEPE_HIZ` 1.35 · `MIN_UZANMA_ARTIS` 0.1), `BIRIM_EMA` 0.2'ye çıkarıldı, pad ömürleri ~%25 uzun, ısınma 10 sn. Değiştirirsen `_test/motor-test.mjs`'teki "durgun vücutta yumruk üretilmiyor" testi sahte tespit bekçisidir.
- **İkinci darbe kapısı:** tepe/yavaşlama karesi 30 Hz'de tamamen atlanabilir. Bu yüzden "kol geri dönmeye başladı" (`GERI_BASLADI`) da darbe sayılır (biraz düşük eşiklerle). Ayrıca `TOPARLA_TAVAN` 0.28 sn: hızlı çift jab'da ikinci yumruk yutulmuyor.
- **Kol noktası hafızası:** hızlı yumrukta bilek bulanıklaşır ve görünürlük 1-2 kare çöker. Kol noktaları için gevşek eşik (0.3) + 0.22 sn hafıza kullanılır; eski kod bu durumda durum makinesini sıfırlayıp yumruğu **tam darbe anında** kaybediyordu.
- **Gecikme telafisi (senkron):** poz sonucu ait olduğu kareden ~30-70 ms sonra gelir. `posetakip` her nokta için EMA'lı hız üretir; `oyun.guncelle` bunu `gecikme + paket yaşı` kadar (tavan 0.11 sn, azami yer değiştirme 0.07 normalize) ileri sarar. Hem isabet noktası gerçek ana hizalanır hem ~30 Hz'lik poz akışı 60 fps çizimde akıcı görünür. Ölçülen gecikme EMA'lanır — jitter ekstrapolasyonu bozar.
- **Ayna yönü (kritik düzeltme):** selfie görüntüsünde oyuncunun SOL eli ekranın SOLUNDA görünür. `padKonum` eskiden pad'i TERS tarafa koyuyordu; her yumruk vücudun karşısına uzanmayı gerektiriyordu — "hedefe denk getirmek zor" şikâyetinin ana kaynağı buydu.
- **Pad'ler vücuda göre konumlanır:** ekranın sabit yüzdesine değil, kafa + `birim`'e göre (kadraj dışına taşmaz). Oyuncu kenarda/yakında/uzakta dursa da pedler kolunun ulaşacağı yerde belirir. Vücut görünmüyorsa eski ekran-oranı yedeği devreye girer.
- **Nişan noktası + tür öncelikli isabet:** düz yumrukta bilek EKRANDA durur; darbe anında bilek, kol yönünde derinlik ilerlemesi kadar taşınır (`nx/ny`). Eşleştirme iki aşamalıdır: doğru numaralı pad **cömert** yarıçapla (`PAD_DOGRU_TOLERANS` 2.6 birim) aranır, doğru numara yoksa yakındaki yanlış numaralı pad dar yarıçapla (1.05) yalnız geri bildirim için eşleşir. Ölçülen beceri "doğru yumruğu doğru elle atmak"tır; 2D bilek konumu piksel hassasiyetinde bir nişan aracı değildir.
- **Ceza yok:** yanlış tür pedi titretir, puan vermez; savunmada "kaçamadın" yalnız geri bildirimdir. Can/ceza sistemi yoktur (Meyve Kes ile tutarlı).
- **Dürüstlük:** kamerada Newton ölçülemez → şiddet, kişinin KENDİ ortalamasına normalize edilmiş 0-100 **görece** skordur (ilk 4 yumruk kalibrasyon). Kalori MET tabanlıdır; kilo girilmezse "tahmini" etiketiyle sunulur.
- **Dövüşçü eşleştirmesi:** yalnız kamuya açık, bilinen stil özellikleri. Sahte alıntı/kurgu diyalog/uydurma biyografik iddia **üretilmez**; sonuç yetenek değil **tarz** benzerliğidir.
- **Çevrimdışı:** oyun internetsiz oynanır; oturum kaydı başarısızsa localStorage kuyruğuna alınır, `online` olayında/açılışta gönderilir.
- **Solak:** duruş seçimi pad numaralandırmasını ve analizi aynalar (`onEl(durus)`); güney pençede yanlış "açık" tespiti yapılmaz.

## Performans Dersleri (Meyve Kes'ten devralınan)

- `shadowBlur` yok (kare başına ayrı blur geçişi) → additif halka/katman.
- Parçacık/efekt çizimi tek geçişte; `kalite < 0.7` olunca pahalı katmanlar kapanır (adaptif çözünürlük).
- Canvas `desynchronized: true`, dpr tavanı 1.5, ~1.1 M piksel bütçesi.
- HUD state'i ~7 fps ve yalnız değer değiştiğinde yazılır (React ağacını boşuna çizdirme).
- Worker'a giden kare **en-boy oranı korunarak** küçültülür — sabit ölçüye sıkıştırmak landmark'ları kaydırır.

## Kurallar

- Türkçe yaz (kod, yorum, UI, commit). Minimal değişiklik; dosyayı baştan yazmak yerine hedefli düzenle.
- Tüm Supabase/kamera/model çağrılarında try-catch ve anlaşılır hata mesajı.
- Landmark formatı değişmezse `yumrukTanima.js` eşiklerine dokunma; değiştireceksen `_test/motor-test.mjs` ile doğrula (`node boks/_test/motor-test.mjs`).
- Migration'lar sıralıdır: mevcut dosyayı düzenleme, yeni numaralı dosya ekle.

## Bağımsız Repoya Ayırma

`boks/` klasörü + `supabase/migrations/20260612000044_boks_temel.sql` taşınır. Değiştirilecek tek şey `src/` bağımlılıklarıdır: `useAuth` (oturum), `supabase` client ve `Avatar` bileşeni — üçü de küçük ve yerine kolayca kendi sürümü konur.

## İlerleme

Detaylı geçmiş: bu klasördeki `PROGRESS.md` + repo kökü `PROGRESS.md`.
