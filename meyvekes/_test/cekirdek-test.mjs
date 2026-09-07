// ============================================================
// MEYVE KES — takip-cekirdek.js zamanlama testi (Node, başsız, sanal saat)
//
// Soru: 30 fps kamera + tek kare uçuşta + rVFC tetiklemesiyle çıkarım 34-66 ms
// sürerse algılama 15 Hz'e KİLİTLENİR (telefonda ölçülen 13-14 Hz). "Worker
// boşalınca en taze kareyi hemen gönder" mantığı bu basamaklanmayı kırmalı:
// Hz ≈ min(kamera fps, 1000 / çıkarım).
//
// Çalıştır: node meyvekes/_test/cekirdek-test.mjs
// ============================================================

// ---- sanal saat + olay kuyruğu ----
let simdi = 0;
const olaylar = []; // { t, fn }
function planla(gecikme, fn) {
  olaylar.push({ t: simdi + gecikme, fn });
}
function calistir(sureMs) {
  const son = sureMs;
  while (olaylar.length) {
    olaylar.sort((a, b) => a.t - b.t);
    const o = olaylar.shift();
    if (o.t > son) {
      olaylar.unshift(o); // zamanı gelmedi — kuyrukta kalsın
      break;
    }
    simdi = o.t;
    o.fn();
  }
  simdi = son;
}

globalThis.performance = { now: () => simdi };
globalThis.setTimeout = (fn, ms) => {
  planla(ms || 0, fn);
  return 1;
};
globalThis.clearTimeout = () => {};
globalThis.console.info = () => {};

// ---- sahte Worker: "kur" → hazir; "kare" → CIKARIM_MS sonra sonuc ----
let CIKARIM_MS = 45;
let BITMAP_MS = 1; // createImageBitmap süresi (telefonda 5-15 ms)
globalThis.Worker = class {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) {
    if (m.tip === "kur") {
      planla(1, () => this.onmessage?.({ data: { tip: "hazir", delege: "GPU" } }));
    } else if (m.tip === "kare") {
      m.kare.close();
      planla(CIKARIM_MS, () =>
        this.onmessage?.({ data: { tip: "sonuc", veri: { eller: [] }, sure: CIKARIM_MS, kareYasi: m.kareYasi } }),
      );
    }
  }
  terminate() {}
};
// createImageBitmap: BITMAP_MS sonra çözülen söz (ana thread kopya maliyeti)
let acikBitmap = 0; // kapatılmamış bitmap sayısı (sızıntı denetimi)
globalThis.createImageBitmap = () =>
  new Promise((cozul) =>
    planla(BITMAP_MS, () => {
      acikBitmap++;
      cozul({
        close() {
          acikBitmap--;
        },
      });
    }),
  );
// worker'a transfer edilen bitmap worker tarafında kapatılır (sahte: hemen)


// Söz (Promise) zincirleri (createImageBitmap → postMessage) sanal saat adımları
// arasında tamamen boşalsın: setImmediate bir makro görevdir, tüm mikro görevleri süpürür.
async function tik() {
  await new Promise((r) => setImmediate(r));
}

const { WorkerCikarim } = await import("../engine/takip-cekirdek.js");

// ---- sahte kamera: her 1000/fps ms'de yeni kare (currentTime artar) + rVFC ----
async function senaryo({ fps, cikarimMs, ictenAcik, sureSn = 10, bitmapMs = 1 }) {
  CIKARIM_MS = cikarimMs;
  BITMAP_MS = bitmapMs;
  acikBitmap = 0;
  simdi = 0;
  olaylar.length = 0;
  const video = { readyState: 4, videoWidth: 640, videoHeight: 480, currentTime: 0 };
  let sonuc = 0;
  const c = new WorkerCikarim({
    model: "el",
    cdnKok: "x",
    modelUrl: "y",
    onSonuc: () => {
      sonuc++;
    },
    onYedek: () => {},
  });
  if (!ictenAcik) {
    // karşılaştırma: ESKİ davranış — yalnız rVFC tetikler, meşgulken kare düşer
    // (ne "boşalınca gönder" ne ön hazırlık).
    const orj = c.kareGonder.bind(c);
    c.kareGonder = (v, yas, icten) => (icten || c.mesgul ? undefined : orj(v, yas, icten));
  }
  const kurSozu = c.kur();
  calistir(5);
  await tik();
  const ok = await kurSozu;
  if (!ok) throw new Error("sahte worker kurulamadı");

  const aralik = 1000 / fps;
  let kareNo = 0;
  const kameraKaresi = () => {
    kareNo++;
    video.currentTime = kareNo * aralik / 1000;
    c.kareGonder(video, 0); // rVFC
    planla(aralik, kameraKaresi);
  };
  planla(aralik, kameraKaresi);

  // 1 sn ısınma, sonra ölç
  const toplam = sureSn * 1000;
  let t = simdi;
  while (t < toplam) {
    t += 1;
    calistir(t);
    await tik();
  }
  c.kapat();
  await tik();
  if (acikBitmap !== 0) throw new Error("bitmap sızıntısı: " + acikBitmap);
  return sonuc;
}

let gecti = 0;
let kaldi = 0;
function dogrula(ad, kosul, detay) {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}${detay ? " — " + detay : ""}`);
  } else {
    kaldi++;
    console.log(`  ✗ ${ad}${detay ? " — " + detay : ""}`);
  }
}

async function hzOlc(p) {
  const sureSn = 10;
  const sonuc = await senaryo({ ...p, sureSn });
  return sonuc / sureSn;
}

console.log("Test 1: 30 fps kamera, çıkarım 45 ms (telefon)");
{
  const eski = await hzOlc({ fps: 30, cikarimMs: 45, ictenAcik: false });
  const yeni = await hzOlc({ fps: 30, cikarimMs: 45, ictenAcik: true });
  dogrula("eski davranış 15 Hz'e kilitleniyor", eski <= 16 && eski >= 13, `${eski.toFixed(1)} Hz`);
  dogrula("yeni davranış ≥ 20 Hz", yeni >= 20, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 2: 30 fps kamera, çıkarım 36 ms");
{
  const eski = await hzOlc({ fps: 30, cikarimMs: 36, ictenAcik: false });
  const yeni = await hzOlc({ fps: 30, cikarimMs: 36, ictenAcik: true });
  dogrula("eski ≤ 16 Hz", eski <= 16, `${eski.toFixed(1)} Hz`);
  dogrula("yeni ≥ 25 Hz", yeni >= 25, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 3: 30 fps kamera, çıkarım 15 ms (masaüstü) — kamera sınırı");
{
  const yeni = await hzOlc({ fps: 30, cikarimMs: 15, ictenAcik: true });
  dogrula("kamera fps'ini aşmaz, aynı kare iki kez işlenmez", yeni >= 28 && yeni <= 31, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 4: 60 fps kamera, çıkarım 15 ms");
{
  const yeni = await hzOlc({ fps: 60, cikarimMs: 15, ictenAcik: true });
  dogrula("≥ 50 Hz", yeni >= 50, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 5: 30 fps kamera, çıkarım 70 ms (çok yavaş cihaz)");
{
  const eski = await hzOlc({ fps: 30, cikarimMs: 70, ictenAcik: false });
  const yeni = await hzOlc({ fps: 30, cikarimMs: 70, ictenAcik: true });
  dogrula("eski ≈ 10 Hz", eski <= 11, `${eski.toFixed(1)} Hz`);
  dogrula("yeni ≥ 13 Hz (1000/72)", yeni >= 13, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 6: 30 fps kamera, çıkarım 45 ms + createImageBitmap 12 ms (telefon)");
{
  const eski = await hzOlc({ fps: 30, cikarimMs: 45, ictenAcik: false, bitmapMs: 12 });
  const yeni = await hzOlc({ fps: 30, cikarimMs: 45, ictenAcik: true, bitmapMs: 12 });
  dogrula("eski ≤ 16 Hz", eski <= 16, `${eski.toFixed(1)} Hz`);
  dogrula("ön hazırlık: çevrim ≈ yalnız çıkarım (≥ 21 Hz)", yeni >= 21, `${yeni.toFixed(1)} Hz`);
}

console.log("Test 7: 30 fps kamera, çıkarım 28 ms + bitmap 12 ms");
{
  const yeni = await hzOlc({ fps: 30, cikarimMs: 28, ictenAcik: true, bitmapMs: 12 });
  dogrula("kamera sınırına yakın (≥ 28 Hz)", yeni >= 28, `${yeni.toFixed(1)} Hz`);
}

console.log(`\nSonuç: ${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
