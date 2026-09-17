# Aşama 3A-1 — Şehir: Boğaz + İstiklal cepheleri (17 Eyl 2026, Fable 5.1)

| Bölüm | Durum | Commit |
|---|---|---|
| B — Boğaz + köprü | ✅ canlıda | `ff6901f` |
| C — İstiklal cepheleri | ✅ canlıda | `464ca88` |
| D — bütçe | çağrı ✅ · üçgen ✅ · **ms kapısı ❌ (taban da geçmiyordu, §1)** | — |

Dokunulmayan: karakter gövdesi, atlas, kozmetikler, oynanış sistemleri, SQL. Yeni çalışma-anı paketi yok, yeni doku dosyası yok.

---

## 1. Ölçüm (§D.2)

**Düzenek:** `olcum/meydan-test` üretim derlemesi, headless Chrome, tümleşik AMD Radeon (ANGLE D3D11), 1536×791, DPR 1.
En kötü açı (İstiklal ucu), 25 oyuncu + 2 bot + 8 kedi, **sınır 20**, 120 ısınma + 300 örnek.
Üç sürüm **ayrı ayrı derlendi** (`git archive` → `.tmp/olcum`) ve **dönüşümlü** ölçüldü (3 tur). Değerler üç turun aralığıdır.

| Katman | Çağrı | Üçgen | CPU ms (medyan) | CPU+GPU ms (medyan) | CPU+GPU p95 |
|---|---:|---:|---|---|---|
| 2D sonrası (taban, `4a72e8d`) | 129 | 396.622 | 3,6 – 4,8 | **4,1 – 5,5** | 6,0 – 6,3 |
| + Boğaz (B, `ff6901f`) | 129 | 370.352 | 4,8 – 5,1 | 5,4 – 5,7 | 6,3 – 6,4 |
| + İstiklal (C, `464ca88`) | **167** | **385.105** | 3,8 – 5,0 | **4,5 – 5,6** | 6,4 – 6,5 |
| **Kapı** | ≤ 220 ✅ | ≤ 460.000 ✅ | — | ≤ 4,0 ❌ | — |

**LOD katmanı başına (C sürümü, aynı sahne; bütün binalar tek LOD'a zorlanarak):**

| Durum | Bina (yakın/orta/uzak) | Cephe üçgeni | Çağrı | CPU+GPU ms (3 tur) |
|---|---|---:|---:|---|
| Varsayılan (mesafeye göre) | 11 / 9 / 5 | 15.503 + 1.066 + 118 | 167 | 4,5 · 5,6 · 5,3 |
| Hepsi YAKIN (LOD 0) | 25 / 0 / 0 | 35.486 | 167 | 5,1 · 5,9 · 5,5 |
| Hepsi ORTA (LOD 1) | 0 / 25 / 0 | 4.076 | 167 | 3,9 · 5,3 · 4,0 |
| Hepsi UZAK (LOD 2) | 0 / 0 / 25 | 586 | 167 | 4,5 · 4,3 · 4,7 |
| Cepheler gizli | — | 0 | 129 | 4,2 · 4,0 · 4,0 |

### Kapı sonucu — PASS DEĞİL, ve kimin aştığı

- **ms kapısını aşan bölüm bu paket değil, taban.** 2D'de karakter sınırı 8 → 20 yapıldı; aynı düzenekte taban zaten **4,1 – 5,5 ms**. 2B raporunda sınır 8 iken 3,7 – 3,8 ms'ydi.
- **Boğaz:** çağrı eklemedi (mevcut arka plan mesh'ine girdi), üçgeni **düşürdü** (−26 bin: Gezi ağaç kuşağının doğu yarısı vadiye bırakıldı). Tablodaki +0,2…+1,3 ms farkı yükleme saçılmasının içinde; tek çağrılık 2.700 üçgenin bunu açıklaması beklenmez.
- **İstiklal:** +38 çağrı (bina başına 1 + yakındakilerin gölge vekili), +15 bin üçgen. Süre etkisi "cepheler gizli ↔ varsayılan" farkından okunur: **+0,3 … +1,6 ms**, turdan tura değişiyor.
- **LOD sıkılaştırma denendi (§D.3):** yakın/orta eşikleri 38/85 → 28/70 → 22/60 (çalışma anında, aynı sayfa). Ölçülebilir kazanç **çıkmadı**: üç turun ikisinde fark 0,0 – 0,3 ms, biri ısıl sıçramayla bozuldu (10 ms'lik satırlar). Bu makinede yüklemeler arası saçılma (4,3 ↔ 6,0 ms) aranan etkiden büyük. Eşikler 38/85'te bırakıldı; değerler `yerlesim.json › kurallar.cephe_lod`'da, SQL/kod gerekmeden değişir.
- **Sonuç:** masaüstü kapısı **geçilmedi**. Kapıyı geçirecek kaldıraç cephe değil karakter sayısı (sınır 20 kararı telefon ölçümüne dayanıyordu).
- **Telefon notu (§D.4):** aynı sahnenin 2D öncesi hali S24 FE'de 2,20 ms, bu makinede 3,70 ms'ydi. Karar için `?olcum=1` ile İstiklal ucunda telefonda ölçüm gerekiyor; masaüstü sayısı kötümser.

Ham veri: `.tmp/3a/olcum.json` (git dışı). Betik: `olcum/meydan-test/katman2c.js › cepheOlc()`.

---

## 2. B — Boğaz + köprü

**Sorun:** oyun kamerası oyuncuya ~35° yukarıdan bakıyor; ekranın üst kenarı ufkun 11–14° **altında**. Plaza kotunda (y = 0) 150 m ötedeki deniz ve 70 m'lik köprü kulesi hiçbir konumdan kadraja girmiyordu (2A raporu da bunu yazmıştı). "Deniz ufka uzansın" tek başına yetmiyordu.

**Çözüm — vadi:** Taksim gerçekte de Boğaz'dan yüksekte bir tepe. Plazanın kuzeydoğu kenarından itibaren zemin **6 teras** hâlinde alçalıyor (çatı şelalesi; teraslar + karşı kıyıda toplam 98 küçük ev, her biri 16 üçgen), deniz y = −60'ta. Böylece deniz, köprü ve karşı kıyı kameranın gördüğü koninin içine düşüyor:

- plazanın kuzeydoğu yarısından belirgin, plaza merkezinden üst şeritte görünüyor;
- kuş bakışında (zum 3) vadi + köprü birlikte kadrajda.

**Köprü:** stilize asma köprü — tabliye, iki kule (çift ayak + iki kiriş), parabolik ana halat, askılar. Birebir kopya değil; **zorlanmış perspektif** (148 m açıklık, 24 m kule).

**Deniz:** zeminde düzlem (gökyüzü fonu değil), kıyıdan ufka `#4FC3E8 → #9ED9F0` köşe rengi geçişi, `cam` bölgesiyle parlak (güneş parıltısı).

| | Değer | Sınır |
|---|---:|---:|
| Ek çizim çağrısı | **0** (mevcut `CevreArkaplan` birleşik mesh'ine girdi) | ≤ 4 ✅ |
| Üçgen (iki şehir silueti dahil) | **2.700** | ≤ 3.000 ✅ |

Kod: `bogaz.js`. Bütün ölçüler manifestte (`arkaplan`: `vadi` · `karsi_kiyi` · `kopru`).

---

## 3. C — İstiklal cepheleri

### Parça havuzu (`cephe.js`) — 25 varyant, 8 aile

| Parça | Varyantlar |
|---|---|
| Zemin kat vitrini (4) | dükkân (taş subasman + cam) · kafe (ahşap pano + kayıtlı cam) · dar (parmaklıklı küçük pencere) · kapalı (kepenk) |
| Üst kat penceresi (5) | tek · çift · kemerli · kepenkli · giydirme (kamusal cam pano) |
| Balkon (3) | yok · çıkma (cumba) · korkuluklu |
| Silme / korniş (2) | düz · dişli |
| Çatı (3) | kiremit (beşik) · düz (parapet + asansör kulesi / su deposu / klima) · çıkmalı (mansart + çatı penceresi) |
| Tabela çerçevesi (2) | bant (kasa + pano + iki spot) · asma (cepheye dik levha + kapı üstü pano) |
| Tente (3) | düz şeritli · kavisli · yok |
| Kapı (3) | çift kanat ahşap + ışıklık · camlı · kemerli |

- **Kurulan bina: 25** (İstiklal 19 + plaza çevresi 6). 10 ayrı bina modeli yok; bina = parça dizilimi.
- Çeşitlilik kaynağı: parça kombinasyonu + renk (7 sıva tonu, tuğla, taş, 9 mod rengi) + tabela tipi + aks sayısı (genişlikten) + kat sayısı (yükseklikten).
- **Cami ve minare bu pakette değil** — boyalı kütle olarak duruyor.

### Girilebilir ↔ girilemez (§C.2) — kod kuralı

| | Tabela | Aydınlatma | Belirgin kapı | Tente | Zemin kat |
|---|---|---|---|---|---|
| Girilebilir (9 dükkân) | var | var (ışıyan aplik + tabela spotu, `isik` bölgesi → emisyon) | var (eşik + kasa + kanat) | var | vitrin |
| Girilemez (16) | yok | yok | yok | yok | kepenk / parmaklıklı pencere |

Kapı, tabela, tente ve aplik fonksiyonları **yalnız** `p.girilebilir` dalında çağrılıyor; girilemez binada üretilmeleri mümkün değil.
Karşılaştırma görüntüsü: `gorsel/3a1/5-yanyana.jpg`.

### LOD (§C.4)

| Katman | Mesafe (oyuncudan, ayak izi kenarına) | İçerik | 25 bina toplamı |
|---|---|---|---:|
| Yakın (0) | ≤ 38 m | tam parçalar: söve, denizlik, kayıt, korkuluk çubukları, konsol, diş sırası, aplik, karolu tuğla/kiremit | 35.486 üçgen |
| Orta (1) | ≤ 85 m | aynı kompozisyon; pencere = çerçeve dörtgeni + cam dörtgeni, tente tek parça, korkuluk tek levha, diş/aplik yok | 4.076 |
| Uzak (2) | ötesi | yalın kütle (zemin kat + gövde) + çatı silueti | 586 |

- Bina başına **1 çağrı** (aynı anda tek LOD görünür). Yakın/orta geometri ilk gerektiğinde kurulur (açılışta yalnız uzak kütleler).
- **Gölge:** detaylı mesh'ler gölge **atmaz**. Gölgeyi yalnız uzak kütle, yalnız gölge geçişinde ve yalnız oyuncuya 60 m'den yakınken atar → büyük siluet gölgesi var, detay üçgenleri gölge geçişinde ikinci kez çizilmiyor. Balkon/tente kendi gölgesini atmıyor; altlarındaki koyuluk gömülü AO'dan geliyor.
- 3 m tampon (histerezis): sınırda yürürken LOD titremiyor.

### Teknik (§C.3)

- **Tek atlas, tek malzeme, yeni doku yok.** Her yüz mevcut atlas hücresine UV'li; renk köşe rengiyle (ton × AO).
- **Gömülü AO:** mevcut ışın izleme hattı (`varlik/ao.mjs`). Binalar kodla kurulduğu için AO ayrı pişiriliyor: `npm run cephe-ao` → `public/meydan/deneme/cephe_ao.bin` (**118 KB**, köşe başına 1 bayt, yakın + orta LOD). Cam ve ışıyan yüzeyler AO almıyor.
  - ⚠️ Bir parselin ayak izi ya da `cephe` reçetesi değişirse **`npm run cephe-ao` yeniden çalıştırılmalı.** Köşe sayısı tutmayan bina bozulmaz, yalnız AO'suz (düz) kalır.
- **Muayene:** üç örnek bina GLB olarak üretilip `npm run muayene`'den geçirildi (dükkân · apartman · dar/uzun).
  - İlk koşu **27 aday** buldu (hepsi `havada`): duvara değmeyen cam yüzleri, tabela panosu, tabela spot kolu, mahya, baca başlığı, saçak bandı.
  - Hepsi **geometride düzeltildi** (üstveriyle susturulmadı). Son koşu: **0 aday · 0 susturulan**, konsol hatası 0.
  - Kontakt sayfaları: `muayene/cikti/cephe_ornek_*/kontakt.jpg`.

### Ayak izi

Plan ayak izleri (`en × derinlik`) **aşılmadı**; gövde tam olarak parselin üstünde, çarpışma kutuları değişmedi.
Cepheden öne çıkanlar: tente 1,25 m, balkon 0,85 m, cumba 0,75 m, asma tabela 1,2 m, saçak 0,35 m — hepsi **baş üstü kotunda** (≥ 2,4 m), kaldırımın üstünde; yürümeyi etkilemiyor. Zeminde tek çıkıntı kapı eşiği (0,5 m, saksı hattının içinde).

---

## 4. Manifest değişiklikleri (`yerlesim.json`)

| Alan | Değişiklik |
|---|---|
| `parseller[*].cephe` | **25 parselin hepsine** parça reçetesi eklendi (vitrin / pencere / balkon / silme / çatı / tabela / tente / kapı / renk / malzeme). Konum, ayak izi, mod alanları **değişmedi**. |
| `kurallar.cephe_lod` | yeni: `yakin 38 · orta 85 · tampon 3 · golge 60` |
| `arkaplan` | `bogaz` (su) + `karsi_yaka` (tepe) kalktı → `bogaz_vadisi` (vadi) + `karsi_kiyi`; `kopru_15_temmuz` yeniden tanımlandı (deniz kotundan yükseklik, kule konumları) |
| `arkaplan.sehir_kusagi_kuzey` | doğu ucu x = 120 → 0 (vadiyle çakışmasın) |
| `alanlar.agac_kusagi_gezi` | doğu yarısı vadiye bırakıldı (çokgen daraldı; ağaç azaldığı için sahne −26 bin üçgen) |

Yürünebilir sınır, bölgeler, noktalar, tramvay hattı, kedi/bank/lamba alanları **değişmedi**.

---

## 5. Ekran görüntüleri (`gorsel/3a1/`, üretim derlemesi, yerel düzenek)

| Dosya | İçerik |
|---|---|
| `1-bogaz.jpg` | plazanın kuzey kenarından Boğaz + köprü + karşı kıyı (oyun kamerası) |
| `2-istiklal-sokak.jpg` | İstiklal sokak seviyesi (oyun kamerası, zum 1) |
| `3-istiklal-kus.jpg` | İstiklal kuş bakışı (zum 3) — çatı kompozisyonu, LOD geçişi |
| `4-dukkan-yakin.jpg` | girilebilir dükkân cephesi yakın çekim (Turnuva) |
| `5-yanyana.jpg` | girilemez apartman ↔ girilebilir dükkân yan yana |
| `6-plaza.jpg` | plazadan çevre binalar |

---

## 6. Bilinen eksikler / karar bekleyenler

1. **ms kapısı geçilmedi** (§1) — kaynak karakter sınırı 20; telefonda İstiklal ucunda ölçüm gerekiyor.
2. **İstiklal'in en ucunda kamera kapanış binasının içine giriyor.** 2A'dan beri bilinen sorun (`apartman_istiklal_ucu`), bu pakette kameraya dokunulmadı. Karar hâlâ bekliyor: binayı kaldır / geri çek.
3. **Plazanın güneyinde** kamera ile oyuncu arasına giren binaların **arka yüzü** görünüyor (sağır duvar). Önceden de böyleydi; arka cephe detayı bu pakette yok.
4. **Tabela yazısı** hâlâ çatının üstündeki sprite. Cephedeki tabela panosu boş renkli pano; yazıyı panoya taşımak (tek tabela atlası, STIL §2.5) ayrı iş.
5. Girilebilir dükkânların kiremit çatısı **düz renk** (atlasın kiremit hücresi kırmızı; mod rengiyle çarpılınca çamurlaşıyordu). Girilemez binalarda kiremit deseni var.
6. Boğaz, plazanın güneybatı yarısından ve İstiklal'den **görünmüyor** (kamera o yöne bakmıyor).

## DUR

Cami, kedi, tramvay, yemci eklenmedi. Karakter gövdesine dokunulmadı.
