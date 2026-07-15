// ============================================================
// KAFA TOPU — lig/rütbe sistemi.
// Lig, ELO puanından türetilir (ayrı bir durum tutulmaz; terfi/düşme
// otomatik olur). ELO'nun kendisi sunucuda hesaplanır (kafatopu_sonuc_kaydet).
// ============================================================

export const LIGLER = [
  { id: "bronz",  ad: "Bronz",  min: 0,    ikon: "🥉", renk: "#cd7f32" },
  { id: "gumus",  ad: "Gümüş",  min: 1100, ikon: "🥈", renk: "#b8c4cf" },
  { id: "altin",  ad: "Altın",  min: 1250, ikon: "🥇", renk: "#f2c522" },
  { id: "platin", ad: "Platin", min: 1450, ikon: "💠", renk: "#4fd8d2" },
  { id: "elmas",  ad: "Elmas",  min: 1700, ikon: "💎", renk: "#7ab8ff" },
];

// Puandan lig kaydı döndürür.
export function ligBul(puan) {
  let sonuc = LIGLER[0];
  for (const l of LIGLER) if (puan >= l.min) sonuc = l;
  return sonuc;
}

// Bir sonraki lige kalan puan (Elmas'ta null).
export function sonrakiLig(puan) {
  const simdiki = ligBul(puan);
  const i = LIGLER.findIndex((l) => l.id === simdiki.id);
  return i < LIGLER.length - 1 ? LIGLER[i + 1] : null;
}
