# MUAYENE RAPORU — Aşama 1E muayene altyapısı + ilk hata kataloğu (16 Eyl 2026)

Bu paket varlık **düzeltmedi**. Varlıkları gören ve hata aday listesi çıkaran altyapıyı kurdu ve bugünkü 12 varlığı
bir kez muayeneden geçirdi. Bulunanlar aşağıda; düzeltme sonraki paketlere bırakıldı.

## Sonuç

```
Bilinen 7 hatadan MEKANİK TESTLERİN aday olarak yakaladığı : 4 / 7
Bilinen 7 hatadan GÖRSEL MUAYENENİN yakaladığı             : 6 / 7
Toplam benzersiz yakalanan                                  : 6 / 7
```

| Kabul şartı | Eşik | Sonuç |
|---|---|---|
| Toplam benzersiz yakalanan | ≥ 5 / 7 | **6 / 7 — karşılandı** |
| Mekanik testlerin tek başına yakaladığı | ≥ 2 / 7 | **4 / 7 — karşılandı** |

Yakalanamayan tek hata **kapı kolu havada**. Mevcut GLB'de bu hata yeniden üretilemedi: iki yöntem de kolu kapıya bağlı
gösteriyor (ayrıntı "Yakalanamayanlar"). Bilinen 7 hatanın dışında **16 yeni bulgu** çıktı (kataloğun ikinci yarısı).

## Çalıştırma — tek komut

```bash
npm run muayene                               # 12 varlık: testler + 120 görünüm + 12 kontakt sayfası (~20 s)
node bildim/harita/varlik/uret.mjs --muayene  # varlıkları üret, bitince aynı muayeneyi çalıştır (render-ve-bak döngüsü)
npm run muayene -- prop_lamba bina_dukkan     # yalnız seçilenler
node bildim/harita/muayene/testler.mjs prop_bank   # yalnız mekanik testler, konsola
```

Yapı (`bildim/harita/muayene/`):

| Dosya | İş |
|---|---|
| `calistir.mjs` | Tek komut: testler → vite sunucusu → headless Chrome → PNG + kontakt + `ozet.json` |
| `testler.mjs` | Mekanik testler (Node, `three-mesh-bvh`) |
| `glbOku.mjs` | Node'da GLB okuyucu (dış doku başvurularını ayıklar) |
| `muayene.html` · `muayene.js` | Tarayıcı tarafı: GLB'yi oyunun ışığı (B+) ve malzeme kuralıyla çizer; kontakt sayfasını birleştirir |
| `ustveri/<varlik>.json` | Yakın çekim noktaları, kozmetik kaynakları, simetri / izinli örtüşme / havada durabilir beyanları |
| `cikti/<varlik>/kontakt.jpg` | **İnsanın baktığı sayfa** (commit edilir) |
| `cikti/<varlik>/adaylar.json` | Aday + susturulan listesi, ada listesi (commit edilir) |
| `cikti/<varlik>/*.png` | 10 ham görünüm (git dışı, her çalıştırmada yeniden üretilir) |

Headless tarayıcı `playwright-core` (yalnız devDependency) ve makinede kurulu Chrome ile çalışır, tarayıcı indirmez.
WebGL gerçek GPU'da çalıştı (ANGLE, AMD Radeon, D3D11). Konsol hatası 0. Oyunun indirme boyutu değişmedi.

**Depo boyutu kapısı:** commit edilen çıktı **25 dosya · 2,97 MB** (12 kontakt JPEG + 12 `adaylar.json` + `ozet.json`).
25 MB sınırının altında. Git dışı ham görünümler 120 PNG · 18,1 MB.

## Muayene sayfaları

| Varlık | Kontakt sayfası | Üçgen | Aday | Susturulan |
|---|---|---:|---:|---:|
| karakter_insan | `bildim/harita/muayene/cikti/karakter_insan/kontakt.jpg` | 5.888 | 4 | 169 |
| karakter_kaplan | `bildim/harita/muayene/cikti/karakter_kaplan/kontakt.jpg` | 5.112 | 7 | 121 |
| karakter_robot | `bildim/harita/muayene/cikti/karakter_robot/kontakt.jpg` | 6.060 | 41 | 50 |
| bina_dukkan | `bildim/harita/muayene/cikti/bina_dukkan/kontakt.jpg` | 4.804 | 4 | 69 |
| zemin_deneme | `bildim/harita/muayene/cikti/zemin_deneme/kontakt.jpg` | 3.058 | 0 | 0 |
| bordur | `bildim/harita/muayene/cikti/bordur/kontakt.jpg` | 648 | 0 | 0 |
| prop_agac_govde | `bildim/harita/muayene/cikti/prop_agac_govde/kontakt.jpg` | 120 | 1 | 3 |
| prop_agac_tac | `bildim/harita/muayene/cikti/prop_agac_tac/kontakt.jpg` | 470 | 0 | 17 |
| prop_bank | `bildim/harita/muayene/cikti/prop_bank/kontakt.jpg` | 320 | 1 | 0 |
| prop_lamba | `bildim/harita/muayene/cikti/prop_lamba/kontakt.jpg` | 220 | 2 | 1 |
| prop_saksi | `bildim/harita/muayene/cikti/prop_saksi/kontakt.jpg` | 256 | 0 | 7 |
| prop_kedi | `bildim/harita/muayene/cikti/prop_kedi/kontakt.jpg` | 652 | 0 | 17 |

Her sayfada 6 ortografik (ön · arka · sol · sağ · üst · alt), 3 yakın çekim ve 1 beauty shot var. Başlıkta varlık adı,
üçgen, malzeme ve aday sayısı, altta FAIL adayı listesi durur. Hepsinde malzeme sayısı 1.

## Görsel muayene nasıl yapıldı — dürüstlük notu

Görüntüler model tarafından **gerçekten açılıp incelendi** (görüntü okuma aracıyla).

- **12 kontakt sayfasının 12'si** açıldı. Sayfalar 2400 px genişlikte, inceleme ekranında 2000 px'e küçültülmüş göründü.
- **Tam çözünürlükte ayrıca açılan görünümler:** robot sol ortografik, robot kafa yakın, insan kafa yakın, kaplan ön
  ortografik, kaplan beauty, bina ön ortografik, bina kapı yakın (önden ve 3/4 yandan, iki açı).
- Geri kalan 110 ham görünüm **yalnız kontakt sayfası içinde, küçültülmüş** görüldü. Küçük ayrıntılar (1–2 cm'lik
  boşluklar) bu ölçekte kaçabilir. Bu görünümler için "kontrol edildi" değil **"kontakt ölçeğinde görüldü"** denmelidir.
- Robot elinin 2 cm kopukluğu yakın çekimde **seçilmedi** (kamera açısı boşluğu örtüyor). Katalogda bu hata yalnız
  mekanik test ve üretici kodu okunarak doğrulandı diye işaretlendi.

## Bilinen 7 hata — kim yakaladı

| # | Hata | Mekanik test | Görsel muayene | Görüldüğü yer |
|---|---|---|---|---|
| 1 | Kapı kolu havada | **Hayır** — kol kapı kanadına 4 cm gömülü ölçüldü, `havada` adayı yok | **Hayır** — kol 3/4 yandan kapı yüzeyinde | Yeniden üretilemedi (aşağıda) |
| 2 | Kapı üstü kemerli ahşap yalnız sağda | **Evet** — `simetri`: `ahsapAcik [x 0,66 · y 2,68]`, eşleşmeyen köşe %40 | **Evet** | bina · ön ortografik |
| 3 | Ahşap damarı üstte dikey, altta yatay | **Hayır** — doku yönünü ölçen test yok | **Evet** | bina · kapı yakın çekim (iki açı) |
| 4 | Robot gövde parçaları iç içe | **Evet** — `icice`: omuz küresi göğse 11 cm, kalça eklemi kalça bloğuna 10,9 cm, boyun pistonu kafaya 8 cm, bel halkası göğse 5,5 cm | **Evet** | robot · sol ortografik: omuz halkası turuncu yan panelin içinden daire olarak çıkıyor; bel halkası iki blok arasında görünmüyor |
| 5 | Omuz eklemi gövdenin içinde kaybolmuş | **Evet** — `gomulu`: omuz küresi yüzeyinin %80'i başka parçaların içinde, omuz halkası %81 | **Evet** | robot · ön ve sol ortografik: omuz küresinin yalnız dış kenarı görünüyor |
| 6 | Saçta sert dikiş, iki parça üst üste | **Hayır** — saç lobları üstveride tasarım gereği iç içe beyan edildi | **Evet** | insan · kafa yakın: kâkül lobu kabuğun üstünde ayrı blok, şakakta kabuk kenarı sert basamak |
| 7 | Kaplan kulakları şapkadan taşıyor | **Evet** — `kozmetik`: şapka ↔ iki kulak ve iki iç kulak üçgen kesişimi | **Evet** | kaplan · **yalnız beauty shot** |

### Yakalanamayanlar — hangi test yetmedi, neden

- **#1 Kapı kolu (iki yöntem de yakalamadı):** hata mevcut `bina_dukkan.glb`'de yok ya da başka bir şeyi kastediyor.
  Mekanik ölçüm: kol küresi `altin [x 0,35 · y 1,28 · z 4,24]` kapı kanadına (`ahsap`, z 4,12) 4 cm giriyor, yani bağlı.
  Görsel: 3/4 yandan kol kanadın yüzeyinde, altında temas gölgesi var. Yetmeyen bir test yok; iddia bu varlıkta doğrulanamadı.
  Sahibinin gördüğü görüntü (hangi sahne, hangi açı) bilinirse aynı açı üstveriye yakın çekim olarak eklenebilir.
- **#3 Damar yönü (mekanik yakalamadı):** UV yönünü ölçen test yazılmadı. Görsel muayene yakaladı; mekanik kapsam
  genişletilmedi (kural gereği).
- **#6 Saç dikişi (mekanik yakalamadı):** kusur geometrik değil, siluet ve gölgelendirme kusuru. Saç lobları kasıtlı iç içe
  kurulduğu için `izinli_ortusme`'de beyan edildi; aksi halde varyant başına onlarca yanlış alarm üretiyordu. Görsel yakaladı.

### Yalnız beauty shot'ta görülen

**1 hata** (bilinen #7, kaplan kulağı ↔ şapka). Sebep tasarım kararı: ortografik ve yakın görünümler karakteri
**kozmetiksiz** çiziyor (saç dikişini şapka örtmesin diye), kozmetikler yalnız beauty shot'ta takılı. Yani bu sayı beauty
shot'ın estetik değerini değil, **kozmetikli görünümün** değerini kanıtlıyor. Yeni bulguların hiçbiri yalnız beauty'de görülmedi.

## Test başına aday ve yanlış alarm

"Gerçek" = görselde ya da üretici kodunda doğrulandı. "Yanlış" = görselde karşılığı yok ya da stilize tasarımda kabul
edilebilir. "Belirsiz" = bu turda doğrulanamadı. Susturulan = üstveri beyanıyla aday listesine girmeyen.

| Test | Aday | Gerçek | Yanlış | Belirsiz | Susturulan | Benzersiz kusur |
|---|---:|---:|---:|---:|---:|---|
| `havada` | 10 | 10 | 0 | 0 | 0 (+13 eşikle, bkz. not) | 10 |
| `simetri` | 1 | 1 | 0 | 0 | 5 | 1 |
| `icice` | 25 | 25 | 0 | 0 | 342 | **5** (robot: iki omuz, boyun, bel, kalça) — adaylar aynı kusurun tekrarı |
| `gomulu` | 9 | 9 | 0 | 0 | 61 | 5 (aynı bölgeler) |
| `kozmetik` | 15 | 4 | 6 | 5 | 46 | 2 (kaplan kulak ↔ şapka; olası: insan at kuyruğu ↔ atkı) |

Notlar:

- **`havada` eşiği:** zemin varlığında yaya geçidi ve çim yamaları z-kavgası olmasın diye 7–12 mm yukarıda. Varsayılan
  5 mm eşikle 13 aday çıktı; üstveride `temas_esigi_m: 0.02` beyan edilince sıfırlandı. Bu da bir susturmadır.
- **`icice` ve `gomulu` gürültüsü tekrardan geliyor, yanlış alarmdan değil:** 34 aday 5–6 kusur bölgesine düşüyor.
  Aday → bölge gruplaması yapılmadı; sonraki genişletme o olmalı, yeni test değil.
- **`kozmetik` oranı en kötüsü (4 gerçek / 15):** 6 yanlış alarm, gözlük camının göz yamasına (4) ve atkının çeneye (2)
  değmesi. Görselde karşılığı seçilmedi. 5 belirsiz: robotta atkı ucunun havalandırma çizgilerini ve bel halkasını
  kesmesi (4), insanda 3. saç varyantının at kuyruğunun atkıdan geçmesi (1; varyant görselde çizilmediği için doğrulanamadı).
  Kural gereği bu test **genişletilmeyecek**.
- **Üstveri kuralları ada etiketleri görüldükten sonra yazıldı.** Kurallar tasarım niyetinden türetildi (STIL, 1C/1D
  raporları) ve gerekçesi JSON'da yazılı. Ama bilinen hataları görerek yazıldıkları için mekanik skor iyimser olabilir.
  Özellikle robotta "omuz, boyun ve bel görünür olmalı" niyeti 1D §4.2'den alındı ve bu yüzden izin verilmedi.
- **İlk çalıştırmada bulunan test hatası:** `gomulu` yalnız köşelere bakıyordu. Tek bölümlü silindirin köşeleri iki uçta
  olduğundan anten ve kol silindiri "%100 gömülü" çıktı. Örnekleme köşe + üçgen merkezi + kenar ortası yapıldı; üstveri
  yazılmadan önce düzeltildi.

## Hata kataloğu

Ciddiyet: **yüksek** = oyun kamerasında fark edilir siluet/kopukluk · **orta** = yakında ya da belirli açıda görünür ·
**düşük** = görünmez israf ya da çok küçük.

### Bilinen hatalar

| Varlık | Hata | Bulan | Ciddiyet |
|---|---|---|---|
| bina_dukkan | Kapı üstü kemerli ahşap yalnız sağ yarıda | simetri + ön ortografik | orta |
| bina_dukkan | Ahşap damarı: kanatta yatay, üst kemer parçasında dikey | kapı yakın (görsel) | orta |
| karakter_robot | Omuz küresi %80 göğse gömülü; omuz halkası yan panelin içinden çıkıyor | gomulu + icice + sol ortografik | yüksek |
| karakter_robot | Gövde kütleleri iç içe: kalça eklemleri kalça bloğunda, bel halkası blokların arasında, boyun pistonu kafada | icice + gomulu + sol ortografik | orta |
| karakter_insan | Saç: kâkül lobu kabuğun üstünde ayrı blok, şakakta sert basamak | kafa yakın (görsel) | orta |
| karakter_kaplan | Kulaklar şapka kubbesini deliyor | kozmetik + beauty | yüksek |
| bina_dukkan | Kapı kolu havada | — | **doğrulanamadı** (kol bağlı ölçüldü ve görüldü) |

### Yeni bulgular (bilinen 7'nin dışında)

| Varlık | Hata | Bulan | Ciddiyet |
|---|---|---|---|
| prop_bank | Sırtlık plakası ve iki destek oturaktan 7,3 cm kopuk, havada | havada + sol/sağ ortografik | **yüksek** |
| bina_dukkan | İki cephe saksısı kaldırım plakasının dışında, plaka yüksekliğinde (18 cm) havada | havada + üretici kodu (`z = on + 0,9` plaka kenarını aşıyor) | orta |
| karakter_robot | İki el (avuç + 3 parmak) ön koldan 2 cm kopuk | havada + üretici kodu (ön kol `el − 0,02`'de bitiyor, avuç `el`'den başlıyor); yakın çekimde açı nedeniyle seçilmedi | orta |
| karakter_robot | Yüz ekranında gözlerin iki yanında beyaz ok/çizgi izleri (atlas ifade hücresi taşması olası) | kafa yakın (görsel) | orta |
| karakter_robot | Bel halkası %90 gömülü, görünmüyor (1D "ayrık kütleler" niyetine aykırı) | gomulu + sol ortografik | orta |
| karakter_robot | Boyun halkası %100, boyun pistonu %86 gömülü (1D "görünür piston" niyetine aykırı) | gomulu | orta |
| karakter_robot | Kalça eklem küreleri %100 kalça bloğunun içinde (görünmeyen geometri) | gomulu | düşük |
| karakter_robot | En alttaki havalandırma çizgisi gövdeden 8 mm ayrık | havada | düşük |
| bordur | Taş dokusu 80 m boyunca uzamış, bloklar ince çizgiye dönmüş | yakın çekimler (görsel) | orta |
| bina_dukkan | Bayrak eğik direğin ucundan 5,8 cm ayrık | havada | düşük |
| prop_agac_govde | Arka dal gövdeden 5,2 cm kopuk | havada + sol ortografik | düşük (oyunda taç örter) |
| prop_lamba | Fener şapkası ve tepe topu fener küresinden 3,2 cm ayrık | havada | düşük |
| prop_lamba | Kaide bileziği direkten 1 cm ayrık; açık silindir olduğu için içi görünüyor (1D sadeleştirmesinden) | havada + kaide yakın | düşük |
| prop_lamba | Direk açık uçlu; üstten bakınca içi görünüyor (1D sadeleştirmesinden) | üst ortografik | düşük |
| prop_saksi | Bilezikte küçük üçgen doku izleri | bilezik yakın (görsel) | düşük |
| karakter_insan · kaplan | Kalça bloğunun alt yüzü gri, dokusuz | alt ortografik | düşük |

## Altyapının sınırları

- **Muayene görünümü oyunun kopyasıdır.** Malzeme cilası ve varsayılan görünüm `DenemeSayfasi.jsx`'ten kopyalandı.
  Orası değişirse `muayene.js` elle güncellenmeli. Tabela yazısı oyun sayfasında canvas ile çiziliyor; GLB'de yok,
  muayenede görünmez.
- **Görsel muayene yalnız varsayılan görünümü kapsar:** set 1, saç 1, ilk ton. Set 2/3 ve saç 2/3 parçaları çökertilmiş
  çizilir. Mekanik testler ise tüm varyantları kapsar.
- **Karakterler bağlama pozunda (T-poz)** muayene edilir; beauty shot Idle 0,5 s. Animasyon sırasında oluşan iç içe
  geçmeler (dirsek bükülmesi vb.) kapsanmaz.
- **Zemin ve bordürün yan ortografikleri boş** çıkar (yatay, sıfıra yakın kalınlık). Bu varlıklarda asıl bilgi üst görünüm
  ve yakın çekimlerde.
- **Doku yönü, UV uzaması, doku taşması** için mekanik test yok; bunlar yalnız görselle yakalanır.
- **İç içe testi kapalı mesh ister** (ışın paritesi). Açık meshler (yarım küre saç, açık silindir) kap olarak kullanılamaz.

## Değişen dosyalar (bu paket)

- Adım 0: `bildim/harita/olcum/` (ölçüm düzeneği + README) · `DenemeSayfasi.jsx` HUD'u (`CPU … ms · CPU+GPU … ms (saat) · GPU … ms`, "CPU+GPU ölç" düğmesi, `kareOlc()` API'si)
- Adım 1: `muayene.html` · `muayene.js` · `calistir.mjs` · `glbOku.mjs` · `ustveri/*.json` · `package.json` (`playwright-core` devDependency, `npm run muayene`) · `.gitignore` (ham PNG)
- Adım 2: `testler.mjs` · üstveri test beyanları
- Adım 3: kontakt sayfası
- Adım 4: 12 varlığın çıktısı + bu rapor

`uret.mjs`'e yalnız dosya sonuna `--muayene` bayrağı eklendi; geometri koduna ve varlıklara **dokunulmadı**
(GLB'ler yeniden üretilmedi). SQL/migration yok. Aşama 2'ye, karakter işine, hata düzeltmeye başlanmadı.
