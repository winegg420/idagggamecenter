// ============================================================
// MUAYENE — PORTRE KADRAJI TESTİ (Paket 21 §E.2). Tarayıcı tarafı.
//
// Kart portresi oyundaki kodla çizilir (KarakterSistemi + MeydanAvatarlari + vitrinSahne › KADRAJ / KOZMETIK_KADRAJ),
// sonra ölçülür:
//   • GÖRÜNEN piksel oranı — maske geçişi: kozmetik beyaz, gövde siyah, aynı derinlikle çizilir. Gövdenin ARKASINDA
//     kalan kozmetik sayılmaz (atkı çenenin altında kayboluyordu; yalnız ekran kutusuna bakmak bunu göremezdi).
//   • Kadraj dışına taşma — kozmetiğin ekran-uzayı kutusunun kadraj dışında kalan alan oranı.
// window.portreOlc(liste) → [{ tur, koz, kadraj, alan_orani, tasma_orani, kutu }]
// ============================================================
import * as THREE from "three";
import { KarakterSistemi } from "../karakter/karakter.js";
import { MeydanAvatarlari } from "../karakter/meydanAvatar.js";
import { KADRAJ } from "../../vitrin/vitrinSahne.js";
import { KOZMETIK_KADRAJ } from "../../vitrin/kadraj.js";

const BOY = 192;   // vitrin kartlarının çizim boyutu
const render = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
render.setPixelRatio(1); render.setSize(BOY, BOY);
render.setClearColor(0x000000, 1);
const sahne = new THREE.Scene();
sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0xe8dfcb, 0.75 * Math.PI));
const gunes = new THREE.DirectionalLight(0xfff3dc, 1.2 * Math.PI); gunes.position.set(3, 5, 4); sahne.add(gunes);
const kamera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

const ks = new KarakterSistemi({ sahne });
await ks.yukle();
const avatarlar = new MeydanAvatarlari({ ks });
avatarlar.sinir = 999;
avatarlar.kozOrnekleme = false;   // ölçüm için kozmetik klonları görünür (oyunda paylaşımlı InstancedMesh çizer; geometri ve matris aynı)

const SIYAH = new THREE.MeshBasicMaterial({ color: 0x000000 });
const BEYAZ = new THREE.MeshBasicMaterial({ color: 0xffffff });
const TEMEL = { avatar3d: { kiyafet: "tisort", sac: "kisa", ten: "#f1c9a5", sacRenk: "#3b2a1a", ceketRenk: "#3d6fb6", altRenk: "#2b3a55", ayakkabiRenk: "#222222" } };
/** YALNIZ test edilen kozmetik sayılır: kaplanın kuyruğu da `kozmetik_` adlıdır ve her satırın kutusunu şişiriyordu (ölçüldü). */
const kozmetikMi = (o, koz) =>
  o.name === "kozmetik_" + koz ||
  (koz === "tac" && o.name === "MeydanTac") ||
  (koz === "pelerin" && o.name === "MeydanPelerin");

/** Kozmetiğin ekran-uzayı kutusu (NDC) — InstancedMesh (taç/pelerin) örnek matrisiyle. */
function ekranKutusu(koz, kam) {
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  const ekle = (geo, matris) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matris).project(kam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); n++;
    }
  };
  sahne.traverse((o) => {
    if (!o.isMesh || !kozmetikMi(o, koz) || o.visible === false) return;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); ekle(o.geometry, m.premultiply(o.matrixWorld)); } }
    else ekle(o.geometry, o.matrixWorld);
  });
  return n ? { x0, y0, x1, y1 } : null;
}

/** Maske geçişi: kozmetik beyaz, gövde siyah → görünen kozmetik piksel oranı (örtülme dahil). */
function maskeOrani(koz) {
  const eski = [];
  sahne.traverse((o) => { if (o.isMesh) { eski.push([o, o.material]); o.material = kozmetikMi(o, koz) ? BEYAZ : SIYAH; } });
  render.render(sahne, kamera);
  const gl = render.getContext(), px = new Uint8Array(BOY * BOY * 4);
  gl.readPixels(0, 0, BOY, BOY, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let beyaz = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 200 && px[i + 2] > 200) beyaz++;
  for (const [o, m] of eski) o.material = m;
  return beyaz / (BOY * BOY);
}

window.portreOlc = async function portreOlc(liste) {
  const sonuc = [];
  for (const { tur, koz } of liste) {
    const kadrajAd = KOZMETIK_KADRAJ[koz] ?? "bas";
    const K = KADRAJ[kadrajAd] ?? KADRAJ.tam;
    const gorunum = { ...TEMEL, harita: { tur, koz: { [koz]: koz === "pelerin" ? "klasik" : true } } };
    const p = avatarlar.kur({ ad: null, gorunum, tohum: "muayene" });
    p.rotation.y = K.don;
    sahne.add(p);
    if (p.userData.karakter) ks.klip(p.userData.karakter, "Idle", 0.3);
    ks.kare(0, 0, kamera, { animasyon: false });
    avatarlar.vekilleriUygula();
    kamera.fov = K.fov; kamera.aspect = 1; kamera.position.set(...K.konum); kamera.lookAt(...K.bak); kamera.updateProjectionMatrix();
    kamera.updateMatrixWorld(true);
    // Dünya matrisleri: yeni kurulan avatarın matrisleri ilk çizime kadar birim kalır; kutu bayat matrisle ölçülüyordu (ölçüldü).
    sahne.updateMatrixWorld(true);
    const kutu = ekranKutusu(koz, kamera);
    const alan = maskeOrani(koz);
    render.render(sahne, kamera);
    const resim = render.domElement.toDataURL("image/png");
    // taşma: kutunun kadraj (NDC −1..1) dışında kalan alan oranı
    let tasma = 0;
    if (kutu) {
      const tam = Math.max(1e-6, (kutu.x1 - kutu.x0) * (kutu.y1 - kutu.y0));
      const kx0 = Math.max(-1, kutu.x0), kx1 = Math.min(1, kutu.x1), ky0 = Math.max(-1, kutu.y0), ky1 = Math.min(1, kutu.y1);
      const ic = Math.max(0, kx1 - kx0) * Math.max(0, ky1 - ky0);
      tasma = 1 - ic / tam;
    }
    sonuc.push({ tur, koz, kadraj: kadrajAd, alan_orani: +alan.toFixed(4), tasma_orani: +tasma.toFixed(4), kutu: kutu ? [+kutu.x0.toFixed(2), +kutu.y0.toFixed(2), +kutu.x1.toFixed(2), +kutu.y1.toFixed(2)] : null, resim });
    avatarlar.sil(p);
  }
  return sonuc;
};
window.__muayeneSahne = sahne;
window.__kozmetikMi = kozmetikMi;
window.portreHazir = true;
