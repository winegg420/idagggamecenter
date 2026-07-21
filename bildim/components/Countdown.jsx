import { useEffect, useState } from "react";
import { sonrakiTurnuvaZamani, geriSayim } from "../lib/zaman.js";

export default function Countdown({ onSifir }) {
  const [kalan, setKalan] = useState(() => geriSayim(sonrakiTurnuvaZamani()));

  useEffect(() => {
    const id = setInterval(() => {
      const k = geriSayim(sonrakiTurnuvaZamani());
      setKalan(k);
      if (k.toplamSn === 0 && onSifir) onSifir();
    }, 1000);
    return () => clearInterval(id);
  }, [onSifir]);

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className="geri-sayim-rakamlar">
      <div className="gs-kutu">
        <div className="deger">{pad(kalan.saat)}</div>
        <div className="etiket">SAAT</div>
      </div>
      <div className="gs-kutu">
        <div className="deger">{pad(kalan.dakika)}</div>
        <div className="etiket">DAKİKA</div>
      </div>
      <div className="gs-kutu">
        <div className="deger">{pad(kalan.saniye)}</div>
        <div className="etiket">SANİYE</div>
      </div>
    </div>
  );
}
