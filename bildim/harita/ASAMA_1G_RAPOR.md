# AŞAMA 1G — PREMİUM AVATAR + KOZMETİK DİKEY DİLİMİ (16 Eyl 2026)

Tek dikey dilim: 1 insan + 1 kaplan + 1 robot, 4 hero kozmetik (alevli gömlek · kanat · premium gözlük · pet ×3) ve mağaza
vitrini. 25 karaktere ve kataloğa **yayılmadı**; 25 örnek yalnız stres testinde kullanıldı. Çevreye dokunulmadı
(bina/bank/saksı/lamba/bordür/ağaç hataları 1F'de).

Görseller: `bildim/harita/gorsel/1g/` (20 dosya, 3,4 MB). Kontakt sayfaları: `bildim/harita/muayene/cikti/karakter_*/kontakt.jpg`.

## 0. Sonuç tablosu

| Kapı | Hedef | Ölçüm | Durum |
|---|---|---|---|
| Kare süresi, 25 karakter, Geniş, CPU+GPU medyan | ≤ 4,0 ms | 1D-eşdeğer **3,4 ms** → 1G tam (6 alevli + 3 kanat + 25 pet) **3,6 ms** (+%6) | PASS |
| Kare süresi, 25 alevli karakter, Oyun kamerası | ≤ 4,0 ms | **3,1 ms** (731 parçacık, 66 tam + 221 orta yayıcı) | PASS |
| Çizim çağrısı, 25 karakter + 25 pet + VFX (Geniş) | ≤ 220 | **113** (1D-eşdeğer 106; pet +3, VFX +1, kanat +3) | PASS |
| Toplam üçgen (HUD, gölge geçişi dahil), Geniş | ≤ 460.000 | **401.384** (1D-eşdeğer 386.894) | PASS |
| Pet (25) | ≤ 25.000 üçgen · ≤ 3 çağrı | **13.262** üçgen · **3** çağrı (kedi/köpek/kuş InstancedMesh) | PASS |
| VFX (25 alevli) | ≤ 25.000 üçgen | **1.462** üçgen (731 quad) · **1** çağrı (ölçüldü, garanti yazılmadı) | PASS |
| Vitrin: karakter ekran yüksekliği | ≈ %50 | 7,4 m'de %46,5 ölçüldü → mesafe 6,5 m (~%53) | PASS |
| Muayene: çözülmemiş aday (insan/kaplan/robot) | azalacak | **4/7/41 → 0/0/0** | PASS |
| Kozmetik videosu tek başına edinme isteği | öznel | görsel 01–03, 06–08, 19–20 — sahibi karar verir | — |

Ölçüm düzeneği: `bildim/harita/olcum/index.html` (auth'suz deneme sayfası), `?otomasyon` Worker zamanlayıcı, DPR 1, canvas 1536×791,
`kareOlc({isinma:60, ornek:200})` = `cizim()+gl.finish()` medyan. Tarayıcı otomasyon sekmesi olduğu için mutlak değerler
S0 raporundaki (1D 3,0 ms) düzenekle **aynı değil**; karşılaştırma bu oturum içinde yapıldı. GPU zamanlayıcı 1,73–1,86 ms tüm
konfigürasyonlarda — VFX/pet GPU'ya değil CPU gönderimine yük bindiriyor.

## 1. Ne yapıldı (F sırası)

| # | Adım | Commit | Durum |
|---|---|---|---|
| 1 | Robot eklemleri (A.1) | `52ebbd2` | ✓ mekanik + görsel kapı |
| 2–5 | El prototipi, gözlük/saç/geçişler, ifade+kaş, kaplan (A.2/A.3) | `cb7dae9` | ✓ |
| 6 | Tür–kozmetik sözleşmesi (A.4) + muayene | `83efd3c` | ✓ kaplan↔şapka `gecir` olarak sustu |
| 7 | VFX kiti (K1/K3) `deneme/vfx.js` | bu paket | ✓ tek InstancedMesh + tek ShaderMaterial |
| 8 | Alevli gömlek (B.1) — set 4 + `alevKumas` hücresi + reçete | bu paket | ✓ |
| 9 | Kanat + süzülme (B.2) | bu paket | ✓ |
| 10 | Premium gözlük (B.3) | bu paket | ✓ |
| 11 | Pet ×3 (B.4) `deneme/pet.js` | bu paket | ✓ kedi + köpek zorunlu, **kuş da yapıldı** (kesilmedi) |
| 12 | Vitrin (C) + muayene + ölçüm | bu paket | ✓ |

Adım 7–10 aynı üç dosyayı (`uret.mjs`, `atlas.mjs`, `DenemeSayfasi.jsx`) değiştirdiği için tek commit'te; pet ve vitrin ayrı.

## 2. A — Karakter kalitesi (1G-1..6 özeti, görseller kontakt sayfalarında)

**Robot omuz gömülülüğü (muayene `gomulu` oranı, yüzey örneği):**

| Eklem | Önce (1E, `887a973`) | Sonra (1G-1) |
|---|---|---|
| omuz kürsesi ↔ gövde | 0,72–0,80 (panel) · 0,76–1,0 (metal) | **0,34** |
| dirsek | — (küre gövde silindirinde) | **0,36** |
| diz | — | **0,35** |
| kalça | — | **0,36–0,38** |
| bel halkası | 1,0 (tamamen gömülü) | **~0,01** (açıkta, iç milli) |
| boyun pistonu | 1,0 | **0,16** (açık uçlu silindir) |

Hepsi <%40. Eller ön kola bağlı (`havada` adayı 0), havalandırma çizgisi bağlı, yüz ekranı yanındaki beyaz izler
(ifade hücre payı 3→6 px + göz yaması 3→2 mm) gitti. Siyah silüet üç türde ayrışıyor (`12_siluet_siyah_uc_tur_kanatli.jpg`).

**İnsan:** el prototipi (yassı avuç + 3 parmak + başparmak, ~290 üçgen/çift — ölçüm, taahhüt değil), gözlük camı kaldırıldı
(göz bebekleri görünür), kâkül lobu, dirsek/diz/bilek küreleri, kalça alt yüzü AO. **İfade:** kaş göz karesinde; gülümseme =
kaş yukarı + göz kavisi + 8° baş eğimi; şaşkınlık = kaş yukarı + göz büyür + ağız açılır; kırpma sürüyor.
**Kaplan:** pati eller (taban yastıklı), geniş göğüs, büyük kafa, kuyruk; şapka kulakların içinden `gecir` sözleşmesiyle geçer.

## 3. K1/K3 — VFX kiti değerlendirmesi

**Mimari (`deneme/vfx.js`):** tek `InstancedMesh` (kapasite 1500 quad) + tek `ShaderMaterial` (premultiplied "over" karışımı:
alev/duman fonu örter, parıltı/iz/parlama toplamsal). Oyuncuya özel veri **örnek özniteliği**: `aVeri(faz, tip, boyut, ömür)`,
`aRenk`, `aHiz`, `aYogun`. Konum çapa kemiğinden + karakter uzayında ofset (kemik eksenleri Mixamo'da kemik boyunca — ilk
denemede ofsetler kemik uzayında döndürüldü, parıltılar kapının önüne düştü; düzeltildi).

**Modüller (5, parametrik):** `alev` (yükselir, hıza göre yatar, sönerken küçülür) · `parilti` (nabız) · `iz` (arkada kalır) ·
`parlama` (yumuşak disk) · `duman` (yavaş, büyür). Modül = shader'da `tip` dalı; yeni modül gerekmiyor.

**Reçete = kozmetik (`RECETE`):** `alevliGomlek` 11 yayıcı (2 omuz + göğüs + sırt + 2 ön kol alev, 2 el `iz`, 1 `parlama`,
1 `parilti`, 1 `duman`); `kanat` 3 yayıcı. Yeni kozmetik = bir reçete satırı + atlas hücresi/renk.

**Hareket:** sanal hız klipten (`Idle 0 · Walk 1,4 · Run 4 m/s`, kök +Z öne) → alev geriye yatar, el izleri arkada kalır
(`03_insan_alev_kos.jpg`); dururken yükselir (`01`); `zipla()` → 0,6 s parabol + yoğunluk ×1,9 + dikey hız (`13_zipla_alev_dagilir.jpg`).

**LOD + sınır:** kameraya en yakın `tamSayi` (6) yayıcı **grubu** tam; `ortaMesafe` (14 m) içinde kalanlar orta (yalnız
`parlama` + %30 parçacık); `uzakMesafe` (28 m) ötesi hiç. Değerler `VFX_AYAR` sabitinde, `oyun_ayarlari`'na taşınabilir.

**Stres (25 karakter, Oyun kamerası, CPU+GPU medyan / p95):**

| Alevli karakter | Parçacık | Yayıcı tam / orta / uzak | Kare süresi | Çağrı |
|---|---|---|---|---|
| 0 | 0 | 0 / 0 / 0 | **3,1 ms** / 5,4 | 73 |
| 1 | 52 | 11 / 0 / 0 | 3,1 / 5,5 | 74 |
| 6 | 312 | 66 / 0 / 0 | 2,9 / 5,4 | 74 |
| 12 | 438 | 66 / 66 / 0 | 3,0 / 5,3 | 74 |
| 25 | 711 | 66 / 209 / 0 | **3,1 ms** / 3,7 | 74 |
| 25 (Geniş, 30 m) | 441 | 0 / 231 / 44 | 3,4 / 4,9 | 107 |

VFX maliyeti ölçüm gürültüsü içinde (±0,2 ms). `tamSayi = 6` bu veriyle **yeterli**; 12 de sığardı, ama görsel yoğunluk için 6
bırakıldı — sahibi 25 alevli görseline bakıp değiştirebilir (`19_kalabalik_oyun_alev25_pet25.jpg`, `20_…yakin…jpg`).

**K3 sınavı — "buzlu kanat" ve "elektrikli ceket" kaça çıkar?**
- *Buzlu kanat* (`RECETE.buzluKanat` **yazıldı**, örnek olarak): `parilti` ×2 (buz mavisi, 8'er) + `duman` (soğuk sis) + `parlama`.
  Yeni modül **0**, yeni shader **0**, yeni doku **0**; geometri = mevcut kanat + `kanatKoyu` yerine mavi ton. ≈ 15 satır.
- *Elektrikli ceket*: `iz` (kısa ömür 0,25 s, açık siyan, omuz→el arası çapalar) + `parilti` (yüksek frekans) + `parlama`
  (siyan, düşük yoğunluk). Kıvılcım "zikzak" çizgisi istenirse `iz` modülüne titreşim parametresi (1 satır vertex) gerekir —
  yine yeni shader değil, mevcut modüle parametre. Kumaş = atlas'ta boş kalan 1 hücreye (`yanak`/`pantolon` slotu) yeni desen.
- **Kit kuruldu**; kozmetik #30 için beklenen maliyet: reçete (10–15 satır) + 0–1 atlas hücresi + isteğe bağlı küçük geometri.

## 4. B — Hero kozmetikler

**B.1 Alevli gömlek:** kumaş = eski `gozBeyaz` hücresi yeniden amaçlandı → `alevKumas` (kömür dokuma + kor çatlakları,
yeni doku dosyası yok). Set 4 "Alev" (`SETLER[4].vfx = "alevliGomlek"`); kumaş tonsuz (kor rengi hücreden).
Görsel: `01` (dur) · `03` (koş) · `13` (zıpla). Yürüme ara durumu koş ile aynı mekanik, 1,4 m/s.

**B.2 Kanat (`kozmetik_kanat`, 364 üçgen, `sirtYuva`):** deri koşum + 2 omuz kayışı + 2 kol + 7'şer tüy levhası
(açık/koyu tüy hücresi dönüşümlü; eski `agiz`/`yanak` hücreleri → `kanat`/`kanatKoyu`). İlk deneme "yelpaze/süpürge"
okundu (`00_ilk_deneme_kanat_yelpaze_hatasi.jpg`): levhalar ileri-geri genişti ve tek pivottan açılıyordu → levhalar kanat
düzleminde geniş, kolun altından sarkıyor, gövdeye yakın olanlar aşağı, uçtakiler dışa (`02_insan_kanat_arka.jpg`).
Süzülme **%100 kozmetik**: kök (oyunculuk koordinatı) sabit, kökün çocukları +12 cm ± 3 cm nefes; kanat pitch ±0,1 rad çırpma;
üst bacak kemiklerine 0,16 rad sarkma; temas gölgesi kökten okunur → zeminde; kamera hedefi kök → değişmez. Sunucuya yeni
durum yok (K2). Kanat parıltı reçetesi 3 yayıcı. Sırt bağlantısı yakın çekimi: `14_muayene_kanat_sirt_baglantisi.png`.
Muayene: kanat ↔ gövde/kıyafet (y 0,9–1,5) `kozmetik_izinli` (koşum sarılır); ilk yerleşimde kanat kökü kafa küresine
giriyordu (aday), 7 cm aşağı alındı → 0 aday.

**B.3 Premium gözlük (`kozmetik_gozlukPremium`, 516 üçgen, `gozlukYuva`):** aviator — altın çerçeve (**yeni bölge 24
`premiumMetal`**, metalness 0,9 / pürüz 0,22), koyu plastik saplar + burun yastıkları (bölge `plastik`), aynalı cam (bölge `cam`,
metalness 0,45; eski `pantolon` hücresi → `premiumCam`: gökyüzü gradyanı + çapraz yansıma bandı). Shader'a **bölge → metalness**
tablosu eklendi (`METAL_TABLO`, `atlas-bolge-v4`); robot `metal` bölgesi 0 kaldı, 1D görünümü değişmedi. Temel gözlükle aynı
yuva → karşılıklı dışlayıcı (HUD ve API). Kaplanda `it` sözleşmesi çalıştı: `uygulanan: {muzzle: "it"}`, +4 cm
(`07_kaplan_kanat_premium_sapka.jpg`). Görsel: `01`, `15_muayene_premium_gozluk.png`.

**B.4 Pet ×3 (`deneme/pet.js`):** kedi (`prop_kedi.glb` geometrisi, tekir), köpek (aynı geometri, kahverengi, ölçek
1,25/1,3/1,3 — "yeniden deri"), kuş (kod geometrisi: gövde + kafa + gaga + 2 kanat levhası + kuyruk, iskeletsiz, uçar).
Tür başına 1 `InstancedMesh` → **3 çağrı**, 25 pette 13.262 üçgen. Aynı atlas malzemesi. Ağ: **yeni durum yok** — pet
konumu sahibin konumundan istemcide türetilir. Takip: sahibin arkasında yaylı gecikme (hız hedefe göre 0–4,2 m/s: >3 m koşar),
sahibi durunca 1,2 s sonra boşta (kedi oturur/eğilir, köpek yalpalayarak kuyruk sallar, kuş 0,5 m daire çizer), sahibinin
0,6 m içine girmez, dükkân kutusuna (|x|<5,8 · z<0,6) girmez. Görsel: `04` (boşta), `05` (yürüyen sahibi takip), `06` (kuş),
`11`/`19` (25 pet). Kontakt/yakın çekim pet için üstveri yazılmadı (pet GLB değil, çalışma anı örneği) — muayene kapsamı dışı,
görsel doğrulama ekran görüntüsüyle.

**AÇIK SORU (uygulamadan önce soruyorum):** sahibi kanatla havalanınca pet ne yapar? Şu an **varsayılan**: kedi/köpek yerde
takip eder (özel bir şey yapılmadı), kuş sahibin yüksekliğine +30 cm çıkar. Öneri: bu kalsın; çünkü süzülme yalnız 12 cm
görsel öteleme (uçuş değil) ve pet her zaman zeminde okunur. Alternatif (istenirse): kedi/köpek sahibinin altında oturup
yukarı bakar (`otur` hali + baş eğimi yok, 1 satır). Karar sahibinin.

## 5. C — Mağaza vitrini

`vitrin(true)`: çevre/bina/kediler/zemin/tabela gizli, koyu stüdyo fonu (#1b2233), metal kaide (atlas malzemesi, bölge 24 —
yeni malzeme yok), arka ışık (buz mavisi DirectionalLight), Vitrin kamerası (fov 30, 6,5 m, hedef 1,05 m), OrbitControls
otomatik döner + sürüklenebilir, kozmetikler/kıyafet/pet HUD'dan değiştirilebilir, VFX tam, pet kaidenin yanında.
Fotoğraf stüdyosuyla aynı sahne/malzeme/ışık altyapısı. Gizli nesnelerin temas gölgeleri de gizlendi (ilk denemede ağaç
gölgeleri boş fonda görünüyordu). Görsel: `09_vitrin_a.jpg`, `10_vitrin_b_donmus.jpg` (7,4 m, %46,5; commit'te 6,5 m).

## 6. D — Bütçe tablosu (HUD `renderer.info`, gölge geçişi dahil, Geniş kamera, 25 karakter)

| Satır | 1D-eşdeğer (bu oturum) | 1G tam | Sınır |
|---|---|---|---|
| Karakterler (25) + kozmetik | ≈ 336.000 (386.894 − çevre) | ≈ 340.000 (+3 kanat, 5 premium) | ≤ 330.000 → **gölge geçişi dahil sayımda aşılıyor, geometri sayımında (≈170.000) değil** — 1D'de de aynı sayım kullanıldı, dip not |
| Çevre | ≈ 50.600 | aynı | ≤ 80.000 ✓ |
| Pet (25) | 0 | **13.262** · 3 çağrı | ≤ 25.000 · ≤ 3 ✓ |
| VFX | 0 | **≤ 1.462** (731 quad) · 1 çağrı | ≤ 25.000 ✓ |
| **Toplam** | 386.894 · 106 çağrı | **401.384 · 113 çağrı** | ≤ 460.000 · ≤ 220 ✓ |
| **Kare süresi (asıl kapı)** | 3,4 ms (p95 5,6) | **3,6 ms** (p95 5,6) | ≤ 4,0 ✓ |

Dip not: `info.triangles` gölge haritası geçişini de sayar (Govde castShadow); karakter satırı bu yüzden GLB üçgeninin
~2 katı. 1D raporu da aynı HUD sayısını kullandı (343.050 → 349.054), yani satır sınırı aslında "HUD sayısı" için
yazılmış değildi. Asıl kapı kare süresi geçti; LOD paketi tetiklenmedi.

## 7. E — Muayene

`npm run muayene` her varlık değişikliğinden sonra koşuldu (son: bu commit). Karakterler: **insan 0 aday / 227 susturulan ·
kaplan 0 / 185 · robot 0 / 41** (1E: 4 / 7 / 41 aday). Yeni üstveri: `gozlukPremium`, `kanat` kozmetikleri üç türde;
`kozmetik_izinli` kuralları (premium saplar ↔ ten/saç/kürk/metal; kanat koşumu ↔ gövde y 0,9–1,5; kanat ↔ kuyruk);
yeni yakın çekimler "kanat sırt bağlantısı" (×3 tür) ve "premium gözlük". Görsel sayfada premium gözlük varken temel
gözlük gizlenir (aynı yuva). Kontakt sayfalarına bakıldı: `16`–`18`. Konsol hatası 0. Bilinen sınır: `kozmetik` testi
kanatın bacak sarkması/çırpması gibi çalışma anı hareketlerini görmez (bağlama pozu).

## 8. H — Kurallar

Mevcut kod silinmedi; 1C/1D kazanımları duruyor (robot metal bölgesi metalness 0, PURUZ tablosu genişletildi, cache key
v4). SQL yok. Yeni doku dosyası yok — 4 boş hücre yeniden amaçlandı (`gozBeyaz→alevKumas`, `agiz→kanat`, `yanak→kanatKoyu`,
`pantolon→premiumCam`); tek istisna VFX malzemesi (dokusuz ShaderMaterial). Yeni paket yok. `npm run build` temiz.
Sabitler (`VFX_AYAR`, `HIZLAR`, pet hızları) tek yerde, `oyun_ayarlari`'na taşınabilir. Çevreye dokunulmadı.
**DUR:** 25 karaktere/kataloğa yayma yok.

## 9. Bilinen eksikler / sonraki paket adayları

- Alev damlası stilize üçgenimsi; "kumaş kaliteli + stilize alev" hedefi görsel 01'de tutuyor ama gerçek oyunda farklı fonlarda
  (gece) yeniden bakılmalı.
- Köpek gerçekten kedinin yeniden derisi; ayrı burun/kulak geometrisi istenirse +100 üçgen.
- Vitrin ışığı sabit; kozmetiğe göre vurgu (alevde sıcak, buzda soğuk) 1 satırlık uzantı.
- p95 5,3–5,7 ms (medyan 3,1–3,6): otomasyon sekmesinde zamanlayıcı gürültüsü; canlı ölçüm düzeneğinde (S0) tekrar bakılır.
