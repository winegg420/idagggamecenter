// Ağ protokolü: kompakt mesaj biçimleri.
// Supabase ücretsiz plan (2M mesaj/ay) için pozisyon mesajları kısa anahtarlı
// ve yuvarlanmış değerlerle gönderilir; hız 10 msg/sn/oyuncu ile sınırlıdır.
import type { MapId, SkillId } from '../game/types';

/** Efekt bayrakları (bit alanı) — görsel senkron için */
export const EFFECT_FLAGS = {
  BOOST: 1,
  SLOW: 2,
  STUN: 4,
  FROZEN: 8,
  SHIELD: 16,
  GROUNDED: 32,
  FINISHED: 64,
} as const;

/** Pozisyon güncellemesi (broadcast: 'pos') */
export interface PosMsg {
  /** Gönderen oyuncu id (kısa) */
  u: string;
  /** s — pist mesafesi (1 ondalık) */
  s: number;
  /** x — yanal (2 ondalık) */
  x: number;
  /** y — yükseklik (2 ondalık) */
  y: number;
  /** Efekt bayrakları */
  f: number;
  /** Gönderim zamanı (epoch ms) */
  t: number;
}

export interface SkillMsg {
  u: string;
  skill: SkillId;
  /** Hedef oyuncu (varsa) */
  target?: string;
  t: number;
}

export interface ChatMsg {
  u: string;
  /** 'text' | 'emoji' | 'quick' | 'dance' */
  kind: 'text' | 'emoji' | 'quick' | 'dance';
  body: string;
  t: number;
}

export interface VoteMsg {
  u: string;
  map: MapId;
}

export interface StartMsg {
  /** Yarışın başlayacağı epoch ms (geri sayım dahil) — HOST saatinde */
  startAt: number;
  /**
   * Host'un mesajı gönderdiği andaki saati. Alıcı `startAt - t0` (kalan süre)
   * ile çalışır; böylece cihaz saatleri farklı olsa da geri sayım kaymaz.
   */
  t0?: number;
  /** Mesajın YEREL alınma anı (alıcı doldurur, ağda gitmez) */
  recvAt?: number;
  map: MapId;
  timeOfDay: 'gunduz' | 'gece';
  /** Oyuncu id → takım (0 = takımsız) */
  teams: Record<string, number>;
  /** Oyuncu id → start çizgisi yanal konumu */
  gridX: Record<string, number>;
  /** Bu maçta gizli kısayol açık mı */
  shortcutOpen: boolean;
  /** Deterministik kutu dizilimi için tohum */
  seed: number;
  /**
   * Host'un çalıştırdığı dolgu botları (hızlı maç). Host fizik/AI'larını
   * yürütür ve pozisyonlarını yayınlar; diğer istemciler uzak koşucu sayar.
   */
  bots?: { id: string; name: string; character: string }[];
}

/** "Yarış sahnem yüklendi" sinyali — host herkesi bekler (senkron start). */
export interface ReadyMsg {
  u: string;
}

/**
 * Host'un kesin başlangıç kararı: `goAt - t0` = GO'ya kalan süre.
 * Herkes bu kalan süreye hizalanır → yarış tüm cihazlarda aynı anda başlar.
 */
export interface GoMsg {
  t0: number;
  goAt: number;
  /** Yerel alınma anı (alıcı doldurur) */
  recvAt?: number;
}

export interface FinishMsg {
  u: string;
  /** Bitirme süresi (yarış saati sn, 3 ondalık) */
  time: number;
}

export function packPos(u: string, s: number, x: number, y: number, f: number): PosMsg {
  return {
    u,
    s: Math.round(s * 10) / 10,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    f,
    t: Date.now(),
  };
}

/** Koşucu efektlerinden bayrak bit alanı üret */
export function effectFlags(opts: {
  boost: boolean;
  slow: boolean;
  stun: boolean;
  frozen: boolean;
  shield: boolean;
  grounded: boolean;
  finished: boolean;
}): number {
  let f = 0;
  if (opts.boost) f |= EFFECT_FLAGS.BOOST;
  if (opts.slow) f |= EFFECT_FLAGS.SLOW;
  if (opts.stun) f |= EFFECT_FLAGS.STUN;
  if (opts.frozen) f |= EFFECT_FLAGS.FROZEN;
  if (opts.shield) f |= EFFECT_FLAGS.SHIELD;
  if (opts.grounded) f |= EFFECT_FLAGS.GROUNDED;
  if (opts.finished) f |= EFFECT_FLAGS.FINISHED;
  return f;
}

export function hasFlag(f: number, flag: number): boolean {
  return (f & flag) !== 0;
}
