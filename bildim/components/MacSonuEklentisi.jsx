import { useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { JOKER_BILGI } from "../lib/jokerler.js";
import YanlisSatiri from "./YanlisSatiri.jsx";
import { y } from "../lib/yol.js";

/**
 * Maç sonucu ekranına eklenen blok:
 *  - bu maçta kullanılan jokerler
 *  - kaybedildiyse büyük "Rövanş" butonu (son 24 saat) — YALNIZ gerçek
 *    oyuncuya karşı. Bot rakipte doğrudan rövanş MatchPage'de çizilir;
 *    eskiden ikisi birden görünüyor ve oyuncu hangisine basacağını
 *    bilemiyordu (10 Eylül canlı testi).
 *  - güncel günlük seri
 */
export default function MacSonuEklentisi({ macTur, macId, kaybettim, rakipBot = false }) {
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
      if (data) navigate(y(`/mac/${data}`));
      else navigate(y("/meydan"));
    } catch (e) {
      setHata(hataMesaji(e, "Rövanş istenemedi."));
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <div className="bd-mac-sonu-ek">
      {/* Yanlışlar Hatalarım bankasına eklendi */}
      <YanlisSatiri macTur={macTur} macId={macId} />

      {seri && (seri.seri_gun ?? 0) > 0 && (
        <div className="bd-sonuc-seri">
          <Ikon ad="ates" boyut={16} /> <b>{seri.seri_gun}.</b> gün — serin sürüyor
        </div>
      )}

      {jokerler.length > 0 && (
        <div className="bd-sonuc-jokerler">
          <span className="alt-yazi">Bu maçta kullandığın jokerler:</span>
          <span className="bd-sonuc-joker-liste">
            {jokerler.map((j, i) => (
              <span key={i} className="bd-sonuc-joker">
                <Ikon ad={JOKER_BILGI[j.tur]?.ikon ?? "soru"} boyut={15} /> {JOKER_BILGI[j.tur]?.ad ?? j.tur}
                {j.ucretsiz && <em> (ücretsiz)</em>}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Rövanş İSTEĞİ yalnız gerçek oyuncuya karşı. Bot rakipte doğrudan
          rövanş MatchPage'de çizilir; ikisi aynı anda görünmez. */}
      {kaybettim && macTur === "1v1" && !rakipBot && (
        <>
          <button className="bd-rovans" disabled={calisiyor} onClick={rovans}>
            Rövanş
          </button>
          <div className="alt-yazi" style={{ textAlign: "center", marginTop: 6 }}>
            Rakibine istek gönderilir · aynı kategori · 24 saat geçerli
          </div>
        </>
      )}

      {hata && <div className="hata-kutu">{hata}</div>}
    </div>
  );
}
