# Gladius — İlerleme Günlüğü (PROGRESS)

> Karar günlüğü. Her oturum sonunda ekleme yapılır (üzerine yazılmaz).
> Yeni oturuma başlarken önce bu dosya + CLAUDE.md + GLADIUS_TASARIM.md okunur.

---

## ⏳ ONAY BEKLEYEN İŞLEMLER (İda talebi: hepsi en sona biriktirilecek, uygulanmayacak)

> İda kuralı (2026-07-08): Kod/dosya işleri sormadan yapılır. DB/production'a
> dokunan her işlem UYGULANMAZ, buraya eklenir, en sonda topluca sorulur.

1. **`npx supabase db push`** — `20260612000034_gl_temel.sql` migration'ını canlı
   Supabase'e uygular (gl_ tabloları, RLS, RPC'ler). GEÇMEDİ.
   _(Not: Supabase login/token gerekebilir — İda `!npx supabase db push` ile de çalıştırabilir.)_

_(Deploy/migration eklendikçe buraya numaralanarak yazılacak.)_

---

## 2026-07-08 — Kuruluş ve Faz 0

### Onaylanan teknik kararlar (İda onayı)
- **Klasör konumu:** Repo kökü `/gladius`. Bildim'e tek dokunuş, ayrı repoya taşınabilir.
- **Dil:** JSX/JS (Bildim ile aynı, tek Vite build — ayrı derleme yok).
- **Render motoru:** Canvas 2D (bağımlılıksız). 4-10 oyuncu ölçeği için yeterli.
- **Süper admin doğrulama:** Mevcut `hile_yetkisi` + security-definer/UUID deseni
  (`supabase/migrations/20260612000028_gelistirici_yetkisi.sql`) yeniden kullanılacak.
  Tasarımdaki "Gmail'e bağlı" = pratikte bu sabit UUID.

### Bildim mevcut yapısı (inceleme özeti)
- React 19 + Vite 7, tek `BrowserRouter` (`src/main.jsx`), rotalar `src/App.jsx` → `Layout`.
- Auth: `src/context/AuthContext.jsx` (Supabase Auth / Gmail). `user`/`profile`/`session` global.
- Supabase client: `src/lib/supabase.js` (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
- Realtime: Bildim yalnızca `postgres_changes` kullanıyor. Gladius'un ihtiyaç duyduğu
  **presence + broadcast** bu repoda yok → Gladius'a özel yeni net katmanı olacak.
- Migration'lar sıralı, şu an **000033**. Gladius `gl_` tabloları 000034+ ile eklenecek.
- Deploy: `main` push = Vercel otomatik production. `vercel.json` SPA rewrite.

### Faz 0 — İskele (TAMAMLANDI)
Oluşturulan dosyalar:
- `gladius/lib/host.js` — Bildim supabase + useAuth köprüsü (taşınırken sadece bu değişir).
- `gladius/shared/sabitler.js` — mod adları, kapasite, taban yol, tablo öneki.
- `gladius/app/GladiusApp.jsx` — Gladius kök bileşeni + iç router.
- `gladius/app/pages/MenuPage.jsx` — atmosferik ana menü (iskele; butonlar Faz 1+ ile bağlanacak).
- `gladius/app/styles/gladius.css` — `gl-` önekli, Bildim CSS'iyle çakışmayan tema.
- `src/App.jsx` — TEK dokunuş: `/gladius/*` lazy rotası (Layout dışında, tam ekran).

**Faz 0 testi (yapıldı):**
- `npm install` + `npm run build` → başarılı. Gladius **kendi chunk'ına** bölünüyor
  (`GladiusApp-*.js` 1.99 kB + kendi CSS'i) → lazy import `../gladius/` dışfrom klasöründen
  çalışıyor ve Bildim ana paketini şişirmiyor.
- Dev sunucusu + tarayıcı: `/gladius` rotası çözülüyor. Oturum olmadığında Bildim `App.jsx`
  önce login gösteriyor (tasarım gereği — Gladius, Bildim Gmail oturumunun arkasında). Konsol hatasız.
- Not: Menü ekranı ancak **giriş yapılmış oturumla** görülebilir; İda kendi hesabıyla `/gladius`'a
  girerek doğrular (Claude OAuth/login yapamaz).

### Sıradaki: Faz 1 — DB temeli (`gl_` tabloları, RLS, süper-admin RPC deseni)

---

## 2026-07-08 — Faz 1: DB temeli

### Yazılan migration: `supabase/migrations/20260612000034_gl_temel.sql`
- `gl_profiller` — kalıcı oyuncu profili (karakter, silah/kalkan + varyant, kozmetik jsonb,
  lig, puan, istatistik, günlük seri). Herkes okuyabilir (kozmetik görünürlüğü), kişi sadece
  kendi satırını yazar.
- `gl_odalar` — maç odası (mod, tür hızlı/özel, host, durum, katılım kodu).
- `gl_oda_oyunculari` — oda-oyuncu ilişkisi (gerçek oyuncu veya bot, hazır durumu).
- `gl_maclar` — biten maç kaydı (kazanan, sıralama jsonb) → leaderboard/rozet için.
- `gl_admin_mi()` — süper admin doğrulaması, mevcut geliştirici UUID'sine bağlı
  (`e4f6006f-…`), security definer, yalnızca sunucuda. Tasarım 3.2.6 ortak kuralı.
- `gl_profil_al()` — profil yoksa oluşturup döndüren güvenli RPC (otomatik provisyon).
- Tüm tablolarda RLS açık, yalnızca `authenticated`; kritik yazımlar RPC/security-definer.

**Durum:** Migration yazıldı, HENÜZ UYGULANMADI. `supabase db push` (canlı DB değişikliği)
için İda onayı bekleniyor.

### Referans kaynakları (İda verdi — bilgi olarak)
- **PatiRun reposu:** https://github.com/winegg420/PatiRun — net katmanı (Faz 2) için
  `roomClient.ts`, `interpolation.ts`, `characters.ts`, `skillSystem.ts`, `protocol.ts`,
  `quickMatch.ts`, `constants.ts` referansları. Net katmanı bu dosyalara BAKILARAK yazılacak
  (şimdi kör yazılmadı). Hafızaya kaydedildi.
- **RUN spec'i:** GLADIUS_TASARIM.md'nin dayandığı temel doküman (elde mevcut).

### Faz 0 iskeleti gezilebilir yapıldı (DB gerektirmeden)
- `MenuPage` butonları artık çalışıyor (Link tabanlı).
- Yeni ekranlar: `ModeSelectPage` (Battle Royale / Deathmatch gerçek kartları),
  `StubPage` (Karakterim/Sıralama/Arkadaşlar/Ayarlar/Eşleşme için temaya uygun placeholder).
- `GladiusApp` iç router genişletildi: `oyna`, `oyna/:mod`, `karakter`, `siralama`,
  `arkadaslar`, `ayarlar`. CSS'e mod kartları + ekran düzeni eklendi.
- `npm run build` → başarılı, Gladius chunk 4.52 kB (izole).

### Motor v1 — Canvas 2D arena (TAMAMLANDI, DB gerektirmeden)
İda kuralı: reversible işler sormadan yapılır → motor kuruldu.

Oluşturulan dosyalar:
- `gladius/shared/denge.js` — oyun sabitleri (arena 900 yarıçap, can 100, vuruş 15,
  hız 300, kamera kenar payı, bot hızları). PatiRun `constants.ts` karşılığı.
- `gladius/engine/girdi.js` — klavye (WASD/oklar) + dokunmatik sanal joystick (tasarım 8.1).
- `gladius/engine/durum.js` — oyun durumu + güncelleme; oyuncu hareketi, bot gezinme AI,
  arena dairesine sıkıştırma. 8 gladyatör paleti (kadın/erkek, ten/saç/zırh).
- `gladius/engine/karakterCizim.js` — parametrik kuş bakışı gladyatör (gölge, zırh, baş,
  saç, bakış göstergesi, "sen" altın çeperi) + isim/can barı. Hazır asset yok (tasarım 3.13).
- `gladius/engine/render.js` — arena (kum gradyanı), tribün + yüzlerce seyirci noktası,
  loca yayı, kırık sütun/heykel dekorları, painter's-order oyuncular.
- `gladius/engine/motor.js` — rAF döngüsü, DPR canvas boyutlama, girdi yaşam döngüsü,
  döngü-içi hata koruması.
- `gladius/app/pages/ArenaPage.jsx` — canvas'ı barındıran React sayfası (yerel antrenman).
- `gladius/app/pages/ModeSelectPage.jsx` + `StubPage.jsx` — menü alt ekranları.
- Rota: `oyna/:mod` → ArenaPage. Menü artık gezilebilir.
- `gladius/_test/motor-test.html` — auth/React'sız bağımsız motor test sayfası (arena login
  arkasında olduğu için görsel test aracı; production build'e girmez — dev-only).

**Test (yapıldı):**
- `npm run build` başarılı, Gladius chunk 13.63 kB (izole).
- Tarayıcı (test sayfası) ekran görüntüsü: arena + seyirci + loca + dekor + gladyatörler
  (isim/can barı) doğru render. İda'ya gösterildi.
- Deterministik mantık testi (guncelle doğrudan): oyuncu girdisi +105 (300×0.35), bot +87.5
  (250×0.35), arena sınırı 876'da tutuldu. Hepsi beklenen değerlerde.

### Karakter sistemi + dövüş + round sonu (TAMAMLANDI, DB gerektirmeden)
İda kuralı (2026-07-08, 2. netleştirme): reversible her şey durmadan/sormadan yapılır.

- **15 gladyatör** (`shared/karakterler.js`): 4 kadın (2 esmer/2 sarışın) + 11 erkek, özgün paletler.
- **Silah/kalkan modeli** (`shared/itemler.js`): 6 silah kategorisi (kılıç[+sica], bıçak,
  çift bıçak, mızrak[+trident], balta[+çekiç], zincirli topuz) × 3-5 varyant; 5 kalkan; amblemler.
- **Item çizimi** (`engine/itemCizim.js`): her silah/kalkan görsel olarak ayrık, parametrik.
- **Karakter seçim ekranı** (`app/pages/CharacterPage.jsx`): karakter+silah+kalkan seçimi,
  yavaş dönen canlı önizleme, localStorage'a kayıt (`lib/secim.js`; Faz 1 sonrası buluta senkron).
- **Dövüş** (`engine/dovus.js`): mesafe+açı isabet, kalkan %70-80 şansa bağlı azaltma, ölüm.
- **Bot dövüş AI** (`durum.js`): en yakın hedefe yönelip yaklaşır ve vurur (serbest çatışma).
- **Kan/ceset/efekt**: kalıcı kan izleri + cesetler (render.js), kan/kalkan/ıska efektleri.
- **Round sonu** (`durum.js` + `motor.js`): tek kişi kalınca kısa bekleme sonrası kazanan
  ilan; 0 kalırsa "kazanan yok" (tasarım 3.6.1). ArenaPage'de zafer ekranı + "Tekrar Oyna".
- **Dokunmatik**: sürükle=hareket joystick + sağ altta saldırı/kalkan butonları.

**BUG bulundu & düzeltildi:** `karakterCizim.js`'te `bx/by` TDZ hatası (saç, tanımdan önce
kullanıyordu) — motor döngüsünü kilitliyordu. Fonksiyon başına taşındı. Aynı hata başka yerde yok.

**Test (yapıldı, hepsi geçti):**
- Build başarılı (Gladius chunk ~25.8 kB, izole).
- Görsel: silah/kalkan önizleme sayfası (9 silah + 5 kalkan hepsi ayrık) + arena çatışma
  ekran görüntüsü (cesetler, kan, son ayakta kalan can barlı). İda'ya gösterildi.
- Deterministik: vuruş=15, kalkanlı=3.82 (%74), açı-dışı ıska=0, ölüm+kan; tam round
  simülasyonu ~26.5 sn'de kazananla bitti (Varro, hayatta).
- Test araçları: `_test/motor-test.html`, `_test/onizleme-test.html` (dev-only, prod build'e girmez).

### Tehdit sistemi — faz makinesi + Maymun + Boğa (TAMAMLANDI, doğrulandı)
- **Faz durum makinesi** (`durum.js` fazKontrol): pvp → maymun → pvp → boğa → pvp
  (aslan/düello/ateş sonraki adımda). `durum.faz`, `durum.pvpAcik`, `durum.tehditler`.
- **Maymun İstilası** (`engine/tehditler.js`): 8 maymun 4 taraftan, PvP kapanır, herkes
  ortak maymunlara vurur, maymun dadanır + 3 vuruşta hedef değiştirir + oyuncuya hasar.
- **Boğa Hücumu**: duraklama/şarj state machine, çarpınca hasar + 3sn sersemleme + savrulma,
  çok dibinde vurana ani ceza. Ölünce PvP'ye döner.
- **Dövüş hedeflemesi** (`dovus.js`): PvP kapalıyken vuruşlar tehditlere gider.
- **Sersemleme**: sersem oyuncular hareket/saldırı yapamaz (boğa çarpması).
- **Çizim** (`render.js`): maymun (kahverengi, kulaklı) + boğa (boynuzlu, tozlu şarj, can barı).

**Test (geçti):** Build ok. Faz geçişleri deterministik doğrulandı (maymun 8sn'de başlar,
8 adet, PvP kapalı, hasar verir; ölünce PvP; 6sn sonra boğa; şarj/duraklama halleri;
ölünce PvP). Görsel: maymun fazı ekran görüntüsü (maymunlar oyunculara dadanmış). İda'ya gösterildi.

### Zincirli Aslanlar + Ateş Çemberi (TAMAMLANDI, doğrulandı)
- **Aslanlar** (`tehditler.js`): 3 aslan, her biri bir bölgede devriye; bölge zamanla
  büyür (alan daralması, tasarım 3.1); bölgeye giren oyuncuya hızlı atılır, pençeyle
  kalkanı kırar + hasar. PvP açık kalır (oyuncular hem birbirine hem aslana vurabilir —
  `dovus.js` aslanları da hedef alır). Aslanlar öldürülebilir.
- **Ateş Çemberi** (`tehditler.js`): dış kenar içeri yanar, `atesYaricap` zamanla artan
  hızda küçülür; yanan bölgedeki oyuncular artan hasar alır → round'un kesin bitişini
  garantiler (pasif oyuncular bile ~10sn'de resolve olur).
- **Faz zaman çizelgesi tam** (`durum.js`): pvp → maymun → boğa → aslan → ateş; her tehdit
  zamanı/koşulu gelince otomatik. (Gladyatör Düellosu aslan↔ateş arasına sonra eklenecek.)
- **Çizim** (`render.js`): aslan (yeleli, bölge halkası) + ateş halkası (yanan bölge +
  parlak güvenli-alan kenarı).

**BUG düzeltildi:** Ortak-tehdit fazında herkes ölünce faz bitmiyordu (soft-lock) — round
sonu artık "0 hayatta" durumunu her fazda yakalıyor. Maymun dengesi küçük maça göre yumuşatıldı.

**Test (geçti):** Build ok. Tam çizelge deterministik doğrulandı (pvp→maymun→pvp, kadro
azsa boğa öncesi kazanan çıkabiliyor — geçerli). Aslan: 3 adet, bölge büyüyor, hasar veriyor.
Ateş: yarıçap 900→küçülür, pasif oyuncuları 9.7sn'de bitirip kazanan (Spartacus) çıkardı.
Görsel: aslan ve ateş çemberi ekran görüntüleri (yanan arena + merkez güvenli daire). İda'ya gösterildi.

### Itemler + Kill Feed + Mod Ayrımı + Motor Dayanıklılığı (TAMAMLANDI, doğrulandı)
- **Itemler** (`durum.js` itemGuncelle): can (+30) ve hız (5sn ×1.6) itemleri periyodik
  spawn olur, üstünden geçince toplanır. `render.js`: can=kırmızı haç, hız=mavi şevron.
- **Kill feed** (`dovus.js` + `render.js`): oyuncu ölünce "vuran ⚔ ölen" sağ üstte, solarak kaybolur.
- **Eleme sayacı**: her oyuncunun `eleme` istatistiği (kill streak/rozet için temel).
- **Mod ayrımı**: `deathmatch` modunda faz/tehdit zaman çizelgesi çalışmaz (tehditsiz — tasarım 3.8).
- **Donma düzeltmesi (ÖNEMLİ):** Motor artık render hatasında KALICI durmuyor (kareyi atlar,
  döngü sürer). "Ekran donuyor" şikâyeti aslında tarayıcının arka-plan sekmede rAF'ı
  duraklatmasıydı (kod bug'ı değil) — test sayfası artık round bitince oto-yeniden-başlar.

**Test (geçti):** Build ok. Deterministik: item spawn, kill feed dolumu, can 40→70,
hız boost, deathmatch'te tehdit gelmiyor. Görsel: HUD + kill feed + can/hız itemleri
ekran görüntüsünde net. İda'ya gösterildi.

### Deathmatch Ekstraları (TAMAMLANDI, doğrulandı)
- **Altın Dakika** (`dovus.js` + `durum.js`): rastgele tetiklenen ~18sn'lik çift-hasar
  penceresi; HUD'da "⚡ ALTIN DAKİKA" bildirimi.
- **Rastgele Alev Püskürmesi** (`durum.js` deathmatchEkstra): periyodik, rastgele noktada
  3sn yanan bölge, üstündeki oyuncuya hasar. `render.js`: parlak alev gradyanı.
- **Kill Streak efekti**: art arda eleme yapanda altın nabız halkası (sadece görsel).
- **Test (geçti):** normal 15 → altın 30 (tam çift), altın zamanında tetiklenir, alev 1sn=9 hasar.

### DURUM: Tek-oyunculu (yerel) oyun her iki modda TAM oynanır
Menü → mod → karakter/silah/kalkan seç → arena. Battle Royale: maymun→boğa→aslan→ateş
tehdit zinciri + itemler + son ayakta kalan. Deathmatch: tehditsiz sınırsız dövüş +
altın dakika + alev + kill streak. Kill feed, kan/ceset, zafer ekranı, tekrar oyna — hepsi çalışıyor.

### Gladyatör Düellosu + Ses Sistemi (TAMAMLANDI, doğrulandı)
- **Gladyatör Düellosu** (`tehditler.js` duelloBaslat/Guncelle): aslan↔ateş arası; hayatta
  kalanlar iki takıma (a/b) bölünür, ortada karşılıklı dizilir; takım arkadaşına vurulmaz
  (`dovus.js`); botlar rakip takımı hedefler; 1-3 kişilikte 1, 4-5'te 2 ölümde biter →
  Ateş Çemberi. Render'da mavi/kırmızı takım halkaları. Test: 4 kişi→2v2, eşik 1, arkadaşa
  vurmuyor, sonra ateşe geçiyor; görsel 3v3 dizilim doğrulandı.
- **Ses sistemi** (`ses.js`): WebAudio ile sentez (hazır dosya yok) — isabet/kalkan/ıska/
  ölüm/item/borazan. Motor `durum.sesler` kuyruğunu her karede çalar; ArenaPage ilk
  dokunuşta AudioContext'i açar (tarayıcı politikası). Tüm çağrılar hatasız/güvenli.
  Test: 12sn çatışmada 47 ses olayı, cal() güvenli, döngü sağlam.

### DURUM: Battle Royale tam zaman çizelgesi bitti
pvp → maymun → boğa → aslan (daralma) → **düello** → ateş çemberi → kazanan. Deathmatch:
tehditsiz + altın dakika + alev + kill streak. Her ikisi de itemli, kill feed'li, sesli, oynanır.

### Maç Öncesi "Hazır" Fazı + Tema Metni (TAMAMLANDI, doğrulandı)
- `durum.js`: round `hazir` fazıyla başlar (borazan çalar, 2.6sn dövüş yok), sonra `pvp`'ye
  geçer ve round süresi sıfırlanır. Her iki modda geçerli.
- `ArenaPage`: intro overlay — "Roma'dasın. / Arenada yalnızca biri sağ çıkar. / HAZIR OL"
  (fade + nabız animasyonu, hazır süresiyle senkron).
- Test: hazır'da can sabit (dövüş yok), 2.6sn sonra pvp + zaman=0.

### GENEL DURUM — Tek-oyunculu oyun ÖZELLİK-TAM (offline)
Menü → mod seç → karakter/silah/kalkan (canlı önizleme) → HAZIR OL borazanı →
[BR: maymun→boğa→aslan→düello→ateş] / [DM: sınırsız + altın dakika + alev + kill streak] →
itemler, kill feed, kan/ceset, sesler → son ayakta kalan → zafer/replay ekranı → tekrar.
Hepsi build + deterministik + görsel test edildi.

### Ana Menü Atmosferi (TAMAMLANDI)
- `MenuPage`: seçili gladyatörün yavaşça dönen canlı önizlemesi (canvas) + yanan meşale
  ışıkları (CSS titreşim). Build geçti (chunk ~42 kB, izole).

### Otonom mod (İda talebi 2026-07-08): sürekli, sormadan çalış
İda: "ben devam demeyeceğim, sen hep devam et, arka planda test yap, durma." → Her tur bir
reversible parça yaz + test et, sonra ScheduleWakeup ile kendini yeniden tetikle. Sadece
DB push/deploy'da dur (ONAY BEKLEYEN İŞLEMLER listesine ekle).

### BR Silah/Kalkan Aktivasyonu + DM Zırh/Güç Itemleri (TAMAMLANDI, doğrulandı)
- BR modunda oyuncu/bot silah+kalkanı PASİF başlar (görsel var, işlev yok — soluk çizilir);
  yerden `silah`/`kalkan` itemi toplayınca aktifleşir (tasarım 3.1). Pasifken vurulamaz.
- DM modunda `zirh` itemi 12sn gelen hasarı ×0.5, `guc` itemi 8sn verilen hasarı ×1.5
  (tasarım 3.8.1). Oyuncuda yeşil zırh halkası / turuncu güç aurası.
- Item spawn moda göre: BR = silah/kalkan/can/hız; DM = can/hız/zırh/güç. Yeni item ikonları.
- Test (geçti): BR pasif→vuramaz, silah toplayınca vurur; DM zırh 15→7.5, güç 15→22.5.

### Yerel Rozet/Lig/İstatistik Sistemi (TAMAMLANDI, doğrulandı)
- `lib/istatistik.js`: localStorage tabanlı; LIGLER (Çırak→Gladyatör→Şampiyon→Efsane→İmparator),
  ROZETLER (İlk Kan, Arena Fatihi, Son Nefes, Aslan Avcısı, Hayatta Kalan), `macBitir()`
  puan/lig/rozet hesabı + kalıcı birikim.
- Engine izleme: `durum.ilkKanId` (ilk oyuncu ölümü yapan), `oyuncu.aslanEleme` (aslan öldürme),
  merkezi ölüm kaydı `olumSira`/`olumZaman` (kaynak fark etmez) → "Son Nefes" + hayatta kalma süresi.
- `ArenaPage.onBitti`: yerel oyuncunun round verisinden rozet/lig/puan hesaplar; zafer
  ekranına **istatistik kartı** (eleme, hayatta kalma, lig, +puan, lig atladı, kazanılan rozetler).
- Test (geçti): lig eşikleri, puan formülü (20+eleme×10+100+aslan×15=165), rozet setleri,
  Son Nefes, kalıcılık (maç/puan/rozet birikimi), 3 galibiyet→Gladyatör lig atlama.

### SANAT PASS'İ (İda talebi: fazları duraklat, önce görsel kaliteyi onayla)
İda 2026-07-08: otonom döngü DURDURULDU. Önce sanat kalitesi onaylanacak.
- `karakterCizim.js`: yeniden yazıldı — metalik zırh radyal gradyanı (sol-üst ışık),
  omuzluklar, bronz miğfer + zırh renginde tepelik (crest), önde yüz, arkada pelerin,
  rim light, kesikli "sen" halkası. Can barı gradyanlı + gölgeli isim.
- `render.js` arena: katmanlı tribün (3 bant), altın loca kanopisi + sütunlar, kum dokusu
  (eşmerkezli aşınma halkaları + 260 benek + orta dövüş lekesi), taş blok duvar (48 segment),
  vignette. Renk paleti sıcaklaştırıldı.
- Test: build geçti; önizleme + arena ekran görüntüleri İda'ya sunuldu.
- **DURUM: İda'nın sanat onayı bekleniyor.** Onaylarsa fazlara devam (günlük görev/seri →
  hızlı iletişim → sıralama ekranı). Onaylamazsa sanat yönü tekrar konuşulacak.

### SPRITE (GERÇEK GÖRSEL VARLIK) ALTYAPISI (TAMAMLANDI)
İda kararı: kod-çizim CoC seviyesine çıkamaz → gerçek sprite varlıklarına geçiş.
- `lib/varliklar.js`: `import.meta.glob` ile `gladius/assets/img/*.png` bulur/yükler; `cizSprite`
  (döndürmeli) + `cizSpriteDuz` (düz) + `varlikVar`. Dosya yoksa kod-çizim yedeği.
- `karakterCizim.js`: karakter sprite'ı (`gladyator_<id>`) varsa onu + silah/kalkan sprite
  katmanlarını çizer; yoksa kod. Entity'lere `karakterId` eklendi (durum.js).
- `render.js`: tehditler (`aslan/boga/maymun`), arena (`arena` tek görsel), dekor
  (`dekor_sutun/heykel`), item ikonları (`item_*`) sprite-farkında; hepsi kod-yedekli.
  Sprite modda boğa/aslan can barı korunur.
- `GladiusApp`: mount'ta `varliklariYukle()` (önyükleme).
- **`gladius/SANAT_VARLIKLARI.md`**: tam varlık listesi + dosya adları + teknik kurallar
  (yukarı-bakış, 512/2048/256, şeffaf) + her varlık için AI görsel promptu + öncelik sırası.
- Test: build geçti; 0 sprite yüklüyken render hatasız (tam kod-yedeği çalışıyor).

**DURUM: İda görsel varlıkları (PNG) üretip `gladius/assets/img/` içine koyacak.**
İlk öncelik: `arena.png` + `aslan/boga/maymun.png`. Konunca test edip yön/kaliteyi ayarlarız.

### Sıradaki (İDA ONAYINDAN / VARLIKLAR GELDİKTEN SONRA)
- Gelen sprite'ların yön/ölçek/pivot ince ayarı; sonra kalan varlıklar.
- (Beklemede) Günlük görev/seri arayüzü; hızlı iletişim iskeleti; Sıralama/Ligler ekranı.
- **Bekliyor (onay):** `supabase db push` (Faz 1) — leaderboard/profil/günlük kalıcılığı için.
- **Bekliyor (kaynak):** çok-oyunculu net katmanı → PatiRun `roomClient.ts`/`interpolation.ts`.
