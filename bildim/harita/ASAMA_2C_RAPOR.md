# Aşama 2C — Canlı test hazırlığı + bekleyen işler (17 Eyl 2026)

| Bölüm | Durum | Commit |
|---|---|---|
| A — canlı haritaya ölçüm göstergesi | ✅ canlıda (push + dağıtım doğrulandı) | `e830377` |
| B — 3,6 ms tabanının kaynağı | ✅ ölçüldü, kod değişmedi | `a9b6f54` |
| C — Düello faz halesi | ✅ canlıda | `e9cbdb2` |
| D — çeviri üretim hattı | ⚠️ kod + migration 210 hazır, migration **uygulandı**; Edge Function **dağıtılamadı** (aşağıda) | `afc66eb` |

---

## A — Ölçüm göstergesi

**Kullanım (telefonda):**

- Aç: `https://quiztactics.vercel.app/harita?olcum=1`
- Bir kez açınca bu cihazda hatırlanır; sonra `/harita` yeterli.
- Kapat: `https://quiztactics.vercel.app/harita?olcum=0`
- Hub'da aynı parametre `/bildim/harita?olcum=1` ile çalışır.
- Normal oyuncu görmez: varsayılan kapalı.

**Gösterilenler** (0,5 sn'de bir tazelenir; örnek satırlar temsilîdir):

```
103 çağrı · 315.396 üçgen
60 fps · CPU 1,46 ms
CPU+GPU 3,80 ms (p95 5,60) · GPU 2,10 ms
8 tam 3B karakter · 27 oyuncu
780×1688 · DPR 2,00             [CPU+GPU ölç]
```

| Etiket | Ne ölçer | Nasıl |
|---|---|---|
| `CPU` | Yalnız `render.render` gönderim süresi, son 0,5 sn ortalaması | Sürekli, ucuz. **Kare süresi değildir.** |
| `CPU+GPU` | Kare başı → `dunya.guncelle` sonu + `gl.finish()` | Yalnız **düğmeyle**: 120 ısınma + 300 kare, medyan (p95). Sürekli ölçülmez (boru hattını sıraya sokar). Ölçüm ~7 sn sürer. |
| `GPU` | `EXT_disjoint_timer_query_webgl2`, medyan | Yalnız destekleniyorsa ve CPU+GPU ölçümüyle birlikte. Desteklenmiyorsa "GPU zamanlayıcı yok" yazar. iOS Safari'de büyük olasılıkla yok. |
| `tam 3B karakter` | `MeydanAvatarlari.tamSayisi` (sınır `meydan_uc_boyutlu_sinir`) | |
| `oyuncu` | Sahnedeki toplam karakter: sen + uzak oyuncular + meydan botları | Yalnız sahne; global oyuncu sayısı değil. |
| son satır | Kanvasın gerçek piksel boyutu ve DPR | Telefonda DPR 2'ye kısıtlı (`dunya.js`). |

**Telefonda okunabilirlik:** Kart üst çubuğun altında, sağ üstte duruyor. Genişliği en çok 300 px ve satırlara bölünüyor. Yazı 12,5 px ve kalın, rakamlar sabit genişlikte. Dokunmayı engellemez, yalnız "ölç" düğmesine basılır. Yatay ekranda biraz sıkışır. 390×844 dikey ve 844×390 yatay görünümde taşma olmadığı doğrulandı (`gorsel/2c/a-telefon.jpg`, `a-yatay.jpg`).

**Doğrulanan:**

- Yerel üretim düzeneğinde (sahte Supabase) konsol hatası 0.
- `?olcum=1` → açıldı, parametresiz yeniden yüklemede hatırlandı, `?olcum=0` → kapandı.
- CPU+GPU düğmesi sonuç verdi.
- Canlı paketin (`HaritaSayfasi-DPaXbc6L.js`) yeni kodu içerdiği görüldü.

> Not: masaüstü Chrome'da (ANGLE/D3D11) `gl.finish` GPU'yu tam beklemiyor. Aynı karede CPU+GPU 1,10 ms, GPU zamanlayıcı 6,6 ms okundu. İki sayı birbirinin yerine kullanılmamalı. Telefonda hangisinin gerçek kare maliyetine yakın olduğu yarınki testte görülecek.

---

## B — 3,6 ms tabanı: katman katman ölçüm

**Düzenek:** `olcum/meydan-test/katman2c.js`. Ham sonuçlar `olcum/sonuc-2c/*.json`.

- Üretim derlemesi.
- Headless Chrome, gerçek GPU (AMD Radeon tümleşik, ANGLE D3D11).
- DPR 1, kanvas 1536×791 (2B raporuyla aynı).
- 2B'nin en kötü açısı (İstiklal ucu).
- 120 ısınma + 300 örnek. Değerler medyan / p95, 3 ayrı sayfa yüklemesi (aralık).
- Katmanlar yalnız görünürlükle kapatıldı, oyun kodu değişmedi. Oyuncular 5. satırda eklendi, öncesinde sahnede yok. Kendi karakterin ve 2 bot 0–4. satırlarda gizli, CPU güncellemeleri sürüyor.
- `CPU` = `render.render` süresi. `kare` = sayfanın gerçek `cizim()` karesi + `gl.finish` (CPU+GPU).

| Satır | Çağrı | Görünen üçgen | CPU ms (medyan / p95) | CPU+GPU ms (medyan / p95) |
|---|---|---|---|---|
| 0 · hiçbir şey (gökyüzü + ışık) | 0 | 0 | 0,1 / 0,1 | 0,1 / 0,2 |
| 1 · zemin | 1 | 5.398 | 0,1 / 0,2 | 0,2 / 0,2–0,3 |
| 2 · + binalar (boyalı) + arka plan + greybox kalıntısı | 22 | 8.896 | 0,4–0,5 / 0,7–1,6 | **0,6** / 0,9–1,8 |
| 3 · + proplar (ağaç, lamba, bank, saksı + temas gölgeleri) | 30 | 83.820 | 2,4–2,5 / 3,3–4,8 | **2,6–2,7** / 3,4–4,9 |
| 4 · + kediler | 31 | 89.052 | 2,4 / 3,0–3,2 | 2,6 / 3,2–4,1 |
| 5 · + 25 hafif karakter (sınır 0) | 92 | 262.686 | 2,8–3,0 / 3,2–4,9 | 3,3–3,6 / 3,9–5,5 |
| 6 · sınır 8 | 103 | 315.396 | 3,0–3,1 / 3,3–5,0 | **3,5–3,7** / 3,9–5,6 |
| 4 · çizim YOK (yalnız oyun mantığı + gl.finish) | 0 | 0 | — | 0,1 / 0,2 |
| 6 · çizim YOK (25 oyuncu, mantık + mixer + gl.finish) | 0 | 0 | — | 0,3–0,4 / 0,4–0,5 |
| 6 · gölge KAPALI | 92 | 253.910 | 2,4–2,6 / 3,0–4,9 | 2,9–3,2 / 3,7–5,5 |
| 6 · çözünürlük %75 (1152×593, %56 piksel) | 103 | 315.396 | 1,8–2,3 / 3,0–4,3 | 2,2–2,7 / 3,6–4,8 |
| 6 · çözünürlük %50 (768×395, %25 piksel) | 103 | 315.396 | 1,4–1,5 / 2,8–2,9 | 1,7–1,9 / 3,4–3,5 |

2B'nin sınır 8 değeriyle tutarlı: 3,7–3,8 ms → burada 3,5–3,7 ms.

### Katman 3'ün parçalanması (`propDetay`, 2 yükleme)

Proplar katman 2'nin üstüne teker teker eklendi.

| Katman 2 + … | Çağrı | Üçgen | CPU+GPU medyan (yükleme 1 / 2) |
|---|---|---|---|
| yalnız ağaç gövdesi (90 örnek) | 23 | 19.696 | 0,4 / 0,4 |
| yalnız ağaç tacı (90) | 23 | 51.196 | 2,7 / 1,9 |
| yalnız lamba (18) | 24 | 16.816 | 2,8 / 2,1 |
| yalnız bank (14) | 23 | 13.376 | 2,7 / 2,0 |
| yalnız saksı (18) | 24 | 18.112 | 2,7 / 1,9 |
| yalnız temas gölgeleri (104) | 23 | 9.104 | 2,5 / 2,4 |
| tüm proplar, gölge KAPALI | 27 | 73.630 | 2,1 / 0,7 |
| tüm proplar, %75 çözünürlük | 30 | 83.820 | 0,8 / 0,8 |
| tüm proplar, %50 çözünürlük | 30 | 83.820 | 0,8 / 0,6 |

### Çözünürlük eğrisi (`cozunurlukEgrisi`, 3 yükleme, CPU+GPU medyan)

| Ölçek (piksel) | %100 | %90 (81) | %80 (64) | %70 (49) | %60 (36) | %50 (25) | %35 (12) |
|---|---|---|---|---|---|---|---|
| Katman 3 (proplar, karakter yok) | 2,1–2,3 | 1,4–2,0 | 0,8 | 0,7–0,8 | 0,5–0,7 | 0,6–0,7 | 0,5 |
| Katman 6 (sınır 8) | 3,7–3,9 | 3,6–3,7 | 3,9–4,7 | 2,5–2,7 | 2,2–2,5 | 1,7–2,0 | 1,4–1,6 |

### 3,6 ms nereden geliyor?

1. **Karakterlerden gelmiyor.** Karakterler (hafif 25 + tam 8) yaklaşık +0,9–1,1 ms ekliyor. Onların CPU tarafı (mantık + mixer) 0,3 ms.
2. **Oyun mantığından gelmiyor.** Çizim kapatılınca kare 0,1–0,4 ms.
3. **Tek bir prop türünden gelmiyor.** Taban ~0,5 ms'den ~2–2,7 ms'ye **basamakla** çıkıyor. Bu sıçramayı herhangi bir tek prop tetikliyor: 14 banklık 13k üçgen de, 90 ağaç tacı da aşağı yukarı aynı sıçramayı yapıyor. İçerikle orantılı bir maliyet değil.
4. **Piksele (GPU doluluğuna) bağlı ve doğrusal değil.** Aynı sahnede piksel %81'den %64'e inince 2,1 → 0,8 ms. Katman 6'da %64 → %49 arasında 4,5 → 2,6 ms. Eğri yumuşak bir çizgi değil, basamaklı. Görevdeki uyarı doğru çıktı: %75 piksel azalınca süre %75 düşmüyor. Ama düşüş büyük ve eşikli, bu da GPU/doluluk sınırlı bir sahneyi gösteriyor.
5. **Gölge kısmen katkı veriyor.** Katman 6'da gölge kapalıyken −0,5 ms (3,6 → 3,0). Katman 3'te bir yüklemede basamağı tamamen kaldırdı (2,6 → 0,7), diğerinde yalnız 2,6 → 2,1 düşürdü. En büyük tek kaldıraç değil, eşiğin altına inmeye yardım ediyor.
6. **"CPU" sayısı bu platformda saf CPU değil.** `render.render` süresi çözünürlükle birlikte düşüyor (3,0 → 1,4 ms). Yani Chrome'un komut arabelleği GPU'yu bekliyor. CPU/GPU ayrımı bu metrikle yapılamaz. GPU zamanlayıcı headless Chrome'da sonuç döndürmedi (`GPU_DISJOINT` / sonuç yok).

**Sonuç:** 3,6 ms'nin ~2 ms'si çevre katmanı eklendiğinde ortaya çıkan, piksel sayısına bağlı, basamaklı bir GPU maliyeti. Bu masaüstü tümleşik GPU'da kareyi doldurmanın bedeli gibi görünüyor. En kötü açıda kamera İstiklal'in içinde duruyor ve iki yandaki bina cepheleri ekranın büyük kısmını kaplıyor (`gorsel/2c/b-katman2.jpg`). Kalan ~1 ms karakterlerden geliyor.

**Bulunamayan:** Basamağın kesin mekanizması belirlenemedi. Aday açıklamalar: MSAA çözümü, gölge haritası + ana geçişin toplam doluluğu ya da sürücünün güç durumu. GPU zamanlayıcısı olmadan ayrılamıyor.

**Öneri (ayrı paket):**

- Görünür sekmede GPU zamanlayıcısıyla, `antialias` açık/kapalı ve DPR tavanıyla ölçmek.
- Asıl kararı telefon ölçümüyle (A göstergesi) vermek. Masaüstündeki bu basamak telefona birebir taşınmaz.

---

## C — Düello faz halesi

**Nerede görünür:** `kategori` / `hazirlik` / `cevap` fazlarında. `sonuc` ve `altin` fazlarında hale yok.

| Rol | Hale | Bant |
|---|---|---|
| Saldıran | marka turuncusu, sabit | turuncu hap, kılıç ikonu, **SALDIRIYORSUN** |
| Savunan | soğuk mavi | mavi, köşeli bant, kalkan ikonu, **SAVUNUYORSUN** |
| Savunan, `cevap` fazında süre akarken | mavi → kırmızı kayar (%70'e kadar) | mavi |
| Savunan, ≤3 sn | tam kırmızı + nabız | kırmızı |

- **Sayaçla uyum:** Tam kırmızı ve nabız, `.bd-duello-sayac.kritik` ile aynı eşikte (`kalanSn <= 3`) başlıyor. Akış testinde sayaç ve hale aynı karede kritik oldu.
- **Toplam süre koda gömülü değil:** Fazın ilk görülen kalan süresi toplam kabul ediliyor. Ek Süre jokeriyle artarsa toplam büyüyor.
- **Renk körlüğü:** Rol, metin bandıyla ve iki farklı biçimle de ayrılıyor: kılıç/kalkan ikonu, hap/köşeli bant. Metinler `dil.js`'te (TR + EN: ATTACKING / DEFENDING).
- **Kontrast:** Beyaz yazı turuncu `#C4530F` üstünde 4,6:1, mavi `#2A6CB0` üstünde 5,4:1, kırmızı `#B62F2F` üstünde 6,1:1. Yazı 16 px kalın, AA sağlanıyor.
- **Hale kenarda kalıyor:** İç gölge 44–50 px bulanık. Şıklar boyanmıyor (ekran görüntülerinde şık kartları beyaz).
- **Koyu/nötr katman yok.**
- **Giriş:** Faz değişiminde 0,3 sn opaklık girişi (hale + bant).
- **`prefers-reduced-motion`:** Giriş animasyonu ve nabız kapanıyor; sabit renk ve metin kalıyor. Headless Chrome'da `reducedMotion: reduce` ile `animationName = none` doğrulandı.
- **iOS:** Hale `document.body`'ye portal, `position: fixed`, `transform` yok. Hareketler yalnız opaklıkla.

**Ekran görüntüleri** (390×844, sahte veriyle yerel düzenek):

- saldırı: `gorsel/2c/c-saldiri.jpg`
- savunma: `gorsel/2c/c-savunma.jpg`
- süre biterken: `gorsel/2c/c-savunma-kritik.jpg`
- azaltılmış hareket: `gorsel/2c/c-saldiri-azhareket.jpg`, `gorsel/2c/c-savunma-kritik-azhareket.jpg` (durağan görüntüde fark animasyonun yokluğu; renk aynı)

---

## D — Çeviri üretim hattı

### Yapılan

- **`supabase/functions/generate-questions/ceviri.ts`** (saf mantık):
  - Bağlamla çeviri istemi: soru + bütün şıklar + kategori + doğru indeks birlikte gönderiliyor.
  - Geri kontrol istemi: yalnız İngilizce metin gidiyor. Türkçe ve doğru indeks gönderilmiyor; testle doğrulandı.
  - Makine kontrolleri:
    - şık sayısı
    - şık sırası: model her şıkkı kaynak indeksiyle döndürüyor, indeks dizisi 0..n-1 değilse atlanıyor
    - çeviride eşanlamlıya düşen şıklar: kaynakta benzer değilken hedefte benzerlik ≥ eşik
    - özel isimler: `kalite.ts` kapısı; Cami → Mosque yakalanıyor, Jami geçiyor
    - sayı değerleri ve hedef dil biçimi: "3,5" İngilizcede yakalanıyor
  - Karar: geri kontrol sonucu yoksa çeviri yazılmaz.
- **`index.ts`:**
  - Üretilen sorular hedef dillere çevrilip `question_translations`'a yazılıyor.
  - Bozuk ya da çevrilemez olanlar sebep koduyla `ceviri_atlanan`'a yazılıyor.
  - Geçici API hatası soruyu atlanmış saymıyor; soru sonraki çalıştırmada yeniden deneniyor.
  - Süre sınırı aşılırsa çeviri sonraya kalıyor.
- **Geriye dönük çalıştırma (D.5, yazıldı ama çalıştırılmadı):**
  - `POST {"mod":"ceviri","dil":"en","adet":20}` bekleyenleri parça parça işler.
  - `{"kuru":true}` çevirisi olan rastgele sorularda hattı çalıştırır, **hiçbir şey yazmaz**. Kalite ölçümü için.
- **Migration 210 (uygulandı):**
  - `ceviri_atlanan` anahtarı `(question_id, dil)` oldu; `kod` ve `ayrinti` kolonları eklendi. Mevcut 23 satır `kod='elle'`.
  - `ceviri_dil_kurallari` tablosu: dil kuralları, sayı biçimi, oyun terimleri sözlüğü (`dil.js` karşılıkları), atılacak kelimeler. **Yeni dil = yeni satır**, kod değişmez.
  - `oyun_ayarlari`: `ceviri_hedef_diller` `["en"]`, `ceviri_parti_boyu` 10, `ceviri_benzerlik_esigi` 0,9, `ceviri_sure_siniri_sn` 100.
- **Uyarı raporu (D.4):** `select * from ceviri_uyari_raporu();` ve `select * from ceviri_atlanan_dagilim();`. Yalnız service_role/SQL erişebilir.
- **Testler:** `_test/ceviri-test.mjs` 20/20, `_test/kalite-test.mjs` 38/38.

**Bilinçli sınır:** Sözlük istemde zorunlu, ama makine kontrolü olarak uygulanmıyor. "Altın", "Serbest", "Lig" gibi terimler sorularda sıradan kelime olarak da geçiyor, zorunlu tutmak bol yanlış atlama üretirdi.

### ⚠️ Dağıtılamadı → örnek parti çalıştırılamadı

- Edge Function dağıtımının iki yolu da kapalı:
  - `supabase functions deploy` → **403**. CLI belirteci başka hesaba ait (bilinen durum).
  - Panelden dağıtım için gereken Chrome eklentisi bu oturumda **bağlı değil**.
- `ANTHROPIC_API_KEY` yalnız Supabase secret'ında duruyor. Bu yüzden örnek parti yerelden de çalıştırılamadı.
- **Sonuç:**
  - "Geri kontrol kaç çeviride devreye girdi" sorusunun **ölçülmüş cevabı yok**.
  - Canlıdaki `generate-questions` hâlâ **eski sürüm**. Saatlik cron'un ürettiği yeni sorular dağıtıma kadar çevirisiz kalır ve raporda `cevirisiz` olarak görünür.
- **Dağıtımdan sonra yapılacaklar:**
  1. Panel → Edge Functions → generate-questions → Code: `index.ts`, `kalite.ts` ve **yeni `ceviri.ts`** yüklenir.
  2. Kuru deneme: `{"mod":"ceviri","dil":"en","adet":20,"kuru":true}`. Yanıttaki `geri_kontrol_yakaladi`, `makine_yakaladi`, `cevrilemez` ve `atlanan` sayıları bu raporun eksik satırıdır.
  3. Arada birikmiş çevirisiz sorular için `{"mod":"ceviri","dil":"en","adet":20}`.

### Şu anki sayılar (17 Eyl, migration sonrası)

| dil | aktif soru | çevirili | atlanan | **çevirisiz** |
|---|---|---|---|---|
| en | 9.290 | 9.267 | 23 | **0** |

Atlananların sebep dağılımı: 23 × `elle` (Paket 15). Ağırlıklı olarak Türkçe deyim (8), atasözü (2), dilbilgisi ve yazım kuralları.
