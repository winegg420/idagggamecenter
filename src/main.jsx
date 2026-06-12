import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./styles.css";

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
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
