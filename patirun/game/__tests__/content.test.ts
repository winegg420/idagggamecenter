import { describe, it, expect } from 'vitest';
import { CHARACTERS, getCharacter, levelForXp, xpForRace } from '../characters/characters';
import { Track2D, SHORTCUT_MIN_Y } from '../track2d/track2d';
import {
  ORMAN_2D,
  VOLKAN_2D,
  GOKYUZU_2D,
  EJDERHA_2D,
  GIZLI_2D,
  availableMaps2D,
  getMap2D,
} from '../track2d/maps2d';
import { PHYSICS } from '../../config/constants';
import { stepRunner } from '../physics';
import { createRunner } from '../types';

describe('karakterler', () => {
  it('tam 20 özgün karakter var', () => {
    expect(CHARACTERS).toHaveLength(20);
    const ids = new Set(CHARACTERS.map((c) => c.id));
    expect(ids.size).toBe(20);
    const names = new Set(CHARACTERS.map((c) => c.name));
    expect(names.size).toBe(20);
  });

  it('her karakterin varsayılan kozmetik kombinasyonu ve ses perdesi var', () => {
    for (const c of CHARACTERS) {
      expect(c.defaultCosmetics).toBeDefined();
      expect(c.voicePitch).toBeGreaterThan(50);
      expect(c.bio.length).toBeGreaterThan(5);
    }
  });

  it('bilinmeyen id ilk karaktere düşer', () => {
    expect(getCharacter('olmayan').id).toBe(CHARACTERS[0].id);
  });
});

describe('karakter XP', () => {
  it('yarış XP: kazanan daha fazla alır', () => {
    const first = xpForRace(1, 5);
    const last = xpForRace(5, 5);
    expect(first).toBeGreaterThan(last);
    expect(last).toBeGreaterThanOrEqual(20);
  });

  it('seviye eşikleri artan XP ister', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(225)).toBe(3);
    expect(levelForXp(10000)).toBeGreaterThan(5);
  });
});

describe('haritalar (2D)', () => {
  const maps = [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D];

  it('4 harita da 60-90 sn hedefine uygun', () => {
    for (const def of maps) {
      const duration = def.length / PHYSICS.BASE_SPEED;
      expect(duration, `${def.name} süresi`).toBeGreaterThanOrEqual(60);
      expect(duration, `${def.name} süresi`).toBeLessThanOrEqual(90);
    }
  });

  it('her haritada zorunlu öğeler var: engeller (blok+bar), rampa, checkpoint, kutu, kısayol', () => {
    for (const def of maps) {
      const bloks = def.obstacles.filter((o) => o.kind === 'blok');
      const bars = def.obstacles.filter((o) => o.kind === 'bar');
      expect(bloks.length, `${def.name} blok`).toBeGreaterThanOrEqual(3);
      expect(bars.length, `${def.name} bar`).toBeGreaterThanOrEqual(2);
      expect(def.jumpPads.length, `${def.name} rampa`).toBeGreaterThanOrEqual(4);
      expect(def.checkpoints.length, `${def.name} checkpoint`).toBe(3);
      expect(def.skillBoxRows.length, `${def.name} kutu`).toBeGreaterThanOrEqual(5);
      expect(def.shortcut, `${def.name} kısayol`).toBeDefined();
    }
  });

  it('engeller jump pad ve kutularla çakışmaz (tepki payı var)', () => {
    for (const def of maps) {
      for (const ob of def.obstacles) {
        for (const pad of def.jumpPads) {
          expect(Math.abs(ob.at - pad) * def.length, `${def.name} engel-pad`).toBeGreaterThan(2);
        }
      }
    }
  });

  it('gizli harita ancak kilit açılınca listelenir', () => {
    expect(availableMaps2D(false).map((m) => m.id)).not.toContain('gizli');
    expect(availableMaps2D(true).map((m) => m.id)).toContain('gizli');
    expect(getMap2D('gizli').id).toBe('gizli');
  });
});

describe('gizli kısayol (2D hava koridoru)', () => {
  it('koridor içinde (havada) hız bonusu verir, yerde vermez', () => {
    const track = new Track2D(ORMAN_2D);
    const sc = ORMAN_2D.shortcut;
    const sMid = ((sc.entry + sc.exit) / 2) * track.length;

    const airborne = createRunner('a');
    airborne.s = sMid;
    airborne.y = SHORTCUT_MIN_Y + 0.5;
    airborne.grounded = false;
    airborne.vy = 2; // hâlâ yükseliyor — yerçekimi adımı y'yi bandın altına düşürmesin
    const grounded = createRunner('b');
    grounded.s = sMid;

    const s1 = stepRunner(airborne, { lateral: 0, jump: false, active: true }, 0.05, 10, track, [], true);
    const s2 = stepRunner(grounded, { lateral: 0, jump: false, active: true }, 0.05, 10, track, [], true);
    const gain1 = s1.s - airborne.s;
    const gain2 = s2.s - grounded.s;
    expect(gain1 / gain2).toBeCloseTo(PHYSICS.SHORTCUT_MULTIPLIER, 1);
  });

  it('kısayol kapalıyken bonus yok', () => {
    const track = new Track2D(ORMAN_2D);
    const sc = ORMAN_2D.shortcut;
    const sMid = ((sc.entry + sc.exit) / 2) * track.length;
    const r = createRunner('a');
    r.s = sMid;
    r.y = SHORTCUT_MIN_Y + 0.5;
    r.grounded = false;
    const stepped = stepRunner(r, { lateral: 0, jump: false, active: true }, 0.05, 10, track, [], false);
    expect(stepped.s - r.s).toBeCloseTo(PHYSICS.BASE_SPEED * 0.05, 3);
  });
});

describe('üst yol / alt yol (platformlar)', () => {
  const track = new Track2D(ORMAN_2D);
  const plat = track.platformList[0];

  it('her haritada en az bir çatal (platform) var', () => {
    for (const def of [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D]) {
      expect(def.platforms.length, `${def.name} platform`).toBeGreaterThanOrEqual(1);
    }
  });

  it('düşerken platform yüzeyini kesen koşucu üst yola iner', () => {
    let r = createRunner('a');
    r.s = plat.s0 + 3;
    r.y = plat.y + 0.5;
    r.vy = -1;
    r.grounded = false;
    for (let i = 0; i < 30 && !r.grounded; i++) {
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + i / 30, track);
    }
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(plat.y);
  });

  it('platform kenarından çıkan koşucu düşer ve zemine iner', () => {
    let r = createRunner('a');
    r.s = plat.s1 - 0.3;
    r.y = plat.y;
    r.grounded = true;
    // Kenarı geç
    for (let i = 0; i < 60 && (r.y > 0 || !r.grounded); i++) {
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + i / 30, track);
    }
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(0);
    expect(r.s).toBeGreaterThan(plat.s1);
  });

  it('platformda eğilen koşucu alt yola iner (drop)', () => {
    let r = createRunner('a');
    r.s = plat.s0 + 5;
    r.y = plat.y;
    r.grounded = true;
    r = stepRunner(r, { lateral: 0, jump: false, duck: true, active: true }, 1 / 30, 10, track);
    expect(r.grounded).toBe(false);
    for (let i = 0; i < 60 && !r.grounded; i++) {
      r = stepRunner(r, { lateral: 0, jump: false, duck: true, active: true }, 1 / 30, 10 + i / 30, track);
    }
    expect(r.y).toBe(0);
  });

  it('havada eğilme hızlı iniş yapar (zıplama kısalır)', () => {
    const jumpAndMeasure = (fastFall: boolean) => {
      let r = createRunner('a');
      r.s = 5; // platform/pad bölgesinden uzak
      r = stepRunner(r, { lateral: 0, jump: true, active: true }, 1 / 30, 10, track);
      let frames = 0;
      while (!r.grounded && frames < 120) {
        frames += 1;
        r = stepRunner(
          r,
          { lateral: 0, jump: false, duck: fastFall && frames > 3, active: true },
          1 / 30,
          10 + frames / 30,
          track,
        );
      }
      return frames;
    };
    expect(jumpAndMeasure(true)).toBeLessThan(jumpAndMeasure(false));
  });

  it('jump pad platform üzerindeyken tetiklenmez (sadece zeminde)', () => {
    // Yapay pist: pad tam platformun ortasında — üstteki koşucu fırlamamalı
    const custom = new Track2D({
      ...ORMAN_2D,
      jumpPads: [0.5],
      platforms: [{ start: 0.45, end: 0.55, y: 2.2 }],
    });
    let r = createRunner('a');
    r.s = custom.jumpPadS[0] - 0.3;
    r.y = 2.2;
    r.grounded = true;
    r = stepRunner(r, { lateral: 0, jump: false, active: true }, 0.05, 10, custom);
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(2.2);
  });
});

describe('su bölümleri (yüzme)', () => {
  it('en az bir haritada su var; su bölgesi pad/duvar/engel içermez', () => {
    const withWater = [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D].filter(
      (d) => d.water.length > 0,
    );
    expect(withWater.length).toBeGreaterThanOrEqual(1);
    for (const def of [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D]) {
      for (const wz of def.water) {
        for (const pad of def.jumpPads) {
          expect(pad < wz.start || pad > wz.end, `${def.name} pad suda`).toBe(true);
        }
        for (const w of def.walls) {
          expect(w < wz.start || w > wz.end, `${def.name} duvar suda`).toBe(true);
        }
        for (const ob of def.obstacles) {
          expect(ob.at < wz.start || ob.at > wz.end, `${def.name} engel suda`).toBe(true);
        }
      }
    }
  });

  it('suda hız düşer (yüzme), sudan çıkınca normale döner', () => {
    const track = new Track2D(ORMAN_2D);
    const wz = track.waterZones[0];
    const inWater = createRunner('a');
    inWater.s = (wz.s0 + wz.s1) / 2;
    const onLand = createRunner('b');
    onLand.s = 20;
    const s1 = stepRunner(inWater, { lateral: 0, jump: false, active: true }, 0.05, 10, track);
    const s2 = stepRunner(onLand, { lateral: 0, jump: false, active: true }, 0.05, 10, track);
    const gainWater = s1.s - inWater.s;
    const gainLand = s2.s - onLand.s;
    expect(gainWater / gainLand).toBeCloseTo(PHYSICS.WATER_SPEED_FACTOR, 1);
  });

  it('suda eğilme olmaz', () => {
    const track = new Track2D(ORMAN_2D);
    const wz = track.waterZones[0];
    let r = createRunner('a');
    r.s = (wz.s0 + wz.s1) / 2;
    r = stepRunner(r, { lateral: 0, jump: false, duck: true, active: true }, 0.03, 10, track);
    expect(r.ducking).toBe(false);
  });

  it('DERİN SU: EĞİL spam ile hızla EN DİBE inilir', () => {
    // Uzun yapay su bölümü: test boyunca sudan çıkılmasın
    const track = new Track2D({ ...ORMAN_2D, water: [{ start: 0.3, end: 0.95 }] });
    let r = createRunner('a');
    r.s = 0.35 * track.length;
    const dt = 1 / 30;
    // EĞİL spam'i: aç/kapa = her iki karede bir yeni basış (itki)
    for (let i = 0; i < 45; i++) {
      r = stepRunner(r, { lateral: 0, jump: false, duck: i % 2 === 0, active: true }, dt, 10, track);
    }
    expect(r.y, 'spam dalışla dibe inilmeli').toBeLessThan(-(PHYSICS.WATER_DEPTH - 1));
    expect(r.y).toBeGreaterThanOrEqual(-PHYSICS.WATER_DEPTH);
  });

  it('YUNUS FIRLAMASI: dipten ZIPLA spam ile sudan fırlar, karaya koşarak iner', () => {
    const track = new Track2D(ORMAN_2D);
    const wz = track.waterZones[0];
    let r = createRunner('a');
    r.s = wz.s1 - 8; // bölüm sonuna yakın, dipten fırlayış
    r.y = -(PHYSICS.WATER_DEPTH - 0.4);
    const dt = 1 / 30;
    let leaped = false;
    let landedRunning = false;
    for (let i = 0; i < 30 * 5; i++) {
      r = stepRunner(r, { lateral: 0, jump: true, duck: false, active: true }, dt, 10 + i * dt, track);
      if (r.y > 0.3 && !r.grounded) leaped = true; // sudan havaya fırladı
      if (leaped && r.grounded && r.y === 0 && !track.waterAt(r.s)) {
        landedRunning = true; // karaya indi, koşu devam
        break;
      }
    }
    expect(leaped, 'yüzeyden yunus gibi fırlamalı').toBe(true);
    expect(landedRunning, 'karaya inip koşmaya devam etmeli').toBe(true);
  });

  it('su bölümü bitince dipteki koşucu kendiliğinden yüzeye tırmanır', () => {
    const track = new Track2D(ORMAN_2D);
    const wz = track.waterZones[0];
    let r = createRunner('a');
    r.s = wz.s1 - 0.5;
    r.y = -(PHYSICS.WATER_DEPTH - 0.4);
    for (let i = 0; i < 60; i++) {
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + i / 30, track);
    }
    expect(r.y).toBe(0);
  });
});

describe('kara yükseltisi (yamaç tırmanma + yükseltilmiş zeminde koşu)', () => {
  const track = new Track2D(ORMAN_2D);
  const wallS = track.wallS[0];

  it('her haritada en az bir yamaç var', () => {
    for (const def of [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D]) {
      expect(def.walls.length, `${def.name} yamaç`).toBeGreaterThanOrEqual(1);
    }
  });

  it('yükselti gerçek bir kara parçası: tırmanınca YÜKSEK zeminde koşulur, sonunda düşülür', () => {
    expect(PHYSICS.CLIFF_HEIGHT).toBeGreaterThanOrEqual(2.5);
    expect(PHYSICS.CLIFF_LENGTH).toBeGreaterThanOrEqual(30);
    expect(track.groundAt(wallS + 5)).toBe(PHYSICS.CLIFF_HEIGHT);
    expect(track.groundAt(wallS - 1)).toBe(0);
    expect(track.groundAt(wallS + PHYSICS.CLIFF_LENGTH + 1)).toBe(0);
  });

  it('tırmanan koşucu yükseltilmiş zeminde KOŞMAYA DEVAM eder (eski zemine düşmez)', () => {
    let r = createRunner('a');
    r.s = wallS - 6;
    let frames = 0;
    while (r.s < wallS + 8 && frames < 30 * 20) {
      frames += 1;
      const jump = frames % 3 === 0;
      r = stepRunner(r, { lateral: 0, jump, active: true }, 1 / 30, 10 + frames / 30, track);
    }
    expect(r.s).toBeGreaterThan(wallS + 6);
    // İniş otursun (tepeyi aştığı karede hâlâ havada olabilir)
    for (let i = 0; i < 15; i++) {
      frames += 1;
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + frames / 30, track);
    }
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(PHYSICS.CLIFF_HEIGHT); // yukarıdaki zeminde koşuyor
    // Yükselti bitince kenardan düşer, taban zemine iner (yüksek yamaçtan
    // düşüş sürebilir — kenarı geçtikten sonra inişin oturmasını bekle)
    while (r.s < wallS + PHYSICS.CLIFF_LENGTH + 3 && frames < 30 * 40) {
      frames += 1;
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + frames / 30, track);
    }
    for (let i = 0; i < 30 && !(r.grounded && r.y === 0); i++) {
      frames += 1;
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + frames / 30, track);
    }
    expect(r.y).toBe(0);
    expect(r.grounded).toBe(true);
  });

  it('zıplamayan koşucu yamacı GEÇEMEZ (önünde takılır)', () => {
    let r = createRunner('a');
    r.s = wallS - 8;
    for (let i = 0; i < 90; i++) {
      r = stepRunner(r, { lateral: 0, jump: false, active: true }, 1 / 30, 10 + i / 30, track);
    }
    expect(r.s).toBeLessThan(wallS);
  });

  it('arka arkaya zıplayan koşucu duvara tırmanıp aşar', () => {
    let r = createRunner('a');
    r.s = wallS - 8;
    let frames = 0;
    // Her 4 karede bir zıplama tuşuna bas (insan tıklaması taklidi)
    while (r.s < wallS + 3 && frames < 30 * 20) {
      frames += 1;
      const jump = frames % 4 === 0;
      r = stepRunner(r, { lateral: 0, jump, active: true }, 1 / 30, 10 + frames / 30, track);
    }
    expect(r.s).toBeGreaterThan(wallS);
  });
});

describe('eğilme (duck)', () => {
  it('yerdeyken duck girdisiyle eğilir, zıplayınca eğilme biter', () => {
    const track = new Track2D(ORMAN_2D);
    let r = createRunner('a');
    r = stepRunner(r, { lateral: 0, jump: false, duck: true, active: true }, 0.05, 1, track);
    expect(r.ducking).toBe(true);
    r = stepRunner(r, { lateral: 0, jump: true, duck: true, active: true }, 0.05, 1.05, track);
    expect(r.ducking).toBe(false);
    expect(r.grounded).toBe(false);
  });
});
