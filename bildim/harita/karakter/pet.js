// ============================================================
// PET SİSTEMİ — Aşama 1G B.4. Sokak kedisi hattının (prop_kedi.glb, iskeletsiz, kod animasyonlu, tek InstancedMesh)
// yeniden kullanımı: kedi · köpek (kedinin yeniden derisi: renk + oran) · kuş (kod geometrisi, uçar).
//   Tür başına TEK InstancedMesh → 3 çağrı; 25 oyuncu × 1 pet = 25 çağrı DEĞİL. Gölge atmaz, temas gölgesi var.
//   Ağ: yeni durum YOK (K2) — pet konumu sahibin konumundan istemci tarafında deterministik türetilir.
//   Takip: sahibin arkasında yaylı gecikme; uzaklaşınca koşar (kuş uçar); sahibi durunca boşta bekler
//   (kedi oturur, köpek kuyruk sallar, kuş daire çizer). Sahibin içinden geçmez, bina kutusuna girmez.
//   Kanatlı (süzülen) sahip: kuş sahibin yüksekliğine çıkar; kedi/köpek YERDE takip eder (öneri — rapor "açık soru").
// ============================================================
import * as THREE from "three";

const RENK = { kedi: new THREE.Color(0xd08a45), kopek: new THREE.Color(0x8b5a2b), kus: new THREE.Color(0xffffff) };
const OLCEK = { kedi: [1, 1, 1], kopek: [1.25, 1.3, 1.3], kus: [1, 1, 1] };
const BINA = { x: 5.8, z: 0.6 };   // test sahnesi dükkânı: |x| < 5,8 ve z < 0,6 yasak

/** Kuş: küre gövde + kafa + gaga + iki kanat levhası + kuyruk (kod geometrisi, iskeletsiz). uv → verilen hücre merkezleri. */
function kusGeometri(hucre) {
  const parca = [];
  const ekle = (g, h) => { const r = hucre[h] ?? { u0: 0, u1: 0, v0: 0, v1: 0 }; const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2); parca.push(g); };
  const govde = new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.85, 1.35); ekle(govde, "boya");
  const kafa = new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.055, 0.09); ekle(kafa, "boya");
  const gaga = new THREE.ConeGeometry(0.014, 0.045, 5).rotateX(Math.PI / 2).translate(0, 0.05, 0.145); ekle(gaga, "altin");
  for (const s of [-1, 1]) { const k = new THREE.BoxGeometry(0.3, 0.012, 0.11).translate(s * 0.17, 0.02, -0.01).applyMatrix4(new THREE.Matrix4().makeRotationZ(s * 0.42)); ekle(k, "gomlek"); }
  const kuyruk = new THREE.BoxGeometry(0.06, 0.01, 0.12).translate(0, 0.01, -0.14); ekle(kuyruk, "boya");
  for (const s of [-1, 1]) ekle(new THREE.SphereGeometry(0.01, 5, 4).translate(s * 0.03, 0.07, 0.125), "gozBebek");
  // birleştir (position/normal/uv), bolge + beyaz renk
  let n = 0; for (const g of parca) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let o = 0;
  for (const g of parca) { const gi = g.index ? Array.from(g.index.array) : Array.from({ length: g.attributes.position.count }, (_, i) => i); for (const i of gi) idx.push(i + o); pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("_bolge", new THREE.BufferAttribute(new Float32Array(n).fill(17), 1));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.setIndex(idx); geo.computeBoundingSphere();
  return geo;
}

export class PetSistemi {
  /** @param {THREE.Scene} sahne @param {{kediGeo:THREE.BufferGeometry, malzeme:THREE.Material, hucreler:object, temasHedefler:Array, kapasite?:number}} s */
  constructor(sahne, s) {
    this.kapasite = s.kapasite ?? 32;
    this.mesh = {
      kedi: new THREE.InstancedMesh(s.kediGeo, s.malzeme, this.kapasite),
      kopek: new THREE.InstancedMesh(s.kediGeo, s.malzeme, this.kapasite),
      kus: new THREE.InstancedMesh(kusGeometri(s.hucreler), s.malzeme, this.kapasite),
    };
    for (const [ad, m] of Object.entries(this.mesh)) { m.name = "pet_" + ad; m.count = 0; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; sahne.add(m); }
    this.petler = [];
    this.temasHedefler = s.temasHedefler;
    this._M = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  ekle(sahip, tur = "kedi") {
    if (this.petler.some((p) => p.sahip === sahip)) return null;
    const yan = (this.petler.length % 2 ? 1 : -1) * 0.45;
    const p = { sahip, tur, poz: sahip.position.clone().add(new THREE.Vector3(yan, 0, -1)), yon: 0, hiz: 0, hal: "bekle", bekleSure: 0, faz: Math.random() * 6, yan, sonSahip: sahip.position.clone(), sahipHiz: 0 };
    this.petler.push(p);
    this.temasHedefler.push({ pet: p, nesne: { visible: true, parent: this.mesh[tur], getWorldPosition: (v) => v.set(p.poz.x, 0, p.poz.z) }, r: tur === "kus" ? 0.3 : 0.45 });
    return p;
  }
  kaldir(sahip) {
    const i = this.petler.findIndex((p) => p.sahip === sahip); if (i < 0) return;
    const p = this.petler.splice(i, 1)[0];
    const j = this.temasHedefler.findIndex((h) => h.pet === p); if (j >= 0) this.temasHedefler.splice(j, 1);
  }
  temizle() { for (const p of [...this.petler]) this.kaldir(p.sahip); }
  sayilar() { const s = { kedi: 0, kopek: 0, kus: 0 }; for (const p of this.petler) s[p.tur]++; return s; }
  /** dt saniye, zaman saniye. sahip.userData.suzulme → kanatlı sahip. */
  guncelle(dt, zaman) {
    const sayac = { kedi: 0, kopek: 0, kus: 0 };
    for (const p of this.petler) {
      const sahip = p.sahip; if (!sahip.parent) continue;
      const sp = sahip.position;
      p.sahipHiz = sp.distanceTo(p.sonSahip) / Math.max(1e-3, dt); p.sonSahip.copy(sp);
      const ileri = new THREE.Vector3(Math.sin(sahip.rotation.y), 0, Math.cos(sahip.rotation.y));
      const yan = new THREE.Vector3(ileri.z, 0, -ileri.x);
      const kus = p.tur === "kus";
      // hedef: sahibin arkasında, hafif yanda; kuş daire çizer (boşta) ya da arkada/üstte süzülür
      const hedef = sp.clone().addScaledVector(ileri, -(kus ? 0.7 : 1.0)).addScaledVector(yan, p.yan);
      if (kus) { const a = zaman * 1.4 + p.faz; hedef.x += Math.cos(a) * 0.5; hedef.z += Math.sin(a) * 0.5; hedef.y = 1.75 + Math.sin(zaman * 2.3 + p.faz) * 0.12 + (sahip.userData.suzulme ? 0.3 : 0); }
      // bina kutusuna girme
      if (Math.abs(hedef.x) < BINA.x && hedef.z < BINA.z) hedef.z = BINA.z + 0.1;
      const fark = hedef.clone().sub(p.poz); if (!kus) fark.y = 0;
      const mesafe = fark.length();
      let hizHedef = mesafe > 3 ? 4.2 : mesafe > 1.6 ? 2.2 : mesafe * 1.8;
      if (kus) hizHedef = Math.max(1.2, hizHedef);
      p.hiz += (hizHedef - p.hiz) * Math.min(1, dt * 4);
      if (mesafe > 0.05) { const adim = Math.min(mesafe, p.hiz * dt); p.poz.addScaledVector(fark.normalize(), adim); if (adim > 0.002) p.yon = Math.atan2(fark.x, fark.z); }
      // sahibin içinden geçmez
      const dS = p.poz.clone().sub(sp); dS.y = 0; if (dS.length() < 0.6) { dS.setLength(0.6); p.poz.x = sp.x + dS.x; p.poz.z = sp.z + dS.z; }
      if (!kus) p.poz.y = 0;
      // hal: sahip duruyor ve pet yakında → boşta
      const bosta = p.sahipHiz < 0.05 && mesafe < 0.9;
      p.bekleSure = bosta ? p.bekleSure + dt : 0;
      p.hal = kus ? "uc" : bosta && p.bekleSure > 1.2 ? (p.tur === "kedi" ? "otur" : "salla") : mesafe > 1.6 ? "kos" : mesafe > 0.15 ? "yuru" : "dur";
      if (!kus && p.hal !== "otur" && mesafe < 0.9) p.yon = Math.atan2(sp.x - p.poz.x, sp.z - p.poz.z);   // sahibine döner
      // örnek matrisi: kod animasyonu (hoplama, eğim, oturma, kuyruk sallama = hafif yalpalama, kuşta kanat çırpma = yükselme + yatış)
      const k = p.tur, hopla = p.hal === "kos" ? Math.abs(Math.sin(zaman * 14 + p.faz)) * 0.06 : p.hal === "yuru" ? Math.abs(Math.sin(zaman * 9 + p.faz)) * 0.025 : 0;
      const egim = p.hal === "otur" ? -0.38 : p.hal === "kos" ? 0.12 : p.hal === "yuru" ? Math.sin(zaman * 9 + p.faz) * 0.06 : 0;
      const yalpa = p.hal === "salla" ? Math.sin(zaman * 12 + p.faz) * 0.08 : p.hal === "yuru" ? Math.sin(zaman * 4.5 + p.faz) * 0.04 : 0;
      const [sx, sy, sz] = OLCEK[k];
      if (kus) { const cirp = Math.sin(zaman * 9 + p.faz); this._e.set(0.08 + cirp * 0.05, p.yon, Math.sin(zaman * 1.4 + p.faz) * 0.35); this._M.compose(this._v.set(p.poz.x, p.poz.y + cirp * 0.04, p.poz.z), this._q.setFromEuler(this._e), this._s.set(sx, sy, sz)); }
      else { this._e.set(egim, p.yon, yalpa); this._M.compose(this._v.set(p.poz.x, hopla, p.poz.z), this._q.setFromEuler(this._e), this._s.set(sx, sy * (p.hal === "otur" ? 0.85 : 1), sz)); }
      const m = this.mesh[k], i = sayac[k]++;
      m.setMatrixAt(i, this._M); m.setColorAt(i, RENK[k]);
    }
    for (const [k, m] of Object.entries(this.mesh)) { m.count = sayac[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}
