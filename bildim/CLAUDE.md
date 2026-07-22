# CLAUDE.md — Bildim! (bilgi yarışması modülü)

Bu dosya, `bildim/` modülü üzerinde çalışan Claude Code (ve diğer AI ajanları) için rehberdir. Modül, **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) bir parçasıdır ama kendi içinde bağımsız geliştirilebilir.

## Modül Özeti

**Bildim!** — Türkçe bilgi yarışması. Gece turnuvası, 1v1 meydan okuma, grup maçı (3-5 kişi), "Hızlı Olan Kazanır" modu, arkadaş sistemi, rütbe/XP, push bildirimi. Hub'ın quiz oyunudur (idaGP, Kafa Topu, Meyve Kes gibi bir oyun kartı).

## Teknoloji

- React 19 + Vite 7, React Router 7 (hub'ın kabuğu üzerinden)
- Supabase (Auth, Postgres, Realtime, RLS, Edge Functions, pg_cron)
- Soru üretimi: Claude API → Edge Function `generate-questions`

## Dizin Yapısı (`bildim/`)

- `pages/` — Home, MatchPage, GroupMatchPage, HizliMacPage, ChallengesPage, TournamentPage, LeaderboardPage, FriendsPage, ProfilePage
- `components/` — Layout (tabbar/kabuk), QuestionCard, RankBadge, Countdown, RankUpOverlay
- `lib/` — ranks (rütbe/XP), push (bildirim), zaman (zaman yardımcıları)

## Kabuğa Bağlantı (paylaşılan `src/`)

Bildim, hub kabuğuyla en sıkı entegre modüldür (quiz, sitenin ilk oyunuydu):
- Rotalar: `src/App.jsx` içinde `/bildim/*` altında (Home = index, alt: turnuva/meydan/mac/grup-mac/hizli-mac/siralama/arkadaslar/profil). Eski top-level yollar geriye uyumlu yönlendirilir.
- Oturum: `src/context/AuthContext.jsx` (`useAuth`).
- Supabase: `src/lib/supabase.js`.
- Paylaşılan bileşen: `src/components/Avatar.jsx`.

## Veritabanı

Bildim, hub'ın **çekirdek** oyunu olduğundan tabloları **öneksizdir** (`profiles`, `matches`, `group_matches`, `hizli_maclar`, `questions`, `friendships`, `tournaments` vb.). Diğer oyunlar önekli (`kafatopu_`, `meyvekes_`, `pr_`, `dg_`, `gl_`). `profiles` tablosu **tüm hub'ın ortak kimliğidir** (username + avatar_url).

- Migration'lar repo kökünde `supabase/migrations/` (sıralı, numaralı). Yeni değişiklik = yeni dosya (`20260612000NNN_ad.sql`). Mevcut migration'ı düzenleme.
- Soru eklerken `soru` kolonu UNIQUE → `on conflict (soru) do nothing`.

## Kurallar

- Türkçe yaz (kod, yorum, commit).
- Minimal değişiklik; mevcut kodu bozma.
- Tüm Supabase/API çağrılarında try-catch.
- RLS + `security definer` RPC, sadece `authenticated`. Kritik mantık (yarış durumu) sunucuda `FOR UPDATE` kilidiyle.
- Puanlama/RLS/realtime mantığına dokunurken dikkatli — ödüller ölçeklenebilir formüllere bağlı.

## Bağımsız repoya ayırma

Bildim kabuğun kendisiyle iç içedir (tabbar/Layout, GameCenter portalı). Bağımsızlaştırmak istenirse: `bildim/` + paylaşılan `src/` (AuthContext, supabase, Avatar, styles) + `supabase/` birlikte taşınır; `src/App.jsx` sadeleştirilip yalnız Bildim rotaları bırakılır.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Bildim oturumları) + bu klasördeki `PROGRESS.md` (modül özeti).
