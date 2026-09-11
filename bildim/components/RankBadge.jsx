import { rutbeBul } from "../lib/ranks.js";

// Rütbeye özel SVG rozet biçimleri (emoji yerine — her cihazda aynı görünür).
const BICIM = {
  Çaylak: (r) => (
    <>
      <circle cx="12" cy="13" r="6" fill={r} opacity="0.9" />
      <path d="M12 5.5 13.6 9h-3.2z" fill={r} />
    </>
  ),
  Bilge: (r) => (
    <>
      <path d="M12 4 19 8v5c0 4-3 6.5-7 7.5C8 19.5 5 17 5 13V8z" fill={r} opacity="0.9" />
      <path d="m9.5 12.5 1.8 1.8 3.4-3.6" stroke="#0B1220" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  Üstat: (r) => (
    <>
      <path d="M12 3 20 7v6c0 4.5-3.4 7.3-8 8.5C7.4 20.3 4 17.5 4 13V7z" fill={r} opacity="0.9" />
      <path d="M12 8v7M9 11h6" stroke="#0B1220" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  Kahin: (r) => (
    <>
      <circle cx="12" cy="12" r="7.5" fill={r} opacity="0.85" />
      <circle cx="12" cy="12" r="3.2" fill="#0B1220" opacity="0.55" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" stroke={r} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  Efsane: (r) => (
    <>
      <path d="M4 17 6 7l4 4 2-5 2 5 4-4 2 10z" fill={r} opacity="0.95" />
      <path d="M4.5 19.5h15" stroke={r} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
};

/** Puana göre rütbe rozeti (SVG) + rütbe adı. */
export default function RankBadge({ puan, sadeceRozet = false, boyut = 18 }) {
  const r = rutbeBul(puan ?? 0);
  const ciz = BICIM[r.ad] ?? BICIM["Çaylak"];
  const rozet = (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="bd-rutbe-rozet"
    >
      {ciz(r.renk)}
    </svg>
  );

  if (sadeceRozet) return rozet;

  return (
    <span className="rutbe-chip bd-rutbe-chip" style={{ color: r.metinRenk }}>
      {rozet}
      {r.ad}
    </span>
  );
}
