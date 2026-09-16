# Kare süresi ölçüm düzeneği

İki commit'in çizim maliyetini **aynı koşulda** karşılaştırmak için. İlk kullanım: Aşama 2 S0
(`../ASAMA_2_S0_OLCUM.md`, 16 Eyl 2026). Aşama 2'den sonra aynı ölçüm bununla tekrarlanır.

## Çalıştırma

```bash
# 1) iki sürümü ayrı terminallerde hazırla (çıkar → üretim derlemesi → yerel sunucu)
node bildim/harita/olcum/hazirla.mjs 02511f8 1c 4201
node bildim/harita/olcum/hazirla.mjs HEAD    1e 4202

# 2) aynı Chrome sekmesinde sırayla aç:  1c → 1e → 1c → 1e → 1c → 1e
#    http://localhost:4201/index.html?otomasyon=1   ve   http://localhost:4202/index.html?otomasyon=1
# 3) her açılışta olcum.js içeriğini konsola yapıştır, sonra:
await olcumKos()
```

Çıkarılan kopyalar `.tmp/olcum/<ad>/` altındadır (git dışı, her çalıştırmada yeniden üretilir).

## Zorunlu sabitler

| Sabit | Değer | Neden |
|---|---|---|
| Derleme | **üretim** (`vite build` + `vite preview`) | Dev modu modülleri küçültmeden ayrı servis eder; CPU süresi farklı çıkar |
| DPR | **1** (betik `setPixelRatio(1)` yapar) | DPR fragment maliyetini doğrudan çarpar |
| Canvas | iki sürümde **aynı CSS boyutu** (aynı sekme, pencere boyutu değişmeden) | Piksel sayısı değişirse karşılaştırma geçersiz |
| Sahne | 25 karakter, Geniş kamera, ışık B+, gölge açık, çevre + kediler açık | Varsayılanlar |
| Isınma | **120 kare** | Shader derlemesi, doku yükleme |
| Örnek | **300 kare**, **medyan + p95** (ortalama değil) | Uç değerlere dayanıklı |
| Koşu | **3 koşu**, sürümler **dönüşümlü**, koşular arası **sayfa yeniden yükleme** | Isı/oturum kaymasını dağıtır |

## Metrikler — karıştırma

| Metrik | Ne ölçer | Kullanım |
|---|---|---|
| `cpuGpuKare` | `cizim()` + `gl.finish()`, kare başına | **Sert kapı (3,0 / 4,0 ms) bu metriğe bakar** |
| `cpuGpuBlok10` | aynı, 10 karelik ortalama | 0,1 ms saat çözünürlüğü basamağını kontrol |
| `gpuTimer` | `EXT_disjoint_timer_query_webgl2` | Üçüncü metrik; destek yoksa `null` |
| `hudCpuGonderim` | HUD "CPU": yalnız `render.render` gönderim süresi | Kare süresi DEĞİL; kapıyla karşılaştırılmaz |

Her ms değerinin yanına metrik adı yazılır: `3,0 ms (CPU+GPU, gl.finish)` / `1,45 ms (yalnız CPU gönderim)`.

## Sınırlar

- Profiler değildir: CPU ve GPU örtüşür; mutlak maliyet değil **kontrollü A/B regresyonu** gösterir. `gl.finish` değerleri olduğundan yüksek gösterir.
- `performance.now` çözünürlüğü 0,1 ms (sayfa cross-origin isolated değil).
- `kareSuresi()` yalnız çizim değildir; mixer, kırpma, kuyruk, kedi ve temas gölgesi güncellemesini de içerir.
- Kopyaların animasyon başlangıcı rastgele; pozlar iki sürümde birebir aynı değildir.
- Bağımlılıklar depo kökünden çözülür: iki commit arasında `package.json` değiştiyse bu düzenek geçersizdir; o durumda `git worktree` + `npm install` kullanılır.
- Otomasyon sekmesi gizliyse `requestAnimationFrame` aralığı (toplam kare süresi) ölçülemez; görünür sekmede ayrıca ölçülür.
- Telefon ms'i masaüstünden **türetilmez**; gerçek cihazda ölçülür.
