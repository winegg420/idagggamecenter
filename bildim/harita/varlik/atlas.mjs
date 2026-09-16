// ============================================================
// TEK DOKU ATLASI — STIL.md §2.5  (Aşama 1B.2'de yeniden yazıldı, 1C'de yüz bölgesi eklendi)
//
// 1024×1024, 8×8 hücre (128 px), kenar payı 6 px. Desenler gürültü değil
// YAPI: kiremit sırası, tuğla örgüsü, taş blok, karo derzi, ahşap damar,
// tente şeridi, cam yansıma bandı. Kontrast %15–25 — telefonda seçilir.
// Karakter, bina ve prop AYNI atlastan beslenir → tek malzeme, tek çağrı.
//
// AŞAMA 1C — YÜZ ÇEYREĞİ: sağ-alt 4×4 hücre (512×512 px) yüzlere ayrıldı:
//   insan yüzü 256² · kaplan yüzü 256² · robot yüzü 256² · ifade şeridi 256²
//   (16 kare: 8 göz + 8 ağız; göz/ağız dörtgenlerinin UV'si kaydırılarak
//   ifade değişir — ek çağrı yok, ek doku yok).
// Renk çeşitliliği: ten / saç / kıyafet hücreleri NÖTR açık tondadır; gerçek
// renk çalışma anında köşe rengi (COLOR_0 × ton) ile verilir → hücre israfı yok.
//
// A/B: `atlasCiz({ eski: true })` Aşama 1 atlası (512 px, %4–8 gürültü);
//      `atlasCiz({ yaprakEski: true })` yalnız yaprak/çim hücreleri eski desenle.
// glTF uv kuralı: v = 0 görüntünün ÜSTÜ. Hücre satırı r → v ∈ [r/8, (r+1)/8].
// ============================================================
import { pngYaz } from "./png.mjs";

export const N = 8;
const BOY_YENI = 1024, PAY_YENI = 6;
const BOY_ESKI = 512, PAY_ESKI = 3;

// Palet STIL.md §1.3 ile aynı. [ad, temel renk, desen]
// "ton" ile işaretli hücreler nötr/açıktır: çalışma anında köşe rengiyle çarpılır.
const TANIM = [
  // --- karakter (0-8) ---
  ["ten", "#F2C9A7", "puruz"], ["sac", "#D8CBB8", "sac"], ["tisort", "#EDEDED", "kumas"],
  ["pantolon", "#3B5B8C", "kumas"], ["ayakkabi", "#E6E6E6", "duz"], ["gozBeyaz", "#FFFFFF", "duz"],
  ["gozBebek", "#1B1B22", "duz"], ["agiz", "#B5453A", "duz"], ["yanak", "#F0A48A", "duz"],
  // --- kozmetik (9-13) ---
  ["sapka", "#2FBF71", "kumas"], ["sapkaSiperi", "#137A45", "duz"], ["gozlukCerceve", "#1B1B22", "duz"],
  ["gozlukCam", "#8ED3F0", "cam"], ["atki", "#C8102E", "orgu"],
  // --- bina (14-30) ---
  ["siva", "#F3E6D2", "siva"], ["sivaKoyu", "#D9C4A6", "siva"], ["tas", "#CFC5AE", "tas"],
  ["tasAcik", "#E8DFCB", "tasAcik"], ["cam", "#9ED9F0", "cam"], ["cerceve", "#FFFFFF", "duz"],
  ["ahsap", "#8A5A36", "ahsap"], ["ahsapAcik", "#B07A4A", "ahsap"], ["tente", "#C8102E", "tente"],
  ["tabela", "#2FBF71", "duz"], ["demir", "#46525F", "demir"], ["kiremit", "#C03225", "kiremit"],
  ["lamba", "#FFE28A", "duz"], ["bayrak", "#E30A17", "duz"], ["baca", "#9C6B4F", "tugla"],
  ["altin", "#E0B84A", "duz"], ["tugla", "#B5573A", "tugla"],
  // --- zemin (31-34) ---
  ["kaldirim", "#E8DFCB", "kaldirim"], ["asfalt", "#7A808A", "asfalt"], ["cim", "#5DAF68", "yaprak"],
  ["cimAcik", "#7FC472", "yaprak"],
  // --- Aşama 1C: kıyafet, tür, kedi (35, 40-43, 48-51, 56-59 → 12 hücre; yüz çeyreği 36-39/44-47/52-55/60-63) ---
  ["kot", "#5B78A8", "kot"], null, null, null, null,
  ["kumasPantolon", "#8A8C96", "kumas"], ["ceket", "#E4E4EA", "kumas"], ["esofman", "#DADDE2", "polar"], ["deri", "#8C5A3A", "deri"], null, null, null, null,
  ["gomlek", "#FFFFFF", "duz"], ["kurk", "#E8892B", "kurk"], ["kurkKarin", "#F6E3C4", "puruz"], ["metal", "#C8CDD3", "metal"], null, null, null, null,
  ["boya", "#3FA9F5", "duz"], ["ekran", "#1B2430", "duz"], ["kedi", "#B8A088", "kedi"], ["kediGoz", "#E8D46A", "duz"], null, null, null, null,
];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Deterministik gürültü (aynı atlas her üretimde birebir aynı çıksın)
const gurultu = (x, y, s = 1) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) >>> 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000; };
const karis = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const harman = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** YENİ desenler — hücre içi (x, y ∈ 0..127) → renk. Kontrast %15–25. */
function desen(tur, temel, x, y) {
  switch (tur) {
    case "siva": { const kir = 1 - (y / 128) * 0.09; return karis(temel, kir * (0.97 + gurultu(x, y, 1) * 0.06)); }
    case "puruz": return karis(temel, 0.97 + gurultu(x >> 1, y >> 1, 1) * 0.06);
    case "kumas": { const orgu = ((x >> 1) + (y >> 1)) % 2 ? 1.04 : 0.95; return karis(temel, orgu + gurultu(x, y, 2) * 0.04 - 0.02); }
    case "kot": { const orgu = ((x + y) % 3) ? 1.0 : 0.9; return karis(temel, orgu + gurultu(x, y, 21) * 0.08 - 0.04); }
    case "polar": return karis(temel, 0.95 + gurultu(x >> 1, y >> 1, 22) * 0.1);
    case "deri": return karis(temel, 0.94 + gurultu(x >> 2, y >> 2, 23) * 0.08 + ((x * 3 + y) % 17 === 0 ? 0.06 : 0));
    // saç: yumuşak tutam çizgileri (Aşama 1C §5.2: kontrast yarıya indi)
    case "sac": return karis(temel, 0.95 + ((x % 6) < 2 ? 0.07 : 0) + gurultu(0, y >> 2, 3) * 0.03);
    case "tas": {
      const sira = Math.floor(y / 21), kay = (sira % 2) * 16;
      const bx = Math.floor((x + kay) / 32), by = sira;
      const solKenar = bx * 32 - kay + Math.round((gurultu(bx, by, 4) - 0.5) * 6);
      const ustKenar = by * 21 + Math.round((gurultu(bx, by, 5) - 0.5) * 4);
      if (x - solKenar < 2 || y - ustKenar < 2) return karis(temel, 0.72);
      return karis(temel, 0.9 + gurultu(bx, by, 6) * 0.2 + gurultu(x, y, 7) * 0.04 - 0.02);
    }
    case "tasAcik": { const bx = Math.floor(x / 64), by = Math.floor(y / 32); if (x % 64 < 2 || y % 32 < 2) return karis(temel, 0.8); return karis(temel, 0.94 + gurultu(bx, by, 8) * 0.1 + gurultu(x >> 1, y >> 1, 9) * 0.03); }
    case "tugla": { const sira = Math.floor(y / 16), kay = (sira % 2) * 16; const bx = Math.floor((x + kay) / 32); if ((x + kay) % 32 < 2 || y % 16 < 2) return harman(temel, [217, 203, 184], 0.85); return karis(temel, 0.92 + gurultu(bx, sira, 10) * 0.16 + gurultu(x, y, 11) * 0.04 - 0.02); }
    case "kiremit": { const sira = Math.floor(y / 16), kay = (sira % 2) * 12; const tx = Math.floor((x + kay) / 24); const iy = y % 16, ix = (x + kay) % 24; if (iy < 2) return karis(temel, 0.62); if (ix < 1) return karis(temel, 0.78); const kavis = 1 + (iy / 16) * -0.12 + 0.06; return karis(temel, kavis * (0.92 + gurultu(tx, sira, 12) * 0.16)); }
    case "kaldirim": { const bx = x >> 5, by = y >> 5; if (x % 32 < 2 || y % 32 < 2) return karis(temel, 0.78); return karis(temel, 0.93 + gurultu(bx, by, 13) * 0.12 + gurultu(x >> 2, y >> 2, 14) * 0.03); }
    case "asfalt": return karis(temel, 0.9 + gurultu(x, y, 15) * 0.18);
    case "ahsap": { let k = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(y * 0.55 + gurultu(0, y >> 3, 16) * 2.5 + Math.sin(x * 0.05) * 1.5)); for (const [kx, ky] of [[34, 40], [92, 96]]) { const r = Math.hypot(x - kx, (y - ky) * 1.6); if (r < 7) k = 0.7 + (r % 2.5) * 0.06; } return karis(temel, k + gurultu(x, y, 17) * 0.03); }
    case "tente": return ((x >> 4) % 2) ? [255, 250, 240] : temel;
    case "cam": { const bant = ((x - y + 256) % 64); const yans = bant > 14 && bant < 30 ? 1.18 : bant > 34 && bant < 38 ? 1.1 : 1; return karis(harman(temel, [120, 160, 220], 0.15), yans * (1.02 - (y / 128) * 0.14)); }
    // Aşama 1C §6.1: yaprak — geniş yumuşak lekeler, kontrast %12 (eskisi %22 dama)
    case "yaprak": { const leke = gurultu(x >> 4, y >> 4, 18) * 0.6 + gurultu(x >> 3, y >> 3, 24) * 0.4; return karis(temel, 0.94 + leke * 0.12); }
    case "cimEski": { const t = gurultu(x >> 2, y >> 2, 18) > 0.5 ? 1.12 : 0.9; return karis(temel, t + gurultu(x, (y >> 1), 19) * 0.06 - 0.03); }
    case "orgu": { const ix = x % 8, iy = y % 8, damali = ((x >> 3) + (y >> 3)) % 2; const merkez = Math.hypot(ix - 4, iy - 4) < 3 ? 1.06 : 0.9; return karis(temel, (damali ? 0.92 : 1.0) * merkez); }
    case "demir": return karis(temel, 0.94 + gurultu(x >> 1, y, 20) * 0.1);
    case "metal": return karis(temel, 0.95 + (Math.sin(x * 0.3) * 0.5 + 0.5) * 0.06 + gurultu(x, y >> 2, 25) * 0.03);
    // kaplan kürkü: turuncu + siyah dalgalı şeritler (geometri değil, hücre)
    case "kurk": { const s = Math.sin(y * 0.28 + Math.sin(x * 0.11) * 1.4); if (s > 0.72) return [32, 26, 24]; return karis(temel, 0.94 + gurultu(x >> 1, y >> 1, 26) * 0.1); }
    // kedi: tekir bantları (örnek rengi çarpar → tekir/gri/siyahımsı)
    case "kedi": { const s = Math.sin(y * 0.35 + Math.sin(x * 0.09) * 1.2); if (s > 0.6) return karis(temel, 0.62); return karis(temel, 0.95 + gurultu(x >> 1, y >> 1, 27) * 0.1); }
    default: return temel;
  }
}

/** ESKİ desenler (Aşama 1) — A/B karşılaştırması için birebir korunur. */
function desenEski(tur, temel, x, y) {
  switch (tur) {
    case "siva": case "puruz": case "polar": case "metal": return karis(temel, 0.96 + gurultu(x, y) * 0.08);
    case "kumas": case "kot": return karis(temel, 0.94 + ((x + y) % 2) * 0.05 + gurultu(x, y, 2) * 0.04);
    case "tas": case "tasAcik": case "asfalt": case "deri": return karis(temel, gurultu(x >> 1, y >> 1, 3) > 0.9 ? 0.86 : 0.97 + gurultu(x, y, 4) * 0.06);
    case "ahsap": return karis(temel, 0.9 + Math.sin(y * 0.9 + gurultu(0, y, 5) * 2) * 0.06 + gurultu(x, y, 6) * 0.03);
    case "cam": return karis(temel, 0.85 + (x + y) / 128 * 0.35);
    case "orgu": return karis(temel, 0.9 + (((x >> 2) + (y >> 2)) % 2) * 0.12);
    case "tente": return ((x >> 3) % 2) ? [255, 250, 240] : temel;
    case "kiremit": { const sira = y >> 3, off = (sira % 2) * 8; const kenar = ((x + off) % 16) < 1 || (y % 8) < 1; return karis(temel, kenar ? 0.72 : 0.94 + gurultu(x >> 2, y >> 2, 7) * 0.1); }
    case "kaldirim": { const kenar = (x % 16) < 1 || (y % 16) < 1; return karis(temel, kenar ? 0.85 : 0.97 + gurultu(x >> 2, y >> 2, 8) * 0.05); }
    case "yaprak": case "cimEski": return karis(temel, 0.96 + gurultu(x, y) * 0.08);
    default: return temel;
  }
}

/** Hücre indeksleri (ad → [sütun, satır]). */
export const HUCRELER = Object.fromEntries(TANIM.map((t, i) => t ? [t[0], [i % N, Math.floor(i / N)]] : null).filter(Boolean));
if (TANIM.length > N * N) throw new Error("atlas: hücre sayısı 64'ü geçti");
for (const i of [36, 37, 38, 39, 44, 45, 46, 47, 52, 53, 54, 55, 60, 61, 62, 63]) if (TANIM[i]) throw new Error("atlas: yüz çeyreği hücresi dolu: " + i);

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
/** Çalışma anı için tüm hücre dikdörtgenleri (GLB extras'a yazılır). */
export function hucreTablosu() { return Object.fromEntries(Object.keys(HUCRELER).map((ad) => [ad, uvDikdortgen(ad)])); }

// ------------------------------------------------------------ YÜZ ÇEYREĞİ
const YUZ_PX = { insan: [512, 512], kaplan: [768, 512], robot: [512, 768], ifade: [768, 768] };
const rect = (px, py, boy, pay = PAY_YENI) => ({ u0: (px + pay) / BOY_YENI, v0: (py + pay) / BOY_YENI, u1: (px + boy - pay) / BOY_YENI, v1: (py + boy - pay) / BOY_YENI });
/** Yüz dokusu dikdörtgenleri (uv). */
export const YUZ = { insan: rect(...YUZ_PX.insan, 256), kaplan: rect(...YUZ_PX.kaplan, 256), robot: rect(...YUZ_PX.robot, 256) };
/** İfade karesi i (0..15): 4×4, 64 px. 0-7 göz, 8-15 ağız. */
export function ifadeRect(i) { const [bx, by] = YUZ_PX.ifade; return rect(bx + (i % 4) * 64, by + Math.floor(i / 4) * 64, 64, 3); }
export const IFADE = {
  goz: { acik: 0, kirpik: 1, mutlu: 2, saskin: 3, kisik: 4, kizgin: 5, robotAcik: 6, robotKapali: 7 },
  agiz: { notr: 8, gulumseme: 9, saskin: 10, sirit: 11, uzgun: 12, kucuk: 13, robotNotr: 14, robotGulus: 15 },
};

// --- küçük çizim yardımcıları (piksel kapsama, yumuşak kenar) ---
const TEN = hex("#F2C9A7"), KURK = hex("#E8892B"), METAL = hex("#C8CDD3"), KOYU = [42, 30, 28], BEYAZ = [255, 255, 255];
const IRIS = [38, 52, 84], PEMBE = [232, 120, 110], DUDAK = [176, 70, 62], SIYAN = [90, 220, 255], EKRAN = [27, 36, 48];
function elips(px, py, cx, cy, rx, ry) { const d = Math.hypot((px - cx) / rx, (py - cy) / ry); return Math.max(0, Math.min(1, (1 - d) * Math.min(rx, ry) + 0.5)); }
function cizgi(px, py, noktalar, kalin) { // çoklu doğru parçasına uzaklık → kapsama
  let en = 1e9;
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [ax, ay] = noktalar[i], [bx, by] = noktalar[i + 1];
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-6;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
    en = Math.min(en, Math.hypot(px - (ax + vx * t), py - (ay + vy * t)));
  }
  return Math.max(0, Math.min(1, kalin / 2 - en + 0.5));
}
function yay(cx, cy, r, a0, a1, n = 12) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
const kat = (c, renk, a) => c.map((v, i) => Math.round(v + (renk[i] - v) * a));

/** 256² insan yüzü: kaş, kirpik altı gölge, burun gölgesi, allık. Zemin = ten (kenar dikişi görünmez). */
function yuzInsan(x, y) {
  let c = TEN.slice();
  // Aşama 1D: boyalı burun gölgesi KALKTI — burun artık kafa geometrisinde (köşe itme); gölgesini ışık yapar.
  for (const s of [-1, 1]) {
    c = kat(c, PEMBE, 0.32 * elips(x, y, 128 + s * 52, 152, 17, 11));                                          // allık
    // kaş: kavisli, iç uç kalın
    const kx = 128 + s * 42;
    const kas = s < 0 ? [[kx - 22, 96], [kx - 10, 90], [kx + 6, 89], [kx + 20, 93]] : [[kx - 20, 93], [kx - 6, 89], [kx + 10, 90], [kx + 22, 96]];
    c = kat(c, KOYU, 0.9 * cizgi(x, y, kas, 5));
    // göz altı gölgesi kaldırıldı (göz dörtgeni zemini düz ten; fark oluşturuyordu)
  }
  return c;
}
/** 256² kaplan yüzü: turuncu kürk, siyah şeritler, krem göz yamaları + burun/ağız yaması, bıyık delikleri. */
function yuzKaplan(x, y) {
  let c = KURK.slice();
  c = karis(c, 0.95 + gurultu(x >> 1, y >> 1, 30) * 0.08);
  // alın şeritleri
  for (const [ox, k] of [[128, 1], [96, 0.9], [160, 0.9], [70, 0.8], [186, 0.8]]) {
    const yol = [[ox - 3, 26], [ox + 2, 48], [ox - 2, 68]];
    c = kat(c, KOYU, 0.92 * cizgi(x, y, yol, ox === 128 ? 7 : 5) * k);
  }
  // yanak şeritleri
  for (const s of [-1, 1]) {
    c = kat(c, KOYU, 0.88 * cizgi(x, y, [[128 + s * 118, 120], [128 + s * 98, 140], [128 + s * 106, 162]], 5));
    c = kat(c, KOYU, 0.88 * cizgi(x, y, [[128 + s * 122, 158], [128 + s * 102, 178]], 4));
    c = kat(c, TEN, 0.97 * elips(x, y, 128 + s * 46, 111, 26, 22));    // göz yaması (1D: gözler yana + yukarı; göz yamasının zemini)
    c = kat(c, KOYU, 0.85 * cizgi(x, y, [[128 + s * 24, 90], [128 + s * 46, 84], [128 + s * 68, 90]], 4)); // kaş
  }
  // 1D §3: muzzle geometrik — krem yama muzzle kütlesini kaplar; burun üçgeni koyu (tepe y 136 geniş, uç y 158); philtrum; bıyık delikleri
  c = kat(c, TEN, 0.98 * elips(x, y, 128, 160, 54, 40));
  c = kat(c, harman(TEN, BEYAZ, 0.5), 0.6 * elips(x, y, 128, 178, 30, 16));
  const bt = (y - 136) / 22;
  if (bt >= 0 && bt <= 1) c = kat(c, KOYU, 0.95 * Math.max(0, Math.min(1, 16 * (1 - bt) + 2 - Math.abs(x - 128))));
  c = kat(c, KOYU, 0.9 * cizgi(x, y, [[128, 158], [128, 170]], 2.5));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) c = kat(c, KOYU, 0.7 * elips(x, y, 128 + s * (16 + i * 9), 170 + i * 3, 2.2, 2.2));
  return c;
}
/**
 * 256² robot yüz EKRANI (1D §4): kafaya oturan emissive panelin dokusu — koyu cam, ince tarama çizgileri, merkezde
 * hafif parlaklık, metal çerçeve bandı, altta siyan durum çizgisi. (Yama süperelips; v aralığı 34–222 px örneklenir.)
 */
function yuzRobot(x, y) {
  let c = EKRAN.slice();
  if (y % 4 === 0) c = karis(c, 1.12);                                                                   // tarama çizgileri
  c = kat(c, karis(EKRAN, 1.6), 0.35 * Math.max(0, 1 - Math.hypot((x - 128) / 150, (y - 118) / 110)));  // merkez parlaklık
  const kenar = Math.min(x, 255 - x, y - 34, 222 - y);
  if (kenar >= 0 && kenar < 10) c = karis(c, 0.75);                                                    // kenar: cam koyulaşır (metal çerçeve bandı süperelipste çentikli göründü, kaldırıldı)
  c = kat(c, SIYAN, 0.8 * cizgi(x, y, [[70, 198], [186, 198]], 2.5));                                  // durum çizgisi
  for (let i = 0; i < 4; i++) c = kat(c, SIYAN, 0.7 * elips(x, y, 92 + i * 24, 208, 2.5, 2.5));
  return c;
}
/** 64² ifade karesi i. Zemin: insan/kaplan TEN (kenar ten rengi → geçiş görünmez), robot EKRAN (yama ekranın üstünde). */
function ifadeKare(i, x, y) {
  const robot = i === 6 || i === 7 || i === 14 || i === 15;
  let c = (robot ? EKRAN : TEN).slice();
  const goz = (rx, ry, bebek = 6, irisR = 11, bebekY = 36) => {
    c = kat(c, BEYAZ, elips(x, y, 32, 34, rx, ry));
    c = kat(c, IRIS, elips(x, y, 33, bebekY, irisR, irisR));
    c = kat(c, KOYU, elips(x, y, 33, bebekY, bebek, bebek));
    c = kat(c, BEYAZ, 0.9 * elips(x, y, 28, 30, 3.2, 3.2));
    c = kat(c, KOYU, 0.9 * cizgi(x, y, yay(32, 34, rx, Math.PI + 0.35, Math.PI * 2 - 0.35), 2.6)); // üst kapak
    c = kat(c, KOYU, 0.9 * cizgi(x, y, [[32 - rx * 0.92, 24], [32 - rx * 1.25, 18]], 2.2));           // kirpik
    c = kat(c, KOYU, 0.9 * cizgi(x, y, [[32 - rx * 0.6, 14], [32 - rx * 0.75, 8]], 2));
  };
  switch (i) {
    case 0: goz(23, 26, 7, 12.5, 35); break;                                                // açık (1D: yama küçüldü, çizim kareyi doldurur)
    case 1: c = kat(c, KOYU, cizgi(x, y, yay(32, 26, 21, 0.25, Math.PI - 0.25), 3.4)); break; // kırpma (aşağı kavis)
    case 2: c = kat(c, KOYU, cizgi(x, y, yay(32, 44, 21, Math.PI + 0.3, Math.PI * 2 - 0.3), 3.6)); break; // mutlu (yukarı kavis)
    case 3: goz(25, 28, 5, 10, 36); break;                                                  // şaşkın
    case 4: goz(19, 23); c = kat(c, TEN, x >= 0 && y < 30 ? 1 : 0); c = kat(c, KOYU, 0.9 * cizgi(x, y, [[12, 30], [52, 30]], 2.8)); break; // kısık
    case 5: goz(19, 22); c = kat(c, TEN, y < 18 + (x - 12) * 0.35 ? 1 : 0); c = kat(c, KOYU, 0.9 * cizgi(x, y, [[12, 18], [52, 32]], 2.8)); break; // kızgın
    case 6: c = kat(c, SIYAN, 0.3 * elips(x, y, 32, 32, 22, 18)); c = kat(c, SIYAN, elips(x, y, 32, 32, 11, 11)); c = kat(c, BEYAZ, 0.85 * elips(x, y, 28, 28, 3.5, 3.5)); break; // robot açık: halo + parlak göz (shader'da emissive)
    case 7: c = kat(c, SIYAN, cizgi(x, y, [[16, 32], [48, 32]], 4)); break; // robot kapalı
    case 8: c = kat(c, DUDAK, cizgi(x, y, yay(32, 22, 14, 0.5, Math.PI - 0.5), 3)); break;   // nötr (hafif kavis)
    case 9: c = kat(c, DUDAK, cizgi(x, y, yay(32, 18, 18, 0.35, Math.PI - 0.35), 4)); break; // gülümseme
    case 10: c = kat(c, KOYU, elips(x, y, 32, 34, 9, 12)); c = kat(c, DUDAK, elips(x, y, 32, 34, 11, 14) - elips(x, y, 32, 34, 8.5, 11.5)); break; // şaşkın O
    case 11: { const g = elips(x, y, 32, 30, 22, 13) * (y > 30 ? 1 : 0); c = kat(c, KOYU, g); c = kat(c, BEYAZ, g * (y < 39 ? 0.95 : 0)); c = kat(c, DUDAK, cizgi(x, y, yay(32, 30, 22, 0.15, Math.PI - 0.15), 3)); break; } // sırıtış
    case 12: c = kat(c, DUDAK, cizgi(x, y, yay(32, 46, 16, Math.PI + 0.4, Math.PI * 2 - 0.4), 3.4)); break; // üzgün
    case 13: c = kat(c, KOYU, elips(x, y, 32, 34, 5, 6)); break;                              // küçük o
    case 14: c = kat(c, SIYAN, 0.9 * cizgi(x, y, [[18, 32], [46, 32]], 3)); break; // robot nötr
    case 15: c = kat(c, SIYAN, 0.9 * cizgi(x, y, yay(32, 24, 12, 0.3, Math.PI - 0.3), 3)); break; // robot gülüş
  }
  return c;
}

/** Atlas PNG'si (Buffer). */
export function atlasCiz({ eski = false, yaprakEski = false } = {}) {
  const BOY = eski ? BOY_ESKI : BOY_YENI, HUCRE = BOY / N, ciz = eski ? desenEski : desen;
  const rgba = new Uint8Array(BOY * BOY * 4);
  const yaz = (px, py, c) => { const i = (py * BOY + px) * 4; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255; };
  for (const t of TANIM) {
    if (!t) continue;
    const [ad, renkHex, tur0] = t, [c, r] = HUCRELER[ad], temel = hex(renkHex);
    const tur = yaprakEski && tur0 === "yaprak" ? "cimEski" : tur0;
    for (let y = 0; y < HUCRE; y++) for (let x = 0; x < HUCRE; x++) yaz(c * HUCRE + x, r * HUCRE + y, ciz(tur, temel, x, y));
  }
  if (!eski) {
    for (const [ad, fn] of [["insan", yuzInsan], ["kaplan", yuzKaplan], ["robot", yuzRobot]]) {
      const [bx, by] = YUZ_PX[ad];
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) yaz(bx + x, by + y, fn(x, y));
    }
    const [ix, iy] = YUZ_PX.ifade;
    for (let i = 0; i < 16; i++) { const ox = ix + (i % 4) * 64, oy = iy + Math.floor(i / 4) * 64; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) yaz(ox + x, oy + y, ifadeKare(i, x, y)); }
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
