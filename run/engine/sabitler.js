// ============================================================
// RUN — sabitler (PatiRun constants deseni). Prototip: tek-oyunculu + bot,
// tek harita (Ofis), tek drone. Ağ katmanı sonra.
// ============================================================

export const DUNYA = { genislik: 1800, yukseklik: 1200 };

// Oyuncu
export const OYUNCU_HIZ = 168;        // birim/sn (bir tık yavaşlatıldı)
export const OYUNCU_YARICAP = 15;

// Sınırlı görüş (fener) — tasarım 5
export const GORUS_YARICAP = 120;     // oyuncu çevresi yumuşak ışık
export const FENER_UZUNLUK = 340;     // ileri fener konisi menzili
export const FENER_ACI = Math.PI * 0.22; // koni yarı açısı (~40°)

// Işık/karanlık değişimi (tasarım 5) — aydınlık odalar periyodik değişir
export const ISIK_DEGISIM_ARALIK = 12; // sn

// Döngü
export const MAKS_DT = 0.05;

// Kadro (prototip)
export const BOT_SAYISI = 7;
export const BOT_HIZ = 140;
export const BOT_GRUP_MENZIL = 320;   // bu mesafeden uzaklaşırsa oyuncuya yaklaşır (görünür kalsın)

// Drone sayısı (birden fazla devriye — tasarım 7)
export const DRONE_SAYISI = 3;

// Drone (avcı) — tasarım 7. Prototipte tek drone, temas ile yakalar.
export const DRONE_DEVRIYE_HIZ = 122;
export const DRONE_KOVALA_HIZ = 196;      // aydınlıkta/kovalarken hızlanır
export const DRONE_GORUS = 300;           // aydınlıktaki oyuncuyu bu menzilde görür (GPS)
export const HEAT_YARICAP = 160;          // karanlıkta hareketsiz "ısı" algılama menzili
export const HEAT_SURE = 1.4;             // bu kadar hareketsiz kalınca ısı yakalanır
export const YAKALA_YARICAP = 30;         // bu mesafede yakalar
export const KAYIP_SURE = 3.5;            // hedefi kaybedince devriyeye dönme süresi
