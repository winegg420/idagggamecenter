// Profesyonel bot sürücü AI — eski "yol takipçisi"nin yerini alır.
//
// Yetenekler:
//  1. VİRAJ EĞRİLİĞİ ANALİZİ: pistin her örneğinde önceden hesaplanan eğrilikten viraj hız
//     limiti çıkarılır (vAllow = sqrt(aLat/curv)); fren mesafesi hesabıyla viraja GİRMEDEN
//     yavaşlar, düzlükte tam gaz gider (eski AI sabit governor + kaba açı freniydi).
//  2. YARIŞ HATTI: pure-pursuit hedefi yakın+uzak örnek KİRİŞİ üzerinden seçilir → viraj
//     içini doğal keser (apex); düzlükte kendi şeridine (lateralBias) döner → sollama çeşitliliği.
//  3. NİTRO YÖNETİMİ: düzlükte, enerji yeterliyken basar; virajda israf etmez.
//  4. RUBBER-BAND (pace): Scene oyuncu farkına göre günceller — geride kalan bot hızlanır,
//     çok öne geçen bot nefes bırakır. Yarış baştan sona temaslı kalır ama usta bot
//     (yüksek skill) öndeyken neredeyse hiç yavaşlamaz → 1.lik KAZANILMASI gereken şey olur.
//
// Saf modül (React yok) → headless test edilebilir (scripts/botTune.ts).

import type { CarInput, CarState } from './types';
import type { TrackData } from './track';

export interface BotDriver {
  /** 0..1 — viraj cesareti, fren marjı, direksiyon keskinliği */
  skill: number;
  /** düzlükte tercih edilen şerit ofseti (m) — çeşitlilik/sollama */
  lateralBias: number;
  /** temel hız tavanı (m/s) — pace çarpanıyla oynar */
  maxSpeed: number;
  /** rubber-band çarpanı (Scene günceller; 1 = nötr) */
  pace: number;
  /** yumuşatılmış şerit ofseti (ani şerit değişimi olmasın) */
  lateralNow: number;
}

/** deterministik kademeli bot üretimi — i büyüdükçe daha usta ve hızlı.
 *  carTopSpeedMs verilirse tavan ARACA GÖRELİ olur: bot, aracının fiziksel limitinin
 *  %80-97'sini kullanır — hyper araçlı bot düzlükte hyper hızına çıkar. Eski sabit
 *  37-47 m/s tavan hızlı araç seçen oyuncuya düzlükte asla yetişemiyordu (rekabet
 *  kopuyordu); aynı arabayı almış gerçek bir rakip gibi sürsün diye kaldırıldı.
 *  Viraj hız limiti (skill bazlı aLat) ayrıca uygulanır → farkı sürüş ustalığı belirler. */
export function createBotDriver(i: number, carTopSpeedMs?: number): BotDriver {
  return {
    skill: 0.82 + i * 0.045, // 0.82 .. 1.0 (5 bot)
    lateralBias: ((i % 3) - 1) * 2.6,
    maxSpeed: carTopSpeedMs
      ? carTopSpeedMs * (0.92 + i * 0.02) // 0.92 .. 1.00 — usta bot aracın TAM hızını kullanır
      : 37 + i * 2.5, // eski taban — yalnızca araç hızı verilmeyen ayar scriptleri için
    pace: 1,
    lateralNow: 0,
  };
}

/** Botun pasif nitro dolum hızı (nitro/sn) — oyuncunun drift gelirinin bot karşılığı.
 *  Ustalıkla ölçeklenir: usta bot depoyu neredeyse oyuncu gibi doldurur (harcama 0.35/sn →
 *  usta bot düzlüklerin çoğunu nitroyla geçer). Scene her karede uygular. */
export function botNitroIncome(skill: number): number {
  return 0.05 + Math.max(0, skill - 0.82) * 0.65; // 0.05 .. 0.167 (harcama 0.35/sn → %14..%48 nitro payı)
}

/** Bot yetişme nitrosu — oyuncu eğrisinden (catchupNitroRate: 0.05 turda başlar, 0.35'te
 *  tavan) ÇOK daha erken başlar ve dik tırmanır. Gerekçe: oyuncu farkı saniyeler içinde
 *  açıyor; bot ancak KESİNTİSİZ nitroyla (fizik ×1.3) o tempoya yetişebilir. ~1 sn geride
 *  yardım başlar, ~7-8 sn geride tavan: dolum (0.38) harcamayı (0.35) aşar → depo hep dolu,
 *  bot fiili olarak sürekli nitroyla kovalar. Fark kapanınca yardım kendiliğinden söner →
 *  burun buruna düello dürüst kalır. Final sprintte Scene bunu tamamen keser. */
export function botCatchupNitroRate(gapLaps: number): number {
  if (gapLaps <= 0.012) return 0;
  const t = Math.min(1, (gapLaps - 0.012) / (0.13 - 0.012));
  return 0.38 * t;
}

interface TrackAI {
  /** örnek başına mutlak eğrilik (1/m, komşu pencerede yumuşatılmış) */
  curv: Float32Array;
  /** örnekler arası ortalama mesafe (m) */
  spacing: number;
}

const trackAICache = new WeakMap<TrackData, TrackAI>();

function getTrackAI(track: TrackData): TrackAI {
  let ai = trackAICache.get(track);
  if (ai) return ai;
  const { samples, count, totalLength } = track;
  const spacing = totalLength / count;
  const raw = new Float32Array(count);
  const W = 3; // teğet farkı penceresi
  for (let i = 0; i < count; i++) {
    const a = samples[(i - W + count) % count];
    const b = samples[(i + W) % count];
    let dh = Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx);
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    raw[i] = Math.abs(dh) / (2 * W * spacing);
  }
  // komşu maksimumla yumuşat (kısa keskin viraj kaybolmasın)
  const curv = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let m = 0;
    for (let k = -2; k <= 2; k++) m = Math.max(m, raw[(i + k + count) % count]);
    curv[i] = m;
  }
  ai = { curv, spacing };
  trackAICache.set(track, ai);
  return ai;
}

function wrapPi(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Bot sürüş girdisi — her fizik adımında çağrılır. */
export function botInput(bot: BotDriver, s: CarState, track: TrackData, dt: number): CarInput {
  const { curv, spacing } = getTrackAI(track);
  const { samples, count, halfWidth } = track;
  const idx = s.trackIndex;
  const v = Math.max(s.speed, 1);

  // --- viraj hız limiti + fren mesafesi planı ---
  // tutunma cesareti (m/s²) — arcade fizik ~28'e dek güvenli (playerProxy ölçümü).
  // Kovalarken (pace>1) viraj cesareti de artar: düz hız tavanı fizikle sınırlı (×1.3)
  // olduğundan, hızlı oyuncuya yetişmek ancak virajı da onun gibi almakla mümkün.
  const aLat = Math.min(28, (10 + bot.skill * 15) * Math.max(1, bot.pace));
  const aBrake = 24.5 + bot.skill * 3; // stepCar fren 28 m/s² — usta bot daha geç frenler
  const cap = bot.maxSpeed * bot.pace;
  // nitro yanarken düzlük tavanı fizik limitine (×1.3) yaklaşır — bot kendi nitrosuna
  // fren basmasın (eskiden nitroyla bile tavanda frenliyordu; oyuncu ×1.3'e çıkıyordu)
  const capNow = s.nitroActive ? cap * 1.28 : cap;
  let vLimit = capNow;
  // fren ufku: mevcut hızdan durmaya yetecek mesafe + tampon
  const horizonM = (v * v) / (2 * aBrake) + 14;
  const horizonN = Math.min(count - 1, Math.ceil(horizonM / spacing));
  for (let j = 0; j <= horizonN; j++) {
    const c = curv[(idx + j) % count];
    if (c < 1e-4) continue;
    const vAllow = Math.sqrt(aLat / c);
    if (vAllow >= capNow) continue;
    const dist = j * spacing;
    // o virajı vAllow ile dönebilmek için ŞU AN izin verilen azami hız
    const vNow = Math.sqrt(vAllow * vAllow + 2 * aBrake * Math.max(0, dist - 2.5));
    if (vNow < vLimit) vLimit = vNow;
  }
  const brake = s.speed > vLimit + 1.2;
  const throttle = brake ? 0 : 1;

  // --- yarış hattı: yakın + uzak örnek kirişi (viraj içini doğal keser) ---
  const nearN = Math.max(4, Math.round((6 + v * 0.42) / spacing));
  const farN = Math.max(nearN + 4, Math.round((10 + v * 0.95) / spacing));
  const nS = samples[(idx + nearN) % count];
  const fS = samples[(idx + farN) % count];
  // önümüzdeki bölgenin eğriliği (şerit/nitro kararı için)
  let cAhead = 0;
  for (let j = 0; j <= farN; j += 2) cAhead = Math.max(cAhead, curv[(idx + j) % count]);
  // düzlükte kendi şeridine, virajda merkez kirişe (kiriş zaten apex'e yaklaşır)
  const laneT = bot.lateralBias * Math.max(0, Math.min(1, 1 - cAhead * 110));
  bot.lateralNow += (laneT - bot.lateralNow) * Math.min(1, dt * 1.6);
  let tx = (nS.x + fS.x) / 2 + nS.nx * bot.lateralNow;
  let tz = (nS.z + fS.z) / 2 + nS.nz * bot.lateralNow;
  // hedefi pist içinde tut (kiriş keskin virajda dışarı taşabilir)
  const relX = tx - nS.x;
  const relZ = tz - nS.z;
  const lat = relX * nS.nx + relZ * nS.nz;
  const maxLat = halfWidth - 2.8;
  if (Math.abs(lat) > maxLat) {
    const cl = Math.sign(lat) * maxLat;
    tx = nS.x + nS.nx * cl + (relX - nS.nx * lat);
    tz = nS.z + nS.nz * cl + (relZ - nS.nz * lat);
  }

  const desired = Math.atan2(tz - s.z, tx - s.x);
  const diff = wrapPi(desired - s.heading);
  const steer = Math.max(-1, Math.min(1, diff * (2.3 + bot.skill * 1.1)));

  // --- drift: keskin viraj + yeterli hız → döndürme yardımı + nitro enerjisi birikir ---
  const drift = Math.abs(diff) > 0.34 && s.speed > 19;
  // --- nitro: düzlükte bas, tavanın ÜSTÜNE çık (oyuncu gibi ×1.3'e yaklaşır; virajda israf etme) ---
  // kovalarken (pace>1) daha az enerjiyle de basar — geriden gelen bot nitroyu sonuna dek kullanır
  // histerezis: basmaya başladıysa depo bitene dek sürdür (kare-kare açık/kapalı titremesin)
  const nitroMin = s.nitroActive ? 0.03 : bot.pace > 1.02 ? 0.08 : 0.25;
  // sıkı kovalamada (çok geride) hafif virajda da basar — depo taşıp israf olmasın
  const nitroCurvMax = bot.pace > 1.1 ? 0.02 : 0.012;
  const nitro = cAhead < nitroCurvMax && Math.abs(diff) < 0.14 && s.nitroEnergy > nitroMin && s.speed < cap * 1.27;

  return { steer, throttle, brake, drift, nitro };
}

/**
 * Rubber-band pace güncellemesi — Scene her karede çağırır.
 * gapLaps: (oyuncuİlerleme - botİlerleme) / count → + ise bot GERİDE.
 * Geride kalan bot %30'a kadar hızlanır; öne geçen bot nefes bırakır — ama usta bot
 * (skill→1) neredeyse hiç yavaşlamaz, böylece 1.lik her zaman mücadele gerektirir.
 */
export function updatePace(bot: BotDriver, gapLaps: number): void {
  if (gapLaps > 0) {
    // geride: %30'a kadar tempo artışı (araç fiziği yine tavan — hile değil, agresif kovalama)
    // dik eğim (×4): saniyeler mertebesindeki fark bile tam kovalama temposunu tetikler
    bot.pace = 1 + Math.min(0.3, gapLaps * 4.0);
  } else {
    // önde: mesafeyle orantılı nefes — oyuncunun hemen önündeyken TAM tempo (dürüst düello),
    // açık ara kaçmışken hafifçe yavaşlar. Usta bot öndeyken neredeyse HİÇ yavaşlamaz →
    // 1.liği geri almak oyuncunun gerçekten hızlı sürmesini gerektirir.
    const maxEase = 0.02 + (1 - bot.skill) * 0.07;
    bot.pace = 1 - Math.min(maxEase, -gapLaps * 0.9);
  }
}
