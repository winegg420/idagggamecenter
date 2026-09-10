// Bildim ses motoru — WebAudio ile üretilen kısa tonlar (dosya indirmesi yok).
//
// Neden dosya değil: tek bir mp3 bile PWA önbelleğine yük bindiriyor ve mobil
// tarayıcılarda ilk çalma gecikiyor. Osilatör tonu anında çalıyor, boyutu sıfır.
//
// iOS/Android kuralı: AudioContext yalnız bir kullanıcı hareketinden sonra
// çalışır. Bu yüzden ilk dokunuş/tıklama/tuşta context açılır (sesKilidiAc).

const DEPO_ANAHTARI = "bildim_ses";

let ctx = null;
let kilitAcildi = false;

/** Ses açık mı? (kullanıcı tercihi; varsayılan açık) */
export function sesAcikMi() {
  try {
    return localStorage.getItem(DEPO_ANAHTARI) !== "0";
  } catch {
    return true; // özel mod: tercih okunamıyorsa sesi kapatma
  }
}

/** Ses tercihini yaz. */
export function sesAyarla(acik) {
  try {
    localStorage.setItem(DEPO_ANAHTARI, acik ? "1" : "0");
  } catch {
    /* özel mod — tercih saklanamaz, oturum boyunca varsayılan geçerli */
  }
}

function context() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null; // ses donanımı yok / tarayıcı engelledi
  }
}

/**
 * İlk kullanıcı hareketinde AudioContext'i açar. Uygulama girişinde bir kez
 * çağrılır; dinleyiciler ilk olaydan sonra kendini söker.
 */
export function sesKilidiAc() {
  if (kilitAcildi || typeof window === "undefined") return;
  kilitAcildi = true;
  const ac = () => {
    try {
      const c = context();
      if (c && c.state === "suspended") c.resume();
    } catch {
      /* tarayıcı izin vermedi — ses sessizce devre dışı kalır */
    }
    window.removeEventListener("pointerdown", ac);
    window.removeEventListener("keydown", ac);
    window.removeEventListener("touchstart", ac);
  };
  window.addEventListener("pointerdown", ac, { once: false });
  window.addEventListener("keydown", ac, { once: false });
  window.addEventListener("touchstart", ac, { once: false });
}

/** Tek ton çal. */
function ton({ frekans = 880, sure = 0.09, hacim = 0.16, tip = "sine", gecikme = 0 }) {
  if (!sesAcikMi()) return;
  const c = context();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    const t0 = c.currentTime + gecikme;
    const osc = c.createOscillator();
    const kazanc = c.createGain();
    osc.type = tip;
    osc.frequency.setValueAtTime(frekans, t0);
    // Klik sesini engellemek için hızlı ama yumuşak zarf
    kazanc.gain.setValueAtTime(0.0001, t0);
    kazanc.gain.exponentialRampToValueAtTime(hacim, t0 + 0.012);
    kazanc.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    osc.connect(kazanc).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + sure + 0.02);
  } catch {
    /* ses çalınamadı — oyun akışını bozmaz */
  }
}

/** Son saniye tik'i. kalanSn: 5→1 (azaldıkça tizleşir ve sertleşir). */
export function sesTik(kalanSn) {
  const n = Math.max(1, Math.min(5, Math.round(kalanSn)));
  ton({ frekans: 620 + (5 - n) * 90, sure: 0.08, hacim: 0.13 + (5 - n) * 0.02, tip: "triangle" });
}

/** Süre doldu — alçalan iki ton. */
export function sesSureDoldu() {
  ton({ frekans: 420, sure: 0.14, hacim: 0.16, tip: "sawtooth" });
  ton({ frekans: 260, sure: 0.24, hacim: 0.16, tip: "sawtooth", gecikme: 0.13 });
}

/** Doğru cevap — yükselen üçlü. */
export function sesDogru() {
  ton({ frekans: 660, sure: 0.09, hacim: 0.15 });
  ton({ frekans: 880, sure: 0.09, hacim: 0.15, gecikme: 0.08 });
  ton({ frekans: 1180, sure: 0.16, hacim: 0.15, gecikme: 0.16 });
}

/** Yanlış cevap — kısa alçak vuruş. */
export function sesYanlis() {
  ton({ frekans: 200, sure: 0.2, hacim: 0.15, tip: "square" });
}

/** Buton dokunuşu — çok kısa klik. */
export function sesDokunus() {
  ton({ frekans: 1150, sure: 0.035, hacim: 0.075, tip: "square" });
}

/** Maç kazandın — üç notalı arpej. */
export function sesKazandin() {
  ton({ frekans: 523, sure: 0.12, hacim: 0.16 });
  ton({ frekans: 659, sure: 0.12, hacim: 0.16, gecikme: 0.11 });
  ton({ frekans: 784, sure: 0.26, hacim: 0.17, gecikme: 0.22 });
}

/** Rütbe atlama — yükselen dörtlü, sonuncusu uzun. */
export function sesRutbeAtladi() {
  ton({ frekans: 523, sure: 0.1, hacim: 0.15, tip: "triangle" });
  ton({ frekans: 698, sure: 0.1, hacim: 0.15, tip: "triangle", gecikme: 0.1 });
  ton({ frekans: 880, sure: 0.1, hacim: 0.16, tip: "triangle", gecikme: 0.2 });
  ton({ frekans: 1047, sure: 0.36, hacim: 0.17, tip: "triangle", gecikme: 0.3 });
}

/** Maç kaybetme — alçalan iki nota (kazanma arpejinin tersi). */
export function sesKaybettin() {
  ton({ frekans: 392, sure: 0.16, hacim: 0.15, tip: "triangle" });
  ton({ frekans: 262, sure: 0.34, hacim: 0.15, tip: "triangle", gecikme: 0.15 });
}

/**
 * Joker kullanımı — süzgeçten geçmiş beyaz gürültüyle kısa "swoosh".
 * Osilatör tonu bu etkiyi veremiyor; kısa bir gürültü tamponu üretilip
 * bant geçiren süzgeçten geçiriliyor. Dosya yok, boyut yok.
 */
export function sesJoker() {
  if (!sesAcikMi()) return;
  const c = context();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    const sure = 0.26;
    const uzunluk = Math.floor(c.sampleRate * sure);
    const tampon = c.createBuffer(1, uzunluk, c.sampleRate);
    const veri = tampon.getChannelData(0);
    for (let i = 0; i < uzunluk; i++) veri[i] = Math.random() * 2 - 1;
    const kaynak = c.createBufferSource();
    kaynak.buffer = tampon;
    const suzgec = c.createBiquadFilter();
    suzgec.type = "bandpass";
    suzgec.Q.value = 1.1;
    const t0 = c.currentTime;
    // Süzgeç tepe frekansı yukarı kayar → "swoosh" hissi
    suzgec.frequency.setValueAtTime(500, t0);
    suzgec.frequency.exponentialRampToValueAtTime(3600, t0 + sure);
    const kazanc = c.createGain();
    kazanc.gain.setValueAtTime(0.0001, t0);
    kazanc.gain.exponentialRampToValueAtTime(0.14, t0 + 0.05);
    kazanc.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    kaynak.connect(suzgec).connect(kazanc).connect(c.destination);
    kaynak.start(t0);
    kaynak.stop(t0 + sure + 0.02);
  } catch {
    /* ses çalınamadı — joker yine de kullanılır */
  }
}
