// Araba seçme ekranı — kartlar, pist ile BİREBİR aynı CarModel bileşenini gösterir.
// Tek WebGL context: drei <View> ile 30 kart tek Canvas'ta render edilir (context limiti yok).
// Kilit sistemi kaldırıldı — tüm araçlar açık.

import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CARS, CATEGORIES } from '../../game/cars';
import { useGarageStore } from '../../store/garageStore';
import { useGameStore } from '../../store/gameStore';
import { CarModel } from '../game/CarModel';
import { ProceduralEnv } from '../game/ProceduralEnv';
import type { CarCustomization, CarStats } from '../../game/types';

type SortKey = 'speed' | 'accel' | 'name';

// kategori bazlı kart parıltısı — her kategori HUE spektrumunda net ayrı bir renk (bitişik
// spor kademeleri kırmızı→macenta→turuncu→sarı ile ayrışır). Doygun + güçlü parıltı.
const CAT_COLORS: Record<string, [string, string]> = {
  Hyper: ['#ff2e2e', '#5a0616'],
  'Flagship Hyper': ['#ff2ea8', '#4a0630'],
  Süper: ['#ff7d1a', '#5a2600'],
  Spor: ['#ffc21a', '#5a4000'],
  'Sedan Spor': ['#a6dc2a', '#31460a'],
  Kas: ['#9a4dff', '#2a0a4a'],
  Sedan: ['#3b7bff', '#0a1c4a'],
  Elektrikli: ['#15d8e8', '#053a45'],
  Arazi: ['#33c04a', '#0a3a16'],
  Kompakt: ['#12d0a0', '#053a2e'],
  Roadster: ['#ff5fae', '#4a0a30'],
  'E-Pickup': ['#c07a2a', '#3a2200'],
  Rally: ['#6a5cff', '#160a4a'],
  'Lüks GT': ['#e8c24a', '#463200'],
  Polis: ['#2f4dff', '#0a0f4a'],
  Ambulans: ['#ff3a4a', '#4a0610'],
  Taksi: ['#ffd21a', '#5a4400'],
};
function catGlow(category: string): string {
  const [a, b] = CAT_COLORS[category] ?? ['#6b7280', '#20242c'];
  // daha görünür: üstte doygun ışık (aa), ortada koyu ton (99)
  return `radial-gradient(125% 95% at 50% 16%, ${a}aa 0%, ${a}55 28%, ${b}99 55%, #0d0f18 100%)`;
}

function SpinningCar({ stats, custom }: { stats: CarStats; custom: CarCustomization }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.6;
  });
  return (
    <group ref={g} position={[0, -0.35, 0]}>
      <CarModel stats={stats} custom={custom} lowDetail />
    </group>
  );
}

function CardScene({ stats, custom }: { stats: CarStats; custom: CarCustomization }) {
  return (
    <>
      {/* kamera aracın merkezine bakmalı — aksi halde araç kadraj dışında kalır */}
      <PerspectiveCamera
        makeDefault
        position={[4.8, 2.6, 5.4]}
        fov={32}
        onUpdate={(c) => c.lookAt(0, 0.15, 0)}
      />
      <hemisphereLight args={['#dbe6ff', '#2a2d3a', 2.0]} />
      <directionalLight position={[5, 8, 5]} intensity={3.0} />
      <directionalLight position={[-6, 4, -3]} intensity={1.1} color="#9fb4ff" />
      <pointLight position={[0, 3, 4]} intensity={30} distance={18} />
      <ProceduralEnv sky="#acc8ea" horizon="#f2f6ff" ground="#3a3d48" />
      <SpinningCar stats={stats} custom={custom} />
    </>
  );
}

export function CarSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const selectCar = useGarageStore((s) => s.selectCar);
  const getCustomization = useGarageStore((s) => s.getCustomization);
  const customizations = useGarageStore((s) => s.customizations);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('speed');
  const rootRef = useRef<HTMLDivElement>(null);

  const cars = useMemo(() => {
    const list = category ? CARS.filter((c) => c.category === category) : [...CARS];
    if (sort === 'speed') list.sort((a, b) => b.topSpeed - a.topSpeed);
    else if (sort === 'accel') list.sort((a, b) => a.accel0to100 - b.accel0to100);
    else list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return list;
  }, [category, sort]);

  return (
    <div className="screen list-screen" ref={rootRef}>
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen('menu')}>
          ←
        </button>
        <h2>GARAJ</h2>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="speed">Hıza göre</option>
          <option value="accel">İvmeye göre</option>
          <option value="name">İsme göre</option>
        </select>
      </div>
      <div className="filter-row">
        <button className={`chip ${category === null ? 'active' : ''}`} onClick={() => setCategory(null)}>
          Tümü
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="card-grid cars">
        {cars.map((car) => {
          const custom = customizations[car.id] ?? getCustomization(car.id);
          const selected = car.id === selectedCarId;
          return (
            <button
              key={car.id}
              className={`car-card ${selected ? 'selected' : ''}`}
              onClick={() => selectCar(car.id)}
            >
              <div className="car-view-wrap" style={{ background: catGlow(car.category) }}>
                <View className="car-view" index={1}>
                  <CardScene stats={car} custom={custom} />
                </View>
              </div>
              <div className="car-info">
                <div className="car-name">{car.name}</div>
                <span className="badge-chip">{car.category}</span>
                <div className="car-stats">
                  <span>
                    🚀 {car.topSpeed} <small>km/s</small>
                  </span>
                  <span>
                    ⏱️ {car.accel0to100} <small>sn 0-100</small>
                  </span>
                </div>
                <div className="stat-bars">
                  <StatBar label="Hız" value={car.topSpeed / 480} />
                  <StatBar label="İvme" value={1 - (car.accel0to100 - 1.5) / 7} />
                  <StatBar label="Drift" value={car.driftControl} />
                </div>
              </div>
              {selected && <div className="selected-tick">✓ SEÇİLİ</div>}
            </button>
          );
        })}
      </div>

      <div className="footer-actions">
        <button className="secondary-btn" onClick={() => setScreen('garage')}>
          🎨 ÖZELLEŞTİR
        </button>
        <button className="primary-btn" onClick={() => setScreen('trackSelect')}>
          YARIŞA GİT →
        </button>
      </div>

      {/* Tek paylaşımlı Canvas — tüm kart View'larını render eder */}
      <Canvas
        className="views-canvas"
        eventSource={rootRef as React.RefObject<HTMLElement>}
        shadows={false}
        dpr={[1, 1.6]}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <View.Port />
      </Canvas>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-bar">
      <span>{label}</span>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${Math.round(Math.max(0.05, Math.min(1, value)) * 100)}%` }} />
      </div>
    </div>
  );
}
