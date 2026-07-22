// Yarış başlatma akışı: ses + gyro izni (kullanıcı jesti içinde) + kalibrasyon yönlendirmesi.

import { useGameStore } from '../store/gameStore';
import { inputManager } from './input';
import { audio } from './audio';

export async function launchRace(): Promise<void> {
  const st = useGameStore.getState();
  audio.init();
  audio.setEnabled(st.soundOn);
  inputManager.controlMode = st.controlMode;
  try {
    // Yalnızca "telefon eğme" modu seçiliyse gyro izni + kalibrasyon akışı.
    // "Ekran butonları" modunda (varsayılan) doğrudan yarışa girilir — her cihazda çalışır.
    if (st.controlMode === 'tilt' && inputManager.gyroAvailable) {
      const ok = inputManager.gyroEnabled || (await inputManager.enableGyro());
      st.setGyroActive(ok);
      if (ok) {
        st.setAfterCalibration('race');
        st.setScreen('calibration');
        return;
      }
      // gyro alınamadı → butona düş
      st.setControlMode('buttons');
    }
  } catch (err) {
    console.warn('[DidaGP] Gyro akışı hatası:', err);
    st.setControlMode('buttons');
  }
  st.startRace();
}
