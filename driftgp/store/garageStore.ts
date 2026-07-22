// Garaj: seçili araç + araç başına kişiselleştirme. localStorage + Supabase senkron.

import { create } from 'zustand';
import type { CarCustomization } from '../game/types';
import { getCar } from '../game/cars';
import { defaultCustomization } from '../game/customization';
import { loadJson, saveJson } from '../lib/storage';
import { syncCustomization } from '../lib/cloudSync';

interface GarageData {
  selectedCarId: string;
  customizations: Record<string, CarCustomization>;
}

const DEFAULT: GarageData = { selectedCarId: 'civic-ok', customizations: {} };

interface GarageStore extends GarageData {
  selectCar: (id: string) => void;
  getCustomization: (carId: string) => CarCustomization;
  updateCustomization: (carId: string, patch: Partial<CarCustomization>) => void;
}

export const useGarageStore = create<GarageStore>((set, get) => ({
  ...loadJson('garage', DEFAULT),

  selectCar: (selectedCarId) => {
    set({ selectedCarId });
    saveJson('garage', { selectedCarId, customizations: get().customizations });
  },

  getCustomization: (carId) => {
    return get().customizations[carId] ?? defaultCustomization(getCar(carId).defaultColor);
  },

  updateCustomization: (carId, patch) => {
    const current = get().getCustomization(carId);
    const customizations = { ...get().customizations, [carId]: { ...current, ...patch } };
    set({ customizations });
    saveJson('garage', { selectedCarId: get().selectedCarId, customizations });
    syncCustomization(carId, customizations[carId]).catch((err) =>
      console.warn('[DidaGP] Kişiselleştirme senkronu ertelendi:', err),
    );
  },
}));
