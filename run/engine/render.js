// ============================================================
// RUN — render (Canvas 2D, takip kamera, sınırlı görüş/fener).
// Cyberpunk atmosfer: panelli zemin, neon kenarlar, kapüşonlu figürler,
// detaylı drone, fener içi toz zerreleri, monitörler, neon çıkış.
// Duvar/kapı katmanı, ele geçirme animasyonu ve parçacıklar dahil.
// Kod-çizim (prototip). Görsel detay kademeli yükseltiliyor.
// ============================================================

import {
  GORUS_YARICAP, FENER_UZUNLUK, FENER_ACI, OYUNCU_YARICAP, KARANLIK_ALFA,
  KAPI_KALINLIK, KAPI_KIRILMA, KAPI_MENZIL, HACK_SURE, HACK_MENZIL,
  TARAMA_MENZIL, CIKIS_SURE,
  SOPA_MENZIL, SOPA_ACI, SOPA_SAVURMA, SOPA_BEKLEME, DASH_BEKLEME,
} from "./sabitler.js";
import { odaAdi } from "./harita.js";
import { taramaAcisi } from "./durum.js";

// --- Işık oklüzyonu (fener duvardan sızmasın) ---
// Duvar dikdörtgenlerinin ışığa sırtı dönük kenarlarından gölge dörtgenleri
// üretir (ekran uzayında Path2D). Kapı geçitleri duvar olmadığı için ışık
// doğal olarak kapılardan sızar; kapalı kapının enerji perdesi ışığı kesmez.
function golgeYolu(harita, lx, ly, w2s) {
  const yol = new Path2D();
  const M = FENER_UZUNLUK + GORUS_YARICAP + 80;   // ışığın erişebileceği azami menzil
  const B = 1600;                                  // gölge projeksiyon uzunluğu
  for (const e of harita.engeller) {
    if (e.tip !== "duvar") continue;               // mobilya alçak: ışığı kesmez
    if (e.x + e.w < lx - M || e.x > lx + M || e.y + e.h < ly - M || e.y > ly + M) continue;
    // Işığa sırtı dönük kenarlar (gölge duvarın arkasından başlar; ön yüz aydınlık kalır)
    const kenarlar = [];
    if (ly > e.y) kenarlar.push([e.x, e.y, e.x + e.w, e.y]);                       // üst
    if (ly < e.y + e.h) kenarlar.push([e.x, e.y + e.h, e.x + e.w, e.y + e.h]);     // alt
    if (lx > e.x) kenarlar.push([e.x, e.y, e.x, e.y + e.h]);                       // sol
    if (lx < e.x + e.w) kenarlar.push([e.x + e.w, e.y, e.x + e.w, e.y + e.h]);     // sağ
    for (const [x1, y1, x2, y2] of kenarlar) {
      const d1 = Math.hypot(x1 - lx, y1 - ly) || 1, d2 = Math.hypot(x2 - lx, y2 - ly) || 1;
      const [p1x, p1y] = w2s(x1, y1), [p2x, p2y] = w2s(x2, y2);
      const [q1x, q1y] = w2s(x1 + ((x1 - lx) / d1) * B, y1 + ((y1 - ly) / d1) * B);
      const [q2x, q2y] = w2s(x2 + ((x2 - lx) / d2) * B, y2 + ((y2 - ly) / d2) * B);
      yol.moveTo(p1x, p1y); yol.lineTo(p2x, p2y); yol.lineTo(q2x, q2y); yol.lineTo(q1x, q1y); yol.closePath();
    }
  }
  return yol;
}

// Additive ışık için ara katman tuvali (gölgeler destination-out ile kesilir).
let isikTuval = null, isikCtx = null;
function isikKatmani(w, h) {
  if (!isikTuval) { isikTuval = document.createElement("canvas"); isikCtx = isikTuval.getContext("2d"); }
  if (isikTuval.width !== w || isikTuval.height !== h) { isikTuval.width = w; isikTuval.height = h; }
  return isikCtx;
}

// Hedef, izlenenin IŞIĞININ içinde mi? (yakın çevre ışığı VEYA fener konisi VEYA
// hedefin bulunduğu odanın ışıkları açık) VE arada duvar yok mu?
// Diğer oyuncular yalnızca bu durumda görünür/etiketlenir.
function isikta(harita, kaynak, hx, hy) {
  const dx = hx - kaynak.x, dy = hy - kaynak.y;
  const uz = Math.hypot(dx, dy);
  let aydinlatiyor = uz < GORUS_YARICAP + 18;
  if (!aydinlatiyor && uz < FENER_UZUNLUK) {
    let fark = Math.abs(Math.atan2(dy, dx) - kaynak.aci);
    if (fark > Math.PI) fark = Math.PI * 2 - fark;
    aydinlatiyor = fark <= FENER_ACI + 0.06;
  }
  if (!aydinlatiyor) {
    // Hedef ışığı açık bir odadaysa uzaktan da görülebilir (görüş hattı şartıyla)
    for (const a of harita.alanlar) {
      if (a.aydinlik && hx >= a.x && hx <= a.x + a.w && hy >= a.y && hy <= a.y + a.h) { aydinlatiyor = true; break; }
    }
  }
  if (!aydinlatiyor) return false;
  // Görüş hattı: duvarlar keser (mobilya alçak, kesmez)
  const adim = Math.max(2, Math.ceil(uz / 18));
  for (let i = 1; i < adim; i++) {
    const px = kaynak.x + (dx * i) / adim, py = kaynak.y + (dy * i) / adim;
    for (const e of harita.engeller) {
      if (e.tip !== "duvar") continue;
      if (px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) return false;
    }
  }
  return true;
}

// Oda tipine göre zemin tonu + kenar neon rengi — her oda tipi farklı okunsun
const TABAN = {
  ofis: "#2b3c4d", acik_ofis: "#2d3e4a", sunucu: "#233742", toplanti: "#303b4e",
  dinlenme: "#3a3550", mutfak: "#3b4046", kafeterya: "#413c35", arsiv: "#38392f",
  depo: "#333734", guvenlik: "#2c3b50", lab: "#28414b", giris: "#384153",
  atrium: "#2c4534", plaza: "#334357",
};
const KENAR = {
  ofis: "90,180,215", acik_ofis: "90,180,215", sunucu: "80,225,205", toplanti: "150,170,235",
  dinlenme: "185,140,235", mutfak: "230,190,120", kafeterya: "240,175,95", arsiv: "195,180,115",
  depo: "205,165,95", guvenlik: "240,120,120", lab: "120,205,255", giris: "160,200,240",
  atrium: "95,220,140", plaza: "140,190,230",
};

export function ciz(ctx, durum, view) {
  const { w, h } = view;
  const t = durum.zaman;
  const worldW = durum.harita.genislik, worldH = durum.harita.yukseklik;
  const genel = !!durum.genelBakis;                    // GENEL BAKIŞ (uzaklaştırılmış tüm harita)
  const zoom = genel ? Math.min((w - 40) / worldW, (h - 40) / worldH) : 1;
  const ben = durum.oyuncular[0];
  // Kamera/fener kaynağı: normalde oyuncu; izleyici modunda izlenen canlı oyuncu.
  const izlenen = durum.oyuncular.find((s) => s.id === durum.izlenenId) || ben;
  const izlAksan = izlenen.id === "ben" ? "#f0c651" : "#49c6e0";
  // Ekran sarsıntısı: vuruş/patlama/yakalanma anında kamera titrer
  const sars = !genel && durum.sarsinti > 0 ? durum.sarsinti : 0;
  const camX = (genel ? worldW / 2 : durum.kamera.x) + (sars ? (Math.random() - 0.5) * sars : 0);
  const camY = (genel ? worldH / 2 : durum.kamera.y) + (sars ? (Math.random() - 0.5) * sars : 0);
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
    ctx.fillStyle = a.aydinlik ? "#3c5064" : a.koridor ? "#242f3a" : TABAN[a.tip] || "#2b3c4d";
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
    const kn = KENAR[a.tip] || "90,180,215";
    ctx.strokeStyle = a.aydinlik ? `rgba(${kn},0.6)` : a.koridor ? "rgba(60,120,140,0.2)" : `rgba(${kn},0.35)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 1, ry + 1, a.w - 2, a.h - 2);
  }
  // Engeller (çarpışan mobilya + oda duvarları) — tipe göre çizilir
  for (const eng of durum.harita.engeller || []) {
    if (eng.x > gR || eng.y > gB || eng.x + eng.w < gL || eng.y + eng.h < gT) continue;
    cizEngel(ctx, eng, t);
  }
  // Kapı geçitleri (eşik + söve) — kapalıysa perde ekranda ayrıca çizilir
  for (const k of durum.harita.kapilar || []) {
    if (k.x > gR || k.y > gB || k.x + k.w < gL || k.y + k.h < gT) continue;
    cizKapiEsigi(ctx, k);
  }
  // Çıkış kapıları: AÇIK → yeşil kayan şeritli "acil çıkış"; KİLİTLİ → kırmızı,
  // durağan şeritli, kilit sembollü (panel hack'lenince yeşile döner).
  for (const c of durum.harita.cikislar) {
    const acik = !!c.acik;
    ctx.fillStyle = acik ? "#12351f" : "#3a1414"; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    const yatayGecit = c.w > c.h;              // kuzey çıkışı yatay, yan çıkışlar dikey
    const kayma = acik ? (t * 36) % 22 : 0;    // kilitliyken şeritler akmaz
    ctx.fillStyle = acik
      ? `rgba(70,240,130,${0.30 + 0.12 * Math.sin(t * 5)})`
      : `rgba(255,80,70,${0.22 + 0.10 * Math.sin(t * 2.5)})`;
    if (yatayGecit) for (let sy = c.y - 22 + kayma; sy < c.y + c.h; sy += 22) ctx.fillRect(c.x + 4, sy, c.w - 8, 7);
    else for (let sx = c.x - 22 + kayma; sx < c.x + c.w; sx += 22) ctx.fillRect(sx, c.y + 4, 7, c.h - 8);
    ctx.restore();
    ctx.strokeStyle = acik ? "rgba(90,255,150,0.85)" : "rgba(255,90,80,0.85)"; ctx.lineWidth = 3;
    ctx.strokeRect(c.x + 1.5, c.y + 1.5, c.w - 3, c.h - 3);
    if (!acik) {
      ctx.fillStyle = "rgba(255,150,140,0.95)"; ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🔒", c.x + c.w / 2, c.y + c.h / 2);
    }
  }
  // Çıkış panelleri: terminal kutusu — açılmamış turuncu nabız, açılmış sönük yeşil
  for (const p of durum.harita.paneller || []) {
    const pn = p.acildi ? 0 : 0.5 + 0.5 * Math.sin(t * 6);
    if (!p.acildi) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,190,80,${0.35 + 0.4 * pn})`; ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255,190,80,0.9)"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17 + pn * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "#101820"; ctx.fillRect(p.x - 10, p.y - 8, 20, 16);
    ctx.fillStyle = p.acildi ? "rgba(90,220,140,0.75)" : `rgba(255,190,80,${0.55 + 0.4 * pn})`;
    ctx.fillRect(p.x - 8, p.y - 6, 16, 12);
    ctx.strokeStyle = p.acildi ? "rgba(120,255,170,0.7)" : "rgba(255,210,120,0.9)";
    ctx.lineWidth = 1.5; ctx.strokeRect(p.x - 10, p.y - 8, 20, 16);
  }

  ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center";
  for (const a of durum.harita.alanlar) {
    if (!a.ad) continue;
    const gen = ctx.measureText(a.ad).width + 14;
    ctx.fillStyle = "rgba(10,16,22,0.55)"; ctx.fillRect(a.x + a.w / 2 - gen / 2, a.y + 5, gen, 16);
    ctx.fillStyle = "rgba(140,200,220,0.6)"; ctx.fillText(a.ad, a.x + a.w / 2, a.y + 17);
  }
  for (const n of durum.harita.nesneler || []) {
    if (n.aktif) {
      // Ele geçiriliyor: nabız gibi kırmızı-turuncu uyarı halkası (drone çeker)
      const pn = 0.55 + 0.45 * Math.sin(t * 8);
      ctx.save();
      ctx.strokeStyle = `rgba(255,120,50,${pn})`; ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(255,120,50,0.9)"; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(n.x, n.y, 16 + Math.sin(t * 8) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#1a0e0a"; ctx.fillRect(n.x - 9, n.y - 7, 18, 14);
      ctx.fillStyle = `rgba(255,150,60,${pn})`; ctx.fillRect(n.x - 7, n.y - 5, 14, 10);
    } else {
      ctx.fillStyle = "#0c1620"; ctx.fillRect(n.x - 9, n.y - 7, 18, 14);
      const par = 0.5 + 0.4 * Math.sin(t * 3 + n.x);
      ctx.fillStyle = `rgba(70,200,220,${par})`; ctx.fillRect(n.x - 7, n.y - 5, 14, 10);
    }
    ctx.strokeStyle = n.aktif ? "rgba(255,180,120,0.9)" : "rgba(120,230,240,0.7)"; ctx.lineWidth = 1; ctx.strokeRect(n.x - 9, n.y - 7, 18, 14);
  }
  // Veri çipleri (toplanabilir) — dönen elmas, yerde parlar
  for (const c of durum.cipler || []) {
    if (c.alindi || c.x > gR || c.y > gB || c.x < gL || c.y < gT) continue;
    const don = t * 2.2 + c.x * 0.01;
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(don);
    ctx.fillStyle = "rgba(90,255,190,0.9)";
    ctx.shadowColor = "rgba(90,255,190,0.8)"; ctx.shadowBlur = 10;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(10,30,20,0.9)"; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
  // BİNA PLANI (genel bakış) taktik harita: diğer oyuncular ve droneler ÇİZİLMEZ —
  // canlı konum bilgisi yalnızca kendi ışığınla elde edilir (stealth mantığı).
  if (!genel) {
    for (const s of durum.oyuncular) {
      if (s.id === izlenen.id) continue;
      // Görünürlük kuralı gövdeye de uygulanır: ışığında (veya aydınlık odada,
      // görüş hattı açıkken) değilse SİLÜETİ BİLE çizilmez.
      if (!isikta(durum.harita, izlenen, s.x, s.y)) continue;
      const renk = s.yakalandi ? "#5a6472" : s.cikti ? "#4dd08a" : s.id === "ben" ? "#f0c651" : "#49c6e0";
      cizKisi(ctx, s.x, s.y, s, renk, t, s.id === "ben" && !s.yakalandi);
    }
    for (const dr of durum.droneler || []) { if (dr.yok > 0) continue; cizDrone(ctx, dr.x, dr.y, dr.aci, dr.mod === "kovala", t, dr.sersem > 0, dr.tip); }
    // Drone kilit/ateş ışını (kovaladığı hedefe)
    for (const dr of durum.droneler || []) {
      if (dr._kilit <= 0 && dr._ates <= 0) continue;
      const hedef = durum.oyuncular.find((s) => s.id === dr.hedefId && !s.yakalandi && !s.cikti);
      if (!hedef) continue;
      const atesli = dr._ates > 0;
      ctx.save();
      ctx.strokeStyle = atesli ? "rgba(255,60,60,0.95)" : `rgba(255,90,70,${0.25 + 0.4 * (dr._kilit / 1.05)})`;
      ctx.lineWidth = atesli ? 4 : 1.5;
      if (atesli) { ctx.shadowColor = "rgba(255,60,60,0.9)"; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.moveTo(dr.x, dr.y); ctx.lineTo(hedef.x, hedef.y); ctx.stroke();
      ctx.restore();
    }
  }
  if (genel) cizKisi(ctx, izlenen.x, izlenen.y, izlenen, izlAksan, t, true); // planda kendi konumun

  ctx.restore();

  // --- Normal mod: STEALTH karanlık + fener (ekran uzayı, duvar gölgeli) ---
  if (!genel) {
    const [bx, by] = w2s(izlenen.x, izlenen.y);
    const aci = izlenen.aci;
    const golge = golgeYolu(durum.harita, izlenen.x, izlenen.y, w2s);
    const L = isikKatmani(w, h);

    // 1) Işık maskesi (ara katman): çevre ışığı + fener konisi; duvar gölgeleri kesilir
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = "source-over";
    L.clearRect(0, 0, w, h);
    const rg = L.createRadialGradient(bx, by, 8, bx, by, GORUS_YARICAP);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    L.fillStyle = rg; L.beginPath(); L.arc(bx, by, GORUS_YARICAP, 0, Math.PI * 2); L.fill();
    L.save();
    L.beginPath(); L.moveTo(bx, by); L.arc(bx, by, FENER_UZUNLUK, aci - FENER_ACI, aci + FENER_ACI); L.closePath(); L.clip();
    const cg = L.createRadialGradient(bx, by, 8, bx, by, FENER_UZUNLUK);
    cg.addColorStop(0, "rgba(255,255,255,1)"); cg.addColorStop(0.65, "rgba(255,255,255,0.72)"); cg.addColorStop(1, "rgba(255,255,255,0)");
    L.fillStyle = cg; L.fillRect(0, 0, w, h);
    L.restore();
    L.globalCompositeOperation = "destination-out";
    L.fillStyle = "#fff";   // opak fırça: gölge TAM silinsin (gradyan fırça kalıntısı olmasın)
    L.fill(golge);

    // 2) Karanlık örtü: maske kadar sil (gölgede kalan yerler karanlık kalır)
    ctx.save();
    ctx.fillStyle = `rgba(5,8,13,${KARANLIK_ALFA})`;   // karanlık (stealth)
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(isikTuval, 0, 0, w, h);
    // Aydınlık odalar uzaktan da seçilir (GPS bilgisi — bilinçli olarak gölgeden muaf)
    for (const a of durum.harita.alanlar) { if (!a.aydinlik) continue; const [rx, ry] = w2s(a.x, a.y); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(rx, ry, a.w, a.h); }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";

    // 3) Sıcak ışık (additive) — aynı gölge maskesiyle, duvardan taşmaz
    L.globalCompositeOperation = "source-over";
    L.clearRect(0, 0, w, h);
    const wl = L.createRadialGradient(bx, by, 8, bx, by, GORUS_YARICAP);
    wl.addColorStop(0, "rgba(180,220,255,0.16)"); wl.addColorStop(1, "rgba(180,220,255,0)");
    L.fillStyle = wl; L.beginPath(); L.arc(bx, by, GORUS_YARICAP, 0, Math.PI * 2); L.fill();
    L.save();
    L.beginPath(); L.moveTo(bx, by); L.arc(bx, by, FENER_UZUNLUK, aci - FENER_ACI, aci + FENER_ACI); L.closePath(); L.clip();
    const wc = L.createRadialGradient(bx, by, 8, bx, by, FENER_UZUNLUK);
    wc.addColorStop(0, "rgba(210,235,255,0.26)"); wc.addColorStop(0.6, "rgba(190,225,255,0.10)"); wc.addColorStop(1, "rgba(190,225,255,0)");
    L.fillStyle = wc; L.fillRect(0, 0, w, h);
    L.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 14; i++) {
      const dm = ((i * 97 + t * 40) % FENER_UZUNLUK);
      const yan = Math.sin(i * 2.3 + t * 0.8) * dm * Math.tan(FENER_ACI) * 0.8;
      const px = bx + Math.cos(aci) * dm - Math.sin(aci) * yan;
      const py = by + Math.sin(aci) * dm + Math.cos(aci) * yan;
      L.globalAlpha = 0.25 * (1 - dm / FENER_UZUNLUK); L.fillRect(px, py, 1.6, 1.6);
    }
    L.globalAlpha = 1;
    L.restore();
    L.globalCompositeOperation = "destination-out";
    L.fillStyle = "#fff";
    L.fill(golge);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(isikTuval, 0, 0, w, h);
    ctx.restore();

    // KILIÇ SAVURMA — gerçek kesme efekti: bıçak koninin bir ucundan öbürüne
    // süpürür; arkasında sönümlenen enerji izi (dolgu yayı) bırakır.
    if (izlenen._sopaFlash > 0) {
      const p = 1 - izlenen._sopaFlash / SOPA_SAVURMA;          // 0→1 savurma ilerlemesi
      const R = SOPA_MENZIL + OYUNCU_YARICAP;
      const yon = izlenen._savurmaYon || 1;                     // kombo: her savuruş ters yönden
      const bas = aci - SOPA_ACI * yon;
      const uc = bas + yon * SOPA_ACI * 2 * Math.min(1, p * 1.25); // bıçağın anlık açısı
      const ccw = yon < 0;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // 1) Enerji izi: başlangıçtan bıçağa kadar dolu süpürme yayı (dışa doğru parlar)
      const iz = ctx.createRadialGradient(bx, by, R * 0.15, bx, by, R);
      iz.addColorStop(0, "rgba(120,220,255,0)");
      iz.addColorStop(0.55, `rgba(140,230,255,${0.22 * (1 - p * 0.6)})`);
      iz.addColorStop(1, `rgba(200,250,255,${0.4 * (1 - p * 0.6)})`);
      ctx.fillStyle = iz;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, R, bas, uc, ccw); ctx.closePath(); ctx.fill();
      // 2) Bıçağın kendisi: parlak kesme kenarı (uçta ışık patlaması)
      ctx.strokeStyle = `rgba(235,255,255,${0.95 * (1 - p * 0.35)})`;
      ctx.lineWidth = 4.5; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(140,235,255,1)"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(uc) * OYUNCU_YARICAP * 0.6, by + Math.sin(uc) * OYUNCU_YARICAP * 0.6);
      ctx.lineTo(bx + Math.cos(uc) * R, by + Math.sin(uc) * R); ctx.stroke();
      // 3) Dış yay çizgisi (menzil okuması — nereye kadar vurduğun belli olur)
      ctx.shadowBlur = 8;
      ctx.strokeStyle = `rgba(160,240,255,${0.5 * (1 - p)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, R, bas, uc, ccw); ctx.stroke();
      ctx.restore();
    }
    // Kalkan halkası (dokunulmazlık)
    if (izlenen.kalkan > 0) {
      const pk = 0.5 + 0.35 * Math.sin(t * 10);
      ctx.save(); ctx.strokeStyle = `rgba(90,200,255,${pk})`; ctx.lineWidth = 3; ctx.shadowColor = "rgba(90,200,255,0.9)"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(bx, by, OYUNCU_YARICAP + 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    cizKisi(ctx, bx, by, izlenen, izlAksan, t, true); // izlenen net, en üstte

    // Kapı "acil durum aydınlatması": söve uçlarında minik ışıklar — karanlıkta
    // bile yakın kapılar seçilir (gerçek binalardaki kapı üstü acil lambası gibi).
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const k of durum.harita.kapilar) {
      const kx = k.x + k.w / 2, ky = k.y + k.h / 2;
      const uz = Math.hypot(kx - izlenen.x, ky - izlenen.y);
      if (uz > 560) continue;
      const al = (1 - uz / 560) * (0.55 + 0.3 * Math.sin(t * 3 + kx * 0.05));
      const renk = k.kapali ? "255,150,80" : "120,225,245";
      const uclar = k.yatay ? [[k.x, ky], [k.x + k.w, ky]] : [[kx, k.y], [kx, k.y + k.h]];
      for (const [ux, uy] of uclar) {
        const [sx, sy] = w2s(ux, uy);
        ctx.fillStyle = `rgba(${renk},${al * 0.25})`;
        ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${renk},${al})`;
        ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Veri çipi işaret ışığı: karanlıkta bile yakındaki çipler yeşil parlar (keşfe çağırır)
    for (const c of durum.cipler || []) {
      if (c.alindi) continue;
      const uz = Math.hypot(c.x - izlenen.x, c.y - izlenen.y);
      if (uz > 620) continue;
      const [sx, sy] = w2s(c.x, c.y);
      const al = (1 - uz / 620) * (0.5 + 0.35 * Math.sin(t * 5 + c.x * 0.03));
      ctx.fillStyle = `rgba(90,255,190,${al * 0.22})`;
      ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(150,255,210,${al})`;
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // KIRMIZI TARAMA KONİLERİ — drone'un kendi arama ışığı, karanlığın üstünde
    // görünür. Kırmızı koniyi gören oyuncu kaçmalı/saklanmalı: içine girersen
    // (arada duvar yoksa) anında fark edilirsin. Duvarlar koniyi keser.
    let koniSayisi = 0;
    for (const dr of durum.droneler || []) {
      if (dr.sersem > 0 || dr.yok > 0 || koniSayisi >= 4) continue;
      const koniAci = taramaAcisi(dr);            // sessiz drone: koni yok (görünmez tehdit)
      if (koniAci <= 0) continue;
      const [dx0, dy0] = w2s(dr.x, dr.y);
      if (dx0 < -TARAMA_MENZIL || dx0 > w + TARAMA_MENZIL || dy0 < -TARAMA_MENZIL || dy0 > h + TARAMA_MENZIL) continue;
      koniSayisi++;
      const yon = dr._tarama ?? dr.aci;
      const gol = golgeYolu(durum.harita, dr.x, dr.y, w2s);
      const kovala = dr.mod === "kovala";
      L.globalCompositeOperation = "source-over";
      L.clearRect(0, 0, w, h);
      const kg = L.createRadialGradient(dx0, dy0, 10, dx0, dy0, TARAMA_MENZIL);
      kg.addColorStop(0, kovala ? "rgba(255,50,50,0.36)" : "rgba(255,60,55,0.27)");
      kg.addColorStop(1, "rgba(255,60,55,0)");
      L.fillStyle = kg;
      L.beginPath(); L.moveTo(dx0, dy0);
      L.arc(dx0, dy0, TARAMA_MENZIL, yon - koniAci, yon + koniAci);
      L.closePath(); L.fill();
      L.globalCompositeOperation = "destination-out";
      L.fillStyle = "#fff";
      L.fill(gol);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(isikTuval, 0, 0, w, h); ctx.restore();
    }

    // Kaçış kanalı ilerlemesi: çıkışta beklerken yeşil halka dolur
    if (izlenen._cikis > 0 && !izlenen.cikti && !izlenen.yakalandi) {
      const oran = Math.min(1, izlenen._cikis / CIKIS_SURE);
      ctx.save();
      ctx.strokeStyle = "rgba(15,40,25,0.9)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(90,255,150,0.95)"; ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(90,255,150,0.9)"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bx, by, 30, -Math.PI / 2, -Math.PI / 2 + oran * Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#b8ffd0"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
      ctx.fillText("KAÇIŞ %" + Math.round(oran * 100), bx, by - 40);
      ctx.restore();
    }

    // Hedef pusulası: açık çıkış varsa en yakınına (yeşil); hiçbiri açık değilse
    // en yakın açılmamış ÇIKIŞ PANELİNE (turuncu, "PANEL") yönlendirir.
    if (!durum.bitti && !izlenen.yakalandi && !izlenen.cikti) {
      let enC = null, enU = Infinity, panelMi = false;
      const acikVar = durum.harita.cikislar.some((c) => c.acik);
      if (acikVar) {
        for (const c of durum.harita.cikislar) {
          if (!c.acik) continue;
          const cx0 = c.x + c.w / 2, cy0 = c.y + c.h / 2;
          const u = Math.hypot(cx0 - izlenen.x, cy0 - izlenen.y);
          if (u < enU) { enU = u; enC = { x: cx0, y: cy0 }; }
        }
      } else {
        panelMi = true;
        for (const p of durum.harita.paneller || []) {
          if (p.acildi) continue;
          const u = Math.hypot(p.x - izlenen.x, p.y - izlenen.y);
          if (u < enU) { enU = u; enC = { x: p.x, y: p.y }; }
        }
      }
      if (enC) {
        const renk = panelMi ? "255,190,80" : "70,240,130";
        const yon = Math.atan2(enC.y - izlenen.y, enC.x - izlenen.x);
        const px = bx + Math.cos(yon) * 56, py = by + Math.sin(yon) * 56;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(px, py); ctx.rotate(yon);
        ctx.fillStyle = `rgba(${renk},0.9)`;
        ctx.shadowColor = `rgba(${renk},0.8)`; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
        ctx.rotate(-yon); ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${renk},0.85)`; ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((panelMi ? "PANEL " : "") + Math.round(enU / 10) + "m", 0, 16);
        ctx.restore();
      }
      // Kilitli çıkışın içinde bekliyorsa uyar: önce panel açılmalı
      if (durum.harita.cikislar.some((c) => !c.acik &&
        izlenen.x >= c.x && izlenen.x <= c.x + c.w && izlenen.y >= c.y && izlenen.y <= c.y + c.h)) {
        ctx.fillStyle = "rgba(255,150,120,0.95)"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
        ctx.fillText("🔒 KİLİTLİ — önce paneli hackle", bx, by - 42);
      }
    }
  }

  // Kapalı kapı perdeleri (her modda görünür — taktik bilgi) + drone kırılma çubuğu
  for (const k of durum.harita.kapilar || []) {
    if (!k.kapali) continue;
    const [kx, ky] = w2s(k.x, k.y);
    const bw = Math.max(3, k.w * zoom), bh = Math.max(3, k.h * zoom);
    if (kx + bw < 0 || ky + bh < 0 || kx > w || ky > h) continue;
    const nabiz = 0.5 + 0.5 * Math.sin(t * 12);
    const kiriliyor = k.kirilma > 0;
    const renk = kiriliyor ? "255,120,60" : "90,200,255";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(${renk},${0.16 + 0.2 * nabiz})`;
    ctx.fillRect(kx, ky, bw, bh);
    ctx.strokeStyle = `rgba(${renk},${0.55 + 0.3 * nabiz})`;
    ctx.lineWidth = 2; ctx.shadowColor = `rgba(${renk},0.9)`; ctx.shadowBlur = 12;
    ctx.strokeRect(kx, ky, bw, bh);
    ctx.restore();
    if (kiriliyor) {
      const cx0 = kx + bw / 2, cy0 = ky + bh / 2;
      ctx.fillStyle = "rgba(10,14,20,0.85)"; ctx.fillRect(cx0 - 23, cy0 - 21, 46, 6);
      ctx.fillStyle = "rgba(255,120,60,0.95)";
      ctx.fillRect(cx0 - 22, cy0 - 20, 44 * Math.min(1, k.kirilma / KAPI_KIRILMA), 4);
    }
  }

  // Ele geçirme (hack) halkası + ilerleme yayı
  if (izlenen.hackHedef) {
    const [hx, hy] = w2s(izlenen.hackHedef.x, izlenen.hackHedef.y);
    const oran = Math.min(1, (izlenen._hackIlerleme || 0) / HACK_SURE);
    ctx.save();
    ctx.strokeStyle = "rgba(15,35,45,0.9)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(hx, hy, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(110,240,255,0.95)"; ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(110,240,255,0.9)"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + oran * Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#bff4ff"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(Math.round(oran * 100) + "%", hx, hy + 40);
    ctx.restore();
  } else if (!genel && !durum.izleyici) {
    cizEtkilesimIpucu(ctx, durum, izlenen, w2s);
  }

  // Parçacıklar (kıvılcım/kıvılcım-duman) — karanlığın üstünde, ışıyarak
  if (durum.parcaciklar && durum.parcaciklar.length) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of durum.parcaciklar) {
      const [px, py] = w2s(p.x, p.y);
      if (px < -8 || py < -8 || px > w + 8 || py > h + 8) continue;
      const al = Math.max(0, p.omur / p.maks);
      ctx.fillStyle = `rgba(${p.renk},${al * 0.9})`;
      const b = Math.max(1, p.boy * zoom * (0.5 + al * 0.5));
      ctx.fillRect(px - b / 2, py - b / 2, b, b);
    }
    ctx.restore();
  }

  // Çıkış neon markerları (her zaman görünür); ekran dışındaysa kenara
  // sabitlenmiş yön oku olur — oyuncu çıkışın yönünü hep bilir.
  for (const c of durum.harita.cikislar) {
    let [rx, ry] = w2s(c.x + c.w / 2, c.y + c.h / 2);
    const K = 26;
    const disarida = rx < K || rx > w - K || ry < K || ry > h - K;
    const rnk = c.acik ? "70,240,130" : "255,90,80";       // kilitli çıkış kırmızı işaretlenir
    const isaret = c.acik ? "⎋" : "🔒";
    const metinRenk = c.acik ? "#7dffb0" : "#ff9a90";
    ctx.save();
    if (disarida && !genel) {
      const yon = Math.atan2(ry - h / 2, rx - w / 2);
      rx = Math.max(K, Math.min(w - K, rx));
      ry = Math.max(K, Math.min(h - K, ry));
      ctx.translate(rx, ry); ctx.rotate(yon);
      ctx.fillStyle = `rgba(${rnk},0.75)`; ctx.shadowColor = `rgba(${rnk},0.8)`; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-4, -7); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill();
      ctx.rotate(-yon);
      ctx.fillStyle = metinRenk; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(isaret, -12 * Math.cos(yon) * 1.6, -12 * Math.sin(yon) * 1.6);
    } else {
      const pul = 10 + Math.sin(t * 4) * 2;
      ctx.strokeStyle = `rgba(${rnk},0.9)`; ctx.lineWidth = 3; ctx.shadowColor = `rgba(${rnk},0.9)`; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(rx, ry, pul, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = metinRenk; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowBlur = 8;
      ctx.fillText(isaret, rx, ry);
    }
    ctx.restore();
  }

  // Oyuncu isimleri: YALNIZCA ışığının içindekiler (fener/çevre ışığı + duvar arkası değil).
  // Karanlıktaki oyuncular ne çizilir ne etiketlenir — stealth kuralı.
  if (!genel) {
    for (const s of durum.oyuncular) {
      if (s.id === izlenen.id || s.yakalandi || s.cikti) continue;
      if (!isikta(durum.harita, izlenen, s.x, s.y)) continue;
      const [sx, sy] = w2s(s.x, s.y);
      ctx.fillStyle = "rgba(170,235,255,0.85)"; ctx.font = "10px system-ui"; ctx.textAlign = "center";
      ctx.fillText(s.ad, sx, sy - 20);
    }
  }

  // En yakın drone alarmı
  let prox = Infinity;
  for (const dr of durum.droneler || []) { if (dr.yok > 0) continue; prox = Math.min(prox, Math.hypot(izlenen.x - dr.x, izlenen.y - dr.y)); }
  if (!genel && prox < 360) {
    const alarm = (1 - prox / 360) * 0.4;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    vg.addColorStop(0, "rgba(210,30,30,0)"); vg.addColorStop(1, `rgba(210,30,30,${alarm})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  // Tespit anı stinger'ı: drone seni fark ettiği an kısa kırmızı ekran flaşı
  if (!genel && durum.tespitFlash > 0) {
    const fl = durum.tespitFlash / 0.15;
    const fg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.6);
    fg.addColorStop(0, `rgba(255,40,40,${0.10 * fl})`); fg.addColorStop(1, `rgba(255,40,40,${0.45 * fl})`);
    ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h);
  }

  // Bina planı etiketi
  if (genel) {
    ctx.fillStyle = "rgba(210,225,240,0.9)"; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center";
    ctx.fillText("🗺 BİNA PLANI — canlı konumlar görünmez · kapat: M", w / 2, h - 16);
  }

  cizHud(ctx, durum, view, ben);
}

// Yakındaki etkileşim ipucu: çıkış paneli (E), aktif makine (E) ya da kapı (Q).
function cizEtkilesimIpucu(ctx, durum, ben, w2s) {
  let hedef = null, metin = "";
  for (const p of durum.harita.paneller || []) {
    if (!p.acildi && Math.hypot(p.x - ben.x, p.y - ben.y) < HACK_MENZIL) { hedef = p; metin = "E — çıkış panelini hackle"; break; }
  }
  if (!hedef) for (const n of durum.harita.nesneler || []) {
    if (n.aktif && Math.hypot(n.x - ben.x, n.y - ben.y) < HACK_MENZIL) { hedef = n; metin = "E — ele geçir"; break; }
  }
  if (!hedef && ben._kapiCd <= 0) {
    let enD = KAPI_MENZIL;
    for (const k of durum.harita.kapilar || []) {
      const kx = k.x + k.w / 2, ky = k.y + k.h / 2, d = Math.hypot(kx - ben.x, ky - ben.y);
      if (d < enD) { enD = d; hedef = { x: kx, y: ky }; metin = k.kapali ? "Q — kapıyı aç" : "Q — kapıyı kapat"; }
    }
  }
  if (!hedef) return;
  const [hx, hy] = w2s(hedef.x, hedef.y);
  ctx.save();
  ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const gen = ctx.measureText(metin).width + 14;
  ctx.fillStyle = "rgba(8,14,22,0.8)"; yuvarlakDikdortgen(ctx, hx - gen / 2, hy - 40, gen, 20, 6); ctx.fill();
  ctx.strokeStyle = "rgba(120,220,240,0.55)"; ctx.lineWidth = 1; yuvarlakDikdortgen(ctx, hx - gen / 2, hy - 40, gen, 20, 6); ctx.stroke();
  ctx.fillStyle = "#cdeef7"; ctx.fillText(metin, hx, hy - 30);
  ctx.restore();
}

// Ekran-üstü HUD: beceri paneli (sol-alt), kill feed (sağ-alt), izleyici afişi + zorluk.
function cizHud(ctx, durum, view, ben) {
  const { w, h } = view;
  const t = durum.zaman;
  ctx.save();
  ctx.textBaseline = "alphabetic";

  // --- Beceri paneli (sol-alt) ---
  const px = 14, py = h - 92;
  const bw = Math.max(70, Math.min(118, Math.floor((w - 28) / 4) - 10)); // dar ekranda daralır
  const adim = bw + 10;
  const beceri = (yerX, ikon, ad, cd, maks, aktif, aktifRenk) => {
    const bh = 34;
    ctx.fillStyle = "rgba(10,16,24,0.66)"; yuvarlakDikdortgen(ctx, yerX, py, bw, bh, 7); ctx.fill();
    // cooldown dolgu
    if (cd > 0) { const oran = cd / maks; ctx.fillStyle = "rgba(255,90,70,0.20)"; yuvarlakDikdortgen(ctx, yerX, py, bw * oran, bh, 7); ctx.fill(); }
    else if (aktif > 0) { ctx.fillStyle = "rgba(90,200,255,0.22)"; yuvarlakDikdortgen(ctx, yerX, py, bw, bh, 7); ctx.fill(); }
    ctx.strokeStyle = aktif > 0 ? aktifRenk : cd > 0 ? "rgba(120,140,160,0.5)" : "rgba(120,200,230,0.8)"; ctx.lineWidth = 1.5;
    yuvarlakDikdortgen(ctx, yerX, py, bw, bh, 7); ctx.stroke();
    ctx.font = "18px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#e6ecf5"; ctx.fillText(ikon, yerX + 8, py + 23);
    ctx.font = "11px system-ui"; ctx.fillStyle = "rgba(200,215,230,0.9)"; ctx.fillText(ad, yerX + 32, py + 15);
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = cd > 0 ? "rgba(255,150,120,0.95)" : aktif > 0 ? aktifRenk : "rgba(120,230,160,0.95)";
    ctx.fillText(cd > 0 ? cd.toFixed(1) + "s" : aktif > 0 ? "AKTİF " + aktif.toFixed(1) : "HAZIR", yerX + 32, py + 28);
  };
  beceri(px, "⚔", "Kılıç (J)", ben._sopaCd || 0, SOPA_BEKLEME, 0, "#9ae8ff");
  beceri(px + adim, "💨", "Atılım (⇧)", ben._dashCd || 0, DASH_BEKLEME, ben._dash > 0 ? ben._dash : 0, "#bfe0ff");
  beceri(px + adim * 2, "🛡", "Kalkan (K)", ben._kalkanCd || 0, 8, ben.kalkan || 0, "#5ac8ff");
  beceri(px + adim * 3, "🚪", "Kapı (Q)", ben._kapiCd || 0, 3, 0, "#8ad6ff");

  // Sayaçlar: hurdaya çıkardığın droneler + ele geçirdiğin + veri çipleri
  ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,180,90,0.95)";
  ctx.fillText(`💥 ${ben.hurda || 0}`, px, py - 8);
  ctx.fillStyle = "rgba(120,240,255,0.95)";
  ctx.fillText(`💾 ${ben.hack || 0}`, px + 58, py - 8);
  ctx.fillStyle = "rgba(120,255,190,0.95)";
  ctx.fillText(`💿 ${ben.cip || 0}/${(durum.cipler || []).length}`, px + 116, py - 8);

  // Hack ilerleme çubuğu (basılı tutarken)
  if (ben._hackIlerleme > 0) {
    const cw = Math.min(220, w - 28);
    ctx.fillStyle = "rgba(10,16,24,0.75)"; yuvarlakDikdortgen(ctx, px, py - 30, cw, 8, 4); ctx.fill();
    ctx.fillStyle = "rgba(110,240,255,0.95)";
    yuvarlakDikdortgen(ctx, px, py - 30, cw * Math.min(1, ben._hackIlerleme / HACK_SURE), 8, 4); ctx.fill();
  }

  // --- Kill feed / olay akışı (sağ-üst; sağ-alt mobilde dokunmatik butonlara ait) ---
  ctx.textAlign = "right"; ctx.font = "12px system-ui";
  let ky = 68;
  for (const o of durum.akis) {
    const yas = t - o.zaman;
    const al = Math.max(0, 1 - yas / 6);
    if (al <= 0) continue;
    ctx.fillStyle = `rgba(220,230,245,${al})`;
    ctx.fillText(o.metin, w - 14, ky);
    ky += 18;
  }

  // --- Sanal joystick görseli (dokunmatik sürüklerken) ---
  if (durum.jsGorsel) {
    const { mx, my, nx, ny } = durum.jsGorsel;
    const dx = nx - mx, dy = ny - my, uz = Math.hypot(dx, dy) || 1;
    const g = Math.min(uz, 60);
    ctx.save();
    ctx.strokeStyle = "rgba(140,200,230,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(140,200,230,0.45)";
    ctx.beginPath(); ctx.arc(mx + (dx / uz) * g, my + (dy / uz) * g, 18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- Konum (üst-sol) ---
  const izl = durum.oyuncular.find((s) => s.id === durum.izlenenId) || ben;
  const oda = odaAdi(durum.harita, izl.x, izl.y) || "Koridor";
  ctx.textAlign = "left"; ctx.font = "bold 12px system-ui";
  ctx.fillStyle = "rgba(170,210,235,0.85)";
  ctx.fillText("📍 " + oda, 14, 20);

  // --- Zorluk kademesi + süre (üst-orta) ---
  const sn = Math.floor(durum.zaman);
  const sure = Math.floor(sn / 60) + ":" + String(sn % 60).padStart(2, "0");
  ctx.textAlign = "center"; ctx.font = "bold 12px system-ui";
  ctx.fillStyle = "rgba(255,180,90,0.85)";
  ctx.fillText("⚡ Kademe " + durum.zorluk + "  ·  ⏱ " + sure, w / 2, 20);

  // --- Round başı hedef yazısı (ilk saniyeler, sönümlenir) ---
  if (durum.zaman < 6 && !durum.bitti) {
    const al = durum.zaman < 4.4 ? 1 : (6 - durum.zaman) / 1.6;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(140,255,180,${al})`;
    ctx.font = "bold 26px system-ui";
    ctx.shadowColor = "rgba(70,240,130,0.6)"; ctx.shadowBlur = 14;
    ctx.fillText("PANELİ HACKLE — ÇIKIŞI AÇ", w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.font = "13px system-ui";
    ctx.fillStyle = `rgba(200,220,240,${al * 0.9})`;
    ctx.fillText("🔒 Çıkışlar kilitli: paneli E ile hackle · ⚔ droneleri savur (J) · 💨 atıl (Shift) · çıkışta bekleyerek kaç", w / 2, h * 0.3 + 26);
  }

  // --- İzleyici afişi ---
  if (durum.izleyici && !durum.bitti) {
    ctx.fillStyle = "rgba(210,60,60,0.9)"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center";
    ctx.fillText("👁 İZLEYİCİ MODU — diğerlerini izliyorsun", w / 2, 44);
    const izl = durum.oyuncular.find((s) => s.id === durum.izlenenId);
    if (izl) { ctx.font = "12px system-ui"; ctx.fillStyle = "rgba(200,215,230,0.85)"; ctx.fillText("İzlenen: " + izl.ad, w / 2, 62); }
  }
  ctx.restore();
}

function yuvarlakDikdortgen(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Oda içi mobilya/detaylar (top-down, temaya göre). Işıkta zengin görünür.
// Zemin mobilyası engeller'den (cizEngel) çizilir — burada yalnızca duvar detayı.
function mobilyaCiz(ctx, a, s2, t) {
  const ad = a.ad || "";

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
}

// Çarpışan mobilya (engel) çizimi — dünya koordinatında, tipe göre.
function cizEngel(ctx, e, t) {
  const { x, y, w, h, tip } = e;
  const R = (fx, fy, fw, fh, f, s) => { ctx.fillStyle = f; ctx.fillRect(fx, fy, fw, fh); if (s) { ctx.strokeStyle = s; ctx.lineWidth = 1; ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1); } };
  switch (tip) {
    case "masa":
      R(x, y, w, h, "#48607c", "#0f1620");
      R(x + w * 0.15, y + 4, w * 0.5, h * 0.4, "rgba(100,220,245,0.85)", "#0a2630"); // monitör
      break;
    case "masa_buyuk":
      R(x, y, w, h, "#516684", "#141c26");
      R(x + 6, y + 6, w - 12, h - 12, "rgba(255,255,255,0.05)");
      break;
    case "raf": // sunucu rafı
      R(x, y, w, h, "#27394c", "#0a0f14");
      for (let ly = y + 8; ly < y + h - 8; ly += 13) {
        ctx.fillStyle = Math.sin(t * 6 + ly + x) > 0 ? "#5fe0a0" : "#1e5a3a"; ctx.fillRect(x + 5, ly, 3, 3);
        ctx.fillStyle = Math.sin(t * 4 + ly) > 0 ? "#ffb14a" : "#5a3a12"; ctx.fillRect(x + w - 9, ly, 3, 3);
      }
      break;
    case "raf_kutu": // arşiv rafı + kutular
      R(x, y, w, h, "#5a4f31", "#1c1810");
      { const renk = ["#7a5a3a", "#5a6a8a", "#7a4a4a", "#4a7a5a"]; let k = 0;
        for (let bx = x + 6; bx < x + w - 34; bx += 40) { R(bx, y - 16, 34, 16, renk[k % 4], "#1a1410"); k++; } }
      break;
    case "kanepe":
      R(x, y, w, h, "#5d4d8a", "#1c1830");
      R(x + 4, y - 8, w - 8, 12, "#5a4d80", "#1c1830");
      break;
    case "sehpa":
      R(x, y, w, h, "#48607c", "#141c26");
      break;
    case "tezgah":
      R(x, y, w, h, "#48607c", "#141c26");
      ctx.fillStyle = "#2a3644"; ctx.beginPath(); ctx.arc(x + w * 0.3, y + h / 2, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h / 2, 5, 0, 7); ctx.fill();
      break;
    case "buzdolabi":
      R(x, y, w, h, "#5a6472", "#141c26");
      R(x + w - 6, y + 8, 3, 18, "#c9d4e0");
      break;
    case "duvar": // oda duvarı — koyu gövde + iç kenarda ince neon şerit
      R(x, y, w, h, "#1a232e", "#080d13");
      ctx.fillStyle = "rgba(90,190,215,0.10)";
      if (w >= h) ctx.fillRect(x, y + h - 2, w, 2); else ctx.fillRect(x + w - 2, y, 2, h);
      break;
    case "masa_yuvarlak": { // kafeterya yuvarlak masası + sandalyeler
      const mx = x + w / 2, my = y + h / 2, r0 = Math.min(w, h) / 2;
      ctx.fillStyle = "#4a4436"; ctx.beginPath(); ctx.arc(mx, my, r0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#171310"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#5a5443"; ctx.beginPath(); ctx.arc(mx, my, r0 * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a3644";
      for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.arc(mx + Math.cos(a0) * (r0 + 9), my + Math.sin(a0) * (r0 + 9), 6, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "kutu_blok": { // depo palet yığını (renkli kutu istifi)
      R(x, y, w, h, "#3f382a", "#15110c");
      const renk = ["#7a5a3a", "#5a6a8a", "#7a4a4a", "#4a7a5a"];
      let k = 0;
      for (let by = y + 4; by < y + h - 16; by += 20)
        for (let bx = x + 4; bx < x + w - 26; bx += 30) { R(bx, by, 26, 16, renk[k % 4], "#1a1410"); k++; }
      break;
    }
    case "monitor_duvari": // güvenlik ekran duvarı (yanıp sönen ekran ızgarası)
      R(x, y, w, h, "#131b24", "#05090e");
      for (let mx0 = x + 4; mx0 < x + w - 22; mx0 += 26) {
        const canli = Math.sin(t * 3 + mx0) > -0.3;
        R(mx0, y + 5, 22, h - 10, canli ? "rgba(90,200,240,0.75)" : "rgba(30,55,70,0.8)", "#0a1620");
      }
      break;
    case "lab_tezgah": // laboratuvar tezgahı + numune LED'leri
      R(x, y, w, h, "#2c3a42", "#0d1418");
      R(x + 4, y + 4, w - 8, 6, "rgba(180,220,235,0.16)");
      for (let lx = x + 14; lx < x + w - 10; lx += 34) {
        ctx.fillStyle = Math.sin(t * 5 + lx) > 0 ? "#5fe0c0" : "#2a6a58";
        ctx.fillRect(lx, y + h - 10, 4, 4);
      }
      break;
    case "bank":
      R(x, y, w, h, "#48607c", "#141c26");
      R(x + 3, y + 3, w - 6, 4, "rgba(255,255,255,0.06)");
      break;
    case "bolme": // açık ofis bölme paneli
      R(x, y, w, h, "#405064", "#141c26");
      break;
    case "bitki_adasi": { // atrium yeşil ada (büyük bitki kümesi)
      const mx = x + w / 2, my = y + h / 2, r0 = Math.min(w, h) / 2;
      ctx.fillStyle = "#233527"; ctx.beginPath(); ctx.arc(mx, my, r0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#101a12"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#2f7b42";
      for (let k = 0; k < 6; k++) { const a0 = k * Math.PI / 3 + 0.5; ctx.beginPath(); ctx.arc(mx + Math.cos(a0) * r0 * 0.45, my + Math.sin(a0) * r0 * 0.45, r0 * 0.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#3f9b54"; ctx.beginPath(); ctx.arc(mx, my, r0 * 0.32, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default:
      R(x, y, w, h, "#3a3320", "#1c1810");
  }
}

// Kapı geçidi: belirgin eşik + parlak söveler. Kapalıyken perde ekran uzayında çizilir.
function cizKapiEsigi(ctx, k) {
  ctx.fillStyle = k.kapali ? "rgba(70,140,170,0.35)" : "rgba(70,130,160,0.28)";
  ctx.fillRect(k.x, k.y, k.w, k.h);
  const s = 8;
  ctx.fillStyle = "#3b5068";                       // söveler (açık ton — duvardan ayrışır)
  if (k.yatay) { ctx.fillRect(k.x - s, k.y - 2, s, k.h + 4); ctx.fillRect(k.x + k.w, k.y - 2, s, k.h + 4); }
  else { ctx.fillRect(k.x - 2, k.y - s, k.w + 4, s); ctx.fillRect(k.x - 2, k.y + k.h, k.w + 4, s); }
  // eşik ışık şeridi (kapı yerini net belli eder)
  ctx.fillStyle = k.kapali ? "rgba(255,150,90,0.6)" : "rgba(130,225,245,0.5)";
  if (k.yatay) ctx.fillRect(k.x, k.y + k.h / 2 - 1.5, k.w, 3);
  else ctx.fillRect(k.x + k.w / 2 - 1.5, k.y, 3, k.h);
}

// Her odaya ortak duvar detayları: dolap, kitaplık, beyaz tahta, saat, bitki, halı, çöp kovası.
function duvarDetay(ctx, a, s2, t) {
  const R = (wx, wy, ww, hh, f, s) => { const [x, y] = s2(wx, wy); ctx.fillStyle = f; ctx.fillRect(x, y, ww, hh); if (s) { ctx.strokeStyle = s; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1); } };
  const daire = (wx, wy, rr, f) => { const [x, y] = s2(wx, wy); ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); };

  // Zemin halısı — tip renginde (odaya kimlik katar)
  const [cx, cy] = s2(a.x + a.w / 2, a.y + a.h / 2);
  const hali = KENAR[a.tip] || "70,100,130";
  ctx.fillStyle = `rgba(${hali},0.10)`;
  ctx.fillRect(cx - a.w * 0.3, cy - a.h * 0.22, a.w * 0.6, a.h * 0.44);
  ctx.strokeStyle = `rgba(${hali},0.18)`; ctx.lineWidth = 1;
  ctx.strokeRect(cx - a.w * 0.3, cy - a.h * 0.22, a.w * 0.6, a.h * 0.44);

  // Duvar payı: dekorlar oda duvarının iç yüzüne yaslanır (duvarın altında kalmasın).
  const D = KAPI_KALINLIK + 1;

  // Üst duvar: dolap (kapaklı)
  R(a.x + 20, a.y + D, a.w * 0.3, 22, "#405064", "#141c26");
  for (let i = 0; i < 3; i++) R(a.x + 26 + i * (a.w * 0.3 / 3), a.y + D + 3, a.w * 0.3 / 3 - 5, 16, "#48607c");
  // Üst duvar sağ: kitaplık (renkli kitap sırtları)
  kitaplik(ctx, s2, a.x + a.w * 0.58, a.y + D, a.w * 0.34, 22);

  // Sol duvar: beyaz tahta
  R(a.x + D, a.y + a.h * 0.4, 15, a.h * 0.26, "#dfe7ef", "#3a4658");
  // Sağ duvar: dosya dolabı (çekmeceli)
  R(a.x + a.w - 15 - D, a.y + a.h * 0.38, 15, a.h * 0.3, "#4a5666", "#141c26");
  for (let dy = a.y + a.h * 0.4; dy < a.y + a.h * 0.66; dy += 22) { const [x, y] = s2(a.x + a.w - 13 - D, dy); ctx.strokeStyle = "#141c26"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y); ctx.stroke(); }

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

// İnsan görünümlü top-down figür: ayak/kol yürüme animasyonu (s._yuru fazı),
// isimden türeyen saç/ten/ceket çeşitliliği, elde beyzbol sopası (+savurma).
function adHash(ad) { let h = 0; for (let i = 0; i < (ad || "?").length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0; return h; }
const SACLAR = ["#241a12", "#3d2a17", "#101014", "#5a4020", "#6e5a2f", "#7a2e1c"];
const TENLER = ["#e8b98a", "#d9a06e", "#c68a5a", "#f0c9a0"];
const CEKETLER = ["#31556b", "#5a3d68", "#2f6b50", "#6b3a3a", "#57604f", "#3d4e75"];

function cizKisi(ctx, x, y, s, aksan, t, sen) {
  const r = OYUNCU_YARICAP * (sen ? 1.2 : 1.05);
  const aci = s.aci ?? -Math.PI / 2;
  const hsh = adHash(s.ad);
  const sac = SACLAR[hsh % SACLAR.length];
  const ten = TENLER[(hsh >> 3) % TENLER.length];
  const ceket = sen ? "#8a6d26" : CEKETLER[(hsh >> 5) % CEKETLER.length];
  const adim = Math.sin((s._yuru || 0) * 0.11);          // yürüme fazı (-1..1)

  ctx.save();
  ctx.translate(x, y);
  // yer gölgesi
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 1.05, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(aci + Math.PI / 2);                          // ileri = -y

  // ayaklar (ileri-geri adım)
  ctx.fillStyle = "#181f28";
  ctx.beginPath(); ctx.ellipse(-r * 0.32, -adim * r * 0.5, r * 0.2, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.32, adim * r * 0.5, r * 0.2, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();

  // enerji kılıcı: sağ elde — koyu kabza + ışıyan camgöbeği bıçak.
  // Savururken kabzadan geniş yay çizer (kesme izi ayrıca ekranda çizilir).
  const savurma = s._sopaFlash > 0 ? ((1 - s._sopaFlash / SOPA_SAVURMA) * 2.6 - 1.3) * (s._savurmaYon || 1) : 0.55;
  ctx.save();
  ctx.translate(r * 0.85, -adim * r * 0.4);
  ctx.rotate(savurma - Math.PI / 2);
  ctx.strokeStyle = "#2a3340"; ctx.lineWidth = 5; ctx.lineCap = "round";       // kabza
  ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(0, -r * 0.35); ctx.stroke();
  ctx.strokeStyle = s._sopaFlash > 0 ? "#eaffff" : "#8ae4ff";                  // bıçak
  ctx.lineWidth = 3.5;
  ctx.shadowColor = "rgba(120,225,255,0.95)"; ctx.shadowBlur = s._sopaFlash > 0 ? 14 : 8;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.35); ctx.lineTo(0, -r * 1.9); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, -r * 1.8); ctx.stroke(); // öz çizgisi
  ctx.restore();

  // kollar (adımın tersi salınım) + ten rengi eller
  ctx.fillStyle = ceket;
  ctx.beginPath(); ctx.ellipse(-r * 0.88, adim * r * 0.4, r * 0.24, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.88, -adim * r * 0.4, r * 0.24, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ten;
  ctx.beginPath(); ctx.arc(-r * 0.88, adim * r * 0.4 - r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.88, -adim * r * 0.4 - r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.fill();

  // gövde (ceket) + omuz vurgusu
  ctx.fillStyle = ceket;
  ctx.strokeStyle = "rgba(6,10,16,0.9)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.ellipse(0, -r * 0.16, r * 0.62, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  // kimlik aksanı: omuz şeridi (sen: parlak sarı)
  ctx.strokeStyle = aksan; ctx.lineWidth = sen ? 3 : 2;
  if (sen) { ctx.shadowColor = aksan; ctx.shadowBlur = 7; }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.shadowBlur = 0;

  // baş: saç (arkada dolgun) + öne bakan yüz
  ctx.fillStyle = sac;
  ctx.beginPath(); ctx.arc(0, -r * 0.06, r * 0.46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(6,10,16,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = ten;
  ctx.beginPath(); ctx.arc(0, -r * 0.24, r * 0.26, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  if (s.yakalandi) { ctx.fillStyle = "rgba(255,90,90,0.95)"; ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.fillText("✖", x, y - r - 6); }
}

// Detaylı drone: gövde + 4 rotor (1.5x — belirgin tehdit). Sersemken ölü/kıvılcımlı.
// Tipler: "agir" (daha büyük, zırhlı, turuncu), "sessiz" (koyu mor, sönük göz).
// Kırmızı tarama konisi ayrı geçişte, karanlığın ÜSTÜNDE çizilir (kendi ışığı).
function cizDrone(ctx, x, y, aci, kovala, t, sersem, tip) {
  const olcek = tip === "agir" ? 1.9 : 1.5;
  ctx.save();
  ctx.translate(x, y);
  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, 16, 24 * (olcek / 1.5), 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.scale(olcek, olcek);
  if (sersem) {
    // EMP arkı (rastgele sarı yaylar) + sarsıntı
    ctx.translate(Math.sin(t * 40) * 1.6, Math.cos(t * 33) * 1.6);
    ctx.strokeStyle = `rgba(255,225,120,${0.5 + 0.4 * Math.sin(t * 22)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 16, t * 9, t * 9 + 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 20, t * -7, t * -7 + 1.1); ctx.stroke();
  }
  ctx.rotate(aci);
  const ana = sersem ? "#4a4a52"
    : kovala ? "#c83a3a"
    : tip === "agir" ? "#a06a2c"
    : tip === "sessiz" ? "#3c3350"
    : "#5a6f88";
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
  // tarama gözü (ileri) — sersemken söner; sessiz drone'da soluk mor (ışıksız avcı);
  // diğerlerinde kırmızı nokta yanıp söner (tehdit sinyali)
  ctx.fillStyle = sersem ? "#2a2a30"
    : tip === "sessiz" ? `rgba(150,110,220,${0.25 + 0.15 * Math.sin(t * 2)})`
    : kovala ? "#ff5a5a" : `rgba(255,80,70,${0.6 + 0.4 * Math.sin(t * 6)})`;
  ctx.beginPath(); ctx.arc(5, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  // ağır drone: çift ışın yuvası (geniş taramanın görsel karşılığı)
  if (tip === "agir" && !sersem) {
    ctx.fillStyle = kovala ? "#ff5a5a" : `rgba(255,120,60,${0.5 + 0.4 * Math.sin(t * 5)})`;
    ctx.beginPath(); ctx.arc(3.5, -4.5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.5, 4.5, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
