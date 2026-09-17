# Paket 18 — Lig kapanışı · çizim çağrısı kaldıracı · vitrin tamamlama (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — lig kapanışı (4 düzeltme) | ✅ canlıda · migration 217 uygulandı | A commit'i |
| B — kozmetik çizim çağrısı kaldıracı | (sürüyor) | |
| C — yeni oyuncuya rastgele kozmetik | (sürüyor) | |
| D — atkı + kanat satışta | (sürüyor) | |
| E — iOS Safari (WebKit) | (sürüyor) | |

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
