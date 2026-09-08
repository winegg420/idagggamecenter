import { useEffect } from "react";

/**
 * Soru ekranı açıkken gövdeye `bd-oyun-modu` sınıfı ekler.
 * CSS bu sınıfla alt sekme çubuğunu gizler ve joker çubuğunu ekranın altına
 * sabitler — oyuncunun dikkati soruda kalsın diye.
 *
 * Kullanım: useOyunModu(soru != null)
 */
export function useOyunModu(aktif) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!aktif) return;
    document.body.classList.add("bd-oyun-modu");
    return () => document.body.classList.remove("bd-oyun-modu");
  }, [aktif]);
}
