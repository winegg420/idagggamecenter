# AŞAMA 1H — GÖVDE KARŞILAŞTIRMASI (BODY BAKE-OFF) · 17 Eyl 2026

## 0. Önce bunu oku — iki zorunlu aday indirilemedi

**A (Universal Base Regular) ve B (Universal Base Teen) bu pakette KARŞILAŞTIRILMADI.** İkisi yalnız ücretli
**Source** sürümünde (itch.io, 19,99 $). Ücretsiz **Standard** paket indirildi. İçinde, lisans dosyasının kendi ifadesiyle,
"modellerin yalnız bir kısmı" var: **Superhero** erkek ve kadın gövdeleri. Satın alma benim yapabileceğim bir işlem değil.
Sahibi Source paketini alıp iki `.gltf` dosyasını ilgili klasöre koyarsa, bütün hat tek komutla yeniden üretilir
(`bildim/harita/varlik/aday/a_regular/kaynak/BURAYA_KONACAK.md`).

Vekil ya da uydurma varlık üretilmedi. Karşılaştırma sayfasında A ve B sütunları gri **DOSYA YOK** olarak duruyor.
Yerlerine başka bir şey konmadı.

Aynı ücretsiz paketten gelen **A0 · Superhero erkek** ek aday olarak eklendi. **A0, A'nın ya da B'nin yerine geçmez.**
Oranları kasıklı süper kahraman ve "Şenlik" diline en uzak gövde. Yine de iki soruyu gerçek veriyle yanıtlıyor:
bu kitin topolojisi 6 bine iner mi, rig'i bizim kliplerimizi kabul eder mi? A ve B aynı kitten, aynı "Humanoid Rig" ve
"~13k üçgen" ilanıyla geliyor. Bu yüzden A0'ın **hat sonuçları** (sadeleştirme, skin doğrulaması, retarget) A/B için
güçlü bir öngörüdür. **Biçim ve stil sonuçları öngörü değildir.**

D (Ultimate Modular Men) Google Drive'dan indirildi. Pakette **çıplak temel gövde yok**; her karakter giyimli parçalardan
(baş/gövde/bacak/ayak) oluşuyor. En açık kıyafet **Beach** (şort, çıplak üst) seçildi. Şort bacak geometrisinin bir parçası,
sökülemez.

## 1. Asıl teslim — karşılaştırma sayfası

`bildim/harita/gorsel/1h/01_govde_karsilastirma.jpg`

| Satır | Poz | Kamera |
|---|---|---|
| ÖN | nötr | sabit, +Z, 5,4 m, fov 22 |
| YAN PROFİL | nötr | sabit, +X |
| 3/4 AÇI | nötr | sabit, (3,8 · 1,25 · 3,8) |
| DİZ BÜKÜLÜ | Walk 0,467 s | sabit, yan-önden |

**Nötr poz** = bizim kaynak iskeletin T-pozu, üst kollar 55° aşağı. Her adaya retarget edildi; C'ye muayenede aynı dönüş
uygulandı. İlk denemede Idle 0,5 s kullanılmıştı. Bizim Idle gövdeyi yaklaşık 40° çevirdiği için "ön" satırı cepheden
görünmüyordu, bu yüzden değiştirildi.

Sabitler: boy 1,827 m (mevcut karakter), kök y = 0, merkez x/z = 0, ışık B+, tek düz ten (#F2C9A7, pürüz 0,82),
kıyafet/saç/kaş/küpe yok. Karar **sadeleştirilmiş** hale göre verilir.

Ek sayfalar:
- `02_govde_deformasyon.jpg` — dirsek, diz, omuz ve kalça kareleri; her adayda aynı kare
- `03_sadelestirme_kaybi_a0.jpg` — A0 ham ve sade yan yana
- Kontakt sayfaları: `bildim/harita/muayene/cikti/aday_*/kontakt.jpg`. Her sayfada 6 ortografik görünüm, 5 yakın çekim
  (boyun-omuz, torso-pelvis, bacak ayrımı, el, tam profil), 4 deformasyon karesi ve 1 beauty var.

## 2. Tablo

| Aday | Ham üçgen | Sadeleştirilmiş | Retarget | Skin doğrulama | Not |
|---|---|---|---|---|---|
| A Quaternius Regular | — | — | denenemedi | — | **dosya yok** (ücretli Source) |
| B Quaternius Teen | — | — | denenemedi | — | **dosya yok** (ücretli Source) |
| A0 Quaternius Superhero (ek) | 13.334 | **5.908** | çalıştı (22 kemik) | ham ✓ · sade ✓ | kaş atıldı, gözler tutuldu |
| C Mevcut (kontrol) | 6.656 | gerekmez | — (kendi klipleri) | — | saç/ceket/yaka/kapüşon çökertildi |
| D Modular Men — Beach | 4.762 | **4.762** (gerekmedi) | çalıştı (20 kemik) | ham ✓ | saç/kaş/küpe atıldı, şort geometride |

Hepsi **mesh üçgeni** (GLB içindeki geometri). Render edilen üçgen (gölge geçişi dahil, 25 karakter) bu pakette
ölçülmedi. Gölge çarpanıyla çarpılıp raporlanmadı.

Mekanik muayene adayları (bilgi amaçlı, otomatik red değil):
- **A0:** 6 aday. Göz küreleri kafanın içinde, beklenen durum.
- **D:** 7 aday. Göz, kaş ve boyun parçaları kafanın içinde.
- **C:** 0 aday. Mevcut kurallar kopyalandı.

## 3. Hazırlık — her adaya aynı işlem

`bildim/harita/varlik/aday/hazirla.mjs` (üretim zamanı, Node; oyuna bağlı değil, `public/` altında değil, canlıya çıkmaz):

1. **Ölçek:** boy = mevcut karakterin boyu. A0 ×1,004, D ×1,020.
2. **Kök:** ayak altı y = 0, merkez x/z = 0. Yön kontrolü: eşlenen sol üst kol +X'te mi? İkisinde de çevirme gerekmedi.
3. **Malzeme:** kaynak dokular JSON'dan söküldü. COLOR_0/1 ve fazla UV setleri atıldı. Tek düz ten malzemesi.
4. **Çıplak:** A0'da kaş meshi atıldı. D'de saç, kaş ve küpe atıldı.
5. **Sadeleştirme:** aşağıda.
6. **Retarget:** dünya uzayında, kemik yönü hizalamalı:
   `hedef(t) = kaynak(t) · kaynakBind⁻¹ · hizala · hedefBind`.
   Kalça konumu kalça yüksekliği oranıyla ölçeklenir (A0 1,046 · D 0,957).

**Rig uyumluluğu bulgusu (D):** Modular Men rig'inde ayak kemiği baldıra değil `Root`'a bağlı (IK kemiği), uyluk da
kalçaya değil `Body`'ye bağlı. İlk denemede yalnız dönüş aktarıldı. Ayak bağlama konumunda kaldı, deri yerde incecik bir
sivri gibi uzadı. Düzeltme: zincir ebeveyni gerçek ebeveyn değilse konum da ileri kinematikle aktarılıyor
(4 kemik: UpperLegL/R, FootL/R). A0'ın UE tarzı rig'inde böyle bir kemik yok.

## 4. Sadeleştirme ve araç doğrulaması (§5)

**Araç:** `meshoptimizer 1.1.1` `simplify`. `gltf-transform simplify` aynı kütüphaneyi kullanır; ek paket kurmak yerine
doğrudan kullanıldı. `package.json`'a devDependency olarak açıkça yazıldı (zaten `@types/three` üzerinden kuruluydu).
Blender makinede yok. three.js `SimplifyModifier` kullanılmadı.

Yöntem: UV/normal dikişleri adayı bölmesin diye köşeler önce **konumla kaynaştırıldı**. Simplify yalnız bu temsilci
köşelerin **alt kümesini** tuttu. Yeni köşe üretilmedi, her köşe kendi JOINTS/WEIGHTS'ını taşıdı.

| A0 meshi | Ham | Sade | Göreli hata | JOINTS/WEIGHTS'ı değişen köşe |
|---|---|---|---|---|
| SuperHero_Male | 12.566 | 5.568 | 0,0014 | **0** |
| Eyes | 768 | 340 | 0,0125 | **0** |

**Zorunlu doğrulama, dışa aktarılıp YENİDEN OKUNAN GLB üzerinde:**

| Kontrol | A0 ham | A0 sade | D |
|---|---|---|---|
| JOINTS_0 / WEIGHTS_0 var | ✓ | ✓ | ✓ |
| Köşe sayıları POSITION ile eşit | ✓ | ✓ | ✓ |
| Ağırlık toplamı min–max | 1,0–1,0 | 1,0–1,0 | 1,0–1,0 |
| Sıfır ağırlıklı köşe | 0 | 0 | 0 |
| skin: eklem = inverseBindMatrices | 65 = 65 | 65 = 65 | ✓ |

### Sadeleştirme kaybı (A0, `03_sadelestirme_kaybi_a0.jpg`)

- **Gövde siluetinde (3/4) fark göremedim.**
- **Yüz:** en görünür kayıp. Burun kanatları, ağız köşeleri ve göz kapakları sertleşti, dudaklar düz çizgi gibi.
  Ancak bizim yüzümüz zaten atlasa boyanıyor.
- **El:** parmak araları ve eklem çizgileri yumuşadı. Parmaklar hâlâ ayrı okunuyor.
- **Dirsek ve diz bükülü:** hacim korunuyor, ham ile arasında belirgin fark göremedim.

### Deformasyon bozulması — araç mı, aday mı? (§5)

**Tek belirgin bozulma A0 "omuz kalkık" karesinde:** üst kol omuza girerken daralıyor ve koltuk altında çöküyor
(`04_a0_omuz_ham.png`, `05_a0_omuz_sade.png`).

- **Ham ve sade karede çökme birebir aynı.** Ağırlığı değişen köşe de 0. → **Sadeleştirme aracı sebep değil.**
- O karede üst kolun bağlama pozuna göre dönüşü ölçüldü:

| Model | Açılma (swing) | Burulma (twist) |
|---|---|---|
| Kaynak C, bizim Selam klibi | 61° | 82° |
| A0 | 83° | 67° |

  Burulma **bizim klipten geliyor**. Selam, 1C'de Idle'dan türetilmiş bir klip ve kolu ekseni etrafında çok döndürüyor.
  A0 rig'inde burulma yardımcı kemiği (`upperarm_twist`) yok. Doğrusal skin 67° burulmayı omuzda "şeker ambalajı" gibi
  toplar.
- **Sonuç:** bu bir adayın topoloji kusuru olarak sayılmamalı. Sebep bizim klibimiz ve yardımcı kemiksiz rig'in birleşimi.
  Kesin ayırmak için burulmasız bir kol kaldırma klibiyle yeniden bakmak gerekir; bu pakette yapılmadı.
- **Adayı elemek için yeterli sebep değil.**

## 5. Görsel değerlendirmem (§7 ölçütleri, aday aday)

İncelenen görüntüler:
- **Tam çözünürlükte açıp baktıklarım:** karşılaştırma, deformasyon ve sadeleştirme kaybı sayfaları; A0 sade, C ve D
  kontakt sayfaları; A0 omuz karesi ham ve sade; D arka ve üst görünümleri.
- **Ayrıca açıp bakmadıklarım:** A0 ham kontakt sayfası ve C/D'nin tek tek yakın çekim PNG'leri. Bunlar yalnız kontakt
  ölçeğinde görüldü.

**A ve B değerlendirilmedi (dosya yok).**

| Ölçüt | A0 Superhero (sade) | C Mevcut | D Beach |
|---|---|---|---|
| 1 Boyun | **Var**; trapez kası kafayla gövdeyi bağlıyor | **Yok**; küre kafa doğrudan torsoya oturuyor | **Var**, kısa ve köşeli |
| 2 Omuz kuşağı | **Okunuyor**; deltoid, köprücük hattı | **Yok**; kollar gövde kutusunun yanından küreyle çıkıyor | Omuz hattı okunuyor, kaba |
| 3 Torso | Tanımlı (göğüs, karın kası); **fazla kaslı** | Torba, tanımsız şişkinlik | Tanımlı ama köşeli, düz yüzeyler |
| 4 Pelvis / bacak ayrımı | **Net**; kasık ayrımı, kalça hacmi | Kalça bloğu + iki kapsül; ayrım var ama blok | Şortla örtülü; ayrım şort paçasında |
| 5 El | Beş parmak, ayrı okunuyor (sadede yumuşak) | Üç parmak + başparmak, kalın | Küçük; yakın çekim eli kaçırdı (kamera ön kola düştü), ön görünümde beş parmak seçiliyor |
| 6 Profil | Düzgün, doğal S eğrisi | Küre kafa öne ağır, gövde düz blok | Düzgün, ince |
| 7 Deformasyon | Dirsek, diz, kalça temiz; **omuz burulmada çöküyor** (§4) | Parçalar iç içe geçiyor (Selam'da kol kafaya giriyor) | Temiz, low-poly kıvrımlarla; omuz kaba ama çökmüyor |
| 8 Stil uyumu ("Şenlik") | **Uzak.** Gerçekçi süper kahraman anatomisi | Oranları sevimli (büyük kafa), yapısı ilkel | Low-poly, yüzeyleri fasetli; temiz ama "sevimli" değil, erişkin oranlı |

Ek gözlemler:
- **D'nin kaynak duruş pozu T/A değil**, hafif adımlı rahat bir poz. Ortografik ve üst görünümler bu pozda.
  Karşılaştırma sayfası ortak nötr pozu kullandığı için adil.
- **D'nin yüzeyi düz gölgeli fasetli**; bu kaynağın normalleri. Düz tek renkte faset çok belirgin.
- **C bu sayfada bilerek dezavantajlı:** yüz ve kıyafet dokusu olmadan geriye yalnız ilkel parçalar kalıyor.
  Karşılaştırmanın amacı da bunu görünür kılmaktı.

## 6. Öneri — KARARI SAHİBİ VERİR

1. **Hedef kalite seviyesi, A0'da görülen kit topolojisi.** 6 bine inerken boyun, omuz kuşağı, tanımlı torso, pelvis
   ayrımı ve okunur parmaklar korunuyor. Skin verisi sağlam, rig bizim kliplerimizi ek iş olmadan kabul ediyor.
   §1'deki beş sorunun hepsini çözüyor.
2. **Ama A0'ın kendisi değil.** Süper kahraman oranı "Şenlik"e uymuyor. Bu kitte doğru aday büyük olasılıkla
   **B (Teen)**, belki A (Regular). İkisi de **görülmeden seçilemez**. Önerim: sahibi Source paketini alırsa B'yi aynı
   sayfaya koyup öyle karar versin.
3. **D ikinci sırada, bütçe açısından en rahat aday** (4,8 bin, sadeleştirme yok). Ancak:
   - çıplak temel gövdesi yok, şort geometride
   - yüzeyi fasetli low-poly
   - rig'i IK kemikli (konum aktarımı gerekti)
   - oranı erişkin

   Seçilirse "base mesh" değil "kıyafetli karakter" alınmış olur.
4. **C** kontrol olarak beklendiği gibi en zayıf yapı; beş turun sonundaki tavanı doğruluyor.

Satın alma kararı ve A/B dosyaları gelmeden bu sayfadan kazanan seçmemeni öneririm.

## 7. Değişen dosyalar

- `bildim/harita/varlik/aday/`:
  - `hazirla.mjs`, `ustveri_uret.mjs`, `kareler.json`
  - `a0_superhero/` (kaynak gltf + bin, LICENSE, ham/sade GLB, rapor.json)
  - `d_beach/` (kaynak gltf, LICENSE, ham GLB, rapor.json)
  - `a_regular/`, `b_teen/` (yalnız `kaynak/BURAYA_KONACAK.md`)
- `bildim/harita/muayene/`:
  - `muayene.js` — aday klasörü, düz ten + çıplak, klip karesi, rol hedefi, sabit kamera, nötr poz,
    `karsilastir` sayfası
  - `calistir.mjs` — aday GLB yolu, `--karsilastir`, seçimli koşu ayrı özete yazılır
  - `ustveri/aday_*.json`, `karsilastirma/*.json`
  - `cikti/aday_*` ve `cikti/govde_*.jpg`
- `bildim/harita/gorsel/1h/` (5 görsel), `package.json` (meshoptimizer devDependency)
- **Dokunulmayanlar:** `uret.mjs`, oyun GLB'leri, yuva sistemi, kaplan, robot, harita. SQL yok.

Lisans: üç Quaternius paketi de CC0. Kaynak kayıtları:
- Universal Base Characters Standard zip: sha256 `fdbf1804…5f40`, itch.io `quaternius/universal-base-characters`
- Ultimate Modular Men: `drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX` (quaternius.com bağlantısı)

**DUR.** Kazanan seçilmedi. Yuva sistemi uyarlanmadı. Kaplan ve robota, 25 karaktere geçilmedi.
