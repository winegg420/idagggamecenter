// Profilde renk alanı yok (yeni kolon eklenmedi); avatar rengi user.id'den
// deterministik üretilir — aynı oyuncu her girişte ve herkesin ekranında
// aynı renkte görünür.

function hslHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | b;
}

const SAC_RENKLERI = [0x2b2b2b, 0x5a3a22, 0x8a5a36, 0x3a2a18, 0x6b4226];

/** @returns {{govde:number, sac:number, etiket:string}} */
export function renkUret(id) {
  let h = 0;
  for (const c of String(id ?? "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const govde = hslHex(h % 360, 0.72, 0.52);
  const sac = SAC_RENKLERI[(h >>> 8) % SAC_RENKLERI.length];
  return { govde, sac, etiket: "#" + govde.toString(16).padStart(6, "0") };
}
