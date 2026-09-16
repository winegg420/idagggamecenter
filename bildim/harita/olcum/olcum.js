// ============================================================
// KARE SÜRESİ ÖLÇÜM BETİĞİ — sayfanın konsoluna yapıştırılır (ya da tarayıcı otomasyonuyla çalıştırılır).
// Aşama 2 S0'da (16 Eyl 2026) kullanılan betiğin aynısı; eski commit'lerde de çalışsın diye yalnız
// her sürümde bulunan `window.__deneme.kareSuresi` API'sine dayanır (yeni `kareOlc`'a değil).
//
// Sabitler (ZORUNLU — değiştirilirse sonuçlar karşılaştırılamaz):
//   DPR 1 · canvas CSS boyutu iki sürümde aynı · 25 karakter (kopya 24) · Geniş kamera · ışık B+ · gölge açık ·
//   120 kare ısınma · 300 kare örnek · medyan + p95 · 3 koşu, sürümler dönüşümlü, koşular arası sayfa yeniden yükleme.
//
// Döndürdüğü metrikler (birbirinin yerine KULLANILMAZ):
//   cpuGpuKare   — cizim() + gl.finish(), kare başına (0,1 ms saat çözünürlüğü)  ← SERT KAPI BU METRİĞE BAKAR
//   cpuGpuBlok10 — aynı, 10 karelik blok ortalaması (0,01 ms çözünürlük; çözünürlük basamağını kontrol için)
//   gpuTimer     — EXT_disjoint_timer_query_webgl2 (destek yoksa null)
//   hudCpuGonderim — HUD'daki "CPU" sayısı: yalnız render.render gönderim süresi, kare süresi DEĞİL
// ============================================================
window.olcumKos = async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 80 && !window.__deneme?.esas?.(); i++) await sleep(500);
  const d = window.__deneme;
  if (!d?.esas?.()) return "yuklenmedi";
  await sleep(2000);
  const r = d.render, c = r.domElement, w = c.clientWidth, h = c.clientHeight;
  r.setPixelRatio(1); r.setSize(w, h, false); d.kam.aspect = w / h; d.kam.updateProjectionMatrix();
  d.kopya(24); d.kamera("genis");
  await sleep(1500);
  const hud = [];
  for (let i = 0; i < 6; i++) { await sleep(600); const m = document.querySelector(".hd-olc")?.innerText.match(/CPU ([\d.,]+) ms|([\d.]+) ms/); if (m) hud.push(+(m[1] ?? m[2]).replace(",", ".")); }
  const info = d.olc();
  const ist = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; return { medyan: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), n: s.length }; };
  d.kareSuresi(120);
  const kare = []; for (let i = 0; i < 300; i++) kare.push(d.kareSuresi(1));
  const blok = []; for (let i = 0; i < 30; i++) blok.push(d.kareSuresi(10));
  const gl = r.getContext(), ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let gpu = null;
  if (ext) {
    const sorgular = [];
    for (let i = 0; i < 300; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); d.kareSuresi(1); gl.endQuery(ext.TIME_ELAPSED_EXT); sorgular.push(q); }
    await sleep(300);
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    const ms = [];
    for (const q of sorgular) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
    gpu = { ...ist(ms), disjoint };
  }
  return { port: location.port, canvas: [c.width, c.height], cagri: info.cagri, ucgen: info.ucgen, cpuGpuKare: ist(kare), cpuGpuBlok10: ist(blok), gpuTimer: gpu, hudCpuGonderim: hud, gorunurluk: document.visibilityState };
};
