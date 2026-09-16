# AŞAMA 2 — S-1 + S0 ÖLÇÜM RAPORU: 1C ↔ 1D kare süresi regresyonu (16 Eyl 2026)

Kapsam: `ASAMA_2_BUTCE_NOTU.md` EK bölümünden **yalnız S-1 ve S0.** S1/S2 yalnız S0 regresyon gösterirse yapılacaktı;
S3/S4/S5'e dokunulmadı. Bu pakette oyun/test kodu değişmedi; ölçüm dışarıdan (tarayıcıya enjekte edilen betikle) alındı.

## Sonuç

**S0 kararı: fark < %10 → eşiğe göre regresyon yok. S1 ve S2'ye geçilmedi.**

Birincil metrik (`kareSuresi()`, CPU+GPU, `gl.finish` vekili, kare başına medyan) 1C'de **2,8 ms**, 1D'de **3,0 ms**:
fark **+%7,1**. Ancak fark **yönlü ve tekrarlı**: üç çiftin üçünde de 1D daha yavaş, GPU zamanlayıcısı da aynı yönde
**+%6,5** gösteriyor. Yani "saf gürültü" değil, **küçük ama gerçek bir maliyet (~0,2 ms)** var; S0 eşiğinin (%10) altında kaldığı için
S1/S2 tetiklenmedi. Bu ayrım karar için yazılıyor, eşik yorumu değiştirilmedi.

Eski raporlardaki "1C 2,14 ms ↔ 1D 2,8–3,2 ms" farkının büyük kısmı **ölçüm koşullarından** geliyordu: aynı koşulda 1C de
2,7–2,8 ms ölçülüyor. 2,14 ms bugünkü koşullarda yeniden üretilemedi (eski ölçüm dev modu, DPR 1,25, ısınmasız 30 karelik ortalamaydı).

## Ölçüm tablosu (3 çift, dönüşümlü, her koşu sayfa yeniden yüklenerek)

Tüm ms değerlerinin yanında metrik adı var (S-1). Hücrelerde koşu başına **medyan**; son sütun üç koşunun medyanı.

| Metrik | Sürüm | Koşu 1 | Koşu 2 | Koşu 3 | **Medyan** | 1D − 1C |
|---|---|---:|---:|---:|---:|---:|
| **Çizim proxy, kare başına — CPU+GPU (`gl.finish`), medyan** | 1C | 2,8 | 2,8 | 2,7 | **2,8 ms** | |
| | 1D | 3,0 | 3,0 | 3,0 | **3,0 ms** | **+%7,1** |
| Çizim proxy, kare başına — CPU+GPU (`gl.finish`), p95 | 1C | 4,8 | 4,7 | 4,9 | 4,8 ms | |
| | 1D | 4,9 | 4,9 | 4,4 | 4,9 ms | +%2,1 |
| Çizim proxy, 10 karelik blok ortalaması — CPU+GPU (`gl.finish`), medyan | 1C | 3,14 | 3,15 | 3,23 | 3,15 ms | |
| | 1D | 3,18 | 3,37 | 3,04 | 3,18 ms | +%1,0 |
| **GPU zamanlayıcı — `EXT_disjoint_timer_query_webgl2`, medyan** | 1C | 1,732 | 1,666 | 1,658 | **1,666 ms** | |
| | 1D | 1,775 | 1,734 | 1,913 | **1,775 ms** | **+%6,5** |
| GPU zamanlayıcı, p95 | 1C | 3,113 | 3,582 | 3,584 | 3,582 ms | |
| | 1D | 3,596 | 3,760 | 2,485 | 3,596 ms | +%0,4 |
| HUD — yalnız CPU gönderim (`render.render` süresi, 500 ms pencere ortalaması; 6 okuma medyanı) | 1C | 1,37 | 1,56 | 1,47 | 1,47 ms | |
| | 1D | 1,43 | 1,58 | 2,37 | 1,58 ms | +%7,1 (koşu 3 sapkın) |
| Toplam kare süresi — `requestAnimationFrame` aralığı | her ikisi | — | — | — | **ölçülmedi** | sekme gizli (`visibilityState: hidden`), rAF duruyor |
| Çizim çağrısı (`renderer.info`, gölge dahil) | 1C / 1D | 102 | 102 | 102 | 102 / 102 | 0 |
| Üçgen (`renderer.info`, gölge dahil) | 1C / 1D | 343.050 | | | 343.050 / 349.054 | +%1,75 |

Sıra: 1C → 1D → 1C → 1D → 1C → 1D (Koşu n = n. çift). GPU sorgularında `GPU_DISJOINT_EXT` tüm koşularda `false`
(ölçüm bozulmadı). Her koşuda 300 kare örneklendi.

Çift bazında birincil metrik farkı: +%7,1 · +%7,1 · +%11,1 → medyan **+%7,1**.
S0 kuralı "fark %10–20 ise medyan farkı kullan" diyor; tek çift %11 çıktı, medyan %10 altında.

## Ne sabit tutuldu

| Değişken | Değer |
|---|---|
| Derleme modu | **Üretim derlemesi** (`vite build` + `vite preview`), iki sürüm aynı yapılandırmayla. Dev modu değil. |
| Kaynak | 1C = `02511f8`, 1D = `53fe5c7` (1D'nin son commit'i). `git archive` ile `.tmp/olcum/1c` ve `.tmp/olcum/1d`'ye çıkarıldı; ikisi de aynı `node_modules`'ü kullanır (paket dosyaları iki commit arasında değişmemiş). Varlıkların gerçekten farklı olduğu doğrulandı (lamba GLB 20.612 / 11.004 bayt). |
| Sunucu | 1C `localhost:4201`, 1D `localhost:4202` — ikisi eşzamanlı açık |
| Tarayıcı | Aynı Chrome 152 oturumu, **aynı sekme**, koşular arası yeniden yükleme |
| GPU | AMD Radeon tümleşik (ANGLE, Direct3D11) |
| Canvas | 1536×735 CSS px, `setPixelRatio(1)` → **1536×735 çizim pikseli** (ekran DPR'si 1,25, ölçüm için 1'e sabitlendi) |
| Sahne | 25 karakter (`kopya(24)`), Geniş kamera, ışık B+, gölge açık, çevre + kediler açık — iki sürümde varsayılanlar aynı |
| Isınma | 120 kare atıldı |
| Örneklem | 300 kare (kare başına) + 30 × 10 karelik blok + 300 kare GPU sorgusu |

## Sınırlar — dürüstlük notu

- **Bu bir profiler ayrıştırması değildir.** CPU ve GPU işi örtüşür; bu yöntem mutlak maliyeti değil, kontrollü A/B ile
  regresyonu gösterir. `gl.finish` boru hattını sıraya sokar; mutlak değerleri olduğundan yüksek gösterir.
- **Zaman çözünürlüğü 0,1 ms** (`performance.now`, sayfa cross-origin isolated değil). Kare başına medyanlar 0,1 ms adımlı;
  2,8 ↔ 3,0 iki adımlık fark. Bu yüzden 10 karelik blok ortalaması (0,01 ms çözünürlük) ve GPU zamanlayıcısı ayrıca verildi.
  Blok ortalaması farkı yalnız +%1,0 — kare başına medyan farkının bir kısmı çözünürlük basamağı olabilir.
- **`kareSuresi()` yalnız çizim değildir:** `cizim()` mixer güncellemesi, kırpma, kuyruk salınımı (`sahne.traverse`),
  kedi ve temas gölgesi güncellemesini de içerir.
- **Tam sabitlenemeyenler:** kopyaların animasyon başlangıç zamanı rastgele (`klipOynat` → `Math.random()`), göz kırpma
  zamanlayıcısı ve kedi yolu zamana bağlı; iki sürümde birebir aynı poz değil.
- **Sekme gizli:** otomasyon sekmesi arka planda; sayfanın Worker döngüsü ölçüm betiğinin bekleme aralarında da kare çiziyor
  (ölçüm döngüleri eşzamanlı olduğu için iç içe girmiyor). `requestAnimationFrame` aralığı bu yüzden ölçülemedi.
- **Worktree yerine `git archive`:** önerilen `git worktree add ../qt-1c` + `npm install` yerine, git durumuna dokunmayan ve
  iki sürüme birebir aynı bağımlılıkları veren dışa aktarma kullanıldı. Çalışma dizini ölçüm boyunca değişmedi.
- Birinci deneme koşusu (1C, canvas 1536×791) farklı canvas boyutunda kaldığı için tabloya alınmadı: kare başına medyan 3,1 ms.
- **Telefon: ölçülmedi.**

## S-1 durumu

| Madde | Durum |
|---|---|
| İki ms'in tanımı koddan doğrulandı | Evet — HUD satır 524 yalnız CPU gönderim; `kareSuresi()` satır 554 CPU+GPU (`gl.finish`). 1C commit'inde aynı satırlar 472'de. |
| Her ms değerinin yanına metrik adı | Bu raporda uygulandı. |
| `EXT_disjoint_timer_query_webgl2` | **Destekleniyor** (bu makine, Chrome 152); üçüncü metrik olarak ölçüldü. |
| `requestAnimationFrame` toplam kare süresi | **Ölçülmedi** — gizli sekme. Görünür sekmede ölçülmeli. |
| HUD'a iki etiketli sayı | **Yapılmadı** — bu paket kod değil ölçüm raporu. Aşama 2'de yapılacak. |

## Tekrar üretmek için

```bash
# iki sürümü çıkar (çalışma dizinine dokunmaz)
git archive 02511f8 bildim/harita/deneme public/meydan/deneme | tar -x -C .tmp/olcum/1c
git archive 53fe5c7 bildim/harita/deneme public/meydan/deneme | tar -x -C .tmp/olcum/1d
cp .tmp/deneme-test/index.html .tmp/olcum/1c/ ; cp .tmp/deneme-test/index.html .tmp/olcum/1d/
# üretim derlemesi + yerel sunucu (.tmp/olcum/vite.olcum.config.mjs: root = OLCUM_KOK, plugin-react)
OLCUM_KOK=.tmp/olcum/1c npx vite build   --config .tmp/olcum/vite.olcum.config.mjs
OLCUM_KOK=.tmp/olcum/1c npx vite preview --config .tmp/olcum/vite.olcum.config.mjs --port 4201
# (1d için aynısı, port 4202) → http://localhost:420x/index.html?otomasyon=1
```

Ölçüm betiği (sayfa konsolunda): yükleme bekle → `render.setPixelRatio(1)`, `setSize(clientWidth, clientHeight, false)` →
`kopya(24)`, `kamera("genis")` → HUD'dan 6 okuma → `kareSuresi(120)` ısınma → 300 × `kareSuresi(1)` →
30 × `kareSuresi(10)` → 300 kare `TIME_ELAPSED_EXT` sorgusu → medyan / p95.

## Sonraki adım

S0 eşiğe göre regresyon göstermediği için S1 ve S2 çalıştırılmadı. S3, S4 ve S5 bu paketin dışında.
Ölçülen ~0,2 ms'lik yönlü maliyet kayıt altında; S4 kapısında (3,0 / 4,0 ms) bütçeye dahil edilmesi gereken bir girdi.
