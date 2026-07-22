// ============================================================
// MEYVE KES — el takibi (MediaPipe Tasks Vision · HandLandmarker)
// Ön kamera akışını açar, modern HandLandmarker modelini CDN'den (ESM)
// yükler ve el işaret noktalarını GPU'da takip eder.
//
// Neden Tasks Vision (eski @mediapipe/hands yerine):
//  - GPU delegesi → çıkarım ana thread'i bloklamaz (kasma çözülür).
//  - detectForVideo SENKRON döner → busy-flag/callback yarışı yok.
//  - Video KARESİNİ DOĞRUDAN işler → landmark'lar gerçek kamera en-boy
//    oranına göre normalize olur; sabit 320x240 offscreen kareye küçültme
//    kaynaklı aspect bozulması (koordinat kayması) ORTADAN KALKAR.
//
// Aynalama (selfie) çizim/kesim tarafında yapılır (koordinatHesap.esle).
// Bu sınıf ham normalize landmark verir; taraf (sol/sag) ekran konumuna göre.
// ============================================================

const TASKS_SURUM = "0.10.14";
const CDN_KOK = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_SURUM}`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class ElTakip {
  constructor() {
    this.video = null;
    this.stream = null;
    this.landmarker = null;
    this.eller = []; // [{ noktalar: [{x,y,z}...], taraf: 'sol'|'sag' }]
    this.hazir = false;
    this.durduruldu = false;
    this.damga = 0; // yeni algılama karesi işareti (kesim işleme için)
    this.elSayisi = 0; // teşhis: o an algılanan el sayısı
    this._dongu = null;
    this._sonTs = -1;
    this._sonInference = 30;
    this.videoGenislik = 640;
    this.videoYukseklik = 480;
  }

  // Kamera + HandLandmarker'ı başlatır. Hata durumunda anlamlı mesajla reddeder.
  async baslat(maxEl) {
    // 1) Kamera izni + akış
    try {
      this.video = document.createElement("video");
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "");
      // Bazı tarayıcılar DOM'a bağlı olmayan video'dan kare çözmez → gizli ekle.
      this.video.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;";
      document.body.appendChild(this.video);
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.videoGenislik = this.video.videoWidth || 640;
      this.videoYukseklik = this.video.videoHeight || 480;
    } catch (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        throw new Error("Kamera izni reddedildi. Oynamak için kamera erişimine izin ver.");
      }
      if (e && e.name === "NotFoundError") {
        throw new Error("Kamera bulunamadı. Cihazında bir ön kamera olduğundan emin ol.");
      }
      throw new Error("Kamera açılamadı: " + (e?.message || e));
    }

    // 2) HandLandmarker (Tasks Vision, CDN üzerinden ESM)
    try {
      // Vite'ın build sırasında bu CDN URL'sini çözmeye çalışmaması için @vite-ignore.
      const vision = await import(/* @vite-ignore */ `${CDN_KOK}/vision_bundle.mjs`);
      const { HandLandmarker, FilesetResolver } = vision;
      if (!HandLandmarker || !FilesetResolver) {
        throw new Error("HandLandmarker global bulunamadı");
      }
      const fileset = await FilesetResolver.forVisionTasks(`${CDN_KOK}/wasm`);

      // Önce GPU delegesi; başarısız olursa CPU'ya düş (yaşlı/uyumsuz GPU'lar).
      const olustur = (delege) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: delege },
          numHands: maxEl,
          runningMode: "VIDEO",
          // Düşük eşik = el hızla girip çıksa bile çabuk yakalanır.
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
      try {
        this.landmarker = await olustur("GPU");
      } catch {
        this.landmarker = await olustur("CPU");
      }
    } catch (e) {
      this._kamerayiKapat();
      throw new Error("El takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
    }

    this.hazir = true;
    this.durduruldu = false;
    this.damga = 0;
    this._sonTs = -1;
    // setTimeout tabanlı döngü: render rAF'ından bağımsız çalışır, çıkarım
    // süresine göre kendini yavaşlatır → ana thread render'a nefes payı bırakır.
    this._gonder();
  }

  _isle(sonuc) {
    const eller = [];
    const cok = (sonuc && sonuc.landmarks) || [];
    for (let i = 0; i < cok.length; i++) {
      const noktalar = cok[i]; // [{x,y,z}...] normalize (video karesine göre)
      const palm = noktalar[9] || noktalar[0];
      // Aynalı görünümde ekranın solu = kullanıcının sağ eli.
      const ekranX = palm ? 1 - palm.x : 0.5;
      eller.push({ noktalar, taraf: ekranX < 0.5 ? "sol" : "sag" });
    }
    this.eller = eller;
    this.elSayisi = eller.length;
    this.damga++;
  }

  _gonder() {
    if (this.durduruldu) return;
    const v = this.video;
    if (this.landmarker && v && v.readyState >= 2 && v.videoWidth > 0) {
      // detectForVideo zaman damgası KESİN ARTAN olmalı; aynı kareyi iki kez
      // işlememek için video zamanı ilerlediğinde çalıştır.
      let ts = Math.round(performance.now());
      if (ts <= this._sonTs) ts = this._sonTs + 1;
      this._sonTs = ts;
      const t0 = performance.now();
      try {
        const sonuc = this.landmarker.detectForVideo(v, ts);
        this._isle(sonuc);
      } catch {
        /* tek kare hatası — yut, döngü devam */
      }
      this._sonInference = performance.now() - t0;
    }
    if (this.durduruldu) return;
    // Gecikme = çıkarım süresi kadar (16–120 ms) → render'a nefes payı bırakır.
    const gecikme = Math.min(Math.max(this._sonInference, 16), 120);
    this._dongu = setTimeout(() => this._gonder(), gecikme);
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
    this._kamerayiKapat();
    try {
      this.landmarker?.close?.();
    } catch {
      /* yut */
    }
    this.landmarker = null;
    this.eller = [];
  }
}
