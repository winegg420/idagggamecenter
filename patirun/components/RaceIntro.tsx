// Yarış öncesi katman: yükleme ipucu + (ilk kez) tutorial.
import { useEffect, useState } from 'react';
import { randomTip } from '../lib/tips';

const TUTORIAL_KEY = 'yaris.tutorialSeen';

export function needsTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) !== '1';
  } catch {
    return false;
  }
}

interface RaceIntroProps {
  /** Katman tamamen kapanınca çağrılır (yarış başlayabilir) */
  onDone: () => void;
  /** Sadece ipucu göster (çok oyunculuda tutorial start'ı geciktirmesin) */
  tipOnly?: boolean;
}

export function RaceIntro({ onDone, tipOnly = false }: RaceIntroProps) {
  const [tutorial, setTutorial] = useState(() => !tipOnly && needsTutorial());
  const [tip] = useState(randomTip);
  const [visible, setVisible] = useState(true);

  // İpucu ekranı: tutorial yoksa 2 sn sonra otomatik kapanır
  useEffect(() => {
    if (tutorial || !visible) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [tutorial, visible, onDone]);

  if (!visible) return null;

  if (tutorial) {
    return (
      <div className="intro-overlay">
        <h2>Nasıl Oynanır?</h2>
        <div className="tutorial-grid">
          <div className="tutorial-cell">
            <div className="tutorial-icon">⬆⬇</div>
            <p>
              <b>Sağdaki butonlar:</b> ⬆ zıpla (sandıkların üstünden),
              <br />⬇ bas ve tut — eğil (barların altından).
            </p>
          </div>
          <div className="tutorial-cell">
            <div className="tutorial-icon">💥</div>
            <p>
              <b>Sol alttaki buton:</b> topladığın skill'i kullanır.
              <br />
              "?" kutularından skill çıkar!
            </p>
          </div>
        </div>
        <button
          className="btn primary big"
          onClick={() => {
            try {
              localStorage.setItem(TUTORIAL_KEY, '1');
            } catch {
              // kalıcı olmasa da bu oturumda görüldü
            }
            setTutorial(false);
          }}
        >
          Anladım!
        </button>
      </div>
    );
  }

  return (
    <div className="intro-overlay tip">
      <div className="loading-spinner" />
      <p className="tip-text">{tip}</p>
    </div>
  );
}
