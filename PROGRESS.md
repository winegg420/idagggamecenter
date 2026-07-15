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
