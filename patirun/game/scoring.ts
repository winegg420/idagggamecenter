// Puanlama ve rütbe — saf fonksiyonlar, birim testli.
import { RANKS, SCORING } from '../config/constants';

/**
 * Bitirme sırasına göre puan. n oyunculu yarışta r. sıra:
 * 100 * (n - r + 1) / n  →  5 kişide 100/80/60/40/20, 2 kişide 100/50.
 * Diskalifiye 0 puan alır.
 */
export function pointsForRank(rank: number, playerCount: number, disqualified = false): number {
  if (disqualified) return 0;
  if (playerCount < 1 || rank < 1 || rank > playerCount) return 0;
  return Math.round((100 * (playerCount - rank + 1)) / playerCount);
}

/** Toplam puana göre rütbe adı. */
export function rankTitleForPoints(points: number): string {
  let title: string = RANKS[0].name;
  for (const r of RANKS) {
    if (points >= r.min) title = r.name;
  }
  return title;
}

/** Günlük ilk yarış bonusu: bugün ilk yarışsa sabit bonus. */
export function dailyBonus(lastRaceDate: string | null, today: string): number {
  return lastRaceDate === today ? 0 : SCORING.DAILY_FIRST_RACE_BONUS;
}
