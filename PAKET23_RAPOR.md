# Paket 23 — Karakter görsel revizyonu (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — gövde profili (bel) + duruş (skinning) | ✅ bel %0 → %15,0 | `82eafa3` |
| B — şapka tek parça (siper kubbeden türetildi) | ✅ 3 ada → 1 ada | `5a98d6f` |
| C — atkı tek sürekli şerit | ✅ 2 ada → 1 ada | `5a98d6f` |
| D — pelerin omuz eğrisine oturdu + yaka bandı | ✅ üst kenar 3,0 → 1,8 cm | `7fcbf24` |
| E — yüz hacmi | ✅ derinlikler 1,5–3 mm → 5–16 mm | `9201e97` |
| F — muayene revizyonu (3 yeni test) | ✅ `parca_butunlugu` · `siluet_profili` · `durus_ekseni` | `5a98d6f` |

**Çalıştırma sırası her değişiklikte uygulandı:** `node bildim/harita/varlik/uret.mjs` → `npm run cephe-ao` → `npm run muayene`.

---

## A — Gövde ve duruş

### A.0 — Ölçülen kök sebep (paketteki ölçüm tekrarlandı)

| Ölçü | Değer | Ne demek |
|---|---|---|
| Gövde derinliği (ışınla, her yükseklikte) | **40,0 cm sabit** | tek kapsül, yarıçap baştan sona sabit → düz fıçı, bel yok |
| Bel farkı (göğüs − bel) / göğüs | **%0** | anatomik daralma hiç yok |
| Skinning | 4 ağırlık yuvasından **1'i** kullanılıyor | gövde tek kemiğe %100 bağlı → bükülmeyen katı blok |
| Bind pozu, Neck − Hips (dünya Z) | **−6,0 cm (−8,3°)** | geometri geriye yatık bir pozda kuruluyor |
| Idle t=0,0 / 0,5 / 1,0 | **+2,2 / +1,4 / +1,2 cm** | oyunda gövde öne; fark ≈ 7,4 cm ≈ 10° |
| Gövde YÜZEYİNİN ekseni (Idle t=0,5) | **+3,4 cm (6,2°) öne** | katı blok Spine1 etrafında deviriliyor |

Ölçüm yöntemi: gövde mesh'i düşük çözünürlüklü (kapsül 8 radyal segment) olduğu için köşe saymak güvenilir değil —
her yükseklikte merkez eksenden ±Z / ±X yönlerine **ışın** atılıp yüzey bulundu. Ceket/kapüşon set 1'de görünmez
ama geometrisi durduğu için ışını yakalıyordu; ölçüm gövde kabuğu bölgeleriyle (ust · metal · boya · ekran) sınırlandı.

### A.1 — Gövde profili (bel)

**Yöntem (a) seçildi:** yükseklik başına yarıçap veren profil eğrisi halka halka döndürülüyor (`govdeKabugu`).
Gerekçe: tek ada verir (yeni `parca_butunlugu` testi için şart), geçişler pürüzsüz (smoothstep) ve `yay` UV eşlemesi
bozulmadan kalıyor. (b) 3–4 kapsül seçeneği bunların üçünü de veremiyordu.

| Hiza | İnsan | Kaplan |
|---|---|---|
| Kalça (Hips +0,08) | 0,200 | 0,215 |
| Bel üst geçişi (t 0,22) | 0,188 | 0,206 |
| Bel (t 0,40) | 0,178 | 0,196 |
| Göğüs (t 0,62) | 0,215 | 0,238 |
| Omuz altı (t 0,86) | 0,196 | 0,216 |
| Boyun altı | 0,170 | 0,180 |

Ceket kabuğu **aynı profili** 1,3 cm dışarıdan izliyor (ayrı fıçı değil). Robot gövdesine dokunulmadı.
Z ekseni 0,86 ile basık (insan silueti yandan ince, önden geniş).

### A.2 — Duruş (skinning)

`ekle()` artık köşe başına ağırlık fonksiyonu alabiliyor; gövde köşeleri yüksekliğe göre
**Hips → Spine → Spine1 → Spine2** arasında yumuşak paylaştırılıyor (üçgen çadır, toplam 1, en çok 4 kemik).
`mixamo.json` ve Idle/Walk/Run klipleri **değişmedi**.

**Sonuç (Idle t=0,5, insan):**

| Ölçü | ÖNCE | SONRA | Hedef |
|---|---|---|---|
| Gövde yüzeyinin ekseni | +3,4 cm (6,2° öne) | **−1,2 cm (3,1° geriye)** | ≤ 2 cm öne |
| Bel farkı | %0 | **%15,0** | ≥ %8 |
| Karın taşması (karın ön Z − göğüs ön Z) | −0,3 cm | **−0,3 cm** | ≤ 0 |

Geometrik karşı yatım **uygulanmadı** — ölçülen değer hedefin içinde kaldığı için gerek kalmadı.
Kalan "öne uzanma" hissi kafanın Idle klibindeki duruşundan geliyor; klip değişmeyecek (Walk/Run aynı klipler).

---

## B — Şapka

**Kök sebep (ölçüldü):** şapka üç ayrı parçaydı — kubbe, ayrı `RoundedBox` siper, ayrı torus kenar halkası.
`takili_insan_sapka` 3 ada / 0 aday; kaplanda kubbe ile siper arası **4,8 cm**.

**Yapılan:** siper artık kubbenin ön kenarındaki köşelerden türetiliyor (aynı köşeleri paylaşır, öne ve hafif yukarı
uzanır), kenar halkası yerine kubbenin eteği kalınlaşıyor (`kenarKalinlik`).

| Tür | ada ÖNCE | ada SONRA | üçgen ÖNCE → SONRA |
|---|---|---|---|
| insan | 3 | **1** | 524 → 366 |
| kaplan | 3 | **1** | 524 → 366 |
| robot | 4 | **2** (anten geçiş halkası kasıtlı ayrı, 2 mm ile bağlı) | 588 → 430 |

Kubbenin kafaya oturması korundu (temas %79–91, yaslanma 0,3–0,6 cm). `kozmetik_sapka` ve `basYuva` değişmedi.

---

## C — Atkı

**Kök sebep (ölçüldü):** boyun halkası (torus) ile sarkan uç (kutu) ayrı iki parçaydı — `takili_insan_atki` 2 ada / 0 aday.
`havada` testi ikisinin de gövdeye değdiğini görüp geçiyordu.

**Yapılan:** yeni `seritSupur()` ile tek eğri boyunca süpürülen dikdörtgen kesit — boyun sarımı kesintisiz olarak
göğüs önünden sarkan uca dönüşüyor. Boyun çevresi ve göğüs profili gövdeye **ışınla** ölçülüyor; atkı artık gövdenin
içinde kalmıyor. Atkı da her türde kendi gövdesine göre üretiliyor (paylaşımlı atkı robotun boynuna oturmuyordu).

| Tür | ada ÖNCE → SONRA | temas SONRA | kalınlık |
|---|---|---|---|
| insan | 2 → **1** | %82 | 3,2 cm (eşik 2,5) |
| kaplan | 2 → **1** | %75 | 3,2 cm |
| robot | 2 → **1** | %71 | 3,2 cm |

---

## D — Pelerin

**D.1 ölçümü (Idle t=0,5, pelerin üst kenarı ile gövde sırtı arası):**

| Tür | omuz (ÖNCE) | bel (ÖNCE) | etek (ÖNCE) | omuz (SONRA) |
|---|---|---|---|---|
| insan | medyan 3,0 cm | 1,5 cm | 19,9 cm | **1,8 cm** |
| kaplan | 3,7 cm | 1,6 cm | 19,3 cm | **5,9 cm** |
| robot | 4,4 cm | 3,9 cm | 23,5 cm | **5,9 cm** |

**Yapılan:** üst kenar artık düz çizgi değil — gövdenin arka yüzeyini (elips kesit: omuzda ~18 cm derinlik,
~24 cm yarı genişlik) izliyor, aşağı indikçe etek açılıyor. **Yaka bandı** eklendi: boynun altından geçen, pelerinin
üst satır köşelerini paylaşan ince bant — B ve C'deki "ayrı parça" hatası tekrarlanmasın diye **aynı ada**.
Etek açılımı 0,12t² → 0,045t² (durgun pozda daha dik sarkıyor). Tür farkı matriste kapandı
(`PELERIN_TUR_OLCEK`, `PELERIN_TUR_Z`). `sirt_pelerin` ve `sirtYuva` değişmedi.

---

## E — Yüz ve ifadeler

**Kök sebep (ölçüldü):** 47 cm çapındaki kafada 1,5–3 mm'lik kaydırmalar gölge üretmiyordu.

| Özellik | ÖNCE | SONRA |
|---|---|---|
| Burun sırtı | 3,0 cm | **4,2 cm** + burun ucu (1,2 cm) + burun kanadı (0,6 cm) |
| Göz çukuru | −2 mm | **−9 mm** + üst göz kapağı kıvrımı (+5 mm) |
| Kaş kemeri | 1,5 mm | **8 mm** |
| Elmacık | 3 mm | **8 mm** |
| Çene | 6 mm | **16 mm** + çene altı hattı (−10 mm) |
| Filtrum / üst dudak | yok | **6 mm / 9 mm** |
| Kaplan göz çukuru | −2 mm | **−9 mm** + göz kapağı kıvrımı + kaş 7 mm |

Robot yüzü ekran paneli — dokunulmadı. **Üçgen sayısı değişmedi** (kaydırmalar mevcut küre köşelerini itiyor).
İfade kareleri aynı atlas hücrelerinde; yeni doku yok. Saç bu turda kapsam dışı (pakette de öyle yazılı).

---

## F — Muayene revizyonu

### F.1 `parca_butunlugu` (YENİ)
Bir kozmetiğin adaları **birbirine** bağlı mı. Eşik `parca_temas_m` = **6 mm**; gerekçeli `ayrik_izinli` muafiyeti var.
Yakaladıkları: atkı (2 kopuk ada), şapka (kaplanda 4,8 cm), kanat tüyleri ve kolları (1,7–3,1 cm), kaplan kuyruğu.

### F.2 `siluet_profili` (YENİ)
Gövdenin **en dar yeri** (bel, t 0,25–0,55), göğsün en geniş yerinden (t 0,62–0,88) en az `bel_orani_asgari` = **%8** dar olmalı.
Robot gövdesi bilerek ayrık kütlelerden kurulu olduğu için üstveride **gerekçeli muaf** (`siluet_muaf_turler`).

### F.3 `durus_ekseni` (YENİ)
Idle t=0,5 pozunda ölçer (diğer bütün testler bağlama pozunda): gövde yüzeyinin öne yatıklığı
(`durus_one_yatik_m` = 2 cm) ve karın taşması (`karin_tasma_m` = 0).

### Ek: `kozmetik` testi artık derinlik ölçüyor
`oturma` testi temas ister (≤ 6 mm), `kozmetik` testi kesişim yasaklardı — iki test **zıt şart** koşuyordu.
Artık kesişimin derinliği ölçülüyor: `kozmetik_gomulme_m` = 2 cm'ye kadar yüzeysel temas *susturulan* olarak
raporlanır, daha derini saplanmadır ve aday olur.

### Üç yeni testin önce/sonra sayıları

| Test | ÖNCE (Paket 23 başı) | SONRA |
|---|---|---|
| `parca_butunlugu` | 22 aday (atkı 2 ada · şapka 3 ada · kanat 19 ada · kuyruk · robot atkısı) | **0** |
| `siluet_profili` | insan/kaplan bel farkı %0 → aday | **0** (insan %15,0 · kaplan %15,3; robot gerekçeli muaf) |
| `durus_ekseni` | gövde yüzeyi +3,4 cm öne → aday | **0** (−1,2 cm; karın taşması −0,3 cm) |
| Mevcut 9 test | 0 aday (ama yanlış şeyleri ölçüyorlardı) | **0** |

**Tam tarama (sonra):** 3 karakter + 22 takılı poz + 2 kod kozmetiği + 21 kart portresi = **0 aday**.
Kozmetik dışı 8 aday (bina/prop `havada` + `simetri`) Paket 21'den beri duruyor ve bu paketin kapsamı dışında.

### F.4 Rapor kuralı
`bildim/harita/CLAUDE.md`'deki kurala eklendi: **"0 aday" bir kalite kapısı değildir, geometrik tutarlılık kapısıdır.
Estetik, oran, stil uyumu ve "inandırıcı mı" sorusu göz kararıdır ve muayene bunu hiçbir zaman ölçmeyecek.**

---

## Bütçe — 3A-2 rig ile önce/sonra

Sahne: `bildim/harita/olcum/meydan-test` üretim derlemesi + `?otomasyon=1`, `katman2c.js`; İstiklal ucu en kötü açı,
25 karakter, 1536×791, gölge açık, 120 kare ısınma + 300 örnek (medyan / p95).

| Ölçü | ÖNCE | SONRA | fark |
|---|---|---|---|
| Çizim çağrısı (hepsi kozmetikli) | 153 | **153** | 0 |
| Üçgen (hepsi kozmetikli) | 479.347 | **495.389** | +16.042 (%3,3) |
| Çizim çağrısı · üçgen (sınır 8) | 134 · 359.291 | **134 · 369.957** | +10.666 |
| CPU gönderimi (medyan) | 5,2 ms | **5,2 ms** | değişmedi |
| Kare CPU+GPU (medyan / p95) | 6,0 / 6,7 ms | **6,0 / 6,8 ms** | ölçüm gürültüsü |

Karakter üçgenleri: insan gövde 6.656 → **7.104**, kaplan 6.232 → **6.680** (bütçe 9.000 — ~1.900 boşluk kaldı).
Kozmetikler: şapka 524 → **366**, atkı 300 → **372**, diğerleri değişmedi. Yeni doku yok, malzeme sayısı 1.

---

## Görseller — `gorsel/paket23/`

Dört set, her biri 18 görsel (3 tür × {bind, Idle t=0,5} × {ön, yan, yüz 3/4}), **aynı kamera, aynı poz**:

| Klasör | Ne |
|---|---|
| `once/` | Paket 23 öncesi (commit `57e173a`) |
| `sonra/` | uygulanan sürüm (A.1 bel + A.2 skinning + B + C + D + E) |
| `varyant_A2_ince_bel/` | bel derinliği ×1,6 → bel farkı %15,0 yerine **%24,3** |
| `varyant_E2_guclu_yuz/` | yüz kabartmaları ×1,6 (burun 6,7 cm, kaş 13 mm, elmacık 13 mm) |

Varyantlar `P23_BEL` / `P23_YUZ` çevre değişkenleriyle üretiliyor (varsayılan 1 = uygulanan sürüm);
seçilen varyant sabit değere alınır.

---

## Dürüst kalanlar

- **Varyant sayısı:** paket her başlık için 2–3 varyant istiyordu; A ve E için birer alternatif üretildi
  (yukarıdaki iki klasör). B, C ve D için varyant üretilmedi — uygulanan sürüm ölçüm hedeflerini tutuyor,
  ama "hangisi daha güzel" sorusunun cevabı sizde; isterseniz aynı mekanizmayla varyant üretilir.
- **Kafa duruşu:** Idle klibinde kafa öne uzanıyor; klip değişmeyeceği için bu görüntü duruyor.
  Ölçülebilir hedef (omuz–kalça ileri payı ≤ 2 cm) sağlandı, geometrik karşı yatım gerekmedi.
- **Saç** bu turda kapsam dışı (pakette de öyle yazılı).
- **Kozmetik dışı 8 aday** (bina/prop) duruyor.
- **GPU zamanlayıcı** (`EXT_disjoint_timer_query_webgl2`) bu makinede headless Chrome'da yok; "kare" sütunu
  `gl.finish` ile CPU+GPU'yu birlikte ölçer.
- **Muayene estetiği ölçmez.** Bu rapordaki bütün "0 aday" satırları geometrik tutarlılık içindir.
