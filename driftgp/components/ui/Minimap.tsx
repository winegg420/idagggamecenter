// Yarış içi minimap — parkur şeması + oyuncu (yön oku) + rakip noktaları.
// Statik parkur yolu trackId'den; canlı pozisyonlar store'dan (~10Hz).

import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getTrackData } from '../../game/tracks';

const VB = 100;
const PAD = 8;

export function Minimap() {
  const trackId = useGameStore((s) => s.trackId);
  const mmPlayer = useGameStore((s) => s.mmPlayer);
  const mmRacers = useGameStore((s) => s.mmRacers);

  // parkur sınırları + projeksiyon (bir kez, trackId değişince)
  const proj = useMemo(() => {
    const t = getTrackData(trackId);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of t.samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const w = maxX - minX || 1, h = maxZ - minZ || 1;
    const size = Math.max(w, h);
    const scale = (VB - 2 * PAD) / size;
    const offX = PAD + (VB - 2 * PAD - w * scale) / 2;
    const offZ = PAD + (VB - 2 * PAD - h * scale) / 2;
    const px = (x: number) => offX + (x - minX) * scale;
    const pz = (z: number) => offZ + (z - minZ) * scale;
    // parkur yolu (her ~14. örnek)
    const pts: string[] = [];
    for (let i = 0; i < t.count; i += 14) pts.push(`${px(t.samples[i].x).toFixed(1)},${pz(t.samples[i].z).toFixed(1)}`);
    const start = t.samples[0];
    return { px, pz, path: pts.join(' '), startX: px(start.x), startZ: pz(start.z) };
  }, [trackId]);

  const [pxWorld, pzWorld, heading] = mmPlayer;
  const playerX = proj.px(pxWorld);
  const playerZ = proj.pz(pzWorld);
  const headDeg = (heading * 180) / Math.PI;

  return (
    <div className="minimap">
      <svg viewBox={`0 0 ${VB} ${VB}`} width="100%" height="100%">
        {/* parkur zemini */}
        <polyline points={proj.path} fill="none" stroke="#0c0f18" strokeWidth={7.5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={proj.path} fill="none" stroke="#5b6270" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={proj.path} fill="none" stroke="#aeb6c4" strokeWidth={1} strokeDasharray="2 2" strokeLinejoin="round" />
        {/* start çizgisi */}
        <circle cx={proj.startX} cy={proj.startZ} r={2.6} fill="#f2f2f2" stroke="#111" strokeWidth={0.6} />
        {/* rakipler */}
        {Array.from({ length: mmRacers.length / 2 }).map((_, i) => (
          <circle key={i} cx={proj.px(mmRacers[i * 2])} cy={proj.pz(mmRacers[i * 2 + 1])} r={2} fill="#ffcf3a" stroke="#3a2c00" strokeWidth={0.5} />
        ))}
        {/* oyuncu (yön oku) */}
        <g transform={`translate(${playerX} ${playerZ}) rotate(${headDeg})`}>
          <polygon points="4,0 -2.6,2.4 -2.6,-2.4" fill="#e0242f" stroke="#fff" strokeWidth={0.6} />
        </g>
      </svg>
    </div>
  );
}
