// ============================================================
// MUAYENE — TAKILI POZ KURUCUSU (Paket 21 §A, §E.1). Node, tarayıcısız.
//
// Oyuncunun gördüğü hâli kurar: tür × kozmetik, `Idle` pozu, tür–kozmetik sözleşmesi (geçir/gizle/biçimlendir/it)
// uygulanmış, saç/kıyafet varyantı çökertilmiş. KOPYA MANTIK YOK — oyunun kendi modülleri çağrılır:
//   kozmetik.js › kozmetikTak / kuyrukTak / sozlesmeUygula   (yuva + sözleşme)
//   karakter.js › KarakterSistemi.prototype.gorunum           (varyant çökertme, gizli bölge)
//   ekKozmetik.js › tacGeometrisi / pelerinGeometrisi / ekMatris (kodla çizilen kozmetikler, oyundaki matris)
// Çıktı: dünya uzayında durağan geometri (gövde deri deformasyonu uygulanmış) → GLB (muayene/uretilen/).
// ============================================================
import "../varlik/polyfill.mjs";
import fs from "fs";
import path from "path";
import * as THREE from "three";
import { clone as iskeletKopyala } from "three/addons/utils/SkeletonUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { glbOku } from "./glbOku.mjs";
import { KarakterSistemi, TURLER } from "../karakter/karakter.js";
import { KOZMETIK, kozmetikTak, kuyrukTak } from "../karakter/kozmetik.js";
import { tacGeometrisi, pelerinGeometrisi, ekMatris, EK_YUVA } from "../karakter/ekKozmetik.js";

const BURASI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const KOK = path.resolve(BURASI, "../../..");
export const URETILEN = path.join(BURASI, "uretilen");
export const URETILEN_URL = "/bildim/harita/muayene/uretilen/";

/** Oyunda takılabilen her kozmetik (vitrin_kozmetikleri aktif satırları) + kaplanın tür parçası kuyruk. */
export const KOZMETIKLER = ["sapka", "gozluk", "gozlukPremium", "atki", "kanat", "tac", "pelerin"];
export const KOD_KOZMETIKLERI = { tac: tacGeometrisi, pelerin: pelerinGeometrisi };
export const takiliListe = () => TURLER.flatMap((tur) => [...KOZMETIKLER, ...(tur === "kaplan" ? ["kuyruk"] : [])].map((koz) => ({ tur, koz, ad: `takili_${tur}_${koz}` })));

let veri = null;
async function turVerisi() {
  if (veri) return veri;
  veri = {};
  for (const tur of TURLER) {
    const g = await glbOku(path.join(KOK, "public/meydan/deneme", `karakter_${tur}.glb`));
    const kozmetikler = {};
    const grup = g.scene.getObjectByName("Kozmetikler");
    if (grup) { grup.parent.remove(grup); for (const m of grup.children) kozmetikler[m.name.replace("kozmetik_", "")] = m; }
    veri[tur] = { sahne: g.scene, klipler: g.animations, kozmetikler, mesh: g.scene.getObjectByName("Govde") };
  }
  return veri;
}

/** Oyundaki `ks` yüzeyinin muayeneye yeten kısmı: tür verisi + görünüm (gerçek fonksiyon) + VFX'siz. */
function sahteKs(v) {
  return { turVeri: v, gorunum(kok, g) { KarakterSistemi.prototype.gorunum.call(this, kok, g); }, vfxEsle() {} };
}

/**
 * @returns {{ govde: THREE.BufferGeometry, parca: { ad: string, geo: THREE.BufferGeometry }, yuva: string, uygulanan: object }}
 */
export async function takiliKur(tur, koz, { sac = 1, set = 1, klip = "Idle", zaman = 0.3 } = {}) {
  const v = await turVerisi();
  const ks = sahteKs(v);
  const kok = iskeletKopyala(v[tur].sahne);
  kok.userData = { ...kok.userData, tur, klipler: v[tur].klipler };
  // oyundaki sıra (KarakterSistemi.kur): kozmetikler → kuyruk → görünüm
  if (KOZMETIK[koz]) kozmetikTak(ks, kok, koz, true);
  if (tur === "kaplan") kuyrukTak(ks, kok);
  ks.gorunum(kok, { set, sac });
  // Idle pozu (vitrin portresiyle aynı zaman: 0,3 s)
  const mixer = new THREE.AnimationMixer(kok);
  const c = klip ? v[tur].klipler.find((k) => k.name === klip) : null;   // klip: null → BAĞLAMA pozu (Paket 23 §A.0 ölçümü)
  if (c) { const a = mixer.clipAction(c); a.play(); a.time = zaman; mixer.update(0); }
  if (kok.userData.kanatMesh) kok.userData.kanatMesh.rotation.x = -0.06;   // karakter.js kare(): -0,06 + sin·0,1 → durgun orta
  kok.updateMatrixWorld(true);
  const govdeMesh = kok.getObjectByName("Govde");
  govdeMesh.skeleton?.update();
  const govde = pozluGovde(govdeMesh);

  let geo, yuvaAd;
  if (KOD_KOZMETIKLERI[koz]) {
    yuvaAd = EK_YUVA[koz];
    const yuva = kok.getObjectByName(yuvaAd);
    geo = KOD_KOZMETIKLERI[koz](govdeMesh.userData.hucreler ?? {}).applyMatrix4(ekMatris(koz, yuva.matrixWorld, { tur }));
  } else {
    const m = kok.getObjectByName("kozmetik_" + koz);
    if (!m) throw new Error(`${tur}: kozmetik_${koz} takılamadı`);
    yuvaAd = m.parent?.name;
    geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    var uygulanan = m.userData.uygulanan ?? {};
  }
  // Kemiklerin DÜNYA konumu (Paket 23 §F.3 `durus_ekseni` ve §A.0 ölçümü buradan okur)
  const kemik = {};
  for (const ad of ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"]) {
    const b = kok.getObjectByName(ad);
    if (b) kemik[ad] = b.getWorldPosition(new THREE.Vector3());
  }
  return { govde, parca: { ad: koz, geo }, yuva: yuvaAd, uygulanan: uygulanan ?? {}, kemik, kok };
}

/** Deri deformasyonu uygulanmış gövde (dünya uzayı). Görünümün çökerttiği üçgenler (tek noktaya toplanan) atılır. */
function pozluGovde(mesh) {
  const src = mesh.geometry, pos = src.attributes.position, n = pos.count;
  const out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); out.set([v.x, v.y, v.z], i * 3); }
  const idx = src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i);
  const kalan = [];
  const ayni = (a, b) => out[a * 3] === out[b * 3] && out[a * 3 + 1] === out[b * 3 + 1] && out[a * 3 + 2] === out[b * 3 + 2];
  for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]; if (ayni(a, b) && ayni(b, c)) continue; kalan.push(a, b, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  for (const ad of ["uv", "_bolge", "color"]) if (src.attributes[ad]) g.setAttribute(ad, src.attributes[ad].clone());
  g.setIndex(kalan);
  return g;
}

const MALZEME = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
/** Sahneyi GLB'ye yazar; atlas dokusunu oyundaki /meydan/deneme/atlas.png'ye bağlar (yeni doku yok). */
export async function glbYaz(dosya, meshler) {
  const sahne = new THREE.Scene();
  for (const [ad, geo] of meshler) { const m = new THREE.Mesh(geo, MALZEME()); m.name = ad; sahne.add(m); }
  const b = Buffer.from(await new GLTFExporter().parseAsync(sahne, { binary: true }));
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString());
  j.images = [{ uri: "../../../../meydan/deneme/atlas.png" }];   // GLTFLoader yolu klasör önekiyle birleştirir; mutlak yol 404 veriyordu (ölçüldü)
  j.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  j.textures = [{ sampler: 0, source: 0 }];
  for (const m of j.materials ?? []) { m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {}; m.pbrMetallicRoughness.baseColorTexture = { index: 0 }; }
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), bin = b.subarray(20 + len), out = Buffer.alloc(20 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20); bin.copy(out, 20 + jb.length);
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, out);
  return out.length;
}

/**
 * `npm run muayene` her çalıştırmada ÖNCE bunu çağırır → uretilen/ asla bayat kalmaz.
 *   kozmetik_tac.glb, kozmetik_pelerin.glb          — kodla çizilen kozmetikler, kendi yuva uzaylarında (§A)
 *   takili_<tür>_<kozmetik>.glb  (22 adet)          — Idle pozu, takılı, dünya uzayı: Govde + kozmetik_<ad> (§E.1)
 */
export async function uretilenleriHazirla({ sessiz = false } = {}) {
  const v = await turVerisi();
  const H = v.insan.mesh.userData.hucreler ?? {};
  const liste = [];
  for (const [ad, f] of Object.entries(KOD_KOZMETIKLERI)) {
    const dosya = path.join(URETILEN, `kozmetik_${ad}.glb`);
    await glbYaz(dosya, [["kozmetik_" + ad, f(H)]]);
    liste.push(path.basename(dosya));
  }
  for (const { tur, koz, ad } of takiliListe()) {
    const s = await takiliKur(tur, koz);
    await glbYaz(path.join(URETILEN, ad + ".glb"), [["Govde", s.govde], ["kozmetik_" + koz, s.parca.geo]]);
    liste.push(ad + ".glb");
  }
  if (!sessiz) console.log(`[muayene] üretilen: ${liste.length} GLB (kod kozmetiği ${Object.keys(KOD_KOZMETIKLERI).length} · takılı poz ${liste.length - Object.keys(KOD_KOZMETIKLERI).length})`);
  return liste;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  await uretilenleriHazirla();
}
