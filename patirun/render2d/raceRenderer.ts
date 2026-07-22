// 2D yarış çizicisi: paralaks arka plan + pist öğeleri + koşucular + efektler.
// Fun Run düzeni: oyuncu ekranın sol üçte birinde sabit, dünya kayar.
import type { Track2D } from '../game/track2d/track2d';
import { SHORTCUT_MIN_Y } from '../game/track2d/track2d';
import { PHYSICS } from '../config/constants';
import { getSprite, type Pose } from './characterSprites';
import type { CosmeticConfig } from '../game/characters/characters';

export interface RunnerVisual2D {
  id: string;
  characterId: string;
  cosmetics?: CosmeticConfig;
  name: string;
  ghost?: boolean;
  glow?: boolean;
}

export interface RunnerDrawState {
  id: string;
  s: number;
  y: number;
  ducking: boolean;
  grounded: boolean;
  swimming: boolean;
  /** 0..1+ koşu animasyon hızı */
  moving: boolean;
  shield: boolean;
  frozen: boolean;
  stunned: boolean;
  boost: boolean;
  /** Elektrikle kızarmış (yıldırım) — koyulaşır + kafadan duman */
  fried: boolean;
  /** Dokunulmaz ("yeniden doğum") — yanıp söner */
  invuln: boolean;
  disconnected: boolean;
  finished: boolean;
}

export interface DrawParams {
  /** Yarış saati (sn) — bob/yanıp sönme animasyonları için */
  time: number;
  night: boolean;
  runners: RunnerDrawState[];
  /** Kamera bu koşucuyu takip eder */
  followId: string;
  boxes: { s: number; y?: number; visible: boolean }[];
  placedObstacles: { s: number }[];
  shortcutOpen: boolean;
  ghost?: { s: number; y: number } | null;
  /** Yavaş çekim replay: kamera hedefini doğrudan ver */
  camOverrideS?: number;
}

/** Görüş yüksekliği (birim) — PPU bundan türer */
const VIEW_UNITS = 15;
const PLAYER_ANCHOR = 0.3; // ekran genişliği oranı
const GROUND_RATIO = 0.8;
/** Koşucu sprite yüksekliği (birim) */
const RUNNER_H = 2.6;

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** '#rrggbb' rengini f çarpanıyla koyulaştır/aydınlat (doğal ton geçişleri) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

export class RaceRenderer2D {
  private readonly track: Track2D;
  private readonly visuals = new Map<string, RunnerVisual2D>();
  /** Sahte-derinlik şeridi: koşucu başına sabit indeks (0 = en ön = oyuncu) */
  private readonly laneOf = new Map<string, number>();
  private readonly laneCount: number;
  private camS = 0;
  /** Dikey kamera: dalışta aşağı, yükseltide yukarı kayar (birim) */
  private camY = 0;
  private camInit = false;
  private shakeMag = 0;

  constructor(track: Track2D, visuals: RunnerVisual2D[]) {
    this.track = track;
    this.laneCount = visuals.length;
    visuals.forEach((v, i) => {
      this.visuals.set(v.id, v);
      this.laneOf.set(v.id, i);
    });
  }

  /**
   * Şerit dikey ofseti (birim): aynı s'teki koşucular üst üste binmesin.
   * İndeks 0 (oyuncu) en önde (en altta), diğerleri kademeli arkada/yukarıda.
   */
  private laneOffsetUnits(id: string): number {
    const i = this.laneOf.get(id) ?? 0;
    const n = Math.max(1, this.laneCount);
    return (n - 1 - i) * 0.26 - (n - 1) * 0.13;
  }

  /** Ekran sarsıntısı tetikle (yıldırım vb.) */
  shake(magnitude = 8): void {
    this.shakeMag = magnitude;
  }

  private flashAlpha = 0;
  private flashColor = '255,60,60';
  /** İniş tozu / kan parçacıkları (ekran koordinatı; rgb yoksa toz rengi) */
  private particles: { x: number; y: number; vx: number; vy: number; life: number; rgb?: string }[] = [];
  /** Koşucu başına önceki kare "yerde mi" (iniş anını yakalamak için) */
  private prevGrounded = new Map<string, boolean>();
  /** Aktif yıldırım çarpmaları: hedefi izleyerek şimşek + kıvılcım + duman çizer */
  private strikes: { targetId: string; start: number }[] = [];
  /** Kafadan yükselen duman/buhar parçacıkları (ekran koordinatı) */
  private smoke: { x: number; y: number; vx: number; vy: number; life: number; r: number }[] = [];

  /** Tam ekran renk flaşı (çarpma/yıldırım geri bildirimi) */
  flash(rgb = '255,60,60', alpha = 0.35): void {
    this.flashColor = rgb;
    this.flashAlpha = alpha;
  }

  /** Yıldırım çarpması efekti başlat: gökten şimşek + elektrik + duman */
  lightningStrike(targetId: string): void {
    this.strikes.push({ targetId, start: performance.now() / 1000 });
  }

  /** Kapana yakalanma: koşucunun ayağında kapalı kapan + kıvılcım + kan */
  private snaps: { targetId: string; start: number; bled?: boolean }[] = [];
  trapSnap(targetId: string): void {
    this.snaps.push({ targetId, start: performance.now() / 1000 });
  }

  /** Tökezleme: blok kutusuna takılan koşucu öne savrulup toparlanır */
  private stumbles = new Map<string, number>();
  stumble(id: string): void {
    this.stumbles.set(id, performance.now() / 1000);
  }

  /** Genel skill efektleri: aktivasyon patlamaları (koşucuyu izleyerek çizilir) */
  private fx: { kind: 'boostOn' | 'shieldOn' | 'knockback' | 'magnet' | 'golden' | 'trapSet'; id: string; start: number }[] = [];
  addFx(kind: 'boostOn' | 'shieldOn' | 'knockback' | 'magnet' | 'golden' | 'trapSet', id: string): void {
    this.fx.push({ kind, id, start: performance.now() / 1000 });
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: DrawParams): void {
    const t = this.track.def.theme;
    const ppu = h / VIEW_UNITS;
    const groundY = h * GROUND_RATIO;
    const anchorX = w * PLAYER_ANCHOR;

    // Kamera: takip edilen koşucuyu (veya replay hedefini) yumuşak izle
    const follow = p.runners.find((r) => r.id === p.followId);
    const targetS = p.camOverrideS ?? follow?.s ?? 0;
    // Dikey kamera: suya dalınca ekran AŞAĞI, yükseltiye çıkınca YUKARI kayar
    const fy = follow?.y ?? 0;
    const targetCamY = fy < -0.4 ? (fy + 0.4) * 0.85 : fy > 2.0 ? (fy - 2.0) * 0.8 : 0;
    if (!this.camInit) {
      this.camS = targetS;
      this.camY = targetCamY;
      this.camInit = true;
    } else {
      this.camS += (targetS - this.camS) * 0.18;
      this.camY += (targetCamY - this.camY) * 0.1;
    }
    const sx = (s: number) => anchorX + (s - this.camS) * ppu;
    const sy = (y: number) => groundY - (y - this.camY) * ppu;
    /** Taban zemin çizgisinin ekran konumu (dikey kamerayla kayar) */
    const gyBase = sy(0);
    const gAt = this.track.groundAt;
    /** s konumundaki yerel zeminin ekran y'si (yükseltiler dahil) */
    const gyOf = (s: number) => sy(gAt(s));
    const sMin = this.camS - anchorX / ppu - 4;
    const sMax = this.camS + (w - anchorX) / ppu + 4;

    ctx.save();
    // Sarsıntı
    if (this.shakeMag > 0.4) {
      ctx.translate((Math.random() - 0.5) * this.shakeMag, (Math.random() - 0.5) * this.shakeMag);
      this.shakeMag *= 0.88;
    }

    // ---- Gökyüzü (taban zemin çizgisine kadar — dikey kamerayla kayar) ----
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, gyBase));
    sky.addColorStop(0, p.night ? t.skyNightTop : t.skyDayTop);
    sky.addColorStop(1, p.night ? t.skyNightBottom : t.skyDayBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, -h, w, Math.max(1, gyBase) + h);

    // Güneş / ay + yıldızlar
    if (p.night) {
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.14, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.night ? t.skyNightTop : '';
      ctx.beginPath();
      ctx.arc(w * 0.8 + 12, h * 0.14 - 6, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect(hash(i) * w, hash(i + 50) * groundY * 0.7, 2, 2);
      }
    } else {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.15, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Uzak plan (paralaks 0.15): tepe silüetleri ----
    ctx.fillStyle = p.night ? t.farNight : t.far;
    ctx.beginPath();
    ctx.moveTo(0, gyBase);
    const farOff = this.camS * ppu * 0.15;
    for (let x = 0; x <= w; x += 8) {
      const u = (x + farOff) / 130;
      const yh = gyBase - (Math.sin(u) * 0.5 + 0.5) * h * 0.16 - h * 0.04;
      ctx.lineTo(x, yh);
    }
    ctx.lineTo(w, gyBase);
    ctx.closePath();
    ctx.fill();

    // ---- Orta plan (paralaks 0.45): tema dekoru ----
    // Orman: arkada ikinci, soluk ağaç sırası (derinlik hissi)
    if (t.decorStyle === 'agac') this.drawMidDecor(ctx, w, gyBase, ppu, p.night, 0.28, 0.6, 0.5);
    this.drawMidDecor(ctx, w, gyBase, ppu, p.night);

    // ---- Zemin (taban) ----
    ctx.fillStyle = t.soil;
    ctx.fillRect(0, gyBase, w, h - gyBase + h);
    ctx.fillStyle = p.night ? t.groundNight : t.ground;
    ctx.fillRect(0, gyBase, w, ppu * 0.5);
    // Hız çizgileri (zemin işaretleri)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    for (let s = Math.floor(sMin / 4) * 4; s <= sMax; s += 4) {
      const x = sx(s);
      ctx.beginPath();
      ctx.moveTo(x, gyBase + ppu * 0.6);
      ctx.lineTo(x - ppu * 0.5, gyBase + ppu * 1.1);
      ctx.stroke();
    }

    // ---- YÜKSELTİLMİŞ KARA PARÇALARI (temaya özgü yamaç + üstünde koşu platosu) ----
    for (const c of this.track.wallS) {
      const c1 = c + PHYSICS.CLIFF_LENGTH;
      if (c1 < sMin || c > sMax) continue;
      this.drawCliff(ctx, sx, sy, gyBase, ppu, c, c1, p.night, p.time);
    }

    // ---- DERİN SU bölümleri (gövde — koşuculardan önce) ----
    const waterBottomY = sy(-PHYSICS.WATER_DEPTH);
    for (const wz of this.track.waterZones) {
      if (wz.s1 < sMin || wz.s0 > sMax) continue;
      const x0 = sx(wz.s0);
      const x1 = sx(wz.s1);
      // Derinlikle kararan su sütunu
      const grad = ctx.createLinearGradient(0, gyBase, 0, waterBottomY);
      grad.addColorStop(0, p.night ? '#1d5a8a' : '#48b5e0');
      grad.addColorStop(0.55, p.night ? '#0d3a61' : '#1878a8');
      grad.addColorStop(1, p.night ? '#041627' : '#093a5c');
      ctx.fillStyle = grad;
      ctx.fillRect(x0, gyBase - ppu * 0.1, x1 - x0, waterBottomY - gyBase + ppu * 0.6);
      // Kumlu dip + çakıllar
      ctx.fillStyle = p.night ? '#6a5a40' : '#c2a878';
      ctx.fillRect(x0, waterBottomY + ppu * 0.3, x1 - x0, ppu * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let s = Math.ceil(wz.s0 / 3) * 3; s < wz.s1; s += 3) {
        ctx.beginPath();
        ctx.ellipse(sx(s), waterBottomY + ppu * 0.38, ppu * 0.12, ppu * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Işık hüzmeleri (yüzeyden derine)
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let s = Math.ceil(wz.s0 / 7) * 7; s < wz.s1; s += 7) {
        const lx = sx(s);
        ctx.beginPath();
        ctx.moveTo(lx - ppu * 0.2, gyBase);
        ctx.lineTo(lx + ppu * 0.9, waterBottomY);
        ctx.lineTo(lx + ppu * 1.6, waterBottomY);
        ctx.lineTo(lx + ppu * 0.5, gyBase);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- Üst yol platformları (çizim: koşuculardan önce) ----
    this.drawPlatforms(ctx, sx, sy, gyBase, ppu, sMin, sMax, p.night);

    // ---- Pist öğeleri (yerel zemin yüksekliğine oturur) ----
    this.drawStartFinish(ctx, sx, gyOf, ppu, sMin, sMax);
    this.drawCheckpoints(ctx, sx, gyOf, ppu, sMin, sMax);
    this.drawJumpPads(ctx, sx, gyOf, ppu, sMin, sMax, p.time);
    this.drawStaticObstacles(ctx, sx, gyOf, ppu, sMin, sMax, p.night);
    if (p.shortcutOpen) this.drawShortcut(ctx, sx, sy, ppu, sMin, sMax, p.time);

    // Skill kutuları (dip kutuları mutlak derinlikte, zemin kutuları yerel zeminde)
    for (const box of p.boxes) {
      if (!box.visible || box.s < sMin || box.s > sMax) continue;
      const bob = Math.sin(p.time * 3 + box.s) * ppu * 0.12;
      const baseY = box.y !== undefined && box.y < 0 ? box.y : gAt(box.s);
      this.drawSkillBox(ctx, sx(box.s), sy(baseY + 0.9) + bob, ppu, p.time + box.s);
    }

    // Bırakılmış kapanlar (skill)
    for (const ob of p.placedObstacles) {
      if (ob.s < sMin || ob.s > sMax) continue;
      this.drawPlacedObstacle(ctx, sx(ob.s), gyOf(ob.s), ppu);
    }

    // ---- Hayalet (en arka şeridin de gerisinde) ----
    if (p.ghost) {
      const gOff = (-(this.laneCount - 1) * 0.13 - 0.3) * ppu;
      ctx.globalAlpha = 0.35;
      this.drawRunnerSprite(
        ctx,
        p.followId,
        sx(p.ghost.s),
        sy(p.ghost.y) + gOff,
        ppu,
        'run1',
        p.ghost.s,
      );
      ctx.globalAlpha = 1;
    }

    // ---- Koşucular: arkadan öne çiz (şerit indeksi büyük = arka = önce) ----
    const ordered = [...p.runners].sort(
      (a, b) => (this.laneOf.get(b.id) ?? 0) - (this.laneOf.get(a.id) ?? 0),
    );
    for (const r of ordered) {
      if (r.s < sMin - 2 || r.s > sMax + 2) continue;
      const laneOffPx = this.laneOffsetUnits(r.id) * ppu;
      // Gölge, koşucunun üzerinde durduğu yüzeye düşer (zemin/yükselti/platform)
      const plat = this.track.platformAt(r.s);
      const supportY = plat !== null && r.y >= plat - 0.01 ? sy(plat) : gyOf(r.s);
      // İniş anı: toz bulutu (juice)
      const wasGrounded = this.prevGrounded.get(r.id) ?? true;
      if (r.grounded && !wasGrounded) {
        for (let i = 0; i < 7; i++) {
          this.particles.push({
            x: sx(r.s) + (Math.random() - 0.5) * ppu * 0.7,
            y: supportY + laneOffPx,
            vx: (Math.random() - 0.5) * ppu * 3,
            vy: -Math.random() * ppu * 1.6,
            life: 1,
          });
        }
      }
      this.prevGrounded.set(r.id, r.grounded);
      this.drawRunner(ctx, r, sx(r.s), sy(r.y) + laneOffPx, supportY + laneOffPx, ppu, p.time);
    }

    // ---- Kapana yakalananlar: ayakta kenetli kapan + kapanma kıvılcımı ----
    // Senkron: kapalı kapan, koşucu GERÇEKTEN kilitli kaldığı sürece görünür
    // (duvar saati değil, koşucunun stun durumu esas alınır; 6 sn emniyet tavanı)
    const snapNow = performance.now() / 1000;
    this.snaps = this.snaps.filter((sn) => {
      const age = snapNow - sn.start;
      if (age > 6) return false;
      const r = p.runners.find((rr) => rr.id === sn.targetId);
      return !!r && (age < 0.3 || r.stunned);
    });
    for (const sn of this.snaps) {
      const r = p.runners.find((rr) => rr.id === sn.targetId);
      if (!r || r.s < sMin || r.s > sMax) continue;
      const laneOffPx = this.laneOffsetUnits(r.id) * ppu;
      const footY = sy(r.y) + laneOffPx;
      this.drawBearTrap(ctx, sx(r.s), footY, ppu, true);
      const age = snapNow - sn.start;
      // Kapanma anında ayaktan ufak kan damlaları sıçrar (tek sefer)
      if (!sn.bled) {
        sn.bled = true;
        for (let i = 0; i < 6; i++) {
          this.particles.push({
            x: sx(r.s) + (Math.random() - 0.5) * ppu * 0.5,
            y: footY - ppu * 0.25,
            vx: (Math.random() - 0.5) * ppu * 3.2,
            vy: -(0.8 + Math.random() * 1.6) * ppu,
            life: 0.9,
            rgb: '190, 20, 30',
          });
        }
      }
      if (age < 0.25) {
        ctx.strokeStyle = `rgba(255,228,94,${1 - age / 0.25})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * 0.15 - (i / 4) * Math.PI * 0.7;
          const r0 = ppu * 0.5;
          const r1 = ppu * (0.8 + age * 2);
          ctx.beginPath();
          ctx.moveTo(sx(r.s) + Math.cos(a) * r0, footY - ppu * 0.5 + Math.sin(a) * r0);
          ctx.lineTo(sx(r.s) + Math.cos(a) * r1, footY - ppu * 0.5 + Math.sin(a) * r1);
          ctx.stroke();
        }
      }
    }

    // ---- Skill aktivasyon efektleri (boost/kalkan/knockback/mıknatıs/altın) ----
    this.drawSkillFx(ctx, w, p, sx, sy, ppu);

    // ---- Yıldırım çarpmaları (koşucuların üstüne çizilir) ----
    this.drawLightningStrikes(ctx, w, p, sx, sy, ppu, gyBase);

    // ---- Toz parçacıkları ----
    if (this.particles.length > 0) {
      for (const pt of this.particles) {
        pt.life -= 0.045;
        pt.x += pt.vx * 0.016 - ppu * 0.06; // dünya kayması hissi
        pt.y += pt.vy * 0.016;
        pt.vy += ppu * 0.05;
        ctx.fillStyle = `rgba(${pt.rgb ?? '230, 225, 210'}, ${Math.max(0, pt.life) * (pt.rgb ? 0.85 : 0.55)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, ppu * 0.1 * pt.life), 0, Math.PI * 2);
        ctx.fill();
      }
      this.particles = this.particles.filter((pt) => pt.life > 0);
    }

    // ---- Su yüzeyi katmanı (koşucuların ÜSTÜNE — dalanlar suda gömülü görünsün) ----
    for (const wz of this.track.waterZones) {
      if (wz.s1 < sMin || wz.s0 > sMax) continue;
      const x0 = sx(wz.s0);
      const x1 = sx(wz.s1);
      ctx.fillStyle = p.night ? 'rgba(29,90,138,0.45)' : 'rgba(72,181,224,0.45)';
      ctx.fillRect(x0, gyBase + ppu * 0.15, x1 - x0, waterBottomY - gyBase + ppu * 0.4);
      // Dalgalı yüzey çizgisi
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 8) {
        const wy = gyBase - ppu * 0.06 + Math.sin(x / 14 + p.time * 4) * ppu * 0.06;
        if (x === x0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // ---- Çarpma flaşı (sönerek kaybolur) ----
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flashAlpha})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
      this.flashAlpha *= 0.85;
    }

    ctx.restore();
  }

  // ---------- yardımcılar ----------

  /**
   * Skill aktivasyon efektleri — her skill yıldırım kalitesinde okunur:
   * boost: alev halkası + ateş fışkırması; kalkan: camgöbeği enerji halkası;
   * knockback: çarpma yıldızı + şok dalgası; mıknatıs: mor alan dalgaları +
   * içeri akan oklar; altın: taç + altın ışın patlaması.
   */
  private drawSkillFx(
    ctx: CanvasRenderingContext2D,
    w: number,
    p: DrawParams,
    sx: (s: number) => number,
    sy: (y: number) => number,
    ppu: number,
  ): void {
    const nowSec = performance.now() / 1000;
    const LIFE: Record<string, number> = { boostOn: 0.55, shieldOn: 0.6, knockback: 0.75, magnet: 0.95, golden: 1.3, trapSet: 0.5 };
    this.fx = this.fx.filter((f) => nowSec - f.start < (LIFE[f.kind] ?? 0.8));

    for (const f of this.fx) {
      const r = p.runners.find((rr) => rr.id === f.id);
      if (!r) continue;
      const age = nowSec - f.start;
      const t = age / (LIFE[f.kind] ?? 0.8); // 0..1
      const laneOffPx = this.laneOffsetUnits(r.id) * ppu;
      // Ekran dışı hedef: efekt en yakın kenara kenetlenir (isabet görülür)
      const rawX = sx(r.s);
      const offscreen = rawX < 20 || rawX > w - 20;
      const x = Math.max(30, Math.min(w - 30, rawX));
      const footY = sy(r.y) + laneOffPx;
      const cy = footY - RUNNER_H * ppu * 0.45;
      if (offscreen && (f.kind === 'knockback' || f.kind === 'golden')) {
        ctx.font = `${Math.round(ppu * 0.8)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillText(f.kind === 'knockback' ? '💥' : '👑', x, cy - ppu * 1.2);
        ctx.globalAlpha = 1;
      }

      switch (f.kind) {
        case 'boostOn': {
          // Alev halkası + ayaklardan ateş fışkırması
          ctx.strokeStyle = `rgba(255, 140, 0, ${0.8 * (1 - t)})`;
          ctx.lineWidth = ppu * 0.12 * (1 - t) + 1.5;
          ctx.beginPath();
          ctx.ellipse(x, footY, ppu * (0.5 + t * 1.6), ppu * (0.18 + t * 0.5), 0, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 5; i++) {
            const a = Math.PI * (0.65 + hash(i * 5 + Math.floor(nowSec * 20)) * 0.7);
            const len = ppu * (0.5 + hash(i + nowSec) * 0.7) * (1 - t);
            ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 200, 40, ${0.9 * (1 - t)})` : `rgba(255, 90, 0, ${0.85 * (1 - t)})`;
            ctx.lineWidth = ppu * 0.09;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - ppu * 0.3, footY - ppu * 0.1);
            ctx.lineTo(x - ppu * 0.3 + Math.cos(a) * len, footY - ppu * 0.1 - Math.abs(Math.sin(a)) * len * 0.5);
            ctx.stroke();
          }
          break;
        }
        case 'shieldOn': {
          // Camgöbeği enerji halkası dışa yayılır + altıgen parlaması
          ctx.strokeStyle = `rgba(76, 201, 240, ${0.85 * (1 - t)})`;
          ctx.lineWidth = ppu * 0.1;
          ctx.beginPath();
          ctx.arc(x, cy, ppu * (0.5 + t * 1.4), 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - t)})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 2;
            const rr2 = ppu * (0.75 + t * 0.9);
            const px = x + Math.cos(a) * rr2;
            const py = cy + Math.sin(a) * rr2;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          break;
        }
        case 'knockback': {
          // Çarpma yıldızı + çift şok halkası + savrulma tozu
          const spikes = 8;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - t)})`;
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
            const a = (i * Math.PI) / spikes;
            const rad = (i % 2 === 0 ? ppu * (0.9 - t * 0.4) : ppu * 0.3) * (1 - t * 0.4);
            const px = x + Math.cos(a) * rad;
            const py = cy + Math.sin(a) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          for (const [k, col] of [[1, '255,80,60'], [0.7, '255,255,255']] as [number, string][]) {
            ctx.strokeStyle = `rgba(${col}, ${0.7 * (1 - t)})`;
            ctx.lineWidth = ppu * 0.07;
            ctx.beginPath();
            ctx.arc(x, cy, ppu * (0.4 + t * 2.2) * k, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (age < 0.15 && Math.random() < 0.7) {
            this.particles.push({
              x: x + ppu * (0.4 + Math.random() * 0.4),
              y: footY,
              vx: ppu * (1 + Math.random() * 2),
              vy: -Math.random() * ppu,
              life: 0.8,
            });
          }
          break;
        }
        case 'magnet': {
          // Mor alan dalgaları + iki yönden içeri akan çekim okları
          for (let ring = 0; ring < 3; ring++) {
            const rt = Math.max(0, Math.min(1, t * 1.6 - ring * 0.22));
            if (rt <= 0 || rt >= 1) continue;
            ctx.strokeStyle = `rgba(160, 90, 240, ${0.7 * (1 - rt)})`;
            ctx.lineWidth = ppu * 0.09;
            ctx.beginPath();
            ctx.ellipse(x, cy, ppu * (3.4 * (1 - rt)), ppu * (2.0 * (1 - rt)), 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = `rgba(200, 150, 255, ${0.9 * (1 - t)})`;
          for (const dir of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
              const d = ppu * (3.2 - ((t * 4 + i * 0.9) % 3));
              const ax = x + dir * d;
              ctx.beginPath();
              ctx.moveTo(ax, cy - ppu * 0.22);
              ctx.lineTo(ax - dir * ppu * 0.34, cy);
              ctx.lineTo(ax, cy + ppu * 0.22);
              ctx.closePath();
              ctx.fill();
            }
          }
          break;
        }
        case 'trapSet': {
          // Kapan kuruldu: toprak halkası + metal parıltısı
          ctx.strokeStyle = `rgba(139, 94, 52, ${0.85 * (1 - t)})`;
          ctx.lineWidth = ppu * 0.1;
          ctx.beginPath();
          ctx.ellipse(x - ppu * 0.5, footY, ppu * (0.4 + t * 1.1), ppu * (0.14 + t * 0.35), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(200, 206, 217, ${0.9 * (1 - t)})`;
          this.star(ctx, x - ppu * 0.5, footY - ppu * 0.5 * (1 - t), ppu * 0.16);
          break;
        }
        case 'golden': {
          // Altın ışın patlaması + yükselen taç
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.8 * (1 - t)})`;
          ctx.lineWidth = ppu * 0.08;
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + t * 1.2;
            const r0 = ppu * (0.6 + t * 1.4);
            const r1 = r0 + ppu * (0.7 + 0.3 * hash(i));
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            ctx.lineTo(x + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            ctx.stroke();
          }
          ctx.globalAlpha = Math.max(0, 1 - t);
          ctx.font = `${Math.round(ppu * 0.9)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillText('👑', x, footY - RUNNER_H * ppu - ppu * (0.3 + t * 0.8));
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffd700';
          this.star(ctx, x + (hash(Math.floor(nowSec * 12)) - 0.5) * ppu * 2, cy + (hash(Math.floor(nowSec * 9) + 3) - 0.5) * ppu * 1.6, ppu * 0.16);
          break;
        }
      }
    }
  }

  /**
   * Yıldırım çarpması: gökten inen çatallı şimşek + çarpma flaşı + kıvılcımlar
   * + kafadan yükselen duman. Hedef ekran dışındaysa şimşek en yakın kenara
   * kenetlenir — oyuncu isabeti HER ZAMAN görür.
   */
  private drawLightningStrikes(
    ctx: CanvasRenderingContext2D,
    w: number,
    p: DrawParams,
    sx: (s: number) => number,
    sy: (y: number) => number,
    ppu: number,
    groundY: number,
  ): void {
    const nowSec = performance.now() / 1000;
    this.strikes = this.strikes.filter((st) => nowSec - st.start < 1.7);

    for (const st of this.strikes) {
      const r = p.runners.find((rr) => rr.id === st.targetId);
      if (!r) continue;
      const age = nowSec - st.start;
      const laneOffPx = this.laneOffsetUnits(r.id) * ppu;
      const rawX = sx(r.s);
      const offscreen = rawX < 20 || rawX > w - 20;
      const x = Math.max(30, Math.min(w - 30, rawX));
      const footY = sy(r.y) + laneOffPx;
      const headY = footY - RUNNER_H * ppu * 0.92;

      // 1) Şimşek sütunu (ilk ~0.38 sn, titreyerek)
      if (age < 0.38) {
        const fade = 1 - age / 0.38;
        const segs = 8;
        const pts: [number, number][] = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const yy = t * headY;
          const wobble =
            i === segs ? 0 : (hash(i * 7.3 + Math.floor(nowSec * 30)) - 0.5) * ppu * 1.1 * (1 - t * 0.5);
          pts.push([x + wobble, yy]);
        }
        // Dış parlama + iç beyaz çekirdek
        for (const [lw, color] of [
          [ppu * 0.42, `rgba(255, 220, 80, ${0.35 * fade})`],
          [ppu * 0.18, `rgba(255, 240, 150, ${0.8 * fade})`],
          [ppu * 0.07, `rgba(255, 255, 255, ${0.95 * fade})`],
        ] as [number, string][]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
          ctx.stroke();
        }
        // Çatal dallar
        ctx.strokeStyle = `rgba(255, 240, 150, ${0.7 * fade})`;
        ctx.lineWidth = ppu * 0.06;
        for (let b = 0; b < 2; b++) {
          const [bx, by] = pts[2 + b * 3];
          const dir = b === 0 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + dir * ppu * 0.9, by + ppu * 0.7);
          ctx.lineTo(bx + dir * ppu * 1.3, by + ppu * 1.6);
          ctx.stroke();
        }
        // Çarpma flaşı (kafada büyüyüp sönen parlak küre)
        const flashR = ppu * (0.8 + age * 3);
        const g = ctx.createRadialGradient(x, headY, 0, x, headY, flashR);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
        g.addColorStop(0.4, `rgba(255,230,120,${0.5 * fade})`);
        g.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, headY, flashR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2) Elektrik kıvılcımları (karakterin etrafında ~0.9 sn)
      if (age < 0.9) {
        const cy = footY - RUNNER_H * ppu * 0.45;
        ctx.strokeStyle = `rgba(255, 228, 94, ${0.9 * (1 - age / 0.9)})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 7; i++) {
          const a = hash(i * 3.1 + Math.floor(nowSec * 25)) * Math.PI * 2;
          const r0 = ppu * 0.55;
          const r1 = r0 + ppu * (0.3 + hash(i + nowSec) * 0.45);
          const zig = (hash(i * 9.7 + nowSec) - 0.5) * ppu * 0.3;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8);
          ctx.lineTo(
            x + Math.cos(a) * ((r0 + r1) / 2) + zig,
            cy + Math.sin(a) * ((r0 + r1) / 2) * 0.8 + zig,
          );
          ctx.lineTo(x + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
          ctx.stroke();
        }
      }

      // 3) Kafadan duman/buhar (0.15-1.5 sn arası üretilir, kendi ömrüyle söner)
      if (age > 0.15 && age < 1.5 && Math.random() < 0.5) {
        this.smoke.push({
          x: x + (Math.random() - 0.5) * ppu * 0.3,
          y: headY,
          vx: (Math.random() - 0.5) * ppu * 0.5,
          vy: -(1.2 + Math.random()) * ppu,
          life: 1,
          r: ppu * (0.12 + Math.random() * 0.1),
        });
      }

      // 4) Ekran dışı hedef: kenarda büyük ⚡ göstergesi (isabet yine görülür)
      if (offscreen) {
        ctx.font = `${Math.round(ppu * 0.9)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, 1 - age / 1.2);
        ctx.fillText('⚡', x, groundY - ppu * 3.2);
        ctx.globalAlpha = 1;
      }
    }

    // Duman parçacıkları: yükselir, genişler, söner
    if (this.smoke.length > 0) {
      for (const sp of this.smoke) {
        sp.life -= 0.02;
        sp.x += sp.vx * 0.016;
        sp.y += sp.vy * 0.016;
        sp.vx *= 0.985;
        sp.r += ppu * 0.012;
        ctx.fillStyle = `rgba(120, 120, 130, ${Math.max(0, sp.life) * 0.5})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.smoke = this.smoke.filter((sp) => sp.life > 0);
    }
  }

  /**
   * Yükseltilmiş kara parçası (tırmanma yamacı): "duvar" değil, doğal bir
   * arazi çıkıntısı. Temaya göre kimlik değişir; ön yüz organik/eğimli,
   * üstünde koşu platosu. Sol kenar = tırmanma yüzü (ipucu okları).
   */
  private drawCliff(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    sy: (y: number) => number,
    gyBase: number,
    ppu: number,
    c: number,
    c1: number,
    night: boolean,
    time: number,
  ): void {
    const t = this.track.def.theme;
    const x0 = sx(c);
    const x1 = sx(c1);
    const topY = sy(PHYSICS.CLIFF_HEIGHT);
    const h = gyBase - topY;
    const face = Math.min(ppu * 1.0, (x1 - x0) * 0.3); // ön yüz genişliği
    const style = t.decorStyle;

    ctx.save();

    if (style === 'bulut') {
      // BULUT RAFI: üst üste yığılmış kabarık bulut topakları
      const body = night ? '#8f9fc4' : '#f4f9ff';
      const shade2 = night ? '#6d7ba6' : '#d3e2f5';
      ctx.fillStyle = shade2;
      ctx.beginPath();
      ctx.roundRect(x0, topY + ppu * 0.3, x1 - x0, h, ppu * 0.6);
      ctx.fill();
      ctx.fillStyle = body;
      const r = ppu * 0.7;
      for (let bx = x0; bx <= x1; bx += r * 1.2) {
        ctx.beginPath();
        ctx.arc(bx, topY + ppu * 0.35, r * (0.85 + hash(bx) * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      // Tırmanma yüzü sol kenarda hafif topak sütunu
      for (let by = topY; by < gyBase; by += r) {
        ctx.beginPath();
        ctx.arc(x0 + ppu * 0.1, by, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // TOPRAK/KAYA GÖVDE: eğimli-organik ön yüz + katman şeritleri
      const soil = t.soil;
      const bodyGrad = ctx.createLinearGradient(x0, topY, x0, gyBase);
      bodyGrad.addColorStop(0, soil);
      bodyGrad.addColorStop(1, shade(soil, 0.7));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(x0 + face * 0.55, topY); // üst-sol (hafif içeri, eğim başlangıcı)
      // eğimli/çıkıntılı ön yüz (birkaç kademe — kaya rafları gibi)
      ctx.lineTo(x0 + face * 0.2, topY + h * 0.28);
      ctx.lineTo(x0 + face * 0.42, topY + h * 0.34);
      ctx.lineTo(x0, topY + h * 0.6);
      ctx.lineTo(x0 + face * 0.3, topY + h * 0.66);
      ctx.lineTo(x0 + face * 0.05, gyBase);
      ctx.lineTo(x1, gyBase);
      ctx.lineTo(x1, topY + ppu * 0.2);
      ctx.lineTo(x1 - ppu * 0.15, topY);
      ctx.closePath();
      ctx.fill();

      // Katman (strata) şeritleri — yatay arazi çizgileri
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      for (let k = 1; k <= 4; k++) {
        const yy = topY + (h * k) / 5;
        ctx.beginPath();
        ctx.moveTo(x0 + face * 0.15 * (k % 2), yy);
        ctx.lineTo(x1 - ppu * 0.2, yy);
        ctx.stroke();
      }

      // Üst koşu şeridi (tema zemini) + kenar tepe kabuğu
      const cap = night ? t.groundNight : t.ground;
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.moveTo(x0 + face * 0.5, topY);
      ctx.lineTo(x1 - ppu * 0.1, topY);
      ctx.lineTo(x1 - ppu * 0.1, topY + ppu * 0.42);
      ctx.lineTo(x0 + face * 0.42, topY + ppu * 0.42);
      ctx.closePath();
      ctx.fill();

      if (style === 'agac') {
        // ÇİM TEPE: kenardan sarkan çim püskülleri + birkaç taş
        ctx.fillStyle = cap;
        for (let gx = x0 + face * 0.5; gx < x1 - ppu * 0.2; gx += ppu * 0.34) {
          const d = ppu * (0.28 + hash(gx) * 0.28);
          ctx.beginPath();
          ctx.moveTo(gx, topY + ppu * 0.3);
          ctx.lineTo(gx + ppu * 0.12, topY + ppu * 0.3 + d);
          ctx.lineTo(gx + ppu * 0.24, topY + ppu * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = shade(soil, 0.55);
        for (let i = 0; i < 3; i++) {
          const rx = x0 + face + (x1 - x0 - face) * hash(c + i * 3) * 0.9;
          const ry = topY + ppu * 0.6 + hash(c + i * 7) * h * 0.5;
          ctx.beginPath();
          ctx.ellipse(rx, ry, ppu * 0.16, ppu * 0.11, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (style === 'lav' || style === 'alev') {
        // KOR ÇATLAKLARI: ön yüzde parlayan turuncu damarlar
        const glow = 0.6 + Math.sin(time * 4 + c) * 0.3;
        ctx.strokeStyle = `rgba(255, ${style === 'alev' ? 90 : 120}, 20, ${glow})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const gx = x0 + face * 0.2 + i * ppu * 0.18;
          ctx.beginPath();
          ctx.moveTo(gx, topY + h * 0.15);
          ctx.lineTo(gx + ppu * 0.2, topY + h * 0.45);
          ctx.lineTo(gx - ppu * 0.1, topY + h * 0.75);
          ctx.stroke();
        }
      } else if (style === 'seker') {
        // PASTA KATLARI: krema damlaları + renkli şeker taneleri
        ctx.fillStyle = '#fff0f6';
        for (let gx = x0 + face * 0.5; gx < x1 - ppu * 0.2; gx += ppu * 0.4) {
          ctx.beginPath();
          ctx.arc(gx, topY + ppu * 0.42, ppu * (0.16 + hash(gx) * 0.12), 0, Math.PI);
          ctx.fill();
        }
        const sprinkles = ['#e63946', '#4cc9f0', '#ffd166', '#43aa8b'];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = sprinkles[i % 4];
          ctx.fillRect(
            x0 + face + (x1 - x0 - face) * hash(c + i) * 0.85,
            topY + ppu * 0.55 + hash(c + i * 2) * h * 0.4,
            ppu * 0.12,
            ppu * 0.05,
          );
        }
      }
    }

    // Tırmanma ipucu: yamacın önünde yukarı akan altın oklar (her temada)
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.5 + Math.sin(time * 5) * 0.3})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const ay = gyBase - h * 0.12 - i * h * 0.24 - ((time * ppu) % (h * 0.24));
      if (ay < topY + ppu * 0.2) continue;
      ctx.beginPath();
      ctx.moveTo(x0 - ppu * 0.85, ay);
      ctx.lineTo(x0 - ppu * 0.5, ay - ppu * 0.28);
      ctx.lineTo(x0 - ppu * 0.15, ay);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawMidDecor(
    ctx: CanvasRenderingContext2D,
    w: number,
    groundY: number,
    ppu: number,
    night: boolean,
    parallax = 0.45,
    scale = 1,
    alpha = 1,
  ): void {
    const t = this.track.def.theme;
    const color = night ? t.midNight : t.mid;
    const off = this.camS * ppu * parallax;
    const spacing = 170;
    const first = Math.floor((0 + off) / spacing);
    const last = Math.floor((w + off) / spacing) + 1;
    if (alpha < 1) ctx.globalAlpha = alpha;
    for (let i = first; i <= last; i++) {
      const x = i * spacing - off + hash(i) * 60;
      const size = (0.7 + hash(i + 9) * 0.7) * ppu * scale;
      ctx.fillStyle = color;
      switch (t.decorStyle) {
        case 'agac': {
          // Doğal görünüm: yer gölgesi + degrade gövde + katmanlı yapraklar.
          // İki varyant (yayvan / çam), ton ve boyut ağaca göre değişir.
          const tone = 0.9 + hash(i + 31) * 0.25;
          const pine = hash(i + 17) > 0.55;
          // Yer gölgesi
          ctx.fillStyle = 'rgba(0,0,0,0.13)';
          ctx.beginPath();
          ctx.ellipse(x, groundY - 2, size * 0.8, size * 0.13, 0, 0, Math.PI * 2);
          ctx.fill();
          // Gövde: yanal degrade (ışık solda), hafif genişleyen taban
          const trunkTop = groundY - size * (pine ? 0.7 : 1.15);
          const tg = ctx.createLinearGradient(x - size * 0.12, 0, x + size * 0.12, 0);
          tg.addColorStop(0, night ? '#3a2a18' : '#7a5230');
          tg.addColorStop(1, night ? '#1c130a' : '#4a3018');
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.moveTo(x - size * 0.14, groundY);
          ctx.lineTo(x - size * 0.07, trunkTop);
          ctx.lineTo(x + size * 0.07, trunkTop);
          ctx.lineTo(x + size * 0.14, groundY);
          ctx.closePath();
          ctx.fill();
          if (pine) {
            // Çam: üst üste üç yumuşak üçgen katman, üste doğru açılan ton
            for (let L = 0; L < 3; L++) {
              const ly = groundY - size * (0.75 + L * 0.55);
              const lw = size * (0.85 - L * 0.2);
              const lh = size * 0.75;
              ctx.fillStyle = shade(color, tone * (0.8 + L * 0.18));
              ctx.beginPath();
              ctx.moveTo(x, ly - lh);
              ctx.quadraticCurveTo(x + lw * 0.55, ly - lh * 0.25, x + lw, ly);
              ctx.lineTo(x - lw, ly);
              ctx.quadraticCurveTo(x - lw * 0.55, ly - lh * 0.25, x, ly - lh);
              ctx.closePath();
              ctx.fill();
            }
            // Sol üst ışık vurgusu
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.beginPath();
            ctx.moveTo(x, groundY - size * 2.6);
            ctx.quadraticCurveTo(x - size * 0.4, groundY - size * 2.1, x - size * 0.55, groundY - size * 1.75);
            ctx.quadraticCurveTo(x - size * 0.2, groundY - size * 2.1, x, groundY - size * 2.6);
            ctx.fill();
          } else {
            // Yayvan: 3 katmanlı yaprak kümesi — alt koyu, üst açık (hacim hissi)
            const layers: [number, number, number][] = [
              [-1.05, 0.62, 0.72],
              [-1.5, 0.54, 0.95],
              [-1.88, 0.42, 1.2],
            ];
            for (const [dy, rr, f] of layers) {
              ctx.fillStyle = shade(color, tone * f);
              const cy = groundY + dy * size;
              ctx.beginPath();
              ctx.arc(x - rr * size * 0.55, cy + rr * size * 0.18, rr * size * 0.72, 0, Math.PI * 2);
              ctx.arc(x + rr * size * 0.55, cy + rr * size * 0.18, rr * size * 0.72, 0, Math.PI * 2);
              ctx.arc(x, cy - rr * size * 0.2, rr * size * 0.85, 0, Math.PI * 2);
              ctx.fill();
            }
            // Sol üstte güneş vurgusu + altta gölge yayı
            ctx.fillStyle = 'rgba(255,255,240,0.12)';
            ctx.beginPath();
            ctx.arc(x - size * 0.3, groundY - size * 2.05, size * 0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.beginPath();
            ctx.ellipse(x, groundY - size * 0.95, size * 0.75, size * 0.28, 0, 0, Math.PI);
            ctx.fill();
          }
          // Dip çalıları (küçük yeşil tümsekler — zemine oturtma)
          ctx.fillStyle = shade(color, tone * 0.85);
          for (let bsh = -1; bsh <= 1; bsh += 2) {
            ctx.beginPath();
            ctx.arc(x + bsh * size * 0.32, groundY - size * 0.08, size * 0.17, Math.PI, 0);
            ctx.fill();
          }
          break;
        }
        case 'lav': {
          ctx.beginPath();
          ctx.moveTo(x - size, groundY);
          ctx.lineTo(x, groundY - size * 1.6);
          ctx.lineTo(x + size, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#ff6d00' : '#e25822';
          ctx.fillRect(x - size * 0.12, groundY - size * 1.55, size * 0.24, size * 0.3);
          break;
        }
        case 'bulut': {
          ctx.globalAlpha = 0.85;
          const cy = groundY - size * (1.2 + hash(i + 3));
          ctx.beginPath();
          ctx.arc(x, cy, size * 0.5, 0, Math.PI * 2);
          ctx.arc(x + size * 0.5, cy + size * 0.1, size * 0.38, 0, Math.PI * 2);
          ctx.arc(x - size * 0.5, cy + size * 0.12, size * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'alev': {
          // Fantastik alev diyarı: obsidyen kule + tepesinde katmanlı alev +
          // uçuşan kor tanecikleri
          const spireH = size * (1.6 + hash(i + 21) * 0.9);
          ctx.fillStyle = night ? '#1c1024' : '#2d1836';
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - size * 0.55, groundY);
          ctx.lineTo(x - size * 0.28, groundY - spireH * 0.55);
          ctx.lineTo(x - size * 0.12, groundY - spireH * 0.4);
          ctx.lineTo(x, groundY - spireH);
          ctx.lineTo(x + size * 0.14, groundY - spireH * 0.5);
          ctx.lineTo(x + size * 0.3, groundY - spireH * 0.62);
          ctx.lineTo(x + size * 0.55, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Katmanlı alev (dış turuncu-kırmızı, orta turuncu, iç sarı)
          const fy = groundY - spireH;
          const flick = 0.85 + hash(i * 3.7) * 0.3;
          for (const [fr, fc] of [
            [0.5 * flick, night ? '#c1440e' : '#e25822'],
            [0.34 * flick, color],
            [0.18 * flick, '#ffd166'],
          ] as [number, string][]) {
            ctx.fillStyle = fc;
            ctx.beginPath();
            ctx.moveTo(x, fy - size * fr * 2.1);
            ctx.quadraticCurveTo(x + size * fr, fy - size * fr * 0.9, x, fy + size * fr * 0.25);
            ctx.quadraticCurveTo(x - size * fr, fy - size * fr * 0.9, x, fy - size * fr * 2.1);
            ctx.closePath();
            ctx.fill();
          }
          // Uçuşan korlar
          ctx.fillStyle = 'rgba(255, 160, 60, 0.8)';
          for (let e2 = 0; e2 < 4; e2++) {
            const ex = x + (hash(i * 7 + e2) - 0.5) * size * 2.4;
            const ey = groundY - hash(i * 11 + e2) * spireH * 1.4 - size * 0.3;
            ctx.beginPath();
            ctx.arc(ex, ey, 1.6 + hash(e2 + i) * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'seker': {
          ctx.fillStyle = '#f9f5f0';
          ctx.fillRect(x - size * 0.06, groundY - size * 1.5, size * 0.12, size * 1.5);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, groundY - size * 1.7, size * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, groundY - size * 1.7, size * 0.28, 0.5, 3.6);
          ctx.stroke();
          break;
        }
      }
    }
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  private drawPlatforms(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    sy: (y: number) => number,
    groundY: number,
    ppu: number,
    sMin: number,
    sMax: number,
    night: boolean,
  ): void {
    const t = this.track.def.theme;
    for (const p of this.track.platformList) {
      if (p.s1 < sMin || p.s0 > sMax) continue;
      const x0 = sx(Math.max(p.s0, sMin - 2));
      const x1 = sx(Math.min(p.s1, sMax + 2));
      const topY = sy(p.y);
      const thick = ppu * 0.32;

      // Destek direkleri (6 birimde bir)
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let s = Math.ceil(p.s0 / 6) * 6; s < p.s1; s += 6) {
        if (s < sMin || s > sMax) continue;
        ctx.fillRect(sx(s) - 3, topY + thick, 6, groundY - topY - thick);
      }

      // Platform gövdesi: zemin renkleriyle uyumlu, üstte açık şerit
      ctx.fillStyle = t.soil;
      ctx.beginPath();
      ctx.roundRect(x0, topY, x1 - x0, thick, 6);
      ctx.fill();
      ctx.fillStyle = night ? t.groundNight : t.ground;
      ctx.beginPath();
      ctx.roundRect(x0, topY, x1 - x0, thick * 0.45, 6);
      ctx.fill();

      // Kenar vurgusu + giriş/çıkış işaretleri
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, topY + 1);
      ctx.lineTo(x1, topY + 1);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); // giriş oku (yukarı)
      ctx.moveTo(sx(p.s0) - ppu * 0.2, topY - ppu * 0.15);
      ctx.lineTo(sx(p.s0), topY - ppu * 0.5);
      ctx.lineTo(sx(p.s0) + ppu * 0.2, topY - ppu * 0.15);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawStartFinish(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    gyOf: (s: number) => number,
    ppu: number,
    sMin: number,
    sMax: number,
  ): void {
    for (const [s, isFinish] of [
      [1, false],
      [this.track.length - 0.5, true],
    ] as [number, boolean][]) {
      if (s < sMin || s > sMax) continue;
      const x = sx(s);
      const groundY = gyOf(s);
      const top = groundY - 4.6 * ppu;
      ctx.fillStyle = '#2b2d42';
      ctx.fillRect(x - 3, top, 6, 4.6 * ppu);
      // Bayrak: damalı (finiş) / kırmızı (start)
      if (isFinish) {
        const cell = ppu * 0.22;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#111111' : '#ffffff';
            ctx.fillRect(x + 3 + c * cell, top + r * cell, cell, cell);
          }
        }
      } else {
        ctx.fillStyle = '#d62828';
        ctx.beginPath();
        ctx.moveTo(x + 3, top);
        ctx.lineTo(x + 3 + ppu * 1.1, top + ppu * 0.32);
        ctx.lineTo(x + 3, top + ppu * 0.64);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawCheckpoints(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    gyOf: (s: number) => number,
    ppu: number,
    sMin: number,
    sMax: number,
  ): void {
    this.track.checkpointS.forEach((s, i) => {
      if (s < sMin || s > sMax) return;
      const x = sx(s);
      const groundY = gyOf(s);
      const top = groundY - 3.4 * ppu;
      ctx.fillStyle = '#4895ef';
      ctx.fillRect(x - 2.5, top, 5, 3.4 * ppu);
      ctx.beginPath();
      ctx.moveTo(x + 2.5, top);
      ctx.lineTo(x + 2.5 + ppu * 0.9, top + ppu * 0.28);
      ctx.lineTo(x + 2.5, top + ppu * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(ppu * 0.32)}px system-ui`;
      ctx.fillText(`${i + 1}`, x + ppu * 0.18, top + ppu * 0.45);
    });
  }

  private drawJumpPads(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    gyOf: (s: number) => number,
    ppu: number,
    sMin: number,
    sMax: number,
    time: number,
  ): void {
    for (const s of this.track.jumpPadS) {
      if (s < sMin || s > sMax) continue;
      const x = sx(s);
      const groundY = gyOf(s);
      const wpx = 2.4 * ppu;
      const pulse = 0.7 + Math.sin(time * 5 + s) * 0.3;
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.roundRect(x - wpx / 2, groundY - ppu * 0.24, wpx, ppu * 0.28, 5);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,120,0,${pulse})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - ppu * 0.4, groundY - ppu * 0.5);
      ctx.lineTo(x, groundY - ppu * 0.95);
      ctx.lineTo(x + ppu * 0.4, groundY - ppu * 0.5);
      ctx.stroke();
    }
  }

  private drawStaticObstacles(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    gyOf: (s: number) => number,
    ppu: number,
    sMin: number,
    sMax: number,
    night: boolean,
  ): void {
    for (const ob of this.track.staticObstacles) {
      if (ob.s < sMin || ob.s > sMax) continue;
      const x = sx(ob.s);
      const groundY = gyOf(ob.s);
      if (ob.kind === 'blok') {
        // Sandık: üstünden zıplanır
        const size = 1.05 * ppu;
        ctx.fillStyle = night ? '#6b4a2f' : '#8a5a2b';
        ctx.strokeStyle = '#3d2c1a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - size / 2, groundY - size, size, size, 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size / 2, groundY - size);
        ctx.lineTo(x + size / 2, groundY);
        ctx.moveTo(x + size / 2, groundY - size);
        ctx.lineTo(x - size / 2, groundY);
        ctx.stroke();
      } else {
        // Bar: altından eğilerek geçilir
        const beamY = groundY - 1.6 * ppu;
        ctx.fillStyle = '#6a4c93';
        ctx.fillRect(x - 4, beamY, 8, 1.6 * ppu); // taşıyıcı direk (arka)
        ctx.strokeStyle = '#3c096c';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#8338ec';
        ctx.beginPath();
        ctx.roundRect(x - 1.3 * ppu, beamY, 2.6 * ppu, ppu * 0.34, 5);
        ctx.fill();
        ctx.stroke();
        // Uyarı çizgileri
        ctx.fillStyle = '#ffd166';
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(x + i * ppu * 0.7 - 3, beamY + 4, 6, ppu * 0.34 - 8);
        }
      }
    }
  }

  private drawShortcut(
    ctx: CanvasRenderingContext2D,
    sx: (s: number) => number,
    sy: (y: number) => number,
    ppu: number,
    sMin: number,
    sMax: number,
    time: number,
  ): void {
    const sc = this.track.def.shortcut;
    const s0 = sc.entry * this.track.length;
    const s1 = sc.exit * this.track.length;
    if (s1 < sMin || s0 > sMax) return;
    const yTop = sy(SHORTCUT_MIN_Y + 2.2);
    const yBot = sy(SHORTCUT_MIN_Y);
    ctx.fillStyle = 'rgba(118, 200, 147, 0.18)';
    ctx.fillRect(sx(s0), yTop, sx(s1) - sx(s0), yBot - yTop);
    ctx.strokeStyle = `rgba(181, 228, 140, ${0.5 + Math.sin(time * 4) * 0.3})`;
    ctx.lineWidth = 3.5;
    for (let s = Math.max(s0, sMin); s < Math.min(s1, sMax); s += 4) {
      const x = sx(s + ((time * 6) % 4));
      const ym = (yTop + yBot) / 2;
      ctx.beginPath();
      ctx.moveTo(x - ppu * 0.3, ym - ppu * 0.3);
      ctx.lineTo(x + ppu * 0.3, ym);
      ctx.lineTo(x - ppu * 0.3, ym + ppu * 0.3);
      ctx.stroke();
    }
  }

  private drawSkillBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    ppu: number,
    t: number,
  ): void {
    const size = 1.0 * ppu;
    ctx.save();
    ctx.translate(x, y);

    // Nabız gibi atan parlama halesi
    const pulse = 0.75 + Math.sin(t * 4) * 0.25;
    const halo = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.15);
    halo.addColorStop(0, `rgba(255, 209, 102, ${0.4 * pulse})`);
    halo.addColorStop(0.6, `rgba(247, 37, 133, ${0.18 * pulse})`);
    halo.addColorStop(1, 'rgba(247, 37, 133, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Hafif salınım
    ctx.rotate(Math.sin(t * 2.2) * 0.09);

    // Kutu gövdesi: dikey degrade + koyu kontur
    const body = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    body.addColorStop(0, '#ff5da2');
    body.addColorStop(0.5, '#f72585');
    body.addColorStop(1, '#b5179e');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#6d0f3f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.16);
    ctx.fill();
    ctx.stroke();

    // Hediye kurdelesi (dikey + yatay altın şerit + fiyonk)
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-size * 0.09, -size / 2, size * 0.18, size);
    ctx.fillRect(-size / 2, -size * 0.09, size, size * 0.18);
    ctx.strokeStyle = '#c99a00';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-size * 0.09, -size / 2, size * 0.18, size);

    // Üst iç parlaması (hacim hissi)
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.roundRect(-size * 0.42, -size * 0.44, size * 0.84, size * 0.26, size * 0.12);
    ctx.fill();

    // "?" — kalın, konturlu
    ctx.font = `900 ${Math.round(size * 0.62)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = '#6d0f3f';
    ctx.strokeText('?', 0, size * 0.02);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 0, size * 0.02);

    // Dönen ışıltılar
    ctx.fillStyle = '#fff3b0';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.8 + (i * Math.PI * 2) / 3;
      const sxp = Math.cos(a) * size * 0.78;
      const syp = Math.sin(a) * size * 0.78;
      const r = size * (0.05 + 0.03 * Math.sin(t * 6 + i * 2));
      this.star(ctx, sxp, syp, Math.max(1.5, r * 2));
    }

    ctx.restore();
  }

  /** Kuadratik bezier üzerinde nokta (kapan çenesi diş konumları için) */
  private static qBez(
    t: number,
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
  ): [number, number] {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
  }

  /**
   * Yerdeki KAPAN (bear trap): açıksa iki dişli çene V şeklinde bekler,
   * kapalıysa (snap) çeneler ortada kenetlenir.
   */
  private drawBearTrap(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    ppu: number,
    closed: boolean,
  ): void {
    const s = ppu * 1.05;
    // Taban plakası + zincir halkası
    ctx.fillStyle = '#4a4a55';
    ctx.strokeStyle = '#26262e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - s * 0.6, groundY - s * 0.12, s * 1.2, s * 0.16, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#6b6b78';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - s * 0.68, groundY - s * 0.06, s * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    // Tetik pedalı (kırmızı) — açıkken görünür
    if (!closed) {
      ctx.fillStyle = '#d62828';
      ctx.beginPath();
      ctx.arc(x, groundY - s * 0.16, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    // Çeneler: dişli metal yaylar
    for (const dir of [-1, 1] as const) {
      const p0: [number, number] = [x + dir * s * 0.55, groundY - s * 0.1];
      const p1: [number, number] = closed
        ? [x + dir * s * 0.5, groundY - s * 0.7]
        : [x + dir * s * 0.8, groundY - s * 0.62];
      const p2: [number, number] = closed
        ? [x + dir * s * 0.04, groundY - s * 1.05]
        : [x + dir * s * 0.34, groundY - s * 1.0];
      ctx.strokeStyle = '#7d8491';
      ctx.lineWidth = s * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      ctx.stroke();
      // Dişler: iç kenar boyunca üçgenler
      ctx.fillStyle = '#c8ced9';
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = RaceRenderer2D.qBez((i + 0.6) / 4.6, p0, p1, p2);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - dir * s * 0.16, ty + s * 0.03);
        ctx.lineTo(tx - dir * s * 0.02, ty + s * 0.14);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawPlacedObstacle(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    ppu: number,
  ): void {
    this.drawBearTrap(ctx, x, groundY, ppu, false);
  }

  private drawRunnerSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    footY: number,
    ppu: number,
    pose: Pose,
    _s: number,
  ): void {
    const v = this.visuals.get(id);
    if (!v) return;
    const img = getSprite(v.characterId, v.cosmetics, pose);
    const hpx = RUNNER_H * ppu;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - hpx / 2, footY - hpx, hpx, hpx);
    } else {
      // Sprite henüz yüklenmediyse yedek siluet
      ctx.fillStyle = 'rgba(60,60,80,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, footY - hpx * 0.4, hpx * 0.2, hpx * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRunner(
    ctx: CanvasRenderingContext2D,
    r: RunnerDrawState,
    x: number,
    footY: number,
    groundY: number,
    ppu: number,
    time: number,
  ): void {
    const v = this.visuals.get(r.id);
    if (!v) return;
    const hpx = RUNNER_H * ppu;

    // Elektrik çarpması titremesi: sersemlerken gövde ince ince sarsılır
    if (r.stunned && !r.frozen) {
      x += (Math.random() - 0.5) * ppu * 0.16;
      footY += (Math.random() - 0.5) * ppu * 0.1;
    }

    // Gölge (yükseklikle küçülür; suda gölge yok)
    if (!r.swimming) {
      const shadowScale = Math.max(0.35, 1 - r.y * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, groundY + ppu * 0.12, ppu * 0.7 * shadowScale, ppu * 0.16 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Seviye halesi
    if (v.glow) {
      ctx.strokeStyle = `rgba(255,215,0,${0.5 + Math.sin(time * 4) * 0.25})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, groundY + ppu * 0.1, ppu * 0.85, ppu * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Boost hız çizgileri
    if (r.boost) {
      ctx.strokeStyle = 'rgba(255,140,0,0.7)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 3; i++) {
        const ly = footY - hpx * (0.3 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(x - hpx * 0.55, ly);
        ctx.lineTo(x - hpx * (0.85 + ((time * 7 + i) % 1) * 0.3), ly);
        ctx.stroke();
      }
    }

    // Poz seçimi: mesafe tabanlı koşu döngüsü (hız hissi hareketle eşleşir)
    let pose: Pose;
    if (r.swimming) pose = 'swim';
    else if (!r.grounded) pose = 'air';
    else if (r.ducking) pose = 'duck';
    else if (!r.moving || r.frozen || r.stunned) pose = 'idle';
    else pose = Math.floor(r.s * 2.2) % 2 === 0 ? 'run1' : 'run2';

    // Yüzerken gövde suya gömülü + hafif dalga salınımı
    if (r.swimming) {
      footY += ppu * 0.55 + Math.sin(time * 5 + r.s) * ppu * 0.06;
    }

    // Tökezleme: sprite öne devrilip toparlanır (blok kutusuna takılma)
    const stStart = this.stumbles.get(r.id);
    const stAge = stStart !== undefined ? performance.now() / 1000 - stStart : 99;
    const stumbling = stAge < 0.55;
    if (stStart !== undefined && !stumbling) this.stumbles.delete(r.id);
    ctx.save();
    if (stumbling) {
      const tilt = Math.sin((stAge / 0.55) * Math.PI) * 0.62; // öne yatıp geri doğrulur
      ctx.translate(x, footY);
      ctx.rotate(tilt);
      ctx.translate(-x, -footY);
      // Takılma anında ayaktan toz saçılır
      if (stAge < 0.12 && Math.random() < 0.8) {
        this.particles.push({
          x: x - ppu * 0.3,
          y: footY,
          vx: -ppu * (1.5 + Math.random() * 2),
          vy: -Math.random() * ppu * 1.4,
          life: 0.9,
        });
      }
    }

    // Boost: ardıl görüntüler (hız hayaleti) + geriye savrulan alev partikülleri
    if (r.boost && !v.ghost) {
      ctx.globalAlpha = 0.14;
      this.drawRunnerSprite(ctx, r.id, x - ppu * 0.95, footY, ppu, pose, r.s);
      ctx.globalAlpha = 0.28;
      this.drawRunnerSprite(ctx, r.id, x - ppu * 0.48, footY, ppu, pose, r.s);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.65) {
        this.particles.push({
          x: x - ppu * 0.5,
          y: footY - ppu * (0.1 + Math.random() * 0.5),
          vx: -ppu * (2 + Math.random() * 2.5),
          vy: -Math.random() * ppu * 0.8,
          life: 0.7,
          rgb: Math.random() < 0.5 ? '255, 150, 30' : '255, 90, 0',
        });
      }
    }

    if (r.disconnected || r.frozen) ctx.globalAlpha = 0.75;
    if (v.ghost) ctx.globalAlpha = 0.4;
    // Dokunulmazlık: hızlı yanıp sönme (klasik "yeniden doğum" görünümü)
    if (r.invuln && !r.stunned) {
      ctx.globalAlpha = Math.sin(time * 22) > 0 ? 0.85 : 0.35;
    }
    // Elektrikle kızarma: karakter kararır/kavrulur + kafadan duman tüter
    if (r.fried) {
      const prevFilter = ctx.filter;
      ctx.filter = 'brightness(0.4) saturate(0.45) sepia(0.4)';
      this.drawRunnerSprite(ctx, r.id, x, footY, ppu, pose, r.s);
      ctx.filter = prevFilter && prevFilter !== '' ? prevFilter : 'none';
      if (Math.random() < 0.4) {
        this.smoke.push({
          x: x + (Math.random() - 0.5) * ppu * 0.4,
          y: footY - hpx * 0.95,
          vx: (Math.random() - 0.5) * ppu * 0.4,
          vy: -(1 + Math.random()) * ppu,
          life: 1,
          r: ppu * (0.1 + Math.random() * 0.08),
        });
      }
    } else {
      this.drawRunnerSprite(ctx, r.id, x, footY, ppu, pose, r.s);
    }
    ctx.globalAlpha = 1;
    ctx.restore(); // tökezleme eğimi sadece gövdeye uygulanır
    if (stumbling) {
      // "Tökezledi!" ünlemi
      ctx.font = `900 ${Math.round(ppu * 0.6)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.strokeText('!', x + ppu * 0.7, footY - hpx * 1.15);
      ctx.fillText('!', x + ppu * 0.7, footY - hpx * 1.15);
    }

    // Su altında: ağızdan yükselen hava kabarcıkları
    if (r.swimming && r.y < -0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.7 + i * 0.37 + hash(i * 3 + Math.floor(r.s))) % 1;
        ctx.beginPath();
        ctx.arc(
          x + hpx * 0.25 + Math.sin(time * 3 + i * 2) * ppu * 0.08,
          footY - hpx * 0.75 - ph * ppu * 1.3,
          ppu * (0.045 + 0.035 * ((i + 1) % 3) * 0.5) * (1 - ph * 0.4) + 1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Donma: buz kaplaması + parlayan buz kristalleri
    if (r.frozen) {
      ctx.fillStyle = 'rgba(168,218,220,0.55)';
      ctx.strokeStyle = 'rgba(69,123,157,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - hpx * 0.35, footY - hpx * 0.95, hpx * 0.7, hpx * 0.95, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(time * 7) * 0.35})`;
      this.star(ctx, x - hpx * 0.2, footY - hpx * 0.75, ppu * 0.12);
      this.star(ctx, x + hpx * 0.18, footY - hpx * 0.35, ppu * 0.09);
      // Soğuk buhar
      if (Math.random() < 0.2) {
        this.smoke.push({
          x: x + (Math.random() - 0.5) * ppu * 0.5,
          y: footY - hpx * 0.9,
          vx: (Math.random() - 0.5) * ppu * 0.3,
          vy: -ppu * 0.5,
          life: 0.7,
          r: ppu * 0.08,
        });
      }
    }

    // Kalkan: enerji balonu + zıt yönlü dönen yaylar + yörünge ışıltıları
    if (r.shield) {
      const scx = x;
      const scy = footY - hpx * 0.45;
      const sr = hpx * 0.55;
      ctx.fillStyle = 'rgba(76,201,240,0.13)';
      ctx.beginPath();
      ctx.arc(scx, scy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = 'round';
      for (const [dir, w2] of [[1, 4.5], [-1, 3]] as [number, number][]) {
        ctx.strokeStyle = `rgba(76,201,240,${0.65 + Math.sin(time * 6) * 0.2})`;
        ctx.lineWidth = w2;
        for (let i = 0; i < 3; i++) {
          const a0 = dir * time * 2.6 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(scx, scy, sr + (dir === 1 ? 0 : 4), a0, a0 + Math.PI * 0.42);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#d9f7ff';
      for (let i = 0; i < 3; i++) {
        const a = time * 2.6 + (i * Math.PI * 2) / 3;
        this.star(ctx, scx + Math.cos(a) * sr, scy + Math.sin(a) * sr, ppu * 0.1);
      }
    }

    // Sersemleme yıldızları
    if (r.stunned && !r.frozen) {
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + (i * Math.PI * 2) / 3;
        const stx = x + Math.cos(a) * hpx * 0.3;
        const sty = footY - hpx * 1.02 + Math.sin(a) * hpx * 0.08;
        this.star(ctx, stx, sty, ppu * 0.14);
      }
    }

    // Bağlantı koptu göstergesi
    if (r.disconnected) {
      ctx.fillStyle = '#e63946';
      ctx.font = `bold ${Math.round(ppu * 0.5)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡✕', x, footY - hpx * 1.1);
    }

    // İsim etiketi
    ctx.font = `600 ${Math.round(ppu * 0.34)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(v.name, x, footY - hpx * 1.06);
    ctx.fillStyle = r.finished ? '#80ed99' : '#ffffff';
    ctx.fillText(v.name, x, footY - hpx * 1.06);
  }

  private star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
