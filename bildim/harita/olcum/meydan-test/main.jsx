import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import HaritaSayfasi from "../../HaritaSayfasi.jsx";

// ?otomasyon: otomasyon sekmesi gizli sayıldığında rAF durur (hafıza notu: arka plan sekmesi). Yalnız bu sınama sayfasında
// kareler Worker zamanlayıcısıyla sürülür ve sayfa görünür kabul edilir. Oyun kodu değişmez.
if (new URLSearchParams(location.search).has("otomasyon")) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  const bekleyen = new Map(); let no = 0;
  const w = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),16)"])));
  let durdu = false, sanal = 0;
  const kos = (t) => { const l = [...bekleyen.values()]; bekleyen.clear(); for (const f of l) f(t); };
  w.onmessage = () => { if (!durdu) kos(performance.now()); };
  // Ölçüm (README sabitleri): döngü durdurulur, kareler elle sürülür → sayfanın gerçek çizim() karesi + gl.finish süresi
  window.__kare = {
    durdur: () => { durdu = true; sanal = performance.now(); },
    devam: () => { durdu = false; },
    async olc({ gl, isinma = 120, ornek = 300 }) {
      const bir = () => { sanal += 1000 / 60; kos(sanal); gl.finish(); };
      for (let i = 0; i < isinma; i++) bir();
      const o = [];
      for (let i = 0; i < ornek; i++) { const t0 = performance.now(); bir(); o.push(performance.now() - t0); }
      o.sort((x, y) => x - y);
      const q = (p) => +o[Math.min(o.length - 1, Math.floor(p * (o.length - 1) + 0.5))].toFixed(2);
      return { medyan: q(0.5), p95: q(0.95) };
    },
  };
  window.requestAnimationFrame = (f) => { bekleyen.set(++no, f); return no; };
  window.cancelAnimationFrame = (id) => bekleyen.delete(id);
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <HaritaSayfasi />
  </BrowserRouter>
);
