// Kategori ikonları — çizgi ikon setinden AYRI: bunlar dolgu SVG ve her biri
// kendi kategori renginde bir plakanın üstünde durur. Emoji yerine geçer.
//
// Kategori renkleri gece lacivert zeminde okunur olacak şekilde seçildi;
// hiçbiri mor değil.

export const KATEGORI_RENK = {
  genel_kultur: "#4A9DD9", // beyin
  genel: "#7C93B5",        // kadeh (karışık)
  bilim: "#2FBF71",        // atom
  tarih: "#C98A22",        // sütun
  cografya: "#3FA9A0",     // küre
  edebiyat: "#E8543F",     // kitap
  spor: "#5AA9E6",         // top
  sanat: "#E0729A",        // palet
  sinema: "#8C93A8",       // film şeridi
  muzik: "#F2B23C",        // nota
  teknoloji: "#4FB3C9",    // çip
  karisik: "#7C93B5",
};

// 24x24 kutuda dolgu yollar
const YOLLAR = {
  // beyin
  genel_kultur:
    "M9 3a3.5 3.5 0 0 0-3.4 2.7A3.3 3.3 0 0 0 3 8.9c0 1 .4 1.9 1.1 2.5A3.4 3.4 0 0 0 4 14a3.4 3.4 0 0 0 2 3.1A3.3 3.3 0 0 0 9.2 21c.9 0 1.7-.4 2.3-1V3.9A3.4 3.4 0 0 0 9 3m6 0a3.4 3.4 0 0 0-2.5 1V20c.6.6 1.4 1 2.3 1a3.3 3.3 0 0 0 3.2-3.9 3.4 3.4 0 0 0 2-3.1c0-.9-.3-1.8-.9-2.4.7-.6 1.1-1.5 1.1-2.5a3.3 3.3 0 0 0-2.6-3.2A3.5 3.5 0 0 0 15 3",
  // kadeh
  genel: "M6 3h12l-1 5.5A5 5 0 0 1 13 13v5h3v2H8v-2h3v-5a5 5 0 0 1-4-4.5z",
  // atom
  bilim:
    "M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8m0-7.6c-1.9 0-3 2.7-3.4 6.6C5 9.3 2.6 10.7 2.6 12s2.4 2.7 6 3.4C9 19.3 10.1 22 12 22s3-2.7 3.4-6.6c3.6-.7 6-2.1 6-3.4s-2.4-2.7-6-3.4C15 4.7 13.9 2 12 2m0 2c.6 0 1.3 1.6 1.6 4.4a26 26 0 0 0-3.2 0C10.7 5.6 11.4 4 12 4M6.9 10.4c-.3.5-.5 1-.7 1.6.2.5.4 1 .7 1.6-1.6-.4-2.3-.9-2.3-1.6s.7-1.2 2.3-1.6m10.2 0c1.6.4 2.3.9 2.3 1.6s-.7 1.2-2.3 1.6c.3-.5.5-1 .7-1.6-.2-.5-.4-1-.7-1.6M10.4 15.6a26 26 0 0 0 3.2 0C13.3 18.4 12.6 20 12 20s-1.3-1.6-1.6-4.4",
  // antik sütun
  tarih: "M3 4h18v2.5H3zM5 8h2.5v10H5zM10.7 8h2.6v10h-2.6zM16.5 8H19v10h-2.5zM3 19.5h18V22H3z",
  // küre
  cografya:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 2.2c1 1.1 1.8 2.6 2.3 4.3H9.7c.5-1.7 1.3-3.2 2.3-4.3M8.4 5.2A15 15 0 0 0 7.1 8.5H5a8 8 0 0 1 3.4-3.3M19 8.5h-2.1a15 15 0 0 0-1.3-3.3A8 8 0 0 1 19 8.5M4.2 10.5h2.5a20 20 0 0 0 0 3H4.2a8 8 0 0 1 0-3m4.5 0h6.6a18 18 0 0 1 0 3H8.7a18 18 0 0 1 0-3m8.6 0h2.5a8 8 0 0 1 0 3h-2.5a20 20 0 0 0 0-3M5 15.5h2.1c.3 1.2.7 2.3 1.3 3.3A8 8 0 0 1 5 15.5m4.7 0h4.6c-.5 1.7-1.3 3.2-2.3 4.3-1-1.1-1.8-2.6-2.3-4.3m6.9 0H19a8 8 0 0 1-3.4 3.3c.6-1 1-2.1 1.3-3.3",
  // kitap
  edebiyat:
    "M6 2h13a1 1 0 0 1 1 1v15H6.5a1.5 1.5 0 0 0 0 3H20v2H6.5A3.5 3.5 0 0 1 3 19.5v-14A3.5 3.5 0 0 1 6.5 2zm3 4v2h8V6z",
  // futbol topu
  spor: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 3.4 3.4 2.5-1.3 4h-4.2l-1.3-4zm-6.6 4.9 1.3 1 1.3 4-1.7 2.3-1.7-.6a8 8 0 0 1 .8-6.7m13.2 0a8 8 0 0 1 .8 6.7l-1.7.6-1.7-2.3 1.3-4zM10 16.3h4l1.4 1.9-.6 1.6a8 8 0 0 1-5.6 0l-.6-1.6z",
  // palet
  sanat:
    "M12 2C6.5 2 2 6 2 11.4c0 4.7 3.5 7.6 7.3 7.6 1.6 0 2.4-.9 2.4-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .9-1.8 2-1.8h1.7c3.1 0 5.6-2.4 5.6-5.6C20 4 16.5 2 12 2M6.8 12.5a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4m3.3-4.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4m5 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4",
  // film şeridi
  sinema:
    "M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m2 2v2h2V5zm12 0v2h2V5zM5 9v2h2V9zm12 0v2h2V9zM9 5v14h6V5zM5 13v2h2v-2zm12 0v2h2v-2zM5 17v2h2v-2zm12 0v2h2v-2z",
  // nota
  muzik: "M20 3v11.5a3.5 3.5 0 1 1-2-3.2V7.4L10 9v8.5a3.5 3.5 0 1 1-2-3.2V6z",
  // çip
  teknoloji:
    "M8 2h2v2h4V2h2v2h1a3 3 0 0 1 3 3v1h2v2h-2v4h2v2h-2v1a3 3 0 0 1-3 3h-1v2h-2v-2h-4v2H8v-2H7a3 3 0 0 1-3-3v-1H2v-2h2v-4H2V8h2V7a3 3 0 0 1 3-3h1zm1 7v6h6V9z",
  karisik: "M6 3h12l-1 5.5A5 5 0 0 1 13 13v5h3v2H8v-2h3v-5a5 5 0 0 1-4-4.5z",
};

/**
 * <KategoriIkon anahtar="bilim" boyut={22} />
 * plaka=true ise kendi renginde yuvarlak köşeli bir plakanın içinde çizilir.
 */
export default function KategoriIkon({ anahtar, boyut = 22, plaka = false, className = "" }) {
  const d = YOLLAR[anahtar] ?? YOLLAR.karisik;
  const renk = KATEGORI_RENK[anahtar] ?? KATEGORI_RENK.karisik;

  const svg = (
    <svg
      width={plaka ? Math.round(boyut * 0.62) : boyut}
      height={plaka ? Math.round(boyut * 0.62) : boyut}
      viewBox="0 0 24 24"
      fill={plaka ? "#0B1220" : renk}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );

  if (!plaka) return <span className={`bd-kat-ikon ${className}`}>{svg}</span>;

  return (
    <span
      className={`bd-kat-plaka ${className}`}
      style={{ width: boyut, height: boyut, background: renk }}
    >
      {svg}
    </span>
  );
}
