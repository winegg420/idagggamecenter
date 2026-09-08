# Bildim! — Modül İlerleme Günlüğü

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
