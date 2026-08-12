// ============================================================
// GÖLGE BOKS — oyun mantığı (faz makinesi + pad/tehdit üretimi + puanlama)
//
// Faz akışı:  isinma → round → mola → round → … → bitti
// Modlar:     serbest · koc · savunma · ritim   (bkz. MODLAR)
// Zorluk:     kolay(2 round) · orta(3) · zor(4) · pro(5) + test (kalibrasyon)
//
// Motor DOM'a ve Supabase'e DOKUNMAZ: yalnız durum üretir. Ses olayları
// `sesler` kuyruğuna, koç konuşmaları `konusmalar` kuyruğuna yazılır; sayfa
// bunları tüketir. Böylece motor Node'da başsız test edilebilir.
//
// CEZA YOK: yanlış yumruk türü pad'i titretir, puan vermez — can/ceza yoktur.
// Antrenman hissi korunur (hub'daki Meyve Kes ile tutarlı).
// ============================================================

import { YumrukTanima, TUR, noBilgi, ORTODOKS } from "./yumrukTanima.js";
import { kapsamHesap } from "./posetakip.js";

// ---- Modlar ----
export const MODLAR = {
  serbest: { ad: "Serbest", ikon: "🥊", aciklama: "İstediğin pede istediğin yumruğu at" },
  koc: { ad: "Koç", ikon: "🎯", aciklama: "Koçun verdiği kombinasyonu sırayla vur" },
  savunma: { ad: "Savunma", ikon: "🛡️", aciklama: "Gelen yumruklardan kaç veya blokla" },
  ritim: { ad: "Ritim", ikon: "🎵", aciklama: "Müziğe senkron pedlere vur" },
};

// ---- Zorluk tablosu ----
// Round süresi zorlukla kısalır, tempo artar. Mola kısa tutulur.
// `padOmur` ~%25 uzatıldı: oyuncunun pedi GÖRÜP doğru yumruğu seçmesi gerekiyor;
// eski değerlerde pad, yumruk yola çıkmadan sönüyordu.
export const ZORLUKLAR = {
  kolay: { ad: "Kolay", round: 2, sure: 90, mola: 12, padOmur: 2.9, aralik: 1.45, esZaman: 1, bpm: 88 },
  orta: { ad: "Orta", round: 3, sure: 75, mola: 11, padOmur: 2.3, aralik: 1.15, esZaman: 1, bpm: 100 },
  zor: { ad: "Zor", round: 4, sure: 60, mola: 10, padOmur: 1.8, aralik: 0.9, esZaman: 2, bpm: 118 },
  pro: { ad: "Pro", round: 5, sure: 45, mola: 9, padOmur: 1.4, aralik: 0.58, esZaman: 2, bpm: 138 },
  // Otomatik zorluk kalibrasyonu için kısa test round'u (sıralamaya yazılmaz).
  test: { ad: "Seviye Testi", round: 1, sure: 30, mola: 0, padOmur: 2.2, aralik: 1.1, esZaman: 1, bpm: 100 },
};

// AKIŞ: ilk sürümde ısınma 18 sn / ara 8 sn idi; oyuncu ekranın başında bekliyor
// ve antrenman "başlamıyor" hissi veriyordu. Kısaltıldı — mola zaten dinlendirir.
const ISINMA_ILK = 10; // sn — ilk round öncesi ısınma
const ISINMA_ARA = 5; // sn — sonraki roundlarda kısa hazırlık
const COMBO_PENCERE = 2.4; // sn — ardışık isabet arası azami süre
// Pad kabul yarıçapı: kamerada bilek konumu ±birim*0.2 salınır ve oyuncu pede
// "denk getirdim" dediğinde gerçekte merkezden yarım gövde ölçüsü uzakta olur.
// 0.62 çok cimriydi (isabet ıskalanıyordu) — 0.85'e açıldı.
const PAD_TOLERANS = 0.85; // birim — pad merkezine kabul yarıçapı katsayısı
const TEHDIT_TELEGRAPH = 0.95; // sn — savunmada yumruğun gelme süresi (zorlukla kısalır)
const KACIS_MESAFE = 0.5; // birim — kafa bu kadar kaydıysa kaçış başarılı
const NEFES_HZ = 0.22; // nefes/tempo göstergesi frekansı (yavaş, sakin ritim)

// Combo çarpan eğrisi (madde 12).
export function comboCarpan(c) {
  if (c >= 15) return 2.2;
  if (c >= 10) return 1.8;
  if (c >= 6) return 1.5;
  if (c >= 3) return 1.2;
  return 1;
}

// Koç modu kombinasyonları — gerçek boks kombinasyonları, zorlukla uzar.
const KOMBOLAR = {
  kolay: [[1], [1, 1], [1, 2], [2], [3], [1, 2]],
  orta: [
    [1, 2], [1, 1, 2], [1, 2, 3], [2, 3], [3, 2], [1, 2, 5], [5, 2],
  ],
  zor: [
    [1, 2, 3], [1, 2, 5, 2], [3, 2, 3], [1, 1, 2, 4], [5, 4, 2], [2, 3, 2], [1, 6, 3],
  ],
  pro: [
    [1, 2, 3, 2], [1, 2, 5, 2, 3], [3, 4, 2, 1], [1, 1, 2, 3, 4], [5, 2, 3, 6],
    [2, 3, 6, 2], [1, 2, 4, 5, 2],
  ],
  test: [[1], [1, 2], [3], [2]],
};

// Pad bölgeleri: yumruk numarasına göre anatomik olarak doğru hedef konumu.
// x oranı ekranda: ayna görüntüsünde oyuncunun SOL eli ekranın SOLUNDA görünür.
// tur/on bilgisinden hangi elin vuracağı bilinir → pad o tarafa yerleşir.
function padKonum(no, durus, W, H) {
  const b = noBilgi(no, durus);
  const solTaraf = b.el === "sol";
  const kenar = solTaraf ? 1 : -1;
  let x = 0.5 + kenar * (b.tur === TUR.HOOK ? 0.29 : b.tur === TUR.UPPERCUT ? 0.13 : 0.19);
  let y = b.tur === TUR.UPPERCUT ? 0.63 : b.tur === TUR.HOOK ? 0.42 : 0.33;
  return { x: x * W, y: y * H, el: b.el, tur: b.tur, on: b.on };
}

/** Round başına biriken ham olay sayaçları (madde 6.2 — sayılabilir veri). */
export function bosIstatistik() {
  return {
    puan: 0,
    yumruk: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    toplamYumruk: 0,
    isabet: 0,
    kacirma: 0,
    yanlisTur: 0,
    solYumruk: 0,
    sagYumruk: 0,
    siddetToplam: 0,
    siddetMax: 0,
    hizToplam: 0,
    dusukGardOlay: 0, // serbest haldeki düşük gard olayları (süreye yayılı)
    vurustaAcikGard: 0, // YUMRUK ANINDA karşı elin düşük olduğu vuruş sayısı
    gardDusukSure: 0,
    gardOlcuSure: 0,
    kacinmaDeneme: 0,
    kacinmaBasari: 0,
    blok: 0,
    posturUyari: 0,
    enIyiCombo: 0,
    ritimMukemmel: 0,
    sure: 0,
    tempoDilim: [], // her 10 sn'de atılan yumruk (yorgunluk/tempo eğrisi)
    kapsam: { ustGovde: false, kollar: false, kalca: false, bacaklar: false },
  };
}

export class Oyun {
  /**
   * @param {object} p
   * @param {'serbest'|'koc'|'savunma'|'ritim'} p.mod
   * @param {keyof typeof ZORLUKLAR} p.zorluk
   * @param {'ortodoks'|'guney_pence'} p.durus
   * @param {number} [p.kiloKg]      kalori için (girilmezse tahmini)
   * @param {number} [p.hedefTempo]  kariyerden gelen ort. dakikadaki yumruk (canlı karşılaştırma)
   */
  constructor({ mod = "serbest", zorluk = "orta", durus = ORTODOKS, kiloKg = 0, hedefTempo = 0 } = {}) {
    this.mod = MODLAR[mod] ? mod : "serbest";
    this.zorlukAd = ZORLUKLAR[zorluk] ? zorluk : "orta";
    this.z = ZORLUKLAR[this.zorlukAd];
    this.durus = durus;
    this.kiloKg = kiloKg > 25 && kiloKg < 250 ? kiloKg : 0;
    this.hedefTempo = hedefTempo || 0;

    this.tanima = new YumrukTanima({ durus });

    // ---- durum ----
    this.faz = "isinma"; // isinma | round | mola | bitti
    this.roundNo = 1;
    this.fazSure = ISINMA_ILK;
    this.puan = 0;
    this.combo = 0;
    this.enIyiCombo = 0;
    this._sonIsabet = -10;
    this._t = 0;
    this._spawn = 0.8;
    this._tempoSayac = 0;
    this._tempoDilimT = 0;
    this._sonPozDamga = -1;
    this._tanimaDt = 0;
    this.poz = null;

    // ---- görsel/veri kuyrukları ----
    this.padler = [];
    this.tehditler = []; // savunma modu
    this.efektler = []; // darbe halkası / parçacık
    this.popuplar = [];
    this.sesler = [];
    this.konusmalar = []; // sesli koç (TTS) metinleri
    this.uyarilar = []; // sağlık/güvenlik uyarıları (nazik ton)
    this.sarsinti = 0;
    this.nefes = 0; // 0-1 nefes ritmi göstergesi

    // ---- koç modu ----
    this.komut = null; // { dizi: [1,2], indeks: 0 }
    this._komutBekle = 0;

    // ---- ritim modu ----
    this.bpm = this.z.bpm;
    this.beat = 0;
    this._beatSayac = 0;

    // ---- istatistik ----
    this.roundlar = []; // biten roundların istatistikleri
    this.ist = bosIstatistik();
    this._sonYumrukT = 0;
    this._yorgunlukUyarildi = false;
    this._eforUyarildi = false;
    this.tempoAnlik = 0; // dakikadaki yumruk (son 15 sn)
    this._tempoPencere = [];
  }

  get bitti() {
    return this.faz === "bitti";
  }

  get toplamRound() {
    return this.z.round;
  }

  /** Toplam (tüm roundlar + aktif round) istatistiği — sonuç ekranı için. */
  toplamIstatistik() {
    const t = bosIstatistik();
    const hepsi = this.roundlar.concat(this.faz === "bitti" ? [] : [this.ist]);
    for (const r of hepsi) {
      t.puan += r.puan;
      for (const k in t.yumruk) t.yumruk[k] += r.yumruk[k] || 0;
      t.toplamYumruk += r.toplamYumruk;
      t.isabet += r.isabet;
      t.kacirma += r.kacirma;
      t.yanlisTur += r.yanlisTur;
      t.solYumruk += r.solYumruk;
      t.sagYumruk += r.sagYumruk;
      t.siddetToplam += r.siddetToplam;
      t.siddetMax = Math.max(t.siddetMax, r.siddetMax);
      t.hizToplam += r.hizToplam;
      t.dusukGardOlay += r.dusukGardOlay;
      t.vurustaAcikGard += r.vurustaAcikGard;
      t.gardDusukSure += r.gardDusukSure;
      t.gardOlcuSure += r.gardOlcuSure;
      t.kacinmaDeneme += r.kacinmaDeneme;
      t.kacinmaBasari += r.kacinmaBasari;
      t.blok += r.blok;
      t.posturUyari += r.posturUyari;
      t.ritimMukemmel += r.ritimMukemmel;
      t.sure += r.sure;
      t.enIyiCombo = Math.max(t.enIyiCombo, r.enIyiCombo);
      t.tempoDilim = t.tempoDilim.concat(r.tempoDilim);
      for (const k in t.kapsam) t.kapsam[k] = t.kapsam[k] || r.kapsam[k];
    }
    return t;
  }

  /** MET tabanlı kalori (madde 10) — sabit sayı yok, yoğunluğa göre kayar. */
  kalori(ist) {
    const dk = Math.max(0.1, ist.sure / 60);
    const ypm = ist.toplamYumruk / dk; // dakikadaki yumruk
    // 6 MET (hafif gölge boks) → 12 MET (yüksek tempo, yoğun kombinasyon)
    let met = 6 + Math.min(5.5, ypm / 14);
    if (this.zorlukAd === "pro") met += 0.5;
    if (this.mod === "savunma") met += 0.4; // gövde/bacak hareketi daha yoğun
    met = Math.max(4, Math.min(12, met));
    const kilo = this.kiloKg || 72; // girilmezse ortalama — "tahmini" etiketiyle sunulur
    return {
      deger: Math.round(met * kilo * (ist.sure / 3600)),
      met: Math.round(met * 10) / 10,
      tahmini: !this.kiloKg,
    };
  }

  // ---------------- faz makinesi ----------------
  _fazGec() {
    if (this.faz === "isinma") {
      this.faz = "round";
      this.fazSure = this.z.sure;
      this.ist = bosIstatistik();
      this.tanima.roundSifirla();
      this._spawn = 0.6;
      this._tempoSayac = 0;
      this._tempoDilimT = 0;
      this.combo = 0;
      this.sesler.push("gong");
      this.konusmalar.push({ tip: "round-basla", round: this.roundNo });
      return;
    }
    if (this.faz === "round") {
      this._roundKapat();
      if (this.roundNo >= this.z.round) {
        this.faz = "bitti";
        this.sesler.push("bitis");
        this.konusmalar.push({ tip: "antrenman-bitti" });
        return;
      }
      this.roundNo++;
      this.faz = "mola";
      this.fazSure = this.z.mola;
      this.sesler.push("gong");
      this.konusmalar.push({ tip: "mola", round: this.roundNo - 1 });
      return;
    }
    if (this.faz === "mola") {
      this.faz = "isinma";
      this.fazSure = ISINMA_ARA;
      return;
    }
  }

  _roundKapat() {
    // Erken çıkışta da gerçek süre yazılır (kalori/tempo hesapları dürüst kalsın).
    this.ist.sure = Math.max(1, Math.round(this.z.sure - Math.max(0, this.fazSure)));
    this.ist.gardDusukSure = this.tanima.gardDusukSure;
    this.ist.gardOlcuSure = this.tanima.olcuSure;
    this.ist.enIyiCombo = Math.max(this.ist.enIyiCombo, this.enIyiCombo);
    this.ist.kapsam = { ...this.tanima.kapsam };
    if (this._tempoSayac > 0 || this.ist.tempoDilim.length === 0) {
      this.ist.tempoDilim.push(this._tempoSayac);
    }
    this.roundlar.push(this.ist);
    this.padler.length = 0;
    this.tehditler.length = 0;
    this.komut = null;
  }

  // ---------------- pad üretimi ----------------
  _padUret(W, H) {
    // Koç modunda pad'ler komut dizisinden gelir (aşağıda ayrı yönetilir).
    const no = 1 + ((Math.random() * 6) | 0);
    this._padEkle(no, W, H);
  }

  _padEkle(no, W, H, ekstra = {}) {
    const k = padKonum(no, this.durus, W, H);
    // Aynı yere üst üste pad koyma (okunabilirlik).
    const cakisma = this.padler.some((p) => Math.hypot(p.x - k.x, p.y - k.y) < Math.min(W, H) * 0.14);
    const kayma = cakisma ? (Math.random() - 0.5) * Math.min(W, H) * 0.16 : 0;
    this.padler.push({
      no,
      x: k.x + kayma,
      y: k.y + kayma * 0.5,
      el: k.el,
      tur: k.tur,
      r: Math.min(W, H) * 0.075,
      t: 0,
      omur: this.z.padOmur,
      titre: 0,
      vuruldu: false,
      ...ekstra,
    });
  }

  _komutBaslat(W, H) {
    const havuz = KOMBOLAR[this.zorlukAd] || KOMBOLAR.orta;
    const dizi = havuz[(Math.random() * havuz.length) | 0];
    this.komut = { dizi, indeks: 0, t: 0 };
    this.konusmalar.push({ tip: "kombo", dizi });
    this.padler.length = 0;
    this._padEkle(dizi[0], W, H, { sirali: true });
  }

  // ---------------- savunma modu ----------------
  _tehditUret(W, H) {
    const yonlar = ["sol", "sag", "ust"];
    const yon = yonlar[(Math.random() * yonlar.length) | 0];
    const kafa = this.tanima.kafa;
    // Hedef = tehdit anındaki kafa konumu; oyuncu impact'e kadar oradan çıkmalı.
    const hx = kafa ? kafa.x : W / 2;
    const hy = kafa ? kafa.y : H * 0.32;
    const telegraph = TEHDIT_TELEGRAPH * (this.zorlukAd === "pro" ? 0.62 : this.zorlukAd === "zor" ? 0.78 : 1);
    this.tehditler.push({
      yon,
      hx,
      hy,
      // Geliş noktası (ekran kenarı) — render buradan hedefe doğru çizer.
      bx: yon === "sol" ? -W * 0.1 : yon === "sag" ? W * 1.1 : hx,
      by: yon === "ust" ? -H * 0.1 : hy - H * 0.05,
      t: 0,
      telegraph,
      cozuldu: false,
      r: Math.min(W, H) * 0.11,
    });
    this.sesler.push("tehdit");
  }

  _tehditCoz(th) {
    th.cozuldu = true;
    this.ist.kacinmaDeneme++;
    const kafa = this.tanima.kafa;
    const birim = this.tanima.birim || 1;
    const kacti = kafa ? Math.hypot(kafa.x - th.hx, kafa.y - th.hy) > birim * KACIS_MESAFE : false;
    // Blok: kafa hâlâ bölgede ama iki el de kafa hizasında (gard kapalı).
    const sol = this.tanima.kollar.sol;
    const sag = this.tanima.kollar.sag;
    const gardKapali =
      sol.gorunur && sag.gorunur && !sol.gardDusuk && !sag.gardDusuk;

    if (kacti) {
      this.ist.kacinmaBasari++;
      this._puanEkle(12, th.hx, th.hy, "KAÇTIN!", "#2dd4ff");
      this.sesler.push("kacis");
      this.efektler.push({ tip: "kacis", x: th.hx, y: th.hy, t: 0, omur: 0.45, hiz: 60 });
    } else if (gardKapali) {
      this.ist.blok++;
      this._puanEkle(6, th.hx, th.hy, "BLOK", "#d9a441");
      this.sesler.push("blok");
      this.efektler.push({ tip: "blok", x: th.hx, y: th.hy, t: 0, omur: 0.4, hiz: 40 });
    } else {
      // Ceza yok: sadece geri bildirim.
      this.combo = 0;
      this.sesler.push("yendin");
      this.sarsinti = Math.min(18, this.sarsinti + 12);
      this.efektler.push({ tip: "darbe", x: th.hx, y: th.hy, t: 0, omur: 0.4, hiz: 90 });
      this.popuplar.push({
        metin: "KAÇAMADIN",
        x: th.hx,
        y: th.hy,
        renk: "#ff4d3d",
        t: 0,
        omur: 0.8,
        buyuk: false,
      });
    }
  }

  // ---------------- puanlama ----------------
  _puanEkle(temel, x, y, metin, renk) {
    this.puan += temel;
    this.ist.puan += temel;
    this.popuplar.push({ metin, x, y, renk, t: 0, omur: 0.9, buyuk: temel >= 20 });
  }

  _isabet(pad, olay) {
    pad.vuruldu = true;
    this.ist.isabet++;
    if (this._t - this._sonIsabet < COMBO_PENCERE) this.combo++;
    else this.combo = 1;
    this._sonIsabet = this._t;
    this.enIyiCombo = Math.max(this.enIyiCombo, this.combo);
    this.ist.enIyiCombo = Math.max(this.ist.enIyiCombo, this.combo);

    const carpan = comboCarpan(this.combo);
    // Şiddet bonusu: kendi ortalamasının üstünde vuran daha çok puan alır.
    const siddetCarpan = 0.8 + (olay.siddet / 100) * 0.5;
    let temel = 10;
    // Ritim modu: zamanlama bonusu (beat'e yakınlık).
    let mukemmel = false;
    if (this.mod === "ritim" && pad.beatT != null) {
      const sapma = Math.abs(this._t - pad.beatT);
      if (sapma < 0.13) {
        mukemmel = true;
        this.ist.ritimMukemmel++;
        temel = 15;
      }
    }
    const kazanc = Math.round(temel * carpan * siddetCarpan);
    this.puan += kazanc;
    this.ist.puan += kazanc;

    const altin = this.combo >= 6;
    this.popuplar.push({
      metin: mukemmel
        ? `MÜKEMMEL +${kazanc}`
        : this.combo >= 3
          ? `x${this.combo}  +${kazanc}`
          : `+${kazanc}`,
      x: pad.x,
      y: pad.y,
      renk: mukemmel ? "#2dd4ff" : altin ? "#d9a441" : "#ff4d3d",
      t: 0,
      omur: 0.9,
      buyuk: this.combo >= 3,
    });
    // İMZA EFEKT — darbe halkası: rengi/genişliği vuruş şiddetine göre kırmızıdan
    // camgöbeğine kayar (oyun tatmini + analiz verisi tek görselde).
    this.efektler.push({
      tip: "halka",
      x: pad.x,
      y: pad.y,
      t: 0,
      omur: 0.42,
      siddet: olay.siddet,
      r0: pad.r * 0.7,
    });
    this.efektler.push({ tip: "patlama", x: pad.x, y: pad.y, t: 0, omur: 0.5, siddet: olay.siddet });
    this.sarsinti = Math.min(14, this.sarsinti + 3 + olay.siddet * 0.05);
    this.sesler.push(olay.siddet > 75 ? "vurus-sert" : "vurus");
    if (this.combo === 3 || this.combo === 6 || this.combo === 10 || this.combo === 15) {
      this.sesler.push("combo");
      this.konusmalar.push({ tip: "combo", combo: this.combo });
    }
  }

  /** Yumruk olayını pad'lerle eşleştirir. */
  _yumrukIsle(olay, W, H) {
    this.ist.toplamYumruk++;
    this.ist.yumruk[olay.no] = (this.ist.yumruk[olay.no] || 0) + 1;
    if (olay.el === "sol") this.ist.solYumruk++;
    else this.ist.sagYumruk++;
    this.ist.siddetToplam += olay.siddet;
    this.ist.siddetMax = Math.max(this.ist.siddetMax, olay.siddet);
    this.ist.hizToplam += olay.hiz;
    // Gerçek zamanlı açık tespiti: bu yumruğu atarken DİĞER el düşük müydü?
    if (olay.karsiGardDusuk) this.ist.vurustaAcikGard++;
    this._tempoSayac++;
    this._tempoPencere.push(this._t);
    this._sonYumrukT = this._t;

    if (this.faz !== "round" || this.mod === "savunma") return;

    const birim = this.tanima.birim || Math.min(W, H) * 0.18;
    const tolerans = birim * PAD_TOLERANS;

    // En yakın pad (vuruş noktasına göre)
    let hedef = null;
    let enYakin = Infinity;
    for (const pad of this.padler) {
      if (pad.vuruldu) continue;
      const d = Math.hypot(pad.x - olay.x, pad.y - olay.y);
      if (d < pad.r + tolerans && d < enYakin) {
        enYakin = d;
        hedef = pad;
      }
    }
    if (!hedef) return; // boş yumruk — sayılır ama puan yok (ceza da yok)

    // Koç modunda SIRA önemlidir: sıradaki pad değilse sayılmaz.
    if (this.mod === "koc" && this.komut && !hedef.sirali) return;

    if (hedef.no === olay.no) {
      this._isabet(hedef, olay);
      if (this.mod === "koc" && this.komut) {
        this.komut.indeks++;
        this.padler.length = 0;
        if (this.komut.indeks >= this.komut.dizi.length) {
          this.komut = null;
          this._komutBekle = 0.55;
          this.konusmalar.push({ tip: "kombo-tamam" });
        } else {
          this._padEkle(this.komut.dizi[this.komut.indeks], W, H, { sirali: true });
        }
      }
    } else {
      // Doğru pad, yanlış yumruk türü → pad titrer, puan yok, ceza yok.
      this.ist.yanlisTur++;
      hedef.titre = 0.35;
      this.sesler.push("yanlis");
    }
  }

  // ---------------- sağlık/güvenlik gözetimi ----------------
  _saglikGozet(dt) {
    // Anlık tempo (son 15 sn) — hem canlı gösterge hem yorgunluk/efor gözetimi.
    while (this._tempoPencere.length && this._t - this._tempoPencere[0] > 15) {
      this._tempoPencere.shift();
    }
    this.tempoAnlik = Math.round((this._tempoPencere.length / 15) * 60);

    if (this.faz !== "round") return;
    // Aşırı efor: uzun süre çok yüksek tempo → nazik mola önerisi (tıbbi iddia yok).
    if (!this._eforUyarildi && this.tempoAnlik > 95 && this._t > 50) {
      this._eforUyarildi = true;
      this.uyarilar.push({
        tip: "efor",
        metin: "Temponu çok yüksek tutuyorsun. Nefesini toparla — molada su iç, omuzlarını gevşet.",
      });
      this.konusmalar.push({ tip: "efor" });
    }
    // Yorgunluk: round'un ikinci yarısında tempo belirgin düştüyse.
    const gecen = this.z.sure - this.fazSure;
    if (
      !this._yorgunlukUyarildi &&
      gecen > this.z.sure * 0.6 &&
      this.ist.tempoDilim.length >= 2
    ) {
      const ilk = this.ist.tempoDilim[0];
      const son = this.ist.tempoDilim[this.ist.tempoDilim.length - 1];
      if (ilk >= 6 && son < ilk * 0.62) {
        this._yorgunlukUyarildi = true;
        this.uyarilar.push({ tip: "tempo", metin: "Tempo düşüyor — ellerini yukarıda tut, kısa kombinasyonlara dön." });
        this.konusmalar.push({ tip: "tempo-dusuyor" });
      }
    }
    // Postür: yalnız kalça görünüyorsa üretilir (adaptif kapsam).
    const p = this.tanima.postur;
    if (p && p.uyari) {
      this.ist.posturUyari++;
      this.uyarilar.push({ tip: "postur", metin: "Gövdeni dikleştir — omuz ve kalça aynı hizada, sırtın nötr kalsın." });
      this.konusmalar.push({ tip: "postur" });
    }
  }

  // ---------------- ana güncelleme ----------------
  /**
   * @param {number} dt saniye
   * @param {object} veri
   * @param {object|null} veri.pozHam  posetakip.poz (ham normalize)
   * @param {number} veri.damga        poz algılama kare numarası (yeni veri işareti)
   * @param {(nx:number,ny:number)=>{x:number,y:number}} veri.harita ekran eşleyici
   * @param {number} veri.W
   * @param {number} veri.H
   */
  guncelle(dt, { pozHam, damga = 0, harita, W, H }) {
    // Tavan 0.1 sn: kare atlandığında (sekme arka planda, GC duraklaması) oyun
    // ağır çekime düşmesin — 0.05 tavanı 20 fps altında görünür yavaşlama
    // yapıyordu ve "akmıyor" hissinin bir kısmı buradan geliyordu.
    dt = Math.min(Math.max(dt, 0), 0.1);
    this._t += dt;
    this.nefes = 0.5 + 0.5 * Math.sin(this._t * Math.PI * 2 * NEFES_HZ);

    // ---- ham landmark → ekran uzayı ----
    let poz = null;
    if (pozHam && pozHam.noktalar) {
      const n = {};
      for (const idx in pozHam.noktalar) {
        const p = pozHam.noktalar[idx];
        const e = harita(p.x, p.y);
        n[idx] = { x: e.x, y: e.y, z: p.z, g: p.g };
      }
      poz = { n, dunya: pozHam.dunya || null };
    }
    this.poz = poz;
    // Tanıma YALNIZ yeni bir poz algılama karesinde çalışır: aynı landmark'la
    // tekrar hesaplamak hızı sıfıra çeker (yumruk tepe/yavaşlama ölçümü bozulur).
    // Biriken süre dt olarak verilir → hız/gard süresi gerçek zamanla ölçülür.
    this._tanimaDt = (this._tanimaDt || 0) + dt;
    if (damga !== this._sonPozDamga) {
      this._sonPozDamga = damga;
      const kapsam = pozHam ? kapsamHesap(pozHam) : kapsamHesap(null);
      this.tanima.guncelle(Math.min(0.2, this._tanimaDt), { poz, kapsam });
      this._tanimaDt = 0;
      this.ist.kapsam = { ...kapsam };
    }

    // ---- yumruk olayları ----
    const olaylar = this.tanima.olaylar;
    if (olaylar.length) {
      for (const o of olaylar) this._yumrukIsle(o, W, H);
      olaylar.length = 0;
    }
    // Anlık düşük gard olayları round sayacına yazılır.
    if (this.tanima.gardOlaylari.length) {
      if (this.faz === "round") this.ist.dusukGardOlay += this.tanima.gardOlaylari.length;
      this.tanima.gardOlaylari.length = 0;
    }

    this._saglikGozet(dt);

    // ---- faz süresi ----
    this.fazSure -= dt;
    if (this.fazSure <= 0 && this.faz !== "bitti") {
      this.fazSure = 0;
      this._fazGec();
    }

    // ---- tempo dilimleri (10 sn) ----
    if (this.faz === "round") {
      this._tempoDilimT += dt;
      if (this._tempoDilimT >= 10) {
        this._tempoDilimT -= 10;
        this.ist.tempoDilim.push(this._tempoSayac);
        this._tempoSayac = 0;
      }
    }

    // ---- hedef üretimi ----
    if (this.faz === "round") {
      if (this.mod === "savunma") {
        this._spawn -= dt;
        if (this._spawn <= 0) {
          this._tehditUret(W, H);
          this._spawn = this.z.aralik * (1.25 + Math.random() * 0.5);
        }
      } else if (this.mod === "koc") {
        if (!this.komut) {
          this._komutBekle -= dt;
          if (this._komutBekle <= 0) this._komutBaslat(W, H);
        }
      } else if (this.mod === "ritim") {
        // Pad'ler beat'e senkron çıkar; vuruş beat'e yakınsa "mükemmel".
        const beatSure = 60 / this.bpm;
        this._beatSayac += dt;
        if (this._beatSayac >= beatSure) {
          this._beatSayac -= beatSure;
          this.beat++;
          this.sesler.push(this.beat % 4 === 0 ? "beat-vurgu" : "beat");
          // Her 2. beat'te pad (zorluğa göre her beat)
          const her = this.zorlukAd === "pro" || this.zorlukAd === "zor" ? 1 : 2;
          if (this.beat % her === 0) {
            const no = 1 + ((Math.random() * 6) | 0);
            this._padEkle(no, W, H, { beatT: this._t + beatSure * 1.5 });
          }
        }
      } else {
        this._spawn -= dt;
        if (this._spawn <= 0) {
          const kac = this.z.esZaman > 1 && Math.random() < 0.35 ? 2 : 1;
          for (let i = 0; i < kac; i++) this._padUret(W, H);
          this._spawn = this.z.aralik * (0.8 + Math.random() * 0.45);
        }
      }
    }

    // ---- pad ömrü ----
    for (const pad of this.padler) {
      pad.t += dt;
      if (pad.titre > 0) pad.titre = Math.max(0, pad.titre - dt);
    }
    const kalan = [];
    for (const pad of this.padler) {
      if (pad.vuruldu) continue;
      if (pad.t >= pad.omur) {
        if (this.faz === "round") {
          this.ist.kacirma++;
          this.combo = 0;
          if (this.mod === "koc" && pad.sirali && this.komut) {
            // Kombinasyon kaçtı → yeni kombinasyon ver (ceza yok).
            this.komut = null;
            this._komutBekle = 0.5;
          }
        }
        continue;
      }
      kalan.push(pad);
    }
    this.padler = kalan;

    // ---- savunma tehditleri ----
    for (const th of this.tehditler) {
      th.t += dt;
      if (!th.cozuldu && th.t >= th.telegraph) this._tehditCoz(th);
    }
    this.tehditler = this.tehditler.filter((th) => th.t < th.telegraph + 0.35);

    // ---- efektler / popuplar ----
    for (const e of this.efektler) e.t += dt;
    this.efektler = this.efektler.filter((e) => e.t < e.omur);
    for (const p of this.popuplar) {
      p.t += dt;
      p.y -= 55 * dt;
    }
    this.popuplar = this.popuplar.filter((p) => p.t < p.omur);
    this.sarsinti = Math.max(0, this.sarsinti - dt * 44);

    // Combo penceresi dolduysa seri biter.
    if (this.combo > 0 && this._t - this._sonIsabet > COMBO_PENCERE) this.combo = 0;

    // Kuyruklar tüketilmezse (başsız test) sonsuz büyümesin.
    if (this.sesler.length > 24) this.sesler.splice(0, this.sesler.length - 24);
    if (this.konusmalar.length > 12) this.konusmalar.splice(0, this.konusmalar.length - 12);
    if (this.uyarilar.length > 8) this.uyarilar.splice(0, this.uyarilar.length - 8);
  }

  /** Antrenmanı erken bitirir (oyuncu çıkarsa kaydedilecek veri tutarlı kalsın). */
  bitir() {
    if (this.faz === "bitti") return;
    if (this.faz === "round") this._roundKapat();
    this.faz = "bitti";
  }
}
