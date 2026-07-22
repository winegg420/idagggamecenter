// XP, rank ve rozet sistemi.

export interface RankDef {
  name: string;
  minXp: number;
  icon: string;
}

export const RANKS: RankDef[] = [
  { name: 'Bronz', minXp: 0, icon: '🥉' },
  { name: 'Gümüş', minXp: 500, icon: '🥈' },
  { name: 'Altın', minXp: 1500, icon: '🥇' },
  { name: 'Platin', minXp: 3000, icon: '💠' },
  { name: 'Elmas', minXp: 5000, icon: '💎' },
  { name: 'Şampiyon', minXp: 8000, icon: '🏆' },
  { name: 'Efsane', minXp: 12000, icon: '👑' },
];

export function getRank(xp: number): RankDef {
  let r = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.minXp) r = rank;
  return r;
}

export function nextRank(xp: number): RankDef | null {
  return RANKS.find((r) => r.minXp > xp) ?? null;
}

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-race', name: 'İlk Yarış', desc: 'İlk yarışını tamamla', icon: '🏁' },
  { id: 'first-win', name: 'İlk Zafer', desc: 'Bir yarışı 1. bitir', icon: '🥇' },
  { id: 'races-10', name: 'Pist Aşinası', desc: '10 yarış tamamla', icon: '🔟' },
  { id: 'races-50', name: 'Pist Kurdu', desc: '50 yarış tamamla', icon: '🎖️' },
  { id: 'drift-novice', name: 'Drift Çırağı', desc: 'Toplam 5.000 drift puanı', icon: '💨' },
  { id: 'drift-master', name: 'Drift Ustası', desc: 'Toplam 50.000 drift puanı', icon: '🌀' },
  { id: 'speed-demon', name: 'Hız Şeytanı', desc: 'Tek yarışta 350+ km/s gör', icon: '⚡' },
  { id: 'nitro-addict', name: 'Nitro Bağımlısı', desc: '50 kez nitro kullan', icon: '🔥' },
  { id: 'clean-lap', name: 'Temiz Tur', desc: 'Duvara çarpmadan tur at', icon: '✨' },
  { id: 'night-rider', name: 'Gece Sürücüsü', desc: 'Şehir pistinde yarış kazan', icon: '🌃' },
  { id: 'volcano-tamer', name: 'Volkan Fatihi', desc: 'Volkanik pistte yarış kazan', icon: '🌋' },
  { id: 'collector', name: 'Koleksiyoncu', desc: '10 farklı araba kullan', icon: '🚗' },
];

export interface RaceResultInput {
  /** 1 tabanlı bitiş sırası */
  position: number;
  totalRacers: number;
  driftScore: number;
  raceTime: number;
  bestLap: number;
  trackId: string;
  wallHits: number;
  maxSpeedKmh: number;
  nitroUses: number;
}

export interface XpBreakdown {
  finish: number;
  position: number;
  drift: number;
  cleanBonus: number;
  total: number;
}

const POSITION_XP = [100, 70, 50, 35, 25, 15];

export function calcRaceXp(r: RaceResultInput): XpBreakdown {
  const finish = 50;
  const position = POSITION_XP[Math.min(r.position, POSITION_XP.length) - 1] ?? 10;
  const drift = Math.min(150, Math.round(r.driftScore / 100));
  const cleanBonus = r.wallHits === 0 ? 40 : 0;
  return { finish, position, drift, cleanBonus, total: finish + position + drift + cleanBonus };
}
