// ============================================================
// Ses efektleri — WebAudio ile sentezlenir (hazır dosya yok, tasarım 3.13).
// Ton: gerçekçi/ciddi, "çocuk oyunu" değil (tasarım 3.1). Tüm çağrılar
// güvenli (AudioContext yoksa veya hata olursa sessizce yok sayılır).
// Motor, durum.sesler kuyruğunu her karede boşaltıp cal() çağırır.
// ============================================================

let ctx = null;
let anaGain = null;
let acik = true;

function baglam() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    anaGain = ctx.createGain();
    anaGain.gain.value = 0.35;
    anaGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

// Kullanıcı etkileşiminde çağrılır (tarayıcı politikası: ses için gesture gerekir).
export function devamEt() {
  const c = baglam();
  try { if (c && c.state === "suspended") c.resume(); } catch { /* yok say */ }
}

export function sesAcik(deger) { acik = deger; }

// Kısa gürültü tamponu (darbe/kesme sesleri için).
function gurultu(sure) {
  const c = ctx;
  const n = Math.floor(c.sampleRate * sure);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function zarf(g, bas, tepe, sure) {
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(tepe, t + bas);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
}

function ton(tip, f0, f1, sure, tepe = 0.6) {
  const c = ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tip;
  o.frequency.setValueAtTime(f0, c.currentTime);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + sure);
  zarf(g, 0.006, tepe, sure);
  o.connect(g).connect(anaGain);
  o.start();
  o.stop(c.currentTime + sure + 0.02);
}

export function cal(ad) {
  if (!acik) return;
  const c = baglam();
  if (!c || c.state !== "running") return;
  try {
    switch (ad) {
      case "isabet": {            // kesme/darbe: gürültü + alçak vuruş
        const g = c.createGain();
        zarf(g, 0.004, 0.7, 0.16);
        const n = gurultu(0.16);
        const bp = c.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1400;
        n.connect(bp).connect(g).connect(anaGain);
        n.start();
        ton("triangle", 180, 90, 0.16, 0.4);
        break;
      }
      case "kalkan":              // metal savuşturma
        ton("square", 520, 300, 0.14, 0.35);
        ton("triangle", 900, 600, 0.1, 0.25);
        break;
      case "iska": {              // havada savrulan silah
        const g = c.createGain();
        zarf(g, 0.02, 0.3, 0.22);
        const n = gurultu(0.22);
        const hp = c.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 2200;
        n.connect(hp).connect(g).connect(anaGain);
        n.start();
        break;
      }
      case "olum":                // düşüş vurgusu
        ton("sawtooth", 220, 70, 0.4, 0.5);
        break;
      case "item":                // toplama tık-parıltı
        ton("sine", 880, 1320, 0.12, 0.4);
        break;
      case "borazan":             // faz/başlangıç borazanı
        ton("sawtooth", 330, 330, 0.5, 0.5);
        setTimeout(() => ton && ctx && ton("sawtooth", 440, 440, 0.6, 0.5), 180);
        break;
      default:
        break;
    }
  } catch { /* sesi yok say */ }
}
