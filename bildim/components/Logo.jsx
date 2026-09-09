/**
 * QUIZADOR wordmark — çizilmiş logo (gradient renkli düz metin değil).
 *
 * Harfler kalın ve sıkı; altta ince altın çizgi. Markada ünlem işareti yok.
 *
 * ÖLÇÜLER TAHMİN DEĞİL: metin genişliği Baloo 2 800 ile tarayıcıda
 * getComputedTextLength() / getBBox() ile ölçüldü — "Quizador" fontSize 30 /
 * letterSpacing -0.6 iken ilerleme 120.5, görsel kutu 121.6 birim.
 * viewBox görsel kutuya göre kuruldu: "Q" kuyruğu ilerleme genişliğini aşıyor,
 * dar viewBox kırpardı.
 *   "Bildim"    : metin  83.4 · viewBox 172 · oran 4.3 (sağda uzun çizgi + ünlem)
 *   "QuizzExam" : metin 144.5 · viewBox 148 · oran 3.7
 *   "Quizador"  : metin 121.6 · viewBox 124 · oran 3.1  ← güncel
 */
export default function Logo({ boyut = 26, className = "" }) {
  // Yükseklikten genişlik: wordmark oranı 124/40 = 3.1:1
  const g = Math.round(boyut * 3.1);
  return (
    <svg
      className={`bd-logo ${className}`}
      width={g}
      height={boyut}
      viewBox="0 0 124 40"
      role="img"
      aria-label="Quizador"
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
        Quizador
      </text>
      {/* Harflerin altında ince altın çizgi (kelime genişliğince) */}
      <rect x="1" y="33.5" width="120" height="2.6" rx="1.3" fill="var(--bd-odul)" opacity="0.9" />
    </svg>
  );
}
