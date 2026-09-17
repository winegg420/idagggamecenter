// ============================================================
// MEYDAN — ÖLÇÜM SAYACI (Aşama 2C Bölüm A)
//
// Canlı haritadaki `?olcum=1` göstergesinin veri katmanı. React'e dokunmaz.
// İKİ METRİK AYRI ve ETİKETLİ — karıştırma (1B'de HUD 1,86 / rapor 2,45):
//   CPU      = yalnız `render.render` gönderim süresi. Sürekli, ucuz.
//   CPU+GPU  = kare başı → dunya.guncelle sonu + gl.finish(). SÜREKLİ ÖLÇÜLMEZ:
//              gl.finish boru hattını sıraya sokar; yalnız düğmeyle istenir.
//   GPU      = EXT_disjoint_timer_query_webgl2 (destek yoksa null), CPU+GPU ölçümüyle birlikte.
// ============================================================

/** Sıralı dizide yüzdelik (medyan 0.5, p95 0.95); boşsa null. */
function yuzdelik(dizi, p) {
  if (!dizi.length) return null;
  const s = [...dizi].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))].toFixed(2);
}

/**
 * @param {import("three").WebGLRenderer} render
 */
export function olcumSayaciKur(render) {
  let gonderimToplam = 0, gonderimKare = 0, kareSayisi = 0, sonOkuma = performance.now();
  let istek = null;   // { isinma, ornek, i, sure[], sorgular[], ext, t0, q, coz, reddet, saat }

  const gl = () => render.getContext();

  function sorguyuKapat(ist) {
    if (!ist?.q) return;
    try { gl().endQuery(ist.ext.TIME_ELAPSED_EXT); ist.sorgular.push(ist.q); } catch { try { gl().deleteQuery(ist.q); } catch { /* yut */ } }
    ist.q = null;
  }

  async function gpuSonuclari(ist) {
    const g = gl(), gpu = [];
    if (!ist.ext || !ist.sorgular.length) return null;
    // Sorgu sonuçları birkaç kare gecikmeli gelir: 1,5 sn'ye kadar bekle
    for (let deneme = 0; deneme < 15; deneme++) {
      const son = ist.sorgular[ist.sorgular.length - 1];
      try { if (g.getQueryParameter(son, g.QUERY_RESULT_AVAILABLE)) break; } catch { break; }
      await new Promise((r) => setTimeout(r, 100));
    }
    let bozuk = true;
    try { bozuk = g.getParameter(ist.ext.GPU_DISJOINT_EXT); } catch { /* yut */ }
    for (const q of ist.sorgular) {
      try {
        if (!bozuk && g.getQueryParameter(q, g.QUERY_RESULT_AVAILABLE)) gpu.push(g.getQueryParameter(q, g.QUERY_RESULT) / 1e6);
        g.deleteQuery(q);
      } catch { /* yut */ }
    }
    return gpu.length ? { medyan: yuzdelik(gpu, 0.5), p95: yuzdelik(gpu, 0.95) } : null;
  }

  return {
    /** dunya.guncelle: render.render süresi (ms). */
    gonderim(ms) { gonderimToplam += ms; gonderimKare++; },

    /** Sayfanın kare başı (gizli sekme kontrolünden sonra). */
    kareBasla() {
      kareSayisi++;
      const ist = istek;
      if (!ist) return;
      sorguyuKapat(ist);   // önceki kare hata verip kareBitti gelmediyse açık sorgu kalmasın
      if (ist.ext && ist.i >= ist.isinma) {
        try { const q = gl().createQuery(); gl().beginQuery(ist.ext.TIME_ELAPSED_EXT, q); ist.q = q; } catch { ist.q = null; }
      }
      ist.t0 = performance.now();
    },

    /** dunya.guncelle bittikten sonra. Ölçüm istenmişse gl.finish ile kareyi bitirir. */
    kareBitti() {
      const ist = istek;
      if (!ist || ist.t0 == null) return;
      try { gl().finish(); } catch { /* yut */ }
      const ms = performance.now() - ist.t0;
      ist.t0 = null;
      sorguyuKapat(ist);
      if (ist.i >= ist.isinma) ist.sure.push(ms);
      ist.i++;
      if (ist.sure.length < ist.ornek) return;
      istek = null;
      clearTimeout(ist.saat);
      gpuSonuclari(ist).then((gpu) => ist.coz({
        cpuGpu: yuzdelik(ist.sure, 0.5), cpuGpuP95: yuzdelik(ist.sure, 0.95),
        gpu: gpu?.medyan ?? null, gpuP95: gpu?.p95 ?? null, gpuDestek: !!ist.ext,
        ornek: ist.ornek, isinma: ist.isinma, zaman: new Date().toLocaleTimeString("tr-TR"),
      })).catch(ist.reddet);
    },

    /** Son okumadan beri ortalama CPU gönderim süresi ve fps; sayaçları sıfırlar. */
    oku() {
      const t = performance.now(), gecen = t - sonOkuma;
      const sonuc = {
        cpu: gonderimKare ? +(gonderimToplam / gonderimKare).toFixed(2) : null,
        fps: gecen > 0 ? Math.round((kareSayisi * 1000) / gecen) : 0,
      };
      gonderimToplam = 0; gonderimKare = 0; kareSayisi = 0; sonOkuma = t;
      return sonuc;
    },

    get olcuyor() { return !!istek; },

    /** CPU+GPU (+GPU zamanlayıcı): `isinma` kare atılır, `ornek` kare medyan + p95. */
    olc({ isinma = 120, ornek = 300, zamanAsimiMs = 60000 } = {}) {
      if (istek) return Promise.reject(new Error("Ölçüm zaten sürüyor"));
      return new Promise((coz, reddet) => {
        let ext = null;
        try { ext = gl().getExtension("EXT_disjoint_timer_query_webgl2"); } catch { ext = null; }
        const ist = { isinma, ornek, i: 0, sure: [], sorgular: [], ext, t0: null, q: null, coz, reddet };
        ist.saat = setTimeout(() => {
          if (istek !== ist) return;
          sorguyuKapat(ist); istek = null;
          for (const q of ist.sorgular) { try { gl().deleteQuery(q); } catch { /* yut */ } }
          reddet(new Error("Ölçüm zaman aşımı (sekme gizli olabilir)"));
        }, zamanAsimiMs);
        istek = ist;
      });
    },
  };
}
