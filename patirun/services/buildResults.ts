// Yarış sonuçları + mizahi kategoriler (motor istatistiklerinden).
import type { RaceEngine } from '../game/engine';
import { pointsForRank } from '../game/scoring';
import type { RaceResultRow } from '../stores/raceStore';

export interface FunCategory {
  title: string;
  emoji: string;
  name: string;
}

export function buildResults(
  engine: RaceEngine,
  names: Map<string, string>,
): { results: RaceResultRow[]; categories: FunCategory[] } {
  const n = engine.runners.size;
  const results: RaceResultRow[] = engine.ranking().map((entry) => ({
    id: entry.id,
    name: names.get(entry.id) ?? 'Oyuncu',
    rank: entry.rank,
    finishTime: entry.finishTime,
    disqualified: entry.disqualified,
    points: pointsForRank(entry.rank, n, entry.disqualified),
  }));

  const categories: FunCategory[] = [];
  const nameOf = (id: string) => names.get(id) ?? 'Oyuncu';

  const maxBy = (key: 'hits' | 'taken' | 'boxesTaken' | 'blocks'): [string, number] | null => {
    let best: [string, number] | null = null;
    for (const [id, st] of engine.stats) {
      const v = st[key];
      if (v > 0 && (!best || v > best[1])) best = [id, v];
    }
    return best;
  };

  const topHits = maxBy('hits');
  if (topHits) {
    categories.push({
      title: 'En Çok Skill İsabet Ettiren',
      emoji: '🎯',
      name: `${nameOf(topHits[0])} (${topHits[1]})`,
    });
  }
  const topTaken = maxBy('taken');
  if (topTaken) {
    categories.push({
      title: 'En Şanssız',
      emoji: '☔',
      name: `${nameOf(topTaken[0])} (${topTaken[1]} skill yedi)`,
    });
  }
  const topBoxes = maxBy('boxesTaken');
  if (topBoxes) {
    categories.push({
      title: 'Kutu Canavarı',
      emoji: '📦',
      name: `${nameOf(topBoxes[0])} (${topBoxes[1]} kutu)`,
    });
  }
  const topBlocks = maxBy('blocks');
  if (topBlocks) {
    categories.push({
      title: 'Geçilmez Duvar',
      emoji: '🛡️',
      name: `${nameOf(topBlocks[0])} (${topBlocks[1]} blok)`,
    });
  }
  // Sondan gelen şampiyon
  const winner = results.find((r) => r.rank === 1);
  if (winner && engine.wasLast.has(winner.id)) {
    categories.push({
      title: 'Son Anda Kurtulan',
      emoji: '🐦‍🔥',
      name: `${winner.name} (son sıradan zirveye)`,
    });
  }

  return { results, categories };
}
