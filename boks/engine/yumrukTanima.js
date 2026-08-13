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

// ============================================================
// TESPİT ÇEKİRDEĞİ (2026-08-13 RADİKAL REVİZYON)
//
// ESKİ YAKLAŞIM ve neden bırakıldı: hız kapılı bir durum makinesi vardı —
// yumruğun sayılması için AYNI ANDA (a) uzanma hızı eşiği, (b) bilek/etkin hız
// eşiği, (c) tepe ya da yavaşlama karesinin yakalanması, (d) asgari uzanma
// artışı gerekiyordu. 30 Hz'de bir yumruk 3-4 kare sürer; her kapı ayrı ayrı
// ıskalanabildiği için gerçek yumrukların bir kısmı sistematik olarak
// kayboluyordu. Eşikleri gevşetmek yalnız sahte tespit riskini büyüttü.
//
// YENİ YAKLAŞIM: kol başına TEK BİR ÖLÇEK — `uzanim` — üretilir ve yumruk, bu
// sinyalin bir TEPESİ olarak yakalanır. Hiçbir hız eşiği yoktur: yavaş da atsan
// hızlı da atsan, kol açılıp geri döndüyse yumruktur. Kare atlanması sonucu
// değiştirmez (tepe, örneklenen en yüksek değerdir).
//
//   uzanim = 0.45×(2D omuz→bilek / birim)      ← ekranda görünen açılım
//          + 0.85×duzluk                        ← izdüşümden BAĞIMSIZ açılım
//          + 0.50×el ölçeği büyümesi            ← derinlik (varsa)
//
//   duzluk = |bilek−omuz| / (|bilek−dirsek| + |dirsek−omuz|) ∈ [0,1]
//   Kol kameraya doğru uzanınca iki segment de kısalır ama üç nokta hizaya
//   girdiği için oran 1'e yaklaşır → kamera açısından bağımsız "kol açıldı mı".
//
// Üç kanal birbirinden BAĞIMSIZDIR: biri okunamazsa (parmak kökleri kayıp,
// dirsek görünmüyor, yumruk kameraya dik) diğerleri sinyali taşımaya devam eder.
//
// Tipik değerler (birim ölçeğinde): gard ≈ 0.45 · jab ≈ 1.25 · hook ≈ 1.10 ·
// uppercut ≈ 0.90. Gard salınımı ≈ ±0.07. Eşik 0.28 → her yumruk türü rahat
// geçer, gard gürültüsü 4 kat altında kalır.
// ============================================================

// ---- uzanim bileşen ağırlıkları ----
const UZATMA_AGIRLIK = 0.45;
const DUZLUK_AGIRLIK = 0.85;
const OLCEK_AGIRLIK = 0.5;
const DUZLUK_EMA = 0.7; // dirsek gürültüsünü sönümler (hızlı, gecikme yapmaz)
// Parmak kökleri poz modelinde bilekten daha gürültülüdür: ölçek için ayrı
// (gevşek) görünürlük eşiği ve hafif EMA kullanılır. Ölçek okunamazsa 0 döner
// ve sistem sessizce diğer iki kanala düşer — uydurma derinlik üretilmez.
const PARMAK_ESIK = 0.35;
const OLCEK_EMA = 0.5;
const OLCEK_TABAN_PX = 6; // çok küçük el ölçeğinde oranın patlamasını engeller

// ---- tepe yakalama ----
const YUKSELIS_ESIK = 0.28; // taban→tepe farkı bunu aşarsa yumruk adayı
const YUKSELIS_MAX_SURE = 0.7; // sn — daha yavaş açılan kol yumruk değil (uzanma/işaret)
const GERI_ESIK = 0.05; // tepeden bu kadar düşünce darbe kesinleşir (~1 kare)
// Geri çekiş beklemek gecikme demektir; ayrıca yumruk tepede DURABİLİR (temas
// anı). Tepe bu süre boyunca BELİRGİN biçimde artmadıysa darbe olmuştur.
// "Belirgin" şart: EMA'lı sinyaller tepede milimetrik sürünmeye devam eder ve
// saf "tepe artmadı" kuralı hiç tetiklenmezdi.
const TEPE_BEKLEME = 0.06; // sn — ~2 kare @30 Hz
const TEPE_ARTIS_MIN = 0.03; // bu kadar artmayan tepe "duruyor" sayılır
// GARDI İNDİRME REDDİ: kol yana sarktığında da DÜZLEŞİR ve uzanım büyür —
// yani düzlük kanıtı bu hareketi yumruktan ayırt edemez. Ayırt eden tek şey
// gerçek derinlik (elin kameraya YAKLAŞMASI) ve hareketin yönüdür: baskın
// biçimde aşağı inen, kameraya yaklaşmayan kol yumruk değildir.
const DUSUS_RED_Y = 0.5; // birim — bu kadar aşağı inen
const DUSUS_RED_YANAL = 1.5; // ve yanal yoldan bu kat fazla aşağı giden
const DUSUS_RED_OLCEK = 0.12; // ve el ölçeği bu kadar büyümeyen hareket reddedilir
const ATIS_ARALIK = 0.16; // sn — iki yumruk arası asgari süre
const TABAN_TAKIP = 0.02; // bu farkın altındaki değerler yeni taban sayılır
// TABAN SIKIŞMASI: sinyal tabanın biraz üstünde takılıp kalabilir (ör. yumruk
// sonrası el ölçeği referansı sıfırlandığı için uzanim bir kademe düşer, sonra
// gard değerine döner). O zaman "yükseliş" saatlerce sürüyormuş gibi görünür ve
// bir sonraki GERÇEK yumruk `YUKSELIS_MAX_SURE` kapısına takılıp elenir.
// Çözüm: sinyal DURGUNSA ve yükseliş yumruk eşiğine ulaşmadıysa taban bugüne
// çekilir. Gerçek yumruk sırasında tetiklenmez (tepe sürekli ilerler).
const TABAN_DURGUN = 0.2; // sn — tepe bu kadar süredir ilerlemiyorsa sinyal durgun
const TABAN_ZAMAN_ASIMI = 1.2; // sn — sonuçsuz uzun yükselişte son çare
const ITME_GORSEL_ESIK = 0.12; // render: "yumruk yolda" göstergesi eşiği
const TOPARLA_GORSEL = 0.2; // sn — darbeden sonra nişan halkasının kalma süresi

// Sınıflandırmada derinlik bileşeninin kaynakları (bkz. _darbe).
const ILERI_OLCEK = 1.6;
const ILERI_DUZLUK = 1.2;

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

/** Tepe/taban anındaki kol durumunun kopyası (sınıflandırma bunun üzerinden yapılır). */
function anlikKayit(bilek, dirsek, olcek, duzluk) {
  return {
    x: bilek.x,
    y: bilek.y,
    dx: dirsek ? dirsek.x : null,
    dy: dirsek ? dirsek.y : null,
    olcek,
    duzluk,
  };
}

class Kol {
  constructor(taraf) {
    this.taraf = taraf; // 'sol' | 'sag' (anatomik)
    this.faz = "bekle"; // yalnız görsel: bekle | itme | toparla
    this.uzanim = 0; // TEK tespit sinyali (bkz. tespit çekirdeği notu)
    this.duzluk = 0; // kol düzlüğü 0-1 (izdüşümden bağımsız açılım)
    this.uzanma = 0; // geriye dönük uyumluluk (= uzanim)
    this.hiz = 0; // son yükseliş hızı (uzanim/sn) — göstergeler için
    this.gorunur = false;
    this.gardDusuk = false;
    this.gardYukseklik = 0; // birim — (+) düşük, (-) yüksek
    this._olcekEma = 0;
    // Kısa süreli landmark kaybında kullanılan son bilinen konumlar.
    this._hafiza = { omuz: null, dirsek: null, bilek: null };
    this._sonGardOlay = -10;
    this._sonDarbe = -10;
    // ---- tepe yakalama durumu ----
    this.taban = 0; // son yerel asgari uzanim
    this.tabanT = 0;
    this.tepe = 0; // taban'dan beri görülen azami uzanim
    this.tepeT = 0; // tepenin BELİRGİN olarak son arttığı an
    this._tepeIsaret = 0; // son belirgin artış değeri (EMA sürünmesi filtresi)
    this._tabanKayit = null;
    this._tepeKayit = null;
    this._baslatildi = false;
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
        kol._olcekEma = 0;
        kol._baslatildi = false; // yeniden görününce taban tazeden kurulur
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

      // ---- kol düzlüğü (izdüşümden bağımsız açılım) ----
      if (dirsek) {
        const zincir = uzaklik(bilek, dirsek) + uzaklik(dirsek, omuz);
        if (zincir > birim * 0.2) {
          const ham = Math.min(1, uzaklik(bilek, omuz) / zincir);
          kol.duzluk = kol.duzluk > 0 ? kol.duzluk + (ham - kol.duzluk) * DUZLUK_EMA : ham;
        }
      }

      // ---- TEK TESPİT SİNYALİ ----
      // El ölçeği katkısı TABANDAKİ ölçeğe göredir: oyuncu kameraya yaklaşıp
      // uzaklaştığında (taban da kaydığı için) sahte yükseliş üretmez.
      const tabanOlcek = kol._tabanKayit?.olcek || 0;
      const olcekArtis =
        elOlcek > 0 && tabanOlcek > 0
          ? Math.min(1, (elOlcek - tabanOlcek) / Math.max(OLCEK_TABAN_PX, tabanOlcek))
          : 0;
      const uzanim =
        (uzaklik(bilek, omuz) / birim) * UZATMA_AGIRLIK +
        kol.duzluk * DUZLUK_AGIRLIK +
        Math.max(0, olcekArtis) * OLCEK_AGIRLIK;
      kol.uzanim = uzanim;
      kol.uzanma = uzanim; // geriye dönük uyumluluk

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

      // ---- TEPE YAKALAMA (hız eşiği YOK) ----
      const kayit = anlikKayit(bilek, dirsek, elOlcek, kol.duzluk);
      const tabanaAl = () => {
        kol.taban = uzanim;
        kol.tabanT = this._t;
        kol.tepe = uzanim;
        kol.tepeT = this._t;
        kol._tepeIsaret = uzanim;
        kol._tabanKayit = kayit;
        kol._tepeKayit = kayit;
      };

      if (!kol._baslatildi) {
        // Kol yeni göründü: taban buradan kurulur, ilk kareden yumruk üretilmez.
        kol._baslatildi = true;
        tabanaAl();
      } else if (uzanim <= kol.taban + TABAN_TAKIP) {
        // Kol dinlenmede / geri döndü → taban sürekli yerel asgariyi takip eder.
        tabanaAl();
      } else {
        if (uzanim > kol.tepe) {
          const belirgin = uzanim > kol._tepeIsaret + TEPE_ARTIS_MIN;
          kol.tepe = uzanim;
          kol._tepeKayit = kayit;
          if (belirgin) {
            kol.tepeT = this._t;
            kol._tepeIsaret = uzanim;
          }
        }
        const yukselis = kol.tepe - kol.taban;
        const acilmaSuresi = kol.tepeT - kol.tabanT;
        // Darbe anı: kol geri dönmeye başladı YA DA tepede durdu (temas).
        const cozuldu = uzanim <= kol.tepe - GERI_ESIK || this._t - kol.tepeT >= TEPE_BEKLEME;
        if (
          yukselis >= YUKSELIS_ESIK &&
          acilmaSuresi <= YUKSELIS_MAX_SURE &&
          cozuldu &&
          this._t - kol._sonDarbe > ATIS_ARALIK
        ) {
          kol.hiz = yukselis / Math.max(0.03, acilmaSuresi);
          if (this._darbe(kol, omuz, birim, yukselis, acilmaSuresi)) kol._sonDarbe = this._t;
          tabanaAl();
        } else if (
          (this._t - kol.tepeT > TABAN_DURGUN && yukselis < YUKSELIS_ESIK) ||
          this._t - kol.tabanT > TABAN_ZAMAN_ASIMI
        ) {
          // Yükseliş yumruk olmadan durdu (ör. eli kaldırıp tutma, gard kayması):
          // taban bugüne çekilir ki SONRAKİ gerçek yumruk baştan ölçülebilsin.
          tabanaAl();
        }
      }

      // Görsel faz (nişan halkası): yalnız render için türetilir.
      kol.faz =
        this._t - kol._sonDarbe < TOPARLA_GORSEL
          ? "toparla"
          : uzanim > kol.taban + ITME_GORSEL_ESIK
            ? "itme"
            : "bekle";
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

  /**
   * Darbe anı: olayı TABAN→TEPE kayıtlarından üretir.
   * Sınıflandırma tepe karesinin ham konumuna değil, yumruğun kat ettiği YOLA
   * bakar: yanal (|Δx|), yukarı (−Δy) ve derinlik (el ölçeği + düzlük artışı).
   * @returns {boolean} olay üretildiyse true (reddedilirse false)
   */
  _darbe(kol, omuz, birim, yukselis, sure) {
    const bas = kol._tabanKayit;
    const tepe = kol._tepeKayit || bas;
    const bilek = { x: tepe.x, y: tepe.y };
    const dx = (tepe.x - bas.x) / birim;
    const dy = (tepe.y - bas.y) / birim;

    // Derinlik: iki bağımsız kanıtın toplamı (biri okunamazsa diğeri taşır).
    const olcekArtis =
      tepe.olcek > 0 && bas.olcek > 0
        ? Math.max(0, (tepe.olcek - bas.olcek) / Math.max(OLCEK_TABAN_PX, bas.olcek))
        : 0;
    const duzlukArtis = Math.max(0, tepe.duzluk - bas.duzluk);
    const ileri = olcekArtis * ILERI_OLCEK + duzlukArtis * ILERI_DUZLUK;
    const yanal = Math.abs(dx);
    const yukari = Math.max(0, -dy);

    // Gardı indirme reddi (bkz. DUSUS_RED_*): düzlük bu hareketi ayırt edemez,
    // yalnız gerçek derinlik (el ölçeği) ve yön ayırt eder.
    if (dy > DUSUS_RED_Y && dy > yanal * DUSUS_RED_YANAL && olcekArtis < DUSUS_RED_OLCEK) {
      return false;
    }

    // Dirsek dışa açıldıysa hook lehine ek kanıt (hook'ta dirsek gövdeden ayrılır).
    let dirsekAcilma = 0;
    if (tepe.dx != null && bas.dx != null) {
      dirsekAcilma = Math.abs(tepe.dx - bas.dx) / birim;
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
    // Açılma hızı (uzanim/sn) × açılma tamlığı. Kamerada Newton ölçülemez;
    // skor kişinin KENDİ ortalamasına normalize edilir.
    const acilmaHizi = yukselis / Math.max(0.03, sure);
    const tamlik = Math.min(1.4, yukselis / 0.55);
    const ham = acilmaHizi * (0.6 + 0.4 * tamlik);
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
        const tasi = Math.min(NISAN_MAX, ileri * NISAN_ILERI) * birim;
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
      hiz: acilmaHizi,
      siddet,
      kalibre: this._siddetOrnek < SIDDET_MIN_ORNEK,
      uzanma: yukselis,
      karsiGardDusuk,
      karsiEl: karsi.taraf,
      t: this._t,
    });
    return true;
  }
}
