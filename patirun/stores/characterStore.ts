// Karakter seçimi, kozmetik özelleştirme ve karakter XP yönetimi.
// Supabase varsa oraya, yoksa localStorage'a kalıcı yazar.
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  CHARACTERS,
  getCharacter,
  levelForXp,
  xpForRace,
  type CosmeticConfig,
} from '../game/characters/characters';

const LS_SELECTED = 'yaris.selectedCharacter';
const LS_COSMETICS = 'yaris.cosmetics';
const LS_XP = 'yaris.characterXp';

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // depolama dolu/kapalıysa sessizce geç
  }
}

interface CharacterState {
  selectedId: string;
  /** karakter id → kozmetik (özelleştirilmişse) */
  customizations: Record<string, CosmeticConfig>;
  /** karakter id → xp */
  xp: Record<string, number>;
  select: (id: string) => void;
  cosmeticsOf: (id: string) => CosmeticConfig;
  levelOf: (id: string) => number;
  saveCosmetics: (id: string, config: CosmeticConfig, userId?: string) => Promise<void>;
  addRaceXp: (id: string, rank: number, playerCount: number, userId?: string) => Promise<number>;
  loadRemote: (userId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  selectedId: loadLocal(LS_SELECTED, 'sloth'),
  customizations: loadLocal(LS_COSMETICS, {}),
  xp: loadLocal(LS_XP, {}),

  select: (id) => {
    set({ selectedId: id });
    saveLocal(LS_SELECTED, id);
  },

  cosmeticsOf: (id) => {
    return get().customizations[id] ?? getCharacter(id).defaultCosmetics;
  },

  levelOf: (id) => levelForXp(get().xp[id] ?? 0),

  saveCosmetics: async (id, config, userId) => {
    const customizations = { ...get().customizations, [id]: config };
    set({ customizations });
    saveLocal(LS_COSMETICS, customizations);
    if (supabase && userId) {
      try {
        await supabase.from('pr_character_customizations').upsert(
          { user_id: userId, karakter_id: id, kozmetik_json: config },
          { onConflict: 'user_id,karakter_id' },
        );
      } catch {
        // yerel kayıt zaten yapıldı; ağ hatası kritik değil
      }
    }
  },

  addRaceXp: async (id, rank, playerCount, userId) => {
    const gained = xpForRace(rank, playerCount);
    const xp = { ...get().xp, [id]: (get().xp[id] ?? 0) + gained };
    set({ xp });
    saveLocal(LS_XP, xp);
    if (supabase && userId) {
      try {
        await supabase.from('pr_character_xp').upsert(
          { user_id: userId, karakter_id: id, xp: xp[id], seviye: levelForXp(xp[id]) },
          { onConflict: 'user_id,karakter_id' },
        );
      } catch {
        // yerel kayıt yeterli
      }
    }
    return gained;
  },

  loadRemote: async (userId) => {
    if (!supabase) return;
    try {
      const [cosRes, xpRes] = await Promise.all([
        supabase.from('pr_character_customizations').select('karakter_id, kozmetik_json').eq('user_id', userId),
        supabase.from('pr_character_xp').select('karakter_id, xp').eq('user_id', userId),
      ]);
      const customizations = { ...get().customizations };
      for (const row of cosRes.data ?? []) {
        customizations[row.karakter_id] = row.kozmetik_json as CosmeticConfig;
      }
      const xp = { ...get().xp };
      for (const row of xpRes.data ?? []) {
        xp[row.karakter_id] = Math.max(xp[row.karakter_id] ?? 0, row.xp);
      }
      set({ customizations, xp });
      saveLocal(LS_COSMETICS, customizations);
      saveLocal(LS_XP, xp);
    } catch {
      // çevrimdışı: yerel veriyle devam
    }
  },
}));

/** Bot karakterleri: oyuncununkinden farklı rastgele karakterler */
export function pickBotCharacters(count: number, excludeId: string): string[] {
  const pool = CHARACTERS.filter((c) => c.id !== excludeId).map((c) => c.id);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
