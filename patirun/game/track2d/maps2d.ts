// 4 haritanın 2D yan-kesit tanımları. Uzunluklar 60-90 sn hedefine göre
// (BASE_SPEED=12): 900 birim ≈ 75 sn. Engel ritmi: uzun boş düzlük YOK.
import type { MapId } from '../types';
import type { TrackDef2D } from './track2d';

/**
 * ORMAN — yeşil tema. Kütük blokları ve alçak dallar (bar).
 */
export const ORMAN_2D: TrackDef2D = {
  id: 'orman',
  name: 'Orman',
  length: 900,
  jumpPads: [0.15, 0.38, 0.62, 0.85],
  checkpoints: [0.25, 0.5, 0.75],
  skillBoxRows: [0.06, 0.15, 0.24, 0.33, 0.42, 0.53, 0.63, 0.74, 0.86],
  shortcut: { entry: 0.3, exit: 0.36 },
  obstacles: [
    { at: 0.08, kind: 'blok' },
    { at: 0.14, kind: 'bar' },
    { at: 0.19, kind: 'bar' },
    { at: 0.26, kind: 'blok' },
    { at: 0.31, kind: 'blok' },
    { at: 0.34, kind: 'blok' },
    { at: 0.43, kind: 'bar' },
    { at: 0.47, kind: 'bar' },
    { at: 0.52, kind: 'blok' },
    { at: 0.58, kind: 'bar' },
    { at: 0.64, kind: 'blok' },
    { at: 0.7, kind: 'blok' },
    { at: 0.77, kind: 'bar' },
    { at: 0.82, kind: 'bar' },
    { at: 0.88, kind: 'blok' },
  ],
  // Üst yol: 0.38 pad'i ile çıkılır; alt yolda 0.43/0.47 barları + 0.48 kutusu
  platforms: [{ start: 0.385, end: 0.5, y: 2.2 }],
  // İKİ yeşil tepe: erken (0.16) ve dere öncesi (0.55) — tırmanıp yukarıda koş
  walls: [0.16, 0.55],
  // Orman deresi: 0.62 pad'inden sonra kısa yüzme bölümü
  water: [{ start: 0.655, end: 0.695 }],
  theme: {
    skyDayTop: '#8ecae6',
    skyDayBottom: '#d8f3dc',
    skyNightTop: '#0b1030',
    skyNightBottom: '#1b2a50',
    far: '#74a57f',
    farNight: '#1f3a2d',
    mid: '#2f6b35',
    midNight: '#14361f',
    ground: '#8a5a2b',
    groundNight: '#4a3018',
    soil: '#5e3d1c',
    decorStyle: 'agac',
  },
};

/**
 * VOLKAN — lav teması. Kaya blokları ve lav fıskiyesi barları; daha sık engel.
 */
export const VOLKAN_2D: TrackDef2D = {
  id: 'volkan',
  name: 'Volkan',
  length: 880,
  jumpPads: [0.18, 0.42, 0.58, 0.8],
  checkpoints: [0.25, 0.5, 0.75],
  skillBoxRows: [0.05, 0.13, 0.25, 0.35, 0.45, 0.56, 0.63, 0.75, 0.87],
  shortcut: { entry: 0.55, exit: 0.61 },
  obstacles: [
    { at: 0.07, kind: 'blok' },
    { at: 0.14, kind: 'blok' },
    { at: 0.19, kind: 'bar' },
    { at: 0.23, kind: 'bar' },
    { at: 0.27, kind: 'blok' },
    { at: 0.31, kind: 'blok' },
    { at: 0.37, kind: 'bar' },
    { at: 0.43, kind: 'bar' },
    { at: 0.47, kind: 'blok' },
    { at: 0.53, kind: 'blok' },
    { at: 0.6, kind: 'blok' },
    { at: 0.66, kind: 'bar' },
    { at: 0.72, kind: 'blok' },
    { at: 0.78, kind: 'blok' },
    { at: 0.84, kind: 'bar' },
    { at: 0.9, kind: 'blok' },
  ],
  // Üst yol: 0.42 pad'i ile; alt yolda 0.47/0.53 blokları + 0.45 kutusu
  platforms: [{ start: 0.425, end: 0.55, y: 2.2 }],
  // İKİ bazalt kaya çıkıntısı (0.3 erken, 0.68 geç)
  walls: [0.3, 0.68],
  water: [], // lav temasında su yok

  theme: {
    skyDayTop: '#f4a261',
    skyDayBottom: '#e76f51',
    skyNightTop: '#1a0a0a',
    skyNightBottom: '#3d1515',
    far: '#9d4437',
    farNight: '#451a12',
    mid: '#6a2c22',
    midNight: '#2d0f0f',
    ground: '#4a4a52',
    groundNight: '#2b2b33',
    soil: '#33333a',
    decorStyle: 'lav',
  },
};

/**
 * GÖKYÜZÜ — bulut platformları. Bol jump pad, bulut blokları.
 */
export const GOKYUZU_2D: TrackDef2D = {
  id: 'gokyuzu',
  name: 'Gökyüzü',
  length: 920,
  jumpPads: [0.12, 0.3, 0.46, 0.6, 0.78, 0.9],
  checkpoints: [0.25, 0.5, 0.75],
  skillBoxRows: [0.07, 0.16, 0.26, 0.35, 0.45, 0.53, 0.63, 0.73, 0.85],
  shortcut: { entry: 0.38, exit: 0.44 },
  obstacles: [
    { at: 0.09, kind: 'bar' },
    { at: 0.15, kind: 'blok' },
    { at: 0.2, kind: 'blok' },
    { at: 0.27, kind: 'blok' },
    { at: 0.32, kind: 'bar' },
    { at: 0.36, kind: 'bar' },
    { at: 0.42, kind: 'blok' },
    { at: 0.5, kind: 'blok' },
    { at: 0.57, kind: 'bar' },
    { at: 0.65, kind: 'blok' },
    { at: 0.7, kind: 'bar' },
    { at: 0.74, kind: 'bar' },
    { at: 0.8, kind: 'blok' },
    { at: 0.86, kind: 'blok' },
  ],
  // Gökyüzü teması: iki çatal — bulut platformları haritanın kimliği
  platforms: [
    { start: 0.305, end: 0.42, y: 2.2 },
    { start: 0.605, end: 0.72, y: 2.2 },
  ],
  // İKİ kabarık bulut rafı (0.14 başta, 0.86 sonda)
  walls: [0.14, 0.86],
  // Gökyüzü gölü: bulutların arasında yüzme bölümü
  water: [{ start: 0.51, end: 0.55 }],
  theme: {
    skyDayTop: '#4ea8de',
    skyDayBottom: '#bde0fe',
    skyNightTop: '#10162e',
    skyNightBottom: '#27345c',
    far: '#a2c7e5',
    farNight: '#2c3a5e',
    mid: '#ffffff',
    midNight: '#8f9fc4',
    ground: '#e9f1fa',
    groundNight: '#7e8db0',
    soil: '#b8cde2',
    decorStyle: 'bulut',
  },
};

/**
 * EJDERHA YANARDAĞI — fantastik alev teması: mor gökyüzü, obsidyen kuleler,
 * alev sütunları, uçuşan korlar. İki duvarlı, en zorlu parkur.
 */
export const EJDERHA_2D: TrackDef2D = {
  id: 'ejderha',
  name: 'Ejderha Yanardağı 🐉',
  length: 940,
  jumpPads: [0.14, 0.34, 0.56, 0.76, 0.9],
  checkpoints: [0.25, 0.5, 0.75],
  skillBoxRows: [0.06, 0.15, 0.24, 0.34, 0.44, 0.54, 0.64, 0.75, 0.86],
  shortcut: { entry: 0.45, exit: 0.51 },
  obstacles: [
    { at: 0.07, kind: 'blok' },
    { at: 0.12, kind: 'bar' },
    { at: 0.18, kind: 'blok' },
    { at: 0.23, kind: 'bar' },
    { at: 0.28, kind: 'blok' },
    { at: 0.38, kind: 'bar' },
    { at: 0.42, kind: 'blok' },
    { at: 0.48, kind: 'bar' },
    { at: 0.53, kind: 'blok' },
    { at: 0.6, kind: 'bar' },
    { at: 0.65, kind: 'blok' },
    { at: 0.72, kind: 'bar' },
    { at: 0.79, kind: 'blok' },
    { at: 0.84, kind: 'bar' },
    { at: 0.87, kind: 'blok' },
    { at: 0.93, kind: 'bar' },
  ],
  // Üst yol: 0.56 pad'i ile çıkılır; alt yolda 0.6 bar + 0.65 blok
  platforms: [{ start: 0.565, end: 0.7, y: 2.2 }],
  // ÜÇ obsidyen yükselti: en epik harita (0.13 / 0.42 / 0.87)
  walls: [0.13, 0.42, 0.87],
  water: [], // lav diyarında su yok
  theme: {
    skyDayTop: '#2b0a3d',
    skyDayBottom: '#ff6d3a',
    skyNightTop: '#12041f',
    skyNightBottom: '#3d0b2e',
    far: '#5c1a3a',
    farNight: '#2a0c1e',
    mid: '#e85d04',
    midNight: '#9d2c15',
    ground: '#4a3054',
    groundNight: '#2c1b36',
    soil: '#241228',
    decorStyle: 'alev',
  },
};

/**
 * GİZLİ — "Şeker Diyarı". 50 yarışta açılır; pembe rüya teması.
 */
export const GIZLI_2D: TrackDef2D = {
  id: 'gizli',
  name: 'Şeker Diyarı 🍭',
  length: 860,
  jumpPads: [0.16, 0.36, 0.55, 0.72, 0.88],
  checkpoints: [0.25, 0.5, 0.75],
  skillBoxRows: [0.06, 0.15, 0.26, 0.35, 0.44, 0.54, 0.64, 0.75, 0.87],
  shortcut: { entry: 0.6, exit: 0.66 },
  obstacles: [
    { at: 0.08, kind: 'blok' },
    { at: 0.13, kind: 'bar' },
    { at: 0.18, kind: 'bar' },
    { at: 0.28, kind: 'blok' },
    { at: 0.33, kind: 'blok' },
    { at: 0.4, kind: 'bar' },
    { at: 0.46, kind: 'blok' },
    { at: 0.52, kind: 'bar' },
    { at: 0.58, kind: 'bar' },
    { at: 0.63, kind: 'blok' },
    { at: 0.69, kind: 'blok' },
    { at: 0.78, kind: 'bar' },
    { at: 0.84, kind: 'blok' },
    { at: 0.9, kind: 'blok' },
  ],
  // Üst yol: 0.36 pad'i ile; alt yolda 0.4 bar + 0.46 blok
  platforms: [{ start: 0.365, end: 0.48, y: 2.2 }],
  // İKİ pasta katı yükselti (0.16 / 0.6)
  walls: [0.16, 0.6],
  water: [], // ileride limonata gölü eklenebilir

  theme: {
    skyDayTop: '#ffcad4',
    skyDayBottom: '#ffe5ec',
    skyNightTop: '#3c096c',
    skyNightBottom: '#5a189a',
    far: '#e39dcb',
    farNight: '#6d2f8e',
    mid: '#ff5d8f',
    midNight: '#a4508b',
    ground: '#ffc8dd',
    groundNight: '#9c6f9e',
    soil: '#e5a9c9',
    decorStyle: 'seker',
  },
};

const registry: Record<MapId, TrackDef2D> = {
  orman: ORMAN_2D,
  volkan: VOLKAN_2D,
  gokyuzu: GOKYUZU_2D,
  ejderha: EJDERHA_2D,
  gizli: GIZLI_2D,
};

export function getMap2D(id: MapId): TrackDef2D {
  return registry[id] ?? ORMAN_2D;
}

export function availableMaps2D(hiddenUnlocked = false): TrackDef2D[] {
  const maps: TrackDef2D[] = [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D];
  if (hiddenUnlocked) maps.push(GIZLI_2D);
  return maps;
}
