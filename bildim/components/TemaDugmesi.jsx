import { useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { etkinTema, temaDegistir, temayaAbone } from "../lib/tema.js";

/**
 * Üst çubuktaki açık/koyu tema düğmesi.
 * Açık temadayken ay (koyuya geç), koyu temadayken güneş (açığa dön) gösterir.
 * Tercih localStorage'da; ilk açılışta cihazın teması izlenir (bkz. lib/tema.js).
 */
export default function TemaDugmesi() {
  const [tema, setTema] = useState(() => etkinTema());

  // Cihaz teması değişirse (oyuncu telefonun gece modunu açarsa) ikon da dönsün
  useEffect(() => temayaAbone(setTema), []);

  const koyu = tema === "koyu";
  return (
    <button
      type="button"
      className="bd-tema-dugme"
      onClick={() => setTema(temaDegistir())}
      aria-label={koyu ? "Açık temaya geç" : "Koyu temaya geç"}
      title={koyu ? "Açık tema" : "Koyu tema"}
    >
      <Ikon ad={koyu ? "gunes" : "ay"} boyut={18} />
    </button>
  );
}
