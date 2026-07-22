// Özelleştirme seçeneği önizleme ikonları — her kategori/varyant için küçük SVG görsel.
// Amaç: garajda her parça seçeneğinin ismi ALTINDA o parçanın görseli görünsün.

interface Props {
  cat: string;
  i: number;
}

const VB = '0 0 44 44';

/** Jant — 3 farklı tasarım (5 kollu / örgü spor / turbofan) */
function Rim({ i }: { i: number }) {
  const spokes = [];
  if (i === 0) {
    // klasik 5 kollu
    for (let k = 0; k < 5; k++)
      spokes.push(<rect key={k} x={21} y={9} width={2} height={13} rx={1} fill="#c9ced8" transform={`rotate(${k * 72} 22 22)`} />);
  } else if (i === 1) {
    // örgü spor (çok ince kol)
    for (let k = 0; k < 10; k++)
      spokes.push(<rect key={k} x={21.3} y={8} width={1.3} height={14} fill="#aeb4c0" transform={`rotate(${k * 36} 22 22)`} />);
  } else {
    // turbofan (eğri bıçaklar)
    for (let k = 0; k < 6; k++)
      spokes.push(
        <path key={k} d="M22 22 L22 9 Q26 12 25 20 Z" fill="#c9ced8" transform={`rotate(${k * 60} 22 22)`} />,
      );
  }
  return (
    <svg viewBox={VB}>
      <circle cx={22} cy={22} r={17} fill="#15171d" stroke="#5b6270" strokeWidth={2} />
      <circle cx={22} cy={22} r={14.5} fill="#20242c" />
      {spokes}
      <circle cx={22} cy={22} r={4} fill="#9aa0ac" />
      <circle cx={22} cy={22} r={1.6} fill="#3a3f4a" />
    </svg>
  );
}

/** Lastik — tread desenleri (yol / drift / yarış) */
function Tire({ i }: { i: number }) {
  const tread =
    i === 0
      ? [10, 18, 26, 34].map((y, k) => <rect key={k} x={12} y={y} width={20} height={2} fill="#4a4f5a" />)
      : i === 1
        ? [8, 14, 20, 26, 32].map((y, k) => <rect key={k} x={12} y={y} width={20} height={3} fill="#3a3f4a" />)
        : [12, 22, 32].map((y, k) => <rect key={k} x={13} y={y} width={18} height={1.5} fill="#5a5f6a" />);
  return (
    <svg viewBox={VB}>
      <rect x={9} y={6} width={26} height={32} rx={5} fill="#181a20" stroke="#4a4f5a" strokeWidth={2} />
      {tread}
      {i === 2 && <text x={22} y={24} fontSize={7} fill="#e0242f" textAnchor="middle" fontWeight="bold">R</text>}
    </svg>
  );
}

/** Egzoz — tek / çift / orta çıkış */
function Exhaust({ i }: { i: number }) {
  const pipes =
    i === 0
      ? [[26]]
      : i === 1
        ? [[20, 30]]
        : [[22]];
  const y = 24;
  return (
    <svg viewBox={VB}>
      <rect x={4} y={18} width={30} height={12} rx={3} fill="#2a2d36" />
      {pipes[0].map((px, k) => (
        <g key={k}>
          <rect x={px} y={y - 3} width={12} height={6} rx={3} fill="#4a4f5a" />
          <circle cx={px + 12} cy={y} r={3.4} fill="#12141a" stroke="#8a90a0" strokeWidth={1.4} />
        </g>
      ))}
      {i === 2 && <text x={12} y={38} fontSize={6} fill="#9aa0ac">orta</text>}
    </svg>
  );
}

/** Araç yan-profil tabanı (splitter/spoiler/skirt için ortak siluet) */
function CarSide({ children }: { children?: React.ReactNode }) {
  return (
    <svg viewBox={VB}>
      <path d="M4 30 Q8 20 16 19 L22 13 Q30 13 33 19 L40 21 Q41 26 39 30 Z" fill="#2f3a4a" stroke="#5b6270" strokeWidth={1} />
      <circle cx={13} cy={31} r={4} fill="#12141a" />
      <circle cx={33} cy={31} r={4} fill="#12141a" />
      {children}
    </svg>
  );
}

function Splitter({ i }: { i: number }) {
  return <CarSide>{i === 1 && <rect x={30} y={30} width={11} height={2.4} rx={1} fill="#e0242f" />}</CarSide>;
}
function Skirt({ i }: { i: number }) {
  return <CarSide>{i === 1 && <rect x={10} y={30} width={22} height={2} fill="#111" />}</CarSide>;
}
function Spoiler({ i }: { i: number }) {
  return (
    <CarSide>
      {i === 1 && <rect x={4} y={17} width={7} height={2.2} rx={1} fill="#111" />}
      {i === 2 && (
        <g fill="#111">
          <rect x={3} y={12} width={10} height={2.2} rx={1} />
          <rect x={6} y={12} width={1.6} height={7} />
        </g>
      )}
    </CarSide>
  );
}

function Hood({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <rect x={7} y={10} width={30} height={24} rx={3} fill={i === 1 ? '#20242c' : '#3a4a5e'} stroke="#5b6270" strokeWidth={1} />
      {i === 1 &&
        [0, 1, 2, 3].map((k) => <line key={k} x1={10 + k * 7} y1={10} x2={10 + k * 7} y2={34} stroke="#0e1014" strokeWidth={1} />)}
      {i === 1 && <text x={22} y={40} fontSize={6} fill="#9aa0ac" textAnchor="middle">karbon</text>}
    </svg>
  );
}

const TINTS = ['#8fb0d8', '#3f5772', '#141c28'];
function Tint({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <path d="M8 26 L13 14 L31 14 L36 26 Z" fill={TINTS[i]} stroke="#20242c" strokeWidth={2} />
      <line x1={22} y1={14} x2={22} y2={26} stroke="#20242c" strokeWidth={1.4} />
    </svg>
  );
}

const HEAD = ['#f3f6ff', '#9fd8ff', '#ffd76a'];
function Light({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <ellipse cx={16} cy={22} rx={7} ry={9} fill={HEAD[i]} />
      <polygon points="21,15 40,10 40,34 21,29" fill={HEAD[i]} opacity={0.35} />
    </svg>
  );
}

const NIT = ['#38b6ff', '#b04cff', '#4cff7a'];
function Nitro({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <path d="M22 6 C14 16 15 24 22 38 C29 24 30 16 22 6 Z" fill={NIT[i]} opacity={0.85} />
      <path d="M22 16 C18 22 19 28 22 36 C25 28 26 22 22 16 Z" fill="#fff" opacity={0.6} />
    </svg>
  );
}

function Decal({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <rect x={9} y={8} width={26} height={28} rx={4} fill="#2f3a4a" stroke="#5b6270" strokeWidth={1} />
      {i === 1 && <rect x={20} y={8} width={4} height={28} fill="#e8e8ea" />}
      {i === 2 && (
        <g fill="#e8e8ea">
          <rect x={17} y={8} width={3} height={28} />
          <rect x={24} y={8} width={3} height={28} />
        </g>
      )}
    </svg>
  );
}

function Dash({ i }: { i: number }) {
  return (
    <svg viewBox={VB}>
      <rect x={6} y={12} width={32} height={20} rx={4} fill="#12141a" stroke="#3a3f4a" strokeWidth={1} />
      <path d="M12 27 A10 10 0 0 1 32 27" fill="none" stroke={i === 1 ? '#2df0ff' : '#8a90a0'} strokeWidth={2.4} />
      <line x1={22} y1={27} x2={28} y2={20} stroke={i === 1 ? '#ff2d6f' : '#e0242f'} strokeWidth={2} />
    </svg>
  );
}

export function PartIcon({ cat, i }: Props) {
  let inner: React.ReactNode = null;
  switch (cat) {
    case 'rim': inner = <Rim i={i} />; break;
    case 'tire': inner = <Tire i={i} />; break;
    case 'exhaust': inner = <Exhaust i={i} />; break;
    case 'splitter': inner = <Splitter i={i} />; break;
    case 'spoiler': inner = <Spoiler i={i} />; break;
    case 'skirt': inner = <Skirt i={i} />; break;
    case 'hood': inner = <Hood i={i} />; break;
    case 'tint': inner = <Tint i={i} />; break;
    case 'lightColor': inner = <Light i={i} />; break;
    case 'nitroColor': inner = <Nitro i={i} />; break;
    case 'decal': inner = <Decal i={i} />; break;
    case 'dashTheme': inner = <Dash i={i} />; break;
    default: inner = null;
  }
  return <span className="part-icon">{inner}</span>;
}
