// ============================================================
// BİLDİM — BAĞIMSIZ SİTE KÖKÜ
//
// Aynı depo iki siteyi besler:
//   • VITE_MOD tanımsız  → src/App.jsx  (idaGG Game Center hub, quiz /bildim/*)
//   • VITE_MOD=bildim    → BU DOSYA     (yalnız Bildim, rotalar KÖKTE)
//
// App.jsx'e hiç dokunulmadı: hub aynen çalışmaya devam eder. Buradaki rota
// ağacı App.jsx'teki /bildim bloğunun birebir aynısıdır, yalnız kökte durur.
// Linkler bildim/lib/yol.js içindeki y() ile üretildiği için ikisi de doğru.
// ============================================================

import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { girisHedefiniAl } from "./lib/girisHedefi.js";
import { useAuth } from "./context/AuthContext.jsx";
import { supabaseHazir } from "./lib/supabase.js";
import Login from "./pages/Login.jsx";

import Layout from "../bildim/components/Layout.jsx";
import Home from "../bildim/pages/Home.jsx";
import ChallengesPage from "../bildim/pages/ChallengesPage.jsx";
import MatchPage from "../bildim/pages/MatchPage.jsx";
import GroupMatchPage from "../bildim/pages/GroupMatchPage.jsx";
import HizliMacPage from "../bildim/pages/HizliMacPage.jsx";
const TournamentPage = lazy(() => import("../bildim/pages/TournamentPage.jsx"));
const LeaderboardPage = lazy(() => import("../bildim/pages/LeaderboardPage.jsx"));
const FriendsPage = lazy(() => import("../bildim/pages/FriendsPage.jsx"));
const ProfilePage = lazy(() => import("../bildim/pages/ProfilePage.jsx"));
const DavetPage = lazy(() => import("../bildim/pages/DavetPage.jsx"));
const JokerDukkani = lazy(() => import("../bildim/pages/JokerDukkani.jsx"));
const HizliModPage = lazy(() => import("../bildim/pages/HizliModPage.jsx"));
const CalismaPage = lazy(() => import("../bildim/pages/CalismaPage.jsx"));
// Yasal metinler giriş duvarının ÖNÜNDE olmalı (Play Store + reklam ağları).
const GizlilikPage = lazy(() => import("../bildim/pages/GizlilikPage.jsx"));
const KosullarPage = lazy(() => import("../bildim/pages/KosullarPage.jsx"));

// Eski hub adresleri (/bildim/...) bu sitede köke indirilir. Bookmark, push
// bildirimi deep-link'i ve paylaşılmış davet linkleri kırılmasın diye.
function OnekiAt() {
  const { pathname, search } = useLocation();
  const kalan = pathname.replace(/^\/bildim/, "") || "/";
  return <Navigate to={kalan + search} replace />;
}

export default function BildimApp() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Giriş sonrası derin bağlantıyı geri yükle (bkz. src/lib/girisHedefi.js).
  useEffect(() => {
    if (!session || loading) return;
    const hedef = girisHedefiniAl();
    if (hedef && hedef !== pathname) navigate(hedef, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading]);

  const bagimsizModul =
    pathname.startsWith("/gizlilik") || pathname.startsWith("/kosullar");

  if (!supabaseHazir && !bagimsizModul) {
    return (
      <div className="giris">
        <div className="buyuk-logo">QuizzExam</div>
        <div className="hata-kutu">
          Supabase yapılandırması eksik. <code>.env</code> dosyasına
          VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekleyin.
        </div>
      </div>
    );
  }

  if (loading && !bagimsizModul)
    return <div className="yukleniyor">Yükleniyor…</div>;

  if (!session && !bagimsizModul) return <Login />;

  return (
    <Suspense fallback={<div className="yukleniyor">Yükleniyor…</div>}>
      <Routes>
        <Route path="/gizlilik" element={<GizlilikPage />} />
        <Route path="/kosullar" element={<KosullarPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="turnuva" element={<TournamentPage />} />
          <Route path="meydan" element={<ChallengesPage />} />
          <Route path="mac/:id" element={<MatchPage />} />
          <Route path="grup-mac/:id" element={<GroupMatchPage />} />
          <Route path="hizli-mac/:id" element={<HizliMacPage />} />
          <Route path="siralama" element={<LeaderboardPage />} />
          <Route path="arkadaslar" element={<FriendsPage />} />
          <Route path="davet/:kod" element={<DavetPage />} />
          <Route path="joker" element={<JokerDukkani />} />
          <Route path="hizli-mod" element={<HizliModPage />} />
          <Route path="calisma" element={<CalismaPage />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        {/* Geriye uyumluluk: hub adresleri → kök */}
        <Route path="/bildim/*" element={<OnekiAt />} />
        <Route path="/bildim" element={<OnekiAt />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
