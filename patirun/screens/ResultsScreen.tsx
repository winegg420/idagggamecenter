import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useRaceStore } from '../stores/raceStore';
import { useStatsStore } from '../stores/statsStore';
import { useRoomStore } from '../stores/roomStore';
import { maskProfanity } from '../lib/profanity';
import { shareResultCard } from '../lib/shareCard';
import { getMap2D as getMap } from '../game/track2d/maps2d';
import { sound } from '../lib/sound';

function formatFinish(t: number | null, dq: boolean): string {
  if (dq) return 'DSQ';
  if (t === null) return 'DNF';
  const m = Math.floor(t / 60);
  return `${m}:${(t % 60).toFixed(2).padStart(5, '0')}`;
}

export function ResultsScreen() {
  const results = useRaceStore((s) => s.results);
  const setScreen = useAppStore((s) => s.setScreen);
  const startRace = useAppStore((s) => s.startRace);
  const mapId = useAppStore((s) => s.mapId);

  const justUnlockedHidden = useStatsStore((s) => s.justUnlockedHidden);
  const celebrateHidden = useStatsStore((s) => s.celebrateHidden);
  const meta = useRaceStore((s) => s.meta);
  const categories = useRaceStore((s) => s.categories);
  const wasMultiplayer = useRaceStore((s) => s.wasMultiplayer);
  const roomClient = useRoomStore((s) => s.client);
  const chat = useRoomStore((s) => s.chat);
  const [sharing, setSharing] = useState(false);

  const END_EMOJIS = ['😂', '🔥', '😎', '🏆', '💪', '😭', '🎉', '🫡'];
  const END_PHRASES = ['İyi yarıştı!', 'Revanş?', 'Şanslıydın 😏', 'Efsaneydim', 'Bir daha!'];

  const sendEnd = (kind: 'emoji' | 'quick', body: string) => {
    sound.click();
    roomClient?.sendChat({
      u: roomClient.username,
      kind,
      body: kind === 'quick' ? maskProfanity(body) : body,
      t: Date.now(),
    });
  };

  const doShare = async () => {
    setSharing(true);
    sound.click();
    await shareResultCard(getMap(mapId).name, results, categories);
    setSharing(false);
  };

  // Revanş: oda hâlâ açıksa aynı oyuncularla lobiye dön
  const rematch = () => {
    sound.click();
    if (wasMultiplayer && roomClient) {
      useRoomStore.getState().setStartMsg(null);
      setScreen('lobby');
    } else {
      startRace(mapId);
    }
  };

  return (
    <div className="screen center results">
      {justUnlockedHidden && (
        <div className="hidden-map-surprise" onClick={celebrateHidden}>
          <h2>🎉 SÜRPRİZ! 🎉</h2>
          <p>50 yarışı tamamladın — gizli harita açıldı:</p>
          <p className="hidden-map-name">🍭 Şeker Diyarı 🍭</p>
          <button className="btn primary">Süper!</button>
        </div>
      )}
      <h2>Yarış Bitti!</h2>
      <div className="results-table">
        {results.map((r) => (
          <div key={r.id} className={`results-row ${r.rank === 1 ? 'winner' : ''}`}>
            <span className="res-rank">{r.rank}.</span>
            <span className="res-name">{r.name}</span>
            <span className="res-time">{formatFinish(r.finishTime, r.disqualified)}</span>
            <span className="res-points">+{r.points}</span>
          </div>
        ))}
      </div>
      {meta && (
        <div className="outcome-meta">
          {meta.bonus > 0 && <p>🌞 Günün ilk yarışı bonusu: +{meta.bonus}</p>}
          {meta.xpGained > 0 && <p>⭐ Karakter XP: +{meta.xpGained}</p>}
          {meta.newBestTime && <p>⏱️ Yeni kişisel rekor!</p>}
          <p>
            Toplam puan: <b>{meta.totalPoints}</b> · Rütbe: <b>{meta.rankTitle}</b>
          </p>
          {meta.newBadges.length > 0 && (
            <div className="new-badges">
              {meta.newBadges.map((b) => (
                <div key={b.id} className="badge-earned">
                  {b.emoji} <b>{b.isim}</b> — {b.aciklama}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {categories.length > 0 && (
        <div className="outcome-meta">
          <b>Maçın Yıldızları</b>
          {categories.map((c) => (
            <p key={c.title}>
              {c.emoji} {c.title}: <b>{c.name}</b>
            </p>
          ))}
        </div>
      )}
      {/* Maç sonu sohbeti (sadece çok oyunculu — oda hâlâ açıkken) */}
      {wasMultiplayer && roomClient && (
        <div className="endchat">
          <div className="endchat-bubbles">
            {chat.slice(-4).map((c) => (
              <div key={c.key} className={`endchat-bubble ${c.kind === 'emoji' ? 'is-emoji' : ''}`}>
                <b>{c.u}</b> {c.kind === 'emoji' ? <span className="chat-emoji">{c.body}</span> : c.body}
              </div>
            ))}
          </div>
          <div className="chat-quick">
            {END_EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onClick={() => sendEnd('emoji', e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="chat-quick">
            {END_PHRASES.map((q) => (
              <button key={q} className="btn tiny" onClick={() => sendEnd('quick', q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="menu-buttons">
        <button className="btn primary big" onClick={rematch}>
          🔄 REVANŞ
        </button>
        <button className="btn big" disabled={sharing} onClick={() => void doShare()}>
          📤 Sonucu Paylaş
        </button>
        <button className="btn big" onClick={() => setScreen('menu')}>
          🏠 ANA MENÜ
        </button>
      </div>
    </div>
  );
}
