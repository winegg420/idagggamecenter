# Paket 21 — Muayene gerçek kalite kapısına dönüşsün (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — muayene kapsamı: kodla çizilen parçalar | ✅ taç + pelerin muayenede | `6dc600b` |
| B — yeni test: yuva oturması | ✅ şapka · taç · pelerin üç türde de yakalanıyor | `4aceff3` |
| C — yeni test: açık kenar / delik | ✅ şapkanın altı, taç, pelerin, vizör, kuyruk ucu | `fb0ca18` |
| D — yeni test: kalınlık | ✅ 14 kanat tüyü (1,4 cm) yakalandı; eşik iki kez ölçülerek düzeltildi | D |
| E — takılı poz + portre kadrajı | (sürüyor) | |
| F — çıkan adayları düzelt | (sürüyor) | |
| G — raporlama kuralı | (sürüyor) | |

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
