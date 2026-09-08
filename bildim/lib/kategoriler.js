// Kategori etiketleri ve ikonları (tek kaynak).
// 'genel' kategorisine dokunulmadı; "Genel Kültür" ayrı bir anahtardır
// ve listede her zaman en üstte gelir (sunucudaki get_categories da öyle sıralar).

export const KATEGORI_BILGI = {
  genel_kultur: { ad: "Genel Kültür", ikon: "🧠" },
  genel: { ad: "Genel", ikon: "🎲" },
  bilim: { ad: "Bilim", ikon: "🔬" },
  tarih: { ad: "Tarih", ikon: "🏛️" },
  cografya: { ad: "Coğrafya", ikon: "🌍" },
  edebiyat: { ad: "Edebiyat", ikon: "📚" },
  spor: { ad: "Spor", ikon: "⚽" },
  sanat: { ad: "Sanat", ikon: "🎨" },
  sinema: { ad: "Sinema", ikon: "🎬" },
  muzik: { ad: "Müzik", ikon: "🎵" },
  teknoloji: { ad: "Teknoloji", ikon: "💻" },
  karisik: { ad: "Karışık", ikon: "🎯" },
};

export function kategoriAdi(anahtar) {
  return KATEGORI_BILGI[anahtar]?.ad ?? anahtar;
}

export function kategoriIkon(anahtar) {
  return KATEGORI_BILGI[anahtar]?.ikon ?? "❓";
}

export function kategoriEtiket(anahtar) {
  const b = KATEGORI_BILGI[anahtar];
  return b ? `${b.ikon} ${b.ad}` : anahtar;
}

// Genel Kültür her zaman başta; gerisi sunucudan gelen sırayı korur.
export function kategorileriSirala(liste) {
  return [...(liste ?? [])].sort((a, b) => {
    if (a.kategori === "genel_kultur") return -1;
    if (b.kategori === "genel_kultur") return 1;
    return 0;
  });
}
