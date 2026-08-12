// ============================================================
// GÖLGE BOKS — poz takibi (MediaPipe Tasks Vision · PoseLandmarker)
//
// TEK MODEL: yumruk türü (jab/cross/hook/uppercut) omuz-dirsek-bilek zincirinin
// geometrisinden okunur, gard yüksekliği yumruğun KAFAYA göre konumudur,
// savunma modu kafa/gövde kaçışını ölçer — hepsi poz modelinde vardır.
//
// PERFORMANS KARARI (2026-08-12): eskiden HandLandmarker da aynı anda koşuyordu
// (el ölçeği = derinlik proxy'si için). İki model = iki çıkarım + iki bitmap
// kopyası; mobilde oyun akmıyordu. El modeli KALDIRILDI: poz zaten bileğin yanı
// sıra serçe (17/18) ve işaret (19/20) köklerini veriyor — bilek↔parmak kökü
// mesafesi el ölçeğinin ta kendisidir. Böylece CPU yükü ~yarıya indi ve poz
// artık kısılmadan (asgariAralik 0) her kamera karesinde koşabiliyor; yumruk
// tespiti de eskisinden HIZLI oldu.
//
// ADAPTİF KAPSAM: her noktanın görünürlük (`g`) değeri taşınır. Analiz SADECE
// kameranın gerçekten gördüğü bölgelere dayanır; eksik veri asla varsayılmaz.
// `kapsam` alanı bunu özetler (ustGovde / kollar / kalca / bacaklar).
// ============================================================

import { WorkerCikarim } from "./takip-cekirdek.js";

const TASKS_SURUM = "0.10.14";
export const CDN_KOK = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_SURUM}`;
export const POZ_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Poz landmark indeksleri (MediaPipe Pose · 33 nokta)
export const P = {
  BURUN: 0,
  SOL_KULAK: 7,
  SAG_KULAK: 8,
  SOL_OMUZ: 11,
  SAG_OMUZ: 12,
  SOL_DIRSEK: 13,
  SAG_DIRSEK: 14,
  SOL_BILEK: 15,
  SAG_BILEK: 16,
  SOL_SERCE: 17,
  SAG_SERCE: 18,
  SOL_ISARET: 19,
  SAG_ISARET: 20,
  SOL_KALCA: 23,
  SAG_KALCA: 24,
  SOL_DIZ: 25,
  SAG_DIZ: 26,
  SOL_AYAK: 27,
  SAG_AYAK: 28,
};

// Bu değerin altındaki görünürlük "kamera bu noktayı görmüyor" sayılır.
export const GORUNUR_ESIK = 0.55;
// Tek model koştuğu için worker yolunda kısma YOK: uçuştaki tek kare kuralı
// zaten doğal tavanı koyar (çıkarım bitmeden yeni kare gönderilmez).
const POZ_ASGARI_ARALIK = 0;
const POZ_ASGARI_ARALIK_ANA = 70; // ms — ana-thread yedeğinde tavan

export class PozTakip {
  constructor() {
    this.poz = null; // { noktalar: {idx:{x,y,z,g}}, dunya: {...} }
    this.kapsam = { ustGovde: false, kollar: false, kalca: false, bacaklar: false };
    this.hazir = false;
    this.durduruldu = false;
    this.damga = 0;
    this.yol = "kuruluyor";
    this.gecikmeSn = 0.05;
    this.video = null;
    this._landmarker = null;
    this._cekirdek = null;
    this._sonTs = -1;
    this._sonInference = 40;
    this._sonIsleme = 0;
    this._sonVideoZaman = -1;
    this._yedekGecis = false;
  }

  async _anaThreadBaslat() {
    const vision = await import(/* @vite-ignore */ `${CDN_KOK}/vision_bundle.mjs`);
    const { PoseLandmarker, FilesetResolver } = vision;
    if (!PoseLandmarker || !FilesetResolver) throw new Error("PoseLandmarker bulunamadı");
    const fileset = await FilesetResolver.forVisionTasks(`${CDN_KOK}/wasm`);
    const olustur = (delege) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POZ_MODEL_URL, delegate: delege },
        numPoses: 1,
        runningMode: "VIDEO",
        outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
    try {
      this._landmarker = await olustur("GPU");
    } catch {
      this._landmarker = await olustur("CPU");
    }
    this.yol = "ana";
  }

  async _yedegeDus() {
    if (this._yedekGecis) return;
    this._yedekGecis = true;
    this._cekirdek = null;
    try {
      await this._anaThreadBaslat();
    } catch (e) {
      console.error("[Boks] Ana thread poz takibi de kurulamadı:", e);
    }
  }

  async _workerBaslat() {
    const cekirdek = new WorkerCikarim({
      cdnKok: CDN_KOK,
      modelUrl: POZ_MODEL_URL,
      hedefUzunKenar: 320,
      asgariAralik: POZ_ASGARI_ARALIK,
      onSonuc: (veri, gecikmeSn) => {
        if (this.durduruldu) return;
        this._pozAyarla(veri.poz || null);
        this.gecikmeSn = gecikmeSn;
      },
      onYedek: () => this._yedegeDus(),
    });
    if (!(await cekirdek.kur())) return false;
    this._cekirdek = cekirdek;
    this.yol = "worker";
    return true;
  }

  /** @param {import('./kamera.js').Kamera} kamera paylaşılan kamera akışı */
  async baslat(kamera) {
    this.video = kamera.video;
    if (!(await this._workerBaslat())) {
      try {
        await this._anaThreadBaslat();
      } catch (e) {
        throw new Error("Vücut takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
      }
    }
    this.hazir = true;
    this.durduruldu = false;
    kamera.abone((video, yas) => this.kareIsle(video, yas));
  }

  kareIsle(video, yas) {
    if (this.durduruldu) return;
    if (this._cekirdek?.aktif) this._cekirdek.kareGonder(video, yas);
    else this._adim(video, yas);
  }

  // ---- ana thread yolu (yedek) ----
  _isleyebilir(v, simdi) {
    if (!this._landmarker || !v || v.readyState < 2 || v.videoWidth === 0) return false;
    if (v.currentTime === this._sonVideoZaman) return false;
    // Ana thread'de `detectForVideo` SENKRON: süresi boyunca render donar.
    // Bu yüzden çıkarım ne kadar yavaşsa o kadar seyrek işlenir.
    const hedefAralik = Math.min(Math.max(this._sonInference * 1.6, POZ_ASGARI_ARALIK_ANA), 220);
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
      const n = ((sonuc && sonuc.landmarks) || [])[0];
      const d = ((sonuc && sonuc.worldLandmarks) || [])[0] || null;
      if (!n) {
        this._pozAyarla(null);
      } else {
        const noktalar = {};
        for (const ad in P) {
          const idx = P[ad];
          const p = n[idx];
          if (!p) continue;
          noktalar[idx] = {
            x: p.x,
            y: p.y,
            z: p.z || 0,
            g: typeof p.visibility === "number" ? p.visibility : 1,
          };
        }
        let dunya = null;
        if (d) {
          dunya = {};
          for (const idx of [P.SOL_OMUZ, P.SAG_OMUZ, P.SOL_KALCA, P.SAG_KALCA]) {
            const p = d[idx];
            if (p) dunya[idx] = { x: p.x, y: p.y, z: p.z };
          }
        }
        this._pozAyarla({ noktalar, dunya });
      }
    } catch {
      /* tek kare hatası — yut */
    }
    this._sonInference = performance.now() - t0;
    this.gecikmeSn = Math.min(0.2, (kareYasi + this._sonInference + 8) / 1000);
  }

  _pozAyarla(poz) {
    this.poz = poz;
    this.kapsam = kapsamHesap(poz);
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
    this.poz = null;
    this.video = null;
  }
}

/** Bir noktanın kamerada gerçekten görünüp görünmediği. */
export function gorunur(poz, idx, esik = GORUNUR_ESIK) {
  const p = poz?.noktalar?.[idx];
  return !!p && p.g >= esik && p.x > -0.05 && p.x < 1.05 && p.y > -0.05 && p.y < 1.05;
}

/** ADAPTİF KAPSAM: analiz hangi bölgelere dayanabilir? */
export function kapsamHesap(poz) {
  if (!poz) return { ustGovde: false, kollar: false, kalca: false, bacaklar: false };
  const ustGovde =
    gorunur(poz, P.SOL_OMUZ) && gorunur(poz, P.SAG_OMUZ) && gorunur(poz, P.BURUN);
  const kollar =
    (gorunur(poz, P.SOL_DIRSEK) && gorunur(poz, P.SOL_BILEK)) ||
    (gorunur(poz, P.SAG_DIRSEK) && gorunur(poz, P.SAG_BILEK));
  const kalca = gorunur(poz, P.SOL_KALCA) && gorunur(poz, P.SAG_KALCA);
  const bacaklar =
    kalca &&
    (gorunur(poz, P.SOL_DIZ) || gorunur(poz, P.SAG_DIZ)) &&
    (gorunur(poz, P.SOL_AYAK) || gorunur(poz, P.SAG_AYAK));
  return { ustGovde, kollar, kalca, bacaklar };
}
