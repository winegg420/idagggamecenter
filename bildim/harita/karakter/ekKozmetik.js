// ============================================================
// KODLA ÇİZİLEN KOZMETİKLER — taç + pelerin (Paket 16 §C; Paket 21 §A'da meydanAvatar.js'ten ayrıldı)
//
// Karakter GLB'sinde yoklar; karakter MALZEMESİYLE (aynı atlas: altin / tisort hücresi, yeni doku yok) çalışma anında
// üretilir. TEK KAYNAK, üç tüketici:
//   karakter/meydanAvatar.js      — oyunda: tüm oyuncular için paylaşılan InstancedMesh, örnek matrisi `ekMatris`
//   muayene/kodKozmetik.mjs       — muayene için GLB'ye dışa aktarım (kozmetik_tac.glb, kozmetik_pelerin.glb)
//   muayene/takili.mjs            — takılı poz muayenesi (aynı yerleşim matrisi)
// Kural (Paket 21 §A): oyunda görünen hiçbir geometri muayene dışında kalmaz — kod mu GLB mi fark etmez.
// ============================================================
import * as THREE from "three";

export const TAC_BOLGE = 24;       // karakter.js METAL_TABLO: metal 0,9 · pürüz 0,22 (altın parlaklığı)
export const PELERIN_BOLGE = 17;   // kumaş pürüzü 0,82
const PELERIN_RENK = new THREE.Color("#503b82");   // gardıroptaki pelerinle aynı ton (avatar3d/model.js capeMat)

function ekGeometri(ucgenler, hucre, renk, bolge) {
  const n = ucgenler.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), c = new Float32Array(n * 4), b = new Float32Array(n).fill(bolge);
  const u = hucre ? (hucre.u0 + hucre.u1) / 2 : 0.5, v = hucre ? (hucre.v0 + hucre.v1) / 2 : 0.5;
  ucgenler.forEach((q, i) => { pos.set(q, i * 3); uv[i * 2] = u; uv[i * 2 + 1] = v; c.set([renk.r, renk.g, renk.b, 1], i * 4); });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(c, 4));
  g.setAttribute("_bolge", new THREE.BufferAttribute(b, 1));
  g.computeVertexNormals();
  return g;
}

/** Taç: 10 dilimli açık halka (dış + iç yüz) + 5 sivri diş (iki yüz). Yuva uzayı, başın üstü. 50 üçgen. */
export function tacGeometrisi(H) {
  const U = [], n = 10, r0 = 0.165, r1 = 0.185, y0 = 0.045, y1 = 0.125, uc = 0.215;
  const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const dort = (a, b, c, d) => { U.push(a, b, c, a, c, d); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    dort(P(a0, r0, y0), P(a0, r1, y1), P(a1, r1, y1), P(a1, r0, y0));
    dort(P(a1, r0 - 0.012, y0), P(a1, r1 - 0.012, y1), P(a0, r1 - 0.012, y1), P(a0, r0 - 0.012, y0));
    if (i % 2 === 0) {
      const am = (a0 + a1) / 2;
      U.push(P(a0, r1, y1), P(am, r1 + 0.004, uc), P(a1, r1, y1));
      U.push(P(a1, r1 - 0.012, y1), P(am, r1 - 0.008, uc), P(a0, r1 - 0.012, y1));
    }
  }
  return ekGeometri(U, H.altin, new THREE.Color(1.45, 1.3, 1.0), TAC_BOLGE);   // altın hücresi metal ışıkta koyu kalıyordu
}

/** Pelerin: omuzdan (y = 0) aşağı 4 × 3 hafif kavisli şerit, iki yüz. Yerel -Z sırt yönü. 48 üçgen. */
export function pelerinGeometrisi(H) {
  const U = [], sat = 4, sut = 3, boy = 0.98, ust = 0.46, alt = 0.64;
  const P = (i, j, kal) => {
    const t = j / sat, gen = ust + (alt - ust) * t, x = (i / sut - 0.5) * gen;
    const z = -(0.02 + 0.06 * t) - 0.05 * (1 - (2 * i / sut - 1) ** 2) - kal;
    return [x, -boy * t, z];
  };
  for (let j = 0; j < sat; j++) for (let i = 0; i < sut; i++) {
    const a = P(i, j, 0), b = P(i + 1, j, 0), c = P(i + 1, j + 1, 0), d = P(i, j + 1, 0);
    U.push(a, c, b, a, d, c);
    const a2 = P(i, j, -0.006), b2 = P(i + 1, j, -0.006), c2 = P(i + 1, j + 1, -0.006), d2 = P(i, j + 1, -0.006);
    U.push(a2, b2, c2, a2, c2, d2);
  }
  return ekGeometri(U.map((q) => q), H.tisort, PELERIN_RENK, PELERIN_BOLGE);
}

/** Kod kozmetiği → bağlandığı yuva (karakter GLB'sindeki boş düğüm). */
export const EK_YUVA = { tac: "basYuva", pelerin: "sirtYuva" };
export const PELERIN_KAYDIR = new THREE.Vector3(0, 0.52, -0.07);   // sirtYuva (0,94 m) → omuz hattı (~1,44 m)
/** Pelerinin durağan açısı (hız 0, salınım ortası) — muayene bu pozu ölçer. */
export const PELERIN_DURGUN_ACI = 0.06;

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _bir = new THREE.Vector3(1, 1, 1), _m2 = new THREE.Matrix4();
/**
 * Yuvanın dünya matrisinden kozmetiğin örnek matrisi (oyun her karede, muayene bir kez çağırır).
 * @param {"tac"|"pelerin"} ad  @param {THREE.Matrix4} yuvaDunya  @param {{ aci?: number, kisa?: boolean }} o  @param {THREE.Matrix4} hedef
 */
export function ekMatris(ad, yuvaDunya, { aci = PELERIN_DURGUN_ACI, kisa = false } = {}, hedef = new THREE.Matrix4()) {
  yuvaDunya.decompose(_p, _q, _s);
  hedef.compose(_p, _q, _bir);
  if (ad === "pelerin") {
    hedef.multiply(_m2.makeTranslation(PELERIN_KAYDIR.x, PELERIN_KAYDIR.y, PELERIN_KAYDIR.z));
    hedef.multiply(_m2.makeRotationX(-aci)).multiply(_m2.makeScale(1, kisa ? 0.58 : 1, 1));
  }
  return hedef;
}
