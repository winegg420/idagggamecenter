# AŞAMA 1B RAPORU — Görsel kalite sıçraması (16 Eyl 2026)

Sahne: `/harita-deneme` (kod `bildim/harita/deneme/DenemeSayfasi.jsx`), varlıklar
`public/meydan/deneme/` (üretici `bildim/harita/varlik/uret.mjs`). Ölçüm `renderer.info`
(gölge geçişi dahil), 1920×918 canvas, masaüstü AMD Radeon tümleşik GPU.
Kare süresi `gl.finish()` ile CPU+GPU. **Telefon FPS'i ölçülmedi** — tahmin yazılmadı.

## Özet tablo (§8)

```
                          ÖNCE (Aşama 1)   SONRA (Aşama 1B)   BÜTÇE
1 karakter   çağrı            13                 5              —      (gövde 1 + kozmetik 3 + gölge 1; kozmetik gölge atmaz)
             üçgen        19.410            13.110              —      (gövde 5.832 + kozmetik 1.446 + gövde gölgesi 5.832)
25 karakter  çağrı           137                97            ≤143   (kozmetik dağılımı deterministik %60)
             üçgen       335.446           314.236        ≤340.000
+62 prop     çağrı             —                +8             ≤+8    (ana geçiş 6, gölge geçişi 2: ağaç gövde + taç; lamba/bank/saksı/bordür gölge atmaz)
             üçgen             —            47.856         ≤80.000   (gölge dahil; bina + prop + bordür toplamı 67.700)
Toplam (25 karakter + çevre + bina)
             çağrı             —               111            ≤220
             üçgen             —           381.904        ≤420.000
fps (masaüstü)                60                60              60    (25 karakter + çevre: 2,45 ms kare)
fps (orta telefon)     ölçülmedi         ölçülmedi              —
```

"ÖNCE" sütunu Aşama 1 ölçümüdür (3 kozmetik takılı). Görev metnindeki 11 çağrı / 18.810 üçgen
canlıdaki HUD'dan okunmuş 2 kozmetikli değerdir; aynı sahne.

Karakter başına eklenen pah: **0** (karakter zaten küre/kapsül; pah yalnız binada ve prop'ta).
Bina üçgeni 2.424 → 9.840: **+7.416 tessellation** (AO çözünürlüğü için 0,5 m ızgara) — çevre
bütçesinden yendi, karakter bütçesinden değil. Tek dükkânda 9,8k pahalı; 10 dükkânlı sokakta
ızgara 0,8 m'ye açılır ya da yalnız ön cephe bölünür (Aşama 2 kararı).

## Yapılanlar — öncelik sırasıyla (§0B)

### 1. Kozmetik çapa doğrulaması (§5) — GEÇTİ
Teşhis: yamukluk Aşama 1'de üç sebepten ikisiydi ve ikisi de o aşamada düzeltilmişti — yuva
ölçeği rig'in 0,01'ini taşıyordu (kozmetik görünmez küçüklükteydi), şapka origin'i kafayı
örtüyordu. 25'li görüntüdeki "yamuk" şapkalar, kafa kemiğinin animasyonla dönmesi + rastgele
Y dönüşlü kopyalardı; kozmetik kafaya sabit.
Doğrulama aracı: **çapa testi** düğmesi — aynı karakter 9 donuk karede (Idle · Walk×3 · Run×3
· Selam×2), tüm kozmetikler takılı, her yuvada 10 cm `AxesHelper`.
Sonuç (`6-capa-testi-9-kare.jpg`): 9 karenin hiçbirinde şapka kafadan, gözlük göz hizasından,
atkı boyundan ayrılmadı. Yuva sözleşmesi: dünya hizalı, kemik dönüşünün tersi, rig ölçeğinin tersi.

### 2. Atlas + malzeme (§3)
`atlas.mjs` yeniden yazıldı: 1024², 128 px hücre, kenar payı 6 px, kontrast %15–25, desenler
YAPI: kiremit sırası (kaydırmalı, koyu sıra çizgisi, bombe), **tuğla** (yeni hücre, açık derz),
düzensiz taş blok, karo + derz, ahşap damar + budak, tente şeridi, cam köşegen yansıma bandı,
iki tonlu çim, örgü, sıva kirlenme gradyanı. Tek dosya, 35/64 hücre, malzeme sayısı 1.
Eski atlas `atlas_eski.png` olarak da üretilir (A/B düğmesi; UV oranları aynı, yalnız doku değişir).
Malzeme: `roughness 0,82`, `metalness 0`, `envMapIntensity 0,35` (RoomEnvironment PMREM,
`scene.environmentIntensity 0,25`), zemin ve asfalt dahil. Metal/cam için ayrı roughness
**uygulanmadı**: tek malzeme kuralı (tek çağrı) bozulurdu.
Görsel: `5-foto-atlas-eski.jpg` ↔ `3-foto-AO-acik-atlas-yeni.jpg` (saksı düz → tuğla, kapı damar).

### 3. Seçici pah + normaller (§4)
`pahli(w,h,d)`: yarıçap = clamp(min kenar × 0,06, 1,5 cm, 12 cm), 1 bölüm. Yalnız siluet
kenarlarında: kat silmesi, korniş, çatı tepesi, baca, kapı/vitrin çerçeveleri, tabela, cumba,
balkon plakaları, kaldırım plakası, bank çıtaları/ayakları. Toptan dönüşüm yapılmadı; zemin
düzlemleri, ince levhalar, cam, korkuluk çubukları pahsız.
Normaller: ilkeller kendi normaliyle geliyor (kutu keskin, küre/kapsül yumuşak) ve `mergeVertices`
yalnız birebir aynı öznitelikli köşeleri birleştiriyor → 35° eşikli krişe ile aynı sonuç; ek
`toCreasedNormals` çağrısına gerek kalmadı (skin özniteliklerini düşürme riski de yok).

### 4. Gömülü AO — A/B (§2)
`ao.mjs`: köşe başına 16 kosinüs ağırlıklı ışın, `three-mesh-bvh` (yalnız devDependency,
tarayıcıya gitmez), R = 0,30 (karakter) / 0,45 (bina) / 0,25–0,5 (prop), yakın kesişme daha
çok karartır, sonuç `COLOR_0`. Kozmetiklerin AO'su gövdeyle birlikte hesaplanır (şapka altı
alın, atkı içi boyun kararır). Tüm varlıklar için toplam süre 1,2 s.
Ölçülen AO: karakter ort 0,68 / min 0,15 · bina ort 0,66 / min 0,15 · ağaç taç 0,80 · lamba 0,70.
**A/B sonucu** (`3-foto-AO-acik-atlas-yeni.jpg` ↔ `4-foto-AO-kapali.jpg`): fark var ama
**orta** — saksı iç kenarı, şapka altı alın, kol altı ve kapı girintisi belirgin kararıyor;
geniş kamerada bina saçak altı okunuyor; düz geniş yüzeylerde beklendiği gibi etkisiz. Bakar
bakmaz "bambaşka" bir sıçrama değil; asıl sıçrama atlas + ışık ayarından geldi. Maliyet sıfır
olduğu için production hattında **açık** kalması öneriliyor; kararı sahibi verir.
Zemin temas gölgesi: 64² radyal `temas.png`, tek `InstancedMesh` (200 slot) — karakterler,
kopyalar, ağaç/lamba/bank/saksı; gölge haritası kapalıyken de nesneler zemine oturur.

### 5. Çevre instancing (§6)
24 ağaç (gövde + taç ayrı instance: 2 çağrı) · 12 lamba · 10 bank · 16 saksı (iki boy, instance
ölçeğiyle) · bordür (80 m × 2 hat, tek mesh). Yerleşim düzenli: iki kaldırım hattı boyunca
6 m ağaç, 12 m lamba, banklar aralarda, bina önü boş. Çağrı artışı **+8** (ana geçiş 6, gölge 2: ağaç gövde + taç;
lamba/bank/saksı/bordür gölge atmaz — temas gölgesi var). Üçgen 47.856 (gölge dahil).
Prop üçgenleri: ağaç gövde 120 · taç 360 · lamba 500 · bank 972 · saksı 528 · bordür 648.

### 6. Kamera + ışık (§7)
Üç kamera düğmesi: **Geniş** 35° / FOV 40 / 30 m · **Oyun** 22° / FOV 48 / 6,5 m · **Fotoğraf**
8° / FOV 32 / 3,2 m. Pozlama 1,12; sis 70 → 190.
Işık A/B düğmesi. B'nin görev metnindeki ilk değerleri (güneş 1,6π, gök 0,9π) ortam haritasıyla
birlikte sahneyi **pastel beyaza yıktı** (ölçüldü, ekran görüntüsüyle). Nihai B: güneş 42°
yükseklik / 40° yandan, güneş 1,15π, gök 0,45π (oran 2,5), gök alt rengi `#E8DFCB`,
ortam haritası 0,25, PCF + `shadow.radius 4`. A = Aşama 1 kurulumu (ortam haritası 0).
Görsel: `1-sonra-genis-isikB.jpg` ↔ `2-genis-isikA.jpg`.

## Deneme sayfasındaki düğmeler (§8 teslim listesi)
AO aç/kapa ✓ · atlas eski/yeni ✓ · çapa testi ✓ · 3 kamera ✓ · 1/25 karakter ✓ · gölge ✓ ·
çevre aç/kapa ✓ · ışık A/B ✓ · HUD (çağrı · üçgen · fps · ms · karakter) ✓.

## Görseller (`.tmp/asama1b-gorseller/`, sahibine gönderildi)
1 sonra-genis-isikB · 2 genis-isikA · 3 foto-AO-acik-atlas-yeni · 4 foto-AO-kapali ·
5 foto-atlas-eski · 6 capa-testi-9-kare · 7 25-karakter-cevre · 8 oyun-kamerasi.
Aşama 1 "önce" görselleri: `.tmp/asama1-gorseller/`.

## Açık konular
- Telefon FPS ölçülmedi; canlı `/harita-deneme` HUD'undan okunabilir.
- Karakter AO ortalaması 0,68: T-pozunda hesaplandığı için kol altları kalıcı karanlık; skinli
  modelde beklenen davranış, Aşama 2'de R 0,25'e çekilerek yumuşatılabilir.
- Atlas eski/yeni düğmesi zemin düzlemlerini etkilemez (onlar düz renk).
- Aşama 2'ye **geçilmedi** (dur noktası).
