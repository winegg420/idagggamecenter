# Paket 19 — Canlıda bulunan hatalar (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — kozmetik ekonomisi açıldı | ✅ canlıda · migration 219 uygulandı | `31913f4` |
| B — davet butonu taşması | ✅ canlıda · kök sebep masaüstünde alt menü 540 / içerik 620 | `b83e143` |
| C — vitrinde T-pozu | ✅ canlıda · Idle her kuruluşta anında uygulanıyor + Selam; kalıcı T düzenekte yeniden üretilemedi (ölçüm raporda) | C |
| D — Dükkân › Görünüm vitrini | (sürüyor) | |
| E — geniş ekranda boş alan | (sürüyor) | |
| F — push abonesi sıfır | (sürüyor) | |

---

## A — Kozmetik ekonomisi açıldı

Migration `20260612000219_kozmetik_bedava_test_kapat.sql`: `oyun_ayarlari.kozmetik_bedava_test = false` (kalıcı, canlıda).

**Doğrulama** — canlı veritabanı, kurucu hesap (644 coin), `authenticated` rolüyle `avatar3d_satin_al`, işlem içinde, **geri alındı**:
- Kurucuda Pelerin zaten vardı. "Zaten sende" hatası ödül kuralını gizlemesin diye ilgili dört sahiplik yalnız bu işlem içinde kaldırıldı.

| Deneme | Sonuç |
|---|---|
| Atkı (400) | ✅ bakiye **644 → 244** |
| Kanat (2.000) | ✅ **"Yetersiz coin"** |
| Taç (ödül) | ✅ **"Bu parça satın alınamaz, yalnız ödül olarak kazanılır"** |
| Pelerin (ödül) | ✅ **"Bu parça satın alınamaz, yalnız ödül olarak kazanılır"** |

İşlem sonrası kontrol: ayar `false` kalıcı, bakiye ve sahiplikler değişmedi.

---

## B — "Davet linkini paylaş" butonu taşıyor görünüyordu

### Kök sebep (ölçüldü)
Butonun kendisi kartın dışına **taşmıyor**. Arkadaşlar ve Profil › Davet sekmesinde, masaüstü, iPhone ve tablette buton kartın iç kenarına tam oturuyor.

Asıl sorun **sabit alt menünün içerikten dar olması**:
- `src/styles.css` 1024 px ve üstünde `.app`'i **620 px**'e genişletiyor (masaüstü kararı).
- `.tabbar` ise `max-width: 540px`'te kalmış.
- Masaüstünde içerik 451–1071, alt menü 491–1031 → **her yanda 40 px**.
- Sayfa yukarıdayken davet butonu alt menünün arkasına düşüyor. Butonun menüden geniş kısmı iki yanda **turuncu blok** olarak görünüyor; kartın kenarları da menünün iki yanından çıkıyor. "Buton kartı aşıyor" görüntüsü buydu.
- Telefonda ve tablette `.app` ile menü aynı genişlikte (390 / 540) olduğu için sorun yalnız 1024 px ve üstünde.

### Düzeltme
`src/styles.css` › iki masaüstü kırılma noktasında `.tabbar { max-width: 620px; }`. Buton, kabartma, `translateY`, turuncu vurgu **değişmedi**.

### Aynı hata başka yerde
Taramada 540'ta kalan bir sabit öğe daha çıktı: maç ekranının joker çubuğu (`body.bd-oyun-modu .bd-joker-cubuk`). Üstelik o kuralda `position: fixed` ile `transform` aynı öğede. Ancak `tema.css` o öğeyi zaten akışa alıyor (`position: static; transform: none; max-width: none`), yani canlıda etkisiz. Dokunulmadı.

### Ölçüm (`getBoundingClientRect`, px, sol–sağ)

| Ekran | Sayfa | Kart | Buton | Buton kartın içinde | `.app` | Alt menü önce | Alt menü sonra | Menü farkı önce → sonra | Yatay taşma |
|---|---|---|---|---|---|---|---|---|---|
| Masaüstü 1522×784 | Arkadaşlar | 463–1059 | 475–1047 | ✅ | 451–1071 | 491–1031 | **451–1071** | 40 → **0** | 0 |
| Masaüstü 1522×784 | Profil › Davet | 463–1059 | 475–1047 | ✅ | 451–1071 | 491–1031 | **451–1071** | 40 → **0** | 0 |
| iPhone 390×844 | Arkadaşlar | 12–378 | 24–366 | ✅ | 0–390 | 0–390 | 0–390 | 0 → 0 | 0 |
| iPhone 390×844 | Profil › Davet | 12–378 | 24–366 | ✅ | 0–390 | 0–390 | 0–390 | 0 → 0 | 0 |
| Tablet 800×1000 | Arkadaşlar | 142–658 | 154–646 | ✅ | 130–670 | 130–670 | 130–670 | 0 → 0 | 0 |
| Tablet 800×1000 | Profil › Davet | 142–658 | 154–646 | ✅ | 130–670 | 130–670 | 130–670 | 0 → 0 | 0 |

Kartın iç boşluğu 12 px; buton her ekranda kartın iç kenarından 12 px içeride.

**Sınama düzeneği:** `.tmp/p19/kabuk/` — gerçek `Layout`, sayfalar ve global stiller (`styles.css` + `tema.css` + `koyu.css`, `temaBaslat`), yalnız Supabase cevapları sahte. Ölçüm betiği `.tmp/p19/b_son.mjs` (önce: değişiklik stash'lenip aynı betik).

Görseller: `gorsel/paket19/b-1-once-masaustu-menu.jpg` (menü dar, kart kenarları iki yanda) ↔ `b-2-sonra-masaustu-menu.jpg`.


---

## C — Vitrinde T-pozu

### Ölçüm (tahmin değil)
Paketteki tespit ("`goster()` hiç klip vermiyor") **koddan doğrulanmadı**:
- `goster()` → `MeydanAvatarlari.kur` → `#govdeTak` → `ks.klip(karakter, "Idle")` zaten çağrılıyordu.
- Canlıdaki paket (`vitrinSahne-SPec7o9B.js`, indirilip okundu) depodakiyle aynı.

Sınama düzeneğinde (gerçek `Layout` + vitrin, geliştirme ve **üretim derlemesi** ayrı ayrı) canlı önizleme karakterine kanca takılarak ölçüldü:

| Ölçüm | Değer |
|---|---|
| Canlı önizlemede aktif klip | `Idle`, ağırlık 1,00 |
| Karıştırıcı zamanı (1 sn arayla) | 3,37 → 4,39 (ilerliyor) |
| Sol kol kemiği (dönüş, q.z) | 0,534 (bağlanma pozuna göre ~64° aşağıda) |
| Yeni kurulmuş karakter, hiç güncellenmeden | **`[0, 0, 0, 1]` = bağlanma pozu (kollar yatay, T)** |
| `klip("Idle")` zamansız çağrıdan hemen sonra | `[0, 0, 0, 1]` — **poz ancak ilk karıştırıcı güncellemesinde gelir** |
| `klip("Idle", 0)` zamanlı çağrıdan hemen sonra | `[-0,047, -0,117, 0,523, 0,843]` — poz **hemen** uygulanır |

**Sonuç:**
- Karakter her yeniden kurulduğunda (tür seçimi, kozmetik tak/çıkar) döngü bir kare ilerletene kadar **T-pozunda**. Bu aralıkta çizilen her kare T gösterir; portre döngüsünün `ciz()` çağrısı da bu aralıkta çizebiliyordu.
- **Kalıcı** T-pozu ise ne geliştirme ne üretim düzeneğinde yeniden üretilebildi: üç türde de `Idle` oynuyor, kollar aşağıda (önce görselleri).
- Canlıda kalıcı görüldüyse sebebi bu ölçümlerin dışında. Olası bir açıklama da `Idle`'ın kendisinin çok az hareketli olması: bacaklar açık, kollar hafif yanda duran "manken" duruşu.

### Düzeltme (`bildim/vitrin/vitrinSahne.js`, `KarakterVitrini.jsx`)
- `goster()` **her çağrıda** `Idle`'ı **zamanla** bağlıyor (`klip(k, "Idle", 0)` → `mixer.update(0)`). Karakter kurulduğu anda doğru pozda, T karesi yok.
- **Selam (isteğe bağlı madde, eklendi):**
  - İlk açılışta Idle; oyuncu **tür seçince ya da kozmetik takınca/çıkarınca** bir kez `Selam` (tek sefer, sonunda donar), bitince 0,35 sn geçişle `Idle`.
  - Ölçüldü, tür değişince 0,4 sn aralıkla aktif klipler: `Selam ×5 → Idle 0,9 → Idle 1,0 …`.
  - **Maliyet:** aynı karıştırıcıda klip değişimi; ek çizim çağrısı, ek mesh, ek doku yok.
- **Kart portreleri değişmedi:** hepsi aynı sabit pozda (`Idle` @0,3).

Görseller:
- Önce: `gorsel/paket19/c-1-once-insan.jpg`, `c-2-once-kaplan.jpg`, `c-3-once-robot.jpg`.
- Sonra: `c-4-sonra-insan.jpg`, `c-5-sonra-kaplan.jpg`, `c-6-sonra-robot.jpg`, `c-7-sonra-robot-selam.jpg` (tür seçince Selam).
- Not: önce/sonra durağan görüntüler birbirine benziyor, çünkü düzenekte kalıcı T-pozu zaten yoktu. Fark kurulum anındaki ilk karede, yukarıdaki tabloda.

Betikler: `.tmp/p19/c_kanca.mjs`, `c_dogrula.mjs`, `c_poz.mjs`, `c_selam.mjs`.
