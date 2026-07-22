import { describe, it, expect } from 'vitest';
import {
  stepRunner,
  computeForwardSpeed,
  isSlipstreaming,
  hitObstacle,
  applyObstacleHit,
  checkDisqualify,
} from '../physics';
import { createRunner } from '../types';
import type { TrackPhysicsInfo } from '../physics';
import { PHYSICS, RACE } from '../../config/constants';

const track: TrackPhysicsInfo = {
  length: 900,
  jumpPadAt: () => false,
};

const padTrack: TrackPhysicsInfo = {
  length: 900,
  jumpPadAt: (s) => Math.abs(s - 10) < 1.2,
};

const noInput = { lateral: 0, jump: false };

describe('computeForwardSpeed', () => {
  it('taban hızı döner', () => {
    const r = createRunner('a');
    expect(computeForwardSpeed(r, 0, false)).toBe(PHYSICS.BASE_SPEED);
  });

  it('boost hızı artırır', () => {
    const r = createRunner('a');
    r.effects.boostUntil = 5;
    expect(computeForwardSpeed(r, 1, false)).toBeCloseTo(
      PHYSICS.BASE_SPEED * PHYSICS.BOOST_MULTIPLIER,
    );
  });

  it('sersemleme hızı sıfırlar', () => {
    const r = createRunner('a');
    r.effects.stunUntil = 5;
    expect(computeForwardSpeed(r, 1, false)).toBe(0);
  });

  it('AFK donması hızı sıfırlar', () => {
    const r = createRunner('a');
    r.lastInputAt = 0;
    expect(computeForwardSpeed(r, RACE.AFK_FREEZE_SECONDS, false)).toBe(0);
    expect(computeForwardSpeed(r, RACE.AFK_FREEZE_SECONDS - 0.1, false)).toBe(PHYSICS.BASE_SPEED);
  });

  it('slipstream küçük bonus verir', () => {
    const r = createRunner('a');
    expect(computeForwardSpeed(r, 0, true)).toBeCloseTo(
      PHYSICS.BASE_SPEED * (1 + PHYSICS.SLIPSTREAM_BONUS),
    );
  });
});

describe('isSlipstreaming', () => {
  it('yakın takipte true', () => {
    const a = createRunner('a');
    const b = createRunner('b');
    a.s = 100;
    b.s = 100 + PHYSICS.SLIPSTREAM_RANGE - 1;
    expect(isSlipstreaming(a, [a, b])).toBe(true);
  });

  it('uzaktaysa veya yanal sapmışsa false', () => {
    const a = createRunner('a');
    const b = createRunner('b');
    a.s = 100;
    b.s = 100 + PHYSICS.SLIPSTREAM_RANGE + 5;
    expect(isSlipstreaming(a, [a, b])).toBe(false);
    b.s = 105;
    b.x = 3;
    expect(isSlipstreaming(a, [a, b])).toBe(false);
  });

  it('öndeki değil arkadaki için çalışmaz', () => {
    const a = createRunner('a');
    const b = createRunner('b');
    a.s = 100;
    b.s = 95;
    expect(isSlipstreaming(a, [a, b])).toBe(false);
  });
});

describe('stepRunner', () => {
  it('ileri hareket eder', () => {
    const r = createRunner('a');
    const next = stepRunner(r, noInput, 1, 0, track);
    expect(next.s).toBeCloseTo(PHYSICS.BASE_SPEED);
  });

  it('yanal hareket sınırlanır', () => {
    let r = createRunner('a');
    for (let i = 0; i < 50; i++) {
      r = stepRunner(r, { lateral: 1, jump: false }, 0.1, i * 0.1, track);
    }
    expect(r.x).toBe(PHYSICS.TRACK_HALF_WIDTH);
  });

  it('zıplama ve yere iniş', () => {
    let r = createRunner('a');
    r = stepRunner(r, { lateral: 0, jump: true }, 0.016, 0, track);
    expect(r.grounded).toBe(false);
    expect(r.vy).toBeGreaterThan(0);
    let t = 0;
    for (let i = 0; i < 300 && !r.grounded; i++) {
      t += 0.016;
      r = stepRunner(r, noInput, 0.016, t, track);
    }
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(0);
  });

  it('havadayken tekrar zıplayamaz', () => {
    let r = createRunner('a');
    r = stepRunner(r, { lateral: 0, jump: true }, 0.016, 0, track);
    const vyAfterJump = r.vy;
    r = stepRunner(r, { lateral: 0, jump: true }, 0.016, 0.016, track);
    expect(r.vy).toBeLessThan(vyAfterJump);
  });

  it('jump pad fırlatır', () => {
    let r = createRunner('a');
    r.s = 9.5;
    r = stepRunner(r, noInput, 0.016, 0, padTrack);
    expect(r.grounded).toBe(false);
    expect(r.vy).toBeGreaterThan(PHYSICS.JUMP_VELOCITY);
  });

  it('bitiş çizgisinde finished olur', () => {
    let r = createRunner('a');
    r.s = track.length - 1;
    r.lastInputAt = 74;
    r = stepRunner(r, noInput, 0.5, 75, track);
    expect(r.finished).toBe(true);
    expect(r.finishTime).toBe(75);
  });

  it('bitiren koşucu hareket etmez', () => {
    const r = createRunner('a');
    r.finished = true;
    r.s = 500;
    const next = stepRunner(r, noInput, 1, 10, track);
    expect(next.s).toBe(500);
  });
});

describe('engeller', () => {
  const ob = { id: 'o1', s: 100, x: 0, ownerId: 'enemy', expiresAt: 999 };

  it('çarpışma tespit edilir', () => {
    const r = createRunner('a');
    r.s = 100.5;
    expect(hitObstacle(r, [ob], 0)).toBe(ob);
  });

  it('kendi engeline çarpmaz', () => {
    const r = createRunner('enemy');
    r.s = 100;
    expect(hitObstacle(r, [ob], 0)).toBeNull();
  });

  it('üstünden atlayınca çarpmaz', () => {
    const r = createRunner('a');
    r.s = 100;
    r.y = 2;
    expect(hitObstacle(r, [ob], 0)).toBeNull();
  });

  it('KAPAN: basan kısa süre kilitlenir (stun), kalkan varsa etkilenmez', () => {
    const r = createRunner('a');
    const trapped = applyObstacleHit(r, 10);
    expect(trapped.effects.stunUntil).toBeCloseTo(10 + PHYSICS.TRAP_HOLD_DURATION);
    // Kapana kısılıyken ilerleyemez
    expect(computeForwardSpeed(trapped, 10.5, false)).toBe(0);
    // Süre dolunca kurtulur
    expect(computeForwardSpeed(trapped, 10 + PHYSICS.TRAP_HOLD_DURATION + 0.1, false)).toBeGreaterThan(0);

    const shielded = createRunner('b');
    shielded.effects.shieldUntil = 20;
    const after = applyObstacleHit(shielded, 10);
    expect(after.effects.stunUntil).toBe(0);
  });

  it('KAPAN kurtulunca 2 sn dokunulmazlık verir; dokunulmaz koşucu kapanı tetiklemez', () => {
    const r = createRunner('a');
    const trapped = applyObstacleHit(r, 10);
    expect(trapped.effects.invulnUntil).toBeCloseTo(
      10 + PHYSICS.TRAP_HOLD_DURATION + PHYSICS.INVULN_DURATION,
    );
    const inv = createRunner('c');
    inv.s = 100;
    inv.effects.invulnUntil = 99;
    expect(hitObstacle(inv, [ob], 10)).toBeNull();
    expect(applyObstacleHit(inv, 10).effects.stunUntil).toBe(0);
  });
});

describe('AFK diskalifiye', () => {
  it('30 sn girdisiz diskalifiye', () => {
    const r = createRunner('a');
    r.lastInputAt = 0;
    expect(checkDisqualify(r, RACE.AFK_DISQUALIFY_SECONDS).disqualified).toBe(true);
    expect(checkDisqualify(r, RACE.AFK_DISQUALIFY_SECONDS - 1).disqualified).toBe(false);
  });

  it('bitiren oyuncu diskalifiye edilmez', () => {
    const r = createRunner('a');
    r.finished = true;
    expect(checkDisqualify(r, 100).disqualified).toBe(false);
  });
});
