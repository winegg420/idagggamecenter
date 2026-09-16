// ============================================================
// KARAKTER SİSTEMİ — ortak modül (Aşama 2B §1)
//
// Aşama 1–1G'de /harita-deneme sayfasının İÇİNDE büyüyen yeni GLB karakter sistemi buraya çıkarıldı.
// TEK KAYNAK, iki tüketici:
//   bildim/harita/deneme/DenemeSayfasi.jsx   (laboratuvar)
//   bildim/harita/dunya.js                   (gerçek harita)
//
// Sorumluluk: GLB yükleme (insan · kaplan · robot), tek malzeme cilası (bölge → pürüz/metal/emisyon),
// iskelet kopyası, klip oynatma, görünüm (kıyafet seti, saç varyantı, ten/saç/kıyafet tonu), kozmetik (kozmetik.js),
// ifade + göz kırpma (ifade.js), süzülme/zıplama görseli, VFX reçeteleri (vfx.js), silme.
// Karakter gövdesi, atlas ve kozmetikler burada ÜRETİLMEZ (varlik/uret.mjs); yalnız takılır.
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as iskeletKopyala } from "three/addons/utils/SkeletonUtils.js";
import { VfxKit, receteUygula } from "./vfx.js";
import { KOZMETIK, kozmetikTak, kuyrukTak } from "./kozmetik.js";
import { ifadeSec, canliEkle, canliSil, kirpmaGuncelle } from "./ifade.js";

export { KOZMETIK };
export const VARLIK_KOK = "/meydan/deneme/";
export const KLIPLER = ["Idle", "Walk", "Run", "Selam"];
export const TURLER = ["insan", "kaplan", "robot"];

/** Kıyafet setleri: bölge → atlas hücresi (geometri paylaşılır; yalnız UV ve ton değişir) + set özel parçalar */
export const SETLER = {
  1: { ad: "Günlük", ust: "tisort", alt: "kot", ayakkabi: "ayakkabi", ekstra: [] },
  2: { ad: "Şık", ust: "ceket", alt: "kumasPantolon", ayakkabi: "deri", ekstra: ["ceket", "yaka"] },
  3: { ad: "Spor", ust: "esofman", alt: "esofman", ayakkabi: "ayakkabi", ekstra: ["kapuson"] },
  4: { ad: "Alev", ust: "alevKumas", alt: "kot", ayakkabi: "ayakkabi", ekstra: [], vfx: "alevliGomlek" },   // 1G-B.1
};
const hexV = (h) => new THREE.Color(h);
/** Ton paletleri (nötr hücre × ton). */
export const TENLER = ["#F2C9A7", "#E0A97E", "#B77A52", "#7A4B31"].map(hexV);
export const SACLAR = ["#5B3A29", "#E0B070", "#221C1A", "#A5472A"].map(hexV);
export const USTLER = ["#F4701F", "#2FBF71", "#4A9DD9", "#EC4899", "#A855F7", "#FFB020", "#20A4A0", "#FFFFFF"].map(hexV);
export const ALTLAR = ["#3B5B8C", "#2B2B30", "#6B4A3A", "#3F6B4F", "#8A8C96"].map(hexV);
export const AYAKLAR = ["#2B2B30", "#FFFFFF", "#C8102E", "#6B3A1E"].map(hexV);
const NOTR = hexV("#FFFFFF");
const EGIM_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.14));   // 1G: gülümsemede baş eğimi (8°)
const HIZLAR = { Idle: 0, Walk: 1.4, Run: 4, Selam: 0 };   // VFX sanal hızı (klipten)
const SARK_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0));

// ---- TEK MALZEME CİLASI (Aşama 1C §5.1): bölge özniteliği → pürüzlülük/metalness tablosu + ekran emisyonu ----
// Sıra BOLGE kodlarıyla aynı (uret.mjs). muayene/muayene.js'te kopyası var — orada da güncelle.
export const PURUZ_TABLO = [0.55, 0.65, 0.65, 0.65, 1.0, 0.95, 0.45, 0.9, 0.95, 0.9, 0.35, 0.5, 0.2, 0.3, 0.3, 0.6, 0.15, 0.82, 0.9, 0.6, 0.85, 0.6, 0.9, 0.35, 0.22];
export const METAL_TABLO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0, 0.9];
const TEN_TEMEL = new THREE.Color("#F2C9A7");

export function atlasCilala(m) {
  if (!m || m.userData.cilali) return;
  m.userData.cilali = true;
  m.envMapIntensity = 0.35;
  m.customProgramCacheKey = () => "atlas-bolge-v4";
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float _bolge;\nvarying float vBolge;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBolge = _bolge;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vBolge;
const float PURUZ[25] = float[25](${PURUZ_TABLO.map((v) => v.toFixed(2)).join(", ")});
const float METAL[25] = float[25](${METAL_TABLO.map((v) => v.toFixed(2)).join(", ")});
float bolgeMetal(float b) { int i = int(clamp(b + 0.5, 0.0, 24.0)); return METAL[i]; }
const vec3 TEN_TEMEL = vec3(${TEN_TEMEL.r.toFixed(4)}, ${TEN_TEMEL.g.toFixed(4)}, ${TEN_TEMEL.b.toFixed(4)});
float bolgePuruz(float b) { int i = int(clamp(b + 0.5, 0.0, 24.0)); return PURUZ[i]; }`)
      // 1D §2.3: karakter COLOR_0 RGBA — rgb = AO × ton, a = AO. Göz/ağız yamasında (bölge 13–15) ten OLMAYAN piksel yalnız AO ile çarpılır.
      .replace("#include <color_fragment>", `
#if defined( USE_COLOR_ALPHA )
  vec3 tonK = vColor.rgb;
  #ifdef USE_MAP
  if (vBolge > 12.5 && vBolge < 15.5) { float k = smoothstep(0.03, 0.12, distance(sampledDiffuseColor.rgb, TEN_TEMEL)); tonK = mix(vColor.rgb, vec3(vColor.a), k); }
  #endif
  diffuseColor.rgb *= tonK;
#elif defined( USE_COLOR )
  diffuseColor.rgb *= vColor.rgb;
#endif`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = bolgePuruz(vBolge);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = max(metalnessFactor, bolgeMetal(vBolge));")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
if (vBolge > 11.5 && vBolge < 12.5) totalEmissiveRadiance += diffuseColor.rgb * 1.2;
if (vBolge > 12.5 && vBolge < 15.5 && diffuseColor.b > 0.5 && diffuseColor.r < 0.45) totalEmissiveRadiance += diffuseColor.rgb * 1.5;`);
  };
  m.needsUpdate = true;
}

/**
 * Sahne başına bir sistem. Yükle → kur → sahneye ekle → her karede `kare()` → işi bitince `sil()`.
 */
export class KarakterSistemi {
  /** @param {{ sahne: THREE.Scene, vfxAyar?: object, kok?: string }} o */
  constructor({ sahne, vfxAyar = {}, kok = VARLIK_KOK }) {
    this.sahne = sahne;
    this.kokYol = kok;
    this.turVeri = {};              // tur → { sahne, klipler, kozmetikler, mesh }
    this.mixerler = [];
    this.canlilar = new Set();      // göz kırpma + kare güncellemesi alan karakterler
    this.malzemeler = [];
    this.vfx = new VfxKit(sahne, vfxAyar);
    this.silinince = [];            // (kok) => void — pet vb. tüketici temizliği
    this.hazir = false;
  }

  cilala(kok) { kok.traverse((o) => { if (o.material) { atlasCilala(o.material); if (!this.malzemeler.includes(o.material)) this.malzemeler.push(o.material); } }); }

  /** Üç türün GLB'si (kozmetikler dahil). Bir kez çağrılır. */
  async yukle(yukleyici = new GLTFLoader()) {
    const gltflar = await Promise.all(TURLER.map((t) => yukleyici.loadAsync(this.kokYol + `karakter_${t}.glb`)));
    gltflar.forEach((g, i) => {
      const t = TURLER[i], kozmetikler = {};
      const grup = g.scene.getObjectByName("Kozmetikler");
      if (grup) { grup.parent.remove(grup); for (const m of grup.children) kozmetikler[m.name.replace("kozmetik_", "")] = m; }
      this.turVeri[t] = { sahne: g.scene, klipler: g.animations, kozmetikler, mesh: g.scene.getObjectByName("Govde") };
      this.cilala(g.scene); for (const m of Object.values(kozmetikler)) this.cilala(m);
    });
    this.hazir = true;
    return this;
  }

  /** Atlas hücre tablosu (UV dikdörtgenleri) — çevre/zemin/bina üretimi de aynı atlası kullanır. */
  get hucreler() { return this.turVeri.insan?.mesh?.userData?.hucreler ?? {}; }
  /** Karakter malzemesi (atlas dokulu, cilalı) — çevre de bunu paylaşır: tek doku, tek program. */
  get malzeme() { return this.turVeri.insan?.mesh?.material ?? null; }

  /** Yeni karakter kökü: türün GLB'sinden iskelet kopyası + klipler + mixer + kozmetik/kuyruk + görünüm + ifade. */
  kur(tur, g, kozmetikler = {}, { golge = true, kirpma = true } = {}) {
    const v = this.turVeri[tur] ?? this.turVeri.insan; if (!v) return null;
    const kok = iskeletKopyala(v.sahne);
    kok.userData = { ...kok.userData, tur: this.turVeri[tur] ? tur : "insan", klipler: v.klipler };
    kok.traverse((o) => { if (o.isMesh) { o.castShadow = golge && o.name === "Govde"; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(kok); kok.userData.mixer = mixer; this.mixerler.push(mixer);
    for (const ad of Object.keys(KOZMETIK)) kozmetikTak(this, kok, ad, !!kozmetikler[ad]);
    if (kok.userData.tur === "kaplan") kuyrukTak(this, kok);
    this.gorunum(kok, g); ifadeSec(kok, "normal");
    canliEkle(this.canlilar, kok);
    if (!kirpma) kok.userData.kirpmaYok = true;
    return kok;
  }

  kozmetik(kok, ad, ac) { kozmetikTak(this, kok, ad, ac); }
  ifade(kok, ad) { ifadeSec(kok, ad); }
  canliSil(kok) { canliSil(this.canlilar, kok); }

  klip(kok, ad, zaman = null, { gecis = 0 } = {}) {
    const c = kok.userData.klipler?.find((k) => k.name === ad); if (!c) return;
    const mixer = kok.userData.mixer;
    if (gecis > 0 && kok.userData.klipAd === ad) return;
    kok.userData.klipAd = ad;
    const a = mixer.clipAction(c);
    if (gecis > 0 && kok.userData.aksiyon && kok.userData.aksiyon !== a) {
      a.reset().play(); a.crossFadeFrom(kok.userData.aksiyon, gecis, false);
    } else {
      mixer.stopAllAction(); a.reset().play();
      a.time = zaman ?? Math.random() * c.duration;
      if (zaman !== null) mixer.update(0);
    }
    kok.userData.aksiyon = a;
  }

  /** Karakteri sahneden ve bütün alt sistemlerden çıkar. Geometri klonu (görünüm) bırakılır; paylaşılan malzeme bırakılmaz. */
  sil(kok) {
    if (!kok) return;
    kok.removeFromParent();
    canliSil(this.canlilar, kok);
    this.vfx.silGrup(kok);
    for (const f of this.silinince) { try { f(kok); } catch (e) { console.error("[Karakter] silme dinleyicisi:", e); } }
    const i = this.mixerler.indexOf(kok.userData.mixer); if (i >= 0) this.mixerler.splice(i, 1);
    kok.userData.mixer?.stopAllAction();
    const govde = kok.getObjectByName("Govde");
    if (govde?.userData.ozel) govde.geometry.dispose();
  }

  // ---- GÖRÜNÜM: köşe başına bölge → ton, hücre yeniden eşleme, varyant çökertme (klon başına geometri) ----
  gorunum(kok, g) {
    const mesh = kok.getObjectByName("Govde"); if (!mesh) return;
    const u = mesh.userData;
    if (!mesh.userData.ozel) {
      mesh.geometry = mesh.geometry.clone(); mesh.userData.ozel = true;
      const c3 = mesh.geometry.attributes.color;
      mesh.userData.temel = { pos: mesh.geometry.attributes.position.array.slice(), uv: mesh.geometry.attributes.uv.array.slice(), renk: c3?.array.slice() ?? null };
      // 1D §2.3: COLOR_0 → RGBA. rgb = AO × ton, a = AO (tonsuz)
      if (c3 && c3.itemSize === 3) {
        const n = c3.count, a4 = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { a4[i * 4] = c3.array[i * 3]; a4[i * 4 + 1] = c3.array[i * 3 + 1]; a4[i * 4 + 2] = c3.array[i * 3 + 2]; a4[i * 4 + 3] = c3.array[i * 3]; }
        mesh.geometry.setAttribute("color", new THREE.BufferAttribute(a4, 4));
      }
    }
    const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, renk = geo.attributes.color, bolge = geo.attributes._bolge;
    if (!bolge) return;
    const B = u.bolge, T = mesh.userData.temel, S = SETLER[g.set] ?? SETLER[1];
    const hucre = (ad) => u.hucreler[ad];
    const yeniden = (i, kaynakAd, hedefAd) => { const a = hucre(kaynakAd), b = hucre(hedefAd); if (!a || !b) return; const ou = T.uv[i * 2], ov = T.uv[i * 2 + 1]; const nu = (ou - a.u0) / (a.u1 - a.u0), nv = (ov - a.v0) / (a.v1 - a.v0); uv.setXY(i, b.u0 + (b.u1 - b.u0) * nu, b.v0 + (b.v1 - b.v0) * nv); };
    const sacIstenen = g.sac ?? 1;
    const bas = u.merkez.bas, gov = u.merkez.govde;
    const tint = (i, c) => { if (!renk) return; renk.setXYZ(i, T.renk[i * 3] * c.r, T.renk[i * 3 + 1] * c.g, T.renk[i * 3 + 2] * c.b); };
    const ten = g.ten ?? TENLER[0], sac = g.sacRenk ?? SACLAR[0], ust = g.ust ?? USTLER[0], alt = g.alt ?? ALTLAR[0], ayak = g.ayak ?? AYAKLAR[0];
    for (let i = 0; i < pos.count; i++) {
      const b = bolge.getX(i);
      pos.setXYZ(i, T.pos[i * 3], T.pos[i * 3 + 1], T.pos[i * 3 + 2]);
      uv.setXY(i, T.uv[i * 2], T.uv[i * 2 + 1]);
      let c = NOTR;
      if (u.gizliBolge?.includes(b)) pos.setXYZ(i, bas[0], bas[1], bas[2]);   // 1G-A.4 gizle politikası
      if (b === B.ten) c = ten;
      else if (b === B.sacKase || b === B.sacKisa || b === B.sacKuyruk) { c = sac; if (b !== B.sacKase + sacIstenen - 1) pos.setXYZ(i, bas[0], bas[1], bas[2]); }
      else if (b === B.ust) { c = ust; yeniden(i, u.temelHucre.ust, S.ust); if (g.set === 2) c = g.ceket ?? ALTLAR[1]; if (g.set === 4) c = NOTR; }
      else if (b === B.bilek) { c = g.set === 2 ? (g.ceket ?? ALTLAR[1]) : g.set === 4 ? NOTR : ust; yeniden(i, u.temelHucre.ust, S.ust); }
      else if (b === B.alt) { c = alt; yeniden(i, u.temelHucre.alt, S.alt); }
      else if (b === B.ayakkabi) { c = ayak; yeniden(i, u.temelHucre.ayakkabi, S.ayakkabi); }
      else if (b === B.taban) { c = g.set === 2 ? ALTLAR[2] : NOTR; }
      else if (b === B.ceket || b === B.yaka) { if (g.set !== 2) pos.setXYZ(i, gov[0], gov[1], gov[2]); c = b === B.ceket ? (g.ceket ?? ALTLAR[1]) : NOTR; }
      else if (b === B.kapuson) { if (g.set !== 3) pos.setXYZ(i, gov[0], gov[1], gov[2]); c = ust; }
      else if (b === B.kurk || b === B.turKulak) c = g.kurk ?? NOTR;
      else if (b === B.turAnten) c = g.metal ?? NOTR;
      else if (b === B.metal) c = g.metal ?? NOTR;
      else if (b === B.boya) {
        // 1D §4.4: robotta kıyafet seti = panel rengi/deseni: 1 düz üst rengi · 2 koyu metalik · 3 çizgili
        if (u.tur === "robot") { const temelB = u.temelHucre.boya ?? "gomlek"; c = g.set === 2 ? (g.ceket ?? ALTLAR[1]) : ust; yeniden(i, temelB, g.set === 2 ? "metal" : g.set === 3 ? "tente" : temelB); }
        else c = g.boya ?? NOTR;
      }
      else if (b === B.gozL || b === B.gozR || b === B.agiz) c = u.tur === "insan" ? ten : NOTR;
      tint(i, c);
    }
    pos.needsUpdate = true; uv.needsUpdate = true; if (renk) renk.needsUpdate = true;
    geo.computeBoundingSphere();
    kok.userData.gorunum = g;
    this.vfxEsle(kok);
  }

  /** 1G K3: karakterin VFX reçeteleri = kıyafet setinin vfx'i + kanat kozmetiği. Değişmişse grubunu sil, yeniden kur. */
  vfxEsle(kok) {
    const S = SETLER[kok.userData.gorunum?.set] ?? SETLER[1];
    const istenen = [S.vfx, kok.userData.kanatMesh ? "kanat" : null].filter(Boolean).join("+");
    if (kok.userData.vfxAdlar === istenen) return;
    this.vfx.silGrup(kok); kok.userData.vfxAdlar = istenen;
    for (const ad of istenen.split("+").filter(Boolean)) receteUygula(this.vfx, kok, ad);
  }

  /** Zıplama görseli (0,6 s parabol; alev dağılır). `zaman` = kare() zaman tabanı. */
  zipla(kok, zaman) { kok.userData.zipla = zaman; }

  /**
   * Her kare: animasyon, göz kırpma, gülümseme baş eğimi, kaplan kuyruğu, süzülme/zıplama görseli, VFX.
   * @param {{ dondur?: boolean, animasyon?: boolean }} o  dondur: poz sabit (ölçüm/siluet). animasyon=false: mixer'ları çağıran günceller.
   */
  kare(dt, zaman, kamera, { dondur = false, animasyon = true } = {}) {
    if (!dondur && animasyon) for (const m of this.mixerler) m.update(dt);
    if (!dondur) kirpmaGuncelle(this.canlilar, performance.now());
    const v = new THREE.Vector3();
    for (const c of this.canlilar) {
      const kok = c.kok, u = kok.userData;
      if (u.ifade?.agiz === "gulumseme") { const h = (u.headKemik ??= kok.getObjectByName("Head")); if (h) h.quaternion.multiply(EGIM_Q); }
      if (u.tur === "kaplan") { const k = (u.kuyrukMesh ??= kok.getObjectByName("kozmetik_kuyruk")); if (k) k.rotation.set(Math.sin(zaman * 2.1) * 0.12, Math.sin(zaman * 3.3) * 0.28, 0); }
      // 1G-B.2 SÜZÜLME (%100 kozmetik): kök sabit; ÇİZİLEN gövde yukarı ötelenir. Zıplama görseli de burada.
      const faz = (u.faz ??= Math.random() * 6.28);
      const zu = u.zipla != null ? (zaman - u.zipla) / 0.6 : 2; if (zu >= 1) u.zipla = null;
      const ziplaY = zu < 1 ? 1.8 * zu * (1 - zu) : 0;
      const hedefY = (u.suzulme ? 0.12 + Math.sin(zaman * 1.7 + faz) * 0.03 : 0) + ziplaY + (u.kaideY ?? 0);
      if (hedefY !== 0 || u.gorselY) {
        u.gorselY = (u.gorselY ?? 0) + (hedefY - (u.gorselY ?? 0)) * Math.min(1, dt * (zu < 1 ? 30 : 4));
        for (const ch of kok.children) { ch.userData.tabanY ??= ch.position.y; ch.position.y = ch.userData.tabanY + u.gorselY; }
      }
      if (u.kanatMesh) { u.kanatMesh.rotation.x = -0.06 + Math.sin(zaman * 1.7 + faz) * 0.1; u.kanatMesh.scale.x = 1 + Math.sin(zaman * 1.7 + faz + 1) * 0.04; }
      if (u.suzulme && !dondur) for (const ad of ["LeftUpLeg", "RightUpLeg"]) { const k = (u["k_" + ad] ??= kok.getObjectByName(ad)); if (k) k.quaternion.multiply(SARK_Q); }
      if (u.vfxAdlar) { const h = u.vfxHiz ?? HIZLAR[u.klipAd] ?? 0; const yon = u.yonKoku ?? kok; v.set(Math.sin(yon.rotation.y) * h, zu < 1 ? (1 - 2 * zu) * 3 : 0, Math.cos(yon.rotation.y) * h); for (const y of this.vfx.yayicilar) if (y.grup === kok) { y.hiz.copy(v); y.yogunluk = (y.temelYogun ??= y.yogunluk) * (zu < 1 ? 1.9 : 1); } }
    }
    this.vfx.guncelle(zaman, kamera);
  }
}
