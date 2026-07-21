// ============================================================
// MEYVE KES kök bileşeni. Bildim App.jsx'ten lazy olarak /meyvekes/*
// altına bağlanır. Bildim oturumunu (Supabase auth) + kullanıcı/avatar
// sistemini kullanır; tüm oyun kodu bu klasörde izoledir ve yalnızca
// meyvekes_ tablolarına yazar.
// ============================================================

import { createContext, useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../src/context/AuthContext.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OyunPage from "./pages/OyunPage.jsx";
import SiralamaPage from "./pages/SiralamaPage.jsx";
import "./styles/meyvekes.css";

const MKContext = createContext(null);
export function useMK() {
  return useContext(MKContext);
}

export default function MeyveKesApp() {
  const { user, profile } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  return (
    <MKContext.Provider value={{ user, profile }}>
      <div className="mk-root">
        <Routes>
          <Route index element={<MenuPage />} />
          <Route path="oyun/:mod" element={<OyunPage />} />
          <Route path="siralama" element={<SiralamaPage />} />
          <Route path="*" element={<Navigate to="/meyvekes" replace />} />
        </Routes>
      </div>
    </MKContext.Provider>
  );
}
