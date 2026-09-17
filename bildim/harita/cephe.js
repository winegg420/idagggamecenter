// ============================================================
// CEPHE SİSTEMİ (Aşama 3A-1 §C) — MODÜLER PARÇA HAVUZU. Bina = parçaların dizilimi; 10 ayrı bina modeli YOK.
//
// Saf three.js + saf veri: DOM yok → aynı modül tarayıcıda (çalışma anı) ve Node'da (gömülü AO pişirme +
// muayene örnekleri: varlik/cephe_ao.mjs) çalışır. Köşe sırası iki tarafta birebir aynıdır; AO baytları buna dayanır.
//
// PARÇA HAVUZU (varyantlar `VARYANT`ta; hangi parselde hangisi → yerlesim.json › parsel.cephe reçetesi):
//   vitrin 4 · pencere 5 · balkon 3 · silme 2 · çatı 3 · tabela 2 · tente 3 · kapı 3
// Çeşitlilik = parça kombinasyonu + renk + tabela + cephe genişliği (aks sayısı) + kat sayısı.
//
// GİRİLEBİLİR ↔ GİRİLEMEZ (kural, §C.2): tabela + aydınlatma (ışıyan aplik) + belirgin kapı YALNIZ girilebilirde.
// Girilemez binada kapı, tabela, tente, aplik üretilmez — zemin kat kepenk ya da sağır duvardır.
//
// LOD (§C.4): 0 yakın = tam parçalar · 1 orta = aynı kompozisyon, düz dörtgenlere inmiş · 2 uzak = yalın kütle + çatı silueti.
// Tek atlas, tek malzeme: her yüz bir atlas hücresine UV'lenir, renk köşe rengiyle (ton × gömülü AO) gelir.
// Yerel eksen: +Z cephe (sokağa bakan yüz), X genişlik, Y yukarı; köken parsel çapası (ayak izi merkezi, zemin).
// ============================================================
import * as THREE from "three";
import { yapiGeometrisi, YAPILAR } from "./yapilar.js";

export const VARYANT = {
  vitrin: ["dukkan", "kafe", "dar", "kapali"],
  pencere: ["tek", "cift", "kemerli", "kepenkli", "giydirme"],
  balkon: ["yok", "cikma", "korkuluk"],
  silme: ["duz", "disli"],
  cati: ["kiremit", "duz", "cikmali"],
  tabela: ["bant", "asma"],
  tente: ["duz", "kavisli", "yok"],
  kapi: ["cift", "camli", "kemerli"],
};
export const BOLGE = { diger: 17, cam: 16, isik: 12 };
const karmaId = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const SEHIR_TONLARI = ["#F3E6D2", "#FFE9B8", "#DCEFF7", "#F1D9C9", "#E6EBD8", "#EAD9B8", "#E8DCE8"];
const KEPENK_TONLARI = ["#5E8C6A", "#4F7CA8", "#8A5A36", "#7A6A8C"];
const C = (h) => new THREE.Color(h);

/** Tür başına varsayılan reçete (manifestte `cephe` yoksa ya da eksikse); kimlikten kararlı. */
export function receteCoz(p) {
  const k = karmaId(p.id), r = p.cephe ?? {}, sec = (ad, liste, kay) => r[ad] ?? liste[(k >>> kay) % liste.length];
  const tur = p.tur;
  const v = {
    vitrin: p.girilebilir ? sec("vitrin", ["dukkan", "kafe"], 1) : sec("vitrin", tur === "apartman" ? ["kapali", "dar"] : ["kapali"], 1),
    pencere: sec("pencere", tur === "kamusal_yapi" ? ["kemerli"] : ["tek", "cift", "kepenkli", "kemerli"], 3),
    balkon: sec("balkon", tur === "apartman" ? ["korkuluk", "yok"] : tur === "dar_uzun" ? ["cikma"] : ["yok", "korkuluk"], 5),
    silme: sec("silme", tur === "kucuk_dukkan" ? ["duz"] : ["duz", "disli"], 7),
    cati: sec("cati", tur === "dar_uzun" ? ["cikmali"] : tur === "kamusal_yapi" ? ["duz"] : ["kiremit", "duz", "cikmali"], 9),
    tabela: sec("tabela", VARYANT.tabela, 11),
    tente: sec("tente", VARYANT.tente, 13),
    kapi: sec("kapi", VARYANT.kapi, 15),
    malzeme: r.malzeme ?? (r.renk ? "siva" : tur === "kamusal_yapi" ? "tas" : (k >>> 17) % 4 === 0 && !p.girilebilir ? "tugla" : "siva"),
    renk: r.renk ?? SEHIR_TONLARI[(k >>> 19) % SEHIR_TONLARI.length],
    kepenk: r.kepenk ?? KEPENK_TONLARI[(k >>> 21) % KEPENK_TONLARI.length],
    yan_cephe: r.yan_cephe ?? tur === "kose_binasi",
  };
  return v;
}

// ---------------------------------------------------------------- geometri toplayıcı (tek geometri, köşe sırası kararlı)
const YUZ = {
  X: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], x: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  Y: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], y: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  Z: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], z: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
};
export class Toplayici {
  constructor(H) { this.H = H; this.pos = []; this.uv = []; this.renk = []; this.bolge = []; }
  #kose(p, u, v, r, t, b) { this.pos.push(p[0], p[1], p[2]); this.uv.push(r.u0 + (r.u1 - r.u0) * u, r.v0 + (r.v1 - r.v0) * v); this.renk.push(t.r, t.g, t.b); this.bolge.push(b); }
  /** Dörtgen (köşeler dışarıdan bakınca saat yönünün tersine). nu×nv karoya bölünür; `dolu` ise her karo hücrenin tamamını gösterir. */
  dortgen(k, hucre, ton, { nu = 1, nv = 1, dolu = false, bolge = BOLGE.diger } = {}) {
    const r = this.H[hucre] ?? this.H.siva, t = ton ?? BEYAZ;
    const P = (a, b) => [0, 1, 2].map((i) => (k[0][i] * (1 - a) + k[1][i] * a) * (1 - b) + (k[3][i] * (1 - a) + k[2][i] * a) * b);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a0 = i / nu, a1 = (i + 1) / nu, b0 = j / nv, b1 = (j + 1) / nv, q = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
      const U = dolu ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]];
      for (const n of [0, 1, 2, 0, 2, 3]) this.#kose(q[n], U[n][0], U[n][1], r, t, bolge);
    }
  }
  ucgen(k, hucre, ton, bolge = BOLGE.diger) { const r = this.H[hucre] ?? this.H.siva; for (const p of k) this.#kose(p, 0.5, 0.5, r, ton ?? BEYAZ, bolge); }
  /** Eksenlere hizalı kutu; `yuz` hangi yüzlerin üretileceği (X x Y y Z z). Duvara yaslanan arka yüz ve taban üretilmez → üçgen + AO tasarrufu. */
  kutu(w, h, d, x, y, z, hucre, ton, { yuz = "XxYZ", dolu = false, bolge = BOLGE.diger } = {}) {
    for (const f of yuz) this.dortgen(YUZ[f].map(([a, b, c]) => [x + a * w / 2, y + b * h / 2, z + c * d / 2]), hucre, ton, { dolu, bolge });
  }
  get ucgenSayisi() { return this.pos.length / 9; }
  geometri(aci, x, z) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.renk, 3));
    g.setAttribute("_bolge", new THREE.Float32BufferAttribute(this.bolge, 1));
    g.computeVertexNormals();   // indekssiz → yüz normali (düz gölgeleme; stil bunu istiyor)
    g.rotateY(aci).translate(x, 0, z);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
export const BEYAZ = C("#FFFFFF");

// ---------------------------------------------------------------- PARÇALAR (hepsi yerel eksende; z0 = cephe düzlemi)
// Her parça `lod` alır: 0 tam · 1 sade. (2 = uzak kütle parça kullanmaz.)

/** Üst kat penceresi — bir aksın (genişlik bw, kat yüksekliği kh) içine oturur. */
function pencere(T, tip, lod, cx, y0, bw, kh, z0, R) {
  const beyaz = R.cerceveTon, camTon = R.camTon;
  if (tip === "giydirme") {   // kamusal: aks boyu cam pano + ince kayıt
    T.kutu(bw - 0.18, kh - 0.16, 0.01, cx, y0 + kh / 2, z0, "cam", camTon, { yuz: "Z", dolu: lod === 0, bolge: BOLGE.cam });
    if (lod === 0) { T.kutu(0.12, kh, 0.14, cx - bw / 2, y0 + kh / 2, z0 + 0.07, "demir", R.kayitTon, { yuz: "XxZ" }); T.kutu(bw, 0.12, 0.14, cx, y0 + 0.06, z0 + 0.07, "demir", R.kayitTon, { yuz: "YZy" }); }
    return;
  }
  const w = tip === "cift" ? Math.min(1.9, bw * 0.72) : Math.min(1.25, bw * 0.5), h = Math.min(1.75, kh * 0.56), yc = y0 + kh * 0.5 + 0.05;
  if (lod === 1) {   // düz: beyaz söve dörtgeni + cam dörtgeni
    T.kutu(w + 0.24, h + 0.24, 0.02, cx, yc, z0 + 0.02, "cerceve", beyaz, { yuz: "Z" });
    T.kutu(w, h, 0.02, cx, yc, z0 + 0.04, "cam", camTon, { yuz: "Z", bolge: BOLGE.cam });
    if (tip === "kepenkli") for (const s of [-1, 1]) T.kutu(w * 0.42, h, 0.02, cx + s * (w / 2 + w * 0.21 + 0.1), yc, z0 + 0.03, "cerceve", R.kepenkTon, { yuz: "Z" });
    return;
  }
  // söve (dört kenar), cam, denizlik
  T.kutu(w + 0.24, 0.12, 0.12, cx, yc + h / 2 + 0.06, z0 + 0.06, "cerceve", beyaz, { yuz: "XxYZy" });
  for (const s of [-1, 1]) T.kutu(0.12, h, 0.12, cx + s * (w / 2 + 0.06), yc, z0 + 0.06, "cerceve", beyaz, { yuz: "XxZ" });
  T.kutu(w + 0.4, 0.1, 0.22, cx, yc - h / 2 - 0.05, z0 + 0.11, "cerceve", beyaz, { yuz: "XxYZy" });
  T.kutu(w, h, 0.01, cx, yc, z0, "cam", camTon, { yuz: "Z", dolu: true, bolge: BOLGE.cam });   // cam duvara 5 mm (muayene: havada kalmasın)
  if (tip === "cift" || tip === "tek") T.kutu(0.07, h, 0.06, cx, yc, z0 + 0.07, "cerceve", beyaz, { yuz: "XxZ" });   // orta kayıt
  if (tip === "tek") T.kutu(w, 0.07, 0.06, cx, yc + h * 0.18, z0 + 0.07, "cerceve", beyaz, { yuz: "YZy" });
  if (tip === "kemerli") {   // yarım daire alınlık: cam yelpaze + söve yayı
    const n = 6, r = w / 2, ky = yc + h / 2 + 0.12;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n), p = (a, rr, zz) => [cx + Math.cos(a) * rr, ky + Math.sin(a) * rr, zz];
      T.ucgen([[cx, ky, z0 + 0.005], p(a0, r, z0 + 0.005), p(a1, r, z0 + 0.005)], "cam", camTon, BOLGE.cam);
      T.dortgen([p(a0, r, z0 + 0.12), p(a0, r + 0.14, z0 + 0.12), p(a1, r + 0.14, z0 + 0.12), p(a1, r, z0 + 0.12)], "cerceve", beyaz);
      T.dortgen([p(a0, r + 0.14, z0 + 0.12), p(a0, r + 0.14, z0), p(a1, r + 0.14, z0), p(a1, r + 0.14, z0 + 0.12)], "cerceve", beyaz);
    }
  }
  if (tip === "kepenkli") for (const s of [-1, 1]) {   // açık ahşap kepenk kanatları
    const kx = cx + s * (w / 2 + 0.12 + w * 0.21);
    T.kutu(w * 0.42, h, 0.06, kx, yc, z0 + 0.03, "cerceve", R.kepenkTon, { yuz: "XxYZ" });
    for (let j = 1; j < 4; j++) T.kutu(w * 0.34, 0.05, 0.03, kx, yc - h / 2 + (h * j) / 4, z0 + 0.075, "cerceve", R.kepenkKoyu, { yuz: "YZ" });
  }
}

/** Balkon — korkuluklu (döşeme + demir korkuluk + balkon kapısı) ya da çıkma (cumba). */
function balkonKorkuluk(T, lod, cx, y0, bw, kh, z0, R) {
  const w = bw * 0.86, d = 0.85;
  T.kutu(w, 0.14, d, cx, y0 + 0.07, z0 + d / 2, "cerceve", R.silmeTon, { yuz: "XxYZy" });
  for (const s of [-1, 1]) if (lod === 0) T.kutu(0.16, 0.3, d * 0.8, cx + s * w * 0.36, y0 - 0.15, z0 + d * 0.4, "cerceve", R.silmeTon, { yuz: "XxZy" });   // konsol
  // balkon kapısı (yüksek pencere)
  const kw = Math.min(1.15, bw * 0.46), kyuk = Math.min(2.25, kh * 0.74);
  T.kutu(kw + 0.22, kyuk + 0.12, 0.04, cx, y0 + 0.14 + (kyuk + 0.12) / 2, z0 + 0.02, "cerceve", R.cerceveTon, { yuz: lod ? "Z" : "XxYZ" });
  T.kutu(kw, kyuk, 0.01, cx, y0 + 0.14 + kyuk / 2, z0 + 0.04, "cam", R.camTon, { yuz: "Z", dolu: lod === 0, bolge: BOLGE.cam });
  if (lod === 1) { T.kutu(w, 0.95, 0.04, cx, y0 + 0.14 + 0.475, z0 + d - 0.02, "demir", R.demirTon, { yuz: "Zz" }); return; }
  const ky = y0 + 0.14 + 0.95;
  T.kutu(w, 0.06, 0.06, cx, ky, z0 + d - 0.03, "demir", R.demirTon, { yuz: "YZzy" });
  for (const s of [-1, 1]) T.kutu(0.06, 0.06, d, cx + s * (w / 2 - 0.03), ky, z0 + d / 2, "demir", R.demirTon, { yuz: "XxY" });
  const n = Math.max(3, Math.round(w / 0.32));
  for (let i = 0; i <= n; i++) T.kutu(0.035, 0.95, 0.035, cx - w / 2 + 0.03 + ((w - 0.06) * i) / n, y0 + 0.14 + 0.475, z0 + d - 0.03, "demir", R.demirTon, { yuz: "XxZ" });
  for (const s of [-1, 1]) for (let i = 1; i < 3; i++) T.kutu(0.035, 0.95, 0.035, cx + s * (w / 2 - 0.03), y0 + 0.14 + 0.475, z0 + (d * i) / 3, "demir", R.demirTon, { yuz: "XxZz" });
}
function cumba(T, lod, cx, y0, yuk, bw, kh, katlar, z0, R, pencereTip) {   // çıkma: üst katlar boyunca öne taşan hacim
  const w = bw * 0.92, d = 0.75;
  T.kutu(w, yuk, d, cx, y0 + yuk / 2, z0 + d / 2, R.duvarHucre, R.duvarTon, { yuz: "XxYZy" });
  if (lod === 0) for (const s of [-1, 1]) T.kutu(0.18, 0.45, d * 0.85, cx + s * w * 0.34, y0 - 0.22, z0 + d * 0.42, "cerceve", R.silmeTon, { yuz: "XxZy" });   // payanda
  T.kutu(w + 0.16, 0.14, d + 0.08, cx, y0 + yuk + 0.07, z0 + d / 2, "cerceve", R.silmeTon, { yuz: "XxYZy" });
  for (let k = 0; k < katlar; k++) {
    pencere(T, pencereTip === "kepenkli" ? "tek" : pencereTip, lod, cx, y0 + k * kh, w, kh, z0 + d, R);
    if (lod === 0) for (const s of [-1, 1]) {   // yan yüzlerde dar pencere
      const x = cx + s * (w / 2), yc = y0 + k * kh + kh * 0.55;
      T.kutu(0.01, Math.min(1.5, kh * 0.5), d * 0.5, x, yc, z0 + d / 2, "cam", R.camTon, { yuz: s > 0 ? "X" : "x", bolge: BOLGE.cam });
    }
  }
}

/** Zemin kat — vitrin aksı. */
function vitrin(T, tip, lod, cx, bw, zk, z0, R) {
  const w = bw - 0.5, ust = Math.min(zk - 0.75, 2.9);
  if (tip === "kapali") {   // girilemez: indirilmiş kepenk (tabela/ışık/kapı yok)
    T.kutu(w, ust - 0.1, 0.05, cx, (ust - 0.1) / 2 + 0.05, z0 + 0.03, "cerceve", R.kepenkMetal, { yuz: "Z" });
    if (lod === 0) { for (let j = 1; j < 7; j++) T.kutu(w, 0.04, 0.03, cx, (ust * j) / 7, z0 + 0.07, "cerceve", R.kepenkMetalKoyu, { yuz: "YZ" }); T.kutu(w + 0.16, 0.16, 0.16, cx, ust + 0.03, z0 + 0.08, "cerceve", R.kepenkMetalKoyu, { yuz: "XxYZy" }); }
    return;
  }
  if (tip === "dar") {   // girilemez: yüksekte küçük parmaklıklı pencere
    const pw = Math.min(1.1, w * 0.5);
    T.kutu(pw + 0.2, 1.0, 0.04, cx, 2.05, z0 + 0.02, "cerceve", R.cerceveTon, { yuz: lod ? "Z" : "XxYZ" });
    T.kutu(pw, 0.8, 0.01, cx, 2.05, z0 + 0.04, "cam", R.camTon, { yuz: "Z", bolge: BOLGE.cam });
    if (lod === 0) for (let i = 1; i < 4; i++) T.kutu(0.04, 0.9, 0.06, cx - pw / 2 + (pw * i) / 4, 2.05, z0 + 0.07, "demir", R.demirTon, { yuz: "XxZ" });
    return;
  }
  const alt = tip === "kafe" ? 0.85 : 0.45;   // kafe: ahşap alt pano · dükkân: taş subasman
  T.kutu(w, alt, 0.1, cx, alt / 2, z0 + 0.05, tip === "kafe" ? "ahsap" : "tas", tip === "kafe" ? R.ahsapTon : BEYAZ, { yuz: lod ? "Z" : "XxYZ", dolu: lod === 0 });
  T.kutu(w - 0.16, ust - alt - 0.08, 0.01, cx, alt + (ust - alt) / 2, z0, "cam", R.camTon, { yuz: "Z", dolu: lod === 0, bolge: BOLGE.cam });
  if (lod === 1) { T.kutu(w, 0.12, 0.02, cx, ust + 0.02, z0 + 0.05, "cerceve", R.cerceveTon, { yuz: "Z" }); return; }
  T.kutu(w, 0.12, 0.14, cx, ust + 0.02, z0 + 0.07, "cerceve", R.cerceveTon, { yuz: "XxYZy" });
  for (const s of [-1, 1]) T.kutu(0.1, ust - alt, 0.14, cx + s * (w / 2 - 0.05), alt + (ust - alt) / 2, z0 + 0.07, "cerceve", R.cerceveTon, { yuz: "XxZ" });
  const kayit = tip === "kafe" ? 3 : 1;
  for (let i = 1; i <= kayit; i++) T.kutu(0.06, ust - alt - 0.1, 0.08, cx - w / 2 + (w * i) / (kayit + 1), alt + (ust - alt) / 2, z0 + 0.08, "cerceve", R.cerceveTon, { yuz: "XxZ" });
  if (tip === "kafe") T.kutu(w - 0.2, 0.06, 0.08, cx, ust - 0.6, z0 + 0.08, "cerceve", R.cerceveTon, { yuz: "YZy" });
}

/** Kapı — YALNIZ girilebilir binada. Eşik + kasa + kanat + iki yanında ışıyan aplik. */
function kapi(T, tip, lod, cx, zk, z0, R) {
  const w = 2.3, h = Math.min(zk - 1.45, 2.4);
  T.kutu(w + 0.9, 0.16, 0.5, cx, 0.08, z0 + 0.25, "tas", BEYAZ, { yuz: "XxYZ", dolu: lod === 0 });   // eşik
  if (lod === 1) {
    T.kutu(w + 0.36, h + 0.2, 0.02, cx, 0.16 + (h + 0.2) / 2, z0 + 0.04, "cerceve", R.cerceveTon, { yuz: "Z" });
    T.kutu(w, h, 0.02, cx, 0.16 + h / 2, z0 + 0.07, tip === "camli" ? "cam" : "ahsap", tip === "camli" ? R.camTon : R.kapiTon, { yuz: "Z", bolge: tip === "camli" ? BOLGE.cam : BOLGE.diger });
    return;
  }
  const y0 = 0.16;
  for (const s of [-1, 1]) T.kutu(0.2, h + 0.1, 0.24, cx + s * (w / 2 + 0.1), y0 + (h + 0.1) / 2, z0 + 0.12, "cerceve", R.cerceveTon, { yuz: "XxZ" });
  T.kutu(w + 0.56, 0.24, 0.3, cx, y0 + h + 0.22, z0 + 0.15, "cerceve", R.cerceveTon, { yuz: "XxYZy" });
  if (tip === "camli") {
    for (const s of [-1, 1]) { T.kutu(w / 2 - 0.04, h, 0.08, cx + s * w / 4, y0 + h / 2, z0 + 0.04, "cerceve", R.kapiTon, { yuz: "Z" }); T.kutu(w / 2 - 0.34, h - 0.5, 0.01, cx + s * w / 4, y0 + h / 2 + 0.05, z0 + 0.08, "cam", R.camTon, { yuz: "Z", dolu: true, bolge: BOLGE.cam }); }
  } else {
    const kh = tip === "kemerli" ? h - 0.05 : h - 0.55;
    for (const s of [-1, 1]) { T.kutu(w / 2 - 0.03, kh, 0.08, cx + s * w / 4, y0 + kh / 2, z0 + 0.04, "ahsap", R.kapiTon, { yuz: "Z", dolu: true }); T.kutu(w / 2 - 0.4, kh * 0.34, 0.03, cx + s * w / 4, y0 + kh * 0.72, z0 + 0.09, "ahsapAcik", R.kapiTon, { yuz: "XxYZy" }); T.kutu(w / 2 - 0.4, kh * 0.3, 0.03, cx + s * w / 4, y0 + kh * 0.27, z0 + 0.09, "ahsapAcik", R.kapiTon, { yuz: "XxYZy" }); }
    if (tip === "cift") T.kutu(w, 0.42, 0.01, cx, y0 + h - 0.23, z0, "cam", R.camTon, { yuz: "Z", dolu: true, bolge: BOLGE.cam });   // üst ışıklık
    for (const s of [-1, 1]) T.kutu(0.06, 0.22, 0.08, cx + s * 0.12, y0 + kh * 0.48, z0 + 0.12, "altin", BEYAZ, { yuz: "XxYZy" });   // kapı kolları
  }
  if (tip === "kemerli") {   // kapı üstü kemer alınlığı
    const n = 6, r = w / 2 + 0.28, ky = y0 + h + 0.34;
    for (let i = 0; i < n; i++) { const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n), p = (a, rr, zz) => [cx + Math.cos(a) * rr, ky + Math.sin(a) * rr * 0.55, zz]; T.ucgen([[cx, ky, z0 + 0.2], p(a0, r, z0 + 0.2), p(a1, r, z0 + 0.2)], "cerceve", R.vurguAcik); T.dortgen([p(a0, r, z0 + 0.2), p(a0, r, z0), p(a1, r, z0), p(a1, r, z0 + 0.2)], "cerceve", R.cerceveTon); }
  }
  for (const s of [-1, 1]) {   // AYDINLATMA: ışıyan aplik (bölge `isik` → shader emisyonu)
    const ax = cx + s * (w / 2 + 0.62), ay = y0 + h * 0.78;
    T.kutu(0.1, 0.1, 0.26, ax, ay + 0.24, z0 + 0.13, "demir", R.demirTon, { yuz: "XxYZy" });
    T.kutu(0.26, 0.36, 0.26, ax, ay, z0 + 0.3, "lamba", BEYAZ, { yuz: "XxYZzy", bolge: BOLGE.isik });
    T.kutu(0.32, 0.06, 0.32, ax, ay + 0.21, z0 + 0.3, "demir", R.demirTon, { yuz: "XxYZzy" });
  }
}

/** Tabela çerçevesi — YALNIZ girilebilir. bant: vitrin üstü çerçeveli pano · asma: cepheye dik, sokağa bakan levha. */
function tabela(T, tip, lod, W, zk, z0, R) {
  const y = zk - 0.42;
  if (tip === "bant") {
    const w = Math.min(W - 0.7, 6.4);
    if (lod === 0) T.kutu(w + 0.22, 0.6, 0.4, 0, y, z0 + 0.2, "cerceve", R.cerceveTon, { yuz: "XxYZy" });   // duvardan öne çıkan kasa (tente kökü ve kapı başlığının önünde)
    T.kutu(w, 0.42, 0.01, 0, y, z0 + (lod ? 0.04 : 0.4), "cerceve", R.vurguKoyu, { yuz: "Z" });
    if (lod === 0) for (const s of [-1, 1]) { T.kutu(0.05, 0.05, 0.62, s * w * 0.3, y + 0.32, z0 + 0.31, "demir", R.demirTon, { yuz: "XxYy" }); T.kutu(0.16, 0.12, 0.2, s * w * 0.3, y + 0.28, z0 + 0.66, "lamba", BEYAZ, { yuz: "XxYZzy", bolge: BOLGE.isik }); }   // tabela spotları
    return;
  }
  const x = -W / 2 + 0.55, yy = Math.max(y + 0.9, 3.4);   // asma levha: kol + iki yüzlü pano
  T.kutu(0.07, 0.07, 1.25, x, yy + 0.6, z0 + 0.625, "demir", R.demirTon, { yuz: "XxYy" });
  T.kutu(0.1, 1.15, 0.95, x, yy, z0 + 0.72, "cerceve", R.vurguKoyu, { yuz: "XxYZy" });
  if (lod === 0) { T.kutu(0.14, 1.27, 0.06, x, yy, z0 + 0.22, "cerceve", R.cerceveTon, { yuz: "XxYZy" }); T.kutu(0.14, 1.27, 0.06, x, yy, z0 + 1.22, "cerceve", R.cerceveTon, { yuz: "XxYZy" }); for (const s of [-1, 1]) T.kutu(0.01, 0.5, 0.5, x + s * 0.05, yy, z0 + 0.72, "cerceve", R.vurguAcik, { yuz: s > 0 ? "X" : "x" }); }
  T.kutu(Math.min(W - 1.6, 4.2), 0.42, 0.06, 0.4, y, z0 + 0.03, "cerceve", R.vurguKoyu, { yuz: "XxYZy" });   // kapı üstü küçük ad panosu
}

/** Tente — YALNIZ girilebilir. duz: eğik şeritli · kavisli: çeyrek daire körük. */
function tente(T, tip, lod, W, zk, z0, R) {
  if (tip === "yok") return;
  const w = W - 0.5, y1 = Math.min(zk - 0.8, 3.0), cik = 1.25, dus = 0.55, n = lod ? 1 : Math.max(4, Math.round(w / 0.62));
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (w * i) / n, x1 = -w / 2 + (w * (i + 1)) / n, ton = lod ? R.vurguTon : i % 2 ? R.cerceveTon : R.vurguTon;
    if (tip === "kavisli") {
      const m = lod ? 2 : 4;
      for (let j = 0; j < m; j++) { const a0 = (Math.PI / 2) * (j / m), a1 = (Math.PI / 2) * ((j + 1) / m), p = (x, a) => [x, y1 - dus + Math.cos(a) * dus, z0 + Math.sin(a) * cik - (a === 0 ? 0 : 0)]; T.dortgen([p(x0, a1), p(x1, a1), p(x1, a0), p(x0, a0)], "cerceve", ton); }
    } else {
      T.dortgen([[x0, y1 - dus, z0 + cik], [x1, y1 - dus, z0 + cik], [x1, y1, z0], [x0, y1, z0]], "cerceve", ton);
      T.dortgen([[x0, y1 - dus - 0.22, z0 + cik], [x1, y1 - dus - 0.22, z0 + cik], [x1, y1 - dus, z0 + cik], [x0, y1 - dus, z0 + cik]], "cerceve", ton);   // saçak
    }
  }
  if (lod === 0) for (const s of [-1, 1]) T.kutu(0.04, 0.04, cik, s * (w / 2 - 0.02), y1 - dus - 0.02, z0 + cik / 2, "demir", R.demirTon, { yuz: "XxYy" });
  // alt yüz (yukarıdan görünmez; sokak kamerası alttan bakmaz) üretilmez
}

/** Kat silmesi / korniş. duz: düz bant · disli: bant + diş sırası (yalnız LOD 0). */
function silme(T, tip, lod, W, y, z0, R, kalin = 0.2, cik = 0.14) {
  T.kutu(W + cik * 2, kalin, cik, 0, y, z0 + cik / 2, "cerceve", R.silmeTon, { yuz: "XxYZy" });
  if (tip === "disli" && lod === 0) { const n = Math.round(W / 0.7); for (let i = 0; i < n; i++) T.kutu(0.22, 0.2, cik * 0.8, -W / 2 + (W * (i + 0.5)) / n, y - kalin / 2 - 0.1, z0 + cik * 0.4, "cerceve", R.silmeTon, { yuz: "XxZy" }); }
}

/** Çatı. kiremit: sokağa paralel mahyalı beşik çatı · duz: parapet + çatı üstü hacimler · cikmali: mansart + çatı penceresi. */
function cati(T, tip, lod, W, D, y, R, k, kule = true) {
  const s = 0.35;   // saçak payı
  if (tip === "kiremit") {
    const yuk = Math.min(2.0, 0.9 + D * 0.09), hw = W / 2 + s, hd = D / 2 + s, nu = lod === 0 ? Math.max(1, Math.round(W / 2.4)) : 1, nv = lod === 0 ? 2 : 1;
    T.dortgen([[-hw, y, hd], [hw, y, hd], [hw, y + yuk, 0], [-hw, y + yuk, 0]], R.kiremitHucre, R.kiremitTon, { nu, nv, dolu: lod === 0 && R.kiremitHucre === "kiremit" });
    T.dortgen([[hw, y, -hd], [-hw, y, -hd], [-hw, y + yuk, 0], [hw, y + yuk, 0]], R.kiremitHucre, R.kiremitTon, { nu, nv, dolu: lod === 0 && R.kiremitHucre === "kiremit" });
    for (const q of [-1, 1]) T.ucgen(q > 0 ? [[hw - s, y, hd - s], [hw - s, y, -hd + s], [hw - s, y + yuk * 0.92, 0]] : [[-hw + s, y, -hd + s], [-hw + s, y, hd - s], [-hw + s, y + yuk * 0.92, 0]], R.duvarHucre, R.duvarTon);
    if (lod < 2) { T.kutu(W + s * 2, 0.16, D + s * 2, 0, y - 0.02, 0, "cerceve", R.silmeTon, { yuz: "XxZzy" }); }   // alt yüz (saçak altı) duvar tepesine oturur
    if (lod === 0) { T.kutu(W + s * 2 - 0.06, 0.16, 0.3, 0, y + yuk - 0.03, 0, R.kiremitHucre, R.kiremitKoyu, { yuz: "XxYZz" }); const bx = ((k % 5) / 5 - 0.4) * W * 0.6; T.kutu(0.7, 1.5, 0.7, bx, y + yuk * 0.5 + 0.6, -D * 0.22, "baca", BEYAZ, { yuz: "XxZz", dolu: true }); T.kutu(0.86, 0.14, 0.86, bx, y + yuk * 0.5 + 1.42, -D * 0.22, "cerceve", R.silmeTon, { yuz: "XxYZzy" }); }
    return;
  }
  if (tip === "cikmali") {   // mansart: eğik arduvaz yüzler + düz tepe + çatı pencereleri
    const yuk = 2.3, ic = 1.0, hw = W / 2 + 0.12, hd = D / 2 + 0.12, tw = hw - ic, td = hd - ic, ton = R.arduvazTon;
    T.dortgen([[-hw, y, hd], [hw, y, hd], [tw, y + yuk, td], [-tw, y + yuk, td]], "cerceve", ton);
    T.dortgen([[hw, y, -hd], [-hw, y, -hd], [-tw, y + yuk, -td], [tw, y + yuk, -td]], "cerceve", ton);
    T.dortgen([[hw, y, hd], [hw, y, -hd], [tw, y + yuk, -td], [tw, y + yuk, td]], "cerceve", ton);
    T.dortgen([[-hw, y, -hd], [-hw, y, hd], [-tw, y + yuk, td], [-tw, y + yuk, -td]], "cerceve", ton);
    T.dortgen([[-tw, y + yuk, td], [tw, y + yuk, td], [tw, y + yuk, -td], [-tw, y + yuk, -td]], "cerceve", R.arduvazKoyu);
    if (lod === 2) return;
    const n = Math.max(1, Math.round(W / 3.4));
    for (let i = 0; i < n; i++) {   // çatı penceresi (lucarne)
      const x = -W / 2 + (W * (i + 0.5)) / n, z = hd - 0.42;
      T.kutu(1.0, 1.25, 0.9, x, y + 0.2 + 0.62, z, "cerceve", R.cerceveTon, { yuz: lod ? "Z" : "XxYZ" });
      T.kutu(0.7, 0.85, 0.01, x, y + 0.2 + 0.6, z + 0.45, "cam", R.camTon, { yuz: "Z", bolge: BOLGE.cam });
      if (lod === 0) { T.dortgen([[x - 0.62, y + 1.4, z + 0.5], [x, y + 1.85, z + 0.5], [x, y + 1.85, z - 0.5], [x - 0.62, y + 1.4, z - 0.5]], "cerceve", ton); T.dortgen([[x, y + 1.85, z + 0.5], [x + 0.62, y + 1.4, z + 0.5], [x + 0.62, y + 1.4, z - 0.5], [x, y + 1.85, z - 0.5]], "cerceve", ton); T.ucgen([[x - 0.62, y + 1.4, z + 0.5], [x + 0.62, y + 1.4, z + 0.5], [x, y + 1.85, z + 0.5]], "cerceve", R.cerceveTon); }
    }
    if (lod === 0) T.kutu(W + 0.5, 0.18, D + 0.5, 0, y + 0.02, 0, "cerceve", R.silmeTon, { yuz: "XxZz" });
    return;
  }
  // düz: döşeme + parapet + çatı üstü hacimler (asansör kulesi, su deposu, klima)
  T.dortgen([[-W / 2, y, D / 2], [W / 2, y, D / 2], [W / 2, y, -D / 2], [-W / 2, y, -D / 2]], "asfalt", R.catiZeminTon, { dolu: lod === 0 });
  if (lod === 2) { T.kutu(W + 0.2, 0.5, D + 0.2, 0, y + 0.25, 0, "cerceve", R.silmeTon, { yuz: "XxZz" }); return; }
  const p = 0.55, e = 0.24;
  for (const q of [-1, 1]) { T.kutu(W + 0.2, p, e, 0, y + p / 2, q * (D / 2 - e / 2 + 0.1), "cerceve", R.silmeTon, { yuz: "XxYZz" }); T.kutu(e, p, D - e * 2 + 0.2, q * (W / 2 - e / 2 + 0.1), y + p / 2, 0, "cerceve", R.silmeTon, { yuz: "XxY" }); }
  const kx = ((k % 7) / 7 - 0.5) * W * 0.5;
  if (!kule) { if (lod === 0) for (let i = 0; i < 2; i++) T.kutu(0.9, 0.6, 0.6, -W / 2 + 1.4 + i * 1.5, y + 0.3, -D * 0.2, "metal", BEYAZ, { yuz: "XxYZz" }); return; }   // tek katlı dükkân: yalnız klima üniteleri
  T.kutu(2.2, 2.0, 2.4, kx, y + 1.0, -D * 0.2, R.duvarHucre, R.duvarKoyu, { yuz: "XxYZz" });   // asansör/merdiven kulesi
  if (lod === 0) {
    T.kutu(2.5, 0.12, 2.7, kx, y + 2.06, -D * 0.2, "cerceve", R.silmeTon, { yuz: "XxYZz" });
    T.kutu(0.9, 1.7, 0.04, kx, y + 0.85, -D * 0.2 + 1.22, "demir", R.demirTon, { yuz: "Z" });
    const sx = kx + (k % 2 ? 2.6 : -2.6), n = 8;   // su deposu
    if (Math.abs(sx) < W / 2 - 0.9) for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, pt = (a, yy) => [sx + Math.cos(a) * 0.6, yy, -D * 0.2 + Math.sin(a) * 0.6]; T.dortgen([pt(a1, y + 0.3), pt(a0, y + 0.3), pt(a0, y + 1.5), pt(a1, y + 1.5)], "metal", BEYAZ); T.ucgen([[sx, y + 1.5, -D * 0.2], pt(a1, y + 1.5), pt(a0, y + 1.5)], "metal", BEYAZ); }
    for (let i = 0; i < 2; i++) { const ax = -W / 2 + 1.2 + i * 1.5; if (Math.abs(ax - kx) > 1.9) T.kutu(0.9, 0.6, 0.6, ax, y + 0.3, D * 0.18, "metal", BEYAZ, { yuz: "XxYZz" }); }   // klima dış üniteleri
  }
}

// ---------------------------------------------------------------- BİNA
function renkler(p, v, modRenk) {
  const mr = p.girilebilir ? modRenk?.(p.mod) : null, k = karmaId(p.id);
  const duvar = C(mr ? mr.duvar : v.malzeme === "tugla" ? "#C9876A" : v.malzeme === "tas" ? "#E3DCCF" : v.renk);
  const vurgu = C(mr ? mr.cati : "#8F8A82");
  return {
    duvarHucre: v.malzeme === "tugla" ? "tugla" : v.malzeme === "tas" ? "tasAcik" : "siva",
    duvarTon: v.malzeme === "tugla" ? C("#F2E4DA") : v.malzeme === "tas" ? C("#F4EEE2") : duvar, duvarKoyu: (v.malzeme === "tugla" ? C("#F2E4DA") : v.malzeme === "tas" ? C("#F4EEE2") : duvar).clone().multiplyScalar(0.86),
    zeminTon: mr ? duvar.clone().multiplyScalar(0.86) : duvar.clone().multiplyScalar(0.8),
    silmeTon: mr ? C("#FFF7EA") : duvar.clone().lerp(C("#FFFFFF"), 0.62), cerceveTon: C("#FFFFFF"), camTon: C(mr ? "#E6F4FB" : "#DCECF5"), kayitTon: C("#55606B"),
    demirTon: C("#3B444E"), ahsapTon: C("#E9D2B4"), kapiTon: mr ? C("#F2E2D0") : C("#8A6A4A"),
    vurguTon: mr ? C(mr.duvar) : vurgu, vurguKoyu: mr ? vurgu : C("#6E6A64"), vurguAcik: mr ? C(mr.duvar).lerp(C("#FFFFFF"), 0.45) : C("#DDD6CB"),
    kepenkTon: C(v.kepenk), kepenkKoyu: C(v.kepenk).multiplyScalar(0.72), kepenkMetal: C("#AEB6BD"), kepenkMetalKoyu: C("#8A939B"),
    kiremitHucre: mr ? "cerceve" : "kiremit", kiremitTon: mr ? C(mr.cati).lerp(C("#FFFFFF"), 0.1) : C(["#E6D2C8", "#DCC6BA", "#EAD8CA"][(k >>> 5) % 3]), kiremitKoyu: mr ? C(mr.cati).multiplyScalar(0.8) : C("#C9A99A"),
    arduvazTon: mr ? C(mr.cati) : C(["#6F7F8E", "#7D8794", "#5F6E7C"][(k >>> 6) % 3]), arduvazKoyu: mr ? C(mr.cati).multiplyScalar(0.78) : C("#55616D"),
    catiZeminTon: C("#C9C4BA"),
  };
}
/** kiremit hücresi zaten kırmızıdır: girilemez binada ton ~beyaz (hücre rengi okunur), girilebilirde mod çatı rengi hücreyi boyar. */

/**
 * Tek bina, tek LOD → dünya uzayında BufferGeometry (indekssiz; position · uv · color · _bolge · normal).
 * @param {object} p parsel (yerlesim.json) · @param {object} H atlas hücre tablosu · @param {0|1|2} lod
 */
export function binaGeometrisi(p, H, lod, modRenk = null) {
  if (p.yapi) return yapiGeometrisi(p, H, lod, modRenk);   // 3A-2 §C/§E: tanınır yapılar (AKM, cami, anıt, lise, metro) — aynı kalıp, kendi kurucusu
  const { en: W, derinlik: D, yukseklik: Ht } = p.ayakizi, [x, , z] = p.capa.konum, aci = p.capa.donus_y ?? 0, k = karmaId(p.id);
  const v = receteCoz(p), R = renkler(p, v, modRenk), T = new Toplayici(H), z0 = D / 2;
  const zk = Ht <= 4.4 ? Ht : Math.min(3.8, Ht * 0.5), ust = Ht - zk, katlar = ust < 1.5 ? 0 : Math.max(1, Math.round(ust / 3.15)), kh = katlar ? ust / katlar : 0;
  const aks = Math.max(1, Math.round(W / (v.pencere === "giydirme" ? 3.6 : 2.9))), bw = W / aks;

  // ---- UZAK: yalın kütle + çatı silueti
  if (lod === 2) {
    T.kutu(W, zk, D, 0, zk / 2, 0, "cerceve", R.zeminTon.clone().multiply(C("#F3E6D2")), { yuz: "XxZz" });
    if (katlar) T.kutu(W, ust, D, 0, zk + ust / 2, 0, "cerceve", (v.malzeme === "siva" ? R.duvarTon : C(v.malzeme === "tugla" ? "#C9876A" : "#E3DCCF")).clone().multiply(C("#F3E6D2")), { yuz: "XxZz" });
    cati(T, v.cati, 2, W, D, Ht, R, k, katlar > 0);
    return T.geometri(aci, x, z);
  }

  // ---- gövde: ön cephe karolu (tuğla deseni + AO çözünürlüğü), yan/arka sade
  const karo = lod === 0 ? (v.malzeme === "tugla" ? 1.2 : 1.6) : 1e9, n = (u) => Math.max(1, Math.round(u / karo)), tuglaMi = v.malzeme !== "siva";
  const on = (y0, y1, hucre, ton) => T.dortgen([[-W / 2, y0, z0], [W / 2, y0, z0], [W / 2, y1, z0], [-W / 2, y1, z0]], hucre, ton, { nu: n(W), nv: n(y1 - y0), dolu: tuglaMi && lod === 0 });
  on(0, zk, p.girilebilir ? R.duvarHucre : v.malzeme === "tas" ? "tas" : "sivaKoyu", p.girilebilir ? R.zeminTon : v.malzeme === "tas" ? BEYAZ : R.zeminTon);
  if (katlar) on(zk, Ht, R.duvarHucre, R.duvarTon);
  for (const s of [-1, 1]) {   // yanlar
    const X = s * W / 2, q = s > 0 ? [[X, 0, z0], [X, 0, -z0], [X, Ht, -z0], [X, Ht, z0]] : [[X, 0, -z0], [X, 0, z0], [X, Ht, z0], [X, Ht, -z0]];
    T.dortgen(q, R.duvarHucre, R.duvarTon, { nu: tuglaMi ? n(D) : 1, nv: tuglaMi ? n(Ht) : 1, dolu: tuglaMi && lod === 0 });   // tuğla/taş: desen ölçeği ön cepheyle aynı; sıva: tek dörtgen
  }
  T.dortgen([[W / 2, 0, -z0], [-W / 2, 0, -z0], [-W / 2, Ht, -z0], [W / 2, Ht, -z0]], R.duvarHucre, R.duvarKoyu, { nu: tuglaMi ? n(W) : 1, nv: tuglaMi ? n(Ht) : 1, dolu: tuglaMi && lod === 0 });   // arka

  // ---- zemin kat. Girilebilir: kapı MERKEZDE (kapı önü ipucu + saksılar merkezi bekler), iki yanında vitrin; girilemez: aks aks kepenk/sağır
  if (p.girilebilir) {
    const kapiYari = 1.75, yan = W / 2 - kapiYari;
    if (yan >= 1.3) for (const s of [-1, 1]) { const adet = yan > 4.6 ? 2 : 1; for (let i = 0; i < adet; i++) vitrin(T, v.vitrin, lod, s * (kapiYari + (yan * (i + 0.5)) / adet), yan / adet, zk, z0, R); }
    kapi(T, v.kapi, lod, 0, zk, z0, R);
    tabela(T, v.tabela, lod, W, zk, z0, R);
    tente(T, v.tente === "yok" && v.tabela === "asma" ? "duz" : v.tente, lod, W, zk, z0, R);
  } else {
    for (let i = 0; i < aks; i++) vitrin(T, v.vitrin === "kapali" && i % 2 && p.tur === "apartman" ? "dar" : v.vitrin, lod, -W / 2 + bw * (i + 0.5), bw, zk, z0, R);
  }

  // ---- üst katlar: pencere kuşağı + balkon + kat silmeleri
  const cumbaAks = v.balkon === "cikma" && katlar ? (aks >= 3 ? [Math.floor(aks / 2)] : aks === 2 ? [k % 2] : [0]) : [];
  for (const i of cumbaAks) cumba(T, lod, -W / 2 + bw * (i + 0.5), zk + 0.25, ust - 0.45, bw, (ust - 0.45) / katlar, katlar, z0, R, v.pencere);
  for (let kat = 0; kat < katlar; kat++) {
    const y0 = zk + kat * kh;
    for (let i = 0; i < aks; i++) {
      if (cumbaAks.includes(i)) continue;
      const cx = -W / 2 + bw * (i + 0.5);
      if (v.balkon === "korkuluk" && v.pencere !== "giydirme" && (i + kat + k) % 2 === 0 && bw > 2.2) balkonKorkuluk(T, lod, cx, y0 + 0.05, bw, kh, z0, R);
      else pencere(T, v.pencere, lod, cx, y0, bw, kh, z0, R);
    }
    if (lod === 0 && kat > 0 && v.pencere !== "giydirme") silme(T, "duz", lod, W, y0, z0, R, 0.14, 0.1);
  }
  if (katlar) silme(T, "duz", lod, W, zk + 0.02, z0, R, 0.22, 0.16);           // zemin kat silmesi
  silme(T, v.silme, lod, W, Ht - 0.12, z0, R, 0.26, v.silme === "disli" ? 0.3 : 0.2);   // saçak kornişi

  // ---- yan cephe (köşe binası): düz pencereler — iki sokağa da bakar
  if (v.yan_cephe && katlar) for (const s of [-1, 1]) {
    const yanAks = Math.max(1, Math.round(D / 3.2)), yb = D / yanAks;
    for (let kat = 0; kat < katlar; kat++) for (let i = 0; i < yanAks; i++) {
      const cz = -D / 2 + yb * (i + 0.5), yc = zk + kat * kh + kh * 0.55, X = s * (W / 2 + 0.02), f = s > 0 ? "X" : "x";
      T.kutu(0.02, 1.85, 1.35, X, yc, cz, "cerceve", R.cerceveTon, { yuz: f });
      T.kutu(0.02, 1.6, 1.1, X + s * 0.02, yc, cz, "cam", R.camTon, { yuz: f, bolge: BOLGE.cam });
    }
  }

  cati(T, v.cati, lod, W, D, Ht, R, k, katlar > 0);
  return T.geometri(aci, x, z);
}

/**
 * Cephe sisteminin kurduğu yapılar: modüler cephe parselleri + yapi alanı taşıyan parseller ve noktalar (3A-2).
 * Nokta parsel biçimine çevrilir ({ id, capa, ayakizi, yapi, … }). yapi alanı olmayan landmark parselleri boyalı kütle olarak kalır.
 */
export const cepheParselleri = (M) => [
  ...M.parseller.filter((p) => p.yapi ? YAPILAR[p.yapi] : !/^landmark/.test(p.tur) && p.yertutucu !== "silindir"),
  ...(M.noktalar ?? []).filter((n) => n.yapi && YAPILAR[n.yapi] && n.ayakizi).map((n) => ({ ...n, capa: { konum: n.konum, donus_y: n.donus_y ?? 0 }, girilebilir: false })),
];

// ---------------------------------------------------------------- gömülü AO (varlik/cephe_ao.mjs pişirir → public/meydan/deneme/cephe_ao.bin)
/** bin: [u32 başlık boyu][JSON başlık {surum, kayitlar:{ "<id>:<lod>": [ofset, köşe] }}][bayt…] */
export function aoCoz(tampon) {
  try {
    const dv = new DataView(tampon), n = dv.getUint32(0, true), bas = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 4, n)));
    return { ...bas, bayt: new Uint8Array(tampon, 4 + n) };
  } catch { return null; }
}
export function aoUygula(geo, ao, anahtar) {
  const k = ao?.kayitlar?.[anahtar], renk = geo.attributes.color;
  if (!k || k[1] !== renk.count) return false;   // manifest/reçete değişti ama AO yeniden pişirilmedi → AO'suz (beyaz) kalır
  const a = renk.array, b = ao.bayt;
  for (let i = 0; i < renk.count; i++) { const o = b[k[0] + i] / 255; a[i * 3] *= o; a[i * 3 + 1] *= o; a[i * 3 + 2] *= o; }
  renk.needsUpdate = true;
  return true;
}

// ---------------------------------------------------------------- çalışma anı: LOD yöneticisi
/**
 * Bina başına 3 mesh (yakın · orta · uzak), aynı anda yalnız biri ana geçişte görünür → bina başına 1 çağrı.
 * GÖLGE: yalnız UZAK kütle gölge atar ve yalnız gölge geçişinde + oyuncuya yakınken görünür (büyük siluet, ucuz);
 * detaylı mesh'ler gölge ATMAZ (üçgenler gölge geçişinde ikinci kez çizilmez). Yakın/orta geometri ilk gerektiğinde kurulur.
 */
export class CepheSistemi {
  constructor({ M, hucreler, malzeme, modRenk, render, ao = null }) {
    this.grup = new THREE.Group(); this.grup.name = "Cepheler";
    this.H = hucreler; this.malzeme = malzeme; this.modRenk = modRenk; this.render = render; this.ao = ao;
    const L = M.kurallar?.cephe_lod ?? {};
    this.yakin = L.yakin ?? 38; this.orta = L.orta ?? 85; this.tampon = L.tampon ?? 3; this.golgeMesafe = L.golge ?? 60;
    this.zorla = null;   // ölçüm: 0|1|2 → bütün binalar o LOD'da
    this.binalar = cepheParselleri(M).map((p) => {
      const b = { p, lod: 2, mesafe: Infinity, mesh: [null, null, null], yaricap: Math.hypot(p.ayakizi.en, p.ayakizi.derinlik) / 2, x: p.capa.konum[0], z: p.capa.konum[2] };
      const uzak = this.#meshKur(b, 2);
      uzak.castShadow = true;
      Object.defineProperty(uzak, "visible", { configurable: true, set() {}, get: () => (render.getRenderTarget() !== null ? b.mesafe < this.golgeMesafe : b.lod === 2) });
      return b;
    });
  }
  #meshKur(b, lod) {
    const g = binaGeometrisi(b.p, this.H, lod, this.modRenk);
    if (lod < 2) aoUygula(g, this.ao, `${b.p.id}:${lod}`);
    const m = new THREE.Mesh(g, this.malzeme);
    m.name = `cephe_${b.p.id}_${lod}`; m.castShadow = false; m.receiveShadow = true; m.userData.lod = lod;
    b.mesh[lod] = m; this.grup.add(m);
    return m;
  }
  /** Her karede: oyuncuya uzaklığa göre LOD seç (tamponlu). */
  guncelle(x, z) {
    for (const b of this.binalar) {
      const d = Math.max(0, Math.hypot(b.x - x, b.z - z) - b.yaricap); b.mesafe = d;
      let lod = b.lod;
      if (this.zorla != null) lod = this.zorla;
      else if (lod === 0) { if (d > this.yakin + this.tampon) lod = d > this.orta + this.tampon ? 2 : 1; }
      else if (lod === 1) { if (d < this.yakin) lod = 0; else if (d > this.orta + this.tampon) lod = 2; }
      else if (d < this.orta) lod = d < this.yakin ? 0 : 1;
      if (lod !== b.lod || !b.mesh[lod]) {
        if (!b.mesh[lod]) this.#meshKur(b, lod);
        b.lod = lod;
        for (const l of [0, 1]) if (b.mesh[l]) b.mesh[l].visible = l === lod;
      }
    }
  }
  istatistik() { const s = { lod: [0, 0, 0], ucgen: [0, 0, 0] }; for (const b of this.binalar) { s.lod[b.lod]++; s.ucgen[b.lod] += b.mesh[b.lod].geometry.attributes.position.count / 3; } return s; }
}
