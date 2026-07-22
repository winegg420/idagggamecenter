// Yarış sonu: sıralama tablosu, tur süreleri, XP dökümü, yeni rozetler.
// Multi'de sıralama canlıdır: arkadaşlar bitirdikçe süreleri tabloya düşer.

import { useEffect, useReducer } from 'react';
import { useGameStore, formatTime, type RacerResult } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { BADGES } from '../../game/xp';
import { getCar } from '../../game/cars';
import { multiplayer } from '../../net/multiplayer';

export function ResultsScreen() {
  const lapTimes = useGameStore((s) => s.lapTimes);
  const storedResults = useGameStore((s) => s.results);
  const mode = useGameStore((s) => s.mode);
  const setScreen = useGameStore((s) => s.setScreen);
  const startRace = useGameStore((s) => s.startRace);
  const xpBreakdown = useProfileStore((s) => s.lastXpBreakdown);
  const newBadges = useProfileStore((s) => s.newBadges);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  // multi: geç bitiren oyuncuların süreleri geldikçe tabloyu tazele
  useEffect(() => {
    if (mode !== 'multi') return;
    return multiplayer.subscribe(() => bump());
  }, [mode]);

  let results: RacerResult[] = storedResults;
  if (mode === 'multi') {
    const own = storedResults.find((r) => r.isPlayer);
    if (own) {
      results = [
        own,
        ...[...multiplayer.players.values()].map((p) => ({
          name: p.name,
          carId: p.carId,
          time: p.finished ? p.finishTime : -1,
          isPlayer: false,
        })),
      ].sort((a, b) => (a.time < 0 ? 1 : b.time < 0 ? -1 : a.time - b.time));
    }
  }

  const best = lapTimes.length ? Math.min(...lapTimes) : 0;
  const playerPos = results.findIndex((r) => r.isPlayer) + 1;
  const medal = playerPos === 1 ? '🥇' : playerPos === 2 ? '🥈' : playerPos === 3 ? '🥉' : '🏁';

  return (
    <div className="screen results-screen">
      <h2>
        {medal} {playerPos}. SIRADA BİTİRDİN
      </h2>

      <div className="results-columns">
        <div>
          <h3 className="section-title">SIRALAMA</h3>
          <table className="results-table">
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={r.isPlayer ? 'player-row' : ''}>
                  <td>{i + 1}.</td>
                  <td>{r.name}</td>
                  <td className="dim">{getCar(r.carId).name}</td>
                  <td>{r.time < 0 ? '—' : formatTime(r.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="section-title">TURLARIN</h3>
          <table className="results-table">
            <tbody>
              {lapTimes.map((t, i) => (
                <tr key={i} className={t === best ? 'best-lap' : ''}>
                  <td>Tur {i + 1}</td>
                  <td>{formatTime(t)}</td>
                  <td>{t === best ? '★' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {xpBreakdown && (
            <div className="xp-breakdown">
              <h3 className="section-title">KAZANILAN XP</h3>
              <div className="xp-row">
                <span>Yarışı bitirme</span>
                <b>+{xpBreakdown.finish}</b>
              </div>
              <div className="xp-row">
                <span>Sıralama</span>
                <b>+{xpBreakdown.position}</b>
              </div>
              <div className="xp-row">
                <span>Drift puanı</span>
                <b>+{xpBreakdown.drift}</b>
              </div>
              {xpBreakdown.cleanBonus > 0 && (
                <div className="xp-row">
                  <span>Temiz yarış</span>
                  <b>+{xpBreakdown.cleanBonus}</b>
                </div>
              )}
              <div className="xp-row total">
                <span>TOPLAM</span>
                <b>+{xpBreakdown.total} XP</b>
              </div>
            </div>
          )}
        </div>
      </div>

      {newBadges.length > 0 && (
        <div className="new-badges">
          {newBadges.map((id) => {
            const b = BADGES.find((x) => x.id === id)!;
            return (
              <div key={id} className="new-badge">
                {b.icon} <b>{b.name}</b> rozeti kazanıldı!
              </div>
            );
          })}
        </div>
      )}

      <div className="results-actions">
        {mode === 'solo' ? (
          <button className="primary-btn" onClick={startRace}>
            TEKRAR YARIŞ
          </button>
        ) : (
          <button
            className="primary-btn"
            onClick={() => {
              // raceStart temizlenmezse lobi aynı yarışı anında yeniden başlatıyordu
              multiplayer.returnToLobby();
              setScreen('multiplayer');
            }}
          >
            LOBİYE DÖN
          </button>
        )}
        <button
          className="secondary-btn"
          onClick={() => {
            if (mode === 'multi') multiplayer.leaveRoom();
            setScreen('menu');
          }}
        >
          ANA MENÜ
        </button>
      </div>
    </div>
  );
}
