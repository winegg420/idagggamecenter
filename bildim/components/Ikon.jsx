// Bildim ikon seti — tamamı inline SVG (dış bağımlılık yok).
// Emoji yerine kullanılır: her cihazda aynı görünür, renk devralır (currentColor).

const YOLLAR = {
  ev: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  kupa:
    "M7 4h10v3a5 5 0 0 1-10 0zM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4M9 21h6M12 12v9",
  kilic: "M4 20l6-6M14 10l6-6V2h-2l-6 6M4 20h4v-4M14 10l-4-4",
  oyunKolu:
    "M7 12h4M9 10v4M16 11h.01M18.5 13h.01M4 8h16a2 2 0 0 1 2 2v6a3 3 0 0 1-5.2 2L15 16H9l-1.8 2A3 3 0 0 1 2 16v-6a2 2 0 0 1 2-2z",
  grafik: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  kisiler:
    "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  yildiz:
    "m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9z",
  zil: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0",
  sehir:
    "M3 21h18M5 21V8l5-3v16M14 21V11h5v10M8 11h.01M8 14h.01M8 17h.01M16.5 14h.01M16.5 17h.01",
  dunya:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18",
  bayrak: "M4 21V4M4 5h11l-1.5 3L15 11H4",
  saat: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  ates: "M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-3 1.5-3 5 0-2-2-3-2-3S8 9 8 11c0-1-2-1.5-2-1.5C6 12 5 13 5 15a7 7 0 0 0 7 7z",
  kalkan: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z",
  hizli: "m13 2-9 12h7l-1 8 9-12h-7z",
  kilit: "M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4",
  onay: "m5 13 4 4L19 7",
  carpi: "M6 6l12 12M18 6 6 18",
  ok: "M5 12h14M13 6l6 6-6 6",
  paylas:
    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  soru: "M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4M12 18h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
};

/**
 * <Ikon ad="kupa" boyut={20} />
 * Renk currentColor'dan gelir; dolgu yok, çizgi tabanlı (oyun arayüzünde net durur).
 */
export default function Ikon({ ad, boyut = 20, kalinlik = 1.9, className = "" }) {
  const d = YOLLAR[ad];
  if (!d) return null;
  return (
    <svg
      className={`bd-ikon ${className}`}
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={kalinlik}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d.split("M").filter(Boolean).map((p, i) => (
        <path key={i} d={"M" + p} />
      ))}
    </svg>
  );
}
