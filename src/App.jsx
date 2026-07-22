import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Eski top-level quiz yollarını yeni /bildim/* yapısına yönlendirir (parametreyi
// korur). Geriye uyumluluk: push bildirimi deep-link'leri, bookmark, eski linkler.
function BildimeYonlendir() {
  const { pathname, search } = useLocation();
  return <Navigate to={"/bildim" + pathname + search} replace />;
}
import { useAuth } from "./context/AuthContext.jsx";
import { supabaseHazir } from "./lib/supabase.js";
import Layout from "../bildim/components/Layout.jsx";

// Gladius: bağımsız oyun modülü, /gladius altında lazy yüklenir.
// Bildim quiz koduna tek dokunuş burasıdır (kod tamamen gladius/ klasöründe).
const GladiusApp = lazy(() => import("../gladius/app/GladiusApp.jsx"));
// RUN: bağımsız karanlık labirent kaçış modülü, /run altında lazy yüklenir.
const RunApp = lazy(() => import("../run/app/RunApp.jsx"));
// KAFA TOPU: 2D fizik futbol modülü, /kafatopu altında lazy yüklenir.
// Bildim oturumunu kullanır (giriş duvarının arkasındadır).
const KafaTopuApp = lazy(() => import("../kafatopu/app/KafaTopuApp.jsx"));
// MEYVE KES: kamera + el takibi (MediaPipe) meyve kesme oyunu, /meyvekes altında.
// Bildim oturumunu ve kullanıcı/avatar sistemini kullanır (giriş duvarının arkasında).
const MeyveKesApp = lazy(() => import("../meyvekes/app/MeyveKesApp.jsx"));
// PATIRUN: 2D pati yarışı (multiplayer), /patirun altında lazy yüklenir.
// Bildim oturumunu kullanır (tek kimlik); tüm kodu patirun/ klasöründe izoledir.
const PatiRunApp = lazy(() => import("../patirun/app/PatiRunApp.jsx"));
// DRIFTGP (DidaGP): 3D araba yarışı (three.js/R3F), /driftgp altında lazy yüklenir.
// Bildim oturumunu kullanır (tek kimlik); tüm kodu driftgp/ klasöründe izoledir.
const DriftGpApp = lazy(() => import("../driftgp/app/DriftGpApp.jsx"));
import Login from "./pages/Login.jsx";
import GameCenter from "./pages/GameCenter.jsx";
import Home from "../bildim/pages/Home.jsx";
import TournamentPage from "../bildim/pages/TournamentPage.jsx";
import ChallengesPage from "../bildim/pages/ChallengesPage.jsx";
import MatchPage from "../bildim/pages/MatchPage.jsx";
import GroupMatchPage from "../bildim/pages/GroupMatchPage.jsx";
import HizliMacPage from "../bildim/pages/HizliMacPage.jsx";
import LeaderboardPage from "../bildim/pages/LeaderboardPage.jsx";
import FriendsPage from "../bildim/pages/FriendsPage.jsx";
import ProfilePage from "../bildim/pages/ProfilePage.jsx";

export default function App() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();

  // Gladius ve RUN bağımsız modüllerdir: Supabase/oturum kullanmazlar,
  // bu yüzden giriş duvarının önünde açılabilirler.
  const bagimsizModul =
    pathname.startsWith("/gladius") || pathname.startsWith("/run");

  if (!supabaseHazir && !bagimsizModul) {
    return (
      <div className="giris">
        <div className="buyuk-logo">Bildim!</div>
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
    <Routes>
      <Route
        path="/gladius/*"
        element={
          <Suspense fallback={<div className="yukleniyor">Gladius yükleniyor…</div>}>
            <GladiusApp />
          </Suspense>
        }
      />
      <Route
        path="/run/*"
        element={
          <Suspense fallback={<div className="yukleniyor">RUN yükleniyor…</div>}>
            <RunApp />
          </Suspense>
        }
      />
      <Route
        path="/kafatopu/*"
        element={
          <Suspense fallback={<div className="yukleniyor">Kafa Topu yükleniyor…</div>}>
            <KafaTopuApp />
          </Suspense>
        }
      />
      <Route
        path="/meyvekes/*"
        element={
          <Suspense fallback={<div className="yukleniyor">Meyve Kes yükleniyor…</div>}>
            <MeyveKesApp />
          </Suspense>
        }
      />
      <Route
        path="/patirun/*"
        element={
          <Suspense fallback={<div className="yukleniyor">PatiRun yükleniyor…</div>}>
            <PatiRunApp />
          </Suspense>
        }
      />
      <Route
        path="/driftgp/*"
        element={
          <Suspense fallback={<div className="yukleniyor">DriftGP yükleniyor…</div>}>
            <DriftGpApp />
          </Suspense>
        }
      />
      {/* idaGG Game Center: sitenin ana giriş sayfası (oyun portalı). */}
      <Route path="/" element={<GameCenter />} />

      {/* Bildim! bilgi yarışması — tüm quiz rotaları /bildim/* altında (modül izolasyonu). */}
      <Route path="/bildim" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="turnuva" element={<TournamentPage />} />
        <Route path="meydan" element={<ChallengesPage />} />
        <Route path="mac/:id" element={<MatchPage />} />
        <Route path="grup-mac/:id" element={<GroupMatchPage />} />
        <Route path="hizli-mac/:id" element={<HizliMacPage />} />
        <Route path="siralama" element={<LeaderboardPage />} />
        <Route path="arkadaslar" element={<FriendsPage />} />
        <Route path="profil" element={<ProfilePage />} />
      </Route>

      {/* Geriye uyumluluk: eski top-level yollar → /bildim/* (parametre korunur). */}
      <Route path="/turnuva" element={<BildimeYonlendir />} />
      <Route path="/meydan" element={<BildimeYonlendir />} />
      <Route path="/mac/:id" element={<BildimeYonlendir />} />
      <Route path="/grup-mac/:id" element={<BildimeYonlendir />} />
      <Route path="/hizli-mac/:id" element={<BildimeYonlendir />} />
      <Route path="/siralama" element={<BildimeYonlendir />} />
      <Route path="/arkadaslar" element={<BildimeYonlendir />} />
      <Route path="/profil" element={<BildimeYonlendir />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
