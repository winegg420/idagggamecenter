/**
 * BİLDİM! wordmark — çizilmiş logo (gradient renkli düz metin değil).
 *
 * Harfler kalın ve sıkı; "!" altın ve hafif eğik; altta ince altın çizgi.
 * Metin <text> ile değil <path> ile çizilseydi yazı tipi bağımlılığı kalkardı
 * ama okunurluk ve boyut için kalın system-ui/Baloo yeterli — burada harfler
 * SVG içinde sabit ölçekte, kendi çizgisi ve eğik ünlem işaretiyle veriliyor.
 */
export default function Logo({ boyut = 26, className = "" }) {
  // Yükseklikten genişlik: wordmark oranı ~4.3:1
  const g = Math.round(boyut * 4.3);
  return (
    <svg
      className={`bd-logo ${className}`}
      width={g}
      height={boyut}
      viewBox="0 0 172 40"
      role="img"
      aria-label="Bildim!"
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
        Bildim
      </text>
      {/* Ünlem: altın, hafif eğik, ayrı çizilmiş */}
      <g transform="translate(140 6) rotate(8 6 14)">
        <rect x="3.6" y="0" width="5.4" height="17" rx="2.4" fill="var(--bd-odul)" />
        <rect x="3.6" y="20.5" width="5.4" height="5.4" rx="2.7" fill="var(--bd-odul)" />
      </g>
      {/* Harflerin altında ince altın çizgi */}
      <rect x="1" y="33.5" width="136" height="2.6" rx="1.3" fill="var(--bd-odul)" opacity="0.9" />
    </svg>
  );
}
