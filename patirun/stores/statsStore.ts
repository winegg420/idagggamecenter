// Yerel oyun istatistikleri: toplam yarış, puan, seri, rozetler, gizli harita kilidi.
// Supabase varsa users tablosuyla senkronlanır; yerel kopya her zaman tutulur
// (çevrimdışı geliştirme ve hızlı UI için).
import { create } from 'zustand';
import { SECRETS } from '../config/constants';

const LS_KEY = 'yaris.stats';

interface LocalStats {
  totalRaces: number;
  totalWins: number;
  points: number;
  winStreak: number;
  /** Yarışılan haritalar */
  mapsPlayed: string[];
  /** Kazanılmış rozet id'leri */
  badges: string[];
  /** Son yarış günü (YYYY-MM-DD, günlük bonus için) */
  lastRaceDate: string | null;
  /** Gizli harita sürprizi gösterildi mi */
  hiddenMapCelebrated: boolean;
  /** Skill kullanım sayaçları (favori skill istatistiği) */
  skillUses: Record<string, number>;
}

const DEFAULTS: LocalStats = {
  totalRaces: 0,
  totalWins: 0,
  points: 0,
  winStreak: 0,
  mapsPlayed: [],
  badges: [],
  lastRaceDate: null,
  hiddenMapCelebrated: false,
  skillUses: {},
};

function load(): LocalStats {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocalStats>) };
  } catch {
    // bozuk veri → sıfırdan
  }
  return { ...DEFAULTS };
}

interface StatsState extends LocalStats {
  /** Bu oturumda gizli harita kilidi yeni açıldı (sürpriz bildirimi) */
  justUnlockedHidden: boolean;
  hiddenUnlocked: () => boolean;
  /** Yarış sonucu işlendikten sonra çağrılır; günlük durumu döner. */
  applyRace: (args: {
    mapId: string;
    won: boolean;
    points: number;
    newBadges: string[];
    today: string;
  }) => void;
  addSkillUse: (skill: string) => void;
  celebrateHidden: () => void;
  mergeRemote: (remote: { totalRaces?: number; points?: number; totalWins?: number }) => void;
}

function persistState(s: StatsState): void {
  const data: LocalStats = {
    totalRaces: s.totalRaces,
    totalWins: s.totalWins,
    points: s.points,
    winStreak: s.winStreak,
    mapsPlayed: s.mapsPlayed,
    badges: s.badges,
    lastRaceDate: s.lastRaceDate,
    hiddenMapCelebrated: s.hiddenMapCelebrated,
    skillUses: s.skillUses,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // depolama yoksa oyun yine çalışır
  }
}

export const useStatsStore = create<StatsState>((set, get) => ({
  ...load(),
  justUnlockedHidden: false,

  hiddenUnlocked: () => get().totalRaces >= SECRETS.HIDDEN_MAP_RACES,

  applyRace: ({ mapId, won, points, newBadges, today }) => {
    const st = get();
    const before = st.totalRaces;
    const totalRaces = before + 1;
    const justUnlocked =
      before < SECRETS.HIDDEN_MAP_RACES && totalRaces >= SECRETS.HIDDEN_MAP_RACES;
    set({
      totalRaces,
      totalWins: st.totalWins + (won ? 1 : 0),
      points: st.points + points,
      winStreak: won ? st.winStreak + 1 : 0,
      mapsPlayed: st.mapsPlayed.includes(mapId) ? st.mapsPlayed : [...st.mapsPlayed, mapId],
      badges: [...st.badges, ...newBadges.filter((b) => !st.badges.includes(b))],
      lastRaceDate: today,
      justUnlockedHidden: justUnlocked || st.justUnlockedHidden,
    });
    persistState(get());
  },

  addSkillUse: (skill) => {
    const uses = { ...get().skillUses, [skill]: (get().skillUses[skill] ?? 0) + 1 };
    set({ skillUses: uses });
    persistState(get());
  },

  celebrateHidden: () => {
    set({ hiddenMapCelebrated: true, justUnlockedHidden: false });
    persistState(get());
  },

  mergeRemote: (remote) => {
    const st = get();
    set({
      totalRaces: Math.max(st.totalRaces, remote.totalRaces ?? 0),
      points: Math.max(st.points, remote.points ?? 0),
      totalWins: Math.max(st.totalWins, remote.totalWins ?? 0),
    });
    persistState(get());
  },
}));
