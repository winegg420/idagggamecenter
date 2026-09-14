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
    let atildi = false;
    setKaynak(null);

    // Paket 8: dükkândaki "Şu anki karakterin" kutusu boş kalıyordu. İki olası
    // sebep birden kaldırıldı:
    //   1) IntersectionObserver — gardıroptaki ParcaPortresi'nde ölçülüp
    //      kaldırılmıştı (gözlemci tetiklenmediğinde portre hiç üretilmiyor).
    //      Burada tek portre var; paylaşılan kuyruk zaten yükü sınırlıyor.
    //   2) Görünümü hiç kaydedilmemiş oyuncu (`gorunum` null) boş kutu
    //      görüyordu — artık varsayılan karakter çizilir.
    (async () => {
      try {
        const { yeniPortre } = await import("../avatar3d/portre.js");
        const { siraya } = await import("../avatar3d/portre-kuyrugu.js");
        siraya(() => {
          if (atildi) return;
          const veri = yeniPortre(gorunum ? { avatar3d: gorunum } : {});
          if (!atildi && veri) setKaynak(veri);
        });
      } catch (e) {
        console.error("[Karakter] portre uretilemedi:", e);
      }
    })();

    return () => { atildi = true; };
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
