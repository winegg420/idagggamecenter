// ============================================================
// RUN — oyun sayfası. Canvas'a Motor bağlar, round sonunda sonuç + sıralama
// overlay'ini gösterir. Dokunmatik için Harita/Sopa/Kalkan butonları.
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Motor } from "../../engine/motor.js";
import * as ses from "../../engine/ses.js";

const DURUM_AD = { kacti: "🏃 Kaçtı", yakalandi: "🤖 Yakalandı", kaldi: "· Kaldı" };

export default function GamePage() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const motorRef = useRef(null);
  const [sonuc, setSonuc] = useState(null);
  const [siralama, setSiralama] = useState([]);

  const basla = useCallback(() => {
    try {
      motorRef.current?.dur();
      setSonuc(null);
      const m = new Motor(canvasRef.current, {
        onBitti: (s) => { setSonuc(s); setSiralama(m.durum?.siralama || []); },
      });
      m.basla();
      motorRef.current = m;
    } catch (err) {
      console.error("[RUN] motor başlatma hatası:", err);
    }
  }, []);

  useEffect(() => {
    basla();
    const ac = () => { try { ses.devamEt(); } catch {} };
    window.addEventListener("pointerdown", ac, { once: true });
    window.addEventListener("keydown", ac, { once: true });
    return () => {
      try { motorRef.current?.dur(); } catch {}
      window.removeEventListener("pointerdown", ac);
      window.removeEventListener("keydown", ac);
    };
  }, [basla]);

  const g = () => motorRef.current?.girdi;

  return (
    <div className="run-oyun">
      <canvas ref={canvasRef} className="run-canvas" />

      <div className="run-hud-ipucu">
        WASD/oklar · 🦇 Sopa J · 🛡 Kalkan K · 🗺 Harita M
      </div>

      <div className="run-dokun">
        <button onPointerDown={() => { ses.devamEt(); ses.cal("ui"); g()?.dokunGenelBakis(); }}>🗺</button>
        <button onPointerDown={() => { ses.devamEt(); g()?.dokunSopa(); }}>🦇</button>
        <button onPointerDown={() => { ses.devamEt(); g()?.dokunKalkan(); }}>🛡</button>
      </div>

      <button className="run-cikis-btn" onClick={() => nav("/run")}>✕</button>

      {sonuc && (
        <div className="run-sonuc">
          <div className="run-sonuc-kart">
            <h1>{sonuc === "kacti" ? "KAÇTIN! 🏃" : "YAKALANDIN 🤖"}</h1>
            <div className="run-sonuc-alt">
              {sonuc === "kacti" ? "Tesisten kurtuldun." : "Drone seni yakaladı — round'un sonunu izledin."}
            </div>
            <table className="run-siralama">
              <tbody>
                {siralama.map((r, i) => (
                  <tr key={i} className={r.ben ? "ben" : ""}>
                    <td className="yer">{i + 1}.</td>
                    <td>{r.ad}</td>
                    <td>{DURUM_AD[r.durum] || ""}</td>
                    <td className="rz">💰{r.sat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="run-sonuc-btnler">
              <button className="run-oyna-btn" onClick={basla}>↻ Tekrar</button>
              <button className="run-geri-btn" onClick={() => nav("/run")}>Menü</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
