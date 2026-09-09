// Bildim ikon seti — tamamı inline SVG (dış bağımlılık yok).
// Emoji YERİNE kullanılır: her cihazda aynı görünür, renk devralır (currentColor).
//
// Stil kuralı: 24px kutu, 2px kontur, yuvarlak uç/köşe, DOLGU YOK.
// Dolgu gereken tek yer kategori plakaları — o ayrı bileşende (KategoriIkon).

const YOLLAR = {
  // --- gezinme ---
  ev: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  kupa:
    "M7 4h10v3a5 5 0 0 1-10 0zM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4M9 21h6M12 12v9",
  kilic: "M4 20l6-6M14 10l6-6V2h-2l-6 6M4 20h4v-4M14 10l-4-4",
  oyunKolu:
    "M7 12h4M9 10v4M16 11h.01M18.5 13h.01M4 8h16a2 2 0 0 1 2 2v6a3 3 0 0 1-5.2 2L15 16H9l-1.8 2A3 3 0 0 1 2 16v-6a2 2 0 0 1 2-2z",
  grafik: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  kisiler:
    "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  kisi: "M19 21v-2a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  kisiEkle: "M15 21v-2a5 5 0 0 0-5-5H6a5 5 0 0 0-5 5v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8v6M21 11h-6",

  // --- durum / bildirim ---
  zil: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0",
  yildiz: "m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9z",
  ates: "M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-3 1.5-3 5 0-2-2-3-2-3S8 9 8 11c0-1-2-1.5-2-1.5C6 12 5 13 5 15a7 7 0 0 0 7 7z",
  kalkan: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z",
  madalya:
    "M8 2 6 8l6 3 6-3-2-6M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14v3M10.5 16h3",
  uyari: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01",

  // --- oyun / joker ---
  terazi: "M12 3v18M7 21h10M5 8h14M5 8 2 15h6zM19 8l-3 7h6zM12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  saat: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  ileriAtla: "M4 5l9 7-9 7zM19 5v14",
  hizli: "m13 2-9 12h7l-1 8 9-12h-7z",
  soru: "M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4M12 18h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  robot: "M5 9h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 6V3M9 14h.01M15 14h.01M9.5 17.5h5",
  sohbet: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z",

  // --- yer / dünya ---
  sehir:
    "M3 21h18M5 21V8l5-3v16M14 21V11h5v10M8 11h.01M8 14h.01M8 17h.01M16.5 14h.01M16.5 17h.01",
  dunya:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18",
  haritaPini: "M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12zM12 12.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6",
  bayrak: "M4 21V4M4 5h11l-1.5 3L15 11H4",

  // --- eylem ---
  kilit: "M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4",
  onay: "m5 13 4 4L19 7",
  carpi: "M6 6l12 12M18 6 6 18",
  ok: "M5 12h14M13 6l6 6-6 6",
  geri: "M19 12H5M11 6l-6 6 6 6",
  arti: "M12 5v14M5 12h14",
  yenile: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  cop: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6",
  paylas:
    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  ayar: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 15H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.9 4.4V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.2 1.1z",
  hediye: "M20 12v9H4v-9M2 8h20v4H2zM12 21V8M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8M12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8",
  sesAcik: "M11 5 6 9H2v6h4l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  sesKapali: "M11 5 6 9H2v6h4l5 4zM17 9l5 6M22 9l-5 6",
  liste: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  kalem: "M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  cikis: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  // Açık kitap — "Hatalarım" çalışma modu
  kitap: "M12 7v14M12 7C10.5 5.5 8.5 5 6 5H3v13h3c2.5 0 4.5.5 6 2M12 7c1.5-1.5 3.5-2 6-2h3v13h-3c-2.5 0-4.5.5-6 2",
};

/**
 * <Ikon ad="kupa" boyut={20} />
 * Renk currentColor'dan gelir; dolgu yok, çizgi tabanlı.
 */
export default function Ikon({ ad, boyut = 20, kalinlik = 2, className = "" }) {
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
      {/* Alt yollar büyük "M" komutundan ayrılır; komut harfi KORUNUR.
          (Eski hâli split("M") + "M" ekliyordu; küçük "m" ile başlayan
          yollar "Mm…" olup geçersizleşiyor ve hiç çizilmiyordu —
          yildiz, hizli ve onay ikonları bu yüzden görünmüyordu.) */}
      {d.split(/(?=M)/).filter(Boolean).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

export const IKON_ADLARI = Object.keys(YOLLAR);
