// KAFA TOPU karikatür v2 — Head Ball tarzı "çizilmiş karakter" görünümü:
//  1) Karikatür orantı deformasyonu: kafatası büyütülür (bulge), çene
//     inceltilir (pinch) — Messi/Ronaldo kafalarındaki abartılı oran.
//  2) Boyama: güçlü yumuşatma + az seviyeli posterize → düz "cel" boyama.
//  3) Kalın, temiz koyu konturlar (yüz hatları + silüet çevresi).
// Kullanım: node karikatur2.mjs girdi.png cikti.png odakX odakY yaricap [guc]
import Jimp from "jimp";

const [, , girdi, cikti, aOdakX, aOdakY, aYaricap, aGuc] = process.argv;
const ODAK_X = Number(aOdakX ?? 0.5);
const ODAK_Y = Number(aOdakY ?? 0.5);
const YARICAP = Number(aYaricap ?? 0.45);
const GUC = Number(aGuc ?? 1); // deformasyon şiddeti çarpanı

const img = await Jimp.read(girdi);
const { width: w, height: h } = img.bitmap;
const kaynak = new Uint8ClampedArray(img.bitmap.data); // warp kaynağı kopya

// ---------- 1) Karikatür deformasyonu (ters eşleme + bilinear örnekleme) ----------
const faceR = YARICAP * Math.min(w, h);
// Kafatası büyütme: yüz merkezinin üstü; çene inceltme: altı.
const warplar = [
  { cx: ODAK_X * w, cy: ODAK_Y * h - 0.25 * faceR, R: 1.15 * faceR, k: 0.20 * GUC },
  { cx: ODAK_X * w, cy: ODAK_Y * h + 0.80 * faceR, R: 0.65 * faceR, k: -0.14 * GUC },
];

function ornekle(sx, sy, kanal) {
  sx = Math.max(0, Math.min(w - 1.001, sx));
  sy = Math.max(0, Math.min(h - 1.001, sy));
  const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
  const i00 = ((y0 * w + x0) << 2) + kanal;
  const i10 = ((y0 * w + x0 + 1) << 2) + kanal;
  const i01 = (((y0 + 1) * w + x0) << 2) + kanal;
  const i11 = (((y0 + 1) * w + x0 + 1) << 2) + kanal;
  return (
    kaynak[i00] * (1 - fx) * (1 - fy) + kaynak[i10] * fx * (1 - fy) +
    kaynak[i01] * (1 - fx) * fy + kaynak[i11] * fx * fy
  );
}

const hedefData = img.bitmap.data;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    // Hedef pikselin kaynağını bul: her warp'ı tersten uygula.
    let sx = x, sy = y;
    for (const { cx, cy, R, k } of warplar) {
      const dx = sx - cx, dy = sy - cy;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.001) {
        const t = d / R;
        const olcek = 1 + k * (1 - t) * (1 - t); // merkezde tam, kenarda 0
        sx = cx + dx / olcek;
        sy = cy + dy / olcek;
      }
    }
    const i = (y * w + x) << 2;
    hedefData[i] = ornekle(sx, sy, 0);
    hedefData[i + 1] = ornekle(sx, sy, 1);
    hedefData[i + 2] = ornekle(sx, sy, 2);
    hedefData[i + 3] = ornekle(sx, sy, 3);
  }
}
// Düşük alfaları temizle; üst aralığa DOKUNMA (kesit uygulamalarının
// yarı saydam gürültü halkası 255'e terfi etmesin — maske onu eler).
for (let p = 0; p < w * h; p++) {
  const a = hedefData[(p << 2) + 3];
  hedefData[(p << 2) + 3] = a < 90 ? 0 : a;
}

// ---------- 2) Boyama: güçlü yumuşatma + düz renk katmanları ----------
const alphaKopya = new Uint8ClampedArray(w * h);
for (let p = 0; p < w * h; p++) alphaKopya[p] = hedefData[(p << 2) + 3];

// Bulanıklaştırma öncesi: şeffaf bölgeye komşu opak renkleri taşır ki
// blur, silüet kenarına çöp renk (gökkuşağı saçağı) karıştırmasın.
{
  const d = img.bitmap.data;
  for (let tur2 = 0; tur2 < 8; tur2++) {
    const kopya = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) << 2;
        if (kopya[i + 3] > 0) continue; // opak, dokunma
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = ((y + dy) * w + (x + dx)) << 2;
          if (kopya[j + 3] > 0) {
            d[i] = kopya[j]; d[i + 1] = kopya[j + 1]; d[i + 2] = kopya[j + 2];
            d[i + 3] = 1; // "renk dolduruldu" işareti (görünmez düzeyde)
            break;
          }
        }
      }
    }
  }
  // işaret alfalarını sıfırla (renk kaldı, şeffaflık korunur)
  for (let p = 0; p < w * h; p++) if (d[(p << 2) + 3] === 1) d[(p << 2) + 3] = 0;
}

const taban = img.clone();
taban.blur(Math.max(3, Math.round(Math.min(w, h) / 260)));
taban.blur(2);
taban.color([{ apply: "saturate", params: [12] }, { apply: "brighten", params: [3] }]);

// Cel-shading: rengin TONUNU koru, sadece ışığı 5 banda ayır.
// (Kanal bazlı posterize ton kaydırıp lekeler yapıyordu; bu yöntem
// Head Ball'daki gibi temiz, tutarlı boyama üretir.)
{
  const d = taban.bitmap.data;
  const BANT = 5;
  const adim = 255 / (BANT - 1);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (d[i + 3] === 0) continue;
    const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const hedefL = Math.round(L / adim) * adim;
    const olcek = (hedefL + 10) / (L + 10);
    d[i] = Math.max(0, Math.min(255, d[i] * olcek));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * olcek));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * olcek));
  }
}

// ---------- 3) Kalın konturlar ----------
const gri = taban.clone().greyscale();
const g = gri.bitmap.data;
const lum = (x, y) => g[(y * w + x) << 2];
const alfa = (x, y) => alphaKopya[y * w + x];

const kenar = new Uint8Array(w * h);
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const gx =
      -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) +
      lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
    const gy =
      -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) +
      lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
    const ga =
      Math.abs(alfa(x + 1, y) - alfa(x - 1, y)) +
      Math.abs(alfa(x, y + 1) - alfa(x, y - 1));
    if (Math.hypot(gx, gy) / 4 + ga * 0.5 > 42) kenar[y * w + x] = 1;
  }
}
// Kalınlaştırma: görüntü boyutuna göre 1-2 tur genişletme
const tur = Math.min(w, h) > 900 ? 2 : 1;
let kalin = kenar;
for (let t = 0; t < tur; t++) {
  const yeni = new Uint8Array(kalin);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (kalin[y * w + x]) {
        yeni[y * w + x - 1] = 1; yeni[y * w + x + 1] = 1;
        yeni[(y - 1) * w + x] = 1; yeni[(y + 1) * w + x] = 1;
      }
    }
  }
  kalin = yeni;
}

// Keskin silüet maskesi: yarı saydam "tüylü" saçak bandını (arka plan silme
// uygulamalarının kalıntısı) 3px erozyonla tamamen at, sonra silüet sınırına
// garantili temiz koyu kontur çiz (Head Ball'daki dış çizgi).
// Yalnızca TAM opak pikseller kafadır; kesit uygulamalarının bıraktığı
// yarı saydam gürültü halkası (alpha 120-240) böylece maskeye hiç giremez.
let maske = new Uint8Array(w * h);
for (let p = 0; p < w * h; p++) maske[p] = alphaKopya[p] >= 250 ? 1 : 0;
for (let e = 0; e < 2; e++) {
  const yeni = new Uint8Array(maske);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (maske[p] && !(maske[p - 1] && maske[p + 1] && maske[p - w] && maske[p + w])) {
        yeni[p] = 0;
      }
    }
  }
  maske = yeni;
}
// Silüet sınırı → kontur (2px içe doğru)
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (maske[p] && !(maske[p - 1] && maske[p + 1] && maske[p - w] && maske[p + w])) {
      kalin[p] = 1;
      if (maske[p - 1]) kalin[p - 1] = 1;
      if (maske[p + 1]) kalin[p + 1] = 1;
      if (maske[p - w]) kalin[p - w] = 1;
      if (maske[p + w]) kalin[p + w] = 1;
    }
  }
}

const t2 = taban.bitmap.data;
for (let p = 0, i = 0; p < w * h; p++, i += 4) {
  if (!maske[p]) {
    // Şeffaf piksellerde RGB artığı bırakma (temiz dosya + doğru önizleme)
    t2[i] = 0; t2[i + 1] = 0; t2[i + 2] = 0; t2[i + 3] = 0;
    continue;
  }
  if (kalin[p]) {
    // koyu kahve kontur (saf siyah yerine — daha "çizim" hissi)
    t2[i] = Math.round(t2[i] * 0.22 + 14);
    t2[i + 1] = Math.round(t2[i + 1] * 0.22 + 8);
    t2[i + 2] = Math.round(t2[i + 2] * 0.22 + 6);
  }
  t2[i + 3] = 255;
}

await taban.writeAsync(cikti);
console.log(`✓ ${cikti} (${w}x${h}, guc=${GUC})`);
