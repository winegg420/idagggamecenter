// ============================================================
// MAÇ NABZI — eş zamanlı maçların ortak kalp atışı
//
// Üç mod da (1v1, grup, hızlı) aynı sunucu sözleşmesini kullanır:
//   rpc(ad, { ...param, p_hazir }) -> { durum, basladi, ... }
//
// İki iş yapar:
//   1) HAZIR KAPISI — oyuncu "Hazır"a basana kadar p_hazir false gider;
//      basınca true'ya döner ve bir daha geri alınmaz. Herkes hazır olunca
//      sunucu ortak saati başlatır.
//   2) VARLIK BİLDİRİMİ — 3 sn'de bir atılan nabız "buradayım" demektir.
//      Sunucu 12 sn nabız gelmezse oyuncuyu kopmuş sayar, maçı duraklatır ve
//      45 sn sonra maçtan ayrılmış (hükmen mağlup) sayar.
//
// SEKME ARKA PLANDAYKEN NABIZ ATILMAZ. Bu bilerek böyle: kullanıcı
// "ekran değiştirirse diğer rakibin ekranı da kilitlenecek" dedi. Tarayıcı
// zaten arka planda zamanlayıcıları kıstığı için bu aynı zamanda dürüst olan.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { zamanAsimiyla } from "./gorunurluk.js";

const ARALIK_MS = 3000;

/**
 * @param {string} rpcAdi  "mac_nabiz" | "grup_mac_nabiz" | "hizli_mac_nabiz"
 * @param {object} parametreler  ör. { p_match_id: id }
 * @param {boolean} aktif  sayfa açıkken true
 */
export function useMacNabiz(rpcAdi, parametreler, aktif = true) {
  const [nabiz, setNabiz] = useState(null);
  const [nabizHatasi, setNabizHatasi] = useState(null);
  const hazirRef = useRef(false);
  const paramRef = useRef(parametreler);
  paramRef.current = parametreler;

  const nabizAt = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const { data, error } = await zamanAsimiyla(
        supabase.rpc(rpcAdi, { ...paramRef.current, p_hazir: hazirRef.current }),
        10000,
        rpcAdi
      );
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      if (r) {
        setNabiz(r);
        setNabizHatasi(null);
      }
    } catch (e) {
      // Ağ dalgalanması olabilir; ekranı düşürmeyiz, bir sonraki tik dener.
      console.error(`[Bildim] ${rpcAdi}:`, e);
      setNabizHatasi(e);
    }
  }, [rpcAdi]);

  useEffect(() => {
    if (!aktif) return undefined;
    nabizAt();
    const id = setInterval(nabizAt, ARALIK_MS);
    // Sekmeye dönüldüğü an nabzı at: rakibin kilidi bir tik beklemeden açılsın.
    const geriDon = () => { if (!document.hidden) nabizAt(); };
    document.addEventListener("visibilitychange", geriDon);
    window.addEventListener("focus", geriDon);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", geriDon);
      window.removeEventListener("focus", geriDon);
    };
  }, [aktif, nabizAt]);

  /** "Hazır" düğmesi. Bir kez basılır, geri alınmaz. */
  const hazirla = useCallback(() => {
    hazirRef.current = true;
    nabizAt();
  }, [nabizAt]);

  return { nabiz, nabizHatasi, hazirla, nabizAt };
}
