// ============================================================
// TEK DOKU ATLASI — STIL.md §2.5  (Aşama 1B.2 ile yeniden yazıldı)
//
// 1024×1024, 8×8 hücre (128 px), kenar payı 6 px. Desenler gürültü değil
// YAPI: kiremit sırası, tuğla örgüsü, taş blok, karo derzi, ahşap damar,
// tente şeridi, cam yansıma bandı. Kontrast %15–25 — telefonda seçilir.
// Karakter, bina ve prop AYNI atlastan beslenir → tek malzeme, tek çağrı.
//
// A/B için eski atlas da üretilir: `atlasCiz({ eski: true })` (512 px, %4–8
// kontrastlı gürültü). UV oranları iki boyutta da aynı (pay/boy sabit),
// bu yüzden çalışma anında yalnız doku değiştirilir.
//
// glTF uv kuralı: v = 0 görüntünün ÜSTÜ. Hücre satırı r → v ∈ [r/8, (r+1)/8].
// ============================================================
import { pngYaz } from "./png.mjs";

export const N = 8;
const BOY_YENI = 1024, PAY_YENI = 6;
const BOY_ESKI = 512, PAY_ESKI = 3;

// Palet STIL.md §1.3 ile aynı. [ad, temel renk, desen]
const TANIM = [
  // --- karakter ---
  ["ten", "#F2C9A7", "puruz"], ["sac", "#5B3A29", "sac"], ["tisort", "#F4701F", "kumas"],
  ["pantolon", "#3B5B8C", "kumas"], ["ayakkabi", "#2B2B30", "duz"], ["gozBeyaz", "#FFFFFF", "duz"],
  ["gozBebek", "#1B1B22", "duz"], ["agiz", "#B5453A", "duz"], ["yanak", "#F0A48A", "duz"],
  // --- kozmetik ---
  ["sapka", "#2FBF71", "kumas"], ["sapkaSiperi", "#137A45", "duz"], ["gozlukCerceve", "#1B1B22", "duz"],
  ["gozlukCam", "#8ED3F0", "cam"], ["atki", "#C8102E", "orgu"],
  // --- bina ---
  ["siva", "#F3E6D2", "siva"], ["sivaKoyu", "#D9C4A6", "siva"], ["tas", "#CFC5AE", "tas"],
  ["tasAcik", "#E8DFCB", "tasAcik"], ["cam", "#9ED9F0", "cam"], ["cerceve", "#FFFFFF", "duz"],
  ["ahsap", "#8A5A36", "ahsap"], ["ahsapAcik", "#B07A4A", "ahsap"], ["tente", "#C8102E", "tente"],
  ["tabela", "#2FBF71", "duz"], ["demir", "#46525F", "demir"], ["kiremit", "#C03225", "kiremit"],
  ["lamba", "#FFE28A", "duz"], ["bayrak", "#E30A17", "duz"], ["baca", "#9C6B4F", "tugla"],
  ["altin", "#E0B84A", "duz"], ["tugla", "#B5573A", "tugla"],
  // --- zemin ---
  ["kaldirim", "#E8DFCB", "kaldirim"], ["asfalt", "#7A808A", "asfalt"], ["cim", "#4EA85C", "cim"],
  ["cimAcik", "#7CC462", "cim"],
];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Deterministik gürültü (aynı atlas her üretimde birebir aynı çıksın)
const gurultu = (x, y, s = 1) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000; };
const karis = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const harman = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * YENİ desenler — hücre içi (x, y ∈ 0..127) → renk. Kontrast %15–25.
 * Her desen "yapı + blok başına ton farkı" ilkesiyle yazıldı.
 */
function desen(tur, temel, x, y) {
  switch (tur) {
    case "siva": {      // ince pürüz + üstten alta kirlenme
      const kir = 1 - (y / 128) * 0.09;
      return karis(temel, kir * (0.97 + gurultu(x, y, 1) * 0.06));
    }
    case "puruz": return karis(temel, 0.97 + gurultu(x >> 1, y >> 1, 1) * 0.06);
    case "kumas": {     // dokuma: 4 px örgü + hafif gürültü
      const orgu = ((x >> 1) + (y >> 1)) % 2 ? 1.04 : 0.95;
      return karis(temel, orgu + gurultu(x, y, 2) * 0.04 - 0.02);
    }
    case "sac": return karis(temel, 0.9 + ((x % 6) < 2 ? 0.14 : 0) + gurultu(0, y >> 2, 3) * 0.06);
    case "tas": {       // düzensiz taş bloklar: 32×21 ızgara, kenarları ±3 px oynar, derz koyu
      const sira = Math.floor(y / 21), kay = (sira % 2) * 16;
      const bx = Math.floor((x + kay) / 32), by = sira;
      const solKenar = bx * 32 - kay + Math.round((gurultu(bx, by, 4) - 0.5) * 6);
      const ustKenar = by * 21 + Math.round((gurultu(bx, by, 5) - 0.5) * 4);
      const derz = x - solKenar < 2 || y - ustKenar < 2;
      if (derz) return karis(temel, 0.72);
      return karis(temel, 0.9 + gurultu(bx, by, 6) * 0.2 + gurultu(x, y, 7) * 0.04 - 0.02);
    }
    case "tasAcik": {   // daha büyük, açık bloklar (silme, korniş)
      const bx = Math.floor(x / 64), by = Math.floor(y / 32);
      if (x % 64 < 2 || y % 32 < 2) return karis(temel, 0.8);
      return karis(temel, 0.94 + gurultu(bx, by, 8) * 0.1 + gurultu(x >> 1, y >> 1, 9) * 0.03);
    }
    case "tugla": {     // 32×16 tuğla, sıra kaydırmalı, derz AÇIK
      const sira = Math.floor(y / 16), kay = (sira % 2) * 16;
      const bx = Math.floor((x + kay) / 32);
      if ((x + kay) % 32 < 2 || y % 16 < 2) return harman(temel, [217, 203, 184], 0.85);
      return karis(temel, 0.92 + gurultu(bx, sira, 10) * 0.16 + gurultu(x, y, 11) * 0.04 - 0.02);
    }
    case "kiremit": {   // 16 px sıra, 24 px kiremit, yarım kaydırma, sıra arası koyu çizgi
      const sira = Math.floor(y / 16), kay = (sira % 2) * 12;
      const tx = Math.floor((x + kay) / 24);
      const iy = y % 16, ix = (x + kay) % 24;
      if (iy < 2) return karis(temel, 0.62);
      if (ix < 1) return karis(temel, 0.78);
      const kavis = 1 + (iy / 16) * -0.12 + 0.06;   // üstü açık, altı koyu (kiremit bombesi)
      return karis(temel, kavis * (0.92 + gurultu(tx, sira, 12) * 0.16));
    }
    case "kaldirim": {  // 32 px kare karo, 2 px koyu derz, karo başına ton
      const bx = x >> 5, by = y >> 5;
      if (x % 32 < 2 || y % 32 < 2) return karis(temel, 0.78);
      return karis(temel, 0.93 + gurultu(bx, by, 13) * 0.12 + gurultu(x >> 2, y >> 2, 14) * 0.03);
    }
    case "asfalt": {    // ince agrega
      return karis(temel, 0.9 + gurultu(x, y, 15) * 0.18);
    }
    case "ahsap": {     // yatay damar + budaklar, kontrast %20
      let k = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(y * 0.55 + gurultu(0, y >> 3, 16) * 2.5 + Math.sin(x * 0.05) * 1.5));
      for (const [kx, ky] of [[34, 40], [92, 96]]) {
        const r = Math.hypot(x - kx, (y - ky) * 1.6);
        if (r < 7) k = 0.7 + (r % 2.5) * 0.06;
      }
      return karis(temel, k + gurultu(x, y, 17) * 0.03);
    }
    case "tente": return ((x >> 4) % 2) ? [255, 250, 240] : temel;
    case "cam": {       // köşegen yansıma bandı + üstten alta koyulaşma
      const bant = ((x - y + 256) % 64);
      const yans = bant > 14 && bant < 30 ? 1.18 : bant > 34 && bant < 38 ? 1.1 : 1;
      return karis(harman(temel, [120, 160, 220], 0.15), yans * (1.02 - (y / 128) * 0.14));
    }
    case "cim": {       // iki tonlu tutamlar
      const t = gurultu(x >> 2, y >> 2, 18) > 0.5 ? 1.12 : 0.9;
      return karis(temel, t + gurultu(x, (y >> 1), 19) * 0.06 - 0.03);
    }
    case "orgu": {      // örgü: 8 px ilmek, ortası yuvarlak
      const ix = x % 8, iy = y % 8, damalı = ((x >> 3) + (y >> 3)) % 2;
      const merkez = Math.hypot(ix - 4, iy - 4) < 3 ? 1.06 : 0.9;
      return karis(temel, (damalı ? 0.92 : 1.0) * merkez);
    }
    case "demir": return karis(temel, 0.94 + gurultu(x >> 1, y, 20) * 0.1);
    default: return temel;
  }
}

/** ESKİ desenler (Aşama 1) — A/B karşılaştırması için birebir korunur. */
function desenEski(tur, temel, x, y) {
  switch (tur) {
    case "siva": case "puruz": return karis(temel, 0.96 + gurultu(x, y) * 0.08);
    case "kumas": return karis(temel, 0.94 + ((x + y) % 2) * 0.05 + gurultu(x, y, 2) * 0.04);
    case "tas": case "tasAcik": case "asfalt": return karis(temel, gurultu(x >> 1, y >> 1, 3) > 0.9 ? 0.86 : 0.97 + gurultu(x, y, 4) * 0.06);
    case "ahsap": return karis(temel, 0.9 + Math.sin(y * 0.9 + gurultu(0, y, 5) * 2) * 0.06 + gurultu(x, y, 6) * 0.03);
    case "cam": return karis(temel, 0.85 + (x + y) / 128 * 0.35);
    case "orgu": return karis(temel, 0.9 + (((x >> 2) + (y >> 2)) % 2) * 0.12);
    case "tente": return ((x >> 3) % 2) ? [255, 250, 240] : temel;
    case "kiremit": { const sira = y >> 3, off = (sira % 2) * 8; const kenar = ((x + off) % 16) < 1 || (y % 8) < 1; return karis(temel, kenar ? 0.72 : 0.94 + gurultu(x >> 2, y >> 2, 7) * 0.1); }
    case "kaldirim": { const kenar = (x % 16) < 1 || (y % 16) < 1; return karis(temel, kenar ? 0.85 : 0.97 + gurultu(x >> 2, y >> 2, 8) * 0.05); }
    case "cim": return karis(temel, 0.96 + gurultu(x, y) * 0.08);
    default: return temel;
  }
}

/** Hücre indeksleri (ad → [sütun, satır]). */
export const HUCRELER = Object.fromEntries(TANIM.map(([ad], i) => [ad, [i % N, Math.floor(i / N)]]));
if (TANIM.length > N * N) throw new Error("atlas: hücre sayısı 64'ü geçti");

/** Hücre merkezi uv'si (düz renk için). */
export function uvMerkez(ad) {
  const [c, r] = HUCRELER[ad] ?? (() => { throw new Error("atlas hücresi yok: " + ad); })();
  return [(c + 0.5) / N, (r + 0.5) / N];
}

/** Hücre dikdörtgeni, kenardan pay kadar içeri (mip sızması olmasın). Oran iki atlasta da aynı. */
export function uvDikdortgen(ad) {
  const [c, r] = HUCRELER[ad] ?? (() => { throw new Error("atlas hücresi yok: " + ad); })();
  const p = PAY_YENI / BOY_YENI;
  return { u0: c / N + p, v0: r / N + p, u1: (c + 1) / N - p, v1: (r + 1) / N - p };
}

/** Atlas PNG'si (Buffer). `eski: true` → Aşama 1 atlası (A/B). */
export function atlasCiz({ eski = false } = {}) {
  const BOY = eski ? BOY_ESKI : BOY_YENI, HUCRE = BOY / N, ciz = eski ? desenEski : desen;
  const rgba = new Uint8Array(BOY * BOY * 4);
  for (const [ad, renkHex, tur] of TANIM) {
    const [c, r] = HUCRELER[ad], temel = hex(renkHex);
    for (let y = 0; y < HUCRE; y++) for (let x = 0; x < HUCRE; x++) {
      const [R, G, B] = ciz(tur, temel, x, y);
      const i = ((r * HUCRE + y) * BOY + c * HUCRE + x) * 4;
      rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255;
    }
  }
  return pngYaz(BOY, BOY, rgba);
}

/** Zemin temas gölgesi: 64×64 radyal alfa gradyanı (ayrı doku, tek instanced çağrı). */
export function temasCiz() {
  const B = 64, rgba = new Uint8Array(B * B * 4);
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    const r = Math.hypot(x - 31.5, y - 31.5) / 31.5;
    const a = Math.pow(Math.max(0, 1 - r), 1.7);
    const i = (y * B + x) * 4;
    rgba[i] = 25; rgba[i + 1] = 22; rgba[i + 2] = 30; rgba[i + 3] = Math.round(a * 255);
  }
  return pngYaz(B, B, rgba);
}
