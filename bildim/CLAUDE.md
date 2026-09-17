# CLAUDE.md — Quiz Tactics (bilgi yarışması modülü)

Bu dosya, `bildim/` modülü üzerinde çalışan Claude Code (ve diğer AI ajanları) için rehberdir. Modül, **idaGG Game Center** hub'ının (GitHub: `idagggamecenter`) bir parçasıdır ama kendi içinde bağımsız geliştirilebilir.

## Modül Özeti

**Quiz Tactics** — Türkçe bilgi yarışması (klasör adı geriye uyum için `bildim/` kaldı). Gece turnuvası, 1v1 meydan okuma, grup maçı (3-5 kişi), "Hızlı Olan Kazanır" modu, arkadaş sistemi, rütbe/XP, push bildirimi. Hub'ın quiz oyunudur (idaGP, Kafa Topu, Meyve Kes gibi bir oyun kartı).

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

## Eski gardırop dondurma (17 Eyl 2026, Paket 17 §D)

**Neden:** meydanda yeni GLB karakterler (insan · kaplan · robot) yürürken dükkân/gardırop eski kutu karakterleri gösteriyordu. Sahibi kararı: eski görünüm sistemi oyunun hiçbir yerinde görünmesin, yeni karakter sistemiyle küçük bir vitrin kurulsun. Kozmetik ekonomisi kapanmadı.

**Donduruldu (dosyalar SİLİNMEDİ, arayüzden giriş yok):**
- `bildim/avatar3d/` — Gardrop.jsx, Atolye.jsx, Meydan.jsx, Vitrin.jsx, ParcaPortresi.jsx, envanter*.js, model.js, portre.js, sahne.js … Üç HTML girişi (`gardrop.html`, `index.html` atölye, `meydan.html`) açılınca `/bildim/gorunum`'a yönlenir (her birinin `<head>`'inde tek satır). **`vite.config.js › rollupOptions.input`'a dokunulmadı.**
- `bildim/karakter/` (2B PatiRun sistemi), `bildim/components/` › GardropVitrini, KarakterPortresi, EsyaPortresi; `bildim/pages/GorunumPage.jsx` (`/gorunum-3b` → `/gorunum`), `bildim/pages/GardropaGit.jsx` (rota artık onu çağırmıyor); `bildim/harita/avatar.js`, `portre.js`, `onizleme.js`.
- **Girişi kaldırılan yerler:** üst çubuk tişört kısayolu (Layout), Dükkân › Görünüm sekmesi (GardropVitrini yerine vitrine giden kart), meydan kapısındaki "Gardıroba git" düğmesi (HaritaSayfasi), kurulum sonrası yönlendirme `/gorunum` (artık vitrin), Profil › Görünüm kartı (metin güncellendi, rota aynı).

**Veri durur:** `avatar3d_parcalar`, `avatar3d_sahip`, `karakterler`, `oyuncu_karakterleri`, `profiles.gorunum.avatar3d` — hiçbiri silinmedi/boşaltılmadı. Alınmış eşyalar hesapta; coin iadesi yok (kimse bir şey kaybetmedi). Meydan, vitrin kaydı olmayan oyuncuyu hâlâ eski `avatar3d` kaydından çizer.

**Yeni vitrin:** `bildim/vitrin/KarakterVitrini.jsx` (rota `/gorunum`) + `vitrinSahne.js` (TEK WebGL renderer; canlı önizleme ve bütün kart portreleri aynı bağlamda) — meydanın kendi `KarakterSistemi` + `MeydanAvatarlari`'sını kullanır, ikinci çizim yolu yok. Katalog `vitrin_kozmetikleri` tablosu (migration 216): her satır bir tür ya da kozmetik; `parcalar` eski parçalara eşler (sahiplik), `satis_parca` eski `avatar3d_satin_al` ile satılır (fiyat eski katalogdan), ödül eşyası (Taç, Pelerin) satılmaz. Kayıt `meydan_gorunum_kaydet(tur, koz[])` → `profiles.gorunum.harita = {tur, koz}`; `meydanAvatar.profildenGorunum` bunu eski kayıttan ÖNCE okur.

**Yeni katalog üretilince genişletme:**
1. Modeli üret (varlik/uret.mjs → karakter GLB'si, `kozmetik_<ad>`), meydanda takıldığını doğrula.
2. `meydanAvatar.js › KOZ_ANAHTARLARI`'na anahtarı ekle (ve `kozmetik.js › KOZMETIK` yuvası).
3. Yeni migration: `vitrin_kozmetikleri`'ne satır ekle ya da `'yakinda'` satırını `'aktif'`e çek; satılacaksa `avatar3d_parcalar`'a parça + fiyat ekleyip `parcalar` / `satis_parca`'ya yaz. Çakışan yuvalar `cakisir`.
4. Saç / Elbise / Alt gibi gövde yuvaları kozmetik değil gövde görünümüdür (`SETLER`, saç varyantı) — `harita` kaydına alan eklenip `profildenGorunum`'da okunmalı.

**Geri açmak (eski gardırop):** üç HTML'deki yönlendirme satırını kaldır; `src/BildimApp.jsx` ve `src/App.jsx`'te `/gorunum` rotasını `GardropaGit`'e, `/gorunum-3b`'yi `GorunumPage`'e geri bağla; Layout kısayolu ve Dükkân › Görünüm sekmesini (`GardropVitrini`) geri koy; HaritaSayfasi kapı düğmesini `GARDROP_YOLU`'na çevir. Veri zaten yerinde. Dikkat: vitrin kaydı (`gorunum.harita.koz`) meydanda eski kaydın önüne geçer — tamamen geri dönülecekse `profildenGorunum`'daki harita.koz satırını kaldır.

## İlerleme

Detaylı geçmiş: repo kökü `PROGRESS.md` (Bildim oturumları) + bu klasördeki `PROGRESS.md` (modül özeti).
