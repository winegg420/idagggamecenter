// ============================================================
// AVATAR VİTRİNİ — profilin ve dükkânın başındaki büyük 3B avatar
//
// PERFORMANS ŞARTI: meydanın sahnesi (zemin, binalar, ağaçlar) BURAYA
// YÜKLENMEZ. `bildim/harita/onizleme.js` yalnız avatarı, bir zemin diskini
// ve iki ışığı çizer ve `dunya.js`'i import etmez — böylece profil sayfası
// meydan paketini indirmez.
//
// three.js yine de ağır olduğu için modül LAZY yüklenir: sayfayı açmayan
// oyuncu indirmez. Sayfadan çıkarken sahne dispose edilir, RAF durur.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import RankBadge from "./RankBadge.jsx";
import { NADIRLIK_ETIKET } from "../lib/nadirlik.js";

/** 20 saniyede bir tur (2π / 20). */
const DONUS_HIZI = 0.314;

export default function AvatarVitrin({ ad, puan = 0, baslik = null }) {
  const kapsayiciRef = useRef(null);
  const sahneRef = useRef(null);
  const [veri, setVeri] = useState(null);      // { gorunum, katalog }
  const [nadirlik, setNadirlik] = useState("sirali");
  const [sahneHatasi, setSahneHatasi] = useState(false);

  // ---- katalog + kendi görünümüm ----
  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("esya_katalogum");
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        if (!aktif) return;
        const katalog = Array.isArray(r?.esyalar) ? r.esyalar : [];
        const gorunum = r?.gorunum && typeof r.gorunum === "object" ? r.gorunum : {};
        setVeri({ gorunum, katalog });
        const { gorunumNadirligi } = await import("../lib/nadirlik.js");
        const harita = new Map(katalog.map((e) => [e.kod, e.nadirlik]));
        if (aktif) setNadirlik(gorunumNadirligi(gorunum, harita));
      } catch (e) {
        console.error("[Bildim] vitrin verisi alinamadi:", e);
        if (aktif) setVeri({ gorunum: {}, katalog: [] });
      }
    })();
    return () => { aktif = false; };
  }, []);

  // ---- 3B sahne (lazy) ----
  useEffect(() => {
    const kapsayici = kapsayiciRef.current;
    if (!kapsayici || !veri) return undefined;
    let kapandi = false;
    let sahne = null;

    (async () => {
      try {
        const [{ onizlemeKur }, { esyaBilgisi }] = await Promise.all([
          import("../harita/onizleme.js"),
          import("../harita/esyalar.js"),
        ]);
        if (kapandi) return;
        sahne = onizlemeKur(kapsayici, {
          gorunum: veri.gorunum,
          bilgi: esyaBilgisi(veri.katalog),
          hiz: DONUS_HIZI,
        });
        sahneRef.current = sahne;
      } catch (e) {
        console.error("[Bildim] vitrin sahnesi kurulamadi:", e);
        setSahneHatasi(true);
      }
    })();

    return () => {
      kapandi = true;
      try { sahne?.yokEt(); } catch (e) { console.error("[Bildim] vitrin kapatilamadi:", e); }
      sahneRef.current = null;
    };
  }, [veri]);

  // ---- parmakla döndürme ----
  useEffect(() => {
    const kapsayici = kapsayiciRef.current;
    if (!kapsayici) return undefined;
    let suruyor = false;
    let sonX = 0;

    const bas = (e) => {
      suruyor = true;
      sonX = e.clientX;
      sahneRef.current?.dondur(false);
      try { kapsayici.setPointerCapture(e.pointerId); } catch { /* eski tarayıcı */ }
    };
    const oynat = (e) => {
      if (!suruyor) return;
      const dx = e.clientX - sonX;
      sonX = e.clientX;
      sahneRef.current?.elleDondur(dx * 0.01);
      e.preventDefault();
    };
    const birak = () => {
      if (!suruyor) return;
      suruyor = false;
      // Hareket azaltma açıksa kendiliğinden dönmeye geri DÖNMEZ.
      let azalt = false;
      try { azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* yok */ }
      if (!azalt) sahneRef.current?.dondur(true);
    };

    kapsayici.addEventListener("pointerdown", bas);
    kapsayici.addEventListener("pointermove", oynat, { passive: false });
    kapsayici.addEventListener("pointerup", birak);
    kapsayici.addEventListener("pointercancel", birak);
    kapsayici.addEventListener("pointerleave", birak);
    return () => {
      kapsayici.removeEventListener("pointerdown", bas);
      kapsayici.removeEventListener("pointermove", oynat);
      kapsayici.removeEventListener("pointerup", birak);
      kapsayici.removeEventListener("pointercancel", birak);
      kapsayici.removeEventListener("pointerleave", birak);
    };
  }, []);

  return (
    <div className="kart bd-vitrin">
      {baslik && <div className="bd-kat-baslik"><span>{baslik}</span></div>}
      <div className={`bd-vitrin-sahne bd-vitrin-${nadirlik}`} ref={kapsayiciRef}>
        {sahneHatasi && (
          <div className="bd-vitrin-sahnesiz">Cihazın 3B önizlemeyi açamıyor.</div>
        )}
      </div>
      <div className="bd-vitrin-alt">
        <div className="bd-vitrin-ad">{ad ?? "Oyuncu"}</div>
        <div className="bd-vitrin-rozetler">
          <RankBadge puan={puan} />
          <span className={`bd-nadirlik-etiket ${nadirlik}`}>{NADIRLIK_ETIKET[nadirlik]}</span>
        </div>
      </div>
    </div>
  );
}
