// 2D oyun tuvali: rAF döngüsü — girdi → fizik → olaylar (ses/ağ) → çizim → HUD.
// Eski 3D RaceScene'in tüm oyun-akışı sorumluluklarını devralır.
import { useEffect, useRef } from 'react';
import type { GameEvent, RaceEngine } from '../game/engine';
import type { RunnerInput, TimeOfDay } from '../game/types';
import { RaceRenderer2D, type RunnerVisual2D, type RunnerDrawState } from '../render2d/raceRenderer';
import { preloadSprites } from '../render2d/characterSprites';
import { useRaceStore } from '../stores/raceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { RACE } from '../config/constants';
import { sound } from '../lib/sound';
import { getCharacter } from '../game/characters/characters';
import type { GhostPlayer } from '../game/ghost';

export const COUNTDOWN_SECONDS = RACE.START_LIGHTS * RACE.START_LIGHT_INTERVAL + 0.4;

/** Foto-finiş ayarları */
const REPLAY_WINDOW = 4;
const REPLAY_SPEED = 0.5;
const HISTORY_INTERVAL = 0.1;
const HISTORY_MAX = 80;

interface HistoryFrame {
  t: number;
  entries: [string, number, number, boolean][]; // id, s, y, ducking
}

interface GameCanvas2DProps {
  engine: RaceEngine;
  playerId: string;
  runners: RunnerVisual2D[];
  consumeInput: () => RunnerInput;
  timeOfDay: TimeOfDay;
  updateInputs?: (engine: RaceEngine, dt: number) => void;
  onEvents?: (events: GameEvent[], engine: RaceEngine) => void;
  ghost?: GhostPlayer | null;
  replay?: boolean;
  onReplayDone?: () => void;
  /** Dikey ekranda fiziği duraklat (tek kişilik — AFK diskalifiyeyi önler).
      Çok oyunculuda false: yarış herkes için akmaya devam eder. */
  pauseWhenPortrait?: boolean;
}

export function GameCanvas2D({
  engine,
  playerId,
  runners,
  consumeInput,
  timeOfDay,
  updateInputs,
  onEvents,
  ghost,
  replay = false,
  onReplayDone,
  pauseWhenPortrait = false,
}: GameCanvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const onReplayDoneRef = useRef(onReplayDone);
  onReplayDoneRef.current = onReplayDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    preloadSprites(runners.map((r) => ({ charId: r.characterId, cosmetics: r.cosmetics })));
    const renderer = new RaceRenderer2D(engine.track, runners);
    const night = timeOfDay === 'gece';
    const charOf = new Map(runners.map((r) => [r.id, r.characterId]));

    // Durum takipçileri
    let raf = 0;
    let lastTime = performance.now();
    let hudAccum = 0;
    let lastCheckpoints = 0;
    let prevLights = 0;
    let prevRank = 0;
    let prevGrounded = true;
    let prevSwimming = false;
    let prevPlayerFinished = false;
    let prevPhase = engine.phase;
    const history: HistoryFrame[] = [];
    let historyAccum = 0;
    let replayElapsed = 0;
    let replayDone = false;
    let fpsFrames = 0;
    let fpsTime = 0;

    // Boyutlandırma: kalite ayarına göre çözünürlük ölçeği
    const applySize = () => {
      const st = useSettingsStore.getState();
      const q = st.quality === 'otomatik' ? st.autoQuality : st.quality;
      const scale = q === 'dusuk' ? 0.7 : q === 'orta' ? 1 : Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(canvas.clientWidth * scale);
      canvas.height = Math.round(canvas.clientHeight * scale);
    };
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas);

    const nameOf = new Map(runners.map((r) => [r.id, r.name]));
    const nm = (id?: string) => (id ? nameOf.get(id) ?? '???' : '???');
    const pushFeed = useRaceStore.getState().pushFeed;

    const playEventSounds = (events: GameEvent[]) => {
      const vibrate = useSettingsStore.getState().vibrate;
      // İsabet onayı: SENİN saldırın tuttuysa (kare başına bir kez çınlar)
      let hitConfirmed = false;
      const confirmHit = (ev: GameEvent) => {
        if ('userId' in ev && ev.userId === playerId && !hitConfirmed) {
          hitConfirmed = true;
          sound.hitConfirm();
        }
      };
      for (const ev of events) {
        // Sağ üst isabet akışı: kim kime ne yaptı
        switch (ev.type) {
          case 'lightning':
            if (ev.targetId) pushFeed(`${nm(ev.userId)} ⚡ ${nm(ev.targetId)}`);
            break;
          case 'knockback':
            if (ev.targetId) pushFeed(`${nm(ev.userId)} 💥 ${nm(ev.targetId)}`);
            break;
          case 'miknatis':
            pushFeed(`${nm(ev.userId)} 🧲 herkesi çekti`);
            break;
          case 'golden':
            pushFeed(`${nm(ev.userId)} 👑 herkesi dondurdu`);
            break;
          case 'blocked':
            if (ev.targetId) pushFeed(`${nm(ev.targetId)} 🛡️ savuşturdu`);
            break;
          case 'obstacleHit':
            if (ev.trap && ev.by) pushFeed(`${nm(ev.by)} 🪤 ${nm(ev.userId)}`);
            break;
        }
        if (
          (ev.type === 'obstacleHit' && ev.userId === playerId) ||
          ('targetId' in ev && ev.targetId === playerId)
        ) {
          vibrate(ev.type === 'lightning' ? [80, 40, 80] : 60);
        }
        switch (ev.type) {
          case 'pickup':
            if (ev.userId === playerId) sound.pickup();
            break;
          case 'boost':
            if (ev.userId === playerId) sound.boost();
            renderer.addFx('boostOn', ev.userId);
            break;
          case 'shield':
            if (ev.userId === playerId) sound.shield();
            renderer.addFx('shieldOn', ev.userId);
            break;
          case 'obstacle':
            // Kapan kuruldu: metalik yay sesi + toprak halkası efekti
            if (ev.userId === playerId) sound.trapSet();
            renderer.addFx('trapSet', ev.userId);
            break;
          case 'lightning':
            sound.lightning();
            renderer.shake(10);
            confirmHit(ev);
            if (ev.targetId) renderer.lightningStrike(ev.targetId);
            if (ev.targetId === playerId) renderer.flash('255,230,80', 0.4);
            if (ev.targetId) sound.ouch(getCharacter(charOf.get(ev.targetId) ?? 'sloth').voicePitch);
            break;
          case 'knockback':
            sound.knockback();
            confirmHit(ev);
            if (ev.targetId) renderer.addFx('knockback', ev.targetId);
            if (ev.targetId === playerId) renderer.flash('255,60,60', 0.35);
            if (ev.targetId) sound.ouch(getCharacter(charOf.get(ev.targetId) ?? 'sloth').voicePitch);
            break;
          case 'miknatis':
            sound.magnet();
            renderer.shake(5);
            confirmHit(ev);
            renderer.addFx('magnet', ev.userId);
            if (ev.userId !== playerId) renderer.flash('130,80,220', 0.22);
            break;
          case 'golden':
            sound.golden();
            renderer.shake(6);
            confirmHit(ev);
            renderer.addFx('golden', ev.userId);
            renderer.flash('255,215,0', 0.3);
            break;
          case 'blocked':
            sound.blocked();
            // Savunanın kalkanı görünür şekilde parlar (savuşturma geri bildirimi)
            if (ev.targetId) renderer.addFx('shieldOn', ev.targetId);
            break;
          case 'obstacleHit':
            sound.ouch(getCharacter(charOf.get(ev.userId) ?? 'sloth').voicePitch);
            if (ev.stumble) {
              // Blok kutusuna takıldı: tökezleme animasyonu
              renderer.stumble(ev.userId);
              if (ev.userId === playerId) renderer.shake(5);
            }
            if (ev.trap) {
              // Kapan kapandı: metalik klik + ayakta kenetli kapan görseli
              sound.blocked();
              renderer.trapSnap(ev.userId);
              renderer.shake(6);
            }
            if (ev.userId === playerId) {
              renderer.shake(7);
              renderer.flash('255,60,60', 0.3);
            }
            break;
        }
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // FPS ölçümü → otomatik kalite
      fpsFrames += 1;
      fpsTime += dt;
      if (fpsTime >= 3) {
        const fps = fpsFrames / fpsTime;
        fpsFrames = 0;
        fpsTime = 0;
        const st = useSettingsStore.getState();
        const q = fps < 25 ? 'dusuk' : fps < 45 ? 'orta' : 'yuksek';
        if (q !== st.autoQuality) {
          st.setAutoQuality(q);
          applySize();
        }
      }

      // 0b) Dikey ekran duraklatması (tek kişilik): fizik akmaz, sahne çizilir
      const portraitPaused =
        pauseWhenPortrait && window.matchMedia('(orientation: portrait)').matches;

      // 1) Girdi + fizik
      if (!portraitPaused) {
        engine.setInput(playerId, consumeInput());
        updateInputs?.(engine, dt);
        engine.step(dt);
      } else {
        consumeInput(); // birikmiş zıplama isteği duraklatmada boşaltılır
      }

      // 2) Olaylar
      const events = engine.drainEvents();
      if (events.length > 0) {
        playEventSounds(events);
        onEvents?.(events, engine);
      }

      const all = [...engine.runners.values()];
      const player = engine.runners.get(playerId);

      // 3) Sesler: zıplama, su sıçraması, finiş, faz geçişleri
      if (player) {
        if (prevGrounded && !player.grounded && player.vy > 0) sound.jump();
        prevGrounded = player.grounded;
        const swimmingNow = engine.track.waterAt(player.s) && player.y < 0.5;
        if (swimmingNow && !prevSwimming) sound.splash();
        // Yunus fırlaması: sudan hızla çıkarken de sıçrama sesi
        if (!swimmingNow && prevSwimming && player.vy > 3) sound.splash();
        prevSwimming = swimmingNow;
        // Oyuncu finiş çizgisini GEÇTİĞİ an fanfar (yarışın bitmesini beklemez)
        if (player.finished && !prevPlayerFinished) sound.finish();
        prevPlayerFinished = player.finished;
      }
      if (prevPhase !== 'finished' && engine.phase === 'finished' && !prevPlayerFinished) {
        sound.finish();
      }
      if (prevPhase === 'countdown' && engine.phase === 'racing') sound.countdownBeep(true);
      prevPhase = engine.phase;

      // 4) Konum geçmişi (foto-finiş)
      historyAccum += dt;
      if (historyAccum >= HISTORY_INTERVAL && engine.phase === 'racing') {
        historyAccum = 0;
        history.push({ t: engine.time, entries: all.map((r) => [r.id, r.s, r.y, r.ducking]) });
        if (history.length > HISTORY_MAX) history.shift();
      }

      // 5) Çizim durumu hazırla (normal veya replay)
      let drawRunners: RunnerDrawState[];
      let camOverrideS: number | undefined;

      // Geri sayımda engine.time NEGATİF: efekt karşılaştırmaları 0 tabanına
      // kenetlenir, yoksa start'ta herkes kalkanlı/dumanlı görünür
      const tFx = Math.max(0.001, engine.time);
      const toDraw = (r: (typeof all)[number]): RunnerDrawState => ({
        id: r.id,
        s: r.s,
        y: r.y,
        ducking: r.ducking,
        grounded: r.grounded,
        swimming: engine.track.waterAt(r.s) && r.y < 0.5,
        moving: engine.phase === 'racing' && !r.finished && !r.disqualified && !r.disconnected,
        shield: tFx < r.effects.shieldUntil,
        frozen: tFx < r.effects.frozenUntil,
        stunned: tFx < r.effects.stunUntil,
        boost: tFx < r.effects.boostUntil,
        fried: tFx < r.effects.friedUntil,
        invuln: tFx < r.effects.invulnUntil,
        disconnected: r.disconnected,
        finished: r.finished,
      });

      if (replayRef.current && !replayDone && history.length >= 2) {
        replayElapsed += dt * REPLAY_SPEED;
        const endT = history[history.length - 1].t;
        const startT = Math.max(history[0].t, endT - REPLAY_WINDOW);
        const t = startT + replayElapsed;
        if (t >= endT) {
          replayDone = true;
          onReplayDoneRef.current?.();
          drawRunners = all.map(toDraw);
        } else {
          let hi = history.findIndex((f) => f.t >= t);
          if (hi <= 0) hi = 1;
          const a = history[hi - 1];
          const b = history[hi];
          const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
          const posA = new Map(a.entries.map((e) => [e[0], e]));
          drawRunners = b.entries.map(([id, s2, y2, duck2]) => {
            const pa = posA.get(id);
            const s = pa ? pa[1] + (s2 - pa[1]) * k : s2;
            const y = pa ? pa[2] + (y2 - pa[2]) * k : y2;
            if (id === playerId) camOverrideS = s;
            return {
              id,
              s,
              y,
              ducking: duck2,
              grounded: y <= 0.01,
              swimming: engine.track.waterAt(s) && y < 0.5,
              moving: true,
              shield: false,
              frozen: false,
              stunned: false,
              boost: false,
              fried: false,
              invuln: false,
              disconnected: false,
              finished: false,
            };
          });
        }
      } else {
        drawRunners = all.map(toDraw);
        if (replayRef.current && !replayDone && history.length < 2) {
          replayDone = true;
          onReplayDoneRef.current?.();
        }
      }

      // 6) Hayalet
      const gf = ghost?.valid ? ghost.sample(Math.max(0, engine.time)) : null;

      renderer.draw(ctx, canvas.width, canvas.height, {
        time: Math.max(0, engine.time),
        night,
        runners: drawRunners,
        followId: playerId,
        boxes: engine.boxes.map((b) => ({ s: b.s, y: b.y, visible: engine.time >= b.respawnAt })),
        placedObstacles: engine.obstacles
          .filter((o) => engine.time < o.expiresAt)
          .map((o) => ({ s: o.s })),
        shortcutOpen: engine.shortcutOpen,
        ghost: gf ? { s: gf.s, y: gf.y } : null,
        camOverrideS,
      });

      // 7) HUD senkronizasyonu (10 Hz)
      hudAccum += dt;
      if (hudAccum >= 0.1) {
        hudAccum = 0;
        const st = useRaceStore.getState();
        const litLights =
          engine.phase === 'countdown'
            ? Math.min(
                RACE.START_LIGHTS,
                1 + Math.floor((engine.time + COUNTDOWN_SECONDS) / RACE.START_LIGHT_INTERVAL),
              )
            : 0;
        const cp = player ? engine.track.checkpointsPassed(player.s) : 0;
        const patch: Parameters<typeof st.set>[0] = {
          phase: engine.phase,
          litLights,
          raceTime: Math.max(0, engine.time),
          rank: engine.rankOf(playerId),
          totalRunners: engine.runners.size,
          skill: player?.skill ?? null,
          // Üst ilerleme çubuğu (tür standardı: tüm yarışçılar görünür).
          // finished/dq bayrağını frac=1 ve name ile taşı (hedefleme filtreler).
          progress: all.map((r) => ({
            id: r.id,
            frac: r.finished || r.disqualified ? 1 : Math.min(0.999, r.s / engine.track.length),
            emoji: getCharacter(charOf.get(r.id) ?? 'sloth').emoji,
            me: r.id === playerId,
            name: nameOf.get(r.id) ?? '???',
          })),
        };
        if (cp > lastCheckpoints) {
          lastCheckpoints = cp;
          patch.checkpointFlash = cp;
          sound.checkpoint();
        }
        if (litLights !== prevLights) {
          if (litLights > 0) sound.countdownBeep(false);
          prevLights = litLights;
        }
        // Sıra değişimi geri bildirimi (geçme/geçilme anı hissedilsin)
        const rank = patch.rank ?? 0;
        if (engine.phase === 'racing' && prevRank !== 0 && rank !== prevRank) {
          if (rank < prevRank) sound.pickup();
          else sound.blocked();
        }
        prevRank = rank;
        st.set(patch);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // Motor değişince döngü sıfırdan kurulur — bilinçli bağımlılık listesi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  return <canvas ref={canvasRef} className="game-canvas" />;
}
