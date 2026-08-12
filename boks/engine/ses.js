// ============================================================
// GÖLGE BOKS — ses (WebAudio ile sentezlenir, dosya yok) + SESLİ KOÇ (TTS)
//
// Tek AudioContext; ilk kullanıcı jestinde (Başla butonu) açılır — autoplay
// politikası gereği. Tüm efektler kısa ve ucuzdur (mobilde de sorunsuz).
//
// SESLİ KOÇ: `speechSynthesis` ile Türkçe konuşur. İki kişilik vardır:
//   agresif → kısa, yüksek enerjili, motive edici komutlar
//   sakin   → teknik, açıklayıcı, sakin tonlu yönlendirme
// Konuşmalar kuyruklanır ve üst üste binmez; oyun akışını bölmemek için
// eskimiş komutlar (0.9 sn'den yaşlı) düşürülür.
// ============================================================

let ac = null;
let anaKazanc = null;
let gurultuTampon = null;
let acik = true;
let kocAcik = true;
let kocKisilik = "agresif";
let sesTercih = null; // seçilmiş Türkçe ses (SpeechSynthesisVoice)
let konusuyor = false;
let kuyruk = [];

// ---------------- WebAudio altyapı ----------------
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

export function sesBaslat() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      anaKazanc = ac.createGain();
      anaKazanc.gain.value = 0.5;
      anaKazanc.connect(ac.destination);
      gurultu();
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
  } catch {
    /* ses olmadan da oyun çalışır */
  }
  sesleriHazirla();
}

export function sesAcKapa(deger) {
  acik = !!deger;
  try {
    if (anaKazanc) anaKazanc.gain.value = acik ? 0.5 : 0;
  } catch {
    /* yut */
  }
  return acik;
}

export function kocAcKapa(deger) {
  kocAcik = !!deger;
  if (!kocAcik) kocSustur();
  return kocAcik;
}

export function kocKisilikAyarla(k) {
  kocKisilik = k === "sakin" ? "sakin" : "agresif";
  return kocKisilik;
}

export function sesDurdur() {
  kocSustur();
  try {
    ac?.close?.();
  } catch {
    /* yut */
  }
  ac = null;
  anaKazanc = null;
  gurultuTampon = null;
}

function darbe(t0, guc = 1, alcak = false) {
  const tampon = gurultu();
  if (!tampon) return;
  const kaynak = ac.createBufferSource();
  kaynak.buffer = tampon;
  const filtre = ac.createBiquadFilter();
  filtre.type = alcak ? "lowpass" : "bandpass";
  filtre.Q.value = 0.9;
  filtre.frequency.setValueAtTime(alcak ? 900 : 1800, t0);
  filtre.frequency.exponentialRampToValueAtTime(alcak ? 180 : 320, t0 + 0.12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55 * guc, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  kaynak.connect(filtre).connect(g).connect(anaKazanc);
  kaynak.start(t0);
  kaynak.stop(t0 + 0.2);
}

function ton(t0, frekans, hedef, sure, tip = "sine", guc = 0.3) {
  const o = ac.createOscillator();
  o.type = tip;
  o.frequency.setValueAtTime(frekans, t0);
  if (hedef && hedef !== frekans) {
    o.frequency.exponentialRampToValueAtTime(Math.max(30, hedef), t0 + sure);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(guc, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(anaKazanc);
  o.start(t0);
  o.stop(t0 + sure + 0.05);
}

/**
 * tip: 'vurus' | 'vurus-sert' | 'combo' | 'yanlis' | 'gong' | 'bitis'
 *    | 'tehdit' | 'kacis' | 'blok' | 'yendin' | 'beat' | 'beat-vurgu'
 */
export function sesCal(tip) {
  if (!ac || !acik) return;
  try {
    const t = ac.currentTime + 0.001;
    switch (tip) {
      case "vurus":
        // deri-eldiven teması: kısa alçak patlama + tok gövde
        darbe(t, 0.9, true);
        ton(t, 180, 70, 0.09, "triangle", 0.22);
        break;
      case "vurus-sert":
        darbe(t, 1.25, true);
        ton(t, 140, 55, 0.13, "square", 0.24);
        ton(t + 0.01, 320, 120, 0.08, "triangle", 0.12);
        break;
      case "combo":
        ton(t, 520, 1040, 0.16, "triangle", 0.2);
        ton(t + 0.08, 780, 1560, 0.14, "triangle", 0.16);
        break;
      case "yanlis":
        ton(t, 220, 160, 0.1, "sawtooth", 0.12);
        break;
      case "gong":
        // ring zili: iki metalik ton + uzun sönüm
        ton(t, 860, 840, 0.9, "triangle", 0.26);
        ton(t + 0.005, 1290, 1250, 0.75, "sine", 0.16);
        break;
      case "bitis":
        ton(t, 660, 660, 0.2, "triangle", 0.24);
        ton(t + 0.2, 880, 880, 0.2, "triangle", 0.24);
        ton(t + 0.4, 1100, 1100, 0.45, "triangle", 0.24);
        break;
      case "tehdit":
        ton(t, 300, 520, 0.16, "sawtooth", 0.1);
        break;
      case "kacis":
        darbe(t, 0.35);
        ton(t, 900, 1500, 0.12, "sine", 0.16);
        break;
      case "blok":
        darbe(t, 0.7, true);
        ton(t, 420, 300, 0.1, "square", 0.14);
        break;
      case "yendin":
        darbe(t, 1.1, true);
        ton(t, 120, 60, 0.22, "sawtooth", 0.2);
        break;
      case "beat":
        ton(t, 90, 55, 0.09, "sine", 0.22);
        break;
      case "beat-vurgu":
        ton(t, 110, 60, 0.11, "sine", 0.28);
        darbe(t, 0.25);
        break;
      default:
        break;
    }
  } catch {
    /* ses hatası oynanışı bozmaz */
  }
}

// ---------------- SESLİ KOÇ (TTS) ----------------
function sesleriHazirla() {
  try {
    const ss = window.speechSynthesis;
    if (!ss) return;
    const sec = () => {
      const hepsi = ss.getVoices() || [];
      sesTercih =
        hepsi.find((v) => v.lang === "tr-TR") ||
        hepsi.find((v) => (v.lang || "").toLowerCase().startsWith("tr")) ||
        null;
    };
    sec();
    if (!sesTercih) ss.onvoiceschanged = sec;
  } catch {
    /* TTS yoksa oyun sessiz koçla çalışır */
  }
}

function kuyrukIsle() {
  if (konusuyor || !kuyruk.length) return;
  const ss = window.speechSynthesis;
  if (!ss) {
    kuyruk = [];
    return;
  }
  const simdi = performance.now();
  // Eskimiş komut söylenmez (oyun akışının gerisinde kalmasın).
  while (kuyruk.length && simdi - kuyruk[0].t > 900 && !kuyruk[0].onemli) kuyruk.shift();
  const s = kuyruk.shift();
  if (!s) return;
  try {
    const u = new SpeechSynthesisUtterance(s.metin);
    if (sesTercih) u.voice = sesTercih;
    u.lang = "tr-TR";
    u.rate = kocKisilik === "agresif" ? 1.18 : 0.98;
    u.pitch = kocKisilik === "agresif" ? 1.08 : 0.94;
    u.volume = 1;
    konusuyor = true;
    u.onend = () => {
      konusuyor = false;
      kuyrukIsle();
    };
    u.onerror = () => {
      konusuyor = false;
      kuyrukIsle();
    };
    ss.speak(u);
  } catch {
    konusuyor = false;
  }
}

/** Koç konuşur. `onemli` olanlar kuyrukta eskise de söylenir. */
export function kocKonus(metin, onemli = false) {
  if (!kocAcik || !metin) return;
  try {
    if (!window.speechSynthesis) return;
    // Kuyruk şişmesin: en fazla 3 bekleyen cümle.
    if (kuyruk.length > 2) kuyruk.splice(0, kuyruk.length - 2);
    kuyruk.push({ metin, onemli, t: performance.now() });
    kuyrukIsle();
  } catch {
    /* yut */
  }
}

export function kocSustur() {
  kuyruk = [];
  konusuyor = false;
  try {
    window.speechSynthesis?.cancel?.();
  } catch {
    /* yut */
  }
}

// ---------------- koç repliği üretimi ----------------
// Motor `konusmalar` kuyruğuna yapısal olay yazar; metin burada kişiliğe göre
// üretilir (motor DOM/TTS bilmez).
const KOMBO_AD = {
  1: "jab",
  2: "kroşe değil, cross",
  3: "ön hook",
  4: "arka hook",
  5: "ön aparkat",
  6: "arka aparkat",
};

function komboMetin(dizi) {
  if (dizi.length === 1) return KOMBO_AD[dizi[0]] || String(dizi[0]);
  // "1-2" gibi kısa numara komutu: gerçek salonda koç böyle bağırır.
  return dizi.join(", ");
}

const REPLIK = {
  agresif: {
    "round-basla": (o) => `Round ${o.round}! Hadi, eller yukarı!`,
    mola: () => "Mola! Nefes al, su iç, gardını indirme.",
    "antrenman-bitti": () => "Bitti! İyi iş çıkardın.",
    kombo: (o) => komboMetin(o.dizi),
    "kombo-tamam": () => ["Güzel!", "İşte bu!", "Devam!"][(Math.random() * 3) | 0],
    combo: (o) => (o.combo >= 10 ? "Seri kopmuyor, harika!" : "Seriyi sürdür!"),
    efor: () => "Nabzın yüksek, tempoyu biraz düşür.",
    "tempo-dusuyor": () => "Tempo düşüyor! Elleri yukarı, kısa vur!",
    postur: () => "Dikleş! Sırtını topla.",
    "gard-dusuk": () => "Gardını kaldır!",
  },
  sakin: {
    "round-basla": (o) => `${o.round}. round başlıyor. Duruşunu al, omuzlar gevşek.`,
    mola: () => "Mola. Derin nefes al, omuzlarını indir, kalp atışını düşür.",
    "antrenman-bitti": () => "Antrenman tamamlandı. Şimdi soğuma ve esneme zamanı.",
    kombo: (o) => komboMetin(o.dizi),
    "kombo-tamam": () => ["Temiz.", "Doğru sıra.", "Akış iyi."][(Math.random() * 3) | 0],
    combo: () => "Ritmini koru, acele etme.",
    efor: () => "Efor yüksek görünüyor. Temponu bir kademe düşür.",
    "tempo-dusuyor": () => "Tempon düştü. Daha kısa kombinasyonlarla toparla.",
    postur: () => "Gövdeni dikleştir, omuz ve kalça aynı hizada.",
    "gard-dusuk": () => "Vuruştan sonra eli yüzüne geri getir.",
  },
};

/** Motorun `konusmalar` kuyruğundaki olayı seslendirir. */
export function kocOlay(olay) {
  if (!kocAcik || !olay) return;
  const set = REPLIK[kocKisilik] || REPLIK.agresif;
  const f = set[olay.tip];
  if (!f) return;
  const onemli = olay.tip === "kombo" || olay.tip === "round-basla" || olay.tip === "mola";
  kocKonus(f(olay), onemli);
}
