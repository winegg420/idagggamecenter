// 13 kategorili kişiselleştirme sistemi — varyant tanımları ve varsayılanlar.

import type { CarCustomization } from './types';

export interface VariantDef {
  key: keyof CarCustomization;
  label: string;
  options: string[];
  /** rank ile açılan varyant indeksleri → gereken XP */
  xpLocks?: Record<number, number>;
}

export const PAINT_FINISHES = ['parlak', 'mat', 'metalik'] as const;

// NOT: Araçlar gibi tüm özelleştirme seçenekleri de baştan açık (XP kilidi kaldırıldı) —
// böylece garajda HER seçenek tıklanabilir. (Önceki XP kilitleri "tıklanmıyor" hissine yol açıyordu.)
export const CUSTOMIZATION_DEFS: VariantDef[] = [
  { key: 'rim', label: 'Jant', options: ['Klasik 5 Kollu', 'Örgü Spor', 'Turbofan'] },
  { key: 'tire', label: 'Lastik', options: ['Yol', 'Drift', 'Yarış'] },
  { key: 'exhaust', label: 'Egzoz', options: ['Standart', 'Çift Çıkış', 'Yarış Orta Çıkış'] },
  { key: 'splitter', label: 'Ön Splitter', options: ['Standart', 'Yarış Splitter'] },
  { key: 'spoiler', label: 'Spoiler', options: ['Yok', 'Duckbill', 'GT Kanat'] },
  { key: 'skirt', label: 'Yan Etek', options: ['Standart', 'Yarış Eteği'] },
  { key: 'hood', label: 'Kaput', options: ['Standart', 'Karbon'] },
  { key: 'tint', label: 'Cam Filmi', options: ['Açık', 'Orta', 'Koyu'] },
  { key: 'lightColor', label: 'Far Rengi', options: ['Beyaz', 'Buz Mavisi', 'Sarı'] },
  { key: 'decal', label: 'Dekal', options: ['Yok', 'Yarış Şeridi', 'Çift Şerit'] },
  { key: 'nitroColor', label: 'Nitro Rengi', options: ['Mavi', 'Mor', 'Yeşil'] },
  { key: 'dashTheme', label: 'Gösterge Teması', options: ['Karanlık', 'Neon'] },
];

export const LIGHT_COLORS = ['#f3f6ff', '#9fd8ff', '#ffd76a'];
export const NITRO_COLORS = ['#38b6ff', '#b04cff', '#4cff7a'];
export const TINT_OPACITY = [0.55, 0.75, 0.94];

export function defaultCustomization(defaultColor: string): CarCustomization {
  return {
    paintColor: defaultColor,
    paintFinish: 'parlak',
    rim: 0,
    tire: 0,
    exhaust: 0,
    splitter: 0,
    spoiler: 1,
    skirt: 0,
    hood: 0,
    tint: 1,
    lightColor: 0,
    decal: 0,
    nitroColor: 0,
    dashTheme: 0,
  };
}

/** Lastik tipi fizik etkisi: [gripÇarpanı, driftÇarpanı] */
export const TIRE_EFFECT: Array<[number, number]> = [
  [1.0, 1.0], // yol
  [0.92, 1.18], // drift
  [1.1, 0.92], // yarış
];
