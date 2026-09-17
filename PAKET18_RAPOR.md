# Paket 18 — Lig kapanışı · çizim çağrısı kaldıracı · vitrin tamamlama (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — lig kapanışı (4 düzeltme) | ✅ canlıda · migration 217 uygulandı | `e864956` |
| B — kozmetik çizim çağrısı kaldıracı | ✅ canlıda · 167 → 147 çağrı, piksel farkı 0; ms kapısı geçilmedi | `1ad990c` |
| C — yeni oyuncuya rastgele kozmetik | ✅ canlıda · gerçek oyuncu tohumdan kozmetik almıyor, botlar alıyor | `8efc4d7` |
| D — atkı + kanat satışta | ✅ canlıda · migration 218 uygulandı; süzülme + VFX sınama sayfasında doğrulandı | `78d7507` |
| E — iOS Safari (WebKit) | ❌ kurulamadı — Windows Akıllı Uygulama Denetimi imzasız WebKit DLL'lerini engelliyor (kanıtlı); madde kapatıldı, CLAUDE.md'ye yazıldı | E commit'i |

---

## A — Lig kapanışı

Migration `20260612000217_lig_kapanisi_duzeltme.sql`. Fonksiyonlar canlı tanımlardan üretildi; yalnız ilgili bloklar değişti (`.tmp/p18/uret217.mjs`).

### A.1 Pasif sayacı taşınıyor
`lig_gruplarini_kur` yeni haftanın satırına önceki haftanın `pasif_hafta`'sını yazar. Sayaç kapanışta zaten güncelleniyor: aktif hafta 0, pasif hafta +1. **Ek:** oyuncu pasiflikten düşünce sayacı 0'a iner; pasiflik sürerse her 2 haftada bir düşer, her hafta değil.

### A.2 Aktiflik bütün modları sayıyor
Yeni `lig_aktif_mac_sayisi(oyuncu, hafta)`. Hafta sınırı **TSİ** Pazartesi 00:00 → +7 gün (eskiden UTC gece yarısıydı, 3 saat kayıktı). Sayılanlar, hepsi o aralıkta **biten**:

| Mod | Tablo | Koşul |
|---|---|---|
| Normal Maç | `matches` | `durum='bitti'`, oyuncu1/oyuncu2, `bitis` |
| Düello | `duellolar` | `durum='bitti'`, oyuncu1/oyuncu2, `bitis` |
| Hızlı Mod | `hizli_mod_oturumlar` | `durum='bitti'`, `user_id`, `bitis` |
| Grup Maçı | `group_matches` + `group_match_players` | maç `bitti`, oyuncu `davet_durumu='kabul'`, `bitis` |
| Turnuva | `tournaments` + `tournament_players` | turnuva `bitti`, katılımcı, `bitis` |

İptal / reddedilen / yarım kalan sayılmaz. Dondurulmuş "Hızlı Olan Kazanır" (`hizli_maclar`) sayılmaz.

Bu hafta için eski ↔ yeni sayım:

| Oyuncu | Eski (yalnız matches, UTC) | Yeni |
|---|---:|---:|
| `4c7703b8` (Gümüş) | 0 | 0 |
| `d2fe0212` | 0 | **1** (Düello) |
| `e4f6006f` | 8 | **27** |
| `75efb021` | 14 | **15** |

### A.3 Kapanış ile sıfırlama tek işlemde
**Seçilen yol:** sıfırlama kapanışın içine çekildi. Yeni `haftalik_kapanis()` sırayla:
1. danışma kilidi (aynı anda iki kapanış yok);
2. hafta damgası `oyun_ayarlari.hafta_son_kapanis` (tekrar çalışınca hiçbir şey yapmaz);
3. **`profiles` satırlarını FOR UPDATE ile kilitler**;
4. `lig_haftayi_kapat(hafta)` — sıralama, ödül, yükselme/düşme, yeni gruplar;
5. `haftayi_kapat(hafta)` — şehir/dünya arşivi, rozetler, `puan_hafta = 0`;
6. damgayı yazar.

**Zamanlama:** tek zaman **Pazartesi 00:00 TSİ** (Pazar 21:00 UTC). 20:45'teki `bildim-lig-kapat` işi kaldırıldı. `bildim-hafta-kapat` (Paz 21–23 UTC) ve `bildim-hafta-kapat-pzt` (Pzt 00–03 UTC) artık `haftalik_kapanis()`'ı çağırıyor.

**Neden bu yol:**
- İki işi aynı dakikaya almak sırayı ve kilidi garanti etmezdi.
- Tek işlemde lig sıralaması ve sıfırlama **aynı** `puan_hafta` değerini görür.
- Sınırdaki bir puan ya kilitten önce yazılmıştır (kapanan haftada sayılır, arşive girer) ya da kilidi bekler (kapanış bitince yeni haftaya yazılır). Kaybolan yok.
- **Yan kazanç:** eski `haftayi_kapat` tekrar-güvenliği `lig_arsiv`'de satır olmasına bağlıydı. Arşiv boş kaldığında (13 Eylül'deki gibi) 22:00'de yeniden çalışıp yeni haftanın ilk saatinin puanlarını da sıfırlayabilirdi; tek damga bunu kapatıyor.

### A.4 0 puanla yükselme yok
Yükselme koşulu `sira <= 5` → `sira <= 5 and puan_hafta > 0`. Düşme kuralı değişmedi.

### A.5 Doğrulama (canlı veritabanı, tek işlem, **geri alındı**)

| Bölüm | Senaryo | Önce | Sonra |
|---|---|---|---|
| A.1 | Hareketsiz Gümüş oyuncu, 14 Eyl kapanışı | lig gümüş, pasif 0 | lig gümüş, 14 Eyl satırı pasif **1**, 21 Eyl satırına taşınan **1** |
| A.1 | Aynı oyuncu, 21 Eyl kapanışı (2. pasif hafta) | lig gümüş, pasif 1 | lig **bronz (düştü)**, sayaç 0, 28 Eyl'e taşınan 0 |
| A.2 | Yalnız Düello oynayan, grupta 1. (`puan_hafta` 999 yapıldı) | lig bronz, eski sayım 0 maç | `mac_sayisi` **1**, pasif 0, lig **gümüş (yükseldi)** |
| A.4 | Aktif (27 oyun) ama `puan_hafta` 0, grupta 1. | lig bronz | lig **bronz (yükselmedi)** |
| A.3 | Kapanıştan hemen önce +7 puan | `puan_hafta` 227 + 7 | arşivde **234** (kapanan haftaya sayıldı), yeni hafta 0 |
| A.3 | Kapanış işlemi açıkken başka bağlantı puan yazıyor | — | **kilidi bekledi** (2,5 sn zaman aşımına düştü) → gerçekte kapanış bitince yeni haftaya yazılır |
| A.3 | Aynı hafta ikinci çağrı | — | `zaten_kapandi` |

Test betiği `.tmp/p18/test217.mjs`. Migration kalıcı olarak uygulandı; test işlemleri geri alındı. Canlıda `lig_son_kapanis` ve `hafta_son_kapanis` = 2026-09-07, 21 Eylül grubu yok. İlk gerçek çalışma **20 Eylül Pazar 21:00 UTC** (21 Eylül Pazartesi 00:00 TSİ).


---

## B — Kozmetik çizim çağrısı kaldıracı

### Yapılan (`bildim/harita/karakter/meydanAvatar.js`)
`kozmetik.js` ve `karakter.js` **değişmedi**. Klon mimarisi yerinde kaldı; yalnız çizim yolu değişti:
- `kozmetikTak`'ın karaktere taktığı her klon (`kozmetik_*`, kaplan kuyruğu dahil) **görünmez** yapılır ama yerinde kalır. Böylece yuvaya bağlılık, **tür–kozmetik sözleşmesi** (`bicimlendir` ölçek/öteleme, `it` öteleme — kaplan burnu, robot anteni; `gizle` zaten gövdede çalışıyor), **kanat çırpma** ve **kuyruk sallama** animasyonu (`karakter.js › kare` klonun rotasyon/ölçeğini yazıyor) aynen işler.
- Çizimi **kaynak geometri başına tek paylaşımlı InstancedMesh** yapar. Örnek matrisi = klonun dünya matrisi → yer, açı ve ölçek birebir aynı.
- **Havuz bölmesi = kaynak geometri** (havuz sayısı = sahnede kullanılan farklı kozmetik geometrisi sayısı; bundan az çağrı veren bölme yok):
  - robotun kendi şapka/gözlük varyantı ayrı havuz;
  - varyantı olmayan tür insanınkini paylaşır (aynı havuz);
  - tür başına ayrı bölmek çağrıyı artırırdı.
  - Olası havuzlar: insan sapka · gözlük · gözlükPremium · atkı · kanat, robot sapka · gözlük, kaplan kuyruk = en fazla 8; sahnede kullanılan kadar açılır.
- **Kanat bağı kopmadı:** `kok.userData.kanatMesh` hâlâ klonu gösteriyor. `suzulme` bayrağı, `vfxEsle` (RECETE.kanat) ve çırpma animasyonu klon üzerinden çalışır, instanced çizim matrisi oradan okur. (D'de meydan sınama sayfasında doğrulandı.)
- **Gölge:** değişmedi. Klonlar gölge atmıyordu (`castShadow = false`), havuzlar da atmaz, `receiveShadow` klonlardaki gibi kapalı.
- **Geri dönüş:** `karakterler.kozOrnekleme = false` eski klon yoluna döner (aynı karede karşılaştırma için kullanıldı).

### Sahne kurulumu (önce/sonra aynı)
- **Düzenek:** `olcum/meydan-test` üretim derlemesi, headless Chrome (ANGLE D3D11, tümleşik GPU), 1536×791, DPR 1, `katmanKur()` en kötü açı (İstiklal ucu).
- **Oyuncular:** `window.oyuncular()` → 24 oyuncu, görünüm kaydı yok, **tohumdan** görünüm (rastgele şapka/atkı/gözlük), tür insan/kaplan/robot sırayla + kendi oyuncun + 2 bot. Kalabalık sınırı 20, katman 5, 8 kedi.
- **Ölçüm:** 120 ısınma + 300 örnek.
- **Karşılaştırma:** önce = `e864956` (A commit'i), sonra = aynı commit + bu değişiklik; ikisi ayrı derleme, ayrı port.
- **Turlar:** 3 tur, sıra dönüşümlü (önce→sonra, sonra→önce, önce→sonra).

### Ölçüm

| Ölçüm | Önce | Sonra |
|---|---:|---:|
| Toplam çizim çağrısı | **167** | **147** (−20) |
| Kozmetik klonu (görünür, çizilen) / örnek | 27 klon (25'i kadrajda, 2'si görüş dışında elenmiş) | 0 klon · **5 havuz, 27 örnek** |
| Üçgen | 439.795 | 440.909 (+1.114: havuzlar görüş dışı elemesi yapmıyor, eskiden elenen 2 klon çiziliyor) |
| CPU+GPU medyan (tur 1 · 2 · 3) | 7,2 · 7,1 · 6,2 | 6,6 · 6,0 · 6,8 |
| CPU+GPU p95 (tur 1 · 2 · 3) | 8,3 · 10,9 · 7,6 | 7,7 · 7,2 · 8,3 |
| CPU (gönderim) medyan | 6,4 · 6,3 · 5,6 | 5,8 · 5,1 · 5,9 |

**ms kapısı: PASS DEĞİL.** Kapı 4,0 ms, iki sürüm de 6–7 ms. Tur tur fark **−0,6 / −1,1 / +0,6 ms**: yön tutarlı değil, makinenin tur içi saçılması (±1 ms) farktan büyük. Bu ölçümden bir süre kazancı çıkarmıyorum. (Bu oturumda makine 3A-2'dekinden ~1 ms yavaş ölçüyor; taban da 7,1–7,2'ye çıktı.)

**Kazanç çağrı bütçesinde:** 20 çağrı (bütçe 220 → pay 53'ten 73'e). Kozmetik maliyeti artık oyuncu sayısıyla değil kozmetik çeşidiyle büyüyor. D'deki atkı ve kanat bu yüzden en fazla +1'er çağrı getirir (karakter başına değil). Değişiklik tutuldu.

### Görsel eşitlik kanıtı
- **Yöntem:** aynı sayfada, döngü durdurulup animasyon ilerletilmeden **aynı kare** iki yolla çizildi: `kozOrnekleme=false` (klon) → `true` (örnek) → `false` (klon tekrar). Kamera kozmetikli oyuncuların arasında, yakın. Sonra piksel karşılaştırması yapıldı (kanal farkı > 2 = farklı).
- **Kadraj:** yakın kadrajda 24 klon görünüyordu; çağrı 150 → 131.
- **Sonuç:**

| Karşılaştırma | Farklı piksel | Oran | En büyük kanal farkı |
|---|---:|---:|---:|
| klon ↔ örnek | **0** | 0 % | 1/255 |
| klon ↔ klon (gürültü tabanı) | 0 | 0 % | 0 |

Görseller: `gorsel/paket18/b-1-klon-yolu.jpg` ↔ `b-2-ornek-yolu.jpg`. Betikler `.tmp/p18/esitlik.mjs`, `.tmp/p18/olcB.mjs`, ham veri `.tmp/p18/olcumB.json`.


---

## C — Yeni oyuncu sahip olmadığı kozmetiği göstermiyor

### Yapılan (`meydanAvatar.js`)
`tohumdanGorunum(tohum, { tur, kozmetik })` — `kozmetik: false` rastgele kozmetik vermez, yalnız gövde, ten, saç ve kıyafet tonu verir.
- **Gerçek oyuncu yolu** (`profildenGorunum`, kaydı yok): `kozmetik: false`.
- **Bot yolu** (`"bot|" + tohum`): değişmedi, rastgele kozmetik kalır.
- **Vitrin:** aynı `profildenGorunum`'u kullandığı için kaydı olmayan oyuncuda başlangıçta hiçbir kozmetik takılı gelmiyor; vitrin ve meydan ilk anda da aynı.

### Doğrulama (meydan sınama sayfası, gerçek harita kodu)

| Durum | Sonuç |
|---|---|
| Aynı tohum ("Yeni Oyuncu 7"), eski `tohumdanGorunum` | **atkı** takardı |
| Aynı tohum, gerçek oyuncu yolu (yeni) | **kozmetik yok** |
| Kaydı olmayan oyuncu meydanda (başka oyuncunun gözünden) | tür insan, **kozmetik: yok** |
| Aynı oyuncu vitrinde kaydetti (`gorunum.harita` → şapka + güneş gözlüğü), görünüm meydana yayınlandı | kozmetik: **şapka, güneş gözlüğü** |
| Botlar | 2 bot, rastgele kozmetik 2 (korundu) |
| Kaydı olmayan hesabın kendisi meydana girmeye çalışıyor | "Önce karakterini oluştur" + "Karakterimi seç" kapısı (Paket 17 D) |

**Not:** kaydı olmayan gerçek oyuncunun kendisi meydana zaten giremiyor (kapı). Tohum yolu pratikte meydandaki başka oyuncunun görünümü (presence'ta kaydı boş gelen) ve ölçüm düzeneği için geçerli.

**Ölçüm düzeneğine etkisi:** `window.oyuncular()`'ın 24 oyuncusu artık kozmetiksiz. B'deki "önce/sonra" kurulumu bu değişiklikten önce ölçüldü. Bundan sonraki ölçümlerde bu sahnenin tabanı **142 + taç/pelerin/kuyruk havuzları** olur, 167/147 ile doğrudan karşılaştırılamaz.

Görseller: `gorsel/paket18/c-0-kapi.jpg` (kaydı yok, kapı) · `c-1-kayitsiz-kozmetiksiz.jpg` · `c-2-vitrinde-kaydetti.jpg`.


---

## D — Atkı ve kanat satışta

B'nin ölçümü (147 çağrı, kozmetik türü başına 1 havuz) alındıktan sonra yapıldı. Atkı ve kanat en fazla **+1'er çağrı** getirir, oyuncu sayısından bağımsız: bu sahnede `MeydanKozmetik_atki` ve `MeydanKozmetik_kanat` havuzları.

### Yapılan — migration `20260612000218_atki_kanat_satista.sql` (uygulandı)
- `avatar3d_parcalar`'a iki parça, fiyatlar katalogda (SQL ile değişir):

| Parça | Yuva | Fiyat | Nadirlik |
|---|---|---:|---|
| `boyun_atki` Atkı | atki | **400** | sıradan |
| `sirt_kanat` Kanat | kanat | **2.000** | özel |

- `avatar3d_parcalar.yuva` kısıtı iki yuvayı tanımıyordu; listeye `atki` ve `kanat` eklendi, mevcut değer silinmedi.
- `vitrin_kozmetikleri`: atkı ve kanat `yakinda` → `aktif`, sahiplik/satış parçası bağlandı. Kanadın açıklaması "Süzülme + parıltı".
- **Kanat + pelerin birlikte takılabilir.** Çakışma kuralı eklenmedi: sırtta kanatlar pelerinin iki yanından çıkıyor ve okunuyor (görüntüde kaplan). Birbirini dışlamaları istenirse iki satırın `cakisir`'ına yazılır.
- Vitrinde fiyat artık binlik ayraçla ("2.000 coin").

### Sunucu doğrulaması (canlı DB, işlem içinde, geri alındı)

| Deneme | Sonuç |
|---|---|
| Katalog | atkı `aktif` 400 · kanat `aktif` 2.000 |
| Sahip olmadan kanat takmak | **RED** "Bu kozmetik sende yok" |
| Atkı + pelerin kaydet | OK |
| Kanat + pelerin + atkı kaydet (kaplan) | OK |
| **Fiyat yolu** (işlem içinde `kozmetik_bedava_test` kapatılarak): atkı satın al | bakiye **644 → 244** |
| Fiyat yolu: kanat satın al (244 < 2.000) | **RED** "Yetersiz coin" |

> ⚠️ **Canlıda `oyun_ayarlari.kozmetik_bedava_test = true`.** Bu açıkken bütün kozmetik satın almaları (atkı ve kanat dahil) **coin düşmeden** veriliyor; ödül eşyaları hariç. Bu senin ayarın, değiştirmedim. Gerçek ekonomi için `false` yapılmalı.

### Kanat: süzülme + VFX (meydan sınama sayfası, gerçek harita kodu)

| Oyuncu | avatar `y` (oynanış) | çizilen gövde yüksekliği | `suzulme` | `kanatMesh` bağı | VFX reçetesi |
|---|---:|---:|---|---|---|
| Kendi oyuncun (kanat + atkı) | **0** | **+0,10 m** | ✓ | ✓ (klon görünmez, çizim havuzda) | `kanat` |
| Kaplan (kanat + pelerin) | **0** | **+0,14 m** (süzülme dalgası) | ✓ | ✓ | `kanat` |
| Kanatsız oyuncu | 0 | 0 | — | — | — |

- **Oynanış aynı:** avatarın koordinatı (`av.position.y`) 0 kalıyor, yalnız çizilen gövde ötelenir (`karakter.js › kare`). Çarpışma ve hız avatar koordinatını kullandığı için değişmez. Temas gölgesi avatar konumunda, zeminde.
- **VFX:** `vfxAdlar = "kanat"`. Sahnedeki VFX yayıcı havuzunda parçacık örnekleri var (`VFX:10`).
- **B ile bağ:** kanat klonu görünmez ve çizimi `MeydanKozmetik_kanat` havuzu yapıyor. Süzülme, çırpma animasyonu ve parıltı klon üzerinden çalışmaya devam ediyor.

**"Canlıda doğrulama" hakkında dürüst not:** canlı siteye şifreyle giriş yapamadığım için süzülmeyi canlı meydanda gözle görmedim. Doğrulama aynı kodun meydan sınama sayfasında (gerçek `dunya.js` + karakter sistemi, sahte oturum) yapıldı. Fiyat ve sahiplik canlı veritabanında sınandı. Kod `main`'e push edildi.

Görseller:
- `gorsel/paket18/d-1-kanat-atki-onden.jpg` — kanat + atkı, önden
- `d-2-kanat-pelerin-arkadan.jpg` — sırtta kanat + pelerin birlikte
- `d-3-suzulme-ayak-hizasi.jpg` — ayak hizası: kanatlı oyuncu zeminden yukarıda, parıltı altında; kanatsız yerde
- `d-4-vitrin-atki-kanat.jpg` — vitrin: atkı takılı, kanat 2.000 coin, Saç/Elbise/Alt hâlâ Yakında


---

## E — iOS Safari (WebKit): kurulamadı, madde kapatıldı

### Ne denendi
1. `npx playwright-core install webkit` → WebKit 2359 indi (171 MB, 47 DLL). Bu makinede `/opt/pw-browsers` yok; tarayıcılar `%LOCALAPPDATA%\ms-playwright` altında. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` tanımlı değil, indirmeyi engellemedi.
2. Açılış → "Host system is missing dependencies" (brotlienc, crypto-57, jpeg62, psl-5). DLL'lerin **dördü de klasörde**. Playwright'ın `PrintDeps` aracıyla her DLL'in bağımlılıkları tarandı, klasör dışında eksik yok. Uyarı yanıltıcı.
3. Doğrulama atlanarak (`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`) başsız ve görünür modda açıldı → süreç hemen ölüyor, çıkış kodu **`3236495362` = `0xC0E90002`**.

### Kök sebep (kanıtlı)
- **Windows 11 Akıllı Uygulama Denetimi açık:** `HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy › VerifiedAndReputablePolicyState = 1`.
- **Kod Bütünlüğü günlüğü** (`Microsoft-Windows-CodeIntegrity/Operational`), açılış anında (15:06:51): olay **3077** ve **3033** — *"Code Integrity determined that a process (…\webkit-2359\Playwright.exe) attempted to load …\webkit-2359\…"*. İmzasız WebKit DLL'leri engelleniyor.
- Chrome çalışıyor çünkü imzalı.
- **Çözüm yolları kapalı:**
  - Denetimi kapatmak bir **güvenlik ayarı değişikliği**; Windows'ta sonradan geri açılamıyor (sıfırlama ister). Yapılmadı, yapılmamalı.
  - WSL kurulu değil.

### Kapatma
- `package.json`'a `npm run test:ios:kur` (= `playwright-core install webkit`) eklendi. Başka makinede (macOS, Linux, denetimi kapalı Windows) doğrudan çalışır.
- **`CLAUDE.md` + `AGENTS.md` › iOS Safari kontrolü:** bu makinede WebKit'in neden çalışmadığı, kanıtı ve yerine ne yapılacağı yazıldı. Raporlarda "WebKit kurulu değil" cümlesi bir daha tekrarlanmayacak.
- **Yerine yapılan denetim:** kontrol listesi motordan bağımsız CSS kuralları. Chromium'da iPhone görünümünde (390×844, dokunmatik, DPR 3) hesaplanmış stillerle denetlendi. Her ekranda sabit/yapışkan her öğe için:
  - aynı öğede `transform` var mı;
  - atalarda `transform`/`filter`/`perspective` var mı;
  - 900 px kaydırınca yeri değişiyor mu;
  - sayfada yatay taşma var mı.

| Ekran | Sabit+transform / dönüşümlü ata | Kaydırınca kayan sabit | Yatay taşma |
|---|---|---|---|
| Vitrin `/gorunum` | yok | yok | yok |
| Arkadaşlar (lig çerçeveli) | yok | yok | yok |
| Meydan Okuma (lig çerçeveli) | yok | yok | yok |
| Grup Maçı sonucu (lig çerçeveli) | yok | yok | yok |
| Hızlı Maç sonucu (lig çerçeveli) | yok | yok | yok |

- **Kaynak taraması:** Paket 16–18'de eklenen CSS'te (`vitrin.css`, `tema.css` ekleri, `BildirimIzniSor`, `AvatarCerceve`) `100vh` ve `position: fixed` **yok**.
- **Sınır:**
  - Sınama düzeneğinde uygulama kabuğu (üst çubuk, alt menü) yok. Paket 17'de kabukta değişen tek şey tişört kısayolunun `<a>` yerine `<Link>` olması; sınıf ve konum aynı.
  - `BildirimIzniSor` kartı Paket 17'de bu denetimden geçti (kart sayfa akışında, sabit değil).
  - **Gerçek iOS Safari kontrolü** yalnız gerçek cihazda yapılabilir.
