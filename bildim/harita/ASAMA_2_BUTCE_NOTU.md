# AŞAMA 2 İÇİN BÜTÇE NOTU — İstiklal Sokağı yapılmadan ÖNCE okunacak

> Aşama 2 promptu yazılırken bu bölüm olduğu gibi içine konacak.
> Kaynak: Aşama 1C ölçümleri (`public/meydan/deneme/*.olcum.json` + `ASAMA_1C_RAPOR.md`), kalem kalem.
> Bu dosya Aşama 1D'de (16 Eyl 2026) depoya yazıldı; **Aşama 2 işlerine başlanmadı.** Bölüm D (prop optimizasyonu)
> 1D'de yapıldı — güncel çevre sayıları `ASAMA_1D_RAPOR.md`'de.

## 1. Çevre bütçesi gerçekte nereye gidiyor

Toplam 67.758 üçgen (rapor: 67.890, tabela dahil). Karakterler bu sayıya
**dahil değil** — ayrı kalem (275.160).

> **Tablo nasıl okunacak — önemli:** "Etkin" sütunu `renderer.info.triangles`
> değeridir ve **gölge geçişini ayrı bir çizim olarak sayar.** Gölge atan bir
> nesnenin geometrisi iki kez rasterize edilir: bir kez kameraya, bir kez gölge
> haritasına. Yani bina mesh'i **4.804 üçgen**, gölge geçişi **+4.804**, etkin
> yük **9.608**. Bu, binanın 9.608 üçgenlik bir mesh olduğu anlamına GELMEZ.

| Kalem | Adet | Mesh üçgeni | Gölge geçişi | **Etkin** | Pay |
|---|---:|---:|---:|---:|---:|
| **Ağaç tacı** | 24 | 11.280 | +11.280 | **22.560** | **33 %** |
| Bank | 10 | 9.720 | — | 9.720 | 14 % |
| **Bina** | 1 | 4.804 | +4.804 | **9.608** | **14 %** |
| Saksı | 16 | 8.448 | — | 8.448 | 12 % |
| Lamba | 12 | 6.000 | — | 6.000 | 9 % |
| Ağaç gövdesi | 24 | 2.880 | +2.880 | 5.760 | 9 % |
| Zemin | 1 | 3.058 | — | 3.058 | 5 % |
| Kedi | 3 | 1.956 | — | 1.956 | 3 % |
| Bordür | 1 | 648 | — | 648 | 1 % |

### Beklenmedik sonuç
**Bütçeyi bina değil AĞAÇLAR yiyor.** Ağaç tacı + gövde = **28.320 üçgen
(%42)**. Bina yalnız %14. Yani "10 dükkân bütçeyi patlatır" endişesi doğru
ama **yanlış kalemi** işaret ediyor.

İkinci sürpriz: **bir bank 972 üçgen.** Oyuncunun hiç yakından bakmadığı bir
prop, binanın beşte biri kadar geometri harcıyor. Lamba 500, saksı 528 —
hepsi gereğinden ağır.

## 2. Aynı yoğunlukla İstiklal Sokağı yapılırsa

```
Prop + kedi + bordür (bina ve zemin hariç) ...... 55.092
Sokak zemini (3× büyük, tahmin) .................. 5.000
Binalara kalan .................................. 19.908
```

| Bina tipi | Maliyet | Sığan bina |
|---|---:|---:|
| Gölge atan, tam detay | 9.608 | **2** |
| Gölge atmayan, tam detay | 4.804 | **4** |

**10 dükkân değil, 2 dükkân sığıyor.** Sorun düşündüğümüzden büyük ve çözümü
binada değil, prop tarafında.

## 4. Üç katmanlı bina LOD — şart

| Katman | Mesafe | İçerik | Gölge |
|---|---|---|---|
| **LOD0** | yakın | tam cephe: tabela, tente, balkon parmaklığı, pencere çerçevesi, kapı girintisi | evet |
| **LOD1** | orta | balkon/parmaklık/çerçeve sadeleşir; detay atlas dokusuna taşınır | basitleşir veya kapanır |
| **LOD2** | uzak | yalın kütle + siluet; küçük prop yok | hayır |

## 5. Seçici gölge kuralı
Her bina gölge atmaz. Gölge atanlar: oyuncuya yakın binalar ve büyük siluet
oluşturan kütleler. Uzak cephelerin küçük detayları asla.

## 6. Modüler bina — 10 unique bina YAPILMAYACAK
Ortak parça havuzu: pencere, balkon, tente, kapı, çatı, tabela çerçevesi,
kat silmesi, korniş. Bina = bu parçaların farklı dizilimi.
**Görsel çeşitlilik renk + tabela + cephe düzeni + modül kombinasyonundan
gelir**, sıfırdan modelden değil. Tek atlas, tek malzeme kuralı geçerli.

## 7. FRUSTUM CULLING TEK BAŞINA GÜVENİLMEZ
Kamera kesmesi Aşama 1C'de 102 çağrıyı 59'a düşürdü — gerçek ve değerli.
Ama:
- İstiklal gibi **uzun bir sokakta kamera yönüne göre 6-8 cephe aynı anda
  görüş alanına girer**
- Görüş alanında olup **uzakta küçük görünen bina hâlâ tam detay mesh ise**
  GPU maliyeti devam eder — culling bunu çözmez, LOD çözer

Culling + LOD + seçici gölge + instancing **birlikte** tasarlanacak.

---

## 7B. İKİ AYRI BÜTÇE — karıştırma

`80.000 üçgen` sınırı **haritanın toplam geometrisi değil**, aynı anda
**görünen** geometridir. İkisi farklı şey, farklı sorunu ölçer:

| | Ne ölçer | Sınır | Nasıl ölçülür |
|---|---|---|---|
| **A. En kötü durum görünür çevre** | O karede rasterize edilen üçgen — **performans kriteri budur** | **≤80.000 etkin üçgen** (gölge geçişi dahil) | `renderer.info.render.triangles`, en çok cephenin göründüğü kamera açısında |
| **B. Haritanın toplam varlığı** | Diskten inen ve VRAM'de duran benzersiz geometri — **yükleme süresi ve bellek kriteri** | aşağıda | dosya boyutu + benzersiz üçgen toplamı |

İstiklal'in görüş alanı dışında kalan, kesilmiş ya da LOD2'ye düşmüş
geometrisinin **VRAM ve indirme maliyeti vardır** ama o karede rasterize
edilmez. Büyük haritada performans kriteri her zaman
**o anda görünür üçgen + çizim çağrısı + kare süresi**'dir.

### B için mevcut durum (ölçüldü) ve Aşama 2 sınırı
```
                         ŞU AN (1C)        AŞAMA 2 SINIRI
GLB dosyaları            1,91 MB           ≤ 6 MB
Doku (atlas + temas)     0,93 MB           ≤ 1,5 MB (tek 1024² atlas korunur)
Benzersiz üçgen (disk)   28.628            ≤ 90.000
```
Modüler bina parçaları (§6) B bütçesini de korur: 10 farklı bina modeli yerine
~12 ortak parça, kombinasyonla çeşitlilik.

---

## 8. SERT KAPI — 10 dükkân üretilmeden ÖNCE

> **10 dükkânın hiçbiri üretilmeyecek** — önce en kötü durum sahnesi kurulacak:
>
> - **6 görünür bina cephesi** (LOD0/LOD1/LOD2 karışık)
> - **25 karakter**
> - **Planlanan sokak prop yoğunluğu** (ağaç, lamba, bank, saksı, tabela, tente)
> - LOD, seçici gölge, frustum culling ve instancing **aktif**
> - Kamera sokağın ucundan boydan boya bakacak — en çok cephenin göründüğü açı
>
> Bu sahnede ölç: **çizim çağrısı · görünen üçgen · kare süresi.**
>
> | Sınır | Değer |
> |---|---|
> | Çizim çağrısı | ≤220 |
> | **Görünen** üçgen (§7B/A) | ≤420.000 toplam · çevre payı ≤80.000 |
> | **Kare süresi (masaüstü)** | **≤4,0 ms** |
> | fps | 60 (tek başına yeterli DEĞİL, aşağıya bak) |
>
> ### Neden fps tek başına yetmez
> Tarayıcı VSync'e kilitlidir: sahne 3 ms de sürse 15 ms de sürse HUD 60 fps
> yazar. fps, tavana çarpana kadar hiçbir şey söylemez — çarptığı an da iş
> işten geçmiştir. **Asıl gösterge kare süresidir.**
>
> ### 4,0 ms nereden geliyor
> Mevcut ölçüm: **2,14 ms** (Geniş) · **2,22 ms** (Oyun), 1920×918, masaüstü
> tümleşik AMD Radeon. Ölçüm `gl.finish()` ile alınıyor — yani **CPU + GPU
> dahil gerçek kare süresi**, yalnız JS süresi değil. Doğru şeyi ölçüyor.
>
> 4,0 ms = mevcudun yaklaşık **2 katı**. Sokak sahnesi bugünkü test
> sahnesinden ağır olacağı için pay bırakıyoruz, ama iki katından fazlasına
> izin vermiyoruz.
>
> **Uyarı:** 4,0 ms masaüstü için bir **vekil sınırdır**, telefon ölçümü
> değildir. Orta sınıf bir telefon tümleşik masaüstü GPU'sundan belirgin
> ölçüde yavaştır ve bu oran cihaza göre değişir — tahmin yazma. Sokak
> sahnesi ayakta kalınca **gerçek Android cihazda ölçüm yapılacak**; o ölçüm
> alınana kadar telefon satırına `ölçülmedi` yazılacak.
>
> **Bütçe aşılıyorsa 10 binanın üretimine BAŞLAMA** — önce bina hattını
> optimize et ve testi tekrarla.

Sebep: sokağı bitirip sonra optimize etmek, sokağı baştan yapmak demektir.
6 bina ile en kötü gerçek oyun görüntüsünü simüle edip mimariyi önce doğrularız.

---

# EK — AŞAMA 2 KARE SÜRESİ / KARAKTER MALİYETİ SERT KAPISI

> Aşama 1D sonunda doğrulanmamış bir kare süresi riski oluştu: 1C ~2,14 ms,
> 1D 2,8–3,2 ms, ama **aynı oturumda ölçülmediler.** Üçgen artışı yalnız %1,7
> olduğu için fark geometri dışı (fragment/shader) olabilir — ya da yalnız
> tarayıcı gürültüsü. Bu belirsizlik Aşama 2'ye taşınmayacak.

## S-1. METRİK TANIMI — ÇÖZÜLDÜ, koddan doğrulandı

Bu bölüm bir görev değil, bir bulgudur. Aşama 2'de bu ayrım korunacak.
`DenemeSayfasi.jsx` içinde iki farklı ms var ve raporlarda birbirine karışmış durumdalar:

| | Kod | Ne ölçer |
|---|---|---|
| **HUD'daki ms** | satır 524: `t0 = performance.now(); render.render(...); sure += performance.now() - t0` | **Yalnız CPU.** WebGL komutları kuyruğa atılır; `render.render()` GPU bitince değil, komutlar gönderilince döner. Bu CPU gönderim süresi, kare süresi değil. |
| **`kareSuresi()` API'si** | satır 554: `for (...) { cizim(); gl.finish(); }` | **CPU + GPU.** `gl.finish()` GPU'yu bekletir. Gerçek kare süresine yakın. |

### Kanıt — raporlar bu yüzden çelişiyor
- Ekran görüntüsündeki HUD (1D): **1,43 ms · 1,45 ms**
- 1D raporunun tablosu: **2,8–3,2 ms**
- 1B: HUD **1,86 ms**, aynı raporun tablosu **2,45 ms**

Aynı sahne, iki farklı sayı. HUD ms ≠ rapor ms. Bir HUD ekran görüntüsünü
rapor sayısıyla karşılaştıran herkes yanlış sonuç çıkarır.

### Aşama 2 kuralı
- Sert kapı (`≤4,0 ms`) **`kareSuresi()` metriğine göre tanımlıdır** — CPU+GPU.
  HUD sayısıyla ASLA karşılaştırılmayacak.
- Her ms değerinin yanına hangi metrik olduğu yazılacak:
  `3,10 ms (CPU+GPU, gl.finish)` ya da `1,45 ms (yalnız CPU gönderim)`.
- HUD'a **iki sayı birden** yazdırılacak, etiketli — karışıklık bir daha olmasın.
- `gl.finish()` kusursuz değildir: CPU ile GPU'yu sıraya sokar, boru hattını
  bozar, bu yüzden gerçek maliyeti olduğundan yüksek gösterme eğilimindedir.
  **Karşılaştırma için tutarlıdır, mutlak değer için değil.**
- Doğru araç `EXT_disjoint_timer_query_webgl2` (gerçek GPU zamanlayıcısı) —
  destekleniyorsa Aşama 2'de eklensin, üçüncü metrik olarak raporlansın.
- **Terminoloji:** NPC mantığı, arayüz, çok oyunculu durum senkronu ve
  enterpolasyon CPU tarafında yer alır ve `kareSuresi()` metriğinin
  içine tam olarak girmez. Bunlar için ayrı bir **toplam kare süresi**
  (`requestAnimationFrame` aralığı) ölçülecek. Üç metrik, üç isim, karıştırma.

## S0. ÖNCE BUNU YAP — en ucuz kesin deney (5 dakika)

A/B/C/D ayrıştırmasına girmeden önce regresyonun gerçek olup olmadığını tek adımda öğren.

### Depo durumu — kontrol edildi (16 Eyl)
Çalışma ağacı temiz, 1D tamamen commit'li → `git stash` GEREKMİYOR.
`public/meydan/deneme/` altındaki 28 varlık dosyası git'te izleniyor
(`.gitignore`'da değil) → checkout 1C'nin GLB'lerini ve atlasını da geri
getirir. 1C ile 1D arasında bu dosyalar gerçekten değişmiş (lamba 20.612 →
11.004 bayt vb.), yani ölçüm doğru varlıklarla yapılacak.

> **Yine de önce `git status` ile doğrula.** Commit edilmemiş iş varsa ölçüm
> uğruna kaybetme: `git worktree add ../qt-1c 02511f8` ile **ayrı bir çalışma
> ağacında** aç, ölç, `git worktree remove ../qt-1c` ile kaldır. Mevcut
> dizine hiç dokunmadan iki sürümü yan yana tutabilirsin.

```bash
git status                                  # temiz mi?
git worktree add ../qt-1c 02511f8           # 1C'yi ayrı klasörde aç
cd ../qt-1c && npm install && <AYNI MOD ile çalıştır> && ölç
cd - && git worktree remove ../qt-1c
```

### KRİTİK — aynı derleme modu
1D sayıları Vercel'deki üretim derlemesinden okunduysa, 1C'yi yerelde
`npm run dev` ile ölçmek geçersizdir. Vite geliştirme modu modülleri ayrı ayrı
ve küçültmeden servis eder; CPU süresi belirgin farklı çıkar. İkisi de
**aynı modda** ölçülecek — tercihen `npm run build && npm run preview`
(üretim derlemesi, yerel sunucu). Hangi mod kullanıldığı rapora yazılacak.

### Sabit tutulacaklar
Aynı tarayıcı oturumu, aynı sekme, aynı canvas boyutu, `devicePixelRatio = 1`,
aynı kamera, aynı karakter sayısı ve konumları, aynı animasyon, aynı gölge
ayarı, aynı ışık modu (B+).
Raporun kendi itirafı buydu: "aynı oturumda 1C durumu yeniden ölçülmedi." **Ölç.**

- **Fark < %10** → regresyon yok, oturum gürültüsüydü. S1-S3'ü atla, yalnız S4'ü (güvenlik payı) uygula.
- **Fark %10 – %20** → belirsiz. Testi 3 kez tekrarla, sekmeyi aralarında yenile, **medyan** farkı kullan.
  Medyan fark hâlâ %10'un üstündeyse S1'e geç, altındaysa gürültü say.
- **Fark > %20** → gerçek. S1'e geç.

Her iki ölçüm de `kareSuresi()` ile alınacak (S-1), HUD'dan okunmayacak.

## S1. FRAGMENT Mİ, VERTEX Mİ — tek deneyle öğren

Regresyon gerçekse, hangi kaldıracı çekeceğini bu deney söyler. A/B/C/D'den
daha bilgilendiricidir ve 5 dakika sürer.

**Yöntem:** aynı sahneyi **üç çizim ölçeğinde** ölç — `%100 · %75 · %50`
(canvas boyutu ve `setPixelRatio`; kamera, karakter konumları, animasyon,
gölge ayarları aynı). Tek bir A/B değil, üç nokta.
Sonra kare süresini piksel sayısına karşı çiz ve **eğime** bak.

| Gözlem | Yorum |
|---|---|
| Piksel azaldıkça süre belirgin ve tekrarlanabilir biçimde düşüyor, eğim dik | Fragment maliyeti önemli — suçlu shader: yüz yamaları, ten eşleme dallanması, robot emissive, örtüşme |
| Süre neredeyse hiç değişmiyor, eğim düz | CPU / vertex / çizim çağrısı tarafı baskın |
| Arada | İkisi de katkı veriyor; eğimin büyüklüğünü raporla, tek bir etiket yapıştırma |

> **DİKKAT — yaygın hata:** "fragment sınırlıysa piksel %75 azalınca süre de
> %75 düşmeli" **YANLIŞTIR.** Kare süresinin içinde piksel sayısıyla
> ölçeklenmeyen sabit maliyetler var: CPU gönderim, iskelet dönüşümü, vertex
> işleme, gölge haritası (kendi sabit çözünürlüğünde), JS. Fragment maliyeti
> baskın olsa bile toplam %75 düşmez.
> **%75'e yakın düşüş güçlü fragment işaretidir; %75 düşmemesi fragment
> maliyetini DIŞLAMAZ.** Yalnız çok az değişim CPU/vertex tarafını işaret eder.

Bu ayrım yapılmadan LOD tasarlamak körlemesine optimizasyondur.

## S2. KARAKTER MALİYETİ — fark değil, EĞİM ölç

`A − B` (karakter açık − karakter kapalı) tek bir farktır; CPU/GPU örtüşmesi
yüzünden gürültülüdür ve karakterler kapalıyken darboğaz tamamen başka yere
kayabilir — o yüzden maliyeti eksik gösterir.

**Daha sağlam yöntem:** 1 · 5 · 15 · 25 karakterle ölç, doğrunun **eğimini** al.
Eğim = karakter başına ms. Dört nokta, tek farktan çok daha güvenilirdir ve
LOD'un düşürmesi gereken sayıyı doğrudan verir.
Aynı ölçüm **1C commit'inde de** yapılacak. Karşılaştırma:

> **Regresyon eşiği:** 1D'nin karakter başına ms eğimi, 1C'ninkinden
> **%15'ten fazla yüksekse** ve bu **3 ayrı çalıştırmada tekrarlanıyorsa**
> regresyon gerçektir. Altındaysa gürültüdür, LOD'a girme.

### Doğrusallık varsayılmayacak
Maliyet karakter sayısıyla doğrusal olmak zorunda değildir. 25 karakterde
GPU başka bir darboğaza geçebilir, gölge geçişi ve örtüşme orantısız artabilir.
Bu yüzden rapora yalnız eğim yazılmayacak:
- Dört ham nokta (1 · 5 · 15 · 25 için **medyan ve p95**) tablo olarak
- Doğrusal uyumun **R²** değeri
- **R² < 0,95 ise "karakter başına X ms" diye tek sayı ÇIKARMA.** Eğrinin kendisini raporla.

> Doğrusal olmayan davranışın kendisi önemli bir bulgudur — gizlenmeyecek,
> aksine öne çıkarılacak. Nerede kırıldığı LOD'un nereden başlaması
> gerektiğini söyler.

### Ölçüm hijyeni (hepsinde zorunlu)
- **Isınma:** ilk 120 kare atılacak (shader derlemesi, doku yükleme)
- **Örneklem:** en az 300 kare; **medyan ve p95** raporlanacak, ortalama değil
- **Sabitlenecekler:** sekme, canvas boyutu, `devicePixelRatio` (ölçüm için 1'e
  sabitle — DPR fragment maliyetini doğrudan çarpar, en sinsi değişkendir),
  kamera, karakter konumları, animasyon karesi, gölge açık/kapalı
- Her yapılandırma **3 kez** ölçülecek, aralarında sekme yenilenecek

> **Dürüstlük notu rapora yazılacak:** bu bir profiler ayrıştırması değildir.
> CPU ve GPU işi örtüşür; bu yöntem mutlak maliyeti değil, **kontrollü A/B ile
> regresyonu** tespit eder. Kesin GPU profili iddia edilmeyecek.

## S3. REGRESYON DOĞRULANIRSA — geri alma, LOD yap

1D görsel kazanımları **geri ALINMAYACAK.** Yeni yüz sistemi ve robot silueti
net ilerlemedir. Doğru mimari, yakın kaliteyi koruyup maliyeti **mesafeye** bağlamaktır.

| Katman | Mesafe | Yüz yamaları | Ten eşleme shader'ı | Emissive | Geometri |
|---|---|---|---|---|---|
| **LOD0** | yakın | tam | açık | açık | tam (mevcut kalite, düşürülmeyecek) |
| **LOD1** | orta | göz kalır, ağız atlasa iner | kapalı (sabit ton) | kapalı | kafa bölümü azalır |
| **LOD2** | uzak | yok | kapalı | kapalı | siluet + ana renk blokları |

LOD2'de siluet ve ana renk **korunacak** — oyuncu uzaktan da kim olduğunu
(insan/kaplan/robot, kıyafet rengi) ayırt edebilmeli.

## S4. SERT KAPI — güvenlik payı (regresyon olsun olmasın uygulanır)

En kötü durum sahnesi: 6 görünür cephe + 25 karakter + tam sokak prop
yoğunluğu, kamera sokağın ucundan boydan boya.

> **4,0 ms sınırı hangi metriğe ait:** yalnız `kareSuresi()` — CPU+GPU,
> `gl.finish` vekili, **medyan**. HUD'un CPU gönderim süresiyle ya da
> `requestAnimationFrame` toplam kare aralığıyla **karşılaştırılmayacak.**
> Üç metrik de raporlanır, ama kapı yalnız bu birine bakar.

| Çizim proxy süresi — `kareSuresi()`, CPU+GPU `gl.finish` vekili, medyan, masaüstü | Karar |
|---|---|
| **≤3,0 ms** | Rahat. 10 dükkân üretimine geçilebilir. |
| **3,0 – 4,0 ms** | Teknik olarak sınırın altında ama **PASS YAZMA.** Güvenlik payını raporla ve **DUR.** |
| **>4,0 ms** | Başarısız. Bina hattını optimize et, testi tekrarla. |

### Neden 3,9 ms rahat değil
4,0 ms bir hedef değil, **tavan.** İstiklal Sokağı henüz şunları almadı:
NPC etkileşimleri (yemci, kedi besleme), harita üstü arayüz katmanı, çok
oyunculu durum senkronu ve uzaktan gelen oyuncuların konum enterpolasyonu,
parçacık efektleri, sesli sohbet göstergeleri. Bunların hepsi aynı kareden
yiyecek. 3,9 ms ile geçen bir sahne, oyun tamamlandığında tavanın üstündedir.

**Ayrıca raporlanacak:** kare süresi bütçesi nerede harcanıyor —
karakterler · çevre · gölge geçişi · arayüz. Yalnız toplam sayı yetmez.

> **Terminoloji uyarısı (S-1'e bağlı):** NPC mantığı, harita üstü arayüz,
> çok oyunculu durum senkronu ve konum enterpolasyonu **aynı karede** yer alır
> ama `kareSuresi()` (CPU+GPU çizim) metriğinin içine tam girmez — çoğu CPU
> tarafındadır. Bu yüzden "İstiklal bunları da alacak" uyarısı doğru olmakla
> birlikte, o maliyet **toplam kare süresi** (`requestAnimationFrame` aralığı)
> metriğinde görünür. Aşama 2'de üç metrik de raporlanacak ve
> **birbirinin yerine kullanılmayacak.**

## S5. TELEFON

Masaüstü 4,0 ms bir **vekil** sınırdır. Gerçek Android cihazda ölçüm
yapılmadan hiçbir mobil performans sonucu yazılmayacak; telefon satırına
`ölçülmedi` yazılacak. Masaüstü ms'inden telefon ms'i türetilmeyecek.

---

### Kayıt — 1B/1C/1D sayıları gerçekte nasıl alındı (16 Eyl, koddan ve oturum kaydından)
S0'ı kuracak kişi için; yukarıdaki kuralları değiştirmez, yalnız başlangıç durumunu belgeler.
- **Derleme modu:** 1B, 1C ve 1D rapor sayılarının hepsi **Vite geliştirme sunucusunda** (`npx vite --port 5173`,
  test kabuğu `.tmp/deneme-test/index.html?otomasyon=1`) alındı — Vercel üretim derlemesinden DEĞİL.
- **`kareSuresi()` kapsamı:** `cizim()` yalnız `render.render` değildir; mixer güncellemesi, kırpma, kuyruk salınımı
  (`sahne.traverse`), kedi ve temas gölgesi güncellemesi de içindedir. Yani ölçüm "CPU sahne güncellemesi + çizim + GPU bekleme"dir.
- **Örneklem:** `kareSuresi(n)` varsayılanı 30 kare, **ısınma yok**, dönen değer **ortalama** (medyan/p95 değil).
  Raporlardaki değerler n = 30–40 ile alındı. S2 hijyeni (120 ısınma, ≥300 kare, medyan + p95) karşılanmıyordu.
- **DPR:** sayfa `setPixelRatio(min(devicePixelRatio, 2))` kullanıyor; eski ölçümlerde 1'e sabitlenmedi.
- **Oturum:** otomasyon sekmesi arka planda Worker zamanlayıcıyla sürüldü; 1C ve 1D **ayrı oturumlarda** ölçüldü.
