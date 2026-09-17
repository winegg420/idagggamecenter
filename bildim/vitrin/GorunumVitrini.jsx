// ============================================================
// DÜKKÂN › GÖRÜNÜM — kozmetik vitrini (Paket 19 §D)
//
// Satın alma BURADA DEĞİL, tek yerde: /gorunum (KarakterVitrini). Bu sekme yalnız vitrin: katalog (vitrin_katalogum)
// kartlar hâlinde — oyuncunun kendi karakteri üstünde portre + ad + durum; karta dokununca vitrine gider.
// Durum dili vitrinle birebir: fiyat · "Sahipsin" · "Satılmaz · turnuva ödülü" · "Yakında".
// Portreler vitrinin TEK renderer'lı sahnesinden (canli:false — tuval sayfaya eklenmez, döngü dönmez): kart başına
// yeni WebGL bağlamı açılmaz (tarayıcı bağlam sınırı ~16).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { tt } from "../lib/dil.js";
import { y } from "../lib/yol.js";
import { profildenGorunum } from "../harita/karakter/meydanAvatar.js";
import "./vitrin.css";

const KADRAJ = { pelerin: "sirt", kanat: "sirt" };

export default function GorunumVitrini() {
  const { profile } = useAuth();
  const tohum = profile?.gorunen_ad ?? "";
  const [katalog, setKatalog] = useState(null);
  const [temel, setTemel] = useState(null);
  const [portreler, setPortreler] = useState({});
  const [hata, setHata] = useState(null);
  const sahneRef = useRef(null);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const [{ data: k, error: e1 }, { data: g, error: e2 }] = await Promise.all([
          supabase.rpc("vitrin_katalogum"),
          supabase.rpc("esya_katalogum"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (!aktif) return;
        const gr = (Array.isArray(g) ? g[0] : g)?.gorunum;
        setKatalog(k);
        setTemel(gr && typeof gr === "object" ? gr : {});
      } catch (e) {
        console.error("[Dükkân › Görünüm] katalog alınamadı:", e);
        if (aktif) setHata(hataMesaji(e, tt("Vitrin yüklenemedi.")));
      }
    })();
    return () => { aktif = false; };
  }, []);

  const kozmetikler = useMemo(() => (katalog?.kalemler ?? []).filter((x) => x.grup === "kozmetik"), [katalog]);
  const tur = useMemo(() => (temel ? temel.harita?.tur ?? profildenGorunum(temel, tohum).tur ?? "insan" : "insan"), [temel, tohum]);

  // portreler: tek renderer, sırayla, her biri ayrı karede
  useEffect(() => {
    if (!temel || !kozmetikler.length) return undefined;
    let iptal = false, sahne = null;
    (async () => {
      try {
        const { vitrinSahnesiKur } = await import("./vitrinSahne.js");
        if (iptal) return;
        sahne = await vitrinSahnesiKur(null, { tohum, canli: false });
        if (iptal) { sahne.yokEt(); return; }
        sahneRef.current = sahne;
        for (const k of kozmetikler.filter((x) => x.durum === "aktif")) {
          if (iptal) return;
          await new Promise((r) => requestAnimationFrame(r));
          const url = sahne.portre({ ...temel, harita: { tur, koz: { [k.kod]: k.kod === "pelerin" ? "klasik" : true } } }, { kadraj: KADRAJ[k.kod] ?? "bas", boyut: 192 });
          if (url && !iptal) setPortreler((p) => ({ ...p, [k.kod]: url }));
        }
      } catch (e) {
        console.error("[Dükkân › Görünüm] portreler çizilemedi:", e);
      }
    })();
    return () => { iptal = true; sahneRef.current = null; try { sahne?.yokEt(); } catch (e) { console.error("[Dükkân › Görünüm] sahne kapatılamadı:", e); } };
  }, [temel, kozmetikler, tur, tohum]);

  const durum = (k) => {
    if (k.durum === "yakinda") return <span className="bd-vitrin-kilit"><Ikon ad="kilit" boyut={14} /> {tt("Yakında")}</span>;
    if (k.sahip) return <span className="bd-vitrin-rozet">{tt("Sahipsin")}</span>;
    if (k.odul) return <span className="bd-vitrin-kilit"><Ikon ad="kilit" boyut={14} /> {tt("Satılmaz · turnuva ödülü")}</span>;
    return <span className="bd-vitrin-fiyat">{k.fiyat ? tt("{0} coin", { 0: Number(k.fiyat).toLocaleString(document.documentElement.lang || "tr") }) : tt("Ücretsiz")}</span>;
  };

  return (
    <div className="kart bd-gorunum-vitrini">
      <div className="bd-kat-baslik"><span>{tt("Kozmetikler")}</span></div>
      <div className="alt-yazi" style={{ marginBottom: 10 }}>{tt("Karakterinin üstünde nasıl durduğunu gör. Denemek ve satın almak için karta dokun.")}</div>
      {hata && <div className="hata-kutu">{hata}</div>}
      {!katalog && !hata && <div className="alt-yazi">{tt("Vitrin hazırlanıyor…")}</div>}
      <div className="bd-vitrin-izgara">
        {kozmetikler.map((k) => (
          <Link key={k.kod} to={y("/gorunum")} className={`bd-vitrin-kart bd-vitrin-kart-link ${k.durum === "yakinda" ? "yakinda" : ""}`} aria-label={tt(k.ad)}>
            <span className="bd-vitrin-portre">
              {k.durum === "yakinda" ? <Ikon ad="kilit" boyut={28} /> : portreler[k.kod] ? <img src={portreler[k.kod]} alt="" /> : null}
            </span>
            <span className="ad">{tt(k.ad)}</span>
            {durum(k)}
          </Link>
        ))}
      </div>
      <Link to={y("/gorunum")} className="btn" style={{ marginTop: 14 }}>
        <Ikon ad="tisort" boyut={18} /> {tt("Karakterime git")}
      </Link>
    </div>
  );
}
