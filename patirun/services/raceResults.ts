// Yarış sonucu işleme: puan + günlük bonus + rozetler + rütbe + DB kaydı + hayalet.
// Supabase yoksa tamamen yerel çalışır.
import { supabase } from '../lib/supabase';
import { pointsForRank, rankTitleForPoints, dailyBonus } from '../game/scoring';
import { evaluateBadges, getBadge, type BadgeDef } from '../game/badges';
import { useStatsStore } from '../stores/statsStore';
import type { RaceEngine } from '../game/engine';
import type { MapId } from '../game/types';

export interface RaceOutcomeInput {
  engine: RaceEngine;
  /** Motor içindeki oyuncu id'si */
  playerId: string;
  /** Veritabanı kullanıcı id'si (auth) */
  userId: string | undefined;
  mapId: MapId;
  mode: 'tekli' | 'hizli' | 'ozel';
  characterId: string;
  night: boolean;
  rank: number;
  playerCount: number;
  finishTime: number | null;
  disqualified: boolean;
  /** Hayalet kaydı (yeni rekor kontrolü için) */
  ghostData?: number[];
}

export interface RaceOutcomeResult {
  points: number;
  bonus: number;
  totalPoints: number;
  rankTitle: string;
  newBadges: BadgeDef[];
  newBestTime: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function processRaceResult(input: RaceOutcomeInput): Promise<RaceOutcomeResult> {
  const stats = useStatsStore.getState();
  const won = input.rank === 1 && !input.disqualified;
  const basePoints = pointsForRank(input.rank, input.playerCount, input.disqualified);
  const bonus = dailyBonus(stats.lastRaceDate, today());
  const points = basePoints + bonus;

  // Rozet değerlendirmesi
  const st = input.engine.stats.get(input.playerId);
  const newBadgeIds = evaluateBadges({
    rank: input.rank,
    playerCount: input.playerCount,
    wasLastAtSomePoint: input.engine.wasLast.has(input.playerId),
    skillHits: st?.hits ?? 0,
    skillsTaken: st?.taken ?? 0,
    shieldBlocks: st?.blocks ?? 0,
    lightningHit: (st?.lightningHits ?? 0) > 0,
    goldenSeen: input.engine.goldenSeen,
    usedShortcut: input.engine.shortcutUsers.has(input.playerId),
    night: input.night,
    totalRaces: stats.totalRaces + 1,
    winStreak: won ? stats.winStreak + 1 : 0,
    distinctMaps: new Set([...stats.mapsPlayed, input.mapId]).size,
    owned: new Set(stats.badges),
  });

  // Yerel istatistikleri güncelle
  stats.applyRace({ mapId: input.mapId, won, points, newBadges: newBadgeIds, today: today() });

  // En iyi süre (hayalet) — yerel
  let newBestTime = false;
  const bestKey = `yaris.best.${input.mapId}`;
  if (input.finishTime !== null && !input.disqualified) {
    try {
      const prevRaw = localStorage.getItem(bestKey);
      const prev = prevRaw ? (JSON.parse(prevRaw) as { sure: number }) : null;
      if (!prev || input.finishTime < prev.sure) {
        newBestTime = true;
        localStorage.setItem(
          bestKey,
          JSON.stringify({ sure: input.finishTime, ghost: input.ghostData ?? null }),
        );
      }
    } catch {
      // yerel rekor yazılamadı; kritik değil
    }
  }

  // Supabase kalıcılığı (varsa)
  if (supabase && input.userId) {
    try {
      const { data: raceRow } = await supabase
        .from('pr_races')
        .insert({ harita: input.mapId, mod: input.mode, bitis: new Date().toISOString() })
        .select('id')
        .single();

      if (raceRow) {
        await supabase.from('pr_race_participants').insert({
          race_id: raceRow.id,
          user_id: input.userId,
          karakter: input.characterId,
          sira: input.disqualified ? null : input.rank,
          bitis_suresi: input.finishTime,
          puan: points,
        });
      }

      await supabase.rpc('pr_apply_race_result', {
        p_puan: points,
        p_won: won,
        p_race_date: today(),
      });

      for (const id of newBadgeIds) {
        await supabase.from('pr_user_badges').upsert(
          { user_id: input.userId, badge_id: id },
          { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
        );
      }

      if (newBestTime && input.finishTime !== null) {
        await supabase.from('pr_best_times').upsert(
          {
            user_id: input.userId,
            harita: input.mapId,
            sure: input.finishTime,
            ghost_data: input.ghostData ?? null,
          },
          { onConflict: 'user_id,harita' },
        );
      }
    } catch {
      // Ağ hatası: yerel kayıt zaten yapıldı, oyun akışı bozulmaz
    }
  }

  const totalPoints = useStatsStore.getState().points;
  return {
    points: basePoints,
    bonus,
    totalPoints,
    rankTitle: rankTitleForPoints(totalPoints),
    newBadges: newBadgeIds.map((id) => getBadge(id)!).filter(Boolean),
    newBestTime,
  };
}

/** Haritanın yerel en iyi süresi + hayalet verisi */
export function loadBestTime(mapId: MapId): { sure: number; ghost: number[] | null } | null {
  try {
    const raw = localStorage.getItem(`yaris.best.${mapId}`);
    return raw ? (JSON.parse(raw) as { sure: number; ghost: number[] | null }) : null;
  } catch {
    return null;
  }
}
