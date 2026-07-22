import { create } from 'zustand';
import type { MapId, TimeOfDay } from '../game/types';
import type { BotDifficulty } from '../game/bots/botAI';

export type Screen =
  | 'auth'
  | 'menu'
  | 'race'
  | 'results'
  | 'lobby'
  | 'mpRace'
  | 'characters'
  | 'quickMatch'
  | 'podium'
  | 'profile'
  | 'leaderboard'
  | 'friends'
  | 'players';

interface AppState {
  screen: Screen;
  /** Aktif yarışın haritası */
  mapId: MapId;
  timeOfDay: TimeOfDay;
  botDifficulty: BotDifficulty;
  /** Yarıştaki bot sayısı */
  botCount: number;
  /** Hayalet yarış modu: SADECE açıkça seçilince rekor hayaleti görünür */
  ghostRace: boolean;
  /** Aynı haritada tekrar başlatmada motoru sıfırlamak için */
  raceNonce: number;
  setScreen: (s: Screen) => void;
  startRace: (
    mapId: MapId,
    opts?: { botDifficulty?: BotDifficulty; botCount?: number; ghostRace?: boolean },
  ) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Hub sürümü: giriş Bildim tarafında yapıldığı için doğrudan menüden başlar
  // ('auth' ekranı hub'da kullanılmaz; kimlik köprüsü PatiRunApp'te kurulur).
  screen: 'menu',
  mapId: 'orman',
  timeOfDay: 'gunduz',
  botDifficulty: 'orta',
  botCount: 5,
  ghostRace: false,
  raceNonce: 0,
  setScreen: (screen) => set({ screen }),
  startRace: (mapId, opts) =>
    set({
      screen: 'race',
      mapId,
      botDifficulty: opts?.botDifficulty ?? get().botDifficulty,
      botCount: opts?.botCount ?? get().botCount,
      ghostRace: opts?.ghostRace ?? false,
      raceNonce: get().raceNonce + 1,
      timeOfDay: Math.random() < 0.3 ? 'gece' : 'gunduz',
    }),
}));
