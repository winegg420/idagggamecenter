// 2D karakter sprite üreteci: CharacterDef + CosmeticConfig + poz → SVG.
// Yandan görünüm (sağa koşar), katmanlı kozmetik, 5 poz. Tamamı vektör — asset yok.
import type { CharacterDef, CosmeticConfig } from '../game/characters/characters';
import { getCharacter } from '../game/characters/characters';

export type Pose =
  | 'run1'
  | 'run2'
  | 'air'
  | 'duck'
  | 'idle'
  | 'swim'
  // Podyum hareket pozları (yarışta kullanılmaz)
  | 'wave'
  | 'flex'
  | 'laugh';

/** SVG tuval boyutu (kare). Renderer ölçekleyerek çizer. */
export const SPRITE_SIZE = 200;

const OUTLINE = '#33272a';
const OW = 4; // kontur kalınlığı

/** Rengi karart (gölge tonu) — hex #rrggbb */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface PoseParams {
  /** Ön bacak açısı (derece, kalçadan; + ileri) */
  legF: number;
  /** Arka bacak açısı */
  legB: number;
  /** Kol salınımı */
  arm: number;
  /** Ön kol için MUTLAK açı (varsa arm yerine geçer; 180≈yukarı) */
  armF?: number;
  /** Arka kol için MUTLAK açı (varsa -arm yerine geçer) */
  armB?: number;
  /** Emote kolları uzun + elli çizilsin (selam/kas gösterme okunur olsun) */
  armLong?: boolean;
  /** Gövde öne eğim */
  lean: number;
  /** Dikey ezilme (eğilme) */
  squash: number;
  /** Bacaklar büzük (havada) */
  tuck: boolean;
}

const POSES: Record<Pose, PoseParams> = {
  run1: { legF: 38, legB: -34, arm: 30, lean: 8, squash: 1, tuck: false },
  run2: { legF: -30, legB: 36, arm: -26, lean: 8, squash: 1, tuck: false },
  air: { legF: 24, legB: -12, arm: 40, lean: 4, squash: 1, tuck: true },
  duck: { legF: 14, legB: -10, arm: 10, lean: 16, squash: 0.68, tuck: false },
  idle: { legF: 4, legB: -4, arm: 4, lean: 0, squash: 1, tuck: false },
  // Yüzme: öne yatık gövde, geride birleşik bacaklar, ileri kulaç kolu
  swim: { legF: 74, legB: 64, arm: -120, lean: 58, squash: 1, tuck: true },
  // Podyum: SELAM — ön kol dik yukarıda el sallar (kafanın önünde çizilir)
  wave: { legF: 6, legB: -6, arm: 6, armF: 170, armLong: true, lean: -2, squash: 1, tuck: false },
  // Podyum: HAVA AT / kas göster — kol yana-yukarı kalkık (pazu pozu)
  flex: { legF: 10, legB: -10, arm: 0, armF: 128, armB: 218, armLong: true, lean: -4, squash: 1, tuck: false },
  // Podyum: KAHKAHA — geriye kaykılmış, eller karında
  laugh: { legF: 12, legB: -8, arm: 0, armF: 65, armB: -65, lean: -14, squash: 0.94, tuck: false },
};

/** Bacak: kalça ekseninde döner; uyluk + ayak(kabı). Her ayakkabı türü BARİZ farklı. */
function leg(hipX: number, hipY: number, angle: number, color: string, shoe: string, shoeColor: string, tuck: boolean): string {
  const len = tuck ? 22 : 32;
  const sc = shoeColor;
  let shoeShape: string;
  switch (shoe) {
    case 'yok':
      shoeShape = `<ellipse cx="0" cy="${len + 4}" rx="9" ry="6" fill="${shade(color, 0.75)}" stroke="${OUTLINE}" stroke-width="${OW}"/>`;
      break;
    case 'topuklu':
      shoeShape = `<path d="M -8 ${len - 2} L 10 ${len - 2} L 14 ${len + 9} L 6 ${len + 9} L 4 ${len + 2} L -4 ${len + 2} L -5 ${len + 10} L -10 ${len + 10} Z" fill="${sc}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}" stroke-linejoin="round"/>
        <path d="M -8 ${len - 2} Q 0 ${len - 8} 10 ${len - 2}" fill="none" stroke="${shade(sc, 0.7)}" stroke-width="2.5"/>`;
      break;
    case 'bot': {
      // Uzun konçlu bot: baldırı sarar — siluet belirgin değişir
      const topY = len - 16;
      shoeShape = `<path d="M -10 ${topY} L 10 ${topY} L 10 ${len + 2} L 15 ${len + 3} Q 17 ${len + 9} 10 ${len + 9} L -10 ${len + 9} Z" fill="${sc}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}" stroke-linejoin="round"/>
        <rect x="-10" y="${topY}" width="20" height="5" fill="${shade(sc, 1.35)}" stroke="${OUTLINE}" stroke-width="2"/>
        <rect x="-10" y="${len + 5}" width="26" height="4" rx="2" fill="${shade(sc, 0.55)}"/>
        <line x1="-4" y1="${topY + 7}" x2="-4" y2="${len + 2}" stroke="${shade(sc, 0.6)}" stroke-width="2.5"/>`;
      break;
    }
    case 'terlik':
      // Parmak arası terlik: düz taban + bant, ayak görünür
      shoeShape = `<ellipse cx="2" cy="${len + 3}" rx="9" ry="5.5" fill="${shade(color, 0.78)}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}"/>
        <path d="M -8 ${len + 8} L 14 ${len + 8} Q 17 ${len + 8} 16 ${len + 11} L -9 ${len + 11} Q -11 ${len + 8} -8 ${len + 8} Z" fill="${sc}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M 2 ${len + 8} Q 4 ${len + 2} 9 ${len + 4}" fill="none" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>`;
      break;
    default:
      // Spor ayakkabı: kalın beyaz taban + bağcık + marka şeridi
      shoeShape = `<path d="M -9 ${len - 6} Q -11 ${len + 3} -9 ${len + 4} L 15 ${len + 4} Q 17 ${len - 1} 7 ${len - 4} Q 0 ${len - 8} -9 ${len - 6} Z" fill="${sc}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}" stroke-linejoin="round"/>
        <path d="M -9 ${len + 4} L 15 ${len + 4} Q 16 ${len + 9} 12 ${len + 9} L -8 ${len + 9} Q -11 ${len + 9} -9 ${len + 4} Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M -2 ${len - 5} L 3 ${len - 1} M 1 ${len - 6} L 5 ${len - 2}" stroke="#ffffff" stroke-width="2"/>
        <path d="M -8 ${len} Q 0 ${len - 2} 8 ${len + 1}" fill="none" stroke="${shade(sc, 0.65)}" stroke-width="2.5"/>`;
  }
  return `<g transform="translate(${hipX} ${hipY}) rotate(${angle})">
    <rect x="-7" y="0" width="14" height="${len}" rx="7" fill="${color}" stroke="${OUTLINE}" stroke-width="${OW}"/>
    ${shoeShape}
  </g>`;
}

/** Kol: omuz ekseninde sallanır. long=emote kolu (uzun + uçta el) */
function arm(x: number, y: number, angle: number, color: string, band: string, bandColor: string, long = false): string {
  const len = long ? 46 : 30;
  const bandSvg =
    band === 'yok'
      ? ''
      : band === 'saat'
        ? `<rect x="-8" y="16" width="16" height="9" rx="3" fill="#8d5524" stroke="${OUTLINE}" stroke-width="2"/>
           <circle cx="0" cy="20.5" r="6.5" fill="#e9ecef" stroke="${OUTLINE}" stroke-width="2.5"/>
           <line x1="0" y1="20.5" x2="0" y2="16.5" stroke="${OUTLINE}" stroke-width="1.5"/>
           <line x1="0" y1="20.5" x2="3" y2="22" stroke="${OUTLINE}" stroke-width="1.5"/>`
        : `<rect x="-8" y="16" width="16" height="10" rx="4" fill="${bandColor}" stroke="${OUTLINE}" stroke-width="2.5"/>
           <line x1="-7" y1="21" x2="7" y2="21" stroke="#ffffff" stroke-width="2.2"/>`;
  const hand = long
    ? `<circle cx="0" cy="${len + 2}" r="9" fill="${color}" stroke="${OUTLINE}" stroke-width="${OW * 0.9}"/>`
    : '';
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    <rect x="-6.5" y="0" width="13" height="${len}" rx="6.5" fill="${color}" stroke="${OUTLINE}" stroke-width="${OW}"/>
    ${bandSvg}
    ${hand}
  </g>`;
}

/** Aksesuarı merkez etrafında büyüt — kozmetikler siluette bariz okunsun */
function grow(svg: string, cx: number, cy: number, k: number): string {
  if (!svg) return '';
  return `<g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">${svg}</g>`;
}

function ears(def: CharacterDef): string {
  const c = def.bodyColor;
  const inner = shade(def.bellyColor, 1);
  switch (def.earType) {
    case 'yuvarlak':
      return `<circle cx="112" cy="38" r="13" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
              <circle cx="112" cy="38" r="6" fill="${inner}"/>`;
    case 'sivri':
      return `<path d="M 104 46 L 108 20 L 126 38 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <path d="M 110 40 L 112 28 L 120 37 Z" fill="${inner}"/>`;
    case 'uzun':
      return `<g transform="rotate(-12 116 44)">
                <ellipse cx="116" cy="16" rx="9" ry="26" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
                <ellipse cx="116" cy="18" rx="4" ry="18" fill="${inner}"/>
              </g>`;
    case 'sarkik':
      return `<path d="M 106 42 Q 92 48 92 68 Q 92 76 99 74 Q 106 70 110 52 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>`;
    case 'yok':
    default:
      return '';
  }
}

function snout(def: CharacterDef): string {
  switch (def.snout) {
    case 'gaga':
      return `<path d="M 152 62 L 178 70 L 152 80 Q 146 71 152 62 Z" fill="#f7941d" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <line x1="152" y1="71" x2="172" y2="71" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    case 'burun':
      return `<ellipse cx="158" cy="70" rx="7" ry="5.5" fill="#3d2c29" stroke="${OUTLINE}" stroke-width="2.5"/>
              <path d="M 138 84 Q 148 92 158 84" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>`;
    case 'hortum':
      return `<path d="M 150 64 Q 176 66 176 84 Q 176 96 166 96 Q 160 96 160 89 Q 160 84 155 82 Q 146 78 150 64 Z" fill="${def.bodyColor}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>`;
    case 'yok':
    default:
      return `<path d="M 140 82 Q 150 90 160 82" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>`;
  }
}

function hairSvg(cos: CosmeticConfig): string {
  const hc = cos.hairColor;
  switch (cos.hair) {
    case 'sari':
      return `<path d="M 96 46 Q 92 18 122 14 Q 152 12 156 40 Q 140 26 122 30 Q 104 34 96 46 Z" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <path d="M 98 48 Q 86 56 88 72" fill="none" stroke="${hc}" stroke-width="9" stroke-linecap="round"/>`;
    case 'peruk':
      return `<circle cx="112" cy="34" r="17" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}"/>
              <circle cx="132" cy="26" r="15" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}"/>
              <circle cx="150" cy="34" r="13" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}"/>`;
    case 'kisa':
      return `<path d="M 102 44 Q 108 22 132 22 Q 152 22 156 42 Q 136 32 118 36 Q 108 39 102 44 Z" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>`;
    case 'mohawk':
      return `<path d="M 108 40 L 116 14 L 122 36 L 130 12 L 136 34 L 146 16 L 150 40 Z" fill="${hc}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>`;
    case 'rasta':
      return `<g stroke="${OUTLINE}" stroke-width="2.5" fill="${hc}">
                <path d="M 100 44 Q 90 60 94 78 Q 98 82 102 78 Q 100 60 106 46 Z"/>
                <path d="M 106 40 Q 98 62 104 84 Q 108 88 112 83 Q 108 60 114 42 Z"/>
                <path d="M 112 36 Q 108 60 114 80 Q 118 84 121 79 Q 118 58 120 38 Z"/>
              </g>`;
    default:
      return '';
  }
}

function hatSvg(cos: CosmeticConfig): string {
  const c = cos.hatColor;
  switch (cos.hat) {
    case 'kep':
      return `<path d="M 102 40 Q 106 18 130 18 Q 154 18 158 40 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <path d="M 150 34 L 180 38 Q 182 44 176 45 L 149 42 Z" fill="${shade(c, 0.8)}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}" stroke-linejoin="round"/>`;
    case 'silindir':
      return `<rect x="106" y="2" width="44" height="34" rx="4" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
              <rect x="96" y="32" width="64" height="9" rx="4.5" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
              <rect x="106" y="24" width="44" height="7" fill="#c1121f"/>`;
    case 'ascibone':
      return `<path d="M 104 38 Q 96 14 116 12 Q 122 2 134 6 Q 146 0 152 12 Q 166 16 156 38 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <rect x="104" y="34" width="52" height="8" rx="4" fill="#f1f1f1" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    case 'fedora':
      return `<path d="M 108 34 Q 110 12 130 12 Q 150 12 152 34 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <ellipse cx="130" cy="36" rx="36" ry="7" fill="${shade(c, 0.85)}" stroke="${OUTLINE}" stroke-width="${OW * 0.8}"/>
              <rect x="110" y="26" width="40" height="6" fill="${shade(c, 0.6)}"/>`;
    case 'tac':
      return `<path d="M 108 36 L 108 18 L 118 28 L 128 12 L 138 28 L 148 16 L 148 36 Z" fill="#ffd700" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <circle cx="128" cy="10" r="3.5" fill="#e63946" stroke="${OUTLINE}" stroke-width="2"/>`;
    case 'kask':
      return `<path d="M 100 42 Q 102 12 130 12 Q 158 12 160 42 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <rect x="98" y="38" width="64" height="8" rx="4" fill="${shade(c, 0.8)}" stroke="${OUTLINE}" stroke-width="2.5"/>
              <circle cx="130" cy="22" r="4" fill="#ffffff" opacity="0.7"/>`;
    case 'bere':
      return `<path d="M 103 40 Q 104 20 130 19 Q 156 20 157 40 Q 130 33 103 40 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
              <circle cx="130" cy="16" r="6" fill="${shade(c, 1.15 > 1 ? 0.85 : 0.85)}" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    default:
      return '';
  }
}

function glassesSvg(cos: CosmeticConfig): string {
  const c = cos.glassesColor;
  switch (cos.glasses) {
    case 'gunes':
      return `<path d="M 128 56 L 162 56 L 160 72 Q 148 76 140 70 L 136 60 Z" fill="#1a1a1a" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
              <line x1="128" y1="57" x2="112" y2="54" stroke="${OUTLINE}" stroke-width="3"/>`;
    case 'yuvarlak':
      return `<circle cx="148" cy="62" r="11" fill="rgba(200,230,255,0.35)" stroke="${c}" stroke-width="3.5"/>
              <line x1="137" y1="60" x2="112" y2="54" stroke="${c}" stroke-width="3"/>`;
    case 'kare':
      return `<rect x="138" y="52" width="22" height="18" rx="3" fill="rgba(200,230,255,0.35)" stroke="${c}" stroke-width="3.5"/>
              <line x1="138" y1="57" x2="112" y2="54" stroke="${c}" stroke-width="3"/>`;
    case 'pilot':
      return `<path d="M 136 54 L 164 54 L 160 72 Q 149 78 142 68 Z" fill="rgba(120,160,200,0.5)" stroke="#b8860b" stroke-width="3" stroke-linejoin="round"/>
              <line x1="136" y1="55" x2="112" y2="52" stroke="#b8860b" stroke-width="3"/>`;
    default:
      return '';
  }
}

function faceHair(cos: CosmeticConfig): string {
  let out = '';
  if (cos.mustache === 'pos')
    out += `<path d="M 138 80 Q 150 74 162 80 Q 156 88 150 84 Q 144 88 138 80 Z" fill="#3d2c29" stroke="${OUTLINE}" stroke-width="2"/>`;
  if (cos.mustache === 'ince')
    out += `<path d="M 140 79 Q 152 75 164 79" fill="none" stroke="#3d2c29" stroke-width="3.5" stroke-linecap="round"/>`;
  if (cos.beard === 'keci')
    out += `<path d="M 142 88 Q 146 102 152 88 Z" fill="#e5e5e5" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
  if (cos.beard === 'tam')
    out += `<path d="M 132 84 Q 134 100 148 100 Q 162 98 160 82 Q 148 92 132 84 Z" fill="#3d2c29" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
  return out;
}

function neckSvg(cos: CosmeticConfig): string {
  const c = cos.necklaceColor;
  switch (cos.necklace) {
    case 'altin':
      return `<path d="M 104 96 Q 120 110 138 98" fill="none" stroke="#ffd700" stroke-width="5" stroke-linecap="round"/>
              <circle cx="121" cy="106" r="5" fill="#ffd700" stroke="${OUTLINE}" stroke-width="2"/>`;
    case 'papyon':
      return `<path d="M 118 98 L 106 92 L 106 108 Z M 118 98 L 130 92 L 130 108 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="118" cy="99" r="3.5" fill="${shade(c, 0.7)}"/>`;
    case 'kravat':
      return `<path d="M 116 96 L 124 100 L 118 126 L 110 120 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'atki':
      return `<path d="M 102 94 Q 120 106 138 96 L 136 104 Q 120 113 104 102 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M 104 100 Q 96 116 100 132 L 110 130 Q 108 114 112 104 Z" fill="${shade(c, 0.85)}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

/**
 * Üst giyim: gövdeyi TAM ÖRTEN katman (alttan vücut rengi sızmaz) + türe
 * özgü BARİZ detaylar. Her tür silueti gerçekten değiştirir.
 */
function topSvg(cos: CosmeticConfig, bw: number, bh: number): string {
  if (cos.top === 'yok') return '';
  const c = cos.topColor;
  const dark = shade(c, 0.68);
  const lite = shade(c, 1.3);
  // Gövde elipsi rx42/ry36 — giysi 44/38 ile TAMAMEN örter; alt kenar + yaka
  const torso = `<ellipse cx="95" cy="119" rx="${44 * bw}" ry="${38 * bh}" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
    <path d="M ${95 - 40 * bw} 138 Q 95 ${138 + 14 * bh} ${95 + 40 * bw} 138" fill="none" stroke="${dark}" stroke-width="4"/>
    <ellipse cx="84" cy="102" rx="${15 * bw}" ry="${9 * bh}" fill="#ffffff" opacity="0.22"/>`;
  switch (cos.top) {
    case 'atlet':
      return `${torso}
        <path d="M 74 94 L 84 124 M 116 94 L 106 124" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>
        <circle cx="95" cy="122" r="12" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5"/>
        <text x="95" y="129" font-size="19" font-weight="900" text-anchor="middle" font-family="Arial, sans-serif" fill="${dark}">1</text>`;
    case 'gomlek':
      return `${torso}
        <path d="M 82 92 L 95 106 L 108 92 L 112 100 L 95 112 L 78 100 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <line x1="95" y1="110" x2="95" y2="150" stroke="${dark}" stroke-width="3"/>
        <circle cx="95" cy="118" r="2.6" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.5"/>
        <circle cx="95" cy="130" r="2.6" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.5"/>
        <circle cx="95" cy="142" r="2.6" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.5"/>
        <rect x="70" y="112" width="13" height="13" rx="2" fill="${lite}" stroke="${OUTLINE}" stroke-width="2"/>`;
    case 'takim':
      return `${torso}
        <path d="M 95 94 L 80 130 L 95 150 L 110 130 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5"/>
        <path d="M 95 94 L 76 122 L 84 130 L 95 104 Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="2"/>
        <path d="M 95 94 L 114 122 L 106 130 L 95 104 Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="2"/>
        <path d="M 92 104 L 98 104 L 96 128 L 94 128 Z" fill="#c1121f" stroke="${OUTLINE}" stroke-width="1.5"/>
        <rect x="70" y="118" width="10" height="7" rx="1.5" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.5"/>`;
    case 'esofman':
      return `${torso}
        <path d="M ${95 - 42 * bw} 108 Q 95 122 ${95 + 42 * bw} 108" fill="none" stroke="#ffffff" stroke-width="6"/>
        <path d="M ${95 - 41 * bw} 118 Q 95 132 ${95 + 41 * bw} 118" fill="none" stroke="#ffffff" stroke-width="6"/>
        <line x1="95" y1="96" x2="95" y2="150" stroke="${dark}" stroke-width="4"/>
        <rect x="92" y="96" width="6" height="9" rx="2" fill="#c0c0c0" stroke="${OUTLINE}" stroke-width="1.5"/>`;
    case 'onluk':
      return `${torso}
        <path d="M 72 100 L 118 100 L 122 146 Q 95 156 68 146 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M 80 100 Q 95 84 110 100" fill="none" stroke="#ffffff" stroke-width="5"/>
        <rect x="82" y="118" width="26" height="16" rx="3" fill="${lite}" stroke="${OUTLINE}" stroke-width="2"/>
        <line x1="95" y1="118" x2="95" y2="134" stroke="${OUTLINE}" stroke-width="1.5"/>`;
    case 'ceket':
      return `${torso}
        <path d="M 95 92 L 88 150" stroke="${dark}" stroke-width="6"/>
        <path d="M 95 92 L 78 108 L 86 114 L 95 100 Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M 95 92 L 112 108 L 104 114 L 95 100 Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="84" cy="118" r="3" fill="#d9d9d9" stroke="${OUTLINE}" stroke-width="1.5"/>
        <circle cx="83" cy="130" r="3" fill="#d9d9d9" stroke="${OUTLINE}" stroke-width="1.5"/>
        <path d="M 66 124 L 78 124 L 78 134 L 66 134" fill="none" stroke="${OUTLINE}" stroke-width="2.5"/>
        <path d="M 108 124 L 120 124 L 120 134 L 108 134" fill="none" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    case 'uzaykiyafeti':
      return `${torso}
        <rect x="50" y="98" width="20" height="38" rx="7" fill="#d3d3d3" stroke="${OUTLINE}" stroke-width="3"/>
        <line x1="54" y1="106" x2="66" y2="106" stroke="${OUTLINE}" stroke-width="2"/>
        <line x1="54" y1="114" x2="66" y2="114" stroke="${OUTLINE}" stroke-width="2"/>
        <rect x="82" y="106" width="28" height="22" rx="4" fill="#e9ecef" stroke="${OUTLINE}" stroke-width="2.5"/>
        <circle cx="89" cy="113" r="3" fill="#e63946"/>
        <circle cx="97" cy="113" r="3" fill="#ffd166"/>
        <circle cx="105" cy="113" r="3" fill="#57cc99"/>
        <rect x="86" y="120" width="20" height="4" rx="2" fill="#89c2d9"/>
        <circle cx="95" cy="140" r="7" fill="#89c2d9" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    case 'pelerin':
      return `<path d="M 96 90 Q 54 98 34 140 Q 30 154 50 148 Q 74 140 92 148 Z" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>
        <path d="M 60 112 Q 50 126 46 140" fill="none" stroke="${dark}" stroke-width="3"/>
        <path d="M 96 90 Q 78 96 70 104" fill="none" stroke="${lite}" stroke-width="4"/>
        <path d="M 100 96 Q 110 100 118 96" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="108" cy="99" r="4.5" fill="#ffd700" stroke="${OUTLINE}" stroke-width="2"/>`;
    case 'tisort':
    default:
      // Tişört: göğüste büyük yıldız baskı + kontrast kol biyeleri
      return `${torso}
        <path d="M 88 106 L 92 116 L 103 116 L 94 122 L 98 133 L 88 126 L 78 133 L 82 122 L 73 116 L 84 116 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M ${95 - 40 * bw} 130 Q 95 ${130 + 12 * bh} ${95 + 40 * bw} 130" fill="none" stroke="${lite}" stroke-width="3.5"/>`;
  }
}

/**
 * Ana üretici: karakter + kozmetik + poz → tek parça SVG dizgesi.
 * Karakter SAĞA bakar (soldan sağa koşu).
 */
export function buildCharacterSVG(
  def: CharacterDef,
  cosmetics: CosmeticConfig,
  pose: Pose,
): string {
  const p = POSES[pose];
  const [bw, bh] = def.bodyScale;
  const c = def.bodyColor;
  const cos = cosmetics;

  // Kıyafet kolları: uzun kollu üstlerde kollar giysi rengini alır (giysi
  // gerçekten "giyilmiş" okunsun); atlet/pelerin/yok'ta kollar çıplak kalır.
  const longSleeve = ['gomlek', 'takim', 'esofman', 'ceket', 'uzaykiyafeti'].includes(cos.top);
  const shortSleeve = cos.top === 'tisort' || cos.top === 'onluk';
  const armFrontColor = longSleeve ? cos.topColor : c;
  const armBackColor = longSleeve ? shade(cos.topColor, 0.82) : shade(c, 0.82);
  // Kısa kol: omuzda giysi renginde kol yaması
  const sleeveStub = shortSleeve
    ? `<rect x="96" y="96" width="18" height="16" rx="7" fill="${cos.topColor}" stroke="${OUTLINE}" stroke-width="3"/>
       <rect x="80" y="96" width="16" height="14" rx="6" fill="${shade(cos.topColor, 0.85)}" stroke="${OUTLINE}" stroke-width="2.5"/>`
    : '';

  // Emote pozlarında (armF tanımlı) ön kol EN ÜSTTE çizilir — kaldırılan
  // kol kafanın arkasında kaybolmasın (selam/kas gösterme okunur olsun)
  const emoteArm = p.armF !== undefined;
  const frontArm = arm(104, 100, p.armF ?? p.arm, armFrontColor, cos.wristband, cos.wristbandColor, p.armLong);

  const bodyLayer = `
    <ellipse cx="95" cy="118" rx="${42 * bw}" ry="${36 * bh}" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
    <ellipse cx="106" cy="126" rx="${24 * bw}" ry="${22 * bh}" fill="${def.bellyColor}"/>
    <ellipse cx="84" cy="102" rx="${16 * bw}" ry="${10 * bh}" fill="#ffffff" opacity="0.18"/>`;

  const tail = def.hasTail
    ? `<path d="M 56 122 Q 34 112 32 92 Q 44 100 58 108 Z" fill="${shade(c, 0.9)}" stroke="${OUTLINE}" stroke-width="${OW}" stroke-linejoin="round"/>`
    : '';

  const head = `
    <circle cx="130" cy="66" r="34" fill="${c}" stroke="${OUTLINE}" stroke-width="${OW}"/>
    <ellipse cx="144" cy="76" rx="14" ry="11" fill="${def.bellyColor}"/>
    <circle cx="145" cy="60" r="9" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5"/>
    <circle cx="148" cy="61" r="4" fill="#1a1a1a"/>
    <circle cx="149.5" cy="59.5" r="1.4" fill="#ffffff"/>
    <path d="M 136 48 Q 143 44 150 47" fill="none" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>`;

  // Katman sırası: kuyruk → arka bacak/kol → gövde → üst giyim → ön bacak →
  // kolye → ön kol → kafa parçaları → yüz kılı → saç → şapka → gözlük
  const inner = `
    ${tail}
    ${leg(78, 146, p.legB, shade(c, 0.82), cos.shoes, cos.shoesColor, p.tuck)}
    ${arm(88, 100, p.armB ?? -p.arm, armBackColor, 'yok', '', p.armB !== undefined && p.armLong)}
    ${bodyLayer}
    ${topSvg(cos, bw, bh)}
    ${sleeveStub}
    ${leg(100, 146, p.legF, c, cos.shoes, cos.shoesColor, p.tuck)}
    ${grow(neckSvg(cos), 120, 102, 1.2)}
    ${emoteArm ? '' : frontArm}
    ${ears(def)}
    ${head}
    ${snout(def)}
    ${grow(faceHair(cos), 150, 86, 1.18)}
    ${grow(hairSvg(cos), 128, 34, 1.15)}
    ${grow(hatSvg(cos), 130, 34, 1.24)}
    ${grow(glassesSvg(cos), 148, 62, 1.28)}
    ${emoteArm ? frontArm : ''}`;

  // Eğilmede tüm karakter alçalır ve ezilir; koşuda hafif öne eğim
  const cy = 200 - 200 * p.squash;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}">
    <g transform="translate(0 ${cy}) scale(1 ${p.squash}) rotate(${p.lean} 100 150)">${inner}</g>
  </svg>`;
}

// ---- Sprite önbelleği (SVG → Image) ----

const imageCache = new Map<string, HTMLImageElement>();

function cacheKey(charId: string, cos: CosmeticConfig, pose: Pose): string {
  return `${charId}|${JSON.stringify(cos)}|${pose}`;
}

/**
 * Sprite'ı getirir; ilk çağrıda SVG'den Image üretir (asenkron yüklenir).
 * Yüklenene kadar renderer yedek siluet çizer.
 */
export function getSprite(
  charId: string,
  cosmetics: CosmeticConfig | undefined,
  pose: Pose,
): HTMLImageElement {
  const def = getCharacter(charId);
  const cos = cosmetics ?? def.defaultCosmetics;
  const key = cacheKey(charId, cos, pose);
  let img = imageCache.get(key);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildCharacterSVG(def, cos, pose))}`;
    imageCache.set(key, img);
  }
  return img;
}

/** Yarış başında tüm pozları önceden ısıt (ilk karede takılma olmasın) */
export function preloadSprites(entries: { charId: string; cosmetics?: CosmeticConfig }[]): void {
  const poses: Pose[] = ['run1', 'run2', 'air', 'duck', 'idle', 'swim'];
  for (const e of entries) {
    for (const pose of poses) getSprite(e.charId, e.cosmetics, pose);
  }
}

/** UI önizlemeleri için data-URI (img src) */
export function characterDataUri(
  charId: string,
  cosmetics?: CosmeticConfig,
  pose: Pose = 'idle',
): string {
  const def = getCharacter(charId);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    buildCharacterSVG(def, cosmetics ?? def.defaultCosmetics, pose),
  )}`;
}
