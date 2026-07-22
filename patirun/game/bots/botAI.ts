// Bot yapay zekâsı (2D yan görünüm): sabit engellere zıpla/eğil tepkisi,
// skill toplama/kullanma. Zorluk; hız çarpanı, görüş mesafesi ve tepki
// gecikmesiyle belirlenir. Skill MANTIĞI oyuncuyla birebir aynıdır.
import type { RaceEngine } from '../engine';
import type { RunnerInput } from '../types';
import { PHYSICS } from '../../config/constants';

export type BotDifficulty = 'kolay' | 'orta' | 'zor';

interface DifficultyProfile {
  /** Taban hız çarpanı ARALIĞI [min, max] — her bot kendi hızını çeker.
      Üst sınır 1'in üzerinde: botlar oyuncuyu gerçekten yenebilir
      ("hep ben birinciyim" yapaylığı kırılır, finişler doğal dağılır). */
  speedRange: [number, number];
  /** Skill'i aldıktan sonra kullanma gecikmesi aralığı (sn) */
  skillDelay: [number, number];
  /** Engeli fark etme mesafesi (birim) */
  obstacleSight: number;
  /** Engel tepkisini kaçırma olasılığı (kare başına değil, engel başına) */
  missChance: number;
}

// Skill gecikmeleri kısa: botlar topladıkları skill'i bekletmeden kullanır,
// tek kişilik maç bile aksiyonlu hissettirir.
const PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  kolay: { speedRange: [0.86, 0.94], skillDelay: [1.5, 3.5], obstacleSight: 6, missChance: 0.35 },
  orta: { speedRange: [0.92, 1.02], skillDelay: [0.8, 2.0], obstacleSight: 10, missChance: 0.15 },
  zor: { speedRange: [0.97, 1.06], skillDelay: [0.4, 1.0], obstacleSight: 14, missChance: 0.04 },
};

export const BOT_NAMES = [
  'Şimşek Hüsnü',
  'Turbo Neriman',
  'Fırtına Kadir',
  'Roket Suzan',
  'Cesur Muhittin',
  'Duman Fikriye',
  'Panter Sabri',
  'Kasırga Melahat',
];

/**
 * Zıplama menzili: bu mesafede blok varsa zıpla. Ayrık fizikte (30-60 fps)
 * y>1.1 yüksekliğine ~2.4 birim yolda ulaşılır; çarpışma bölgesi engelden
 * 0.9 birim önce başlar → güvenli pencere ~[3.4, 6.3]. 4.2 ortada kalır.
 */
const JUMP_LEAD = 4.2;
/** Eğilme menzili: bar'a bu kadar yaklaşınca eğil */
const DUCK_LEAD = 2.4;

export class BotController {
  readonly id: string;
  readonly difficulty: BotDifficulty;
  private readonly profile: DifficultyProfile;
  private skillUseAt: number | null = null;
  /** Su dalışı: eğil basış kenarı üretmek için aç/kapa */
  private duckToggle = false;
  /** Tepki verilmeyecek (kaçırılmış) engel id'leri */
  private missed = new Set<string>();
  /** Karar verilen engel id'leri (miss zarı bir kez atılır) */
  private judged = new Set<string>();
  private rng: () => number;

  /** Bu botun kişisel taban hızı (aralıktan çekilir — her bot farklı koşar) */
  private readonly mySpeedFactor: number;

  constructor(id: string, difficulty: BotDifficulty, rng: () => number = Math.random) {
    this.id = id;
    this.difficulty = difficulty;
    this.profile = PROFILES[difficulty];
    this.rng = rng;
    const [f0, f1] = this.profile.speedRange;
    this.mySpeedFactor = f0 + this.rng() * (f1 - f0);
  }

  get speedFactor(): number {
    return this.mySpeedFactor;
  }

  /** Her kare çağrılır: girdi üretir ve gerekirse skill kullanır. */
  update(engine: RaceEngine, _dt: number): RunnerInput {
    const me = engine.runners.get(this.id);
    if (!me || me.finished || me.disqualified) {
      return { lateral: 0, jump: false, active: true };
    }

    let jump = false;
    let duck = false;

    // Yamaç: dibine gelince zıplama spam'iyle tırmanılır (kaçırma zarı YOK —
    // yamaç aşılamazsa bot sonsuza dek takılı kalır)
    const wallAhead = engine.track.wallBetween(me.s, me.s + 2.0);
    if (wallAhead !== null && me.y < PHYSICS.CLIFF_HEIGHT) {
      jump = true;
    }

    // Derin su: elim boşsa ve ileride dip kutusu varsa EĞİL spam'iyle dal;
    // işim bitince ZIPLA spam'iyle yüzeye fırla
    if (engine.track.waterAt(me.s) && me.y <= 0.011) {
      const deepBox = engine.boxes.find(
        (b) =>
          (b.y ?? 0) < -1 &&
          engine.time >= b.respawnAt &&
          b.s - me.s > -1 &&
          b.s - me.s < 14,
      );
      const deepY = -(PHYSICS.WATER_DEPTH - 0.4);
      if (me.skill === null && deepBox && me.y > deepY + 0.5) {
        this.duckToggle = !this.duckToggle; // aç/kapa = her iki karede bir dalış itkisi
        return { lateral: 0, jump: false, duck: this.duckToggle, active: true };
      }
      if (me.y < -0.8) {
        return { lateral: 0, jump: true, duck: false, active: true };
      }
    }

    // Önündeki en yakın sabit engel
    for (const ob of engine.track.staticObstacles) {
      const dist = ob.s - me.s;
      if (dist < 0 || dist > this.profile.obstacleSight) continue;

      // Engel başına bir kez "kaçırma" zarı at (kolay botlar bazen takılır)
      if (!this.judged.has(ob.id)) {
        this.judged.add(ob.id);
        if (this.rng() < this.profile.missChance) this.missed.add(ob.id);
      }
      if (this.missed.has(ob.id)) continue;

      if (ob.kind === 'blok' && dist <= JUMP_LEAD && me.grounded) jump = true;
      if (ob.kind === 'bar' && dist <= DUCK_LEAD) duck = true;
      break; // sadece en yakın engele tepki ver
    }

    // Rakip engeli (skill ile bırakılmış) — görüş içindeyse zıpla
    if (!jump && !duck && me.grounded) {
      const threat = engine.obstacles.find(
        (ob) =>
          ob.ownerId !== this.id &&
          ob.s > me.s &&
          ob.s - me.s < Math.min(this.profile.obstacleSight, JUMP_LEAD) &&
          engine.time < ob.expiresAt,
      );
      if (threat && this.rng() > this.profile.missChance) jump = true;
    }

    // Skill kullanımı: alınca gecikme planla, zamanı gelince kullan
    if (me.skill !== null) {
      if (this.skillUseAt === null) {
        const [dMin, dMax] = this.profile.skillDelay;
        this.skillUseAt = engine.time + dMin + this.rng() * (dMax - dMin);
      } else if (engine.time >= this.skillUseAt) {
        // Saldırı skill'i önünde kimse yokken denenirse false döner; sonra tekrar dener
        if (engine.useSkill(this.id) || engine.time > this.skillUseAt + 4) {
          this.skillUseAt = null;
        }
      }
    } else {
      this.skillUseAt = null;
    }

    return { lateral: 0, jump, duck, active: true };
  }
}

/** Kolay botların bile takılmadan koşabildiği referans hız (test için) */
export const BOT_MIN_SPEED = PHYSICS.BASE_SPEED * PROFILES.kolay.speedRange[0];
