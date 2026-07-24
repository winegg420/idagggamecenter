// Çok oyunculu yarış: yerel oyuncu client-side prediction ile anında tepki verir,
// uzak oyuncular entity interpolation ile yumuşak çizilir, skill'ler broadcast edilir.
import { useEffect, useMemo, useRef } from 'react';
import { RaceEngine } from '../game/engine';
import { getTrack2D } from '../game/track2d/track2d';
import { getMap2D } from '../game/track2d/maps2d';
import { GameCanvas2D } from '../components/GameCanvas2D';
import type { RunnerVisual2D } from '../render2d/raceRenderer';
import { usePlayerInput } from '../game/useInput';
import { GameButtons } from '../components/GameButtons';
import { RotateOverlay } from '../components/RotateOverlay';
import { HUD } from '../components/HUD';
import { useAppStore } from '../stores/appStore';
import { useRaceStore } from '../stores/raceStore';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { buildResults } from '../services/buildResults';
import { RaceIntro } from '../components/RaceIntro';
import { InterpolationBuffer } from '../net/interpolation';
import { packPos, effectFlags, EFFECT_FLAGS, hasFlag } from '../net/protocol';
import { applySkill } from '../game/skills/skillSystem';
import { useCharacterStore } from '../stores/characterStore';
import { xpForRace } from '../game/characters/characters';
import { processRaceResult } from '../services/raceResults';
import { useStatsStore } from '../stores/statsStore';
import { sound } from '../lib/sound';
import { BotController } from '../game/bots/botAI';

export function MpRaceScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const selfId = useAuthStore((s) => s.user?.id) ?? 'unknown';
  const { client, players, startMsg, status } = useRoomStore();
  const { pressJump, setDuck, consume } = usePlayerInput();
  const finalized = useRef(false);
  /** Yerel oyuncu bitince stragglerlar için bekleme sayacı (ağ mesajı düşse
      bile sonuç ekranına geçilir — "maç sonuna geçemedi" kilidini önler) */
  const graceTimer = useRef<number | null>(null);

  const setup = useMemo(() => {
    if (!client || !startMsg) return null;
    const track = getTrack2D(getMap2D(startMsg.map));
    // Geri sayım, host saatiyle DEĞİL "mesajda kalan süre + yerelde geçen süre"
    // ile hesaplanır → cihaz saatleri farklı olsa da herkes aynı anda başlar.
    const kalanMs =
      startMsg.t0 != null && startMsg.recvAt != null
        ? startMsg.startAt - startMsg.t0 - (Date.now() - startMsg.recvAt)
        : startMsg.startAt - Date.now();
    const countdown = Math.max(0.5, kalanMs / 1000);
    const engine = new RaceEngine(track, countdown);
    engine.shortcutOpen = startMsg.shortcutOpen;
    const buffers = new Map<string, InterpolationBuffer>();
    const names = new Map<string, string>();

    const roster = players.length > 0 ? players : [];
    roster.forEach((p) => {
      engine.addRunner(p.id, startMsg.gridX[p.id] ?? 0);
      names.set(p.id, p.username);
      if (p.id !== selfId) {
        engine.remoteIds.add(p.id);
        buffers.set(p.id, new InterpolationBuffer());
      }
    });
    if (!engine.runners.has(selfId)) engine.addRunner(selfId, 0);

    // Dolgu botları (hızlı maç): host fizik+AI yürütür, diğerleri uzak sayar
    const botControllers: BotController[] = [];
    for (const b of startMsg.bots ?? []) {
      const runner = engine.addRunner(b.id, startMsg.gridX[b.id] ?? 0);
      names.set(b.id, b.name);
      if (client.isHost) {
        const ctrl = new BotController(b.id, 'orta');
        runner.speedFactor = ctrl.speedFactor;
        botControllers.push(ctrl);
      } else {
        engine.remoteIds.add(b.id);
        buffers.set(b.id, new InterpolationBuffer());
      }
    }
    return { engine, buffers, names, botControllers };
    // Kadro yarış başlarken sabitlenir — bilinçli olarak yeniden kurulmaz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, startMsg, selfId]);

  const engine = setup?.engine ?? null;

  // --- Senkron start: herkes sahnesini yükleyince host GO yayınlar ---
  const readyIds = useRef<Set<string>>(new Set());
  const goSent = useRef(false);
  const goApplied = useRef(false);
  const playersRef = useRef(players);
  playersRef.current = players;

  /** Kalan süreye göre geri sayımı yeniden hizala (herkes aynı ana kilitlenir). */
  const hizala = (kalanMs: number) => {
    if (!engine || engine.phase !== 'countdown' || goApplied.current) return;
    goApplied.current = true;
    engine.time = -Math.max(0.4, kalanMs / 1000);
  };

  const gonderGo = () => {
    if (!client?.isHost || goSent.current) return;
    goSent.current = true;
    const t0 = Date.now();
    const goAt = t0 + 3200; // 3 ışıklı geri sayım + yayın payı
    client.sendGo({ t0, goAt });
    hizala(goAt - t0);
  };

  const herkesHazirsaBaslat = () => {
    if (!client?.isHost || goSent.current) return;
    for (const p of playersRef.current) {
      if (!readyIds.current.has(p.id)) return; // hâlâ yükleniyor
    }
    gonderGo();
  };

  // Ağ olayları → motor
  useEffect(() => {
    if (!client || !engine || !setup) return;
    client.setCallbacks({
      onReady: (msg) => {
        readyIds.current.add(msg.u);
        herkesHazirsaBaslat();
      },
      onGo: (msg) => {
        // Öncelik: host saatine kalibre edildiyse GO epoch'unu yerel saate çevir
        // → mesajın tek yönlü ağ gecikmesinden bağımsız, gerçek senkron start.
        // Kalibre edilmediyse (ping yanıtsız) eski göreli yönteme düş.
        if (client.clockSynced) {
          hizala(client.hostToLocal(msg.goAt) - Date.now());
        } else {
          const gecen = msg.recvAt != null ? Date.now() - msg.recvAt : 0;
          hizala(msg.goAt - msg.t0 - gecen);
        }
      },
      onPos: (msg) => {
        const buf = setup.buffers.get(msg.u);
        if (buf) buf.push({ t: Date.now(), s: msg.s, x: msg.x, y: msg.y, f: msg.f });
        if (hasFlag(msg.f, EFFECT_FLAGS.FINISHED)) {
          // Bitiş mesajı kaybolursa pozisyon bayrağı yedek görevi görür
          const r = engine.runners.get(msg.u);
          if (r && !r.finished) engine.markRemoteFinished(msg.u, engine.time);
        }
      },
      onSkill: (msg) => {
        const me = engine.runners.get(selfId);
        if (!me) return;
        if (msg.skill === 'obstacle') {
          const sender = engine.runners.get(msg.u);
          if (sender) {
            engine.obstacles.push({
              id: `net-${msg.t}`,
              s: Math.max(0, sender.s - 2.5),
              x: sender.x,
              ownerId: msg.u,
              expiresAt: engine.time + 25,
            });
          }
          return;
        }
        // Bana (ve host isem botlarıma) yönelik saldırılar yerel uygulanır
        const localTargets = new Set([selfId, ...setup.botControllers.map((b) => b.id)]);
        const applyTo = (targetId: string) => {
          const target = engine.runners.get(targetId);
          if (!target) return;
          const sender = engine.runners.get(msg.u) ?? target;
          const outcome = applySkill(sender, msg.skill, [sender, target], engine.time);
          const updated = outcome.updated.get(targetId);
          if (updated) engine.runners.set(targetId, updated);
        };
        if ((msg.skill === 'golden' || msg.skill === 'miknatis') && msg.u !== selfId) {
          // Hedefsiz alan etkili skill'ler: her yerel koşucuya kendi tarafında
          // uygula. Mıknatıs artık çift yönlü (öndeki geri, arkadaki öne) —
          // yön kararını applySkill kendisi verir.
          for (const id of localTargets) {
            if (id === msg.u) continue;
            applyTo(id);
          }
        } else if (msg.target && localTargets.has(msg.target) && msg.u !== msg.target) {
          applyTo(msg.target);
        }
      },
      onFinish: (msg) => engine.markRemoteFinished(msg.u, msg.time),
    });
  }, [client, engine, setup, selfId]);

  const runnerVisuals: RunnerVisual2D[] = useMemo(() => {
    if (!engine || !setup) return [];
    const charMap = new Map(players.map((p) => [p.id, p.character]));
    for (const b of startMsg?.bots ?? []) charMap.set(b.id, b.character);
    return [...engine.runners.keys()].map((id) => ({
      id,
      characterId: charMap.get(id) ?? 'sloth',
      cosmetics:
        id === selfId
          ? useCharacterStore.getState().cosmeticsOf(charMap.get(id) ?? 'sloth')
          : undefined,
      name: setup.names.get(id) ?? 'Oyuncu',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useEffect(() => {
    useRaceStore.getState().reset();
    finalized.current = false;
    return () => {
      if (graceTimer.current !== null) window.clearTimeout(graceTimer.current);
    };
  }, [engine]);

  // Sahnem kuruldu → "hazırım". Host ayrıca kendini işaretler ve güvenlik
  // zaman aşımı kurar (bir istemci takılırsa yarış sonsuza dek beklemesin).
  useEffect(() => {
    if (!client || !engine) return;
    readyIds.current = new Set([selfId]);
    goSent.current = false;
    goApplied.current = false;
    client.sendReady();
    // istemci: GO'dan önce host saatiyle offset'i ölç (senkron start bunun üzerine kurulur)
    client.syncClock();
    if (!client.isHost) return;
    herkesHazirsaBaslat();
    const zamanAsimi = window.setTimeout(() => gonderGo(), 7000);
    return () => window.clearTimeout(zamanAsimi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, engine, selfId]);

  const finishSent = useRef(false);
  const botFinishSent = useRef(new Set<string>());

  // Yarış bitince (foto-finiş kaldırıldı) doğrudan sonuçları işle
  const phase = useRaceStore((s) => s.phase);
  useEffect(() => {
    if (!engine) return;
    if (phase === 'finished') finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, engine]);

  const finalize = () => {
    if (finalized.current || !engine || !setup) return;
    finalized.current = true;
    const n = engine.runners.size;
    const { results, categories } = buildResults(engine, setup.names);
    useRaceStore.getState().set({ results, categories, replayActive: false, wasMultiplayer: true });
    const myRow = results.find((r) => r.id === selfId);
    if (myRow) {
      const cs = useCharacterStore.getState();
      let xpGained = 0;
      if (!myRow.disqualified) {
        xpGained = xpForRace(myRow.rank, n);
        void cs.addRaceXp(cs.selectedId, myRow.rank, n, selfId);
      }
      void processRaceResult({
        engine,
        playerId: selfId,
        userId: selfId,
        mapId: startMsg!.map,
        mode: 'ozel',
        characterId: cs.selectedId,
        night: startMsg!.timeOfDay === 'gece',
        rank: myRow.rank,
        playerCount: n,
        finishTime: myRow.finishTime,
        disqualified: myRow.disqualified,
      }).then((meta) => {
        useRaceStore.getState().set({ meta: { ...meta, xpGained } });
      });
    }
    setScreen('podium');
  };

  if (!client || !startMsg || !engine || !setup) {
    return (
      <div className="screen center">
        <p>Yarış verisi eksik.</p>
        <button className="btn" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
      </div>
    );
  }

  const onFrame = (e: RaceEngine, dt: number) => {
    const now = Date.now();
    // 1) Uzak oyuncuları interpolasyonla konumlandır
    for (const [id, buf] of setup.buffers) {
      const st = buf.sample(now);
      if (!st) continue;
      e.setRemoteState(id, st.s, st.x, st.y);
      e.setRemoteDisconnected(id, st.stale);
    }
    // 1b) Host: dolgu botlarının AI'ını yürüt ve pozisyonlarını yayınla
    for (const bot of setup.botControllers) {
      e.setInput(bot.id, bot.update(e, dt));
      const br = e.runners.get(bot.id);
      if (br && e.phase === 'racing') {
        client.sendPos(packPos(bot.id, br.s, br.x, br.y, br.finished ? EFFECT_FLAGS.FINISHED : 0));
        if (br.finished && !botFinishSent.current.has(bot.id)) {
          botFinishSent.current.add(bot.id);
          client.sendFinish({ u: bot.id, time: br.finishTime ?? e.time });
        }
      }
    }
    // 2) Kendi pozisyonumu yayınla (10 Hz sınırı RoomClient'ta)
    const me = e.runners.get(selfId);
    if (me && e.phase === 'racing') {
      const f = effectFlags({
        boost: e.time < me.effects.boostUntil,
        slow: e.time < me.effects.slowUntil,
        stun: e.time < me.effects.stunUntil,
        frozen: e.time < me.effects.frozenUntil,
        shield: e.time < me.effects.shieldUntil,
        grounded: me.grounded,
        finished: me.finished,
      });
      client.sendPos(packPos(selfId, me.s, me.x, me.y, f));
      if (me.finished && !finishSent.current) {
        finishSent.current = true;
        client.sendFinish({ u: selfId, time: me.finishTime ?? e.time });
      }
    }
    // Yerel oyuncu bitti/diskalifiye: en fazla 6 sn stragglerları bekle,
    // sonra ZORLA sonuç ekranına geç (kayıp 'finish' mesajı yüzünden
    // engine.phase 'racing' asılı kalsa bile "maç sonuna geçemedi" olmasın)
    if (me && (me.finished || me.disqualified) && graceTimer.current === null && !finalized.current) {
      graceTimer.current = window.setTimeout(() => finalize(), 6000);
    }
  };

  // Skill olaylarımı (ve host isem botlarımınkileri) odaya yayınla
  const localSkillSenders = new Set([selfId, ...setup.botControllers.map((b) => b.id)]);
  const onEvents = (events: import('../game/engine').GameEvent[]) => {
    for (const ev of events) {
      if (ev.type === 'pickup' || ev.type === 'obstacleHit' || ev.type === 'blocked') continue;
      if (!localSkillSenders.has(ev.userId)) continue;
      client.sendSkill({
        u: ev.userId,
        skill: ev.type,
        target: 'targetId' in ev ? ev.targetId : undefined,
        t: Date.now(),
      });
    }
  };

  return (
    <div className="race-screen">
      <RaceIntro tipOnly onDone={() => {}} />
      <GameCanvas2D
        engine={engine}
        playerId={selfId}
        runners={runnerVisuals}
        consumeInput={consume}
        timeOfDay={startMsg.timeOfDay}
        updateInputs={onFrame}
        onEvents={onEvents}
      />
      <GameButtons onJump={pressJump} onDuck={setDuck} />
      <RotateOverlay />
      <HUD
        onSkillUse={(targetId) => {
          const skill = engine.runners.get(selfId)?.skill;
          if (engine.useSkill(selfId, targetId) && skill) {
            useStatsStore.getState().addSkillUse(skill);
          } else if (skill) {
            sound.blocked();
          }
        }}
      />
      {status === 'reconnecting' && (
        <div className="reconnect-overlay">
          <p>Bağlantı koptu!</p>
          <button
            className="btn primary"
            onClick={() => {
              // Kanal yeniden abone olur; karakter kaldığı yerden devam eder
              void useRoomStore
                .getState()
                .joinRoom(client.code, selfId, client.username);
            }}
          >
            🔌 Yeniden Bağlan
          </button>
        </div>
      )}
    </div>
  );
}
