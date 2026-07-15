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
  const { user, profile: bildimProfil } = useAuth();
  const [profil, setProfil] = useState(null);
  const [adminMi, setAdminMi] = useState(false);
  const [hata, setHata] = useState(null);
  const [cevrimici, setCevrimici] = useState([]); // oyunda çevrimiçi olanlar [{user_id, ad}]

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

  // Global çevrimiçi durumu: oyun açıkken presence kanalına kaydol.
  // Oda lobisi bu listeyle "çevrimiçi oyuncular"a davet gösterir.
  useEffect(() => {
    if (!user) return;
    const kanal = supabase.channel("kafatopu:cevrimici", {
      config: { presence: { key: user.id } },
    });
    kanal.on("presence", { event: "sync" }, () => {
      try {
        const durum = kanal.presenceState();
        setCevrimici(
          Object.entries(durum).map(([uid, kayitlar]) => ({
            user_id: uid,
            ad: kayitlar[0]?.ad ?? "Oyuncu",
          }))
        );
      } catch (e) {
        console.error("KafaTopu çevrimiçi listesi hatası:", e);
      }
    });
    kanal.subscribe(async (durum) => {
      if (durum === "SUBSCRIBED") {
        try {
          await kanal.track({ ad: bildimProfil?.username ?? "Oyuncu" });
        } catch (e) {
          console.error("KafaTopu çevrimiçi kaydı hatası:", e);
        }
      }
    });
    return () => {
      supabase.removeChannel(kanal);
    };
  }, [user, bildimProfil?.username]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <KTContext.Provider value={{ profil, setProfil, profilYukle, adminMi, user, cevrimici }}>
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
