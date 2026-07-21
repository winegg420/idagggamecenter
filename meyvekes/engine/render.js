// ============================================================
// MEYVE KES — çizim (canvas)
// Alt katman: canlı ön kamera görüntüsü (aynalı, cover). Üstünde meyveler,
// kesilmiş yarımlar, splat parçacıkları, her el için soluklaşan bıçak izi
// ve uçan puan metinleri.
// ============================================================

import { meyveSprite } from "./meyveler.js";

// Ön kamera görüntüsünü cover + ayna ile ekrana taşıyan koordinat eşleyici.
export function koordinatHesap(video, W, H) {
  const vw = video?.videoWidth || 640;
  const vh = video?.videoHeight || 480;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s;
  const dh = vh * s;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  return {
    ox,
    oy,
    dw,
    dh,
    // normalize landmark (nx,ny) -> ekran px (aynalı)
    esle(nx, ny) {
      const px = ox + nx * vw * s;
      const py = oy + ny * vh * s;
      return { x: W - px, y: py };
    },
  };
}

function videoCiz(ctx, video, k, W) {
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  try {
    ctx.drawImage(video, k.ox, k.oy, k.dw, k.dh);
  } catch {
    /* video henüz hazır değil */
  }
  ctx.restore();
}

function meyveCiz(ctx, f) {
  const boyut = Math.round(f.r * 2.4);
  const sprite = meyveSprite(f.meyve, boyut);
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.aci);
  if (f.meyve.altin) {
    ctx.shadowColor = "rgba(255,210,31,0.9)";
    ctx.shadowBlur = 22;
  }
  const cizB = f.r * 2.1;
  if (sprite) ctx.drawImage(sprite, -cizB / 2, -cizB / 2, cizB, cizB);
  ctx.restore();
}

function yarimCiz(ctx, y) {
  const boyut = Math.round(y.r * 2.4);
  const sprite = meyveSprite(y.meyve, boyut);
  if (!sprite) return;
  const cizB = y.r * 2.1;
  const bosluk = 6;
  ctx.save();
  ctx.globalAlpha = Math.max(0, y.alfa);
  ctx.translate(y.x, y.y);
  ctx.rotate(y.aci);
  ctx.beginPath();
  if (y.yari === "ust") ctx.rect(-cizB, -cizB, cizB * 2, cizB - bosluk);
  else ctx.rect(-cizB, bosluk, cizB * 2, cizB);
  ctx.clip();
  ctx.drawImage(sprite, -cizB / 2, -cizB / 2, cizB, cizB);
  // kesik yüzeyi ışıltısı
  ctx.globalAlpha *= 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-cizB * 0.5, y.yari === "ust" ? -bosluk : bosluk);
  ctx.lineTo(cizB * 0.5, y.yari === "ust" ? -bosluk : bosluk);
  ctx.stroke();
  ctx.restore();
}

function izCiz(ctx, iz, t) {
  if (!iz || iz.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < iz.length; i++) {
    const a = iz[i - 1];
    const b = iz[i];
    const yas = (t - b.t) / 0.2; // 0=taze, 1=eski (IZ_OMUR ile hizalı)
    const alfa = Math.max(0, 1 - yas);
    const kalinlik = 3 + 16 * (i / iz.length) * alfa;
    ctx.strokeStyle = `rgba(180,240,255,${alfa * 0.5})`;
    ctx.lineWidth = kalinlik + 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alfa})`;
    ctx.lineWidth = kalinlik;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function parcacikCiz(ctx, p) {
  const alfa = Math.max(0, 1 - p.t / p.omur);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = p.renk;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * (1 - p.t / p.omur * 0.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function popupCiz(ctx, pp) {
  const alfa = Math.max(0, 1 - pp.t / pp.omur);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = pp.renk;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${pp.buyuk ? 34 : 24}px system-ui, sans-serif`;
  ctx.strokeText(pp.metin, pp.x, pp.y);
  ctx.fillText(pp.metin, pp.x, pp.y);
  ctx.restore();
}

// Ana çizim. eller: ham landmark (el iskeleti ipucu için).
export function ciz(ctx, oyun, video, k, W, H, eller) {
  ctx.clearRect(0, 0, W, H);
  videoCiz(ctx, video, k, W);

  // hafif karartma (meyveler öne çıksın)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  for (const f of oyun.meyveler) meyveCiz(ctx, f);
  for (const y of oyun.yarilar) yarimCiz(ctx, y);
  for (const p of oyun.parcaciklar) parcacikCiz(ctx, p);

  // el noktaları (parmak uçlarında küçük ışıklar)
  ctx.save();
  for (const el of eller) {
    for (const idx of [4, 8, 12, 16, 20]) {
      const n = el.noktalar[idx];
      if (!n) continue;
      const pt = k.esle(n.x, n.y);
      ctx.fillStyle = "rgba(180,240,255,0.75)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  for (const iz of oyun.izler) izCiz(ctx, iz, oyun._t);
  for (const pp of oyun.popuplar) popupCiz(ctx, pp);
}
