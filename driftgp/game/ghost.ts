// Hayalet araba sistemi — oyun sahibinin (idagg) pist+tur başına en iyi sürüşü kaydedilir,
// buluta yazılır ve HERKESİN yarışında yarı saydam hayalet araç olarak oynatılır.
// Saf modül (React/three yok) → headless test edilebilir (scripts/simTest.ts).

export interface GhostData {
  /** araç üstünde gösterilecek isim (oyun sahibi: 'idagg') */
  name: string;
  carId: string;
  paintColor: string | null;
  /** hayaletin toplam yarış süresi (sn) — etikette skor olarak gösterilir */
  raceTime: number;
  /** örnekleme aralığı (sn) */
  dt: number;
  /** [x, z, heading] üçlüleri düz dizi halinde */
  samples: number[];
}

/** kayıt örnekleme aralığı — 8Hz: akıcı oynatma için yeterli, ~150sn yarış ≈ 3.6K sayı */
export const GHOST_DT = 0.125;
/** güvenlik tavanı (20 dk yarış) — bozuk/sonsuz kayıt buluta şişmesin */
const GHOST_MAX_SAMPLES = 9600;

/** Yarış boyunca oyuncu pozisyonunu sabit aralıkla örnekler. */
export class GhostRecorder {
  private acc = 0;
  samples: number[] = [];

  reset(): void {
    this.acc = 0;
    this.samples = [];
  }

  /** her fizik karesinde çağrılır — GHOST_DT dolunca anlık pozu kaydeder */
  update(dt: number, x: number, z: number, heading: number): void {
    if (this.samples.length / 3 >= GHOST_MAX_SAMPLES) return;
    if (this.samples.length === 0) {
      // t=0 örneği (başlangıç pozu) — oynatma ilk andan doğru yerde başlar
      this.samples.push(round2(x), round2(z), round3(heading));
    }
    this.acc += dt;
    while (this.acc >= GHOST_DT && this.samples.length / 3 < GHOST_MAX_SAMPLES) {
      this.acc -= GHOST_DT;
      this.samples.push(round2(x), round2(z), round3(heading));
    }
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function wrapPi(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface GhostPose {
  x: number;
  z: number;
  heading: number;
  /** hayalet yarışını bitirdi mi (t >= raceTime) */
  done: boolean;
}

/** t anındaki hayalet pozu — iki örnek arası lineer interpolasyon (heading açı sarmalı). */
export function ghostPoseAt(g: GhostData, t: number): GhostPose | null {
  const n = Math.floor(g.samples.length / 3);
  if (n === 0) return null;
  const f = Math.max(0, t / g.dt);
  const i = Math.min(n - 1, Math.floor(f));
  const j = Math.min(n - 1, i + 1);
  const a = Math.min(1, f - i);
  const s = g.samples;
  const x = s[i * 3] + (s[j * 3] - s[i * 3]) * a;
  const z = s[i * 3 + 1] + (s[j * 3 + 1] - s[i * 3 + 1]) * a;
  const heading = s[i * 3 + 2] + wrapPi(s[j * 3 + 2] - s[i * 3 + 2]) * a;
  return { x, z, heading, done: t >= g.raceTime || i >= n - 1 };
}
