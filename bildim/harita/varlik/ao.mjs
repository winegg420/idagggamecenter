// ============================================================
// GÖMÜLÜ AO (Aşama 1B.1) — köşe noktası başına ortam kapanması
//
// Her köşe için normal etrafındaki yarım küreye 16 ışın atılır; R yarıçapı
// içinde kesişen ışın oranı karartma olur ve COLOR_0 (vertex color) olarak
// yazılır. three.js bunu atlasla ÇARPAR: renk korunur, girintiler kararır.
// Çalışma anı maliyeti sıfır (ek çağrı/doku/üçgen yok). Yalnız üretimde
// koşar; three-mesh-bvh yalnız üretim bağımlılığıdır (devDependency).
// ============================================================
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Deterministik hash (0..1) — aynı model her üretimde aynı AO'yu alsın. */
function hash(i) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

/** Kosinüs ağırlıklı yarım küre yönleri (yerel: +Z normal). */
function yonler(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, v = ((i * 0.618033988749895) % 1);
    const r = Math.sqrt(u), fi = v * Math.PI * 2;
    out.push(new THREE.Vector3(r * Math.cos(fi), r * Math.sin(fi), Math.sqrt(Math.max(0, 1 - u))));
  }
  return out;
}

/**
 * @param {THREE.BufferGeometry} geo    AO yazılacak geometri (position + normal)
 * @param {object} o
 * @param {THREE.BufferGeometry[]} [o.engeller]  ışınları kesen geometriler (varsayılan: geo'nun kendisi)
 * @param {number} [o.R=0.35]   etkili yarıçap (m)
 * @param {number} [o.isin=16]
 * @param {number} [o.guc=0.85] tam kapanmada karartma
 * @returns {{ort:number, min:number}} rapor için özet
 */
export function aoHesapla(geo, o = {}) {
  const { engeller = [geo], R = 0.35, isin = 16, guc = 0.85 } = o;
  const hedef = engeller.length === 1 ? engeller[0] : mergeGeometries(engeller.map((g) => {
    const t = g.index ? g.toNonIndexed() : g.clone();
    for (const ad of Object.keys(t.attributes)) if (ad !== "position") t.deleteAttribute(ad);
    return t;
  }), false);
  const bvh = new MeshBVH(hedef);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const n = pos.count;
  const renk = new Float32Array(n * 3);
  const YON = yonler(isin);
  const ray = new THREE.Ray(), N = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(), d = new THREE.Vector3();
  const q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  let toplam = 0, enAz = 1;
  for (let i = 0; i < n; i++) {
    N.fromBufferAttribute(nor, i).normalize();
    ray.origin.fromBufferAttribute(pos, i).addScaledVector(N, 0.006);
    // Normal etrafında rastgele döndürülmüş çerçeve (bantlaşma olmasın)
    q.setFromUnitVectors(Z, N);
    const donus = hash(i) * Math.PI * 2;
    let kesen = 0;
    for (const y of YON) {
      d.set(y.x * Math.cos(donus) - y.y * Math.sin(donus), y.x * Math.sin(donus) + y.y * Math.cos(donus), y.z).applyQuaternion(q);
      ray.direction.copy(d);
      const h = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (h && h.distance < R) kesen += 1 - (h.distance / R) * 0.5; // yakın kesişme daha çok karartır
    }
    const ao = Math.max(0, Math.min(1, 1 - (kesen / isin) * guc));
    renk[i * 3] = renk[i * 3 + 1] = renk[i * 3 + 2] = ao;
    toplam += ao; if (ao < enAz) enAz = ao;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(renk, 3));
  return { ort: +(toplam / n).toFixed(3), min: +enAz.toFixed(3), kose: n };
}

/** Kutu için kenar uzunluğuna göre bölme sayısı (~0,4 m ızgara; AO çözünürlüğü). */
export function bolme(uzunluk, adim = 0.4) { return uzunluk > 0.5 ? Math.max(1, Math.round(uzunluk / adim)) : 1; }
