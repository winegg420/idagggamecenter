// KAFA TOPU — hızlı karakter seçici (yatay şerit).
// OYNA penceresinde ve oda lobisinde kullanılır: tak-seç, anında kaydedilir.
// Detaylı yetenek seçimi için Karakter sayfası ayrıca durur.

import { useEffect, useState } from "react";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import { tumRoster, fotoKafalariYukle } from "../../shared/karakterler.js";
import KafaOnizleme from "./KafaOnizleme.jsx";

export default function KafaSecici() {
  const { profil, setProfil } = useKT();
  const [roster, setRoster] = useState(tumRoster());
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    fotoKafalariYukle().then(() => setRoster(tumRoster())).catch(() => {});
  }, []);

  const sec = async (k) => {
    if (kaydediyor || profil?.kafa === k.id) return;
    setKaydediyor(true);
    try {
      const { data, error } = await supabase.rpc("kafatopu_profil_kaydet", {
        p_kafa: k.id,
        // Kurgusal karakterin yeteneği sabittir; foto kafada mevcut seçim korunur.
        p_yetenek: k.foto ? (profil?.yetenek ?? "ates_sutu") : k.yetenek,
      });
      if (error) throw error;
      if (data) setProfil(data);
    } catch (e) {
      console.error("KafaTopu hızlı kafa seçimi hatası:", e);
    } finally {
      setKaydediyor(false);
    }
  };

  return (
    <div className="kt-kafa-secici-sarici">
      <div className="kt-kafa-secici-baslik">Kafan:</div>
      <div className="kt-kafa-secici">
        {roster.map((k) => (
          <div
            key={k.id}
            className={`kt-kafa-secici-item ${profil?.kafa === k.id ? "secili" : ""}`}
            onClick={() => sec(k)}
          >
            <KafaOnizleme kafaId={k.id} genislik={56} yukseklik={72} />
            <div className="ad">{k.ad}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
