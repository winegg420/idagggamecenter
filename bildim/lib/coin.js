// ============================================================
// COIN — bakiye okuma ve ortak yardımcılar
//
// Bakiye SUNUCUDA tutulur; istemci yalnız okur. `profiles` tablosuna
// doğrudan select izni olmadığı için bakiye `coin_bakiyem()` RPC'sinden gelir.
//
// Tek bir olay yayını var: bir harcama/kazanç sonrası `coinTazele()` çağrılır,
// bakiyeyi gösteren her yer (üst çubuk hapı, dükkân) kendini yeniler.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";

const OLAY = "bildim-coin-degisti";

/** Bakiyeyi gösteren tüm bileşenlere "yeniden oku" der. */
export function coinTazele() {
  try {
    window.dispatchEvent(new Event(OLAY));
  } catch {
    /* pencere yok (SSR) */
  }
}

/**
 * Coin bakiyesi + son hareketler.
 * @returns {{bakiye:number|null, hareketler:Array, yukleniyor:boolean, tazele:() => void}}
 */
export function useCoin() {
  const [bakiye, setBakiye] = useState(null);
  const [hareketler, setHareketler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const oku = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("coin_bakiyem");
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      setBakiye(Number(r?.bakiye ?? 0));
      setHareketler(Array.isArray(r?.hareketler) ? r.hareketler : []);
    } catch (e) {
      // Migration henüz uygulanmadıysa ya da ağ koptuysa hap gizli kalır;
      // oyun akışı bundan etkilenmez.
      console.error("[Bildim] coin bakiyesi alinamadi:", e);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    oku();
    window.addEventListener(OLAY, oku);
    return () => window.removeEventListener(OLAY, oku);
  }, [oku]);

  return { bakiye, hareketler, yukleniyor, tazele: oku };
}

/** Sunucu hata metnini kullanıcıya uygun hâle getirir. */
export function coinHatasi(e) {
  const m = String(e?.message ?? e ?? "");
  if (m.includes("Yetersiz coin")) return "Coin yetmiyor";
  return m || "İşlem tamamlanamadı";
}
