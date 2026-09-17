// ============================================================
// YERLEŞİM → GREYBOX DÜNYA (Aşama 2A). Saf three.js; React yok.
//
// Haritanın tek doğruluk kaynağı `yerlesim.json`. Bu dosya KONUM HESAPLAMAZ: her şeyi manifestten okur,
// yalnız çizer ve çarpışma/yakınlık sorularını cevaplar. Bir binayı kaydırmak = JSON'da `capa.konum` değiştirmek.
//
// BİLEREK ÇİRKİN (Aşama 2A §4): düz gri tonlar, doku yok, AO yok, süs ışığı yok, her parselin üstünde etiket
// (id · tür · kat). Sanat değil yerleşim yargılanır.
//
// Dünya arayüzüne katkı (dunya.js bunu kullanır):
//   engeller   — botların kaçındığı daireler (yönlü kutular daire zincirine çevrilir; oyuncu çarpışması kutuyla)
//   binalar    — girilebilir parseller (HUD "binaya gir" ipucu; rota = manifest `mod`)
//   carpismaDuzelt(poz, r) · yakinBina(poz) · dogus · nokta(id) · etiketGoster(ac) · ozet
// ============================================================
import * as THREE from "three";
import { canvasDoku } from "./ortak.js";
import { manifestCoz } from "./yerlesimCoz.js";

// Gri tonlar (bölge okunaklılığı için; renk değil). Girilebilir dükkân en açık, landmark en koyu.
const TON = {
  disZemin: 0x5f6368, plaza: 0xa3a7ab, meydan: 0xc3c6c9, sokak: 0x8f9398, kaldirim: 0xb3b6b9,
  bina: 0x7d8288, dukkan: 0xdadcde, kamusal: 0x93989e, landmark: 0x4f5359, kapi: 0x2e3135, tabela: 0xf4f4f4,
  lamba: 0xeeeeee, direk: 0x3f4246, ray: 0x55595e, durak: 0xcfd2d5, su: 0x6f7a84, tepe: 0x686d73, siluet: 0x70757b,
  bitki: 0x8d9a8f, bank: 0xb5aea4, pet: 0xb9b2c4, npc: 0x3a3d41, spawn: 0xffffff,
};
const ALAN_Y = { bitki: 0.05, bank: 0.06, pet_npc: 0.07 };

const matOnbellek = new Map();
const mat = (renk) => { if (!matOnbellek.has(renk)) matOnbellek.set(renk, new THREE.MeshLambertMaterial({ color: renk })); return matOnbellek.get(renk); };

/** Metin etiketi (sprite). Greybox'ta bilerek sade: beyaz zemin, siyah yazı. */
function etiket(satirlar, olcek = 1) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 64 + 44 * (satirlar.length - 1);
  const x = c.getContext("2d");
  x.fillStyle = "rgba(255,255,255,0.92)"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#111"; x.textAlign = "center"; x.textBaseline = "middle";
  satirlar.forEach((s, i) => { x.font = i === 0 ? "700 38px ui-monospace, Consolas, monospace" : "500 30px ui-monospace, Consolas, monospace"; x.fillText(s, 256, 32 + i * 44); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasDoku(c), depthTest: false, depthWrite: false, transparent: true }));
  s.scale.set(9 * olcek, (9 * olcek * c.height) / c.width, 1);
  s.renderOrder = 10;
  return s;
}

const v2 = (a) => new THREE.Vector2(a[0], a[1]);
/** Koridor: başlangıç/bitiş + genişlik → merkez, uzunluk, yön açısı (Y ekseni). */
function koridor(b) {
  const dx = b.bitis[0] - b.baslangic[0], dz = b.bitis[1] - b.baslangic[1];
  return { cx: (b.baslangic[0] + b.bitis[0]) / 2, cz: (b.baslangic[1] + b.bitis[1]) / 2, boy: Math.hypot(dx, dz), aci: Math.atan2(dx, dz), ux: dx / Math.hypot(dx, dz), uz: dz / Math.hypot(dx, dz) };
}
function cokgenSekli(nokta) { return new THREE.Shape(nokta.map(([x, z]) => new THREE.Vector2(x, -z))); }   // ShapeGeometry XY; −π/2 X dönüşüyle y → −z
function merkezOf(nokta) { let x = 0, z = 0; for (const p of nokta) { x += p[0]; z += p[1]; } return [x / nokta.length, z / nokta.length]; }

/**
 * @param {{ sahne: THREE.Scene, manifest: object, tt?: (s:string)=>string, turnuvaAlt?: ()=>string }} o
 */
export function yerlesimKur({ sahne, manifest: ham, tt = (s) => s, turnuvaAlt = () => "" }) {
  // 3A-2 §A: bölge hiyerarşisi — kaydir burada (çözümleyicide) uygulanmış olur; bilinmeyen/eksik bölge SESSİZ GEÇMEZ
  const M = manifestCoz(ham);
  for (const h of M.cozum.hatalar) console.error("[Meydan] yerleşim manifesti:", h);
  if (M.cozum.kaydirilan.length) console.warn("[Meydan] bölge kaydırması etkin:", M.cozum.kaydirilan.join(" · "));
  const kok = new THREE.Group(); kok.name = "Yerlesim"; sahne.add(kok);
  const etiketler = new THREE.Group(); etiketler.name = "Etiketler"; kok.add(etiketler);
  // 2B: gri yer tutucular gruplu — sanat katmanı (cevre.js) geldiğinde ilgili grup gizlenir; çarpışma/ipucu mantığı aynı kalır
  const grup = (ad) => { const g = new THREE.Group(); g.name = ad; kok.add(g); return g; };
  const gri = { zemin: grup("GriZemin"), alan: grup("GriAlan"), lamba: grup("GriLamba"), parsel: grup("GriParsel"), arkaplan: grup("GriArkaplan") };
  const engeller = [];     // {x,z,r} — botlar için
  const kutular = [];      // {x,z,aci,yx,yz} yönlü kutu yarı boyları — oyuncu çarpışması
  const binalar = [];
  const ozet = { parsel: 0, girilebilir: 0, nokta: 0, alan: 0, bolge: 0, arkaplan: 0, mesh: 0, etiket: 0 };
  const ekle = (m, ebeveyn = kok) => { ebeveyn.add(m); if (m.isMesh) ozet.mesh++; return m; };

  // ---------- dış zemin (girilemez) ----------
  { const z = new THREE.Mesh(new THREE.CircleGeometry(620, 48), mat(TON.disZemin)); z.rotation.x = -Math.PI / 2; z.position.y = -0.02; z.receiveShadow = true; ekle(z, gri.zemin); }

  // ---------- bölgeler (zemin tonları; çizim sırası = manifest sırası, üst üste y ile) ----------
  M.bolgeler.forEach((b, i) => {
    const y = 0.01 + i * 0.012;
    if (b.sekil === "daire") {
      const m = new THREE.Mesh(new THREE.CircleGeometry(b.r, 72), mat(b.tip === "sosyal" ? TON.meydan : TON.plaza));
      m.rotation.x = -Math.PI / 2; m.position.set(b.merkez[0], y, b.merkez[1]); m.receiveShadow = true; ekle(m, gri.zemin);
    } else if (b.sekil === "koridor") {
      const k = koridor(b);
      const kal = new THREE.Mesh(new THREE.PlaneGeometry(b.genislik, k.boy), mat(TON.kaldirim));
      kal.rotation.set(-Math.PI / 2, 0, k.aci); kal.position.set(k.cx, y, k.cz); kal.receiveShadow = true; ekle(kal, gri.zemin);
      const yol = new THREE.Mesh(new THREE.PlaneGeometry(b.genislik - 2 * (b.kaldirim ?? 0), k.boy), mat(TON.sokak));
      yol.rotation.set(-Math.PI / 2, 0, k.aci); yol.position.set(k.cx, y + 0.006, k.cz); yol.receiveShadow = true; ekle(yol, gri.zemin);
    }
    ozet.bolge++;
    const e = etiket([`bölge: ${b.id}`, b.tip], 1.2);
    const [ex, ez] = b.sekil === "daire" ? [b.merkez[0] + b.r * 0.62, b.merkez[1] - b.r * 0.62] : [koridor(b).cx, koridor(b).cz];
    e.position.set(ex, 1.2, ez); etiketler.add(e);
  });

  // ---------- parseller ----------
  const tonu = (p) => (p.girilebilir ? TON.dukkan : /^landmark/.test(p.tur) ? TON.landmark : p.tur === "kamusal_yapi" ? TON.kamusal : TON.bina);
  for (const p of M.parseller) {
    const { en, derinlik, yukseklik } = p.ayakizi, [x, , z] = p.capa.konum, aci = p.capa.donus_y ?? 0;
    const g = new THREE.Group(); g.name = p.id; g.position.set(x, 0, z); g.rotation.y = aci;
    g.userData.parsel = p;
    let kutle;
    if (p.yertutucu === "silindir") kutle = new THREE.Mesh(new THREE.CylinderGeometry(en / 2, en / 2, yukseklik, 12), mat(tonu(p)));
    else kutle = new THREE.Mesh(new THREE.BoxGeometry(en, yukseklik, derinlik), mat(tonu(p)));
    kutle.position.y = yukseklik / 2; kutle.castShadow = true; kutle.receiveShadow = true; ekle(kutle, g);
    if (p.yertutucu === "kubbe") {   // cami: gövde + kubbe
      const kubbe = new THREE.Mesh(new THREE.SphereGeometry(Math.min(en, derinlik) * 0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(tonu(p)));
      kubbe.position.y = yukseklik; kubbe.castShadow = true; ekle(kubbe, g);
    }
    // §2 kuralı: girilebilir → tabela + aydınlatma + belirgin kapı. Girilemez → hiçbiri (oyuncu kapalı kapı denemesin)
    if (p.girilebilir) {
      const kapi = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.4), mat(TON.kapi)); kapi.position.set(0, 1.5, derinlik / 2 + 0.1); ekle(kapi, g);
      const tabela = new THREE.Mesh(new THREE.BoxGeometry(Math.min(en - 1, 6), 0.9, 0.3), mat(TON.tabela)); tabela.position.set(0, 3.55, derinlik / 2 + 0.2); ekle(tabela, g);
      const isik = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: TON.lamba })); isik.position.set(0, 3.05, derinlik / 2 + 0.45); ekle(isik, g);
      const tabelaYazi = etiket([tt(p.ad)], 0.7); tabelaYazi.material.depthTest = true; tabelaYazi.position.set(0, 3.55, derinlik / 2 + 0.6); g.add(tabelaYazi);
      // kapı önü noktası (dünya): ipucu yakınlığı buradan ölçülür
      const on = new THREE.Vector3(p.kapi_x ?? 0, 0, derinlik / 2 + 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), aci).add(g.position);
      binalar.push({ id: p.id, ad: tt(p.ad), alt: p.alt != null ? tt(p.alt) : turnuvaAlt(), rota: p.mod, x: on.x, z: on.z, g, isima: null, sayacLevha: null, yukseklik });
      ozet.girilebilir++;
    }
    gri.parsel.add(g);
    const e = etiket([p.id, `${p.tur}${p.kat ? ` · ${p.kat} kat` : ""}${p.girilebilir ? ` · ${p.mod}` : ""}`], 1);
    e.position.set(x, yukseklik + (p.yertutucu === "kubbe" ? Math.min(en, derinlik) * 0.38 : 0) + 2.2, z); etiketler.add(e);
    kutular.push({ x, z, aci, yx: en / 2, yz: derinlik / 2, id: p.id });
    // botlar için: uzun kenar boyunca kısa kenar yarıçaplı daire zinciri
    const kisa = Math.min(en, derinlik) / 2, uzun = Math.max(en, derinlik) / 2, eksenX = en >= derinlik;
    const adet = Math.max(1, Math.ceil(uzun / kisa));
    for (let i = 0; i < adet; i++) {
      const t = adet === 1 ? 0 : -uzun + kisa + ((2 * (uzun - kisa)) * i) / (adet - 1);
      const yerel = new THREE.Vector3(eksenX ? t : 0, 0, eksenX ? 0 : t).applyAxisAngle(new THREE.Vector3(0, 1, 0), aci);
      engeller.push({ x: x + yerel.x, z: z + yerel.z, r: kisa * 1.05, parsel: p.id });
    }
    ozet.parsel++;
  }

  // ---------- noktalar ----------
  const noktaHaritasi = new Map();
  for (const n of M.noktalar) {
    noktaHaritasi.set(n.id, n);
    const [x, , z] = n.konum;
    if (n.tip === "landmark" && n.ayakizi) {
      const a = n.ayakizi, taban = new THREE.Mesh(new THREE.BoxGeometry(a.en, a.yukseklik, a.derinlik), mat(TON.landmark));
      taban.position.set(x, a.yukseklik / 2, z); taban.castShadow = true; taban.receiveShadow = true; ekle(taban, gri.parsel);
      if (n.govde) { const gv = new THREE.Mesh(new THREE.BoxGeometry(n.govde.en, n.govde.yukseklik, n.govde.derinlik), mat(TON.landmark)); gv.position.set(x, a.yukseklik + n.govde.yukseklik / 2, z); gv.castShadow = true; ekle(gv, gri.parsel); }
      const cz = n.carpisma ?? a;   // 3A-2 §C.3: çarpışma yalnız kaidede (basamaklar yürünür) — manifest carpisma alanı
      kutular.push({ x, z, aci: n.donus_y ?? 0, yx: cz.en / 2, yz: cz.derinlik / 2, id: n.id });
      engeller.push({ x, z, r: Math.hypot(cz.en, cz.derinlik) / 2, parsel: n.id });
      const e = etiket([n.id, `landmark · ${n.ad ?? ""}`], 1); e.position.set(x, a.yukseklik + (n.govde?.yukseklik ?? 0) + 2.2, z); etiketler.add(e);
    } else if (n.tip === "kozmetik" && n.ayakizi) {   // 3A-2 §E: metro girişi vb. — ayak izinin TAMAMI katı (içine girilmez, düşülmez)
      const a = n.ayakizi, cz = n.carpisma ?? a, g = new THREE.Mesh(new THREE.BoxGeometry(a.en, a.yukseklik ?? 1, a.derinlik), mat(TON.landmark));
      g.position.set(x, (a.yukseklik ?? 1) / 2, z); g.rotation.y = n.donus_y ?? 0; ekle(g, gri.parsel);
      kutular.push({ x, z, aci: n.donus_y ?? 0, yx: cz.en / 2, yz: cz.derinlik / 2, id: n.id });
      engeller.push({ x, z, r: Math.hypot(cz.en, cz.derinlik) / 2, parsel: n.id });
      const e = etiket([n.id, `kozmetik · ${n.yuva ?? ""}`], 1); e.position.set(x, (a.yukseklik ?? 1) + 2.2, z); etiketler.add(e);
    } else if (n.tip === "npc") {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 10), mat(TON.npc)); m.position.set(x, 0.9, z); m.castShadow = true; ekle(m);
      engeller.push({ x, z, r: 0.6 }); kutular.push({ x, z, aci: 0, yx: 0.45, yz: 0.45, id: n.id });
      const e = etiket([n.id, "npc yer tutucu"], 0.8); e.position.set(x, 3.2, z); etiketler.add(e);
    } else if (n.tip === "tabela") {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = n.donus_y ?? 0;
      const direk = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), mat(TON.direk)); direk.position.y = 1.8; ekle(direk, g);
      const pano = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 0.2), mat(TON.tabela)); pano.position.y = 3.9; ekle(pano, g);
      const yazi = etiket([n.metin], 0.52); yazi.material.depthTest = true; yazi.position.set(0, 3.9, 0.2); g.add(yazi);
      kok.add(g); engeller.push({ x, z, r: 0.35 }); kutular.push({ x, z, aci: 0, yx: 0.2, yz: 0.2, id: n.id });
      const e = etiket([n.id], 0.8); e.position.set(x, 6, z); etiketler.add(e);
    } else if (n.tip === "spawn") {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 24), new THREE.MeshBasicMaterial({ color: TON.spawn })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); ekle(m);
      const e = etiket([n.id], 0.7); e.position.set(x, 1.4, z); etiketler.add(e);
    }
    ozet.nokta++;
  }

  // ---------- alanlar (prop değil, alan işareti) ----------
  for (const a of M.alanlar) {
    if (a.cokgen) {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(cokgenSekli(a.cokgen)), mat(TON[a.tip === "pet_npc" ? "pet" : a.tip] ?? TON.bank));
      m.rotation.x = -Math.PI / 2; m.position.y = ALAN_Y[a.tip] ?? 0.05; m.receiveShadow = true; ekle(m, gri.alan);
      const [cx, cz] = merkezOf(a.cokgen), e = etiket([`alan: ${a.id}`, a.tip], 0.9); e.position.set(cx, 1.0, cz); etiketler.add(e);
    } else if (a.hat) {
      // aydınlatma: hat boyunca `aralik` metrede bir direk (çarpışmalı)
      let kalan = 0;
      for (let i = 0; i < a.hat.length - 1; i++) {
        const p = v2(a.hat[i]), q = v2(a.hat[i + 1]), boy = p.distanceTo(q);
        for (let t = kalan; t <= boy; t += a.aralik) {
          const n = p.clone().lerp(q, t / boy);
          const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 0.22), mat(TON.direk)); d.position.set(n.x, 2.2, n.y); d.castShadow = true; ekle(d, gri.lamba);
          const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: TON.lamba })); f.position.set(n.x, 4.5, n.y); ekle(f, gri.lamba);
          engeller.push({ x: n.x, z: n.y, r: 0.3 }); kutular.push({ x: n.x, z: n.y, aci: 0, yx: 0.15, yz: 0.15, id: a.id });
          kalan = t + a.aralik - boy;
        }
      }
      const orta = a.hat[Math.floor(a.hat.length / 2)], e = etiket([`alan: ${a.id}`, `${a.tip} · ${a.aralik} m`], 0.8); e.position.set(orta[0], 6, orta[1]); etiketler.add(e);
    }
    ozet.alan++;
  }

  // ---------- tramvay (ray + durak; araç yok) ----------
  if (M.tramvay) {
    const T = M.tramvay;
    for (let i = 0; i < T.hat.length - 1; i++) {
      const k = koridor({ baslangic: T.hat[i], bitis: T.hat[i + 1] });
      for (const yan of [-0.5, 0.5]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, k.boy), mat(TON.ray));
        r.rotation.y = k.aci; r.position.set(k.cx + Math.cos(k.aci) * yan, 0.09, k.cz - Math.sin(k.aci) * yan); ekle(r);
      }
    }
    const k0 = koridor({ baslangic: T.hat[0], bitis: T.hat[T.hat.length - 1] });
    for (const d of T.duraklar) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 7), mat(TON.durak)); p.rotation.y = k0.aci; p.position.set(d.konum[0] + Math.cos(k0.aci) * 2.1, 0.125, d.konum[1] - Math.sin(k0.aci) * 2.1); ekle(p);
      const e = etiket([d.id, "tramvay durağı"], 0.8); e.position.set(d.konum[0], 2.2, d.konum[1]); etiketler.add(e);
    }
  }

  // ---------- arka plan kuşağı (yürünebilir sınırın ötesi, düşük detay) ----------
  for (const b of M.arkaplan ?? []) {
    if (b.cokgen) {
      const yuk = b.yukseklik ?? 0;
      const geo = yuk > 0 ? new THREE.ExtrudeGeometry(cokgenSekli(b.cokgen), { depth: yuk, bevelEnabled: false }) : new THREE.ShapeGeometry(cokgenSekli(b.cokgen));
      const m = new THREE.Mesh(geo, mat(TON[b.tip] ?? TON.siluet)); m.rotation.x = -Math.PI / 2; m.position.y = b.tip === "su" ? -0.01 : 0; ekle(m, gri.arkaplan);
      const [cx, cz] = merkezOf(b.cokgen), e = etiket([`arka plan: ${b.id}`, b.tip], 3); e.position.set(cx, yuk + 12, cz); etiketler.add(e);
    } else if (b.tip === "kopru") {
      const p = v2(b.baslangic), q = v2(b.bitis), boy = p.distanceTo(q), aci = Math.atan2(q.x - p.x, q.y - p.y);
      const guverte = new THREE.Mesh(new THREE.BoxGeometry(6, 2, boy), mat(TON.siluet)); guverte.rotation.y = aci; guverte.position.set((p.x + q.x) / 2, b.guverte_yukseklik, (p.y + q.y) / 2); ekle(guverte, gri.arkaplan);
      for (const t of [0.22, 0.78]) { const n = p.clone().lerp(q, t); const kule = new THREE.Mesh(new THREE.BoxGeometry(5, b.kule_yukseklik, 5), mat(TON.siluet)); kule.position.set(n.x, b.kule_yukseklik / 2, n.y); ekle(kule, gri.arkaplan); }
      const e = etiket([`arka plan: ${b.id}`, "köprü silueti"], 3); e.position.set((p.x + q.x) / 2, b.kule_yukseklik + 14, (p.y + q.y) / 2); etiketler.add(e);
    }
    ozet.arkaplan++;
  }
  ozet.etiket = etiketler.children.length + binalar.length + (M.noktalar.some((n) => n.tip === "tabela") ? 1 : 0);

  // ---------- çarpışma: yönlü kutular + birleşik yürünebilir sınır ----------
  const sinirParcalari = (M.sinir?.parcalar ?? [M.sinir]).map((s) => (s.tip === "koridor" ? { ...s, ...koridor(s) } : s));
  function parcaIcinde(s, x, z, pay) {
    if (s.tip === "daire") return Math.hypot(x - s.merkez[0], z - s.merkez[1]) <= s.r - pay;
    if (s.tip === "koridor") { const dx = x - s.baslangic[0], dz = z - s.baslangic[1], t = dx * s.ux + dz * s.uz, l = -dx * s.uz + dz * s.ux; return t >= pay && t <= s.boy - pay && Math.abs(l) <= s.genislik / 2 - pay; }
    if (s.tip === "dikdortgen") return x >= s.min[0] + pay && x <= s.max[0] - pay && z >= s.min[1] + pay && z <= s.max[1] - pay;
    return false;
  }
  function parcayaIt(s, x, z, pay) {
    if (s.tip === "daire") { const dx = x - s.merkez[0], dz = z - s.merkez[1], d = Math.hypot(dx, dz) || 1, r = s.r - pay; return [s.merkez[0] + (dx / d) * r, s.merkez[1] + (dz / d) * r]; }
    if (s.tip === "koridor") { const dx = x - s.baslangic[0], dz = z - s.baslangic[1]; const t = Math.min(s.boy - pay, Math.max(pay, dx * s.ux + dz * s.uz)), l = Math.min(s.genislik / 2 - pay, Math.max(-(s.genislik / 2 - pay), -dx * s.uz + dz * s.ux)); return [s.baslangic[0] + s.ux * t - s.uz * l, s.baslangic[1] + s.uz * t + s.ux * l]; }
    return [Math.min(s.max[0] - pay, Math.max(s.min[0] + pay, x)), Math.min(s.max[1] - pay, Math.max(s.min[1] + pay, z))];
  }
  function carpismaDuzelt(poz, yaricap) {
    for (const k of kutular) {
      const dx = poz.x - k.x, dz = poz.z - k.z, c = Math.cos(k.aci), s = Math.sin(k.aci);
      // dünya → yerel (Y ekseni etrafında −aci): yerel x = dx·cos − dz·sin, yerel z = dx·sin + dz·cos
      const lx = dx * c - dz * s, lz = dx * s + dz * c, hx = k.yx + yaricap, hz = k.yz + yaricap;
      if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      let nx = lx, nz = lz;
      if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
      poz.x = k.x + nx * c + nz * s; poz.z = k.z - nx * s + nz * c;
    }
    if (!sinirParcalari.some((s) => parcaIcinde(s, poz.x, poz.z, yaricap * 0.5))) {
      let en = null, enD = Infinity;
      for (const s of sinirParcalari) { const [x, z] = parcayaIt(s, poz.x, poz.z, yaricap * 0.5), d = Math.hypot(x - poz.x, z - poz.z); if (d < enD) { enD = d; en = [x, z]; } }
      if (en) { poz.x = en[0]; poz.z = en[1]; }
    }
  }
  function yakinBina(poz) {
    let yakin = null, enYakin = 5;
    for (const b of binalar) { const u = Math.hypot(poz.x - b.x, poz.z - b.z); if (u < enYakin) { enYakin = u; yakin = b; } }
    return yakin;
  }
  const spawn = M.noktalar.find((n) => n.tip === "spawn");
  /** 2B: sanat katmanı (cevre.js) çarpışma ekler — yönlü kutu (oyuncu) + daire (botlar). */
  const kutuEkle = ({ x, z, aci = 0, yx, yz, id = "prop", r = null }) => {
    kutular.push({ x, z, aci, yx, yz, id });
    engeller.push({ x, z, r: r ?? Math.max(yx, yz), parsel: id });
  };
  return {
    kok, gri, etiketler, kutuEkle, engeller, binalar, carpismaDuzelt, yakinBina, ozet,
    dogus: spawn ? { x: spawn.konum[0], z: spawn.konum[2], aci: spawn.donus_y ?? 0 } : { x: 0, z: 0, aci: 0 },
    nokta: (id) => noktaHaritasi.get(id) ?? null,
    etiketGoster: (ac) => { etiketler.visible = ac; for (const b of binalar) b.g.traverse((o) => { if (o.isSprite) o.visible = ac || o.parent === b.g; }); },
    sinirIcinde: (x, z) => sinirParcalari.some((s) => parcaIcinde(s, x, z, 0)),
  };
}
