// KAFA TOPU — mini karakter önizlemesi (roster ve oda lobisinde kullanılır).
// Foto görselleri gecikmeli yüklenebildiği için kısa süre yeniden çizer.

import { useEffect, useRef } from "react";
import { kafaBul } from "../../shared/karakterler.js";
import { oyuncuCiz } from "../../engine/kafaCizim.js";

export default function KafaOnizleme({ kafaId, takim = 1, genislik = 130, yukseklik = 170 }) {
  const ref = useRef(null);
  useEffect(() => {
    let aktif = true;
    const ciz = () => {
      const c = ref.current;
      if (!c || !aktif) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(c.width / 130, c.height / 170);
      oyuncuCiz(
        ctx,
        { x: 65, y: 62, vx: 0, vy: 0, va: -9999, ol: 1, ef: 0 },
        { takim, kafaKaydi: kafaBul(kafaId) },
        0
      );
      ctx.restore();
    };
    ciz();
    const zamanlayici = setInterval(ciz, 600);
    setTimeout(() => clearInterval(zamanlayici), 3000);
    return () => {
      aktif = false;
      clearInterval(zamanlayici);
    };
  }, [kafaId, takim]);
  return <canvas ref={ref} width={genislik} height={yukseklik} />;
}
