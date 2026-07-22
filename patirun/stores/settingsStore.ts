// Kullanıcı ayarları: ses (müzik/efekt ayrı), titreşim, grafik kalitesi.
import { create } from 'zustand';
import { sound } from '../lib/sound';

const LS_KEY = 'yaris.settings';

export type Quality = 'otomatik' | 'dusuk' | 'orta' | 'yuksek';

interface Settings {
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  quality: Quality;
}

const DEFAULTS: Settings = { music: true, sfx: true, vibration: true, quality: 'otomatik' };

function load(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // varsayılanlarla devam
  }
  return { ...DEFAULTS };
}

interface SettingsState extends Settings {
  /** Otomatik kalite ölçümünün sonucu (FPS'e göre) */
  autoQuality: Exclude<Quality, 'otomatik'>;
  set: (partial: Partial<Settings>) => void;
  setAutoQuality: (q: Exclude<Quality, 'otomatik'>) => void;
  /** Etkin kalite: manuel seçim ya da otomatik ölçüm */
  effectiveQuality: () => Exclude<Quality, 'otomatik'>;
  vibrate: (pattern: number | number[]) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = load();
  sound.setMusicEnabled(initial.music);
  sound.setSfxEnabled(initial.sfx);
  return {
    ...initial,
    autoQuality: 'yuksek',

    set: (partial) => {
      set(partial);
      const s = get();
      sound.setMusicEnabled(s.music);
      sound.setSfxEnabled(s.sfx);
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ music: s.music, sfx: s.sfx, vibration: s.vibration, quality: s.quality }),
        );
      } catch {
        // kalıcı olmasa da oturum içinde geçerli
      }
    },

    setAutoQuality: (q) => set({ autoQuality: q }),

    effectiveQuality: () => {
      const s = get();
      return s.quality === 'otomatik' ? s.autoQuality : s.quality;
    },

    vibrate: (pattern) => {
      if (!get().vibration) return;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // desteklenmeyen tarayıcı
      }
    },
  };
});
