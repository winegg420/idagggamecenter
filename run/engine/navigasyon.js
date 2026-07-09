// ============================================================
// RUN — navigasyon: çıkışlara doğru BFS akış alanı (flow field).
// Odalar duvarlandığı için botlar artık düz çizgide çıkışa gidemez; kaçış
// modunda bu alanı takip ederler. Alan bir kez (modül yüklenirken) kurulur.
// `ulasilabilirOran` harita üretiminin sağlamasını yapmak için kullanılır.
// ============================================================

import { OFIS, yurunebilir } from "./harita.js";

const HUCRE = 26;                       // ızgara çözünürlüğü (kapı geçidi ~76px → 2-3 hücre)
const ENGELLI = -1, ULASILMAZ = -2;

function alanKur(harita) {
  const kol = Math.ceil(harita.genislik / HUCRE);
  const sat = Math.ceil(harita.yukseklik / HUCRE);
  const mesafe = new Int32Array(kol * sat).fill(ULASILMAZ);

  const merkez = (c, r) => [c * HUCRE + HUCRE / 2, r * HUCRE + HUCRE / 2];
  const yurunur = new Uint8Array(kol * sat);
  for (let r = 0; r < sat; r++) {
    for (let c = 0; c < kol; c++) {
      const [x, y] = merkez(c, r);
      yurunur[r * kol + c] = yurunebilir(harita, x, y) ? 1 : 0;
    }
  }

  // Kaynak: çıkış dikdörtgenlerinin kapsadığı yürünebilir hücreler
  const kuyruk = [];
  for (const ck of harita.cikislar) {
    const c0 = Math.floor(ck.x / HUCRE), c1 = Math.floor((ck.x + ck.w) / HUCRE);
    const r0 = Math.floor(ck.y / HUCRE), r1 = Math.floor((ck.y + ck.h) / HUCRE);
    for (let r = r0; r <= r1 && r < sat; r++) {
      for (let c = c0; c <= c1 && c < kol; c++) {
        const i = r * kol + c;
        if (r < 0 || c < 0 || !yurunur[i] || mesafe[i] >= 0) continue;
        mesafe[i] = 0; kuyruk.push(i);
      }
    }
  }

  // BFS (4 komşu — köşe kesme yok, duvar köşesinden sızmasınlar)
  for (let bas = 0; bas < kuyruk.length; bas++) {
    const i = kuyruk[bas], c = i % kol, r = (i - c) / kol;
    const komsular = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
    for (const [nc, nr] of komsular) {
      if (nc < 0 || nr < 0 || nc >= kol || nr >= sat) continue;
      const j = nr * kol + nc;
      if (!yurunur[j] || mesafe[j] >= 0) continue;
      mesafe[j] = mesafe[i] + 1; kuyruk.push(j);
    }
  }
  for (let i = 0; i < mesafe.length; i++) if (!yurunur[i]) mesafe[i] = ENGELLI;

  return { kol, sat, mesafe, yurunur };
}

const ALAN = alanKur(OFIS);

// (x,y) noktasından çıkışa doğru birim yön vektörü. Yol yoksa null.
export function cikisYonu(x, y) {
  const c = Math.floor(x / HUCRE), r = Math.floor(y / HUCRE);
  if (c < 0 || r < 0 || c >= ALAN.kol || r >= ALAN.sat) return null;
  const i = r * ALAN.kol + c;
  if (ALAN.mesafe[i] === ENGELLI) return null;
  if (ALAN.mesafe[i] === 0) return null;             // zaten çıkışta

  let enIyi = ALAN.mesafe[i] < 0 ? Infinity : ALAN.mesafe[i], hc = -1, hr = -1;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= ALAN.kol || nr >= ALAN.sat) continue;
      // Çapraz adımda iki dik komşu da açık olmalı (duvar köşesinden geçmesin)
      if (dc && dr && (!ALAN.yurunur[r * ALAN.kol + nc] || !ALAN.yurunur[nr * ALAN.kol + c])) continue;
      const m = ALAN.mesafe[nr * ALAN.kol + nc];
      if (m < 0) continue;
      if (m < enIyi) { enIyi = m; hc = nc; hr = nr; }
    }
  }
  if (hc < 0) return null;
  const hx = hc * HUCRE + HUCRE / 2, hy = hr * HUCRE + HUCRE / 2;
  const dx = hx - x, dy = hy - y, uz = Math.hypot(dx, dy) || 1;
  return { x: dx / uz, y: dy / uz };
}

// Yürünebilir hücrelerin kaçı çıkışa ulaşabiliyor (harita sağlaması: 1 olmalı).
export function ulasilabilirOran() {
  let yur = 0, ulasan = 0;
  for (let i = 0; i < ALAN.mesafe.length; i++) {
    if (!ALAN.yurunur[i]) continue;
    yur++;
    if (ALAN.mesafe[i] >= 0) ulasan++;
  }
  return yur ? ulasan / yur : 0;
}
