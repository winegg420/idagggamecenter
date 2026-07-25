// ============================================================
// MEYVE KES — ÇIKARIM WORKER'ı (el + yüz)
//
// Neden worker: `detectForVideo` SENKRON çalışır; ana thread'de çağrıldığında
// çıkarım süresi boyunca (10-60 ms) render donar. Bu yüzden eski sürümde
// algılama, çıkarım süresinin ~1.5 katına kısılmak zorundaydı (en kötü halde
// ~7 algılama/sn). El kadrajdan çıkıp geri girdiğinde 130 ms'ye kadar kör
// pencere oluşuyordu — "oyun kolumu tanımıyor" hissinin kök nedeni buydu.
//
// Worker'da çıkarım ayrı thread'de koştuğu için KISMA GEREKMEZ: kameranın her
// karesi işlenir (30-60 algılama/sn) ve ana thread 60 fps akıcı kalır.
// Ana thread yalnız `createImageBitmap` ile kareyi kopyalayıp transfer eder.
//
// Aynı worker iki modeli de kurar: `model: 'el'` → HandLandmarker (Meyve Kes),
// `model: 'yuz'` → FaceLandmarker (Meyve Ye). Sonuç paketi modele göre değişir.
// ============================================================

// FaceLandmarker (478 nokta) ağız indeksleri — yuztakip.js ile birebir aynı
const UST_DUDAK = 13;
const ALT_DUDAK = 14;
const SOL_KOSE = 61;
const SAG_KOSE = 291;

let landmarker = null;
let model = "el";
let hazir = false;
let sonTs = 0;

async function kur({ cdnKok, modelUrl, maxEl, model: istenen }) {
  model = istenen === "yuz" ? "yuz" : "el";
  // CDN'den ESM (Vite bunu bundle etmeye çalışmasın)
  const vision = await import(/* @vite-ignore */ `${cdnKok}/vision_bundle.mjs`);
  const { HandLandmarker, FaceLandmarker, FilesetResolver } = vision;
  const Sinif = model === "yuz" ? FaceLandmarker : HandLandmarker;
  if (!Sinif || !FilesetResolver) throw new Error("Tasks Vision sınıfı bulunamadı");
  const fileset = await FilesetResolver.forVisionTasks(`${cdnKok}/wasm`);
  const olustur = (delege) =>
    model === "yuz"
      ? Sinif.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: delege },
          numFaces: 1,
          runningMode: "VIDEO",
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.35,
          minFacePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        })
      : Sinif.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: delege },
          numHands: maxEl,
          runningMode: "VIDEO",
          // Düşük eşik = el kadrajdan çıkıp geri girince ANINDA yeniden yakalanır.
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
  // GPU (OffscreenCanvas/WebGL) → başarısızsa CPU. Worker'da CPU bile ana
  // thread'i bloklamadığı için CPU'ya düşmek artık kasma demek değil.
  try {
    landmarker = await olustur("GPU");
  } catch {
    landmarker = await olustur("CPU");
  }
}

// MediaPipe sonucunu sade, klonlanabilir pakete çevirir.
function paketle(sonuc) {
  if (model === "yuz") {
    const n = ((sonuc && sonuc.faceLandmarks) || [])[0];
    if (!n || !n[UST_DUDAK] || !n[ALT_DUDAK] || !n[SOL_KOSE] || !n[SAG_KOSE]) return { agiz: null };
    return {
      agiz: {
        ust: { x: n[UST_DUDAK].x, y: n[UST_DUDAK].y },
        alt: { x: n[ALT_DUDAK].x, y: n[ALT_DUDAK].y },
        sol: { x: n[SOL_KOSE].x, y: n[SOL_KOSE].y },
        sag: { x: n[SAG_KOSE].x, y: n[SAG_KOSE].y },
      },
    };
  }
  const cok = (sonuc && sonuc.landmarks) || [];
  const eller = [];
  for (let i = 0; i < cok.length; i++) {
    const n = cok[i];
    const noktalar = new Array(n.length);
    for (let j = 0; j < n.length; j++) noktalar[j] = { x: n[j].x, y: n[j].y, z: n[j].z || 0 };
    eller.push(noktalar);
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
