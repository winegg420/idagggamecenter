import { describe, it, expect } from 'vitest';
import { pointsForRank, rankTitleForPoints, dailyBonus } from '../scoring';
import { SCORING } from '../../config/constants';

describe('pointsForRank', () => {
  it('5 kişilik yarışta 100/80/60/40/20', () => {
    expect(pointsForRank(1, 5)).toBe(100);
    expect(pointsForRank(2, 5)).toBe(80);
    expect(pointsForRank(3, 5)).toBe(60);
    expect(pointsForRank(4, 5)).toBe(40);
    expect(pointsForRank(5, 5)).toBe(20);
  });

  it('2 kişilik yarışta 100/50', () => {
    expect(pointsForRank(1, 2)).toBe(100);
    expect(pointsForRank(2, 2)).toBe(50);
  });

  it('tek kişilik yarışta 100', () => {
    expect(pointsForRank(1, 1)).toBe(100);
  });

  it('diskalifiye 0 puan', () => {
    expect(pointsForRank(1, 5, true)).toBe(0);
  });

  it('geçersiz girdide 0', () => {
    expect(pointsForRank(0, 5)).toBe(0);
    expect(pointsForRank(6, 5)).toBe(0);
    expect(pointsForRank(1, 0)).toBe(0);
  });
});

describe('rankTitleForPoints', () => {
  it('rütbe eşikleri doğru', () => {
    expect(rankTitleForPoints(0)).toBe('Çaylak');
    expect(rankTitleForPoints(499)).toBe('Çaylak');
    expect(rankTitleForPoints(500)).toBe('Amatör');
    expect(rankTitleForPoints(1499)).toBe('Amatör');
    expect(rankTitleForPoints(1500)).toBe('Yarı Profesyonel');
    expect(rankTitleForPoints(3500)).toBe('Profesyonel');
    expect(rankTitleForPoints(7000)).toBe('Şampiyon');
    expect(rankTitleForPoints(15000)).toBe('Efsane');
    expect(rankTitleForPoints(999999)).toBe('Efsane');
  });
});

describe('dailyBonus', () => {
  it('günün ilk yarışında bonus, sonrakilerde 0', () => {
    expect(dailyBonus(null, '2026-07-03')).toBe(SCORING.DAILY_FIRST_RACE_BONUS);
    expect(dailyBonus('2026-07-02', '2026-07-03')).toBe(SCORING.DAILY_FIRST_RACE_BONUS);
    expect(dailyBonus('2026-07-03', '2026-07-03')).toBe(0);
  });
});
