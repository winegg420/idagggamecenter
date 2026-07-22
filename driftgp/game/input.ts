// Girdi yöneticisi: gyro (mobil) + klavye (masaüstü test) + dokunmatik butonlar.

import type { CarInput } from './types';

class InputManager {
  private keys = new Set<string>();
  private touchBrake = false;
  private touchDrift = false;
  private touchNitro = false;
  /** ekran yön butonları: -1 sol, +1 sağ, 0 nötr */
  private touchSteer = 0;
  /** buton direksiyonu için yumuşatılmış değer (ani -1/+1 yerine kademeli) */
  private steerSmooth = 0;

  /** aktif direksiyon yöntemi (store ile senkron) */
  controlMode: 'buttons' | 'tilt' = 'buttons';

  gyroAvailable = false;
  gyroEnabled = false;
  /** ham eğim (derece) — kalibrasyon ekranı canlı gösterim için */
  rawTilt = 0;
  /** son deviceorientation olayının zamanı — gyro gerçekten veri gönderiyor mu kontrolü */
  lastTiltAt = 0;
  private tiltOffset = 0;
  /** tam kilit için gereken eğim (derece) — düşük = daha hassas */
  private maxTilt = 18;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    if (typeof DeviceOrientationEvent !== 'undefined') {
      this.gyroAvailable = true;
    }
  }

  /** iOS izin akışı dahil gyro dinleyicisini başlatır. Kullanıcı jestinden çağrılmalı. */
  async enableGyro(): Promise<boolean> {
    if (!this.gyroAvailable) return false;
    try {
      const doe = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof doe.requestPermission === 'function') {
        const res = await doe.requestPermission();
        if (res !== 'granted') return false;
      }
      window.addEventListener('deviceorientation', this.onOrientation);
      this.gyroEnabled = true;
      return true;
    } catch (err) {
      console.warn('[DidaGP] Gyro izni alınamadı:', err);
      return false;
    }
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    this.lastTiltAt = performance.now();
    // Landscape'te direksiyon ekseni beta'dır; yön ekran rotasyonuna bağlı.
    const angle =
      (screen.orientation && typeof screen.orientation.angle === 'number'
        ? screen.orientation.angle
        : (window as unknown as { orientation?: number }).orientation) ?? 0;
    // İşaret: telefonu direksiyon gibi sağa yatır → araç sağa. (Ekran normal/düz, ters ayna değil.)
    if (angle === 90) this.rawTilt = -e.beta;
    else if (angle === 270 || angle === -90) this.rawTilt = e.beta;
    else this.rawTilt = e.gamma; // portre fallback
  };

  /** gyro son 1 sn içinde gerçekten veri gönderdi mi (izin verildiği halde olay gelmeme durumu) */
  gyroLive(): boolean {
    return this.gyroEnabled && performance.now() - this.lastTiltAt < 1000;
  }

  setTouchSteer(v: number) {
    this.touchSteer = v;
  }

  /** Mevcut duruşu "düz" kabul et. */
  calibrate() {
    this.tiltOffset = this.rawTilt;
  }

  setTouchBrake(v: boolean) {
    this.touchBrake = v;
  }
  setTouchDrift(v: boolean) {
    this.touchDrift = v;
  }
  setTouchNitro(v: boolean) {
    this.touchNitro = v;
  }

  read(): CarInput {
    let steer = 0;
    // Öncelik: klavye (masaüstü) > dokunmatik yön butonu > gyro. Buton ve gyro AYNI ANDA aktif;
    // butona basılıyken buton kazanır, bırakınca telefon eğme devreye girer.
    let kb = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kb -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kb += 1;

    if (kb !== 0) {
      steer = kb;
      this.steerSmooth = kb;
    } else {
      // ekran yön butonları — ani -1/+1 yerine kademeli yumuşatma (daha kontrollü his)
      const target = this.touchSteer;
      this.steerSmooth += (target - this.steerSmooth) * 0.25;
      if (Math.abs(this.steerSmooth) < 0.02 && target === 0) this.steerSmooth = 0;
      const buttonActive = target !== 0 || Math.abs(this.steerSmooth) > 0.02;
      if (buttonActive) {
        steer = this.steerSmooth;
      } else if (this.gyroEnabled && this.gyroLive()) {
        // telefon eğme (buton kullanılmıyorken)
        const t = (this.rawTilt - this.tiltOffset) / this.maxTilt;
        let g = Math.max(-1, Math.min(1, t));
        if (Math.abs(g) < 0.06) g = 0; // dead zone (küçük titreşim)
        steer = g;
      }
    }

    const brake = this.touchBrake || this.keys.has('s') || this.keys.has('arrowdown');
    const drift = this.touchDrift || this.keys.has(' ');
    const nitro = this.touchNitro || this.keys.has('shift');
    return { steer, throttle: 1, brake, drift, nitro };
  }
}

export const inputManager = new InputManager();
