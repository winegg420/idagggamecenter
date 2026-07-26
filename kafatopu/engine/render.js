// ============================================================
// KAFA TOPU — sahne çizimi.
// Arka plan: /map/manifest.json'daki Club Afrodit fotoğraf katmanları
// (parallax) — yoksa prosedürel havuz başı/sahil sahnesi çizilir.
// Oyun elemanları fon üzerinde net kalsın diye hafif karartma uygulanır.
// ============================================================

import { SAHA, KALE, TOP, GUC } from "../shared/sabitler.js";
import { oyuncuCiz, TAKIM_RENK, emojiGorsel } from "./kafaCizim.js";

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
// Amaç: fotoğraflar eklenene dek gerçekçi bir havuz başı/sahil sahnesi —
// ışık/gölgeli kaydırak kulesi, destek ayaklı borular, sisli dağlar,
// bulutlar, dokulu kum ve parıltılı havuz.
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

  // ---------- En arka: gökyüzü + güneş + bulutlar + sisli dağlar ----------
  const gok = yap((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2f8fd0");
    g.addColorStop(0.45, "#7cc4e8");
    g.addColorStop(0.78, "#cfeaf2");
    g.addColorStop(1, "#ffe9c8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Güneş: parlak çekirdek + geniş ışıma
    const gx = w * 0.79, gy = h * 0.16;
    const isik = ctx.createRadialGradient(gx, gy, 8, gx, gy, 150);
    isik.addColorStop(0, "rgba(255,252,230,0.95)");
    isik.addColorStop(0.25, "rgba(255,240,180,0.55)");
    isik.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = isik;
    ctx.fillRect(gx - 160, gy - 160, 320, 320);
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(gx, gy, 34, 0, Math.PI * 2);
    ctx.fill();

    // Yumuşak bulutlar (elips kümeleri)
    const bulut = (x, y, olcek, alfa) => {
      ctx.fillStyle = `rgba(255,255,255,${alfa})`;
      for (const [ox, oy, rx, ry] of [
        [0, 0, 42, 15], [30, -8, 32, 13], [-32, -5, 28, 11], [58, 2, 24, 9],
      ]) {
        ctx.beginPath();
        ctx.ellipse(x + ox * olcek, y + oy * olcek, rx * olcek, ry * olcek, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    bulut(w * 0.16, h * 0.14, 1.15, 0.85);
    bulut(w * 0.48, h * 0.09, 0.85, 0.7);
    bulut(w * 0.62, h * 0.22, 0.7, 0.55);
    bulut(w * 0.92, h * 0.3, 0.9, 0.6);

    // Uzak sıradağ (soluk, sisli mavi-gri)
    const sira = (renk, tabanY, tepe, kaydir) => {
      ctx.fillStyle = renk;
      ctx.beginPath();
      ctx.moveTo(0, tabanY);
      for (let x = 0; x <= w; x += 8) {
        const t = x / w;
        const y =
          tabanY -
          tepe * (0.5 + 0.5 * Math.sin(t * 5.1 + kaydir)) *
          (0.6 + 0.4 * Math.sin(t * 2.3 + kaydir * 2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    };
    sira("rgba(120,150,175,0.55)", h * 0.62, h * 0.3, 1.2);
    sira("rgba(90,130,120,0.75)", h * 0.72, h * 0.34, 3.7);
    // Dağ eteğinde sis şeridi
    const sis = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.8);
    sis.addColorStop(0, "rgba(255,255,255,0)");
    sis.addColorStop(1, "rgba(235,245,248,0.5)");
    ctx.fillStyle = sis;
    ctx.fillRect(0, h * 0.55, w, h * 0.25);
  });

  // ---------- Orta plan: aquapark kulesi + borular + palmiyeler ----------
  const orta = yap((ctx, w, h) => {
    const zemin = h * 0.88;

    // -- Kaydırak kulesi (ışıklı/gölgeli, platform + korkuluk + merdiven) --
    const kx = w * 0.72, kw = 46, kUst = h * 0.24;
    // gövde: güneş sağ üstte → sol yüz gölgeli
    const kg = ctx.createLinearGradient(kx, 0, kx + kw, 0);
    kg.addColorStop(0, "#b9a583");
    kg.addColorStop(0.5, "#e3d4b4");
    kg.addColorStop(1, "#efe3c6");
    ctx.fillStyle = kg;
    ctx.fillRect(kx, kUst, kw, zemin - kUst);
    // kat çizgileri
    ctx.strokeStyle = "rgba(90,70,45,0.25)";
    ctx.lineWidth = 2;
    for (let y = kUst + 30; y < zemin; y += 42) {
      ctx.beginPath(); ctx.moveTo(kx, y); ctx.lineTo(kx + kw, y); ctx.stroke();
    }
    // merdiven (yan raylı)
    ctx.strokeStyle = "#8f7a58";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(kx + kw + 6, zemin); ctx.lineTo(kx + kw + 6, kUst + 16);
    ctx.moveTo(kx + kw + 18, zemin); ctx.lineTo(kx + kw + 18, kUst + 16);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = kUst + 24; y < zemin; y += 14) {
      ctx.beginPath(); ctx.moveTo(kx + kw + 6, y); ctx.lineTo(kx + kw + 18, y); ctx.stroke();
    }
    // platform + korkuluk
    ctx.fillStyle = "#a08a63";
    ctx.fillRect(kx - 14, kUst - 8, kw + 34, 10);
    ctx.fillStyle = "#c9b58d";
    ctx.fillRect(kx - 14, kUst - 12, kw + 34, 5);
    ctx.strokeStyle = "#7d6947";
    ctx.lineWidth = 2.5;
    for (let px = kx - 10; px <= kx + kw + 16; px += 12) {
      ctx.beginPath(); ctx.moveTo(px, kUst - 12); ctx.lineTo(px, kUst - 34); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(kx - 14, kUst - 34); ctx.lineTo(kx + kw + 20, kUst - 34); ctx.stroke();
    // çatı tentesi
    ctx.fillStyle = "#e2574c";
    ctx.beginPath();
    ctx.moveTo(kx - 20, kUst - 34);
    ctx.lineTo(kx + kw / 2, kUst - 58);
    ctx.lineTo(kx + kw + 26, kUst - 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(kx + kw / 2, kUst - 58);
    ctx.lineTo(kx + kw + 26, kUst - 34);
    ctx.lineTo(kx + kw / 2, kUst - 34);
    ctx.closePath();
    ctx.fill();

    // -- Kaydırak boruları: gölge katmanı + ana renk + üst ışık şeridi --
    const boruYol = (ox) => {
      ctx.beginPath();
      ctx.moveTo(kx + 6 + ox, kUst + 4);
      ctx.bezierCurveTo(w * 0.52 + ox, h * 0.28, w * 0.5 + ox, h * 0.6, w * 0.36 + ox, h * 0.6);
      ctx.bezierCurveTo(w * 0.25 + ox, h * 0.6, w * 0.3 + ox, h * 0.76, w * 0.2 + ox, h * 0.82);
    };
    const boru = (renk, koyu, ox) => {
      ctx.lineCap = "round";
      // dış kontur (koyu — hacim)
      ctx.strokeStyle = koyu;
      ctx.lineWidth = 19;
      boruYol(ox);
      ctx.stroke();
      // gövde
      ctx.strokeStyle = renk;
      ctx.lineWidth = 14;
      boruYol(ox);
      ctx.stroke();
      // üst ışık şeridi (güneş yansıması)
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 4;
      boruYol(ox - 3);
      ctx.stroke();
    };
    // destek ayakları (boruların altına, önce çizilir)
    ctx.strokeStyle = "#9aa4ab";
    ctx.lineWidth = 7;
    for (const [sx, sy] of [[w * 0.5, h * 0.44], [w * 0.36, h * 0.6], [w * 0.27, h * 0.7]]) {
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, zemin); ctx.stroke();
      // çapraz destek
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx - 14, zemin); ctx.lineTo(sx, sy + 26); ctx.stroke();
      ctx.lineWidth = 7;
    }
    boru("#f2a33c", "#b56f14", 0);
    boru("#3fa9d8", "#1c6e99", 24);
    boru("#e2574c", "#9c2c22", 48);
    // çıkış köpüğü (kaydırak sonu su sıçraması)
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const [fx, fy, fr] of [[w * 0.2, h * 0.85, 10], [w * 0.23, h * 0.86, 7], [w * 0.18, h * 0.87, 6]]) {
      ctx.beginPath(); ctx.arc(fx + 48, fy, fr, 0, Math.PI * 2); ctx.fill();
    }

    // -- Palmiyeler (halkalı gövde + damarlı yapraklar + hindistan cevizi) --
    const palmiye = (x, boy, yon) => {
      // gölge
      ctx.fillStyle = "rgba(30,40,30,0.18)";
      ctx.beginPath();
      ctx.ellipse(x + 8, zemin + 4, boy * 0.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // gövde: eğri, halka dokulu
      const tepeX = x + yon * boy * 0.22, tepeY = zemin - boy;
      ctx.strokeStyle = "#8a6238";
      ctx.lineWidth = 13;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, zemin);
      ctx.quadraticCurveTo(x + yon * boy * 0.05, zemin - boy * 0.55, tepeX, tepeY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(60,40,20,0.35)";
      ctx.lineWidth = 2;
      for (let t = 0.12; t < 0.95; t += 0.12) {
        const px = x + (tepeX - x) * t, py = zemin + (tepeY - zemin) * t;
        ctx.beginPath(); ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py - 3); ctx.stroke();
      }
      // yapraklar: orta damarlı, iki ton yeşil
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
        const ux = Math.cos(a), uy = Math.sin(a) * 0.55 - 0.25;
        const boyY = boy * (0.42 + (i % 2) * 0.08);
        const ucX = tepeX + ux * boyY, ucY = tepeY + uy * boyY;
        ctx.fillStyle = i % 2 ? "#2e8440" : "#3fa653";
        ctx.beginPath();
        ctx.moveTo(tepeX, tepeY);
        ctx.quadraticCurveTo(tepeX + ux * boyY * 0.5, tepeY + uy * boyY * 0.5 - 14, ucX, ucY);
        ctx.quadraticCurveTo(tepeX + ux * boyY * 0.5, tepeY + uy * boyY * 0.5 + 10, tepeX, tepeY + 4);
        ctx.closePath();
        ctx.fill();
      }
      // hindistan cevizleri
      ctx.fillStyle = "#6b4a26";
      for (const [cx2, cy2] of [[-6, 4], [6, 7], [0, 12]]) {
        ctx.beginPath(); ctx.arc(tepeX + cx2, tepeY + cy2, 5, 0, Math.PI * 2); ctx.fill();
      }
    };
    palmiye(w * 0.08, 150, 1);
    palmiye(w * 0.93, 170, -1);
    palmiye(w * 0.55, 110, -1);

    // -- Şezlong + şemsiye (sahil detayı) --
    const semsiye = (x) => {
      ctx.strokeStyle = "#8a8378";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, zemin); ctx.lineTo(x, zemin - 66); ctx.stroke();
      ctx.fillStyle = "#e2574c";
      ctx.beginPath();
      ctx.moveTo(x - 44, zemin - 60);
      ctx.quadraticCurveTo(x, zemin - 96, x + 44, zemin - 60);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(x - 15, zemin - 68);
      ctx.quadraticCurveTo(x, zemin - 92, x + 44, zemin - 60);
      ctx.quadraticCurveTo(x + 20, zemin - 66, x - 15, zemin - 68);
      ctx.closePath();
      ctx.fill();
      // şezlong
      ctx.fillStyle = "#f5f0e6";
      ctx.fillRect(x + 14, zemin - 14, 46, 6);
      ctx.fillStyle = "#3fa9d8";
      ctx.fillRect(x + 14, zemin - 20, 46, 6);
      ctx.strokeStyle = "#8a8378";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 18, zemin - 8); ctx.lineTo(x + 18, zemin);
      ctx.moveTo(x + 54, zemin - 8); ctx.lineTo(x + 54, zemin);
      ctx.stroke();
    };
    semsiye(w * 0.42);
  });

  // ---------- Ön plan: parıltılı havuz + taş bordür ----------
  const on = yap((ctx, w, h) => {
    const suUst = h * 0.78, suAlt = h * 0.9;
    // havuz suyu: derinlik gradyanı
    const su = ctx.createLinearGradient(0, suUst, 0, suAlt);
    su.addColorStop(0, "#57c4e8");
    su.addColorStop(1, "#1f86b8");
    ctx.fillStyle = su;
    ctx.fillRect(0, suUst, w, suAlt - suUst);
    // su yüzeyi parıltıları
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % w, y = suUst + 6 + ((i * 53) % (suAlt - suUst - 12));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 3, x + 28, y);
      ctx.stroke();
    }
    // taşma oluğu / taş bordür (havuz üst kenarı)
    ctx.fillStyle = "#e8e2d2";
    ctx.fillRect(0, suUst - 8, w, 8);
    ctx.strokeStyle = "rgba(120,110,90,0.4)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, suUst - 8); ctx.lineTo(x, suUst); ctx.stroke();
    }
  });

  cache = [
    { img: gok, hiz: 0.03 },
    { img: orta, hiz: 0.1 },
    { img: on, hiz: 0.2 },
  ];
  return cache;
}

// ---------- Statik sahne önbelleği (cihaz çözünürlüğünde bir kez pişer) ----------
// iPhone kasma düzeltmesi: arka plan katmanları + zemin/kum/kale gibi statik
// öğeler her karede yeniden çizilmek yerine cihaz pikselinde BİR KEZ pişirilir;
// kare başına yalnız 1:1 drawImage kalır. (Safari'de ölçekli tam ekran çizim +
// yüzlerce path/gradient komutu kare süresinin çoğunu yiyordu.)
let pisirik = null; // { key, katmanlar: [{ c, hiz, marj }], kaplama }

// Zayıf cihazda (düşük FPS) parallax kapatılır: 3 katman + kaplama yerine
// TEK opak tuval basılır → kare başına tam ekran çizim 4'ten 1'e iner.
let duzArkaplan = false;
export function duzArkaplanAyarla(acik) {
  if (duzArkaplan === !!acik) return;
  duzArkaplan = !!acik;
  pisirikBosalt();
}

// Pişirilmiş tuvalleri hemen serbest bırak (iOS'ta bellek baskısı = kasma).
export function pisirikBosalt() {
  if (!pisirik) return;
  try {
    for (const k of pisirik.katmanlar) k.c.width = k.c.height = 0;
    pisirik.kaplama.width = pisirik.kaplama.height = 0;
  } catch { /* tuval zaten serbest */ }
  pisirik = null;
}

// Bir arka plan katmanını, verilen alanı tam kaplayacak şekilde bas.
function katmanBas(t, k, solX, genis, boyH, altY) {
  const iw = k.img.width || SAHA.W + 160;
  const ih = k.img.height || SAHA.H;
  const olcek = Math.max((genis + 160) / iw, boyH / ih);
  t.drawImage(k.img, solX - 80, altY - ih * olcek, iw * olcek, ih * olcek);
}

function statikleriPisir(ctx, liste, pay, sc, ofX, ofY) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const key = `${W}|${H}|${sc.toFixed(4)}|${Math.round(ofX)}|${Math.round(ofY)}|${pay.sol}|${pay.ust}|${pay.alt}|d${duzArkaplan ? 1 : 0}`;
  if (pisirik?.key === key) return pisirik;

  // Foto katman henüz yüklenmediyse pişirme (yüklenince pişer; o ana dek
  // eski doğrudan çizim yolu kullanılır).
  for (const k of liste) {
    if (k.img && k.img.tagName === "IMG" && !(k.img.complete && k.img.width)) return null;
  }

  pisirikBosalt(); // eski tuvalleri yenileri ayrılmadan önce bırak

  const solX = -pay.sol;
  const genis = SAHA.W + pay.sol + pay.sag;
  const boyH = SAHA.H + pay.ust + pay.alt;
  const altY = SAHA.H + pay.alt;

  // Parallax katmanları: son ölçekte, kayma marjıyla ayrı tuvallere.
  // Düz arka plan modunda hiç katman tuvali üretilmez; hepsi kaplamaya pişer.
  const katmanC = duzArkaplan
    ? []
    : liste.map((k, i) => {
        const marj = Math.ceil(k.hiz * (SAHA.W / 2 + 80) * sc) + 2;
        const c = document.createElement("canvas");
        c.width = W + marj * 2;
        c.height = H;
        const t = c.getContext("2d");
        // En arka katman opak taban alır: her karede clearRect gerekmesin.
        if (i === 0) {
          t.fillStyle = "#06121f";
          t.fillRect(0, 0, c.width, c.height);
        }
        t.setTransform(sc, 0, 0, sc, ofX + marj, ofY);
        katmanBas(t, k, solX, genis, boyH, altY);
        return { c, hiz: k.hiz, marj };
      });

  // Kaplama: karartma + zemin + kum + çizgiler + kaleler (hepsi statik).
  // Düz modda arka plan katmanları da (kaymasız) buraya pişirilir.
  const kap = document.createElement("canvas");
  kap.width = W;
  kap.height = H;
  const t = kap.getContext("2d");
  if (duzArkaplan) {
    t.fillStyle = "#06121f";
    t.fillRect(0, 0, W, H);
    t.setTransform(sc, 0, 0, sc, ofX, ofY);
    for (const k of liste) katmanBas(t, k, solX, genis, boyH, altY);
  }
  t.setTransform(sc, 0, 0, sc, ofX, ofY);
  t.fillStyle = "rgba(8, 20, 34, 0.16)";
  t.fillRect(solX, -pay.ust, genis, boyH);
  const zg = t.createLinearGradient(0, SAHA.ZEMIN_Y, 0, SAHA.H + pay.alt);
  zg.addColorStop(0, "#e7cf9f");
  zg.addColorStop(1, "#c9a86f");
  t.fillStyle = zg;
  t.fillRect(solX, SAHA.ZEMIN_Y, genis, SAHA.H - SAHA.ZEMIN_Y + pay.alt);
  // kum dokusu: deterministik benekler
  for (let i = 0; i < 90; i++) {
    const bx = (i * 137.5) % SAHA.W;
    const by = SAHA.ZEMIN_Y + 6 + ((i * 61) % (SAHA.H - SAHA.ZEMIN_Y - 10));
    t.fillStyle = i % 3 ? "rgba(140,110,70,0.25)" : "rgba(255,255,255,0.3)";
    t.fillRect(bx, by, 2.4, 2.4);
  }
  t.fillStyle = "rgba(255,255,255,0.75)";
  t.fillRect(solX, SAHA.ZEMIN_Y, genis, 3);
  // orta çizgi
  t.strokeStyle = "rgba(255,255,255,0.5)";
  t.lineWidth = 3;
  t.setLineDash([10, 12]);
  t.beginPath();
  t.moveTo(SAHA.W / 2, SAHA.ZEMIN_Y);
  t.lineTo(SAHA.W / 2, 120);
  t.stroke();
  t.setLineDash([]);
  kaleCiz(t, 1);
  kaleCiz(t, 2);

  pisirik = { key, katmanlar: katmanC, kaplama: kap };
  return pisirik;
}

// Eski doğrudan çizim yolu — yalnızca foto katmanlar yüklenene dek kullanılır.
function dogrudanArkaplanCiz(ctx, liste, pay, parallaxKaynak) {
  const solX = -pay.sol;
  const genis = SAHA.W + pay.sol + pay.sag;
  const boyH = SAHA.H + pay.ust + pay.alt;
  // Opak taban: arka plan her koşulda ekranı tam kaplar, böylece kare başına
  // ayrı bir clearRect gerekmez (bir tam ekran işlemi eksilir).
  ctx.fillStyle = "#06121f";
  ctx.fillRect(solX, -pay.ust, genis, boyH);
  for (const k of liste) {
    if (k.img && (k.img.width || k.img.complete !== false)) {
      try {
        const iw = k.img.width || SAHA.W + 160;
        const ih = k.img.height || SAHA.H;
        const olcek = Math.max((genis + 160) / iw, boyH / ih);
        const x = solX - 80 - parallaxKaynak * k.hiz;
        const y = (SAHA.H + pay.alt) - ih * olcek;
        ctx.drawImage(k.img, x, y, iw * olcek, ih * olcek);
      } catch { /* görsel henüz yüklenmedi */ }
    }
  }
  ctx.fillStyle = "rgba(8, 20, 34, 0.16)";
  ctx.fillRect(solX, -pay.ust, genis, boyH);
  const zg = ctx.createLinearGradient(0, SAHA.ZEMIN_Y, 0, SAHA.H + pay.alt);
  zg.addColorStop(0, "#e7cf9f");
  zg.addColorStop(1, "#c9a86f");
  ctx.fillStyle = zg;
  ctx.fillRect(solX, SAHA.ZEMIN_Y, genis, SAHA.H - SAHA.ZEMIN_Y + pay.alt);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(solX, SAHA.ZEMIN_Y, genis, 3);
  kaleCiz(ctx, 1);
  kaleCiz(ctx, 2);
}

// ---------- Ana çizim ----------
// snap: anlikDurum paketi; meta: kafaKaydi eklenmiş oyuncu meta listesi.
// pay: saha dışında kalan ekran boşlukları (mantıksal birim) — tam ekran
// görünüm için arka plan bu paylara da uzatılır (yanlar/üst/alt boş kalmaz).
export function sahneCiz(ctx, snap, meta, simMs, pay = { sol: 0, sag: 0, ust: 0, alt: 0 }) {
  const parallaxKaynak = ((snap.top?.x ?? SAHA.W / 2) - SAHA.W / 2);

  // Arka plan + statik saha (paylar dahil tüm ekranı kaplar)
  const liste = katmanlar && katmanlar.length ? katmanlar : prosedurelKatmanlar();
  const m = ctx.getTransform();
  const p = statikleriPisir(ctx, liste, pay, m.a, m.e, m.f);
  if (p) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const k of p.katmanlar) {
      const kayma = Math.max(-k.marj + 2, Math.min(k.marj - 2, parallaxKaynak * k.hiz * m.a));
      ctx.drawImage(k.c, Math.round(-k.marj - kayma), 0);
    }
    ctx.drawImage(p.kaplama, 0, 0);
    ctx.restore();
  } else {
    dogrudanArkaplanCiz(ctx, liste, pay, parallaxKaynak);
  }

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
    // Emoji her karede fillText ile rasterlenirse Safari'de pahalı;
    // bir kez küçük tuvale çizilir, sonra drawImage ile basılır.
    const boy = GUC.R * 1.3;
    ctx.drawImage(emojiGorsel(g.ikon || "⭐"), -boy / 2, -boy / 2 + 2, boy, boy);
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
    oyuncuCiz(ctx, oy, meta[i], simMs, m.a);
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
