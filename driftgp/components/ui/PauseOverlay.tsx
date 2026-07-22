// Yarış içi duraklatma menüsü: devam / yeniden başlat (solo) / lobiye dön (multi) / ana menü.
// Solo'da fizik donar; multi'de diğer oyuncular beklenemeyeceği için yarış arka planda sürer.

import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { multiplayer } from '../../net/multiplayer';

export function PauseOverlay() {
  const mode = useGameStore((s) => s.mode);
  const setPaused = useGameStore((s) => s.setPaused);
  const setScreen = useGameStore((s) => s.setScreen);
  const startRace = useGameStore((s) => s.startRace);

  // Escape ile kapan (HUD'daki Escape açar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaused(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaused]);

  const quitToLobby = () => {
    multiplayer.sendQuit().catch(() => {});
    multiplayer.returnToLobby();
    setScreen('multiplayer');
  };

  const quitToMenu = () => {
    if (mode === 'multi') {
      multiplayer.sendQuit().catch(() => {});
      multiplayer.leaveRoom();
    }
    setScreen('menu');
  };

  return (
    <div className="pause-overlay">
      <div className="pause-panel">
        <h2>⏸ DURAKLATILDI</h2>
        {mode === 'multi' && (
          <p className="pause-note">Çok oyunculuda yarış arka planda devam eder — çıkarsan DNF sayılırsın.</p>
        )}
        <button className="primary-btn" onClick={() => setPaused(false)}>
          ▶ DEVAM ET
        </button>
        {mode === 'solo' && (
          <button className="secondary-btn" onClick={startRace}>
            ↻ YENİDEN BAŞLAT
          </button>
        )}
        {mode === 'multi' && (
          <button className="secondary-btn" onClick={quitToLobby}>
            🏁 YARIŞI BIRAK — LOBİYE DÖN
          </button>
        )}
        <button className="secondary-btn danger" onClick={quitToMenu}>
          🏠 ANA MENÜ
        </button>
      </div>
    </div>
  );
}
