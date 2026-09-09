import { useState } from "react";
import Ikon from "./Ikon.jsx";
import { sesAcikMi, sesAyarla, sesDokunus, sesKilidiAc } from "../lib/ses.js";

/**
 * Üst çubuktaki ses aç/kapa düğmesi.
 * Tercih localStorage'da (bildim_ses), varsayılan AÇIK.
 * Açarken kısa bir dokunuş sesi çalar — düğmenin çalıştığı duyulsun.
 */
export default function SesDugmesi() {
  const [acik, setAcik] = useState(() => sesAcikMi());

  const degistir = () => {
    try {
      const yeni = !acik;
      sesAyarla(yeni);
      setAcik(yeni);
      if (yeni) {
        sesKilidiAc();
        sesDokunus();
      }
    } catch {
      /* ses motoru yoksa arayüz yine çalışsın */
    }
  };

  return (
    <button
      type="button"
      className={`bd-ses-dugme ${acik ? "" : "kapali"}`}
      onClick={degistir}
      aria-pressed={acik}
      aria-label={acik ? "Sesi kapat" : "Sesi aç"}
      title={acik ? "Sesi kapat" : "Sesi aç"}
    >
      <Ikon ad={acik ? "sesAcik" : "sesKapali"} boyut={18} />
    </button>
  );
}
