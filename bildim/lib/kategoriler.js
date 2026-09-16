import { tt } from "./dil.js";
// Kategori etiketleri (tek kaynak). İkonlar KategoriIkon.jsx içinde SVG.
// 'genel' kategorisine dokunulmadı; "Genel Kültür" ayrı bir anahtardır
// ve listede her zaman en üstte gelir (sunucudaki get_categories da öyle sıralar).

export const KATEGORI_BILGI = {
  genel_kultur: { ad: tt("Genel Kültür") },
  genel: { ad: tt("Genel") },
  bilim: { ad: tt("Bilim") },
  tarih: { ad: tt("Tarih") },
  cografya: { ad: tt("Coğrafya") },
  edebiyat: { ad: tt("Edebiyat") },
  spor: { ad: tt("Spor") },
  sanat: { ad: tt("Sanat") },
  sinema: { ad: tt("Sinema") },
  muzik: { ad: tt("Müzik") },
  teknoloji: { ad: tt("Teknoloji") },
  karisik: { ad: tt("Karışık") },
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
