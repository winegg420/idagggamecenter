# RUN — İlerleme Günlüğü

> RUN spec'i (konuşmada verilen tam doküman) temel alınıyor. Prototip: tek-oyunculu +
> bot + tek drone, tek harita (Ofis). Amaç: önce eğlence/mekaniği İda'ya oynatıp
> "iyi mi kötü mü" kararı almak. Görsel kalite kod-çizim (bilinçli — RUN'ın olayı mekanik).

## Onaylanan yöntem ayarları (İda ile)
- Önce tek-oyunculu + bot (multiplayer sonraya — spec Faz 10).
- Takip eden kamera (RUN labirent olduğu için; Gladius sabit kameradan farklı).
- Prototipte tek harita (Ofis) + tek drone.

## 2026-07-08 — İlk oynanabilir dilim (TAMAMLANDI, doğrulandı)
Modül: `run/` (Gladius gibi izole). Dosyalar:
- `engine/sabitler.js` — dünya, hız, görüş/fener, drone sabitleri.
- `engine/harita.js` — Ofis: yürünebilir odalar/koridorlar (isimli), çıkışlar, AI nesneleri;
  `yurunebilir/cikistaMi/odaAdi` yardımcıları.
- `engine/girdi.js` — WASD/oklar + dokunmatik joystick + sopa(J)/kalkan(K) tuşları.
- `engine/durum.js` — oyuncu + botlar (gezinme) + tek drone (devriye/kovala), çarpışma
  (duvar kayması), ışık/karanlık değişimi, drone algılama (ışıkta GPS + karanlıkta ısı),
  temasla yakalama, çıkışla kaçış, takip kamera.
- `engine/render.js` — takip kamera; sınırlı görüş: karanlık overlay + oyuncu ışığı + **fener
  konisi** (destination-out) + **sıcak ışık** (additive); aydınlık odalar; çıkışlar her zaman
  görünür (yeşil); drone yakınsa kırmızı kenar uyarısı.
- `engine/motor.js` — rAF döngü, DPR, çökme-dayanıklı.
- `_test/run-test.html` — login'siz oynanabilir test (WASD; KAÇTIN/YAKALANDIN + Tekrar).

Test (geçti): çarpışma (duvardan çıkamaz), çıkış→'kacti', drone teması→'yakalandi',
ışıkta algılama→'kovala'. Görsel: karanlık labirent + fener konisi + drone uyarısı — İda'ya gösterildi.
Oyna (login yok): `http://localhost:5173/run/_test/run-test.html`

## 2026-07-08 — Grafik güncelleme TUR 1 (~%40, TAMAMLANDI)
Cyberpunk atmosfer geçişi (`render.js`): panelli/ızgaralı zemin + neon oda kenarları,
kapüşonlu oyuncu figürü (neon kimlik aksanı, ışığın üstünde en son çizilir → hep net),
detaylı drone (4 rotor + tarama gözü/ışını, kovalarken kırmızı), serin-beyaz fener +
koni içi toz zerreleri, parlayan monitörler, neon yeşil çıkış, oda plakaları, lacivert palet.
İda çok beğendi; 2-3 turda görsel detay kademeli yükseltilecek.

## 2026-07-08 — Grafik güncelleme TUR 2-5 (İda: "4 tur ilerle, detayları göreyim")
- **Oda içi mobilya/detaylar** (`mobilyaCiz`): ofis (masa+monitör+sandalye), sunucu odası
  (raf+yanıp sönen LED), toplantı (masa+sandalyeler), dinlenme (kanepe+sehpa+bitki), giriş
  (resepsiyon+bank), koridor (yön okları+kasa). Panel ızgarası + duvar derinliği + neon kenar.
- **Botlar görünür + seninle hareket eder:** başlangıçta yanında spawn, uzaklaşınca sana
  yaklaşır; isimli sensör göstergeleri (blip+isim) karanlıkta bile.
- **Drone net görünür** (4 rotor + tarama gözü/ışını).
- **Loş ortam** (karanlık 0.60, zifiri değil) → tüm harita/oda detayları okunur, fener parlak vurgu.
  (İstenirse "stealth" için tekrar koyulaştırılabilir / toggle eklenebilir.)
- Mobilya renkleri parlaklaştırıldı, alarm yumuşatıldı.

## 2026-07-08 — Büyük harita + zengin detay + çoklu drone (İda talebi)
- **Harita ~5.8x** (`harita.js` prosedürel ızgara): 3840×3280, **16 oda** (Muhasebe/Yönetim/İK/
  Satış/Pazarlama/Sunucu/Toplantı A-B/Dinlenme/Mutfak/Arşiv/Depo/Güvenlik/IT/Giriş/Açık Ofis)
  + dikey/yatay koridor ızgarası + 3 çıkış + oda başına AI nesneleri.
- **Zengin oda detayı** (`render.js` duvarDetay + mobilyaCiz): her odada dolap, **kitaplık
  (renkli kitap sırtları)**, beyaz tahta, dosya dolabı (çekmeceli), duvar saati (akrep döner),
  köşe bitkileri, çöp kovası, halı. Tipe özel: ofis (masa+monitör+sandalye), sunucu (raf+LED),
  toplantı (masa+sandalye), dinlenme (kanepe+sehpa+bitki), mutfak (tezgah+ocak+buzdolabı+masa),
  arşiv/depo (raflar+renkli kutular), giriş (resepsiyon+bank), koridor (yön okları).
- **Çoklu drone** (`durum.js` droneler dizisi, 3 adet): her biri bağımsız devriye/kovala/yakalama.
- **7 bot** seninle hareket eder + isimli göstergeler. Ekran-dışı oda kırpma (perf).
- Test (geçti): dünya 3840×3280, 16 oda, 3 drone, döngü hatasız, drone yakalama çalışıyor.

## 2026-07-09 — Karanlık geri + Genel Bakış modu + TÜM SESLER
- **Normal mod yeniden STEALTH karanlık** (0.92) — loş değil; fener konisi tek ışık.
- **Genel Bakış modu** (`M` tuşu / "Harita" butonu): kamera-zoom refactor'u — render artık
  bir kamera dönüşümü altında çiziyor (`zoom` + `w2s`); genel bakışta tüm harita en uzaktan
  tepeden görünür (karanlık kapalı, ne nerede test edilebilir). `durum.genelBakis`, girdi 'm'.
- **Tüm sesler** (`engine/ses.js`, WebAudio sentez): sürekli **ortam uğultusu** + **drone
  yakınlık vızıltısı** (mesafeye göre yükselir); tek-atım: sopa, kalkan, yakalama, yakalandın,
  kaçış, alarm, kapı, ui. Motor `durum.sesler` kuyruğunu çalar + her kare drone yakınlığını günceller.
- Test sayfası: sağ üstte **ses test paneli** (her sesi dinlet) + **Harita (M)** butonu;
  ilk tıklamada ses açılır (tarayıcı politikası).
- Test (geçti): genel bakış tüm haritayı gösteriyor, normal mod karanlık, konsol hatasız.

## 2026-07-09 — Küçültme + mobilya çarpışması + hız + çeşit (İda talebi)
- **Harita ~%30 küçük:** 3840×3280 → **2630×2270** (RW/RH/KOR küçültüldü).
- **Mobilya çarpışması:** `harita.engeller` (36 rect, tipli) eklendi; `yurunebilir` artık
  engel içini yürünemez sayıyor → oyuncu/bot mobilyaya giremez, etrafından dolaşır.
  Geniş boşluk/margin ile **yollar kapanmaz** (test: engel içi bos, üstünden geçilebilir).
  `render.cizEngel` tipe göre çizer (masa/monitör, sunucu rafı, arşiv rafı+kutu, kanepe,
  tezgah, buzdolabı...). Drone'lar uçtuğu için engelden etkilenmez.
- **Hız yavaşlatıldı:** oyuncu 210→168, bot 175→140, drone 150/240→122/196.
- **Çeşit:** oda tipine göre farklı mobilya düzeni + 3 oda boş (plaza) bırakıldı.
- Test (geçti): dünya 2630×2270, 36 engel, çarpışma çalışıyor (içine girilmez, yol açık),
  hız 168, karanlık stealth geri.
- **NOT (açık):** koridorlar hâlâ ızgara — "tamamen özgün/kare-kare-değil" için organik
  düzen (düzensiz koridorlar, çıkmazlar, farklı oda konumları) ayrı bir tur gerektirir.

### İleri grafik turları (plan)
- TUR 2 (~%50): çevre propları (masa/sandalye/sunucu rafı silüetleri), duvar derinliği/gölge,
  hafif CRT/scanline filtre, drone rotor dönüş animasyonu, karakter renk çeşitliliği.
- TUR 3 (~%60): ele geçirme animasyonu (nesne yanıp sönüp aydınlanır), ortam parçacıkları
  (kıvılcım/duman), alarm/ışık yanıp sönmesi, geçiş/titreşim efektleri.

## 2026-07-09 — Prototip tamamlandı: beceriler + AI ele geçirme + izleyici + React /run
Tek-oyunculu prototipin "eğlence" katmanı ve React entegrasyonu bitti. Multiplayer hariç
"Sıradaki" listesinin tamamı yapıldı.

### Beceriler (`durum.js`, `render.js`, `ses.js`, `sabitler.js`)
- **Sopa (J / 🦇 buton):** önde ~100° koni içindeki en yakın diri botu bayıltıp **satar**
  (`ben.sat++`), cooldown 2.4sn, sarı vuruş yayı flaşı + "ka-ching" (`sat`) sesi.
- **Kalkan (K / 🛡 buton):** 3sn dokunulmazlık (drone temas/ateş yakalayamaz), cooldown 8sn,
  oyuncu çevresinde nabız atan mavi halka.
- **Kill feed / olay akışı** (`durum.akis`): sopa/yakalama/kaçış/nesne/zorluk olayları
  sağ-altta 6sn sönümlenerek listelenir. Sol-altta cooldown çubuklu **beceri paneli** +
  "💰 Sattığın: N" sayacı.

### AI ele geçirme + drone ateş menzili + zorluk eğrisi (`durum.js`)
- **Nesneler aktifleşir** (8sn'de bir, 7sn aktif): nabız atan turuncu uyarı halkası + alarm sesi;
  aktif nesne menzildeki (760) **boş devriye drone'unu o bölgeye çeker** (tasarım 6).
- **Drone kilit-ateş:** kovaladığı hedefi ATES_MENZIL(92) içinde ATES_SURE(1.05sn) tutarsa
  menzilden vurur (temas beklemez) — kırmızı hedef ışını + `ates` sesi. Temasla yakalama korunur.
- **Zorluk eğrisi:** 22sn'de bir kademe (maks 4); her kademe drone hızını (+%11) ve görüş/ısı
  menzilini (+%9) artırır. HUD üstte "⚡ Kademe N".

### İzleyici modu + round sonu 2 katmanlı sıralama (`durum.js`, `render.js`, `motor.js`)
- Oyuncu yakalanınca **anında bitmez**; `izleyici` moduna geçer, kamera/fener canlı bir bota
  kayar (`izlenenId`), en fazla 26sn diğerlerini izlersin.
- **Botlar 18sn sonra (ya da sen elenince) çıkışa yönelir** → round çözülür (herkes kaçtı/yakalandı).
- **2 katmanlı sıralama:** önce kaçanlar (erken kaçan üstte), sonra yakalananlar (geç yakalanan =
  daha çok hayatta kaldı, üstte); satış sayısı gösterilir. Test HTML + React'te tablo olarak.

### React entegrasyonu (`run/app/…`, `src/App.jsx`)
- `run/app/RunApp.jsx` (Gladius deseni), `pages/MenuPage.jsx` (tanıtım + Oyna), `pages/GamePage.jsx`
  (canvas + Motor + sonuç/sıralama overlay + dokunmatik 🗺/🦇/🛡 butonları), `styles/run.css` (izole).
- `src/App.jsx`'e **lazy `/run/*` rotası** eklendi (Bildim quiz koduna tek dokunuş; RUN ayrı chunk:
  build'de `RunApp-*.js` 33.6 kB — ana paket etkilenmez).

### Doğrulama
- `npm run build` başarılı (RunApp ayrı chunk).
- Node başsız simülasyon (`/tmp/run-sim.mjs`): sopa botu satıyor, kalkan 3sn/8sn, ~100sn'lik
  rastgele oyunda **hata yok**, round çözülüyor, zorluk artıyor, 8 satırlık sıralama doğru sırada.
- Not: Chrome eklentisi bağlı olmadığından görsel tarayıcı testi İda'ya bırakıldı
  (`http://localhost:5173/run` ya da test harness).

## 2026-07-09 — Kapılar + etkileşimli makineler + parçacıklar (açık maddeler kapatıldı)
Multiplayer dışında "Sıradaki" listesinin tamamı bitti.

### Oda duvarları + kapı geçitleri (`harita.js`)
- Odalar artık **duvarlı** (kalınlık 14, `engeller`'e `tip:"duvar"` olarak girer) → gerçek labirent akışı.
  Her odaya **2-3 kapı geçidi** (96px) açılır; kenar başına en fazla 1.
- Geçit yeri **reddetme örneklemesiyle** seçilir: mobilyaya çarpan geçit denenmez; hiçbir temiz yer
  yoksa geçidi tıkayan mobilya odadan çıkarılır → **kapı her zaman kullanılabilir**.
- Harita **sabit tohumlu RNG** (`tohumluRastgele(20260709)`) ile üretilir → her yüklemede aynı;
  tasarım ve test tekrarlanabilir.
- Makineler (`nesneler`) artık oda içinde `bosNokta()` ile mobilya/duvar dışına yerleşir (eskiden
  sabit ofsetti, masanın içinde kalabiliyordu).

### Navigasyon (`navigasyon.js` — YENİ)
- Çıkışlardan geriye **BFS akış alanı** (26px ızgara, 4-komşu; çapraz adımda köşe kesme engelli).
- Botlar kaçış modunda düz çizgi yerine bu alanı takip eder → duvarlı odalardan kapıları bulup çıkarlar.
- `ulasilabilirOran()` harita sağlaması: tüm yürünebilir hücreler çıkışa ulaşmalı (test: %100).

### Kapı mekaniği (`durum.js`, `render.js`)
- **Q** ile menzildeki (82) açık kapı kapanır (cooldown 3sn). Kapalı kapı **enerji perdesi**:
  insanlar geçer, **drone geçemez** — kırması 2.2sn sürer (kırılma çubuğu görünür). Kapı 12sn sonra
  kendiliğinden açılır. HUD'a 3. beceri kutusu (🚪 Kapı) eklendi.

### Etkileşimli makine / ele geçirme (`durum.js`)
- Alarm veren (aktif) makinenin yanında **E basılı tut** → 1.6sn'de ele geçir: `ben.hack++`,
  makine susar, **HACK_SERSEM_MENZIL (320) içindeki droneler 2.6sn sersemler** (durur, tarama söner,
  EMP arkı çizilir). Bedeli: hack sırasında durursun → drone ısı algılamasına açıksın.
- Ekranda: hedefte yüzdelik **ilerleme halkası**, HUD'da ilerleme çubuğu + `💾 Ele geçirdiğin: N`.
- Yakalanınca yarım kalan hack iptal edilir.

### Parçacıklar + görsel (`durum.js`, `render.js`)
- `durum.parcaciklar` (üst sınır 220, sürtünmeli): sopa vuruşu, yakalama, hack, EMP, kapı kapanma/
  kırılma, aktif makine kıvılcımları. Karanlığın üstünde `lighter` ile ışıyarak çizilir.
- Yakındaki aktif makine/açık kapı için **etkileşim ipucu** balonu ("E — ele geçir" / "Q — kapıyı kapat").
- Sersem drone: gri gövde, sönük göz, sarsıntı + sarı EMP arkları.
- `render.js` içindeki ~70 satırlık **erişilemez ölü kod** (eski mobilya çizimi) temizlendi;
  duvar dekorları (dolap/kitaplık/tahta/dosya dolabı) yeni duvarın altında kalmasın diye içeri kaydırıldı.
- `durum.js` kullanılmayan importlar (`DUNYA`, `odaAdi`) ve `ses.js` ölü satırı (`buf.__loop`) kaldırıldı.

### Sesler (`ses.js`)
- `hack` (yükselen dijital onay) + `sersem` (EMP darbesi) eklendi; test panelinde dinlenebilir.

### Doğrulama
- Başsız Node testi (17 sağlama, 5 kez üst üste geçti): harita 38 kapı / 102 duvar / 13 makine,
  akış alanı **%100 ulaşılabilir**, kapı kırılma 2.22sn ≈ 2.2sn, hack 1.60sn ≈ 1.6sn, EMP sersemletiyor,
  sersem drone hareket etmiyor, 120sn oynanışta istisna yok, round çözülüyor, 8 botun tamamı
  odalardan kapıları bulup çıkabiliyor.
- `npm run build` başarılı (RunApp ayrı chunk: 44.1 kB).
- Tarayıcı testi (Chrome): kapı perdesi, "Q — kapıyı kapat" ipucu, %71 hack halkası, EMP parçacıkları
  ve 3 drone sersemlemesi ekranda doğrulandı.

## 2026-07-09 — Yayına hazırlık: ışık oklüzyonu + hata avı (İda: "bütün hataları düzelt")
Tek-oyunculu sürüm yayına hazır hale getirildi. Kapatılan hatalar:

### Işık oklüzyonu (`render.js`) — en büyük açık
- **Fener artık duvardan sızmıyor.** `golgeYolu()`: duvar dikdörtgenlerinin ışığa sırtı dönük
  kenarlarından gölge dörtgenleri (Path2D, ekran uzayı). Işık maskesi ve sıcak additive ışık
  **ara katman tuvale** (`isikKatmani`) çizilip gölgeler `destination-out` ile kesiliyor,
  sonra ana tuvale uygulanıyor. Kapı geçitleri duvar olmadığından **ışık kapıdan doğal sızıyor**
  (dar ışın); mobilya alçak sayılır, ışığı kesmez; aydınlık odalar (GPS bilgisi) bilinçli muaf.
- **Tuzak:** `destination-out` doldurmadan önce `fillStyle` önceki gradyan/yarı saydam fırçada
  kalırsa gölge kısmen silinir (bunu piksel taramasıyla yakaladık) → kesimden önce `#fff` şart.
- Piksel doğrulaması: duvar arkası 35 (taban), kapı ışını 46-60, koni içi 456.

### Düzeltilen diğer hatalar
- **CSS:** masaüstünde dokunmatik beceri butonları gizlenmiyordu (`display:none` kuralı yoktu);
  artık masaüstünde yalnız 🗺 harita butonu görünür.
- **Ses sızıntısı:** oyun sayfasından menüye dönünce ortam uğultusu + drone vızıltısı çalmaya
  devam ediyordu → `ses.ortamDur()` (sürekli kaynakları durdurur, `devamEt()` yeniden başlatır);
  GamePage unmount'ta çağrılıyor. Ayrıca round bitince vızıltı sönüyor (motor `bitti` kontrolü).
- **Drone spawn:** başlangıcın dibinde doğabiliyordu (ilk saniyede yakalanma) → spawn başlangıçtan
  **≥700 birim** uzakta (30 round örneklemede min 718).
- **`girdi.cozul()`** bekleyen tek-atım bayraklarını (sopa/kapı/genel bakış) temizlemiyordu.
- Ölü sabit `DUNYA` kaldırıldı; `sabitler.js` başlık yorumu güncellendi (çoklu drone).

### Cila
- **Botlara hayatta kalma içgüdüsü:** 220 birim içindeki (sersem olmayan) drone'dan uzaklaşırlar —
  her moddan (gezinme/grup/kaçış) öncelikli.

### Doğrulama
- Başsız test 3 tur GEÇTİ; `npm run build` OK (RunApp 45.8 kB).
- Chrome: oklüzyon piksel taramasıyla, buton gizleme + koridor ışığı ekran görüntüsüyle doğrulandı.

## 2026-07-09 — Görünürlük kuralı + profesyonel harita + mobil cila (İda talebi)
İda: "ışığımın içinde değilse diğer oyuncuları görmemeliyim; map çok aynı; mobil kusursuz olsun."

### Görünürlük kuralı (`render.js` isikta())
- **Diğer oyuncular yalnızca ışığında görünür/etiketlenir:** yakın çevre ışığı VEYA fener konisi
  içinde VE arada duvar yoksa (görüş hattı örneklenir; mobilya alçak, kesmez). Eski koşulsuz
  "müttefik blip + isim" göstergeleri kaldırıldı — karanlıktaki oyuncu tamamen görünmez.
- **Genel Bakış artık BİNA PLANI:** droneler ve diğer oyuncular planda ÇİZİLMEZ (hile olmaktan
  çıktı); sadece harita + kendi konumun + kapılar/çıkışlar. Etiket: "canlı konumlar görünmez".
- Aydınlık odalar uzaktan seçilir (tasarım 5, GPS bilgisi) — bilinçli istisna.

### Profesyonel harita (`harita.js` yeniden üretim)
- **Değişken hücre boyutları:** kolon 440-640, satır 370-520 (tohumlu) → tekdüze ızgara kırıldı.
- **Birleşik büyük odalar:** yatay çift hücre **Kafeterya** (servis bankosu + 6 yuvarlak masa),
  dikey çift hücre **Atrium** (2 bitki adası + banklar) — aradaki koridoru da kapsarlar.
- **14 farklı oda tipi**, her tipin kendine özgü mobilya düzeni (rnd varyasyonlu): sunucu (3-4 raf),
  toplantı (yatay/dikey masa), depo (4 palet istifi), güvenlik (yanıp sönen monitör duvarı),
  lab (2 tezgah + numune LED), giriş (resepsiyon+bank), fuaye (boş), ofisler (2-3 kolon masa)...
- **Tip bazlı zemin tonları** (render `TABAN`): atrium yeşilimsi, kafeterya sıcak, depo koyu,
  lab/güvenlik soğuk... koridorlar odalardan koyu → mekân okunurluğu.
- Başlangıç orta koridor kavşağına, çıkışlar da ona hizalı (değişken boyutlarda W/2 oda içine düşebilirdi).

### Mobil cila
- **Sanal joystick görseli** (taban halkası + topuz) sürüklerken çizilir (`durum.jsGorsel`).
- **Dokunsal titreşim** (navigator.vibrate): yakalanma/vuruş/ateş/kaçış/sersem desenleri.
- Kill feed **sağ-üste** taşındı (sağ-alt dokunmatik butonların).
- `env(safe-area-inset-*)` (çentikli telefonlar), `-webkit-touch-callout:none`,
  `overscroll-behavior:none`; dokunmatikte klavye ipucu satırı gizli.
- **Çıkış yön okları:** ekran dışındaki çıkış işaretleri kenara sabitlenmiş ok olur — yön hep belli.

### Doğrulama
- Başsız test (22 sağlama × 5 tur geçti): 14 oda / 12 tip / 14 farklı boyut, kafeterya+atrium var,
  akış alanı %100 ulaşılabilir, tüm mekanikler çalışıyor.
- Chrome: plan modu (drone/bot yok), görünürlük üçlü testi (koni içi Delta görünür; arkadaki Vega
  ve duvar arkasındaki Trinity görünmez), çıkış okları — ekran görüntüleriyle doğrulandı. Konsol temiz.
- `npm run build` OK (RunApp 51.1 kB).

## 2026-07-09 — Okunurluk + yönlendirme cilası (İda: "aşırı karanlık; kapılar ve çıkış belirgin olsun")
- **Karanlık yumuşatıldı:** örtü 0.92 → **0.85** (`KARANLIK_ALFA`), çevre ışığı 120 → **150**,
  fener 340 → 360. Stealth hissi korunur, zemin/mobilya okunur.
- **Kapılar belirgin:** eşik dolgusu/söveler parlaklaştırıldı + **acil durum aydınlatması** —
  560 birim içindeki her kapının söve uçlarında nabız atan minik ışık (açık: camgöbeği,
  kapalı: turuncu), karanlıkta bile kapı yerleri seçilir (ekran uzayı, lighter).
- **Çıkış yönlendirme:** oyuncunun üstünde en yakın çıkışı gösteren **pusula oku + mesafe (m)**;
  çıkış geçitleri **animasyonlu kayan yeşil şeritler + parlak çerçeve** ile "acil çıkış" görünümü;
  ekran dışındaki çıkışlar için kenar okları zaten vardı.
- **Son sürüm HUD'u:** üst-sol **📍 konum** (oda adı), üst-orta **⚡ Kademe + ⏱ süre**,
  round başında 6sn sönümlenen **"YEŞİL ÇIKIŞA ULAŞ"** hedef yazısı + kısa ipucu.
- **Görünürlük kuralı sıkılaştırıldı:** 0.85 örtüde karanlıktaki bot silüetleri seçilebiliyordu —
  artık `isikta()` kapısı isimlere ek olarak **gövdelere de** uygulanıyor; ayrıca hedef ışığı
  açık bir odadaysa (görüş hattı şartıyla) görünür. Drone'lar kendi ışıklarını taşıdığından
  her zaman çizilir (tehdit okunurluğu).
- Doğrulama: başsız test geçti, build OK (RunApp 53.5 kB), Chrome ekran görüntüleri
  (hedef yazısı, pusula 118m, kapı ışıkları, silüetsiz karanlık).

## 2026-07-09 — Büyük oynanış turu (İda'nın 10 maddelik geri bildirimi)
### Kapılar artık FİZİKSEL (İda: "karakter kapalı kapıdan geçiyor")
- Kapalı kapı **herkesi** engeller (`yurunebilir` kapı kontrolü). **Q = aç/kapa toggle**
  (cooldown 1.2sn). Eşikte biri varken kapanmaz (üstüne kapanma/cheese engeli).
- **Drone kapalı kapıyı 0.5sn'de açar** (İda talebi; eskiden 2.2sn "kırma"), bot iterek
  0.7sn'de açar (kapana kısılma yok). Kapı 14sn sonra kendiliğinden açılır.
### İnsan görünümlü karakterler (İda: "robot gibi")
- `cizKisi` yeniden: isimden türeyen **saç/ten/ceket** çeşitliliği, **ayak+kol yürüme
  animasyonu** (`_yuru` mesafe fazı), öne bakan yüz, kimlik rengi omuz şeridi.
- **Beyzbol sopası elde görünür**; vururken **geniş savurma yayı** animasyonu (`_sopaFlash`).
### Kırmızı tarama konisi (İda: "drone kırmızı ışıkla tarasın, gören kaçsın")
- Devriye drone'un önünde **salınan kırmızı arama konisi** (menzil 270, ±19.5°); koninin
  içine giren (arada duvar yoksa) **anında fark edilir** → yeni çekirdek stealth mekaniği.
- Koni karanlığın ÜSTÜNDE çizilir (drone'un kendi ışığı) ve **duvarlar koniyi keser**
  (gölge maskesi) — duvar arkası hem görsel hem mekanik olarak güvenli.
### Çıkış zorlaştırıldı (İda: "dümdüz yürüyüp çıkıyorum")
- **Kaçış kanalı:** çıkışta **1.6sn beklemek** gerekir (yeşil ilerleme halkası "KAÇIŞ %").
- **Drone 3 → 6**; ilk 3'ü **çıkış bekçisi** (devriyesinin %65'i kendi çıkışının çevresinde).
- Drone gövdesi **1.5x** + yanıp sönen kırmızı göz; vızıltı menzili 650, ses eğrisi keskin
  (yaklaştıkça belirgin yükselir, `ses.droneYakinlik`).
### Harita renk/detay (İda: "renk ekle, detaylar belli değil")
- Zemin tonları doygunlaştırıldı + **oda kenarı neonu tip renginde** (atrium yeşil, kafeterya
  turuncu, güvenlik kırmızı...) + **tip renginde halılar**; mobilya paleti parlaklaştırıldı.
- Round başı ipucu güncellendi: "Kırmızı tarama ışığından saklan · çıkışta bekleyerek kaç".
### Doğrulama
- Başsız test **35 sağlama** (kapı aç/kapa/yürünmezlik/eşik-dolu reddi/drone 0.51sn açma,
  kaçış kanalı 1.62sn, tarama konisi dahil oynanış) — **8 tur üst üste geçti**.
- `npm run build` OK (RunApp 57.8 kB). Chrome: kırmızı koni + insan sprite + koni algılaması
  ("Drone: 1 kovalıyor!") ekran görüntüsüyle doğrulandı.

## 2026-07-10 — AKSİYON TURU (İda: "vuramıyorum, daha uzaktan vurmalıyım, gerçek kılıç savurma + heyecan")
### Enerji kılıcı (sopa → kılıç dönüşümü)
- **Menzil 52 → 118** (`SOPA_MENZIL`) — drone ateş menzilinden (92) uzun: drone kilitlenemeden sen vurursun.
  Cooldown 2.4 → **1.5sn**; savururken **30 birim ileri hamle** (`KILIC_HAMLE`, duvara saygılı).
- **Kılıç dronelara işler** (`kilicVur`): konideki HER drone **170 birim geri savrulur** + 1.3sn sersemler,
  kilidi kırılır; **3 vuruşta hurda** (patlama + kill feed). Hurda drone **12sn sonra oyuncudan ≥700 uzakta
  yeniden doğar** ("🚁 Yeni drone sevkiyatı") → baskı sürer. Botlar: konideki TÜMÜ satılır (eskiden tek).
- **Gerçek savurma efekti** (`render.js`): bıçak koninin bir ucundan öbürüne süpürür — dolgu enerji izi
  (radyal gradyan yay) + parlak kesme kenarı + menzil yayı; karakterin elinde **ışıyan enerji kılıcı**
  (koyu kabza + camgöbeği bıçak + öz çizgisi, savururken parlar).
### Aksiyon hissi (juice)
- **Vuruş donması** (`durum.hitstop` 0.06sn): isabet anında dünya bir an durur.
- **Ekran sarsıntısı** (`durum.sarsinti`): kılıç isabeti 8, drone patlaması 14, yakalanma 16; hızla söner.
### Atılım / dash (Shift veya L, mobil 💨)
- 0.22sn boyunca hız ×3.2, cooldown 2.6sn; yön = hareket vektörü (dururken bakış yönü); iz parçacıkları.
- Girdi değişikliği: **Shift artık kalkan değil dash** (kalkan yalnız K).
### Veri çipleri (keşif/risk ödülü)
- Round başına **10 çip** (birbirinden ≥240, başlangıçtan ≥300 uzak); üstünden geçince toplanır.
- Dönen yeşil elmas + 620 menzilde karanlıkta parlayan işaret ışığı (keşfe çağırır); HUD `💿 N/10` sayacı,
  kill feed "(N/10)" + hepsi toplanınca "🌟 TÜM ÇİPLERİ TOPLADIN!"; round sıralamasında 💿 kolonu.
### Sesler + HUD + metinler
- Yeni sesler: `kilic` (whoosh), `darbe` (metalik şok), `patlama`, `dash`, `cip`; titreşim desenleri eklendi.
- HUD 4 beceri kutusu (⚔/💨/🛡/🚪), sayaçlar kompakt (💰/💾/💿). GamePage ipucu + dokunmatik ⚔/💨 butonları;
  MenuPage tanıtımı kılıç/dash/çip anlatır.
### Kombo (İda: "cooldown olmasın, kombo yapabileyim")
- `SOPA_BEKLEME = SOPA_SAVURMA` (0.22sn) — kılıçta gerçek cooldown yok; savuruşlar animasyon
  hızında zincirlenir. Her savuruş **ters yönden** gelir (`ben._savurmaYon` ±1; iz yayı, dış yay
  ve eldeki bıçak animasyonu yön alır) → soldan-sağa / sağdan-sola kombo görünümü.
- Chrome'da doğrulandı: art arda J ile kill feed'de zincir vuruşlar, kutu hep HAZIR.

### Doğrulama
- Başsız Node testi **16/16** (hp düşüşü, savrulma 230, 3 vuruşta hurda + uzakta yeniden doğma,
  110 birimden bot satma, dash yolu 125 birim, çip toplama, 90sn rastgele oynanışta istisna yok).
- `npm run build` OK (RunApp 63.0 kB). Chrome: savurma yayı + kılıç + 4'lü HUD + çip sayacı ekran
  görüntüsüyle doğrulandı; konsol hatasız.

## 2026-07-11 — REVİZYON PAKETİ (kılıç düzeltmesi + PRO ana ekran + Yönetmen AI + kilitli çıkışlar + cila)
İda'nın verdiği teknik spesifikasyon (DBD "Exit Gate" + Alien: Isolation "Director AI" uyarlaması)
uygulandı. Faz 2.3 (çıkış konumu varyasyonu) spec'in kendi önerisiyle ATLANDI (isteğe bağlı, ayrı test turu ister).

### Kılıç SADECE dronelere işler (İda: "başka oyuncuları kesemeyeyim")
- `kilicVur` içindeki oyuncu-vurma döngüsü kaldırıldı; "sat" mekaniği tamamen çıktı.
- Yeni istatistik: **💥 hurda** (`ben.hurda`) — hurdaya çıkarılan drone sayısı; HUD, sıralama
  tablosu (React + test HTML) ve kill feed güncellendi. `yakalanIsle` sadeleşti (sopa dalı silindi).

### PRO ana ekran (`MenuPage.jsx` + `run.css` menü bölümü yeniden)
- Tam ekran açılış: perspektifli akan neon ızgara + dikey güvenlik tarama çizgisi + süzülen
  parçacıklar + vinyet (tamamı CSS, görsel varlık yok).
- Glitch'li dev RUN logosu (kırmızı/camgöbeği kayma katmanları), "TESİS-07 · SİMÜLASYON AKTİF"
  durum çubuğu, kesik-köşe (clip-path) nabız atan **OYUNA GİR** CTA'sı.
- 6 özellik kartı (hover'lı) + klavye kontrol şeması (`kbd`; dokunmatikte gizli) + alt bilgi.
- `prefers-reduced-motion` desteği. Sonuç ekranı butonları aynı stili paylaşır.

### FAZ 1 — Yönetmen (Director) katmanı (`durum.js`, `sabitler.js`)
- **Gerginlik göstergesi (0-100, görünmez):** drone menzildeyken artar (+6/sn), kovalama
  başlayınca +25; 8sn+ drone yaklaşmazsa düşer (-3/sn). Eşik 70 aşılınca en yakın BOŞ devriye
  drone'una **oyuncunun 3.5sn ÖNCEKİ konumu** ipucu verilir (`d._ipucu`; tam konum asla — adil).
  İki ipucu arası ≥6sn; gerginlik 25 altına düşünce **6-10sn nefes payı** (ipucu verilmez).
- **Alarm çağrısı / destek:** bir drone kovalamaya geçince 500 birim içindeki en yakın devriye
  drone `destek` moduna geçer: kovalayanın 50 birim yanına konumlanır (pens hareketi), kilit-ateş
  yapmaz; kovalama bitince devriyeye döner.
- **Drone çeşitliliği:** Kademe 3'te 1 drone **AĞIR** olur (koni ×1.6, hız ×0.85, 1.9x gövde,
  çift ışın yuvası, turuncu); Kademe 4'te 1 drone **SESSİZ** olur (tarama konisi YOK, ısı menzili
  ×1.4, koyu mor, sönük göz). Kill feed duyurur.

### FAZ 2 — Kilitli çıkışlar + kontrol paneli (`harita.js`, `durum.js`, `render.js`)
- **3 çıkış paneli** (`harita.paneller`, tohumlu; çıkışa 250-400 birim, yürünebilir doğrulamalı).
- Çıkışlar **kilitli başlar** (`cikis.acik=false`): kilitliyken beklemek kaçırtmaz (test edildi).
  Panel mevcut hack mekaniğiyle açılır (E basılı, 1.6sn) → çıkış **kalıcı** açılır.
- **Açılış alarmı:** kill feed "🚨 X Çıkış aktif edildi!", o çıkışın bekçileri 12sn tetikte
  (hız + koni ×1.2). **2. çıkış açılınca 30sn GENEL ALARM:** tüm droneler devriyede kovalama hızında.
- **Botlar panelleri açar:** kaçış modunda görüş hattı açık en yakın panele gidip 1.6sn "hackler"
  (kilitli çıkışta takılı kalmazlar — başsız testte doğrulandı).
- **Görsel:** kilitli çıkış kırmızı/durağan şerit + 🔒; kenar okları kırmızı; panel turuncu nabızlı
  terminal (açılınca yeşil söner); pusula açık çıkış yoksa **en yakın panele** (turuncu "PANEL Xm")
  yönlendirir; kilitli çıkışta durunca "🔒 KİLİTLİ — önce paneli hackle" uyarısı; round başı hedef
  yazısı "PANELİ HACKLE — ÇIKIŞI AÇ".

### FAZ 3 — Cila (juice)
- **Tespit stinger'ı:** drone SENİ fark ettiği an 0.15sn kırmızı vignette flaşı + keskin `tespit` sesi.
- **Son-oyuncu baskısı:** tek kaçak kalınca drone görüş/ısı ×1.15 (+kill feed uyarısı).
- **Neredeyse-yakalanma:** aktif drone yakala yarıçapının 2 katı içinde ve kaçarken hafif titreme
  + `kalp` (çift bas vuruş) sesi.
- **"Az kalsın" istatistiği:** round boyunca en yakın drone mesafesi (`durum.enYakin`); kaçınca
  sonuç ekranında "⚡ Az kalsın! Drone'a en yakın anın: N birim" (yalnız <120 birimse).

### Doğrulama
- Başsız Node testi **31/31 sağlama geçti** (paneller yürünebilir + akış alanı %100, kilitli çıkış
  kaçırtmıyor, panel 1.62sn'de açılıyor + bekçi alarmı, kılıç botu ETKİLEMİYOR + drone hp düşüyor +
  3 vuruş hurda, gerginlik/ipucu/destek/tespit, kademe 3-4 ağır+sessiz dönüşümü, 120sn istisna yok,
  botlar panel açıp kaçıyor).
- `npm run build` OK (RunApp 70.8 kB). Chrome: yeni menü + oyun içi kilitli çıkış/pusula/hedef
  yazısı ekran görüntüsüyle doğrulandı, konsol temiz.

## 2026-07-17 — LOBİ FAZI + mobil tam ekran/iOS + kılıç görünürlüğü (İda'nın 4 maddelik geri bildirimi)

### Lobi koridoru (yeni round akışı)
- **Harita** (`harita.js`): tesisin ALTINA "Hazırlık Lobisi" (560×420 oda) + "Giriş Koridoru"
  (170×980, kuzeye) eklendi; ikisi de `lobi:true` + hep aydınlık (güvenli bölge okuması).
  Oyuncular lobide doğar. Koridorun tepesinde `girisi:true` geçidi — Q/bot/drone açamaz-kapatamaz.
- **Faz makinesi** (`durum.js`): `faz:"lobi"` → geçit aşılınca `aksiyonBaslat`: geçit MÜHÜRLENİR
  (kalıcı, kırılamaz — lobiye dönüş/saklanma istismarı yok), lobide kalan botlar geçidin iç
  tarafına ışınlanır (birlikte giriş), "🚨 SİMÜLASYON BAŞLADI" duyurusu.
- **Lobide kapalı olanlar:** drone AI (kımıldamaz/algılamaz), zorluk eğrisi, yönetmen (gerginlik/
  ipucu/destek), nesne aktifleşmesi, ışık karıştırma, bot kaçış sayacı, son-baskı. Süre/kademe
  HUD'u ve bot kaçışı AKSİYON başlangıcından sayılır. `rastgeleNokta` lobi alanlarını atlar →
  drone spawn/devriye/yeniden doğuş ve çipler hep tesiste.
- **Görsel:** koridorda tesise çağıran nabızlı yön okları + pist kenar ışıkları; odada "GÜVENLİ
  BÖLGE" halkası; geçit lobide yeşil davet çerçevesi ("▲ SİMÜLASYON GİRİŞİ"), mühürlüyken kırmızı
  perde; HUD lobide "🚶 HAZIRLIK" + "KORİDORU GEÇ — SİMÜLASYON BAŞLASIN"; lobide tarama konisi çizilmez.

### Kılıç görünürlüğü
- Elde taşınan enerji kılıcı artık YALNIZ kendi karakterinde çizilir (`cizKisi` içinde `s.id==="ben"`
  şartı) — ışıyan bıçak diğer oyuncuların/botların elinde görünmez (stealth + MP'ye hazır kural).

### Mobil tam ekran + yatay + iOS akıcılık (Kafa Topu dersleri uygulandı)
- **GamePage:** ilk dokunuşta `requestFullscreen({navigationUI:"hide"})` + webkit önekleri
  (iOS Safari `webkitFullscreenElement`) + `screen.orientation.lock("landscape")`; çıkışta geri al.
  Yalnız dokunmatik cihazda (`hover:none`). Wake Lock (ekran uyumaz, görünürlükte yeniden alınır).
  visibilitychange/blur'da `girdi.sifirla()` (tuş takılı kalması bug'ı kapalı).
- **Girdi:** joystick NATIVE touch olaylarıyla (identifier takibi, non-passive preventDefault);
  pointer olayları yalnız fare/kalem. Beceri butonları da native touch (kapsayıcıda `data-eylem`
  haritası; hack basılı-tut identifier ile). Çift dokunuş zoom/büyüteç engellendi.
- **Motor:** canvas `alpha:false` (Safari kompozit maliyeti düşer); orientationchange +
  visualViewport.resize + fullscreenchange dinleyicileri + 0/300/800ms gecikmeli yeniden ölçüm.
- **CSS:** canvas %100/%100 (100vh yerine — iOS adres çubuğu), dikeyde "telefonu yan çevir"
  ipucu (7 sn'de söner), dokunmatikte butonlar 64px + tap-highlight/touch-callout kapalı.

### Doğrulama
- Başsız Node testi **23/23** (lobi: droneler kımıldamaz/zorluk donuk/kaçış yok; geçiş: mühür +
  botlar içeride; mühürden geri dönülemiyor; aksiyon: devriye + kademe + 7/7 bot çözüldü; NaN yok;
  akış alanı %100). Test: scratchpad `run-lobi-test.mjs`.
- `npm run build` OK (RunApp 78.5 kB). Gerçek iPhone/Android testi İda'da.

## 2026-07-17 (2. tur) — Kapı revizyonu + çıkış rotasyonu + lobi kompleksi + izleyici düzeltmeleri

### Kapılar (İda: "drone geçemesin, 5 sn'de açılsın, herkes açıp kapatabilsin")
- `KAPI_ACILMA` 14→**5 sn** (kapalı kapı kendiliğinden açılır).
- **Drone kapalı kapıyı artık AÇAMAZ/KIRAMAZ** — perde önünde bekler (kırılma mekaniği ve
  çubuğu kaldırıldı). Oyuncular Q ile her an açıp kapatır, botlar iterek açabilir (0.7 sn).

### Çıkış rotasyonu (tek kullanımlık erken çıkışlar)
- Harita 3→**6 çıkış slotu**: Batı/Doğu/Kuzey görünür başlar; **Servis Çıkışı, Yükleme
  Rampası, Acil Tünel GİZLİ yedek** (çizilmez, paneli işlemez).
- İlk kaçışlarda kullanılan çıkış **MÜHÜRLENİR** (gri ✖, tekrar açılamaz) ve bir yedek
  **aktifleşir** (kilitli belirir, kill feed duyurur). `SERBEST_KACIS=3` kaçışa ulaşılınca
  "🔓 çıkış protokolü çözüldü" — mühürleme durur, kalan çıkışları herkes kullanır.
- **Akış alanı artık dinamik** (`navigasyon.akisAlaniKur`): yürünürlük ızgarası önbellekli,
  BFS kaynağı = kullanılabilir çıkışlar (AÇIK varsa yalnız açıklar). Round başında, panel
  açılınca ve mühürlemede yeniden kurulur → botlar asla mühürlü/gizli çıkışta takılmaz.

### Lobi kompleksi (İda: "birkaç oda gezsinler, sohbet etsinler, risk bölgesi renk değiştirsin")
- Lobi artık 6 alan: Hazırlık Lobisi + **Eğitim Odası** (tezgahlar) + **Ekipman Odası**
  (raf/kutu) + bağlantı koridorları + Giriş Koridoru.
- **Sohbet balonları:** lobide botlar 2-6 sn arayla kısa laflar atar ("hazır mısın?",
  "önce panel, sonra kaçış"...); lobide oyuncu etrafında daha sıkı kümelenirler.
- **Riskli bölge:** koridorun geçide yakın 280 birimi kırmızı zemin + tehlike şeritleri +
  "⚠ RİSKLİ BÖLGE" + kızaran ok/kenar ışıkları; içine ilk girişte alarm + akış uyarısı.

### Yakalanma sonrası temizlik (İda: "karakter takılıyor, ekran bugları")
- Yakalanan/kaçan oyuncular sahadan kalkar (gri ceset/yeşil hayalet çizimi kaldırıldı).
- İzleyici fener açısı `izlAci` sarmallı lerp ile yumuşatıldı — izlenen bot ani dönünce
  ışık konisi savrulup ekran çakması yapmıyor.
- **▶ İzlemeyi Geç** butonu (izleyici modunda alt-orta): round beklemeden sonuca atlar.

### Doğrulama
- Başsız test **37/37**, 3 kez üst üste (kapı 5 sn otomatik açılış, mühür+yedek aktifleşme,
  3. kaçışta serbest mod, lobi sohbeti, riskli bölge uyarısı, 7/7 bot çözülüyor, NaN yok).
- `npm run build` OK (RunApp 82.9 kB).

## Sıradaki
- **Multiplayer** (PatiRun/Bildim presence+broadcast) — spec Faz 10, backend gerektirir; **en son**.
- İsteğe bağlı: round sonucu/istatistik kalıcılığı (şu an hiçbir şey kaydedilmiyor — bilinçli).
- İsteğe bağlı: mobil gerçek cihaz testi (İda) — dokunmatik butonlar + joystick + titreşim.
