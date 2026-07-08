// ============================================================
// 15 özgün gladyatör (tasarım 3.2): 4 kadın (2 esmer, 2 beyaz/sarışın) + 11 erkek.
// Kuş bakışında en ayırt edici kısım saç ve zırh rengi (palet).
// PatiRun characters.ts deseninin Gladius/gladyatör uyarlaması.
// ============================================================

export const GLADYATORLER = [
  // --- 4 kadın ---
  { id: "aeliana", ad: "Aeliana", kadin: true, palet: { ten: "#8a5a38", sac: "#1a1410", zirh: "#b23b6e" } },   // esmer
  { id: "zenobia", ad: "Zenobia", kadin: true, palet: { ten: "#754a2c", sac: "#241a12", zirh: "#c99a2e" } },   // esmer
  { id: "valeria", ad: "Valeria", kadin: true, palet: { ten: "#f0c9a0", sac: "#e8dcc0", zirh: "#4a9e6a" } },   // beyaz/sarışın
  { id: "livia",   ad: "Livia",   kadin: true, palet: { ten: "#f2d1ab", sac: "#d8b24b", zirh: "#3a6ea5" } },   // beyaz/sarışın

  // --- 11 erkek ---
  { id: "maximus",   ad: "Maximus",   kadin: false, palet: { ten: "#e8b98f", sac: "#2b1d12", zirh: "#b23b2e" } },
  { id: "crixus",    ad: "Crixus",    kadin: false, palet: { ten: "#c98a5c", sac: "#12100e", zirh: "#3a6ea5" } },
  { id: "spartacus", ad: "Spartacus", kadin: false, palet: { ten: "#d6a074", sac: "#3a2414", zirh: "#c0c4cc" } },
  { id: "gannicus",  ad: "Gannicus",  kadin: false, palet: { ten: "#e5b488", sac: "#c9a24b", zirh: "#d0672e" } }, // sarışın
  { id: "varro",     ad: "Varro",     kadin: false, palet: { ten: "#caa070", sac: "#1a1712", zirh: "#4a9e6a" } },
  { id: "barca",     ad: "Barca",     kadin: false, palet: { ten: "#6e4428", sac: "#0f0d0b", zirh: "#8a4bb0" } }, // esmer
  { id: "ashur",     ad: "Ashur",     kadin: false, palet: { ten: "#a86b40", sac: "#17120d", zirh: "#7a6a2e" } },
  { id: "priscus",   ad: "Priscus",   kadin: false, palet: { ten: "#e0b48a", sac: "#5a3418", zirh: "#2e6ea5" } },
  { id: "flamma",    ad: "Flamma",    kadin: false, palet: { ten: "#b3784a", sac: "#100e0c", zirh: "#c0392e" } },
  { id: "tetraites", ad: "Tetraites", kadin: false, palet: { ten: "#d29a68", sac: "#2a1c12", zirh: "#7d8a3a" } },
  { id: "verus",     ad: "Verus",     kadin: false, palet: { ten: "#8f5a34", sac: "#14100c", zirh: "#b0902e" } }, // esmer
];

export function karakterBul(id) {
  return GLADYATORLER.find((k) => k.id === id) || GLADYATORLER[4]; // vars. Maximus
}
