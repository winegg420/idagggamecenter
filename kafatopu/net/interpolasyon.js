// ============================================================
// KAFA TOPU — misafir tarafı durum yumuşatma.
// Host'tan gelen 20Hz "durum" paketleri tamponlanır ve render,
// INTERP_GECIKME_MS kadar geriden iki paket arasında lineer
// interpolasyonla çizilir (PatiRun deseninin sadeleştirilmiş hali).
// ============================================================

import { AG } from "../shared/sabitler.js";

export function interpKur() {
  const tampon = []; // { alinma: yerelMs, snap }

  return {
    ekle(snap) {
      tampon.push({ alinma: performance.now(), snap });
      // 2 saniyeden eski paketleri at
      const esik = performance.now() - 2000;
      while (tampon.length > 2 && tampon[0].alinma < esik) tampon.shift();
    },

    // Hedef zamana göre interpolasyonlu görünüm döndürür.
    // Paket yoksa null; tek paket varsa onu döndürür.
    ornekle() {
      if (tampon.length === 0) return null;
      const hedef = performance.now() - AG.INTERP_GECIKME_MS;

      // hedefi saran iki paketi bul
      let a = tampon[0], b = tampon[tampon.length - 1];
      for (let i = 0; i < tampon.length - 1; i++) {
        if (tampon[i].alinma <= hedef && tampon[i + 1].alinma >= hedef) {
          a = tampon[i];
          b = tampon[i + 1];
          break;
        }
      }
      if (a === b || b.alinma === a.alinma) return b.snap;

      const t = Math.min(1, Math.max(0, (hedef - a.alinma) / (b.alinma - a.alinma)));
      const L = (x, y) => x + (y - x) * t;

      // Ayrık alanlar (skor, faz, olaylar) her zaman yeni paketten alınır;
      // olaylar ekle() sırasında değil tüketici tarafından işlenir.
      return {
        ...b.snap,
        top: {
          ...b.snap.top,
          x: L(a.snap.top.x, b.snap.top.x),
          y: L(a.snap.top.y, b.snap.top.y),
          a: L(a.snap.top.a, b.snap.top.a),
        },
        oy: b.snap.oy.map((oyB, i) => {
          const oyA = a.snap.oy[i] || oyB;
          return { ...oyB, x: L(oyA.x, oyB.x), y: L(oyA.y, oyB.y) };
        }),
      };
    },
  };
}
