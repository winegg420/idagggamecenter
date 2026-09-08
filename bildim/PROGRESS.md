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
