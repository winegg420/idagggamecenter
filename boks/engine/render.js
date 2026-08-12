// ============================================================
// GÖLGE BOKS — çizim (canvas) · görsel kimlik "Gece Antrenmanı"
//
// Alt katman: canlı ön kamera (aynalı, cover) + sıcak is-siyahı tonlama ve
// vinyet → spor salonu gece seansı hissi. Üstünde: sanal antrenör pedleri,
// bilek nişanı, darbe halkası, savunma tehditleri, gard göstergesi,
// nefes ritmi ve tempo karşılaştırma şeridi.
//
// PERFORMANS (Meyve Kes'te bedeli ödenmiş dersler):
//  - `shadowBlur` YOK (kare başına ayrı blur geçişi = mobilde ölçülebilir yük);
//    parıltı yerine additif halka/katman kullanılır.
//  - Parçacıklar tek geçişte çizilir (parçacık başına save/restore yok).
//  - `kalite` katsayısı düşünce (zayıf cihaz) pahalı katmanlar kapanır.
// ============================================================

export const RENK = {
  arka: "#14100f",
  yuzey: "#1c1816",
  darbe: "#ff4d3d",
  analiz: "#2dd4ff",
  odul: "#d9a441",
  metin: "#f5efe8",
  dim: "#9c9189",
};

// Ön kamera görüntüsünü cover + ayna ile ekrana taşıyan koordinat eşleyici.
// (Meyve Kes'teki eşleyicinin izole kopyası — modüller birbirinden import etmez.)
export function koordinatHesap(video, W, H) {
  const vw = video?.videoWidth || 640;
  const vh = video?.videoHeight || 360;
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
    esle(nx, ny) {
      const px = ox + nx * vw * s;
      const py = oy + ny * vh * s;
      return { x: W - px, y: py }; // aynalı (selfie)
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

// Gece antrenmanı atmosferi: sıcak koyu tonlama + köşe vinyeti.
// Vinyet gradyanı her karede yeniden üretilmez (ölçü değişmedikçe önbellekte).
// PERFORMANS: tam ekran gradyan dolgusu mobilde ölçülebilir yük — vinyet ancak
// cihaz hiç zorlanmıyorsa (kalite ~1) çizilir. Karartma da hafifletildi:
// oyuncunun kendini net görmesi, atmosferden daha önemli.
let _vinyet = null;
let _vinyetW = 0;
let _vinyetH = 0;
function atmosferCiz(ctx, W, H, kalite) {
  ctx.fillStyle = "rgba(20,16,15,0.3)";
  ctx.fillRect(0, 0, W, H);
  if (kalite < 0.95) return;
  if (!_vinyet || _vinyetW !== W || _vinyetH !== H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    _vinyet = g;
    _vinyetW = W;
    _vinyetH = H;
  }
  ctx.fillStyle = _vinyet;
  ctx.fillRect(0, 0, W, H);
}

// ---------------- pedler ----------------
const TUR_IKON = { duz: "→", hook: "↷", uppercut: "↑" };

function padCiz(ctx, pad, t, kalite) {
  const giris = Math.min(1, pad.t / 0.16); // belirirken küçükten büyüğe
  const kalanOran = Math.max(0, 1 - pad.t / pad.omur);
  const titre = pad.titre > 0 ? Math.sin(t * 60) * pad.titre * 10 : 0;
  const r = pad.r * (0.6 + 0.4 * giris) * (1 + 0.04 * Math.sin(t * 6));
  const x = pad.x + titre;
  const y = pad.y;

  ctx.save();
  // dış hale (additif) — pad'in "parlayan" hissi
  if (kalite > 0.7) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = pad.sirali ? "rgba(45,212,255,0.16)" : "rgba(255,77,61,0.14)";
    ctx.beginPath();
    ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // mitt gövdesi
  ctx.fillStyle = "rgba(28,24,22,0.92)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // kalan süre yayı (dış çember) — okunabilir zaman baskısı
  ctx.strokeStyle = pad.sirali ? RENK.analiz : RENK.darbe;
  ctx.lineWidth = Math.max(3, r * 0.13);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kalanOran);
  ctx.stroke();

  // iç halka
  ctx.strokeStyle = "rgba(245,239,232,0.22)";
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // büyük numara
  ctx.fillStyle = pad.titre > 0 ? RENK.odul : RENK.metin;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(r * 1.15)}px 'Bebas Neue', Impact, 'Arial Narrow', system-ui, sans-serif`;
  ctx.fillText(String(pad.no), x, y + r * 0.04);

  // tür ikonu (küçük, alt tarafta)
  ctx.font = `700 ${Math.round(r * 0.42)}px system-ui, sans-serif`;
  ctx.fillStyle = RENK.dim;
  ctx.fillText(TUR_IKON[pad.tur] || "", x, y + r * 0.62);
  ctx.restore();
}

// ---------------- imza efekt: DARBE HALKASI ----------------
// Halkanın rengi ve genişliği vuruş şiddetine göre kırmızıdan camgöbeğine kayar:
// oyun tatmini (görsel efekt) ile analiz verisi (görece vuruş yoğunluğu) aynı
// görselde birleşir — oyuncu ne kadar sert vurduğunu efektten okur.
function siddetRenk(siddet, alfa) {
  const k = Math.max(0, Math.min(1, siddet / 100));
  // #ff4d3d → #2dd4ff
  const r = Math.round(255 + (45 - 255) * k);
  const g = Math.round(77 + (212 - 77) * k);
  const b = Math.round(61 + (255 - 61) * k);
  return `rgba(${r},${g},${b},${alfa})`;
}

function halkaCiz(ctx, e) {
  const p = e.t / e.omur;
  const alfa = Math.max(0, 1 - p);
  const genislik = 3 + (e.siddet / 100) * 9;
  const r = (e.r0 || 30) * (1 + p * 2.6);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = siddetRenk(e.siddet, alfa * 0.9);
  ctx.lineWidth = genislik * (1 - p * 0.6);
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // ikinci, daha hızlı yayılan ince halka (şok dalgası)
  ctx.strokeStyle = siddetRenk(e.siddet, alfa * 0.4);
  ctx.lineWidth = Math.max(1, genislik * 0.35);
  ctx.beginPath();
  ctx.arc(e.x, e.y, r * 1.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function patlamaCiz(ctx, e, kalite) {
  if (kalite < 0.6) return;
  const p = e.t / e.omur;
  const alfa = Math.max(0, 1 - p);
  const adet = 10;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = siddetRenk(e.siddet, alfa * 0.85);
  for (let i = 0; i < adet; i++) {
    const a = (i / adet) * Math.PI * 2 + e.x * 0.01;
    const d = (e.r0 || 26) * (0.6 + p * 3.2);
    const rr = 5 * (1 - p);
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, Math.max(0.5, rr), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function kacisCiz(ctx, e, renk) {
  const p = e.t / e.omur;
  const alfa = Math.max(0, 1 - p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = renk.replace("ALFA", String(alfa));
  ctx.lineWidth = 4 * (1 - p);
  ctx.beginPath();
  ctx.arc(e.x, e.y, 30 + p * (e.hiz || 60), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------- savunma tehditleri ----------------
function tehditCiz(ctx, th, t) {
  const p = Math.min(1, th.t / th.telegraph);
  const x = th.bx + (th.hx - th.bx) * p * p; // hızlanarak gelir
  const y = th.by + (th.hy - th.by) * p * p;
  const r = th.r * (0.45 + 0.75 * p);

  ctx.save();
  // hedef bölgesi (kaçılması gereken alan)
  if (!th.cozuldu) {
    ctx.strokeStyle = `rgba(255,77,61,${0.25 + 0.45 * p})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(th.hx, th.hy, th.r * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // gelen yumruk (rakip eldiveni)
  ctx.globalAlpha = th.cozuldu ? Math.max(0, 1 - (th.t - th.telegraph) / 0.35) : 0.92;
  ctx.fillStyle = "#2a1f1c";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = RENK.darbe;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  // hız çizgileri (geliş yönü)
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = "rgba(255,77,61,0.8)";
  ctx.lineWidth = 2;
  const ax = Math.atan2(th.hy - th.by, th.hx - th.bx);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ax) * r * 1.3 + Math.sin(ax) * i * r * 0.5, y - Math.sin(ax) * r * 1.3 - Math.cos(ax) * i * r * 0.5);
    ctx.lineTo(x - Math.cos(ax) * r * 2.4 + Math.sin(ax) * i * r * 0.5, y - Math.sin(ax) * r * 2.4 - Math.cos(ax) * i * r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- gard göstergesi ----------------
// Kafanın çevresindeki "gard bölgesi" ve her elin gard durumu. Gerçek zamanlı
// düşük gard algısı burada görünür hâle gelir (analiz rengi = camgöbeği).
function gardCiz(ctx, tanima, kalite) {
  const kafa = tanima.kafa;
  const birim = tanima.birim;
  if (!kafa || !(birim > 0)) return;
  const acik = tanima.kollar.sol.gardDusuk || tanima.kollar.sag.gardDusuk;
  ctx.save();
  ctx.strokeStyle = acik ? "rgba(255,77,61,0.5)" : "rgba(45,212,255,0.32)";
  ctx.lineWidth = 2;
  ctx.setLineDash(acik ? [6, 6] : [2, 8]);
  ctx.beginPath();
  ctx.arc(kafa.x, kafa.y, birim * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (acik && kalite > 0.6) {
    ctx.fillStyle = "rgba(255,77,61,0.9)";
    ctx.textAlign = "center";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText("GARD DÜŞÜK", kafa.x, kafa.y - birim * 0.78);
  }
  ctx.restore();
}

// Kol zinciri (omuz-dirsek-bilek) + BİLEK NİŞANI.
//
// Eski AR eldiven overlay'i kaldırıldı (oyuncuyu boğuyordu ve kare başına
// onlarca ellipse/stroke yükü getiriyordu). Yerine gelen nişan: her bileğin
// üzerinde ince bir halka; kol "itme" fazındayken (yumruk yolda) halka dolar ve
// darbe rengine döner. Oyuncu sistemin elini gördüğünü ve yumruğun sayıldığını
// anında okur — toplam maliyet kare başına 4 arc.
const ISKELET_CIFT = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
];

function iskeletCiz(ctx, poz, tanima) {
  if (!poz || !poz.n) return;
  const n = poz.n;
  ctx.save();
  ctx.strokeStyle = "rgba(45,212,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of ISKELET_CIFT) {
    const p1 = n[a];
    const p2 = n[b];
    if (!p1 || !p2 || p1.g < 0.55 || p2.g < 0.55) continue;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke(); // tek geçiş: kol zincirinin tamamı

  const birim = tanima?.birim || 0;
  if (birim > 0) {
    const r = birim * 0.17;
    for (const [idx, taraf] of [[15, "sol"], [16, "sag"]]) {
      const p = n[idx];
      if (!p || p.g < 0.55) continue;
      const kol = tanima.kollar?.[taraf];
      const atiyor = kol && (kol.faz === "itme" || kol.faz === "toparla");
      ctx.strokeStyle = atiyor ? "rgba(255,77,61,0.9)" : "rgba(245,239,232,0.4)";
      ctx.lineWidth = atiyor ? 4 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, atiyor ? r * 1.25 : r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- HUD üstü göstergeler ----------------
// Nefes/tempo ritmi: yavaş nefes alma ipucu (vuruşla nefes senkronu).
function nefesCiz(ctx, oyun, W, H) {
  const g = oyun.nefes;
  const y = H - 26;
  const gen = Math.min(W * 0.42, 260);
  const x = (W - gen) / 2;
  ctx.save();
  ctx.fillStyle = "rgba(28,24,22,0.55)";
  ctx.fillRect(x, y - 6, gen, 12);
  ctx.fillStyle = g > 0.5 ? RENK.analiz : RENK.dim;
  ctx.fillRect(x, y - 6, gen * g, 12);
  ctx.fillStyle = RENK.dim;
  ctx.textAlign = "center";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText(g > 0.5 ? "NEFES AL" : "VER", W / 2, y - 14);
  ctx.restore();
}

// Kendi geçmişine karşı canlı tempo göstergesi (kariyer verisiyle beslenir).
function tempoCiz(ctx, oyun, W) {
  if (!oyun.hedefTempo) return;
  const x = W - 118;
  const y = 96;
  const gen = 100;
  const oran = Math.max(0, Math.min(1.6, oyun.tempoAnlik / oyun.hedefTempo));
  ctx.save();
  ctx.fillStyle = "rgba(28,24,22,0.6)";
  ctx.fillRect(x, y, gen, 8);
  ctx.fillStyle = oran >= 1 ? RENK.odul : RENK.analiz;
  ctx.fillRect(x, y, Math.min(gen, (gen * oran) / 1.6), 8);
  // geçen seferki tempo çizgisi (referans)
  ctx.fillStyle = RENK.metin;
  ctx.fillRect(x + gen / 1.6 - 1, y - 3, 2, 14);
  ctx.fillStyle = RENK.dim;
  ctx.textAlign = "right";
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.fillText(`TEMPO ${oyun.tempoAnlik}/dk`, x + gen, y - 6);
  ctx.restore();
}

function popupCiz(ctx, pp) {
  const alfa = Math.max(0, 1 - pp.t / pp.omur);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = pp.renk;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${pp.buyuk ? 34 : 24}px 'Bebas Neue', Impact, system-ui, sans-serif`;
  ctx.strokeText(pp.metin, pp.x, pp.y);
  ctx.fillText(pp.metin, pp.x, pp.y);
  ctx.restore();
}

/**
 * Ana çizim.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./oyun.js').Oyun} oyun
 * @param {HTMLVideoElement} video
 * @param {object} k koordinatHesap çıktısı
 * @param {object} ayar { kalite, iskelet }
 */
export function ciz(ctx, oyun, video, k, W, H, ayar = {}) {
  const kalite = ayar.kalite == null ? 1 : ayar.kalite;
  ctx.clearRect(0, 0, W, H);

  const sar = oyun.sarsinti || 0;
  const kaydi = sar > 0.2;
  if (kaydi) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * sar, (Math.random() - 0.5) * sar);
  }

  videoCiz(ctx, video, k, W);
  atmosferCiz(ctx, W, H, kalite);

  if (ayar.iskelet !== false) iskeletCiz(ctx, oyun.poz, oyun.tanima);
  gardCiz(ctx, oyun.tanima, kalite);

  // savunma tehditleri pedlerin altında (pedler savunmada zaten yok)
  for (const th of oyun.tehditler) tehditCiz(ctx, th, oyun._t);
  for (const pad of oyun.padler) padCiz(ctx, pad, oyun._t, kalite);

  // efektler
  for (const e of oyun.efektler) {
    if (e.tip === "halka") halkaCiz(ctx, e);
    else if (e.tip === "patlama") patlamaCiz(ctx, e, kalite);
    else if (e.tip === "kacis") kacisCiz(ctx, e, "rgba(45,212,255,ALFA)");
    else if (e.tip === "blok") kacisCiz(ctx, e, "rgba(217,164,65,ALFA)");
    else if (e.tip === "darbe") kacisCiz(ctx, e, "rgba(255,77,61,ALFA)");
  }
  for (const pp of oyun.popuplar) popupCiz(ctx, pp);

  if (oyun.faz === "round") {
    nefesCiz(ctx, oyun, W, H);
    tempoCiz(ctx, oyun, W);
  }

  if (kaydi) ctx.restore();
}
