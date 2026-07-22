// 30 araçlık garaj — tüm isimler kurgu, istatistikler gerçek dünya performansından esinlenme.
// grip: yol tutuş (yüksek = viraj stabil), driftControl: drift'te kontrol, steerRate: çeviklik.

import type { CarStats } from './types';

export const CARS: CarStats[] = [
  { id: 'chiron-ghost', name: 'Chiron Ghost', category: 'Hyper', accel0to100: 2.4, topSpeed: 420, grip: 0.92, driftControl: 0.55, steerRate: 0.92, soundProfile: 'v12', bodyType: 'hyper', special: null, defaultColor: '#1c2f6b', xpRequired: 0 },
  { id: 'jesko-storm', name: 'Jesko Storm', category: 'Hyper', accel0to100: 2.5, topSpeed: 480, grip: 0.9, driftControl: 0.5, steerRate: 0.9, soundProfile: 'v8', bodyType: 'hyper', special: null, defaultColor: '#e8e6e3', xpRequired: 0 },
  { id: 'sf-rosso', name: 'SF Rosso', category: 'Süper', accel0to100: 2.5, topSpeed: 340, grip: 0.88, driftControl: 0.68, steerRate: 1.02, soundProfile: 'v8', bodyType: 'super', special: null, defaultColor: '#d90429', xpRequired: 0 },
  { id: 'huracan-toro', name: 'Huracán Toro', category: 'Süper', accel0to100: 2.9, topSpeed: 325, grip: 0.86, driftControl: 0.72, steerRate: 1.0, soundProfile: 'v10', bodyType: 'super', special: null, defaultColor: '#7ddf3a', xpRequired: 0 },
  { id: 'turbo-wolf', name: 'Turbo Wolf', category: 'Süper', accel0to100: 2.7, topSpeed: 330, grip: 0.85, driftControl: 0.75, steerRate: 1.05, soundProfile: 'flat6', bodyType: 'super', special: null, defaultColor: '#ffd60a', xpRequired: 0 },
  { id: 'mcclaw-720', name: 'McClaw 720', category: 'Süper', accel0to100: 2.9, topSpeed: 340, grip: 0.87, driftControl: 0.7, steerRate: 1.0, soundProfile: 'v8', bodyType: 'super', special: null, defaultColor: '#ff7b00', xpRequired: 0 },
  { id: 'gtr-kaplan', name: 'GTR Kaplan', category: 'Spor', accel0to100: 2.9, topSpeed: 315, grip: 0.82, driftControl: 0.78, steerRate: 1.0, soundProfile: 'inline6', bodyType: 'sport', special: null, defaultColor: '#c0c3c9', xpRequired: 0 },
  { id: 'corvette-sahin', name: 'Corvette Şahin', category: 'Spor', accel0to100: 2.5, topSpeed: 330, grip: 0.8, driftControl: 0.8, steerRate: 0.98, soundProfile: 'v8', bodyType: 'sport', special: null, defaultColor: '#f2c614', xpRequired: 0 },
  { id: 'supra-kartal', name: 'Supra Kartal', category: 'Spor', accel0to100: 4.1, topSpeed: 250, grip: 0.76, driftControl: 0.88, steerRate: 1.08, soundProfile: 'inline6', bodyType: 'sport', special: null, defaultColor: '#e63946', xpRequired: 0 },
  { id: 'demon-reaper', name: 'Demon Reaper', category: 'Kas', accel0to100: 1.7, topSpeed: 315, grip: 0.6, driftControl: 0.92, steerRate: 0.85, soundProfile: 'v8', bodyType: 'muscle', special: null, defaultColor: '#6a040f', xpRequired: 0 },
  { id: 'mustang-vahsi', name: 'Mustang Vahşi', category: 'Kas', accel0to100: 4.8, topSpeed: 260, grip: 0.62, driftControl: 0.9, steerRate: 0.9, soundProfile: 'v8', bodyType: 'muscle', special: null, defaultColor: '#023e7d', xpRequired: 0 },
  { id: 'camaro-boga', name: 'Camaro Boğa', category: 'Kas', accel0to100: 4.0, topSpeed: 290, grip: 0.65, driftControl: 0.88, steerRate: 0.92, soundProfile: 'v8', bodyType: 'muscle', special: null, defaultColor: '#ffba08', xpRequired: 0 },
  { id: 'm-wolf-4', name: 'M-Wolf 4', category: 'Sedan', accel0to100: 3.5, topSpeed: 290, grip: 0.78, driftControl: 0.8, steerRate: 1.0, soundProfile: 'inline6', bodyType: 'sedan', special: null, defaultColor: '#2b2d42', xpRequired: 0 },
  { id: 'rs-simsek', name: 'RS Şimşek', category: 'Sedan', accel0to100: 3.6, topSpeed: 305, grip: 0.8, driftControl: 0.75, steerRate: 0.98, soundProfile: 'v8', bodyType: 'sedan', special: null, defaultColor: '#495057', xpRequired: 0 },
  { id: 'volt-plaid', name: 'Volt Plaid', category: 'Elektrikli', accel0to100: 2.1, topSpeed: 320, grip: 0.86, driftControl: 0.6, steerRate: 1.0, soundProfile: 'electric', bodyType: 'sedan', special: null, defaultColor: '#f8f9fa', xpRequired: 0 },
  { id: 'taycan-simsek', name: 'Taycan Şimşek', category: 'Elektrikli', accel0to100: 2.2, topSpeed: 305, grip: 0.87, driftControl: 0.62, steerRate: 1.02, soundProfile: 'electric', bodyType: 'gt', special: null, defaultColor: '#00b4d8', xpRequired: 0 },
  { id: 'rivian-yaban', name: 'Rivian Yaban', category: 'Elektrikli', accel0to100: 3.0, topSpeed: 200, grip: 0.7, driftControl: 0.55, steerRate: 0.85, soundProfile: 'electric', bodyType: 'suv', special: null, defaultColor: '#2d6a4f', xpRequired: 0 },
  { id: 'wrangler-kaya', name: 'Wrangler Kaya', category: 'Arazi', accel0to100: 7.0, topSpeed: 160, grip: 0.55, driftControl: 0.5, steerRate: 0.8, soundProfile: 'inline4', bodyType: 'suv', special: null, defaultColor: '#606c38', xpRequired: 0 },
  { id: 'defender-firtina', name: 'Defender Fırtına', category: 'Arazi', accel0to100: 6.0, topSpeed: 210, grip: 0.6, driftControl: 0.52, steerRate: 0.82, soundProfile: 'v8', bodyType: 'suv', special: null, defaultColor: '#adb5bd', xpRequired: 0 },
  { id: 'civic-ok', name: 'Civic Ok', category: 'Kompakt', accel0to100: 5.4, topSpeed: 275, grip: 0.74, driftControl: 0.7, steerRate: 1.1, soundProfile: 'inline4', bodyType: 'compact', special: null, defaultColor: '#0077b6', xpRequired: 0 },
  { id: 'cyber-kaya', name: 'Cyber Kaya', category: 'E-Pickup', accel0to100: 2.7, topSpeed: 210, grip: 0.68, driftControl: 0.58, steerRate: 0.82, soundProfile: 'electric', bodyType: 'pickup', special: null, defaultColor: '#ced4da', xpRequired: 0 },
  { id: 'devriye-x', name: 'Devriye X', category: 'Polis', accel0to100: 4.9, topSpeed: 240, grip: 0.72, driftControl: 0.72, steerRate: 0.95, soundProfile: 'v8', bodyType: 'sedan', special: 'police', defaultColor: '#f8f9fa', xpRequired: 0, hasSiren: true },
  { id: 'acil-sahin', name: 'Acil Şahin', category: 'Ambulans', accel0to100: 5.5, topSpeed: 200, grip: 0.65, driftControl: 0.6, steerRate: 0.85, soundProfile: 'v8', bodyType: 'suv', special: 'ambulance', defaultColor: '#f8f9fa', xpRequired: 0, hasSiren: true },
  { id: 'sari-kartal', name: 'Sarı Kartal', category: 'Taksi', accel0to100: 8.0, topSpeed: 195, grip: 0.68, driftControl: 0.68, steerRate: 1.0, soundProfile: 'inline4', bodyType: 'sedan', special: 'taxi', defaultColor: '#ffd60a', xpRequired: 0 },
  { id: 'ruzgar-mx', name: 'Rüzgar MX', category: 'Roadster', accel0to100: 6.5, topSpeed: 210, grip: 0.78, driftControl: 0.85, steerRate: 1.15, soundProfile: 'inline4', bodyType: 'roadster', special: null, defaultColor: '#e5383b', xpRequired: 0 },
  { id: 'alfa-kartal', name: 'Alfa Kartal', category: 'Sedan Spor', accel0to100: 3.8, topSpeed: 285, grip: 0.79, driftControl: 0.78, steerRate: 1.05, soundProfile: 'v8', bodyType: 'sedan', special: null, defaultColor: '#9d0208', xpRequired: 0 },
  { id: 'golge-aston', name: 'Gölge Aston', category: 'Lüks GT', accel0to100: 3.9, topSpeed: 300, grip: 0.81, driftControl: 0.74, steerRate: 0.95, soundProfile: 'v12', bodyType: 'gt', special: null, defaultColor: '#1b4332', xpRequired: 0 },
  { id: 'mini-simsek', name: 'Mini Şimşek', category: 'Kompakt', accel0to100: 6.1, topSpeed: 230, grip: 0.76, driftControl: 0.72, steerRate: 1.18, soundProfile: 'inline4', bodyType: 'compact', special: null, defaultColor: '#38b000', xpRequired: 0 },
  { id: 'orman-kurdu', name: 'Orman Kurdu', category: 'Rally', accel0to100: 4.6, topSpeed: 255, grip: 0.72, driftControl: 0.95, steerRate: 1.12, soundProfile: 'flat6', bodyType: 'rally', special: null, defaultColor: '#0353a4', xpRequired: 0 },
  { id: 'toro-nihai', name: 'Toro Nihai', category: 'Flagship Hyper', accel0to100: 2.5, topSpeed: 350, grip: 0.9, driftControl: 0.65, steerRate: 0.98, soundProfile: 'v12', bodyType: 'hyper', special: null, defaultColor: '#7209b7', xpRequired: 0 },
];

export const getCar = (id: string): CarStats => CARS.find((c) => c.id === id) ?? CARS[19]; // fallback: civic-ok

export const CATEGORIES = [...new Set(CARS.map((c) => c.category))];

/** 0..1 performans skoru — hız ağırlıklı, ivme + tutuş katkılı (bot araç eşleştirmesi için). */
export function carPerformanceScore(c: CarStats): number {
  const speed = (c.topSpeed - 160) / (480 - 160); // garajdaki min..max aralığı
  const accel = (8.0 - c.accel0to100) / (8.0 - 1.7);
  return speed * 0.55 + accel * 0.3 + c.grip * 0.15;
}

/**
 * Oyuncunun aracına performansça EN YAKIN n aracı seçer — oyuncu hızlı araç seçerse botlar da
 * hızlı, yavaş seçerse botlar da yavaş olur → rekabet araç sınıfından bağımsız hep başa baş.
 * Oyuncunun KENDİ aracı da havuzdadır (mesafe 0 → her zaman ilk sırada): gerçek hayatta başka
 * oyuncular da aynı arabayı alabilir; en iyi arabayı seçmek rakipsiz kalmayı garantilemez.
 */
export function pickMatchedBotCars(playerCarId: string, n: number): CarStats[] {
  const myScore = carPerformanceScore(getCar(playerCarId));
  return CARS.map((c) => ({ c, d: Math.abs(carPerformanceScore(c) - myScore) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.c);
}
