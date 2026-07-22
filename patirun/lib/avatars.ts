// 20 özgün, komik "süper kahraman parodisi" profil avatarı — tamamı vektör,
// hiçbir marka/karakter kopyası değildir. Kare fotoğraf formatında üretilir.

export interface AvatarDef {
  id: string;
  name: string;
  /** Arka plan gradyanı (üst, alt) */
  bg: [string, string];
  face: string;
  mask: 'yok' | 'bant' | 'tam' | 'kask' | 'bandana' | 'gozluk' | 'korsan';
  maskColor: string;
  ear: 'yok' | 'yarasa' | 'kedi' | 'anten' | 'diken' | 'alev' | 'panda';
  eyes: 'normal' | 'kapali' | 'kizgin' | 'parlak' | 'monokl';
  mouth: 'gulus' | 'ciddi' | 'dil' | 'kahkaha';
  /** Alt köşedeki göğüs amblemi (harf/sembol) */
  emblem: string;
  emblemBg: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 'kaptan-simit', name: 'Kaptan Simit', bg: ['#d62828', '#7a1010'], face: '#ffd8a8', mask: 'bant', maskColor: '#1d3557', ear: 'yok', eyes: 'normal', mouth: 'gulus', emblem: 'S', emblemBg: '#f4a261' },
  { id: 'super-tembel', name: 'Süper Tembel', bg: ['#5f0f40', '#2b0a1e'], face: '#e8c39e', mask: 'tam', maskColor: '#9a031e', ear: 'yok', eyes: 'kapali', mouth: 'gulus', emblem: 'Z', emblemBg: '#fb8b24' },
  { id: 'yarasa-amca', name: 'Yarasa Amca', bg: ['#22223b', '#0a0a14'], face: '#d9c5a0', mask: 'tam', maskColor: '#14141f', ear: 'yarasa', eyes: 'kizgin', mouth: 'ciddi', emblem: '🦇', emblemBg: '#3a3a52' },
  { id: 'orumcek-yenge', name: 'Örümcek Yenge', bg: ['#c1121f', '#5c0a10'], face: '#e63946', mask: 'tam', maskColor: '#c1121f', ear: 'yok', eyes: 'parlak', mouth: 'ciddi', emblem: '🕸', emblemBg: '#8d0801' },
  { id: 'simsek-hizcan', name: 'Şimşek Hızcan', bg: ['#ffbe0b', '#c98600'], face: '#ffd8a8', mask: 'kask', maskColor: '#d90429', ear: 'yok', eyes: 'normal', mouth: 'kahkaha', emblem: '⚡', emblemBg: '#d90429' },
  { id: 'demir-dayi', name: 'Demir Dayı', bg: ['#9d0208', '#450104'], face: '#b8bdc7', mask: 'kask', maskColor: '#c9a227', ear: 'yok', eyes: 'parlak', mouth: 'ciddi', emblem: 'D', emblemBg: '#495057' },
  { id: 'yesil-ofke', name: 'Yeşil Öfke', bg: ['#2b9348', '#0f3d1e'], face: '#55a630', mask: 'yok', maskColor: '#000', ear: 'yok', eyes: 'kizgin', mouth: 'ciddi', emblem: '💪', emblemBg: '#1a5c2e' },
  { id: 'buz-nine', name: 'Buz Nine', bg: ['#48cae4', '#0466a8'], face: '#e0fbfc', mask: 'yok', maskColor: '#000', ear: 'yok', eyes: 'normal', mouth: 'gulus', emblem: '❄', emblemBg: '#0077b6' },
  { id: 'alev-abi', name: 'Alev Abi', bg: ['#ff6d00', '#992500'], face: '#ffb570', mask: 'gozluk', maskColor: '#3d0b0b', ear: 'alev', eyes: 'normal', mouth: 'kahkaha', emblem: '🔥', emblemBg: '#bf3100' },
  { id: 'gece-kusu', name: 'Gece Kuşu', bg: ['#3d348b', '#191036'], face: '#c8b6a6', mask: 'gozluk', maskColor: '#e0aaff', ear: 'yok', eyes: 'parlak', mouth: 'ciddi', emblem: '🌙', emblemBg: '#5a4a9c' },
  { id: 'kedi-hanim', name: 'Kedi Hanım', bg: ['#6f1d1b', '#2e0c0b'], face: '#e8c39e', mask: 'tam', maskColor: '#432818', ear: 'kedi', eyes: 'parlak', mouth: 'gulus', emblem: '🐾', emblemBg: '#99582a' },
  { id: 'dr-patates', name: 'Dr. Patates', bg: ['#8b5e34', '#4a3018'], face: '#d4a373', mask: 'yok', maskColor: '#000', ear: 'yok', eyes: 'monokl', mouth: 'ciddi', emblem: '🥔', emblemBg: '#6c584c' },
  { id: 'turbo-kirpi', name: 'Turbo Kirpi', bg: ['#0077b6', '#023e64'], face: '#ffd8a8', mask: 'yok', maskColor: '#000', ear: 'diken', eyes: 'normal', mouth: 'kahkaha', emblem: '💨', emblemBg: '#0353a4' },
  { id: 'kaptan-kofte', name: 'Kaptan Köfte', bg: ['#457b9d', '#1d3d54'], face: '#e8a87c', mask: 'bant', maskColor: '#e63946', ear: 'yok', eyes: 'normal', mouth: 'dil', emblem: 'K', emblemBg: '#1d3557' },
  { id: 'uzayli-vedat', name: 'Uzaylı Vedat', bg: ['#7209b7', '#2d0447'], face: '#80ed99', mask: 'yok', maskColor: '#000', ear: 'anten', eyes: 'parlak', mouth: 'gulus', emblem: '🛸', emblemBg: '#480972' },
  { id: 'ninja-fistik', name: 'Ninja Fıstık', bg: ['#354f52', '#101c1d'], face: '#d4a373', mask: 'bandana', maskColor: '#2f3e46', ear: 'yok', eyes: 'normal', mouth: 'ciddi', emblem: '🥜', emblemBg: '#52796f' },
  { id: 'robo-halil', name: 'Robo Halil', bg: ['#6c757d', '#2b3035'], face: '#adb5bd', mask: 'kask', maskColor: '#495057', ear: 'anten', eyes: 'parlak', mouth: 'ciddi', emblem: '🤖', emblemBg: '#343a40' },
  { id: 'sihirbaz-suat', name: 'Sihirbaz Suat', bg: ['#10002b', '#3c096c'], face: '#e8c39e', mask: 'yok', maskColor: '#000', ear: 'yok', eyes: 'parlak', mouth: 'gulus', emblem: '✨', emblemBg: '#5a189a' },
  { id: 'korsan-cengiz', name: 'Korsan Cengiz', bg: ['#3d2c29', '#17100e'], face: '#e8a87c', mask: 'korsan', maskColor: '#1a1a1a', ear: 'yok', eyes: 'normal', mouth: 'kahkaha', emblem: '☠', emblemBg: '#6c584c' },
  { id: 'panda-usta', name: 'Panda Usta', bg: ['#38b000', '#155d00'], face: '#f8f9fa', mask: 'yok', maskColor: '#000', ear: 'panda', eyes: 'normal', mouth: 'gulus', emblem: '🎋', emblemBg: '#2d6a4f' },
];

const OUT = '#1a1216';

function eyesSvg(a: AvatarDef): string {
  const mc = '#1a1a1a';
  switch (a.eyes) {
    case 'kapali':
      return `<path d="M 34 46 Q 40 51 46 46 M 56 46 Q 62 51 68 46" stroke="${mc}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'kizgin':
      return `<circle cx="40" cy="48" r="4.5" fill="${mc}"/><circle cx="62" cy="48" r="4.5" fill="${mc}"/>
        <path d="M 32 39 L 47 44 M 70 39 L 55 44" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'parlak':
      return `<circle cx="40" cy="47" r="6" fill="#ffffff"/><circle cx="62" cy="47" r="6" fill="#ffffff"/>
        <circle cx="41" cy="47" r="3" fill="#12b5e0"/><circle cx="63" cy="47" r="3" fill="#12b5e0"/>`;
    case 'monokl':
      return `<circle cx="40" cy="48" r="4.5" fill="${mc}"/><circle cx="62" cy="48" r="4.5" fill="${mc}"/>
        <circle cx="62" cy="48" r="10" fill="none" stroke="#c9a227" stroke-width="2.5"/>
        <line x1="62" y1="58" x2="62" y2="70" stroke="#c9a227" stroke-width="2"/>`;
    default:
      return `<circle cx="40" cy="47" r="4.5" fill="${mc}"/><circle cx="62" cy="47" r="4.5" fill="${mc}"/>
        <circle cx="41.5" cy="45.5" r="1.5" fill="#fff"/><circle cx="63.5" cy="45.5" r="1.5" fill="#fff"/>`;
  }
}

function mouthSvg(a: AvatarDef): string {
  switch (a.mouth) {
    case 'ciddi':
      return `<line x1="44" y1="66" x2="58" y2="66" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`;
    case 'dil':
      return `<path d="M 42 63 Q 51 72 60 63" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M 50 67 Q 51 74 56 71 Q 57 66 53 65 Z" fill="#e5383b" stroke="${OUT}" stroke-width="1.5"/>`;
    case 'kahkaha':
      return `<path d="M 40 62 Q 51 76 62 62 Q 51 66 40 62 Z" fill="#7f2130" stroke="${OUT}" stroke-width="2"/>
        <path d="M 44 64 Q 51 68 58 64 L 57 62 L 45 62 Z" fill="#ffffff"/>`;
    default:
      return `<path d="M 42 63 Q 51 71 60 63" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
}

function maskSvg(a: AvatarDef): string {
  const c = a.maskColor;
  switch (a.mask) {
    case 'bant':
      return `<path d="M 26 40 L 76 40 L 76 55 L 26 55 Z" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>
        <ellipse cx="40" cy="47.5" rx="8" ry="6.5" fill="#fff"/><ellipse cx="62" cy="47.5" rx="8" ry="6.5" fill="#fff"/>`;
    case 'tam':
      return `<path d="M 24 52 Q 22 18 51 18 Q 80 18 78 52 L 74 44 Q 72 36 66 38 L 36 38 Q 30 36 28 44 Z" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>
        <path d="M 28 44 L 74 44 L 76 55 Q 63 50 51 55 Q 39 50 26 55 Z" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>
        <ellipse cx="40" cy="48" rx="8" ry="6.5" fill="#fff"/><ellipse cx="62" cy="48" rx="8" ry="6.5" fill="#fff"/>`;
    case 'kask':
      return `<path d="M 24 46 Q 24 16 51 16 Q 78 16 78 46 L 72 46 Q 72 26 51 26 Q 30 26 30 46 Z" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>
        <rect x="26" y="30" width="6" height="14" rx="3" fill="${c}" stroke="${OUT}" stroke-width="2"/>
        <rect x="70" y="30" width="6" height="14" rx="3" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;
    case 'bandana':
      return `<path d="M 25 38 L 77 38 L 77 54 L 25 54 Z" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>
        <rect x="30" y="42" width="42" height="8" rx="4" fill="rgba(0,0,0,0.25)"/>
        <ellipse cx="40" cy="46" rx="7" ry="5" fill="#fff"/><ellipse cx="62" cy="46" rx="7" ry="5" fill="#fff"/>
        <path d="M 77 40 L 90 34 L 84 46 L 90 52 L 77 50 Z" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;
    case 'gozluk':
      return `<circle cx="40" cy="47" r="11" fill="rgba(255,235,150,0.4)" stroke="${c}" stroke-width="3.5"/>
        <circle cx="62" cy="47" r="11" fill="rgba(255,235,150,0.4)" stroke="${c}" stroke-width="3.5"/>
        <line x1="51" y1="47" x2="51" y2="47" stroke="${c}" stroke-width="3"/>
        <path d="M 48 45 Q 51 42 54 45" stroke="${c}" stroke-width="3" fill="none"/>`;
    case 'korsan':
      return `<path d="M 26 36 L 78 42 L 76 50 L 54 48 L 50 56 L 46 47 L 27 44 Z" fill="${c}" stroke="${OUT}" stroke-width="2"/>
        <ellipse cx="62" cy="46" rx="9" ry="8" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;
    default:
      return '';
  }
}

function earSvg(a: AvatarDef): string {
  switch (a.ear) {
    case 'yarasa':
      return `<path d="M 30 26 L 26 6 L 42 18 Z M 72 26 L 76 6 L 60 18 Z" fill="${a.maskColor}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'kedi':
      return `<path d="M 30 26 L 27 8 L 44 17 Z M 72 26 L 75 8 L 58 17 Z" fill="${a.maskColor}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M 32 22 L 31 13 L 40 18 Z M 70 22 L 71 13 L 62 18 Z" fill="#ff8fa3"/>`;
    case 'anten':
      return `<line x1="38" y1="20" x2="32" y2="6" stroke="${OUT}" stroke-width="2.5"/><circle cx="32" cy="6" r="4" fill="#ffd166" stroke="${OUT}" stroke-width="2"/>
        <line x1="64" y1="20" x2="70" y2="6" stroke="${OUT}" stroke-width="2.5"/><circle cx="70" cy="6" r="4" fill="#ffd166" stroke="${OUT}" stroke-width="2"/>`;
    case 'diken':
      return `<path d="M 32 24 L 20 12 L 36 16 L 30 2 L 46 12 L 46 2 L 56 12 L 66 4 L 62 16 L 78 8 L 70 22 Z" fill="#0353a4" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'alev':
      return `<path d="M 32 24 Q 26 10 36 4 Q 36 12 42 12 Q 40 2 51 0 Q 48 10 56 10 Q 58 2 66 6 Q 62 14 70 16 Q 76 12 74 24 Z" fill="#ff9e00" stroke="#bf3100" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'panda':
      return `<circle cx="30" cy="22" r="10" fill="#1a1a1a"/><circle cx="72" cy="22" r="10" fill="#1a1a1a"/>`;
    default:
      return '';
  }
}

/** Panda/yeşil öfke gibi yüz üstü ek detaylar */
function extraSvg(a: AvatarDef): string {
  if (a.id === 'panda-usta') {
    return `<ellipse cx="40" cy="47" rx="9" ry="11" fill="#1a1a1a"/><ellipse cx="62" cy="47" rx="9" ry="11" fill="#1a1a1a"/>
      <circle cx="40" cy="47" r="4" fill="#fff"/><circle cx="62" cy="47" r="4" fill="#fff"/>
      <circle cx="40.5" cy="46" r="1.8" fill="#1a1a1a"/><circle cx="62.5" cy="46" r="1.8" fill="#1a1a1a"/>`;
  }
  if (a.id === 'orumcek-yenge') {
    return `<g stroke="#7a0c14" stroke-width="1.5" fill="none" opacity="0.8">
      <path d="M 51 18 L 51 78 M 28 30 L 74 66 M 74 30 L 28 66 M 24 48 L 78 48"/>
      <circle cx="51" cy="48" r="14"/><circle cx="51" cy="48" r="24"/></g>`;
  }
  if (a.id === 'sihirbaz-suat') {
    return `<path d="M 30 26 L 51 -2 L 72 26 Q 51 18 30 26 Z" fill="#240046" stroke="${OUT}" stroke-width="2.5"/>
      <circle cx="51" cy="8" r="3" fill="#ffd166"/><circle cx="40" cy="18" r="2" fill="#ffd166"/><circle cx="61" cy="16" r="2" fill="#ffd166"/>`;
  }
  return '';
}

/** Kare profil fotoğrafı SVG'si (data URI) */
export function avatarDataUri(id: string | null | undefined): string {
  const a = AVATARS.find((av) => av.id === id) ?? AVATARS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/>
    </linearGradient></defs>
    <rect width="100" height="100" fill="url(#bg)"/>
    <circle cx="26" cy="20" r="1.6" fill="rgba(255,255,255,0.5)"/>
    <circle cx="82" cy="30" r="1.2" fill="rgba(255,255,255,0.4)"/>
    <circle cx="70" cy="12" r="1.4" fill="rgba(255,255,255,0.45)"/>
    <path d="M 18 100 Q 22 74 51 74 Q 80 74 84 100 Z" fill="${a.emblemBg}" stroke="${OUT}" stroke-width="2.5"/>
    <circle cx="51" cy="48" r="30" fill="${a.face}" stroke="${OUT}" stroke-width="3"/>
    ${earSvg(a)}
    ${maskSvg(a)}
    ${extraSvg(a)}
    ${eyesSvg(a)}
    ${mouthSvg(a)}
    <circle cx="51" cy="88" r="10" fill="#ffffff" stroke="${OUT}" stroke-width="2.5"/>
    <text x="51" y="93" font-size="12" font-weight="900" text-anchor="middle" font-family="Arial, sans-serif" fill="${a.emblemBg}">${a.emblem}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function avatarName(id: string | null | undefined): string {
  return AVATARS.find((av) => av.id === id)?.name ?? AVATARS[0].name;
}
