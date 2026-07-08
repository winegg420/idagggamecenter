// ============================================================
// Arena render (Canvas 2D, kuş bakışı). Sabit kamera: tüm arenayı gösterir
// (tasarım 3.1: "biraz uzaktan", ölçeği hissettiren geniş görüş).
// Takip kamerası ve item/efekt katmanları ilerideki fazlarda eklenecek.
// ============================================================

import { ARENA_YARICAP, ARENA_MERKEZ, OYUNCU_YARICAP, KAMERA_KENAR_PAYI, CAN_MAX, ALEV_YARICAP, ALEV_SURE, KILL_STREAK_ESIK } from "../shared/denge.js";
import { cizGladyator, cizEtiket } from "./karakterCizim.js";
import { cizSprite, cizSpriteDuz, varlikVar } from "../lib/varliklar.js";

// Sabit dekor/engeller (tasarım 3.1: kırık sütun/heykel — taktik + görsel çeşitlilik).
const DEKOR = [
  { x: 260, y: -120, r: 46, tip: "sutun" },
  { x: -300, y: 180, r: 52, tip: "sutun" },
  { x: 120, y: 340, r: 40, tip: "heykel" },
  { x: -180, y: -320, r: 44, tip: "heykel" },
  { x: 420, y: 260, r: 40, tip: "sutun" },
];

// Seyirci noktaları bir kez üretilir (yüzlerce kişi hissi — tasarım 3.1).
let _seyirciler = null;
function seyircileriUret() {
  if (_seyirciler) return _seyirciler;
  const liste = [];
  const halkalar = [1.04, 1.09, 1.14];
  for (const h of halkalar) {
    const adet = Math.floor(2 * Math.PI * ARENA_YARICAP * h / 26);
    for (let i = 0; i < adet; i++) {
      const aci = (i / adet) * Math.PI * 2 + (h * 7.3);
      const ton = 150 + Math.floor(Math.random() * 60);
      liste.push({
        aci,
        r: ARENA_YARICAP * h,
        renk: `rgb(${ton - 40},${ton - 55},${ton - 70})`,
      });
    }
  }
  _seyirciler = liste;
  return liste;
}

// Kum benekleri bir kez üretilir (zemin dokusu).
let _kumBenek = null;
function kumBenekleriUret() {
  if (_kumBenek) return _kumBenek;
  const liste = [];
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * ARENA_YARICAP * 0.98;
    liste.push({
      x: Math.cos(a) * rr, y: Math.sin(a) * rr,
      b: 1 + Math.random() * 2,
      renk: Math.random() < 0.5 ? "rgba(110,85,45,0.25)" : "rgba(232,212,162,0.22)",
    });
  }
  _kumBenek = liste;
  return liste;
}

export function ciz(ctx, durum, view) {
  const { w, h } = view;
  const scale = Math.min(w, h) / (2 * ARENA_YARICAP * KAMERA_KENAR_PAYI);
  const cx = w / 2;
  const cy = h / 2;
  const s2 = (wx, wy) => [cx + (wx - ARENA_MERKEZ.x) * scale, cy + (wy - ARENA_MERKEZ.y) * scale];

  // Arka plan (tribün gerisi karanlık)
  ctx.fillStyle = "#0b0806";
  ctx.fillRect(0, 0, w, h);

  const [ax, ay] = s2(ARENA_MERKEZ.x, ARENA_MERKEZ.y);
  // Tam-arena görseli varsa (tribün+kum+duvar tek sprite) onu kullan; yoksa kod çizimi.
  const arenaSprite = cizSpriteDuz(ctx, "arena", ax, ay, ARENA_YARICAP * 2.4 * scale, ARENA_YARICAP * 2.4 * scale);
  if (!arenaSprite) {
  // Tribün — dıştan içe koyulaşan katmanlı halkalar
  for (const b of [{ r: 1.20, c: "#2c2016" }, { r: 1.13, c: "#241a12" }, { r: 1.06, c: "#1b130c" }]) {
    ctx.fillStyle = b.c;
    ctx.beginPath();
    ctx.arc(ax, ay, ARENA_YARICAP * b.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Seyirciler (yüzlerce kişi hissi)
  for (const sp of seyircileriUret()) {
    const [spx, spy] = s2(Math.cos(sp.aci) * sp.r, Math.sin(sp.aci) * sp.r);
    ctx.fillStyle = sp.renk;
    ctx.fillRect(spx - 1.5, spy - 1.5, 3, 3);
  }

  // Loca (üstte ayrıcalıklı VIP bölümü) — altın kanopi + sütunlar (tasarım 3.1)
  ctx.save();
  ctx.strokeStyle = "rgba(246,196,83,0.55)";
  ctx.lineWidth = 12 * scale + 5;
  ctx.beginPath();
  ctx.arc(ax, ay, ARENA_YARICAP * 1.1 * scale, Math.PI * 1.14, Math.PI * 1.86);
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,90,40,0.9)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * 1.14 + Math.PI * 0.72 * (i / 6);
    const [l1x, l1y] = s2(Math.cos(a) * ARENA_YARICAP * 1.04, Math.sin(a) * ARENA_YARICAP * 1.04);
    const [l2x, l2y] = s2(Math.cos(a) * ARENA_YARICAP * 1.16, Math.sin(a) * ARENA_YARICAP * 1.16);
    ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(l2x, l2y); ctx.stroke();
  }
  ctx.restore();

  // Arena zemini (kum) — sıcak, çok duraklı gradyan (ışık sol-üstten)
  const grad = ctx.createRadialGradient(ax - 40 * scale, ay - 40 * scale, 0, ax, ay, ARENA_YARICAP * scale);
  grad.addColorStop(0, "#e6c88d");
  grad.addColorStop(0.55, "#c9a460");
  grad.addColorStop(0.85, "#ac8747");
  grad.addColorStop(1, "#8d6d39");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ax, ay, ARENA_YARICAP * scale, 0, Math.PI * 2);
  ctx.fill();

  // Kum dokusu: eşmerkezli aşınma halkaları + benekler + orta dövüş lekesi
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ARENA_YARICAP * scale, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(120,90,50,0.10)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(ax, ay, ARENA_YARICAP * scale * (i / 5.5), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const bk of kumBenekleriUret()) {
    const [bkx, bky] = s2(bk.x, bk.y);
    ctx.fillStyle = bk.renk;
    ctx.fillRect(bkx, bky, bk.b, bk.b);
  }
  const scuff = ctx.createRadialGradient(ax, ay, 0, ax, ay, ARENA_YARICAP * 0.4 * scale);
  scuff.addColorStop(0, "rgba(85,60,32,0.18)");
  scuff.addColorStop(1, "rgba(85,60,32,0)");
  ctx.fillStyle = scuff;
  ctx.beginPath(); ctx.arc(ax, ay, ARENA_YARICAP * 0.4 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Arena duvarı — taş bloklar (açık/koyu dönüşümlü segmentler)
  const duvarR = ARENA_YARICAP * scale;
  const blokSay = 48;
  ctx.lineWidth = 7 * scale + 3;
  for (let i = 0; i < blokSay; i++) {
    const a0 = (i / blokSay) * Math.PI * 2;
    const a1 = ((i + 0.86) / blokSay) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? "#6a4a24" : "#513917";
    ctx.beginPath();
    ctx.arc(ax, ay, duvarR, a0, a1);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, duvarR - (4 * scale + 2), 0, Math.PI * 2);
  ctx.stroke();
  } // if (!arenaSprite)

  // Ateş Çemberi (yanan dış halka — tasarım 3.1). Oyuncuların altında çizilir.
  if (durum.atesAktif) {
    const dis = ARENA_YARICAP * scale;
    const ic = Math.max(0, durum.atesYaricap * scale);
    const flick = 0.42 + 0.12 * Math.sin(durum.zaman * 10);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, dis, 0, Math.PI * 2, false);
    ctx.arc(ax, ay, ic, 0, Math.PI * 2, true);   // iç delik (güvenli alan)
    ctx.fillStyle = `rgba(200,60,15,${flick})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,185,70,0.9)";     // parlak iç kenar
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ax, ay, ic, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Dekor/engeller (sprite: dekor_sutun / dekor_heykel; yoksa kod)
  for (const d of DEKOR) {
    const [dx, dy] = s2(d.x, d.y);
    const dr = d.r * scale;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(dx, dy + dr * 0.35, dr, dr * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    if (cizSpriteDuz(ctx, "dekor_" + d.tip, dx, dy, dr * 2.6, dr * 2.6)) continue;
    ctx.fillStyle = d.tip === "heykel" ? "#9a9284" : "#b7ad98";
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(dx - dr * 0.3, dy - dr * 0.3, dr * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const r = OYUNCU_YARICAP * scale;

  // Kalıcı kan izleri (zeminde, oyuncuların altında — tasarım 3.1)
  for (const kan of durum.kanlar || []) {
    const [kx, ky] = s2(kan.x, kan.y);
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(kan.aci || 0);
    ctx.fillStyle = "rgba(110,20,18,0.72)";
    ctx.beginPath();
    ctx.ellipse(0, 0, kan.r * scale, kan.r * 0.7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(80,12,12,0.7)";
    ctx.beginPath();
    ctx.ellipse(kan.r * 0.7 * scale, 0, kan.r * 0.35 * scale, kan.r * 0.22 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Yerdeki itemler (can / hız)
  for (const it of durum.itemler || []) {
    const [ix, iy] = s2(it.x, it.y);
    const ir = 12 * scale + 5;
    ctx.save();
    // taban disk + hafif parıltı
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(ix, iy + ir * 0.5, ir, ir * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // Sprite ikon varsa onu kullan (item_can, item_hiz, item_silah, item_kalkan, item_zirh, item_guc)
    if (cizSpriteDuz(ctx, "item_" + it.tip, ix, iy, ir * 2.4, ir * 2.4)) { ctx.restore(); continue; }
    if (it.tip === "can") {
      ctx.fillStyle = "#e8e0d0";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c0392e"; // kırmızı haç
      ctx.fillRect(ix - ir * 0.5, iy - ir * 0.18, ir, ir * 0.36);
      ctx.fillRect(ix - ir * 0.18, iy - ir * 0.5, ir * 0.36, ir);
    } else if (it.tip === "hiz") {
      ctx.fillStyle = "#173a5e";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4db1ff"; // mavi çift-şevron (hız)
      ctx.lineWidth = ir * 0.22; ctx.lineCap = "round";
      for (const o of [-ir * 0.25, ir * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(ix - ir * 0.4, iy - ir * 0.35 + o);
        ctx.lineTo(ix + ir * 0.1, iy + o);
        ctx.lineTo(ix - ir * 0.4, iy + ir * 0.35 + o);
        ctx.stroke();
      }
    } else if (it.tip === "silah") {
      ctx.fillStyle = "#2a2018";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c7ccd4"; ctx.lineWidth = ir * 0.28; ctx.lineCap = "round"; // kılıç
      ctx.beginPath(); ctx.moveTo(ix - ir * 0.4, iy + ir * 0.4); ctx.lineTo(ix + ir * 0.4, iy - ir * 0.4); ctx.stroke();
      ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = ir * 0.2;
      ctx.beginPath(); ctx.moveTo(ix - ir * 0.5, iy + ir * 0.15); ctx.lineTo(ix - ir * 0.15, iy + ir * 0.5); ctx.stroke();
    } else if (it.tip === "kalkan") {
      ctx.fillStyle = "#173a5e";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7fb0e0"; // kalkan silüeti
      ctx.beginPath();
      ctx.moveTo(ix, iy - ir * 0.55); ctx.lineTo(ix + ir * 0.45, iy - ir * 0.2);
      ctx.lineTo(ix, iy + ir * 0.55); ctx.lineTo(ix - ir * 0.45, iy - ir * 0.2);
      ctx.closePath(); ctx.fill();
    } else if (it.tip === "zirh") {
      ctx.fillStyle = "#1e3a2a";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8fdc9a"; // yeşil zırh plakası
      ctx.fillRect(ix - ir * 0.4, iy - ir * 0.45, ir * 0.8, ir * 0.9);
      ctx.fillStyle = "#1e3a2a";
      ctx.fillRect(ix - ir * 0.12, iy - ir * 0.45, ir * 0.24, ir * 0.9);
    } else if (it.tip === "guc") {
      ctx.fillStyle = "#3a2a10";
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffc040"; // turuncu yıldırım
      ctx.beginPath();
      ctx.moveTo(ix + ir * 0.15, iy - ir * 0.5); ctx.lineTo(ix - ir * 0.35, iy + ir * 0.05);
      ctx.lineTo(ix - ir * 0.02, iy + ir * 0.05); ctx.lineTo(ix - ir * 0.15, iy + ir * 0.5);
      ctx.lineTo(ix + ir * 0.4, iy - ir * 0.1); ctx.lineTo(ix + ir * 0.05, iy - ir * 0.1);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Rastgele alev püskürmesi (Deathmatch — tasarım 3.8.1)
  for (const al of durum.alevler || []) {
    const [lx, ly] = s2(al.x, al.y);
    const ilerleme = al.t / ALEV_SURE;
    const alpha = 0.6 * (1 - Math.abs(ilerleme - 0.5) * 1.4);
    if (alpha <= 0) continue;
    const yar = ALEV_YARICAP * scale * (0.85 + 0.15 * Math.sin(al.t * 16));
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, yar);
    g.addColorStop(0, `rgba(255,210,80,${alpha})`);
    g.addColorStop(0.55, `rgba(225,90,25,${alpha * 0.8})`);
    g.addColorStop(1, "rgba(120,25,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, yar, 0, Math.PI * 2);
    ctx.fill();
  }

  const sirali = [...durum.oyuncular].sort((a, b) => a.y - b.y);

  // Cesetler (ölmüş oyuncular — soluk, round sonuna kadar yerde)
  for (const e of sirali) {
    if (e.can > 0) continue;
    const [ex, ey] = s2(e.x, e.y);
    ctx.save();
    ctx.globalAlpha = 0.7;
    cizGladyator(ctx, ex, ey, r, { ...e, kalkanKalkik: false }, false);
    ctx.restore();
  }

  // Hayattaki oyuncular (painter's order)
  for (const e of sirali) {
    if (e.can <= 0) continue;
    const [ex, ey] = s2(e.x, e.y);
    // Kill streak efekti (tasarım 3.8.1) — sadece görsel, avantaj yok
    if ((e.eleme || 0) >= KILL_STREAK_ESIK) {
      const pulse = 0.5 + 0.5 * Math.sin(durum.zaman * 8);
      ctx.save();
      ctx.strokeStyle = `rgba(255,170,40,${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 3 * scale + 2;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Zırh aurası (DM) — yeşilimsi halka
    if (e.zirhKalan > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(120,230,150,0.65)";
      ctx.lineWidth = 3 * scale + 1.5;
      ctx.beginPath(); ctx.arc(ex, ey, r * 1.28, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Güç aurası (DM) — turuncu parıltı
    if (e.gucKalan > 0) {
      ctx.save();
      const g = ctx.createRadialGradient(ex, ey, r * 0.5, ex, ey, r * 1.6);
      g.addColorStop(0, "rgba(255,170,50,0)");
      g.addColorStop(1, "rgba(255,150,40,0.4)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, ey, r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Düello takım göstergesi (a=mavi, b=kırmızı)
    if (durum.faz === "duello" && e.takim) {
      ctx.save();
      ctx.strokeStyle = e.takim === "a" ? "rgba(80,150,255,0.9)" : "rgba(255,90,70,0.9)";
      ctx.lineWidth = 2.5 * scale + 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    cizGladyator(ctx, ex, ey, r, e, e.id === "ben");
  }

  // Tehditler (maymun / boğa)
  for (const th of durum.tehditler || []) {
    if (th.can <= 0) continue;
    const [tx, ty] = s2(th.x, th.y);
    if (th.tip === "maymun") {
      if (!cizSprite(ctx, "maymun", tx, ty, r * 2.0, th.aci)) cizMaymun(ctx, tx, ty, r * 0.72, th.aci);
    } else if (th.tip === "boga") {
      if (!cizSprite(ctx, "boga", tx, ty, r * 4.4, th.aci)) cizBoga(ctx, tx, ty, r, th, scale);
      else tehditCanBari(ctx, tx, ty - r * 2.2, r * 3, th.can / 140);
    } else if (th.tip === "aslan") {
      // Bölge (zincir menzili) — daralan güvenli alanı gösterir
      const [bx, by] = s2(th.bx, th.by);
      ctx.save();
      ctx.strokeStyle = "rgba(200,70,40,0.22)";
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, th.bolge * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (!cizSprite(ctx, "aslan", tx, ty, r * 3.0, th.aci)) cizAslan(ctx, tx, ty, r * 1.15, th.aci, th, scale);
      else tehditCanBari(ctx, tx, ty - r * 1.6, r * 2.2, th.can / 95);
    }
  }

  // Etiketler en üstte (üst üste binmesin diye ayrı geçiş)
  for (const e of sirali) {
    if (e.can <= 0) continue;
    const [ex, ey] = s2(e.x, e.y);
    cizEtiket(ctx, ex, ey, r, e, CAN_MAX);
  }

  // Geçici efektler (kan sıçraması / kalkan savuşturma / ıska)
  for (const f of durum.efektler || []) {
    const [fx, fy] = s2(f.x, f.y);
    const ilerleme = f.t / f.sure;         // 0..1
    const solma = 1 - ilerleme;
    ctx.save();
    if (f.tip === "kan") {
      ctx.fillStyle = `rgba(190,30,25,${0.85 * solma})`;
      for (let i = 0; i < 6; i++) {
        const a = f.aci + (i - 3) * 0.35;
        const d = (10 + ilerleme * 26) * scale;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * d, fy + Math.sin(a) * d, (3.5 - ilerleme * 2) * scale + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.tip === "kalkan") {
      ctx.strokeStyle = `rgba(255,240,190,${0.9 * solma})`;
      ctx.lineWidth = 3 * scale + 1;
      ctx.beginPath();
      ctx.arc(fx, fy, (14 + ilerleme * 10) * scale, f.aci - 0.6, f.aci + 0.6);
      ctx.stroke();
    } else if (f.tip === "iska") {
      ctx.strokeStyle = `rgba(230,230,220,${0.5 * solma})`;
      ctx.lineWidth = 2 * scale + 1;
      ctx.beginPath();
      ctx.arc(fx, fy, 20 * scale, f.aci - 0.9, f.aci + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Kill feed (sağ üst, ekran koordinatı — tasarım 8/11)
  if (durum.killFeed && durum.killFeed.length) {
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.font = "14px system-ui, sans-serif";
    let ky = 12;
    for (const kf of durum.killFeed) {
      const solma = Math.min(1, (kf.sure - kf.t) / 1);
      ctx.globalAlpha = 0.35 + 0.65 * solma;
      const metin = `${kf.vuran}  ⚔  ${kf.olen}`;
      const gen = ctx.measureText(metin).width;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(w - gen - 20, ky - 2, gen + 16, 22);
      ctx.fillStyle = "#f0e0c0";
      ctx.fillText(metin, w - 12, ky + 1);
      ky += 26;
    }
    ctx.restore();
  }

  // Altın Dakika bildirimi (Deathmatch — tasarım 3.8.1)
  if (durum.altinDakika) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "bold 20px system-ui, sans-serif";
    const pulse = 0.6 + 0.4 * Math.sin(durum.zaman * 6);
    ctx.fillStyle = `rgba(246,196,83,${pulse})`;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6;
    ctx.fillText("⚡ ALTIN DAKİKA · Çift Hasar ⚡", w / 2, 12);
    ctx.restore();
  }

  // Vignette — kenarları karart (derinlik/sinematik his)
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// --- Tehdit çizimleri ---
function tehditCanBari(ctx, x, yust, gen, oran) {
  oran = Math.max(0, Math.min(1, oran));
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - gen / 2, yust, gen, 5);
  ctx.fillStyle = "#d0483a";
  ctx.fillRect(x - gen / 2, yust, gen * oran, 5);
}

function cizMaymun(ctx, x, y, rr, aci) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + rr * 0.4, rr * 0.9, rr * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // kulaklar
  ctx.fillStyle = "#5a3a22";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * rr * 0.7, y - rr * 0.5, rr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // gövde
  ctx.fillStyle = "#6e4a2c";
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();
  // yüz
  ctx.fillStyle = "#c9a075";
  ctx.beginPath();
  ctx.arc(x + Math.cos(aci) * rr * 0.15, y + Math.sin(aci) * rr * 0.15, rr * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function cizBoga(ctx, x, y, r, boga, scale) {
  const rr = r * 1.7;
  ctx.save();
  // toz (şarjda)
  if (boga.hal === "sarj") {
    ctx.fillStyle = "rgba(180,160,130,0.35)";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(x - boga.sx * rr * 0.7 * i, y - boga.sy * rr * 0.7 * i, rr * 0.5 / i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.translate(x, y);
  ctx.rotate(boga.aci);
  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, rr * 0.35, rr * 1.1, rr * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // gövde
  ctx.fillStyle = "#3a2c22";
  ctx.beginPath();
  ctx.ellipse(0, 0, rr * 1.15, rr * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // baş
  ctx.fillStyle = "#2a2019";
  ctx.beginPath();
  ctx.arc(rr * 0.9, 0, rr * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // boynuzlar
  ctx.strokeStyle = "#e8dcc0";
  ctx.lineWidth = rr * 0.18;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(rr * 1.05, s * rr * 0.35);
    ctx.lineTo(rr * 1.5, s * rr * 0.7);
    ctx.stroke();
  }
  ctx.restore();

  // can barı
  const gen = rr * 1.6;
  const ust = y - rr - 12;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - gen / 2, ust, gen, 6);
  const oran = Math.max(0, boga.can / 140);
  ctx.fillStyle = "#d0483a";
  ctx.fillRect(x - gen / 2, ust, gen * oran, 6);
}

function cizAslan(ctx, x, y, rr, aci, aslan, scale) {
  ctx.save();
  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x, y + rr * 0.42, rr * 1.0, rr * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // yele (mane) — koyu turuncu halka
  ctx.fillStyle = "#7a4a1e";
  ctx.beginPath();
  ctx.arc(x, y, rr * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // gövde (açık ten)
  ctx.fillStyle = "#c79a5a";
  ctx.beginPath();
  ctx.arc(x, y, rr * 0.78, 0, Math.PI * 2);
  ctx.fill();
  // burun/yön
  ctx.fillStyle = "#e0be86";
  ctx.beginPath();
  ctx.arc(x + Math.cos(aci) * rr * 0.4, y + Math.sin(aci) * rr * 0.4, rr * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // can barı
  const gen = rr * 1.8;
  const ust = y - rr * 1.1 - 10;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - gen / 2, ust, gen, 5);
  ctx.fillStyle = "#e0b13a";
  ctx.fillRect(x - gen / 2, ust, gen * Math.max(0, aslan.can / 95), 5);
}
