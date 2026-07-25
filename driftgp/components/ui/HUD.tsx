// Yarış içi arayüz: hız, tur, süre, nitro barı ve dokunmatik kontroller.

import { useEffect } from 'react';
import { useGameStore, formatTime } from '../../store/gameStore';
import { useGarageStore } from '../../store/garageStore';
import { inputManager } from '../../game/input';
import { audio } from '../../game/audio';
import { getCar } from '../../game/cars';
import { DAMAGE_SMOKE, DAMAGE_FIRE } from '../../game/carPhysics';
import { Minimap } from './Minimap';

/** Yarış aksiyonu görsel efektleri — hız çizgileri, nitro boost, çarpışma flaşı. */
function RaceFx() {
  const speed = useGameStore((s) => s.speedKmh);
  const boosting = useGameStore((s) => s.boosting);
  const crashFx = useGameStore((s) => s.crashFx);
  const speedInt = Math.max(0, Math.min(1, (speed - 120) / 220));
  const lineOpacity = Math.min(0.6, speedInt * 0.55 + (boosting ? 0.3 : 0));
  return (
    <>
      <div className={`fx-speedlines ${boosting ? 'boost' : ''}`} style={{ opacity: lineOpacity }} />
      {boosting && <div className="fx-boost" />}
      {crashFx > 0 && <div key={crashFx} className="fx-crash" />}
    </>
  );
}

function TouchButton({
  className,
  label,
  onHold,
}: {
  className: string;
  label: string;
  onHold: (v: boolean) => void;
}) {
  return (
    <button
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export function HUD() {
  const speedKmh = useGameStore((s) => s.speedKmh);
  const gear = useGameStore((s) => s.gear);
  const lap = useGameStore((s) => s.lap);
  const totalLaps = useGameStore((s) => s.totalLaps);
  const raceTime = useGameStore((s) => s.raceTime);
  const nitroEnergy = useGameStore((s) => s.nitroEnergy);
  const drifting = useGameStore((s) => s.drifting);
  const damage = useGameStore((s) => s.damage);
  const position = useGameStore((s) => s.position);
  const racerCount = useGameStore((s) => s.racerCount);
  const assist = useGameStore((s) => s.assist);
  const dashTheme = useGarageStore((s) => s.getCustomization(s.selectedCarId).dashTheme);
  const hasSiren = getCar(useGarageStore.getState().selectedCarId).hasSiren;
  const setPaused = useGameStore((s) => s.setPaused);
  const paused = useGameStore((s) => s.paused);

  // Escape → duraklatma menüsü (masaüstü)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useGameStore.getState().paused) setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaused]);

  return (
    <div className={`hud ${dashTheme === 1 ? 'hud-neon' : ''} hud-buttons`}>
      <div className="hud-top">
        <div className="hud-position">
          <span>{position}</span>/{racerCount}
        </div>
        <div className="hud-lap">
          TUR <span>{lap}</span>/{totalLaps}
        </div>
        <div className="hud-time">{formatTime(raceTime)}</div>
        <button className="icon-btn hud-pause-btn" onClick={() => setPaused(!paused)} aria-label="Duraklat">
          ⏸
        </button>
      </div>
      {hasSiren && (
        <button className="icon-btn siren-btn" onClick={() => audio.toggleSiren()}>
          🚨
        </button>
      )}

      <div className="hud-speed">
        <span className="hud-speed-value">{speedKmh}</span>
        <span className="hud-speed-unit">km/s</span>
        <span className="hud-gear">{gear}</span>
      </div>

      <div className={`hud-nitro-bar ${assist > 0.15 ? 'yetisme' : ''}`}>
        <div className="hud-nitro-fill" style={{ width: `${Math.round(nitroEnergy * 100)}%` }} />
        <span className="hud-nitro-label">NİTRO</span>
      </div>

      {/* yetişme sistemi: geride kalınca motor yardımı + hızlı nitro dolumu devrede */}
      {assist > 0.15 && (
        <div className="hud-catchup">
          ⚡ YETİŞME <span>%{Math.round(assist * 100)}</span>
        </div>
      )}

      {/* hasar göstergesi — hasar alınca belirir; sarı→turuncu→kırmızı, yangında yanıp söner */}
      {damage > 0.05 && (
        <div className={`hud-damage-bar ${damage >= DAMAGE_FIRE ? 'burning' : ''}`}>
          <div
            className="hud-damage-fill"
            style={{
              width: `${Math.round(damage * 100)}%`,
              background: damage >= 0.6 ? '#ff2418' : damage >= DAMAGE_SMOKE ? '#ff7a1a' : '#ffd028',
            }}
          />
          <span className="hud-damage-label">{damage >= DAMAGE_FIRE ? '🔥 HASAR' : 'HASAR'}</span>
        </div>
      )}

      {drifting && <div className="hud-drift-indicator">DRIFT!</div>}

      <RaceFx />
      <Minimap />

      {/* sol taraf: yön butonları — her zaman görünür (gyro ile birlikte kullanılabilir) */}
      <div className="steer-cluster">
        <TouchButton className="btn-steer btn-left" label="◀" onHold={(v) => inputManager.setTouchSteer(v ? -1 : 0)} />
        <TouchButton className="btn-steer btn-right" label="▶" onHold={(v) => inputManager.setTouchSteer(v ? 1 : 0)} />
      </div>

      <TouchButton className="btn-brake" label="FREN" onHold={(v) => inputManager.setTouchBrake(v)} />
      <TouchButton className="btn-nitro" label="⚡" onHold={(v) => inputManager.setTouchNitro(v)} />
      <TouchButton className="btn-drift" label="DRIFT" onHold={(v) => inputManager.setTouchDrift(v)} />
    </div>
  );
}
