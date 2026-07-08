// ============================================================
// Parametrik gladyatör çizimi (kuş bakışı, ekran koordinatında).
// Profesyonel/gladyatör temalı: metalik zırh gölgelendirmesi, omuzluk,
// bronz miğfer + tepelik (crest), pelerin, yön ışığı. Hazır asset YOK (tasarım 3.13).
// ============================================================

import { cizSilah, cizKalkan } from "./itemCizim.js";
import { cizSprite, varlikVar } from "../lib/varliklar.js";

// --- Renk yardımcıları (ton açma/koyulaştırma) ---
function hexRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function ton(hex, d) {
  const c = hexRgb(hex);
  const k = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`;
}

// ctx: 2D bağlam. (sx,sy): ekran merkezi. r: ekran yarıçapı. e: oyuncu. bensin: sen mi.
export function cizGladyator(ctx, sx, sy, r, e, bensin) {
  const { aci, palet } = e;
  const bx = Math.cos(aci), by = Math.sin(aci);       // ileri (bakış)
  const px = -by, py = bx;                              // sağ (dik)
  const lx = -0.5, ly = -0.5;                           // ışık yönü (sol-üst)

  // 1) Yumuşak gölge (ışığın tersinde hafif kayık)
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(sx + 0.25 * r, sy + r * 0.52, r * 1.05, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // === SPRITE MODU: karakter görseli varsa onu kullan (kod çizimi atlanır) ===
  const govdeAd = e.karakterId ? "gladyator_" + e.karakterId : null;
  if (govdeAd && varlikVar(govdeAd)) {
    // Kalkan (sprite veya kod yedeği)
    if (e.kalkanCizim) {
      const kx = sx + bx * r * 0.35 - px * r * 0.6;
      const ky = sy + by * r * 0.35 - py * r * 0.6;
      if (!cizSprite(ctx, "kalkan_" + e.kalkanCizim, kx, ky, r * 1.7, aci)) {
        cizKalkan(ctx, sx, sy, r, aci, e.kalkanCizim, e.kalkanRenk || palet.zirh, !!e.kalkanKalkik);
      }
    }
    // Gövde (karakter sprite'ı)
    cizSprite(ctx, govdeAd, sx, sy, r * 2.9, aci);
    // Silah (sprite veya kod yedeği); pasifse soluk
    if (e.silahCizim) {
      if (e.silahAktif === false) ctx.globalAlpha = 0.4;
      const hx = sx + bx * r * 0.5 + px * r * 0.55;
      const hy = sy + by * r * 0.5 + py * r * 0.55;
      if (!cizSprite(ctx, "silah_" + e.silahCizim, hx, hy, r * 2.0, aci)) {
        cizSilah(ctx, sx, sy, r, aci, e.silahCizim);
      }
      ctx.globalAlpha = 1;
    }
    if (bensin) {
      ctx.strokeStyle = "#f6c453";
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.setLineDash([r * 0.55, r * 0.4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    return;
  }

  // === KOD ÇİZİM MODU (sprite yoksa yedek) ===
  // 2) Pelerin (bakışın tersine kısa yelpaze)
  const pel = e.pelerinRenk || ton(palet.zirh, -20);
  {
    const arka = 1.5;
    const g = ctx.createLinearGradient(sx, sy, sx - bx * r * arka, sy - by * r * arka);
    g.addColorStop(0, ton(pel, 30));
    g.addColorStop(1, ton(pel, -40));
    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(sx + px * r * 0.6, sy + py * r * 0.6);
    ctx.quadraticCurveTo(sx - bx * r * 1.25 + px * r * 0.55, sy - by * r * 1.25 + py * r * 0.55, sx - bx * r * arka, sy - by * r * arka);
    ctx.quadraticCurveTo(sx - bx * r * 1.25 - px * r * 0.55, sy - by * r * 1.25 - py * r * 0.55, sx - px * r * 0.6, sy - py * r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(sx - bx * r * 0.3, sy - by * r * 0.3);
    ctx.lineTo(sx - bx * r * arka, sy - by * r * arka);
    ctx.stroke();
  }

  // 3) Kalkan (sol kol, arkada)
  if (e.kalkanCizim) {
    cizKalkan(ctx, sx, sy, r, aci, e.kalkanCizim, e.kalkanRenk || palet.zirh, !!e.kalkanKalkik);
  }

  // 4) Kollar/bacak teni (zırhın altında ince ten halkası — hacim/okunurluk)
  ctx.fillStyle = ton(palet.ten, -35);
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.98, 0, Math.PI * 2);
  ctx.fill();

  // 5) Gövde zırhı — metalik radyal gradyan + koyu dış hat
  const zg = ctx.createRadialGradient(sx + lx * r * 0.5, sy + ly * r * 0.5, r * 0.12, sx, sy, r * 0.95);
  zg.addColorStop(0, ton(palet.zirh, 75));
  zg.addColorStop(0.55, palet.zirh);
  zg.addColorStop(1, ton(palet.zirh, -55));
  ctx.fillStyle = zg;
  ctx.strokeStyle = "rgba(18,10,4,0.55)";
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // göğüs plakası ekseni
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(sx - bx * r * 0.5, sy - by * r * 0.5);
  ctx.lineTo(sx + bx * r * 0.5, sy + by * r * 0.5);
  ctx.stroke();
  // üst-sol rim light
  ctx.strokeStyle = "rgba(255,245,220,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.84, Math.PI * 0.9, Math.PI * 1.5);
  ctx.stroke();

  // 6) Omuzluklar (pauldron) — iki metalik kubbe
  for (const s of [1, -1]) {
    const ox = sx + px * r * 0.82 * s, oy = sy + py * r * 0.82 * s;
    const pg = ctx.createRadialGradient(ox + lx * r * 0.2, oy + ly * r * 0.2, r * 0.04, ox, oy, r * 0.42);
    pg.addColorStop(0, ton(palet.zirh, 95));
    pg.addColorStop(1, ton(palet.zirh, -45));
    ctx.fillStyle = pg;
    ctx.strokeStyle = "rgba(18,10,4,0.5)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(ox, oy, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 7) Baş: bronz miğfer + tepelik (crest) + yüz
  const hx = sx + bx * r * 0.15, hy = sy + by * r * 0.15;
  // miğfer kubbe (bronz)
  const mg = ctx.createRadialGradient(hx + lx * r * 0.25, hy + ly * r * 0.25, r * 0.04, hx, hy, r * 0.6);
  mg.addColorStop(0, "#e2be80");
  mg.addColorStop(0.6, "#a9793f");
  mg.addColorStop(1, "#5b3f20");
  ctx.fillStyle = mg;
  ctx.strokeStyle = "rgba(18,10,4,0.5)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // tepelik (crest) — bakış ekseni boyunca, karakterin zırh renginde bir ibik
  const cg = ctx.createLinearGradient(hx + bx * r * 0.5, hy + by * r * 0.5, hx - bx * r * 0.6, hy - by * r * 0.6);
  cg.addColorStop(0, ton(palet.zirh, 55));
  cg.addColorStop(1, ton(palet.zirh, -35));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(hx - bx * r * 0.02, hy - by * r * 0.02, r * 0.6, r * 0.2, aci, 0, Math.PI * 2);
  ctx.fill();
  // tepelik parlaması
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(hx - bx * r * 0.5, hy - by * r * 0.5);
  ctx.lineTo(hx + bx * r * 0.45, hy + by * r * 0.45);
  ctx.stroke();
  // yüz açıklığı (ten) — önde
  ctx.fillStyle = ton(palet.ten, 8);
  ctx.beginPath();
  ctx.arc(hx + bx * r * 0.3, hy + by * r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // göz/burun gölge vurgusu
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.arc(hx + bx * r * 0.42, hy + by * r * 0.42, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // 8) Silah (pasifse soluk)
  if (e.silahCizim) {
    if (e.silahAktif === false) ctx.globalAlpha = 0.4;
    cizSilah(ctx, sx, sy, r, aci, e.silahCizim);
    ctx.globalAlpha = 1;
  }

  // 9) "Sen" göstergesi: altın kesikli çeper
  if (bensin) {
    ctx.strokeStyle = "#f6c453";
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.setLineDash([r * 0.55, r * 0.4]);
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// İsim + can barı (ekran koordinatı, r ekran yarıçapı).
export function cizEtiket(ctx, sx, sy, r, e, canMax) {
  const genislik = Math.max(38, r * 2.6);
  const yuk = Math.max(4, r * 0.28);
  const ust = sy - r - yuk - 16;

  // Can barı zemini + çerçeve
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(sx - genislik / 2 - 1, ust - 1, genislik + 2, yuk + 2);
  const oran = Math.max(0, Math.min(1, e.can / canMax));
  const cg = ctx.createLinearGradient(sx - genislik / 2, ust, sx - genislik / 2, ust + yuk);
  const ust2 = oran > 0.5 ? "#7fe07f" : oran > 0.25 ? "#f0cf5a" : "#e8685a";
  const alt2 = oran > 0.5 ? "#3f9f3f" : oran > 0.25 ? "#b8901e" : "#a83226";
  cg.addColorStop(0, ust2);
  cg.addColorStop(1, alt2);
  ctx.fillStyle = cg;
  ctx.fillRect(sx - genislik / 2, ust, genislik * oran, yuk);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx - genislik / 2, ust, genislik, yuk);

  // İsim
  ctx.fillStyle = e.bot ? "#e8dcc0" : "#f6c453";
  ctx.font = `600 ${Math.max(11, Math.round(r * 0.6))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 3;
  ctx.fillText(e.ad, sx, ust - 3);
  ctx.shadowBlur = 0;
}
