// ============================================================
// RUN — girdi: klavye (WASD/oklar) + dokunmatik joystick + skill tuşları.
// (Gladius girdi deseninin RUN uyarlaması.)
// ============================================================

const BASLI = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);

export class Girdi {
  constructor(hedefEl) {
    this.hedefEl = hedefEl;
    this.tuslar = new Set();
    this.jsAktif = false;
    this.jsMerkez = { x: 0, y: 0 };
    this.jsNokta = { x: 0, y: 0 };
    this.jsId = null;
    this.sopaBekliyor = false;   // beyzbol sopası (J/Boşluk)
    this.kalkanTus = false;      // kalkan (K/Shift)
    this.genelBakisIstek = false; // GENEL BAKIŞ toggle (M)
    this._kd = this._kd.bind(this);
    this._ku = this._ku.bind(this);
    this._pd = this._pd.bind(this);
    this._pm = this._pm.bind(this);
    this._pu = this._pu.bind(this);
  }

  baglan() {
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
    if (this.hedefEl) {
      this.hedefEl.addEventListener("pointerdown", this._pd);
      window.addEventListener("pointermove", this._pm);
      window.addEventListener("pointerup", this._pu);
      window.addEventListener("pointercancel", this._pu);
    }
  }

  cozul() {
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
    if (this.hedefEl) {
      this.hedefEl.removeEventListener("pointerdown", this._pd);
      window.removeEventListener("pointermove", this._pm);
      window.removeEventListener("pointerup", this._pu);
      window.removeEventListener("pointercancel", this._pu);
    }
    this.tuslar.clear();
    this.jsAktif = false;
  }

  _kd(e) {
    const k = e.key.toLowerCase();
    if (BASLI.has(k)) { this.tuslar.add(k); e.preventDefault(); }
    if (k === "j" || k === " ") { this.sopaBekliyor = true; e.preventDefault(); }
    if (k === "k" || k === "shift") this.kalkanTus = true;
    if (k === "m") { this.genelBakisIstek = true; e.preventDefault(); }
  }
  _ku(e) {
    const k = e.key.toLowerCase();
    this.tuslar.delete(k);
    if (k === "k" || k === "shift") this.kalkanTus = false;
  }
  _pd(e) { if (this.jsId !== null) return; this.jsId = e.pointerId; this.jsAktif = true; this.jsMerkez = { x: e.clientX, y: e.clientY }; this.jsNokta = { ...this.jsMerkez }; }
  _pm(e) { if (e.pointerId === this.jsId) this.jsNokta = { x: e.clientX, y: e.clientY }; }
  _pu(e) { if (e.pointerId === this.jsId) { this.jsId = null; this.jsAktif = false; } }

  hareketVektoru() {
    let x = 0, y = 0;
    if (this.tuslar.has("arrowleft") || this.tuslar.has("a")) x -= 1;
    if (this.tuslar.has("arrowright") || this.tuslar.has("d")) x += 1;
    if (this.tuslar.has("arrowup") || this.tuslar.has("w")) y -= 1;
    if (this.tuslar.has("arrowdown") || this.tuslar.has("s")) y += 1;
    if (this.jsAktif) {
      const dx = this.jsNokta.x - this.jsMerkez.x, dy = this.jsNokta.y - this.jsMerkez.y;
      const uz = Math.hypot(dx, dy);
      if (uz > 8) { const g = Math.min(uz, 60) / 60; x += (dx / uz) * g; y += (dy / uz) * g; }
    }
    const uz = Math.hypot(x, y);
    if (uz > 1) { x /= uz; y /= uz; }
    return { x, y };
  }

  sopaAl() { const v = this.sopaBekliyor; this.sopaBekliyor = false; return v; }
  kalkanBasiliMi() { return this.kalkanTus; }
  genelBakisAl() { const v = this.genelBakisIstek; this.genelBakisIstek = false; return v; }
  dokunGenelBakis() { this.genelBakisIstek = true; }
  // Dokunmatik beceri butonları (mobil): tek dokunuşta tetikle.
  dokunSopa() { this.sopaBekliyor = true; }
  dokunKalkan() { this.kalkanTus = true; setTimeout(() => { this.kalkanTus = false; }, 140); }
}
