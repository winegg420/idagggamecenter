# STIL.md — Quiz Tactics 3B Meydan: Stil Tarifi ve Teknik Şartname

> **Her varlık üretiminde (karakter, bina, prop, zemin, animasyon) bu dosya
> başa konur.** Amaç: 13 karakter + bir şehir tek elden çıkmış gibi dursun;
> birbirinden kopuk, farklı ölçekte, farklı ışıkta, farklı yoğunlukta
> parçalar üretilmesin. Şartnameden sapan varlık kabul edilmez.
>
> İlk harita: **İstanbul / Taksim Meydanı**. Konsept görsel sahibinden geldi
> (16 Eyl 2026); hedef o görselin hissi, birebir kopyası değil.
> Mevcut sahnenin ölçümü ve hedefe uzaklık: bu dosyanın sonunda.

---

## 1. Stil tarifi

Stilize, temiz formlar. Gerçekçi deri/kumaş dokusu yok, detaylı yüz yok.
Karakterler güçlü siluete sahip, sade geometri. **Kalite detaydan değil
renk ve ışıktan gelir.** Sıcak ve canlı palet, krem/bej zemin, doygun ama
yumuşak renkler. Referans yönü: Stumble Guys tarafı — basit formlar, az
üçgen, telefonda akıcı.

**"Gerçekçilik" YANLIŞ hedeftir.** Telefonda aynı anda 20-25 karakter
çizilecek; fotogerçekçilik mümkün değil. Hedef **inandırıcılık**:
doğru oranlar, hacimli gövdeler, gerçek gölgeler, malzemesi belli yüzeyler.

### 1.1 Korunacaklar (bugünkü sahnede iyi olanlar)
- Karakter oranları ve uzaktan okunaklılık (baş büyük, gövde net siluet).
- Kozmetiklerin telefonda seçilebilir olması (şapka, gözlük, üst giyim uzaktan
  fark edilir).
- Yumuşak gölgeler (tek güneş, PCF soft).
- Canlı, temiz palet; mod renkleri (`dunya.js › BINALAR`) aynı kalır.

### 1.2 Kaldırılan hatalar (bir daha yapılmayacak)
- **"Aynı kutu, farklı renk" bina.** Her girilebilir bina işlevine uygun
  ayrı siluet taşır (stadyum/kupa vitrini, arena, vitrinli mağaza, kütüphane,
  fotoğrafçı). Uzaktan siluetine bakınca ne olduğu anlaşılır.
- **Düz tek renk yüzey.** Her yüzeyin malzemesi belli: taş, sıva, tuğla,
  ahşap, cam, metal, tente kumaşı, asfalt, çim. Doku = atlas parçası;
  tek renkli `MeshLambertMaterial` yalnız geçici yer tutucudur.
- **İlkel geometriden prop** (küre yığını ağaç, silindir+küre lamba).
  Her prop modellenmiş glTF'tir.
- **Bombeli yeşil küre zemin.** Zemin düzdür; bölgeye göre malzeme değişir
  (taş meydan, asfalt sokak, kaldırım, çim yaması).
- **Boş, aşırı geniş meydan.** Sokak seviyesi dolgusu (bank, saksı, tente,
  kafe masası, bayrak, lamba) instancing ile yoğun serpilir.

### 1.3 Palet (konsept görselden çıkarılan ana renkler)
| Rol | Renk | Not |
|---|---|---|
| Zemin taşı (meydan) | `#E8DFCB` krem, `#D6CBB2` çizgi | Bugünkü değerler doğru, korunur |
| Kaldırım / bordür | `#CFC5AE` | Meydan taşından bir ton koyu |
| Asfalt (İstiklal) | `#8A8F98` → `#6F757F` | Soğuk gri, sıcak binaları öne çıkarır |
| Çim yaması | `#7CC462` | Küçük yamalar, zemin rengi değil |
| Ağaç yaprağı | `#4EA85C` / `#5CBB68` | İki ton, yuvarlak taç |
| Sıva duvar | `#F3E6D2`, `#FFE9B8`, `#DCEFF7` | Bina başına bir temel ton |
| Çatı kiremit | `#C03225`, `#2B6BA3`, `#137A45` | Mod rengiyle uyumlu |
| Vurgu (tabela, tente) | Mod rengi (`BINALAR.duvar`) | Değiştirilmez |
| Tramvay | `#C8102E` kırmızı, `#F3E6D2` krem şerit | Nostaljik Taksim tramvayı |
| Deniz | `#4FC3E8` → ufukta `#9ED9F0` | Zeminde düzlem, gökyüzü fonu değil |
| Gökyüzü | `#BFE8FF` (mevcut) | Sis `#CDEEFF` |

Doygunluk yüksek ama parlaklık yumuşak: saf `#FF0000` gibi tonlar yok.

---

## 2. Teknik şartname — varlık üretiminden ÖNCE kilitlenir

### 2.1 Tek ortak iskelet
İnsan, 10 iki ayaklı hayvan, 2-3 robot: **hepsi aynı Mixamo uyumlu insansı
iskeleti** paylaşır. Aynı kemik adları, aynı hiyerarşi, aynı boy, aynı
kozmetik yuva noktaları. Paylaşılmazsa her kozmetik ve her dans 13 kez
üretilir — işin altından kalkılmaz.

Kemik adları (Mixamo standardı, `mixamorig:` öneki dosyada durur, yükleyici
soyar):
```
Hips
 └ Spine → Spine1 → Spine2
     ├ Neck → Head → HeadTop_End
     ├ LeftShoulder → LeftArm → LeftForeArm → LeftHand
     └ RightShoulder → RightArm → RightForeArm → RightHand
 ├ LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
 └ RightUpLeg → RightLeg → RightFoot → RightToeBase
```
Parmak kemikleri **kullanılmaz** (Mixamo'nun parmaklı rig'i seçilmez; el tek
kemiktir). Toplam ≤ 25 kemik → skinning telefonda ucuz kalır.

**Kozmetik yuvaları** — iskelete bağlı boş `Empty`/`Group` düğümleri, adları
sabit; kozmetik glTF'i bu düğümün çocuğu olarak takılır:

| Yuva adı | Bağlı kemik | Ne takılır |
|---|---|---|
| `basYuva` | Head | şapka, kep, taç, boynuz |
| `gozlukYuva` | Head | gözlük türleri |
| `sacYuva` | Head | saç modelleri (peruk mantığı) |
| `sakalYuva` | Head | bıyık, sakal |
| `kulakYuva_L/R` | Head | küpe |
| `boyunYuva` | Neck | kolye, atkı, kravat, papyon |
| `elbiseYuva` | Spine2 | üst giyim (skinned, iskeleti paylaşır) |
| `altYuva` | Hips | alt giyim (skinned) |
| `ayakYuva_L/R` | LeftFoot / RightFoot | ayakkabı |
| `bilekYuva_L/R` | LeftHand / RightHand | saat, bileklik |
| `capeRoot` | Spine2 | pelerin (kendi 3 kemikli zinciri olabilir) |
| `sirtYuva` | Spine2 | sırt aksesuarı |
| `efektYuva` | Hips | parıltı halkası, yıldızlar (zemin hizası) |

Mevcut `esyalar.yuva` değerleriyle eşleme yükleyicide tek tabloda tutulur;
katalog (`esyalar` tablosu) değişmez.

Hayvan ve robot kafaları farklı hacimde olduğundan yuva **düğümü** kemikten
uzaklığını (offset) tür başına bir kez taşır; kozmetik dosyası her türde aynı.

### 2.2 Ölçek ve köken
- **1 birim = 1 metre.** Dünya buna kurulu: meydan yarıçapı 26, harita sınırı 80.
- Karakter boyu **1,80 m** (baş tepesi). 13 tür de aynı boy, aynı omuz genişliği
  aralığı (0,45-0,55 m) — kozmetik oturması için.
- **Kök noktası ayakların ALTINDA** (y = 0 zeminde). Göbekte değil.
- Bina kat yüksekliği ~3,2 m; dükkân cephesi 2 kat + çatı ≈ 9-10 m. İnsan
  ölçeğini bozacak devasa kapı yok: kapı 2,2-2,6 m.
- Karakter `+Z` yönüne bakar (three.js `lookAt` uyumu). Ölçüldü (Aşama 1): Mixamo/Soldier
  rig'i GLTFLoader ile `+Z`ye bakıyor, ek döndürme yok; Blender'dan dışa aktarımda `+Y up` korunur.

### 2.3 Çizim bütçesi (kalite artarken yük DÜŞMELİ)
| Katman | Bugün (ölçüm, §4) | Hedef | Yol |
|---|---|---|---|
| Harita (ana geçiş) | 277 çağrı / 14,9k üçgen | **≤ 60 çağrı** | tek atlas + tek malzeme, statik parçaları birleştir, prop'lar instanced |
| Karakter (3B, ana geçiş) | 61 çağrı / ~30k üçgen | **3-5 çağrı / ≤ 8k üçgen** | gövde+kıyafet tek skinned mesh + tek atlas; kozmetik = 1-2 ek çağrı |
| Karakterler toplam (25) | 25 × 61 = 1525 (sınırla 6×3B) | **≤ 120 çağrı** | 25 × ≤ 5 |
| Deniz + köprü + siluetler | yok | **≤ 5 çağrı** | düzlem + düşük detaylı köprü + 2 siluet levhası |
| Gölge geçişi | tüm castShadow'lar bir kez daha çizilir | ana geçişin ≤ %60'ı | küçük prop'lar gölge atmaz; karakter gölgesi tek disk (blob) veya düşük LOD |
| Arayüz (HUD, isim etiketi, balon) | ~10-50 sprite | kalan | isim etiketleri tek atlas sprite |

Karakter üçgen bütçesi: gövde ≤ 4k, kıyafet ≤ 2k, kozmetik parça ≤ 600, saç ≤ 800.
İkinci LOD (uzak): ≤ 1,5k üçgen, 1 çağrı. Üçüncü kademe: mevcut portre
billboard'u (2 çağrı) — sınır (`UC_BOYUTLU_SINIR`) yeniden ölçülerek ayarlanır.

### 2.4 Instancing zorunlu
Tekrar eden her obje `THREE.InstancedMesh`: ağaç, sokak lambası, bank, saksı,
çiçeklik, tente, kafe masası/sandalye, bayrak direği, çöp kutusu, martı, kedi
(hareketli olanlar da instanced — matris her kare güncellenir). Kaç tane
olursa olsun **tek çizim çağrısı**. Renk çeşidi `instanceColor` ile,
malzeme çoğaltılmaz.

### 2.5 Tek doku atlası
- Bina + prop + zemin **tek atlas**: 2048×2048 (düşük donanımda 1024 mip).
  Kanallar: albedo (sRGB). Normal/roughness haritası **yok** — stil bunu
  istemiyor, telefon bunu ödemiyor.
- Karakter türleri + kozmetikler **ikinci atlas**: 2048×2048.
- Tabelalar (metin, iki dil) çalışma anında canvas ile üretilir; **tek
  tabela atlası** (bugünkü her tabela ayrı sprite + ayrı doku yapısı kalkar).
- Sıkıştırma: KTX2/Basis **kullanılmaz** (yükleyici ağırlığı); PNG/WebP,
  boyut bütçesi toplam ≤ 3 MB.

### 2.6 Tek ışık kurulumu
Karakter ve harita **aynı ışık altında** tasarlanır; Blender'da önizleme bu
değerlerle yapılır, three'de aynısı kurulur:
- `HemisphereLight` gök `#EAF7FF` / zemin `#D9C9A8` (bej yansıma; bugünkü
  yeşil `#8FBF7A` çim içindi, kalkar), yoğunluk 0,95π.
- `DirectionalLight` güneş `#FFF3DC`, yoğunluk 1,05π, yön (28, 46, 20) —
  sağ-üst-ön, gölgeler sol-arkaya düşer (konsept görselle aynı).
- Gölge haritası 2048 (düşük donanımda kapalı), PCF soft, bias -0,0012.
- Sis `#CDEEFF`, 85 → 190.
- Malzeme: `MeshLambertMaterial` veya `MeshStandardMaterial(roughness 1,
  metalness 0)` — yansıma/parlaklık yok. Bloom/post-process **yok**
  (`prefers-reduced-motion` ve düşük donanım için zaten kapalı olmalı).
- Tone mapping: `ACESFilmic`, exposure 1,0 — karakter ve harita için aynı.

### 2.7 Format ve boru hattı
- **glTF 2.0 / GLB**, `three/addons/loaders/GLTFLoader.js` (paket kurulmaz).
- Bir varlık = bir GLB; kozmetikler tek GLB'de çok mesh, adla seçilir.
- Animasyon: Mixamo klipleri (ücretsiz, ticari kullanımda telifsiz) → tek
  iskelete retarget → `animasyonlar.glb` (yürü, bekle, zıpla, selam, dans_XX).
  Güncel TikTok koreografileri **kullanılmaz** (telif); jenerik/özgün hareket.
- Dosya yolları: `public/meydan/` altında (`karakter/`, `bina/`, `prop/`,
  `zemin/`, `anim/`). Ad kuralı: Türkçe, küçük harf, alt çizgi:
  `bina_lig.glb`, `prop_bank.glb`, `karakter_insan.glb`.
- Her GLB yanına `*.olcum.json`: üçgen, mesh, malzeme sayısı, sınır kutusu.
  Üretim betiği bütçeyi aşanı **reddeder**.

### 2.8 Kabul kriterleri (her varlık için)
1. Ölçek doğru: karakter 1,80; kapı 2,2-2,6; kaldırım 0,15.
2. Kök ayak altında / bina kök zemin merkezinde.
3. Üçgen ve çağrı bütçesi içinde (`*.olcum.json`).
4. Atlas dışında doku yok; malzeme sayısı ≤ 2.
5. Test sahnesinde (Aşama 1 sayfası) referans karakterin yanında durup
   ölçek, ışık, palet uyumu göz kontrolünden geçmiş; ekran görüntüsü alınmış.
6. Girilebilir bina: tabela + kapı ışığı + belirgin kapı. Girilemeyen: hiçbiri.
7. iOS Safari'de yüklenir (GLB ≤ 4 MB, doku ≤ 2048).

---

## 3. Mevcut dünya sabitleri (Taksim'e dönüşümde referans)
`dunya.js`: `MEYDAN_R = 26`, `YARICAP = 44`, `HAVUZ_YARICAP = 14` (kalkacak),
`HARITA_SINIRI = 80`, `KOPRU` (kalkacak). `karakterGorsel.js:167`
`UC_BOYUTLU_SINIR = 6`. `coklu.js:18` `POZ_ARALIK_MS = 100`.
Sokak (İstiklal) uzunluğu: 10 sn yürüyüşle ≤ 40 m (yürüme hızı ~4 m/sn).

---

## 4. Ölçülen mevcut durum (16 Eyl 2026)

Ölçüm yeri: `.tmp/harita-test/` kabuğu (gerçek `dunya.js`, React'siz),
Vite dev, 1920×988 canvas, three `renderer.info`, gölge açık. Sayılar
**ölçümdür, tahmin değil**. GPU: AMD Radeon tümleşik (masaüstü) — telefon
FPS'i buradan çıkarılamaz, yalnız oran karşılaştırması içindir.

| Sahne | Çizim çağrısı | Üçgen | Not |
|---|---|---|---|
| Yalnız harita, gölge **kapalı** | **277** | 14.878 | 596 mesh + 7 sprite, 457 geometri, 4 program |
| Yalnız harita, gölge açık | 654 | 41.902 | 383 castShadow mesh ikinci kez çizilir |
| + 1 gerçek 3B karakter, gölge kapalı | 338 (**+61**) | 44.676 (**+29.8k**) | karakter 81 mesh, 40.140 üçgen (gizli kozmetik parçalar dahil) |
| + 1 gerçek 3B karakter, gölge açık | 785 (**+131**) | 101.614 | gölge geçişinde karakter bir kez daha |
| + 6 3B karakter (sınır) | 1.375 | 398.244 | |
| + 1 portre billboard | +9 | +556 | sprite + gölge diski + isim etiketi |
| Harita + 25 karakter (6 3B + 19 billboard) | **1.471** | **401.660** | bugünkü kalabalık sınırında gerçek yük |

Kare süresi (CPU+GPU, `gl.finish`, masaüstü tümleşik GPU): harita 8,8 ms ·
7 karakter 14,7 ms · 25 karakter 16,5 ms. Masaüstü iGPU'da bile 60 fps
sınırında; orta seviye telefonda bu sahne 30 fps'in altında kalır.

### Hedefe uzaklık
| Katman | Bugün | Hedef | Fark |
|---|---|---|---|
| Harita çağrı | 277 | ≤ 60 | **4,6×** fazla (gölgeyle 11×) |
| Karakter çağrı | 61 | 3-5 | **12-20×** fazla |
| Karakter üçgen | ~30k görünür | ≤ 8k | 3,7× fazla |
| 25 karakter toplam çağrı | 1.471 (sınırla) | ≤ 200 (harita+karakter+UI) | **7×** fazla |
| Instanced mesh | 0 | tüm tekrar eden prop'lar | sıfırdan |
| Doku | 3 (tabela canvas'ları) | 2 atlas + 1 tabela atlası | yüzeyler tamamen dokusuz |

Not: `karakterGorsel.js` yorumundaki "57 çağrı / 33.068 üçgen" 13 Eylül
ölçümüydü; bugün 61 çağrı (kozmetik yuvaları eklendi). Yorum Aşama 6'da
yeni ölçümle güncellenecek.

---

## 5. Aşama 1 — tek test varlığı ölçümü (16 Eyl 2026)

Sahne: `/harita-deneme` (kod: `bildim/harita/deneme/DenemeSayfasi.jsx`), varlıklar
`public/meydan/deneme/` (üretici: `bildim/harita/varlik/uret.mjs`, atlas 512² tek PNG).
Ölçüm `renderer.info`, 1920×918, aynı masaüstü AMD tümleşik GPU (§4 ile karşılaştırılabilir).

| Sahne | Çizim çağrısı | Üçgen | Kare (CPU+GPU, `gl.finish`) |
|---|---|---|---|
| Zemin + asfalt + bina + tabela yazısı, gölge açık | **5** | 4.854 | — |
| + 1 karakter (3 kozmetikli), gölge kapalı | 8 (**karakter = 4**) | 9.708 (karakter ≈ 4,9k) | 0,12 ms |
| + 1 karakter, gölge açık | 13 | 19.410 | 0,14 ms |
| 25 karakter (kozmetik rastgele), gölge kapalı | **70** | 167.726 | 0,65 ms |
| 25 karakter, gölge açık | **137** | 335.446 | 1,48 ms |

Eski sahneyle karşılaştırma (§4): karakter 61 → **4** çağrı (15×), ~30k → **~4,9k** üçgen (6×);
harita+25 karakter 1.471 → **137** çağrı (gölgeli), 16,5 ms → **1,5 ms**.
Bina tek mesh 2.424 üçgen, 1 çağrı (gölgesiyle 2). Kozmetikler: şapka 598, gözlük 548, atkı 300 üçgen; her biri 1 çağrı.

Kanıtlanan zincir: GLB yükleme (GLTFLoader, dış atlas) ✓ · Mixamo iskeletli animasyon
(Idle/Walk/Run Soldier'dan aynen, Selam türetilmiş) ✓ · 22 kemik, 15 yuva (`basYuva`,
`gozlukYuva`, `boyunYuva`… dünya hizalı, rig ölçeğini geri alır) ✓ · kozmetik yuvaya 1:1 oturur ✓ ·
`SkeletonUtils.clone` ile 25 kopya, her biri kendi mixer'ıyla ✓.

Gölge kararı doğrulandı: gölge geçişi çağrıyı ikiye katlıyor (70 → 137). Kalabalıkta karakter
gölgesi blob'a düşerse 25 karakter ~75 çağrıda kalır. Bu masaüstü ölçümüdür; telefon FPS'i
canlıda `/harita-deneme` HUD'undan okunur.

Bilinen sınırlar: modeller Blender yerine kodla kurulmuş test varlıklarıdır (Stumble Guys
kalitesinde sanat değil, boru hattı kanıtı); Mixamo hesabı gerektirmeden Soldier klipleri
kullanıldı — sahibi kendi Adobe ID'siyle ek klip indirirse aynı yol çalışır.
