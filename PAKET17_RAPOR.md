# Paket 17 — Taç/pelerin onayı · iki ölü sistem · gardırop dondurma (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — taç + pelerin onaylandı | ✅ canlıda | `376f453` (birleşme), `6042c32`, A-2 |
| B — push kimseye gitmiyor | (sürüyor) | |
| C — lig arşivi boş | (sürüyor) | |
| D — eski gardırop dondurma | (sürüyor) | |

---

## A — Taç ve pelerin

- `paket16-tac-pelerin` dalı `main`'e birleştirildi (`376f453`, yalnız `meydanAvatar.js` + 2 görsel). Dal GitHub'dan silindi. Build hatasız.
- `PAKET16_RAPOR.md` C: "karar bekliyor" → "onaylandı, canlıda".
- **Canlı doğrulama:** canlı paket `https://quiztactics.vercel.app/assets/dunya-BRUhwwKX.js` içinde `MeydanPelerin` / `MeydanTac` var (canlı parçalar tek tek indirilip arandı). Canlı meydana girmek oturum istiyor — şifre giremediğim için görüntü, **aynı commit'in üretim derlemesinden** (`olcum/meydan-test`, sahte oturum) alındı: `gorsel/paket17/a-tac-pelerin-uretim-arkadan.jpg`, `a-tac-pelerin-uretim-onden.jpg` (insan, kaplan, robot; klasik ve kısa pelerin).

### 152 ↔ 167 çağrı farkı — kapandı
Aynı üretim derlemesi, aynı kamera (İstiklal ucu), aynı oyuncu sayısı (27 karakter: 20 tam + 7 hafif), iki sahne kurulumu. Kozmetikler gizlenerek çağrı yeniden sayıldı:

| Kurulum | Toplam çağrı | Görünür kozmetik klonu | Kozmetik klonları gizli | Taç/pelerin gizli |
|---|---:|---:|---:|---:|
| 3A-2 (`cepheOlc`: oyuncular tohumdan görünüm alır) | **167** | 27 (sapka 8 · atkı 9 · gözlük 2 · kuyruk 8) | **142** | — |
| Paket 16 C ölçümü (herkese `avatar3d` taç + pelerin) | **154** | 10 (atkı 1 · gözlük 1 · kuyruk 8) | 144 (= 142 + taç/pelerin 2) | **152** |

- **Sebep: kamera/LOD değil, sahnenin kurulumu.** İki kurulumun kozmetiksiz tabanı aynı: **142**.
- 3A-2'de oyuncular görünüm kaydı olmadan geliyor → `tohumdanGorunum` her birine rastgele şapka/atkı/gözlük veriyor. Meydandaki kozmetikler **karakter başına klon mesh** (her biri 1 çağrı); 27 klonun 25'i kadrajda → 142 + 25 = 167.
- Paket 16 C ölçümünde herkese `avatar3d` görünümü verildi (baş = taç) → rastgele kozmetikler düştü → 10 klon → 152; taç/pelerinle 154.
- **Düzeneğe güven:** sayılar birebir toplanıyor (142 + 25 = 167; 142 + 10 = 152; +2 = 154). Karşılaştırmalar **aynı sahne kurulumuyla** yapıldığı sürece geçerli; kurulum değişirse taban değişir. İleriki ölçümlerde sahne kurulumu rapora yazılmalı.
- **Yan bulgu:** kozmetik klonları görünür bir maliyet — 20 tam karakterde 25 çağrı. Taç/pelerinin paylaşımlı InstancedMesh deseni diğer kozmetiklere de uygulanırsa bu 25 çağrı ~5'e iner (bu pakette yapılmadı; karakter.js/kozmetik.js kapsam dışı).
