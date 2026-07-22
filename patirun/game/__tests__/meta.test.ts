import { describe, it, expect } from 'vitest';
import { evaluateBadges, BADGES, getBadge } from '../badges';
import type { BadgeContext } from '../badges';
import { GhostRecorder, GhostPlayer, GHOST_SAMPLE_INTERVAL } from '../ghost';

function ctx(partial: Partial<BadgeContext>): BadgeContext {
  return {
    rank: 3,
    playerCount: 5,
    wasLastAtSomePoint: false,
    skillHits: 0,
    skillsTaken: 0,
    shieldBlocks: 0,
    lightningHit: false,
    goldenSeen: false,
    usedShortcut: false,
    night: false,
    totalRaces: 5,
    winStreak: 0,
    distinctMaps: 1,
    owned: new Set(),
    ...partial,
  };
}

describe('evaluateBadges', () => {
  it('ilk yarışta ilk-yaris rozetini verir', () => {
    expect(evaluateBadges(ctx({ totalRaces: 1 }))).toContain('ilk-yaris');
  });

  it('kazanınca ilk-galibiyet verir, tek kişilik yarışta vermez', () => {
    expect(evaluateBadges(ctx({ rank: 1, playerCount: 5 }))).toContain('ilk-galibiyet');
    expect(evaluateBadges(ctx({ rank: 1, playerCount: 1 }))).not.toContain('ilk-galibiyet');
  });

  it('sahip olunan rozet tekrar verilmez', () => {
    const owned = new Set(['ilk-yaris']);
    expect(evaluateBadges(ctx({ totalRaces: 1, owned }))).not.toContain('ilk-yaris');
  });

  it('sondan-birinci: son sıradayken kazanmak gerekir', () => {
    expect(evaluateBadges(ctx({ rank: 1, wasLastAtSomePoint: true }))).toContain('sondan-birinci');
    expect(evaluateBadges(ctx({ rank: 2, wasLastAtSomePoint: true }))).not.toContain('sondan-birinci');
  });

  it('yıldırım / altın / kısayol / kalkan rozetleri', () => {
    expect(evaluateBadges(ctx({ lightningHit: true }))).toContain('ilk-yildirim');
    expect(evaluateBadges(ctx({ goldenSeen: true }))).toContain('altin-gordun');
    expect(evaluateBadges(ctx({ usedShortcut: true }))).toContain('kisayolcu');
    expect(evaluateBadges(ctx({ shieldBlocks: 3 }))).toContain('kalkan-ustasi');
    expect(evaluateBadges(ctx({ shieldBlocks: 2 }))).not.toContain('kalkan-ustasi');
  });

  it('seri ve sayı eşikleri', () => {
    expect(evaluateBadges(ctx({ winStreak: 3 }))).toContain('uc-ust-uste');
    expect(evaluateBadges(ctx({ totalRaces: 10 }))).toContain('on-yaris');
    expect(evaluateBadges(ctx({ totalRaces: 100 }))).toContain('yuz-yaris');
    expect(evaluateBadges(ctx({ distinctMaps: 4 }))).toContain('tum-haritalar');
  });

  it('tüm rozet id\'leri tanımlı ve benzersiz', () => {
    const ids = new Set(BADGES.map((b) => b.id));
    expect(ids.size).toBe(BADGES.length);
    expect(getBadge('ilk-yaris')).toBeDefined();
    expect(getBadge('olmayan')).toBeUndefined();
  });
});

describe('Ghost kayıt/oynatma', () => {
  it('örnekleme aralığından sık kayıt almaz', () => {
    const rec = new GhostRecorder();
    rec.record(0, 0, 0, 0);
    rec.record(GHOST_SAMPLE_INTERVAL / 2, 1, 0, 0); // çok erken — atlanır
    rec.record(GHOST_SAMPLE_INTERVAL + 0.01, 2, 0, 0);
    expect(rec.frameCount).toBe(2);
  });

  it('serialize → GhostPlayer gidiş-dönüş + interpolasyon', () => {
    const rec = new GhostRecorder();
    rec.record(0, 0, 0, 0);
    rec.record(1, 12, 1, 0);
    rec.record(2, 24, 2, 0);
    const player = new GhostPlayer(rec.serialize());
    expect(player.valid).toBe(true);
    const mid = player.sample(0.5);
    expect(mid!.s).toBeCloseTo(6, 0);
    expect(mid!.x).toBeCloseTo(0.5, 1);
    // Aralık dışı: uçlara sabitlenir
    expect(player.sample(-1)!.s).toBe(0);
    expect(player.sample(99)!.s).toBe(24);
  });

  it('bozuk/boş veriyle geçersiz olur', () => {
    expect(new GhostPlayer(null).valid).toBe(false);
    expect(new GhostPlayer([1, 2]).valid).toBe(false);
  });
});
