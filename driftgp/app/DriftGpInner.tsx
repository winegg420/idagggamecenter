import { useEffect, useReducer, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { Scene } from '../components/game/Scene';
import { MenuScreen } from '../components/ui/MenuScreen';
import { TrackSelectScreen } from '../components/ui/TrackSelectScreen';
import { CarSelectScreen } from '../components/ui/CarSelectScreen';
import { GarageScreen } from '../components/ui/GarageScreen';
import { ProfileScreen } from '../components/ui/ProfileScreen';
import { MultiplayerScreen } from '../components/ui/MultiplayerScreen';
import { CreditsScreen } from '../components/ui/CreditsScreen';
import { CalibrationScreen } from '../components/ui/CalibrationScreen';
import { HUD } from '../components/ui/HUD';
import { StartLights } from '../components/ui/StartLights';
import { ResultsScreen } from '../components/ui/ResultsScreen';
import { PauseOverlay } from '../components/ui/PauseOverlay';
import { multiplayer } from '../net/multiplayer';
import { supabase } from '../lib/supabase';
import { launchRace } from '../game/flow';
import { QUALITY } from '../game/quality';

/**
 * Adaptif kalite: FPS'i 1.5 sn pencerelerle ölçer, düşükse render çözünürlüğünü kademeli
 * düşürür (kasma biter), yükselince geri çıkarır. Kalıcı ayar gerekmez — her cihaz kendi
 * dengesini bulur (kullanıcının "kasıyor" şikayetinin kalıcı çözümü).
 */
function AdaptiveQuality() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const frames = useRef(0);
  const tAcc = useRef(0);
  const scale = useRef(1);
  // dev-only performans teşhis kancası: occluded sekmede bile tek kare zorla render + sayaçlar
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__didagpStats = () => {
      gl.render(scene, camera);
      return { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    };
    // gl.render süresini ölç (GPU/driver mı JS mi ayrımı için)
    const orig = gl.render.bind(gl);
    (gl as unknown as { render: typeof gl.render }).render = (sc: THREE.Scene, cam: THREE.Camera) => {
      const t0 = performance.now();
      orig(sc, cam);
      w.__renderMs = performance.now() - t0;
    };
    return () => {
      (gl as unknown as { render: typeof gl.render }).render = orig;
    };
  }, [gl, scene, camera]);
  useFrame((_, dt) => {
    frames.current++;
    tAcc.current += dt;
    if (tAcc.current < 1.0) return; // 1 sn pencere — kasan cihaz daha hızlı dengeye oturur
    const fps = frames.current / tAcc.current;
    frames.current = 0;
    tAcc.current = 0;
    const base = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, QUALITY.dpr);
    const minRatio = QUALITY.isMobile ? 0.75 : 0.9; // mobilde akıcılık netlikten önce gelir
    if (fps < 30 && scale.current > 0.5) {
      // ciddi kasma: büyük adımla düş (bekletmeden akıcılığa dön)
      scale.current = Math.max(0.5, scale.current - 0.25);
      gl.setPixelRatio(Math.max(minRatio, base * scale.current));
    } else if (fps < 44 && scale.current > 0.5) {
      scale.current = Math.max(0.5, scale.current - 0.12);
      gl.setPixelRatio(Math.max(minRatio, base * scale.current));
    } else if (fps > 56 && scale.current < 1) {
      scale.current = Math.min(1, scale.current + 0.08);
      gl.setPixelRatio(Math.max(minRatio, base * scale.current));
    }
  });
  return null;
}

export default function DriftGpInner() {
  const screen = useGameStore((s) => s.screen);
  const racePhase = useGameStore((s) => s.racePhase);
  const paused = useGameStore((s) => s.paused);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const launchedStartAt = useRef(0);

  // multiplayer init (auth id varsa onunla) + davet bildirimi
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          if (!cancelled) await multiplayer.init(data.user?.id);
        }
      } catch (err) {
        console.warn('[DidaGP] Multiplayer başlatma:', err);
      }
    };
    boot();
    const unsub = multiplayer.subscribe(() => {
      bump();
      // Host yarışı başlattı → lobide VEYA sonuç ekranındaki oyuncuları yarışa al.
      // raceId damgası "aynı yarışı ikinci kez başlatma"yı engeller (lobiye dönüşte kritik).
      const rs = multiplayer.raceStart;
      const st = useGameStore.getState();
      const inLobby = st.screen === 'multiplayer';
      const onResults = st.mode === 'multi' && st.screen === 'race' && st.racePhase === 'finished';
      if (rs && rs.raceId !== launchedStartAt.current && (inLobby || onResults)) {
        launchedStartAt.current = rs.raceId;
        st.configureRace({ trackId: rs.trackId, totalLaps: rs.laps, mode: 'multi' });
        launchRace();
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const invite = multiplayer.pendingInvite;
  const inRace = screen === 'race';

  return (
    <div className="app-root">
      {inRace && (
        <Canvas
          shadows={QUALITY.noShadows ? false : QUALITY.isMobile ? true : 'soft'}
          camera={{ position: [0, 5, -12], fov: 62, near: 0.5, far: 1600 }}
          dpr={[1, QUALITY.dpr]}
          gl={{
            antialias: QUALITY.antialias,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
        >
          <AdaptiveQuality />
          <Scene />
        </Canvas>
      )}

      {screen === 'menu' && <MenuScreen />}
      {screen === 'trackSelect' && <TrackSelectScreen />}
      {screen === 'carSelect' && <CarSelectScreen />}
      {screen === 'garage' && <GarageScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'multiplayer' && <MultiplayerScreen />}
      {screen === 'credits' && <CreditsScreen />}
      {screen === 'calibration' && <CalibrationScreen />}
      {inRace && racePhase !== 'finished' && <HUD />}
      <StartLights />
      {inRace && racePhase === 'finished' && <ResultsScreen />}
      {inRace && racePhase !== 'finished' && paused && <PauseOverlay />}

      {invite && (
        <div className="invite-toast">
          ✉️ <b>{invite.from}</b> seni yarışa davet etti!
          <div className="invite-actions">
            <button
              className="chip active"
              onClick={async () => {
                const code = invite.roomCode;
                multiplayer.clearInvite();
                if (await multiplayer.joinRoom(code)) {
                  useGameStore.getState().setScreen('multiplayer');
                }
              }}
            >
              KATIL
            </button>
            <button className="chip" onClick={() => multiplayer.clearInvite()}>
              Reddet
            </button>
          </div>
        </div>
      )}

      <div className="rotate-overlay">
        <div className="rotate-icon">📱↻</div>
        <p>Telefonu yan çevirin</p>
      </div>

      {/* donanım hızlandırma kapalı uyarısı — oyun yazılım render'da SANİYELER/kare çalışır */}
      {QUALITY.softwareGL && screen === 'menu' && (
        <div className="gpu-warning">
          ⚠️ <b>Tarayıcıda donanım hızlandırma KAPALI</b> — oyun çok yavaş çalışır.
          <br />
          Chrome → Ayarlar → Sistem → <b>"Kullanılabilir olduğunda grafik hızlandırmayı kullan"</b>
          seçeneğini açıp Chrome'u yeniden başlatın.
        </div>
      )}
    </div>
  );
}
