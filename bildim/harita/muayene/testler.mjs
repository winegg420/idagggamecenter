// ============================================================
// MUAYENE — MEKANİK TESTLER (Aşama 1E Adım 2). Node, GLB geometrisi, three-mesh-bvh (devDependency).
//
// Testler "BOZUK" ilan ETMEZ, "FAIL ADAYI" üretir. Üstveride beyan edilen durumlar aday listesine girmez;
// ama SUSTURULAN olarak ayrıca sayılır (yanlış alarm hesabı için).
//
//   havada    — ada grafiği (temas = üçgen kesişimi ya da ≤ eşik mesafe); zemine/ana gövdeye bağlanmayan adalar
//   simetri   — X'te aynalanan köşe, varlık yüzeyine tolerans içinde değmiyorsa eşleşmemiş; ada bazında oran
//   icice     — A'nın köşeleri kapalı B'nin içinde ve derinlik > pay (ışın paritesi, 3 yön çoğunluk)
//   gomulu    — A'nın köşelerinin ≥ %60'ı başka kapalı adaların içinde (görünmeyen / kaybolan parça)
//   kozmetik  — karakterde her kozmetik bağlama pozunda yuvasına takılı; gövde adalarıyla üçgen kesişimi
//
// "Ada" = köşe KONUMUYLA kaynaşan bağlantılı üçgen kümesi (UV dikişi adayı bölmez). Etiket = bölge:hücre
// (karakterde `_bolge` + atlas hücresi, prop/binada atlas hücresi) + ağırlık merkezi.
// ============================================================
import fs from "fs";
import path from "path";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { hucreTablosu, YUZ, ifadeRect } from "../varlik/atlas.mjs";
import { glbOku } from "./glbOku.mjs";

const VARSAYILAN_BOLGE = { ten: 0, sacKase: 1, sacKisa: 2, sacKuyruk: 3, ust: 4, alt: 5, ayakkabi: 6, ceket: 7, kapuson: 8, kurk: 9, metal: 10, boya: 11, ekran: 12, gozL: 13, gozR: 14, agiz: 15, cam: 16, diger: 17, yaka: 18, taban: 19, bilek: 20, plastik: 21 };
const KOZ_YUVA = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva", kuyruk: "sirtYuva" };
const HUCRELER = Object.entries(hucreTablosu());
const YUZ_RECT = [["yuz", YUZ.insan], ["yuz", YUZ.kaplan], ["yuz", YUZ.robot]];

// ---------------------------------------------------------------- etiket eşleme (üstveri desenleri)
const globRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
const aralikta = (v, r) => !r || (v >= r[0] && v <= r[1]);
/** desen: "bolge:hucre" glob'u (ya da yalnız bölge / yalnız hücre) veya { desen, x, absx, y, z } konum süzgeçli. */
function eslesir(ada, desen) {
  const d = typeof desen === "string" ? { desen } : desen;
  const re = globRe(d.desen);
  const adOk = re.test(ada.etiket) || re.test(ada.bolge) || re.test(ada.hucre);
  if (!adOk) return false;
  const [x, y, z] = ada.merkez;
  return aralikta(x, d.x) && aralikta(Math.abs(x), d.absx) && aralikta(y, d.y) && aralikta(z, d.z);
}
/** izinli örtüşme kuralı (a,b sırasız). derinlik verildiyse yalnız o derinliğe kadar susturur. */
function izinliKural(kurallar, A, B, olcu = 0) {
  for (const k of kurallar ?? []) {
    const eslesme = (eslesir(A, k.a) && eslesir(B, k.b)) || (eslesir(A, k.b) && eslesir(B, k.a));
    if (eslesme && (k.derinlik_max_m == null || olcu <= k.derinlik_max_m)) return k;
  }
  return null;
}
const adaYazi = (a) => `${a.etiket} [x ${a.merkez[0].toFixed(2)} · y ${a.merkez[1].toFixed(2)} · z ${a.merkez[2].toFixed(2)}]`;

// ---------------------------------------------------------------- adalara ayırma
function adalaraAyir(geo, bolgeAdlari) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, bol = geo.attributes._bolge;
  const idx = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
  // köşe kaynaştırma (0,1 mm ızgara)
  const anahtar = new Map(), kaynak = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    if (!anahtar.has(k)) anahtar.set(k, anahtar.size);
    kaynak[i] = anahtar.get(k);
  }
  const ebeveyn = new Int32Array(anahtar.size).map((_, i) => i);
  const bul = (i) => { while (ebeveyn[i] !== i) { ebeveyn[i] = ebeveyn[ebeveyn[i]]; i = ebeveyn[i]; } return i; };
  const birlestir = (a, b) => { a = bul(a); b = bul(b); if (a !== b) ebeveyn[a] = b; };
  const ucgenSay = idx.length / 3;
  for (let t = 0; t < ucgenSay; t++) { birlestir(kaynak[idx[t * 3]], kaynak[idx[t * 3 + 1]]); birlestir(kaynak[idx[t * 3]], kaynak[idx[t * 3 + 2]]); }
  const gruplar = new Map();
  for (let t = 0; t < ucgenSay; t++) { const r = bul(kaynak[idx[t * 3]]); if (!gruplar.has(r)) gruplar.set(r, []); gruplar.get(r).push(t); }
  const adalar = [];
  for (const ucgenler of gruplar.values()) {
    const koseSet = new Set(), p = new Float32Array(ucgenler.length * 9);
    const bolgeSay = new Map(); let us = 0, vs = 0, n = 0;
    const kenar = new Map();
    ucgenler.forEach((t, j) => {
      const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
      v.forEach((vi, m) => {
        p[j * 9 + m * 3] = pos.getX(vi); p[j * 9 + m * 3 + 1] = pos.getY(vi); p[j * 9 + m * 3 + 2] = pos.getZ(vi);
        koseSet.add(kaynak[vi]);
        if (uv) { us += uv.getX(vi); vs += uv.getY(vi); n++; }
        if (bol) { const b = Math.round(bol.getX(vi)); bolgeSay.set(b, (bolgeSay.get(b) ?? 0) + 1); }
      });
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const ka = kaynak[v[a]], kb = kaynak[v[b]]; if (ka === kb) continue; const k = ka < kb ? `${ka}_${kb}` : `${kb}_${ka}`; kenar.set(k, (kenar.get(k) ?? 0) + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.computeBoundingBox();
    // benzersiz köşeler (kaynaşmış) — örnekleme noktaları
    const kose = []; const gorulen = new Set();
    for (let i = 0; i < p.length; i += 3) { const k = `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`; if (!gorulen.has(k)) { gorulen.add(k); kose.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2])); } }
    const merkez = kose.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / kose.length);
    // yüzey örnekleri = köşeler + üçgen ağırlık merkezleri. Yalnız köşe yetmez: tek bölümlü silindirin köşeleri
    // yalnız iki uçtadır; iki ucu başka parçaya giren anten/kol "tamamen gömülü" sayılıyordu (ilk çalıştırma).
    const ornek = [...kose];
    const kenarOrta = new Set();
    for (let i = 0; i < p.length; i += 9) {
      ornek.push(new THREE.Vector3((p[i] + p[i + 3] + p[i + 6]) / 3, (p[i + 1] + p[i + 4] + p[i + 7]) / 3, (p[i + 2] + p[i + 5] + p[i + 8]) / 3));
      for (const [a, b] of [[0, 3], [3, 6], [6, 0]]) {   // kenar orta noktaları (tekrarsız): uzun yan yüzlerin ortası da örneklensin
        const m = new THREE.Vector3((p[i + a] + p[i + b]) / 2, (p[i + a + 1] + p[i + b + 1]) / 2, (p[i + a + 2] + p[i + b + 2]) / 2);
        const k = `${Math.round(m.x * 1e4)},${Math.round(m.y * 1e4)},${Math.round(m.z * 1e4)}`;
        if (!kenarOrta.has(k)) { kenarOrta.add(k); ornek.push(m); }
      }
    }
    const u = n ? us / n : 0, v = n ? vs / n : 0;
    let hucre = "?";
    for (const [ad, r] of HUCRELER) if (u >= r.u0 - 0.01 && u <= r.u1 + 0.01 && v >= r.v0 - 0.01 && v <= r.v1 + 0.01) { hucre = ad; break; }
    if (hucre === "?") { for (const [ad, r] of YUZ_RECT) if (u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1) hucre = ad; }
    if (hucre === "?") { for (let i = 0; i < 16; i++) { const r = ifadeRect(i); if (u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1) { hucre = "ifade"; break; } } }
    const bolgeKod = bolgeSay.size ? [...bolgeSay.entries()].sort((a, b) => b[1] - a[1])[0][0] : -1;
    const bolge = bolgeAdlari[bolgeKod] ?? "diger";
    const sinir = [...kenar.values()].filter((c) => c === 1).length;
    adalar.push({ geo: g, kose, ornek, merkez: merkez.toArray(), kutu: g.boundingBox, ucgen: ucgenler.length, bolge, hucre, etiket: `${bolge}:${hucre}`, kapali: sinir === 0, sinirKenar: sinir });
  }
  adalar.sort((a, b) => a.etiket.localeCompare(b.etiket) || a.merkez[1] - b.merkez[1] || a.merkez[0] - b.merkez[0]);
  adalar.forEach((a, i) => { a.no = i; a.bvh = new MeshBVH(a.geo); });
  return adalar;
}

// ---------------------------------------------------------------- geometri sorguları
const YONLER = [new THREE.Vector3(1, 0.37, 0.21).normalize(), new THREE.Vector3(-0.3, 1, 0.45).normalize(), new THREE.Vector3(0.26, -0.41, 1).normalize()];
const isin = new THREE.Ray();
function icinde(bvh, kutu, v) {
  if (!kutu.containsPoint(v)) return false;
  let tek = 0;
  for (const d of YONLER) {
    isin.set(v, d);
    const vuruslar = bvh.raycast(isin, THREE.DoubleSide).map((h) => h.distance).filter((x) => x > 1e-6).sort((a, b) => a - b);
    let say = 0, son = -1; for (const x of vuruslar) { if (x - son > 1e-5) say++; son = x; }
    if (say % 2 === 1) tek++;
  }
  return tek >= 2;
}
const yakinNokta = {};
function mesafe(bvh, v, max) { const r = bvh.closestPointToPoint(v, yakinNokta, 0, max); return r ? r.distance : Infinity; }
const kutuYakin = (a, b, e) => a.min.x - e <= b.max.x && a.max.x + e >= b.min.x && a.min.y - e <= b.max.y && a.max.y + e >= b.min.y && a.min.z - e <= b.max.z && a.max.z + e >= b.min.z;
const BIRIM = new THREE.Matrix4();

function temasEder(A, B, esik) {
  if (!kutuYakin(A.kutu, B.kutu, esik)) return false;
  if (A.bvh.intersectsGeometry(B.geo, BIRIM)) return true;
  for (const v of A.kose) if (mesafe(B.bvh, v, esik) <= esik) return true;
  for (const v of B.kose) if (mesafe(A.bvh, v, esik) <= esik) return true;
  return false;
}

// ---------------------------------------------------------------- testler
function testHavada(adalar, u, sonuc) {
  const esik = u.temas_esigi_m ?? 0.005;
  const komsu = adalar.map(() => []);
  for (let i = 0; i < adalar.length; i++) for (let j = i + 1; j < adalar.length; j++) if (temasEder(adalar[i], adalar[j], esik)) { komsu[i].push(j); komsu[j].push(i); }
  const zeminVar = u.zemin_temasi !== false;
  let kaynaklar = zeminVar ? adalar.filter((a) => a.kutu.min.y <= (u.zemin_esigi_m ?? 0.01)).map((a) => a.no) : [];
  if (!kaynaklar.length) kaynaklar = [adalar.reduce((m, a) => (a.ucgen > m.ucgen ? a : m), adalar[0]).no];
  const ulasilan = new Set(kaynaklar), kuyruk = [...kaynaklar];
  while (kuyruk.length) { const i = kuyruk.shift(); for (const j of komsu[i]) if (!ulasilan.has(j)) { ulasilan.add(j); kuyruk.push(j); } }
  // bağlantısız adaları gruplara ayır (birlikte havada duran parça kümeleri)
  const kalan = adalar.filter((a) => !ulasilan.has(a.no));
  const grupNo = new Map(); let g = 0;
  for (const a of kalan) {
    if (grupNo.has(a.no)) continue;
    const q = [a.no]; grupNo.set(a.no, g);
    while (q.length) { const i = q.shift(); for (const j of komsu[i]) if (!ulasilan.has(j) && !grupNo.has(j)) { grupNo.set(j, g); q.push(j); } }
    g++;
  }
  for (let k = 0; k < g; k++) {
    const uyeler = kalan.filter((a) => grupNo.get(a.no) === k);
    let enYakin = Infinity;
    for (const a of uyeler) for (const b of adalar) if (ulasilan.has(b.no)) for (const v of a.kose) enYakin = Math.min(enYakin, mesafe(b.bvh, v, 0.5));
    const izin = uyeler.every((a) => (u.havada_durabilir ?? []).some((d) => eslesir(a, d)));
    const kayit = { test: "havada", adalar: uyeler.map(adaYazi), olcu: { en_yakin_bagli_parca_m: Number.isFinite(enYakin) ? +enYakin.toFixed(4) : ">0,5" }, not: `${uyeler.length} ada, ${uyeler.reduce((s, a) => s + a.ucgen, 0)} üçgen; bağlı parçaya en yakın mesafe` };
    (izin ? sonuc.susturulan : sonuc.adaylar).push(izin ? { ...kayit, sebep: "havada_durabilir" } : kayit);
  }
  sonuc.istatistik.havada = { ada: adalar.length, zemine_bagli_kaynak: kaynaklar.length, bagli: ulasilan.size, bagsiz_grup: g };
}

function testSimetri(adalar, u, sonuc) {
  if (!(u.simetri_zorunlu ?? []).includes("X")) { sonuc.istatistik.simetri = "beyan yok (atlandı)"; return; }
  const tol = u.simetri_tolerans_m ?? 0.01, x0 = u.simetri_ekseni_x ?? 0, oranEsik = u.simetri_oran_esigi ?? 0.25;
  const hepsi = new THREE.BufferGeometry();
  const parca = []; for (const a of adalar) parca.push(a.geo.attributes.position.array);
  const toplam = new Float32Array(parca.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parca) { toplam.set(p, o); o += p.length; }
  hepsi.setAttribute("position", new THREE.BufferAttribute(toplam, 3));
  const bvh = new MeshBVH(hepsi);
  const m = new THREE.Vector3();
  for (const a of adalar) {
    let eslesmeyen = 0;
    for (const v of a.kose) { m.set(2 * x0 - v.x, v.y, v.z); if (mesafe(bvh, m, tol) > tol) eslesmeyen++; }
    const oran = eslesmeyen / a.kose.length;
    if (oran <= oranEsik) continue;
    const istisna = (u.simetri_istisna ?? []).find((d) => eslesir(a, d.desen ? d : { ...d, desen: d }) || eslesir(a, d));
    const kayit = { test: "simetri", adalar: [adaYazi(a)], olcu: { eslesmeyen_kose_orani: +oran.toFixed(2), tolerans_m: tol }, not: `aynası (x → ${2 * x0} − x) varlık yüzeyinde yok` };
    if (istisna) sonuc.susturulan.push({ ...kayit, sebep: istisna.sebep ?? "simetri_istisna" }); else sonuc.adaylar.push(kayit);
  }
  sonuc.istatistik.simetri = { tolerans_m: tol, eksen_x: x0 };
}

function testIcice(adalar, u, sonuc) {
  const pay = u.ortusme_payi_m ?? 0.01, gomuluEsik = u.gomulu_oran_esigi ?? 0.6;
  const kapali = adalar.filter((a) => a.kapali);
  for (const A of adalar) {
    const icerdeHerhangi = new Set(), icerdeIzinsiz = new Set();
    for (const B of kapali) {
      if (A === B || !kutuYakin(A.kutu, B.kutu, 0)) continue;
      let derin = 0; const icteki = [];
      for (let i = 0; i < A.ornek.length; i++) { const v = A.ornek[i]; if (icinde(B.bvh, B.kutu, v)) { icteki.push(i); derin = Math.max(derin, mesafe(B.bvh, v, 1)); } }
      if (!icteki.length) continue;
      icteki.forEach((i) => icerdeHerhangi.add(i));
      const kural = izinliKural(u.izinli_ortusme, A, B, derin);
      if (!kural) icteki.forEach((i) => icerdeIzinsiz.add(i));
      if (derin <= pay) continue;
      const kayit = { test: "icice", adalar: [adaYazi(A), adaYazi(B)], olcu: { derinlik_m: +derin.toFixed(3), icteki_ornek: `${icteki.length}/${A.ornek.length}` }, not: `1. ada 2. adanın içine ${(derin * 100).toFixed(1)} cm giriyor` };
      if (kural) sonuc.susturulan.push({ ...kayit, sebep: kural.sebep }); else sonuc.adaylar.push(kayit);
    }
    const oran = icerdeHerhangi.size / A.ornek.length;
    if (oran < gomuluEsik) continue;
    const izinsizOran = icerdeIzinsiz.size / A.ornek.length;
    const kural = (u.gomulu_izinli ?? []).find((d) => eslesir(A, d));
    const kayit = { test: "gomulu", adalar: [adaYazi(A)], olcu: { gomulu_yuzey_orani: +oran.toFixed(2), izinsiz_kaplayicilarla: +izinsizOran.toFixed(2) }, not: `yüzey örneklerinin %${Math.round(oran * 100)}'i başka parçaların içinde — görünmeyebilir` };
    if (kural) sonuc.susturulan.push({ ...kayit, sebep: kural.sebep ?? "gomulu_izinli" });
    else if (izinsizOran < gomuluEsik) sonuc.susturulan.push({ ...kayit, sebep: "kaplayan parçaların tümü izinli_ortusme kuralında" });
    else sonuc.adaylar.push(kayit);
  }
  sonuc.istatistik.icice = { kapali_ada: kapali.length, acik_ada: adalar.length - kapali.length, pay_m: pay, gomulu_oran_esigi: gomuluEsik };
}

async function testKozmetik(dosyaYolu, gltf, adalar, u, sonuc) {
  const kaynaklar = u.kozmetik ?? {};
  if (!Object.keys(kaynaklar).length) { sonuc.istatistik.kozmetik = "kozmetik yok (atlandı)"; return; }
  const onbellek = new Map();
  let denenen = 0;
  for (const [ad, glb] of Object.entries(kaynaklar)) {
    if (!onbellek.has(glb)) onbellek.set(glb, await glbOku(path.join(path.dirname(dosyaYolu), glb + ".glb")));
    const mesh = onbellek.get(glb).scene.getObjectByName("kozmetik_" + ad);
    const yuva = gltf.scene.getObjectByName(KOZ_YUVA[ad]);
    if (!mesh || !yuva) continue;
    denenen++;
    const g = mesh.geometry.clone().applyMatrix4(yuva.matrixWorld);
    g.computeBoundingBox();
    const bvh = new MeshBVH(g);
    const koz = { etiket: "kozmetik_" + ad, bolge: "kozmetik_" + ad, hucre: "kozmetik_" + ad, merkez: g.boundingBox.getCenter(new THREE.Vector3()).toArray() };
    for (const A of adalar) {
      if (!kutuYakin(A.kutu, g.boundingBox, 0)) continue;
      if (!bvh.intersectsGeometry(A.geo, BIRIM)) continue;
      const kural = izinliKural(u.kozmetik_izinli, koz, A);
      const kayit = { test: "kozmetik", adalar: [`kozmetik_${ad} (${glb})`, adaYazi(A)], olcu: { kesisim: "üçgen kesişimi var" }, not: `bağlama pozunda ${KOZ_YUVA[ad]} yuvasına takılı` };
      if (kural) sonuc.susturulan.push({ ...kayit, sebep: kural.sebep }); else sonuc.adaylar.push(kayit);
    }
  }
  sonuc.istatistik.kozmetik = { denenen_kozmetik: denenen };
}

/** Bir varlığın tüm testleri. Döndürür: { varlik, istatistik, adaylar[], susturulan[] } */
export async function varlikTestEt(dosyaYolu, u) {
  const t0 = Date.now();
  const gltf = await glbOku(dosyaYolu);
  let govde = null; const meshler = [];
  gltf.scene.traverse((o) => { if (o.isMesh) { if (o.name === "Govde") govde = o; if (!o.name.startsWith("kozmetik_")) meshler.push(o); } });
  const bolgeAdlari = Object.fromEntries(Object.entries(govde?.userData?.bolge ?? VARSAYILAN_BOLGE).map(([k, v]) => [v, k]));
  // karakterde yalnız gövde (bağlama pozu, köşeler zaten dünya uzayında); diğerlerinde tüm meshler dünya matrisiyle
  const geolar = (govde ? [govde] : meshler).map((m) => (govde ? m.geometry.clone() : m.geometry.clone().applyMatrix4(m.matrixWorld)));
  const adalar = geolar.flatMap((g) => adalaraAyir(g, bolgeAdlari));
  const sonuc = { varlik: path.basename(dosyaYolu, ".glb"), istatistik: { ada: adalar.length, kapali_ada: adalar.filter((a) => a.kapali).length }, adaylar: [], susturulan: [] };
  testHavada(adalar, u, sonuc);
  testSimetri(adalar, u, sonuc);
  testIcice(adalar, u, sonuc);
  if (govde) await testKozmetik(dosyaYolu, gltf, adalar, u, sonuc);
  sonuc.istatistik.sure_s = +((Date.now() - t0) / 1000).toFixed(1);
  sonuc.adaListesi = adalar.map((a) => ({ no: a.no, ada: adaYazi(a), ucgen: a.ucgen, kapali: a.kapali }));
  return sonuc;
}

// doğrudan çalıştırma: node bildim/harita/muayene/testler.mjs [varlik ...]
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const BURASI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const KOK = path.resolve(BURASI, "../../..");
  const adlar = process.argv.slice(2);
  for (const ad of adlar) {
    const u = JSON.parse(fs.readFileSync(path.join(BURASI, "ustveri", ad + ".json"), "utf8"));
    const s = await varlikTestEt(path.join(KOK, "public/meydan/deneme", u.glb + ".glb"), u);
    console.log(`\n== ${ad}: ${s.adaylar.length} aday · ${s.susturulan.length} susturulan · ${JSON.stringify(s.istatistik)}`);
    for (const a of s.adaylar) console.log(`  [${a.test}] ${a.adalar.join("  ↔  ")}  ${JSON.stringify(a.olcu)}`);
    for (const a of s.susturulan) console.log(`  (sus ${a.test}) ${a.adalar.join("  ↔  ")}  ${JSON.stringify(a.olcu)} — ${a.sebep}`);
  }
}
