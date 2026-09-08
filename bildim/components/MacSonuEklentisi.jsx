import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { JOKER_BILGI } from "../lib/jokerler.js";

/**
 * Maç sonucu ekranına eklenen blok:
 *  - bu maçta kullanılan jokerler
 *  - kaybedildiyse büyük "Rövanş" butonu (son 24 saat)
 *  - güncel günlük seri
 */
export default function MacSonuEklentisi({ macTur, macId, kaybettim }) {
  const navigate = useNavigate();
  const [jokerler, setJokerler] = useState([]);
  const [seri, setSeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("joker_kullanimlari")
          .select("tur, ucretsiz, soru_index")
          .eq("mac_tur", macTur)
          .eq("mac_id", macId)
          .order("soru_index");
        if (!error && aktif) setJokerler(data ?? []);
      } catch {
        /* migration bekliyor olabilir */
      }
      try {
        const { data, error } = await supabase.rpc("seri_durumum");
        if (!error && aktif) setSeri(Array.isArray(data) ? data[0] : data);
      } catch {
        /* sessiz geç */
      }
    })();
    return () => {
      aktif = false;
    };
  }, [macTur, macId]);

  const rovans = async () => {
    setHata(null);
    setCalisiyor(true);
    try {
      const { data, error } = await supabase.rpc("rovans_iste", { p_mac_id: macId });
      if (error) throw error;
      if (data) navigate(`/bildim/mac/${data}`);
      else navigate("/bildim/meydan");
    } catch (e) {
      setHata(e.message ?? "Rövanş istenemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <div className="bd-mac-sonu-ek">
      {seri && (seri.seri_gun ?? 0) > 0 && (
        <div className="bd-sonuc-seri">
          🔥 <b>{seri.seri_gun}.</b> gün — serin sürüyor
        </div>
      )}

      {jokerler.length > 0 && (
        <div className="bd-sonuc-jokerler">
          <span className="alt-yazi">Bu maçta kullandığın jokerler:</span>
          <span className="bd-sonuc-joker-liste">
            {jokerler.map((j, i) => (
              <span key={i} className="bd-sonuc-joker">
                {JOKER_BILGI[j.tur]?.ikon ?? "❔"} {JOKER_BILGI[j.tur]?.ad ?? j.tur}
                {j.ucretsiz && <em> (ücretsiz)</em>}
              </span>
            ))}
          </span>
        </div>
      )}

      {kaybettim && macTur === "1v1" && (
        <>
          <button className="bd-rovans" disabled={calisiyor} onClick={rovans}>
            ⚔️ RÖVANŞ İSTE
          </button>
          <div className="alt-yazi" style={{ textAlign: "center", marginTop: 6 }}>
            Aynı kategoride, 24 saat içinde geçerli.
          </div>
        </>
      )}

      {hata && <div className="hata-kutu">{hata}</div>}
    </div>
  );
}
