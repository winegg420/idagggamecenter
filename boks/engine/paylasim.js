// ============================================================
// GÖLGE BOKS — paylaşım kartı + en iyi combo klibi
//
// KART: 1080×1920 (Instagram Story) canvas'ta, oyunun "Gece Antrenmanı"
// paletiyle çizilir; Web Share API varsa doğrudan paylaşılır, yoksa PNG olarak
// indirilir. Tamamen istemci tarafında üretilir (sunucuya görsel gönderilmez).
//
// KLİP: en iyi combo anında `MediaRecorder` ile canvas akışından kısa bir WebM
// klip kaydedilir — harici kütüphane yok. Tarayıcı desteklemiyorsa klip
// sessizce atlanır, kart yine üretilir.
// ============================================================

import { RENK } from "./render.js";

// ---------------- Story kartı ----------------
function yuvarlakDikdortgen(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function afisFont(boyut, agirlik = 900) {
  return `${agirlik} ${boyut}px 'Bebas Neue', Impact, 'Arial Narrow', system-ui, sans-serif`;
}

/**
 * Paylaşım kartını çizer ve blob döndürür.
 * @param {object} v { ad, puan, yumruk, isabetYuzde, combo, kalori, kaloriTahmini,
 *                     stil, dovuscu, benzerlik, mod, zorluk, seriGun }
 */
export async function kartUret(v) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  // arka plan
  ctx.fillStyle = RENK.arka;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.32, 60, W / 2, H * 0.32, W * 0.95);
  g.addColorStop(0, "rgba(255,77,61,0.20)");
  g.addColorStop(1, "rgba(20,16,15,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // üst başlık
  ctx.textAlign = "center";
  ctx.fillStyle = RENK.darbe;
  ctx.font = afisFont(46);
  ctx.fillText("GÖLGE BOKS", W / 2, 150);
  ctx.fillStyle = RENK.dim;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText("QUIZADOR", W / 2, 200);

  // oyuncu
  ctx.fillStyle = RENK.metin;
  ctx.font = afisFont(84);
  ctx.fillText((v.ad || "Oyuncu").toUpperCase(), W / 2, 320);
  ctx.fillStyle = RENK.dim;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`${v.mod || ""} · ${v.zorluk || ""}`.toUpperCase(), W / 2, 372);

  // puan bloğu
  ctx.fillStyle = RENK.yuzey;
  yuvarlakDikdortgen(ctx, 90, 430, W - 180, 260, 32);
  ctx.fill();
  ctx.fillStyle = RENK.odul;
  ctx.font = afisFont(170);
  ctx.fillText(String(v.puan ?? 0), W / 2, 610);
  ctx.fillStyle = RENK.dim;
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillText("PUAN", W / 2, 660);

  // istatistik ızgarası
  const kutular = [
    { ad: "YUMRUK", deger: String(v.yumruk ?? 0), renk: RENK.metin },
    { ad: "İSABET", deger: `%${v.isabetYuzde ?? 0}`, renk: RENK.analiz },
    { ad: "EN İYİ SERİ", deger: String(v.combo ?? 0), renk: RENK.darbe },
    {
      ad: v.kaloriTahmini ? "KALORİ (TAHMİNİ)" : "KALORİ",
      deger: String(v.kalori ?? 0),
      renk: RENK.odul,
    },
  ];
  const kw = (W - 220) / 2;
  const kh = 190;
  kutular.forEach((k, i) => {
    const x = 90 + (i % 2) * (kw + 40);
    const y = 740 + Math.floor(i / 2) * (kh + 30);
    ctx.fillStyle = RENK.yuzey;
    yuvarlakDikdortgen(ctx, x, y, kw, kh, 26);
    ctx.fill();
    ctx.fillStyle = k.renk;
    ctx.font = afisFont(76);
    ctx.fillText(k.deger, x + kw / 2, y + 108);
    ctx.fillStyle = RENK.dim;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(k.ad, x + kw / 2, y + 150);
  });

  // stil + dövüşçü eşleşmesi
  let y = 740 + 2 * (kh + 30) + 40;
  if (v.stil) {
    ctx.fillStyle = RENK.analiz;
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText("STİL PROFİLİ", W / 2, y);
    ctx.fillStyle = RENK.metin;
    ctx.font = afisFont(58);
    ctx.fillText(v.stil.toUpperCase(), W / 2, y + 66);
    y += 130;
  }
  if (v.dovuscu) {
    ctx.fillStyle = RENK.yuzey;
    yuvarlakDikdortgen(ctx, 90, y, W - 180, 190, 28);
    ctx.fill();
    ctx.fillStyle = RENK.dim;
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText("STİLİN EN ÇOK BENZEDİĞİ DÖVÜŞÇÜ", W / 2, y + 52);
    ctx.fillStyle = RENK.odul;
    ctx.font = afisFont(62);
    ctx.fillText(v.dovuscu.toUpperCase(), W / 2, y + 122);
    if (v.benzerlik != null) {
      ctx.fillStyle = RENK.dim;
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillText(`%${v.benzerlik} stil benzerliği`, W / 2, y + 162);
    }
    y += 230;
  }

  if (v.seriGun) {
    ctx.fillStyle = RENK.darbe;
    ctx.font = afisFont(44);
    ctx.fillText(`🔥 ${v.seriGun} GÜNLÜK SERİ`, W / 2, y + 40);
  }

  // alt bilgi
  ctx.fillStyle = RENK.dim;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("tr-TR"), W / 2, H - 90);
  ctx.fillStyle = RENK.metin;
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("Sen de kameranı aç, gölge boksuna başla", W / 2, H - 50);

  return await new Promise((cozumle) => c.toBlob((b) => cozumle(b), "image/png", 0.92));
}

/** Kartı paylaşır (Web Share API) ya da indirir. */
export async function kartPaylas(v) {
  try {
    const blob = await kartUret(v);
    if (!blob) throw new Error("Kart üretilemedi");
    const dosya = new File([blob], "golge-boks.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [dosya] })) {
      await navigator.share({
        files: [dosya],
        title: "Gölge Boks",
        text: `${v.puan} puan · ${v.yumruk} yumruk · %${v.isabetYuzde} isabet`,
      });
      return { ok: true, yol: "paylasildi" };
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "golge-boks.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, yol: "indirildi" };
  } catch (e) {
    // Kullanıcı paylaşımı iptal ettiyse hata değildir.
    if (e?.name === "AbortError") return { ok: false, iptal: true };
    console.error("[Boks] Paylaşım hatası:", e);
    return { ok: false, hata: e?.message || String(e) };
  }
}

// ---------------- en iyi combo klibi ----------------
export class KlipKaydedici {
  constructor() {
    this.kaydedici = null;
    this.parcalar = [];
    this.blob = null;
    this.comboEsik = 0;
    this._zaman = null;
  }

  get destekleniyor() {
    return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined";
  }

  /** Combo eşiği aşıldığında çağrılır: kısa klip kaydeder (öncekini değiştirir). */
  baslat(canvas, sureSn = 4, combo = 0) {
    if (!this.destekleniyor || !canvas || this.kaydedici) return false;
    // Daha iyi bir combo gelmediyse yeniden kaydetme.
    if (combo <= this.comboEsik) return false;
    try {
      // AKICILIK (2026-08-15): klip TAM DA en yoğun anda (seri ≥5) başlıyor ve
      // canvas'ı canlı kodlamaya alıyor. VP9 yazılım kodlaması mobilde poz
      // çıkarımıyla aynı çekirdekleri yiyip görünür takılma yapıyordu; üstelik
      // 30 fps × 2.5 Mbps bir paylaşım klibi için fazlasıyla yüksek.
      // VP8 tercih ediliyor (donanım/optimize yol çok daha yaygın), yakalama
      // 24 fps, bit hızı 1.2 Mbps — klip kalitesi paylaşım için hâlâ fazlasıyla
      // yeterli, oyun ise akmaya devam ediyor.
      const akis = canvas.captureStream(24);
      const secenek = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 1200000 }
        : MediaRecorder.isTypeSupported("video/webm")
          ? { mimeType: "video/webm", videoBitsPerSecond: 1200000 }
          : {};
      const kayit = new MediaRecorder(akis, secenek);
      this.parcalar = [];
      kayit.ondataavailable = (e) => {
        if (e.data && e.data.size) this.parcalar.push(e.data);
      };
      kayit.onstop = () => {
        try {
          this.blob = new Blob(this.parcalar, { type: "video/webm" });
        } catch {
          this.blob = null;
        }
        this.kaydedici = null;
      };
      kayit.start();
      this.kaydedici = kayit;
      this.comboEsik = combo;
      this._zaman = setTimeout(() => this.durdur(), sureSn * 1000);
      return true;
    } catch (e) {
      console.warn("[Boks] Klip kaydı başlatılamadı:", e?.message || e);
      this.kaydedici = null;
      return false;
    }
  }

  durdur() {
    if (this._zaman) clearTimeout(this._zaman);
    this._zaman = null;
    try {
      if (this.kaydedici && this.kaydedici.state !== "inactive") this.kaydedici.stop();
    } catch {
      this.kaydedici = null;
    }
  }

  /** Klibi paylaşır/indirir. */
  async paylas() {
    if (!this.blob) return { ok: false, yok: true };
    try {
      const dosya = new File([this.blob], "golge-boks-combo.webm", { type: "video/webm" });
      if (navigator.canShare?.({ files: [dosya] })) {
        await navigator.share({ files: [dosya], title: "Gölge Boks — en iyi serim" });
        return { ok: true, yol: "paylasildi" };
      }
      const url = URL.createObjectURL(this.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "golge-boks-combo.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, yol: "indirildi" };
    } catch (e) {
      if (e?.name === "AbortError") return { ok: false, iptal: true };
      return { ok: false, hata: e?.message || String(e) };
    }
  }

  temizle() {
    this.durdur();
    this.blob = null;
    this.parcalar = [];
    this.comboEsik = 0;
  }
}
