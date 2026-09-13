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

// `calisiyor`: bir iş yürürken o işin içinden `siraya` çağrılırsa ikinci bir
// boşaltma zinciri başlıyordu; iki zincir birbirini besleyip işi katlıyordu.
// Bu bayrak tek zincir garantisi verir.
let calisiyor = false;

function isle() {
  bekleyen = 0;
  calisiyor = true;
  const is = kuyruk.shift();
  if (is) {
    try { is(); } catch (e) { console.error("[Portre] kuyruk isi:", e); }
  }
  calisiyor = false;
  if (kuyruk.length && !bekleyen) bekleyen = bosZamanda(isle);
}

/** İşi kuyruğa alır; sırası gelince boş zamanda çalıştırılır. */
export function siraya(is) {
  kuyruk.push(is);
  if (!bekleyen && !calisiyor) bekleyen = bosZamanda(isle);
}
