// ============================================================
// GÖLGE BOKS — yumruk sınıflandırma (6 standart boks numarası)
//
// GİRDİ: her karede EKRAN uzayına eşlenmiş poz noktaları (omuz/dirsek/bilek/
// parmak kökleri/kafa/kalça). ÇIKTI: darbe anında üretilen yumruk olayları +
// sürekli izlenen gard/postür/kafa durumu.
//
// TEK MODEL: ayrı bir el (HandLandmarker) modeli YOKTUR. El ölçeği — düz
// yumrukta derinlik ilerlemesinin tek güvenilir işareti — bileğin kendi parmak
// köklerine (serçe 17/18, işaret 19/20) olan mesafesinden okunur. Bu ölçü zaten
// doğru kola aittir; eski "el landmark'ını en yakın bileğe ata" adımı ve onun
// ürettiği sahte yumruk riski tümüyle ortadan kalkmıştır.
//
// ---- Ölçü birimi ----
// Tüm mesafeler `birim` (px) ile normalize edilir; birim = oyuncunun gövde
// ölçeğidir. Ham omuz genişliği TEK BAŞINA yetmez: boks duruşunda gövde yana
// döner ve 2D omuz genişliği %40'a kadar küçülür — bu, tüm eşikleri kaydırır.
// Bu yüzden birim = max(omuz genişliği, kulaklar arası × KAFA_ORAN) alınır ve
// EMA ile yumuşatılır (kişi kameraya yaklaşıp uzaklaştıkça yavaşça uyum sağlar).
//
// ---- Yumruk tespiti (kol başına durum makinesi) ----
//   bekle → itme → (darbe olayı) → toparla → bekle
// İtme, uzanma hızının (du/dt) ve bilek hızının eşiği aşmasıyla başlar. DARBE
// ANI = uzanmanın tepe noktası ya da ani yavaşlama (deceleration) — gerçek boksta
// da "impact" budur; şiddet skorunun ölçüldüğü an da burasıdır.
//
// ---- Sınıflandırma ----
// İtme fazının toplam vektöründen üç bileşen çıkarılır:
//   ileri  = derinlik ilerlemesi (el ölçeği büyümesi + poz z) → düz yumruk
//   yanal  = |Δx|, dirsek dışa açılmasıyla desteklenir        → hook
//   yukarı = -Δy, bilek gövde altından başlar                 → uppercut
// Ön/arka el kimliği DURUŞTAN gelir (ortodoks/güney pençe) → 1..6 numarası.
// Solak (güney pençe) modda numaralandırma aynalanır; "açık" tespitleri de.
//
// ---- Dürüstlük ilkesi ----
// Kamerada Newton ölçülemez. `siddet` bir kuvvet değil, oyuncunun KENDİ
// ortalamasına göre normalize edilmiş GÖRECE yoğunluk skorudur (0-100).
// Görünmeyen vücut bölgeleri için hiçbir varsayım yapılmaz (bkz. posetakip
// kapsam kuralı): kalça görünmüyorsa postür analizi hiç üretilmez.
// ============================================================

import { P, GORUNUR_ESIK } from "./posetakip.js";

// ---- Duruş ----
export const ORTODOKS = "ortodoks";
export const GUNEY_PENCE = "guney_pence";

// ---- Yumruk türleri ve numaraları ----
export const TUR = { DUZ: "duz", HOOK: "hook", UPPERCUT: "uppercut" };
export const YUMRUK_AD = {
  1: "Jab",
  2: "Cross",
  3: "Ön Hook",
  4: "Arka Hook",
  5: "Ön Uppercut",
  6: "Arka Uppercut",
};
export const YUMRUK_KISA = { 1: "JAB", 2: "CROSS", 3: "HOOK", 4: "HOOK", 5: "UPPER", 6: "UPPER" };

// ---- Eşikler (hepsi `birim` cinsinden; ekran/kişi ölçeğinden bağımsız) ----
const KAFA_ORAN = 2.55; // kulaklar arası × bu ≈ omuz genişliği
// Birim EMA hızlandırıldı (0.12 → 0.2): boks duruşunda gövde sürekli döndüğü
// için ölçü birimi yavaş uyum sağlarsa tüm eşikler kayıyor ve yumruk ıskalanıyordu.
const BIRIM_EMA = 0.2; // birim yumuşatma katsayısı
const BIRIM_MIN = 24; // px — absürt küçük ölçek koruması

// KOL NOKTASI HAFIZASI: hızlı yumrukta bilek hareket bulanıklığına girer ve
// modelin görünürlük skoru bir-iki kare 0.55'in altına düşer. Eski kod bu
// durumda kolu "görünmüyor" sayıp durum makinesini SIFIRLIYORDU → yumruk tam
// darbe anında kayboluyordu ("vurdum ama görmedi"). Artık kol noktaları için
// gevşek eşik + kısa hafıza kullanılır: nokta kaybolursa son bilinen konum
// KOL_HAFIZA süresince geçerli sayılır, faz korunur.
const KOL_ESIK = 0.3; // kol noktaları için gevşek görünürlük eşiği
const KOL_HAFIZA = 0.22; // sn — nokta kaybolduğunda son konumun geçerlilik süresi

// EŞİK KALİBRASYONU: ilk sürümde eşikler o kadar sıkıydı ki gerçek yumrukların
// bir kısmı hiç sayılmıyordu ("vurdum ama saymadı" hissi). Poz takibi ~30 Hz
// örneklediği için hızlı bir yumruk yalnız 4-5 kare sürer ve tepe hız kolayca
// ıskalanır. Eşikler ~%20 gevşetildi; durgun vücutta sahte yumruk üretmediği
// _test/motor-test.mjs ile doğrulanıyor.
const ITME_UZANMA_HIZ = 0.85; // birim/sn — uzanma bu hızla artıyorsa yumruk başladı
const ITME_BILEK_HIZ = 1.25; // birim/sn — ya da etkin hız bu eşiği aşıyorsa
// DERİNLİK EKSENİ: kameraya doğru atılan DÜZ yumrukta bilek ekranda neredeyse
// hiç yer değiştirmez — 2D hız ölçütü tek başına jab/cross'u ıskalar. El ölçeği
// (bilek→orta parmak kökü) kameraya yaklaşınca büyür; bu büyümenin GÖRECELİ
// hızı, ekran düzlemindeki hıza eklenerek "etkin hız" elde edilir.
const OLCEK_HIZ_KATKI = 0.55; // ölçek büyüme hızının etkin hıza katkısı
const OLCEK_TABAN_PX = 6; // çok küçük el ölçeğinde oranın patlamasını engeller
// Parmak kökleri poz modelinde bilekten daha gürültülüdür: ölçek için ayrı
// (gevşek) görünürlük eşiği ve hafif EMA kullanılır. Ölçek okunamazsa 0 döner
// ve sistem sessizce 2D ölçüme düşer — uydurma derinlik üretilmez.
const PARMAK_ESIK = 0.35;
const OLCEK_EMA = 0.5;
const MIN_UZANMA_ARTIS = 0.1; // birim — bundan az açılan kol yumruk sayılmaz
const MIN_TEPE_HIZ = 1.35; // birim/sn — darbe için gereken asgari tepe hızı
const DARBE_YAVASLAMA = 0.55; // tepe hızın bu oranına düşünce darbe anı
// 30 Hz örneklemede tepe/yavaşlama karesi tamamen atlanabilir (yumruk 3-4 kare
// sürer). İkinci bir darbe kapısı: kol geri dönmeye BAŞLADIYSA darbe olmuştur.
const GERI_BASLADI = 0.05; // birim — uzanma tepeden bu kadar geri düştüyse
const ITME_MAX_SURE = 0.6; // sn — bundan uzun süren hareket yumruk değil (itiş/uzanma)
const TOPARLA_SURE = 0.1; // sn — darbeden sonra yeni yumruk için asgari bekleme
// Hızlı çift jab'da kol tam geri çekilmez; eski 0.1/0.5 sn değerleri ikinci
// yumruğu yutuyordu.
const GERI_CEKME = 0.06; // birim — kol bu kadar geri çekilince tekrar hazır
const TOPARLA_TAVAN = 0.28; // sn — geri çekiş okunamasa bile bu süre sonunda hazır

// NİŞAN NOKTASI: kameraya doğru atılan düz yumrukta bilek EKRANDA neredeyse hiç
// yer değiştirmez — pedle karşılaştırılacak nokta olarak bilek kullanılırsa
// isabet hiç oluşmaz ("hedefe denk getiremiyorum"). Bu yüzden darbe anında
// bilek, kolun yönünde (omuz→bilek) derinlik ilerlemesi kadar ileri taşınır:
// yumruğun gerçekte "vardığı" nokta budur. Hook/uppercut'ta zaten ilerleme
// ekranda görünür olduğundan taşıma kendiliğinden küçülür.
const NISAN_ILERI = 1.5; // derinlik ilerlemesinin nişan taşımasına katkısı
const NISAN_MAX = 1.0; // birim — azami taşıma

// Sınıflandırma eşikleri
const UPPER_ORAN = 0.5; // yukarı bileşen toplamın bu oranını aşarsa uppercut
const UPPER_MIN = 0.18; // birim — asgari yukarı yol
const HOOK_ORAN = 0.85; // yanal / ileri oranı bunun üstündeyse hook
const HOOK_MIN = 0.2; // birim — asgari yanal yol
const DIRSEK_HOOK_ACI = 0.28; // birim — dirseğin gövdeden dışa açılması

// Gard
const GARD_DUSUK_ESIK = 0.62; // birim — bilek burundan bu kadar aşağıdaysa gard düşük
const GARD_MESAFE_ESIK = 1.25; // birim — el kafadan bu kadar uzaksa gard açık sayılır
const GARD_OLAY_ARALIK = 0.7; // sn — aynı elin düşük gard olayı bu sıklıktan fazla sayılmaz

// Postür (yalnız kalça görünüyorsa)
const POSTUR_ACI_ESIK = 24; // derece — gövde ekseninin dikeyden sapması
const POSTUR_SURE = 1.6; // sn — bu kadar sürekli bozuksa uyarı

// Şiddet normalizasyonu
const SIDDET_EMA = 0.12;
const SIDDET_MIN_ORNEK = 4; // bu kadar yumruktan önce skor "kalibre ediliyor"

function uzaklik(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Duruşa göre hangi anatomik el ÖNDE? */
export function onEl(durus) {
  return durus === GUNEY_PENCE ? "sag" : "sol";
}

/** Yumruk türü + el konumundan 1-6 numarası. */
export function yumrukNo(tur, on) {
  if (tur === TUR.DUZ) return on ? 1 : 2;
  if (tur === TUR.HOOK) return on ? 3 : 4;
  return on ? 5 : 6;
}

/** 1-6 numarasından tür/el bilgisi (koç modu komutları için). */
export function noBilgi(no, durus) {
  const on = no === 1 || no === 3 || no === 5;
  const tur = no <= 2 ? TUR.DUZ : no <= 4 ? TUR.HOOK : TUR.UPPERCUT;
  const el = on ? onEl(durus) : onEl(durus) === "sol" ? "sag" : "sol";
  return { no, tur, on, el, ad: YUMRUK_AD[no] };
}

class Kol {
  constructor(taraf) {
    this.taraf = taraf; // 'sol' | 'sag' (anatomik)
    this.faz = "bekle";
    this.uzanma = 0;
    this.uzanmaHiz = 0;
    this.hiz = 0; // bilek hızı (birim/sn)
    this.gorunur = false;
    this.gardDusuk = false;
    this.gardYukseklik = 0; // birim — (+) düşük, (-) yüksek
    this._sonBilek = null;
    this._sonUzanma = null;
    this._sonOlcek = 0;
    this._olcekEma = 0;
    // Kısa süreli landmark kaybında kullanılan son bilinen konumlar.
    this._hafiza = { omuz: null, dirsek: null, bilek: null };
    this._sonT = 0;
    this._sonGardOlay = -10;
    this._sonDarbe = -10;
    // itme fazı kaydı
    this._t0 = 0;
    this._u0 = 0;
    this._p0 = null;
    this._dirsek0 = null;
    this._olcek0 = 1;
    this._maxHiz = 0;
    this._maxUzanma = 0;
    this._zIlerleme = 0;
  }
}

export class YumrukTanima {
  constructor({ durus = ORTODOKS } = {}) {
    this.durus = durus === GUNEY_PENCE ? GUNEY_PENCE : ORTODOKS;
    this.olaylar = []; // tüketen boşaltır
    this.gardOlaylari = []; // { el, t } — anlık düşük gard olayları
    this.kollar = { sol: new Kol("sol"), sag: new Kol("sag") };
    this.birim = 0;
    this.kafa = null; // { x, y, hiz }
    this.govde = null; // { x, y } omuz ortası
    this.postur = null; // { aci, bozuk } | null (kalça görünmüyorsa null)
    this.kapsam = { ustGovde: false, kollar: false, kalca: false, bacaklar: false };
    this.gardDusukSure = 0; // sn — round boyunca toplam düşük gard süresi
    this.olcuSure = 0; // sn — gardın ölçülebildiği toplam süre (oran için)
    this._t = 0;
    this._sonKafa = null;
    this._posturBozukSure = 0;
    this._siddetOrt = 0;
    this._siddetOrnek = 0;
  }

  durusAyarla(d) {
    this.durus = d === GUNEY_PENCE ? GUNEY_PENCE : ORTODOKS;
  }

  /** Round başında sayaçları sıfırlar (kalibrasyon korunur: kişi aynı kişi). */
  roundSifirla() {
    this.gardDusukSure = 0;
    this.olcuSure = 0;
    this._posturBozukSure = 0;
    this.olaylar.length = 0;
    this.gardOlaylari.length = 0;
  }

  /** Şiddet kalibrasyonu (kişi/kamera mesafesi değişince). */
  kalibrasyonSifirla() {
    this._siddetOrt = 0;
    this._siddetOrnek = 0;
  }

  get kalibreEdiliyor() {
    return this._siddetOrnek < SIDDET_MIN_ORNEK;
  }

  /**
   * @param {number} dt saniye
   * @param {object} veri
   * @param {object|null} veri.poz  ekran uzayında { n: {idx:{x,y,z,g}} }
   * @param {object} veri.kapsam    posetakip.kapsamHesap çıktısı
   */
  guncelle(dt, { poz, kapsam }) {
    this._t += dt;
    this.kapsam = kapsam || this.kapsam;
    if (!poz || !poz.n) {
      this.kollar.sol.gorunur = false;
      this.kollar.sag.gorunur = false;
      return;
    }
    const n = poz.n;
    const gor = (idx) => {
      const p = n[idx];
      return p && p.g >= GORUNUR_ESIK ? p : null;
    };

    // ---- ölçü birimi ----
    const so = gor(P.SOL_OMUZ);
    const sa = gor(P.SAG_OMUZ);
    const kSol = gor(P.SOL_KULAK);
    const kSag = gor(P.SAG_KULAK);
    let aday = 0;
    if (so && sa) aday = Math.max(aday, uzaklik(so, sa));
    if (kSol && kSag) aday = Math.max(aday, uzaklik(kSol, kSag) * KAFA_ORAN);
    if (aday > BIRIM_MIN) {
      this.birim = this.birim > 0 ? this.birim + (aday - this.birim) * BIRIM_EMA : aday;
    }
    const birim = this.birim;
    if (!(birim > BIRIM_MIN)) return; // gövde ölçeği okunamıyor → analiz yok

    // ---- kafa ----
    const burun = gor(P.BURUN);
    if (burun) {
      const hiz = this._sonKafa
        ? uzaklik(burun, this._sonKafa) / Math.max(0.008, dt) / birim
        : 0;
      this.kafa = { x: burun.x, y: burun.y, hiz };
      this._sonKafa = { x: burun.x, y: burun.y };
    } else {
      this.kafa = null;
      this._sonKafa = null;
    }
    this.govde = so && sa ? { x: (so.x + sa.x) / 2, y: (so.y + sa.y) / 2 } : null;

    // ---- postür (yalnız kalça görünüyorsa; yoksa HİÇ üretilmez) ----
    const kalSol = gor(P.SOL_KALCA);
    const kalSag = gor(P.SAG_KALCA);
    if (this.govde && kalSol && kalSag) {
      const kx = (kalSol.x + kalSag.x) / 2;
      const ky = (kalSol.y + kalSag.y) / 2;
      const dx = this.govde.x - kx;
      const dy = this.govde.y - ky; // negatif (omuz yukarıda)
      const aci = (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
      const bozuk = aci > POSTUR_ACI_ESIK;
      this._posturBozukSure = bozuk ? this._posturBozukSure + dt : 0;
      this.postur = { aci, bozuk, uyari: this._posturBozukSure > POSTUR_SURE };
      if (this.postur.uyari) this._posturBozukSure = 0; // uyarı bir kez tetiklensin
    } else {
      this.postur = null;
      this._posturBozukSure = 0;
    }

    // ---- kollar ----
    const tanim = [
      {
        taraf: "sol",
        omuz: P.SOL_OMUZ,
        dirsek: P.SOL_DIRSEK,
        bilek: P.SOL_BILEK,
        serce: P.SOL_SERCE,
        isaret: P.SOL_ISARET,
      },
      {
        taraf: "sag",
        omuz: P.SAG_OMUZ,
        dirsek: P.SAG_DIRSEK,
        bilek: P.SAG_BILEK,
        serce: P.SAG_SERCE,
        isaret: P.SAG_ISARET,
      },
    ];
    let gardOlculdu = false;
    let gardDusukVar = false;

    // Parmak kökü ölçüsü (gevşek eşik — yalnız EL ÖLÇEĞİ için kullanılır).
    const parmak = (idx) => {
      const p = n[idx];
      return p && p.g >= PARMAK_ESIK ? p : null;
    };

    // Kol noktası: gevşek eşik + kısa hafıza. Hızlı yumrukta bulanıklık yüzünden
    // bir-iki kare kaybolan bilek, durum makinesini artık sıfırlamaz.
    const kolNokta = (idx, kol, ad) => {
      const p = n[idx];
      if (p && p.g >= KOL_ESIK) {
        const h = kol._hafiza[ad] || (kol._hafiza[ad] = { x: 0, y: 0, t: 0 });
        h.x = p.x;
        h.y = p.y;
        h.t = this._t;
        return p;
      }
      const h = kol._hafiza[ad];
      return h && this._t - h.t < KOL_HAFIZA ? h : null;
    };

    for (const t of tanim) {
      const kol = this.kollar[t.taraf];
      const omuz = kolNokta(t.omuz, kol, "omuz");
      const dirsek = kolNokta(t.dirsek, kol, "dirsek");
      const bilek = kolNokta(t.bilek, kol, "bilek");
      if (!omuz || !bilek) {
        kol.gorunur = false;
        kol.faz = "bekle";
        kol._sonBilek = null;
        kol._sonUzanma = null;
        kol._sonOlcek = 0;
        kol._olcekEma = 0;
        continue;
      }
      kol.gorunur = true;

      // ---- el ölçeği (derinlik proxy'si) ----
      // bilek → parmak kökü mesafesi: el kameraya yaklaştıkça büyür. İki kök de
      // görünüyorsa ortalaması alınır (tek noktanın seğirmesi sönümlenir).
      const pSerce = parmak(t.serce);
      const pIsaret = parmak(t.isaret);
      let hamOlcek = 0;
      if (pSerce && pIsaret) hamOlcek = (uzaklik(bilek, pSerce) + uzaklik(bilek, pIsaret)) / 2;
      else if (pIsaret) hamOlcek = uzaklik(bilek, pIsaret);
      else if (pSerce) hamOlcek = uzaklik(bilek, pSerce);
      if (hamOlcek > 0) {
        kol._olcekEma =
          kol._olcekEma > 0 ? kol._olcekEma + (hamOlcek - kol._olcekEma) * OLCEK_EMA : hamOlcek;
      } else {
        kol._olcekEma = 0;
      }
      const elOlcek = kol._olcekEma;

      // Uzanma: 2D kol açılımı + (yalnız itme fazında) derinlik ilerlemesi.
      // Bekle fazında ölçek referansı sürekli tazelenir; böylece oyuncu kameraya
      // yaklaşıp uzaklaştığında sahte "uzanma" üretilmez.
      const dtG = Math.max(0.008, dt);
      if (kol.faz !== "itme" && elOlcek > 0) kol._olcek0 = elOlcek;
      const zProxy =
        kol.faz === "itme" && elOlcek > 0 && kol._olcek0 > 0 ? elOlcek / kol._olcek0 - 1 : 0;
      const ham2D = uzaklik(bilek, omuz) / birim;
      const uzanma = ham2D + Math.max(0, zProxy) * 0.9;

      const bilekHiz = kol._sonBilek ? uzaklik(bilek, kol._sonBilek) / dtG / birim : 0;
      // El ölçeğinin göreli büyüme hızı (1/sn) → derinlikte ilerleme hızı.
      const olcekHiz =
        elOlcek > 0 && kol._sonOlcek > 0
          ? (elOlcek - kol._sonOlcek) / dtG / Math.max(OLCEK_TABAN_PX, kol._sonOlcek)
          : 0;
      const etkinHiz = bilekHiz + Math.max(0, olcekHiz) * OLCEK_HIZ_KATKI;
      const uzanmaHiz = kol._sonUzanma != null ? (uzanma - kol._sonUzanma) / dtG : 0;
      kol.uzanma = uzanma;
      kol.hiz = etkinHiz;
      kol.uzanmaHiz = uzanmaHiz;

      // ---- gard izleme (her karede, vuruş anından bağımsız) ----
      if (burun) {
        kol.gardYukseklik = (bilek.y - burun.y) / birim;
        const uzak = uzaklik(bilek, burun) / birim > GARD_MESAFE_ESIK;
        // Yumruk atarken o kolun kendisi zaten uzakta olur → yalnız BEKLE/TOPARLA
        // fazındaki kol gard için değerlendirilir.
        const serbest = kol.faz === "bekle" || kol.faz === "toparla";
        kol.gardDusuk = serbest && (kol.gardYukseklik > GARD_DUSUK_ESIK || uzak);
        gardOlculdu = true;
        if (kol.gardDusuk) gardDusukVar = true;
      }

      // ---- durum makinesi ----
      if (kol.faz === "bekle") {
        if (
          (uzanmaHiz > ITME_UZANMA_HIZ || etkinHiz > ITME_BILEK_HIZ) &&
          this._t - kol._sonDarbe > TOPARLA_SURE
        ) {
          kol.faz = "itme";
          kol._t0 = this._t;
          kol._u0 = uzanma;
          kol._p0 = { x: bilek.x, y: bilek.y };
          kol._dirsek0 = dirsek ? { x: dirsek.x, y: dirsek.y } : null;
          kol._olcek0 = elOlcek > 0 ? elOlcek : kol._olcek0 || 1;
          kol._maxHiz = etkinHiz;
          kol._maxUzanma = uzanma;
          kol._zIlerleme = 0;
        }
      } else if (kol.faz === "itme") {
        kol._maxHiz = Math.max(kol._maxHiz, etkinHiz);
        kol._maxUzanma = Math.max(kol._maxUzanma, uzanma);
        if (elOlcek > 0 && kol._olcek0 > 0) {
          kol._zIlerleme = Math.max(kol._zIlerleme, elOlcek / kol._olcek0 - 1);
        }
        const sure = this._t - kol._t0;
        const artis = kol._maxUzanma - kol._u0;
        const tepe = uzanmaHiz <= 0.15 || etkinHiz < kol._maxHiz * DARBE_YAVASLAMA;
        // İkinci kapı: tepe karesi hiç örneklenmese bile kol geri dönmeye
        // başladıysa darbe gerçekleşmiştir (30 Hz'de sık görülen durum).
        const geriDonus = kol._maxUzanma - uzanma > GERI_BASLADI;
        if (sure > ITME_MAX_SURE) {
          // Uzun süren yavaş uzanma yumruk değil (ör. eli kaldırma) → iptal.
          kol.faz = "toparla";
        } else if (
          (tepe && artis > MIN_UZANMA_ARTIS && kol._maxHiz > MIN_TEPE_HIZ) ||
          (geriDonus && artis > MIN_UZANMA_ARTIS * 0.78 && kol._maxHiz > MIN_TEPE_HIZ * 0.72)
        ) {
          this._darbe(kol, { x: bilek.x, y: bilek.y }, dirsek, omuz, birim, artis);
          kol.faz = "toparla";
          kol._sonDarbe = this._t;
        }
      } else if (kol.faz === "toparla") {
        if (uzanma < kol._maxUzanma - GERI_CEKME || this._t - kol._sonDarbe > TOPARLA_TAVAN) {
          kol.faz = "bekle";
        }
      }

      kol._sonBilek = { x: bilek.x, y: bilek.y };
      kol._sonUzanma = uzanma;
      kol._sonOlcek = elOlcek;
      kol._sonT = this._t;
    }

    // ---- gard istatistiği (round analizinde "düşük gard oranı" olur) ----
    if (gardOlculdu) {
      this.olcuSure += dt;
      if (gardDusukVar) this.gardDusukSure += dt;
      for (const t of ["sol", "sag"]) {
        const kol = this.kollar[t];
        if (kol.gardDusuk && this._t - kol._sonGardOlay > GARD_OLAY_ARALIK) {
          kol._sonGardOlay = this._t;
          this.gardOlaylari.push({ el: t, t: this._t });
        }
      }
    }
  }

  /** Darbe anı: olayı üretir, şiddeti kişinin kendi ortalamasına normalize eder. */
  _darbe(kol, bilek, dirsek, omuz, birim, artis) {
    const p0 = kol._p0 || bilek;
    const dx = (bilek.x - p0.x) / birim;
    const dy = (bilek.y - p0.y) / birim;
    const ileri = Math.max(0, kol._zIlerleme) * 1.6 + Math.max(0, artis) * 0.6;
    const yanal = Math.abs(dx);
    const yukari = Math.max(0, -dy);

    // Dirsek dışa açıldıysa hook lehine ek kanıt (hook'ta dirsek gövdeden ayrılır).
    let dirsekAcilma = 0;
    if (dirsek && kol._dirsek0) {
      dirsekAcilma = Math.abs(dirsek.x - kol._dirsek0.x) / birim;
    }

    const toplam = ileri + yanal + yukari || 1;
    let tur;
    if (yukari > toplam * UPPER_ORAN && yukari > UPPER_MIN && yukari > yanal) {
      tur = TUR.UPPERCUT;
    } else if (
      (yanal > ileri * HOOK_ORAN || dirsekAcilma > DIRSEK_HOOK_ACI) &&
      yanal > HOOK_MIN &&
      yanal > yukari
    ) {
      tur = TUR.HOOK;
    } else {
      tur = TUR.DUZ;
    }

    const on = kol.taraf === onEl(this.durus);
    const no = yumrukNo(tur, on);

    // ---- görece şiddet (kuvvet DEĞİL) ----
    // Bileşenler: tepe hız × uzanma tamlığı × ani yavaşlama sertliği.
    const uzanmaOrani = Math.min(1.4, artis / 0.55);
    const yavaslama = Math.min(1.5, kol._maxHiz / Math.max(0.4, kol.hiz + 0.4));
    const ham = kol._maxHiz * (0.55 + 0.45 * uzanmaOrani) * (0.75 + 0.25 * yavaslama);
    this._siddetOrnek++;
    this._siddetOrt = this._siddetOrt > 0 ? this._siddetOrt + (ham - this._siddetOrt) * SIDDET_EMA : ham;
    // Kendi ortalamasına oran → 0-100 skor (100 = ortalamanın ~1.6 katı).
    const oran = this._siddetOrt > 0 ? ham / this._siddetOrt : 1;
    const siddet = Math.max(5, Math.min(100, Math.round((oran / 1.6) * 100)));

    // Karşı el o an gardını düşük mü tutuyordu? (gerçek zamanlı açık tespiti)
    const karsi = this.kollar[kol.taraf === "sol" ? "sag" : "sol"];
    const karsiGardDusuk = !!(karsi.gorunur && karsi.gardDusuk);

    // ---- nişan noktası (pedle eşleşecek gerçek "varış" noktası) ----
    // Bilek + kol yönünde derinlik ilerlemesi kadar taşıma. Düz yumrukta bilek
    // ekranda durur ama yumruk ileri gider; ped bu noktada aranmalıdır.
    let nx = bilek.x;
    let ny = bilek.y;
    if (omuz) {
      const ox = bilek.x - omuz.x;
      const oy = bilek.y - omuz.y;
      const boy = Math.hypot(ox, oy);
      if (boy > 1) {
        const tasi = Math.min(NISAN_MAX, Math.max(0, kol._zIlerleme) * NISAN_ILERI) * birim;
        nx += (ox / boy) * tasi;
        ny += (oy / boy) * tasi;
      }
    }

    this.olaylar.push({
      no,
      tur,
      on,
      el: kol.taraf,
      ad: YUMRUK_AD[no],
      x: bilek.x,
      y: bilek.y,
      nx,
      ny,
      hiz: kol._maxHiz,
      siddet,
      kalibre: this._siddetOrnek < SIDDET_MIN_ORNEK,
      uzanma: artis,
      karsiGardDusuk,
      karsiEl: karsi.taraf,
      t: this._t,
    });
  }
}
