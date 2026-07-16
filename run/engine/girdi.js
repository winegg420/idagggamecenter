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
    this.sopaBekliyor = false;   // enerji kılıcı (J/Boşluk)
    this.kalkanTus = false;      // kalkan (K)
    this.dashBekliyor = false;   // atılım/dash (Shift/L)
    this.hackTus = false;        // makine ele geçirme (E) — basılı tutulur
    this.kapiBekliyor = false;   // kapıyı kapat (Q)
    this.genelBakisIstek = false; // GENEL BAKIŞ toggle (M)
    this._kd = this._kd.bind(this);
    this._ku = this._ku.bind(this);
    this._pd = this._pd.bind(this);
    this._pm = this._pm.bind(this);
    this._pu = this._pu.bind(this);
    this._ts = this._ts.bind(this);
    this._tm = this._tm.bind(this);
    this._te = this._te.bind(this);
  }

  baglan() {
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
    if (this.hedefEl) {
      // Joystick dokunuşları NATIVE touch olaylarıyla izlenir (iOS Safari çoklu
      // dokunuşta pointer olaylarını güvenilir iletmiyor — Kafa Topu dersi).
      // Pointer olayları yalnız fare/kalem için kalır.
      this.hedefEl.addEventListener("touchstart", this._ts, { passive: false });
      window.addEventListener("touchmove", this._tm, { passive: false });
      window.addEventListener("touchend", this._te);
      window.addEventListener("touchcancel", this._te);
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
      this.hedefEl.removeEventListener("touchstart", this._ts);
      window.removeEventListener("touchmove", this._tm);
      window.removeEventListener("touchend", this._te);
      window.removeEventListener("touchcancel", this._te);
      this.hedefEl.removeEventListener("pointerdown", this._pd);
      window.removeEventListener("pointermove", this._pm);
      window.removeEventListener("pointerup", this._pu);
      window.removeEventListener("pointercancel", this._pu);
    }
    this.sifirla();
  }

  // Basılı durumları temizle (arka plana geçiş/odak kaybında "tuş takılı kaldı" olmasın)
  sifirla() {
    this.tuslar.clear();
    this.jsAktif = false;
    this.jsId = null;
    this.kalkanTus = false;
    this.hackTus = false;
    this.sopaBekliyor = false;
    this.dashBekliyor = false;
    this.kapiBekliyor = false;
    this.genelBakisIstek = false;
  }

  _kd(e) {
    const k = e.key.toLowerCase();
    if (BASLI.has(k)) { this.tuslar.add(k); e.preventDefault(); }
    if (k === "j" || k === " ") { this.sopaBekliyor = true; e.preventDefault(); }
    if (k === "k") this.kalkanTus = true;
    if (k === "shift" || k === "l") { this.dashBekliyor = true; e.preventDefault(); }
    if (k === "e") { this.hackTus = true; e.preventDefault(); }
    if (k === "q") { this.kapiBekliyor = true; e.preventDefault(); }
    if (k === "m") { this.genelBakisIstek = true; e.preventDefault(); }
  }
  _ku(e) {
    const k = e.key.toLowerCase();
    this.tuslar.delete(k);
    if (k === "k") this.kalkanTus = false;
    if (k === "e") this.hackTus = false;
  }
  // Fare/kalem joystick'i (dokunuş native touch'tan gelir — çift saymayı önle)
  _pd(e) { if (e.pointerType === "touch" || this.jsId !== null) return; this.jsId = e.pointerId; this.jsAktif = true; this.jsMerkez = { x: e.clientX, y: e.clientY }; this.jsNokta = { ...this.jsMerkez }; }
  _pm(e) { if (e.pointerType !== "touch" && e.pointerId === this.jsId) this.jsNokta = { x: e.clientX, y: e.clientY }; }
  _pu(e) { if (e.pointerType !== "touch" && e.pointerId === this.jsId) { this.jsId = null; this.jsAktif = false; } }

  // Dokunmatik joystick: identifier takibiyle çoklu parmak güvenli (iOS dahil).
  // "t"+identifier anahtarı pointerId (sayı) ile çakışmaz.
  _ts(e) {
    e.preventDefault();                       // çift dokunuş zoom / kaydırma araya girmesin
    if (this.jsId !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    this.jsId = "t" + t.identifier;
    this.jsAktif = true;
    this.jsMerkez = { x: t.clientX, y: t.clientY };
    this.jsNokta = { ...this.jsMerkez };
  }
  _tm(e) {
    if (this.jsId === null) return;
    for (const t of e.changedTouches) {
      if ("t" + t.identifier === this.jsId) {
        this.jsNokta = { x: t.clientX, y: t.clientY };
        if (e.cancelable) e.preventDefault();
      }
    }
  }
  _te(e) {
    for (const t of e.changedTouches) {
      if ("t" + t.identifier === this.jsId) { this.jsId = null; this.jsAktif = false; }
    }
  }

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
  dashAl() { const v = this.dashBekliyor; this.dashBekliyor = false; return v; }
  kalkanBasiliMi() { return this.kalkanTus; }
  hackBasiliMi() { return this.hackTus; }
  kapiAl() { const v = this.kapiBekliyor; this.kapiBekliyor = false; return v; }
  genelBakisAl() { const v = this.genelBakisIstek; this.genelBakisIstek = false; return v; }
  dokunGenelBakis() { this.genelBakisIstek = true; }
  // Dokunmatik beceri butonları (mobil): tek dokunuşta tetikle.
  dokunSopa() { this.sopaBekliyor = true; }
  dokunDash() { this.dashBekliyor = true; }
  dokunKalkan() { this.kalkanTus = true; setTimeout(() => { this.kalkanTus = false; }, 140); }
  dokunKapi() { this.kapiBekliyor = true; }
  // Hack basılı tutmalı: butonda pointerdown/pointerup ile eşlenir.
  dokunHackBasla() { this.hackTus = true; }
  dokunHackBitir() { this.hackTus = false; }
}
