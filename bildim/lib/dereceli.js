// ============================================================
// DERECELİ / SERBEST TERCİHİ (Paket 14, 3.1)
//
// Her mod iki girişlidir: Dereceli (lig puanı + tam coin) ve Serbest
// (puan yok, coin yarı). 3 mod × 2 giriş = 6 düğme yerine mod seçilir,
// üstünde tek bir "Dereceli" anahtarı durur. Son tercih hatırlanır:
//   • localStorage — anında, çevrimdışı da
//   • profiles.dereceli_tercih — başka cihazdan girince de aynı olsun
// localStorage'da kayıt varsa o önceliklidir (bu cihazdaki son dokunuş).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";

const ANAHTAR = "bildim_dereceli";

function yerelOku() {
  try {
    const v = localStorage.getItem(ANAHTAR);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* özel mod: localStorage kapalı */
  }
  return null;
}

function yerelYaz(deger) {
  try {
    localStorage.setItem(ANAHTAR, deger ? "1" : "0");
  } catch {
    /* özel mod */
  }
}

/** @returns {[boolean, (deger:boolean)=>void]} */
export function useDereceliTercih() {
  const { user, profile } = useAuth();
  const [dereceli, setDereceli] = useState(() => {
    const yerel = yerelOku();
    if (yerel !== null) return yerel;
    return profile?.dereceli_tercih ?? true;
  });

  // Bu cihazda hiç seçilmemişse profil geldiğinde onun tercihi alınır.
  useEffect(() => {
    if (yerelOku() !== null) return;
    if (typeof profile?.dereceli_tercih === "boolean") setDereceli(profile.dereceli_tercih);
  }, [profile?.dereceli_tercih]);

  const degistir = useCallback(
    (yeni) => {
      const deger = Boolean(yeni);
      setDereceli(deger);
      yerelYaz(deger);
      if (!user?.id) return;
      (async () => {
        try {
          const { error } = await supabase.rpc("dereceli_tercih_kaydet", { p_dereceli: deger });
          if (error) throw error;
        } catch (e) {
          // Profil yazılamasa da bu cihazdaki tercih geçerli — sessizce geç.
          console.error("[Bildim] dereceli tercihi kaydedilemedi:", e);
        }
      })();
    },
    [user?.id]
  );

  return [dereceli, degistir];
}
