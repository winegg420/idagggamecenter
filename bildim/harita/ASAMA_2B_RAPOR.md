# Aşama 2B — Yeni karakter ve proplar gerçek haritada, eski harita kaldırıldı

**Tarih:** 17 Eylül 2026
**Canlı:** https://quiztactics.vercel.app/harita (artık parametre yok; tek harita Taksim)
**Durum:** entegrasyon tamam. **§6 performans kapısı 25 tam karakterde GEÇMEDİ (PASS değil).** Kural gereği `UC_BOYUTLU_SINIR` 8'e indirildi. Sonuç aşağıda raporlandı. **DUR.**

## Özet

1. Haritadaki bütün karakterler yeni GLB karakter oldu: kendi oyuncun, uzaktaki oyuncular ve botlar. Tür, kıyafet, saç, ten, kozmetik, ifade, göz kırpma, AO ve temas gölgesi çalışıyor.
2. Çevre manifestten kuruluyor. Ağaç, lamba, bank, saksı, bordür ve zeminin her biri tek InstancedMesh. Sokak kedileri her yerde, binalar boyalı.
3. Paket 13 haritası, `?harita=` seçimi ve balıkçı/olta/su kodu silindi (istemci tarafında). `avatar.js` duruyor.
4. **Performans:** en kötü açıda (İstiklal ucu, 25 oyuncu) 25 tam karakterle **5,8 ms** ölçüldü; kapı **4,0 ms**. Sınır **8** iken **3,7–3,8 ms**.
   - Çizim çağrısı (143 ≤ 220) ve üçgen (432 bin ≤ 460 bin) sınırın altında.
   - Doğuş noktasında sınır 8 iken **3,9–4,0 ms** ölçüldü, yani eşiğin üstünde. Orada sınırı 0'a indirmek de yetmiyor (3,6–4,1 ms). Ayrıntı §6'da.

## Commit'ler (her adım ayrı)

| Adım | Commit | İçerik |
|---|---|---|
| 1 modül | `7b6209a` | Karakter sistemi `bildim/harita/karakter/` altına çıkarıldı; deneme sayfası onu kullanıyor |
| 2+3 oyuncular | `66462dd` | Kendi oyuncu ve uzaktaki oyuncular yeni karakterle; B+ ışık; gölge oyuncuyu izliyor |
| 4 proplar | `d69439b` | GLB proplar ve atlaslı zemin manifest alanlarından |
| 5 kediler | `2722fde` | Sokak kedileri: meydan, plaza kolları, İstiklal'in iki kaldırımı |
| 6 botlar | `1720008` | Meydan botları yeni karakterle; tür sunucu katmanından |
| 7 boya | `2495069` | Binalar boyandı |
| 8 eski harita | `555edec` | Paket 13 dünyası, harita seçimi ve balıkçı/olta/su kaldırıldı |
| 9 ölçüm + rapor | (bu commit) | Sınırın canlı uygulanması, `oyun_ayarlari` satırları, ölçüm, rapor |

## Ekran görüntüleri (`gorsel/2b/`)

Hepsi üretim derlemesinde (sahte Supabase sınama sayfası), sınır 8 iken alındı.

| Dosya | Ne |
|---|---|
| `01_meydan_25_oyuncu_oyun_kamerasi.jpg` | Meydan: oyun kamerası, 25 oyuncu + 2 bot, kedi, anıt, bank ve ağaç halkası |
| `02_sokak_en_kotu_aci_25_oyuncu.jpg` | İstiklal ucundan tüm boy (§6 en kötü açı), 25 oyuncu |
| `03_uc_tur_yan_yana.jpg` | Üç tür yan yana: robot, kaplan, insan |
| `04_iki_bot.jpg` | İki bot: Deniz (insan) ve Ece (robot) |
| `05_sokak_kedisi.jpg` | Sokak kedisi, plaza kaldırımında |
| `06_boyali_binalar.jpg` | Boyalı binalar: mod renkli dükkânlar, nötr apartmanlar, zemin/üst kat ve çatı ayrımı |

## §1 Modül çıkarımı

Karakter sistemi `bildim/harita/karakter/` altında toplandı:

| Dosya | Sorumluluk |
|---|---|
| `karakter.js` (269) | `KarakterSistemi`: yükleme, `kur`, klip/crossfade, görünüm, kare döngüsü (mixer, kırpma, kuyruk, süzülme, VFX); paletler, `atlasCilala` |
| `kozmetik.js` (55) | Kozmetik takma, sözleşme uygulama, kaplan kuyruğu |
| `ifade.js` (48) | İfade seçimi, göz kırpma |
| `pet.js` (109), `vfx.js` (187) | `deneme/` altından `git mv` ile taşındı (geçmiş korunur) |
| `temas.js` (27) | Temas gölgeleri |
| `meydanAvatar.js` (227) | Haritaya uyum katmanı: `profiles.gorunum` → karakter; bot görünümü; tam/hafif sınırı; eski avatar sözleşmesi (dans, ikram, etiket) |

- **Deneme sayfası çalışıyor.** `DenemeSayfasi.jsx` 783 satırdan 551'e indi. Aynı modülü içe aktarıyor, kopya kod yok. 2B-1'den sonra sınandı: tür, set, kozmetik, ifade ve VFX çalışıyor, konsolda hata yok.
- Harita (`dunya.js`) ile deneme sayfası artık tek karakter kodunu paylaşıyor.

## §2 Karakterler

- **Kendi oyuncun:** profilindeki `gorunum` karakter setine çevriliyor.
  - Tür `gorunum.harita.tur` alanından okunuyor; alan yoksa insan.
  - Kıyafet, saç ve ten en yakın palet rengine eşleniyor.
  - Premium gözlük/şapka kozmetiğe eşleniyor.
- **Uzaktaki oyuncular:** mevcut presence'taki `gorunum` alanından çiziliyor.
  - `coklu.js` paketlerine yeni alan eklenmedi; paket boyutu değişmedi.
  - Görünüm değişince gövde sahne yıkılmadan yeniden kuruluyor.
- **Dokunulmayanlar:** çoklu oyuncu, presence, konum yayını, emoji, dans, ikram, zıplama, meydan okuma, topuz, kamera, çarpışma, `yokEt()` ve sekme gizliyken durma aynı kaldı.
  - Dans ve ikram, eski avatarın "vekil" gruplarından (kol, bacak, gövde, kafa) okunup kemiklere karakter uzayında uygulanıyor.
- **UC_BOYUTLU_SINIR** = `oyun_ayarlari.meydan_uc_boyutlu_sinir` (**8**; ayrıntı §6).
  - Katılış sırasıyla ilk N karakter **tam** (kozmetik, gölge, göz kırpma), gerisi **hafif** (aynı model, bunlar olmadan). Billboard yok.
  - Sınır sonradan değişirse (ayar geç gelirse) mevcut karakterlere de uygulanıyor. Yalnız durumu değişen gövdeler yeniden kuruluyor.

## §3–§4D Çevre

- **Proplar:** ağaç (gövde + taç), lamba, bank, saksı ve bordür; zemin tek birleşik mesh. Her tür tek InstancedMesh.
  - Doğuşta 90 ağaç, 18 lamba, 14 bank, 18 saksı.
  - Taç gölgesi küre vekilinden geliyor (yalnız gölge geçişinde görünür).
- **Yerleşim** manifestten geliyor (`yerlesim.json › yerlestir`, `kurallar`):
  - Dış kaldırım hattında ağaçlar 0,7 ölçekte (çevre oyuncuyu çerçeveler).
  - Banklar merkeze dönük.
  - Saksılar girilebilir parsellerin kapı yanlarında.
- **Kediler:** `prop_kedi.glb` ile tek InstancedMesh; 1C davranışı; deterministik, ağ yok.
  - Altı alanda dolaşıyorlar: meydan, üç plaza kolu, İstiklal'in iki kaldırımı.
  - Sayı `oyun_ayarlari.meydan_kedi_sayisi` = 8. Besleme yok.
- **Botlar:** mevcut `meydanBotlari` mantığı değişmedi; yalnız yeni karakterle çiziliyorlar.
  - Tür sunucunun `katman` değerinden: 0 ise insan, diğerleri kimliğe göre kaplan ya da robot.
  - Görünüm kimlikten üretiliyor. Botlar presence'a girmiyor. Sayı mevcut `meydan_bot_tavan` = 2.
- **Boyalı binalar:**
  - Girilebilir dükkânlar `dunya.js › BINALAR` paletinin renklerini aynen kullanıyor.
  - Girilmeyen binalar nötr şehir tonunda.
  - Zemin kat ile üst kat ayrı tonda, çatı tonu ayrı.
  - Mevcut atlas hücreleri kullanıldı, yeni doku yok. Ayak izleri değişmedi.

## §5 Silinenler ve nedenleri

| Silinen | Neden |
|---|---|
| `?harita=taksim/eski` + `localStorage.bildim_harita_yerlesim` | Tek harita var. Eski anahtar ilk açılışta bir kez temizleniyor |
| `dunya.js` Paket 13 dünyası (çim, havuz/göl, dalgalar, köprü, 7 bina, ilkel ağaç/çalı/bank/lamba/çiçek tarhı, bulutlar) | Yerini manifest dünyası aldı |
| Ölü sabitler `YARICAP`, `HAVUZ_YARICAP`, `HARITA_SINIRI`, `MEYDAN_R`, `KOPRU`, `mat()` | Artık kullanılmıyorlar |
| Eski çarpışma/`yakinBina` yolları, `suSec`, `kopruUstundeMi`, `kopru` alanı | Manifest dünyası kendi OBB çarpışmasını ve kapı önü sorgusunu veriyor |
| Eski avatar yolları (billboard + `meydanModelYuru`), `karakterGorsel.js` | Haritada tek karakter yolu var. Dosyanın başka tüketicisi yoktu |
| Balıkçı NPC, olta HUD/menüsü, göle dokunma, `balikGorsel.js`, botların köprü/balık bacağı, `.olta` / `.npc-metin` CSS | **§4C: balıkçı/su iptal edildi, geri getirilmeyecek** |

`dunya.js` 884 satırdan 471'e indi; toplam 1.224 satır silindi, 47 satır eklendi.

- **`zeminYuksekligi()` imzası duruyor** (zemin düz, 0 döner). Ağ paketinin `h` alanı ve zıplama bu imzaya bağlı; oynanış koduna dokunmamak için korundu.
- **Sunucu tarafı bu pakette silinmedi:** `olta_al`, `balik_yakala`, `oltalar` tablosu ve `balik_*` / `olta_*` ayar satırları. Paket kuralı "SQL yok (oyun_ayarlari hariç)" diyor. İstemci onları artık çağırmıyor. Ayrı bir temizlik migration'ıyla kaldırılabilirler.
- **`avatar.js` silinmedi.** `bildim/harita/portre.js` ve `bildim/harita/onizleme.js` onu kullanıyor (görünüm sayfası önizlemesi ve portreler). Grep ile doğrulandı.
- **`avatar3d/meydan-model.js` silinmedi.** `bildim/_test/meydan-3b-test.mjs` onu kullanıyor.

## Bilinen tutarsızlık (bu pakette çözülmedi)

**Harita yeni GLB karakteri gösteriyor; gardırop ve portreler hâlâ eski avatarı gösteriyor.**

- Oyuncu gardıropta giydiğini haritada birebir görmüyor. Kıyafet, saç ve ten en yakın palete, premium gözlük/şapka kozmetiğe eşleniyor.
- Tür seçimi (insan/kaplan/robot) için henüz arayüz yok. `gorunum.harita.tur` alanı boşsa herkes insan.

## §6 Ölçüm

**Sabitler (olcum/README.md):**

- Üretim derlemesi (`meydan-test/sunucu.mjs --uretim`: `vite build` + `preview`).
- DPR 1, sabit kanvas 1536×791.
- 120 ısınma + 300 örnek, medyan + p95.
- Metrik `cpuGpuKare`: sayfanın gerçek `cizim()` karesi + `gl.finish`.
- Ölçüm sırasında döngü `__kare.durdur()` ile durduruluyor ve kareler elle sürülüyor. Böylece oyun mantığı, mixer, kedi, temas gölgesi ve çizim birlikte ölçülüyor.
- 3 sayfa yüklemesi; sınır değerleri her yüklemede farklı sırayla ölçüldü.
- Sahne betiği: `olcum/meydan-test/sahne2b.js`.

**En kötü açı:**

- Kamera İstiklal'in ucunda (koridor t=104, y=9) ve tüm boy boyunca meydana bakıyor.
- 25 oyuncu var: kendin + 24 uzak oyuncu. Türler insan/kaplan/robot dönüşümlü, sokak boyunca dizili.
- 2 bot, 8 kedi, gölge açık, ışık B+.

| Durum | Çizim çağrısı | Görünen üçgen | CPU+GPU medyan / p95 (`gl.finish`) |
|---|---|---|---|
| 2A greybox dünyası yalnız, en kötü açı (2A raporu) | 165 | 2.618 | 1,7 / 2,2 ms |
| 2A greybox + 25 **eski** avatar, en kötü açı (2A raporu) | 924 | 358.450 | 8,6 / 11,1 ms |
| **2B, 25 oyuncu, sınır 25** (hepsi tam) | **143** | **432.228** | **5,7–5,9 / 6,8–7,2 ms** ❌ |
| 2B, 25 oyuncu, sınır 16 | 118 | 368.786 | 5,6–5,8 / 6,3–6,4 ms ❌ |
| 2B, 25 oyuncu, sınır 12 | 110 | 341.938 | 5,5–5,6 / 6,3 ms ❌ |
| 2B, 25 oyuncu, sınır 10 | 107 | 329.178 | 4,2–5,5 / 6,2–6,4 ms ❌ (iki kipli) |
| 2B, 25 oyuncu, sınır 9 | 105 | 321.924 | 3,5–3,7 / 5,4–5,8 ms |
| **2B, 25 oyuncu, sınır 8** | **103** | **315.396** | **3,7–3,8 / 5,8–6,0 ms** |
| 2B, 25 oyuncu, sınır 0 (hepsi hafif) | 92 | 262.686 | 3,6 / 5,6–5,8 ms |
| **Sınır** | **≤ 220** | **≤ 460.000** | **≤ 4,0 ms** |

**Doğuş, oyun kamerası (zum 1), 24 oyuncu meydanda etrafına dağılmış, 2 bot:**

| Sınır | Çağrı | Üçgen | Medyan / p95 |
|---|---|---|---|
| 25 | 133–135 | 449.028 | 4,7–5,0 / 6,0–6,2 ms ❌ |
| 8 | 93–95 | 332.196 | **3,9–4,0** / 5,5–5,8 ms (sınırda) |
| 6 | 88–92 | 318.710 | 3,9–4,1 / 5,3–5,5 ms |
| 0 | 81 | 278.370 | 4,1 / 5,4 ms |

**Karar: PASS değil.**

- 25 tam karakter en kötü açıda 4,0 ms'yi yaklaşık %45 aşıyor. Kural gereği `UC_BOYUTLU_SINIR` düşürüldü.
- **Seçilen değer 8** (`oyun_ayarlari.meydan_uc_boyutlu_sinir`, migration `20260612000209`, canlıya uygulandı).
- **Neden 8:** en kötü açıda 8'in altı eşiğin altında kalıyor (3,7–3,8 ms). 10–12'de süre iki kipli ve 5,5 ms'ye sıçrıyor. 9 sınırda. 8 bir değer pay bırakıyor.
- **Açık kalan sorun:** doğuş kamerasında sınır 8 ile medyan 3,9–4,0 ms, yani eşiğin üstünde. Sınırı 0'a indirmek de bunu kesin olarak altına çekmiyor (3,6–4,1).
  - Bu noktada kalan maliyet tam/hafif ayrımından değil, **27 iskeletli karakterin kendisinden** geliyor (mixer + skinning + ana geçiş) ve dünya/gölgeden.
  - Çözüm için sınırın ötesinde bir karar gerekiyor: uzak karakterlerde animasyon seyreltme/LOD, gölge haritası çözünürlüğü ya da karakter başına çizim birleştirme. Bu paketin kapsamında değil; DUR.
- Çağrı ve üçgen her durumda sınırın altında. 2A'daki 25 eski avatarla 924 çağrı ölçülmüştü, yeni karakterle 143 (tam) ya da 103 (sınır 8).

**Ölçüm sınırları:**

- Masaüstü Chrome'da (otomasyon sekmesi) ölçüldü. Telefon ms'i buradan türetilmez.
- Aynı sahne farklı yüklemelerde iki kipli sonuç verebiliyor. İlk yüklemede sınır 25 bir kez 3,9–4,1 ms çıktı; sonraki üç yüklemede 5,7–5,9 ms. Tabloda tekrar eden değerler var.
- 2A satırları farklı bir düzenekle ölçüldü (`greybox.js`, oyun döngüsü yok). Mutlak ms'leri bire bir karşılaştırılmamalı; çağrı ve üçgen karşılaştırılabilir.

## §8 Kurallar

- Karakter gövdesi, atlas ve kozmetiklere dokunulmadı.
- SQL yalnız `oyun_ayarlari` satırları için yazıldı (`meydan_uc_boyutlu_sinir` = 8, `meydan_kedi_sayisi` = 8).
- Yeni çalışma zamanı paketi eklenmedi.
- `npm run build` hatasız.
- Sınama sayfasında konsol hatası 0: harita açılışı, boş yere dokunma, uzak oyuncu, bot, kedi, dükkân ipucu.

## Gözlemler (karar sahibine)

1. **Karakter ekranda küçük.** 1,83 m'lik yeni karakter varsayılan kamerada 784 px yükseklikte yaklaşık 40 px. Kamera bu pakette dokunulmaz listesindeydi.
2. **Gizli bot riski.** Gerçek oyuncular şimdilik hep insan (tür arayüzü yok), ama botlardan biri kaplan ya da robot. Bu, botu ele verebilir. İki seçenek var: tür arayüzü gelene kadar botları da insan yapmak, ya da tür seçimini oyunculara açmak.
3. **Palet dışı modlar.** Stüdyo ve Ayarlar'ın `BINALAR` paletinde karşılığı yok. Onlara marka turuncusu ve nötr arduvaz verildi.
4. **İkram gösterisi yüksekliği.** İkram propları (kahve/balon, y 1,9/2,2) eski ~4 m avatara göre ayarlı; yeni karakterde biraz yüksek duruyor.
5. **İsim etiketleri duvar arkasından görünüyor.** Etiketler derinlik testi olmadan çiziliyor, bu yüzden bina arkasındaki oyuncunun etiketi çatı üstünde görünebiliyor. Bu davranış önceki haritada da vardı.
