// ============================================================
// KAFA TOPU — denge/fizik sabitleri (tek kaynak).
// Tüm değerler mantıksal saha birimindedir; render tarafı ölçekler.
// ============================================================

// Saha (mantıksal koordinatlar)
export const SAHA = {
  W: 1000,
  H: 560,
  ZEMIN_Y: 520,      // zemin üst yüzeyi
};

// Kaleler: iki yanda, zeminden yukarı açıklık + üst direk
export const KALE = {
  ACIKLIK: 185,      // kale ağzı yüksekliği (zeminden üst direğin altına)
  DERINLIK: 62,      // kale çizgisinden dışa doğru derinlik
  DIREK: 12,         // üst direk kalınlığı
};

// Fizik
export const FIZIK = {
  YERCEKIMI: 1.35,
  TICK_MS: 1000 / 60,          // sabit adım 60Hz
};

// Oyuncu (kafa)
export const OYUNCU = {
  KAFA_R: 44,
  HIZ: 6.1,                     // yatay hız (birim/tick)
  ZIPLAMA: 15.2,                // zıplama ilk hızı
  VURUS_MENZIL: 96,             // ayak vuruşu menzili (merkezden)
  VURUS_X: 12.5,                // vuruşun topa verdiği yatay hız
  VURUS_Y: 8.5,                 // vuruşun topa verdiği dikey hız (yukarı)
  VURUS_BEKLEME_MS: 340,        // iki vuruş arası bekleme
};

// Top
export const TOP = {
  R: 22,
  SEKME: 0.82,                  // restitution
  HAVA_SURTUNME: 0.008,
  YOGUNLUK: 0.0009,
  MAX_HIZ: 26,                  // patlamayı önlemek için hız tavanı
};

// Maç akışı
export const MAC = {
  SURE_SN: 120,                 // maç süresi (2 dakika)
  GOL_BEKLE_MS: 1600,           // gol sonrası bekleme/reset
  BASLANGIC_GERI_SAYIM_SN: 3,
  RAKIP_KOPMA_SN: 12,           // rakip bu kadar sn yoksa maçı bitirme hakkı doğar
};

// Rastgele düşen güç-yükseltmeler
export const GUC = {
  ARALIK_MIN_MS: 10000,         // iki güç arası min bekleme
  ARALIK_MAX_MS: 16000,
  ETKI_MS: 6000,                // etki süresi
  R: 20,                        // toplanma yarıçapı (ikon)
  DUSME_HIZ: 1.6,               // birim/tick
  YERDE_KALMA_MS: 5000,         // yere inince bu süre sonra kaybolur
};

// Karaktere özel yetenekler
export const YETENEK = {
  BEKLEME_MS: 15000,            // ortak soğuma süresi
  ATES_SUTU_MS: 6000,           // sonraki vuruşlar 1.9x (süre penceresi)
  ATES_CARPAN: 1.9,
  BUZ_MS: 3000,                 // rakip %50 yavaş
  BUZ_CARPAN: 0.5,
  KALKAN_MS: 2500,              // kendi kalesinin ağzında bariyer
  DEV_KAFA_MS: 5000,            // kafa 1.6x
  DEV_KAFA_OLCEK: 1.6,
};

// Ağ (host-otoriter model)
export const AG = {
  DURUM_HZ_MS: 50,              // host durum yayını 20Hz
  GIRDI_HZ_MS: 50,              // misafir girdi yayını 20Hz
  INTERP_GECIKME_MS: 100,       // misafir render gecikmesi (yumuşatma)
  BAGLANTI_BEKLE_SN: 25,        // lobi: herkes bu sürede gelmezse iptal hakkı
};
