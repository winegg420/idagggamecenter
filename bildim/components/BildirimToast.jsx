import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";
import { tt, ttSunucu } from "../lib/dil.js";

// Davet tipleri burada YOK: onları üstteki davet bandı (DavetBandi) gösterir —
// bandda "Kabul Et" butonu da var, toast aynı şeyi ikinci kez söylemesin.
const TIP_STIL = {
  arkadas_istek: { ikon: "kisiler", sinif: "bilgi", baslik: tt("Arkadaşlık isteği") },
  arkadas_kabul: { ikon: "kisiler", sinif: "bilgi", baslik: tt("Yeni arkadaş") },
  gecildin: { ikon: "grafik", sinif: "uyari", baslik: tt("Sıran düştü") },
  lige_girdin: { ikon: "sehir", sinif: "bilgi", baslik: tt("Ligdesin") },
  hafta_sonuc: { ikon: "kupa", sinif: "odul", baslik: tt("Hafta bitti") },
  seri_hatirlatma: { ikon: "ates", sinif: "uyari", baslik: tt("Serini koru") },
  // Kabul bildirimleri (Paket 24 · A.3): GİDEN davetin kabulü. Bunlar bantta çıkmaz —
  // bant GELEN daveti gösterir — bu yüzden ikisi asla aynı anda görünmez.
  meydan_kabul: { ikon: "kilic", sinif: "kabul", baslik: tt("Meydan okuman kabul edildi") },
  duello_kabul: { ikon: "kilic", sinif: "kabul", baslik: tt("Düello kabul edildi") },
  grup_kabul: { ikon: "kisiler", sinif: "kabul", baslik: tt("Grup maçın başlıyor") },
};

// Bant tarafından gösterilenler toast'a hiç girmez.
const BANTTA_GOSTERILEN = new Set(["mac_daveti", "rovans", "grup_daveti", "hizli_daveti", "duello_daveti"]);

// Kabul bildirimi ekranda daha uzun kalsın: oyun başlamıştır, kaçırılmamalı.
const KABUL_TIPLERI = new Set(["meydan_kabul", "duello_kabul", "grup_kabul"]);

const SURE = 7000;
const SURE_KABUL = 9000;

/**
 * Bildirim geldiği anda ekranın EN ÜSTÜNDE beliren şerit.
 * Alt menüdeki rozet gözden kaçtığı için eklendi; maç sırasında (oyun modu)
 * CSS ile gizlenir, oyunu bölmez.
 */
export default function BildirimToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kuyruk, setKuyruk] = useState([]);
  const [kapaniyor, setKapaniyor] = useState(false);
  const sayacRef = useRef(null);

  const kapat = useCallback(() => {
    setKapaniyor(true);
    window.setTimeout(() => {
      setKapaniyor(false);
      setKuyruk((k) => k.slice(1));
    }, 220);
  }, []);

  useEffect(() => {
    if (!user) return;
    const kanal = supabase
      .channel("bildirim-toast")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bildirimler",
          filter: `user_id=eq.${user.id}`,
        },
        (yuk) => {
          const b = yuk.new;
          if (!b || BANTTA_GOSTERILEN.has(b.tip)) return;
          setKuyruk((k) => (k.some((x) => x.id === b.id) ? k : [...k, b].slice(-4)));
        }
      )
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [user]);

  const aktif = kuyruk[0] ?? null;

  const kabulMu = aktif ? KABUL_TIPLERI.has(aktif.tip) : false;
  const sure = kabulMu ? SURE_KABUL : SURE;

  useEffect(() => {
    if (!aktif) return;
    sayacRef.current = window.setTimeout(kapat, sure);
    return () => window.clearTimeout(sayacRef.current);
  }, [aktif, kapat, sure]);

  if (!aktif) return null;

  const stil = TIP_STIL[aktif.tip] ?? { ikon: "zil", sinif: "bilgi", baslik: tt("Bildirim") };

  const git = () => {
    window.clearTimeout(sayacRef.current);
    kapat();
    if (aktif.yol) navigate(aktif.yol);
  };

  return (
    <div className={`bd-toast-kat ${kapaniyor ? "kapaniyor" : ""}`}>
      <div className={`bd-ust-toast ${stil.sinif}`} role="status">
        <span className="bd-toast-ikon"><Ikon ad={stil.ikon} boyut={20} /></span>
        <button className="bd-toast-govde" onClick={git}>
          <span className="bd-toast-baslik">{stil.baslik}</span>
          <span className="bd-toast-metin">{ttSunucu(aktif.metin)}</span>
        </button>
        {kabulMu && aktif.yol ? (
          <button className="bd-toast-git" onClick={git}>{tt("Oyuna git")}</button>
        ) : null}
        <button className="bd-toast-kapat" onClick={kapat} aria-label={tt("Kapat")}>
          <Ikon ad="carpi" boyut={15} />
        </button>
        <span className="bd-toast-sure" style={{ animationDuration: `${sure}ms` }} />
      </div>
    </div>
  );
}
