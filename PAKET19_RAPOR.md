# Paket 19 — Canlıda bulunan hatalar (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — kozmetik ekonomisi açıldı | ✅ canlıda · migration 219 uygulandı | A |
| B — davet butonu taşması | (sürüyor) | |
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
