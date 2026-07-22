// Pist geometrisi: kapalı Catmull-Rom eğrisi üzerinden örneklenmiş merkez çizgisi.
// Hem görsel mesh üretimi hem fizik (duvar sınırı + tur ilerlemesi) bu veriden beslenir.

export interface TrackSample {
  x: number;
  z: number;
  /** birim teğet */
  tx: number;
  tz: number;
  /** birim normal (teğetin 90° solu) */
  nx: number;
  nz: number;
}

export interface TrackData {
  samples: TrackSample[];
  /** yol yarı genişliği (m) */
  halfWidth: number;
  /** toplam örnek sayısı */
  count: number;
  totalLength: number;
}

const SAMPLE_COUNT = 1120;
// Yol yarı genişliği — %45 artırıldı (9→13), araçlar rahat manevra yapsın (26m yol)
export const TRACK_HALF_WIDTH = 13;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function buildTrack(control: Array<[number, number]>, halfWidth = TRACK_HALF_WIDTH): TrackData {
  const CONTROL = control;
  const n = CONTROL.length;
  const samples: TrackSample[] = [];
  const perSeg = Math.ceil(SAMPLE_COUNT / n);

  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      samples.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        z: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        tx: 0,
        tz: 0,
        nx: 0,
        nz: 0,
      });
    }
  }

  // teğet ve normal hesapla + toplam uzunluk
  const count = samples.length;
  let totalLength = 0;
  for (let i = 0; i < count; i++) {
    const prev = samples[(i - 1 + count) % count];
    const next = samples[(i + 1) % count];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const s = samples[i];
    s.tx = dx;
    s.tz = dz;
    // sol normal
    s.nx = -dz;
    s.nz = dx;
    const nn = samples[(i + 1) % count];
    totalLength += Math.hypot(nn.x - s.x, nn.z - s.z);
  }

  return { samples, halfWidth, count, totalLength };
}

/**
 * Verilen konuma en yakın merkez çizgisi örneğini bulur.
 * hint çevresinde lokal arama yapar (performans için); hint yoksa tüm diziyi tarar.
 */
export function nearestSample(track: TrackData, x: number, z: number, hint?: number): number {
  const { samples, count } = track;
  let bestI = 0;
  let bestD = Infinity;
  if (hint === undefined) {
    for (let i = 0; i < count; i++) {
      const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    return bestI;
  }
  // hint ± 40 örnek pencerede ara
  for (let off = -40; off <= 40; off++) {
    const i = (hint + off + count) % count;
    const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

/**
 * F1/Asphalt tarzı 2 kolonlu kademeli start grid pozisyonu.
 * Kolonlar 5.6m yanal ayrı (araç genişliği ~1.9m'nin 1.5×'inden fazla), sıralar 7m arkada.
 * Hiçbir araç diğerinin mesh'ine çakışmaz (min mesafe > 2×CAR_RADIUS).
 */
export function startPose(track: TrackData, slot = 0) {
  const s0 = track.samples[8]; // start çizgisi bölgesi
  const col = slot % 2; // 0 = sol, 1 = sağ
  const row = Math.floor(slot / 2); // 0,1,2...
  const lateral = (col === 0 ? -1 : 1) * 2.8; // kolonlar arası 5.6m
  const back = 6 + row * 7; // her sıra 7m geride, ilk sıra çizgiden 6m geride
  return {
    x: s0.x + s0.nx * lateral - s0.tx * back,
    z: s0.z + s0.nz * lateral - s0.tz * back,
    heading: Math.atan2(s0.tz, s0.tx),
  };
}
