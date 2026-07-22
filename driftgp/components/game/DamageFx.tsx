// Hasar efektleri — motor dumanı (gri→kara, hasarla koyulaşır) + yangın alevi.
// DriftSmoke ile aynı desen: instanced havuz, mobil dostu (2 draw call).
// Scene her karede hasarlı araçların kaput konumundan emit eder.
// Denge: duman/yangın uzun vadeli birikimle çıkar (eşikler carPhysics'te) — hemen değil.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SMOKE_POOL = 96;
const FIRE_POOL = 48;

interface Particle {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

export interface DamageEmitter {
  /** hasar dumanı üret — dark 0..1: hafif hasarda açık gri, yangında kapkara */
  smoke: (x: number, y: number, z: number, dark: number) => void;
  /** alev üret (yangın durumu) */
  fire: (x: number, y: number, z: number) => void;
}

function makePool(n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, scale: 1,
  }));
}

const smokeColor = new THREE.Color();

export function DamageFx({ emitterRef }: { emitterRef: React.MutableRefObject<DamageEmitter | null> }) {
  const smokeMesh = useRef<THREE.InstancedMesh>(null);
  const fireMesh = useRef<THREE.InstancedMesh>(null);
  const smokeP = useMemo(() => makePool(SMOKE_POOL), []);
  const fireP = useMemo(() => makePool(FIRE_POOL), []);
  const sCur = useRef(0);
  const fCur = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  emitterRef.current = useMemo<DamageEmitter>(
    () => ({
      smoke: (x, y, z, dark) => {
        const p = smokeP[sCur.current];
        sCur.current = (sCur.current + 1) % SMOKE_POOL;
        p.maxLife = p.life = 1.1 + Math.random() * 0.5;
        p.x = x + (Math.random() - 0.5) * 0.5;
        p.y = y;
        p.z = z + (Math.random() - 0.5) * 0.5;
        p.vx = (Math.random() - 0.5) * 0.9;
        p.vy = 1.6 + Math.random() * 1.2 + dark * 0.8; // yangın dumanı daha güçlü yükselir
        p.vz = (Math.random() - 0.5) * 0.9;
        p.scale = 0.3 + Math.random() * 0.25 + dark * 0.15;
        // renk instance başına yazılır (gri → kara)
        if (smokeMesh.current) {
          const idx = (sCur.current + SMOKE_POOL - 1) % SMOKE_POOL;
          smokeColor.setRGB(0.55 - dark * 0.45, 0.55 - dark * 0.45, 0.58 - dark * 0.46);
          smokeMesh.current.setColorAt(idx, smokeColor);
          if (smokeMesh.current.instanceColor) smokeMesh.current.instanceColor.needsUpdate = true;
        }
      },
      fire: (x, y, z) => {
        const p = fireP[fCur.current];
        fCur.current = (fCur.current + 1) % FIRE_POOL;
        p.maxLife = p.life = 0.28 + Math.random() * 0.2;
        p.x = x + (Math.random() - 0.5) * 0.55;
        p.y = y;
        p.z = z + (Math.random() - 0.5) * 0.55;
        p.vx = (Math.random() - 0.5) * 0.7;
        p.vy = 2.2 + Math.random() * 1.6;
        p.vz = (Math.random() - 0.5) * 0.7;
        p.scale = 0.22 + Math.random() * 0.2;
      },
    }),
    [smokeP, fireP],
  );

  // instanceColor buffer'ını baştan oluştur (ilk emit'te shader yeniden derlenmesin)
  useLayoutEffect(() => {
    const sm = smokeMesh.current;
    if (!sm) return;
    smokeColor.setRGB(0.55, 0.55, 0.58);
    for (let i = 0; i < SMOKE_POOL; i++) sm.setColorAt(i, smokeColor);
    if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const sm = smokeMesh.current;
    if (sm) {
      for (let i = 0; i < SMOKE_POOL; i++) {
        const p = smokeP[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy *= 1 - dt * 0.3; // yükselirken yavaşlar
          const t = 1 - p.life / p.maxLife;
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.setScalar(p.scale * (0.5 + t * 2.6) * Math.max(0, Math.min(1, p.life * 2.2)));
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
    const fm = fireMesh.current;
    if (fm) {
      for (let i = 0; i < FIRE_POOL; i++) {
        const p = fireP[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const t = 1 - p.life / p.maxLife;
          dummy.position.set(p.x, p.y, p.z);
          // alev: hızla büyür, uçta sönerek küçülür (titrek yangın dili)
          dummy.scale.setScalar(p.scale * (1 + t * 1.4) * Math.max(0, 1 - t * t));
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={smokeMesh} args={[undefined, undefined, SMOKE_POOL]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshBasicMaterial transparent opacity={0.42} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={fireMesh} args={[undefined, undefined, FIRE_POOL]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshBasicMaterial color="#ff8c1a" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}
