import { describe, it, expect } from 'vitest';
import { InterpolationBuffer } from '../../net/interpolation';
import { packPos, effectFlags, hasFlag, EFFECT_FLAGS } from '../../net/protocol';
import { generateRoomCode } from '../../net/roomClient';
import { NETWORK } from '../../config/constants';

describe('InterpolationBuffer', () => {
  it('iki kare arasında doğrusal interpolasyon yapar', () => {
    const buf = new InterpolationBuffer();
    const base = 100000;
    buf.push({ t: base, s: 10, x: 0, y: 0, f: 0 });
    buf.push({ t: base + 100, s: 20, x: 1, y: 0, f: 0 });
    // renderT = now - 150 → now = base + 200 iken renderT = base + 50 (tam ortada)
    const st = buf.sample(base + 200 + (NETWORK.INTERP_DELAY_MS - 150));
    expect(st).not.toBeNull();
    expect(st!.s).toBeCloseTo(15, 1);
    expect(st!.x).toBeCloseTo(0.5, 1);
    expect(st!.stale).toBe(false);
  });

  it('eski (sıra dışı) paketleri atar', () => {
    const buf = new InterpolationBuffer();
    buf.push({ t: 2000, s: 20, x: 0, y: 0, f: 0 });
    buf.push({ t: 1000, s: 10, x: 0, y: 0, f: 0 });
    expect(buf.lastSnapshot!.s).toBe(20);
  });

  it('2 sn mesaj gelmezse stale (kopuk) işaretler ve son konumda dondurur', () => {
    const buf = new InterpolationBuffer();
    buf.push({ t: 1000, s: 50, x: 2, y: 0, f: 0 });
    const st = buf.sample(1000 + 2500);
    expect(st!.stale).toBe(true);
    expect(st!.s).toBe(50);
    expect(st!.x).toBe(2);
  });

  it('boş tamponda null döner', () => {
    const buf = new InterpolationBuffer();
    expect(buf.sample(Date.now())).toBeNull();
  });

  it('aşırı ileri tahmin yapmaz (maks 200ms)', () => {
    const buf = new InterpolationBuffer();
    buf.push({ t: 1000, s: 10, x: 0, y: 0, f: 0 });
    buf.push({ t: 1100, s: 11, x: 0, y: 0, f: 0 }); // 10 birim/sn hız
    const st = buf.sample(1100 + NETWORK.INTERP_DELAY_MS + 1000);
    // 200ms üstü tahmin kilitlenir: 11 + 0.2*10 = 13 en fazla
    expect(st!.s).toBeLessThanOrEqual(13.01);
  });
});

describe('protocol', () => {
  it('packPos değerleri yuvarlar (bant genişliği)', () => {
    const msg = packPos('u1', 123.456789, 1.23456, 0.98765, 5);
    expect(msg.s).toBe(123.5);
    expect(msg.x).toBe(1.23);
    expect(msg.y).toBe(0.99);
    expect(msg.f).toBe(5);
  });

  it('effectFlags bit alanı gidiş-dönüş doğru', () => {
    const f = effectFlags({
      boost: true,
      slow: false,
      stun: true,
      frozen: false,
      shield: true,
      grounded: true,
      finished: false,
    });
    expect(hasFlag(f, EFFECT_FLAGS.BOOST)).toBe(true);
    expect(hasFlag(f, EFFECT_FLAGS.SLOW)).toBe(false);
    expect(hasFlag(f, EFFECT_FLAGS.STUN)).toBe(true);
    expect(hasFlag(f, EFFECT_FLAGS.SHIELD)).toBe(true);
    expect(hasFlag(f, EFFECT_FLAGS.GROUNDED)).toBe(true);
    expect(hasFlag(f, EFFECT_FLAGS.FINISHED)).toBe(false);
  });
});

describe('generateRoomCode', () => {
  it('6 karakter, karışıklık yaratan karakterler yok (0/O/1/I/Q/W/X)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPRSTUVYZ23456789]+$/);
    }
  });
});
