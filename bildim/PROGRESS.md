# Quiz Square — Modül İlerleme Günlüğü

> Bu, `bildim/` modülünün özet günlüğüdür. **Ayrıntılı, oturum-oturum geçmiş** repo kökündeki `PROGRESS.md`'dedir (Bildim başından beri hub'ın çekirdeğiydi; tüm quiz oturumları orada).

## Modül durumu (2026-07-22)

- **Tamamlanan modlar:** Hemen Oyna, 1v1 Meydan Okuma, Grup Maçı (3-5 kişi), Hızlı Olan Kazanır, Gece Turnuvası.
- **Sistemler:** Arkadaşlık + davet, rütbe/XP + rütbe atlama animasyonu, lider tablosu (podyumlu), PWA push bildirimi, referans/davet sistemi, bot oyuncular (`bot_oyna`).
- **Soru havuzu:** çok partili migration'larla genişletildi; `generate-questions` Edge Function (Claude API) ile üretim.
- **Kimlik:** `profiles` (username unique + avatar_url) — tüm hub'ın ortak kimliği. `hile_yetkisi` = admin/founder yetkisi (`hileli_mi()`).

## Hub taşıması (2026-07-22)

- Quiz sayfaları/bileşenleri `src/`'den `bildim/` klasörüne taşındı (tam modül izolasyonu). Rotalar `/bildim/*` altına alındı (eski yollar geriye uyumlu yönlendirilir).
- Site "IDA GG Game Center" hub'ına dönüştü; Bildim artık hub içindeki bir oyun. `profiles` ortak kimlik olarak diğer oyunlara (kafatopu/meyvekes/patirun/driftgp) hizmet verir.
- **Faz 5 (görünürlük):** `profiles.last_seen` + `kalp_at()` heartbeat (paylaşılan AuthContext) + `oyuncu_ara()` RPC — FriendsPage araması admin=hepsi / normal=online-only.

## Farklılaştırma paketi (2026-09-08) — Google Play hazırlığı

- **Kategori seçmeli yarış:** kategori artık soru havuzuna yansıyor (`soru_sec`); 1v1, grup,
  hızlı mod ve Hemen Oyna kategoriye saygılı. Turnuva karışık kalır.
- **Şehir/ülke ligi:** `profiles.ulke/sehir` (haftada 1 kez değişir, `profil_konum_kaydet`),
  `ulkeler`/`sehirler` tabloları (TR 81 il), `lig_siralama(kapsam, donem)`,
  `sehir_lig_sirasi(donem)`, `benim_lig_durumum(donem)`.
- **Haftalık lig:** `lig_arsiv` + `haftayi_kapat()` (Pazartesi 00:00 TSİ, arşivle→rozet→sıfırla)
  + `haftalik_sonuc_bildir()` (Pazartesi 09:00 TSİ push). Eski "sadece sıfırla" cron'u kaldırıldı.
- **Görülen soru tekrarı:** `gorulen_sorular` — soru gösterilirken yazılır, seçimde
  görülmemişler önceliklidir.
- **Kota:** saat başına 30 maç başlatma (`mac_kotasi_kontrol`), `hileli_mi()` muaf.
- **Dil hazırlığı:** `questions.dil` + `profiles.dil` (arayüz çevirisi YOK).
- **Arayüz:** Lig sayfası (şehir/ülke/dünya × hafta/tüm zamanlar, podyum, sticky kendi satırı),
  kategori kartlarında çözülme yüzdesi, ana sayfa lig rozetleri, konum modalı.
- **Kozmetik:** `bd-*` tasarım katmanı, yeni soru kartı (süre halkası + anlık geri bildirim),
  puan sayacı animasyonu, erişilebilirlik (kontrast, 44px, focus-visible).
- **Play Store:** `/gizlilik` (giriş duvarının önünde) + `hesabimi_sil()` akışı.
- Migration'lar: `20260612000045_lig_ve_kategori.sql`, `20260612000046_hesap_silme.sql`.
  Soru havuzu planı: `scripts/soru-parti-sablonu.md` (hedef 10.000).

## Kalan / dikkat

- Puanlama/RLS/realtime mantığı hassas — ödül formülleri ölçeklenebilir.
- Ayrıntılı kararlar ve oturum geçmişi için kök `PROGRESS.md`.

---

## 2026-09-08 — Soru kütüphanesi zenginleştirme (+2.000 soru)

**İstek:** "2k adet daha soru cekelim her kategoriye. soruların kalitesinden
dogrulugundan emin ol her zaman."

### Yapılan
Dört migration partisi halinde **2.000 yeni soru** üretildi ve canlıya uygulandı:

| Migration | İçerik |
|---|---|
| `20260612000059_soru_parti13.sql` | genel_kultur 200 · bilim 198 · tarih 102 |
| `20260612000060_soru_parti14.sql` | tarih 100 · cografya 200 · edebiyat 200 |
| `20260612000061_soru_parti15.sql` | spor 200 · sanat 200 · sinema 100 |
| `20260612000062_soru_parti16.sql` | sinema 100 · teknoloji 200 · muzik 200 |

Her kategoriye tam **+200** soru. Aktif havuz **3.193 → 5.193**.

Kategori dağılımı (aktif): genel_kultur 1354, bilim 594, tarih 536, cografya 485,
edebiyat 437, spor 427, sanat 401, muzik 320, teknoloji 320, sinema 319.

### Kalite süreci (her parti için aynı zincir)
1. `temizle.mjs` — mevcut havuzla anahtar kelime çakışması olan soruları eler
2. `birebir.mjs` — birebir aynı soru metni taraması
3. `kirp.mjs` — kategori kotalarını tam 200'e indirir
4. `tamamla.mjs` — doğru şık dağılımını **125/125/125/125** dengeler ve
   `where q.created_at >= transaction_timestamp()` ile YALNIZ o partinin
   şıklarını karıştıran SQL bloğunu ekler
5. `denetle.mjs` — biçim, 4 şık, kategori dağılımı, parti içi tekrar,
   havuzla çakışma, "zamana bağlı / yoruma açık" ifade taraması
6. Canlı DB'de `begin; … rollback;` provası

**Sonuç:** 4 partinin de denetimi `HATA: 0`, `Mevcut havuzla çakışma: 0`.
Dört parti birlikte provada `eklenen: 2000` (hiçbiri `on conflict` ile düşmedi).

### Elenen / düzeltilen
- Parti 13: 24 anahtar çakışması + 7 kota fazlası
- Parti 14: 52 anahtar çakışması + 10 kota fazlası
- Parti 15: 76 anahtar çakışması, 1 birebir tekrar, 48 kota fazlası;
  1 soru "en iyi" ifadesi yüzünden yeniden yazıldı
- Parti 16: 22 anahtar çakışması, 4 birebir tekrar (kısa metinli oldukları için
  anahtar taramasından kaçmışlardı), 35 kota fazlası; 1 soru "güncel" kelimesi
  denetimi tetiklediği için yeniden yazıldı

**Karar:** Güncel şampiyon / transfer / sürüm numarası / şirket durumu gibi
zamanla değişen hiçbir soru yazılmadı — havuz yıllarca doğru kalmalı.

### Uygulama
Migration'lar `pg` üzerinden doğrudan canlı DB'ye uygulandı (059→060→061→062),
ardından `supabase migration repair --status applied` ile geçmişe işlendi.
`npm run build` temiz.

**Not:** Pooler host adresi `aws-1-eu-central-1.pooler.supabase.com` (aws-0 değil).

---

## 2026-09-08 — Meydan okuma bildirimi en uste + oyun hissi revizyonu

**Istek:** "birisine meydan okundugunda bunun bildirimi en ustte cikiyor olmali.
gorunmuyor altta kaliyordu eskiden. ayrica gorsel olarak site hala kotu, panel gibi.
daha canli oyun goruntusune kavusmali."

### Kok neden (meydan okuma gorunmuyordu)
Uc ayri katmanda birden kaybolmus durumdaydi:
1. `matches` / `group_match_players` / `hizli_oyuncular` davet insert'lerinde
   **hic bildirim yazilmiyordu** — `bildirimler` tablosunda davet tipi yoktu,
   dolayisiyla bildirim zilinde de gorunmuyordu. (Yalniz `rovans_iste` elle
   bildirim yaziyordu.)
2. Tek uyari, alt menudeki "Meydan Oku" sekmesinin kosesindeki kucuk rozetti.
3. Meydan Oku sayfasinda "Sana Gelen" bolumu, kategori secimi + bot listesi +
   oyuncu listesinden SONRA, sayfanin cok asagisindaydi (satir ~490).

### Yapilan

**DB — `20260612000063_davet_bildirimleri.sql` (canliya uygulandi)**
- `matches` / `group_match_players` / `hizli_oyuncular` uzerinde davet
  tetikleyicileri: `mac_daveti`, `rovans`, `grup_daveti`, `hizli_daveti`.
  Bota ve kisinin kendisine bildirim gitmez.
- `matches.rovans` kolonu: rovans daveti ile normal meydan okumayi ayirir.
  `rovans_iste` icindeki elle `bildirim_yaz` cagrisi kaldirildi — artik tek
  kaynak tetikleyici, cift bildirim olmuyor.
- `bekleyen_davetlerim()` RPC: 1v1 + grup + hizli davetleri davet edenin
  adi/avatariyla tek cagrida dondurur (ust bandin veri kaynagi).

**Arayuz**
- `components/DavetBandi.jsx` (yeni) — ust cubugun hemen altinda, sayfa
  kaydirilsa da ekranda kalan davet bandi: rakip avatari, "X sana meydan okudu",
  **Kabul Et** ve reddet butonlari. Birden fazla davette "+N davet daha".
- `components/BildirimToast.jsx` (yeni) — diger bildirimler (siran dustu,
  arkadaslik istegi, hafta sonucu, seri) icin ustten inen serit.
  **Davet tipleri toast'a girmez**: bandda zaten "Kabul Et" butonuyla duruyorlar,
  ayni sey iki kez soylenmesin.
- `Layout.jsx` — topbar + davet bandi + toast tek bir `.bd-ust-blok` icinde ve
  bu blok yapiskan (sticky). Boylece ucu birbiriyle **hicbir zaman cakismiyor**
  ve hepsi ekranin en ustunde kaliyor.
- `BildirimZili.jsx` — davet tipleri icin ikonlar; okunmamis davetler listenin
  en ustune cekiliyor.
- `ChallengesPage.jsx` — "Sana Gelen / Hizli Yaris Davetlerin / Grup Davetlerin"
  bloklari sayfanin **en ustune** tasindi, vurgulu bir kutu icinde.

**Gorsel (oyun hissi)**
- Ust cubuk: yapiskan cam serit, akan gradyanli logo, altin puan cipi.
- Alt menu: aktif sekmede yumusak hale + renkli ust cizgi + ikon buyumesi,
  cam zemin; davet rozeti nabiz atiyor.
- Butonlar: gradyan + ust parlaklik + basinca yaylanma.
- Bolum basliklari: sol tarafta mor-altin renk cubugu.
- Kartlar: ust kenarda isik cizgisi; mod kartlari basinca yaylaniyor.
- Hero: nefes alan isik, gradyanli puan sayisi.

### Tarayicida dogrulandi
Yerel sunucuda gercek CSS ile olcuulup duzeltilen iki sorun:
1. Toast ilk halinde ust cubugun **uzerine biniyordu** (logo, zil, puan cipi
   okunmuyordu) → toast yapiskan blogun icine, akisa alindi.
2. Yeni toast sinifi `.bd-toast`, ChallengesPage'in mevcut yesil "Davet
   gonderildi" kutusuyla **ayni isimdeydi** ve onu bozuyordu → `.bd-ust-toast`
   olarak yeniden adlandirildi.

### Kapsam disi birakildi
Davet geldiginde **push bildirimi** (uygulama kapaliyken telefon bildirimi)
gonderilmiyor — mevcut `send-push` akisina dokunulmadi. Istenirse ayri is.

---

## 2026-09-08 — Gorev 4 / Faz 1: canlida gorulen hatalar

**Kok nedenler ve duzeltmeler**

1. **Hizli Mod tamamen bozuktu** — `hizli_mod_cevap` RPC'si
   `returns table (dogru boolean, ...)` out-parametresi tanimlarken govdede
   `set dogru = dogru + ...` yaziyordu; out-parametre ile `hizli_mod_oturumlar.dogru`
   kolonu cakisiyordu (`column reference "dogru" is ambiguous`).
   Duzeltme (migration 064): `#variable_conflict use_column` + UPDATE'te tablo
   takma adiyla nitelendirme. **12 soruluk tam oturum SQL'de simule edildi, temiz.**

2. **Lig bostu.** Iki gercek sebep vardi (prompt'ta tahmin edilen `toplam_mac`
   degil; o zaten doluydu):
   - `lig_siralama` icinde `coalesce(is_bot,false) = false` → botlar ligde yok
   - haftalikta `puan_hafta > 0` sarti → canlida bu sarta uyan tek gercek oyuncu var
   Duzeltme: botlar ligde gorunur (satirda 🤖 rozeti), haftalik puan sarti kalkti
   (sıralama yine `puan_hafta`'ya gore; esitlik toplam puanla kirilir). Lig artik
   20 oyuncuyla dolu. Ana sayfadaki "En Iyiler" de ayni RPC'den besleniyor —
   iki liste artik birbirini tutuyor.

3. **Botlarin ulke/sehri yoktu** → sehir ve ulke liglerinde hic cikmiyorlardi.
   BilgeBot Istanbul, CaylakBot Ankara, UstaBot Izmir olarak isaretlendi.

4. **Turnuva lobisi tek kisilik goruyordu** — `bot_join_tournament` yalniz 1 bot
   ekliyordu ve yalniz baska oyuncu varsa. Artik uc bot da giriyor, kosulsuz;
   cron 5 dk once yerine **30 dk once** calisiyor.

5. **Mac ekraninda C/D siklari gorunmuyordu** — joker cubugu `position: fixed`
   ile ekranin altina yapisip siklarin ustune biniyordu. Artik akista, siklarin
   hemen altinda. Tarayicida 1522x784'te dogrulandi: 4 sik + joker + emoji satiri
   ayni ekranda.

6. **Alt bosluk** — `.app` padding-bottom 78px'ti (tabbar tam bu yukseklikte),
   Hizli Mod "BASLA" butonu menunun altinda kaliyordu. 94px yapildi; oyun modunda
   menu gizli oldugu icin 24px.

7. **"Hemen Oyna" modali gorunmuyordu** — `RakipAra` ana sayfanin icinde
   konumlaniyordu. Artik `createPortal` ile dogrudan `document.body`'ye basilan
   tam ekran katman. Bekleme 20 sn → **8 sn**, sonra bota dusuyor ve bunu ekranda
   soyluyor ("uygun rakip bulunamadi — BilgeBot ile oynuyorsun"). "Bot ile hemen
   oyna" butonu eklendi; rakip bulununca 1 sn "Rakip bulundu: X" gosteriliyor.

8. **Asenkron mac bilgisi** — maca girildiginde rakip ilerideyse bilgi karti
   ("BilgeBot 7 soruyu tamamladi — sira sende"), skor tabelasinda iki tarafin
   ilerlemesi (2/20 · 7/20). Bot ilerleme kilidi (`bot_oyna`) kontrol edildi:
   migration 058'deki "bot oyuncunun onune gecemez" kosulu yerinde ve dogru.

9. Puan cipi profile gidiyor; emoji/kalip satiri kucultulup soru kartinin altina
   alindi; emoji baloncugu `absolute` (duzeni itmiyor); kategori kartindaki
   yuzde iyice kucultuldu; ust cubuk tam genislikte (sag/sol sert kenar gitti);
   mac ekranina sol ustte "✕" cikis butonu eklendi.

**Migration:** `20260612000064_yayin_oncesi_duzeltmeler.sql` — canliya uygulandi
ve gecmise kaydedildi.

## Gorev 4 / Faz 2: yayin icin eksikler

**Android (TWA)** — `store/ANDROID_YAYIN.md` adim adim rehber.
- `public/bildim.webmanifest`: Bildim'e ozel manifest (`start_url=/bildim`,
  `display=standalone`, `orientation=portrait`, tema `#7c4dff`, kisayollar).
  Hub'in kendi manifestine DOKUNULMADI, diger oyunlar etkilenmiyor.
- Uygulama ikonu maskot baykustan uretildi: `bildim-icon.svg` kaynak,
  `bildim-icon-{192,512}.png` ve maskeli `bildim-icon-maskable-512.png`
  (sharp ile, gecici olarak scratchpad'e kuruldu — projeye bagimlilik eklenmedi).
- `public/.well-known/assetlinks.json` hazir; **SHA-256 parmak izi bos**,
  imza anahtari uretildikten sonra doldurulacak (rehberde komut var).

**Magaza varliklari** — `store/`:
`MAGAZA_METINLERI.md` (kisa aciklama 78/80 karakter, uzun aciklama ~1.550),
`EKRAN_GORUNTULERI.md` (8 ekran + basliklar), `ICERIK_DERECELENDIRME.md`
(IARC anketi cevaplari + veri guvenligi formu), `URUNLER.md` (Play Billing
urun kimlikleri), `ozellik-grafigi.svg` + `.png` (1024x500, uretildi).

**Reklam** — `lib/reklam.js` + `h5ads.js`'e `gecisReklamiGoster()` (`adBreak type:'next'`).
Kural: ilk 3 macta reklam yok · sonra her 3 macta bir · gunde en fazla 10.
Sayac localStorage'da; reklam akisi oyunu **asla bloklamaz**, hata yutulur.
`VITE_H5_ADS_CLIENT` bos oldugu surece hicbir reklam gosterilmez.

**Onboarding** — `components/Tanitim.jsx`: 3 kartlik tanitim (nasil oynanir /
kategoriler / lig), kurulum sihirbazindan ONCE. localStorage ile bir kez gosterilir,
"Atla" var.

**Hata durumlari** — `lib/hata.js`. 18 dosyadaki 42 ham hata gosterimi bu
yardimciya baglandi. Teknik kaliplar (`column`, `relation`, `permission denied`,
`ambiguous`, `constraint`...) kullaniciya **asla gosterilmez**; konsola yazilip
yerine anlasilir Turkce mesaj konur. Aginin kesilmesi, oturum dusmesi ve kota
asimi icin ozel metinler var.

**Bos durumlar** — turnuva lobisi ve bildirim zili tamamlandi; lig icin
"bu ligde tek basinasin" durumu ayrica ele alindi (arkadas davet / dunya ligi).

**Performans**
- Font zaten `display=swap`.
- `vite.config.js`'e `manualChunks`: react / router / supabase ayri parcalara
  alindi; Bildim'in seyrek acilan 8 sayfasi lazy yapildi.
- Ilk acilis paketi **607 kB → 112 kB** (uygulama kodu; gzip 32 kB). Vendor
  parcalari ayri ve onbelleklenebilir.
- **Onemli:** ilk denemede tum `node_modules` tek "vendor" parcasina toplaninca
  DriftGP'nin three.js'i (1 MB) her sayfaya sizdi. `index.html` preload listesi
  kontrol edilerek yakalandi ve geri alindi; agir bagimliliklar yine kendi lazy
  parcalarinda.

**Gizlilik metni** takma ad duzenine gore duzeltildi (kullanici adi degil takma ad
gorunur; Google fotografi otomatik alinmaz) ve reklam maddesi eklendi.

## Gorev 4 / Faz 3: "panel" degil "oyun" — radikal kozmetik

**Teshis:** her ekran ayni koyu mor zemin + ayni boyda cerceveli kartlar =
yonetim paneli dili.

**Yeni gorsel dil** (`bildim/styles/tema.css`, eski siniflar silinmedi):
- **Renk:** elektrik moru `#7C4DFF`, odul sarisi `#FFC83D`, basari `#2ECC71`,
  hata mercan `#FF5A5F`, ikincil camgobegi `#22D3EE`. On kategoriye sabit renk.
- **Zemin:** gece-mavisinden mora gradyan + isik lekeleri + iki katmanli
  yildiz/nokta dokusu.
- **Kart yok, yuzey var:** cerceveler kaldirildi; bolumler zeminden 2 ton acik
  yuzey ve yumusak golgeyle ayriliyor.
- **Chunky butonlar:** alt kenarda 4-6px koyu golge, basinca 3px asagi iner
  (`.btn`, `.bd-ana-eylem`, `.bd-secenek`, `.bd-joker`, `.bd-mod`, kategori plakalari).
- **Tipografi:** basliklar Baloo 2 800; buyuk sayilar 44-64px; buyuk harf +
  genis aralik yalniz kucuk etiketlerde.

**Ekran ekran**
- *Ana sayfa:* hero (maskot + rutbe + dev puan + ilerleme cubugu), sari chunky
  HEMEN OYNA, 2x3 renkli mod kartlari, turnuva dar bant, gunluk gorevler
  **acilir tek satir** ("1 odul hazir!" rozetiyle), uzun "En Iyiler" listesi
  yerine **tek satir lig ozeti** ("Bu hafta Kirklareli liginde 1. siradasin →").
- *Mac ekrani:* VS skor tablosu + iki tarafin ilerlemesi, zaman cubugu
  yesil→sari→kirmizi, buyuk soru karti, tam genislik chunky siklar (A/B/C/D
  renkli harf plakasi), dogruda yesil parlama, joker siklarin altinda 3 buton.
- *Sonuc:* buyuk gradyanli "Kazandin!" basligi + "+20 ⭐" kazanc satiri.
- *Lig:* podyum 1.'de tac, satirlar yuzeysiz ince ayirici, kendi satirin altta
  yapiskan serit, sekmeler segment kontrol.
- *Meydan Oku:* kategoriler **yatay kaydirmali renkli plakalar** (ikon + ad +
  soru sayisi), grup ve hizli mod kurulumu **acilir panellerde**.
- *Profil:* buyuk avatar + takma ad + rutbe ust blok, istatistikler 3'lu plaka.
- *Alt menu:* aktif ogede renkli plaka.

**Mobil / erisilebilirlik**
390px viewport'ta (iframe ile gercek media query) dogrulandi: yatay tasma yok
(`scrollWidth` 380), dokunma hedefleri >= 44px. Kontrast olculdu:
`--bd-metin-3` 5.01:1, `--bd-metin-2` 7.91:1, ana metin 15.37:1 — hepsi >= 4.5.

**Yol boyunca yakalanan hata:** sonuc ekraninda `toplamSoru` tanimsiz kaliyordu
(degisken yalniz aktif mac blogunda tanimliydi) — calisma aninda ReferenceError
verirdi; degisken yukari tasindi.

## Gorev 4 / Faz 4: kapanis

**Build temiz.** Ilk acilis paketi 112 kB (uygulama) + onbelleklenebilir
react/router/supabase parcalari.

### Migration sirasi ve durumu
| No | Dosya | Durum |
|---|---|---|
| 059-062 | `soru_parti13..16` | canliya uygulandi (onceki oturum) |
| 063 | `davet_bildirimleri` | canliya uygulandi |
| **064** | **`yayin_oncesi_duzeltmeler`** | **canliya uygulandi** |

Hepsi `supabase migration repair --status applied` ile gecmise islendi.
**Not:** `20260612000034` (Gladius `gl_temel`) hala uygulanmamis durumda —
Bildim kapsami disinda, bilerek dokunulmadi.

### Senin yapman gerekenler (kod tarafinda is kalmadi)

**1. Android / Play Console** — adim adim: `store/ANDROID_YAYIN.md`
- `npm i -g @bubblewrap/cli`
- `bubblewrap init --manifest https://idagg-game-center.vercel.app/bildim.webmanifest`
  (Play Billing icin `--enablePlayBilling`)
- `keytool -genkeypair ... -keystore ~/bildim-release.keystore -alias bildim`
  → **anahtari ve parolayi yedekle, kaybedersen uygulamayi guncelleyemezsin**
- `keytool -list -v ... | grep SHA256` → cikan parmak izini
  `public/.well-known/assetlinks.json` icindeki yer tutucuya yaz ve deploy et
- `bubblewrap build` → `app-release-bundle.aab`

**2. Play Console icerikleri**
- Magaza metinleri: `store/MAGAZA_METINLERI.md` (kopyala-yapistir)
- 8 ekran goruntusu: `store/EKRAN_GORUNTULERI.md` listesine gore
- Ozellik grafigi: `store/ozellik-grafigi.png` (1024x500, hazir)
- Icerik derecelendirme + veri guvenligi: `store/ICERIK_DERECELENDIRME.md`
- Uygulama ici urunler: `store/URUNLER.md` — kimlikler `joker_paketleri`
  tablosundaki `kod` ile **birebir** ayni olmali

**3. Ortam degiskenleri (Vercel)**
- `VITE_H5_ADS_CLIENT` = AdSense yayinci kimligi (`ca-pub-...`).
  Bos kaldigi surece reklam gosterilmez, sahte odul verilmez.
- Play Developer API servis hesabi anahtari → Supabase secrets (satin alma
  dogrulamasi icin).

### Bu oturumda alinan kararlar
- **Botlar ligde gorunur.** Bos lig olu duruyordu; botlar 🤖 rozetiyle listede.
- **Haftalik ligde `puan_hafta > 0` sarti kaldirildi.** Hafta basinda lig
  bosaliyordu; siralama yine haftalik puana gore, esitlik toplam puanla kirilir.
- **Eslestirme 20 sn degil 8 sn** bekliyor, sonra bota dusuyor ve bunu ekranda
  soyluyor.
- **Joker cubugu sabit degil akista.** Sabitken C/D siklarinin ustune biniyordu;
  dikkat dagitmamasi icin sabitlenmisti ama siklari gizlemek daha kotu.
- **Ana sayfadaki "En Iyiler" listesi kaldirildi**, yerine tek satir lig ozeti
  (prompt'un istegi) — uzun liste ana sayfayi panel gibi gosteriyordu.
- **Ham SQL hatasi kullaniciya asla gosterilmiyor** (`lib/hata.js`).

---

## 2026-09-08 — Yayin oncesi son rotus

### 1) Meydan Oku sayfa duzeni
Canlida sayfanin en ustunde "📤 Kurdugun Gruplar (yanit bekleniyor)" blogu
duruyordu ve icerigi `"Oyuncu (bekliyor), Oyuncu (hazir)"` seklinde duz metindi.
Sebep: Faz 1'de gelen davetler ust bloga tasinirken bu blok da sarmalayicinin
icinde kalmisti.

- Blok ust sarmalayicidan cikarildi, kurulum bolumlerinden **sonraya** alindi.
  Sayfa sirasi: gelen davetler → kategori → botlar → arkadaslar → grup kurulumu
  → hizli kurulum → **bekleyen davetlerin** → devam edenler → bitenler.
  (Gelen davetler bilerek ustte birakildi: "meydan okuma en ustte gorunsun"
  onceki acik istekti ve ust davet bandiyla tutarli.)
- Duz metin yerine **kart listesi**: `BekleyenKurulum` bileseni — katilimci
  avatarlari, yesil ✓ / gri … durum rozetleri, "1/2 hazir" sayaci ve
  **"Iptal et"** butonu. Davet yoksa blok hic gorunmuyor.
- **Iptal icin sunucu tarafi yoktu**: `migration 065` ile `grup_mac_iptal` ve
  `hizli_mac_iptal` eklendi (yalniz kurucu, yalniz mac baslamadan). Canliya
  uygulandi.
- **`lib/oyuncu.js`**: takma ad secmemis herkes "Oyuncu" gorundugu ve ayni
  ekranda karistigi icin `oyuncuAdi()` artik "Oyuncu #4f2a" (kimligin son 4
  hanesi) uretiyor.

### 2) Kategori seridi
- Sagda **sonumlenen maske** (`mask-image`), serit sona gelince kayboluyor.
- `scroll-snap-type: x mandatory` + plakalarda `scroll-snap-align: start`.
- Sag kenarda hafif salinan **"›" ipucu** (sonda gizleniyor).
- Secili kategori `scrollIntoView({inline:"center"})` ile gorunur alana kayiyor.

### 3) Mobil dogrulama — 390x844 gercek viewport (iframe, `max-width:400px` aktif)

| Ekran | Yatay tasma | Olculen | Sonuc |
|---|---|---|---|
| Mac ekrani | yok | 4 sik da tam genislikte; joker cubugu / sik kesisimi **yok**; "Bu soru adil miydi?" gorunur | ✅ |
| Hizli Mod | yok | BASLA butonu gorunur, tabbar'in altinda kalmiyor (46px yukseklik) | ✅ |
| Ana sayfa | yok | hero ve 6 mod karti viewport icinde | ✅ |
| Lig | yok | podyum tasmiyor; kendi satirin gorunur ve tabbar ustunde | ✅ |
| Meydan Oku | yok | kategori seridi tasmiyor (7 kart, kaydirilabilir); tum butonlar icerde | ✅ |
| Joker Dukkani | yok | 4 buton icerde; en kucuk dokunma hedefi **46px** (>=44) | ✅ |
| Profil | yok | 5 buton icerde; "Hesabimi Sil" kaydirma sonunda tabbar'in **37px** ustunde | ✅ |

Bu turda yakalanip duzeltilen iki kusur: bekleyen davet kartinda oyuncu adlari
kesiliyordu (genislik 62→78px, yazi 10px) ve "Kurdugun davetler (yanit
bekleniyor)" basligi 390px'te iki satira tasiyordu → "Bekleyen davetlerin".

### 4) Yayin paketi son kontrol (tarayicida dogrulandi)

`/bildim.webmanifest` → HTTP 200, `application/manifest+json`, hatasiz JSON:

| Alan | Deger |
|---|---|
| name / short_name | "Bildim! — Bilgi Yarismasi" / "Bildim!" |
| start_url | `/bildim` |
| display / orientation | `standalone` / `portrait` |
| theme_color | `#7c4dff` (tema.css `--bd-vurgu` ile ayni) |
| background_color | `#0b0918` (tema.css `--bd-zemin` ile ayni) |
| ikonlar | 192 (26 kB), 512 (70 kB), maskable 512 (61 kB) — hepsi HTTP 200, gercek PNG |

**`assetlinks.json`: parmak izi hala `BURAYA_IMZA_ANAHTARININ_SHA256_PARMAK_IZI_YAZILACAK`
— imza anahtari uretildikten sonra doldurulacak.** (Paket adi `com.idagg.bildim` hazir.)

**Gizlilik metni** zaten Faz 2'de takma ad duzenine gore guncellenmisti; "kullanici
adi siralamalarda herkese gorunur" ifadesi kalmadi (grep ile dogrulandi).

**Hesabimi Sil — ucdan uca test edildi** (rollback icinde sahte kullaniciyla):
`hesabimi_sil()` → `'tam'`; hem `auth.users` hem `profiles` kaydi silindi (1→0).
Arayuz akisi: onay modali → kullanici adini yazma → silme → `signOut()`.
Hata durumunda `hataMesaji()` ile Turkce mesaj gosteriliyor.

### Kalan manuel isler (kodda is yok)
1. **Imza anahtari**: `keytool -genkeypair ... -keystore ~/bildim-release.keystore
   -alias bildim` → SHA-256'yi `public/.well-known/assetlinks.json` icine yaz,
   deploy et. Anahtari ve parolayi yedekle.
2. **AdSense**: Vercel'de `VITE_H5_ADS_CLIENT` = `ca-pub-...`. Bos kaldigi surece
   reklam gosterilmez, sahte odul verilmez.
3. **Play Console urun kimlikleri**: `joker_kucuk`, `joker_orta`, `joker_buyuk`
   — `joker_paketleri` tablosundaki `kod` ile birebir ayni olmali
   (`select kod, ad, adet from joker_paketleri order by adet;`).
4. Magaza metinleri/gorseller: `store/` klasoru hazir.

---

## 2026-09-08 — Canli testte bulunan 5 hata

### 1) Grup macinda botlar onden oynuyordu (oncelikli)
Canli: 3 kisilik grup maci kuruldu, oyuncu hic cevap vermeden mac 8/20'ye
ilerledi (BilgeBot 93, CaylakBot 38, oyuncu 0).

**Kok neden — `bot_oyna()` icinde iki eksik:**
1. Bot cevap kosulu insan oyuncunun ilerlemesine hic bakmiyordu. 1v1 icin
   migration 058'de eklenen "bot oyuncunun onune gecemez" kilidi grup ve hizli
   moda **uygulanmamisti**.
2. Otomatik ilerletme kosulu `now() > soru_baslangic + 16 saniye` idi; oyuncu
   ekrani hic acmasa bile mac 20 soruyu kendi kendine tuketiyordu.

**Duzeltme (migration 066, her iki mod icin):**
- Bot, insan oyuncularin ulastigi soru indeksini **gecemez**
  (`aktif_soru <= 1 + max(insan cevap indeksi)`).
- Bot cevap gecikmesi sabit degil, **2-6 sn rastgele**.
- Otomatik ilerletme: herkes cevapladiysa **veya** sure doldu ve en az bir insan
  bu soruyu fiilen oynadiysa **veya** mac terk edilmis (10 dk guvenlik agi).

**SQL testi — 3 kisilik grup maci, insan hic cevap vermiyor, botlara 30 tur:**

| | aktif_soru | durum | botun ulastigi en ileri soru | bot skoru |
|---|---|---|---|---|
| Once (canli hal) | **19** | **bitti** | 0 | 16 |
| Sonra (066) | **0** | **aktif** | 0 | 16 |

Yani duzeltmeden sonra mac ilk soruda bekliyor; oyuncu geldiginde oynayabiliyor.
(Botun ilk soruyu cevaplamasi kural geregi: `0 <= 1 + (-1)`, 1v1'deki davranisin
aynisi.)

**Yarim kalan maclari temizleme:** `grup_mac_iptal` / `hizli_mac_iptal` artik
aktif maclari da iptal edebiliyor (kurucu her zaman; katilimci yalniz mac
baslamadan). Meydan Oku'da "Devam Eden Grup Maclari" ve "Devam Eden Hizli
Yarislar" satirlarina **Iptal** butonu eklendi.

### 2) Manifest linki yanlisti
Bildim sayfalarinda `<link rel="manifest">` hala hub'in `/manifest.webmanifest`
dosyasini gosteriyordu. `bildim/lib/manifest.js` + `useBildimManifest()` eklendi;
Layout monte olunca manifest ve `theme-color` Bildim'e geciyor, hub'a donunce
eski degerler geri yukleniyor.

Tarayicida olculdu (hook gercek bir React bileseninde monte edilerek):

| | link[rel=manifest] | theme-color |
|---|---|---|
| Hub | `/manifest.webmanifest` | `#0d0b1f` |
| Bildim rotasi | **`/bildim.webmanifest`** | **`#7c4dff`** |
| Hub'a donunce | `/manifest.webmanifest` | `#0d0b1f` |

### 3) Bildirimde ham kategori anahtari
"🎖️ genel_kultur kategorisinde Cirak oldun!" → **"Genel Kultur kategorisinde"**.
Migration 067: SQL tarafinda `kategori_adi(text)` fonksiyonu (istemcideki
`lib/kategoriler.js` ile ayni adlar) ve `kategori_dogru_arttir` bunu kullaniyor.
Daha once yazilmis bildirimler de UPDATE ile duzeltildi.

**Tum bildirim tipleri tarandi** — ham anahtar/ID sizan tek yer buydu; diger
metinler `gorunen_ad`, sayi veya sabit metin kullaniyor, mac id / kullanici id
hicbir bildirimde gecmiyor.

### 4) Gizlilik metni
"Paylasim" bolumundeki "Kullanici adin, profil gorselin..." ifadesi
**"Takma adin, sectigin avatar, puanin ve sehir/ulke bilgin"** olarak duzeltildi;
gercek ad ve e-postanin hicbir zaman gosterilmedigi eklendi. Metnin tamami
tarandi, baska "kullanici adi" ifadesi kalmadi. Profil'deki silme onayinda
"Kullanici adin" etiketi **"Hesap kimligin"** yapildi.

Ayrica magaza belgelerindeki gizlilik URL'si `/bildim/gizlilik` → **`/gizlilik`**
olarak duzeltildi (dogru rota bu; girissiz erisilebilir olmasi Play icin sart).

### 5) Dusuk kontrastli link
Joker Dukkani'ndaki "Gizlilik Politikasi" linki `--primary` (#8b5cf6) ile
koyu kart uzerinde **3.76:1** kontrasta sahipti. `tema.css`'e ortak link stili
eklendi: `--bd-baglanti: #c9b8ff`, alti cizili, hover'da altin.
Olculen yeni kontrast: **8.93:1** (hedef >= 4.5). Navigasyon/kart/buton
gorunumlu linkler (tabbar, mod kartlari, kategori plakalari, puan cipi, paylas
butonlari) ortak stilden muaf tutuldu.

### Migration'lar
| No | Dosya | Durum |
|---|---|---|
| 066 | `grup_bot_ilerleme` | **canliya uygulandi** + gecmise kaydedildi |
| 067 | `kategori_adi_bildirim` | **canliya uygulandi** + gecmise kaydedildi |

> Gorev metninde "migration 065" deniyordu; 065 numarasi bir onceki oturumda
> `davet_iptal` tarafindan kullanildigi icin bu is 066 + 067 olarak yazildi.
> Studio'da elle calistirmaya gerek yok — kullanicinin kalici talimati geregi
> migration'lar dogrudan uygulandi.

### Degisen dosyalar
- `supabase/migrations/20260612000066_grup_bot_ilerleme.sql` (yeni)
- `supabase/migrations/20260612000067_kategori_adi_bildirim.sql` (yeni)
- `bildim/lib/manifest.js` (yeni)
- `bildim/components/Layout.jsx` — `useBildimManifest()`
- `bildim/pages/ChallengesPage.jsx` — aktif maclara Iptal butonu, `oyuncuAdi()`
- `bildim/pages/GizlilikPage.jsx` — paylasim metni
- `bildim/pages/ProfilePage.jsx` — "Hesap kimligin" etiketi
- `bildim/styles/tema.css` — ortak link stili
- `store/ANDROID_YAYIN.md`, `store/MAGAZA_METINLERI.md` — gizlilik URL'si

---

## 2026-09-08 — Revize paketi #2

### 1) KÖK NEDEN: `position: fixed` modaller ekran dışında açılıyordu (KRİTİK)

Kullanıcının teşhisi doğruydu. `bildim/styles/tema.css`:

```css
@keyframes bd-sayfa-gir { from { opacity:0; transform: translateY(10px) } ... }
.sayfa > * { animation: bd-sayfa-gir 0.15s ... both; }
```

`transform` içeren keyframe + `animation-fill-mode: both`, uygulandığı elemanı
**containing block** yapıyor; içindeki `position: fixed` katman artık viewport'a
değil o elemana göre konumlanıyordu. Ölçüm: modal `top: -916px`. Kullanıcı
hesabını pratikte silemiyordu.

**Düzeltme (iki katmanlı):**
1. Giriş animasyonundan `transform` çıkarıldı — yalnız `opacity`
   (`.sayfa > *` ve `.bd-giris-1..4`). Artık containing block oluşmuyor.
2. `components/Modal.jsx` eklendi: **her modal `createPortal` ile
   `document.body`'ye** basılıyor, Esc ile kapanıyor, açıkken arka plan
   kaydırması kilitleniyor. Bu, aynı sınıf hatanın tekrarını kökten engelliyor.

**Portala taşınan modaller** (tarandı, tamamı):

| Modal | Dosya |
|---|---|
| Hesap silme onayı | `pages/ProfilePage.jsx` |
| Şehir seçimi (lig) | `pages/LeaderboardPage.jsx` |
| Şehir seçimi (bileşen) | `components/KonumSecici.jsx` |
| Kurulum sihirbazı (takma ad / avatar / şehir) | `components/KurulumSihirbazi.jsx` |
| Rakip arama | `components/RakipAra.jsx` (zaten portaldı) |
| Tanıtım (onboarding) | `components/Tanitim.jsx` (kendi tam ekran katmanı) |

**DOĞRULAMA — 390×844, gerçek viewport:**

Önce kök neden testi: animasyonlu (`fill-mode: both`) bir kabın içindeki
`position: fixed` katman, sayfa 900px kaydırılmışken:

| | top | bottom | viewport'a göre mi? |
|---|---|---|---|
| Önce (bildirilen) | **-916** | — | hayır |
| Sonra | **0** | **844** | **evet** |

Sonra gerçek modal işaretlemesiyle dört senaryo:

| Senaryo | Katman (top→bottom) | İçerik (top→bottom) | Ekran içinde |
|---|---|---|---|
| Animasyonlu kap içinde, sayfa üstünde | 0 → 844 | 343 → 501 | ✅ |
| Animasyonlu kap içinde, 900px kaydırılmış | 0 → 844 | 343 → 501 | ✅ |
| body'ye portal, 900px kaydırılmış | 0 → 844 | 343 → 501 | ✅ |
| body'ye portal, sayfa sonunda (2500px) | 0 → 844 | 343 → 501 | ✅ |

### 3) "Hızlı Olan Kazanır" hiç oynanamıyordu (KRİTİK)

Doğrulandı: `hizli_maclar_oyuncu_sayisi_check` = **5 zorunlu** (4 rakip),
sistemde yalnız **3 bot** vardı. Arkadaşı olmayan oyuncu modu kuramıyordu.
Aynı sorun 5 kişilik grup maçında da vardı.

**Seçenek (b) uygulandı — 2 yeni bot** (migration 068).
GEREKÇE: (a) modu 3-5 esnek yapmak DB kısıtını, ilk-doğru puanlamasını ve
"5 kişi" yazan tüm arayüz metinlerini değiştirmeyi gerektirirdi; (c) otomatik
doldurma yeni bir arayüz akışı demekti. İki profil satırı eklemek **mevcut
kısıtlara, akışa ve metinlere hiç dokunmadan** her iki modu da açıyor.

Zorluk dağılımı artık: AcemiBot 0.25 · ÇaylakBot 0.40 · KurtBot 0.55 ·
BilgeBot 0.70 · UstaBot 0.90 (her biri farklı şehir → şehir liglerine de katkı).

**DOĞRULAMA** — arkadaşı olmayan hesapla, yalnız botlarla:

| Mod | oyuncu_sayisi | durum | katılımcı |
|---|---|---|---|
| Hızlı Olan Kazanır | 5 | bekliyor | **5/5** |
| Grup maçı (5 kişi) | 5 | bekliyor | **5/5** |

### 4) Kaydırırken üstte beyaz flaş

Sebep: zemin gradyanı yalnız `body`'de ve `background-attachment: fixed`;
repaint sırasında altındaki **`html` elemanının varsayılan beyaz zemini**
görünüyordu. Sabit üst bloğun `backdrop-filter`'ı repaint'i sıklaştırıyordu.

Düzeltme: `html`'e `background-color: #0a0818` + `color-scheme: dark`;
`.bd-ust-blok`'a `will-change: transform` + `translateZ(0)` (kendi kompozisyon
katmanı). DOĞRULAMA: 6 kaydırma karesinde üst şeritteki eleman her seferinde
`topbar`, zemin `rgb(10,8,24)`; ekran görüntüsünde beyaz alan yok.

### 2, 5, 6, 7, 8 — önceki oturumda düzeltilmişti, canlı kodda doğrulandı

Kullanıcının testi `e6d4aae` deploy'u yayılmadan yapılmış. Yeniden ölçüldü:

| # | Konu | Doğrulama |
|---|---|---|
| 2 | Grup/hızlı maçta bot ilerleme kilidi | SQL testi: insan cevap vermezken maç **0. soruda `aktif`** kalıyor (önce 19. soruya gidip bitiyordu). Migration 066 canlıda. |
| 5 | Manifest linki | `useBildimManifest()` Layout'ta; Bildim rotasında `/bildim.webmanifest` + `#7c4dff`, hub'a dönünce eski değerler |
| 6 | Bildirimde ham anahtar | Canlı kayıt: **"🎖️ Genel Kültür kategorisinde Çırak oldun!"** (migration 067) |
| 7 | Gizlilik metni | "Kullanıcı adın" ifadesi **0 kez** geçiyor; "Takma adın / avatar" düzeni yerinde |
| 8 | Link kontrastı | `--bd-baglanti: #c9b8ff`, ortak `a` stili; ölçülen kontrast **8.93:1** |

> **Migration numarası notu:** görev metni "migration 065" diyordu; 065
> (`davet_iptal`) ve 066/067 önceki oturumlarda kullanıldığı için bu oturumun
> yeni migration'ı **068** oldu. Studio'da elle çalıştırmaya gerek yok —
> kalıcı talimat gereği doğrudan uygulandı ve geçmişe kaydedildi.

---

## 2026-09-08 — Arkadas ekleme calismiyordu (KRITIK)

**Sikayet:** "arkadas ekleme konusunda sikinti var, eklenmiyor."
**Dogrulandi — sikayet tamamen hakliydi.**

### Kok neden
`arkadas_davet_kodu_ile_ekle` RPC'si cagrilinca patliyordu:

```
column reference "gorunen_ad" is ambiguous
```

Fonksiyon `returns table (durum text, gorunen_ad text)` tanimliyor; govdede
bildirim metni kurulurken

```sql
(select gorunen_ad from public.profiles where id = auth.uid())
```

**niteliksiz** yazilmis. `gorunen_ad` hem out-parametre hem kolon oldugu icin
PL/pgSQL karar veremiyor.

**Etkisi:** davet koduyla arkadas eklemenin uc yolundan **ikisi tamamen
kirikti** — hem yeni istek gonderme (`istek_gonderildi`) hem karsilikli
eslesme (`arkadas_oldu`). Yalniz "zaten arkadassiniz" dali calisiyordu (o
dalda alt sorgu yok). Yani pratikte **hic kimse arkadas ekleyemiyordu**.
`lib/hata.js` ham SQL'i gizledigi icin kullanici yalnizca genel bir hata
mesaji goruyordu.

### Duzeltme (migration 069)
Alt sorgu tablo takma adiyla nitelendirildi (`me.gorunen_ad`) ve bir kez
degiskene alindi; fonksiyona `#variable_conflict use_column` eklendi.

### Dogrulama — ucu de calisiyor

| Senaryo | Donen durum | Sonuc |
|---|---|---|
| Yeni istek | `istek_gonderildi` | `friendships` satiri `bekliyor` ✅ |
| Karsi taraf kodu girer | `arkadas_oldu` | satir `arkadas` oldu ✅ |
| Zaten arkadas | `zaten_arkadas` | degisiklik yok ✅ |

Bildirimler de dogru uretildi: "idagg sana arkadaslik istegi gonderdi." /
"Oyuncu arkadasin oldu! 🤝"

### Ayni hata sinifi icin SISTEMATIK TARAMA
Bu, ayni desendeki **ucuncu** hataydi (once `hizli_mod_cevap.dogru`, sonra bu).
Bir daha surpriz olmasin diye tum `returns table` + plpgsql fonksiyonlari
**gercekten cagrilarak** tarandi; yalniz `ambiguous` iceren hatalar raporlandi:

Temiz cikanlar: `lig_siralama`, `sehir_lig_sirasi`, `benim_lig_durumum`,
`hizli_mod_siralama`, `hizli_mod_ozetim`, `bekleyen_davetlerim`,
`ustalik_seviyelerim`, `ezeli_rakip`, `get_daily_quests`, `get_categories`,
`profil_al`, `remove_friend` — ve gecersiz id ile erken cikabilecekleri
gercek veriyle ayrica test edildi:

| RPC | Gercek maçla test | Sonuc |
|---|---|---|
| `submit_group_match_answer` | gercek grup maci kuruldu, insan cevabi gonderildi | ✅ temiz |
| `submit_hizli_cevap` | gercek hizli mac kuruldu, insan cevabi gonderildi | ✅ temiz |

**`arkadas_davet_kodu_ile_ekle` disinda ambiguous hatasi olan baska RPC yok.**

---

## 2026-09-08 — "Hizli Olan Kazanir" maci acilmiyordu (KRITIK)

Belirti: yaris kuruluyor, `/bildim/hizli-mac/<id>` acilinca sayfa kalici olarak
**"Yukleniyor…"** kaliyordu. Konsolda hata yok. Grup macinda ayni akis calisiyor.

### Iki ayri kok neden bulundu (tahminle degil, sorgu calistirilarak)

**A) RLS sonsuz ozyinelemesi — sayfa hic acilmiyordu**

`hizli_oyuncular` tablosunu sorgulamak dogrudan hata veriyordu:

```
ERROR: infinite recursion detected in policy for relation "hizli_oyuncular"
```

Politika KENDI TABLOSUNU sorguluyordu:
```sql
exists (select 1 from hizli_oyuncular ho2
        where ho2.hizli_mac_id = hizli_oyuncular.hizli_mac_id
          and ho2.user_id = auth.uid())
```
Alt sorguya da RLS uygulandigi icin ozyineleme olusuyor. `hizli_maclar`
politikasi da ayni tabloyu sorguladigindan o da tetikleniyordu.

Grup macinda bu sorun YOK, cunku orada `grup_mac_uyesi_mi(uuid)` adinda bir
**SECURITY DEFINER** yardimci fonksiyon kullanilmis. Ayni desen hizli maca
uygulanmamisti. Migration 070 bunu uyguladi (`hizli_mac_uyesi_mi`).

**B) Dogru cevap puan getirmiyordu — ikinci ambiguous hatasi**

`submit_hizli_cevap` icinde:
```sql
where hizli_mac_id = ... and soru_index = ... and dogru   -- NITELIKSIZ
```
Fonksiyon `returns table (dogru boolean, ...)` tanimladigi icin belirsizlik.
**Yalniz DOGRU cevap verildiginde** bu dala girildigi icin gorunmuyordu —
onceki taramada yanlis cevapla test edilmisti, o yuzden "temiz" cikmisti.
Etkisi: modun tek puanlama kurali (ilk dogru +10) hic calismiyordu.
Migration 071 ile nitelendirildi.

> Ders: bu fonksiyonlari test ederken **hem dogru hem yanlis cevap** yolunu
> ayri ayri denemek gerekiyor. Diger cevap RPC'leri (`submit_match_answer`,
> `submit_group_match_answer`, `submit_tournament_answer`) kontrol edildi:
> onlarda `dogru` yalnizca INSERT kolon listesinde geciyor, belirsizlik yok.

### DOGRULAMA — uctan uca (4 botla yaris)

| Adim | Beklenen | Sonuc |
|---|---|---|
| 1. Sayfa sorgusu (RLS) | mac + katilimcilar okunabilir | mac 1, katilimci **5/5** ✅ |
| 2. Botlar kabul + baslangic | durum `aktif`, 20 soru | `aktif`, 20 soru, 5 kabul ✅ |
| 3. Soru geliyor mu | `get_hizli_soru` satir dondurur | soru_index 0, soru geldi ✅ |
| 4. Ilk dogru cevap | `dogru=true, ilk=true` | **true / true** ✅ |
| 5. Puan | +10 | skor **10** ✅ |
| 6. Mac sonu | `durum='bitti'` | 20 soru tamamlandi, **`bitti`** ✅ |

### Sayfa artik sonsuza dek "Yukleniyor" gostermiyor
`components/MacYukleniyor.jsx`: 8 saniyede veri gelmezse Turkce aciklama +
**"Tekrar dene"** + **"Maci iptal et"** + "Meydan okumalara don".
Uc mac sayfasina da baglandi (hizli, grup, 1v1). Ayrica `macYukle` artik
**hatayi yutmuyor** — konsola yaziyor ve ekranda gosteriyor; sessiz
kilitlenmenin ikinci sebebi buydu (`const { data } = ...` ile error yok
sayiliyordu).

### Yarim kalan maclar
- Bildirilen takili mac (`ddeae48c-…`) **iptal edildi**.
- `hizli_mac_temizle()` / `grup_mac_temizle()` eklendi; `bildim-yarim-mac-temizle`
  cron'u saatte bir calisiyor (hizli mac 10 dk, grup mac 30 dk hareketsizse kapatir).
- Kullanicida "Maci iptal et" zaten var (Meydan Oku listesi + yukleme ekrani).

### Migration'lar
| No | Dosya | Durum |
|---|---|---|
| 070 | `hizli_mac_rls_ozyineleme` | canliya uygulandi + gecmise kaydedildi |
| 071 | `hizli_cevap_ambiguous` | canliya uygulandi + gecmise kaydedildi |

---

## 2026-09-09 — Asenkron mac + son 5 saniye heyecani + telefon bildirimi

**Istek:** "Oyuncular ayni anda oynayamiyor, gecikme/kopma oluyor. Mac tek taraf
icin devam etsin, digeri sonradan oynasin. Yarim kalan musabaka gozuksun,
tiklayip girilebilsin. Son 5 saniye sayi saysin, heyecan yaratsin. Bildirim
telefona ve oyun ici zile muhakkak gelsin."

### 1) 1v1 mac artik ASENKRON (migration 072)

**Onceki durum:** `matches.aktif_soru` ve `soru_baslangic` iki oyuncu icin
ORTAKTI, soru suresi 16 sn. Baglantisi kopan ya da o an oynamayan taraf
sorulari kaciriyor, mac onsuz akip bitiyordu.

**Yeni davranis:** her oyuncu KENDI hizinda oynar.
- `oyuncu1_soru` / `oyuncu2_soru` — kendi sira indeksi
- `oyuncu1_baslangic` / `oyuncu2_baslangic` — 16 sn, oyuncu soruyu **kendi
  actigi andan** itibaren isler (kopan baglanti ceza olmuyor)
- Mac, **iki taraf da** kendi sorularini bitirince biter
- Bir taraf bitirip digeri 24 saat oynamazsa mac kapanir (terk)
- `mac_soruyu_atla`: sure dolunca yalniz KENDI siran atlanir, rakip beklenmez
- `aktif_soru` kolonu silinmedi; "en ileri oyuncu" gostergesi olarak kaldi
- `bot_oyna` da asenkrona uyarlandi: bot kendi indeksiyle oynar ve **insan
  oyuncunun sirasini gecemez**

**DOGRULAMA — iki oyuncu farkli hizda:**

| Adim | Beklenen | Sonuc |
|---|---|---|
| O1 bes soru oynadi | O2 etkilenmez | o1=5, o2=0, mac `aktif` ✅ |
| O2 gecikmeli geldi, 3 soru oynadi | kendi sirasindan devam | **kendi 4. sorusu** (index 3) geldi, hicbir soru kacirilmadi ✅ |
| Bagimsiz ilerleme | ayri cevap sayilari | o1=5 cevap, o2=3 cevap ✅ |
| Iki taraf da bitirdi | mac biter | `bitti`, kazanan belirlendi ✅ |

### 2) Yarim kalan musabakalar gorunuyor
- **Meydan Oku > Devam Eden**: her satirda `6/20 soru` ilerlemesi, sira sende
  ise altin **"SIRA SENDE"** rozeti ve "Devam et →" butonu; degilse
  "rakip oynuyor" ve "Gor →".
- **Ana sayfa**: hero'nun hemen altinda "Yarim kalan macin var — sira sende!"
  seridi (birden fazlaysa sayiyi yazar), tiklayinca dogrudan maca girer.
- **Mac ekrani**: kendi bolumun bitmisse "Senin bolumun bitti 🎉" ekrani —
  skor tablosu ve "rakip kendi zamaninda oynayinca sonuclanacak" aciklamasi.

### 3) Son 5 saniye heyecani
- Ekran kenarlari **kalp atisi ritminde** kizarir (`lup-dup`: 1 sn'de iki vurus).
- Ortada dev geri sayim rakami her saniye buyuyup soner.
- Sure halkasi nabiz gibi atar, sayi kirmizi parlar, soru karti kirmizi cerceve alir.
- Cevap verildikten sonra tetiklenmez; `prefers-reduced-motion` saygili.
- Tarayicida dogrulandi: `bd-kalp-atisi` + `bd-halka-nabiz` animasyonlari aktif,
  geri sayim 132px.

### 4) Bildirim: telefon + oyun ici zil (migration 073)
- `bildirim_yaz` artik **tek kaynak**: hem `bildirimler` tablosuna yazar hem
  `send-push` Edge Function'ini `pg_net` ile cagirir (atesle-unut). Push
  basarisiz olsa bile uygulama ici bildirim her halukarda duser.
- Her bildirim tipine uygun baslik: "⚔️ Meydan okuma!", "⏳ Sira sende!",
  "🤝 Arkadaslik istegi", "🏆 Hafta bitti" …
- **Yeni: "sira sende" bildirimi** — asenkron macta rakip hamlesini yapinca
  henuz oynamamis tarafa bildirim gider (ayni mac icin en fazla saatte bir,
  spam olmasin). Tetikleyici testte doğrulandi:
  `"idagg hamlesini yapti — sira sende! ⏳"` → `/bildim/mac/<id>`

### Migration'lar
| No | Dosya | Durum |
|---|---|---|
| 072 | `asenkron_1v1` | canliya uygulandi + gecmise kaydedildi |
| 073 | `bildirim_push` | canliya uygulandi + gecmise kaydedildi |

---

## 2026-09-09 — CANLI TEST (yayin oncesi)

Canli sitede idagg oturumuyla ucdan uca gezildi: ana sayfa, mac ekrani, Meydan
Oku, bildirim zili, hizli mod kurulumu ve gercek mac oynandi.

### Calistigi dogrulananlar
| Ozellik | Kanit |
|---|---|
| Yarim kalan mac seridi | Ana sayfada "Yarim kalan macin var — sira sende!" cikti, tiklayinca maca girdi |
| "SIRA SENDE" rozeti | Meydan Oku > Devam Eden: `sillaaa · SIRA SENDE · 12-85 · 6/20 soru · Devam et →` |
| Asenkron ilerleme | Mac ekraninda kendi 7. sorumdaydim, rakip 1 soruda; kimse birbirini beklemiyor |
| Sure dolunca kendi sirasi atlanir | Soru 1 → Soru 3'e gecti, ilerleme 2/20 oldu, mac bitmedi |
| Son 5 saniye | Soru karti kizardi, sayac kirmizi nabiz, zaman cubugu kritik renkte |
| Bes bot | AcemiBot · CaylakBot · KurtBot · BilgeBot · UstaBot listede |
| **"Hizli Olan Kazanir" kurulabiliyor** | "4/4 rakip secildi", buton aktif, yaris kuruldu ve **acildi** (eskiden sonsuz "Yukleniyor"du) |
| Hizli modda puanlama | BilgeBot ilk dogruyu verip **+10** aldi (ambiguous duzeltmesi calisiyor) |
| Bildirim zili | "sillaaa sana meydan okudu! ⚔️" ve "🎖️ Genel Kultur kategorisinde Cirak oldun!" (ham anahtar yok) |
| **"Sira sende" bildirimi** | "AcemiBot hamlesini yapti — sira sende! ⏳" zile dustu |
| Bot davetleri | Hizli maca 4 bot kabul edip yaris basladi |

### Canli testte BULUNAN ve duzeltilen hatalar

**1. Mac ekraninda ilerleme gostergesi hic render edilmiyordu (KRITIK yarim is)**
`bd-vs-ilerleme` yalniz sonuc ekraninda vardi; **aktif mac skor tabelasinda
yoktu**. Asenkron macin en onemli bilgisi (kim nerede) ekranda gorunmuyordu.
Onceki bir duzenlemede dusmus. → Skor tabelasina eklendi.

**2. VS rozeti ORTAK sayaci gosteriyordu**
Ben 7. sorumdayken rozet "9/20" yaziyordu (`aktif_soru`, yani en ileri oyuncu).
Asenkronda yaniltici. → Artik **kendi siramizi** gosteriyor.

**3. Rakip ilerlemesi hep 0 cikiyordu**
`ilerleme` state'i `match_answers`'tan okunuyordu ama o tablonun RLS'i yalniz
**kendi cevaplarini** gosteriyor (canli testte dogrulandi: 6 satirin hepsi
bana ait). → Sayaclar artik `matches.oyuncu1_soru/oyuncu2_soru`'dan aliniyor;
hem okunabilir hem kesin.

**4. Asenkron bilgi karti oyunu bozuyordu (KRITIK kullanilabilirlik)**
Kart, rakip HER hamle yaptiginda yeniden beliriyor/guncelleniyor ve soru
ekranini asagi itiyordu. Sikka tiklarken duzen kaydigi icin **tiklama bosa
gitti ve soru kacirildi** (canli testte bizzat yasandi). → Kart artik yalniz
maca ILK giriste, henuz hic oynamamisken bir kez gosteriliyor; metni sabit.

**5. "Yarim kalan macin var" seridi alti ciziliydi**
Ortak `<a>` stilinin muafiyet listesinde degildi. → `.bd-devam-eden` eklendi.

**6. Bes bot ucu ayni zorlukta gorunuyordu**
Esikler uc seviyeliydi (Kolay/Orta/Zor), bes bot ucune sikisiyordu.
→ Bes seviye: Cok kolay · Kolay · Orta · Zor · Cok zor.

### Yayina hazir mi?
Oyun akisi tarafinda bilinen acik kalmadi. Kalan tek engel **kod disinda**:
imza anahtari SHA-256'sinin `assetlinks.json`'a yazilmasi, `VITE_H5_ADS_CLIENT`
ve Play Console urun kimlikleri (`store/ANDROID_YAYIN.md`).

---

## 9 Eylul 2026 — Genel kultur kategorisi kalite revizyonu

**Sikayet (canli test):** "genel kultur kisminda asiri basit, kultur olmayan
sorular var."

**Dogrulama:** 1.354 aktif `genel_kultur` sorusu tarandi; ortalama uzunluk 40
karakter, en kisasi 12. Ornekler: "Bir hafta kac gundur?", "At yavrusuna ne
denir?", "Istanbul'un plaka kodu kactir?", "Batman hangi sehri korur?".

**Yapilan:**
- Kalip taramasiyla 78 asiri basit soru bulundu ve **pasife alindi** (silinmedi
  — gecmis mac kayitlari `questions` satirina bagli).
  - `20260612000074`: 73 soru (birim/sayma, hayvan yavrusu, gundelik esya,
    plaka kodu, temel geometri, temel gida)
  - `20260612000075`: 5 soru (son tarama: ev esyasi ve basit gozlem)
- Yerine **122 orta zorlukta soru** eklendi: tarih, sanat, edebiyat, mitoloji,
  uluslararasi kurumlar, uygarlik mirasi, bilim tarihi, hukuk/ekonomi kavramlari.

**Karar — neden pasif, neden silme degil:** `match_answers` ve turnuva kayitlari
`question_id` uzerinden `questions`'a bagli. Silmek gecmis mac gecmisini bozar;
`aktif = false` soruyu havuzdan cikarir ama kaydi korur (057'deki uygulamayla ayni).

**Cikarim — soru uretiminde tekrar riski:** ilk turda uretilen 185 sorunun 63'u
mevcut havuzla ortusuyordu. Yeni parti uretirken **once havuzu tazele**
(`cek.mjs`) ve hem birebir metin hem anahtar kelime ortusme suzgecinden gecir;
sadece `on conflict (soru) do nothing`'e guvenmek yetmiyor cunku ayni soru farkli
kelimelerle yeniden yazilinca catisma tetiklenmiyor.

**Sonuc:** `genel_kultur` aktif 1.354 → 1.398; tum havuz 5.193 → 5.237.
Dogru sik dagilimi dengeli (350/349/351/353).

---

## 9 Eylul 2026 (2. oturum) — Soru havuzu buyuk genisletme

**Istek:** "butun sorular bini gecsin, cografya iki bine ciksin, hepsi kaliteli
ve dogrulugu onaylanmis olsun."

### Kurulan uretim hatti (`scratchpad/pgi/`)
- `uret.mjs` — tek komutla: canli havuzu tazele → birebir + anahtar kelime
  ortusme suzgeci → dogru sik indeksini kategori icinde dengele → kalite
  denetimi → migration yaz → canliya uygula → `migration repair`.
- `onkontrol.mjs` — uygulamadan once yerel denetim (40+ karakter sik,
  zamana bagli kalip, soru isareti).
- Parti dosyalari `{ s, d, y:[3 celdirici], k:"kategori" }` bicimindedir;
  dogru sik indeksi kod tarafindan dagitilir (sunucu sik karistirmiyor,
  bu yuzden elle "hep 0" yazmak oyunu bozardi).

### Kalite guvencesi
Her parti su suzgeclerden geciyor:
1. **Birebir tekrar** — normalize edilmis metin havuzda var mi.
2. **Anahtar kelime ortusmesi** — %80 kesisim + en az 3 ortak kelime ise elenir
   (ayni soruyu farkli kelimelerle yeniden yazma riskini kapatir; `on conflict`
   tek basina bunu yakalamaz).
3. **Bicim** — 4 benzersiz sik, soru isareti, sik uzunlugu 40 karakter siniri
   (mobil sik butonu tasmasin diye).
4. **Zamana bagli/yoruma acik kalip yasagi** — "gunumuzde", "en iyi", "en unlu",
   "guncel", "nufusu kactir" gibi ifadeler reddedilir.
5. **Dogru sik dagilimi** — kategori icinde 0/1/2/3 esit dagitilir.

### Yapilanlar
- `076`: kalan 10 ilkokul seviyesi soru pasife alindi (renk karisimi, gun/saat,
  gokkusagi rengi) + birebir tekrar eden bir tarih sorusu.
- `077`-`080`, `083`, `087`, `090`, `092`, `094`, `096`: **cografya partileri**
  (Turkiye fiziki cografyasi, jeomorfoloji, iklim, nufus, ekonomi cografyasi,
  ulasim, enerji, cevre, dunya cografyasi, kartografya, meteoroloji, jeoloji,
  denizcilik, kaynak cografyasi).
- `081`, `082`: muzik ve sinema partileri.
- `084`-`086`, `088`, `089`, `091`, `093`, `095`, `097`: **karma partiler**
  (teknoloji, sanat, spor, edebiyat, tarih, bilim, genel kultur, muzik, sinema).

### Cikarim
Ortusme orani parti ilerledikce dusuyor (ilk cografya partisinde 51/185,
onuncuda 3/76) — havuz genisledikce **yeni konu alani acmak** gerekiyor;
ayni konuyu farkli sorularla tekrar yazmak suzgecte eleniyor. Sonraki
partilerde daha ozel alt basliklara inilmeli.

### Oturum sonu durumu (dogrulanmis)
| Kategori | Aktif soru |
|---|---|
| cografya | **2018** |
| genel_kultur | 1450 |
| bilim | 735 |
| tarih | 648 |
| edebiyat | 592 |
| spor | 583 |
| muzik | 567 |
| sanat | 559 |
| teknoloji | 539 |
| sinema | 533 |
| **TOPLAM** | **8224** |

Canli veritabaninda dogrulanan kalite olcumleri:
- Birebir tekrar eden soru: **0**
- 4 sikki olmayan soru: **0**
- Sikları benzersiz olmayan soru: **0**
- Dogru sik araligi disinda kayit: **0**
- Soru isaretiyle bitmeyen soru: **0**
- Dogru sik dagilimi: 2059 / 2100 / 2029 / 2036 (dengeli)
- 40+ karakter sikki olan soru: 26 (tamami eski havuzdan, en uzunu 51 karakter)

**Kalan is:** cografya 2000 hedefi tamamlandi. Diger dokuz kategori icin
"her biri 1000+" hedefine yaklasik 3.900 soru daha gerekiyor; sonraki
oturumda ayni uretim hatti (`scratchpad/pgi/uret.mjs`) ile surdurulmeli.
Ortusme suzgeci nedeniyle yeni partilerde **yeni alt konu alanlari** acmak
sart (ayni konunun farkli anlatimi eleniyor).

## 2026-09-10 — Cok dilli donusum (FAZ 1-3)

**FAZ 1 (bitti, commit 0a5d35e):** migration 20260612000118_cokdilli_sema.sql
- questions: kapsam ('global'|'yerel'), ulke, kaynak_dil kolonlari + check constraint
- question_translations tablosu (question_id, dil, soru, secenekler) + qt_dogrula() tetikleyicisi
  (secenek sayisi/bosluk/tekrar/dogru_cevap indeksi dogrulamasi -> sira korunumu guvencesi)
- profiles.dil + check (tr,en,de,es,pt,fr,it,ru)
- Eski `dil` kolonu kaynak_dil ile trigger uzerinden senkron (eski yazarlar bozulmuyor)

**FAZ 2 (bitti, commit b5a802b):** migration 20260612000119_soru_ayiklama.sql
- 11.982 sorunun tamami 60 partide elle siniflandirildi: 9774 global, 2208 yerel(TR)
- 81 soru "ceviri_bozar" (deyim/atasozu/dil bilgisi) -> aktif, yerel havuzda, asla globale gitmez
- Karar dosyasi: bildim/veri/soru-ayiklama.jsonl (surum kontrolunde, migration bundan uretildi)
- Arac: bildim/_test/ayiklama.mjs (parti | yaz | durum | rapor | ornek)

**FAZ 3 (DEVAM EDIYOR):** bildim/_test/ceviri.mjs
- Hedef: 9381 aktif global soru x 7 dil (en -> de -> es -> pt -> fr -> it -> ru sirasiyla)
- DURUM (2026-09-10): en = 2020/9381 (%21.5). Diger diller 0.
- Yeniden baslatilabilir: imlec dosyasi YOK. Siradaki parti dogrudan sorguyla bulunur
  (kapsam='global' and aktif and o dile cevirisi olmayan). Yarim kalan is otomatik gorunur.
- Akis (20'ser soru):
    node bildim/_test/ceviri.mjs parti en          -> siradaki 20 soru
    <ceviriyi JSON dosyasina yaz>
    node bildim/_test/ceviri.mjs yaz en <dosya>    -> dogrular ve yazar
    node bildim/_test/ceviri.mjs durum             -> dil x cevrilen tablosu
    node bildim/_test/ceviri.mjs ornek en 5        -> ornek ceviriler (kaynakla yan yana)
- Yazma yolu: Supabase CLI YANLIS HESAPTA (idafroditproject@gmail.com), `db push` calismiyor.
  Migration ve toplu yazma pg paketiyle pooler uzerinden yapiliyor
  (.env.local -> SUPABASE_DB_PASSWORD). Bu yol test edildi, 5000 satir 1.3 sn.

**SIRADAKI:** FAZ 3'u en dilinde bitir, sonra de/es/pt/fr/it/ru. Ardindan
FAZ 4 (soru_sec havuz kurali + soru_metni yedek zinciri + tum get_*_question RPC'leri),
FAZ 5 (UI i18n), FAZ 6 (magaza/meta metinleri).

## 2026-09-10 — Kozmetik revizyon ("oyun hissi" paketi, 6 faz)

Oyun mantigina, puanlamaya, RPC'lere ve veritabanina dokunulmadi.
Tek istisna: Faz 6c'de botlarin lig podyumundaki GOSTERIMI (puan/sira ayni).

**FAZ 1 — Cevap geri bildirimi** (6ca58c6)
Cevaptan sonra ~1400 ms'lik pencere (hizli modda 700 ms): dokunusta
scale(0.97)+klik+titresim, 120 ms'de renk (yanlissa DOGRU SIK DA YESIL),
250 ms'de ucan puan, 400 ms'de parilti / "3 UST USTE!", yanlista sarsilma,
sonra soldan kayarak yeni soru.
Ortak parcalar: lib/geriBildirim.js, components/CevapEfekti.jsx.
QuestionCard 1v1/grup/hizli mac/turnuvayi kapsiyor; HizliMod ve Calisma
kendi isaretlemelerinde ayni bileseni kullaniyor.
Sunucu zamanlayicilariyla cakisma kontrol edildi:
- 1v1/grup/turnuva: sonraki sorunun suresi get_*_question CAGRISINDA
  basliyor (oyuncuN_baslangic null'a cekiliyor) -> 1400 ms sureden yemiyor
- hizli mod: sunucu soru_baslangic'i CEVAP aninda kuruyor -> pencere 700 ms,
  sunucudaki 1 sn'lik ag payinin icinde (5000+700 < 6000)

**DUZELTME** (3e029e8) — kapsam disi ama yol uzerinde bulundu:
RakipAra temizlemesinde `supabase.rpc(...).catch()` TypeError atip ekrani
BOMBOS birakiyordu (rpc thenable ama Promise degil). Eslesme ekranindan her
cikista tetikleniyordu.

**FAZ 2 — Ses ve dokunsal** (37aa5cd)
ses.js'e sesKaybettin (alcalan iki nota) ve sesJoker (bant gecirenli beyaz
gurultu swoosh) eklendi. Titresim: dokunma 10, dogru 10, yanlis 30,
kazanma [15,30,15], joker 10 ms. HizliMod'da dogru/yanlis sesi hic
calmiyordu, baglandi. Ses dosyasi yok, hepsi WebAudio.

**FAZ 3 — Tek vurgu rengi** (2f47f21)
Mod ikon kutulari tek notr renge (bes ayri doygun renk kalkti), sik harf
rozetleri notr, ana sayfada altin yalniz "Hemen oyna". KategoriIkon renk
haritasi kategori secim ekrani icin korundu.

**FAZ 4 — Ana sayfa 14 blok -> 3 katman** (1cabfb7)
Katman 1 kimlik + tek eylem, katman 2 "Seni bekleyenler", katman 3 modlar.
Sayfada iki kez duran lig kutusu teke indi (hero'daki uc rozet kaldirildi).

**FAZ 5 — Olcek disiplini** (84646f2)
--bd-b-1..7 (4/8/12/16/24/32/48) tokenlari; 210 bosluk degeri en yakin
basamaga yuvarlandi. Yazi agirligi 500/800'e indi (22 duzeltme).
.bd-secenek min-height 56px + :active scale(0.98).
Yeni SayanSayi bileseni (300 ms, rAF, easeOutCubic): mac skoru, profil
puani, lig listesi ve podyum puanlari.
Yan fayda: --bd-bosluk-2/-3 hic tanimli degildi, gap bosa dusuyordu.

**FAZ 6 — Rakip gerilimi ve bos durumlar** (d37216e)
Ust tabelada onde olan buyuk+kenarlikli, geride olan sonuk; rakip cevap
verince avatarinda nabiz; son 3 soruda tabela kenarligi altin.
Tepki emojileri SVG ikona cevrildi (sunucuya giden metin AYNI kaldi).
Profilde "0 sampiyonluk" yerine hedef metni; lig podyumundaki botlar robot
rozeti + sonuk renkle ayrisiyor (puan/sira degismedi).

Tum fazlarda prefers-reduced-motion: reduce gozetildi (animasyon kapali,
renk geri bildirimi korunuyor). Yeni bagimlilik eklenmedi.
`npm run build` ve `npm run build:bildim` her fazda hatasiz gecti.

---

## 2026-09-10 — Asiri basit (ilkokul duzeyi) sorularin ayiklanmasi

**Sorun (kullanici bildirdi):** "sorular asiri basit, ilkokul sorusu dolu
oyun." Havuzun tamami (8.765 aktif soru) elle okundu ve degerlendirildi.

**Sonuc:** 2.657 soru `aktif = false` yapildi. Aktif havuz 11.422 -> 8.765.
Global 7.031, yerel 1.734 aktif soru kaldi.

**Neden elle:** kalip/regex denendi ve guvenilmez cikti. Genis sinyaller
686 aday uretti ve icinde tamamen mesru sorular vardi ("Frekans birimi
nedir?", "Fotosentez hangi organelde gerceklesir?"); dar kaliplar 15
adayda kaldi, onlarda da yanlis eslesme oldu ("And **Dagları** kac ulkeden
gecer" icindeki "ari"). Bu yuzden 25 partide her soru okunarak karar
verildi.

**Eleme olcutu (tutarli uygulandi):**
- Yetiskinin dusunmeden bildigi tek adimlik tanimlar
- Cevabi soru metninin icinde gecenler ("Ruzgar turbinine ne denir?")
- Totolojik cevaplar ("Veri merkezleri ne yapar? -> Sunucu barindirir")
- Cok bilinen baskentler/bayraklar, temel sayma sorulari
- **Ikiz sorular:** ayni bilgiyi soran kopyalar (biri birakildi). Bu is
  sirasinda yuzlerce ikiz tespit edildi — asil kirlilik kaynagi buydu.
- Bozuk/belirsiz cevapli sorular ("Kaleci topu en fazla ne kadar tutabilir?
  -> Sinirli bir sure")

**Birakilanlar:** ortaokul duzeyi ayrinti soran, iliski/istisna soran ya da
alan bilgisi gerektiren her sey ("Mitokondri", "Atmosferde en cok bulunan
gaz", "Isik hangi ortamda en hizli ilerler", "Deprem buyuklugunu olcen
alet").

**Guvenlik:** SILME YOK. Sorular `aktif = false` yapildi, satirlar duruyor.
Her parti `bildim/veri/basit-ayiklama-yedek.jsonl` dosyasina eklendi
(surum kontrolunde). `node bildim/_test/basit-ayikla.mjs geri` komutu
tumunu tek seferde geri acar. Projede otomatik DB yedegi olmadigi icin bu
yol secildi.

**Arac:** `bildim/_test/basit-ayikla.mjs`
(`parti [n] [atla] | ele <dosya> | durum | geri`)

**Kok neden zaten kapatilmisti:** `supabase/functions/generate-questions/`
icinde prompt "ZORLUK" bolumuyle sertlestirildi (ilkokul duzeyi genel bilgi
sorma; tanim yerine ayrinti/iliski/istisna sor) ve `kalite.ts` icine sik
uzunluk dengesi kapisi eklendi. Yeni uretilecek sorular bu filtreden gecer.

**Siradaki is:** Ingilizce ceviri (kaldigi yer 2.020 soru). Hedef havuz
elemeyle kucululdu, kalan ~6.700 global soru cevrilecek.

**Not (kapsam disi, ileriye):** eleme sirasinda cok sayida tam kopya soru
gorundu; ikizlerin buyuk kismi bu iste pasife cekildi ama `soru` kolonu
UNIQUE oldugu icin kalanlar farkli metinle ayni bilgiyi soruyor. Ayri bir
temizlik isi olarak degerlendirilebilir.

---

## 2026-09-10 — FAZ 3 TAMAM: Ingilizce ceviri bitti (7.031/7.031)

**Is:** Cok dilli donusumun FAZ 3 adimi olan Ingilizce ceviri ucdan uca
tamamlandi. Oturum basinda 2.020 ceviri vardi; bu oturumda 5.190 soru daha
cevrildi. `question_translations` tablosunda `dil='en'` icin 7.210 satir var
(179 fazlasi elemede pasife cekilen sorulara ait eski cevirilerdir; aktif
global havuzun tamami cevrilidir). `parti en` artik "BITTI" donuyor.

**Yontem:** `bildim/_test/ceviri.mjs` ile 100'luk partiler halinde:
`parti en 100` -> ceviriyi `.tmp/enNN.json` olarak yaz -> `yaz en <dosya>`.
Arac imlecsiz calisir: sirada ne varsa "o dilde cevirisi olmayan aktif
global soru" sorgusuyla bulunur, bu yuzden yarida kesilse de kaldigi yerden
devam eder. Tum partilerde `atlanan=0`; hicbir soru dogrulamaya takilmadi.

**Kritik kural — SIK SIRASI:** `questions.dogru_cevap` `secenekler` dizisine
tamsayi indeks oldugundan cevrilen siklar kaynakla birebir ayni sirada
yazildi. `yaz` komutu her soru icin sik sayisi, bos alan, siklarin birbirinden
farkli olmasi ve soru metninin kaynakla ayni olmamasi kontrollerini yapiyor;
DB tarafinda da `qt_dogrula()` tetikleyicisi ayni bekciligi yapiyor.
`ceviri.mjs ornek en 3` ciktisinda yildizli dogru sik TR ve EN'de ayni
konumda dogrulandi.

**Ceviri uslubu (sonraki diller icin de olcut):**
- Ingiliz imlasi (colour, metre, sulphur, aluminium, -ise ekleri).
- Birebir degil, dogal/idiomatik karsilik. Terimler alan standardiyla
  yazildi (shot list, room tone, base level, key signature, push/pull factor).
- Celdiriciler makul ve kaynakla benzer uzunlukta tutuldu; "yalnizca X"
  tarzi kaynak celdiricileri aynen korundu (dogru cevabi ele vermesin diye
  uzunluk dengesi bozulmadi).
- Ozel adlar Ingilizcede yerlesik bicimiyle: Córdoba, Ferdowsi,
  Al-Khwarizmi, Mussorgsky, Brontë, Çatalhöyük, Göbekli Tepe, Türkiye.

**Ogrenilen (araca dair):** `durum` komutundaki "kalan" sutunu yaniltici —
`hedef - cevrilen` hesapladigi icin pasif sorulara bagli eski cevirileri de
sayiyor ve simdi yuzdeyi %102,5 gosteriyor. Gercek kalan is her zaman `yaz`
ciktisindaki `kalan=` degeri ya da `parti` komutunun bos donmesi.

**Ogrenilen (surece dair):** JSON parti dosyalari **Write araciyla** yazildi;
bash heredoc denemesi Turkce/tirnak icerigi yuzunden basarisiz oldu
(`unexpected EOF while looking for matching`). Sonraki dillerde de ayni yol
izlenmeli.

**Siradaki isler:**
1. Diger diller: de / es / pt / fr / it / ru — hepsi %0. Ayni akis gecerli.
2. FAZ 4-6: ulke havuzu kurali, arayuz i18n, magaza metinleri.
3. Acik kalan: sik dengeleme (6.212'de 502 tamam, `sik-dengele.mjs` hazir)
   ve ikiz soru temizligi (elemede pasife cekilenler disinda kalanlar).

---

## 2026-09-11 — 1v1'de "şıkkı işaretliyorum sıfırlanıyor" hatası düzeltildi

**Şikayet:** "Canlı sohbet bağlanınca oyun takılıyor. Bazen sayfa yenilenir
gibi oluyor. Bazen işaretliyorum sayfa yenileniyor, bir daha işaretliyorum."

**Kök neden — `QuestionCard`'ın key'i yanlış alana bağlıydı.**
`MatchPage`'de kart şöyle çiziliyordu:

```jsx
<QuestionCard key={`${mac.id}-${mac.aktif_soru}`} ... />
```

Ama 1v1 **asenkron**: oyuncular farklı sorularda olabiliyor ve soruyu çeken
effect kendi sayacımıza bakıyor (`oyuncu1_soru` / `oyuncu2_soru`).
`aktif_soru` ise senkron dönemden kalma **ortak** sayaç — iki oyuncudan hangisi
ileriyse onu gösteriyor. Canlı veriden ölçüldü:

| aktif_soru | oyuncu1_soru | oyuncu2_soru | durum |
|---|---|---|---|
| 3 | 1 | **3** | aktif |
| 4 | 3 | **4** | aktif |
| 8 | 7 | **8** | aktif |
| 11 | 10 | **11** | aktif |

Yani **rakip cevap verdiğinde `aktif_soru` artıyordu → key değişiyordu →
React kartı komple yeniden bindiriyordu.** Kartın kendi state'i
(`secim`, `kalan` süre, `sonuc`, 50:50 ile elenenler) sıfırlanıyordu: oyuncu
şıkkı işaretliyor, rakip bir cevap veriyor, kart baştan çiziliyor ve seçim
uçuyor. "Sayfa yenilendi" hissi süre sayacının başa dönmesinden.

**Neden özellikle sesli sohbette:** asenkron maçta iki taraf normalde farklı
zamanlarda oynuyor, çakışma nadir. Sesli sohbet açıkken **aynı anda**
oynuyorlar — rakibin her cevabı anında realtime ile geliyor ve kart sürekli
yeniden biniyor.

**Düzeltme:** key kendi indekse bağlandı — soruyu çeken effect ile aynı kaynak:

```jsx
key={`${mac.id}-${kendiIndeks}`}
```

**İkinci düzeltme (takılma):** `macYukle` 2 saniyede bir yoklama yapıyor ve
her seferinde `setMac(yeni nesne)` diyordu; veri değişmese bile React "değişti"
sayıp tüm maç ekranını yeniden çiziyordu. Artık gelen satırın imzası
öncekiyle aynıysa state'e dokunulmuyor (`macImzaRef`). Sesli sohbetin WebRTC
yükü üstüne binen bu gereksiz çizim, hissedilen takılmanın ikinci kaynağıydı.

**Dokunulmayanlar:** `GroupMatchPage` ve `HizliMacPage` aynı key desenini
kullanıyor ama onlar **gerçekten senkron** (tabloda kişi bazlı sayaç yok,
soru çekme de `aktif_soru`'ya bağlı) — orada key doğru, değiştirilmedi.

---

## 2026-09-11 — Hızlı Mod: 5 saniyeye sığmayan sorular elendi

**İstek:** "5 sn modunda sorular belirli bir kısalıkta olmalı ki süre yetsin."

**Durum tespiti:** Öyle tasarlanmamıştı. Hızlı Mod soru başına 5 sn veriyor
(60 sn / en çok 12 soru) ama soruları genel havuzdan `soru_sec` ile çekiyordu
ve orada **hiçbir uzunluk ölçütü yoktu**. Aktif havuzda ölçüldü:

| | değer |
|---|---|
| soru metni | ort. 41 · ortanca 40 · p90 56 · en uzun 90 karakter |
| şıklar toplamı | ort. 50 · p90 79 · en uzun 130 karakter |
| en ağır örnek | 61 + 116 = **177 karakter** — 5 saniyede okunamaz |

**Tasarım — okuma yükü tavanı.** `soru_sec`'e isteğe bağlı beşinci parametre
eklendi: `p_max_okuma` = soru metni + şıkların toplam karakter sayısı.
Varsayılanı `null`, yani **parametreyi vermeyen bütün modlar birebir eskisi
gibi çalışır**. Yalnız `hizli_mod_baslat` tavanı kullanıyor: **110 karakter**.

**110 neden:** havuzun %81'i (7.060 soru) altında kalıyor ve her kategoride en
az 552 uygun soru var — bir oturum 25 soru çekiyor, hiçbir kategoride sıkışma
yok. 90 tavanı havuzu yarıya düşürüyordu; 130 ise 5 saniyeye sığmayanları geri
alıyordu.

**Geri düşüş sırası** (oyuncu hata ekranı görmesin diye): önce **tavan** kalkar
— oyuncunun seçtiği kategori uzunluk tercihinden değerlidir —, sonra kategori,
en son dil. Canlıda doğrulandı: imkânsız bir tavan (20 karakter) verildiğinde
bile 25 soru dönüyor.

**Migration:** `20260612000123_hizli_mod_kisa_soru.sql` (canlıya uygulandı).
`soru_sec`'in eski 4 parametreli imzası düşürüldü ki iki ayrı fonksiyon
(overload) kalmasın; yeni parametrenin varsayılanı `null` olduğu için mevcut
4 argümanlı çağrıların hepsi çalışmaya devam ediyor.

**Canlı ölçüm (uygulama sonrası):**

| çağrı | sonuç |
|---|---|
| Hızlı Mod, karışık | 25 soru · en ağır **108** · ortalama 89 |
| Hızlı Mod, coğrafya | 25 soru · en ağır **110** · ortalama 82 |
| Hızlı Mod, teknoloji | 25 soru · en ağır **110** · ortalama 95 |
| 1v1 (4 parametreli eski çağrı) | 20 soru · en ağır **145** — *değişmemiş, doğru* |

**Uçtan uca test:** quizador.vercel.app'te misafir hesapla Hızlı Mod oynandı;
gelen ilk soru "'Baharat Yolu' hangi ürünlerin ticaretini sağlardı?" +
tek kelimelik şıklar (~85 karakter) — 5 saniyede rahat okunuyor.

**Not (ileriye):** bu bir *seçim* filtresidir; soru üretimi (Edge Function)
tarafına dokunulmadı. Havuzun %81'i uygun olduğu için şu an sorun yok, ama
üretilen sorular zamanla uzarsa hızlı mod havuzu daralır. Gerekirse
`generate-questions` prompt'una "kısa soru" hedefi eklenebilir.

---

## 11 Eylül 2026 — Sekmeden dönünce maç ekranının donması

**Sorun:** Maç sürerken başka sekmeye/ekrana geçip dönünce oyun donuyordu:
sayaç ilerlemiyor, soru değişmiyor, rakip skoru güncellenmiyordu.

**Kök neden:** Projede hiç `visibilitychange` dinleyicisi yoktu. Sekme arka
plana geçince tarayıcı `setInterval`'leri donduruyor/kısıyor (soru sayacı
100 ms, maç yoklamaları 2–2.5 sn) ve Supabase Realtime WebSocket'ini koparıyor;
dönüldüğünde sayaç eksi değerde takılı, kanal ölü kalıyordu.

**Karar:** Soru atlanabilir — oyuncu dönünce sıradaki sorudan devam eder.
Sunucu tarafı zaten buna uygun olduğu için **DB/RPC'ye dokunulmadı**; düzeltme
tamamen istemcide.

**Yapılanlar:**
- Yeni `bildim/lib/gorunurluk.js` → `useGorunurlukTazele(fn, aktif)` hook'u.
  `visibilitychange` + `focus` dinler, sekme görünür olunca `fn()` çağırır.
- `components/QuestionCard.jsx`: sayaç `tik`'i `tikRef`'e yazıldı; dönüşte elle
  çağrılıyor. Süresi dolmuşsa zaman aşımı akışı (doğru cevabı göster + atla)
  bir kez tetikleniyor — `sureDolduMu` kilidi mükerrer tetiklemeyi engelliyor.
- `MatchPage` / `GroupMatchPage` / `HizliMacPage` / `TournamentPage`: kanal
  kurulumu `kanalKur()` fonksiyonuna çıkarıldı, kanal `kanalRef`'te tutuluyor.
  Dönüşte yükleme fonksiyonu bir kez çağrılıp kanal yeniden kuruluyor.
- `HizliModPage`: Realtime yok; dönüşte soru sayacı gerçek zamana göre
  senkronlanıyor.
- Grup/hızlı/turnuvada soru saati ortak (`soru_baslangic`) olduğu için istemci
  ekstra atlama tetiklemiyor; sunucudaki güncel `aktif_soru` neyse oradan devam.

**Bilinen sınır (ileriye):** `HizliModPage`'de toplam 60 sn'lik sayaç gerçek
zamandan değil, tik başına `-0.1` ile azalıyor. Sekme arka plandayken bu sayaç
da donuyor, yani oyuncu 60 sn'den fazla oynamış olabilir. Takılmaya yol açmadığı
ve oyun mantığını değiştireceği için bu turda dokunulmadı; gerekirse oturum
başlangıç zaman damgası eklenerek düzeltilebilir.

**Doğrulama:** `npm run build` hatasız. Dev sunucusunda `/bildim` açıldı,
konsolda hata yok. Maç içi sekme testi kullanıcı tarafından yapılacak.

---

## 11 Eylül 2026 — Soru havuzu genişletme: +472 global soru (TR + EN)

**Amaç:** Her kategoriye kaliteli yeni soru eklemek. Kapsam kararı: **global**
(her ülkedeki oyuncuya sorulabilir) + İngilizce çevirisi aynı migration'da.
Dağılım "zayıf kategoriye ağırlık" ilkesiyle yapıldı.

**Eklenen (migration `20260612000124_soru_global_parti_17.sql`):**

| kategori | eklenen | kategori | eklenen |
|---|---|---|---|
| spor | 65 | sinema | 44 |
| sanat | 59 | genel_kultur | 42 |
| edebiyat | 52 | tarih | 40 |
| bilim | 51 | cografya | 23 |
| muzik | 51 | **toplam** | **472** |
| teknoloji | 45 | | |

Canlı havuz: 8.765 → **9.237 aktif soru**. Global soruların EN çeviri eksiği: **0**.

**Süreç — her soru üç kapıdan geçti:**
1. `generate-questions/kalite.ts` içindeki `nedenGecersiz()` (mevcut üretim
   süzgeci) — **hem Türkçesine hem İngilizce çevirisine** uygulandı.
2. Mükerrer denetimi: canlı havuzdaki 11.982 sorunun ve 7.210 EN çevirisinin
   tamamına karşı normalize edilmiş metin karşılaştırması.
3. Doğru şık konum dengesi (aşağıda).

Araçlar `.tmp/` altında: `soru-denetim.mjs` (denetim + ayıklama),
`kurtar.mjs` (yalnız uzunluk dengesi yüzünden elenenleri teşhisle listeler),
`dengele.mjs` (şık konumu dengeleme), `migration-uret.mjs`.

**Öğrenilenler / kararlar:**

- **En sık elenme nedeni "doğru şık diğerlerinden belirgin uzun" oldu.** İlk
  sinema partisinde 68 sorudan 37'si buna takıldı. Bunlar *atılacak* değil
  *düzeltilecek* hatalar: çeldiricileri uzatınca 20/20 geçti. Bu yüzden
  `kurtar.mjs` yazıldı. Kural olarak benimsendi: **doğru şık, yanlış şıkların
  ortalamasından en fazla 3 karakter uzun olsun** (en güvenlisi: doğru cevap
  kısa, çeldiriciler uzun; ya da hepsi eşit uzunlukta / sayı).
- **Doğru şık konumu ciddi bir açıktı.** İlk taslakta müzik kategorisinde
  doğru cevabın **%70'i B şıkkındaydı** — "hep B'yi seç" stratejisi oyunu
  bilgisiz kazandırırdı. `dengele.mjs` şık sırasını (TR ve EN birlikte)
  takas ederek her kategoride 0/1/2/3 dağılımını eşitliyor. Yeni partilerde
  bu adım **atlanmamalı**.
- **Mevcut havuz kavram/tanım ağırlıklı** ("X nedir?"). Bu parti olgusal ve
  zamansız sorulara (tarih, isim, sayı, kural) ağırlık verdi — hem tamamlayıcı
  oldu hem mükerrer riski düştü.
- **EN mükerrer, TR mükerrerden daha sık çıktı.** Türkçesi farklı iki soru aynı
  İngilizce cümleye çevrilebiliyor; özellikle edebiyatta "Who wrote the novel
  'X'?" kalıbı doyduğu için 59 sorudan 23'ü buna takıldı. Çözüm: İngilizce
  soru kalıbını da çeşitlendirmek ("Which writer is behind…", "…is a play by
  which writer?").
- **Negatif sayılar şık olarak kullanılmamalı:** `normalize()` tireyi sildiği
  için `["0","5","-5","10"]` şıklarında `-5` ile `5` aynı sayılıyor ve soru
  "şıklar birbirinin aynısı" diye eleniyor.
- Son elemede 6 soru daha çıkarıldı: 2 olumsuz kalıp (`olmayan` — mevcut
  `OLUMSUZ` regex'i bu eki yakalamıyor) ve 4 tartışmalı/değişken eşikli soru
  (uzun metraj süresi, saha hakem sayısı vb.).

**İleriye not:** `OLUMSUZ` regex'ine `olmayan` eklenebilir; şu an bu kalıptaki
sorular kapıdan geçiyor.

**Doğrulama:** Migration canlıya uygulandı (472 soru + 472 çeviri), denetim
scripti 472 soruda **0 hata** ve tüm kategorilerde dengeli dağılım raporladı.
Ayrıca geçmişe kaydı unutulmuş `20260612000123` de `schema_migrations`'a
eklendi (uygulanmıştı ama kayıtlı değildi; `db push` onu tekrar çalıştıracaktı).

---

## 11 Eylül 2026 (2) — Süre dolunca donma: asıl kök neden ve tam tarama

**Şikâyet:** "Süre dolunca sayfa takıldı." Sabahki görünürlük düzeltmesi
(oturum 1) yetmemiş.

**ASIL KÖK NEDEN — iki kilit birden kapalı kalıyordu.** Sabahki düzeltme
sekmeden dönüşte veriyi tazeliyordu ama kilitlere dokunmuyordu:

1. `QuestionCard.sureDolduMu` — süre dolunca `true` olup `clearInterval`
   çağırıyordu. Yalnız soru **değişince** sıfırlanıyordu.
2. `MatchPage.advanceKilidi` (ve grup/hızlı/turnuva eşleri) — aynı şekilde.

Donma zinciri (telefonda arka plan):
- Arka planda süre doluyor → iki kilit de kapanıyor, interval durduruluyor
- Atlama RPC'si gidiyor ama soket kopuk → **ne çözülüyor ne reddediliyor**
  (Supabase isteği askıda kalıyor) ya da hata dönüyor
- Hata yolundaki `.catch()` **boştu** → kilitler kapalı kalıyor
- Oyuncu dönüyor: veri tazeleniyor ama sunucuda soru atlanmadığı için **aynı
  soru** geliyor; soru değişmediğinden kilitler sıfırlanmıyor; interval de
  durdurulmuştu → **ekran sonsuza kadar donuk**

**Yapılan düzeltmeler:**

- `lib/gorunurluk.js`:
  - `useGorunurlukTazele` artık **üç** olay dinliyor: `visibilitychange`,
    `focus`, **`pageshow`**. iOS Safari bfcache'ten dönerken çoğu zaman yalnız
    `pageshow` üretiyor — tek olay dinlemek mobilde yetmiyordu. Üçü aynı anda
    tetiklenebildiği için 250 ms'lik tekleme eklendi.
  - Yeni `zamanAsimiyla(soz, ms, etiket)`: askıda kalan RPC'yi reddeder.
    Askıda kalan istek, çağıran tarafı süresiz kilitli bıraktığı için donmanın
    doğrudan sebebiydi.
- `components/QuestionCard.jsx`:
  - Atlama başarısız olursa `sureDolduMu` **geri açılıyor** + 1,5 sn bekleme
    (`YENIDEN_DENE_MS`) konuyor ki 100 ms'lik tik ağı istek yağmuruna tutmasın.
  - `clearInterval` kaldırıldı ve interval **koşulsuz** kuruluyor. Eskiden
    "süre dolmadıysa" koşuluna bağlıydı: süresi geçmiş soru gelirse interval
    hiç kurulmuyor, yeniden deneyecek tik kalmıyordu.
- `MatchPage` / `GroupMatchPage` / `HizliMacPage` / `TournamentPage`:
  - İlerletme RPC'leri `zamanAsimiyla` ile 10 sn'ye bağlandı.
  - Başarısızlıkta `advanceKilidi` **açılıyor**; `MatchPage.sureDoldu` hatayı
    yeniden fırlatıyor ki QuestionCard da kendi kilidini açsın.
  - `bekleyenIlerletme` bayrağı: süre dolunca konur, ilerletme başarılı olunca
    kalkar. `setTimeout` arka planda donduğu için sekmeden dönüşte bekleyen iş
    **gecikmeyi beklemeden** çalıştırılır.
  - Grup/hızlı sayfalarındaki `ilerletmeyiDene`'nin **`.catch()`'i bile yoktu**.
  - `.subscribe()` dönüşü artık denetleniyor: `CHANNEL_ERROR`/`TIMED_OUT`/
    `CLOSED` gelirse 2 sn sonra kanal yeniden kuruluyor. (patirun ve driftgp
    bunu zaten yapıyordu, bildim yapmıyordu.)
- `CalismaPage`: sayaç `Date.now()` tabanlı olduğu için kendiliğinden
  toparlanıyordu ama dönüşte ilk tiki bekliyordu; tazeleme eklendi.

**Diğer modüllerin taraması (hepsi kontrol edildi):**

| modül | delta clamp | görünürlük | realtime kopması |
|---|---|---|---|
| bildim | zamanlayıcı tabanlı | ✓ (bu oturumda) | ✓ (bu oturumda) |
| kafatopu | ✓ 250 ms | ✓ + 200 ms kalp atışı yedeği | — |
| patirun | ✓ 0,05 sn | ✗ yok | ✓ zaten var |
| driftgp | ✓ 1/20 sn (`stepCar`) | ✗ yok | ✓ zaten var |
| meyvekes | ✓ 0,05 sn | ✓ var | yok (tek oyunculu) |
| boks | ✓ 0,1 sn | ✓ var | yok |
| run | ✓ `MAKS_DT` | ✓ var | yok |
| gladius | ✓ `MAKS_DT` | ✗ (DEMO) | yok |

**Sonuç:** oyun motorlarının tamamında delta sınırı zaten vardı — arka plandan
dönüşte fizik patlaması riski yok. Donma yalnız bildim'in maç akışındaydı.

**Kalan bilinen açık (düzeltilmedi, kullanıcı kararı bekliyor):** patirun ve
driftgp'de arka planda geçen süre yarışta "kayıp" sayılıyor; oyuncu geri
dönünce yarış kaldığı yerden sürüyor ama arkada kalmış oluyor. Multiplayer
adaleti açısından sorun, ama donma değil ve düzeltmesi yarış motoruna dokunmayı
gerektiriyor.

**Doğrulama:** `npm run build` hatasız; donma senaryosu izole testle doğrulandı
(eski kod donuyor, yeni kod dönüşte ilerliyor); `zamanAsimiyla` tarayıcıda
sınandı (askıda kalan söz reddedildi, normal söz çözüldü); üç-olay tekleme
tarayıcıda doğrulandı (üç olay → tek tazeleme, 300 ms sonra yeni dönüş → yeni
tazeleme); sayfa konsolunda hata yok.

---

## 11 Eylül 2026 (3) — Görsel revizyon: "Şenlik" tasarım dili

Onaylanmış referans: `QUIZADOR_TASARIM_REFERANS.html` (repo kökünde, 8 ekran).
**Yalnız görsel revizyon** — oyun mantığı, RPC, migration, puanlama değişmedi;
yeni ekran/özellik/para birimi eklenmedi.

**Dört kural:** açık gökyüzü zemini · beyaz kart + 4px alt kalınlık ·
kabartmalı buton (basınca 4px iner) · Baloo 2 başlık / Nunito gövde.

**Yöntem — neden "en sona tek katman":** `tema.css` yıllar içinde faz faz
büyümüş (3.400+ satır), aynı sınıf birkaç yerde tanımlı. Eski kuralları tek tek
bulup düzenlemek yerine revizyonun tamamı dosyanın **sonuna** yazıldı: kaskadın
sonunda olduğu için önceki katmanları eziyor, hiçbir eski kural silinmedi
(geri alınabilir). Token **adları** korundu, yalnız **değerleri** değişti —
böylece yüzlerce bileşen tek yerden dönüştü.

**Değişen dosyalar:**
- `bildim/styles/tema.css` — iki `:root` bloğu yeni palete; body/html zemini;
  FAZ 2-8 katmanları + koyu tema kalıntı temizliği
- `src/styles.css` — hub token'ları (`--bg/--card/--text/--primary`), `.btn`,
  `.kart`, body zemini, hub kartı gölgeleri
- `index.html` — Nunito eklendi, `theme-color` açık maviye
- `public/manifest.webmanifest`, `public/bildim.webmanifest`, `lib/manifest.js`
  — PWA renkleri
- `bildim/components/Layout.jsx` — **tek JSX değişikliği**: sekme dizilimi
  referansa getirildi (Ana Sayfa / Arkadaşlar / Lig / Dükkân / Profil).
  Turnuva ve Meydan Oku sekmeden çıktı — ikisi de ana ekrandaki modlar
  ızgarasında zaten duruyor, sekmede ikinci kez yer kaplıyordu. Yeni rota
  açılmadı. Bekleyen sayacı sayı yerine kırmızı nokta oldu.

**Yol boyunca çıkan üç tuzak:**
1. **İkinci `:root` bloğu (satır ~1307).** Baştaki bloğu çevirdim ama butonlar
   altın kaldı: aynı dosyada ikinci bir `:root` `--bd-vurgu`'yu yeniden
   tanımlıyordu. İkisi de çevrildi; biri unutulursa buton eski renge döner.
2. **Ters gradyan.** İkinci bir `body` kuralı (~satır 1333) kremi ÜSTE, maviyi
   ALTA koyuyordu. Ayrıca `html { background-color:#0B1220; color-scheme:dark }`
   kuralı gradyanın arkasında koyu bir zemin bırakıyordu (overscroll'da
   görünür) — ikisi de düzeltildi, `color-scheme` artık `light`.
3. **Görünmez butonlar.** 12 sınıf zeminini "beyaz, %10-20 saydam" kuruyordu:
   koyu zeminde kabartma veriyordu, açık zeminde tamamen kayboluyordu
   (ses düğmeleri, maç çıkış, modal butonları). Hepsi token'a çevrildi.

**Erişilebilirlik — ölçüldü, ikisi düzeltildi, biri bilinçli bırakıldı:**
- `--bd-metin-3` #9AB0C4 → **#6E86A0** (beyazda 2,24:1 idi)
- Tabbar pasif sekme #9AB0C4 → **#5C7590** (10,5 px etiket, 2,24:1 idi)
- **Bırakılan:** turuncu butonda beyaz yazı **2,92:1**, yeşilde **2,38:1**.
  Referansın kimliği bu; `text-shadow: 0 2px 0 rgba(0,0,0,.22)` okunabilirliği
  taşıyor ve oyun arayüzlerinde yaygın. 4,5:1'e çıkarmak turuncuyu koyu kahveye
  çevirir, tasarım bozulur. **Karar sahibinde** — istenirse buton rengi
  koyulaştırılabilir.
- Ana metin beyaz kartta 12,99:1, ikincil 5,10:1, kategori çipi 6,09:1 ✓
- `prefers-reduced-motion: reduce` altında tüm geçiş/animasyonlar kapalı ✓

**Doğrulama:** Her fazdan sonra `npm run build` (hepsi hatasız). Giriş ekranı
gerçek uygulamada görüldü. Oturum açılamadığı için (misafir girişi Supabase'de
kapalı) diğer 7 ekran, **uygulamanın derlenmiş gerçek CSS'i + gerçek sınıf
adlarıyla** kurulan bir önizleme sayfasında doğrulandı (`.tmp/onizleme/`):
ana ekran, maç, cevap anı, maç sonu, lig, dükkân, arkadaşlar, tabbar — hepsi
referansla eşleşti. Konsolda hata yok, 390 px'de yatay kaydırma yok,
Baloo 2 + Nunito yükleniyor.

**Yapılmadı (bilerek):** "Rakip bekleniyor" ekranı (referans 3) — ayrı görev.

---

## 11 Eylül 2026 (4) — Koyu tema kalıntıları: 9 bildirilen + 11 taramadan

Şenlik revizyonundan sonra canlıda 9 alan koyu kalmıştı. Sebep tek: bu sınıflar
zeminini **token'dan değil sabit koyu renkten** alıyordu
(`rgba(11,18,32,…)`, `rgba(24,35,59,…)`, `rgba(0,0,0,…)`), bu yüzden palet
değişiminden hiç etkilenmediler.

**Düzeltilen 9 (bildirilen):** `.bd-ust-blok` (+`.topbar`, ses/zil düğmeleri) ·
`.bd-seri` (ısı varyantları turuncu yoğunluğuna çevrildi) · `.bd-gorev-basi` ·
`.bd-sekme-ust`/`.bd-sekme-alt` · `.bd-istatistik`/`.bd-istatistik-hedef` ·
`.bd-panel-basi` · `.gs-kutu` · `.bd-rutbe-chip` · `.bd-calisma-adet-btn.aktif`

**Taramada çıkan 11 ek kalıntı:** `.rutbe-kutlama`, `.bd-arama-katman`,
`.bd-tanitim-katman`, `.bd-turnuva-bant`, `.bd-lig-tek-satir`,
`.bd-bekleyen-kurulum`, `.bd-gelen-davetler`, `.bd-ust-blok:has(.bd-toast-kat)`,
`.sr-tablo thead th`, `.anasayfa .bd-mod.btn`, `.bd-zil-liste`.
Tam ekran katmanlar sayfa gradyanını aldı, kart/şerit/tablo beyaz + alt kalınlık.

**Öğrenilen — `.app` öneki portal'lara ULAŞMAZ:**
`RakipAra`, `Modal` ve `BildirimZili` `createPortal(…, document.body)` ile
render ediliyor, yani `.app` sarmalayıcısının **dışında**. Bu üçünün kuralları
`.app` önekiyle yazıldığında hiç tutmuyor ve katman koyu kalıyor — ilk denemede
tam da bu oldu (`.app .bd-arama-katman` yazmıştım, ekran siyah kaldı).
Portal'a giden sınıflar **öneksiz** yazılmalı: `.bd-arama-katman`,
`.bd-tanitim-katman`, `.bd-modal-katman`, `.bd-modal`, `.bd-zil-liste`,
`.rutbe-kutlama`. Yeni bir tam ekran katman eklenirse aynı tuzak geçerli.

**Rütbe çipi:** eskiden rütbe renginin %8 tint'iydi, açık zeminde görünmüyordu.
Rütbe rengi (`--rutbe`) korundu; zemin %18 tint, metin aynı renkten %45
karışımla koyulaştırıldı. Oran veriden seçildi: %50'de Efsane 4,40 ile AA'nın
altında kalıyordu, %45'te en düşük **4,95:1**. Canlı ölçüm: Çaylak 5,98 ·
Bilge 5,40 · Üstat 5,89 · Kahin 5,82 · Efsane 4,95 — beşi de geçiyor.

**Doğrulama:** `npm run build` hatasız. Statik kaskad taraması (derlenmiş CSS'te
her seçicinin SON background'ı) → **0 koyu kalıntı**. Düzeltilen 20 bileşen,
uygulamanın derlenmiş gerçek CSS'i + gerçek sınıf adlarıyla kurulan sayfada
görsel olarak doğrulandı. Konsol testi → **boş dizi**. Konsolda hata yok,
gerçek 390 px viewport'ta (iframe) yatay kaydırma yok.

**Not — verilen konsol testinde yanlış pozitif:** test `backgroundColor`'ı hep
0-255 varsayıp 255'e bölüyor; `color-mix()` sonucu ise `color(srgb 0.91 0.92 0.94)`
biçiminde **0-1** aralığında dönüyor. Bu yüzden rütbe çipleri "koyu" diye
işaretlendi ama gerçekte açıklar. Testin `color(` ile başlayan değerleri 255 ile
çarpan sürümü kullanıldı.

---

## 11 Eylül 2026 (5) — Quizador Meydanı: 3B çok oyunculu buluşma alanı

Yeni bölüm **Harita** (`bildim/harita/`, rehber: o klasördeki `CLAUDE.md`).
Referans `QUIZADOR_MEYDAN_REFERANS.html` sahnesi düz three.js ile birebir
taşındı; görev `QUIZADOR_MEYDAN_GOREV.md` FAZ 1-7 tek seferde yapıldı.
**Veritabanı değişikliği yok; migration/RPC yok; mevcut ekranlar değişmedi.**

**Eklenen:** `HaritaSayfasi.jsx`, `dunya.js`, `kontrol.js`, `coklu.js`,
`renk.js`, `harita.css`. Değişen: `Layout.jsx` (Harita sekmesi), `App.jsx` +
`BildimApp.jsx` (birer lazy route satırı), `tema.css` (6/7 sekme daraltması).

**Chunk:** `HaritaSayfasi` 22,2 kB (gzip 8,8) + `harita.css` 4,6 kB;
`three.module` 733,7 kB (gzip 189,8) ayrı chunk, yalnız lazy rotalarda iniyor
(driftgp ile ortak). İlk açılış paketlerinde `WebGLRenderer` yok — doğrulandı.

**Doğrulama (dev sunucu + tarayıcı):**
- Gerçek uygulamada misafir girişiyle: Harita'ya girmeden three/harita chunk'ı
  yüklenmedi; `/bildim/harita`'da canvas + HUD, sekme çubuğu gizli, "2 kişi
  burada" (gerçek anonim kullanıcı, test sekmesindeki oyuncuyu gördü), konsol temiz.
- İki sekme iki oyuncu (`.tmp/harita-test`): presence iki yönde (2 kişi →
  3 kişi), konum iki yönde alındı ve uzak avatar hedefe lerp ile yakınsadı
  (B→A `(0, 6,6)` — havuz sınırında durdu, çarpışma doğru; A→B `(7,74, 10,11)`),
  emoji karşı tarafta göründü.
- Çıkıp-girme: canvas 1→0→1, sahne nesnesi 166→166, uzak 1→1 — çoğalma yok.
- Gizli sekmeden konum yayını gitmiyor (kural çalışıyor).
- 390 px: HUD taşmıyor (topuz sağ alt, emojiler sol alt, hap sağ üst); sekme
  çubuğu hub derlemesinde 7 sekme × 55 px, etiket taşması yok.
- Düşük donanım (`?dusuk=1`): gölge kapalı, 30 nesne eksik (13 ağaç + 17 çalı).
- **Kare maliyeti:** 3,6 ms/kare (16 çekirdekli masaüstü) ≈ 277 FPS tavanı.
  Orta seviye Android **ölçülmedi** — sahibi telefonda denemeli.

**Yol boyunca çıkan üç şey:**
1. **three r128 → 0.185 ışık farkı:** yeni sürümde ışıklar fiziksel birim;
   referans yoğunlukları `π` ile çarpılmasa sahne karanlık çıkıyordu.
2. **Gerçek hata (bulunup düzeltildi):** `coklu.js`'te "ilk paket hemen gitsin"
   diye `sonPoz` NaN tutuluyordu; `Math.abs(x - NaN) > 0.01` her zaman false →
   **hiç konum paketi gitmiyordu.** Testte presence/emoji geçip konum
   geçmeyince yakalandı; `Number.isFinite` kontrolü eklendi.
3. **Otomasyon sekmesi hep "gizli":** Chrome RAF'ı durdurdu, sayfa "hazırlanıyor"
   perdesinde kaldı. Test sayfasına `__test.tick(dt, n)` kancası eklendi;
   ürün davranışı (gizliyken render/yayın yok) doğru ve korundu.

**Not:** test sırasında 3 anonim (misafir) hesap açıldı (`test_a/b/c`);
istenirse Supabase Auth panelinden silinebilir. Ayrıca önceki oturumda
"misafir girişi Supabase'de kapalı" sanılmıştı — değilmiş; `signInAnonymously`
çalışıyor, o gün butona ref ile tıklama React'e ulaşmamıştı.

**Push edilmedi** (görev metni: "main'e push etme, deploy etme — bitince bildir").

---

## 11 Eylül 2026 (6) — Açık/koyu tema + botlar 4 zorluk seviyesine indi

### ACİL DÜZELTME: maç ekranı canlıda çöküyordu

Tema işi sırasında bulundu. Aynı gün yapılan donma düzeltmesinde
(`9d86474`) `QuestionCard`'a `yenidenDeneRef` eklenmişti ama **tanım satırı
dosyaya hiç girmemişti** — node ile yapılan `replace` satır sonu farkı
yüzünden sessizce tutmamış, ben de doğrularken yalnız *kullanım* satırlarını
grep'leyip tanımı kontrol etmemiştim.

Sonuç: `ReferenceError: yenidenDeneRef is not defined` → soru bileşeni
mount olurken patlıyor, **maç ekranı bomboş açılıyordu**. Canlı paket
incelenerek doğrulandı (minify edilmiş kodda ad korunmuştu — tanımsız global
olduğu için minifier yeniden adlandıramamış). `const yenidenDeneRef = useRef(0)`
eklendi; maç ekranı yeniden çalışıyor, konsol temiz.

**Ders:** üretilen kodu grep'le doğrularken *kullanımı* değil *tanımı* ara;
en iyisi derleyip ekranı gerçekten açmak.

### Açık/koyu tema

- `bildim/lib/tema.js` — üç durum: `cihaz` (varsayılan) / `acik` / `koyu`.
  Tercih `localStorage`, uygulanan tema `<html data-tema>`. Düğmeye dokununca
  seçim kalıcı olur; dokunulmadıysa cihazın gece modu izlenir (canlı değişir).
  `temaBaslat()` React'ten **önce** `main.jsx`'te çağrılır — koyu tema seçen
  oyuncu bir kare beyaz ekran görmesin.
- `bildim/components/TemaDugmesi.jsx` — üst barda ay/güneş (yeni `ay`/`gunes`
  ikonları `Ikon.jsx`'e eklendi).
- `bildim/styles/koyu.css` — `:root[data-tema="koyu"]` altında token'lar +
  token'a bağlanamayan sabitler (pastel mod ikonları, kategori çipi, lig
  "kendi satırın" kremi, kart altı `#CFE0EE` kalınlıkları, modal perdeleri,
  harita HUD). tema.css'ten sonra yüklenir.
- `theme-color` ve `color-scheme` de temayla değişiyor.
- Ölçülen kontrast (koyu): ana metin/kart **12,5:1**, ikincil 7,1:1,
  üçüncül 5,1:1, turuncu vurgu/kart 6,8:1, kategori çipi 7,5:1.
  Üçüncül metin `#9AB0C4` koyuda sönük kaldığı için `#8B9CB5` oldu.
- 3B meydan sahnesi bilerek gündüz kalıyor; yalnız HUD tema değiştiriyor.

### Botlar: 5 dağınık → 4 net seviye

Migration `…125_bot_zorluk_seviyeleri`:

| seviye | ad | isabet | puan |
|---|---|---|---|
| kolay | ToyBot | %42 | 50 |
| orta | ÇaylakBot | %58 | 250 |
| zor | ÜstatBot | %75 | 1110 |
| çok zor | EfsaneBot | %90 | 1450 |

Önce: AcemiBot %45, ÇaylakBot %45, KurtBot %65, BilgeBot %65, UstaBot %85 —
beş bot, üç isabet, "KurtBot" hangi seviye belli değil.

Beşinci bot **silinmedi** (19 maç, 347 cevap, 6 turnuvada geçiyor; silinirse
geçmiş bozulur). Yeni `profiles.bot_aktif` bayrağı false yapıldı; bot seçen üç
RPC'ye (`quick_match`, `turnuva_lobi_botlari`, `bot_join_tournament`) filtre
eklendi.

Migration `…126_emekli_bot_ligden_gizle`: canlı testte lig 3.'sü olarak
"ÇaylakBot (emekli)" göründü — oyuncu iç işleyişi okumasın diye ad "BilgeBot"
yapıldı ve `lig_siralama` emekli botları atlıyor (aktif botlar listede kalır).

**Üç kısıt ardı ardına çıktı, üçü de migration yorumlarına yazıldı:**
1. `gorunen_ad` **üretilmiş (generated)** kolon — `takma_ad`'dan hesaplanıyor,
   doğrudan yazılamıyor.
2. `takma_ad` üzerinde **küçük/büyük harf duyarsız UNIQUE indeks** var
   (`idx_profiles_takma_ad_ci`) — emekli bota eski adı "ÇaylakBot" geri
   verilemedi, o ad artık aktif orta bota ait.
3. `create or replace function` dönüş tipini **ve parametre varsayılanlarını**
   değiştiremiyor — `lig_siralama` imzası birebir korunmak zorundaydı
   (`user_id/gorunen_ad/gorunen_avatar`, `default 'global'/'hafta'`).

**Doğrulama:** build temiz; ana ekran, lig, dükkân, maç ekranı iki temada da
görüldü; tema geçişi anında; lig listesinde emekli bot yok; maç `EfsaneBot`
ile açıldı (aktif bot seçimi doğru); konsolda hata yok.

---

## 2026-09-11 — Dereceli/normal maç ayrımı, seviyeli eşleşme, yatay harita, modal kaydırma

Kullanıcının beş maddelik isteği (`46b3dfe`).

### 1. Dereceli maç ↔ normal maç ayrıldı
Migration `20260612000127_dereceli_mac_ve_seviyeli_eslesme.sql`:
- `matches.dereceli` + `matchmaking_queue.dereceli` (varsayılan `true`, eski
  satırlar dereceli sayılır).
- `kuyruga_gir` / `quick_match` artık `p_dereceli` alıyor ve **yalnız aynı
  türdeki** rakiplerle eşleştiriyor; dereceli oyuncu normal kuyruğa düşmüyor.
- `mac_sonuclandir`: normal maçta **puan ve galibiyet serisi yazılmıyor**
  (rozet veriliyor). Gün serisi (`seri_guncelle`) `trg_matches_bitti`
  üzerinden yine işliyor — oyuncu o gün oynadı, doğrusu bu.
- Arayüz: `Home.jsx`'te "Dereceli Maç" / "Normal Maç" ayrı kartlar,
  alt açıklamaları (`.bd-mod-not`) hangisinin puan yazdığını söylüyor;
  `RakipAra` `dereceli` prop'unu iki RPC'ye de geçiriyor.

### 2. Seviyeye göre bot / seviyeye göre eşleşme
- `seviye_basamagi(puan)` ve `seviyeye_gore_bot(puan)` eklendi. Dereceli maçta
  bot oyuncunun seviyesinden seçiliyor; normal maçta rastgele kalıyor
  (normal maç "serbest" mod, bilinçli tercih).
- Uygun seviyede rakip yoksa **daha düşük** basamağa iniliyor, yukarı
  çıkılmıyor (kullanıcının açık isteği).
- Uçtan uca doğrulandı (işlem geri alınarak): 0→ToyBot(0.42),
  250→ÇaylakBot(0.58), 800→ÜstatBot(0.75), 2000 ve 6000→EfsaneBot(0.90);
  `matches.dereceli = true`. Normal maçta `dereceli=false`, rakip rastgele.
- Puan doğrulaması: dereceli galibiyet 100→120; normal galibiyet 100→100.

### 3. Harita yatay ekranda oynanabilir
- `harita.css`'e `@media (orientation: landscape) and (max-height: 520px)`
  (ve 400px) katmanı: topuz 118→86/74px, emojiler tek sıra, ipucu/bilgi
  kartı sahnenin ortasını kapatmıyor. **Kural:** bu kurallar `tema.css`'e
  yazılamaz — `harita.css` lazy chunk olduğu için sonradan yüklenip
  tema.css'i eziyor, ters yönde çalışmıyor.
- `HaritaSayfasi.jsx`: `orientationchange` anında tarayıcı hâlâ eski ölçüyü
  bildirdiği için 120/320/650 ms'de tekrar boyutlanıyor; `visualViewport`
  resize'ı da dinleniyor.

### 4. Modal kapanınca sayfa en üste atmıyor
`Modal.jsx` artık gövdeyi `position: fixed; top: -<scrollY>px` ile olduğu
yerde dondurup kapanışta `scrollTo` ile geri veriyor. Eskiden yalnız
`overflow: hidden` vardı ve tarayıcı sayfayı başa çekiyordu ("yarım kalan
maçı iptal ettim, en yukarı attı" şikâyeti). Ölçüldü: 2698 → modal → 2698.

### 5. Turnuva vurgusu
Ana ekrandaki turnuva şeridi altın çerçeveli (`--bd-odul`), canlıyken kenarı
nabız atıyor; `prefers-reduced-motion` ile animasyon kapanıyor.

**Doğrulama:** `npm run build` temiz; yukarıdaki DB testleri geçti; 844×390
yatay testte taşma yok.

---

## 2026-09-11 (2) — Harita siyah ekran + kontrast/yatay kaydırma

`56d04b0` ve `5597e21`. Görev metinleri repo kökünde:
`QUIZADOR_HARITA_HATASI.md`, `QUIZADOR_KONTRAST_TASMA.md`.

### Harita siyah ekran — kök sebep
`HaritaSayfasi.jsx` effect'i `[user?.id, Boolean(profile)]`'e bağlıydı ve
gövdesi `if (!kapsayici || !user || !profile) return` ile başlıyordu. `profile`
bir an boşalınca (oturum tazeleme, `profilim` RPC'sinin hata dönmesi) temizleme
çalışıp `dunya.yokEt()` sahneyi yıkıyor, effect yeniden kurulurken erken
dönüyordu: canvas DOM'da kalıyor, rAF duruyor, **konsolda hiçbir hata olmuyor**.
Çok oyunculu kısım bir kez bağlandığı için "1 kişi burada" yazıyor ve hata
"sahne yok ama her şey normal" gibi görünüyordu.

Düzeltmeler:
- Sahne yalnız `user?.id` ile kurulur; ad `adRef` üzerinden okunur.
- Profil sonradan gelirse **sahne yıkılmaz**, yalnız isim etiketi yenilenir
  (`dunya.js › avatarAdiDegistir`).
- Çizim döngüsü try/catch; bir kare hatası artık sessizce öldürmüyor.
- İlk kare 8 sn'de gelmezse perde kalkıyor, "Tekrar dene" hata kutusu çıkıyor.
  Sekme gizliyken süre yeniden kuruluyor — otomasyon/arka plan sekmesinde
  rAF durduğu için yanlış alarm verilmiyor.
- WebGL yoksa dürüst mesaj; `.bd-harita` zemini gökyüzü rengi.

**Not (tuzak):** Chrome otomasyonunda sekme `document.hidden = true` sayılıyor,
rAF hiç çalışmıyor. "Sahne hazırlanıyor…" takılması orada ürün hatası değil;
sahnenin gerçekten çizdiği `dunya.js`'i doğrudan yükleyip `readPixels` ile
doğrulandı (7 bina, gerçek piksel).

### Yatay kaydırma — gerçek düzeltme
`.bd-ust-blok` `calc(50% - 50vw)` ile tam genişliğe taşıyor; `vw` dikey
kaydırma çubuğunu da saydığı için blok içerik alanından çubuk kadar (≈15px)
genişti. Daha önce `overflow-x: clip` ile **gizlenmişti**. Artık çubuk
genişliği ölçülüp `--bd-cubuk`'a yazılıyor (`bildim/lib/kaydirmaCubugu.js`) ve
taşma geri alınıyor → blok tam 0..1185, `scrollWidth = clientWidth`.

**Tuzak:** ölçüm gözlemi `<html>`'e kurulunca hiç tetiklenmiyor — `<html>`
yüksekliği görünen alana sabit kalıyor, içerik taşsa da büyümüyor. Gözlem
`document.body`'ye kurulmalı.

### Kontrast
Site açık temaya geçerken koyu zemin için seçilmiş altın/soluk tonlar kaldı.
Düzeltilenler: bağlantı rengi, görev sayacı, haftalık geri sayım, profil
kategori alt yazıları, lig şeridi, küçük etiketler, turnuva etiketi, bot
zorluk etiketleri, "TURNUVA LOBİSİ", rütbe adları ve eski `--text-dim`
(tek satırda 64 kullanım).

Yeni metin tokenları: `--bd-odul-metin`, `--bd-basari-metin`,
`--bd-vurgu-metin`, `--bd-hata-metin` (koyu temada `koyu.css` çeviriyor).
Rütbe adları `ranks.js › metinRenk` ile
`color-mix(in srgb, <renk> 50%, var(--bd-metin))` — kimlik korunuyor, açık
temada koyulaşıyor (≥4.6), koyu temada açılıyor (≥7.2).

**Denetim betiği hakkında iki yanlış pozitif** (görev metnindeki liste bu
yüzden şişkindi): (1) betik SVG metninin `color`'ını okuyor, logo aslında
`fill="var(--bd-metin)"` ile çiziliyor ve okunur; (2) yarı saydam arka
planları kompozit etmiyor ve `color(srgb 0..1)` biçimini yanlış ayrıştırıyor.
Düzeltilmiş betikle 9 sayfa + bir maç ekranı, **açık ve koyu temada** boş dizi.

---

## 2026-09-11 (3) — Eş zamanlı maç, kabul bildirimi, haritada ışınlanma

`9d807ce` ve `dd9515c`. Kullanıcının üç şikâyeti.

### 1. Meydan okuma kabul edilince haber yoktu
`respond_challenge` yalnız `durum`u 'aktif' yapıyordu; meydan okuyana hiçbir
sinyal gitmiyordu. Rakip maça giriyor, meydan okuyan maçı ana sayfada
bulamıyordu ("rakip benden önce başladı").

- `respond_challenge` → `bildirim_yaz(..., 'meydan_kabul', ...)` + `kabul_at`.
- Ana sayfada en üstte turuncu çerçeveli, nabız atan ayrı satır
  (`.bd-yeni-mac`). **Bot maçlarının önünde**, en yeni kabul en başta.
- Satır kendiliğinden temizlenir: oyuncu o maçta ilk soruyu cevaplayınca
  (`benimSoru > 0`) normal "yarım kalan maç" listesine düşer. Ayrı bir
  "okundu" alanı tutmaya gerek kalmadı.

### 2. Maçlar artık eş zamanlı (migration 128)
Eski akış **bilerek asenkrondu** (`oyuncu1_soru` / `oyuncu2_soru`, ayrı
`oyuncuN_baslangic`). Kullanıcı bunu istemiyor: aynı anda oynanacak, soru
aynı anda geçecek, önden gitmek yok.

Kurgu:
- `matches.senkron` (yeni maçlarda true) + `basladi` kapısı.
- `mac_hazir(id)` nabzı (istemci 3 sn, sunucu 12 sn pencere). **Maç iki taraf
  da ekrana gelene kadar başlamaz**; bot her zaman hazır sayılır.
- Ortak indeks `aktif_soru` + ortak saat `soru_baslangic`. Puan ortak saate
  göre — hız avantajı adil.
- Soru **ikisi de cevaplayınca ya da 16 sn dolunca** ikisi için birden geçer
  (`advance_match` senkron dalı).
- `submit_match_answer` senkronda ortak indeksi ilerletmez ve aynı soruya
  ikinci cevabı reddeder (çift puan kapandı).

**Bot tuzağı:** senkronda bot indeks olarak `aktif_soru` kullansaydı, cron her
7 sn'de aynı soruyu yeniden cevaplayıp puan yazardı (`on conflict do nothing`
satırı engeller ama skor UPDATE'i yine çalışır). Çözüm: bot kendi
`oyuncuN_soru` indeksini kullanmaya devam eder, ek koşul `= m.aktif_soru`.
Bot ayrıca senkronda `soru_baslangic`i **sıfırlamaz** — ortak saati bozardı.

**Geriye uyum:** o an açık olan maçlar `senkron = false` yapıldı; eski
kurallarıyla bitiyorlar. Asenkron ekranları (`Senin bölümün bitti`, "rakip
önde" kartı) `!senkron` ile korundu.

**Terk edilme (migration 129):** senkronda soruyu ilerleten taraf istemci.
İkisi de sekmeyi kapatırsa maç sonsuza kadar aktif kalıyordu. `senkron_mac_temizle()`
saatlik cron'a eklendi: hiç başlamamış 1 saatlik maç iptal, başlamış ama 10
dakikadır duran maç o anki skorlarla biter.

### 3. Haritada ışınlanma
Gelen konum paketi doğrudan hedefe yazılıp kare başına lerp ediliyordu.
Paketler düzgün aralıklarla gelmediği için avatar duraklayıp sıçrıyordu.

**Kritik ayrıntı:** ilk denemede paketleri **varış zamanıyla** damgaladım ve
sonuç daha kötü çıktı (hız sapması 7.35 → 16.0). Ağ gecikmesindeki değişim
hareketin kendisine karışıyor. Doğrusu **gönderenin saat damgası** + alıcının
saat farkı kestirimi (gözlenen en küçük gecikme).

Son hâli: uyarlanır gecikme (140-420 ms, gözlenen jitter kadar) + tampon
kuruyunca 300 ms tahmin + kare başına adım kelepçesi (yürüme hızının 1.8 katı).
Ölçüm (`.tmp/ara-degerleme-testi3.mjs`): hız sapması iyi ağda 3.27 → 0.05,
kötü ağda 7.53 → 0.43; duraklama %8.09 → %0.07.

Ayrıca: presence titrerse avatar rastgele kenarda doğmuyor (son konum
saklanıyor) ve ilk paket gelmeden hiç çizilmiyor.

### Not — otomasyon tuzağı (tekrar)
Chrome otomasyonunda sekme `document.hidden` sayılıyor: `setInterval` dakikada
bire düşüyor, süre dolunca ilerletme tetiklenmiyor. Maç ekranı testinde
"soru geçmedi" gibi görünen durum bu; sunucu yolu ayrı test edildi.

---

## 2026-09-11 (4) — Bütün maçlar eş zamanlı: hazır kapısı, kopma kilidi, hükmen mağlubiyet

`3ba9e98`, migration 130. Kullanıcı: "bütün maçlar eş zamanlı yapılacak, tüm
eşleştirmelerden rakip beklenecek, iki taraf da hazır tuşuna basacak; rakip
çıkarsa diğerinin ekranı kilitlenecek; belli sürede dönmezse maçtan ayrılmış
mağlup sayılacak; maç bitince sayfa kapanmayacak."

### Kapsam
1v1 (`matches`), grup maçı, hızlı maç. **Turnuvaya dokunulmadı**: zaten ortak
saatli ve kendi lobisi var (belirli saatte herkes için birlikte başlıyor).

### Kurgu (üç modda da aynı sözleşme)
Sunucu: `mac_nabiz` / `grup_mac_nabiz` / `hizli_mac_nabiz` — istemci 3 sn'de
bir çağırır, `p_hazir` ile "Hazır"ı iletir, dönüşte ekranın ne çizeceğini alır.
İstemci: `bildim/lib/nabiz.js › useMacNabiz` +
`bildim/components/MacHazirlik.jsx › HazirKapisi, KopukPerde`.

- **Hazır kapısı:** herkes hazır olana kadar `basladi = false`; soru çekilmez.
  Bot her zaman hazır sayılır.
- **Kopma kilidi:** 12 sn nabız gelmezse `duraklatildi_at` konur. Süre işlemez,
  cevap reddedilir (`Rakip bağlantısı koptu — maç duraklatıldı`), `advance_*`
  erken döner. Dönüşte `soru_baslangic += duraklama` — **bekleyen oyuncu süre
  kaybetmez** (ölçüldü: 20 sn duraklama, saat tam 20 sn ileri kaydı).
- **Hükmen mağlubiyet:** 45 sn. 1v1'de `terk_eden` yazılır ve kalan kazanır;
  grup/hızlıda terk eden çıkarılır, maç kalanlarla sürer.

### Bilinçli karar — arka plandaki sekme nabız atmaz
`useMacNabiz` `document.hidden` iken çağrı yapmaz. Kullanıcı "ekran
değiştirirse diğer rakibin ekranı da kilitlenecek" dediği için bu istenen
davranış; tarayıcı zaten arka planda zamanlayıcıları kıstığından dürüst olan
da bu. 12 sn'lik pencere kısa bakışlara tolerans bırakıyor.

### Tuzaklar
- **Duraklama bitince soruyu YENİDEN ÇEKMEK şart.** `soru_baslangic` ileri
  kaydığı için karttaki sayaç eski (dolmuş) kalıyor. `MatchPage`'de
  `duraklamaTuru` sayacı hem effect bağımlılığında hem `QuestionCard` key'inde;
  grup/hızlıda effect zaten `soru_baslangic`e bağlıydı.
- **Grup/hızlıda `terk_at` her sayıma girmeli:** oyuncu sayısı, kazanan
  seçimi, gün serisi döngüsü ve `bot_oyna`'nın "herkes cevapladı mı"
  kontrolü. Biri unutulursa maç terk eden oyuncuyu sonsuza kadar bekler.
- **Eski `mac_hazir` silinmedi**, `mac_nabiz(id, true)` sarmalayıcısına
  döndü: sürüm geçişinde eski istemci maçı kilitlemesin.

### Maç bitince oturum açık kalıyor
Sonuç ekranında sohbet çubuğu + sesli sohbet + tepkiler duruyor. Hızlı maçın
sohbet altyapısı yok (mesaj tablosu yok); orada yalnız "sayfa açık kalır" notu.

### Bu turda çıkan kontrast hataları (sonuç ekranı)
Bitmiş maç olmadığı için bu ekran önceki taramalarda hiç görülmemişti:
"Kazandın!" başlığındaki `background-clip: text` kalıntısı Şenlik katmanı
gerçek renk verince arkada **dolu altın kutu** olarak kalmış (yeşil yazı
altın üstünde 2.77); paylaş düğmeleri `color: inherit` yüzünden koyu zeminde
kayboluyor (1.27); WhatsApp yeşili 2.87; "Hatalarım" satırı koyu temada 1.10;
"süre doldu" tur noktası 3.33. Hepsi düzeltildi.

**Özgüllük tuzağı:** `.app a.bd-yanlis-satiri` (src/styles.css) ile
`.app .bd-yanlis-satiri` aynı özgüllükte (0,2,1 / 0,2,0) — sonra gelmek
yetmedi, `:root` ekleyip özgüllüğü artırmak gerekti.

---

## 2026-09-11 (5) — Quiz Square: marka, coin, avatar, meydan turnuvası, lobi

Altı bölümlük görev. `80445ce` → `4193037`. **Push edilmedi, migration'lar
canlıya uygulanmadı** (görev öyle istedi).

### 1. Marka: Quizador → Quiz Square
Alan adı `quizsquare.app`. Marka adı hiçbir dile çevrilmiyor. 3B alanın adı
mekân adı olduğu için yerelleşiyor: TR "Meydan".
**Logo ölçüsü tahmin edilmedi**, tarayıcıda Baloo 2 800 ile ölçüldü:
"Quiz Square" 157.2 birim → viewBox 124→160, oran 3.1→4.0, alt çizgi 120→155.
`bildim/` klasör adı ve DB tablo/kolon adları bilerek değişmedi.
`quizador_ana_ekran_kapatildi` localStorage anahtarı da korundu — değiştirmek
"ana ekrana ekle" önerisini kapatmış herkese yeniden çıkarırdı.

### 2. Coin ekonomisi (migration 131)
Bakiye `profiles.coin`, her hareket `coin_hareketleri`'nde. **Tüm dengeleme
sayıları `oyun_ayarlari` tablosunda** — kodda sabit sayı yok.

**Bakiye korumasının iki katı var:** `authenticated` rolünün `profiles`'a
zaten doğrudan izni yok (test sırasında öğrenildi), üstüne bir de trigger:
coin ancak işlem-yerel `app.coin_izin` bayrağı açıkken değişir, bayrağı da
yalnız security definer fonksiyonlar açar.

Aynı maça iki kez coin verilmesini **kısmi tekil indeks** engelliyor
(`tur='mac'` + referans). Ödül maç bitiş fonksiyonlarının içinde veriliyor;
istemci "kazandım" diyemiyor.

### 3. Avatar (migration 132)
`profiles.gorunum` tek doğruluk kaynağı. Bunu gerçekten sağlamak için
`dunya.js`'teki avatar çizimi `avatar.js`'e taşındı, ortak canvas yardımcıları
`ortak.js`'e alındı: meydan ve Görünüm önizlemesi **aynı `avatarKur()`**
fonksiyonunu çağırıyor.

Katalog DB'de (`esyalar`), kodda yalnız her kodun geometri üreticisi
(`esyalar.js`). 18 eşya geometrik ilkellerden üretiliyor; geometriler ve renk
başına malzemeler **paylaşılıyor** (40 kişi aynı şapkayı giyse tek geometri).

**Testin yakaladığı iki hata:** (1) `RETURNS TABLE(... kod text)` çıktı adı
`esyalar.kod` ile çakışıyordu, (2) kısmi kayıt diğer yuvaları siliyordu —
artık yalnız gönderilen anahtarlar işleniyor.

### 4. Görünümün meydana yansıması
Görünüm presence yükünde **bir kez** gidiyor (kare kare değil); kıyafet
değişimi tek `gorunum` broadcast mesajı. Alan taraf sahneyi yıkmadan yalnız
eşyaları yeniliyor.

### 5. Turnuva meydanda (migration 133)
Kupa binası 10 dk önce ışıyor, üstünde geri sayım levhası (levha saniyede bir
değil, **metin değişince** yeniden üretiliyor).
**Meydan tek yol değil** — klasik düğmeden giriş aynen duruyor.
Ödül sunucuda doğrulanıyor: `meydan_turnuva_damgasi()` pencereyi sunucu
saatiyle kontrol ediyor, istemci "meydandaydım" diyemiyor.

### 6. Lobi (migration 134)
**3-2-1 istemcide üretilmiyor:** maç başlarken soru saati 3 sn ileri kuruluyor,
iki istemci de aynı anı görüyor. Geri sayım sürerken cevap ve ilerleme yok.
2 dakika sonra "İptal et" / "Asenkron bırak" seçeneği çıkıyor.

**Görev metniyle çelişki:** görev yalnız arkadaş maçlarının senkron olmasını,
eşleşmeyle bulunan maçların asenkron kalmasını istiyordu. Bir önceki sözlü
talimat "bütün maçlar eş zamanlı" olduğu için senkronluk geri alınmadı; karar
migration başlığına yazıldı.

### Yöntem notu — migration'ları uygulamadan doğrulamak
Görev canlıya uygulamayı yasakladığı için her migration **gerçek veritabanında
işlem içinde çalıştırılıp `rollback` edildi**. Söz dizimi + anlam (kolon adı,
tip, kısıt) böyle doğrulandı; kalıcı etki yok. Aynı yöntemle 65 işlev testi
yazıldı ve bunlar 6 gerçek hata yakaladı (`joker_islemleri.kaynak` kısıtı,
`badges` birincil anahtarı, dönüş tipi değişimi, ad çakışması, kısmi kayıt,
test fikstürlerindeki zorunlu kolonlar).

---

## 2026-09-11 (6) — iPhone'da beyaz ekran + migration'lar canlıya alındı

### iPhone'da site açılmıyordu — sebep ve kanıt
Arkadaşının iPhone'unda site bembeyaz açılıyordu. **Tahmin edilmedi, canlı
paket indirilip ölçüldü:** yayındaki `index-Bbwt29PY.js` içinde `?.`
(optional chaining) **12.693 adet**, `??` **27 adet** HAM hâlde duruyordu.

Bu iki sözdizimi **Safari 13.1** ile geldi. iOS 13.3 ve altındaki iPhone'lar
dosyayı ayrıştıramıyor → uygulama hiç başlamadan beyaz sayfa. **Hata konsola
bile düşmüyor**, çünkü kod çalışmaya başlamıyor — bu yüzden fark edilmemiş.

Sebep: Vite'ın varsayılan `build.target` değeri `"modules"` = safari14.
Kimse daha eskisini düşünmemiş.

**Düzeltme:** `build.target` ve `build.cssTarget` açıkça
`["es2019","safari12",...]`. safari12 = iOS 12.2 (iPhone 5s/6 dahil hâlâ
ayakta olan en eski cihazlar). Ölçüm: ham `?.` 12.693 → **0**.

### İkinci kat: color-mix()
`color-mix()` iOS 16.2+ ister; eski Safari o **bildirimi düşürür**. Tam ekran
perdelerde (kopma kilidi, 3-2-1 geri sayım) zemin düşünce perde **görünmez
ama tıklamayı engellemeye devam ediyordu**. 19 yere düz renkli yedek eklendi.

### "Bir daha açılmamazlık yapmasın" — otomatik denetim
`araclar/tarayici-uyumluluk.mjs` + `package.json` `postbuild`: **her
`npm run build` sonrası kendiliğinden çalışır.**
- Safari 12.1 üstü sözdizimi bulursa **derlemeyi çökertir** (exit 1)
- Korumasız yeni API ve yedeksiz `color-mix` için uyarır
- Yanlış pozitifleri eler: küçültücünün `x ? .5 : 1` → `x?.5:1` yazması ve
  metin içindeki `"???"` dizgileri

**Denetimin kendisi de sınandı:** hedef geçici olarak `es2022` yapıldı →
derleme exit 1 ile düştü, 55 dosyada optional chaining raporlandı; hedef geri
alınınca temiz geçti.

### Migration'lar canlıya uygulandı
131–134 sırayla uygulandı. Sonuç: 11 ayar, 18 eşya, 4 coin paketi, 39 oyuncuya
başlangıç coini, 176 eşya sahipliği, `matches`'a 4 yeni kolon, `avatarlar`
Storage kovası. Canlı duman testi 7/7.

### Canlı doğrulama
`quizador.vercel.app` açıldı: başlık "Quiz Square", kök dolu, konsolda hata
yok, üst çubukta coin hapı (300), `/gorunum` sayfasında 3B avatar çiziliyor,
7 yuva sekmesi ve ten paleti çalışıyor. Canlı paketlerde ham `?.` / `??` = 0.
