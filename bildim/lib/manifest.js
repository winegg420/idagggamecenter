import { useEffect } from "react";

// Bildim'in kendi PWA kimliği var (/bildim.webmanifest): ad "Bildim!",
// start_url "/bildim", portrait, mor tema. Hub'ın manifesti ise tüm oyun
// merkezini temsil ediyor. Bildim rotalarındayken belge başlığındaki
// <link rel="manifest"> ve theme-color Bildim'e çevrilir; çıkınca geri alınır.

const BILDIM_MANIFEST = "/bildim.webmanifest";
const BILDIM_TEMA = "#7c4dff";

function etiketBul(secici, olustur) {
  let e = document.querySelector(secici);
  if (!e) {
    e = olustur();
    document.head.appendChild(e);
  }
  return e;
}

/**
 * Bildim rotalarında PWA kimliğini Bildim'e çevirir.
 * Bileşen kaldırılınca (hub'a dönünce) eski değerler geri yüklenir.
 */
export function useBildimManifest() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    let manifestEtiket, temaEtiket, eskiManifest, eskiTema;
    try {
      manifestEtiket = etiketBul('link[rel="manifest"]', () => {
        const l = document.createElement("link");
        l.rel = "manifest";
        return l;
      });
      temaEtiket = etiketBul('meta[name="theme-color"]', () => {
        const m = document.createElement("meta");
        m.name = "theme-color";
        return m;
      });

      eskiManifest = manifestEtiket.getAttribute("href");
      eskiTema = temaEtiket.getAttribute("content");

      manifestEtiket.setAttribute("href", BILDIM_MANIFEST);
      temaEtiket.setAttribute("content", BILDIM_TEMA);
    } catch {
      /* belge erişimi yoksa PWA kimliği hub'da kalır — oyunu etkilemez */
      return undefined;
    }

    return () => {
      try {
        if (eskiManifest) manifestEtiket.setAttribute("href", eskiManifest);
        if (eskiTema) temaEtiket.setAttribute("content", eskiTema);
      } catch {
        /* sayfa kapanıyor olabilir */
      }
    };
  }, []);
}
