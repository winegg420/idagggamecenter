# AŞAMA 2A — TAKSİM GREYBOX + YERLEŞİM MANİFESTİ · 17 Eyl 2026

Bu paket sanat üretmedi. Taksim Meydanı ve İstiklal Caddesi 1 birim = 1 metre ölçeğinde, gezilebilir bir greybox olarak
kuruldu. Bütün yerleşim `bildim/harita/yerlesim.json` manifestine taşındı. Greybox bilerek çirkin: düz gri tonlar, doku,
AO ya da süs ışığı yok, her şeyin üstünde bir kimlik etiketi var.

## 0. Önce bilinmesi gereken dört şey

1. **Canlı meydanı görmedim.** Meydan sayfası giriş istiyor ve ben senin hesabınla giriş yapamam. Bu yüzden bütün ölçümler
   ve görüntüler aynı dünya kodunda alındı: `dunyaKur` + `yerlesim.json`, meydan avatarı, `carpismaDuzelt`, oyun kamerası
   ve `YURUME_HIZI`. Ayrı bir yerel ölçüm sayfası ve üretim derlemesi kullanıldı. Canlı sayfanın kendisinde açılışı sen
   doğrulayacaksın.
2. **Sokağın son 10–19 metresinde kamera oyuncuyu kaybediyor** (§7.5). Stüdyo ve Ayarlar kapıları bu bölgede.
   Yerleşimi değiştirmedim; seçenekler §7.5'te.
3. **25 oyuncuda sınırı greybox değil mevcut meydan avatarları aşıyor.** Greybox en kötü açıda tek başına 165 çağrı
   kullanıyor; 25 avatarla toplam 924–972. Ayrıntı §6'da.
4. **Plazanın içinden Boğaz görünmüyor.** AKM kütlesi doğu manzarasını kapatıyor; silüet yalnız plazanın kuzeydoğu
   kenarından seçiliyor (görsel 11).

## 1. Canlıda nasıl gezilir

| Nerede | Adres |
|---|---|
| Quiz Tactics | `https://quiztactics.vercel.app/harita?harita=taksim` |
| Hub | `https://idagg-game-center.vercel.app/bildim/harita?harita=taksim` |
| Eski meydana dönüş | aynı adres, sonunda `?harita=eski` |

- Seçim cihazda hatırlanır. Bir dükkâna girip dönünce yine Taksim açılır.
- Parametresiz meydan, diğer oyuncular için, Paket 13 dünyası olarak kaldı.

**Greybox'ta bilinen sınırlar:**
- Çoklu oyuncu kanalı ortak (`coklu.js`'e dokunulmadı). Eski meydandaki oyuncular seni kendi haritalarında Taksim
  koordinatlarında görür; sen de onları Taksim'de görürsün.
- Botlar kodu değişmeden dairesel meydan planını izliyor. Göl ve köprü olmadığı için balık bacakları otomatik kapalı.
- Balıkçı NPC ve olta greybox'ta yok (göl donduruldu).

## 2. `yerlesim.json` — manifest

| Bölüm | Adet | İçerik |
|---|---|---|
| `sinir` | 2 parça | Birleşim: plaza dairesi (r 42) + İstiklal koridoru (12 m). Dışına çıkan oyuncu en yakın kenara itilir. |
| `bolgeler` | 3 | `plaza` (kaldırım), `meydan` (taş, r 26), `istiklal` (koridor, 2 m kaldırımlı) |
| `parseller` | 27 | 9 girilebilir + 18 girilemez (ayrıntı aşağıda) |
| `noktalar` | 4 | `spawn_varsayilan`, `anit` (Cumhuriyet Anıtı, ayak izi + gövde), `npc_yemci`, `tabela_istiklal` |
| `alanlar` | 11 | 3 ağaç, 3 bank, kedi gezinti, martı, 3 aydınlatma hattı (`aralik: 12`) |
| `tramvay` | 1 hat, 2 durak | `durak_taksim`, `durak_tunel`; araç yok |
| `arkaplan` | 5 | Boğaz (su), karşı yaka (tepe), 15 Temmuz köprüsü silueti, kuzey ve batı şehir kuşağı |

**9 girilebilir dükkân** (yan yana A cephesi ve B cephesi):

| A cephesi | Rota | B cephesi | Rota |
|---|---|---|---|
| `dukkan_normal` | `/` | `dukkan_lig` | `/siralama` |
| `dukkan_hizli` | `/hizli-mod` | `dukkan_hatalarim` | `/calisma` |
| `dukkan_duello` | `/duello` | `dukkan_dukkan` | `/joker` |
| `dukkan_turnuva` | `/turnuva` | `dukkan_studyo` | `/gorunum` |
| | | `dukkan_ayarlar` | `/profil` |

**Kütle çeşitliliği:**

| Sınıf | Adet | Kat / yükseklik |
|---|---|---|
| Küçük dükkân | 9 | 1–2 kat |
| Apartman | 6 | 4–5 kat |
| Köşe binası | 3 | 3–4 kat |
| Dar/uzun yapı | 5 | 4–5 kat |
| Kamusal yapı | 2 | `kamusal_istiklal` 14 m, `kamusal_akm` 52×20×20 m |
| Landmark | 2 | `landmark_taksim_camii` kubbeli, `landmark_minare` 42 m |

Genişlik, derinlik ve yükseklik parselden parsele değişiyor.

**Şema (parsel):**
```json
{
  "id": "dukkan_lig", "tur": "kucuk_dukkan", "kat": 2, "girilebilir": true,
  "capa": {"konum": [x, 0, z], "donus_y": -2.22},
  "ayakizi": {"en": 8, "derinlik": 9, "yukseklik": 7},
  "yuva": "bina_kucuk_dukkan", "yertutucu": "kutu",
  "mod": "/siralama", "ad": "Lig", "alt": "haftalık sıralama"
}
```

**Koordinat kuralları:**
- `konum` ayak izinin merkezi, zemin y = 0. +X doğu, −Z kuzey.
- `donus_y` radyan cinsinden. Parselin ön cephesi (kapı yüzü) `atan2(dx, dz)` yönüne bakar.
- `yertutucu`: `kutu` · `kubbe` · `silindir`.

**Kurallar, uygulandı:**
- `dunya.js` konum hesaplamaz; greybox tamamen manifestten kurulur.
- Girilebilir parselde kapı, tabela ve ışık var; girilemezde hiçbiri yok.
- Her parselin `yuva` alanı var; final varlık o adla gelecek.
- Çarpışma ayak izlerinden türetiliyor: yönlü kutu + birleşik sınır.
- Kapı ipucu kapı önü noktasından 5 m içinde çıkıyor.
- Manifest doğrulaması: 27 parselde çakışma yok (ilk taslakta AKM ile güneydoğu apartmanı 0,21 m çakışıyordu, manifestte
  elle düzeltildi). Bütün kapı noktaları yürünebilir alanda. İstiklal cepheleri eksenden ±6,00 m'de ve sokağa paralel
  (ölçüldü).

## 3. Görüntüler — `bildim/harita/gorsel/2a/`

| # | Dosya | Ne |
|---|---|---|
| 01 | `01_plan_genel_ortografik.jpg` | Kuş bakışı plan, 250 m, etiketler okunur |
| 02 | `02_plan_meydan_ortografik.jpg` | Meydan yakın plan (120 m) |
| 03 | `03_plan_istiklal_ortografik.jpg` | İstiklal yakın plan (120 m) |
| 04–06 | `04…06_25_oyuncu_*` | 25 oyuncu meydanda: oyun kamerası zum 1, zum 2,2 ve üstten |
| 07 | `07_sokak_seviyesi_meydan.jpg` | Sokak seviyesi: meydan + anıt (25 oyuncuyla) |
| 08 | `08_sokak_seviyesi_istiklal_girisi.jpg` | İstiklal girişi, tabela, tramvay durağı |
| 09 | `09_sokak_seviyesi_dukkan_onu.jpg` | Dükkân önü (Hızlı Mod kapısı, tabela, ışık) |
| 10 | `10_sokak_seviyesi_landmark_cami_minare.jpg` | Landmark: cami + minare |
| 11 | `11_kuzeydogu_kenar_bogaz_kopru_silueti.jpg` | Arka plan kuşağı: köprü + Boğaz (yalnız kuzeydoğu kenarından) |
| 12 | `12_oyun_kamerasi_sokak_s100_temiz.jpg` | Oyun kamerası sokak ortasında: temiz |
| 13 | `13_oyun_kamerasi_sokak_s124_SIKISIYOR.jpg` | Oyun kamerası sokak sonunda: kapanış binası oyuncuyu kapatıyor |

Ortografik planlar ölçüm sayfasının `plan()` işleviyle çizildi. İlk kuş bakışı denemesi perspektif kamerayla yapılmıştı;
binalar sokağa göre dönük görünüyordu. Geometri sayısal olarak doğru çıktı, bozulma perspektiften geliyordu.

## 4. Nasıl düzenlenir — bir binayı kaydırmak

1. `bildim/harita/yerlesim.json`'da binanın `"id"` satırını bul (örn. `"dukkan_lig"`).
2. `"capa": {"konum": [x, 0, z]}` içindeki `x` (doğu +) ya da `z` (güney +) sayısını metre cinsinden değiştir. Döndürmek
   için `donus_y`, büyütmek için `ayakizi`.
3. Kaydet, commit et. Kod değişmez; çarpışma, kapı ipucu ve etiket yeni konumdan kendiliğinden türer.

## 5. Oynanış katmanı

Dokunulmayanlar: `coklu.js`, presence/poz/emoji yayını, `kontrol.js` (topuz), kamera takip formülü, zıplama, dans, ikram
ve `yokEt()` temizliği. Sekme gizliyken durdurma `HaritaSayfasi`'nda olduğu gibi.

`dunya.js`'te değişenler:
- Manifest verilince eski dünya yerine greybox kurulur.
- Çarpışma ve bina ipucu manifestten gelir.
- Sis ve uzak kırpma genişletildi.
- Ölçüm için `kameraSabitle` eklendi; oyun kamerasını yalnız çağrılınca ezer.

`HaritaSayfasi.jsx`'te değişenler: harita seçimi, doğuş noktası ve bot kenar kapılarının başlangıcı manifestten, balıkçının
koşullu kurulumu, bir hata ayıklama kancası.

## 6. Ölçüm — greybox ALT SINIRDIR

**Koşullar:** üretim derlemesi (`node bildim/harita/olcum/greybox.mjs`), DPR 1, kanvas 1536×791, 120 kare ısınma,
300 kare örnek. Metrik `cizim()` + `gl.finish()` medyanı ve p95. Işık B+, gölge açık.

Her durum **tek koşu** olarak ölçüldü (README'deki 3 dönüşümlü koşu A/B karşılaştırması içindir). Otomasyon sekmesinde
ölçüldüğü için mutlak ms, S0 düzeneğiyle karşılaştırılmamalı.

**En kötü açı:** kamera sokağın ucunda göz hizasında, boydan boya meydana bakıyor. Bütün cepheler, meydan ve AKM görünüyor.

| Durum | Çizim çağrısı | Görünen üçgen | CPU+GPU medyan / p95 |
|---|---|---|---|
| **Greybox dünyası yalnız**, en kötü açı, etiketsiz | **165** | **2.618** | **1,7 / 2,2 ms** |
| Greybox dünyası yalnız, en kötü açı, etiketli | 213 | 2.714 | 2,1 / 2,6 ms |
| Greybox dünyası yalnız, tüm harita üstten, etiketsiz | 167 | 2.642 | 1,7 / 2,2 ms |
| Greybox dünyası yalnız, doğuş, oyun kamerası | 69 | 1.338 | 0,9 / 1,5 ms |
| 1 karakter, doğuş, oyun kamerası, etiketli | 197 | 60.602 | 1,8 / 2,4 ms |
| 25 karakter, doğuş, oyun kamerası, etiketsiz | 767 | 327.530 | 6,1 / 8,2 ms |
| 25 karakter, en kötü açı, etiketsiz | 924 | 358.450 | 8,6 / 11,1 ms |
| 25 karakter, oyun kamerası zum 3, oyuncu sokakta, etiketsiz | 495 | 179.782 | 4,5 / 5,5 ms |
| **Sınır** | **≤ 220** | **≤ 460.000** | **≤ 4,0 ms** |

**Yorum — greybox:**
- Üçgen önemsiz, 2,6 bin.
- Çizim çağrısı **sınırın %75'i**, 165 / 220. Paketin "bütçenin yarısını yiyorsa" uyarısı tetikleniyor.
- Sebep alan büyüklüğü değil nesne sayısı: greybox 121 ayrı mesh (49'u gölge atıyor) ve 62 etiket sprite'ı.
  Her parsel kütlesi; her dükkânın kapısı, tabelası ve ışığı; her lamba direği ve lambası ayrı çizim.
  Gölge geçişi de aynı nesneleri bir kez daha sayıyor.
- **Sanat katmanında her parsel ve her lamba ayrı mesh olarak takılırsa çevre tek başına sınırı aşar.**
  Aynı tür parseller ve lambalar örneklemeyle (instancing) ya da birleştirerek çizilmeli.

**Yorum — karakterler:**
- 25 **mevcut meydan avatarı** tek başına yaklaşık 580 çağrı ve 267 bin üçgen ekliyor. Avatar başına yaklaşık 24 çağrı
  ve 11 bin üçgen.
- Bu Aşama 1G'deki atlaslı karakter hattı değil, canlıdaki eski avatar sistemi. Greybox ne olursa olsun 25 oyuncuda 220
  çağrıyı ve 4,0 ms'yi aşıyor.
- Bu paketin kapsamı dışında ama sanat katmanından önce bilinmesi gereken bir bulgu.

## 7. Yürüyerek cevaplanan sorular

Yürüyüşler oyun döngüsüyle aynı adımla simüle edildi: sabit dt 1/60, `yon · 9 · dt`, sonra `carpismaDuzelt(0,8)`.
Hiçbirinde takılma olmadı.

| # | Soru | Cevap |
|---|---|---|
| 1 | Yürüme hızı | **9 birim/sn.** `HaritaSayfasi.jsx` `YURUME_HIZI = 9`, topuz çarpanı `Math.min(hypot, 1)` |
| 2 | İstiklal baştan sona | **9,83 sn** (88,5 m, plaza kenarından sokak sonuna). Hedef ≤ 10 sn: **geçti, kıl payı** |
| 3 | Meydanın bir ucundan diğerine | Taş meydan (r 26), anıtın çevresinden: **5,87 sn**. Plaza (r 42) çapı, doğu–batı ve kuzey–güney: **9,2 sn** |
| 4 | Meydan 25 oyuncu için doğru mu | Aşağıda |
| 5 | Kamera sokakta sıkışıyor mu | Aşağıda |
| 6 | Doğuştan en uzak dükkâna | **13,28 sn** (`dukkan_ayarlar`, 119,5 m). Sonraki ikisi `dukkan_studyo` 12,28 sn, `dukkan_turnuva` 11,45 sn |

### 7.4 — 25 oyuncu meydanda

| Ölçü | Değer |
|---|---|
| Taş meydan, oyuncu başına | 81 m² |
| Plaza, oyuncu başına | 218 m² |
| En yakın komşu mesafesi, ortalama / en az | 5,5 m / 3,2 m |
| Oyun kamerasında ekranda görünen (zum 0,55 / 1 / 3) | 16 / 21 / 25 |

Varsayılan zumda 25 kişiden 21'i ekranda ve aralarında ortalama 5,5 m var. Meydan tıkış değil; oyuncular dağınık duruyor.
Görsel 04–06'da seyrek okunuyor. Daha kalabalık bir his isteniyorsa taş meydanın yarıçapı 26 yerine yaklaşık 20 alınabilir.
Bu da manifestte tek sayı. **Karar senin.**

### 7.5 — Kamera sokakta

**Sokak boyunca hayır.** Ölçülen noktalar: s = 45, 85 ve 100, eksende ve iki cephe dibinde (±4,8 m), zum 0,55, 1 ve 3.
Kamera hiçbir binaya girmedi, oyuncuyu kaybetmedi. Sebebi şu: oyun kamerasının sabit ofseti (−13, +17) İstiklal'in yönüyle
aynı. Kamera oyuncunun tam arkasında, sokağın içinde kalıyor.

**Sokağın sonunda evet.** Kamera aynı eksende 12–21 m geride olduğu için sokağı kapatan `apartman_istiklal_ucu`
parselinin üstüne ve içine düşüyor. Eşik (sokak sonu cephesi s = 133):

| Zum | Kameranın binanın içinde olduğu yer | Oyuncunun kapandığı yer |
|---|---|---|
| 0,55 | s ≥ 120 | — |
| 1 | — | s ≥ 113 (son 19 m) |
| 3 | — | s ≥ 122 (son 10 m) |

Etkilenen kapılar `dukkan_studyo` (s ≈ 118) ve `dukkan_ayarlar` (s ≈ 127). `dukkan_turnuva` (s ≈ 110) sınırda.

Seçenekler, **uygulanmadı, karar senin:**
- **a) Sokağı açık bitir:** manifestten `apartman_istiklal_ucu` parselini kaldır.
- **b) Kapanış binasını en az 20 m geri çek:** manifestte `capa.konum`.
- **c) Kamerayı çarpışmalı yap:** oynanış katmanı, bu paketin kapsamı dışı.

## 8. Kurallar

- Mevcut oynanış sistemlerine dokunulmadı (§5).
- Yerleşim manifestten okunuyor.
- Doku, malzeme çeşitlemesi, prop modeli, karakter ve kozmetik yok.
- SQL ve migration yok; yeni çalışma-anı paketi yok.
- `npm run build` temiz.
- Ölçüm sayfasında konsol hatası 0. Tek uyarı eski koddan: `PCFSoftShadowMap deprecated`.
- Her adım ayrı commit.

**DUR.** Sanat, cephe, doku, karakter ve kozmetik işine başlanmadı. Sen yürüyüp ölçüleri görecek ve yerleşimi
onaylayacaksın; 7.4 ve 7.5 senin kararını bekliyor.
