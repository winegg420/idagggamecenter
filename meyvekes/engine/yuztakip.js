// ============================================================
// MEYVE KES — yüz/ağız takibi (MediaPipe Tasks Vision · FaceLandmarker)
// "Meyve Ye" modu için: ön kamera akışını açar, yüz landmark'larını takip
// eder ve ağzın 4 anahtar noktasını (üst/alt iç dudak + iki köşe) verir.
//
// Neden sadece 4 nokta: ağız açıklığı = dikey açıklık / ağız genişliği
// oranıyla ölçülür (yüz uzaklığından bağımsız). Piksel dönüşümü ve eşik
// mantığı oyun.js'te (aspect doğru olsun diye ekran uzayında hesaplanır).
//
// eltakip.js ile aynı kalıp: çıkarım ÖNCE worker'da (takip-cekirdek.js +
// takip-worker.js) denenir — ana thread bloklanmadığı için kısma gerekmez ve
// render akıcı kalır; worker kurulamazsa eski ana-thread yoluna (self-throttle)
// düşülür. GPU→CPU düşüşü, kare-güdümlü döngü, gecikme ölçümü aynı.
// ============================================================

import { WorkerCikarim } from "./takip-cekirdek.js";

const TASKS_SURUM = "0.10.14";
const CDN_KOK = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_SURUM}`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// FaceLandmarker (478 nokta) ağız indeksleri
const UST_DUDAK = 13; // üst iç dudak ortası
const ALT_DUDAK = 14; // alt iç dudak ortası
const SOL_KOSE = 61;
const SAG_KOSE = 291;

export class YuzTakip {
  constructor() {
    this.video = null;
    this.stream = null;
    this.landmarker = null;
    this.agiz = null; // { ust, alt, sol, sag } normalize (video karesine göre)
    this.hazir = false;
    this.durduruldu = false;
    this.damga = 0;
    this.yuzSayisi = 0;
    this.gecikmeSn = 0.04;
    this._dongu = null;
    this._sonTs = -1;
    this._sonInference = 30;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    this._rvfc = null;
    // Worker çıkarımı (tercih edilen yol) — bkz. takip-cekirdek.js
    this._cekirdek = null;
    this._yedekGecis = false;
  }

  /** FaceLandmarker'ı ANA THREAD'de kurar (yedek yol). */
  async _anaThreadBaslat() {
    const vision = await import(/* @vite-ignore */ `${CDN_KOK}/vision_bundle.mjs`);
    const { FaceLandmarker, FilesetResolver } = vision;
    if (!FaceLandmarker || !FilesetResolver) throw new Error("FaceLandmarker global bulunamadı");
    const fileset = await FilesetResolver.forVisionTasks(`${CDN_KOK}/wasm`);
    const olustur = (delege) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: delege },
        numFaces: 1,
        runningMode: "VIDEO",
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
    try {
      this.landmarker = await olustur("GPU");
    } catch {
      this.landmarker = await olustur("CPU");
    }
  }

  /** Worker çıkarımı sonuç üretemezse canlı canlı ana-thread yoluna geç. */
  async _yedegeDus() {
    if (this._yedekGecis) return;
    this._yedekGecis = true;
    this._cekirdek = null;
    try {
      await this._anaThreadBaslat();
    } catch (e) {
      console.error("[MeyveKes] Ana thread yüz takibi de kurulamadı:", e);
    }
  }

  /** Worker çıkarımını kurar; desteklenmiyorsa false (ana-thread yedeğine düşülür). */
  async _workerBaslat() {
    const cekirdek = new WorkerCikarim({
      model: "yuz",
      cdnKok: CDN_KOK,
      modelUrl: MODEL_URL,
      onSonuc: (veri, gecikmeSn) => {
        if (this.durduruldu) return;
        this.agiz = veri.agiz || null;
        this.yuzSayisi = veri.agiz ? 1 : 0;
        this.damga++;
        this.gecikmeSn = gecikmeSn;
      },
      onYedek: () => this._yedegeDus(),
    });
    if (!(await cekirdek.kur())) return false;
    this._cekirdek = cekirdek;
    return true;
  }

  async baslat() {
    // 1) Kamera
    try {
      this.video = document.createElement("video");
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "");
      this.video.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;";
      document.body.appendChild(this.video);
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 24 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        throw new Error("Kamera izni reddedildi. Oynamak için kamera erişimine izin ver.");
      }
      if (e && e.name === "NotFoundError") {
        throw new Error("Kamera bulunamadı. Cihazında bir ön kamera olduğundan emin ol.");
      }
      throw new Error("Kamera açılamadı: " + (e?.message || e));
    }

    // 2) Çıkarım motoru — ÖNCE worker (ana thread bloklanmaz, kısma gerekmez)
    if (await this._workerBaslat()) {
      this.hazir = true;
      this.durduruldu = false;
      this.damga = 0;
      this._sonTs = -1;
      this._sonIsleme = 0;
      this._sonVideoZaman = -1;
      this._dongulat();
      return;
    }

    // 3) Yedek: FaceLandmarker ana thread'de
    try {
      await this._anaThreadBaslat();
    } catch (e) {
      this._kamerayiKapat();
      throw new Error("Yüz takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
    }

    this.hazir = true;
    this.durduruldu = false;
    this.damga = 0;
    this._sonTs = -1;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    this._dongulat();
  }

  _isleyebilir(v, simdi) {
    if (!this.landmarker || !v || v.readyState < 2 || v.videoWidth === 0) return false;
    if (v.currentTime === this._sonVideoZaman) return false;
    // Yüz takibi el takibinden hafiftir; yine de çıkarım süresine göre kendini kısar.
    const hedefAralik = Math.min(Math.max(this._sonInference * 1.4, 14), 110);
    return simdi - this._sonIsleme >= hedefAralik;
  }

  _isle(sonuc) {
    const yuzler = (sonuc && sonuc.faceLandmarks) || [];
    const n = yuzler[0];
    if (!n || !n[UST_DUDAK] || !n[ALT_DUDAK] || !n[SOL_KOSE] || !n[SAG_KOSE]) {
      this.agiz = null;
      this.yuzSayisi = 0;
    } else {
      this.agiz = {
        ust: { x: n[UST_DUDAK].x, y: n[UST_DUDAK].y },
        alt: { x: n[ALT_DUDAK].x, y: n[ALT_DUDAK].y },
        sol: { x: n[SOL_KOSE].x, y: n[SOL_KOSE].y },
        sag: { x: n[SAG_KOSE].x, y: n[SAG_KOSE].y },
      };
      this.yuzSayisi = 1;
    }
    this.damga++;
  }

  _adim(kareYasi = 0) {
    if (this.durduruldu) return;
    const v = this.video;
    const simdi = performance.now();
    if (!this._isleyebilir(v, simdi)) return;
    this._sonIsleme = simdi;
    this._sonVideoZaman = v.currentTime;
    let ts = Math.round(simdi);
    if (ts <= this._sonTs) ts = this._sonTs + 1;
    this._sonTs = ts;
    const t0 = performance.now();
    try {
      const sonuc = this.landmarker.detectForVideo(v, ts);
      this._isle(sonuc);
    } catch {
      /* tek kare hatası — döngü devam */
    }
    this._sonInference = performance.now() - t0;
    this.gecikmeSn = Math.min(0.18, (kareYasi + this._sonInference + 8) / 1000);
  }

  _dongulat() {
    if (this.durduruldu) return;
    const v = this.video;
    // Yol her karede yeniden bakılır: çalışma anında yedeğe geçiş olabilir.
    const adimAt = (yas) => {
      if (this._cekirdek?.aktif) this._cekirdek.kareGonder(this.video, yas);
      else this._adim(yas);
    };
    if (v && typeof v.requestVideoFrameCallback === "function") {
      this._rvfc = v.requestVideoFrameCallback((simdi, meta) => {
        if (this.durduruldu) return;
        const yakalama = meta && meta.captureTime ? meta.captureTime : simdi;
        adimAt(Math.max(0, performance.now() - yakalama));
        this._dongulat();
      });
      return;
    }
    this._dongu = setTimeout(() => {
      adimAt(0);
      this._dongulat();
    }, 8);
  }

  _kamerayiKapat() {
    try {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* yut */
    }
    this.stream = null;
    try {
      if (this.video && this.video.parentNode) this.video.parentNode.removeChild(this.video);
    } catch {
      /* yut */
    }
  }

  durdur() {
    this.durduruldu = true;
    this.hazir = false;
    if (this._dongu) clearTimeout(this._dongu);
    this._dongu = null;
    try {
      if (this._rvfc !== null && this.video?.cancelVideoFrameCallback) {
        this.video.cancelVideoFrameCallback(this._rvfc);
      }
    } catch {
      /* yut */
    }
    this._rvfc = null;
    this._kamerayiKapat();
    this._cekirdek?.kapat();
    this._cekirdek = null;
    try {
      this.landmarker?.close?.();
    } catch {
      /* yut */
    }
    this.landmarker = null;
    this.agiz = null;
  }
}
