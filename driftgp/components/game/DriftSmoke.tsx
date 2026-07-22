// Drift dumanı — hafif instanced partikül havuzu (mobil dostu).

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const POOL = 64;

interface Particle {
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

export interface SmokeEmitter {
  /** arka tekerlek dünya konumunda duman üret */
  emit: (x: number, z: number) => void;
}

export function DriftSmoke({ emitterRef }: { emitterRef: React.MutableRefObject<SmokeEmitter | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        life: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1,
      })),
    [],
  );
  const cursor = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  emitterRef.current = useMemo<SmokeEmitter>(
    () => ({
      emit: (x, z) => {
        const p = particles[cursor.current];
        cursor.current = (cursor.current + 1) % POOL;
        p.life = 0.9;
        p.x = x + (Math.random() - 0.5) * 0.4;
        p.y = 0.25;
        p.z = z + (Math.random() - 0.5) * 0.4;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = 1.2 + Math.random() * 0.8;
        p.vz = (Math.random() - 0.5) * 1.5;
        p.scale = 0.35 + Math.random() * 0.3;
      },
    }),
    [particles],
  );

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < POOL; i++) {
      const p = particles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = 1 - p.life / 0.9;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.scale * (0.6 + t * 2.2) * Math.max(0, p.life * 2));
        dummy.updateMatrix();
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
      }
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <sphereGeometry args={[0.5, 6, 5]} />
      <meshBasicMaterial color="#b9bcc4" transparent opacity={0.32} depthWrite={false} />
    </instancedMesh>
  );
}
