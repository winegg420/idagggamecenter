import { useEffect, useState } from "react";

const RENKLER = ["#F2B23C", "#2FBF71", "#F7CB77", "#4A9DD9", "#E8543F"];

/**
 * Doğru cevapta kısa parçacık patlaması. Salt CSS animasyonu — kütüphane yok.
 * `prefers-reduced-motion` açıksa hiç çizilmez.
 */
export default function Konfeti({ aktif, adet = 14 }) {
  const [parcaciklar, setParcaciklar] = useState([]);

  useEffect(() => {
    if (!aktif) {
      setParcaciklar([]);
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const yeni = Array.from({ length: adet }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 260,
      y: -60 - Math.random() * 90,
      donme: (Math.random() - 0.5) * 540,
      renk: RENKLER[i % RENKLER.length],
      gecikme: Math.random() * 90,
      boyut: 6 + Math.random() * 6,
    }));
    setParcaciklar(yeni);
    const t = setTimeout(() => setParcaciklar([]), 1100);
    return () => clearTimeout(t);
  }, [aktif, adet]);

  if (parcaciklar.length === 0) return null;

  return (
    <div className="bd-konfeti" aria-hidden="true">
      {parcaciklar.map((p) => (
        <span
          key={p.id}
          style={{
            "--x": `${p.x}px`,
            "--y": `${p.y}px`,
            "--donme": `${p.donme}deg`,
            "--gecikme": `${p.gecikme}ms`,
            width: p.boyut,
            height: p.boyut * 0.6,
            background: p.renk,
          }}
        />
      ))}
    </div>
  );
}
