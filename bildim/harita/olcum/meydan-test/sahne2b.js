// AŞAMA 2B §6 — en kötü açı sahnesi: İstiklal'in ucundan tüm boyuna bakış, 25 oyuncu (kendi + 24 uzak; türler karışık).
// Konsola yapıştırılır (üretim derlemesi, ?otomasyon=1):  await sahneKur()  →  await kosu(25)  (her çağrı 120 ısınma + 300 örnek)
// Zamanlayıcı beklemesi yok: otomasyon sekmesi gizli sayıldığında setTimeout dakikada bire düşebiliyor.
window.sahneKur = async () => {
  const h = window.__harita, d = h.dunya;
  await d.karakterHazir; await d.cevreHazir;
  d.render.setPixelRatio(1); d.boyutlandir();
  const M = d.yerlesim.manifest, k = M.sinir.parcalar.find((p) => p.tip === "koridor");
  const [ax, az] = k.baslangic, L = Math.hypot(k.bitis[0] - ax, k.bitis[1] - az);
  const ux = (k.bitis[0] - ax) / L, uz = (k.bitis[1] - az) / L;
  const P = (t, l) => [ax + ux * t - uz * l, az + uz * t + ux * l];
  const turler = ["insan", "kaplan", "robot"];
  for (let i = 0; i < 24; i++) window.__sahteKanal.oyuncuEkle("o" + i, "Oyuncu " + (i + 1), { harita: { tur: turler[i % 3] } });
  const pozla = () => { for (let i = 0; i < 24; i++) { const [x, z] = P(12 + i * 3.5, (i % 2 ? 1 : -1) * (1 + (i % 4))); window.__sahteKanal.poz("o" + i, x, z, 0); } };
  window.__kare.durdur();
  for (let n = 0; n < 90; n++) { if (n % 15 === 0) pozla(); await window.__kare.olc({ gl: d.render.getContext(), isinma: 1, ornek: 1 }); }
  const [bx, bz] = P(96, 0); h.ben.position.set(bx, 0, bz);
  const kam = P(104, 0), hedef = P(0, 0);
  d.kameraSabitle({ konum: [kam[0], 9, kam[1]], hedef: [hedef[0], 1.5, hedef[1]] });
  await window.__kare.olc({ gl: d.render.getContext(), isinma: 5, ornek: 1 });
  window.__kare.devam();
  return { uzak: h.uzaklar.size, kanvas: [d.render.domElement.width, d.render.domElement.height] };
};
window.kosu = async (sinir) => {
  const d = window.__harita.dunya, gl = d.render.getContext();
  d.kalabalikSiniri(sinir);
  window.__kare.durdur();
  const r = await window.__kare.olc({ gl });
  window.__kare.devam();
  const i = d.render.info.render;
  return { sinir, ...r, cagri: i.calls, ucgen: i.triangles, tam: d.karakterler.tamSayisi };
};
