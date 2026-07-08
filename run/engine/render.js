// ============================================================
// RUN — render (Canvas 2D, takip kamera, sınırlı görüş/fener).
// Cyberpunk atmosfer: panelli zemin, neon kenarlar, kapüşonlu figürler,
// detaylı drone, fener içi toz zerreleri, monitörler, neon çıkış.
// Kod-çizim (prototip). Görsel detay kademeli yükseltiliyor.
// ============================================================

import { GORUS_YARICAP, FENER_UZUNLUK, FENER_ACI, OYUNCU_YARICAP } from "./sabitler.js";

export function ciz(ctx, durum, view) {
  const { w, h } = view;
  const t = durum.zaman;
  const worldW = durum.harita.genislik, worldH = durum.harita.yukseklik;
  const genel = !!durum.genelBakis;                    // GENEL BAKIŞ (uzaklaştırılmış tüm harita)
  const zoom = genel ? Math.min((w - 40) / worldW, (h - 40) / worldH) : 1;
  const ben = durum.oyuncular[0];
  const camX = genel ? worldW / 2 : durum.kamera.x;
  const camY = genel ? worldH / 2 : durum.kamera.y;
  const w2s = (x, y) => [(x - camX) * zoom + w / 2, (y - camY) * zoom + h / 2];

  // Arka plan
  ctx.fillStyle = "#070a10";
  ctx.fillRect(0, 0, w, h);

  // Görünür dünya sınırları (ekran-dışı oda kırpma)
  const visW = w / zoom, visH = h / zoom;
  const gL = camX - visW / 2 - 20, gR = camX + visW / 2 + 20, gT = camY - visH / 2 - 20, gB = camY + visH / 2 + 20;

  // --- Dünya sahnesi (kamera dönüşümü altında; pozisyon+boyut zoom ile ölçeklenir) ---
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); ctx.translate(-camX, -camY);
  const s2 = (x, y) => [x, y]; // dünya koordinatı (dönüşüm hallediyor)

  for (const a of durum.harita.alanlar) {
    if (a.x > gR || a.y > gB || a.x + a.w < gL || a.y + a.h < gT) continue;
    const rx = a.x, ry = a.y;
    ctx.fillStyle = a.aydinlik ? "#334556" : "#243240";
    ctx.fillRect(rx, ry, a.w, a.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, ry, a.w, a.h); ctx.clip();
    ctx.strokeStyle = "rgba(90,150,170,0.07)"; ctx.lineWidth = 1;
    const p = 56;
    for (let gx = a.x - (a.x % p); gx < a.x + a.w; gx += p) { ctx.beginPath(); ctx.moveTo(gx, ry); ctx.lineTo(gx, ry + a.h); ctx.stroke(); }
    for (let gy = a.y - (a.y % p); gy < a.y + a.h; gy += p) { ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + a.w, gy); ctx.stroke(); }
    ctx.restore();
    mobilyaCiz(ctx, a, s2, t);
    ctx.fillStyle = "rgba(0,0,0,0.30)"; ctx.fillRect(rx, ry, a.w, 5); ctx.fillRect(rx, ry, 5, a.h);
    ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(rx, ry + a.h - 4, a.w, 4); ctx.fillRect(rx + a.w - 4, ry, 4, a.h);
    ctx.strokeStyle = a.aydinlik ? "rgba(90,210,230,0.5)" : "rgba(60,120,140,0.25)"; ctx.lineWidth = 2;
    ctx.strokeRect(rx + 1, ry + 1, a.w - 2, a.h - 2);
  }
  // Engeller (çarpışan mobilya) — tipe göre çizilir
  for (const eng of durum.harita.engeller || []) {
    if (eng.x > gR || eng.y > gB || eng.x + eng.w < gL || eng.y + eng.h < gT) continue;
    cizEngel(ctx, eng, t);
  }
  for (const c of durum.harita.cikislar) { ctx.fillStyle = "#183a24"; ctx.fillRect(c.x, c.y, c.w, c.h); }

  ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center";
  for (const a of durum.harita.alanlar) {
    if (!a.ad) continue;
    const gen = ctx.measureText(a.ad).width + 14;
    ctx.fillStyle = "rgba(10,16,22,0.55)"; ctx.fillRect(a.x + a.w / 2 - gen / 2, a.y + 5, gen, 16);
    ctx.fillStyle = "rgba(140,200,220,0.6)"; ctx.fillText(a.ad, a.x + a.w / 2, a.y + 17);
  }
  for (const n of durum.harita.nesneler || []) {
    ctx.fillStyle = "#0c1620"; ctx.fillRect(n.x - 9, n.y - 7, 18, 14);
    const par = 0.5 + 0.4 * Math.sin(t * 3 + n.x);
    ctx.fillStyle = `rgba(70,200,220,${par})`; ctx.fillRect(n.x - 7, n.y - 5, 14, 10);
    ctx.strokeStyle = "rgba(120,230,240,0.7)"; ctx.lineWidth = 1; ctx.strokeRect(n.x - 9, n.y - 7, 18, 14);
  }
  for (const s of durum.oyuncular) {
    if (s.id === "ben") continue;
    cizKisi(ctx, s.x, s.y, s.yakalandi ? "#5a6472" : "#49c6e0", s.aci, s.yakalandi, t);
  }
  for (const dr of durum.droneler || []) cizDrone(ctx, dr.x, dr.y, dr.aci, dr.mod === "kovala", t);
  if (genel) cizKisi(ctx, ben.x, ben.y, "#f0c651", ben.aci, ben.yakalandi, t, true); // overview'da dünyada

  ctx.restore();

  // --- Normal mod: STEALTH karanlık + fener (ekran uzayı) ---
  if (!genel) {
    const [bx, by] = w2s(ben.x, ben.y);
    ctx.save();
    ctx.fillStyle = "rgba(5,8,13,0.92)";      // karanlık (stealth)
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    const rg = ctx.createRadialGradient(bx, by, 8, bx, by, GORUS_YARICAP);
    rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, GORUS_YARICAP, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, FENER_UZUNLUK, ben.aci - FENER_ACI, ben.aci + FENER_ACI); ctx.closePath(); ctx.clip();
    const cg = ctx.createRadialGradient(bx, by, 8, bx, by, FENER_UZUNLUK);
    cg.addColorStop(0, "rgba(0,0,0,1)"); cg.addColorStop(0.65, "rgba(0,0,0,0.72)"); cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    for (const a of durum.harita.alanlar) { if (!a.aydinlik) continue; const [rx, ry] = w2s(a.x, a.y); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(rx, ry, a.w, a.h); }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const wl = ctx.createRadialGradient(bx, by, 8, bx, by, GORUS_YARICAP);
    wl.addColorStop(0, "rgba(180,220,255,0.16)"); wl.addColorStop(1, "rgba(180,220,255,0)");
    ctx.fillStyle = wl; ctx.beginPath(); ctx.arc(bx, by, GORUS_YARICAP, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, FENER_UZUNLUK, ben.aci - FENER_ACI, ben.aci + FENER_ACI); ctx.closePath(); ctx.clip();
    const wc = ctx.createRadialGradient(bx, by, 8, bx, by, FENER_UZUNLUK);
    wc.addColorStop(0, "rgba(210,235,255,0.26)"); wc.addColorStop(0.6, "rgba(190,225,255,0.10)"); wc.addColorStop(1, "rgba(190,225,255,0)");
    ctx.fillStyle = wc; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 14; i++) {
      const dm = ((i * 97 + t * 40) % FENER_UZUNLUK);
      const yan = Math.sin(i * 2.3 + t * 0.8) * dm * Math.tan(FENER_ACI) * 0.8;
      const px = bx + Math.cos(ben.aci) * dm - Math.sin(ben.aci) * yan;
      const py = by + Math.sin(ben.aci) * dm + Math.cos(ben.aci) * yan;
      ctx.globalAlpha = 0.25 * (1 - dm / FENER_UZUNLUK); ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.restore(); ctx.restore();

    cizKisi(ctx, bx, by, "#f0c651", ben.aci, ben.yakalandi, t, true); // oyuncu net, en üstte
  }

  // Çıkış neon markerları (her zaman görünür)
  for (const c of durum.harita.cikislar) {
    const [rx, ry] = w2s(c.x + c.w / 2, c.y + c.h / 2);
    ctx.save();
    const pul = 10 + Math.sin(t * 4) * 2;
    ctx.strokeStyle = "rgba(70,240,130,0.9)"; ctx.lineWidth = 3; ctx.shadowColor = "rgba(70,240,130,0.9)"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(rx, ry, pul, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#7dffb0"; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowBlur = 8;
    ctx.fillText("⎋", rx, ry); ctx.restore();
  }

  // Müttefik blip + isim
  for (const s of durum.oyuncular) {
    if (s.id === "ben" || s.yakalandi) continue;
    const dd = Math.hypot(s.x - ben.x, s.y - ben.y);
    if (!genel && dd > 520) continue;
    const [sx, sy] = w2s(s.x, s.y);
    const al = genel ? 0.85 : 0.3 + 0.5 * (1 - dd / 520);
    ctx.fillStyle = `rgba(90,220,255,${al})`; ctx.beginPath(); ctx.arc(sx, sy - 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(170,235,255,${al})`; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText(s.ad, sx, sy - 18);
  }

  // En yakın drone alarmı
  let prox = Infinity;
  for (const dr of durum.droneler || []) prox = Math.min(prox, Math.hypot(ben.x - dr.x, ben.y - dr.y));
  if (!genel && prox < 360) {
    const alarm = (1 - prox / 360) * 0.4;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    vg.addColorStop(0, "rgba(210,30,30,0)"); vg.addColorStop(1, `rgba(210,30,30,${alarm})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  // Genel bakış etiketi
  if (genel) {
    ctx.fillStyle = "rgba(210,225,240,0.9)"; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center";
    ctx.fillText("GENEL BAKIŞ — çıkmak için M (veya buton)", w / 2, h - 16);
  }
}

// Oda içi mobilya/detaylar (top-down, temaya göre). Işıkta zengin görünür.
function mobilyaCiz(ctx, a, s2, t) {
  const ad = a.ad || "";
  const R = (wx, wy, ww, hh, fill, stroke) => {
    const [x, y] = s2(wx, wy);
    ctx.fillStyle = fill; ctx.fillRect(x, y, ww, hh);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1); }
  };
  const daire = (wx, wy, rr, fill) => { const [x, y] = s2(wx, wy); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); };

  // Koridorlar: sadece yön okları; duvar detayı yok.
  if (a.koridor) {
    if (/Koridor/.test(ad)) {
      ctx.strokeStyle = "rgba(90,160,180,0.12)"; ctx.lineWidth = 3;
      for (let cx = a.x + 120; cx < a.x + a.w - 80; cx += 240) {
        const [x, y] = s2(cx, a.y + a.h / 2);
        ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x - 8, y + 8); ctx.stroke();
      }
    }
    return;
  }

  // Her odaya ortak duvar detayları (dolap, kitaplık, beyaz tahta, saat, bitki, halı, çöp)
  duvarDetay(ctx, a, s2, t);
  return; // Zemin mobilyası artık engeller'den (cizEngel) çizilir — çarpışmayla uyumlu.

  /* eslint-disable no-unreachable */
  const ofis = /Ofis|Muhasebe|Yönetim|Satış|Pazarlama|Açık|Teknik|Güvenlik|İK/.test(ad);
  if (ofis) {
    for (let dy = a.y + 46; dy < a.y + a.h - 34; dy += 74) {
      for (let dx = a.x + 26; dx < a.x + a.w - 60; dx += 92) {
        R(dx, dy, 50, 26, "#3d4e62", "#0f1620");        // masa
        R(dx + 7, dy + 4, 22, 13, "rgba(100,220,245,0.85)", "#0a2630"); // monitör (glow)
        daire(dx + 25, dy + 42, 8, "#2a3644");           // sandalye
      }
    }
    return;
  }
  if (/Sunucu/.test(ad)) {
    for (let sx = a.x + 30; sx < a.x + a.w - 34; sx += 48) {
      R(sx, a.y + 34, 32, a.h - 74, "#1e2a37", "#0a0f14"); // rack
      for (let ly = a.y + 46; ly < a.y + a.h - 46; ly += 15) {
        const on = Math.sin(t * 6 + sx * 0.3 + ly) > 0;
        daire(sx + 9, ly, 2.4, on ? "#5fe0a0" : "#1e5a3a");
        daire(sx + 20, ly, 2.4, Math.sin(t * 4 + ly) > 0 ? "#ffb14a" : "#5a3a12");
      }
    }
    return;
  }
  if (/Toplantı/.test(ad)) {
    R(a.x + a.w * 0.22, a.y + a.h * 0.34, a.w * 0.56, a.h * 0.34, "#445468", "#141c26"); // masa
    for (let cx = a.x + a.w * 0.28; cx < a.x + a.w * 0.72; cx += 46) {
      daire(cx, a.y + a.h * 0.26, 9, "#2a3644");
      daire(cx, a.y + a.h * 0.74, 9, "#2a3644");
    }
    return;
  }
  if (/Dinlenme/.test(ad)) {
    R(a.x + 28, a.y + a.h - 66, a.w - 56, 30, "#4d4070", "#1c1830");   // kanepe
    R(a.x + a.w / 2 - 32, a.y + a.h - 128, 64, 34, "#3d4e62", "#141c26"); // sehpa
    daire(a.x + 46, a.y + 46, 13, "#2f6b3a");                          // saksı bitki
    daire(a.x + a.w - 46, a.y + 46, 13, "#2f6b3a");
    return;
  }
  if (/Mutfak/.test(ad)) {
    R(a.x + 30, a.y + 34, a.w - 60, 34, "#3d4e62", "#141c26");         // tezgah
    daire(a.x + 60, a.y + 51, 7, "#2a3644"); daire(a.x + 92, a.y + 51, 7, "#2a3644"); // ocak
    R(a.x + a.w - 96, a.y + 34, 62, 96, "#5a6472", "#141c26");         // buzdolabı
    R(a.x + a.w * 0.38, a.y + a.h * 0.55, a.w * 0.28, 62, "#445468", "#141c26"); // yemek masası
    for (const dx of [a.x + a.w * 0.36, a.x + a.w * 0.66]) daire(dx, a.y + a.h * 0.55 + 31, 9, "#2a3644"); // sandalye
    return;
  }
  if (/Arşiv|Depo/.test(ad)) {
    const kutuRenk = ["#7a5a3a", "#5a6a8a", "#7a4a4a", "#4a7a5a"];
    for (let sy = a.y + 54; sy < a.y + a.h - 60; sy += 88) {
      R(a.x + 30, sy, a.w - 60, 22, "#4a4128", "#1c1810");             // raf
      let k = 0;
      for (let bx = a.x + 40; bx < a.x + a.w - 54; bx += 46) { R(bx, sy - 18, 36, 18, kutuRenk[k % 4], "#1a1410"); k++; } // kutular
    }
    return;
  }
  if (/Giriş/.test(ad)) {
    R(a.x + a.w * 0.24, a.y + a.h * 0.52, a.w * 0.52, 26, "#465872", "#1c2531"); // resepsiyon
    R(a.x + 24, a.y + a.h - 46, 60, 18, "#3d4e62", "#141c26");                   // bank
    R(a.x + a.w - 84, a.y + a.h - 46, 60, 18, "#3d4e62", "#141c26");
    return;
  }
  if (/Koridor/.test(ad)) {
    // yön okları (soluk) + ara sıra kasa
    ctx.strokeStyle = "rgba(90,160,180,0.12)"; ctx.lineWidth = 3;
    for (let cx = a.x + 90; cx < a.x + a.w - 60; cx += 170) {
      const [x, y] = s2(cx, a.y + a.h / 2);
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x - 8, y + 8);
      ctx.stroke();
    }
    R(a.x + a.w * 0.5, a.y + 10, 30, 30, "#3a3320", "#1c1810");   // kasa
    R(a.x + a.w * 0.5 + 4, a.y + 14, 22, 22, "rgba(0,0,0,0.2)"); // kapak çizgisi
    return;
  }
}

// Çarpışan mobilya (engel) çizimi — dünya koordinatında, tipe göre.
function cizEngel(ctx, e, t) {
  const { x, y, w, h, tip } = e;
  const R = (fx, fy, fw, fh, f, s) => { ctx.fillStyle = f; ctx.fillRect(fx, fy, fw, fh); if (s) { ctx.strokeStyle = s; ctx.lineWidth = 1; ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1); } };
  switch (tip) {
    case "masa":
      R(x, y, w, h, "#3d4e62", "#0f1620");
      R(x + w * 0.15, y + 4, w * 0.5, h * 0.4, "rgba(100,220,245,0.85)", "#0a2630"); // monitör
      break;
    case "masa_buyuk":
      R(x, y, w, h, "#445468", "#141c26");
      R(x + 6, y + 6, w - 12, h - 12, "rgba(255,255,255,0.05)");
      break;
    case "raf": // sunucu rafı
      R(x, y, w, h, "#1e2a37", "#0a0f14");
      for (let ly = y + 8; ly < y + h - 8; ly += 13) {
        ctx.fillStyle = Math.sin(t * 6 + ly + x) > 0 ? "#5fe0a0" : "#1e5a3a"; ctx.fillRect(x + 5, ly, 3, 3);
        ctx.fillStyle = Math.sin(t * 4 + ly) > 0 ? "#ffb14a" : "#5a3a12"; ctx.fillRect(x + w - 9, ly, 3, 3);
      }
      break;
    case "raf_kutu": // arşiv rafı + kutular
      R(x, y, w, h, "#4a4128", "#1c1810");
      { const renk = ["#7a5a3a", "#5a6a8a", "#7a4a4a", "#4a7a5a"]; let k = 0;
        for (let bx = x + 6; bx < x + w - 34; bx += 40) { R(bx, y - 16, 34, 16, renk[k % 4], "#1a1410"); k++; } }
      break;
    case "kanepe":
      R(x, y, w, h, "#4d4070", "#1c1830");
      R(x + 4, y - 8, w - 8, 12, "#5a4d80", "#1c1830");
      break;
    case "sehpa":
      R(x, y, w, h, "#3d4e62", "#141c26");
      break;
    case "tezgah":
      R(x, y, w, h, "#3d4e62", "#141c26");
      ctx.fillStyle = "#2a3644"; ctx.beginPath(); ctx.arc(x + w * 0.3, y + h / 2, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h / 2, 5, 0, 7); ctx.fill();
      break;
    case "buzdolabi":
      R(x, y, w, h, "#5a6472", "#141c26");
      R(x + w - 6, y + 8, 3, 18, "#c9d4e0");
      break;
    default:
      R(x, y, w, h, "#3a3320", "#1c1810");
  }
}

// Her odaya ortak duvar detayları: dolap, kitaplık, beyaz tahta, saat, bitki, halı, çöp kovası.
function duvarDetay(ctx, a, s2, t) {
  const R = (wx, wy, ww, hh, f, s) => { const [x, y] = s2(wx, wy); ctx.fillStyle = f; ctx.fillRect(x, y, ww, hh); if (s) { ctx.strokeStyle = s; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1); } };
  const daire = (wx, wy, rr, f) => { const [x, y] = s2(wx, wy); ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); };

  // Zemin halısı (faint)
  const [cx, cy] = s2(a.x + a.w / 2, a.y + a.h / 2);
  ctx.fillStyle = "rgba(70,100,130,0.08)";
  ctx.fillRect(cx - a.w * 0.3, cy - a.h * 0.22, a.w * 0.6, a.h * 0.44);

  // Üst duvar: dolap (kapaklı)
  R(a.x + 20, a.y + 8, a.w * 0.3, 22, "#33404f", "#141c26");
  for (let i = 0; i < 3; i++) R(a.x + 26 + i * (a.w * 0.3 / 3), a.y + 11, a.w * 0.3 / 3 - 5, 16, "#3d4e62");
  // Üst duvar sağ: kitaplık (renkli kitap sırtları)
  kitaplik(ctx, s2, a.x + a.w * 0.58, a.y + 8, a.w * 0.34, 22);

  // Sol duvar: beyaz tahta
  R(a.x + 8, a.y + a.h * 0.4, 15, a.h * 0.26, "#dfe7ef", "#3a4658");
  // Sağ duvar: dosya dolabı (çekmeceli)
  R(a.x + a.w - 23, a.y + a.h * 0.38, 15, a.h * 0.3, "#4a5666", "#141c26");
  for (let dy = a.y + a.h * 0.4; dy < a.y + a.h * 0.66; dy += 22) { const [x, y] = s2(a.x + a.w - 21, dy); ctx.strokeStyle = "#141c26"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y); ctx.stroke(); }

  // Duvar saati (sağ üst) — akrep döner
  const [clx, cly] = s2(a.x + a.w - 30, a.y + 26);
  ctx.fillStyle = "#c9d4e0"; ctx.beginPath(); ctx.arc(clx, cly, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#1c2531"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(clx, cly); ctx.lineTo(clx + 4.5 * Math.cos(t * 0.5), cly + 4.5 * Math.sin(t * 0.5)); ctx.stroke();

  // Köşe saksı bitkileri + saksı
  daire(a.x + 24, a.y + a.h - 24, 10, "#2f7b42"); R(a.x + 18, a.y + a.h - 18, 12, 12, "#5a3a22", "#1a1410");
  daire(a.x + a.w - 24, a.y + a.h - 24, 10, "#2f7b42"); R(a.x + a.w - 30, a.y + a.h - 18, 12, 12, "#5a3a22", "#1a1410");
  // Çöp kovası
  R(a.x + a.w - 44, a.y + a.h * 0.5, 12, 16, "#2a3644", "#141c26");
}

function kitaplik(ctx, s2, wx, wy, ww, hh) {
  const [x, y] = s2(wx, wy);
  ctx.fillStyle = "#4a3320"; ctx.fillRect(x, y, ww, hh);
  const renkler = ["#7a4a4a", "#5a6a8a", "#7a5a3a", "#4a7a5a", "#8a7a4a", "#6a4a7a"];
  let k = 0;
  for (let bx = x + 3; bx < x + ww - 4; bx += 6) { ctx.fillStyle = renkler[k % renkler.length]; ctx.fillRect(bx, y + 3, 4, hh - 6); k++; }
  ctx.strokeStyle = "#1c1810"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1);
}

// Kapüşonlu top-down figür (cyberpunk) — neon aksanlı. sen=true daha kontrastlı/parlak.
function cizKisi(ctx, x, y, aksan, aci, yakalandi, t, sen) {
  const r = OYUNCU_YARICAP * (sen ? 1.15 : 1);
  ctx.save();
  ctx.translate(x, y);
  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.ellipse(0, r * 0.5, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(aci + Math.PI / 2);
  // omuzlar
  ctx.fillStyle = sen ? "#2c3a4a" : "#1c2531";
  ctx.beginPath(); ctx.ellipse(0, 2, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  // kapüşon (sen için daha açık → görünür)
  ctx.fillStyle = sen ? "#4a5c70" : "#2a3644";
  ctx.beginPath(); ctx.arc(0, -2, r * 0.78, 0, Math.PI * 2); ctx.fill();
  // koyu dış hat (her zeminde okunur)
  ctx.strokeStyle = "rgba(6,10,16,0.9)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -2, r * 0.78, 0, Math.PI * 2); ctx.stroke();
  // yüz gölgesi (kapüşon içi)
  ctx.fillStyle = "#0c1118";
  ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.42, 0, Math.PI * 2); ctx.fill();
  // neon aksan çemberi (kimlik rengi) + parıltı
  ctx.strokeStyle = aksan; ctx.lineWidth = sen ? 3 : 2.5;
  if (sen) { ctx.shadowColor = aksan; ctx.shadowBlur = 8; }
  ctx.beginPath(); ctx.arc(0, -2, r * 0.82, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  ctx.shadowBlur = 0;
  // vizör (bakış yönü ileri = yukarı)
  ctx.fillStyle = aksan;
  ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (yakalandi) { ctx.fillStyle = "rgba(255,90,90,0.95)"; ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.fillText("✖", x, y - r - 5); }
}

// Detaylı drone: gövde + 4 rotor + tarama ışını.
function cizDrone(ctx, x, y, aci, kovala, t) {
  ctx.save();
  ctx.translate(x, y);
  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, 12, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(aci);
  const ana = kovala ? "#c83a3a" : "#5a6f88";
  // rotorlar (çapraz kollar ucunda daireler)
  ctx.strokeStyle = "#39434f"; ctx.lineWidth = 3;
  for (const [rx, ry] of [[10, 10], [10, -10], [-10, 10], [-10, -10]]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.fillStyle = "#2b333d";
    ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(120,140,160,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(rx, ry, 6 + Math.sin(t * 30 + rx) * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#39434f"; ctx.lineWidth = 3;
  }
  // gövde
  ctx.fillStyle = ana;
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // tarama gözü (ileri)
  ctx.fillStyle = kovala ? "#ff5a5a" : "#7fd0ff";
  ctx.beginPath(); ctx.arc(5, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  // tarama ışını konisi (ileri)
  const beam = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
  beam.addColorStop(0, kovala ? "rgba(255,60,60,0.25)" : "rgba(120,200,255,0.18)");
  beam.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -0.5, 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}
