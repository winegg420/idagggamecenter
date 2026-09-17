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

export const YAPILAR = { metro };

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
