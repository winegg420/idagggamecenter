// ============================================================
// GÖLGE BOKS — ÇIKARIM WORKER'ı (el + poz)
//
// Neden worker: `detectForVideo` SENKRON çalışır; ana thread'de çağrılırsa
// çıkarım süresi boyunca (10-60 ms) render donar. Gölge Boks'ta AYNI ANDA iki
// model koşar (HandLandmarker + PoseLandmarker); ikisi de ana thread'de
// olsaydı oyun oynanamaz hâle gelirdi. Bu yüzden her model KENDİ worker'ında
// çalışır (iki ayrı thread, paralel) ve ana thread yalnız kare kopyalar.
//
// `model: 'el'`  → HandLandmarker (21 nokta × N el) — eldiven overlay + hassas hız
// `model: 'poz'` → PoseLandmarker (33 nokta) — omuz/dirsek/bilek/kafa/kalça
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
  19, 20, // işaret parmağı kökleri (yumruk yönü)
  23, 24, // kalçalar (gövde ekseni / postür)
  25, 26, // dizler (tam vücut kadrajdaysa duruş analizi)
  27, 28, // ayak bilekleri
];

let landmarker = null;
let model = "el";
let hazir = false;
let sonTs = 0;

async function kur({ cdnKok, modelUrl, maxEl, model: istenen }) {
  model = istenen === "poz" ? "poz" : "el";
  // CDN'den ESM (Vite bunu bundle etmeye çalışmasın)
  const vision = await import(/* @vite-ignore */ `${cdnKok}/vision_bundle.mjs`);
  const { HandLandmarker, PoseLandmarker, FilesetResolver } = vision;
  const Sinif = model === "poz" ? PoseLandmarker : HandLandmarker;
  if (!Sinif || !FilesetResolver) throw new Error("Tasks Vision sınıfı bulunamadı");
  const fileset = await FilesetResolver.forVisionTasks(`${cdnKok}/wasm`);
  const olustur = (delege) =>
    model === "poz"
      ? Sinif.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: delege },
          numPoses: 1,
          runningMode: "VIDEO",
          outputSegmentationMasks: false,
          // Boksta gövde sürekli döner/eğilir; düşük eşik kaybı azaltır.
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        })
      : Sinif.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: delege },
          numHands: maxEl,
          runningMode: "VIDEO",
          // Düşük eşik = el kadrajdan çıkıp geri girince ANINDA yeniden yakalanır
          // (yumruk çekilince el sık sık kadraj kenarına gider).
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
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
  if (model === "poz") {
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
  const cok = (sonuc && sonuc.landmarks) || [];
  const el = (sonuc && sonuc.handedness) || [];
  const eller = [];
  for (let i = 0; i < cok.length; i++) {
    const n = cok[i];
    const noktalar = new Array(n.length);
    for (let j = 0; j < n.length; j++) noktalar[j] = { x: n[j].x, y: n[j].y, z: n[j].z || 0 };
    // handedness: modelin ayna görüntüsüne göre etiketi ("Left"/"Right").
    // Anatomik taraf kararını poz bilekleriyle eşleştirme verir (bkz. oyun.js);
    // bu etiket yalnız yedek ipucudur.
    const h = el[i] && el[i][0] ? el[i][0].categoryName : null;
    eller.push({ noktalar, etiket: h });
  }
  return { eller };
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
