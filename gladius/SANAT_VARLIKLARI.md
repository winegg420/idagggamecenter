# Gladius — Sanat Varlıkları (Sprite) Rehberi

> Amaç: kod-çizim yerine **gerçek görsel varlıklar** kullanarak profesyonel (Clash of Clans
> tarzı stilize) kaliteye çıkmak. Motor altyapısı hazır: aşağıdaki adlarla PNG dosyalarını
> `gladius/assets/img/` klasörüne koy → oyun otomatik onları kullanır. Dosya yoksa geçici
> kod-çizim yedeği devrede kalır (oyun hiç bozulmaz).

## Nasıl kullanılır
1. Aşağıdaki **tam olarak belirtilen dosya adıyla** PNG'yi üret (AI görsel aracı, satın alınan
   asset paketi veya çizer — hepsi olur).
2. Dosyayı `gladius/assets/img/` içine koy.
3. `npm run dev` çalışıyorsa sayfayı yenile (veya `npm run build`). Görsel anında devreye girer.
4. Test için (login gerekmez): `http://localhost:5173/gladius/_test/onizleme-test.html` (karakter/silah)
   ve `.../motor-test.html` (arena).

## Genel teknik kurallar (ÇOK ÖNEMLİ)
- **Format:** PNG, **şeffaf arka plan** (arena görselinde arka plan opak olabilir).
- **Bakış yönü:** Yönlü tüm görseller (karakter, silah, aslan, boğa, maymun) **YUKARI (kuzey)**
  bakacak. Motor bunları oyuncunun yönüne göre döndürür. (Silah: uç/namlu yukarı, kabza aşağıda.)
- **Merkezleme:** Figür karenin ortasında, kenarlarda küçük boşluk. Pivot = kare merkezi.
- **Kuş bakışı (top-down):** Karakterlere tam tepeden bakılıyormuş gibi (omuz/kafa/miğfer üstten
  görünür). Yandan/izometrik DEĞİL.
- **Stil:** Stilize, hafif "painterly"/cel-shade, sıcak Roma/gladyatör paleti, **net siluet**,
  küçük boyutta okunur, yumuşak gölge + üstten hafif rim light. Aşırı fotogerçekçi gerek yok.
- **Boyut:** Karakter/silah/kalkan/tehdit = **512×512**. Arena = **2048×2048**. Item = **256×256**.

---

## 1) Karakterler (15) — `gladyator_<id>.png`
Kuş bakışı, YUKARI bakan gladyatör; **silah/kalkan ÇİZME** (onlar ayrı katman). Zırh + miğfer + ten
görünür. Her karakterin baskın zırh rengi kimliğidir.

| Dosya | Cinsiyet/ten | Baskın renk |
|---|---|---|
| gladyator_aeliana.png | kadın, esmer | kırmızı-mor zırh |
| gladyator_zenobia.png | kadın, esmer | altın zırh |
| gladyator_valeria.png | kadın, sarışın | yeşil zırh |
| gladyator_livia.png | kadın, sarışın | mavi zırh |
| gladyator_maximus.png | erkek | kırmızı zırh |
| gladyator_crixus.png | erkek, siyah saç | mavi zırh |
| gladyator_spartacus.png | erkek | çelik/gümüş zırh |
| gladyator_gannicus.png | erkek, sarışın | turuncu zırh |
| gladyator_varro.png | erkek | yeşil zırh |
| gladyator_barca.png | erkek, esmer | mor zırh |
| gladyator_ashur.png | erkek | zeytin zırh |
| gladyator_priscus.png | erkek | mavi zırh |
| gladyator_flamma.png | erkek | koyu kırmızı zırh |
| gladyator_tetraites.png | erkek | zeytin-yeşil zırh |
| gladyator_verus.png | erkek, esmer | altın zırh |

**AI prompt şablonu** (renk/cinsiyet kısmını tabloya göre değiştir):
```
top-down bird's-eye view of a Roman gladiator, facing up (north), centered,
stylized 2D game art, painterly cel-shaded, {RENK} armor with bronze helmet and crest,
{TEN} skin, muscular, no weapon, no shield, soft top-left lighting with rim light,
clean readable silhouette, transparent background, 512x512, game asset sprite
```

---

## 2) Silahlar (9) — `silah_<tip>.png`
Kuş bakışı, **uç yukarı / kabza aşağı**, şeffaf zemin. Tipler (motordaki çizim adları):
`kilic, sica, bicak, cift_bicak, mizrak, trident, balta, cekic, zincirli_topuz`

| Dosya | Açıklama |
|---|---|
| silah_kilic.png | düz Roma kılıcı (gladius) |
| silah_sica.png | kıvrık kısa kılıç |
| silah_bicak.png | kısa hançer |
| silah_cift_bicak.png | yan yana iki kısa bıçak |
| silah_mizrak.png | uzun mızrak, metal uç |
| silah_trident.png | üç dişli mızrak (retiarius) |
| silah_balta.png | savaş baltası |
| silah_cekic.png | savaş çekici |
| silah_zincirli_topuz.png | saplı + zincirli dikenli top (flail) |

**AI prompt şablonu:**
```
top-down view of a {AÇIKLAMA}, pointing up, handle at bottom, stylized 2D game art,
metallic steel with worn bronze fittings, soft shading, transparent background, 512x512, game asset
```

---

## 3) Kalkanlar (5) — `kalkan_<tip>.png`
Üstten görünüm, şeffaf zemin. Tipler: `yuvarlak, kucuk, kare, sovalye, savasci`
```
top-down view of a Roman {yuvarlak=round / kucuk=small round / kare=square /
sovalye=kite / savasci=hexagonal} gladiator shield, wood and bronze rim, central boss,
stylized 2D game art, soft shading, transparent background, 512x512, game asset
```

---

## 4) Tehditler — `aslan.png`, `boga.png`, `maymun.png`
Kuş bakışı, YUKARI bakan, şeffaf zemin.
- **aslan.png:** top-down lion with mane, tan fur, menacing, stylized 2D game art, facing up, transparent bg, 512x512
- **boga.png:** top-down large black bull with horns forward, muscular, dust hint, facing up, transparent bg, 512x512
- **maymun.png:** top-down small aggressive monkey, brown fur, facing up, transparent bg, 512x512

---

## 5) Arena — `arena.png` (tek görsel) + dekor
- **arena.png (2048×2048):** top-down full Roman colosseum arena — round sandy floor in center,
  stone block wall ring, tiered spectator stands packed with tiny people, a golden VIP box (loca)
  canopy on one side, warm sunset/torch lighting, subtle vignette, stylized 2D game art.
  (Tek görsel; tribün+kum+duvar dahil. Motor tam ortaya oturtur.)
- **dekor_sutun.png (512):** top-down broken stone column ruin on sand, transparent bg.
- **dekor_heykel.png (512):** top-down broken statue base ruin on sand, transparent bg.

---

## 6) Itemler (6, 256×256) — `item_<tip>.png`
`item_can` (kırmızı haçlı can şişesi), `item_hiz` (mavi hız/kanat simgesi),
`item_silah` (parlayan kılıç ikonu), `item_kalkan` (parlayan kalkan ikonu),
`item_zirh` (yeşil zırh plakası), `item_guc` (turuncu yıldırım/güç). Şeffaf zemin, ışıltı hâlesi.

---

## 7) Sesler (ayrı aşama)
Sprite'lar oturduktan sonra: `gladius/assets/ses/` altına gerçek ses dosyaları (isabet, kalkan,
ıska, ölüm, borazan, item) eklenip `ses.js` bunları çalacak şekilde güncellenecek. (Şimdilik
WebAudio sentezi devrede.)

---

## Öncelik önerisi (en çok fark yaratan sıra)
1. `arena.png` (tüm ekranın zemini — en büyük görsel etki)
2. `aslan.png`, `boga.png`, `maymun.png` (şikâyet edilen tehditler)
3. `gladyator_*.png` (özellikle Maximus + en sık görünenler)
4. Silah + kalkan + item ikonları

İlk 2-3 görseli koyup test edelim; yönü/kaliteyi birlikte ayarlarız, sonra kalanına geçeriz.
