// ============================================================
// TANINIR YAPILAR (Aşama 3A-2 §C · §D · §E) — cephe.js kalıbının genişlemesi. Yeni stil YOK:
// aynı atlas, aynı tek malzeme, aynı köşe rengi (ton × gömülü AO), aynı 3 LOD, yapı başına 1 çizim çağrısı.
//
//   YAPILAR[ad](T, p, lod, R)  — yerel eksende (köken çapa, +Z sokağa/meydana bakan yüz) Toplayici'ya çizer.
//   Hangi yapı nerede → yerlesim.json (parsel ya da nokta `yapi` alanı). Ölçüler manifestten; bu dosyada konum yok.
//   LOD: 0 yakın (tam) · 1 orta (sade) · 2 uzak (kütle + siluet). Gölgeyi CepheSistemi'nde yalnız uzak kütle atar.
//
//   sokakDevami(M, H) — İstiklal'in açılan ucu: sokağın ilerideki devamı hissi (arka plan; parsel değil).
//
// Saf three.js + veri, DOM yok → Node'da da çalışır (varlik/cephe_ao.mjs gömülü AO + muayene örnekleri).
// ============================================================
import * as THREE from "three";
import { Toplayici, BEYAZ, BOLGE } from "./cephe.js";

const C = (h) => new THREE.Color(h);
/** Dörtgeni, normali `hedef` yönüne (bir nokta ya da [0,1,0] gibi yön: yon=true) bakacak şekilde çizer — sarım hatası olmasın. */
function yonlu(T, q, hedef, hucre, ton, o = {}, yon = false) {
  const [a, b, c] = q, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const d = yon ? hedef : [hedef[0] - a[0], hedef[1] - a[1], hedef[2] - a[2]];
  T.dortgen(n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0 ? [q[0], q[3], q[2], q[1]] : q, hucre, ton, o);
}
const tohum = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };

/** Yatay dörtgen (yukarı bakar): x0<x1, z0<z1. */
const yatay = (T, x0, x1, z0, z1, y, hucre, ton, o = {}) => T.dortgen([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], hucre, ton, o);
/** Düşey dörtgen, normal +X (x sabit). */
const duseyX = (T, x, z0, z1, y0, y1, hucre, ton, o = {}) => T.dortgen([[x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1]], hucre, ton, o);
/** Düşey dörtgen, normal −X. */
const duseyx = (T, x, z0, z1, y0, y1, hucre, ton, o = {}) => T.dortgen([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], hucre, ton, o);
/** Düşey dörtgen, normal +Z (z sabit). */
const duseyZ = (T, z, x0, x1, y0, y1, hucre, ton, o = {}) => T.dortgen([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], hucre, ton, o);
/** Düşey dörtgen, normal −Z. */
const duseyz = (T, z, x0, x1, y0, y1, hucre, ton, o = {}) => T.dortgen([[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], hucre, ton, o);

/**
 * "M" harfi — düz çubuklarla, doku yok. Pano yüzeyinde (u: yatay, v: düşey, yüzey normali `yon`).
 * @param {(u:number, v:number)=>number[]} P pano yerel (u,v) → yerel 3B nokta
 */
function harfM(T, P, boy, ton) {
  const w = boy * 0.72, k = boy * 0.13, cift = (a, b, c, d) => T.dortgen([P(...a), P(...b), P(...c), P(...d)], "cerceve", ton);
  cift([-w / 2, -boy / 2], [-w / 2 + k, -boy / 2], [-w / 2 + k, boy / 2], [-w / 2, boy / 2]);   // sol direk
  cift([w / 2 - k, -boy / 2], [w / 2, -boy / 2], [w / 2, boy / 2], [w / 2 - k, boy / 2]);       // sağ direk
  cift([-w / 2 + k, boy / 2 - k * 1.4], [0, -boy * 0.12], [0, -boy * 0.12 + k * 1.4], [-w / 2 + k, boy / 2]);   // sol çapraz
  cift([0, -boy * 0.12], [w / 2 - k, boy / 2 - k * 1.4], [w / 2 - k, boy / 2], [0, -boy * 0.12 + k * 1.4]);     // sağ çapraz
}

// ================================================================ §E — METRO GİRİŞİ
/**
 * Kozmetik metro girişi: aşağı inen merdiven (dipte karanlık), taş korkuluk duvarları + paslanmaz tırabzan,
 * cam kanopi, "M" totemi, zemin deliğini örten taş apron. İnilmez; çarpışma ayak izinin tamamı (yerlesimDunya).
 * Yerel: açıklık (ic.en × ic.derinlik) merkezde; giriş ağzı +Z ucunda, merdiven −Z'ye doğru iner.
 */
function metro(T, p, lod) {
  const ie = p.ic.en, id = p.ic.derinlik, w = (p.ayakizi.en - ie) / 2, pay = p.zemin_deligi?.pay ?? 2.5;
  const tas = C("#C9C2B5"), tasKoyu = C("#A69F92"), apron = C("#DDD6C8"), metal = C("#C9CED3"), metalKoyu = C("#5F676F");
  const cam = C("#CFE8F2"), kirmizi = C("#C8102E"), kara = C("#0C0E10");
  const X0 = -ie / 2, X1 = ie / 2, Z0 = -id / 2, Z1 = id / 2, derin = 2.8;

  // apron: açıklığı çevreleyen taş çerçeve (karo deliğinin testere dişi kenarını örter)
  const ax0 = X0 - w - pay, ax1 = X1 + w + pay, az0 = Z0 - w - pay, az1 = Z1 + pay, y = 0.035;
  yatay(T, ax0, ax1, Z1, az1, y, "tasAcik", apron, { dolu: lod === 0 });
  yatay(T, ax0, ax1, az0, Z0, y, "tasAcik", apron, { dolu: lod === 0 });
  yatay(T, ax0, X0, Z0, Z1, y, "tasAcik", apron, { dolu: lod === 0 });
  yatay(T, X1, ax1, Z0, Z1, y, "tasAcik", apron, { dolu: lod === 0 });

  // korkuluk duvarları: iki yan + arka (giriş ağzı +Z açık)
  const dh = 1.05;
  for (const s of [-1, 1]) T.kutu(w, dh, id + w, s * (ie / 2 + w / 2), dh / 2, -w / 2, "tas", tas, { yuz: "XxYZz", dolu: lod === 0 });
  T.kutu(ie, dh, w, 0, dh / 2, Z0 - w / 2, "tas", tas, { yuz: "YZz", dolu: lod === 0 });

  // çukur: iç duvarlar aşağı doğru koyulaşır (oyuncu içeri bakınca boşluk değil karanlık görür)
  const bantlar = lod === 2 ? [[0, -derin - 0.6, C("#2A2F34")]] : [[0, -1.0, C("#8C949B")], [-1.0, -2.0, C("#4B5258")], [-2.0, -derin - 0.6, C("#15181B")]];
  for (const [y0, y1, ton] of bantlar) {
    duseyX(T, X0, Z0, Z1, y1, y0, "cerceve", ton);
    duseyx(T, X1, Z0, Z1, y1, y0, "cerceve", ton);
    duseyZ(T, Z0, X0, X1, y1, y0, "cerceve", ton);
  }
  if (lod === 2) { yatay(T, X0, X1, Z0, Z1, -derin, "cerceve", kara); }
  else {
    // basamaklar: +Z ağzından −Z'ye iner; açıktan koyuya
    const n = lod === 0 ? 10 : 4, sahanlik = 1.7, tr = (id - sahanlik) / n, h = derin / n;
    for (let i = 0; i < n; i++) {
      const zUst = Z1 - i * tr, ton = C("#D2CCC0").lerp(C("#3A3F44"), (i + 1) / n);
      if (lod === 0) duseyZ(T, zUst, X0, X1, -(i + 1) * h, -i * h, "tas", ton.clone().multiplyScalar(0.82));   // rıht
      if (lod === 0) yatay(T, X0, X1, zUst - tr, zUst, -(i + 1) * h, "tas", ton, { dolu: true });
      else T.dortgen([[X0, -i * h, zUst], [X1, -i * h, zUst], [X1, -(i + 1) * h, zUst - tr], [X0, -(i + 1) * h, zUst - tr]], "tas", ton);   // eğik tek yüz
    }
    yatay(T, X0, X1, Z0, Z0 + sahanlik, -derin, "cerceve", C("#202428"));   // sahanlık
    duseyZ(T, Z0 + 0.01, -1.15, 1.15, -derin, -derin + 2.3, "cerceve", kara);   // dipteki geçit: karanlık
  }

  // paslanmaz tırabzan: duvar üstleri + merdiven boyunca iki eğik kol
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const x = s * (ie / 2 + w / 2);
      T.kutu(0.07, 0.07, id + w, x, dh + 0.42, -w / 2, "metal", metal, { yuz: "XxYZz" });
      if (lod === 0) for (let i = 0; i < 5; i++) T.kutu(0.05, 0.42, 0.05, x, dh + 0.21, Z0 - w / 2 + ((id + w) * (i + 0.5)) / 5, "metal", metal, { yuz: "XxZz" });
      if (lod === 0) {   // merdiven kolu (eğik)
        const xi = s * (ie / 2 - 0.12), sahanlik = 1.7, a = [xi, 0.95, Z1], b = [xi, -derin + 0.95, Z0 + sahanlik];
        T.dortgen([[xi - 0.035, a[1], a[2]], [xi + 0.035, a[1], a[2]], [xi + 0.035, b[1], b[2]], [xi - 0.035, b[1], b[2]]].map((q, j) => j < 2 ? q : q), "metal", metal);
        T.dortgen(s < 0 ? [[xi + 0.035, a[1] - 0.06, a[2]], [xi + 0.035, b[1] - 0.06, b[2]], [xi + 0.035, b[1], b[2]], [xi + 0.035, a[1], a[2]]] : [[xi - 0.035, b[1] - 0.06, b[2]], [xi - 0.035, a[1] - 0.06, a[2]], [xi - 0.035, a[1], a[2]], [xi - 0.035, b[1], b[2]]], "metal", metal);
        T.kutu(0.05, 0.95, 0.05, xi, 0.475, Z1 - 0.05, "metal", metal, { yuz: "XxZz" });
      }
    }
  }

  // cam kanopi: dört dikme + eğik cam çatı + metal çerçeve
  const kx = ie / 2 + w / 2, kz0 = Z0 - w / 2, kz1 = Z1, ky0 = 3.05, ky1 = 3.45;
  if (lod < 2) for (const sx of [-1, 1]) for (const zz of [kz0, kz1]) T.kutu(0.1, zz === kz1 ? ky0 - dh : ky1 - dh, 0.1, sx * kx, dh + (zz === kz1 ? ky0 - dh : ky1 - dh) / 2, zz, "metal", metalKoyu, { yuz: "XxZz" });
  const cx0 = -kx - 0.25, cx1 = kx + 0.25, cz0 = kz0 - 0.35, cz1 = kz1 + 0.45, yA = ky0 - 0.05, yB = ky1 + 0.05;
  T.dortgen([[cx0, yA, cz1], [cx1, yA, cz1], [cx1, yB, cz0], [cx0, yB, cz0]], "cam", cam, { bolge: BOLGE.cam, dolu: lod === 0 });   // üst yüz
  T.dortgen([[cx0, yB, cz0], [cx1, yB, cz0], [cx1, yA, cz1], [cx0, yA, cz1]], "cam", cam.clone().multiplyScalar(0.9), { bolge: BOLGE.cam });   // alt yüz (merdivenden bakınca)
  if (lod === 0) {
    T.kutu(cx1 - cx0 + 0.1, 0.1, 0.1, 0, yA, cz1, "metal", metalKoyu, { yuz: "XxYZzy" });
    T.kutu(cx1 - cx0 + 0.1, 0.1, 0.1, 0, yB, cz0, "metal", metalKoyu, { yuz: "XxYZzy" });
  }

  // "M" totemi: giriş ağzının yanında, iki yüzlü kırmızı pano (panolar ±X'e — plazaya ve geriye bakar)
  const tx = kx + 0.9, tz = Z1 + 0.6, ty = 3.35, pb = 1.0;
  if (lod < 2) T.kutu(0.14, ty - pb / 2, 0.14, tx, (ty - pb / 2) / 2, tz, "metal", metalKoyu, { yuz: "XxZz" });
  T.kutu(0.16, pb, pb, tx, ty, tz, "cerceve", kirmizi, { yuz: "XxYZzy" });
  if (lod < 2) {
    harfM(T, (u, v) => [tx + 0.085, ty + v, tz - u], pb * 0.62, BEYAZ);   // +X yüzü
    harfM(T, (u, v) => [tx - 0.085, ty + v, tz + u], pb * 0.62, BEYAZ);   // −X yüzü
  }
}


// ================================================================ ORTAK YARDIMCILAR (§C)
const V = (a, b, c) => [a, b, c];
/** Üçgen, normali `yon` doğrultusuna bakar. */
function ucgenYon(T, tri, yon, hucre, ton, bolge) {
  const [a, b, c] = tri, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  T.ucgen(n[0] * yon[0] + n[1] * yon[1] + n[2] * yon[2] < 0 ? [a, c, b] : tri, hucre, ton, bolge);
}
/**
 * Cephe düzlemi: yerel (a: yatay, dışarıdan bakınca soldan sağa · b: yukarı · d: düzlemden dışarı) → yerel 3B.
 * yuz: "Z+" z=c · "Z-" · "X+" x=c · "X-". Böylece dört cepheye aynı parça kodu uygulanır.
 */
function cephe(yuz, c) {
  switch (yuz) {
    case "Z+": return { P: (a, b, d = 0) => V(a, b, c + d), n: [0, 0, 1] };
    case "Z-": return { P: (a, b, d = 0) => V(-a, b, c - d), n: [0, 0, -1] };
    case "X+": return { P: (a, b, d = 0) => V(c + d, b, -a), n: [1, 0, 0] };
    default: return { P: (a, b, d = 0) => V(c - d, b, a), n: [-1, 0, 0] };
  }
}
/** Düzlemde dikdörtgen (d derinliğinde, düzleme paralel). */
const fdik = (T, F, a0, a1, b0, b1, d, hucre, ton, o = {}) => yonlu(T, [F.P(a0, b0, d), F.P(a1, b0, d), F.P(a1, b1, d), F.P(a0, b1, d)], F.n, hucre, ton, o, true);
/** Düzlemde kutu (merkez a,b; genişlik wa, yükseklik hb; d0..d1 derinlik aralığı). Ön + yanlar + üst + alt. */
function fkutu(T, F, a, b, wa, hb, d0, d1, hucre, ton, o = {}) {
  const [x0, x1, y0, y1] = [a - wa / 2, a + wa / 2, b - hb / 2, b + hb / 2];
  fdik(T, F, x0, x1, y0, y1, d1, hucre, ton, o);
  const q = (p, dir) => yonlu(T, p, dir, hucre, ton, o, true);
  const d = (x, y, dd) => F.P(x, y, dd), yon = (x, y) => { const p0 = F.P(0, 0, 0), p1 = F.P(x, y, 0); return [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; };
  q([d(x0, y0, d0), d(x0, y0, d1), d(x0, y1, d1), d(x0, y1, d0)], yon(-1, 0));
  q([d(x1, y0, d0), d(x1, y0, d1), d(x1, y1, d1), d(x1, y1, d0)], yon(1, 0));
  q([d(x0, y1, d0), d(x1, y1, d0), d(x1, y1, d1), d(x0, y1, d1)], [0, 1, 0]);
  if (o.alt !== false) q([d(x0, y0, d0), d(x1, y0, d0), d(x1, y0, d1), d(x0, y0, d1)], [0, -1, 0]);
}
/** Düzlemde çubuk (a0,b0 → a1,b1), kalınlık k, derinlikte d. Harf ve çapraz için. */
function fcubuk(T, F, a0, b0, a1, b1, k, d, hucre, ton) {
  const L = Math.hypot(a1 - a0, b1 - b0) || 1, na = (-(b1 - b0) / L) * k / 2, nb = ((a1 - a0) / L) * k / 2;
  yonlu(T, [F.P(a0 - na, b0 - nb, d), F.P(a1 - na, b1 - nb, d), F.P(a1 + na, b1 + nb, d), F.P(a0 + na, b0 + nb, d)], F.n, hucre, ton, {}, true);
}
/** Düzlemde kemer açıklığı: dikdörtgen gövde + yarım daire tepe (n dilim). Dolu yüz (koyu iç ya da cam). */
function fkemer(T, F, a, b0, w, h, d, hucre, ton, n = 6, bolge) {
  const r = w / 2, bk = b0 + h - r;
  fdik(T, F, a - r, a + r, b0, bk, d, hucre, ton, { bolge });
  for (let i = 0; i < n; i++) { const f0 = Math.PI * (i / n), f1 = Math.PI * ((i + 1) / n); ucgenYon(T, [F.P(a, bk, d), F.P(a + Math.cos(f0) * r, bk + Math.sin(f0) * r, d), F.P(a + Math.cos(f1) * r, bk + Math.sin(f1) * r, d)], F.n, hucre, ton, bolge); }
}
/** Kemer çerçevesi (söve): iki yan şerit + yay halkası, k kalınlık, düzlemden dd öne. */
function fkemerCerceve(T, F, a, b0, w, h, k, d, hucre, ton, n = 6) {
  const r = w / 2, bk = b0 + h - r;
  fdik(T, F, a - r - k, a - r, b0, bk, d, hucre, ton); fdik(T, F, a + r, a + r + k, b0, bk, d, hucre, ton);
  for (let i = 0; i < n; i++) {
    const f0 = Math.PI * (i / n), f1 = Math.PI * ((i + 1) / n), p = (f, rr) => F.P(a + Math.cos(f) * rr, bk + Math.sin(f) * rr, d);
    yonlu(T, [p(f0, r), p(f0, r + k), p(f1, r + k), p(f1, r)], F.n, hucre, ton, {}, true);
  }
}
/** Düşey n-gen prizma (yanlar dışa, isteğe bağlı üst kapak). */
function prizma(T, cx, cz, r0, y0, y1, n, hucre, ton, { r1 = r0, kapak = false, alt = false, faz = 0, bolge } = {}) {
  for (let i = 0; i < n; i++) {
    const f0 = faz + (i / n) * Math.PI * 2, f1 = faz + ((i + 1) / n) * Math.PI * 2, fm = (f0 + f1) / 2;
    yonlu(T, [V(cx + Math.cos(f0) * r0, y0, cz + Math.sin(f0) * r0), V(cx + Math.cos(f1) * r0, y0, cz + Math.sin(f1) * r0), V(cx + Math.cos(f1) * r1, y1, cz + Math.sin(f1) * r1), V(cx + Math.cos(f0) * r1, y1, cz + Math.sin(f0) * r1)], [Math.cos(fm), 0, Math.sin(fm)], hucre, ton, { bolge }, true);
    if (kapak) ucgenYon(T, [V(cx, y1, cz), V(cx + Math.cos(f0) * r1, y1, cz + Math.sin(f0) * r1), V(cx + Math.cos(f1) * r1, y1, cz + Math.sin(f1) * r1)], [0, 1, 0], hucre, ton, bolge);
    if (alt) ucgenYon(T, [V(cx, y0, cz), V(cx + Math.cos(f0) * r0, y0, cz + Math.sin(f0) * r0), V(cx + Math.cos(f1) * r0, y0, cz + Math.sin(f1) * r0)], [0, -1, 0], hucre, ton, bolge);
  }
}
/** Düşey koni (yanlar dışa). */
function koni(T, cx, cz, r, y0, y1, n, hucre, ton, faz = 0) {
  for (let i = 0; i < n; i++) {
    const f0 = faz + (i / n) * Math.PI * 2, f1 = faz + ((i + 1) / n) * Math.PI * 2, fm = (f0 + f1) / 2;
    ucgenYon(T, [V(cx + Math.cos(f0) * r, y0, cz + Math.sin(f0) * r), V(cx + Math.cos(f1) * r, y0, cz + Math.sin(f1) * r), V(cx, y1, cz)], [Math.cos(fm), 0.4, Math.sin(fm)], hucre, ton);
  }
}
/** Halka (yatay, dışa taşan bilezik/şerefe): üst yüz + dış kenar + alt yüz. */
function halka(T, cx, cz, ri, ro, y, kal, n, hucre, ton) {
  for (let i = 0; i < n; i++) {
    const f0 = (i / n) * Math.PI * 2, f1 = ((i + 1) / n) * Math.PI * 2, fm = (f0 + f1) / 2, p = (f, r, yy) => V(cx + Math.cos(f) * r, yy, cz + Math.sin(f) * r);
    yonlu(T, [p(f0, ri, y), p(f1, ri, y), p(f1, ro, y), p(f0, ro, y)], [0, 1, 0], hucre, ton, {}, true);
    yonlu(T, [p(f0, ro, y - kal), p(f1, ro, y - kal), p(f1, ro, y), p(f0, ro, y)], [Math.cos(fm), 0, Math.sin(fm)], hucre, ton, {}, true);
    yonlu(T, [p(f0, ri, y - kal), p(f1, ri, y - kal), p(f1, ro, y - kal), p(f0, ro, y - kal)], [0, -1, 0], hucre, ton, {}, true);
  }
}
/**
 * Kubbe / küre dilimi. `yari`: yarım küre (üst). Kaburga: çift boylamlar ridge (yarıçap × (1+kab)).
 * `eksen`: "y" (yukarı bakan kubbe) ya da "z" (öne bakan yarım küre — AKM opera salonu). Normaller merkezden dışa.
 */
function kubbe(T, cx, cy, cz, R, nLon, nLat, hucre, tonFn, { kab = 0, eksen = "y", enlemSon = Math.PI / 2 } = {}) {
  const nokta = (i, j) => {
    const lon = (i / nLon) * Math.PI * 2, lat = (j / nLat) * enlemSon, rr = R * (1 + (kab && i % 2 === 0 ? kab : 0) * Math.cos(lat));
    const yatay = Math.cos(lat) * rr, dik = Math.sin(lat) * rr;
    return eksen === "y" ? V(cx + Math.cos(lon) * yatay, cy + dik, cz + Math.sin(lon) * yatay) : V(cx + Math.cos(lon) * yatay, cy + Math.sin(lon) * yatay, cz + dik);
  };
  const merkez = V(cx, cy, cz);
  for (let j = 0; j < nLat; j++) for (let i = 0; i < nLon; i++) {
    const a = nokta(i, j), b = nokta(i + 1, j), c = nokta(i + 1, j + 1), d = nokta(i, j + 1), ton = tonFn(i, j);
    const m = [(a[0] + c[0]) / 2 - merkez[0], (a[1] + c[1]) / 2 - merkez[1], (a[2] + c[2]) / 2 - merkez[2]];
    if (j === nLat - 1 && enlemSon >= Math.PI / 2 - 1e-6) ucgenYon(T, [a, b, c], m, hucre, ton);   // tepe: son dilim üçgene çöker
    else yonlu(T, [a, b, c, d], m, hucre, ton, {}, true);
  }
}
/**
 * SİLUET FİGÜRÜ (anıt heykelleri). ⚠ YÜZ DETAYI YOK — hiçbir LOD'da göz, burun, ağız, saç çizilmez (ürün sahibi kararı).
 * Baş düz yüzlü prizma + yumuşak tepe; duruş, omuz, pelerin hattı ve kütle oranı okunur.
 */
function figur(T, x, y, z, boy, { yon = 0, pelerin = true, kol = 0, lod = 0, ton }) {
  const c = Math.cos(yon), s = Math.sin(yon), R = (lx, ly, lz) => V(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  const n = lod === 0 ? 6 : 4, b = boy;
  const parca = (lx, lz, r0, r1, y0, y1) => { const [px, , pz] = R(lx, 0, lz); prizma(T, px, pz, r0, y + y0, y + y1, n, "demir", ton, { r1, faz: -yon }); };
  parca(-0.06 * b, 0, 0.055 * b, 0.065 * b, 0, 0.46 * b); parca(0.06 * b, 0, 0.055 * b, 0.065 * b, 0, 0.46 * b);   // bacaklar (üst halka gövdenin alt kapağında)
  { const [gx, , gz] = R(0, 0, 0); prizma(T, gx, gz, 0.13 * b, y + 0.46 * b, y + 0.8 * b, n, "demir", ton, { r1: 0.16 * b, faz: -yon, kapak: true, alt: true }); }   // gövde
  const [hx, , hz] = R(0, 0, 0);
  prizma(T, hx, hz, 0.075 * b, y + 0.8 * b, y + 0.92 * b, n, "demir", ton, { faz: -yon });                       // baş (düz yüzlü, özelliksiz)
  koni(T, hx, hz, 0.075 * b, y + 0.92 * b, y + 1.0 * b, n, "demir", ton, -yon);                                   // yumuşak tepe
  for (const sy of [-1, 1]) {   // kollar: sy=+1 kolu `kol` açısıyla kalkık (işaret/bayrak duruşu)
    const kalk = sy > 0 ? kol : 0, bx = sy * 0.14 * b, by = 0.76 * b, uzun = 0.4 * b;   // omuz gövdenin içinde başlar
    const ex = bx + sy * Math.sin(kalk) * uzun, ey = by - Math.cos(kalk) * uzun;
    const [p0x, , p0z] = R(bx, 0, 0), [p1x, , p1z] = R(ex, 0, 0);
    yonlu(T, [V(p0x, y + by, p0z), V(p1x, y + ey, p1z), V(p1x + s * 0.05 * b, y + ey, p1z + c * 0.05 * b), V(p0x + s * 0.05 * b, y + by, p0z + c * 0.05 * b)], [s, 0, c], "demir", ton, {}, true);
    yonlu(T, [V(p0x, y + by, p0z), V(p1x, y + ey, p1z), V(p1x - s * 0.05 * b, y + ey, p1z - c * 0.05 * b), V(p0x - s * 0.05 * b, y + by, p0z - c * 0.05 * b)], [-s, 0, -c], "demir", ton, {}, true);
  }
  if (pelerin) {   // pelerin hattı: omuzdan arkaya-aşağı genişleyen iki yüzlü yüzey
    const yy = 0.8 * b + 0.004, yaka = [R(-0.1 * b, yy, -0.1 * b), R(0.1 * b, yy, -0.1 * b), R(0.1 * b, yy, -0.17 * b), R(-0.1 * b, yy, -0.17 * b)];   // yaka: gövde kapağının üstünde, sırta taşar
    yonlu(T, yaka, [0, 1, 0], "demir", ton, {}, true);
    const q = [yaka[3], yaka[2], R(0.26 * b, 0.12 * b, -0.34 * b), R(-0.26 * b, 0.12 * b, -0.34 * b)];   // yakadan aşağı: gövdenin dışında kalır
    yonlu(T, q, [-s, 0, -c], "demir", ton, {}, true); yonlu(T, q, [s, 0.2, c], "demir", ton, {}, true);
  }
}

// ================================================================ §C.1 — AKM
/**
 * Atatürk Kültür Merkezi: meydana bakan tam cam cephe (dikey dikme ritmi, kat bantları), camın ardında KIRMIZI SERAMİK
 * YARIM KÜRE (opera salonu — imza, cephesinin önünde cam panosu yok: cam şeffaf okunur), yatay uzun kütle, düz çatı +
 * tesisat, cephede "AKM" harfleri (çubuk geometri, doku yok). Yerel: en × derinlik (X × Z), +Z meydana bakar.
 */
function akm(T, p, lod) {
  const { en: W, derinlik: D, yukseklik: H } = p.ayakizi, A = p.akm ?? {}, katS = A.kat ?? 4;
  const tas = C("#D9D4CA"), tasKoyu = C("#BDB7AC"), dikme = C("#3C444E"), cam = C("#BFDDEB"), ic = C("#F1E7D6"), kirmizi = C("#C8102E"), kirmiziKoyu = C("#A50F26");
  const z1 = D / 2, lobi = 6.5, z0 = z1 - lobi, podyum = 0.6, Rk = A.kubbe_r ?? 7.2, yk = podyum + (A.kubbe_y ?? 7.5);
  // podyum
  T.kutu(W + 2, podyum, D + 2, 0, podyum / 2, 0, "tas", C("#CFC8BB"), { yuz: "XxYZz", dolu: lod === 0 });
  if (lod === 2) {   // uzak: kütle + cam yüz tonu + kubbe silueti
    T.kutu(W, H - podyum, D, 0, podyum + (H - podyum) / 2, 0, "cerceve", tas, { yuz: "XxYz" });
    fdik(T, cephe("Z+", z1), -W / 2, W / 2, podyum, H, 0, "cam", C("#9CC3D6"), { bolge: BOLGE.cam });
    kubbe(T, 0, yk, z0, Rk, 8, 3, "bayrak", () => kirmizi, { eksen: "z" });
    return;
  }
  // arka kütle (z ≤ z0) + lobi yan kapakları + çatı
  T.kutu(W, H - podyum, D - lobi, 0, podyum + (H - podyum) / 2, (z0 - D / 2) / 2, "cerceve", tas, { yuz: "XxYz" });
  for (const s of [-1, 1]) (s < 0 ? duseyx : duseyX)(T, s * W / 2, z0, z1, podyum, H, "cerceve", tasKoyu);
  T.kutu(W + 0.6, 0.8, lobi + 0.4, 0, H + 0.4 - 0.8, z0 + lobi / 2 + 0.2, "cerceve", tasKoyu, { yuz: "XxYZy" });   // saçak / çatı levhası
  duseyZ(T, z0, -W / 2, W / 2, podyum, H - 0.8, "cerceve", ic);   // lobinin iç duvarı (aydınlık)
  // kat döşemeleri: kubbenin önünde kesik
  const kh = (H - podyum) / katS;
  for (let k = 1; k < katS; k++) {
    const y = podyum + k * kh;
    for (const [a0, a1] of [[-W / 2, -Rk - 0.6], [Rk + 0.6, W / 2]]) T.kutu(a1 - a0, 0.45, lobi - 0.4, (a0 + a1) / 2, y, z0 + (lobi - 0.4) / 2, "cerceve", tas, { yuz: "YZy" });
    // kubbe çevresinde döşeme kenarı (kubbeye değen kısa parça)
    const dz = Math.max(0, Rk * Rk - (y - yk) ** 2);
    if (dz > 0) { const kalan = Math.sqrt(dz); if (kalan < Rk + 0.6) for (const s of [-1, 1]) T.kutu(Rk + 0.6 - kalan + 0.2, 0.45, lobi - 0.4, s * (kalan - 0.1 + (Rk + 0.6 - kalan + 0.2) / 2), y, z0 + (lobi - 0.4) / 2, "cerceve", tas, { yuz: "YZy" }); }
  }
  // kırmızı seramik yarım küre (opera salonu): enlem bantları iki ton — seramik karo sırası
  kubbe(T, 0, yk, z0, Rk, lod === 0 ? 20 : 12, lod === 0 ? 8 : 5, "bayrak", (i, j) => (j % 2 ? kirmiziKoyu : kirmizi), { eksen: "z" });
  // cam cephe: dikmeler + kat bantları; cam panoları yalnız kubbenin ÖNÜNDE değil (orası şeffaf okunur)
  const F = cephe("Z+", z1), adim = (A.dikme_araligi ?? 2.6) * (lod === 0 ? 1 : 2), n = Math.round(W / adim), bw = W / n;
  for (let i = 0; i <= n; i++) fkutu(T, F, -W / 2 + i * bw, podyum + (H - 0.8 - podyum) / 2, lod === 0 ? 0.28 : 0.35, H - 0.8 - podyum, -0.35, 0.05, "metal", dikme, { alt: false });
  for (let k = 0; k <= katS; k++) fkutu(T, F, 0, podyum + k * kh - (k === katS ? 0.4 : 0), W, k === 0 || k === katS ? 0.5 : 0.35, -0.45, 0.02, "metal", dikme);
  for (let k = 0; k < katS; k++) for (let i = 0; i < n; i++) {
    const a0 = -W / 2 + i * bw, a1 = a0 + bw, y0 = podyum + k * kh, y1 = y0 + kh;
    if (Math.max(Math.abs(a0), Math.abs(a1)) < Rk + bw && Math.min(Math.abs(a0), Math.abs(a1)) < Rk + 0.5 && y0 < yk + Rk && y1 > yk - Rk) continue;   // kubbenin önü: cam yok
    fdik(T, F, a0 + 0.14, a1 - 0.14, y0 + 0.2, y1 - 0.2, -0.15, "cam", cam, { bolge: BOLGE.cam, dolu: lod === 0 });
  }
  // "AKM" harfleri: en üst kat bandının önünde, sağ yarıda (çubuk geometri)
  if (A.yazi !== "") {
    const hb = 2.4, ha = W / 2 - 9.5, hy = H - 0.8 - kh / 2 - 0.2, k = 0.42, d = 0.055, ton = C("#F7F4EE");
    const A0 = ha - 4.2; fcubuk(T, F, A0 - 1.0, hy - hb / 2, A0, hy + hb / 2, k, d, "cerceve", ton); fcubuk(T, F, A0, hy + hb / 2, A0 + 1.0, hy - hb / 2, k, d, "cerceve", ton); fcubuk(T, F, A0 - 0.55, hy - 0.2, A0 + 0.55, hy - 0.2, k * 0.8, d, "cerceve", ton);
    const K0 = ha - 1.3; fcubuk(T, F, K0, hy - hb / 2, K0, hy + hb / 2, k, d, "cerceve", ton); fcubuk(T, F, K0 + 0.1, hy, K0 + 1.1, hy + hb / 2, k, d, "cerceve", ton); fcubuk(T, F, K0 + 0.25, hy + 0.15, K0 + 1.1, hy - hb / 2, k, d, "cerceve", ton);
    harfM(T, (u, v) => F.P(ha + 2.4 + u, hy + v, d), hb, ton);
  }
  // çatı: parapet + asansör kulesi + havalandırma
  const cy = H;
  if (lod === 0) for (const [a, dd, w2, d2] of [[0, -D / 2 + 0.15, W, 0.3], [0, z1 - 0.15, W, 0.3]]) T.kutu(w2, 0.9, d2, a, cy + 0.45, dd, "cerceve", tasKoyu, { yuz: "XxYZz" });
  T.kutu(6, 3.2, 4.5, -W / 4, cy + 1.6, -D / 4, "cerceve", tasKoyu, { yuz: "XxYZz" });
  for (let i = 0; i < (lod === 0 ? 4 : 2); i++) T.kutu(2.4, 1.3, 2.4, W / 6 + i * 3.6, cy + 0.65, -D / 5, "metal", C("#B8BEC4"), { yuz: "XxYZz" });
}

// ================================================================ §C.2 — TAKSİM CAMİİ
/**
 * Modern Taksim Camii: kesme taş harim + kemerli açıklıklar, kasnak, tek büyük KABURGALI kubbe + alem, iki ince
 * tek şerefeli minare (sade külah), meydana bakan kemerli son cemaat terası, alçak duvarlı avlu + şadırvan.
 * Yerel: ayak izi (X × Z), +Z meydana bakar. Girilemez: çarpışma ayak izi kutusu (avlu dahil) — yerlesimDunya.
 */
function cami(T, p, lod) {
  const { en: W, derinlik: D } = p.ayakizi, K = p.cami ?? {}, h = K.harim ?? 15, hh = K.harim_yukseklik ?? 8, Rk = K.kubbe_r ?? 6.6;
  const tas = C("#EFE3CB"), tasAcik = C("#F7F0E1"), koyu = C("#3A3530"), kubbeTon = C("#AEB7BE"), kubbeAcik = C("#CCD3D8"), altin = C("#E0B84A");
  const zb = -D / 2, zh = zb + h, zp = zh + 3.6, cz = zb + h / 2;   // harim arkası, harim önü, revak önü, kubbe merkezi z
  // harim
  { const nu = lod === 0 ? Math.round(h / 1.6) : 1, nv = lod === 0 ? Math.round(hh / 1.6) : 1, o = { nu, nv, dolu: lod === 0 };
    duseyX(T, h / 2, cz - h / 2, cz + h / 2, 0, hh, "tas", tas, o); duseyx(T, -h / 2, cz - h / 2, cz + h / 2, 0, hh, "tas", tas, o);
    duseyZ(T, cz + h / 2, -h / 2, h / 2, 0, hh, "tas", tas, o); duseyz(T, cz - h / 2, -h / 2, h / 2, 0, hh, "tas", tas, o);
    yatay(T, -h / 2, h / 2, cz - h / 2, cz + h / 2, hh, "tas", tas); }
  if (lod === 2) {
    prizma(T, 0, cz, Rk * 0.92, hh, hh + 1.6, 8, "tas", tas);
    kubbe(T, 0, hh + 1.6, cz, Rk, 10, 3, "metal", () => kubbeTon);
    T.kutu(h, 5, zp - zh, 0, 2.5, (zh + zp) / 2, "tas", tas, { yuz: "XxYZ" });
    for (const s of [-1, 1]) { prizma(T, s * (h / 2 + 2), zh - 1, 0.9, 0, (K.minare_yukseklik ?? 34) * 0.86, 6, "siva", tasAcik); koni(T, s * (h / 2 + 2), zh - 1, 1.0, (K.minare_yukseklik ?? 34) * 0.86, K.minare_yukseklik ?? 34, 6, "metal", kubbeTon); }
    return;
  }
  // harim yüzlerinde geniş kemerli açıklıklar (koyu iç + taş söve)
  for (const [yuz, c] of [["X+", h / 2], ["X-", -h / 2], ["Z-", -(zb)]]) {
    const F = yuz === "Z-" ? cephe("Z-", zb) : cephe(yuz, c);
    const merkez = yuz === "Z-" ? 0 : -cz * (yuz === "X+" ? 1 : -1);   // X yüzlerinde a ekseni −z (X+) / +z (X−)
    for (const i of [-1, 0, 1]) {
      const a = merkez + i * 4.4, w = i === 0 ? 3.4 : 2.8, hk = i === 0 ? 6.2 : 5.2;
      fkemer(T, F, a, 0.6, w, hk, 0.004, "cerceve", koyu, lod === 0 ? 6 : 3);
      if (lod === 0) fkemerCerceve(T, F, a, 0.6, w, hk, 0.28, 0.008, "tasAcik", tasAcik, 6);
    }
  }
  // kasnak + pencereler + kaburgalı kubbe + alem
  const ky = hh, kh = 1.8, kn = lod === 0 ? 16 : 8;
  prizma(T, 0, cz, Rk * 0.96, ky, ky + kh, kn, "tas", tasAcik, { faz: Math.PI / kn });
  if (lod === 0) for (let i = 0; i < 8; i++) {   // kasnak pencereleri (koyu, sivri tepe)
    const f = ((i * 2 + 0.5) / kn) * Math.PI * 2 + Math.PI / kn, r = Rk * 0.96 * Math.cos(Math.PI / kn) + 0.004, dx = Math.cos(f), dz = Math.sin(f), tx = -dz, tz = dx, w = 0.55;
    const P = (u, v) => V(dx * r + tx * u, ky + v, cz + dz * r + tz * u);
    yonlu(T, [P(-w, 0.35), P(w, 0.35), P(w, 1.15), P(-w, 1.15)], [dx, 0, dz], "cerceve", koyu, {}, true);
    ucgenYon(T, [P(-w, 1.15), P(w, 1.15), P(0, 1.5)], [dx, 0, dz], "cerceve", koyu);
  }
  halka(T, 0, cz, Rk * 0.9, Rk * 1.05, ky + kh + 0.05, 0.25, kn, "tasAcik", tasAcik);
  const nLon = lod === 0 ? (K.kaburga ?? 20) * 2 : 20;
  kubbe(T, 0, ky + kh, cz, Rk, nLon, lod === 0 ? 6 : 4, "metal", (i) => (i % 2 === 0 ? kubbeAcik : kubbeTon), { kab: lod === 0 ? 0.035 : 0 });
  prizma(T, 0, cz, 0.18, ky + kh + Rk - 0.1, ky + kh + Rk + 0.6, 6, "altin", altin);
  prizma(T, 0, cz, 0.18, ky + kh + Rk + 0.6, ky + kh + Rk + 0.9, 6, "altin", altin, { r1: 0.35 });
  koni(T, 0, cz, 0.35, ky + kh + Rk + 0.9, ky + kh + Rk + 1.8, 6, "altin", altin);
  // son cemaat terası (revak): döşeme, 5 kemer, dikmeler, çatı
  const Fr = cephe("Z+", zp), rh = 5.2, nk = 5, kw = h / nk;
  T.kutu(h, 0.3, zp - zh, 0, 0.15, (zh + zp) / 2, "tasAcik", tasAcik, { yuz: "XxYZ" });
  T.kutu(h + 0.4, 0.6, zp - zh + 0.3, 0, rh + 0.3, (zh + zp) / 2 + 0.15, "tas", tas, { yuz: "XxYZzy", dolu: lod === 0 });
  for (let i = 0; i <= nk; i++) fkutu(T, Fr, -h / 2 + i * kw, rh / 2, 0.55, rh, -0.55, 0, "tas", tas);
  for (let i = 0; i < nk; i++) {   // kemer alınlıkları: ayak üstünden yay + yayın üstü dolgu
    const a = -h / 2 + (i + 0.5) * kw, r = (kw - 0.55) / 2, by = rh - 0.25 - r, n = lod === 0 ? 6 : 3;
    for (let j = 0; j < n; j++) {
      const f0 = Math.PI * (j / n), f1 = Math.PI * ((j + 1) / n), pa = (f) => Fr.P(a + Math.cos(f) * r, by + Math.sin(f) * r, 0);
      const tepe = (f) => Fr.P(a + Math.cos(f) * r, rh, 0);
      yonlu(T, [pa(f0), tepe(f0), tepe(f1), pa(f1)], Fr.n, "tas", tas, {}, true);
    }
    if (lod === 0) fkemerCerceve(T, Fr, a, 0.3, r * 2, rh - 0.25 - 0.3, 0.14, 0.006, "tasAcik", tasAcik, 6);
  }
  duseyZ(T, zh + 0.02, -h / 2, h / 2, 0.3, rh, "tas", tas.clone().multiplyScalar(0.8));   // revak arkası (harim ön duvarı, gölgede)
  fkemer(T, cephe("Z+", zh + 0.03), 0, 0.3, 2.4, 3.8, 0, "cerceve", koyu, 6);            // ana kapı
  // minareler: tek şerefe, sade külah
  const mh = K.minare_yukseklik ?? 34, mr = K.minare_r ?? 0.9;
  for (const s of [-1, 1]) {
    const mx = s * (h / 2 + 2), mz = zh - 1, n = lod === 0 ? 8 : 6;
    prizma(T, mx, mz, mr * 1.35, 0, 2.2, n, "tas", tas, { r1: mr });
    prizma(T, mx, mz, mr, 2.2, mh * 0.74, n, "siva", tasAcik);
    halka(T, mx, mz, mr * 0.82, mr * 1.9, mh * 0.74 + 0.35, 0.35, n, "tasAcik", tasAcik);   // şerefe
    if (lod === 0) for (let i = 0; i < n; i++) {   // şerefe korkuluğu (yalnız yakın)
      const f0 = (i / n) * Math.PI * 2, f1 = ((i + 1) / n) * Math.PI * 2, fm = (f0 + f1) / 2, r = mr * 1.9, y0 = mh * 0.74 + 0.35, P = (f, yy) => V(mx + Math.cos(f) * r, yy, mz + Math.sin(f) * r);
      yonlu(T, [P(f0, y0), P(f1, y0), P(f1, y0 + 0.85), P(f0, y0 + 0.85)], [Math.cos(fm), 0, Math.sin(fm)], "tasAcik", tasAcik, {}, true);
      yonlu(T, [P(f0, y0), P(f1, y0), P(f1, y0 + 0.85), P(f0, y0 + 0.85)], [-Math.cos(fm), 0, -Math.sin(fm)], "tasAcik", tasAcik.clone().multiplyScalar(0.85), {}, true);
    }
    prizma(T, mx, mz, mr * 0.82, mh * 0.74 + 0.35, mh * 0.86, n, "siva", tasAcik);
    koni(T, mx, mz, mr * 0.82, mh * 0.86, mh, n, "metal", kubbeTon);
    { const yk = mh - 0.6, rk = mr * 0.82 * (0.6 / (mh - mh * 0.86)); prizma(T, mx, mz, rk, yk, mh + 1.1, 4, "altin", altin, { r1: 0.05 }); }   // alem: külah yüzeyinden çıkar
  }
  // avlu: alçak duvar (ön kapı boşluklu) + şadırvan
  const dh = 1.3, ay = D / 2 - 0.3;
  for (const [a0, a1] of [[-W / 2, -1.8], [1.8, W / 2]]) T.kutu(a1 - a0, dh, 0.6, (a0 + a1) / 2, dh / 2, ay, "tas", tas, { yuz: "XxYZz" });
  for (const s of [-1, 1]) T.kutu(0.6, dh, D - 0.6, s * (W / 2 - 0.3), dh / 2, 0, "tas", tas, { yuz: "XxYZz" });
  T.kutu(W - 1.2, 0.08, zp - zh + (ay - zp), 0, 0.04, (zp + ay) / 2, "tasAcik", tasAcik, { yuz: "Y" });
  const sz = (zp + ay) / 2, n8 = lod === 0 ? 8 : 6;
  prizma(T, 0, sz, 1.5, 0, 0.8, n8, "tas", tas, { kapak: true });
  if (lod === 0) for (let i = 0; i < n8; i++) { const f = (i / n8) * Math.PI * 2; prizma(T, Math.cos(f) * 1.3, sz + Math.sin(f) * 1.3, 0.1, 0.8, 2.6 + (1 - 1.3 / 2.0) * 1.2 + 0.05, 4, "tasAcik", tasAcik); }
  koni(T, 0, sz, 2.0, 2.6, 3.8, n8, "metal", kubbeTon, Math.PI / n8);
}

// ================================================================ §C.3 — CUMHURİYET ANITI
/**
 * Yuvarlak basamaklı platform (yürünür), dikdörtgen taş kaide + iki yüzde kemerli çerçeve ve sütunlar, üstünde heykel
 * grubu ve kemer nişlerinde figürler. ⚠ Heykeller SİLUET: HİÇBİR LOD'da yüz detayı yok (bkz. figur()).
 */
function anit(T, p, lod) {
  const A = p.anit ?? {}, R = A.platform_r ?? 6.3, nb = A.basamak ?? 3, bh = A.basamak_yukseklik ?? 0.12, K = A.kaide ?? { en: 4.6, derinlik: 3.4, yukseklik: 7.2 };
  const tas = C("#D9CFBD"), tasAcik = C("#E9E1D2"), tasKoyu = C("#B9AE99"), bronz = C("#8E8B70"), koyu = C("#5E5648");
  const n = lod === 0 ? 28 : lod === 1 ? 16 : 10;
  // platform basamakları: iç içe halkalar
  for (let i = 0; i < nb; i++) {
    const ri = R - (i + 1) * 0.65, ro = R - i * 0.65, y = (i + 1) * bh;
    for (let j = 0; j < n; j++) {
      const f0 = (j / n) * Math.PI * 2, f1 = ((j + 1) / n) * Math.PI * 2, fm = (f0 + f1) / 2, P = (f, r, yy) => V(Math.cos(f) * r, yy, Math.sin(f) * r);
      yonlu(T, [P(f0, i === nb - 1 ? 0 : ri, y), P(f1, i === nb - 1 ? 0 : ri, y), P(f1, ro, y), P(f0, ro, y)], [0, 1, 0], "tasAcik", i % 2 ? tas : tasAcik, { dolu: false }, true);
      yonlu(T, [P(f0, ro, y - bh), P(f1, ro, y - bh), P(f1, ro, y), P(f0, ro, y)], [Math.cos(fm), 0, Math.sin(fm)], "tas", tasKoyu, {}, true);
    }
  }
  const y0 = nb * bh, H = K.yukseklik, kw = K.en, kd = K.derinlik;
  // kaide gövdesi
  T.kutu(kw + 0.5, 0.7, kd + 0.5, 0, y0 + 0.35, 0, "tas", tasKoyu, { yuz: "XxYZz", dolu: lod === 0 });
  T.kutu(kw, H - 0.7, kd, 0, y0 + 0.7 + (H - 0.7) / 2, 0, "tas", tas, { yuz: "XxZz", dolu: lod === 0 });
  T.kutu(kw + 0.7, 0.55, kd + 0.7, 0, y0 + H + 0.27, 0, "tas", tasAcik, { yuz: "XxYZzy", dolu: lod === 0 });   // korniş
  T.kutu(kw * 0.72, 0.9, kd * 0.72, 0, y0 + H + 0.55 + 0.45, 0, "tas", tas, { yuz: "XxYZz" });                // üst kaide
  const ust = y0 + H + 1.45;
  if (lod === 2) { prizma(T, 0, 0, 0.55, ust, ust + (A.heykel_yukseklik ?? 3.4), 4, "demir", bronz, { r1: 0.25 }); return; }
  // ön ve arka yüz: kemerli çerçeve + iki yanda sütun + nişte figür
  for (const [yuz, c] of [["Z+", kd / 2], ["Z-", -kd / 2]]) {
    const F = cephe(yuz, c), aw = kw * 0.52, ah = H * 0.72;
    fkemer(T, F, 0, y0 + 0.9, aw, ah, 0.004, "tas", koyu, lod === 0 ? 6 : 3);
    if (lod === 0) fkemerCerceve(T, F, 0, y0 + 0.9, aw, ah, 0.22, 0.008, "tasAcik", tasAcik, 6);
    for (const s of [-1, 1]) {
      const [sx, , sz] = F.P(s * (kw / 2 - 0.45), 0, 0.28);
      prizma(T, sx, sz, 0.3, y0 + 0.7, y0 + H - 0.1, lod === 0 ? 8 : 5, "tasAcik", tasAcik);
      if (lod === 0) { prizma(T, sx, sz, 0.42, y0 + H - 0.45, y0 + H - 0.1, 8, "tasAcik", tasAcik, { kapak: true }); prizma(T, sx, sz, 0.42, y0 + 0.7, y0 + 1.05, 8, "tasAcik", tasAcik, { kapak: true }); }
    }
    const [nx, , nz] = F.P(0, 0, 0.9), [px, , pz] = F.P(0, 0, 0.6), yon = yuz === "Z+" ? 0 : Math.PI;
    T.kutu(1.2, 0.5, 1.2, px, y0 + 0.95, pz, "tas", tasKoyu, { yuz: "XxYZz" });   // figür kaidesi (duvara dayalı)
    figur(T, nx, y0 + 1.2, nz, 2.5, { yon, lod, ton: bronz, kol: 0.3 });
  }
  // üst heykel grubu: ortada yüksek figür, iki yanda daha alçak iki figür (hepsi siluet)
  const hb = A.heykel_yukseklik ?? 3.4;
  figur(T, 0, ust, 0.1, hb, { yon: 0, lod, ton: bronz, kol: 0.9 });
  figur(T, -1.1, ust, -0.7, hb * 0.82, { yon: 0.35, lod, ton: bronz, pelerin: lod === 0 });
  figur(T, 1.1, ust, -0.7, hb * 0.82, { yon: -0.35, lod, ton: bronz, pelerin: lod === 0 });
}

// ================================================================ §C.4 — GALATASARAY LİSESİ
/**
 * Sokağa bakan yüksek demir parmaklıklı bahçe duvarı (bina geride), anıtsal taş kemerli ana kapı (sütun + kemer +
 * stilize kırmızı-sarı amblem — gerçek arma DEĞİL), geride simetrik krem-sarı ana bina, bahçede bayrak direği.
 * Girilebilir (mod /profil): kapı + tabela plakası + ışıyan aplikler kapıda (§C.2 kuralı). Kapı `kapi_x` kadar kayık.
 * Bahçe ağaçları cevre.js'te mevcut ağaç örnekleriyle (parsel.bahce_agaclari).
 */
function lise(T, p, lod) {
  const { en: W, derinlik: D, yukseklik: H } = p.ayakizi, kx = p.kapi_x ?? 0, zf = D / 2;
  const tas = C("#E3D9C4"), tasKoyu = C("#C4B89F"), krem = C("#F2DC9E"), kremKoyu = C("#E2C77E"), demir = C("#23282C"), cati = C("#6F7B86");
  const kirmizi = C("#C8102E"), sari = C("#F2B705"), cam = C("#CFE3EE"), cim = C("#A4C48B");
  const zb0 = -D / 2, zb1 = zb0 + 11, bh = H - 1.5, bw = W - 2;   // ana bina: arka 11 m
  // bahçe zemini + yol
  T.dortgen([[-W / 2, 0.02, zf], [W / 2, 0.02, zf], [W / 2, 0.02, zb1], [-W / 2, 0.02, zb1]], "cim", cim, { dolu: false });
  T.dortgen([[kx - 1.4, 0.035, zf], [kx + 1.4, 0.035, zf], [kx + 1.4, 0.035, zb1 + 3.5], [kx - 1.4, 0.035, zb1 + 3.5]], "tasAcik", tas);
  T.dortgen([[kx - 1.4, 0.036, zb1 + 3.5], [1.6, 0.036, zb1 + 3.5], [1.6, 0.036, zb1], [kx - 1.4, 0.036, zb1]], "tasAcik", tas);
  // ---- ana bina: gövde, merkez çıkıntı + alınlık, pencere dizisi, korniş, kırma çatı
  T.kutu(bw, bh, zb1 - zb0, 0, bh / 2, (zb0 + zb1) / 2, "siva", krem, { yuz: "XxZz" });
  const F = cephe("Z+", zb1), katS = 3, kh = (bh - 1.2) / katS, aks = lod === 2 ? 0 : 9, ab = (bw - 1) / aks;
  if (lod < 2) {
    fkutu(T, F, 0, bh / 2, 6, bh, 0, 0.8, "siva", kremKoyu, { alt: false });   // merkez çıkıntı
    fdik(T, F, -bw / 2, bw / 2, 0, 1.2, 0.03, "tas", tasKoyu, { dolu: lod === 0 });   // subasman
    for (let k = 0; k < katS; k++) for (let i = 0; i < aks; i++) {
      const a = -bw / 2 + 0.5 + ab * (i + 0.5), y = 1.2 + k * kh + kh * 0.22, ww = 1.15, wh = kh * 0.58, d = Math.abs(a) < 3.1 ? 0.8 : 0;   // duvar yüzü (merkez çıkıntıda 0,8)
      if (k === 0 && i === (aks - 1) / 2) { fkemer(T, F, a, 1.2, 2.2, kh * 0.9, d + 0.004, "cerceve", demir, 6); if (lod === 0) fkemerCerceve(T, F, a, 1.2, 2.2, kh * 0.9, 0.22, d + 0.008, "tasAcik", tas, 6); continue; }   // bina kapısı
      if (lod === 0) fdik(T, F, a - ww / 2 - 0.16, a + ww / 2 + 0.16, y - 0.16, y + wh + 0.16, d + 0.004, "cerceve", C("#FFFFFF"));
      fdik(T, F, a - ww / 2, a + ww / 2, y, y + wh, d + 0.008, "cam", cam, { bolge: BOLGE.cam });
    }
    for (const b of [1.2, 1.2 + kh, 1.2 + kh * 2]) fkutu(T, F, 0, b, bw + 0.3, 0.22, -0.02, 0.15, "tasAcik", tas);   // kat silmeleri
    // alınlık (merkez çıkıntının tepesinde üçgen) + amblem
    const ay = bh, ap = F.P(0, 0, 0.805)[2];
    ucgenYon(T, [V(-3.4, ay, ap), V(3.4, ay, ap), V(0, ay + 2.2, ap)], [0, 0, 1], "siva", kremKoyu);
    const am = (r, ton, dd, nn = 12) => { for (let i = 0; i < nn; i++) { const f0 = (i / nn) * Math.PI * 2, f1 = ((i + 1) / nn) * Math.PI * 2; ucgenYon(T, [V(0, ay + 0.85, ap + dd), V(Math.cos(f0) * r, ay + 0.85 + Math.sin(f0) * r, ap + dd), V(Math.cos(f1) * r, ay + 0.85 + Math.sin(f1) * r, ap + dd)], [0, 0, 1], "cerceve", ton); } };
    am(0.6, sari, 0.004); am(0.36, kirmizi, 0.008);
  }
  T.kutu(bw + 0.6, 0.5, zb1 - zb0 + 0.6, 0, bh + 0.25, (zb0 + zb1) / 2, "tasAcik", tas, { yuz: "XxZzy" });   // korniş
  const cy = bh + 0.5, cyk = 2.6, ic = 2.4, hx = bw / 2 + 0.3, hz0 = zb0 - 0.3, hz1 = zb1 + 0.3;
  yonlu(T, [V(-hx, cy, hz1), V(hx, cy, hz1), V(hx - ic, cy + cyk, hz1 - ic), V(-hx + ic, cy + cyk, hz1 - ic)], [0, 0.7, 1], "cerceve", cati, {}, true);
  yonlu(T, [V(hx, cy, hz0), V(-hx, cy, hz0), V(-hx + ic, cy + cyk, hz0 + ic), V(hx - ic, cy + cyk, hz0 + ic)], [0, 0.7, -1], "cerceve", cati, {}, true);
  yonlu(T, [V(hx, cy, hz1), V(hx, cy, hz0), V(hx - ic, cy + cyk, hz0 + ic), V(hx - ic, cy + cyk, hz1 - ic)], [1, 0.7, 0], "cerceve", cati.clone().multiplyScalar(0.9), {}, true);
  yonlu(T, [V(-hx, cy, hz0), V(-hx, cy, hz1), V(-hx + ic, cy + cyk, hz1 - ic), V(-hx + ic, cy + cyk, hz0 + ic)], [-1, 0.7, 0], "cerceve", cati.clone().multiplyScalar(0.9), {}, true);
  yonlu(T, [V(-hx + ic, cy + cyk, hz1 - ic), V(hx - ic, cy + cyk, hz1 - ic), V(hx - ic, cy + cyk, hz0 + ic), V(-hx + ic, cy + cyk, hz0 + ic)], [0, 1, 0], "cerceve", cati.clone().multiplyScalar(0.8), {}, true);
  // ---- bahçe duvarı + parmaklık (sokak cephesi + iki yan)
  const pd = 0.9, ph = 3.4, Fs = cephe("Z+", zf), kapiY = 2.9;
  const parmaklik = (F2, a0, a1, d0) => {
    if (a1 - a0 < 0.3) return;
    fkutu(T, F2, (a0 + a1) / 2, pd / 2, a1 - a0, pd, d0 - 0.6, d0, "tas", tas, { dolu: lod === 0, alt: false });
    fkutu(T, F2, (a0 + a1) / 2, ph - 0.08, a1 - a0, 0.08, d0 - 0.35, d0 - 0.25, "metal", demir);
    if (lod === 0) { const nb = Math.round((a1 - a0) / 0.32); for (let i = 1; i < nb; i++) fkutu(T, F2, a0 + ((a1 - a0) * i) / nb, (pd + ph) / 2, 0.05, ph - pd, d0 - 0.33, d0 - 0.27, "metal", demir, { alt: false }); fkutu(T, F2, (a0 + a1) / 2, pd + 0.35, a1 - a0, 0.07, d0 - 0.35, d0 - 0.25, "metal", demir); }
    else fdik(T, F2, a0, a1, pd, ph, d0 - 0.3, "metal", demir.clone().lerp(C("#8FA0A8"), 0.35));   // orta: tek levha
    const ns = Math.max(1, Math.round((a1 - a0) / 4.2));
    for (let i = 0; i <= ns; i++) fkutu(T, F2, a0 + ((a1 - a0) * i) / ns, (ph + 0.4) / 2, 0.7, ph + 0.4, d0 - 0.65, d0 + 0.05, "tas", tasKoyu, { alt: false });   // taş ayaklar
  };
  const gw = 5.5;
  parmaklik(Fs, -W / 2, kx - gw / 2 - 0.65, 0); parmaklik(Fs, kx + gw / 2 + 0.65, W / 2, 0);
  parmaklik(cephe("X+", W / 2), -zf, -zb1, 0); parmaklik(cephe("X-", -W / 2), zb1, zf, 0);
  // ---- anıtsal kapı: iki sütun + yarım daire kemer + saçak + amblem + tabela plakası + aplikler + demir kanat
  for (const s of [-1, 1]) fkutu(T, Fs, kx + s * (gw / 2 + 0.65), kapiY + 1.4, 1.3, (kapiY + 1.4) * 2, -1.0, 0.35, "tas", tas, { dolu: lod === 0, alt: false });
  const kr = gw / 2, ky = kapiY * 2 + 1.4 - 0.9, n = lod === 0 ? 8 : 4;
  for (let j = 0; j < n; j++) {   // kemer halkası (ön, alt, arka yüz) + alınlık dolgusu
    const f0 = Math.PI * (j / n), f1 = Math.PI * ((j + 1) / n), P = (f, r, d) => Fs.P(kx + Math.cos(f) * r, ky + Math.sin(f) * r, d);
    yonlu(T, [P(f0, kr, 0.35), P(f0, kr + 0.9, 0.35), P(f1, kr + 0.9, 0.35), P(f1, kr, 0.35)], Fs.n, "tas", tas, {}, true);
    yonlu(T, [P(f0, kr, -1.0), P(f1, kr, -1.0), P(f1, kr, 0.35), P(f0, kr, 0.35)], [0, -1, 0], "tas", tasKoyu, {}, true);
    const tepe = (f) => Fs.P(kx + Math.cos(f) * (kr + 0.9), ky + kr + 1.6, 0.35);
    yonlu(T, [P(f0, kr + 0.9, 0.35), tepe(f0), tepe(f1), P(f1, kr + 0.9, 0.35)], Fs.n, "tas", tas, {}, true);
  }
  fkutu(T, Fs, kx, ky + kr + 1.85, gw + 3.4, 0.5, -1.2, 0.55, "tasAcik", tasKoyu);   // saçak
  const amP = (u, v, d) => Fs.P(kx + u, ky + kr + 0.55 + v, d);
  for (const [r, ton, d] of [[0.72, sari, 0.354], [0.46, kirmizi, 0.358], [0.18, sari, 0.362]]) for (let i = 0; i < 12; i++) { const f0 = (i / 12) * Math.PI * 2, f1 = ((i + 1) / 12) * Math.PI * 2; ucgenYon(T, [amP(0, 0, d), amP(Math.cos(f0) * r, Math.sin(f0) * r, d), amP(Math.cos(f1) * r, Math.sin(f1) * r, d)], Fs.n, "cerceve", ton); }   // stilize amblem
  fkutu(T, Fs, kx, ky - 0.2, gw, 0.55, 0.3, 0.42, "cerceve", C("#8A8C96"));   // tabela plakası (mod rengi)
  if (lod === 0) for (const s of [-1, 1]) {   // aplikler (ışıyan)
    fkutu(T, Fs, kx + s * (gw / 2 + 0.65), kapiY + 0.9, 0.1, 0.1, 0.35, 0.65, "demir", demir);
    fkutu(T, Fs, kx + s * (gw / 2 + 0.65), kapiY + 0.6, 0.34, 0.5, 0.5, 0.84, "lamba", BEYAZ, { bolge: BOLGE.isik });
  }
  const kh2 = ky - 0.5;   // demir kapı kanatları (koyu yeşil-siyah, dikmeli)
  if (lod === 0) {   // yakın: dikmeli parmaklık kanat (arkası görünür) + üst/alt kayıt
    for (let i = 1; i < 14; i++) fkutu(T, Fs, kx - kr + (gw * i) / 14, kh2 / 2 + 0.1, 0.06, kh2, -0.3, -0.18, "metal", demir, { alt: false });
    for (const y of [0.35, kh2 * 0.55, kh2]) fkutu(T, Fs, kx, y, gw, 0.1, -0.32, -0.16, "metal", demir);
  } else fdik(T, Fs, kx - kr, kx + kr, 0.1, kh2, -0.3, "metal", C("#3B4A44"));
  // ---- bayrak direği + kırmızı-sarı bayrak
  const bx = 0.5, bz = zf - 2, dh = 12;
  prizma(T, bx, bz, 0.09, 0, dh, 4, "metal", C("#C9CED3"));
  if (lod < 2) { const q = (y0, y1, ton) => { const pts = [V(bx, y0, bz), V(bx + 2.6, y0, bz), V(bx + 2.6, y1, bz), V(bx, y1, bz)]; yonlu(T, pts, [0, 0, 1], "cerceve", ton, {}, true); yonlu(T, pts, [0, 0, -1], "cerceve", ton, {}, true); }; q(dh - 0.8, dh - 0.1, kirmizi); q(dh - 1.5, dh - 0.8, sari); }
}

export const YAPILAR = { metro, akm, cami, anit, lise };

/** CepheSistemi / cephe_ao.mjs girişi: yapı + LOD → dünya uzayında geometri. */
export function yapiGeometrisi(p, H, lod) {
  const T = new Toplayici(H);
  YAPILAR[p.yapi](T, p, lod);
  return T.geometri(p.capa.donus_y ?? 0, p.capa.konum[0], p.capa.konum[2]);
}

// ================================================================ §D — İSTİKLAL'İN AÇILAN UCU
/**
 * Sokağın ilerideki devamı: zemin şeridi + iki yanda giderek soluklaşan, detaysız bina siluetleri.
 * Parsel DEĞİL (çarpışma yok, yürünemez; sınır duvarı yerinde). Koridor bölgeden türetilir → bölge kaydırmasına uyar.
 * @returns {THREE.BufferGeometry|null} dünya uzayında (CevreArkaplan'a katılır)
 */
export function sokakDevami(M, H) {
  const T = new Toplayici(H);
  let var_ = false;
  for (const a of (M.arkaplan ?? []).filter((b) => b.tip === "siluet" && b.sokak)) {
    const k = (M.bolgeler ?? []).find((b) => b.id === a.sokak && b.sekil === "koridor");
    if (!k) { console.error?.("[Meydan] sokak devamı: koridor bölgesi yok:", a.sokak); continue; }
    const [x0, z0] = k.baslangic, [x1, z1] = k.bitis, L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const W = k.genislik, uzun = a.uzunluk ?? 110, t0 = L + (a.bosluk ?? 0), sis = C(a.sis_renk ?? "#CDEEFF");
    const P = (t, l, y) => [x0 + ux * t - uz * l, y, z0 + uz * t + ux * l];   // l>0: koridorun sol yanı (kaldırım a)
    // zemin: sokak şeridi (kaldırım tonu) + ortada asfalt/taş yol, uzaklaştıkça sise karışır
    const n = 4;
    for (let i = 0; i < n; i++) {
      const ta = L - 0.5 + (uzun * i) / n, tb = L - 0.5 + (uzun * (i + 1)) / n, f = (i + 0.5) / n;
      yonlu(T, [P(ta, W / 2, 0.006), P(ta, -W / 2, 0.006), P(tb, -W / 2, 0.006), P(tb, W / 2, 0.006)], [0, 1, 0], "cerceve", C("#E3DCCD").lerp(sis, f * 0.55), {}, true);
      yonlu(T, [P(ta, W / 2 - 2, 0.012), P(ta, -W / 2 + 2, 0.012), P(tb, -W / 2 + 2, 0.012), P(tb, W / 2 - 2, 0.012)], [0, 1, 0], "cerceve", C("#CFC8BA").lerp(sis, f * 0.55), {}, true);
    }
    // bina siluetleri: iki yan, deterministik genişlik/yükseklik. Yakın 35 m şehir tonunda (kat bantları + çatı), ötesi sise karışır.
    const TONLAR = ["#EAD9BE", "#DDC3A6", "#E4D2C4", "#D9CDB2"].map(C), CATI = ["#8C7F74", "#A45A45", "#7D8794"].map(C), SERIT = C("#9FA7AE");
    for (const yan of [1, -1]) {
      let t = t0 + (yan > 0 ? a.a_baslangic ?? 0 : a.b_baslangic ?? 0), i = 0;
      while (t < L + uzun) {
        const r = tohum(i * 3.1 + (yan > 0 ? 1 : 7), 11), en = 9 + r * 6, katS = 4 + Math.floor(tohum(i, yan) * 3), yuk = 3.6 + katS * 3.1, der = 12;
        const f = Math.max(0, Math.min(1, (t - L - (a.net ?? 35)) / (uzun - (a.net ?? 35))));   // 0 = net, 1 = tamamen sis
        const ton = TONLAR[(i + (yan > 0 ? 0 : 2)) % 4].clone().lerp(sis, f * 0.8), catiTon = CATI[(i + (yan > 0 ? 1 : 0)) % 3].clone().lerp(sis, f * 0.8);
        const l0 = yan * (W / 2), l1 = yan * (W / 2 + der), ta = t, tb = t + en;
        const orta = P((ta + tb) / 2, 0, yuk / 2);   // sokak ekseni: ön yüz buna bakar
        yonlu(T, [P(ta, l0, 0), P(tb, l0, 0), P(tb, l0, yuk), P(ta, l0, yuk)], orta, "cerceve", ton);
        yonlu(T, [P(ta, l0, 0), P(ta, l1, 0), P(ta, l1, yuk), P(ta, l0, yuk)], [-ux, 0, -uz], "cerceve", ton.clone().multiplyScalar(0.9), {}, true);
        yonlu(T, [P(tb, l0, 0), P(tb, l1, 0), P(tb, l1, yuk), P(tb, l0, yuk)], [ux, 0, uz], "cerceve", ton.clone().multiplyScalar(0.9), {}, true);
        yonlu(T, [P(ta, l0, yuk), P(tb, l0, yuk), P(tb, l1, yuk), P(ta, l1, yuk)], [0, 1, 0], "cerceve", catiTon, {}, true);
        if (f < 0.6) {   // kat bantları (pencere şeridi) — sokağa bakan yüzde, 2 cm önde
          const e = -yan * 0.02, bant = ton.clone().multiply(SERIT);
          for (let k = 0; k < katS; k++) { const y0 = 3.6 + k * 3.1 + 0.9; yonlu(T, [P(ta + 0.8, l0 + e, y0), P(tb - 0.8, l0 + e, y0), P(tb - 0.8, l0 + e, y0 + 1.3), P(ta + 0.8, l0 + e, y0 + 1.3)], orta, "cerceve", bant); }
          yonlu(T, [P(ta + 0.5, l0 + e, 0.3), P(tb - 0.5, l0 + e, 0.3), P(tb - 0.5, l0 + e, 3.0), P(ta + 0.5, l0 + e, 3.0)], orta, "cerceve", ton.clone().multiplyScalar(0.62));   // zemin kat (kepenk)
        }
        t = tb + 0.4 + tohum(i, 5) * 1.2; i++;
      }
    }
    var_ = true;
  }
  if (!var_) return null;
  const g = T.geometri(0, 0, 0);
  sokakDevami.son = { ucgen: T.ucgenSayisi };
  return g;
}
