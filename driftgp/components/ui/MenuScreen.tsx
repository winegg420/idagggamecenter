// Ana menü — A-sınıfı oyun ekranı: animasyonlu arka plan + dönen 3D kahraman araç +
// büyük başlık + aksiyon CTA + kart menü.

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { useGarageStore } from '../../store/garageStore';
import { getRank } from '../../game/xp';
import { getCar } from '../../game/cars';
import { audio } from '../../game/audio';
import { CarModel } from '../game/CarModel';
import { ProceduralEnv } from '../game/ProceduralEnv';

function HeroCar({ carId }: { carId: string }) {
  const g = useRef<THREE.Group>(null);
  const stats = useMemo(() => getCar(carId), [carId]);
  const custom = useGarageStore((s) => s.customizations[carId]) ?? useGarageStore.getState().getCustomization(carId);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.4;
  });
  return (
    <group ref={g} position={[0, -0.35, 0]}>
      <CarModel stats={stats} custom={custom} />
    </group>
  );
}

export function MenuScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const controlMode = useGameStore((s) => s.controlMode);
  const setControlMode = useGameStore((s) => s.setControlMode);
  const xp = useProfileStore((s) => s.xp);
  const playerName = useProfileStore((s) => s.playerName);
  const rank = getRank(xp);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const car = getCar(selectedCarId);

  const nav = (screen: Parameters<typeof setScreen>[0]) => {
    audio.init();
    audio.setEnabled(useGameStore.getState().soundOn);
    setScreen(screen);
  };

  return (
    <div className="screen menu-screen">
      {/* animasyonlu arka plan katmanları */}
      <div className="menu-bg-grid" />
      <div className="menu-bg-streaks" />
      <div className="menu-bg-vignette" />

      {/* üst bar: rütbe kartı + ses */}
      <div className="menu-topbar">
        <button className="rank-chip" onClick={() => nav('profile')}>
          <span className="rank-ico">{rank.icon}</span>
          <span className="rank-txt">
            <b>{playerName}</b>
            <small>{rank.name} · {xp} XP</small>
          </span>
        </button>
        <button
          className="icon-btn sound-toggle"
          onClick={() => {
            toggleSound();
            audio.setEnabled(!soundOn);
          }}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      {/* başlık */}
      <div className="menu-title-wrap">
        <h1 className="game-title">
          DIDA<span>GP</span>
        </h1>
        <div className="title-tag">ARCADE&nbsp;RACING</div>
      </div>

      {/* 3D kahraman araç */}
      <div className="menu-hero">
        <Canvas
          className="hero-canvas"
          camera={{ position: [4.8, 2.3, 5.4], fov: 34 }}
          dpr={[1, 1.6]}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
        >
          <hemisphereLight args={['#cdd8f0', '#181a26', 1.15]} />
          <directionalLight position={[6, 8, 4]} intensity={2.4} />
          <directionalLight position={[-6, 3, -4]} intensity={0.8} color="#7f9dff" />
          <pointLight position={[0, 2, 5]} intensity={22} distance={16} color="#ff3b4a" />
          <ProceduralEnv sky="#9fc0ee" horizon="#eef4ff" ground="#20232e" />
          <Suspense fallback={null}>
            <HeroCar carId={selectedCarId} />
          </Suspense>
        </Canvas>
        <div className="hero-name">
          {car.name} <span>{car.category}</span>
        </div>
      </div>

      {/* aksiyon CTA */}
      <button className="race-cta" onClick={() => nav('trackSelect')}>
        <span className="cta-chevrons">››</span>
        YARIŞA BAŞLA
      </button>

      {/* kart menü */}
      <div className="menu-cards">
        <button className="menu-card" onClick={() => nav('carSelect')}>
          <span className="mc-ico">🚗</span>
          <span>Garaj</span>
        </button>
        <button className="menu-card" onClick={() => nav('multiplayer')}>
          <span className="mc-ico">🌐</span>
          <span>Çok Oyunculu</span>
        </button>
        <button className="menu-card" onClick={() => nav('profile')}>
          <span className="mc-ico">{rank.icon}</span>
          <span>Profil</span>
        </button>
      </div>

      {/* alt: kontrol modu + krediler */}
      <div className="menu-footer">
        <div className="control-mode-seg compact">
          <button className={`seg-btn ${controlMode === 'buttons' ? 'active' : ''}`} onClick={() => setControlMode('buttons')}>
            🔘 Buton
          </button>
          <button className={`seg-btn ${controlMode === 'tilt' ? 'active' : ''}`} onClick={() => setControlMode('tilt')}>
            📱 Eğ + Buton
          </button>
        </div>
        <button className="credits-link" onClick={() => nav('credits')}>
          ⓘ Krediler
        </button>
      </div>
    </div>
  );
}
