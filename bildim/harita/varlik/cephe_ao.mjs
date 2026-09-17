// ============================================================
// CEPHE — GÖMÜLÜ AO PİŞİRME + MUAYENE ÖRNEKLERİ (Aşama 3A-1 §C.3)
//
//   npm run cephe-ao        (= node bildim/harita/varlik/cephe_ao.mjs)
//   → public/meydan/deneme/cephe_ao.bin            her parselin yakın (0) ve orta (1) LOD'u için köşe başına 1 bayt AO
//   → public/meydan/deneme/cephe_ornek_*.glb       muayene için üç örnek bina (AO köşe rengine gömülü, yerel eksende)
//
// Binalar çalışma anında cephe.js ile KODLA kurulur (parça havuzu + manifest reçetesi); köşe sırası Node'da ve
// tarayıcıda aynıdır. AO ışın izlemeyle (ao.mjs, mevcut hat) burada bir kez hesaplanır, çalışma anında köşe rengine çarpılır.
// yerlesim.json'da bir parselin ayak izi ya da `cephe` reçetesi değişirse BU BETİK YENİDEN ÇALIŞTIRILIR; köşe sayısı
// tutmayan bina çalışma anında AO'suz kalır (bozulmaz, yalnız düzleşir) — betik sonunda özet basar.
// Karakterlere, atlasa, diğer varlıklara DOKUNMAZ.
// ============================================================
import "./polyfill.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { hucreTablosu } from "./atlas.mjs";
import { aoHesapla } from "./ao.mjs";
import { binaGeometrisi, cepheParselleri } from "../cephe.js";
import { manifestCoz } from "../yerlesimCoz.js";

const BURASI = path.dirname(fileURLToPath(import.meta.url)), KOK = path.resolve(BURASI, "../../..");
const CIKTI = path.join(KOK, "public/meydan/deneme");
const M = manifestCoz(JSON.parse(fs.readFileSync(path.join(BURASI, "../yerlesim.json"), "utf8"))), H = hucreTablosu();
const ORNEKLER = { cephe_ornek_dukkan: "dukkan_normal", cephe_ornek_apartman: "apartman_istiklal_a1", cephe_ornek_dar: "dar_istiklal_a2",
  yapi_akm: "kamusal_akm", yapi_cami: "landmark_taksim_camii", yapi_anit: "anit", yapi_lise: "dukkan_ayarlar" };   // 3A-2: dört tanınır yapı
const ORNEK_MOD = () => ({ duvar: "#4A9DD9", cati: "#2B6BA3" });   // örnek GLB'de girilebilir dükkân rengi (canlıda dunya.js › MOD_RENK)

// Cam ve ışıyan yüzeyler AO almaz (cam çerçevenin içinde durduğu için kararıyordu); taban 0,5 — köşe AO'su seyrek ağda lekeleşmesin
const aoDuzelt = (g, i) => { const b = (g.attributes._bolge ?? g.attributes.bolge).getX(i); return b === 16 || b === 12 ? 1 : Math.max(0.5, g.attributes.color.getX(i)); };
const zemin = (p) => new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2).translate(p.capa.konum[0], 0, p.capa.konum[2]).toNonIndexed();
const t0 = Date.now(), kayitlar = {}, parcalar = []; let ofset = 0, ozet = [];
for (const p of cepheParselleri(M)) {
  for (const lod of [0, 1]) {
    const g = binaGeometrisi(p, H, lod, null), n = g.attributes.position.count;
    const tint = g.attributes.color.clone();
    const ao = aoHesapla(g, { engeller: [g, zemin(p)], R: 0.45, isin: 16, guc: 0.75 });   // color ← AO (gri)
    const bayt = new Uint8Array(n);
    for (let i = 0; i < n; i++) bayt[i] = Math.round(aoDuzelt(g, i) * 255);
    kayitlar[`${p.id}:${lod}`] = [ofset, n]; parcalar.push(bayt); ofset += n;
    g.setAttribute("color", tint);
    if (lod === 0) ozet.push(`${p.id.padEnd(24)} ${String(n / 3).padStart(5)} üçgen · AO ort ${ao.ort} min ${ao.min}`);
  }
}
const bas = Buffer.from(JSON.stringify({ surum: 1, tarih: new Date().toISOString().slice(0, 10), kayitlar }));
const dolgu = (4 - (bas.length % 4)) % 4, basD = Buffer.concat([bas, Buffer.alloc(dolgu, 0x20)]);
const cikti = Buffer.alloc(4 + basD.length + ofset); cikti.writeUInt32LE(basD.length, 0); basD.copy(cikti, 4);
let o = 4 + basD.length; for (const b of parcalar) { cikti.set(b, o); o += b.length; }
fs.writeFileSync(path.join(CIKTI, "cephe_ao.bin"), cikti);
console.log(ozet.join("\n"));
console.log(`cephe_ao.bin ${(cikti.length / 1024).toFixed(0)} KB — ${Object.keys(kayitlar).length} kayıt, ${ofset} köşe, ${((Date.now() - t0) / 1000).toFixed(1)} sn`);

// ---- muayene örnekleri: yerel eksende (çapa 0,0 · dönüş 0), AO köşe rengine gömülü
async function glbYaz(dosya, mesh) {
  const sahne = new THREE.Scene(); sahne.add(mesh);
  const b = Buffer.from(await new GLTFExporter().parseAsync(sahne, { binary: true, trs: true }));
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString());
  j.images = [{ uri: "atlas.png" }]; j.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }]; j.textures = [{ sampler: 0, source: 0 }];
  for (const m of j.materials ?? []) { m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {}; m.pbrMetallicRoughness.baseColorTexture = { index: 0 }; }
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), bin = b.subarray(20 + len), out = Buffer.alloc(20 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20); bin.copy(out, 20 + jb.length);
  fs.writeFileSync(path.join(CIKTI, dosya), out);
  return out.length;
}
for (const [dosya, id] of Object.entries(ORNEKLER)) {
  const p0 = cepheParselleri(M).find((q) => q.id === id), p = { ...p0, capa: { konum: [0, 0, 0], donus_y: 0 } };
  const g = binaGeometrisi(p, H, 0, ORNEK_MOD);
  if (dosya.startsWith("yapi_")) { const u = JSON.parse(fs.readFileSync(path.join(BURASI, "../muayene/ustveri/cephe_ornek_dukkan.json"), "utf8")); const hedef = path.join(BURASI, "../muayene/ustveri", dosya + ".json"); if (!fs.existsSync(hedef)) { g.computeBoundingBox(); const b = g.boundingBox; fs.writeFileSync(hedef, JSON.stringify({ ...u, glb: dosya, yakin: [{ ad: "ön yakın", hedef: [0, (b.max.y) * 0.35, b.max.z], yon: [0.6, 0.25, 1], mesafe: Math.max(8, (b.max.x - b.min.x) * 0.45) }, { ad: "tepe", hedef: [0, b.max.y * 0.8, 0], yon: [1, 0.6, 1], mesafe: Math.max(8, b.max.y * 0.6) }, { ad: "yan", hedef: [b.max.x, b.max.y * 0.3, 0], yon: [1, 0.2, -0.3], mesafe: Math.max(7, (b.max.z - b.min.z) * 0.5) }], not: "3A-2 tanınır yapı örneği (cephe_ao.mjs üretir)." }, null, 2)); } }
  const tint = g.attributes.color.clone();
  aoHesapla(g, { engeller: [g, zemin(p)], R: 0.45, isin: 16, guc: 0.75 });
  const c = g.attributes.color; for (let i = 0; i < c.count; i++) { const a = aoDuzelt(g, i); c.setXYZ(i, a * tint.getX(i), a * tint.getY(i), a * tint.getZ(i)); }
  g.setAttribute("bolge", g.attributes._bolge); g.deleteAttribute("_bolge");
  const mesh = new THREE.Mesh(mergeVertices(g), new THREE.MeshStandardMaterial({ name: "Atlas", roughness: 0.82, metalness: 0 }));
  mesh.name = dosya; mesh.userData = { hucreler: H };
  const kb = await glbYaz(dosya + ".glb", mesh);
  console.log(`${dosya}.glb ${(kb / 1024).toFixed(0)} KB — ${id}, ${g.attributes.position.count / 3} üçgen`);
}
