// Kategori unvanları (Paket 14, 4.10): oyuncunun en güçlü kategorisinden
// türetilir (sunucu: oyuncu_unvani). Anahtar kategori, değer Türkçe unvan;
// İngilizce karşılıklar bildim/lib/dil.js sözlüğünde.

export const UNVANLAR = {
  genel_kultur: "Bilgin",
  bilim: "Bilim Kurdu",
  tarih: "Tarihçi",
  cografya: "Kâşif",
  edebiyat: "Kitap Kurdu",
  spor: "Sporsever",
  sanat: "Sanatsever",
  sinema: "Sinemasever",
  muzik: "Müziksever",
  teknoloji: "Teknoloji Dahisi",
};

export function unvanAdi(kategori) {
  return kategori ? UNVANLAR[kategori] ?? null : null;
}
