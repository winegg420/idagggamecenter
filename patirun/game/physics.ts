// Saf fizik fonksiyonları — three.js'e bağımlı DEĞİL, birim test edilebilir.
import { PHYSICS, RACE } from '../config/constants';
import type { RunnerInput, RunnerState, TrackObstacle } from './types';

export interface TrackPhysicsInfo {
  length: number;
  /** s konumunda jump pad var mı */
  jumpPadAt: (s: number) => boolean;
  /**
   * Gizli kısayol bölgesi kontrolü (opsiyonel).
   * 2D yan görünümde kısayol havadaki bir koridordur (y bandı).
   */
  inShortcutZone?: (s: number, x: number, y: number) => boolean;
  /** s konumunu kapsayan üst yol platformunun yüksekliği (yoksa null) */
  platformAt?: (s: number) => number | null;
  /** (sFrom, sTo] aralığındaki ilk yamaç yüzünün s konumu (yoksa null) */
  wallBetween?: (sFrom: number, sTo: number) => number | null;
  /** s konumu su bölümünde mi (yüzme) */
  waterAt?: (s: number) => boolean;
  /** s konumundaki zemin yüksekliği (kara yükseltileri; yoksa 0) */
  groundAt?: (s: number) => number;
}

/** Efekt ve slipstream dahil anlık ileri hızı hesaplar. */
export function computeForwardSpeed(
  runner: RunnerState,
  now: number,
  slipstreamActive: boolean,
  shortcutActive = false,
  waterActive = false,
): number {
  const e = runner.effects;
  if (runner.disconnected || runner.disqualified || runner.finished) return 0;
  if (now < e.stunUntil || now < e.frozenUntil) return 0;
  // AFK donması
  if (now - runner.lastInputAt >= RACE.AFK_FREEZE_SECONDS) return 0;

  let speed = PHYSICS.BASE_SPEED * runner.speedFactor;
  if (now < e.boostUntil) speed *= PHYSICS.BOOST_MULTIPLIER;
  if (now < e.slowUntil) speed *= e.slowFactor;
  if (slipstreamActive) speed *= 1 + PHYSICS.SLIPSTREAM_BONUS;
  if (shortcutActive) speed *= PHYSICS.SHORTCUT_MULTIPLIER;
  if (waterActive) speed *= PHYSICS.WATER_SPEED_FACTOR;
  return speed;
}

/** Öndeki bir koşucuya yakın takipte mi (slipstream)? */
export function isSlipstreaming(runner: RunnerState, others: RunnerState[]): boolean {
  return others.some(
    (o) =>
      o.id !== runner.id &&
      !o.finished &&
      o.s > runner.s &&
      o.s - runner.s <= PHYSICS.SLIPSTREAM_RANGE &&
      Math.abs(o.x - runner.x) <= 1.5,
  );
}

/** Engel çarpışma kontrolü: koşucunun yakınında rakip engeli var mı? */
export function hitObstacle(
  runner: RunnerState,
  obstacles: TrackObstacle[],
  now: number,
  groundOf: (s: number) => number = () => 0,
): TrackObstacle | null {
  if (now < runner.effects.invulnUntil) return null; // dokunulmaz: kapan tetiklenmez
  // x (yanal şerit) sahte-derinliktir ve değişmez; kapan çarpışması x'i YOK
  // SAYAR — pistteki kapan o s+y'den geçen HERKESİ yakalar (MP'de şerit farkı
  // yüzünden kapanların boşa gitmesini önler).
  return (
    obstacles.find(
      (ob) =>
        ob.ownerId !== runner.id &&
        now < ob.expiresAt &&
        runner.y - groundOf(ob.s) <= 1.2 && // üstünden atlanabilir (yerel zemine göre)
        Math.abs(ob.s - runner.s) < 1.0,
    ) ?? null
  );
}

/**
 * Tek fizik adımı. Yeni bir RunnerState döner (girdiyi mutate etmez).
 * `now`: yarış saati (sn), `dt`: kare süresi (sn).
 */
export function stepRunner(
  runner: RunnerState,
  input: RunnerInput,
  dt: number,
  now: number,
  track: TrackPhysicsInfo,
  others: RunnerState[] = [],
  shortcutOpen = false,
): RunnerState {
  if (runner.finished || runner.disqualified || runner.disconnected) return runner;

  const next: RunnerState = { ...runner, effects: { ...runner.effects } };
  const hasInput = input.lateral !== 0 || input.jump || input.active === true;
  if (hasInput) next.lastInputAt = now;

  const stunned = now < next.effects.stunUntil || now < next.effects.frozenUntil;
  const afkFrozen = now - next.lastInputAt >= RACE.AFK_FREEZE_SECONDS;

  // İleri hareket. Slipstream (arkadakine hız bonusu) SON DÜZLÜKTE kapalı:
  // finişe yaklaşırken lastik-bant etkisiyle herkesin eşitlenmesini önler,
  // son sprint dürüst koşulur (kullanıcı geri bildirimi 2026-07-04).
  const slip =
    isSlipstreaming(next, others) && next.s < track.length * PHYSICS.SLIPSTREAM_CUTOFF_FRAC;
  const inShortcut =
    shortcutOpen && (track.inShortcutZone?.(next.s, next.x, next.y) ?? false);
  const inWater = (track.waterAt?.(next.s) ?? false) && next.y < 0.5;
  const speed = computeForwardSpeed(next, now, slip, inShortcut, inWater);
  let sNew = Math.min(next.s + speed * dt, track.length);

  // Kara yükseltisi (yamaç): tepesine tırmanmadan geçilemez (önünde durursun)
  const wall = track.wallBetween?.(next.s, sNew) ?? null;
  if (wall !== null && next.y < PHYSICS.CLIFF_HEIGHT) {
    sNew = Math.min(sNew, wall - 0.6);
  }
  next.s = sNew;
  /** Bu noktadaki yerel zemin yüksekliği (yükseltilmiş kara parçaları) */
  const gHere = track.groundAt?.(next.s) ?? 0;

  // Yanal hareket
  if (!stunned && !afkFrozen) {
    next.x += input.lateral * PHYSICS.LATERAL_SPEED * dt;
    next.x = Math.max(-PHYSICS.TRACK_HALF_WIDTH, Math.min(PHYSICS.TRACK_HALF_WIDTH, next.x));
  }

  // --- DERİN SU: hız tabanlı dalış/çıkış + YUNUS fırlaması ---
  // EĞİL spam'i = her basış aşağı itki (hızla dibe), ZIPLA spam'i = her basış
  // yukarı itki. Yeterli hızla yüzeyi kesersen yunus gibi sudan FIRLAR,
  // havada süzülüp karaya hız kesmeden inersin.
  const inWaterZone = track.waterAt?.(next.s) ?? false;
  const swimmingCtl = inWaterZone && next.y <= 0.011;
  if (swimmingCtl) {
    if (!stunned && !afkFrozen) {
      const duckPressed = input.duck === true && !next.swimDuckHeld;
      if (input.jump) {
        next.vy = Math.min(PHYSICS.SWIM_MAX_VY, next.vy + PHYSICS.SWIM_RISE_IMPULSE);
      }
      if (duckPressed) {
        next.vy = Math.max(-PHYSICS.SWIM_MAX_VY, next.vy - PHYSICS.SWIM_DIVE_IMPULSE);
      }
    }
    next.swimDuckHeld = input.duck === true;
    next.ducking = false; // suda eğilme yok — dalınır
    // Su direnci + hafif kaldırma kuvveti (bırakınca yavaşça yüzeye süzülür)
    next.vy *= Math.max(0, 1 - PHYSICS.SWIM_DAMPING * dt);
    next.vy += PHYSICS.WATER_BUOYANCY * dt;
    next.y += next.vy * dt;
    if (next.y <= -PHYSICS.WATER_DEPTH) {
      next.y = -PHYSICS.WATER_DEPTH;
      next.vy = Math.max(0, next.vy);
    }
    if (next.y >= 0) {
      if (next.vy >= PHYSICS.SWIM_LEAP_MIN_VY) {
        // YUNUS FIRLAMASI: sudan çık, hava fiziği devralır (karaya atlayış)
        next.y = 0.02;
        next.grounded = false;
      } else {
        next.y = 0; // yüzeyde kal
        next.vy = Math.min(0, next.vy);
        next.grounded = true;
      }
    } else {
      next.grounded = false; // su içinde asılı
    }
    if (next.y <= 0.011) {
      if (next.s >= track.length) {
        next.finished = true;
        next.finishTime = now;
      }
      return next;
    }
    // Yüzeyi kesip fırladıysak aşağıdaki hava fiziğine devam ederiz
  }
  if (!inWaterZone) next.swimDuckHeld = false;
  if (!inWaterZone && next.y < 0) {
    // Su bölümü bitti ama hâlâ derindesin: kıyıya hızla tırman
    next.y = Math.min(0, next.y + PHYSICS.WATER_VERTICAL_SPEED * dt);
    next.vy = 0;
    next.grounded = true;
    next.ducking = false;
    if (next.s >= track.length) {
      next.finished = true;
      next.finishTime = now;
    }
    return next;
  }

  // --- KARA YÜKSELTİSİNE TIRMANMA (Fun Run tarzı — spam ile KOLAY, direnç yok) ---
  // Yamacın dibindeysen (ilerleme yatayda durdurulmuş) ve tepenin altındaysan:
  // ZIPLA'ya her basış düzgün bir yukarı adım; basmasan bile yavaş sarkma —
  // hiç düşüp baştan başlamazsın. Tepeye çıkınca plato zemininde koşmaya devam.
  const faceS = track.wallBetween?.(next.s, next.s + 1.0) ?? null;
  const climbing = faceS !== null && next.y < PHYSICS.CLIFF_HEIGHT && !stunned && !afkFrozen;
  if (climbing) {
    if (input.jump) {
      next.vy = PHYSICS.CLIMB_STEP;
    } else {
      next.vy = Math.max(next.vy - PHYSICS.CLIMB_SLIDE * dt, -PHYSICS.CLIMB_MAX_SLIDE);
    }
    next.y = Math.max(0, next.y + next.vy * dt);
    next.grounded = false;
    next.ducking = false;
    if (next.y >= PHYSICS.CLIFF_HEIGHT) {
      // Tepeye ulaştı — plato zeminine adım at, yukarıda koşmaya devam
      next.y = PHYSICS.CLIFF_HEIGHT;
      next.vy = 0;
      next.grounded = true;
      next.s = Math.max(next.s, faceS + 0.3);
    }
    if (next.s >= track.length) {
      next.finished = true;
      next.finishTime = now;
    }
    return next;
  }

  // Eğilme (yerdeyken basılı tutulur; bar engellerinin altından geçirir).
  next.ducking = !stunned && !afkFrozen && input.duck === true && next.grounded;

  // Zıplama + yerçekimi
  if (!stunned && !afkFrozen && input.jump && next.grounded) {
    next.vy = PHYSICS.JUMP_VELOCITY;
    next.grounded = false;
    next.ducking = false;
  }
  // Jump pad (yerel zeminde üzerinden geçince fırlatır; platformda tetiklenmez)
  if (next.grounded && Math.abs(next.y - gHere) < 0.01 && track.jumpPadAt(next.s)) {
    next.vy = PHYSICS.JUMP_PAD_VELOCITY;
    next.grounded = false;
  }

  // Yerel zeminden yüksekte "yerde" isek: platform veya yükselti kenarı kontrolü
  if (next.grounded && next.y > gHere + 0.01) {
    const plat = track.platformAt?.(next.s) ?? null;
    const dropRequested = input.duck === true && !stunned && !afkFrozen;
    if (plat === null || plat < next.y - 0.01 || dropRequested) {
      next.grounded = false;
      next.vy = 0;
      next.ducking = false;
    }
  }

  if (!next.grounded) {
    // Havada eğil = hızlı iniş. Sadece düşüş fazında (vy<=0): zıplamanın
    // yükselişini iptal etmesin, apexte devreye girsin.
    if (input.duck === true && next.vy <= 0 && !stunned && !afkFrozen) {
      next.vy = Math.min(next.vy, -PHYSICS.FAST_FALL_VELOCITY);
    }
    const prevY = next.y;
    next.vy += PHYSICS.GRAVITY * dt;
    next.y += next.vy * dt;
    // Düşerken platform yüzeyini ÜSTTEN kesersen üst yola inersin.
    // (prevY > plat + eps: platformdan bırakan koşucu anında geri yakalanmasın)
    const plat = track.platformAt?.(next.s) ?? null;
    if (plat !== null && next.vy <= 0 && prevY > plat + 1e-3 && next.y <= plat) {
      next.y = plat;
      next.vy = 0;
      next.grounded = true;
    } else if (next.y <= gHere && next.vy <= 0) {
      // Yerel zemine iniş (yükseltilmiş kara parçası dahil) — su bölgesinde
      // zemin yok, suya dalış swimmingCtl'e girer
      if (inWaterZone) {
        if (next.y <= 0) {
          next.y = -0.01; // suya giriş — bir sonraki karede yüzme devralır
          next.vy = Math.max(next.vy, -3);
          next.grounded = false;
        }
      } else {
        next.y = gHere;
        next.vy = 0;
        next.grounded = true;
      }
    }
  }

  // Bitiş çizgisi
  if (next.s >= track.length) {
    next.finished = true;
    next.finishTime = now;
  }

  return next;
}

/** Sabit pist engeli (2D yan görünüm): blok üstünden atlanır, bar altından eğilerek geçilir. */
export interface StaticObstacle {
  id: string;
  s: number;
  kind: 'blok' | 'bar';
}

/**
 * Sabit engel çarpışması. Aynı engele bir kez çarpılır (alreadyHit anahtarı
 * `${engelId}:${koşucuId}`). Kalkan sabit pist engellerinden KORUMAZ
 * (kalkan yalnızca gelen skill'leri savuşturur).
 */
export function hitStaticObstacle(
  runner: RunnerState,
  obstacles: StaticObstacle[],
  alreadyHit: Set<string>,
  groundOf: (s: number) => number = () => 0,
): StaticObstacle | null {
  for (const ob of obstacles) {
    if (Math.abs(ob.s - runner.s) >= 0.9) continue;
    if (alreadyHit.has(`${ob.id}:${runner.id}`)) continue;
    const rel = runner.y - groundOf(ob.s); // yükseltilmiş zemindeki engele göre
    if (ob.kind === 'blok' && rel < 1.1) return ob;
    if (ob.kind === 'bar' && !runner.ducking && rel < 2.0) return ob;
  }
  return null;
}

/** Sabit engel yavaşlatması (kalkan kontrolü YOK — pist engeli skill değildir). */
export function applyStaticHit(runner: RunnerState, now: number): RunnerState {
  return {
    ...runner,
    effects: {
      ...runner.effects,
      slowUntil: now + PHYSICS.OBSTACLE_SLOW_DURATION,
      slowFactor: PHYSICS.OBSTACLE_SLOW_MULTIPLIER,
    },
  };
}

/**
 * Kapan (skill engeli) etkisi: basan koşucu KISA SÜRE KAPANA KISILIR —
 * yavaşlama değil, tam kilitlenme (bear trap). Kalkan korur.
 */
export function applyObstacleHit(runner: RunnerState, now: number): RunnerState {
  if (now < runner.effects.shieldUntil || now < runner.effects.invulnUntil) return runner;
  const stunEnd = now + PHYSICS.TRAP_HOLD_DURATION;
  return {
    ...runner,
    effects: {
      ...runner.effects,
      stunUntil: Math.max(runner.effects.stunUntil, stunEnd),
      // Kapandan kurtulunca 2 sn dokunulmazlık (zincir CC önlenir)
      invulnUntil: Math.max(runner.effects.invulnUntil, stunEnd + PHYSICS.INVULN_DURATION),
    },
  };
}

/** AFK diskalifiye kontrolü. */
export function checkDisqualify(runner: RunnerState, now: number): RunnerState {
  if (
    !runner.finished &&
    !runner.disqualified &&
    now - runner.lastInputAt >= RACE.AFK_DISQUALIFY_SECONDS
  ) {
    return { ...runner, disqualified: true };
  }
  return runner;
}
