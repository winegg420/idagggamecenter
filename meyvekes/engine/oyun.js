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
const KILIC_KALINLIK = 34; // hitbox toleransı (px) — cömert: kesmek kolay olsun
const MIN_SEGMENT = 6; // bu hareketin altındaki el kesmez (statik el sayılmaz)
const MAX_ORAN = 1.05; // kesim segmenti köşegenin bu oranını aşarsa sayma (sahte/geçiş)
// Eşleştirme cömert: hızlı savurmada avuç uzağa sıçrar ama yine aynı el sayılmalı.
// Gerçekte iki farklı el birbirine bu kadar yaklaşıp uzaklaşmaz; absürt bağlantıları
// zaten MAX_ORAN kesim segmentinde eler (uzun segment kesmez).
const ESLESME_ORAN = 0.9;
const COMBO_PENCERE = 0.55; // sn
const IZ_OMUR = 0.3; // bıçak izi ömrü (sn) — Fruit Ninja hissi
// Bıçak izi YALNIZ el hareket ederken üretilir. Nokta ekleme kararı HIZA bakar
// (kareler arası mesafeye değil): el bu hızın üstündeyse her ÇİZİM karesinde
// (60 fps) nokta eklenir → algılama 12 fps'e düşse bile iz akıcı ve kesintisiz
// görünür. El dururken hiç nokta eklenmez → ekranda iz kalmaz.
const IZ_HIZ_ESIK = 90; // px/s
const IZ_MIN_ARALIK = 1.2; // px — aynı noktayı üst üste eklemeyi engeller
const IZ_MAKS_NOKTA = 26;

// ---- MEYVE YE modu (ağızla yutma) ----
// Ağız açıklığı = dikey iç dudak açıklığı / ağız genişliği (yüz uzaklığından
// bağımsız oran). Histerezis: bir kez açıldıktan sonra daha düşük eşikte kapanır
// (titreme olmasın, yutma anı kaçmasın).
const AGIZ_AC = 0.3;
const AGIZ_KAPA = 0.2;
const AGIZ_YUT_ORAN = 0.85; // yutma yarıçapı = ağız genişliği × bu (cömert)
const AGIZ_CEKIM = 0.22; // yutulan meyvenin ağza akma süresi (sn)

// ---- KILIÇ: el + kol tek parça dev bıçak ----
// MediaPipe yalnız eli verir; kolu bilek→avuç ekseninin TERSİNE uzatarak
// türetiyoruz (dirsek o yönde olur). Böylece "el ve kolun tamamı bıçak":
// kabza omuz tarafında, uç parmakların ötesinde.
const KOL_ORAN = 3.4; // el boyunun katı — bilekten geriye (kol/kabza)
const UC_ORAN = 1.35; // el boyunun katı — orta parmak ucundan ileri (bıçak ucu)
const KILIC_ORNEK = 9; // kılıç gövdesinde kesim için örneklenen nokta sayısı
const PARMAK_UC = [4, 8, 12, 16, 20];
// Bu hızın üstünde savururken kılıç GÖVDESİ de keser (agresif savurmada
// kareler arası boşluğa düşen meyve kaçmasın — "hızlı kesemiyorum" düzeltmesi).
const SUPURME_HIZ = 360; // px/s
const TELAFI_MAX_PX = 100; // gecikme telafisinin tavanı (px)
const RENDER_ILERI_MAX = 0.05; // sn — çizimde ileri sarma tavanı

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

// El landmark'larından (ekran px) kılıç geometrisi: kuyruk (kol) → uç (bıçak).
function kilicHesap(tum) {
  const bilek = tum[0] || tum[9];
  const mcp = tum[9] || tum[0];
  const ortaUc = tum[12] || mcp;
  let dx = mcp.x - bilek.x;
  let dy = mcp.y - bilek.y;
  let boy = Math.hypot(dx, dy);
  if (!(boy > 1)) {
    dx = 0;
    dy = -1;
    boy = 40;
  } else {
    dx /= boy;
    dy /= boy;
  }
  return {
    kuyruk: { x: bilek.x - dx * boy * KOL_ORAN, y: bilek.y - dy * boy * KOL_ORAN },
    uc: { x: ortaUc.x + dx * boy * UC_ORAN, y: ortaUc.y + dy * boy * UC_ORAN },
    boy,
  };
}

// Kılıç gövdesi boyunca eşit aralıklı örnekler + parmak uçları.
// İndeksler kareler arası tutarlıdır (aynı indeks = aynı fiziksel nokta).
function kesimNoktalari(kilic, tum) {
  const pts = [];
  const { kuyruk, uc } = kilic;
  for (let i = 0; i < KILIC_ORNEK; i++) {
    const t = i / (KILIC_ORNEK - 1);
    pts.push({ x: kuyruk.x + (uc.x - kuyruk.x) * t, y: kuyruk.y + (uc.y - kuyruk.y) * t });
  }
  for (const idx of PARMAK_UC) {
    const n = tum[idx];
    pts.push(n ? { x: n.x, y: n.y } : { x: uc.x, y: uc.y });
  }
  return pts;
}

// El geometrisinin tamamını (landmark + kılıç + kesim noktaları) ötele.
function oteleEl(g, kx, ky) {
  for (const p of g.tum) {
    p.x += kx;
    p.y += ky;
  }
  for (const p of g.pts) {
    p.x += kx;
    p.y += ky;
  }
  g.kilic.kuyruk.x += kx;
  g.kilic.kuyruk.y += ky;
  g.kilic.uc.x += kx;
  g.kilic.uc.y += ky;
  // palm, tum[9]'un ta kendisi (referans) → yeniden ötelenmez.
}

export class Oyun {
  constructor(mod) {
    this.mod = mod === "arkadas" || mod === "yeme" ? mod : "tekli";
    this.meyveler = [];
    this.yarilar = []; // kesilmiş yarımlar
    this.parcaciklar = [];
    this.popuplar = []; // uçan puan metinleri
    this.slashlar = []; // kesim anı beyaz flaş çizgisi
    this.dalgalar = []; // kesim anı halka dalgası
    this.yutulanlar = []; // MEYVE YE: ağza doğru akan meyve
    this.sarsinti = 0; // ekran titremesi (px) — kesimde yükselir, hızla söner
    this.sesler = []; // çalınacak ses olayları (OyunPage boşaltır; motor DOM'suz)
    this.agiz = null; // MEYVE YE: ekran uzayında ağız { x, y, r, acik, oran }
    this.izler = []; // render için: her takip edilen el için [{x,y,t}] bıçak izi
    this.eller = []; // render için: ekran uzayında el+kılıç geometrisi
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
    // Agresif savurma oynanışı için yoğun akış (boşta kalan kılıç sıkıcı).
    if (this.mod === "arkadas") return 0.52 - 0.20 * zorluk; // 0.52 → 0.32
    // Yeme modunda meyve ağza doğru gelir; yutmaya vakit kalsın diye biraz seyrek.
    if (this.mod === "yeme") return 0.95 - 0.35 * zorluk; // 0.95 → 0.60
    return 0.80 - 0.30 * zorluk; // 0.80 → 0.50
  }

  _meyveFirlat(W, H) {
    const m = rastgeleMeyve();
    const r = m.r;
    const kenar = 60;
    const x = kenar + Math.random() * (W - 2 * kenar);

    // ---- MEYVE YE: meyve ağza NİŞAN ALARAK fırlatılır ----
    // Balistik çözüm: T sn sonra tam hedefte olacak hız. Böylece meyve ağzın
    // hizasından geçer; oyuncunun tek işi doğru anda ağzını açmak.
    if (this.mod === "yeme") {
      const hx = (this.agiz ? this.agiz.x : W / 2) + (Math.random() - 0.5) * W * 0.34;
      const hy = (this.agiz ? this.agiz.y : H * 0.38) + (Math.random() - 0.5) * 40;
      const T = 1.05 + Math.random() * 0.45;
      const x0 = Math.max(kenar, Math.min(W - kenar, hx + (Math.random() - 0.5) * W * 0.5));
      const y0 = H + r;
      this.meyveler.push({
        meyve: m,
        x: x0,
        y: y0,
        vx: (hx - x0) / T,
        vy: (hy - y0 - 0.5 * YERCEKIMI * T * T) / T,
        r,
        aci: Math.random() * Math.PI * 2,
        donHiz: (Math.random() - 0.5) * 4,
      });
      return;
    }

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

  // Ortak puanlama + combo + uçan metin (kesme ve yeme aynı kuralı paylaşır).
  _puanla(f, taraf, W) {
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

    this.popuplar.push({
      metin: bonus > 0 ? `COMBO x${this.combo}  +${kazanc}` : `+${kazanc}`,
      x: f.x,
      y: f.y,
      renk: bonus > 0 ? "#ffd21f" : f.meyve.renk,
      omur: bonus > 0 ? 1.1 : 0.7,
      t: 0,
      buyuk: bonus > 0 || f.meyve.altin,
    });
    if (bonus > 0) this.sesler.push("combo");
    return kazanc;
  }

  // MEYVE YE: ağız açıkken temas eden meyve yutulur.
  _ye(f, W) {
    f.kesildi = true;
    this.kesimSayisi++;
    this._puanla(f, f.x < W / 2 ? "sol" : "sag", W);
    this.sesler.push(f.meyve.altin ? "altin" : "yut");
    this.sarsinti = Math.min(12, this.sarsinti + (f.meyve.altin ? 7 : 3.5));

    // meyve ağza doğru büzülerek akar
    this.yutulanlar.push({
      meyve: f.meyve,
      x: f.x,
      y: f.y,
      hx: this.agiz ? this.agiz.x : f.x,
      hy: this.agiz ? this.agiz.y : f.y,
      r: f.r,
      t: 0,
      omur: AGIZ_CEKIM,
    });

    // ağız çevresinde küçük şıpırtı
    const adet = f.meyve.altin ? 16 : 9;
    for (let i = 0; i < adet; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = 80 + Math.random() * 200;
      this.parcaciklar.push({
        x: f.x,
        y: f.y,
        vx: Math.cos(a) * h,
        vy: Math.sin(a) * h - 60,
        r: 2 + Math.random() * 4,
        renk: f.meyve.renk,
        omur: 0.35 + Math.random() * 0.3,
        t: 0,
      });
    }
    this.dalgalar.push({ x: f.x, y: f.y, r0: f.r * 0.7, t: 0, omur: 0.28, altin: !!f.meyve.altin });
  }

  _kes(f, taraf, W, yonX = 1, yonY = 0) {
    f.kesildi = true;
    this.kesimSayisi++;
    this._puanla(f, taraf, W);
    this.sesler.push(f.meyve.altin ? "altin" : "kes");
    // kesim geri bildirimi: ekran sarsıntısı + kesim yönünde flaş + halka dalga
    this.sarsinti = Math.min(16, this.sarsinti + (f.meyve.altin ? 8 : 4));
    this.slashlar.push({
      x: f.x,
      y: f.y,
      aci: Math.atan2(yonY, yonX),
      uz: f.r * 3.6,
      t: 0,
      omur: 0.2,
      altin: !!f.meyve.altin,
    });
    this.dalgalar.push({ x: f.x, y: f.y, r0: f.r * 0.8, t: 0, omur: 0.3, altin: !!f.meyve.altin });

    // iki yarım — kesim çizgisine DİK yönde ayrılır (bıçak nereden geçtiyse oradan)
    const kesimAci = Math.atan2(yonY, yonX);
    const nx = -Math.sin(kesimAci);
    const ny = Math.cos(kesimAci);
    const ayr = 130;
    for (const yon of [-1, 1]) {
      this.yarilar.push({
        meyve: f.meyve,
        yari: yon < 0 ? "ust" : "alt",
        x: f.x,
        y: f.y,
        vx: f.vx + nx * yon * ayr,
        vy: f.vy + ny * yon * ayr - 60,
        r: f.r,
        aci: f.aci,
        kesimAci,
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
  _elleriIsle(eller, harita, W, H, telafiSn) {
    const diag = Math.hypot(W, H);
    const maxSeg = diag * MAX_ORAN;
    const eslesmeMax = diag * ESLESME_ORAN;

    const guncel = eller.map((e) => {
      const n = e.noktalar;
      const tum = [];
      for (let i = 0; i < 21; i++) {
        const p = n[i] || n[9] || n[0];
        tum.push(harita(p.x, p.y));
      }
      const kilic = kilicHesap(tum);
      const palm = tum[9] || tum[0];
      return { tum, kilic, palm, pts: kesimNoktalari(kilic, tum), taraf: palm.x < W / 2 ? "sol" : "sag" };
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

        // ---- gecikme telafisi ----
        // Kamera→çıkarım→ekran arasında geçen süre kadar eli ileri sar; böylece
        // bıçak "elin şu an olduğu yerde" görünür ve orayı keser (senkron hissi).
        const dtA = Math.max(0.008, this._t - onc.gorulen);
        const hx = (g.palm.x - onc.palm.x) / dtA;
        const hy = (g.palm.y - onc.palm.y) / dtA;
        let kx = hx * telafiSn;
        let ky = hy * telafiSn;
        const kmag = Math.hypot(kx, ky);
        if (kmag > TELAFI_MAX_PX) {
          kx = (kx / kmag) * TELAFI_MAX_PX;
          ky = (ky / kmag) * TELAFI_MAX_PX;
        }
        if (kx || ky) oteleEl(g, kx, ky);

        if (this.faz === "oyun") {
          const hiz = Math.hypot(hx, hy);
          for (let k = 0; k < g.pts.length; k++) {
            const a = onc.pts[k];
            const b = g.pts[k];
            if (!a) continue;
            const uz = Math.hypot(b.x - a.x, b.y - a.y);
            if (uz < MIN_SEGMENT || uz > maxSeg) continue;
            for (const f of this.meyveler) {
              if (f.kesildi) continue;
              if (segMesafe(f.x, f.y, a.x, a.y, b.x, b.y) < f.r + KILIC_KALINLIK) {
                this._kes(f, g.taraf, W, b.x - a.x, b.y - a.y);
              }
            }
          }
          // Agresif savurmada kılıcın TÜM gövdesi (kol dahil) keser: iki algılama
          // karesi arasında noktalar arası boşluğa düşen meyve kaçmasın.
          if (hiz > SUPURME_HIZ) {
            const { kuyruk, uc } = g.kilic;
            for (const f of this.meyveler) {
              if (f.kesildi) continue;
              if (segMesafe(f.x, f.y, kuyruk.x, kuyruk.y, uc.x, uc.y) < f.r + KILIC_KALINLIK) {
                this._kes(f, g.taraf, W, hx, hy);
              }
            }
          }
        }
        onc.pts = g.pts;
        onc.tum = g.tum;
        onc.kilic = g.kilic;
        onc.palm = g.palm;
        onc.taraf = g.taraf;
        onc.hiz.x = hx;
        onc.hiz.y = hy;
        // Bıçak izi noktaları burada DEĞİL, her çizim karesinde üretilir
        // (bkz. guncelle → iz üretimi): algılama seyrek olsa da iz akıcı kalsın.
        onc.gorulen = this._t;
        yeni.push(onc);
      } else {
        yeni.push({
          pts: g.pts,
          tum: g.tum,
          kilic: g.kilic,
          palm: g.palm,
          taraf: g.taraf,
          hiz: { x: 0, y: 0 },
          kayma: { x: 0, y: 0 },
          iz: [], // ilk nokta, el hareket etmeye başlayınca çizim karesinde eklenir
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

  // MEYVE YE: ham ağız landmark'larını ekran uzayına taşır, açıklık oranını
  // hesaplar (histerezisli) ve açık ağza değen meyveleri yutar.
  _agizIsle(ham, harita, W) {
    if (!ham || !ham.ust || !ham.alt || !ham.sol || !ham.sag) {
      this.agiz = null;
      return;
    }
    const ust = harita(ham.ust.x, ham.ust.y);
    const alt = harita(ham.alt.x, ham.alt.y);
    const sol = harita(ham.sol.x, ham.sol.y);
    const sag = harita(ham.sag.x, ham.sag.y);
    const gen = Math.hypot(sag.x - sol.x, sag.y - sol.y) || 40;
    const oran = Math.hypot(alt.x - ust.x, alt.y - ust.y) / gen;
    const oncekiAcik = this.agiz ? this.agiz.acik : false;
    const acik = oncekiAcik ? oran > AGIZ_KAPA : oran > AGIZ_AC;
    this.agiz = {
      x: (ust.x + alt.x + sol.x + sag.x) / 4,
      y: (ust.y + alt.y + sol.y + sag.y) / 4,
      r: gen * AGIZ_YUT_ORAN,
      gen,
      oran,
      acik,
    };

    this._yutmaKontrol(W);
  }

  // Yutma testi HER çizim karesinde yapılır (algılama ~20 fps olsa da hızlı geçen
  // meyve ağzın içinden kaçmasın).
  _yutmaKontrol(W) {
    const a = this.agiz;
    if (!a || !a.acik || this.faz !== "oyun") return;
    for (const f of this.meyveler) {
      if (f.kesildi) continue;
      if (Math.hypot(f.x - a.x, f.y - a.y) < a.r + f.r * 0.6) this._ye(f, W);
    }
  }

  // eller: ElTakip.eller (ham landmark) ; damga: algılama kare no (yeni veri işareti)
  // harita: (nx,ny)->{x,y} ekran px ; agiz: YuzTakip.agiz (yalnız 'yeme' modunda)
  guncelle(dt, eller, damga, harita, W, H, gecikmeSn = 0, agiz = null) {
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
        this.sesler.push("bitti");
      }
    }

    // ---- el takibi + bıçak izi + kesim (yalnız YENİ algılama karesinde) ----
    // Algılama ~15-25 fps; render 60 fps. Aynı algılama verisiyle tekrar kesim
    // işlemek anlamsız ve yanlış (segment ~0). damga değişince bir kez işle.
    if (damga !== this._sonDamga) {
      this._sonDamga = damga;
      if (this.mod === "yeme") this._agizIsle(agiz, harita, W);
      else this._elleriIsle(eller, harita, W, H, Math.min(Math.max(gecikmeSn, 0), 0.18));
    }
    // izleri her karede süz + hareket varken YENİ nokta üret (çizim hızında)
    for (const h of this._takip) {
      while (h.iz.length && this._t - h.iz[0].t > IZ_OMUR) h.iz.shift();
      // Çizim ekstrapolasyonu: algılama ~20-30 fps, çizim 60 fps. Son bilinen hızla
      // ileri sararak kılıç elin gerçek konumunda görünür (araya donan kare kalmaz).
      const ileri = Math.min(RENDER_ILERI_MAX, Math.max(0, this._t - h.gorulen));
      if (!h.kayma) h.kayma = { x: 0, y: 0 };
      h.kayma.x = h.hiz.x * ileri;
      h.kayma.y = h.hiz.y * ileri;

      // İz ucu = orta parmak ucu (elin doğal öncü noktası), ileri sarılmış konumda.
      // Yalnız el yeterince HIZLIYSA ve el hâlâ görülüyorsa nokta eklenir → el
      // dururken hiç iz oluşmaz, savururken 60 fps yoğunlukta akıcı şerit çıkar.
      const taze = this._t - h.gorulen < 0.12;
      if (taze && Math.hypot(h.hiz.x, h.hiz.y) > IZ_HIZ_ESIK) {
        const uc = h.tum[12] || h.palm;
        const px = uc.x + h.kayma.x;
        const py = uc.y + h.kayma.y;
        const son = h.iz.length ? h.iz[h.iz.length - 1] : null;
        if (!son || Math.hypot(px - son.x, py - son.y) > IZ_MIN_ARALIK) {
          h.iz.push({ x: px, y: py, t: this._t });
          if (h.iz.length > IZ_MAKS_NOKTA) h.iz.shift();
        }
      }
    }
    this.izler = this._takip.map((h) => h.iz);
    // render için: ekran uzayında el/kılıç geometrisi (+ kayma ile ileri sarım)
    this.eller = this._takip;

    // ---- fizik: meyveler ----
    for (const f of this.meyveler) {
      f.vy += YERCEKIMI * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.aci += f.donHiz * dt;
    }
    // MEYVE YE: meyveler yeni konumlarına taşındıktan sonra ağız teması sınanır
    if (this.mod === "yeme") this._yutmaKontrol(W);
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

    // ---- kesim efektleri: flaş, halka, yutulan meyve, ekran sarsıntısı ----
    for (const s of this.slashlar) s.t += dt;
    this.slashlar = this.slashlar.filter((s) => s.t < s.omur);
    for (const d of this.dalgalar) d.t += dt;
    this.dalgalar = this.dalgalar.filter((d) => d.t < d.omur);
    for (const y of this.yutulanlar) {
      y.t += dt;
      const p = Math.min(1, y.t / y.omur);
      y.cx = y.x + (y.hx - y.x) * p;
      y.cy = y.y + (y.hy - y.y) * p;
      y.olcek = 1 - 0.85 * p;
    }
    this.yutulanlar = this.yutulanlar.filter((y) => y.t < y.omur);
    this.sarsinti = Math.max(0, this.sarsinti - dt * 46);
    // ses kuyruğu tüketilmezse (başsız test) sonsuz büyümesin
    if (this.sesler.length > 24) this.sesler.splice(0, this.sesler.length - 24);
  }
}
