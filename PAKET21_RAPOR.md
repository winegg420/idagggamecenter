# Paket 21 — Muayene gerçek kalite kapısına dönüşsün (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — muayene kapsamı: kodla çizilen parçalar | ✅ taç + pelerin muayenede | `6dc600b` |
| B — yeni test: yuva oturması | (sürüyor) | |
| C — yeni test: açık kenar / delik | (sürüyor) | |
| D — yeni test: kalınlık | (sürüyor) | |
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
