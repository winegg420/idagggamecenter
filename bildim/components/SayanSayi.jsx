import { useEffect, useRef, useState } from "react";

/**
 * Değişen bir sayıyı tek karede zıplatmak yerine sayarak gösterir.
 * (Skor 16'dan 29'a bir anda atlıyordu; artışın hissedilmesi gerekiyor.)
 *
 * deger : gösterilecek sayı
 * sure  : geçiş süresi (ms, varsayılan 300)
 *
 * prefers-reduced-motion: reduce açıksa anında yazar.
 * PuanSayaci'dan farkı: "+N" baloncuğu yok — tablo/skor gibi yerlerde
 * yalnız sayının kendisi gerekiyor.
 */
export default function SayanSayi({ deger = 0, sure = 300, className = "" }) {
  const [gosterilen, setGosterilen] = useState(deger);
  const oncekiRef = useRef(deger);
  const cerceveRef = useRef(0);

  useEffect(() => {
    const onceki = oncekiRef.current;
    oncekiRef.current = deger;
    if (onceki === deger) return;

    let azalt = false;
    try {
      azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* matchMedia yoksa animasyon açık kalsın */
    }
    if (azalt) {
      setGosterilen(deger);
      return;
    }

    const basla = performance.now();
    const adim = (simdi) => {
      const o = Math.min(1, (simdi - basla) / sure);
      const e = 1 - Math.pow(1 - o, 3); // easeOutCubic
      setGosterilen(Math.round(onceki + (deger - onceki) * e));
      if (o < 1) cerceveRef.current = requestAnimationFrame(adim);
    };
    cerceveRef.current = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(cerceveRef.current);
  }, [deger, sure]);

  useEffect(() => () => cancelAnimationFrame(cerceveRef.current), []);

  return <span className={className}>{gosterilen}</span>;
}
