import { useRef, useState } from 'react';
import { useRaceStore } from '../stores/raceStore';
import { RACE } from '../config/constants';
import { SKILL_INFO } from '../game/skills/skillInfo';

function formatTime(t: number): string {
  const m = Math.floor(Math.max(0, t) / 60);
  const s = Math.max(0, t) % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

interface HUDProps {
  /** targetId verilirse tek hedefli skill o oyuncuya atılır */
  onSkillUse: (targetId?: string) => void;
}

/** Parmağın yatay kaymasını hedef diziliminde bir indekse çevirir (~46px = 1 kişi) */
const SLOT_PX = 46;

export function HUD({ onSkillUse }: HUDProps) {
  const phase = useRaceStore((st) => st.phase);
  const litLights = useRaceStore((st) => st.litLights);
  const raceTime = useRaceStore((st) => st.raceTime);
  const rank = useRaceStore((st) => st.rank);
  const total = useRaceStore((st) => st.totalRunners);
  const skill = useRaceStore((st) => st.skill);
  const checkpointFlash = useRaceStore((st) => st.checkpointFlash);
  const progress = useRaceStore((st) => st.progress);
  const feed = useRaceStore((st) => st.feed);

  // Hedefleme durumu (tek hedefli skill'de basılı tut + kaydır)
  const [targets, setTargets] = useState<{ id: string; emoji: string; name: string }[]>([]);
  const [selIdx, setSelIdx] = useState(0);
  const startX = useRef(0);
  const baseIdx = useRef(0);
  const targetingRef = useRef(false);

  const isTargeted = skill ? SKILL_INFO[skill].targeted === true : false;

  /** Hedef listesi: bendersiz, bitirmemiş rakipler; öndekiler solda (lider→son) */
  const buildTargets = () => {
    const me = progress.find((p) => p.me);
    const others = progress
      .filter((p) => !p.me && p.frac < 1)
      .sort((a, b) => b.frac - a.frac);
    // Varsayılan seçim: öndeki en yakın; yoksa arkadaki en yakın (auto ile aynı)
    let defIdx = 0;
    if (me) {
      const ahead = others.filter((o) => o.frac > me.frac);
      if (ahead.length > 0) {
        const nearest = ahead[ahead.length - 1]; // öndekilerin en yakını (en küçük fark)
        defIdx = others.indexOf(nearest);
      } else {
        const behind = others.filter((o) => o.frac <= me.frac);
        if (behind.length > 0) defIdx = others.indexOf(behind[0]);
      }
    }
    return { others, defIdx };
  };

  const onSkillDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!skill) return;
    if (isTargeted) {
      const { others, defIdx } = buildTargets();
      if (others.length === 0) {
        onSkillUse(); // hedef yok — otomatik
        return;
      }
      targetingRef.current = true;
      startX.current = e.clientX;
      baseIdx.current = defIdx;
      setTargets(others.map((o) => ({ id: o.id, emoji: o.emoji, name: o.name })));
      setSelIdx(defIdx);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // pointer capture desteklenmezse kaydırma yine çalışır
      }
    } else {
      onSkillUse(); // tek dokunuşla anında (hız/kalkan/kapan/mıknatıs/altın)
    }
  };

  const onSkillMove = (e: React.PointerEvent) => {
    if (!targetingRef.current) return;
    const dx = e.clientX - startX.current;
    const idx = Math.max(
      0,
      Math.min(targets.length - 1, baseIdx.current + Math.round(dx / SLOT_PX)),
    );
    if (idx !== selIdx) setSelIdx(idx);
  };

  const finishTargeting = (fire: boolean) => {
    if (!targetingRef.current) return;
    targetingRef.current = false;
    const chosen = targets[selIdx];
    setTargets([]);
    if (fire && chosen) onSkillUse(chosen.id);
  };

  return (
    <div className="hud">
      {/* Üst bilgi çubuğu */}
      <div className="hud-top">
        <div className="hud-chip">{formatTime(raceTime)}</div>
        <div className="hud-chip hud-rank" key={rank}>
          {rank}./{total}
        </div>
      </div>

      {/* Skill isabet akışı (sağ üst): kim kime ne yaptı */}
      {feed.length > 0 && (
        <div className="skill-feed">
          {feed.map((f) => (
            <div key={f.key} className="skill-feed-row">
              {f.text}
            </div>
          ))}
        </div>
      )}

      {/* Yarışçı ilerleme çubuğu (tür standardı) */}
      {phase === 'racing' && progress.length > 1 && (
        <div className="progress-track">
          {progress.map((p) => (
            <span
              key={p.id}
              className={`progress-dot ${p.me ? 'me' : ''}`}
              style={{ left: `${p.frac * 100}%` }}
            >
              {p.emoji}
            </span>
          ))}
          <span className="progress-finish">🏁</span>
        </div>
      )}

      {/* F1 start ışıkları */}
      {phase === 'countdown' && (
        <div className="start-lights">
          {Array.from({ length: RACE.START_LIGHTS }, (_, i) => (
            <div key={i} className={`start-light ${i < litLights ? 'lit' : ''}`} />
          ))}
        </div>
      )}
      {phase === 'racing' && raceTime < 1.2 && <div className="go-text">BAŞLA!</div>}

      {/* Checkpoint sıra bildirimi */}
      {checkpointFlash > 0 && (
        <div className="checkpoint-flash" key={checkpointFlash}>
          {rank}./{total}
        </div>
      )}

      {/* Hedef seçici (tek hedefli skill basılı tutulurken) */}
      {targets.length > 0 && (
        <div className="target-picker">
          <div className="target-picker-hint">Kaydır → hedef seç</div>
          <div className="target-picker-row">
            {targets.map((t, i) => (
              <div key={t.id} className={`target-chip ${i === selIdx ? 'sel' : ''}`}>
                <span className="target-chip-emoji">{t.emoji}</span>
                <span className="target-chip-name">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill butonu (sol alt) */}
      <button
        className={`skill-button ${skill ? 'ready' : ''} ${targets.length > 0 ? 'aiming' : ''}`}
        onPointerDown={onSkillDown}
        onPointerMove={onSkillMove}
        onPointerUp={(e) => {
          e.stopPropagation();
          finishTargeting(true);
        }}
        onPointerCancel={() => finishTargeting(false)}
        aria-label="Skill kullan"
      >
        {skill ? SKILL_INFO[skill].emoji : '·'}
      </button>
    </div>
  );
}
