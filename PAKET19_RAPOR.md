# Paket 19 — Canlıda bulunan hatalar (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — kozmetik ekonomisi açıldı | ✅ canlıda · migration 219 uygulandı | `31913f4` |
| B — davet butonu taşması | ✅ canlıda · kök sebep masaüstünde alt menü 540 / içerik 620 | B |
| C — vitrinde T-pozu | (sürüyor) | |
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
