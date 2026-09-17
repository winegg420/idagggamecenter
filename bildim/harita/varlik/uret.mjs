// ============================================================
// VARLIK ÜRETİCİ — Aşama 1 / 1B / 1C test varlıkları (STIL.md şartnamesine göre)
//
//   node bildim/harita/varlik/uret.mjs   [--ao-kapali]
//   → public/meydan/deneme/atlas.png (+ atlas_eski.png, atlas_yaprakEski.png A/B), temas.png,
//     karakter_{insan,kaplan,robot}.glb, bina_dukkan.glb, prop_*.glb, bordur.glb, zemin_deneme.glb, *.olcum.json
//
// Bu makinede Blender yok; modeller three.js geometrileriyle KODLA kurulur,
// tek mesh'te birleştirilir, tek atlasa UV'lenir ve GLB olarak dışa aktarılır.
// Oyun çalışma anında yalnız GLB yükler — sanatçıdan gelecek GLB aynı
// sözleşmeyle (iskelet adları, yuvalar, ölçek, atlas, bölge kodları) bu dosyaların yerine geçer.
//
// AŞAMA 1C:
//  · Yön: rig ileri −Z, kök π → oyun +Z (bind pozunda ölçüldü). Skinned mesh birim bind.
//  · Yüz BOYALI: kafa küresi düzlemsel UV ile atlas yüz bölgesine; göz/ağız birer dörtgen
//    (UV kaydırma = ifade). Geometride yalnız burun (+ kaplan burun/kulak, robot anten).
//  · `bolge` köşe özniteliği (glTF `_BOLGE`): çalışma anında pürüzlülük, emisyon, ton,
//    saç/kıyafet varyantı seçimi (istenmeyen varyant köşeleri merkeze çökertilir → ek çağrı yok).
//  · Üç tür aynı iskelet + aynı 15 yuva: insan, kaplan (kuyruk sirtYuva'da), robot.
//  · Sokak kedisi (4 ayak, ayrı basit model), zemin döşemesi, yeni ağaç (yüksek taç, 4 lob).
//
// AŞAMA 1D:
//  · Kafa 28×18 küre; göz çukuru / kaş kemeri / burun / elmacık / çene mevcut köşelerin normal boyunca
//    KAYDIRILMASIYLA (üçgen eklemez). 28 sütun: ön orta hatta köşe var → burun sırtı tek sırada yükselir.
//    Ayrı burun küresi KALKTI.
//  · Göz/ağız düz dörtgen DEĞİL: dış hattı oval yama (16 dış + 8 iç + merkez = 32 üçgen), her köşesi
//    kafa yüzeyinde + 1 mm. Şeffaflık yok; hücre kenarı ten rengi. İfade hâlâ UV kaydırma.
//  · Kaplan: muzzle + alt çene + yanak tutamları aynı köşe kaydırmayla (siluetten okunur), gözler yana/yukarı.
//  · Robot: gövde baştan — pahlı mekanik gövde, ayrık küresel omuz/dirsek/diz eklemleri + halkalar, üç
//    parmaklı kıskaç, taban plakası + bilek pistonu, boyun pistonu, yuvarlak kafa + emissive ekran yüz,
//    tepede anten. Aynı iskelet, aynı 15 yuva. Kozmetik varyantları: şapka (anten halkalı), vizör.
//  · Prop: bank 972→320, saksı 528→256, lamba 500→220 üçgen (siluet aynı). Ağaç tacı gölgesini çalışma
//    anındaki düşük poligonlu vekil atar (DenemeSayfasi).
// ============================================================
import "./polyfill.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { atlasCiz, temasCiz, uvMerkez, uvDikdortgen, hucreTablosu, YUZ, IFADE, ifadeRect } from "./atlas.mjs";
import { aoHesapla, bolme } from "./ao.mjs";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const CIKTI = path.join(KOK, "public/meydan/deneme");
fs.mkdirSync(CIKTI, { recursive: true });

// STIL.md §2.3 bütçeleri — aşan varlık REDDEDİLİR
const BUTCE = { karakterUcgen: 9000, kozmetikUcgen: 600, heroKozmetikUcgen: 1200, binaUcgen: 12000, propUcgen: 1500, kediUcgen: 800 };   // robot ≤ 9.000 (Aşama 1D §4)
const AO_KAPALI = process.argv.includes("--ao-kapali");
/**
 * 1G-A.4 KOZMETİK POLİTİKALARI — tür dışlama hacmi (kulak · muzzle · anten) ile çakışınca ne olur:
 *   gecir        → tür parçası kozmetiğin içinden çıkar (kasıtlı)       · gizle → tür parçası çökertilir
 *   bicimlendir  → kozmetik ölçeklenir/kaydırılır ({olcek, kaydir})     · it    → kozmetik +Z'ye itilir ({mesafe})
 * Yeni kozmetikte tek satır politika yazılır; tür başına varyant modeli yazılmaz. Muayene `kozmetik` testi bunu okur ve susturur.
 */
const POLITIKA = {
  sapka: { kulak: "gecir", anten: "gecir" },   // Paket 21 §F: kubbe artık kafaya oturuyor ve tepesi antene açık — 3 cm yukarı kaydırma kalktı (şapkayı havada bırakıyordu, ölçüldü)
  gozluk: { muzzle: { tip: "it", mesafe: 0.04 } },
  gozlukPremium: { muzzle: { tip: "it", mesafe: 0.04 } },   // 1G-B.3: kaplan muzzle → 4 cm öne
  kanat: {},                                                // 1G-B.2: tür hacimleriyle kesişmez
  atki: {},
  kuyruk: {},
};
const PURUZ = 0.82;

/**
 * BÖLGE KODLARI (köşe özniteliği `bolge` → glTF `_BOLGE`). Çalışma anı:
 * pürüzlülük tablosu + emisyon (ekran) + ton çarpanı + varyant çökertme.
 */
export const BOLGE = {
  ten: 0, sacKase: 1, sacKisa: 2, sacKuyruk: 3, ust: 4, alt: 5, ayakkabi: 6, ceket: 7, kapuson: 8,
  kurk: 9, metal: 10, boya: 11, ekran: 12, gozL: 13, gozR: 14, agiz: 15, cam: 16, diger: 17, yaka: 18, taban: 19, bilek: 20,
  plastik: 21,   // Aşama 1D §4.3: robot eklem halkaları / piston / taban plakası (mat plastik)
  premiumMetal: 24,   // Aşama 1G-B.3: premium gözlük çerçevesi (metalness 0,9 — shader tablosu); robot 'metal' bölgesi DEĞİŞMEZ
  turKulak: 22, turAnten: 23,   // Aşama 1G-A.4: tür parçaları (kaplan kulağı, robot anteni) — kozmetik sözleşmesi `gizle` politikası bunları çökertir
};

// ------------------------------------------------------------ uv / geometri yardımcıları
function duz(geo, hucre) { const [u, v] = uvMerkez(hucre); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v); return geo; }
function yay(geo, hucre) { const d = uvDikdortgen(hucre); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, d.u0 + (d.u1 - d.u0) * uv.getX(i), d.v0 + (d.v1 - d.v0) * (1 - uv.getY(i))); return geo; }
function yerlestir(geo, poz, don = null, olcek = null) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...poz), don ?? new THREE.Quaternion(), new THREE.Vector3(...(olcek ?? [1, 1, 1]))));
  return geo;
}
const ucgenSay = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
function temizle(geo) {
  if (geo.index) geo = geo.toNonIndexed();
  for (const ad of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "skinIndex", "skinWeight", "bolge"].includes(ad)) geo.deleteAttribute(ad);
  if (!geo.attributes.bolge) geo.setAttribute("bolge", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(BOLGE.diger), 1));
  return geo;
}
function bolgeYaz(geo, b) { const n = geo.attributes.position.count; geo.setAttribute("bolge", new THREE.BufferAttribute(new Float32Array(n).fill(b), 1)); return geo; }
/** Pahlı kutu — SEÇİCİ. Yarıçap = min(kenar)×0,06, 1,5–12 cm, 1 bölüm. */
function pahli(w, h, d) { const r = Math.min(0.12, Math.max(0.015, Math.min(w, h, d) * 0.06)); return new RoundedBoxGeometry(w, h, d, 1, r); }
/**
 * UCUZ pahlı kutu (Aşama 1D Bölüm D): kenarlar tek düz pahla kesilir → 6 sekizgen yüz + 12 kenar dörtgeni +
 * 8 köşe üçgeni = 68 üçgen (RoundedBox 1 bölüm 108). Uzaktan bakılan prop'lar için (bank çıtası). UV üstten düzlemsel.
 */
function pahliUcuz(w, h, d, c = 0.012) {
  const H = [w / 2, h / 2, d / 2]; c = Math.min(c, w / 3, h / 3, d / 3);
  const pos = [], uv = [];
  const ucgen = (a, b, cc) => {
    // dışa bakan yön: üçgen merkezi (kutu merkezde) → normal ile aynı işaretli olmalı
    const nx = (b[1] - a[1]) * (cc[2] - a[2]) - (b[2] - a[2]) * (cc[1] - a[1]), ny = (b[2] - a[2]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[2] - a[2]), nz = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]);
    const mx = a[0] + b[0] + cc[0], my = a[1] + b[1] + cc[1], mz = a[2] + b[2] + cc[2];
    const sira = nx * mx + ny * my + nz * mz >= 0 ? [a, b, cc] : [a, cc, b];
    for (const p of sira) { pos.push(p[0], p[1], p[2]); uv.push(p[0] / w + 0.5, p[2] / d + 0.5); }
  };
  const q = (sx, sy, sz, kisa) => { const p = [sx * H[0], sy * H[1], sz * H[2]]; p[kisa] -= Math.sign(p[kisa]) * c; return p; };
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {   // yüz sekizgeni
    const b = (a + 1) % 3, cc = (a + 2) % 3, halka = [];
    for (const sb of [-1, 1]) for (const sc of [-1, 1]) { const S = [0, 0, 0]; S[a] = s; S[b] = sb; S[cc] = sc; halka.push(q(...S, cc), q(...S, b)); }
    halka.sort((p, r) => Math.atan2(p[cc], p[b]) - Math.atan2(r[cc], r[b]));
    for (let i = 1; i < 7; i++) ucgen(halka[0], halka[i], halka[i + 1]);
  }
  for (let a = 0; a < 3; a++) for (const sb of [-1, 1]) for (const sc of [-1, 1]) {   // kenar dörtgeni (eksen a boyunca)
    const b = (a + 1) % 3, cc = (a + 2) % 3, P = (sa, kisa) => { const S = [0, 0, 0]; S[a] = sa; S[b] = sb; S[cc] = sc; return q(...S, kisa); };
    ucgen(P(-1, b), P(1, b), P(1, cc)); ucgen(P(-1, b), P(1, cc), P(-1, cc));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) ucgen(q(sx, sy, sz, 0), q(sx, sy, sz, 1), q(sx, sy, sz, 2));   // köşe üçgeni
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
/** Aşama 1C §9: yalnız ÖN/ARKA yüz 0,8 m ızgara (ön cephe AO'su), yanlar bölünmez. */
function bolunmusKutu(w, h, d) { return new THREE.BoxGeometry(w, h, d, bolme(w, 0.8), bolme(h, 0.8), 1); }
const birlestir = (geos) => mergeVertices(mergeGeometries(geos.map(temizle), false));
const malzemeYap = () => new THREE.MeshStandardMaterial({ name: "Atlas", roughness: PURUZ, metalness: 0 });
const D = (geo, hucre, poz, don = null, olcek = null, b = BOLGE.diger) => bolgeYaz(duz(yerlestir(geo, poz, don, olcek), hucre), b);
const Y = (geo, hucre, poz, don = null, olcek = null, b = BOLGE.diger) => bolgeYaz(yay(yerlestir(geo, poz, don, olcek), hucre), b);

/**
 * Paket 21 §F — KAFAYA OTURAN KAPALI KUBBE (şapka). Eski kubbe tek yüzeyli yarım küreydi: yarıçapı kafadan
 * 2,7 cm büyük, merkezi 9 cm yukarıdaydı (ölçüldü: temas %5-13, medyan boşluk 2,5-5,8 cm, altı 0,10 m² açık).
 * Artık profil KAPALI bir konturdur (iç yüzey → alt kenar → dış yüzey → tepe halkası → iç yüzey): kabuk kapalı
 * (delik yok) ve İÇ yüzeyi gövdeye bakar → `oturma` testi gerçekten ölçebilir. Kafa elipsoidi türe göre ölçekli
 * olduğundan profil türün kafa yarı eksenlerinden türetilir; yuva uzayında kafa merkezi (0, −0,22, 0).
 * @param {[number,number,number]} basOlcek türün kafa ölçeği  @param {number} R kafa yarıçapı
 */
function kubbeProfili(basOlcek, R, { pay = 0.004, kalinlik = 0.018, t1 = 0.42 * Math.PI, tepeR = 0.012, N = 4 } = {}) {
  const [sx, sy] = basOlcek, ic = [], dis = [];
  const ri = R * sx + pay, yi = R * sy + pay, rd = ri + kalinlik, yd = yi + kalinlik;
  // t: tepeden alt kenara. Tepede r = tepeR (kapalı kontur için düz halka; tekil eksen köşesi üretilmez).
  const t0 = Math.asin(Math.min(1, tepeR / ri));
  for (let i = 0; i <= N; i++) { const t = t0 + (i / N) * (t1 - t0); ic.push(new THREE.Vector2(ri * Math.sin(t), yi * Math.cos(t))); dis.push(new THREE.Vector2(rd * Math.sin(t), yd * Math.cos(t))); }
  const kontur = [...ic, ...dis.reverse()];
  kontur.push(kontur[0].clone());   // KAPALI kontur → kapalı yüzey
  return { kontur, kenarR: ri * Math.sin(t1), kenarY: yi * Math.cos(t1) };
}
/**
 * Paket 21 §F — KAFAYA OTURAN KAPALI BANT (robot vizörü). Eski vizör açık uçlu bir silindir yayıydı: iç yüzeyi
 * yoktu (gövdeye bakan köşe 0), yüzden 4,7-6,0 cm uzaktaydı ve 3 açık kenar döngüsü vardı (ölçüldü).
 * Yüzey her açı/yükseklikte gövdeye ışınla bulunur; iç + dış yüzey ve dört kenar bandı kapalı bir kabuk oluşturur.
 * @param {(n:THREE.Vector3, baslangic?:THREE.Vector3)=>number|null} yuzey
 */
function kafayaOturanBant(yuzey, merkez, { aci0 = -0.95, aciBoy = 1.9, yukari = 0.055, asagi = -0.055, pay = 0.004, kalinlik = 0.014, segment = 12, yedek = 0.24 } = {}) {
  const poz = [], uv = [], idx = [];
  const halka = (y, ek) => {
    const bas = poz.length / 3;
    for (let j = 0; j <= segment; j++) {
      const a = aci0 + (j / segment) * aciBoy;
      const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const b = merkez.clone().add(new THREE.Vector3(0, y, 0));
      const r = (yuzey(n, b) ?? yedek) + ek;
      poz.push(b.x + n.x * r, b.y, b.z + n.z * r);
      uv.push(j / segment, (y - asagi) / (yukari - asagi));
    }
    return bas;
  };
  const serit = (a, b, ters) => {
    for (let j = 0; j < segment; j++) {
      const q = [a + j, a + j + 1, b + j + 1, b + j];
      if (ters) idx.push(q[0], q[2], q[1], q[0], q[3], q[2]); else idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    }
  };
  const iA = halka(asagi, pay), iU = halka(yukari, pay), dA = halka(asagi, pay + kalinlik), dU = halka(yukari, pay + kalinlik);
  serit(iA, iU, false); serit(dA, dU, true);     // iç yüzey içe, dış yüzey dışa bakar
  serit(iU, dU, false); serit(dA, iA, false);    // üst ve alt kenar bantları
  idx.push(iA, dA, dU, iA, dU, iU);                                                     // sol yan kapak
  idx.push(iA + segment, iU + segment, dU + segment, iA + segment, dU + segment, dA + segment);   // sağ yan kapak
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Paket 21 §C/§F — AÇIK KENARLARI KAPAT: 1 üçgene ait kenarlar delik döngülerine bağlanır, her döngü merkezine
 * bir köşe eklenip yelpaze üçgenlerle kapatılır. Tüpün açık ucu (kaplan kuyruğu) gibi kapaksız kalan yerler için.
 * Geometri kaynaştırılmış (mergeVertices) ve indeksli olmalı.
 */
function delikleriKapat(geo) {
  const g = mergeVertices(geo.index ? geo : geo);
  const idx = Array.from(g.index.array), p = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  const anahtar = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const sayac = new Map(), yon = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = anahtar(x, y); sayac.set(k, (sayac.get(k) ?? 0) + 1); yon.set(k, [x, y]); }
  }
  const acik = [...sayac].filter(([, n]) => n === 1).map(([k]) => yon.get(k));
  if (!acik.length) return g;
  const sonraki = new Map(acik.map(([a, b]) => [a, b]));
  const poz = Array.from(p.array), uvs = uv ? Array.from(uv.array) : null, nor = nrm ? Array.from(nrm.array) : null;
  const gorulen = new Set();
  for (const [bas] of acik) {
    if (gorulen.has(bas)) continue;
    const dongu = [];
    let k = bas;
    while (k != null && !gorulen.has(k)) { gorulen.add(k); dongu.push(k); k = sonraki.get(k); }
    if (dongu.length < 3) continue;
    const m = new THREE.Vector3();
    for (const i of dongu) m.add(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
    m.multiplyScalar(1 / dongu.length);
    const mi = poz.length / 3;
    poz.push(m.x, m.y, m.z);
    if (uvs) { let u = 0, v = 0; for (const i of dongu) { u += uv.getX(i); v += uv.getY(i); } uvs.push(u / dongu.length, v / dongu.length); }
    if (nor) nor.push(0, 1, 0);
    for (let i = 0; i < dongu.length; i++) {
      const a = dongu[i], b = dongu[(i + 1) % dongu.length];
      if (sonraki.get(a) !== b) continue;   // yalnız gerçek açık kenarlar
      idx.push(b, a, mi);                   // kapak ters sarımla (dışa bakar)
    }
  }
  const y = new THREE.BufferGeometry();
  y.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  if (uvs) y.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  y.setIndex(idx);
  y.computeVertexNormals();
  return y;
}

/**
 * KAFAYA OTURAN KAPALI KUBBE — türün GERÇEK (çokgen) kafa yüzeyi örneklenir (`kafaYuzey(n)`), lathe/küre değil:
 * robot kafası basık ve ekran yüzlü, kaplanınki geniş; tek bir dönel profil hiçbirine oturmuyordu (ölçüldü).
 * İç yüzey kafadan `pay` kadar açıkta (temas eşiği içinde), dış yüzey `kalinlik` kadar dışarıda; alt kenar ve
 * tepe halkası bantla kapatılır → kabuk kapalı (delik yok) ve gövdeye bakan iç yüzeyi var (oturma ölçülebilir).
 * @param {(n:THREE.Vector3)=>number} kafaYuzey  basM'den n yönünde kafa yüzeyine uzaklık
 * @param {THREE.Vector3} merkez  kafa merkezi (kozmetiğin yuva uzayında)
 */
function kafayaOturanKubbe(kafaYuzey, merkez, { segment = 16, N = 4, t0 = 0.10, t1 = 0.32 * Math.PI, pay = -0.004, kalinlik = 0.022 } = {}) {
  const poz = [], uv = [], idx = [];
  const halka = (t, ek) => {
    const bas = poz.length / 3;
    for (let j = 0; j <= segment; j++) {
      const u = (j / segment) * Math.PI * 2;
      const n = new THREE.Vector3(Math.sin(t) * Math.sin(u), Math.cos(t), Math.sin(t) * Math.cos(u));
      const p = n.clone().multiplyScalar(kafaYuzey(n) + ek).add(merkez);
      poz.push(p.x, p.y, p.z); uv.push(j / segment, t / t1);
    }
    return bas;
  };
  const serit = (a, b, ters) => {   // iki halkayı birleştir (a → b)
    for (let j = 0; j < segment; j++) {
      const q = [a + j, a + j + 1, b + j + 1, b + j];
      if (ters) idx.push(q[0], q[2], q[1], q[0], q[3], q[2]); else idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    }
  };
  const icH = [], disH = [];
  for (let i = 0; i <= N; i++) { const t = t0 + (i / N) * (t1 - t0); icH.push(halka(t, pay)); disH.push(halka(t, pay + kalinlik)); }
  for (let i = 0; i < N; i++) { serit(icH[i], icH[i + 1], false); serit(disH[i], disH[i + 1], true); }   // sarım: dış yüzey dışa, iç yüzey içe bakar (işaretli hacim ile doğrulandı)
  serit(icH[N], disH[N], true);   // alt kenar bandı
  serit(disH[0], icH[0], true);   // tepe halkası
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // kenar ölçüleri: siper ve halka buraya yaslanır
  const kn = new THREE.Vector3(0, Math.cos(t1), Math.sin(t1)), kr = kafaYuzey(kn) + pay;
  const onZ = kafaYuzey(new THREE.Vector3(0, 0, 1)) + pay;   // kafanın ÖN yüzeyi: siper buradan ileride başlar (robot kafası basık, kubbe kenarı içeride kalıyordu)
  return { geo: g, kenarY: merkez.y + Math.cos(t1) * kr, kenarZ: Math.sin(t1) * kr, kenarR: Math.sin(t1) * kr, onZ, tepeY: merkez.y + kafaYuzey(new THREE.Vector3(0, 1, 0)) + pay + kalinlik };
}

// ------------------------------------------------------------ İSKELET
const MIXAMO = JSON.parse(fs.readFileSync(path.join(BURASI, "mixamo.json"), "utf8"));
const OLCEK = 0.92 / 1.061;   // Mixamo kalça 1,061 m → 0,92 m (tıknaz, baş büyük)

function iskeletKur() {
  const kemikler = new Map();
  for (const k of MIXAMO.iskelet) { const b = new THREE.Bone(); b.name = k.ad; b.position.fromArray(k.poz); b.quaternion.fromArray(k.don); kemikler.set(k.ad, b); }
  for (const k of MIXAMO.iskelet) if (k.ebeveyn) kemikler.get(k.ebeveyn).add(kemikler.get(k.ad));
  const rig = new THREE.Object3D(); rig.name = "Rig";
  rig.position.fromArray(MIXAMO.kok.poz).multiplyScalar(OLCEK);
  rig.quaternion.fromArray(MIXAMO.kok.don);
  rig.scale.setScalar(MIXAMO.kok.olcek[0] * OLCEK);
  rig.add(kemikler.get("Hips"));
  return { rig, kemikler, sira: MIXAMO.iskelet.map((k) => k.ad) };
}

// ------------------------------------------------------------ KARAKTER (tur: insan | kaplan | robot)
function karakterKur(tur = "insan") {
  const { rig, kemikler, sira } = iskeletKur();
  // Rig ileri −Z (bind pozunda ölçüldü) → kök π: dünya +Z ileri. Geometri W() ile DÜNYA uzayında (π dahil) kurulur.
  const karakter = new THREE.Group(); karakter.name = "Karakter";
  const yon = new THREE.Group(); yon.name = "Yon"; yon.rotation.y = Math.PI;
  karakter.add(yon); yon.add(rig);
  karakter.updateMatrixWorld(true);

  const W = (ad) => kemikler.get(ad).getWorldPosition(new THREE.Vector3());
  const idx = (ad) => sira.indexOf(ad);
  const parcalar = [];
  const insan = tur === "insan", kaplan = tur === "kaplan", robot = tur === "robot";
  const TEN = robot ? "metal" : kaplan ? "kurk" : "ten";
  const TEN_B = robot ? BOLGE.metal : kaplan ? BOLGE.kurk : BOLGE.ten;

  /** Parça ekle: hücre, kemik, bölge; desenli → hücre dikdörtgenine yay; uvFn özel eşleme. */
  const ekle = (geo, hucre, kemik, b, { desenli = false, uvFn = null } = {}) => {
    geo = temizle(geo);
    if (uvFn) uvFn(geo); else desenli ? yay(geo, hucre) : duz(geo, hucre);
    const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = idx(kemik); sw[i * 4] = 1; }
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    bolgeYaz(geo, b);
    parcalar.push(geo);
    return geo;
  };
  const kapsul = (a, b, r, hucre, kemik, bolge, desenli = false) => {
    const yonV = b.clone().sub(a), L = yonV.length();
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, L - 2 * r * 0.35), 3, 8);
    return ekle(yerlestir(geo, a.clone().lerp(b, 0.5).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), yonV.normalize())), hucre, kemik, bolge, { desenli });
  };
  const kure = (poz, r, hucre, kemik, bolge, olcek = [1, 1, 1], seg = 16, desenli = false) =>
    ekle(yerlestir(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), poz.toArray(), null, olcek), hucre, kemik, bolge, { desenli });

  const hips = W("Hips"), neck = W("Neck"), head = W("Head");
  const R = 0.235, basM = head.clone().add(new THREE.Vector3(0, 0.20, 0.01));
  const silindir = (a, b, r0, r1, hucre, kemik, bolge, desenli = false, seg = 10) => { const v = b.clone().sub(a), L = v.length(); return ekle(yerlestir(new THREE.CylinderGeometry(r0, r1, L, seg), a.clone().lerp(b, 0.5).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())), hucre, kemik, bolge, { desenli }); };
  const halka = (poz, eksen, r, tube, hucre, kemik, bolge, desenli = false) => ekle(yerlestir(new THREE.TorusGeometry(r, tube, 6, 12), poz.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eksen.clone().normalize())), hucre, kemik, bolge, { desenli });

  if (!robot) {
    // ---- gövde: kalça + göğüs (tıknaz) ----
    ekle(yerlestir(new RoundedBoxGeometry(0.42, 0.30, 0.30, 2, 0.10), hips.clone().add(new THREE.Vector3(0, -0.02, 0)).toArray()), "kot", "Hips", BOLGE.alt, { desenli: true });
    kapsul(hips.clone().add(new THREE.Vector3(0, 0.08, 0)), neck.clone().add(new THREE.Vector3(0, -0.02, 0)), kaplan ? 0.232 : 0.215, "tisort", "Spine1", BOLGE.ust, true);   // 1G-A.3: kaplan göğsü daha geniş (hayvansı oran)
    // set 2 (şık): ceket kabuğu + gömlek yakası — diğer setlerde çalışma anında çökertilir
    kapsul(hips.clone().add(new THREE.Vector3(0, 0.1, 0)), neck.clone().add(new THREE.Vector3(0, -0.03, 0)), 0.228, "ceket", "Spine1", BOLGE.ceket, true);
    ekle(yerlestir(new RoundedBoxGeometry(0.16, 0.2, 0.03, 1, 0.01), neck.clone().add(new THREE.Vector3(0, -0.2, 0.235)).toArray()), "gomlek", "Spine2", BOLGE.yaka);
    for (const s of [-1, 1]) ekle(yerlestir(new RoundedBoxGeometry(0.07, 0.22, 0.02, 1, 0.008), neck.clone().add(new THREE.Vector3(s * 0.085, -0.2, 0.245)).toArray(), E(0, 0, s * 0.35)), "ceket", "Spine2", BOLGE.ceket, { desenli: true });
    // set 3 (spor): kapüşon halkası (boyun arkası)
    ekle(yerlestir(new THREE.TorusGeometry(0.19, 0.065, 6, 12), neck.clone().add(new THREE.Vector3(0, -0.02, -0.06)).toArray(), E(Math.PI / 2 + 0.5, 0, 0)), "esofman", "Spine2", BOLGE.kapuson, { desenli: true });
  } else {
    // ---- ROBOT GÖVDESİ (Aşama 1D §4): kalça bloğu + bel halkası + göğüs bloğu (ayrık kütleler), yan paneller (set rengi),
    //      göğüs ekranı + göstergeler, havalandırma çizgileri, boyun pistonu. Kumaş yok; malzeme = bölge (metal/boya/plastik/ekran).
    // 1G-A.1: 1E muayenesi eklemlerin %80–100 gömülü olduğunu ölçtü → kütleler KÜÇÜLDÜ ve ARALANDI. Kalça bloğu ile göğüs bloğu
    // arasında 8 cm boşluk (bel halkası açıkta), göğüs üstü ile kafa altı arasında boyun pistonu + halka görünür, omuz/kalça
    // küreleri kütlelerin dışına taşar. Ölçüm: eklem gömülülüğü < %40 (muayene `gomuluOranlar`).
    const gogusM = new THREE.Vector3(hips.x, 1.16, hips.z), belM = new THREE.Vector3(hips.x, 0.99, hips.z);
    ekle(yerlestir(new RoundedBoxGeometry(0.22, 0.14, 0.20, 2, 0.05), hips.clone().add(new THREE.Vector3(0, -0.05, 0)).toArray()), "metal", "Hips", BOLGE.metal);
    ekle(yerlestir(new THREE.CylinderGeometry(0.10, 0.10, 0.07, 12), belM.toArray()), "demir", "Spine", BOLGE.plastik);   // bel halkası 0,955–1,025 tamamen açıkta
    ekle(yerlestir(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), belM.toArray()), "metal", "Spine", BOLGE.metal);   // iç mil: iki bloğu bağlar (görünmez bağlantı)
    ekle(yerlestir(new RoundedBoxGeometry(0.30, 0.26, 0.26, 2, 0.06), gogusM.toArray()), "metal", "Spine1", BOLGE.metal);
    for (const s of [-1, 1]) ekle(yerlestir(new RoundedBoxGeometry(0.03, 0.18, 0.18, 1, 0.01), gogusM.clone().add(new THREE.Vector3(s * 0.155, 0, 0)).toArray()), "gomlek", "Spine1", BOLGE.boya, { desenli: true });
    const panel = gogusM.clone().add(new THREE.Vector3(0, 0.03, 0.135));
    ekle(yerlestir(new RoundedBoxGeometry(0.16, 0.10, 0.02, 1, 0.008), panel.toArray()), "ekran", "Spine1", BOLGE.ekran);
    for (let i = 0; i < 3; i++) kure(panel.clone().add(new THREE.Vector3(-0.04 + i * 0.04, 0.062, -0.006)), 0.011, "gomlek", "Spine1", BOLGE.boya, [1, 1, 0.6], 6, true);
    for (let i = 0; i < 3; i++) ekle(yerlestir(new THREE.BoxGeometry(0.14, 0.008, 0.014), panel.clone().add(new THREE.Vector3(0, -0.075 - i * 0.022, 0)).toArray()), "demir", "Spine1", BOLGE.plastik);
    ekle(yerlestir(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10, 1, true), neck.clone().add(new THREE.Vector3(0, 0.005, 0)).toArray()), "demir", "Neck", BOLGE.plastik);   // piston 1,285–1,365: göğüs üstü–kafa altı boşluğunu tam doldurur
    ekle(yerlestir(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), neck.clone().add(new THREE.Vector3(0, 0.02, 0)).toArray()), "metal", "Neck", BOLGE.metal);   // iç mil: göğüs–kafa bağlantısı
    halka(neck.clone().add(new THREE.Vector3(0, 0.01, 0)), new THREE.Vector3(0, 1, 0), 0.062, 0.013, "gomlek", "Neck", BOLGE.boya, true);
  }

  // ---- BAŞ (Aşama 1D §2): 28×18 küre; anatomi köşe kaydırmayla oyulur; göz/ağız yüzeye oturan yamalar ----
  const yuzR = YUZ[tur];
  const yuzUV = (geo) => {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - basM.x, dy = p.getY(i) - basM.y, dz = p.getZ(i) - basM.z;
      let u, v;
      if (dz >= -0.01) { u = 0.5 + (dx / (2 * R)) * 0.9; v = 0.5 - (dy / (2 * R)) * 0.9; }
      else { u = dx < 0 ? 0.02 : 0.98; v = 0.98; }   // arka yarı: kenar şeridine (ten rengi) — dikiş üçgenleri yüzü taramaz
      u = Math.max(0.02, Math.min(0.98, u)); v = Math.max(0.02, Math.min(0.98, v));
      uv.setXY(i, yuzR.u0 + (yuzR.u1 - yuzR.u0) * u, yuzR.v0 + (yuzR.v1 - yuzR.v0) * v);
    }
  };
  /**
   * Yüz anatomisi — kafa küresinin KÖŞELERİ normal boyunca kaydırılır (üçgen eklemez). Yerel (x,y) ön projeksiyon,
   * yalnız ön yarı. d>0 dışarı, d<0 içeri; rx/ry eliptik yarıçap (ryAlt: merkezin altında farklı yarıçap); guc: düşüş.
   */
  const OZELLIK = robot ? [] : kaplan ? [
    { x: 0, y: -0.06, rx: 0.115, ry: 0.085, ryAlt: 0.07, d: 0.055, guc: 0.7 },   // muzzle kütlesi (yassı plato, kafaya kaynamış)
    { x: 0, y: -0.035, rx: 0.04, ry: 0.035, d: 0.012 },                          // burun tepesi
    { x: 0, y: -0.15, rx: 0.085, ry: 0.045, d: 0.018 },                          // alt çene
    ...[-1, 1].flatMap((s) => [
      { x: s * 0.095, y: 0.035, rx: 0.06, ry: 0.045, d: -0.002 },                // göz çukuru (insandan yana + yukarı)
      { x: s * 0.09, y: 0.085, rx: 0.07, ry: 0.02, d: 0.002 },                   // kaş kemeri
      { x: s * 0.2, y: -0.07, rx: 0.045, ry: 0.06, d: 0.02 },                    // yanak kürk tutamı
      { x: s * 0.215, y: -0.02, rx: 0.03, ry: 0.03, d: 0.012 },                  // tırtık
      { x: s * 0.2, y: -0.115, rx: 0.03, ry: 0.03, d: 0.014 },
    ]),
  ] : [
    { x: 0, y: -0.041, rx: 0.068, ry: 0.1, ryAlt: 0.056, d: 0.03 },             // burun: ön orta sütun köşeleri dışa (ayrı küre KALKTI); profilden okunur
    { x: 0, y: -0.175, rx: 0.07, ry: 0.05, d: 0.006 },                          // çene
    ...[-1, 1].flatMap((s) => [
      { x: s * 0.082, y: 0.02, rx: 0.062, ry: 0.045, d: -0.002 },               // göz çukuru: 2 mm çanak (yumuşak gölge)
      { x: s * 0.08, y: 0.075, rx: 0.075, ry: 0.022, d: 0.0015 },               // kaş kemeri 1,5 mm
      { x: s * 0.125, y: -0.04, rx: 0.06, ry: 0.05, d: 0.003 },                 // elmacık
    ]),
  ];
  const basOlcek = robot ? [1, 0.84, 0.92] : kaplan ? [1.06, 1.0, 1.04] : [1, 1.02, 1];   // 1G-A.3: kaplan kafası daha geniş ve basık   // robot 1G: kafa altı 1,36 m → boyun pistonu göğüs üstü (1,29) ile kafa arasında görünür
  /** Yön n için kafa yüzeyinin yarıçapı: ölçekli küre + özellik kaydırmaları. Yamalar da bunu örnekler → yüzeye oturur. */
  const yuzeyYaricap = (n) => {
    let r = R / Math.sqrt((n.x / basOlcek[0]) ** 2 + (n.y / basOlcek[1]) ** 2 + (n.z / basOlcek[2]) ** 2);
    if (n.z <= 0) return r;
    const lx = n.x * r, ly = n.y * r;
    for (const o of OZELLIK) {
      const dx = (lx - o.x) / o.rx, dy = (ly - o.y) / (ly < o.y && o.ryAlt ? o.ryAlt : o.ry), d2 = dx * dx + dy * dy;
      if (d2 < 1) r += o.d * Math.pow(1 - d2, o.guc ?? 1.5);
    }
    return r;
  };
  const kafaOy = (geo) => {
    const p = geo.attributes.position, n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i) - basM.x, p.getY(i) - basM.y, p.getZ(i) - basM.z).normalize();
      const r = yuzeyYaricap(n);
      p.setXYZ(i, basM.x + n.x * r, basM.y + n.y * r, basM.z + n.z * r);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // 28 sütun (26 değil): ön orta hatta (phi = π/2) köşe sütunu düşer → burun sırtı tek sırada yükselir, ucu yassı kalmaz.
  const kafaGeo = kafaOy(yerlestir(new THREE.SphereGeometry(R, 28, 18), basM.toArray(), null, basOlcek));
  ekle(kafaGeo, TEN, "Head", TEN_B, robot ? {} : { uvFn: yuzUV });   // ekle indeksliyi kopyalar; kafaGeo ışın testi için kalır
  /**
   * basM'den n yönünde GERÇEK (çokgen) kafa yüzeyine uzaklık. Yamalar analitik küreye değil buna oturur: burun/muzzle
   * eteğinde analitik yüzey iç bükeydir, kafa üçgeni kirişi onun ÜSTÜNDE kalır → analitik+1 mm yama kafanın içinde
   * kalıyordu (göz altında açık üçgen olarak görünüyordu). Çokgene oturunca 1 mm ofset yeter.
   */
  const kafaP = kafaGeo.attributes.position, kafaI = kafaGeo.index, rA = new THREE.Vector3(), rB = new THREE.Vector3(), rC = new THREE.Vector3(), rH = new THREE.Vector3();
  const kafaYuzey = (n) => {
    const ray = new THREE.Ray(basM.clone(), n);
    let en = Infinity;
    for (let i = 0; i < kafaI.count; i += 3) {
      rA.fromBufferAttribute(kafaP, kafaI.getX(i)); rB.fromBufferAttribute(kafaP, kafaI.getX(i + 1)); rC.fromBufferAttribute(kafaP, kafaI.getX(i + 2));
      if (ray.intersectTriangle(rA, rB, rC, false, rH)) en = Math.min(en, rH.distanceTo(basM));
    }
    return Number.isFinite(en) ? en : yuzeyYaricap(n);
  };

  /**
   * Yüzeye OTURAN yama (§2.3): dış hattı oval (göz/ağız) ya da yuvarlak dikdörtgen (robot ekranı); her köşesi kafanın
   * ÇOKGEN yüzeyinde (ışın testi) + `ofset` (1 mm). Eşmerkezli halkalar (k. halkada 8k nokta; 3 halka = 72 üçgen) — kiriş sarkması ofsetin altında kalır.
   * UV: hücre içinde EN-BOY ORANI korunur (kısa eksen ortalanır) → ifade karesi ezilmez; `ayna` sağ göz için.
   */
  const yama = (cx, cy, w, h, uvR, bolge, { ofset = 0.001, bicim = "oval", ayna = false, halka = 3 } = {}) => {
    const pos = [], uvs = [], idx = [], asp = h / w;
    const nokta = (s, t) => {
      const lx = cx + s * w / 2, ly = cy + t * h / 2;
      const n = new THREE.Vector3(lx, ly, Math.sqrt(Math.max(1e-4, R * R - lx * lx - ly * ly))).normalize();
      const r = kafaYuzey(n) + ofset;
      pos.push(basM.x + n.x * r, basM.y + n.y * r, basM.z + n.z * r);
      let u = 0.5 + s * 0.5, v = 0.5 - t * 0.5;
      if (asp < 1) v = 0.5 - t * 0.5 * asp; else u = 0.5 + s * 0.5 / asp;
      if (ayna) u = 1 - u;
      uvs.push(uvR.u0 + (uvR.u1 - uvR.u0) * u, uvR.v0 + (uvR.v1 - uvR.v0) * v);
      return pos.length / 3 - 1;
    };
    const hat = (a) => bicim === "oval" ? [Math.cos(a), Math.sin(a)]
      : [Math.sign(Math.cos(a)) * Math.sqrt(Math.abs(Math.cos(a))), Math.sign(Math.sin(a)) * Math.sqrt(Math.abs(Math.sin(a)))];   // süperelips n=4
    // Halka k'da 8k nokta; üçgen sayısı 8·halka². Kiriş sarkması c²/2R: halka=3'te göz yamasında yarım kiriş ≈ 11 mm → 0,26 mm
    // (< 1 mm ofset). İlk deneme halka=2 idi (yarım kiriş 22 mm → 1,03 mm sarkma) → kafa yamanın içinden çıkıyordu.
    const halkalar = [[nokta(0, 0)]];
    for (let k = 1; k <= halka; k++) { const n = 8 * k, r = k / halka, dizi = []; for (let i = 0; i < n; i++) { const [x, y] = hat((i / n) * Math.PI * 2); dizi.push(nokta(x * r, y * r)); } halkalar.push(dizi); }
    for (let k = 1; k <= halka; k++) {
      const A = halkalar[k - 1], B = halkalar[k], nA = A.length, nB = B.length;
      if (nA === 1) { for (let i = 0; i < nB; i++) idx.push(A[0], B[i], B[(i + 1) % nB]); continue; }
      let ia = 0, ib = 0;
      while (ia < nA || ib < nB) {   // iki halkayı açı sırasıyla birleştir (CCW)
        if (ib < nB && (ia >= nA || (ib + 1) / nB <= (ia + 1) / nA)) { idx.push(A[ia % nA], B[ib % nB], B[(ib + 1) % nB]); ib++; }
        else { idx.push(A[ia % nA], B[ib % nB], A[(ia + 1) % nA]); ia++; }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return ekle(geo, TEN, "Head", bolge, { uvFn: () => {} });
  };
  const gozKare = robot ? IFADE.goz.robotAcik : IFADE.goz.acik, agizKare = robot ? IFADE.agiz.robotNotr : IFADE.agiz.notr;
  // Göz 0,115 → 0,088 m (§2.4). Kaplan gözleri yana + yukarı; ağız muzzle'ın alt ön yüzünde.
  const gozP = robot ? { x: 0.07, y: 0.03, w: 0.075, h: 0.06 } : kaplan ? { x: 0.095, y: 0.05, w: 0.084, h: 0.098 } : { x: 0.082, y: 0.035, w: 0.088, h: 0.1 };   // 1G-A.2: insan/kaplan yaması uzadı — kaş da karede
  const agizP = robot ? { y: -0.06, w: 0.09, h: 0.036 } : kaplan ? { y: -0.115, w: 0.075, h: 0.045 } : { y: -0.105, w: 0.07, h: 0.045 };
  if (robot) yama(0, 0, 0.30, 0.22, yuzR, BOLGE.ekran, { ofset: 0.0015, bicim: "dikdortgen", halka: 5 });   // yüz = kafaya oturan emissive ekran paneli (200 üçgen; 30 cm panelde sarkma 0,5 mm)
  const yOfs = robot ? 0.002 : 0.001;   // robotta göz/ağız ekranın 0,5 mm üstünde (1G: 1,5 mm kenar çıkıntısı parlak "ok" izi yapıyordu)
  yama(-gozP.x, gozP.y, gozP.w, gozP.h, ifadeRect(gozKare), BOLGE.gozL, { ofset: yOfs });
  yama(gozP.x, gozP.y, gozP.w, gozP.h, ifadeRect(gozKare), BOLGE.gozR, { ofset: yOfs, ayna: true });
  yama(0, agizP.y, agizP.w, agizP.h, ifadeRect(agizKare), BOLGE.agiz, { ofset: yOfs });
  if (!robot) {
    // kulaklar (kulakYuva hizası): insanda küçük yarım küre, kaplanda yuvarlak kulak + iç kulak (1C, korunur)
    for (const s of [-1, 1]) {
      if (insan) kure(basM.clone().add(new THREE.Vector3(s * 0.228, -0.02, 0.01)), 0.045, "ten", "Head", BOLGE.ten, [0.5, 1, 0.8], 8);
      else {
        kure(basM.clone().add(new THREE.Vector3(s * 0.165, 0.225, -0.01)), 0.085, "kurk", "Head", BOLGE.turKulak, [1, 1.3, 0.55], 10, true);
        kure(basM.clone().add(new THREE.Vector3(s * 0.165, 0.23, 0.03)), 0.05, "kurkKarin", "Head", BOLGE.turKulak, [1, 1.25, 0.4], 8);
      }
    }
  } else {
    // robot: tepede anten (şapka kubbesinin üstünden çıkar), yanlarda hoparlör kapakları
    ekle(yerlestir(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 8), basM.clone().add(new THREE.Vector3(0, 0.31, 0)).toArray()), "metal", "Head", BOLGE.turAnten);
    kure(basM.clone().add(new THREE.Vector3(0, 0.44, 0)), 0.035, "gomlek", "Head", BOLGE.turAnten, [1, 1, 1], 10, true);
    for (const s of [-1, 1]) ekle(yerlestir(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), basM.clone().add(new THREE.Vector3(s * 0.235, -0.01, 0)).toArray(), E(0, 0, Math.PI / 2)), "demir", "Head", BOLGE.plastik);
  }
  // ---- saç varyantları (yalnız insan; çalışma anında biri kalır, diğerleri çökertilir) ----
  if (insan) {
    const sacQ = E(-0.32, 0, 0);
    // 1 kâse: ana kabuk + kâkül lobu + arka lob (siluet kırılır, §5.2)
    // 1G-A.2: kabuk 0,5π → 0,56π (şakaktaki sert basamak saç çizgisinin altına iner); kâkül lobu kabuğun içine gömülü, yalnız alın üstünde hafif kabartı
    ekle(yerlestir(new THREE.SphereGeometry(0.25, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.56), basM.clone().add(new THREE.Vector3(0, 0.02, -0.02)).toArray(), sacQ), "sac", "Head", BOLGE.sacKase, { desenli: true });
    kure(basM.clone().add(new THREE.Vector3(0, 0.11, 0.16)), 0.11, "sac", "Head", BOLGE.sacKase, [1.5, 0.55, 0.6], 8, true);
    kure(basM.clone().add(new THREE.Vector3(0, 0.02, -0.19)), 0.12, "sac", "Head", BOLGE.sacKase, [1.4, 1.1, 0.7], 8, true);
    // 2 kısa: üst kapak + favoriler
    ekle(yerlestir(new THREE.SphereGeometry(0.245, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), basM.clone().add(new THREE.Vector3(0, 0.02, -0.01)).toArray(), E(-0.15, 0, 0)), "sac", "Head", BOLGE.sacKisa, { desenli: true });
    for (const s of [-1, 1]) kure(basM.clone().add(new THREE.Vector3(s * 0.215, -0.02, -0.02)), 0.05, "sac", "Head", BOLGE.sacKisa, [0.6, 1.4, 1], 8, true);
    // 3 at kuyruğu: kabuk + arkada toplanmış kuyruk + saç bandı
    ekle(yerlestir(new THREE.SphereGeometry(0.248, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.47), basM.clone().add(new THREE.Vector3(0, 0.02, -0.01)).toArray(), E(-0.2, 0, 0)), "sac", "Head", BOLGE.sacKuyruk, { desenli: true });
    kure(basM.clone().add(new THREE.Vector3(0, 0.1, -0.24)), 0.07, "sac", "Head", BOLGE.sacKuyruk, [1, 1, 1], 8, true);
    kapsul(basM.clone().add(new THREE.Vector3(0, 0.08, -0.27)), basM.clone().add(new THREE.Vector3(0, -0.2, -0.26)), 0.05, "sac", "Head", BOLGE.sacKuyruk, true);
    ekle(yerlestir(new THREE.TorusGeometry(0.06, 0.014, 5, 10), basM.clone().add(new THREE.Vector3(0, 0.1, -0.24)).toArray(), E(0.3, 0, 0)), "bayrak", "Head", BOLGE.sacKuyruk);
  }
  // ---- kollar + bacaklar ----
  for (const t of ["Left", "Right"]) {
    const arm = W(t + "Arm"), fore = W(t + "ForeArm"), hand = W(t + "Hand");
    const yonEl = hand.clone().sub(fore).normalize();
    if (!robot) {
      kure(arm, 0.105, "tisort", t + "Arm", BOLGE.ust, [1, 1, 1], 10, true);
      kapsul(arm, fore, 0.082, "tisort", t + "Arm", BOLGE.ust, true);
      kapsul(fore, hand, 0.072, TEN, t + "ForeArm", TEN_B, kaplan);
      kure(fore, 0.078, TEN, t + "ForeArm", TEN_B, [1, 1, 1], 8, kaplan);   // 1G-A.2: dirsek küresi — kol iki ayrı silindir gibi durmasın
      const qEl = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), yonEl);
      if (insan) {
        // 1G-A.2 EL PROTOTİPİ ("3+1"): yassı avuç + 3 birleşik parmak kapsülü + öne bakan başparmak. Anatomik el hedef değil; siluet.
        // Maliyet: kapsül (r, l, 1, 6) = 36 üçgen × 4 = 144 + avuç 120 → ~264 / el (ölçüm .olcum.json'da).
        const avuc = hand.clone().add(yonEl.clone().multiplyScalar(0.035));
        kure(avuc, 0.07, TEN, t + "Hand", TEN_B, [1.0, 0.55, 1.25], 10);
        for (const dz of [-0.036, 0, 0.036]) {
          const g = new THREE.CapsuleGeometry(0.019, 0.055, 1, 6);
          ekle(yerlestir(g, hand.clone().add(yonEl.clone().multiplyScalar(0.105)).add(new THREE.Vector3(0, -0.004, dz)).toArray(), qEl), TEN, t + "Hand", TEN_B);
        }
        const bas = hand.clone().add(yonEl.clone().multiplyScalar(0.035)).add(new THREE.Vector3(0, -0.005, 0.078));
        ekle(yerlestir(new THREE.CapsuleGeometry(0.017, 0.045, 1, 6), bas.toArray(), qEl.clone().multiply(E(0.9, 0, 0))), TEN, t + "Hand", TEN_B);
      } else {
        // 1G-A.3 KAPLAN PATİSİ: yuvarlak pati + 3 parmak yumrusu + siyah taban yastıkları (insan elinden farklı siluet)
        const pati = hand.clone().add(yonEl.clone().multiplyScalar(0.045));
        kure(pati, 0.085, TEN, t + "Hand", TEN_B, [1.0, 0.8, 1.15], 10, true);
        for (const dz of [-0.05, 0, 0.05]) kure(hand.clone().add(yonEl.clone().multiplyScalar(0.11)).add(new THREE.Vector3(0, 0.005, dz)), 0.03, TEN, t + "Hand", TEN_B, [1.1, 0.8, 1], 8, true);
        kure(pati.clone().add(new THREE.Vector3(0, -0.07, 0)), 0.03, "gozBebek", t + "Hand", BOLGE.diger, [1.3, 0.35, 1.3], 8);
      }
      ekle(yerlestir(new THREE.TorusGeometry(0.07, 0.012, 5, 12), hand.clone().add(yonEl.clone().multiplyScalar(-0.01)).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), yonEl)), "tisort", t + "Hand", BOLGE.bilek, { desenli: true });
    } else {
      // ROBOT KOLU (1D §4.2): küresel omuz + halka (gövdeden ayrık) · üst kol silindiri · dirsek küresi + halka · ön kol paneli · üç parmaklı kıskaç
      // 1G-A.1: omuz küresi gövdenin DIŞINDA (kol ekseninde 3,5 cm dışa), üst kol dirsek küresine 5 cm kala biter, ön kol 5 cm
      // sonra başlar → küre ve halka siluetten okunur. El ön kola bağlı (1E: 2 cm kopuktu). Kıskaç: 3 belirgin parmak, uçları kavuşur.
      const disa = yonEl.clone(), omuz = arm.clone().add(disa.clone().multiplyScalar(0.035));
      kure(omuz, 0.075, "gomlek", t + "Arm", BOLGE.boya, [1, 1, 1], 10, true);
      halka(omuz, disa, 0.09, 0.012, "demir", t + "Arm", BOLGE.plastik);
      silindir(omuz.clone().add(disa.clone().multiplyScalar(0.06)), fore.clone().add(disa.clone().multiplyScalar(-0.05)), 0.05, 0.045, "metal", t + "Arm", BOLGE.metal);
      kure(fore, 0.065, "demir", t + "ForeArm", BOLGE.plastik, [1, 1, 1], 10);
      halka(fore, yonEl, 0.08, 0.011, "gomlek", t + "ForeArm", BOLGE.boya, true);
      silindir(fore.clone().add(yonEl.clone().multiplyScalar(0.05)), hand.clone().add(yonEl.clone().multiplyScalar(0.015)), 0.05, 0.045, "gomlek", t + "ForeArm", BOLGE.boya, true);
      const yan = new THREE.Vector3().crossVectors(yonEl, new THREE.Vector3(0, 0, 1)).normalize(), on = new THREE.Vector3(0, 0, 1);
      const qEl = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), yonEl);
      const avuc = hand.clone().add(yonEl.clone().multiplyScalar(0.035));
      ekle(yerlestir(new RoundedBoxGeometry(0.08, 0.06, 0.07, 1, 0.015), avuc.toArray(), qEl), "metal", t + "Hand", BOLGE.metal);
      for (const [ky, kz] of [[0.034, 0.012], [-0.034, 0.012], [0, -0.036]]) {
        const p = avuc.clone().add(yonEl.clone().multiplyScalar(0.075)).add(yan.clone().multiplyScalar(ky)).add(on.clone().multiplyScalar(kz));
        ekle(yerlestir(new THREE.BoxGeometry(0.024, 0.095, 0.022), p.toArray(), qEl.clone().multiply(E(kz < 0 ? -0.45 : 0, 0, -ky * 7))), "demir", t + "Hand", BOLGE.plastik);
      }
    }
    const up = W(t + "UpLeg"), leg = W(t + "Leg"), foot = W(t + "Foot"), toe = W(t + "ToeBase");
    const ayakM = foot.clone().lerp(toe, 0.55).setY(0.075);
    if (!robot) {
      kapsul(up, leg, 0.105, "kot", t + "UpLeg", BOLGE.alt, true);
      kapsul(leg, foot, 0.09, "kot", t + "Leg", BOLGE.alt, true);
      kure(leg, 0.1, "kot", t + "Leg", BOLGE.alt, [1, 0.9, 1], 8, true);   // 1G-A.2: diz küresi — bacak iki silindir gibi durmasın
      kure(foot.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.075, "kot", t + "Foot", BOLGE.alt, [1, 0.8, 1], 8, true);   // bilek: paça ayakkabıya kaynar
      ekle(yerlestir(new RoundedBoxGeometry(0.19, 0.14, 0.30, 2, 0.06), ayakM.clone().add(new THREE.Vector3(0, 0.02, 0)).toArray()), "ayakkabi", t + "Foot", BOLGE.ayakkabi, { desenli: true });
      ekle(yerlestir(new RoundedBoxGeometry(0.2, 0.035, 0.31, 1, 0.012), ayakM.clone().setY(0.02).toArray()), "cerceve", t + "Foot", BOLGE.taban);   // taban çizgisi
    } else {
      // ROBOT BACAĞI: kalça küresi · uyluk silindiri · diz küresi + halka · baldır paneli · bilek pistonu · taban plakası + ayak bloğu (ayakkabı DEĞİL)
      // 1G-A.1: kalça küresi bloğun dışına (yana 3 cm, aşağı 3 cm), uyluk ince ve diz küresine 5 cm kala biter, baldır 5 cm sonra başlar
      const kalca = up.clone().add(new THREE.Vector3(Math.sign(up.x) * 0.05, -0.06, 0));
      kure(kalca, 0.065, "demir", t + "UpLeg", BOLGE.plastik, [1, 1, 1], 10);
      silindir(kalca.clone().add(new THREE.Vector3(0, -0.04, 0)), leg.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.055, 0.05, "metal", t + "UpLeg", BOLGE.metal);
      kure(leg, 0.065, "demir", t + "Leg", BOLGE.plastik, [1, 1, 1], 10);
      halka(leg, foot.clone().sub(leg), 0.08, 0.011, "gomlek", t + "Leg", BOLGE.boya, true);
      silindir(leg.clone().add(new THREE.Vector3(0, -0.05, 0)), foot.clone().add(new THREE.Vector3(0, 0.075, 0)), 0.05, 0.045, "gomlek", t + "Leg", BOLGE.boya, true);
      ekle(yerlestir(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), foot.clone().add(new THREE.Vector3(0, 0.035, 0)).toArray()), "demir", t + "Foot", BOLGE.plastik);
      ekle(yerlestir(new RoundedBoxGeometry(0.2, 0.04, 0.32, 1, 0.012), ayakM.clone().setY(0.02).toArray()), "demir", t + "Foot", BOLGE.plastik);
      ekle(yerlestir(new RoundedBoxGeometry(0.16, 0.09, 0.2, 1, 0.03), ayakM.clone().add(new THREE.Vector3(0, -0.005, -0.03)).toArray()), "metal", t + "Foot", BOLGE.metal);
    }
  }

  const govde = birlestir(parcalar);
  /**
   * Paket 21 §F: basM'den n yönünde GÖVDENİN EN DIŞ yüzeyine uzaklık (saç/kürk/ekran yüz dahil).
   * Analitik `kafaYuzey` yalnız kafa küresini tarif ediyor; kaplan ve robotta gerçek gövde ondan 1,3-4,4 cm
   * içeride/dışarıda kalıyordu (ölçüldü) → şapka havada duruyordu. Kozmetikler bu yüzeye oturtulur.
   */
  const govdeIsinMesh = new THREE.Mesh(govde, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const govdeIsin = new THREE.Raycaster();
  // Kulak/anten sayılmaz (sözleşme onları geçirir ya da gizler); SAÇ SAYILIR — saç kafadan 2,5 cm kabarık,
  // dışlanınca şapka saçın altında kalıyordu (ölçüldü). Üç saç varyantının tepesi 0,7 cm içinde, tek zarf yeter.
  const ISIN_DISI = new Set([BOLGE.turKulak, BOLGE.turAnten]);
  const govdeBolge = govde.attributes.bolge;
  const govdeYuzey = (n, baslangic = basM, tavan = 0.45) => {
    govdeIsin.set(baslangic, n.clone().normalize());
    const kes = govdeIsin.intersectObject(govdeIsinMesh, false)
      .filter((h) => h.distance <= tavan && h.face && !ISIN_DISI.has(govdeBolge.getX(h.face.a)));
    return kes.length ? kes[kes.length - 1].distance : null;
  };
  const aoGovde = AO_KAPALI ? null : aoHesapla(govde, { R: 0.25 });
  // Göz/ağız dörtgenleri kafa yüzeyinden 4 mm dışarıda → AO'ları kafadan açık kalıyordu (ekranda
  // açık kare gibi görünüyordu). Her dörtgen köşesine en yakın kafa köşesinin AO'su kopyalanır.
  // 1G-A.2/A.3: kalça bloğunun alt yüzü bacaklar arasında tam kapalı → AO 0,15 (1E: "gri, dokusuz"). Aşağı bakan alt-giyim köşelerinde AO ≥ 0,55.
  if (aoGovde) {
    const nrm = govde.attributes.normal, b = govde.attributes.bolge, c = govde.attributes.color;
    for (let i = 0; i < c.count; i++) if (b.getX(i) === BOLGE.alt && nrm.getY(i) < -0.7 && c.getX(i) < 0.55) c.setXYZ(i, 0.55, 0.55, 0.55);
  }
  if (aoGovde) {
    const p = govde.attributes.position, b = govde.attributes.bolge, c = govde.attributes.color;
    const kafa = []; for (let i = 0; i < p.count; i++) if (b.getX(i) === TEN_B && Math.abs(p.getY(i) - basM.y) < 0.3 && Math.abs(p.getX(i) - basM.x) < 0.3) kafa.push(i);
    for (let i = 0; i < p.count; i++) {
      const bi = b.getX(i); if (bi !== BOLGE.gozL && bi !== BOLGE.gozR && bi !== BOLGE.agiz && bi !== BOLGE.ekran) continue;
      if (Math.abs(p.getY(i) - basM.y) > 0.3) continue;   // göğüs ekranı değil, yalnız yüz yamaları
      let en = 1e9, j = -1;
      for (const q of kafa) { const dd = (p.getX(q) - p.getX(i)) ** 2 + (p.getY(q) - p.getY(i)) ** 2 + (p.getZ(q) - p.getZ(i)) ** 2; if (dd < en) { en = dd; j = q; } }
      if (j >= 0) c.setXYZ(i, c.getX(j), c.getY(j), c.getZ(j));
    }
  }
  const malzeme = malzemeYap();
  const mesh = new THREE.SkinnedMesh(govde, malzeme);
  mesh.name = "Govde"; mesh.castShadow = true; mesh.frustumCulled = false;
  // Çalışma anı sözleşmesi (extras): bölge kodları, hücre dikdörtgenleri, ifade kareleri, çökertme merkezleri
  mesh.userData = {
    tur, bolge: BOLGE, hucreler: hucreTablosu(), ifade: { kareler: Array.from({ length: 16 }, (_, i) => ifadeRect(i)), ...IFADE, temelGoz: gozKare, temelAgiz: agizKare },
    temelHucre: { ust: "tisort", alt: "kot", ayakkabi: "ayakkabi", ceket: "ceket", kapuson: "esofman", boya: "gomlek" },   // boya: robot paneli (set → gomlek/metal/tente)
    merkez: { bas: basM.toArray(), govde: hips.clone().lerp(neck, 0.5).toArray() },
    // 1G-A.4 TÜR–KOZMETİK SÖZLEŞMESİ: türün DIŞLAMA HACİMLERİ (küre listesi, dünya/bind uzayı). Kozmetik `politika`sı bunlarla eşleşir.
    dislama: kaplan ? {
      kulak: [-1, 1].map((s) => ({ merkez: basM.clone().add(new THREE.Vector3(s * 0.165, 0.24, 0)).toArray(), r: 0.12, bolge: BOLGE.turKulak })),
      muzzle: [{ merkez: basM.clone().add(new THREE.Vector3(0, -0.07, 0.25)).toArray(), r: 0.11 }],
    } : robot ? { anten: [{ merkez: basM.clone().add(new THREE.Vector3(0, 0.33, 0)).toArray(), r: 0.13, bolge: BOLGE.turAnten }] } : {},
  };
  const iskelet = new THREE.Skeleton(sira.map((ad) => kemikler.get(ad)));
  karakter.add(mesh); karakter.updateMatrixWorld(true);
  mesh.bind(iskelet);   // geometri dünya uzayında, kök birim → bind birim

  // ---- KOZMETİK YUVALARI (STIL.md §2.1): dünya hizalı, rig ölçeğini geri alan boş düğümler ----
  const yuvaPoz = new Map();
  const yuva = (ad, kemik, dunyaPoz) => {
    const k = kemikler.get(kemik);
    const o = new THREE.Object3D(); o.name = ad; k.add(o);
    o.position.copy(k.worldToLocal(dunyaPoz.clone()));
    o.quaternion.copy(k.getWorldQuaternion(new THREE.Quaternion()).invert());
    o.scale.setScalar(1 / k.getWorldScale(new THREE.Vector3()).x);
    yuvaPoz.set(ad, dunyaPoz.clone());
    return o;
  };
  yuva("basYuva", "Head", basM.clone().add(new THREE.Vector3(0, 0.22, 0)));
  yuva("gozlukYuva", "Head", basM.clone().add(new THREE.Vector3(0, 0.02, 0.245)));   // 1G-A.2: 0,22 → 0,245 — çerçeve göz yamalarının (z ≈ 0,22) önünde
  yuva("sacYuva", "Head", basM);
  yuva("sakalYuva", "Head", basM.clone().add(new THREE.Vector3(0, -0.11, 0.2)));
  yuva("kulakYuva_L", "Head", basM.clone().add(new THREE.Vector3(-0.235, -0.02, 0)));
  yuva("kulakYuva_R", "Head", basM.clone().add(new THREE.Vector3(0.235, -0.02, 0)));
  yuva("boyunYuva", "Neck", neck.clone().add(new THREE.Vector3(0, -0.01, 0.02)));
  yuva("elbiseYuva", "Spine2", W("Spine2"));
  yuva("altYuva", "Hips", hips);
  yuva("capeRoot", "Spine2", W("Spine2").clone().add(new THREE.Vector3(0, 0.06, -0.2)));
  yuva("sirtYuva", "Spine2", hips.clone().add(new THREE.Vector3(0, 0.02, -0.16)));
  for (const t of ["L", "R"]) { const s = t === "L" ? "Left" : "Right"; yuva("ayakYuva_" + t, s + "Foot", W(s + "Foot")); yuva("bilekYuva_" + t, s + "Hand", W(s + "Hand")); }
  const efekt = new THREE.Object3D(); efekt.name = "efektYuva"; karakter.add(efekt);

  // ---- KOZMETİKLER (yuva merkezli, +Z ön, tek mesh) — insan GLB'sinde; kaplanda kuyruk eklenir ----
  const kozmetikler = new THREE.Group(); kozmetikler.name = "Kozmetikler";
  const aoKoz = {};
  const kozmetik = (ad, yuvaAd, geos) => {
    const g = birlestir(geos);
    if (!AO_KAPALI) aoKoz[ad] = aoHesapla(g, { engeller: [g, govde.clone().translate(...yuvaPoz.get(yuvaAd).clone().negate().toArray())], R: 0.25 });
    const m = new THREE.Mesh(g, malzeme); m.name = ad; m.castShadow = false;
    // 1G-A.4: kozmetiğin tür dışlama hacimlerine karşı POLİTİKASI (gecir · gizle · bicimlendir · it). Çalışma anı ve muayene bunu okur.
    m.userData.politika = POLITIKA[ad.replace("kozmetik_", "")] ?? {};
    kozmetikler.add(m); return m;
  };
  // Paket 21 §F: ŞAPKA HER TÜRDE kendi kafa ölçeğiyle üretilir (kozmetik.js tür varyantını yoksa insanınkini alır).
  // Eşya id'si değişmedi (kozmetik_sapka); tek fark kubbenin türün kafasına oturması.
  {
    const kb = kafayaOturanKubbe((n) => { const a = govdeYuzey(n), b = kafaYuzey(n); if (process.env.KUBBE_LOG) console.log(`  [${tur}] n=${n.toArray().map(x=>x.toFixed(2))} govde=${a==null?"yok":a.toFixed(3)} kafa=${b.toFixed(3)}`); return a ?? b; }, new THREE.Vector3(0, -0.22, 0), robot ? { t1: 0.30 * Math.PI, pay: 0.005, segment: 20, N: 3 } : {});   // robot kafası basık ve ekran yüzü öne çıkık: kubbe daha yukarıda biter (ölçüldü)   // kafa merkezi yuva uzayında (0, −0,22, 0); ölçüler merkez DAHİL döner
    const kenarY = kb.kenarY;
    const sapka = [
      Y(kb.geo, "sapka", [0, 0, 0]),
      D(new RoundedBoxGeometry(0.30, 0.03, 0.17, 1, 0.012), "sapkaSiperi", [0, kenarY + 0.005, Math.max(kb.kenarZ, kb.onZ) + 0.075], E(-0.12, 0, 0)),
      D(new THREE.TorusGeometry(kb.kenarR + 0.034, 0.016, 4, 12), "sapkaSiperi", [0, kenarY + 0.016, 0], E(Math.PI / 2, 0, 0)),
    ];
    if (robot) sapka.push(D(new THREE.TorusGeometry(0.03, 0.012, 4, 8), "sapkaSiperi", [0, kb.tepeY, 0], E(Math.PI / 2, 0, 0)));   // anten geçiş halkası
    kozmetik("kozmetik_sapka", "basYuva", sapka);
  }
  if (insan) {
    // 1G-A.2: cam dolgusu KALKTI (opak cam göz bebeğini örtüyordu, "camlar yarım" hissi) — çerçeve halka, göz yamasının 2,5 cm önünde; köprü burun sırtının üstüne
    const gozluk = [];
    for (const s of [-1, 1]) {
      gozluk.push(D(new THREE.TorusGeometry(0.06, 0.011, 6, 20), "gozlukCerceve", [s * 0.085, 0, 0]));
      gozluk.push(D(new THREE.BoxGeometry(0.012, 0.012, 0.2), "gozlukCerceve", [s * 0.15, 0.01, -0.1]));
    }
    gozluk.push(D(new THREE.BoxGeometry(0.05, 0.012, 0.012), "gozlukCerceve", [0, 0.03, -0.006]));
    kozmetik("kozmetik_gozluk", "gozlukYuva", gozluk);
    kozmetik("kozmetik_atki", "boyunYuva", [
      Y(new THREE.TorusGeometry(0.19, 0.055, 6, 16), "atki", [0, 0.02, 0], E(Math.PI / 2, 0, 0)),
      Y(new RoundedBoxGeometry(0.1, 0.34, 0.05, 1, 0.02), "atki", [0.06, -0.16, 0.2], E(0.15, 0, -0.15)),
    ]);
    // 1G-B.3 PREMİUM GÖZLÜK (aviator): altın metal çerçeve (bolge premiumMetal) · koyu plastik saplar (plastik) · aynalı cam (cam, premiumCam hücresi).
    // gozlukYuva'yı temel gözlükle paylaşır → çalışma anında karşılıklı dışlayıcı.
    const premium = [];
    for (const s of [-1, 1]) {
      premium.push(Y(new THREE.CylinderGeometry(0.062, 0.062, 0.006, 14), "premiumCam", [s * 0.085, -0.005, 0], E(Math.PI / 2, 0, 0), [1, 1, 0.9], BOLGE.cam));   // §F: duz disk (tek yuz, 105 cm² acik kenar) -> ince mercek
      premium.push(D(new THREE.TorusGeometry(0.062, 0.006, 5, 16), "altin", [s * 0.085, -0.005, 0.004], null, [1, 0.9, 1], BOLGE.premiumMetal));
      premium.push(D(new THREE.SphereGeometry(0.01, 5, 4), "altin", [s * 0.15, 0.012, -0.002], null, null, BOLGE.premiumMetal));   // menteşe
      premium.push(D(new THREE.BoxGeometry(0.007, 0.007, 0.2), "gozlukCerceve", [s * 0.15, 0.012, -0.1], null, null, BOLGE.plastik));
      premium.push(D(new THREE.SphereGeometry(0.008, 5, 4), "gozlukCerceve", [s * 0.03, -0.012, -0.01], null, null, BOLGE.plastik));   // burun yastığı
    }
    premium.push(D(new THREE.BoxGeometry(0.05, 0.006, 0.006), "altin", [0, 0.035, 0.002], null, null, BOLGE.premiumMetal));   // çift köprü
    premium.push(D(new THREE.BoxGeometry(0.05, 0.006, 0.006), "altin", [0, 0.02, 0.004], null, null, BOLGE.premiumMetal));
    kozmetik("kozmetik_gozlukPremium", "gozlukYuva", premium);
    // 1G-B.2 KANAT: sirtYuva (kalça hizası, Spine2'ye bağlı; kanat kökü kürek kemiği hizasına +0,36 çıkar). Deri koşum + iki kol + 6'şar tüy levhası
    // (açık/koyu tüy hücresi dönüşümlü → yelpaze okunur). %100 kozmetik: çalışma anında çırpma + süzülme ötelemesi (koordinat değişmez).
    const kanat = [
      D(new RoundedBoxGeometry(0.18, 0.16, 0.035, 1, 0.012), "deri", [0, 0.27, -0.02]),
      D(new THREE.BoxGeometry(0.05, 0.02, 0.15), "deri", [0.1, 0.35, 0.04], E(0.55, 0, 0)),
      D(new THREE.BoxGeometry(0.05, 0.02, 0.15), "deri", [-0.1, 0.35, 0.04], E(0.55, 0, 0)),
    ];
    for (const s of [-1, 1]) {
      // kol: kürek kemiğinden yukarı-dışa; tüyler kolun ALTINDAN sarkar — gövdeye yakın olanlar aşağı, uçtakiler dışa (melek kanadı yelpazesi)
      const P = new THREE.Vector3(s * 0.1, 0.28, -0.05), U = new THREE.Vector3(s * 0.5, 0.62, -0.16);
      const kolV = U.clone().sub(P), kolL = kolV.length();
      kanat.push(D(new THREE.CylinderGeometry(0.02, 0.028, kolL, 8), "deri", P.clone().lerp(U, 0.5).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), kolV.clone().normalize())));
      for (let k = 0; k < 7; k++) {
        const pivot = P.clone().lerp(U, 0.08 + k * 0.15), a = -1.15 + k * 0.16, L = 0.28 + k * 0.03;
        const yon = new THREE.Vector3(s * Math.cos(a), Math.sin(a), -0.12).normalize();
        const merkez = pivot.clone().addScaledVector(yon, L / 2 - 0.02); merkez.z -= k * 0.01;
        kanat.push(Y(new THREE.BoxGeometry(L, 0.11, 0.028), k % 2 ? "kanatKoyu" : "kanat", merkez.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(s, 0, 0), yon)));
      }
    }
    kozmetik("kozmetik_kanat", "sirtYuva", kanat);
  }
  if (robot) {
    // ROBOT KOZMETİK VARYANTLARI (1D §4.4): şapka yukarıdaki ortak blokta (anten halkası dahil); gözlük → vizör. Atkı insanınki.
    // §F: vizör artık KAPALI bant, yüze ışınla oturtulur (gozlukYuva kafa merkezinin 24,5 cm önünde → merkez −0,245 z)
    const vMerkez = new THREE.Vector3(0, -0.02, -0.245);
    const vizorYuzey = (n, b) => govdeYuzey(n, b.clone().add(basM).add(new THREE.Vector3(0, 0.02, 0.245)), 0.4);
    kozmetik("kozmetik_gozluk", "gozlukYuva", [
      Y(kafayaOturanBant(vizorYuzey, vMerkez, { yukari: 0.05, asagi: -0.05, kalinlik: 0.026 }), "gozlukCam", [0, 0, 0], null, null, BOLGE.cam),
      D(kafayaOturanBant(vizorYuzey, vMerkez, { yukari: 0.062, asagi: 0.048, pay: 0.002, kalinlik: 0.03 }), "gozlukCerceve", [0, 0, 0]),
      D(kafayaOturanBant(vizorYuzey, vMerkez, { yukari: -0.048, asagi: -0.062, pay: 0.002, kalinlik: 0.03 }), "gozlukCerceve", [0, 0, 0]),
    ]);
  }
  if (kaplan) {
    // kuyruk: sirtYuva'da, −Z'ye uzanır, ucu siyah; çalışma anında kökten hafif salınır
    const yol = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.12, -0.2), new THREE.Vector3(0.05, -0.1, -0.42), new THREE.Vector3(0.12, 0.08, -0.55)]);
    kozmetik("kozmetik_kuyruk", "sirtYuva", [
      Y(delikleriKapat(new THREE.TubeGeometry(yol, 12, 0.04, 8, false)), "kurk", [0, 0, 0], null, null, BOLGE.kurk),   // §F: tup uclari kapatildi (45 cm² × 2 delik)
      D(new THREE.SphereGeometry(0.05, 8, 6), "gozBebek", [0.12, 0.08, -0.55]),
    ]);
  }
  karakter.add(kozmetikler);

  // ---- ANİMASYON: Mixamo klipleri aynen + türetilmiş "Selam" ----
  const klipler = MIXAMO.klipler.map((k) => new THREE.AnimationClip(k.ad, k.sure, k.izler.map((i) => i.tur === "quaternion" ? new THREE.QuaternionKeyframeTrack(i.ad, i.zaman, i.deger) : new THREE.VectorKeyframeTrack(i.ad, i.zaman, i.deger))));
  klipler.push(selamKlibi(klipler.find((k) => k.name === "Idle"), kemikler, karakter));
  return { karakter, mesh, klipler, kozmetikler, kemikler, ao: { govde: aoGovde, ...aoKoz } };
}

/** Selam: Idle kopyası, sağ kol yukarı + el sallama. Kök π → sağ kol dünya −X: Z ekseninde negatif açı kolu dışa kaldırır. */
function selamKlibi(idle, kemikler, karakter) {
  const izler = idle.tracks.filter((t) => !/^Right(Arm|ForeArm)\./.test(t.name)).map((t) => t.clone());
  const mixer = new THREE.AnimationMixer(karakter);
  mixer.clipAction(idle).play(); mixer.update(0); karakter.updateMatrixWorld(true);
  const Z = new THREE.Vector3(0, 0, 1);
  const yerel = (kemik, dunyaDelta) => { const k = kemikler.get(kemik); const qp = k.parent.getWorldQuaternion(new THREE.Quaternion()); const qw = k.getWorldQuaternion(new THREE.Quaternion()); return qp.clone().invert().multiply(dunyaDelta).multiply(qw); };
  const kol = [], onKol = [], z1 = [], z2 = [];
  const anahtar = (t, kolAci, onKolAci) => { z1.push(t); z2.push(t); kol.push(...yerel("RightArm", new THREE.Quaternion().setFromAxisAngle(Z, kolAci)).toArray()); onKol.push(...yerel("RightForeArm", new THREE.Quaternion().setFromAxisAngle(Z, onKolAci)).toArray()); };
  anahtar(0, 0, 0);
  anahtar(0.45, -2.3, 0.2);
  for (let i = 0; i < 4; i++) { anahtar(0.45 + i * 0.32 + 0.16, -2.3, -0.35); anahtar(0.45 + i * 0.32 + 0.32, -2.3, 0.45); }
  anahtar(2.2, 0, 0);
  izler.push(new THREE.QuaternionKeyframeTrack("RightArm.quaternion", z1, kol));
  izler.push(new THREE.QuaternionKeyframeTrack("RightForeArm.quaternion", z2, onKol));
  mixer.stopAllAction(); mixer.update(0); karakter.updateMatrixWorld(true);
  for (const k of MIXAMO.iskelet) { const b = kemikler.get(k.ad); b.position.fromArray(k.poz); b.quaternion.fromArray(k.don); }
  return new THREE.AnimationClip("Selam", 2.2, izler);
}

// ------------------------------------------------------------ BİNA (İstiklal dükkân cephesi)
function binaKur() {
  const g = [];
  const at = (geo, hucre, desenli = false, poz = null, don = null, b = BOLGE.diger) => { if (poz) yerlestir(geo, poz, don); g.push(bolgeYaz(desenli ? yay(geo, hucre) : duz(geo, hucre), b)); return geo; };
  const kutu = (w, h, d, poz, hucre, desenli = false, don = null, b) => at(bolunmusKutu(w, h, d), hucre, desenli, poz, don, b);
  const pahliKutu = (w, h, d, poz, hucre, desenli = false, don = null) => at(pahli(w, h, d), hucre, desenli, poz, don);
  const W = 9.0, Dd = 8.0, K1 = 3.8, K2 = 3.2;
  pahliKutu(W + 1.2, 0.18, Dd + 1.2, [0, 0.09, 0], "kaldirim", true);
  kutu(W, K1, Dd, [0, 0.18 + K1 / 2, 0], "tas", true);
  pahliKutu(W + 0.3, 0.28, Dd + 0.3, [0, 0.18 + K1 + 0.14, 0], "tasAcik", true);
  kutu(W, K2, Dd, [0, 0.18 + K1 + 0.28 + K2 / 2, 0], "siva", true);
  const cati0 = 0.18 + K1 + 0.28 + K2;
  pahliKutu(W + 0.5, 0.3, Dd + 0.5, [0, cati0 + 0.15, 0], "tasAcik", true);
  at(new THREE.CylinderGeometry(1.6, Math.hypot(W, Dd) / 2 + 0.4, 2.2, 4, 3), "kiremit", true, [0, cati0 + 0.3 + 1.1, 0], E(0, Math.PI / 4, 0));
  pahliKutu(1.6, 0.25, 1.6, [0, cati0 + 2.55, 0], "tasAcik");
  pahliKutu(0.7, 1.4, 0.7, [-2.6, cati0 + 2.0, -2.2], "baca", true);
  const on = Dd / 2;
  pahliKutu(2.6, 2.5, 0.25, [0, 0.18 + 1.25, on + 0.02], "ahsapAcik", true);
  kutu(2.2, 2.3, 0.2, [0, 0.18 + 1.15, on + 0.12], "ahsap", true);
  kutu(0.06, 2.3, 0.22, [0, 0.18 + 1.15, on + 0.14], "altin");
  at(new THREE.SphereGeometry(0.06, 8, 6), "altin", false, [0.35, 0.18 + 1.1, on + 0.24]);
  at(new THREE.CylinderGeometry(1.15, 1.15, 0.25, 18, 1, false, 0, Math.PI), "ahsapAcik", true, [0, 0.18 + 2.5, on + 0.02], E(Math.PI / 2, 0, 0));
  for (const s of [-1, 1]) {
    kutu(0.08, 0.08, 0.45, [s * 1.55, 0.18 + 2.75, on + 0.22], "demir");
    pahliKutu(0.28, 0.4, 0.28, [s * 1.55, 0.18 + 2.5, on + 0.42], "lamba");
    pahliKutu(0.34, 0.06, 0.34, [s * 1.55, 0.18 + 2.73, on + 0.42], "demir");
  }
  kutu(2.4, 0.03, 1.0, [0, 0.18 + 0.02, on + 0.6], "tente", true);
  for (const s of [-1, 1]) {
    const x = s * 2.9;
    pahliKutu(2.6, 2.6, 0.16, [x, 0.18 + 2.05, on + 0.02], "cerceve");
    kutu(2.3, 2.3, 0.14, [x, 0.18 + 2.05, on + 0.06], "cam", true, null, BOLGE.cam);
    kutu(0.08, 2.3, 0.16, [x, 0.18 + 2.05, on + 0.08], "cerceve");
    pahliKutu(2.6, 0.5, 0.35, [x, 0.18 + 0.5, on + 0.1], "tasAcik", true);
  }
  const tenteQ = E(0.42, 0, 0);
  kutu(W - 0.4, 0.06, 1.7, [0, 0.18 + K1 - 0.18, on + 0.85], "tente", true, tenteQ);
  kutu(W - 0.4, 0.22, 0.06, [0, 0.18 + K1 - 0.65, on + 1.6], "tente", true);
  for (const s of [-1, 1]) kutu(0.06, 0.06, 1.7, [s * (W / 2 - 0.3), 0.18 + K1 - 0.18, on + 0.85], "demir", false, tenteQ);
  pahliKutu(4.2, 0.82, 0.18, [0, 0.18 + K1 + 0.28 + 0.46, on + 0.1], "tabela");
  kutu(4.4, 0.07, 0.2, [0, 0.18 + K1 + 0.28 + 0.06, on + 0.1], "altin");
  kutu(4.4, 0.07, 0.2, [0, 0.18 + K1 + 0.28 + 0.86, on + 0.1], "altin");
  const u0 = 0.18 + K1 + 0.28;
  pahliKutu(2.6, 2.0, 0.7, [0, u0 + 2.0, on + 0.35], "siva", true);
  pahliKutu(2.0, 1.5, 0.1, [0, u0 + 2.05, on + 0.72], "cerceve");
  kutu(1.75, 1.3, 0.08, [0, u0 + 2.05, on + 0.76], "cam", true, null, BOLGE.cam);
  pahliKutu(2.8, 0.15, 0.9, [0, u0 + 0.98, on + 0.4], "tasAcik", true);
  for (const s of [-1, 1]) {
    const x = s * 2.9;
    pahliKutu(1.3, 2.0, 0.1, [x, u0 + 1.75, on + 0.02], "cerceve");
    kutu(1.1, 1.8, 0.08, [x, u0 + 1.75, on + 0.06], "cam", true, null, BOLGE.cam);
    kutu(0.06, 1.8, 0.1, [x, u0 + 1.75, on + 0.08], "cerceve");
    pahliKutu(1.7, 0.12, 0.6, [x, u0 + 0.7, on + 0.3], "tasAcik", true);
    kutu(1.7, 0.04, 0.04, [x, u0 + 1.5, on + 0.58], "demir");
    for (let i = -4; i <= 4; i++) kutu(0.03, 0.8, 0.03, [x + i * 0.2, u0 + 1.1, on + 0.58], "demir");
    for (const s2 of [-1, 1]) kutu(0.03, 0.8, 0.6, [x + s2 * 0.83, u0 + 1.1, on + 0.3], "demir");
  }
  for (const s of [-1, 1]) for (const z of [-2.2, 2.2]) {
    kutu(0.1, 1.6, 1.1, [s * (W / 2 + 0.02), u0 + 1.75, z], "cerceve");
    kutu(0.08, 1.4, 0.9, [s * (W / 2 + 0.06), u0 + 1.75, z], "cam", true, null, BOLGE.cam);
    kutu(0.1, 1.4, 1.1, [s * (W / 2 + 0.02), 0.18 + 2.2, z], "cerceve");
    kutu(0.08, 1.2, 0.9, [s * (W / 2 + 0.06), 0.18 + 2.2, z], "cam", true, null, BOLGE.cam);
  }
  kutu(0.05, 1.6, 0.05, [2.0, u0 + 3.1, on + 0.7], "demir", false, E(0.9, 0, 0));
  kutu(0.9, 0.6, 0.02, [2.0, u0 + 3.4, on + 1.35], "bayrak");
  for (const s of [-1, 1]) {
    at(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 10), "baca", true, [s * 1.7, 0.18 + 0.3, on + 0.9]);
    at(new THREE.SphereGeometry(0.36, 10, 8), "cim", true, [s * 1.7, 0.18 + 0.78, on + 0.9], null);
  }
  const geo = birlestir(g);
  const ao = AO_KAPALI ? null : aoHesapla(geo, { R: 0.45 });
  const mesh = new THREE.Mesh(geo, malzemeYap());
  mesh.name = "Bina_Dukkan"; mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, ao, ayakIzi: { w: W + 1.2, d: Dd + 1.2, kapi: [0, on + 0.3] } };
}

// ------------------------------------------------------------ ÇEVRE PROP'LARI + KEDİ + ZEMİN
function prop(ad, geos, R = 0.3) {
  const geo = birlestir(geos);
  const ao = AO_KAPALI || R === 0 ? null : aoHesapla(geo, { R });
  // AO hesaplanmayan varlık da COLOR_0 taşır (beyaz): tek malzeme vertexColors açıkken siyaha düşmesin (zemin bu yüzden siyah çıkmıştı)
  if (!geo.attributes.color) geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  const m = new THREE.Mesh(geo, malzemeYap()); m.name = ad; m.castShadow = true; m.receiveShadow = true;
  return { mesh: m, ao };
}

function proplarKur() {
  const out = {};
  // Ağaç (Aşama 1C §6): gövde 3,4 m, taç 4 lob ve tabanı 3,3 m'de → 0,7 ölçekte 2,3 m > karakter boyu
  out.agacGovde = prop("prop_agac_govde", [
    Y(new THREE.CylinderGeometry(0.18, 0.3, 3.4, 9), "ahsap", [0, 1.7, 0]),
    Y(new THREE.CylinderGeometry(0.32, 0.44, 0.35, 9), "ahsap", [0, 0.17, 0]),
    Y(new THREE.CylinderGeometry(0.06, 0.11, 1.0, 6), "ahsap", [0.35, 3.6, 0.1], E(0, 0, -0.65)),
    Y(new THREE.CylinderGeometry(0.06, 0.11, 0.9, 6), "ahsap", [-0.3, 3.7, -0.2], E(0.35, 0, 0.6)),
  ]);
  out.agacTac = prop("prop_agac_tac", [
    Y(new THREE.SphereGeometry(1.3, 10, 7), "cim", [0, 4.6, 0], null, [1, 0.9, 1]),
    Y(new THREE.SphereGeometry(0.95, 9, 6), "cimAcik", [0.75, 5.15, 0.4]),
    Y(new THREE.SphereGeometry(0.9, 9, 6), "cimAcik", [-0.8, 5.0, -0.35]),
    Y(new THREE.SphereGeometry(0.85, 9, 6), "cim", [0.1, 5.75, -0.2]),
    Y(new THREE.SphereGeometry(0.8, 8, 6), "cimAcik", [-0.2, 4.4, 0.95]),
  ], 0.5);
  // Aşama 1D Bölüm D: lamba 500 → 220 üçgen — direk/kol/halka açık uçlu silindir, küre 10×7, koni kapaksız (siluet aynı)
  out.lamba = prop("prop_lamba", [
    D(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 8), "demir", [0, 0.25, 0]),
    D(new THREE.CylinderGeometry(0.06, 0.1, 3.6, 7, 1, true), "demir", [0, 2.3, 0]),
    D(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 8, 1, true), "demir", [0, 0.55, 0]),
    D(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 5, 1, true), "demir", [0.2, 4.15, 0], E(0, 0, -0.9)),
    D(new THREE.SphereGeometry(0.22, 10, 7), "lamba", [0.42, 4.05, 0]),
    D(new THREE.ConeGeometry(0.28, 0.22, 8, 1, true), "demir", [0.42, 4.3, 0]),
    D(new THREE.SphereGeometry(0.05, 5, 3), "altin", [0.42, 4.45, 0]),
  ]);
  // Bank 972 → 320: çıtalar ucuz pah (68), sırtlık iki çıta → tek plaka (aynı yükseklik aralığı), ayaklar düz kutu
  const bank = [];
  for (let i = 0; i < 3; i++) bank.push(Y(pahliUcuz(1.8, 0.05, 0.13, 0.012), "ahsapAcik", [0, 0.45, -0.16 + i * 0.16]));
  bank.push(Y(pahliUcuz(1.8, 0.05, 0.28, 0.012), "ahsapAcik", [0, 0.8, -0.27], E(0.25, 0, 0)));
  for (const s of [-1, 1]) { bank.push(D(new THREE.BoxGeometry(0.06, 0.45, 0.5), "demir", [s * 0.8, 0.22, 0])); bank.push(D(new THREE.BoxGeometry(0.06, 0.5, 0.08), "demir", [s * 0.8, 0.68, -0.3], E(0.25, 0, 0))); }
  out.bank = prop("prop_bank", bank, 0.25);
  // Saksı 528 → 256: bilezik torus → açık silindir, çalı 7×5, 6 top → 4 top (6×4)
  const saksi = [
    Y(new THREE.CylinderGeometry(0.42, 0.32, 0.7, 10), "baca", [0, 0.35, 0]),
    D(new THREE.CylinderGeometry(0.45, 0.45, 0.07, 8, 1, true), "baca", [0, 0.7, 0]),
    Y(new THREE.SphereGeometry(0.42, 7, 5), "cim", [0, 0.95, 0], null, [1, 0.75, 1]),
  ];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; saksi.push(D(new THREE.SphereGeometry(0.07, 6, 4), i % 2 ? "bayrak" : "lamba", [Math.cos(a) * 0.3, 1.18, Math.sin(a) * 0.3])); }
  out.saksi = prop("prop_saksi", saksi, 0.25);
  out.bordur = prop("bordur", [
    Y(new THREE.BoxGeometry(80, 0.16, 0.3, 40, 1, 1), "tasAcik", [0, 0.08, 2.0]),
    Y(new THREE.BoxGeometry(80, 0.16, 0.3, 40, 1, 1), "tasAcik", [0, 0.08, 10.0]),
  ], 0.3);
  // SOKAK KEDİSİ (Aşama 1C §4.1): 4 ayak, ~0,35 m, ≤800 üçgen, ön +Z; renk instanceColor ile
  const kedi = [
    Y(new THREE.CapsuleGeometry(0.075, 0.2, 3, 9), "kedi", [0, 0.2, 0], E(Math.PI / 2, 0, 0)),
    Y(new THREE.SphereGeometry(0.08, 10, 8), "kedi", [0, 0.27, 0.17]),
    D(new THREE.SphereGeometry(0.03, 6, 5), "kurkKarin", [0, 0.24, 0.245], null, [1, 0.8, 0.7]),
    D(new THREE.SphereGeometry(0.012, 5, 4), "gozBebek", [0, 0.245, 0.27]),
    D(new THREE.ConeGeometry(0.03, 0.06, 5), "kedi", [-0.045, 0.34, 0.15], E(-0.2, 0, 0.3)),
    D(new THREE.ConeGeometry(0.03, 0.06, 5), "kedi", [0.045, 0.34, 0.15], E(-0.2, 0, -0.3)),
    D(new THREE.SphereGeometry(0.014, 6, 5), "kediGoz", [-0.03, 0.29, 0.235]), D(new THREE.SphereGeometry(0.014, 6, 5), "kediGoz", [0.03, 0.29, 0.235]),
    Y(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.22, -0.16), new THREE.Vector3(0, 0.3, -0.26), new THREE.Vector3(0.03, 0.4, -0.3), new THREE.Vector3(0.06, 0.46, -0.24)]), 8, 0.02, 6, false), "kedi", [0, 0, 0]),
  ];
  for (const [x, z] of [[-0.05, 0.1], [0.05, 0.1], [-0.05, -0.1], [0.05, -0.1]]) kedi.push(Y(new THREE.CylinderGeometry(0.022, 0.026, 0.16, 6), "kedi", [x, 0.08, z]));
  out.kedi = prop("prop_kedi", kedi, 0.15);
  // ZEMİN (Aşama 1C §8): karo döşeli kaldırım, asfalt şerit, yaya geçidi, çim yamaları — tek mesh, atlas
  const zemin = [];
  const karo = (x0, x1, z0, z1, hucre, adim = 2, y = 0) => { for (let x = x0; x < x1; x += adim) for (let z = z0; z < z1; z += adim) zemin.push(Y(new THREE.PlaneGeometry(adim, adim), hucre, [x + adim / 2, y, z + adim / 2], E(-Math.PI / 2, 0, 0))); };
  karo(-40, 40, -40, 2, "kaldirim"); karo(-40, 40, 10, 40, "kaldirim");
  karo(-40, 40, 2, 10, "asfalt", 4, 0.005);
  for (let i = 0; i < 7; i++) zemin.push(Y(new THREE.PlaneGeometry(0.5, 7.4), "cerceve", [8.5 + i * 0.9, 0.012, 6], E(-Math.PI / 2, 0, 0)));   // yaya geçidi
  for (const [x, z, r] of [[-22, -3, 1.6], [16, -4, 1.3], [-9, 13.5, 1.5], [27, 14, 1.4], [-30, 12.5, 1.1], [34, -2.5, 1.2]]) zemin.push(Y(new THREE.CircleGeometry(r, 14), "cimAcik", [x, 0.012, z], E(-Math.PI / 2, 0, 0), [1.4, 1, 1]));
  out.zemin = prop("zemin_deneme", zemin, 0);
  out.zemin.mesh.castShadow = false;
  return out;
}

// ------------------------------------------------------------ GLB dışa aktarım + atlas bağlama
async function glbYaz(dosya, sahne, animations = []) {
  const ex = new GLTFExporter();
  const b = Buffer.from(await ex.parseAsync(sahne, { binary: true, animations, trs: true }));
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString());
  j.images = [{ uri: "atlas.png" }];
  j.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  j.textures = [{ sampler: 0, source: 0 }];
  for (const m of j.materials ?? []) { m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {}; m.pbrMetallicRoughness.baseColorTexture = { index: 0 }; }
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), bin = b.subarray(20 + len), out = Buffer.alloc(20 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20); bin.copy(out, 20 + jb.length);
  fs.writeFileSync(path.join(CIKTI, dosya), out);
  return out.length;
}
function olcum(dosya, nesne, ek = {}) {
  const meshler = [];
  nesne.traverse((o) => { if (o.isMesh) meshler.push({ ad: o.name, ucgen: ucgenSay(o.geometry), kose: o.geometry.attributes.position.count, skinned: !!o.isSkinnedMesh, ao: !!o.geometry.attributes.color }); });
  const veri = { dosya, meshler, toplamUcgen: meshler.reduce((a, m) => a + m.ucgen, 0), malzeme: 1, roughness: PURUZ, boyut: new THREE.Box3().setFromObject(nesne).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)), ...ek };
  fs.writeFileSync(path.join(CIKTI, dosya.replace(".glb", ".olcum.json")), JSON.stringify(veri, null, 1));
  return veri;
}

// ------------------------------------------------------------ ÇALIŞTIR
const t0 = Date.now();
fs.writeFileSync(path.join(CIKTI, "atlas.png"), atlasCiz());
fs.writeFileSync(path.join(CIKTI, "atlas_eski.png"), atlasCiz({ eski: true }));
fs.writeFileSync(path.join(CIKTI, "atlas_yaprakEski.png"), atlasCiz({ yaprakEski: true }));
fs.writeFileSync(path.join(CIKTI, "temas.png"), temasCiz());
const red = [];
const aoOzet = (a) => (a ? `AO ort ${a.ort} min ${a.min}` : "AO kapalı");
for (const tur of ["insan", "kaplan", "robot"]) {
  const K = karakterKur(tur);
  const o = olcum(`karakter_${tur}.glb`, K.karakter, { kemik: K.kemikler.size, klipler: K.klipler.map((k) => k.name), yuvalar: [...K.kemikler.values()].flatMap((b) => b.children.filter((c) => !c.isBone).map((c) => c.name)), ao: K.ao });
  const govde = o.meshler.find((m) => m.ad === "Govde").ucgen;
  if (govde > BUTCE.karakterUcgen) red.push(`${tur} gövdesi ${govde} > ${BUTCE.karakterUcgen}`);
  for (const m of o.meshler) if (m.ad.startsWith("kozmetik_") && m.ucgen > (m.ad === "kozmetik_kanat" ? BUTCE.heroKozmetikUcgen : BUTCE.kozmetikUcgen)) red.push(`${tur} ${m.ad} ${m.ucgen} > ${m.ad === "kozmetik_kanat" ? BUTCE.heroKozmetikUcgen : BUTCE.kozmetikUcgen}`);
  const n = await glbYaz(`karakter_${tur}.glb`, K.karakter, K.klipler);
  console.log(`karakter_${tur}.glb ${(n / 1024).toFixed(0)} KB — gövde ${govde} üçgen (${aoOzet(K.ao.govde)}), kozmetik ${o.meshler.filter((m) => m.ad.startsWith("kozmetik_")).map((m) => m.ad.slice(9) + ":" + m.ucgen).join(", ") || "—"}, yuva ${o.yuvalar.length}`);
}
const B = binaKur();
const oB = olcum("bina_dukkan.glb", B.mesh, { ...B.ayakIzi, ao: B.ao });
if (oB.toplamUcgen > BUTCE.binaUcgen) red.push(`bina ${oB.toplamUcgen} > ${BUTCE.binaUcgen}`);
const P = proplarKur();
for (const [ad, p] of Object.entries(P)) {
  const o = olcum(p.mesh.name + ".glb", p.mesh, { ao: p.ao });
  if (ad === "kedi" && o.toplamUcgen > BUTCE.kediUcgen) red.push(`kedi ${o.toplamUcgen} > ${BUTCE.kediUcgen}`);
  else if (!/bordur|zemin|kedi/.test(ad) && o.toplamUcgen > BUTCE.propUcgen) red.push(`${ad} ${o.toplamUcgen} > ${BUTCE.propUcgen}`);
  console.log(`${o.dosya} — ${o.toplamUcgen} üçgen (${aoOzet(p.ao)})`);
}
if (red.length) { console.error("BÜTÇE AŞILDI — reddedildi:\n  " + red.join("\n  ")); process.exit(1); }
console.log(`bina_dukkan.glb ${((await glbYaz("bina_dukkan.glb", B.mesh)) / 1024).toFixed(0)} KB — ${oB.toplamUcgen} üçgen, ${oB.meshler[0].kose} köşe (${aoOzet(B.ao)})`);
for (const p of Object.values(P)) await glbYaz(p.mesh.name + ".glb", p.mesh);
console.log("atlas.png", fs.statSync(path.join(CIKTI, "atlas.png")).size, "bayt · süre", ((Date.now() - t0) / 1000).toFixed(1), "s");
// Aşama 1E: render-ve-bak döngüsü — `node uret.mjs --muayene` üretimden sonra 12 varlığı muayeneden geçirir
// (testler + görünümler + kontakt sayfası; bildim/harita/muayene/calistir.mjs). Geometri koduna etkisi yok.
if (process.argv.includes("--muayene")) {
  const { spawnSync } = await import("child_process");
  const r = spawnSync(process.execPath, [path.join(BURASI, "../muayene/calistir.mjs")], { stdio: "inherit" });
  if (r.status !== 0) process.exitCode = r.status ?? 1;
}
