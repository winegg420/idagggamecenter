// Dekoratif koşan karakter şeridi (menü/başlık süsü). Orijinal PatiRun'da
// AuthScreen içindeydi; hub sürümünde AuthScreen kaldırıldığı için buraya taşındı.
import { useEffect, useState } from 'react';
import { characterDataUri, type Pose } from '../render2d/characterSprites';

export function RunnerStrip() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 2), 170);
    return () => window.clearInterval(t);
  }, []);
  const pose: Pose = frame === 0 ? 'run1' : 'run2';
  const chars = ['tavsan', 'penguen', 'tilki', 'kurbaga'];
  return (
    <div className="auth-runners" aria-hidden="true">
      {chars.map((id, i) => (
        <img
          key={id}
          src={characterDataUri(id, undefined, pose)}
          alt=""
          style={{ animationDelay: `${i * 0.18}s`, zIndex: 4 - i }}
        />
      ))}
      <div className="auth-speedlines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
