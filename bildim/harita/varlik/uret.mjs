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
const BUTCE = { karakterUcgen: 8000, kozmetikUcgen: 600, binaUcgen: 12000, propUcgen: 1500, kediUcgen: 800 };
const AO_KAPALI = process.argv.includes("--ao-kapali");
const PURUZ = 0.82;

/**
 * BÖLGE KODLARI (köşe özniteliği `bolge` → glTF `_BOLGE`). Çalışma anı:
 * pürüzlülük tablosu + emisyon (ekran) + ton çarpanı + varyant çökertme.
 */
export const BOLGE = {
  ten: 0, sacKase: 1, sacKisa: 2, sacKuyruk: 3, ust: 4, alt: 5, ayakkabi: 6, ceket: 7, kapuson: 8,
  kurk: 9, metal: 10, boya: 11, ekran: 12, gozL: 13, gozR: 14, agiz: 15, cam: 16, diger: 17, yaka: 18, taban: 19, bilek: 20,
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
/** Aşama 1C §9: yalnız ÖN/ARKA yüz 0,8 m ızgara (ön cephe AO'su), yanlar bölünmez. */
function bolunmusKutu(w, h, d) { return new THREE.BoxGeometry(w, h, d, bolme(w, 0.8), bolme(h, 0.8), 1); }
const birlestir = (geos) => mergeVertices(mergeGeometries(geos.map(temizle), false));
const malzemeYap = () => new THREE.MeshStandardMaterial({ name: "Atlas", roughness: PURUZ, metalness: 0 });
const D = (geo, hucre, poz, don = null, olcek = null, b = BOLGE.diger) => bolgeYaz(duz(yerlestir(geo, poz, don, olcek), hucre), b);
const Y = (geo, hucre, poz, don = null, olcek = null, b = BOLGE.diger) => bolgeYaz(yay(yerlestir(geo, poz, don, olcek), hucre), b);

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

  // ---- gövde: kalça + göğüs (tıknaz) ----
  ekle(yerlestir(new RoundedBoxGeometry(0.42, 0.30, 0.30, 2, 0.10), hips.clone().add(new THREE.Vector3(0, -0.02, 0)).toArray()), "kot", "Hips", BOLGE.alt, { desenli: true });
  kapsul(hips.clone().add(new THREE.Vector3(0, 0.08, 0)), neck.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.215, "tisort", "Spine1", BOLGE.ust, true);
  // set 2 (şık): ceket kabuğu + gömlek yakası — diğer setlerde çalışma anında çökertilir
  kapsul(hips.clone().add(new THREE.Vector3(0, 0.1, 0)), neck.clone().add(new THREE.Vector3(0, -0.03, 0)), 0.228, "ceket", "Spine1", BOLGE.ceket, true);
  ekle(yerlestir(new RoundedBoxGeometry(0.16, 0.2, 0.03, 1, 0.01), neck.clone().add(new THREE.Vector3(0, -0.2, 0.235)).toArray()), "gomlek", "Spine2", BOLGE.yaka);
  for (const s of [-1, 1]) ekle(yerlestir(new RoundedBoxGeometry(0.07, 0.22, 0.02, 1, 0.008), neck.clone().add(new THREE.Vector3(s * 0.085, -0.2, 0.245)).toArray(), E(0, 0, s * 0.35)), "ceket", "Spine2", BOLGE.ceket, { desenli: true });
  // set 3 (spor): kapüşon halkası (boyun arkası)
  ekle(yerlestir(new THREE.TorusGeometry(0.19, 0.065, 6, 12), neck.clone().add(new THREE.Vector3(0, -0.02, -0.06)).toArray(), E(Math.PI / 2 + 0.5, 0, 0)), "esofman", "Spine2", BOLGE.kapuson, { desenli: true });

  // ---- baş: küre (robotta yuvarlak kutu), BOYALI YÜZ (düzlemsel UV → atlas yüz bölgesi) ----
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
  if (robot) ekle(yerlestir(new RoundedBoxGeometry(0.46, 0.44, 0.44, 3, 0.13), basM.toArray()), TEN, "Head", TEN_B, { uvFn: yuzUV });
  else ekle(yerlestir(new THREE.SphereGeometry(R, 18, 13), basM.toArray(), null, [1, 1.02, 1]), TEN, "Head", TEN_B, { uvFn: yuzUV });
  // göz ve ağız dörtgenleri: kafa yüzeyinin 4 mm önünde, UV = ifade karesi (çalışma anında kaydırılır)
  const ifadeDortgen = (poz, w, h, kareNo, bolge, ayna = false) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const r = ifadeRect(kareNo), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const u = ayna ? 1 - uv.getX(i) : uv.getX(i); uv.setXY(i, r.u0 + (r.u1 - r.u0) * u, r.v0 + (r.v1 - r.v0) * (1 - uv.getY(i))); }
    const n = new THREE.Vector3(poz.x - basM.x, (poz.y - basM.y) * 0.35, poz.z - basM.z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    ekle(yerlestir(geo, poz.clone().add(n.clone().multiplyScalar(0.004)).toArray(), q), TEN, "Head", bolge, { uvFn: () => {} });
  };
  const yuzZ = robot ? 0.222 : Math.sqrt(R * R - 0.085 * 0.085) * 0.995;
  const gozKare = robot ? IFADE.goz.robotAcik : IFADE.goz.acik, agizKare = robot ? IFADE.agiz.robotNotr : IFADE.agiz.notr;
  ifadeDortgen(basM.clone().add(new THREE.Vector3(-0.085, 0.01, yuzZ)), 0.115, 0.115, gozKare, BOLGE.gozL, false);
  ifadeDortgen(basM.clone().add(new THREE.Vector3(0.085, 0.01, yuzZ)), 0.115, 0.115, gozKare, BOLGE.gozR, true);
  ifadeDortgen(basM.clone().add(new THREE.Vector3(0, -0.1, robot ? 0.222 : R * 0.985)), 0.085, 0.085, agizKare, BOLGE.agiz, false);
  if (!robot) {
    // burun: küçük yumuşak çıkıntı (boyalı burun düz durur)
    kure(basM.clone().add(new THREE.Vector3(0, -0.035, R - 0.012)), kaplan ? 0.03 : 0.028, kaplan ? "gozBebek" : TEN, "Head", kaplan ? BOLGE.diger : TEN_B, [1, kaplan ? 0.7 : 0.85, 0.9], 10);
    // kulaklar (kulakYuva hizası): insanda küçük yarım küre, kaplanda yuvarlak kulak + iç kulak
    for (const s of [-1, 1]) {
      if (insan) kure(basM.clone().add(new THREE.Vector3(s * 0.228, -0.02, 0.01)), 0.045, "ten", "Head", BOLGE.ten, [0.5, 1, 0.8], 8);
      else {
        kure(basM.clone().add(new THREE.Vector3(s * 0.165, 0.225, -0.01)), 0.085, "kurk", "Head", BOLGE.kurk, [1, 1.3, 0.55], 10, true);
        kure(basM.clone().add(new THREE.Vector3(s * 0.165, 0.23, 0.03)), 0.05, "kurkKarin", "Head", BOLGE.diger, [1, 1.25, 0.4], 8);
      }
    }
    if (kaplan) kure(basM.clone().add(new THREE.Vector3(0, -0.075, R - 0.04)), 0.085, "kurkKarin", "Head", BOLGE.diger, [1.25, 0.75, 0.7], 12); // burun-ağız yaması hacmi
  } else {
    // robot: anten (kafa arkası üst) + gövde ekranı + eklem halkaları
    ekle(yerlestir(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8), basM.clone().add(new THREE.Vector3(0.1, 0.27, -0.08)).toArray()), "metal", "Head", BOLGE.metal);
    kure(basM.clone().add(new THREE.Vector3(0.1, 0.36, -0.08)), 0.035, "boya", "Head", BOLGE.boya, [1, 1, 1], 10);
    const gogus = neck.clone().add(new THREE.Vector3(0, -0.3, 0.215));
    ekle(yerlestir(new RoundedBoxGeometry(0.18, 0.12, 0.02, 1, 0.008), gogus.toArray()), "ekran", "Spine2", BOLGE.ekran);
    for (let i = 0; i < 3; i++) kure(gogus.clone().add(new THREE.Vector3(-0.05 + i * 0.05, 0.085, 0.005)), 0.012, "boya", "Spine2", BOLGE.boya, [1, 1, 0.6], 6);
  }
  // ---- saç varyantları (yalnız insan; çalışma anında biri kalır, diğerleri çökertilir) ----
  if (insan) {
    const sacQ = E(-0.32, 0, 0);
    // 1 kâse: ana kabuk + kâkül lobu + arka lob (siluet kırılır, §5.2)
    ekle(yerlestir(new THREE.SphereGeometry(0.25, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), basM.clone().add(new THREE.Vector3(0, 0.01, -0.02)).toArray(), sacQ), "sac", "Head", BOLGE.sacKase, { desenli: true });
    kure(basM.clone().add(new THREE.Vector3(0, 0.13, 0.17)), 0.11, "sac", "Head", BOLGE.sacKase, [1.5, 0.75, 0.75], 8, true);
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
    kure(arm, 0.105, "tisort", t + "Arm", BOLGE.ust, [1, 1, 1], 10, true);
    kapsul(arm, fore, 0.082, "tisort", t + "Arm", BOLGE.ust, true);
    kapsul(fore, hand, 0.072, TEN, t + "ForeArm", TEN_B, kaplan);
    const yonEl = hand.clone().sub(fore).normalize();
    const el = hand.clone().add(yonEl.clone().multiplyScalar(0.05));
    // el: başparmak yönünde yassı + bilek halkası (§5.4)
    kure(el, 0.085, TEN, t + "Hand", TEN_B, [1.05, 0.72, 1.15], 10, kaplan);
    if (robot) ekle(yerlestir(new THREE.TorusGeometry(0.075, 0.018, 6, 12), hand.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), yonEl)), "boya", t + "Hand", BOLGE.boya);
    else ekle(yerlestir(new THREE.TorusGeometry(0.07, 0.012, 5, 12), hand.clone().add(yonEl.clone().multiplyScalar(-0.01)).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), yonEl)), "tisort", t + "Hand", BOLGE.bilek, { desenli: true });
    if (robot) ekle(yerlestir(new THREE.TorusGeometry(0.085, 0.02, 6, 12), fore.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fore.clone().sub(arm).normalize())), "boya", t + "ForeArm", BOLGE.boya);
    const up = W(t + "UpLeg"), leg = W(t + "Leg"), foot = W(t + "Foot"), toe = W(t + "ToeBase");
    kapsul(up, leg, 0.105, "kot", t + "UpLeg", BOLGE.alt, true);
    kapsul(leg, foot, 0.09, "kot", t + "Leg", BOLGE.alt, true);
    if (robot) ekle(yerlestir(new THREE.TorusGeometry(0.095, 0.02, 6, 12), leg.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), foot.clone().sub(up).normalize())), "boya", t + "Leg", BOLGE.boya);
    const ayakM = foot.clone().lerp(toe, 0.55).setY(0.075);
    ekle(yerlestir(new RoundedBoxGeometry(0.19, 0.14, 0.30, 2, 0.06), ayakM.clone().add(new THREE.Vector3(0, 0.02, 0)).toArray()), "ayakkabi", t + "Foot", BOLGE.ayakkabi, { desenli: true });
    ekle(yerlestir(new RoundedBoxGeometry(0.2, 0.035, 0.31, 1, 0.012), ayakM.clone().setY(0.02).toArray()), "cerceve", t + "Foot", BOLGE.taban);   // taban çizgisi
  }

  const govde = birlestir(parcalar);
  const aoGovde = AO_KAPALI ? null : aoHesapla(govde, { R: 0.25 });
  // Göz/ağız dörtgenleri kafa yüzeyinden 4 mm dışarıda → AO'ları kafadan açık kalıyordu (ekranda
  // açık kare gibi görünüyordu). Her dörtgen köşesine en yakın kafa köşesinin AO'su kopyalanır.
  if (aoGovde) {
    const p = govde.attributes.position, b = govde.attributes.bolge, c = govde.attributes.color;
    const kafa = []; for (let i = 0; i < p.count; i++) if (b.getX(i) === TEN_B && Math.abs(p.getY(i) - basM.y) < 0.3 && Math.abs(p.getX(i) - basM.x) < 0.3) kafa.push(i);
    for (let i = 0; i < p.count; i++) {
      const bi = b.getX(i); if (bi !== BOLGE.gozL && bi !== BOLGE.gozR && bi !== BOLGE.agiz) continue;
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
    temelHucre: { ust: "tisort", alt: "kot", ayakkabi: "ayakkabi", ceket: "ceket", kapuson: "esofman" },
    merkez: { bas: basM.toArray(), govde: hips.clone().lerp(neck, 0.5).toArray() },
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
  yuva("gozlukYuva", "Head", basM.clone().add(new THREE.Vector3(0, 0.02, 0.22)));
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
    kozmetikler.add(m); return m;
  };
  if (insan) {
    kozmetik("kozmetik_sapka", "basYuva", [
      Y(new THREE.SphereGeometry(0.262, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), "sapka", [0, -0.13, 0]),
      D(new RoundedBoxGeometry(0.30, 0.03, 0.17, 2, 0.012), "sapkaSiperi", [0, -0.11, 0.3], E(-0.12, 0, 0)),
      D(new THREE.TorusGeometry(0.258, 0.018, 4, 18), "sapkaSiperi", [0, -0.12, 0], E(Math.PI / 2, 0, 0)),
    ]);
    const gozluk = [];
    for (const s of [-1, 1]) {
      gozluk.push(D(new THREE.TorusGeometry(0.06, 0.011, 6, 20), "gozlukCerceve", [s * 0.085, 0, 0]));
      gozluk.push(Y(new THREE.CircleGeometry(0.056, 16), "gozlukCam", [s * 0.085, 0, -0.002], null, null, BOLGE.cam));
      gozluk.push(D(new THREE.BoxGeometry(0.012, 0.012, 0.2), "gozlukCerceve", [s * 0.15, 0.01, -0.1]));
    }
    gozluk.push(D(new THREE.BoxGeometry(0.05, 0.012, 0.012), "gozlukCerceve", [0, 0.01, 0]));
    kozmetik("kozmetik_gozluk", "gozlukYuva", gozluk);
    kozmetik("kozmetik_atki", "boyunYuva", [
      Y(new THREE.TorusGeometry(0.19, 0.055, 6, 16), "atki", [0, 0.02, 0], E(Math.PI / 2, 0, 0)),
      Y(new RoundedBoxGeometry(0.1, 0.34, 0.05, 1, 0.02), "atki", [0.06, -0.16, 0.2], E(0.15, 0, -0.15)),
    ]);
  }
  if (kaplan) {
    // kuyruk: sirtYuva'da, −Z'ye uzanır, ucu siyah; çalışma anında kökten hafif salınır
    const yol = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.12, -0.2), new THREE.Vector3(0.05, -0.1, -0.42), new THREE.Vector3(0.12, 0.08, -0.55)]);
    kozmetik("kozmetik_kuyruk", "sirtYuva", [
      Y(new THREE.TubeGeometry(yol, 12, 0.04, 8, false), "kurk", [0, 0, 0], null, null, BOLGE.kurk),
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
  out.lamba = prop("prop_lamba", [
    D(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 10), "demir", [0, 0.25, 0]),
    D(new THREE.CylinderGeometry(0.06, 0.1, 3.6, 8), "demir", [0, 2.3, 0]),
    D(new THREE.TorusGeometry(0.1, 0.02, 6, 12), "demir", [0, 0.55, 0], E(Math.PI / 2, 0, 0)),
    D(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), "demir", [0.2, 4.15, 0], E(0, 0, -0.9)),
    D(new THREE.SphereGeometry(0.22, 12, 9), "lamba", [0.42, 4.05, 0]),
    D(new THREE.ConeGeometry(0.28, 0.22, 10), "demir", [0.42, 4.3, 0]),
    D(new THREE.SphereGeometry(0.05, 6, 5), "altin", [0.42, 4.45, 0]),
  ]);
  const bank = [];
  for (let i = 0; i < 3; i++) bank.push(Y(pahli(1.8, 0.05, 0.13), "ahsapAcik", [0, 0.45, -0.16 + i * 0.16]));
  for (let i = 0; i < 2; i++) bank.push(Y(pahli(1.8, 0.05, 0.12), "ahsapAcik", [0, 0.72 + i * 0.16, -0.27], E(0.25, 0, 0)));
  for (const s of [-1, 1]) { bank.push(D(pahli(0.06, 0.45, 0.5), "demir", [s * 0.8, 0.22, 0])); bank.push(D(pahli(0.06, 0.5, 0.08), "demir", [s * 0.8, 0.68, -0.3], E(0.25, 0, 0))); }
  out.bank = prop("prop_bank", bank, 0.25);
  const saksi = [
    Y(new THREE.CylinderGeometry(0.42, 0.32, 0.7, 10), "baca", [0, 0.35, 0]),
    D(new THREE.TorusGeometry(0.42, 0.04, 5, 12), "baca", [0, 0.7, 0], E(Math.PI / 2, 0, 0)),
    Y(new THREE.SphereGeometry(0.42, 8, 6), "cim", [0, 0.95, 0], null, [1, 0.75, 1]),
  ];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; saksi.push(D(new THREE.SphereGeometry(0.07, 6, 5), i % 2 ? "bayrak" : "lamba", [Math.cos(a) * 0.3, 1.18, Math.sin(a) * 0.3])); }
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
  for (const m of o.meshler) if (m.ad.startsWith("kozmetik_") && m.ucgen > BUTCE.kozmetikUcgen) red.push(`${tur} ${m.ad} ${m.ucgen} > ${BUTCE.kozmetikUcgen}`);
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
