import { describe, it, expect } from 'vitest';
import { RaceEngine } from '../engine';
import { Track2D } from '../track2d/track2d';
import { ORMAN_2D } from '../track2d/maps2d';
import { PHYSICS } from '../../config/constants';

function makeEngine(countdown = 1): RaceEngine {
  return new RaceEngine(new Track2D(ORMAN_2D), countdown);
}

/** Engellere/duvara otomatik tepki veren basit girdi (testte takılmadan koşmak için) */
let autoFrame = 0;
function autoInput(e: RaceEngine, id: string) {
  const me = e.runners.get(id)!;
  autoFrame += 1;
  let jump = false;
  let duck = false;
  const wall = e.track.wallBetween(me.s, me.s + 2.0);
  if (wall !== null && me.y < PHYSICS.CLIFF_HEIGHT) {
    jump = autoFrame % 3 === 0; // duvar tırmanışı
  } else {
    for (const ob of e.track.staticObstacles) {
      const d = ob.s - me.s;
      if (d < 0 || d > 4.2) continue;
      if (ob.kind === 'blok' && me.grounded) jump = true;
      if (ob.kind === 'bar') duck = true;
      break;
    }
  }
  return { lateral: 0, jump, duck, active: true };
}

describe('RaceEngine (2D)', () => {
  it('geri sayım bitmeden koşucular hareket etmez', () => {
    const e = makeEngine(2);
    e.addRunner('p1');
    e.step(0.5);
    expect(e.phase).toBe('countdown');
    expect(e.runners.get('p1')!.s).toBe(0);
  });

  it('geri sayım bitince yarış başlar ve koşucu ilerler', () => {
    const e = makeEngine(1);
    e.addRunner('p1');
    e.setInput('p1', { lateral: 0, jump: false, active: true });
    for (let i = 0; i < 20; i++) e.step(0.1);
    expect(e.phase).toBe('racing');
    expect(e.runners.get('p1')!.s).toBeGreaterThan(0);
  });

  it('pist uzunluğu 60-90 sn hedefine uygun', () => {
    const track = new Track2D(ORMAN_2D);
    const duration = track.length / PHYSICS.BASE_SPEED;
    expect(duration).toBeGreaterThanOrEqual(60);
    expect(duration).toBeLessThanOrEqual(90);
  });

  it('yarışı bitiren koşucu finishOrder listesine girer, sıralama doğru', () => {
    const e = makeEngine(0.1);
    e.addRunner('hizli');
    e.addRunner('yavas');
    const dt = 1 / 30;
    for (let i = 0; i < 30 * 120 && e.phase !== 'finished'; i++) {
      e.setInput('hizli', autoInput(e, 'hizli'));
      e.setInput('yavas', autoInput(e, 'yavas'));
      const y = e.runners.get('yavas')!;
      if (i % 90 === 0 && !y.finished) {
        y.effects.slowUntil = e.time + 1;
        y.effects.slowFactor = 0.4;
      }
      e.step(dt);
    }
    expect(e.phase).toBe('finished');
    expect(e.finishOrder[0]).toBe('hizli');
    const ranking = e.ranking();
    expect(ranking[0].id).toBe('hizli');
    expect(ranking[0].rank).toBe(1);
    expect(ranking[1].id).toBe('yavas');
  });

  it('checkpoint sayacı ilerledikçe artar', () => {
    const track = new Track2D(ORMAN_2D);
    expect(track.checkpointsPassed(0)).toBe(0);
    expect(track.checkpointsPassed(track.length * 0.3)).toBe(1);
    expect(track.checkpointsPassed(track.length * 0.6)).toBe(2);
    expect(track.checkpointsPassed(track.length)).toBe(3);
  });

  it('girdisiz koşucu AFK donar ve sonra diskalifiye olur', () => {
    const e = makeEngine(0.1);
    e.addRunner('afk');
    const dt = 0.1;
    for (let i = 0; i < 400 && e.phase !== 'finished'; i++) e.step(dt);
    const r = e.runners.get('afk')!;
    expect(r.disqualified).toBe(true);
    expect(r.s).toBeLessThan(16 * PHYSICS.BASE_SPEED);
    expect(e.phase).toBe('finished');
  });

  it('sabit engele çarpan koşucu yavaşlar; aynı engele bir kez çarpılır', () => {
    const e = makeEngine(0.1);
    e.addRunner('p1');
    // Zıplamadan düz koş: ilk blok engeline çarpmalı
    const firstBlok = e.track.staticObstacles.find((o) => o.kind === 'blok')!;
    const dt = 1 / 30;
    let hits = 0;
    for (let i = 0; i < 30 * 20; i++) {
      e.setInput('p1', { lateral: 0, jump: false, active: true });
      e.step(dt);
      const hitEvents = e.drainEvents().filter((ev) => ev.type === 'obstacleHit');
      hits += hitEvents.length;
      if (e.runners.get('p1')!.s > firstBlok.s + 5) break;
    }
    expect(hits).toBe(1);
    expect(e.runners.get('p1')!.s).toBeGreaterThan(firstBlok.s); // takılıp kalmaz, yavaşlar
  });

  it('MERKEZE UZAK ŞERİTTE (x) başlayan oyuncu da kutu alır (MP grid hatası regresyonu)', () => {
    const e = makeEngine(0.1);
    // MP'de gridX oyuncuları -3.2..3.2 arası yayar; x 2D\'de hiç değişmez.
    // Kutular x=0'da — uzak şeritte başlayan oyuncu ESKİDEN kutuya değemiyordu.
    const r = e.addRunner('p1', 3.2);
    e.step(0.2);
    const box = e.boxes.find((b) => (b.y ?? 0) >= 0)!;
    e.runners.set('p1', { ...r, x: 3.2, s: box.s - 0.3, skill: null });
    e.step(1 / 30);
    expect(e.runners.get('p1')!.skill, 'uzak şeritte kutu alınamadı').not.toBeNull();
  });

  it('YAN YANA kutular art arda aynı skill vermez (herkese farklı şans)', () => {
    const e = makeEngine(0.1);
    let seed = 777;
    e.rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    e.addRunner('p1');
    e.addRunner('p2');
    e.addRunner('p3');
    e.step(0.2);
    const row = e.boxes.slice(0, 3); // ilk sıranın 3'lü dizisi
    const got: string[] = [];
    ['p1', 'p2', 'p3'].forEach((id, i) => {
      const r = e.runners.get(id)!;
      e.runners.set(id, { ...r, s: row[i].s - 0.3, skill: null });
      e.step(1 / 30);
      got.push(e.runners.get(id)!.skill!);
    });
    expect(got.every(Boolean)).toBe(true);
    expect(new Set(got).size, `dağıtılan: ${got.join(',')}`).toBe(3);
  });

  it('SU DİBİ kutusu: yüzeyden geçen ALAMAZ, dibe dalan ALIR', () => {
    const e = makeEngine(0.1);
    e.addRunner('p1');
    const deep = e.boxes.find((b) => (b.y ?? 0) < -1);
    expect(deep, 'su dibi kutusu spawn edilmedi').toBeTruthy();
    e.step(0.2); // yarış başlasın
    // Yüzeyden geçiş: alınmamalı
    const r0 = e.runners.get('p1')!;
    e.runners.set('p1', { ...r0, s: deep!.s - 0.4, y: 0 });
    e.step(1 / 30);
    expect(e.runners.get('p1')!.skill).toBeNull();
    // Dipten geçiş: alınmalı
    const r1 = e.runners.get('p1')!;
    e.runners.set('p1', {
      ...r1,
      s: deep!.s - 0.4,
      y: -(PHYSICS.WATER_DEPTH - 0.4),
      skill: null,
    });
    e.step(1 / 30);
    expect(e.runners.get('p1')!.skill).not.toBeNull();
  });

  it('zıplayan koşucu blok engelinden hasarsız geçer', () => {
    const e = makeEngine(0.1);
    e.addRunner('p1');
    const firstBlok = e.track.staticObstacles.find((o) => o.kind === 'blok')!;
    const dt = 1 / 30;
    let hits = 0;
    for (let i = 0; i < 30 * 20; i++) {
      const me = e.runners.get('p1')!;
      const jump = me.grounded && firstBlok.s - me.s > 0 && firstBlok.s - me.s < 4.2;
      e.setInput('p1', { lateral: 0, jump, active: true });
      e.step(dt);
      hits += e.drainEvents().filter((ev) => ev.type === 'obstacleHit').length;
      if (me.s > firstBlok.s + 5) break;
    }
    expect(hits).toBe(0);
  });

  it('eğilen koşucu bar engelinden hasarsız geçer, eğilmeyen çarpar', () => {
    const track = new Track2D(ORMAN_2D);
    const firstBar = track.staticObstacles.find((o) => o.kind === 'bar')!;
    const run = (duckNearBar: boolean) => {
      const e = new RaceEngine(new Track2D(ORMAN_2D), 0.1);
      e.addRunner('p1');
      const dt = 1 / 30;
      let hits = 0;
      for (let i = 0; i < 30 * 40; i++) {
        const me = e.runners.get('p1')!;
        // Bloklardan zıplayarak geç (bar testini izole et)
        let jump = false;
        for (const ob of e.track.staticObstacles) {
          const d = ob.s - me.s;
          if (ob.kind === 'blok' && d > 0 && d < 4.2 && me.grounded) jump = true;
        }
        const nearBar = Math.abs(firstBar.s - me.s) < 3;
        e.setInput('p1', { lateral: 0, jump, duck: duckNearBar && nearBar, active: true });
        e.step(dt);
        hits += e.drainEvents().filter((ev) => ev.type === 'obstacleHit').length;
        if (me.s > firstBar.s + 5) break;
      }
      return hits;
    };
    expect(run(true)).toBe(0);
    expect(run(false)).toBeGreaterThan(0);
  });
});
