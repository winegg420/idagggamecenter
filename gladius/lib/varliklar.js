// ============================================================
// Görsel varlık (sprite) yükleyici. gladius/assets/img/ içindeki PNG/WebP
// dosyalarını bulur, yükler ve ada göre sunar. Varlık yoksa çizim kod-tabanlı
// yedeğe düşer (oyun her durumda çalışır). Dosya adları SANAT_VARLIKLARI.md
// manifestiyle bire bir olmalı (örn. "gladyator_maximus.png" → ad "gladyator_maximus").
// ============================================================

// Vite: derleme/dev sırasında klasördeki tüm görselleri bulur (yoksa boş harita).
const moduller = import.meta.glob("../assets/img/*.{png,webp,jpg}", {
  eager: true,
  import: "default",
});

const URL_HARITA = {}; // ad -> url
for (const yol in moduller) {
  const ad = yol.split("/").pop().replace(/\.(png|webp|jpg)$/i, "");
  URL_HARITA[ad] = moduller[yol];
}

const IMG = {};           // ad -> yüklenmiş HTMLImageElement
let yuklemeSozu = null;

// Tüm varlıkları önceden yükler (bir kez). Görsel yoksa hemen çözülür.
export function varliklariYukle() {
  if (yuklemeSozu) return yuklemeSozu;
  const adlar = Object.keys(URL_HARITA);
  yuklemeSozu = Promise.all(
    adlar.map(
      (ad) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => { IMG[ad] = im; res(); };
          im.onerror = () => res(); // yüklenemezse yedek çizim devreye girer
          im.src = URL_HARITA[ad];
        })
    )
  );
  return yuklemeSozu;
}

export function varlikVar(ad) {
  return !!IMG[ad];
}

// Bir sprite'ı merkez (sx,sy) etrafında, aci yönüne döndürerek çizer.
// Sprite'lar YUKARI (kuzey) bakacak şekilde çizilir; aci=0 (doğu) için +90° döndürülür.
// Döndürdüğü değer: çizildi mi (false ise çağıran kod-yedeğini kullanmalı).
export function cizSprite(ctx, ad, sx, sy, boyut, aci = 0) {
  const im = IMG[ad];
  if (!im) return false;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(aci + Math.PI / 2);
  ctx.drawImage(im, -boyut / 2, -boyut / 2, boyut, boyut);
  ctx.restore();
  return true;
}

// Döndürmesiz sprite (arena zemini, item ikonu gibi sabit yönlü görseller).
export function cizSpriteDuz(ctx, ad, sx, sy, gen, yuk) {
  const im = IMG[ad];
  if (!im) return false;
  ctx.drawImage(im, sx - gen / 2, sy - yuk / 2, gen, yuk);
  return true;
}
