// 4 tematik pist tanımı — kontrol noktaları + tema (ışık, renk, çevre).

import { buildTrack, type TrackData } from './track.ts';

export type EnvTheme = 'city' | 'volcano' | 'coast' | 'forest' | 'riviera';

export interface TrackDef {
  id: string;
  name: string;
  theme: EnvTheme;
  desc: string;
  /** gece pisti mi (ışıklandırma) */
  night: boolean;
  colors: {
    sky: string;
    fog: string;
    ground: string;
    asphalt: string;
    wall: string;
  };
  fogRange: [number, number];
  /** kontrol noktası ölçeği (tur süresi ~1 dk için pist uzatma). Varsayılan TRACK_SCALE. */
  scale?: number;
  /** yol yarı genişliği (m). Yoksa varsayılan (dar sokaklı pistler için düşürülür). */
  halfWidth?: number;
  control: Array<[number, number]>;
}

/**
 * Mevcut pistleri ~1 dk/tur olacak şekilde uzatan varsayılan koordinat ölçeği.
 * Gerçek oyuncu tempo referansı ~36 m/s; bu ölçekte pistler ~2900-3700m → tur ~75-100s.
 */
const TRACK_SCALE = 3.2;

export const TRACK_DEFS: TrackDef[] = [
  {
    id: 'city',
    name: 'Neon Bulvarı',
    theme: 'city',
    desc: 'Gece şehri — neon ışıklar, gökdelen silüeti',
    night: true,
    colors: { sky: '#0a0a1c', fog: '#12142e', ground: '#1c1c28', asphalt: '#3a3a46', wall: '#4a4f63' },
    fogRange: [90, 340],
    control: [
      [0, 0], [70, -4], [120, 8], [150, 45], [145, 92], [110, 118], [104, 160], [130, 192],
      [118, 232], [72, 246], [24, 234], [-24, 246], [-72, 232], [-94, 192], [-80, 150],
      [-102, 112], [-108, 64], [-80, 22], [-38, 2],
    ],
  },
  {
    id: 'volcano',
    name: 'Lav Çukuru',
    theme: 'volcano',
    desc: 'Aktif volkanın eteklerinde — akan lav, kül yağmuru',
    night: false,
    colors: { sky: '#2b1013', fog: '#4a1d14', ground: '#241214', asphalt: '#2e2224', wall: '#57392e' },
    fogRange: [80, 300],
    control: [
      [0, 0], [80, -10], [140, 15], [170, 70], [150, 120], [95, 130], [60, 170], [80, 220],
      [40, 260], [-30, 250], [-70, 210], [-60, 160], [-100, 130], [-120, 75], [-95, 25], [-45, 5],
    ],
  },
  {
    id: 'coast',
    name: 'Turkuaz Sahili',
    theme: 'coast',
    desc: 'Deniz kenarı — palmiyeler, açık gökyüzü',
    night: false,
    colors: { sky: '#8ecdf5', fog: '#bfe3f7', ground: '#e2cfa0', asphalt: '#44464e', wall: '#f2f4f6' },
    fogRange: [140, 480],
    control: [
      [0, 0], [90, 0], [150, 25], [190, 80], [175, 140], [120, 165], [110, 215], [150, 260],
      [120, 305], [50, 310], [-10, 285], [-70, 300], [-125, 270], [-140, 205], [-105, 160],
      [-120, 100], [-95, 40], [-45, 8],
    ],
  },
  {
    id: 'forest',
    name: 'Orman Rallisi',
    theme: 'forest',
    desc: 'Dağ ormanı — sık ağaçlar, rally tarzı virajlar',
    night: false,
    colors: { sky: '#a8c8e0', fog: '#9db8a8', ground: '#2c4426', asphalt: '#3b3a36', wall: '#8a6d4d' },
    fogRange: [70, 260],
    control: [
      [0, 0], [55, -8], [95, 15], [90, 55], [130, 75], [160, 120], [135, 165], [90, 155],
      [65, 195], [90, 235], [55, 275], [0, 255], [-40, 280], [-90, 255], [-95, 205], [-60, 175],
      [-85, 135], [-120, 95], [-95, 45], [-45, 10],
    ],
  },
  {
    id: 'riviera',
    name: 'Monaco',
    theme: 'riviera',
    desc: 'Dar sokaklar, keskin virajlar, marina ve yatlar — lüks kıyı devresi',
    night: false,
    colors: { sky: '#7ec3ef', fog: '#bcdcee', ground: '#cfc3a6', asphalt: '#3c3e46', wall: '#dfe4ea' },
    fogRange: [160, 520],
    // dar & bükümlü devre — Monaco karakteri (kopya değil): liman düzlüğü, hairpin'ler, tünel bölümü
    // (yine de diğer pistlerden dar tutulur ama %45 artışla 6.2→9)
    scale: 3.0,
    halfWidth: 9,
    // Temiz Monaco devresi — kendine binmez (eski pist dar hairpin'de üst üste biniyordu).
    // Alt kenar (z≈0) = liman düzlüğü: deniz + süper yatlar orada, pise çok yakın.
    control: [
      [0, 0], [55, -3], [108, 0], [150, 20], [168, 58], [174, 100],
      [162, 140], [170, 180], [142, 208], [98, 216], [50, 210], [6, 214],
      [-40, 206], [-82, 186], [-110, 152], [-120, 112], [-108, 74], [-122, 36],
      [-92, 8], [-48, 0],
    ],
  },
];

const cache = new Map<string, TrackData>();

export function getTrackData(id: string): TrackData {
  let d = cache.get(id);
  if (!d) {
    const def = TRACK_DEFS.find((t) => t.id === id) ?? TRACK_DEFS[0];
    const scale = def.scale ?? TRACK_SCALE;
    const control = def.control.map(([x, z]) => [x * scale, z * scale] as [number, number]);
    d = buildTrack(control, def.halfWidth);
    cache.set(id, d);
  }
  return d;
}

export const getTrackDef = (id: string): TrackDef => TRACK_DEFS.find((t) => t.id === id) ?? TRACK_DEFS[0];
