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

function meyveCiz(ctx, f, kalite) {
  const boyut = Math.round(f.r * 2.4);
  const sprite = meyveSprite(f.meyve, boyut);
  const cizB = f.r * 2.1;
  // Altın parıltısı: eskiden shadowBlur idi — mobil GPU'da kare başına ölçülebilir
  // maliyet (her meyve için ayrı blur geçişi). Yerine tek additif halka: aynı his,
  // ihmal edilebilir maliyet. Kalite düşürüldüyse (zayıf cihaz) tamamen atlanır.
  if (f.meyve.altin && kalite > 0.7) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,210,31,0.20)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  if (!sprite) return;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.aci);
  ctx.drawImage(sprite, -cizB / 2, -cizB / 2, cizB, cizB);
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
  // Kesik yüzeyi bıçağın geçtiği açıda durmalı: önce kesim açısıyla kırp,
  // sonra meyvenin kendi dönüşüne göre sprite'ı çiz.
  const ka = y.kesimAci || 0;
  ctx.rotate(ka);
  ctx.beginPath();
  if (y.yari === "ust") ctx.rect(-cizB, -cizB, cizB * 2, cizB - bosluk);
  else ctx.rect(-cizB, bosluk, cizB * 2, cizB);
  ctx.clip();
  ctx.save();
  ctx.rotate(y.aci - ka);
  ctx.drawImage(sprite, -cizB / 2, -cizB / 2, cizB, cizB);
  ctx.restore();
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

// Fruit Ninja pala izi: kuyrukta sivri, savurma ucunda dolgun BEYAZ şerit +
// altında mavimsi additif parıltı. Noktalar motorda ÇİZİM hızında (60 fps)
// üretilir (bkz. oyun.js IZ_HIZ_ESIK) → az algılama fps'inde bile akıcı.
// shadowBlur yok — 3 katman additif çizim (mobilde ucuz, ekranda parlak).
const IZ_OMUR = 0.3; // oyun.js ile aynı olmalı
const IZ_MAKS_EN = 22; // pala yarı-genişlik tavanı (px)

// Az noktayla bile yumuşak eğri: Catmull-Rom ile ara noktalar üret.
function izYumusat(pts) {
  const n = pts.length;
  if (n < 3) return pts;
  const cikti = [pts[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 1; s <= 2; s++) {
      const u = s / 2;
      const u2 = u * u;
      const u3 = u2 * u;
      cikti.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        t: p1.t + (p2.t - p1.t) * u,
      });
    }
  }
  return cikti;
}

function izCiz(ctx, iz, t, kalite) {
  if (!iz || iz.length < 2) return;
  // yalnız taze noktalar (eskiler motorda süzülür ama garanti)
  const ham = [];
  for (const p of iz) if (t - p.t < IZ_OMUR) ham.push(p);
  if (ham.length < 2) return;
  const pts = izYumusat(ham);
  const n = pts.length;

  // yarı-genişlik: kuyrukta (eski) sivri, uçta (yeni) dolgun; tazelikle çarpılır
  const hw = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1); // 0 = eski kuyruk, 1 = yeni uç
    const tazelik = Math.max(0, 1 - (t - pts[i].t) / IZ_OMUR);
    // uçta hafif sivrilt (son %8) — bıçak ucu hissi
    const uc = u > 0.92 ? (1 - u) / 0.08 : 1;
    hw[i] = IZ_MAKS_EN * (0.12 + 0.88 * u) * (0.35 + 0.65 * tazelik) * (0.35 + 0.65 * uc);
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

  const merkezYol = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };

  // 1) geniş dış parıltı (mavimsi hale) — en pahalı katman (57 px genişlikte
  // additif stroke). Zayıf cihazda (kalite düşürülmüşse) atlanır; iz yine görünür.
  if (kalite > 0.7) {
    ctx.strokeStyle = "rgba(90,170,255,0.22)";
    ctx.lineWidth = IZ_MAKS_EN * 2.6;
    merkezYol();
    ctx.stroke();
  }

  // 2) iç parıltı (beyaza yakın)
  ctx.strokeStyle = "rgba(180,225,255,0.4)";
  ctx.lineWidth = IZ_MAKS_EN * 1.3;
  merkezYol();
  ctx.stroke();

  // 3) beyaz pala gövdesi (sivri kuyruklu şerit)
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.beginPath();
  ctx.moveTo(sol[0].x, sol[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(sol[i].x, sol[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(sag[i].x, sag[i].y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Kesim anı: bıçak yönünde açılan beyaz flaş çizgisi.
function slashCiz(ctx, s) {
  const p = s.t / s.omur;
  const alfa = Math.max(0, 1 - p);
  const uz = s.uz * (0.6 + 1.1 * p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(s.x, s.y);
  ctx.rotate(s.aci);
  ctx.strokeStyle = s.altin ? `rgba(255,225,120,${alfa})` : `rgba(255,255,255,${alfa})`;
  ctx.lineWidth = 5 * (1 - p * 0.7);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-uz / 2, 0);
  ctx.lineTo(uz / 2, 0);
  ctx.stroke();
  ctx.restore();
}

// Kesim anı: dışa açılan ince halka dalgası.
function dalgaCiz(ctx, d) {
  const p = d.t / d.omur;
  const alfa = Math.max(0, 1 - p) * 0.7;
  const r = d.r0 + p * d.r0 * 2.6;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = d.altin ? `rgba(255,215,80,${alfa})` : `rgba(255,255,255,${alfa * 0.8})`;
  ctx.lineWidth = 3 * (1 - p);
  ctx.beginPath();
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// MEYVE YE: yutulan meyve ağza doğru büzülerek akar.
function yutulanCiz(ctx, y) {
  const olcek = y.olcek == null ? 1 : y.olcek;
  const boyut = Math.round(y.r * 2.4);
  const sprite = meyveSprite(y.meyve, boyut);
  if (!sprite) return;
  const cizB = y.r * 2.1 * Math.max(0.05, olcek);
  ctx.save();
  ctx.globalAlpha = Math.max(0, olcek);
  ctx.drawImage(sprite, (y.cx ?? y.x) - cizB / 2, (y.cy ?? y.y) - cizB / 2, cizB, cizB);
  ctx.restore();
}

// MEYVE YE: ağız nişangâhı — açıkken parlak yeşil halka + "yut" alanı,
// kapalıyken sönük ince halka (oyuncu nereye nişan alacağını görsün).
function agizCiz(ctx, a, t) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (a.acik) {
    const nabiz = 1 + 0.06 * Math.sin(t * 14);
    const r = a.r * nabiz;
    ctx.strokeStyle = "rgba(120,255,170,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,255,170,0.28)";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// Parçacıklar tek geçişte: her parçacık için save/restore yapmak (combo'da 200+
// parçacık olabiliyor) kare başına ciddi yük getiriyordu.
function parcaciklarCiz(ctx, liste) {
  for (const p of liste) {
    const k = p.t / p.omur;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = p.renk;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 - k * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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
// kalite: OyunPage'in adaptif çözünürlük katsayısı (1 = tam). 0.7'nin altında
// pahalı efekt katmanları (geniş additif hale, altın parıltı) kapatılır.
export function ciz(ctx, oyun, video, k, W, H, kalite = 1) {
  ctx.clearRect(0, 0, W, H);

  // kesim sarsıntısı: tüm sahne birkaç piksel kayar (vuruş hissi)
  const sar = oyun.sarsinti || 0;
  const kaydi = sar > 0.2;
  if (kaydi) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * sar, (Math.random() - 0.5) * sar);
  }

  videoCiz(ctx, video, k, W);

  // hafif karartma (meyveler öne çıksın)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  // MEYVE YE: ağız nişangâhı meyvelerin ALTINDA (meyve halkanın içine girsin)
  if (oyun.agiz) agizCiz(ctx, oyun.agiz, oyun._t);

  for (const f of oyun.meyveler) meyveCiz(ctx, f, kalite);
  for (const y of oyun.yarilar) yarimCiz(ctx, y);
  for (const y of oyun.yutulanlar) yutulanCiz(ctx, y);
  parcaciklarCiz(ctx, oyun.parcaciklar);

  // kesim anı efektleri + bıçak izi (meyvelerin üstünde parlar)
  for (const d of oyun.dalgalar) dalgaCiz(ctx, d);
  for (const s of oyun.slashlar) slashCiz(ctx, s);
  for (const iz of oyun.izler) izCiz(ctx, iz, oyun._t, kalite);
  for (const pp of oyun.popuplar) popupCiz(ctx, pp);

  if (kaydi) ctx.restore();
}
