// Hayalet yarış: en iyi turun kompakt kaydı ve tekrar oynatımı (saf, testli).

/** Örnekleme aralığı (sn) — 5 Hz yeterince akıcı, veri küçük kalır */
export const GHOST_SAMPLE_INTERVAL = 0.2;

export interface GhostFrame {
  t: number;
  s: number;
  x: number;
  y: number;
}

export class GhostRecorder {
  private frames: GhostFrame[] = [];
  private lastT = -Infinity;

  record(t: number, s: number, x: number, y: number): void {
    if (t - this.lastT < GHOST_SAMPLE_INTERVAL) return;
    this.lastT = t;
    this.frames.push({
      t: Math.round(t * 100) / 100,
      s: Math.round(s * 10) / 10,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    });
  }

  /** Kompakt seri: [t,s,x,y, t,s,x,y, ...] düz dizi */
  serialize(): number[] {
    return this.frames.flatMap((f) => [f.t, f.s, f.x, f.y]);
  }

  get frameCount(): number {
    return this.frames.length;
  }
}

export class GhostPlayer {
  private frames: GhostFrame[] = [];

  constructor(data: number[] | null | undefined) {
    if (!data || data.length < 8) return;
    for (let i = 0; i + 3 < data.length; i += 4) {
      this.frames.push({ t: data[i], s: data[i + 1], x: data[i + 2], y: data[i + 3] });
    }
  }

  get valid(): boolean {
    return this.frames.length >= 2;
  }

  /** Yarış saatine göre hayalet konumu (interpolasyonlu) */
  sample(t: number): GhostFrame | null {
    if (!this.valid) return null;
    const frames = this.frames;
    if (t <= frames[0].t) return frames[0];
    const last = frames[frames.length - 1];
    if (t >= last.t) return last;
    // İkili arama yerine doğrusal ilerleyen imleç de olurdu; kayıt kısa, basit tarama yeterli
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].t >= t) {
        const a = frames[i - 1];
        const b = frames[i];
        const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
        return {
          t,
          s: a.s + (b.s - a.s) * k,
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
        };
      }
    }
    return last;
  }
}
