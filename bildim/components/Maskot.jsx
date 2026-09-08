/**
 * BİLGE — Bildim!'in baykuş maskotu (tamamen inline SVG, görsel dosya yok).
 * Rütbe sisteminde zaten 🦉 "Bilge" rütbesi var; maskot onunla aynı kimlikten geliyor.
 *
 * Pozlar: "selam" (karşılama), "dusunuyor" (boş durum / bekleme), "kutluyor" (başarı).
 * Renkler currentColor'a bağlı değil; tema değişkenlerinden okur.
 */
export default function Maskot({ poz = "selam", boyut = 96, className = "" }) {
  const kanat =
    poz === "selam"
      ? "M26 62c-7 2-12 8-11 15 6 2 12-2 15-8"
      : poz === "kutluyor"
        ? "M26 58c-8-4-15-1-17 6 5 5 13 5 18 0"
        : "M27 64c-6 3-9 9-7 15 6 1 11-4 13-10";

  const kanatSag =
    poz === "selam"
      ? "M74 62c7 2 12 8 11 15-6 2-12-2-15-8"
      : poz === "kutluyor"
        ? "M74 58c8-4 15-1 17 6-5 5-13 5-18 0"
        : "M73 64c6 3 9 9 7 15-6 1-11-4-13-10";

  return (
    <svg
      className={`bd-maskot bd-maskot-${poz} ${className}`}
      width={boyut}
      height={boyut}
      viewBox="0 0 100 110"
      role="img"
      aria-label="Bilge, Bildim baykuşu"
    >
      <defs>
        <linearGradient id="bd-tuy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="bd-govde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="bd-isik" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Arka ışık */}
      <ellipse cx="50" cy="48" rx="46" ry="44" fill="url(#bd-isik)" />

      {/* Kuyruk */}
      <path d="M42 92c3 8 13 8 16 0-3 4-13 4-16 0z" fill="#5b21b6" />

      {/* Gövde */}
      <ellipse cx="50" cy="62" rx="30" ry="32" fill="url(#bd-govde)" />
      {/* Göğüs */}
      <ellipse cx="50" cy="70" rx="19" ry="21" fill="#ede9fe" opacity="0.92" />

      {/* Kanatlar */}
      <path d={kanat} stroke="#5b21b6" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d={kanatSag} stroke="#5b21b6" strokeWidth="7" strokeLinecap="round" fill="none" />

      {/* Baş */}
      <ellipse cx="50" cy="38" rx="31" ry="27" fill="url(#bd-tuy)" />
      {/* Kulak püskülleri */}
      <path d="M24 20c2 6 6 10 11 12-4-7-6-11-11-12z" fill="#6d28d9" />
      <path d="M76 20c-2 6-6 10-11 12 4-7 6-11 11-12z" fill="#6d28d9" />

      {/* Göz çukurları */}
      <circle cx="38" cy="37" r="13" fill="#faf5ff" />
      <circle cx="62" cy="37" r="13" fill="#faf5ff" />

      {/* Gözler — poza göre */}
      {poz === "dusunuyor" ? (
        <>
          <circle cx="40" cy="35" r="5.5" fill="#1f1147" />
          <circle cx="64" cy="35" r="5.5" fill="#1f1147" />
          <circle cx="41.8" cy="33.2" r="1.9" fill="#fff" />
          <circle cx="65.8" cy="33.2" r="1.9" fill="#fff" />
        </>
      ) : poz === "kutluyor" ? (
        <>
          {/* Mutlu kısık gözler */}
          <path d="M32 38c3-5 9-5 12 0" stroke="#1f1147" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M56 38c3-5 9-5 12 0" stroke="#1f1147" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="38" cy="37" r="6" fill="#1f1147" />
          <circle cx="62" cy="37" r="6" fill="#1f1147" />
          <circle cx="40" cy="35" r="2.1" fill="#fff" />
          <circle cx="64" cy="35" r="2.1" fill="#fff" />
        </>
      )}

      {/* Gaga */}
      <path d="M50 44l-5 7h10l-5-7z" fill="#fbbf24" />

      {/* Ayaklar */}
      <path d="M42 92v5M46 92v5M54 92v5M58 92v5" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />

      {/* Poza özel süs */}
      {poz === "kutluyor" && (
        <g className="bd-maskot-parlak">
          <path d="M14 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fbbf24" />
          <path d="M86 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#fde68a" />
        </g>
      )}
      {poz === "dusunuyor" && (
        <g className="bd-maskot-dusunce">
          <circle cx="80" cy="20" r="3" fill="#c4b5fd" opacity="0.9" />
          <circle cx="87" cy="12" r="4.5" fill="#c4b5fd" opacity="0.75" />
        </g>
      )}
    </svg>
  );
}
