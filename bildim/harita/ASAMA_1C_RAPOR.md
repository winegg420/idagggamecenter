# AŞAMA 1C RAPORU — Karakter kalitesi, kıyafet çeşitliliği, türler (16 Eyl 2026)

Sahne: `/harita-deneme` (kod `bildim/harita/deneme/DenemeSayfasi.jsx`), varlıklar `public/meydan/deneme/`
(üretici `bildim/harita/varlik/uret.mjs`, atlas `atlas.mjs`, AO `ao.mjs`). Ölçüm `renderer.info` (gölge geçişi dahil),
1920×918 canvas, masaüstü AMD Radeon tümleşik GPU (ANGLE D3D11). Kare süresi `gl.finish()` ile CPU+GPU.
**Telefon FPS'i ölçülmedi** — tahmin yazılmadı.

Görseller: `.tmp/asama1c-gorseller/` (numaralı; aşağıda dosya adıyla anılır). "Önce" görselleri Aşama 1B klasöründen.

## 0. Özet tablo (§10 bütçe kontrolü)

```
                                    ÖNCE (1B)      SONRA (1C)      BÜTÇE      Not
1 karakter (insan, 3 kozmetik) çağrı      5              5            —      gövde 1 + kozmetik 3 + gövde gölgesi 1
                               üçgen  13.110         12.044           —      gövde 5.298 ×2 gölge + kozmetik 1.446
25 karakter (karışık tür/kıyafet)
  yalnız karakterler, Geniş    çağrı     97             88         ≤143      taban (bina+zemin+tabela) düşüldü
                               üçgen 314.236        275.160     ≤340.000
  yalnız karakterler, Oyun     çağrı      —             59           —       kamera kesmesi (frustum) — 261.928 üçgen
Çevre + bina + kediler         çağrı     14             14          ≤60      bina 2 + zemin 1 + tabela 2 + prop 8 + kediler 1
                               üçgen  67.700         67.890      ≤80.000    zemin 3.058 · bina 4.804 (×2 gölge) · 3 kedi 1.956
TOPLAM (25 karakter + çevre)   çağrı    111            102         ≤220
                               üçgen 381.904        343.050     ≤420.000
Kare süresi (masaüstü)          2,45 ms         2,14 ms (Geniş) · 2,22 ms (Oyun) · 60 fps
Telefon                       ölçülmedi       ölçülmedi
```

Tür başına tek karakter (kozmetiksiz gövde, gölge dahil): insan 2 çağrı / 10.596 · kaplan 3 / 9.700 (kuyruk) ·
robot 2 / 10.292 — hepsi ≤5,5 çağrı / ≤13,5k şartının altında. Kaplan/robot GLB: 4.986 / 5.146 üçgen.

## 1. Kafa/gövde 180° yön hatası — teşhis ve kök sebep (§1)

**Teşhis testi:** `.tmp/varlik/yon_testi.mjs` (Node, sahnesiz). Bind pozunda, Idle ve Walk karelerinde yüz merkezi ile
ayak burnunun dünya z'si yazdırılır.

```
┌──────────────────────────────────────────────────────────────────────┐
│ SONUÇ: A KUTUSU — bind matrisi / kök dönüşü (geometri yönü)           │
│                                                                      │
│ Test A (bind pozu, klip yok):  yüz z = +0,23   ayak burnu z = −0,14  │
│   → kafa ve gövde daha animasyon başlamadan ters. Klip suçlu değil.  │
│ Test B (Idle 0. kare):        aynı işaretler (klip yönü değiştirmez) │
│ Test C (Walk):                aynı                                   │
│                                                                      │
│ Kök sebep: Mixamo/Soldier rig'i ileri = −Z; kök kemikte π dönüş var. │
│ Geometri dünya uzayında +Z'ye bakacak şekilde kuruluyordu ama        │
│ skinned mesh kök (Yon) altına bağlanıyordu → bind matrisi π'yi bir   │
│ kez daha uyguladı: kafa +Z'de kaldı, iskelete bağlı gövde −Z'ye      │
│ döndü (kafa kemiğe göre ters, ayaklar doğru gibi görünüyordu).       │
│                                                                      │
│ Düzeltme (uret.mjs): ON = +1 (yüz +Z), kök π sabit, skinned mesh     │
│ birim dönüşlü `karakter` kökü altında `mesh.bind(iskelet)`.          │
│ İlk deneme (ON = −1) hatayı büyüttü: W() zaten kök π'yi içeriyordu.  │
│ Sonuç: yüz z = +0,20 / burun z = +0,12 (bind, Idle, Walk).            │
└──────────────────────────────────────────────────────────────────────┘
```

Kanıt: `0-once-hata-onden.jpg` (kafa öne, gövde arkaya) → `17-walk-onden-son.jpg` (yüz, göğüs, ayak burnu aynı yöne) ·
`18-walk-arkadan-son.jpg` (saç arkası, ense, atkı düğümü). Commit `d73a2c2`.

## 2. Çapa testi — tekrar (§2)

9 donuk kare (Idle · Walk×3 · Run×3 · Selam×2), şapka+gözlük+atkı, her yuvada `AxesHelper`: `19-capa-9-kare.jpg`,
yakın 5 kare `20-capa-yakin-5-kare.jpg`. Yön düzeltmesinden sonra **hiçbir karede kozmetik kaymadı**: şapka kafada,
gözlük göz hizasında (yeni yüz dokusuyla göz kareleriyle çakışıyor), atkı boyunda. Yüz artık kozmetiklerle aynı yönde.

## 3. Kıyafet setleri ve görünüm çeşitliliği (§3)

- **3 set**, yuva/bölge sistemiyle: Günlük (tişört+kot+spor ayakkabı) · Şık (ceket+yaka+kumaş pantolon+deri ayakkabı) ·
  Spor (eşofman+kapüşon). Set parçaları GLB'de hazır, `bolge` özniteliğiyle işaretli; set seçimi parçaları açar/kapar
  ve UV'yi ilgili atlas hücresine taşır. Yeni doku dosyası ve yeni malzeme **yok** (tek atlas, tek malzeme).
- Ton: nötr (beyaz) atlas hücresi × köşe rengi (`COLOR_0` AO ile çarpılır) — kopya başına geometri klonu, malzeme paylaşımlı.
- 3 saç modeli (kase / kısa / at kuyruğu), 4 ten, 4 saç rengi, 8 üst / 5 alt / 4 ayakkabı rengi.
- 25 karakterde deterministik karışım: set·ten·saç rengi·üst rengi periyotları 3·4·4·8 → **24 kopyanın tamamı farklı**
  (şart ≥12). Tür: her 5'te 1 kaplan, 1 robot (15 insan · 5 kaplan · 5 robot).
- Görseller: `25-kiyafet-2-sik.jpg`, `26-kiyafet-3-spor.jpg`, `6-25-karisik-oyun.jpg`, `14-25-genis-isik-Bplus.jpg`.

## 4. Sokak kedileri, kaplan ve robot (§4)

**Kediler:** `prop_kedi.glb` 652 üçgen (≤800), 4 ayak, kuyruk, kulak; 3 kedi tek `InstancedMesh` (1 çağrı, gölge atmaz,
temas gölgesi var). Davranış yerel ve deterministik (tohumlu): yürü → dur → otur → yön değiştir; ağ trafiği yok,
etkileşim yok. `8-kedi-yakin.jpg`, geniş planda `14-25-genis-isik-Bplus.jpg` (3 kedi).

**Kaplan:** aynı Mixamo iskeleti + 15 yuva. Çizgili kürk hücresi, burun/yanak beyazı, kulaklar `kulakYuva` konumunda
(şapkanın iki yanından çıkar — `4-kaplan-kozmetik.jpg`), kuyruk `sirtYuva`'da (`kozmetik_kuyruk`, çalışma anında sallanır).
Şapka+gözlük+atkı aynen oturur.

**Robot:** aynı iskelet; metal gövde, göğüs paneli+ekran, anten (kafa üstü, şapka takılıyken şapka üstünden çıkar),
emissive gözler (bölge 12 shader'da emissive) ve robot göz/ağız kareleri. `5-robot-kozmetik-kiyafet2.jpg`.

Bütçe tür başına: kaplan 3 çağrı / 9.700 üçgen, robot 2 / 10.292 (≤5,5 / ≤13,5k).

## 5. Yüzey cilası (§5)

- **Bölge başına pürüzlülük** tek malzemede: köşe özniteliği `_bolge` (glTF `_BOLGE`), shader'da 21 girişli tablo
  (ten 0,55 · saç 0,65 · kumaş 0,9–1,0 · deri ayakkabı 0,45 · metal 0,35 · cam 0,15 · ekran 0,2 emissive).
- Saç: hacim iki parçaya bölündü (kase + tepe/perçem), desen kontrastı yarıya indi.
- **Boyalı yüz**: atlas 4×4 hücrelik çeyreğinde insan/kaplan/robot yüzü (256²) + ifade şeridi (8 göz + 8 ağız).
  Kafa küresi ön yarısı düzlemsel UV ile yüz dikdörtgenine, arkası kenar şeridine düşer. Göz/ağız ayrı dörtgen; ifade =
  UV kaydırma (geometri klonunda), çizim çağrısı eklemez. Dörtgenler en yakın kafa köşesinin AO'sunu alır (kare izi yok).
- Göz kırpma: karakter başına zamanlayıcı, 3–6 s arayla 120 ms kapalı. Selam klibinde gülümseme.
- Eller yassılaştırıldı + bilek halkası, ayakkabıda taban çizgisi bölgesi.
- Önce/sonra aynı açı: `asama1b-gorseller/3-foto-AO-acik-atlas-yeni.jpg` (düz küre yüz) → `3-yuz-yakin-goz-acik.jpg`.
  Göz açık/kapalı: `3-yuz-yakin-goz-acik.jpg` ↔ `23-yuz-goz-kapali.jpg`; gülümseme `24-yuz-gulumseme-selam.jpg`.

## 6. Ağaçlar (§6)

- Yaprak deseni: dama yerine geniş yumuşak lekeler, kontrast %22 → %12 (−45 %); A/B `atlas_yaprakEski.png` ile
  **yaprak eski/yeni** düğmesi: `11-yaprak-eski.jpg` ↔ `12-yaprak-yeni.jpg` (saksı çalısında `21` ↔ `22`).
- Boy: ölçek 1,0 → **0,7** (−30 %), varsayılan küçük; **ağaç boyu** düğmesi: `9-agac-boyu-normal.jpg` ↔ `10-agac-boyu-kucuk.jpg`.
  Taç altı 2,6 m'den başlar (karakter 2,1 m) — karakterin başı taca girmez.
- Yerleşim dış kaldırım hattına (z 0,6 ve 11,4) alındı, taç çok loblu (3 küre). Kamera–oyuncu arasına yüksek bitki gelmez.
- STIL.md'ye kural eklendi (§1.4): "Çevre oyuncuyu çerçeveler, oyuncunun önüne geçmez."

## 7. Işık B+ (§7)

Güneş 1,15π → 1,29π (+12 %), gök 0,45π → 0,405π (−10 %), gölge radius 4 → 3, pozlama 1,12 → 1,08, ortam 0,25 aynı.
Düğme **ışık B / B+ / A**. `13-25-genis-isik-B.jpg` ↔ `14-25-genis-isik-Bplus.jpg`: B+ gölgeler biraz daha keskin ve
kontrast yüksek, beyaz cepheler yanmıyor. Varsayılan B+.

## 8. Zemin (§8)

`zemin_deneme.glb` (3.058 üçgen, 1 çağrı): 2 m karo kaldırım (derzli karo hücresi), görünür bordür, 4 m asfalt şerit,
yaya geçidi çizgileri, çim yamaları — eski düz zemin düzlemleri kaldırıldı, **+0 ek çağrı** (önce zemin+asfalt 2 çağrıydı,
şimdi 1). `7-cevre-bank-agac-kaldirim.jpg`, `14-25-genis-isik-Bplus.jpg`.

## 9. Bina tessellation (§9)

0,5 m → **0,8 m ızgara, yalnız ön cephe** (`bolunmusKutu`: derinlik bölümü 1): 9.840 → **4.804 üçgen** (−51 %).
AO hâlâ okunur: `15-bina-AO-acik.jpg` ↔ `16-bina-AO-kapali.jpg` (kapı girintisi, saçak altı, vitrin çerçevesi kararır;
AO ort 0,654 / min 0,15).

## 10. Düğmeler (§11 teslim listesi)

Idle/Walk/Run/Selam ✓ · **tür** insan/kaplan/robot ✓ · **kıyafet 1/2/3** ✓ · kozmetik sapka/gozluk/atki ✓ · **ifade**
normal/gülümseme/şaşkın ✓ · 25 karakter ✓ · gölge ✓ · çevre ✓ · **kediler** ✓ · **ağaç boyu** ✓ · AO ✓ · atlas eski/yeni ✓ ·
**yaprak eski/yeni** ✓ · **ışık B/B+** ✓ · çapa testi ✓ · Geniş/Oyun/Fotoğraf ✓ · HUD (çağrı · üçgen · fps · ms · karakter) ✓.
Konsol hatası: **0** (tüm seri boyunca `read_console_messages` boş).

## 11. Kurallar (§12)

Kod silinmedi; `SkeletonUtils`, yuva sözleşmesi, HUD aynı. SQL/migration yok. Yeni doku dosyası yok (A/B için üretilen
`atlas_yaprakEski.png` aynı atlasın varyantıdır, çalışma anında tek malzeme tek haritayla çizer). `npm run build` temiz.
Commit'ler öncelik sırasıyla (§1 `d73a2c2`, ardından §3+§5 varlık/atlas, §4 tür+kediler, §6–9 çevre/ışık/zemin, rapor).

## Açık konular
- Telefon FPS ölçülmedi; canlı `/harita-deneme` HUD'undan okunur.
- Karakter üçgeni 25'te 275k: sert sınırın (340k) %81'i. Aşama 2'de LOD (uzak ≤1,5k) bu payı düşürür.
- Çapa testinde kediler gizlenmiyor (çevre gizleniyor); teste etkisi yok.
- **Aşama 2'ye (13 karakter) geçilmedi — DUR NOKTASI.**
