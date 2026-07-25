// Yetişme sistemi başsız doğrulama: iki araç aynı pistte, biri "usta" (tam gaz + nitro),
// diğeri "acemi" (gaz %88, nitro tuşuna HİÇ basmaz). Eski sistemde acemi katlanarak
// geride kalıyordu; yeni sistemde fark bir tavana oturmalı.
import { createCarState, stepCar, catchupStrength, leashStrength, slipstreamStrength } from '../game/carPhysics.ts';
import { getTrackData } from '../game/tracks.ts';
import { startPose } from '../game/track.ts';
import { createBotDriver, botInput } from '../game/botAI.ts';
import { getCar } from '../game/cars.ts';

const track = getTrackData('city');
const stats = getCar('civic-ok');
const totalLaps = 2;
const count = track.count;
const prog = (s: any) => s.lap * count + s.trackIndex;

function sim(yetismeAcik: boolean) {
  const a = createCarState(startPose(track, 0).x, startPose(track, 0).z, startPose(track, 0).heading);
  const b = createCarState(startPose(track, 1).x, startPose(track, 1).z, startPose(track, 1).heading);
  const da = createBotDriver(4, stats.topSpeed / 3.6); // usta
  const db = createBotDriver(0, stats.topSpeed / 3.6); // acemi
  db.skill = 0.55; // belirgin şekilde daha kötü sürücü
  const dt = 1 / 60;
  let t = 0;
  let maksFark = 0;
  while (t < 240 && !(a.finished && b.finished)) {
    t += dt;
    const pa = prog(a);
    const pb = prog(b);
    const lider = Math.max(pa, pb);
    const bandA = yetismeAcik
      ? { assist: catchupStrength((lider - pa) / count), leash: pa > pb ? leashStrength((pa - pb) / count) : 0 }
      : {};
    const bandB = yetismeAcik
      ? { assist: catchupStrength((lider - pb) / count), leash: pb > pa ? leashStrength((pb - pa) / count) : 0 }
      : {};
    // nitro dolumu (yetişme) — acemi nitro TUŞUNA basmaz, usta basar
    if (yetismeAcik) {
      b.nitroEnergy = Math.min(1, b.nitroEnergy + 0.42 * catchupStrength((lider - pb) / count) * dt);
      a.nitroEnergy = Math.min(1, a.nitroEnergy + 0.42 * catchupStrength((lider - pa) / count) * dt);
    }
    const ia = botInput(da, a, track, dt);
    const ib = botInput(db, b, track, dt);
    stepCar(a, ia, stats, track, dt, { totalLaps, running: true, ...bandA });
    stepCar(b, { ...ib, nitro: false }, stats, track, dt, { totalLaps, running: true, ...bandB });
    // fark ölçümü yalnız İKİSİ de yarışırken anlamlı (biri bitince ilerlemesi donar)
    if (!a.finished && !b.finished) maksFark = Math.max(maksFark, Math.abs(prog(a) - prog(b)) / count);
  }
  return {
    maksFarkTur: +maksFark.toFixed(3),
    bitisFarkiSn: +(b.raceTime - a.raceTime).toFixed(2),
    aSure: +a.raceTime.toFixed(1),
    bSure: +b.raceTime.toFixed(1),
    ikisiBitti: a.finished && b.finished,
  };
}

const kapali = sim(false);
const acik = sim(true);
console.log('YETİŞME KAPALI :', JSON.stringify(kapali));
console.log('YETİŞME AÇIK   :', JSON.stringify(acik));
console.log(
  'maks fark (tur): kapalı %s → açık %s | bitiş farkı: %s sn → %s sn',
  kapali.maksFarkTur, acik.maksFarkTur, kapali.bitisFarkiSn, acik.bitisFarkiSn,
);

// ---- doğrulamalar ----
const kontroller: [string, boolean][] = [
  ['fark en az yarıya iniyor', acik.maksFarkTur < kapali.maksFarkTur * 0.6],
  ['bitiş farkı 4 sn altına iniyor', acik.bitisFarkiSn < 4],
  ['usta sürücü yine kazanıyor (yardım hile değil)', acik.bitisFarkiSn > 0],
  ['liderin süresi %5\'ten fazla bozulmuyor', acik.aSure < kapali.aSure * 1.05],
  ['burun buruna düelloda yardım yok', catchupStrength(0.004) === 0 && leashStrength(0.01) === 0],
  ['tam yardım tavanı 1', catchupStrength(0.2) === 1 && leashStrength(0.2) === 1],
  ['slipstream yalnız yakın takipte', slipstreamStrength(8, 1) > 0.5 && slipstreamStrength(20, 0) === 0 && slipstreamStrength(8, 5) === 0],
];
let hata = 0;
for (const [ad, ok] of kontroller) {
  console.log(`${ok ? '✓' : '✗'} ${ad}`);
  if (!ok) hata++;
}
console.log(hata === 0 ? `TÜM KONTROLLER GEÇTİ (${kontroller.length})` : `${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
console.log('eğri kontrol: catchup(0)=%s catchup(0.05)=%s catchup(0.2)=%s leash(0.01)=%s leash(0.2)=%s slip(8m,1m)=%s slip(20m,0)=%s',
  catchupStrength(0), catchupStrength(0.05).toFixed(2), catchupStrength(0.2), leashStrength(0.01), leashStrength(0.2), slipstreamStrength(8, 1).toFixed(2), slipstreamStrength(20, 0));
