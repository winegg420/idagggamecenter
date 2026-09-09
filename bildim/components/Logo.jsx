/**
 * QUIZZEXAM wordmark — çizilmiş logo (gradient renkli düz metin değil).
 *
 * Harfler kalın ve sıkı; altta ince altın çizgi. Markada ünlem işareti yok.
 *
 * ÖLÇÜLER TAHMİN DEĞİL: metin genişliği Baloo 2 800 ile tarayıcıda
 * getComputedTextLength() ile ölçüldü — "QuizzExam" fontSize 30 /
 * letterSpacing -0.6 iken 144.5 birim. viewBox, altın çizgi ve en/boy
 * katsayısı buna göre kuruldu; taşma yok.
 *   eski "Bildim" : metin 83.4 · viewBox 172 · oran 4.3 (sağda uzun çizgi + ünlem)
 *   yeni "QuizzExam": metin 144.5 · viewBox 148 · oran 3.7 (çizgi kelimenin altında)
 */
export default function Logo({ boyut = 26, className = "" }) {
  // Yükseklikten genişlik: wordmark oranı 148/40 = 3.7:1
  const g = Math.round(boyut * 3.7);
  return (
    <svg
      className={`bd-logo ${className}`}
      width={g}
      height={boyut}
      viewBox="0 0 148 40"
      role="img"
      aria-label="QuizzExam"
      focusable="false"
    >
      <text
        x="0"
        y="28"
        fill="var(--bd-metin)"
        fontFamily='"Baloo 2", system-ui, "Segoe UI", sans-serif'
        fontSize="30"
        fontWeight="800"
        letterSpacing="-0.6"
      >
        QuizzExam
      </text>
      {/* Harflerin altında ince altın çizgi (kelime genişliğince) */}
      <rect x="1" y="33.5" width="143" height="2.6" rx="1.3" fill="var(--bd-odul)" opacity="0.9" />
    </svg>
  );
}
