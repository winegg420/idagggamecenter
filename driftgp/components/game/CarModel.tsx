// Prosedürel gerçekçi araç modeli (src/game/carBody.ts üreteci).
//
// Tek kaynak kuralı: garaj önizlemesi, garaj kartları, pist sahnesi, botlar ve uzak oyuncular
// hepsi bu bileşeni kullanır — model/malzeme mantığı tek yerde.
//
// Neden GLB değil: CC0 GLB kaynakları (Kenney/Quaternius) low-poly "oyuncak" kalıyordu; daha
// gerçekçi + otomatik indirilebilir set yok (PROGRESS). Prosedürel üreteç pürüzsüz spline gövde,
// koyu cam kabin, çamurluk kavisleri, telli jant + fren diski/kaliperi ve LED far/stop üretir.
// Ek kazanç: ağ isteği yok (yükleme anında), Suspense/preload gerekmez.
//
// Malzeme stratejisi: buildCarBody her mesh'e userData.role atar; bu bileşen kişiselleştirmeye
// (boya rengi/finish, jant stili, cam filmi, far rengi) göre malzemeleri bağlar. Gövde klonu
// STABİL (useMemo), malzemeler useLayoutEffect mutasyonuyla uygulanır (primitive churn yok).

import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CarCustomization, CarStats } from '../../game/types';
import { LIGHT_COLORS, NITRO_COLORS } from '../../game/customization';
import { buildCarBody, getBodySpec } from '../../game/carBody';
import { QUALITY } from '../../game/quality';

interface CarModelProps {
  stats: CarStats;
  custom: CarCustomization;
  speedRef?: React.MutableRefObject<number>;
  steerRef?: React.MutableRefObject<number>;
  nitroRef?: React.MutableRefObject<boolean>;
  /** fren basılı mı — arka fren farları yanar */
  brakeRef?: React.MutableRefObject<boolean>;
  /** bot/uzak oyuncu: gölge kapalı */
  lowDetail?: boolean;
  /** aracın üstünde kameraya dönük isim etiketi (multiplayer'da oyuncu adı) */
  label?: string;
  /** hayalet modu: yarı saydam gövde + altın etiket kenarlığı, gölge/temas gölgesi yok */
  ghost?: boolean;
}

// MeshPhysicalMaterial parametreleri — clearcoat (parlak vernik) + env yansımasıyla
// gerçekçi araba boyası. Düşük metalness = boya (krom değil), clearcoat = camsı parlaklık.
const FINISH_PARAMS = {
  parlak: { metalness: 0.15, roughness: 0.42, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.3 },
  metalik: { metalness: 0.85, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.14, envMapIntensity: 1.5 },
  mat: { metalness: 0.1, roughness: 0.72, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.5 },
} as const;

// [renk, metalness, roughness, envMapIntensity] — 3 net ayrışan jant: parlak krom / gloss siyah / altın
const RIM_STYLE: Array<[string, number, number, number]> = [
  ['#eef2f8', 1.0, 0.06, 2.6],
  ['#14151a', 0.9, 0.28, 1.1],
  ['#e6b422', 1.0, 0.12, 2.8],
];

// Cam Filmi (tint): açık / orta / koyu opak oto camı tonu
const GLASS_TINT = ['#1b2536', '#121a28', '#0a0e18'];

// Yumuşak temas gölgesi (fake AO) — aracı yere oturtur; tek doku, tüm örneklerce paylaşılır.
let _contactTex: THREE.Texture | null = null;
function getContactShadow(): THREE.Texture {
  if (_contactTex) return _contactTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _contactTex = new THREE.CanvasTexture(c);
  return _contactTex;
}

// İsim etiketi dokusu — canvas'a bir kez çizilir, sprite olarak gösterilir (draw call maliyeti ~0).
// Sprite kamera dönüşünü otomatik takip ettiği için useFrame'de ek iş gerektirmez.
function makeNameTexture(name: string, accent = 'rgba(64, 220, 255, 0.9)'): { texture: THREE.CanvasTexture; aspect: number } {
  const text = name.length > 22 ? name.slice(0, 21) + '…' : name;
  const font = '800 58px system-ui, "Segoe UI", sans-serif';
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d')!;
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);
  const padX = 30;
  const h = 92;
  c.width = textW + padX * 2;
  c.height = h;
  ctx = c.getContext('2d')!; // boyut değişimi context durumunu sıfırlar
  // yuvarlak köşeli koyu arka plan + neon kenarlık → her pist temasında uzaktan okunur
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(c.width, 0, c.width, h, r);
  ctx.arcTo(c.width, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, c.width, 0, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 8, 16, 0.82)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // koyu kontur + beyaz dolgu — parlak zeminlerde de net
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(text, c.width / 2, h / 2 + 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, c.width / 2, h / 2 + 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; // NPOT canvas için mipmap üretme (gereksiz maliyet)
  return { texture, aspect: c.width / h };
}

interface WheelAnim {
  /** direksiyon dönüşü (Y) uygulanacak dış grup */
  holder: THREE.Object3D;
  /** teker dönüşü (Z, yanal eksen) uygulanacak iç grup */
  spin: THREE.Object3D;
  front: boolean;
}

export const CarModel = forwardRef<THREE.Group, CarModelProps>(function CarModel(
  { stats, custom, speedRef, steerRef, nitroRef, brakeRef, lowDetail = false, label, ghost = false },
  ref,
) {
  const spec = useMemo(() => getBodySpec(stats.id), [stats.id]);
  const flameRef = useRef<THREE.Mesh>(null);

  // 1) STABİL gövde — cache'li üreteçten klon (geometri paylaşılır; bot/uzak için az detay)
  const root = useMemo(() => buildCarBody(spec, !lowDetail), [spec, lowDetail]);

  // 2) Statik analiz: boyutlar + tekerlek düğümleri
  const geo = useMemo(() => {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const wheels: WheelAnim[] = [];
    root.traverse((o) => {
      if (o.userData.wheelHolder) {
        wheels.push({ holder: o, spin: o.children[0], front: o.userData.wheelHolder.front });
      }
    });
    const bodyDims = root.userData.bodyDims as { floor: number; belt: number; mirrorX: number; mirrorY: number };
    const dims = {
      L: size.x,
      W: size.z,
      H: size.y,
      topY: box.max.y,
      floorY: bodyDims.floor,
      rearX: -spec.L / 2,
      frontX: spec.L / 2,
      sideZ: size.z / 2,
      mirrorX: bodyDims.mirrorX,
      mirrorY: bodyDims.mirrorY,
    };
    return { wheels, dims };
  }, [root, spec]);

  // arka fren/stop farı malzemesi — normalde sönük stop, frende parlak (useFrame animasyonlu)
  const brakeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1414', emissiveIntensity: 1.1, toneMapped: false }),
    [],
  );

  // 3) Kişiselleştirme malzemelerini gövdeye uygula (mutasyon) — nesne referansı sabit kalır
  useLayoutEffect(() => {
    const [rimColor, rimMetal, rimRough, rimEnv] = RIM_STYLE[custom.rim] ?? RIM_STYLE[0];
    const finish = FINISH_PARAMS[custom.paintFinish] ?? FINISH_PARAMS.parlak;
    const lightC = LIGHT_COLORS[custom.lightColor] ?? LIGHT_COLORS[0];

    // yazılım render'da (donanım hızlandırma kapalı) clearcoat/Physical piksel maliyeti felaket
    // → ucuz Standard malzemeye düş (görsel fark küçük, hız farkı büyük)
    const cheap = QUALITY.cheapMaterials;
    const mats: Record<string, THREE.Material> = {
      paint: cheap
        ? new THREE.MeshStandardMaterial({ color: custom.paintColor, metalness: finish.metalness, roughness: finish.roughness })
        : new THREE.MeshPhysicalMaterial({ color: custom.paintColor, ...finish }),
      glass: cheap
        ? new THREE.MeshStandardMaterial({ color: GLASS_TINT[custom.tint] ?? GLASS_TINT[1], metalness: 0.2, roughness: 0.1 })
        : new THREE.MeshPhysicalMaterial({
            color: GLASS_TINT[custom.tint] ?? GLASS_TINT[1],
            metalness: 0.0,
            roughness: 0.06,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            envMapIntensity: 0.8,
          }),
      dark: new THREE.MeshStandardMaterial({ color: '#17181d', roughness: 0.8, metalness: 0.15 }),
      rim: new THREE.MeshStandardMaterial({ color: rimColor, metalness: rimMetal, roughness: rimRough, envMapIntensity: rimEnv }),
      tire: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.94, metalness: 0 }),
      disc: new THREE.MeshStandardMaterial({ color: '#9aa2ae', metalness: 0.9, roughness: 0.35 }),
      caliper: new THREE.MeshStandardMaterial({ color: '#c8202f', roughness: 0.4, metalness: 0.2 }),
      head: new THREE.MeshStandardMaterial({ color: lightC, emissive: lightC, emissiveIntensity: 2.4, toneMapped: false }),
      drl: new THREE.MeshStandardMaterial({ color: '#f2f6ff', emissive: '#dfe9ff', emissiveIntensity: 3.0, toneMapped: false }),
      tail: brakeMat,
    };

    // hayalet: tüm malzemeler yarı saydam (depthWrite kapalı → iç içe parçalar z-fight yapmaz)
    if (ghost) {
      for (const m of Object.values(mats)) {
        m.transparent = true;
        m.opacity = 0.38;
        m.depthWrite = false;
      }
    }

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const r = mesh.userData.role as string | undefined;
      if (r && mats[r]) mesh.material = mats[r];
      // gölge: yalnızca büyük parçalar (gövde/kabin) — jant telleri gölge maliyeti yaratmasın
      mesh.castShadow = !lowDetail && !ghost && (r === 'paint' || r === 'glass' || r === 'dark');
    });
  }, [root, brakeMat, custom.paintColor, custom.paintFinish, custom.tint, custom.rim, custom.lightColor, lowDetail, ghost]);

  const spinAngle = useRef(0);
  useFrame((state, dt) => {
    const speed = speedRef?.current ?? 0;
    const steer = steerRef?.current ?? 0;
    spinAngle.current += (speed / spec.wheelR) * dt;
    for (const w of geo.wheels) {
      w.spin.rotation.z = -spinAngle.current;
      if (w.front) w.holder.rotation.y = -steer * 0.55;
    }
    // fren farı: basılıyken parlak kırmızı, değilken sönük stop lambası
    const braking = brakeRef?.current ?? false;
    const targetB = braking ? 5.5 : 1.1;
    brakeMat.emissiveIntensity += (targetB - brakeMat.emissiveIntensity) * Math.min(1, dt * 14);
    if (flameRef.current) {
      const on = nitroRef?.current ?? false;
      flameRef.current.visible = on;
      if (on) {
        const s = 0.8 + Math.sin(state.clock.elapsedTime * 40) * 0.25;
        flameRef.current.scale.set(s, s, 1 + s * 0.5);
      }
    }
  });

  const { dims } = geo;
  const ghostMatProps = ghost ? { transparent: true, opacity: 0.38, depthWrite: false } : {};
  const carbon = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1d1f24', roughness: 0.4, metalness: 0.3, ...ghostMatProps }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ghost],
  );
  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.65, ...ghostMatProps }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ghost],
  );
  const contactTex = useMemo(() => getContactShadow(), []);
  const decalMat = useMemo(() => {
    const isLight = new THREE.Color(custom.paintColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    return new THREE.MeshStandardMaterial({ color: isLight ? '#15151a' : '#f2f2f4', roughness: 0.5 });
  }, [custom.paintColor]);
  const nitroColor = NITRO_COLORS[custom.nitroColor] ?? NITRO_COLORS[0];
  const halfL = dims.L / 2;
  const roofY = dims.topY;

  // isim etiketi dokusu — isme özel olduğu için paylaşılmaz, unmount'ta güvenle dispose edilir
  // (hayalet etiketi altın kenarlıklı → rakiplerden ilk bakışta ayrışır)
  const nameTag = useMemo(
    () => (label ? makeNameTexture(label, ghost ? 'rgba(255, 200, 64, 0.95)' : undefined) : null),
    [label, ghost],
  );
  useEffect(() => {
    if (!nameTag) return;
    return () => nameTag.texture.dispose();
  }, [nameTag]);

  return (
    <group ref={ref}>
      {/* dispose={null}: klon geometriyi cache'teki master ile PAYLAŞIR; unmount'ta dispose
          edilirse diğer örnekler (garaj kartları/botlar) bozulur */}
      <primitive object={root} dispose={null} />

      {/* isim etiketi — depthTest kapalı: diğer araç/duvar arkasında kalsa bile okunur */}
      {nameTag && (
        <sprite position={[0, dims.topY + 0.85, 0]} scale={[0.72 * nameTag.aspect, 0.72, 1]} renderOrder={999}>
          <spriteMaterial map={nameTag.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
        </sprite>
      )}

      {/* temas gölgesi (fake AO) — aracı yere oturtur; hayalet yere gölge düşürmez */}
      {!ghost && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={-1}>
          <planeGeometry args={[dims.L * 1.18, dims.W * 1.5]} />
          <meshBasicMaterial map={contactTex} transparent depthWrite={false} opacity={0.55} />
        </mesh>
      )}

      {/* yan aynalar — A sütunu dibine çapalı */}
      {[1, -1].map((sgn, i) => (
        <mesh key={i} material={dark} position={[dims.mirrorX, dims.mirrorY, sgn * (spec.W / 2 + 0.05)]} rotation={[0, sgn * 0.28, 0]}>
          <boxGeometry args={[0.09, 0.1, 0.18]} />
        </mesh>
      ))}

      {/* ---- kişiselleştirme eklentileri ---- */}
      {custom.splitter === 1 && (
        <mesh material={carbon} position={[dims.frontX - 0.1, dims.floorY + 0.02, 0]}>
          <boxGeometry args={[0.4, 0.07, dims.W * 0.95]} />
        </mesh>
      )}
      {custom.skirt === 1 && (
        <>
          <mesh material={carbon} position={[0, dims.floorY + 0.05, dims.sideZ - 0.02]}>
            <boxGeometry args={[dims.L * 0.55, 0.1, 0.07]} />
          </mesh>
          <mesh material={carbon} position={[0, dims.floorY + 0.05, -dims.sideZ + 0.02]}>
            <boxGeometry args={[dims.L * 0.55, 0.1, 0.07]} />
          </mesh>
        </>
      )}
      {custom.spoiler === 1 && (
        <mesh material={carbon} position={[-halfL + 0.16, roofY * 0.72, 0]} rotation={[0, 0, 0.16]}>
          <boxGeometry args={[0.24, 0.03, dims.W * 0.86]} />
        </mesh>
      )}
      {custom.spoiler === 2 && (
        <group position={[-halfL + 0.3, roofY * 0.9, 0]}>
          <mesh material={carbon} position={[0, 0.3, 0]} castShadow={!lowDetail}>
            <boxGeometry args={[0.34, 0.06, dims.W * 0.98]} />
          </mesh>
          <mesh material={carbon} position={[0, 0.12, dims.W * 0.32]}>
            <boxGeometry args={[0.07, 0.32, 0.07]} />
          </mesh>
          <mesh material={carbon} position={[0, 0.12, -dims.W * 0.32]}>
            <boxGeometry args={[0.07, 0.32, 0.07]} />
          </mesh>
        </group>
      )}
      {custom.hood === 1 && (
        <mesh material={carbon} position={[halfL * 0.55, roofY * 0.56, 0]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[dims.L * 0.22, 0.02, dims.W * 0.48]} />
        </mesh>
      )}
      {custom.decal > 0 &&
        (custom.decal === 1 ? [0] : [-dims.W * 0.14, dims.W * 0.14]).map((z, i) => (
          <mesh key={i} material={decalMat} position={[halfL * 0.55, roofY * 0.56 + 0.012, z]} rotation={[0, 0, -0.05]}>
            <boxGeometry args={[dims.L * 0.3, 0.012, custom.decal === 1 ? dims.W * 0.16 : dims.W * 0.07]} />
          </mesh>
        ))}

      {/* egzoz + nitro alevi — gövde arka-alt köşesine */}
      <group position={[dims.rearX + 0.05, dims.floorY + 0.08, 0]}>
        {(custom.exhaust === 0 ? [dims.W * 0.28] : custom.exhaust === 1 ? [dims.W * 0.28, -dims.W * 0.28] : [0.11, -0.11]).map(
          (z, i) => (
            <mesh key={i} material={dark} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.055, 0.055, 0.15, 10]} />
            </mesh>
          ),
        )}
        <mesh ref={flameRef} position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
          <coneGeometry args={[0.14, 0.8, 8]} />
          <meshBasicMaterial color={nitroColor} transparent opacity={0.9} />
        </mesh>
      </group>

      {/* ---- özel konsept temaları: tepe lambası / taksi tabelası ---- */}
      {stats.special === 'police' && (
        <group position={[dims.L * 0.02, roofY + 0.06, 0]}>
          <mesh position={[0, 0, 0.14]}>
            <boxGeometry args={[0.3, 0.11, 0.24]} />
            <meshStandardMaterial color="#2233ff" emissive="#2233ff" emissiveIntensity={2.8} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.14]}>
            <boxGeometry args={[0.3, 0.11, 0.24]} />
            <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2.8} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[0.34, 0.05, 0.54]} />
            <meshStandardMaterial color="#15151a" />
          </mesh>
        </group>
      )}
      {stats.special === 'ambulance' && (
        <group position={[dims.L * 0.1, roofY + 0.06, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.12, 0.42]} />
            <meshStandardMaterial color="#ff3a4a" emissive="#ff2233" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
        </group>
      )}
      {stats.special === 'taxi' && (
        <mesh position={[dims.L * -0.02, roofY + 0.1, 0]}>
          <boxGeometry args={[0.5, 0.2, 0.26]} />
          <meshStandardMaterial color="#ffd60a" emissive="#ffbb00" emissiveIntensity={1.0} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
});
