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
const KILIC_KALINLIK = 38; // hitbox toleransı (px) — cömert: kesmek kolay olsun
const MIN_SEGMENT = 6; // bu hareketin altındaki el kesmez (statik el sayılmaz)

// ---- HAREKET KAPISI (duran el kesmez, agresif/salınımlı hareket keser) ----
// MediaPipe landmark'ları el SABİT dururken de 2-5 px titrer; kare-başı mesafe
// eşiği 60 Hz algılamada bu titremeyi "gerçek hareket" sanıp duran elde kesim
// yapıyordu. İlk çözüm NET (yönlü) yer değiştirmeydi — ama net yol SALINIMLI
// hareketi de eliyor: yumruk atar/dans eder gibi el ileri-geri gidince pencere
// içindeki net yol ~0 çıkıyor ve kapı KAPALI kalıyordu ("hızlı hareket ediyorum
// ama kesmiyor" şikâyetinin kök nedeni buydu).
//
// Nihai ölçüt: pencere içindeki konum YAYILIMI (bbox köşegeni). Yayılım yön
// bağımsızdır → tek yönlü savurmayı da salınımı da yakalar; titreme ise yayılımı
// asla eşiğe çıkaramaz (±4 px titreme ≈ 11 px yayılım, eşik ~35 px).
//
// Eşikler EKRAN KÖŞEGENİNE ORANLI: landmark titremesi normalize uzayda sabittir,
// px'e çevrilince ekran büyüdükçe büyür. Sabit px eşiği telefonda katı, masaüstü
// geniş ekranda gevşek kalıyordu; oran ile her cihazda aynı davranış elde edilir.
const HAREKET_PENCERE = 0.14; // sn — konum geçmişi penceresi
const YAYILIM_ORAN = 0.035; // × köşegen — kapı eşiği (yayılım bunun altındaysa el "duruyor")
// Telafi/iz/süpürme için yön ve hız KISA pencereden okunur: salınımlı harekette
// uzun pencere ortalaması yönü yanlış (hatta sıfır) gösterir.
const HIZ_PENCERE = 0.04; // sn
const MAX_ORAN = 1.05; // kesim segmenti köşegenin bu oranını aşarsa sayma (sahte/geçiş)
// ---- Kimlik eşleştirme ----
// Eşleştirme, elin son bilinen hızıyla TAHMİN edilen konumuna göre yapılır: hızlı
// savurmada avuç uzağa sıçrar ama tahmin onu takip eder → iki el yan yana geçerken
// kimlik takası olasılığı düşer. Tavan cömert kalır (tek elin çok hızlı savurması
// reddedilmesin); absürt bağlantıları kesim segmenti tavanı (MAX_ORAN) zaten eler.
const ESLESME_CANLI_ORAN = 0.9; // × köşegen — canlı elde tahmin sapması tavanı
const ESLESME_KAYIP_ORAN = 0.95; // × köşegen — kadraj dışından dönen el başka yerden girebilir
const ESLESME_ILERI_MAX = 0.12; // sn — tahminde ileri sarılacak azami süre
// ---- Kadraj dışına çıkıp geri girme (köprü) ----
// El kadrajdan çıkınca kimliği HEMEN silinmez; bu süre kadar "kayıp" olarak
// saklanır. Geri girdiğinde aynı kimliğe bağlanır → dönüş savurması hemen keser.
// Süre CÖMERT: agresif oynanışta (dans/yumruk) kol saniyelerce kadraj dışında
// kalabiliyor; 0.4 sn'lik eski pencere dönüşte hızsız/segmentsiz yeni kimlik
// doğurduğu için ilk savurmalar boşa gidiyordu.
const KAYIP_SURE = 1.2; // sn
// Köprüyle bağlanan elin kesim segmenti bu orandan uzun olamaz (ekran köşegeni
// çarpanı) — kadrajın bir ucundan diğerine "bedava kesim" olmasın.
const KOPRU_MAX_ORAN = 0.5;
// Kayıp bu süreden UZUNSA iki konum arasındaki çizgi gerçek bir savurma değildir
// (el arada nereden geçtiği bilinmiyor) → o karede segment kesimi yapılmaz;
// kesimi yalnız kılıcın O ANKİ gövdesi yapabilir (aşağıdaki süpürme).
const KOPRU_SEGMENT_SURE = 0.25; // sn
// Köprüden dönen ele, kayıp öncesi konumu "az önceki örnek" olarak eklenir →
// kadraja giren el İLK karede hareketli sayılır (kapı açılır, yön giriş yönüdür).
const KOPRU_REF_DT = 0.05; // sn
// Köprü atlaması bu orandan büyükse bıçak izi sıfırlanır (ekranı kesen şerit çizmesin).
const KOPRU_IZ_SIFIR = 0.25;
const COMBO_PENCERE = 0.55; // sn
const IZ_OMUR = 0.3; // bıçak izi ömrü (sn) — Fruit Ninja hissi
// Bıçak izi YALNIZ el hareket ederken üretilir. Nokta ekleme kararı HIZA bakar
// (kareler arası mesafeye değil): el bu hızın üstündeyse her ÇİZİM karesinde
// (60 fps) nokta eklenir → algılama 12 fps'e düşse bile iz akıcı ve kesintisiz
// görünür. El dururken hiç nokta eklenmez → ekranda iz kalmaz.
const IZ_HIZ_ORAN = 0.09; // × köşegen/sn (bkz. YAYILIM_ORAN — ekrana oranlı)
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
// Kapı zaten duran eli elediği için eşik cömert tutulabilir.
const SUPURME_ORAN = 0.28; // × köşegen/sn (ekrana oranlı)
// Ekrandaki parçacık tavanı (mobilde çizim maliyeti). 260→160: kesim anında
// aynı karede parçacık+yarım+flaş+dalga+sarsıntı birlikte başlıyor (efekt bütçesi).
const MAX_PARCACIK = 160;
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
    // Kenar payı ekrana oranlı: meyve ekranın en dış şeridine düşerse oyuncu kolunu
    // kadrajın dışına kadar uzatmak zorunda kalıyor (el orada kayboluyor).
    const kenar = Math.max(60, W * 0.1);
    const x = kenar + Math.random() * Math.max(1, W - 2 * kenar);

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

    // ağız çevresinde küçük şıpırtı (16/9 → 10/6: efekt bütçesi)
    const adet = f.meyve.altin ? 10 : 6;
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

    // splat parçacıkları (12/20 → 8/12: kesim anı kare bütçesi)
    const adet = f.meyve.altin ? 12 : 8;
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
    const eslesmeCanli = diag * ESLESME_CANLI_ORAN;
    const eslesmeKayip = diag * ESLESME_KAYIP_ORAN;

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
    // İki geçişli eşleştirme: önce CANLI eller (kimlik takası olmasın), sonra
    // "kayıp" eller (kadrajdan çıkıp geri gelen el eski kimliğine bağlanır).
    const eslesme = new Array(guncel.length).fill(-1);
    for (let pas = 0; pas < 2; pas++) {
      for (let gi = 0; gi < guncel.length; gi++) {
        if (eslesme[gi] >= 0) continue;
        const g = guncel[gi];
        let enIyi = -1;
        let enMesafe = Infinity;
        for (let j = 0; j < this._takip.length; j++) {
          if (kullanildi[j]) continue;
          const h = this._takip[j];
          if (pas === 0 ? h.kayip : !h.kayip) continue;
          // Kayıp el köprüsü yalnız KAYIP_SURE içinde geçerli. (Algılama karesi
          // gelmediği sürece kayıt düşürülmez; tazeliği burada da denetle.)
          if (h.kayip && this._t - h.gorulen > KAYIP_SURE) continue;
          // Tahmin: el son bilinen hızıyla nereye gitmiş olmalı? Hızlı savurmada
          // ham konum farkı büyür, tahminli fark küçük kalır → kimlik korunur.
          // Kayıp elde tahmin YAPILMAZ: el kadraj dışında yön değiştirmiş olabilir,
          // eski hızla ileri sarmak referansı yanlış yere taşır (tavan zaten geniş).
          const ileri = h.kayip ? 0 : Math.min(Math.max(0, this._t - h.gorulen), ESLESME_ILERI_MAX);
          const bx = h.palm.x + (h.hiz ? h.hiz.x : 0) * ileri;
          const by = h.palm.y + (h.hiz ? h.hiz.y : 0) * ileri;
          const d = Math.hypot(bx - g.palm.x, by - g.palm.y);
          if (d < (h.kayip ? eslesmeKayip : eslesmeCanli) && d < enMesafe) {
            enMesafe = d;
            enIyi = j;
          }
        }
        if (enIyi >= 0) {
          eslesme[gi] = enIyi;
          kullanildi[enIyi] = true;
        }
      }
    }

    for (let gi = 0; gi < guncel.length; gi++) {
      const g = guncel[gi];
      const enIyi = eslesme[gi];
      if (enIyi >= 0) {
        const onc = this._takip[enIyi];
        const kopru = !!onc.kayip; // kadraj dışından dönen el
        const kayipSure = this._t - onc.gorulen;
        onc.kayip = false;
        if (!onc.gecmis) onc.gecmis = [];
        if (kopru) {
          // Uzun atlamada eski iz noktalarını at: ekranı boydan boya kesen
          // yapay şerit oluşmasın (dönüş savurmasının izi yeniden başlar).
          const atlama = Math.hypot(g.palm.x - onc.palm.x, g.palm.y - onc.palm.y);
          if (atlama > diag * KOPRU_IZ_SIFIR) onc.iz.length = 0;
          // Kadraja yeniden giren el İLK karede "hareketli" sayılmalı: kayıp
          // öncesi konumu az önceki örnek gibi geçmişe koy. Aksi hâlde pencerede
          // tek örnek kalır, kapı kapalı olur ve dönüş savurması boşa giderdi.
          onc.gecmis = [{ t: this._t - KOPRU_REF_DT, x: onc.palm.x, y: onc.palm.y }];
          // Kayıp uzunsa iki konum arası çizgi gerçek bir savurma değil → segment
          // kesimi kapalı; kesimi yalnız kılıcın O ANKİ gövdesi yapabilir.
          if (kayipSure > KOPRU_SEGMENT_SURE) onc.pts = null;
        }

        const dtA = Math.max(0.008, kayipSure);

        // ---- hareket kapısı: pencere içindeki konum YAYILIMI ----
        // Yayılım yön bağımsızdır: tek yönlü savurma da, yumruk gibi salınımlı
        // hareket de eşiği aşar; landmark titremesi (birkaç px) asla aşamaz.
        onc.gecmis.push({ t: this._t, x: g.palm.x, y: g.palm.y });
        while (onc.gecmis.length > 1 && this._t - onc.gecmis[0].t > HAREKET_PENCERE) onc.gecmis.shift();
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let s = 0; s < onc.gecmis.length; s++) {
          const p = onc.gecmis[s];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const yayilim = onc.gecmis.length >= 2 ? Math.hypot(maxX - minX, maxY - minY) : 0;
        const hareketVar = yayilim > diag * YAYILIM_ORAN;

        // ---- yön ve hız: KISA pencere (tepkisel) ----
        // Salınımlı harekette uzun pencere ortalaması yönü sıfırlar; kısa pencere
        // elin o anki gidiş yönünü verir (telafi, iz ve gövde süpürmesi bunu kullanır).
        let ref = onc.gecmis[0];
        for (let s = onc.gecmis.length - 1; s >= 0; s--) {
          ref = onc.gecmis[s];
          if (this._t - ref.t >= HIZ_PENCERE) break;
        }
        const pdt = Math.max(0.008, this._t - ref.t);
        let hx = (g.palm.x - ref.x) / pdt;
        let hy = (g.palm.y - ref.y) / pdt;
        if (!hareketVar) {
          // El duruyor sayılır: kesim yok, gecikme telafisi yok, bıçak izi yok.
          // (Titremeyi telafiyle büyütmek hem sahte kesim hem titreyen bıçak yapıyordu.)
          hx = 0;
          hy = 0;
        }

        // ---- gecikme telafisi ----
        // Kamera→çıkarım→ekran arasında geçen süre kadar eli ileri sar; böylece
        // bıçak "elin şu an olduğu yerde" görünür ve orayı keser (senkron hissi).
        let kx = hx * telafiSn;
        let ky = hy * telafiSn;
        const kmag = Math.hypot(kx, ky);
        if (kmag > TELAFI_MAX_PX) {
          kx = (kx / kmag) * TELAFI_MAX_PX;
          ky = (ky / kmag) * TELAFI_MAX_PX;
        }
        if (kx || ky) oteleEl(g, kx, ky);

        const hiz = Math.hypot(hx, hy);
        // Kapı kapalıysa (duran el) HİÇBİR kesim yapılmaz; açıkken kesim mantığı
        // eskisi gibi çalışır.
        if (this.faz === "oyun" && hareketVar) {
          // Köprüyle dönen elde segment tavanı daraltılır (ekranı boydan boya
          // tarayan "bedava kesim" olmasın); normal takipte eski tavan geçerli.
          const segTavan = kopru ? diag * KOPRU_MAX_ORAN : maxSeg;
          // mesafe tabanı algılama aralığıyla ölçeklenir (60 Hz'de ~3 px, 30 Hz'de 6 px)
          const mesafeTaban = MIN_SEGMENT * Math.min(1, dtA / 0.033);
          const oncekiPts = onc.pts; // uzun kayıptan dönüşte null (bkz. köprü)
          for (let k = 0; oncekiPts && k < g.pts.length; k++) {
            const a = oncekiPts[k];
            const b = g.pts[k];
            if (!a) continue;
            const uz = Math.hypot(b.x - a.x, b.y - a.y);
            if (uz < mesafeTaban || uz > segTavan) continue;
            for (const f of this.meyveler) {
              if (f.kesildi) continue;
              if (segMesafe(f.x, f.y, a.x, a.y, b.x, b.y) < f.r + KILIC_KALINLIK) {
                this._kes(f, g.taraf, W, b.x - a.x, b.y - a.y);
              }
            }
          }
          // Agresif savurmada kılıcın TÜM gövdesi (kol dahil) keser: iki algılama
          // karesi arasında noktalar arası boşluğa düşen meyve kaçmasın.
          if (hiz > diag * SUPURME_ORAN) {
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
          // Ham avuç konumu penceresi (yayılım → hareket kapısı). İlk örnek HEMEN
          // konur ki elin ikinci karesinde kapı değerlendirilebilsin.
          gecmis: [{ t: this._t, x: g.palm.x, y: g.palm.y }],
          iz: [], // ilk nokta, el hareket etmeye başlayınca çizim karesinde eklenir
          gorulen: this._t,
          kayip: false,
        });
      }
    }

    // Eşleşmeyen eller: KAYIP_SURE boyunca "kayıp" olarak saklanır (kadrajdan
    // çıkıp geri gelen el kimliğini korusun) — süre dolunca düşer.
    for (let j = 0; j < this._takip.length; j++) {
      if (kullanildi[j]) continue;
      const h = this._takip[j];
      while (h.iz.length && this._t - h.iz[0].t > IZ_OMUR) h.iz.shift();
      if (this._t - h.gorulen <= KAYIP_SURE) {
        h.kayip = true;
        yeni.push(h);
      }
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
    const izEsik = Math.hypot(W, H) * IZ_HIZ_ORAN;
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
      if (taze && Math.hypot(h.hiz.x, h.hiz.y) > izEsik) {
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
    // Render/teşhis: yalnız CANLI ellerin izi (kayıp el kaydı köprü için tutulur
    // ama ekranda ne izi ne bıçağı olmalı).
    this.izler = this._takip.filter((h) => !h.kayip).map((h) => h.iz);
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
    // Yoğun combo'da parçacık sayısı patlayıp çizimi (mobilde) yavaşlatabiliyor:
    // en eskileri at, tavanı aşma.
    if (this.parcaciklar.length > MAX_PARCACIK) {
      this.parcaciklar.splice(0, this.parcaciklar.length - MAX_PARCACIK);
    }

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
