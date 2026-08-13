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
- Render: HTML5 Canvas (kamera cover + aynalı; üstünde yalnız pedler, darbe halkası, popup ve alt bilgi şeridi)
- Ses: WebAudio ile sentezlenir (dosya yok) + **sesli koç** `speechSynthesis` (tr-TR), iki kişilik (agresif / sakin)

## Dizin Yapısı (`boks/`)

- `engine/`
  - `kamera.js` — tek kamera akışı + kare dağıtımı (rVFC); takip modülü buna abone olur
  - `takip-worker.js` — poz çıkarım worker'ı (yalnız gerekli landmark indeksleri paketlenir)
  - `takip-cekirdek.js` — worker yaşam döngüsü, kare transferi, kısma (`asgariAralik`), ana-thread yedeği
  - `posetakip.js` — model sarmalayıcısı + CDN sabitleri; ayrıca **kapsam** (görünürlük) üretir
  - `yumrukTanima.js` — **tek sinyalde tepe yakalama** (`uzanim`: 2D açılım + kol düzlüğü + el ölçeği), 6 numara sınıflandırma, gard/postür izleme, görece şiddet
  - `oyun.js` — faz makinesi, 4 mod, pad/tehdit üretimi, puanlama/combo, ham olay sayaçları, MET kalori, sağlık gözetimi
  - `render.js` — "Gece Antrenmanı" görsel kimliği, pedler (numara + ad + kalan süre yayı), **darbe halkası** (imza efekt), alt bilgi şeridi
  - `ses.js` — WebAudio efektleri + TTS koç replikleri
  - `antrenorAnalizi.js` — stil vektörü (8 boyut), arketip, round/oturum/kariyer raporu, zayıflık kataloğu, zorluk önerisi
  - `dovusculKutuphanesi.js` — **248 profesyonel dövüşçü** (122 boks · 101 MMA · 25 kickboks/muaythai) stil vektörleriyle
  - `ilerleme.js` — rozetler, streak, kürasyonlu programlar
  - `paylasim.js` — Story paylaşım kartı (canvas) + en iyi combo klibi (MediaRecorder)
- `lib/depo.js` — Supabase RPC'leri + localStorage (tercih, **çevrimdışı kuyruk**, kariyer önbelleği, program ilerlemesi)
- `app/` — `BoksApp.jsx` (rotalar + tercih context), `pages/` (Menu, Oyun, Antrenor, Kariyer, Siralama, Rehber), `styles/boks.css`
- `_test/motor-test.mjs` — Node başsız test (92 doğrulama: sınıflandırma, gard, faz, puanlama, savunma, kalori, analiz, eşleştirme, uçtan uca + oynanabilirlik regresyonları)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları: `src/App.jsx` → lazy `/boks/*` · `src/context/AuthContext.jsx` (`useAuth`) · `src/lib/supabase.js` · `src/components/Avatar.jsx`. Başka hiçbir oyun klasöründen import yoktur.

## Veritabanı

Migration: `supabase/migrations/20260612000044_boks_temel.sql`. Tablolar: `boks_tercihler`, `boks_oturumlar`, `boks_roundlar` (ham olay sayaçları), `boks_kariyer` (kümülatif + streak), `boks_skorlar` (leaderboard), `boks_zayifliklar` (koçluk döngüsü), `boks_rozetler`, `boks_sezon` (aylık lig). RLS: kendi satırını okuma; skor/sezon herkese açık okuma; **tüm yazımlar `security definer` RPC ile** (`boks_tercih_kaydet`, `boks_oturum_kaydet`, `boks_siralama`, `boks_sezon_siralama`, `boks_kariyer_getir`), yalnız `authenticated`.

## Kritik Tasarım Kararları

- **Adaptif kapsam:** analiz SADECE kameranın gördüğü bölgelere dayanır. `posetakip.kapsamHesap` üst gövde/kollar/kalça/bacak görünürlüğünü ayrı ayrı verir; kalça görünmüyorsa duruş-denge analizi **hiç üretilmez** (varsayım yok). Rapor bunu kullanıcıya açıkça söyler.
- **TEK MODEL (2026-08-12 radikal değişiklik):** `HandLandmarker` kaldırıldı. İki model aynı anda koşarken (iki çıkarım + iki bitmap kopyası) oyun mobilde akmıyordu. El modelinden gereken tek şey **el ölçeği**ydi; o da poz modelinin kendi noktalarından okunuyor: bilek (15/16) ↔ serçe kökü (17/18) / işaret kökü (19/20). CPU ~yarıya indi, poz kısılmadan (asgariAralik 0) koşuyor, yumruk tespiti ESKİSİNDEN hızlı. Yeni bir el modeli eklemeden önce bu kararı oku.
- **TESPİT ÇEKİRDEĞİ = TEK SİNYALDE TEPE YAKALAMA (2026-08-13 radikal revizyon).** Eskiden hız kapılı bir durum makinesi vardı: yumruğun sayılması için AYNI ANDA uzanma hızı, bilek hızı, tepe/yavaşlama karesinin yakalanması ve asgari uzanma artışı gerekiyordu. 30 Hz'de bir yumruk 3-4 kare sürer; her kapı ayrı ıskalanabildiği için gerçek yumruklar sistematik olarak kayboluyordu, eşik gevşetmek ise yalnız sahte tespit üretiyordu. Artık kol başına **tek bir ölçek** üretilir ve yumruk bu sinyalin **tepesi** olarak yakalanır — **hiçbir hız eşiği yoktur**, kare atlanması sonucu değiştirmez.
  ```
  uzanim = 0.45×(|bilek−omuz|/birim) + 0.85×duzluk
  duzluk = |bilek−omuz| / (|bilek−dirsek| + |dirsek−omuz|)   ∈ [0,1]
  ```
  `duzluk` izdüşümden bağımsızdır (kol kameraya uzanınca segmentler kısalır ama noktalar hizaya girer → oran 1'e yaklaşır) — kameraya doğru atılan düz yumruğun tek güvenilir kanıtı budur. Tipik: gard ≈ 0.42 · jab ≈ 1.01 · hook ≈ 1.08 · uppercut ≈ 0.91 · gard gürültüsü ≈ ±0.08 → eşik `YUKSELIS_ESIK` 0.28.
- **EL ÖLÇEĞİ TESPİT SİNYALİNDEN ÇIKARILDI (2026-08-13, 4. tur).** Poz *lite* modelinde parmak kökleri (17-20) en gürültülü noktalardır; bilek↔kök mesafesi ekranda ~20 px'tir ve ±%20 seğirme taban/tepe farkına 0.2'ye varan sahte yükseliş ekliyordu → **gard kapalıyken yumruk üretiliyor, ped patlıyordu.** El ölçeği artık yalnız sınıflandırmada (derinlik kanıtı) ve gard-indirme reddinde kullanılır, tespit kararına giremez. Geri eklemeden önce bunu oku.
- **FİZİKSEL DOĞRULAMA KAPISI:** yükseliş eşiğini geçmek tek başına yetmez. Gerçek yumrukta ya kol belirgin düzleşir (`DOGRULAMA_DUZLUK` 0.18) ya da bilek kayda değer yol alır (`DOGRULAMA_YOL` 0.35 birim). Gard içindeki seğirme ikisini de yapamaz (gürültü sırasıyla ~0.06 ve ~0.05). Sahte tespitin ikinci kilididir.
- **Dirsek kadrajda olmalı:** `duzluk` dirseği ister. Dirsek hiç görünmezse yalnız 2D kanal kalır; hook/uppercut yine yakalanır ama kameraya dik jab yakalanamaz. Hazır ekranındaki kadraj uyarısı bunu söyler.
  Darbe anı: taban→tepe farkı eşiği aştıysa ve sinyal ya geri dönmeye başladıysa (`GERI_ESIK`) **ya da tepede belirgin artmadan durduysa** (`TEPE_BEKLEME`, temas anı). Sınıflandırma **taban ve tepe karelerinin kayıtları** arasındaki yola bakar.
  İki tuzak ve çözümleri: (1) **taban sıkışması** — sinyal tabanın biraz üstünde takılırsa "yükseliş" saatlerce sürmüş görünür ve sonraki gerçek yumruk `YUKSELIS_MAX_SURE` kapısına takılır; sinyal durgunsa ve yükseliş eşiğe ulaşmadıysa taban bugüne çekilir (`TABAN_DURGUN`). (2) **gardı indirme** — kol yana sarkarken de düzleşir; düzlük bunu ayırt EDEMEZ, yalnız gerçek derinlik (el ölçeği) ve yön ayırt eder (`DUSUS_RED_*`).
- **El → kol ataması yok:** ölçü zaten doğru kola aittir (aynı landmark ailesi). Eski "el landmark'ını en yakın bileğe ata" adımı ve onun gard pozisyonunda ürettiği **sahte yumruk** riski tümüyle ortadan kalktı.
- **Ölçü birimi:** `birim = max(omuz genişliği, kulaklar arası × 2.55)`, EMA ile yumuşatılmış. Boks duruşunda gövde yana döner ve 2D omuz genişliği %40'a kadar küçülür — tek başına omuz genişliği tüm eşikleri kaydırırdı.
- **Tanıma yalnız yeni poz karesinde:** `oyun.guncelle` her karede çağrılır ama `tanima.guncelle` yalnız `damga` değişince, biriken `dt` ile. Aynı landmark'la tekrar hesaplamak hızı sıfıra çeker ve darbe tespitini bozar.
- **Kare bütçesi:** kamera 640×360@30 (`frameRate` yalnız `ideal` — `min` zorunlu kısıttır ve kamerayı hiç açtırmayabilir), worker'a giden kare 320 px uzun kenar (cihaz zorlanırsa `kaliteAyarla` ile 256'ya iner), `asgariAralik: 0` (uçuştaki tek kare kuralı doğal tavanı koyar). Ana-thread yedeğinde tavan 70 ms. Canvas piksel bütçesi 820 k, dpr tavanı 1.4, kalite tabanı 0.45. Karartma ayrı `fillRect` değil, video çiziminin alfası (kare başına bir tam ekran geçişi eksildi).
- **Sahte tespit bekçileri:** `YUKSELIS_ESIK`'e dokunursan `_test/motor-test.mjs`'teki ÜÇ test seni korur — "durgun vücutta yumruk üretilmiyor", "gardda salınan eller yumruk üretmiyor", "gardı indirmek yumruk sayılmıyor". Karşı yönde ise "tek karede tamamlanan hızlı yumruk" ve "yavaş atılan yumruk" testleri kör nokta bırakmadığını doğrular. `BIRIM_EMA` 0.2, pad ömürleri ~%25 uzun, ısınma 10 sn.
- **Çıkarım karesi çift yönlü adaptif:** poz modeli kişiyi kırpıp 256×256'ya ölçekler; kaynak kare büyüdükçe bilek/dirsek keskinleşir. Cihaz rahatsa 384, normalde 320, zorlanıyorsa 256 px (`PozTakip.kaliteAyarla`).
- **Kol noktası hafızası:** hızlı yumrukta bilek bulanıklaşır ve görünürlük 1-2 kare çöker. Kol noktaları için gevşek eşik (0.3) + 0.22 sn hafıza kullanılır; eski kod bu durumda durum makinesini sıfırlayıp yumruğu **tam darbe anında** kaybediyordu.
- **Gecikme telafisi (senkron):** poz sonucu ait olduğu kareden ~30-70 ms sonra gelir. `posetakip` her nokta için EMA'lı hız üretir; `oyun.guncelle` bunu `gecikme + paket yaşı` kadar (tavan 0.09 sn, paket yaşı payı 0.03 sn, azami yer değiştirme 0.05 normalize) ileri sarar. Hem isabet noktası gerçek ana hizalanır hem ~30 Hz'lik poz akışı 60 fps çizimde akıcı görünür. Ölçülen gecikme EMA'lanır — jitter ekstrapolasyonu bozar. **Fazla ileri sarma titreme yapar:** yön değiştiren yumrukta aşırı atıp yeni paket gelince geri sıçrar — ekranda "senkron hatası" olarak görülen budur; hız EMA'sı da bu yüzden çevik tutulur (0.62).
- **Ayna yönü (kritik düzeltme):** selfie görüntüsünde oyuncunun SOL eli ekranın SOLUNDA görünür. `padKonum` eskiden pad'i TERS tarafa koyuyordu; her yumruk vücudun karşısına uzanmayı gerektiriyordu — "hedefe denk getirmek zor" şikâyetinin ana kaynağı buydu.
- **Pad'ler vücuda göre konumlanır:** ekranın sabit yüzdesine değil, kafa + `birim`'e göre (kadraj dışına taşmaz). Oyuncu kenarda/yakında/uzakta dursa da pedler kolunun ulaşacağı yerde belirir. Vücut görünmüyorsa eski ekran-oranı yedeği devreye girer.
- **Nişan noktası + tür öncelikli isabet:** düz yumrukta bilek EKRANDA durur; darbe anında bilek, kol yönünde derinlik ilerlemesi kadar taşınır (`nx/ny`). Eşleştirme **üç aşamalıdır**: (1) doğru numaralı pad — mesafeden bağımsız, tam puan; (2) **doğru el, yanlış tür** — kısmi isabet: ped düşer, azaltılmış puan, ekranda doğru numara söylenir (sınıflandırma kamerada asla %100 değildir; eskiden bu vuruş HİÇ sayılmıyordu ve "algılamıyor" hissi veriyordu); (3) yanlış el pedi yakındaysa yalnız titreme. Ayrıca **her algılanan yumruk**, pede denk gelmese bile adıyla ekranda belirir — oyuncu sistemin yumruğu gördüğünü anında okur. Ölçülen beceri "doğru yumruğu doğru elle, süresi içinde atmak"tır; 2D bilek konumu piksel hassasiyetinde bir nişan aracı değildir. Pad ömrüne `PAD_TESPIT_PAYI` (0.3 sn) eklenir: darbe olayı gerçek temastan ~100 ms sonra üretilir.
- **KOL DÜZLÜĞÜ (izdüşümden bağımsız ÜÇÜNCÜ derinlik kanıtı):** `duzluk = |bilek−omuz| / (|bilek−dirsek| + |dirsek−omuz|)` ∈ [0,1]. Kol kameraya doğru uzanınca iki segment de kısalır ama noktalar hizaya girdiği için oran 1'e yaklaşır. Poz lite modeli parmak köklerini sık kaybeder; o zaman el ölçeği 0 döner ve düz yumruk ne ekranda kayar ne derinlik üretirdi — eşiği hiç geçemezdi ("denk geldi ama vurulmadı"). Düzlük hem `uzanma`ya (`DUZLUK_KATKI`) hem `etkinHiz`e (`DUZLUK_HIZ_KATKI` — düzleşme hızı = ileri gitme hızı) katkı verir.
- **Pad boyutu:** `max(min(W,H)×0.115, birim×0.55)`, tavan `min(W,H)×0.2`. Telefon kadrajında `min(W,H)` küçüktür; sabit oran hedefleri "ufak" bırakıyordu. Oyuncu kameraya yaklaştıkça hedef de büyür.
- **Ceza yok:** yanlış tür pedi titretir, puan vermez; savunmada "kaçamadın" yalnız geri bildirimdir. Can/ceza sistemi yoktur (Meyve Kes ile tutarlı).
- **Dürüstlük:** kamerada Newton ölçülemez → şiddet, kişinin KENDİ ortalamasına normalize edilmiş 0-100 **görece** skordur (ilk 4 yumruk kalibrasyon). Kalori MET tabanlıdır; kilo girilmezse "tahmini" etiketiyle sunulur.
- **Dövüşçü eşleştirmesi:** yalnız kamuya açık, bilinen stil özellikleri. Sahte alıntı/kurgu diyalog/uydurma biyografik iddia **üretilmez**; sonuç yetenek değil **tarz** benzerliğidir.
- **Çevrimdışı:** oyun internetsiz oynanır; oturum kaydı başarısızsa localStorage kuyruğuna alınır, `online` olayında/açılışta gönderilir.
- **Solak:** duruş seçimi pad numaralandırmasını ve analizi aynalar (`onEl(durus)`); güney pençede yanlış "açık" tespiti yapılmaz.

## Görsel İlke: oyuncunun üzerine hiçbir şey çizilmez

Bilek halkaları, kol iskeleti ve kafanın etrafındaki kesikli "gard bölgesi" çemberi **kaldırıldı** — bir teşhis overlay'i gibi duruyor, ürünü amatör gösteriyordu. Kural: **kamera görüntüsünün üstüne yalnız oyunun kendi nesneleri çizilir** (pedler, darbe halkası, popup) ve durum bilgisi kadrajın altındaki tek satırlık sakin şeritte durur. Oyun ekranında **emoji kullanılmaz**; ok/ikon yerine metin (JAB · CROSS · HOOK · UPPER), kalın siyah kontur yerine ince gölge. Yeni bir gösterge eklemeden önce sor: *bu, oyuncunun görüntüsünü kirletiyor mu?*

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
