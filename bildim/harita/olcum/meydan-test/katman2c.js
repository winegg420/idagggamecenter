// AŞAMA 2C §B — 3,6 ms tabanı: SIFIR karakterden başlayıp katman katman ekleyerek ölçüm. OYUN KODU DEĞİŞMEZ.
// Üretim derlemesi + ?otomasyon=1. Konsola yapıştır ya da addScriptTag:  await katmanKur()  →  await katmanKos()
// Görünürlük yalnız ölçüm için ezilir (Object3D.visible alıcısı); karakterlerin CPU güncellemesi gizliyken de sürer (rapora not).
(() => {
  const yuzde = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))].toFixed(2); };
  let kayit = null;   // render.render yaması: { cpu[], sorgu[] }
  const gizliler = new Set();
  const gizle = (o) => { if (!o || gizliler.has(o)) return; gizliler.add(o); Object.defineProperty(o, "visible", { configurable: true, get: () => false, set: () => {} }); };
  const goster = (o) => { if (!o || !gizliler.has(o)) return; gizliler.delete(o); delete o.visible; o.visible = true; };

  window.katmanKur = async () => {
    const h = window.__harita, d = h.dunya;
    await d.karakterHazir; await d.cevreHazir;
    d.render.setPixelRatio(1); d.boyutlandir();
    const gl = d.render.getContext(), ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const asil = d.render.render.bind(d.render);
    d.render.render = (s, k) => {
      if (!kayit) return asil(s, k);
      if (kayit.cizme) return;   // "çizim yok" satırı: yalnız oyun mantığı + gl.finish
      const q = ext ? gl.createQuery() : null; if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const t0 = performance.now(); asil(s, k); kayit.cpu.push(performance.now() - t0);
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); kayit.sorgu.push(q); }
    };
    // Kamera: 2B en kötü açı (İstiklal ucu, tüm boy)
    const M = d.yerlesim.manifest, kr = M.sinir.parcalar.find((p) => p.tip === "koridor");
    const [ax, az] = kr.baslangic, L = Math.hypot(kr.bitis[0] - ax, kr.bitis[1] - az), ux = (kr.bitis[0] - ax) / L, uz = (kr.bitis[1] - az) / L;
    const P = (t, l) => [ax + ux * t - uz * l, az + uz * t + ux * l];
    const [bx, bz] = P(96, 0); h.ben.position.set(bx, 0, bz);
    const kam = P(104, 0), hedef = P(0, 0);
    d.kameraSabitle({ konum: [kam[0], 9, kam[1]], hedef: [hedef[0], 1.5, hedef[1]] });
    window.__katman = { d, h, P, ext, gl };
    return { kanvas: [d.render.domElement.width, d.render.domElement.height], gpu: (() => { const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })(), timer: !!ext };
  };

  const cevreParca = (ad) => window.__katman.d.cevre()?.grup.children.find((c) => c.name === ad);
  const avatarlar = () => { const { h } = window.__katman; return [h.ben, ...[...h.uzaklar.values()].map((u) => u.av), ...[...h.botlar.values()].map((b) => b.av)]; };
  const sahneCocuk = (ad) => window.__katman.d.sahne.children.find((c) => c.name === ad);

  const KATMANLAR = {
    zemin: () => [cevreParca("CevreZemin")],
    binalar: () => [cevreParca("CevreBinalar"), cevreParca("CevreArkaplan"), sahneCocuk("Yerlesim")],
    proplar: () => ["agac_govde", "agac_tac", "lamba", "bank", "saksi"].map(cevreParca).concat(sahneCocuk("TemasGolgeleri")),
    kediler: () => [sahneCocuk("kediler")],
    karakterler: () => [...avatarlar(), sahneCocuk("VFX")],
  };
  const SIRA = ["zemin", "binalar", "proplar", "kediler", "karakterler"];
  window.katmanAyarla = (n) => {   // n: kaç katman açık (0 = hiçbir şey, yalnız gökyüzü + ışık)
    SIRA.forEach((ad, i) => { for (const o of KATMANLAR[ad]()) (i < n ? goster : gizle)(o); });
  };

  let oyuncuVar = false;
  window.oyuncular = async () => {
    if (oyuncuVar) return; oyuncuVar = true;
    const { d, P } = window.__katman, turler = ["insan", "kaplan", "robot"];
    for (let i = 0; i < 24; i++) window.__sahteKanal.oyuncuEkle("o" + i, "Oyuncu " + (i + 1), { harita: { tur: turler[i % 3] } });
    const pozla = () => { for (let i = 0; i < 24; i++) { const [x, z] = P(12 + i * 3.5, (i % 2 ? 1 : -1) * (1 + (i % 4))); window.__sahteKanal.poz("o" + i, x, z, 0); } };
    window.__kare.durdur();
    for (let n = 0; n < 90; n++) { if (n % 15 === 0) pozla(); await window.__kare.olc({ gl: d.render.getContext(), isinma: 1, ornek: 1 }); }
    window.__kare.devam();
  };

  /** Tek satır: 120 ısınma + 300 örnek. kare = cizim()+gl.finish (CPU+GPU); cpu = render.render gönderimi; gpu = timer query. */
  window.olcSatir = async (etiket, { cizme = false } = {}) => {
    const { d, gl, ext } = window.__katman;
    window.__kare.durdur();
    kayit = { cpu: [], sorgu: [], cizme };
    await window.__kare.olc({ gl, isinma: 120, ornek: 1 });   // ısınma (kayıt atılır)
    for (const q of kayit.sorgu) gl.deleteQuery(q);
    kayit = { cpu: [], sorgu: [], cizme };
    const k = await window.__kare.olc({ gl, isinma: 0, ornek: 300 });
    const i = d.render.info.render, { cagri, ucgen } = cizme ? { cagri: 0, ucgen: 0 } : { cagri: i.calls, ucgen: i.triangles };
    const bitti = kayit; kayit = null;
    window.__kare.devam();
    // GPU sorguları: sonuç birkaç kare gecikmeli
    const gpu = [];
    if (ext && bitti.sorgu.length) {
      for (let n = 0; n < 40 && !gl.getQueryParameter(bitti.sorgu[bitti.sorgu.length - 1], gl.QUERY_RESULT_AVAILABLE); n++) { window.__kare.durdur(); await window.__kare.olc({ gl, isinma: 1, ornek: 1 }); window.__kare.devam(); }
      const bozuk = gl.getParameter(ext.GPU_DISJOINT_EXT);
      for (const q of bitti.sorgu) { if (!bozuk && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
    }
    return { etiket, cagri, ucgen, cpu: yuzde(bitti.cpu, 0.5), cpuP95: yuzde(bitti.cpu, 0.95), kare: k.medyan, kareP95: k.p95, gpu: yuzde(gpu, 0.5), gpuP95: yuzde(gpu, 0.95), tam: d.karakterler.tamSayisi };
  };

  window.golgeAyarla = (ac) => { const { d } = window.__katman; d.render.shadowMap.enabled = ac; d.sahne.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); };
  window.cozunurluk = (oran) => { const { d } = window.__katman; d.render.setPixelRatio(oran); d.boyutlandir(); return [d.render.domElement.width, d.render.domElement.height]; };

  /** Katman 3'ü parçala: katman 2'nin üstüne proplar TEK TEK (yalnız o) ve BİRİKİMLİ; gölge kapalı / yarım çözünürlük karşılığı. */
  window.propDetay = async () => {
    const { d } = window.__katman, sonuc = [], adlar = ["agac_govde", "agac_tac", "lamba", "bank", "saksi"];
    const nesne = (ad) => cevreParca(ad) ?? sahneCocuk(ad);
    const hepsi = [...adlar, "TemasGolgeleri"];
    const sadece = (liste) => { window.katmanAyarla(2); for (const ad of hepsi) (liste.includes(ad) ? goster : gizle)(nesne(ad)); };
    d.kalabalikSiniri(0);
    for (const ad of hepsi) { sadece([ad]); const o = nesne(ad); sonuc.push(await olcSatir(`2 + yalnız ${ad} (örnek ${o?.count ?? "-"}, gölge atar ${o?.castShadow})`)); }
    for (let n = 1; n <= hepsi.length; n++) { sadece(hepsi.slice(0, n)); sonuc.push(await olcSatir(`2 + birikimli ${hepsi.slice(0, n).join("+")}`)); }
    window.golgeAyarla(false); sonuc.push(await olcSatir("3 · tüm proplar, gölge KAPALI")); window.golgeAyarla(true);
    for (const oran of [0.75, 0.5]) { const b = window.cozunurluk(oran); sonuc.push(await olcSatir(`3 · tüm proplar, çözünürlük %${oran * 100} (${b[0]}×${b[1]})`)); }
    window.cozunurluk(1);
    sadece(["agac_govde", "lamba", "bank", "saksi", "TemasGolgeleri"]); sonuc.push(await olcSatir("3 · ağaç tacı HARİÇ tüm proplar"));
    return sonuc;
  };

  window.katmanKos = async () => {
    const { d } = window.__katman, sonuc = [];
    d.kalabalikSiniri(0);
    window.katmanAyarla(0); sonuc.push(await olcSatir("0 · hiçbir şey (gökyüzü + ışık)"));
    window.katmanAyarla(1); sonuc.push(await olcSatir("1 · zemin"));
    window.golgeAyarla(false); sonuc.push(await olcSatir("1 · zemin, gölge KAPALI")); window.golgeAyarla(true);
    window.katmanAyarla(2); sonuc.push(await olcSatir("2 · + binalar (boyalı) + arka plan + greybox kalıntısı"));
    window.katmanAyarla(3); sonuc.push(await olcSatir("3 · + proplar (+ temas gölgeleri)"));
    window.katmanAyarla(4); sonuc.push(await olcSatir("4 · + kediler"));
    sonuc.push(await olcSatir("4 · çizim YOK (oyun mantığı + gl.finish)", { cizme: true }));
    await window.oyuncular(); window.katmanAyarla(5);
    sonuc.push(await olcSatir("5 · + 25 hafif karakter (sınır 0)"));
    d.kalabalikSiniri(8);
    sonuc.push(await olcSatir("6 · sınır 8"));
    sonuc.push(await olcSatir("6 · çizim YOK (oyun mantığı + gl.finish)", { cizme: true }));
    window.golgeAyarla(false); sonuc.push(await olcSatir("6 · gölge KAPALI")); window.golgeAyarla(true);
    for (const oran of [0.75, 0.5]) { const b = window.cozunurluk(oran); sonuc.push(await olcSatir(`6 · çözünürlük %${oran * 100} (${b[0]}×${b[1]})`)); }
    window.cozunurluk(1);
    window.katmanAyarla(0); for (const oran of [0.5]) { const b = window.cozunurluk(oran); sonuc.push(await olcSatir(`0 · çözünürlük %${oran * 100} (${b[0]}×${b[1]})`)); }
    window.cozunurluk(1);
    return sonuc;
  };
})();

// Çözünürlük eğrisi: basamak mı doğrusal mı? (katman 3 ve katman 6)
window.cozunurlukEgrisi = async () => {
  const { d } = window.__katman, sonuc = [];
  for (const [n, sinir] of [[3, 0], [5, 8]]) {
    if (n === 5) await window.oyuncular();
    window.katmanAyarla(n); d.kalabalikSiniri(sinir);
    for (const oran of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.35]) { const b = window.cozunurluk(oran); sonuc.push(await window.olcSatir(`${n === 5 ? 6 : 3} · %${Math.round(oran * 100)} (${b[0]}×${b[1]}, ${Math.round(oran * oran * 100)}% piksel)`)); }
    window.cozunurluk(1);
  }
  return sonuc;
};
