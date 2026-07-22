// Pist görseli: asfalt şerit, kırmızı-beyaz kerb, bariyerler, start çizgisi ve ışık köprüsü.
// Tüm geometri track.ts örneklerinden üretilir — fizikle birebir aynı veri.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TrackData } from '../../game/track';
import type { TrackDef } from '../../game/tracks';

function buildRibbon(track: TrackData, inner: number, outer: number, y: number): THREE.BufferGeometry {
  const { samples, count } = track;
  const positions = new Float32Array((count + 1) * 2 * 3);
  const uvs = new Float32Array((count + 1) * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const s = samples[i % count];
    const base = i * 6;
    positions[base] = s.x + s.nx * inner;
    positions[base + 1] = y;
    positions[base + 2] = s.z + s.nz * inner;
    positions[base + 3] = s.x + s.nx * outer;
    positions[base + 4] = y;
    positions[base + 5] = s.z + s.nz * outer;
    uvs[i * 4] = 0;
    uvs[i * 4 + 1] = i * 0.15;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = i * 0.15;
    if (i < count) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Kerb: kısa segmentler halinde kırmızı/beyaz vertex renkli şerit */
function buildKerb(track: TrackData, inner: number, outer: number): THREE.BufferGeometry {
  const geo = buildRibbon(track, inner, outer, 0.02);
  const count = track.count;
  const colors = new Float32Array((count + 1) * 2 * 3);
  const red = new THREE.Color('#d21f2c');
  const white = new THREE.Color('#e8e8ea');
  for (let i = 0; i <= count; i++) {
    const c = Math.floor(i / 6) % 2 === 0 ? red : white;
    for (let v = 0; v < 2; v++) {
      const base = (i * 2 + v) * 3;
      colors[base] = c.r;
      colors[base + 1] = c.g;
      colors[base + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Bariyer duvarı: dikey şerit */
function buildWall(track: TrackData, offset: number, height: number): THREE.BufferGeometry {
  const { samples, count } = track;
  const positions = new Float32Array((count + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const s = samples[i % count];
    const base = i * 6;
    positions[base] = s.x + s.nx * offset;
    positions[base + 1] = 0;
    positions[base + 2] = s.z + s.nz * offset;
    positions[base + 3] = s.x + s.nx * offset;
    positions[base + 4] = height;
    positions[base + 5] = s.z + s.nz * offset;
    if (i < count) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function TrackMesh({ track, def }: { track: TrackData; def: TrackDef }) {
  const hw = track.halfWidth;
  const asphalt = useMemo(() => buildRibbon(track, -hw, hw, 0.01), [track, hw]);
  const kerbL = useMemo(() => buildKerb(track, hw, hw + 1.2), [track, hw]);
  const kerbR = useMemo(() => buildKerb(track, -hw - 1.2, -hw), [track, hw]);
  const wallL = useMemo(() => buildWall(track, hw + 1.6, 1.1), [track, hw]);
  const wallR = useMemo(() => buildWall(track, -hw - 1.6, 1.1), [track, hw]);

  // pist sınırlarından zemin düzlemi (pist büyüdükçe zemin de kapsar)
  const groundInfo = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of track.samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxZ - minZ) + 400; // kenar payı
    return { cx, cz, size };
  }, [track]);

  // zemin dokusu — düz tek renk yerine hafif gürültü/leke varyasyonu (derinlik hissi)
  const groundTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const base = new THREE.Color(def.colors.ground);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, 256, 256);
    // deterministik benekler (koyu + açık) — organik zemin varyasyonu
    let s = 1337;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const rad = 1 + rnd() * 8;
      const dark = rnd() > 0.5;
      const shade = base.clone().multiplyScalar(dark ? 0.82 + rnd() * 0.1 : 1.08 + rnd() * 0.12);
      ctx.fillStyle = `rgba(${Math.round(Math.min(255, shade.r * 255))},${Math.round(Math.min(255, shade.g * 255))},${Math.round(Math.min(255, shade.b * 255))},${0.25 + rnd() * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [def.colors.ground]);

  // dokuyu zemin boyutuna göre döşe (~28m/kutucuk) — tek dev karo yerine tekrar
  useMemo(() => {
    const r = Math.max(4, Math.round(groundInfo.size / 28));
    groundTex.repeat.set(r, r);
    groundTex.needsUpdate = true;
  }, [groundTex, groundInfo.size]);

  const centerLine = useMemo(() => buildRibbon(track, -0.22, 0.22, 0.02), [track]);
  const centerLineTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 4, 16);
    ctx.fillStyle = '#eef0f4';
    ctx.fillRect(0, 0, 4, 9); // çizgi + boşluk (dashed)
    const tex = new THREE.CanvasTexture(c);
    tex.wrapT = THREE.RepeatWrapping;
    tex.wrapS = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const startSample = track.samples[0];
  const startAngle = Math.atan2(startSample.tz, startSample.tx);

  const startLineTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f2f2f2' : '#101014';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <group>
      {/* zemin — pist merkezine göre, pisti kapsayacak boyutta */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[groundInfo.cx, -0.05, groundInfo.cz]} receiveShadow>
        <planeGeometry args={[groundInfo.size, groundInfo.size]} />
        <meshStandardMaterial map={groundTex} color={def.colors.ground} roughness={1} />
      </mesh>
      {/* asfalt */}
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial color={def.colors.asphalt} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* yol orta çizgisi (kesikli) */}
      <mesh geometry={centerLine}>
        <meshStandardMaterial map={centerLineTex} transparent alphaTest={0.5} roughness={0.6} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {/* kerbler */}
      <mesh geometry={kerbL}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      <mesh geometry={kerbR}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {/* bariyerler */}
      <mesh geometry={wallL} castShadow>
        <meshStandardMaterial color={def.colors.wall} roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={wallR} castShadow>
        <meshStandardMaterial color={def.colors.wall} roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* start çizgisi */}
      <mesh
        rotation={[-Math.PI / 2, 0, -startAngle]}
        position={[startSample.x, 0.03, startSample.z]}
      >
        <planeGeometry args={[3, hw * 2]} />
        <meshBasicMaterial map={startLineTex} />
      </mesh>
      {/* start köprüsü */}
      <group position={[startSample.x, 0, startSample.z]} rotation={[0, -startAngle, 0]}>
        <mesh position={[0, 2.6, hw + 1]} castShadow>
          <boxGeometry args={[0.5, 5.2, 0.5]} />
          <meshStandardMaterial color="#3a3d46" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.6, -hw - 1]} castShadow>
          <boxGeometry args={[0.5, 5.2, 0.5]} />
          <meshStandardMaterial color="#3a3d46" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 5.4, 0]} castShadow>
          <boxGeometry args={[0.8, 0.8, hw * 2 + 3]} />
          <meshStandardMaterial color="#3a3d46" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
