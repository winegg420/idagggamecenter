// ============================================================
// Silah ve kalkan çizimi (kuş bakışı, ekran koordinatı).
// Görsel olarak birbirinden ayrışır ama hepsi eşit güçtedir (tasarım 3.1).
// (sx,sy): karakter merkezi. r: karakter ekran yarıçapı. aci: bakış yönü.
// ============================================================

const CELIK = "#c7ccd4";
const CELIK_KOYU = "#8a9099";
const AHSAP = "#6b4a2a";

// Bakış yönünde "el" konumu ve dik (perpendicular) vektör.
function eksenler(aci) {
  return {
    fx: Math.cos(aci), fy: Math.sin(aci),      // ileri
    px: Math.cos(aci + Math.PI / 2), py: Math.sin(aci + Math.PI / 2), // sağ
  };
}

export function cizSilah(ctx, sx, sy, r, aci, cizimTipi) {
  const { fx, fy, px, py } = eksenler(aci);
  // El: gövdenin biraz sağ-önünde
  const hx = sx + fx * r * 0.5 + px * r * 0.55;
  const hy = sy + fy * r * 0.5 + py * r * 0.55;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cizgi = (x1, y1, x2, y2, w, renk) => {
    ctx.strokeStyle = renk;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  switch (cizimTipi) {
    case "bicak":
      cizgi(hx, hy, hx + fx * r * 0.8, hy + fy * r * 0.8, r * 0.16, CELIK);
      break;
    case "cift_bicak":
      cizgi(hx - px * r * 0.2, hy - py * r * 0.2, hx + fx * r * 0.75 - px * r * 0.2, hy + fy * r * 0.75 - py * r * 0.2, r * 0.14, CELIK);
      cizgi(hx + px * r * 0.2, hy + py * r * 0.2, hx + fx * r * 0.75 + px * r * 0.2, hy + fy * r * 0.75 + py * r * 0.2, r * 0.14, CELIK);
      break;
    case "sica": {
      // Kıvrık kısa kılıç: hafif eğri
      ctx.strokeStyle = CELIK;
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + fx * r * 0.9 + px * r * 0.2, hy + fy * r * 0.9 + py * r * 0.2, hx + fx * r * 1.3 + px * r * 0.6, hy + fy * r * 1.3 + py * r * 0.6);
      ctx.stroke();
      break;
    }
    case "mizrak":
      cizgi(hx - fx * r * 0.3, hy - fy * r * 0.3, hx + fx * r * 1.7, hy + fy * r * 1.7, r * 0.11, AHSAP);
      // uç
      ctx.fillStyle = CELIK;
      ctx.beginPath();
      ctx.moveTo(hx + fx * r * 1.9, hy + fy * r * 1.9);
      ctx.lineTo(hx + fx * r * 1.55 + px * r * 0.18, hy + fy * r * 1.55 + py * r * 0.18);
      ctx.lineTo(hx + fx * r * 1.55 - px * r * 0.18, hy + fy * r * 1.55 - py * r * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    case "trident":
      cizgi(hx - fx * r * 0.3, hy - fy * r * 0.3, hx + fx * r * 1.5, hy + fy * r * 1.5, r * 0.11, AHSAP);
      for (const o of [-0.28, 0, 0.28]) {
        cizgi(
          hx + fx * r * 1.4 + px * r * o, hy + fy * r * 1.4 + py * r * o,
          hx + fx * r * 1.9 + px * r * o, hy + fy * r * 1.9 + py * r * o,
          r * 0.09, CELIK
        );
      }
      break;
    case "balta":
    case "cekic": {
      cizgi(hx, hy, hx + fx * r * 1.1, hy + fy * r * 1.1, r * 0.12, AHSAP);
      const ex = hx + fx * r * 1.1, ey = hy + fy * r * 1.1;
      ctx.fillStyle = cizimTipi === "cekic" ? CELIK_KOYU : CELIK;
      if (cizimTipi === "cekic") {
        ctx.fillRect(ex - r * 0.3, ey - r * 0.3, r * 0.6, r * 0.6);
      } else {
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + px * r * 0.5 + fx * r * 0.25, ey + py * r * 0.5 + fy * r * 0.25);
        ctx.lineTo(ex + px * r * 0.5 - fx * r * 0.35, ey + py * r * 0.5 - fy * r * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "zincirli_topuz":
      // Sap + zincir (noktalı) + top
      cizgi(hx, hy, hx + fx * r * 0.7, hy + fy * r * 0.7, r * 0.12, AHSAP);
      ctx.strokeStyle = CELIK_KOYU;
      ctx.lineWidth = r * 0.06;
      ctx.setLineDash([r * 0.12, r * 0.1]);
      ctx.beginPath();
      ctx.moveTo(hx + fx * r * 0.7, hy + fy * r * 0.7);
      ctx.lineTo(hx + fx * r * 1.4, hy + fy * r * 1.4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = CELIK;
      ctx.beginPath();
      ctx.arc(hx + fx * r * 1.55, hy + fy * r * 1.55, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "kilic":
    default:
      cizgi(hx, hy, hx + fx * r * 1.4, hy + fy * r * 1.4, r * 0.17, CELIK);
      // kabza
      cizgi(hx - px * r * 0.22, hy - py * r * 0.22, hx + px * r * 0.22, hy + py * r * 0.22, r * 0.1, "#3a2a18");
      break;
  }
  ctx.restore();
}

export function cizKalkan(ctx, sx, sy, r, aci, cizimTipi, renk, aktif = true) {
  const { fx, fy, px, py } = eksenler(aci);
  // Kalkan: gövdenin sol-önünde
  const kx = sx + fx * r * 0.35 - px * r * 0.6;
  const ky = sy + fy * r * 0.35 - py * r * 0.6;
  const boy = r * (cizimTipi === "kucuk" ? 0.6 : 0.85);

  ctx.save();
  ctx.translate(kx, ky);
  ctx.rotate(aci);
  ctx.fillStyle = renk || "#7a5a2a";
  ctx.strokeStyle = aktif ? "#f6c453" : "rgba(120,120,120,0.7)";
  ctx.lineWidth = Math.max(1.5, r * 0.12);

  ctx.beginPath();
  switch (cizimTipi) {
    case "kare":
    case "sovalye":
      ctx.rect(-boy * 0.7, -boy, boy * 1.4, boy * 2);
      break;
    case "savasci":
      // Altıgen benzeri
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * boy, y = Math.sin(a) * boy * 1.15;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case "yuvarlak":
    case "kucuk":
    default:
      ctx.arc(0, 0, boy, 0, Math.PI * 2);
      break;
  }
  ctx.fill();
  ctx.stroke();
  // Göbek (umbo)
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(0, 0, boy * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
