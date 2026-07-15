// ============================================================
// KAFA TOPU kök bileşeni. Bildim App.jsx'ten lazy olarak /kafatopu/*
// altına bağlanır. Bildim oturumunu (Supabase auth) kullanır ama tüm
// oyun kodu bu klasörde izoledir; kafatopu_ tabloları dışına yazmaz.
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { fotoKafalariYukle } from "../shared/karakterler.js";
import { arkaplanYukle } from "../engine/render.js";
import MenuPage from "./pages/MenuPage.jsx";
import KarakterPage from "./pages/KarakterPage.jsx";
import KuyrukPage from "./pages/KuyrukPage.jsx";
import OdaPage from "./pages/OdaPage.jsx";
import MacPage from "./pages/MacPage.jsx";
import SiralamaPage from "./pages/SiralamaPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import "./styles/kafatopu.css";

const KTContext = createContext(null);
export function useKT() {
  return useContext(KTContext);
}

export default function KafaTopuApp() {
  const { user } = useAuth();
  const [profil, setProfil] = useState(null);
  const [adminMi, setAdminMi] = useState(false);
  const [hata, setHata] = useState(null);

  const profilYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_profil_al");
      if (error) throw error;
      setProfil(data);
    } catch (e) {
      console.error("KafaTopu profil hatası:", e);
      setHata("Profil yüklenemedi. Veritabanı migration'ı uygulanmamış olabilir.");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    profilYukle();
    // Admin kontrolü sunucuda yapılır (sabit geliştirici hesabı).
    supabase
      .rpc("kafatopu_admin_mi")
      .then(({ data, error }) => {
        if (!error) setAdminMi(Boolean(data));
      })
      .catch((e) => console.error("KafaTopu admin kontrol hatası:", e));
    // Görsel varlıkları önden yükle (yoksa kod-çizim yedeği kullanılır).
    fotoKafalariYukle().catch(() => {});
    arkaplanYukle().catch(() => {});
  }, [user, profilYukle]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <KTContext.Provider value={{ profil, setProfil, profilYukle, adminMi, user }}>
      <div className="kt-root">
        {hata && <div className="kt-hata-banner">{hata}</div>}
        <Routes>
          <Route index element={<MenuPage />} />
          <Route path="karakter" element={<KarakterPage />} />
          <Route path="kuyruk/:mod/:tur" element={<KuyrukPage />} />
          <Route path="oda/:kod" element={<OdaPage />} />
          <Route path="mac/:id" element={<MacPage />} />
          <Route path="siralama" element={<SiralamaPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/kafatopu" replace />} />
        </Routes>
      </div>
    </KTContext.Provider>
  );
}
