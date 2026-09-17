// ============================================================
// KARAKTER VİTRİNİ SAHNESİ — Paket 17 §D
//
// Meydanın KENDİ karakter kodu: KarakterSistemi (GLB · kozmetik · VFX) + MeydanAvatarlari (profiles.gorunum →
// tür/kıyafet/kozmetik, taç + pelerin). Vitrin ayrı bir çizim yolu açmaz → gardıropta ne görünüyorsa meydanda o.
//
// TEK RENDERER (harita/portre.js deseni): canlı önizleme + bütün kart portreleri AYNI WebGL bağlamıyla çizilir.
// Portre: renderer kartın boyutuna küçültülür, portre kadrajı çizilir, aynı görevde 2B tuvale kopyalanır
// (data URL), renderer eski boyutuna döner ve canlı kare yeniden çizilir — tarayıcı arada kare göstermez.
// ============================================================
import * as THREE from "three";
import "../lib/threeKonsol.js";   // Paket 20 VI: yalnız ANGLE/D3D X4122 shader uyarısını süzer
export { KOZMETIK_KADRAJ } from "./kadraj.js";
import { KarakterSistemi } from "../harita/karakter/karakter.js";
import { MeydanAvatarlari } from "../harita/karakter/meydanAvatar.js";

/** Kadrajlar (karakter +Z'ye bakar; baş yuvası 1,68 m, sırt yuvası 0,94 m). */
export const KADRAJ = {
  bas:  { fov: 26, konum: [0.35, 1.72, 1.55], bak: [0, 1.58, 0], don: 0.35 },
  tam:  { fov: 28, konum: [0, 1.05, 4.3], bak: [0, 0.92, 0], don: 0.45 },
  sirt: { fov: 28, konum: [0, 1.2, 3.6], bak: [0, 1.0, 0], don: Math.PI - 0.55 },
  // Paket 21 §E.2: boyun–omuz hizası. Atkı "bas" kadrajında kadrajın alt kenarında kalıyordu (ölçüldü).
  govde: { fov: 26, konum: [0.3, 1.35, 2.0], bak: [0, 1.13, 0], don: 0.35 },
  // Paket 21 §E.2/§F: kanat "sirt" kadrajında kartın %3,5-4,0'ını kaplıyordu (eşik %4) — daha yakın kadraj.
  kanat: { fov: 28, konum: [0, 1.32, 2.95], bak: [0, 1.30, 0], don: Math.PI - 0.55 },
};

/**
 * @param {HTMLElement|null} kapsayici  canlı önizleme tuvalinin konacağı kutu
 * @param {{ tohum?: string, canli?: boolean }} o  canli:false → yalnız portre makinesi (Dükkân › Görünüm; Paket 19 §D):
 *   tuval sayfaya eklenmez, döngü dönmez; yine TEK WebGL bağlamı.
 */
export async function vitrinSahnesiKur(kapsayici, { tohum = "", canli = true } = {}) {
  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.08;
  render.setClearColor(0x000000, 0);
  render.domElement.className = "bd-vitrin-tuval";
  if (canli) kapsayici.appendChild(render.domElement);

  const sahne = new THREE.Scene();
  const gok = new THREE.HemisphereLight(0xeaf7ff, 0xe8dfcb, 0.75 * Math.PI); sahne.add(gok);
  const gunes = new THREE.DirectionalLight(0xfff3dc, 1.2 * Math.PI); gunes.position.set(3, 5, 4); sahne.add(gunes);
  const arka = new THREE.DirectionalLight(0x9fd8ff, 0.6 * Math.PI); arka.position.set(-3, 3, -3); sahne.add(arka);
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  kamera.position.set(0, 1.0, 4.0); kamera.lookAt(0, 0.95, 0);

  const ks = new KarakterSistemi({ sahne });
  await ks.yukle();
  const avatarlar = new MeydanAvatarlari({ ks });
  avatarlar.sinir = 999;   // vitrinde her karakter TAM (kozmetikli)

  let ana = null, aci = 0.4, son = performance.now(), zaman = 0, rafNo = 0, bitti = false;
  const boyutla = () => {
    const w = (canli && kapsayici?.clientWidth) || 300, h = (canli && kapsayici?.clientHeight) || 360;
    render.setSize(w, h, false);
    kamera.aspect = w / h; kamera.updateProjectionMatrix();
  };
  boyutla();
  const gozlemci = new ResizeObserver(boyutla); if (canli) gozlemci.observe(kapsayici);

  const ciz = () => { render.setRenderTarget(null); render.render(sahne, kamera); };
  const dongu = () => {
    if (bitti) return;
    rafNo = requestAnimationFrame(dongu);
    if (document.hidden) return;
    const t = performance.now(), dt = Math.min(0.05, (t - son) / 1000); son = t; zaman += dt;
    try {
      ks.kare(dt, zaman, kamera);
      if (ana) { aci += dt * 0.35; ana.rotation.y = aci; }
      avatarlar.vekilleriUygula();
      ciz();
    } catch (e) { console.error("[Vitrin] kare:", e); }
  };
  if (canli) dongu();

  /**
   * Canlı önizlemedeki karakteri bu görünümle yeniden kur.
   * Paket 19 §C: klip HER kuruluşta açıkça bağlanır ve poz AYNI ANDA uygulanır (mixer.update(0)). Önceden karakter
   * kurulduktan sonraki ilk çizim (ör. portre döngüsünün ciz() çağrısı) karıştırıcı hiç ilerlememişken yapılabiliyor,
   * gövde bağlanma pozunda (T) görünüyordu. `selam`: tür/kozmetik değişince bir kez Selam, bitince Idle'a yumuşak geçiş.
   */
  function goster(gorunum, { selam = false } = {}) {
    if (ana) avatarlar.sil(ana);
    ana = avatarlar.kur({ ad: null, gorunum, tohum });
    ana.rotation.y = aci;
    sahne.add(ana);
    const k = ana.userData.karakter; if (!k) return;
    const mixer = k.userData.mixer;
    const selamKlip = selam && k.userData.klipler?.find((c) => c.name === "Selam");
    if (selamKlip) {
      ks.klip(k, "Selam", 0);
      const a = k.userData.aksiyon; a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      const bitti = (e) => { if (e.action !== a) return; mixer.removeEventListener("finished", bitti); if (ana?.userData.karakter === k) ks.klip(k, "Idle", null, { gecis: 0.35 }); };
      mixer.addEventListener("finished", bitti);
    } else {
      ks.klip(k, "Idle", 0);   // zaman verilince klip mixer.update(0) ile pozu hemen uygular
    }
  }

  /** Aynı renderer'la tek karelik portre (data URL). */
  const tuval2 = document.createElement("canvas"), c2 = tuval2.getContext("2d");
  const pKamera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  function portre(gorunum, { kadraj = "tam", boyut = 160 } = {}) {
    const K = KADRAJ[kadraj] ?? KADRAJ.tam;
    const eskiW = render.domElement.width / render.getPixelRatio(), eskiH = render.domElement.height / render.getPixelRatio();
    const oran = render.getPixelRatio();
    let p = null;
    try {
      if (ana) ana.visible = false;
      p = avatarlar.kur({ ad: null, gorunum, tohum });
      p.rotation.y = K.don;
      sahne.add(p);
      if (p.userData.karakter) ks.klip(p.userData.karakter, "Idle", 0.3);   // sabit poz: her kart aynı duruşta
      ks.kare(0, zaman, pKamera, { animasyon: false });
      avatarlar.vekilleriUygula();
      pKamera.fov = K.fov; pKamera.aspect = 1; pKamera.position.set(...K.konum); pKamera.lookAt(...K.bak); pKamera.updateProjectionMatrix();
      render.setPixelRatio(1);
      render.setSize(boyut, boyut, false);
      render.render(sahne, pKamera);
      tuval2.width = boyut; tuval2.height = boyut;
      c2.clearRect(0, 0, boyut, boyut);
      c2.drawImage(render.domElement, 0, 0, boyut, boyut);
      return tuval2.toDataURL("image/png");
    } catch (e) {
      console.error("[Vitrin] portre:", e);
      return null;
    } finally {
      if (p) avatarlar.sil(p);
      if (ana) ana.visible = true;
      render.setPixelRatio(oran);
      render.setSize(eskiW, eskiH, false);
      avatarlar.vekilleriUygula();
      if (canli) ciz();
    }
  }

  function yokEt() {
    bitti = true;
    cancelAnimationFrame(rafNo);
    gozlemci.disconnect();
    try { avatarlar.temizle(); } catch (e) { console.error("[Vitrin] temizle:", e); }
    render.dispose();
    render.forceContextLoss?.();
    render.domElement.remove();
  }

  return { goster, portre, yokEt };
}
