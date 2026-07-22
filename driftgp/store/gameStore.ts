// Global oyun durumu: ekran navigasyonu + yarış akışı + HUD verileri.
// Fizik durumu ref'lerde tutulur; buraya sadece UI'nin ihtiyacı olan düşük frekanslı veri yazılır.

import { create } from 'zustand';
import { loadJson, saveJson } from '../lib/storage';
import { inputManager } from '../game/input';

export type Screen =
  | 'menu'
  | 'trackSelect'
  | 'carSelect'
  | 'garage'
  | 'profile'
  | 'multiplayer'
  | 'credits'
  | 'calibration'
  | 'race';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RacerResult {
  name: string;
  carId: string;
  /** toplam süre (sn); DNF ise -1 */
  time: number;
  isPlayer: boolean;
}

interface GameStore {
  screen: Screen;
  racePhase: RacePhase;
  /** yarış içi duraklatma menüsü açık mı (solo'da fizik donar; multi'de yarış devam eder) */
  paused: boolean;
  /** kalibrasyon sonrası dönülecek ekran akışı */
  afterCalibration: Screen;

  // yarış yapılandırması
  trackId: string;
  totalLaps: number;
  mode: 'solo' | 'multi';

  // start ışıkları
  lights: number;
  lightsOut: boolean;

  // HUD (fizik döngüsünden ~10Hz)
  speedKmh: number;
  /** sanal şanzıman vitesi (1..6) — ses motoruyla senkron */
  gear: number;
  lap: number;
  raceTime: number;
  nitroEnergy: number;
  drifting: boolean;
  position: number;
  racerCount: number;
  /** nitro aktif — hız çizgileri/boost efekti için */
  boosting: boolean;
  /** birikimli gövde hasarı 0..1 (HUD hasar göstergesi) */
  damage: number;
  /** çarpışma efekt sayacı (her çarpışmada artar → ekran sarsıntısı/flaş) */
  crashFx: number;

  // sonuç
  lapTimes: number[];
  results: RacerResult[];

  gyroActive: boolean;
  soundOn: boolean;
  /** direksiyon kontrol yöntemi: ekran butonları (varsayılan, güvenilir) veya telefon eğme (gyro) */
  controlMode: 'buttons' | 'tilt';

  // minimap verisi (Scene'den ~15Hz) — oyuncu [x,z,heading] + rakipler düz [x,z,...]
  mmPlayer: [number, number, number];
  mmRacers: number[];
  setMinimap: (p: [number, number, number], racers: number[]) => void;

  setScreen: (s: Screen) => void;
  setRacePhase: (p: RacePhase) => void;
  setPaused: (v: boolean) => void;
  setAfterCalibration: (s: Screen) => void;
  configureRace: (cfg: { trackId?: string; totalLaps?: number; mode?: 'solo' | 'multi' }) => void;
  setLights: (n: number, out?: boolean) => void;
  setHud: (h: Partial<Pick<GameStore, 'speedKmh' | 'gear' | 'lap' | 'raceTime' | 'nitroEnergy' | 'drifting' | 'position' | 'racerCount' | 'boosting' | 'damage'>>) => void;
  triggerCrash: () => void;
  finishRace: (lapTimes: number[], results: RacerResult[]) => void;
  setGyroActive: (v: boolean) => void;
  toggleSound: () => void;
  setControlMode: (m: 'buttons' | 'tilt') => void;
  startRace: () => void;
}

// varsayılan 2 tur — uzatılmış pistlerde (~75s/tur) toplam ~2.5 dk (hedef 2-3 dk)
const savedSettings = loadJson('settings', { soundOn: true, totalLaps: 2, controlMode: 'buttons' as 'buttons' | 'tilt' });
// input yöneticisine kayıtlı kontrol modunu uygula (başlangıç senkronu)
inputManager.controlMode = savedSettings.controlMode ?? 'buttons';

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  racePhase: 'countdown',
  paused: false,
  afterCalibration: 'race',
  trackId: 'city',
  totalLaps: savedSettings.totalLaps,
  mode: 'solo',
  lights: 0,
  lightsOut: false,
  speedKmh: 0,
  gear: 1,
  lap: 1,
  raceTime: 0,
  nitroEnergy: 0,
  drifting: false,
  position: 1,
  racerCount: 1,
  boosting: false,
  damage: 0,
  crashFx: 0,
  lapTimes: [],
  results: [],
  gyroActive: false,
  soundOn: savedSettings.soundOn,
  controlMode: savedSettings.controlMode ?? 'buttons',
  mmPlayer: [0, 0, 0],
  mmRacers: [],
  setMinimap: (mmPlayer, mmRacers) => set({ mmPlayer, mmRacers }),

  setScreen: (screen) => set({ screen, paused: false }),
  setRacePhase: (racePhase) => set({ racePhase }),
  setPaused: (paused) => set({ paused }),
  setAfterCalibration: (afterCalibration) => set({ afterCalibration }),
  configureRace: (cfg) => {
    set(cfg);
    if (cfg.totalLaps) saveJson('settings', { soundOn: get().soundOn, totalLaps: cfg.totalLaps, controlMode: get().controlMode });
  },
  setLights: (lights, out = false) => set({ lights, lightsOut: out }),
  setHud: (h) => set(h),
  triggerCrash: () => set((s) => ({ crashFx: s.crashFx + 1 })),
  finishRace: (lapTimes, results) => set({ racePhase: 'finished', lapTimes, results }),
  setGyroActive: (gyroActive) => set({ gyroActive }),
  toggleSound: () => {
    const soundOn = !get().soundOn;
    set({ soundOn });
    saveJson('settings', { soundOn, totalLaps: get().totalLaps, controlMode: get().controlMode });
  },
  setControlMode: (controlMode) => {
    set({ controlMode });
    inputManager.controlMode = controlMode;
    saveJson('settings', { soundOn: get().soundOn, totalLaps: get().totalLaps, controlMode });
  },
  startRace: () =>
    set({
      screen: 'race',
      racePhase: 'countdown',
      paused: false,
      lights: 0,
      lightsOut: false,
      speedKmh: 0,
      gear: 1,
      lap: 1,
      raceTime: 0,
      nitroEnergy: 0,
      drifting: false,
      position: 1,
      damage: 0,
      lapTimes: [],
      results: [],
    }),
}));

export function formatTime(t: number): string {
  if (t < 0) return 'DNF';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
