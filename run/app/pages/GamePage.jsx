// ============================================================
// RUN — oyun sayfası. Canvas'a Motor bağlar, round sonunda sonuç + sıralama
// overlay'ini gösterir. Dokunmatik için Harita/Kılıç/Atılım/Kalkan butonları.
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Motor } from "../../engine/motor.js";
import * as ses from "../../engine/ses.js";

const DURUM_AD = { kacti: "🏃 Kaçtı", yakalandi: "🤖 Yakalandı", kaldi: "· Kaldı" };

// --- Tam ekran (webkit önekli — iOS Safari fullscreenElement'i webkit ile tutar) ---
const tamEkranEl = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;
function tamEkranIste() {
  if (tamEkranEl()) return;                  // her dokunuşta yeniden isteme (jank yapar)
  const el = document.documentElement;
  try {
    const istek = el.requestFullscreen || el.webkitRequestFullscreen;
    const p = istek?.call(el, { navigationUI: "hide" });
    p?.catch?.(() => {});
  } catch { /* desteklenmiyor (iPhone Safari) — oyun normal görünümde sürer */ }
  try { screen.orientation?.lock?.("landscape")?.catch?.(() => {}); } catch {}
}
function tamEkranCik() {
  try { screen.orientation?.unlock?.(); } catch {}
  try {
    if (tamEkranEl()) {
      const cik = document.exitFullscreen || document.webkitExitFullscreen;
      cik?.call(document)?.catch?.(() => {});
    }
  } catch {}
}

export default function GamePage() {
  const nav = useNavigate();
  const canvasRef = useRef(null);
  const motorRef = useRef(null);
  const rootRef = useRef(null);
  const dokunRef = useRef(null);
  const [sonuc, setSonuc] = useState(null);
  const [siralama, setSiralama] = useState([]);
  const [enYakin, setEnYakin] = useState(null);
  const [izleyici, setIzleyici] = useState(false);

  // İzleyici modunu yokla (yakalandıysan "İzlemeyi Geç" butonu görünsün)
  useEffect(() => {
    const id = setInterval(() => {
      const d = motorRef.current?.durum;
      setIzleyici(!!(d && d.izleyici && !d.bitti));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const basla = useCallback(() => {
    try {
      motorRef.current?.dur();
      setSonuc(null);
      const m = new Motor(canvasRef.current, {
        onBitti: (s) => {
          setSonuc(s);
          setSiralama(m.durum?.siralama || []);
          const uz = m.durum?.enYakin;
          setEnYakin(Number.isFinite(uz) ? Math.round(uz) : null);
        },
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
    window.addEventListener("touchstart", ac, { once: true });
    window.addEventListener("keydown", ac, { once: true });
    return () => {
      try { motorRef.current?.dur(); } catch {}
      try { ses.ortamDur(); } catch {}   // uğultu/vızıltı menüye taşınmasın
      window.removeEventListener("pointerdown", ac);
      window.removeEventListener("touchstart", ac);
      window.removeEventListener("keydown", ac);
    };
  }, [basla]);

  // Mobil: ilk dokunuşta tam ekran + yatay kilit; sayfadan çıkınca geri al.
  useEffect(() => {
    const dokunmatik = window.matchMedia?.("(hover: none)")?.matches;
    if (!dokunmatik) return;
    const dokun = () => tamEkranIste();
    const el = rootRef.current;
    el?.addEventListener("touchstart", dokun, { passive: true });
    return () => {
      el?.removeEventListener("touchstart", dokun);
      tamEkranCik();
    };
  }, []);

  // Ekran uykuya dalmasın (Wake Lock) + arka plana geçişte basılı girdileri temizle
  // (kaçan touchend/keyup ile "kendi kendine yürüme" olmasın).
  useEffect(() => {
    let kilit = null, aktif = true;
    const kilitAl = async () => {
      try {
        if (aktif && document.visibilityState === "visible")
          kilit = await navigator.wakeLock?.request?.("screen");
      } catch { /* desteklenmiyor/izin yok — önemli değil */ }
    };
    kilitAl();
    const gorunum = () => {
      motorRef.current?.girdi?.sifirla?.();
      if (document.visibilityState === "visible") kilitAl();
    };
    const odakKaybi = () => motorRef.current?.girdi?.sifirla?.();
    document.addEventListener("visibilitychange", gorunum);
    window.addEventListener("blur", odakKaybi);
    return () => {
      aktif = false;
      try { kilit?.release?.(); } catch {}
      document.removeEventListener("visibilitychange", gorunum);
      window.removeEventListener("blur", odakKaybi);
    };
  }, []);

  const g = () => motorRef.current?.girdi;

  // Dokunmatik beceri butonları NATIVE touch ile: iOS Safari joystick basılıyken
  // ikinci parmağın pointer olayını güvenilir iletmiyor (Kafa Topu dersi).
  // Fare/kalem için buton üzerindeki onPointerDown (touch hariç) çalışmaya devam eder.
  useEffect(() => {
    const el = dokunRef.current;
    if (!el) return;
    const eylemBasla = (ad) => {
      try { ses.devamEt(); } catch {}
      const gi = motorRef.current?.girdi;
      if (!gi) return;
      if (ad === "bakis") { try { ses.cal("ui"); } catch {} gi.dokunGenelBakis(); }
      else if (ad === "kilic") gi.dokunSopa();
      else if (ad === "dash") gi.dokunDash();
      else if (ad === "kalkan") gi.dokunKalkan();
      else if (ad === "kapi") gi.dokunKapi();
      else if (ad === "hack") gi.dokunHackBasla();
    };
    const hackParmaklar = new Set();
    const ts = (e) => {
      const b = e.target?.closest?.("button[data-eylem]");
      if (!b) return;
      e.preventDefault();                    // buton dokunuşu zoom/joystick'e karışmasın
      const ad = b.dataset.eylem;
      eylemBasla(ad);
      if (ad === "hack") for (const t of e.changedTouches) hackParmaklar.add(t.identifier);
    };
    const te = (e) => {
      for (const t of e.changedTouches) {
        if (hackParmaklar.delete(t.identifier)) motorRef.current?.girdi?.dokunHackBitir();
      }
    };
    el.addEventListener("touchstart", ts, { passive: false });
    el.addEventListener("touchend", te);
    el.addEventListener("touchcancel", te);
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchend", te);
      el.removeEventListener("touchcancel", te);
    };
  }, []);

  // Fare/kalem için buton tetikleyici (dokunuşlar native touch'tan işlenir)
  const fare = (ad) => (e) => {
    if (e.pointerType === "touch") return;
    try { ses.devamEt(); } catch {}
    const gi = g();
    if (!gi) return;
    if (ad === "bakis") { try { ses.cal("ui"); } catch {} gi.dokunGenelBakis(); }
    else if (ad === "kilic") gi.dokunSopa();
    else if (ad === "dash") gi.dokunDash();
    else if (ad === "kalkan") gi.dokunKalkan();
    else if (ad === "kapi") gi.dokunKapi();
    else if (ad === "hack") gi.dokunHackBasla();
  };

  return (
    <div className="run-oyun" ref={rootRef}>
      <canvas ref={canvasRef} className="run-canvas" />

      <div className="run-hud-ipucu">
        WASD/oklar · ⚔ Kılıç J · 💨 Atılım Shift · 🛡 Kalkan K · ⚡ Ele geçir E (basılı tut) · 🚪 Kapı Q · 🗺 Plan M
      </div>

      <div className="run-dikey-ipucu">🔄 Telefonu yan çevir — oyun yatayda tam ekran</div>

      <div className="run-dokun" ref={dokunRef}>
        <button data-eylem="bakis" onPointerDown={fare("bakis")}>🗺</button>
        <button data-eylem="kilic" onPointerDown={fare("kilic")}>⚔</button>
        <button data-eylem="dash" onPointerDown={fare("dash")}>💨</button>
        <button data-eylem="kalkan" onPointerDown={fare("kalkan")}>🛡</button>
        <button data-eylem="kapi" onPointerDown={fare("kapi")}>🚪</button>
        <button
          data-eylem="hack"
          onPointerDown={fare("hack")}
          onPointerUp={(e) => { if (e.pointerType !== "touch") g()?.dokunHackBitir(); }}
          onPointerLeave={(e) => { if (e.pointerType !== "touch") g()?.dokunHackBitir(); }}
          onPointerCancel={(e) => { if (e.pointerType !== "touch") g()?.dokunHackBitir(); }}
        >⚡</button>
      </div>

      <button className="run-cikis-btn" onClick={() => nav("/run")}>✕</button>

      {izleyici && !sonuc && (
        <button
          className="run-izleyici-gec"
          onClick={() => { const d = motorRef.current?.durum; if (d) d._izleyiciSayaci = 0.01; }}
        >▶ İzlemeyi Geç</button>
      )}

      {sonuc && (
        <div className="run-sonuc">
          <div className="run-sonuc-kart">
            <h1>{sonuc === "kacti" ? "KAÇTIN! 🏃" : "YAKALANDIN 🤖"}</h1>
            <div className="run-sonuc-alt">
              {sonuc === "kacti" ? "Tesisten kurtuldun." : "Drone seni yakaladı — round'un sonunu izledin."}
              {sonuc === "kacti" && enYakin !== null && enYakin < 120 && (
                <div className="run-azkalsin">⚡ Az kalsın! Drone'a en yakın anın: {enYakin} birim</div>
              )}
            </div>
            <table className="run-siralama">
              <tbody>
                {siralama.map((r, i) => (
                  <tr key={i} className={r.ben ? "ben" : ""}>
                    <td className="yer">{i + 1}.</td>
                    <td>{r.ad}</td>
                    <td>{DURUM_AD[r.durum] || ""}</td>
                    <td className="rz">💥{r.hurda}</td>
                    <td className="hz">💾{r.hack}</td>
                    <td className="hz">💿{r.cip || 0}</td>
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
