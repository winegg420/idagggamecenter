// ============================================================
// MUAYENE — POZLU TESLİM GÖRSELİ (Paket 23 §I). Tarayıcı tarafı.
//
// Karakter oyunun kendi koduyla kurulur (KarakterSistemi + MeydanAvatarlari), istenen klip/zamanda dondurulur ve
// sabit kameralarla çizilir: ön / yan / yüz 3-4 yakın plan; bağlama pozu ve Idle t=0,5.
// window.pozCiz({ tur, klip, zaman, aci, yakin }) → data URL
// ============================================================
import * as THREE from "three";
import { KarakterSistemi } from "../karakter/karakter.js";
import { MeydanAvatarlari } from "../karakter/meydanAvatar.js";

const G = 520, Y = 720;
const render = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
render.setPixelRatio(1); render.setSize(G, Y);
render.setClearColor(0xdfe9f2, 1);
render.toneMapping = THREE.ACESFilmicToneMapping;
render.toneMappingExposure = 1.05;
document.body.appendChild(render.domElement);

const sahne = new THREE.Scene();
sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0xe8dfcb, 0.8 * Math.PI));
const gunes = new THREE.DirectionalLight(0xfff3dc, 1.25 * Math.PI); gunes.position.set(2.5, 4, 3.5); sahne.add(gunes);
const arka = new THREE.DirectionalLight(0x9fd8ff, 0.45 * Math.PI); arka.position.set(-3, 2.5, -3); sahne.add(arka);
const kamera = new THREE.PerspectiveCamera(30, G / Y, 0.05, 50);

const ks = new KarakterSistemi({ sahne });
await ks.yukle();
const avatarlar = new MeydanAvatarlari({ ks });
avatarlar.sinir = 999;
avatarlar.kozOrnekleme = false;

const TEMEL = { avatar3d: { kiyafet: "tisort", sac: "kisa", ten: "#f1c9a5", sacRenk: "#3b2a1a", ceketRenk: "#3d6fb6", altRenk: "#2b3a55", ayakkabiRenk: "#222222" } };

window.pozCiz = function pozCiz({ tur = "insan", koz = null, klip = "Idle", zaman = 0.5, aci = 0, yakin = false }) {
  const gorunum = { ...TEMEL, harita: { tur, koz: koz ? { [koz]: koz === "pelerin" ? "klasik" : true } : {} } };
  const p = avatarlar.kur({ ad: null, gorunum, tohum: "paket23" });
  p.rotation.y = aci;
  sahne.add(p);
  try {
    const k = p.userData.karakter;
    if (k && klip) ks.klip(k, klip, zaman);
    else if (k) { k.userData.aksiyon?.stop?.(); k.userData.mixer?.stopAllAction?.(); k.userData.mixer?.update?.(0); }
    ks.kare(0, zaman, kamera, { animasyon: false });
    avatarlar.vekilleriUygula();
    if (yakin) { kamera.fov = 26; kamera.position.set(0.80, 1.63, 1.95); kamera.lookAt(0, 1.50, 0); }
    else { kamera.fov = 30; kamera.position.set(0, 1.05, 4.2); kamera.lookAt(0, 0.98, 0); }
    kamera.updateProjectionMatrix();
    sahne.updateMatrixWorld(true);
    render.render(sahne, kamera);
    return render.domElement.toDataURL("image/png");
  } finally {
    avatarlar.sil(p);
  }
};
window.pozHazir = true;
