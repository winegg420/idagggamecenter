/**
 * DERECELİ ANAHTARI (Paket 14, 3.1) — mod seçiminin üstünde tek anahtar.
 * Açık: lig puanı + tam coin. Kapalı (Serbest): puan yok, coin yarı.
 * Metinler dil sözlüğünde (bildim/lib/dil.js).
 */
import { useDil } from "../lib/dilKanca.js";

export default function DereceliAnahtari({ dereceli, onDegistir, className = "" }) {
  const { ceviri } = useDil();
  return (
    <div className={`bd-dereceli ${dereceli ? "acik" : "kapali"} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={dereceli}
        className="bd-dereceli-dugme"
        onClick={() => onDegistir(!dereceli)}
      >
        <span className="bd-dereceli-yazi">
          <span className="bd-dereceli-ad">{ceviri("Dereceli")}</span>
          <span className="bd-dereceli-not">
            {dereceli
              ? ceviri("Lig puanı + tam coin")
              : ceviri("Serbest — puan yok, coin yarı")}
          </span>
        </span>
        <span className="bd-dereceli-ray" aria-hidden="true">
          <span className="bd-dereceli-top" />
        </span>
      </button>
    </div>
  );
}
