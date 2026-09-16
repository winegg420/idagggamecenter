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
function hucreli(geo, rect, { tint = null, bolge = BOLGE_DIGER, dolu = true } = {}) {
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
  if (M.dis_zemin && H[M.dis_zemin.hucre]) parca.push(hucreli(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(0, -0.03, 0), H[M.dis_zemin.hucre], { dolu: false }));
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
