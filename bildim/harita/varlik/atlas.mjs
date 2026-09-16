// ============================================================
// TEK DOKU ATLASI — STIL.md §2.5
//
// 512×512, 8×8 hücre (64 px). Her malzeme bir hücre: düz renk + hafif
// malzeme dokusu (sıva pürüzü, taş benek, kiremit sırası, tente çizgisi).
// Karakter, bina ve prop AYNI atlastan beslenir → tek malzeme, tek çağrı.
//
// glTF uv kuralı: v = 0 görüntünün ÜSTÜ. Hücre satırı r → v ∈ [r/8, (r+1)/8].
// ============================================================
import { pngYaz } from "./png.mjs";

export const N = 8, BOY = 512, HUCRE = BOY / N;

// Palet STIL.md §1.3 ile aynı. [ad, temel renk, desen]
const TANIM = [
  // --- karakter ---
  ["ten", "#F2C9A7", "puruz"], ["sac", "#5B3A29", "duz"], ["tisort", "#F4701F", "kumas"],
  ["pantolon", "#3B5B8C", "kumas"], ["ayakkabi", "#2B2B30", "duz"], ["gozBeyaz", "#FFFFFF", "duz"],
  ["gozBebek", "#1B1B22", "duz"], ["agiz", "#B5453A", "duz"], ["yanak", "#F0A48A", "duz"],
  // --- kozmetik ---
  ["sapka", "#2FBF71", "kumas"], ["sapkaSiperi", "#137A45", "duz"], ["gozlukCerceve", "#1B1B22", "duz"],
  ["gozlukCam", "#8ED3F0", "cam"], ["atki", "#C8102E", "orgu"],
  // --- bina ---
  ["siva", "#F3E6D2", "puruz"], ["sivaKoyu", "#D9C4A6", "puruz"], ["tas", "#CFC5AE", "benek"],
  ["tasAcik", "#E8DFCB", "benek"], ["cam", "#9ED9F0", "cam"], ["cerceve", "#FFFFFF", "duz"],
  ["ahsap", "#8A5A36", "damar"], ["ahsapAcik", "#B07A4A", "damar"], ["tente", "#C8102E", "tente"],
  ["tabela", "#2FBF71", "duz"], ["demir", "#46525F", "duz"], ["kiremit", "#C03225", "kiremit"],
  ["lamba", "#FFE28A", "duz"], ["bayrak", "#E30A17", "duz"], ["baca", "#9C6B4F", "duz"],
  ["altin", "#E0B84A", "duz"],
  // --- zemin ---
  ["kaldirim", "#E8DFCB", "kaldirim"], ["asfalt", "#7A808A", "benek"], ["cim", "#4EA85C", "puruz"],
];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Deterministik gürültü (aynı atlas her üretimde birebir aynı çıksın)
const gurultu = (x, y, s = 1) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000; };
const karis = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

/** Desen: hücre içi (x, y ∈ 0..63) → renk çarpanı ya da sabit renk. */
function desen(tur, temel, x, y) {
  switch (tur) {
    case "puruz": return karis(temel, 0.96 + gurultu(x, y) * 0.08);
    case "kumas": return karis(temel, 0.94 + ((x + y) % 2) * 0.05 + gurultu(x, y, 2) * 0.04);
    case "benek": return karis(temel, gurultu(x >> 1, y >> 1, 3) > 0.9 ? 0.86 : 0.97 + gurultu(x, y, 4) * 0.06);
    case "damar": return karis(temel, 0.9 + Math.sin(y * 0.9 + gurultu(0, y, 5) * 2) * 0.06 + gurultu(x, y, 6) * 0.03);
    case "cam": return karis(temel, 0.85 + (x + y) / 128 * 0.35);
    case "orgu": return karis(temel, 0.9 + (((x >> 2) + (y >> 2)) % 2) * 0.12);
    case "tente": return ((x >> 3) % 2) ? [255, 250, 240] : temel;
    case "kiremit": { const sira = y >> 3, off = (sira % 2) * 8; const kenar = ((x + off) % 16) < 1 || (y % 8) < 1; return karis(temel, kenar ? 0.72 : 0.94 + gurultu(x >> 2, y >> 2, 7) * 0.1); }
    case "kaldirim": { const kenar = (x % 16) < 1 || (y % 16) < 1; return karis(temel, kenar ? 0.85 : 0.97 + gurultu(x >> 2, y >> 2, 8) * 0.05); }
    default: return temel;
  }
}

/** Hücre indeksleri (ad → [sütun, satır]). */
export const HUCRELER = Object.fromEntries(TANIM.map(([ad], i) => [ad, [i % N, Math.floor(i / N)]]));

/** Hücre merkezi uv'si (düz renk için). */
export function uvMerkez(ad) {
  const [c, r] = HUCRELER[ad] ?? (() => { throw new Error("atlas hücresi yok: " + ad); })();
  return [(c + 0.5) / N, (r + 0.5) / N];
}

/** Hücre dikdörtgeni, kenardan 3 px içeri (mip sızması olmasın). */
export function uvDikdortgen(ad) {
  const [c, r] = HUCRELER[ad] ?? (() => { throw new Error("atlas hücresi yok: " + ad); })();
  const p = 3 / BOY;
  return { u0: c / N + p, v0: r / N + p, u1: (c + 1) / N - p, v1: (r + 1) / N - p };
}

/** Atlas PNG'si (Buffer). */
export function atlasCiz() {
  const rgba = new Uint8Array(BOY * BOY * 4);
  for (const [ad, renkHex, tur] of TANIM) {
    const [c, r] = HUCRELER[ad], temel = hex(renkHex);
    for (let y = 0; y < HUCRE; y++) for (let x = 0; x < HUCRE; x++) {
      const [R, G, B] = desen(tur, temel, x, y);
      const i = ((r * HUCRE + y) * BOY + c * HUCRE + x) * 4;
      rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255;
    }
  }
  return pngYaz(BOY, BOY, rgba);
}
