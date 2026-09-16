// ============================================================
// AŞAMA 1H — GÖVDE KARŞILAŞTIRMASI: aday hazırlığı (üretim zamanı, Node). OYUNA BAĞLANMAZ, CANLIYA ÇIKMAZ.
//
//   node bildim/harita/varlik/aday/hazirla.mjs            # kaynağı bulunan bütün adaylar
//   node bildim/harita/varlik/aday/hazirla.mjs a0_superhero
//
// Her adaya AYNI işlem (§4): (1) ölçek → mevcut karakterin boyu, (2) kök ayak altında, merkez x/z = 0, yüz +Z,
// (3) kendi dokuları SÖKÜLÜR → tek düz ten malzemesi (#F2C9A7, pürüz 0,82), (4) çıplak: saç/kaş/küpe/aksesuar meshleri atılır,
// (5) ≤ 6.000 mesh üçgeni sadeleştirme (meshoptimizer simplify — orijinal köşelerin ALT KÜMESİ, JOINTS/WEIGHTS korunur),
// (6) bizim klipler (Idle · Walk · Run · Selam) aday iskeletine retarget.
//
// Çıktı: <aday>/aday_<ad>_ham.glb · aday_<ad>_sade.glb · rapor.json (üçgen, doğrulama, retarget, deformasyon kareleri)
// Kaynak dosyalar <aday>/kaynak/ altında (A Regular / B Teen: ücretli Source sürümünden elle konacak — bkz. rapor).
// ============================================================
import "../polyfill.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { MeshoptSimplifier } from "meshoptimizer";
import { glbOku } from "../../muayene/glbOku.mjs";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../../..");
const HEDEF_UCGEN = 6000;   // §2: HEDEF, sert eleme eşiği değil
const TEN = new THREE.Color("#F2C9A7");
const FPS = 30;

// Kaynak (Mixamo adları, karakter_insan.glb) → yön için çocuk kemik
const COCUK = { Hips: "Spine", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head", LeftShoulder: "LeftArm", LeftArm: "LeftForeArm", LeftForeArm: "LeftHand", RightShoulder: "RightArm", RightArm: "RightForeArm", RightForeArm: "RightHand", LeftUpLeg: "LeftLeg", LeftLeg: "LeftFoot", LeftFoot: "LeftToeBase", RightUpLeg: "RightLeg", RightLeg: "RightFoot", RightFoot: "RightToeBase" };
// kaynak zincir ebeveyni (konum aktarımı: hedefte gerçek ebeveyn farklıysa — ör. Modular Men ayağı Root'a bağlı IK kemiği, uyluk Body'ye bağlı)
const ZINCIR = { Spine: "Hips", Spine1: "Spine", Spine2: "Spine1", Neck: "Spine2", Head: "Neck", LeftShoulder: "Spine2", LeftArm: "LeftShoulder", LeftForeArm: "LeftArm", LeftHand: "LeftForeArm", RightShoulder: "Spine2", RightArm: "RightShoulder", RightForeArm: "RightArm", RightHand: "RightForeArm", LeftUpLeg: "Hips", LeftLeg: "LeftUpLeg", LeftFoot: "LeftLeg", LeftToeBase: "LeftFoot", RightUpLeg: "Hips", RightLeg: "RightUpLeg", RightFoot: "RightLeg", RightToeBase: "RightFoot" };
// Nötr karşılaştırma pozu "Dur": kaynak bağlama pozu (T) + üst kollar dünya Z'de 55° aşağı. muayene.js klibi olmayan C için aynı dönüşü uygular.
const DUR_KOL_ACI = THREE.MathUtils.degToRad(55);
const iki = (sol, sag) => Object.fromEntries([["Left", sol], ["Right", sag]].flatMap(([t, f]) => Object.entries(f).map(([k, v]) => [t + k, v])));

// UE / Quaternius Universal Base (pelvis, spine_01, clavicle_l …) — A ve B de bu rig'i kullanır (ilan: "Humanoid Rig", aynı kit)
const UE_ESLEME = { Hips: "pelvis", Spine: "spine_01", Spine1: "spine_02", Spine2: "spine_03", Neck: "neck_01", Head: "Head",
  ...iki({ Shoulder: "clavicle_l", Arm: "upperarm_l", ForeArm: "lowerarm_l", Hand: "hand_l", UpLeg: "thigh_l", Leg: "calf_l", Foot: "foot_l", ToeBase: "ball_l" },
         { Shoulder: "clavicle_r", Arm: "upperarm_r", ForeArm: "lowerarm_r", Hand: "hand_r", UpLeg: "thigh_r", Leg: "calf_r", Foot: "foot_r", ToeBase: "ball_r" }) };
// Quaternius Ultimate Modular Men (GLTFLoader nokta içeren adları temizler: "UpperArm.L" → "UpperArmL"); ayak parmağı kemiği yok (PT.L = IK hedefi)
const UMM_ESLEME = { Hips: "Hips", Spine: "Abdomen", Spine1: "Torso", Spine2: "Chest", Neck: "Neck", Head: "Head",
  ...iki({ Shoulder: "ShoulderL", Arm: "UpperArmL", ForeArm: "LowerArmL", Hand: "WristL", UpLeg: "UpperLegL", Leg: "LowerLegL", Foot: "FootL" },
         { Shoulder: "ShoulderR", Arm: "UpperArmR", ForeArm: "LowerArmR", Hand: "WristR", UpLeg: "UpperLegR", Leg: "LowerLegR", Foot: "FootR" }) };

const ADAYLAR = {
  a_regular: { etiket: "A · Quaternius Universal Base — Regular (erkek)", kaynakDesen: /Regular.*Male.*\.(gltf|glb)$/i, esleme: UE_ESLEME, at: /hair|eyebrow|eyelash|beard/i, lisans: "CC0" },
  b_teen: { etiket: "B · Quaternius Universal Base — Teen (erkek)", kaynakDesen: /Teen.*Male.*\.(gltf|glb)$/i, esleme: UE_ESLEME, at: /hair|eyebrow|eyelash|beard/i, lisans: "CC0" },
  a0_superhero: { etiket: "A0 · Quaternius Universal Base — Superhero (erkek) · ücretsiz paketteki tek erkek gövde", kaynakDesen: /Superhero_Male.*\.gltf$/i, esleme: UE_ESLEME, at: /hair|eyebrow/i, lisans: "CC0" },
  d_beach: { etiket: "D · Quaternius Ultimate Modular Men — Beach (en açık kıyafet; çıplak temel gövde pakette YOK)", kaynakDesen: /Beach\.gltf$/i, esleme: UMM_ESLEME, at: /^(hair|earrings|eyebrows)$/i, lisans: "CC0" },
};

// ---------------------------------------------------------------- okuma: .gltf (+ .bin / data URI) → GLB belleği → GLTFLoader
async function gltfOku(dosya) {
  if (dosya.endsWith(".glb")) return glbOku(dosya);
  const j = JSON.parse(fs.readFileSync(dosya, "utf8"));
  const tamponlar = j.buffers.map((b) => b.uri?.startsWith("data:") ? Buffer.from(b.uri.split(",")[1], "base64") : fs.readFileSync(path.join(path.dirname(dosya), decodeURIComponent(b.uri))));
  // tek BIN yığını: tamponları 4'e hizalı ardışık koy, bufferView ofsetlerini kaydır
  const ofset = []; let n = 0;
  for (const t of tamponlar) { ofset.push(n); n += t.length; while (n % 4) n++; }
  const bin = Buffer.alloc(n); tamponlar.forEach((t, i) => t.copy(bin, ofset[i]));
  for (const v of j.bufferViews) { v.byteOffset = (v.byteOffset ?? 0) + ofset[v.buffer]; v.buffer = 0; }
  j.buffers = [{ byteLength: n }];
  delete j.images; delete j.textures; delete j.samplers;
  for (const m of j.materials ?? []) { delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } delete m.extensions; }
  delete j.extensionsUsed; delete j.extensionsRequired;
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), out = Buffer.alloc(28 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jb.length); out.writeUInt32LE(0x004e4942, 24 + jb.length); bin.copy(out, 28 + jb.length);
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  const gltf = await new Promise((coz, red) => new GLTFLoader().parse(ab, "", coz, red));
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

const ucgen = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const q = () => new THREE.Quaternion(), v = () => new THREE.Vector3();

// ---------------------------------------------------------------- kaynak: mevcut karakter (iskelet, bağlama pozu, klipler, boy)
async function kaynakKur() {
  const g = await glbOku(path.join(KOK, "public/meydan/deneme/karakter_insan.glb"));
  const govde = g.scene.getObjectByName("Govde");
  const kutu = new THREE.Box3().setFromObject(govde, true);
  const kemik = (ad) => g.scene.getObjectByName(ad);
  const bind = {};
  for (const ad of Object.keys(COCUK).concat(["Head", "LeftHand", "RightHand", "LeftToeBase", "RightToeBase"])) {
    const b = kemik(ad); if (!b) continue;
    bind[ad] = { q: b.getWorldQuaternion(q()), p: b.getWorldPosition(v()) };
  }
  const trs = []; g.scene.traverse((o) => { if (o.isBone) trs.push([o, o.position.clone(), o.quaternion.clone()]); });
  return { g, kutu, boy: kutu.max.y - kutu.min.y, kemik, bind, trs, mixer: new THREE.AnimationMixer(g.scene) };
}

// ---------------------------------------------------------------- deformasyon test kareleri: kaynak kliplerde ölçülür (her aday AYNI kare)
function aci(a, b, c) { return THREE.MathUtils.radToDeg(a.clone().sub(b).angleTo(c.clone().sub(b))); }
function testKareleri(K) {
  const ornekle = (klip, fn) => {
    const c = K.g.animations.find((x) => x.name === klip); const a = K.mixer.clipAction(c); K.mixer.stopAllAction(); a.reset().play();
    let en = null;
    for (let t = 0; t < c.duration; t += 1 / FPS) { K.mixer.setTime(t); K.g.scene.updateMatrixWorld(true); const d = fn(); if (!en || d > en.deger) en = { klip, zaman: +t.toFixed(3), deger: +d.toFixed(1) }; }
    K.mixer.stopAllAction(); return en;
  };
  const P = (ad) => K.kemik(ad).getWorldPosition(v());
  const disAci = (u, o, a) => 180 - aci(P(u), P(o), P(a));   // bükülme = 180 − iç açı
  return {
    dirsek: { ...ornekle("Run", () => Math.max(disAci("LeftArm", "LeftForeArm", "LeftHand"), disAci("RightArm", "RightForeArm", "RightHand"))), ne: "dirsek bükülü (Run, en büyük dirsek açısı)" },
    diz: { ...ornekle("Walk", () => Math.max(disAci("LeftUpLeg", "LeftLeg", "LeftFoot"), disAci("RightUpLeg", "RightLeg", "RightFoot"))), ne: "diz bükülü (Walk, en büyük diz açısı)" },
    omuz: { ...ornekle("Selam", () => P("RightHand").y - P("RightArm").y), ne: "omuz kalkık (Selam, el omuzun en üstünde)" },
    kalca: { ...ornekle("Run", () => { const l = P("LeftLeg").sub(P("LeftUpLeg")).normalize(), r = P("RightLeg").sub(P("RightUpLeg")).normalize(); return THREE.MathUtils.radToDeg(l.angleTo(r)); }), ne: "kalça dönük (Run, iki uyluk arası en büyük açı)" },
  };
}

// ---------------------------------------------------------------- retarget (dünya uzayı, yön hizalamalı)
// hedefDünya(t) = [kaynakDünya(t) · kaynakBind⁻¹] · hizala · hedefBind      hizala: hedef kemik yönü → kaynak kemik yönü (bind'da)
function retarget(K, kok, esleme) {
  const bul = (ad) => { let b = null; kok.traverse((o) => { if (!b && o.isBone && o.name === ad) b = o; }); return b; };
  const ciftler = [], eksik = [];
  kok.updateMatrixWorld(true);
  for (const [kAd, hAd] of Object.entries(esleme)) {
    const hb = bul(hAd), kb = K.kemik(kAd);
    if (!hb || !kb) { eksik.push(`${kAd}→${hAd}`); continue; }
    const hq = hb.getWorldQuaternion(q()), hp = hb.getWorldPosition(v());
    let hiza = q();
    const kc = COCUK[kAd], hcAd = kc ? esleme[kc] : null, hc = hcAd ? bul(hcAd) : null;
    if (kc && hc && K.bind[kc]) {
      const kYon = K.bind[kc].p.clone().sub(K.bind[kAd].p).normalize();
      const hYon = hc.getWorldPosition(v()).sub(hp).normalize();
      hiza = q().setFromUnitVectors(hYon, kYon);
    }
    ciftler.push({ kAd, hb, kBindQ: K.bind[kAd].q, hRest: hiza.multiply(hq) });
  }
  // sıra: kaynak zincir sırası (esleme anahtar sırası ebeveyn → çocuk). Zincir ebeveyni gerçek ebeveyn değilse bind ofseti saklanır → konum da aktarılır
  for (const c of ciftler) {
    const z = ZINCIR[c.kAd] ? ciftler.find((x) => x.kAd === ZINCIR[c.kAd]) : null;
    if (z && c.hb.parent !== z.hb) { c.zincir = z.hb; c.ofset = z.hb.worldToLocal(c.hb.getWorldPosition(v())); }
  }
  const konumAktarilan = ciftler.filter((c) => c.zincir).map((c) => `${c.hb.name} (gerçek ebeveyn ${c.hb.parent.name}, zincir ${c.zincir.name})`);
  const hips = ciftler.find((c) => c.kAd === "Hips");
  const hHipsBindP = hips?.hb.getWorldPosition(v()), oran = hHipsBindP ? hHipsBindP.y / K.bind.Hips.p.y : 1;
  const hTRS = []; kok.traverse((o) => { if (o.isBone) hTRS.push([o, o.position.clone(), o.quaternion.clone()]); });
  const sifirla = () => { for (const [b, p, qq] of hTRS) { b.position.copy(p); b.quaternion.copy(qq); } kok.updateMatrixWorld(true); };

  const klipler = [];
  const durKlip = new THREE.AnimationClip("Dur", 1, []);   // nötr poz: örneklemede kaynak elle kurulur
  for (const kaynak of [...K.g.animations, durKlip]) {
    const dur = kaynak === durKlip;
    const a = dur ? null : K.mixer.clipAction(kaynak); K.mixer.stopAllAction(); a?.reset().play();
    const n = Math.max(2, Math.round(kaynak.duration * FPS) + 1), zamanlar = new Float32Array(n);
    const qDeg = new Map(ciftler.map((c) => [c, new Float32Array(n * 4)])), pDeg = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = Math.min(kaynak.duration, i / FPS); zamanlar[i] = t;
      if (dur) durPozu(K); else { K.mixer.setTime(t); K.g.scene.updateMatrixWorld(true); }
      sifirla();
      for (const c of ciftler) {
        const kNow = K.kemik(c.kAd).getWorldQuaternion(q());
        const dunya = kNow.multiply(c.kBindQ.clone().invert()).multiply(c.hRest);
        const ebeveyn = c.hb.parent.getWorldQuaternion(q());
        c.hb.quaternion.copy(ebeveyn.invert().multiply(dunya));
        if (c === hips) {
          const d = K.kemik("Hips").getWorldPosition(v()).sub(K.bind.Hips.p).multiplyScalar(oran);
          const hedefP = hHipsBindP.clone().add(d);
          c.hb.position.copy(c.hb.parent.worldToLocal(hedefP));
          c.hb.position.toArray(pDeg, i * 3);
        }
        if (c.zincir) { c.hb.position.copy(c.hb.parent.worldToLocal(c.zincir.localToWorld(c.ofset.clone()))); c.hb.position.toArray(c.pDeg ??= new Float32Array(n * 3), i * 3); }
        c.hb.updateMatrixWorld(true);
        c.hb.quaternion.toArray(qDeg.get(c), i * 4);
      }
    }
    K.mixer.stopAllAction();
    const izler = ciftler.map((c) => new THREE.QuaternionKeyframeTrack(`${c.hb.name}.quaternion`, zamanlar, qDeg.get(c)));
    if (hips) izler.push(new THREE.VectorKeyframeTrack(`${hips.hb.name}.position`, zamanlar, pDeg));
    for (const c of ciftler) if (c.pDeg) { izler.push(new THREE.VectorKeyframeTrack(`${c.hb.name}.position`, zamanlar, c.pDeg)); delete c.pDeg; }
    klipler.push(new THREE.AnimationClip(kaynak.name, kaynak.duration, izler));
  }
  for (const [b, p, qq] of K.trs) { b.position.copy(p); b.quaternion.copy(qq); }
  K.g.scene.updateMatrixWorld(true); sifirla();
  return { klipler, eslenen: ciftler.length, eksik, kalcaOrani: +oran.toFixed(3), konumAktarilan };
}

/** Kaynak iskeleti "Dur" pozuna kur: bağlama pozu + üst kollar dünya Z ekseninde aşağı (sol +X kol → −, sağ −X kol → +). */
function durPozu(K) {
  for (const [b, p, qq] of K.trs) { b.position.copy(p); b.quaternion.copy(qq); }
  K.g.scene.updateMatrixWorld(true);
  for (const [ad, isaret] of [["LeftArm", -1], ["RightArm", 1]]) {
    const b = K.kemik(ad), dunya = q().setFromAxisAngle(new THREE.Vector3(0, 0, 1), isaret * DUR_KOL_ACI).multiply(K.bind[ad].q);
    b.quaternion.copy(b.parent.getWorldQuaternion(q()).invert().multiply(dunya)); b.updateMatrixWorld(true);
  }
  K.g.scene.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- sadeleştirme: konumla kaynaştır → simplify → alt küme köşelerle yeni geometri
async function sadelestir(geo, hedefUcgen) {
  await MeshoptSimplifier.ready;
  const pos = geo.attributes.position.array instanceof Float32Array ? geo.attributes.position.array : new Float32Array(geo.attributes.position.array);
  const idx = new Uint32Array(geo.index ? geo.index.array : Array.from({ length: geo.attributes.position.count }, (_, i) => i));
  // UV/normal dikişleri adayı bölmesin: aynı konumdaki köşeler tek temsilciye (temsilci kendi normal/JOINTS/WEIGHTS'ını taşır)
  const remap = MeshoptSimplifier.generatePositionRemap(pos, 3);
  const kaynasik = idx.map((i) => remap[i]);
  let hata = 0.01, sonuc = null;
  for (let deneme = 0; deneme < 12; deneme++) {
    const [yeni, e] = MeshoptSimplifier.simplify(kaynasik, pos, 3, Math.floor(hedefUcgen) * 3, hata, []);
    sonuc = { yeni, e };
    if (yeni.length / 3 <= hedefUcgen) break;
    hata *= 1.8;
  }
  const kullanilan = [...new Set(sonuc.yeni)], yeniNo = new Map(kullanilan.map((o, i) => [o, i]));
  const g = new THREE.BufferGeometry();
  for (const [ad, at] of Object.entries(geo.attributes)) {
    const A = at.array.constructor, dizi = new A(kullanilan.length * at.itemSize);
    kullanilan.forEach((o, i) => { for (let k = 0; k < at.itemSize; k++) dizi[i * at.itemSize + k] = at.array[o * at.itemSize + k]; });
    g.setAttribute(ad, new THREE.BufferAttribute(dizi, at.itemSize, at.normalized));
  }
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(sonuc.yeni, (o) => yeniNo.get(o)), 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geo: g, kaynakKose: kullanilan, hataGoreli: +sonuc.e.toFixed(5) };
}

// ---------------------------------------------------------------- dışa aktar + doğrula (§5 ZORUNLU: yeniden okunan GLB üzerinde)
async function yaz(dosya, kok, klipler) {
  const ab = await new Promise((coz, red) => new GLTFExporter().parse(kok, coz, red, { binary: true, animations: klipler, onlyVisible: true }));
  fs.writeFileSync(dosya, Buffer.from(ab));
  return fs.statSync(dosya).size;
}
function glbJson(dosya) { const b = fs.readFileSync(dosya); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); }
async function dogrula(dosya) {
  const j = glbJson(dosya), g = await glbOku(dosya);
  const meshler = []; g.scene.traverse((o) => { if (o.isSkinnedMesh) meshler.push(o); });
  const s = { skinnedMesh: meshler.length, ucgen: 0, jointsVar: true, sayiEsit: true, agirlikToplamMin: Infinity, agirlikToplamMax: -Infinity, sifirAgirlikliKose: 0, skin: j.skins?.map((k) => ({ eklem: k.joints.length, ibm: j.accessors[k.inverseBindMatrices]?.count })) ?? [], klipler: g.animations.map((a) => a.name) };
  for (const m of meshler) {
    const a = m.geometry.attributes; s.ucgen += ucgen(m.geometry);
    if (!a.skinIndex || !a.skinWeight) { s.jointsVar = false; continue; }
    if (a.skinIndex.count !== a.position.count || a.skinWeight.count !== a.position.count) s.sayiEsit = false;
    for (let i = 0; i < a.skinWeight.count; i++) { const t = a.skinWeight.getX(i) + a.skinWeight.getY(i) + a.skinWeight.getZ(i) + a.skinWeight.getW(i); s.agirlikToplamMin = Math.min(s.agirlikToplamMin, t); s.agirlikToplamMax = Math.max(s.agirlikToplamMax, t); if (t < 1e-4) s.sifirAgirlikliKose++; }
    if (!m.skeleton || m.skeleton.bones.length !== m.skeleton.boneInverses.length) s.skinBag = false;
  }
  s.skinBag = s.skinBag !== false && s.skin.every((k) => k.eklem === k.ibm);
  s.agirlikToplamMin = +s.agirlikToplamMin.toFixed(4); s.agirlikToplamMax = +s.agirlikToplamMax.toFixed(4);
  s.gecti = s.jointsVar && s.sayiEsit && s.skinBag && s.sifirAgirlikliKose === 0 && Math.abs(s.agirlikToplamMin - 1) < 0.02 && Math.abs(s.agirlikToplamMax - 1) < 0.02;
  return s;
}

// ---------------------------------------------------------------- aday
async function adayHazirla(ad, K, kareler) {
  const A = ADAYLAR[ad], klasor = path.join(BURASI, ad), kaynakKlasor = path.join(klasor, "kaynak");
  const bulunan = fs.existsSync(kaynakKlasor) ? fs.readdirSync(kaynakKlasor).filter((f) => A.kaynakDesen.test(f)) : [];
  if (!bulunan.length) return { ad, etiket: A.etiket, durum: "KAYNAK YOK", not: `${path.relative(KOK, kaynakKlasor)} içinde ${A.kaynakDesen} ile eşleşen .gltf/.glb yok` };
  const g = await gltfOku(path.join(kaynakKlasor, bulunan[0]));

  // (4) çıplak: atılacak meshler (ad ya da malzeme adına göre); (3) düz ten malzemesi; fazladan öznitelikler atılır
  const duz = new THREE.MeshStandardMaterial({ color: TEN, roughness: 0.82, metalness: 0, name: "duzTen" });
  const atilan = [], tutulan = [];
  g.scene.traverse((o) => { if (!o.isMesh) return; const mAd = o.material?.name ?? ""; if (A.at.test(o.name) || A.at.test(mAd) || A.at.test(o.parent?.name ?? "")) atilan.push(o); else tutulan.push(o); });
  for (const o of atilan) o.parent.remove(o);
  let hamUcgen = 0;
  for (const o of tutulan) {
    o.material = duz;
    for (const k of Object.keys(o.geometry.attributes)) if (!["position", "normal", "skinIndex", "skinWeight"].includes(k)) o.geometry.deleteAttribute(k);
    hamUcgen += ucgen(o.geometry);
  }
  g.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) console.warn(`[aday] ${ad}: iskeletsiz mesh ${o.name}`); });

  // (1)(2) ölçek, kök, yön: sarmalayıcı düğüm; boy = mevcut karakterin boyu
  const kok = new THREE.Group(); kok.name = "Aday"; const ic = new THREE.Group(); ic.name = "AdayNormalize";
  for (const c of [...g.scene.children]) ic.add(c);
  kok.add(ic); kok.updateMatrixWorld(true);
  const kutuHam = new THREE.Box3(); for (const o of tutulan) kutuHam.union(new THREE.Box3().setFromObject(o, true));
  const olcek = K.boy / (kutuHam.max.y - kutuHam.min.y);
  ic.scale.setScalar(olcek);
  const merkez = kutuHam.getCenter(v());
  ic.position.set(-merkez.x * olcek, -kutuHam.min.y * olcek, -merkez.z * olcek);
  kok.updateMatrixWorld(true);
  // yön: eşlenen SOL üst kolun dünya x'i kaynakla aynı işaretli değilse Y'de 180° çevir (kaynak +Z'ye bakar, sol kol +X)
  let solKol = null; ic.traverse((o) => { if (o.isBone && o.name === A.esleme.LeftArm) solKol = o; });
  let cevrildi = false;
  if (solKol && Math.sign(solKol.getWorldPosition(v()).x) !== Math.sign(K.bind.LeftArm.p.x)) {
    ic.rotation.y = Math.PI; ic.position.x *= -1; ic.position.z *= -1; kok.updateMatrixWorld(true); cevrildi = true;
  }
  const kutu = new THREE.Box3(); for (const o of tutulan) kutu.union(new THREE.Box3().setFromObject(o, true));

  // (6) retarget
  const R = retarget(K, kok, A.esleme);

  // ham GLB
  fs.mkdirSync(klasor, { recursive: true });
  const hamDosya = path.join(klasor, `aday_${ad}_ham.glb`);
  await yaz(hamDosya, kok, R.klipler);
  const hamDog = await dogrula(hamDosya);

  // (5) sadeleştirme (gerekirse): her mesh aynı oranda
  let sadeDosya = hamDosya, sadeBilgi = { gerekmedi: true };
  if (hamUcgen > HEDEF_UCGEN) {
    const oranHedef = HEDEF_UCGEN / hamUcgen; const ayrinti = [];
    // ağırlık eşliği kanıtı için sadeleştirmeden önceki öznitelikleri sakla
    for (const o of tutulan) {
      const once = { w: o.geometry.attributes.skinWeight.array.slice(), j: o.geometry.attributes.skinIndex.array.slice() };
      const s = await sadelestir(o.geometry, ucgen(o.geometry) * oranHedef * 0.985);
      // eşlik: sade köşe i ↔ ham köşe kaynakKose[i]; JOINTS/WEIGHTS birebir aynı olmalı
      let farkli = 0; const aw = s.geo.attributes.skinWeight.array, aj = s.geo.attributes.skinIndex.array;
      s.kaynakKose.forEach((k, i) => { for (let c = 0; c < 4; c++) if (aw[i * 4 + c] !== once.w[k * 4 + c] || aj[i * 4 + c] !== once.j[k * 4 + c]) { farkli++; break; } });
      ayrinti.push({ mesh: o.name, ham: ucgen(o.geometry), sade: ucgen(s.geo), goreliHata: s.hataGoreli, agirlikFarkliKose: farkli });
      o.geometry = s.geo;
    }
    sadeDosya = path.join(klasor, `aday_${ad}_sade.glb`);
    await yaz(sadeDosya, kok, R.klipler);
    sadeBilgi = { arac: "meshoptimizer 1.1.1 simplify (konum kaynaştırma + alt küme köşe)", meshler: ayrinti };
  }
  const sadeDog = sadeDosya === hamDosya ? hamDog : await dogrula(sadeDosya);

  const rapor = {
    ad, etiket: A.etiket, lisans: A.lisans, kaynak: path.relative(KOK, path.join(kaynakKlasor, bulunan[0])).replace(/\\/g, "/"),
    atilanMeshler: atilan.map((o) => `${o.name} (${o.material?.name ?? "-"})`),
    hamUcgen, sadeUcgen: sadeDog.ucgen, sadeDosya: path.basename(sadeDosya), hamDosya: path.basename(hamDosya),
    normalize: { olcek: +olcek.toFixed(4), boy: +(kutu.max.y - kutu.min.y).toFixed(3), kokY: +kutu.min.y.toFixed(3), cevrildi180: cevrildi },
    retarget: { eslenenKemik: R.eslenen, eksik: R.eksik, konumAktarilan: R.konumAktarilan, kalcaOrani: R.kalcaOrani, klipler: R.klipler.map((k) => k.name), calisti: R.eksik.length === 0 && R.eslenen >= 16 },
    dogrulama: { ham: hamDog, sade: sadeDog }, sadelestirme: sadeBilgi, kareler,
  };
  fs.writeFileSync(path.join(klasor, "rapor.json"), JSON.stringify(rapor, null, 1));
  return rapor;
}

// ---------------------------------------------------------------- çalıştır
const K = await kaynakKur();
const kareler = testKareleri(K);
fs.writeFileSync(path.join(BURASI, "kareler.json"), JSON.stringify({ kaynak: "public/meydan/deneme/karakter_insan.glb", boy: +K.boy.toFixed(3), ...kareler }, null, 1));
console.log(`[aday] kaynak boy ${K.boy.toFixed(3)} m · test kareleri ${Object.entries(kareler).map(([k, x]) => `${k}=${x.klip}@${x.zaman}s (${x.deger})`).join(" · ")}`);
const secilen = process.argv.slice(2);
for (const ad of secilen.length ? secilen : Object.keys(ADAYLAR)) {
  try {
    const r = await adayHazirla(ad, K, kareler);
    if (r.durum) { console.log(`[aday] ${ad}: ${r.durum} — ${r.not}`); continue; }
    console.log(`[aday] ${ad}: ham ${r.hamUcgen} → sade ${r.sadeUcgen} üçgen · ölçek ${r.normalize.olcek} · çevrildi ${r.normalize.cevrildi180} · retarget ${r.retarget.eslenenKemik} kemik${r.retarget.eksik.length ? " EKSİK " + r.retarget.eksik.join(",") : ""} · doğrulama ham ${r.dogrulama.ham.gecti ? "GEÇTİ" : "KALDI"} / sade ${r.dogrulama.sade.gecti ? "GEÇTİ" : "KALDI"}`);
    if (r.sadelestirme.meshler) for (const m of r.sadelestirme.meshler) console.log(`        ${m.mesh}: ${m.ham} → ${m.sade} (hata ${m.goreliHata}) · ağırlığı değişen köşe ${m.agirlikFarkliKose}`);
  } catch (e) { console.error(`[aday] ${ad}: HATA`, e); process.exitCode = 1; }
}
