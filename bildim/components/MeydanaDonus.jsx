import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Ikon from "./Ikon.jsx";
import { meydanaDonulecek } from "../harita/donus.js";
import { y } from "../lib/yol.js";

// Maç sonu ekranlarında çizilen "Meydana dön" şeridi.
//
// Yalnız MEYDANDAN girilen maçlarda görünür (bkz. harita/donus.js): ana
// menüden maça giren oyuncu normal akışta kalır. Sonuç ekranı bir süre
// okunabilsin diye dönüş hemen değil, geri sayımla yapılır; oyuncu
// isterse düğmeyle erken döner ya da "Kal"a basıp iptal eder.
const GERI_SAYIM_SN = 8;

export default function MeydanaDonus() {
  const navigate = useNavigate();
  const [donulecek] = useState(() => meydanaDonulecek());
  const [kalan, setKalan] = useState(GERI_SAYIM_SN);
  const [iptal, setIptal] = useState(false);

  useEffect(() => {
    if (!donulecek || iptal) return undefined;
    const id = setInterval(() => setKalan((k) => k - 1), 1000);
    return () => clearInterval(id);
  }, [donulecek, iptal]);

  useEffect(() => {
    if (!donulecek || iptal || kalan > 0) return;
    navigate(y("/meydan"));
  }, [donulecek, iptal, kalan, navigate]);

  if (!donulecek) return null;

  return (
    <div className="bd-meydan-donus">
      <button className="btn" onClick={() => navigate(y("/meydan"))}>
        <Ikon ad="dunya" boyut={15} /> Meydana dön
        {!iptal && kalan > 0 ? ` (${kalan})` : ""}
      </button>
      {!iptal && (
        <button className="btn ikincil kucuk" onClick={() => setIptal(true)}>
          Burada kal
        </button>
      )}
    </div>
  );
}
