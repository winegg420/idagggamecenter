# AŞAMA 1D RAPORU — Yüz, kaplan suratı, robot silueti + prop optimizasyonu (16 Eyl 2026)

Sahne: `/harita-deneme` (kod `bildim/harita/deneme/DenemeSayfasi.jsx`), varlıklar `public/meydan/deneme/`
(üretici `bildim/harita/varlik/uret.mjs`, atlas `atlas.mjs`). Ölçüm `renderer.info` (gölge geçişi dahil), 1920×918,
masaüstü AMD Radeon tümleşik GPU. Kare süresi `gl.finish()` ile CPU+GPU. **Telefon FPS'i ölçülmedi.**
Görseller: `.tmp/asama1d-gorseller/` (numaralı; aşağıda dosya adıyla).

Aşama 1C'nin çeşitliliği (3 kıyafet · 3 saç · 4 ten · 4 saç rengi · kaplan · robot · kediler · kuyruk · kulaklar · anten ·
bölge pürüzlülüğü · AO · temas gölgesi · instancing · zemin · yaprak/ağaç · ışık B+ · yön düzeltmesi · çapa) **korundu**;
yeni tür ve yeni harita **yok**. Aşama 2'ye geçilmedi.

## Rapor tablosu

```
                      1C          1D         SINIR
Çizim çağrısı        102         102         ≤220
Toplam üçgen     343.050     349.054      ≤420.000
  karakterler    275.160     305.332      ≤340.000   (+30k: kafa 28×18, yüz yamaları, kaplan muzzle, robot gövdesi)
  çevre           67.890      43.722       ≤80.000   (hedef ~43.700 — Bölüm D)
Kare süresi (Geniş) 2,14 ms  2,8–3,2 ms     ≤4,0 ms   (3 ölçüm: 3,19 · 2,90 · 2,82; Oyun kamerası 2,78)
fps (masaüstü)        60          60           60
fps (telefon)    ölçülmedi   ölçülmedi         —
```

Kare süresi notu: bugünkü ölçümler aynı makinede 1C'nin 2,14 ms'sinden yüksek; aynı oturumda 1C durumu yeniden
ölçülmedi, fark tarayıcı yükü olabilir — 4,0 ms sınırının altında, ama "artmadı" demiyorum.

Tür başına tek karakter (3 kozmetik + gölge, çevre düşülmüş): insan 5 çağrı / 13.224 · kaplan 6 / 11.944 · robot 5 / 12.930.
GLB gövde üçgeni: insan 5.298 → **5.888** · kaplan 4.714 → **5.112** · robot 5.146 → **6.060** (sınır 9.000).
Yeni malzeme yok, yeni doku dosyası yok, `transparent`/`alphaTest` yok. Konsol hatası 0. `npm run build` temiz.

---

# BÖLÜM A — İNSAN YÜZÜ (§2)

**Kök sebep (koddan, 1C):** göz/ağız 11,5 cm düz `PlaneGeometry` kartlar (küre üstünde köşeleri kalkıyordu), burun ayrı küre,
kafa 18×13 (468 üçgen) — anatomi işlenemezdi.

**Yapılan:**
1. Kafa `SphereGeometry(R, 28, 18)` = 952 üçgen (+484). **28 sütun, 26 değil:** 26'da ön orta hat (φ = π/2) iki sütun
   arasına düşüyor, burun ucu yassı kalıyordu; 28'de orta hatta köşe sütunu var → burun sırtı tek sırada yükselir.
2. Anatomi **köşe kaydırmayla** (üçgen eklemez; `OZELLIK` tablosu, normal boyunca eliptik düşüşle): göz çukuru −2 mm,
   kaş kemeri +1,5 mm, elmacık +3 mm, çene +6 mm, **burun +30 mm** (ön orta sütun; ayrı küre KALKTI, boyalı burun
   gölgesi de kaldırıldı — gölgesini ışık yapar).
3. Göz ve ağız **yüzeye oturan oval yama**: eşmerkezli 3 halka (1+8+16+24 köşe, 72 üçgen), her köşe **kafanın çokgen
   yüzeyine ışın testiyle** oturtulup normal boyunca **1 mm** öteleniyor. Dış hat oval → kart kenarı yok.
   UV hücre içinde en-boy oranını korur; ifade hâlâ UV kaydırma (ek çağrı yok). Şeffaflık yok; hücre kenarı ten rengi.
4. Göz 0,115 → **0,088 m**; çizim kareyi doldurur (göz akı 23 px yarıçap), bebek/iris çizimde.
5. Ten tonu eşlemesi: karakter `COLOR_0` RGBA'ya çevrildi (rgb = AO×ton, a = AO). Shader göz/ağız yamasında ten
   rengindeki pikseli kafayla aynı tonla, göz akı/iris/dudak pikselini yalnız AO ile çarpar → 4 ten renginde de yama
   kenarı görünmez, göz akı beyaz kalır. Tek malzeme, ek çağrı yok.

**Düzeltilen iki yanlış deneme (dürüstlük için):**
- Yamalar önce analitik küre yüzeyine oturtuldu; burun/muzzle eteğinde analitik yüzey iç bükey, kafa üçgeninin kirişi
  onun üstünde → 1 mm yama kafanın içinde kaldı, göz altında açık üçgen göründü. Çözüm: ışın testiyle **çokgen** yüzeye oturtma.
- 2 halkalı yamada yarım kiriş 22 mm → 1,03 mm sarkma (> 1 mm ofset) → z-savaşı. 3 halkada 0,26 mm.
- Ten eşleme sabiti `new THREE.Color(hex).convertSRGBToLinear()` çift dönüşümdü (three r152+ hex'i zaten doğrusala çevirir)
  → yama tamamen tonsuz kalıyordu; düzeltildi.

**Kabul ölçütü (Fotoğraf kamerası, yakın):** `1-yuz-sonra-foto.jpg` (önce: `0-yuz-once-1C-foto.jpg`, aynı açı) ·
`2-yuz-yakin-goz-acik.jpg` ↔ `3-yuz-yakin-goz-kapali.jpg` · 3/4 profil `4-yuz-34-profil-yakin.jpg` · tam profil
`5-yuz-tam-profil-yakin.jpg` ve uzak `13-yuz-tam-profil-uzak.jpg` (burun siluetten okunur) · ağız/burun `6-agiz-burun-yakin.jpg`.
Kart kenarı yok, burun kafanın parçası, göz çevresinde yumuşak çukur, profilde yüz düzgün.
Gülümseme/şaşkın ifadelere **dokunulmadı** (§2.5); kırpma aynı sistemle çalışır.

# BÖLÜM B — KAPLAN SURATI (§3)

Korunan: kulaklar, çizgili kürk, kuyruk. Değişen: **siluet.** Aynı köşe kaydırmayla kafa küresinin ön-alt bölgesinden
**muzzle** (yassı plato, +55 mm, iç bükey etek), **alt çene** +18 mm, burun tepesi +12 mm, **yanak kürk tutamları**
(+20/+12/+14 mm, siluette tırtık). Gözler insandan yana + yukarı (±0,095 / +0,035). Atlasta göz yamaları yeni konuma,
krem muzzle yaması geometriyi kaplar, **koyu burun üçgeni** + philtrum + bıyık delikleri. Ağız yaması muzzle'ın alt ön yüzünde.
+120 üçgen yamalar + kafa 28×18 — toplam 4.714 → 5.112.

**Kabul:** yandan profilde insandan ayırt edilir: `8-profil-insan-kaplan-yan-yana.jpg` (aynı kamera, aynı poz),
`14-kaplan-tam-profil-uzak.jpg` ↔ `13-yuz-tam-profil-uzak.jpg`. Ön: `7-kaplan-yuz-yakin.jpg`.

# BÖLÜM C — ROBOT (§4)

Aynı iskelet, aynı boy, aynı 15 yuva, animasyonlar aynen. Görünür mesh **baştan**:
- Gövde: kalça bloğu + bel halkası + pahlı göğüs bloğu (ayrık kütleler), yan **paneller** (set rengi), göğüs ekranı +
  3 gösterge, 3 **havalandırma çizgisi**, **boyun pistonu** + halka (kafa gövdeye yapışmaz).
- Omuz: küresel eklem + halka (gövdeden ayrık) · dirsek/diz: küre + halka; kol/bacak iki segment (üst metal, alt panel).
- El: **üç parmaklı kıskaç** (avuç bloğu + 2 parmak + karşı parmak) · Ayak: **taban plakası + bilek pistonu** + ayak bloğu.
- Kafa: yuvarlak (küre 1 / 0,9 / 0,92), **yüz = kafaya oturan emissive ekran paneli** (yuvarlak dikdörtgen yama, 5 halka,
  200 üçgen; koyu cam, tarama çizgileri, siyan durum çizgisi), göz/ağız yamaları ekranın 3 mm üstünde, siyan göz shader'da
  emissive. Tepede **anten** (şapka kubbesinin üstünden çıkar), yanlarda hoparlör kapakları.
- Malzeme ayrımı bölgeyle (yeni malzeme yok): metal 0,35 · boya 0,5 · **plastik 0,6 (yeni bölge kodu 21)** · ekran 0,2 emissive.
- **Kozmetik varyantları** (robot GLB'sinde, çalışma anında tür varyantı öncelikli): şapka kubbesi **anten geçiş halkalı**
  (424 üçgen), gözlük → **vizör** (±54° cam bandı + çerçeve, 84 üçgen), atkı insanınki. Kıyafet setleri → **panel
  varyantı**: 1 düz üst rengi · 2 koyu metalik (ceket rengi × metal hücresi) · 3 çizgili (tente hücresi × üst rengi).
- 5.146 → **6.060** üçgen (sınır 9.000).

**Kabul — siyah siluet testi:** `9-siyah-siluet-testi.jpg` (insan · kaplan · robot, düz siyah, beyaz fon, Idle 0. kare):
robot anten, ayrık eklemler, kıskaç, taban plakalarıyla insandan ayrılır; kaplan kulak + kuyruk + muzzle ile.
Tam boy kozmetikli (vizör + şapka): `10-robot-tam-boy-vizor-sapka.jpg` · ekran yüz `11-robot-ekran-yuz-yakin.jpg` ·
üç tür yan yana `12-uc-tur-yan-yana.jpg` · set 2/3 panel varyantı `12-robot-kiyafet-2.jpg`, `11-robot-kiyafet-3.jpg`
(önceki turdan, gövde aynı).

---

# BÖLÜM D — PROP GEOMETRİ OPTİMİZASYONU

| # | Ne | Önce | Sonra | Etkin kazanç (adet × gölge) |
|---|---|---:|---:|---:|
| 1 | Ağaç tacı gölgesi → **küre vekili** (7×5, 56 üçgen) | taç 470 gölge geçişinde | vekil 56 | **−9.936** (24 ağaç) |
| 2 | Bank | 972 | **320** | −6.520 (10) |
| 3 | Saksı | 528 | **256** | −4.352 (16) |
| 4 | Lamba | 500 | **220** | −3.360 (12) |
| | **Toplam** | | | **−24.168** |

Çevre etkin üçgen **67.890 → 43.722** (ölçüldü; hedef ~43.700). Çizim çağrısı **14 → 14** (vekil ana geçişe girmez).

**Vekil nasıl çalışır (`DenemeSayfasi.jsx › cevreKur`):** taç `InstancedMesh.castShadow = false`; aynı instance
matrisleriyle ikinci bir `InstancedMesh` (küre zarfı, y 3,45–6,55 m, ±1,7 m) yalnız gölge geçişinde "görünür": `visible`
getter'ı `renderer.getRenderTarget() !== null` — three gölge haritasını hedefe çizer, ana geçişi ekrana. Ana geçiş listesine
hiç girmez → ek çağrı yok. A/B düğmesi **taç gölgesi: vekil / gerçek**.
Denenip vazgeçilen: `layers` (gölge geçişi de ana kameranın katmanlarını test eder), `material.colorWrite=false`
(ana geçişte çağrı sayar), `onBeforeShadow` geometri değişimi (geometri callback'ten önce alınıyor).

**Bank 972 → 320:** çıtalar `RoundedBox` (108) yerine **ucuz pah** (`pahliUcuz`: 6 sekizgen yüz + 12 kenar + 8 köşe = 68
üçgen; kenar parlaması kalır), sırtlıkta iki çıta → aynı yükseklik aralığında tek plaka, ayaklar düz kutu.
**Saksı 528 → 256:** bilezik torus (120) → açık silindir (16), çalı 8×6 → 7×5, 6 top (6×5) → 4 top (6×4). Hedef 250 idi;
saksı Fotoğraf kamerasında karakterin dibinde durduğu için topları 5 yüzlüye düşürmedim (+6).
**Lamba 500 → 220:** direk/kol/bilezik açık uçlu silindir, küre 12×9 → 10×7, koni kapaksız, tepe topu 5×3.

**Görsel bedel:** `18-prop-yakin-once-1C.jpg` ↔ `21-prop-yakin-sonra.jpg` (aynı açı; bank silueti aynı, sırtlık
tek plaka) · `22-tac-golgesi-vekil.jpg` ↔ `23-tac-golgesi-gercek.jpg` (gölge blobları aynı) · `24-saksi-lamba-yakin-sonra.jpg` ·
Geniş 25 karakter `19-25-karakter-genis-once-1C.jpg` ↔ `20-25-karakter-genis-sonra.jpg` (HUD köşede).
Yaprak kontrastı, ağaç ölçeği (0,7) ve yerleşim kuralı değişmedi.

**Bina karşılığı (Aşama 2 için, tip belirtilerek):** 24.168 etkin üçgen = gölge atan LOD0 dükkân (9.608) × **2,5** ya da
gölge atmayan LOD0 (4.804) × **5**.

---

## Kalem kalem çevre (1D, etkin = gölge geçişi dahil)

| Kalem | Adet | Mesh | Gölge | Etkin |
|---|---:|---:|---:|---:|
| Ağaç tacı | 24 | 11.280 | +1.344 (vekil) | 12.624 |
| Bina | 1 | 4.804 | +4.804 | 9.608 |
| Ağaç gövdesi | 24 | 2.880 | +2.880 | 5.760 |
| Saksı | 16 | 4.096 | — | 4.096 |
| Bank | 10 | 3.200 | — | 3.200 |
| Zemin | 1 | 3.058 | — | 3.058 |
| Lamba | 12 | 2.640 | — | 2.640 |
| Kedi | 3 | 1.956 | — | 1.956 |
| Bordür | 1 | 648 | — | 648 |
| Tabela yazısı + temas gölgesi | | ~130 | — | ~130 |
| **Toplam** | | | | **43.722** (ölçüm) |

## Düğmeler
1C'nin tümü + **siluet** (siyah siluet testi) + **taç gölgesi: vekil/gerçek**. Yakın çekim için kamera en yakın mesafe 2 → 0,5 m.

## Dosyalar
`uret.mjs` (kafa/yama/kaplan/robot/prop), `atlas.mjs` (kaplan yüzü, robot ekranı, göz çizimi), `DenemeSayfasi.jsx`
(RGBA renk + ten eşleme shader'ı, plastik pürüzlülük, robot panel setleri, tür kozmetik varyantı, taç vekili, siluet),
`karakter_{insan,kaplan,robot}.glb`, `prop_{bank,saksi,lamba}.glb`, `atlas.png`, `ASAMA_2_BUTCE_NOTU.md` (ek görev).

## Açık konular
- Telefon FPS ölçülmedi.
- Kare süresi 2,8–3,2 ms (sınır 4,0); 1C ile aynı oturumda karşılaştırılmadı.
- Gülümseme/şaşkın ifadeler 1C çizimleriyle duruyor; normal yüz onaylandıktan sonra aynı sistemle elden geçirilecek.
- **Aşama 2'ye (İstiklal / 13 karakter) geçilmedi — DUR NOKTASI.**
