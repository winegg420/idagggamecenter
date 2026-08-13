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

// PERFORMANS: karartma eskiden ayrı bir tam ekran `fillRect` geçişiyle
// yapılıyordu (kare başına iki tam ekran dolgusu). Tuval `alpha:false` +
// `clearRect` sonrası SİYAH olduğundan, videoyu doğrudan alfa ile çizmek
// aynı sonucu TEK geçişte verir.
const KARARTMA = 0.3;

function videoCiz(ctx, video, k, W) {
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.globalAlpha = 1 - KARARTMA;
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
  // Karartma artık video çiziminde (tek geçiş) yapılıyor — burada yalnız vinyet.
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
// Antrenör pedi: kalan süreyi gösteren ince dış yay, koyu disk, büyük numara ve
// altında yumruğun ADI. Eski sürümdeki ok işaretleri ("→ ↷ ↑") ve parlayan
// halkalar kaldırıldı — okunmuyor ve amatör duruyordu; ad hem net hem öğretici.
const PAD_AD = { 1: "JAB", 2: "CROSS", 3: "HOOK", 4: "HOOK", 5: "UPPER", 6: "UPPER" };

function harfArasi(ctx, deger) {
  try {
    ctx.letterSpacing = deger;
  } catch {
    /* eski tarayıcı — yok sayılır */
  }
}

function padCiz(ctx, pad, t, kalite) {
  const giris = Math.min(1, pad.t / 0.14);
  const kalanOran = Math.max(0, 1 - pad.t / pad.omur);
  const titre = pad.titre > 0 ? Math.sin(t * 60) * pad.titre * 8 : 0;
  const r = pad.r * (0.82 + 0.18 * giris);
  const x = pad.x + titre;
  const y = pad.y;
  const vurgu = pad.sirali ? RENK.analiz : RENK.darbe;

  ctx.save();
  ctx.globalAlpha = giris;

  // disk
  ctx.fillStyle = "rgba(18,15,14,0.78)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // sabit çember (referans) + kalan süre yayı
  ctx.strokeStyle = "rgba(245,239,232,0.14)";
  ctx.lineWidth = Math.max(2, r * 0.055);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = pad.titre > 0 ? RENK.odul : vurgu;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kalanOran);
  ctx.stroke();
  ctx.lineCap = "butt";

  // numara
  ctx.fillStyle = RENK.metin;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(r * 0.86)}px 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif`;
  ctx.fillText(String(pad.no), x, y - r * 0.08);

  // ad
  if (kalite > 0.55) {
    harfArasi(ctx, `${Math.max(1, r * 0.03).toFixed(1)}px`);
    ctx.font = `600 ${Math.round(r * 0.24)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(245,239,232,0.55)";
    ctx.fillText(PAD_AD[pad.no] || "", x, y + r * 0.42);
    harfArasi(ctx, "0px");
  }
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

// ---------------- alt bilgi şeridi ----------------
// GÖRSEL SADELEŞTİRME (2026-08-13): oyuncunun üzerine çizilen katmanların
// tamamı kaldırıldı — bileklerdeki halkalar, kol iskeleti ve kafanın etrafındaki
// kesikli "gard bölgesi" çemberi. Bunlar bir teşhis overlay'i gibi duruyordu ve
// ürünü amatör gösteriyordu. Yerine kadrajın altında tek satırlık, sakin bir
// durum şeridi var: gard uyarısı ve tempo. Oyuncunun görüntüsü artık temiz.
function seritCiz(ctx, oyun, W, H) {
  const t = oyun.tanima;
  const gardAcik = t.kollar.sol.gardDusuk || t.kollar.sag.gardDusuk;
  const y = H - 22;
  ctx.save();
  ctx.textBaseline = "middle";
  harfArasi(ctx, "1.4px");
  ctx.font = "600 11px system-ui, -apple-system, sans-serif";

  if (gardAcik) {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,77,61,0.85)";
    ctx.fillRect(22, y - 5, 3, 10);
    ctx.fillText("GARD DÜŞÜK", 32, y);
  }

  if (oyun.hedefTempo) {
    const oran = Math.max(0, Math.min(1.6, oyun.tempoAnlik / oyun.hedefTempo));
    const gen = Math.min(120, W * 0.26);
    const x = W - 22 - gen;
    ctx.fillStyle = "rgba(245,239,232,0.14)";
    ctx.fillRect(x, y - 1, gen, 2);
    ctx.fillStyle = oran >= 1 ? RENK.odul : RENK.analiz;
    ctx.fillRect(x, y - 1, Math.min(gen, (gen * oran) / 1.6), 2);
    ctx.fillStyle = "rgba(245,239,232,0.45)";
    ctx.fillRect(x + gen / 1.6 - 1, y - 4, 1, 8);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(245,239,232,0.5)";
    ctx.fillText(`${oyun.tempoAnlik}/DK`, W - 22, y - 12);
  }
  harfArasi(ctx, "0px");
  ctx.restore();
}

function popupCiz(ctx, pp) {
  const alfa = Math.max(0, 1 - pp.t / pp.omur);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = pp.renk;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Kalın siyah kontur kaldırıldı (çizgi film etkisi); okunurluk yerine ince
  // koyu bir zemin gölgesiyle sağlanıyor.
  harfArasi(ctx, pp.buyuk ? "1.5px" : "1px");
  ctx.font = `600 ${pp.buyuk ? 26 : 15}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = alfa * 0.45;
  ctx.fillStyle = "#0d0b0a";
  ctx.fillText(pp.metin, pp.x + 1, pp.y + 1.5);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = pp.renk;
  ctx.fillText(pp.metin, pp.x, pp.y);
  harfArasi(ctx, "0px");
  ctx.restore();
}

/**
 * Ana çizim.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./oyun.js').Oyun} oyun
 * @param {HTMLVideoElement} video
 * @param {object} k koordinatHesap çıktısı
 * @param {object} ayar { kalite }
 */
export function ciz(ctx, oyun, video, k, W, H, ayar = {}) {
  const kalite = ayar.kalite == null ? 1 : ayar.kalite;
  // Temizleme yerine sıcak is-siyahı zemin: aynı tek geçiş maliyeti, ama video
  // alfa ile üstüne çizilince "Gece Antrenmanı" tonu korunur.
  ctx.fillStyle = RENK.arka;
  ctx.fillRect(0, 0, W, H);

  const sar = oyun.sarsinti || 0;
  const kaydi = sar > 0.2;
  if (kaydi) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * sar, (Math.random() - 0.5) * sar);
  }

  videoCiz(ctx, video, k, W);
  atmosferCiz(ctx, W, H, kalite);

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

  if (oyun.faz === "round") seritCiz(ctx, oyun, W, H);

  if (kaydi) ctx.restore();
}
