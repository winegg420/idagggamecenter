import { describe, it, expect } from 'vitest';
import { rollSkill, applySkill, targetAhead } from '../skills/skillSystem';
import { createRunner } from '../types';
import { PHYSICS, SKILLS } from '../../config/constants';
import type { SkillId } from '../types';

/** Deterministik rng dizisi */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function distribution(rank: number, total: number, n = 20000): Record<SkillId, number> {
  const counts: Record<string, number> = {};
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < n; i++) {
    const s = rollSkill(rank, total, rng);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts as Record<SkillId, number>;
}

describe('rollSkill', () => {
  it('altın skill çok nadir (lider için ~%0.4)', () => {
    const d = distribution(1, 5);
    const goldenRate = (d.golden ?? 0) / 20000;
    expect(goldenRate).toBeLessThan(0.01);
    expect(goldenRate).toBeGreaterThan(0.0005);
  });

  it('catch-up: sonuncuya güçlü skill (tier 2-3) daha sık çıkar', () => {
    const leader = distribution(1, 5);
    const last = distribution(5, 5);
    const strongOf = (d: Record<SkillId, number>) =>
      (d.shield ?? 0) + (d.knockback ?? 0) + (d.lightning ?? 0) + (d.miknatis ?? 0);
    expect(strongOf(last)).toBeGreaterThan(strongOf(leader) * 1.05);
  });

  it('catch-up abartılı değil: sonuncuda zayıf skill hâlâ anlamlı oranda çıkar', () => {
    // Aksiyon ayarı (2026-07-03): yıldırım/mıknatıs ağırlıkları bilinçli
    // yükseltildi; zayıf skill payı sonuncuda ~%25'e indi ama hâlâ düzenli
    // çıkıyor — eşik 0.2 (öndeki cezalandırılmıyor felsefesi korunuyor).
    const last = distribution(5, 5);
    const weak = (last.boost ?? 0) + (last.obstacle ?? 0);
    expect(weak / 20000).toBeGreaterThan(0.2);
  });

  it('aksiyon skill\'leri (yıldırım+mıknatıs) düzenli çıkar ama altın nadir kalır', () => {
    const mid = distribution(3, 5);
    const action = ((mid.lightning ?? 0) + (mid.miknatis ?? 0)) / 20000;
    expect(action).toBeGreaterThan(0.3); // yaklaşık her 3 kutudan biri
    expect((mid.golden ?? 0) / 20000).toBeLessThan(0.01); // altın hâlâ çok nadir
  });

  it('YILDIRIM kutudan düzenli çıkar — lider dahil hiçbir sırada filtrelenmez', () => {
    // Kullanıcı raporu (2026-07-03): "yıldırım hiç çıkmıyor". Kök sebep drop
    // tablosunda değildi (görsel efekt eksikti) — bu test drop payını kalıcı
    // güvenceye alır: her sırada yıldırım anlamlı oranda çıkmalı.
    for (const rank of [1, 3, 5]) {
      const d = distribution(rank, 5);
      const share = (d.lightning ?? 0) / 20000;
      expect(share, `rank ${rank} yıldırım payı: ${share}`).toBeGreaterThan(0.15);
    }
  });

  it('tek oyunculuda catch-up bölme hatası yok', () => {
    expect(() => rollSkill(1, 1, Math.random)).not.toThrow();
  });

  it('golden zarı deterministik tetiklenebilir', () => {
    expect(rollSkill(1, 5, seqRng([0]))).toBe('golden');
  });
});

describe('targetAhead', () => {
  it('öndeki en yakın koşucuyu seçer', () => {
    const me = createRunner('me');
    me.s = 100;
    const near = createRunner('near');
    near.s = 110;
    const far = createRunner('far');
    far.s = 150;
    const behind = createRunner('behind');
    behind.s = 90;
    expect(targetAhead(me, [me, near, far, behind])?.id).toBe('near');
  });

  it('önde kimse yoksa null', () => {
    const me = createRunner('me');
    me.s = 100;
    const behind = createRunner('b');
    behind.s = 50;
    expect(targetAhead(me, [me, behind])).toBeNull();
  });
});

describe('applySkill', () => {
  it('boost: hız süresi ayarlanır', () => {
    const me = createRunner('me');
    const out = applySkill(me, 'boost', [me], 10);
    expect(out.updated.get('me')!.effects.boostUntil).toBeCloseTo(10 + PHYSICS.BOOST_DURATION);
  });

  it('shield: kalkan süresi ayarlanır', () => {
    const me = createRunner('me');
    const out = applySkill(me, 'shield', [me], 10);
    expect(out.updated.get('me')!.effects.shieldUntil).toBeCloseTo(10 + PHYSICS.SHIELD_DURATION);
  });

  it('obstacle: arkasına engel bırakır', () => {
    const me = createRunner('me');
    me.s = 50;
    me.x = 2;
    const out = applySkill(me, 'obstacle', [me], 10);
    expect(out.obstacles).toHaveLength(1);
    expect(out.obstacles[0].s).toBeLessThan(50);
    expect(out.obstacles[0].x).toBe(2);
    expect(out.obstacles[0].ownerId).toBe('me');
  });

  it('knockback: öndeki rakibi geri savurur', () => {
    const me = createRunner('me');
    me.s = 100;
    const target = createRunner('t');
    target.s = 120;
    const out = applySkill(me, 'knockback', [me, target], 10);
    expect(out.updated.get('t')!.s).toBe(120 - PHYSICS.KNOCKBACK_DISTANCE);
  });

  it('knockback: HEDEF SEÇİLİRSE otomatik en yakını değil, seçileni vurur', () => {
    const me = createRunner('me');
    me.s = 100;
    const near = createRunner('near');
    near.s = 110; // otomatik seçim bunu vururdu
    const far = createRunner('far');
    far.s = 160; // ama oyuncu bunu seçti
    const out = applySkill(me, 'knockback', [me, near, far], 10, 'far');
    expect(out.updated.has('near')).toBe(false);
    expect(out.updated.get('far')!.s).toBe(160 - PHYSICS.KNOCKBACK_DISTANCE);
    expect(out.events[0].targetId).toBe('far');
  });

  it('knockback: GEÇERSİZ hedef seçilirse otomatik hedefe düşer (skill boşa gitmez)', () => {
    const me = createRunner('me');
    me.s = 100;
    const near = createRunner('near');
    near.s = 110;
    const out = applySkill(me, 'knockback', [me, near], 10, 'yok-boyle-biri');
    expect(out.updated.get('near')!.s).toBe(110 - PHYSICS.KNOCKBACK_DISTANCE);
  });

  it('lightning: öndeki rakibi sersemletir ve yavaşlatır', () => {
    const me = createRunner('me');
    me.s = 100;
    const target = createRunner('t');
    target.s = 130;
    const out = applySkill(me, 'lightning', [me, target], 10);
    const t = out.updated.get('t')!;
    expect(t.effects.stunUntil).toBeCloseTo(10 + PHYSICS.LIGHTNING_STUN_DURATION);
    expect(t.effects.slowUntil).toBeGreaterThan(t.effects.stunUntil);
  });

  it('YILDIRIM ALAN ETKİLİ: dokunulmaz olmayan HERKESİ çarpar, kızartır, dokunulmaz yapar', () => {
    const me = createRunner('me');
    me.s = 100;
    const ahead = createRunner('a');
    ahead.s = 150;
    const behind = createRunner('b');
    behind.s = 60;
    const inv = createRunner('i');
    inv.s = 120;
    inv.effects.invulnUntil = 99; // dokunulmaz — çarpılmaz
    const out = applySkill(me, 'lightning', [me, ahead, behind, inv], 10);
    expect(out.updated.has('a')).toBe(true);
    expect(out.updated.has('b')).toBe(true);
    expect(out.updated.has('i')).toBe(false);
    const ae = out.updated.get('a')!.effects;
    expect(ae.friedUntil).toBeCloseTo(10 + PHYSICS.LIGHTNING_STUN_DURATION);
    expect(ae.invulnUntil).toBeCloseTo(
      10 + PHYSICS.LIGHTNING_STUN_DURATION + PHYSICS.INVULN_DURATION,
    );
  });

  it('dokunulmazlık saldırıları savuşturur: knockback etki etmez, skill harcanmaz', () => {
    const me = createRunner('me');
    me.s = 100;
    const target = createRunner('t');
    target.s = 130;
    target.effects.invulnUntil = 99;
    const out = applySkill(me, 'knockback', [me, target], 10);
    expect(out.updated.size).toBe(0);
    expect(out.events.length).toBe(0); // olay yok → motor skill'i harcamaz
  });

  it('LİDERKEN saldırı skill\'i arkadaki en yakın rakibi hedefler (buton kilitlenmez)', () => {
    const me = createRunner('me');
    me.s = 200; // birinci
    const chaser = createRunner('c1');
    chaser.s = 180;
    const far = createRunner('c2');
    far.s = 120;
    const kb = applySkill(me, 'knockback', [me, chaser, far], 10);
    expect(kb.updated.get('c1')!.s).toBe(180 - PHYSICS.KNOCKBACK_DISTANCE);
    expect(kb.updated.has('c2')).toBe(false);
    const lt = applySkill(me, 'lightning', [me, chaser, far], 10);
    expect(lt.updated.get('c1')!.effects.stunUntil).toBeGreaterThan(10);
  });

  it('kalkan saldırıyı engeller', () => {
    const me = createRunner('me');
    me.s = 100;
    const target = createRunner('t');
    target.s = 120;
    target.effects.shieldUntil = 20;
    const out = applySkill(me, 'knockback', [me, target], 10);
    expect(out.updated.size).toBe(0);
    expect(out.events[0].type).toBe('blocked');
  });

  it('mıknatıs: ÖNDEKİLER GERİ, ARKADAKİLER İLERİ çekilir (kullanıcıya doğru)', () => {
    const me = createRunner('me');
    me.s = 100;
    const near = createRunner('n');
    near.s = 106; // PULL(12)'den yakın — me.s+0.5'e kenetlenir
    const far = createRunner('f');
    far.s = 150;
    const behind = createRunner('b');
    behind.s = 80; // arkadaki İLERİ çekilir (80+12=92)
    const out = applySkill(me, 'miknatis', [me, near, far, behind], 10);
    expect(out.updated.get('n')!.s).toBe(100.5);
    expect(out.updated.get('f')!.s).toBe(150 - PHYSICS.MAGNET_PULL);
    expect(out.updated.get('b')!.s).toBe(80 + PHYSICS.MAGNET_PULL);
    expect(out.events.some((e) => e.type === 'miknatis')).toBe(true);
  });

  it('mıknatıs: LİDERKEN arkadakileri kendine doğru ÖNE çeker, kalkan korur', () => {
    const me = createRunner('me');
    me.s = 200;
    const chaser = createRunner('c');
    chaser.s = 190; // 190+12=202 → me.s-0.5=199.5'e kenetlenir
    const shieldedR = createRunner('s');
    shieldedR.s = 180;
    shieldedR.effects.shieldUntil = 99;
    const out = applySkill(me, 'miknatis', [me, chaser, shieldedR], 10);
    expect(out.updated.get('c')!.s).toBe(199.5);
    expect(out.updated.has('s')).toBe(false);
    expect(out.events.some((e) => e.type === 'blocked' && e.targetId === 's')).toBe(true);
  });

  it('golden: kalkanı olmayan tüm rakipleri dondurur', () => {
    const me = createRunner('me');
    const a = createRunner('a');
    const b = createRunner('b');
    b.effects.shieldUntil = 99;
    const out = applySkill(me, 'golden', [me, a, b], 10);
    expect(out.updated.get('a')!.effects.frozenUntil).toBeCloseTo(
      10 + PHYSICS.GOLDEN_FREEZE_DURATION,
    );
    expect(out.updated.has('b')).toBe(false);
    expect(out.updated.has('me')).toBe(false);
  });
});

describe('altın skill maç bazında nadirlik', () => {
  it('ortalama bir maçta (≈15 kutu) altın çıkma olasılığı düşük', () => {
    // 15 kutu açılışında en az bir altın görme olasılığı: 1-(1-p)^15
    const p = SKILLS.GOLDEN_BASE_CHANCE * 2; // en gerideki oyuncu için en yüksek şans
    const perMatch = 1 - Math.pow(1 - p, 15);
    expect(perMatch).toBeLessThan(0.15); // maçların ~%85+'inde hiç çıkmaz
  });
});
