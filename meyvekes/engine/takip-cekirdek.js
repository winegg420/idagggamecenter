// ============================================================
// MEYVE KES — worker çıkarım çekirdeği (el + yüz takibi ortak altyapısı)
//
// Görevi: `takip-worker.js`'i kurmak, kamera karelerini kopyalayıp worker'a
// TRANSFER etmek ve sonuçları geri vermek. Uçuşta yalnız TEK kare tutulur:
// çıkarım bitmeden yeni kare gönderilmez, arada gelen kareler düşürülür →
// kuyruk birikmez, her zaman EN TAZE kare işlenir (asgari gecikme).
//
// Worker kurulamazsa (eski tarayıcı / OffscreenCanvas yok / CDN engeli) `kur()`
// false döner; çağıran modül eski ana-thread yoluna düşer. Kurulup da çıkarım
// hiç sonuç üretmezse `onYedek` çağrılır (canlı yedeğe geçiş).
// ============================================================

// Worker'a gönderilen karenin azami uzun kenarı (px). Kamera 640x480'den büyük
// kare üretirse (bazı cihazlar "ideal"i aşar) her karede o boyutta bir RGBA kopya
// çıkarmak ana thread'de ölçülebilir yük ve GC baskısı yaratır; GPU'ya yükleme de
// aynı oranda pahalılaşır. Model girdiyi zaten ~200 px'e küçülttüğü için bu
// ölçekte algılama doğruluğu değişmez.
// KRİTİK: küçültme EN-BOY ORANINI KORUR — sabit ölçüye (ör. 320x240) sıkıştırmak
// landmark'ları kaydırır (bu hatanın kök-neden dersi CLAUDE.md'de).
const HEDEF_UZUN_KENAR = 480;

export class WorkerCikarim {
  /**
   * @param {object} p
   * @param {'el'|'yuz'} p.model  hangi landmarker
   * @param {string} p.cdnKok     tasks-vision CDN kökü
   * @param {string} p.modelUrl   .task model dosyası
   * @param {number} [p.maxEl]    el modelinde azami el sayısı
   * @param {(veri:object, gecikmeSn:number)=>void} p.onSonuc
   * @param {()=>void} p.onYedek  worker hiç sonuç üretemedi → ana thread'e geç
   */
  constructor({ model, cdnKok, modelUrl, maxEl = 2, onSonuc, onYedek }) {
    this.model = model;
    this.cdnKok = cdnKok;
    this.modelUrl = modelUrl;
    this.maxEl = maxEl;
    this.onSonuc = onSonuc;
    this.onYedek = onYedek;
    this.worker = null;
    this.mesgul = false;
    this.sonInference = 30;
    this.sonVideoZaman = -1;
    this._kapandi = false;
    this._basarisizArtarda = 0;
    this._hicSonucVar = false;
    this._olcekleyemiyor = false; // createImageBitmap resize seçeneklerini desteklemeyen tarayıcı
  }

  /** Kamera karesinden çıkarım için (gerekiyorsa küçültülmüş) bitmap üretir. */
  async _bitmapUret(v) {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const uzun = Math.max(vw, vh);
    if (this._olcekleyemiyor || !uzun || uzun <= HEDEF_UZUN_KENAR) return createImageBitmap(v);
    const k = HEDEF_UZUN_KENAR / uzun;
    try {
      return await createImageBitmap(v, {
        resizeWidth: Math.max(1, Math.round(vw * k)),
        resizeHeight: Math.max(1, Math.round(vh * k)),
        resizeQuality: "low",
      });
    } catch {
      // Eski tarayıcı: seçenekler desteklenmiyor → bir daha deneme, tam kare gönder.
      this._olcekleyemiyor = true;
      return createImageBitmap(v);
    }
  }

  get aktif() {
    return !!this.worker && !this._kapandi;
  }

  /** Worker'ı kurar. Desteklenmiyorsa/hata olursa false döner. */
  async kur() {
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function") return false;
    let w;
    try {
      w = new Worker(new URL("./takip-worker.js", import.meta.url), { type: "module" });
    } catch {
      return false;
    }
    const kuruldu = await new Promise((resolve) => {
      // Model + wasm CDN'den iner: yavaş bağlantı için cömert süre.
      const zamanAsimi = setTimeout(() => resolve(false), 20000);
      w.onmessage = (olay) => {
        const m = olay.data;
        if (m?.tip === "hazir") {
          clearTimeout(zamanAsimi);
          resolve(true);
        } else if (m?.tip === "hata") {
          clearTimeout(zamanAsimi);
          console.warn(`[MeyveKes] Worker (${this.model}) kurulamadı, ana thread'e düşülüyor:`, m.mesaj);
          resolve(false);
        }
      };
      w.onerror = () => {
        clearTimeout(zamanAsimi);
        resolve(false);
      };
      w.postMessage({
        tip: "kur",
        model: this.model,
        cdnKok: this.cdnKok,
        modelUrl: this.modelUrl,
        maxEl: this.maxEl,
      });
    });
    if (!kuruldu) {
      try {
        w.terminate();
      } catch {
        /* yut */
      }
      return false;
    }
    w.onmessage = (olay) => {
      const m = olay.data;
      if (m?.tip !== "sonuc") return;
      this.mesgul = false;
      if (this._kapandi) return;
      this.sonInference = m.sure || this.sonInference;
      // Toplam gecikme = kare yaşı + çıkarım + bir sonraki çizime kadar yarım kare.
      const gecikmeSn = Math.min(0.18, ((m.kareYasi || 0) + (m.sure || 0) + 8) / 1000);
      if (m.veri) {
        this._hicSonucVar = true;
        this._basarisizArtarda = 0;
        this.onSonuc?.(m.veri, gecikmeSn);
      } else if (!this._hicSonucVar && ++this._basarisizArtarda >= 10) {
        // Bu tarayıcıda worker çıkarımı hiç çalışmıyor → canlı yedeğe geç.
        this.kapat();
        this.onYedek?.();
      }
    };
    w.onerror = (e) => {
      console.warn(`[MeyveKes] Worker (${this.model}) hatası:`, e?.message || e);
      this.mesgul = false;
    };
    this.worker = w;
    return true;
  }

  /** Kamera karesini worker'a yollar (meşgulse/aynı kareyse atlar). */
  async kareGonder(video, kareYasi) {
    const v = video;
    if (this.mesgul || !this.worker || this._kapandi) return;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return;
    // Aynı video karesini iki kez işlemek boşa CPU yakar.
    if (v.currentTime === this.sonVideoZaman) return;
    this.sonVideoZaman = v.currentTime;
    this.mesgul = true;
    let kare = null;
    try {
      kare = await this._bitmapUret(v);
    } catch {
      this.mesgul = false;
      return;
    }
    if (this._kapandi || !this.worker) {
      try {
        kare.close?.();
      } catch {
        /* yut */
      }
      this.mesgul = false;
      return;
    }
    try {
      this.worker.postMessage(
        { tip: "kare", kare, ts: Math.round(performance.now()), kareYasi },
        [kare],
      );
    } catch {
      // transfer edilemedi (nadir) — bayrağı bırak, sonraki kare telafi eder
      this.mesgul = false;
      try {
        kare.close?.();
      } catch {
        /* yut */
      }
    }
  }

  kapat() {
    this._kapandi = true;
    this.mesgul = false;
    if (!this.worker) return;
    try {
      this.worker.postMessage({ tip: "kapat" });
    } catch {
      /* yut */
    }
    // Worker kendini self.close() ile kapatır; yine de garanti terminate.
    try {
      this.worker.terminate();
    } catch {
      /* yut */
    }
    this.worker = null;
  }
}
