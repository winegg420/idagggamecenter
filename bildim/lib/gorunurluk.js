import { useEffect, useRef } from "react";

/**
 * Sekme arka plandan geri geldiğinde (veya pencere focus aldığında) fn() çalışır.
 * Arka planda tarayıcı setInterval'leri dondurduğu ve Realtime soketini kopardığı
 * için dönüşte durumun elle tazelenmesi gerekiyor.
 */
export function useGorunurlukTazele(fn, aktif = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!aktif) return;
    const tazele = () => {
      if (document.visibilityState !== "visible") return;
      try {
        fnRef.current?.();
      } catch (e) {
        console.error("[Bildim] gorunurluk tazeleme hatasi:", e);
      }
    };
    document.addEventListener("visibilitychange", tazele);
    window.addEventListener("focus", tazele);
    return () => {
      document.removeEventListener("visibilitychange", tazele);
      window.removeEventListener("focus", tazele);
    };
  }, [aktif]);
}
