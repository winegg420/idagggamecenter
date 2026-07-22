// Oyuncu profili: XP, rank, rozetler, istatistikler, kilit açma.
// localStorage'a yazar; Supabase varsa cloudSync üzerinden senkronize edilir.

import { create } from 'zustand';
import { loadJson, saveJson } from '../lib/storage';
import { BADGES, calcRaceXp, getRank, type RaceResultInput, type XpBreakdown } from '../game/xp';
import { CARS } from '../game/cars';
import { syncProfile } from '../lib/cloudSync';

export interface ProfileData {
  playerName: string;
  xp: number;
  totalRaces: number;
  wins: number;
  totalDriftScore: number;
  totalNitroUses: number;
  bestLapByTrack: Record<string, number>;
  badges: string[];
  usedCarIds: string[];
}

const DEFAULT_PROFILE: ProfileData = {
  playerName: 'Sürücü',
  xp: 0,
  totalRaces: 0,
  wins: 0,
  totalDriftScore: 0,
  totalNitroUses: 0,
  bestLapByTrack: {},
  badges: [],
  usedCarIds: [],
};

interface ProfileStore extends ProfileData {
  /** son yarışta kazanılan yeni rozetler (sonuç ekranı bildirimi) */
  newBadges: string[];
  lastXpBreakdown: XpBreakdown | null;
  applyRaceResult: (r: RaceResultInput, carId: string, cleanLapDone: boolean) => void;
  isCarUnlocked: (carId: string) => boolean;
  setPlayerName: (name: string) => void;
}

function persist(state: ProfileData) {
  saveJson('profile', state);
  syncProfile(state).catch((err) => console.warn('[DidaGP] Profil senkronu ertelendi:', err));
}

function pickData(s: ProfileStore): ProfileData {
  const { playerName, xp, totalRaces, wins, totalDriftScore, totalNitroUses, bestLapByTrack, badges, usedCarIds } = s;
  return { playerName, xp, totalRaces, wins, totalDriftScore, totalNitroUses, bestLapByTrack, badges, usedCarIds };
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  ...loadJson('profile', DEFAULT_PROFILE),
  newBadges: [],
  lastXpBreakdown: null,

  applyRaceResult: (r, carId, cleanLapDone) => {
    const s = get();
    const breakdown = calcRaceXp(r);
    const usedCarIds = s.usedCarIds.includes(carId) ? s.usedCarIds : [...s.usedCarIds, carId];
    const totalRaces = s.totalRaces + 1;
    const wins = s.wins + (r.position === 1 ? 1 : 0);
    const totalDriftScore = s.totalDriftScore + r.driftScore;
    const totalNitroUses = s.totalNitroUses + r.nitroUses;
    const bestLapByTrack = { ...s.bestLapByTrack };
    if (r.bestLap > 0 && (!bestLapByTrack[r.trackId] || r.bestLap < bestLapByTrack[r.trackId])) {
      bestLapByTrack[r.trackId] = r.bestLap;
    }

    // rozet kontrolleri
    const owned = new Set(s.badges);
    const earned: string[] = [];
    const grant = (id: string, cond: boolean) => {
      if (cond && !owned.has(id)) {
        owned.add(id);
        earned.push(id);
      }
    };
    grant('first-race', totalRaces >= 1);
    grant('first-win', r.position === 1);
    grant('races-10', totalRaces >= 10);
    grant('races-50', totalRaces >= 50);
    grant('drift-novice', totalDriftScore >= 5000);
    grant('drift-master', totalDriftScore >= 50000);
    grant('speed-demon', r.maxSpeedKmh >= 350);
    grant('nitro-addict', totalNitroUses >= 50);
    grant('clean-lap', cleanLapDone);
    grant('night-rider', r.position === 1 && r.trackId === 'city');
    grant('volcano-tamer', r.position === 1 && r.trackId === 'volcano');
    grant('collector', usedCarIds.length >= 10);

    const next: Partial<ProfileStore> = {
      xp: s.xp + breakdown.total,
      totalRaces,
      wins,
      totalDriftScore,
      totalNitroUses,
      bestLapByTrack,
      badges: [...owned],
      usedCarIds,
      newBadges: earned,
      lastXpBreakdown: breakdown,
    };
    set(next);
    persist(pickData({ ...s, ...next } as ProfileStore));
  },

  isCarUnlocked: (carId) => {
    const car = CARS.find((c) => c.id === carId);
    return !!car && get().xp >= car.xpRequired;
  },

  setPlayerName: (playerName) => {
    set({ playerName });
    persist(pickData({ ...get(), playerName } as ProfileStore));
  },
}));

export { getRank, BADGES };
