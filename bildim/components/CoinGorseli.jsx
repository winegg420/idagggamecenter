/**
 * COIN PAKETİ GÖRSELİ — çizilmiş, dışarıdan resim indirilmez.
 *
 * Paketin büyüklüğüne göre farklı bir yığın çizer: küçük kesede birkaç para,
 * hazinede taşan bir sandık. Böylece oyuncu fiyat okumadan da hangisinin
 * daha büyük olduğunu görüyor.
 *
 * Tamamı inline SVG: her cihazda aynı, tema renklerini kullanır, ağ isteği yok.
 */

const ALTIN = "#FFC53D";
const ALTIN_KOYU = "#C99A00";
const ALTIN_ACIK = "#FFE08A";
const SANDIK = "#8A5A2B";
const SANDIK_KOYU = "#5E3C1B";

/** Tek para — elips + kalınlık + ortada damga. */
function Para({ x, y, r = 11, donuk = false }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={donuk ? 0.85 : 1}>
      <ellipse cx="0" cy="3" rx={r} ry={r * 0.42} fill={ALTIN_KOYU} />
      <ellipse cx="0" cy="0" rx={r} ry={r * 0.42} fill={ALTIN} />
      <ellipse cx="0" cy="-0.5" rx={r * 0.55} ry={r * 0.23} fill={ALTIN_ACIK} />
    </g>
  );
}

/**
 * @param {"kucuk"|"orta"|"buyuk"|"hazine"} boyut
 */
export default function CoinGorseli({ boyut = "kucuk", genislik = 64 }) {
  const ortak = {
    width: genislik,
    height: genislik,
    viewBox: "0 0 64 64",
    role: "img",
    "aria-hidden": "true",
    focusable: "false",
  };

  if (boyut === "kucuk") {
    // Üç para, yan yana duran küçük bir tutam
    return (
      <svg {...ortak}>
        <Para x={22} y={44} r={11} />
        <Para x={42} y={44} r={11} />
        <Para x={32} y={32} r={12} />
      </svg>
    );
  }

  if (boyut === "orta") {
    // İki katlı yığın + yanda tek para
    return (
      <svg {...ortak}>
        <Para x={20} y={46} r={11} />
        <Para x={40} y={48} r={12} />
        <Para x={40} y={40} r={12} />
        <Para x={30} y={30} r={13} />
        <Para x={30} y={22} r={13} />
      </svg>
    );
  }

  if (boyut === "buyuk") {
    // Üç katlı yüksek yığın
    return (
      <svg {...ortak}>
        <Para x={18} y={48} r={11} />
        <Para x={18} y={41} r={11} />
        <Para x={46} y={48} r={11} />
        <Para x={46} y={41} r={11} />
        <Para x={46} y={34} r={11} />
        <Para x={32} y={40} r={13} />
        <Para x={32} y={32} r={13} />
        <Para x={32} y={24} r={13} />
        <Para x={32} y={16} r={13} />
      </svg>
    );
  }

  // hazine — sandıktan taşan paralar
  return (
    <svg {...ortak}>
      {/* sandık gövdesi */}
      <path d="M10 36h44v18a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill={SANDIK} />
      <path d="M10 36h44v5H10z" fill={SANDIK_KOYU} />
      {/* kilit */}
      <rect x="29" y="39" width="6" height="8" rx="1.5" fill={ALTIN} />
      {/* taşan paralar */}
      <Para x={20} y={30} r={10} />
      <Para x={44} y={30} r={10} />
      <Para x={32} y={26} r={11} />
      <Para x={32} y={17} r={11} />
      <Para x={24} y={20} r={9} donuk />
      <Para x={41} y={20} r={9} donuk />
      {/* sandık kapağı (arkada) */}
      <path d="M10 36a22 22 0 0 1 44 0z" fill={SANDIK_KOYU} opacity="0.55" />
    </svg>
  );
}

/**
 * Coin miktarına göre görsel boyutu seçer. Katalogdaki paket sayısı
 * değişebilir; eşikler miktara bakar, ürün kimliğine değil.
 */
export function coinBoyutu(miktar) {
  const n = Number(miktar) || 0;
  if (n >= 6000) return "hazine";
  if (n >= 2500) return "buyuk";
  if (n >= 1000) return "orta";
  return "kucuk";
}
