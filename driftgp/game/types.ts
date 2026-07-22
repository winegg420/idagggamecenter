// Ortak oyun tipleri

export type BodyType =
  | 'hyper'
  | 'super'
  | 'sport'
  | 'muscle'
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'compact'
  | 'roadster'
  | 'gt'
  | 'rally';

export type SpecialTheme = 'police' | 'ambulance' | 'taxi' | null;

export type SoundProfile = 'v8' | 'v10' | 'v12' | 'flat6' | 'inline6' | 'inline4' | 'electric';

export interface CarStats {
  /** benzersiz kimlik */
  id: string;
  /** Kurgu araç adı (gerçek marka YOK) */
  name: string;
  category: string;
  /** 0-100 km/s süresi (sn) */
  accel0to100: number;
  /** km/s */
  topSpeed: number;
  /** 0..1 — yüksek grip = yol tutuşu iyi, drift zor */
  grip: number;
  /** 0..1 — drift modunda kayma kontrolü */
  driftControl: number;
  /** direksiyon hassasiyeti çarpanı */
  steerRate: number;
  soundProfile: SoundProfile;
  /** gövde şekli (parametrik 3D model seçimi) */
  bodyType: BodyType;
  /** özel konsept teması (polis/ambulans/taksi) */
  special: SpecialTheme;
  /** varsayılan kaporta rengi */
  defaultColor: string;
  /** kilidi açmak için gereken XP (0 = baştan açık) */
  xpRequired: number;
  /** siren var mı */
  hasSiren?: boolean;
}

/** 13 kategorili kişiselleştirme durumu */
export interface CarCustomization {
  paintColor: string;
  paintFinish: 'parlak' | 'mat' | 'metalik';
  rim: number; // 0-2
  tire: number; // 0-2 (yol/drift/yarış)
  exhaust: number; // 0-2
  splitter: number; // 0-1
  spoiler: number; // 0-2
  skirt: number; // 0-1
  hood: number; // 0-1 (standart/karbon)
  tint: number; // 0-2
  lightColor: number; // 0-2
  decal: number; // 0-2
  nitroColor: number; // 0-2
  dashTheme: number; // 0-1
}

export interface CarInput {
  /** -1 (sol) .. 1 (sağ) */
  steer: number;
  /** 0..1 — otomatik gaz varsayılanı 1 */
  throttle: number;
  brake: boolean;
  drift: boolean;
  nitro: boolean;
}

export interface CarState {
  /** dünya koordinatı (x, z) */
  x: number;
  z: number;
  /** yön (radyan, +x ekseninden) */
  heading: number;
  /** hız vektörünün yönü (radyan) */
  velAngle: number;
  /** m/s */
  speed: number;
  /** anlık slip açısı (radyan) — drift göstergesi */
  slip: number;
  /** ön teker görsel açısı */
  steerVisual: number;
  /** 0..1 nitro enerjisi */
  nitroEnergy: number;
  nitroActive: boolean;
  drifting: boolean;
  wallContact: boolean;
  /** birikimli gövde hasarı 0..1 — sert çarpışmalarla artar; 0.35+ duman, 0.8+ yangın.
   *  Performansı kademeli düşürür (maks. hız/ivme). Yarış başında sıfırlanır. */
  damage: number;
  /** bu adımda duvara İLK temasın yanal çarpma hızı (m/s); temas yoksa/süren temasta 0.
   *  Ses/kamera sarsıntısı şiddeti gerçek darbeyle orantılı olsun diye dışa açılır. */
  wallImpact: number;
  /** pist ilerleme örnek indeksi (nearest hint) */
  trackIndex: number;
  /** tur içinde geçilen orta-nokta kontrolü */
  passedMid: boolean;
  lap: number;
  /** yarış kronometresi (sn) */
  raceTime: number;
  /** aktif tur başlangıç zamanı */
  lapStartTime: number;
  lapTimes: number[];
  finished: boolean;
  // --- istatistik / XP takibi ---
  driftScore: number;
  wallHits: number;
  maxSpeedKmh: number;
  nitroUses: number;
  /** aktif turda duvara çarpıldı mı (temiz tur rozeti) */
  lapWallHit: boolean;
  cleanLapDone: boolean;
}
