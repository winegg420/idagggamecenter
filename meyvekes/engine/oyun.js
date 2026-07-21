// ============================================================
// MEYVE KES — oyun mantığı (durum makinesi + fizik + kesim algılama)
// Faz akışı: geri (3-2-1) → oyun (60 sn) → bitti.
// Meyveler alttan fırlar, yerçekimiyle düşer. El (avuç + işaret ucu)
// bir önceki kareden bu kareye çizdiği çizgi meyvenin hitbox'ıyla
// kesişirse meyve "kesilir". Ceza yok — amaç eğlence.
// ============================================================

import { rastgeleMeyve } from "./meyveler.js";

const YERCEKIMI = 1500; // px/s²
const MAC_SURESI = 60;
const KILIC_KALINLIK = 30; // hitbox toleransı (px) — cömert: kesmek kolay olsun
const MIN_SEGMENT = 9; // bu hareketin altındaki el kesmez (statik el sayılmaz)
const MAX_ORAN = 0.75; // kesim segmenti köşegenin bu oranını aşarsa sayma (sahte/geçiş)
// Eşleştirme cömert: hızlı savurmada avuç uzağa sıçrar ama yine aynı el sayılmalı.
// Gerçekte iki farklı el birbirine bu kadar yaklaşıp uzaklaşmaz; absürt bağlantıları
// zaten MAX_ORAN kesim segmentinde eler (uzun segment kesmez).
const ESLESME_ORAN = 0.9;
const COMBO_PENCERE = 0.55; // sn
const IZ_OMUR = 0.2; // bıçak izi ömrü (sn)
// Kesim/iz için el üzerinden örneklenen noktalar: bilek, 5 parmak ucu, avuç.
// Böylece tüm el/bilek bir "bıçak" gibi davranır (tek nokta değil).
const KESIM_NOKTA = [0, 4, 8, 12, 16, 20, 9];

// Nokta–doğru parçası mesafesi.
function segMesafe(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export class Oyun {
  constructor(mod) {
    this.mod = mod === "arkadas" ? "arkadas" : "tekli";
    this.meyveler = [];
    this.yarilar = []; // kesilmiş yarımlar
    this.parcaciklar = [];
    this.popuplar = []; // uçan puan metinleri
    this.izler = []; // render için: her takip edilen el için [{x,y,t}] bıçak izi
    this._takip = []; // kimlik eşleştirmeli el takibi
    this._sonDamga = -1; // en son işlenen algılama karesi

    this.puan = 0;
    this.puanSol = 0;
    this.puanSag = 0;
    this.kesimSayisi = 0;
    this.combo = 0;
    this._comboZaman = -10;

    this.faz = "geri";
    this.geriSayim = 3;
    this.sure = MAC_SURESI;
    this._spawnZaman = 0.4;
    this._t = 0;
  }

  get bitti() {
    return this.faz === "bitti";
  }

  // spawn aralığı (moda + zamana göre). Arkadaş modu daha yoğun.
  _spawnAralik() {
    const gecen = MAC_SURESI - this.sure;
    const zorluk = Math.min(1, gecen / 45); // ilk 45 sn'de artan tempo
    if (this.mod === "arkadas") return 0.62 - 0.22 * zorluk; // 0.62 → 0.40
    return 0.95 - 0.30 * zorluk; // 0.95 → 0.65
  }

  _meyveFirlat(W, H) {
    const m = rastgeleMeyve();
    const r = m.r;
    const kenar = 60;
    const x = kenar + Math.random() * (W - 2 * kenar);
    // Tepeye yakın çıkacak kadar yukarı hız.
    const hedef = H * (0.62 + Math.random() * 0.28);
    const vy = -Math.sqrt(2 * YERCEKIMI * hedef);
    // Ekran ortasına doğru hafif yönelim (kenardan fırlayan içeri gelsin).
    const merkezYon = (W / 2 - x) / (W / 2);
    const vx = merkezYon * 120 + (Math.random() - 0.5) * 260;
    this.meyveler.push({
      meyve: m,
      x,
      y: H + r,
      vx,
      vy,
      r,
      aci: Math.random() * Math.PI * 2,
      donHiz: (Math.random() - 0.5) * 4,
    });
  }

  _kes(f, taraf, W) {
    f.kesildi = true;
    this.kesimSayisi++;

    // combo
    if (this._t - this._comboZaman < COMBO_PENCERE) this.combo++;
    else this.combo = 1;
    this._comboZaman = this._t;

    const temel = f.meyve.altin ? 5 : 1;
    const bonus = this.combo >= 3 ? this.combo - 2 : 0;
    const kazanc = temel + bonus;
    this.puan += kazanc;
    const kesenTaraf = taraf || (f.x < W / 2 ? "sol" : "sag");
    if (kesenTaraf === "sol") this.puanSol += kazanc;
    else this.puanSag += kazanc;

    // uçan puan metni
    this.popuplar.push({
      metin: bonus > 0 ? `COMBO x${this.combo}  +${kazanc}` : `+${kazanc}`,
      x: f.x,
      y: f.y,
      renk: bonus > 0 ? "#ffd21f" : f.meyve.renk,
      omur: bonus > 0 ? 1.1 : 0.7,
      t: 0,
      buyuk: bonus > 0 || f.meyve.altin,
    });

    // iki yarım
    const ayr = 130;
    for (const yon of [-1, 1]) {
      this.yarilar.push({
        meyve: f.meyve,
        yari: yon < 0 ? "ust" : "alt",
        x: f.x,
        y: f.y,
        vx: f.vx + yon * ayr,
        vy: f.vy - 60,
        r: f.r,
        aci: f.aci,
        donHiz: yon * 3,
        alfa: 1,
      });
    }

    // splat parçacıkları
    const adet = f.meyve.altin ? 20 : 12;
    for (let i = 0; i < adet; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = 120 + Math.random() * 320;
      this.parcaciklar.push({
        x: f.x,
        y: f.y,
        vx: Math.cos(a) * h,
        vy: Math.sin(a) * h - 80,
        r: 3 + Math.random() * 5,
        renk: f.meyve.renk,
        omur: 0.5 + Math.random() * 0.4,
        t: 0,
      });
    }
  }

  // Algılanan elleri önceki karedeki ellere kimlikle eşleştirir (en yakın avuç),
  // her el için 7 anahtar noktadan segment çizip meyvelerle kesişimi test eder.
  // Kimlik eşleştirme sayesinde hızlı/uzun savurmalar reddedilmez (el geçişi değil).
  _elleriIsle(eller, harita, W, H) {
    const diag = Math.hypot(W, H);
    const maxSeg = diag * MAX_ORAN;
    const eslesmeMax = diag * ESLESME_ORAN;

    const guncel = eller.map((e) => {
      const pts = KESIM_NOKTA.map((idx) => {
        const n = e.noktalar[idx] || e.noktalar[9] || e.noktalar[0];
        return harita(n.x, n.y);
      });
      const palm = pts[6] || pts[0]; // KESIM_NOKTA'da 9 (avuç) → 7. eleman
      return { pts, palm, taraf: palm.x < W / 2 ? "sol" : "sag" };
    });

    const kullanildi = new Array(this._takip.length).fill(false);
    const yeni = [];

    for (const g of guncel) {
      let enIyi = -1;
      let enMesafe = eslesmeMax;
      for (let j = 0; j < this._takip.length; j++) {
        if (kullanildi[j]) continue;
        const d = Math.hypot(this._takip[j].palm.x - g.palm.x, this._takip[j].palm.y - g.palm.y);
        if (d < enMesafe) {
          enMesafe = d;
          enIyi = j;
        }
      }
      if (enIyi >= 0) {
        const onc = this._takip[enIyi];
        kullanildi[enIyi] = true;
        if (this.faz === "oyun") {
          for (let k = 0; k < g.pts.length; k++) {
            const a = onc.pts[k];
            const b = g.pts[k];
            if (!a) continue;
            const uz = Math.hypot(b.x - a.x, b.y - a.y);
            if (uz < MIN_SEGMENT || uz > maxSeg) continue;
            for (const f of this.meyveler) {
              if (f.kesildi) continue;
              if (segMesafe(f.x, f.y, a.x, a.y, b.x, b.y) < f.r + KILIC_KALINLIK) {
                this._kes(f, g.taraf, W);
              }
            }
          }
        }
        onc.pts = g.pts;
        onc.palm = g.palm;
        onc.taraf = g.taraf;
        onc.iz.push({ x: g.palm.x, y: g.palm.y, t: this._t });
        onc.gorulen = this._t;
        yeni.push(onc);
      } else {
        yeni.push({
          pts: g.pts,
          palm: g.palm,
          taraf: g.taraf,
          iz: [{ x: g.palm.x, y: g.palm.y, t: this._t }],
          gorulen: this._t,
        });
      }
    }

    // eşleşmeyen eski elleri izleri tazeyken koru (iz sönene dek), sonra düşür
    for (let j = 0; j < this._takip.length; j++) {
      if (kullanildi[j]) continue;
      const h = this._takip[j];
      while (h.iz.length && this._t - h.iz[0].t > IZ_OMUR) h.iz.shift();
      if (h.iz.length) yeni.push(h);
    }

    this._takip = yeni;
  }

  // eller: ElTakip.eller (ham landmark) ; damga: algılama kare no (yeni veri işareti)
  // harita: (nx,ny)->{x,y} ekran px
  guncelle(dt, eller, damga, harita, W, H) {
    dt = Math.min(dt, 0.05); // büyük sıçramaları sınırla (sekme arası)
    this._t += dt;

    // ---- faz makinesi ----
    if (this.faz === "geri") {
      this.geriSayim -= dt;
      if (this.geriSayim <= 0) {
        this.faz = "oyun";
        this.sure = MAC_SURESI;
      }
    } else if (this.faz === "oyun") {
      this.sure -= dt;
      this._spawnZaman -= dt;
      if (this._spawnZaman <= 0) {
        const kac = this.mod === "arkadas" ? 1 + ((Math.random() * 2.4) | 0) : 1 + ((Math.random() * 1.6) | 0);
        for (let i = 0; i < kac; i++) this._meyveFirlat(W, H);
        this._spawnZaman = this._spawnAralik() * (0.8 + Math.random() * 0.4);
      }
      if (this.sure <= 0) {
        this.sure = 0;
        this.faz = "bitti";
      }
    }

    // ---- el takibi + bıçak izi + kesim (yalnız YENİ algılama karesinde) ----
    // Algılama ~15-25 fps; render 60 fps. Aynı algılama verisiyle tekrar kesim
    // işlemek anlamsız ve yanlış (segment ~0). damga değişince bir kez işle.
    if (damga !== this._sonDamga) {
      this._sonDamga = damga;
      this._elleriIsle(eller, harita, W, H);
    }
    // izleri her karede (zamanla) süz
    for (const h of this._takip) {
      while (h.iz.length && this._t - h.iz[0].t > IZ_OMUR) h.iz.shift();
    }
    this.izler = this._takip.map((h) => h.iz);

    // ---- fizik: meyveler ----
    for (const f of this.meyveler) {
      f.vy += YERCEKIMI * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.aci += f.donHiz * dt;
    }
    this.meyveler = this.meyveler.filter((f) => !f.kesildi && f.y < H + f.r * 2.5);

    // ---- fizik: yarımlar ----
    for (const y of this.yarilar) {
      y.vy += YERCEKIMI * dt;
      y.x += y.vx * dt;
      y.y += y.vy * dt;
      y.aci += y.donHiz * dt;
      if (y.y > H + y.r) y.alfa -= dt * 2;
    }
    this.yarilar = this.yarilar.filter((y) => y.alfa > 0 && y.y < H + y.r * 3);

    // ---- parçacıklar ----
    for (const p of this.parcaciklar) {
      p.t += dt;
      p.vy += YERCEKIMI * 0.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parcaciklar = this.parcaciklar.filter((p) => p.t < p.omur);

    // ---- popuplar ----
    for (const pp of this.popuplar) {
      pp.t += dt;
      pp.y -= 60 * dt;
    }
    this.popuplar = this.popuplar.filter((pp) => pp.t < pp.omur);
  }
}
