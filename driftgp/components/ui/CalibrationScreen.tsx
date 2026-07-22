// Gyro kalibrasyon ekranı: telefonu düz tut → sıfırla → hedef ekrana geç.

import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { inputManager } from '../../game/input';

export function CalibrationScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startRace = useGameStore((s) => s.startRace);
  const setControlMode = useGameStore((s) => s.setControlMode);
  const afterCalibration = useGameStore((s) => s.afterCalibration);
  const [tilt, setTilt] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTilt(inputManager.rawTilt);
      setLive(inputManager.gyroLive());
    }, 80);
    return () => clearInterval(id);
  }, []);

  const handleCalibrate = () => {
    inputManager.calibrate();
    if (afterCalibration === 'race') startRace();
    else setScreen(afterCalibration);
  };

  // gyro veri göndermiyorsa → butona geç
  const fallbackToButtons = () => {
    setControlMode('buttons');
    if (afterCalibration === 'race') startRace();
    else setScreen(afterCalibration);
  };

  const needleAngle = Math.max(-45, Math.min(45, tilt * 1.6));

  return (
    <div className="screen calibration-screen">
      <h2>DİREKSİYON KALİBRASYONU</h2>
      <p>Telefonu yan (landscape) ve düz tutun, sonra sıfırlayın.</p>
      <div className="tilt-gauge">
        <div className="tilt-needle" style={{ transform: `rotate(${needleAngle}deg)` }} />
        <div className="tilt-center-mark" />
      </div>
      <div className="tilt-value">{tilt.toFixed(1)}°</div>
      <div className={`tilt-status ${live ? 'ok' : 'warn'}`}>
        {live ? '✓ Sensör aktif — telefonu eğince ibre hareket etmeli' : '⚠ Sensörden veri gelmiyor'}
      </div>
      <button className="primary-btn" onClick={handleCalibrate}>
        SIFIRLA VE BAŞLA
      </button>
      <button className="secondary-btn" onClick={fallbackToButtons}>
        🔘 Bunun yerine ekran butonları kullan
      </button>
    </div>
  );
}
