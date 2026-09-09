// Kategori etiketleri (tek kaynak). İkonlar KategoriIkon.jsx içinde SVG.
// 'genel' kategorisine dokunulmadı; "Genel Kültür" ayrı bir anahtardır
// ve listede her zaman en üstte gelir (sunucudaki get_categories da öyle sıralar).

export const KATEGORI_BILGI = {
  genel_kultur: { ad: "Genel Kültür" },
  genel: { ad: "Genel" },
  bilim: { ad: "Bilim" },
  tarih: { ad: "Tarih" },
  cografya: { ad: "Coğrafya" },
  edebiyat: { ad: "Edebiyat" },
  spor: { ad: "Spor" },
  sanat: { ad: "Sanat" },
  sinema: { ad: "Sinema" },
  muzik: { ad: "Müzik" },
  teknoloji: { ad: "Teknoloji" },
  karisik: { ad: "Karışık" },
};

export function kategoriAdi(anahtar) {
  return KATEGORI_BILGI[anahtar]?.ad ?? anahtar;
}

// Emoji ikonlar kaldırıldı; görsel karşılık <KategoriIkon anahtar=... /> ile
// çizilir (bildim/components/KategoriIkon.jsx).
export function kategoriIkon() {
  return "";
}

// Etiket artık yalnız ad (emoji önek yok).
export function kategoriEtiket(anahtar) {
  return kategoriAdi(anahtar);
}

// Genel Kültür her zaman başta; gerisi sunucudan gelen sırayı korur.
export function kategorileriSirala(liste) {
  return [...(liste ?? [])].sort((a, b) => {
    if (a.kategori === "genel_kultur") return -1;
    if (b.kategori === "genel_kultur") return 1;
    return 0;
  });
}
