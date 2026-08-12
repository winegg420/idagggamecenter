# CLAUDE.md — Gölge Boks (kamera + el/vücut takibi modülü)

Bu dosya `boks/` modülü için rehberdir. **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) izole bir parçasıdır; her an ayrı repoya taşınabilir.

## Modül Özeti

**Gölge Boks** — kamera karşısında gerçek gölge boksu yapılan bir **antrenman oyunu ve analiz aracı**. Ekranda beliren antrenör pedlerine doğru yumruk türüyle vurulur; sistem yumruğu gerçek zamanlı sınıflandırır (6 standart boks numarası), puanlar ve oyuncunun dövüş stilini profesyonel bir antrenör gibi analiz eder. Prototip değil; **ticari ürün hedefiyle** yazılmıştır.

Modlar: **Serbest** · **Koç** (yönlendirmeli kombinasyon) · **Savunma** (gelen yumruktan kaçma) · **Ritim** (müziğe senkron).
Zorluk: kolay(2 round/90 sn) · orta(3/75) · zor(4/60) · pro(5/45) + `test` (30 sn seviye kalibrasyonu). Mola 12-15 sn, ilk round öncesi 18 sn ısınma.

## Teknoloji

- React 19 + Vite (hub kabuğu), izole modül; DB öneki `boks_`
- **Takip:** MediaPipe **Tasks Vision** — `HandLandmarker` (el, 21 nokta) + `PoseLandmarker lite` (vücut, 33 nokta), CDN'den ESM. npm bağımlılığı yok.
- **Mimari:** TEK kamera akışı (`kamera.js`) → iki ayrı **worker** (el + poz) → ana thread yalnız kare kopyalar. Her modelin kendi thread'i vardır; ana thread 60 fps render'da kalır.
- Render: HTML5 Canvas (kamera cover + aynalı; üstünde pedler, AR eldiven, darbe halkası, gard göstergesi)
- Ses: WebAudio ile sentezlenir (dosya yok) + **sesli koç** `speechSynthesis` (tr-TR), iki kişilik (agresif / sakin)

## Dizin Yapısı (`boks/`)

- `engine/`
  - `kamera.js` — tek kamera akışı + kare dağıtımı (rVFC); iki takip modülü buna abone olur
  - `takip-worker.js` — el + poz çıkarım worker'ı (model'e göre paketleme)
  - `takip-cekirdek.js` — worker yaşam döngüsü, kare transferi, kısma (`asgariAralik`), ana-thread yedeği
  - `eltakip.js` / `posetakip.js` — model sarmalayıcıları; poz ayrıca **kapsam** (görünürlük) üretir
  - `yumrukTanima.js` — kol başına durum makinesi (bekle→itme→darbe→toparla), 6 numara sınıflandırma, gard/postür izleme, görece şiddet
  - `oyun.js` — faz makinesi, 4 mod, pad/tehdit üretimi, puanlama/combo, ham olay sayaçları, MET kalori, sağlık gözetimi
  - `render.js` — "Gece Antrenmanı" görsel kimliği, pedler, **darbe halkası** (imza efekt), AR eldiven, nefes/tempo göstergeleri
  - `ses.js` — WebAudio efektleri + TTS koç replikleri
  - `antrenorAnalizi.js` — stil vektörü (8 boyut), arketip, round/oturum/kariyer raporu, zayıflık kataloğu, zorluk önerisi
  - `dovusculKutuphanesi.js` — **248 profesyonel dövüşçü** (122 boks · 101 MMA · 25 kickboks/muaythai) stil vektörleriyle
  - `ilerleme.js` — rozetler, streak, kürasyonlu programlar
  - `paylasim.js` — Story paylaşım kartı (canvas) + en iyi combo klibi (MediaRecorder)
- `lib/depo.js` — Supabase RPC'leri + localStorage (tercih, **çevrimdışı kuyruk**, kariyer önbelleği, program ilerlemesi)
- `app/` — `BoksApp.jsx` (rotalar + tercih context), `pages/` (Menu, Oyun, Antrenor, Kariyer, Siralama, Rehber), `styles/boks.css`
- `_test/motor-test.mjs` — Node başsız test (72 doğrulama: sınıflandırma, gard, faz, puanlama, savunma, kalori, analiz, eşleştirme, uçtan uca)

## Kabuğa Bağlantı (paylaşılan `src/`)

TEK bağlantı noktaları: `src/App.jsx` → lazy `/boks/*` · `src/context/AuthContext.jsx` (`useAuth`) · `src/lib/supabase.js` · `src/components/Avatar.jsx`. Başka hiçbir oyun klasöründen import yoktur.

## Veritabanı

Migration: `supabase/migrations/20260612000044_boks_temel.sql`. Tablolar: `boks_tercihler`, `boks_oturumlar`, `boks_roundlar` (ham olay sayaçları), `boks_kariyer` (kümülatif + streak), `boks_skorlar` (leaderboard), `boks_zayifliklar` (koçluk döngüsü), `boks_rozetler`, `boks_sezon` (aylık lig). RLS: kendi satırını okuma; skor/sezon herkese açık okuma; **tüm yazımlar `security definer` RPC ile** (`boks_tercih_kaydet`, `boks_oturum_kaydet`, `boks_siralama`, `boks_sezon_siralama`, `boks_kariyer_getir`), yalnız `authenticated`.

## Kritik Tasarım Kararları

- **Adaptif kapsam:** analiz SADECE kameranın gördüğü bölgelere dayanır. `posetakip.kapsamHesap` üst gövde/kollar/kalça/bacak görünürlüğünü ayrı ayrı verir; kalça görünmüyorsa duruş-denge analizi **hiç üretilmez** (varsayım yok). Rapor bunu kullanıcıya açıkça söyler.
- **Derinlik ekseni:** kameraya doğru atılan düz yumrukta bilek ekranda neredeyse hiç yer değiştirmez. Bu yüzden **el ölçeğinin göreli büyüme hızı** (bilek→orta parmak kökü) ekran hızına eklenip "etkin hız" elde edilir; jab/cross bu olmadan ıskalanır (test 1'de doğrulanır).
- **El → kol ataması:** her el landmark'ı yalnız BİR kola bağlanır (en yakın bilek, `birim*0.5` yarıçap). Tek yönlü "yakınsa al" kuralı gard pozisyonunda aynı eli iki kola verip **sahte yumruk** üretiyordu.
- **Ölçü birimi:** `birim = max(omuz genişliği, kulaklar arası × 2.55)`, EMA ile yumuşatılmış. Boks duruşunda gövde yana döner ve 2D omuz genişliği %40'a kadar küçülür — tek başına omuz genişliği tüm eşikleri kaydırırdı.
- **Tanıma yalnız yeni poz karesinde:** `oyun.guncelle` her karede çağrılır ama `tanima.guncelle` yalnız `damga` değişince, biriken `dt` ile. Aynı landmark'la tekrar hesaplamak hızı sıfıra çeker ve darbe tespitini bozar.
- **Poz kısılır, el kısılmaz:** poz worker'ı `asgariAralik: 33 ms` (~30 Hz) ile çalışır, karesi 384 px'e küçültülür; el tam hızda ve 480 px. İki model aynı anda koşarken bütçe böyle dengelenir. Ana-thread yedeğinde poz çok daha seyrek (110 ms).
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
