# Bildim! — Modül İlerleme Günlüğü

> Bu, `bildim/` modülünün özet günlüğüdür. **Ayrıntılı, oturum-oturum geçmiş** repo kökündeki `PROGRESS.md`'dedir (Bildim başından beri hub'ın çekirdeğiydi; tüm quiz oturumları orada).

## Modül durumu (2026-07-22)

- **Tamamlanan modlar:** Hemen Oyna, 1v1 Meydan Okuma, Grup Maçı (3-5 kişi), Hızlı Olan Kazanır, Gece Turnuvası.
- **Sistemler:** Arkadaşlık + davet, rütbe/XP + rütbe atlama animasyonu, lider tablosu (podyumlu), PWA push bildirimi, referans/davet sistemi, bot oyuncular (`bot_oyna`).
- **Soru havuzu:** çok partili migration'larla genişletildi; `generate-questions` Edge Function (Claude API) ile üretim.
- **Kimlik:** `profiles` (username unique + avatar_url) — tüm hub'ın ortak kimliği. `hile_yetkisi` = admin/founder yetkisi (`hileli_mi()`).

## Hub taşıması (2026-07-22)

- Quiz sayfaları/bileşenleri `src/`'den `bildim/` klasörüne taşındı (tam modül izolasyonu). Rotalar `/bildim/*` altına alındı (eski yollar geriye uyumlu yönlendirilir).
- Site "IDA GG Game Center" hub'ına dönüştü; Bildim artık hub içindeki bir oyun. `profiles` ortak kimlik olarak diğer oyunlara (kafatopu/meyvekes/patirun/driftgp) hizmet verir.
- **Faz 5 (görünürlük):** `profiles.last_seen` + `kalp_at()` heartbeat (paylaşılan AuthContext) + `oyuncu_ara()` RPC — FriendsPage araması admin=hepsi / normal=online-only.

## Farklılaştırma paketi (2026-09-08) — Google Play hazırlığı

- **Kategori seçmeli yarış:** kategori artık soru havuzuna yansıyor (`soru_sec`); 1v1, grup,
  hızlı mod ve Hemen Oyna kategoriye saygılı. Turnuva karışık kalır.
- **Şehir/ülke ligi:** `profiles.ulke/sehir` (haftada 1 kez değişir, `profil_konum_kaydet`),
  `ulkeler`/`sehirler` tabloları (TR 81 il), `lig_siralama(kapsam, donem)`,
  `sehir_lig_sirasi(donem)`, `benim_lig_durumum(donem)`.
- **Haftalık lig:** `lig_arsiv` + `haftayi_kapat()` (Pazartesi 00:00 TSİ, arşivle→rozet→sıfırla)
  + `haftalik_sonuc_bildir()` (Pazartesi 09:00 TSİ push). Eski "sadece sıfırla" cron'u kaldırıldı.
- **Görülen soru tekrarı:** `gorulen_sorular` — soru gösterilirken yazılır, seçimde
  görülmemişler önceliklidir.
- **Kota:** saat başına 30 maç başlatma (`mac_kotasi_kontrol`), `hileli_mi()` muaf.
- **Dil hazırlığı:** `questions.dil` + `profiles.dil` (arayüz çevirisi YOK).
- **Arayüz:** Lig sayfası (şehir/ülke/dünya × hafta/tüm zamanlar, podyum, sticky kendi satırı),
  kategori kartlarında çözülme yüzdesi, ana sayfa lig rozetleri, konum modalı.
- **Kozmetik:** `bd-*` tasarım katmanı, yeni soru kartı (süre halkası + anlık geri bildirim),
  puan sayacı animasyonu, erişilebilirlik (kontrast, 44px, focus-visible).
- **Play Store:** `/gizlilik` (giriş duvarının önünde) + `hesabimi_sil()` akışı.
- Migration'lar: `20260612000045_lig_ve_kategori.sql`, `20260612000046_hesap_silme.sql`.
  Soru havuzu planı: `scripts/soru-parti-sablonu.md` (hedef 10.000).

## Kalan / dikkat

- Puanlama/RLS/realtime mantığı hassas — ödül formülleri ölçeklenebilir.
- Ayrıntılı kararlar ve oturum geçmişi için kök `PROGRESS.md`.

---

## 2026-09-08 — Soru kütüphanesi zenginleştirme (+2.000 soru)

**İstek:** "2k adet daha soru cekelim her kategoriye. soruların kalitesinden
dogrulugundan emin ol her zaman."

### Yapılan
Dört migration partisi halinde **2.000 yeni soru** üretildi ve canlıya uygulandı:

| Migration | İçerik |
|---|---|
| `20260612000059_soru_parti13.sql` | genel_kultur 200 · bilim 198 · tarih 102 |
| `20260612000060_soru_parti14.sql` | tarih 100 · cografya 200 · edebiyat 200 |
| `20260612000061_soru_parti15.sql` | spor 200 · sanat 200 · sinema 100 |
| `20260612000062_soru_parti16.sql` | sinema 100 · teknoloji 200 · muzik 200 |

Her kategoriye tam **+200** soru. Aktif havuz **3.193 → 5.193**.

Kategori dağılımı (aktif): genel_kultur 1354, bilim 594, tarih 536, cografya 485,
edebiyat 437, spor 427, sanat 401, muzik 320, teknoloji 320, sinema 319.

### Kalite süreci (her parti için aynı zincir)
1. `temizle.mjs` — mevcut havuzla anahtar kelime çakışması olan soruları eler
2. `birebir.mjs` — birebir aynı soru metni taraması
3. `kirp.mjs` — kategori kotalarını tam 200'e indirir
4. `tamamla.mjs` — doğru şık dağılımını **125/125/125/125** dengeler ve
   `where q.created_at >= transaction_timestamp()` ile YALNIZ o partinin
   şıklarını karıştıran SQL bloğunu ekler
5. `denetle.mjs` — biçim, 4 şık, kategori dağılımı, parti içi tekrar,
   havuzla çakışma, "zamana bağlı / yoruma açık" ifade taraması
6. Canlı DB'de `begin; … rollback;` provası

**Sonuç:** 4 partinin de denetimi `HATA: 0`, `Mevcut havuzla çakışma: 0`.
Dört parti birlikte provada `eklenen: 2000` (hiçbiri `on conflict` ile düşmedi).

### Elenen / düzeltilen
- Parti 13: 24 anahtar çakışması + 7 kota fazlası
- Parti 14: 52 anahtar çakışması + 10 kota fazlası
- Parti 15: 76 anahtar çakışması, 1 birebir tekrar, 48 kota fazlası;
  1 soru "en iyi" ifadesi yüzünden yeniden yazıldı
- Parti 16: 22 anahtar çakışması, 4 birebir tekrar (kısa metinli oldukları için
  anahtar taramasından kaçmışlardı), 35 kota fazlası; 1 soru "güncel" kelimesi
  denetimi tetiklediği için yeniden yazıldı

**Karar:** Güncel şampiyon / transfer / sürüm numarası / şirket durumu gibi
zamanla değişen hiçbir soru yazılmadı — havuz yıllarca doğru kalmalı.

### Uygulama
Migration'lar `pg` üzerinden doğrudan canlı DB'ye uygulandı (059→060→061→062),
ardından `supabase migration repair --status applied` ile geçmişe işlendi.
`npm run build` temiz.

**Not:** Pooler host adresi `aws-1-eu-central-1.pooler.supabase.com` (aws-0 değil).
