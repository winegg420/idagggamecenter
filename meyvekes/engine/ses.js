// ============================================================
// MEYVE KES — ses efektleri (WebAudio ile sentezlenir, dosya yok)
// Tek bir AudioContext; ilk kullanıcı jestinde (Başla butonu) açılır.
// Tüm sesler kısa ve ucuzdur (mobilde de sorunsuz).
// ============================================================

let ac = null;
let anaKazanc = null;
let gurultuTampon = null;
let acik = true;

// Beyaz gürültü tamponu (bıçak sesi için) — bir kez üretilir.
function gurultu() {
  if (gurultuTampon || !ac) return gurultuTampon;
  try {
    const uzunluk = Math.floor(ac.sampleRate * 0.4);
    const tampon = ac.createBuffer(1, uzunluk, ac.sampleRate);
    const veri = tampon.getChannelData(0);
    for (let i = 0; i < uzunluk; i++) veri[i] = Math.random() * 2 - 1;
    gurultuTampon = tampon;
  } catch {
    /* yut */
  }
  return gurultuTampon;
}

// Kullanıcı jestiyle çağrılmalı (autoplay politikası).
export function sesBaslat() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      anaKazanc = ac.createGain();
      anaKazanc.gain.value = 0.55;
      anaKazanc.connect(ac.destination);
      gurultu();
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
  } catch {
    /* ses olmadan da oyun çalışır */
  }
}

export function sesAcKapa(deger) {
  acik = !!deger;
  try {
    if (anaKazanc) anaKazanc.gain.value = acik ? 0.55 : 0;
  } catch {
    /* yut */
  }
  return acik;
}

export function sesDurdur() {
  try {
    ac?.close?.();
  } catch {
    /* yut */
  }
  ac = null;
  anaKazanc = null;
  gurultuTampon = null;
}

// Kısa gürültü patlaması + bandpass süpürme = "şvışş" bıçak sesi.
function bicak(t0, guc = 1) {
  const tampon = gurultu();
  if (!tampon) return;
  const kaynak = ac.createBufferSource();
  kaynak.buffer = tampon;
  const filtre = ac.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.Q.value = 1.1;
  filtre.frequency.setValueAtTime(2600, t0);
  filtre.frequency.exponentialRampToValueAtTime(520, t0 + 0.14);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5 * guc, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  kaynak.connect(filtre).connect(g).connect(anaKazanc);
  kaynak.start(t0);
  kaynak.stop(t0 + 0.2);
}

// Basit ton (osilatör + zarf).
function ton(t0, frekans, hedefFrekans, sure, tip = "sine", guc = 0.3) {
  const o = ac.createOscillator();
  o.type = tip;
  o.frequency.setValueAtTime(frekans, t0);
  if (hedefFrekans && hedefFrekans !== frekans) {
    o.frequency.exponentialRampToValueAtTime(Math.max(30, hedefFrekans), t0 + sure);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(guc, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(anaKazanc);
  o.start(t0);
  o.stop(t0 + sure + 0.05);
}

// tip: 'kes' | 'altin' | 'combo' | 'yut' | 'kacti' | 'bitti'
export function sesCal(tip) {
  if (!ac || !acik) return;
  try {
    const t = ac.currentTime + 0.001;
    if (tip === "kes") {
      bicak(t, 1);
      ton(t, 260, 120, 0.09, "triangle", 0.16);
    } else if (tip === "altin") {
      bicak(t, 1.2);
      ton(t, 880, 880, 0.09, "square", 0.14);
      ton(t + 0.07, 1320, 1320, 0.1, "square", 0.13);
      ton(t + 0.15, 1760, 1760, 0.14, "square", 0.12);
    } else if (tip === "combo") {
      ton(t, 620, 1240, 0.18, "triangle", 0.2);
    } else if (tip === "yut") {
      // "glop": hızlı inen ton + kısa gürültü pofu
      ton(t, 520, 90, 0.16, "sine", 0.34);
      bicak(t, 0.35);
    } else if (tip === "bitti") {
      ton(t, 700, 700, 0.16, "triangle", 0.22);
      ton(t + 0.16, 520, 520, 0.16, "triangle", 0.22);
      ton(t + 0.32, 350, 350, 0.34, "triangle", 0.22);
    }
  } catch {
    /* ses hatası oynanışı bozmaz */
  }
}
