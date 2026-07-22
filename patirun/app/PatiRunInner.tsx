// PatiRun ekran yöneticisi (hub sürümü). Orijinal src/App.tsx'ten uyarlandı:
//  - AuthScreen kaldırıldı (giriş Bildim tarafında; kimlik köprüsü PatiRunApp'te).
//  - /version.json sürüm kontrolü kaldırıldı (Bildim'in kendi SW güncellemesi var).
// Kalan oyun mantığı (ekranlar, presence, davet, ses, yatay kilit) korundu.
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { sound } from '../lib/sound';
import { installErrorLogging } from '../lib/monitoring';
import { releaseLandscapeFullscreen } from '../components/RotateOverlay';
import { useAuthStore } from '../stores/authStore';
import { usePresenceStore } from '../stores/presenceStore';
import { MenuScreen } from '../screens/MenuScreen';
import { RaceScreen } from '../screens/RaceScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { MpRaceScreen } from '../screens/MpRaceScreen';
import { CharacterScreen } from '../screens/CharacterScreen';
import { QuickMatchScreen } from '../screens/QuickMatchScreen';
import { PodiumScreen } from '../screens/PodiumScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { PlayersScreen } from '../screens/PlayersScreen';
import { useRoomStore } from '../stores/roomStore';

function Screens() {
  const screen = useAppStore((s) => s.screen);

  switch (screen) {
    case 'menu':
      return <MenuScreen />;
    case 'race':
      return <RaceScreen />;
    case 'results':
      return <ResultsScreen />;
    case 'lobby':
      return <LobbyScreen />;
    case 'mpRace':
      return <MpRaceScreen />;
    case 'characters':
      return <CharacterScreen />;
    case 'quickMatch':
      return <QuickMatchScreen />;
    case 'podium':
      return <PodiumScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'leaderboard':
      return <LeaderboardScreen />;
    case 'friends':
      return <FriendsScreen />;
    case 'players':
      return <PlayersScreen />;
    default:
      return <MenuScreen />;
  }
}

export default function PatiRunInner() {
  const userId = useAuthStore((s) => s.user?.id);
  const toast = usePresenceStore((s) => s.toast);
  const invite = usePresenceStore((s) => s.invite);
  const screen = useAppStore((s) => s.screen);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Gelen oda davetini kabul et: mevcut odadan çık → davet odasına katıl → lobi
  const acceptInvite = async () => {
    const user = useAuthStore.getState().user;
    const inv = usePresenceStore.getState().invite;
    if (!user || !inv || inviteBusy) return;
    setInviteBusy(true);
    try {
      const room = useRoomStore.getState();
      if (room.client) await room.leaveRoom();
      const ok = await room.joinRoom(inv.code, user.id, user.username ?? 'Oyuncu');
      if (ok) useAppStore.getState().setScreen('lobby');
    } catch {
      // katılım başarısızsa banner kapanır, kullanıcı elle kodla katılabilir
    }
    usePresenceStore.getState().clearInvite();
    setInviteBusy(false);
  };

  // Girişten sonra küresel online presence'a bağlan (arkadaş bildirimleri)
  useEffect(() => {
    if (userId) usePresenceStore.getState().connect(userId);
  }, [userId]);

  // Yatay kilit yarış SONRASI ekranlarda da korunur (sonuç/podyum/lobi).
  useEffect(() => {
    const keepLandscape = ['race', 'mpRace', 'results', 'podium', 'lobby'];
    if (!keepLandscape.includes(screen)) releaseLandscapeFullscreen();
  }, [screen]);

  // Ekrana göre müzik
  useEffect(() => {
    if (screen === 'race' || screen === 'mpRace') {
      sound.startMusic('race');
    } else if (screen === 'quickMatch') {
      sound.stopMusic();
    } else {
      sound.startMusic('menu');
    }
    return () => sound.stopMusic();
  }, [screen]);

  // Hata loglama (bir kez kurulur)
  useEffect(() => {
    installErrorLogging();
  }, []);

  return (
    <>
      <Screens />
      {toast && <div className="toast">{toast}</div>}
      {invite && screen !== 'race' && screen !== 'mpRace' && (
        <div className="toast invite-toast">
          <span>🏁 <b>{invite.fromName}</b> seni yarışa davet etti!</span>
          <div className="invite-actions">
            <button className="btn tiny primary" disabled={inviteBusy} onClick={() => void acceptInvite()}>
              🚪 Katıl
            </button>
            <button
              className="btn tiny"
              disabled={inviteBusy}
              onClick={() => usePresenceStore.getState().clearInvite()}
            >
              Yoksay
            </button>
          </div>
        </div>
      )}
    </>
  );
}
