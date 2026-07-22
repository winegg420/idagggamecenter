// Skill dağılımı (catch-up dahil) ve skill etkileri — saf fonksiyonlar, birim testli.
import { PHYSICS, SKILLS } from '../../config/constants';
import type { RunnerState, SkillId, TrackObstacle } from '../types';
import { SKILL_INFO } from './skillInfo';

export type Rng = () => number;

/**
 * Kutudan çıkacak skill'i belirler.
 * Catch-up: geride kalan oyuncuda yüksek kademeli (tier 2-3) skill ağırlığı
 * hafifçe artar; liderde hiçbir bonus yok. Altın skill ayrı ve ÇOK nadir zarla.
 */
export function rollSkill(rank: number, totalRunners: number, rng: Rng): SkillId {
  // Konum faktörü: lider 0, sonuncu 1
  const p = totalRunners > 1 ? (rank - 1) / (totalRunners - 1) : 0;

  // Altın skill: taban olasılık çok düşük; geride kalana hafif artış
  const goldenChance = SKILLS.GOLDEN_BASE_CHANCE * (1 + p);
  if (rng() < goldenChance) return 'golden';

  const regulars = Object.values(SKILL_INFO).filter((s) => s.id !== 'golden');
  const weights = regulars.map((s) => {
    // Kademesi yüksek skill'lerin ağırlığı geride kalan için artar
    const bonus = 1 + SKILLS.CATCHUP_MAX_BONUS * p * (s.tier - 1);
    return s.weight * bonus;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < regulars.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return regulars[i].id;
  }
  return regulars[regulars.length - 1].id;
}

export interface SkillEvent {
  type:
    | 'boost'
    | 'obstacle'
    | 'shield'
    | 'knockback'
    | 'lightning'
    | 'miknatis'
    | 'golden'
    | 'blocked';
  userId: string;
  targetId?: string;
}

export interface SkillOutcome {
  /** id → güncellenmiş koşucu (değişenler) */
  updated: Map<string, RunnerState>;
  /** Yeni doğan engeller */
  obstacles: TrackObstacle[];
  events: SkillEvent[];
}

/** Hedef seçimi: kullanıcının önündeki en yakın koşucu. */
export function targetAhead(user: RunnerState, all: RunnerState[]): RunnerState | null {
  let best: RunnerState | null = null;
  for (const r of all) {
    if (r.id === user.id || r.finished || r.disqualified || r.s <= user.s) continue;
    if (!best || r.s < best.s) best = r;
  }
  return best;
}

/**
 * Saldırı hedefi: önce öndeki en yakın; önde kimse yoksa (liderlik) arkadaki
 * en yakın rakip. Böylece saldırı skill'i asla kullanılamaz duruma düşmez.
 */
export function pickAttackTarget(user: RunnerState, all: RunnerState[]): RunnerState | null {
  const ahead = targetAhead(user, all);
  if (ahead) return ahead;
  let best: RunnerState | null = null;
  for (const r of all) {
    if (r.id === user.id || r.finished || r.disqualified || r.s > user.s) continue;
    if (!best || r.s > best.s) best = r;
  }
  return best;
}

let obstacleSeq = 0;

/**
 * Skill etkisini uygular. Koşucuları mutate etmez; değişen kopyaları döner.
 * Kalkanlı hedefe gelen saldırı 'blocked' olayı üretir.
 */
export function applySkill(
  user: RunnerState,
  skill: SkillId,
  all: RunnerState[],
  now: number,
  /** Tek hedefli skill'de (knockback) oyuncunun elle seçtiği hedef. */
  preferredTargetId?: string,
): SkillOutcome {
  const out: SkillOutcome = { updated: new Map(), obstacles: [], events: [] };
  const shielded = (r: RunnerState) => now < r.effects.shieldUntil;

  switch (skill) {
    case 'boost': {
      out.updated.set(user.id, {
        ...user,
        effects: { ...user.effects, boostUntil: now + PHYSICS.BOOST_DURATION },
      });
      out.events.push({ type: 'boost', userId: user.id });
      break;
    }
    case 'shield': {
      out.updated.set(user.id, {
        ...user,
        effects: { ...user.effects, shieldUntil: now + PHYSICS.SHIELD_DURATION },
      });
      out.events.push({ type: 'shield', userId: user.id });
      break;
    }
    case 'obstacle': {
      out.obstacles.push({
        id: `ob-${++obstacleSeq}`,
        s: Math.max(0, user.s - 2.5),
        x: user.x,
        ownerId: user.id,
        expiresAt: now + 25,
      });
      out.events.push({ type: 'obstacle', userId: user.id });
      break;
    }
    case 'knockback': {
      // Oyuncu bir hedef seçtiyse onu kullan (geçerliyse); yoksa otomatik seç
      const chosen =
        preferredTargetId &&
        all.find(
          (r) =>
            r.id === preferredTargetId &&
            r.id !== user.id &&
            !r.finished &&
            !r.disqualified,
        );
      const target = chosen || pickAttackTarget(user, all);
      if (!target) break;
      if (now < target.effects.invulnUntil) break; // dokunulmaz — skill harcanmaz
      if (shielded(target)) {
        out.events.push({ type: 'blocked', userId: user.id, targetId: target.id });
        break;
      }
      out.updated.set(target.id, {
        ...target,
        s: Math.max(0, target.s - PHYSICS.KNOCKBACK_DISTANCE),
      });
      out.events.push({ type: 'knockback', userId: user.id, targetId: target.id });
      break;
    }
    case 'lightning': {
      // ALAN ETKİLİ elektrik: dokunulmaz (invuln) olmayan TÜM rakipleri çarpar,
      // kızartır ve sersemletir. Kalkan savuşturur; çarpılan "ölür" ve stun
      // bitiminden 2 sn sonrasına kadar dokunulmaz olur (zincir çarpma yok).
      const targets = all.filter(
        (r) => r.id !== user.id && !r.finished && !r.disqualified,
      );
      for (const target of targets) {
        if (now < target.effects.invulnUntil) continue; // dokunulmaz — sessiz geç
        if (shielded(target)) {
          out.events.push({ type: 'blocked', userId: user.id, targetId: target.id });
          continue;
        }
        const stunEnd = now + PHYSICS.LIGHTNING_STUN_DURATION;
        out.updated.set(target.id, {
          ...target,
          effects: {
            ...target.effects,
            stunUntil: stunEnd,
            slowUntil: stunEnd + PHYSICS.LIGHTNING_SLOW_DURATION,
            slowFactor: 0.6,
            friedUntil: stunEnd,
            invulnUntil: stunEnd + PHYSICS.INVULN_DURATION,
          },
        });
        out.events.push({ type: 'lightning', userId: user.id, targetId: target.id });
      }
      break;
    }
    case 'miknatis': {
      // Gerçek mıknatıs: HERKESİ kullanıcıya doğru çeker — öndekiler GERİ,
      // arkadakiler İLERİ çekilir (kullanıcının konumunu geçemezler).
      // Lider kullanırsa arkadakiler ona doğru öne çekilir.
      const targets = all.filter(
        (r) => r.id !== user.id && !r.finished && !r.disqualified,
      );
      let hitAny = false;
      for (const target of targets) {
        if (now < target.effects.invulnUntil) continue; // dokunulmaz
        if (shielded(target)) {
          out.events.push({ type: 'blocked', userId: user.id, targetId: target.id });
          continue;
        }
        const pulled =
          target.s > user.s
            ? Math.max(user.s + 0.5, target.s - PHYSICS.MAGNET_PULL)
            : Math.min(user.s - 0.5, target.s + PHYSICS.MAGNET_PULL);
        out.updated.set(target.id, { ...target, s: Math.max(0, pulled) });
        hitAny = true;
      }
      if (hitAny || out.events.length > 0) out.events.push({ type: 'miknatis', userId: user.id });
      break;
    }
    case 'golden': {
      for (const r of all) {
        if (r.id === user.id || r.finished || r.disqualified) continue;
        if (now < r.effects.invulnUntil) continue; // dokunulmaz
        if (shielded(r)) {
          out.events.push({ type: 'blocked', userId: user.id, targetId: r.id });
          continue;
        }
        out.updated.set(r.id, {
          ...r,
          effects: { ...r.effects, frozenUntil: now + PHYSICS.GOLDEN_FREEZE_DURATION },
        });
      }
      out.events.push({ type: 'golden', userId: user.id });
      break;
    }
  }
  return out;
}
