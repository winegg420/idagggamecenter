/**
 * BİLGE — QuizzExam'in kuşu.
 *
 * Yeniden çizildi: eski hâli yuvarlak-şirin bir baykuştu ve Duolingo'yu
 * hatırlatıyordu. Yeni hâl KÖŞELİ/GEOMETRİK — düz kenarlar, kırık açılar,
 * lacivert gövde, altın gaga, gözler yalnız iki daire. Gradient ve arka ışık
 * kaldırıldı (düz renk).
 *
 * Pozlar korundu: "selam", "dusunuyor", "kutluyor".
 * Boyut varsayılanı küçültüldü: maskot artık ekranın odağı değil, aksan.
 */
export default function Maskot({ poz = "selam", boyut = 64, className = "" }) {
  // Kanatlar da köşeli: üçgen paneller
  const kanatSol =
    poz === "selam"
      ? "M26 58 12 50l4 16z"
      : poz === "kutluyor"
        ? "M26 56 14 40l2 18z"
        : "M26 60 14 58l6 12z";

  const kanatSag =
    poz === "selam"
      ? "M74 58 88 50l-4 16z"
      : poz === "kutluyor"
        ? "M74 56 86 40l-2 18z"
        : "M74 60 86 58l-6 12z";

  return (
    <svg
      className={`bd-maskot bd-maskot-${poz} ${className}`}
      width={boyut}
      height={boyut}
      viewBox="0 0 100 110"
      role="img"
      aria-label="Bilge"
      focusable="false"
    >
      {/* Gövde — altı daralan altıgen panel */}
      <path d="M50 30 76 44v34L50 94 24 78V44z" fill="#1F2C4A" />
      {/* Göğüs plakası — daha açık lacivert, köşeli */}
      <path d="M50 48 64 56v20l-14 8-14-8V56z" fill="#2C3D63" />

      {/* Kanatlar */}
      <path d={kanatSol} fill="#16223C" />
      <path d={kanatSag} fill="#16223C" />

      {/* Baş — köşeli, kulak boynuzları düz üçgen */}
      <path d="M50 6 74 20v20L50 52 26 40V20z" fill="#26365A" />
      <path d="M26 20 20 6l12 6z" fill="#F2B23C" />
      <path d="M74 20 80 6 68 12z" fill="#F2B23C" />

      {/* Gözler — yalnız iki daire */}
      {poz === "kutluyor" ? (
        <>
          <rect x="33" y="26" width="12" height="3.4" rx="1.7" fill="#0B1220" />
          <rect x="55" y="26" width="12" height="3.4" rx="1.7" fill="#0B1220" />
        </>
      ) : (
        <>
          <circle cx="39" cy="28" r={poz === "dusunuyor" ? 4.6 : 5.4} fill="#0B1220" />
          <circle cx="61" cy="28" r={poz === "dusunuyor" ? 4.6 : 5.4} fill="#0B1220" />
        </>
      )}

      {/* Gaga — altın, keskin üçgen */}
      <path d="M50 34 44 44h12z" fill="#F2B23C" />

      {/* Ayaklar — düz çizgi */}
      <path d="M42 94v6M58 94v6" stroke="#F2B23C" strokeWidth="3" strokeLinecap="butt" />

      {/* Poza özel aksan — parıltı yerine düz geometrik işaret */}
      {poz === "kutluyor" && (
        <g className="bd-maskot-parlak">
          <path d="M14 22 17 30 9 27z" fill="#F2B23C" />
          <path d="M88 26 90 32 84 30z" fill="#F7CB77" />
        </g>
      )}
      {poz === "dusunuyor" && (
        <g className="bd-maskot-dusunce">
          <rect x="78" y="18" width="5" height="5" fill="#4A9DD9" opacity="0.9" />
          <rect x="86" y="9" width="7" height="7" fill="#4A9DD9" opacity="0.65" />
        </g>
      )}
    </svg>
  );
}
