// ============================================================
// MEYVE KES — el takibi (MediaPipe Tasks Vision · HandLandmarker)
// Ön kamera akışını açar, modern HandLandmarker modelini CDN'den (ESM)
// yükler ve el işaret noktalarını GPU'da takip eder.
//
// Neden Tasks Vision (eski @mediapipe/hands yerine):
//  - detectForVideo SENKRON döner → busy-flag/callback yarışı yok.
//  - Kamera karesini DOĞRUDAN işler → landmark'lar gerçek kamera en-boy
//    oranına göre normalize olur; sabit 320x240 offscreen kareye küçültme
//    kaynaklı aspect bozulması (koordinat kayması) ORTADAN KALKAR.
//
// ÇALIŞMA YOLU 1 (tercih edilen): çıkarım WORKER'da (takip-worker.js).
//   Ana thread yalnız kareyi kopyalar (createImageBitmap) ve transfer eder;
//   çıkarım ayrı thread'de koştuğu için KISMA GEREKMEZ → kamera her karesi
//   işlenir (30-60 algılama/sn) ve render 60 fps akıcı kalır. El kadrajdan
//   çıkıp geri girdiğinde 1-2 kare içinde yeniden yakalanır.
// ÇALIŞMA YOLU 2 (yedek): worker/OffscreenCanvas yoksa eski ana-thread yolu.
//   Orada çıkarım render'ı bloklar, bu yüzden kendini kısar (bkz. _isleyebilir).
//
// Aynalama (selfie) çizim/kesim tarafında yapılır (koordinatHesap.esle).
// Bu sınıf ham normalize landmark verir; taraf (sol/sag) ekran konumuna göre.
// ============================================================

import { WorkerCikarim } from "./takip-cekirdek.js";

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
    // Teşhis: çıkarım hangi yolda koşuyor? 'worker' (hızlı, ana thread serbest)
    // ya da 'ana' (yedek; render'ı bloklar, kasma bu yolda beklenir).
    this.yol = "kuruluyor";
    // Algılama gecikmesi (sn): kamera karesi ile sonucun ekrana yansıması arasındaki
    // gerçek gecikme. Oyun bunu el konumunu ileri sarmak için kullanır (senkron hissi).
    this.gecikmeSn = 0.04;
    this._dongu = null;
    this._sonTs = -1;
    this._sonInference = 30;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    this._rvfc = null;
    this.videoGenislik = 640;
    this.videoYukseklik = 480;
    // Worker çıkarımı (tercih edilen yol) — bkz. takip-cekirdek.js
    this._cekirdek = null;
    this._maxEl = 2;
    this._yedekGecis = false;
  }

  /** HandLandmarker'ı ANA THREAD'de kurar (yedek yol). */
  async _anaThreadBaslat(maxEl) {
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
        // Düşük eşik = el kadrajdan çıkıp geri girince ANINDA yeniden yakalanır
        // (yüksek eşikte model birkaç kare "emin olmayı" bekler → gecikme hissi).
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });
    try {
      this.landmarker = await olustur("GPU");
    } catch {
      this.landmarker = await olustur("CPU");
    }
    this.yol = "ana";
  }

  /** Worker yolu çalışma anında sonuç üretemiyorsa (ör. bu tarayıcıda çıkarım
   *  ImageBitmap'i kabul etmiyorsa) canlı canlı ana-thread yoluna geç. Oyun
   *  bozulmaz: en kötü hâlde eski (kısmalı) davranışa döner. */
  async _yedegeDus() {
    if (this._yedekGecis) return;
    this._yedekGecis = true;
    this._cekirdek = null;
    try {
      await this._anaThreadBaslat(this._maxEl);
    } catch (e) {
      console.error("[MeyveKes] Ana thread el takibi de kurulamadı:", e);
    }
  }

  /** Worker çıkarımını kurar; desteklenmiyorsa false (ana-thread yedeğine düşülür). */
  async _workerBaslat(maxEl) {
    this._maxEl = maxEl;
    const cekirdek = new WorkerCikarim({
      model: "el",
      cdnKok: CDN_KOK,
      modelUrl: MODEL_URL,
      maxEl,
      onSonuc: (veri, gecikmeSn) => {
        if (this.durduruldu) return;
        this._ellerAyarla(veri.eller || []);
        this.gecikmeSn = gecikmeSn;
      },
      onYedek: () => this._yedegeDus(),
    });
    if (!(await cekirdek.kur())) return false;
    this._cekirdek = cekirdek;
    this.yol = "worker";
    return true;
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
          // Yüksek kamera fps = daha taze kare = daha az gecikme. Cihaz
          // desteklemezse ideal olduğu için sessizce 30'a düşer.
          frameRate: { ideal: 60, min: 24 },
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

    // 2) Çıkarım motoru — ÖNCE worker (ana thread bloklanmaz, kısma gerekmez)
    if (await this._workerBaslat(maxEl)) {
      this.hazir = true;
      this.durduruldu = false;
      this.damga = 0;
      this._sonTs = -1;
      this._sonIsleme = 0;
      this._sonVideoZaman = -1;
      this._dongulat();
      return;
    }

    // 3) Yedek: HandLandmarker ana thread'de (Tasks Vision, CDN üzerinden ESM)
    try {
      await this._anaThreadBaslat(maxEl);
    } catch (e) {
      this._kamerayiKapat();
      throw new Error("El takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
    }

    this.hazir = true;
    this.durduruldu = false;
    this.damga = 0;
    this._sonTs = -1;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    // Kare-güdümlü döngü: requestVideoFrameCallback varsa kamera karesi hazır olur
    // olmaz işleriz (en taze veri = en az gecikme); yoksa setTimeout'a düşeriz.
    // Her iki yolda da çıkarım süresine göre kendini kısar → render'a nefes kalır.
    this._dongulat();
  }

  // İşlemeye değer mi? (aynı kareyi tekrar işleme + CPU bütçesi)
  _isleyebilir(v, simdi) {
    if (!this.landmarker || !v || v.readyState < 2 || v.videoWidth === 0) return false;
    // Aynı video karesi iki kez işlenirse boşa CPU yanar ve taze kare gecikir.
    if (v.currentTime === this._sonVideoZaman) return false;
    // Bütçe: detectForVideo ana thread'de SENKRON çalışır; süresi boyunca render
    // (rAF) donar. Bu yüzden çıkarım ne kadar YAVAŞSA o kadar seyrek işleriz —
    // aralığı çıkarım süresinin ~1.5 katı tutup ana thread'e nefes bırakırız.
    // Bıçak izi artık çizim hızında üretildiği için (bkz. oyun.js) seyrek algılama
    // görüntüyü bozmaz; bu yüzden tavan 150→130 ms'e çekilip kesim isabeti arttı.
    const hedefAralik = Math.min(Math.max(this._sonInference * 1.5, 14), 130);
    return simdi - this._sonIsleme >= hedefAralik;
  }

  _isle(sonuc) {
    this._ellerAyarla((sonuc && sonuc.landmarks) || []);
  }

  // cok: [[{x,y,z}×21], ...] — normalize landmark listesi (worker ya da yerel çıkarım)
  _ellerAyarla(cok) {
    const eller = [];
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

  // Tek çıkarım adımı. kareYasi: kameranın bu kareyi ürettiği andan bu yana
  // geçen süre (rVFC verirse gerçek değer, yoksa 0 sayılır).
  _adim(kareYasi = 0) {
    if (this.durduruldu) return;
    const v = this.video;
    const simdi = performance.now();
    if (!this._isleyebilir(v, simdi)) return;
    this._sonIsleme = simdi;
    this._sonVideoZaman = v.currentTime;
    // detectForVideo zaman damgası KESİN ARTAN olmalı.
    let ts = Math.round(simdi);
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
    // Toplam gecikme = kare yaşı + çıkarım + bir sonraki çizime kadar geçecek
    // yarım kare. Oyun bu kadar ileri saracak (bkz. oyun.js telafi).
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
        // meta.expectedDisplayTime yerine gerçek yakalama anını kullan.
        const yakalama = meta && meta.captureTime ? meta.captureTime : simdi;
        adimAt(Math.max(0, performance.now() - yakalama));
        this._dongulat();
      });
      return;
    }
    // Yedek yol: kısa aralıklı tick (rVFC yoksa). Worker yolunda "meşgul"
    // bayrağı, ana-thread yolunda _isleyebilir bütçesi hızı sınırlar.
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
    this.eller = [];
  }
}
