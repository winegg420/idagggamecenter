import { useEffect, useRef } from "react";

/**
 * Sekme arka plandan geri geldiğinde (veya pencere focus aldığında) fn() çalışır.
 * Arka planda tarayıcı setInterval'leri dondurduğu ve Realtime soketini kopardığı
 * için dönüşte durumun elle tazelenmesi gerekiyor.
 *
 * MOBİL NOTU: yalnız "visibilitychange" yetmiyor.
 *  • iOS Safari sayfayı geri/ileri önbelleğine (bfcache) alıp geri getirirken
 *    çoğu zaman yalnız "pageshow" üretir.
 *  • Android'de uygulama arka plandan dönerken "focus" gelir ama
 *    visibilityState kimi sürümlerde bir tık geç güncellenir.
 * Bu yüzden üç olay birden dinleniyor. Aynı anda birkaçı tetiklenebileceği
 * için art arda gelen çağrılar 250 ms içinde teke indiriliyor.
 */
export function useGorunurlukTazele(fn, aktif = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const sonRef = useRef(0);

  useEffect(() => {
    if (!aktif) return;
    const tazele = () => {
      if (document.visibilityState !== "visible") return;
      // Üç olay aynı dönüşte tetiklenebilir; tazelemeyi bir kez çalıştır.
      const simdi = Date.now();
      if (simdi - sonRef.current < 250) return;
      sonRef.current = simdi;
      try {
        fnRef.current?.();
      } catch (e) {
        console.error("[Bildim] gorunurluk tazeleme hatasi:", e);
      }
    };
    document.addEventListener("visibilitychange", tazele);
    window.addEventListener("focus", tazele);
    window.addEventListener("pageshow", tazele);
    return () => {
      document.removeEventListener("visibilitychange", tazele);
      window.removeEventListener("focus", tazele);
      window.removeEventListener("pageshow", tazele);
    };
  }, [aktif]);
}

/**
 * Bir sözü (promise) süre sınırına bağlar.
 *
 * NEDEN: sekme arka plandayken açılan Supabase RPC'si, soket koptuğu için
 * ne çözülüyor ne reddediliyordu — sonsuza kadar askıda kalıyordu. Çağıran
 * taraf "cevap bekliyorum" diye kilitli kaldığı için oyuncu geri döndüğünde
 * ekran donuk görünüyordu. Süre dolunca reddedilirse çağıran hata yolunu
 * işletip kilidini açabiliyor ve iş yeniden denenebiliyor.
 */
export function zamanAsimiyla(soz, ms = 10000, etiket = "istek") {
  return Promise.race([
    Promise.resolve(soz),
    new Promise((_, red) =>
      setTimeout(() => red(new Error(`${etiket}: ${ms} ms icinde yanit gelmedi`)), ms)
    ),
  ]);
}
