// DEV-ONLY görsel doğrulama düzeneği: prosedürel araç gövdelerini ham three.js ile render eder.
// Occluded otomasyon sekmesinde RAF durduğu için setInterval kullanır (bkz. PROGRESS test notu).
// window.snap(i) → i. aracın PNG dataURL'i; window.snapAll() → genel bakış ızgarası.
// Üretime girmez: yalnızca /carview.html tarafından import edilir.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCarBody, CAR_BODIES, type BodySpec } from '../game/carBody';

const canvas = document.getElementById('cv') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(canvas.width, canvas.height, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#aebdd2');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, canvas.width / canvas.height, 0.1, 200);

// ışıklar
scene.add(new THREE.HemisphereLight('#dfe8f5', '#5c626e', 0.8));
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(6, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// zemin
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// CarModel'in malzeme atamasının sade kopyası (görsel değerlendirme için yeterli)
const PAINTS = ['#c0182a', '#0e5bd8', '#e8e9ec', '#101114', '#ff7a00', '#1f9e4b', '#ffd60a', '#8046c8'];
function applyMats(root: THREE.Group, paint: string) {
  const mats: Record<string, THREE.Material> = {
    paint: new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.15, roughness: 0.42, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#121a28', metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: '#17181d', roughness: 0.8, metalness: 0.15 }),
    rim: new THREE.MeshStandardMaterial({ color: '#eef2f8', metalness: 1, roughness: 0.06, envMapIntensity: 2.6 }),
    tire: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.94 }),
    disc: new THREE.MeshStandardMaterial({ color: '#9aa2ae', metalness: 0.9, roughness: 0.35 }),
    caliper: new THREE.MeshStandardMaterial({ color: '#c8202f', roughness: 0.4 }),
    head: new THREE.MeshStandardMaterial({ color: '#f5f8ff', emissive: '#e8f0ff', emissiveIntensity: 2.4, toneMapped: false }),
    drl: new THREE.MeshStandardMaterial({ color: '#f2f6ff', emissive: '#dfe9ff', emissiveIntensity: 3.0, toneMapped: false }),
    tail: new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1414', emissiveIntensity: 1.4, toneMapped: false }),
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const r = m.userData.role as string;
    if (r && mats[r]) m.material = mats[r];
    m.castShadow = r === 'paint' || r === 'glass' || r === 'dark';
  });
}

// temsili set: her stil + imza özellik kombinasyonları (kanat, scoop, EV yüz, yedek teker...)
const SHOW = [
  'jesko-storm', // hyper + kanat + yan giriş + tavan girişi
  'chiron-ghost', // hyper + ducktail
  'huracan-toro', // super + roofScoop
  'gtr-kaplan', // coupe + kanat
  'mustang-vahsi', // muscle + hoodScoop + çift yuvarlak far
  'rs-simsek', // sedan + spor yüz
  'volt-plaid', // sedan + EV yüz (ışık barı)
  'civic-ok', // hatch
  'mini-simsek', // hatch + kontrast tavan
  'ruzgar-mx', // roadster (açık üst)
  'rivian-yaban', // SUV + EV yüz + tavan rayı
  'defender-firtina', // offroad + yedek teker + ray
  'cyber-kaya', // keskin kama + LED şerit
  'acil-sahin', // van
];
const entries: [string, BodySpec][] = SHOW.map((id) => [id, CAR_BODIES[id]]);

const cars: { id: string; group: THREE.Group }[] = [];
entries.forEach(([id, spec], i) => {
  const g = buildCarBody(spec);
  applyMats(g, PAINTS[i % PAINTS.length]);
  const col = i % 4;
  const row = Math.floor(i / 4);
  g.position.set(row * 9, 0, col * 6 - 9);
  g.rotation.y = -0.5;
  scene.add(g);
  cars.push({ id, group: g });
});

function look(i: number, dist = 6.4, h = 2.1, angle = 0.85) {
  const c = cars[i].group.position;
  camera.position.set(c.x + Math.cos(angle) * dist, h, c.z + Math.sin(angle) * dist);
  camera.lookAt(c.x, 0.62, c.z);
}

// occluded sekmede de render (RAF yerine interval)
setInterval(() => renderer.render(scene, camera), 250);
look(0);

declare global {
  interface Window {
    snap: (i: number, angle?: number, dist?: number, h?: number) => string;
    snapAll: () => string;
    carIds: () => string[];
    stats: () => { calls: number; triangles: number; meshesPerCar: number };
  }
}
// performans teşhisi: draw call + üçgen sayısı + araç başına mesh
window.stats = () => {
  renderer.render(scene, camera);
  let meshes = 0;
  cars[0].group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++;
  });
  return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshesPerCar: meshes };
};
window.carIds = () => cars.map((c) => c.id);
window.snap = (i: number, angle = 0.85, dist = 6.4, h = 2.1) => {
  look(i, dist, h, angle);
  renderer.render(scene, camera);
  return canvas.toDataURL('image/png');
};
window.snapAll = () => {
  const n = cars.length;
  const rows = Math.ceil(n / 4);
  camera.position.set(rows * 4.5 + 14, 12, 24);
  camera.lookAt(rows * 4.5 - 4, 0, -1);
  renderer.render(scene, camera);
  return canvas.toDataURL('image/png');
};
console.log('[carview] hazır — araçlar:', cars.map((c) => c.id).join(', '));
