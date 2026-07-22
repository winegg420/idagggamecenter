// Entity interpolation: uzak oyuncular gecikme tamponuyla yumuşak çizilir.
// Saf sınıf — birim testli.
import { NETWORK } from '../config/constants';

export interface Snapshot {
  /** Yerel alım zamanı (epoch ms) */
  t: number;
  s: number;
  x: number;
  y: number;
  f: number;
}

export interface InterpolatedState {
  s: number;
  x: number;
  y: number;
  f: number;
  /** Veri bayat — oyuncu muhtemelen koptu, olduğu yerde donmalı */
  stale: boolean;
}

const MAX_SNAPSHOTS = 30;
/** Bu süredir mesaj yoksa "kopuk" say (ms) */
const STALE_MS = 2000;
/** En fazla bu kadar ileri tahmin yap (ms) */
const MAX_EXTRAPOLATE_MS = 200;

export class InterpolationBuffer {
  private snaps: Snapshot[] = [];

  push(snap: Snapshot): void {
    // Sıra dışı (eski) paketleri at
    const last = this.snaps[this.snaps.length - 1];
    if (last && snap.t <= last.t) return;
    this.snaps.push(snap);
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
  }

  get lastSnapshot(): Snapshot | null {
    return this.snaps[this.snaps.length - 1] ?? null;
  }

  /** now: epoch ms. Render zamanı now - INTERP_DELAY_MS. */
  sample(now: number): InterpolatedState | null {
    if (this.snaps.length === 0) return null;
    const last = this.snaps[this.snaps.length - 1];
    const stale = now - last.t > STALE_MS;
    const renderT = now - NETWORK.INTERP_DELAY_MS;

    if (stale) {
      // Kopuk: son bilinen yerde donuk
      return { s: last.s, x: last.x, y: last.y, f: last.f, stale: true };
    }

    // renderT'yi saran iki kare bul
    for (let i = this.snaps.length - 1; i >= 1; i--) {
      const b = this.snaps[i];
      const a = this.snaps[i - 1];
      if (a.t <= renderT && renderT <= b.t) {
        const k = b.t === a.t ? 1 : (renderT - a.t) / (b.t - a.t);
        return {
          s: a.s + (b.s - a.s) * k,
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
          f: b.f,
          stale: false,
        };
      }
    }

    if (renderT > last.t) {
      // Yeni paket henüz gelmedi: kısa süre sabit tut (aşırı tahmin titretir)
      const hold = Math.min(renderT - last.t, MAX_EXTRAPOLATE_MS);
      const prev = this.snaps[this.snaps.length - 2];
      if (prev && hold > 0) {
        const v = (last.s - prev.s) / Math.max(1, last.t - prev.t);
        return { s: last.s + v * hold, x: last.x, y: last.y, f: last.f, stale: false };
      }
      return { s: last.s, x: last.x, y: last.y, f: last.f, stale: false };
    }

    // renderT en eski kareden de eski: en eskiyi göster
    const first = this.snaps[0];
    return { s: first.s, x: first.x, y: first.y, f: first.f, stale: false };
  }

  clear(): void {
    this.snaps = [];
  }
}
