import type { SkillId } from '../types';

export interface SkillInfo {
  id: SkillId;
  name: string;
  emoji: string;
  description: string;
  /** Dağılım ağırlığı (yüksek = sık çıkar). Altın skill ayrı hesaplanır. */
  weight: number;
  /** Güç kademesi: catch-up geride kalana yüksek kademeli skill ağırlığı ekler */
  tier: 1 | 2 | 3;
  /** TEK hedefli mi — true ise oyuncu hedefi seçebilir (basılı tut + kaydır) */
  targeted?: boolean;
}

export const SKILL_INFO: Record<SkillId, SkillInfo> = {
  boost: {
    id: 'boost',
    name: 'Hız Patlaması',
    emoji: '🚀',
    description: 'Kısa süreli sürat patlaması',
    weight: 20,
    tier: 1,
  },
  obstacle: {
    id: 'obstacle',
    name: 'Kapan',
    emoji: '🪤',
    description: 'Arkaya kapan bırakır, basan kısa süre yakalanır',
    weight: 18,
    tier: 1,
  },
  shield: {
    id: 'shield',
    name: 'Kalkan',
    emoji: '🛡️',
    description: 'Kısa süre gelen skill\'lerden korur',
    weight: 16,
    tier: 2,
  },
  knockback: {
    id: 'knockback',
    name: 'Geri Fırlatma',
    emoji: '💥',
    description: 'Seçtiğin rakibi geriye savurur (basılı tut + kaydır)',
    weight: 16,
    tier: 2,
    targeted: true,
  },
  lightning: {
    id: 'lightning',
    name: 'Yıldırım',
    emoji: '⚡',
    description: 'Öndeki rakibe yıldırım düşer, sersemletir',
    weight: 22,
    tier: 3,
  },
  miknatis: {
    id: 'miknatis',
    name: 'Mıknatıs',
    emoji: '🧲',
    description: 'Öndeki TÜM rakipleri geriye çeker',
    weight: 20,
    tier: 3,
  },
  golden: {
    id: 'golden',
    name: 'Altın Donduruş',
    emoji: '👑',
    description: 'Tüm rakipleri 2 saniye dondurur',
    weight: 0, // ağırlıkla dağıtılmaz — ayrı nadirlik zarı
    tier: 3,
  },
};
