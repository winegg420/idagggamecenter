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
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.videoGenislik = this.video.videoWidth || 480;
      this.videoYukseklik = this.video.videoHeight || 360;
      // Çıkarım için küçük offscreen kare (ana thread bloklama süresini kısaltır).
      // Görüntü tam video'dan çizilir; MediaPipe'a bu küçük kare gönderilir.
      this._kucuk = document.createElement("canvas");
      this._kucuk.width = 320;
      this._kucuk.height = 240;
      this._kucukCtx = this._kucuk.getContext("2d", { alpha: false });
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
        // Düşük eşik = el hızla hareket edip kadraja girip çıksa bile çabuk yakalanır.
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.4,
        selfieMode: false, // aynalamayı çizim tarafında yapıyoruz
      });
      this.hands.onResults((sonuc) => this._sonuc(sonuc));
    } catch (e) {
      this._kamerayiKapat();
      throw new Error("El takip modeli yüklenemedi (internet gerekli): " + (e?.message || e));
    }

    this.damga = 0;
    this._sonInference = 30;
    this.hazir = true;
    this.durduruldu = false;
    // setTimeout tabanlı döngü: render rAF'ından bağımsız çalışır, çıkarım
    // süresine göre kendini yavaşlatır → ana thread render'a nefes payı bırakır.
    this._gonder();
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
    this.damga = (this.damga || 0) + 1; // yeni veri işareti (kesim işleme için)
  }

  async _gonder() {
    if (this.durduruldu) return;
    if (this.hands && this.video && this.video.readyState >= 2) {
      const t0 = performance.now();
      try {
        // Küçük kareye çiz → MediaPipe'a onu gönder (çıkarım çok daha hızlı).
        this._kucukCtx.drawImage(this.video, 0, 0, this._kucuk.width, this._kucuk.height);
        await this.hands.send({ image: this._kucuk });
      } catch {
        /* tek kare hatası — yut, döngü devam */
      }
      this._sonInference = performance.now() - t0;
    }
    if (this.durduruldu) return;
    // Gecikme = çıkarım süresi kadar (25–130 ms) → yaklaşık %50 doluluk,
    // kalan zamanı render kullanır (kasma önlenir). Zayıf cihaz otomatik yavaşlar.
    const gecikme = Math.min(Math.max(this._sonInference, 25), 130);
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
      this.hands?.close?.();
    } catch {
      /* yut */
    }
    this.hands = null;
    this.eller = [];
  }
}
