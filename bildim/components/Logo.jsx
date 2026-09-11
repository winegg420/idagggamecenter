/**
 * QUIZ SQUARE wordmark — çizilmiş logo (gradient renkli düz metin değil).
 *
 * Harfler kalın ve sıkı; altta ince altın çizgi. Markada ünlem işareti yok.
 * Marka adı hiçbir dile ÇEVRİLMEZ; Türkçe arayüzde de "Quiz Square".
 *
 * ÖLÇÜLER TAHMİN DEĞİL: metin genişliği Baloo 2 800 ile tarayıcıda
 * getComputedTextLength() / getBBox() ile ölçüldü (fontSize 30, letterSpacing -0.6).
 * viewBox görsel kutuya göre kurulur: "Q" kuyruğu ilerleme genişliğini aşıyor,
 * dar viewBox kırpardı.
 *   "Bildim"      : metin  83.4 · viewBox 172 · oran 4.3 (sağda uzun çizgi + ünlem)
 *   "QuizzExam"   : metin 144.5 · viewBox 148 · oran 3.7
 *   "Quizador"    : metin 121.6 · viewBox 124 · oran 3.1
 *   "Quiz Square" : metin 157.2 · viewBox 160 · oran 4.0  ← güncel
 */
export default function Logo({ boyut = 26, className = "" }) {
  // Yükseklikten genişlik: wordmark oranı 160/40 = 4.0:1
  const g = Math.round(boyut * 4);
  return (
    <svg
      className={`bd-logo ${className}`}
      width={g}
      height={boyut}
      viewBox="0 0 160 40"
      role="img"
      aria-label="Quiz Square"
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
        Quiz Square
      </text>
      {/* Harflerin altında ince altın çizgi (kelime genişliğince: ilerleme 157.1) */}
      <rect x="1" y="33.5" width="155" height="2.6" rx="1.3" fill="var(--bd-odul)" opacity="0.9" />
    </svg>
  );
}
