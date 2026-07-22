import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { supabaseConfigured } from '../lib/supabase';
import type { BotDifficulty } from '../game/bots/botAI';
import { availableMaps2D as availableMaps } from '../game/track2d/maps2d';
import { useStatsStore } from '../stores/statsStore';
import { SECRETS } from '../config/constants';
import { SettingsModal } from '../components/SettingsModal';
import { avatarDataUri } from '../lib/avatars';
import { characterDataUri, type Pose } from '../render2d/characterSprites';
import { useCharacterStore } from '../stores/characterStore';
import { RunnerStrip } from '../components/RunnerStrip';

/** Menü arka planı: damalı şerit + bulutlar + koşan karakter şeridi */
function MenuBackdrop() {
  return (
    <>
      <div className="auth-flag-strip" aria-hidden="true" />
      <div className="auth-clouds" aria-hidden="true">
        <span>☁️</span>
        <span>☁️</span>
        <span>☁️</span>
      </div>
      <RunnerStrip />
    </>
  );
}

export function MenuScreen() {
  const startRace = useAppStore((s) => s.startRace);
  const setScreen = useAppStore((s) => s.setScreen);
  const username = useAuthStore((s) => s.user?.username);
  const userId = useAuthStore((s) => s.user?.id);
  const avatarId = useAuthStore((s) => s.user?.avatarId);
  const setUsername = useAuthStore((s) => s.setUsername);
  const authError = useAuthStore((s) => s.error);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  const saveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 3 || trimmed === username) {
      setEditingName(false);
      return;
    }
    setNameBusy(true);
    const ok = await setUsername(trimmed);
    setNameBusy(false);
    if (ok) setEditingName(false);
  };
  const roomError = useRoomStore((s) => s.error);
  const roomStatus = useRoomStore((s) => s.status);
  const [pickDifficulty, setPickDifficulty] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [roomMode, setRoomMode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const hiddenUnlocked = useStatsStore((s) => s.totalRaces >= SECRETS.HIDDEN_MAP_RACES);
  const selectedCharId = useCharacterStore((s) => s.selectedId);
  const heroCosmetics = useCharacterStore((s) => s.cosmeticsOf(s.selectedId));
  // Vitrindeki karakter koşu animasyonu
  const [heroFrame, setHeroFrame] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setHeroFrame((f) => (f + 1) % 2), 180);
    return () => window.clearInterval(t);
  }, []);
  const heroPose: Pose = heroFrame === 0 ? 'run1' : 'run2';

  // WhatsApp davet linkiyle gelindi mi? (?oda=KOD)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oda');
    if (code && userId && username && supabaseConfigured) {
      window.history.replaceState({}, '', window.location.pathname);
      void useRoomStore
        .getState()
        .joinRoom(code, userId, username)
        .then((ok) => ok && setScreen('lobby'));
    }
  }, [userId, username, setScreen]);

  const createRoom = async () => {
    if (!userId || !username) return;
    const ok = await useRoomStore.getState().createRoom(userId, username);
    if (ok) setScreen('lobby');
  };

  const joinRoom = async () => {
    if (!userId || !username || joinCode.trim().length < 6) return;
    const ok = await useRoomStore.getState().joinRoom(joinCode, userId, username);
    if (ok) setScreen('lobby');
  };

  if (roomMode) {
    return (
      <div className="screen center menu menu-screen">
        <MenuBackdrop />
        <h2>Özel Oda</h2>
        {!supabaseConfigured && <p className="error-text">Çok oyunculu mod için Supabase gerekli</p>}
        <div className="menu-buttons">
          <button
            className="btn primary big"
            disabled={!supabaseConfigured || roomStatus === 'connecting'}
            onClick={() => void createRoom()}
          >
            ➕ ODA KUR
          </button>
          <input
            className="text-input"
            value={joinCode}
            maxLength={6}
            placeholder="ODA KODU"
            style={{ textTransform: 'uppercase' }}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn big"
            disabled={!supabaseConfigured || joinCode.trim().length < 6 || roomStatus === 'connecting'}
            onClick={() => void joinRoom()}
          >
            🚪 KATIL
          </button>
          {roomError && <p className="error-text">{roomError}</p>}
          <button className="btn" onClick={() => setRoomMode(false)}>
            ← Geri
          </button>
        </div>
      </div>
    );
  }

  if (pickDifficulty) {
    if (difficulty === null) {
      return (
        <div className="screen center menu menu-screen">
          <MenuBackdrop />
          <h2>Bot zorluğu seç</h2>
          <div className="menu-buttons">
            <button className="btn big" onClick={() => setDifficulty('kolay')}>
              🐢 Kolay
            </button>
            <button className="btn primary big" onClick={() => setDifficulty('orta')}>
              🐇 Orta
            </button>
            <button className="btn big" onClick={() => setDifficulty('zor')}>
              🐆 Zor
            </button>
            <button className="btn" onClick={() => setPickDifficulty(false)}>
              ← Geri
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="screen center menu menu-screen">
        <MenuBackdrop />
        <h2>Harita seç</h2>
        <div className="menu-buttons">
          <button
            className={`btn small ${ghostMode ? 'voted' : ''}`}
            onClick={() => setGhostMode(!ghostMode)}
          >
            👻 Hayalet Yarış: {ghostMode ? 'AÇIK (rekoruna karşı, botsuz)' : 'kapalı'}
          </button>
          {availableMaps(hiddenUnlocked).map((m) => (
            <button
              key={m.id}
              className="btn big"
              onClick={() =>
                startRace(m.id, {
                  botDifficulty: difficulty,
                  botCount: ghostMode ? 0 : 5,
                  ghostRace: ghostMode,
                })
              }
            >
              {m.name}
            </button>
          ))}
          <button className="btn" onClick={() => setDifficulty(null)}>
            ← Geri
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen center menu menu-screen">
      <MenuBackdrop />
      <div className="menu-hero">
        <img
          className="menu-hero-char"
          src={characterDataUri(selectedCharId, heroCosmetics, heroPose)}
          alt="Karakterin"
          title="Karakterini özelleştir"
          onClick={() => setScreen('characters')}
        />
        <h1 className="auth-logo menu-logo">
          PATİ<em>RUN</em>
        </h1>
      </div>
      {username && !editingName && (
        <div className="menu-profile-row">
          <img
            className="avatar-sq"
            src={avatarDataUri(avatarId)}
            alt=""
            onClick={() => setScreen('profile')}
          />
          <p className="tagline" style={{ margin: 0 }}>Hoş geldin, {username}!</p>
          <button
            className="btn tiny"
            aria-label="Kullanıcı adını değiştir"
            onClick={() => {
              setNewName(username);
              setEditingName(true);
            }}
          >
            ✏️
          </button>
        </div>
      )}
      {editingName && (
        <div className="menu-profile-row">
          <input
            className="text-input"
            style={{ maxWidth: 180 }}
            value={newName}
            maxLength={16}
            placeholder="Yeni kullanıcı adı"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveName()}
          />
          <button className="btn tiny" disabled={nameBusy || newName.trim().length < 3} onClick={() => void saveName()}>
            ✓ Kaydet
          </button>
          <button className="btn tiny" disabled={nameBusy} onClick={() => setEditingName(false)}>
            ✕
          </button>
        </div>
      )}
      {editingName && authError && <p className="error-text">{authError}</p>}
      <div className="menu-buttons">
        <button className="btn primary big" onClick={() => setScreen('quickMatch')}>
          ⚡ HIZLI MAÇ
        </button>
        <button className="btn big" onClick={() => setRoomMode(true)}>
          👥 ÖZEL ODA
        </button>
        <button className="btn big" onClick={() => setPickDifficulty(true)}>
          🤖 TEK KİŞİLİK
        </button>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        <button className="btn big" onClick={() => setScreen('characters')}>
          🎭 KARAKTERLER
        </button>
        <div className="menu-row">
          <button className="btn small" onClick={() => setScreen('profile')}>
            👤 Profil
          </button>
          <button className="btn small" onClick={() => setScreen('leaderboard')}>
            🏆 Sıralama
          </button>
          <button className="btn small" onClick={() => setScreen('friends')}>
            👥 Arkadaşlar
          </button>
          <button className="btn small" onClick={() => setScreen('players')}>
            🌐 Oyuncular
          </button>
          <button className="btn small" onClick={() => setShowSettings(true)}>
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
}
