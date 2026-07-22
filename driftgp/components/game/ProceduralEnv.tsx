// Prosedürel çevre-haritası (PMREM) — araç boyası/janta gerçekçi yansıma verir.
// Harici HDR indirmez; gradient'ten üretir. Race sahnesi, garaj önizlemesi ve kartlar kullanır.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  sky?: string;
  horizon?: string;
  ground?: string;
}

// PMREM üretimi pahalı; aynı renk+renderer için tek sefer üret ve paylaş.
// Garaj/araç seçimde 30 kart aynı renkleri kullanır → 30 üretim yerine 1 (ADIM D: garaj performansı).
const envCache = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Texture>>();

function getSharedEnv(gl: THREE.WebGLRenderer, sky: string, horizon: string, ground: string): THREE.Texture {
  let byColor = envCache.get(gl);
  if (!byColor) {
    byColor = new Map();
    envCache.set(gl, byColor);
  }
  const key = `${sky}|${horizon}|${ground}`;
  const hit = byColor.get(key);
  if (hit) return hit;

  const pmrem = new THREE.PMREMGenerator(gl);
  const c = document.createElement('canvas');
  // equirect 2:1 (genişlik=2×yükseklik) ZORUNLU — yanlış oran PMREM'i siyah üretir
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, sky);
  grad.addColorStop(0.48, horizon);
  grad.addColorStop(0.52, horizon);
  grad.addColorStop(1, ground);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  byColor.set(key, rt.texture); // oturum boyunca paylaşılır (tek 128px cubemap, ihmal edilebilir bellek)
  return rt.texture;
}

export function ProceduralEnv({ sky = '#9ec6ef', horizon = '#eaf2ff', ground = '#2a2d3a' }: Props) {
  const { scene, gl } = useThree();
  useEffect(() => {
    let env: THREE.Texture | null = null;
    try {
      env = getSharedEnv(gl, sky, horizon, ground);
    } catch (e) {
      console.error('ProceduralEnv üretilemedi:', e);
      return;
    }
    const prev = scene.environment;
    scene.environment = env;
    return () => {
      scene.environment = prev; // paylaşılan dokuyu dispose ETME — cache sahibi
    };
  }, [scene, gl, sky, horizon, ground]);
  return null;
}
