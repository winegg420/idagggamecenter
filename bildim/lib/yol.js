// ============================================================
// BİLDİM — YOL KÖKÜ
//
// Bildim iki farklı sitede yayınlanır:
//   1) idaGG Game Center (hub)  → quiz rotaları /bildim/* altındadır
//   2) Bildim'in kendi sitesi   → quiz rotaları KÖKTEDİR (/turnuva, /profil…)
//
// Fark yalnız derleme anındaki VITE_MOD değişkenidir. Bileşenlerin içine
// "/bildim/meydan" gibi sabit yol yazmak yerine y("/meydan") kullanılır;
// böylece tek bir kod tabanı iki siteyi de doğru linkler.
//
// Kullanım:
//   y()            → "/bildim"  (hub)   |  "/"        (bildim sitesi)
//   y("/meydan")   → "/bildim/meydan"   |  "/meydan"
//   y(`/mac/${id}`)→ "/bildim/mac/123"  |  "/mac/123"
// ============================================================

export const BILDIM_MOD = import.meta.env.VITE_MOD === "bildim";

// Hub'da önek var, kendi sitesinde yok.
export const KOK = BILDIM_MOD ? "" : "/bildim";

export function y(alt = "") {
  if (!alt) return KOK || "/";
  const parca = alt.startsWith("/") ? alt : "/" + alt;
  return KOK + parca;
}
