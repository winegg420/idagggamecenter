// ============================================================
// MEYDAN — ZUM GİRDİSİ (parmak arası / tekerlek / çift dokunuş)
//
// Kamerayı sahne yönetiyor (dunya.js); burası yalnız girdiyi okuyup çarpan
// üretir. Ayrı dosya olmasının sebebi: yürüme topuzu (kontrol.js) sahnenin
// ÜSTÜNDEKİ HUD katmanında duruyor, zum ise sahnenin kendi katmanında.
// İkisi aynı dosyada olsaydı topuzu sürüklerken zum da tetiklenirdi.
//
// Not: ikinci parmak sahneye değdiği anda topuz bırakılır — tek elle
// yürürken diğer elle zumlamak kamerayı çıldırtmasın.
// ============================================================

/**
 * @param {HTMLElement} hedef  sahne kapsayıcısı
 * @param {(carpan:number) => void} onZum  1'den büyük = uzaklaş
 */
export function zumKur(hedef, onZum) {
  if (!hedef) return { yokEt() {} };

  const parmaklar = new Map();
  let sonUzaklik = 0;

  const uzaklik = () => {
    const [a, b] = [...parmaklar.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const pdown = (e) => {
    parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (parmaklar.size === 2) sonUzaklik = uzaklik();
  };
  const pmove = (e) => {
    if (!parmaklar.has(e.pointerId)) return;
    parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (parmaklar.size !== 2) return;
    const u = uzaklik();
    if (sonUzaklik > 0 && u > 0) {
      const oran = sonUzaklik / u;   // parmaklar AÇILINCA yakınlaş
      // Tek karelik sıçramaları sınırla (parmak kayması / ölçüm gürültüsü)
      if (oran > 0.5 && oran < 2) onZum(oran);
    }
    sonUzaklik = u;
    e.preventDefault();
  };
  const pup = (e) => {
    parmaklar.delete(e.pointerId);
    if (parmaklar.size < 2) sonUzaklik = 0;
  };

  // Fare tekerleği / trackpad
  const wheel = (e) => {
    if (!e.deltaY) return;
    e.preventDefault();
    // deltaMode 1 = satır, 2 = sayfa
    const birim = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    onZum(Math.exp((e.deltaY * birim) / 900));
  };

  hedef.addEventListener("pointerdown", pdown);
  hedef.addEventListener("pointermove", pmove, { passive: false });
  hedef.addEventListener("pointerup", pup);
  hedef.addEventListener("pointercancel", pup);
  hedef.addEventListener("pointerleave", pup);
  hedef.addEventListener("wheel", wheel, { passive: false });

  return {
    yokEt() {
      hedef.removeEventListener("pointerdown", pdown);
      hedef.removeEventListener("pointermove", pmove);
      hedef.removeEventListener("pointerup", pup);
      hedef.removeEventListener("pointercancel", pup);
      hedef.removeEventListener("pointerleave", pup);
      hedef.removeEventListener("wheel", wheel);
      parmaklar.clear();
    },
  };
}
