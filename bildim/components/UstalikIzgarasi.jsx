import { useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { supabase } from "../../src/lib/supabase.js";
import { kategoriEtiket } from "../lib/kategoriler.js";
import { JOKER_BILGI } from "../lib/jokerler.js";

const SEVIYE_RENK = {
  "Çırak": "#9aa0b5",
  "Kalfa": "#4ade80",
  "Usta": "#38bdf8",
  "Üstat": "#c084fc",
  "Efsane": "#fbbf24",
};

/** Profil sayfası: kategori ustalığı, en uzun seri ve joker istatistikleri. */
export default function UstalikIzgarasi() {
  const [seviyeler, setSeviyeler] = useState([]);
  const [seri, setSeri] = useState(null);
  const [envanter, setEnvanter] = useState([]);
  const [istatistik, setIstatistik] = useState(null);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const [u, s, e] = await Promise.all([
          supabase.rpc("ustalik_seviyelerim"),
          supabase.rpc("seri_durumum"),
          supabase.rpc("envanterim"),
        ]);
        if (!aktif) return;
        if (!u.error) setSeviyeler(u.data ?? []);
        if (!s.error) setSeri(Array.isArray(s.data) ? s.data[0] : s.data);
        if (!e.error) setEnvanter(e.data ?? []);
      } catch {
        /* migration bekliyor olabilir */
      }
      try {
        const { data, error } = await supabase
          .from("joker_islemleri")
          .select("tur, delta, kaynak");
        if (!error && aktif) {
          const kullanilan = (data ?? [])
            .filter((x) => x.kaynak === "kullanim")
            .reduce((t, x) => t + Math.abs(x.delta), 0);
          const kazanilan = (data ?? [])
            .filter((x) => x.delta > 0)
            .reduce((t, x) => t + x.delta, 0);
          const reklam = (data ?? []).filter((x) => x.kaynak === "reklam").length;
          setIstatistik({ kullanilan, kazanilan, reklam });
        }
      } catch {
        /* sessiz geç */
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  const toplamDogru = seviyeler.reduce((t, s) => t + (s.dogru_sayisi ?? 0), 0);

  return (
    <>
      {/* ---------- Seri + joker istatistikleri ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>Seri ve jokerler</span></div>
        <div className="bd-istatistik-grid">
          <div>
            <b>{seri?.seri_gun ?? 0}</b>
            <span>güncel seri</span>
          </div>
          <div>
            <b>{seri?.seri_en_uzun ?? 0}</b>
            <span>en uzun seri</span>
          </div>
          <div>
            <b>{istatistik?.kullanilan ?? 0}</b>
            <span>kullanılan joker</span>
          </div>
          <div>
            <b>{istatistik?.reklam ?? 0}</b>
            <span>izlenen video</span>
          </div>
        </div>
        {envanter.length > 0 && (
          <div className="bd-envanter-satir">
            {envanter.map((e) => (
              <span key={e.tur} className="bd-envanter-cip">
                <Ikon ad={JOKER_BILGI[e.tur]?.ikon ?? "soru"} boyut={15} /> {e.adet}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Kategori ustalığı ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Kategori ustalığı</span>
          <span className="alt-yazi">{toplamDogru} doğru</span>
        </div>

        {seviyeler.length === 0 ? (
          <div className="alt-yazi">Henüz veri yok — birkaç maç oyna.</div>
        ) : (
          <div className="bd-ustalik-liste">
            {seviyeler.map((s) => {
              const renk = SEVIYE_RENK[s.seviye] ?? "var(--text-dim)";
              return (
                <div key={s.kategori} className="bd-ustalik-satir">
                  <div className="bd-ustalik-ust">
                    <span className="bd-ustalik-ad">{kategoriEtiket(s.kategori)}</span>
                    <span className="bd-ustalik-seviye" style={{ color: renk }}>
                      {s.seviye ?? "—"}
                    </span>
                  </div>
                  <div className="bd-ustalik-bar">
                    <div
                      className="dolgu"
                      style={{ width: `${s.ilerleme ?? 0}%`, background: renk }}
                    />
                  </div>
                  <div className="bd-ustalik-alt alt-yazi">
                    {s.dogru_sayisi} doğru
                    {s.sonraki_esik
                      ? ` · ${s.sonraki_seviye} için ${s.sonraki_esik - s.dogru_sayisi} kaldı`
                      : " · en üst seviye"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
