import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { supabaseHazir } from "./lib/supabase.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import TournamentPage from "./pages/TournamentPage.jsx";
import ChallengesPage from "./pages/ChallengesPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import GroupMatchPage from "./pages/GroupMatchPage.jsx";
import HizliMacPage from "./pages/HizliMacPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import FriendsPage from "./pages/FriendsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

export default function App() {
  const { session, loading } = useAuth();

  if (!supabaseHazir) {
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

  if (loading) return <div className="yukleniyor">Yükleniyor…</div>;

  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/turnuva" element={<TournamentPage />} />
        <Route path="/meydan" element={<ChallengesPage />} />
        <Route path="/mac/:id" element={<MatchPage />} />
        <Route path="/grup-mac/:id" element={<GroupMatchPage />} />
        <Route path="/hizli-mac/:id" element={<HizliMacPage />} />
        <Route path="/siralama" element={<LeaderboardPage />} />
        <Route path="/arkadaslar" element={<FriendsPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
