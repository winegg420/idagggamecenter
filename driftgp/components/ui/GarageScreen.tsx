// Kişiselleştirme ekranı — canlı 3D önizleme + 13 kategori.

import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGarageStore } from '../../store/garageStore';
import { useProfileStore } from '../../store/profileStore';
import { useGameStore } from '../../store/gameStore';
import { getCar } from '../../game/cars';
import { CUSTOMIZATION_DEFS, PAINT_FINISHES, defaultCustomization } from '../../game/customization';
import type { CarCustomization } from '../../game/types';
import { CarModel } from '../game/CarModel';
import { ProceduralEnv } from '../game/ProceduralEnv';
import { PartIcon } from './PartIcon';

const PRESET_COLORS = [
  '#e0242f', '#ff7b00', '#ffd60a', '#38b000', '#00b4d8', '#0353a4', '#7209b7',
  '#f8f9fa', '#6c757d', '#15151a', '#d90429', '#2d6a4f',
];

// custom PROP olarak gelir (ebeveyn canlı store verisine abone) — önizleme her
// kişiselleştirme tıklamasında anında güncellenir
function TurntableCar({ carId, custom }: { carId: string; custom: CarCustomization }) {
  const group = useRef<THREE.Group>(null);
  const stats = useMemo(() => getCar(carId), [carId]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.5;
  });
  return (
    <group ref={group}>
      <CarModel stats={stats} custom={custom} />
    </group>
  );
}

export function GarageScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  // KRİTİK: kişiselleştirme VERİSİNE abone ol (getCustomization fonksiyonu sabit referanstır —
  // ona abone olmak store değişince yeniden render TETİKLEMEZ; panel/önizleme donuk kalırdı)
  const storedCustom = useGarageStore((s) => s.customizations[s.selectedCarId]);
  const updateCustomization = useGarageStore((s) => s.updateCustomization);
  const xp = useProfileStore((s) => s.xp);
  const [activeTab, setActiveTab] = useState<'paint' | keyof CarCustomization>('paint');

  const car = getCar(selectedCarId);
  const custom = storedCustom ?? defaultCustomization(car.defaultColor);

  return (
    <div className="screen garage-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen('carSelect')}>
          ←
        </button>
        <h2>{car.name}</h2>
        <button className="primary-btn small" onClick={() => setScreen('trackSelect')}>
          YARIŞ →
        </button>
      </div>

      <div className="garage-preview">
        <Canvas
          camera={{ position: [5.5, 2.6, 5.5], fov: 42 }}
          dpr={[1, 1.6]}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <color attach="background" args={['#101018']} />
          <hemisphereLight args={['#cdd8f0', '#20222c', 1.2]} />
          <directionalLight position={[6, 8, 4]} intensity={2.2} />
          <directionalLight position={[-6, 4, -4]} intensity={0.7} color="#8fa3ff" />
          <ProceduralEnv sky="#acc8ea" horizon="#f2f6ff" ground="#2a2d38" />
          <Suspense fallback={null}>
            <TurntableCar carId={selectedCarId} custom={custom} />
          </Suspense>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <circleGeometry args={[5, 40]} />
            <meshStandardMaterial color="#181a22" roughness={0.4} metalness={0.3} />
          </mesh>
        </Canvas>
      </div>

      <div className="garage-tabs">
        <button className={`chip ${activeTab === 'paint' ? 'active' : ''}`} onClick={() => setActiveTab('paint')}>
          Boya
        </button>
        {CUSTOMIZATION_DEFS.map((d) => (
          <button
            key={d.key}
            className={`chip ${activeTab === d.key ? 'active' : ''}`}
            onClick={() => setActiveTab(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="garage-options">
        {activeTab === 'paint' ? (
          <>
            <div className="color-row">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${custom.paintColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateCustomization(selectedCarId, { paintColor: c })}
                />
              ))}
              <label className="color-dot custom-picker">
                🎨
                <input
                  type="color"
                  value={custom.paintColor}
                  onChange={(e) => updateCustomization(selectedCarId, { paintColor: e.target.value })}
                />
              </label>
            </div>
            <div className="variant-row">
              {PAINT_FINISHES.map((f) => {
                const swatch =
                  f === 'parlak'
                    ? `radial-gradient(circle at 32% 28%, #fff, ${custom.paintColor} 60%)`
                    : f === 'metalik'
                      ? `linear-gradient(135deg, #fff 0%, ${custom.paintColor} 35%, #6b7280 100%)`
                      : `linear-gradient(135deg, ${custom.paintColor}, ${custom.paintColor})`;
                return (
                  <button
                    key={f}
                    className={`variant-btn with-icon ${custom.paintFinish === f ? 'active' : ''}`}
                    onClick={() => updateCustomization(selectedCarId, { paintFinish: f })}
                  >
                    <span className="finish-swatch" style={{ background: swatch }} />
                    <span className="variant-label">{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="variant-row">
            {CUSTOMIZATION_DEFS.find((d) => d.key === activeTab)!.options.map((opt, i) => {
              const def = CUSTOMIZATION_DEFS.find((d) => d.key === activeTab)!;
              const lockXp = def.xpLocks?.[i];
              const locked = lockXp !== undefined && xp < lockXp;
              return (
                <button
                  key={opt}
                  className={`variant-btn with-icon ${custom[activeTab as keyof CarCustomization] === i ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => !locked && updateCustomization(selectedCarId, { [activeTab]: i })}
                >
                  <PartIcon cat={activeTab as string} i={i} />
                  <span className="variant-label">{opt}</span>
                  {locked && <small className="lock-tag">🔒 {lockXp} XP</small>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
