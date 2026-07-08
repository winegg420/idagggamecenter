// ============================================================
// Girdi yönetimi: klavye (WASD/oklar) + dokunmatik sanal joystick.
// Tasarım 8.1: mobil dokunma hedefleri baştan düşünülür.
// Kullanım: g = new Girdi(el); g.baglan(); ... g.hareketVektoru(); g.cozul();
// ============================================================

const BASLI = new Set([
  "arrowup", "arrowdown", "arrowleft", "arrowright",
  "w", "a", "s", "d",
]);

export class Girdi {
  constructor(hedefEl) {
    this.hedefEl = hedefEl;        // dokunmatik joystick için (genelde canvas)
    this.tuslar = new Set();
    // Dövüş girdisi
    this.saldiriBekliyor = false;  // kenar-tetikli (bir vuruş isteği)
    this.kalkanTus = false;        // klavye kalkan basılı
    this.kalkanDokun = false;      // dokunmatik kalkan basılı
    // Sanal joystick durumu
    this.jsAktif = false;
    this.jsMerkez = { x: 0, y: 0 };
    this.jsNokta = { x: 0, y: 0 };
    this.jsId = null;

    this._keyDown = this._keyDown.bind(this);
    this._keyUp = this._keyUp.bind(this);
    this._pointerDown = this._pointerDown.bind(this);
    this._pointerMove = this._pointerMove.bind(this);
    this._pointerUp = this._pointerUp.bind(this);
  }

  baglan() {
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
    if (this.hedefEl) {
      this.hedefEl.addEventListener("pointerdown", this._pointerDown);
      window.addEventListener("pointermove", this._pointerMove);
      window.addEventListener("pointerup", this._pointerUp);
      window.addEventListener("pointercancel", this._pointerUp);
    }
  }

  cozul() {
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
    if (this.hedefEl) {
      this.hedefEl.removeEventListener("pointerdown", this._pointerDown);
      window.removeEventListener("pointermove", this._pointerMove);
      window.removeEventListener("pointerup", this._pointerUp);
      window.removeEventListener("pointercancel", this._pointerUp);
    }
    this.tuslar.clear();
    this.jsAktif = false;
  }

  _keyDown(e) {
    const k = e.key.toLowerCase();
    if (BASLI.has(k)) {
      this.tuslar.add(k);
      e.preventDefault();
    }
    // Saldırı: J veya Boşluk. Kalkan: K veya Shift (basılı tut).
    if (k === "j" || k === " ") {
      this.saldiriBekliyor = true;
      e.preventDefault();
    }
    if (k === "k" || k === "shift") {
      this.kalkanTus = true;
    }
  }

  _keyUp(e) {
    const k = e.key.toLowerCase();
    this.tuslar.delete(k);
    if (k === "k" || k === "shift") this.kalkanTus = false;
  }

  // Bir vuruş isteğini tüket (kenar-tetikli).
  saldiriAl() {
    const v = this.saldiriBekliyor;
    this.saldiriBekliyor = false;
    return v;
  }

  kalkanBasiliMi() {
    return this.kalkanTus || this.kalkanDokun;
  }

  // Dokunmatik arayüz butonları için.
  dokunSaldiri() {
    this.saldiriBekliyor = true;
  }

  dokunKalkan(basili) {
    this.kalkanDokun = basili;
  }

  _pointerDown(e) {
    if (this.jsId !== null) return;
    this.jsId = e.pointerId;
    this.jsAktif = true;
    this.jsMerkez = { x: e.clientX, y: e.clientY };
    this.jsNokta = { x: e.clientX, y: e.clientY };
  }

  _pointerMove(e) {
    if (e.pointerId !== this.jsId) return;
    this.jsNokta = { x: e.clientX, y: e.clientY };
  }

  _pointerUp(e) {
    if (e.pointerId !== this.jsId) return;
    this.jsId = null;
    this.jsAktif = false;
  }

  // Normalize edilmiş hareket vektörü {x, y} (uzunluk 0..1). Klavye + joystick birleşik.
  hareketVektoru() {
    let x = 0;
    let y = 0;

    if (this.tuslar.has("arrowleft") || this.tuslar.has("a")) x -= 1;
    if (this.tuslar.has("arrowright") || this.tuslar.has("d")) x += 1;
    if (this.tuslar.has("arrowup") || this.tuslar.has("w")) y -= 1;
    if (this.tuslar.has("arrowdown") || this.tuslar.has("s")) y += 1;

    if (this.jsAktif) {
      const dx = this.jsNokta.x - this.jsMerkez.x;
      const dy = this.jsNokta.y - this.jsMerkez.y;
      const uz = Math.hypot(dx, dy);
      const OLU_BOLGE = 8;    // px
      const MAKS = 60;        // px — tam hız yarıçapı
      if (uz > OLU_BOLGE) {
        const g = Math.min(uz, MAKS) / MAKS;
        x += (dx / uz) * g;
        y += (dy / uz) * g;
      }
    }

    const uz = Math.hypot(x, y);
    if (uz > 1) {
      x /= uz;
      y /= uz;
    }
    return { x, y };
  }
}
