// ============================================================
// MEYVE KES — el takibi (MediaPipe Hands)
// Ön kamera akışını açar, MediaPipe Hands modelini CDN'den yükler ve
// el işaret noktalarını sürekli takip eder. Ayna (mirror) düzeltmesi
// burada yapılmaz — çizim/kesim tarafı ekran koordinatına çevirirken
// aynalar (ön kamera selfie görünümü).
//
// Performans: modelComplexity 0 (lite), düşük çözünürlük, aynı anda tek
// gönderim (busy bayrağı) — 4 el takibinde bile akıcı kalması için.
// ============================================================

const CDN_SURUM = "0.4.1675469240";
const CDN_KOK = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${CDN_SURUM}`;

function scriptYukle(src) {
  return new Promise((coz, ret) => {
    // Zaten yüklüyse tekrar ekleme.
    if (document.querySelector(`script[data-mp="${src}"]`)) return coz();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.mp = src;
    s.onload = () => coz();
    s.onerror = () => ret(new Error("MediaPipe yüklenemedi"));
    document.head.appendChild(s);
  });
}

export class ElTakip {
  constructor() {
    this.video = null;
    this.stream = null;
    this.hands = null;
    this.eller = []; // [{ noktalar: [{x,y,z}...], taraf: 'sol'|'sag' }]
    this.hazir = false;
    this.durduruldu = false;
    this._mesgul = false;
    this._sonKare = 0;
    this._dongu = null;
    this.videoGenislik = 640;
    this.videoYukseklik = 480;
  }

  // Kamera + MediaPipe'ı başlatır. Hata durumunda anlamlı mesajla reddeder.
  async baslat(maxEl) {
    // 1) Kamera izni + akış
    try {
      this.video = document.createElement("video");
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "");
      // Bazı tarayıcılar DOM'a bağlı olmayan video'dan kare çözmez → gizli ekle.
      this.video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;";
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

    // 2) MediaPipe Hands (CDN)
    try {
      await scriptYukle(`${CDN_KOK}/hands.js`);
      const Hands = window.Hands;
      if (!Hands) throw new Error("Hands global bulunamadı");
      this.hands = new Hands({ locateFile: (dosya) => `${CDN_KOK}/${dosya}` });
      this.hands.setOptions({
        maxNumHands: maxEl,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
        selfieMode: false, // aynalamayı çizim tarafında yapıyoruz
      });
      this.hands.onResults((sonuc) => this._sonuc(sonuc));
    } catch (e) {
      this._kamerayiKapat();
      throw new Error("El takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
    }

    this.hazir = true;
    this.durduruldu = false;
    this._dongu = requestAnimationFrame(() => this._gonder());
  }

  _sonuc(sonuc) {
    const eller = [];
    const cok = sonuc.multiHandLandmarks || [];
    for (let i = 0; i < cok.length; i++) {
      const noktalar = cok[i];
      // Aynalı görünümde ekranın solu = kullanıcının sağ eli; taraf, ekran
      // konumuna göre belirlenir (arkadaş modunda P1/P2 için avuç x'i).
      const palm = noktalar[9] || noktalar[0];
      const ekranX = palm ? 1 - palm.x : 0.5; // aynalanmış x
      eller.push({ noktalar, taraf: ekranX < 0.5 ? "sol" : "sag" });
    }
    this.eller = eller;
  }

  async _gonder() {
    if (this.durduruldu) return;
    const simdi = performance.now();
    // ~30 fps sınırı + tek gönderim (üst üste binmesin).
    if (!this._mesgul && this.hands && this.video && this.video.readyState >= 2 && simdi - this._sonKare >= 32) {
      this._mesgul = true;
      this._sonKare = simdi;
      try {
        await this.hands.send({ image: this.video });
      } catch {
        /* tek kare hatası — yut, döngü devam */
      }
      this._mesgul = false;
    }
    this._dongu = requestAnimationFrame(() => this._gonder());
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
    if (this._dongu) cancelAnimationFrame(this._dongu);
    this._dongu = null;
    this._kamerayiKapat();
    try {
      this.hands?.close?.();
    } catch {
      /* yut */
    }
    this.hands = null;
    this.eller = [];
  }
}
