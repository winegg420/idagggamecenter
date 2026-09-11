// ============================================================
// QUIZADOR MEYDANI — KONTROL
// Ekran topuzu (dokunmatik/fare) + WASD / yön tuşları.
// Her karede oku() çağrılır; {ix, iz} -1..1 arası girdi vektörü döner.
// ============================================================

/**
 * @param {HTMLElement} pad    topuzun dolaştığı daire
 * @param {HTMLElement} topuz  parmağı takip eden küçük daire
 */
export function kontrolKur(pad, topuz) {
  const tuslar = {};
  let padAktif = false, padX = 0, padZ = 0;

  const keydown = (e) => {
    // Yazı alanındayken oyuncuyu yürütme (HUD'da input yok ama ileride olabilir)
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    tuslar[e.key.toLowerCase()] = true;
    // Yön tuşları sayfayı kaydırmasın
    if (e.key.startsWith("Arrow")) e.preventDefault();
  };
  const keyup = (e) => { tuslar[e.key.toLowerCase()] = false; };
  // Pencere odağı gidince basılı kalan tuş kalmasın (sekme değişimi, alt-tab)
  const sifirla = () => { for (const k in tuslar) tuslar[k] = false; padBirak(); };

  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", sifirla);

  function padHareket(ev) {
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = ev.clientX - cx, dy = ev.clientY - cy;
    let uz = Math.hypot(dx, dy);
    const max = r.width / 2 - 12;
    if (uz > max) { dx = (dx / uz) * max; dy = (dy / uz) * max; uz = max; }
    topuz.style.transform = `translate(${dx}px,${dy}px)`;
    padX = dx / max; padZ = dy / max;
  }
  function padBirak() {
    padAktif = false; padX = 0; padZ = 0;
    topuz.style.transform = "translate(0,0)";
  }
  const pdown = (e) => {
    padAktif = true;
    try { pad.setPointerCapture(e.pointerId); } catch { /* eski tarayıcı */ }
    padHareket(e);
    e.preventDefault();
  };
  const pmove = (e) => { if (padAktif) padHareket(e); };
  pad.addEventListener("pointerdown", pdown);
  pad.addEventListener("pointermove", pmove);
  pad.addEventListener("pointerup", padBirak);
  pad.addEventListener("pointercancel", padBirak);

  return {
    /** Girdi vektörü; büyüklüğü 1'i aşabilir, çağıran sınırlar. */
    oku() {
      let ix = 0, iz = 0;
      if (tuslar["w"] || tuslar["arrowup"]) iz -= 1;
      if (tuslar["s"] || tuslar["arrowdown"]) iz += 1;
      if (tuslar["a"] || tuslar["arrowleft"]) ix -= 1;
      if (tuslar["d"] || tuslar["arrowright"]) ix += 1;
      return { ix: ix + padX, iz: iz + padZ };
    },
    yokEt() {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", sifirla);
      pad.removeEventListener("pointerdown", pdown);
      pad.removeEventListener("pointermove", pmove);
      pad.removeEventListener("pointerup", padBirak);
      pad.removeEventListener("pointercancel", padBirak);
    },
  };
}
