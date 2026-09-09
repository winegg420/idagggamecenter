import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// KÖK UYGULAMA SEÇİMİ — aynı depo, iki site:
//   VITE_MOD tanımsız → App.jsx      (idaGG Game Center hub; quiz /bildim/* altında)
//   VITE_MOD=bildim   → BildimApp.jsx (yalnız Bildim; rotalar kökte)
// lazy kullanılıyor ki seçilmeyen taraf paketlenmesin (hub'ın 3D oyunları
// Bildim sitesinin paketine sızmasın).
const BILDIM_MOD = import.meta.env.VITE_MOD === "bildim";
const KokUygulama = lazy(() =>
  BILDIM_MOD ? import("./BildimApp.jsx") : import("./App.jsx")
);
import { AuthProvider } from "./context/AuthContext.jsx";
import HataSiniri from "./components/HataSiniri.jsx";
import { hataIzlemeKur } from "./lib/hataIzleme.js";
import "./styles.css";
// Bildim görsel dili (tema tokenları) — global stillerden SONRA yüklenir
import "../bildim/styles/tema.css";

// Hata izleme: YALNIZ VITE_SENTRY_DSN tanımlıysa kurulur. Boşsa Sentry paketi
// hiç yüklenmez ve konsola uyarı basılmaz — DSN'siz çalışmak normal durumdur.
hataIzlemeKur();

// Davet linkiyle gelindiyse sakla (girişten sonra ödül talep edilir)
const params = new URLSearchParams(window.location.search);
const davet = params.get("davet");
if (davet) {
  localStorage.setItem("bildim_davet", davet);
  params.delete("davet");
  const yeniUrl =
    window.location.pathname + (params.size ? `?${params}` : "") + window.location.hash;
  window.history.replaceState({}, "", yeniUrl);
}

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="yukleniyor">Yükleniyor…</div>}>
          <KokUygulama />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
