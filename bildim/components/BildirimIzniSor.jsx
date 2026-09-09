import { useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { pushDestekleniyor, bildirimleriAc } from "../lib/push.js";

const DEPO = "bildim_bildirim_sorma";

/**
 * Bildirim izni ilk açılışta DEĞİL, ilk maç sonucu ekranında sorulur.
 * (Oyuncu oyunu görmeden izin istemek reddedilme oranını artırıyordu.)
 * Reddedilirse bir daha gösterilmez.
 */
export default function BildirimIzniSor() {
  const [goster, setGoster] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    if (!pushDestekleniyor()) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DEPO)) return;
    } catch {
      /* özel mod */
    }
    setGoster(true);
  }, []);

  if (!goster) return null;

  const kapat = () => {
    try {
      localStorage.setItem(DEPO, "1");
    } catch {
      /* özel mod */
    }
    setGoster(false);
  };

  return (
    <div className="bd-izin-kart">
      <div className="ikon" aria-hidden="true"><Ikon ad="zil" boyut={22} /></div>
      <div className="govde">
        <div className="bd-izin-baslik">Bir sonraki maçı kaçırma</div>
        <div className="alt-yazi">
          Sana meydan okunduğunda, turnuva başladığında ve haftalık lig
          sonuçlandığında haber verelim mi?
        </div>
      </div>
      <div className="bd-izin-butonlar">
        <button
          className="btn kucuk"
          disabled={calisiyor}
          onClick={async () => {
            setCalisiyor(true);
            try {
              await bildirimleriAc();
            } catch {
              /* kullanıcı reddetti */
            } finally {
              kapat();
            }
          }}
        >
          Bildirimleri aç
        </button>
        <button className="btn kucuk ikincil" onClick={kapat}>
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
