// Prosedürel gerçekçi araç gövdesi üreteci.
//
// Neden prosedürel: girişsiz+CC0+otomatik indirilebilir GERÇEKÇİ araç model seti pratikte yok
// (PROGRESS: Sketchfab 401, Kenney/Quaternius low-poly "oyuncak" kalıyor). Bu üreteç her kategori
// için pürüzsüz spline yan-profil → yuvarlatılmış ekstrüzyon gövde + koyu cam kabin + çamurluk
// kavisleri + telli jant/fren diski + LED far/stop üretir. ~2-4k üçgen/araç (mobil dostu),
// telif sorunu sıfır, marka-belirsiz.
//
// Eksen düzeni: +X ileri, +Y yukarı, +Z sağ (CarModel dış uzayıyla aynı — GLB döndürmesi gerekmez).
// Malzemeler atanmaz; her mesh'e userData.role verilir, CarModel kişiselleştirmeye göre malzeme bağlar.
// Roller: paint | glass | dark | rim | tire | disc | caliper | head | tail | drl
// Tekerlek pivotları: userData.wheel = { front: boolean } (kendi ekseninde döner).

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BodyStyle =
  | 'hyper'
  | 'super'
  | 'coupe'
  | 'muscle'
  | 'sedan'
  | 'hatch'
  | 'roadster'
  | 'suv'
  | 'offroad'
  | 'pickup'
  | 'cyber'
  | 'van';

/** Ön yüz karakteri — gerçek araç sınıflarının tanınır "yüzü" */
export type FaceKind = 'sport' | 'muscle' | 'classic' | 'ev' | 'offroad' | 'cyber';

/** Araca özgü imza parçalar (gerçek muadillerini çağrıştıran detaylar) */
export type FeatKind =
  | 'wing' // büyük sabit arka kanat (hiper/track aracı)
  | 'hoodScoop' // kaput hava girişi (kas)
  | 'roofScoop' // tavan hava girişi (orta motorlu süper)
  | 'sideIntake' // arka çamurluk önü yan hava girişi (orta motor)
  | 'spare' // arkaya monte yedek teker (arazi)
  | 'roofRack' // tavan port bagajı (arazi/macera)
  | 'twoToneRoof' // kontrast (koyu) tavan (kompakt/klasik)
  | 'ducktail'; // kısa ördek kuyruğu bagaj dudağı (spor klasik)

export interface BodySpec {
  style: BodyStyle;
  /** toplam uzunluk (m) */
  L: number;
  /** toplam genişlik (m) */
  W: number;
  /** tekerlek yarıçapı (m) */
  wheelR: number;
  /** ön yüz karakteri (verilmezse stilin varsayılanı) */
  face?: FaceKind;
  /** imza parçalar */
  feat?: FeatKind[];
}

interface StyleDef {
  /** gövde yan profili — normalize x (-1 arka … +1 ön), y metre (yerden). Beltline dahil ÜST hat. */
  top: [number, number][];
  /** gövde taban yüksekliği (yerden, m) */
  floor: number;
  /** kabin (cam) profili — normalize x, y metre. Boşsa kabin yok (roadster açık). */
  cabin: [number, number][];
  /** kabin genişlik oranı (gövdeye göre, tumblehome) */
  cabinW: number;
  /** kabin taban yüksekliği (beltline) */
  belt: number;
  /** aks konumları (normalize x) */
  axles: [number, number];
  /** tekerlek genişliği (m) */
  wheelW: number;
  /** jant oranı (tekerlek yarıçapına göre) */
  rimRatio: number;
  /** çamurluk kavisi kalınlığı (0 = yok) */
  flare: number;
  /** arka difüzör (spor) */
  diffuser: boolean;
  /** varsayılan ön yüz karakteri */
  face: FaceKind;
  /** beltline kabartması (0..~0.08) — yan yüzeye omuz çizgisi verir, "tüp" görünümünü kırar */
  crease: number;
  /** keskin (spline'sız) profil — cybertruck tarzı düz kırık hatlar */
  sharpProfile?: boolean;
  /** kabin üstüne boyalı tavan + sütun (A/B/C) eklenmesin (roadster açık, cyber tek kama) */
  noPillars?: boolean;
}

// Her stil elle ayarlanmış gerçek araç oranlarıyla (görsel readPixels doğrulamalı).
const STYLES: Record<BodyStyle, StyleDef> = {
  // çok alçak kama — çamurluk kabartılı, burun jilet
  hyper: {
    top: [[-1, 0.7], [-0.62, 0.78], [-0.25, 0.6], [0.15, 0.55], [0.62, 0.74], [1, 0.42]],
    floor: 0.14,
    cabin: [[-0.52, 0.76], [-0.18, 0.98], [0.22, 0.96], [0.52, 0.58]],
    cabinW: 0.76,
    belt: 0.62,
    axles: [-0.62, 0.62],
    wheelW: 0.34,
    rimRatio: 0.72,
    flare: 0.05,
    diffuser: true,
    face: 'sport',
    crease: 0.055,
  },
  // orta-motor süper: kavisli, alçak, ön çamurluk kabartısı
  super: {
    top: [[-1, 0.78], [-0.64, 0.86], [-0.26, 0.68], [0.14, 0.6], [0.6, 0.78], [1, 0.4]],
    floor: 0.16,
    cabin: [[-0.5, 0.84], [-0.14, 1.06], [0.2, 1.02], [0.5, 0.64]],
    cabinW: 0.8,
    belt: 0.68,
    axles: [-0.6, 0.6],
    wheelW: 0.32,
    rimRatio: 0.7,
    flare: 0.045,
    diffuser: true,
    face: 'sport',
    crease: 0.05,
  },
  // spor coupe: fastback
  coupe: {
    top: [[-1, 0.86], [-0.64, 0.94], [-0.2, 0.82], [0.3, 0.76], [0.62, 0.78], [1, 0.52]],
    floor: 0.2,
    cabin: [[-0.62, 0.9], [-0.2, 1.22], [0.16, 1.18], [0.5, 0.8]],
    cabinW: 0.84,
    belt: 0.84,
    axles: [-0.6, 0.6],
    wheelW: 0.3,
    rimRatio: 0.68,
    flare: 0.04,
    diffuser: true,
    face: 'sport',
    crease: 0.045,
  },
  // kas: uzun kaput, yüksek bagaj, dik arka
  muscle: {
    top: [[-1, 0.94], [-0.7, 1.0], [-0.3, 0.92], [0.2, 0.86], [0.65, 0.84], [1, 0.7]],
    floor: 0.22,
    cabin: [[-0.66, 0.98], [-0.3, 1.28], [0.02, 1.26], [0.34, 0.9]],
    cabinW: 0.86,
    belt: 0.92,
    axles: [-0.6, 0.58],
    wheelW: 0.32,
    rimRatio: 0.64,
    flare: 0.055,
    diffuser: false,
    face: 'muscle',
    crease: 0.06,
  },
  // klasik 3 kutu sedan
  sedan: {
    top: [[-1, 0.98], [-0.72, 1.02], [-0.3, 0.94], [0.25, 0.9], [0.7, 0.86], [1, 0.72]],
    floor: 0.24,
    cabin: [[-0.7, 1.0], [-0.34, 1.38], [0.14, 1.36], [0.52, 0.92]],
    cabinW: 0.87,
    belt: 0.96,
    axles: [-0.58, 0.58],
    wheelW: 0.26,
    rimRatio: 0.62,
    flare: 0.03,
    diffuser: false,
    face: 'classic',
    crease: 0.04,
  },
  // kompakt 2 kutu hatchback — kısa arka, dik bagaj kapağı
  hatch: {
    top: [[-1, 1.2], [-0.75, 1.24], [-0.3, 1.0], [0.3, 0.92], [0.72, 0.86], [1, 0.7]],
    floor: 0.24,
    cabin: [[-0.88, 1.24], [-0.62, 1.42], [0.08, 1.4], [0.5, 0.94]],
    cabinW: 0.87,
    belt: 0.98,
    axles: [-0.56, 0.58],
    wheelW: 0.24,
    rimRatio: 0.66,
    flare: 0.03,
    diffuser: false,
    face: 'classic',
    crease: 0.04,
  },
  // roadster: alçak, küçük ön cam, açık üst
  roadster: {
    top: [[-1, 0.8], [-0.64, 0.88], [-0.2, 0.78], [0.24, 0.72], [0.58, 0.74], [1, 0.5]],
    floor: 0.19,
    cabin: [[-0.28, 0.84], [-0.1, 1.04], [0.08, 1.02], [0.2, 0.78]],
    cabinW: 0.82,
    belt: 0.78,
    axles: [-0.56, 0.56],
    wheelW: 0.28,
    rimRatio: 0.66,
    flare: 0.04,
    diffuser: false,
    face: 'sport',
    crease: 0.045,
    noPillars: true, // açık üst — tavan/sütun yok, mini ön cam camdan
  },
  // SUV: uzun tavan, yüksek
  suv: {
    top: [[-1, 1.3], [-0.7, 1.34], [-0.2, 1.18], [0.35, 1.1], [0.75, 1.04], [1, 0.86]],
    floor: 0.34,
    cabin: [[-0.9, 1.32], [-0.68, 1.66], [0.24, 1.64], [0.62, 1.12]],
    cabinW: 0.88,
    belt: 1.14,
    axles: [-0.58, 0.6],
    wheelW: 0.28,
    rimRatio: 0.66,
    flare: 0.05,
    diffuser: false,
    face: 'classic',
    crease: 0.05,
  },
  // arazi: kutu gibi, büyük teker, belirgin flare
  offroad: {
    top: [[-1, 1.38], [-0.72, 1.42], [-0.25, 1.34], [0.4, 1.26], [0.78, 1.22], [1, 1.02]],
    floor: 0.44,
    cabin: [[-0.88, 1.4], [-0.7, 1.78], [0.3, 1.76], [0.6, 1.28]],
    cabinW: 0.9,
    belt: 1.22,
    axles: [-0.58, 0.6],
    wheelW: 0.34,
    rimRatio: 0.56,
    flare: 0.09,
    diffuser: false,
    face: 'offroad',
    crease: 0.05,
  },
  // pickup: kabin önde + açık kasa
  pickup: {
    top: [[-1, 1.12], [-0.12, 1.12], [-0.1, 1.3], [0.35, 1.26], [0.78, 1.2], [1, 1.0]],
    floor: 0.4,
    cabin: [[-0.06, 1.32], [0.06, 1.74], [0.42, 1.72], [0.62, 1.28]],
    cabinW: 0.9,
    belt: 1.24,
    axles: [-0.58, 0.6],
    wheelW: 0.32,
    rimRatio: 0.58,
    flare: 0.08,
    diffuser: false,
    face: 'offroad',
    crease: 0.05,
  },
  // e-pickup kaması: tek kırık hat, keskin yüzeyler (paslanmaz kama karakteri)
  cyber: {
    top: [[-1, 1.24], [-0.18, 1.68], [0.32, 1.5], [0.75, 1.24], [1, 1.06]],
    floor: 0.42,
    cabin: [[-0.14, 1.62], [0.22, 1.46], [0.6, 1.2]],
    cabinW: 0.9,
    belt: 1.18,
    axles: [-0.58, 0.6],
    wheelW: 0.34,
    rimRatio: 0.56,
    flare: 0.09,
    diffuser: false,
    face: 'cyber',
    crease: 0,
    sharpProfile: true,
    noPillars: true,
  },
  // van/ambulans: tam boy yüksek kutu
  van: {
    top: [[-1, 1.9], [-0.2, 1.92], [0.3, 1.86], [0.62, 1.5], [0.85, 1.2], [1, 1.02]],
    floor: 0.36,
    cabin: [[0.32, 1.84], [0.42, 1.84], [0.62, 1.48], [0.7, 1.24]],
    cabinW: 0.92,
    belt: 1.2,
    axles: [-0.56, 0.6],
    wheelW: 0.28,
    rimRatio: 0.56,
    flare: 0.04,
    diffuser: false,
    face: 'classic',
    crease: 0.03,
    noPillars: true, // gövde kutusu zaten tavan — cam üstüne panel/sütun eklenmez
  },
};

// --- yardımcılar ---

function role(mesh: THREE.Mesh, r: string): THREE.Mesh {
  mesh.userData.role = r;
  return mesh;
}

/** Geometriyi birleştirmeye hazırla: non-indexed + yalnız position/normal + dönüşüm uygulanmış. */
function bakeGeo(geo: THREE.BufferGeometry, mat: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.applyMatrix4(mat);
  return g;
}

/**
 * PERFORMANS: statik mesh'leri role bazında TEK geometriye birleştirir.
 * Birleştirme öncesi araç ~76 mesh (jant telleri, tamponlar, arch diskleri...) → yüzlerce draw
 * call = mobilde/PC'de kasma. Sonrası: rol başına 1 mesh (~6 statik + tekerlekler).
 */
function consolidateStatic(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const byRole = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // tekerlek altları hariç (dönen parçalar ayrı kalmalı)
    for (let p = o.parent; p; p = p.parent) {
      if (p.userData.wheelHolder || p.userData.wheel) return;
    }
    const r = (m.userData.role as string) || 'dark';
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(m);
  });
  for (const [r, meshes] of byRole) {
    const merged = mergeGeometries(meshes.map((m) => bakeGeo(m.geometry, m.matrixWorld)), false);
    for (const m of meshes) m.parent?.remove(m);
    if (merged) root.add(role(new THREE.Mesh(merged), r));
  }
}

/**
 * LOFT gövde: yan profil spline'ı boyunca süperelips kesit süpürme.
 * ExtrudeGeometry bevel'inin keskin köşe "diken" artefaktı yok; plan görünümünde burun/kuyruk
 * doğal incelir (gerçek araba gövdesi gibi), her yerde pürüzsüz normal.
 */
function loftBody(
  pts: [number, number][],
  floorY: number,
  L: number,
  W: number,
  sectionPow = 4,
  opts?: { beltY?: number; crease?: number; sharp?: boolean },
): THREE.BufferGeometry {
  const half = L / 2;
  // profil örnekle (x'e göre monoton) → dilim başına üst yükseklik
  // sharp: spline YOK — kontrol noktaları arası düz çizgi (cybertruck kama karakteri)
  const prof = opts?.sharp
    ? pts.map(([nx, y]) => new THREE.Vector2(nx * half, y))
    : new THREE.SplineCurve(pts.map(([nx, y]) => new THREE.Vector2(nx * half, y))).getPoints(140);
  const topAt = (x: number): number => {
    if (x <= prof[0].x) return prof[0].y;
    for (let i = 1; i < prof.length; i++) {
      if (prof[i].x >= x) {
        const a = prof[i - 1];
        const b = prof[i];
        const t = b.x - a.x < 1e-6 ? 0 : (x - a.x) / (b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return prof[prof.length - 1].y;
  };
  const beltY = opts?.beltY ?? 0;
  const crease = opts?.crease ?? 0;

  // sharp: az dilim + kırık normal → düz metal facet karakteri; normal: yoğun + pürüzsüz
  const N = opts?.sharp ? 22 : 42; // boyuna dilim
  const M = opts?.sharp ? 16 : 26; // kesit çevre segmenti
  const pos: number[] = [];
  const idx: number[] = [];
  const x0 = pts[0][0] * half;
  const x1 = pts[pts.length - 1][0] * half;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = x0 + (x1 - x0) * u;
    const uEnd = Math.abs(2 * u - 1); // 0 orta → 1 uç
    // plan taper: burun/kuyrukta daralt (ön %20, arka %12)
    const endScale = u > 0.5 ? 0.8 : 0.88;
    const w = (W / 2) * (1 + (endScale - 1) * Math.pow(uEnd, 2.3));
    // yaklaşma açıları: taban uçlara doğru hafif yükselir
    const yBot = floorY + Math.max(0, uEnd - 0.78) * 0.5 * (topAt(x) - floorY) * 0.4;
    const yTop = Math.max(topAt(x), yBot + 0.06);
    const cy = (yTop + yBot) / 2;
    const ry = (yTop - yBot) / 2;
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      let sz = Math.sign(c) * Math.pow(Math.abs(c), 2 / sectionPow) * w;
      const sy = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / sectionPow) * ry;
      // beltline kabartması: omuz hizasında yan yüzey dışarı taşar (gerçek kaporta omuz çizgisi);
      // uçlara doğru söner (tampon bölgesinde kabartı olmaz)
      if (crease > 0) {
        const d = (sy - beltY) / 0.17;
        sz *= 1 + crease * Math.exp(-d * d) * (1 - Math.pow(uEnd, 3));
      }
      pos.push(x, sy, sz);
    }
  }
  // yüzey indeksleri (halka sarımı)
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // uç kapakları (fan)
  const rearCenter = pos.length / 3;
  pos.push(x0, (topAt(x0) + floorY) / 2, 0);
  const frontCenter = rearCenter + 1;
  pos.push(x1, (topAt(x1) + floorY) / 2, 0);
  for (let j = 0; j < M; j++) {
    idx.push(rearCenter, j, (j + 1) % M);
    const base = N * M;
    idx.push(frontCenter, base + ((j + 1) % M), base + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // sharp: yumuşatılmış tüp yerine kırık düz yüzeyler (paslanmaz kama görünümü)
  if (opts?.sharp) return toCreasedNormals(geo, THREE.MathUtils.degToRad(24));
  return geo;
}

/** Yuvarlatılmış kutu (RoundedBox yerine hafif: bevelli extrude). */
function roundedBox(l: number, h: number, w: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hl = l / 2 - r;
  const hh = h / 2 - r;
  s.moveTo(-hl, -h / 2);
  s.lineTo(hl, -h / 2);
  s.quadraticCurveTo(l / 2, -h / 2, l / 2, -hh);
  s.lineTo(l / 2, hh);
  s.quadraticCurveTo(l / 2, h / 2, hl, h / 2);
  s.lineTo(-hl, h / 2);
  s.quadraticCurveTo(-l / 2, h / 2, -l / 2, hh);
  s.lineTo(-l / 2, -hh);
  s.quadraticCurveTo(-l / 2, -h / 2, -hl, -h / 2);
  const depth = Math.max(0.02, w - r * 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r * 0.9,
    bevelOffset: -r * 0.9,
    bevelSegments: 2,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return toCreasedNormals(g, THREE.MathUtils.degToRad(50));
}

/**
 * Detaylı tekerlek: lastik + jant + 6 tel (+ detaylı modda fren diski/kaliper). Pivot kendi merkezinde.
 * @param outSgn +1 sağ / -1 sol — jant yüzü aracın DIŞ tarafına bakar (görünür olsun)
 * @param detail bot/uzak oyuncu için false → daha az mesh
 */
function buildWheel(r: number, w: number, rimRatio: number, front: boolean, outSgn: number, detail: boolean): THREE.Group {
  const g = new THREE.Group();
  g.userData.wheel = { front };
  const rimR = r * rimRatio;
  const face = outSgn * w * 0.42; // jant yüzü lastik dış kenarında (GÖRÜNÜR)
  const M = new THREE.Matrix4();

  // PERFORMANS: parçalar rol bazında TEK geometriye bake edilir (11 mesh → 2-4 mesh/tekerlek)
  // lastik: HALKA (torus, ortası açık) + jant arka kapağı → tek 'tire' mesh
  const tireTube = (r - rimR) / 2;
  const tireGeos = [
    bakeGeo(new THREE.TorusGeometry(r - tireTube, tireTube, 10, 26), M.makeScale(1, 1, w / (tireTube * 2))),
    bakeGeo(new THREE.CylinderGeometry(rimR * 1.02, rimR * 1.02, w * 0.4, 20).rotateX(Math.PI / 2), M.identity()),
  ];
  g.add(role(new THREE.Mesh(mergeGeometries(tireGeos, false)!), 'tire'));

  // jant: göbek + çember + 6 tel → tek 'rim' mesh (dış yüzde)
  const rimGeos = [
    bakeGeo(new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.3, w * 0.2, 14).rotateX(Math.PI / 2), M.makeTranslation(0, 0, face)),
    bakeGeo(new THREE.TorusGeometry(rimR * 0.9, r * 0.055, 8, 22), M.makeTranslation(0, 0, face)),
  ];
  for (let i = 0; i < 6; i++) {
    rimGeos.push(
      bakeGeo(
        new THREE.BoxGeometry(rimR * 0.26, rimR * 1.72, r * 0.09).rotateZ((i / 6) * Math.PI),
        M.makeTranslation(0, 0, face),
      ),
    );
  }
  g.add(role(new THREE.Mesh(mergeGeometries(rimGeos, false)!), 'rim'));

  // fren diski + kaliper (tellerin gerisinde görünür) — yalnızca detaylı modda
  if (detail) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.72, rimR * 0.72, w * 0.06, 20));
    disc.geometry.rotateX(Math.PI / 2);
    disc.position.z = face * 0.55;
    role(disc, 'disc');
    g.add(disc);
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(rimR * 0.46, rimR * 0.34, w * 0.14));
    caliper.position.set(front ? rimR * 0.48 : -rimR * 0.48, 0, face * 0.55);
    role(caliper, 'caliper');
    g.add(caliper);
  }
  return g;
}

/**
 * Aracın tamamını üretir. Dönen grup +X ileri bakar, tekerlekler y=0 zemine oturur.
 * Malzemeler CarModel tarafından userData.role'a göre atanır.
 * @param detail false → bot/uzak oyuncu (fren diski/kaliper yok, daha az mesh)
 */
function buildCarBodyRaw(spec: BodySpec, detail: boolean): THREE.Group {
  const def = STYLES[spec.style];
  const { L, W, wheelR } = spec;
  const root = new THREE.Group();
  const half = L / 2;
  const toX = (nx: number) => nx * half;

  // --- gövde kabuğu (loft) — spor gövdeler daha yuvarlak kesit, kutu gövdeler daha köşeli ---
  const boxy = spec.style === 'offroad' || spec.style === 'van' || spec.style === 'pickup' || spec.style === 'cyber';
  const body = new THREE.Mesh(
    loftBody(def.top, def.floor, L, W, boxy ? 6 : 3.6, {
      beltY: def.belt * 0.9, // omuz çizgisi beltline'ın hemen altında
      crease: def.crease,
      sharp: def.sharpProfile,
    }),
  );
  role(body, 'paint');
  root.add(body);

  // gövde üst profil y değeri (normalize x'te, lineer interp) — cam/scoop yerleşimi için
  const profY = (nx: number): number => {
    const p = def.top;
    if (nx <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (p[i][0] >= nx) {
        const t = (nx - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      }
    }
    return p[p.length - 1][1];
  };

  // --- kabin ---
  if (def.sharpProfile && def.cabin.length >= 2) {
    // keskin kama: kanopi yerine ön eğime YATIK cam paneli (gerçek kama tasarımındaki gibi
    // ön cam gövde yüzeyinin parçasıdır) — konum GÖVDE PROFİLİNDEN alınır, gömülü kalmaz
    const nx0 = def.cabin[0][0];
    const nx1 = def.cabin[def.cabin.length - 1][0];
    const p0 = new THREE.Vector2(toX(nx0), profY(nx0));
    const p1 = new THREE.Vector2(toX(nx1), profY(nx1));
    const len = p0.distanceTo(p1);
    const ws = new THREE.Mesh(roundedBox(len, 0.05, W * 0.78, 0.02));
    ws.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + 0.025, 0);
    ws.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    role(ws, 'glass');
    root.add(ws);
  } else if (def.cabin.length >= 3) {
    const cabinShape = new THREE.Shape();
    const c = def.cabin;
    cabinShape.moveTo(toX(c[0][0]), def.belt - 0.06);
    const cp = c.map(([nx, y]) => new THREE.Vector2(toX(nx), y));
    cabinShape.splineThru([cp[0].clone(), ...cp, cp[cp.length - 1].clone()]);
    cabinShape.lineTo(toX(c[c.length - 1][0]), def.belt - 0.06);
    cabinShape.closePath();
    const cabinW = W * def.cabinW;
    const cbev = Math.min(0.07, cabinW * 0.08);
    const cg = new THREE.ExtrudeGeometry(cabinShape, {
      depth: cabinW - cbev * 2,
      bevelEnabled: true,
      bevelThickness: cbev,
      bevelSize: cbev * 0.9,
      bevelOffset: -cbev * 0.9,
      bevelSegments: 2,
      curveSegments: 8,
    });
    cg.translate(0, 0, -(cabinW - cbev * 2) / 2);
    // tumblehome: cam yanları yukarı doğru içe eğilir (gerçek kabin + gövdeyle eş-düzlem
    // z-fighting'i önler)
    const roofTop = Math.max(...c.map((p) => p[1]));
    const posAttr = cg.getAttribute('position');
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const t = Math.max(0, Math.min(1, (y - (def.belt - 0.06)) / Math.max(0.01, roofTop - def.belt)));
      posAttr.setZ(i, posAttr.getZ(i) * (1 - 0.24 * t));
    }
    posAttr.needsUpdate = true;
    const cabin = new THREE.Mesh(toCreasedNormals(cg, THREE.MathUtils.degToRad(44)));
    role(cabin, 'glass');
    root.add(cabin);

    // --- boyalı tavan + A/B/C sütunları ---
    // Kabin tek cam fanus olarak kalırsa araç "oyuncak kapsül" okunur; gerçek araçta tavan
    // kaporta rengidir, camlar sütunlarla bölünür. En büyük gerçekçilik kazancı budur.
    if (!def.noPillars && c.length >= 4) {
      const roofRole = spec.feat?.includes('twoToneRoof') ? 'dark' : 'paint';
      const glassTopW = W * def.cabinW * (1 - 0.24); // tumblehome sonrası tavan genişliği
      // tavan paneli: arka-üst (c[1]) → ön-üst (c[2]) doğrultusunda eğimli ince kapak
      const r0 = new THREE.Vector2(toX(c[1][0]), c[1][1]);
      const r1 = new THREE.Vector2(toX(c[2][0]), c[2][1]);
      const roofLen = r0.distanceTo(r1) + 0.1;
      const roof = new THREE.Mesh(roundedBox(roofLen, 0.05, glassTopW * 0.9, 0.02));
      roof.position.set((r0.x + r1.x) / 2, (r0.y + r1.y) / 2 + 0.012, 0);
      roof.rotation.z = Math.atan2(r1.y - r0.y, r1.x - r0.x);
      role(roof, roofRole);
      root.add(roof);
      // sütunlar: iki 3D uç noktası TAM cam kenarında hesaplanır, kutu quaternion ile bu
      // doğrultuya hizalanır → tepe/dip hiçbir açıda camdan dışarı taşmaz
      const zSideAt = (y: number, sgn: number): number => {
        const tH = Math.max(0, Math.min(1, (y - def.belt) / Math.max(0.01, roofTop - def.belt)));
        return sgn * ((W * def.cabinW * (1 - 0.24 * tH)) / 2 - 0.035);
      };
      const xAxis = new THREE.Vector3(1, 0, 0);
      const pillar = (
        from: [number, number],
        to: [number, number],
        thick: number,
        pRole: string,
      ) => {
        for (const sgn of [1, -1]) {
          const a = new THREE.Vector3(toX(from[0]), from[1], zSideAt(from[1], sgn));
          const b = new THREE.Vector3(toX(to[0]), to[1], zSideAt(to[1], sgn));
          const dir = b.clone().sub(a);
          const len = dir.length();
          const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1, len - 0.16), thick, 0.07));
          m.position.copy(a.clone().add(b).multiplyScalar(0.5));
          m.quaternion.setFromUnitVectors(xAxis, dir.normalize());
          role(m, pRole);
          root.add(m);
        }
      };
      // Süper/hiper araçta sütunlar blackout (cam bütünü gibi okunur — gerçek süper araç
      // tasarımı); diğerlerinde A/C kaporta rengi, B siyah (modern üretim aracı)
      const sporty = spec.style === 'hyper' || spec.style === 'super';
      pillar(c[c.length - 1], c[c.length - 2], 0.05, sporty ? 'glass' : 'paint'); // A
      pillar(c[0], c[1], 0.06, sporty ? 'glass' : 'paint'); // C
      if (!sporty) {
        const bx = (c[1][0] + c[2][0]) / 2 + (c[2][0] - c[1][0]) * 0.12;
        const bTop = c[1][1] + ((c[2][1] - c[1][1]) * (bx - c[1][0])) / Math.max(0.01, c[2][0] - c[1][0]);
        pillar([bx, def.belt - 0.04], [bx, bTop - 0.03], 0.05, 'dark'); // B
      }
    }
  }

  // --- tekerlekler + çamurluk kavisleri + davlumbaz gölgesi ---
  const [ra, fa] = def.axles;
  const axleY = wheelR;
  for (const [nx, front] of [[ra, false], [fa, true]] as [number, boolean][]) {
    for (const side of [1, -1]) {
      // holder: direksiyon dönüşü (Y) — içindeki spin grubu kendi yanal ekseninde (Z) döner
      const spin = buildWheel(wheelR, def.wheelW, def.rimRatio, front, side, detail);
      const wheel = new THREE.Group();
      wheel.userData.wheelHolder = { front };
      wheel.add(spin);
      // dış yüz gövdeden taşkın — jant/lastik dışarıdan net görünür
      wheel.position.set(toX(nx), axleY, side * (W / 2 - def.wheelW * 0.5 + 0.03));
      root.add(wheel);
      // arch açıklığı diski — tekerleğin hemen gerisinde koyu "çamurluk boşluğu"
      // (yarıçap tekerleğe yakın, yere gömülmesin diye hafif yukarıda)
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 1.06, wheelR * 1.06, 0.025, 24));
      arch.geometry.rotateX(Math.PI / 2);
      arch.position.set(toX(nx), axleY + wheelR * 0.06, side * (W / 2 - 0.005));
      role(arch, 'dark');
      root.add(arch);
      // çamurluk kavisi (yarım torus flare) — arch açıklığını çevreleyen dudak
      if (def.flare > 0.001) {
        const flare = new THREE.Mesh(new THREE.TorusGeometry(wheelR * 1.1, def.flare, 7, 18, Math.PI));
        flare.position.set(toX(nx), axleY + wheelR * 0.04, side * (W / 2 + 0.005));
        flare.rotation.y = side > 0 ? 0 : Math.PI;
        role(flare, spec.style === 'offroad' || spec.style === 'pickup' ? 'dark' : 'paint');
        root.add(flare);
      }
    }
  }

  // --- alt gövde (koyu taban — yerle gövde arasını kapatır; gövde planından TAŞMAZ) ---
  const under = new THREE.Mesh(new THREE.BoxGeometry(L * 0.64, def.floor * 0.8, W * 0.72));
  under.position.set(0, def.floor * 0.5, 0);
  role(under, 'dark');
  root.add(under);

  // --- ön yüz: yüz karakterine göre tampon + ızgara + far tasarımı ---
  // Gerçek araç sınıflarının tanınır "yüzü": spor geniş alçak ağız + çekik far, kas dikey
  // ızgara + çift yuvarlak far, klasik krom bar + dikdörtgen far, EV kapalı burun + tam
  // genişlik ışık barı, arazi dikey dilimli ızgara + yuvarlak far, cyber tek LED şerit.
  const face: FaceKind = spec.face ?? def.face;
  const noseY = def.top[def.top.length - 1][1];
  const frontX = toX(1);
  const noseH = noseY - def.floor;
  const bumper = new THREE.Mesh(roundedBox(0.14, noseH * (face === 'offroad' ? 0.44 : 0.36), W * 0.74, 0.045));
  bumper.position.set(frontX - 0.08, def.floor + noseH * 0.24, 0);
  role(bumper, 'dark');
  root.add(bumper);
  const headY = Math.max(def.floor + 0.2, noseY - 0.15);

  // yuvarlak far merceği (klasik/kas/arazi) — +X yönüne bakan kısa silindir
  const roundLamp = (r: number, x: number, y: number, z: number, lampRole: string) => {
    const g = new THREE.CylinderGeometry(r, r, 0.05, 14).rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g);
    m.position.set(x, y, z);
    role(m, lampRole);
    root.add(m);
    return m;
  };
  const boxPart = (
    lw: number, lh: number, ld: number, x: number, y: number, z: number, pRole: string, rz = 0,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld));
    m.position.set(x, y, z);
    if (rz) m.rotation.z = rz;
    role(m, pRole);
    root.add(m);
    return m;
  };

  if (face === 'sport') {
    // geniş alçak ağız (radyatör) + çekik ince farlar + köşe hava girişleri
    boxPart(0.06, noseH * 0.3, W * 0.5, frontX - 0.03, def.floor + noseH * 0.28, 0, 'dark');
    for (const side of [1, -1]) {
      boxPart(0.05, noseH * 0.2, W * 0.08, frontX - 0.06, def.floor + noseH * 0.26, side * W * 0.3, 'dark');
      // çekik far: içe doğru eğik ince mercek + DRL çizgisi
      boxPart(0.06, 0.055, W * 0.18, frontX - 0.03, headY, side * W * 0.28, 'head', 0);
      boxPart(0.035, 0.016, W * 0.2, frontX - 0.02, headY - 0.05, side * W * 0.28, 'drl');
    }
  } else if (face === 'muscle') {
    // dik koyu ızgara + çift yuvarlak far
    boxPart(0.06, noseH * 0.3, W * 0.36, frontX - 0.03, def.floor + noseH * 0.44, 0, 'dark');
    for (const side of [1, -1]) {
      roundLamp(0.07, frontX - 0.02, headY, side * W * 0.36, 'head');
      roundLamp(0.055, frontX - 0.02, headY, side * W * 0.26, 'head');
    }
  } else if (face === 'classic') {
    // yatay krom bar ızgara + dikdörtgen farlar
    boxPart(0.05, 0.05, W * 0.44, frontX - 0.025, headY - 0.02, 0, 'rim');
    boxPart(0.05, noseH * 0.2, W * 0.4, frontX - 0.035, def.floor + noseH * 0.34, 0, 'dark');
    for (const side of [1, -1]) {
      boxPart(0.07, 0.13, W * 0.21, frontX - 0.045, headY, side * W * 0.3, 'dark');
      boxPart(0.06, 0.09, W * 0.17, frontX - 0.025, headY, side * W * 0.3, 'head');
      boxPart(0.03, 0.018, W * 0.19, frontX - 0.02, headY - 0.085, side * W * 0.3, 'drl');
    }
  } else if (face === 'ev') {
    // kapalı burun (ızgarasız) + TAM genişlik LED ışık barı + ince farlar
    boxPart(0.04, 0.03, W * 0.8, frontX - 0.02, headY + 0.02, 0, 'drl');
    for (const side of [1, -1]) {
      boxPart(0.05, 0.05, W * 0.18, frontX - 0.03, headY - 0.045, side * W * 0.32, 'head');
    }
    // alt tampon nefes girişi (dar, koyu)
    boxPart(0.05, noseH * 0.16, W * 0.4, frontX - 0.03, def.floor + noseH * 0.18, 0, 'dark');
  } else if (face === 'offroad') {
    // dikey dilimli ızgara + yuvarlak farlar + tampon çeki kancaları
    for (let i = -3; i <= 3; i++) {
      boxPart(0.05, noseH * 0.3, 0.045, frontX - 0.03, def.floor + noseH * 0.46, i * W * 0.06, 'dark');
    }
    for (const side of [1, -1]) {
      roundLamp(0.085, frontX - 0.02, headY, side * W * 0.32, 'head');
      boxPart(0.08, 0.07, 0.07, frontX - 0.04, def.floor + noseH * 0.12, side * W * 0.22, 'caliper'); // kırmızı çeki kancası
    }
  } else {
    // cyber: tek parça tam genişlik LED şerit, ızgarasız düz yüz
    boxPart(0.05, 0.035, W * 0.88, frontX - 0.02, noseY - 0.09, 0, 'drl');
    boxPart(0.05, 0.05, W * 0.3, frontX - 0.03, def.floor + noseH * 0.16, 0, 'dark');
  }

  // --- arka yüz: tam genişlik LED stop barı + tampon + difüzör ---
  const tailY = def.top[0][1];
  const rearX = toX(-1);
  const tailBar = new THREE.Mesh(roundedBox(0.05, 0.07, W * 0.68, 0.025));
  tailBar.position.set(rearX + 0.03, def.floor + (tailY - def.floor) * 0.72, 0);
  role(tailBar, 'tail');
  root.add(tailBar);
  const rBumper = new THREE.Mesh(roundedBox(0.12, (tailY - def.floor) * 0.3, W * 0.72, 0.045));
  rBumper.position.set(rearX + 0.09, def.floor + (tailY - def.floor) * 0.2, 0);
  role(rBumper, 'dark');
  root.add(rBumper);
  if (def.diffuser) {
    for (let i = -2; i <= 2; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, def.floor * 0.85, 0.025));
      fin.position.set(rearX + 0.1, def.floor * 0.48, i * W * 0.14);
      role(fin, 'dark');
      root.add(fin);
    }
  }

  // --- pickup kasası: iç boşluk duvarları ---
  if (spec.style === 'pickup') {
    const bedX0 = toX(-0.97);
    const bedX1 = toX(-0.14);
    const bedFloorY = def.belt * 0.62;
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(bedX1 - bedX0, 0.05, W * 0.8));
    bedFloor.position.set((bedX0 + bedX1) / 2, bedFloorY, 0);
    role(bedFloor, 'dark');
    root.add(bedFloor);
    // yan/dip duvar iç yüzeyleri (koyu)
    for (const side of [1, -1]) {
      const wallM = new THREE.Mesh(new THREE.BoxGeometry(bedX1 - bedX0, def.top[0][1] - bedFloorY - 0.06, 0.04));
      wallM.position.set((bedX0 + bedX1) / 2, (bedFloorY + def.top[0][1]) / 2 - 0.02, side * W * 0.4);
      role(wallM, 'dark');
      root.add(wallM);
    }
  }

  // --- yan etek (alt koyu şerit) ---
  for (const side of [1, -1]) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.06, 0.03));
    sk.position.set(toX((ra + fa) / 2), def.floor + 0.03, side * (W / 2 - 0.015));
    role(sk, 'dark');
    root.add(sk);
  }

  // --- imza parçalar (araca özgü, gerçek muadili çağrıştıran detaylar) ---
  const feats = spec.feat ?? [];
  if (feats.includes('wing')) {
    // büyük sabit yarış kanadı: iki pilon + geniş kanat + uç plakaları
    const deckY = def.top[0][1];
    const wx = toX(-0.88);
    const wy = deckY + 0.32;
    boxPart(0.34, 0.05, W * 0.96, wx, wy, 0, 'dark', 0.1);
    for (const side of [1, -1]) {
      boxPart(0.08, 0.3, 0.05, wx + 0.02, deckY + 0.16, side * W * 0.3, 'dark');
      boxPart(0.3, 0.14, 0.02, wx, wy + 0.02, side * W * 0.48, 'dark', 0.1); // uç plakası
    }
  }
  if (feats.includes('hoodScoop')) {
    const hy = profY(0.45);
    boxPart(0.52, 0.1, W * 0.2, toX(0.42), hy + 0.02, 0, 'dark', -0.04);
  }
  if (feats.includes('roofScoop') && def.cabin.length) {
    // kabin arkası tavan hava girişi (orta motorlu süper)
    const sx = def.cabin[0][0] - 0.07;
    boxPart(0.34, 0.1, W * 0.16, toX(sx), profY(sx) + 0.05, 0, 'dark');
  }
  if (feats.includes('sideIntake')) {
    // arka çamurluk önü koyu hava girişi (orta motor imzası)
    const ix = toX(ra) + spec.wheelR + 0.42;
    const iy = def.belt * 0.72;
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.05));
      m.position.set(ix, iy, side * (W / 2 + def.crease * W * 0.4 - 0.01));
      m.rotation.x = side * -0.12; // yüzeye yaslanan hafif eğim
      role(m, 'dark');
      root.add(m);
    }
  }
  if (feats.includes('spare')) {
    // arkaya monte yedek teker (arazi imzası)
    const sy = def.belt * 0.92;
    const sx = toX(-1) - 0.1;
    const tire = new THREE.Mesh(new THREE.TorusGeometry(wheelR * 0.62, wheelR * 0.3, 8, 18).rotateY(Math.PI / 2));
    tire.position.set(sx, sy, 0);
    role(tire, 'tire');
    root.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.42, wheelR * 0.42, 0.1, 12).rotateZ(Math.PI / 2));
    hub.position.set(sx, sy, 0);
    role(hub, 'rim');
    root.add(hub);
  }
  if (feats.includes('roofRack') && def.cabin.length >= 4) {
    // tavan port bagajı: iki boyuna ray + çapraz barlar
    const c = def.cabin;
    const x0 = toX(c[1][0]) + 0.1;
    const x1 = toX(c[2][0]) - 0.1;
    const ry = Math.max(c[1][1], c[2][1]) + 0.09;
    const rz = (W * def.cabinW * (1 - 0.24)) / 2 - 0.06;
    for (const side of [1, -1]) {
      boxPart(Math.abs(x1 - x0), 0.05, 0.05, (x0 + x1) / 2, ry, side * rz, 'dark');
    }
    for (let i = 0; i < 3; i++) {
      boxPart(0.05, 0.04, rz * 2, x0 + ((x1 - x0) * (i + 0.5)) / 3, ry, 0, 'dark');
    }
  }
  if (feats.includes('ducktail')) {
    boxPart(0.2, 0.04, W * 0.7, toX(-0.94), def.top[0][1] + 0.04, 0, 'paint', 0.16);
  }

  // PERFORMANS: statik parçaları rol bazında tek mesh'e indir (draw call ~76 → ~20/araç)
  consolidateStatic(root);

  root.userData.bodyDims = {
    floor: def.floor,
    belt: def.belt,
    // yan ayna çapası: ön cam tabanının hemen gerisi (A sütunu dibi)
    mirrorX: def.cabin.length ? toX(def.cabin[def.cabin.length - 1][0]) - 0.14 : L * 0.18,
    mirrorY: def.belt + 0.05,
  };
  return root;
}

// gövde cache'i: aynı spec+detay bir kez üretilir, kopyalar GEOMETRİYİ PAYLAŞIR
// (garaj 30 kart + yarış 6 araç → üretim maliyeti ve bellek bir kez ödenir)
const bodyCache = new Map<string, THREE.Group>();

export function buildCarBody(spec: BodySpec, detail = true): THREE.Group {
  const key = `${spec.style}|${spec.L}|${spec.W}|${spec.wheelR}|${spec.face ?? ''}|${(spec.feat ?? []).join(',')}|${detail ? 1 : 0}`;
  let master = bodyCache.get(key);
  if (!master) {
    master = buildCarBodyRaw(spec, detail);
    bodyCache.set(key, master);
  }
  return master.clone(true);
}

// ---------- Araç → gövde spec eşleştirmesi ----------

// Her araç, gerçek muadilinin imza özellikleriyle donatılır (marka adı/logosu YOK — silüet
// ve karakter detayları): örn. hiper araçlarda yan hava girişi + kanat, kas arabalarında
// kaput hava girişi + çift yuvarlak far, arazide yedek teker + tavan rayı, e-pickup keskin kama.
export const CAR_BODIES: Record<string, BodySpec> = {
  // Hyper / Flagship — orta motor: yan giriş + tavan girişi; track canavarlarında dev kanat
  'chiron-ghost': { style: 'hyper', L: 4.7, W: 2.04, wheelR: 0.36, feat: ['sideIntake', 'ducktail'] },
  'jesko-storm': { style: 'hyper', L: 4.85, W: 2.06, wheelR: 0.37, feat: ['sideIntake', 'wing', 'roofScoop'] },
  'toro-nihai': { style: 'hyper', L: 4.75, W: 2.05, wheelR: 0.36, feat: ['sideIntake', 'wing'] },
  // Süper
  'sf-rosso': { style: 'super', L: 4.55, W: 1.98, wheelR: 0.35, feat: ['sideIntake', 'ducktail'] },
  'huracan-toro': { style: 'super', L: 4.5, W: 1.96, wheelR: 0.35, feat: ['sideIntake', 'roofScoop'] },
  'turbo-wolf': { style: 'super', L: 4.5, W: 1.94, wheelR: 0.35, feat: ['ducktail'] },
  'mcclaw-720': { style: 'super', L: 4.55, W: 1.97, wheelR: 0.35, feat: ['sideIntake', 'roofScoop'] },
  // Spor
  'gtr-kaplan': { style: 'coupe', L: 4.7, W: 1.9, wheelR: 0.35, feat: ['wing'] },
  'corvette-sahin': { style: 'super', L: 4.65, W: 1.95, wheelR: 0.36, feat: ['ducktail'] },
  'supra-kartal': { style: 'coupe', L: 4.4, W: 1.86, wheelR: 0.34, feat: ['ducktail'] },
  // Kas — uzun kaput + scoop + çift yuvarlak far (face varsayılanı 'muscle')
  'demon-reaper': { style: 'muscle', L: 5.1, W: 1.99, wheelR: 0.37, feat: ['hoodScoop'] },
  'mustang-vahsi': { style: 'muscle', L: 4.9, W: 1.94, wheelR: 0.36, feat: ['hoodScoop'] },
  'camaro-boga': { style: 'muscle', L: 4.85, W: 1.93, wheelR: 0.36, feat: ['hoodScoop', 'ducktail'] },
  // Sedan — Avrupa spor sedanları: spor yüz
  'm-wolf-4': { style: 'sedan', L: 4.8, W: 1.88, wheelR: 0.34, face: 'sport' },
  'rs-simsek': { style: 'sedan', L: 4.9, W: 1.9, wheelR: 0.35, face: 'sport', feat: ['ducktail'] },
  'alfa-kartal': { style: 'coupe', L: 4.7, W: 1.88, wheelR: 0.34 },
  // Elektrikli — kapalı burun + tam genişlik ışık barı
  'volt-plaid': { style: 'sedan', L: 4.98, W: 1.96, wheelR: 0.35, face: 'ev' },
  'taycan-simsek': { style: 'coupe', L: 4.96, W: 1.96, wheelR: 0.36, face: 'ev' },
  'rivian-yaban': { style: 'suv', L: 5.0, W: 2.0, wheelR: 0.4, face: 'ev', feat: ['roofRack'] },
  // Arazi — yedek teker + tavan rayı + yuvarlak far
  'wrangler-kaya': { style: 'offroad', L: 4.4, W: 1.94, wheelR: 0.42, feat: ['spare'] },
  'defender-firtina': { style: 'offroad', L: 4.8, W: 2.0, wheelR: 0.41, feat: ['spare', 'roofRack'] },
  // Kompakt / Roadster
  'civic-ok': { style: 'hatch', L: 4.1, W: 1.8, wheelR: 0.32, face: 'sport' },
  'mini-simsek': { style: 'hatch', L: 3.7, W: 1.74, wheelR: 0.3, feat: ['twoToneRoof'] },
  'ruzgar-mx': { style: 'roadster', L: 3.95, W: 1.75, wheelR: 0.32 },
  // E-Pickup — paslanmaz kama (keskin hatlar, tek LED şerit)
  'cyber-kaya': { style: 'cyber', L: 5.3, W: 2.03, wheelR: 0.43 },
  // Rally — tavan girişli, kanatlı orman canavarı
  'orman-kurdu': { style: 'hatch', L: 4.35, W: 1.84, wheelR: 0.35, feat: ['wing', 'hoodScoop'] },
  // Lüks GT
  'golge-aston': { style: 'coupe', L: 4.8, W: 1.94, wheelR: 0.35, feat: ['ducktail'] },
  // Özel konseptler
  'devriye-x': { style: 'sedan', L: 4.85, W: 1.9, wheelR: 0.35, face: 'sport' },
  'acil-sahin': { style: 'van', L: 5.3, W: 2.02, wheelR: 0.38 },
  'sari-kartal': { style: 'sedan', L: 4.7, W: 1.86, wheelR: 0.34, feat: ['twoToneRoof'] },
};

export function getBodySpec(carId: string): BodySpec {
  return CAR_BODIES[carId] ?? CAR_BODIES['civic-ok'];
}
