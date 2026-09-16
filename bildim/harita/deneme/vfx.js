// ============================================================
// VFX KİTİ — Aşama 1G K1/K3. TEK paylaşılan InstancedMesh + TEK ShaderMaterial: bütün oyuncuların bütün efektleri
// aynı çağrıda çizilir. Oyuncuya özel veri (konum, faz, renk, yoğunluk, hız) örnek özniteliğidir.
//
// MODÜLLER (parametrik, yeniden kullanılabilir): alev · parilti · iz · parlama · duman
//   Yeni kozmetik = modül kombinasyonu + renk + boyut + çapa noktaları. Yeni shader gerekmez.
//
// LOD (mesafe): yakın → tam parçacık · orta → yalnız `parlama` + %30 parçacık · uzak → hiç (yalnız gövde tonu, çağıran halleder).
// Aynı anda TAM VFX alan yayıcı sayısı `ayar.tamSayi` (kameraya en yakınlar) — değer §5.2 stres testinden seçilir, ayar dışarıdan.
//
// Bütçe: "1 çağrı garanti" YAZILMAZ; renderer.info ile ölçülür ve raporlanır (bu mesh 1 çağrı + gölge atmaz).
// ============================================================
import * as THREE from "three";

export const MODUL = { alev: 0, parilti: 1, iz: 2, parlama: 3, duman: 4 };

const VERTEX = /* glsl */ `
attribute vec4 aVeri;   // faz, tip, boyut, ömür
attribute vec3 aRenk;
attribute vec3 aHiz;    // yayıcının dünya hızı (alev geriye yatar, iz arkada kalır)
attribute float aYogun;
uniform float uZaman; uniform vec3 uSag; uniform vec3 uUst;
varying vec2 vUv; varying vec4 vRenk; varying float vTip; varying float vT;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float faz = aVeri.x, tip = aVeri.y, boyut = aVeri.z, omur = aVeri.w;
  float t = fract(uZaman / omur + faz);
  vec3 merkez = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float h1 = hash(faz * 7.1), h2 = hash(faz * 13.3);
  vec3 kay = vec3(0.0); float olcek = boyut; float alfa = 1.0;
  if (tip < 0.5) {            // ALEV: yükselir, titrer, hızla geriye yatar, sönerken küçülür
    kay = vec3((h1 - 0.5) * 0.10 * sin(uZaman * 6.0 + faz * 20.0), t * 1.6 * boyut, (h2 - 0.5) * 0.10) - aHiz * t * 0.18;
    olcek = boyut * (0.55 + 0.75 * (1.0 - t)) * (0.85 + 0.3 * sin(uZaman * 9.0 + faz * 31.0));
    alfa = pow(1.0 - t, 1.4) * smoothstep(0.0, 0.15, t);
  } else if (tip < 1.5) {     // PARILTI: yerinde titreşir, boyut nabız
    kay = vec3(sin(uZaman * 1.3 + faz * 9.0) * 0.05, t * 0.15, cos(uZaman * 1.1 + faz * 7.0) * 0.05);
    olcek = boyut * (0.35 + 0.65 * abs(sin(uZaman * 5.0 + faz * 40.0)));
    alfa = 0.55 + 0.45 * sin(uZaman * 7.0 + faz * 50.0);
  } else if (tip < 2.5) {     // İZ: hareketin arkasında kalır, düşer, söner
    kay = -aHiz * t * 0.8 + vec3(0.0, -0.1 * t, 0.0);
    olcek = boyut * (1.0 - 0.7 * t); alfa = 1.0 - t;
  } else if (tip < 3.5) {     // PARLAMA: çapada büyük yumuşak disk, nabız
    olcek = boyut * (1.0 + 0.12 * sin(uZaman * 3.0 + faz * 6.0)); alfa = 0.45 + 0.15 * sin(uZaman * 4.0 + faz * 10.0);
  } else {                    // DUMAN: yavaş yükselir, büyür, soluk
    kay = vec3((h1 - 0.5) * 0.25 * t, t * 0.7, (h2 - 0.5) * 0.25 * t) - aHiz * t * 0.2;
    olcek = boyut * (0.6 + 1.3 * t); alfa = (1.0 - t) * 0.35 * smoothstep(0.0, 0.2, t);
  }
  vec3 dunya = merkez + kay + (uSag * position.x + uUst * position.y) * olcek;
  vUv = uv; vTip = tip; vT = t; vRenk = vec4(aRenk, alfa * aYogun);
  gl_Position = projectionMatrix * viewMatrix * vec4(dunya, 1.0);
}`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv; varying vec4 vRenk; varying float vTip; varying float vT;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float m; vec3 c = vRenk.rgb;
  if (vTip < 0.5) {   // alev damlası: altı geniş, üstü sivri; merkezi sıcak sarı
    float y = p.y * 0.5 + 0.5; float w = mix(0.95, 0.12, y);
    m = 1.0 - smoothstep(w * 0.55, w, abs(p.x));
    m *= smoothstep(-1.0, -0.55, p.y) * (1.0 - smoothstep(0.65, 1.0, p.y));
    c = mix(c, vec3(1.0, 0.95, 0.6), (1.0 - vT) * (1.0 - r) * 0.85);
  } else if (vTip > 3.5) { m = pow(max(0.0, 1.0 - r), 1.2); }          // duman: geniş yumuşak
  else if (vTip > 2.5) { m = pow(max(0.0, 1.0 - r), 2.0); }            // parlama: yumuşak disk
  else { m = pow(max(0.0, 1.0 - r), 2.6); }                            // parıltı / iz: sıkı nokta
  float ort = vTip < 0.5 ? 0.85 : vTip > 3.5 ? 0.9 : 0.0;   // örtücülük: alev/duman fonu örter, ışık modülleri toplamsal
  gl_FragColor = vec4(c * m * vRenk.a, m * vRenk.a * ort);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class VfxKit {
  /** @param {THREE.Scene} sahne @param {{kapasite?:number, tamSayi?:number, ortaMesafe?:number, uzakMesafe?:number}} ayar */
  constructor(sahne, ayar = {}) {
    this.ayar = { kapasite: 1500, tamSayi: 6, ortaMesafe: 14, uzakMesafe: 28, ...ayar };
    const N = this.ayar.kapasite;
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    geo.instanceCount = 0;
    this.veri = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
    this.renk = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.hiz = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.yogun = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    for (const a of [this.veri, this.renk, this.hiz, this.yogun]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aVeri", this.veri); geo.setAttribute("aRenk", this.renk); geo.setAttribute("aHiz", this.hiz); geo.setAttribute("aYogun", this.yogun);
    this.malzeme = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
      uniforms: { uZaman: { value: 0 }, uSag: { value: new THREE.Vector3(1, 0, 0) }, uUst: { value: new THREE.Vector3(0, 1, 0) } },
    });
    this.mesh = new THREE.InstancedMesh(geo, this.malzeme, N);
    this.mesh.name = "VFX"; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.renderOrder = 5;
    this.mesh.count = 0;
    sahne.add(this.mesh);
    this.yayicilar = new Set();
    this.istatistik = { parcacik: 0, yayici: 0, tam: 0, orta: 0, uzak: 0 };
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._kp = new THREE.Vector3(); this._o = new THREE.Vector3();
  }
  /**
   * Yayıcı: bir çapa (Object3D, genelde kemik) + yerel ofset etrafında `sayi` parçacık.
   * @param {{hedef:THREE.Object3D, ofset?:number[], modul:string, sayi:number, renk:THREE.Color|number, boyut?:number, omur?:number, yogunluk?:number, yayilim?:number, grup?:object}} s
   */
  yayici(s) {
    const y = { hedef: s.hedef, ofset: new THREE.Vector3(...(s.ofset ?? [0, 0, 0])), modul: MODUL[s.modul] ?? 0, sayi: s.sayi ?? 6, renk: new THREE.Color(s.renk ?? 0xff7a1a),
      boyut: s.boyut ?? 0.18, omur: s.omur ?? 0.9, yogunluk: s.yogunluk ?? 1, yayilim: s.yayilim ?? 0.05, faz: Math.random(), hiz: new THREE.Vector3(), grup: s.grup ?? null, aktif: true, lod: "tam" };
    this.yayicilar.add(y); return y;
  }
  sil(y) { this.yayicilar.delete(y); }
  silGrup(grup) { for (const y of [...this.yayicilar]) if (y.grup === grup) this.yayicilar.delete(y); }
  /** Her kare: çapaları oku, LOD'a göre parçacık yaz. `kam` kamera; `zaman` saniye. */
  guncelle(zaman, kam) {
    this.malzeme.uniforms.uZaman.value = zaman;
    kam.matrixWorld.extractBasis(this.malzeme.uniforms.uSag.value, this.malzeme.uniforms.uUst.value, this._kp);
    kam.getWorldPosition(this._kp);
    // mesafeye göre sırala → en yakın `tamSayi` yayıcı grubu tam VFX
    const liste = [];
    for (const y of this.yayicilar) {
      if (!y.aktif || !y.hedef?.parent) continue;
      // çapa: kemiğin dünya konumu; ofset KARAKTER (kök) uzayında döner (+Z ön) — kemik eksenleri Mixamo'da kemik boyunca, güvenilmez
      y.hedef.getWorldPosition(this._p);
      this._m.extractRotation((y.grup ?? y.hedef).matrixWorld); this._p.add(this._o.copy(y.ofset).applyMatrix4(this._m));
      y.dunya = (y.dunya ?? new THREE.Vector3()).copy(this._p); y.mesafe = this._p.distanceTo(this._kp); liste.push(y);
    }
    liste.sort((a, b) => a.mesafe - b.mesafe);
    const gruplar = new Map(); let tamGrup = 0;
    let i = 0, tam = 0, orta = 0, uzak = 0;
    const N = this.ayar.kapasite;
    for (const y of liste) {
      const g = y.grup ?? y;
      if (!gruplar.has(g)) { gruplar.set(g, tamGrup < this.ayar.tamSayi && y.mesafe < this.ayar.ortaMesafe ? "tam" : y.mesafe < this.ayar.uzakMesafe ? "orta" : "uzak"); if (gruplar.get(g) === "tam") tamGrup++; }
      y.lod = gruplar.get(g);
      if (y.lod === "uzak") { uzak++; continue; }
      let sayi = y.sayi;
      if (y.lod === "orta") { orta++; if (y.modul !== MODUL.parlama) sayi = Math.ceil(y.sayi * 0.3); } else tam++;
      for (let k = 0; k < sayi && i < N; k++, i++) {
        const faz = y.faz + k * 0.137;
        this._m.makeTranslation(y.dunya.x + Math.sin(faz * 53.1) * y.yayilim, y.dunya.y + Math.sin(faz * 31.7) * y.yayilim * 0.5, y.dunya.z + Math.sin(faz * 77.3) * y.yayilim);
        this.mesh.setMatrixAt(i, this._m);
        this.veri.setXYZW(i, faz % 1, y.modul, y.boyut, y.omur);
        this.renk.setXYZ(i, y.renk.r, y.renk.g, y.renk.b);
        this.hiz.setXYZ(i, y.hiz.x, y.hiz.y, y.hiz.z);
        this.yogun.setX(i, y.yogunluk);
      }
    }
    this.mesh.count = i; this.mesh.geometry.instanceCount = i;
    this.mesh.instanceMatrix.needsUpdate = true; this.veri.needsUpdate = true; this.renk.needsUpdate = true; this.hiz.needsUpdate = true; this.yogun.needsUpdate = true;
    this.istatistik = { parcacik: i, yayici: liste.length, tam, orta, uzak };
  }
}

/**
 * KOZMETİK VFX REÇETELERİ (K3 kit): kozmetik → modül kombinasyonu. Yeni kozmetik buraya bir giriş; shader değişmez.
 * çapa: kemik adı + yerel ofset (karakter +Z öne bakar).
 */
export const RECETE = {
  // Çapalar gövde YÜZEYİNDE (Spine2 ≈ göğüs merkezi, y 1,23; gövde yarıçapı ~0,22): içeride kalan parçacık derinlik testine takılır, görünmez.
  alevliGomlek: [
    { kemik: "Spine2", ofset: [0.27, 0.14, 0.02], modul: "alev", sayi: 7, renk: 0xff7a1a, boyut: 0.22, omur: 0.8, yayilim: 0.05 },     // sol omuz
    { kemik: "Spine2", ofset: [-0.27, 0.14, 0.02], modul: "alev", sayi: 7, renk: 0xff7a1a, boyut: 0.22, omur: 0.85, yayilim: 0.05 },   // sağ omuz
    { kemik: "Spine1", ofset: [0, 0.06, 0.24], modul: "alev", sayi: 6, renk: 0xff9a2a, boyut: 0.18, omur: 0.7, yayilim: 0.08 },        // göğüs önü
    { kemik: "Spine2", ofset: [0, 0.06, -0.23], modul: "alev", sayi: 6, renk: 0xff6a10, boyut: 0.2, omur: 0.9, yayilim: 0.08 },        // sırt
    { kemik: "LeftForeArm", ofset: [0, 0, 0], modul: "alev", sayi: 3, renk: 0xff8a20, boyut: 0.14, omur: 0.7, yayilim: 0.04 },
    { kemik: "RightForeArm", ofset: [0, 0, 0], modul: "alev", sayi: 3, renk: 0xff8a20, boyut: 0.14, omur: 0.7, yayilim: 0.04 },
    { kemik: "LeftHand", ofset: [0, 0, 0], modul: "iz", sayi: 4, renk: 0xffb040, boyut: 0.05, omur: 0.6, yayilim: 0.03 },              // koşarken kor izi
    { kemik: "RightHand", ofset: [0, 0, 0], modul: "iz", sayi: 4, renk: 0xffb040, boyut: 0.05, omur: 0.6, yayilim: 0.03 },
    { kemik: "Spine1", ofset: [0, 0.05, 0.1], modul: "parlama", sayi: 1, renk: 0xff5a12, boyut: 0.8, omur: 1, yogunluk: 0.22 },        // ısı halesi
    { kemik: "Spine2", ofset: [0, 0.2, 0.05], modul: "parilti", sayi: 8, renk: 0xffd070, boyut: 0.05, omur: 1.4, yayilim: 0.3 },        // kıvılcım
    { kemik: "Spine2", ofset: [0, 0.32, -0.08], modul: "duman", sayi: 3, renk: 0x555560, boyut: 0.2, omur: 1.8, yayilim: 0.1, yogunluk: 0.6 },
  ],
  kanat: [
    { kemik: "Spine2", ofset: [0.35, 0.25, -0.15], modul: "parilti", sayi: 5, renk: 0xffffff, boyut: 0.05, omur: 1.6, yayilim: 0.2 },
    { kemik: "Spine2", ofset: [-0.35, 0.25, -0.15], modul: "parilti", sayi: 5, renk: 0xffffff, boyut: 0.05, omur: 1.6, yayilim: 0.2 },
    { kemik: "Hips", ofset: [0, -0.9, 0], modul: "parlama", sayi: 1, renk: 0xbfe8ff, boyut: 1.1, omur: 1, yogunluk: 0.25 },
  ],
  // K3 sınav örneği — "buzlu kanat": aynı modüller, farklı renk/boyut; yeni shader YOK
  buzluKanat: [
    { kemik: "Spine2", ofset: [0.35, 0.25, -0.15], modul: "parilti", sayi: 8, renk: 0x9fe6ff, boyut: 0.06, omur: 1.2, yayilim: 0.25 },
    { kemik: "Spine2", ofset: [-0.35, 0.25, -0.15], modul: "parilti", sayi: 8, renk: 0x9fe6ff, boyut: 0.06, omur: 1.2, yayilim: 0.25 },
    { kemik: "Spine2", ofset: [0, 0.1, -0.2], modul: "duman", sayi: 4, renk: 0xcfe9ff, boyut: 0.22, omur: 2.2, yayilim: 0.15, yogunluk: 0.5 },
    { kemik: "Hips", ofset: [0, -0.9, 0], modul: "parlama", sayi: 1, renk: 0x8fd8ff, boyut: 1.2, omur: 1, yogunluk: 0.3 },
  ],
};

/** Reçeteyi bir karakter köküne uygula (kemik adlarını kök altında bulur). Döner: yayıcı listesi (grup = kok). */
export function receteUygula(kit, kok, ad) {
  const liste = [];
  for (const r of RECETE[ad] ?? []) { const kemik = kok.getObjectByName(r.kemik); if (!kemik) continue; liste.push(kit.yayici({ ...r, hedef: kemik, grup: kok })); }
  return liste;
}
