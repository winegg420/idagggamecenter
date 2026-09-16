// ============================================================
// VARLIK ÜRETİCİ — Aşama 1 / 1B test varlıkları (STIL.md şartnamesine göre)
//
//   node bildim/harita/varlik/uret.mjs   [--ao-kapali]
//   → public/meydan/deneme/atlas.png (+ atlas_eski.png A/B için), temas.png,
//     karakter_insan.glb, bina_dukkan.glb, prop_*.glb, bordur.glb, *.olcum.json
//
// Bu makinede Blender yok; modeller three.js geometrileriyle KODLA kurulur,
// tek mesh'te birleştirilir, tek atlasa UV'lenir ve GLB olarak dışa aktarılır.
// Oyun çalışma anında yalnız GLB yükler — sanatçıdan gelecek GLB aynı
// sözleşmeyle (iskelet adları, yuvalar, ölçek, atlas) bu dosyaların yerine geçer.
//
// Aşama 1B: gömülü AO (COLOR_0), seçici pah, tessellation (AO çözünürlüğü),
// roughness 0,82, çevre prop'ları (instancing için tek mesh), bordür.
//
// İskelet: Mixamo (three.js Soldier örneğinden çıkarıldı, parmaksız 22 kemik)
// → Mixamo klipleri doğrudan oynar (mixamo.json içinde Idle/Walk/Run).
// ============================================================
import "./polyfill.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { atlasCiz, temasCiz, uvMerkez, uvDikdortgen } from "./atlas.mjs";
import { aoHesapla, bolme } from "./ao.mjs";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const CIKTI = path.join(KOK, "public/meydan/deneme");
fs.mkdirSync(CIKTI, { recursive: true });

// STIL.md §2.3 bütçeleri — aşan varlık REDDEDİLİR
const BUTCE = { karakterUcgen: 8000, kozmetikUcgen: 600, sacUcgen: 800, binaUcgen: 12000, propUcgen: 1500 };
const AO_KAPALI = process.argv.includes("--ao-kapali");
const PURUZ = 0.82; // Aşama 1B: tam mat (1,0) ışığı öldürüyordu

// ------------------------------------------------------------ uv yardımcıları
/** Tüm uv'leri hücre merkezine çeker (düz renk). */
function duz(geo, hucre) {
  const [u, v] = uvMerkez(hucre);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return geo;
}
/** Var olan 0..1 uv'yi hücre dikdörtgenine yayar (desenli hücre). */
function yay(geo, hucre) {
  const d = uvDikdortgen(hucre);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, d.u0 + (d.u1 - d.u0) * uv.getX(i), d.v0 + (d.v1 - d.v0) * (1 - uv.getY(i)));
  return geo;
}
function yerlestir(geo, poz, don = null, olcek = null) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...poz),
    don ?? new THREE.Quaternion(),
    new THREE.Vector3(...(olcek ?? [1, 1, 1]))
  );
  geo.applyMatrix4(m);
  return geo;
}
const ucgenSay = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
function temizle(geo) {
  // Birleştirme için ortak öznitelik kümesi: position, normal, uv (+skin).
  // Bazı geometriler indeksli bazıları değil → hepsi indekssiz, birleşince yeniden indekslenir.
  if (geo.index) geo = geo.toNonIndexed();
  for (const ad of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "skinIndex", "skinWeight"].includes(ad)) geo.deleteAttribute(ad);
  return geo;
}
/**
 * Pahlı kutu — SEÇİCİ kullanılır (siluet taşıyan kenarlar). Yarıçap obje ölçeğine bağlı:
 * min(kenar)×0,06, 1,5–12 cm arası (Aşama 1B §4).
 */
function pahli(w, h, d) {
  const r = Math.min(0.12, Math.max(0.015, Math.min(w, h, d) * 0.06));
  // 1 bölüm: pah tek kırıkla okunur, üçgen 2 bölümün üçte biri (bina 17k → bütçe içi)
  return new RoundedBoxGeometry(w, h, d, 1, r);
}
/** Büyük düz yüzeyleri ~0,4 m ızgaraya bölen kutu (AO çözünürlüğü için). */
function bolunmusKutu(w, h, d) { return new THREE.BoxGeometry(w, h, d, bolme(w, 0.5), bolme(h, 0.5), bolme(d, 0.5)); }
/** Birleştir + indeksle. Normaller ilkellerden gelir: kutu kenarı keskin, küre yumuşak (35° eşiğiyle aynı sonuç). */
const birlestir = (geos) => mergeVertices(mergeGeometries(geos.map(temizle), false));
const malzemeYap = () => new THREE.MeshStandardMaterial({ name: "Atlas", roughness: PURUZ, metalness: 0 });

// ------------------------------------------------------------ İSKELET
const MIXAMO = JSON.parse(fs.readFileSync(path.join(BURASI, "mixamo.json"), "utf8"));
/** Boy ölçeği: Mixamo kalça 1,061 m → tıknaz karakterde 0,92 m (baş büyük, toplam ~1,75). */
const OLCEK = 0.92 / 1.061;

function iskeletKur() {
  const kemikler = new Map();
  for (const k of MIXAMO.iskelet) {
    const b = new THREE.Bone();
    b.name = k.ad;
    b.position.fromArray(k.poz);
    b.quaternion.fromArray(k.don);
    kemikler.set(k.ad, b);
  }
  for (const k of MIXAMO.iskelet) if (k.ebeveyn) kemikler.get(k.ebeveyn).add(kemikler.get(k.ad));
  // Mixamo kökü: -90° X, 0,01 ölçek (cm → m) — klipler bu uzayda, aynen korunur.
  const rig = new THREE.Object3D();
  rig.name = "Rig";
  rig.position.fromArray(MIXAMO.kok.poz).multiplyScalar(OLCEK);
  rig.quaternion.fromArray(MIXAMO.kok.don);
  rig.scale.setScalar(MIXAMO.kok.olcek[0] * OLCEK);
  rig.add(kemikler.get("Hips"));
  return { rig, kemikler, sira: MIXAMO.iskelet.map((k) => k.ad) };
}

// ------------------------------------------------------------ KARAKTER
function karakterKur() {
  const { rig, kemikler, sira } = iskeletKur();
  // Ölçüldü (16 Eyl): Soldier rig'i three uzayında zaten +Z'ye bakıyor — döndürme yok.
  const karakter = new THREE.Group();
  karakter.name = "Karakter";
  const yon = new THREE.Group(); yon.name = "Yon";
  karakter.add(yon); yon.add(rig);
  karakter.updateMatrixWorld(true);

  const W = (ad) => kemikler.get(ad).getWorldPosition(new THREE.Vector3());
  const idx = (ad) => sira.indexOf(ad);
  const parcalar = [];
  const ekle = (geo, hucre, kemik, desenli = false) => {
    geo = temizle(geo);
    desenli ? yay(geo, hucre) : duz(geo, hucre);
    const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = idx(kemik); sw[i * 4] = 1; }
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    parcalar.push(geo);
    return geo;
  };
  /** a→b arasında kapsül (kemik boyunca uzuv). */
  const kapsul = (a, b, r, hucre, kemik, uzat = 0) => {
    const yonV = b.clone().sub(a), L = yonV.length() + uzat;
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, L - 2 * r * 0.35), 4, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), yonV.normalize());
    return ekle(yerlestir(geo, a.clone().lerp(b, 0.5).toArray(), q), hucre, kemik);
  };
  const kure = (poz, r, hucre, kemik, olcek = [1, 1, 1], seg = 16) =>
    ekle(yerlestir(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), poz.toArray(), null, olcek), hucre, kemik);

  const hips = W("Hips"), neck = W("Neck"), head = W("Head");
  // Gövde: kalça + göğüs (tıknaz); kumaş hücreleri desenli (dokuma görünsün)
  ekle(yerlestir(new RoundedBoxGeometry(0.42, 0.30, 0.30, 3, 0.10), hips.clone().add(new THREE.Vector3(0, -0.02, 0)).toArray()), "pantolon", "Hips", true);
  kapsul(hips.clone().add(new THREE.Vector3(0, 0.08, 0)), neck.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.215, "tisort", "Spine1");
  // Baş: büyük küre + saç kapağı + yüz
  const basM = head.clone().add(new THREE.Vector3(0, 0.20, 0.01));
  kure(basM, 0.235, "ten", "Head", [1, 1.02, 1], 20);
  const sac = new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const sacQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0, 0));
  ekle(yerlestir(sac, basM.clone().add(new THREE.Vector3(0, 0.01, -0.02)).toArray(), sacQ), "sac", "Head", true);
  for (const s of [-1, 1]) {
    kure(basM.clone().add(new THREE.Vector3(s * 0.085, 0.01, 0.205)), 0.05, "gozBeyaz", "Head", [1, 1.15, 0.7], 10);
    kure(basM.clone().add(new THREE.Vector3(s * 0.085, 0.0, 0.238)), 0.026, "gozBebek", "Head", [1, 1.2, 0.6], 8);
    kure(basM.clone().add(new THREE.Vector3(s * 0.15, -0.06, 0.16)), 0.035, "yanak", "Head", [1, 0.7, 0.5], 8);
  }
  const agiz = new THREE.CapsuleGeometry(0.014, 0.05, 2, 6);
  ekle(yerlestir(agiz, basM.clone().add(new THREE.Vector3(0, -0.095, 0.228)).toArray(), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))), "agiz", "Head");
  // Kollar + bacaklar
  for (const t of ["Left", "Right"]) {
    const arm = W(t + "Arm"), fore = W(t + "ForeArm"), hand = W(t + "Hand");
    kure(arm, 0.105, "tisort", t + "Arm", [1, 1, 1], 12);
    kapsul(arm, fore, 0.082, "tisort", t + "Arm");
    kapsul(fore, hand, 0.072, "ten", t + "ForeArm");
    const el = hand.clone().add(fore.clone().sub(hand).normalize().multiplyScalar(-0.05));
    kure(el, 0.088, "ten", t + "Hand", [1, 1, 1], 12);
    const up = W(t + "UpLeg"), leg = W(t + "Leg"), foot = W(t + "Foot"), toe = W(t + "ToeBase");
    kapsul(up, leg, 0.105, "pantolon", t + "UpLeg");
    kapsul(leg, foot, 0.09, "pantolon", t + "Leg");
    const ayakM = foot.clone().lerp(toe, 0.55).setY(0.075);
    ekle(yerlestir(new RoundedBoxGeometry(0.19, 0.15, 0.30, 3, 0.06), ayakM.toArray()), "ayakkabi", t + "Foot");
  }

  const govde = birlestir(parcalar);
  const aoGovde = AO_KAPALI ? null : aoHesapla(govde, { R: 0.3 });
  const malzeme = malzemeYap();
  const mesh = new THREE.SkinnedMesh(govde, malzeme);
  mesh.name = "Govde";
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const iskelet = new THREE.Skeleton(sira.map((ad) => kemikler.get(ad)));
  yon.add(mesh);           // dünya (rig'siz) uzayında kurulduğu için Yon altında
  mesh.bind(iskelet, yon.matrixWorld);

  // ---- KOZMETİK YUVALARI (STIL.md §2.1): dünya hizalı boş düğümler ----
  const yuvaPoz = new Map();
  const yuva = (ad, kemik, dunyaPoz) => {
    const k = kemikler.get(kemik);
    const o = new THREE.Object3D(); o.name = ad;
    k.add(o);
    o.position.copy(k.worldToLocal(dunyaPoz.clone()));
    // yuvanın dünya dönüşü birim olsun: kozmetikler +Y yukarı, +Z ön yazılır
    o.quaternion.copy(k.getWorldQuaternion(new THREE.Quaternion()).invert());
    // Rig 0,01×ölçek taşır; yuva bunu geri alır → kozmetik metre cinsinden yazılır, 1:1 oturur.
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
  yuva("sirtYuva", "Spine2", W("Spine2").clone().add(new THREE.Vector3(0, 0, -0.22)));
  for (const t of ["L", "R"]) {
    const s = t === "L" ? "Left" : "Right";
    yuva("ayakYuva_" + t, s + "Foot", W(s + "Foot"));
    yuva("bilekYuva_" + t, s + "Hand", W(s + "Hand"));
  }
  const efekt = new THREE.Object3D(); efekt.name = "efektYuva"; karakter.add(efekt);

  // ---- KOZMETİKLER: yuva merkezli, dünya hizalı, her biri tek mesh ----
  // Origin = yuva noktası (şapkada kafatasının tepesi, gözlükte göz hizası, atkıda boyun).
  const kozmetikler = new THREE.Group(); kozmetikler.name = "Kozmetikler";
  const aoKoz = {};
  const kozmetik = (ad, yuvaAd, geos) => {
    const g = birlestir(geos);
    if (!AO_KAPALI) {
      // Gövdeyi yuva uzayına taşı: şapkanın altı, atkının içi kafadan/boyundan kararsın
      const govdeYerel = govde.clone().translate(...yuvaPoz.get(yuvaAd).clone().negate().toArray());
      aoKoz[ad] = aoHesapla(g, { engeller: [g, govdeYerel], R: 0.25 });
    }
    const m = new THREE.Mesh(g, malzeme); m.name = ad; m.castShadow = true;
    kozmetikler.add(m); return m;
  };
  kozmetik("kozmetik_sapka", "basYuva", [
    yay(yerlestir(new THREE.SphereGeometry(0.262, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), [0, -0.13, 0]), "sapka"),
    duz(yerlestir(new RoundedBoxGeometry(0.30, 0.03, 0.17, 2, 0.012), [0, -0.11, 0.3], new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0))), "sapkaSiperi"),
    duz(yerlestir(new THREE.TorusGeometry(0.258, 0.018, 4, 18), [0, -0.12, 0], new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))), "sapkaSiperi"),
  ]);
  const gozluk = [];
  for (const s of [-1, 1]) {
    gozluk.push(duz(yerlestir(new THREE.TorusGeometry(0.06, 0.011, 6, 20), [s * 0.085, 0, 0]), "gozlukCerceve"));
    gozluk.push(yay(yerlestir(new THREE.CircleGeometry(0.056, 16), [s * 0.085, 0, -0.002]), "gozlukCam"));
    gozluk.push(duz(yerlestir(new THREE.BoxGeometry(0.012, 0.012, 0.2), [s * 0.15, 0.01, -0.1]), "gozlukCerceve"));
  }
  gozluk.push(duz(yerlestir(new THREE.BoxGeometry(0.05, 0.012, 0.012), [0, 0.01, 0]), "gozlukCerceve"));
  kozmetik("kozmetik_gozluk", "gozlukYuva", gozluk);
  kozmetik("kozmetik_atki", "boyunYuva", [
    yay(yerlestir(new THREE.TorusGeometry(0.19, 0.055, 6, 16), [0, 0.02, 0], new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))), "atki"),
    yay(yerlestir(new RoundedBoxGeometry(0.1, 0.34, 0.05, 1, 0.02), [0.06, -0.16, 0.2], new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, -0.15))), "atki"),
  ]);
  karakter.add(kozmetikler);

  // ---- ANİMASYON: Mixamo klipleri aynen + türetilmiş "Selam" ----
  const klipler = MIXAMO.klipler.map((k) => new THREE.AnimationClip(k.ad, k.sure, k.izler.map((i) =>
    i.tur === "quaternion"
      ? new THREE.QuaternionKeyframeTrack(i.ad, i.zaman, i.deger)
      : new THREE.VectorKeyframeTrack(i.ad, i.zaman, i.deger))));
  klipler.push(selamKlibi(klipler.find((k) => k.name === "Idle"), kemikler, karakter));

  return { karakter, mesh, klipler, kozmetikler, kemikler, ao: { govde: aoGovde, ...aoKoz } };
}

/**
 * Selam: Idle'ın kopyası, sağ kol kaldırılıp el sallanır.
 * Kemik yerel dönüşü = ebeveyn dünya dönüşünün tersi × dünya delta × Idle dünya dönüşü.
 */
function selamKlibi(idle, kemikler, karakter) {
  const izler = idle.tracks.filter((t) => !/^Right(Arm|ForeArm)\./.test(t.name)).map((t) => t.clone());
  const mixer = new THREE.AnimationMixer(karakter);
  mixer.clipAction(idle).play(); mixer.update(0); karakter.updateMatrixWorld(true);
  const Z = new THREE.Vector3(0, 0, 1);
  const yerel = (kemik, dunyaDelta) => {
    const k = kemikler.get(kemik);
    const qp = k.parent.getWorldQuaternion(new THREE.Quaternion());
    const qw = k.getWorldQuaternion(new THREE.Quaternion());
    return qp.clone().invert().multiply(dunyaDelta).multiply(qw);
  };
  const kol = [], onKol = [], z1 = [], z2 = [];
  const anahtar = (t, kolAci, onKolAci) => {
    z1.push(t); z2.push(t);
    kol.push(...yerel("RightArm", new THREE.Quaternion().setFromAxisAngle(Z, kolAci)).toArray());
    onKol.push(...yerel("RightForeArm", new THREE.Quaternion().setFromAxisAngle(Z, onKolAci)).toArray());
  };
  // Kol yukarı (2,3 rad); ön kol dışa-içe salınır — pozitif açı ön kolu başa doğru büker, o yüzden eksiye gidilir.
  anahtar(0, 0, 0);
  anahtar(0.45, 2.3, -0.2);
  for (let i = 0; i < 4; i++) { anahtar(0.45 + i * 0.32 + 0.16, 2.3, 0.35); anahtar(0.45 + i * 0.32 + 0.32, 2.3, -0.45); }
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
  const at = (geo, hucre, desenli = false, poz = null, don = null) => { if (poz) yerlestir(geo, poz, don); g.push(desenli ? yay(geo, hucre) : duz(geo, hucre)); return geo; };
  // kutu: büyük yüzeyler AO için bölünür; pahliKutu: siluet kenarı (saçak, çerçeve, silme)
  const kutu = (w, h, d, poz, hucre, desenli = false, don = null) => at(bolunmusKutu(w, h, d), hucre, desenli, poz, don);
  const pahliKutu = (w, h, d, poz, hucre, desenli = false, don = null) => at(pahli(w, h, d), hucre, desenli, poz, don);
  const W = 9.0, D = 8.0, K1 = 3.8, K2 = 3.2; // genişlik, derinlik, kat yükseklikleri
  // kaldırım plakası + zemin kat (taş) + üst kat (sıva)
  pahliKutu(W + 1.2, 0.18, D + 1.2, [0, 0.09, 0], "kaldirim", true);
  kutu(W, K1, D, [0, 0.18 + K1 / 2, 0], "tas", true);
  pahliKutu(W + 0.3, 0.28, D + 0.3, [0, 0.18 + K1 + 0.14, 0], "tasAcik", true);            // kat silmesi (siluet)
  kutu(W, K2, D, [0, 0.18 + K1 + 0.28 + K2 / 2, 0], "siva", true);
  const cati0 = 0.18 + K1 + 0.28 + K2;
  pahliKutu(W + 0.5, 0.3, D + 0.5, [0, cati0 + 0.15, 0], "tasAcik", true);                 // korniş (saçak hattı)
  // çatı: kırma (4 yüzlü kesik piramit) — kiremit deseni
  const cati = new THREE.CylinderGeometry(1.6, Math.hypot(W, D) / 2 + 0.4, 2.2, 4, 3);
  at(cati, "kiremit", true, [0, cati0 + 0.3 + 1.1, 0], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)));
  pahliKutu(1.6, 0.25, 1.6, [0, cati0 + 2.55, 0], "tasAcik");                              // tepe
  pahliKutu(0.7, 1.4, 0.7, [-2.6, cati0 + 2.0, -2.2], "baca", true);
  // ---- ÖN CEPHE (+Z) ----
  const on = D / 2;
  // kapı: çerçeve (pahlı) + kanat + orta çıta + kol + kemer
  pahliKutu(2.6, 2.5, 0.25, [0, 0.18 + 1.25, on + 0.02], "ahsapAcik", true);
  kutu(2.2, 2.3, 0.2, [0, 0.18 + 1.15, on + 0.12], "ahsap", true);
  kutu(0.06, 2.3, 0.22, [0, 0.18 + 1.15, on + 0.14], "altin");
  at(new THREE.SphereGeometry(0.06, 8, 6), "altin", false, [0.35, 0.18 + 1.1, on + 0.24]);
  const kemer = new THREE.CylinderGeometry(1.15, 1.15, 0.25, 18, 1, false, 0, Math.PI);
  at(kemer, "ahsapAcik", true, [0, 0.18 + 2.5, on + 0.02], new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
  // girilebilir işareti: kapının iki yanında fener + kapı önü paspas
  for (const s of [-1, 1]) {
    kutu(0.08, 0.08, 0.45, [s * 1.55, 0.18 + 2.75, on + 0.22], "demir");
    pahliKutu(0.28, 0.4, 0.28, [s * 1.55, 0.18 + 2.5, on + 0.42], "lamba");
    pahliKutu(0.34, 0.06, 0.34, [s * 1.55, 0.18 + 2.73, on + 0.42], "demir");
  }
  kutu(2.4, 0.03, 1.0, [0, 0.18 + 0.02, on + 0.6], "tente", true);
  // vitrinler (iki yanda): pahlı beyaz çerçeve + cam + alt taş
  for (const s of [-1, 1]) {
    const x = s * 2.9;
    pahliKutu(2.6, 2.6, 0.16, [x, 0.18 + 2.05, on + 0.02], "cerceve");
    kutu(2.3, 2.3, 0.14, [x, 0.18 + 2.05, on + 0.06], "cam", true);
    kutu(0.08, 2.3, 0.16, [x, 0.18 + 2.05, on + 0.08], "cerceve");
    pahliKutu(2.6, 0.5, 0.35, [x, 0.18 + 0.5, on + 0.1], "tasAcik", true);
  }
  // tente: eğik çizgili kumaş + kenar saçağı + destekler
  const tenteQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, 0));
  kutu(W - 0.4, 0.06, 1.7, [0, 0.18 + K1 - 0.18, on + 0.85], "tente", true, tenteQ);
  kutu(W - 0.4, 0.22, 0.06, [0, 0.18 + K1 - 0.65, on + 1.6], "tente", true);
  for (const s of [-1, 1]) kutu(0.06, 0.06, 1.7, [s * (W / 2 - 0.3), 0.18 + K1 - 0.18, on + 0.85], "demir", false, tenteQ);
  // tabela: mod rengi pano + altın çerçeve (yazı çalışma anında canvas ile gelir)
  pahliKutu(4.2, 0.82, 0.18, [0, 0.18 + K1 + 0.28 + 0.46, on + 0.1], "tabela");
  kutu(4.4, 0.07, 0.2, [0, 0.18 + K1 + 0.28 + 0.06, on + 0.1], "altin");
  kutu(4.4, 0.07, 0.2, [0, 0.18 + K1 + 0.28 + 0.86, on + 0.1], "altin");
  // üst kat: ortada cumba (çıkma, pahlı), yanlarda balkonlu pencereler
  const u0 = 0.18 + K1 + 0.28;
  pahliKutu(2.6, 2.0, 0.7, [0, u0 + 2.0, on + 0.35], "siva", true);
  pahliKutu(2.0, 1.5, 0.1, [0, u0 + 2.05, on + 0.72], "cerceve");
  kutu(1.75, 1.3, 0.08, [0, u0 + 2.05, on + 0.76], "cam", true);
  pahliKutu(2.8, 0.15, 0.9, [0, u0 + 0.98, on + 0.4], "tasAcik", true);
  for (const s of [-1, 1]) {
    const x = s * 2.9;
    pahliKutu(1.3, 2.0, 0.1, [x, u0 + 1.75, on + 0.02], "cerceve");
    kutu(1.1, 1.8, 0.08, [x, u0 + 1.75, on + 0.06], "cam", true);
    kutu(0.06, 1.8, 0.1, [x, u0 + 1.75, on + 0.08], "cerceve");
    pahliKutu(1.7, 0.12, 0.6, [x, u0 + 0.7, on + 0.3], "tasAcik", true);
    kutu(1.7, 0.04, 0.04, [x, u0 + 1.5, on + 0.58], "demir");
    for (let i = -4; i <= 4; i++) kutu(0.03, 0.8, 0.03, [x + i * 0.2, u0 + 1.1, on + 0.58], "demir");
    for (const s2 of [-1, 1]) kutu(0.03, 0.8, 0.6, [x + s2 * 0.83, u0 + 1.1, on + 0.3], "demir");
  }
  // yan cepheler: pencereler
  for (const s of [-1, 1]) for (const z of [-2.2, 2.2]) {
    kutu(0.1, 1.6, 1.1, [s * (W / 2 + 0.02), u0 + 1.75, z], "cerceve");
    kutu(0.08, 1.4, 0.9, [s * (W / 2 + 0.06), u0 + 1.75, z], "cam", true);
    kutu(0.1, 1.4, 1.1, [s * (W / 2 + 0.02), 0.18 + 2.2, z], "cerceve");
    kutu(0.08, 1.2, 0.9, [s * (W / 2 + 0.06), 0.18 + 2.2, z], "cam", true);
  }
  // bayrak: direk + kırmızı bayrak (cumba köşesinde)
  const direkQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0, 0));
  kutu(0.05, 1.6, 0.05, [2.0, u0 + 3.1, on + 0.7], "demir", false, direkQ);
  kutu(0.9, 0.6, 0.02, [2.0, u0 + 3.4, on + 1.35], "bayrak");
  // saksılar (kapı iki yanı)
  for (const s of [-1, 1]) {
    at(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 10), "baca", true, [s * 1.7, 0.18 + 0.3, on + 0.9]);
    at(new THREE.SphereGeometry(0.36, 10, 8), "cim", true, [s * 1.7, 0.18 + 0.78, on + 0.9], null);
  }
  const geo = birlestir(g);
  const ao = AO_KAPALI ? null : aoHesapla(geo, { R: 0.45 });
  const mesh = new THREE.Mesh(geo, malzemeYap());
  mesh.name = "Bina_Dukkan"; mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, ao, ayakIzi: { w: W + 1.2, d: D + 1.2, kapi: [0, on + 0.3] } };
}

// ------------------------------------------------------------ ÇEVRE PROP'LARI (instancing için tek mesh)
/** Tek mesh prop: geometri listesi → birleştir, AO, mesh. */
function prop(ad, geos, R = 0.3) {
  const geo = birlestir(geos);
  const ao = AO_KAPALI ? null : aoHesapla(geo, { R });
  const m = new THREE.Mesh(geo, malzemeYap()); m.name = ad; m.castShadow = true; m.receiveShadow = true;
  return { mesh: m, ao };
}
const D = (geo, hucre, poz, don = null, olcek = null) => duz(yerlestir(geo, poz, don, olcek), hucre);
const Y = (geo, hucre, poz, don = null, olcek = null) => yay(yerlestir(geo, poz, don, olcek), hucre);
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

function proplarKur() {
  const out = {};
  // Ağaç: gövde ayrı, taç ayrı (iki instance türü, iki çağrı; taç iki ton)
  out.agacGovde = prop("prop_agac_govde", [
    Y(new THREE.CylinderGeometry(0.2, 0.32, 2.4, 9), "ahsap", [0, 1.2, 0]),
    Y(new THREE.CylinderGeometry(0.34, 0.46, 0.35, 9), "ahsap", [0, 0.17, 0]),
    Y(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 6), "ahsap", [0.32, 2.6, 0.1], E(0, 0, -0.6)),
    Y(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 6), "ahsap", [-0.28, 2.7, -0.15], E(0.3, 0, 0.55)),
  ]);
  out.agacTac = prop("prop_agac_tac", [
    // Çevre üçgen bütçesi (≤80k, gölge geçişi dahil) için düşük bölümlü küreler
    Y(new THREE.SphereGeometry(1.35, 10, 7), "cim", [0, 3.3, 0], null, [1, 0.92, 1]),
    Y(new THREE.SphereGeometry(1.0, 8, 6), "cimAcik", [0.55, 3.95, 0.3]),
    Y(new THREE.SphereGeometry(0.9, 8, 6), "cimAcik", [-0.6, 3.8, -0.25]),
    Y(new THREE.SphereGeometry(0.85, 8, 6), "cim", [0.1, 4.45, -0.2]),
  ], 0.5);
  // Sokak lambası: nostaljik siyah demir, küresel fener
  out.lamba = prop("prop_lamba", [
    D(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 10), "demir", [0, 0.25, 0]),
    D(new THREE.CylinderGeometry(0.06, 0.1, 3.6, 8), "demir", [0, 2.3, 0]),
    D(new THREE.TorusGeometry(0.1, 0.02, 6, 12), "demir", [0, 0.55, 0], E(Math.PI / 2, 0, 0)),
    D(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), "demir", [0.2, 4.15, 0], E(0, 0, -0.9)),
    D(new THREE.SphereGeometry(0.22, 12, 9), "lamba", [0.42, 4.05, 0]),
    D(new THREE.ConeGeometry(0.28, 0.22, 10), "demir", [0.42, 4.3, 0]),
    D(new THREE.SphereGeometry(0.05, 6, 5), "altin", [0.42, 4.45, 0]),
  ]);
  // Bank: 3 çıta oturak + 2 çıta sırt + demir ayaklar
  const bank = [];
  for (let i = 0; i < 3; i++) bank.push(Y(pahli(1.8, 0.05, 0.13), "ahsapAcik", [0, 0.45, -0.16 + i * 0.16]));
  for (let i = 0; i < 2; i++) bank.push(Y(pahli(1.8, 0.05, 0.12), "ahsapAcik", [0, 0.72 + i * 0.16, -0.27], E(0.25, 0, 0)));
  for (const s of [-1, 1]) {
    bank.push(D(pahli(0.06, 0.45, 0.5), "demir", [s * 0.8, 0.22, 0]));
    bank.push(D(pahli(0.06, 0.5, 0.08), "demir", [s * 0.8, 0.68, -0.3], E(0.25, 0, 0)));
  }
  out.bank = prop("prop_bank", bank, 0.25);
  // Saksı: terracotta + bitki + çiçekler (iki boy instance ölçeğiyle)
  const saksi = [
    Y(new THREE.CylinderGeometry(0.42, 0.32, 0.7, 10), "baca", [0, 0.35, 0]),
    D(new THREE.TorusGeometry(0.42, 0.04, 5, 12), "baca", [0, 0.7, 0], E(Math.PI / 2, 0, 0)),
    Y(new THREE.SphereGeometry(0.42, 8, 6), "cim", [0, 0.95, 0], null, [1, 0.75, 1]),
  ];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; saksi.push(D(new THREE.SphereGeometry(0.07, 6, 5), i % 2 ? "bayrak" : "lamba", [Math.cos(a) * 0.3, 1.18, Math.sin(a) * 0.3])); }
  out.saksi = prop("prop_saksi", saksi, 0.25);
  // Bordür: sokak boyu iki kaldırım taşı hattı (test sahnesi: z = 2 ve z = 10), tek mesh
  out.bordur = prop("bordur", [
    Y(new THREE.BoxGeometry(80, 0.16, 0.3, 40, 1, 1), "tasAcik", [0, 0.08, 2.0]),
    Y(new THREE.BoxGeometry(80, 0.16, 0.3, 40, 1, 1), "tasAcik", [0, 0.08, 10.0]),
  ], 0.3);
  return out;
}

// ------------------------------------------------------------ GLB dışa aktarım + atlas bağlama
async function glbYaz(dosya, sahne, animations = []) {
  const ex = new GLTFExporter();
  const ab = await ex.parseAsync(sahne, { binary: true, animations, trs: true });
  const b = Buffer.from(ab);
  // Dışa aktarıcı Node'da resim gömemez: atlas.png'yi dış dosya olarak bağla.
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString());
  j.images = [{ uri: "atlas.png" }];
  j.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  j.textures = [{ sampler: 0, source: 0 }];
  for (const m of j.materials ?? []) { m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {}; m.pbrMetallicRoughness.baseColorTexture = { index: 0 }; }
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), bin = b.subarray(20 + len);
  const out = Buffer.alloc(20 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20); bin.copy(out, 20 + jb.length);
  fs.writeFileSync(path.join(CIKTI, dosya), out);
  return out.length;
}

function olcum(dosya, nesne, ek = {}) {
  const meshler = [];
  nesne.traverse((o) => { if (o.isMesh) meshler.push({ ad: o.name, ucgen: ucgenSay(o.geometry), kose: o.geometry.attributes.position.count, skinned: !!o.isSkinnedMesh, ao: !!o.geometry.attributes.color }); });
  const kutu = new THREE.Box3().setFromObject(nesne);
  const veri = { dosya, meshler, toplamUcgen: meshler.reduce((a, m) => a + m.ucgen, 0), malzeme: 1, roughness: PURUZ, boyut: kutu.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)), ...ek };
  fs.writeFileSync(path.join(CIKTI, dosya.replace(".glb", ".olcum.json")), JSON.stringify(veri, null, 1));
  return veri;
}

// ------------------------------------------------------------ ÇALIŞTIR
const t0 = Date.now();
fs.writeFileSync(path.join(CIKTI, "atlas.png"), atlasCiz());
fs.writeFileSync(path.join(CIKTI, "atlas_eski.png"), atlasCiz({ eski: true }));
fs.writeFileSync(path.join(CIKTI, "temas.png"), temasCiz());
const K = karakterKur();
const oK = olcum("karakter_insan.glb", K.karakter, { kemik: K.kemikler.size, klipler: K.klipler.map((k) => k.name), yuvalar: [...K.kemikler.values()].flatMap((b) => b.children.filter((c) => !c.isBone).map((c) => c.name)), ao: K.ao });
const govdeUcgen = oK.meshler.find((m) => m.ad === "Govde").ucgen;
const red = [];
if (govdeUcgen > BUTCE.karakterUcgen) red.push(`karakter gövdesi ${govdeUcgen} > ${BUTCE.karakterUcgen}`);
for (const m of oK.meshler) if (m.ad.startsWith("kozmetik_") && m.ucgen > BUTCE.kozmetikUcgen) red.push(`${m.ad} ${m.ucgen} > ${BUTCE.kozmetikUcgen}`);
const B = binaKur();
const oB = olcum("bina_dukkan.glb", B.mesh, { ...B.ayakIzi, ao: B.ao });
if (oB.toplamUcgen > BUTCE.binaUcgen) red.push(`bina ${oB.toplamUcgen} > ${BUTCE.binaUcgen}`);
const P = proplarKur();
const oP = {};
for (const [ad, p] of Object.entries(P)) {
  oP[ad] = olcum(p.mesh.name + ".glb", p.mesh, { ao: p.ao });
  if (ad !== "bordur" && oP[ad].toplamUcgen > BUTCE.propUcgen) red.push(`${ad} ${oP[ad].toplamUcgen} > ${BUTCE.propUcgen}`);
}
if (red.length) { console.error("BÜTÇE AŞILDI — reddedildi:\n  " + red.join("\n  ")); process.exit(1); }
const nK = await glbYaz("karakter_insan.glb", K.karakter, K.klipler);
const nB = await glbYaz("bina_dukkan.glb", B.mesh);
for (const p of Object.values(P)) await glbYaz(p.mesh.name + ".glb", p.mesh);
const aoOzet = (a) => (a ? `AO ort ${a.ort} min ${a.min}` : "AO kapalı");
console.log(`karakter_insan.glb ${(nK / 1024).toFixed(0)} KB — gövde ${govdeUcgen} üçgen (${aoOzet(K.ao.govde)}), kozmetik ${oK.meshler.filter((m) => m.ad.startsWith("kozmetik_")).map((m) => m.ad.slice(9) + ":" + m.ucgen).join(", ")}, ${oK.kemik} kemik, klipler ${oK.klipler.join("/")}, yuva ${oK.yuvalar.length}`);
console.log(`bina_dukkan.glb ${(nB / 1024).toFixed(0)} KB — ${oB.toplamUcgen} üçgen, ${oB.meshler[0].kose} köşe (${aoOzet(B.ao)}), boyut ${oB.boyut.join("×")} m`);
for (const [ad, o] of Object.entries(oP)) console.log(`${o.dosya} — ${o.toplamUcgen} üçgen (${aoOzet(P[ad].ao)})`);
console.log("atlas.png", fs.statSync(path.join(CIKTI, "atlas.png")).size, "bayt · atlas_eski.png", fs.statSync(path.join(CIKTI, "atlas_eski.png")).size, "· süre", ((Date.now() - t0) / 1000).toFixed(1), "s");
