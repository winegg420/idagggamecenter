// ============================================================
// GÖLGE BOKS — ÇIKARIM WORKER'ı (yalnız PoseLandmarker)
//
// Neden worker: `detectForVideo` SENKRON çalışır; ana thread'de çağrılırsa
// çıkarım süresi boyunca (10-60 ms) render donar. Worker'da koşunca ana thread
// yalnız kare kopyalar ve 60 fps çizimde kalır.
//
// TEK MODEL KARARI (performans): önceki sürümde HandLandmarker + PoseLandmarker
// aynı anda koşuyordu; iki model = iki kat çıkarım, iki kat bitmap kopyası ve
// mobilde oynanamayacak kadar kasma. HandLandmarker kaldırıldı: boks için
// gereken her şey (bilek/dirsek/omuz/kafa/kalça + EL ÖLÇEĞİ) poz modelinin
// kendi noktalarından okunur — 17/18 (serçe kökü) ve 19/20 (işaret kökü)
// bileğe olan mesafeyle derinlik proxy'sini verir. Bkz. yumrukTanima.js.
//
// Poz paketi SADECE gerekli indeksleri taşır (mesaj boyu ve GC baskısı düşük).
// Her noktanın `g` (görünürlük) değeri de gider: ADAPTİF KAPSAM kuralı buna
// dayanır — kamera görmüyorsa analiz o bölgeyi hiç varsaymaz.
// ============================================================

// Poz landmark indeksleri (MediaPipe Pose 33 nokta) — posetakip.js ile birebir.
const POZ_INDEKS = [
  0, // burun
  7, 8, // kulaklar (kafa genişliği / dönüş)
  11, 12, // omuzlar
  13, 14, // dirsekler
  15, 16, // bilekler
  17, 18, // serçe kökleri (el ölçeği / derinlik proxy'si)
  19, 20, // işaret parmağı kökleri (el ölçeği + yumruk yönü)
  23, 24, // kalçalar (gövde ekseni / postür)
  25, 26, // dizler (tam vücut kadrajdaysa duruş analizi)
  27, 28, // ayak bilekleri
];

let landmarker = null;
let hazir = false;
let sonTs = 0;

async function kur({ cdnKok, modelUrl }) {
  // CDN'den ESM (Vite bunu bundle etmeye çalışmasın)
  const vision = await import(/* @vite-ignore */ `${cdnKok}/vision_bundle.mjs`);
  const { PoseLandmarker, FilesetResolver } = vision;
  if (!PoseLandmarker || !FilesetResolver) throw new Error("PoseLandmarker bulunamadı");
  const fileset = await FilesetResolver.forVisionTasks(`${cdnKok}/wasm`);
  const olustur = (delege) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate: delege },
      numPoses: 1,
      runningMode: "VIDEO",
      outputSegmentationMasks: false,
      // Boksta gövde sürekli döner/eğilir; düşük eşik kaybı azaltır.
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });
  // GPU (OffscreenCanvas/WebGL) → başarısızsa CPU. Worker'da CPU bile ana
  // thread'i bloklamadığı için CPU'ya düşmek kasma demek değil.
  try {
    landmarker = await olustur("GPU");
  } catch {
    landmarker = await olustur("CPU");
  }
}

// MediaPipe sonucunu sade, klonlanabilir pakete çevirir.
function paketle(sonuc) {
  const n = ((sonuc && sonuc.landmarks) || [])[0];
  if (!n) return { poz: null };
  const d = ((sonuc && sonuc.worldLandmarks) || [])[0] || null;
  const noktalar = {};
  for (let i = 0; i < POZ_INDEKS.length; i++) {
    const idx = POZ_INDEKS[i];
    const p = n[idx];
    if (!p) continue;
    noktalar[idx] = {
      x: p.x,
      y: p.y,
      z: p.z || 0,
      // visibility bazı sürümlerde undefined döner → görünür say (1).
      g: typeof p.visibility === "number" ? p.visibility : 1,
    };
  }
  // Dünya koordinatları (metre benzeri, kameradan bağımsız) yalnız gövde
  // açısı/postür için gerekir; sadece omuz-kalça dörtlüsü taşınır.
  let dunya = null;
  if (d) {
    dunya = {};
    for (const idx of [11, 12, 23, 24]) {
      const p = d[idx];
      if (p) dunya[idx] = { x: p.x, y: p.y, z: p.z };
    }
  }
  return { poz: { noktalar, dunya } };
}

self.onmessage = async (olay) => {
  const m = olay.data;
  if (!m) return;

  if (m.tip === "kur") {
    try {
      await kur(m);
      hazir = true;
      self.postMessage({ tip: "hazir" });
    } catch (e) {
      self.postMessage({ tip: "hata", mesaj: String(e?.message || e) });
    }
    return;
  }

  if (m.tip === "kare") {
    const kare = m.kare;
    const yas = m.kareYasi || 0;
    if (!hazir || !kare) {
      try {
        kare?.close?.();
      } catch {
        /* yut */
      }
      // Ana thread "meşgul" bayrağında takılmasın: her kareye yanıt döner.
      self.postMessage({ tip: "sonuc", veri: null, sure: 0, kareYasi: yas });
      return;
    }
    // detectForVideo zaman damgası KESİN ARTAN olmalı.
    let ts = Math.round(m.ts || 0);
    if (ts <= sonTs) ts = sonTs + 1;
    sonTs = ts;
    const t0 = performance.now();
    let veri = null;
    try {
      veri = paketle(landmarker.detectForVideo(kare, ts));
    } catch {
      /* tek kare hatası — yut, akış devam */
    }
    try {
      kare.close?.();
    } catch {
      /* yut */
    }
    self.postMessage({ tip: "sonuc", veri, sure: performance.now() - t0, kareYasi: yas });
    return;
  }

  if (m.tip === "kapat") {
    hazir = false;
    try {
      landmarker?.close?.();
    } catch {
      /* yut */
    }
    landmarker = null;
    self.close();
  }
};
