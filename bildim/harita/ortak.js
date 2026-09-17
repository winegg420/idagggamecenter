// ============================================================
// MEYDAN — ORTAK ÇİZİM YARDIMCILARI
// dunya.js (sahne) ve avatar.js (gövde) ikisi de bunları kullanır.
// Tek yerde durmalarının sebebi: avatarın iki farklı çizim yolu olmasın.
// ============================================================
import * as THREE from "three";

export function roundRect(x, a, b, w, h, r) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

export function canvasDoku(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; // canvas metni yıkanmasın
  return t;
}

/** 2D-E: lig çerçevesi renkleri (iç halka · dış ton) — AvatarCerceve CSS'iyle aynı. */
export const LIG_CERCEVE_RENK = { gumus: ["#A9B8C6", "#6F8296"], altin: ["#FFC53D", "#C98A22"], elmas: ["#5BD1F5", "#2A8CC4"], efsane: ["#B86BFF", "#F4701F"] };

/** Avatar üstü isim etiketi (canvas sprite). cerceve: lig çerçevesi (gumus…efsane) varsa etiketin kenarı o ligin renkleriyle çizilir. */
export function isimEtiketi(ad, renk, cerceve = null) {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 80;
  const x = c.getContext("2d");
  const lc = LIG_CERCEVE_RENK[cerceve];
  if (lc) { x.fillStyle = lc[1]; roundRect(x, 1, 1, 318, 72, 30); x.fill(); x.fillStyle = lc[0]; roundRect(x, 4, 4, 312, 66, 27); x.fill(); }
  x.fillStyle = "#ffffff"; roundRect(x, 8, 8, 304, 58, 24); x.fill();
  x.fillStyle = "rgba(32,50,74,.16)"; roundRect(x, 8, 62, 304, 8, 4); x.fill();
  x.font = "900 30px Nunito, sans-serif"; x.fillStyle = renk;
  x.textAlign = "center"; x.textBaseline = "middle";
  // Çok uzun adlar etiketten taşmasın
  const metin = String(ad ?? "").length > 16 ? String(ad).slice(0, 15) + "…" : String(ad ?? "");
  x.fillText(metin, 160, 37);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasDoku(c), depthTest: false, depthWrite: false }));
  s.scale.set(3.6, 0.9, 1);
  return s;
}

/** Bir nesnenin altındaki tüm geometry / material / texture'ları serbest bırakır. */
export function nesneyiSerbestBirak(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (!m) return;
    const liste = Array.isArray(m) ? m : [m];
    for (const mm of liste) {
      if (mm.map) mm.map.dispose();
      mm.dispose();
    }
  });
}
