import { describe, it, expect } from 'vitest';
import { RaceEngine } from '../engine';
import { Track2D } from '../track2d/track2d';
import { ORMAN_2D } from '../track2d/maps2d';
import { BotController } from '../bots/botAI';

function simulateRace(difficulty: 'kolay' | 'orta' | 'zor', seconds = 120) {
  const e = new RaceEngine(new Track2D(ORMAN_2D), 0.1);
  let seed = 777;
  e.rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const bots = ['b1', 'b2', 'b3'].map((id) => {
    const bot = new BotController(id, difficulty, e.rng);
    const r = e.addRunner(id, 0);
    r.speedFactor = bot.speedFactor;
    return bot;
  });
  const dt = 1 / 30;
  let obstacleHits = 0;
  for (let i = 0; i < 30 * seconds && e.phase !== 'finished'; i++) {
    for (const bot of bots) e.setInput(bot.id, bot.update(e, dt));
    e.step(dt);
    obstacleHits += e.drainEvents().filter((ev) => ev.type === 'obstacleHit').length;
  }
  return { e, obstacleHits };
}

describe('BotController (2D)', () => {
  it('botlar geçerli girdi üretir', () => {
    const e = new RaceEngine(new Track2D(ORMAN_2D), 0.1);
    const bot = new BotController('b1', 'orta');
    e.addRunner('b1');
    e.step(0.2);
    const input = bot.update(e, 1 / 30);
    expect(input.lateral).toBe(0);
    expect(typeof input.jump).toBe('boolean');
    expect(input.active).toBe(true);
  });

  it('botlar yarışı bitirir (AFK diskalifiye olmadan)', () => {
    const { e } = simulateRace('orta');
    expect(e.phase).toBe('finished');
    for (const id of ['b1', 'b2', 'b3']) {
      const r = e.runners.get(id)!;
      expect(r.disqualified).toBe(false);
      expect(r.finished).toBe(true);
    }
  });

  it('botlar skill kutusu toplar ve kullanır', () => {
    const { e } = simulateRace('zor');
    let totalBoxes = 0;
    for (const [, st] of e.stats) totalBoxes += st.boxesTaken;
    expect(totalBoxes).toBeGreaterThan(0);
  });

  it('zor botlar kolay botlardan hızlı bitirir', () => {
    const kolay = simulateRace('kolay');
    const zor = simulateRace('zor');
    const avg = (e: RaceEngine) => {
      const times = [...e.runners.values()]
        .filter((r) => r.finishTime !== null)
        .map((r) => r.finishTime!);
      return times.reduce((a, b) => a + b, 0) / times.length;
    };
    expect(avg(zor.e)).toBeLessThan(avg(kolay.e));
  });

  it('her botun hızı FARKLI (kişilik) ve orta/zor botlar oyuncuyu geçebilir (>1 çarpan mümkün)', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const factors = Array.from({ length: 8 }, (_, i) => new BotController(`x${i}`, 'orta', rng).speedFactor);
    expect(new Set(factors.map((f) => f.toFixed(4))).size).toBeGreaterThan(4); // hepsi aynı değil
    for (const f of factors) {
      expect(f).toBeGreaterThanOrEqual(0.92);
      expect(f).toBeLessThanOrEqual(1.02);
    }
    // Aralığın üst ucu 1'in üzerinde: bot oyuncudan hızlı OLABİLİR
    expect(Math.max(...Array.from({ length: 40 }, (_, i) => new BotController(`y${i}`, 'orta', rng).speedFactor))).toBeGreaterThan(1);
  });

  it('finiş yapay eşitlenmez: slipstream son düzlükte kapalı', async () => {
    const { PHYSICS } = await import('../../config/constants');
    expect(PHYSICS.SLIPSTREAM_CUTOFF_FRAC).toBeLessThan(1);
  });

  it('zor botlar engellere kolay botlardan daha az çarpar', () => {
    const kolay = simulateRace('kolay');
    const zor = simulateRace('zor');
    expect(zor.obstacleHits).toBeLessThanOrEqual(kolay.obstacleHits);
  });
});
