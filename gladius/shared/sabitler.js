// ============================================================
// Gladius geneli sabitler. Oyun mantığına ve arayüze ortak değerler.
// Denge/sayısal değerler ilerideki fazlarda buraya toplanacak.
// ============================================================

// Gladius'un ana proje içindeki taban yolu (Bildim App.jsx'e eklenen rota).
export const GL_TABAN = "/gladius";

// Oyun modları.
export const MODLAR = {
  BATTLE_ROYALE: "battle_royale",
  DEATHMATCH: "deathmatch",
};

export const MOD_ADLARI = {
  [MODLAR.BATTLE_ROYALE]: "Battle Royale Modu",
  [MODLAR.DEATHMATCH]: "Deathmatch",
};

// Oda kapasitesi (tasarım Bölüm 3 / 3.8).
export const MIN_OYUNCU = 4;
export const MAX_OYUNCU = 10;

// Veritabanı tablo öneki (tasarım: gl_).
export const TABLO_ONEKI = "gl_";
