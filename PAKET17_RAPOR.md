# Paket 17 — Taç/pelerin onayı · iki ölü sistem · gardırop dondurma (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — taç + pelerin onaylandı | ✅ canlıda · 152↔167 farkı kapandı | `376f453`, `6042c32`, `4a71af1` |
| B — push kimseye gitmiyor | ✅ canlıda · zincir ölçüldü, 3 kopma düzeltildi, bildirim gerçekten geldi | `e56caaa` |
| C — lig arşivi boş | ⏸ ölçüldü: arşiv yazımı sağlam; kapanışta 2 kusur bulundu, **düzeltilmedi (karar sahibinde)** | `a13562a` |
| D — eski gardırop dondurma + yeni vitrin | ✅ canlıda · migration 216 uygulandı | D commit'i |

---

## A — Taç ve pelerin

- `paket16-tac-pelerin` dalı `main`'e birleştirildi (`376f453`, yalnız `meydanAvatar.js` + 2 görsel). Dal GitHub'dan silindi. Build hatasız.
- `PAKET16_RAPOR.md` C: "karar bekliyor" → "onaylandı, canlıda".
- **Canlı doğrulama:** canlı paket `https://quiztactics.vercel.app/assets/dunya-BRUhwwKX.js` içinde `MeydanPelerin` / `MeydanTac` var (canlı parçalar tek tek indirilip arandı). Canlı meydana girmek oturum istiyor — şifre giremediğim için görüntü, **aynı commit'in üretim derlemesinden** (`olcum/meydan-test`, sahte oturum) alındı: `gorsel/paket17/a-tac-pelerin-uretim-arkadan.jpg`, `a-tac-pelerin-uretim-onden.jpg` (insan, kaplan, robot; klasik ve kısa pelerin).

### 152 ↔ 167 çağrı farkı — kapandı
Aynı üretim derlemesi, aynı kamera (İstiklal ucu), aynı oyuncu sayısı (27 karakter: 20 tam + 7 hafif), iki sahne kurulumu. Kozmetikler gizlenerek çağrı yeniden sayıldı:

| Kurulum | Toplam çağrı | Görünür kozmetik klonu | Kozmetik klonları gizli | Taç/pelerin gizli |
|---|---:|---:|---:|---:|
| 3A-2 (`cepheOlc`: oyuncular tohumdan görünüm alır) | **167** | 27 (sapka 8 · atkı 9 · gözlük 2 · kuyruk 8) | **142** | — |
| Paket 16 C ölçümü (herkese `avatar3d` taç + pelerin) | **154** | 10 (atkı 1 · gözlük 1 · kuyruk 8) | 144 (= 142 + taç/pelerin 2) | **152** |

- **Sebep: kamera/LOD değil, sahnenin kurulumu.** İki kurulumun kozmetiksiz tabanı aynı: **142**.
- 3A-2'de oyuncular görünüm kaydı olmadan geliyor → `tohumdanGorunum` her birine rastgele şapka/atkı/gözlük veriyor. Meydandaki kozmetikler **karakter başına klon mesh** (her biri 1 çağrı); 27 klonun 25'i kadrajda → 142 + 25 = 167.
- Paket 16 C ölçümünde herkese `avatar3d` görünümü verildi (baş = taç) → rastgele kozmetikler düştü → 10 klon → 152; taç/pelerinle 154.
- **Düzeneğe güven:** sayılar birebir toplanıyor (142 + 25 = 167; 142 + 10 = 152; +2 = 154). Karşılaştırmalar **aynı sahne kurulumuyla** yapıldığı sürece geçerli; kurulum değişirse taban değişir. İleriki ölçümlerde sahne kurulumu rapora yazılmalı.
- **Yan bulgu:** kozmetik klonları görünür bir maliyet — 20 tam karakterde 25 çağrı. Taç/pelerinin paylaşımlı InstancedMesh deseni diğer kozmetiklere de uygulanırsa bu 25 çağrı ~5'e iner (bu pakette yapılmadı; karakter.js/kozmetik.js kapsam dışı).

---

## B — Push bildirimleri kimseye gitmiyordu

### B.1 Zincir (baştan sona ölçüldü)

| Halka | Ölçüm | Sonuç |
|---|---|---|
| Service worker kaydı | `src/main.jsx` her açılışta `/sw.js` kaydediyor; canlı `quiztactics.vercel.app/sw.js` 200, kayıt kodu canlı pakette var | ✅ çalışıyor (hata `.catch(() => {})` ile yutuluyordu → artık konsola yazılıyor) |
| `sw.js` işleyicileri | `push` (JSON → `showNotification`) ve `notificationclick` (pencereyi odakla / aç) var | ✅ |
| VAPID eşleşmesi | İstemci anahtarı (`push.js`) ile gerçek Chrome'da FCM aboneliği alındı → sunucudan `send-push` → **`{"basarili":1}`** ve bildirim tarayıcıda göründü. Anahtarlar eşleşmeseydi FCM 403 döner, `basarisiz: 1` olurdu | ✅ eşleşiyor |
| Kayıt RPC'si | `save_push_subscription` security definer, yalnız `authenticated` EXECUTE; `authenticated` rolü + kurucu kimliğiyle çağrıldı → satır düştü | ✅ |
| **İzin kartının görüldüğü yer** | `BildirimIzniSor` yalnız **1v1 Normal Maç sonuç ekranında** (`MatchPage`). Veri: ilk maçını bitiren **15** gerçek oyuncudan (`lige_girdin` bildirimi) yalnız **5**'i `matches` tablosunda maç bitirmiş; diğerleri Düello / Hızlı Mod oynamış — kartı **hiç görmemiş** | ❌ **kopma 1** |
| **Kartın hata yönetimi** | `catch { /* kullanıcı reddetti */ }` + `finally { kapat() }`: her hata yutuluyor **ve** "bir daha sorma" işareti yine konuyordu → tek teknik hata oyuncuyu kalıcı olarak bildirimsiz bırakıyor, hiçbir yerde görünmüyor | ❌ **kopma 2** |
| iPhone Safari sekmesi | Apple web push'u yalnız ana ekrana eklenmiş uygulamaya veriyor; `PushManager` yok → `pushDestekleniyor()` false → kart da Profil'deki düğme de **hiç çıkmıyor**, oyuncuya neden olduğu söylenmiyor | ❌ **kopma 3** (platform kısıtı; oyuncu bazında ölçülemedi — istemci telemetrisi yok) |
| Profil › Bildirimler düğmesi | Hata `hataMesaji` ile gösteriliyor | ✅ (tek düzgün giriş, ama oyuncunun gidip bulması gerekiyor) |

Canlıda 5 oyuncunun her birinin kartta ne yaptığı (reddetti / kapattı / hata aldı) ölçülemez: kopma 2 yüzünden hiçbir iz kalmamış.

### B.2 Düzeltmeler
- `BildirimIzniSor`: "bir daha sorma" işareti yalnız **oyuncu "Şimdi değil" derse, izni reddederse ya da abonelik başarılı olursa**; teknik hata `console.error` + kartta mesaj, tekrar denenebilir. Başarıda "Bildirimler açık".
- Kart artık **Düello** ve **Hızlı Mod** sonuç ekranlarında da (Normal Maç'ta zaten vardı).
- iPhone Safari sekmesinde kart yerine bir kez "ana ekrana ekle, oradan aç" ipucu (TR + EN).
- `bildirimleriKapat`: sunucu silme hatası artık konsola yazılıyor.
- **Aynı hata başka yerlerde:** ağ çağrısını saran ve hatayı sessizce yutan **21** yer bulundu (tarama betiği `.tmp/p17/sessiz.mjs`). Hepsine davranışı değiştirmeden `console.warn("[Bildim] <rpc> başarısız:", …)` eklendi: `BildirimZili` (bildirimleri_oku), `DavetBandi` (bekleyen_davetlerim), `EzeliRakip`, `MacSonuDokum` (auth.getUser), `MacSonuEklentisi` (seri_durumum), `RakipAra` (kuyruktan_cik), `SesliSohbet`, `UstalikIzgarasi`, `YanlisSatiri`, `harita/coklu.js` (removeChannel), `ChallengesPage` (eski_davetleri_temizle), `Home` ×3, `MatchPage` (advance_match), `ProfilePage` (yanlis_bankam), `AuthContext` ×3 (profilim, arkadas_davet_kodu_ile_ekle, kalp_at), `main.jsx` (sw kaydı). Tarama sonrası kalan: 0.

### B.3 Doğrulama (Playwright, gerçek Chrome, gerçek FCM)
1. Maç sonucu sınama sayfasında `BildirimIzniSor` (gerçek bileşen + gerçek `push.js`; yalnız Supabase istemcisi çağrıyı kaydeden sahte) → kart göründü → izin verildi → "Bildirimleri aç" → **"Bildirimler açık"**; bileşen `save_push_subscription`'ı gerçek abonelik bilgisiyle çağırdı.
2. Aynı abonelik canlı veritabanına **`save_push_subscription` üzerinden** (`authenticated` rolü, kurucu kimliği) yazıldı → `push_subscriptions`'ta 1 satır.
3. `push_gonder` → canlı `send-push` → `{"basarili":1,"basarisiz":0}` → service worker bildirimi gösterdi: "🧪 Quiz Tactics push sınaması".
4. Test aboneliği silindi → tablo yine **0**.

Görseller: `gorsel/paket17/b-1-izin-karti.jpg`, `b-2-abone-olundu.jpg`, `b-3-bildirim-geldi.jpg`.

**Bilinen sınır:** canlı sitede gerçek oturumla deneme yapılmadı (şifre giremem); zincirin her halkası ayrı ayrı canlı bileşenlerle denendi. iPhone'da gerçek cihaz testi yok. Abone sayısının artması için oyuncuların kartı yeniden görmesi gerekiyor: eski koddaki "bir daha sorma" işareti hata yüzünden konmuş olabilecek tarayıcılarda kart çıkmaz — onlar için giriş Profil › Bildirimler.

---

## C — Haftalık lig arşivi boş (ölçüldü, kod değişmedi — karar sahibinde)

### C.1 Ölçüm

**Cron işleri (son 30 gün, `cron.job_run_details`):** dördü de **yalnız bir kez** çalışmış — site 12 Eylül'de geçmişi sıfırlayıp açıldığından beri kapanan tek hafta 7–13 Eylül.

| İş | Zaman (UTC) | Koşu | Başarılı | Hata |
|---|---|---:|---:|---:|
| `bildim-lig-kapat` (`lig_haftayi_kapat`, 5 kademe) | Paz 20:45 | 1 (13 Eyl) | 1 | 0 |
| `bildim-hafta-kapat` (`haftayi_kapat`, eski şehir/ülke/dünya arşivi) | Paz 21,22,23 | 3 | 3 | 0 |
| `bildim-hafta-kapat-pzt` (aynı fonksiyon, yedek pencere) | Pzt 00–03 | 4 | 4 | 0 |
| `bildim-hafta-bildir` (`haftalik_sonuc_bildir`) | Pzt 06:00 | 1 | 1 | 0 |

**İki ayrı lig sistemi var:** `lig_arsiv` eski şehir/ülke/dünya haftalık sıralamasının arşivi (`haftayi_kapat`). Oyunun omurgası olan 5 kademe + 25 kişilik grup ise `lig_uyelik` + `lig_haftayi_kapat`. Arşivin boş olması yeni ligin çalışmadığı anlamına gelmiyor.

**5 kademeli lig kapanışı çalışmış:**
- `lig_son_kapanis` = `2026-09-07`; 7 Eylül haftası kapanmış, 14 Eylül haftasının grupları kurulmuş (bronz 62, gümüş 8 üye).
- Grup ödülleri dağıtılmış (13 Eyl 20:45'te `coin_hareketleri`'nde 7 `lig` ödülü).
- **1 gerçek oyuncu Gümüş'e yükselmiş** (`4c7703b8…`).
- `lig_cerceveleri`'nde `kaynak = 'lig_yukselme'` yok, çünkü tek kapanış migration 213'ten (17 Eyl) önce oldu. O yükselme 17 Eylül'deki geriye dönük 271 `gecmis` çerçevesinin içinde. İlk gerçek `lig_yukselme` 20 Eylül kapanışında beklenir.

**`lig_arsiv` neden boş:** `haftayi_kapat` yalnız `puan_hafta > 0` ve en az 1 maçı olan **gerçek oyuncuları** arşivler.
- **Kapanış çalıştı:** botlar puanı `puan` ve `puan_hafta`'ya hep birlikte ekliyor (`bot_puan_tik`), yine de **104 botta `puan_hafta < puan`** → 13 Eylül 21:00'de sıfırlama yapılmış, yani fonksiyon gövdesi çalışmış.
- **Arşivlenecek kimse yoktu:** 4 gerçek oyuncunun **4'ünde de `puan_hafta = puan`** → sıfırlama anında hiçbirinin haftalık puanı yokmuş. O hafta biten gerçek oyunculu 3 maç: 2'si bota karşı mağlubiyet (0 puan), 1'i aynı çift arasında beraberlik; bu beraberlik de puan yazmamış, aksi hâlde bugün `puan_hafta < puan` olurdu.
- **Bugün doğru çalışıyor:** işlem içinde çalıştırılıp geri alındı → **4 satır arşivlendi, 163 profilin `puan_hafta`'sı sıfırlandı, 4 `hafta_sonuc` bildirimi yazıldı**. 20 Eylül kapanışında arşiv dolacak.
- **Sonuç: arşiv yazımında hata yok, koşul sağlanmamış.** Geriye dönük doldurma yapılmadı (o haftanın verisi yok).

### C.2 Kapanışta bulunan iki gerçek kusur (düzeltilmedi, sahibi karar versin)
1. **Pasif sayacı haftadan haftaya taşınmıyor → "üst üste 2 hafta pasif düşer" kuralı hiç tetiklenmez.** `lig_gruplarini_kur` yeni haftanın satırını `pasif_hafta` vermeden ekliyor (varsayılan 0). Kapanış `pasif_hafta + 1 >= 2`'ye o haftanın satırından bakıyor, sayaç en fazla 1 oluyor. (7 Eylül haftasında 40 pasif oyuncu vardı; 14 Eylül satırlarında toplam 0.)
2. **Aktiflik yalnız `matches` tablosundan sayılıyor.** `mac_sayisi` yalnız Normal Maç'ları sayıyor; **Düello, Hızlı Mod, grup, turnuva sayılmıyor**. Bu hafta Düello bitiren 3 gerçek oyuncu kapanışta "pasif" görünecek → sıralamada ilk 5'e girse bile **yükselemez** (pasif dalı `continue` ediyor). Kusur 1 yüzünden şimdilik lig düşürmüyor; kusur 1 düzeltilirse bunları iki hafta sonra düşürmeye başlar. İkisi birlikte düzeltilmeli.
- **Ek gözlem:** 7 Eylül kapanışında herkesin `puan_hafta`'sı 0'dı. Sıralama `puan_hafta desc, puan desc, gorunen_ad asc` olduğu için yükselen oyuncu fiilen puanla değil, maçı olan oyuncular arasında toplam puan ve ada göre seçildi. Puanlı haftalarda sorun olmaz ama "0 puanla yükselme" kuralı tanımlı değil.
- **Zamanlama notu:** lig kapanışı Pazar 20:45 UTC, `puan_hafta` sıfırlaması 21:00 UTC. Aradaki 15 dakikada kazanılan haftalık puan hiçbir haftaya sayılmıyor.


---

## D — Eski gardırop donduruldu, yeni karakter vitrini

### D.0 Başlangıç durumu (doğrulandı + eksikler)
- **Türler:** insan · kaplan · robot (`karakter.js › TURLER`), aynı iskelet.
- **Kozmetikler** (`kozmetik.js › KOZMETIK`): sapka · gozluk · gozlukPremium · atki · kanat (sırt). Robotun kendi sapka/gozluk varyantı var; olmayan tür insanınkini kullanır. Kaplanda kuyruk tür parçası.
- **Taç + pelerin:** Bölüm A ile meydanda (`meydanAvatar.js`, paylaşımlı InstancedMesh).
- **Kıyafet setleri** (`SETLER`): 1 Günlük · 2 Şık · 3 Spor · **4 Alev** (`vfx: alevliGomlek`). Saç varyantı 3 (kase / kısa / kuyruk). Ten/saç/üst/alt/ayakkabı palet tonları. (Paketin tablosunda setler yoktu.)
- **VFX reçeteleri** (`vfx.js › RECETE`, tam liste): `alevliGomlek` (11 yayıcı: omuz, göğüs, sırt, ön kol, el izi, ısı halesi, kıvılcım, duman) · `kanat` (3: iki parıltı + parlama) · `buzluKanat` (4: sınav örneği, hiçbir kozmetiğe bağlı değil).
- **Petler** (`pet.js`): kedi · köpek (kedinin yeniden derisi) · kuş (kod geometrisi). Meydanda **kullanılmıyor**, yalnız deneme sayfasında.
- **Boş yuvalar** (GLB'de): sacYuva · sakalYuva · elbiseYuva · altYuva · efektYuva · kulakYuva L/R · bilekYuva L/R · ayakYuva L/R.
- **Eski kutu karakteri gösteren ekranlar (tarandı):** Dükkân › Görünüm sekmesi (`GardropVitrini` → `KarakterPortresi` + eski katalog portreleri), `/gorunum` → `bildim/avatar3d/gardrop.html` (eski 3B gardırop), `/gorunum-3b` (`GorunumPage` + `EsyaPortresi`), atölye (`avatar3d/index.html`), eski yerel meydan denemesi (`avatar3d/meydan.html`).
- **Temiz çıkanlar:** Ana sayfa, profil, lig, maç ekranı, arkadaşlar, oyuncu kartı, kurulum sihirbazı, bildirim ve paylaşım görselleri. Hepsi `src/components/Avatar.jsx` kullanıyor, o da yalnız seçilen avatar resmi ya da baş harf çiziyor (13 Eylül kararı, 3B yok).
- **Kurulum sihirbazı:** kendisi 2B avatar seçtiriyor. Bitince `Layout` oyuncuyu `/gorunum`'a gönderiyordu, orası eski gardıroptu → artık yeni vitrin.

### D.1 Veri
Hiçbir tablo/kolon silinmedi, boşaltılmadı. Migration 216 yalnız **ekler**: `vitrin_kozmetikleri` tablosu, `vitrin_katalogum()`, `meydan_gorunum_kaydet()`. Eski `avatar3d` kaydı değiştirilmez; vitrin `profiles.gorunum.harita`'ya yazar.

### D.2 Dondurulan ekranlar ve kaldırılan girişler

| Ekran / giriş | Önce | Şimdi |
|---|---|---|
| `/gorunum` | `GardropaGit` → eski gardırop HTML'i | **Yeni vitrin** (`KarakterVitrini`) |
| `/gorunum-3b` | eski 3B görünüm sayfası | `/gorunum`'a yönlenir |
| `bildim/avatar3d/gardrop.html`, `index.html` (atölye), `meydan.html` | eski sayfalar | açılınca `/bildim/gorunum`'a yönlenir; **derleme girişleri aynen duruyor** (`rollupOptions.input`'a dokunulmadı) |
| Üst çubuk tişört kısayolu | eski gardırop HTML'ine düz bağlantı | vitrine rota bağlantısı |
| Dükkân › Görünüm sekmesi | `GardropVitrini` (eski portre + eski katalog) | vitrine giden kart |
| Meydan kapısı ("Önce karakterini oluştur") | yalnız eski `avatar3d` kaydı geçer; "Gardıroba git" | eski kayıt **ya da** vitrin kaydı geçer; "Karakterimi seç" → vitrin |
| Kurulum sonrası yönlendirme | eski gardırop | vitrin |
| Profil › Görünüm kartı | "Saç, şapka, gözlük, kıyafet ve efektleri…" | "Türünü seç, kozmetiklerini tak…" (rota aynı) |

**Kod durur:** `bildim/avatar3d/*`, `bildim/karakter/*`, `GardropVitrini`, `KarakterPortresi`, `EsyaPortresi`, `GorunumPage`, `GardropaGit`, `harita/avatar.js`, `portre.js`, `onizleme.js` silinmedi.

### D.3 Yeni vitrin
- `bildim/vitrin/KarakterVitrini.jsx` + `vitrinSahne.js` + `vitrin.css`. Meydanın kendi `KarakterSistemi` + `MeydanAvatarlari`'sı: **tek WebGL bağlamı**. Canlı önizleme ve 8 kart portresi aynı renderer'la çiziliyor (sayfada 1 `<canvas>`, ölçüldü).
- **Tür seçimi** (insan / kaplan / robot) + **kozmetikler:**
  - Şapka: eski Kep/Bere sahipliği; Kep ücretsiz.
  - Gözlük: Kare/Okuma/Yuvarlak sahipliği; Kare gözlük 350 coin.
  - Güneş gözlüğü: Güneş/Spor sahipliği; Güneş gözlüğü 450 coin.
  - Taç, Pelerin: **Satılmaz · turnuva ödülü**.
  - Satın alma eski `avatar3d_satin_al` ile; fiyatlar eski katalogdan, koda gömülü değil.
- **"Yakında" kilitli:** Saç, Elbise, Alt (gövde yuvaları; yeni sistemde üretilmiş parça yok) + Atkı, Kanat (model hazır ama satışa hiç çıkmamış, fiyat kararı sahibinde). Sayfanın altında "vitrin yeniden kuruluyor, aldıkların hesabında" notu.
- **Sunucu doğrulaması** (canlı veritabanında, işlem içinde, geri alındı):
  - Geçerli kayıt (kaplan + şapka + pelerin + güneş gözlüğü) OK.
  - Sahip olunmayan Taç → "Bu kozmetik sende yok".
  - Gözlük + güneş gözlüğü birlikte → "Bu iki kozmetik birlikte takılamaz".
  - Atkı → "Bu kozmetik henüz açılmadı".
  - Geçersiz tür → hata.
  - Katalog ve tablo `anon`'a kapalı.
- **Bilinmeyen anahtar:** `vitrinKozmetikleri()` yalnız beyaz listedeki 7 anahtarı okur. Eski kayıttaki `sac`, `efekt`, `portre_url`, `kozmetik`… vitrinde sessizce atlanır.
- **Lig çerçeveleri** etkilenmedi (ayrı tablo, Profil'deki seçici aynen).
- **Geri dönüş yolu:** `bildim/CLAUDE.md › Eski gardırop dondurma (17 Eyl 2026)`.

### D.5 Vitrin ↔ meydan aynı mı (test edildi)
Aynı `profiles.gorunum` (eski `avatar3d` gövdesi + vitrin kaydı: kaplan, şapka, güneş gözlüğü, pelerin) iki ekranda:
- **Vitrin:** takılı Şapka · Güneş gözlüğü · Pelerin, tür Kaplan, "Kaydedildi".
- **Meydan** (üretim derlemesi, gerçek harita kodu): tür `kaplan`, `kozmetik_sapka` + `kozmetik_gozlukPremium` + `kozmetik_kuyruk`, pelerin örneği 1, taç 0.
- Görseller: `d-7-ayni-gorunum-vitrin.jpg` ↔ `d-8-ayni-gorunum-meydan.jpg` — aynı gövde renkleri ve aynı kozmetikler.

### Görseller (`gorsel/paket17/`)
`d-1-insan-kozmetiksiz` · `d-2-insan-kozmetikli` · `d-3-kaplan-kozmetikli` · `d-4-kaplan-kozmetiksiz` · `d-5-robot-kozmetiksiz` · `d-6-robot-kozmetikli-tam-sayfa-yakinda-kilitleri` (Yakında kilitleri + Satılmaz Taç + 350 coin Gözlük) · `d-7` / `d-8` vitrin ↔ meydan.
Görüntüler sahte oturumlu sınama sayfasından (gerçek bileşen + gerçek karakter GLB'leri; yalnız Supabase cevapları sahte). Canlı sitede şifreyle giriş yapılamadığı için canlı ekran görüntüsü yok.

### iOS Safari
Yeni CSS'te `position: fixed` ve `transform` yok. Önizleme yüksekliği `vh` değil `clamp(280px, 100vw, 440px)`; basılı düğmede `translate` kullanıldı, sabit konumlu bir öğede değil. Gerçek iOS cihaz testi yapılamadı (WebKit kurulu değil).

### Bilinen eksikler
- **Kaydı olmayan yeni oyuncu:** meydan onu tohumdan çiziyor; bu çizim sahip olmadığı rastgele bir kozmetik (ör. güneş gözlüğü) gösterebilir. Vitrin başlangıçta **yalnız sahip olunanları** takılı gösteriyor, kaydedince meydan da aynı oluyor. Kaydetmeden önce iki ekran farklı olabilir.
- **Kozmetik klonu maliyeti:** kozmetik başına 1 çizim çağrısı (A'daki yan bulgu) değişmedi.
- **Atkı, Kanat:** model var, satış kararı (fiyat) sahibinde.
- **Petler ve Alev seti:** meydanda yok, vitrine konmadı.
- **Saç, Elbise, Alt:** vitrinde yalnız "Yakında". Oyuncunun gövdesi hâlâ eski kaydından (ya da tohumdan) geliyor; vitrinden değiştirilemiyor.
