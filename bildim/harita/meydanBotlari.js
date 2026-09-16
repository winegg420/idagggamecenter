// ============================================================
// MEYDANDAKİ BOTLAR — nöbet listesi ve hareket planı
//
// Botlar gerçek istemci olmadığı için Realtime presence'a katılamaz.
// Sunucu gizli botları "nöbete" yazar (meydan_bot_nobeti) ve her nöbetin
// başlangıç/bitiş anını verir. Her istemci aynı TOHUMDAN aynı planı
// kurar; plan sunucu saatine bağlı olduğu için herkes botu aynı yerde
// görür.
//
// PLAN (Revizyon Paketi 6, madde 2 — "binaya gidip yok olmalı, yerine
// başkası girmeli"):
// (Paket 12, madde 2: "kapı" artık binaların arasındaki DIŞ KENAR noktası —
// bkz. kenarKapilariHesapla. Bot binadan çıkmaz, binaya girip kaybolmaz.)
//   1. Nöbet başlarken bir binanın kapısından çıkar, meydana yürür.
//   2. Çeşme ile banklar arasındaki boş halkada dolaşır, ara ara durup
//      bakınır (eski "yarı pasif" his korunur).
//   3. Nöbet biterken bir binaya yürür, kapıya vardığı an kaybolur.
//      Sunucu bir sonraki bota yer açar; o da bir kapıdan girer.
//
// ESKİ HAREKET: tohumdan türeyen SABİT yarıçaplı daire (6-16 birim).
// Bu daire çeşmenin (6.6), bankların (12.5) ve lambaların (15.6)
// içinden geçiyordu — "kaldırıma takılıyor" şikâyetinin sebebi. Artık
// her yol parçası engel listesine karşı denetlenir, çarpacaksa etrafından
// dolaşılır.
//
// MİMARİ: burada yalnız MANTIK var (sayılar: kapı ve engel konumları).
// Avatarın nasıl çizildiği HaritaSayfasi + dunya.js'te; harita görseli
// değişse de bu dosya aynen çalışır — yeni haritanın engel/bina listesi
// verilmesi yeter.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";
import { ziplamaYuksekligi, ZIPLAMA } from "./ziplama.js";

/** Botun yürüme hızı (birim/sn). Oyuncu 9 ile koşar; bot gezinir. */
// Paket 13: 3.2 "aşırı yavaş" bulundu. Temel hız 4.2; her bacak ayrıca
// koşar/seri/ağır çarpanı alır (bkz. botPlaniKur › Dolaş).
export const BOT_HIZI = 4.2;

// Dolaşma halkası: çeşme (6.6) ile bankların iç kenarı (12.5 - 1.6)
// arası boş. Gövde payıyla birlikte bu aralıkta kalınır.
// Paket 13: harita büyüdü (göl 14, bank 20, meydan 26, ağaç 31, bina 44).
const HALKA_MIN = 16;
const HALKA_MAX = 18;
// Paket 13: dolaşma artık yalnız bu dar halkada değil, çeşmeden çevre
// ağaçlarının (21) iç kenarına kadar tüm meydanda. Bank/lamba engelleri
// sapmaliYol ile dolaşılır.
const DOLAS_MIN = 16;
const DOLAS_MAX = 30;
const GOVDE_R = 0.55;          // engelden uzak durma payı
const SAPMA_PAYI = 0.35;       // engelin etrafından dolaşırken ek boşluk
const KAPI_PAYI = 0.4;         // kapı noktası bina engelinin bu kadar önünde
// Dış kenar girişi (Paket 12): binaların iç kenarı ~24, çevre ağaçları 21.
// 26 birimde binaların ARASI boş; oyuncu merkeze bakarken arkada kalır.
const KENAR_R = 40;
const KENAR_PAYI = 1.5;        // kenar noktası engelden en az bu kadar uzak
const ENGEL_ICI_PAYI = 0.2;    // plan konumu engelin içine düşerse bu kadar dışına itilir
const ADIM_ACI = (12 * Math.PI) / 180;

// Çeşme dunya.js'in engel listesinde değil (ayrı çarpışma kontrolü var).
// Halkanın dışına çıkan yollar (ziyaret, buluşma) için engel sayılır:
// merkeze en az r + GOVDE_R = 7.05 birim.
const HAVUZ = { x: 0, z: 0, r: 14.5 };

// ---- Grup girişi
const GRUP_ARA_MS = 1300;      // aynı kapıdan girenler arasında birkaç adım
const GRUP_ACI = 0.2;          // halkaya varınca yan yana dağılsınlar (radyan)

// ---- Oyuncuya yaklaşma (ziyaret)
const DURMA_MESAFE = 2.0;      // oyuncunun bu kadar önünde durur
const ZIYARET_GIT_MS = 9000;   // yetişemezse vazgeçer
const ZIYARET_MENZIL = 32;     // hedef meydan merkezine en çok bu kadar uzak
const ZIYARET_ULASIM = 32;     // bot hedefe en çok bu kadar uzaksa gider
const ZIYARET_KILIT_MS = 28000; // git + dur + dön için ayrılan en uzun süre
const ZIYARET_EMOJI = ["👋", "😄", "🙌", "😎", "🎉", "👍"];
const EMOJI_MS = 350;          // varınca emoji
const HOP_BAS_MS = 900;        // emojiden sonra hoplamaya başlar
const HOP_ARA_MS = 800;        // hoplamalar arası (zıplama süresi 620 ms)
const HOP_OLCEK = 0.6;         // oyuncunun zıplamasının %60'ı kadar
const DUR_SON_MS = 1500;       // hoplamadan sonra biraz daha bakar

// ---- Bot-bot buluşması (ikram)
const BULUSMA_R = 17.0;         // halkanın ortası
const BULUSMA_ARA = 1.3;       // karşı karşıya duran iki bot arası
const KAHVE_MS = 12000;
const BALON_MS = 7000;
const BULUSMA_BOSLUK_MS = 20000; // aynı botun iki buluşması arasında en az
const TARAMA_MS = 250;

/**
 * Nöbetteki botlar. Zamanlar İSTEMCİ saatine çevrilir: sunucu saati ile
 * cihaz saati arasındaki fark düşülür. Hata olursa boş liste — meydan
 * botsuz kalır, sorun değil.
 * @returns {Promise<Array<{user_id:string, gorunen_ad:string, gorunum:object,
 *   tohum:string, baslangicMs:number, bitisMs:number}>>}
 */
export async function meydanBotlariniAl() {
  try {
    const { data, error } = await supabase.rpc("meydan_botlari");
    if (error) throw error;
    const simdi = Date.now();
    return (data ?? [])
      .map((b) => {
        const fark = Date.parse(b.sunucu_zamani) - simdi;
        const baslangicMs = Date.parse(b.baslangic) - (Number.isFinite(fark) ? fark : 0);
        const bitisMs = Date.parse(b.bitis) - (Number.isFinite(fark) ? fark : 0);
        return { ...b, baslangicMs, bitisMs };
      })
      .filter((b) => Number.isFinite(b.baslangicMs) && Number.isFinite(b.bitisMs));
  } catch (e) {
    console.error("[Meydan] bot nobeti okunamadi:", e);
    return [];
  }
}

/** Tohumdan 0..1 arası kararlı bir sayı (sunucudaki bot_rasgele'nin eşi). */
function tohumSayi(tohum, ek = "") {
  let h = 2166136261;
  const s = String(tohum) + ek;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Tohumdan kararlı rastgele sayı üreteci (mulberry32). */
function rastgeleUret(tohum) {
  let a = Math.floor(tohumSayi(tohum, "plan") * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bina kapılarının önündeki noktalar (bina engelinin hemen önü).
 * @param {Array<{x:number,z:number}>} binalar
 * @param {Array<{x:number,z:number,r:number}>} engeller
 */
export function kapilariHesapla(binalar, engeller) {
  const kapilar = [];
  for (const b of binalar ?? []) {
    const mesafe = Math.hypot(b.x, b.z);
    if (!(mesafe > 0)) continue;
    const e = (engeller ?? []).find((o) => Math.hypot(o.x - b.x, o.z - b.z) < 0.01);
    const r = e ? e.r : 6;
    const k = Math.max(0, mesafe - r - GOVDE_R - KAPI_PAYI) / mesafe;
    kapilar.push({ x: b.x * k, z: b.z * k, aci: Math.atan2(b.z, b.x) });
  }
  return kapilar;
}

/**
 * MEYDANIN DIŞ KENARINDAKİ GİRİŞ/ÇIKIŞ NOKTALARI (Paket 12, madde 2).
 * "Botlar binalardan çıkıyor" şikâyeti: bot artık bina kapısından değil,
 * gerçek oyuncunun başladığı yöne yakın, binaların arasındaki boş kenardan
 * meydana yürür ve nöbet bitince yine oradan ayrılır.
 * Kenar halkası taranır; engelsiz yay parçalarının ortası aday olur, oyuncu
 * başlangıcına açıca en yakın `adet` tanesi seçilir. Saf ve kararlı.
 * @param {Array<{x:number,z:number,r:number}>} engeller
 * @param {{x:number,z:number}} baslangic gerçek oyuncunun doğduğu nokta
 */
export function kenarKapilariHesapla(engeller, baslangic = { x: 0, z: 11 }, adet = 3) {
  // Paket 13: "bot hiçbir zaman aynı noktadan gelmesin" — adet Infinity
  // verilirse her 2°'lik engelsiz kenar noktası döner (~130 nokta).
  const ADIM = ((adet === Infinity ? 2 : 3) * Math.PI) / 180;
  const n = Math.round((Math.PI * 2) / ADIM);
  const bos = [];
  for (let i = 0; i < n; i++) {
    const a = i * ADIM, x = Math.cos(a) * KENAR_R, z = Math.sin(a) * KENAR_R;
    bos.push((engeller ?? []).every((e) => Math.hypot(x - e.x, z - e.z) >= e.r + GOVDE_R + KENAR_PAYI));
  }
  if (adet === Infinity) {
    return bos.map((b, i) => (b ? { x: Math.cos(i * ADIM) * KENAR_R, z: Math.sin(i * ADIM) * KENAR_R, aci: i * ADIM } : null))
      .filter(Boolean);
  }
  if (bos.every(Boolean) || !bos.some(Boolean)) return [];
  // Engelli bir noktadan başlayıp çevrimsel olarak boş yayları topla.
  const ilkDolu = bos.indexOf(false);
  const yaylar = [];
  let bas = -1;
  for (let j = 1; j <= n; j++) {
    const i = (ilkDolu + j) % n;
    if (bos[i] && bas < 0) bas = j;
    if ((!bos[i] || j === n) && bas >= 0) {
      const bit = bos[i] ? j : j - 1;
      if (bit - bas >= 1) yaylar.push(((ilkDolu + (bas + bit) / 2) % n) * ADIM);
      bas = -1;
    }
  }
  const hedef = Math.atan2(baslangic.z, baslangic.x);
  return yaylar
    .sort((p, q) => Math.abs(aciFarki(hedef, p)) - Math.abs(aciFarki(hedef, q)))
    .slice(0, Math.max(1, adet))
    .map((a) => ({ x: Math.cos(a) * KENAR_R, z: Math.sin(a) * KENAR_R, aci: a }));
}

/**
 * p → q düz yolunu engellere göre böler: çarpacağı ilk engelin yanına bir
 * ara nokta konur (engel merkezinden yola doğru, engel + gövde payı kadar
 * dışarıda). Döndürülen dizi q'yu içerir, p'yi içermez.
 */
function sapmaliYol(p, q, engeller, derinlik = 0) {
  const dx = q.x - p.x, dz = q.z - p.z;
  const uz2 = dx * dx + dz * dz;
  if (uz2 < 1e-6 || derinlik > 4) return [q];

  let ilk = null, ilkT = Infinity;
  for (const e of engeller) {
    const t = ((e.x - p.x) * dx + (e.z - p.z) * dz) / uz2;
    if (t <= 0 || t >= 1) continue;
    const cx = p.x + dx * t, cz = p.z + dz * t;
    const d = Math.hypot(cx - e.x, cz - e.z);
    if (d < e.r + GOVDE_R && t < ilkT) { ilk = { e, cx, cz, d }; ilkT = t; }
  }
  if (!ilk) return [q];

  const { e, cx, cz, d } = ilk;
  let nx, nz;
  if (d > 1e-3) { nx = (cx - e.x) / d; nz = (cz - e.z) / d; }
  else { const u = Math.sqrt(uz2); nx = -dz / u; nz = dx / u; }   // tam ortadan: sola
  const ara = { x: e.x + nx * (e.r + GOVDE_R + SAPMA_PAYI), z: e.z + nz * (e.r + GOVDE_R + SAPMA_PAYI) };
  return [...sapmaliYol(p, ara, engeller, derinlik + 1), ...sapmaliYol(ara, q, engeller, derinlik + 1)];
}

function uzunluk(bas, noktalar) {
  let t = 0, o = bas;
  for (const n of noktalar) { t += Math.hypot(n.x - o.x, n.z - o.z); o = n; }
  return t;
}

/** En kısa yönden açı farkı (-π..π). */
function aciFarki(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Halka üstünde, açısı ve yarıçapı yavaşça değişen yol (engel denetimli). */
function halkaYolu(bas, hedefAci, hedefR, engeller) {
  const a0 = Math.atan2(bas.z, bas.x), r0 = Math.hypot(bas.x, bas.z);
  const fark = hedefAci - a0;
  const adim = Math.max(1, Math.ceil(Math.abs(fark) / ADIM_ACI));
  const yol = [];
  let o = bas;
  for (let i = 1; i <= adim; i++) {
    const a = a0 + (fark * i) / adim, r = r0 + ((hedefR - r0) * i) / adim;
    // Paket 13: dolaşma bank halkasına (12,5) taşındı; ara nokta bir bankın
    // İÇİNE düşerse planKonumu onu dışarı itiyor, bot bankın bir yanından
    // öbür yanına atlıyordu (simülasyon: 145 sıçrama). Nokta baştan dışarıda.
    const n = engeldenIt({ x: Math.cos(a) * r, z: Math.sin(a) * r }, engeller);
    yol.push(...sapmaliYol(o, n, engeller));
    o = n;
  }
  return yol;
}

/** Bulunduğu yerden bir kapıya: halka boyunca kapının hizasına, sonra dışarı. */
function cikisYolu(bas, kapi, engeller) {
  const a0 = Math.atan2(bas.z, bas.x);
  const r0 = Math.min(HALKA_MAX, Math.max(HALKA_MIN, Math.hypot(bas.x, bas.z)));
  const hiza = halkaYolu(bas, a0 + aciFarki(a0, kapi.aci), r0, engeller);
  const son = hiza.length ? hiza[hiza.length - 1] : bas;
  return [...hiza, ...sapmaliYol(son, kapi, engeller)];
}

/**
 * Botun nöbet boyunca izleyeceği zaman damgalı yol.
 * Aynı girdi → aynı plan (tüm istemcilerde).
 * @returns {{noktalar:Array<{t:number,x:number,z:number,aci:number}>, bitisMs:number}}
 */
export function botPlaniKur({ tohum, baslangicMs, bitisMs, kapilar, engeller, grup = null }) {
  const engel = [...(engeller ?? []), HAVUZ];
  const r = rastgeleUret(tohum);
  const hizMs = 1000 / BOT_HIZI;

  if (!kapilar?.length) {
    // Kapı bilgisi yoksa (harita değişti, bina yok): halkada durur.
    const a = r() * Math.PI * 2;
    const n = { t: baslangicMs, x: Math.cos(a) * HALKA_MIN, z: Math.sin(a) * HALKA_MIN, aci: 0 };
    return { noktalar: [n, { ...n, t: bitisMs }], bitisMs, baslaMs: baslangicMs, dolasBasMs: baslangicMs, cikisBasMs: bitisMs };
  }

  let giris = kapilar[Math.floor(r() * kapilar.length) % kapilar.length];
  let cikis = kapilar[Math.floor(r() * kapilar.length) % kapilar.length];
  // GRUP: hepsi aynı kapıdan, birkaç adım arayla girer (kapı grup
  // anahtarından türer, sıra kadar gecikir). Çıkış kapısı herkesin kendi.
  // Plan grup BOYUNA bağlı değildir: eşlikçi erken ayrıldıktan sonra açılan
  // istemci grubu küçük görür, ama lideri yine aynı yoldan yürütmelidir.
  // (Önce ayrılan hep en büyük sıradakidir; kalanların sırası değişmez.)
  const sira = grup ? Math.max(0, grup.sira | 0) : 0;
  if (grup && kapilar.length) {
    giris = kapilar[Math.floor(tohumSayi(grup.anahtar, "kapi") * kapilar.length) % kapilar.length];
  }
  if (cikis === giris && kapilar.length > 1) {
    cikis = kapilar[(kapilar.indexOf(giris) + 1 + Math.floor(r() * (kapilar.length - 1))) % kapilar.length];
  }

  const baslaMs = baslangicMs + sira * GRUP_ARA_MS;
  const noktalar = [{ t: baslaMs, x: giris.x, z: giris.z, aci: Math.atan2(-giris.x, -giris.z) }];
  const son = () => noktalar[noktalar.length - 1];
  const yuru = (yol, olcek = 1) => {
    for (const n of yol) {
      const o = son();
      const d = Math.hypot(n.x - o.x, n.z - o.z);
      if (d < 1e-4) continue;
      noktalar.push({ t: o.t + d * hizMs * olcek, x: n.x, z: n.z, aci: Math.atan2(n.x - o.x, n.z - o.z) });
    }
  };
  const bekle = (ms) => { if (ms > 0) { const o = son(); noktalar.push({ ...o, t: o.t + ms }); } };

  // 1) Kapıdan meydana
  // Sıra 0 kapı hizasına, 1 bir yana, 2 öbür yana: yan yana dağılırlar.
  const girisAci = Math.atan2(giris.z, giris.x) + (sira === 0 ? 0 : (sira % 2 ? 1 : -1) * Math.ceil(sira / 2) * GRUP_ACI);
  const girisR = HALKA_MIN + r() * (HALKA_MAX - HALKA_MIN);
  yuru(sapmaliYol(son(), { x: Math.cos(girisAci) * girisR, z: Math.sin(girisAci) * girisR }, engel));
  const dolasBasMs = son().t;

  // 2) Dolaş — çıkışa yetecek süre kaldığı sürece.
  // Paket 13 ("aynı tempoda süzülüyorlar, inandırıcı değil"): bacak türü
  // karışık — halkada tur, meydanın rastgele bir yerine düz koşu, sağa-sola
  // zikzak (her hamlede yön ters döner). Hepsi tohumdan: herkes aynısını görür.
  for (let i = 0; i < 80; i++) {
    const o = son();
    const bacakTuru = r();
    let bacak;
    if (bacakTuru < 0.35) {
      const yon = r() < 0.5 ? -1 : 1;
      const aci = Math.atan2(o.z, o.x) + yon * ((35 + r() * 95) * Math.PI) / 180;
      bacak = halkaYolu(o, aci, DOLAS_MIN + r() * (DOLAS_MAX - DOLAS_MIN), engel);
    } else if (bacakTuru < 0.65) {
      const aci = r() * Math.PI * 2, rr = DOLAS_MIN + r() * (DOLAS_MAX - DOLAS_MIN);
      bacak = sapmaliYol(o, engeldenIt({ x: Math.cos(aci) * rr, z: Math.sin(aci) * rr }, engel), engel);
    } else {
      bacak = [];
      let p = o, yonAci = r() * Math.PI * 2;
      const hamle = 2 + Math.floor(r() * 3);
      for (let z = 0; z < hamle; z++) {
        yonAci += Math.PI * (0.55 + r() * 0.9) * (z % 2 ? 1 : -1);
        const boy = 1.8 + r() * 3.2;
        let q = { x: p.x + Math.sin(yonAci) * boy, z: p.z + Math.cos(yonAci) * boy };
        const qr = Math.hypot(q.x, q.z);
        if (qr > DOLAS_MAX) q = { x: (q.x * DOLAS_MAX) / qr, z: (q.z * DOLAS_MAX) / qr };
        q = engeldenIt(q, engel);
        bacak.push(...sapmaliYol(p, q, engel));
        p = q;
      }
    }
    // HIZ ÇEŞİTLİLİĞİ (Paket 7, madde 2d): %15 koşar gibi (1,4-1,6×),
    // %20 ağır ağır (0,6×), gerisi normal. AYRI tohum anahtarından seçilir,
    // `r()` dizisini tüketmez — rota/mola/buluşma zamanlaması aynen kalır.
    const hizSec = tohumSayi(tohum, "hiz" + i);
    // Paket 13: bacakların %40'ı koşar (1,8-2,2× → oyuncu hızına yakın),
    // %35'i seri (1,25-1,5×), %17'si yürür, %8'i ağır (0,7×). Koşu bacakları
    // kısa sürdüğünden eşikler koşuya ağırlık verir. Molalar kısa ve seyrek.
    const hizk = tohumSayi(tohum, "hizk" + i);
    const hizCarpani = hizSec < 0.4 ? 1.8 + hizk * 0.4 : hizSec < 0.75 ? 1.25 + hizk * 0.25 : hizSec < 0.92 ? 1 : 0.7;
    const bacakMs = (uzunluk(o, bacak) * hizMs) / hizCarpani;
    const molaMs = r() < 0.35 ? 600 + r() * 3400 : 0;
    const varis = bacak.length ? bacak[bacak.length - 1] : o;
    const cikisMs = uzunluk(varis, cikisYolu(varis, cikis, engel)) * hizMs;
    if (o.t + bacakMs + molaMs + cikisMs > bitisMs) break;
    yuru(bacak, 1 / hizCarpani);
    bekle(molaMs);
  }

  // 3) Binaya yürü; tam bitiş anında kapıda ol. Artan süre son bir
  //    bakınma molasıdır; süre yetmezse adımlar biraz hızlanır.
  const cikisYol = cikisYolu(son(), cikis, engel);
  const gerekenMs = uzunluk(son(), cikisYol) * hizMs;
  const kalanMs = bitisMs - son().t;
  let cikisBasMs;
  if (kalanMs >= gerekenMs) {
    bekle(kalanMs - gerekenMs);
    cikisBasMs = son().t;
    yuru(cikisYol);
  } else {
    cikisBasMs = son().t;
    yuru(cikisYol, gerekenMs > 0 ? Math.max(0, kalanMs) / gerekenMs : 1);
  }
  // dolasBasMs..cikisBasMs: bot halkada. Ziyaret ve buluşma yalnız bu
  // aralığa yerleşir; giriş ve çıkış yürüyüşü hiç bozulmaz.
  // `engel`: planKonumu hiçbir anda bir engelin (bina, bank, ağaç) içini
  // döndürmesin diye taşınır; planaBacakEkle `...plan` ile korur.
  return { noktalar, bitisMs, baslaMs, dolasBasMs, cikisBasMs, engel };
}


/** Nokta bir engelin İÇİNDEYSE en yakın açık noktaya çıkarır; değilse aynen döner. */
function engelIcindenCikar(x, z, engel) {
  if (!engel?.length) return { x, z };
  for (let tur = 0; tur < 3; tur++) {
    let itildi = false;
    for (const e of engel) {
      const dx = x - e.x, dz = z - e.z;
      const d = Math.hypot(dx, dz), min = e.r + ENGEL_ICI_PAYI;
      if (d < min) {
        if (d > 1e-4) { x = e.x + (dx / d) * min; z = e.z + (dz / d) * min; }
        else { x = e.x + min; }
        itildi = true;
      }
    }
    if (!itildi) break;
  }
  return { x, z };
}

/**
 * Planın verilen andaki durumu.
 * @returns {{x:number, z:number, aci:number, yuruyor:boolean, bitti:boolean}}
 */
export function planKonumu(plan, simdiMs) {
  const n = plan?.noktalar;
  if (!n?.length) return { x: 0, z: 0, aci: 0, yuruyor: false, bitti: true };
  if (simdiMs >= plan.bitisMs || simdiMs >= n[n.length - 1].t) {
    const s = n[n.length - 1];
    return { x: s.x, z: s.z, aci: s.aci, yuruyor: false, bitti: true };
  }
  if (simdiMs <= n[0].t) return { x: n[0].x, z: n[0].z, aci: n[0].aci, yuruyor: false, bitti: false };

  // İkili arama: simdiMs'yi içeren parça
  let lo = 0, hi = n.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (n[m].t <= simdiMs) lo = m; else hi = m;
  }
  const a = n[lo], b = n[hi];
  const f = b.t > a.t ? (simdiMs - a.t) / (b.t - a.t) : 1;
  const mesafe = Math.hypot(b.x - a.x, b.z - a.z);
  const yuruyor = mesafe > 1e-3;
  const hx = a.x + (b.x - a.x) * f, hz = a.z + (b.z - a.z) * f;
  const acik = engelIcindenCikar(hx, hz, plan.engel);
  return {
    x: acik.x,
    z: acik.z,
    aci: yuruyor ? b.aci : a.aci,
    yuruyor,
    // Parçanın gerçek hızı (birim/sn): koşar/ağır bacaklarda adım temposu buna uyar.
    hiz: yuruyor && b.t > a.t ? mesafe / ((b.t - a.t) / 1000) : 0,
    bitti: false,
  };
}

/**
 * Bot bu anda emoji/dans/hoplama yapıyor mu? NADİREN: ortalama ~40
 * saniyede bir, tohuma bağlı olduğu için herkes aynı anda görür.
 * @returns {{tur:'emoji'|'dans'|'zipla', deger:string|number}|null}
 */
// Paket 13: jest penceresi 40 → 14 sn; zıplama çoğunlukta (1-3 kez) ve
// HaritaSayfasi yürürken/koşarken de uygular.
export const JEST_PENCERE_SN = 14;

export function botJesti(tohum, sn) {
  const pencere = Math.floor(sn / JEST_PENCERE_SN);
  const p = tohumSayi(tohum, "j" + pencere);
  if (p > 0.6) return null;                       // bazı pencerelerde sessiz
  const icinde = sn % JEST_PENCERE_SN;
  if (icinde > 2) return null;                    // yalnız pencerenin başında
  if (p < 0.06) return { tur: "dans", deger: "dns_01" };
  if (p < 0.40) return { tur: "zipla", deger: 1 + (Math.floor(p * 1000) % 3) };
  const emojiler = ["👍", "😂", "🔥", "😎", "👋"];
  return { tur: "emoji", deger: emojiler[Math.floor(p * 100) % emojiler.length] };
}

/**
 * Art arda hoplamanın o anki yüksekliği (saf; ziplama.js eğrisi).
 * @param {number} gecenMs ilk hoplamanın başından beri geçen süre
 * @param {number} adet kaç kez hoplayacak
 */
export function hopYuksekligi(gecenMs, adet) {
  if (!(gecenMs >= 0) || !(adet > 0)) return 0;
  const i = Math.floor(gecenMs / HOP_ARA_MS);
  if (i >= adet) return 0;
  const f = (gecenMs - i * HOP_ARA_MS) / (ZIPLAMA.sure * 1000);
  return f < 1 ? ziplamaYuksekligi(f) * HOP_OLCEK : 0;
}

/** Tohumdan kararlı rastgele üreteç (görsel katman için; ör. balon renkleri). */
export function kararliRastgele(tohum) {
  return rastgeleUret(tohum);
}

// ============================================================
// KAÇ BOT ÇİZİLİR — katman + dalga
//
// Sunucu nöbeti katmanlara böler (migration 184). Bir bot `katman <
// hedef(başlangıç anı)` ise çizilir. Hedef, tek başına oyuncu için zamana
// bağlı kararlı bir dalgadır (taban..dalgaUst); her ek gerçek oyuncu `ek`
// kadar ekler, `tavan`ı aşmaz. Hedef botun GİRİŞ anında değerlendirilir:
// meydanın ortasında aniden belirmez, sayı düşünce de ortadan kaybolmaz —
// kendi nöbeti bitince bir binaya girip gider.
// ============================================================

/** Tek başına oyuncunun gördüğü katman sayısı (zamana bağlı, herkeste aynı). */
export function dalgaHedefi(ms, ayar) {
  const taban = Math.max(0, Number(ayar?.taban ?? 1) | 0);
  const ust = Math.max(taban, Number(ayar?.dalgaUst ?? taban) | 0);
  const dilimSn = Math.max(30, Number(ayar?.dalgaSn ?? 240));
  const dilim = Math.floor(ms / 1000 / dilimSn);
  return taban + (Math.floor(tohumSayi("dalga", String(dilim)) * (ust - taban + 1)) % (ust - taban + 1));
}

/** Verilen anda kaç katman çizilir. */
export function botHedefi(ms, kisi, ayar) {
  const tavan = Math.max(0, Number(ayar?.tavan ?? 6) | 0);
  const ek = Math.max(0, Number(ayar?.ek ?? 2));
  return Math.max(0, Math.min(tavan, dalgaHedefi(ms, ayar) + ek * Math.max(0, (kisi | 0) - 1)));
}

/**
 * Nöbet listesinden çizilecek botlar ve grup bilgileri.
 * Aynı katman + aynı başlangıç = birlikte giren grup. Grubun en uzun
 * kalanı lider (sira 0); eşlikçiler, o an çizilen bot sayısı `hedef +
 * grupEnCok - 1`'i aşacaksa atlanır. Lider her zaman çizilir.
 * @param {Array<{user_id:string,tohum:string,baslangic:string,bitis:string,katman?:number}>} liste
 * @returns {Map<string,{anahtar:string, sira:number, boyut:number, basSira:number}>}
 */
export function gorunurBotlariSec(liste, { kisi = 1, ayar } = {}) {
  const gruplar = new Map();
  for (const b of liste ?? []) {
    const bas = Date.parse(b.baslangic);
    const bit = Date.parse(b.bitis);
    if (!Number.isFinite(bas) || !Number.isFinite(bit)) continue;
    const anahtar = `${b.katman ?? 0}|${bas}`;
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push({ b, bas, bit, anahtar });
  }
  const hepsi = [];
  for (const uyeler of gruplar.values()) {
    uyeler.sort((x, y) => y.bit - x.bit || (x.b.tohum < y.b.tohum ? -1 : 1));
    uyeler.forEach((u, i) => { u.sira = i; u.boyut = uyeler.length; hepsi.push(u); });
  }
  hepsi.sort((x, y) => x.bas - y.bas || x.sira - y.sira || (x.b.tohum < y.b.tohum ? -1 : 1));

  const grupEnCok = Math.max(1, Number(ayar?.grupEnCok ?? 3) | 0);
  const tavan = Math.max(0, Number(ayar?.tavan ?? 6) | 0);
  const cizilen = [];
  const sonuc = new Map();
  for (const u of hepsi) {
    const h = botHedefi(u.bas, kisi, ayar);
    if (!((u.b.katman ?? 0) < h)) continue;
    if (u.sira > 0) {
      // Grup tek başına oyuncuda da tam girebilsin, ama kalabalık dalgada
      // eşlikçiler sayıyı hedefin bir fazlasından öteye taşımasın.
      const sinir = Math.min(tavan, Math.max(grupEnCok, h + 1));
      const canli = cizilen.filter((c) => c.bit > u.bas).length;
      if (canli >= sinir) continue;
    }
    cizilen.push({ bit: u.bit });
    sonuc.set(u.b.user_id, { anahtar: u.anahtar, sira: u.sira, boyut: u.boyut, basSira: u.bas });
  }
  return sonuc;
}

// ============================================================
// OYUNCUYA YAKLAŞMA (ziyaret)
//
// Zaman pencereleri botun tohumundan (herkeste aynı). Hedef, pencerenin
// seçim sayısıyla SIRALI gerçek oyuncu listesinden seçilir; hedefin konumu
// canlı okunur. Bot planından ayrılır → oyuncunun ~2 birim önünde durur →
// döner, emoji atar, 1-3 kez hoplar → planına yetişip kaldığı yerden devam
// eder. Pencereler halka evresinin içindedir; çıkışa her zaman yetişir.
// ============================================================

/** Botun nöbetindeki ziyaret pencereleri (kararlı). */
export function ziyaretPencereleri(tohum, plan, ayar) {
  const olasilik = Math.max(0, Number(ayar?.ziyaretYuzde ?? 0)) / 100;
  const sonuc = [];
  if (!(olasilik > 0) || !Number.isFinite(plan?.dolasBasMs) || !Number.isFinite(plan?.cikisBasMs)) return sonuc;
  const r = rastgeleUret(String(tohum) + "|ziyaret");
  const son = plan.cikisBasMs - ZIYARET_KILIT_MS;
  let imlec = plan.dolasBasMs + 4000;
  for (let i = 0; i < 12 && imlec <= son; i++) {
    const bas = imlec + r() * 8000;
    const zar = r();
    if (zar < olasilik && bas <= son) {
      sonuc.push({
        basMs: bas,
        secim: r(),
        hop: 1 + Math.floor(r() * 3),
        emoji: ZIYARET_EMOJI[Math.floor(r() * ZIYARET_EMOJI.length) % ZIYARET_EMOJI.length],
      });
      imlec = bas + ZIYARET_KILIT_MS + 15000;
    } else {
      imlec += 22000;
    }
  }
  return sonuc;
}

/** Pencerenin hedefi: sıralı oyuncu kimliklerinden biri (herkeste aynı sıra). */
export function ziyaretHedefiSec(pencere, oyuncuIdleri) {
  const idler = [...new Set(oyuncuIdleri ?? [])].sort();
  if (!idler.length || !pencere) return null;
  return idler[Math.floor(pencere.secim * idler.length) % idler.length];
}

/** Hedef meydanda ve bota yeterince yakın mı? */
export function ziyaretUygunMu(k, hedef) {
  if (!k || k.bitti || !hedef) return false;
  if (!Number.isFinite(hedef.x) || !Number.isFinite(hedef.z)) return false;
  // Hedef köprüdeyse (göl alanının içinde) ulaşılamaz: bot kıyıda takılıp
  // 9 sn "peşinden gitmeye" çalışıyor, o arada balık bacağı geçiyordu (canlıda ölçüldü).
  if (Math.hypot(hedef.x, hedef.z) < HAVUZ.r + 1.5) return false;
  if (Math.hypot(hedef.x, hedef.z) > ZIYARET_MENZIL) return false;
  return Math.hypot(hedef.x - k.x, hedef.z - k.z) <= ZIYARET_ULASIM;
}

/** Engellerin dışına it (gövde payı kadar). */
function engeldenIt(p, engel) {
  let x = p.x, z = p.z;
  for (let tur = 0; tur < 3; tur++) {
    for (const e of engel) {
      const dx = x - e.x, dz = z - e.z;
      const d = Math.hypot(dx, dz), min = e.r + GOVDE_R + 0.05;
      if (d < min) {
        if (d > 1e-4) { x = e.x + (dx / d) * min; z = e.z + (dz / d) * min; }
        else { x = e.x + min; }
      }
    }
  }
  return { x, z };
}

/** Hedefin önünde, botun geldiği taraftaki duruş noktası. */
function durmaNoktasi(hedef, bot, engel) {
  const dx = bot.x - hedef.x, dz = bot.z - hedef.z;
  const d = Math.hypot(dx, dz);
  const nx = d > 1e-3 ? dx / d : 0, nz = d > 1e-3 ? dz / d : 1;
  return engeldenIt({ x: hedef.x + nx * DURMA_MESAFE, z: hedef.z + nz * DURMA_MESAFE }, engel);
}

/** Yolu zaman damgalı noktalara çevirip listeye ekler. */
function yoluEkle(noktalar, yol, hizMs) {
  for (const n of yol) {
    const o = noktalar[noktalar.length - 1];
    const d = Math.hypot(n.x - o.x, n.z - o.z);
    if (d < 1e-4) continue;
    noktalar.push({ t: o.t + d * hizMs, x: n.x, z: n.z, aci: Math.atan2(n.x - o.x, n.z - o.z) });
  }
}

/**
 * Plandan ayrılmış bir botun plana geri katılma yolu: planın ileride
 * olacağı ilk noktaya, o ana yetişecek şekilde (gerekirse bekleyerek)
 * yürür. Yetişemezse son noktaya hızlanarak gider.
 * @returns {{noktalar:Array, bitisMs:number}}
 */
export function geriDonusYolu(plan, konum, simdiMs, engeller) {
  const engel = [...(engeller ?? []), HAVUZ];
  const hizMs = 1000 / BOT_HIZI;
  const n = plan.noktalar;
  const sonT = n[n.length - 1].t;
  const bas = { t: simdiMs, x: konum.x, z: konum.z, aci: konum.aci ?? 0 };
  for (let t = simdiMs; t <= sonT; t += TARAMA_MS) {
    const k = planKonumu(plan, t);
    const yol = sapmaliYol(bas, k, engel);
    const ms = uzunluk(bas, yol) * hizMs;
    if (simdiMs + ms <= t) {
      const noktalar = [bas];
      if (t - ms > simdiMs) noktalar.push({ ...bas, t: t - ms });
      yoluEkle(noktalar, yol, hizMs);
      const sonN = noktalar[noktalar.length - 1];
      if (sonN.t < t) noktalar.push({ ...sonN, t });
      else sonN.t = t;
      return { noktalar, bitisMs: t };
    }
  }
  // Yetişemedi (olmamalı): kalan sürede son noktaya git.
  const s = n[n.length - 1];
  const yol = sapmaliYol(bas, s, engel);
  const noktalar = [bas];
  const uz = uzunluk(bas, yol);
  const olcek = uz > 0 ? Math.max(0, sonT - simdiMs) / (uz * hizMs) : 1;
  yoluEkle(noktalar, yol, hizMs * olcek);
  const bitisMs = Math.max(simdiMs, sonT);
  noktalar[noktalar.length - 1].t = bitisMs;
  return { noktalar, bitisMs };
}

/** Ziyaretin canlı durumu (çizim döngüsü tutar, burası ilerletir). */
export function ziyaretBaslat(k, pencere, simdiMs) {
  return {
    evre: "git", x: k.x, z: k.z, aci: k.aci, basMs: simdiMs, durBasMs: 0,
    hop: pencere.hop, emoji: pencere.emoji, emojiAtildi: false, donus: null,
  };
}

/**
 * Ziyareti bir kare ilerletir. Saf: sayı girer sayı çıkar (durum nesnesi
 * yerinde güncellenir).
 * @param {object} d ziyaretBaslat'ın döndürdüğü durum
 * @param {{simdiMs:number, dt:number, hedef:{x:number,z:number}|null, plan:object, engeller:Array}} g
 * @returns {{x:number,z:number,aci:number,yuruyor:boolean,zipla:number,emoji:string|null,bitti:boolean}}
 */
export function ziyaretAdimi(d, { simdiMs, dt, hedef, plan, engeller }) {
  const engel = [...(engeller ?? []), HAVUZ];
  const cikti = (ek) => ({ x: d.x, z: d.z, aci: d.aci, yuruyor: false, zipla: 0, emoji: null, bitti: false, ...ek });
  const donuseGec = () => {
    d.evre = "donus";
    d.donus = geriDonusYolu(plan, d, simdiMs, engeller);
  };
  const hedefVar = hedef && Number.isFinite(hedef.x) && Number.isFinite(hedef.z);

  if (d.evre === "git") {
    if (!hedefVar || simdiMs - d.basMs > ZIYARET_GIT_MS) {
      donuseGec();
    } else {
      const T = durmaNoktasi(hedef, d, engel);
      const kalan = Math.hypot(T.x - d.x, T.z - d.z);
      if (kalan < 0.12) {
        d.evre = "dur";
        d.durBasMs = simdiMs;
      } else {
        const wp = sapmaliYol(d, T, engel)[0] ?? T;
        const wd = Math.hypot(wp.x - d.x, wp.z - d.z);
        const adim = Math.min(wd, BOT_HIZI * Math.max(0, dt));
        if (wd > 1e-6 && adim > 0) {
          d.aci = Math.atan2(wp.x - d.x, wp.z - d.z);
          d.x += ((wp.x - d.x) / wd) * adim;
          d.z += ((wp.z - d.z) / wd) * adim;
        }
        return cikti({ yuruyor: adim > 1e-4 });
      }
    }
  }

  if (d.evre === "dur") {
    const uzak = hedefVar ? Math.hypot(hedef.x - d.x, hedef.z - d.z) : Infinity;
    const gecen = simdiMs - d.durBasMs;
    const toplam = HOP_BAS_MS + d.hop * HOP_ARA_MS + DUR_SON_MS;
    if (hedefVar && uzak > DURMA_MESAFE + 3 && simdiMs - d.basMs < ZIYARET_GIT_MS) {
      d.evre = "git";                 // oyuncu yürüdü: biraz daha peşinden
      return cikti({});
    }
    if (!hedefVar || uzak > DURMA_MESAFE + 3 || gecen >= toplam) {
      donuseGec();
    } else {
      d.aci = Math.atan2(hedef.x - d.x, hedef.z - d.z);
      let emoji = null;
      if (!d.emojiAtildi && gecen >= EMOJI_MS) { d.emojiAtildi = true; emoji = d.emoji; }
      return cikti({ emoji, zipla: hopYuksekligi(gecen - HOP_BAS_MS, d.hop) });
    }
  }

  // donus: plana geri katılma yolu
  const k = planKonumu(d.donus, simdiMs);
  d.x = k.x; d.z = k.z;
  if (k.yuruyor) d.aci = k.aci;
  return cikti({ yuruyor: k.yuruyor, bitti: k.bitti });
}

// ============================================================
// BOT-BOT BULUŞMASI (kahve / balon ikramı)
//
// Aynı anda çizilen iki botun buluşması çiftin tohumlarından kararlı.
// Çiftler geliş sırasıyla (sonra gelenin başlangıcı) işlenir: yeni gelen
// bir bot önceden kararlaştırılmış buluşmayı bozamaz. Buluşma anı sonra
// gelenin girişinden en az 40 sn sonradır — her istemci planı değişmeden
// önce öğrenir. Buluşma planın ÜSTÜNE eklenir (bacak): bot planın o
// anki noktasından ayrılır, buluşma noktasına tam vaktinde varır, bekler,
// sonra planın ileride olacağı noktaya yetişir. Bacağın dışında plan
// değişmez; bu yüzden geç açılan istemci de botu aynı yerde görür.
// ============================================================

/** Planın `basMs`'de P noktasına varıp `bitMs`'e kadar beklediği bacak. */
function bacakKur(plan, P, basMs, bitMs, yuz, engel) {
  const hizMs = 1000 / BOT_HIZI;
  const alt = Math.max(plan.dolasBasMs, basMs - 30000);
  let git = null, gidisYol = null;
  for (let t = basMs; t >= alt; t -= TARAMA_MS) {
    const k = planKonumu(plan, t);
    const yol = sapmaliYol(k, P, engel);
    if (t + uzunluk(k, yol) * hizMs <= basMs) { git = t; gidisYol = yol; break; }
  }
  if (git === null) return null;

  let don = null, donusYol = null, donusMs = 0;
  for (let t = bitMs; t <= plan.cikisBasMs; t += TARAMA_MS) {
    const k = planKonumu(plan, t);
    const yol = sapmaliYol(P, k, engel);
    const ms = uzunluk(P, yol) * hizMs;
    if (bitMs + ms <= t) { don = t; donusYol = yol; donusMs = ms; break; }
  }
  if (don === null) return null;

  const k0 = planKonumu(plan, git);
  const noktalar = [{ t: git, x: k0.x, z: k0.z, aci: k0.aci }];
  yoluEkle(noktalar, gidisYol, hizMs);
  const varis = noktalar[noktalar.length - 1];
  noktalar.push({ t: varis.t, x: P.x, z: P.z, aci: yuz });
  noktalar.push({ t: Math.max(varis.t, don - donusMs), x: P.x, z: P.z, aci: yuz });
  yoluEkle(noktalar, donusYol, hizMs);
  noktalar[noktalar.length - 1].t = Math.max(noktalar[noktalar.length - 2].t, don);
  return { gitMs: git, donMs: don, noktalar };
}

function cakisir(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }

/** Tek çift için uygun buluşma (yoksa null). */
function bulusmaKur(A, B, cift, engel, kayitlar) {
  const tur = tohumSayi(cift, "tur") < 0.5 ? "kahve" : "balon";
  const sureMs = tur === "kahve" ? KAHVE_MS : BALON_MS;
  const alt = Math.max(A.plan.dolasBasMs, B.plan.dolasBasMs, Math.max(A.plan.baslaMs, B.plan.baslaMs) + 40000);
  const ust = Math.min(A.plan.cikisBasMs, B.plan.cikisBasMs) - sureMs - 16000;
  if (!(ust >= alt)) return null;

  for (let deneme = 0; deneme < 4; deneme++) {
    const basMs = alt + tohumSayi(cift, "t" + deneme) * (ust - alt);
    const bitMs = basMs + sureMs;
    const pA = planKonumu(A.plan, basMs), pB = planKonumu(B.plan, basMs);
    const aA = Math.atan2(pA.z, pA.x), aB = Math.atan2(pB.z, pB.x);
    const fark = aciFarki(aA, aB);
    const orta = aA + fark / 2;
    const yarim = BULUSMA_ARA / 2 / BULUSMA_R;
    const isaret = fark >= 0 ? 1 : -1;
    const nA = { x: Math.cos(orta - isaret * yarim) * BULUSMA_R, z: Math.sin(orta - isaret * yarim) * BULUSMA_R };
    const nB = { x: Math.cos(orta + isaret * yarim) * BULUSMA_R, z: Math.sin(orta + isaret * yarim) * BULUSMA_R };
    const yuzA = Math.atan2(nB.x - nA.x, nB.z - nA.z);
    const yuzB = Math.atan2(nA.x - nB.x, nA.z - nB.z);

    const bA = bacakKur(A.plan, nA, basMs, bitMs, yuzA, engel);
    const bB = bA && bacakKur(B.plan, nB, basMs, bitMs, yuzB, engel);
    if (!bA || !bB) continue;

    let uygun = true;
    for (const [X, b] of [[A, bA], [B, bB]]) {
      for (const w of X.ziyaretler ?? []) {
        if (cakisir(b.gitMs - 3000, b.donMs + 3000, w.basMs, w.basMs + ZIYARET_KILIT_MS)) { uygun = false; break; }
      }
      for (const e of kayitlar.get(X.id) ?? []) {
        if (cakisir(b.gitMs - BULUSMA_BOSLUK_MS, b.donMs + BULUSMA_BOSLUK_MS, e.gitMs, e.donMs)) { uygun = false; break; }
      }
      if (!uygun) break;
    }
    if (!uygun) continue;

    const verenA = tohumSayi(cift, "veren") < 0.5;
    const veren = verenA ? A.id : B.id, alan = verenA ? B.id : A.id;
    // İKRAM EMOJİSİ (Paket 7, madde 2b): ~%35 buluşmada küçük bir emoji —
    // ya ikram başlarken veren, ya biterken alan (teşekkür). Tohumlu, her
    // istemci aynı anı görür.
    let emoji = null;
    if (tohumSayi(cift, "emoji") < 0.35) {
      const sonda = tohumSayi(cift, "emojiAn") < 0.5;
      const liste = sonda ? ["😊", "🙏", "❤️", "👍"] : ["😄", "☕", "🎈", "👋"];
      const deger = tur === "kahve" && !sonda ? "☕" : tur === "balon" && !sonda ? "🎈"
        : liste[Math.floor(tohumSayi(cift, "emojiD") * liste.length) % liste.length];
      emoji = { bot: sonda ? alan : veren, deger, anMs: sonda ? bitMs - 2000 : basMs + 900 };
    }
    return {
      id: cift, tur, basMs, bitMs, a: A.id, b: B.id,
      veren, alan, emoji,
      bacaklar: { [A.id]: bA, [B.id]: bB },
      nokta: { [A.id]: nA, [B.id]: nB },
    };
  }
  return null;
}

/**
 * Çizilen botlar arasındaki buluşmalar.
 * @param {Array<{id:string, tohum:string, basSira:number, sira:number, plan:object, ziyaretler:Array}>} adaylar
 *   basSira: sunucunun HAM başlangıç anı (ms) — tüm istemcilerde aynı sıralama için.
 * @returns {Array<{id,tur,basMs,bitMs,a,b,veren,alan,bacaklar}>}
 */
export function botBulusmalariniPlanla(adaylar, ayar, engeller) {
  const olasilik = Math.max(0, Number(ayar?.ikramYuzde ?? 0)) / 100;
  if (!(olasilik > 0) || !adaylar?.length) return [];
  const engel = [...(engeller ?? []), HAVUZ];
  const sirali = [...adaylar].sort(
    (x, y) => x.basSira - y.basSira || (x.sira ?? 0) - (y.sira ?? 0) || (x.tohum < y.tohum ? -1 : 1)
  );
  const kayitlar = new Map();   // id -> [{gitMs, donMs}]
  const sonuc = [];
  for (let i = 1; i < sirali.length; i++) {
    const B = sirali[i];
    for (let j = 0; j < i; j++) {
      const A = sirali[j];
      if (!(A.plan?.noktalar?.length) || !(B.plan?.noktalar?.length)) continue;
      const cift = `${A.tohum}|${B.tohum}`;
      if (tohumSayi(cift, "ikram") >= olasilik) continue;
      const m = bulusmaKur(A, B, cift, engel, kayitlar);
      if (!m) continue;
      sonuc.push(m);
      for (const id of [A.id, B.id]) {
        if (!kayitlar.has(id)) kayitlar.set(id, []);
        kayitlar.get(id).push(m.bacaklar[id]);
      }
    }
  }
  return sonuc;
}

/**
 * Planın üstüne bacakları ekler (bacak dışındaki noktalar aynen kalır).
 * @returns yeni plan nesnesi
 */
export function planaBacakEkle(plan, bacaklar) {
  if (!bacaklar?.length) return plan;
  const sirali = [...bacaklar].sort((a, b) => a.gitMs - b.gitMs);
  const n = plan.noktalar;
  const yeni = [];
  let i = 0;
  for (const bk of sirali) {
    while (i < n.length && n[i].t < bk.gitMs) yeni.push(n[i++]);
    yeni.push(...bk.noktalar);
    while (i < n.length && n[i].t <= bk.donMs) i++;
  }
  while (i < n.length) yeni.push(n[i++]);
  return { ...plan, noktalar: yeni };
}
