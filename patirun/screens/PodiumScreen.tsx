// Podyum töreni (2D): ilk 3 podyumda, CSS konfeti, kazanan dans eder.
// Podyumdaki oyuncu HAREKET MENÜSÜNDEN seçim yapabilir (dans/hava at/selam/kahkaha).
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useRaceStore } from '../stores/raceStore';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { useCharacterStore } from '../stores/characterStore';
import { characterDataUri, type Pose } from '../render2d/characterSprites';
import { sound } from '../lib/sound';

const CONFETTI_COLORS = ['#e63946', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffbe0b'];

type MoveId = 'dans' | 'havaat' | 'selam' | 'kahkaha' | 'helikopter' | 'takla' | 'uyku';

/**
 * 7 hareket — her biri GERÇEKTEN farklı: kendine özel vücut pozu (sprite
 * düzeyinde: wave/flex/laugh) ve/veya kendine özel CSS animasyonu.
 * bubble: ifade türü hareketlerde karakterin yanında çıkan konuşma balonu.
 */
const MOVES: {
  id: MoveId;
  emoji: string;
  label: string;
  chat: string;
  css: string;
  poses: Pose[];
  speed: number;
  bubble: string | null;
}[] = [
  { id: 'dans', emoji: '💃', label: 'Dans', chat: 'Zafer dansı! 💃', css: 'dancing', poses: ['run1', 'air', 'run2', 'duck'], speed: 150, bubble: null },
  { id: 'havaat', emoji: '💪', label: 'Hava At', chat: 'Görüşürüz podyumda demiştim! 😏', css: 'taunting', poses: ['flex', 'idle'], speed: 320, bubble: '😏' },
  { id: 'selam', emoji: '👋', label: 'Selam', chat: 'İyi yarıştı millet! 👋', css: 'waving', poses: ['wave'], speed: 400, bubble: '👋' },
  { id: 'kahkaha', emoji: '🤣', label: 'Kahkaha', chat: 'HAHAHA 🤣', css: 'laughing', poses: ['laugh'], speed: 400, bubble: '🤣' },
  { id: 'helikopter', emoji: '🚁', label: 'Helikopter', chat: 'Pervane modu açık! 🚁', css: 'helicopter', poses: ['air'], speed: 400, bubble: null },
  { id: 'takla', emoji: '🤸', label: 'Takla', chat: 'Takla şov! 🤸', css: 'flipping', poses: ['air'], speed: 400, bubble: null },
  { id: 'uyku', emoji: '😴', label: 'Uyku', chat: 'Bu yarış beni yordu... 😴', css: 'sleeping', poses: ['idle'], speed: 400, bubble: '💤' },
];

function PodiumSprite({
  charId,
  cosmetics,
  move,
  isWinner,
}: {
  charId: string;
  cosmetics?: import('../game/characters/characters').CosmeticConfig;
  move: MoveId | null;
  isWinner: boolean;
}) {
  const [frame, setFrame] = useState(0);
  const active = move ? MOVES.find((m) => m.id === move)! : null;
  // Hareket yoksa: kazanan hafifçe zıplar (dans DEĞİL — seçilen hareket ayırt edilsin)
  const poses: Pose[] = active ? active.poses : isWinner ? ['idle', 'run1'] : ['idle'];
  const speed = active ? active.speed : 320;
  useEffect(() => {
    setFrame(0);
    if (poses.length <= 1) return;
    const t = window.setInterval(() => setFrame((f) => f + 1), speed);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move, isWinner]);
  const css = active ? active.css : isWinner ? 'winner-bounce' : '';
  return (
    <div className="podium-sprite-wrap">
      <img
        className={`podium-char ${css}`}
        src={characterDataUri(charId, cosmetics, poses[frame % poses.length])}
        alt=""
      />
      {active?.bubble && <span className="podium-bubble">{active.bubble}</span>}
    </div>
  );
}

export function PodiumScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const results = useRaceStore((s) => s.results);
  const user = useAuthStore((s) => s.user);
  const client = useRoomStore((s) => s.client);
  const [myMove, setMyMove] = useState<MoveId | null>(null);

  const top3 = results.filter((r) => !r.disqualified).slice(0, 3);
  const winner = top3[0];
  const isSelf = (id: string) => id === 'player' || id === user?.id;
  const selfOnPodium = top3.some((r) => isSelf(r.id));

  const charFor = (id: string, index: number): string => {
    if (isSelf(id)) return useCharacterStore.getState().selectedId;
    const roomChar = useRoomStore.getState().players.find((p) => p.id === id)?.character;
    if (roomChar) return roomChar;
    const all = ['penguen', 'tavsan', 'kedi', 'tilki', 'kurbaga'];
    return all[index % all.length];
  };

  const doMove = (m: (typeof MOVES)[number]) => {
    setMyMove(m.id);
    sound.click();
    if (m.id === 'havaat') sound.golden();
    if (m.id === 'helikopter') sound.helicopter(); // özgün pervane sesi
    client?.sendChat({ u: client.username, kind: 'quick', body: m.chat, t: Date.now() });
    // 4 sn oynasın — hareket rahatça izlenebilsin (2.6 sn çok kısaydı)
    window.setTimeout(() => setMyMove(null), 4000);
  };

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.4 + Math.random() * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * 360,
      })),
    [],
  );

  // Podyum sırası görsel düzeni: 2. — 1. — 3.
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = { 0: 110, 1: 64, 2: 46 } as Record<number, number>;

  return (
    <div className="screen podium-screen2d">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            background: c.color,
            transform: `rotate(${c.rot}deg)`,
          }}
        />
      ))}

      <h2 className="podium-title">🏆 {winner ? `${winner.name} kazandı!` : 'Yarış Bitti'}</h2>

      <div className="podium-row">
        {order.map((r) => {
          const rankIdx = top3.indexOf(r);
          return (
            <div key={r.id} className="podium-spot">
              <PodiumSprite
                charId={charFor(r.id, rankIdx)}
                cosmetics={
                  isSelf(r.id)
                    ? useCharacterStore.getState().cosmeticsOf(useCharacterStore.getState().selectedId)
                    : undefined
                }
                move={isSelf(r.id) ? myMove : null}
                isWinner={rankIdx === 0}
              />
              <div
                className={`podium-block rank-${rankIdx + 1}`}
                style={{ height: heights[rankIdx === 0 ? 0 : rankIdx === 1 ? 1 : 2] }}
              >
                {['🥇', '🥈', '🥉'][rankIdx]}
              </div>
              <span className="podium-name">{r.name}</span>
            </div>
          );
        })}
      </div>

      {/* Hareket menüsü: podyumdaysan istediğin hareketi seç */}
      {selfOnPodium && (
        <div className="move-menu">
          {MOVES.map((m) => (
            <button
              key={m.id}
              className={`btn small ${myMove === m.id ? 'voted' : ''}`}
              onClick={() => doMove(m)}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="menu-row podium-actions">
        <button className="btn primary" onClick={() => setScreen('results')}>
          Sonuçlar →
        </button>
      </div>
    </div>
  );
}
