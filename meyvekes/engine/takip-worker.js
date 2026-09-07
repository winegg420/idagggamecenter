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
//
// DİKKAT: Bu dosya KLASİK worker olarak yüklenir (takip-cekirdek.js, `type`
// seçeneği YOK). Buraya static `import`/`export` EKLEME — yalnız dinamik
// `import()` kullanılabilir. Nedeni: kutuphaneYukle() açıklaması.
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
let delege = "GPU"; // teşhis: hangi delege kuruldu ("hazir" mesajıyla bildirilir)
let olusturucu = null; // (delege) => landmarker sözü — delege yarışı için saklanır

// ---- Delege yarışı ----
// Telefonlarda WebGL (GPU) delegesi bazen WASM-SIMD (CPU) delegesinden YAVAŞTIR
// (özellikle iOS Safari / eski Android). Kurulumda GPU seçilir; ısınma sonrası
// ortalama çıkarım YARIS_ESIK_MS'i aşarsa CPU delegesi de kurulup aynı sayıda
// kareyle ölçülür, hızlı olan tutulur, öteki kapatılır. Ana thread'e "delege"
// mesajıyla bildirilir (rozet dürüst kalır).
const YARIS_ISINMA = 12; // ölçüme katılmayan ilk kare sayısı
const YARIS_ORNEK = 24; // her delege için ölçülen kare sayısı
let YARIS_ESIK_MS = 34; // bunun altındaysa (30 Hz sığar) yarış açılmaz ("kur" ile ezilebilir: test)
let olcum = { sayi: 0, toplam: 0 };
let yarisDurum = "bekliyor"; // bekliyor | cpuKuruluyor | cpuOlculuyor | bitti
let gpuOrt = 0;
let adayLandmarker = null;

function olcumSifirla() {
  olcum = { sayi: 0, toplam: 0 };
}

async function cpuAdayKur() {
  yarisDurum = "cpuKuruluyor";
  try {
    adayLandmarker = await olusturucu("CPU");
    if (!hazir) {
      // bu arada kapatıldı
      try {
        adayLandmarker?.close?.();
      } catch {
        /* yut */
      }
      adayLandmarker = null;
      yarisDurum = "bitti";
      return;
    }
    olcumSifirla();
    yarisDurum = "cpuOlculuyor";
  } catch {
    adayLandmarker = null;
    yarisDurum = "bitti";
  }
}

// Her sonuçtan sonra çağrılır: ölçüm biriktirir ve gerekirse delege değiştirir.
function yarisAdim(sure) {
  if (yarisDurum === "bitti" || yarisDurum === "cpuKuruluyor") return;
  olcum.sayi++;
  if (olcum.sayi <= YARIS_ISINMA) return;
  olcum.toplam += sure;
  const n = olcum.sayi - YARIS_ISINMA;
  if (n < YARIS_ORNEK) return;
  const ort = olcum.toplam / n;
  if (yarisDurum === "bekliyor") {
    if (delege !== "GPU" || ort <= YARIS_ESIK_MS) {
      yarisDurum = "bitti";
      return;
    }
    gpuOrt = ort;
    cpuAdayKur(); // async — bu sırada GPU çalışmaya devam eder
    return;
  }
  if (yarisDurum === "cpuOlculuyor") {
    yarisDurum = "bitti";
    const kazanan = ort < gpuOrt * 0.85 ? "CPU" : "GPU"; // belirgin fark yoksa GPU kalsın
    const eski = kazanan === "CPU" ? landmarker : adayLandmarker;
    if (kazanan === "CPU") landmarker = adayLandmarker;
    adayLandmarker = null;
    try {
      eski?.close?.();
    } catch {
      /* yut */
    }
    const degisti = kazanan !== delege;
    delege = kazanan;
    // Yarış sonucu her durumda bildirilir (teşhis: konsolda iki delegenin ölçümü görünür).
    self.postMessage({
      tip: "delege",
      delege,
      degisti,
      neden: `yarış: GPU ${gpuOrt.toFixed(0)} ms, CPU ${ort.toFixed(0)} ms`,
    });
  }
}

// Tasks Vision kütüphanesini yükler.
// KRİTİK: bu worker KLASİK tiptedir (module DEĞİL). MediaPipe'ın wasm yükleyicisi
// worker içinde `importScripts` kullanır; module worker'da bu çağrı yasaktır ve
// kurulum "Module scripts don't support importScripts()" ile ölür (GPU ve CPU
// denemesi ayrı ayrı — konsolda iki hata). Klasik worker'da dinamik `import()`
// güncel Chrome/Safari/Firefox'ta çalışır; desteklemeyen çok eski tarayıcıda
// CJS paketi `importScripts` ile alınır (self.exports üzerinden).
async function kutuphaneYukle(cdnKok) {
  try {
    // CDN'den ESM (Vite bunu bundle etmeye çalışmasın)
    return await import(/* @vite-ignore */ `${cdnKok}/vision_bundle.mjs`);
  } catch (e) {
    if (typeof importScripts !== "function") throw e;
    try {
      self.exports = {};
      self.module = { exports: self.exports };
      importScripts(`${cdnKok}/vision_bundle.cjs`);
      const m = self.module.exports || self.exports;
      if (!m || (!m.HandLandmarker && !m.FaceLandmarker)) throw new Error("CJS paketi boş döndü");
      return m;
    } catch (e2) {
      throw new Error(`kütüphane yüklenemedi (import: ${e?.message || e}; importScripts: ${e2?.message || e2})`);
    }
  }
}

async function kur({ cdnKok, modelUrl, maxEl, model: istenen, yarisEsikMs }) {
  model = istenen === "yuz" ? "yuz" : "el";
  if (typeof yarisEsikMs === "number") YARIS_ESIK_MS = yarisEsikMs;
  const vision = await kutuphaneYukle(cdnKok);
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
  olusturucu = olustur;
  try {
    landmarker = await olustur("GPU");
    delege = "GPU";
  } catch {
    landmarker = await olustur("CPU");
    delege = "CPU";
  }
  olcumSifirla();
  yarisDurum = "bekliyor";
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
      self.postMessage({ tip: "hazir", delege });
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
    // Yarışta CPU adayı ölçülüyorsa kareyi ADAY işler (akış kesilmez, sonuç ondan gelir).
    const motor = yarisDurum === "cpuOlculuyor" && adayLandmarker ? adayLandmarker : landmarker;
    const t0 = performance.now();
    let veri = null;
    try {
      veri = paketle(motor.detectForVideo(kare, ts));
    } catch {
      /* tek kare hatası — yut, akış devam */
    }
    try {
      kare.close?.();
    } catch {
      /* yut */
    }
    const sure = performance.now() - t0;
    self.postMessage({ tip: "sonuc", veri, sure, kareYasi: yas });
    if (veri) yarisAdim(sure);
    return;
  }

  if (m.tip === "kapat") {
    hazir = false;
    yarisDurum = "bitti";
    try {
      landmarker?.close?.();
    } catch {
      /* yut */
    }
    landmarker = null;
    try {
      adayLandmarker?.close?.();
    } catch {
      /* yut */
    }
    adayLandmarker = null;
    self.close();
  }
};
