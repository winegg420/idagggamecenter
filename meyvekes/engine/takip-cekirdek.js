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
// Yavaş cihaz (telefon) kare boyutu: çıkarım ortalaması YAVAS_CIKARIM_MS'i aşarsa
// uzun kenar buna iner (GPU'ya yükleme + ön işleme kare alanıyla ölçeklenir).
// Model girdisi zaten 192-224 px; 352'de el kırpıntısı hâlâ model girdisinden büyük.
const DUSUK_UZUN_KENAR = 352;
const YAVAS_CIKARIM_MS = 30;
const ISINMA_KARE = 30; // ilk kareler (shader derleme, önbellek) ölçüme katılmaz

function mobilMi() {
  try {
    return (
      typeof navigator !== "undefined" &&
      (navigator.maxTouchPoints || 0) > 0 &&
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches
    );
  } catch {
    return false;
  }
}

export class WorkerCikarim {
  /**
   * @param {object} p
   * @param {'el'|'yuz'} p.model  hangi landmarker
   * @param {string} p.cdnKok     tasks-vision CDN kökü
   * @param {string} p.modelUrl   .task model dosyası
   * @param {number} [p.maxEl]    el modelinde azami el sayısı
   * @param {(veri:object, gecikmeSn:number)=>void} p.onSonuc
   * @param {()=>void} p.onYedek  worker hiç sonuç üretemedi → ana thread'e geç
   * @param {(delege:string)=>void} [p.onDelege] worker delegeyi değiştirdi (teşhis)
   */
  constructor({ model, cdnKok, modelUrl, maxEl = 2, onSonuc, onYedek, onDelege }) {
    this.model = model;
    this.cdnKok = cdnKok;
    this.modelUrl = modelUrl;
    this.maxEl = maxEl;
    this.onSonuc = onSonuc;
    this.onYedek = onYedek;
    this.onDelege = onDelege;
    this.worker = null;
    this.mesgul = false;
    this.sonInference = 30;
    this.cikarimMs = 0; // teşhis: çıkarım süresi EMA (ms)
    this.sonVideoZaman = -1;
    // Dokunmatik/telefon: baştan küçük kare (ölçüm: 480→352 px çıkarımı ~yarıya
    // indiriyor; model girdisi zaten daha küçük). Masaüstü 480 ile başlar, yavaşsa iner.
    this.hedefUzunKenar = mobilMi() ? DUSUK_UZUN_KENAR : HEDEF_UZUN_KENAR;
    this._sonucSayisi = 0;
    // "Boşalınca hemen gönder": son görülen video + o karenin yakalama anı.
    // rVFC 30 fps kamerada 33 ms'de bir gelir; worker 34-66 ms çalışıyorsa her
    // ikinci kare atlanır ve Hz 30→15'e KİLİTLENİR (telefonda ölçülen 13-14 Hz).
    // Sonuç gelir gelmez en taze kareyi göndermek bu basamaklanmayı kırar:
    // Hz ≈ min(kamera fps, 1000 / çıkarım).
    this._sonVideo = null;
    this._sonYakalama = 0;
    // Ön hazırlık: worker meşgulken gelen en taze karenin bitmap'i ÖNCEDEN
    // çıkarılır (createImageBitmap telefonda 5-15 ms). Sonuç gelir gelmez bu
    // hazır kare sıfır beklemeyle gönderilir → çevrim = yalnız çıkarım süresi.
    this._hazirKare = null; // { kare, yakalama, videoZaman }
    this._hazirlaniyor = false;
    this._kapandi = false;
    this._basarisizArtarda = 0;
    this._hicSonucVar = false;
    this._olcekleyemiyor = false; // createImageBitmap resize seçeneklerini desteklemeyen tarayıcı
    this._kurSozu = null; // kur() yeniden girişe karşı: ikinci çağrı aynı sözü alır
    this.delege = ""; // teşhis: worker hangi delegeyle kuruldu ("GPU"|"CPU")
  }

  /** Kamera karesinden çıkarım için (gerekiyorsa küçültülmüş) bitmap üretir. */
  async _bitmapUret(v) {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const uzun = Math.max(vw, vh);
    const hedef = this.hedefUzunKenar;
    if (this._olcekleyemiyor || !uzun || uzun <= hedef) return createImageBitmap(v);
    const k = hedef / uzun;
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

  /** Worker'ı kurar. Desteklenmiyorsa/hata olursa false döner.
   *  Yeniden girişe dayanıklı: kurulum sürerken ikinci çağrı aynı sonucu bekler
   *  (iki worker + iki model indirme olmaz). */
  kur() {
    if (!this._kurSozu) this._kurSozu = this._kur();
    return this._kurSozu;
  }

  async _kur() {
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function") return false;
    let w;
    try {
      // KRİTİK: KLASİK worker (`type: "module"` YOK). MediaPipe'ın wasm yükleyicisi
      // worker'da `importScripts` çağırır; module worker'da bu yasak olduğundan
      // kurulum her cihazda "Module scripts don't support importScripts()" ile
      // ölüyor ve oyun sessizce kısmalı ana-thread yedeğine (~10 Hz) düşüyordu.
      w = new Worker(new URL("./takip-worker.js", import.meta.url));
    } catch (e) {
      console.warn(`[MeyveKes] Worker (${this.model}) oluşturulamadı, ana thread'e düşülüyor:`, e?.message || e);
      return false;
    }
    const kuruldu = await new Promise((resolve) => {
      // Model + wasm CDN'den iner: yavaş bağlantı için cömert süre.
      const zamanAsimi = setTimeout(() => {
        console.warn(`[MeyveKes] Worker (${this.model}) 20 sn içinde hazır olmadı, ana thread'e düşülüyor.`);
        resolve(false);
      }, 20000);
      w.onmessage = (olay) => {
        const m = olay.data;
        if (m?.tip === "hazir") {
          clearTimeout(zamanAsimi);
          this.delege = m.delege === "CPU" ? "CPU" : "GPU";
          resolve(true);
        } else if (m?.tip === "hata") {
          clearTimeout(zamanAsimi);
          console.warn(`[MeyveKes] Worker (${this.model}) kurulamadı, ana thread'e düşülüyor:`, m.mesaj);
          resolve(false);
        }
      };
      w.onerror = (e) => {
        clearTimeout(zamanAsimi);
        console.warn(`[MeyveKes] Worker (${this.model}) yüklenirken hata, ana thread'e düşülüyor:`, e?.message || e);
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
      if (!m) return;
      if (m.tip === "delege") {
        // Worker delege yarışını bitirdi (yavaş GPU'da CPU ölçüldü; hızlı olan tutuldu).
        this.delege = m.delege === "CPU" ? "CPU" : "GPU";
        console.info(`[MeyveKes] Worker (${this.model}) delege ${m.degisti ? "→ " : "kaldı: "}${this.delege} (${m.neden || ""})`);
        if (m.degisti) this.onDelege?.(this.delege);
        return;
      }
      if (m.tip !== "sonuc") return;
      this.mesgul = false;
      if (this._kapandi) return;
      this.sonInference = m.sure || this.sonInference;
      if (m.veri) {
        this._sonucSayisi++;
        // Çıkarım süresi EMA'sı (ısınma sonrası): teşhis rozeti + kare boyutu kararı.
        if (this._sonucSayisi > ISINMA_KARE) {
          this.cikarimMs = this.cikarimMs ? this.cikarimMs * 0.9 + (m.sure || 0) * 0.1 : m.sure || 0;
          if (this.cikarimMs > YAVAS_CIKARIM_MS && this.hedefUzunKenar > DUSUK_UZUN_KENAR) {
            this.hedefUzunKenar = DUSUK_UZUN_KENAR;
            console.info(`[MeyveKes] Worker (${this.model}) çıkarım ${this.cikarimMs.toFixed(0)} ms → kare ${DUSUK_UZUN_KENAR} px'e küçültüldü.`);
          }
        }
      }
      // Toplam gecikme = kare yaşı + çıkarım + bir sonraki çizime kadar yarım kare.
      const gecikmeSn = Math.min(0.18, ((m.kareYasi || 0) + (m.sure || 0) + 8) / 1000);
      if (m.veri) {
        this._hicSonucVar = true;
        this._basarisizArtarda = 0;
        this.onSonuc?.(m.veri, gecikmeSn);
      } else if (!this._hicSonucVar && ++this._basarisizArtarda >= 10) {
        // Bu tarayıcıda worker çıkarımı hiç çalışmıyor → canlı yedeğe geç.
        console.warn(`[MeyveKes] Worker (${this.model}) hiç sonuç üretmedi, ana thread'e düşülüyor.`);
        this.kapat();
        this.onYedek?.();
        return;
      }
      // Worker boşaldı: rVFC'yi beklemeden EN TAZE kareyi hemen gönder.
      // Önce hazır (önceden çıkarılmış) bitmap; yoksa son videodan taze kare
      // (aynı kareyse kareGonder currentTime kontrolüyle atlar; rVFC devam eder).
      if (this._kapandi) return;
      if (this._hazirKare) {
        const h = this._hazirKare;
        this._hazirKare = null;
        this._kareYolla(h.kare, Math.max(0, performance.now() - h.yakalama), h.videoZaman);
      } else if (this._hazirlaniyor) {
        // Taze karenin bitmap'i çıkarılmak üzere; bitince kendisi gönderir
        // (burada da göndermek aynı kareyi iki kez işletirdi).
      } else if (this._sonVideo) {
        this.kareGonder(this._sonVideo, Math.max(0, performance.now() - this._sonYakalama), true);
      }
    };
    w.onerror = (e) => {
      console.warn(`[MeyveKes] Worker (${this.model}) hatası:`, e?.message || e);
      this.mesgul = false;
    };
    this.worker = w;
    return true;
  }

  /** Kamera karesini worker'a yollar (meşgulse/aynı kareyse atlar).
   *  icten: sonuç dönüşünden tetiklenen çağrı (son kare bilgisini güncellemez). */
  async kareGonder(video, kareYasi, icten = false) {
    const v = video;
    if (!icten) {
      // rVFC'den gelen her kare (meşgulken bile) kaydedilir: worker boşalınca
      // bu bilgiyle en taze kare hemen gönderilir.
      this._sonVideo = v;
      this._sonYakalama = performance.now() - (kareYasi || 0);
    }
    if (!this.worker || this._kapandi) return;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return;
    if (this.mesgul) {
      // Meşgul: bu taze karenin bitmap'ini ÖNCEDEN çıkar (aynı anda tek hazırlık;
      // yeni kare gelirse eski hazır kare kapatılıp yenisiyle değiştirilir).
      if (icten || this._hazirlaniyor) return;
      const zaten = this._hazirKare ? this._hazirKare.videoZaman : this.sonVideoZaman;
      if (v.currentTime === zaten) return;
      this._hazirlaniyor = true;
      const videoZaman = v.currentTime;
      const yakalama = this._sonYakalama;
      try {
        const kare = await this._bitmapUret(v);
        if (this._kapandi) {
          kare.close?.();
        } else if (!this.mesgul) {
          // Hazırlık bitene kadar worker boşalmış: hemen gönder.
          this._kareYolla(kare, Math.max(0, performance.now() - yakalama), videoZaman);
        } else {
          this._hazirKareKapat();
          this._hazirKare = { kare, yakalama, videoZaman };
        }
      } catch {
        /* bitmap çıkarılamadı — sonraki kare telafi eder */
      } finally {
        this._hazirlaniyor = false;
      }
      return;
    }
    // Aynı video karesini iki kez işlemek boşa CPU yakar.
    if (v.currentTime === this.sonVideoZaman) return;
    const videoZaman = v.currentTime;
    this.sonVideoZaman = videoZaman;
    this.mesgul = true;
    let kare = null;
    try {
      kare = await this._bitmapUret(v);
    } catch {
      this.mesgul = false;
      return;
    }
    this.mesgul = false;
    // sonVideoZaman bu kare için zaten yazıldı (yukarıda) → eşitlik denetimini atla.
    this._kareYolla(kare, kareYasi, videoZaman, true);
  }

  /** Hazır bitmap'i worker'a transfer eder (meşgul bayrağını kaldırır).
   *  zorla: çağıran sonVideoZaman'ı bu kare için zaten ayarladı. */
  _kareYolla(kare, kareYasi, videoZaman, zorla = false) {
    // Aynı kare zaten işlendiyse (yarış: hazırlık bitmeden başka yoldan gitti) atla.
    if (this._kapandi || !this.worker || this.mesgul || (!zorla && videoZaman === this.sonVideoZaman)) {
      try {
        kare.close?.();
      } catch {
        /* yut */
      }
      return;
    }
    this.sonVideoZaman = videoZaman;
    this.mesgul = true;
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

  _hazirKareKapat() {
    if (!this._hazirKare) return;
    try {
      this._hazirKare.kare.close?.();
    } catch {
      /* yut */
    }
    this._hazirKare = null;
  }

  kapat() {
    this._kapandi = true;
    this.mesgul = false;
    this._sonVideo = null;
    this._hazirKareKapat();
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
