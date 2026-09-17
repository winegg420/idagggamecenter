# Paket 20 — Ödül/ilerleme güvenilirliği + soru kalite mekanizması (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| I.1–I.2 — görevler + Düello ustalığı | ✅ canlıda · migration 220 uygulandı | `2e3773d` |
| I.3 — maç sonu ödül dökümü | (sürüyor) | |
| II — soru kalite mekanizması | (sürüyor) | |
| III — misafir hesabı koruma | (sürüyor) | |
| IV — Düello deneyimi | (sürüyor) | |
| V — Hatalarım dürüstlüğü | (sürüyor) | |
| VI — konsol uyarıları | (sürüyor) | |
| VII — renk ve kontrast | (sürüyor) | |

---

## I.1 — Günlük görevler bütün modları sayıyor

Canlı `gorev_sayaci` (migration 023'ten beri değişmemiş) yalnız `matches` / `match_answers` okuyordu. Migration `20260612000220_gorev_ustalik_tum_modlar.sql` ile `lig_aktif_mac_sayisi`'nin mod listesi aynen kullanıldı:

| Görev | Normal Maç | Düello | Hızlı Mod | Grup Maçı | Turnuva |
|---|---|---|---|---|---|
| `mac_oyna_3` | `matches` bitti | `duellolar` bitti | `hizli_mod_oturumlar` bitti | `group_matches` bitti + `davet_durumu='kabul'` | `tournaments` bitti + `tournament_players` |
| `mac_kazan_5` | `kazanan` | `kazanan` | — (tek kişilik, kazananı yok) | `kazanan` | `kazanan` |
| `dogru_25` | `match_answers.dogru` | `duello_hamleler` savunan + `dogru` | oturumun `dogru` sayısı | `group_match_answers.dogru` | `tournament_answers.dogru` |

TSİ gün sınırı (`[gün 00:00, ertesi gün 00:00)` Europe/Istanbul). İptal/yarım (`durum <> 'bitti'`) sayılmaz. **Grup Maçı sayılır** (ürün kararı: oyuncu gerçekten oynuyor). Sınır: Düello **altın soru** cevapları ayrı satır tutulmadığı (yalnız o turun jsonb'si) için `dogru_25`'e girmiyor.

**Eski ↔ yeni sayım** (canlı, gerçek oyuncular, son 5 gün; kuru çalıştırma işlem içinde, sonra gerçek uygulama). Yalnız değişen satırlar:

| Oyuncu | Gün (TSİ) | Görev | Eski | Yeni |
|---|---|---|---|---|
| bedofastfoodmnsr | 14 Eyl | 3 maç oyna | 1 | 2 |
| bedofastfoodmnsr | 14 Eyl | 25 doğru | 12 | 20 |
| Emir | 14 Eyl | 3 maç oyna | 0 | 1 |
| Emir | 14 Eyl | 5 maç kazan | 0 | 1 |
| Emir | 14 Eyl | 25 doğru | 0 | 15 |
| idagg | 13 Eyl | 3 maç oyna | 1 | 2 |
| idagg | 14 Eyl | 3 maç oyna | 4 | 8 |
| idagg | 14 Eyl | 25 doğru | 59 | 82 |
| idagg | 15 Eyl | 3 maç oyna | 2 | 7 |
| idagg | 16 Eyl | 3 maç oyna | 2 | 10 |
| idagg | 16 Eyl | 5 maç kazan | 0 | 2 |
| idagg | 16 Eyl | 25 doğru | 10 | 23 |
| idagg | 17 Eyl | 3 maç oyna | 0 | 2 |
| idagg | 17 Eyl | 25 doğru | 0 | 1 |
| QuizTestIda | 16 Eyl | 3 maç oyna / 5 kazan / 25 doğru | 0 / 0 / 0 | 1 / 1 / 1 |
| sila | 17 Eyl | 3 maç oyna | 1 | 3 |
| TestOyuncu917 | 17 Eyl | 3 maç oyna / 5 kazan / 25 doğru | 0 / 0 / 0 | 1 / 1 / 2 |
| YüceBaran | 14 Eyl | 3 maç oyna | 1 | 2 |

## I.2 — Düello kategori ustalığını besliyor

**Tarama** (canlı fonksiyon kaynakları + tetikleyiciler, `kategori_dogru_arttir` kimden çağrılıyor):

| Mod | Ustalık (`kategori_dogru`) | Yüzde (`kategori_istatistik`) |
|---|---|---|
| Normal Maç | ✅ `trg_kategori_1v1` (match_answers) | ✅ |
| Grup Maçı | ✅ `trg_kategori_grup` | ✅ |
| **Turnuva** | ✅ `trg_kategori_turnuva` (tournament_answers) — **sayılıyor**, düzeltme gerekmedi | ✅ |
| Hızlı Mod | ✅ `hizli_mod_cevap` içinde | ✅ |
| Hatalarım | ✅ `calisma_cevap` | — |
| **Düello** | ❌ **hiç çağrılmıyordu** (`duello_cozumle`, `duello_cevap` yalnız yüzde yazıyordu) | ✅ |

**Düzeltme:** `duello_cozumle` → savunanın doğrusu, `duello_cevap` altın soru fazı → iki oyuncudan doğru cevaplayan (saldıran taraf da). Bot filtresi `kategori_dogru_arttir`'ın içinde. Saldıran normal turda cevap vermediği için sayılacak bir cevabı yok.

**Geriye dönük:** geçmiş 14 Düello hamlesinin savunma doğruları ustalığa yazıldı (idagg müzik 8→12, tarih 3→4; QuizTestIda tarih 0→1; TestOyuncu917 sanat 0→1, tarih 0→1).

**Doğrulama** (canlı DB, işlem içinde, geri alındı): savunan doğru → tarih ustalığı 1→2; savunan yanlış → 2→2; altın soruda saldıran taraf doğru → 1→2; `dogru_25` Düello hamlesini sayıyor.
