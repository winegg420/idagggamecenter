// Oyuncu görünen adı yardımcıları.
//
// Takma ad seçmemiş herkesin görünen adı sunucuda "Oyuncu" oluyor; aynı ekranda
// birden fazla "Oyuncu" yan yana gelince kim kim belli olmuyordu. Bu durumda
// kullanıcı kimliğinin son 4 hanesiyle ayırt edici bir etiket üretilir.

const VARSAYILAN = "Oyuncu";

/**
 * @param {{gorunen_ad?: string|null, id?: string|null}|null} profil
 * @param {string|null} yedekId  profil.id yoksa kullanılacak kimlik
 * @returns {string} ör. "BilgeKartal" veya "Oyuncu #4f2a"
 */
export function oyuncuAdi(profil, yedekId = null) {
  const ad = (profil?.gorunen_ad ?? "").trim();
  const id = profil?.id ?? yedekId ?? null;

  if (!ad) return id ? `${VARSAYILAN} #${kisaKimlik(id)}` : VARSAYILAN;
  if (ad === VARSAYILAN && id) return `${VARSAYILAN} #${kisaKimlik(id)}`;
  return ad;
}

/** uuid'in son 4 hanesi — kısa ve yeterince ayırt edici. */
export function kisaKimlik(id) {
  const s = String(id ?? "").replace(/-/g, "");
  return s.slice(-4) || "????";
}
