import { useEffect, useState } from "react";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { RUTBELER, rutbeBul } from "../lib/ranks.js";

/**
 * Rütbe atlanınca tam ekran kutlama gösterir.
 * Son görülen rütbe localStorage'da tutulur; puan yeni rütbeye
 * geçtiyse 3,5 saniyelik bir animasyon oynar.
 */
export default function RankUpOverlay() {
  const { user, profile } = useAuth();
  const [goster, setGoster] = useState(null); // rütbe objesi

  useEffect(() => {
    if (!user || !profile) return;
    const anahtar = `bildim_rutbe_${user.id}`;
    const yeni = rutbeBul(profile.puan);
    const eskiAd = localStorage.getItem(anahtar);
    if (eskiAd && eskiAd !== yeni.ad) {
      const eskiIdx = RUTBELER.findIndex((r) => r.ad === eskiAd);
      const yeniIdx = RUTBELER.findIndex((r) => r.ad === yeni.ad);
      if (yeniIdx > eskiIdx) {
        setGoster(yeni);
        const id = setTimeout(() => setGoster(null), 3500);
        localStorage.setItem(anahtar, yeni.ad);
        return () => clearTimeout(id);
      }
    }
    localStorage.setItem(anahtar, yeni.ad);
  }, [user, profile?.puan]);

  if (!goster) return null;

  return (
    <div className="rutbe-kutlama" onClick={() => setGoster(null)}>
      <div className="icerik">
        <div className="isiltilar">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="isilti" style={{ "--i": i }}>✨</span>
          ))}
        </div>
        <div className="buyuk-ikon">{goster.ikon}</div>
        <div className="etiket">RÜTBE ATLADIN!</div>
        <div className="rutbe-adi" style={{ color: goster.renk }}>
          {goster.ad}
        </div>
      </div>
    </div>
  );
}
