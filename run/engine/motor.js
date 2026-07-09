// ============================================================
// RUN — motor: döngü (rAF), DPR canvas boyutlama, girdi yaşam döngüsü.
// (Gladius motor deseninin RUN uyarlaması; takip kamerası durum.js'te.)
// ============================================================

import { MAKS_DT } from "./sabitler.js";
import { Girdi } from "./girdi.js";
import { createDurum, guncelle } from "./durum.js";
import { ciz } from "./render.js";
import * as ses from "./ses.js";

// Mobil dokunsal geri bildirim (ms desenleri) — destek yoksa sessizce atlanır
const TITRESIM = { yakalandi: [90, 50, 90], yakala: 45, sopa: 25, ates: 35, kacti: [30, 30, 60], sersem: 60 };

export class Motor {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.ctx = canvas.getContext("2d");
    this.durum = createDurum(opts);
    this.girdi = new Girdi(canvas);
    this.view = { w: 0, h: 0 };
    this._sonT = 0;
    this._rafId = null;
    this._calisiyor = false;
    this._bitisBildirildi = false;
    this._hataLoglandi = false;
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
    const cssW = this.canvas.clientWidth || 800;
    const cssH = this.canvas.clientHeight || 600;
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
    if (dt > MAKS_DT) dt = MAKS_DT;
    try {
      // GENEL BAKIŞ toggle (M / buton)
      if (this.girdi.genelBakisAl()) this.durum.genelBakis = !this.durum.genelBakis;
      guncelle(this.durum, dt, this.girdi);
      ciz(this.ctx, this.durum, this.view);
      // Sanal joystick görseli (dokunmatik) — render okur
      this.durum.jsGorsel = this.girdi.jsAktif
        ? { mx: this.girdi.jsMerkez.x, my: this.girdi.jsMerkez.y, nx: this.girdi.jsNokta.x, ny: this.girdi.jsNokta.y }
        : null;
      // Ses kuyruğunu boşalt (olay sesleri) + mobil titreşim
      const kuyruk = this.durum.sesler;
      if (kuyruk && kuyruk.length) {
        for (const s of kuyruk) {
          ses.cal(s);
          try { if (navigator.vibrate && TITRESIM[s]) navigator.vibrate(TITRESIM[s]); } catch {}
        }
        kuyruk.length = 0;
      }
      // Drone yakınlık vızıltısı (izlenen oyuncuya en yakın drone); round bitince söner
      const izlenen = this.durum.oyuncular.find((s) => s.id === this.durum.izlenenId) || this.durum.oyuncular[0];
      let enYakin = Infinity;
      if (!this.durum.bitti) {
        for (const dr of this.durum.droneler || []) enYakin = Math.min(enYakin, Math.hypot(izlenen.x - dr.x, izlenen.y - dr.y));
      }
      ses.droneYakinlik(enYakin);
      if (this.durum.bitti && !this._bitisBildirildi) {
        this._bitisBildirildi = true;
        this.opts.onBitti?.(this.durum.sonuc);
      }
    } catch (err) {
      if (!this._hataLoglandi) { console.error("[RUN] döngü hatası (döngü sürüyor):", err); this._hataLoglandi = true; }
    }
    if (this._calisiyor) this._rafId = requestAnimationFrame(this._dongu);
  }
}
