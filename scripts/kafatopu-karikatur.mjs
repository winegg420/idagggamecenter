// Foto kafaları karikatürize eder (Head Ball tarzı):
// yumuşatma + doygunluk + poster renk katmanları + koyu çizgi konturlar.
// Orijinal alpha (şeffaflık) birebir korunur; silüet boyunca doğal kontur oluşur.
import Jimp from "jimp";

const ESIK = Number(process.argv[4] ?? 46);        // kenar eşiği (düşük = daha çok çizgi)
const POSTER = Number(process.argv[5] ?? 6);       // renk seviye sayısı
const DOYGUNLUK = Number(process.argv[6] ?? 42);   // doygunluk artışı

async function karikaturize(girdi, cikti) {
  const orijinal = await Jimp.read(girdi);
  const { width: w, height: h } = orijinal.bitmap;

  // 1) Taban: yumuşat + canlandır + posterize (düz renk bölgeleri)
  const taban = orijinal.clone().blur(3);
  taban.color([
    { apply: "saturate", params: [DOYGUNLUK] },
    { apply: "brighten", params: [4] },
  ]);
  taban.posterize(POSTER);

  // 2) Kenar haritası: hafif yumuşatılmış griden Sobel büyüklüğü
  const gri = orijinal.clone().blur(1).greyscale();
  const g = gri.bitmap.data;
  const a0 = orijinal.bitmap.data; // orijinal alpha kaynağı
  const lum = (x, y) => g[(y * w + x) << 2];
  const alfa = (x, y) => a0[((y * w + x) << 2) + 3];

  const kenar = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) +
        lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
      const gy =
        -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) +
        lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
      // alpha sınırı da kontur sayılır (silüet çizgisi)
      const ga =
        Math.abs(alfa(x + 1, y) - alfa(x - 1, y)) +
        Math.abs(alfa(x, y + 1) - alfa(x, y - 1));
      const mag = Math.hypot(gx, gy) / 4 + ga * 0.4;
      if (mag > ESIK) kenar[y * w + x] = 1;
    }
  }
  // 1 px kalınlaştırma (çizgiler belirgin olsun)
  const kalin = new Uint8Array(kenar);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (kenar[y * w + x]) {
        kalin[y * w + x - 1] = 1;
        kalin[y * w + x + 1] = 1;
        kalin[(y - 1) * w + x] = 1;
        kalin[(y + 1) * w + x] = 1;
      }
    }
  }

  // 3) Konturları tabana koyu bas + orijinal alpha'yı geri koy
  const t = taban.bitmap.data;
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const orjA = a0[i + 3];
    if (orjA === 0) {
      t[i + 3] = 0; // tamamen şeffaf kalsın
      continue;
    }
    if (kalin[p]) {
      t[i] = Math.round(t[i] * 0.28);
      t[i + 1] = Math.round(t[i + 1] * 0.28);
      t[i + 2] = Math.round(t[i + 2] * 0.28);
    }
    t[i + 3] = orjA;
  }

  await taban.writeAsync(cikti);
  console.log(`✓ ${cikti} (${w}x${h}, esik=${ESIK}, poster=${POSTER})`);
}

await karikaturize(process.argv[2], process.argv[3]);
