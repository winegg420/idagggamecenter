# Aşama 3A-2 — Şehir: yapılar ve kimlik (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — bölge hiyerarşisi | ✅ canlıda | `a5bf7d4` |
| B — Boğaz düzeltmesi | ✅ canlıda | `58f6a46`, `188f947` |
| D — İstiklal'in ucu | ✅ canlıda | `eb8fdd8` |
| E — metro girişi | ✅ canlıda | `eb8fdd8` |
| C — dört yapı | ✅ canlıda | `8a1caef` |
| Düzeltme — vadi zeminle örtülüyordu | ✅ canlıda | `244c6b0` |
| F — ölçüm + muayene | çağrı ✅ · üçgen ✅ · **ms kapısı ❌** (§1) · muayene 0 aday ✅ | bu rapor |

Dokunulmayan: tramvay, kediler, botlar, seyyar satıcı; karakter gövdesi, atlas, kozmetikler, oynanış sistemleri, SQL. Yeni paket yok, yeni doku dosyası yok.

---

## 1. Ölçüm (§F)

**Düzenek (3A-1 ile aynı):** `olcum/meydan-test` üretim derlemesi, headless Chrome, tümleşik AMD Radeon (ANGLE D3D11), 1536×791, DPR 1. En kötü açı (İstiklal ucu), 25 oyuncu + 2 bot + 8 kedi, sınır 20, 120 ısınma + 300 örnek. Dört sürüm **ayrı ayrı derlendi** (`git archive` → `.tmp/olc3a2/<ad>`, ayrı portlar) ve **dönüşümlü** ölçüldü (3 tur, her turda taban → +B → +D/E → +C). Betik: `katman2c.js › cepheOlc()`.

### Varsayılan LOD (oyunda görülen)

| Katman | Çağrı | Üçgen | CPU ms (tur 1 · 2 · 3) | **CPU+GPU ms** (tur 1 · 2 · 3) | CPU+GPU p95 |
|---|---:|---:|---|---|---|
| 3A-1 taban (`37c33aa`) | 167 | 385.105 | 3,8 · 5,1 · 5,3 | **4,4 · 5,7 · 6,0** | 5,9 · 6,6 · 6,4 |
| + B Boğaz (`188f947`) | 167 | 420.913 | 4,9 · 5,0 · 5,3 | **5,9 · 5,7 · 6,0** | 8,8 · 6,3 · 6,3 |
| + D/E sokak ucu + metro (`eb8fdd8`) | 166 | 417.709 | 6,1 · 5,2 · 5,3 | **7,0 · 5,9 · 6,0** | 10,5 · 6,3 · 6,3 |
| + C dört yapı (`8a1caef`) | 167 | 439.794 | 6,1 · 5,3 · 5,3 | **6,9 · 6,0 · 6,0** | 9,0 · 6,3 · 6,3 |
| **Kapı** | ≤ 220 ✅ | ≤ 460.000 ✅ | — | **≤ 4,0 ❌** | — |

### Aynı sahnede binaları zorlayarak (CPU+GPU ms, tur 1 · 2 · 3)

| Durum | taban | + B | + D/E | + C |
|---|---|---|---|---|
| Hepsi YAKIN (LOD 0) | 4,4 · 6,0 · 6,0 | 6,9 · 5,9 · 6,0 | 7,4 · 6,0 · 6,0 | 6,0 · 6,0 · 5,9 (**458.493 üçgen**) |
| Hepsi ORTA (LOD 1) | 4,0 · 5,8 · 5,9 | 6,9 · 4,1 · 5,9 | 7,1 · 5,9 · 5,9 | 6,0 · 6,0 · 6,0 |
| Hepsi UZAK (LOD 2) | 3,6 · 4,7 · 4,5 | 6,2 · 4,5 · 4,8 | 6,2 · 4,7 · 4,5 | 4,9 · 4,7 · 5,0 |
| Cepheler gizli | 5,4 · 4,0 · 4,2 | 6,4 · 4,2 · 4,1 | 6,0 · 4,1 · 4,0 | 4,1 · 4,1 · 5,1 |

### Kapı sonucu — PASS DEĞİL

- **Çağrı ✅** 167 (≤ 220). Dört yapı + metro yapı başına 1 çağrı; Boğaz ve sokak devamı arka plan mesh'inde, ek çağrı yok. D/E'de 166'ya düştü (bir apartman silindi), C'de yapılarla yine 167.
- **Üçgen ✅** 439.794 (≤ 460.000). Payı dar: bütün binalar zorla yakın LOD'da **458.493** — kapının 1.507 altında. +B'deki +35.800 üçgenin neredeyse tamamı Boğaz'a eklenen 62 ağaç (ağaç örneği ~580 üçgen); Boğaz geometrisinin kendisi 1.900.
- **ms ❌** — **hiçbir katman geçmiyor, taban dahil.** Isınmış turlarda (2 ve 3) dört sürüm de **5,7 – 6,0 ms**; katmanlar arası fark **0,0 – 0,3 ms**, yani ölçülebilir değil. 1. turda +B/+D/E/+C'nin 1,5 – 2,6 ms yüksek çıkması sıraya bağlı ısınma: taban her turda ilk ölçülüyor ve 1. turda soğuk makinede ölçüldü; aynı sürümler 2. ve 3. turda tabanla aynı yere oturuyor. Tabanı değiştirmedim; 3A-1 raporunda taban 4,1 – 5,5 idi, bugün aynı commit 4,4 – 6,0 — bu makinenin günlük saçılması.
- **Maliyet nerede:** 2C'deki "basamak" yine görünüyor. Binalar yakın/orta LOD'da çizildiğinde ~6,0 ms, uzak LOD'da ya da cepheler gizliyken ~4,0 – 4,7 ms. Basamak binaların üçgen sayısıyla değil çizilen piksel/ışık yüküyle ilişkili görünüyor (LOD 0 ↔ LOD 1 arasında 30 bin üçgen farkına rağmen süre aynı). Bu paketin eklediği yapılar basamağı değiştirmedi.
- **Bu açının sınırı:** en kötü açı İstiklal ucu; AKM, cami ve anıt oradan uzak LOD'da. Yakın maliyetleri "hepsi YAKIN" satırında: C ile taban aynı (6,0 ms).
- **Ölçülen sürümlerde bir hata vardı:** +B/+D/E/+C derlemelerinde vadi dış zeminle kısmen/tamamen örtülüydü (§4). Düzeltme (`244c6b0`) yalnız zemin şeklinin üçgenlemesini değiştiriyor (+birkaç üçgen); ölçümü yeniden yapmadım.
- **Telefon:** masaüstü tümleşik GPU sayısı kötümser (2D: S24 FE 2,20 ms ↔ bu makine 3,70 ms). Karar için İstiklal ucunda ve plazada `?olcum=1` ile telefon ölçümü gerekli.

Ham veri: `.tmp/3a/olcum3a2.txt` (git dışı; betik `.tmp/3a/olc2.mjs`).

---

## 2. Muayene (§F)

Dört yapı GLB olarak üretildi (`npm run cephe-ao` → `public/meydan/deneme/yapi_*.glb`) ve `npm run muayene`'den geçti. Kontakt sayfaları: `muayene/cikti/yapi_*/kontakt.jpg`.

| Yapı | Üçgen (yakın LOD) | İlk koşu | Son |
|---|---:|---:|---|
| AKM (`yapi_akm`) | 826 | 0 | **0 aday · 0 susturulan** |
| Taksim Camii (`yapi_cami`) | 1.856 | 43 | **0 aday · 0 susturulan** |
| Cumhuriyet Anıtı (`yapi_anit`) | 1.100 | 13 + 1 susturulan | **0 aday · 0 susturulan** |
| Galatasaray Lisesi (`yapi_lise`) | 1.745 | 61 | **0 aday · 0 susturulan** |

Hepsi geometride düzeltildi, üstveriye susturma yazılmadı:
- **Cami:** alem kubbe tepesinin içinden başlar + bilezik; minare kaidesi gövdeye daralır, şerefe iç halkası gövdeye oturur, külah üst gövdeyle aynı yarıçap, alem külah yüzeyinden çıkar; revak/yan kemer dolguları ve söveler duvara 4–8 mm; şadırvan dikmeleri külaha kadar uzar; kasnak pencereleri çokgenin yüz mesafesine (`R·cos(π/n)`) oturtuldu (önce 10 cm havadaydı).
- **Anıt:** figür parçaları birbirine oturur (bacak → gövde alt kapağı, omuz gövdenin içinden); pelerin, gövde kapağına yatan bir "yaka"dan sarkar, gövdenin içinden geçmez; niş figürü duvara dayalı kaide üstünde, pelerini kaideye girmez; üst grupta yan figürler orta figürün kalkık kolundan geriye alındı.
- **Lise:** pencere sövesi/camı ve kapı kemeri duvar yüzüne (0 / merkez çıkıntıda 0,8 m) 4–8 mm; alınlık ve amblem çıkıntı yüzüne; kapı amblemi kemer ön yüzüne; tabela plakası iki sütunun arasına tam oturur.

`npm run cephe-ao` yeniden koşuldu: `cephe_ao.bin` 54 kayıt.

---

## 3. A — Bölge hiyerarşisi

- Her parsel, nokta, alan ve tramvay `bolge` taşır (`plaza` / `meydan` / `istiklal`). Eksik ya da `bolgeler`'de olmayan bölge → konsola `[Meydan] yerleşim manifesti:` hatası.
- `bolgeler[*].kaydir: [dx, dz]` bütün bölgeyi öteler: zemin, kaldırım, bina (cephe dahil), çarpışma, sınır, prop hatları, noktalar, tramvay hattı/durakları. Tek yer: `yerlesimCoz.js › manifestCoz` (dunya.js, yerlesimDunya.js ve cephe_ao.mjs hep bundan geçer).
- **Sınır tekrarı giderildi:** `sinir.parcalar` artık `{"tip":"daire","bolge":"plaza"}` / `{"tip":"koridor","bolge":"istiklal"}` — merkez/yarıçap/koridor uçları bölgeden türetilir; ikinci kopya yok.
- **Doğrulama:** `istiklal` `kaydir: [4, 0]` ile derlendi: çapa, cephe mesh'i, koridor, sınır 4 m kaydı; çarpışma aynı binaya aynı noktadan (6,55 m) itti. Görsel: `gorsel/3a2/a-bolge-kaydir.jpg`. Değer geri alındı.

## 4. B — Boğaz düzeltmesi

- `deniz_y` −60 → **−35**, köprü `kule_yukseklik` **50**, `guverte_yukseklik` **20** (sahibi: "köprü neden aşağıda").
- Teras düşüşü deniz kotundan türetilir (`|deniz_y| / adet`) → teraslar arasında boşluk/çakışma yok. Teras kenarı tohumlu kırık çizgi (`kirik`).
- **Neden köprü ve karşı kıyı yaklaştırıldı:** deniz yükselince aynı yerdeki köprü ve karşı kıyı kadrajın üstüne çıktı (kamera ufku görmüyor, 3A-1 §2). Köprü `[30,-135] → [200,-150]`, karşı kıyı hattı plazaya yaklaştırıldı. Bu bir manifest değişikliği, kod değil.
- Karşı kıyı: **40 ev**, 3–5 öbek (tohum 7, deterministik), 3 boy, 4 ton; öbek aralarında ağaç kümeleri (mevcut ağaç InstancedMesh'ine eklendi); **3 minare silueti**. Teras çatıları seyreltildi, öbekli (sahibi: "sıra sıra bina kötü duruyor") — 98 → 60 ev toplam (40 karşı kıyı + 20 teras), 62 ağaç.
- Toplam Boğaz **1.900 üçgen**, **0 ek çağrı** (arka plan mesh'inin içinde).
- **Sonradan bulunan hata (F sırasında, `244c6b0`):** vadi deliğinin uzak köşesi (x ≈ 720) dış zemin karesini (±700) kesiyordu; üçgenleme deliği bozuyordu. B'de vadinin bir kısmı, D/E'de metro deliği eklenince tamamı dış zeminle örtüldü — deniz, köprü ve karşı kıyı plazadan görünmüyordu. D/E doğrulamasında bu açıdan bakmadığım için kaçtı. Kare delikleri kapsayacak kadar büyütüldü (en az ±900); Boğaz ve metro açıklığı ekran görüntüsüyle doğrulandı.

## 5. D — İstiklal'in ucu

- `apartman_istiklal_ucu` **silindi**. Yerine `arkaplan › istiklal_devami` (`tip: "siluet"`, 110 m): zemin şeridi + iki yanda katlı bina siluetleri, 35 m'den sonra sise karışır. **298 üçgen, 0 ek çağrı** (arka plan mesh'i).
- Yürünebilir sınır değişmedi. Çarpışma testi: sokak sonunda oyuncu t = 101,78 / 102'de durur, sınırın içinde kalır; eski parselin çarpışması yok.

## 6. E — Metro girişi

- `noktalar › metro_taksim`: `tip: "kozmetik"`, `yuva: "metro_girisi"`, `yapi: "metro"`, plaza güneyi `[0, 0, 37.5]`.
- İnen 10 basamak + sahanlık + dipte karanlık geçit, taş korkuluk + paslanmaz tırabzan, cam kanopi, kırmızı **M** totemi. Plaza karoları ve dış zemin açılır (`zemin_deligi`), çevresinde taş apron. 316 üçgen, 1 çağrı.
- Çarpışma ayak izinin tamamı (kapalı): yürüyerek girme testi x = 4,55'te durdu.

## 7. C — Dört yapı

Hepsi `yapilar.js`, cephe.js kalıbı: aynı atlas, tek malzeme, köşe rengi = ton × gömülü AO, 3 LOD (38 / 85 m), yapı başına 1 çağrı, gölgeyi yalnız uzak kütle vekili atar. Parametreler manifestte.

- **AKM** (`kamusal_akm`, `akm` bloğu): dikey kayıtlı cam cephe, cam arkasından görünen kırmızı seramik yarım küre, düz çatı + çatı ekipmanı, "AKM" harfleri tabela yöntemiyle (çubuklar, yeni doku yok). Girilemez.
- **Taksim Camii** (`landmark_taksim_camii`, `cami` bloğu): kasnaklı tek kaburgalı kubbe, geniş kemerli revak meydana bakar, iki ince minare tek şerefeli (yakın LOD'da korkuluk), kesme taş bej, avlu + şadırvan görünür. Çarpışma dış ayak izi. `landmark_minare` (ayrı boyalı minare) silindi — minareler caminin parçası.
- **Cumhuriyet Anıtı** (`anit`, `anit` bloğu): yürünebilir yuvarlak platform + 3 basamak; kolonlu, kemer çerçeveli dikdörtgen kaide; üstte üç figürlük grup, iki yanda nişte figür. Çarpışma **yalnız kaide** (5,2 × 4,0).
  - ⚠️ **Heykeller siluet:** duruş, pelerin hattı, kütle oranı var; **yüz detayı (göz, burun, ağız, saç) hiçbir LOD'da yok** — baş düz yüzlü prizma + yumuşak tepe. Ürün sahibi kararı; muayene düzeltmelerinde de detay eklenmedi.
- **Galatasaray Lisesi** (`dukkan_ayarlar`, `yapi: "lise"`): mod `/profil` korundu. Yüksek demir parmaklıklı bahçe duvarı, sütunlu taş kemerli anıtsal kapı + **stilize amblem** (sarı-kırmızı iç içe daireler — gerçek arma kopyalanmadı), geride simetrik krem/sarı ana bina (merkez çıkıntı, alınlık, kat silmeleri), büyük ağaçlar (mevcut ağaç ölçeklenmiş, `bahce_agaclari`), kırmızı-sarı bayrak direği.
  - **Birleşme:** `dukkan_ayarlar`, D'de boşalan `apartman_istiklal_ucu` arsasıyla birleşti (mod taşımayan komşu). Ayak izi 25,5 × 22 m, çapa `[-68.65, 0, 117.77]`, kapı ekseni `kapi_x: -8.25`. Sokak uzunluğu ve diğer parseller değişmedi.

---

## 8. Manifest değişiklikleri (özet)

- **Eklenen:** `bolge` (her kayıtta), `bolgeler[*].kaydir` desteği, `arkaplan › istiklal_devami`, `noktalar › metro_taksim`, `akm` / `cami` / `anit` blokları, `parsel.yapi`, `nokta.yapi`, `anit.carpisma`, `dukkan_ayarlar.kapi_x` / `bahce_agaclari`, Boğaz `teras.kirik`, `ev.*`, karşı kıyı `obek` / `minare_*`.
- **Değişen:** `sinir.parcalar` bölge referansına; Boğaz deniz/köprü kotları + köprü ve karşı kıyı konumu; `dukkan_ayarlar` (tür `okul`, 3 kat, yeni çapa/ayak izi); `kamusal_akm` cephe reçetesi → `yapi: "akm"`.
- **Silinen:** `apartman_istiklal_ucu`, `landmark_minare`.

## 9. Görseller (`gorsel/3a2/`)

| Dosya | Ne |
|---|---|
| `a-bolge-kaydir.jpg` | A: `istiklal` bölgesi `kaydir: [4, 0]` ile (sonra geri alındı) |
| `b-bogaz.jpg` | B: oyun kamerası, plazanın kuzeydoğu kenarı — teraslar, deniz, köprü, karşı kıyı |
| `c1-akm-meydandan.jpg` | C.1: AKM meydandan — cam cephe, kırmızı küre, AKM harfleri |
| `c2-cami.jpg` | C.2: Taksim Camii — kubbe, minareler, revak, avlu + şadırvan |
| `c3-anit-yakin.jpg` | C.3: anıt yakın — platform, kaide, kemerli niş |
| `c3-anit-heykel-siluet.jpg` | C.3: heykel grubu yakından — siluet, yüz detayı yok |
| `c4-lise-sokaktan.jpg` | C.4: Galatasaray Lisesi İstiklal'den — kapı, amblem, bina, ağaçlar, bayrak |
| `d-istiklal-ucu.jpg` | D: İstiklal'in açık ucu (sokağın devamı) |
| `e-metro.jpg` | E: metro girişi |

## 10. Bilinen boşluklar

- Lise etiketi hâlâ **"Ayarlar"** (mod adı; `ad` değişmedi — yapının adı etikette yok).
- `CevreBinalar` boyalı bina mesh'i artık boş (bütün parseller cephe/yapı sisteminde); kod yolu duruyor, mesh üretilmiyor.
- Metro yalnız kozmetik: iniş yok, ses yok.
- Cami ve anıt girilemez; caminin iç mekânı yok (revak arkası koyu).
- ms kapısı (§1): masaüstü tümleşik GPU'da geçilmedi; telefonda İstiklal ucunda `?olcum=1` ölçümü hâlâ gerekli.

DUR — tramvay, kediler, botlar, seyyar satıcılar bu pakette yok.
