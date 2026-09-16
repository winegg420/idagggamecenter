import { tt } from "./dil.js";
// Kategori unvanları (Paket 14, 4.10): oyuncunun en güçlü kategorisinden
// türetilir (sunucu: oyuncu_unvani). Anahtar kategori, değer Türkçe unvan;
// İngilizce karşılıklar bildim/lib/dil.js sözlüğünde.

export const UNVANLAR = {
  genel_kultur: tt("Bilgin"),
  bilim: tt("Bilim Kurdu"),
  tarih: tt("Tarihçi"),
  cografya: tt("Kâşif"),
  edebiyat: tt("Kitap Kurdu"),
  spor: tt("Sporsever"),
  sanat: tt("Sanatsever"),
  sinema: tt("Sinemasever"),
  muzik: tt("Müziksever"),
  teknoloji: tt("Teknoloji Dahisi"),
};

export function unvanAdi(kategori) {
  return kategori ? UNVANLAR[kategori] ?? null : null;
}
