// ============================================================
// GÖRÜNÜM ÖNİZLEMESİ — tek avatarlık küçük sahne
//
// Meydanın tamamını kurmaz; yalnız avatarı, bir zemin diskini ve iki ışığı
// çizer. Avatarın KENDİSİ avatar.js'ten gelir — Görünüm sayfası ile meydan
// aynı gövdeyi kullanır (ikinci çizim yolu yok).
//
// Ayrıca liste ekranları için TEK KARELİK FOTOĞRAF üretir: lig ve arkadaş
// listeleri 3B sahne açmasın diye avatarın PNG'si alınıp profile yazılır.
// ============================================================
import * as THREE from "three";
import { avatarKur, avatarGorunumDegistir, avatarEfektleriGuncelle, avatarYokEt } from "./avatar.js";
import { esyaOnbelleginiTemizle } from "./esyalar.js";
import { dansBaslat, dansKaresi, dansiDurdur } from "./danslar.js";

export function onizlemeKur(kapsayici, { gorunum, bilgi }) {
  const W = () => kapsayici.clientWidth || 260;
  const H = () => kapsayici.clientHeight || 320;

  const sahne = new THREE.Scene();
  sahne.background = null;   // saydam: sayfanın kendi zemini görünsün

  const kamera = new THREE.PerspectiveCamera(34, W() / H(), 0.5, 60);
  kamera.position.set(0, 2.6, 8.4);
  kamera.lookAt(0, 2.1, 0);

  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.setSize(W(), H());
  kapsayici.appendChild(render.domElement);

  // Işıklar meydandakiyle aynı oranlarda (three 0.185 fiziksel birim → ×π)
  sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0x9fb6c8, 0.95 * Math.PI));
  const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
  gunes.position.set(4, 8, 6);
  sahne.add(gunes);

  // Zemin diski — avatar boşlukta durmasın
  const zemin = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 40),
    new THREE.MeshLambertMaterial({ color: 0xdfeef9 })
  );
  zemin.rotation.x = -Math.PI / 2;
  sahne.add(zemin);

  let avatar = avatarKur({ ad: null, gorunum, bilgi });
  sahne.add(avatar);

  let raf = 0, aktif = true, sonT = performance.now(), donsun = true;
  const kare = (t) => {
    if (!aktif) return;
    raf = requestAnimationFrame(kare);
    const dt = Math.min((t - sonT) / 1000, 0.05);
    sonT = t;
    if (donsun) avatar.rotation.y += dt * 0.55;
    // Dükkânda dansa dokununca avatar burada oynar (meydandakiyle aynı kod).
    if (avatar.userData?.dans) dansKaresi(avatar, dt);
    avatarEfektleriGuncelle(avatar, dt);
    render.render(sahne, kamera);
  };
  raf = requestAnimationFrame(kare);

  const boyutlandir = () => {
    kamera.aspect = W() / H();
    kamera.updateProjectionMatrix();
    render.setSize(W(), H());
  };
  window.addEventListener("resize", boyutlandir);

  return {
    /** Kıyafet değişti: sahneyi yıkmadan sadece eşyaları yenile. */
    guncelle(yeniGorunum) {
      try {
        avatarGorunumDegistir(avatar, yeniGorunum, bilgi);
      } catch (e) {
        console.error("[Görünüm] önizleme güncellenemedi:", e);
      }
    },
    /** Ten rengi gövdeyi de etkilediği için avatar yeniden kurulur. */
    yenidenKur(yeniGorunum) {
      try {
        sahne.remove(avatar);
        avatarYokEt(avatar);
        avatar = avatarKur({ ad: null, gorunum: yeniGorunum, bilgi });
        sahne.add(avatar);
      } catch (e) {
        console.error("[Görünüm] avatar kurulamadı:", e);
      }
    },
    /** Dansı önizlemede oynatır (satın almadan önce de görülebilir). */
    dansOynat(kod) {
      try { dansBaslat(avatar, kod); }
      catch (e) { console.error("[Görünüm] dans oynatilamadi:", e); }
    },
    dansDurdur() {
      try { dansiDurdur(avatar); } catch { /* yut */ }
    },
    dondur(a) { donsun = a; },
    elleDondur(dx) { avatar.rotation.y += dx; },

    /**
     * Liste ekranları için tek karelik fotoğraf.
     * Avatar öne bakar, kare çerçeve, saydam arka plan.
     */
    async fotograf(boyut = 256) {
      // Fotoğraf dans ortasında çekilmesin: gövde duruşa döner.
      try { dansiDurdur(avatar); } catch { /* yut */ }
      const eskiAci = avatar.rotation.y;
      const eskiEn = W(), eskiBoy = H();
      try {
        avatar.rotation.y = 0;
        render.setSize(boyut, boyut, false);
        const k = new THREE.PerspectiveCamera(26, 1, 0.5, 60);
        k.position.set(0, 3.15, 5.2);
        k.lookAt(0, 2.95, 0);        // yüz ortada: liste avatarı yüz gösterir
        zemin.visible = false;
        render.render(sahne, k);
        const veri = render.domElement.toDataURL("image/png");
        return veri;
      } finally {
        zemin.visible = true;
        avatar.rotation.y = eskiAci;
        render.setSize(eskiEn, eskiBoy, false);
        boyutlandir();
      }
    },

    yokEt() {
      aktif = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", boyutlandir);
      try { avatarYokEt(avatar); } catch { /* yut */ }
      try {
        zemin.geometry.dispose();
        zemin.material.dispose();
        esyaOnbelleginiTemizle();
        render.dispose();
        render.forceContextLoss?.();
        if (render.domElement.parentNode) render.domElement.parentNode.removeChild(render.domElement);
      } catch (e) {
        console.error("[Görünüm] önizleme kapatılamadı:", e);
      }
    },
  };
}
