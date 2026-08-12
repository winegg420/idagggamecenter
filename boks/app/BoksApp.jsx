// ============================================================
// GÖLGE BOKS kök bileşeni. Hub'ın App.jsx'inden lazy olarak /boks/* altına
// bağlanır. Hub oturumunu (Supabase auth) + kullanıcı/avatar sistemini
// kullanır; tüm oyun kodu bu klasörde izoledir ve yalnızca boks_ tablolarına
// yazar.
//
// Tercihler (duruş, eldiven, koç kişiliği, kilo) burada tek noktada yüklenir
// ve context ile tüm sayfalara dağıtılır — her sayfa ayrı ayrı sorgulamaz.
// Çevrimdışı kuyruk da burada, açılışta ve `online` olayında boşaltılır.
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { tercihYukle, tercihKaydet, kuyrukSenkron, yerelTercih } from "../lib/depo.js";
import MenuPage from "./pages/MenuPage.jsx";
import OyunPage from "./pages/OyunPage.jsx";
import AntrenorPage from "./pages/AntrenorPage.jsx";
import KariyerPage from "./pages/KariyerPage.jsx";
import SiralamaPage from "./pages/SiralamaPage.jsx";
import RehberPage from "./pages/RehberPage.jsx";
import "./styles/boks.css";

const BoksContext = createContext(null);
export function useBoks() {
  return useContext(BoksContext);
}

export default function BoksApp() {
  const { user, profile } = useAuth();
  const [tercih, setTercih] = useState(() => yerelTercih());
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const t = await tercihYukle();
        if (!iptal) setTercih(t);
      } catch (e) {
        console.warn("[Boks] Tercih yüklenemedi:", e?.message || e);
      } finally {
        if (!iptal) setHazir(true);
      }
      // Çevrimdışıyken biriken oturumları gönder.
      try {
        await kuyrukSenkron();
      } catch {
        /* internet yoksa bir sonraki denemede */
      }
    })();
    const cevrimici = () => {
      kuyrukSenkron().catch(() => {});
    };
    window.addEventListener("online", cevrimici);
    return () => {
      iptal = true;
      window.removeEventListener("online", cevrimici);
    };
  }, []);

  const tercihGuncelle = useCallback(async (yeni) => {
    setTercih((e) => ({ ...e, ...yeni }));
    await tercihKaydet(yeni);
  }, []);

  if (!user) return <Navigate to="/" replace />;

  return (
    <BoksContext.Provider value={{ user, profile, tercih, tercihGuncelle, hazir }}>
      <div className="bx-root">
        <Routes>
          <Route index element={<MenuPage />} />
          <Route path="oyun/:mod/:zorluk" element={<OyunPage />} />
          <Route path="antrenor" element={<AntrenorPage />} />
          <Route path="kariyer" element={<KariyerPage />} />
          <Route path="siralama" element={<SiralamaPage />} />
          <Route path="rehber" element={<RehberPage />} />
          <Route path="*" element={<Navigate to="/boks" replace />} />
        </Routes>
      </div>
    </BoksContext.Provider>
  );
}
