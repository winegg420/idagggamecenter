// ============================================================
// GÖLGE BOKS — worker çıkarım çekirdeği (poz takibinin altyapısı)
//
// Görevi: `takip-worker.js`'i kurmak, kamera karelerini kopyalayıp worker'a
// TRANSFER etmek ve sonuçları geri vermek. Uçuşta yalnız TEK kare tutulur:
// çıkarım bitmeden yeni kare gönderilmez, arada gelen kareler düşürülür →
// kuyruk birikmez, her zaman EN TAZE kare işlenir (asgari gecikme).
//
// Meyve Kes'teki çekirdeğin izole kopyasıdır (modüller birbirinden import
// etmez). Gölge Boks'a özel iki ekleme var:
//   1) `hedefUzunKenar` — worker'a giden karenin uzun kenarı; poz modeli küçük
//      kareyle de aynı doğrulukta çalışır, kopyalama maliyeti ise doğrudan
//      piksel sayısıyla orantılıdır.
//   2) `asgariAralik` — çıkarım tavanı (ms). Tek model koştuğu için normalde 0
//      bırakılır; zayıf cihazda kısmak için vardır.
//
// Worker kurulamazsa (eski tarayıcı / OffscreenCanvas yok / CDN engeli) `kur()`
// false döner; çağıran modül ana-thread yoluna düşer. Kurulup da çıkarım hiç
// sonuç üretmezse `onYedek` çağrılır (canlı yedeğe geçiş).
// ============================================================

export class WorkerCikarim {
  /**
   * @param {object} p
   * @param {string} p.cdnKok     tasks-vision CDN kökü
   * @param {string} p.modelUrl   .task model dosyası
   * @param {number} [p.hedefUzunKenar] worker'a gönderilecek karenin uzun kenarı (px)
   * @param {number} [p.asgariAralik]   iki kare arası asgari süre (ms) — kısma
   * @param {(veri:object, gecikmeSn:number)=>void} p.onSonuc
   * @param {()=>void} p.onYedek  worker hiç sonuç üretemedi → ana thread'e geç
   */
  constructor({
    cdnKok,
    modelUrl,
    hedefUzunKenar = 320,
    asgariAralik = 0,
    onSonuc,
    onYedek,
  }) {
    this.model = "poz";
    this.cdnKok = cdnKok;
    this.modelUrl = modelUrl;
    this.hedefUzunKenar = hedefUzunKenar;
    this.asgariAralik = asgariAralik;
    this.onSonuc = onSonuc;
    this.onYedek = onYedek;
    this.worker = null;
    this.mesgul = false;
    this.sonInference = 30;
    this.sonVideoZaman = -1;
    this._sonGonderim = 0;
    this._kapandi = false;
    this._basarisizArtarda = 0;
    this._hicSonucVar = false;
    this._olcekleyemiyor = false; // createImageBitmap resize seçeneklerini desteklemeyen tarayıcı
  }

  /** Kamera karesinden çıkarım için (gerekiyorsa küçültülmüş) bitmap üretir.
   *  KRİTİK: küçültme EN-BOY ORANINI KORUR — sabit ölçüye sıkıştırmak
   *  landmark'ları kaydırır (Meyve Kes'te bedeli ödenmiş bir ders). */
  async _bitmapUret(v) {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const uzun = Math.max(vw, vh);
    if (this._olcekleyemiyor || !uzun || uzun <= this.hedefUzunKenar) return createImageBitmap(v);
    const k = this.hedefUzunKenar / uzun;
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
      // KLASİK worker (`type: "module"` YOK): MediaPipe'ın wasm yükleyicisi worker'da
      // `importScripts` kullanır; module worker'da bu yasak → kurulum her cihazda
      // ölüyor ve sessizce ana-thread yedeğine düşülüyordu (Meyve Kes ile aynı kök neden).
      w = new Worker(new URL("./takip-worker.js", import.meta.url));
    } catch {
      return false;
    }
    const kuruldu = await new Promise((resolve) => {
      // Model + wasm CDN'den iner: yavaş bağlantı için cömert süre.
      const zamanAsimi = setTimeout(() => resolve(false), 25000);
      w.onmessage = (olay) => {
        const m = olay.data;
        if (m?.tip === "hazir") {
          clearTimeout(zamanAsimi);
          resolve(true);
        } else if (m?.tip === "hata") {
          clearTimeout(zamanAsimi);
          console.warn(`[Boks] Worker (${this.model}) kurulamadı, ana thread'e düşülüyor:`, m.mesaj);
          resolve(false);
        }
      };
      w.onerror = () => {
        clearTimeout(zamanAsimi);
        resolve(false);
      };
      w.postMessage({
        tip: "kur",
        cdnKok: this.cdnKok,
        modelUrl: this.modelUrl,
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
      console.warn(`[Boks] Worker (${this.model}) hatası:`, e?.message || e);
      this.mesgul = false;
    };
    this.worker = w;
    return true;
  }

  /** Kamera karesini worker'a yollar (meşgulse/aynı kareyse/çok erkense atlar). */
  async kareGonder(video, kareYasi) {
    const v = video;
    if (this.mesgul || !this.worker || this._kapandi) return;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return;
    // Aynı video karesini iki kez işlemek boşa CPU yakar.
    if (v.currentTime === this.sonVideoZaman) return;
    // Kısma (yalnız poz için kullanılır): el tam hızda kalırken poz seyrek koşar.
    const simdi = performance.now();
    if (this.asgariAralik > 0 && simdi - this._sonGonderim < this.asgariAralik) return;
    this._sonGonderim = simdi;
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
