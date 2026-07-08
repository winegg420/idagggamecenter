// ============================================================
// RUN — Ofis haritası. ~%30 küçültüldü. Oda içi mobilyalar artık ENGEL
// (içinden geçilmez) ama geniş boşluklarla yollar kapanmaz. Oda düzenleri
// tipe göre çeşitli. Yürünebilir = (oda/koridor/çıkış) VE engel değil.
// ============================================================

const KOL = 4, SAT = 4, RW = 520, RH = 430, KOR = 110;   // küçültülmüş
const ENGEL_PAY = 10;                                     // çarpışma için engel şişirme

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

function haritaUret() {
  const W = (KOL + 1) * KOR + KOL * RW;
  const H = (SAT + 1) * KOR + SAT * RH;
  const alanlar = [], engeller = [];

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
      if (!BOS_HUCRE.has(idx)) {
        for (const eng of odaEngelleri(oda)) engeller.push(eng);
        nesneler.push({ x: x + RW * 0.3, y: y + RH * 0.2, ad: ad + " PC" });
      }
    }
  }

  const cikislar = [
    { x: 0, y: H / 2 - 40, w: 56, h: 80, ad: "Batı Çıkış" },
    { x: W - 56, y: H / 2 - 40, w: 56, h: 80, ad: "Doğu Çıkış" },
    { x: W / 2 - 40, y: 0, w: 80, h: 56, ad: "Kuzey Çıkış" },
  ];

  return { genislik: W, yukseklik: H, baslangic: { x: W / 2, y: H / 2 }, alanlar, cikislar, nesneler, engeller };
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
