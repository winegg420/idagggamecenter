# Bildim! — Proje İlerleme Kaydı

## 2026-07-05 — 3 Revizyon + Ana Sayfa Yeniden Tasarımı

### 1) Grup Maçı 5 kişiye çıkarıldı
- **Migration:** `20260612000031_grup_5_kisi.sql`
- `group_matches.oyuncu_sayisi` kısıtı `(3,4)` → `(3,4,5)` olarak güncellendi (constraint drop/add).
- `create_group_challenge`: rakip sayısı kontrolü `not in (2,3)` → `not in (2,3,4)` (4 rakip + kurucu = 5).
- Frontend `ChallengesPage.jsx`: kişi seçimi `[3,4]` → `[3,4,5]`, başlık "3-5 kişi".
- RLS/realtime/puanlama mantığına dokunulmadı (ödül zaten `10 * oyuncu_sayisi` ile ölçekleniyor).

### 2) Yeni mod: "Hızlı Olan Kazanır"
- **Migration:** `20260612000032_hizli_olan_kazanir.sql`
- Grup Maçı deseninin kopyası; ayrı tablo/fonksiyon seti: `hizli_maclar`, `hizli_oyuncular`, `hizli_cevaplar`.
- Sabit 5 kişi. **Sadece ilk doğru cevabı veren +10 puan alır.** Joker/sohbet yok.
- **Yarış durumu (race):** `submit_hizli_cevap` içinde `hizli_maclar` satırı `FOR UPDATE` ile kilitlenip, o soru indexine daha önce doğru kayıt var mı diye kontrol edilir (client'a güvenilmez).
- RPC'ler: `create_hizli_mac`, `respond_hizli_davet`, `get_hizli_soru`, `submit_hizli_cevap`, `advance_hizli_mac` (hepsi security definer, sadece `authenticated`).
- RLS `_select_own` politikaları grup ile birebir; insert/update/delete revoke.
- Realtime: `hizli_maclar` + `hizli_oyuncular` publication'a eklendi.
- Push bildirimi trigger'ı: `notify_new_hizli_davet` (grup deseninin kopyası).
- `bot_oyna()` genişletildi (bölüm 10-13): botlar hızlı maçları kabul eder, başlatır, cevaplar (ilk doğru kontrolüyle) ve ilerletir. Botlar da `FOR UPDATE ... skip locked` ile serileşir.
- Frontend: `src/pages/HizliMacPage.jsx` (GroupMatchPage kopyası, sohbet/joker çıkarıldı, "İlk sen bildin! +10" geri bildirimi). `App.jsx` route `/hizli-mac/:id`. `ChallengesPage.jsx`'e kurulum kartı + gelen/aktif/beklenen/biten listeleri.

### 3) 500 yeni soru
- **Migration:** `20260612000033_soru_parti9_500.sql`
- Kategoriler: tarih, bilim, coğrafya, edebiyat, spor, sanat + yeni kategoriler **sinema, müzik, teknoloji** ve karışık/genel.
- **Karar:** `soru` kolonu UNIQUE olduğu için mevcut havuzla çakışanlar (~61) migration'ı bozmasın diye `on conflict (soru) do nothing` eklendi; çakışanları telafi için ek benzersiz sorular kondu → **net ~500 yeni benzersiz soru**.
- Doğru şık 0'a sabit kalmasın diye migration sonunda `created_at >= transaction_timestamp()` ile SADECE bu partinin şıkları karıştırıldı (yeni sorular hiçbir aktif maçta olmadığı için güvenli).

### 4) Ana sayfa "A-sınıfı oyun paneli" tasarımı
- `src/pages/Home.jsx` yeniden düzenlendi (tüm mevcut mantık korundu): zengin **hero paneli** (rütbe halkalı avatar, XP/rütbe ilerleme çubuğu, puan, seri), **oyun modları grid'i** (Hemen Oyna / Meydan Oku / Hızlı Olan Kazanır / Grup / Turnuva), bölüm başlıkları, podyumlu lider tablosu.
- `src/styles.css`'e kapsamlı yeni stiller eklendi (gradient/glow'lu mod kartları, hero panel, xp-bar, bölüm başlıkları). Mevcut sınıflara dokunulmadı.

### Notlar / Test edilecekler
- Migration'lar Supabase'e push edilmeli (repo push = otomatik Vercel prod deploy, DB migration Supabase tarafında ayrı uygulanır).
- Test: Hızlı Olan Kazanır'da aynı anda 2 oyuncu doğru cevap → sadece ilki +10 almalı. 5 kişilik grup kurulabilmeli. Ana sayfa mod kartları doğru sayfalara gitmeli.
- Build doğrulandı (`npm run build` başarılı).

## 2026-07-09 — RUN prototipi tamamlandı (izole modül)
- `run/` modülünün tek-oyunculu prototipi bitirildi: **beceriler** (sopa=bayılt+sat, kalkan=3sn
  dokunulmazlık, cooldown + kill feed), **AI ele geçirme** (nesneler drone çeker), **drone ateş
  menzili + zorluk eğrisi**, **izleyici modu + round sonu 2 katmanlı sıralama**.
- **React entegrasyonu:** `src/App.jsx`'e lazy `/run/*` rotası; menü + oyun sayfası (canvas + Motor).
  RUN ayrı chunk (`RunApp-*.js` ~34 kB) — Bildim quiz paketi etkilenmez.
- Ayrıntı ve kararlar: **`run/PROGRESS.md`** (modül günlüğü). Kalan tek büyük iş: multiplayer (en son).
- Doğrulama: `npm run build` OK + Node başsız motor simülasyonu (hata yok, round çözülüyor, sıralama doğru).

## 2026-07-09 — RUN: kapılar, etkileşimli makineler, parçacıklar (kalan açık maddeler)
- Odalar **duvarlandı**, her odaya 2-3 **kapı geçidi** açıldı → gerçek labirent. Kapıyı **Q** ile
  kapatınca enerji perdesi olur: oyuncular geçer, **drone 2.2sn kırmak zorunda kalır**.
- **Etkileşimli makine:** alarm veren makinenin yanında **E basılı tut** → ele geçir; menzildeki
  droneler 2.6sn **sersemler** (EMP). Bedeli: hack sırasında durursun, ısı algılamasına açıksın.
- **Parçacık sistemi** (vuruş/hack/EMP/kapı/yakalama kıvılcımları) + ele geçirme ilerleme halkası.
- **`run/engine/navigasyon.js`** (yeni): çıkışlardan BFS akış alanı — botlar duvarlı odalardan
  kapıları bulup çıkabiliyor; aynı alan haritanın %100 ulaşılabilirliğini doğruluyor.
- Ölü kod temizliği (`render.js`'te erişilemez ~70 satır, kullanılmayan importlar).
- Doğrulama: başsız Node testi (17 sağlama × 5 tur, hepsi geçti), `npm run build` OK,
  Chrome'da kapı perdesi + hack halkası + EMP görsel olarak doğrulandı.
- Ayrıntı: `run/PROGRESS.md`. **Kalan tek büyük iş: multiplayer** (backend gerektirir).

## 2026-07-09 — RUN yayına hazır: ışık oklüzyonu + hata düzeltmeleri
- **Fener artık duvardan sızmıyor** (gölge dörtgenleri + ara katman ışık maskesi; ışık kapı
  geçitlerinden doğal sızar). Piksel taramasıyla doğrulandı.
- Düzeltilen hatalar: masaüstünde dokunmatik butonlar gizlenmiyordu (CSS), oyundan çıkınca
  ortam sesi çalmaya devam ediyordu (ortamDur), drone başlangıcın dibinde doğabiliyordu
  (spawn ≥700), girdi bayrak temizliği, ölü sabit.
- Cila: botlar yakın drone'dan kaçınıyor; round bitince vızıltı sönüyor.
- Doğrulama: başsız test 3 tur geçti, build OK, Chrome görsel + piksel doğrulaması.
- Multiplayer hâlâ bilinçli olarak sonraki faz (backend gerektirir).

## 2026-07-09 — RUN: stealth görünürlük kuralı + profesyonel harita + mobil cila
- **Görünürlük:** diğer oyuncular yalnızca ışığının içindeyse (fener/çevre) VE arada duvar
  yoksa görünür/etiketlenir; koşulsuz isim blip'leri kaldırıldı. Genel bakış "bina planı" oldu:
  drone/oyuncu göstermez (hile olmaktan çıktı).
- **Harita:** değişken oda boyutları, birleşik büyük odalar (Kafeterya + Atrium), 14 oda tipi
  (tip bazlı mobilya + zemin tonu), depo palet istifleri, güvenlik monitör duvarı, lab tezgahları.
- **Mobil:** sanal joystick görseli, dokunsal titreşim, kill feed sağ-üst, safe-area, çıkış yön okları.
- Doğrulama: başsız test 5 tur geçti (%100 ulaşılabilirlik), Chrome görsel testleri, build OK.

## 2026-07-09 — RUN okunurluk/yönlendirme: karanlık yumuşatıldı, kapılar ve çıkış belirgin
- Karanlık örtü 0.85, çevre ışığı 150; kapılara acil durum aydınlatması (karanlıkta seçilir);
  oyuncu üstünde en yakın çıkış pusulası + mesafe; çıkışlar animasyonlu yeşil geçit.
- HUD: konum (oda adı), süre sayacı, round başı hedef yazısı.
- Görünürlük kuralı gövdelere de uygulandı (karanlıkta silüet bile yok; aydınlık odadakiler
  görüş hattı açıksa görünür). Test + build + Chrome doğrulaması yapıldı.

## 2026-07-09 — RUN büyük oynanış turu (İda'nın 10 maddelik geri bildirimi)
- Kapılar fiziksel: Q aç/kapa, kapalı kapı herkesi engeller, drone 0.5sn'de açar.
- İnsan görünümlü karakterler (saç/ten/ceket çeşidi, yürüme animasyonu) + elde görünür
  sopa ve savurma animasyonu.
- Kırmızı tarama konisi: devriye drone önünde salınan arama ışığı — koniye giren anında
  fark edilir; duvar koniyi keser (görsel + mekanik). Drone 3→6 (3'ü çıkış bekçisi),
  gövde 1.5x, vızıltı yaklaşınca belirgin yükselir.
- Çıkış zorlaştı: çıkışta 1.6sn bekleme (kaçış kanalı + ilerleme halkası).
- Harita: doygun zeminler, tip renginde kenar neonu + halılar, parlak mobilya.
- Doğrulama: 35 sağlamalı başsız test 8 tur geçti, build OK, Chrome görsel testler.

## 2026-07-10 — RUN aksiyon turu: enerji kılıcı + dash + veri çipleri
- İda: "vuramıyorum, drone beni önce yakalıyor; gerçek kılıç savurmak istiyorum; oyun heyecansız."
- **Enerji kılıcı:** menzil 52→118 (drone ateş menzilinden uzun), cooldown 1.5sn, ileri hamle;
  droneları geri savurur + sersemletir, **3 vuruşta hurdaya çıkarır** (12sn sonra uzakta yeniden doğar).
  Gerçek savurma animasyonu: süpüren enerji izi + parlak bıçak; karakterin elinde ışıyan kılıç.
- **Juice:** vuruş donması (hitstop) + ekran sarsıntısı. **Dash:** Shift/L, 0.22sn ×3.2 hız, cd 2.6sn
  (Shift artık kalkan değil — kalkan yalnız K).
- **Veri çipleri:** 10 toplanabilir, karanlıkta parlar, HUD sayacı + sıralamada 💿 kolonu. 5 yeni ses
  (kilic/darbe/patlama/dash/cip). Menü + ipucu metinleri güncellendi, mobil ⚔/💨 butonları.
- Doğrulama: başsız test 16/16, build OK (RunApp 63 kB), Chrome görsel + konsol temiz.
- Ayrıntı: `run/PROGRESS.md`.

## 2026-07-15 — KAFA TOPU modülü (yeni oyun sekmesi, baştan sona)

Head Soccer tarzı 2D fizik futbolu; `kafatopu/` altında izole modül, `/kafatopu` route'u + tabbar'a "⚽ Kafa Topu" sekmesi. Bildim oturumunu kullanır (giriş duvarı arkasında).

### Yapılanlar
- **Fizik/motor (Matter.js):** `kafatopu/engine/` — fizik.js (saha 1000x560, kaleler+üst direk, top sekme 0.82, yerçekimi 1.35), oyun.js (faz makinesi: geri_sayim→oyun⇄gol_bekle→bitti, 60Hz sabit adım, maç 120 sn, gol beklemesinde saat durur), gucler.js (5 düşen güç: 🎈💨💥🐌🪄, 10-16 sn arayla, 6 sn etki; 5 karakter yeteneği: ateş şutu/dondurucu/ışınlanma/kalkan/dev kafa, 15 sn cd), bot.js (balistik tahminli antrenman botu), girdi.js (klavye+dokunmatik birleşik), render.js + kafaCizim.js (parallax arka plan, prosedürel Club Afrodit yedeği, foto kafa animasyonları: eğilme/gerilme/vuruş savurması).
- **Multiplayer (host-otoriter):** `kafatopu/net/` — kanal.js (Realtime broadcast+presence, `kt-mac-<id>`), interpolasyon.js (100 ms geriden lerp). Slot 0 = host: sim çalıştırır, 20Hz "durum" yayınlar; misafir 20Hz "girdi" yollar. Kopma: presence takibi, 12 sn sonra "mevcut skorla bitir" hakkı.
- **DB:** `20260612000035_kafatopu_temel.sql` — kafatopu_profiller/kuyruk/maclar/mac_oyunculari; RLS select-only, yazım security-definer RPC'lerle. `kafatopu_mac_bul` (advisory lock ile yarışsız eşleştirme; 1v1/2v2 × ranked/hizli 4 ayrı kuyruk; ranked'da puan yakınlığı), `kafatopu_sonuc_kaydet` (FOR UPDATE + ilk raporlayan; ELO K=32, takım ortalaması, taban 100), iptal + 3 admin RPC. Admin = sabit geliştirici UUID (Gladius deseni).
- **Ligler:** Bronz<1100, Gümüş 1100+, Altın 1250+, Platin 1450+, Elmas 1700+ (puandan türetilir, başlangıç 1000).
- **UI:** app/pages — Menu (mod kartları), Karakter (5 kurgusal + /heads/manifest.json foto kafaları; foto kafa yetenek seçer), Kuyruk (3 sn poll, 15 sn sonra bot önerisi), Mac (canvas + HUD + dokunmatik butonlar + sonuç paneli), Siralama (top 100 + lig rozetleri), Admin (kuyruk/maç görüntüle-iptal, puan ayarla; maç içi admin cd≈0).
- **Varlıklar:** public/heads/ ve public/map/ + OKU.txt + manifest şablonu — İda fotoğrafları/harita görsellerini sonra ekleyecek; yokken prosedürel sahne/kurgusal roster ile oyun tam çalışır.

### Kararlar
- Fizik değerleri sabitler.js'te tek yerde (denge ayarı kolay olsun).
- Arka plandaki sekmede rAF durduğu için host simülasyonuna 200 ms interval kalp atışı eklendi (online maç donmasın).
- Antrenman botu DB'ye yazmaz; hızlı maç ELO etkilemez (delta 0 ama G/B/M istatistiği işlenir).

### Doğrulama
- Başsız motor testi (Node): 1v1 + 2v2 tam maç, NaN yok, skor/gol tutarlı, yetenek+güç+vuruş olayları geldi.
- Chrome görsel test: `kafatopu/_test/mac-test.html` (Supabase'siz bot maçı) — sahne, animasyonlar, gol, aura doğrulandı; konsol temiz. `npm run build` OK (KafaTopuApp ~135 kB lazy chunk).

### Bekleyen / manuel
- **Migration uygulanmadı:** `npx supabase db push` bu makinede 403 verdi (DB şifresi/yetki gerekli). SQL'i Supabase Studio'da çalıştır ya da `SUPABASE_DB_PASSWORD` ile push et. Online modlar migration'sız çalışmaz (antrenman çalışır).
- Gerçek 2 cihazla online 1v1/2v2 + kopma senaryosu testi.
- /heads ve /map görselleri eklenince karakter/harita son kontrol.
- Deploy (main'e push) yapılmadı — onay bekliyor.

## 2026-07-15 (2. oturum) — Kafa Topu: İda foto kafası + mobil cila + canlıya alma
- `public/heads/ida.png` (çift uzantı düzeltildi) manifest'e bağlandı; manifest'e **odak desteği** eklendi (`odakX/odakY/yaricap`, görüntü oranı cinsinden) — yüz görselin neresindeyse daire oradan kesilir (kafaCizim.js kaynak-dikdörtgen çizimi). İda: odak (0.36, 0.55), yarıçap 0.38.
- Mobil: dikey tutuşta "telefonu yan çevir" ipucu (CSS media query, oyun dikeyde de çalışır). 380px genişlikte görsel doğrulama yapıldı — saha/kafalar/skor okunaklı, güç ölçeklemesi görünüyor.
- Doğrulama: mac-test.html foto kafayla bot maçı (skor aktı, kırpma isabetli, konsol temiz), build OK.
- Deploy: main'e push edildi (kullanıcı "siteden gireyim" dedi). **Migration hâlâ manuel** — Supabase Studio'da 20260612000035 çalıştırılmalı, yoksa online modlar/karakter kaydı çalışmaz.
- GÜNCELLEME: Migration Supabase Studio SQL editöründen uygulandı (Success) — tüm kafatopu_ tabloları/RPC'ler canlıda. Üretimde doğrulandı: profil (Bronz·1000), karakter kaydı (İda foto kafa), antrenman maçı İda kafasıyla oynuyor. Ek düzeltme: bot/online maç kurulumunda profil+foto manifesti beklenir oldu (seçili kafa yarış durumu). Canlı adres: https://bildim.vercel.app/kafatopu

## 2026-07-15 (3. oturum) — Zıplama fiziği + ana sayfa üst sekmesi
- **Zıplama "aşırı yüksek" şikayeti:** eski ayarda tepe ~310px (saha yarısı) çıkıyordu. Head Ball hissi için YERCEKIMI 1.35→2.0, ZIPLAMA 15.2→12.4 → tepe ~140px (~1.6 kafa boyu), havada kalış ~0.75 sn. Top ağırlaşmasın diye TOP.YUZERLIK=0.35 eklendi (fizikAdim'da topa ters kuvvet; plaj topu süzülmesi korunur, şut yayları eskisine yakın).
- **Ana sayfa üst sekmesi:** Home.jsx'in en üstüne `kafatopu-serit` bandı (zıplayan ⚽ animasyonu, "YENİ" rozeti, /kafatopu linki); stiller styles.css'e eklendi. Alt tabbar sekmesi de duruyor.
- Doğrulama: başsız motor testi geçti (27+22 gol, iki mod da bitti), build OK, canlıda ana sayfa şeridi + bot maçı yeni fizikle görsel doğrulandı.

## 2026-07-15 (4. oturum) — Gol sonrası hareket, bayıltma, gerçekçi sahne
- **Gol sonrası serbest hareket:** gol_bekle fazında artık girdiler + fizik işleniyor (Head Ball sevinç koşusu); saat durur, yeni gol sayılmaz, süre sonunda pozisyon sıfırlanır.
- **Topsuz vuruşla bayıltma:** vuruş menzilindeki öndeki rakip 1.1 sn bayılır (kontrol kilidi + geriye savrulma + dönen ⭐ animasyonu, sersem sallanma). Bayılma sonrası 2.2 sn tekrar-bayıltılamama koruması (stunlock önlenir). Ağ paketinde EFEKT_BAYRAK.bayilmis=128. Botlar da top uzaktayken ara sıra kullanır. Başsız testte 1v1'de 24, 2v2'de 55 tetiklenme.
- **Gerçekçi prosedürel sahne (render.js yeniden):** kaydırak kulesi (ışık/gölgeli gövde, kat çizgileri, merdiven, korkuluklu platform, kırmızı tente), borularda hacim (koyu kontur + üst ışık şeridi) ve destek ayakları, çıkış köpüğü; bulutlar, güneş ışıması, iki katmanlı sisli dağlar; damarlı yapraklı/hindistan cevizli palmiyeler; şemsiye+şezlong; taş bordürlü parıltılı havuz; kum dokusu (deterministik benekler).
- **Harita fotoğrafları hâlâ YOK:** public/map/ boş — İda fotoğrafları atınca manifest.json ile bağlanacak (OKU.txt tarifli). Fotoğraflar Desktop/Downloads'ta da bulunamadı.
- Deploy edildi; canlı chunk'ta bayilma kodu HTTP ile doğrulandı (tarayıcı eklentisi oturum ortasında koptu).

## 2026-07-15 (5. oturum) — Oyun ana ekranı + özel oda/davet sistemi
- **Ana ekran yeniden:** panel görünümü gitti — tam ekran canlı sahne (senin karakterin topla sektirme yapar, topu tembelce takip eder), üstte lig rozeti + sıralama/karakter/admin kısayolları, ortada logo, altta arcade butonlar: ▶ OYNA (mod seçim modalı), 🏟 ODA KUR, 🔑 KODLA KATIL. Davet banner'ları ana ekranda görünür (8 sn poll).
- **Özel odalar:** Migration `20260612000036_kafatopu_odalar.sql` — kafatopu_odalar (6 haneli kod), kafatopu_oda_oyunculari, kafatopu_davetler. RPC'ler: oda_kur, odaya_katil (kodla; linkle gelince otomatik), odadan_ayril (kurucu ayrılırsa oda iptal), oda_baslat (sadece kurucu, oda doluyken → hizli/puansız maç kurar), davet_gonder/davetlerim/davet_yanitla (kabul = odaya katılım). Oda maçında host = kurucu (slot 0).
- **OdaPage lobisi:** kod kartı (tıkla = kod+link kopyala), iki takım kadro görünümü (kafa önizlemeli), Bildim arkadaş listesinden "Davet Et", kurucuya MAÇI BAŞLAT, 2.5 sn poll; "basladi" görülünce herkes maça geçer. KafaOnizleme paylaşılan bileşene çıkarıldı.
- Migration Studio'dan uygulandı (Success). Build OK.
- **DEPLOY BEKLEMEDE:** `git push` GitHub kimlik doğrulaması istiyor (GCM kimlik bilgisi düşmüş) — kullanıcının interaktif push'u gerekiyor. 2 commit lokalde hazır.

## 2026-07-15 (6. oturum) — Göğe uçma bug'ı + 2. foto kafa
- **Göğe uçma kök nedeni:** fizik.js'te olay tabanlı yere-basma sayacı, top/kafa temas bitişinde koşul tutmayınca takılı kalıyordu → zıplama basılı tutulunca her tick -12.4 hız = uçuş. Çözüm: sayaç kaldırıldı, yerdeMi() her çağrıda deterministik geometri kontrolü yapar (vy < -1 iken asla yerde değil; zemine yakınlık ya da başka kafanın tepesinde olma). Body.scale sonrası circleRadius kullanılır.
- Regresyon testi eklendi (motor-test): zıplama 15 sn basılı tutulur, tepe ~111px doğrulanır, y<150 (uçuş) hata fırlatır.
- **2. foto kafa:** kafa2.png (1170x1170, şeffaf) manifest'e eklendi (odak 0.5/0.5, yarıçap 0.40), rosterde "Kafa 2" olarak canlıda doğrulandı. Kullanıcı ad değişikliği isterse manifest.json'daki "ad" alanı güncellenir.

## 2026-07-15 (7. oturum) — Foto kafalar karikatürize edildi
- İki foto kafa (ida.png, kafa2.png) Head Ball tarzına çevrildi: 3px yumuşatma + hafif doygunluk + 7 seviyeli posterize (düz renk bölgeleri) + Sobel tabanlı koyu konturlar (alpha silüeti de kontur sayılır, kafa çevresine doğal çizgi düşer). Orijinal şeffaflık birebir korunur.
- İlk denemede doygunluk 42 tenleri turuncuya boyadı → 12-15'e düşürüldü.
- Araç kalıcı: `scripts/kafatopu-karikatur.mjs` (jimp@0.22 gerektirir, kullanım: `node scripts/kafatopu-karikatur.mjs girdi.png cikti.png [esik] [poster] [doygunluk]`). Orijinal fotoğraflar git geçmişinde (commit 1ee2f77 ve öncesi).
- Canlıda doğrulandı: roster'da iki karikatür kafa kurgusal karakterlerle uyumlu.

## 2026-07-15 (8. oturum) — Maçtan çıkma + hızlı karakter seçici
- **Maçtan çıkış:** maç ekranı sağ üstüne ✕ butonu + onay paneli. Bot: direkt menü. Online beklemede/başlamamış: kafatopu_mac_iptal (puansız). Online aktif: hükmen mağlubiyet — rakip skoru max(3, mevcut, benim+1) yapılarak kafatopu_sonuc_kaydet çağrılır, "bitti" broadcast edilir, menüye dönülür.
- **Hızlı karakter seçici:** KafaSecici bileşeni (yatay şerit, tak-seç → kafatopu_profil_kaydet; kurgusalda yetenek otomatik, foto kafada mevcut yetenek korunur). OYNA modalının üstünde ve oda lobisinde. Kuyruk/oda maçları kafayı maç kurulurken profilden okuduğu için seçim anında geçerli.
- Canlıda doğrulandı: OYNA modalında şerit, antrenman maçında ✕ → onay → menü akışı, karikatür kafalar maç içinde.

## 2026-07-15 (9. oturum) — Kod inceleme raporu işlendi + 3. kafa
- **[KRİTİK] Skor sahteciliği kapatıldı** (rapor Madde 1): Migration `20260612000037_kafatopu_skor_onay.sql` (Studio''dan uygulandı). Yeni model: her oyuncu maç sonunda KENDİ gördüğü skoru bildirir (ilk bildirim sabitlenir); sunucu ancak İKİ TAKIMDAN uyuşan rapor gelince ELO işler. Uyuşmazlık = maç iptal, ELO yok (hile kâr etmez). Tek taraflı kesinleştirme sadece rakip gerçekten kopuksa: rakip takımın son nabzı >25 sn eski VE rapor >15 sn beklemiş. Nabız: istemciler maç boyunca 10 sn''de bir kafatopu_nabiz çağırır. Skor tavanı 50→20. İstemci: raporla() (onay_bekliyor''da 5 sn aralıkla 12 deneme), misafir host''un "bitti" yayınını kendi skoruyla doğrular (tek kabul edilen fark hükmen çekilme deseni), hükmen çekilme de rapor sistemi üzerinden.
- **[Madde 2] Kalıcı test paketi:** `kafatopu/_test/motor-test.mjs` (Node, 27 test): golKontrol sınırları, faz geçişleri (macTick 250ms/çağrı kırptığı için zamanIlerle ile), ELO formül JS eşleniği (SQL ile birebir; değişirse ikisi birlikte güncellenecek), tam 1v1/2v2 bot maçları, zıpla-tut regresyonu. Çalıştırma: `node kafatopu/_test/motor-test.mjs`.
- **[Madde 5] 2v2 takım dengesi:** kafatopu_mac_bul artık 4 kişiyi ELO toplam farkı minimum olacak şekilde bölüyor (ben+en uygun partner vs kalan ikisi).
- **[Madde 3] not:** Kök PROGRESS.md''de Kafa Topu kayıtları zaten bu oturumlardan beri mevcut (raporun klonu eski olabilir).
- **3. foto kafa:** kafa3.png (1100x1100) karikatürize edilip manifest''e eklendi ("Kafa 3", odak 0.52/0.51, yarıçap 0.48).
- Bilinen sınır (rapor Madde 2 - host migration): host kopunca maç devralınmıyor, "mevcut skorla bitir" telafisi geçerli — bilinçli tasarım kararı olarak bırakıldı.

## 2026-07-15 (10. oturum) — Oyun içi isim değiştirme + kafa adları
- Menü üst şeridine 👤 isim chip''i: tıkla → "Oyuncu İsmi" modalı → profiles.username güncellenir (Bildim ana sayfa kurallarıyla birebir: min 3 karakter, 23505 → "isim alınmış"). İsim maç/lobi/davet/sıralamada her yerde ortak.
- Foto kafa adları: ida → idaGG, kafa2 → Baran, kafa3 → Aykut (id''ler değişmedi, DB kayıtları etkilenmez). Not: PowerShell Get-Content ile Türkçe karakter bozulması yaşandı; manifest Write tool ile temiz UTF-8 yazıldı.
- Canlıda doğrulandı: isim chip''i menüde, manifest adları HTTP''den kontrol edildi.

## 2026-07-15 (11. oturum) — 4. foto kafa: Emirhan
- emirhan.png ham geldi (2250x3000, arka plan AYRILMAMIŞ — gri duvar önü portre). Yeni araç: scratchpad''de arkaplan-kes.mjs — kenarlardan bölge büyütme + "duvar-gibi" renk filtresi (gri tonlu + orta parlaklık; ten/siyah şapka geçemez → sızma durur). İlk deneme saf yerel süreklilikle %100 sildi (gölgeden sızdı), filtre eklenince %88 ile temiz kesti.
- Kesit karikatürize edilip manifest''e "Emirhan" eklendi (odak 0.5/0.46, yarıçap 0.44). Orijinal ham foto scratchpad''de yedekli (git''te sadece toon hali var — ham gerekirse tekrar istenir).
- Canlıda doğrulandı: roster 5 kurgusal + 4 foto kafa (idaGG, Baran, Aykut, Emirhan).

## 2026-07-15 (12. oturum) — Foto kafalar Head Ball tarzı v2 karikatür
- Kullanıcı v1 filtresini "hâlâ foto gibi" buldu → v2 işlem hattı (`scripts/kafatopu-karikatur2.mjs`): (1) karikatür oran deformasyonu — kafatası bulge +%20, çene pinch -%14 (ters eşleme + bilinear, odak parametreli), (2) cel-shading — ton korunur, ışık 5 banda kuantalanır (kanal-bazlı posterize ton kaydırıp leke yapıyordu, çözüm bu), (3) kalın koyu kontur + silüet sınırına garantili dış çizgi.
- Kesit uygulamalarının bıraktığı yarı saydam gürültü halkası: maske yalnız alpha>=250 + 2px erozyon; şeffaf piksellerin RGB artığı sıfırlanır. (Not: Read önizlemesi alpha birleştirmiyor — "saçak" alarmı iki kez yanlış çıktı, piksel ölçümüyle doğrulandı.)
- 4 kafa orijinallerden yeniden üretildi (ida/kafa2 git geçmişinden, emirhan kesikten; kafa3 ham fotoğrafı yok → v1 karikatüründen deforme edildi, ham gelirse yenilenir). Canlıda doğrulandı.

## 2026-07-15 (13. oturum) — v2 karikatür geri alındı
- Kullanıcı v2 sonucunu beğenmedi ("karikatürize edememişsin") → 4 kafa v1 haline (posterize+kontur, deformasyonsuz) geri döndürüldü (git checkout 3413466~1). v2 aracı scripts/te duruyor; ileride farklı ayarla denenebilir ya da gerçek çizim istenirse dış kaynak gerekir.

## 2026-07-15 (14. oturum) — Mobil multiplayer sertleştirme
- Tam MacPage kod denetimi + 5 mobil düzeltme: (1) Wake Lock — maçta ekran uykuya dalmaz, görünürlük dönüşünde yeniden alınır; (2) visibilitychange/blur''da girdi.sifirla() — kaçan pointerup/keyup ile tuşun basılı kalması (kendi kendine koşma) bug''ı kapandı; (3) dokunmatik tuşlarda onContextMenu engeli (uzun basış menüsü); (4) ELO delta poll 4x0.7s→8x0.9s (iki taraflı onay mobil ağda gecikebiliyor); (5) "yan çevir" ipucu 6 sn sonra kaybolur.
- Denetimde doğrulanıp değiştirilmeyenler: kanal reconnect''te presence re-track (subscribe callback her SUBSCRIBED''da track ediyor), telefon kilidi = JS tamamen durur → kopma akışı bilinçli telafi, 2v2 mesaj hızı (~80 msg/s) Realtime limiti içinde.
- Canlı duman testi: kuyruğa giriş (poll+sayaç+bot önerisi), Vazgeç ile temiz çıkış, konsol hatasız. 27 motor testi geçti.
- GERÇEK 2 TELEFON testi hâlâ kullanıcıda: eşleşme → maç → kopma → hükmen akışları cihazlarla doğrulanmalı.

## 2026-07-15 (15. oturum) — Yatay/dikey dönüş ekran sığdırma
- Kök neden: maç canvas''ı yalnız GENİŞLİĞE göre boyutlanıyordu (width:100%, height:auto) → yatay telefonda saha dikeyde taşıp "yarım" görünüyordu. Çözüm: fit-to-viewport — olcek=min(vw/1000, vh/560, 1200/1000), canvas hem stil hem buffer boyutu JS''ten; visualViewport ölçüleri (iOS adres çubuğu payı); resize + orientationchange + visualViewport.resize dinleyicileri; döndürme anında tarayıcı eski ölçü bildirdiği için 0/300/800ms üçlü yeniden ölçüm. Sarmalayıcı tam ekran flex-center (dokunmatik tuşlar gerçek ekran köşelerinde), canvas ortada.
- MenuPage arka plan sahnesine de orientationchange + gecikmeli ölçüm eklendi.
- Canlıda doğrulandı: canvas 1200x672 @ 1536x791 viewport, taşma yok; alan artık yükseklik-sınırlı ölçeklenip ortalanıyor.

## 2026-07-15 (16. oturum) — Tam ekran dolum (yatay bant sorunu)
- Fit-to-viewport yanlarda boş bant bırakıyordu ("tam ekran olmuyor"). Çözüm: canvas viewport''un TAMAMINI kaplar; saha çizimde ortalanır (transform ofset), saha dışı paylar sahneCiz''e mantıksal birim olarak geçilir ve arka plan katmanları + kum zemini bu paylara uzatılır (sahneCiz 5. parametre pay={sol,sag,ust,alt}; katman cover ölçeği paylara göre büyür). Fizik/kale konumları değişmedi.
- Canlıda doğrulandı: canvas 1536x791 = viewport (tamEkran:true), ekran görüntüsünde sahne kenardan kenara.

## 2026-07-15 (17. oturum) — Gerçek tam ekran (tarayıcı çubuğu/sistem tuşları)
- İki kök neden: (1) manifest "orientation":"portrait" → PWA (ana ekrana eklenmiş) modda döndürme tamamen kilitliydi → "any" yapıldı; (2) tarayıcı çubuğu/sistem tuşları ancak Fullscreen API ile gizlenir → maç ekranına İLK dokunuşta document.documentElement.requestFullscreen({navigationUI:"hide"}) + screen.orientation.lock("landscape") (Android; iPhone Safari API''yi desteklemez — orada tek yol PWA olarak açmak). Maçtan çıkışta exitFullscreen + orientation.unlock. fullscreenchange''de yeniden ölçüm.
- Not: PWA kurulu kullanıcılarda manifest orientation değişikliği uygulamayı silip tekrar ana ekrana ekleyince garanti alır.

## 2026-07-15 (18. oturum) — Dokunmatik tuş düzeni (ergonomi)
- Sol/sağ yön tuşları 64→88px; zıplama üst sıradan EN ALTA indi ve 88px oldu (vuruşun soluna, başparmak hizası); güç tuşu sağ üstte 62px küçük tuş. Güç barı yeni düzene taşındı. ≤480px dar dikey ekranlarda 72px ölçek + ofset düzeltmesi (tuş çakışması önlendi).

## 2026-07-16 (19. oturum) — Dokunmatik tuşlar daha büyük + köşelerden uzak
- Kullanıcı geri bildirimi: maçta tuşlar küçük kalıyor, el boşa kaçıyor. Yön/zıplama/vuruş 88→110px (font 2.4rem), güç 62→76px; kenar boşlukları 14→28px (alt 26px) + env(safe-area-inset-*) payları (çentikli/yuvarlak köşeli ekranlar). Güç barı yeni düzene taşındı.
- ≤480px dar ekran kırılımı: 72→92px, güç 54→64px, ofsetler 20px + safe-area.

## 2026-07-16 (19. oturum, devam) — Foto kafa boşluk düzeltmesi + antrenman rakip seçimi
- Foto kafa dairesindeki boşlukların kök nedeni: manifest'teki odak/yarıçap ile hesaplanan kırpma penceresi görselin dışına taşınca drawImage o bölgeyi boş bırakıyordu. Çözüm (kafaCizim.js): yarıçap görüntüye sığdırılır, pencere sınır içine kaydırılır; ayrıca daire içi önce takım koyu rengiyle doldurulur (şeffaf PNG payı). Önizleme aynı fonksiyonu kullandığından tek yerde düzeldi.
- Antrenman rakip seçimi: OYNA→Antrenman artık "Rakibini Seç" modali açar (tüm roster: 5 kurgusal + foto kafalar, takım-2 önizlemesiyle) + "Rastgele Rakip". Seçim ?rakip=id ile MacPage'e gider; slot 1 botu o kafayı ve adını alır, foto kafaya rastgele güç atanır. "Tekrar oyna" rakip parametresini korur.

## 2026-07-16 (19. oturum, devam 2) — Tuşlar ortaya alındı + çevrimiçi oyunculara davet
- Kullanıcı: "tuşlar çok ekranın köşesinde, basamıyorum" → yan boşluklar 28→64px (dar ekranda 20→44px), tuş çiftleri buna göre kaydı; boyutlar aynı (110/92px). Güç barı hizalandı.
- Çevrimiçi davet: KafaTopuApp global "kafatopu:cevrimici" presence kanalına track olur (user_id + Bildim username), liste KT context'inde `cevrimici`. Oda lobisinde yeni "🟢 Çevrimiçi oyuncular" kartı — oyunda olan herkes (arkadaş şartı yok, RPC zaten kısıtsız) davet edilebilir; arkadaş listesine de 🟢/⚪ durum rozeti eklendi.
- Not: davet banner'ı MenuPage'de 8 sn'de bir poll ile görünür; davet edilen kişi menüdeyse görür.

## 2026-07-16 (19. oturum, devam 3) — Kaleler ekran kenarına + sarı çizgi kaldırıldı + son 5 sn sayacı
- "Kaleler içeri girmiş" — kök neden tuşlar değil, 16. oturumdaki fit-to-viewport ortalamasıydı (yanlarda saha dışı pay). Çözüm: saha GENİŞLİĞE tam oturur (sc = w/SAHA.W), zemin alta sabit; basık ekranlarda üstteki gökyüzü kırpılır (fizik aynı, top nadiren üstte kısa süre ekran dışına çıkabilir). Kaleler artık ekranın en kenarında.
- "Sağ kale üzerindeki sarı çizgi" = dokunmatik güç şarj barıydı → kaldırıldı; soğuma artık güç tuşunun İÇİNDE sayı olarak geri sayar (tuş sönükleşir). Klavye modundaki alt bar durdu.
- Maç sonu: son 5 saniye ekran ortasında turuncu sayaçla sayılır (kt-geri-sayim.son5).

## 2026-07-16 (19. oturum, devam 4) — Tuş yerleşimi son hali (kullanıcı düzeltmesi)
- "İçeri alma" yanlış yöndü; istenen: yön tuşları SOL kenara (sol 18px, sağ 146px), zıpla+vur SAĞ kenara (zıpla right 146px, vur right 18px), güç sağ üstte. İki el kümesi ekran kenarlarına yaslı, aradaki geniş boşluk yanlış basmayı önler. Dar ekranda 14/120px. Boyutlar korundu (110/92px, güç 76/64px).

## 2026-07-16 (20. oturum) — Adenis kafası + iOS (Apple) tuş/kasma düzeltmeleri
- Yeni foto kafa: adenis.png → manifest'e eklendi (odakX .49, odakY .40, yaricap .31 — 2250x3000 dikey fotoğraftan hesaplandı).
- iOS'ta "tuşlar çalışmıyor" kök nedenleri ve çözümler:
  - Dokunmatik tuşlar yalnız pointer olayı dinliyordu; iOS Safari çoklu dokunuşta (bir tuş basılıyken ikinci parmak) pointer olaylarını güvenilir iletmiyor + çift dokunuş zoom/uzun basış büyüteci araya giriyordu. Çözüm: DokunmatikKontroller artık kapsayıcıya native touchstart/touchend/touchcancel (non-passive, preventDefault) bağlar; touch.identifier→tuş haritasıyla çoklu parmak takibi. Pointer olayları sadece mouse/kalem için kaldı (pointerType==="touch" yok sayılır).
  - CSS: .kt-tus ve .kt-mac-root'a -webkit-touch-callout:none + -webkit-tap-highlight-color:transparent eklendi.
- iOS'ta "oyun kasıyor" kök nedenleri ve çözümler:
  - Safari fullscreenElement'i webkit önekli tutar; kod sadece document.fullscreenElement'e baktığından HER dokunuşta yeniden tam ekran isteniyordu (jank + yutulan dokunuşlar). webkitFullscreenElement/webkitExitFullscreen/webkitfullscreenchange desteği eklendi.
  - Canvas 2d context alpha:false (opak) — Safari kompozit maliyeti düşer.
  - INTERP_GECIKME_MS 100→120 (mobil ağ jitter'ı 100ms tamponu deliyor, misafirde takılma yapıyordu).
- Gerçek iPhone'da test edilmeli: antrenman tuşları (özellikle yön basılıyken zıpla/vur) + online 1v1 akıcılık.

## 2026-07-16 (20. oturum, devam) — Adenis kafası revizesi
- İlk sürüm ham 5MB fotoğraftı: dairede yüz küçük kalıyor, çevresi bar/raf arka planıyla doluydu. Diğer kafalar (ida vb.) arka planı silinmiş + karikatürize edilmiş 512px PNG'ler.
- Adenis de aynı hatta geçirildi (scratchpad'de Jimp): sıkı kare kırpma → elips kafa maskesi (feather'lı, cx254 cy245 rx126 ry205 @512) → repo'daki kafatopu-karikatur.mjs mantığıyla karikatürize → 512px, 58KB. Manifest: odak .5/.48, yaricap .40 (daire = kafa yüksekliği; yanlar şeffaf → takım rengi, ida ile aynı dil).
- Test yöntemi: oyun-sim.mjs scratchpad scripti kafaCizim.js'in daire kırpma matematiğini birebir simüle edip PNG üretiyor — yeni kafa eklerken görsel doğrulama için tekrar kullanılabilir.
- Denenip vazgeçilen: omuzlu geniş kompozisyon (ida gibi) — fotoğraf uzaktan çekildiğinden kafa dairede küçük kalıyor.

## 2026-07-17 (3. oturum) — RUN: kapı revizyonu + çıkış rotasyonu + lobi kompleksi
- Kapılar: drone kapalı kapıyı açamaz (bekler), kapı 5 sn'de kendiliğinden açılır, oyuncular
  Q ile her an açıp kapatır. Çıkışlar: 6 slot (3 gizli yedek) — erken kaçışta kullanılan çıkış
  mühürlenir + yedek aktifleşir, 3. kaçışta protokol çözülür (herkes çıkabilir); bot akış alanı
  dinamik yeniden kuruluyor. Lobi kompleksi: Eğitim + Ekipman odaları, bot sohbet balonları,
  koridor sonunda kırmızı "RİSKLİ BÖLGE" segmenti. Yakalanma sonrası: cesetler çizilmiyor,
  izleyici feneri yumuşatıldı, "İzlemeyi Geç" butonu eklendi.
- Doğrulama: başsız test 37/37 (3 tekrar), build OK. Ayrıntı: `run/PROGRESS.md`.

## 2026-07-17 (2. oturum) — RUN: lobi fazı + mobil tam ekran/iOS + kılıç görünürlüğü
- İda'nın 4 maddesi işlendi: (1) mobilde tam ekran + yatay kilit + iOS kasma/tuş düzeltmeleri
  (Kafa Topu'ndaki webkit fullscreen, native touch, alpha:false, wake lock, girdi sıfırlama
  dersleri RUN'a taşındı); (2) kılıç yalnız kendi karakterde görünür; (3-4) her round tesisin
  altındaki "Hazırlık Lobisi + Giriş Koridoru"nda başlar — droneler/zorluk/yönetmen kapalı,
  oyuncu keşif yapıp koridoru bitirince geçitten geçer, geçit MÜHÜRLENİR ve aksiyon başlar.
- Doğrulama: başsız test 23/23, build OK. Ayrıntı: `run/PROGRESS.md`.

## 2026-07-17 — RUN sitede aktif edildi (Kafa Topu deseniyle)
- `/run` rotası zaten canlıdaydı ama sitede görünür girişi yoktu. Kafa Topu'ndaki gibi iki giriş eklendi:
  - **Ana sayfa şeridi:** Home.jsx'te kafatopu-serit'in altına `run-serit` (cyberpunk mor/neon gradient, koşan 🏃 animasyonu, YENİ rozeti). Metin sınıfları (kt-serit-metin/yeni/ok) yeniden kullanıldı.
  - **Tabbar sekmesi:** Layout.jsx'e 🏃 RUN (Kafa Topu'nun yanına, 7. sekme; tabbar flex:1 olduğundan sığıyor).
- RUN bağımsız modül (Supabase/oturum kullanmaz), giriş duvarının önünde de açılır — App.jsx'e dokunulmadı.
- Build OK (RunApp ~71 kB chunk), main'e push = production deploy. Kullanıcı canlı testlere başlayacak.
- RUN'da multiplayer hâlâ yok (bilinçli — en son faz); canlı test tek oyunculu prototip üzerinde.

## 2026-07-17 (2) — KAFA TOPU: iPhone kasma KÖK SEBEP düzeltmesi
- Kullanıcı raporu: 20. oturumdaki iOS düzeltmelerine (native touch, webkit fullscreen, alpha:false) rağmen iPhone'larda kasma sürüyor. Derin inceleme, kare başına yapılan işin kendisini suçlu çıkardı:
  1. **Arka plan her karede sıfırdan çiziliyordu** — 3 tam ekran ölçekli katman blit'i + tam ekran karartma + zemin gradienti + 90 kum beneği + 2 kale filesi (~30 stroke) her karede. Düzeltme: `render.js`'e statik sahne pişirme (`statikleriPisir`) — katmanlar + karartma/zemin/kum/çizgi/kaleler cihaz çözünürlüğünde BİR KEZ offscreen tuvallere pişirilir; kare başına yalnız 4 adet 1:1 drawImage kalır (parallax, marjlı katman tuvalinde kaydırılarak korunur). Foto katman yüklenene dek eski doğrudan yol (`dogrudanArkaplanCiz`) devrede.
  2. **Her karede yeni gradient + emoji rasterleme** — forma/kafa gradientleri ve güç ikonu/⭐ emoji fillText'i (Safari'de renkli emoji çizimi pahalı). Düzeltme: `kafaCizim.js`'e `gradyanAl` (300 girişlik sınırlı önbellek) + `emojiGorsel` (64px tuvale bir kez çiz, drawImage ile bas).
  3. **Canvas'ta border-radius: 6px** — iOS Safari tam ekran canvas'a köşe yuvarlama uygulanınca her karede ekstra kırpma/kompozit katmanı ekliyor (bilinen iOS tuzağı). CSS'ten kaldırıldı.
  4. **120Hz ProMotion iPhone'larda sınırsız çizim** — kare başına tam sahne × 120 = ısınma → thermal kısılma → kasma. Düzeltme: MacPage döngüsünde 12ms çizim eşiği (120Hz'de her 2. kare, 60Hz'de her kare); simülasyon/ağ yayını etkilenmez. Ayrıca `getContext` her kareden çıkarıldı, view/interp paketi yalnız çizilen karede üretiliyor (GC baskısı azaldı).
  5. **Sabit çözünürlük** — zayıf cihazda FPS düşünce netlik düşmüyordu. Düzeltme: FPS 2.5sn pencerede ölçülür, <45 ise kalite kademeli düşer (1 → 0.5, adım 0.15) ve canvas yeniden boyutlanır; ayrıca 1.5M piksel tavanı (büyük ekran/tablet). Arka plan duraklamaları (dt>250ms) ölçüme katılmaz.
- Doğrulama: Node sahte-canvas duman testi (pişirme tek sefer, parallax kaymaları hız oranlarıyla birebir, ana tuvalde fillText kalmadı) + build temiz. Chrome eklentisi bağlı olmadığından tarayıcı görsel testi yapılamadı — GERÇEK iPhone'da test edilmeli: antrenman maçı akıcılığı + online 1v1 + menü arka planı (bake menüde de devrede).
- Değişen dosyalar: `kafatopu/engine/render.js`, `kafatopu/engine/kafaCizim.js`, `kafatopu/app/pages/MacPage.jsx`, `kafatopu/app/styles/kafatopu.css`.

## 2026-07-22 — MEYVE KES modülü (yeni oyun sekmesi, baştan sona)

Kamera tabanlı, gerçek el hareketiyle meyve kesme oyunu (Fruit Ninja mantığı ama kontrol el/kol). `meyvekes/` altında izole modül, `/meyvekes/*` route'u; Kafa Topu/RUN deseniyle entegre. Bildim oturumu + kullanıcı/avatar sistemini kullanır (giriş duvarının arkasında).

### Teknoloji / mimari
- **El takibi:** MediaPipe Hands, CDN'den dinamik script yüklenir (`@mediapipe/hands@0.4.1675469240`) — npm paketine bağımlılık eklenmedi, bundle küçük kaldı. `engine/eltakip.js`: ön kamera (getUserMedia, facingMode user, 640x480), modelComplexity 0 (lite), aynı anda tek gönderim + ~30fps sınırı (4 el takibinde bile akıcı). Video gizli olarak DOM'a eklenir (bazı tarayıcılar bağlı olmayan video'dan kare çözmez).
- **Render:** `engine/render.js` — alt katman canlı kamera (aynalı, cover); üstünde meyveler, kesik yarımlar (sprite üst/alt kırpma), splat parçacıkları, her el için soluklaşan bıçak izi (blade trail), uçan puan metinleri, parmak ucu ışıkları. Arka plan görseli YOK (istendiği gibi).
- **Meyve sprite:** `engine/meyveler.js` — gerçek fotoğraf kesme yöntemi tercihli (`/public/meyve/manifest.json` + şeffaf PNG, heads deseni). Foto yoksa emoji offscreen tuvale bir kez rasterlenip önbelleğe alınır (kare başına fillText yok). 10 meyve + nadir altın (bonus).
- **Oyun mantığı:** `engine/oyun.js` — faz makinesi (geri 3-2-1 → oyun 60sn → bitti), yerçekimi fiziği (alttan fırla, düş), kesim = el avuç(9)+işaret ucu(8) segmenti meyve hitbox'ıyla kesişince. Ceza yok (kaçan meyve puan kaybettirmez). Combo: 0.55sn penceresinde art arda kesim → bonus. MIN/MAX segment sınırı (el sırası değişimi kaynaklı sahte kesimi eler).

### İki mod (istendiği gibi)
- **Tekli:** maxNumHands 2, normal tempo (0.95→0.65sn aralık, zorluk eğrisi).
- **Arkadaşla (yerel, aynı ekran/kamera):** maxNumHands 4, **daha hızlı** akış (0.62→0.40sn). İki kişi ortak/işbirliği (rekabet değil); kesim ekranın sol/sağ yarısına göre P1/P2 olarak ayrı sayılır + toplam skor. HUD'da 👈/toplam/👉.

### Skor / sıralama
- DB: `20260612000038_meyvekes_temel.sql` — `meyvekes_skorlar` (user_id+mod pk, en_iyi, toplam_kesim, oyun_sayisi). RLS select-only; yazım security-definer RPC. `meyvekes_skor_kaydet` (upsert, en_iyi=max), `meyvekes_siralama` (top 100, public.profiles join → username+avatar). Yeni auth YOK, Bildim profilleri kullanılır.
- UI: `app/pages/` — MenuPage (mod kartları + nasıl oynanır), OyunPage (kamera + canvas + HUD + geri sayım + sonuç paneli + kayıt), SiralamaPage (tekli/arkadaş sekmesi, avatar + rekor). Başla ekranı: getUserMedia jesti + tam ekran + wake lock butona bağlı.

### Entegrasyon
- `src/App.jsx`: lazy `/meyvekes/*` route (KafaTopuApp deseni). `src/components/Layout.jsx`: tabbar'a 🍉 Meyve Kes sekmesi. `src/pages/Home.jsx` + `src/styles.css`: ana sayfaya `meyve-serit` (kırmızı/turuncu/yeşil gradient, sallanan 🍉, YENİ rozeti). Mevcut Bildim koduna minimal dokunuş.

### Doğrulama
- `npm run build` OK — MeyveKesApp ayrı lazy chunk (~20 kB js / ~7 kB gzip); Bildim/Kafa Topu/RUN paketleri etkilenmedi.
- Başsız motor testi (Node, `scratchpad/mk-test.mjs`): 60sn tam oyun (104 kesim, 144 puan, faz bitti, NaN yok), kesin kesim testi geçti, combo max 4. Hata yönetimi: kamera izni reddi / kamera yok / model yüklenemedi için ayrı anlaşılır mesajlar + Tekrar Dene.

### Bekleyen / manuel
- **Migration uygulanmadı:** `20260612000038_meyvekes_temel.sql` Supabase Studio'da çalıştırılmalı (bu makinede `db push` 403 veriyor). Uygulanmadan skor kaydı/sıralama çalışmaz — oyunun kendisi (kamera+kesim) migration'sız da çalışır.
- **Gerçek cihaz testi:** kamera+MediaPipe otomasyon ortamında test edilemedi (kamera yok, CDN gerekir). Telefonda/kamerada canlı test gerekli: kamera izni akışı, el takibi akıcılığı (özellikle arkadaş modu 4 el), kesim hissi.
- Gerçek meyve fotoğrafları (rembg) istenirse `/public/meyve/` + manifest ile eklenir (OKU.txt tarifli); şu an emoji sprite ile tam çalışır.

## 2026-07-22 (2. oturum) — MEYVE KES: kasma + kesememe KÖK SEBEP düzeltmesi
Kullanıcı canlı testi: (1) "inanılmaz kasıyor", (2) "ellerimi/kollarımı bıçak gibi algılayamıyor, meyve kesemiyorum; hızlı savurunca / el kadrajdan çıkıp geri gelince yakalamalı".

**Kasma kök sebep:** MediaPipe Hands eski `hands.js` çıkarımı **ana thread'de (WASM)** çalışır; her `send()` render'ı 20-60ms bloklar. rAF ile sürekli çağrılınca ana thread doyuyor.
- `eltakip.js`: (a) çıkarım için **256/320 küçük offscreen kareye** downscale edip onu gönderiyoruz (blok süresi kısaldı; kamera 640→480x360). (b) rAF yerine **setTimeout self-throttle**: gecikme = son çıkarım süresi (25–130ms clamp) → ~%50 doluluk, kalanı render'a kalıyor; zayıf cihaz otomatik yavaşlar. (c) render'dan bağımsız çalışır.
- `OyunPage.jsx`: context `alpha:false` + **önbelleğe alındı** (kare başına getContext yok), **dpr tavanı 1.5** + **1.3M piksel bütçesi**, **adaptif kalite** (EMA<38fps ise kalite 1→0.55 kademeli düşer, canvas yeniden boyutlanır).

**Kesememe kök sebep:** (a) `MAX_SEGMENT=320px` sabiti, FPS düşünce/hızlı savurunca oluşan gerçek uzun segmentleri "el geçişi" sanıp reddediyordu. (b) Kesim yalnız 2 noktadan (avuç+işaret) bakıyordu, tolerans dar. (c) Güven eşikleri yüksekti (el kaybolunca geç yakalıyor).
- `oyun.js`: **kimlik eşleştirmeli el takibi** (`_elleriIsle`) — algılanan eller önceki kareye en yakın avuçla eşlenir; artık izler/kesikler fiziksel ele bağlı, hızlı/uzun savurma reddedilmez. **7 anahtar nokta** (bilek+5 parmak ucu+avuç) → tüm el "bıçak". Kesim yalnız **yeni algılama karesinde** işlenir (`damga`; 60fps render × 15-25fps algılama → mükerrer/yanlış kesim yok). `KILIC_KALINLIK` 20→30, `MIN_SEGMENT` 12→9, segment üst sınırı köşegen oranına bağlandı (`MAX_ORAN 0.75`), eşleştirme cömert (`ESLESME_ORAN 0.9`; absürt bağlantı yine MAX_ORAN'da elenir).
- `eltakip.js`: `minDetectionConfidence` 0.6→0.5, `minTrackingConfidence` 0.5→0.4 (el hızla girip çıksa çabuk yakalanır).

Doğrulama: başsız motor testi v2 (Node) — 60sn tam oyun (100 kesim, NaN yok), kesin kesim ✓, **4 dizili meyve tek savuruşla combo=4** ✓, **hızlı savurma (480px) kesiyor** ✓. Build OK (MeyveKesApp ~21 kB). Gerçek telefon/kamera testi yine kullanıcıda (otomasyonda kamera yok).

## 2026-07-22 (3. oturum) — idaGG GAME CENTER ana sayfası (oyun portalı)
Kullanıcı: siteye girince direkt Bildim çıkmasın; A-kalite profesyonel bir oyun sitesi ana sayfası olsun, Bildim/Kafa Topu/Meyve Kes gibi her oyun tıklanan bir sekme/kart olsun.
- **Yeni sayfa `src/pages/GameCenter.jsx`:** "idaGG GAME CENTER" markası + kullanıcı chip'i (avatar/isim/puan) + hero karşılama + responsive oyun kartı grid'i. 5 oyun kartı (Bildim!/Kafa Topu/Meyve Kes/RUN/Gladius) — her biri kendi temasında gradient, büyük ikon, açıklama, kategori etiketi, YENİ rozeti, OYNA butonu; hover'da yükselme + parlama süpürmesi. Yeni oyun eklemek = `OYNALAR` dizisine bir kart eklemek.
- **Yönlendirme (`src/App.jsx`):** `/` artık GameCenter (Layout dışında, tam ekran); Bildim quiz ana sayfası `/bildim`'e taşındı (diğer quiz rotaları — turnuva/meydan/mac/siralama/arkadaslar/profil — aynı kaldı). `*` → `/` (hub).
- **`src/components/Layout.jsx`:** logo + "Ana Sayfa" sekmesi → `/bildim`; kalabalık 3 oyun sekmesi (Kafa Topu/RUN/Meyve Kes) yerine tek "🎮 Merkez" sekmesi (`/` hub'a dönüş) → Bildim tabbar sadeleşti.
- **`src/pages/Home.jsx`:** üç oyun şeridi kaldırıldı (artık hub'da). Modül menülerindeki geri linkleri "← Oyun Merkezi" yapıldı (kafatopu/meyvekes/run/gladius).
- **Stiller:** `src/styles.css`'e kapsamlı `.gc-*` bloğu (animasyonlu radial-glow arka plan, cam efektli sticky header, gradient kartlar, parlama animasyonu, 520px/360px kırılımlarıyla mobil grid).
- Doğrulama: build OK; **görsel doğrulama** — gerçek CSS ile bağımsız statik önizleme yerel sunucuda Chrome'la ekran görüntüsü alındı (marka, hero, 5 kart, rozetler, etiketler A-kalite render oldu). Canlı siteyi kullanıcı giriş yaparak doğrulayacak.

## 2026-07-22 (4. oturum) — Bildim quiz kendi bildim/ klasörüne taşındı (tam modül izolasyonu)
Kullanıcı: her oyun ayrı klasörde, bağımsız geliştirilebilir, aynı depoda farklı klasörde, birbirine karışmasın.
- **Doğrulama:** 4 aksiyon oyunu (gladius/run/kafatopu/meyvekes) zaten izoleydi — çapraz import yok; her biri kabuğa tek lazy route ile bağlı; ortak yalnız supabase client + AuthContext + Avatar (bilinçli paylaşım). Tek istisna: Bildim quiz `src/` içinde kabukla karışıktı.
- **Taşındı (`git mv`, geçmiş korundu):** quiz sayfaları → `bildim/pages/` (Home, MatchPage, GroupMatchPage, HizliMacPage, ChallengesPage, TournamentPage, LeaderboardPage, FriendsPage, ProfilePage); quiz bileşenleri → `bildim/components/` (Layout, QuestionCard, RankBadge, Countdown, RankUpOverlay); quiz lib → `bildim/lib/` (ranks, push, zaman).
- **`src/`'de kalan (paylaşılan kabuk):** main.jsx, App.jsx, context/AuthContext, lib/supabase, components/Avatar, pages/GameCenter, pages/Login, styles.css.
- **Import düzeltmeleri:** taşınan dosyalarda paylaşılan referanslar `../../src/...`, kardeş referanslar `../components|../lib`; App.jsx quiz sayfaları + Layout `../bildim/...`. Route yapısı/URL'ler değişmedi (quiz rotaları hâlâ top-level; `/bildim` = quiz ana sayfası).
- **Sonuç:** 5/5 modül izole (hiçbir oyun başkasının klasöründen import etmiyor); `bildim/` yalnız `../../src` (paylaşılan) + kendi içine bağlı. CLAUDE.md "Dizin Yapısı" yeni portal yapısına göre güncellendi.
- Doğrulama: `npm run build` OK (176 modül, hata yok), çapraz-import taraması temiz. Not: gladius tasarım dokümanındaki `src/lib/ranks.js`/`push.js` referansları artık `bildim/lib/`'de (sadece prose, kod değil).

## 2026-07-22 (5. oturum) — IDA GG Game Center entegrasyonu: Faz 0/1/7

Büyük çok-fazlı entegrasyon görevi başladı (Meyve Kes düzeltme + PatiRun/DriftGP göçü + ortak kimlik + yeni ana sayfa + tek PWA). Bu oturumda öncelikli hata + tractable fazlar tamamlandı; iki büyük dış port (Faz 2/3, ~22k satır) sonraki oturumlara.

### FAZ 0 — Meyve Kes kök sebep düzeltmesi (öncelik)
- **Kök sebep 1 (kasma + kesememe):** eski `@mediapipe/hands` legacy çözümü ana thread'i WASM ile bloklar; modern **MediaPipe Tasks Vision `HandLandmarker` (GPU delegesi)**'ne geçildi — `detectForVideo` senkron, GPU'da çalışır (kasma çözülür), busy-flag yarışı yok.
- **Kök sebep 2 (koordinat kayması → "kesemiyorum"):** landmark'lar sabit 320×240 (4:3) offscreen kareye normalize ediliyordu; kamera 16:9 dönünce görüntü bozularak küçültülüyor, landmark'lar gerçek elin konumundan kayıyordu. Yeni motor **video karesini doğrudan işler** → aspect bozulması ve koordinat kayması ortadan kalktı.
- GPU başarısızsa **CPU delegesine otomatik düşüş**; düşük güven eşikleri (0.4) korundu (hızlı girip çıkan el çabuk yakalanır).
- **Görsel teşhis eklendi:** render'a tam **el iskeleti** çizimi (tüm el "bıçak" gibi ışıldar; el algılanıyor mu/nerede kullanıcı anında görür) + OyunPage'e **"🖐 el görünmüyor / 🖐 N"** rozeti (kamera açık ama el yoksa kırmızı uyarı).
- **Değişen dosyalar:** `meyvekes/engine/eltakip.js` (baştan yazıldı), `meyvekes/engine/render.js` (el iskeleti), `meyvekes/app/pages/OyunPage.jsx` (el sayacı), `meyvekes/app/styles/meyvekes.css` (rozet). Kesim mantığı (`oyun.js`) landmark formatı aynı olduğu için değişmedi.
- **Kalıcı test:** `meyvekes/_test/motor-test.mjs` (Node, 11 test) — faz makinesi, kesim, statik el kesmez, hızlı savurma keser, 4'lü combo, 60sn tam oyun. **11/11 geçti.** CDN URL'leri (vision_bundle.mjs + wasm + model.task) HTTP 200 doğrulandı. Build temiz (MeyveKesApp ~22 kB; MediaPipe CDN'den, bundle'a girmiyor).
- **Kalan:** gerçek kamera+el testi kullanıcıda (otomasyonda kamera yok).

### FAZ 1 — Bildim quiz'i /bildim/* altına taşı
- Tüm quiz rotaları `/bildim/*` altına nest edildi (App.jsx: `/bildim` = Layout, index=Home, alt: turnuva/meydan/mac/:id/grup-mac/:id/hizli-mac/:id/siralama/arkadaslar/profil).
- **Geriye uyumluluk:** eski top-level yollar için `BildimeYonlendir` bileşeni (parametre+query korunarak `/bildim/*`'a yönlendirir) → push bildirimi deep-link'leri, bookmark, eski linkler kırılmaz.
- Tüm iç navigasyon (`bildim/pages/*` + `bildim/components/Layout.jsx`, ~33 kullanım) `/bildim/*` önekine güncellendi. İş mantığı/auth/RLS'e dokunulmadı (saf route taşıma). Build temiz.

### FAZ 7 — Tek PWA kimliği
- `public/manifest.webmanifest`: name "IDA GG Game Center", short_name "IDA GG". `index.html`: title + description + apple-mobile-web-app-title "IDA GG Game Center". Tek manifest, tüm oyunlar paylaşır.

### Otonom kararlar
- Marka biçimi tutarsızdı (`idagggamecenter` vs `idaGG`); Faz 6 prompt'undaki **"IDA GG Game Center"** biçimi standart alındı.
- Meyve Kes'te legacy MediaPipe yerine Tasks Vision seçimi: iki önceki oturum legacy ile kasma/kesememeyi çözemedi; modern API endüstri standardı güvenilir yol.

### Bekleyen fazlar (sonraki oturumlar)
- **Faz 2:** PatiRun portu (~12.5k satır TS, 2D canvas; supabase+zustand). `pr_` prefix DB göçü, auth birleştirme, `/patirun/*`.
- **Faz 3:** DriftGP portu (~9.4k satır TS, three.js+R3F+drei+zustand). `dg_` prefix DB göçü, hayalet herkese açık, `/driftgp/*`.
- **Faz 4:** Ortak kimlik (büyük kısmı zaten var — paylaşılan AuthContext/profiles).
- **Faz 5:** Görünürlük RLS (admin hepsini, normal online-only).
- **Faz 6:** Ana sayfa A-sınıfı yeniden tasarım + birleşik puan sıralaması.
- **Faz 8:** Baştan sona test.

## 2026-07-22 (6. oturum) — FAZ 2: PatiRun entegrasyonu

PatiRun (~12.500 satır TS, 2D pati yarışı, multiplayer) IDA GG Game Center'a taşındı — izole modül, `/patirun/*` route'u, Bildim tek kimliği.

### Yapılanlar
- **Kod taşıma:** PatiRun `src/{game,render2d,net,screens,lib,services,stores,config,components}` → `patirun/`. TS/TSX olduğu gibi (Vite/esbuild derler). İzole `patirun/tsconfig.json` (tip kontrolü sadece patirun/ içinde; ana build tsc kullanmaz).
- **Çift Supabase client sorunu çözüldü:** PatiRun kendi client'ını kuruyordu → `patirun/lib/supabase.ts` artık Bildim'in **tek paylaşılan client'ını** re-export eder (aynı storage'da iki GoTrue oturum kilidini çakıştırırdı).
- **Auth birleştirme (Faz 4 ile uyumlu):** kendi Google-OAuth ekranı (`AuthScreen.tsx`) **silindi**; `authStore` yeniden yazıldı — Bildim oturumundan `setBridgedUser` ile beslenir. `PatiRunApp.jsx` köprüsü: `useAuth()` → `pr_users` satırını upsert (FK hedefi + username'i profiles ile senkron) → authStore'u besler. **Ayrı kullanıcı adı seçme ekranı yok.** `setUsername` → `profiles.username` (paylaşılan kimlik, 23505 kontrolü); yarış avatarı (oyuna özgü kozmetik) `pr_users.avatar_id`'de kalır. appStore başlangıç ekranı `auth`→`menu`. `RunnerStrip` (AuthScreen'deydi) `components/RunnerStrip.tsx`'e taşındı. Ayarlar modalına "🏠 Oyun Merkezi'ne dön".
- **DB göçü:** `supabase/migrations/20260612000039_patirun_temel.sql` — PatiRun 001_schema+002_avatar birleşik, **tüm tablolar `pr_` önekli** (pr_users, pr_friendships, pr_blocks, pr_rooms, pr_races, pr_race_participants, pr_character_customizations, pr_character_xp, pr_badges, pr_user_badges, pr_best_times, pr_error_logs) + RPC `pr_apply_race_result`/`pr_cleanup_error_logs`. `auth.users` FK'ları korundu. Realtime: PatiRun broadcast/presence kullanır (postgres_changes yok) → publication değişikliği gerekmez. Kanallar namespace'lendi: `pr-quickmatch`, `pr-room:*`, `pr-online` (diğer oyunlarla çakışmaz).
- **CSS izolasyonu:** PatiRun'ın 2000 satır **global** CSS'i (`*`, `body`, `.btn`, `.toast`...) Bildim'i bozardı → scratchpad script'iyle tümü **`.pr-root` altına scope'landı** (`patirun/app/styles/patirun.css`, keyframes/media korunarak). App `<div className="pr-root">` içinde.
- **Entegrasyon:** `src/App.jsx` lazy `/patirun/*`; GameCenter'a 🐾 PatiRun kartı.

### Otonom kararlar
- **Bağımsız leaderboard** (prompt önerisi kabul): PatiRun kendi puan/rütbe/sıralamasını korur; sadece kimlik/giriş ortak. `pr_users.username` = profiles.username senkron kopyası (join'ler için; köprü + setUsername senkronlar).
- **Yarış avatarı ≠ kimlik avatarı:** PatiRun'ın avatars.ts kozmetiği oyuna özgü kaldı; kimlik fotoğrafı (profiles.avatar_url) paylaşılan. PatiRun UI'si foto avatar render etmediğinden yeniden yazılmadı.

### Doğrulama
- **Build temiz** — 239 modül; **PatiRun ayrı lazy chunk** (PatiRunApp ~178 kB js / ~33 kB css); Bildim/diğer oyun paketleri etkilenmedi.
- Gerçek multiplayer/eşleşme testi kullanıcıda (2 cihaz gerekir — prompt'ta belirtildi).

## 2026-07-22 (7. oturum) — FAZ 3: DriftGP (DidaGP) entegrasyonu

DriftGP (~9.400 satır TS, three.js/R3F 3D drift yarışı) IDA GG Game Center'a taşındı — izole modül, `/driftgp/*`, Bildim tek kimliği.

### Yapılanlar
- **Kod taşıma:** DidaGP `src/{game,net,store,lib,components,dev}` → `driftgp/`. İzole `driftgp/tsconfig.json`. App.tsx → `driftgp/app/DriftGpInner.tsx` (import yolları `./`→`../`).
- **Bağımlılıklar:** three@^0.185, @react-three/fiber@^9.6, @react-three/drei@^10.7 Bildim'e eklendi (sadece DriftGP lazy chunk'ında; ana bundle etkilenmedi).
- **Çift client çözümü:** `driftgp/lib/supabase.ts` Bildim'in paylaşılan client'ını re-export eder. Bildim client'ına `realtime.eventsPerSecond: 20` eklendi (DriftGP 15Hz pozisyon senkronu + Kafa Topu için; varsayılan 10/s dardı).
- **Auth (Faz 4):** DriftGP zaten `supabase.auth.getUser()` ile oturumu okur → Bildim oturumu aktifken **otomatik çalışır**, ayrı authStore köprüsü gerekmez. `DriftGpApp.jsx` köprüsü sadece görünen adı senkronlar: `profiles.username` → `profileStore.playerName`. ProfileScreen'den **Google giriş/çıkış UI kaldırıldı**; isim editörü artık **paylaşılan `profiles.username`**'i günceller (23505 kontrolü, min 3) → tüm oyunlarda yansır. "🏠 Oyun Merkezi'ne dön" eklendi.
- **HAYALET (Faz 3.5 — owner kısıtı kaldırıldı):** `cloudSync.uploadGhostIfBest` artık tek hesaba (OWNER_EMAIL) bağlı değil — **her authenticated oyuncunun en iyi turu**, buluttaki hayaletten hızlıysa yüklenir; hayalet adı = Bildim `profiles.username`. RLS de açıldı: `ghosts_insert/update_owner` (email eşitliği) → `ghosts_insert/update_auth` (authenticated herkes).
- **DB göçü:** `supabase/migrations/20260612000040_driftgp_temel.sql` — schema.sql `dg_` önekli (dg_profiles, dg_customizations, dg_race_results, dg_ghosts), tümü auth.users FK. Ghost RLS açık. Realtime: broadcast/presence (postgres_changes yok) → publication gerekmez. Kanallar `dg-` namespace'li: `dg-user:*`, `dg-room:*`, `dg-lobby`.
- **CSS izolasyonu:** 2088 satır global CSS `.dg-root` altına scope'landı (`driftgp/app/styles/driftgp.css`). App `<div className="dg-root">` içinde.
- **Entegrasyon:** `src/App.jsx` lazy `/driftgp/*`; GameCenter'a 🏎️ DriftGP kartı.

### Otonom kararlar
- **Bağımsız leaderboard** (prompt önerisi kabul): DriftGP kendi XP/rütbe/hayalet sistemini korur; kimlik ortak.
- **eventsPerSecond bump:** Bildim paylaşılan client'ına 20/s eklendi — realtime rate limiti yükseltmek yalnızca izin verir (Kafa Topu dahil mevcut mantığı bozmaz).
- **DriftGP oyun avatarı yok** (araç seçimi kozmetik); kimlik = profiles.username.

### Doğrulama
- **Build temiz** — 841 modül; **DriftGP ayrı lazy chunk** (DriftGpApp ~1.08 MB js / ~gzip ~300 kB — three.js doğası, yalnız /driftgp'de yüklenir). Ana Bildim bundle 521 kB'da kaldı (three.js sızmadı).
- Gerçek cihaz testi kullanıcıda: telefon eğim sensörü (yalnız HTTPS/deploy sonrası) + multiplayer.

## 2026-07-22 (8. oturum) — FAZ 6 (birleşik sıralama) + FAZ 5 (görünürlük)

### FAZ 6 — Birleşik puan sıralaması (profil ikonu davranışı)
- **Migration `20260612000041_birlesik_siralama.sql`:** `birlesik_siralama()` RPC (security definer, authenticated) — profiles + kafatopu_profiller + meyvekes_skorlar(sum en_iyi) + pr_users + dg_profiles(xp jsonb) LEFT JOIN, user_id üzerinden; oyun bazlı puan + toplam, botlar hariç, toplam desc, limit 100. (pr_/dg_/meyvekes migration'larından SONRA çalıştırılmalı.)
- **Yeni sayfa `src/pages/BirlesikSiralama.jsx`** (route `/siralama-genel`): oyun ikonlu sütunlar (Bildim/Kafa Topu/DriftGP/Meyve Kes/PatiRun) + Toplam; kendi satırın vurgulu; migration yoksa anlaşılır uyarı. Stiller styles.css `.sr-*`.
- **GameCenter profil ikonu** artık Bildim profilini değil bu **birleşik sıralamayı** açar (`/siralama-genel`).
- RUN kalıcı skor tutmadığından tabloda yok; Gladius (demo) dahil edilmedi (prompt listesiyle uyumlu).

### FAZ 5 — Görünürlük kuralı (oyuncu arama)
- **Migration `20260612000042_gorunurluk.sql`:** `profiles.last_seen` kolonu + index; `kalp_at()` RPC (kendi last_seen'i tazeler); `oyuncu_ara(p_arama)` RPC — **admin (hileli_mi()) herkesi**, normal oyuncu **yalnız online** (son 2 dk) olanları görür + `online` bayrağı döner. **profiles select RLS'i DEĞİŞTİRİLMEDİ** → sıralama/leaderboard herkese açık kalır (prompt şartı).
- **Heartbeat paylaşılan `AuthContext`'te** (tüm oyunlar tek kabuğu kullanır): oturum açıkken ~60 sn'de bir + görünürlük dönüşünde `kalp_at()`.
- **Bildim `FriendsPage` araması** doğrudan profiles sorgusundan `oyuncu_ara` RPC'sine geçti.
- **Kapsam kararı:** Kafa Topu'nun online-oyuncu listesi zaten presence tabanlı (doğası gereği online-only); PatiRun PlayersScreen (pr_users) opsiyonel takip işi olarak bırakıldı — kanonik kimlik araması (Bildim) kurala uygun.

### Doğrulama
- Build temiz (846 modül). Migration'lar kullanıcıda (SQL Editor).

## 2026-07-22 (9. oturum) — FAZ 8: otomatik test + doğrulama

- **Motor testleri:** Meyve Kes 11/11 ✓, Kafa Topu 27/27 ✓ (entegrasyon sonrası regresyon yok).
- **Çapraz-import izolasyonu:** 7 oyun (bildim/kafatopu/meyvekes/run/gladius/patirun/driftgp) taranıp doğrulandı — **hiçbir oyun başka oyunun klasöründen import etmiyor**. PatiRun/DriftGP yalnız `../../src/context/AuthContext` + `../../src/lib/supabase` paylaşıyor (tek kimlik için bilinçli paylaşım).
- **Build:** temiz (846 modül); 6 oyun ayrı lazy chunk (DriftGp/Gladius/KafaTopu/MeyveKes/PatiRun/Run) — birbirini şişirmiyor; three.js yalnız DriftGP chunk'ında.
- **Route'lar:** /, /bildim/*, /kafatopu, /meyvekes, /patirun, /driftgp, /run, /gladius, /siralama-genel + eski Bildim yolları geriye uyumlu.
- **Gerçek cihaz testleri kullanıcıda:** Meyve Kes kamera, DriftGP eğim sensörü (HTTPS), PatiRun/DriftGP/Kafa Topu multiplayer.

### Faz durumu özeti
- ✅ Faz 0 (Meyve Kes), 1 (Bildim taşıma), 2 (PatiRun), 3 (DriftGP), 4 (ortak kimlik), 5 (görünürlük), 6 (birleşik sıralama + kart/DEMO), 7 (PWA), 8 (otomatik test).
- ⏳ Faz 6 tam A-sınıfı ana sayfa görsel yeniden tasarımı: GameCenter zaten animasyonlu (radial-glow, cam header, gradient kart + shimmer/hover) — daha ileri parallax/motion opsiyonel cila olarak bırakıldı.

## 2026-07-22 (10. oturum) — Bağımsız repolardan taşıma doğrulaması + mobil kasma denetimi

### Taşıma doğrulaması (PC'deki eski bağımsız klasörler)
- Kullanıcının PC'sinde `Desktop/PatiRun` ve `Desktop/DidaGP` **ayrı bağımsız Vite projeleri + kendi `.git` repoları** olarak duruyordu (GitHub: `winegg420/PatiRun`, `winegg420/DidaGP`).
- **Karşılaştırma:** kaynak kod (patirun 70, driftgp 47 dosya), `pr_`/`dg_` migration'ları ve `.env` (URL/ANON — hub tek Supabase projesiyle zaten ortak) tam taşınmış. Eksik olan **tek fonksiyonel varlık**: DidaGP ses dosyaları.
- **DidaGP sesleri taşındı:** `public/sounds/` (26 wav, ~1.9 MB — motor aileleri muscle/race/sport + drift/nitro/crash/glass/pop/scrape). `driftgp/game/audio.ts` bunları `/sounds/*.wav` diye fetch ediyor; eksikken sentetik/prosedürel sese düşüyordu. Commit `b597204`.
- **Karar:** eski GitHub repoları (`PatiRun`, `DidaGP`) artık fonksiyonel gereksiz; **silme değil arşivle** önerildi (commit geçmişleri hub'a gelmedi — sadece son hal kopyalanmıştı). Vercel'de eski projeler varsa kapatılmalı.

### Mobil (iPhone) kasma denetimi — 7 oyun
- **Bulgu: kod tabanı zaten güçlü optimize.** Her gerçek-zamanlı oyunda adaptif FPS-tabanlı kalite ölçekleme + `devicePixelRatio` sınırı + dengeli timer/listener temizliği mevcut. `setInterval`'lar (kritik) her oyunda temizleniyor; oyun döngülerinde kare-içi GC-allocation yok.
  - **Kafa Topu:** `render.js` statik sahneyi cihaz pikselinde bir kez "pişiriyor" (`statikleriPisir`), gradient/emoji önbellekli, `alpha:false`, FPS<45→kalite düşür (120Hz ProMotion özel kod). iOS kasma zaten çözülmüş → **dokunulmadı** (CLAUDE.md "iOS cila korunur").
  - **Meyve Kes:** MediaPipe Tasks Vision (GPU delege) + senkron `detectForVideo` + `setTimeout` self-throttle + piksel bütçesi + adaptif çözünürlük + HUD 12fps. Zaten optimal → **dokunulmadı**.
- **Düzeltilen tek gerçek sorun — DidaGP gölge (commit `84e7cce`):** `quality.ts` gölgeyi yalnız `lowEnd` (mobil **ve** ≤4 çekirdek) cihazda kapatıyordu; 6+ çekirdekli orta-seviye iPhone'larda gölge açık kalıp `AdaptiveQuality`'nin çözünürlük düşüşüne dahil değildi. `DriftGpInner.tsx` `AdaptiveQuality`'e eklendi: çözünürlük dibe (scale≤0.55) indiği halde FPS<42 ise `gl.shadowMap.enabled=false` + ışıkların `castShadow=false` (bir kez, geri açılmaz — titreme önlemi). Gölge mobilde en pahalı geçiş; temas gölgesi (fake AO) kaldığından görsel kabul edilebilir.

### Doğrulama
- Build temiz (✓ 4.94s). Her iki commit `main`'e push edildi → Vercel production deploy.
- **Gerçek cihaz testi kullanıcıda:** iPhone'da DidaGP (gölge kapanınca akıcılık + gerçek motor sesleri), Kafa Topu, Meyve Kes.

## 2026-07-24 (11. oturum) — Meyve Kes "kol=bıçak" + tüm multiplayer senkron sertleştirmesi

Kullanıcı: (1) Meyve Kes'te el/kol komple bıçak olsun, kadraj dışına çıkıp girince anında senkron
olsun, agresif savurmayla hızlı kesebileyim; (2) multiplayer modlarda maçlar aynı anda başlasın,
takılma/gecikme olmasın.

### MEYVE KES — kesim modeli baştan kuruldu
- **Kılıç geometrisi (`engine/oyun.js`):** MediaPipe yalnız eli verir; kol, bilek→avuç ekseninin
  TERSİNE uzatılarak türetiliyor (`KOL_ORAN 3.4` × el boyu) ve parmak ucundan ileri bıçak ucu
  (`UC_ORAN 1.35`) ekleniyor. Sonuç: **kabzası omuz tarafında, ucu parmakların ötesinde tek parça
  dev bıçak**. Kesim, kılıç gövdesi boyunca 9 örnek + 5 parmak ucu = 14 noktanın kare-arası
  segmentleriyle test ediliyor (indeksler kareler arası tutarlı).
- **Agresif savurma:** el hızı > `SUPURME_HIZ` (360 px/s) ise kılıcın **tüm gövdesi** (kol dahil)
  de keser → iki algılama karesi arasındaki boşluğa düşen meyve artık kaçmıyor. `MAX_ORAN`
  0.75→1.05 (uzun savuruş artık "sahte" sayılmıyor), `MIN_SEGMENT` 9→6, `KILIC_KALINLIK` 30→34.
- **Gecikme telafisi (senkron hissi):** `eltakip.js` gerçek gecikmeyi ölçüyor (kare yaşı + çıkarım
  + yarım kare) ve `oyun.js` eli bu kadar ileri sarıyor (tavan 100px). Ayrıca çizimde 60 fps'e
  ekstrapolasyon (`RENDER_ILERI_MAX` 50ms) → algılama 25 fps olsa bile kılıç elin gerçek yerinde.
  **Çizilen bıçak ile kesen bıçak birebir aynı** (render artık ham landmark değil motor
  geometrisini kullanıyor).
- **Kadrajdan çıkıp girince:** MediaPipe eşikleri 0.4→**0.3** (model "emin olmayı" beklemiyor);
  algılama döngüsü `requestVideoFrameCallback` ile **kare-güdümlü** (en taze kare), aynı video
  karesi iki kez işlenmiyor (boşa CPU yanmıyor), kamera `frameRate ideal 60`.
- **Görsel:** `render.js`'e `kilicCiz` — kol boyunca 3 katmanlı (hâle/gövde/çekirdek) enerji palası;
  el iskeleti inceltildi (12px→3px stroke, 21→5 daire) → çizim maliyeti düştü. Bıçak izi artık
  **kılıcın ucundan** çıkıyor ve kalınlaştı.
- **Tempo:** spawn aralığı tekli 0.95→0.80/0.50, arkadaş 0.62→0.52/0.32 (bol meyve = savurmaya değer).
- **Test:** `meyvekes/_test/motor-test.mjs` 11→**16 test** (kol bıçağı, gecikme telafisi
  telafisiz/telafili karşılaştırması, kadraj dışı→geri dönüş) — **16/16 ✓**.
  Yeni araç: `meyvekes/_test/kilic-test.html` (kamera/oturum gerektirmeyen görsel test; Chrome'da
  doğrulandı: kılıç çiziliyor, meyveler kesiliyor, combo x3, NaN yok, konsol temiz).

### MULTIPLAYER — "aynı anda başla, takılma"
- **Ortak kök sebep (PatiRun + DidaGP):** başlangıç anı **epoch (`Date.now()`)** olarak yayınlanıyordu;
  cihaz saatleri sapınca geri sayım kayıyordu. Artık mesajda host'un gönderim anı (`t0`) da var,
  alıcı **"kalan süre"yi** alıp kendi saatine çeviriyor → saat farkı etkisiz.
  - `driftgp/net/multiplayer.ts`: `go` yayınına `t0`, alıcıda `raceGoAt = Date.now() + (goAt - t0)`.
  - `patirun/net/protocol.ts|roomClient.ts`: `StartMsg.t0` + alıcıda `recvAt`; yeni `ready`/`go`
    mesajları. `MpRaceScreen`: sahne kurulunca **"hazırım"**, host herkesi bekleyip (7 sn güvenlik
    zaman aşımı) `go` yayınlıyor, herkes geri sayımı aynı ana hizalıyor (DidaGP'deki kanıtlanmış
    desen). `startAt` yedek olarak duruyor (go düşerse yarış yine başlar, süre +2.5 sn'ye çıkarıldı).
- **Kafa Topu (host-otoriter, başlangıç zaten senkron) — takılma ve girdi gecikmesi:**
  - `net/interpolasyon.js`: sabit 120 ms tampon → **jitter'a adaptif** (70-260 ms; yukarı hızlı,
    aşağı yavaş uyum) + paket gecikirse **90 ms'ye kadar ekstrapolasyon** (donma yerine akış).
    Ekstrapolasyonda artık son İKİ paket kullanılıyor (eğim doğru).
  - `app/pages/MacPage.jsx`: misafirde **girdi gecikmesi maskeleme** — kendi kafan tuşa anında
    tepki verir (yalnız görsel yatay ofset, `0.94^kare` ile sönümlenir, ±1.1 kafa yarıçapı sınırı).
    Otorite host'ta kalır, sapma birikmez.

### Doğrulama
- Meyve Kes 16/16 ✓, Kafa Topu 27/27 ✓ (regresyon yok), `npm run build` temiz (846 modül, 4.95 sn).
- Chrome görsel testi: Meyve Kes kılıç/kesim (izole test sayfası). Hub'a giriş duvarı olduğundan
  oyun içi tarayıcı testi otomasyonda yapılamıyor.
- **Kullanıcıda kalan (yapılamayan):** gerçek iPhone testi ve 2 cihazlı multiplayer eşzamanlılık
  testi — bu ortamda kamera ve fiziksel cihaz yok.

---

## 11. Oturum — 24 Temmuz 2026: Kafa Topu 2 yeni kafa + tüm oyunlarda senkron/kasma denetimi

**Yapılanlar:**
- **Kafa Topu — 2 yeni foto kafa:** `emirali` (Emir Ali) ve `bedo` (Bedo) `public/heads/manifest.json`'a eklendi (verilen odak/yarıçap değerleriyle).
- **Kasma düzeltmesi (görsel boyutu):** Yeni görseller 2250×3000, ~2.8–3.3 MB idi → yavaş operatörde (Vodafone) yükleme/decode kasması. 825×1100'e küçültülüp JPEG'e çevrildi (tam foto, şeffaflık yok — daireye kırpıldığı için güvenli): **3.3 MB → 121 KB, 2.8 MB → 124 KB (~25×)**. Manifest `.jpg`'ye güncellendi. emirhan/kafa3 gerçek cutout (şeffaf) olduğundan PNG bırakıldı.
- **DidaGP senkron start bug'ı ("1 sn erken başlama"):** Kök neden — `raceGoAt` host'ta gönderim anında, istemcide ALIM anında ayarlanıyordu; fark = 'go' mesajının tek yönlü ağ gecikmesi (kötü mobil ağda ~1 sn). Çözüm: bekleme fazında NTP tarzı ping/pong ile saat-offset (host−self) ölçülür; 'go' epoch'u yerel saate çevrilir (`goAt − offset`) → mesajın uçuş süresinden bağımsız gerçek senkron. Offset ölçülemezse eski göreli yönteme düşer. (`driftgp/net/multiplayer.ts`)
- **PatiRun aynı bug:** `onGo` geri sayımı alım anına göre hizalıyordu (aynı tek-yönlü gecikme sapması). Aynı NTP saat-offset düzeltmesi `RoomClient`'a eklendi (`syncClock`, `hostToLocal`, `clockSynced`); `MpRaceScreen.onGo` offset-düzeltmeli. (`patirun/net/roomClient.ts`, `patirun/screens/MpRaceScreen.tsx`)
- **Kafa Topu:** host-otoriter model — geri sayım host'un simülasyon durumundan gelir, saat sapması/erken başlama mümkün değil. Zaten FPS'e göre otomatik çözünürlük, 60fps cap, opak canvas, wake lock, girdi öngörü ofseti var. Değişiklik gerekmedi.
- **Meyve Kes:** tek oyunculu (kamera + el takibi); realtime kanal yok, "senkron" = el-gecikme telafisi. İlgili değil.

**Test:** `npm run build` temiz (EXIT=0, DidaGP + PatiRun dahil tüm modüller derlendi).

**Kullanıcıda kalan test:** İki gerçek cihazla (özellikle farklı operatör/telefon) DidaGP ve PatiRun'da eşzamanlı start doğrulaması — bu ortamda 2 fiziksel cihaz yok. Yeni kafaların oyun içi görünümü (Kafa Topu karakter seçimi).

---

## 12. Oturum — 25 Temmuz 2026: Meyve Kes efekt onarımı + "Meyve Ye" modu

**Sorun (kullanıcı):** "Meyve kesme oyununda efektler silinmiş, elimi hareket ettirdiğimde ekranda
hiçbir şey olmuyor." Ayrıca yeni tek-oyunculu mod isteği: **Meyve Ye** (telefonu tek elle tut,
meyveler aynı şekilde gelir, ağzını açıp yutarsın).

**Kök neden:** Aynı gün yapılan "boşta bıçak yok" düzenlemesinde iz noktaları yalnız ALGILAMA
karesinde (+5 px hareket koşuluyla) ekleniyordu; aynı düzenlemede kasma için throttle 1.8×/150 ms'e
çıkarılmıştı. Yavaş cihazda algılama 8-12 fps'e düşünce 0.18 sn'lik iz ömrüne 1-2 nokta sığıyor,
çizim fonksiyonu `n < 2` iken hiçbir şey çizmiyordu → efektler tamamen kayboldu.

**Yapılanlar (hepsi `meyvekes/`):**
- **İz üretimi çizim hızına taşındı (60 fps):** ölçüt mesafe yerine **el hızı**; el görülmeyeli
  0.12 sn'den fazlaysa durur. Ömür 0.30 sn. Duran elde hâlâ iz yok (istenen davranış korundu).
- **`izCiz` yeniden yazıldı:** Catmull-Rom yumuşatma + 3 katman additif pala (mavi hale, iç parıltı,
  beyaz gövde); eski formülde iz ucunun kalınlığı 0'a düşüyordu, düzeltildi.
- **Kesim efektleri:** yön flaşı, halka dalgası, ekran sarsıntısı, titreşim; yarımlar kesim
  çizgisine dik ayrılıyor ve kesik yüzeyi bıçağın açısında duruyor.
- **Ses:** `engine/ses.js` (WebAudio sentezi, dosya yok) + HUD'da 🔊/🔇. Motor DOM'suz kalsın diye
  `oyun.sesler` olay kuyruğu OyunPage'de tüketilir.
- **Yeni mod Meyve Ye:** `engine/yuztakip.js` (FaceLandmarker, 4 ağız noktası), histerezisli ağız
  açıklığı, ağza **balistik nişan** alan meyve fırlatma, ağız halkası + yutma animasyonu.
  Migration `20260612000043_meyvekes_yeme_modu.sql` (mod check + RPC'lere `'yeme'`).
- `eltakip.js` throttle 1.5×/130 ms (iz artık algılamaya bağlı olmadığı için kesim isabeti arttı).

**Test:** Meyve Kes motor testi **31/31 ✓**, `npm run build` temiz. Kamerasız görsel test sayfası
eklendi (`meyvekes/_test/yeme-test.html`). Chrome eklentisi bu oturumda bağlı olmadığından tarayıcı
otomasyonu yapılamadı.

**Migration:** `npx supabase db push` 403 verdi (CLI oturumunun yetkisi yok) → SQL aynı gün
**Supabase Dashboard → SQL Editor**'den elle uygulandı ve başarılı oldu. Bu projede migration yolu
budur; CLI push'a güvenme.

**Kullanıcıda kalan:** Gerçek kamera testi — iz görünüyor mu, kesim hissi, ağızla yutma isabeti, kasma.

## 2026-07-25 — DidaGP yetişme sistemi, Meyve Kes worker çıkarımı, tüm oyunlarda senkron/kasma denetimi

Kullanıcı talebi: (1) DidaGP'de birinci fark atıyor, arkadakiler yetişemiyor — arkadakinin nitrosu
hızlı dolsun, arabası hızlansın, birinci fark atamasın; (2) hiçbir oyunda kasma/donma/senkron
bozulması olmasın, maçlar aynı anda başlasın; (3) Meyve Kes'te kol kadrajdan çıkıp hızlıca girince
oyun tanımıyor.

### 1) DidaGP — YETİŞME SİSTEMİ 2.0 (`driftgp/`)
Yardım artık sadece nitro deposunu doldurmuyor, **fiziğe** işliyor: geride kalan aracın üst hızı,
ivmesi, viraj tutunması artıyor; duvar/kayma cezaları azalıyor (acemi sürücü farkı virajda
kaybettiği için sadece hız yardımı yetmiyordu). Eşikler daraltıldı: yardım ~0.5 sn geride başlıyor,
**~4 sn geride tavana** oturuyor → denge noktası 11 sn'den 4 sn'ye indi. Ek olarak **lider tasması**
(1. sıradaki araç, takipçiye fark attıkça hafifçe kısılır) ve **slipstream** (öndeki aracın hava
boşluğunda ek güç) eklendi. Son turda yardım tamamen kesilmiyor, yarıya iniyor.
Başsız doğrulama (`driftgp/_test/yetisme-test.mts`): usta vs acemi sürücü bitiş farkı
**9.68 sn → 2.63 sn**, maks fark **0.188 → 0.071 tur**, liderin süresi yalnız %1.6 bozuluyor ve
usta sürücü yine kazanıyor (yardım hile değil). Ayrıntı: `driftgp/PROGRESS.md`.

### 2) Meyve Kes — çıkarım Web Worker'a taşındı (`meyvekes/`)
`detectForVideo` ana thread'de senkron çalıştığı için algılama kendini kısmak zorundaydı (zayıf
cihazda ~7 algılama/sn, 130 ms'ye kadar kör pencere) — "kol geri girince tanımıyor" ve "kasma"
şikâyetlerinin kök nedeni buydu. Yeni `engine/takip-worker.js` + `engine/takip-cekirdek.js` ile
çıkarım ayrı thread'de koşuyor, **kısma kaldırıldı** (30-60 algılama/sn) ve render 60 fps kalıyor.
Aynı worker el (HandLandmarker) ve yüz (FaceLandmarker) modellerini kuruyor → Meyve Ye modu da
faydalanıyor. Üç kademeli emniyet: worker yoksa/kurulamazsa eski ana-thread yolu, kurulup sonuç
üretmezse çalışma anında geri düşüş, GPU olmazsa worker içinde CPU.
Motor tarafında **kadraj dışı köprüsü**: el kaybolunca kimliği 0.4 sn saklanıyor, geri girdiğinde
aynı kimliğe bağlanıyor → dönüş savurması İLK karede kesiyor (istismar önlemi: köprü segment
tavanı köşegenin %50'si). Test: **36/36 ✓**. Ayrıntı: `meyvekes/PROGRESS.md`.

### 3) Tüm oyunlarda senkron/kasma denetimi
- **PatiRun (gerçek hata bulundu):** host, her dolgu botu için ayrı 10 Hz pozisyon akışı
  gönderiyordu → 4 koşucuyla 40 msg/sn, Supabase istemci sınırı 20/sn → mesajlar düşüyor, uzak
  koşucular ışınlanıyordu. Pozisyonlar artık kare sonunda **tek toplu mesajda** (`posc`) gidiyor.
- **Kafa Topu:** yayın hızı 20/sn ile sınırla TAM örtüşüyordu (jitter'da mesaj düşme riski) →
  ~18/sn'ye çekilip pay bırakıldı. Host-otoriter model gereği başlangıç zaten senkron.
- **DidaGP:** senkron start yoklaması 50 ms → 20 ms (yeşil ışık sapması azaldı).
- **Aynı anda başlama durumu:** DidaGP ve PatiRun'da `ready` + NTP saat-offset + `go` el sıkışması
  mevcut ve doğrulandı; Kafa Topu host-otoriter olduğu için geri sayım host simülasyonundan gelir
  (misafir kendi saatiyle başlangıç hesaplamaz). Meyve Kes/RUN/Gladius tek-oyunculu.
- **dt koruması:** dört motorda da kare sıçraması sınırlı (DidaGP 1/20 sn, Kafa Topu 250 ms +
  sabit 60 Hz alt adım, PatiRun 0.05 sn, Meyve Kes 0.05 sn) → sekme arka plana alınınca fizik
  patlaması yok. Dördünde de FPS'e göre otomatik çözünürlük düşürme mevcut.

### Doğrulama
`npm run build` temiz. Başsız testler: Meyve Kes 36/36, Kafa Topu 27/27, DidaGP yetişme 7/7.
**Kullanıcıda kalan (otomasyonda yapılamaz):** gerçek kamera + iPhone ile Meyve Kes testi;
2 cihazla DidaGP/PatiRun/Kafa Topu online maç testi. `patirun/game/__tests__` vitest gerektiriyor,
hub'da vitest kurulu değil.

### Aynı gün düzeltme — Meyve Kes: duran el kesiyordu

Worker'lı çıkarımın yan etkisi: algılama ~15 Hz'den 60 Hz'e çıkınca landmark titremesi (2-5 px)
kare başına "gerçek hareket" gibi göründü, gecikme telafisi de bunu ~3 kat büyüttü → **duran elin
kılıcı önünden geçen meyveleri kesiyordu.** Kesim izni artık anlık kare mesafesine değil 0.12 sn'lik
pencerede biriken NET (yönlü) yer değiştirmeye bakıyor; eşikler ekran köşegenine oranlı; pencere
dolmadan anlık hıza güvenilmiyor. Kapı kapalıyken kesim + gecikme telafisi + bıçak izi birlikte
kapanıyor. Test 39/39 (yeni: ±4 px titreyen duran el, hem masaüstü hem telefon çözünürlüğünde,
meyve kılıcın tam üstünde dururken 1 sn boyunca kesmiyor). Ayrıntı: `meyvekes/PROGRESS.md`.

---

## 26 Temmuz 2026 — Kafa Topu: iPhone kasmasının kalan kök nedenleri

24 Temmuz'daki statik sahne pişirmesi arka planı çözmüştü, ama **kare başına kalan iş** hâlâ
iOS Safari'nin iki en pahalı canvas yolundan geçiyordu. Kök nedenler ve ölçüm (yeni
`kafatopu/_test/cizim-test.mjs`, canvas komutlarını sayan mock):

| kare başına | eski | yeni |
|---|---|---|
| `clip()` (daire kırpma) | 2 (1v1) / 4 (2v2) | **0** |
| büyük ölçek-küçültmeli `drawImage` | 2 / 4 | **0** |
| canvas komutu (foto kafa) | 132 | 112 |
| canvas komutu (kurgusal kafa) | 178 | 125 |
| tam ekran blit | 5 | 4 (zayıf cihazda 1) |

**Asıl kalem — kafa sprite pişirmesi:** kafa her karede daire `clip()` içine alınıp 1100 px
PNG'den ~150 px'e ölçekleniyordu (kurgusal kafalarda ~80 path komutu). Safari'de non-rect clip
maske katmanı ayırıp GPU komut kuyruğunu boşaltıyor — **oyuncu başına, kare başına**. Artık kafa
küçük bir tuvale bir kez pişiriliyor, kare başına tek `drawImage` kalıyor.

Diğerleri: düz arka plan modu (parallax kapalı → 4 tam ekran blit 1'e iner), çizim süresini
ölçen uyarlanabilir kalite merdiveni (eski ölçüt yalnız rAF hızına bakıyordu, 120Hz ProMotion'da
zayıf durumu hiç görmüyordu), iOS `visualViewport resize` fırtınasında canvas'ın gereksiz yeniden
tahsisi, kare başına gereksiz `clearRect`, iPhone'da desteklenmeyen fullscreen API'sinin her
dokunuşta boşa denenmesi, ve maçtan çıkışta ~25 MB pişirik belleğinin hemen bırakılması.

Fizik/skor/ELO/ağ mantığına dokunulmadı: `motor-test.mjs` 27/27 ✓, `cizim-test.mjs` 13/13 ✓,
build ✓. Ayrıntı: `kafatopu/PROGRESS.md`.

**Kullanıcıda kalan:** gerçek iPhone'da maç testi (antrenman botu + online 1v1).

---

## 30 Temmuz 2026 — Kafa Topu: yeni kafa "ege" + bot zorluk dengesi

**1) Yeni foto kafa (`ege`):**
- İda ham fotoğrafı bıraktı (`public/heads/ege.png`, 2250×3000, 4.4 MB, arka plan dolu).
- emirali/bedo ile aynı hattan geçirildi: rembg (`u2net_human_seg` + alpha matting) ile arka
  plan şeffaf → bağlı-bileşen temizliği (40 adacıktan en büyüğü kaldı) → yarı saydam saçak
  bandı sertleştirildi → 760 px uzun kenar, PNG optimize. **4.4 MB → 282 KB.**
- Manifest odak değerleri: İda'nın verdiği `0.50 / 0.36 / 0.34` daire önizlemesinde ağzı ve
  çeneyi kesiyordu (fotoğrafta kafa kadraja göre büyük). `kafaCizim.js`'in daire kırpma
  matematiğini birebir simüle eden önizleme scripti ile ölçülüp **`odakX 0.48, odakY 0.42,
  yaricap 0.46`** yapıldı — saç üstünden çeneye tam kafa, bedo/emirali ile aynı çerçeveleme.
- Araç kalıcı değil (scratchpad): `ege-kes.py` (arka plan hattı) + `daire-onizle.py` (görsel
  doğrulama). Yeni kafa eklerken aynı iki adım tekrarlanmalı: kes → daire önizle → odak ayarla.

**2) Bot fazla güçlüydü ("kimse yenemiyor"):**
- Kök neden: 120 ms tepki (insanüstü), küçük hata payı (26), menzilde %60 vuruş **ve** kale
  ağzında koşulsuz temizleme (`g.vur = true`) — yani asla açık vermiyordu.
- `engine/bot.js` tek dosyada zayıflatıldı (fizik/skor/ağ mantığına dokunulmadı):
  tepki 120→205 ms, hata 26→44, vuruş menzili ×0.9→×0.84, balistik tahmin katsayısı
  2.2→1.8, menzilde vuruş %60→%45, acil temizleme koşulsuz→%82, zıplama fırsat başına %72
  (karar anında kilitlenir, tick başına titremez), yetenek kullanımı %2→%0.8, ve yeni
  **dalgınlık** mekaniği (karar başına %8 ihtimalle 380 ms hiç girdi üretmez → oyuncuya
  gerçek boşluk açılır).
- Ölçüm (eski bot vs yeni bot, 20 maç, 1v1): **eski 20.4 — yeni 8.3** (maç başı ortalama).
  Önceki simetrik eşleşme ~19-19 idi; bot artık belirgin şekilde yenilebilir ama pasif değil.

**Test:** `motor-test.mjs` 27/27 ✓, `npm run build` temiz ✓.
**Kullanıcıda kalan:** Karakter ekranında Ege kafasının görünümü + antrenman maçında botun
yeni zorluk hissi (çok kolaylaştıysa `BOT` bloğundaki değerler tek yerden ayarlanabilir).

**Düzeltme (aynı gün):** Ege kadrajında tişört görünüyordu (`yaricap 0.46` gövdeyi de alıyordu).
Izgara overlay ile kafa sınırları ölçüldü (570×760 görselde: saç üstü y≈133, çene y≈490,
kulaklar x≈150-405) → **`odakX 0.49, odakY 0.42, yaricap 0.355`**. Daire artık saç üstünden
çeneye sadece kafayı alıyor, omuz/tişört kadraj dışında.

---

## 8 Ağustos 2026 — Meyve Kes: agresif oynanış (kasma + salınımlı hareket + kadraj dışı)

Kullanıcı: *"oyun her aşamada kasıyor; ellerim kamera görüşünden çıkıp geri girdiğinde bıçak
olarak kullanamıyorum. İstediğim konsept: insanlar kalori yaksın — çılgınca dans eder gibi,
yumruk atar gibi kollarını sallasın ve oyun bunların hepsini algılasın, kasma olmasın."*

### Kök neden 1 — SALINIMLI hareket kapıyı hiç açmıyordu (asıl "algılamıyor" nedeni)

Hareket kapısı `HAREKET_PENCERE` (0.12 sn) boyunca biriken **NET (yönlü)** yer değiştirmeye
bakıyordu. Yumruk/dans hareketinde el ileri-geri gider: pencereye tam bir salınım periyodu
sığdığında net yol **≈ 0** çıkar → kapı KAPALI → kesim de, gecikme telafisi de, bıçak izi de
üretilmez. Yani oyuncu ne kadar hızlı sallarsa o kadar az kesiyordu.

- **Çözüm:** kapı ölçütü artık pencere içindeki konum **YAYILIMI** (bbox köşegeni):
  `YAYILIM_ORAN = 0.035 × ekran köşegeni`, pencere 0.14 sn. Yayılım yön bağımsızdır → tek
  yönlü savurma da salınım da geçer; ±4 px landmark titremesi ≈ 11 px yayılım üretir, eşiğin
  (telefonda ~32 px) çok altında kalır → **duran el hâlâ kesmiyor**.
- Yön/hız (telafi + iz + gövde süpürmesi) ayrı ve **kısa** pencereden okunur (`HIZ_PENCERE`
  0.04 sn): uzun pencere ortalaması salınımda yönü sıfırlıyordu.
- `SUPURME_ORAN` 0.36 → 0.28, `KILIC_KALINLIK` 34 → 38 (agresif tempoda isabet payı).

### Kök neden 2 — kadraj dışına çıkan kol geri gelince "bıçak olmuyordu"

Üç katman vardı: (a) `KAYIP_SURE` 0.4 sn çok kısaydı — çılgın tempoda kol saniyelerce dışarıda
kalıyor, kimlik düşüyor, dönen el hızsız/segmentsiz yeni kimlik doğuyordu; (b) köprü kurulsa
bile dönüş karesinde hareket penceresinde tek örnek kalıyordu → kapı kapalı; (c) eşleştirme ham
konuma bakıyordu → hızlı savurmada iki el kimlik takası yapabiliyordu.

- `KAYIP_SURE` 0.4 → **1.2 sn**.
- Dönüşte kayıp-öncesi konum `KOPRU_REF_DT` (0.05 sn) yaşında bir örnek olarak geçmişe konur →
  kapı **ilk karede** açılır, yön = kadraja giriş yönü.
- Kayıp `KOPRU_SEGMENT_SURE`'yi (0.25 sn) aşarsa iki konum arası "ışınlanma segmenti" kesim
  yapmaz (el arada nereden geçti bilinmiyor); kesimi yalnız kılıcın **o anki gövdesi** yapar →
  dönüş karesinde kolun üstündeki meyve kesilir, uzaktaki meyve kesilmez.
- Eşleştirme **hız-tahminlidir** (son hızla ileri sarılmış konuma en yakın kimlik); kayıp elde
  tahmin yapılmaz (kadraj dışında yön değişmiş olabilir).
- Meyve fırlatma kenar payı ekrana oranlı (`max(60, W×0.1)`) — meyve en dış şeride düşünce
  oyuncu kolunu kadrajın dışına uzatmak zorunda kalıyordu.

### Kök neden 3 — kasma (ana thread bütçesi)

- **Kare kopyalama:** worker'a giden `createImageBitmap` kamera çözünürlüğündeydi. Artık uzun
  kenar 480'e, **en-boy oranı korunarak** küçültülür (`HEDEF_UZUN_KENAR`, `resizeQuality:'low'`;
  desteklemeyen tarayıcıda otomatik tam kareye döner). Model girdiyi zaten ~200 px'e indirdiği
  için doğruluk değişmez, ana thread kopyası ve GPU yüklemesi belirgin ucuzlar.
- **Çizim:** altın meyvenin `shadowBlur`'ü (meyve başına ayrı blur geçişi) → tek additif halka;
  parçacıklar tek geçişte çizilir (parçacık başına `save/restore` yok) + `MAX_PARCACIK` 260
  tavanı; bıçak izinin geniş additif hale katmanı düşük kalitede kapanır.
- **Canvas/HUD:** `desynchronized: true`; piksel bütçesi 1.3M → 1.1M; adaptif kalite ölçümü
  2 sn → 1 sn (alt sınır 0.55 → 0.5); HUD state'i yalnız **değer değiştiğinde** yazılır
  (eskiden 12 fps'te her seferinde yeni obje → gereksiz React ağacı yeniden çizimi).
- **Ses:** aynı karede aynı türden en fazla 2 efekt (combo'da 4 kesim = 4 WebAudio zinciri).
- **Teşhis:** rozette artık **algılama frekansı (Hz)** ve `⚠` (worker kurulamadı, ana-thread
  yedeğine düşüldü) görünüyor. Kasma şikâyetinde ilk bakılacak yer burası: `⚠` varsa o cihazda
  çıkarım ana thread'de koşuyor demektir.
- Menüde model + wasm için düşük öncelikli `prefetch` (açılış beklemesi kısalır).

**Test:** `node meyvekes/_test/motor-test.mjs` → **43/43 ✓** (yeni: 7 Hz salınımlı yumruk
hareketi kesiyor, 0.9 sn kadraj dışı kalıştan dönüşte gövde kesiyor, aynı yerden dönen duran el
kesmiyor, art arda 5 çıkış/girişin hepsinde kesim). `npm run build` temiz.

**Kullanıcıda kalan:** gerçek kamera testi — (1) rozetteki Hz değeri (30-60 iyi, 10-15 düşük)
ve `⚠` var mı, (2) kolları çılgınca sallarken kesim isabeti, (3) kol çıkıp girince ilk
savurmanın kesmesi, (4) duran elin hâlâ kesmediği.

## 2026-08-12 — Gölge Boks (yeni oyun, 8. modül)

- Yeni izole modül `boks/` — kamera + **el (HandLandmarker) ve vücut (PoseLandmarker)** takibiyle
  gölge boksu antrenmanı. Hem oyun hem antrenman/analiz aracı; prototip değil, ticari sürüm hedefi.
- **Mimari:** tek kamera akışı → iki ayrı worker (el tam hızda / poz ~30 Hz kısılmış) → ana thread
  yalnız kare kopyalar. Meyve Kes'in worker altyapısı **izole kopyalandı** (meyvekes/ değişmedi).
- **Yumruk tanıma:** kol başına durum makinesi (bekle→itme→darbe→toparla), 6 boks numarası;
  kameraya doğru düz yumruk için el ölçeğinin büyüme hızı "etkin hız"a katılır (jab/cross bu
  olmadan ıskalanıyordu). Solak duruşta numaralandırma aynalanır.
- **Modlar:** Serbest · Koç (kombinasyon dizisi + TTS sesli koç) · Savunma (kaçış/blok) · Ritim.
  Zorluk: kolay 2×90 sn → pro 5×45 sn, mola 12-15 sn, ısınma fazı.
- **Antrenör Modu:** 8 boyutlu stil vektörü, 8 arketip, 12 maddelik zayıflık kataloğu (teknik
  tavsiyeli), round/oturum/kariyer raporu, koçluk geri bildirim döngüsü (zayıflık düzelince fark
  eder), **248 profesyonel dövüşçüyle** stil eşleştirmesi (yalnız kamuya açık stil özellikleri).
- **Adaptif kapsam ilkesi:** analiz yalnız kameranın gördüğü bölgelere dayanır; kalça/bacak
  kadrajda değilse duruş-denge analizi hiç üretilmez (varsayım yok).
- **Dürüstlük ilkesi:** vuruş "şiddeti" kişinin kendi ortalamasına normalize edilmiş görece skor
  (Newton iddiası yok); kalori MET tabanlı, kilo yoksa "tahmini" etiketli.
- **DB:** `20260612000044_boks_temel.sql` — 8 tablo (`boks_` önekli), RLS, 5 security-definer RPC.
  `boks_oturum_kaydet` oturum+round+kariyer+streak+skor+sezon+zayıflık+rozeti atomik yazar.
- **Büyüme:** Story paylaşım kartı + combo klibi (MediaRecorder), streak, 18 rozet, 3 kürasyonlu
  program, aylık sezon ligi, seviye testi (otomatik zorluk kalibrasyonu), teknik rehberi,
  çevrimdışı kuyruk, alan-güvenliği kontrolü, sağlık/postür uyarıları.
- **Hub:** `src/App.jsx`'e lazy `/boks/*` rotası, `GameCenter.jsx`'e 8. kart ("Gece Antrenmanı"
  paleti — hub'ın mor kimliğinden bilinçli ayrışma).
- **Doğrulama:** `node boks/_test/motor-test.mjs` 72/72 geçti; `npm run build` başarılı
  (BoksApp ayrı chunk, 140 kB / 48 kB gzip).
- Ayrıntı ve kararlar: **`boks/PROGRESS.md`** + `boks/CLAUDE.md`.

## 2026-08-12 — Gölge Boks: radikal performans revizyonu

Kullanıcı geri bildirimi ("kamera kasıyor, akıcı değil, eldivenleri sil, oyun akmıyor")
üzerine `boks/` modülünde mimari değişiklik:

- **İki takip modeli → tek model.** `HandLandmarker` kaldırıldı (`boks/engine/eltakip.js`
  silindi); el ölçeği artık poz modelinin parmak köklerinden (17/18, 19/20) okunuyor.
  CPU ~yarıya indi, poz kısılmadan koşuyor.
- Kamera 960×540@60 → 640×360@30; worker karesi 320 px; canvas bütçesi 900 k.
- AR eldiven overlay'i silindi, yerine ucuz "bilek nişanı" geldi (menüdeki eldiven ayarı da
  kaldırıldı; DB kolonları uyum için duruyor).
- Yumruk tespit eşikleri ~%20 gevşetildi, pad toleransı 0.62→0.85, pad ömürleri +%25,
  ısınma 18→10 sn — "vurdum ama saymadı" ve bekleme hissi giderildi.
- Doğrulama: `node boks/_test/motor-test.mjs` 72/72, `npm run build` başarılı.

Detay: `boks/PROGRESS.md`.

## 2026-09-08 — Meyve Kes: kasma/gecikme kök nedeni (module worker → klasik worker)

Worker `{ type: "module" }` ile açıldığı için MediaPipe'ın `importScripts` çağrısı her cihazda
patlıyor, oyun sessizce ~10 Hz ana-thread yedeğine düşüyordu. Worker klasik tipe çevrildi
(ölçüm: worker/GPU 66 Hz), HUD rozeti "xx Hz · worker/GPU" oldu, kamera canvas'a kopyalanmak
yerine CSS katmanında gösteriliyor, kesim efekt bütçesi kısıldı. Aynı hata `boks/` worker'ında da
vardı, düzeltildi. motor-test 43/43 (boks 93/93), build temiz. Detay: `meyvekes/PROGRESS.md`.
- 2. tur (aynı gün): telefonda 13-14 Hz → rVFC basamaklanması kırıldı ("boşalınca hemen gönder"
  + bitmap ön hazırlığı), mobilde 352 px kare, worker'da GPU/CPU delege yarışı, rozete çıkarım ms.
  Yeni `meyvekes/_test/cekirdek-test.mjs` 11/11 (sanal saat: 45 ms çıkarımda 14.9 → 22.1 Hz).

## 2026-09-08 — Bildim: Faz 1 — Lig + kategori veritabanı (`20260612000045_lig_ve_kategori.sql`)

Google Play hedefiyle üç farklılaştırıcının DB tarafı kuruldu: **kategori seçmeli yarış**,
**şehir/ülke ligi**, **küresel sıralama + rank kasma**. Tek migration, mevcut şema bozulmadı,
puanlama mantığına dokunulmadı.

**Mevcut durum tespiti (uydurma değil, migration'lardan okundu):**
- pg_cron **var** ve kullanılıyor (`bildim-turnuva-baslat`, `bildim-bot-oyna`, …).
- Haftalık sıfırlama **vardı**: `bildim-hafta-sifirla` (`0 21 * * 0` = Pazartesi 00:00 TSİ) ama
  yalnızca `update profiles set puan_hafta = 0` yapıyordu → geçmiş kayboluyordu. Bu iş
  **unschedule edilip** `haftayi_kapat()` ile değiştirildi (önce arşivle + rozet, sonra sıfırla).
- `create_challenge`, `create_group_challenge`, `create_hizli_mac` zaten `p_kategori` alıyordu;
  eksik olan, seçimin **soru havuzuna** yansımasıydı (görülmüş soru/dil filtresi yoktu).
- `award_badge` var → haftalık rozetler onun üzerinden veriliyor.

**Kararlar ve nedenleri:**
- **Şehir/ülke listesi = tablo (`ulkeler`, `sehirler`), frontend sabiti değil.** Gerekçe: lig
  sıralaması konuma dayanıyor ve konum haftada 1 kez değişebiliyor; doğrulama istemcide
  yapılamaz. Tablo sayesinde `profil_konum_kaydet()` sunucuda doğruluyor ve yeni ülke eklemek
  deploy gerektirmiyor. Bayrak emojisi ISO kodundan istemcide türetiliyor (kolon yok).
  TR için 81 il yüklendi; şehir listesi olmayan ülkelerde serbest metin (2-40 karakter).
- **Konum kilidi:** `profiles.konum_degisti_at` + 7 gün. Aynı değer tekrar gönderilirse kilit
  harcanmıyor. `profiles` üzerinde authenticated'a sadece (username, avatar_url) update yetkisi
  olduğu için `ulke/sehir` doğrudan yazılamaz — yalnızca RPC.
- **Soru seçimi tek noktada: `soru_sec(kategori, adet, oyuncular[], dil)`.** Görülmemiş sorular
  önce, bitince en eski görülenler (asla boş dönmez); yetersizse önce kategori, sonra dil
  gevşetilir. 1v1'de iki oyuncunun ikisi de, grup/hızlıda tüm katılımcılar dizide.
  Bağlandığı yerler: `respond_challenge`, `quick_match`, `respond_group_challenge`,
  `respond_hizli_davet`, `start_tournament` (karışık kalır, sadece dil) ve **`bot_oyna`'nın 3
  seçim noktası** (bot maçlarında da tekrar olmasın diye fonksiyon birebir kopyalanıp yalnızca
  seçim satırları değiştirildi).
- **`gorulen_sorular` kaydı soru gösterildiğinde** yazılıyor (maç bitince değil): 4 soru RPC'si
  (`get_match_question`, `get_group_match_question`, `get_hizli_soru`, `get_tournament_question`)
  `gorulen_kaydet()` çağırıyor, `on conflict do nothing` ile ilk gösterimde bir kez yazıyor.
- **Kota:** `mac_kotasi_kontrol()` — saat başına 30 maç başlatma (matches/group/hızlı toplamı).
  `hileli_mi()` olan hesap (kurucu/geliştirici) muaf. Puanlamaya dokunulmadı.
- **`quick_match` artık `p_kategori` alıyor** (varsayılan null). Eski `quick_match()` imzası
  drop edildi; istemci parametresiz çağırdığında varsayılan devreye giriyor.
- **`get_categories` 3 kolon dönüyor:** `kategori, soru_sayisi, gorulen_sayisi` (kategori
  kartlarındaki "çözdüğün %" için). Kullanıcının `profiles.dil` diline göre filtreliyor.
- **Turnuva karışık kaldı** (istek gereği), yalnızca dil filtresi uygulanıyor.

**Yeni nesneler:** `ulkeler`, `sehirler`, `gorulen_sorular`, `lig_arsiv` tabloları;
`profil_konum_kaydet`, `gorulen_kaydet`, `soru_sec`, `mac_kotasi_kontrol`, `haftayi_kapat`,
`haftalik_sonuc_bildir`, `lig_siralama(kapsam, donem)`, `sehir_lig_sirasi(donem)` fonksiyonları;
`hafta_1/2/3`, `sehir_krali` rozetleri; konum/dil/kota indeksleri.
Yeni cron: `bildim-hafta-kapat` (Pazar 21:00 UTC) ve `bildim-hafta-bildir` (Pazartesi 06:00 UTC).

**Senin yapman gerekenler (Faz 1):**
1. `supabase/migrations/20260612000045_lig_ve_kategori.sql` dosyasını Supabase Studio → SQL
   Editor'de **tek parça** çalıştır (44'ten sonra, tek dosya, sıra önemli).
2. Çalıştıktan sonra kontrol: `select jobname, schedule from cron.job order by jobname;`
   → `bildim-hafta-sifirla` **gitmiş**, `bildim-hafta-kapat` + `bildim-hafta-bildir` **gelmiş**
   olmalı. Gelmediyse pg_cron uzantısı kapalıdır, haber ver.
3. Push bildirimi için `send-push` Edge Function ve `x-cron-secret` zaten mevcut; ek iş yok.

`npm run build` temiz (Faz 1'de frontend değişmedi).

## 2026-09-08 — Bildim: Faz 2 — Lig ve kategori arayüzü

**Yeni dosyalar:** `bildim/lib/konum.js` (bayrak emojisi ISO kodundan, konum kilidi kalan
süre, hafta bitişi = Pazar 21:00 UTC — sunucudaki cron ile aynı an, kısa süre metni),
`bildim/components/KonumSecici.jsx` (mod="modal" zorunlu ilk giriş / mod="kart" profil).

**Değişen dosyalar:**
- `bildim/pages/Home.jsx` — ilk girişte `profile.ulke` boşsa kapatılamayan konum modalı;
  hero altında şehir/ülke/dünya sıra rozetleri (`benim_lig_durumum` RPC, tek satır — 3 ayrı
  sıralama çekmemek için); haftalık lig geri sayımı + şehrin ülke içi sırası; `lig_arsiv`ten
  okunan "geçen hafta X. oldun" uygulama içi şeridi (localStorage ile bir kez gösterilir).
- `bildim/pages/LeaderboardPage.jsx` — yeni sayfa açılmadı, mevcut sayfa genişletildi.
  Üst sekmeler ŞEHİR / ÜLKE / DÜNYA / ARKADAŞ (arkadaş sekmesi eski davranışını korudu),
  alt sekmeler BU HAFTA / TÜM ZAMANLAR. İlk 3 podyum, satırlarda avatar + rütbe rozeti +
  ülke bayrağı + şehir, kendi satırı vurgulu ve **sticky olarak altta sabit**. Şehir
  sekmesinde `sehir_lig_sirasi` ile "Balıkesir bu hafta ülkende 12." şeridi. Konumu olmayan
  oyuncuya şehir/ülke sekmesinde seçim çağrısı gösteriliyor.
- `bildim/pages/ChallengesPage.jsx` — kategori çipleri kategori **kartlarına** dönüştü:
  kategorideki toplam soru sayısı + oyuncunun çözdüğü yüzde (ilerleme çubuğuyla).
  Seçimin 1v1/grup/hızlı modun hepsinde geçerli olduğu başlıkta yazıyor (kod zaten aynı
  `kategori` state'ini üçünde de kullanıyordu).
- `bildim/pages/ProfilePage.jsx` — konum özeti kartı + değiştirme; haftalık kilit kalan süresi.
- `src/styles.css` — sonuna `bd-*` katmanı eklendi (eski sınıflar silinmedi). CSS değişkenleri
  (boşluk/yarıçap/gölge/dokunma hedefi) `:root` üzerine yazıldı.

**Karar:** Ana sayfadaki lig özeti için 3 ayrı `lig_siralama` çağırmak yerine migration 45'e
`benim_lig_durumum(p_donem)` eklendi — 100 satır yerine tek satır döner, mobilde ucuz.
Bu RPC henüz uygulanmamışsa Home sessizce özeti gizler (try-catch), sayfa çalışmaya devam eder.

**Test edilecek:** ilk girişte modalın çıkması, şehir seçince ligin dolması, ikinci kez
değiştirmeye çalışınca 7 günlük kilidin hata vermesi. `npm run build` temiz.

## 2026-09-08 — Bildim: Faz 3 — Kozmetik yenileme + Play Store gereklilikleri

**Tasarım sistemi:** `src/styles.css` sonuna `bd-*` katmanı (Faz 2'de başladı, Faz 3'te
tamamlandı). CSS değişkenleri (`--bd-bosluk-*`, `--bd-yaricap-*`, `--bd-golge-*`,
`--bd-dokunma: 44px`) `:root` üzerine tanımlı. **Hiçbir eski sınıf silinmedi**; sayfalar
JSX'te yeni sınıflara geçirildi, eski CSS geriye uyumlu duruyor (diğer sayfalar hâlâ
`.kart`, `.btn`, `.soru-sayac` kullanıyor).

- **Soru kartı (`QuestionCard`)** yenilendi: `clamp()` ile büyüyen okunaklı soru metni
  (`text-wrap: balance`), SVG **kalan süre halkası** (son 9 sn turuncu, son 5 sn kırmızı +
  nabız), üstte ilerleme çubuğu, şıklarda **anında yeşil/kırmızı geri bildirim** (doğru:
  hafif büyüme; yanlış: sallanma), doğru/yanlış işaretleri (✓/✕), seçilmeyen şıklar solar.
  Tüm mantık (joker, basılı tut, oy verme, süre) aynen korundu.
- **Mikro etkileşim:** `bildim/components/PuanSayaci.jsx` — üst bardaki puan değişince
  easeOutCubic ile sayıyor ve "+N" baloncuğu yükseliyor. `prefers-reduced-motion` tercihine
  saygılı (hem bileşen içinde hem global CSS kuralıyla). Rütbe atlama zaten `RankUpOverlay`.
- **Erişilebilirlik:** `--text-dim` #9b94c4 → **#a9a2d2** (koyu zeminde kontrast 4.5:1 eşiğini
  geçsin diye), tüm dokunma hedefleri ≥ 44px (şıklar 56px), her etkileşimli öğede
  `:focus-visible` çerçevesi, ikon butonlarda `aria-label`, modallarda `role="dialog"`.

**Play Store gereklilikleri:**
- **`/gizlilik`** statik sayfası (`bildim/pages/GizlilikPage.jsx`). Türkçe gizlilik politikası
  **taslağı**: e-posta + kullanıcı adı toplandığı, şehir/ülkenin **kullanıcı beyanı** olduğu
  (GPS alınmadığı), verilerin satılmadığı, Supabase/Vercel'in işleyici olduğu, silme hakkı.
  İletişim: idagureli@gmail.com. **Rota giriş duvarının ÖNÜNDE** (`src/App.jsx` içindeki
  `bagimsizModul` listesine eklendi) — mağaza kaydı oturum açmadan görebilsin diye.
- **Hesap silme:** `supabase/migrations/20260612000046_hesap_silme.sql` → `hesabimi_sil()`.
  Önce `delete from auth.users` denenir (cascade ile `public.profiles` ve ona bağlı **tüm**
  oyun tabloları gider) → `'tam'` döner. Yetki yoksa yalnızca `public.profiles` silinir →
  `'kismi'` döner. **Uydurma yok:** `'kismi'` durumunda auth.users kaydını temizlemek için
  service_role ile çalışan bir Edge Function gerekir; bu dosyanın başına not düşüldü.
  Profil sayfasında kullanıcı adını yazdırarak onaylatan modal + ardından `signOut()`.

**Değişen/eklenen dosyalar (Faz 3):** `bildim/components/QuestionCard.jsx`,
`bildim/components/PuanSayaci.jsx` (yeni), `bildim/components/Layout.jsx`,
`bildim/pages/ProfilePage.jsx`, `bildim/pages/GizlilikPage.jsx` (yeni), `src/App.jsx`,
`src/styles.css`, `supabase/migrations/20260612000046_hesap_silme.sql` (yeni).
`npm run build` temiz.

## 2026-09-08 — Bildim: Faz 4 — Soru havuzu planı (üretim YAPILMADI)

`scripts/soru-parti-sablonu.md` yazıldı: tekrar kullanılabilir parti promptu + migration
iskeleti + parti öncesi tekrar kontrolü + parti sonrası doğrulama sorguları + kayıt defteri.

**Mevcut havuz (migration dosyalarındaki `insert` satırları sayılarak; DB'ye bağlanılamadı,
`on conflict (soru) do nothing` nedeniyle gerçek sayı biraz düşük olabilir):**
bilim 332, tarih 272, cografya 224, genel 189, edebiyat 175, spor 165, sanat 141,
sinema 54, teknoloji 54, muzik 53, karisik 39 → **toplam ~1.700**.

**Hedef:** 10 kategori × ~1.000 = 10.000. `karisik` ayrı kategori olarak büyütülmüyor
(kullanıcı "karışık" modu kategori seçmeyerek zaten oynuyor); yeni sorular 10 gerçek
kategoriye dağıtılıyor. Kalan ~8.300 soru → ~17 parti × 500.

Kesin sayıyı Studio'da şununla al:
`select kategori, count(*) from public.questions where aktif group by kategori order by 2 desc;`

---

### Bu paketin özeti — senin manuel yapman gerekenler

1. **Migration'ları sırayla Supabase Studio → SQL Editor'de çalıştır:**
   - `20260612000045_lig_ve_kategori.sql` (büyük dosya, tek parça)
   - `20260612000046_hesap_silme.sql`
2. **pg_cron kontrolü:** `select jobname, schedule from cron.job order by jobname;`
   → `bildim-hafta-sifirla` gitmiş, `bildim-hafta-kapat` (0 21 * * 0) ve
   `bildim-hafta-bildir` (0 6 * * 1) gelmiş olmalı.
3. **Hesap silme davranışını doğrula:** test hesabıyla `select public.hesabimi_sil();`
   → `'tam'` dönerse ek iş yok; `'kismi'` dönerse auth.users temizliği için Edge Function
   gerekir, haber ver.
4. **Kendi profilinde şehir/ülke seç** (ilk giriş modalı) — lig sekmeleri onsuz boş görünür.
   Konum haftada 1 kez değişir, test ederken dikkat.
5. **Bildirim izni** açıksa Pazartesi 09:00 TSİ haftalık sonuç push'u gelir.
6. Deploy/push YAPILMADI (istendiği gibi).

## 2026-09-08 — Migration'lar CANLIYA UYGULANDI + CLI 403'ün kök nedeni bulundu

Kullanıcı "her şeyi sen yap, bana SQL Editor açtırma" dedi; migration'lar bu oturumda
**doğrudan canlı veritabanına uygulandı**. Artık elle uygulama gerekmiyor.

**CLI 403'ün kök nedeni (aylardır bilinmiyordu):** `npx supabase projects list` çalışıyor
ama yalnızca `idafroditproject@gmail.com` hesabının 2 projesini listeliyor. Bildim'in
projesi `zfpnxzybcpkxsotwdsey` o listede YOK → makinedeki CLI token **başka hesaba ait**.
Yani yetki sorunu değil, hesap uyuşmazlığı. Çözüm: CLI hesabından bağımsız olarak
**DB şifresiyle pooler üzerinden** bağlanmak.

- `supabase db dump` Docker istiyor → kullanılamadı.
- Bunun yerine scratchpad'e `pg` kurulup doğrudan Postgres bağlantısı kuruldu
  (`postgres.zfpnxzybcpkxsotwdsey@aws-1-eu-central-1.pooler.supabase.com:5432`).
- DB şifresi `.env.local` içine `SUPABASE_DB_PASSWORD` olarak yazıldı (gitignore'da).

**Uygulama yöntemi:** 45 ve 46 önce `begin; … rollback;` ile **deneme çalıştırıldı**
(hatasız), sonra `begin; … commit;` ile tek transaction'da uygulandı.

**Doğrulanan sonuçlar (canlı DB):**
- `cron.job`: `bildim-hafta-sifirla` **gitti**; `bildim-hafta-kapat` (`0 21 * * 0`) ve
  `bildim-hafta-bildir` (`0 6 * * 1`) **aktif**.
- `ulkeler` 85 satır, `sehirler` TR 81 il, `questions` 1.701 soru (hepsi `dil='tr'`),
  `gorulen_sorular` / `lig_arsiv` boş (beklenen).
- Uçtan uca RPC testi (gerçek kullanıcı kimliği taklit edilip **rollback** edildi):
  `get_categories` 11 kategori / 1.701 soru, `profil_konum_kaydet('TR','Balıkesir')` ✓,
  `lig_siralama('sehir'|'global')` ✓ (dünyada 21 bot-olmayan oyuncu),
  `benim_lig_durumum` ✓, `sehir_lig_sirasi` ✓, `soru_sec('tarih',20)` → 20 soru ✓.
  Şehir doğrulaması da çalışıyor: 'Balikesir' (Türkçe karaktersiz) **reddedildi**.
  → Test rollback edildiği için kullanıcının konumu **değişmedi**, uygulama soracak.
- **`hesabimi_sil()` → `'tam'` dönecek.** Fonksiyon `postgres` rolüne ait ve o rol
  `auth.users` üzerinde DELETE yapabiliyor (rollback'li test edildi). **Edge Function
  GEREKMİYOR.** Migration 46'nın başlığı bu doğrulamayla güncellendi.

**Migration geçmişi onarıldı:** `supabase_migrations.schema_migrations` tablosu yalnızca
000030'a kadar kayıtlıydı (31-44 SQL Editor'den elle uygulandığı için kaydedilmemiş).
`supabase migration repair --status applied` ile 31,32,33,35-46 kaydedildi.
**34 (Gladius `gl_temel`) bilerek kaydedilmedi: canlıda gerçekten YOK** — `gl_profiller`,
`gl_odalar`, `gl_maclar` tabloları mevcut değil. Gladius zaten DEMO ve backend kullanmıyor
(`App.jsx` içinde `bagimsizModul`), bu yüzden bir şey bozulmuyor; ama Gladius'a backend
eklenecekse önce 034 uygulanmalı. Bundan sonra `npx supabase db push --db-url ...` sadece
bekleyen migration'ları uygular.

**Gerçek soru sayıları (tahmin değil):** bilim 329, tarih 266, genel 221, cografya 217,
edebiyat 172, spor 161, sanat 136, sinema 55, teknoloji 54, muzik 54, karisik 36 →
**toplam 1.701**. `scripts/soru-parti-sablonu.md` bu gerçek sayılarla güncellendi.

**Kalan tek manuel iş:** yok. Sadece siteyi aç, ilk girişte şehir modalı çıkacak.
(Deploy/`git push` hâlâ YAPILMADI — istersen söyle.)

## 2026-09-08 — Bildim Faz 1: Gizlilik + takma ad + davet + bildirim (`20260612000047`)

**Kök sorun (canlıda doğrulandı):** `handle_new_user` kullanıcı adını Google `full_name`'den
üretiyor ve Google fotoğrafını otomatik alıyordu → herkes gerçek adı ve yüzü görüyordu.
Ayrıca hiç oynamamış üyeler ligde listeleniyordu (canlı sayım: 21 üyenin 4'ü hiç oynamamış).

### Kararlar ve gerekçeleri

- **`gorunen_ad` / `gorunen_avatar` STORED GENERATED kolon olarak eklendi** (RPC katmanı
  yerine). Gerekçe: uygulama profilleri yalnız RPC'den değil, PostgREST **gömülü join**'leriyle
  de okuyor (`p1:profiles!matches_oyuncu1_fkey(...)`, `profil:profiles(...)`) ve realtime
  yayınları da var. Kolon olarak tanımlanınca üç yol da tek noktadan güvenli hale geliyor;
  her RPC'yi ayrı ayrı sarmalamaya göre hem daha az kod hem sızdırma riski sıfır.
  `gorunen_ad = case when takma_ad_secildi then takma_ad else 'Oyuncu' end`,
  `gorunen_avatar = case when avatar_onayli then avatar_url else null end`.
- **`profiles_select` politikasına DOKUNULMADI** (varsayılan karar gereği; diğer oyun
  modülleri kırılmasın). Bunun yerine `revoke select (username, avatar_url) ... from anon`.
  authenticated'a dokunulmadı.
- **`toplam_mac` TRIGGER ile artıyor**, mevcut `advance_match` / `advance_group_match` /
  `advance_hizli_mac` / `advance_tournament` fonksiyonları **yeniden yazılmadı**. Gerekçe:
  bunlar puanlama ve rozet mantığını taşıyan büyük fonksiyonlar; `durum='bitti'` geçişini
  trigger'la yakalamak çok daha az riskli. Geriye dönük doldurma tek `update` ile yapıldı
  (kurucu hesapta 43 maç bulundu).
- **`is_bot` kullanıldı, `provider='bot'` değil.** Gerekçe: şemadaki bot işareti `is_bot`;
  mevcut kodun tamamı onu kullanıyor, `provider` bot satırlarında dolu değil.
- **`gen_random_bytes` yerine `md5`**: pgcrypto Supabase'de `extensions` şemasında ve
  fonksiyonlar `set search_path = public` ile çalışıyor → bağımlılık kaldırıldı.
- **Davet kodu 8 karakter**, karışması kolay 0/O ve 1/I üretilmiyor (hex harfleri
  `JKMNPR`'ye çevriliyor).

### Görünen ada geçirilen okuma yolları (tarandı, tamamı)

RPC'ler: `lig_siralama`, `sehir_lig_sirasi`, `benim_lig_durumum`, `birlesik_siralama`,
`arkadas_davet_kodu_ile_ekle`, `profil_al` (yeni). `oyuncu_ara` **kapatıldı**
(`revoke execute … from authenticated`) — kullanıcı adıyla arama gerçek ad sızdırıyordu.
Gömülü join'ler: `matches` (p1/p2), `friendships` (req/add), `group_match_players.profil`,
`hizli_oyuncular.profil`, `tournament_players.profil`, `profiles` doğrudan select'leri
(Home top5, ChallengesPage bot/oyuncu listeleri, LeaderboardPage arkadaş sekmesi).
Toplam 30 alan + 41 gösterim yeri çevrildi. `src/components/Avatar.jsx` her iki şekli de
kabul edecek biçimde geriye uyumlu yapıldı (diğer oyunlar kırılmasın).

### Yeni nesneler

Kolonlar: `takma_ad`, `takma_ad_secildi`, `takma_ad_degisti_at`, `avatar_onayli`,
`davet_kodu`, `toplam_mac`, `tercih_kategori`, `gorunen_ad`, `gorunen_avatar`.
Tablolar: `yasakli_kelimeler`, `bildirimler`.
Fonksiyonlar: `yeni_davet_kodu`, `takma_ad_sec`, `avatar_onayla`, `profil_al`,
`tercih_kategori_kaydet`, `bildirim_yaz`, `bildirimleri_oku`, `mac_sayaci_arttir`,
`oynanabilir_mi`, `arkadas_davet_kodu_ile_ekle` + 5 trigger fonksiyonu.
Bildirim olayları: `lige_girdin` (ilk maç), `gecildin` (haftalık ligde geçilme, saatte ≤1,
aynı ülke içinde), `arkadas_istek` / `arkadas_kabul`, `hafta_sonuc` (`haftayi_kapat` içinde).
Meydan okuma push'u (`notify_new_challenge`) aynen korundu.

### Doğrulama (canlıya UYGULANMADAN, geri alınan transaction içinde)

`begin; <migration> … rollback;` ile denendi: hatasız. İşlevsel test: `takma_ad_sec('Bilgin_42')`
→ `gorunen_ad` 'Oyuncu'dan 'Bilgin_42'ye döndü; `gorunen_avatar` null (Google fotoğrafı gizli);
`davet_kodu` üretildi; `toplam_mac` geriye dönük doldu; `lig_siralama('global','tum_zamanlar')`
**21 yerine 17 satır** döndü (hiç oynamamış 4 üye ligden çıktı — hedeflenen davranış);
`profil_al` ve `birlesik_siralama` çalışıyor. Migration **uygulanmadı** (istek gereği).

`npm run build` temiz.

## 2026-09-08 — Bildim Faz 2: Genel Kültür kategorisi + kategoriye göre eşleştirme (`20260612000048`)

- `genel` kategorisine **dokunulmadı**. Yeni anahtar `genel_kultur`; `get_categories`
  sıralaması `order by (kategori = 'genel_kultur') desc, count(*) desc` ile onu her zaman
  başa alıyor. Soruları Faz 3'te geldiği için şu an listede görünmüyor (`having count >= 15`).
- Etiketler tek dosyaya taşındı: `bildim/lib/kategoriler.js` (`kategoriEtiket`,
  `kategorileriSirala`). ChallengesPage'deki yerel `KATEGORI_ETIKET` haritası buraya geçti;
  eksik olan sinema/müzik/teknoloji/karışık etiketleri de eklendi.
- **Keşif:** `matchmaking_queue` tablosuna bugüne kadar **hiçbir yer satır eklemiyordu** —
  yani "Hemen Oyna" her seferinde doğrudan bota düşüyordu, insan eşleştirmesi hiç çalışmamış.
  `kuyruga_gir(p_kategori)` / `kuyruktan_cik()` / `kuyruk_durumum()` ile kuyruk ilk kez
  gerçekten kullanılıyor.
- Eşleştirme kuralı: önce **aynı kategoride** bekleyen rakip; yoksa **20 saniyedir** bekleyen
  herhangi bir rakip (karışığa düşer); o da yoksa kuyrukta kalınır. İstemci
  (`bildim/components/RakipAra.jsx`) 2 saniyede bir yokluyor, 20 saniye dolunca
  `quick_match` ile bota/karışığa düşüyor. Böylece oyun asla 20 saniyeden fazla bekletmiyor.
- `quick_match` imzası korundu; `p_kategori` verilmezse `profiles.tercih_kategori` kullanılıyor.

`npm run build` temiz. Migration **uygulanmadı**; 47+48 birlikte geri alınan transaction
içinde denendi, hatasız.

## 2026-09-08 — Bildim Faz 3: 1.500 doğrulanmış yeni soru (partiler 10, 11, 12)

Dosyalar: `20260612000049_soru_parti10_genel_kultur.sql` (500 genel_kultur),
`…050_soru_parti11_genel_kultur.sql` (400 genel_kultur + 100 karışık kategori),
`…051_soru_parti12_kategoriler.sql` (500, 9 kategoriye eşit).

### Yöntem (bu partilerde kurulan, sonrakiler için kalıcı)

Elle gözden geçirmek 1.500 soruda güvenilir değil; bu yüzden **otomatik denetim
zinciri** kuruldu (scratchpad'de, `scripts/soru-parti-sablonu.md`'ye de eklendi):
1. `mevcut-sorular.txt` — canlı DB'den çekilen tüm soru metinleri (parti bittikçe güncellenir).
2. `denetle.mjs` — SQL biçimi, 4 şık, şık benzersizliği, soru işareti, şık uzunluğu,
   zamana bağlı/yoruma açık kalıplar, parti içi tekrar, **mevcut havuzla anahtar kelime
   örtüşmesi** (≥%80 kesişim + ≥3 anahtar kelime), doğru şık ve kategori dağılımı.
3. `temizle.mjs` — çakışan/kuralı bozan soruları dosyadan siler.
4. `birebir.mjs` — `on conflict (soru) do nothing` ile sessizce düşecek **birebir aynı**
   metinleri yakalar (anahtar kelime taraması kısa sorularda bunları kaçırıyor).
5. `tamamla.mjs` / `ekle-dengele.mjs` — doğru şıkkı 0-1-2-3 sırayla dağıtır (dosya
   düzeyinde 125/125/125/125) ve parti sonuna karıştırma bloğunu ekler.
6. Her parti canlı DB'de `begin; … rollback;` ile denenip kaç satırın gerçekten
   eklendiği ölçüldü.

### Parti raporları

**Parti 10 — 500 genel_kultur.** Üretilen 525 → 25'i zorluk dengesi için çıkarıldı.
Denetimde **86 soru elendi** (84 anahtar kelime çakışması + 2 şıkları benzersiz olmayan);
yerlerine tamamen yeni konularda (meslekler, coğrafya terimleri, doğal afetler, tarım,
hayvan yavruları, ev/mutfak araçları, kütüphane-iletişim-okul) 86 soru yazıldı.
Ardından **9 birebir tekrar** daha yakalandı ve değiştirildi. Son durum: 500 soru,
doğru şık 125/125/125/125, mevcut havuzla çakışma 0, DB'ye 500/500 eklendi.

**Parti 11 — 400 genel_kultur + 100 karışık.** İlk yazımda 350 soru vardı; denetimde
**64 soru elendi**, 214 yeni soru eklendi (dünya simge yapıları, baharat/mutfak teknikleri,
uzay, hukuk-vatandaşlık, enerji-çevre, giyim, meteoroloji-ölçüm, güvenlik, ulaşım,
Türk bilim insanları). Sonra kategori dengesi için 18 soru kırpıldı ve **5 birebir tekrar**
değiştirildi. Son durum: 500 soru (genel_kultur 400; tarih 13, bilim 12, cografya 12,
edebiyat 11, sinema 11, teknoloji 11, spor 10, sanat 10, muzik 10), çakışma 0, 500/500 eklendi.

**Parti 12 — 500, 9 kategori.** Üretilen 496'dan **13 soru elendi**, 17 yeni soru eklendi.
Son durum: tarih 56, bilim 56, cografya 56, spor 56, muzik 56, edebiyat 55, sanat 55,
sinema 55, teknoloji 55. Çakışma 0, 500/500 eklendi.

**Denetimde kalan 3 "hata" yanlış pozitiftir:** "güncel" kelimesi geçen üç soruda kelime
zaman bağımlılığı değil, *"güncel konular"* (köşe yazısı türü) ve *"güncelleme"* (yazılım)
anlamındadır; cevaplar zamanla değişmez. Bir şık 40 karakteri aşıyordu, kısaltıldı.

### Sonuç

Üç parti birlikte canlıda denendi: **1.500/1.500 soru eklendi**, hiçbiri
`on conflict` ile düşmedi. Havuz 1.701 → **3.201**. Kategori dağılımı:
genel_kultur 900, bilim 397, tarih 335, cografya 285, edebiyat 238, spor 227,
genel 221, sanat 201, sinema 121, teknoloji 120, muzik 120, karisik 36.
Migration'lar **uygulanmadı**. `npm run build` temiz.

## 2026-09-08 — Bildim Faz 4: gizlilik akışı, davet ve bildirim arayüzü

**Yeni dosyalar:** `bildim/components/KurulumSihirbazi.jsx` (3 adımlı zorunlu akış),
`bildim/components/BildirimZili.jsx`, `bildim/components/BildirimIzniSor.jsx`,
`bildim/components/ProfilAyarlari.jsx`, `bildim/pages/DavetPage.jsx`,
`public/avatars/av1–av8.svg` (hazır anonim avatar seti).

- **Zorunlu kurulum akışı** `Layout` içine alındı: `takma_ad_secildi`, `avatar_onayli` ya da
  `ulke` eksikse sihirbaz açılıyor ve oyun ekranları açılmıyor. Sihirbaz profile bakıp
  yarım kalan adımdan devam ediyor (mevcut üyeler için de çalışır). Google fotoğrafı
  **yalnızca onay ekranında** gösteriliyor; onaylanmazsa DB'ye yazılmıyor.
- **Hazır avatarlar** `public/avatars/` altına SVG olarak üretildi. Gerekçe: `avatar_onayla`
  RPC'si adresi `^(/…|https://…)$` ile doğruluyor; `data:` URI kabul etmiyor. Dosya yolu
  hem doğrulamadan geçiyor hem önbelleğe alınabiliyor.
- **Arkadaş arama kaldırıldı.** FriendsPage artık davet kodu + davet linki üzerine kurulu.
  `/bildim/davet/:kod` rotası eklendi; giriş yoksa kod `localStorage`'a yazılıyor ve
  `AuthContext` oturum açılışında `arkadas_davet_kodu_ile_ekle` ile otomatik uyguluyor.
- **ChallengesPage rakip listesi** artık `friendships` üzerinden yalnız arkadaşlar + botlar
  (sunucu tarafı `oynanabilir_mi` zaten zorunlu kılıyor; arayüz de buna uyduruldu).
  Kullanıcı adıyla arama kutusu ve `ara()` fonksiyonu silindi.
- **Bildirim izni ana sayfadan kaldırıldı**, ilk maç sonucu ekranına taşındı
  (`BildirimIzniSor`). Gerekçe: oyunu görmeden izin istemek reddedilme oranını artırıyor.
  Reddedilirse bir daha gösterilmiyor.
- **Üst çubuğa bildirim zili** eklendi: okunmamış sayısı, realtime INSERT aboneliği,
  açılınca `bildirimleri_oku()` çağrısı, satıra tıklayınca ilgili sayfaya yönlendirme.
- **Profil sayfası** yeniden düzenlendi: takma ad (30 gün kilidi ve kalan süre), avatar
  seçimi/Google onayı/kaldırma, davet kodu + link kopyalama, varsayılan kategori seçimi
  (Genel Kültür en üstte) ve "Gerçek adın hiçbir zaman gösterilmez" açıklaması.
  Gerçek `username` yalnızca kendi profilinde "hesap kimliğin" olarak görünüyor.
- Home'daki konum modalı kaldırıldı (artık sihirbazın 3. adımı).

`npm run build` temiz.

## 2026-09-08 — Bildim Faz 5: kozmetik — "yönetim paneli" değil "oyun"

**Sorun:** her şey aynı boyda mor karttı; hiyerarşi, hareket ve kimlik yoktu.

- **Tipografi:** başlıklar **Baloo 2** (Google Fonts, `index.html`'e preconnect + link),
  gövde system-ui. `--bd-baslik-font` değişkeniyle logo, başlıklar, hero, mod adları,
  soru metni ve ana eylem butonu bu yazı tipini kullanıyor.
- **Ana sayfa hiyerarşisi yeniden kuruldu:** tek büyük **hero** (rütbe halkası + avatar +
  takma ad + rütbe rozeti, dev puan sayısı, rütbe ilerleme çubuğu, birincil "HEMEN OYNA"
  butonu, altında küçük şehir/ülke/dünya lig rozetleri ve haftalık geri sayım).
  Altında **2 sütun mod kartları** (ikon + iki kelime), sonra **ayrı turnuva bandı**,
  sonra görevler ve En İyiler. Eski `hero-panel` / `mod-kart` bloklarının JSX'i yeni
  sınıflara geçirildi; **eski CSS sınıfları silinmedi**.
- **İkonlar:** `bildim/components/Ikon.jsx` — 20 parçalık **inline SVG** seti
  (bağımlılık eklenmedi, `currentColor` devralır). Alt sekme çubuğu, bildirim zili ve
  mod kartları emojiden SVG'ye geçti. Aktif sekmenin üstüne vurgu çizgisi eklendi.
- **Rütbe rozetleri özelleştirildi:** `RankBadge` artık her rütbe için ayrı SVG biçim
  çiziyor (Çaylak/Bilge/Üstat/Kahin/Efsane). Eski `puan` prop'u ve `.rutbe-chip`
  görünümü korundu, `sadeceRozet` seçeneği eklendi.
- **Renk disiplini:** koyu zemin + tek vurgu (mor) + **sıcak ikincil (altın) yalnızca
  ödül/puan** için (`--bd-odul`). Hero puanı, ana eylem butonu ve ilerleme çubuğunun
  ucu altın; gerisi mor/nötr.
- **Hareket:** sayfa girişinde 4 kademeli **stagger** (`bd-giris-1..4`), puan sayacı
  (Faz 3), cevap kartı tepkisi (Faz 3), ligde kendi satırı vurgusu (Faz 2).
  `prefers-reduced-motion` kuralı tüm animasyonları kapatıyor.
- **Erişilebilirlik/mobil:** dokunma hedefleri ≥44px (mod kartları 104px, ana eylem 58px),
  `--text-dim` kontrastı 4.5:1 üzerinde, 400px altı için ayrı medya sorgusu ile hero,
  mod kartları, sekmeler, davet kodu ve avatar ızgarası yeniden ölçeklendi.

`npm run build` temiz.

## 2026-09-08 — Bildim farklılaştırma paketi: KAPANIŞ

Tek oturumda 6 faz tamamlandı. `BILDIM_GOREV.md` içindeki tüm kutular dolu.
**Push, deploy ve `supabase db push` YAPILMADI** (istek gereği). Migration'lar canlıya
uygulanmadı; her biri `begin; … rollback;` ile canlı veritabanında denendi.

### Supabase'de ÇALIŞTIRMA SIRASI (bu sırayla, tek tek)

| # | Dosya | Ne yapar |
|---|-------|----------|
| 1 | `20260612000047_takma_ad_gizlilik.sql` | Takma ad, görünen ad/avatar, davet kodu, bildirimler, toplam_mac, arkadaş kısıtı |
| 2 | `20260612000048_genel_kultur_kategori.sql` | `genel_kultur` kategorisi + kategoriye göre eşleştirme kuyruğu |
| 3 | `20260612000049_soru_parti10_genel_kultur.sql` | 500 genel kültür sorusu |
| 4 | `20260612000050_soru_parti11_genel_kultur.sql` | 400 genel kültür + 100 karışık kategori |
| 5 | `20260612000051_soru_parti12_kategoriler.sql` | 500 soru, 9 kategoriye eşit |

Zincirin tamamı birlikte denendi: hatasız. Sonuç: soru havuzu **1.701 → 3.201**,
`get_categories` ilk sırada `genel_kultur` (900 soru), `lig_siralama` 21 yerine
**17 oyuncu** döndürüyor (hiç oynamamış 4 üye ligden çıktı).

### Ana kararlar ve gerekçeleri (özet)

1. **Gizlilik RLS ile değil, `gorunen_ad`/`gorunen_avatar` STORED GENERATED kolonlarıyla.**
   Uygulama profilleri RPC'den, PostgREST gömülü join'lerinden ve realtime'dan okuyor;
   kolon olarak tanımlayınca üç yol da tek noktadan güvenli hale geldi. `profiles_select`
   politikasına dokunulmadı → diğer oyun modülleri etkilenmedi.
2. **`toplam_mac` trigger ile artıyor**, büyük `advance_*` fonksiyonları yeniden yazılmadı.
3. **`matchmaking_queue` ilk kez gerçekten kullanılıyor** — keşif: bugüne kadar hiçbir yer
   kuyruğa satır eklemiyordu, "Hemen Oyna" hep bota düşüyordu.
4. **Hazır avatarlar dosya yolu olarak** (`/avatars/av*.svg`); `avatar_onayla` `data:` URI
   kabul etmiyor.
5. **Soru üretiminde otomatik denetim zinciri** kuruldu; 1.500 sorunun 163'ü denetimde
   elenip yenisiyle değiştirildi.
6. **Bildirim izni ilk açılışta değil ilk maç sonunda** isteniyor.

### Senin yapman gerekenler

1. Yukarıdaki 5 migration'ı **sırayla** çalıştır (ya da bana söyle, ben uygularım —
   `.env.local`'deki `SUPABASE_DB_PASSWORD` ile doğrudan bağlanabiliyorum).
2. Uyguladıktan sonra siteye gir: **takma ad → avatar → şehir** sihirbazı çıkacak.
   Mevcut hesabın için de çıkar; gerçek adın artık hiçbir yerde görünmeyecek.
3. Arkadaş eklemek artık yalnız **davet kodu/linki** ile. Profil ya da Arkadaşlar
   sekmesinden linkini paylaş.
4. `boks/` klasöründeki 9 dosya hâlâ commit edilmemiş durumda — bu görevin kapsamı
   dışındaydı, dokunulmadı.
5. Push/deploy istersen söyle.

## 2026-09-08 — Bildim Görev 2 / Faz 1: Joker ekonomisi, seri, rövanş, ustalık, hızlı mod (DB)

Migration'lar: `20260612000052_joker_ekonomisi.sql`, `…053_seri_rovans_ustalik.sql`,
`…054_hizli_mod.sql` + Edge Function `satin_alma_dogrula`.

### Kararlar ve gerekçeleri

- **Yeni `joker_kullanimlari` tablosu, eski `match_jokers` korunarak.** Mevcut
  `match_jokers` / `group_match_jokers` birincil anahtarı `(mac_id, user_id, tip)` —
  yani maç başına her türden 1. Bu, "arkadaş maçında sınırsız joker" kuralıyla
  çelişiyordu. Eski tablolar ve `use_joker` / `use_group_joker` RPC'leri **silinmedi**
  (geriye uyumluluk); yeni akış `joker_kullan()` + `joker_kullanimlari` üzerinden gider.
- **Tek giriş noktası `joker_kullan(mac_tur, mac_id, soru_index, tur)`.** Maç doğrulama,
  süre penceresi, "zaten cevapladın", maç sınırı, ücretsiz hak, envanter düşümü ve
  **silinecek iki şıkkın seçimi** tamamen sunucuda. İstemci hiçbir şey hesaplamıyor.
- **Maç sınırı `joker_mac_siniri()` ile tek yerden:** grup → sınırsız (null);
  hızlı/turnuva → 2; 1v1 → rakip arkadaşsa sınırsız, bot/rastgele eşleşme ise 2 (lig maçı);
  **turnuva finali (hayatta ≤2 oyuncu) → 0 (yasak)**.
- **`pas` turnuvada yasak** — turnuvada yanlış cevap elenmek demek; pas jokeri oyuncuyu
  eleyeceği için anlamsız olurdu. (Prompt'ta yoktu; en az yıkıcı seçim.)
- **Doğru cevap sayımı ve seri, cevap RPC'leri yeniden yazılmadan trigger'la** bağlandı:
  `match_answers` / `group_match_answers` / `hizli_cevaplar` / `tournament_answers`
  üzerine AFTER INSERT trigger'ları kategori ustalığını işliyor; seri ise 047'de kurulan
  `mac_sayaci_arttir()` genişletilerek (maç bitiş trigger'ları) güncelleniyor.
- **Seri koruma yalnız 1 günü kapatır:** `seri_kontrol()` yalnızca `seri_son_gun = bugün-2`
  (tam olarak bir gün kaçırılmış) durumunda koruma harcıyor; 2+ gün kaçıranda koruma varsa
  bile seri sıfırlanıyor. Testle kanıtlandı.
- **Eski `profiles.seri` / `son_seri_tarihi` bozulmadı**, yeni `seri_gun` / `seri_son_gun` /
  `seri_en_uzun` ile senkron tutuluyor — mevcut arayüz çalışmaya devam ediyor.
- **Hızlı Mod lig puanına dokunmuyor.** `profiles.puan` / `puan_hafta` hiç yazılmıyor;
  skorlar `hizli_mod_skorlar` tablosunda haftalık tutuluyor, kendi sıralaması var.
  Süre kontrolü sunucuda (`soru_baslangic + 6 sn` ağ payı, toplam 60 sn).
- **Satın alma:** fiyat kodda YOK; `joker_paketleri` tablosu yalnız ürün kimliği ve içerik
  tutuyor, fiyatı Play Console belirliyor. `joker_ekle` ve `satin_alma_isle`
  `authenticated`'a **verilmedi**, yalnız `service_role` çağırabiliyor.
- **Edge Function sahte onay vermiyor:** `PLAY_SERVICE_ACCOUNT` / `PLAY_PACKAGE_NAME`
  secret'ları yoksa 503 ve açık hata döner. Makbuz Play Developer API
  `purchases.products.get` ile doğrulanır, `purchaseState = 0` şartı aranır, token
  tekrarı hem açık kontrol hem `unique` kısıtla reddedilir.

### Doğrulama

`bildim/_test/joker-kurallari-test.sql` + `…test.mjs` yazıldı ve canlı veritabanında
**tek transaction içinde çalıştırılıp rollback edildi** (canlı veri değişmedi):
**14/14 test geçti** — lig maçında 3. joker reddi, arkadaş maçında sınırsızlık, ücretsiz
elli tükenmesi, günde 6. reklam ödülü reddi, aynı reklam referansının tekrarlanamaması,
aynı Play token'ın iki kez kabul edilmemesi, seri korumanın yalnız 1 günü kapatması,
2 günde sıfırlanma, turnuva finalinde sınırın 0 olması ve jokerin reddi, final dışında
sınırın 2 olması, turnuvada pas yasağı, envanter düşümünün denetim izine yazılması,
hızlı modun lig puanını değiştirmemesi.

`npm run build` temiz. Migration'lar **uygulanmadı**.

## 2026-09-08 — Bildim Görev 2 / Faz 2: Joker, seri, rövanş, ustalık, hızlı mod arayüzü

**Yeni dosyalar:** `bildim/lib/jokerler.js`, `bildim/lib/h5ads.js`, `bildim/lib/playFatura.js`,
`bildim/components/JokerCubugu.jsx`, `SeriRozeti.jsx`, `EzeliRakip.jsx`,
`MacSonuEklentisi.jsx`, `UstalikIzgarasi.jsx`, `bildim/pages/JokerDukkani.jsx`,
`bildim/pages/HizliModPage.jsx`, `supabase/migrations/20260612000055_seri_hatirlatma.sql`.

- **Joker çubuğu** `QuestionCard`'a **eski çubuğu bozmadan** eklendi: `macTur`+`macId`
  verilirse yeni sunucu tabanlı çubuk, verilmezse eski `jokerler` prop'u çalışır.
  1v1 / grup / hızlı / turnuva sayfalarının dördü de yeni çubuğa bağlandı.
  Adet rozeti, "ÜCRETSİZ" işareti ve pasiflik nedeni (sınır doldu / final / jokerin yok)
  sunucudan gelen `joker_mac_durumu` + `envanterim` ile çiziliyor; 50:50'de silinecek
  şıklar sunucudan gelir, istemci hesaplamaz.
- **Joker Dükkânı** (`/bildim/joker`): envanter, ödüllü video (sayaç `bugün 3/5`),
  Play paketleri, gizlilik/iade notu.
  - **Reklam:** Google H5 Games Ads (`adBreak({type:'reward'})`). `VITE_H5_ADS_CLIENT`
    boşsa buton **pasif** ve "test modu" notu; **sahte ödül verilmez**. Reklam
    tamamlanmadan sunucuya hiç gidilmez; ödülü `reklam_odulu_al` verir.
  - **Satın alma:** Digital Goods API + Payment Request. Tarayıcıda API yoksa buton
    "Android uygulamasında satın alınabilir" der; **başka ödeme sağlayıcı eklenmedi**.
    Fiyat koda yazılmadı, Play'den okunuyor. Doğrulama Edge Function'da.
- **Maç sonucu** (`MacSonuEklentisi`): bu maçta kullanılan jokerler, güncel seri,
  kaybedildiyse büyük **RÖVANŞ İSTE** butonu (`rovans_iste`, aynı kategori, 24 saat).
- **Ana sayfa:** hero'da seri sayacı + koruma rozeti + rekor; mod ızgarasına
  **Hızlı Mod** ve **Joker Dükkânı** kartları; turnuva bandının altında **Ezeli rakibin**
  kartı (skor + tek tık meydan okuma).
- **Profil:** güncel/en uzun seri, kullanılan joker ve izlenen video sayısı, envanter
  çipleri ve **kategori ustalığı ızgarası** (seviye rengi + ilerleme çubuğu + kalan doğru).
- **Hızlı Mod ekranı** (`/bildim/hizli-mod`): kategori seçimi → 60 sn çubuk + 5 sn halka →
  skor + haftalık sıralama (şehir/ülke/dünya sekmeleri). Süre ve puan sunucuda.
- **Bildirimler:** ustalık seviye atlama ve rövanş isteği 053'te; **akşam 20:00 seri
  hatırlatması** yeni `055_seri_hatirlatma.sql` ile (pg_cron `0 17 * * *` = 20:00 TSİ,
  uygulama içi bildirim + push aboneliği varsa push).

`.env.example`'a `VITE_H5_ADS_CLIENT` eklendi. `npm run build` temiz; sunucu kuralı
testleri yeniden çalıştırıldı: **14/14**.

## 2026-09-08 — Bildim Görev 2 / Faz 3: Kapanış

`BILDIM_GOREV2.md` içindeki tüm kutular dolu. `npm run build` temiz.
**Push / deploy / `db push` YAPILMADI.**

### Sunucu kuralı testleri — 14/14 GEÇTİ

`npm run test:bildim` (→ `bildim/_test/joker-kurallari-test.mjs` + `…test.sql`).
Test, migration'ları ve senaryoları **tek transaction içinde çalıştırıp ROLLBACK eder**;
canlı veri değişmez. Kanıtlananlar:

| # | Kural |
|---|-------|
| 1 | Lig maçında **3. joker reddedilir** (sınır 2) |
| 2 | Arkadaş maçında sınır yok |
| 3 | Ücretsiz 50:50 maç başına 1 kez, birikmez |
| 4 | **Günde 6. reklam ödülü reddedilir** (tavan 5) |
| 5 | Aynı reklam referansı iki kez ödüllendirilemez |
| 6 | **Aynı Play token iki kez kabul edilmez** |
| 7 | **Seri koruma tam olarak 1 günü kapatır** (seri sürer) |
| 8 | 2 gün kaçırılmışsa koruma varken bile seri sıfırlanır |
| 9-10 | **Turnuva finalinde sınır 0 ve joker reddedilir** |
| 11 | Final dışında turnuva sınırı 2 |
| 12 | Turnuvada `pas` jokeri yasak |
| 13 | Kullanım envanterden düşer ve denetim izine yazılır |
| 14 | **Hızlı mod lig puanını değiştirmez** |

### Supabase'de ÇALIŞTIRMA SIRASI

Önce önceki paketin migration'ları (047 → 048 → 049 → 050 → 051) uygulanmalı,
sonra bu paket:

| # | Dosya | Ne yapar |
|---|-------|----------|
| 1 | `20260612000052_joker_ekonomisi.sql` | Joker envanteri, denetim izi, reklam sayacı, satın almalar, `joker_kullan` ve maç kuralları |
| 2 | `20260612000053_seri_rovans_ustalik.sql` | Seri (+pg_cron 00:05), rövanş, ezeli rakip, kategori ustalığı |
| 3 | `20260612000054_hizli_mod.sql` | Hızlı Mod oturum/skor tabloları ve RPC'leri |
| 4 | `20260612000055_seri_hatirlatma.sql` | Akşam 20:00 seri hatırlatma cron'u |

### Edge Function deploy

```bash
npx supabase functions deploy satin_alma_dogrula
npx supabase secrets set PLAY_SERVICE_ACCOUNT="$(cat play-service-account.json)"
npx supabase secrets set PLAY_PACKAGE_NAME="com.idagg.bildim"   # gerçek paket adı
```

Secret'lar yoksa fonksiyon **503 + açık hata** döner; sahte onay vermez.

### Frontend ortam değişkeni

`.env` içine (bkz. `.env.example`):

```
VITE_H5_ADS_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
```

Boş bırakılırsa ödüllü video butonu **pasif** kalır ve sahte ödül verilmez.

### Google Play Console'da oluşturulacak ürünler (tüketilebilir)

| Ürün kimliği | İçerik |
|--------------|--------|
| `joker_10` | 4 × 50:50, 3 × +10 sn, 3 × pas |
| `joker_30` | 12 × 50:50, 9 × +10 sn, 9 × pas |
| `joker_100` | 40 × 50:50, 30 × +10 sn, 30 × pas |
| `seri_koruma_3` | 3 × seri koruma |

Fiyatlar **Play Console'da** belirlenir; kodda fiyat yoktur (`joker_paketleri`
tablosu yalnız kimlik ve içerik tutar, arayüz fiyatı Digital Goods API'den okur).

### Bubblewrap / TWA

Play Billing'in TWA içinde çalışması için paketlerken:

```bash
bubblewrap init --manifest https://idagg-game-center.vercel.app/manifest.webmanifest
bubblewrap build --enablePlayBilling
```

`--enablePlayBilling` olmadan `getDigitalGoodsService` tanımsız kalır ve arayüz
"Android uygulamasında satın alınabilir" der (beklenen davranış).

### Benim yapmam gerekenler

1. 052 → 053 → 054 → 055 migration'larını sırayla çalıştır (ya da bana söyle, uygularım).
2. `satin_alma_dogrula` Edge Function'ını deploy et + iki secret'ı gir.
3. Play Console'da 4 tüketilebilir ürünü oluştur ve fiyatla.
4. AdSense for Games başvurusu onaylanınca `VITE_H5_ADS_CLIENT`'ı doldur.
5. TWA paketini `--enablePlayBilling` ile yeniden üret.
6. `npm run test:bildim` ile kuralları istediğin zaman yeniden doğrulayabilirsin.

## 2026-09-08 — Migration'lar CANLIYA UYGULANDI (047–055)

Kullanıcı: *"migrationları sen uygula her zaman oto"* → bundan sonra migration'lar
onay beklemeden uygulanıyor (kalıcı tercih olarak kaydedildi).

**Uygulanan 9 migration** (tek transaction, önce `rollback` provası sonra `commit`):
047 takma_ad_gizlilik · 048 genel_kultur_kategori · 049/050/051 soru partileri 10-11-12 ·
052 joker_ekonomisi · 053 seri_rovans_ustalik · 054 hizli_mod · 055 seri_hatirlatma.
`supabase migration repair` ile geçmişe kaydedildi.

**Canlı doğrulama:**
- Soru havuzu **3.201** (genel_kultur 900, `get_categories`'te ilk sırada).
- `ulkeler` 85, `sehirler` TR 81 il, `joker_paketleri` 4 paket.
- `lig_siralama('global','tum_zamanlar')` → **17 satır** (hiç oynamamışlar ligde yok;
  `toplam_mac >= 1` olan 20 profil var, 3'ü bot).
- `envanterim`, `seri_durumum`, `ustalik_seviyelerim` (12 kategori), `hizli_mod_ozetim`
  hepsi çalışıyor.
- pg_cron'da yeni işler aktif: `bildim-seri-kontrol` (05 21 = 00:05 TSİ),
  `bildim-seri-hatirlat` (0 17 = 20:00 TSİ), `bildim-hafta-kapat`, `bildim-hafta-bildir`.

**Hâlâ uygulanmayan tek migration: 034 (`gl_temel`, Gladius).** Canlıda `gl_*` tabloları
yok; Gladius DEMO ve backend kullanmadığı için bilerek bırakıldı.

**Kalan manuel işler (kod/DB dışı):** Edge Function deploy + `PLAY_SERVICE_ACCOUNT` /
`PLAY_PACKAGE_NAME` secret'ları, Play Console'da 4 tüketilebilir ürün,
`VITE_H5_ADS_CLIENT`, Bubblewrap `--enablePlayBilling`.

## 2026-09-08 — Bildim Görev 3 / Faz 1: Yayın öncesi hatalar

**Migration numarası kararı:** prompt "055/056" diyordu ama **055 zaten
`seri_hatirlatma` olarak kullanıldı ve canlıya uygulandı**. Bu yüzden bu görevin
migration'ları **056** (kategori birleştirme), **057** (soru kalitesi) ve
**058** (bot maçı düzeltmesi) numaralarını aldı.

### 1) Lig — kendi satırı iki kez görünüyordu
`lig_siralama` çağıranı hem ilk 100'e hem sona koyuyordu; arayüz sonuncuyu ayrıca
sabitliyordu. Artık sabit satır **yalnız sıra > 100 ise** çiziliyor.

### 2) Kategori karmaşası (migration 056)
Seçicide "Karışık" + `karisik` (36 soru) + `genel` (221 soru) yan yana duruyordu.
`genel` ve `karisik` kategorilerindeki sorular `genel_kultur`'a **taşındı**;
`get_categories` bu iki anahtarı artık hiç döndürmüyor. Bağlı kayıtlar da taşındı:
`matches`, `group_matches`, `hizli_maclar`, `hizli_mod_oturumlar/skorlar`,
`matchmaking_queue`, `profiles.tercih_kategori` ve `kategori_dogru` sayaçları
(birleştirilip eski satırlar silindi). `tercih_kategori_kaydet` eski anahtarları
sessizce `genel_kultur`'a çeviriyor. Sonuç: **genel_kultur 1.154 soru**, listede ilk.

### 3) Meydan okuma akışı
Bota meydan okununca artık doğrudan `/bildim/mac/:id`'ye gidiliyor (bot daveti
saniyeler içinde kabul ediyor, maç ekranı "bekliyor" durumunu zaten gösteriyor).
İnsan rakipte **"Davet gönderildi" toast'ı** çıkıyor ve sayfa bekleyenler listesine kayıyor.

### 4) Bot maçı — bot 20 soruyu bitirirken oyuncu 2. sorudaydı (migration 058)
**Canlı veriyle doğrulandı:** aktif bir maçta bot 18. soruya kadar 19 cevap vermiş,
oyuncu 1 cevap vermişti (skor 0-65). Kök neden: bot her soruyu 3 sn sonra
cevaplıyordu ve **16 saniyelik otomatik ilerletme oyuncuyu beklemiyordu** — oyuncu
düşünürken maç kendi kendine akıyordu.
Düzeltme (`bot_oyna` 045'teki gövdeden alındı, yalnız 1v1 bölümleri değişti):
- Bot yalnız **oyuncunun ulaştığı soruyu** cevaplar (oyuncunun en yüksek cevap
  indeksi + 1) ve **2–6 sn rastgele** gecikmeyle yanıtlar.
- Otomatik ilerletme, oyuncu o soruyu cevaplamadan 16 sn'de devreye girmiyor;
  yalnız **90 sn'lik terk güvenlik ağı** kaldı (maç sonsuza kadar aktif kalmasın).
Ayrıca MatchPage'e realtime'a **ek olarak 2 sn'lik yoklama** eklendi: bağlantı
düşse bile rakip puanı canlı artmaya devam ediyor.

### 5) Soru kalitesi taraması (migration 057)
Tüm aktif havuz (3.201 soru) tarandı. **8 soru pasife alındı** (`aktif = false`;
silinmedi ki eski maçlar bozulmasın — `soru_sec` zaten `aktif` filtreliyor):
- `anlamsiz_degil_kalibi` **6** — eski üretimden kalma bozuk kalıp
  (ör. *"'Kaç Para Kaç' değil, 'Vizontele' filminin yönetmenlerinden biri kimdir?"*)
- `meta_sik` **2** — şıklardan biri "Hiçbiri"/"Hepsi" (belirsiz)

**Bilerek dokunulmayanlar (tarama uyardı ama sorular sağlam):** "3 karakterden kısa
şık" 265 soru — bunlar `Na`, `K`, `C`, `Ud`, `Ney`, `Su`, `At` gibi tamamen geçerli
cevaplar ve sayısal şıklar; körlemesine silmek yüzlerce sağlam soruyu yok ederdi.
Parantezli 37 şık meşru kullanım (`Boşluk (space)`), kapanmamış parantez hiç yok.
Boş şık, tekrar eden şık, soru işareti eksiği, 4'ten farklı şık sayısı: **0**.
Kalan aktif havuz: **3.193**.

### 6) Soru ekranı düzeni
`useOyunModu()` kancası eklendi: soru ekranı açıkken gövdeye `bd-oyun-modu` sınıfı
konuyor. CSS bu sınıfla **alt sekme çubuğunu gizliyor** ve **joker çubuğunu ekranın
altına sabitliyor**. Beş ekranda da aktif (1v1, grup, hızlı olan kazanır, turnuva,
hızlı mod). Emoji baloncukları `position: absolute` yapıldı — artık skor tablosunu itmiyor.

### 7) Turnuva sayfası
Boş ekran doldu: `TurnuvaTanitim` bileşeni **"Nasıl oynanır" 3 maddesi**, **son
turnuvanın ilk 3'ü** (madalya + avatar + doğru sayısı) ve **katılımcı sayısını**
gösteriyor. Sayaç ve lobiye katıl butonu korundu.

`npm run build` temiz.

## 2026-09-08 — Bildim Görev 3 / Faz 2: Oyun kimliği (büyük kozmetik revizyon)

**Sorun:** her şey aynı kenarlıklı mor karttı; ekran boş, doku/karakter/derinlik yoktu.

- **`bildim/styles/tema.css`** (yeni, `src/styles.css`'ten SONRA yüklenir): zemin 2 ton,
  yüzey 3 ton, anlam renkleri (mor vurgu / altın **yalnız ödül-puan** / yeşil / kırmızı /
  mavi), yarıçap (12/16/24), gölge (yumuşak + derin + renkli glow + iç parlaklık) ve
  tipografi ölçeği (Baloo 2 başlık 28/22/18, gövde 15/13/11).
- **Arka plan** düz siyahtan çıktı: üç radyal gradient (üstte mor, sağda mavi, solda altın
  lekesi) + `body::before` ile **ince nokta dokusu** (maskeli, aşağı doğru sönümlenen).
  Görsel dosya eklenmedi, tamamı CSS.
- **Kartlar zeminden ayrıştı:** kenarlık yerine yüzey gradyanı + `inset` iç parlaklık +
  yumuşak gölge. Mevcut `.kart` sınıfının görünümü de güncellendi (sınıf silinmedi).
- **Maskot "Bilge"** (`bildim/components/Maskot.jsx`): tamamen inline SVG baykuş, üç poz —
  `selam` (hafif sallanma), `dusunuyor` (düşünce baloncukları), `kutluyor` (zıplama +
  parıltı). Rütbe sistemindeki 🦉 "Bilge" ile aynı kimlikten geliyor.
  Kullanıldığı yerler: ana sayfa hero, maç sonucu (kazandın/berabere/kaybettin pozları),
  lig ve arkadaş boş durumları.
- **Ana sayfa hero** tek kompozisyon oldu: maskot + "Hoş geldin" + takma ad + rütbe rozeti
  + sağda avatar halkası, altında dev puan, rütbe ilerlemesi, seri alevi ve tek büyük
  **HEMEN OYNA** (hafif nabız animasyonu).
- **Mod kartları 6'ya çıktı ve her biri kendi renk temasını aldı:** Meydan Oku mor,
  Hızlı Mod turuncu, Grup mavi, Turnuva altın, Joker pembe, Lig turkuaz — büyük ikon +
  kısa slogan ("60 saniye", "Son kalan kazanır"). Kart üstünde temaya göre renk halesi.
- **Soru ekranı:** soru kartı büyüdü ve derinlik kazandı; zaman çubuğu artık
  **yeşil → sarı → kırmızı**; şıklar dolgun (62px) ve tam genişlik, seçince 150 ms ölçek
  animasyonu; doğruda **yeşil parlayan kenar + konfeti** (`Konfeti.jsx`, salt CSS
  parçacık, kütüphane yok), yanlışta **kırmızı sarsıntı**.
- **Skor tablosu VS oldu:** iki avatar karşı karşıya, ortada yuvarlak kırmızı "VS" rozeti.
- **Lig:** podyum kartları yükseltildi (1. altın halkalı ve yüksek kaide), sekmeler
  segment kontrol görünümü aldı, kendi satırın mor halkayla vurgulu.
- **Boş durumlar** maskot + tek cümle + eylem butonu ile dolduruldu (lig, arkadaşlar,
  En İyiler, konum seçilmemiş ekranı).
- **Mikro etkileşimler:** sayfa girişinde 150 ms fade+slide, puan sayacı (mevcut),
  rütbe atlama overlay'i (mevcut). `prefers-reduced-motion` altında maskot animasyonları,
  konfeti, sarsıntı ve nabız kapanıyor.
- **Mobil:** 400px altı için hero/mod/şık/VS/boş durum ölçekleri ayrı ayarlandı;
  tüm etkileşimli öğelere `min-height: 44px` garantisi; metin renkleri kontrast
  eşiğinin üstünde (`--bd-metin-2: #b3aad6`).
- **Eski CSS sınıflarının hiçbiri silinmedi** — tema dosyası üzerine yazıyor.

`npm run build` temiz.

## 2026-09-08 — Bildim Görev 3 / Faz 3: Kapanış + migration'lar uygulandı

`BILDIM_GOREV3.md` tüm kutular dolu, `npm run build` temiz.

**Uygulanan migration sırası: 056 → 057 → 058** (önce `rollback` provası, sonra tek
transaction `commit`, ardından `migration repair` ile geçmişe kayıt).

| Migration | Sonuç (canlı doğrulama) |
|---|---|
| 056 kategori birleştirme | `genel` + `karisik` → `genel_kultur`. Eski kategoride **0 soru**, eski `tercih_kategori` **0 kullanıcı**. `genel_kultur` **1.154 soru** ve `get_categories`'te ilk sırada. |
| 057 soru kalitesi | **8 soru pasife alındı** (`aktif = false`, silinmedi). Aktif havuz **3.193**. |
| 058 bot maçı | `bot_oyna` güncellendi: bot oyuncunun önüne geçmiyor, otomatik ilerletme oyuncuyu bekliyor. |

Joker/seri/satın alma kural testleri yeniden çalıştırıldı: **14/14 geçti**
(`npm run test:bildim`, canlı DB'de rollback ile).

**Pasife alınan 8 sorunun dökümü:** 6 × bozuk "X değil, Y" kalıbı, 2 × belirsiz
"Hiçbiri/Hepsi" şıkkı. Tarama ayrıca 265 "kısa şık" ve 37 "parantezli şık" işaretledi
ama incelendiğinde hepsi geçerli çıktı (`Na`, `K`, `Ud`, `Boşluk (space)`), dokunulmadı.

**Not:** Frontend değişiklikleri henüz **push edilmedi** — veritabanı yeni, site eski
sürümde. Push istendiğinde deploy edilecek.

## 2026-09-09 — Revize Paketi #3 + kullanıcı bildirimleri (A–D)

Canlı testte (Chrome, idagg oturumu) çıkan 6 madde + kullanıcının doğrudan
ilettiği 4 madde. Görev listesi: `BILDIM_GOREV6.md`.
**Migration:** `20260612000074_bot_zorluk_lobi_davet.sql` — **canlıya uygulandı.**

### A) Mobilde bildirim paneli yarım açılıyordu
- **Kök neden:** `.bd-zil-liste` panel `position: absolute` ile `.bd-ust-blok`
  içindeydi. Bu blok `position: sticky; z-index: 46` olduğu için kendi yığın
  bağlamını (stacking context) kuruyor; panelin `z-index: 61` değeri o bağlamın
  İÇİNDE kalıyordu. Alt menü (`.tabbar`, kök bağlamda `z-index: 50`) panelin
  altını örtüyor, `max-height: 60dvh` ile birlikte panel yarım görünüyordu.
- **Çözüm:** panel `createPortal` ile `document.body`'ye taşındı; konumu zil
  düğmesinin `getBoundingClientRect()` değerinden hesaplanıp `position: fixed`
  ile çiziliyor (`z-index: 1201`). Yükseklik `calc(100dvh - 96px - safe-area)`
  ile alt menü payını da düşüyor. Kaydırma/yeniden boyutlandırmada konum tazeleniyor.
- **Dosyalar:** `bildim/components/BildirimZili.jsx`, `src/styles.css`.

### B) Maçta son 5 saniyede ses yoktu
- **Bulgu:** projede hiç ses kodu yoktu (`grep -i audio` → 0 sonuç). Son 5 saniyenin
  yalnızca görsel efekti vardı (kızaran kenar + büyük geri sayım).
- **Çözüm:** `bildim/lib/ses.js` — WebAudio osilatörüyle üretilen tonlar (ses
  dosyası yok, PWA önbelleğine yük binmiyor). `sesTik` (son 5 sn, azaldıkça
  tizleşir), `sesSureDoldu`, `sesDogru`, `sesYanlis`.
- iOS/Android kuralı gereği AudioContext ilk kullanıcı hareketinde açılıyor
  (`sesKilidiAc`). Tercih `localStorage.bildim_ses`, varsayılan **açık**;
  Profil sayfasına "Oyun sesleri" aç/kapa kartı eklendi.
- **Bağlandığı yerler:** `QuestionCard` (turnuva/1v1/grup/hızlı maç) ve
  `HizliModPage` (soru başına 5 sn olduğu için son 2 saniyede tik).

### C) X (Twitter) / Facebook girişi — DURUM: kod hazır, panel anahtarı KAPALI
- Canlı uçtan doğrulandı:
  `GET /auth/v1/authorize?provider=twitter` → **400**, `provider=facebook` → **400**,
  `provider=google` → **302** (yalnız Google açık).
- Bu iki sağlayıcı **Supabase panelinden** (Authentication → Providers) açılır ve
  X/Meta geliştirici portalından alınan Client ID + Secret ister. SQL ya da
  veritabanı erişimiyle açılamaz; bu oturumda yapılamadı.
- **Kod tarafında yapılanlar:** `src/pages/Login.jsx` baştan sona try-catch'e
  alındı, İngilizce hata metinleri Türkçeye çevrildi ("Facebook girişi şu an
  kapalı…" gibi), düğmeler işlem sırasında kilitleniyor, `redirectTo` artık
  gelinen sayfayı koruyor, Facebook için `public_profile,email` kapsamı isteniyor.
- **Yapılması gereken (panel):** Supabase → Authentication → Providers → Twitter
  ve Facebook'u aç, Callback URL olarak
  `https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback` gir.

### D) Misafir girişi — DURUM: kod hazır, panel anahtarı KAPALI
- Canlı uçtan doğrulandı: anonim kayıt →
  `422 anonymous_provider_disabled — "Anonymous sign-ins are disabled"`.
- **Kod tarafında yapılanlar:** giriş sayfasına "Misafir olarak dene" düğmesi
  (`supabase.auth.signInAnonymously()`) + hesabın cihaza bağlı olduğunu anlatan
  not eklendi. `handle_new_user` tetikleyicisi e-postasız kullanıcıda zaten
  `oyuncu_xxxx` takma adı üretiyor, ek migration gerekmedi.
- **Yapılması gereken (panel):** Supabase → Authentication → Sign In / Providers →
  "Allow anonymous sign-ins" aç.

### 1) Hızlı Olan Kazanır'da insan hiç kazanamıyordu (ÖNCELİK)
- **Kök neden (asıl bulgu):** koşul
  `now() >= soru_baslangic + (2 + random() * 4) * interval '1 second'` biçimindeydi.
  Bu ifade `bot_oyna` HER çalıştığında yeniden değerlendirilir ve `random()` her
  seferinde YENİDEN çekilir. Yani bot "2-6 sn bekle" demiyor; her yoklamada yeni
  zar atıp ilk tutan zarda basıyor. Yoklama sıklaştıkça gerçekleşen gecikme
  2.0 sn tabanına yığılıyor — 2 sn'de basan insan, ağ/render gecikmesi yüzünden
  her seferinde geç kalıyordu. Gecikme ayrıca zorluktan tamamen bağımsızdı.
- **Çözüm:**
  - `profiles`'a `bot_seviye`, `bot_gecikme_min`, `bot_gecikme_max` eklendi.
  - `bot_rasgele(tohum)` + `bot_gecikme_sn(bot, tohum, min, max)`: gecikme md5
    ile **(maç, soru, bot) üçlüsüne sabitlendi**; kaç kez yoklanırsa yoklansın
    aynı değer döner, yığılma biter.
  - Pencereler: **Kolay 4.5–7.0 · Orta 3.0–5.0 · Zor 2.0–3.5 sn**.
  - İsabet zorluğa bağlandı: **Kolay %45 · Orta %65 · Zor %85**
    (eskiden 0.25/0.40/0.55/0.70/0.90 ve gecikmeden bağımsızdı).
  - **Kavrama payı (+1.0 sn):** pencere "oyuncu soruyu GÖRDÜĞÜ andan" tanımlı;
    sunucu ise `soru_baslangic`'tan sayıyor. Arada realtime yayını +
    `get_hizli_soru` + render var. Bu pay olmadan Zor botun 2.0 sn tabanı, 2 sn'de
    basan oyuncuyu yavaş bağlantıda hâlâ geçiyordu (ölçüldü: 5.0/20).
  - Aynı düzeltme 1v1 bot gecikmesine de uygulandı.
- **Bot atamaları:** ÇaylakBot + AcemiBot = kolay, BilgeBot + KurtBot = orta,
  UstaBot = zor.
- **DOĞRULAMA** (`node bildim/_test/hizli-bot-simulasyon.mjs`, 20 soru × 3000 tur,
  oyuncu 2 sn'de basıyor ve soruyu biliyor):

  | Senaryo | ESKİ | YENİ |
  |---|---|---|
  | Sürekli yoklama + 0.5 sn ağ | 16.8/20 (en kötü tur 11) | **20.0/20** (en kötü 20) |
  | Sürekli yoklama + 1.5 sn ağ | 4.1/20 (en kötü tur 0, %1 hiç kazanamama) | **17.2/20** (en kötü 11) |
  | 7 sn cron + 0.5 sn ağ | 19.8/20 | **20.0/20** |
  | 7 sn cron + 1.5 sn ağ | 17.9/20 | **19.8/20** |

  Kabul ölçütü (en zorlu senaryo, ortalama ≥8 ve en kötü tur ≥6): **GEÇTİ**
  → ortalama 17.1/20, en kötü tur 11/20.
- Canlı DB'de gecikme dağılımı doğrulandı (500 örnek):
  ÇaylakBot/AcemiBot 4.50–7.00 · BilgeBot/KurtBot 3.00–5.00 · UstaBot 2.00–3.50.

### 2) "Joker yok" yazıyor ama maçta joker çubuğu vardı
- **Karar: (a) — joker çubuğu bu modda gizlendi.** Gerekçe: mod tamamen
  "ilk doğru cevap kazanır" üzerine kurulu; 50:50 rakibin cevabını beklemeden
  şansı ikiye katlıyor, +10 sn ise ortak sayaçta zaten anlamsız. Jokeri açık
  bırakmak modun tek kuralını bozardı. Açıklama metnindeki "Joker yok!" cümlesi
  aynen kaldı; artık doğru.
- `QuestionCard`: `macTur !== "hizli"` koşulu eklendi (grup/turnuva/1v1 etkilenmedi).

### 3) Turnuva lobisi ölü görünüyordu
- **Eski:** `bildim-bot-turnuva` cron'u turnuvadan **30 dk önce bir kez** çalışıp
  5 botu aynı anda ekliyordu; 1 saat kala lobide tek kişi görünüyordu.
- **Yeni:** `turnuva_lobi_botlari()` + `bildim-turnuva-lobi-bot` cron'u
  (`*/10 * * * *`). Turnuvaya kalan süreye göre hedef bot sayısı hesaplanıyor,
  eksikse birer birer ekleniyor. 15 dk aralıklarla sızıyorlar:

  | Kalan süre | Lobideki bot |
  |---|---|
  | 121+ dk | 0 |
  | 120 dk | 1 |
  | 105 dk | 2 |
  | **90 dk** | **3** |
  | 75 dk | 4 |
  | 60 dk ve altı | 5 |

- **DOĞRULAMA:** formül canlı DB'de sorgulandı; **90 dk kala 3 bot** (+ oyuncunun
  kendisi = 4 kişi) doğrulandı. Sıra `bot_rasgele(turnuva_id || bot_id)` ile
  karıştırılıyor, hep aynı bot ilk girmiyor. Eski `bildim-bot-turnuva` cron'u
  emniyet ağı olarak duruyor (T-30'da eksik kalan olursa tamamlar).

### 4) Hızlı Mod'da süre bitişi sertti
- Yeni bileşen `bildim/components/SureDolduGecis.jsx`: maskot (Bilge, "düşünüyor"
  pozu) + `PuanSayaci` ile sayılan skor + bitiş sesi, **0.8 sn**.
- Hızlı Mod'a `gecis` aşaması eklendi; perde `hizli_mod_bitir` RPC'si dönmeden
  ÖNCE açılıyor (donukluk zaten RPC beklerken oluşuyordu), RPC dönünce kalan
  süre kadar bekleyip sonuç ekranına geçiyor.
- Aynı perde **1v1, grup maçı ve Hızlı Olan Kazanır** bitişlerine de eklendi
  ("Maç bitti!" + oyuncunun kendi puanı).

### 5) Bekleyen davetler birikiyor, temizlenmiyordu
- `eski_davetleri_temizle()` RPC'si: 24 saatten eski ve hâlâ `bekliyor` olan
  grup / hızlı / 1v1 davetlerini `iptal` yapar, iptal sayısını döndürür.
- İki yerden tetikleniyor: saatlik cron (`bildim-eski-davet-temizle`, `5 * * * *`)
  **ve** Meydan Oku sayfası açılışı (cron durursa liste yine temizlensin diye).
- Listede en fazla **son 5** davet gösteriliyor; üstünde "N bekleyen davet var"
  notu, altında **"Tümünü iptal et"** düğmesi.
- **DOĞRULAMA:** canlı DB'de ilk çalıştırmada **3 eski davet** iptal edildi —
  kullanıcının gördüğü birikmiş davetlerin kaynağı buydu.

### 6) Sıralamada kendi satırı yazımı
- Yeni bileşen `bildim/components/SenRozeti.jsx`; tüm liste/sıralama ekranlarında
  ad ile "sen" artık **ayrı düğümler** (metin birleştirme yok).
- Değiştirilen yerler: `LeaderboardPage`, `HizliModPage`, `HizliMacPage` (3 yer),
  `GroupMatchPage` (3 yer), `MatchPage` (3 yer) — hepsi "(sen)" ya da
  `<span className="bd-sen">` yazıyordu.
- `.app .bd-sen` kuralı `tema.css`'e eklendi: `display: inline-block`, mor
  gradyan hap, kenarlık — rozet artık her yerde rozet gibi görünüyor.

### Dokunulmayanlar
Kullanıcının "bu turda çalıştığı doğrulandı" dediği hiçbir akışa dokunulmadı:
Hızlı Mod tur akışı, lig 4 sekmesi, joker dükkânı, ana sayfa, modal konumları,
arkadaş ekleme doğrulaması, manifest, grup maçı bot ilerlemesi.

### Kalan iş (kullanıcı aksiyonu gerektirir)
1. Supabase → Authentication → Providers: **Twitter** ve **Facebook** aç
   (X/Meta geliştirici portalından Client ID + Secret gerekiyor).
2. Supabase → Authentication: **Allow anonymous sign-ins** aç (misafir girişi).
   İkisi de panel anahtarı; kod tarafı hazır ve kapalıyken dürüst mesaj veriyor.

## 2026-09-09 (2. tur) — Bildirim paneli taşması + bot bildirim gürültüsü

**Migration:** `20260612000075_bildirim_gurultusu.sql` — **canlıya uygulandı.**

### 1) Panel mobilde ekranın soluna taşıyordu
- **Kanıt (kullanıcı):** ~412px genişlikte satır başları kesiliyordu —
  "UstaBot" → "staBot", "sillaaa" → "illaaa", "BilgeBot" → "ilgeBot".
- **Kök neden:** panel `right` değeri JS'ten zil düğmesinin konumuna göre
  veriliyor, genişlik ise `min(340px, 100vw - 24px)` ile SABİT ayarlanıyordu.
  Sağa yaslı sabit genişlik + zilin sağ kenar payı toplamı dar ekranlarda
  viewport'u aşıyor, panel sola kayıyordu.
- **Çözüm:**
  - JS artık yalnız **dikey** konumu ölçüyor (`top`); yatay yerleşim tamamen CSS'te.
  - Mobil (<600px): `position: fixed; left: 8px; right: 8px; width: auto` —
    sağa yaslanmak yerine iki kenardan boşluklu.
  - Geniş ekran (≥600px): `right: 16px; width: min(360px, 92vw)`.
  - `max-width: calc(100vw - 16px)`, `max-height: 60vh` + kendi içinde dikey kaydırma.
  - `.bd-zil-satir .metin`: `overflow-wrap: anywhere` + `word-break: break-word`;
    `.govde` için `flex: 1` — uzun takma adlar kesilmiyor, sarılıyor.
- **DOĞRULAMA** (Chrome, gerçek `getBoundingClientRect()` ölçümü; derlenmiş
  `index.css` ile üç ayrı iframe genişliğinde):

  | Viewport | panel.left | panel.right | genişlik | `left>=0 && right<=innerWidth` | metin taşması |
  |---|---|---|---|---|---|
  | 360px | 8 | 352 | 344 | **true** | yok |
  | 412px | 8 | 404 | 396 | **true** | yok |
  | 768px | 392 | 752 | 360 | **true** | yok |

  Satır metinleri de ayrıca ölçüldü; üç genişlikte de hiçbir metin kutusu
  viewport dışına çıkmıyor.

### 2) Bot bildirimleri gerçek bildirimleri boğuyordu
- **Kanıt (kullanıcı):** panelde üst üste 5 adet "<Bot> hamlesini yaptı — sıra
  sende!"; aralarında kaybolmuş gerçek olaylar (meydan okuma, seri, ustalık).
- **Kök neden:** `trg_mac_sira_bildir` ilerleyen tarafın bot olup olmadığına
  bakmıyordu. Bot her tikte bir soru ilerlettiği için 20 soruluk maç boyunca
  oyuncuya defalarca "sıra sende" düşüyordu. Bot zaten her an hazır — bildirimin
  bilgi değeri yok.
- **Sunucu tarafı (`20260612000075`):**
  - Tetikleyiciye bot kontrolü eklendi: **bot ilerlemesi bildirim üretmiyor.**
    Yalnız gerçek oyuncu hamle yapınca bildirim çıkıyor.
  - Birikmiş bot kaynaklı `sira_sende` kayıtları silindi (maç kaydından rakibin
    `is_bot` değerine bakılarak).
  - `bildirim_temizle()`: **7 günden eski OKUNMUŞ** bildirimler siliniyor.
    Okunmamışlara dokunulmuyor (kullanıcı görmediği olayı kaybetmesin).
    İki yerden tetikleniyor: günlük cron `bildim-bildirim-temizle` (`20 3 * * *`)
    **ve** `bildirimleri_oku()` içinde (panel her açılışında).
- **İstemci tarafı (`BildirimZili.jsx`):**
  - **Öncelik sırası:** meydan okuma / davet / arkadaşlık isteği (0) >
    rozet-seviye (ustalık, lig, hafta sonucu) (1) > seri (2) > sıra sende (3).
    Okunmamışlar her zaman en üstte; eşitlikte en yeni önce.
  - **Toplama:** aynı türden birden fazla OKUNMAMIŞ bildirim tek satıra iniyor —
    "3 maçta sıra sende ⏳", "2 yeni meydan okuma ⚔️" gibi; satır ilgili
    listeye götürüyor. Okunmuşlar tek tek kalıyor.
- **DOĞRULAMA (canlı DB):**
  - Temizlik öncesi `sira_sende` = **5**, sonrası = **1**;
    kalan tek kayıt gerçek oyuncudan (`idagg hamlesini yaptı`, `rakip_bot = false`).
  - Yani panelde bot kaynaklı "sıra sende" bildirimi **kalmadı**; gerçek olaylar
    (mac_daveti, ustalik, arkadas_istek) öncelik sırasıyla üstte.
  - `bildim-bildirim-temizle` cron kaydı doğrulandı (`20 3 * * *`).

## 2026-09-09 (3. tur) — "AI yapımı" görünümünü kırma paketi (kozmetik)

Görev listesi: `BILDIM_GOREV7.md`. Migration YOK — tamamı arayüz.
Kapsam yalnız `bildim/` + paylaşılan giriş sayfası ve manifest dosyaları.
(`src/pages/GameCenter.jsx` ve `BirlesikSiralama.jsx` hub'a ait; dokunulmadı.)

### 1) Palet — mor tamamen kaldırıldı

| Rol | ESKİ | YENİ |
|---|---|---|
| Zemin | `#0d0b1f` / `#0b0918` (koyu mor) | **`#0B1220`** (gece lacivert) |
| Zemin 2 | `#161330` / `#120e26` | **`#131C31`** |
| Yüzey 1 (kart) | `#1a1635` / `#191333` | **`#18233B`** |
| Yüzey 2 | `#1f1b40` / `#221a44` | **`#1F2C4A`** |
| Yüzey 3 | `#2c2255` | **`#27365A`** |
| Kenarlık | `#2e2856` | **`#26344F`** |
| Ana vurgu | `#8b5cf6` (mor) | **`#F2B23C`** (altın) |
| Vurgu 2 | `#6d28d9` | **`#C98A22`** |
| Vurgu açık | `#a78bfa` | **`#F7CB77`** |
| Ödül/puan | `#fbbf24` / `#ffc83d` | **`#F2B23C`** |
| Başarı | `#22c55e` / `#2ecc71` | **`#2FBF71`** |
| Hata/uyarı | `#ef4444` / `#ff5a5f` | **`#E8543F`** (mercan) |
| Bilgi | `#38bdf8` / `#22d3ee` | **`#4A9DD9`** |
| Metin | `#f1efff` / `#f3f0ff` | **`#EAF0FA`** |
| Metin 2 | `#b3aad6` | **`#A8B8D0`** |
| Metin 3 | `#8d84b5` | **`#8496B2`** |

- Kategori renkleri de yeniden atandı (10 kategori, hiçbiri mor):
  genel kültür `#4A9DD9`, bilim `#2FBF71`, tarih `#C98A22`, coğrafya `#3FA9A0`,
  edebiyat `#E8543F`, spor `#5AA9E6`, sanat `#E0729A`, sinema `#8C93A8`,
  müzik `#F2B23C`, teknoloji `#4FB3C9`.
- **Gradient sayısı: 184 → 22 satır (%88 azalma).** Kalanlar: zemin (2 body
  kuralı), tek birincil buton, maskeler (`mask-image`) ve kapsam dışı `.gc-*`
  hub kartları. Kart / ikon plakası / rozet gradientlerinin tamamı düz renge indi.
- **Renkli glow yalnız `.bd-ana-eylem`'de** (`--bd-glow-odul`). Diğer 19 renkli
  `box-shadow` düz siyah, düşük opaklık, kısa yayılıma çevrildi.
- `theme-color` meta + `manifest.webmanifest` + `bildim.webmanifest` + JS'teki
  `BILDIM_TEMA` → `#0B1220`.
- **DOĞRULAMA:** `grep -ri "7c4dff|8b5cf6|a78bfa|6d28d9|c4b5fd|5b21b6|46179c|1c1642|
  rgb(139,92,246)|rgb(167,139,250)|rgb(109,40,217)" bildim/ src/styles.css src/pages`
  → **0 sonuç**. Tarayıcıda çalışan stil sayfalarında mor kural sayısı: **0**.
  Hesaplanan `body` zemini: `rgb(11, 18, 32)`.
  (Ara adımda gözden kaçan 8 alfa'lı mor yüzey — `rgba(26,20,54,…)` gibi — ve
  buton gölgesindeki `#46179c` canlı tarayıcı ölçümüyle yakalanıp düzeltildi.)

### 2) Emojiler silindi, yerine özel ikon seti

- **`bildim/components/Ikon.jsx` — 41 çizgi ikon** (2px kontur, yuvarlak uç,
  `currentColor`, 24px kutu, dolgu yok): ev, kupa, kılıç, oyun kolu, grafik,
  kişiler, kişi, kişi ekle, zil, yıldız, ateş, kalkan, madalya, uyarı, terazi,
  saat, ileri atla, hızlı, soru, robot, sohbet, şehir, dünya, harita pini,
  bayrak, kilit, onay, çarpı, ok, geri, artı, yenile, çöp, paylaş, ayar,
  hediye, ses açık, ses kapalı, liste, kalem, çıkış.
- **`bildim/components/KategoriIkon.jsx` — 12 dolgu kategori ikonu** (beyin,
  atom, sütun, küre, kitap, top, palet, film şeridi, nota, çip, kadeh),
  her biri kendi kategori renginde plakada (`plaka` özelliği).
- **Emoji sayımı: 309 satır → 15 satır.** Kalan 15'in tamamı bilinçli:
  5 kod yorumundaki `→` okları, 2 ülke bayrağı fallback'i (`konum.js` — bayrak
  emojisi ülkeyi kodlayan **veri**, süs değil), 8 maç içi tepki satırı
  (`EMOJILER` dizisi + tepki cümleleri = kullanıcı içeriği, kalması istenmişti).
- Rütbe ve joker tabloları da emoji yerine ikon ADI tutuyor
  (`ranks.js`, `jokerler.js`); `kategoriEtiket()` artık emoji öneki eklemiyor.

### 3) Açıklama metinleri silindi
- Mod kartlarındaki **6 slogan** kaldırıldı: "Arkadaşını yen", "60 saniye",
  "3-5 kişi", "Son kalan kazanır", "Güçlen", "Sıranı gör". Kartta yalnız
  ikon + mod adı kaldı (`.bd-mod-slogan` CSS'te de gizlendi).
- Aynı refleksle yazılmış **5 yardımcı cümle** silindi/kısaltıldı:
  - "Bu kodu ya da linki arkadaşına gönder; seni eklesin. Gerçek adın görünmez." → silindi
  - "Hesap kimliğin: … (yalnızca sana görünür)" → silindi
  - "Açık — son 5 saniyede geri sayım tik'i, cevapta ve bitişte ses." → "Açık"
  - "Açık — turnuva ve meydan okumalardan haberin olur." → "Açık"
  - "Davet linkinle gelen her arkadaş için ikiniz de +50 puan kazanırsınız!"
    → "Her davet için ikiniz de +50 puan."
- Buton metinleri kısaldı: "🎟️ Lobiye Katıl" → "Lobiye katıl",
  "⚔️ Meydan Oku" → "Meydan oku", "🚀 Grubu Kur ve Davet Et" → "Grubu kur ve
  davet et", "⚔️ RÖVANŞ İSTE" → "Rövanş iste", "HEMEN OYNA" → "Hemen oyna".
- **Toplam silinen/kısaltılan metin: 11 + 5 buton etiketi.**

### 4) Kart kalıbı kırıldı — ritim
- **Hero:** kart değil. `background: none`, kenarlık yok, gölge yok; sayfa
  dolgusunun dışına taşıp `.app` sütununun tamamını kaplıyor, altında tek ince
  çizgi. Altın büyük puan + ince rütbe çubuğu (5px).
  (İlk denemede `calc(50% - 50vw)` ile viewport'a taşırıldı; masaüstünde kaydırma
  çubuğu kadar sola kayma ölçüldü — `margin: 0 -12px` ile düzeltildi.)
- **Mod ızgarası:** 2 sütun ama kartlar EŞİT DEĞİL. İlk kart (Meydan Oku) ve son
  kart (Lig) `grid-column: span 2` ile çift genişlikte ve yatay dizilimli;
  diğer dördü 1.45:1 küçük kart. Kartlar arası boşluk 8px.
- **Turnuva:** dikey kart yerine **yatay bant** — etiket + sayaç solda, buton
  sağda, `flex-wrap: nowrap`. Sayaç kutuları küçültüldü ki buton alta düşmesin.
- **Lig özeti:** kart değil, üç sütunluk ince bant (şehir / ülke / dünya sırası,
  altın rakam + küçük etiket).
- **Günlük görevler:** zaten katlanmış tek satırdı, korundu.
- Dikey boşluklar ~%30 azaldı: sayfa dolgusu 16 → 12px, kart dolgusu 16 → 12px,
  kartlar arası 14 → 10px, başlık marjı 20/10 → 14/8px.

### 5) Arka plan
- İki `body` kuralındaki 7 renk lekesi (mor + camgöbeği + sarı radyaller) tek
  altın radyal ışığa indi; altta koyulaşan dikey geçiş kaldı.
- `body::before` nokta dokusu yerine **135° ince köşegen çizgi**
  (`repeating-linear-gradient`, opaklık **0.03**, 9px aralık), aşağı doğru
  maskeli sönüm. Görsel dosya eklenmedi.

### 6) Logo
- `bildim/components/Logo.jsx`: gradient renkli düz metin yerine **çizilmiş
  SVG wordmark** — kalın harfler, altın ve 8° eğik "!" (ayrı iki dikdörtgen),
  harflerin altında ince altın çizgi. Üst çubukta (24px) ve giriş ekranında (44px).

### 7) Maskot
- `Maskot.jsx` sıfırdan yeniden çizildi: yuvarlak-şirin baykuş (Duolingo
  çağrışımı) yerine **köşeli/geometrik kuş** — altıgen lacivert gövde, üçgen
  kanat panelleri, altın üçgen gaga ve boynuzlar, gözler yalnız iki daire.
  Gradient ve arka ışık kaldırıldı. Üç poz korundu (selam / düşünüyor / kutluyor).
- Varsayılan boyut **96 → 64**; bitiş perdesinde 92 → 64. Artık odak değil aksan.

### 8) Ses
- `bildim/lib/ses.js` genişletildi (WebAudio, ses dosyası yok):
  `sesDokunus` (kısa klik), `sesDogru` (yükselen üçlü), `sesYanlis` (alçalan tek
  nota), `sesTik` (son 5 sn), `sesSureDoldu`, `sesKazandin` (üç notalı arpej),
  `sesRutbeAtladi` (yükselen dörtlü).
- **Üst çubukta aç/kapa düğmesi** (`SesDugmesi.jsx`); tercih `localStorage`da
  (`bildim_ses`), varsayılan **AÇIK**. AudioContext ilk kullanıcı hareketinde
  try-catch içinde açılıyor (tarayıcı kısıtı).
- Bağlandığı yerler: `QuestionCard` (tik/doğru/yanlış/süre doldu),
  `SureDolduGecis` (`kazandi` ise arpej), `RankUpOverlay` (rütbe atlama),
  Profil sayfası ve üst çubuk düğmesi.

### 9) Detay temizliği
- Yarıçap karışık: kart 12px, buton/şık 10px, rozet-çip-zil tam yuvarlak
  (eski tek tip 16/24px yerine).
- Gölge: renkli glow yerine düz siyah, düşük opaklık, kısa yayılım
  (`0 2px 6px rgba(0,0,0,.32)` / `0 6px 16px rgba(0,0,0,.42)`).
- Tipografi: Baloo 2 yalnız hero, mod adları ve büyük sayılarda; bölüm
  başlıkları gövde fontuna, 15px, `text-transform: none` oldu.
  Büyük harf + geniş harf aralığı yalnız küçük etiketlerde (mini label).
- Mod ikon plakaları artık mod temasının rengini alıyor (`--tema-ikon`);
  önce hepsi altın çıkıyordu, canlı ölçümle yakalandı.

### DOĞRULAMA (Chrome, derlenmiş `index.css` ile gerçek ölçüm)
Beş genişlikte (360 / 390 / 412 / 768 / 1280 px):
- **Yatay taşma: yok** (`documentElement.scrollWidth <= innerWidth` hepsinde).
- **44px altı dokunma hedefi: yok** (tüm `button`/`a` ölçüldü).
- Hero `left: 0`, genişlik = sütun genişliği; mod ızgarasında geniş kart
  351px / küçük kart 172px (390px'te) — dengesizlik amaçlandığı gibi.

Kontrast (WCAG AA eşiği 4.5):

| Öğe | Oran |
|---|---|
| Gövde metni | **7.83** |
| Küçük etiket (PUAN) | **6.23** |
| Altın puan | **9.99** |
| Bölüm başlığı | **16.35** |
| Lig bandı etiketi | **5.20** |
| Liste detayı | **6.54** |
| Turnuva etiketi | **5.20** |

Hepsi eşiğin üzerinde.

### Sayılarla özet
- Palet: **13 renk tokenı** değişti, mor kalıntısı **0**.
- Gradient: **184 → 22** satır (%88 ↓). Renkli glow: **20 → 1**.
- Emoji: **309 → 15** satır (kalanlar kod yorumu, ülke bayrağı, maç içi tepki).
- Yeni ikon: **41 çizgi + 12 kategori = 53 SVG**.
- Silinen/kısaltılan metin: **11 açıklama + 5 buton etiketi**.
- Yeni bileşen: `Logo.jsx`, `KategoriIkon.jsx`, `SesDugmesi.jsx`.

## 2026-09-09 (4. tur) — İsim/şehir değiştirme + canlı site denetimi

Migration'lar: `076_isim_sehir_degistirme`, `077_bot_avatarlari_yerel`,
`078_kilit_sifirla` — **üçü de canlıya uygulandı**.
Canlı adres: `https://idagg-game-center.vercel.app`.

### 1) Oyun içinde isim ve şehir değiştirme
- **Bulgu (canlı):** Profil sayfasında "Takma adın · **29 gün 1 saat** ·
  Değiştir (pasif)" yazıyordu. Sunucuda kilit **30 gün**, konumda **7 gün**.
  Yani özellik vardı ama pratikte kullanılamıyordu.
- **Karar:** kilitler taklit/lig sömürüsüne karşı var, kaldırılmadı; ikisi de
  **24 saate** indirildi (076). Doğrulama, benzersizlik, yasaklı kelime ve
  şehir listesi kuralları aynen korundu.
- **İkinci bulgu:** kilit penceresi kısalınca bile mevcut sayaçlar ESKİ kural
  altında işlemişti; 078 ile gerçek oyuncuların sayaçları bir kez sıfırlandı.
- **Keşfedilebilirlik:** Profil'e yalnız üst çubuktaki puan çipinden
  gidilebiliyordu, alt menüde girişi yok. Üst çubuğa **avatar düğmesi** eklendi.
- **DOĞRULAMA (canlı):** kilit "29 gün 1 saat" → "55 dk" → 078 sonrası açık.
  Değiştir formu açıldı; "ab" gönderildi → sunucudan
  `Takma ad 3-16 karakter olmalı.` döndü (RPC yolu çalışıyor). Şehir formu da
  ülke/şehir açılır listeleriyle açılıyor.
- Arayüzdeki 4 kilit metni sunucuyla çelişiyordu ("30 günde bir",
  "Haftada yalnızca bir kez"); dördü de "günde bir kez" oldu.

### 2) Canlı sitede bulunan ve düzeltilen kusurlar
Sayfa sayfa gezilip (ana, meydan, lig, joker, turnuva, arkadaşlar, hızlı mod,
profil, 1v1 maç) ölçüldü:

| # | Bulgu | Düzeltme |
|---|---|---|
| 1 | Maç ekranındaki **cevap şıkları hâlâ mordu** (`#2a2156`), şık harfi `#4c1d95`, ikincil buton `#2a2154`, davet bandı, toast, bağlantı rengi | Renk **tonu** taramasıyla (hex + rgb, hue 245-315) 28 değer bulundu; lacivert/altına çevrildi |
| 2 | **Podyum puanı ve turnuva başlığı kırmızıydı** — `--accent` mercana bağlanmıştı | `--accent` altın oldu; hata rengi ayrı (`--danger`) |
| 3 | **"sen" rozeti** altın zeminde beyaz metin — ölçülen kontrast **1.87:1** | Koyu lacivert metin (aynı düzeltme aktif sekme ve podyum kaidesinde) |
| 4 | Hero'da **rütbe çipi 378px gerilmişti** (sütun flex'inde stretch) | `align-self: flex-start; width: fit-content` |
| 5 | Üst çubukta **dokunma hedefleri 44px altında** (logo 24px, puan çipi 32px) | `min-height: 44px` |
| 6 | Maçta **soru sayacı rozeti kırmızıydı** (`--bd-hata`) — hata gibi okunuyordu | Nötr yüzey + altın metin |
| 7 | Profilde **"Sonraki rütbe: kılıç Üstat"** — ikon adı ham metin olarak basılıyordu | `<Ikon>` ile çiziliyor |
| 8 | **Arkadaş silme** tek dokunuşla, onaysız ve geri dönüşsüzdü; düğmenin erişilebilir adı da yoktu | Onaylı iki adım (Sil / Vazgeç) + `aria-label`/`title` |
| 9 | **Bot avatarları dış CDN'den** (`api.dicebear.com`) geliyordu: dış bağımlılık + mor robotlar | Yerel `public/avatars/bot1..5.svg`, palete uygun (077) |
| 10 | Oyuncu avatarlarından **av1 mor, av8 indigo** | Altın ve turkuaza alındı |
| 11 | Kategori **"Karışık" ikonu kadeh**ti, turnuva kupasıyla karışıyordu | Dört kare (zar) |
| 12 | Ustalık seviye renkleri ve RankBadge iç dolgusunda mor kalıntı | Palete alındı |

### Ölçüm (canlı, tarayıcıda hesaplanmış)
- Alfa kompozitli kontrast denetimi: sayfa başına **4 hata** bulundu
  (podyum puanı 4.37, "sen" rozeti 1.87) — ikisi de düzeltildi.
- Yatay taşma: hiçbir sayfada yok.
- Etiketsiz ikon butonu taraması: düzeltmeden sonra **0**.
- Mor tonu taraması (hue 245-315, doygunluk > 0.18) `bildim/`, `src/styles.css`
  ve `public/avatars/` üzerinde: **kapsam içinde 0 sonuç**
  (kalan tek yer `.run-serit` — RUN oyununun hub kartı, Bildim kapsamı dışı).

### Not edilen, değiştirilmeyen
- Asenkron 1v1'de rakip bot kendi sırasını oynadığı için maç başında skor
  "0 - 16" görünebiliyor. Tasarım gereği (bot oyuncunun sırasını geçemiyor,
  yalnız bir soru önde). Rakip skorunu maç bitene kadar gizlemek deneyimi
  değiştireceğinden bu turda dokunulmadı.

## 2026-09-09 (5. tur) — 31 karakter avatarı

Migration: `079_yeni_karakter_avatarlari` — **canlıya uygulandı**.

### İstek ve karar
Kullanıcı "avatar fotoğrafları yükleyelim, şu ankiler berbat; gerçek görseller
olabilir, ünlüler, komik içerikler, 20-30 tane" dedi.

**Gerçek ünlü fotoğrafları kullanılmadı.** Telifli bir fotoğrafı ve bir kişinin
görüntü/kişilik hakkını oyuna gömmek olurdu; oyun yayına açık ve mağazaya
gidecek. Yerine aynı işi gören ve tamamen özgün olan yol seçildi: **31 karakterli
komik çizim avatar**.

### Üretilenler (`public/avatars/k01..k31.svg`)
Hayvanlar: kedi, köpek, baykuş, tilki, panda, penguen, kurbağa, ayı, maymun,
dinozor, ejderha, köpekbalığı, ahtapot, arı.
Karakterler: robot, uzaylı, astronot, ninja, korsan, şövalye, büyücü, dedektif,
aşçı, profesör, viking, hayalet, zombi, mumya, kahraman, palyaço, kral.

- Toplam **~130 KB**, hepsi **yerel** (dış servis / CDN yok).
- 34px avatarda da 92px profil resminde de okunur (ikisi de önizlemede ölçüldü).
- Palet gece lacivert + altın ailesiyle uyumlu; **mor kullanılmadı**.
- Üretici `bildim/_test/avatar-uret.mjs` olarak repoda: göz / ağız / kulak /
  şapka gibi **parça fonksiyonlarından** kuruluyor, yeni karakter eklemek tek
  satırlık bir tanım.

### Önizlemede yakalanıp düzeltilenler
Üretilen 31 avatar bir önizleme sayfasında 96px ve 34px olarak yan yana
incelendi; dördü ilk çıkışta okunmuyordu:
- **profesör** koyuna benziyordu (saç tepeyi de kapatıyordu) → saç yalnız
  yanlarda, sakal küçültüldü.
- **mumya**da sargı rengi kafa rengiyle aynıydı, sargılar görünmüyordu →
  kafa koyulaştı, sargılar açıldı, aralarına gölge çizgisi eklendi.
- **astronot**un kask camı yüzü soluklaştırıyordu → cam saydamlaştı, altın
  çember eklendi.
- **köpek** ayıya benziyordu → açık renk burun bölgesi eklendi.

### Bağlantı
- Profil ve kurulum sihirbazındaki seçici 31 karaktere geçti; **5 sütun**,
  kart içinde kendi kaydırması (`max-height: 46vh`), her karo `aria-label` +
  `title` taşıyor ("Kurbağa avatarını seç").
- Eski düz siluetler (av1-av8) listeden çıkarıldı; **dosyalar duruyor**.
  Migration 079 o siluetleri seçmiş oyuncuları yeni karşılıklarına taşıdı.
- **Canlı doğrulama:** 31 karo, **31/31 görsel yüklendi**, kırık yok.
  İlk denemede yalnız seçili avatar görünüyordu: kaydırılabilir kutu içindeki
  `loading="lazy"` görselleri yüklemiyordu; kaldırıldı.

## 2026-09-09 (6. tur) — Yayın öncesi güvenlik denetimi

Migration'lar: `080_gizli_anahtar_tablosu`, `081_profil_gizliligi` — **ikisi de
canlıya uygulandı.** Tam liste: `YAYIN_KONTROL.md`.

### 🔴 Bulgu 1 — Sunucu sırrı herkese açık depoda
`CRON_SECRET` yedi migration dosyasına düz metin yazılmıştı ve depo GitHub'da
public (`"private": false` API'den doğrulandı; ham dosya anonim olarak
**200** ile indirilebiliyor).
**Etki, canlı uçta doğrulandı:** repodaki sırla
`POST /functions/v1/send-push` → **200**, yanlış sırla → **401**. Yani üçüncü
bir kişi tüm kullanıcılara istediği push bildirimini gönderebilir ve
`generate-questions`'ı tetikleyip Anthropic kredisi yakabilirdi.
**Düzeltme:** RLS'li, tüm rollerden revoke edilmiş `sunucu_gizli` tablosu +
`gizli_al()` kapısı. Canlıdaki 6 fonksiyon (`bildirim_yaz`,
`haftalik_sonuc_bildir`, `notify_new_challenge`, `notify_new_group_challenge`,
`notify_new_hizli_davet`, `seri_hatirlat`) `pg_get_functiondef` üzerinden
okunup literal, tablo okumasıyla değiştirilerek yeniden yazıldı.
Doğrulandı: sır içeren fonksiyon **0**.
**Kalan:** sır git geçmişinde durduğu için döndürülmeli — panel adımı
kullanıcıda (YAYIN_KONTROL B1).

### 🔴 Bulgu 2 — Profil verileri girişsiz okunabiliyordu
`profiles` politikası `using (true)`, SELECT `anon` rolüne de veriliydi.
Anon anahtar JS paketinde olduğundan giriş yapmadan
`GET /rest/v1/profiles?select=*` → **27 kaydın tamamı**: gerçek addan türeyen
`username` ("emiralkaya_12cd", "hanıfebatur_6d46"), Google profil fotoğrafı
adresi, `davet_kodu`, `provider`, `last_seen`, `hile_yetkisi`.
Uygulama ekranda "gerçek adın hiçbir zaman gösterilmez" sözü veriyordu;
API seviyesinde tutulmuyordu (KVKK/GDPR açısından da yayın engeli).
Ayrıca `anon` ve `authenticated` rollerinde profiles üzerinde
INSERT/DELETE/**TRUNCATE**/TRIGGER/REFERENCES yetkileri vardı; TRUNCATE
RLS'e tabi değildir.
**Düzeltme:** anon erişimi tamamen kaldırıldı; `authenticated` yalnız gösterim
sütunlarını okuyor (`id, gorunen_ad, gorunen_avatar, puan, ...`); kendi tam
profil `profilim()` RPC'siyle geliyor; yazma yetkisi 3 sütuna indirildi.
Doğrulandı: anon için `42501 permission denied`; giriş yapmış oyuncuda ana
sayfa, lig ve maç ekranları çalışıyor.

### Yan bulgu — Kafa Topu
Oyuncu adı için `profiles.username` okuyup **doğrudan tabloya yazıyordu**;
uzunluk, benzersizlik, yasaklı kelime ve günlük kilit kontrollerinin hepsini
atlıyordu. `gorunen_ad` okumasına ve `takma_ad_sec` RPC'sine geçirildi
(5 dosya, 13 yer).

### Eklenen üretim altyapısı
- **`HataSiniri`**: projede hiç hata sınırı yoktu; render hatası tüm ağacı
  söküp beyaz ekran bırakıyordu. Artık Türkçe kurtarma ekranı + konsol kaydı.
- **`og:`/`twitter:` etiketleri**: link paylaşımında önizleme boştu.
- **`robots.txt` + `sitemap.xml`**: yoktu.
- Lig sayfasındaki kalan tek emoji (kum saati) ikona çevrildi.

### Denetimde temiz çıkanlar
- `public` şemasındaki **tüm tablolarda RLS açık**; politikasız olanlar
  (questions, push_subscriptions, quest_progress, question_votes,
  matchmaking_queue, yasakli_kelimeler) yalnız security-definer RPC üzerinden
  erişilebiliyor — doğru kurgu.
- pg_cron: **17 görevin hepsi aktif**.
- Depoda TODO/FIXME yok, `console.log` yok, `.env` git'e girmiyor,
  istemci kodunda service_role/API anahtarı sızıntısı yok.
- 8 Bildim sayfası 390px'te yatay taşmasız açılıyor; boş/hatalı ekran yok.
- Soru havuzu 8.224 aktif.

### Yayını engelleyen, panelde yapılacaklar
1. `CRON_SECRET` döndürme (Supabase → Edge Functions → Secrets).
2. Depoyu private yapma.
3. Twitter/Facebook + misafir girişini açma.
4. Gizlilik politikasında veri sorumlusu kimliği + **Kullanım Koşulları sayfası
   (hiç yok)**.
5. Reklam yayıncı kimliği (`VITE_H5_ADS_CLIENT` boş → test modu) ve
   Play faturalandırma paketlemesi.
6. Kendi alan adı.

---

## 2026-09-09 — BİLDİM: "Hatalarım" çalışma modu (GÖREV 10)

Oyuncunun tüm modlarda yanlış bildiği sorular kişisel bir bankada birikiyor; oyuncu
istediğinde bu bankadan **puansız, tek kişilik** bir çalışma turu yapıyor.

### Yeni tablolar

| Tablo | İçerik | RLS |
|---|---|---|
| `yanlis_sorular` | pk (user_id, question_id), `yanlis_sayisi`, `dogru_serisi`, `son_yanlis_at`, `ogrenildi_at` | Yalnız sahibi **okur**; INSERT/UPDATE politikası bilerek yok — yazım security-definer RPC ile |
| `calisma_oturumlari` | `soru_ids`, `banka_ids`, `aktif_soru`, `soru_baslangic`, `dogru`, `yanlis`, `ogrenilen`, `durum` | Yalnız sahibi okur |

### Yeni RPC'ler (hepsi `security definer`, yalnız `authenticated`)

| RPC | İş |
|---|---|
| `yanlis_kaydet(question_id)` | Satır yoksa ekler, varsa `yanlis_sayisi+1`, `dogru_serisi=0`, `ogrenildi_at=null`. Botları ve silinmiş soruları atlar; hata yutulur ki maç akışı bozulmasın |
| `calisma_baslat(p_kategori, p_soru_sayisi)` | Önce bankadan (öğrenilmemiş, `son_yanlis_at` eskiden yeniye + `yanlis_sayisi` çoktan aza), yetmezse `soru_sec` ile havuzdan tamamlar. Dönen: oturum, bankadan/havuzdan adet |
| `calisma_soru(p_oturum_id)` | Soruyu **doğru cevapsız** döner; `bankadan`, `onceki_yanlis`, `dogru_serisi` bilgisini verir |
| `calisma_cevap(p_oturum_id, p_soru_index, p_cevap)` | Süre ve doğruluk **sunucuda**. Doğruysa seri+1, 2'ye ulaşınca `ogrenildi_at=now()`; yanlışsa seri sıfır + `yanlis_kaydet`. Doğruda `kategori_dogru_arttir` |
| `calisma_bitir(p_oturum_id)` | Tur özeti: doğru/yanlış, öğrenilen, bankada kalan, toplam öğrenilen |
| `yanlis_bankam()` | Toplam / öğrenilen / bekleyen + kategori kırılımı |
| `mac_yanlis_sayim(p_mac_tur, p_mac_id)` | Maç sonu satırı için yanlış adedi (1v1 / grup / turnuva / hızlı) |

### Dokunulan cevap RPC'leri

Gövdeleri birebir korunarak yalnız yanlış dalına `perform public.yanlis_kaydet(q.id)` eklendi
(migration **20260612000105**):

| RPC | Mod | Dosya |
|---|---|---|
| `submit_match_answer` | 1v1 | `supabase/migrations/20260612000105_hatalarim_cevap_kancalari.sql` |
| `submit_group_match_answer` | Grup maçı | aynı dosya |
| `submit_tournament_answer` | Turnuva | aynı dosya |
| `submit_hizli_cevap` | Hızlı Olan Kazanır | aynı dosya |
| `hizli_mod_cevap` | Hızlı Mod (60 sn) | aynı dosya |

`match_answers` tablosunda `question_id` yok (yalnız `soru_index`); kayıt bu yüzden
question_id'nin zaten bilindiği cevap RPC'sinden yazılıyor — tabloya kolon eklenmedi.

### Geriye dönük doldurma — YAPILDI

`soru_index` + üst kaydın `soru_ids` dizisi eşlemesi dört modda da mümkün olduğu için tek
seferlik doldurma çalıştırıldı: `match_answers`, `group_match_answers`, `tournament_answers`,
`hizli_cevaplar`. Aynı soru birden çok kez yanlışsa `yanlis_sayisi` toplandı, en yeni tarih alındı;
botlar ve silinmiş sorular dışarıda bırakıldı.

**Sonuç: 329 satır / 17 kullanıcı.** Kategori dağılımı: tarih 69, bilim 55, coğrafya 54,
genel_kultur 42, edebiyat 35, sanat 32, … (`hizli_mod_oturumlar` soru bazlı cevap tutmadığı için
Hızlı Mod geçmişi doldurmaya dahil edilemedi; o mod bugünden itibaren birikiyor.)

### Doğrulama — `node bildim/_test/hatalarim-test.mjs`

Geçici test kullanıcısı açılır, `request.jwt.claims` ile `auth.uid()` taklit edilir, sonda silinir.

| # | Test | Sonuç | Ölçüm |
|---|---|---|---|
| 1 | 5 yanlış soru bankaya girdi | GEÇTİ | bankada 5 soru |
| 2 | Çalışma turu bankadan doldu | GEÇTİ | bankadan 5, havuzdan 0 |
| 3 | İlk doğruda öğrenilmedi (1/2) | GEÇTİ | öğrenilen 0, bankada 5 |
| 4 | İkinci doğruda öğrenildi | GEÇTİ | öğrenilen 4, bankada kalan 1 |
| 5 | Araya yanlış girince seri sıfırlandı, soru bankada kaldı | GEÇTİ | seri=0, `ogrenildi_at`=null, yanlış=2 |
| 6 | **`profiles.puan` / `puan_hafta` / `seri_gun` DEĞİŞMEDİ** | GEÇTİ | puan 0→0, hafta 0→0, seri 0→0 |
| 7 | Kategori ustalığı arttı | GEÇTİ | 0 → 9 doğru |
| 8 | Boş bankada tur başladı, havuzdan doldu | GEÇTİ | toplam 10, bankadan 0, havuzdan 10 |
| 9 | Havuzdan gelen soru yanlış bilinince bankaya eklendi | GEÇTİ | 1 satır |
| 10 | `yanlis_bankam` özeti tutarlı | GEÇTİ | toplam 5, öğrenilen 4, bekleyen 1 |

**10/10 geçti.**

### Test'in yakaladığı gerçek hata (migration 106)

Test 8 ilk çalıştırmada kaldı: 10 soru istenirken 15 soruluk tur açılıyordu. Nedeni,
`calisma_baslat` içindeki havuz doldurma sorgusunda `limit v_eksik`'in `array_agg`'ın **dış**
sorgusuna uygulanmasıydı — toplama tek satır döndürdüğü için limit hiçbir şeyi kısıtlamıyor,
`soru_sec`'in döndürdüğü tüm id'ler oturuma giriyordu. Limit, id'lerin satır satır açıldığı iç
sorguya taşındı (**20260612000106**).

### Arayüz

- **`bildim/pages/CalismaPage.jsx`** (yeni) — `/bildim/calisma`. Banka özeti (bekleyen/öğrenilen +
  kategori mini çubukları), kategori seçici, soru sayısı 10/20/30, "Çalışmaya başla".
  Banka boşsa maskot + "Henüz yanlışın yok…" ama tur yine başlatılabiliyor.
- Çalışma ekranı: üstte **"ÇALIŞMA · PUAN VERİLMEZ"** şeridi, süre **20 sn** (rahat), joker yok,
  ilerleme çubuğu + "kaç soru kaldı". Cevap sonrası geri bildirim:
  bankadan geldiyse "Bunu daha önce N kez yanlış bilmiştin" / "1/2 doğru — bir kez daha bilirsen
  öğrenilmiş sayılacak" / "Öğrenildi! Bankadan çıktı" (konfeti + ses).
- Sonuç ekranı: öğrenilen sayısı büyük, doğru/yanlış/bankada kalan, toplam öğrenilen ve
  "kategori ustalığına işlendi" notu. **Lig puanı yazmıyor.**
- **`bildim/components/YanlisSatiri.jsx`** (yeni) — "N soruyu yanlış bildin — Hatalarım'a eklendi".
  1v1 (`MacSonuEklentisi` içinden), grup maçı, turnuva ve hızlı maç sonuç ekranlarına eklendi.
- Home'a **Hatalarım** mod kartı (kendi rengi #2FBF71, açıklamasız) + köşede bankadaki soru rozeti.
- Profil sayfasına "Öğrenilen soru: N · Bankada: M" satırı + Hatalarım'a link.
- `Ikon.jsx`'e `kitap` ikonu eklendi (42. ikon).
- `src/styles.css`'e `.bd-calisma-*`, `.bd-yanlis-satiri`, `.bd-mod-rozet`, `.bd-mod-ikon.hatalarim`
  blokları (152 satır, 400px altı için ayrı ayarlar dahil).

### Kararlar (belirsizlikte en az yıkıcı seçenek)

- **Çalışma modu `gorulen_sorular`'a yazmıyor.** Banka soruları tekrar tekrar sorulabilmeli;
  havuzdan gelen doldurma soruları da "görüldü" sayılsaydı normal maçlardaki soru seçimi
  daralırdı. Mevcut davranış hiç değişmedi.
- **Maç kotası tüketilmiyor** (`mac_kotasi_kontrol` çağrılmıyor) — çalışma bir müsabaka değil.
- **Havuzdan gelen soru doğru bilinirse bankaya girmiyor**; yalnız yanlış bilinirse ekleniyor.
- `yanlis_sorular`'a INSERT/UPDATE RLS politikası **verilmedi**; tüm yazım security-definer
  RPC üzerinden. İstemci bankayı doğrudan değiştiremiyor.
- `yanlis_kaydet` hata yutuyor (`exception when others then return`): banka yazımı başarısız olsa
  bile maç akışı kesilmiyor.

### Studio'da çalıştırılacak migration'lar

**20260612000104**, **20260612000105**, **20260612000106** — üçü de bu oturumda canlıya
uygulandı (`pg` ile doğrudan), ayrıca çalıştırmaya gerek yok.

---

## 2026-09-09 — BİLDİM: Canlı yayın öncesi test ve düzeltmeler

Canlıda (`idagg-game-center.vercel.app`) gerçek hesapla uçtan uca test yapıldı;
bulunan 4 hata düzeltildi ve 1 yayın engelleyici eksik kapatıldı.

### Bulunan ve düzeltilen hatalar

| # | Hata | Kök neden | Etki | Düzeltme |
|---|---|---|---|---|
| 1 | `yildiz`, `hizli`, `onay` ikonları **hiç çizilmiyordu** | `Ikon.jsx` yolu `split("M")` ile bölüp her parçaya `"M"` ekliyordu; küçük `m` ile başlayan yollar `"Mm…"` olup geçersizleşiyordu | Joker Dükkânı kartında ikon yerine boş kırmızı plaka, başlıktaki puan yıldızı ve Hızlı Mod onay işareti görünmüyordu | `split(/(?=M)/)` — komut harfi korunuyor |
| 2 | Hatalarım mod kartı Lig ile **aynı yeşil** (#2FBF71) | Yeni tema `styles.css`'e yazılmıştı; mod temaları `bildim/styles/tema.css` içinde `--tema-ikon` ile tanımlı | Alt alta iki tam genişlik kart ayırt edilemiyordu | `.bd-mod.tema-hatalarim` → **#20A4A0** camgöbeği |
| 3 | Banka özeti satırı ikiye bölünüyordu | `.ayrac` sınıfı global **yatay ayraç çizgisi** (max-width 340px); noktayı 340px genişletiyordu | Özet kartı bozuk görünüyordu | `.bd-calisma-ayrac` olarak yeniden adlandırıldı |
| 4 | Profil ve maç sonu satırları **altın + altı çizili ham bağlantı** gibi görünüyordu | `.app a` (özgüllük 0,1,1) kendi kurallarımızı (0,1,0) eziyordu | İki yeni satır tasarımdan kopuktu | Kurallar `.app a.<sınıf>` ile aynı özgüllüğe çıkarıldı |

**Renk seçimi ölçümle yapıldı:** aday tonlar CIE Lab'da mevcut 6 mod rengiyle
karşılaştırıldı; #20A4A0 en yakın renge **ΔE 40.9**, zemin kontrastı **6.13**,
mor bandı (hue 245-315) dışında. İkon düzeltmesi 42 ikonun tamamında doğrulandı:
3 bozuk ikon düzeldi, kalan 39'unun çıktısı **byte-ayni**.

### Yayın engelleyici eksik kapatıldı

`YAYIN_KONTROL.md` B4: "Kullanım Koşulları sayfası hiç yok."
→ **`bildim/pages/KosullarPage.jsx`** yazıldı (17 madde): taraflar, hesap, yaş sınırı,
kabul edilebilir kullanım (hile/taciz), kullanıcı içeriği, sanal öğeler ve Play
faturalandırması, reklamlar, soru doğruluğu, askıya alma, garanti reddi, sorumluluk
sınırı, fikri mülkiyet, uygulanacak hukuk (TR; tüketici hakları saklı).
`/kosullar` rotası **giriş duvarının önünde** (gizlilik gibi); profil > Hesap
bölümüne ve giriş ekranına bağlantı eklendi.

### Canlıda doğrulanan davranışlar

| Test | Sonuç |
|---|---|
| Çalışma turu bankadan doldu, soru geldi | ✔ |
| Yanlış cevap → "Bunu daha önce N kez yanlış bilmiştin" | ✔ |
| İlk doğru → "1/2 doğru", ikinci doğru → "Öğrenildi! Bankadan çıktı" | ✔ |
| Tur sonu: 2 öğrenildi, banka 168 → 166 | ✔ |
| `profiles.puan` 20 çalışma cevabı sonrası değişmedi (350 → 350) | ✔ |
| Kategori ustalığı arttı (profil ızgarasında görünüyor) | ✔ |
| Maç sonucunda "6 soruyu yanlış bildin — Hatalarım'a eklendi" | ✔ |
| 10 sayfada JS hatası / bozuk ikon / hata kutusu | **0** |
| 390px genişlikte yeni bileşenlerde yatay taşma | **yok** |
| `/kosullar` canlıda açılıyor (18 başlık) | ✔ |

### Not: test betiğimin ürettiği yanlış alarm

İlk canlı denemede doğru cevapladığım 5 soru "yanlış" göründü. DB kaydı da öyleydi.
Nedeni **uygulama değil, benim otomasyon betiğimdi**: doğru şık indekslerini oturum
sırasına göre sabitlemiştim, ekranda gösterilen soru bir kaydığında hepsi kaydı.
Soruyu **metinden eşleyerek** tekrarladığımda 10/10 doğru sonuç alındı. Uygulamada
düzeltme gerekmedi — buraya, ileride aynı yanlış teşhis tekrarlanmasın diye yazıldı.

### Hâlâ senin yapman gerekenler (panel işi, kod tarafı hazır)

Canlı uçta yeniden doğrulandı: `twitter` **400**, `facebook` **400**, `apple` **400**,
misafir girişi `anonymous_provider_disabled`. Yalnız Google (302) çalışıyor.
`CRON_SECRET` rotasyonu ve deponun private yapılması da açık
(ayrıntılar `YAYIN_KONTROL.md` B1-B6). Yasal metinlerde veri sorumlusu / hizmet
sağlayıcı kimliği hâlâ doldurulmayı bekliyor.

---

## 2026-09-09 — Giriş sağlayıcıları: neden kapalı, ne yapıldı

**Soru:** "Facebook ve X girişleri neden aktif değil, aktif olsun."

**Cevap:** Bu anahtar kodla çevrilemiyor. İki nedenle:
1. Sağlayıcı ayarı Supabase'in kimlik servisinde tutulur; **veritabanında yok**
   (auth şemasında yapılandırma tablosu bulunmuyor — kontrol edildi).
   Management API için erişim tokeni gerekiyor, elimde yok.
2. Asıl engel Supabase değil: **X ve Meta tarafında uygulama kaydı olmadığı için
   API Key / App Secret yok.** Bunlar geliştirici portallarından, hesap sahibinin
   kendi hesabıyla alınır.

Yapılan: `GIRIS_SAGLAYICILARI.md` — tahminsiz, adım adım rehber (callback adresi,
hangi alan nereye, hangi kutu işaretlenecek, Meta'nın Business Verification
uyarısı, açıldıktan sonra doğrulama komutları).

### Bu sırada bulunan gerçek hata: yönlendirme izin listesi eski alan adında

Supabase Auth izin listesi ölçüldü (`/auth/v1/verify` ucu, geçersiz token):

| İstenen adres | Sonuç |
|---|---|
| `idagg-game-center.vercel.app/` | **RED** → `bildim.vercel.app`'e düşüyor |
| `idagg-game-center.vercel.app/bildim` | **RED** |
| `idagg-game-center.vercel.app/bildim/davet/ABC` | **RED** |
| `bildim.vercel.app/` | İZİNLİ |
| `bildim.vercel.app/bildim` | İZİNLİ |

Yani **güncel alan adı izin listesinde yok.** Girişlerin bugün çalışmasının tek
nedeni `bildim.vercel.app`'in **307 ile köke** yönlendirmesi: token fragment'i
hayatta kalıyor ama **yol kayboluyor**. Sonuç: davet linkiyle gelen oyuncu giriş
sonrası davet sayfasına değil ana sayfaya iniyor. Facebook/X açıldığında aynı
sorun onları da vuracaktı. Ayrıca bu alias kaldırılırsa **tüm girişler kırılır**.

İzin listesi doğru tarafta çalışıyor (kötü niyetli adres reddedildi) — açık
yönlendirme (open redirect) açığı yok.

### Uygulama tarafına eklenen yedek

Panel ayarına erişemediğim için uygulamayı bu ayardan bağımsız hâle getirdim:

- **`src/lib/girisHedefi.js`** (yeni): hedef yol girişten önce `localStorage`'a
  yazılır, oturum açılınca **tek kullanımlık** okunur. 15 dk ömür, `//` ile
  başlayan dış adres reddi, `/` yok sayımı, her erişim try-catch (özel sekme /
  depolama kapalı olabilir).
- `Login.jsx`: OAuth ve e-posta girişinden önce hedef kaydedilir.
- `App.jsx`: oturum kurulunca saklanan hedefe `replace` ile dönülür.

`localStorage` origin başına olduğu için zincir çalışıyor: hedef idagg'da
yazılır, 307 sonrası yine idagg'da okunur.

**Canlıda doğrulandı:**

| Test | Sonuç |
|---|---|
| `/` → saklanan `/bildim/calisma` hedefine dönüldü | ✔ |
| Hedef tek kullanımlık (anahtar silindi) | ✔ |
| `//kotu-site.example.com` hedefi reddedildi, kendi alan adında kalındı | ✔ |
| 20 dk önceki (süresi geçmiş) hedef yok sayıldı | ✔ |

### Doğrulanan diğer şey

`handle_new_user` tetikleyicisi `new.email`'e **hiç dokunmuyor**; takma adı
UUID'den üretiyor (`oyuncu_xxxxxxxx`). Yani X e-posta vermezse veya misafir
girişinde kayıt yine sorunsuz tamamlanır — sağlayıcılar açıldığında bu yüzden
ek geliştirme gerekmeyecek.

---

## 2026-09-09 — Site geneli denetim (hub + 8 oyun modülü)

Sağlayıcı işi ertelendi; site baştan sona tarandı. **3 gerçek hata bulundu ve
düzeltildi**, 1 yayın eksiği kapatıldı.

### Düzeltilenler

| # | Hata | Ölçüm | Düzeltme |
|---|---|---|---|
| 1 | **Buton kontrastı** — `.app .btn` altın zemine **beyaz** yazı kullanıyordu. "Lobiye katıl" ve "Meydan oku" solgun/okunaksızdı; aynı sayfadaki "Hemen oyna" doğru şekilde koyu yazı kullanıyor. | **1.87:1** (WCAG eşiği 4.5) | `color: #3a2400` → **7.83:1**, `.bd-ana-eylem` ile aynı |
| 1b | `.btn.tehlike` mercan zemine beyaz | **3.64:1** | zemin `#E8543F` → `#C43A26` → **5.28:1** |
| 2 | **Sitemap var olmayan adres bildiriyordu:** `/bildim/gizlilik` — böyle bir rota yok, canlıda ana sayfaya düşüyor (soft-404, yanlış kanonik sinyal) | canlıda doğrulandı | `/gizlilik` olarak düzeltildi; `/kosullar` + 7 oyun rotası eklendi (3 → 11 adres) |
| 3 | **Kilitli rozet okunaksız** — `opacity: 0.45`, 10px açıklama | **2.96:1** | `opacity: 0.65` → **4.72:1** (kilitli hissi korunuyor) |
| 4 | Hub alt bilgisinde yasal bağlantı yoktu | — | Gizlilik + Kullanım koşulları eklendi (mağaza/reklam ağı şartı) |

### Temiz çıkanlar

- **8 oyun modülünün tamamı** hatasız yükleniyor: Bildim, Kafa Topu, DidaGP,
  Meyve Kes, PatiRun, Gölge Boks, RUN, Gladius. JS hatası **0**, konsol hatası
  **0**, hata sınırı hiç devreye girmedi.
- 13 rota tarandı: bozuk görsel yok, alt'sız görsel yok, etiketsiz düğme yok,
  390px'te yatay taşma yok.
- Meta/OG etiketleri, `robots.txt`, manifest ve 3 PWA ikonu (200) **güncel alan
  adını** gösteriyor — eski alan adı sızıntısı yalnızca Supabase izin
  listesindeydi (ayrı madde).
- Joker, meydan, sıralama, hızlı mod sayfalarında düşük kontrast veya 36px altı
  dokunma hedefi yok.

### Ölçüm araçlarımın ürettiği 3 yanlış alarm (not düşülüyor)

Bunları hata olarak raporlamadan önce doğruladım; hiçbiri site hatası değildi:

1. **"Aynı uzunlukta farklı sayfalar"** — tarayıcı arka plan sekmesinde
   render'ı kısıtladığı için ölçüm bir sayfa geriden geliyordu. Bekleme
   koşulu eklenince tutarlı oldu.
2. **"Tüm metinler kontrast 1.00"** — `document.visibilityState === "hidden"`
   olduğunda CSS giriş animasyonları donuyor, `opacity` `from` değerinde (0)
   kalıyor. Ölçümden önce `getAnimations().finish()` çağrılınca düzeldi.
3. **"350 puanı kontrast 1.00"** — `background-clip: text` kullanan degrade
   metin; tarayıcının kendi arka plan rengini zemin sanmışım. Gerçekte altın
   üzeri koyu zemin, sorun yok.

Ayrıca `.bd-mod-ikon` overflow uyarıları `position: fixed` üst bar ve tabbar'dan
geliyordu — yanlış pozitif.

---

## 2026-09-09 — Cloudflare Pages dağıtımı hazırlandı (depo aynı)

Vercel'e dokunulmadı; aynı depo iki yerde birden yayınlanabilir durumda.

### Eklenen dosyalar

| Dosya | Neden |
|---|---|
| `public/_redirects` | SPA yönlendirmesi. Olmadan `/bildim/calisma` gibi **tüm derin bağlantılar Cloudflare'de 404** döner. Vercel bu dosyayı yok sayar (o `vercel.json` kullanıyor). |
| `public/_headers` | `sw.js` → `no-cache` (eski service worker takılı kalmasın), `/assets/*` → 1 yıl `immutable` (Vite hash'li ad üretiyor), `nosniff` + `Referrer-Policy` + `X-Frame-Options`. |
| `.node-version` → `22` | **Kritik.** Vite 7 Node `^20.19 \|\| >=22.12` istiyor; Cloudflare Pages varsayılanı daha eski — sabitlenmezse **ilk derleme patlar.** Vercel de aynı dosyayı okuyor, uyumlu. |
| `wrangler.toml` | CLI dağıtımı için (`pages_build_output_dir = "dist"`). Panelden bağlanırsa gerekmez. |
| `CLOUDFLARE_DAGITIM.md` | Adım adım rehber + dağıtım sonrası yapılacaklar. |

### Yerel doğrulama — `npx wrangler pages dev dist`

Cloudflare'in kendi çalışma zamanı yerelde ayağa kaldırıldı (hesap gerekmedi):

| Test | Sonuç |
|---|---|
| `/`, `/bildim`, `/bildim/calisma`, `/bildim/mac/abc-123`, `/kosullar`, `/gizlilik`, `/kafatopu` | 7/7 **200** + `text/html` |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/icon-192.png` | 5/5 **200** |
| `sw.js` → `Cache-Control: no-cache, no-store, must-revalidate` | ✔ |
| `/assets/*.js` → `public, max-age=31536000, immutable` | ✔ |
| `x-content-type-options: nosniff` | ✔ |
| Uygulama tarayıcıda `/bildim/calisma` derin bağlantısından açıldı | ✔ |

### Vercel regresyon kontrolü

`.node-version` eklemek Vercel derlemesini de etkilediği için canlı doğrulandı:
site açılıyor, `/bildim/calisma` render ediliyor, önceki CSS düzeltmeleri
(buton `#3a2400`, rozet `0.65`) yerinde, sitemap 11 adres. `_redirects`
Vercel'de statik dosya olarak servis ediliyor (200) — zararsız.

### Cloudflare yayına açılmadan önce ŞART

Supabase izin listesinde yalnız `bildim.vercel.app` var. **Cloudflare alan adı
eklenmeden giriş çalışmaz** — kullanıcı giriş yapınca Vercel sitesine düşer.
Vercel'de çalışmasının tek nedeni o alan adının 307 yönlendirmesi; Cloudflare'de
böyle bir yedek yok. Supabase → Authentication → URL Configuration →
Redirect URLs'e `https://<proje>.pages.dev/**` eklenmeli.

Ayrıca iki site birden yayında kalacaksa ikincisine `Disallow: /` veya asıl
alan adına `rel=canonical` gerekir (yinelenen içerik).
