// Oyun çekirdeği tip tanımları

export type SkillId =
  | 'boost'
  | 'obstacle'
  | 'shield'
  | 'knockback'
  | 'lightning'
  | 'miknatis'
  | 'golden';

export type MapId = 'orman' | 'volkan' | 'gokyuzu' | 'ejderha' | 'gizli';

export type TimeOfDay = 'gunduz' | 'gece';

export interface RunnerInput {
  /** Yanal eksen: -1 (sol) .. 1 (sağ). 2D yan görünümde kullanılmaz (0 gönderilir). */
  lateral: number;
  /** Bu karede zıplama isteği */
  jump: boolean;
  /** Eğilme (bar engellerinin altından geçmek için, basılı tutulur) */
  duck?: boolean;
  /**
   * Girdi kaynağı canlı mı (bot / ağ oyuncusu her karede true gönderir).
   * İnsan oyuncuda sadece gerçek dokunuş AFK sayacını sıfırlar.
   */
  active?: boolean;
}

export interface RunnerEffects {
  /** Hız patlaması bitiş zamanı (yarış saati, sn) */
  boostUntil: number;
  /** Yavaşlama bitiş zamanı */
  slowUntil: number;
  /** Yavaşlama çarpanı (aktifken) */
  slowFactor: number;
  /** Sersemleme (hareket edemez) bitiş zamanı */
  stunUntil: number;
  /** Donma (altın skill) bitiş zamanı */
  frozenUntil: number;
  /** Kalkan bitiş zamanı */
  shieldUntil: number;
  /** Dokunulmazlık bitişi: ağır CC ("ölüm") + 2 sn ("yeniden doğum") boyunca
      hiçbir saldırı/kapan etki etmez */
  invulnUntil: number;
  /** Elektrikle kızarma görseli bitişi (yıldırım çarpması) */
  friedUntil: number;
}

export interface RunnerState {
  id: string;
  /** Pist boyunca kat edilen mesafe (birim) */
  s: number;
  /** Yanal konum */
  x: number;
  /** Pist yüzeyinden yükseklik */
  y: number;
  /** Dikey hız */
  vy: number;
  /** Yerde mi */
  grounded: boolean;
  /** Eğiliyor mu (bar engeli altından geçiş) */
  ducking: boolean;
  /** Su seviyesi: 0=yüzey, 1=orta, 2=dip (sadece su bölümünde anlamlı) */
  waterLevel: number;
  /** Suda eğil tuşu basılı mıydı (yeni basış = bir seviye dal) */
  swimDuckHeld: boolean;
  /** Taban hız çarpanı (bot zorluk ayarı; insan oyuncuda 1) */
  speedFactor: number;
  effects: RunnerEffects;
  /** Envanterdeki skill (tek slot) */
  skill: SkillId | null;
  finished: boolean;
  finishTime: number | null;
  /** Son girdi zamanı (AFK takibi, yarış saati sn) */
  lastInputAt: number;
  disqualified: boolean;
  /** Bağlantı koptu — olduğu yerde donuk */
  disconnected: boolean;
}

export interface TrackObstacle {
  id: string;
  s: number;
  x: number;
  /** Engeli koyan oyuncu (kendine çarpmaz) */
  ownerId: string;
  expiresAt: number;
}

export interface SkillBox {
  id: string;
  s: number;
  x: number;
  /** Dikey konum (birim): 0 = zemin üstü, negatif = su dibi kutusu */
  y?: number;
  /** Alındıktan sonra bu zamana kadar kapalı */
  respawnAt: number;
}

export const createEffects = (): RunnerEffects => ({
  boostUntil: 0,
  slowUntil: 0,
  slowFactor: 1,
  stunUntil: 0,
  frozenUntil: 0,
  shieldUntil: 0,
  invulnUntil: 0,
  friedUntil: 0,
});

export const createRunner = (id: string): RunnerState => ({
  id,
  s: 0,
  x: 0,
  y: 0,
  vy: 0,
  grounded: true,
  ducking: false,
  waterLevel: 0,
  swimDuckHeld: false,
  speedFactor: 1,
  effects: createEffects(),
  skill: null,
  finished: false,
  finishTime: null,
  lastInputAt: 0,
  disqualified: false,
  disconnected: false,
});
