import { create } from 'zustand';
import type { RacePhase } from '../game/engine';
import type { SkillId } from '../game/types';
import type { BadgeDef } from '../game/badges';

export interface RaceResultRow {
  id: string;
  name: string;
  rank: number;
  finishTime: number | null;
  disqualified: boolean;
  points: number;
}

/** Oyuncunun bu yarıştan kazandıkları (sonuç ekranı meta bilgisi) */
export interface RaceOutcomeMeta {
  points: number;
  bonus: number;
  totalPoints: number;
  rankTitle: string;
  newBadges: BadgeDef[];
  newBestTime: boolean;
  xpGained: number;
}

interface RaceUIState {
  phase: RacePhase;
  /** Geri sayım: kaç ışık yanık (0..5), -1 = yarış başladı */
  litLights: number;
  raceTime: number;
  rank: number;
  totalRunners: number;
  /** Envanterdeki skill (HUD butonu için) */
  skill: SkillId | null;
  /** Checkpoint geçişinde kısa süreli sıra bildirimi */
  checkpointFlash: number;
  /** Foto-finiş oynatılıyor (HUD bandı için) */
  replayActive: boolean;
  /** Üst ilerleme çubuğu: tüm yarışçıların pist üzerindeki oransal konumu */
  progress: { id: string; frac: number; emoji: string; me: boolean; name: string }[];
  results: RaceResultRow[];
  meta: RaceOutcomeMeta | null;
  /** Mizahi kategoriler */
  categories: { title: string; emoji: string; name: string }[];
  /** Bu yarış çok oyunculu muydu (revanş butonu için) */
  wasMultiplayer: boolean;
  /** Sağ üst skill isabet akışı: "X ⚡ Y" satırları (kısa ömürlü) */
  feed: { key: number; text: string }[];
  pushFeed: (text: string) => void;
  set: (partial: Partial<RaceUIState>) => void;
  reset: () => void;
}

const initial = {
  phase: 'countdown' as RacePhase,
  litLights: 0,
  raceTime: 0,
  rank: 1,
  totalRunners: 1,
  skill: null,
  checkpointFlash: 0,
  replayActive: false,
  progress: [] as { id: string; frac: number; emoji: string; me: boolean; name: string }[],
  results: [] as RaceResultRow[],
  meta: null as RaceOutcomeMeta | null,
  categories: [] as { title: string; emoji: string; name: string }[],
  wasMultiplayer: false,
  feed: [] as { key: number; text: string }[],
};

let feedSeq = 0;

export const useRaceStore = create<RaceUIState>((set, get) => ({
  ...initial,
  set: (partial) => set(partial),
  reset: () => set(initial),
  pushFeed: (text) => {
    const key = ++feedSeq;
    set({ feed: [...get().feed.slice(-3), { key, text }] });
    window.setTimeout(() => {
      set({ feed: get().feed.filter((f) => f.key !== key) });
    }, 4200);
  },
}));
