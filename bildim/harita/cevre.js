// ============================================================
// ÇEVRE SANAT KATMANI (Aşama 2B §3–§4D) — manifestten (yerlesim.json) gerçek GLB proplar, atlaslı zemin, sokak kedileri,
// boyalı bina kütleleri. KONUM HESAPLAMAZ: hat/aralık/çokgen/parsel verisini manifestten okur.
//
// Çizim çağrısı disiplini (1D): tür başına TEK InstancedMesh (ağaç gövde · taç · lamba · bank · saksı · kedi);
// zemin + bordür TEK birleşik mesh; binalar TEK birleşik mesh. Hepsi aynı atlas dokusu + bölge cilası (karakter malzemesi).
// Ağaç tacı gölgesini düşük poligonlu küre VEKİLİ atar (1D Bölüm D: yalnız gölge geçişinde görünür).
// ============================================================
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { vadiDeligi, bogazParcalari } from "./bogaz.js";

export const PROPLAR = ["prop_agac_govde", "prop_agac_tac", "prop_lamba", "prop_bank", "prop_saksi", "prop_kedi"];
const BOLGE_DIGER = 17;

// ---------------------------------------------------------------- ortak yardımcılar
const koridor = (b) => { const dx = b.bitis[0] - b.baslangic[0], dz = b.bitis[1] - b.baslangic[1], boy = Math.hypot(dx, dz); return { boy, ux: dx / boy, uz: dz / boy, x0: b.baslangic[0], z0: b.baslangic[1], genislik: b.genislik }; };
/** Deterministik 0..1 (konum/sıra tohumlu). */
const tohum = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
function icinde(nokta, [x, z]) {
  let ic = false;
  for (let i = 0, j = nokta.length - 1; i < nokta.length; j = i++) {
    const [xi, zi] = nokta[i], [xj, zj] = nokta[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ic = !ic;
  }
  return ic;
}
/** Çoklu çizgi boyunca `aralik` metrede bir nokta + yön (teğet açısı). */
function hatBoyunca(hat, aralik) {
  const sonuc = []; let kalan = 0;
  for (let i = 0; i < hat.length - 1; i++) {
    const [x0, z0] = hat[i], [x1, z1] = hat[i + 1], boy = Math.hypot(x1 - x0, z1 - z0);
    for (let t = kalan; t <= boy; t += aralik) { const k = t / boy; sonuc.push({ x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, teget: Math.atan2(x1 - x0, z1 - z0) }); kalan = t + aralik - boy; }
  }
  return sonuc;
}

/** Atlas hücresine UV'si eşlenmiş, bölge + beyaz renk öznitelikli geometri (birleştirme için ortak biçim). */
export function hucreli(geo, rect, { tint = null, bolge = BOLGE_DIGER, dolu = true } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, uv = g.attributes.uv;
  for (let i = 0; i < n; i++) {
    const u = dolu && uv ? uv.getX(i) : 0.5, v = dolu && uv ? uv.getY(i) : 0.5;
    uv.setXY(i, rect.u0 + (rect.u1 - rect.u0) * Math.min(1, Math.max(0, u)), rect.v0 + (rect.v1 - rect.v0) * Math.min(1, Math.max(0, v)));
  }
  const c = new Float32Array(n * 3).fill(1);
  if (tint) for (let i = 0; i < n; i++) { c[i * 3] = tint.r; c[i * 3 + 1] = tint.g; c[i * 3 + 2] = tint.b; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  g.setAttribute("_bolge", new THREE.BufferAttribute(new Float32Array(n).fill(bolge), 1));
  return g;
}
function birlesikMesh(parcalar, malzeme, ad) {
  const geo = mergeGeometries(parcalar, false);
  for (const p of parcalar) p.dispose();
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, malzeme); m.name = ad; m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- zemin + bordür (tek mesh)
function zeminKur(M, H, malzeme) {
  const parca = [];
  const karo = (x, z, adim, hucre, aci = 0, y = 0.012) => {
    const r = H[hucre]; if (!r) return;
    const g = new THREE.PlaneGeometry(adim, adim).rotateX(-Math.PI / 2).rotateY(aci).translate(x, y, z);
    parca.push(hucreli(g, r));
  };
  const plaza = M.bolgeler.find((b) => b.sekil === "daire" && b.tip !== "sosyal");
  const meydan = M.bolgeler.find((b) => b.sekil === "daire" && b.tip === "sosyal");
  const plazaR = plaza?.r ?? 0, meydanR = meydan?.r ?? 0;
  for (const b of M.bolgeler) {
    const z = b.zemin; if (!z) continue;
    const adim = z.adim ?? 2;
    if (b.sekil === "daire") {
      // EŞMERKEZLİ HALKA KAROLAR: kare ızgara yuvarlak kenarda testere dişi bırakıyordu. Halka i, dilim j → dörtgen karo;
      // desen "dama" → (i + j) tek/çift hücre. Plaza halkası meydanın dışından başlar (üst üste çizim yok).
      const [cx, cz] = b.merkez, sosyal = b.tip === "sosyal";
      const r0 = sosyal ? 0 : meydanR, y = sosyal ? 0.02 : 0.012;
      if (r0 === 0) parca.push(hucreli(new THREE.CircleGeometry(adim, 12).rotateX(-Math.PI / 2).translate(cx, y, cz), H[z.hucre]));
      let i = 0;
      for (let ri = Math.max(r0, sosyal ? adim : r0); ri < b.r - 1e-6; ri += adim, i++) {
        const ro = Math.min(b.r, ri + adim), n = Math.max(6, Math.round((2 * Math.PI * (ri + ro) / 2) / adim));
        for (let j = 0; j < n; j++) {
          const a0 = (j / n) * Math.PI * 2, a1 = ((j + 1) / n) * Math.PI * 2;
          const P = (r, a) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
          const [p0, p1, p2, p3] = [P(ri, a0), P(ro, a0), P(ro, a1), P(ri, a1)];
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([p0[0], y, p0[1], p2[0], y, p2[1], p1[0], y, p1[1], p0[0], y, p0[1], p3[0], y, p3[1], p2[0], y, p2[1]]), 3));
          g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
          g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]), 2));
          const dama = z.desen === "dama" && ((i + j) & 1);
          parca.push(hucreli(g, H[dama ? z.hucre2 : z.hucre] ?? H[z.hucre]));
        }
      }
    } else if (b.sekil === "koridor") {
      const k = koridor(b), aci = Math.atan2(k.ux, k.uz), kal = b.kaldirim ?? 0;
      // Alt katman: koridorun tamamı kaldırım renginde (plaza ağzındaki karo boşluklarını doldurur)
      parca.push(hucreli(new THREE.PlaneGeometry(b.genislik, k.boy).rotateX(-Math.PI / 2).rotateY(aci).translate(k.x0 + k.ux * k.boy / 2, 0.004, k.z0 + k.uz * k.boy / 2), H[z.kaldirim_hucre ?? z.hucre], { dolu: false }));
      for (let t = adim / 2; t < k.boy; t += adim) for (let l = -b.genislik / 2 + adim / 2; l < b.genislik / 2; l += adim) {
        const x = k.x0 + k.ux * t - k.uz * l, zz = k.z0 + k.uz * t + k.ux * l;
        if (Math.hypot(x, zz) <= plazaR + adim) continue;   // plaza içindeki koridor ağzı plaza karosu + alt katmanla örtülü
        karo(x, zz, adim, Math.abs(l) > b.genislik / 2 - kal ? (z.kaldirim_hucre ?? z.hucre) : z.hucre, aci);
      }
      if (b.bordur && kal > 0) for (const yan of [-1, 1]) {
        const l = yan * (b.genislik / 2 - kal);
        for (let t = 0; t < k.boy; t += 2) {
          const x = k.x0 + k.ux * (t + 1) - k.uz * l, zz = k.z0 + k.uz * (t + 1) + k.ux * l;
          if (Math.hypot(x, zz) <= plazaR) continue;
          parca.push(hucreli(new THREE.BoxGeometry(0.3, 0.16, 2).rotateY(aci).translate(x, 0.08, zz), H.tasAcik, { dolu: false }));
        }
      }
    }
    if (b.sekil === "daire" && b.bordur) {
      const n = Math.ceil((2 * Math.PI * b.r) / 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = b.merkez[0] + Math.cos(a) * b.r, zz = b.merkez[1] + Math.sin(a) * b.r;
        parca.push(hucreli(new THREE.BoxGeometry(0.3, 0.16, (2 * Math.PI * b.r) / n + 0.02).rotateY(-a).translate(x, 0.08, zz), H.tasAcik, { dolu: false }));   // yarıçap boyunca teğet
      }
    }
  }
  if (M.dis_zemin && H[M.dis_zemin.hucre]) {
    // 3A-1 §B: Boğaz vadisi varsa dış zemin orada AÇILIR (delikli şekil); yoksa eski tek düzlem
    const delik = vadiDeligi(M);
    let dis;
    if (delik) { const sekil = new THREE.Shape([[-700, -700], [700, -700], [700, 700], [-700, 700]].map(([x, z]) => new THREE.Vector2(x, -z))); sekil.holes.push(new THREE.Path(delik.map(([x, z]) => new THREE.Vector2(x, -z)))); dis = new THREE.ShapeGeometry(sekil).rotateX(-Math.PI / 2).translate(0, -0.03, 0); }
    else dis = new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(0, -0.03, 0);
    parca.push(hucreli(dis, H[M.dis_zemin.hucre], { dolu: false }));
  }
  const m = birlesikMesh(parca, malzeme, "CevreZemin");
  m.receiveShadow = true; m.castShadow = false;
  return m;
}

// ---------------------------------------------------------------- proplar (tür başına tek InstancedMesh)
function propKonumlari(M) {
  const liste = { agac: [], bank: [], lamba: [], saksi: [] };
  for (const a of M.alanlar) {
    const y = a.yerlestir;
    if (y?.prop === "agac" && y.hat) hatBoyunca(y.hat, y.aralik).forEach((p, i) => liste.agac.push({ ...p, olcek: y.olcek * (0.92 + tohum(p.x, p.z) * 0.18), don: tohum(i, p.x) * 6.28 }));
    else if (y?.prop === "agac" && y.doldur) {
      const xs = a.cokgen.map((p) => p[0]), zs = a.cokgen.map((p) => p[1]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += y.aralik) for (let z = Math.min(...zs); z <= Math.max(...zs); z += y.aralik) {
        const px = x + (tohum(x, z) - 0.5) * y.aralik * 0.6, pz = z + (tohum(z, x) - 0.5) * y.aralik * 0.6;
        if (icinde(a.cokgen, [px, pz])) liste.agac.push({ x: px, z: pz, olcek: y.olcek * (0.85 + tohum(px, pz) * 0.3), don: tohum(pz, px) * 6.28 });
      }
    } else if (y?.prop === "bank") hatBoyunca(y.hat, y.aralik).forEach((p) => liste.bank.push({ ...p, don: y.yuz === "merkez" ? Math.atan2(-p.x, -p.z) : p.teget + Math.PI / 2 }));
    else if (a.prop === "lamba" && a.hat) hatBoyunca(a.hat, a.aralik).forEach((p) => liste.lamba.push({ ...p, don: p.teget }));
  }
  const s = M.kurallar?.girilebilir_cephe?.saksi;
  if (s) for (const p of M.parseller.filter((q) => q.girilebilir)) {
    const [x, , z] = p.capa.konum, a = p.capa.donus_y, c = Math.cos(a), sn = Math.sin(a), on = p.ayakizi.derinlik / 2 + s.on;
    for (const yan of [-1, 1]) { const lx = yan * s.yan; liste.saksi.push({ x: x + lx * c + on * sn, z: z - lx * sn + on * c, olcek: 0.9, don: 0 }); }
  }
  return liste;
}

function orneklendir(kaynak, konumlar, ad, { golge = true } = {}) {
  const im = new THREE.InstancedMesh(kaynak.geometry, kaynak.material, Math.max(1, konumlar.length));
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  konumlar.forEach((k, i) => { M4.compose(p.set(k.x, 0, k.z), q.setFromAxisAngle(Y, k.don ?? 0), s.setScalar(k.olcek ?? 1)); im.setMatrixAt(i, M4); });
  im.count = konumlar.length; im.name = ad; im.castShadow = golge; im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

/**
 * Çevre sanat katmanı. `gb` = yerlesimKur sonucu (gri gruplar + kutuEkle). `proplar` = { ad: Mesh } (GLB'den).
 * @returns {{ grup: THREE.Group, sayilar: object }}
 */
export function cevreKur({ M, gb, sahne, render, proplar, hucreler, malzeme, temas = null }) {
  const grup = new THREE.Group(); grup.name = "Cevre"; sahne.add(grup);
  const sayilar = {};
  // zemin: gri bölge tonları + alan işaretleri yerine atlaslı karo
  grup.add(zeminKur(M, hucreler, malzeme)); gb.gri.zemin.visible = false; gb.gri.alan.visible = false;
  const L = propKonumlari(M);
  if (proplar.prop_agac_govde && proplar.prop_agac_tac && L.agac.length) {
    grup.add(orneklendir(proplar.prop_agac_govde, L.agac, "agac_govde"));
    const tac = orneklendir(proplar.prop_agac_tac, L.agac, "agac_tac", { golge: false });
    grup.add(tac);
    // 1D Bölüm D: taç gölgesini küre vekili atar; vekil ana geçişte görünmez (getRenderTarget() null) → ek çağrı yok
    const vekilGeo = new THREE.SphereGeometry(1.55, 7, 5).scale(1.1, 1, 1.1).translate(0, 5.0, 0);
    const vekil = new THREE.InstancedMesh(vekilGeo, proplar.prop_agac_tac.material, tac.count);
    vekil.instanceMatrix.copyArray(tac.instanceMatrix.array); vekil.instanceMatrix.needsUpdate = true; vekil.count = tac.count;
    vekil.castShadow = true; vekil.receiveShadow = false; vekil.name = "agac_tac_golge";
    Object.defineProperty(vekil, "visible", { get: () => render.getRenderTarget() !== null, set() {}, configurable: true });
    grup.add(vekil);
    for (const k of L.agac) { gb.kutuEkle({ x: k.x, z: k.z, yx: 0.3 * k.olcek / 0.7, yz: 0.3 * k.olcek / 0.7, id: "agac" }); temas?.ekle({ visible: true, parent: grup, getWorldPosition: (v) => v.set(k.x, 0, k.z) }, 1.5 * k.olcek, { cevre: true }); }
    sayilar.agac = L.agac.length;
  }
  if (proplar.prop_lamba && L.lamba.length) { grup.add(orneklendir(proplar.prop_lamba, L.lamba, "lamba")); gb.gri.lamba.visible = false; sayilar.lamba = L.lamba.length; }
  if (proplar.prop_bank && L.bank.length) {
    grup.add(orneklendir(proplar.prop_bank, L.bank, "bank"));
    for (const k of L.bank) { gb.kutuEkle({ x: k.x, z: k.z, aci: k.don, yx: 0.95, yz: 0.35, id: "bank", r: 1 }); temas?.ekle({ visible: true, parent: grup, getWorldPosition: (v) => v.set(k.x, 0, k.z) }, 1.8, { cevre: true }); }
    sayilar.bank = L.bank.length;
  }
  if (proplar.prop_saksi && L.saksi.length) {
    grup.add(orneklendir(proplar.prop_saksi, L.saksi, "saksi"));
    for (const k of L.saksi) gb.kutuEkle({ x: k.x, z: k.z, yx: 0.42, yz: 0.42, id: "saksi" });
    sayilar.saksi = L.saksi.length;
  }
  return { grup, sayilar };
}

// ---------------------------------------------------------------- SOKAK KEDİLERİ (Aşama 1C davranışı → 2B §4: her yerde)
// Tek InstancedMesh. Yerel, tohumlu (her istemcide aynı başlangıç), ağ trafiği yok. Alanlar: manifest `alanlar[kedi: true]`,
// kediler alanlara sırayla dağıtılır. Davranış döngüsü: yürü → dur → otur → yat → (yön değiştir) yürü.
// Alanın dışına ya da bir engele (parsel, bank, saksı, anıt) değerse geri döner. Sayı oyun_ayarlari.meydan_kedi_sayisi.
const KEDI_RENKLERI = [0xd08a45, 0x8a8a90, 0x3a3230, 0xf2efe8, 0xb8743a, 0x55504a].map((h) => new THREE.Color(h));
const KEDI_HIZ = 0.6;
export class KediSurusu {
  constructor({ M, gb, kaynak, sahne, temas = null, sayi = 8, kapasite = 40 }) {
    this.alanlar = M.alanlar.filter((a) => a.kedi && a.cokgen?.length >= 3);
    this.gb = gb; this.temas = temas; this.kapasite = kapasite;
    this.mesh = new THREE.InstancedMesh(kaynak.geometry, kaynak.material, kapasite);
    this.mesh.name = "kediler"; this.mesh.castShadow = false; this.mesh.frustumCulled = false; this.mesh.count = 0;
    sahne.add(this.mesh);
    this.kediler = [];
    this._M = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this.sayiAyarla(sayi);
  }
  sayiAyarla(n) {
    n = Math.max(0, Math.min(this.kapasite, Math.round(Number(n) || 0)));
    for (const k of this.kediler) this.temas?.sil(k.golge);
    this.kediler = [];
    if (!this.alanlar.length) { this.mesh.count = 0; return 0; }
    let t = 7;
    const rnd = () => { t = (t * 1103515245 + 12345) & 0x7fffffff; return t / 0x7fffffff; };
    for (let i = 0; i < n; i++) {
      const alan = this.alanlar[i % this.alanlar.length], xs = alan.cokgen.map((p) => p[0]), zs = alan.cokgen.map((p) => p[1]);
      let x = xs[0], z = zs[0];
      for (let d = 0; d < 60; d++) {
        const px = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), pz = Math.min(...zs) + rnd() * (Math.max(...zs) - Math.min(...zs));
        if (icinde(alan.cokgen, [px, pz])) { const p = { x: px, z: pz }; this.gb.carpismaDuzelt(p, 0.3); if (icinde(alan.cokgen, [p.x, p.z])) { x = p.x; z = p.z; break; } }
      }
      const k = { alan, x, z, yon: rnd() * Math.PI * 2, hal: ["yuru", "dur", "otur", "yat"][i % 4], sure: 1 + rnd() * 4, rnd, faz: rnd() * 6 };
      k.golge = { visible: true, parent: this.mesh, getWorldPosition: (v) => v.set(k.x, 0, k.z) };
      this.temas?.ekle(k.golge, 0.5);
      this.mesh.setColorAt(i, KEDI_RENKLERI[i % KEDI_RENKLERI.length]);
      this.kediler.push(k);
    }
    this.mesh.count = this.kediler.length;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return this.kediler.length;
  }
  guncelle(dt, t) {
    if (!this.mesh.visible || !this.kediler.length) return;
    const SIRA = { yuru: "dur", dur: "otur", otur: "yat", yat: "yuru" };
    this.kediler.forEach((k, i) => {
      k.sure -= dt;
      if (k.sure <= 0) { k.hal = SIRA[k.hal]; k.sure = k.hal === "yuru" ? 3 + k.rnd() * 4 : 1.5 + k.rnd() * 3; if (k.hal === "yuru") k.yon = k.rnd() * Math.PI * 2; }
      if (k.hal === "yuru") {
        const p = { x: k.x + Math.sin(k.yon) * KEDI_HIZ * dt, z: k.z + Math.cos(k.yon) * KEDI_HIZ * dt };
        const hedefX = p.x, hedefZ = p.z;
        this.gb.carpismaDuzelt(p, 0.3);
        const engel = Math.hypot(p.x - hedefX, p.z - hedefZ) > 1e-4;
        if (engel || !icinde(k.alan.cokgen, [p.x, p.z])) k.yon += Math.PI * (0.6 + k.rnd() * 0.5);   // geri dön, yerinde kal
        else { k.x = p.x; k.z = p.z; }
      }
      const yuru = k.hal === "yuru";
      const bob = yuru ? Math.abs(Math.sin(t * 9 + k.faz)) * 0.02 : 0;
      const egim = k.hal === "otur" ? -0.35 : yuru ? Math.sin(t * 9 + k.faz) * 0.06 : 0;
      const olcY = k.hal === "otur" ? 0.85 : k.hal === "yat" ? 0.55 : 1;
      this._e.set(egim, k.yon, yuru ? Math.sin(t * 4.5 + k.faz) * 0.05 : 0);
      this._M.compose(this._p.set(k.x, bob, k.z), this._q.setFromEuler(this._e), this._s.set(1, olcY, 1));
      this.mesh.setMatrixAt(i, this._M);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- BİNALARI BOYA (2B §4D) — geçici renkli kütle, cephe sanatı DEĞİL
// Ayak izleri manifestten, DEĞİŞMEZ (final cephe modülleri aynı parsel çapalarına takılacak). Tek birleşik mesh.
// Girilebilir: mod renkleri (dunya.js BINALAR paleti, aynen). Girilemez: nötr şehir tonları (sıva/tuğla), kimlikten kararlı.
// Zemin kat koyu ton, üst gövde açık ton, çatı ayrı ton. İnce detay (silme, korniş, vitrin çerçevesi) YOK.
const SEHIR_TONLARI = ["#F1E3CF", "#E6CFB0", "#D9C2A2", "#E9D6C8", "#D8DDE0", "#EAD9B8", "#CDBBA3"].map((h) => new THREE.Color(h));
const TUGLA_TON = new THREE.Color("#C9876A");
const cati = (h) => new THREE.Color(h);
const karmaId = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * @param {{ M, gb, hucreler, malzeme, modRenk: (rota:string)=>({duvar:string, cati:string}|null) }} o
 * @returns {{ bina: THREE.Mesh, arkaplan: THREE.Mesh|null, renkler: object }}
 */
export function binalariBoya({ M, gb, hucreler: H, malzeme, modRenk, atla = null }) {
  const parca = [], arka = [], renkler = {};
  const kutu = (en, h, d, y, x, z, aci, hucre, tint) => parca.push(hucreli(new THREE.BoxGeometry(en, h, d).translate(0, y + h / 2, 0).rotateY(aci).translate(x, 0, z), H[hucre] ?? H.siva, { tint }));
  const onde = (x, z, aci, lx, lz) => [x + lx * Math.cos(aci) + lz * Math.sin(aci), z - lx * Math.sin(aci) + lz * Math.cos(aci)];
  for (const p of M.parseller) {
    if (atla?.(p)) continue;   // 3A-1 §C: cephe sistemi (cephe.js) kuruyor; burada yalnız landmark kütleleri kalır
    const { en, derinlik: d, yukseklik: h } = p.ayakizi, [x, , z] = p.capa.konum, aci = p.capa.donus_y ?? 0, k = karmaId(p.id);
    const mr = p.girilebilir ? modRenk(p.mod) : null;
    const duvar = mr ? new THREE.Color(mr.duvar) : p.tur === "kamusal_yapi" ? new THREE.Color("#E3DCCF") : /^landmark/.test(p.tur) ? new THREE.Color("#EDE6D8") : SEHIR_TONLARI[k % SEHIR_TONLARI.length];
    const tuglaMi = !mr && (p.tur === "apartman" || p.tur === "kose_binasi") && (k >> 3) % 3 === 0;
    const catiRenk = mr ? cati(mr.cati) : p.tur === "apartman" || p.tur === "kose_binasi" ? cati(["#B4553E", "#9C4A36", "#7E6A5C"][(k >> 5) % 3]) : cati("#8F8A82");
    renkler[p.id] = { duvar: "#" + duvar.getHexString(), cati: "#" + catiRenk.getHexString(), tugla: tuglaMi };
    if (p.yertutucu === "silindir") {   // minare: gövde + şerefe + külah
      parca.push(hucreli(new THREE.CylinderGeometry(en / 2, en / 2 * 1.1, h, 14).translate(x, h / 2, z), H.tasAcik, { tint: duvar }));
      parca.push(hucreli(new THREE.CylinderGeometry(en / 2 + 0.5, en / 2 + 0.5, 0.6, 14).translate(x, h * 0.78, z), H.tas, { tint: duvar }));
      parca.push(hucreli(new THREE.ConeGeometry(en / 2 + 0.1, 5, 14).translate(x, h + 2.5, z), H.demir, { tint: new THREE.Color("#7E8C99") }));
      continue;
    }
    const zeminKat = Math.min(3.6, h * 0.45);
    const koyu = duvar.clone().multiplyScalar(0.8);
    kutu(en, zeminKat, d, 0, x, z, aci, p.tur === "kamusal_yapi" || /^landmark/.test(p.tur) ? "tas" : "sivaKoyu", koyu);   // zemin kat
    if (h - zeminKat > 0.05) kutu(en, h - zeminKat, d, zeminKat, x, z, aci, "siva", tuglaMi ? TUGLA_TON : duvar);   // üst gövde (desenli tuğla/kiremit hücresi büyük yüzeye gerilince metrelik desen çıkıyordu → düz dokulu sıva × ton)
    kutu(en + 0.3, 0.35, d + 0.3, h, x, z, aci, "sivaKoyu", catiRenk);   // çatı levhası
    if (p.yertutucu === "kubbe") parca.push(hucreli(new THREE.SphereGeometry(Math.min(en, d) * 0.38, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h + 0.35, z), H.demir, { tint: new THREE.Color("#8A99A6") }));
    if (p.girilebilir) {
      const [kx, kz] = onde(x, z, aci, 0, d / 2 + 0.06);
      parca.push(hucreli(new THREE.BoxGeometry(2.4, 3.0, 0.14).translate(0, 1.5, 0).rotateY(aci).translate(kx, 0, kz), H.ahsap));   // kapı
      const [tx, tz] = onde(x, z, aci, 0, d / 2 + 0.1);
      parca.push(hucreli(new THREE.BoxGeometry(Math.min(en - 0.6, 6.5), 0.8, 0.2).translate(0, zeminKat + 0.1, 0).rotateY(aci).translate(tx, 0, tz), H.cerceve, { tint: catiRenk }));   // tabela bandı (mod rengi)
    }
  }
  for (const n of M.noktalar.filter((q) => q.tip === "landmark" && q.ayakizi)) {   // Cumhuriyet Anıtı: taş taban + gövde
    const [x, , z] = n.konum, a = n.ayakizi, g = n.govde;
    kutu(a.en, a.yukseklik, a.derinlik, 0, x, z, 0, "tas", new THREE.Color("#D8CFC0"));
    if (g) kutu(g.en, g.yukseklik, g.derinlik, a.yukseklik, x, z, 0, "tasAcik", new THREE.Color("#E6DDCD"));
  }
  const bina = birlesikMesh(parca, malzeme, "CevreBinalar");
  bina.castShadow = true; bina.receiveShadow = true;
  gb.gri.parsel.traverse((o) => { if (o.isMesh) o.visible = false; });   // gri kütleler gizli; tabela yazıları (sprite) ve bina grupları durur

  // arka plan kuşağı: tonlu, gölgesiz, tek mesh
  const vadiVar = (M.arkaplan ?? []).some((b) => b.tip === "vadi");
  if (vadiVar) arka.push(...bogazParcalari({ M, hucreler: H }));   // 3A-1 §B: teraslar · deniz · karşı kıyı · köprü (aynı birleşik mesh)
  for (const b of M.arkaplan ?? []) {
    if (b.cokgen) {
      const sekil = new THREE.Shape(b.cokgen.map(([px, pz]) => new THREE.Vector2(px, -pz)));
      const yuk = b.yukseklik ?? 0;
      const geo = (yuk > 0 ? new THREE.ExtrudeGeometry(sekil, { depth: yuk, bevelEnabled: false }) : new THREE.ShapeGeometry(sekil)).rotateX(-Math.PI / 2).translate(0, b.tip === "su" ? -0.02 : 0, 0);
      const ton = { su: "#5FA8CF", tepe: "#7FA36E", siluet: "#C9C2B6" }[b.tip] ?? "#C9C2B6";
      arka.push(hucreli(geo, { su: H.cam, tepe: H.cim, siluet: H.siva }[b.tip] ?? H.siva, { tint: new THREE.Color(ton), dolu: false }));
    } else if (b.tip === "kopru" && !vadiVar) {
      const [x0, z0] = b.baslangic, [x1, z1] = b.bitis, boy = Math.hypot(x1 - x0, z1 - z0), aci = Math.atan2(x1 - x0, z1 - z0);
      arka.push(hucreli(new THREE.BoxGeometry(6, 2, boy).rotateY(aci).translate((x0 + x1) / 2, b.guverte_yukseklik, (z0 + z1) / 2), H.demir, { tint: new THREE.Color("#B8C2CC"), dolu: false }));
      for (const t of [0.22, 0.78]) arka.push(hucreli(new THREE.BoxGeometry(5, b.kule_yukseklik, 5).translate(x0 + (x1 - x0) * t, b.kule_yukseklik / 2, z0 + (z1 - z0) * t), H.demir, { tint: new THREE.Color("#C9D1D8"), dolu: false }));
    }
  }
  let arkaplan = null;
  if (arka.length) { arkaplan = birlesikMesh(arka, malzeme, "CevreArkaplan"); arkaplan.castShadow = false; arkaplan.receiveShadow = false; gb.gri.arkaplan.visible = false; }
  return { bina, arkaplan, renkler };
}
