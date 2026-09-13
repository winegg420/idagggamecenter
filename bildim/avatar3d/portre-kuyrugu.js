// ============================================================
// PORTRE KUYRUĞU — kare başına en fazla bir render
//
// Bir 3B portre ~55 ms sürüyor (ölçüldü); 16.7 ms'lik kare bütçesine
// sığmıyor. Hepsini üst üste üretmek sayfayı dondurur, o yüzden istekler
// bu tek kuyruğa girer ve teker teker BOŞ ZAMANDA işlenir.
//
// Gardırop kartları (ParcaPortresi.jsx) ve listelerdeki avatarlar
// (src/components/Avatar.jsx) AYNI kuyruğu paylaşır: lig tablosu açıkken
// gardıroba geçilse bile toplam yük kare başına bir render olarak kalır.
// ============================================================
const kuyruk = [];
let bekleyen = 0;

const bosZamanda = typeof requestIdleCallback === "function"
  ? (fn) => requestIdleCallback(fn, { timeout: 500 })
  : (fn) => requestAnimationFrame(fn);

function isle() {
  bekleyen = 0;
  const is = kuyruk.shift();
  if (is) {
    try { is(); } catch (e) { console.error("[Portre] kuyruk isi:", e); }
  }
  if (kuyruk.length) bekleyen = bosZamanda(isle);
}

/** İşi kuyruğa alır; sırası gelince boş zamanda çalıştırılır. */
export function siraya(is) {
  kuyruk.push(is);
  if (!bekleyen) bekleyen = bosZamanda(isle);
}
