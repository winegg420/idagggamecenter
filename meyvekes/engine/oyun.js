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
const KILIC_KALINLIK = 20; // hitbox toleransı (px)
const MIN_SEGMENT = 12; // bu hızın altındaki el hareketi kesmez (px/kare)
const MAX_SEGMENT = 320; // bundan uzun sıçrama = el sırası değişti, sayma
const COMBO_PENCERE = 0.55; // sn
const IZ_OMUR = 0.16; // bıçak izi ömrü (sn)

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
    this.izler = []; // her el için [{x,y,t}] bıçak izi

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
    this._oncekiNoktalar = null; // [{palm:{x,y}, uc:{x,y}, taraf}]
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

  // eller: ElTakip.eller (ham landmark) ; harita: (nx,ny)->{x,y} ekran px
  guncelle(dt, eller, harita, W, H) {
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

    // ---- el noktalarını ekrana taşı + bıçak izi + kesim ----
    const noktalar = [];
    for (let i = 0; i < eller.length; i++) {
      const n = eller[i].noktalar;
      const palm = harita((n[9] || n[0]).x, (n[9] || n[0]).y);
      const uc = harita((n[8] || n[9] || n[0]).x, (n[8] || n[9] || n[0]).y);
      noktalar.push({ palm, uc, taraf: eller[i].taraf });

      // bıçak izi (avuç merkezinden)
      if (!this.izler[i]) this.izler[i] = [];
      this.izler[i].push({ x: palm.x, y: palm.y, t: this._t });
    }
    // fazla iz slotlarını temizle + eski noktaları at
    this.izler.length = Math.max(noktalar.length, 0) || this.izler.length;
    for (const iz of this.izler) {
      if (!iz) continue;
      while (iz.length && this._t - iz[0].t > IZ_OMUR) iz.shift();
    }

    // kesim: yalnız oyun fazında ve el sayısı sabit kaldıysa
    if (this.faz === "oyun" && this._oncekiNoktalar && this._oncekiNoktalar.length === noktalar.length) {
      for (let i = 0; i < noktalar.length; i++) {
        const cur = noktalar[i];
        const onc = this._oncekiNoktalar[i];
        // iki kesim noktası: avuç ve işaret ucu
        for (const par of [
          [onc.palm, cur.palm],
          [onc.uc, cur.uc],
        ]) {
          const [a, b] = par;
          const uz = Math.hypot(b.x - a.x, b.y - a.y);
          if (uz < MIN_SEGMENT || uz > MAX_SEGMENT) continue;
          for (const f of this.meyveler) {
            if (f.kesildi) continue;
            if (segMesafe(f.x, f.y, a.x, a.y, b.x, b.y) < f.r + KILIC_KALINLIK) {
              this._kes(f, cur.taraf, W);
            }
          }
        }
      }
    }
    this._oncekiNoktalar = noktalar;

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
