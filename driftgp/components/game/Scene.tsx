// Ana 3D sahne: fizik döngüsü (oyuncu + AI botlar + uzak oyuncular), takip kamerası,
// tema ışıklandırması, ses ve HUD senkronu.

import { Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getTrackData, getTrackDef } from '../../game/tracks';
import { startPose } from '../../game/track';
import { createCarState, stepCar, resolveCarCollision, resolveGhostCollision, DAMAGE_SMOKE, DAMAGE_FIRE, catchupNitroRate } from '../../game/carPhysics';
import { createBotDriver, botInput, updatePace, botNitroIncome, botCatchupNitroRate, type BotDriver } from '../../game/botAI';
import { inputManager } from '../../game/input';
import { audio } from '../../game/audio';
import { useGameStore, formatTime, type RacerResult } from '../../store/gameStore';
import { useGarageStore } from '../../store/garageStore';
import { useProfileStore } from '../../store/profileStore';
import { getCar, pickMatchedBotCars } from '../../game/cars';
import { GhostRecorder, ghostPoseAt, GHOST_DT, type GhostData } from '../../game/ghost';
import { TIRE_EFFECT, defaultCustomization } from '../../game/customization';
import { calcRaceXpInputFromState } from '../../game/raceResult';
import { multiplayer } from '../../net/multiplayer';
import type { CarState, CarStats } from '../../game/types';
import { CarModel } from './CarModel';
import { QUALITY } from '../../game/quality';
import { TrackMesh } from './TrackMesh';
import { DriftSmoke, type SmokeEmitter } from './DriftSmoke';
import { DamageFx, type DamageEmitter } from './DamageFx';
import { Environment } from './Environments';
import { ProceduralEnv } from './ProceduralEnv';
import { saveRaceResult, fetchGhost, uploadGhostIfBest, OWNER_GHOST_NAME } from '../../lib/cloudSync';

const BOT_NAMES = ['Kaan', 'Derya', 'Mert', 'Selin', 'Baran'];

/**
 * Gökyüzü/yıldızları kameranın X-Z konumuna sabitler. Sky dome (drei distance=1000 → origin
 * merkezli ±500 kutu) ve Stars origin'de sabit kalırsa, büyük pistlerde araç origin'den >500m
 * uzaklaşınca kamera dome DIŞINA çıkıp gökyüzü kayboluyordu (üst yarı siyah bug). Takip ettirerek
 * kamera her zaman dome merkezinde kalır → gökyüzü tüm ekranı doldurur.
 */
function SkyFollow({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (ref.current) ref.current.position.set(camera.position.x, 0, camera.position.z);
  });
  return <group ref={ref}>{children}</group>;
}

interface Bot {
  state: CarState;
  stats: CarStats;
  /** profesyonel sürücü AI durumu (viraj analizi + yarış hattı + rubber-band) — botAI.ts */
  driver: BotDriver;
  name: string;
  group: THREE.Group | null;
  speedRef: React.MutableRefObject<number>;
  steerRef: React.MutableRefObject<number>;
  nitroRef: React.MutableRefObject<boolean>;
  brakeRef: React.MutableRefObject<boolean>;
}

function progressOf(lap: number, trackIndex: number, count: number): number {
  return lap * count + trackIndex;
}

export function Scene() {
  const trackId = useGameStore((s) => s.trackId);
  const totalLaps = useGameStore((s) => s.totalLaps);
  const mode = useGameStore((s) => s.mode);
  const racePhase = useGameStore((s) => s.racePhase);

  const def = useMemo(() => getTrackDef(trackId), [trackId]);
  const track = useMemo(() => getTrackData(trackId), [trackId]);

  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  // canlı VERİYE abone (getCustomization fonksiyonu sabit — ona abone olmak güncellemeleri kaçırır)
  const storedCustom = useGarageStore((s) => s.customizations[s.selectedCarId]);
  const playerStats = useMemo(() => getCar(selectedCarId), [selectedCarId]);
  const playerCustom = useMemo(
    () => storedCustom ?? defaultCustomization(playerStats.defaultColor),
    [storedCustom, playerStats],
  );

  // lastik tipinin fizik etkisi
  const effectiveStats = useMemo<CarStats>(() => {
    const [gripMul, driftMul] = TIRE_EFFECT[playerCustom.tire] ?? [1, 1];
    return {
      ...playerStats,
      grip: Math.min(1, playerStats.grip * gripMul),
      driftControl: Math.min(1, playerStats.driftControl * driftMul),
    };
  }, [playerStats, playerCustom.tire]);

  const start = useMemo(() => startPose(track, 0), [track]);
  const playerState = useRef(createCarState(start.x, start.z, start.heading));
  const playerGroup = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
  const steerRef = useRef(0);
  const nitroRef = useRef(false);
  const smokeRef = useRef<SmokeEmitter | null>(null);
  const damageFxRef = useRef<DamageEmitter | null>(null);
  const hudAccum = useRef(0);
  const resultsSent = useRef(false);
  const carLightRef = useRef<THREE.PointLight>(null);
  const shadowLightRef = useRef<THREE.DirectionalLight>(null);
  const shadowTarget = useMemo(() => new THREE.Object3D(), []);
  const brakeRef = useRef(false);
  const lastBumpAudio = useRef(0);
  const shake = useRef(0);
  const readySent = useRef(false);
  const { camera } = useThree();

  // Hayalet sistemi: oyun sahibinin (idagg) bu pist+turdaki en iyi sürüşü herkese gösterilir.
  // raceClock oyuncudan bağımsız yarış saati — oyuncu bitirse de hayalet oynatması sürer.
  const [ghostData, setGhostData] = useState<GhostData | null>(null);
  const ghostRec = useRef(new GhostRecorder());
  const raceClock = useRef(0);
  useEffect(() => {
    let alive = true;
    setGhostData(null);
    fetchGhost(trackId, totalLaps).then((g) => {
      if (alive && g) setGhostData(g);
    });
    return () => {
      alive = false;
    };
  }, [trackId, totalLaps]);

  // AI botlar (yalnızca solo modda) — araçları oyuncunun aracına performansça EN YAKIN
  // araçlardan seçilir: hızlı araç seçen hızlı botlarla, yavaş seçen yavaş botlarla yarışır.
  // Havuz[0] = oyuncunun KENDİ aracı; ters atamayla EN USTA bot (son isim) onu sürer →
  // "aynı arabayı almış baş rakip" her yarışta var, en hızlı araç bile rakipsiz kalmaz.
  const bots = useMemo<Bot[]>(() => {
    if (mode !== 'solo') return [];
    const pool = pickMatchedBotCars(selectedCarId, BOT_NAMES.length);
    return BOT_NAMES.map((name, i) => {
      const stats = pool[(pool.length - 1 - i) % pool.length];
      const pose = startPose(track, i + 1);
      return {
        state: createCarState(pose.x, pose.z, pose.heading),
        stats,
        driver: createBotDriver(i, stats.topSpeed / 3.6),
        name,
        group: null,
        speedRef: { current: 0 },
        steerRef: { current: 0 },
        nitroRef: { current: false },
        brakeRef: { current: false },
      };
    });
  }, [mode, selectedCarId, track]);

  // bot kişiselleştirmeleri — stabil referans (her render'da yeni obje üretme)
  const botCustoms = useMemo(() => {
    const map: Record<string, ReturnType<typeof defaultCustomization>> = {};
    for (const bot of bots) map[bot.stats.id] = defaultCustomization(bot.stats.defaultColor);
    return map;
  }, [bots]);

  // yarış başlangıcında sıfırla + motor sesini başlat
  useEffect(() => {
    if (racePhase === 'countdown') {
      // Multi: her oyuncu deterministik grid slotuna (id sıralı) — herkes aynı dizilimi görür,
      // kimse üst üste doğmaz. Solo: oyuncu slot 0.
      const slot =
        mode === 'multi'
          ? Math.max(0, [multiplayer.selfId, ...multiplayer.players.keys()].sort().indexOf(multiplayer.selfId))
          : 0;
      const p = startPose(track, slot);
      playerState.current = createCarState(p.x, p.z, p.heading);
      readySent.current = false;
      ghostRec.current.reset();
      raceClock.current = 0;
      bots.forEach((b, i) => {
        const pose = startPose(track, i + 1);
        b.state = createCarState(pose.x, pose.z, pose.heading);
        b.driver.pace = 1;
        b.driver.lateralNow = 0;
      });
      resultsSent.current = false;
      // araç kimliğinden deterministik ses imzası (aynı profilde bile araçlar farklı seslensin)
      let h = 0;
      for (const ch of playerStats.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      audio.startEngine(playerStats.soundProfile, (h % 1000) / 500 - 1);
    }
    return () => {
      audio.stopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePhase === 'countdown', track, playerStats.soundProfile]);

  useFrame((_, dt) => {
    const st = useGameStore.getState();
    // multi: ilk kare render edildi = sahne yüklendi → "hazırım" sinyali (senkron start el sıkışması)
    if (mode === 'multi' && !readySent.current && st.racePhase === 'countdown') {
      readySent.current = true;
      multiplayer.sendRaceReady();
    }
    // solo'da duraklatma fiziği dondurur (multi'de diğer oyuncular bekletilemez — yarış sürer)
    if (st.paused && mode === 'solo') {
      audio.update(0, false, false, { slip: 0, wall: false });
      return;
    }
    const running = st.racePhase === 'racing';
    if (running) raceClock.current += dt; // hayalet oynatma saati (oyuncu bitse de akar)
    const s = playerState.current;
    const wasFinished = s.finished;
    const wasWall = s.wallContact;

    // --- oyuncu ---
    const input = s.finished
      ? { steer: 0, throttle: 0, brake: true, drift: false, nitro: false }
      : inputManager.read();
    stepCar(s, input, effectiveStats, track, dt, { totalLaps, running });

    const g = playerGroup.current;
    if (g) {
      g.position.set(s.x, 0, s.z);
      g.rotation.y = -s.heading;
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, s.slip * 0.1, 6, dt);
    }
    speedRef.current = s.speed;
    steerRef.current = s.steerVisual;
    nitroRef.current = s.nitroActive;
    brakeRef.current = input.brake;
    // gece dolgu ışığı aracın üstünü takip eder
    if (carLightRef.current) carLightRef.current.position.set(s.x, 5.5, s.z);
    // gölge ışığı oyuncuyu takip eder → büyük pistlerde araç her zaman keskin gölge alır
    if (shadowLightRef.current) {
      shadowLightRef.current.position.set(s.x + 35, 70, s.z - 25);
      shadowTarget.position.set(s.x, 0, s.z);
      shadowTarget.updateMatrixWorld();
    }

    // duvar darbesi: şiddet gerçek yanal çarpma hızıyla orantılı (sıyırma sessiz-scrape, dik dalış gümbürtü)
    if (s.wallContact && !wasWall && s.wallImpact > 2 && s.speed > 6) {
      audio.crash(Math.min(1, 0.3 + s.wallImpact / 16));
      shake.current = Math.min(1, 0.22 + s.wallImpact / 14);
      st.triggerCrash();
    }
    audio.update(Math.min(1, s.speed / (effectiveStats.topSpeed / 3.6)), s.drifting, s.nitroActive, {
      slip: Math.min(1, Math.abs(s.slip) / 0.6),
      wall: s.wallContact,
    });

    if (s.drifting && smokeRef.current && Math.random() < dt * 40) {
      smokeRef.current.emit(s.x - Math.cos(s.heading) * 1.5, s.z - Math.sin(s.heading) * 1.5);
    }

    // --- botlar: önce fizik adımı (profesyonel AI + rubber-band pace) ---
    const myProg = progressOf(s.lap, s.trackIndex, track.count);
    // Son turun ikinci yarısı (lider bazlı): TÜM yetişme yardımları kesilir → dürüst final sprint
    let leadEst = myProg;
    if (mode === 'solo') {
      for (const bot of bots) leadEst = Math.max(leadEst, progressOf(bot.state.lap, bot.state.trackIndex, track.count));
    } else {
      for (const p of multiplayer.players.values()) {
        if (!p.quit) leadEst = Math.max(leadEst, progressOf(p.lap, p.trackIndex, track.count));
      }
    }
    const finalSprint = leadEst >= (totalLaps + 0.5) * track.count;
    for (const bot of bots) {
      if (!bot.state.finished) {
        // rubber-band: oyuncuya göre tur farkı → geride kalan hızlanır, öne kaçan nefes bırakır;
        // final sprintte herkes gerçek temposuna döner
        if (finalSprint) {
          bot.driver.pace = 1;
        } else {
          const botProg = progressOf(bot.state.lap, bot.state.trackIndex, track.count);
          updatePace(bot.driver, (myProg - botProg) / track.count);
          // bot yetişme nitrosu — oyuncu eğrisinden çok daha erken/dik (botCatchupNitroRate):
          // geride kalan bot depoyu dolu tutup fiilen KESİNTİSİZ nitroyla lideri kovalar
          const rate = botCatchupNitroRate((leadEst - botProg) / track.count);
          if (rate > 0) bot.state.nitroEnergy = Math.min(1, bot.state.nitroEnergy + rate * Math.min(dt, 0.05));
        }
        // oyuncunun drift gelirinin bot karşılığı: sabit yavaş nitro dolumu (final sprintte
        // de sürer — oyuncu da driftle kazanmaya devam eder; catchup DEĞİL, temel gelir)
        if (running) bot.state.nitroEnergy = Math.min(1, bot.state.nitroEnergy + botNitroIncome(bot.driver.skill) * Math.min(dt, 0.05));
        const bi = botInput(bot.driver, bot.state, track, dt);
        stepCar(bot.state, bi, bot.stats, track, dt, { totalLaps, running });
        bot.brakeRef.current = bi.brake;
      }
    }

    // --- hayalet kaydı: oyuncunun sürüşü 8Hz örneklenir (bitişte rekorsa buluta yazılır) ---
    if (running && !s.finished) ghostRec.current.update(dt, s.x, s.z, s.heading);

    // --- araç-araç çarpışması (momentum aktarımlı; şiddet = kapanma hızı) ---
    let bumpForce = 0; // en sert temasın şiddeti (m/s)
    if (running && !s.finished) {
      if (mode === 'solo') {
        for (const bot of bots) {
          bumpForce = Math.max(bumpForce, resolveCarCollision(s, bot.state));
        }
        // bot-bot (oyuncu görüş alanındaki tıkanmaları çözer)
        for (let i = 0; i < bots.length; i++)
          for (let j = i + 1; j < bots.length; j++) resolveCarCollision(bots[i].state, bots[j].state);
      } else {
        // MP: sadece yerel oyuncu itilir (uzak pozisyon otoriter, adalet için hız cezası yok)
        for (const p of multiplayer.players.values()) {
          if (p.quit || p.finished || !p.snapCur) continue; // pistte olmayan/henüz paket yollamayan araçla çarpışma olmaz
          bumpForce = Math.max(bumpForce, resolveGhostCollision(s, p.x, p.z));
        }
      }
    }
    if (bumpForce > 0) {
      // gövde darbesi geri bildirimi — şiddetle ölçekli ses + kamera sarsıntısı
      const nowMs = performance.now();
      if (nowMs - lastBumpAudio.current > 200) {
        audio.bump(Math.min(1, 0.3 + bumpForce / 16));
        shake.current = Math.max(shake.current, Math.min(0.8, 0.24 + bumpForce / 28));
        st.triggerCrash();
        lastBumpAudio.current = nowMs;
      }
    }

    // --- hasar efektleri: duman (eşik üstü, hasarla koyulaşır) → alev (yangın eşiği) ---
    // Eşikler uzun vadeli birikime göre ayarlı (carPhysics) — duman/alev yarış sonlarında çıkar.
    const fx = damageFxRef.current;
    if (fx) {
      const emitDamage = (x: number, z: number, heading: number, damage: number) => {
        if (damage < DAMAGE_SMOKE) return;
        const sev = (damage - DAMAGE_SMOKE) / (1 - DAMAGE_SMOKE); // 0..1
        const hx = x + Math.cos(heading) * 1.15;
        const hz = z + Math.sin(heading) * 1.15;
        if (Math.random() < dt * (7 + sev * 26)) fx.smoke(hx, 0.75, hz, Math.min(1, sev * 1.25));
        if (damage >= DAMAGE_FIRE && Math.random() < dt * 32) fx.fire(hx, 0.7, hz);
      };
      emitDamage(s.x, s.z, s.heading, s.damage);
      for (const bot of bots) emitDamage(bot.state.x, bot.state.z, bot.state.heading, bot.state.damage);
      if (mode === 'multi') {
        for (const p of multiplayer.players.values()) {
          if (!p.quit && !p.finished && p.damage) emitDamage(p.x, p.z, p.heading, p.damage);
        }
      }
    }

    // --- görselleri çarpışma sonrası pozisyonlarla güncelle ---
    if (g) g.position.set(s.x, 0, s.z);
    for (const bot of bots) {
      if (bot.group) {
        bot.group.position.set(bot.state.x, 0, bot.state.z);
        bot.group.rotation.y = -bot.state.heading;
      }
      bot.speedRef.current = bot.state.speed;
      bot.steerRef.current = bot.state.steerVisual;
      bot.nitroRef.current = bot.state.nitroActive;
    }

    // --- multiplayer durumu yayınla ---
    if (mode === 'multi' && running) {
      multiplayer.sendState({
        id: multiplayer.selfId,
        x: s.x,
        z: s.z,
        heading: s.heading,
        speed: s.speed,
        drifting: s.drifting,
        nitro: s.nitroActive,
        lap: s.lap,
        trackIndex: s.trackIndex,
        damage: s.damage,
      });
    }

    // --- pozisyon hesabı + lider ilerlemesi (yetişme nitrosu için) ---
    const myProgress = progressOf(s.lap, s.trackIndex, track.count);
    let position = 1;
    let leaderProgress = myProgress;
    if (mode === 'solo') {
      for (const bot of bots) {
        const bp = bot.state.finished
          ? progressOf(totalLaps + 1, 0, track.count) + (1000 - (bot.state.raceTime || 999))
          : progressOf(bot.state.lap, bot.state.trackIndex, track.count);
        if (bp > myProgress && !s.finished) position++;
        if (bp > leaderProgress) leaderProgress = bp;
      }
    } else {
      for (const p of multiplayer.players.values()) {
        if (p.quit) continue; // yarışı bırakan sıralamaya girmez
        // DNF (finishTime<0) "bitirdi" sayılıp öne geçmesin — son bilinen ilerlemesi kullanılır
        const pp =
          p.finished && p.finishTime >= 0
            ? progressOf(totalLaps + 1, 0, track.count)
            : progressOf(p.lap, p.trackIndex, track.count);
        if (pp > myProgress && !s.finished) position++;
        if (pp > leaderProgress) leaderProgress = pp;
      }
    }

    // --- yetişme nitrosu: geride kalana kademeli otomatik dolum (lider farkı açamaz) ---
    // Son turun ikinci yarısında kesilir → bitişe normal, dürüst yarış (finalSprint yukarıda)
    if (running && !s.finished && !finalSprint) {
      const gapLaps = (leaderProgress - myProgress) / track.count;
      const rate = catchupNitroRate(gapLaps);
      if (rate > 0) s.nitroEnergy = Math.min(1, s.nitroEnergy + rate * Math.min(dt, 0.05));
    }

    // --- kamera ---
    const camDist = 8.5 + s.speed * 0.03;
    const camH = 3.4 + s.speed * 0.012;
    const lerp = 1 - Math.exp(-dt * 5);
    camera.position.x += (s.x - Math.cos(s.velAngle) * camDist - camera.position.x) * lerp;
    camera.position.z += (s.z - Math.sin(s.velAngle) * camDist - camera.position.z) * lerp;
    camera.position.y += (camH - camera.position.y) * lerp;
    // çarpışma sarsıntısı (kamera titremesi, decay)
    if (shake.current > 0.002) {
      const sh = shake.current;
      camera.position.x += (Math.random() - 0.5) * sh * 0.85;
      camera.position.y += (Math.random() - 0.5) * sh * 0.5;
      camera.position.z += (Math.random() - 0.5) * sh * 0.85;
      shake.current *= Math.exp(-dt * 7);
    }
    camera.lookAt(s.x + Math.cos(s.heading) * 4, 1.0, s.z + Math.sin(s.heading) * 4);
    const pc = camera as THREE.PerspectiveCamera;
    // hız + nitro ile FOV zoom (hız hissi/aksiyon)
    const targetFov = 62 + Math.min(1, s.speed / (effectiveStats.topSpeed / 3.6)) * 18 + (s.nitroActive ? 11 : 0);
    if (Math.abs(pc.fov - targetFov) > 0.1) {
      pc.fov += (targetFov - pc.fov) * Math.min(1, dt * 4);
      pc.updateProjectionMatrix();
    }

    // --- HUD (10Hz) ---
    hudAccum.current += dt;
    if (hudAccum.current > 0.1) {
      hudAccum.current = 0;
      st.setHud({
        speedKmh: Math.round(s.speed * 3.6),
        gear: audio.currentGear,
        damage: s.damage,
        lap: Math.min(s.lap, totalLaps),
        raceTime: s.raceTime,
        nitroEnergy: s.nitroEnergy,
        drifting: s.drifting,
        position,
        racerCount:
          mode === 'solo'
            ? bots.length + 1
            : [...multiplayer.players.values()].filter((p) => !p.quit).length + 1,
        boosting: s.nitroActive,
      });
      // minimap: oyuncu + rakip pozisyonları
      const racers: number[] = [];
      if (mode === 'solo') {
        for (const bot of bots) racers.push(bot.state.x, bot.state.z);
      } else {
        for (const p of multiplayer.players.values()) {
          if (!p.quit && p.snapCur) racers.push(p.x, p.z); // paket gelmeden (0,0)'da nokta gösterme
        }
      }
      st.setMinimap([s.x, s.z, s.heading], racers);
    }

    // --- bitiş ---
    if (s.finished && !wasFinished && !resultsSent.current) {
      resultsSent.current = true;
      const results: RacerResult[] = [];
      if (mode === 'solo') {
        results.push({ name: 'SEN', carId: selectedCarId, time: s.raceTime, isPlayer: true });
        for (const bot of bots) {
          if (bot.state.finished) {
            results.push({ name: bot.name, carId: bot.stats.id, time: bot.state.raceTime, isPlayer: false });
          } else {
            // bitirmemiş bot: mevcut ilerlemeden süre tahmini
            const bp = progressOf(bot.state.lap, bot.state.trackIndex, track.count);
            const totalP = progressOf(totalLaps + 1, 0, track.count);
            const est = bp > track.count ? (bot.state.raceTime * totalP) / bp : -1;
            results.push({ name: bot.name, carId: bot.stats.id, time: est, isPlayer: false });
          }
        }
        results.sort((a, b) => (a.time < 0 ? 1 : b.time < 0 ? -1 : a.time - b.time));
      } else {
        multiplayer.sendFinish(s.raceTime);
        results.push({ name: 'SEN', carId: selectedCarId, time: s.raceTime, isPlayer: true });
        for (const p of multiplayer.players.values()) {
          results.push({ name: p.name, carId: p.carId, time: p.finished ? p.finishTime : -1, isPlayer: false });
        }
        results.sort((a, b) => (a.time < 0 ? 1 : b.time < 0 ? -1 : a.time - b.time));
      }
      const finalPos = results.findIndex((r) => r.isPlayer) + 1;
      st.finishRace([...s.lapTimes], results);

      // XP + rozet + bulut kaydı
      const xpInput = calcRaceXpInputFromState(s, finalPos, results.length, trackId);
      useProfileStore.getState().applyRaceResult(xpInput, selectedCarId, s.cleanLapDone);
      saveRaceResult({
        trackId,
        carId: selectedCarId,
        position: finalPos,
        raceTime: s.raceTime,
        bestLap: Math.min(...s.lapTimes),
        driftScore: s.driftScore,
      }).catch(() => {});

      // Oyun sahibi hesabıyla sürüldüyse ve buluttaki hayaletten hızlıysa yeni rekor yüklenir
      // (yetki kontrolü hem istemcide hem RLS'te). Herkes bir sonraki yarışta yeni hayaleti görür.
      uploadGhostIfBest(trackId, totalLaps, {
        name: OWNER_GHOST_NAME,
        carId: selectedCarId,
        paintColor: playerCustom.paintColor,
        raceTime: s.raceTime,
        dt: GHOST_DT,
        samples: [...ghostRec.current.samples],
      }).catch(() => {});
    }
  });

  const sunPos: [number, number, number] = def.night ? [-60, 8, 40] : [80, 55, -60];

  return (
    <>
      {/* GARANTİ arka plan — Sky kırpılsa/kaybolsa bile pikseller siyah kalmaz (üst-yarı-siyah bug'a karşı) */}
      <color attach="background" args={[def.colors.sky]} />
      {def.night ? (
        <>
          {!QUALITY.cheapMaterials && (
            <SkyFollow>
              <Stars radius={300} depth={60} count={2200} factor={5} fade speed={0.6} />
            </SkyFollow>
          )}
          {/* gece atmosferi korunur ama sürüş için görünürlük: yükseltilmiş ambient + ay ışığı + dolgu */}
          <hemisphereLight args={['#5866a0', '#20223a', 1.15]} />
          <directionalLight position={[40, 60, -30]} intensity={0.7} color="#aebbff" />
          <directionalLight position={[-40, 30, 50]} intensity={0.45} color="#8090d0" />
          {/* oyuncu arabasını takip eden sıcak dolgu ışığı — araç ve yol geniş alanda net görünür */}
          <pointLight ref={carLightRef} intensity={130} distance={48} decay={1.25} color="#fff2d8" />
        </>
      ) : (
        <>
          {/* Sky shader'ı piksel başına pahalı — yazılım render'da düz renk arka plan yeter */}
          {def.theme !== 'volcano' && !QUALITY.cheapMaterials && (
            <SkyFollow>
              <Sky sunPosition={sunPos} turbidity={def.theme === 'coast' ? 3 : 7} rayleigh={def.theme === 'coast' ? 1.4 : 2.4} />
            </SkyFollow>
          )}
          <hemisphereLight args={[def.theme === 'volcano' ? '#ff9a6b' : '#bcd8ff', def.colors.ground, def.theme === 'volcano' ? 0.7 : 1.15]} />
          <directionalLight
            position={sunPos}
            intensity={def.theme === 'volcano' ? 0.9 : 1.7}
            color={def.theme === 'volcano' ? '#ff8a5b' : '#ffffff'}
          />
          <directionalLight position={[-50, 30, 60]} intensity={0.5} />
        </>
      )}

      {/* IBL env haritası yazılım render'da her pikselde ek örnekleme maliyeti → atla */}
      {!QUALITY.cheapMaterials && (
        <ProceduralEnv
          sky={def.night ? '#3a4680' : def.colors.sky}
          horizon={def.night ? '#6a72a0' : '#eaf2ff'}
          ground={def.colors.ground}
        />
      )}
      {/* oyuncuyu takip eden gölge ışığı — dar frustum, yüksek çözünürlük = keskin araç gölgesi */}
      <directionalLight
        ref={shadowLightRef}
        intensity={def.night ? 0.5 : 1.5}
        color={def.night ? '#aebbff' : def.theme === 'volcano' ? '#ff8a5b' : '#fff'}
        castShadow
        shadow-mapSize={[QUALITY.shadowMap, QUALITY.shadowMap]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0008}
        shadow-normalBias={0.04}
        target={shadowTarget}
      />
      <primitive object={shadowTarget} />
      <TrackMesh track={track} def={def} />
      <Environment theme={def.theme} track={track} />

      {/* oyuncu — kendi Suspense sınırında (model yüklenene kadar pist/çevre etkilenmez) */}
      <Suspense fallback={null}>
        <CarModel ref={playerGroup} stats={playerStats} custom={playerCustom} speedRef={speedRef} steerRef={steerRef} nitroRef={nitroRef} brakeRef={brakeRef} />
      </Suspense>

      {/* botlar */}
      {bots.map((bot) => (
        <Suspense key={bot.name} fallback={null}>
          <CarModel
            ref={(el) => {
              bot.group = el;
            }}
            stats={bot.stats}
            custom={botCustoms[bot.stats.id]}
            speedRef={bot.speedRef}
            steerRef={bot.steerRef}
            nitroRef={bot.nitroRef}
            brakeRef={bot.brakeRef}
            lowDetail
            label={bot.name}
          />
        </Suspense>
      ))}

      {/* uzak oyuncular */}
      {mode === 'multi' && <RemoteCars track={track} />}

      {/* hayalet araba — oyun sahibinin (idagg) bu pist+turdaki rekor sürüşü, çarpışmasız */}
      {ghostData && <GhostCar ghost={ghostData} clockRef={raceClock} />}

      <DriftSmoke emitterRef={smokeRef} />
      <DamageFx emitterRef={damageFxRef} />
      <fog attach="fog" args={[def.colors.fog, def.fogRange[0], def.fogRange[1]]} />
    </>
  );
}

// ---------- Hayalet araba (oyun sahibinin rekor sürüşü) ----------

/**
 * Kayıtlı hayalet sürüşü yarış saatine (clockRef) senkron oynatır. Çarpışmaya girmez,
 * sıralamaya sayılmaz; etiketi "idagg · süre" ile hayalet skoru herkese gösterir.
 * Geri sayımda ve hayalet bitişten sonra gizlenir (start grid'inde oyuncuyla üst üste binmesin).
 */
function GhostCar({ ghost, clockRef }: { ghost: GhostData; clockRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
  const prev = useRef<{ t: number; x: number; z: number } | null>(null);
  const stats = useMemo(() => getCar(ghost.carId), [ghost.carId]);
  const custom = useMemo(
    () => ({ ...defaultCustomization(stats.defaultColor), ...(ghost.paintColor ? { paintColor: ghost.paintColor } : {}) }),
    [stats, ghost.paintColor],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = clockRef.current;
    const pose = ghostPoseAt(ghost, t);
    if (!pose) {
      g.visible = false;
      return;
    }
    g.visible = t > 0.05 && !pose.done;
    g.position.set(pose.x, 0, pose.z);
    g.rotation.y = -pose.heading;
    // teker dönüş animasyonu için hız tahmini (ardışık kareler arası mesafe)
    const p = prev.current;
    if (p && t > p.t) speedRef.current = Math.hypot(pose.x - p.x, pose.z - p.z) / (t - p.t);
    else if (!p || t < p.t) speedRef.current = 0;
    prev.current = { t, x: pose.x, z: pose.z };
  });

  return (
    <Suspense fallback={null}>
      <CarModel
        ref={group}
        stats={stats}
        custom={custom}
        speedRef={speedRef}
        lowDetail
        ghost
        label={`${ghost.name} · ${formatTime(ghost.raceTime)}`}
      />
    </Suspense>
  );
}

// ---------- Uzak oyuncular (multiplayer) ----------

function RemoteCars({ track }: { track: ReturnType<typeof getTrackData> }) {
  const groups = useRef(new Map<string, THREE.Group>());
  const refsPool = useRef(new Map<string, { speed: React.MutableRefObject<number>; nitro: React.MutableRefObject<boolean> }>());
  // oyuncu listesi değişince re-render
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => multiplayer.subscribe(() => bump()), []);

  // Deterministik grid dizilimi (id sıralı) — yerel oyuncunun slot hesabıyla birebir aynı.
  // İlk pozisyon paketi gelene dek uzak araçlar (0,0) yerine kendi grid slotlarında görünür.
  const raceId = multiplayer.raceStart?.raceId ?? 0;
  const gridPoses = useMemo(() => {
    const ids = [multiplayer.selfId, ...multiplayer.players.keys()].sort();
    const m = new Map<string, { x: number; z: number; heading: number }>();
    ids.forEach((id, i) => m.set(id, startPose(track, i)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, raceId]);

  useFrame((_, dt) => {
    const now = performance.now();
    const renderT = now - 130; // ~2 paket gecikmeli render → paketler arası SÜREKLİ akıcı hareket
    for (const p of multiplayer.players.values()) {
      const g = groups.current.get(p.id);
      if (!g) continue;
      // henüz pozisyon paketi yok (geri sayım/yükleme) → grid slotuna sabitle
      if (!p.snapCur) {
        const pose = gridPoses.get(p.id);
        if (pose) {
          g.position.set(pose.x, 0, pose.z);
          g.rotation.y = -pose.heading;
        }
        continue;
      }
      // snapshot interpolasyonu (15Hz veri): iki örnek arası lineer + sınırlı ekstrapolasyon
      let tx = p.x;
      let tz = p.z;
      let th = p.heading;
      const a = p.snapPrev;
      const b = p.snapCur;
      if (a && b && b.t > a.t) {
        if (renderT <= b.t) {
          const alpha = Math.max(0, (renderT - a.t) / (b.t - a.t));
          tx = a.x + (b.x - a.x) * alpha;
          tz = a.z + (b.z - a.z) * alpha;
          let dh0 = b.heading - a.heading;
          while (dh0 > Math.PI) dh0 -= Math.PI * 2;
          while (dh0 < -Math.PI) dh0 += Math.PI * 2;
          th = a.heading + dh0 * alpha;
        } else {
          // yeni paket gecikti → hız yönünde en fazla 300ms ileri tahmin (dead reckoning)
          const beyond = Math.min(0.3, (renderT - b.t) / 1000);
          tx = b.x + Math.cos(b.heading) * b.speed * beyond;
          tz = b.z + Math.sin(b.heading) * b.speed * beyond;
          th = b.heading;
        }
      }
      // küçük düzeltme yumuşatması (paket sıçramalarını gizler, gecikme eklemez)
      const lerp = 1 - Math.exp(-dt * 18);
      g.position.x += (tx - g.position.x) * lerp;
      g.position.z += (tz - g.position.z) * lerp;
      let dh = -th - g.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      g.rotation.y += dh * lerp;
      const refs = refsPool.current.get(p.id);
      if (refs) {
        refs.speed.current = p.speed;
        refs.nitro.current = p.nitro;
      }
    }
  });

  return (
    <>
      {[...multiplayer.players.values()].filter((p) => !p.quit).map((p) => {
        let refs = refsPool.current.get(p.id);
        if (!refs) {
          refs = { speed: { current: 0 }, nitro: { current: false } };
          refsPool.current.set(p.id, refs);
        }
        const stats = getCar(p.carId);
        const custom = { ...defaultCustomization(stats.defaultColor), paintColor: p.paintColor };
        return (
          <Suspense key={p.id} fallback={null}>
            <CarModel
              ref={(el) => {
                if (el) groups.current.set(p.id, el);
                else groups.current.delete(p.id);
              }}
              stats={stats}
              custom={custom}
              speedRef={refs.speed}
              nitroRef={refs.nitro}
              lowDetail
              label={p.name}
            />
          </Suspense>
        );
      })}
    </>
  );
}
