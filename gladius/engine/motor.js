// ============================================================
// Oyun motoru: döngü (requestAnimationFrame), canvas boyutlama (DPR),
// girdi yaşam döngüsü. React ArenaPage bunu kurar/yıkar.
// ============================================================

import { MAKS_DT } from "../shared/denge.js";
import { Girdi } from "./girdi.js";
import { createDurum, guncelle } from "./durum.js";
import { ciz } from "./render.js";
import * as ses from "./ses.js";

export class Motor {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.ctx = canvas.getContext("2d");
    this.durum = createDurum(opts);
    this.girdi = new Girdi(canvas);
    this._bitisBildirildi = false;
    this.view = { w: 0, h: 0 };
    this._sonT = 0;
    this._rafId = null;
    this._calisiyor = false;
    this._dongu = this._dongu.bind(this);
    this._boyutla = this._boyutla.bind(this);
  }

  basla() {
    if (this._calisiyor) return;
    this._calisiyor = true;
    this.girdi.baglan();
    window.addEventListener("resize", this._boyutla);
    this._boyutla();
    this._sonT = performance.now();
    this._rafId = requestAnimationFrame(this._dongu);
  }

  dur() {
    this._calisiyor = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.girdi.cozul();
    window.removeEventListener("resize", this._boyutla);
  }

  _boyutla() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 800;
    const cssH = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 600;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.view.w = cssW;
    this.view.h = cssH;
  }

  _dongu(t) {
    if (!this._calisiyor) return;
    let dt = (t - this._sonT) / 1000;
    this._sonT = t;
    if (dt > MAKS_DT) dt = MAKS_DT;   // sekme arkaplandayken büyük sıçramayı engelle

    try {
      guncelle(this.durum, dt, this.girdi);
      ciz(this.ctx, this.durum, this.view);
      // Ses kuyruğunu boşalt (engine'den gelen olaylar).
      const kuyruk = this.durum.sesler;
      if (kuyruk && kuyruk.length) {
        for (const s of kuyruk) ses.cal(s);
        kuyruk.length = 0;
      }
      if (this.durum.bitti && !this._bitisBildirildi) {
        this._bitisBildirildi = true;
        this.opts.onBitti?.(this.durum.kazanan);
      }
    } catch (err) {
      // Döngü içi hata oyunu KALICI dondurmasın: kareyi atla, döngü devam etsin.
      // Aynı hatayı tekrar tekrar loglamamak için bir kez yaz.
      if (!this._hataLoglandi) {
        console.error("[Gladius] motor döngü hatası (döngü sürüyor):", err);
        this._hataLoglandi = true;
      }
    }

    // Hata olsa da olmasa da bir sonraki kareyi daima planla (donma yok).
    if (this._calisiyor) this._rafId = requestAnimationFrame(this._dongu);
  }
}
