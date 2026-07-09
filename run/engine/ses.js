// ============================================================
// RUN — ses efektleri (WebAudio ile sentez, hazır dosya yok — tasarım 10).
// Sürekli sesler: ortam uğultusu + drone yakınlık vızıltısı (mesafeye göre).
// Tek-atım: sopa, kalkan, yakala, yakalandi, kacti, alarm, kapi, ui.
// Tüm çağrılar güvenli (AudioContext yoksa sessizce yok sayılır).
// ============================================================

let ctx = null, anaGain = null, acik = true;
let ortamGain = null, droneOsc = null, droneGain = null, droneFilt = null;
let ortamKaynaklar = [];   // çalan sürekli kaynaklar (ortamDur ile durdurulur)

function baglam() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    anaGain = ctx.createGain(); anaGain.gain.value = 0.32; anaGain.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

// Kullanıcı etkileşiminde çağrılır (tarayıcı sesi başlatma politikası).
export function devamEt() {
  const c = baglam();
  try { if (c && c.state === "suspended") c.resume(); } catch {}
  ortamBasla();
}
export function sesAcik(v) { acik = v; if (ortamGain) ortamGain.gain.value = v ? 0.5 : 0; }

// Sürekli ortam uğultusu (sürekli çalar — tasarım 10)
export function ortamBasla() {
  const c = baglam(); if (!c || ortamGain) return;
  try {
    ortamGain = c.createGain(); ortamGain.gain.value = 0.5; ortamGain.connect(anaGain);
    const o1 = c.createOscillator(); o1.type = "sine"; o1.frequency.value = 54;
    const g1 = c.createGain(); g1.gain.value = 0.18; o1.connect(g1).connect(ortamGain); o1.start();
    // hafif filtreli gürültü (havalandırma hışırtısı)
    const n = c.createBufferSource(); const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    n.buffer = buf; n.loop = true;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 340;
    const ng = c.createGain(); ng.gain.value = 0.05; n.connect(lp).connect(ng).connect(ortamGain); n.start();
    // drone vızıltı yatağı (mesafeye göre açılır)
    droneOsc = c.createOscillator(); droneOsc.type = "sawtooth"; droneOsc.frequency.value = 110;
    droneFilt = c.createBiquadFilter(); droneFilt.type = "bandpass"; droneFilt.frequency.value = 600; droneFilt.Q.value = 3;
    droneGain = c.createGain(); droneGain.gain.value = 0;
    droneOsc.connect(droneFilt).connect(droneGain).connect(anaGain); droneOsc.start();
    ortamKaynaklar = [o1, n, droneOsc];
  } catch {}
}

// Sürekli sesleri durdur (oyun sayfasından çıkarken). devamEt() yeniden başlatır.
export function ortamDur() {
  for (const k of ortamKaynaklar) { try { k.stop(); } catch {} }
  ortamKaynaklar = [];
  try { ortamGain?.disconnect(); } catch {}
  try { droneGain?.disconnect(); } catch {}
  ortamGain = null; droneOsc = null; droneGain = null; droneFilt = null;
}

// Drone yakınlık vızıltısı — en yakın drone mesafesine göre (görmeden duy, tasarım 10).
export function droneYakinlik(mesafe) {
  if (!droneGain || !ctx) return;
  try {
    const yakin = Math.max(0, 1 - mesafe / 650); // 0..1 (menzil genişletildi)
    const g = Math.pow(yakin, 1.4) * 0.45;       // yaklaştıkça belirgin yükselir
    droneGain.gain.setTargetAtTime(acik ? g : 0, ctx.currentTime, 0.08);
    droneOsc.frequency.setTargetAtTime(90 + yakin * 150, ctx.currentTime, 0.08);
    droneFilt.frequency.setTargetAtTime(400 + yakin * 1100, ctx.currentTime, 0.08);
  } catch {}
}

function zarf(g, bas, tepe, sure) {
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(tepe, t + bas);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
}
function ton(tip, f0, f1, sure, tepe = 0.6) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tip; o.frequency.setValueAtTime(f0, ctx.currentTime);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + sure);
  zarf(g, 0.006, tepe, sure); o.connect(g).connect(anaGain); o.start(); o.stop(ctx.currentTime + sure + 0.02);
}
function gurultuAt(sure, tip, freq, tepe) {
  const n = ctx.createBufferSource(); const buf = ctx.createBuffer(1, ctx.sampleRate * sure, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = buf; const f = ctx.createBiquadFilter(); f.type = tip; f.frequency.value = freq;
  const g = ctx.createGain(); zarf(g, 0.004, tepe, sure); n.connect(f).connect(g).connect(anaGain); n.start();
}

export function cal(ad) {
  if (!acik) return;
  const c = baglam(); if (!c || c.state !== "running") return;
  try {
    switch (ad) {
      case "sopa":                 // beyzbol sopası darbesi (thwack)
        gurultuAt(0.14, "bandpass", 900, 0.7); ton("triangle", 160, 70, 0.14, 0.4); break;
      case "kalkan":               // kalkan aktivasyonu (parıltı)
        ton("sine", 500, 1100, 0.35, 0.4); ton("sine", 760, 1500, 0.3, 0.25); break;
      case "yakala":               // drone yakalama ışını (zap)
        ton("square", 900, 200, 0.22, 0.35); gurultuAt(0.15, "highpass", 2000, 0.3); break;
      case "ates":                 // drone menzilden ateş (keskin lazer)
        ton("sawtooth", 1400, 300, 0.16, 0.4); gurultuAt(0.1, "bandpass", 3000, 0.3); break;
      case "sat":                  // rakibi sattın (ka-ching, yükselen ödül)
        ton("triangle", 700, 1050, 0.1, 0.4); setTimeout(() => baglam() && ton("triangle", 1050, 1500, 0.16, 0.4), 90); break;
      case "yakalandi":            // oyuncu yakalandı (kayıp)
        ton("sawtooth", 300, 60, 0.6, 0.5); break;
      case "kacti":                // kaçış başarısı (yükselen)
        ton("triangle", 400, 800, 0.18, 0.5); setTimeout(() => baglam() && ton("triangle", 620, 1200, 0.28, 0.5), 150); break;
      case "alarm":                // makine alarmı (drone çeker)
        ton("square", 720, 720, 0.18, 0.35); setTimeout(() => baglam() && ton("square", 560, 560, 0.18, 0.35), 220); break;
      case "hack":                 // makine ele geçirildi (yükselen dijital onay)
        ton("square", 600, 900, 0.09, 0.3);
        setTimeout(() => baglam() && ton("square", 900, 1400, 0.12, 0.32), 80);
        setTimeout(() => baglam() && ton("sine", 1400, 1900, 0.2, 0.3), 170); break;
      case "sersem":               // EMP darbesi (droneler sersemler)
        ton("sine", 220, 30, 0.5, 0.5); gurultuAt(0.3, "lowpass", 700, 0.4); break;
      case "kapi":                 // kapı kapanma / kırılma
        gurultuAt(0.22, "lowpass", 220, 0.6); break;
      case "ui":                   // arayüz tık
        ton("sine", 880, 1200, 0.08, 0.3); break;
      default: break;
    }
  } catch {}
}
