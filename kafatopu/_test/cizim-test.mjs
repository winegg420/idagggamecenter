// ============================================================
// KAFA TOPU — çizim yolu regresyon testi (Node, canvas mock'u ile).
//
// Neyi korur: iPhone kasma düzeltmesinin kök nedenleri geri gelmesin.
// Kare başına OLMAMASI gerekenler:
//   - clip()            → Safari'de daire clip'i maske katmanı + GPU flush
//   - büyük ölçek-küçültmeli drawImage → 1000+ px kaynaktan ~150 px'e örnekleme
//   - yeni canvas tahsisi → pişirikler önbellekte kalmalı
// Ayrıca düz arka plan modu (zayıf cihaz) parallax modundan daha az iş yapmalı.
//
// Çalıştırma: node kafatopu/_test/cizim-test.mjs
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const MODUL = path.resolve(BURASI, "..");
const KOK = path.resolve(MODUL, "..");

// Foto kafa manifesti gerçek dosyadan okunur (yolu yanlışsa test anlamsız olur).
const manifest = JSON.parse(
  fs.readFileSync(path.join(KOK, "public/heads/manifest.json"), "utf8")
);

// ---------- Canvas mock'u: her komutu sayar ----------
let sayac;
const sifirla = () => {
  sayac = { toplam: 0, clip: 0, drawImage: 0, buyukOlcek: 0, tuval: 0 };
};
sifirla();

function ctxYap(canvas) {
  const t = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const say = () => { sayac.toplam++; };
  const grad = () => ({ addColorStop() {} });
  return {
    canvas,
    save: say, restore: say, translate: say, rotate: say,
    beginPath: say, closePath: say, moveTo: say, lineTo: say, arc: say,
    ellipse: say, quadraticCurveTo: say, bezierCurveTo: say, roundRect: say, rect: say,
    fill: say, stroke: say, fillRect: say, strokeRect: say, clearRect: say,
    fillText: say, setLineDash: say,
    setTransform(a, b, c, d, e, f) { say(); Object.assign(t, { a, b, c, d, e, f }); },
    getTransform() { return { ...t }; },
    scale(x) { say(); t.a *= x; },
    clip() { say(); sayac.clip++; },
    drawImage(img, ...a) {
      say();
      sayac.drawImage++;
      if (!img) throw new Error("drawImage: kaynak yok");
      // 9 argümanlı biçimde kaynak alanı hedeften 3 kattan fazla büyükse
      // "büyük ölçek-küçültme" (Safari'de pahalı doku örnekleme).
      if (a.length === 8 && a[2] / Math.max(1, a[6]) > 3) sayac.buyukOlcek++;
    },
    createLinearGradient: grad, createRadialGradient: grad,
    measureText: () => ({ width: 10 }),
  };
}

globalThis.document = {
  createElement() {
    sayac.tuval++;
    const c = { width: 300, height: 150, tagName: "CANVAS" };
    c.getContext = () => ctxYap(c);
    return c;
  },
};
globalThis.Image = class {
  constructor() { this.width = 1100; this.height = 1100; this.complete = true; }
  set src(v) { this._src = v; setTimeout(() => this.onload?.(), 0); }
  get src() { return this._src; }
};
globalThis.fetch = async () => ({ ok: true, json: async () => manifest });

// ---------- Modüller ----------
const { sahneCiz, duzArkaplanAyarla, pisirikBosalt } = await import(
  new URL("../engine/render.js", import.meta.url)
);
const { kafaOnbellegiBosalt } = await import(
  new URL("../engine/kafaCizim.js", import.meta.url)
);
const { kafaBul, fotoKafalariYukle, KURGUSAL_KAFALAR } = await import(
  new URL("../shared/karakterler.js", import.meta.url)
);
const { SAHA } = await import(new URL("../shared/sabitler.js", import.meta.url));

await fotoKafalariYukle();
await new Promise((r) => setTimeout(r, 30)); // Image.onload'lar dönsün

let hata = 0;
const kontrol = (ad, kosul, bilgi = "") => {
  console.log(`  ${kosul ? "✓" : "✗"} ${ad}${bilgi ? " — " + bilgi : ""}`);
  if (!kosul) hata++;
};

const ana = { width: 1688, height: 780, tagName: "CANVAS" }; // iPhone yatay, dpr 2
const ctx = ctxYap(ana);
const sc = ana.width / SAHA.W;
const ofY = ana.height - SAHA.H * sc;
const pay = { sol: 0, sag: 0, ust: Math.max(0, ofY / sc), alt: 0 };

const snapYap = (topX) => ({
  t: 5000, kalan: 60000, faz: "oyun", fazSonu: 0, skor: [1, 2], sonGol: 0,
  top: { x: topX, y: 300, vx: 5, vy: -3, a: 0.6 },
  oy: [
    { x: 300, y: 470, vx: 4, vy: -6, va: 4900, ol: 1, ef: 1, yb: 0, kk: 0 },
    { x: 700, y: 476, vx: -3, vy: 0, va: -9999, ol: 1.6, ef: 0, yb: 0, kk: 1 },
  ],
  gucler: [{ id: 1, tip: "hiz", ikon: "💨", x: 500, y: 160 }],
  olaylar: [],
});

const kare = (meta, topX) => {
  sifirla();
  ctx.setTransform(sc, 0, 0, sc, 0, ofY);
  sahneCiz(ctx, snapYap(topX), meta, 5000, pay);
  return { ...sayac };
};
// Kararlı hâl: pişirme kareleri geçildikten sonraki kare.
const kararliKare = (meta) => {
  kare(meta, 500);
  kare(meta, 505);
  return kare(meta, 520);
};

const FOTO_META = [
  { slot: 0, takim: 1, ad: "A", kafaKaydi: kafaBul(manifest.kafalar[0].id) },
  { slot: 1, takim: 2, ad: "B", kafaKaydi: kafaBul(manifest.kafalar[1].id) },
];
const KURGU_META = [
  { slot: 0, takim: 1, ad: "A", kafaKaydi: kafaBul(KURGUSAL_KAFALAR[0].id) },
  { slot: 1, takim: 2, ad: "B", kafaKaydi: kafaBul(KURGUSAL_KAFALAR[3].id) },
];

const temizle = () => { pisirikBosalt(); kafaOnbellegiBosalt(); duzArkaplanAyarla(false); };

console.log("[foto kafa — kare başına maliyet]");
temizle();
if (!FOTO_META[0].kafaKaydi.foto) throw new Error("foto kafa kaydı gelmedi (manifest?)");
const foto = kararliKare(FOTO_META);
console.log(`  ${foto.toplam} komut | clip ${foto.clip} | drawImage ${foto.drawImage} | büyük ölçek ${foto.buyukOlcek}`);
kontrol("kare başına clip() yok (daire kırpma pişirilmiş sprite'ta)", foto.clip === 0);
kontrol("kare başına büyük ölçek-küçültme yok", foto.buyukOlcek === 0);
kontrol("kararlı hâlde yeni canvas tahsisi yok", foto.tuval === 0);

console.log("[kurgusal kafa — kare başına maliyet]");
temizle();
const kurgu = kararliKare(KURGU_META);
console.log(`  ${kurgu.toplam} komut | drawImage ${kurgu.drawImage}`);
kontrol("prosedürel yüz her karede yeniden çizilmiyor (<150 komut)", kurgu.toplam < 150, `${kurgu.toplam}`);
kontrol("kararlı hâlde yeni canvas tahsisi yok", kurgu.tuval === 0);

console.log("[düz arka plan modu — zayıf cihaz adımı]");
temizle();
const parallax = kararliKare(FOTO_META);
duzArkaplanAyarla(true);
const duz = kararliKare(FOTO_META);
console.log(`  parallax ${parallax.drawImage} drawImage → düz ${duz.drawImage} drawImage`);
kontrol("düz modda arka plan tek blit (3 katman + kaplama → 1)", duz.drawImage === parallax.drawImage - 3);
kontrol("düz mod daha az komut", duz.toplam < parallax.toplam, `${duz.toplam} < ${parallax.toplam}`);
kontrol("düz modda da yeni canvas tahsisi yok", duz.tuval === 0);

console.log("[önbellek boşaltma / yeniden pişirme]");
temizle();
const ilk = kare(FOTO_META, 500);
kontrol("boşaltmadan sonra ilk kare yeniden pişiriyor", ilk.tuval > 0, `${ilk.tuval} tuval`);
kontrol("pişirme sonrası kare temiz", kare(FOTO_META, 520).tuval === 0);

console.log("[foto görseli henüz yüklenmemiş]");
temizle();
const yuklenmemis = [
  { slot: 0, takim: 1, ad: "F", kafaKaydi: { id: "yok-boyle-kafa", foto: true, odakX: 0.5, odakY: 0.5, yaricap: 0.4 } },
  KURGU_META[1],
];
try {
  kare(yuklenmemis, 500);
  kontrol("yüklenmemiş foto kafa hata atmıyor (canlı çizime düşer)", true);
} catch (e) {
  kontrol("yüklenmemiş foto kafa hata atmıyor", false, e.message);
}

console.log(hata === 0 ? "\nTÜM ÇİZİM TESTLERİ GEÇTİ ✓" : `\n${hata} ÇİZİM TESTİ BAŞARISIZ ✗`);
process.exit(hata === 0 ? 0 : 1);
