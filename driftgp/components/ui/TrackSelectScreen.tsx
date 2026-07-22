// Pist seçimi + tur sayısı ayarı.

import { useGameStore } from '../../store/gameStore';
import { TRACK_DEFS } from '../../game/tracks';
import { launchRace } from '../../game/flow';

const THEME_ICONS: Record<string, string> = { city: '🌃', volcano: '🌋', coast: '🏖️', forest: '🌲', riviera: '⛵' };

export function TrackSelectScreen() {
  const trackId = useGameStore((s) => s.trackId);
  const totalLaps = useGameStore((s) => s.totalLaps);
  const configureRace = useGameStore((s) => s.configureRace);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="screen list-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen('menu')}>
          ←
        </button>
        <h2>PİST SEÇ</h2>
        <div className="lap-selector">
          TUR:
          {[2, 3, 5].map((n) => (
            <button
              key={n}
              className={`chip ${totalLaps === n ? 'active' : ''}`}
              onClick={() => configureRace({ totalLaps: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="card-grid tracks">
        {TRACK_DEFS.map((t) => (
          <button
            key={t.id}
            className={`track-card ${trackId === t.id ? 'selected' : ''}`}
            style={{ background: `linear-gradient(160deg, ${t.colors.sky}cc, ${t.colors.fog}66)` }}
            onClick={() => configureRace({ trackId: t.id })}
          >
            <div className="track-icon">{THEME_ICONS[t.theme]}</div>
            <div className="track-name">{t.name}</div>
            <div className="track-desc">{t.desc}</div>
            {t.night && <span className="badge-chip">GECE</span>}
          </button>
        ))}
      </div>
      <button
        className="primary-btn"
        onClick={() => {
          configureRace({ mode: 'solo' });
          launchRace();
        }}
      >
        YARIŞ →
      </button>
    </div>
  );
}
