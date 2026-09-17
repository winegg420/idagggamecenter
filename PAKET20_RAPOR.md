# Paket 20 — Ödül/ilerleme güvenilirliği + soru kalite mekanizması (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| I.1–I.2 — görevler + Düello ustalığı | ✅ canlıda · migration 220 uygulandı | `2e3773d` |
| I.3 — maç sonu ödül dökümü | ✅ canlıda · migration 221 uygulandı, 5 sonuç ekranında satır satır döküm | `17dfe91` |
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

## I.3 — Maç sonu ödül dökümü

**Ölçüm:** sahibinin Düello'sunda +53 lig / +55 coin = galibiyet 50/50 + günlük seri bonusu **+3 lig** (`gunluk_seri_bonusu`, gün×3) + seri coin'i **+5** (`seri_guncelle`, `coin_seri_1`). Hesap doğruydu; ekran yalnız galibiyet satırını (`duello_durum.odul`, `mac_odulum`) biliyordu. Rozet coin vermiyor (`award_badge` yalnız kayıt).

**Yapı (migration `20260612000221_odul_dokumu.sql`):**
- `odul_kalemleri(kaynak, user_id, kalem, lig, coin, detay)` — RLS açık, anon/authenticated'a kapalı; okuma yalnız `odul_dokumu(p_kaynak)` RPC'siyle (security definer, yalnız kendi satırları, yalnız `authenticated`).
- **Kalemleri ödülü yazan fonksiyonlar yazar**, istemci hesap yapmaz. Maçı bitiren fonksiyon işlem içi bağlam açar (`mac:` · `duello:` · `hizli:` · `turnuva:` · `grup:`); o işlemdeki `coin_ekle` (günlük tavandan SONRA gerçekten eklenen miktar), lig puanı ve yeni açılan rozet o kaynağa düşer. Bağlam yoksa (dükkân, ikram, görev) hiçbir şey yazılmaz.
- Değişen canlı fonksiyonlar (hedefli satırlar): `coin_ekle`, `coin_mac_odulu`, `gunluk_seri_bonusu`, `seri_guncelle`, `mac_sonuclandir`, `duello_bitir`, `hizli_mod_bitir`, `turnuva_odullerini_dagit`, `trg_turnuva_bitti`, `trg_grup_bitti`, `award_badge`.
- İndirim **sebebiyle**: `odul_indirim_sebebi`, `odul_carpani`'nın seçtiği en düşük çarpanın kaynağını yazar → "serbest maç — coin yarı", "çift koruması — %50", "açık bot — coin yarı", "aynı rakiple bugün çok maç — ödülsüz"; günlük coin tavanı kırptıysa "günlük coin tavanı doldu".
- Döküm ayrıca açılan rozetleri ve günlük görev ilerlemesini (`get_daily_quests`) gösterir.

**Ekranlar:** `OdulDokumu` bileşeni — Normal Maç, Düello, Hızlı Mod, Grup Maçı (ödülsüz: yalnız rozet + görev), Turnuva (yalnız katılana). Üstteki büyük kazanç satırı da artık aynı sunucu toplamını gösterir (Normal/Düello/Hızlı). Metinler TR + EN (16 yeni anahtar).

**Doğrulama** (canlı DB, işlem içinde, geri alındı):

| Senaryo | Döküm |
|---|---|
| Dereceli Düello, iki test hesabı, kazanan | Galibiyet 0 · *aynı rakiple bugün çok maç — ödülsüz* (iki hesap aynı cihaz → `cift_odul_carpani` = 0, gerçek kural) · Günlük seri (2 gün) +6 lig +5 coin · Açılan rozet: İlk Galibiyet · görevler 1/3, 1/5 |
| Aynı Düello, kaybeden | Günlük seri +6 lig +5 coin (galibiyet satırı yok) |
| Serbest Düello, diğer taraf kazanır | Galibiyet 0 · ödülsüz · Açılan rozet: İlk Galibiyet |
| Normal Maç dereceli, açık bot rakip | Galibiyet +25 lig +12 coin · *açık bot — coin yarı* · Açılan rozet: Robot Avcısı |
| Hızlı Mod dereceli, 7 doğru | 7 doğru cevap +21 lig +21 coin · görev "25 doğru" 7/25 |
| Bağlamsız `coin_ekle` (görev ödülü) | kalem yazılmadı (0) |

Arayüz (kabuk düzeneği, sahte veri = sahibinin maçı): üst satır +53 lig / +55 coin; döküm Galibiyet +50/+50 · Günlük seri (1 gün) +3/+5 · Toplam +53/+55 · rozet · 3 görev; serbest örnekte indirim sebebi satırda. Yatay taşma 0; iOS denetimi (5 sayfa × 2 ekran) değişmedi, temiz. Görseller `gorsel/paket20/i3-*`.
