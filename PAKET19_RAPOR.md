# Paket 19 — Canlıda bulunan hatalar (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — kozmetik ekonomisi açıldı | ✅ canlıda · migration 219 uygulandı | `31913f4` |
| B — davet butonu taşması | ✅ canlıda · kök sebep masaüstünde alt menü 540 / içerik 620 | `b83e143` |
| C — vitrinde T-pozu | ✅ canlıda · Idle her kuruluşta anında uygulanıyor + Selam; kalıcı T düzenekte yeniden üretilemedi (ölçüm raporda) | `3c8b4d8` |
| D — Dükkân › Görünüm vitrini | ✅ canlıda · kozmetik kartları (portre + ad + durum), tek WebGL bağlamı, satın alma vitrinde | `ab7b81b` |
| E — geniş ekranda boş alan | ✅ canlıda · kısa sayfa masaüstünde ortada, zemin tüm sayfayı kaplıyor, iOS denetimi temiz | `4784f7e` |
| F — push abonesi sıfır | ✅ canlıda · işaret `_v2`, Profil sebep söylüyor, uçtan uca bildirim geldi | F |

---

## A — Kozmetik ekonomisi açıldı

Migration `20260612000219_kozmetik_bedava_test_kapat.sql`: `oyun_ayarlari.kozmetik_bedava_test = false` (kalıcı, canlıda).

**Doğrulama** — canlı veritabanı, kurucu hesap (644 coin), `authenticated` rolüyle `avatar3d_satin_al`, işlem içinde, **geri alındı**:
- Kurucuda Pelerin zaten vardı. "Zaten sende" hatası ödül kuralını gizlemesin diye ilgili dört sahiplik yalnız bu işlem içinde kaldırıldı.

| Deneme | Sonuç |
|---|---|
| Atkı (400) | ✅ bakiye **644 → 244** |
| Kanat (2.000) | ✅ **"Yetersiz coin"** |
| Taç (ödül) | ✅ **"Bu parça satın alınamaz, yalnız ödül olarak kazanılır"** |
| Pelerin (ödül) | ✅ **"Bu parça satın alınamaz, yalnız ödül olarak kazanılır"** |

İşlem sonrası kontrol: ayar `false` kalıcı, bakiye ve sahiplikler değişmedi.

---

## B — "Davet linkini paylaş" butonu taşıyor görünüyordu

### Kök sebep (ölçüldü)
Butonun kendisi kartın dışına **taşmıyor**. Arkadaşlar ve Profil › Davet sekmesinde, masaüstü, iPhone ve tablette buton kartın iç kenarına tam oturuyor.

Asıl sorun **sabit alt menünün içerikten dar olması**:
- `src/styles.css` 1024 px ve üstünde `.app`'i **620 px**'e genişletiyor (masaüstü kararı).
- `.tabbar` ise `max-width: 540px`'te kalmış.
- Masaüstünde içerik 451–1071, alt menü 491–1031 → **her yanda 40 px**.
- Sayfa yukarıdayken davet butonu alt menünün arkasına düşüyor. Butonun menüden geniş kısmı iki yanda **turuncu blok** olarak görünüyor; kartın kenarları da menünün iki yanından çıkıyor. "Buton kartı aşıyor" görüntüsü buydu.
- Telefonda ve tablette `.app` ile menü aynı genişlikte (390 / 540) olduğu için sorun yalnız 1024 px ve üstünde.

### Düzeltme
`src/styles.css` › iki masaüstü kırılma noktasında `.tabbar { max-width: 620px; }`. Buton, kabartma, `translateY`, turuncu vurgu **değişmedi**.

### Aynı hata başka yerde
Taramada 540'ta kalan bir sabit öğe daha çıktı: maç ekranının joker çubuğu (`body.bd-oyun-modu .bd-joker-cubuk`). Üstelik o kuralda `position: fixed` ile `transform` aynı öğede. Ancak `tema.css` o öğeyi zaten akışa alıyor (`position: static; transform: none; max-width: none`), yani canlıda etkisiz. Dokunulmadı.

### Ölçüm (`getBoundingClientRect`, px, sol–sağ)

| Ekran | Sayfa | Kart | Buton | Buton kartın içinde | `.app` | Alt menü önce | Alt menü sonra | Menü farkı önce → sonra | Yatay taşma |
|---|---|---|---|---|---|---|---|---|---|
| Masaüstü 1522×784 | Arkadaşlar | 463–1059 | 475–1047 | ✅ | 451–1071 | 491–1031 | **451–1071** | 40 → **0** | 0 |
| Masaüstü 1522×784 | Profil › Davet | 463–1059 | 475–1047 | ✅ | 451–1071 | 491–1031 | **451–1071** | 40 → **0** | 0 |
| iPhone 390×844 | Arkadaşlar | 12–378 | 24–366 | ✅ | 0–390 | 0–390 | 0–390 | 0 → 0 | 0 |
| iPhone 390×844 | Profil › Davet | 12–378 | 24–366 | ✅ | 0–390 | 0–390 | 0–390 | 0 → 0 | 0 |
| Tablet 800×1000 | Arkadaşlar | 142–658 | 154–646 | ✅ | 130–670 | 130–670 | 130–670 | 0 → 0 | 0 |
| Tablet 800×1000 | Profil › Davet | 142–658 | 154–646 | ✅ | 130–670 | 130–670 | 130–670 | 0 → 0 | 0 |

Kartın iç boşluğu 12 px; buton her ekranda kartın iç kenarından 12 px içeride.

**Sınama düzeneği:** `.tmp/p19/kabuk/` — gerçek `Layout`, sayfalar ve global stiller (`styles.css` + `tema.css` + `koyu.css`, `temaBaslat`), yalnız Supabase cevapları sahte. Ölçüm betiği `.tmp/p19/b_son.mjs` (önce: değişiklik stash'lenip aynı betik).

Görseller: `gorsel/paket19/b-1-once-masaustu-menu.jpg` (menü dar, kart kenarları iki yanda) ↔ `b-2-sonra-masaustu-menu.jpg`.


---

## C — Vitrinde T-pozu

### Ölçüm (tahmin değil)
Paketteki tespit ("`goster()` hiç klip vermiyor") **koddan doğrulanmadı**:
- `goster()` → `MeydanAvatarlari.kur` → `#govdeTak` → `ks.klip(karakter, "Idle")` zaten çağrılıyordu.
- Canlıdaki paket (`vitrinSahne-SPec7o9B.js`, indirilip okundu) depodakiyle aynı.

Sınama düzeneğinde (gerçek `Layout` + vitrin, geliştirme ve **üretim derlemesi** ayrı ayrı) canlı önizleme karakterine kanca takılarak ölçüldü:

| Ölçüm | Değer |
|---|---|
| Canlı önizlemede aktif klip | `Idle`, ağırlık 1,00 |
| Karıştırıcı zamanı (1 sn arayla) | 3,37 → 4,39 (ilerliyor) |
| Sol kol kemiği (dönüş, q.z) | 0,534 (bağlanma pozuna göre ~64° aşağıda) |
| Yeni kurulmuş karakter, hiç güncellenmeden | **`[0, 0, 0, 1]` = bağlanma pozu (kollar yatay, T)** |
| `klip("Idle")` zamansız çağrıdan hemen sonra | `[0, 0, 0, 1]` — **poz ancak ilk karıştırıcı güncellemesinde gelir** |
| `klip("Idle", 0)` zamanlı çağrıdan hemen sonra | `[-0,047, -0,117, 0,523, 0,843]` — poz **hemen** uygulanır |

**Sonuç:**
- Karakter her yeniden kurulduğunda (tür seçimi, kozmetik tak/çıkar) döngü bir kare ilerletene kadar **T-pozunda**. Bu aralıkta çizilen her kare T gösterir; portre döngüsünün `ciz()` çağrısı da bu aralıkta çizebiliyordu.
- **Kalıcı** T-pozu ise ne geliştirme ne üretim düzeneğinde yeniden üretilebildi: üç türde de `Idle` oynuyor, kollar aşağıda (önce görselleri).
- Canlıda kalıcı görüldüyse sebebi bu ölçümlerin dışında. Olası bir açıklama da `Idle`'ın kendisinin çok az hareketli olması: bacaklar açık, kollar hafif yanda duran "manken" duruşu.

### Düzeltme (`bildim/vitrin/vitrinSahne.js`, `KarakterVitrini.jsx`)
- `goster()` **her çağrıda** `Idle`'ı **zamanla** bağlıyor (`klip(k, "Idle", 0)` → `mixer.update(0)`). Karakter kurulduğu anda doğru pozda, T karesi yok.
- **Selam (isteğe bağlı madde, eklendi):**
  - İlk açılışta Idle; oyuncu **tür seçince ya da kozmetik takınca/çıkarınca** bir kez `Selam` (tek sefer, sonunda donar), bitince 0,35 sn geçişle `Idle`.
  - Ölçüldü, tür değişince 0,4 sn aralıkla aktif klipler: `Selam ×5 → Idle 0,9 → Idle 1,0 …`.
  - **Maliyet:** aynı karıştırıcıda klip değişimi; ek çizim çağrısı, ek mesh, ek doku yok.
- **Kart portreleri değişmedi:** hepsi aynı sabit pozda (`Idle` @0,3).

Görseller:
- Önce: `gorsel/paket19/c-1-once-insan.jpg`, `c-2-once-kaplan.jpg`, `c-3-once-robot.jpg`.
- Sonra: `c-4-sonra-insan.jpg`, `c-5-sonra-kaplan.jpg`, `c-6-sonra-robot.jpg`, `c-7-sonra-robot-selam.jpg` (tür seçince Selam).
- Not: önce/sonra durağan görüntüler birbirine benziyor, çünkü düzenekte kalıcı T-pozu zaten yoktu. Fark kurulum anındaki ilk karede, yukarıdaki tabloda.

Betikler: `.tmp/p19/c_kanca.mjs`, `c_dogrula.mjs`, `c_poz.mjs`, `c_selam.mjs`.

---

## D — Dükkân › Görünüm artık kozmetik vitrini

### Yapılan
- **Yeni `bildim/vitrin/GorunumVitrini.jsx`**, Dükkân › Görünüm sekmesinde tek "Karakterim" satırının yerine geçti.
  - `vitrin_katalogum()`'daki bütün kozmetikler kart olarak listeleniyor: **oyuncunun kendi karakteri (kendi türü) üstünde portre + ad + durum**.
  - Durum dili vitrinle aynı: **fiyat** (turuncu, `2.000 coin` binlik ayraçlı), **"Sahipsin"** rozeti, **"Satılmaz · turnuva ödülü"** kilidi, **"Yakında"** kilidi.
  - Karta dokununca `/gorunum` vitrinine gider. Altta "Karakterime git" düğmesi.
- **Yeni satın alma yolu yok:** sekmede satın alma düğmesi 0 (ölçüldü). Satın alma yalnız vitrinde.
- **Tek renderer:** `vitrinSahne.js`'e `canli: false` kipi eklendi. Tuval sayfaya eklenmiyor, döngü dönmüyor, yalnız portre makinesi. Kart başına yeni WebGL bağlamı açılmıyor.
- **Stil:** `.app a` kuralının altı çizili bağlantı stili kartlara geçiyordu; aynı özgüllükle ezildi (`.bd-profil-hatalarim` ile aynı desen). Kartlar basınca `translate 4px` (Şenlik).

### Doğrulama (kabuklu düzenek, gerçek Layout + Dükkân)

| Ölçüm | Masaüstü 1522×784 | iPhone 390×844 |
|---|---|---|
| Açılan WebGL bağlamı (`getContext` kancası) | **1** | **1** |
| Sayfadaki `<canvas>` | 0 | 0 |
| Kartlar | 10 (7 portreli + 3 Yakında) | 10 |
| Sekmedeki satın alma düğmesi | 0 | 0 |
| Kart bağlantı hedefi | `/bildim/gorunum` (uygulamada `y()` önekini çözüyor) | aynı |
| Yatay taşma | 0 | 0 |

Kart durumları (sahte katalog: şapka + atkı sahip): Şapka → Sahipsin · Gözlük → 350 coin · Güneş gözlüğü → 450 coin · Taç → Satılmaz · Pelerin → Satılmaz · Atkı → Sahipsin · Kanat → 2.000 coin · Saç / Elbise / Alt → Yakında.

Görseller: `gorsel/paket19/d-1-dukkan-gorunum-masaustu.jpg`, `d-2-dukkan-gorunum-iphone.jpg`. Tam sayfa görüntülerinde alt menünün ortada durması ekran görüntüsü birleştirmesinden, sayfada değil. Masaüstü görüntüsünün altındaki zemin rengi değişimi E'nin konusu.

---

## E — Geniş ekranda boş alan / zemin

**Ölçüm (önce)** — kabuk düzeneği (gerçek Layout + global CSS), 1522×784 ve 390×844:
- Masaüstü Düello: içerik 410 px'te bitiyor, alt menüye kadar ~300 px boş (`e-once-masaustu-duello.jpg`). `.app` 620 px ve `.sayfa { flex: 1 }` alanı zaten dolduruyordu; içerik o alanın üstüne yapışıktı.
- Zemin: `body` degradesi `background-attachment: fixed` ile çiziliyor. iOS Safari `fixed`'i yok sayar → degrade ekran boyunda **tekrar eder**, uzun sayfada krem → gök mavisi keskin geçiş (D görüntüsünün altında görülen).

**Düzeltme** (`.app` genişliği 620 değişmedi):
1. `src/styles.css` (≥1024 px): `.sayfa { display:flex; flex-direction:column; justify-content: safe center; }` — kısa sayfa dikeyde ortalanır; `safe` sayesinde uzun sayfa üstten başlar, yukarı kesilmez. Telefon düzeni değişmedi.
2. `bildim/styles/tema.css` `body`: zemin rengi `--bd-zemin-2` + degrade `no-repeat` — degrade bittiği yerde aynı krem renkle kesintisiz sürer; masaüstünde (fixed çalışıyor) görünüm aynı.

**Ölçüm (sonra)**

| Ekran | Sayfa | İçerik altı | Alt menü üstü | Sayfa yüksekliği | Yatay taşma |
|---|---|---|---|---|---|
| Masaüstü | Ana Sayfa | 1222 | 719 | 1316 (kayıyor, üstten başlıyor) | 0 |
| Masaüstü | Düello | ortalı (başlık 230 → kart 540) | 719 | 784 | 0 |
| Masaüstü | Dükkân | 1210 | 719 | 1304 | 0 |
| Masaüstü | Görünüm | 2176 | 719 | 2270 | 0 |
| iPhone | Ana Sayfa | 1220 | 779 | 1314 | 0 |
| iPhone | Düello | 750 | 779 | 844 | 0 |
| iPhone | Dükkân | 1556 | 779 | 1650 | 0 |
| iPhone | Görünüm | 2247 | 779 | 2341 | 0 |

**iOS denetimi** (Paket 18 E listesi; 5 sayfa × 2 ekran, 700 px kaydırma): sabit/yapışkan öğeler `div.bd-ust-blok` (sticky) + `nav.tabbar` (fixed). Hepsinde **yatay taşma 0**, kaydırınca ikisi de **yerinde**; `fixed` öğede transform yok, fixed öğenin atalarında transform/filter/perspective yok.
- Not: `.bd-ust-blok` üzerinde `transform: translateZ(0)` var (tema.css "kompozisyon katmanı" kuralı, eskiden beri). Öğe **sticky**, fixed değil; içinde fixed çocuk yok (toast `position: relative`). Kural (fixed + transform aynı öğede) ihlal edilmiyor; dokunulmadı. İlk denetim çıktısı bunu yanlışlıkla "fixed + transform" diye etiketliyordu, betik düzeltildi.
- WebKit bu makinede çalışmadığı için (Paket 18 E) denetim Chromium iPhone görünümünde.

Görseller (`gorsel/paket19/`): `e-once-*` / `e-sonra-*` × `masaustu|iphone` × `ana|duello|dukkan|gorunum`.

---

## F — Push abonesi hâlâ sıfır

### F.1 Ölçüm

**Kart ne zaman çıkıyor** (`bildim/components/BildirimIzniSor.jsx`, Paket 17 §B hali):
| Koşul | Değer |
|---|---|
| Nerede | Yalnız maç **sonuç** ekranı: Normal Maç (`MatchPage`), Düello (`DuelloPage`), Hızlı Mod (`HizliModPage`). Başka giriş yok (Profil › Bildirimler hariç) |
| Tarayıcı | `serviceWorker` + `PushManager` + `Notification` var olmalı; yoksa iPhone Safari sekmesinde bir kez "ana ekrana ekle" ipucu (`bildim_bildirim_ios_ipucu`), diğerlerinde hiçbir şey |
| İzin | `Notification.permission === "default"` (verilmiş ya da reddedilmişse kart çıkmaz) |
| localStorage işareti | **`bildim_bildirim_sorma`** yoksa. Paket 17 öncesi kod bunu teknik hatada da koyuyordu → o tarayıcılarda kart kalıcı olarak kapalı |

**Canlı veri** (17 Eyl, Paket 17 B yayını 14:07 TSİ):
- `push_subscriptions`: **0**.
- Yayından sonra biten maç: Normal **0**, Düello **0**, Hızlı Mod **0** (son biten maçlar 12:47 ve 13:21 TSİ, yayından önce). Yeni kartın tek tetikleyicisi olan sonuç ekranını yayından beri **hiç kimse görmedi**; "düzeltme işe yaramadı" değil, henüz hiç denenmedi.
- Sunucu tarafı sağlam: `save_push_subscription` / `remove_push_subscription` security definer, EXECUTE yalnız `authenticated` (+ postgres/service_role).
- Profil › Bildirimler kartı, push desteklenmeyen tarayıcıda (iPhone Safari sekmesi) **tamamen gizliydi**, engelli/kapalı durumda sebep söylemiyordu ("Kapalı").

### F.2 Düzeltme
1. **İşaret sürümlendi:** `bildim_bildirim_sorma` → **`bildim_bildirim_sorma_v2`**. Eski anahtar okunmaz (silinmez). Eski işaretli her tarayıcı kartı bir kez daha görür; "Şimdi değil" / red / başarı yeni anahtarı koyar, sonra bir daha çıkmaz. iOS ipucu anahtarı değişmedi (o kart hatadan etkilenmiyordu).
2. **Profil › Ayarlar › Bildirimler** artık her tarayıcıda görünür ve kapalıysa nedenini söyler (TR + EN):

| Durum | Metin | Düğme |
|---|---|---|
| Henüz sorulmadı | Kapalı — henüz izin verilmedi. Aç'a dokun, tarayıcı izin isteyecek. | Aç |
| İzin var, bu cihaz abone değil | Kapalı — izin var ama bu cihaz bağlı değil. Aç'a dokun. | Aç |
| Engelli | Kapalı — tarayıcı ayarlarından engellenmiş. Açmak için adres çubuğundaki site ayarlarından bildirimlere izin ver. | yok |
| iPhone Safari sekmesi | Kapalı — iPhone'da bildirimler yalnız ana ekrandaki uygulamada çalışır. Paylaş → Ana Ekrana Ekle, sonra oradan aç. | yok |
| Diğer desteklemeyen tarayıcı | Kapalı — bu tarayıcı bildirimleri desteklemiyor. | yok |

3. `iosSekmesi()` kart bileşeninden `lib/push.js`'e taşındı (iki yer aynı denetimi kullanıyor). Profil'deki `pushDurumu()` artık hatayı konsola yazıyor (eskiden yakalanmamış söz).

### F.3 Doğrulama (Playwright, gerçek Chrome, gerçek FCM, canlı Supabase)

**Temiz profil** (`.tmp/p19/push/uctan_uca.mjs`, yeni tarayıcı profili):
| Adım | Sonuç |
|---|---|
| Sonuç ekranında kart | ✅ göründü (`f-1`) |
| İzin → "Bildirimleri aç" | ✅ "Bildirimler açık" (`f-2`); `bildim_bildirim_sorma_v2 = 1` |
| Bileşenin RPC çağrısı | ✅ `save_push_subscription` (FCM endpoint, p256dh 87, auth 22 kr) |
| Canlı DB'ye `save_push_subscription` (authenticated, kurucu jwt) | ✅ `push_subscriptions`'ta 1 satır |
| `push_gonder` → `send-push` | ✅ `200 {"basarili":1,"basarisiz":0}` |
| Bildirim | ✅ service worker gösterdi: "🧪 Quiz Tactics push sınaması" (`f-3`) |
| Temizlik | ✅ test aboneliği silindi, tablo **0** |

**Eski işaretli profil** (`.tmp/p19/push/eski_isaret.mjs`, `bildim_bildirim_sorma = 1`):
| Adım | Kart | `_v2` |
|---|---|---|
| 1) İlk sonuç ekranı | ✅ **görünür** (`f-4`) | yok |
| 2) "Şimdi değil" | kapandı | 1 |
| 3) Sayfa yenilendi | ✅ **yok** | 1 |
| 4) Başka sonuç ekranı | ✅ **yok** (`f-5`) | 1 |

Konsol hatası: 0. **Profil kartı** (kabuk düzeneği, 390×844): dört durumun metni ve düğmesi yukarıdaki tabloyla birebir (`f-6` sorulmadı, `f-7` izin var/abone yok, `f-8` engelli, `f-9` iPhone sekmesi).

**Sınır:** canlı sitede gerçek oturumla deneme yok (şifre girilmez); zincirin her halkası canlı bileşenle ayrı denendi. Gerçek iPhone yok. Abone sayısı ancak oyuncular maç bitirince artar — bugün yayından beri biten maç 0.

Görseller: `gorsel/paket19/f-1 … f-9`.
