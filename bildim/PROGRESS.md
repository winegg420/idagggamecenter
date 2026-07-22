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

## Kalan / dikkat

- Puanlama/RLS/realtime mantığı hassas — ödül formülleri ölçeklenebilir.
- Ayrıntılı kararlar ve oturum geçmişi için kök `PROGRESS.md`.
