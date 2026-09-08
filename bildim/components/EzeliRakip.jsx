import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import Avatar from "../../src/components/Avatar.jsx";

/** "Ezeli rakibin" kartı — en çok karşılaştığın oyuncu (en az 3 maç). */
export default function EzeliRakip() {
  const navigate = useNavigate();
  const [rakip, setRakip] = useState(null);
  const [hata, setHata] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("ezeli_rakip");
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        if (aktif) setRakip(r ?? null);
      } catch {
        if (aktif) setRakip(null);
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  if (!rakip) return null;

  const meydanOku = async () => {
    setHata(null);
    setCalisiyor(true);
    try {
      const { data, error } = await supabase.rpc("create_challenge", {
        p_rakip: rakip.user_id,
        p_kategori: null,
      });
      if (error) throw error;
      if (data) navigate(`/bildim/mac/${data}`);
    } catch (e) {
      setHata(e.message ?? "Meydan okuma başlatılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  const onde = rakip.galibiyet > rakip.maglubiyet;
  const berabere = rakip.galibiyet === rakip.maglubiyet;

  return (
    <div className="kart bd-ezeli">
      <div className="bd-kat-baslik">
        <span>⚔️ Ezeli rakibin</span>
        <span className="alt-yazi">{rakip.toplam} maç</span>
      </div>
      <div className="bd-ezeli-govde">
        <Avatar profile={rakip} boyut={46} />
        <div className="bd-ezeli-bilgi">
          <div className="bd-ezeli-ad">{rakip.gorunen_ad}</div>
          <div className="bd-ezeli-skor">
            <b className={onde ? "ust" : ""}>{rakip.galibiyet}</b>
            <span>—</span>
            <b className={!onde && !berabere ? "alt" : ""}>{rakip.maglubiyet}</b>
            {rakip.beraberlik > 0 && (
              <span className="bd-ezeli-berabere">({rakip.beraberlik} berabere)</span>
            )}
          </div>
          <div className="alt-yazi">
            {onde ? "Öndesin, arayı aç." : berabere ? "Başa baş." : "Geridesin, hesap sor."}
          </div>
        </div>
        <button className="btn kucuk" disabled={calisiyor} onClick={meydanOku}>
          {calisiyor ? "…" : "Meydan oku"}
        </button>
      </div>
      {hata && <div className="hata-kutu" style={{ marginTop: 8 }}>{hata}</div>}
    </div>
  );
}
