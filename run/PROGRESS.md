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

## Sıradaki
- **Multiplayer** (PatiRun/Bildim presence+broadcast) — spec Faz 10, backend gerektirir; **en son**.
- Fener konisi duvarlardan sızıyor (görüş engeli/raycast yok) — istenirse gölge/oklüzyon turu.
- Organik/düzensiz koridor düzeni (koridorlar hâlâ ızgara; odalar artık duvarlı).
