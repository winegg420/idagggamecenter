// Turnuva saatleri gösterimi (Paket 12, madde 7): sıradaki turnuvanın
// saati ve bugün kalan turnuvalar. Saat geçince etiket kendiliğinden
// ilerlesin diye 30 sn'de bir tazelenir (sayfa yeniden çizilmese de).
import { useEffect, useState } from "react";
import { bugunKalanTurnuvalar, sonrakiTurnuvaSaati, turnuvaSaatleri } from "../lib/zaman.js";

function useDakikaTiki() {
  const [, setTik] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTik((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
}

/** "22:00 TURNUVASI" */
export function TurnuvaSaatEtiketi() {
  useDakikaTiki();
  return <>{sonrakiTurnuvaSaati()} TURNUVASI</>;
}

/** "Bugün kalan: 20:00 · 22:00 · 24:00" (bittiyse yarının ilki). */
export function BugunKalanTurnuvalar({ className = "bd-turnuva-kalanlar" }) {
  useDakikaTiki();
  const kalan = bugunKalanTurnuvalar();
  return (
    <div className={className}>
      {kalan.length ? (
        <>Bugün kalan turnuvalar: <b>{kalan.join(" · ")}</b></>
      ) : (
        <>Bugünkü turnuvalar bitti · yarın ilki <b>{turnuvaSaatleri()[0]}</b></>
      )}
    </div>
  );
}
