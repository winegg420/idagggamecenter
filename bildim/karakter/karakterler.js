// 20 özgün, komik hayvan karakteri — tamamı parametrik low-poly tanım.
// Hiçbir oyundan/markadan kopya değildir.

export const COSMETIC_OPTIONS = {
  hat: ['yok', 'kep', 'silindir', 'ascibone', 'fedora', 'tac', 'kask', 'bere'],
  glasses: ['yok', 'gunes', 'yuvarlak', 'kare', 'pilot'],
  necklace: ['yok', 'altin', 'papyon', 'atki', 'kravat'],
  wristband: ['yok', 'bant', 'saat'],
  hair: ['yok', 'rasta', 'sari', 'kisa', 'mohawk', 'peruk'],
  mustache: ['yok', 'pos', 'ince'],
  beard: ['yok', 'keci', 'tam'],
  top: ['yok', 'tisort', 'atlet', 'gomlek', 'takim', 'esofman', 'onluk', 'ceket', 'uzaykiyafeti', 'pelerin'],
  shoes: ['yok', 'spor', 'topuklu', 'bot', 'terlik'],
};

export const COSMETIC_LABELS = {
  yok: 'Yok', kep: 'Kep', silindir: 'Silindir Şapka', ascibone: 'Aşçı Bonesi',
  fedora: 'Fedora', tac: 'Taç', kask: 'Kask', bere: 'Bere',
  gunes: 'Güneş Gözlüğü', yuvarlak: 'Yuvarlak Gözlük', kare: 'Kare Gözlük', pilot: 'Pilot Gözlük',
  altin: 'Altın Kolye', papyon: 'Papyon', atki: 'Atkı', kravat: 'Kravat',
  bant: 'Bileklik', saat: 'Saat',
  rasta: 'Rasta', sari: 'Sarı Peruk', kisa: 'Kısa Saç', mohawk: 'Mohawk', peruk: 'Kabarık Peruk',
  pos: 'Pos Bıyık', ince: 'İnce Bıyık',
  keci: 'Keçi Sakal', tam: 'Tam Sakal',
  tisort: 'Tişört', atlet: 'Atlet', gomlek: 'Gömlek', takim: 'Takım Elbise',
  esofman: 'Eşofman', onluk: 'Aşçı Önlüğü', ceket: 'Deri Ceket',
  uzaykiyafeti: 'Uzay Kıyafeti', pelerin: 'Pelerin',
  spor: 'Spor Ayakkabı', topuklu: 'Topuklu', bot: 'Bot', terlik: 'Terlik',
};

export const COSMETIC_COLORS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#8338ec',
  '#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#111111', '#ffffff',
  '#8d5524', '#c68642', '#25d366', '#ffd700',
];

const none = {
  hat: 'yok', hatColor: '#111111',
  glasses: 'yok', glassesColor: '#111111',
  necklace: 'yok', necklaceColor: '#ffd700',
  wristband: 'yok', wristbandColor: '#e63946',
  hair: 'yok', hairColor: '#8d5524',
  mustache: 'yok', beard: 'yok',
  top: 'yok', topColor: '#457b9d',
  shoes: 'yok', shoesColor: '#111111',
};

export const CHARACTERS = [
  {
    id: 'sloth', name: 'Keyif Tembel', emoji: '🦥',
    bodyColor: '#a68a64', bellyColor: '#d9c5a0', earType: 'yuvarlak', snout: 'burun',
    bodyScale: [1.1, 0.95], hasTail: false, voicePitch: 180,
    defaultCosmetics: { ...none, glasses: 'gunes', top: 'tisort', topColor: '#00b4d8', shoes: 'terlik', shoesColor: '#ff6d00' },
  },
  {
    id: 'penguen', name: 'Müdür Penguen', emoji: '🐧',
    bodyColor: '#1d3557', bellyColor: '#f1faee', earType: 'yok', snout: 'gaga',
    bodyScale: [1.05, 1], hasTail: false, voicePitch: 260,
    defaultCosmetics: { ...none, top: 'takim', topColor: '#22223b', necklace: 'kravat', necklaceColor: '#e63946' },
  },
  {
    id: 'tavsan', name: 'Koç Tavşan', emoji: '🐰',
    bodyColor: '#adb5bd', bellyColor: '#dee2e6', earType: 'uzun', snout: 'burun',
    bodyScale: [0.95, 1.1], hasTail: true, voicePitch: 320,
    defaultCosmetics: { ...none, top: 'esofman', topColor: '#d90429', wristband: 'bant', wristbandColor: '#ffbe0b' },
  },
  {
    id: 'ayi', name: 'Şef Ayı', emoji: '🐻',
    bodyColor: '#7f5539', bellyColor: '#b08968', earType: 'yuvarlak', snout: 'burun',
    bodyScale: [1.25, 1.05], hasTail: false, voicePitch: 140,
    defaultCosmetics: { ...none, hat: 'ascibone', hatColor: '#ffffff', top: 'onluk', topColor: '#ffffff' },
  },
  {
    id: 'kedi', name: 'Rocker Kedi', emoji: '🐱',
    bodyColor: '#212529', bellyColor: '#495057', earType: 'sivri', snout: 'burun',
    bodyScale: [0.9, 1], hasTail: true, voicePitch: 300,
    defaultCosmetics: { ...none, top: 'ceket', topColor: '#111111', glasses: 'gunes', hair: 'mohawk', hairColor: '#e63946' },
  },
  {
    id: 'fare', name: 'Astro Fare', emoji: '🐭',
    bodyColor: '#adb5bd', bellyColor: '#e9ecef', earType: 'yuvarlak', snout: 'burun',
    bodyScale: [0.8, 0.85], hasTail: true, voicePitch: 400,
    defaultCosmetics: { ...none, top: 'uzaykiyafeti', topColor: '#f1faee', hat: 'kask', hatColor: '#f1faee' },
  },
  {
    id: 'papagan', name: 'DJ Papağan', emoji: '🦜',
    bodyColor: '#2a9d8f', bellyColor: '#e9c46a', earType: 'yok', snout: 'gaga',
    bodyScale: [0.85, 0.95], hasTail: true, voicePitch: 440,
    defaultCosmetics: { ...none, hat: 'bere', hatColor: '#8338ec', necklace: 'altin' },
  },
  {
    id: 'tilki', name: 'Ninja Tilki', emoji: '🦊',
    bodyColor: '#e76f51', bellyColor: '#f4a261', earType: 'sivri', snout: 'burun',
    bodyScale: [0.9, 1], hasTail: true, voicePitch: 280,
    defaultCosmetics: { ...none, top: 'tisort', topColor: '#22223b', necklace: 'atki', necklaceColor: '#22223b' },
  },
  {
    id: 'timsah', name: 'Emlakçı Timsah', emoji: '🐊',
    bodyColor: '#588157', bellyColor: '#a3b18a', earType: 'yok', snout: 'hortum',
    bodyScale: [1.15, 0.95], hasTail: true, voicePitch: 160,
    defaultCosmetics: { ...none, top: 'takim', topColor: '#3a5a40', necklace: 'kravat', necklaceColor: '#ffd700' },
  },
  {
    id: 'ordek', name: 'Kont Vakvak', emoji: '🦆',
    bodyColor: '#f1faee', bellyColor: '#e9ecef', earType: 'yok', snout: 'gaga',
    bodyScale: [0.9, 0.9], hasTail: true, voicePitch: 350,
    defaultCosmetics: { ...none, top: 'pelerin', topColor: '#5a189a', necklace: 'papyon', necklaceColor: '#e63946' },
  },
  {
    id: 'flamingo', name: 'Topuklu Flamingo', emoji: '🦩',
    bodyColor: '#ff8fa3', bellyColor: '#ffccd5', earType: 'yok', snout: 'gaga',
    bodyScale: [0.75, 1.2], hasTail: false, voicePitch: 380,
    defaultCosmetics: { ...none, shoes: 'topuklu', shoesColor: '#d90429', necklace: 'altin' },
  },
  {
    id: 'kaplumbaga', name: 'Sörfçü Tosbi', emoji: '🐢',
    bodyColor: '#40916c', bellyColor: '#d8f3dc', earType: 'yok', snout: 'burun',
    bodyScale: [1.1, 0.85], hasTail: false, voicePitch: 200,
    defaultCosmetics: { ...none, hair: 'rasta', hairColor: '#7f5539', top: 'atlet', topColor: '#00b4d8' },
  },
  {
    id: 'aslan', name: 'Peruklu Aslan', emoji: '🦁',
    bodyColor: '#e9c46a', bellyColor: '#f4e8c1', earType: 'yuvarlak', snout: 'burun',
    bodyScale: [1.15, 1.05], hasTail: true, voicePitch: 150,
    defaultCosmetics: { ...none, hair: 'sari', hairColor: '#ffd700' },
  },
  {
    id: 'mors', name: 'Bıyıklı Mors', emoji: '🦭',
    bodyColor: '#6c584c', bellyColor: '#a98467', earType: 'yok', snout: 'burun',
    bodyScale: [1.3, 0.9], hasTail: false, voicePitch: 130,
    defaultCosmetics: { ...none, mustache: 'pos' },
  },
  {
    id: 'kurbaga', name: 'MC Vırak', emoji: '🐸',
    bodyColor: '#55a630', bellyColor: '#bfd200', earType: 'yok', snout: 'burun',
    bodyScale: [0.95, 0.85], hasTail: false, voicePitch: 240,
    defaultCosmetics: { ...none, necklace: 'altin', hat: 'kep', hatColor: '#111111', top: 'tisort', topColor: '#111111' },
  },
  {
    id: 'baykus', name: 'Prof. Baykuş', emoji: '🦉',
    bodyColor: '#8d6e63', bellyColor: '#d7ccc8', earType: 'sivri', snout: 'gaga',
    bodyScale: [0.9, 0.95], hasTail: false, voicePitch: 220,
    defaultCosmetics: { ...none, glasses: 'yuvarlak', top: 'gomlek', topColor: '#f1faee' },
  },
  {
    id: 'goril', name: 'Halterci Gori', emoji: '🦍',
    bodyColor: '#343a40', bellyColor: '#6c757d', earType: 'yuvarlak', snout: 'burun',
    bodyScale: [1.35, 1.1], hasTail: false, voicePitch: 120,
    defaultCosmetics: { ...none, top: 'atlet', topColor: '#e63946', wristband: 'bant', wristbandColor: '#111111' },
  },
  {
    id: 'rakun', name: 'Dedektif Rakun', emoji: '🦝',
    bodyColor: '#6c757d', bellyColor: '#ced4da', earType: 'sivri', snout: 'burun',
    bodyScale: [0.9, 0.9], hasTail: true, voicePitch: 290,
    defaultCosmetics: { ...none, hat: 'fedora', hatColor: '#463f3a', top: 'ceket', topColor: '#8a817c' },
  },
  {
    id: 'keci', name: 'Kaykaycı Keçi', emoji: '🐐',
    bodyColor: '#e5e5e5', bellyColor: '#ffffff', earType: 'sarkik', snout: 'burun',
    bodyScale: [0.9, 1], hasTail: true, voicePitch: 310,
    defaultCosmetics: { ...none, wristband: 'bant', wristbandColor: '#3a86ff', hat: 'kep', hatColor: '#3a86ff', beard: 'keci' },
  },
  {
    id: 'sihirbaz', name: 'Sihirbaz Pofuduk', emoji: '🎩',
    bodyColor: '#f8f9fa', bellyColor: '#ffffff', earType: 'uzun', snout: 'burun',
    bodyScale: [0.9, 1], hasTail: true, voicePitch: 340,
    defaultCosmetics: { ...none, hat: 'silindir', hatColor: '#111111', necklace: 'papyon', necklaceColor: '#d90429', top: 'pelerin', topColor: '#111111' },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

// ---- Karakter XP (saf fonksiyonlar) ----

/** Yarış başına kazanılan XP: katılım 20 + sıra bonusu */
export function xpForRace(rank, playerCount) {
  const base = 20;
  const bonus = Math.max(0, (playerCount - rank + 1) * 6);
  return base + bonus;
}

/** Seviye eşiği: her seviye bir öncekinden %25 daha fazla XP ister */
export function levelForXp(xp) {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need && level < 50) {
    acc += need;
    need = Math.round(need * 1.25);
    level += 1;
  }
  return level;
}

/** Yüksek seviye görsel gösterge eşiği (parlama/hale) */
export const GLOW_LEVEL = 5;
