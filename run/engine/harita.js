// ============================================================
// RUN — Ofis haritası. ~%30 küçültüldü. Oda içi mobilyalar ENGEL (içinden
// geçilmez) ama geniş boşluklarla yollar kapanmaz. Odaların çevresi DUVAR;
// her odaya 2-3 KAPI geçidi açılır → gerçek labirent akışı.
// Yürünebilir = (oda/koridor/çıkış) VE engel değil. Kapı geçitleri boşluktur;
// "kapalı kapı" yalnızca drone'u durdurur (bkz. durum.js).
// ============================================================

import { KAPI_GENISLIK, KAPI_KALINLIK } from "./sabitler.js";

const KOL = 4, SAT = 4, RW = 520, RH = 430, KOR = 110;   // küçültülmüş
const ENGEL_PAY = 10;                                     // çarpışma için engel şişirme

// Sabit tohumlu RNG — harita her yüklemede aynı (tasarım/test tekrarlanabilir olsun).
function tohumluRastgele(tohum) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ISIMLER = [
  "Muhasebe Ofisi", "Yönetim Ofisi", "İK Ofisi", "Satış Ofisi",
  "Pazarlama Ofisi", "Sunucu Odası", "Toplantı Odası A", "Toplantı Odası B",
  "Dinlenme Alanı", "Mutfak", "Arşiv", "Depo",
  "Güvenlik Odası", "IT Teknik Oda", "Giriş Holü", "Açık Ofis",
];
// Boş bırakılacak (mobilyasız/plaza) oda hücreleri — çeşitlilik için
const BOS_HUCRE = new Set([2, 9, 12]);

// Odaya göre engel (mobilya) rectleri — geniş boşluk/margin ile (yol kapanmaz).
function odaEngelleri(a) {
  const e = [];
  const ad = a.ad || "";
  const push = (x, y, w, h, tip) => e.push({ x, y, w, h, tip });
  if (/Sunucu/.test(ad)) {
    for (let k = 0; k < 3; k++) push(a.x + a.w * (0.24 + k * 0.26), a.y + a.h * 0.28, 34, a.h * 0.44, "raf");
  } else if (/Toplantı/.test(ad)) {
    push(a.x + a.w * 0.3, a.y + a.h * 0.36, a.w * 0.4, a.h * 0.28, "masa_buyuk");
  } else if (/Dinlenme/.test(ad)) {
    push(a.x + a.w * 0.22, a.y + a.h - 64, a.w * 0.56, 26, "kanepe");
    push(a.x + a.w * 0.4, a.y + a.h * 0.42, a.w * 0.2, 30, "sehpa");
  } else if (/Mutfak/.test(ad)) {
    push(a.x + 40, a.y + 38, a.w - 130, 26, "tezgah");
    push(a.x + a.w - 70, a.y + 38, 46, 60, "buzdolabi");
    push(a.x + a.w * 0.38, a.y + a.h * 0.58, a.w * 0.26, 40, "masa_buyuk");
  } else if (/Arşiv|Depo/.test(ad)) {
    push(a.x + a.w * 0.18, a.y + a.h * 0.3, a.w * 0.64, 22, "raf_kutu");
    push(a.x + a.w * 0.18, a.y + a.h * 0.62, a.w * 0.64, 22, "raf_kutu");
  } else if (/Giriş/.test(ad)) {
    push(a.x + a.w * 0.28, a.y + a.h * 0.5, a.w * 0.44, 24, "tezgah");
  } else { // ofisler (masalar — 2x2, geniş koridorlarla)
    for (const cx of [a.x + a.w * 0.3, a.x + a.w * 0.66]) {
      for (const cy of [a.y + a.h * 0.36, a.y + a.h * 0.66]) push(cx - 32, cy - 18, 64, 36, "masa");
    }
  }
  return e;
}

function kesisiyor(r1, r2, pay = 0) {
  return r1.x < r2.x + r2.w + pay && r1.x + r1.w + pay > r2.x &&
         r1.y < r2.y + r2.h + pay && r1.y + r1.h + pay > r2.y;
}

// Odanın çevresine duvar örer; kapılı kenarlarda bir geçit boşluğu bırakır.
// Kenar başına en fazla 1 geçit; odada en az 2 geçit (kapana kısılma olmaz).
// Geçit yeri mobilyaya çarpmayacak şekilde seçilir (reddetme örneklemesi); hiçbir
// yer bulunamazsa geçidi tıkayan mobilya odadan çıkarılır → kapı hep kullanılabilir.
function odaDuvarlari(a, rnd, engeller, kapilar, mobilya) {
  const T = KAPI_KALINLIK, G = KAPI_GENISLIK, PAY = 70; // PAY: köşeye en yakın geçit mesafesi
  const kenarlar = ["ust", "alt", "sol", "sag"].sort(() => rnd() - 0.5);
  const kapiliKenar = new Set(kenarlar.slice(0, rnd() < 0.45 ? 3 : 2));

  const duvar = (x, y, w, h) => { if (w > 0.5 && h > 0.5) engeller.push({ x, y, w, h, tip: "duvar" }); };

  // Geçidin odaya açıldığı "giriş koridoru" — burada mobilya olmamalı.
  const gecitKoridoru = (kenar, g0) => {
    const D = 105;
    if (kenar === "ust") return { x: a.x + g0, y: a.y, w: G, h: D };
    if (kenar === "alt") return { x: a.x + g0, y: a.y + a.h - D, w: G, h: D };
    if (kenar === "sol") return { x: a.x, y: a.y + g0, w: D, h: G };
    return { x: a.x + a.w - D, y: a.y + g0, w: D, h: G };
  };

  for (const kenar of ["ust", "alt", "sol", "sag"]) {
    const yatay = kenar === "ust" || kenar === "alt";
    const uzunluk = yatay ? a.w : a.h;
    const wx = yatay ? a.x : (kenar === "sol" ? a.x : a.x + a.w - T);
    const wy = yatay ? (kenar === "ust" ? a.y : a.y + a.h - T) : a.y;

    if (!kapiliKenar.has(kenar)) {                       // kapısız kenar: düz duvar
      if (yatay) duvar(wx, wy, a.w, T); else duvar(wx, wy, T, a.h);
      continue;
    }

    const serbest = Math.max(1, uzunluk - 2 * PAY - G);
    let g0 = PAY, temiz = false;
    for (let deneme = 0; deneme < 14 && !temiz; deneme++) {
      g0 = PAY + rnd() * serbest;
      const kor = gecitKoridoru(kenar, g0);
      temiz = !mobilya.some((m) => kesisiyor(kor, m, ENGEL_PAY));
    }
    if (!temiz) {                                        // son çare: tıkayan mobilyayı kaldır
      const kor = gecitKoridoru(kenar, g0);
      for (const m of mobilya.filter((m) => kesisiyor(kor, m, ENGEL_PAY))) {
        const i = engeller.indexOf(m);
        if (i >= 0) engeller.splice(i, 1);
      }
    }

    if (yatay) {
      duvar(a.x, wy, g0, T);
      duvar(a.x + g0 + G, wy, a.w - g0 - G, T);
      kapilar.push({ x: a.x + g0, y: wy, w: G, h: T, yatay: true, oda: a.ad });
    } else {
      duvar(wx, a.y, T, g0);
      duvar(wx, a.y + g0 + G, T, a.h - g0 - G);
      kapilar.push({ x: wx, y: a.y + g0, w: T, h: G, yatay: false, oda: a.ad });
    }
  }
}

// Oda içinde mobilyaya/duvara değmeyen bir nokta (makine yerleştirmek için).
function bosNokta(a, mobilya) {
  const IC = KAPI_KALINLIK + 34;                     // duvar payı
  const aday = { x: 0, y: 0, w: 22, h: 18 };
  for (const oy of [0.5, 0.24, 0.76]) {
    for (const ox of [0.5, 0.22, 0.78, 0.36, 0.64]) {
      const px = a.x + a.w * ox, py = a.y + a.h * oy;
      if (px < a.x + IC || px > a.x + a.w - IC || py < a.y + IC || py > a.y + a.h - IC) continue;
      aday.x = px - 11; aday.y = py - 9;
      if (!mobilya.some((m) => kesisiyor(aday, m, ENGEL_PAY + 6))) return { x: px, y: py };
    }
  }
  return null;
}

function haritaUret() {
  const rnd = tohumluRastgele(20260709);
  const W = (KOL + 1) * KOR + KOL * RW;
  const H = (SAT + 1) * KOR + SAT * RH;
  const alanlar = [], engeller = [], kapilar = [];

  for (let v = 0; v <= KOL; v++) alanlar.push({ x: v * (RW + KOR), y: 0, w: KOR, h: H, koridor: true });
  for (let r = 0; r <= SAT; r++) {
    const orta = r === Math.floor(SAT / 2);
    alanlar.push({ x: 0, y: r * (RH + KOR), w: W, h: KOR, koridor: true, ad: orta ? "Ana Koridor" : undefined });
  }

  let i = 0;
  const nesneler = [];
  for (let r = 0; r < SAT; r++) {
    for (let c = 0; c < KOL; c++) {
      const idx = r * KOL + c;
      const x = KOR + c * (RW + KOR), y = KOR + r * (RH + KOR);
      const ad = ISIMLER[i % ISIMLER.length]; i++;
      const aydinlik = /Sunucu|Giriş|Güvenlik/.test(ad) || idx % 5 === 0;
      const oda = { x, y, w: RW, h: RH, ad, aydinlik };
      alanlar.push(oda);
      const mobilya = BOS_HUCRE.has(idx) ? [] : odaEngelleri(oda);
      for (const eng of mobilya) engeller.push(eng);
      odaDuvarlari(oda, rnd, engeller, kapilar, mobilya);
      // Ele geçirilebilir makine: oda içinde mobilyaya ve duvara çarpmayan bir noktada.
      if (!BOS_HUCRE.has(idx)) {
        const nokta = bosNokta(oda, mobilya);
        if (nokta) nesneler.push({ x: nokta.x, y: nokta.y, ad: ad + " PC" });
      }
    }
  }

  const cikislar = [
    { x: 0, y: H / 2 - 40, w: 56, h: 80, ad: "Batı Çıkış" },
    { x: W - 56, y: H / 2 - 40, w: 56, h: 80, ad: "Doğu Çıkış" },
    { x: W / 2 - 40, y: 0, w: 80, h: 56, ad: "Kuzey Çıkış" },
  ];

  return { genislik: W, yukseklik: H, baslangic: { x: W / 2, y: H / 2 }, alanlar, cikislar, nesneler, engeller, kapilar };
}

export const OFIS = haritaUret();

function noktaRectte(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

function engeldeMi(harita, x, y) {
  for (const e of harita.engeller) {
    if (x >= e.x - ENGEL_PAY && x <= e.x + e.w + ENGEL_PAY && y >= e.y - ENGEL_PAY && y <= e.y + e.h + ENGEL_PAY) return true;
  }
  return false;
}

export function yurunebilir(harita, x, y) {
  if (engeldeMi(harita, x, y)) return false;      // mobilya = engel
  for (const a of harita.alanlar) if (noktaRectte(x, y, a)) return true;
  for (const c of harita.cikislar) if (noktaRectte(x, y, c)) return true;
  return false;
}
export function cikistaMi(harita, x, y) { return harita.cikislar.some((c) => noktaRectte(x, y, c)); }
export function odaAdi(harita, x, y) {
  for (const a of harita.alanlar) if (a.ad && !a.koridor && noktaRectte(x, y, a)) return a.ad;
  return null;
}
