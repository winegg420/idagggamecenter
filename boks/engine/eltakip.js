// ============================================================
// GÖLGE BOKS — el takibi (MediaPipe Tasks Vision · HandLandmarker)
//
// Meyve Kes'teki worker tabanlı altyapıdan esinlenilmiş İZOLE kopyadır
// (meyvekes/ klasörüne hiç dokunulmaz). İki fark:
//   1) Kamerayı kendisi AÇMAZ — `kamera.js`'teki paylaşılan akışa abone olur
//      (poz takibi aynı akışı kullanır).
//   2) Sonuç paketinde MediaPipe'ın "handedness" etiketi de taşınır; anatomik
//      sol/sağ kararını yine de poz bilekleriyle eşleştirme verir (bkz. oyun.js),
//      etiket sadece yedek ipucudur.
//
// ÇALIŞMA YOLU 1 (tercih edilen): çıkarım WORKER'da → kısma gerekmez, kameranın
//   her karesi işlenir, render 60 fps akıcı kalır.
// ÇALIŞMA YOLU 2 (yedek): worker/OffscreenCanvas yoksa ana thread. Orada çıkarım
//   render'ı bloklar, bu yüzden kendini kısar (bkz. _isleyebilir).
//
// Bu sınıf HAM normalize landmark verir; aynalama (selfie) çizim/oyun tarafında
// yapılır (render.js · koordinatHesap).
// ============================================================

import { WorkerCikarim } from "./takip-cekirdek.js";

const TASKS_SURUM = "0.10.14";
export const CDN_KOK = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_SURUM}`;
export const EL_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class ElTakip {
  constructor() {
    this.eller = []; // [{ noktalar: [{x,y,z}×21], etiket: 'Left'|'Right'|null }]
    this.hazir = false;
    this.durduruldu = false;
    this.damga = 0; // yeni algılama karesi işareti
    this.elSayisi = 0; // teşhis
    this.yol = "kuruluyor"; // 'worker' | 'ana'
    this.gecikmeSn = 0.04; // kamera karesi → sonuç gecikmesi (telafi için)
    this.video = null;
    this._landmarker = null;
    this._cekirdek = null;
    this._maxEl = 2;
    this._sonTs = -1;
    this._sonInference = 30;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    this._yedekGecis = false;
  }

  /** HandLandmarker'ı ANA THREAD'de kurar (yedek yol). */
  async _anaThreadBaslat(maxEl) {
    // Vite build sırasında bu CDN URL'sini çözmeye çalışmasın.
    const vision = await import(/* @vite-ignore */ `${CDN_KOK}/vision_bundle.mjs`);
    const { HandLandmarker, FilesetResolver } = vision;
    if (!HandLandmarker || !FilesetResolver) throw new Error("HandLandmarker bulunamadı");
    const fileset = await FilesetResolver.forVisionTasks(`${CDN_KOK}/wasm`);
    const olustur = (delege) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: EL_MODEL_URL, delegate: delege },
        numHands: maxEl,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });
    try {
      this._landmarker = await olustur("GPU");
    } catch {
      this._landmarker = await olustur("CPU");
    }
    this.yol = "ana";
  }

  /** Worker çalışma anında sonuç üretemiyorsa canlı canlı ana-thread'e geç. */
  async _yedegeDus() {
    if (this._yedekGecis) return;
    this._yedekGecis = true;
    this._cekirdek = null;
    try {
      await this._anaThreadBaslat(this._maxEl);
    } catch (e) {
      console.error("[Boks] Ana thread el takibi de kurulamadı:", e);
    }
  }

  async _workerBaslat(maxEl) {
    const cekirdek = new WorkerCikarim({
      model: "el",
      cdnKok: CDN_KOK,
      modelUrl: EL_MODEL_URL,
      maxEl,
      hedefUzunKenar: 480,
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

  /**
   * @param {import('./kamera.js').Kamera} kamera paylaşılan kamera akışı
   * @param {number} maxEl azami el sayısı (boksta 2)
   */
  async baslat(kamera, maxEl = 2) {
    this._maxEl = maxEl;
    this.video = kamera.video;
    if (!(await this._workerBaslat(maxEl))) {
      try {
        await this._anaThreadBaslat(maxEl);
      } catch (e) {
        throw new Error("El takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
      }
    }
    this.hazir = true;
    this.durduruldu = false;
    kamera.abone((video, yas) => this.kareIsle(video, yas));
  }

  /** Kamera döngüsünden çağrılır. */
  kareIsle(video, yas) {
    if (this.durduruldu) return;
    if (this._cekirdek?.aktif) this._cekirdek.kareGonder(video, yas);
    else this._adim(video, yas);
  }

  // ---- ana thread yolu ----
  _isleyebilir(v, simdi) {
    if (!this._landmarker || !v || v.readyState < 2 || v.videoWidth === 0) return false;
    if (v.currentTime === this._sonVideoZaman) return false;
    // detectForVideo ana thread'de SENKRON: süresi boyunca render donar. Bu
    // yüzden çıkarım ne kadar yavaşsa o kadar seyrek işleriz.
    const hedefAralik = Math.min(Math.max(this._sonInference * 1.5, 14), 130);
    return simdi - this._sonIsleme >= hedefAralik;
  }

  _adim(v, kareYasi = 0) {
    const simdi = performance.now();
    if (!this._isleyebilir(v, simdi)) return;
    this._sonIsleme = simdi;
    this._sonVideoZaman = v.currentTime;
    let ts = Math.round(simdi);
    if (ts <= this._sonTs) ts = this._sonTs + 1;
    this._sonTs = ts;
    const t0 = performance.now();
    try {
      const sonuc = this._landmarker.detectForVideo(v, ts);
      const cok = (sonuc && sonuc.landmarks) || [];
      const hand = (sonuc && sonuc.handedness) || [];
      this._ellerAyarla(
        cok.map((n, i) => ({
          noktalar: n,
          etiket: hand[i] && hand[i][0] ? hand[i][0].categoryName : null,
        })),
      );
    } catch {
      /* tek kare hatası — yut */
    }
    this._sonInference = performance.now() - t0;
    this.gecikmeSn = Math.min(0.18, (kareYasi + this._sonInference + 8) / 1000);
  }

  _ellerAyarla(liste) {
    this.eller = liste;
    this.elSayisi = liste.length;
    this.damga++;
  }

  durdur() {
    this.durduruldu = true;
    this.hazir = false;
    this._cekirdek?.kapat();
    this._cekirdek = null;
    try {
      this._landmarker?.close?.();
    } catch {
      /* yut */
    }
    this._landmarker = null;
    this.eller = [];
    this.video = null;
  }
}
