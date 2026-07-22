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
