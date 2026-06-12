// SQL tarafındaki public.rutbe() ile aynı eşikler
export const RUTBELER = [
  { ad: "Çaylak", min: 0, renk: "#9aa0b5", ikon: "🐣" },
  { ad: "Bilge", min: 100, renk: "#4ade80", ikon: "🦉" },
  { ad: "Üstat", min: 500, renk: "#38bdf8", ikon: "⚔️" },
  { ad: "Kahin", min: 1500, renk: "#c084fc", ikon: "🔮" },
  { ad: "Efsane", min: 5000, renk: "#fbbf24", ikon: "👑" },
];

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
