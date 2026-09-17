// ============================================================
// MUAYENE — KOZMETİK TESTLERİ (Paket 21 §B, §C, §D). Node, GLB geometrisi, three-mesh-bvh.
//
//   oturma      — kozmetiğin gövdeye bakan yüzeyi (gövdeye ≤ oturma_arama_m köşeler) gövdeye YASLANIYOR mu:
//                 temas eden köşe oranı ≥ oturma_temas_orani VE medyan boşluk ≤ oturma_bosluk_m. Tek köşe teması yetmez.
//   acik_kenar  — manifold: her kenar tam 2 üçgene ait olmalı. 1 üçgenli kenarlar → birbirine bağlı olanlar delik döngüsü;
//                 döngünün çevrelediği alan > acik_kenar_alan_m2 → aday. `acik_kenar_izinli` beyanı (gerekçeli) susturur.
//   kalinlik    — ada başına temel eksenler (PCA): en kısa / en uzun uzanım < kalinlik_orani VE yüzey alanı > kalinlik_alan_m2
//                 → hacimsiz (kâğıt gibi) → aday. `yassi_olabilir` beyanı (gerekçeli) susturur.
// Eşikler: ustveri/_esikler.json (koda gömülmez).
// ============================================================
import path from "path";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { glbOku } from "./glbOku.mjs";
import { adalaraAyir, adaYazi, eslesir } from "./testler.mjs";
import { takiliKur } from "./takili.mjs";

const BOLGE_ADLARI = {};   // kozmetik GLB'lerinde _bolge sayısal; etiket için hücre yeter
const cm = (m) => (m * 100).toFixed(1).replace(".", ",");
const yuzde = (x) => "%" + Math.round(x * 100);

// ---------------------------------------------------------------- küçük doğrusal cebir
/** Simetrik 3×3 özdeğer/özvektör (Jacobi). */
function ozvektorler(C) {
  const a = C.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-14) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
  }
  return [0, 1, 2].map((i) => new THREE.Vector3(V[0][i], V[1][i], V[2][i]).normalize());
}
function kovaryans(noktalar) {
  const m = noktalar.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / noktalar.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of noktalar) { const d = [v.x - m.x, v.y - m.y, v.z - m.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  return { C, m };
}

// ---------------------------------------------------------------- B. OTURMA
/**
 * @param {THREE.BufferGeometry} govde  dünya uzayı, pozlu
 * @param {THREE.BufferGeometry} koz    dünya uzayı
 */
export function oturmaOlc(govde, koz, E) {
  const bvh = govde.boundsTree ?? (govde.boundsTree = new MeshBVH(govde));
  const g = koz.index ? koz.toNonIndexed() : koz;
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, nrm = g.attributes.normal, gorulen = new Set(), mesafeler = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), hedef = {};
  let disaBakan = 0, gomulu = 0, enDerin = 0, enYakinTum = Infinity;
  const gp = govde.attributes.position, gi = govde.index;
  const t0 = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), yg = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)},${Math.round(nrm.getX(i))},${Math.round(nrm.getY(i))},${Math.round(nrm.getZ(i))}`;
    if (gorulen.has(k)) continue; gorulen.add(k);
    v.fromBufferAttribute(p, i); n.fromBufferAttribute(nrm, i);
    const r = bvh.closestPointToPoint(v, hedef, 0, 1);
    if (!r) continue;
    enYakinTum = Math.min(enYakinTum, r.distance);
    // GÖVDEYE BAKAN yüzey: köşe normali gövdeye dönük olmalı. Atkının/ gözlüğün DIŞ yüzü gövdeye zaten değemez;
    // onları saymak medyan boşluğu şişiriyordu (ölçüldü).
    const cp = hedef.point ?? hedef;
    const yon = new THREE.Vector3(cp.x - v.x, cp.y - v.y, cp.z - v.z);
    if (yon.lengthSq() > 1e-12 && n.dot(yon.normalize()) <= 0) { disaBakan++; continue; }
    // Gömülme: en yakın üçgenin normaline göre köşe gövdenin İÇİNDE mi (düzeltmeler gövdeye batmasın diye ölçülür)
    if (hedef.faceIndex != null && gi) {
      const a0 = gi.getX(hedef.faceIndex * 3), a1 = gi.getX(hedef.faceIndex * 3 + 1), a2 = gi.getX(hedef.faceIndex * 3 + 2);
      t0.fromBufferAttribute(gp, a0); t1.fromBufferAttribute(gp, a1); t2.fromBufferAttribute(gp, a2);
      yg.copy(t1).sub(t0).cross(t2.clone().sub(t0)).normalize();
      // Gövdenin İÇİNDE kalan köşe temas etmiştir (gözlük sapı kafanın içinde, kanat koşumu sırtın içinde).
      // Yüzeye uzaklığını "boşluk" saymak medyanı şişiriyordu — ölçüldü.
      if (yg.dot(v.clone().sub(t0)) < 0) { gomulu++; enDerin = Math.max(enDerin, r.distance); mesafeler.push(0); continue; }
    }
    mesafeler.push(r.distance);
  }
  if (!mesafeler.length) {
    return { kose: 0, yakin: 0, temas: 0, temas_orani: 0, medyan_bosluk_m: null, en_buyuk_bosluk_m: null,
      en_yakin_m: Number.isFinite(enYakinTum) ? +enYakinTum.toFixed(4) : null, disa_bakan: disaBakan,
      gomulu_kose: gomulu, en_derin_gomulme_m: +enDerin.toFixed(4), not: "gövdeye bakan köşe yok (yalnız dışa bakan yüzey ölçüldü)" };
  }
  const yakin = mesafeler.filter((d) => d <= E.oturma_arama_m).sort((a, b) => a - b);
  const temas = yakin.filter((d) => d <= E.oturma_temas_m).length;
  const medyan = yakin.length ? yakin[Math.floor(yakin.length / 2)] : null;
  // YASLANMA: kozmetiğin gövdeye DAYANMASI BEKLENEN bölgesi — gövdeye en yakın çeyrek — gerçekten yaslanıyor mu.
  // Ölçüldü (Paket 21 §F): şapka siperi, gözlük camı gibi bilinçli çıkıntılar gövdeye değmez; onları da sayan
  // medyan/oran ölçütü kaplan şapkasını "havada" sanıyordu (kubbe %46 temas · 1,2 cm, siper %0 · 2,3 cm → toplam aday).
  const ceyrek = yakin.slice(0, Math.max(1, Math.ceil(yakin.length / 4)));
  const ceyrekMedyan = ceyrek.length ? ceyrek[Math.floor(ceyrek.length / 2)] : null;
  return {
    kose: mesafeler.length, yakin: yakin.length, temas,
    temas_orani: yakin.length ? +(temas / yakin.length).toFixed(3) : 0,
    yaslanma_m: ceyrekMedyan == null ? null : +ceyrekMedyan.toFixed(4), yaslanan_kose: ceyrek.length,
    medyan_bosluk_m: medyan == null ? null : +medyan.toFixed(4),
    en_buyuk_bosluk_m: yakin.length ? +yakin[yakin.length - 1].toFixed(4) : null,
    en_yakin_m: +Math.min(...mesafeler).toFixed(4),
    disa_bakan: disaBakan, gomulu_kose: gomulu, en_derin_gomulme_m: +enDerin.toFixed(4),
  };
}
export function oturmaKarari(o, E) {
  if (!o.yakin) return `gövdeye ${cm(E.oturma_arama_m)} cm'den yakın YÜZEY YOK — en yakın köşe ${cm(o.en_yakin_m)} cm uzakta`;
  const sebep = [];
  if (o.yaslanma_m > E.oturma_yaslanma_m) sebep.push(`yaslanma ${cm(o.yaslanma_m)} cm > ${cm(E.oturma_yaslanma_m)} cm (gövdeye en yakın ${o.yaslanan_kose} köşenin medyanı)`);
  if (o.temas_orani < E.oturma_temas_orani) sebep.push(`temas oranı ${yuzde(o.temas_orani)} < ${yuzde(E.oturma_temas_orani)}`);
  return sebep.length ? sebep.join(" · ") : null;
}
export const oturmaYazi = (ad, o) => `${ad}: gövdeye bakan ${o.yakin} köşenin ${o.temas}'i temas ediyor (${yuzde(o.temas_orani)}), medyan boşluk ${o.medyan_bosluk_m == null ? "—" : cm(o.medyan_bosluk_m) + " cm"}, en büyük ${o.en_buyuk_bosluk_m == null ? "—" : cm(o.en_buyuk_bosluk_m) + " cm"} (toplam ${o.kose} köşe)`;

// ---------------------------------------------------------------- C. AÇIK KENAR
/** Ada başına delik döngüleri: [{ kenar, alan_m2, merkez }] */
export function delikler(ada) {
  const p = ada.geo.attributes.position.array, anahtar = new Map(), noktalar = [];
  const id = (i) => { const k = `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`; if (!anahtar.has(k)) { anahtar.set(k, anahtar.size); noktalar.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2])); } return anahtar.get(k); };
  const kenar = new Map();
  for (let t = 0; t < p.length; t += 9) {
    const v = [id(t), id(t + 3), id(t + 6)];
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { if (v[a] === v[b]) continue; const k = v[a] < v[b] ? `${v[a]}_${v[b]}` : `${v[b]}_${v[a]}`; kenar.set(k, (kenar.get(k) ?? 0) + 1); }
  }
  const acik = [...kenar.entries()].filter(([, c]) => c === 1).map(([k]) => k.split("_").map(Number));
  if (!acik.length) return [];
  const eb = new Map(); const bul = (x) => { while (eb.get(x) !== x) { eb.set(x, eb.get(eb.get(x))); x = eb.get(x); } return x; };
  for (const [a, b] of acik) { if (!eb.has(a)) eb.set(a, a); if (!eb.has(b)) eb.set(b, b); eb.set(bul(a), bul(b)); }
  const gruplar = new Map();
  for (const [a, b] of acik) { const r = bul(a); if (!gruplar.has(r)) gruplar.set(r, { kenar: 0, kose: new Set() }); const g = gruplar.get(r); g.kenar++; g.kose.add(a); g.kose.add(b); }
  return [...gruplar.values()].map((g) => {
    const pts = [...g.kose].map((i) => noktalar[i]);
    const { C, m } = kovaryans(pts);
    const [e0, e1, e2] = ozvektorler(C);
    // normal = en küçük varyanslı eksen; döngü noktaları o düzleme izdüşürülüp açıya göre sıralanır, shoelace alanı
    const varyans = [e0, e1, e2].map((e) => pts.reduce((s, v) => s + (v.clone().sub(m).dot(e)) ** 2, 0));
    const sira = [0, 1, 2].sort((a, b) => varyans[a] - varyans[b]);
    const [n, u, w] = sira.map((i) => [e0, e1, e2][i]);
    const iki = pts.map((v) => { const d = v.clone().sub(m); return [d.dot(u), d.dot(w)]; }).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    let alan = 0; for (let i = 0; i < iki.length; i++) { const [x0, y0] = iki[i], [x1, y1] = iki[(i + 1) % iki.length]; alan += x0 * y1 - x1 * y0; }
    return { kenar: g.kenar, alan_m2: +Math.abs(alan / 2).toFixed(5), merkez: m.toArray().map((x) => +x.toFixed(3)), normal: n.toArray().map((x) => +x.toFixed(2)) };
  });
}
export function testAcikKenar(adalar, u, E, sonuc, onek = "") {
  let dongu = 0, buyuk = 0;
  for (const A of adalar) for (const d of delikler(A)) {
    dongu++;
    if (d.alan_m2 <= E.acik_kenar_alan_m2) continue;
    buyuk++;
    const izin = (u.acik_kenar_izinli ?? []).find((x) => eslesir(A, x.desen ?? x));
    const kayit = { test: "acik_kenar", adalar: [onek + adaYazi(A)], olcu: { delik_alani_m2: d.alan_m2, acik_kenar: d.kenar, delik_merkezi: d.merkez }, not: `${d.kenar} açık kenarlı delik, ${(d.alan_m2 * 1e4).toFixed(1).replace(".", ",")} cm² (eşik ${(E.acik_kenar_alan_m2 * 1e4).toFixed(0)} cm²)` };
    if (izin) sonuc.susturulan.push({ ...kayit, sebep: izin.sebep ?? "acik_kenar_izinli" }); else sonuc.adaylar.push(kayit);
  }
  sonuc.istatistik.acik_kenar = { ada: adalar.length, delik_dongusu: dongu, esik_ustu: buyuk, esik_m2: E.acik_kenar_alan_m2 };
}

// ---------------------------------------------------------------- D. KALINLIK
export function kalinlikOlc(ada) {
  const p = ada.geo.attributes.position.array;
  const { C, m } = kovaryans(ada.kose);
  const eksenler = ozvektorler(C).map((e) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of ada.kose) { const x = v.clone().sub(m).dot(e); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return { e, uzanim: hi - lo };
  }).sort((x, y) => x.uzanim - y.uzanim);
  // İZDÜŞÜM ALANI (yüzey alanı DEĞİL): üçgenler en kısa eksene dik düzleme izdüşürülür, iki yüz sayılmasın diye /2.
  // Ölçüldü: yüzey alanı kullanılınca gözlük çerçevesi (2,2 cm kalınlığında ince halka) "kâğıt" sanılıyordu —
  // halkanın yüzeyi büyük ama kapladığı düzlem alanı küçük. Kanat tüyünde ikisi de büyük.
  let izdusum = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < p.length; t += 9) {
    a.fromArray(p, t); b.fromArray(p, t + 3); c.fromArray(p, t + 6);
    n.copy(b).sub(a).cross(c.clone().sub(a));
    izdusum += Math.abs(n.dot(eksenler[0].e)) / 2 / 2;   // |n| = 2 × üçgen alanı; iki yüz → /2
  }
  let yuzey = 0;
  for (let t = 0; t < p.length; t += 9) { a.fromArray(p, t); b.fromArray(p, t + 3); c.fromArray(p, t + 6); yuzey += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2; }
  const eks = eksenler.map((x) => x.uzanim);
  return { kisa_m: +eks[0].toFixed(4), uzun_m: +eks[2].toFixed(4), oran: +(eks[0] / Math.max(eks[2], 1e-9)).toFixed(4), izdusum_alan_m2: +izdusum.toFixed(4), yuzey_alan_m2: +yuzey.toFixed(4) };
}
export function testKalinlik(adalar, u, E, sonuc, onek = "") {
  let olculen = 0;
  for (const A of adalar) {
    const k = kalinlikOlc(A); olculen++;
    // ÖLÇÜLDÜ (Paket 21 §D): oran kuralı kanat tüyünü kaçırıyor (1,4 cm × 46 cm → oran 0,03). Ölçüt MUTLAK kalınlık.
    if (!(k.kisa_m < E.kalinlik_asgari_m && k.izdusum_alan_m2 > E.kalinlik_alan_m2)) continue;
    const izin = (u.yassi_olabilir ?? []).find((x) => eslesir(A, x.desen ?? x));
    const kayit = { test: "kalinlik", adalar: [onek + adaYazi(A)], olcu: k, not: `en kısa uzanım ${cm(k.kisa_m)} cm < ${cm(E.kalinlik_asgari_m)} cm (en uzun ${cm(k.uzun_m)} cm, yassılık oranı ${k.oran}), izdüşüm alanı ${k.izdusum_alan_m2} m² — kâğıt gibi` };
    if (izin) sonuc.susturulan.push({ ...kayit, sebep: izin.sebep ?? "yassi_olabilir" }); else sonuc.adaylar.push(kayit);
  }
  sonuc.istatistik.kalinlik = { olculen_ada: olculen, asgari_kalinlik_m: E.kalinlik_asgari_m, alan_esigi_m2: E.kalinlik_alan_m2 };
}

// ---------------------------------------------------------------- varlık akışları
const meshBul = (gltf, sart) => { let m = null; gltf.scene.traverse((o) => { if (!m && o.isMesh && sart(o)) m = o; }); return m; };
const dunyaGeo = (m) => { const g = m.geometry.clone().applyMatrix4(m.matrixWorld); return g.index ? g.toNonIndexed() : g; };

/** §A kodla çizilen kozmetik (kendi uzayında): açık kenar + kalınlık. */
export async function kodKozmetikTestEt(dosya, u, E) {
  const gltf = await glbOku(dosya);
  const m = meshBul(gltf, (o) => o.name.startsWith("kozmetik_"));
  const adalar = adalaraAyir(dunyaGeo(m), BOLGE_ADLARI);
  const sonuc = { varlik: path.basename(dosya, ".glb"), istatistik: { ada: adalar.length }, adaylar: [], susturulan: [] };
  testAcikKenar(adalar, u, E, sonuc, m.name + " · ");
  testKalinlik(adalar, u, E, sonuc, m.name + " · ");
  sonuc.adaListesi = adalar.map((a) => ({ no: a.no, ada: adaYazi(a), ucgen: a.ucgen, kapali: a.kapali }));
  return sonuc;
}

// ---------------------------------------------------------------- PAKET 23 §F.1 PARÇA BÜTÜNLÜĞÜ
/**
 * Bir kozmetiğin adaları BİRBİRİNE bağlı mı? `havada` testi yalnız gövdeye teması ölçüyor: atkının halkası boyna,
 * ucu göğse değdiği için ikisi de "bağlı" sayılıyor, birbirlerine değmedikleri hiç sorulmuyordu (ölçüldü:
 * takili_insan_atki 2 ada / 0 aday, takili_insan_sapka 3 ada / 0 aday — sahibinin gördüğü kopukluk tam buydu).
 * Kural: birden fazla ada varsa, her ada en az bir başka adaya `parca_temas_m` içinde değmeli.
 * Kasıtlı ayrık parçalar `ayrik_izinli` ile GEREKÇELİ muaf tutulur (gerekçesiz muafiyet yok).
 */
export function testParcaButunlugu(adalar, u, E, sonuc, onek = "") {
  sonuc.istatistik.parca_butunlugu = { ada: adalar.length, temas_m: E.parca_temas_m };
  if (adalar.length < 2) return;
  const bvhler = adalar.map((A) => A.geo.boundsTree ?? (A.geo.boundsTree = new MeshBVH(A.geo)));
  const enYakin = (i, j) => {
    const p = adalar[i].geo.attributes.position, h = {}, v = new THREE.Vector3();
    let en = Infinity;
    for (let k = 0; k < p.count; k += Math.max(1, Math.floor(p.count / 400))) {
      v.fromBufferAttribute(p, k);
      const r = bvhler[j].closestPointToPoint(v, h, 0, en);
      if (r) en = Math.min(en, r.distance);
      if (en <= E.parca_temas_m) break;
    }
    return en;
  };
  // Adaları temas grafiğiyle birleştir (birleşim-bul)
  const ebeveyn = adalar.map((_, i) => i);
  const bul = (x) => { while (ebeveyn[x] !== x) { ebeveyn[x] = ebeveyn[ebeveyn[x]]; x = ebeveyn[x]; } return x; };
  const mesafe = new Map();
  for (let i = 0; i < adalar.length; i++) {
    for (let j = i + 1; j < adalar.length; j++) {
      const d = Math.min(enYakin(i, j), enYakin(j, i));
      mesafe.set(`${i}-${j}`, d);
      if (d <= E.parca_temas_m) ebeveyn[bul(i)] = bul(j);
    }
  }
  const gruplar = new Map();
  adalar.forEach((_, i) => { const r = bul(i); gruplar.set(r, [...(gruplar.get(r) ?? []), i]); });
  sonuc.istatistik.parca_butunlugu.bagli_grup = gruplar.size;
  sonuc.istatistik.parca_butunlugu.ada_mesafeleri_cm = [...mesafe].map(([k, d]) => `${k}: ${cm(d)}`);
  if (gruplar.size < 2) return;
  // Her kopuk grup için: en büyük gruba olan en kısa mesafe
  const sirali = [...gruplar.values()].sort((a, b) => b.length - a.length);
  const ana = sirali[0];
  for (const grup of sirali.slice(1)) {
    let en = Infinity;
    for (const i of grup) for (const j of ana) en = Math.min(en, mesafe.get(`${Math.min(i, j)}-${Math.max(i, j)}`) ?? Infinity);
    const A = adalar[grup[0]];
    const izin = (u.ayrik_izinli ?? []).find((x) => eslesir(A, x.desen ?? x));
    const kayit = {
      test: "parca_butunlugu",
      adalar: grup.map((i) => onek + adaYazi(adalar[i])),
      olcu: { kopuk_ada: grup.length, ana_govdeye_uzaklik_m: +en.toFixed(4), temas_esigi_m: E.parca_temas_m },
      not: `kozmetiğin ${grup.length} adası diğer parçalara değmiyor — en yakın parça ${cm(en)} cm uzakta (eşik ${cm(E.parca_temas_m)} cm)`,
    };
    if (izin) sonuc.susturulan.push({ ...kayit, sebep: izin.sebep ?? "ayrik_izinli" }); else sonuc.adaylar.push(kayit);
  }
}

// ---------------------------------------------------------------- PAKET 23 §F.2 / §F.3 GÖVDE
/** Gövde kesitleri: her yükseklikte merkez eksenden ışınla ön/arka/yan yüzey (düşük çözünürlükte köşe saymak yanıltıyordu). */
export function govdeKesitleri(geo, y0, y1, N = 11) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  const at = (y, yon) => {
    rc.set(new THREE.Vector3(0, y, 0), yon);
    const k = rc.intersectObject(mesh, false).filter((h) => h.distance <= 0.6);
    return k.length ? k[k.length - 1].distance : null;
  };
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), y = y0 + (y1 - y0) * t;
    const on = at(y, new THREE.Vector3(0, 0, 1)), arka = at(y, new THREE.Vector3(0, 0, -1));
    if (on == null || arka == null) continue;
    out.push({ t, y, on, arka, derinlik: on + arka, merkez: (on - arka) / 2 });
  }
  return out;
}

/**
 * §F.2 `siluet_profili` — gövde boyunca yatay kesit yükseklikle değişiyor mu? Sabit yarıçap = fıçı gövde.
 * §F.3 `durus_ekseni` — Idle pozunda gövdenin öne yatıklığı ve karın taşması (bütün diğer ölçümler bağlama pozunda).
 */
export function govdeTestEt(s, u, E, sonuc) {
  const { Hips: hips, Neck: neck } = s.kemik ?? {};
  if (!hips || !neck) { sonuc.istatistik.siluet_profili = "kemik konumu yok (atlandı)"; return; }
  const k = govdeKesitleri(s.govde, hips.y + 0.05, neck.y - 0.04);
  if (k.length < 4) { sonuc.istatistik.siluet_profili = "kesit alınamadı"; return; }
  const alt = k.filter((d) => d.t <= 0.3), ust = k.filter((d) => d.t >= 0.7);
  const ort = (a, f) => a.reduce((x, d) => x + f(d), 0) / Math.max(1, a.length);
  const karin = k.filter((d) => d.t >= 0.15 && d.t <= 0.45), gogus = k.filter((d) => d.t >= 0.55 && d.t <= 0.85);
  const dk = Math.max(...karin.map((d) => d.derinlik)), dg = Math.max(...gogus.map((d) => d.derinlik));
  const belOrani = (dg - dk) / dg;
  const tasma = Math.max(...karin.map((d) => d.on)) - Math.max(...gogus.map((d) => d.on));
  const yuzeyDz = ort(ust, (d) => d.merkez) - ort(alt, (d) => d.merkez);
  const aci = (Math.atan2(yuzeyDz, ort(ust, (d) => d.y) - ort(alt, (d) => d.y)) * 180) / Math.PI;

  sonuc.istatistik.siluet_profili = { karin_derinlik_m: +dk.toFixed(4), gogus_derinlik_m: +dg.toFixed(4), bel_orani: +belOrani.toFixed(3), esik: E.bel_orani_asgari };
  sonuc.istatistik.durus_ekseni = { kemik_dz_m: +(neck.z - hips.z).toFixed(4), govde_yuzeyi_dz_m: +yuzeyDz.toFixed(4), aci_derece: +aci.toFixed(1), karin_tasma_m: +tasma.toFixed(4), esikler: { durus_one_yatik_m: E.durus_one_yatik_m, karin_tasma_m: E.karin_tasma_m } };

  const siluetMuaf = (u.siluet_muaf_turler ?? []).includes(u.tur);
  if (siluetMuaf) sonuc.istatistik.siluet_profili.muaf = u._siluet_muaf_gerekce ?? "tür muaf";
  if (!siluetMuaf && belOrani < E.bel_orani_asgari) sonuc.adaylar.push({
    test: "siluet_profili", adalar: ["Govde"],
    olcu: sonuc.istatistik.siluet_profili,
    not: `bel yok: karın derinliği ${cm(dk)} cm, göğüs ${cm(dg)} cm → fark %${(belOrani * 100).toFixed(1)} < %${E.bel_orani_asgari * 100}`,
  });
  if (yuzeyDz > E.durus_one_yatik_m) sonuc.adaylar.push({
    test: "durus_ekseni", adalar: ["Govde"],
    olcu: sonuc.istatistik.durus_ekseni,
    not: `gövde öne yatık: yüzey ekseni ${cm(yuzeyDz)} cm (${aci.toFixed(1)}°) > ${cm(E.durus_one_yatik_m)} cm`,
  });
  if (tasma > E.karin_tasma_m) sonuc.adaylar.push({
    test: "durus_ekseni", adalar: ["Govde"],
    olcu: sonuc.istatistik.durus_ekseni,
    not: `karın göğüsten ${cm(tasma)} cm ileride (eşik ${cm(E.karin_tasma_m)} cm)`,
  });
}

/** §E.1 takılı poz: oturma (saç varyantlarının hepsinde) + açık kenar + kalınlık, kozmetik adaları üzerinde. */
export async function takiliTestEt(dosya, u, E) {
  const gltf = await glbOku(dosya);
  const govdeM = meshBul(gltf, (o) => o.name === "Govde"), kozM = meshBul(gltf, (o) => o.name.startsWith("kozmetik_"));
  const koz = kozM.name.replace("kozmetik_", "");
  const sonuc = { varlik: path.basename(dosya, ".glb"), istatistik: {}, adaylar: [], susturulan: [], oturma: [] };
  // B. OTURMA — GLB saç 1; saç 2 ve 3 oyunda da var → her varyant ayrıca kurulur, en kötüsü karar verir
  for (const sac of u.saclar ?? [1]) {
    const s = sac === 1 ? { govde: dunyaGeo(govdeM), parca: { geo: dunyaGeo(kozM) } } : await takiliKur(u.tur, koz, { sac });
    const govdeIdx = s.govde.index ? s.govde : s.govde;
    const o = oturmaOlc(govdeIdx, s.parca.geo, E);
    const karar = oturmaKarari(o, E);
    sonuc.oturma.push({ sac, ...o, yazi: oturmaYazi(`${u.tur} ${koz} (saç ${sac})`, o), aday: !!karar });
    if (karar) sonuc.adaylar.push({ test: "oturma", adalar: [`kozmetik_${koz} (${u.tur}, saç ${sac}, Idle)`], olcu: o, not: `${oturmaYazi(koz, o)} → ${karar}` });
  }
  sonuc.istatistik.oturma = { saclar: u.saclar ?? [1], temas_m: E.oturma_temas_m, arama_m: E.oturma_arama_m, oran_esigi: E.oturma_temas_orani, yaslanma_esigi_m: E.oturma_yaslanma_m };
  const adalar = adalaraAyir(dunyaGeo(kozM), BOLGE_ADLARI);
  sonuc.istatistik.ada = adalar.length;
  testAcikKenar(adalar, u, E, sonuc, `kozmetik_${koz} · `);
  testKalinlik(adalar, u, E, sonuc, `kozmetik_${koz} · `);
  testParcaButunlugu(adalar, u, E, sonuc, `kozmetik_${koz} · `);   // §F.1
  // §F.2/§F.3: gövde siluet + duruş — Idle pozunda, tür başına bir kez (şapka satırında ölçmek yeter)
  if (koz === "sapka") {
    const poz = await takiliKur(u.tur, "sapka", { sac: 1, klip: "Idle", zaman: 0.5 });
    govdeTestEt(poz, u, E, sonuc);
  }
  sonuc.adaListesi = adalar.map((a) => ({ no: a.no, ada: adaYazi(a), ucgen: a.ucgen, kapali: a.kapali }));
  return sonuc;
}
