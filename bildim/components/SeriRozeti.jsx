import { useCallback, useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { supabase } from "../../src/lib/supabase.js";

/** Ana sayfa hero'sundaki günlük seri sayacı + koruma durumu. */
export default function SeriRozeti() {
  const [durum, setDurum] = useState(null);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("seri_durumum");
      if (error) throw error;
      setDurum(Array.isArray(data) ? (data[0] ?? null) : (data ?? null));
    } catch {
      setDurum(null); // migration henüz uygulanmadıysa sessiz geç
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  if (!durum) return null;

  const gun = durum.seri_gun ?? 0;
  const bugunOynadi = Boolean(durum.bugun_oynadi);
  const koruma = durum.koruma ?? 0;

  return (
    <div className={`bd-seri ${bugunOynadi ? "aktif" : "bekliyor"}`}>
      <span className="bd-seri-alev" aria-hidden="true"><Ikon ad="ates" boyut={15} /></span>
      <span className="bd-seri-govde">
        <span className="bd-seri-sayi">{gun}</span>
        <span className="bd-seri-etiket">
          {gun === 0
            ? "seri yok"
            : bugunOynadi
              ? "günlük seri"
              : "gün — bugün oynamadın!"}
        </span>
      </span>
      {koruma > 0 && (
        <span className="bd-seri-kalkan" title={`${koruma} adet seri koruma`}>
          <Ikon ad="kalkan" boyut={14} /> {koruma}
        </span>
      )}
      {durum.seri_en_uzun > gun && (
        <span className="bd-seri-rekor" title="En uzun serin">
          rekor {durum.seri_en_uzun}
        </span>
      )}
    </div>
  );
}
