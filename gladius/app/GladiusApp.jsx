// ============================================================
// Gladius kök bileşeni. Bildim App.jsx'ten lazy olarak /gladius/* altına
// bağlanır ve buradan sonrası tamamen Gladius'un kendi iç router'ıdır.
// Bildim'in quiz koduna hiçbir bağımlılığı yoktur (auth hariç, o da köprüyle).
// ============================================================

import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MenuPage from "./pages/MenuPage.jsx";
import ModeSelectPage from "./pages/ModeSelectPage.jsx";
import ArenaPage from "./pages/ArenaPage.jsx";
import CharacterPage from "./pages/CharacterPage.jsx";
import StubPage from "./pages/StubPage.jsx";
import { varliklariYukle } from "../lib/varliklar.js";
import "./styles/gladius.css";

export default function GladiusApp() {
  // Sprite varlıklarını (varsa) bir kez önceden yükle; yoksa kod-çizim yedeği kullanılır.
  useEffect(() => { varliklariYukle(); }, []);

  return (
    <div className="gl-root">
      <Routes>
        <Route index element={<MenuPage />} />
        <Route path="oyna" element={<ModeSelectPage />} />
        <Route path="oyna/:mod" element={<ArenaPage />} />
        <Route path="karakter" element={<CharacterPage />} />
        <Route
          path="siralama"
          element={
            <StubPage
              baslik="Sıralama / Ligler"
              ikon="🏆"
              faz="Faz 7"
              aciklama="Lig sıralaması (Çırak → İmparator), rozetler ve leaderboard burada olacak."
            />
          }
        />
        <Route
          path="arkadaslar"
          element={
            <StubPage
              baslik="Arkadaşlar"
              ikon="👥"
              faz="Faz 7"
              aciklama="Bildim arkadaş/davet altyapısıyla gruba davet burada olacak."
            />
          }
        />
        <Route
          path="ayarlar"
          element={
            <StubPage
              baslik="Ayarlar"
              ikon="⚙️"
              faz="Faz 8"
              aciklama="Ses, bildirim ve hesap ayarları burada olacak."
            />
          }
        />
        <Route path="*" element={<Navigate to="/gladius" replace />} />
      </Routes>
    </div>
  );
}
