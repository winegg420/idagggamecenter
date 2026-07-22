// Pist temalarına göre çevre: gece şehri, volkan (lav + kor partikülleri), sahil, orman.
// Tüm yerleşim deterministik (seed'li) — her yüklemede aynı sahne.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TrackData } from '../../game/track';
import type { EnvTheme } from '../../game/tracks';
import { QUALITY } from '../../game/quality';

function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

interface ScatterItem {
  x: number;
  z: number;
  r: number; // 0..1 rastgele
  side: number;
}

/**
 * Pist dışına, pistin BAŞKA bir kısmına çarpmayacak şekilde nokta dağıtır.
 * clearance = objenin yol kenarından bırakması gereken sabit güvenli mesafe (m).
 * NOT: reddetme eşiği `halfWidth + clearance` sabittir — eskiden `minD*0.55` idi ve
 * halfWidth 9→13 büyütülünce yola yakın objeler (minD < ~29) toptan reddediliyordu.
 * Yola yakın obje için minD ≳ halfWidth + clearance seçilmeli.
 */
function scatter(track: TrackData, step: number, minD: number, maxD: number, seed: number, clearance = 4): ScatterItem[] {
  const rand = makeRand(seed);
  const items: ScatterItem[] = [];
  const rejectSq = (track.halfWidth + clearance) ** 2;
  // mobilde obje sayısını seyrelt (adım büyüt) — performans
  step = Math.max(1, Math.round(step * QUALITY.stepMul));
  for (let i = 0; i < track.count; i += step) {
    const s = track.samples[i];
    const side = rand() > 0.5 ? 1 : -1;
    const dist = minD + rand() * (maxD - minD);
    const x = s.x + s.nx * side * dist;
    const z = s.z + s.nz * side * dist;
    let ok = true;
    for (let j = 0; j < track.count; j += 10) {
      const t = track.samples[j];
      if ((t.x - x) ** 2 + (t.z - z) ** 2 < rejectSq) {
        ok = false;
        break;
      }
    }
    if (ok) items.push({ x, z, r: rand(), side });
  }
  return items;
}

function trackCenter(track: TrackData): [number, number] {
  let cx = 0;
  let cz = 0;
  for (const s of track.samples) {
    cx += s.x;
    cz += s.z;
  }
  return [cx / track.count, cz / track.count];
}

// ---------- Şehir (gece) ----------

function useWindowTexture(seed: number) {
  return useMemo(() => {
    const rand = makeRand(seed);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    // seed'e göre FARKLI cephe deseni: dikey aralık, pencere eni/boyu, tip (grid / yatay bant / geniş cam)
    const facade = seed % 3; // 0 klasik grid, 1 yatay şerit cephe, 2 geniş cam paneller
    const bg = ['#0c0e18', '#101422', '#0a0c14'][seed % 3];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 64, 128);
    const colors = ['#ffd970', '#9fd8ff', '#ffb56b', '#fff3c8', '#2a3242', '#222a38'];
    if (facade === 1) {
      // yatay ışık şeritleri
      for (let y = 6; y < 122; y += 8) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(3, y, 58, 3 + Math.floor(rand() * 2));
      }
    } else {
      const gap = facade === 2 ? 16 : 9 + (seed % 2) * 2;
      const wW = facade === 2 ? 12 : 5 + (seed % 3);
      const wH = facade === 2 ? 10 : 6;
      for (let y = 4; y < 124; y += gap + wH - 4)
        for (let x = 4; x < 60; x += gap) {
          ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
          ctx.fillRect(x, y, wW, wH);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [seed]);
}

const NEON_COLORS = ['#ff2d6f', '#2df0ff', '#b14cff', '#3aff8e', '#ffcf3a', '#ff6a2d'];

function CityEnv({ track }: { track: TrackData }) {
  const [cx, cz] = useMemo(() => trackCenter(track), [track]);
  // 8 farklı cephe dokusu (grid / yatay şerit / geniş cam) → tekrar hissi azalır
  const winTex = [
    useWindowTexture(7), useWindowTexture(98), useWindowTexture(180), useWindowTexture(263),
    useWindowTexture(41), useWindowTexture(122), useWindowTexture(205), useWindowTexture(316),
  ];
  // üç sıra bina: yakın (yola bitişik) + orta + uzak (gökdelen) → yoğun şehir hissi
  const nearBuildings = useMemo(() => scatter(track, 9, 18, 30, 1234, 6), [track]);
  const midBuildings = useMemo(() => scatter(track, 12, 30, 50, 2468, 6), [track]);
  const farBuildings = useMemo(() => scatter(track, 13, 50, 82, 4321, 6), [track]);
  // infield downtown çekirdeği — imza silüet (kümelenmiş süpergökdelenler, çeşitli yükseklik)
  const downtown = useMemo(() => {
    const rand = makeRand(31);
    return Array.from({ length: 9 }).map(() => ({
      x: cx + (rand() - 0.5) * 90,
      z: cz + (rand() - 0.5) * 90,
      h: 55 + rand() * 55,
      w: 9 + rand() * 7,
      rot: rand() * Math.PI,
      neon: NEON_COLORS[Math.floor(rand() * NEON_COLORS.length)],
    }));
  }, [cx, cz]);
  const lamps = useMemo(() => scatter(track, 22, 15.5, 18, 555, 2.5), [track]);
  const billboards = useMemo(() => scatter(track, 26, 15.5, 20, 909, 2.5), [track]);

  const renderBuilding = (b: ScatterItem, i: number, tall: boolean) => {
    const rand = ((b.r * 9301 + i * 49297) % 233280) / 233280;
    const h = tall ? 20 + b.r * 34 : 10 + b.r * 26; // yakın binalar da daha yüksek varyasyon
    const w = 6 + rand * 8;
    const d = 6 + b.r * 8;
    const tex = winTex[i % winTex.length];
    const neon = rand > 0.62;
    const neonColor = NEON_COLORS[i % NEON_COLORS.length];
    // balkonlar + balkonda insanlar (yakın binalarda, düşük-uçlu cihazda atla)
    const balconies = !tall && !QUALITY.lowEnd ? [0.34, 0.56, 0.78] : [];
    return (
      <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.r * Math.PI, 0]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            map={tex}
            emissiveMap={tex}
            emissive="#ffffff"
            emissiveIntensity={0.9}
            color={['#1b1d29', '#232430', '#191b26', '#20222e'][i % 4]}
          />
        </mesh>
        {/* kademeli üst kat (setback) — yüksek binalarda kule silüeti çeşitliliği */}
        {tall && rand > 0.4 && (
          <mesh position={[0, h + h * 0.14, 0]}>
            <boxGeometry args={[w * 0.62, h * 0.28, d * 0.62]} />
            <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.85} color="#1b1d29" />
          </mesh>
        )}
        {/* çatı detayı (anten / su deposu) */}
        <mesh position={[w * 0.2, h + (tall && rand > 0.4 ? h * 0.28 : 0) + 1.2, 0]}>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#2a2d3a" />
        </mesh>
        {/* balkonlar + insanlar (yola bakan cephe) */}
        {balconies.map((fy, bi) => (
          <group key={`bal${bi}`} position={[w / 2 + 0.18, h * fy, (bi - 1) * d * 0.3]}>
            <mesh>
              <boxGeometry args={[0.55, 0.09, 1.3]} />
              <meshStandardMaterial color="#2a2d3a" />
            </mesh>
            <mesh position={[0.24, 0.24, 0]}>
              <boxGeometry args={[0.05, 0.42, 1.3]} />
              <meshStandardMaterial color="#3a3f4c" metalness={0.5} roughness={0.5} />
            </mesh>
            <group position={[0, 0.38, bi % 2 ? 0.28 : -0.28]}>
              <mesh>
                <capsuleGeometry args={[0.12, 0.42, 3, 5]} />
                <meshStandardMaterial color={SPECTATOR_COLORS[(i + bi) % SPECTATOR_COLORS.length]} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.37, 0]}>
                <sphereGeometry args={[0.1, 6, 5]} />
                <meshStandardMaterial color="#c79a76" />
              </mesh>
            </group>
          </group>
        ))}
        {/* neon dikey tabela */}
        {neon && (
          <mesh position={[w / 2 + 0.06, h * 0.55, 0]}>
            <boxGeometry args={[0.12, h * 0.5, 1.1]} />
            <meshStandardMaterial color={neonColor} emissive={neonColor} emissiveIntensity={3.2} toneMapped={false} />
          </mesh>
        )}
        {/* çatı kenarı neon şerit */}
        {neon && (
          <mesh position={[0, h + 0.05, 0]}>
            <boxGeometry args={[w + 0.1, 0.14, d + 0.1]} />
            <meshStandardMaterial color={neonColor} emissive={neonColor} emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
        )}
      </group>
    );
  };

  return (
    <group>
      {farBuildings.map((b, i) => renderBuilding(b, i, true))}
      {midBuildings.map((b, i) => renderBuilding(b, i + 3000, i % 2 === 0))}
      {nearBuildings.map((b, i) => renderBuilding(b, i + 5000, false))}

      {/* sokak lambaları */}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 4.8, 6]} />
            <meshStandardMaterial color="#2c2f3a" />
          </mesh>
          <mesh position={[0, 4.8, 0]}>
            <sphereGeometry args={[0.24, 8, 6]} />
            <meshStandardMaterial color="#fff0b0" emissive="#ffc84d" emissiveIntensity={4.5} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 4.6, 0]} color="#ffca70" intensity={55} distance={34} decay={1.4} />
          {/* her 3. lambada trafik ışığı */}
          {i % 3 === 0 && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 5.4, 0]}>
                <boxGeometry args={[0.3, 0.9, 0.25]} />
                <meshStandardMaterial color="#15151a" />
              </mesh>
              <mesh position={[0, 5.15, 0.14]}>
                <sphereGeometry args={[0.1, 6, 5]} />
                <meshStandardMaterial color="#33ff66" emissive="#33ff66" emissiveIntensity={3} toneMapped={false} />
              </mesh>
            </group>
          )}
        </group>
      ))}

      {/* yol kenarı reklam panoları (emissive, ışık maliyeti yok) */}
      {billboards.map((b, i) => {
        const c = NEON_COLORS[(i + 2) % NEON_COLORS.length];
        return (
          <group key={i} position={[b.x, 0, b.z]} rotation={[0, Math.atan2(b.x, b.z) + Math.PI / 2, 0]}>
            <mesh position={[0, 2.2, 0]}>
              <boxGeometry args={[0.2, 4.4, 0.2]} />
              <meshStandardMaterial color="#2a2d3a" />
            </mesh>
            <mesh position={[0, 5, 0]}>
              <boxGeometry args={[0.15, 2, 3.2]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* infield downtown çekirdeği — imza gökdelen silüeti (uzaktan tanınır) */}
      {downtown.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
          <mesh position={[0, b.h / 2, 0]} castShadow>
            <boxGeometry args={[b.w, b.h, b.w]} />
            <meshStandardMaterial map={winTex[i % winTex.length]} emissiveMap={winTex[i % winTex.length]} emissive="#ffffff" emissiveIntensity={0.9} color="#161825" />
          </mesh>
          {/* tepe anteni + kırmızı ikaz ışığı */}
          <mesh position={[0, b.h + 3, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 6, 5]} />
            <meshStandardMaterial color="#2a2d3a" />
          </mesh>
          <mesh position={[0, b.h + 6, 0]}>
            <sphereGeometry args={[0.4, 6, 5]} />
            <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          {/* çatı neon şeridi */}
          <mesh position={[0, b.h, 0]}>
            <boxGeometry args={[b.w + 0.2, 0.2, b.w + 0.2]} />
            <meshStandardMaterial color={b.neon} emissive={b.neon} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* tribün + kalabalık (Şehir'de belirgin) */}
      <Grandstands track={track} />
      <Crowd track={track} everyN={30} seed={4801} rows={4} />
    </group>
  );
}

// ---------- Volkan ----------

const EMBER_COUNT = 120;

function VolcanoEnv({ track }: { track: TrackData }) {
  const [cx, cz] = useMemo(() => trackCenter(track), [track]);
  const rocks = useMemo(() => scatter(track, 14, 15.5, 48, 777, 2.5), [track]);
  const embers = useRef<THREE.Points>(null);
  const emberData = useMemo(() => {
    const rand = makeRand(31);
    const pos = new Float32Array(EMBER_COUNT * 3);
    const vel = new Float32Array(EMBER_COUNT);
    for (let i = 0; i < EMBER_COUNT; i++) {
      pos[i * 3] = cx + (rand() - 0.5) * 260;
      pos[i * 3 + 1] = rand() * 40;
      pos[i * 3 + 2] = cz + (rand() - 0.5) * 260;
      vel[i] = 1.5 + rand() * 3;
    }
    return { pos, vel };
  }, [cx, cz]);

  const lavaGlow = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state, dt) => {
    const pts = embers.current;
    if (pts) {
      const arr = (pts.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < EMBER_COUNT; i++) {
        arr[i * 3 + 1] += emberData.vel[i] * dt;
        arr[i * 3] += Math.sin(state.clock.elapsedTime * 0.8 + i) * dt * 1.2;
        if (arr[i * 3 + 1] > 45) arr[i * 3 + 1] = 0;
      }
      (pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
    if (lavaGlow.current) {
      lavaGlow.current.emissiveIntensity = 1.6 + Math.sin(state.clock.elapsedTime * 2.3) * 0.5;
    }
  });

  const volcanoPos: [number, number, number] = [cx + 150, 0, cz + 60];

  return (
    <group>
      {/* volkan konisi */}
      <group position={volcanoPos}>
        <mesh position={[0, 32, 0]}>
          <coneGeometry args={[75, 64, 24, 1, true]} />
          <meshStandardMaterial color="#3a2420" roughness={1} side={THREE.DoubleSide} />
        </mesh>
        {/* krater ağzı */}
        <mesh position={[0, 62, 0]}>
          <cylinderGeometry args={[13, 17, 6, 16]} />
          <meshStandardMaterial ref={lavaGlow} color="#ff5a1f" emissive="#ff3d00" emissiveIntensity={2} />
        </mesh>
        {/* akan lav şeridi */}
        <mesh position={[-24, 30, 10]} rotation={[0, 0.3, 0.86]}>
          <planeGeometry args={[62, 7]} />
          <meshStandardMaterial color="#ff6b1f" emissive="#ff4400" emissiveIntensity={1.8} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 70, 0]} color="#ff5a1f" intensity={2200} distance={320} />
        {/* duman */}
        <mesh position={[0, 78, 0]}>
          <sphereGeometry args={[16, 10, 8]} />
          <meshBasicMaterial color="#241a18" transparent opacity={0.55} />
        </mesh>
      </group>
      {/* kor partikülleri */}
      <points ref={embers}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[emberData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ff7a30" size={0.5} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      {/* kayalar */}
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, 0.8 + r.r, r.z]} rotation={[r.r * 2, r.r * 5, 0]}>
          <dodecahedronGeometry args={[1 + r.r * 2.2, 0]} />
          <meshStandardMaterial color="#3d2c26" roughness={1} />
        </mesh>
      ))}
      {/* zemindeki lav çatlakları */}
      {rocks.filter((_, i) => i % 3 === 0).map((r, i) => (
        <mesh key={i} position={[r.x + 3, 0.02, r.z + 2]} rotation={[-Math.PI / 2, 0, r.r * 3]}>
          <planeGeometry args={[4 + r.r * 5, 1.1]} />
          <meshStandardMaterial color="#ff5a1f" emissive="#ff3d00" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {/* bazalt sütunları — imza volkanik kaya (uzun altıgen koyu kolonlar) */}
      {rocks.filter((_, i) => i % 4 === 1).map((r, i) => {
        const h = 5 + r.r * 9;
        return (
          <group key={i} position={[r.x - 4, 0, r.z - 3]} rotation={[0, r.r * 6, r.r * 0.12 - 0.06]}>
            <mesh position={[0, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.8 + r.r * 0.6, 1 + r.r * 0.7, h, 6]} />
              <meshStandardMaterial color="#2b2320" roughness={1} flatShading />
            </mesh>
            {/* tepe kızıl kor parıltısı */}
            <mesh position={[0, h + 0.1, 0]}>
              <cylinderGeometry args={[0.6, 0.8, 0.3, 6]} />
              <meshStandardMaterial color="#ff5a1f" emissive="#ff3d00" emissiveIntensity={1.6} />
            </mesh>
          </group>
        );
      })}
      {/* lav fıskiyesi — kraterden yükselen kor konileri (imza hareket) */}
      <group position={[volcanoPos[0], 60, volcanoPos[2]]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 4, 4 + (i % 2) * 3, Math.sin(a) * 4]} rotation={[0, 0, Math.cos(a) * 0.3]}>
              <coneGeometry args={[1.2, 8 + (i % 3) * 3, 5]} />
              <meshBasicMaterial color="#ff6a1f" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
      {/* uzak seyirci (güvenli mesafede, seyrek — volkan izleyicileri) */}
      <Crowd track={track} everyN={70} seed={5252} rows={2} />
    </group>
  );
}

// ---------- Sahil ----------

function CoastEnv({ track }: { track: TrackData }) {
  const [cx, cz] = useMemo(() => trackCenter(track), [track]);
  const palms = useMemo(() => scatter(track, 10, 15.5, 40, 4242, 2.5), [track]);
  const rocks = useMemo(() => scatter(track, 26, 15.5, 44, 3131, 2.5), [track]);
  const huts = useMemo(() => scatter(track, 34, 16, 32, 6060, 5), [track]);
  const seaRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (seaRef.current) seaRef.current.position.y = -0.5 + Math.sin(state.clock.elapsedTime * 0.7) * 0.15;
  });
  const HUT_COLORS = ['#e9c46a', '#e76f51', '#2a9d8f', '#f4a261', '#e5e5e0'];
  return (
    <group>
      {/* deniz — pistin bir tarafında büyük düzlem */}
      <mesh ref={seaRef} rotation={[-Math.PI / 2, 0, 0]} position={[cx - 320, -0.5, cz]}>
        <planeGeometry args={[500, 800]} />
        <meshStandardMaterial color="#1b9aaa" roughness={0.15} metalness={0.4} transparent opacity={0.93} />
      </mesh>
      {/* uzak kıyı tepeleri — derinlik/atmosfer (pistin kara tarafını çevreler) */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const rad = 300 + (i % 2) * 60;
        return (
          <mesh key={i} position={[cx + Math.cos(a) * rad, 8, cz + Math.sin(a) * rad]}>
            <coneGeometry args={[90 + (i % 3) * 30, 70 + (i % 2) * 40, 7]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#c7b48a' : '#a7b98f'} roughness={1} flatShading />
          </mesh>
        );
      })}
      {/* plaj kayaları */}
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, 0.4 + r.r * 0.6, r.z]} rotation={[r.r * 2, r.r * 5, r.r]}>
          <dodecahedronGeometry args={[0.8 + r.r * 1.8, 0]} />
          <meshStandardMaterial color={r.r > 0.5 ? '#b8ad93' : '#9c9483'} roughness={1} />
        </mesh>
      ))}
      {/* renkli plaj kulübeleri / kabanalar */}
      {huts.map((h, i) => {
        const c = HUT_COLORS[i % HUT_COLORS.length];
        return (
          <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.r * Math.PI * 2, 0]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[3.2, 2.2, 2.8]} />
              <meshStandardMaterial color="#efe7d8" roughness={0.9} />
            </mesh>
            {/* çatı */}
            <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[2.6, 1.1, 4]} />
              <meshStandardMaterial color={c} roughness={0.8} />
            </mesh>
            {/* kapı */}
            <mesh position={[0, 0.7, 1.42]}>
              <boxGeometry args={[0.9, 1.4, 0.06]} />
              <meshStandardMaterial color={c} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      {/* cankurtaran kuleleri (her 3. kabana konumunda) */}
      {huts.filter((_, i) => i % 3 === 0).map((h, i) => (
        <group key={i} position={[h.x + 5, 0, h.z + 4]}>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[2, 0.3, 2]} />
            <meshStandardMaterial color="#d94f45" roughness={0.8} />
          </mesh>
          {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([dx, dz], k) => (
            <mesh key={k} position={[dx, 0.7, dz]}>
              <cylinderGeometry args={[0.08, 0.08, 1.4, 5]} />
              <meshStandardMaterial color="#8a6a48" roughness={1} />
            </mesh>
          ))}
          <mesh position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.7, 1, 4]} />
            <meshStandardMaterial color="#f1faee" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {palms.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.r * 6, 0]} scale={0.85 + p.r * 0.5}>
          <mesh position={[0.3, 2.6, 0]} rotation={[0, 0, -0.18]} castShadow>
            <cylinderGeometry args={[0.14, 0.24, 5.4, 7]} />
            <meshStandardMaterial color="#8a6a48" roughness={1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((f) => (
            <mesh key={f} position={[0.75, 5.2, 0]} rotation={[0.5 + (f % 2) * 0.35, (f / 5) * Math.PI * 2, 0]}>
              <coneGeometry args={[0.35, 2.6, 4]} />
              <meshStandardMaterial color="#2e8b46" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
      {/* plaj şemsiyeleri */}
      {palms.filter((_, i) => i % 4 === 0).map((p, i) => (
        <group key={i} position={[p.x + 4, 0, p.z + 3]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.2, 6]} />
            <meshStandardMaterial color="#dfe3e8" />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <coneGeometry args={[1.3, 0.5, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#e63946' : '#f4a261'} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* imza: denize uzanan iskele + demirlemiş tekneler */}
      <Pier x={cx - 240} z={cz} />
      {[0, 1, 2, 3].map((i) => (
        <Boat key={i} x={cx - 250 - i * 14} z={cz + 22 + i * 10} r={(i % 2)} ang={0.4 + i * 0.5} scale={0.8 + (i % 2) * 0.4} />
      ))}
      {/* seyirci kalabalığı (pist kenarı) */}
      <Crowd track={track} everyN={40} seed={7373} rows={3} />
    </group>
  );
}

// ---------- Orman ----------

function ForestEnv({ track }: { track: TrackData }) {
  const [cx, cz] = useMemo(() => trackCenter(track), [track]);
  const trees = useMemo(() => scatter(track, 6, 15.5, 52, 909, 2.5), [track]);
  return (
    <group>
      {/* uzak dağlar */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[cx + Math.cos(a) * 330, 20, cz + Math.sin(a) * 330]}>
            <coneGeometry args={[130, 130, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#5c6b70' : '#4a5a52'} roughness={1} flatShading />
          </mesh>
        );
      })}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={0.9 + t.r * 1.1}>
          <mesh position={[0, 1.4, 0]} castShadow={i % 3 === 0}>
            <cylinderGeometry args={[0.22, 0.34, 2.8, 6]} />
            <meshStandardMaterial color="#5a4632" roughness={1} />
          </mesh>
          <mesh position={[0, 4.2, 0]} castShadow={i % 3 === 0}>
            <coneGeometry args={[1.9, 4.8, 7]} />
            <meshStandardMaterial color={t.r > 0.6 ? '#2f6b33' : '#25532b'} roughness={1} />
          </mesh>
        </group>
      ))}
      {/* imza: kayalık uçurum + şelale (arka planda, ağaçların üstünden görünür) */}
      <Waterfall x={cx} z={cz - 220} />
      {/* kütük kulübeler (bazı ağaç konumlarında — yol kenarı, güvenli) */}
      {trees.filter((_, i) => i % 34 === 5).map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.r * 6, 0]}>
          <mesh position={[0, 1.3, 0]} castShadow>
            <boxGeometry args={[4.5, 2.6, 3.6]} />
            <meshStandardMaterial color="#6b4a30" roughness={1} />
          </mesh>
          <mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[3.4, 1.6, 4]} />
            <meshStandardMaterial color="#4a3522" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* seyirci kalabalığı (rally izleyicileri, yol kenarı) */}
      <Crowd track={track} everyN={44} seed={9091} rows={2} />
    </group>
  );
}

// ---------- Riviera / Liman (Monaco karakteri, kopya değil) ----------

const SPECTATOR_COLORS = ['#e63946', '#f4a261', '#457b9d', '#2a9d8f', '#e9c46a', '#f1faee', '#8d99ae', '#bc6c25'];

/** Pist kenarına tribün + kalabalık (instanced seyirci noktaları — performans dostu) */
function Grandstands({ track }: { track: TrackData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { spectators, platforms } = useMemo(() => {
    const rand = makeRand(2024);
    const spectators: Array<{ pos: [number, number, number]; color: THREE.Color }> = [];
    const platforms: Array<{ pos: [number, number, number]; angle: number }> = [];
    for (let i = 0; i < track.count; i += 46) {
      const s = track.samples[i];
      const side = i % 92 === 0 ? 1 : -1;
      const base = track.halfWidth + 4;
      platforms.push({
        pos: [s.x + s.nx * side * (track.halfWidth + 5.5), 1.0, s.z + s.nz * side * (track.halfWidth + 5.5)],
        angle: Math.atan2(s.tz, s.tx),
      });
      for (let row = 0; row < 4; row++)
        for (let col = -3; col <= 2; col++) {
          if (rand() < 0.25) continue;
          const dist = base + row * 1.1;
          const along = col * 1.3;
          spectators.push({
            pos: [s.x + s.nx * side * dist + s.tx * along, 0.9 + row * 0.55, s.z + s.nz * side * dist + s.tz * along],
            color: new THREE.Color(SPECTATOR_COLORS[Math.floor(rand() * SPECTATOR_COLORS.length)]),
          });
        }
    }
    return { spectators, platforms };
  }, [track]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < spectators.length; i++) {
      dummy.position.set(...spectators[i].pos);
      dummy.scale.set(0.5, 0.7, 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, spectators[i].color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spectators]);

  return (
    <>
      {platforms.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={[0, -p.angle, 0]}>
          <boxGeometry args={[9, 2.2, 5]} />
          <meshStandardMaterial color="#9aa0ac" roughness={0.9} />
        </mesh>
      ))}
      <instancedMesh ref={meshRef} args={[undefined, undefined, spectators.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
    </>
  );
}

function RivieraEnv({ track }: { track: TrackData }) {
  const [cx, cz] = useMemo(() => trackCenter(track), [track]);
  // liman kenarı = pistin min-z tarafı (deniz orada, pise çok yakın)
  const minZ = useMemo(() => Math.min(...track.samples.map((s) => s.z)), [track]);
  const buildings = useMemo(() => scatter(track, 16, 14, 44, 5150, 6), [track]);
  const winTex = useWindowTexture(521);
  const palms = useMemo(() => scatter(track, 28, 11.5, 22, 808, 2.5), [track]);
  const yachts = useMemo(() => {
    // liman düzlüğü boyunca marina — pist kenarına YAKIN, bazıları SÜPER yat (büyük)
    const rand = makeRand(77);
    const list: Array<{ x: number; z: number; r: number; ang: number; s: number; big: boolean }> = [];
    const step = Math.max(12, Math.round(16 * QUALITY.stepMul));
    let k = 0;
    for (let i = 0; i < track.count; i += step) {
      const s = track.samples[i];
      if (s.z > cz) continue; // liman yarısı
      const big = k % 3 === 0; // her 3. yat süper yat
      const dist = track.halfWidth + (big ? 14 : 8) + rand() * 12;
      list.push({ x: s.x + s.nx * dist, z: s.z + s.nz * dist, r: rand(), ang: Math.atan2(s.tz, s.tx), s: big ? 1.6 + rand() * 0.6 : 0.95 + rand() * 0.5, big });
      k++;
    }
    return list;
  }, [track, cz]);
  const seaRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (seaRef.current) seaRef.current.position.y = -0.4 + Math.sin(state.clock.elapsedTime * 0.6) * 0.12;
  });

  return (
    <group>
      {/* deniz — liman düzlüğünün (min-z) hemen dışında, pise ÇOK yakın */}
      <mesh ref={seaRef} rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.4, minZ - 300]}>
        <planeGeometry args={[1300, 700]} />
        <meshStandardMaterial color="#1f8fb0" roughness={0.08} metalness={0.6} transparent opacity={0.95} />
      </mesh>
      {/* rıhtım şeridi (liman ile deniz arası taş kenar) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, minZ - 22]}>
        <planeGeometry args={[700, 40]} />
        <meshStandardMaterial color="#b9b0a0" roughness={0.9} />
      </mesh>

      {/* lüks binalar — pencere dokusu + balkonlar + çeşitli çatı (daha az "kutu") */}
      {buildings.map((b, i) => {
        const rnd = ((b.r * 9301 + i * 49297) % 233280) / 233280;
        const h = 12 + b.r * 26;
        const w = 8 + rnd * 7;
        const d = 7 + b.r * 6;
        const tint = ['#e8ded0', '#d8c9b0', '#cdb89a', '#e5d5c0', '#dcc6a8'][i % 5];
        return (
          <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.r * Math.PI, 0]}>
            {/* pencereli gövde */}
            <mesh position={[0, h / 2, 0]} castShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial map={winTex} emissiveMap={winTex} emissive="#fff6e0" emissiveIntensity={0.5} color={tint} roughness={0.8} />
            </mesh>
            {/* kademeli çatı katı */}
            <mesh position={[0, h + (h * 0.12) / 2, 0]}>
              <boxGeometry args={[w * 0.72, h * 0.12, d * 0.72]} />
              <meshStandardMaterial color={tint} roughness={0.8} />
            </mesh>
            {/* çatı terası korkuluğu */}
            <mesh position={[0, h + 0.4, 0]}>
              <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
              <meshStandardMaterial color="#8a7f6a" />
            </mesh>
            {/* ön cephe balkonları */}
            {!QUALITY.lowEnd && [0.4, 0.62, 0.84].map((fy, bi) => (
              <mesh key={bi} position={[w / 2 + 0.12, h * fy, (bi - 1) * d * 0.28]}>
                <boxGeometry args={[0.4, 0.1, d * 0.4]} />
                <meshStandardMaterial color="#b7a082" />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* partili yatlar + süper yatlar (marina) */}
      {yachts.map((y, i) =>
        y.big ? (
          <SuperYacht key={i} x={y.x} z={y.z} ang={y.ang} scale={y.s} seed={200 + i * 53} />
        ) : (
          <PartyYacht key={i} x={y.x} z={y.z} ang={y.ang} scale={y.s} seed={100 + i * 37} />
        ),
      )}

      {/* palmiyeler */}
      {palms.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.r * 6, 0]} scale={0.9 + p.r * 0.5}>
          <mesh position={[0.2, 2.6, 0]} rotation={[0, 0, -0.14]} castShadow>
            <cylinderGeometry args={[0.14, 0.22, 5.2, 7]} />
            <meshStandardMaterial color="#9a7a52" roughness={1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((f) => (
            <mesh key={f} position={[0.55, 5.1, 0]} rotation={[0.5 + (f % 2) * 0.35, (f / 5) * Math.PI * 2, 0]}>
              <coneGeometry args={[0.3, 2.4, 4]} />
              <meshStandardMaterial color="#2e8b46" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}

      {/* imza: marina deniz feneri (dönen ışık) */}
      <Lighthouse x={cx + 30} z={cz - 220} />

      {/* tribünler + kalabalık */}
      <Grandstands track={track} />
      <Crowd track={track} everyN={34} seed={6161} rows={3} />
    </group>
  );
}

// ---------- Ortak: seyirci kalabalığı (tüm pistlerde) ----------

/** Instanced düşük-poligon seyirci siluetleri (gövde kapsül + kafa küre) — pist kenarına dizilir. */
function Crowd({ track, everyN, seed, rows = 3 }: { track: TrackData; everyN: number; seed: number; rows?: number }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const people = useMemo(() => {
    const rand = makeRand(seed);
    const arr: Array<{ x: number; z: number; h: number; color: THREE.Color }> = [];
    const step = Math.max(1, Math.round(everyN * QUALITY.crowdMul)); // mobilde seyrek
    for (let i = 0; i < track.count; i += step) {
      const s = track.samples[i];
      const side = rand() > 0.5 ? 1 : -1;
      const base = track.halfWidth + 2.4;
      for (let row = 0; row < rows; row++)
        for (let col = -2; col <= 2; col++) {
          if (rand() < 0.4) continue;
          const dist = base + row * 1.0;
          const along = col * 1.0;
          arr.push({
            x: s.x + s.nx * side * dist + s.tx * along,
            z: s.z + s.nz * side * dist + s.tz * along,
            h: 0.75 + rand() * 0.3,
            color: new THREE.Color(SPECTATOR_COLORS[Math.floor(rand() * SPECTATOR_COLORS.length)]),
          });
        }
    }
    return arr;
  }, [track, everyN, seed, rows]);

  useLayoutEffect(() => {
    const body = bodyRef.current, head = headRef.current;
    if (!body || !head || people.length === 0) return;
    const d = new THREE.Object3D();
    const skin = new THREE.Color('#c79a76');
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      d.position.set(p.x, p.h * 0.5, p.z); d.scale.set(0.4, p.h, 0.4); d.updateMatrix();
      body.setMatrixAt(i, d.matrix); body.setColorAt(i, p.color);
      d.position.set(p.x, p.h + 0.12, p.z); d.scale.setScalar(0.26); d.updateMatrix();
      head.setMatrixAt(i, d.matrix); head.setColorAt(i, skin);
    }
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  }, [people]);

  if (people.length === 0) return null;
  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, people.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.5, 0.7, 3, 6]} />
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, people.length]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
    </>
  );
}

// ---------- İmza landmark'lar (her pise özgü) ----------

/** Sahil: denize uzanan ahşap iskele + ucunda kulübe. */
function Pier({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[-30, 1.1, 0]} castShadow>
        <boxGeometry args={[76, 0.5, 7]} />
        <meshStandardMaterial color="#8a6a48" roughness={1} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) =>
        [-3.2, 3.2].map((zz, k) => (
          <mesh key={`${i}-${k}`} position={[-2 - i * 7.5, 0.5, zz]}>
            <cylinderGeometry args={[0.18, 0.22, 1.8, 5]} />
            <meshStandardMaterial color="#6a4a30" roughness={1} />
          </mesh>
        )),
      )}
      <group position={[-62, 0, 0]}>
        <mesh position={[0, 2.9, 0]} castShadow>
          <boxGeometry args={[7, 3, 7]} />
          <meshStandardMaterial color="#e0cda3" roughness={0.9} />
        </mesh>
        <mesh position={[0, 4.9, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[5.6, 1.8, 4]} />
          <meshStandardMaterial color="#c15b3a" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** Basit tekne (sahil/marina). */
function Boat({ x, z, r, ang, scale = 1 }: { x: number; z: number; r: number; ang: number; scale?: number }) {
  return (
    <group position={[x, -0.2, z]} rotation={[0, -ang, 0]} scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[3, 1, 8]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 4.4]}>
        <coneGeometry args={[1.5, 2, 4]} />
        <meshStandardMaterial color="#f3f4f6" />
      </mesh>
      <mesh position={[0, 1.4, -0.5]}>
        <boxGeometry args={[2.2, 0.9, 4]} />
        <meshStandardMaterial color={r > 0.5 ? '#2a5c8a' : '#c1543a'} />
      </mesh>
    </group>
  );
}

/** Partili yat — güvertede insanlar, parti ışık dizisi, gölgelik (Monaco marina). */
const PARTY_LIGHTS = ['#ff2d6f', '#2df0ff', '#ffd60a', '#3aff8e', '#b14cff'];
function PartyYacht({ x, z, ang, scale, seed }: { x: number; z: number; ang: number; scale: number; seed: number }) {
  const guests = useMemo(() => {
    const rand = makeRand(seed);
    return Array.from({ length: 6 }).map(() => ({
      dx: (rand() - 0.5) * 2.4,
      dz: (rand() - 0.5) * 5,
      c: new THREE.Color(SPECTATOR_COLORS[Math.floor(rand() * SPECTATOR_COLORS.length)]),
      h: 0.5 + rand() * 0.25,
    }));
  }, [seed]);
  return (
    <group position={[x, -0.15, z]} rotation={[0, -ang, 0]} scale={scale}>
      {/* su hattı alt gövde */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.3, 0.7, 9]} />
        <meshStandardMaterial color="#20242c" roughness={0.6} />
      </mesh>
      {/* ana gövde */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[3.4, 1.1, 9]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* pruva */}
      <mesh position={[0, 0.6, 5.2]}>
        <coneGeometry args={[1.7, 2.4, 4]} />
        <meshStandardMaterial color="#f3f4f6" />
      </mesh>
      {/* kabin */}
      <mesh position={[0, 1.7, -2]} castShadow>
        <boxGeometry args={[2.8, 1.1, 3.6]} />
        <meshStandardMaterial color="#2a5c8a" metalness={0.3} roughness={0.25} />
      </mesh>
      {/* parti gölgeliği */}
      <mesh position={[0, 2.5, 1.6]}>
        <boxGeometry args={[3, 0.12, 4]} />
        <meshStandardMaterial color="#c1543a" roughness={0.8} />
      </mesh>
      {[[-1.4, -0.3], [1.4, -0.3], [-1.4, 3.5], [1.4, 3.5]].map(([px, pz], k) => (
        <mesh key={k} position={[px, 1.9, pz]}>
          <cylinderGeometry args={[0.05, 0.05, 1.3, 4]} />
          <meshStandardMaterial color="#dcdfe4" />
        </mesh>
      ))}
      {/* parti ışık dizisi (emissive) */}
      {Array.from({ length: 7 }).map((_, k) => {
        const c = PARTY_LIGHTS[k % PARTY_LIGHTS.length];
        return (
          <mesh key={k} position={[-1.4 + k * 0.47, 2.55, 3.5]}>
            <sphereGeometry args={[0.09, 6, 5]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={3.2} toneMapped={false} />
          </mesh>
        );
      })}
      {/* güverte konukları (parti yapan insanlar) */}
      {guests.map((g, k) => (
        <group key={k} position={[g.dx, 1.15, g.dz]}>
          <mesh position={[0, g.h * 0.5, 0]}>
            <capsuleGeometry args={[0.16, g.h * 0.7, 3, 6]} />
            <meshStandardMaterial color={g.c} roughness={0.9} />
          </mesh>
          <mesh position={[0, g.h + 0.08, 0]}>
            <sphereGeometry args={[0.13, 6, 5]} />
            <meshStandardMaterial color="#c79a76" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Süper yat — çok katlı, havuz + helipad + kalabalık parti güvertesi. */
function SuperYacht({ x, z, ang, scale, seed }: { x: number; z: number; ang: number; scale: number; seed: number }) {
  const guests = useMemo(() => {
    const rand = makeRand(seed);
    return Array.from({ length: 12 }).map(() => ({
      dx: (rand() - 0.5) * 4.5,
      dy: rand() > 0.5 ? 2.3 : 3.6,
      dz: (rand() - 0.5) * 11,
      c: new THREE.Color(SPECTATOR_COLORS[Math.floor(rand() * SPECTATOR_COLORS.length)]),
      h: 0.5 + rand() * 0.25,
    }));
  }, [seed]);
  return (
    <group position={[x, -0.15, z]} rotation={[0, -ang, 0]} scale={scale}>
      {/* su hattı + ana gövde (uzun) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[5, 0.9, 18]} />
        <meshStandardMaterial color="#20242c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[5.2, 1.6, 18]} />
        <meshStandardMaterial color="#f5f6f8" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1, 10.2]}>
        <coneGeometry args={[2.6, 3.6, 4]} />
        <meshStandardMaterial color="#f5f6f8" />
      </mesh>
      {/* orta güverte */}
      <mesh position={[0, 2.5, -1]} castShadow>
        <boxGeometry args={[4.4, 1.6, 11]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* üst güverte + köprü */}
      <mesh position={[0, 3.9, -3]} castShadow>
        <boxGeometry args={[3.6, 1.3, 6]} />
        <meshStandardMaterial color="#cfe0f0" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* cam şerit (köprü) */}
      <mesh position={[0, 4, -0.2]}>
        <boxGeometry args={[3.7, 0.7, 5.6]} />
        <meshPhysicalMaterial color="#0e1622" metalness={0.2} roughness={0.1} clearcoat={1} envMapIntensity={1.2} />
      </mesh>
      {/* arka güverte havuzu */}
      <mesh position={[0, 1.85, 5.5]}>
        <boxGeometry args={[2.6, 0.15, 3]} />
        <meshStandardMaterial color="#2ec5e0" emissive="#1f8fb0" emissiveIntensity={0.4} metalness={0.3} roughness={0.1} />
      </mesh>
      {/* helipad (üst, "H" işaretli daire) */}
      <mesh position={[0, 3.3, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.4, 20]} />
        <meshStandardMaterial color="#2a2d36" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.31, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.3, 20]} />
        <meshBasicMaterial color="#ffcf3a" />
      </mesh>
      {/* parti ışık dizisi */}
      {Array.from({ length: 10 }).map((_, k) => {
        const c = PARTY_LIGHTS[k % PARTY_LIGHTS.length];
        return (
          <mesh key={k} position={[-2 + k * 0.44, 3.5, -3]}>
            <sphereGeometry args={[0.1, 6, 5]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={3.2} toneMapped={false} />
          </mesh>
        );
      })}
      {/* kalabalık konuklar (iki güvertede) */}
      {guests.map((g, k) => (
        <group key={k} position={[g.dx, g.dy, g.dz]}>
          <mesh position={[0, g.h * 0.5, 0]}>
            <capsuleGeometry args={[0.16, g.h * 0.7, 3, 6]} />
            <meshStandardMaterial color={g.c} roughness={0.9} />
          </mesh>
          <mesh position={[0, g.h + 0.08, 0]}>
            <sphereGeometry args={[0.13, 6, 5]} />
            <meshStandardMaterial color="#c79a76" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Liman Turu: kırmızı-beyaz şeritli deniz feneri + dönen ışık huzmesi. */
function Lighthouse({ x, z }: { x: number; z: number }) {
  const beam = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (beam.current) beam.current.rotation.y = s.clock.elapsedTime * 1.1;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[4, 5, 2, 12]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 3 + i * 2.6;
        const rad = 3 - i * 0.28;
        return (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <cylinderGeometry args={[rad - 0.28, rad, 2.6, 12]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#d21f2c' : '#f1faee'} roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position={[0, 16.4, 0]}>
        <cylinderGeometry args={[2.3, 2.3, 2.4, 10]} />
        <meshStandardMaterial color="#2a2d3a" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 16.4, 0]}>
        <sphereGeometry args={[1.5, 10, 8]} />
        <meshStandardMaterial color="#fff3c0" emissive="#ffd34d" emissiveIntensity={3.4} toneMapped={false} />
      </mesh>
      <group ref={beam} position={[0, 16.4, 0]}>
        <mesh position={[22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[3, 44, 4, 1, true]} />
          <meshBasicMaterial color="#fff0b0" transparent opacity={0.11} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <pointLight position={[0, 16.4, 0]} color="#ffe08a" intensity={70} distance={90} decay={1.3} />
    </group>
  );
}

/** Orman: kayalık uçurum + akan şelale + dip havuzu (animasyonlu). */
function Waterfall({ x, z }: { x: number; z: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#bfe4f5';
    ctx.fillRect(0, 0, 32, 128);
    let s = 91;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`;
      const xx = rnd() * 32;
      ctx.fillRect(xx, rnd() * 128, 1 + rnd() * 2, 20 + rnd() * 40);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
  useFrame((_, dt) => {
    tex.offset.y -= dt * 1.6;
  });
  return (
    <group position={[x, 0, z]}>
      {/* kayalık uçurum */}
      <mesh position={[0, 18, 0]} castShadow>
        <boxGeometry args={[26, 36, 14]} />
        <meshStandardMaterial color="#5b5148" roughness={1} flatShading />
      </mesh>
      <mesh position={[-10, 28, 7]} rotation={[0, 0.3, 0.12]}>
        <coneGeometry args={[8, 22, 6]} />
        <meshStandardMaterial color="#4c463d" roughness={1} flatShading />
      </mesh>
      {/* düşen su */}
      <mesh position={[0, 17, 7.2]}>
        <planeGeometry args={[7.5, 30]} />
        <meshStandardMaterial map={tex} color="#e6f6ff" emissive="#cfe8ff" emissiveIntensity={0.3} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* dip havuzu + köpük */}
      <mesh position={[0, 0.15, 10]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[8, 18]} />
        <meshStandardMaterial color="#4aa3c7" roughness={0.2} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.2, 9]}>
        <sphereGeometry args={[3.6, 8, 6]} />
        <meshBasicMaterial color="#eaf6ff" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/** Tüm pistlerde: yol kenarı lastik bariyerleri (instanced — tek çizim çağrısı, "gerçek pist" hissi). */
function TireBarriers({ track }: { track: TrackData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stacks = useMemo(() => {
    const arr: Array<{ x: number; z: number }> = [];
    const step = Math.max(4, Math.round(7 * QUALITY.stepMul));
    for (let i = 0; i < track.count; i += step) {
      const s = track.samples[i];
      const off = track.halfWidth + 2.2;
      arr.push({ x: s.x + s.nx * off, z: s.z + s.nz * off });
      arr.push({ x: s.x - s.nx * off, z: s.z - s.nz * off });
    }
    return arr;
  }, [track]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || stacks.length === 0) return;
    const d = new THREE.Object3D();
    const red = new THREE.Color('#c62828');
    const white = new THREE.Color('#e8e8ea');
    for (let i = 0; i < stacks.length; i++) {
      d.position.set(stacks[i].x, 0.45, stacks[i].z);
      d.rotation.y = i * 1.7;
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, i % 2 === 0 ? red : white);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [stacks]);

  if (stacks.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stacks.length]} frustumCulled={false} castShadow>
      <cylinderGeometry args={[0.55, 0.6, 0.9, 8]} />
      <meshStandardMaterial vertexColors roughness={0.85} />
    </instancedMesh>
  );
}

export function Environment({ theme, track }: { theme: EnvTheme; track: TrackData }) {
  const themeEnv =
    theme === 'city' ? <CityEnv track={track} /> :
    theme === 'volcano' ? <VolcanoEnv track={track} /> :
    theme === 'coast' ? <CoastEnv track={track} /> :
    theme === 'forest' ? <ForestEnv track={track} /> :
    <RivieraEnv track={track} />;
  return (
    <>
      {themeEnv}
      <TireBarriers track={track} />
    </>
  );
}
