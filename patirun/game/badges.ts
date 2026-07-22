// Rozet/başarım sistemi — tanımlar + kazanım değerlendirmesi (saf, testli).

export interface BadgeDef {
  id: string;
  isim: string;
  aciklama: string;
  emoji: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'ilk-yaris', isim: 'İlk Adım', aciklama: 'İlk yarışını tamamladın', emoji: '🐣' },
  { id: 'ilk-galibiyet', isim: 'İlk Zafer', aciklama: 'İlk yarışını kazandın', emoji: '🥇' },
  { id: 'ilk-yildirim', isim: 'Zeus Çırağı', aciklama: 'İlk yıldırım isabetin', emoji: '⚡' },
  { id: 'uc-ust-uste', isim: 'Seri Katil (Yarış Versiyonu)', aciklama: '3 yarış üst üste kazandın', emoji: '🔥' },
  { id: 'sondan-birinci', isim: 'Küllerinden Doğan', aciklama: 'Son sıradayken yarışı kazandın', emoji: '🐦‍🔥' },
  { id: 'altin-gordun', isim: 'Altına Dokunan', aciklama: 'Altın skill gördün (çok nadir!)', emoji: '👑' },
  { id: 'kalkan-ustasi', isim: 'Duvar', aciklama: 'Tek yarışta kalkanla 3 saldırı savuşturdun', emoji: '🛡️' },
  { id: 'skill-avcisi', isim: 'Keskin Nişancı', aciklama: 'Tek yarışta 5 skill isabet ettirdin', emoji: '🎯' },
  { id: 'sansiz', isim: 'Kara Bulut', aciklama: 'Tek yarışta 5 skill yedin (üzgünüz)', emoji: '☔' },
  { id: 'on-yaris', isim: 'Müdavim', aciklama: '10 yarış tamamladın', emoji: '🎪' },
  { id: 'elli-yaris', isim: 'Pist Kurdu', aciklama: '50 yarış tamamladın', emoji: '🏟️' },
  { id: 'yuz-yaris', isim: 'Efsane Yolcu', aciklama: '100 yarış tamamladın', emoji: '💯' },
  { id: 'kisayolcu', isim: 'Gizli Geçit Kaşifi', aciklama: 'Gizli kısayolu keşfettin', emoji: '🗝️' },
  { id: 'gece-kusu', isim: 'Gece Kuşu', aciklama: 'Gece haritasında yarış kazandın', emoji: '🦉' },
  { id: 'tum-haritalar', isim: 'Dünya Turu', aciklama: 'Tüm haritalarda yarıştın', emoji: '🗺️' },
];

export function getBadge(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Rozet değerlendirme bağlamı: yarış sonu + oyuncu geçmişi */
export interface BadgeContext {
  /** Bu yarıştaki bitirme sırası (1 tabanlı) */
  rank: number;
  playerCount: number;
  /** Yarış sırasında herhangi bir anda son sırada mıydı */
  wasLastAtSomePoint: boolean;
  /** Bu yarışta isabet ettirilen skill sayısı */
  skillHits: number;
  /** Bu yarışta yenen skill sayısı */
  skillsTaken: number;
  /** Bu yarışta kalkanla bloklanan saldırı sayısı */
  shieldBlocks: number;
  /** Bu yarışta yıldırım isabeti var mı */
  lightningHit: boolean;
  /** Bu maçta altın skill görüldü mü */
  goldenSeen: boolean;
  /** Kısayol şeridinden geçti mi */
  usedShortcut: boolean;
  /** Gece haritası mıydı */
  night: boolean;
  /** Toplam yarış sayısı (bu yarış dahil) */
  totalRaces: number;
  /** Üst üste galibiyet (bu yarış dahil) */
  winStreak: number;
  /** Yarışılan farklı harita sayısı (bu yarış dahil) */
  distinctMaps: number;
  /** Daha önce kazanılmış rozetler */
  owned: Set<string>;
}

/** Yarış sonunda yeni kazanılan rozetleri döner. */
export function evaluateBadges(ctx: BadgeContext): string[] {
  const earned: string[] = [];
  const tryAdd = (id: string, condition: boolean) => {
    if (condition && !ctx.owned.has(id)) earned.push(id);
  };

  const won = ctx.rank === 1 && ctx.playerCount > 1;

  tryAdd('ilk-yaris', ctx.totalRaces >= 1);
  tryAdd('ilk-galibiyet', won);
  tryAdd('ilk-yildirim', ctx.lightningHit);
  tryAdd('uc-ust-uste', ctx.winStreak >= 3);
  tryAdd('sondan-birinci', won && ctx.wasLastAtSomePoint);
  tryAdd('altin-gordun', ctx.goldenSeen);
  tryAdd('kalkan-ustasi', ctx.shieldBlocks >= 3);
  tryAdd('skill-avcisi', ctx.skillHits >= 5);
  tryAdd('sansiz', ctx.skillsTaken >= 5);
  tryAdd('on-yaris', ctx.totalRaces >= 10);
  tryAdd('elli-yaris', ctx.totalRaces >= 50);
  tryAdd('yuz-yaris', ctx.totalRaces >= 100);
  tryAdd('kisayolcu', ctx.usedShortcut);
  tryAdd('gece-kusu', won && ctx.night);
  tryAdd('tum-haritalar', ctx.distinctMaps >= 4);

  return earned;
}

// ---- Rütbe çerçeveleri ----
export const RANK_FRAMES: Record<string, string> = {
  'Çaylak': 'frame-caylak',
  'Amatör': 'frame-amator',
  'Yarı Profesyonel': 'frame-yari-pro',
  'Profesyonel': 'frame-pro',
  'Şampiyon': 'frame-sampiyon',
  'Efsane': 'frame-efsane',
};
