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

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { DILLER, aktifDil, dilCoz, dilKaydet, tYap } from "./dil.js";

/**
 * @returns {{dil:string, ceviri:(a:string,d?:object)=>string, dilDegistir:(d:string)=>void}}
 */
/** Dil değişince sayfayı bir kez yeniler (aynı hedefe ikinci kez değil). */
function sayfayiYenile(hedef) {
  try {
    const ANAHTAR = "bildim_dil_yenilendi";
    if (sessionStorage.getItem(ANAHTAR) === hedef && localStorage.getItem("bildim_dil") !== hedef) return;
    sessionStorage.setItem(ANAHTAR, hedef);
    window.location.reload();
  } catch {
    /* depolama kapalı: yenileme döngüsü riskine girme */
  }
}

export function useDil() {
  const { user, profile, refreshProfile } = useAuth();
  const [dil, setDil] = useState(() => dilCoz(profile));

  // Profil sonradan gelirse (giriş yapılmışsa) tercih onun.
  useEffect(() => {
    const yeni = dilCoz(profile);
    setDil((eski) => (eski === yeni ? eski : yeni));
    // Kancasız metinler (tt) sayfanın dilindedir; profil başka dil diyorsa
    // tarayıcıya yazıp BİR KEZ yenile. Depolama kapalıysa döngüye girme.
    const p = profile?.dil;
    if (!DILLER.includes(p) || p === aktifDil()) return;
    dilKaydet(p);
    sayfayiYenile(p);
  }, [profile]);

  const dilDegistir = useCallback(
    (yeni) => {
      if (!DILLER.includes(yeni)) return;
      const eski = aktifDil();
      setDil(yeni);
      dilKaydet(yeni);
      if (!user?.id) {
        if (eski !== yeni) sayfayiYenile(yeni);
        return;
      }
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
        if (eski !== yeni) sayfayiYenile(yeni);
      })();
    },
    [user?.id, refreshProfile]
  );

  // Dil değişmedikçe aynı fonksiyon: efekt bağımlılığında kullanılabilsin.
  const ceviri = useMemo(() => tYap(dil), [dil]);
  return { dil, ceviri, dilDegistir };
}
