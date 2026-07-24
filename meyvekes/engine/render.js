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

// Fruit Ninja tarzı pala izi: uçlarda sivri, ortada dolgun BEYAZ şerit +
// altında mavimsi yumuşak parıltı. Yalnız hareket varken nokta biriktiği için
// (bkz. oyun.js IZ_MIN_HAREKET) el dururken hiç çizilmez. shadowBlur yok —
// katmanlı additif çizim (mobilde ucuz, parlak bıçak).
const IZ_OMUR = 0.18; // oyun.js ile aynı olmalı
const IZ_MAKS_EN = 16; // pala yarı-genişlik tavanı (px)

function izCiz(ctx, iz, t) {
  if (!iz || iz.length < 2) return;
  // yalnız taze noktalar (eskiler motorda süzülür ama garanti)
  const pts = [];
  for (const p of iz) if (t - p.t < IZ_OMUR) pts.push(p);
  const n = pts.length;
  if (n < 2) return;

  // her nokta için yarı-genişlik: uçta sivri (taper→0), ortada dolgun; tazelikle çarpılır
  const hw = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1); // 0 = eski kuyruk, 1 = yeni uç
    const tazelik = Math.max(0, 1 - (t - pts[i].t) / IZ_OMUR);
    const taper = Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.06)));
    hw[i] = IZ_MAKS_EN * taper * (0.4 + 0.6 * tazelik);
  }

  // şerit kenar noktaları (merkez çizgiye dik ofset)
  const sol = new Array(n);
  const sag = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    sol[i] = { x: pts[i].x + nx * hw[i], y: pts[i].y + ny * hw[i] };
    sag[i] = { x: pts[i].x - nx * hw[i], y: pts[i].y - ny * hw[i] };
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  // 1) yumuşak parıltı — merkez çizgiyi kalın, düşük alfa, mavimsi çiz
  ctx.strokeStyle = "rgba(120,190,255,0.35)";
  ctx.lineWidth = IZ_MAKS_EN * 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // 2) beyaz pala gövdesi (sivri uçlu şerit)
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.moveTo(sol[0].x, sol[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(sol[i].x, sol[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(sag[i].x, sag[i].y);
  ctx.closePath();
  ctx.fill();

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

// Ana çizim. Kamera + meyveler + (yalnız hareket varken) Fruit Ninja pala izi.
// El hareketsizken hiçbir bıçak/iz çizilmez — gerçek kol zaten kamerada görünür.
export function ciz(ctx, oyun, video, k, W, H) {
  ctx.clearRect(0, 0, W, H);
  videoCiz(ctx, video, k, W);

  // hafif karartma (meyveler öne çıksın)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  for (const f of oyun.meyveler) meyveCiz(ctx, f);
  for (const y of oyun.yarilar) yarimCiz(ctx, y);
  for (const p of oyun.parcaciklar) parcacikCiz(ctx, p);

  // bıçak izi (meyvelerin üstünde, savurma yönünde parlar)
  for (const iz of oyun.izler) izCiz(ctx, iz, oyun._t);
  for (const pp of oyun.popuplar) popupCiz(ctx, pp);
}
