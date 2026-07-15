// ============================================================
// KAFA TOPU — sahne çizimi.
// Arka plan: /map/manifest.json'daki Club Afrodit fotoğraf katmanları
// (parallax) — yoksa prosedürel havuz başı/sahil sahnesi çizilir.
// Oyun elemanları fon üzerinde net kalsın diye hafif karartma uygulanır.
// ============================================================

import { SAHA, KALE, TOP, GUC } from "../shared/sabitler.js";
import { oyuncuCiz, TAKIM_RENK } from "./kafaCizim.js";

// ---------- Arka plan katmanları ----------
// manifest.json: { "katmanlar": [{ "dosya": "gok.jpg", "hiz": 0.05 }, ...] }
// hiz: parallax çarpanı (0 = sabit en arka, 1 = saha ile birlikte).
let katmanlar = null; // [{ img, hiz }] ya da [] (fallback)

export async function arkaplanYukle() {
  if (katmanlar !== null) return;
  try {
    const yanit = await fetch("/map/manifest.json", { cache: "no-cache" });
    if (!yanit.ok) throw new Error("manifest yok");
    const veri = await yanit.json();
    const liste = [];
    for (const k of veri.katmanlar || []) {
      const img = new Image();
      img.src = `/map/${k.dosya}`;
      liste.push({ img, hiz: k.hiz ?? 0.1 });
    }
    katmanlar = liste;
  } catch {
    katmanlar = []; // fotoğraflar henüz yok → prosedürel sahne
  }
}

// Prosedürel katmanlar bir kez offscreen'e çizilir (performans).
let cache = null;
function prosedurelKatmanlar() {
  if (cache) return cache;
  const yap = (ciz) => {
    const c = document.createElement("canvas");
    c.width = SAHA.W + 160; // parallax payı
    c.height = SAHA.H;
    ciz(c.getContext("2d"), c.width, c.height);
    return c;
  };

  // En arka: gökyüzü + güneş + dağ silueti
  const gok = yap((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#5ec6e8");
    g.addColorStop(0.55, "#a5e3f5");
    g.addColorStop(1, "#ffe9c4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // güneş
    ctx.fillStyle = "rgba(255,240,180,0.95)";
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.18, 46, 0, Math.PI * 2);
    ctx.fill();
    // dağ silueti
    ctx.fillStyle = "#7fae9e";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w * 0.18, h * 0.38);
    ctx.lineTo(w * 0.34, h * 0.56);
    ctx.lineTo(w * 0.5, h * 0.3);
    ctx.lineTo(w * 0.68, h * 0.55);
    ctx.lineTo(w * 0.84, h * 0.42);
    ctx.lineTo(w, h * 0.6);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  });

  // Orta plan: aquapark kaydırağı + kule + palmiyeler
  const orta = yap((ctx, w, h) => {
    // kule
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(w * 0.68, h * 0.3, 34, h * 0.45);
    ctx.fillStyle = "#cbb894";
    ctx.fillRect(w * 0.665, h * 0.28, 42, 12);
    // kaydırak boruları (renkli spiraller)
    const boru = (renk, ox, geniş) => {
      ctx.strokeStyle = renk;
      ctx.lineWidth = geniş;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w * 0.7 + ox, h * 0.33);
      ctx.bezierCurveTo(w * 0.52 + ox, h * 0.3, w * 0.5 + ox, h * 0.62, w * 0.36 + ox, h * 0.62);
      ctx.bezierCurveTo(w * 0.26 + ox, h * 0.62, w * 0.3 + ox, h * 0.78, w * 0.22 + ox, h * 0.82);
      ctx.stroke();
    };
    boru("#f2a33c", 0, 16);
    boru("#3fa9d8", 22, 16);
    boru("#e2574c", 44, 16);
    // palmiyeler
    const palmiye = (x, boy) => {
      ctx.strokeStyle = "#8a6238";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.86);
      ctx.quadraticCurveTo(x + 12, h * 0.86 - boy * 0.6, x + 4, h * 0.86 - boy);
      ctx.stroke();
      ctx.fillStyle = "#3e9e4f";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          x + 4 + Math.cos(a) * 26, h * 0.86 - boy + Math.sin(a) * 12,
          30, 9, a * 0.5, 0, Math.PI * 2
        );
        ctx.fill();
      }
    };
    palmiye(w * 0.1, 120);
    palmiye(w * 0.9, 140);
  });

  // Ön plan (saha gerisi): havuz kenarı + plaj
  const on = yap((ctx, w, h) => {
    // havuz suyu şeridi
    ctx.fillStyle = "rgba(64,180,220,0.85)";
    ctx.fillRect(0, h * 0.8, w, h * 0.08);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.arc(x + 20, h * 0.83, 10, 0, Math.PI);
      ctx.fill();
    }
  });

  cache = [
    { img: gok, hiz: 0.03 },
    { img: orta, hiz: 0.1 },
    { img: on, hiz: 0.2 },
  ];
  return cache;
}

// ---------- Ana çizim ----------
// snap: anlikDurum paketi; meta: kafaKaydi eklenmiş oyuncu meta listesi.
export function sahneCiz(ctx, snap, meta, simMs) {
  const parallaxKaynak = ((snap.top?.x ?? SAHA.W / 2) - SAHA.W / 2);

  // Arka plan
  const liste = katmanlar && katmanlar.length ? katmanlar : prosedurelKatmanlar();
  for (const k of liste) {
    if (k.img && (k.img.width || k.img.complete !== false)) {
      const ofset = -80 - parallaxKaynak * k.hiz;
      try {
        // Fotoğraf katmanları sahayı kaplayacak şekilde ölçeklenir.
        const iw = k.img.width || SAHA.W + 160;
        const ih = k.img.height || SAHA.H;
        const olcek = Math.max((SAHA.W + 160) / iw, SAHA.H / ih);
        ctx.drawImage(k.img, ofset, SAHA.H - ih * olcek, iw * olcek, ih * olcek);
      } catch { /* görsel henüz yüklenmedi */ }
    }
  }
  // Oyun elemanları net görünsün: hafif kontrast karartması
  ctx.fillStyle = "rgba(8, 20, 34, 0.16)";
  ctx.fillRect(0, 0, SAHA.W, SAHA.H);

  // Zemin (kum/deck)
  const zg = ctx.createLinearGradient(0, SAHA.ZEMIN_Y, 0, SAHA.H);
  zg.addColorStop(0, "#e7cf9f");
  zg.addColorStop(1, "#c9a86f");
  ctx.fillStyle = zg;
  ctx.fillRect(0, SAHA.ZEMIN_Y, SAHA.W, SAHA.H - SAHA.ZEMIN_Y);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(0, SAHA.ZEMIN_Y, SAHA.W, 3);
  // orta çizgi + orta yuvarlak
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(SAHA.W / 2, SAHA.ZEMIN_Y);
  ctx.lineTo(SAHA.W / 2, 120);
  ctx.stroke();
  ctx.setLineDash([]);

  // Kaleler
  kaleCiz(ctx, 1);
  kaleCiz(ctx, 2);

  // Kalkan bariyerleri (yetenek)
  (snap.oy || []).forEach((oy, i) => {
    if (oy.kk) {
      const takim = meta[i].takim;
      const x = takim === 1 ? KALE.DERINLIK + 8 : SAHA.W - KALE.DERINLIK - 8;
      const yUst = SAHA.ZEMIN_Y - KALE.ACIKLIK;
      const nabiz = 0.55 + Math.sin(simMs / 90) * 0.15;
      ctx.fillStyle = `rgba(120, 220, 255, ${nabiz})`;
      ctx.fillRect(x - 6, yUst, 12, KALE.ACIKLIK);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.strokeRect(x - 6, yUst, 12, KALE.ACIKLIK);
    }
  });

  // Düşen güçler
  for (const g of snap.gucler || []) {
    ctx.save();
    ctx.translate(g.x, g.y + Math.sin(simMs / 200 + g.id) * 3);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#f2a33c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, GUC.R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${GUC.R * 1.2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.ikon || "⭐", 0, 2);
    ctx.restore();
  }

  // Oyuncular (gölge + çizim)
  (snap.oy || []).forEach((oy, i) => {
    // yer gölgesi
    const r = 44 * (oy.ol || 1);
    const yerUzak = Math.max(0, SAHA.ZEMIN_Y - (oy.y + r));
    const golgeOlcek = Math.max(0.35, 1 - yerUzak / 400);
    ctx.fillStyle = `rgba(0,0,0,${0.22 * golgeOlcek})`;
    ctx.beginPath();
    ctx.ellipse(oy.x, SAHA.ZEMIN_Y - 4, r * 0.9 * golgeOlcek, 8 * golgeOlcek, 0, 0, Math.PI * 2);
    ctx.fill();
    oyuncuCiz(ctx, oy, meta[i], simMs);
  });

  // Top (plaj topu stili)
  if (snap.top) topCiz(ctx, snap.top);
}

function kaleCiz(ctx, takim) {
  const sol = takim === 1;
  const x0 = sol ? 0 : SAHA.W - KALE.DERINLIK;
  const agizX = sol ? KALE.DERINLIK : SAHA.W - KALE.DERINLIK;
  const yUst = SAHA.ZEMIN_Y - KALE.ACIKLIK;
  const renk = TAKIM_RENK[takim];

  // file (ağ)
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  for (let y = yUst + 8; y < SAHA.ZEMIN_Y; y += 16) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + KALE.DERINLIK, y);
    ctx.stroke();
  }
  for (let x = x0 + 8; x < x0 + KALE.DERINLIK; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, yUst);
    ctx.lineTo(x, SAHA.ZEMIN_Y);
    ctx.stroke();
  }

  // üst direk
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(x0, yUst - KALE.DIREK, KALE.DERINLIK, KALE.DIREK);
  // ön direk (dikey çizgi, sadece görsel)
  ctx.fillRect(agizX - (sol ? 4 : 0), yUst - KALE.DIREK, 4, KALE.ACIKLIK * 0.25);
  // takım rengi işaret şeridi
  ctx.fillStyle = renk.forma;
  ctx.fillRect(x0, yUst - KALE.DIREK, KALE.DERINLIK, 4);
}

function topCiz(ctx, top) {
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(top.a || 0);
  const r = TOP.R;
  // plaj topu dilimleri
  const renkler = ["#ffffff", "#e2574c", "#ffffff", "#3fa9d8", "#ffffff", "#f2c522"];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = renkler[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  // parlaklık + kontur
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,30,40,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
