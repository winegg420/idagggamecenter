import { useEffect, useRef, useState } from "react";

/**
 * Puan değişince sayıyı yumuşakça sayan gösterge (mikro etkileşim).
 * Artışta kısa bir "+N" baloncuğu gösterir. Hareket azaltma tercihine saygılıdır.
 */
export default function PuanSayaci({ deger = 0, sure = 700 }) {
  const [gosterilen, setGosterilen] = useState(deger);
  const [artis, setArtis] = useState(null);
  const oncekiRef = useRef(deger);
  const cerceveRef = useRef(0);

  useEffect(() => {
    const onceki = oncekiRef.current;
    oncekiRef.current = deger;
    if (onceki === deger) return;

    const azalt =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (deger > onceki) {
      setArtis(deger - onceki);
      const t = setTimeout(() => setArtis(null), 1400);
      if (azalt) {
        setGosterilen(deger);
        return () => clearTimeout(t);
      }
      const basla = performance.now();
      const adim = (simdi) => {
        const o = Math.min(1, (simdi - basla) / sure);
        // easeOutCubic
        const e = 1 - Math.pow(1 - o, 3);
        setGosterilen(Math.round(onceki + (deger - onceki) * e));
        if (o < 1) cerceveRef.current = requestAnimationFrame(adim);
      };
      cerceveRef.current = requestAnimationFrame(adim);
      return () => {
        clearTimeout(t);
        cancelAnimationFrame(cerceveRef.current);
      };
    }

    setGosterilen(deger);
  }, [deger, sure]);

  useEffect(() => () => cancelAnimationFrame(cerceveRef.current), []);

  return (
    <span className="bd-puan-sayac">
      {gosterilen}
      {artis != null && <span className="bd-puan-artis">+{artis}</span>}
    </span>
  );
}
