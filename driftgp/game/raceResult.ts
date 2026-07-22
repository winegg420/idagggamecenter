// Yarış sonu CarState → XP girdisi dönüşümü.

import type { CarState } from './types';
import type { RaceResultInput } from './xp';

export function calcRaceXpInputFromState(
  s: CarState,
  position: number,
  totalRacers: number,
  trackId: string,
): RaceResultInput {
  return {
    position,
    totalRacers,
    driftScore: Math.round(s.driftScore),
    raceTime: s.raceTime,
    bestLap: s.lapTimes.length ? Math.min(...s.lapTimes) : 0,
    trackId,
    wallHits: s.wallHits,
    maxSpeedKmh: Math.round(s.maxSpeedKmh),
    nitroUses: s.nitroUses,
  };
}
