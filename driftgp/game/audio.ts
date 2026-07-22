// Gerçekçi ses motoru — örnek-tabanlı motor (3 aile × 6 RPM loop, offline-render CC0 WAV) +
// SANAL 6 VİTESLİ ŞANZIMAN (gerçek araç gibi devir iner-çıkar, düz vızıltı değil) +
// turbo ıslığı/blow-off + decel egzoz patlamaları + rüzgar/yol gürültüsü + duvar sürtme +
// hız/kayma duyarlı lastik sesi. Örnekler yüklenemezse prosedürel fallback.

import type { SoundProfile } from './types';

interface ProfileDef {
  /** ateşleme (firing) temel frekansı — rölanti (Hz) — prosedürel fallback için */
  base: number;
  span: number;
  oscType: OscillatorType;
  subRatio: number;
  gain: number;
  rough: number;
  top: number;
  growl: number;
  electric?: boolean;
}

const PROFILES: Record<SoundProfile, ProfileDef> = {
  v8: { base: 46, span: 6.4, oscType: 'sawtooth', subRatio: 0.5, gain: 0.5, rough: 0.55, top: 0.14, growl: 190 },
  v10: { base: 58, span: 6.8, oscType: 'sawtooth', subRatio: 0.5, gain: 0.46, rough: 0.4, top: 0.2, growl: 240 },
  v12: { base: 66, span: 7.2, oscType: 'sawtooth', subRatio: 0.66, gain: 0.44, rough: 0.3, top: 0.24, growl: 300 },
  flat6: { base: 52, span: 6.2, oscType: 'sawtooth', subRatio: 0.5, gain: 0.42, rough: 0.5, top: 0.18, growl: 220 },
  inline6: { base: 50, span: 6.4, oscType: 'sawtooth', subRatio: 0.75, gain: 0.44, rough: 0.32, top: 0.16, growl: 210 },
  inline4: { base: 55, span: 5.8, oscType: 'sawtooth', subRatio: 0.5, gain: 0.36, rough: 0.6, top: 0.22, growl: 260 },
  electric: { base: 210, span: 7.5, oscType: 'sine', subRatio: 2.0, gain: 0.26, rough: 0.0, top: 0.3, growl: 900, electric: true },
};

// Motor ailesi: hangi örnek seti (public/sounds/engine-{aile}0..5.wav)
type EngineFamily = 'muscle' | 'race' | 'sport';
const FAMILY: Record<SoundProfile, EngineFamily | 'electric'> = {
  v8: 'muscle',
  v10: 'race',
  v12: 'race',
  flat6: 'race',
  inline6: 'sport',
  inline4: 'sport',
  electric: 'electric',
};
// per-profil perde çarpanı (aynı aile içinde bile V10 ≠ V12 seslensin)
const RATE_MUL: Record<SoundProfile, number> = {
  v8: 0.86, v10: 1.14, v12: 1.22, flat6: 1.0, inline6: 0.96, inline4: 1.04, electric: 1,
};
// turbo miktarı (ıslık + blow-off şiddeti)
const TURBO: Record<SoundProfile, number> = {
  v8: 0.1, v10: 0, v12: 0, flat6: 0.5, inline6: 0.7, inline4: 1.0, electric: 0,
};
// decel egzoz patlaması (crackle) eğilimi
const CRACKLE: Record<SoundProfile, number> = {
  v8: 1.0, v10: 0.8, v12: 0.6, flat6: 0.9, inline6: 0.5, inline4: 0.7, electric: 0,
};

// Sanal şanzıman: 6 vites — normalize hız (0..1) → vites bandları.
// gearRpm = bant içi konum → motor deviri her viteste 0→redline tarar (gerçek ivmelenme sesi).
const GEAR_EDGES = [0, 0.13, 0.26, 0.41, 0.58, 0.77, 1.001];
const SFX_NAMES = ['drift', 'nitro', 'crash', 'bump', 'scrape', 'glass', 'pop', 'blowoff'] as const;
type SfxName = (typeof SFX_NAMES)[number];

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  // --- prosedürel fallback motor düğümleri ---
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineTop: OscillatorNode | null = null;
  private enginePulse: OscillatorNode | null = null;
  private engineNoiseSrc: AudioBufferSourceNode | null = null;
  private engineNoiseGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGrowl: BiquadFilterNode | null = null;
  // --- SFX loop kanalları ---
  private driftGain: GainNode | null = null;
  private driftSrc: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;
  private scrapeGain: GainNode | null = null;
  private scrapeSrc: AudioBufferSourceNode | null = null;
  // --- rüzgar + yol gürültüsü (hızla açılır) ---
  private windGain: GainNode | null = null;
  private roadGain: GainNode | null = null;
  // --- turbo ---
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private profile: ProfileDef = PROFILES.v8;
  private profileKey: SoundProfile = 'v8';
  private noiseBuffer: AudioBuffer | null = null;
  // örnek motor: aile başına 6 RPM loop'u (lazy yüklenir, cache'lenir)
  private engineSets = new Map<EngineFamily, AudioBuffer[]>();
  private loadingSets = new Set<EngineFamily>();
  private engineSources: AudioBufferSourceNode[] = [];
  private engineGains: GainNode[] = [];
  private engineTune = 1;
  private usingSamples = false;
  private engineRunning = false;
  private lastProfile: SoundProfile = 'v8';
  private lastTune = 0;
  // SFX örnekleri
  private sfx = new Map<SfxName, AudioBuffer>();
  // --- şanzıman durumu ---
  private gear = 0; // 0..5
  private shiftCut = 0; // vites geçişi gaz kesme zarfı (1→0)
  private prevV01 = 0;
  private lastUpdateT = 0;
  private lastPopT = 0;
  enabled = true;
  sirenOn = false;

  /** HUD için: mevcut vites (1..6). */
  get currentGear(): number {
    return this.gear + 1;
  }

  /** Kullanıcı jestinden çağrılmalı (autoplay politikası). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      this.ctx = new AudioContext();
      // master → hafif compressor → çıkış (katmanlar toplanınca kırpılmayı önler, sesi "yapıştırır")
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      this.master.connect(comp).connect(this.ctx.destination);

      this.loadSfx();

      // beyaz gürültü tamponu (prosedürel fallback + rüzgar/yol için)
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.value = 0;
      this.driftGain.connect(this.master);
      this.nitroGain = this.ctx.createGain();
      this.nitroGain.gain.value = 0;
      this.nitroGain.connect(this.master);
      this.scrapeGain = this.ctx.createGain();
      this.scrapeGain.gain.value = 0;
      this.scrapeGain.connect(this.master);

      // rüzgar (orta-tiz hışırtı) + yol (bas uğultu) — hızla update()'te açılır
      const mkNoiseLoop = (type: BiquadFilterType, freq: number, q: number): GainNode => {
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const f = this.ctx!.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.master!);
        src.start();
        return g;
      };
      this.windGain = mkNoiseLoop('bandpass', 950, 0.5);
      this.roadGain = mkNoiseLoop('lowpass', 190, 0.8);
    } catch (err) {
      console.warn('[DidaGP] Ses başlatılamadı:', err);
      this.ctx = null;
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
  }

  /** Motor ailesi örneklerini yükle (lazy, cache'li). */
  private async loadEngineFamily(fam: EngineFamily) {
    if (!this.ctx || this.engineSets.has(fam) || this.loadingSets.has(fam)) return;
    this.loadingSets.add(fam);
    try {
      const bufs = await Promise.all(
        [0, 1, 2, 3, 4, 5].map(async (i) => {
          const res = await fetch(`/sounds/engine-${fam}${i}.wav`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arr = await res.arrayBuffer();
          return await this.ctx!.decodeAudioData(arr);
        }),
      );
      this.engineSets.set(fam, bufs);
      // motor prosedürel modda çalışıyorken örnekler geç geldiyse sample'a geçir (tutarlı ses)
      if (this.engineRunning && !this.usingSamples && FAMILY[this.lastProfile] === fam) {
        this.startEngine(this.lastProfile, this.lastTune);
      }
    } catch (err) {
      console.warn(`[DidaGP] Motor örnekleri (${fam}) yüklenemedi (prosedürele düşülür):`, err);
    } finally {
      this.loadingSets.delete(fam);
    }
  }

  /** SFX örneklerini yükle: drift/nitro/scrape loop + crash/glass/pop/blowoff one-shot. */
  private async loadSfx() {
    if (!this.ctx) return;
    try {
      await Promise.all(
        SFX_NAMES.map(async (name) => {
          const res = await fetch(`/sounds/${name}.wav`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arr = await res.arrayBuffer();
          this.sfx.set(name, await this.ctx!.decodeAudioData(arr));
        }),
      );
      this.setupSfxLoops();
    } catch (err) {
      console.warn('[DidaGP] SFX örnekleri yüklenemedi (prosedürel fallback):', err);
    }
  }

  /** drift + nitro + scrape loop kaynaklarını (gain 0) sürekli çalar başlatır; update() açar. */
  private setupSfxLoops() {
    if (!this.ctx) return;
    const mkLoop = (name: SfxName, gain: GainNode | null): AudioBufferSourceNode | null => {
      const buf = this.sfx.get(name);
      if (!buf || !gain) return null;
      const s = this.ctx!.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(gain);
      s.start();
      return s;
    };
    this.driftSrc = mkLoop('drift', this.driftGain);
    mkLoop('nitro', this.nitroGain);
    this.scrapeSrc = mkLoop('scrape', this.scrapeGain);
  }

  /** tek seferlik örnek çal (rate/gain varyasyonlu) */
  private playOneShot(name: SfxName, gain: number, rate = 1, delay = 0): boolean {
    const buf = this.sfx.get(name);
    if (!this.ctx || !this.master || !buf) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.master);
      src.start(this.ctx.currentTime + delay);
      return true;
    } catch {
      return false;
    }
  }

  /** Gerçek örnek-tabanlı motor: 6 perde loop, RPM ile crossfade + playbackRate. */
  private startSampleEngine(fam: EngineFamily) {
    const ctx = this.ctx!;
    const bufs = this.engineSets.get(fam)!;
    this.usingSamples = true;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 1200;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain).connect(this.master!);
    for (let i = 0; i < 6; i++) {
      const src = ctx.createBufferSource();
      src.buffer = bufs[i];
      src.loop = true;
      src.playbackRate.value = this.engineTune;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.engineFilter);
      src.start();
      this.engineSources.push(src);
      this.engineGains.push(g);
    }
    // turbo ıslığı (profilde turbo varsa) — gain'i update() sürer
    const turboAmt = TURBO[this.profileKey] ?? 0;
    if (turboAmt > 0.05) {
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 900;
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain).connect(this.master!);
      this.turboOsc.start();
    }
  }

  startEngine(profileKey: SoundProfile, tune = 0) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    this.stopEngine();
    this.engineRunning = true;
    this.lastProfile = profileKey;
    this.lastTune = tune;
    this.profileKey = profileKey;
    this.gear = 0;
    this.shiftCut = 0;
    this.prevV01 = 0;
    // her araca özgü ince ayar (perde imzası)
    const base = { ...(PROFILES[profileKey] ?? PROFILES.v8) };
    base.base *= 1 + tune * 0.08;
    base.growl *= 1 + tune * 0.12;
    base.top *= 1 + Math.max(-0.6, tune) * 0.18;
    const p = (this.profile = base);
    this.engineTune = (1 + tune * 0.05) * (RATE_MUL[profileKey] ?? 1);

    const fam = FAMILY[profileKey];
    if (fam !== 'electric') {
      if (this.engineSets.has(fam)) {
        try {
          this.startSampleEngine(fam);
          return;
        } catch (err) {
          console.warn('[DidaGP] Örnek motor hatası, prosedürel:', err);
        }
      } else {
        this.loadEngineFamily(fam); // arka planda yükle; hazır olunca otomatik geçilir
      }
    }
    try {
      const ctx = this.ctx;
      const f0 = p.base;

      this.engineGrowl = ctx.createBiquadFilter();
      this.engineGrowl.type = 'peaking';
      this.engineGrowl.frequency.value = p.growl;
      this.engineGrowl.Q.value = 1.2;
      this.engineGrowl.gain.value = p.electric ? 0 : 9;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 700;
      this.engineFilter.Q.value = 0.9;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter.connect(this.engineGrowl).connect(this.engineGain).connect(this.master);

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = p.oscType;
      this.engineOsc.frequency.value = f0;
      const g1 = ctx.createGain();
      g1.gain.value = 0.6;
      this.engineOsc.connect(g1).connect(this.engineFilter);

      this.engineSub = ctx.createOscillator();
      this.engineSub.type = p.electric ? 'sine' : 'sawtooth';
      this.engineSub.frequency.value = f0 * p.subRatio;
      const g2 = ctx.createGain();
      g2.gain.value = p.electric ? 0.15 : 0.5;
      this.engineSub.connect(g2).connect(this.engineFilter);

      this.engineTop = ctx.createOscillator();
      this.engineTop.type = p.electric ? 'triangle' : 'square';
      this.engineTop.frequency.value = f0 * 2;
      const g3 = ctx.createGain();
      g3.gain.value = p.top;
      this.engineTop.connect(g3).connect(this.engineFilter);

      if (p.rough > 0.01) {
        this.engineNoiseSrc = ctx.createBufferSource();
        this.engineNoiseSrc.buffer = this.noiseBuffer;
        this.engineNoiseSrc.loop = true;
        const nBand = ctx.createBiquadFilter();
        nBand.type = 'bandpass';
        nBand.frequency.value = 340;
        nBand.Q.value = 0.7;
        this.engineNoiseGain = ctx.createGain();
        this.engineNoiseGain.gain.value = p.rough * 0.18;
        this.enginePulse = ctx.createOscillator();
        this.enginePulse.type = 'sawtooth';
        this.enginePulse.frequency.value = f0 * p.subRatio;
        const pulseDepth = ctx.createGain();
        pulseDepth.gain.value = p.rough * 0.16;
        this.enginePulse.connect(pulseDepth).connect(this.engineNoiseGain.gain);
        this.engineNoiseSrc.connect(nBand).connect(this.engineNoiseGain).connect(this.engineFilter);
        this.engineNoiseSrc.start();
        this.enginePulse.start();
      }

      this.engineOsc.start();
      this.engineSub.start();
      this.engineTop.start();
    } catch (err) {
      console.warn('[DidaGP] Motor sesi hatası:', err);
    }
  }

  stopEngine() {
    try {
      this.engineOsc?.stop();
      this.engineSub?.stop();
      this.engineTop?.stop();
      this.enginePulse?.stop();
      this.engineNoiseSrc?.stop();
      this.turboOsc?.stop();
      for (const s of this.engineSources) s.stop();
      this.sirenOsc?.stop();
      this.sirenLfo?.stop();
    } catch {
      /* zaten durmuş */
    }
    this.engineSources = [];
    this.engineGains = [];
    this.usingSamples = false;
    this.engineRunning = false;
    this.engineOsc = this.engineSub = this.engineTop = this.enginePulse = null;
    this.engineNoiseSrc = null;
    this.turboOsc = null;
    this.turboGain = null;
    this.sirenOsc = this.sirenLfo = null;
    this.sirenOn = false;
    // sürüş katmanlarını kapat (yarış bitti/menüye dönüldü)
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.windGain?.gain.setTargetAtTime(0, t, 0.1);
      this.roadGain?.gain.setTargetAtTime(0, t, 0.1);
      this.scrapeGain?.gain.setTargetAtTime(0, t, 0.05);
      this.driftGain?.gain.setTargetAtTime(0, t, 0.05);
      this.nitroGain?.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  /**
   * Her frame çağrılır.
   * @param v01      normalize hız (0..1, hız/topSpeed)
   * @param drifting drift yapıyor mu
   * @param nitro    nitro basılı mı
   * @param extra    slip: kayma açısı (0..~1), wall: duvara sürtüyor mu
   */
  update(v01: number, drifting: boolean, nitro: boolean, extra?: { slip?: number; wall?: boolean }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dt = Math.min(0.1, Math.max(0.001, t - this.lastUpdateT));
    this.lastUpdateT = t;
    const v = Math.max(0, Math.min(1, v01));
    const p = this.profile;
    const electric = !!p.electric;
    const slip = Math.max(0, Math.min(1, extra?.slip ?? 0));

    // --- sanal şanzıman: hız bandı → vites + bant içi devir (elektrikli hariç) ---
    let engineRpm: number;
    if (electric) {
      engineRpm = v;
    } else {
      // vites seçimi (histerezisli — bant sınırında titremesin)
      while (this.gear < 5 && v > GEAR_EDGES[this.gear + 1] + 0.004) {
        this.gear++;
        this.onShift(1, v);
      }
      while (this.gear > 0 && v < GEAR_EDGES[this.gear] - 0.012) {
        this.gear--;
        this.onShift(-1, v);
      }
      const lo = GEAR_EDGES[this.gear];
      const hi = GEAR_EDGES[this.gear + 1];
      const gearPos = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      engineRpm = 0.14 + 0.86 * gearPos; // rölanti tabanı + redline tavanı
      // vites geçişi gaz kesme zarfı (kısa dip → gerçek şanzıman hissi)
      this.shiftCut = Math.max(0, this.shiftCut - dt / 0.15);
    }
    const cutMul = 1 - 0.62 * this.shiftCut;

    // --- decel egzoz patlamaları (crackle): hız düşerken + devir yüksekken ---
    const dvdt = (v - this.prevV01) / dt;
    this.prevV01 = v;
    const crackleAmt = CRACKLE[this.profileKey] ?? 0;
    if (!electric && crackleAmt > 0 && dvdt < -0.035 && engineRpm > 0.42 && t - this.lastPopT > 0.09) {
      if (Math.random() < Math.min(0.9, -dvdt * 10) * crackleAmt * dt * 22) {
        this.lastPopT = t;
        this.playOneShot('pop', 0.1 + Math.random() * 0.14, 0.75 + Math.random() * 0.55);
      }
    }

    // --- örnek motor: 6 loop RPM crossfade + playbackRate ---
    if (this.usingSamples && this.engineGain && this.engineFilter) {
      const rate = this.engineTune * (0.8 + engineRpm * 0.62 + (nitro ? 0.05 : 0));
      for (let i = 0; i < this.engineGains.length; i++) {
        const center = i / 5;
        const w = Math.max(0, 1 - Math.abs(engineRpm - center) * 4.5);
        this.engineGains[i].gain.setTargetAtTime(w * cutMul, t, 0.05);
        this.engineSources[i]?.playbackRate.setTargetAtTime(rate, t, 0.06);
      }
      this.engineFilter.frequency.setTargetAtTime(850 + engineRpm * 5200 + (nitro ? 900 : 0), t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.62 * (0.3 + engineRpm * 0.7) * cutMul, t, 0.05);
      // turbo ıslığı: devirle yükselen ince ıslık
      if (this.turboGain && this.turboOsc) {
        const amt = TURBO[this.profileKey] ?? 0;
        this.turboOsc.frequency.setTargetAtTime(850 + engineRpm * 2700, t, 0.08);
        this.turboGain.gain.setTargetAtTime(amt * engineRpm * engineRpm * 0.045 * cutMul, t, 0.08);
      }
    } else if (this.engineOsc && this.engineGain && this.engineFilter) {
      // prosedürel fallback — şanzıman devri burada da uygulanır
      const f = p.base * (1 + engineRpm * p.span);
      const smooth = 0.05;
      this.engineOsc.frequency.setTargetAtTime(f, t, smooth);
      this.engineSub?.frequency.setTargetAtTime(f * p.subRatio, t, smooth);
      this.engineTop?.frequency.setTargetAtTime(f * 2, t, smooth);
      this.enginePulse?.frequency.setTargetAtTime(f * p.subRatio, t, smooth);
      this.engineFilter.frequency.setTargetAtTime(500 + engineRpm * 3200 + (nitro ? 900 : 0), t, 0.08);
      this.engineGrowl?.frequency.setTargetAtTime(p.growl * (1 + engineRpm * 0.8), t, 0.1);
      this.engineGain.gain.setTargetAtTime(p.gain * (0.22 + engineRpm * 0.78) * cutMul, t, 0.07);
    }

    // --- lastik sesi: hız + kayma duyarlı (sabit loop değil) ---
    if (this.driftSrc) this.driftSrc.playbackRate.setTargetAtTime(0.88 + v * 0.3, t, 0.1);
    const skidGain = drifting ? 0.26 + slip * 0.28 + v * 0.1 : 0;
    this.driftGain?.gain.setTargetAtTime(skidGain, t, drifting ? 0.04 : 0.14);
    this.nitroGain?.gain.setTargetAtTime(nitro ? 0.35 : 0, t, 0.06);

    // --- duvar sürtme (sürekli temas) ---
    const scraping = !!extra?.wall && v > 0.05;
    if (this.scrapeSrc) this.scrapeSrc.playbackRate.setTargetAtTime(0.85 + v * 0.45, t, 0.1);
    this.scrapeGain?.gain.setTargetAtTime(scraping ? Math.min(0.5, 0.14 + v * 0.5) : 0, t, scraping ? 0.03 : 0.08);

    // --- rüzgar + yol gürültüsü: hızla belirginleşir (hız hissi) ---
    this.windGain?.gain.setTargetAtTime(v * v * 0.34 + (nitro ? 0.06 : 0), t, 0.12);
    this.roadGain?.gain.setTargetAtTime(v * 0.2, t, 0.12);
  }

  /** vites değişim yan etkileri: gaz kesme + turbo blow-off + egzoz pop */
  private onShift(dir: 1 | -1, v: number) {
    this.shiftCut = dir === 1 ? 1 : 0.45; // düşürmede daha kısa kesinti (rev-match blip)
    if (!this.ctx) return;
    const turboAmt = TURBO[this.profileKey] ?? 0;
    if (dir === 1) {
      if (turboAmt > 0.3) this.playOneShot('blowoff', turboAmt * (0.24 + v * 0.2), 0.9 + Math.random() * 0.25, 0.02);
      // güçlü motorlarda upshift'te tek egzoz pat'ı
      if ((CRACKLE[this.profileKey] ?? 0) > 0.7 && Math.random() < 0.5) {
        this.playOneShot('pop', 0.12, 0.7 + Math.random() * 0.3, 0.04);
      }
    }
  }

  crash(intensity = 1) {
    if (!this.ctx || !this.master) return;
    const vol = Math.max(0.15, Math.min(1, intensity));
    // örnek: rate varyasyonu (her çarpışma farklı tınlar) + sert darbede cam kırılması katmanı
    // gain 1.3x — çarpışma sürüş katmanlarının üzerinde NET duyulmalı (compressor kırpılmayı önler)
    if (this.playOneShot('crash', vol * 1.3, 0.85 + Math.random() * 0.3)) {
      if (intensity > 0.55) this.playOneShot('glass', (intensity - 0.55) * 1.5, 0.9 + Math.random() * 0.2, 0.015);
      return;
    }
    if (!this.noiseBuffer) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const thud = ctx.createBufferSource();
      thud.buffer = this.noiseBuffer;
      const thudF = ctx.createBiquadFilter();
      thudF.type = 'lowpass';
      thudF.frequency.value = 260;
      const thudG = ctx.createGain();
      thudG.gain.setValueAtTime(0.6 * intensity, t);
      thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      thud.connect(thudF).connect(thudG).connect(this.master);
      thud.start(t, Math.random() * 0.5, 0.24);
      for (const [freq, dur, amp] of [[1250, 0.18, 0.32], [2100, 0.13, 0.22]] as const) {
        const ring = ctx.createBufferSource();
        ring.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq * (0.9 + Math.random() * 0.2);
        bp.Q.value = 9;
        const rg = ctx.createGain();
        rg.gain.setValueAtTime(amp * intensity, t);
        rg.gain.exponentialRampToValueAtTime(0.001, t + dur);
        ring.connect(bp).connect(rg).connect(this.master);
        ring.start(t, Math.random() * 0.5, dur);
      }
    } catch {
      /* yoksay */
    }
  }

  /**
   * Araç-araç gövde darbesi — duvar crash'inden FARKLI: daha tok, düşük "whump" + kısa gövde
   * sürtmesi. Yüksek-Q çınlama YOK. Gerçek-zamanlı prosedürel, şiddetle (0..1) ölçeklenir.
   */
  bump(intensity = 0.5) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const vol = Math.max(0.12, Math.min(1, intensity));
    // örnek-tabanlı gövde darbesi (offline render, sub ağırlıklı) — rate varyasyonlu;
    // sert temaslar crash karakterine yaklaşsın diye 0.6+ şiddette crash katmanı eklenir
    if (this.playOneShot('bump', vol * 1.25, 0.88 + Math.random() * 0.28)) {
      if (intensity > 0.6) this.playOneShot('crash', (intensity - 0.6) * 1.1, 1.05 + Math.random() * 0.2, 0.01);
      return;
    }
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const thud = ctx.createBufferSource();
      thud.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 170;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      thud.connect(lp).connect(g).connect(this.master);
      thud.start(t, Math.random() * 0.4, 0.18);
      const body = ctx.createBufferSource();
      body.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = 1.1;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.4 * vol, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      body.connect(bp).connect(bg).connect(this.master);
      body.start(t, Math.random() * 0.4, 0.12);
    } catch {
      /* yoksay */
    }
  }

  beep(freq: number, dur = 0.18) {
    if (!this.ctx || !this.master) return;
    try {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      /* yoksay */
    }
  }

  toggleSiren(): boolean {
    if (!this.ctx || !this.master) return false;
    if (this.sirenOn) {
      try {
        this.sirenOsc?.stop();
        this.sirenLfo?.stop();
      } catch {
        /* zaten durmuş */
      }
      this.sirenOsc = this.sirenLfo = null;
      this.sirenOn = false;
      return false;
    }
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 800;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 1.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.12;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
      this.sirenOn = true;
      return true;
    } catch {
      return false;
    }
  }
}

export const audio = new AudioManager();
