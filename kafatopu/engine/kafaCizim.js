// ============================================================
// KAFA TOPU — oyuncu çizimi (kafa + forma/gövde + animasyon).
// Foto kafalar daire içine kırpılıp çizilir ve fiziksel harekete göre
// canlanır: koşarken eğilme, zıplarken gerilme, vuruşta öne sallanma,
// inişte hafif ezilme. Kurgusal kafalar prosedürel çizilir.
// ============================================================

import { OYUNCU } from "../shared/sabitler.js";
import { fotoKafaImg } from "../shared/karakterler.js";
import { EFEKT_BAYRAK } from "./gucler.js";

export const TAKIM_RENK = {
  1: { forma: "#e23b3b", koyu: "#a31f1f", ad: "Kırmızı" },
  2: { forma: "#2f6fe0", koyu: "#1b479c", ad: "Mavi" },
};

// oy: { x, y, vx, vy, va, ol, ef } — anlikDurum paketindeki oyuncu kaydı
// m: meta { takim, kafaKaydi (kafaBul sonucu), ad }
export function oyuncuCiz(ctx, oy, m, simMs) {
  const r = OYUNCU.KAFA_R * (oy.ol || 1);
  const bakis = m.takim === 1 ? 1 : -1; // takım 1 sağa, takım 2 sola bakar
  const renk = TAKIM_RENK[m.takim];

  // --- Animasyon parametreleri ---
  const vurusYasi = simMs - (oy.va ?? -9999);
  const vurusta = vurusYasi >= 0 && vurusYasi < 260;
  const vurusFaz = vurusta ? Math.sin((vurusYasi / 260) * Math.PI) : 0;

  const bayilmis = (oy.ef || 0) & EFEKT_BAYRAK.bayilmis;

  // Eğilme: koşarken hıza göre, vuruşta öne sallanma, bayılınca sersem sallanma
  const egilme =
    Math.max(-0.16, Math.min(0.16, (oy.vx || 0) * 0.014)) +
    vurusFaz * 0.22 * bakis +
    (bayilmis ? Math.sin(simMs / 90) * 0.18 : 0);
  // Dikeyde gerilme/ezilme: zıplarken uzar, düşerken hafif basıklaşır
  const vy = oy.vy || 0;
  const gerilme = Math.max(-0.08, Math.min(0.1, -vy * 0.008));

  ctx.save();
  ctx.translate(oy.x, oy.y);

  // --- Gövde (forma + bacaklar) kafanın altına çizilir ---
  const govdeY = r * 0.72;
  ctx.save();
  ctx.translate(0, govdeY);

  // Bacaklar (vuruş animasyonu: ön bacak öne savrulur)
  const bacakBoy = r * 0.62;
  const savrulma = vurusFaz * r * 0.95;
  ctx.strokeStyle = "#2b2b33";
  ctx.lineWidth = Math.max(5, r * 0.16);
  ctx.lineCap = "round";
  // arka bacak
  ctx.beginPath();
  ctx.moveTo(-bakis * r * 0.16, r * 0.30);
  ctx.lineTo(-bakis * r * 0.30, r * 0.30 + bacakBoy);
  ctx.stroke();
  // ön bacak (vuran)
  ctx.beginPath();
  ctx.moveTo(bakis * r * 0.16, r * 0.30);
  ctx.lineTo(bakis * (r * 0.26 + savrulma), r * 0.30 + bacakBoy - vurusFaz * bacakBoy * 0.55);
  ctx.stroke();
  // ayakkabılar
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.ellipse(-bakis * r * 0.30, r * 0.30 + bacakBoy, r * 0.18, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    bakis * (r * 0.26 + savrulma), r * 0.30 + bacakBoy - vurusFaz * bacakBoy * 0.55,
    r * 0.18, r * 0.09, 0, 0, Math.PI * 2
  );
  ctx.fill();

  // Forma (takım rengi — takım ayrımının ana göstergesi)
  const fg = ctx.createLinearGradient(0, -r * 0.1, 0, r * 0.42);
  fg.addColorStop(0, renk.forma);
  fg.addColorStop(1, renk.koyu);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(-r * 0.42, -r * 0.12, r * 0.84, r * 0.5, r * 0.14);
  ctx.fill();
  // forma numarası şeridi
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-r * 0.42, r * 0.02, r * 0.84, r * 0.07);
  ctx.restore();

  // --- Kafa (eğilme + gerilme dönüşümüyle) ---
  ctx.save();
  ctx.rotate(egilme);
  ctx.scale(1 - gerilme * 0.6, 1 + gerilme);

  // Efekt auraları
  const ef = oy.ef || 0;
  if (ef & EFEKT_BAYRAK.ates) aura(ctx, r, "rgba(255,120,20,0.5)", simMs);
  if (ef & EFEKT_BAYRAK.buz) aura(ctx, r, "rgba(110,210,255,0.5)", simMs);
  if (ef & EFEKT_BAYRAK.hiz) aura(ctx, r, "rgba(180,255,120,0.4)", simMs);
  if (ef & EFEKT_BAYRAK.dev_sut) aura(ctx, r, "rgba(255,220,60,0.45)", simMs);

  const img = m.kafaKaydi?.foto ? fotoKafaImg(m.kafaKaydi.id) : null;
  if (img) {
    // Foto kafa: daire kırpma + takım rengi çerçeve.
    // Manifest'teki odak/yarıçap ile yüz, görselin neresindeyse oradan kesilir.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    // Yüz rakibe baksın: takım 2 için aynala
    ctx.scale(bakis, 1);
    const kk = m.kafaKaydi;
    const sr = (kk.yaricap ?? 0.5) * Math.min(img.width, img.height);
    const sx = (kk.odakX ?? 0.5) * img.width - sr;
    const sy = (kk.odakY ?? 0.5) * img.height - sr;
    ctx.drawImage(img, sx, sy, sr * 2, sr * 2, -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = renk.forma;
    ctx.lineWidth = Math.max(3, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    kurgusalYuzCiz(ctx, r, bakis, m.kafaKaydi?.cizim, renk);
  }

  ctx.restore(); // kafa dönüşümü

  // Bayılma: kafanın üstünde dönen yıldızlar
  if (bayilmis) {
    ctx.font = `${Math.max(14, r * 0.4)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let s = 0; s < 3; s++) {
      const a = simMs / 240 + (s * Math.PI * 2) / 3;
      ctx.globalAlpha = 0.85;
      ctx.fillText("⭐", Math.cos(a) * r * 0.75, -r * 1.25 + Math.sin(a) * r * 0.22);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore(); // konum
}

function aura(ctx, r, renk, simMs) {
  const nabiz = 1 + Math.sin(simMs / 120) * 0.05;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.12 * nabiz, 0, Math.PI * 2);
  ctx.strokeStyle = renk;
  ctx.lineWidth = 5;
  ctx.stroke();
}

// Kurgusal karakter yüzü — tamamen jenerik, telif içermeyen prosedürel çizim.
function kurgusalYuzCiz(ctx, r, bakis, c, renk) {
  const p = c || { ten: "#e8b48a", sac: "#4a3423", sacStil: "dik", goz: "#333", aksesuar: "yok" };

  // Kafa tabanı
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
  g.addColorStop(0, aydinlat(p.ten, 18));
  g.addColorStop(1, p.ten);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Saç
  ctx.fillStyle = p.sac;
  if (p.sacStil === "alevli") {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const rr = r * (i % 2 === 0 ? 1.22 : 1.0);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.9 - r * 0.1;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (p.sacStil === "dik") {
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.22 - r * 0.08, -r * 0.78);
      ctx.lineTo(i * r * 0.22, -r * 1.28);
      ctx.lineTo(i * r * 0.22 + r * 0.08, -r * 0.78);
      ctx.closePath();
      ctx.fill();
    }
  } else if (p.sacStil === "yatik") {
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.92, Math.PI, Math.PI * 1.95);
    ctx.quadraticCurveTo(bakis * r * 0.9, -r * 0.5, bakis * r * 0.55, -r * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (p.sacStil === "topuz") {
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.85, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 1.08, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // "kel" → saç çizilmez

  // Gözler (rakibe bakar)
  const gozX = bakis * r * 0.34;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(gozX, -r * 0.12, r * 0.19, r * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(gozX - bakis * r * 0.42, -r * 0.12, r * 0.16, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.goz;
  ctx.beginPath();
  ctx.arc(gozX + bakis * r * 0.06, -r * 0.11, r * 0.08, 0, Math.PI * 2);
  ctx.arc(gozX - bakis * r * 0.37, -r * 0.11, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Kaşlar
  ctx.strokeStyle = p.sac === "#f2d022" ? "#b39516" : p.sac;
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(gozX - r * 0.14, -r * 0.34);
  ctx.lineTo(gozX + r * 0.14, -r * 0.38);
  ctx.moveTo(gozX - bakis * r * 0.42 - r * 0.12, -r * 0.33);
  ctx.lineTo(gozX - bakis * r * 0.42 + r * 0.12, -r * 0.34);
  ctx.stroke();

  // Ağız (kararlı gülümseme)
  ctx.strokeStyle = "#7a4630";
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(bakis * r * 0.22, r * 0.34, r * 0.24, Math.PI * 0.15, Math.PI * 0.7);
  ctx.stroke();

  // Aksesuarlar
  if (p.aksesuar === "bandana") {
    ctx.fillStyle = p.aksesuarRenk;
    ctx.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
  } else if (p.aksesuar === "maske") {
    ctx.fillStyle = p.aksesuarRenk;
    ctx.beginPath();
    ctx.ellipse(gozX - bakis * r * 0.2, -r * 0.12, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // maske göz delikleri
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(gozX, -r * 0.12, r * 0.14, r * 0.11, 0, 0, Math.PI * 2);
    ctx.ellipse(gozX - bakis * r * 0.42, -r * 0.12, r * 0.12, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.aksesuar === "sakal") {
    ctx.fillStyle = p.aksesuarRenk;
    ctx.beginPath();
    ctx.arc(0, r * 0.28, r * 0.62, Math.PI * 0.12, Math.PI * 0.88);
    ctx.closePath();
    ctx.fill();
  } else if (p.aksesuar === "yildiz") {
    yildizCiz(ctx, -bakis * r * 0.55, -r * 0.55, r * 0.16, p.aksesuarRenk);
  }
}

function yildizCiz(ctx, x, y, r, renk) {
  ctx.fillStyle = renk;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function aydinlat(hex, miktar) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + miktar);
    const g = Math.min(255, ((n >> 8) & 255) + miktar);
    const b = Math.min(255, (n & 255) + miktar);
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex;
  }
}
