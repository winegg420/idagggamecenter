# Paket 20 — Ödül/ilerleme güvenilirliği + soru kalite mekanizması (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| I.1–I.2 — görevler + Düello ustalığı | ✅ canlıda · migration 220 uygulandı | `2e3773d` |
| I.3 — maç sonu ödül dökümü | ✅ canlıda · migration 221 uygulandı, 5 sonuç ekranında satır satır döküm | `17dfe91` |
| II — soru kalite mekanizması | ✅ canlıda · migration 222–224 uygulandı; 2.976 şüpheli (30 rekabetçi havuz dışı), akış uçtan uca doğrulandı; sol anahtarı sorusunun anahtarı **doğru** çıktı | II |
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

---

## II — Soru kalite mekanizması

### Sahibinin gördüğü "sol anahtarı" sorusu — ölçüm
Canlıdaki soru: **`a11854c0` "Sol anahtarı hangi çizgiye yerleşir?"**, şıklar `[A Birinci, B Üçüncü, C İkinci, D Dördüncü]`, **doğru = indeks 2 = "İkinci"** — müzik bilgisi olarak doğru (sol/G anahtarı 2. çizgi). Sahibinin Düello'su `b16d07df` (17 Eyl 17:36): TestOyuncu917 savunmada **D "Dördüncü"** seçti, sunucu **yanlış** saydı, sonuç ekranı C'yi ("İkinci") yeşil gösterdi. Düello şık sırasını değiştirmiyor (`duello_durum` → `soru_dilinde`, istemci aynı sırayı çiziyor); İngilizce çevirinin sırası da aynı.
**Sonuç:** veritabanında "Üçüncü"nün doğru sayıldığı bir kayıt yok; cevap anahtarı doğru. En olası açıklama, yeşil yanan **3. düğmenin** (C) "üçüncü" olarak okunması. Havuzda aynı sorunun 3 pasif varyantı daha var, hepsi "İkinci". Mekanizma yine de kuruldu — aşağıdaki katmanlar gerçek bir ters anahtarı yakalamak için.

### II.0 — Var olan altyapı ölçüldü
| Parça | Durum |
|---|---|
| `question_votes` | RLS açık, politika yok (yalnız RPC), 10 oy vardı |
| `vote_question` | çalışıyordu, EXECUTE `authenticated`; `adil_oy`/`toplam_oy` güncelleniyordu |
| Arayüz | **bağlıydı**: `QuestionCard` cevap sonrası "Bu soru adil miydi?" (paket metni "hiç bağlanmamış" diyordu; yalnız sebep ve maç sonu girişi yoktu) |
| Eski otomatik kaldırma | ≥5 oy ve adil < %35 → `aktif=false`; **bot ayrımı yok, kayıt yok**, soru sessizce kayboluyordu |

### Kurulanlar (migration 222 · 223 · 224, canlıda)
- **Tablolar (yalnız ekleme):** `soru_denetim(question_id, durum, sebep, kaynak, denetleyen, tarih, not_metni)` — `not` SQL'de ayrılmış kelime olduğu için `not_metni`; `soru_surum(question_id, surum, soru, secenekler, dogru_cevap, degisiklik_notu, tarih)`; `soru_cevap_kaydi` (Hızlı Mod ve Hatalarım şık bazında cevap tutmuyordu). `questions` + `denetim_durumu` (varsayılan `bekliyor`), `surum` (1), `supheli_isaretler`, `supheli_agirlik`; `question_votes` + `sebep`; `question_translations` + `eskidi`. Hepsi RLS açık, anon/authenticated'a kapalı. Satır silinmedi, id değişmedi.
- **Katman 0 — bildir (II.1):** `vote_question(p_question_id, p_adil, p_sebep)`. Sebep: cevap yanlış · anlaşılmıyor · birden fazla doğru · yazım hatası · güncel değil. Yalnız **görülmüş** soru bildirilebilir. `soru_bildirim_esigi` (3) farklı **gerçek** oyuncu (bot sayılmaz; son onay/düzeltmeden sonraki bildirimler) → `aktif=false`, `denetim_durumu='karantina'`, `soru_denetim`'e sebepleriyle kayıt. Eski sessiz %35 kuralı bunun yerine geçti. Arayüz: 5 sonuç ekranında **"Maçın soruları"** (doğru cevap + senin cevabın + "Soruyu bildir"), Hatalarım'da tur sonunda **"Turun soruları"** (soru ekranı 1 sn'de geçtiği için liste orada).
- **Katman 1 — kural taraması (II.3):** işaretler **her soru girişinde tetikleyiciyle** hesaplanır (yeni üretilen soru da, migration ile gelen de); `soru_supheli_tara()` tüm havuzu tarar (~12 sn). Ağırlık: 3 güçlü · 2 orta · 1 zayıf.
- **Katman 2 — istatistik (II.4):** `soru_istatistik_tara()` — Normal/Grup/Turnuva cevap tabloları (`soru_ids[soru_index+1]`), Düello hamleleri, Hızlı Mod + Hatalarım yeni kaydı; **botlar hariç**, süre dolan şıksız cevap hariç. Örneklem ≥ 20 ve doğruluk < %15 → `dusuk_dogruluk`; yanlışların ≥ %70'i tek şıkta ve doğruluk < %50 → **`ters_anahtar`**.
- **Katman 3 — denetim hattı (II.5):** `npm run soru:disari` / `npm run soru:iceri` (+ `--kuru`). Yeni paket yok: bağlantı mevcut Supabase CLI (`db query --db-url`). Kullanım `araclar/soru_denetim/OKU.md`.
- **Yeni sorular (II.6):** varsayılan `bekliyor`; tetikleyici işaret koyar. `bekliyor` + ağırlık ≥ `soru_rekabetci_haric_agirlik` (2) → `soru_sec`, `turnuva_soru_sec`, `duello_soru_bul` bu soruyu **vermez**; Hatalarım (`calisma_baslat`, işlem içi `app.soru_havuzu='serbest'`) verir. Kapatma: `soru_supheli_rekabetci_haric = false`. **Karar:** `soru_sec` maçın dereceli/serbest olduğunu bilmiyor (12 çağıran); serbest maçlar da rekabetçi havuzu kullanıyor — daha sıkı taraf seçildi, bugün yalnız 30 soru etkileniyor. `generate-questions` kodu değişmedi: kontrol veritabanında, her giriş yolunda aynı. Eskimiş çeviri olan soru o dilde sorulmaz.

### II.7 — Tarama sonuçları (canlı, 9.290 aktif soru)
| İşaret | Ağırlık | Soru | Açıklama |
|---|---|---|---|
| `celiski` | 3 | **4** (2 çift) | Au/Ag simgesi, "en büyük organ / en büyük iç organ" — ikisi de tek kelime farkı, gerçek çelişki değil; insan denetimine aday |
| `hepsi_hicbiri` | 2 | **25** | "İkisi de / Hiçbiri", "X dışı hiçbiri" |
| `cevap_sizmasi` | 2 | **5** | "Sirk ve buzul vadisi hangi etkenin…" → Buzul |
| `dogru_en_uzun` | 1 | **2.548** | zayıf; tek başına rekabetçi havuzdan çıkarmaz |
| `yakin_varyant` | 1 | **456** | kopya riski |
| `sayisal_uc` | 1 | **32** | zayıf |
| `kategori_carpik` | 1 | **0** | 10 kategoride doğru-indeks dağılımı dengeli (tek indeks > %40 yok) |
| `ayni_sik` / `sik_sayisi` | 3 | **0** | |
| **Toplam şüpheli soru** | | **2.976** | 30'u (ağırlık ≥ 2) rekabetçi havuz dışında |
| İstatistik (`dusuk_dogruluk` / `ters_anahtar`) | | **0** | bugün 589 gerçek oyuncu cevabı / 486 soru — hiçbir soru 20 örneğe ulaşmadı; veri biriktikçe çalışır |

**Kurallar ölçülerek daraltıldı:** ilk `celiski` kuralı (benzer metin + farklı doğru metni) **352 soru** verdi; örneklerin çoğu farklı konu (hentbol/basketbol, Yunan/Roma savaş tanrısı) ya da aynı cevabın başka yazımıydı (Pasteur / Louis Pasteur). Yeni kural: benzerlik ≥ 0,9 + diğer sorunun doğrusu bu sorunun şıklarında yanlış işaretli + iki doğru metin birbirini içermiyor → 4. İlk `cevap_sizmasi` alt dizgi eşliyordu ("Yazı" ⊂ "yazılması", 19) → tam kelime → 5. Düz trigram eşleştirmesi 130 sn → LATERAL + GIN dizini ~10 sn.

**Sol anahtarı sorusu yakalandı mı?** **Hayır — ve yakalanmamalı:** anahtarı doğru. Kural işareti yok (şıklar farklı, doğru şık en uzun değil, metinde geçmiyor); 3 pasif varyantın hepsi aynı cevabı veriyor (benzerlik 0,39–0,54, varyant eşiğinin altında); istatistik örneklemi 2 cevap. Gerçekten ters girilmiş bir anahtar **kural katmanında görünmez** (yapısal değil, olgusal hata) — onu yakalayacak olan **Katman 2 `ters_anahtar`** (oyuncuların yanlışları tek şıkta toplanır) ve **Katman 0 bildirim** (3 oyuncu → karantina). Bu yüzden rapor ağırlığı bu iki katmana verildi.

**Uçtan uca akış** (canlı DB, tek işlem, **geri alındı**):
| # | Adım | Sonuç |
|---|---|---|
| 1 | Görmediği soruyu bildirme | ✅ reddedildi "Bu soruyu görmedin" |
| 2 | 2 gerçek oyuncu + 1 bot bildirir (eşik 3) | ✅ aktif, `bekliyor` (bot sayılmadı) |
| 3 | 3. gerçek oyuncu | ✅ `aktif=false`, `karantina`; `soru_denetim`: "3 gerçek oyuncu bildirdi · cevap_yanlis ×2, birden_fazla_dogru ×1" |
| 4 | Karantinadaki soru `soru_sec`'te (50 çekiliş) | ✅ 0/50 |
| 5 | Dışa aktar | ✅ ilk kayıt, öncelik 1, bildirim `{sayi: 3, sebepler: {cevap_yanlis: 2, birden_fazla_dogru: 1}}` (sayılar 224'te düzeltildi) |
| 6 | İçe aktar `duzelt` (şıklar ters, anahtar güncellendi) | ✅ düzeltme 1, atlanan 0 |
| 7 | Soru sonrası | ✅ aktif, `duzeltildi`, `surum=2`, doğru cevap metni aynı (Real Madrid) |
| 8 | Sürüm geçmişi | ✅ `soru_surum` surum 1 eski şıklar + eski anahtar |
| 9 | Çeviri | ✅ `en` eskidi |
| 10 | Denetim geçmişi | ✅ karantina → bekliyor(dışa aktarıldı) → düzeltildi |
| 11 | Düzeltmeden sonra 1 yeni bildirim | ✅ karantina yok (sayaç karardan sonrasını sayar) |
| 12 | `kaldir` | ✅ satır duruyor, `aktif=false`, `reddedildi` |

**Betikler** (`--kuru`, canlı okuma): `soru:disari --adet 5 --kuru` → 5 soru (bildirim 2 · kural 3); `soru:iceri --kuru` 6 satır → onay 1 · kaldırma 1 · **atlanan 4** (3 şık, indeks 7, geçersiz id, bilinmeyen karar) — parti düşmedi, veritabanına hiçbir şey yazılmadı.

**Rekabetçi havuz** (işlem içinde): `soru_sec` 200×50 çekilişte işaretli soru **0**; Hatalarım havuzunda **200** (serbest); `calisma_baslat` sonrası bağlam temiz; `turnuva_soru_sec` 15/15, işaretli 0.

**Arayüz** (kabuk düzeneği): liste — C "İkinci" yeşil "doğru cevap", D kırmızı "senin cevabın"; bildir → 5 sebep → `vote_question(q1, false, 'cevap_yanlis')` → "Bildirildi — teşekkürler". Yatay taşma 0 (iPhone + masaüstü). Görseller `gorsel/paket20/ii1-*`.
