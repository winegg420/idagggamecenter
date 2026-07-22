// Yarış motoru: tüm koşucuların fizik adımlarını, sıralamayı ve yarış akışını yönetir.
// React'ten bağımsız — birim test edilebilir.
import {
  stepRunner,
  hitObstacle,
  applyObstacleHit,
  hitStaticObstacle,
  applyStaticHit,
  checkDisqualify,
} from './physics';
import { createRunner } from './types';
import type { RunnerInput, RunnerState, TrackObstacle, SkillBox, SkillId } from './types';
import { RACE, SKILLS, PHYSICS } from '../config/constants';
import type { Track2D } from './track2d/track2d';
import { rollSkill, applySkill, type SkillEvent, type Rng } from './skills/skillSystem';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RankEntry {
  id: string;
  rank: number;
  finished: boolean;
  finishTime: number | null;
  disqualified: boolean;
}

export type GameEvent =
  | (SkillEvent & { time: number })
  | { type: 'pickup'; userId: string; skill: SkillId; time: number }
  | { type: 'obstacleHit'; userId: string; trap?: boolean; by?: string; stumble?: boolean; time: number };

const NO_INPUT: RunnerInput = { lateral: 0, jump: false };

export class RaceEngine {
  readonly track: Track2D;
  readonly runners = new Map<string, RunnerState>();
  /** Her kare dışarıdan yazılır (oyuncu girdisi / bot AI / ağ) */
  readonly inputs = new Map<string, RunnerInput>();
  obstacles: TrackObstacle[] = [];
  boxes: SkillBox[] = [];
  /** Yarış saati (sn). Geri sayım sırasında negatif. */
  time: number;
  phase: RacePhase = 'countdown';
  /** Bitiş sırası (id listesi, bitirme sırasına göre) */
  finishOrder: string[] = [];
  /** Bu karede üretilen olaylar — sahne VFX/ses için tüketir */
  events: GameEvent[] = [];
  /** Rastgelelik kaynağı (testlerde sabitlenebilir) */
  rng: Rng = Math.random;
  /** Uzak (ağdan gelen) koşucular: fizik adımı atlanır, konumları dışarıdan yazılır */
  readonly remoteIds = new Set<string>();
  /** Bu maçta gizli kısayol açık mı (nadir) */
  shortcutOpen = false;
  /** İstatistik: skill isabetleri / yenen skill'ler (mizahi kategoriler ve rozetler için) */
  readonly stats = new Map<
    string,
    { hits: number; taken: number; boxesTaken: number; blocks: number; lightningHits: number }
  >();
  /** Bu maçta altın skill görüldü mü */
  goldenSeen = false;
  /** Kısayol şeridini kullananlar */
  readonly shortcutUsers = new Set<string>();
  /** Yarış boyunca en az bir kez son sırada olanlar */
  readonly wasLast = new Set<string>();
  private lastCheckAccum = 0;

  /** Sabit engellere çarpma kaydı (engelId:koşucuId — bir kez çarpılır) */
  private readonly staticHits = new Set<string>();

  /** Son dağıtılan skill'ler (s konumu + zaman): yan yana kutulardan
      art arda AYNI skill çıkmasın diye yeniden zar atılır */
  private recentDrops: { s: number; skill: SkillId; at: number }[] = [];

  constructor(track: Track2D, countdownSeconds: number) {
    this.track = track;
    this.time = -countdownSeconds;
    this.spawnBoxes();
  }

  private statOf(id: string) {
    let s = this.stats.get(id);
    if (!s) {
      s = { hits: 0, taken: 0, boxesTaken: 0, blocks: 0, lightningHits: 0 };
      this.stats.set(id, s);
    }
    return s;
  }

  /**
   * Skill kutuları: her sırada 3'lü kutu dizisi (s-2.2, s, s+2.2).
   * Tek kutu 5 koşucuya yetmiyordu (ilk alan kapıyor, maç durgunlaşıyordu);
   * dizi sayesinde art arda gelenler de eli dolu koşar.
   */
  private spawnBoxes(): void {
    let seq = 0;
    for (const row of this.track.def.skillBoxRows) {
      const s = row * this.track.length;
      for (const off of [-2.2, 0, 2.2]) {
        this.boxes.push({ id: `box-${++seq}`, s: Math.max(2, s + off), x: 0, respawnAt: 0 });
      }
    }
    // Su bölümlerinin EN DİBİNDE kutu dizisi: dalış risk/ödül seçimi
    const deepY = -(PHYSICS.WATER_DEPTH - 0.4);
    for (const wz of this.track.waterZones) {
      const mid = (wz.s0 + wz.s1) / 2;
      for (const off of [-2.2, 0, 2.2]) {
        this.boxes.push({ id: `box-${++seq}`, s: mid + off, x: 0, y: deepY, respawnAt: 0 });
      }
    }
  }

  addRunner(id: string, startX = 0): RunnerState {
    const r = createRunner(id);
    r.x = startX;
    this.runners.set(id, r);
    return r;
  }

  setInput(id: string, input: RunnerInput): void {
    this.inputs.set(id, input);
  }

  step(dt: number): void {
    if (this.phase === 'finished') return;
    this.time += dt;

    if (this.phase === 'countdown') {
      if (this.time >= 0) this.phase = 'racing';
      else return;
    }

    const all = [...this.runners.values()];
    for (const runner of all) {
      if (runner.finished || runner.disqualified) continue;
      if (this.remoteIds.has(runner.id)) continue; // konumu ağdan gelir
      const input = this.inputs.get(runner.id) ?? NO_INPUT;
      let next = stepRunner(runner, input, dt, this.time, this.track, all, this.shortcutOpen);

      const ob = hitObstacle(next, this.obstacles, this.time, this.track.groundAt);
      if (ob) {
        const before = next.effects.stunUntil;
        next = applyObstacleHit(next, this.time);
        // Kapan tek kullanımlık: kapanınca kaybolur
        this.obstacles = this.obstacles.filter((o) => o.id !== ob.id);
        if (next.effects.stunUntil !== before) {
          this.events.push({ type: 'obstacleHit', userId: next.id, trap: true, by: ob.ownerId, time: this.time });
          this.statOf(next.id).taken += 1;
          this.statOf(ob.ownerId).hits += 1;
        }
      }

      // Sabit pist engelleri (2D: blok=zıpla, bar=eğil; kalkan korumaz)
      const stOb = hitStaticObstacle(next, this.track.staticObstacles, this.staticHits, this.track.groundAt);
      if (stOb) {
        this.staticHits.add(`${stOb.id}:${next.id}`);
        next = applyStaticHit(next, this.time);
        // Blok: TÖKEZLEYİP kutunun üstünden atlar (sendeleme görseli
        // renderer'da stumble efektiyle desteklenir)
        if (stOb.kind === 'blok' && next.grounded) {
          next = { ...next, vy: 7.5, grounded: false };
        }
        this.events.push({
          type: 'obstacleHit',
          userId: next.id,
          stumble: stOb.kind === 'blok',
          time: this.time,
        });
      }

      // Skill kutusu alma (envanter boşsa). NOT: x (yanal şerit) 2D yan
      // görünümde SAHTE-DERİNLİKTİR ve oyunda değişmez; kutu alımı x'i YOK
      // SAYAR — yoksa merkeze uzak şeritte başlayan (MP grid) oyuncular
      // kutuya hiç değemiyordu. Zemin kutusu: yerel zemine göre <1.6;
      // dip kutusu: sadece en dibe dalınca (|y-dip|<1.2).
      if (next.skill === null) {
        const box = this.boxes.find((b) => {
          if (this.time < b.respawnAt) return false;
          if (Math.abs(b.s - next.s) >= 1.2) return false;
          const by = b.y ?? 0;
          if (by < 0) return Math.abs(next.y - by) < 1.2;
          const rel = next.y - (this.track.groundAt(b.s) ?? 0);
          return rel < 1.6 && rel > -0.8;
        });
        if (box) {
          // Yan yana kutu dizisinden (±5.5 birim, son 8 sn) aynı skill üst üste
          // çıkmasın: çakışırsa 3 kez yeniden zar at. Altın zar asla bozulmaz.
          let skill = rollSkill(this.rankOf(next.id), this.runners.size, this.rng);
          for (let tries = 0; tries < 3 && skill !== 'golden'; tries++) {
            const clash = this.recentDrops.some(
              (d) => d.skill === skill && Math.abs(d.s - box.s) < 5.5 && this.time - d.at < 8,
            );
            if (!clash) break;
            skill = rollSkill(this.rankOf(next.id), this.runners.size, this.rng);
          }
          this.recentDrops.push({ s: box.s, skill, at: this.time });
          if (this.recentDrops.length > 24) this.recentDrops.shift();
          if (skill === 'golden') this.goldenSeen = true;
          next = { ...next, skill };
          const [rMin, rMax] = SKILLS.BOX_RESPAWN_RANGE;
          box.respawnAt = this.time + rMin + this.rng() * (rMax - rMin);
          this.events.push({ type: 'pickup', userId: next.id, skill, time: this.time });
          this.statOf(next.id).boxesTaken += 1;
        }
      }

      next = checkDisqualify(next, this.time);

      // Kısayol kullanımı (rozet)
      if (this.shortcutOpen && this.track.inShortcutZone(next.s, next.x, next.y)) {
        this.shortcutUsers.add(next.id);
      }

      if (next.finished && !runner.finished) this.finishOrder.push(next.id);
      this.runners.set(runner.id, next);
    }

    // Son sıra takibi (~saniyede bir): "sondan birinciliğe" rozeti için
    this.lastCheckAccum += dt;
    if (this.lastCheckAccum >= 1 && this.runners.size > 1) {
      this.lastCheckAccum = 0;
      const racing = [...this.runners.values()].filter((r) => !r.finished && !r.disqualified);
      if (racing.length > 1) {
        const last = racing.reduce((a, b) => (a.s <= b.s ? a : b));
        this.wasLast.add(last.id);
      }
    }

    const active = [...this.runners.values()].filter((r) => !r.finished && !r.disqualified);
    if (active.length === 0 || this.time >= RACE.TIME_LIMIT) {
      this.phase = 'finished';
    }
  }

  /**
   * Uzak koşucunun konumunu ağdan güncelle.
   * Anti-hile: makul azami hızın üstündeki sıçramalar (konsol manipülasyonu,
   * ışınlanma) kırpılır — geriye gitmek serbest (knockback meşru).
   */
  setRemoteState(id: string, s: number, x: number, y: number): void {
    const r = this.runners.get(id);
    if (!r || r.finished || r.disqualified) return;
    const elapsed = Math.max(0.05, this.time - r.lastInputAt);
    const maxSpeed =
      PHYSICS.BASE_SPEED * PHYSICS.BOOST_MULTIPLIER * PHYSICS.SHORTCUT_MULTIPLIER * 1.25;
    const clampedS = Math.min(s, r.s + elapsed * maxSpeed);
    const clampedX = Math.max(-PHYSICS.TRACK_HALF_WIDTH, Math.min(PHYSICS.TRACK_HALF_WIDTH, x));
    this.runners.set(id, { ...r, s: clampedS, x: clampedX, y, lastInputAt: this.time });
  }

  /** Uzak koşucu bitirdi (ağ mesajıyla). */
  markRemoteFinished(id: string, finishTime: number): void {
    const r = this.runners.get(id);
    if (!r || r.finished) return;
    this.runners.set(id, { ...r, finished: true, finishTime, s: this.track.length });
    if (!this.finishOrder.includes(id)) {
      this.finishOrder.push(id);
      // Bitirme sürelerine göre sırayı koru (mesajlar sıra dışı gelebilir)
      this.finishOrder.sort((a, b) => {
        const ta = this.runners.get(a)?.finishTime ?? Infinity;
        const tb = this.runners.get(b)?.finishTime ?? Infinity;
        return ta - tb;
      });
    }
  }

  /** Uzak koşucunun bağlantı durumunu işaretle. */
  setRemoteDisconnected(id: string, disconnected: boolean): void {
    const r = this.runners.get(id);
    if (!r || r.finished || r.disqualified) return;
    this.runners.set(id, { ...r, disconnected });
  }

  /**
   * Envanterdeki skill'i kullanır. Başarılıysa true.
   * Saldırı skill'lerinde isabet/yeme istatistikleri güncellenir.
   */
  useSkill(runnerId: string, targetId?: string): boolean {
    if (this.phase !== 'racing') return false;
    const user = this.runners.get(runnerId);
    if (!user || !user.skill || user.finished || user.disqualified) return false;
    if (this.time < user.effects.stunUntil || this.time < user.effects.frozenUntil) return false;

    const skill = user.skill;
    const all = [...this.runners.values()];
    const outcome = applySkill(user, skill, all, this.time, targetId);

    // Saldırı hedefe ulaşamadıysa (önünde kimse yok) skill boşa gitmesin
    if ((skill === 'knockback' || skill === 'lightning') && outcome.events.length === 0) {
      return false;
    }

    for (const [id, updated] of outcome.updated) this.runners.set(id, updated);
    this.obstacles.push(...outcome.obstacles);
    for (const ev of outcome.events) {
      this.events.push({ ...ev, time: this.time });
      if (ev.type !== 'blocked' && ev.targetId) {
        this.statOf(runnerId).hits += 1;
        this.statOf(ev.targetId).taken += 1;
        if (ev.type === 'lightning') this.statOf(runnerId).lightningHits += 1;
      }
      if (ev.type === 'golden') {
        this.statOf(runnerId).hits += 1;
        this.goldenSeen = true;
      }
      if (ev.type === 'miknatis') this.statOf(runnerId).hits += 1;
      if (ev.type === 'blocked' && ev.targetId) {
        this.statOf(ev.targetId).blocks += 1;
      }
    }

    const after = this.runners.get(runnerId)!;
    this.runners.set(runnerId, { ...after, skill: null });
    return true;
  }

  /** Birikmiş olayları alır ve kuyruğu temizler. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Anlık sıralama: bitirenler bitirme sırasına, kalanlar mesafeye göre. */
  ranking(): RankEntry[] {
    const list = [...this.runners.values()];
    const finished = this.finishOrder
      .map((id) => this.runners.get(id)!)
      .filter(Boolean);
    const racing = list
      .filter((r) => !r.finished && !r.disqualified)
      .sort((a, b) => b.s - a.s);
    const dq = list.filter((r) => r.disqualified);
    return [...finished, ...racing, ...dq].map((r, i) => ({
      id: r.id,
      rank: i + 1,
      finished: r.finished,
      finishTime: r.finishTime,
      disqualified: r.disqualified,
    }));
  }

  rankOf(id: string): number {
    const entry = this.ranking().find((e) => e.id === id);
    return entry ? entry.rank : 0;
  }
}
