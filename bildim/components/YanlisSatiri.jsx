import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Ikon from "./Ikon.jsx";
import { supabase } from "../../src/lib/supabase.js";

/**
 * Maç sonucu ekranlarında görünen küçük satır:
 *   "3 soruyu yanlış bildin — Hatalarım'a eklendi"
 * Yanlış yoksa hiçbir şey çizilmez.
 *
 * macTur: '1v1' | 'grup' | 'turnuva' | 'hizli'
 */
export default function YanlisSatiri({ macTur, macId }) {
  const [adet, setAdet] = useState(0);

  useEffect(() => {
    if (!macTur || !macId) return;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("mac_yanlis_sayim", {
          p_mac_tur: macTur,
          p_mac_id: macId,
        });
        if (error) throw error;
        if (aktif) setAdet(typeof data === "number" ? data : 0);
      } catch {
        /* migration bekliyor olabilir — satır gizli kalır */
      }
    })();
    return () => {
      aktif = false;
    };
  }, [macTur, macId]);

  if (adet <= 0) return null;

  return (
    <Link to="/bildim/calisma" className="bd-yanlis-satiri">
      <span className="bd-mod-ikon hatalarim">
        <Ikon ad="kitap" boyut={16} />
      </span>
      <span className="metin">
        <b>{adet} soruyu</b> yanlış bildin — Hatalarım'a eklendi
      </span>
      <span className="ok" aria-hidden="true">›</span>
    </Link>
  );
}
