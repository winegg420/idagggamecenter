import { useEffect } from "react";
import Maskot from "./Maskot.jsx";
import PuanSayaci from "./PuanSayaci.jsx";
import { sesSureDoldu } from "../lib/ses.js";

/**
 * Maç/tur bitişinde araya giren 0.8 sn'lik geçiş ekranı.
 *
 * Neden: süre 0'a inince ekran donuk kalıp birkaç saniye sonra sonuç ekranına
 * atlıyordu; kullanıcı "dondu mu?" diye düşünüyordu. Bu perde bitişi
 * duyurup skoru sayarak boşluğu doldurur.
 *
 * baslik : "Süre doldu!" / "Maç bitti!" gibi
 * skor   : sayacın göstereceği değer (yoksa gizlenir)
 * skorEtiket : skorun altındaki açıklama
 * onBitti: perde kapanınca çağrılır (sonuç ekranına geçiş)
 * sure   : ms (varsayılan 800)
 */
export default function SureDolduGecis({
  baslik = "Süre doldu!",
  skor = null,
  skorEtiket = "doğru",
  onBitti,
  sure = 800,
}) {
  useEffect(() => {
    try {
      sesSureDoldu();
    } catch {
      /* ses çalınamadı — geçiş yine de görünür */
    }
    const t = setTimeout(() => onBitti?.(), sure);
    return () => clearTimeout(t);
  }, [onBitti, sure]);

  return (
    <div className="bd-sure-doldu" role="status" aria-live="polite">
      <Maskot poz="dusunuyor" boyut={92} />
      <div className="bd-sure-doldu-baslik">{baslik}</div>
      {skor !== null && (
        <div className="bd-sure-doldu-skor">
          <PuanSayaci deger={skor} sure={600} />
          <span>{skorEtiket}</span>
        </div>
      )}
    </div>
  );
}
