// ============================================================
// RUN kök bileşeni. Bildim App.jsx'ten lazy olarak /run/* altına bağlanır;
// buradan sonrası tamamen RUN'ın kendi iç router'ıdır. Bildim quiz koduna
// bağımlılığı yoktur (auth hariç, o da köprüyle). Gladius deseninin eşi.
// ============================================================

import { Routes, Route, Navigate } from "react-router-dom";
import MenuPage from "./pages/MenuPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import "./styles/run.css";

export default function RunApp() {
  return (
    <div className="run-root">
      <Routes>
        <Route index element={<MenuPage />} />
        <Route path="oyna" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/run" replace />} />
      </Routes>
    </div>
  );
}
