// ============================================================
// RUN — Ofis haritası. ~%30 küçültüldü. Oda içi mobilyalar ENGEL (içinden
// geçilmez) ama geniş boşluklarla yollar kapanmaz. Odaların çevresi DUVAR;
// her odaya 2-3 KAPI geçidi açılır → gerçek labirent akışı.
// Yürünebilir = (oda/koridor/çıkış) VE engel değil. Kapı geçitleri boşluktur;
// "kapalı kapı" yalnızca drone'u durdurur (bkz. durum.js).
// ============================================================

import { KAPI_GENISLIK, KAPI_KALINLIK } from "./sabitler.js";

const KOL = 4, SAT = 4, KOR = 110;   // hücre ızgarası + koridor genişliği
const ENGEL_PAY = 10;                // çarpışma için engel şişirme

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

// Oda tipleri — her tipin kendine özgü mobilya düzeni ve (render'da) zemin tonu var.
// 14 tekil hücre + 2 birleşik oda (Kafeterya yatay, Atrium dikey) = 16 oda.
const ODA_TIPLERI = [
  { ad: "Muhasebe Ofisi", tip: "ofis" },
  { ad: "Yönetim Ofisi", tip: "ofis" },
  { ad: "İK Ofisi", tip: "ofis" },
  { ad: "Satış Ofisi", tip: "ofis" },
  { ad: "Sunucu Odası", tip: "sunucu" },
  { ad: "Toplantı Odası", tip: "toplanti" },
  { ad: "Dinlenme Alanı", tip: "dinlenme" },
  { ad: "Mutfak", tip: "mutfak" },
  { ad: "Arşiv", tip: "arsiv" },
  { ad: "Depo", tip: "depo" },
  { ad: "Güvenlik Odası", tip: "guvenlik" },
  { ad: "IT Laboratuvarı", tip: "lab" },
  { ad: "Giriş Holü", tip: "giris" },
  { ad: "Fuaye", tip: "plaza" },
];

// Tip bazlı engel (mobilya) düzenleri — rnd ile varyasyon; geniş boşluklarla yol kapanmaz.
function odaEngelleri(a, rnd) {
  const e = [];
  const push = (x, y, w, h, tip) => e.push({ x, y, w, h, tip });
  const M = 90;                                    // duvar/kapı geçidi payı
  switch (a.tip) {
    case "sunucu": {
      const adet = 3 + Math.floor(rnd() * 2);
      for (let k = 0; k < adet; k++)
        push(a.x + (a.w / adet) * (k + 0.5) - 17, a.y + a.h * 0.2, 34, a.h * 0.6, "raf");
      break;
    }
    case "toplanti":
      if (rnd() < 0.5) push(a.x + a.w * 0.28, a.y + a.h * 0.36, a.w * 0.44, a.h * 0.28, "masa_buyuk");
      else push(a.x + a.w * 0.37, a.y + a.h * 0.22, a.w * 0.26, a.h * 0.56, "masa_buyuk");
      break;
    case "dinlenme": {
      const altta = rnd() < 0.5;
      push(a.x + a.w * 0.2, altta ? a.y + a.h - M - 26 : a.y + M, a.w * 0.6, 26, "kanepe");
      push(a.x + a.w * 0.42, a.y + a.h * 0.45, a.w * 0.16, 30, "sehpa");
      break;
    }
    case "mutfak":
      push(a.x + M, a.y + M, a.w - 2 * M - 90, 26, "tezgah");
      push(a.x + a.w - M - 46, a.y + M, 46, 62, "buzdolabi");
      push(a.x + a.w * 0.35, a.y + a.h * 0.55, a.w * 0.3, 42, "masa_buyuk");
      break;
    case "kafeterya":
      push(a.x + M, a.y + a.h * 0.5 - 60, 30, 120, "tezgah");        // servis bankosu
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 3; sx++)
          push(a.x + a.w * (0.3 + sx * 0.22) - 27, a.y + a.h * (0.32 + sy * 0.36) - 27, 54, 54, "masa_yuvarlak");
      break;
    case "arsiv": {
      const sira = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < sira; k++)
        push(a.x + a.w * 0.16, a.y + a.h * (0.26 + k * 0.24), a.w * 0.68, 22, "raf_kutu");
      break;
    }
    case "depo":
      for (const [fx, fy] of [[0.28, 0.3], [0.72, 0.3], [0.28, 0.7], [0.72, 0.7]])
        push(a.x + a.w * fx - 50, a.y + a.h * fy - 36, 100, 72, "kutu_blok");
      break;
    case "guvenlik":
      push(a.x + a.w * 0.2, a.y + M, a.w * 0.6, 26, "monitor_duvari");
      push(a.x + a.w * 0.34, a.y + a.h * 0.44, a.w * 0.32, 34, "masa");
      break;
    case "lab":
      push(a.x + a.w * 0.16, a.y + a.h * 0.3, a.w * 0.68, 30, "lab_tezgah");
      push(a.x + a.w * 0.16, a.y + a.h * 0.62, a.w * 0.68, 30, "lab_tezgah");
      break;
    case "giris":
      push(a.x + a.w * 0.3, a.y + a.h * 0.46, a.w * 0.4, 26, "tezgah");
      push(a.x + M, a.y + a.h - M - 18, 64, 18, "bank");
      push(a.x + a.w - M - 64, a.y + a.h - M - 18, 64, 18, "bank");
      break;
    case "atrium":
      push(a.x + a.w * 0.5 - 46, a.y + a.h * 0.3 - 46, 92, 92, "bitki_adasi");
      push(a.x + a.w * 0.5 - 46, a.y + a.h * 0.68 - 46, 92, 92, "bitki_adasi");
      push(a.x + a.w * 0.22, a.y + a.h * 0.5 - 9, 70, 18, "bank");
      push(a.x + a.w * 0.78 - 70, a.y + a.h * 0.5 - 9, 70, 18, "bank");
      break;
    case "plaza":
      break;                                       // boş fuaye — nefes alanı
    default: {                                     // ofis — boyuta göre 2-3 kolon masa, hafif kaymalı
      const kolon = a.w > 520 ? 3 : 2;
      for (let ry = 0; ry < 2; ry++)
        for (let cx = 0; cx < kolon; cx++) {
          const bx = a.x + a.w * ((cx + 1) / (kolon + 1)) + (rnd() - 0.5) * 24;
          const by = a.y + a.h * (0.36 + ry * 0.3) + (rnd() - 0.5) * 16;
          push(bx - 32, by - 18, 64, 36, "masa");
        }
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
  // Büyük (birleşik) odalar her kenardan geçit alır; normal odalar 2-3
  const buyuk = a.w > 750 || a.h > 750;
  const kapiliKenar = new Set(kenarlar.slice(0, buyuk ? 4 : rnd() < 0.45 ? 3 : 2));

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

  // Değişken kolon genişlikleri / satır yükseklikleri — tekdüze ızgara hissini kırar
  const kolW = [], satH = [];
  for (let c = 0; c < KOL; c++) kolW.push(Math.round(440 + rnd() * 200));
  for (let r = 0; r < SAT; r++) satH.push(Math.round(370 + rnd() * 150));
  const xOff = [KOR], yOff = [KOR];
  for (let c = 1; c < KOL; c++) xOff.push(xOff[c - 1] + kolW[c - 1] + KOR);
  for (let r = 1; r < SAT; r++) yOff.push(yOff[r - 1] + satH[r - 1] + KOR);
  const W = xOff[KOL - 1] + kolW[KOL - 1] + KOR;
  const H = yOff[SAT - 1] + satH[SAT - 1] + KOR;

  const alanlar = [], engeller = [], kapilar = [], nesneler = [];

  // Koridor ızgarası
  for (let c = 0; c <= KOL; c++) {
    const x = c === 0 ? 0 : xOff[c - 1] + kolW[c - 1];
    alanlar.push({ x, y: 0, w: KOR, h: H, koridor: true });
  }
  for (let r = 0; r <= SAT; r++) {
    const y = r === 0 ? 0 : yOff[r - 1] + satH[r - 1];
    alanlar.push({ x: 0, y, w: W, h: KOR, koridor: true, ad: r === Math.floor(SAT / 2) ? "Ana Koridor" : undefined });
  }

  // Birleşik odalar: yatay çift hücre (Kafeterya) + dikey çift hücre (Atrium).
  // Aradaki koridor parçasını da kapsarlar → farklı ölçekte mekân hissi.
  const yC = { r: 1 + Math.floor(rnd() * 2), c: Math.floor(rnd() * (KOL - 1)) };
  const kullanilan = new Set([`${yC.r},${yC.c}`, `${yC.r},${yC.c + 1}`]);
  let dC = null;
  for (let d = 0; d < 40 && !dC; d++) {
    const r = Math.floor(rnd() * (SAT - 1)), c = Math.floor(rnd() * KOL);
    if (!kullanilan.has(`${r},${c}`) && !kullanilan.has(`${r + 1},${c}`)) dC = { r, c };
  }
  if (dC) { kullanilan.add(`${dC.r},${dC.c}`); kullanilan.add(`${dC.r + 1},${dC.c}`); }

  const odalar = [
    { x: xOff[yC.c], y: yOff[yC.r], w: kolW[yC.c] + KOR + kolW[yC.c + 1], h: satH[yC.r], ad: "Kafeterya", tip: "kafeterya" },
  ];
  if (dC) odalar.push({ x: xOff[dC.c], y: yOff[dC.r], w: kolW[dC.c], h: satH[dC.r] + KOR + satH[dC.r + 1], ad: "Atrium", tip: "atrium" });

  // Kalan tekil hücreler: tip listesi tohumlu karıştırılıp dağıtılır
  const tipler = [...ODA_TIPLERI].sort(() => rnd() - 0.5);
  let ti = 0;
  for (let r = 0; r < SAT; r++) {
    for (let c = 0; c < KOL; c++) {
      if (kullanilan.has(`${r},${c}`)) continue;
      const t = tipler[ti % tipler.length]; ti++;
      odalar.push({ x: xOff[c], y: yOff[r], w: kolW[c], h: satH[r], ad: t.ad, tip: t.tip });
    }
  }

  for (const oda of odalar) {
    oda.aydinlik = /sunucu|giris|guvenlik/.test(oda.tip) || rnd() < 0.15;
    alanlar.push(oda);
    const mobilya = odaEngelleri(oda, rnd);
    for (const m of mobilya) engeller.push(m);
    odaDuvarlari(oda, rnd, engeller, kapilar, mobilya);
    // Ele geçirilebilir makine: oda içinde mobilyaya/duvara çarpmayan bir nokta
    if (oda.tip !== "plaza") {
      const nokta = bosNokta(oda, mobilya);
      if (nokta) nesneler.push({ x: nokta.x, y: nokta.y, ad: oda.ad + " PC" });
    }
  }

  // Başlangıç: orta koridor kavşağı (değişken boyutlarda W/2,H/2 oda içine düşebilir)
  const basX = xOff[Math.floor(KOL / 2)] - KOR / 2;
  const basY = yOff[Math.floor(SAT / 2)] - KOR / 2;

  const cikislar = [
    { x: 0, y: basY - 40, w: 56, h: 80, ad: "Batı Çıkış" },
    { x: W - 56, y: basY - 40, w: 56, h: 80, ad: "Doğu Çıkış" },
    { x: basX - 40, y: 0, w: 80, h: 56, ad: "Kuzey Çıkış" },
  ];

  return { genislik: W, yukseklik: H, baslangic: { x: basX, y: basY }, alanlar, cikislar, nesneler, engeller, kapilar };
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
