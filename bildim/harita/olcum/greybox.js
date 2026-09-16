// ============================================================
// AŞAMA 2A — GREYBOX ÖLÇÜM SAYFASI (yalnız yerel ölçüm; oyuna bağlı değil, derlemeye girmez)
//
// Oyunun gerçek dünyası (dunyaKur + yerlesim.json), gerçek meydan avatarı, gerçek çarpışma (carpismaDuzelt),
// gerçek kamera (dunya.guncelle) ve gerçek yürüme hızı (HaritaSayfasi YURUME_HIZI = 9) ile:
//   __gb.yuru([[x,z], …])   → noktadan noktaya yürüyüş SİMÜLASYONU (sabit dt 1/60, oyun döngüsüyle aynı adım + çarpışma) → saniye
//   __gb.kalabalik(n)       → n avatarı meydana dağıt (25 oyuncu ölçeği)
//   __gb.kareOlc({isinma, ornek}) → cizim + gl.finish medyan/p95 (README sabitleri) + çağrı/üçgen
//   __gb.kamera(ad | {konum, hedef} | null) · __gb.etiket(ac) · __gb.oyuncu(x, z, aci)
// ============================================================
import * as THREE from "three";
import { dunyaKur } from "../dunya.js";
import yerlesim from "../yerlesim.json";

const YURUME_HIZI = 9;   // HaritaSayfasi.jsx ile aynı (koddan okundu: const YURUME_HIZI = 9)
const OYUNCU_R = 0.8;    // HaritaSayfasi: dunya.carpismaDuzelt(ben.position, 0.8)
const hud = document.getElementById("hud");
const kap = document.getElementById("kap");
const dunya = dunyaKur(kap, { yerlesim });
dunya.render.setPixelRatio(1);
const ben = dunya.avatarOlustur("Ida", 0xf4701f, 0x3a2a1a, "#F4701F", null, {});
const d0 = dunya.yerlesim.dogus;
ben.position.set(d0.x, 0, d0.z); ben.rotation.y = d0.aci;
const kalabalikListe = [];
let zaman = 0, son = performance.now();

function cizim(dt = 1 / 60) {
  zaman += dt;
  dunya.yurumeAnimasyonu(ben, dt, 0, 0, 0);
  for (const av of kalabalikListe) dunya.yurumeAnimasyonu(av, dt, 0, 0, 0);
  dunya.guncelle(dt, zaman, ben);
}
const otomasyon = new URLSearchParams(location.search).has("otomasyon");
let calisiyor = true;
if (otomasyon) { const w = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),16)"]))); w.onmessage = () => { if (calisiyor) { const t = performance.now(); cizim(Math.min(0.1, (t - son) / 1000)); son = t; } }; }
else { const dongu = () => { const t = performance.now(); cizim(Math.min(0.1, (t - son) / 1000)); son = t; requestAnimationFrame(dongu); }; requestAnimationFrame(dongu); }
addEventListener("resize", () => dunya.boyutlandir());
setInterval(() => { const i = dunya.render.info.render; hud.textContent = `${i.calls} çağrı · ${i.triangles.toLocaleString("tr-TR")} üçgen · oyuncu (${ben.position.x.toFixed(1)}, ${ben.position.z.toFixed(1)}) · ${kalabalikListe.length + 1} karakter`; }, 500);

const KAMERALAR = {
  kus: { konum: [-20, 330, 30], hedef: [-20, 0, 29] },
};

window.__gb = {
  dunya, ben, yerlesim, YURUME_HIZI,
  durdur: (ac) => { calisiyor = !ac; },
  oyuncu: (x, z, aci = null) => { ben.position.set(x, 0, z); if (aci != null) ben.rotation.y = aci; },
  kamera: (k) => dunya.kameraSabitle(typeof k === "string" ? KAMERALAR[k] : k),
  etiket: (ac) => dunya.yerlesim.etiketGoster(ac),
  /** Oyun döngüsüyle aynı hareket: yön · YURUME_HIZI · dt, sonra carpismaDuzelt(0,8). Takılırsa (hiç ilerleyemezse) raporlar. */
  yuru(noktalar, { dt = 1 / 60, maksSn = 120 } = {}) {
    let t = 0, yol = 0; const iz = [];
    ben.position.set(noktalar[0][0], 0, noktalar[0][1]); dunya.carpismaDuzelt(ben.position, OYUNCU_R);
    for (let i = 1; i < noktalar.length; i++) {
      const [hx, hz] = noktalar[i]; let takili = 0;
      while (Math.hypot(hx - ben.position.x, hz - ben.position.z) > 0.5 && t < maksSn) {
        const yon = Math.atan2(hx - ben.position.x, hz - ben.position.z), ox = ben.position.x, oz = ben.position.z;
        ben.position.x += Math.sin(yon) * YURUME_HIZI * dt; ben.position.z += Math.cos(yon) * YURUME_HIZI * dt;
        dunya.carpismaDuzelt(ben.position, OYUNCU_R);
        const adim = Math.hypot(ben.position.x - ox, ben.position.z - oz); yol += adim; t += dt;
        takili = adim < YURUME_HIZI * dt * 0.1 ? takili + 1 : 0;
        if (takili > 30) return { sn: +t.toFixed(2), yol: +yol.toFixed(1), takildi: [+ben.position.x.toFixed(1), +ben.position.z.toFixed(1)], hedef: [hx, hz] };
      }
      iz.push([+ben.position.x.toFixed(1), +ben.position.z.toFixed(1), +t.toFixed(2)]);
    }
    return { sn: +t.toFixed(2), yol: +yol.toFixed(1), iz };
  },
  /** n avatarı meydanda (r 8–25) deterministik dağıt; anıt tabanına ve birbirine girmez. */
  kalabalik(n) {
    for (const av of kalabalikListe) dunya.avatarSil(av);
    kalabalikListe.length = 0;
    let tohum = 11; const rnd = () => ((tohum = (tohum * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const av = dunya.avatarOlustur(`Oyuncu ${i + 1}`, 0x4a9dd9, 0x222222, "#20324A", null, {});
      for (let deneme = 0; deneme < 40; deneme++) {
        const a = rnd() * Math.PI * 2, r = 8 + Math.sqrt(rnd()) * 17, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (kalabalikListe.every((o) => Math.hypot(o.position.x - x, o.position.z - z) > 2.2) && Math.hypot(ben.position.x - x, ben.position.z - z) > 2.2) { av.position.set(x, 0, z); break; }
      }
      dunya.carpismaDuzelt(av.position, OYUNCU_R); av.rotation.y = rnd() * Math.PI * 2;
      kalabalikListe.push(av);
    }
    return kalabalikListe.length + 1;
  },
  async kareOlc({ isinma = 120, ornek = 300 } = {}) {
    calisiyor = false;
    const gl = dunya.render.getContext();
    for (let i = 0; i < isinma; i++) { cizim(); gl.finish(); }
    const s = [];
    for (let i = 0; i < ornek; i++) { const t0 = performance.now(); cizim(); gl.finish(); s.push(performance.now() - t0); }
    const info = dunya.render.info.render, sirali = s.sort((a, b) => a - b), q = (p) => +sirali[Math.min(sirali.length - 1, Math.floor(p * (sirali.length - 1) + 0.5))].toFixed(2);
    calisiyor = true;
    return { cpuGpuMedyan: q(0.5), cpuGpuP95: q(0.95), cagri: info.calls, ucgen: info.triangles, kanvas: [dunya.render.domElement.width, dunya.render.domElement.height], karakter: kalabalikListe.length + 1 };
  },
  /** Ortografik kuş bakışı plan (perspektif bozulmasız): döngü durur, tek kare çizilir. Etiket ölçeği okunurluk için büyütülür. */
  plan({ merkez = [-20, 30], genislik = 260, etiketOlcek = 2 } = {}) {
    calisiyor = false;
    const c = dunya.render.domElement, en = genislik, boy = (genislik * c.height) / c.width;
    const kam = new THREE.OrthographicCamera(-en / 2, en / 2, boy / 2, -boy / 2, 1, 2000);
    kam.position.set(merkez[0], 600, merkez[1]); kam.up.set(0, 0, -1); kam.lookAt(merkez[0], 0, merkez[1]);
    const et = dunya.sahne.getObjectByName("Etiketler");
    for (const sp of et.children) { sp.userData.o ??= sp.scale.clone(); sp.scale.copy(sp.userData.o).multiplyScalar(etiketOlcek); }
    const sis = dunya.sahne.fog; dunya.sahne.fog = null;
    dunya.render.render(dunya.sahne, kam);
    dunya.sahne.fog = sis;
    for (const sp of et.children) sp.scale.copy(sp.userData.o);
    return { en, boy: +boy.toFixed(1) };
  },
  devam: () => { calisiyor = true; },
  kamPoz: () => ({ konum: dunya.kamera.position.toArray().map((v) => +v.toFixed(2)), bakis: dunya.kamera.getWorldDirection(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)) }),
  /** Kamera ile oyuncu (göğüs) arasında parsel var mı? Işın kutulara çarpıyorsa kamera oyuncuyu göremiyor demektir. */
  kameraEngeli() {
    const bas = dunya.kamera.position.clone(), hedef = ben.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const yon = hedef.clone().sub(bas), uz = yon.length(); yon.normalize();
    const isin = new THREE.Raycaster(bas, yon, 0, uz - 0.8);
    isin.camera = dunya.kamera;   // etiket sprite'ları ışın testinde kamera ister
    const kok = dunya.sahne.getObjectByName("Yerlesim");
    const vur = isin.intersectObjects(kok.children.filter((o) => o.name !== "Etiketler"), true).filter((h) => h.object.isMesh && !h.object.geometry.type.startsWith("Circle") && !h.object.geometry.type.startsWith("Plane") && !h.object.geometry.type.startsWith("Shape"));
    let icinde = null;
    for (const g of kok.children) { const p = g.userData?.parsel; if (!p) continue; const k = new THREE.Box3().setFromObject(g); if (k.containsPoint(bas)) icinde = p.id; }
    return { engel: vur.length ? (vur[0].object.parent?.name || vur[0].object.geometry.type) : null, mesafe: vur.length ? +vur[0].distance.toFixed(1) : null, kameraBinaIcinde: icinde, kameraY: +bas.y.toFixed(1) };
  },
};
hud.textContent = "hazır";
