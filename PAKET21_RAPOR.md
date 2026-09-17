# Paket 21 — Muayene gerçek kalite kapısına dönüşsün (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — muayene kapsamı: kodla çizilen parçalar | ✅ taç + pelerin muayenede | `6dc600b` |
| B — yeni test: yuva oturması | ✅ şapka · taç · pelerin üç türde de yakalanıyor | `4aceff3` |
| C — yeni test: açık kenar / delik | ✅ şapkanın altı, taç, pelerin, vizör, kuyruk ucu | `fb0ca18` |
| D — yeni test: kalınlık | ✅ 14 kanat tüyü (1,4 cm) yakalandı; eşik iki kez ölçülerek düzeltildi | `a869f3a` |
| E — takılı poz + portre kadrajı | ✅ 22 takılı poz + 21 kart; atkı kadrajı düzeltildi | `1629bb2` |
| F — çıkan adayları düzelt | ✅ kozmetiklerde 0 aday, düzeltmeler geometride | `6c8a66a` · `d686b59` · `a91a19c` |
| G — raporlama kuralı | ✅ muayene KAPSAM bloğu basıyor, kural CLAUDE.md'de | `61a2467` |

---

## A — Muayene kapsamı: kodla çizilen parçalar da girdi

**Ölçülen sorun:** taç ve pelerin `meydanAvatar.js` içinde çalışma anında kodla üretiliyordu; muayene yalnız `public/meydan/deneme/*.glb` dosyalarına bakıyordu. Sahibinin en çok şikâyet ettiği iki parça **hiç denetlenmemişti**.

**Yapılan:**
- Taç ve pelerin geometrisi + yerleşim matrisi `bildim/harita/karakter/ekKozmetik.js`'e ayrıldı. **Tek kaynak, üç tüketici:** oyun (`meydanAvatar.js` paylaşımlı InstancedMesh), dışa aktarım, muayene. Oyunun yerleşimi ile muayenenin ölçtüğü yerleşim artık aynı fonksiyondan (`ekMatris`) geliyor.
- `bildim/harita/muayene/takili.mjs` kod kozmetiklerini GLB'ye yazıyor (`muayene/uretilen/kozmetik_tac.glb`, `kozmetik_pelerin.glb`), atlas dokusunu oyundaki atlasa bağlayarak (yeni doku yok).
- `npm run muayene` **her koşuda önce bu GLB'leri yeniden üretiyor** → bayat dosya muayene edilemez. Varsayılan varlık listesine (`calistir.mjs › TUM`) eklendiler; kendi üstverileri `ustveri/kozmetik_tac.json`, `kozmetik_pelerin.json`.
- Eşikler koda gömülmedi: `ustveri/_esikler.json` (her eşiğin gerekçesiyle).

**Taşımanın görünümü değiştirmediği ölçüldü:** vitrin ızgarası (8 kozmetik × 3 tür × 2 kadraj) taşımadan önce/sonra çekildi; zamandan bağımsız bütün kareler (şapka, gözlükler, atkı, **taç**) **piksel farkı 0**. Yalnız kanat çırpması ve pelerin salınımı (ikisi de `sin(zaman)`) farklı kare yakaladı.

**İlk sonuç (A'dan hemen sonra, eski geometri):** `kozmetik_tac` 4 aday · `kozmetik_pelerin` 2 aday — hepsi §C'nin açık kenar testinden (aşağıda).

---

## B — Yeni test: `oturma` (yuva oturması)

**Neden gerekti (ölçüldü):** eski `havada` testi temas için **5 mm içinde TEK köşe** arıyordu. `karakter_insan`: 55 ada, **hepsi bağlı, 0 bağsız grup** — şapkanın tek bir köşesi kafaya değdiği için şapka "bağlı" sayılıyordu; aradaki boşluk hiç ölçülmüyordu.

**Ne ölçüyor:** kozmetiğin **gövdeye bakan yüzeyi** (köşe normali gövdeye dönük, gövdeye ≤ `oturma_arama_m` = 8 cm) için
- temas eden köşe oranı (≤ `oturma_temas_m` = 6 mm) ve
- medyan boşluk.

**Aday:** temas oranı < `oturma_temas_orani` (**%15**) **ya da** medyan boşluk > `oturma_bosluk_m` (**2 cm**). Tek köşe teması artık yetmiyor.

**Nerede çalışıyor:** takılı poz varlıklarında (§E.1) — tür × kozmetik, `Idle`, sözleşme uygulanmış, **üç saç varyantının hepsinde** (en kötü varyant karar verir).

**Tanımda ölçerek düzeltilen iki nokta (ilk sürüm yanlış sayıyordu):**
1. **Dışa bakan yüzey sayılmamalı.** Atkının/gözlüğün dış yüzü gövdeye zaten değemez; sayılınca medyan boşluk şişiyordu. Artık yalnız normali gövdeye dönük köşeler.
2. **Gövdenin içine giren köşe temas etmiştir.** Gözlük sapı kafanın içinde, kanat koşumu sırtın içinde: yüzeye uzaklıkları "boşluk" diye sayılınca kanat yanlışlıkla aday oluyordu (medyan 1,6 cm → 0,0 cm; %28 → %73 temas). Artık gömülü köşe temas sayılıyor ve ayrıca `gomulu_kose` / `en_derin_gomulme_m` olarak raporlanıyor (düzeltmeler gövdeye batmasın diye).

**ÖNCE — oturma ölçümü (saç 1; üç varyantın en kötüsü karar verir):**

| tür | kozmetik | gövdeye bakan köşe | temas | oran | medyan boşluk | gömülü köşe | sonuç |
|---|---|---|---|---|---|---|---|
| insan | şapka | 56 | 6 | %11 | 2,5 cm | 0 | **ADAY** |
| insan | gözlük | 141 | 22 | %16 | 3,3 cm | 6 | **ADAY** (medyan) |
| insan | güneş gözlüğü | 145 | 29 | %20 | 2,6 cm | 19 | **ADAY** (medyan) |
| insan | atkı | 62 | 15 | %24 | 2,3 cm | 8 | **ADAY** (medyan) |
| insan | kanat | 95 | 69 | %73 | 0,0 cm | 56 | geçti |
| insan | **taç** | 18 | 0 | **%0** | **4,2 cm** | 0 | **ADAY** |
| insan | **pelerin** | 10 | 5 | %50 | **4,9 cm** | 3 | **ADAY** |
| kaplan | şapka | 85 | 4 | %5 | 2,9 cm | 4 | **ADAY** |
| kaplan | gözlük | 133 | 20 | %15 | 4,5 cm | 8 | **ADAY** |
| kaplan | güneş gözlüğü | 145 | 19 | %13 | 4,2 cm | 8 | **ADAY** |
| kaplan | atkı | 68 | 21 | %31 | 1,8 cm | 14 | geçti |
| kaplan | kanat | 88 | 67 | %76 | 0,0 cm | 60 | geçti |
| kaplan | **taç** | 22 | 0 | **%0** | **6,9 cm** | 0 | **ADAY** |
| kaplan | **pelerin** | 8 | 0 | **%0** | **4,7 cm** | 0 | **ADAY** |
| kaplan | kuyruk | 6 | 3 | %50 | **6,2 cm** | 0 | **ADAY** |
| robot | şapka | 69 | 9 | %13 | 5,8 cm | 1 | **ADAY** |
| robot | gözlük (vizör) | **0** | 0 | %0 | — | 0 | **ADAY** — gövdeye bakan köşe yok, en yakın köşe **4,7 cm** |
| robot | güneş gözlüğü | 139 | 6 | %4 | 4,3 cm | 6 | **ADAY** |
| robot | atkı | 86 | 12 | %14 | 3,9 cm | 6 | **ADAY** |
| robot | kanat | 43 | 5 | %12 | 6,4 cm | 5 | **ADAY** |
| robot | **taç** | **0** | 0 | %0 | — | 0 | **ADAY** — en yakın köşe **10,1 cm** |
| robot | **pelerin** | 4 | 0 | %0 | 4,0 cm | 0 | **ADAY** |

**Paketin şartı karşılandı:** test bugünkü **şapka, taç ve pelerini üç türde de yakalıyor** — eşik değiştirmeye gerek kalmadı (yalnız yukarıdaki iki tanım düzeltmesi yapıldı, ikisi de ölçümle gerekçelendirildi).

---

## C — Yeni test: `acik_kenar` (delik)

**Ne ölçüyor:** manifold denetimi — her kenar tam 2 üçgene ait olmalı. 1 üçgene ait kenarlar açık kenardır; birbirine bağlı olanlar bir **delik döngüsü** oluşturur. Döngü noktaları en küçük varyanslı düzleme izdüşürülüp (PCA) açıya göre sıralanır, çevrelediği alan shoelace ile hesaplanır.
**Aday:** alan > `acik_kenar_alan_m2` = **0,0004 m²** (2 × 2 cm). `acik_kenar_izinli` beyanı (gerekçeli) susturur.

**ÖNCE — bulunan delikler:**

| parça | delik | alan | ne demek |
|---|---|---|---|
| şapka (3 tür) | 1 döngü | **0,10 m²** (kubbe ağzı) | şapkanın **altı açık** — içi görünüyor (sahibin şikâyeti) |
| taç (3 tür + kod GLB'si) | 4 döngü | 0,069 · 0,080 · 0,091 · 0,104 m² | halka iki ayrı kabuk (dış + iç), üstü ve altı hiç kapanmamış |
| pelerin (3 tür + kod GLB'si) | 2 döngü | **0,54 m²** × 2 | iki ayrı levha — hacim yok, kenarları açık |
| güneş gözlüğü camı | 2 döngü | 0,012 m² × 2 | cam düz disk (tek yüz) |
| robot vizörü | 3 döngü | 0,019 · 0,0006 · 0,0006 m² | bant açık silindir; iç yüzü görünür |
| kaplan kuyruğu | 2 döngü | 0,0050 · 0,0048 m² | tüp uçları kapatılmamış |

Kozmetik dışındaki varlıklarda (karakter gövdesi, bina, proplar) bu test **çalıştırılmadı** — kapsam §G'de açıkça yazılı.

---

## D — Yeni test: `kalinlik` (kâğıt gibi duran parçalar)

**Ne ölçüyor:** ada başına temel eksenler (PCA kovaryans + Jacobi): en kısa uzanım, en uzun uzanım, yassılık oranı ve **izdüşüm alanı** (üçgenler en kısa eksene dik düzleme izdüşürülür, iki yüz sayılmaz).
**Aday:** en kısa uzanım < `kalinlik_asgari_m` = **2,5 cm** **ve** izdüşüm alanı > `kalinlik_alan_m2` = **0,02 m²**.

**Paketteki öneri ölçülerek değiştirildi (iki kez):**
1. **Oran (0,02) kuralı kanadı kaçırıyordu:** kanat tüyü 1,4 cm kalınlığında ama 28–46 cm uzun → oran 0,03–0,05, eşiğin üstünde. Ölçüt **mutlak kalınlığa** çevrildi.
2. **Yüzey alanı yanlış alarm veriyordu:** gözlük çerçevesi (2,2 cm kalınlığında ince halka) yüzey alanı 0,0246 m² ile eşiği geçiyor, "kâğıt" sanılıyordu. Ölçüt **izdüşüm alanına** çevrildi: halka 0,0082 m² (eşik altı, temiz), kanat tüyü 0,031–0,051 m² (eşik üstü, aday).

**ÖNCE — sonuç:** tür başına **14 tüy adası**: en kısa uzanım **1,4 cm**, en uzun 28–46 cm, izdüşüm alanı 0,031–0,051 m² → "hacimsiz levha". Üç türde de aynı (kanat insan modelinden paylaşılıyor).
Kâğıt gibi durup da yakalanmayan tek şey **pelerin**: kavisli olduğu için en kısa uzanımı 4,5 cm çıkıyor — ama **hacmi hiç yok** ve §C onu 0,54 m²'lik açık kenarla zaten yakalıyor.

---

## E — Takılı poz muayenesi + `portre_kadraj` testi

**E.1 — Takılı pozlar.** Kozmetikler artık **takılıyken** muayene ediliyor: tür × kozmetik için oyunun kendi kodu
(`kozmetikTak`, `kuyrukTak`, `KarakterSistemi.gorunum`) ile karakter kurulur, `Idle` klibinin 0,3 s'i uygulanır,
`SkinnedMesh.getVertexPosition` ile **pozlu** gövde ve kozmetik GLB'ye yazılır (`muayene/uretilen/takili_<tür>_<kozmetik>.glb`).
22 takılı poz varlığı: insan/kaplan/robot × 7 kozmetik + kaplan kuyruğu. Oturma testi bunların **üç saç varyantında** koşar.

**E.2 — `portre_kadraj`.** Kart portresi oyunun kendi çizim yoluyla (`vitrinSahne › KADRAJ`, `KOZMETIK_KADRAJ`) çizilir ve iki şey ölçülür:
- **Görünen alan** — maske geçişi: kozmetik beyaz, gövde siyah, aynı derinlik; `gl.readPixels` ile beyaz piksel oranı.
  Gövdenin **arkasında** kalan kozmetik sayılmaz (yalnız ekran kutusuna bakmak bunu göremezdi).
- **Taşma** — kozmetiğin ekran-uzayı sınırlayıcı kutusunun kadraj dışında kalan alan oranı.

**Aday:** taşma > `portre_tasma_orani` (%2) **ya da** görünen alan < `portre_asgari_oran` (%4).

**Ölçerek düzeltilen iki hata (ilk sürüm yanlış sayıyordu):**
1. Ekran kutusu, sahnenin dünya matrisleri güncellenmeden hesaplanıyordu; yeni kurulan avatarın matrisi birim kaldığı için
   kutular kadrajın 5 birim altına düşüyor, taşma %100 çıkıyordu.
2. Kaplanın kuyruğu da `kozmetik_` adlı olduğu için **her kaplan satırının** kutusunu şişiriyordu → ölçüm yalnız test edilen kozmetiğe daraltıldı.

**ÖNCE — kart portresi ölçümü (21 kart):**

| bulgu | ölçü | ne yapıldı |
|---|---|---|
| atkı "bas" kadrajında kartın alt kenarında kalıyordu (sahibin şikâyeti: "atkı kartta görünmüyor") | taşma %23 | yeni `govde` kadrajı (boyun–omuz hizası) → taşma %0, görünen alan %8,4–11,4 |
| taç kadrajın tepesinden kesiliyordu | taşma %3 (üç tür) | §F'de taç kafaya oturunca kendiliğinden geçti |
| kanat kartta seçilemiyordu | görünen alan %3,1–3,9 < %4 | §F'de hacim + kanata özel kadraj → eşik üstü, taşma %0 |

Kadraj tablosu tek kaynağa taşındı (`bildim/vitrin/kadraj.js`); iki vitrin ekranı ve muayene aynı tablodan okur.

---

## F — Düzeltmeler (hepsi GEOMETRİDE)

Eşya id'leri (`kozmetik_sapka`, `kozmetik_gozluk`, …) ve yuva adları (`basYuva`, `gozlukYuva`, `boyunYuva`, `sirtYuva`)
**değişmedi**. Tek atlas, tek malzeme; **yeni doku dosyası yok**. Hiçbir aday üstveriyle susturulmadı.

| kozmetik | önce (ölçüm) | ne yapıldı | sonra (ölçüm) |
|---|---|---|---|
| **şapka** | temas %5–13, altı 0,10 m² açık; kubbe kafadan 2,7 cm geniş, merkezi 9 cm yukarıda | türün **gerçek gövde yüzeyine ışınla** kurulan kapalı kabuk (iç + dış yüzey, alt kenar ve tepe bantları); her tür kendi kubbesini alır; siper kafanın ön yüzeyine, kenar halkası kubbenin dış yüzeyine göre | temas %50–87, yaslanma 0,3–0,9 cm, delik yok |
| **taç** | temas %0, 4,2–10,1 cm havada, 4 delik (688–1043 cm²) | kafaya oturan kapalı halka (iç + dış yüzey, üst/alt bant) + kapalı dişler; saç için 2 cm pay; tür ölçeği `ekMatris`'te | temas %21–45, yaslanma ≤ 1,5 cm, delik yok, kartta görünür |
| **pelerin** | temas %0–50, sırttan 4,0–4,9 cm geride, iki hacimsiz levha (0,54 m² × 2 açık kenar) | omuz hattından sarkan **kapalı** kabuk; iç yüzey gövdeyi takip eder, etek aşağıda açılır; `PELERIN_KAYDIR`'ın z ötelemesi kalktı | temas %74–81, yaslanma 0,0 cm, delik yok |
| **kanat** | tür başına 14 tüy adası 1,4 cm kalınlıkta ("kâğıt şerit") | tüy kalınlığı 2,8 cm | kalınlık adayı yok |
| **kaplan kuyruğu** | tüp uçları açık (45 cm² × 2) | yeni `delikleriKapat()` yardımcısı: açık kenar döngüleri merkez köşeyle yelpaze kapatılır | delik yok |
| **premium gözlük** | cam düz disk (tek yüz, 105 cm² × 2 açık kenar) | 6 mm ince mercek (silindir) | delik yok |
| **robot vizörü** | iç yüzeyi yok (gövdeye bakan köşe 0), yüzden 4,7–6,0 cm uzak, 3 açık kenar | yeni `kafayaOturanBant()`: yüze ışınla oturan kapalı kabuk; üst/alt çerçeveler de aynı bantla | temas %50, yaslanma 0,6 cm, delik yok |
| **gözlük / atkı** | medyan boşluk ölçütüyle aday görünüyordu | geometri değişmedi; ölçüt düzeltildi (aşağıda) | temas %40–58, yaslanma 0,3–0,9 cm |

**`oturma` ölçütü üçüncü kez ölçülerek düzeltildi.** 8 cm'lik arama yarıçapı şapka siperini, gözlük camını ve kanat
tüyünü de "gövdeye bakan yüzey" sayıyordu; bunlar tasarımı gereği havadadır. Kaplan şapkasında kubbe %46 temas /
1,2 cm iken siper %0 / 2,3 cm olduğu için **toplam** "havada" çıkıyordu. Yeni tanım:
- **yaslanması beklenen bölge** = gövdeye **2 cm**'den yakın, gövdeye bakan yüzey (`oturma_arama_m` 0,08 → 0,02),
- **yaslanma** = o bölgenin gövdeye en yakın **çeyreğinin medyanı** ≤ `oturma_yaslanma_m` (8 mm),
- temas oranı ≥ %15 ölçütü duruyor; medyan boşluk ölçütü kalktı (arama yarıçapı zaten 2 cm).

Tamamen kopuk kozmetik hâlâ yakalanıyor: bu bölgede **hiç köşe yoksa** aday ("yakın yüzey yok") — eski taç
(4,2–10,1 cm) ve eski pelerin (4,0–4,9 cm) tam olarak buna düşüyordu.

**Testler arası çelişki ölçüldü ve geometriyle çözüldü:** `oturma` temas ister (6 mm), `kozmetik` testi ise bağlama
pozunda gövdeyle **üçgen kesişimi** istemez. Arada kalan pencere, kubbenin çokgen kirişinin sapması kadar dardır
(12 kenar bölümünde ~8 mm). Çözüm kenar bölümünü artırmak (12 → 16, robotta 20) ve payı türe göre ölçmek oldu:
robot kafası basık ve ekran yüzü öne çıkık olduğundan robot kubbesi daha yukarıda biter.

### Bütçe — 3A-2 ölçüm rig'iyle önce/sonra

Sahne: `bildim/harita/olcum/meydan-test` üretim derlemesi + `?otomasyon=1`, `katman2c.js`; İstiklal ucu en kötü açı,
**25 karakter**, 1536×791, piksel oranı 1, gölge açık, 120 kare ısınma + 300 örnek (medyan / p95).

| ölçü | ÖNCE (Paket 21 öncesi geometri) | SONRA | fark |
|---|---|---|---|
| çizim çağrısı (hepsi kozmetikli, sınır 99) | 153 | 153 | **0** |
| üçgen (hepsi kozmetikli) | 478.933 | 479.347 | +414 (%0,09) |
| CPU gönderimi (medyan / p95) | 5,2 / 5,7 ms | 5,1 / 6,0 ms | ölçüm gürültüsü içinde |
| kare CPU+GPU (medyan / p95) | 5,9 / 6,4 ms | 5,8 / 6,8 ms | ölçüm gürültüsü içinde |
| çizim çağrısı · üçgen (sınır 8, oyun varsayılanı) | 134 · 358.877 | 134 · 359.291 | +414 |

Kozmetik üçgenleri: insan şapkası 598 → 524, robot şapkası 424 → 588, robot vizörü 84 → 300, premium gözlük
516 → 600, kuyruk 272 → 312, kanat 364 (değişmedi), taç 50 → 110, pelerin 48 → 164. Hepsi 600 üçgenlik kozmetik
bütçesinin (kanat için 1200) altında. **GPU zamanlayıcısı (`EXT_disjoint_timer_query_webgl2`) bu makinede headless
Chrome'da yok**, o yüzden ayrı GPU sütunu verilmedi; "kare" sütunu `gl.finish` ile CPU+GPU'yu birlikte ölçer.

### Gövde, iskelet ve atlas değişmedi (kanıt)

`uret.mjs` yeniden üretimi sonrası eski (03a7ee7) ve yeni GLB karşılaştırıldı — `Govde` köşe dizisinin SHA-1'i ve kemik sayısı:

| tür | gövde köşe | gövde hash (önce → sonra) | kemik |
|---|---|---|---|
| insan | 4192 → 4192 | `fc30d273d9b1` → `fc30d273d9b1` | 22 → 22 |
| kaplan | 4133 → 4133 | `9c2ed827f8ee` → `9c2ed827f8ee` | 22 → 22 |
| robot | 4039 → 4039 | `41b391015512` → `41b391015512` | 22 → 22 |

`public/meydan/deneme/atlas.png` ve `varlik/atlas.mjs` bu pakette **hiç değişmedi** (git farkı boş).

### Düzeltilemeyenler — dürüst liste

- **Ayakkabı, saç ve yüz tasarımı yapılmadı.** Sahibinin "ayakkabılar tahta blok gibi" gözlemi bir **tasarım**
  sorunudur; muayene bunu ölçmez ve bu pakette ayakkabı/saç/yüz geometrisine dokunulmadı.
- **Kozmetik dışı 8 aday duruyor:** `bina_dukkan` 4 (havada 3 + simetri 1), `prop_lamba` 2, `prop_bank` 1,
  `prop_agac_govde` 1 — hepsi `havada`/`simetri`, Paket 21 öncesinden geliyor ve kozmetik kapsamı dışında.
- **Şapka takılıyken saç geometrisi duruyor.** Kubbe en kabarık saç varyantına göre kurulduğu için en ince
  varyantta birkaç milimetre boşluk kalır; bu boşluk şapkanın altındadır, dışarıdan görünmez (ölçüldü, eşik içinde).

---

## G — Raporlama kuralı değişti

`npm run muayene` artık koşunun sonunda **KAPSAM** bloğunu basıyor ve `cikti/ozet.json › kapsam` alanına yazıyor:

1. hangi testler hangi **eşiklerle** çalıştı (eşikler `ustveri/_esikler.json`'da, koda gömülü değil),
2. hangi varlıklar muayene **edildi** ve hangileri **edilmedi** (seçimli koşuda atlananlar adıyla),
3. hiç kapsanmayanlar: harita yerleşimi (Boğaz, cepheler, yapılar) ayrı komutla denetlenir; ışık, gölge, animasyon hiç ölçülmez,
4. **muayenenin ölçemedikleri:** estetik, oran, stil, renk uyumu.

Aynı kural `bildim/harita/CLAUDE.md`'ye yazıldı: bir muayene sonucu hiçbir yerde tek başına "0 aday" diye yazılamaz.
**0 aday = "bu testlerden geçti", "güzel oldu" değil.** Görsel yargı sahibinindir.

---

## SONUÇ — sonra taraması

Tam koşu (`npm run muayene`): **37 varlık + 21 kart portresi**.

- 3 karakter GLB'si (gövde + takılı kozmetik kesişimi) — **0 aday**
- 2 kod kozmetiği GLB'si (taç, pelerin) — **0 aday**
- 22 takılı poz (tür × kozmetik, Idle, 3 saç varyantı) — **0 aday**
- 21 kart portresi (`portre_kadraj`) — **0 aday**
- kozmetik dışı varlıklar (bina + proplar) — **8 aday** (havada 7 · simetri 1), Paket 21 kapsamı dışında, yukarıda listeli
- konsol hatası: 0

Görseller: `gorsel/paket21/once_*.png` ve `gorsel/paket21/sonra_*.png` — 21 kart × önce/sonra
(tür × kozmetik, oyunun kendi çizim yoluyla, aynı kadrajlarla).
