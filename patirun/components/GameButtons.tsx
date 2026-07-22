// Yarış kontrol butonları (tür standardı düzen): ZIPLA sağ altta (dokun),
// EĞİL onun solunda (basılı tut). Skill butonu HUD'da sol alttadır.
import { tryLandscapeFullscreen } from './RotateOverlay';

interface GameButtonsProps {
  onJump: () => void;
  onDuck: (down: boolean) => void;
}

// Tam ekran denemesi: tek seferlik bayrak yerine "tam ekranda değilsek
// tekrar dene" (ilk deneme başarısız olursa oyun tam ekransız kalıyordu).
let lastFsTry = 0;
function ensureFullscreen(): void {
  const now = Date.now();
  if (document.fullscreenElement || now - lastFsTry < 1200) return;
  lastFsTry = now;
  void tryLandscapeFullscreen();
}

function ChevronUp() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M4 15.5 L12 7.5 L20 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M4 8.5 L12 16.5 L20 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GameButtons({ onJump, onDuck }: GameButtonsProps) {
  return (
    <>
      <button
        className="game-btn jump-button"
        aria-label="Zıpla"
        onPointerDown={(e) => {
          e.preventDefault();
          ensureFullscreen();
          onJump();
        }}
      >
        <ChevronUp />
        <span className="game-btn-label">ZIPLA</span>
      </button>
      <button
        className="game-btn duck-button"
        aria-label="Eğil"
        onPointerDown={(e) => {
          e.preventDefault();
          ensureFullscreen();
          onDuck(true);
        }}
        onPointerUp={() => onDuck(false)}
        onPointerCancel={() => onDuck(false)}
        onPointerLeave={() => onDuck(false)}
      >
        <ChevronDown />
        <span className="game-btn-label">EĞİL</span>
      </button>
    </>
  );
}
