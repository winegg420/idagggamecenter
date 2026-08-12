// ============================================================
// GÖLGE BOKS — tek kamera akışı (el + poz takibi bunu PAYLAŞIR)
//
// Neden ayrı dosya: Gölge Boks aynı anda iki modeli besler (HandLandmarker +
// PoseLandmarker). Her takip modülü kendi `getUserMedia`'sını açsaydı iki ayrı
// kamera akışı (çift kod çözme, çift ısınma, bazı cihazlarda "kamera meşgul"
// hatası) doğardı. Burada TEK akış açılır, TEK kare döngüsü kurulur ve kare
// aboneleri sırayla beslenir.
//
// Kare döngüsü `requestVideoFrameCallback` ile kare-güdümlüdür (en taze veri =
// en az gecikme); desteklenmiyorsa kısa aralıklı setTimeout'a düşer.
// ============================================================

export class Kamera {
  constructor() {
    this.video = null;
    this.stream = null;
    this.genislik = 640;
    this.yukseklik = 480;
    this.durduruldu = false;
    this._aboneler = [];
    this._rvfc = null;
    this._dongu = null;
  }

  /** Kamerayı açar. Hata durumunda anlaşılır mesajla reddeder. */
  async baslat() {
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
          // Boksta oyuncu kameradan 1.5-2.5 m uzakta durur: gövdenin tamamının
          // sığması için 4:3 yerine geniş kare (16:9) tercih edilir.
          width: { ideal: 960 },
          height: { ideal: 540 },
          // Yüksek kamera fps = daha taze kare = yumruk anını daha iyi yakalama.
          frameRate: { ideal: 60, min: 24 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.genislik = this.video.videoWidth || 960;
      this.yukseklik = this.video.videoHeight || 540;
    } catch (e) {
      this.durdur();
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        throw new Error("Kamera izni reddedildi. Antrenman için kamera erişimine izin ver.");
      }
      if (e && e.name === "NotFoundError") {
        throw new Error("Kamera bulunamadı. Cihazında bir ön kamera olduğundan emin ol.");
      }
      if (e && e.name === "NotReadableError") {
        throw new Error("Kamera başka bir uygulama tarafından kullanılıyor. Diğer uygulamaları kapat.");
      }
      throw new Error("Kamera açılamadı: " + (e?.message || e));
    }
    this.durduruldu = false;
    this._dongulat();
  }

  /** Her kamera karesinde çağrılacak abone ekler: fn(video, kareYasiMs). */
  abone(fn) {
    if (typeof fn === "function") this._aboneler.push(fn);
  }

  _kare(yas) {
    if (this.durduruldu) return;
    for (let i = 0; i < this._aboneler.length; i++) {
      try {
        this._aboneler[i](this.video, yas);
      } catch {
        /* tek abonenin hatası döngüyü durdurmaz */
      }
    }
  }

  _dongulat() {
    if (this.durduruldu) return;
    const v = this.video;
    if (v && typeof v.requestVideoFrameCallback === "function") {
      this._rvfc = v.requestVideoFrameCallback((simdi, meta) => {
        if (this.durduruldu) return;
        // meta.captureTime: karenin gerçekten yakalandığı an (gecikme telafisi).
        const yakalama = meta && meta.captureTime ? meta.captureTime : simdi;
        this._kare(Math.max(0, performance.now() - yakalama));
        this._dongulat();
      });
      return;
    }
    this._dongu = setTimeout(() => {
      this._kare(0);
      this._dongulat();
    }, 8);
  }

  durdur() {
    this.durduruldu = true;
    this._aboneler = [];
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
}
