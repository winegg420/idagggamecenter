// ============================================================
// DİL KANCASI — React tarafı
//
// `dil.js` saf mantıktır (React/DOM bilmez). Burası onu bileşenlere bağlar:
// geçerli dili çözer, TR/EN değiştiricisini uygular ve seçimi kalıcılaştırır.
//
// Kalıcılık iki yerde:
//   • localStorage — giriş yapmamış ziyaretçi için (tek yer burası)
//   • profiles.dil — giriş yapmışsa, cihazdan bağımsız olsun diye
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { DILLER, dilCoz, dilKaydet, tYap } from "./dil.js";

/**
 * @returns {{dil:string, ceviri:(a:string,d?:object)=>string, dilDegistir:(d:string)=>void}}
 */
export function useDil() {
  const { user, profile, refreshProfile } = useAuth();
  const [dil, setDil] = useState(() => dilCoz(profile));

  // Profil sonradan gelirse (giriş yapılmışsa) tercih onun.
  useEffect(() => {
    const yeni = dilCoz(profile);
    setDil((eski) => (eski === yeni ? eski : yeni));
  }, [profile]);

  const dilDegistir = useCallback(
    (yeni) => {
      if (!DILLER.includes(yeni)) return;
      setDil(yeni);
      dilKaydet(yeni);
      if (!user?.id) return;
      // Profile de yaz: oyuncu başka cihazdan girince aynı dili görsün.
      // Başarısız olursa arayüz dili yine değişmiş olur — sessizce geç.
      (async () => {
        try {
          const { error } = await supabase
            .from("profiles")
            .update({ dil: yeni })
            .eq("id", user.id);
          if (error) throw error;
          await refreshProfile?.(user.id);
        } catch (e) {
          console.error("[Dil] profile yazilamadi:", e);
        }
      })();
    },
    [user?.id, refreshProfile]
  );

  return { dil, ceviri: tYap(dil), dilDegistir };
}
