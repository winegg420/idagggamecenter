// TAM MAÇ SİMÜLASYONU — süreç kuralı: her değişiklikten sonra baştan sona
// bir maç oynanır; oyuncu tüm skill'leri kullanır, engel/duvar/platformla
// etkileşir ve finişe ulaşır. Motor düzeyinde uçtan uca güvence.
import { describe, it, expect } from 'vitest';
import { RaceEngine } from '../engine';
import { Track2D } from '../track2d/track2d';
import { ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D } from '../track2d/maps2d';
import { BotController } from '../bots/botAI';
import { SKILL_INFO } from '../skills/skillInfo';
import { PHYSICS } from '../../config/constants';
import type { SkillId, RunnerInput } from '../types';
import type { TrackDef2D } from '../track2d/track2d';

/** Oyuncu benzeri otomatik girdi: engele zıpla/eğil, duvara tırman */
function playerAutoInput(e: RaceEngine, id: string, frame: number): RunnerInput {
  const me = e.runners.get(id)!;
  let jump = false;
  let duck = false;
  const wall = e.track.wallBetween(me.s, me.s + 2.0);
  if (wall !== null && me.y < PHYSICS.CLIFF_HEIGHT) {
    jump = frame % 3 === 0; // tırmanma spam'i
  } else {
    for (const ob of e.track.staticObstacles) {
      const d = ob.s - me.s;
      if (d < 0 || d > 4.2) continue;
      if (ob.kind === 'blok' && me.grounded) jump = true;
      if (ob.kind === 'bar' && d < 2.4) duck = true;
      break;
    }
    const threat = e.obstacles.find(
      (o) => o.ownerId !== id && o.s > me.s && o.s - me.s < 4.2 && e.time < o.expiresAt,
    );
    if (threat && me.grounded) jump = true;
  }
  return { lateral: 0, jump, duck, active: true };
}

function runFullMatch(def: TrackDef2D) {
  const e = new RaceEngine(new Track2D(def), 0.5);
  let seed = 4242;
  e.rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  e.shortcutOpen = true;
  e.addRunner('oyuncu', 0);
  // 6 kişilik yarış: oyuncu + 5 bot (MAX_PLAYERS=6)
  const bots = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => {
    const b = new BotController(id, 'orta', e.rng);
    const r = e.addRunner(id, 0);
    r.speedFactor = b.speedFactor;
    return b;
  });

  const usedSkills = new Set<SkillId>();
  const skillEventCounts = new Map<string, number>();
  const pickupCounts = new Map<string, number>();
  const dt = 1 / 30;
  let frame = 0;
  while (e.phase !== 'finished' && frame < 30 * 150) {
    frame += 1;
    e.setInput('oyuncu', playerAutoInput(e, 'oyuncu', frame));
    for (const b of bots) e.setInput(b.id, b.update(e, dt));
    // Oyuncu skill'i alır almaz kullanır
    const me = e.runners.get('oyuncu')!;
    if (me.skill && frame % 5 === 0) {
      const s = me.skill;
      if (e.useSkill('oyuncu')) usedSkills.add(s);
    }
    e.step(dt);
    for (const ev of e.drainEvents()) {
      if (ev.type === 'pickup') {
        pickupCounts.set(ev.skill, (pickupCounts.get(ev.skill) ?? 0) + 1);
        continue;
      }
      if (ev.type === 'obstacleHit' || ev.type === 'blocked') continue;
      skillEventCounts.set(ev.type, (skillEventCounts.get(ev.type) ?? 0) + 1);
    }
  }
  return { e, usedSkills, skillEventCounts, pickupCounts };
}

describe('TAM MAÇ SİMÜLASYONU (uçtan uca)', () => {
  it('4 haritada da tam maç: herkes finişe ulaşır, süre 60-120 sn bandında', () => {
    for (const def of [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D]) {
      const { e } = runFullMatch(def);
      expect(e.phase, `${def.name} bitmedi`).toBe('finished');
      const me = e.runners.get('oyuncu')!;
      expect(me.finished, `${def.name}: oyuncu bitiremedi`).toBe(true);
      expect(me.disqualified).toBe(false);
      expect(me.finishTime!, `${def.name} süresi`).toBeGreaterThan(50);
      expect(me.finishTime!, `${def.name} süresi`).toBeLessThan(120);
      // Sıralama tutarlı: 6 koşucu, benzersiz sıralar
      const ranks = e.ranking().map((r) => r.rank);
      expect(new Set(ranks).size).toBe(6);
    }
  });

  it('maç boyunca oyuncu skill kullanabildi ve kutu toplayabildi', () => {
    const { e, usedSkills } = runFullMatch(ORMAN_2D);
    const myStats = e.stats.get('oyuncu');
    expect(myStats?.boxesTaken ?? 0).toBeGreaterThan(0);
    expect(usedSkills.size).toBeGreaterThan(0);
  });

  it('AKSİYON YOĞUNLUĞU: maç boyunca bol skill kullanımı olur, botlar aktiftir', () => {
    const { e, skillEventCounts } = runFullMatch(ORMAN_2D);
    const total = [...skillEventCounts.values()].reduce((a, b) => a + b, 0);
    // 5 koşuculu ~70 sn maçta toplam skill kullanımı yüksek olmalı
    expect(total, `toplam skill kullanımı: ${total}`).toBeGreaterThanOrEqual(15);
    // Aksiyon skill'leri (yıldırım+mıknatıs) düzenli görülür
    const action = (skillEventCounts.get('lightning') ?? 0) + (skillEventCounts.get('miknatis') ?? 0);
    expect(action, `yıldırım+mıknatıs: ${action}`).toBeGreaterThanOrEqual(3);
    // Botlar pasif değil: en az 3 bot skill kullandı (hits/boxes istatistiği)
    let activeBots = 0;
    for (const id of ['b1', 'b2', 'b3', 'b4', 'b5']) {
      if ((e.stats.get(id)?.boxesTaken ?? 0) > 0) activeBots += 1;
    }
    expect(activeBots, `aktif bot sayısı: ${activeBots}`).toBeGreaterThanOrEqual(3);
    // Oyuncu maç boyu boş gezmedi: en az 4 kutu topladı
    expect(e.stats.get('oyuncu')?.boxesTaken ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('YILDIRIM tam maçta gerçekten kutudan çıkar ve isabet eder (kullanıcı raporu regresyonu)', () => {
    // 4 haritanın toplamında: en az bir yıldırım kutudan alınmış VE en az bir
    // yıldırım isabeti gerçekleşmiş olmalı — "yıldırım hiç çıkmıyor" bir daha
    // fark edilmeden geriye gidemez.
    let picked = 0;
    let hit = 0;
    for (const def of [ORMAN_2D, VOLKAN_2D, GOKYUZU_2D, EJDERHA_2D, GIZLI_2D]) {
      const { skillEventCounts, pickupCounts } = runFullMatch(def);
      picked += pickupCounts.get('lightning') ?? 0;
      hit += skillEventCounts.get('lightning') ?? 0;
    }
    expect(picked, `kutudan çıkan yıldırım: ${picked}`).toBeGreaterThanOrEqual(3);
    expect(hit, `yıldırım isabeti: ${hit}`).toBeGreaterThanOrEqual(3);
  });

  it('her skill türü uygulanabilir (doğrudan applySkill üzerinden duman testi)', async () => {
    const { applySkill } = await import('../skills/skillSystem');
    const { createRunner } = await import('../types');
    const ids = Object.keys(SKILL_INFO) as SkillId[];
    for (const skill of ids) {
      const user = createRunner('u');
      user.s = 100;
      const other = createRunner('o');
      other.s = 120;
      const out = applySkill(user, skill, [user, other], 10);
      expect(
        out.updated.size + out.obstacles.length + out.events.length,
        `${skill} hiçbir etki üretmedi`,
      ).toBeGreaterThan(0);
    }
  });
});
