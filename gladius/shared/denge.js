// ============================================================
// Gladius denge/oyun sabitleri (PatiRun constants.ts karşılığı).
// Tüm sayısal denge değerleri tek yerde; ilerideki fazlarda buradan yönetilir.
// Değerler tasarım GLADIUS_TASARIM.md'den; test edilerek ince ayar yapılacak.
// ============================================================

// --- Arena (dünya koordinatları, birim = px) ---
export const ARENA_YARICAP = 900;       // yuvarlak arena yarıçapı
export const ARENA_MERKEZ = { x: 0, y: 0 };

// --- Oyuncu ---
export const OYUNCU_YARICAP = 24;
export const OYUNCU_HIZ = 300;           // birim/sn
export const CAN_MAX = 100;              // tasarım 3.1: can havuzu 100
export const VURUS_HASAR = 15;           // tasarım 3.1: bir vuruş 15 (~7 vuruşta ölüm)
export const HIZLANDIRMA_CARPAN = 1.6;   // hızlandırma itemi (tasarım 3.1)
export const HIZLANDIRMA_SURE = 5;       // saniye

// --- Itemler (tasarım 3.1) ---
export const ITEM_SPAWN_ARALIK = 5;      // sn — yeni item çıkma aralığı
export const ITEM_MAKS = 5;              // haritadaki eşzamanlı item üst sınırı
export const ITEM_TOPLAMA_MESAFE = 34;   // toplama yarıçapı
export const CAN_ITEM_MIKTAR = 30;       // can itemi iyileştirmesi (Deathmatch: 2 vuruş)
// Deathmatch zırh/güç itemleri (tasarım 3.8.1)
export const ZIRH_ITEM_SURE = 12;        // sn — gelen hasarı azaltan koruma
export const ZIRH_AZALT = 0.5;           // hasar ×0.5
export const GUC_ITEM_SURE = 8;          // sn — verilen hasarı artırır
export const GUC_CARPAN = 1.5;           // hasar ×1.5

// --- Botlar ---
export const BOT_HIZ = 250;
export const BOT_YON_DEGISIM_MIN = 0.7;  // sn — yeni yön seçme aralığı
export const BOT_YON_DEGISIM_MAX = 2.2;

// --- Kamera ---
// Tasarım 3.1: kamera "biraz uzaktan", ölçeği hissettirecek kadar geniş alan gösterir.
export const KAMERA_KENAR_PAYI = 1.18;   // arena + %18 kenar boşluğu görünür

// --- Dövüş (tasarım 3.1) ---
export const VURUS_MESAFE = 82;          // vuruş menzili (birim)
export const VURUS_ACI_TOLERANS = Math.PI * 0.30;  // ~54° açı toleransı
export const VURUS_COOLDOWN = 0.55;      // saniye
export const KALKAN_AZALT_MIN = 0.70;    // kalkan %70-80 arası hasar azaltır
export const KALKAN_AZALT_MAX = 0.80;
export const OLUM_BEKLE = 0.6;           // ölüm sonrası kısa bekleme (tasarım 3.6.1)

// --- Bot dövüş AI ---
export const BOT_ARAMA_MENZIL = 460;     // bu menzildeki en yakın hedefe yönelir
export const BOT_SALDIRI_CD_MIN = 0.7;
export const BOT_SALDIRI_CD_MAX = 1.6;

// --- Tehditler / fazlar (tasarım 3.3, 3.3.1, 3.1) ---
// Yerel antrenman için sıkıştırılmış zamanlama (canlıda tasarımdaki ~2-4 dk hedeflenecek).
export const MAYMUN_BASLA = 8;           // round başından kaç sn sonra Maymun İstilası
export const MAYMUN_SAYISI = 6;
export const MAYMUN_CAN = 22;
export const MAYMUN_HASAR = 4;
export const MAYMUN_HIZ = 205;
export const MAYMUN_VURUS_CD = 0.9;      // maymun vuruş aralığı
export const MAYMUN_HEDEF_DEGISIM = 3;   // 3 vuruştan sonra hedef değiştir (tasarım 3.3)

export const BOGA_BASLA_SONRA = 6;       // maymunlar bitince kaç sn sonra Boğa
export const BOGA_CAN = 140;
export const BOGA_HASAR = 16;
export const BOGA_SERSEM = 3;            // isabet → 3 sn sersemleme (tasarım 3.3.1)
export const BOGA_SARJ_HIZ = 540;
export const BOGA_YURU_HIZ = 120;
export const BOGA_VURUS_MESAFE = 70;
export const BOGA_YAKIN_CEZA_MESAFE = 55; // çok dibinde vurana ani ceza

// --- Zincirli Aslanlar (tasarım 3.1) ---
export const ASLAN_BASLA_SONRA = 6;      // boğa bitince kaç sn sonra aslanlar
export const ASLAN_SAYISI = 3;
export const ASLAN_CAN = 95;
export const ASLAN_HASAR = 14;
export const ASLAN_ATILMA_HIZ = 340;     // bölgeye giren oyuncuya hızlı atılma
export const ASLAN_DEVRIYE_HIZ = 85;
export const ASLAN_BOLGE_BASLANGIC = 230; // başlangıç zincir/bölge yarıçapı
export const ASLAN_BOLGE_BUYUME = 14;    // sn başına bölge büyümesi (alan daralması)
export const ASLAN_VURUS_CD = 1.1;
export const ASLAN_SURE_MAKS = 26;       // bu süre sonunda aslanlar bitmese de Ateş Çemberi

// --- Ateş Çemberi (tasarım 3.1) ---
export const ATES_DARALMA_BASLANGIC = 34; // birim/sn içeri daralma (artar)
export const ATES_DARALMA_ARTIS = 10;     // sn başına daralma hızı artışı
export const ATES_HASAR_BASLANGIC = 7;    // hp/sn (yanan bölgede)
export const ATES_HASAR_ARTIS = 5;        // sn başına hasar artışı

// --- Deathmatch ekstraları (tasarım 3.8.1) ---
export const ALTIN_DK_ARALIK_MIN = 22;   // Altın Dakika tetiklenme aralığı (sn)
export const ALTIN_DK_ARALIK_MAX = 40;
export const ALTIN_DK_SURE = 18;         // çift hasar süresi (~15-20 sn)
export const ALEV_ARALIK = 6.5;          // rastgele alev püskürmesi aralığı
export const ALEV_SURE = 3;              // alev aktif kalma süresi
export const ALEV_YARICAP = 75;
export const ALEV_HASAR = 9;             // hp/sn (alev üstünde)
export const KILL_STREAK_ESIK = 3;       // bu kadar elemede görsel efekt

// --- Başlangıç ---
export const HAZIR_SURE = 2.6;           // maç öncesi hazırlık/borazan/tema metni (sn)

// --- Döngü ---
export const MAKS_DT = 0.05;             // büyük sıçramaları engelle (sn)

// --- Kadro (yerel antrenman) ---
export const YEREL_BOT_SAYISI = 5;       // oyuncu + 5 bot = 6 kadro
