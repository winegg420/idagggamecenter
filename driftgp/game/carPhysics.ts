// Arcade araç fiziği — kinematik model.
// Hız skaler + yön vektörü; drift = hız yönünün heading'i gecikmeli takibi.

import type { CarInput, CarState, CarStats } from './types';
import { nearestSample, type TrackData } from './track.ts';

const KMH_TO_MS = 1 / 3.6;

/** araç yarıçapı (m) — çarpışma için; toplam min mesafe = 2× */
export const CAR_RADIUS = 1.45;

// --- Hasar sistemi eşikleri ---
// Denge (uzun vadeli birikim): duman, ESKİ ayarın 10 KATI istismar gerektirir (~10 sert
// çarpışma veya ~2.5 dk sürekli duvar sıyırma) → ancak yarışın sonlarına doğru görülür.
// Yangın, dumanın 5 KATI istismar gerektirir (eşik oranı 0.99/0.2) → yalnızca yarış boyu
// pervasız sürüşte, en sonda çıkar. Hemen duman/alev YOK.
/** bu hasarın üstünde kaputtan duman çıkar */
export const DAMAGE_SMOKE = 0.2;
/** bu hasarın üstünde araç yanar (alev + kara duman) — duman eşiğinin ~5 katı birikim */
export const DAMAGE_FIRE = 0.99;
/** tam hasarda maks. hız kaybı oranı (hasar oyunu bitirmesin, ceza hissedilsin) */
const DAMAGE_TOP_LOSS = 0.18;
/** tam hasarda ivme kaybı oranı */
const DAMAGE_ACCEL_LOSS = 0.3;

/** Çarpışma şiddetini (m/s kapanma hızı) birikimli hasara çevirir.
 *  ~4 m/s altı temaslar hasar vermez (arcade bump'lar cezasız). Bölen 805: tek sert
 *  çarpışma ~0.02-0.1 hasar → duman ~10 sert darbe, yangın ~50 darbe eşdeğeri ister. */
export function addDamage(s: CarState, severity: number): void {
  if (severity <= 4) return;
  s.damage = Math.min(1, s.damage + (severity - 4) / 805);
}

// --- Yetişme nitrosu (rubber-band) — geride kalan oyunculara kademeli otomatik nitro ---
/** liderle fark bu tur oranını (tur cinsinden) aşınca yardım başlar (~3-5 sn geride) */
export const CATCHUP_START = 0.05;
/** yardımın tavana ulaştığı tur farkı (~25-30 sn geride) */
export const CATCHUP_FULL = 0.35;
/** tavan dolum hızı (nitro/sn) — nitro harcaması 0.35/sn; tavanda dolum harcamayı neredeyse
 *  karşılar → çok geride kalan drift yapmasa bile sürekli nitroyla 1.'yi yakalamaya yaklaşır.
 *  Son turun ikinci yarısında Scene bu yardımı tamamen keser (dürüst final sprint). */
export const CATCHUP_MAX_RATE = 0.34;

/**
 * Geride kalan oyuncunun nitro dolum hızı (nitro/sn). gapLaps = liderle fark (tur cinsinden).
 * Kademeli (ease-in) eğri: az geridekine az, çok geridekine çok yardım → 1. asla farkı
 * açamaz ama öndeki oyuncuya HİÇ yardım verilmez (gap<=eşik → 0). Her istemci kendi
 * aracı için yerel hesaplar (MP'de adalet: herkese aynı kural, senkron veri gerektirmez).
 */
export function catchupNitroRate(gapLaps: number): number {
  if (gapLaps <= CATCHUP_START) return 0;
  const t = Math.min(1, (gapLaps - CATCHUP_START) / (CATCHUP_FULL - CATCHUP_START));
  return CATCHUP_MAX_RATE * t * Math.sqrt(t);
}

function wrapAngleTo(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * İki gerçek-fizikli araç arası "bump" çözümü (oyuncu ↔ AI bot) — GERÇEKÇİ momentum aktarımı.
 * - Pozisyonları eşit ayırır (üst üste binmeyi önler).
 * - Hız vektörleri üzerinden impuls: arkadan çarpan öndekini iter, kendi yavaşlar; yandan
 *   çarpma yanal savurur. Eşit kütle, düşük restitution (0.25) → arcade ama tepkili.
 * - Sert çarpmada kapanma hızıyla orantılı hafif enerji kaybı (darbe hissi).
 * Döndürür: çarpışma şiddeti (m/s kapanma hızı; 0 = çarpışma yok) — ses/efekt için.
 */
export function resolveCarCollision(a: CarState, b: CarState): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const distSq = dx * dx + dz * dz;
  const minDist = CAR_RADIUS * 2;
  if (distSq >= minDist * minDist || distSq < 1e-6) return 0;
  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  // 1) eşit pozisyon ayrımı
  a.x += nx * overlap * 0.5;
  a.z += nz * overlap * 0.5;
  b.x -= nx * overlap * 0.5;
  b.z -= nz * overlap * 0.5;
  // 2) momentum değişimi — hız vektörleri (n, b'den a'ya bakar)
  const avx = Math.cos(a.velAngle) * a.speed;
  const avz = Math.sin(a.velAngle) * a.speed;
  const bvx = Math.cos(b.velAngle) * b.speed;
  const bvz = Math.sin(b.velAngle) * b.speed;
  const vn = (avx - bvx) * nx + (avz - bvz) * nz; // <0 ise yaklaşıyorlar
  if (vn < 0) {
    const e = 0.25; // restitution (arcade — çok zıplamasın)
    const j = -(1 + e) * vn * 0.5; // eşit kütle: impuls yarı yarıya
    const nax = avx + j * nx, naz = avz + j * nz;
    const nbx = bvx - j * nx, nbz = bvz - j * nz;
    const loss = Math.min(0.16, Math.abs(vn) * 0.006); // sert darbede küçük enerji kaybı
    a.speed = Math.hypot(nax, naz) * (1 - loss);
    b.speed = Math.hypot(nbx, nbz) * (1 - loss);
    if (a.speed > 0.01) a.velAngle = Math.atan2(naz, nax);
    if (b.speed > 0.01) b.velAngle = Math.atan2(nbz, nbx);
    // sert temas iki gövdeye de hasar işler (duman/yangın + performans cezası)
    addDamage(a, Math.abs(vn));
    addDamage(b, Math.abs(vn));
    return Math.abs(vn);
  }
  // ayrılıyorlar: sadece hafif sürtünme sekmesi (hız korunur)
  const nAngle = Math.atan2(nz, nx);
  a.velAngle = wrapAngleTo(a.velAngle + wrapAngleTo(nAngle - a.velAngle) * 0.08);
  b.velAngle = wrapAngleTo(b.velAngle + wrapAngleTo(nAngle + Math.PI - b.velAngle) * 0.08);
  return 1.5; // düşük şiddetli sürtünme teması
}

/**
 * Oyuncu ↔ hayalet/uzak araç (otoriter pozisyon) bump çözümü.
 * MP adaleti: sadece YEREL oyuncu itilir, hız cezası yok — lag'li uzak
 * oyuncunun yereli haksız yavaşlatması engellenir. Görsel/pozisyon etkisi.
 */
export function resolveGhostCollision(a: CarState, bx: number, bz: number): number {
  const dx = a.x - bx;
  const dz = a.z - bz;
  const distSq = dx * dx + dz * dz;
  const minDist = CAR_RADIUS * 2;
  if (distSq >= minDist * minDist || distSq < 1e-6) return 0;
  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  a.x += nx * overlap;
  a.z += nz * overlap;
  const nAngle = Math.atan2(nz, nx);
  a.velAngle = wrapAngleTo(a.velAngle + wrapAngleTo(nAngle - a.velAngle) * 0.12);
  // MP adaleti: yerel hıza CEZA YOK — sadece ses/efekt şiddeti (yerel hıza göre) döndür.
  // Hasar yerel fiziğe aittir (kendi çarpışman) → yarıya indirilmiş şiddetle işlenir.
  const sev = Math.min(30, a.speed * 0.6 + 3);
  addDamage(a, sev * 0.55);
  return sev;
}

export function createCarState(x: number, z: number, heading: number): CarState {
  return {
    x,
    z,
    heading,
    velAngle: heading,
    speed: 0,
    slip: 0,
    steerVisual: 0,
    nitroEnergy: 0,
    nitroActive: false,
    drifting: false,
    wallContact: false,
    damage: 0,
    wallImpact: 0,
    trackIndex: 0,
    passedMid: false,
    lap: 1,
    raceTime: 0,
    lapStartTime: 0,
    lapTimes: [],
    finished: false,
    driftScore: 0,
    wallHits: 0,
    maxSpeedKmh: 0,
    nitroUses: 0,
    lapWallHit: false,
    cleanLapDone: false,
  };
}

/** açıyı -PI..PI aralığına indirger */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface StepOptions {
  totalLaps: number;
  /** yarış başladı mı (start ışıkları söndü mü) */
  running: boolean;
}

export function stepCar(
  s: CarState,
  input: CarInput,
  stats: CarStats,
  track: TrackData,
  dt: number,
  opts: StepOptions,
): void {
  if (dt <= 0) return;
  dt = Math.min(dt, 1 / 20); // spiral of death önlemi

  const topSpeed = stats.topSpeed * KMH_TO_MS;
  // 0-100 süresinden ivme (m/s²); arcade his için %25 bonus
  const baseAccel = (27.78 / stats.accel0to100) * 1.25;

  // --- Nitro ---
  const wasNitro = s.nitroActive;
  s.nitroActive = input.nitro && s.nitroEnergy > 0.02 && opts.running;
  if (s.nitroActive && !wasNitro) s.nitroUses += 1;
  if (s.nitroActive) {
    s.nitroEnergy = Math.max(0, s.nitroEnergy - dt * 0.35);
  }
  // hasar cezası: yüksek hasarda motor güç kaybeder (lineer, oyunu bitirmez ama hissedilir)
  const dmgTop = 1 - s.damage * DAMAGE_TOP_LOSS;
  const dmgAccel = 1 - s.damage * DAMAGE_ACCEL_LOSS;
  const effTop = (s.nitroActive ? topSpeed * 1.3 : topSpeed) * dmgTop;
  const effAccel = (s.nitroActive ? baseAccel * 1.8 : baseAccel) * dmgAccel;

  // --- Boyuna dinamik (gaz/fren/sürtünme) ---
  const throttle = opts.running && !s.finished ? input.throttle : 0;
  if (input.brake) {
    s.speed = Math.max(0, s.speed - 28 * dt);
  } else {
    // hıza bağlı azalan itiş + aerodinamik direnç
    const drive = effAccel * Math.max(0, 1 - s.speed / effTop) * throttle;
    const drag = 0.35 * dt * (s.speed / Math.max(effTop, 1));
    s.speed = Math.max(0, s.speed + drive * dt - drag);
  }
  // --- Direksiyon ---
  const speedNorm = Math.min(1, s.speed / 55);
  // çok düşük hızda dönme azalır; yüksek hızda kısıtlanır (gerçekçi viraj limiti)
  const steerAuthority = Math.min(1, s.speed / 6) * (1 - speedNorm * 0.45);
  const driftBoost = input.drift ? 1.45 : 1;
  const steerRate = 1.9 * stats.steerRate * steerAuthority * driftBoost;
  s.heading = wrapAngle(s.heading + input.steer * steerRate * dt);

  // görsel ön teker açısı (yumuşatılmış)
  s.steerVisual += (input.steer * 0.45 - s.steerVisual) * Math.min(1, dt * 10);

  // --- Grip / drift: hız yönü heading'i takip eder ---
  // hız arttıkça grip düşer → yüksek hızda viraj almak kaymaya yol açar
  const gripSpeedScale = Math.min(1, Math.max(0.3, 22 / Math.max(s.speed, 1)));
  const gripRate = input.drift
    ? 1.6 + stats.driftControl * 1.2 // drift: gevşek takip → kayma
    : (5 + stats.grip * 7) * gripSpeedScale; // normal: sıkı takip
  const diff = wrapAngle(s.heading - s.velAngle);
  s.velAngle = wrapAngle(s.velAngle + diff * Math.min(1, gripRate * dt));
  s.slip = wrapAngle(s.heading - s.velAngle);
  s.drifting = input.drift && Math.abs(s.slip) > 0.12 && s.speed > 8;

  // yana kayma hız kaybettirir (scrub); drift modunda ceza azalır → drift ödüllendirilir
  const scrubFactor = input.drift ? 0.6 : 1.4;
  s.speed = Math.max(0, s.speed - Math.abs(s.slip) * 5 * scrubFactor * dt);

  // drift → nitro enerjisi + drift puanı birikir
  if (s.drifting && opts.running) {
    s.nitroEnergy = Math.min(1, s.nitroEnergy + Math.abs(s.slip) * dt * 0.55);
    s.driftScore += Math.abs(s.slip) * s.speed * dt * 6;
  }
  s.maxSpeedKmh = Math.max(s.maxSpeedKmh, s.speed * 3.6);

  // --- Konum ---
  s.x += Math.cos(s.velAngle) * s.speed * dt;
  s.z += Math.sin(s.velAngle) * s.speed * dt;

  // --- Pist sınırı (duvar) ---
  const idx = nearestSample(track, s.x, s.z, s.trackIndex);
  const smp = track.samples[idx];
  const relX = s.x - smp.x;
  const relZ = s.z - smp.z;
  const lateral = relX * smp.nx + relZ * smp.nz;
  const limit = track.halfWidth - 1.1; // araç yarı genişliği payı
  const wasWallContact = s.wallContact;
  s.wallContact = false;
  s.wallImpact = 0;
  if (Math.abs(lateral) > limit) {
    const clamped = Math.sign(lateral) * limit;
    s.x = smp.x + smp.nx * clamped + (relX - smp.nx * lateral);
    s.z = smp.z + smp.nz * clamped + (relZ - smp.nz * lateral);
    // hız yönünü duvara paralel hale getir + sürtünme cezası
    const tangentDir = Math.atan2(smp.tz, smp.tx);
    const towardWall = Math.sign(wrapAngle(s.velAngle - tangentDir)) === Math.sign(lateral);
    // yanal çarpma hızı — darbe şiddeti (sıyırma ≈ düşük, dik dalma ≈ yüksek)
    const vLat = Math.abs(s.speed * Math.sin(wrapAngle(s.velAngle - tangentDir)));
    if (towardWall) {
      s.velAngle = wrapAngle(tangentDir + wrapAngle(s.velAngle - tangentDir) * 0.2);
      s.heading = wrapAngle(tangentDir + wrapAngle(s.heading - tangentDir) * 0.6);
    }
    s.speed *= 1 - 0.9 * dt;
    if (!wasWallContact && opts.running) {
      // temasın İLK anı (kenar tespiti — süren temasta her karede sayılmaz)
      s.wallHits += 1;
      s.lapWallHit = true;
      s.wallImpact = vLat;
      addDamage(s, vLat * 1.5); // dik duvar darbesi ciddi hasar işler
    } else if (opts.running) {
      // sürekli sürtünme: çok yavaş hasar birikimi (duman eşiği tam hızda ~2.5 dk sıyırma)
      s.damage = Math.min(1, s.damage + dt * 0.0014 * Math.min(1, s.speed / 30));
    }
    s.wallContact = true;
  }

  // --- Tur sayımı ---
  const prevIdx = s.trackIndex;
  s.trackIndex = idx;
  if (opts.running && !s.finished) {
    s.raceTime += dt;
    const mid = Math.floor(track.count / 2);
    if (Math.abs(idx - mid) < 30) s.passedMid = true;
    // sarmal geçiş: son %5'ten ilk %5'e ileri yönde geçiş = çizgi
    const nearEnd = prevIdx > track.count * 0.95;
    const nearStart = idx < track.count * 0.05;
    if (nearEnd && nearStart && s.passedMid) {
      s.lapTimes.push(s.raceTime - s.lapStartTime);
      s.lapStartTime = s.raceTime;
      s.passedMid = false;
      if (!s.lapWallHit) s.cleanLapDone = true;
      s.lapWallHit = false;
      if (s.lap >= opts.totalLaps) {
        s.finished = true;
      } else {
        s.lap += 1;
      }
    }
  }
}
