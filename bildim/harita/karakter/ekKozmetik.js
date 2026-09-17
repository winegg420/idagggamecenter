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

/**
 * Taç: KAFAYA OTURAN KAPALI altın halka (iç + dış yüzey, üst/alt bant) + 5 kapalı diş. Yuva uzayı (kafa merkezi
 * −0,22 y). Paket 21 §F'de yeniden kuruldu: eski taç kafanın 4,2-10,1 cm üstünde havada duruyordu (temas %0) ve
 * iki ayrı açık kabuktu (4 delik döngüsü, 688-1043 cm²). Yarıçap, insan kafa elipsoidinden (yatay 0,235 · dikey
 * 0,2397) türetilir; kaplan/robot farkı `ekMatris` içinde tür ölçeğiyle kapanır.
 */
export function tacGeometrisi(H) {
  const U = [], n = 10, ALT = 0.10, UST = 0.163, KAL = 0.013, DIS_UC = 0.235, PAY = 0.020;
  const kafaR = (y) => 0.235 * Math.sqrt(Math.max(0.03, 1 - (y / 0.2397) ** 2)) + PAY;
  const M = -0.22;   // kafa merkezi yuva uzayında
  const P = (a, r, y) => [Math.cos(a) * r, M + y, Math.sin(a) * r];
  const dort = (a, b, c, d) => { U.push(a, b, c, a, c, d); };
  const rAlt = kafaR(ALT), rUst = kafaR(UST);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    dort(P(a1, rAlt + KAL, ALT), P(a1, rUst + KAL, UST), P(a0, rUst + KAL, UST), P(a0, rAlt + KAL, ALT));   // dış yüzey
    dort(P(a0, rAlt, ALT), P(a0, rUst, UST), P(a1, rUst, UST), P(a1, rAlt, ALT));                           // iç yüzey (gövdeye bakar)
    dort(P(a0, rUst, UST), P(a0, rUst + KAL, UST), P(a1, rUst + KAL, UST), P(a1, rUst, UST));               // üst bant
    dort(P(a1, rAlt, ALT), P(a1, rAlt + KAL, ALT), P(a0, rAlt + KAL, ALT), P(a0, rAlt, ALT));               // alt bant
    if (i % 2 === 0) {
      // diş: üst bandın üstünde kapalı piramit (taban dörtgen + 4 yan yüz)
      const am = (a0 + a1) / 2;
      const t = [P(a0, rUst, UST), P(a0, rUst + KAL, UST), P(a1, rUst + KAL, UST), P(a1, rUst, UST)];
      const uc = P(am, kafaR(DIS_UC * 0.9) + KAL / 2, DIS_UC);
      dort(t[0], t[3], t[2], t[1]);   // taban (aşağı bakar)
      for (let k = 0; k < 4; k++) U.push(t[k], t[(k + 1) % 4], uc);
    }
  }
  return ekGeometri(U, H.altin, new THREE.Color(1.45, 1.3, 1.0), TAC_BOLGE);   // altın hücresi metal ışıkta koyu kalıyordu
}

/**
 * Pelerin: omuz hattından (yerel y = 0) sarkan KAPALI kumaş kabuk — gövdeye bakan iç yüzey, dış yüzey ve dört
 * kenar bandı. Paket 21 §F'de yeniden kuruldu: eski pelerin iki ayrı levhaydı (hacimsiz, 0,54 m² × 2 açık kenar)
 * ve sırttan 4,0-4,9 cm geride duruyordu — "boyna bağlanmış, havada uçuyor" görüntüsünün sebebi buydu (ölçüldü:
 * gövde sırtı yerel uzayda omuzda z ≈ +0,02, bel hizasında z ≈ −0,05; pelerin z = −0,02'de sabitti).
 * İç yüzey üstte gövdeyi takip eder, aşağı indikçe etek açılır.
 */
export function pelerinGeometrisi(H) {
  const U = [], sat = 5, sut = 6, boy = 0.92, KAL = 0.014;
  const dort = (a, b, c, d) => { U.push(a, c, b, a, d, c); };
  /** @param {number} i sütun 0..sut  @param {number} j satır 0..sat  @param {boolean} ic gövdeye bakan yüzey mi */
  const P = (i, j, ic) => {
    const t = j / sat, u = i / sut - 0.5;
    const gen = 0.42 + 0.34 * t;                                  // omuzda 42 cm, etekte 76 cm
    const x = u * gen;
    const omuz = 1 - (2 * u) ** 2;                                // ortada 1, uçlarda 0
    const y = -boy * t - (1 - omuz) * 0.05 * (1 - t);             // omuz uçları hafif aşağı
    const z = 0.02 - 0.11 * t * t - omuz * 0.035 * (1 - t) + (ic ? 0 : -KAL);   // gövdeyi takip eder, sonra açılır
    return [x, y, z];
  };
  for (let j = 0; j < sat; j++) for (let i = 0; i < sut; i++) {
    dort(P(i, j, true), P(i + 1, j, true), P(i + 1, j + 1, true), P(i, j + 1, true));      // iç yüzey (gövdeye bakar)
    dort(P(i, j + 1, false), P(i + 1, j + 1, false), P(i + 1, j, false), P(i, j, false));  // dış yüzey
  }
  for (let i = 0; i < sut; i++) {   // üst ve alt kenar bantları
    dort(P(i, 0, false), P(i + 1, 0, false), P(i + 1, 0, true), P(i, 0, true));
    dort(P(i, sat, true), P(i + 1, sat, true), P(i + 1, sat, false), P(i, sat, false));
  }
  for (let j = 0; j < sat; j++) {   // iki yan kenar bandı
    dort(P(0, j, true), P(0, j + 1, true), P(0, j + 1, false), P(0, j, false));
    dort(P(sut, j, false), P(sut, j + 1, false), P(sut, j + 1, true), P(sut, j, true));
  }
  return ekGeometri(U, H.tisort, PELERIN_RENK, PELERIN_BOLGE);
}

/** Kod kozmetiği → bağlandığı yuva (karakter GLB'sindeki boş düğüm). */
export const EK_YUVA = { tac: "basYuva", pelerin: "sirtYuva" };
export const PELERIN_KAYDIR = new THREE.Vector3(0, 0.52, 0);   // sirtYuva (0,94 m) → omuz hattı (~1,44 m); §F: z ötelemesi kalktı, sırt eğrisi geometride
/** Taç tür ölçeği [yatay, dikey] — kafa yarı eksen oranları (insan 0,235 / 0,2397 taban). */
export const TAC_TUR_OLCEK = { insan: [1, 1], kaplan: [0.99, 0.96], robot: [0.915, 0.80] };

/** Pelerinin durağan açısı (hız 0, salınım ortası) — muayene bu pozu ölçer. */
export const PELERIN_DURGUN_ACI = 0.06;

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _bir = new THREE.Vector3(1, 1, 1), _m2 = new THREE.Matrix4();
/**
 * Yuvanın dünya matrisinden kozmetiğin örnek matrisi (oyun her karede, muayene bir kez çağırır).
 * @param {"tac"|"pelerin"} ad  @param {THREE.Matrix4} yuvaDunya  @param {{ aci?: number, kisa?: boolean }} o  @param {THREE.Matrix4} hedef
 */
export function ekMatris(ad, yuvaDunya, { aci = PELERIN_DURGUN_ACI, kisa = false, tur = "insan" } = {}, hedef = new THREE.Matrix4()) {
  yuvaDunya.decompose(_p, _q, _s);
  hedef.compose(_p, _q, _bir);
  if (ad === "tac") {
    // Geometri insan kafasına göre çizilir; kaplan kafası geniş, robotunki basık. Aynı InstancedMesh, tür ölçeği
    // burada (kafa merkezi yuva uzayında −0,22 y). Ölçüldü: ölçeksiz taç robotta 1,7 cm havada kalıyordu.
    const t = TAC_TUR_OLCEK[tur] ?? TAC_TUR_OLCEK.insan;
    hedef.multiply(_m2.makeTranslation(0, -0.22, 0));
    hedef.multiply(_m2.makeScale(t[0], t[1], t[0]));
    hedef.multiply(_m2.makeTranslation(0, 0.22, 0));
  }
  if (ad === "pelerin") {
    hedef.multiply(_m2.makeTranslation(PELERIN_KAYDIR.x, PELERIN_KAYDIR.y, PELERIN_KAYDIR.z));
    hedef.multiply(_m2.makeRotationX(-aci)).multiply(_m2.makeScale(1, kisa ? 0.58 : 1, 1));
  }
  return hedef;
}
