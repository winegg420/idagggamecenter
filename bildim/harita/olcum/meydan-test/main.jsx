import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import HaritaSayfasi from "../../HaritaSayfasi.jsx";

// ?otomasyon: otomasyon sekmesi gizli sayıldığında rAF durur (hafıza notu: arka plan sekmesi). Yalnız bu sınama sayfasında
// kareler Worker zamanlayıcısıyla sürülür ve sayfa görünür kabul edilir. Oyun kodu değişmez.
if (new URLSearchParams(location.search).has("otomasyon")) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  const bekleyen = new Map(); let no = 0;
  const w = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),16)"])));
  w.onmessage = () => { const t = performance.now(), l = [...bekleyen.values()]; bekleyen.clear(); for (const f of l) f(t); };
  window.requestAnimationFrame = (f) => { bekleyen.set(++no, f); return no; };
  window.cancelAnimationFrame = (id) => bekleyen.delete(id);
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <HaritaSayfasi />
  </BrowserRouter>
);
