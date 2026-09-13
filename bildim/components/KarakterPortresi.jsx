// ============================================================
// KARAKTER PORTRESİ — 3B karakterin tek karelik fotoğrafı
//
// NEREDE KULLANILIR: yalnız gardırop/dükkân gibi karakterin KENDİSİNİN
// konu olduğu ekranlarda. Listelerde, lig tablosunda, maç ekranında ve
// profilde görünen şey seçilen AVATAR FOTOĞRAFIDIR (src/components/
// Avatar.jsx) — orada 3B karakter çizilmez.
//
// three.js DİNAMİK yüklenir: bu bileşeni kullanmayan sayfa three.js
// indirmez. Üretim tembeldir (görünür alana girince) ve paylaşılan
// kuyruktan geçer; hazır olana kadar yerinde bir iskelet durur, düzen
// zıplamaz.
// ============================================================
import { useEffect, useRef, useState } from "react";

export default function KarakterPortresi({ gorunum, boyut = 96 }) {
  const kutuRef = useRef(null);
  const [kaynak, setKaynak] = useState(null);

  const anahtar = gorunum ? JSON.stringify(gorunum) : null;

  useEffect(() => {
    if (!gorunum) { setKaynak(null); return undefined; }
    const kutu = kutuRef.current;
    if (!kutu) return undefined;
    let atildi = false;
    setKaynak(null);

    const uret = async () => {
      if (atildi) return;
      try {
        const { yeniPortre } = await import("../avatar3d/portre.js");
        const { siraya } = await import("../avatar3d/portre-kuyrugu.js");
        siraya(() => {
          if (atildi) return;
          const veri = yeniPortre({ avatar3d: gorunum });
          if (!atildi && veri) setKaynak(veri);
        });
      } catch (e) {
        console.error("[Karakter] portre uretilemedi:", e);
      }
    };

    if (typeof IntersectionObserver !== "function") {
      uret();
      return () => { atildi = true; };
    }

    const gozcu = new IntersectionObserver((girisler) => {
      for (const g of girisler) {
        if (!g.isIntersecting) continue;
        gozcu.disconnect();
        uret();
      }
    }, { rootMargin: "120px" });
    gozcu.observe(kutu);

    return () => { atildi = true; gozcu.disconnect(); };
    // `anahtar` görünümün tamamını temsil ediyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, boyut]);

  return (
    <span
      ref={kutuRef}
      className="bd-karakter-portre"
      style={{ width: boyut, height: boyut }}
    >
      {kaynak ? <img src={kaynak} alt="" draggable="false" /> : null}
    </span>
  );
}
