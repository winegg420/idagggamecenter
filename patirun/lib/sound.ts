// Prosedürel ses motoru — WebAudio sentezi, harici asset yok.
// Ayarlardan müzik/efekt ayrı ayrı kapatılabilir.

type Waveform = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  musicEnabled = true;
  sfxEnabled = true;

  /** İlk kullanıcı etkileşiminde çağrılmalı (tarayıcı autoplay kuralı) */
  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.12;
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.35;
        this.sfxGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    opts: {
      type?: Waveform;
      volume?: number;
      slideTo?: number;
      delay?: number;
      music?: boolean;
    } = {},
  ): void {
    if (!this.sfxEnabled && !opts.music) return;
    if (!this.musicEnabled && opts.music) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain || !this.musicGain) return;
    try {
      const t0 = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type ?? 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), t0 + duration);
      gain.gain.setValueAtTime(opts.volume ?? 0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(opts.music ? this.musicGain : this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      // ses çalınamazsa oyun devam eder
    }
  }

  // ---- Efektler ----
  click(): void {
    this.tone(600, 0.06, { type: 'sine', volume: 0.3 });
  }

  pickup(): void {
    this.tone(700, 0.08, { type: 'square', volume: 0.35 });
    this.tone(1050, 0.1, { type: 'square', volume: 0.35, delay: 0.07 });
  }

  boost(): void {
    this.tone(200, 0.5, { type: 'sawtooth', volume: 0.4, slideTo: 900 });
  }

  shield(): void {
    this.tone(500, 0.25, { type: 'sine', volume: 0.4, slideTo: 800 });
  }

  obstaclePlace(): void {
    this.tone(220, 0.12, { type: 'square', volume: 0.4 });
  }

  lightning(): void {
    this.tone(1400, 0.3, { type: 'sawtooth', volume: 0.5, slideTo: 100 });
  }

  knockback(): void {
    this.tone(300, 0.3, { type: 'square', volume: 0.5, slideTo: 80 });
  }

  splash(): void {
    // Suya giriş: kısa beyaz-gürültü hissi (hızlı düşen çift ton)
    this.tone(900, 0.12, { type: 'sawtooth', volume: 0.3, slideTo: 200 });
    this.tone(500, 0.2, { type: 'sine', volume: 0.3, slideTo: 120, delay: 0.04 });
  }

  magnet(): void {
    // Aşağı kayan "çekim" vınlaması + tık
    this.tone(700, 0.4, { type: 'sawtooth', volume: 0.42, slideTo: 180 });
    this.tone(350, 0.15, { type: 'square', volume: 0.35, delay: 0.32 });
  }

  golden(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone(f, 0.35, { type: 'triangle', volume: 0.45, delay: i * 0.09 });
    });
  }

  blocked(): void {
    this.tone(400, 0.15, { type: 'sine', volume: 0.4, slideTo: 500 });
  }

  /** İsabet onayı: SENİN saldırın tuttuğunda çalan tatmin edici çift çınlama */
  hitConfirm(): void {
    this.tone(880, 0.07, { type: 'triangle', volume: 0.4 });
    this.tone(1320, 0.12, { type: 'triangle', volume: 0.4, delay: 0.06 });
  }

  /** Kapan yere kurulurken metalik yay gerilmesi */
  trapSet(): void {
    this.tone(160, 0.1, { type: 'square', volume: 0.4 });
    this.tone(520, 0.08, { type: 'square', volume: 0.3, slideTo: 700, delay: 0.09 });
  }

  /**
   * HELİKOPTER — tamamen özgün, prosedürel pervane sesi (hiçbir klip kopyası
   * DEĞİL). Alçak testere + hızlanan çırpma (AM/LFO) + uğultu + tiz vınlama.
   */
  helicopter(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    try {
      const t0 = ctx.currentTime;
      const dur = 2.8;
      // Ana zarf: hızlı yol al (spin-up), sonda sön
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.linearRampToValueAtTime(0.9, t0 + 0.3);
      master.gain.setValueAtTime(0.9, t0 + dur - 0.5);
      master.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      master.connect(this.sfxGain);

      // Pervane gövdesi: alçak testere + çırpma (LFO ile genlik modülasyonu)
      const rotor = ctx.createOscillator();
      rotor.type = 'sawtooth';
      rotor.frequency.setValueAtTime(46, t0);
      const chop = ctx.createGain();
      chop.gain.setValueAtTime(0.45, t0); // taban (tam sessizlik olmasın)
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.setValueAtTime(7.5, t0); // "thwop thwop"
      lfo.frequency.linearRampToValueAtTime(13.5, t0 + 1.4); // hızlanan pervane
      lfo.frequency.setValueAtTime(13.5, t0 + dur);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.42;
      lfo.connect(lfoDepth);
      lfoDepth.connect(chop.gain);
      rotor.connect(chop);
      chop.connect(master);

      // Motor uğultusu (üçgen) + tiz türbin vınlaması (testere, yükselen)
      const eng = ctx.createOscillator();
      eng.type = 'triangle';
      eng.frequency.setValueAtTime(66, t0);
      const engGain = ctx.createGain();
      engGain.gain.value = 0.2;
      eng.connect(engGain);
      engGain.connect(master);

      const whir = ctx.createOscillator();
      whir.type = 'sawtooth';
      whir.frequency.setValueAtTime(130, t0);
      whir.frequency.linearRampToValueAtTime(220, t0 + 1.1);
      const whirGain = ctx.createGain();
      whirGain.gain.value = 0.1;
      whir.connect(whirGain);
      whirGain.connect(master);

      const oscs = [rotor, lfo, eng, whir];
      oscs.forEach((o) => o.start(t0));
      oscs.forEach((o) => o.stop(t0 + dur + 0.05));
    } catch {
      // ses çalınamazsa oyun devam eder
    }
  }

  /** Karakter "ah/of" sesi — karakterin ses perdesiyle */
  ouch(pitch: number): void {
    this.tone(pitch * 1.6, 0.12, { type: 'triangle', volume: 0.5, slideTo: pitch * 0.7 });
  }

  jump(): void {
    this.tone(320, 0.15, { type: 'sine', volume: 0.3, slideTo: 550 });
  }

  countdownBeep(final: boolean): void {
    this.tone(final ? 880 : 440, final ? 0.4 : 0.15, { type: 'square', volume: 0.4 });
  }

  checkpoint(): void {
    this.tone(880, 0.1, { type: 'sine', volume: 0.35 });
    this.tone(1174, 0.14, { type: 'sine', volume: 0.35, delay: 0.08 });
  }

  finish(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
      this.tone(f, 0.22, { type: 'triangle', volume: 0.5, delay: i * 0.12 });
    });
  }

  // ---- Müzik (basit prosedürel döngü) ----
  private static MENU_NOTES = [261, 329, 392, 329, 293, 349, 440, 349];
  private static RACE_NOTES = [329, 392, 494, 392, 349, 440, 523, 440, 329, 415, 494, 415];

  startMusic(kind: 'menu' | 'race'): void {
    this.stopMusic();
    if (!this.musicEnabled) return;
    const notes = kind === 'menu' ? SoundEngine.MENU_NOTES : SoundEngine.RACE_NOTES;
    const stepMs = kind === 'menu' ? 420 : 250;
    this.musicStep = 0;
    const tick = () => {
      const note = notes[this.musicStep % notes.length];
      this.tone(note, stepMs / 1000 + 0.05, { type: 'triangle', volume: 0.5, music: true });
      if (this.musicStep % 2 === 0) {
        this.tone(note / 2, stepMs / 1000, { type: 'sine', volume: 0.35, music: true });
      }
      this.musicStep += 1;
    };
    tick();
    this.musicTimer = window.setInterval(tick, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (!on) this.stopMusic();
  }

  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
  }
}

export const sound = new SoundEngine();
