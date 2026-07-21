// ============================================================
// MEYVE KES — meyve tanımları ve sprite üretimi
// Gerçek fotoğraf kesme (rembg) yöntemi tercih edilir:
//   /public/meyve/manifest.json içinde { id, dosya } varsa o PNG kullanılır.
// Fotoğraf yoksa yüksek çözünürlüklü emoji sprite'ı offscreen tuvale
// bir kez rasterlenip önbelleğe alınır (kare başına fillText'ten kaçınılır).
// ============================================================

// Meyve türleri: emoji + splat/parçacık rengi + göreli yarıçap.
export const MEYVELER = [
  { id: "karpuz", emoji: "🍉", renk: "#ff4d6d", r: 60 },
  { id: "elma", emoji: "🍎", renk: "#e63946", r: 48 },
  { id: "portakal", emoji: "🍊", renk: "#ff9f1c", r: 48 },
  { id: "limon", emoji: "🍋", renk: "#ffd60a", r: 46 },
  { id: "cilek", emoji: "🍓", renk: "#ef476f", r: 42 },
  { id: "muz", emoji: "🍌", renk: "#ffd166", r: 52 },
  { id: "kivi", emoji: "🥝", renk: "#8ac926", r: 46 },
  { id: "seftali", emoji: "🍑", renk: "#ff8fab", r: 48 },
  { id: "ananas", emoji: "🍍", renk: "#fcbf49", r: 58 },
  { id: "uzum", emoji: "🍇", renk: "#9d4edd", r: 46 },
];

// Nadir "altın meyve" (bonus): kesince ekstra puan.
export const ALTIN_MEYVE = { id: "altin", emoji: "⭐", renk: "#ffd21f", r: 50, altin: true };

const spriteOnbellek = new Map(); // id -> HTMLCanvasElement | HTMLImageElement
let manifestYuklendi = false;

// Emoji'yi kare offscreen tuvale bir kez çizip önbelleğe alır.
function emojiSprite(emoji, boyut) {
  const anahtar = `emoji:${emoji}:${boyut}`;
  const onbellek = spriteOnbellek.get(anahtar);
  if (onbellek) return onbellek;
  try {
    const t = document.createElement("canvas");
    t.width = boyut;
    t.height = boyut;
    const c = t.getContext("2d");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `${Math.round(boyut * 0.82)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.fillText(emoji, boyut / 2, boyut / 2 + boyut * 0.04);
    spriteOnbellek.set(anahtar, t);
    return t;
  } catch {
    return null;
  }
}

// Gerçek fotoğraf manifesti varsa yükle (bir kez). Sessizce başarısız olur.
export async function manifestYukle() {
  if (manifestYuklendi) return;
  manifestYuklendi = true;
  try {
    const r = await fetch("/meyve/manifest.json", { cache: "no-cache" });
    if (!r.ok) return;
    const liste = await r.json();
    if (!Array.isArray(liste)) return;
    await Promise.all(
      liste.map(
        (m) =>
          new Promise((coz) => {
            if (!m?.id || !m?.dosya) return coz();
            const img = new Image();
            img.onload = () => {
              spriteOnbellek.set(`foto:${m.id}`, img);
              coz();
            };
            img.onerror = () => coz();
            img.src = `/meyve/${m.dosya}`;
          })
      )
    );
  } catch {
    /* manifest yok — emoji yedeği kullanılır */
  }
}

// Bir meyve için çizilecek sprite'ı döndürür (foto varsa foto, yoksa emoji).
// boyut: çizim çapının biraz üstünde bir raster boyutu (netlik için).
export function meyveSprite(meyve, boyut) {
  const foto = spriteOnbellek.get(`foto:${meyve.id}`);
  if (foto) return foto;
  return emojiSprite(meyve.emoji, boyut);
}

// Rastgele bir meyve seç (küçük olasılıkla altın).
export function rastgeleMeyve() {
  if (Math.random() < 0.06) return ALTIN_MEYVE;
  return MEYVELER[(Math.random() * MEYVELER.length) | 0];
}
