// Rütbe renkleri rozet/dolgu için seçilmiş açık tonlar; YAZI olarak açık
// zeminde okunmuyorlardı (ölçüm: Üstat #4A9DD9 → 2.95, Bilge #2FBF71 → 2.38).
// Rütbe kimliği korunsun diye renk aynı kalır; metin için rengin metin
// rengiyle yarı yarıya karışımı kullanılır. Açık temada koyulaşır (≥ 4.6),
// koyu temada açılır (≥ 8.0) — tek tanım iki temada da doğru.
const metinRengi = (renk) => `color-mix(in srgb, ${renk} 50%, var(--bd-metin))`;

// SQL tarafındaki public.rutbe() ile aynı eşikler
export const RUTBELER = [
  { ad: "Çaylak", min: 0, renk: "#8496B2", ikon: "kisi" },
  { ad: "Bilge", min: 100, renk: "#2FBF71", ikon: "kalkan" },
  { ad: "Üstat", min: 500, renk: "#4A9DD9", ikon: "kilic" },
  { ad: "Kahin", min: 1500, renk: "#3FA9A0", ikon: "yildiz" },
  { ad: "Efsane", min: 5000, renk: "#F2B23C", ikon: "kupa" },
].map((r) => ({ ...r, metinRenk: metinRengi(r.renk) }));

export function rutbeBul(puan) {
  let r = RUTBELER[0];
  for (const rt of RUTBELER) {
    if (puan >= rt.min) r = rt;
  }
  return r;
}

export function sonrakiRutbe(puan) {
  return RUTBELER.find((r) => r.min > puan) ?? null;
}
