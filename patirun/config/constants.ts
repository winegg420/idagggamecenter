// Oyun geneli sabitler — tüm denge ayarları buradan yapılır.

export const PHYSICS = {
  /** Taban ileri koşu hızı (birim/sn). Pist ~900 birim => ~67 sn yarış (tür temposu). */
  BASE_SPEED: 13.5,
  /** Hız skill'i çarpanı */
  BOOST_MULTIPLIER: 1.6,
  /** Hız skill'i süresi (sn) */
  BOOST_DURATION: 2.5,
  /** Yanal hareket hızı (birim/sn) */
  LATERAL_SPEED: 7,
  /** Pist yarı genişliği (yanal sınır) */
  TRACK_HALF_WIDTH: 4,
  /** Zıplama ilk dikey hızı (kısa-çevik ark: tür hissi) */
  JUMP_VELOCITY: 9.2,
  /** Yerçekimi (birim/sn²) — sert iniş, zıplama havada asılı kalmasın */
  GRAVITY: -26,
  /** Jump pad dikey hızı */
  JUMP_PAD_VELOCITY: 14.5,
  /** Sabit pist engeli çarpması yavaşlama çarpanı */
  OBSTACLE_SLOW_MULTIPLIER: 0.35,
  /** Sabit pist engeli yavaşlatma süresi (sn) */
  OBSTACLE_SLOW_DURATION: 1.2,
  /** Kapan (skill): basan koşucu bu süre kapana kısılıp kilitlenir (bear trap) */
  TRAP_HOLD_DURATION: 1.4,
  /** "Ölüm/doğum" dokunulmazlığı: ağır CC (yıldırım/kapan) sonrası bu süre
      hiçbir saldırı etki etmez (zincir kilitlenme önlenir) */
  INVULN_DURATION: 2,
  /** Yıldırım sersemletme süresi (sn) */
  LIGHTNING_STUN_DURATION: 1.5,
  /** Yıldırım sonrası yavaşlık süresi (sn) */
  LIGHTNING_SLOW_DURATION: 1.0,
  /** Geri fırlatma mesafesi (birim, s ekseninde) */
  KNOCKBACK_DISTANCE: 18,
  /** Mıknatıs çekme mesafesi (öndeki rakipler bu kadar geri çekilir) */
  MAGNET_PULL: 12,
  /** Kalkan koruma süresi (sn) */
  SHIELD_DURATION: 4,
  /** Altın skill donma süresi (sn) */
  GOLDEN_FREEZE_DURATION: 2,
  /** Slipstream hız bonusu (0.04 = %4) */
  SLIPSTREAM_BONUS: 0.04,
  /** Slipstream mesafesi (öndekine bu kadar yakınsa aktif) */
  SLIPSTREAM_RANGE: 10,
  /** Slipstream pistin bu oranından SONRA devre dışı — son düzlük dürüst */
  SLIPSTREAM_CUTOFF_FRAC: 0.85,
  /** Gizli kısayol şeridi hız çarpanı (~1 sn kazandırır, belirleyici değil) */
  SHORTCUT_MULTIPLIER: 1.3,
  /** Hızlı iniş dikey hızı (havada eğil: platformdan alt yola in) */
  FAST_FALL_VELOCITY: 14,
  /** Üst yol platform yüksekliği (birim) */
  PLATFORM_Y: 2.2,
  /** Su bölümünde yüzme hız çarpanı */
  WATER_SPEED_FACTOR: 0.88,
  /** Su derinliği (birim) — DERİN su: dipte skill kutuları var */
  WATER_DEPTH: 4.2,
  /** EĞİL basışı başına dalış itkisi (spam = hızlı iniş) */
  SWIM_DIVE_IMPULSE: 4.4,
  /** ZIPLA basışı başına yükselme itkisi (spam = hızlı çıkış) */
  SWIM_RISE_IMPULSE: 5.0,
  /** Su içi azami dikey hız */
  SWIM_MAX_VY: 9,
  /** Yüzeyi bu dikey hızla kesersen YUNUS gibi sudan fırlarsın */
  SWIM_LEAP_MIN_VY: 5.5,
  /** Su kaldırma kuvveti (pasif yüzeye süzülme, birim/sn²) */
  WATER_BUOYANCY: 1.6,
  /** Su sürtünmesi (dikey hız sönümü, 1/sn) */
  SWIM_DAMPING: 2.0,
  /** Sudan çıkışta (bölüm bitti, hâlâ dipte) kıyıya tırmanma hızı */
  WATER_VERTICAL_SPEED: 7.2,
  /** KARA YÜKSELTİSİ (Fun Run yükseklik geçişi): yamaca ZIPLA spam'iyle
      KOLAYCA tırmanılır ve yükseltilmiş zeminde KOŞMAYA DEVAM edilir.
      Yüksek (ekranın yarısı) — belirgin bir "yukarı çıktım" hissi. */
  CLIFF_HEIGHT: 6.5,
  /** Yükseltilmiş zemin uzunluğu (birim) — üstünde bir süre koşulur, sonunda
      kenardan aşağı düşülür */
  CLIFF_LENGTH: 74,
  /** Tırmanış: ZIPLA'ya her basışta bu dikey hız (spam = düzgün yukarı akış) */
  CLIMB_STEP: 6.2,
  /** Basmadığın karelerde yumuşak sarkma ivmesi (tutunma hissi, düşmezsin) */
  CLIMB_SLIDE: 8,
  /** Sarkarken azami aşağı hız (basmayı bıraksan da yavaş iner, baştan başlamazsın) */
  CLIMB_MAX_SLIDE: 2.2,
} as const;

export const RACE = {
  /** Maks oyuncu sayısı (aynı anda yarışan) */
  MAX_PLAYERS: 6,
  /** Yarış süre limiti (sn) — süre dolunca bitmemiş olanlar DNF sıralanır */
  TIME_LIMIT: 120,
  /** Hedef yarış süresi aralığı (bilgi amaçlı) */
  TARGET_DURATION: [60, 90],
  /** AFK: bu kadar sn girdi yoksa karakter donar */
  AFK_FREEZE_SECONDS: 15,
  /** AFK: bu kadar sn girdi yoksa diskalifiye */
  AFK_DISQUALIFY_SECONDS: 30,
  /** F1 start ışığı sayısı */
  START_LIGHTS: 5,
  /** Işıklar arası süre (sn) */
  START_LIGHT_INTERVAL: 0.8,
} as const;

export const NETWORK = {
  /** Pozisyon yayını: oyuncu başına saniyede maks mesaj */
  POSITION_SEND_RATE: 10,
  /** Entity interpolation gecikme tamponu (ms) */
  INTERP_DELAY_MS: 150,
  /** Reconciliation yumuşatma katsayısı */
  RECONCILE_LERP: 0.15,
} as const;

export const SCORING = {
  /** Bilgi amaçlı: puan formülü 100*(n-r+1)/n — 6 kişide 100/83/67/50/33/17 */
  POINTS_BY_RANK_5: [100, 80, 60, 40, 20],
  /** Günlük ilk yarış bonusu */
  DAILY_FIRST_RACE_BONUS: 25,
} as const;

export const RANKS = [
  { name: 'Çaylak', min: 0 },
  { name: 'Amatör', min: 500 },
  { name: 'Yarı Profesyonel', min: 1500 },
  { name: 'Profesyonel', min: 3500 },
  { name: 'Şampiyon', min: 7000 },
  { name: 'Efsane', min: 15000 },
] as const;

export const SKILLS = {
  /** Skill kutusu yeniden doğma süresi aralığı (sn) — kısa: aksiyon sürekli */
  BOX_RESPAWN_RANGE: [2.5, 6],
  /** Altın skill temel olasılığı (çok nadir — her maçta çıkmamalı) */
  GOLDEN_BASE_CHANCE: 0.004,
  /** Catch-up: sondaki oyuncu için güçlü skill ağırlık artışı */
  CATCHUP_MAX_BONUS: 0.35,
} as const;

export const SECRETS = {
  /** Gizli kısayolun bir maçta açık olma olasılığı */
  SHORTCUT_CHANCE: 0.12,
  /** Gizli haritanın açılması için gereken toplam yarış */
  HIDDEN_MAP_RACES: 50,
} as const;
