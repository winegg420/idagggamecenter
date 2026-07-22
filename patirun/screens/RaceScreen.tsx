import { useEffect, useMemo, useRef, useState } from 'react';
import { RaceEngine } from '../game/engine';
import { getTrack2D } from '../game/track2d/track2d';
import { getMap2D } from '../game/track2d/maps2d';
import { GameCanvas2D, COUNTDOWN_SECONDS } from '../components/GameCanvas2D';
import type { RunnerVisual2D } from '../render2d/raceRenderer';
import { usePlayerInput } from '../game/useInput';
import { GameButtons } from '../components/GameButtons';
import { RotateOverlay } from '../components/RotateOverlay';
import { HUD } from '../components/HUD';
import { useAppStore } from '../stores/appStore';
import { useRaceStore } from '../stores/raceStore';
import { useAuthStore } from '../stores/authStore';
import { buildResults } from '../services/buildResults';
import { RaceIntro } from '../components/RaceIntro';
import { BotController, BOT_NAMES } from '../game/bots/botAI';
import { SECRETS } from '../config/constants';
import { pickBotCharacters, useCharacterStore } from '../stores/characterStore';
import { GLOW_LEVEL, xpForRace } from '../game/characters/characters';
import { processRaceResult, loadBestTime } from '../services/raceResults';
import { GhostRecorder, GhostPlayer } from '../game/ghost';
import { useStatsStore } from '../stores/statsStore';
import { sound } from '../lib/sound';

const PLAYER_ID = 'player';

export function RaceScreen() {
  const mapId = useAppStore((s) => s.mapId);
  const timeOfDay = useAppStore((s) => s.timeOfDay);
  const botDifficulty = useAppStore((s) => s.botDifficulty);
  const botCount = useAppStore((s) => s.botCount);
  const raceNonce = useAppStore((s) => s.raceNonce);
  const setScreen = useAppStore((s) => s.setScreen);
  const username = useAuthStore((s) => s.user?.username) ?? 'Sen';
  const { pressJump, setDuck, consume } = usePlayerInput();
  const [introDone, setIntroDone] = useState(false);
  const finalized = useRef(false);

  const { engine, bots, botNames } = useMemo(() => {
    const track = getTrack2D(getMap2D(mapId));
    const e = new RaceEngine(track, COUNTDOWN_SECONDS);
    e.shortcutOpen = Math.random() < SECRETS.SHORTCUT_CHANCE;
    e.addRunner(PLAYER_ID, 0);

    const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const controllers: BotController[] = [];
    const names = new Map<string, string>([[PLAYER_ID, username]]);
    for (let i = 0; i < botCount; i++) {
      const id = `bot-${i}`;
      const bot = new BotController(id, botDifficulty);
      const runner = e.addRunner(id, 0);
      runner.speedFactor = bot.speedFactor;
      controllers.push(bot);
      names.set(id, shuffled[i % shuffled.length]);
    }
    return { engine: e, bots: controllers, botNames: names };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, botCount, botDifficulty, raceNonce]);

  const recorder = useMemo(() => new GhostRecorder(), [raceNonce, mapId]);

  // Hayalet: SADECE hayalet yarış modunda görünür (normal maçta kafa karıştırmasın)
  const ghostRace = useAppStore((s) => s.ghostRace);
  const ghost = useMemo(() => {
    if (!ghostRace) return null;
    const best = loadBestTime(mapId);
    const gp = best?.ghost ? new GhostPlayer(best.ghost) : null;
    return gp?.valid ? gp : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, raceNonce, ghostRace]);

  const runnerVisuals: RunnerVisual2D[] = useMemo(() => {
    const cs = useCharacterStore.getState();
    const botChars = pickBotCharacters(bots.length, cs.selectedId);
    return [
      {
        id: PLAYER_ID,
        characterId: cs.selectedId,
        cosmetics: cs.cosmeticsOf(cs.selectedId),
        glow: cs.levelOf(cs.selectedId) >= GLOW_LEVEL,
        name: username,
      },
      ...bots.map((b, i) => ({
        id: b.id,
        characterId: botChars[i],
        name: botNames.get(b.id) ?? 'Bot',
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots]);

  useEffect(() => {
    useRaceStore.getState().reset();
    finalized.current = false;
  }, [engine]);

  // Yarış bitince (foto-finiş kaldırıldı) doğrudan sonuçları işle
  const phase = useRaceStore((s) => s.phase);
  useEffect(() => {
    const player = engine.runners.get(PLAYER_ID);
    const playerDone = player?.finished || player?.disqualified;
    if (phase === 'finished' || playerDone) finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, engine]);

  // Sonuçları işle, podyuma geç
  const finalize = () => {
    if (finalized.current) return;
    finalized.current = true;
    const n = engine.runners.size;
    const { results, categories } = buildResults(engine, botNames);
    useRaceStore.getState().set({ results, categories, replayActive: false, wasMultiplayer: false });
    const playerRow = results.find((r) => r.id === PLAYER_ID);
    if (playerRow) {
      const cs = useCharacterStore.getState();
      const userId = useAuthStore.getState().user?.id;
      let xpGained = 0;
      if (!playerRow.disqualified) {
        xpGained = xpForRace(playerRow.rank, n);
        void cs.addRaceXp(cs.selectedId, playerRow.rank, n, userId);
      }
      void processRaceResult({
        engine,
        playerId: PLAYER_ID,
        userId,
        mapId,
        mode: 'tekli',
        characterId: cs.selectedId,
        night: timeOfDay === 'gece',
        rank: playerRow.rank,
        playerCount: n,
        finishTime: playerRow.finishTime,
        disqualified: playerRow.disqualified,
        ghostData: recorder.serialize(),
      }).then((meta) => {
        useRaceStore.getState().set({ meta: { ...meta, xpGained } });
      });
    }
    setScreen('podium');
  };

  return (
    <div className="race-screen">
      {!introDone && <RaceIntro onDone={() => setIntroDone(true)} />}
      {introDone && (
        <GameCanvas2D
          engine={engine}
          playerId={PLAYER_ID}
          runners={runnerVisuals}
          consumeInput={consume}
          timeOfDay={timeOfDay}
          ghost={ghost}
          pauseWhenPortrait
          updateInputs={(e, dt) => {
            for (const bot of bots) e.setInput(bot.id, bot.update(e, dt));
            // Hayalet kaydı (5 Hz — GhostRecorder kendisi seyreltir)
            const me = e.runners.get(PLAYER_ID);
            if (me && e.phase === 'racing' && !me.finished) {
              recorder.record(e.time, me.s, me.x, me.y);
            }
          }}
        />
      )}
      <GameButtons onJump={pressJump} onDuck={setDuck} />
      <RotateOverlay />
      <HUD
        onSkillUse={(targetId) => {
          const skill = engine.runners.get(PLAYER_ID)?.skill;
          if (engine.useSkill(PLAYER_ID, targetId) && skill) {
            useStatsStore.getState().addSkillUse(skill);
          } else if (skill) {
            // Kullanım o an mümkün değil (ör. sersemletilmişken) — sessiz kalma
            sound.blocked();
          }
        }}
      />
    </div>
  );
}
