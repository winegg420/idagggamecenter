// SQL tarafındaki public.rutbe() ile aynı eşikler
export const RUTBELER = [
  { ad: "Çaylak", min: 0, renk: "#8496B2", ikon: "kisi" },
  { ad: "Bilge", min: 100, renk: "#2FBF71", ikon: "kalkan" },
  { ad: "Üstat", min: 500, renk: "#4A9DD9", ikon: "kilic" },
  { ad: "Kahin", min: 1500, renk: "#3FA9A0", ikon: "yildiz" },
  { ad: "Efsane", min: 5000, renk: "#F2B23C", ikon: "kupa" },
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
