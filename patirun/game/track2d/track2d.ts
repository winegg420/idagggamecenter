// 2D yan-kesit pist modeli: düz zemin çizgisi + s ekseni boyunca öğeler.
// three.js'e bağımlı DEĞİL — birim test edilebilir.
import type { MapId } from '../types';
import type { StaticObstacle } from '../physics';
import type { TrackPhysicsInfo } from '../physics';
import { PHYSICS } from '../../config/constants';

export interface Theme2D {
  /** Gökyüzü gradyanı (üst, alt) — gündüz */
  skyDayTop: string;
  skyDayBottom: string;
  /** Gökyüzü gradyanı — gece */
  skyNightTop: string;
  skyNightBottom: string;
  /** Uzak plan silüeti (tepeler/bulutlar) */
  far: string;
  farNight: string;
  /** Orta plan dekoru (ağaç/kaya/bulut) */
  mid: string;
  midNight: string;
  /** Zemin üst şeridi (koşu yüzeyi) */
  ground: string;
  groundNight: string;
  /** Zemin alt dolgusu */
  soil: string;
  /** Dekor stili: paralaks/orta plan çizim tarzı */
  decorStyle: 'agac' | 'lav' | 'bulut' | 'seker' | 'alev';
}

export interface TrackDef2D {
  id: MapId;
  name: string;
  /** Pist uzunluğu (birim). BASE_SPEED=12 → 900 birim ≈ 75 sn */
  length: number;
  /** Jump pad konumları (0..1 oran) */
  jumpPads: number[];
  /** Checkpoint konumları (0..1 oran) */
  checkpoints: number[];
  /** Skill kutusu sıraları (0..1 oran) */
  skillBoxRows: number[];
  /** Gizli kısayol: havadaki hız koridoru (0..1 oran aralığı) */
  shortcut: { entry: number; exit: number };
  /** Sabit engeller: oran + tür (blok=zıpla, bar=eğil) */
  obstacles: { at: number; kind: 'blok' | 'bar' }[];
  /**
   * Üst yol platformları (pist çatalı): start..end oran aralığı, y yüksekliği.
   * Girişteki jump pad'le çıkılır; eğil ile alt yola inilir. Üst yol engelsiz,
   * alt yolda engeller + skill kutusu (risk/ödül seçimi).
   */
  platforms: { start: number; end: number; y: number }[];
  /**
   * Kara yükseltileri (0..1 oran): yamaca ZIPLA spam'iyle tırmanılır,
   * ardından CLIFF_LENGTH boyunca YÜKSELTİLMİŞ zeminde koşulur.
   */
  walls: number[];
  /** Su bölümleri (0..1 oran aralığı): karakter yüzerek geçer (hafif yavaş) */
  water: { start: number; end: number }[];
  theme: Theme2D;
}

/** Kısayol hava koridoru y bandı (birim) */
export const SHORTCUT_MIN_Y = 1.6;

export class Track2D implements TrackPhysicsInfo {
  readonly def: TrackDef2D;
  readonly length: number;
  readonly jumpPadS: number[];
  readonly checkpointS: number[];
  readonly staticObstacles: StaticObstacle[];
  /** Üst yol platformları (birim cinsinden) */
  readonly platformList: { s0: number; s1: number; y: number }[];

  constructor(def: TrackDef2D) {
    this.def = def;
    this.length = def.length;
    this.jumpPadS = def.jumpPads.map((f) => f * def.length);
    this.checkpointS = def.checkpoints.map((f) => f * def.length);
    this.staticObstacles = def.obstacles.map((o, i) => ({
      id: `st-${i}`,
      s: o.at * def.length,
      kind: o.kind,
    }));
    this.platformList = def.platforms.map((p) => ({
      s0: p.start * def.length,
      s1: p.end * def.length,
      y: p.y,
    }));
    this.wallS = def.walls.map((f) => f * def.length);
    this.waterZones = def.water.map((w) => ({ s0: w.start * def.length, s1: w.end * def.length }));
  }

  /** Su bölümleri (birim) */
  readonly waterZones: { s0: number; s1: number }[];

  /** Fizik arayüzü: s konumu suda mı */
  waterAt = (s: number): boolean => {
    return this.waterZones.some((w) => s >= w.s0 && s <= w.s1);
  };

  /** Kara yükseltisi (yamaç) başlangıç s konumları (birim) */
  readonly wallS: number[];

  /** Fizik arayüzü: (sFrom, sTo] aralığındaki ilk yamaç yüzü */
  wallBetween = (sFrom: number, sTo: number): number | null => {
    for (const w of this.wallS) {
      if (w > sFrom && w <= sTo) return w;
    }
    return null;
  };

  /**
   * Zemin yüksekliği: yamacın ardından CLIFF_LENGTH boyunca zemin
   * CLIFF_HEIGHT'ta kalır (yükseltilmiş kara parçası), sonra kenardan düşülür.
   */
  groundAt = (s: number): number => {
    for (const w of this.wallS) {
      if (s >= w && s < w + PHYSICS.CLIFF_LENGTH) return PHYSICS.CLIFF_HEIGHT;
    }
    return 0;
  };

  /** Fizik arayüzü: s konumunu kapsayan platform yüksekliği (yoksa null) */
  platformAt = (s: number): number | null => {
    for (const p of this.platformList) {
      if (s >= p.s0 && s <= p.s1) return p.y;
    }
    return null;
  };

  /** Fizik arayüzü: s konumunda jump pad var mı (±1.2 birim tolerans) */
  jumpPadAt = (s: number): boolean => {
    return this.jumpPadS.some((p) => Math.abs(p - s) < 1.2);
  };

  /** Geçilen checkpoint sayısı */
  checkpointsPassed(s: number): number {
    return this.checkpointS.filter((c) => s >= c).length;
  }

  /**
   * Gizli kısayol: entry..exit arasında HAVADAKİ koridor.
   * Zıplayarak/pad ile havada kalan koşucu hız bonusu alır.
   */
  inShortcutZone = (s: number, _x: number, y: number): boolean => {
    const sc = this.def.shortcut;
    const s0 = sc.entry * this.length;
    const s1 = sc.exit * this.length;
    return s >= s0 && s <= s1 && y >= SHORTCUT_MIN_Y;
  };
}

const cache = new Map<string, Track2D>();
export function getTrack2D(def: TrackDef2D): Track2D {
  let t = cache.get(def.id);
  if (!t) {
    t = new Track2D(def);
    cache.set(def.id, t);
  }
  return t;
}
