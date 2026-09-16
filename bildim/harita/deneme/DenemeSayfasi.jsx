// ============================================================
// HARİTA YENİLEME — AŞAMA 1 / 1B / 1C TEST SAHNESİ  (/harita-deneme)
//
// Tek karakter + tek bina, STIL.md ışık kurulumunda, glTF'ten yüklenir.
// Aşama 1: GLB · Mixamo iskeletli animasyon · kozmetik yuvaları · 25 kopya.
// Aşama 1B: AO aç/kapa · atlas eski/yeni · çapa testi · 3 kamera · ışık A/B · çevre instancing · temas gölgesi.
// Aşama 1C: tür (insan/kaplan/robot) · kıyafet setleri + ton · saç · boyalı yüz + göz kırpma/ifade ·
//           bölge tabanlı pürüzlülük/emisyon (tek malzeme, onBeforeCompile) · sokak kedileri ·
//           yaprak A/B · ağaç boyu · ışık B/B+ · döşeli zemin.
// Oyun koduna dokunmaz; yalnız bu rota. Ölçüm için window.__deneme.
// ============================================================
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as iskeletKopyala } from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { VfxKit, receteUygula } from "./vfx.js";   // 1G K1/K3: tek paylaşılan VFX kiti
import { PetSistemi } from "./pet.js";               // 1G B.4: kedi · köpek · kuş (tür başına 1 InstancedMesh)
import "./deneme.css";

const KOK = "/meydan/deneme/";
const KLIPLER = ["Idle", "Walk", "Run", "Selam"];
const TURLER = ["insan", "kaplan", "robot"];
const KOZMETIK = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva", gozlukPremium: "gozlukYuva", kanat: "sirtYuva" };   // 1G: gozluk ↔ gozlukPremium karşılıklı dışlayıcı (aynı yuva)
// 1G K1 VFX ayarı — oyun_ayarlari'na taşınabilir. tamSayi: aynı anda TAM VFX alan oyuncu (kameraya en yakın) — §5.2 stres testinden; orta/uzak: LOD mesafeleri (m)
const VFX_AYAR = { kapasite: 1500, tamSayi: 6, ortaMesafe: 14, uzakMesafe: 28 };
const PETLER = ["kedi", "kopek", "kus"];
const PROPLAR = ["prop_agac_govde", "prop_agac_tac", "prop_lamba", "prop_bank", "prop_saksi", "bordur", "prop_kedi", "zemin_deneme"];
const CAPA_KARELERI = [["Idle", 0.6], ["Walk", 0.15], ["Walk", 0.5], ["Walk", 0.85], ["Run", 0.1], ["Run", 0.35], ["Run", 0.6], ["Selam", 0.9], ["Selam", 1.4]];
const KAMERALAR = {
  genis: { egim: 35, fov: 40, uzak: 30, yaw: 18, hedef: [0, 1.5, 0] },
  oyun: { egim: 22, fov: 48, uzak: 6.5, yaw: 10, hedef: [0, 1.3, 2] },
  foto: { egim: 8, fov: 32, uzak: 3.2, yaw: 25, hedef: [0, 1.25, 2] },
  capa: { egim: 6, fov: 46, uzak: 13, yaw: 0, hedef: [0, 1.0, 3.5] },
  vitrin: { egim: 4, fov: 30, uzak: 6.5, yaw: 25, hedef: [0, 1.05, 2] },   // 1G-C: karakter ekran yüksekliğinin ~%53'ü (ölçüldü: 7,4 m → %46,5)
};
// Kıyafet setleri: bölge → atlas hücresi (geometri paylaşılır; yalnız UV ve ton değişir) + set özel parçalar
const SETLER = {
  1: { ad: "Günlük", ust: "tisort", alt: "kot", ayakkabi: "ayakkabi", ekstra: [] },
  2: { ad: "Şık", ust: "ceket", alt: "kumasPantolon", ayakkabi: "deri", ekstra: ["ceket", "yaka"] },
  3: { ad: "Spor", ust: "esofman", alt: "esofman", ayakkabi: "ayakkabi", ekstra: ["kapuson"] },
  4: { ad: "Alev", ust: "alevKumas", alt: "kot", ayakkabi: "ayakkabi", ekstra: [], vfx: "alevliGomlek" },   // 1G-B.1: kor çatlaklı kömür kumaş + VFX reçetesi
};
const hexV = (h) => new THREE.Color(h);
// Ton paletleri (nötr hücre × ton). Ten, saç 4'er; kıyafet renkleri setlere göre
const TENLER = ["#F2C9A7", "#E0A97E", "#B77A52", "#7A4B31"].map(hexV);
const SACLAR = ["#5B3A29", "#E0B070", "#221C1A", "#A5472A"].map(hexV);
const USTLER = ["#F4701F", "#2FBF71", "#4A9DD9", "#EC4899", "#A855F7", "#FFB020", "#20A4A0", "#FFFFFF"].map(hexV);
const ALTLAR = ["#3B5B8C", "#2B2B30", "#6B4A3A", "#3F6B4F", "#8A8C96"].map(hexV);
const AYAKLAR = ["#2B2B30", "#FFFFFF", "#C8102E", "#6B3A1E"].map(hexV);
const NOTR = hexV("#FFFFFF");
const EGIM_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.14));   // 1G: gülümsemede baş eğimi (8°)
// Bölge → pürüzlülük (Aşama 1C §5.1; shader'da tablo). Sıra BOLGE kodlarıyla aynı (0..21; 21 = plastik, 1D)
const PURUZ_TABLO = [0.55, 0.65, 0.65, 0.65, 1.0, 0.95, 0.45, 0.9, 0.95, 0.9, 0.35, 0.5, 0.2, 0.3, 0.3, 0.6, 0.15, 0.82, 0.9, 0.6, 0.85, 0.6, 0.9, 0.35, 0.22];
// Bölge → metalness (1G-B.3 malzeme ayrımı): 16 cam 0,45 (aynalı) · 24 premiumMetal 0,9 (altın çerçeve). Robot 'metal' (10) 0 KALIR — 1D görünümü korunur.
const METAL_TABLO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0, 0.9];   // 22 turKulak (kürk) · 23 turAnten (metal) — 1G
// Yüz hücrelerinin zemin ten rengi (atlas.mjs TEN) — doğrusal uzayda; shader göz/ağız yamasında "ten olan piksel"i bununla ayırır (1D §2.3)
const TEN_TEMEL = new THREE.Color("#F2C9A7");   // three r152+: hex → çalışma uzayı (doğrusal) otomatik; ek convertSRGBToLinear ÇİFT dönüşüm olurdu (ilk denemede yama tamamen tonsuz kaldı)

export default function DenemeSayfasi() {
  const kapRef = useRef(null);
  const apiRef = useRef(null);
  const [durum, setDurum] = useState({ hazir: false, hata: null });
  const [olc, setOlc] = useState({ cagri: 0, ucgen: 0, fps: 0, ms: 0, kopya: 1 });
  // Aşama 1E §0.2: CPU+GPU (gl.finish) sürekli ölçülmez — düğmeyle istenir; HUD'da ölçüm anıyla durur
  const [kareOlcum, setKareOlcum] = useState(null);   // { cpuGpu, cpuGpuP95, gpu, zaman }
  const [klip, setKlip] = useState("Idle");
  const [koz, setKoz] = useState({ sapka: true, gozluk: true, atki: true, gozlukPremium: false, kanat: false });
  const [pet, setPet] = useState(null);           // 1G-B.4: esas karakterin peti
  const [vitrin, setVitrin] = useState(false);    // 1G-C: mağaza vitrini
  const [kalabalik, setKalabalik] = useState(false);
  const [golge, setGolge] = useState(true);
  const [ao, setAo] = useState(true);
  const [atlasMod, setAtlasMod] = useState("yeni");      // yeni | eski | yaprakEski
  const [capa, setCapa] = useState(false);
  const [siluet, setSiluet] = useState(false);          // 1D §4 siyah siluet testi
  const [tacVekili, setTacVekili] = useState(true);     // 1D Bölüm D: taç gölgesi vekili A/B
  const [cevre, setCevre] = useState(true);
  const [isik, setIsik] = useState("B+");                 // A | B | B+
  const [kamera, setKamera] = useState("genis");
  const [tur, setTur] = useState("insan");
  const [set, setSet] = useState(1);
  const [kediler, setKediler] = useState(true);
  const [ifade, setIfade] = useState("normal");           // normal | gulumseme | saskin
  const [agacKucuk, setAgacKucuk] = useState(true);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;
    let iptal = false;
    let W = kap.clientWidth || innerWidth, H = kap.clientHeight || innerHeight;

    // ---- render + ışık ----
    const render = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    render.setSize(W, H);
    render.shadowMap.enabled = true;
    render.shadowMap.type = THREE.PCFShadowMap;
    render.toneMapping = THREE.ACESFilmicToneMapping;
    render.toneMappingExposure = 1.08;
    kap.appendChild(render.domElement);
    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color(0xbfe8ff);
    sahne.fog = new THREE.Fog(0xcdeeff, 70, 190);
    try { const pmrem = new THREE.PMREMGenerator(render); sahne.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); } catch (e) { console.error("[Deneme] ortam haritası:", e); }
    const gok = new THREE.HemisphereLight(0xeaf7ff, 0xd9c9a8, 0.95 * Math.PI); sahne.add(gok);
    const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
    gunes.castShadow = true; gunes.shadow.mapSize.set(2048, 2048);
    Object.assign(gunes.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 160 });
    gunes.shadow.bias = -0.0012; sahne.add(gunes);
    /** A = Aşama 1 · B = Aşama 1B (1,15π / 0,45π, radius 4, pozlama 1,12) · B+ = Aşama 1C §7 (güneş +12 %, gök −10 %, radius 3, pozlama 1,08). */
    const isikAyarla = (mod) => {
      if (mod === "A") {
        gunes.position.set(28, 46, 20); gunes.intensity = 1.05 * Math.PI; gok.intensity = 0.95 * Math.PI; gok.groundColor.set(0xd9c9a8);
        render.shadowMap.type = THREE.PCFSoftShadowMap; gunes.shadow.radius = 1; sahne.environmentIntensity = 0; render.toneMappingExposure = 1.0;
      } else {
        const el = THREE.MathUtils.degToRad(42), az = THREE.MathUtils.degToRad(40);
        gunes.position.set(Math.sin(az) * Math.cos(el) * 70, Math.sin(el) * 70, Math.cos(az) * Math.cos(el) * 70);
        gok.groundColor.set(0xe8dfcb); sahne.environmentIntensity = 0.25; render.shadowMap.type = THREE.PCFShadowMap;
        if (mod === "B") { gunes.intensity = 1.15 * Math.PI; gok.intensity = 0.45 * Math.PI; gunes.shadow.radius = 4; render.toneMappingExposure = 1.12; }
        else { gunes.intensity = 1.29 * Math.PI; gok.intensity = 0.405 * Math.PI; gunes.shadow.radius = 3; render.toneMappingExposure = 1.08; }
      }
      render.shadowMap.needsUpdate = true;
      sahne.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    };
    const kam = new THREE.PerspectiveCamera(40, W / H, 0.3, 300);
    const kontrol = new OrbitControls(kam, render.domElement);
    kontrol.maxPolarAngle = Math.PI * 0.49; kontrol.minDistance = 0.5; kontrol.maxDistance = 60;   // 0,5: yüz yakın çekimi (1D kabul ölçütü)
    const kameraAyarla = (ad) => {
      const k = KAMERALAR[ad] ?? KAMERALAR.genis;
      const e = THREE.MathUtils.degToRad(k.egim), yaw = THREE.MathUtils.degToRad(k.yaw);
      kontrol.target.set(...k.hedef);
      kam.position.set(k.hedef[0] + Math.sin(yaw) * Math.cos(e) * k.uzak, k.hedef[1] + Math.sin(e) * k.uzak, k.hedef[2] + Math.cos(yaw) * Math.cos(e) * k.uzak);
      kam.fov = k.fov; kam.updateProjectionMatrix(); kontrol.update();
    };
    kameraAyarla("genis");

    // ---- TEK MALZEME CİLASI (Aşama 1C §5.1): bölge özniteliği → pürüzlülük tablosu + ekran emisyonu ----
    const cilala = (m) => {
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
          // 1D §2.3: karakter COLOR_0 RGBA — rgb = AO × ton, a = AO. Göz/ağız yamasında (bölge 13–15) ten OLMAYAN piksel
          // (göz akı, iris, dudak) yalnız AO ile çarpılır; ten pikseli kafayla aynı tonu alır → yama kenarı görünmez. Şeffaflık yok.
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
if (vBolge > 12.5 && vBolge < 15.5 && diffuseColor.b > 0.5 && diffuseColor.r < 0.45) totalEmissiveRadiance += diffuseColor.rgb * 1.5;   // robot siyan göz/ağız`);
      };
      m.needsUpdate = true;
    };

    const yukleyici = new GLTFLoader();
    const dokuYukleyici = new THREE.TextureLoader();
    const mixerler = [];
    const turVeri = {};                       // tur → { sahne, klipler, kozmetikler, mesh }
    let esas = null, kopyalar = [], capaGrubu = null, binaMesh = null, propMesh = {};
    let dokular = { yeni: null, eski: null, yaprakEski: null };
    const malzemeler = [];
    const saat = new THREE.Clock();
    let dondur = false;
    const durumu = { tur: "insan", set: 1, koz: { sapka: true, gozluk: true, atki: true, gozlukPremium: false, kanat: false }, klip: "Idle", ifade: "normal" };

    const malzemeTopla = (kok) => { kok.traverse((o) => { if (o.material) { cilala(o.material); if (!malzemeler.includes(o.material)) malzemeler.push(o.material); } }); };

    // ---- GÖRÜNÜM: köşe başına bölge → ton, hücre yeniden eşleme, varyant çökertme (klon başına geometri) ----
    const gorunumUygula = (kok, g) => {
      const mesh = kok.getObjectByName("Govde"); if (!mesh) return;
      const u = mesh.userData;
      if (!mesh.userData.ozel) {
        mesh.geometry = mesh.geometry.clone(); mesh.userData.ozel = true;
        const c3 = mesh.geometry.attributes.color;
        mesh.userData.temel = { pos: mesh.geometry.attributes.position.array.slice(), uv: mesh.geometry.attributes.uv.array.slice(), renk: c3?.array.slice() ?? null };
        // 1D §2.3: COLOR_0 → RGBA. rgb = AO × ton, a = AO (tonsuz); shader göz/ağız yamasında ten olmayan pikseli yalnız AO ile çarpar.
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
        if (u.gizliBolge?.includes(b)) pos.setXYZ(i, bas[0], bas[1], bas[2]);   // 1G-A.4 gizle politikası: tür parçası çökertilir
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
          // 1D §4.4: robotta kıyafet seti = panel rengi/deseni (kumaş değil): 1 düz üst rengi · 2 koyu metalik · 3 çizgili
          if (u.tur === "robot") { const temelB = u.temelHucre.boya ?? "gomlek"; c = g.set === 2 ? (g.ceket ?? ALTLAR[1]) : ust; yeniden(i, temelB, g.set === 2 ? "metal" : g.set === 3 ? "tente" : temelB); }
          else c = g.boya ?? NOTR;
        }
        else if (b === B.gozL || b === B.gozR || b === B.agiz) c = u.tur === "insan" ? ten : NOTR;   // 1D: yama zemini kafayla aynı ton (shader ten olmayan pikseli ayırır)
        tint(i, c);
      }
      pos.needsUpdate = true; uv.needsUpdate = true; if (renk) renk.needsUpdate = true;
      geo.computeBoundingSphere();
      kok.userData.gorunum = g;
      vfxEsle(kok);
    };
    /** 1G K3: karakterin VFX reçeteleri = kıyafet setinin vfx'i + kanat kozmetiği. Değişmişse grubunu sil, yeniden kur. */
    const vfxEsle = (kok) => {
      const S = SETLER[kok.userData.gorunum?.set] ?? SETLER[1];
      const istenen = [S.vfx, kok.userData.kanatMesh ? "kanat" : null].filter(Boolean).join("+");
      if (kok.userData.vfxAdlar === istenen) return;
      vfxKit.silGrup(kok); kok.userData.vfxAdlar = istenen;
      for (const ad of istenen.split("+").filter(Boolean)) receteUygula(vfxKit, kok, ad);
    };
    /** İfade: göz/ağız dörtgenlerinin UV'sini ifade karesine kaydır (geometri zaten klon başına). */
    const ifadeAyarla = (kok, gozAd, agizAd) => {
      const mesh = kok.getObjectByName("Govde"); if (!mesh?.userData.ozel) return;
      const u = mesh.userData, geo = mesh.geometry, uv = geo.attributes.uv, bolge = geo.attributes._bolge, T = mesh.userData.temel;
      const K = u.ifade.kareler, robot = u.tur === "robot";
      const gozNo = u.ifade.goz[robot ? (gozAd === "kirpik" || gozAd === "mutlu" ? "robotKapali" : "robotAcik") : gozAd] ?? u.ifade.temelGoz;
      const agizNo = u.ifade.agiz[robot ? (agizAd === "gulumseme" || agizAd === "sirit" ? "robotGulus" : "robotNotr") : agizAd] ?? u.ifade.temelAgiz;
      const tasi = (i, kaynakNo, hedefNo) => { const a = K[kaynakNo], b = K[hedefNo]; const ou = T.uv[i * 2], ov = T.uv[i * 2 + 1]; const nu = (ou - a.u0) / (a.u1 - a.u0), nv = (ov - a.v0) / (a.v1 - a.v0); uv.setXY(i, b.u0 + (b.u1 - b.u0) * nu, b.v0 + (b.v1 - b.v0) * nv); };
      for (let i = 0; i < uv.count; i++) {
        const b = bolge.getX(i);
        if (b === u.bolge.gozL || b === u.bolge.gozR) tasi(i, u.ifade.temelGoz, gozNo);
        else if (b === u.bolge.agiz) tasi(i, u.ifade.temelAgiz, agizNo);
      }
      uv.needsUpdate = true;
      kok.userData.ifade = { goz: gozAd, agiz: agizAd };
    };
    // Göz kırpma: her karakter kendi zamanlayıcısıyla, 120 ms
    const canlilar = new Set();   // { kok, sonraki, kapali }
    const canliEkle = (kok) => { const c = { kok, sonraki: performance.now() + 1500 + Math.random() * 3500, kapali: 0 }; canlilar.add(c); kok.userData.canli = c; };
    const canliSil = (kok) => { if (kok.userData.canli) canlilar.delete(kok.userData.canli); };
    const kirpmaGuncelle = (t) => {
      for (const c of canlilar) {
        if (!c.kok.parent) { canlilar.delete(c); continue; }
        const g = c.kok.userData.ifade ?? { goz: "acik", agiz: "notr" };
        if (c.kapali && t > c.kapali) { c.kapali = 0; ifadeAyarla(c.kok, c.kok.userData.temelGoz ?? "acik", g.agiz); c.sonraki = t + 3000 + Math.random() * 3000; }
        else if (!c.kapali && t > c.sonraki) { c.kapali = t + 120; ifadeAyarla(c.kok, "kirpik", g.agiz); }
      }
    };
    const ifadeSec = (kok, ad) => {
      const [goz, agiz] = ad === "gulumseme" ? ["mutlu", "gulumseme"] : ad === "saskin" ? ["saskin", "saskin"] : ["acik", "notr"];
      kok.userData.temelGoz = goz; ifadeAyarla(kok, goz, agiz);
    };

    const kozmetikTak = (kok, ad, ac) => {
      const yuva = kok.getObjectByName(KOZMETIK[ad]); if (!yuva) return;
      if (ac && ad === "gozluk") kozmetikTak(kok, "gozlukPremium", false);   // 1G-B.3: aynı yuva, karşılıklı dışlayıcı
      if (ac && ad === "gozlukPremium") kozmetikTak(kok, "gozluk", false);
      // 1D §4.4: türün kendi varyantı varsa o (robot: anten halkalı şapka, vizör); yoksa insanınki (atkı)
      const kaynak = turVeri[kok.userData.tur]?.kozmetikler[ad] ?? turVeri.insan?.kozmetikler[ad];
      const eski = yuva.getObjectByName("kozmetik_" + ad);
      if (eski && !ac) yuva.remove(eski);
      if (!eski && ac && kaynak) { const m = kaynak.clone(); m.castShadow = false; yuva.add(m); sozlesmeUygula(kok, m); }
      if (ad === "kanat") { kok.userData.kanatMesh = ac ? yuva.getObjectByName("kozmetik_kanat") : null; kok.userData.suzulme = ac; if (kok.userData.gorunum) vfxEsle(kok); }   // 1G-B.2: süzülme + parıltı
    };
    /**
     * 1G-A.4 TÜR–KOZMETİK SÖZLEŞMESİ (çalışma anı): kozmetik hacmi ∩ tür dışlama hacmi → politika.
     *   gecir: hiçbir şey · gizle: tür parçasını çökert (bolge turKulak/turAnten) · bicimlendir: ölçek/kaydırma · it: +Z'ye öteleme
     * Tür: Govde.userData.dislama (küre listesi, bind uzayı). Kozmetik: userData.politika (uret.mjs POLITIKA). Yeni kozmetik = tek satır politika.
     */
    const sozlesmeUygula = (kok, m) => {
      const govde = kok.getObjectByName("Govde"), dislama = govde?.userData?.dislama ?? {}, politika = m.userData?.politika ?? {};
      if (!Object.keys(dislama).length || !Object.keys(politika).length) return;
      kok.updateMatrixWorld(true);
      const kutu = new THREE.Box3().setFromObject(m);
      for (const [k, kureler] of Object.entries(dislama)) {
        const p = politika[k]; if (!p) continue;
        const kesisir = kureler.some((q) => kutu.distanceToPoint(new THREE.Vector3(...q.merkez).applyMatrix4(kok.matrixWorld)) <= q.r);
        if (!kesisir) continue;
        const tip = typeof p === "string" ? p : p.tip;
        if (tip === "gizle") { const hedef = kureler[0]?.bolge; if (hedef != null) { govde.userData.gizliBolge = [...(govde.userData.gizliBolge ?? []), hedef]; gorunumUygula(kok, kok.userData.gorunum ?? { set: 1, sac: 1 }); } }
        else if (tip === "bicimlendir") { if (p.olcek) m.scale.set(...p.olcek); if (p.kaydir) m.position.add(new THREE.Vector3(...p.kaydir)); }
        else if (tip === "it") m.position.z += p.mesafe ?? 0.03;
        m.userData.uygulanan = { ...(m.userData.uygulanan ?? {}), [k]: tip };
      }
    };
    const kuyrukTak = (kok) => {
      const yuva = kok.getObjectByName("sirtYuva"), kaynak = turVeri.kaplan?.kozmetikler.kuyruk;
      if (!yuva || !kaynak || yuva.getObjectByName("kozmetik_kuyruk")) return;
      const m = kaynak.clone(); m.castShadow = false; yuva.add(m);
    };
    const klipOynat = (kok, ad, mixer, zaman = null) => {
      const c = kok.userData.klipler?.find((k) => k.name === ad); if (!c) return;
      kok.userData.klipAd = ad;   // 1G-B.1: alev sanal hızı klipten türetilir (Idle 0 · Walk 1,4 · Run 4 m/s)
      mixer.stopAllAction();
      const a = mixer.clipAction(c); a.reset().play();
      a.time = zaman ?? Math.random() * c.duration;
      if (zaman !== null) mixer.update(0);
    };
    /** Yeni karakter kökü: türün GLB'sinden iskelet kopyası + klipler + mixer + kozmetik/kuyruk + görünüm + ifade. */
    const karakterYap = (tur, g, kozmetikler) => {
      const v = turVeri[tur]; if (!v) return null;
      const kok = iskeletKopyala(v.sahne);
      kok.userData = { ...kok.userData, tur, klipler: v.klipler };
      kok.traverse((o) => { if (o.isMesh) { o.castShadow = o.name === "Govde"; o.frustumCulled = false; } });
      const mixer = new THREE.AnimationMixer(kok); kok.userData.mixer = mixer; mixerler.push(mixer);
      for (const ad of Object.keys(KOZMETIK)) kozmetikTak(kok, ad, !!kozmetikler[ad]);
      if (tur === "kaplan") kuyrukTak(kok);
      gorunumUygula(kok, g); ifadeSec(kok, "normal"); canliEkle(kok);
      return kok;
    };
    const karakterSil = (kok) => { sahne.remove(kok); canliSil(kok); vfxKit.silGrup(kok); petSistemi?.kaldir(kok); const i = mixerler.indexOf(kok.userData.mixer); if (i >= 0) mixerler.splice(i, 1); kok.userData.mixer?.stopAllAction(); const j = temasHedefler.findIndex((h) => h.nesne === kok); if (j >= 0) temasHedefler.splice(j, 1); };

    // ---- zemin temas gölgeleri ----
    const temasDoku = dokuYukleyici.load(KOK + "temas.png");
    const temas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: temasDoku, transparent: true, depthWrite: false, opacity: 0.55 }), 200);
    temas.count = 0; temas.frustumCulled = false; temas.renderOrder = 1; sahne.add(temas);
    const temasHedefler = [];
    // ---- 1G K1: TEK paylaşılan VFX kiti (bütün karakterlerin bütün efektleri tek InstancedMesh + tek ShaderMaterial) ----
    const vfxKit = new VfxKit(sahne, VFX_AYAR);
    let petSistemi = null;
    /**
     * 1G-B.2 SÜZÜLME (%100 kozmetik): oyunculuk koordinatı (kök) değişmez; ÇİZİLEN gövde birkaç cm yukarı ötelenir (kökün çocukları),
     * kanat çırpar, bacaklar hafif sarkar. Temas gölgesi kökten okunur → zeminde kalır. Kamera hedefi kök → değişmez.
     */
    const HIZLAR = { Idle: 0, Walk: 1.4, Run: 4, Selam: 0 };
    const SARK_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0));
    const hareketGuncelle = (dt, zaman) => {
      const v = new THREE.Vector3();
      for (const c of canlilar) {
        const kok = c.kok, u = kok.userData, faz = (u.faz ??= Math.random() * 6.28);
        // zıplama (görsel): 0,6 s parabol, tepe 0,45 m; alev dağılır (yoğunluk + dikey hız)
        const zu = u.zipla != null ? (zaman - u.zipla) / 0.6 : 2; if (zu >= 1) u.zipla = null;
        const ziplaY = zu < 1 ? 1.8 * zu * (1 - zu) : 0;
        const hedefY = (u.suzulme ? 0.12 + Math.sin(zaman * 1.7 + faz) * 0.03 : 0) + ziplaY + (u.kaideY ?? 0);
        u.gorselY = (u.gorselY ?? 0) + (hedefY - (u.gorselY ?? 0)) * Math.min(1, dt * (zu < 1 ? 30 : 4));
        for (const ch of kok.children) { ch.userData.tabanY ??= ch.position.y; ch.position.y = ch.userData.tabanY + u.gorselY; }
        if (u.kanatMesh) { u.kanatMesh.rotation.x = -0.06 + Math.sin(zaman * 1.7 + faz) * 0.1; u.kanatMesh.scale.x = 1 + Math.sin(zaman * 1.7 + faz + 1) * 0.04; }
        if (u.suzulme && !dondur) for (const ad of ["LeftUpLeg", "RightUpLeg"]) { const k = (u["k_" + ad] ??= kok.getObjectByName(ad)); if (k) k.quaternion.multiply(SARK_Q); }
        // VFX sanal hızı: klipten (kök +Z öne) + zıplama dikeyi
        if (u.vfxAdlar) { const h = HIZLAR[u.klipAd] ?? 0; v.set(Math.sin(kok.rotation.y) * h, zu < 1 ? (1 - 2 * zu) * 3 : 0, Math.cos(kok.rotation.y) * h); for (const y of vfxKit.yayicilar) if (y.grup === kok) { y.hiz.copy(v); y.yogunluk = (y.temelYogun ??= y.yogunluk) * (zu < 1 ? 1.9 : 1); } }
      }
    };
    // ---- 1G-C MAĞAZA VİTRİNİ: çevre/bina/kediler gizli, stüdyo fonu, kaide, arka ışık, karakter ekranın ~%50'si, otomatik döner. Fotoğraf stüdyosuyla aynı sahne. ----
    let vitrinDurum = null;
    const vitrinAyarla = (ac) => {
      if (!esas) return;
      const zemin = sahne.getObjectByName("zemin"), yazi = sahne.getObjectByName("tabelaYazi");
      if (ac && !vitrinDurum) {
        vitrinDurum = { bg: sahne.background, fog: sahne.fog, cevre: cevreGrubu.visible, kedi: kediMesh?.visible, bina: binaMesh?.visible, zemin: zemin?.visible, yazi: yazi?.visible, esasPoz: esas.position.clone(), esasDon: esas.rotation.y, kopya: kopyalar.length, minD: kontrol.minDistance };
        kopyaAyarla(0);
        sahne.background = new THREE.Color(0x1b2233); sahne.fog = null;
        cevreGrubu.visible = false; if (kediMesh) kediMesh.visible = false; if (binaMesh) binaMesh.visible = false; if (zemin) zemin.visible = false; if (yazi) yazi.visible = false;
        esas.position.set(0, 0, 2); esas.rotation.y = 0;
        // kaide: atlas malzemesi (yeni malzeme YOK) — 'metal' hücresi + premiumMetal bölgesi (parlak)
        const govde = esas.getObjectByName("Govde"), r = govde.userData.hucreler.metal;
        const kg = new THREE.CylinderGeometry(1.15, 1.25, 0.12, 40); const n = kg.attributes.position.count;
        for (let i = 0; i < n; i++) kg.attributes.uv.setXY(i, (r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
        kg.setAttribute("_bolge", new THREE.BufferAttribute(new Float32Array(n).fill(24), 1)); kg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.9), 3));
        const kaide = new THREE.Mesh(kg, govde.material); kaide.name = "vitrinKaide"; kaide.position.set(0, 0.06, 2); kaide.receiveShadow = true; sahne.add(kaide);
        const arka = new THREE.DirectionalLight(0x9fd8ff, 2.2); arka.position.set(-3, 4, -2); arka.target = esas; arka.name = "vitrinArka"; sahne.add(arka);
        vitrinDurum.kaide = kaide; vitrinDurum.arka = arka;
        for (const ch of esas.children) ch.userData.tabanY = (ch.userData.tabanY ?? ch.position.y);   // kaide üstü: görsel taban +0,12
        esas.userData.kaideY = 0.12;
        kameraAyarla("vitrin"); kontrol.autoRotate = true; kontrol.autoRotateSpeed = 1.2; kontrol.enablePan = false; kontrol.minDistance = 2;
      } else if (!ac && vitrinDurum) {
        const d = vitrinDurum; vitrinDurum = null;
        sahne.remove(d.kaide); d.kaide.geometry.dispose(); sahne.remove(d.arka);
        sahne.background = d.bg; sahne.fog = d.fog; cevreGrubu.visible = d.cevre; if (kediMesh) kediMesh.visible = d.kedi; if (binaMesh) binaMesh.visible = d.bina; if (zemin) zemin.visible = d.zemin; if (yazi) yazi.visible = d.yazi;
        esas.position.copy(d.esasPoz); esas.rotation.y = d.esasDon; esas.userData.kaideY = 0;
        kontrol.autoRotate = false; kontrol.enablePan = true; kontrol.minDistance = d.minD;
        kopyaAyarla(d.kopya); kameraAyarla("genis");
      }
    };
    const tM = new THREE.Matrix4(), tP = new THREE.Vector3(), tQ = new THREE.Quaternion(), tS = new THREE.Vector3();
    const temasGuncelle = () => {
      let i = 0;
      for (const h of temasHedefler) { if (!h.nesne.visible || !h.nesne.parent || h.nesne.parent.visible === false || i >= 200) continue; /* 1G: gizli çevre/kedi/pet gölge bırakmaz (vitrin) */ h.nesne.getWorldPosition(tP); tP.y = 0.02; tM.compose(tP, tQ, tS.set(h.r, 1, h.r)); temas.setMatrixAt(i++, tM); }
      temas.count = i; temas.instanceMatrix.needsUpdate = true;
    };

    // ---- çevre (instancing) + sokak kedileri ----
    const cevreGrubu = new THREE.Group(); cevreGrubu.name = "Cevre"; sahne.add(cevreGrubu);
    let agacOlcek = 0.7, tacVekiliAcik = true;
    const tacVekilGeo = new THREE.SphereGeometry(1.55, 7, 5).scale(1.1, 1, 1.1).translate(0, 5.0, 0);   // taç zarfı: y 3,45–6,55, ±1,7 m
    const yerlesim = () => {
      const agac = [], lamba = [], bank = [], saksi = [];
      // Ağaçlar kaldırımın DIŞ hattında (yola/meydana değil): z = 0.6 (bina hattı) ve 11.4
      for (let x = -36; x <= 36; x += 6) { if (Math.abs(x) > 6.5) agac.push([x, 0, 0.6, 0.9 + (Math.abs(x) % 3) * 0.08]); agac.push([x + 3, 0, 11.4, 0.85 + (Math.abs(x) % 3) * 0.1]); }
      agac.push([-39, 0, 11.4, 0.95]);
      for (let x = -33; x <= 33; x += 12) { lamba.push([x, 0, 1.4, 0]); lamba.push([x + 6, 0, 10.6, Math.PI]); }
      for (let x = -30; x <= 30; x += 12) { if (Math.abs(x) > 6) bank.push([x, 0, 1.6, 0]); bank.push([x + 6, 0, 10.4, Math.PI]); }
      for (let x = -33; x <= 33; x += 6) { saksi.push([x + 1.5, 0, 1.0, 0.8 + (Math.abs(x) % 2) * 0.35]); saksi.push([x - 1.5, 0, 11.0, 0.9]); }
      return { agac: agac.slice(0, 24), lamba: lamba.slice(0, 12), bank: bank.slice(0, 10), saksi: saksi.slice(0, 16) };
    };
    const cevreKur = () => {
      cevreGrubu.clear(); temasHedefler.splice(0, temasHedefler.length, ...temasHedefler.filter((h) => !h.cevre));
      const Yl = yerlesim(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      const kur = (ad, liste, olcekli = false, donerek = false, temasR = 1, carpan = 1) => {
        const kaynak = propMesh[ad]; if (!kaynak) return;
        const im = new THREE.InstancedMesh(kaynak.geometry, kaynak.material, liste.length);
        liste.forEach(([x, y, z, k], i) => {
          const olc = (olcekli ? k : 1) * carpan;
          q.setFromEuler(new THREE.Euler(0, donerek ? k : (i * 0.7) % (Math.PI * 2), 0));
          M.compose(p.set(x, y, z), q, s.set(olc, olc, olc)); im.setMatrixAt(i, M);
          if (temasR > 0) temasHedefler.push({ cevre: true, nesne: { visible: true, parent: cevreGrubu, getWorldPosition: (v) => v.set(x, 0, z) }, r: temasR * olc });
        });
        im.castShadow = /agac/.test(ad); im.receiveShadow = true; im.name = ad; cevreGrubu.add(im);
      };
      kur("prop_agac_govde", Yl.agac, true, false, 1.6, agacOlcek); kur("prop_agac_tac", Yl.agac, true, false, 0, agacOlcek);
      // 1D Bölüm D.2-1: taç gölgesini gerçek çok loblu taç değil, düşük poligonlu KÜRE VEKİLİ atar (56 üçgen/ağaç, taç 470).
      // Vekil yalnız gölge geçişinde "görünür": three gölge haritasını hedefe çizerken getRenderTarget() ≠ null, ana geçişte null.
      // Ana geçiş listesine hiç girmez → ek çizim çağrısı yok; taç kendi gölgesini atmaz. Gölge zaten bulanık (radius 3), fark yok.
      const tac = cevreGrubu.getObjectByName("prop_agac_tac");
      if (tac && tacVekiliAcik) {
        tac.castShadow = false;
        const vekil = new THREE.InstancedMesh(tacVekilGeo, tac.material, tac.count);
        vekil.instanceMatrix.copyArray(tac.instanceMatrix.array); vekil.instanceMatrix.needsUpdate = true;
        vekil.castShadow = true; vekil.receiveShadow = false; vekil.name = "prop_agac_tac_golge";
        Object.defineProperty(vekil, "visible", { get: () => render.getRenderTarget() !== null, set() {}, configurable: true });
        cevreGrubu.add(vekil);
      }
      kur("prop_lamba", Yl.lamba, false, true, 0.8); kur("prop_bank", Yl.bank, false, true, 2.2); kur("prop_saksi", Yl.saksi, true, false, 1.1);
      if (propMesh.bordur) { const b = propMesh.bordur.clone(); b.name = "bordur"; b.receiveShadow = true; b.castShadow = false; cevreGrubu.add(b); }
      temasGuncelle();
    };
    // Kediler: tek InstancedMesh (3), yerel deterministik dolaşma (yürü → dur → otur → yat), ağ yok
    let kediMesh = null;
    const kediDurum = [];
    const kediKur = () => {
      const kaynak = propMesh.prop_kedi; if (!kaynak) return;
      kediMesh = new THREE.InstancedMesh(kaynak.geometry, kaynak.material, 3);
      kediMesh.castShadow = false; kediMesh.name = "kediler"; kediMesh.frustumCulled = false;
      const renkler = [new THREE.Color(0xd08a45), new THREE.Color(0x8a8a90), new THREE.Color(0x3a3230)];   // tekir · gri · siyahımsı
      let tohum = 7;
      const rnd = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };
      for (let i = 0; i < 3; i++) {
        kediMesh.setColorAt(i, renkler[i]);
        kediDurum.push({ x: -20 + i * 14, z: 1.1 + rnd() * 0.6, yon: rnd() * Math.PI * 2, hal: "yuru", sure: 2 + rnd() * 3, rnd, faz: rnd() * 6 });
      }
      kediMesh.instanceColor.needsUpdate = true; sahne.add(kediMesh);
      for (let i = 0; i < 3; i++) temasHedefler.push({ nesne: { visible: true, parent: kediMesh, getWorldPosition: (v) => { const k = kediDurum[i]; return v.set(k.x, 0, k.z); } }, r: 0.5 });
    };
    const kediGuncelle = (dt, t) => {
      if (!kediMesh || !kediMesh.visible) return;
      const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
      kediDurum.forEach((k, i) => {
        k.sure -= dt;
        if (k.sure <= 0) {
          const sira = { yuru: "dur", dur: "otur", otur: "yat", yat: "yuru" };
          k.hal = sira[k.hal]; k.sure = k.hal === "yuru" ? 3 + k.rnd() * 4 : 1.5 + k.rnd() * 3;
          if (k.hal === "yuru") k.yon = k.rnd() * Math.PI * 2;
        }
        if (k.hal === "yuru") {
          k.x += Math.sin(k.yon) * 0.6 * dt; k.z += Math.cos(k.yon) * 0.6 * dt;
          // kaldırımda kal: bina önü (|x|<5.5) ve yol (z>1.9) yasak
          if (k.z > 1.85 || k.z < 0.3 || Math.abs(k.x) > 36 || (Math.abs(k.x) < 5.8 && k.z < 1.0)) { k.yon += Math.PI * 0.8; k.z = Math.max(0.35, Math.min(1.8, k.z)); }
        }
        const yuru = k.hal === "yuru";
        const bob = yuru ? Math.abs(Math.sin(t * 9 + k.faz)) * 0.02 : 0;
        const egim = k.hal === "otur" ? -0.35 : k.hal === "yat" ? 0 : yuru ? Math.sin(t * 9 + k.faz) * 0.06 : 0;
        const olcY = k.hal === "otur" ? 0.85 : k.hal === "yat" ? 0.55 : 1;
        e.set(egim, k.yon, yuru ? Math.sin(t * 4.5 + k.faz) * 0.05 : 0);
        M.compose(p.set(k.x, bob, k.z), q.setFromEuler(e), s.set(1, olcY, 1)); kediMesh.setMatrixAt(i, M);
      });
      kediMesh.instanceMatrix.needsUpdate = true;
    };

    // ---- YÜKLEME ----
    Promise.all([
      ...TURLER.map((t) => yukleyici.loadAsync(KOK + `karakter_${t}.glb`)),
      yukleyici.loadAsync(KOK + "bina_dukkan.glb"),
      ...PROPLAR.map((p) => yukleyici.loadAsync(KOK + p + ".glb").catch((e) => { console.error("[Deneme] prop:", p, e); return null; })),
      dokuYukleyici.loadAsync(KOK + "atlas_eski.png").catch(() => null),
      dokuYukleyici.loadAsync(KOK + "atlas_yaprakEski.png").catch(() => null),
    ])
      .then((sonuc) => {
        if (iptal) return;
        const turGltf = sonuc.slice(0, 3), b = sonuc[3], propGltf = sonuc.slice(4, 4 + PROPLAR.length);
        const [eskiDoku, yaprakDoku] = sonuc.slice(4 + PROPLAR.length);
        turGltf.forEach((g, i) => {
          const t = TURLER[i], kozmetikler = {};
          const grup = g.scene.getObjectByName("Kozmetikler");
          if (grup) { grup.parent.remove(grup); for (const m of grup.children) kozmetikler[m.name.replace("kozmetik_", "")] = m; }
          turVeri[t] = { sahne: g.scene, klipler: g.animations, kozmetikler, mesh: g.scene.getObjectByName("Govde") };
          malzemeTopla(g.scene); for (const m of Object.values(kozmetikler)) malzemeTopla(m);
        });
        binaMesh = b.scene;
        binaMesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        binaMesh.position.set(0, 0, -6); sahne.add(binaMesh); malzemeTopla(binaMesh);
        const c = document.createElement("canvas"); c.width = 512; c.height = 96;
        const x = c.getContext("2d"); x.font = '800 60px "Baloo 2", "Nunito", sans-serif'; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
        x.shadowColor = "rgba(0,0,0,.3)"; x.shadowOffsetY = 3; x.fillText("Lig · League", 256, 48);
        const doku = new THREE.CanvasTexture(c); doku.colorSpace = THREE.SRGBColorSpace;
        const yazi = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.8), new THREE.MeshBasicMaterial({ map: doku, transparent: true }));
        yazi.name = "tabelaYazi"; yazi.position.set(0, 0.18 + 3.8 + 0.28 + 0.46, -6 + 4 + 0.22); sahne.add(yazi);
        propGltf.forEach((g, i) => { if (!g) return; g.scene.traverse((o) => { if (o.isMesh) propMesh[PROPLAR[i]] = o; }); });
        for (const m of Object.values(propMesh)) malzemeTopla(m);
        if (propMesh.zemin_deneme) { const z = propMesh.zemin_deneme.clone(); z.receiveShadow = true; z.castShadow = false; z.name = "zemin"; sahne.add(z); }
        cevreKur(); kediKur();
        // 1G-B.4 pet sistemi: kedi geometrisi (prop_kedi) + aynı atlas malzemesi; kuş kod geometrisi
        if (propMesh.prop_kedi && turVeri.insan) petSistemi = new PetSistemi(sahne, { kediGeo: propMesh.prop_kedi.geometry, malzeme: propMesh.prop_kedi.material, hucreler: turVeri.insan.mesh.userData.hucreler, temasHedefler });
        dokular.yeni = malzemeler.find((m) => m.map)?.map ?? null;
        for (const [ad, d] of [["eski", eskiDoku], ["yaprakEski", yaprakDoku]]) if (d) { d.flipY = false; d.colorSpace = THREE.SRGBColorSpace; d.wrapS = d.wrapT = THREE.ClampToEdgeWrapping; d.needsUpdate = true; dokular[ad] = d; }
        // esas karakter
        esas = karakterYap("insan", { set: 1, sac: 1 }, durumu.koz);
        esas.position.set(0, 0, 2); sahne.add(esas); temasHedefler.push({ nesne: esas, r: 0.9 });
        klipOynat(esas, "Idle", esas.userData.mixer);
        setDurum({ hazir: true, hata: null });
      })
      .catch((e) => { console.error("[Deneme] yükleme:", e); if (!iptal) setDurum({ hazir: false, hata: String(e?.message ?? e) }); });

    /** Esas karakteri başka türle yeniden kur — kozmetik, kıyafet, klip, ifade korunur. */
    const turDegistir = (t) => {
      if (!turVeri[t] || !esas) return;
      const g = { ...(esas.userData.gorunum ?? { set: durumu.set, sac: 1 }) };
      const poz = esas.position.clone();
      karakterSil(esas);
      esas = karakterYap(t, g, durumu.koz); esas.position.copy(poz); sahne.add(esas); temasHedefler.push({ nesne: esas, r: 0.9 });
      klipOynat(esas, durumu.klip, esas.userData.mixer); ifadeSec(esas, durumu.ifade);
      durumu.tur = t;
    };
    /**
     * 1D §4 SİYAH SİLUET TESTİ: insan · kaplan · robot yan yana, sahne düz siyah (overrideMaterial), fon beyaz, çevre/bina/zemin gizli,
     * pozlar donuk Idle 0. kare. Silüetler ayırt edilemiyorsa robot yetersizdir.
     */
    let siluetDurum = null;
    /** secenek: { siyah=true (düz siyah + beyaz fon), don=0 (karakter Y dönüşü; π/2 → profil yan yana), turler=TURLER, aralik=1.8 } */
    const siluetAyarla = (ac, secenek = {}) => {
      if (ac && !siluetDurum && esas) {
        const ekstra = [], g = esas.userData.gorunum ?? { set: 1, sac: 1 }, turler = secenek.turler ?? TURLER, aralik = secenek.aralik ?? 1.8, siyah = secenek.siyah !== false;
        turler.forEach((t, i) => {
          let kok = t === durumu.tur ? esas : karakterYap(t, g, durumu.koz);
          if (!kok) return;
          if (kok !== esas) { sahne.add(kok); ekstra.push(kok); }
          kok.position.set(-(turler.length - 1) * aralik / 2 + i * aralik, 0, 2); kok.rotation.y = secenek.don ?? 0;
          klipOynat(kok, "Idle", kok.userData.mixer, 0);
        });
        const zemin = sahne.getObjectByName("zemin"), yazi = sahne.getObjectByName("tabelaYazi");
        siluetDurum = { ekstra, esasPoz: esas.position.clone(), esasDon: esas.rotation.y, fog: sahne.fog, bg: sahne.background, cevre: cevreGrubu.visible, kedi: kediMesh?.visible, bina: binaMesh?.visible, temas: temas.visible, zemin: zemin?.visible, yazi: yazi?.visible, dondur, klip: durumu.klip };
        dondur = true;
        if (siyah) {
          sahne.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
          sahne.background = new THREE.Color(0xffffff); sahne.fog = null;
          cevreGrubu.visible = false; if (kediMesh) kediMesh.visible = false; if (binaMesh) binaMesh.visible = false; temas.visible = false; vfxKit.mesh.visible = false; for (const m of Object.values(petSistemi?.mesh ?? {})) m.visible = false;
          if (zemin) zemin.visible = false; if (yazi) yazi.visible = false;
        }
      } else if (!ac && siluetDurum) {
        const d = siluetDurum; siluetDurum = null;
        for (const k of d.ekstra) karakterSil(k);
        sahne.overrideMaterial = null; sahne.background = d.bg; sahne.fog = d.fog;
        cevreGrubu.visible = d.cevre; if (kediMesh) kediMesh.visible = d.kedi; if (binaMesh) binaMesh.visible = d.bina; temas.visible = d.temas; vfxKit.mesh.visible = true; for (const m of Object.values(petSistemi?.mesh ?? {})) m.visible = true;
        const zemin = sahne.getObjectByName("zemin"), yazi = sahne.getObjectByName("tabelaYazi");
        if (zemin) zemin.visible = d.zemin; if (yazi) yazi.visible = d.yazi; dondur = d.dondur;
        esas.position.copy(d.esasPoz); esas.rotation.y = d.esasDon; klipOynat(esas, d.klip, esas.userData.mixer);
      }
    };
    /** 25 karakter: karışık tür/kıyafet/renk/saç/kozmetik — deterministik, ≥12 farklı görünüm. */
    const kopyaAyarla = (n) => {
      for (const k of kopyalar) karakterSil(k.kok);
      kopyalar = [];
      if (!esas || !turVeri.insan) return;
      for (let i = 0; i < n; i++) {
        const tur = i % 5 === 3 ? "kaplan" : i % 5 === 4 ? "robot" : "insan";
        const g = { set: (i % 3) + 1, sac: (i % 3) + 1, ten: TENLER[i % 4], sacRenk: SACLAR[(i * 3) % 4], ust: USTLER[(i * 5) % USTLER.length], alt: ALTLAR[(i * 7) % ALTLAR.length], ayak: AYAKLAR[(i * 3) % AYAKLAR.length], ceket: ALTLAR[(i + 1) % ALTLAR.length], metal: i % 2 ? new THREE.Color(0xdfe3e8) : new THREE.Color(0xf3c98b), boya: USTLER[(i * 2) % USTLER.length] };
        const koz = { sapka: (i * 7) % 5 < 2, gozluk: (i * 3) % 5 < 2, atki: (i * 11) % 5 < 2, gozlukPremium: (i * 3) % 5 === 2, kanat: i % 8 === 5 };   // 1G: kalabalıkta 3 kanat, 5 premium gözlük
        const kok = karakterYap(tur, g, koz);
        const col = i % 6, row = Math.floor(i / 6);
        kok.position.set(-7.5 + col * 3, 0, 4 + row * 2.0); kok.rotation.y = ((i * 37) % 100 / 100 - 0.5) * 1.2;
        klipOynat(kok, KLIPLER[i % 3], kok.userData.mixer);
        sahne.add(kok); kopyalar.push({ kok }); temasHedefler.push({ nesne: kok, r: 0.9 });
      }
      temasGuncelle();
    };
    const capaAyarla = (ac) => {
      if (capaGrubu) { for (const k of capaGrubu.children) canliSil(k); sahne.remove(capaGrubu); capaGrubu = null; }
      dondur = ac; if (esas) esas.visible = !ac;
      if (!ac || !esas) return;
      kameraAyarla("capa"); cevreGrubu.visible = false;
      capaGrubu = new THREE.Group(); capaGrubu.name = "CapaTesti";
      CAPA_KARELERI.forEach(([ad, t], i) => {
        const kok = karakterYap(durumu.tur, esas.userData.gorunum ?? { set: 1, sac: 1 }, { sapka: true, gozluk: true, atki: true });
        canliSil(kok); kok.position.set(-6.4 + i * 1.6, 0, 3.5);
        klipOynat(kok, ad, kok.userData.mixer, t);
        kok.traverse((o) => { if (/Yuva|capeRoot/.test(o.name)) o.add(new THREE.AxesHelper(0.1)); });
        kok.updateMatrixWorld(true); capaGrubu.add(kok);
      });
      sahne.add(capaGrubu);
    };

    // ---- döngü ----
    let kare = 0, sonOlc = performance.now(), sure = 0, calisiyor = true, zaman = 0;
    const cizim = () => {
      const dt = Math.min(0.1, saat.getDelta()); zaman += dt;
      if (!esas) return;
      if (!dondur) for (const m of mixerler) m.update(dt);
      const t = performance.now();
      if (!dondur) kirpmaGuncelle(t);
      // 1G-A.2: gülümseme = kaş yukarı (göz karesinde) + göz kavisi + HAFİF BAŞ EĞİMİ (mixer'dan sonra ek dönüş)
      for (const c of canlilar) { if (c.kok.userData.ifade?.agiz === "gulumseme") { const h = (c.kok.userData.headKemik ??= c.kok.getObjectByName("Head")); if (h) h.quaternion.multiply(EGIM_Q); } }
      // kaplan kuyruğu: kökten salınım
      sahne.traverse((o) => { if (o.name === "kozmetik_kuyruk") o.rotation.set(Math.sin(zaman * 2.1) * 0.12, Math.sin(zaman * 3.3) * 0.28, 0); });
      kediGuncelle(dt, zaman);
      hareketGuncelle(dt, zaman); petSistemi?.guncelle(dt, zaman); vfxKit.guncelle(zaman, kam);   // 1G: süzülme/zıplama · petler · tek VFX çağrısı
      kontrol.update(); temasGuncelle();
      const t0 = performance.now(); render.render(sahne, kam); sure += performance.now() - t0; kare++;
      if (t - sonOlc >= 500) { const i = render.info.render; setOlc({ cagri: i.calls, ucgen: i.triangles, fps: Math.round(kare * 1000 / (t - sonOlc)), ms: +(sure / kare).toFixed(2), kopya: 1 + kopyalar.length, vfx: vfxKit.istatistik.parcacik, vfxTam: vfxKit.istatistik.tam, pet: petSistemi?.petler.length ?? 0 }); kare = 0; sure = 0; sonOlc = t; }
    };
    let raf = 0, worker = null;
    if (new URLSearchParams(location.search).has("otomasyon")) { worker = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),16)"]))); worker.onmessage = () => { if (calisiyor) cizim(); }; }
    else { const dongu = () => { if (!calisiyor) return; if (!document.hidden) cizim(); raf = requestAnimationFrame(dongu); }; raf = requestAnimationFrame(dongu); }
    const boyut = () => { W = kap.clientWidth || innerWidth; H = kap.clientHeight || innerHeight; kam.aspect = W / H; kam.updateProjectionMatrix(); render.setSize(W, H); };
    addEventListener("resize", boyut);

    apiRef.current = {
      klip: (ad) => { durumu.klip = ad; if (esas) { klipOynat(esas, ad, esas.userData.mixer); ifadeSec(esas, ad === "Selam" ? "gulumseme" : durumu.ifade); } },
      kozmetik: (ad, ac) => { durumu.koz[ad] = ac; if (esas) kozmetikTak(esas, ad, ac); },
      kopya: (n) => kopyaAyarla(n),
      capa: (ac) => { capaAyarla(ac); if (!ac) cevreGrubu.visible = true; },
      cevre: (ac) => { cevreGrubu.visible = ac; },
      kediler: (ac) => { if (kediMesh) kediMesh.visible = ac; },
      golge: (ac) => { render.shadowMap.enabled = ac; sahne.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); },
      ao: (ac) => { for (const m of malzemeler) { m.vertexColors = ac; m.needsUpdate = true; } },
      atlas: (mod) => { const d = dokular[mod]; if (!d) return false; for (const m of malzemeler) { if (!m.map || m.map === temasDoku) continue; m.map = d; m.needsUpdate = true; } return true; },
      isik: (mod) => isikAyarla(mod),
      kamera: (ad) => kameraAyarla(ad),
      tur: (t) => turDegistir(t),
      set: (n) => { durumu.set = n; if (esas) gorunumUygula(esas, { ...(esas.userData.gorunum ?? {}), set: n }); },
      ifade: (ad) => { durumu.ifade = ad; if (esas) ifadeSec(esas, ad); },
      goz: (kapali) => { if (!esas) return; canliSil(esas); ifadeAyarla(esas, kapali ? "kirpik" : (esas.userData.temelGoz ?? "acik"), esas.userData.ifade?.agiz ?? "notr"); }, // ölçüm/görüntü için kırpmayı sabitle
      agacBoyu: (kucuk) => { agacOlcek = kucuk ? 0.7 : 1; cevreKur(); },
      tacVekili: (ac) => { tacVekiliAcik = ac; cevreKur(); },   // 1D Bölüm D A/B: gerçek taç gölgesi ↔ küre vekili
      siluet: (ac, secenek) => siluetAyarla(ac, secenek),
      bak: (p, h) => { kam.position.set(...p); kontrol.target.set(...h); kontrol.update(); },
      olc: () => { const i = render.info.render; return { cagri: i.calls, ucgen: i.triangles, kopya: 1 + kopyalar.length, geometri: render.info.memory.geometries, doku: render.info.memory.textures, program: render.info.programs.length }; },
      kareSuresi: (n = 30) => { const gl = render.getContext(); const t0 = performance.now(); for (let i = 0; i < n; i++) { cizim(); gl.finish(); } return +((performance.now() - t0) / n).toFixed(2); },
      /**
       * Aşama 1E §0.2 — ölçüm hijyeniyle kare süresi: `isinma` kare atılır, `ornek` kare örneklenir, MEDYAN + p95.
       * cpuGpu = cizim() + gl.finish() (CPU+GPU vekili). gpu = EXT_disjoint_timer_query_webgl2 (destek yoksa null).
       * gl.finish boru hattını sıraya sokar: karşılaştırma için tutarlı, mutlak değer için değil. HUD CPU sayısıyla karıştırma.
       */
      kareOlc: async ({ isinma = 120, ornek = 300 } = {}) => {
        const gl = render.getContext(), ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
        for (let i = 0; i < isinma; i++) { cizim(); gl.finish(); }
        const sure = [], sorgular = [];
        for (let i = 0; i < ornek; i++) {
          const q = ext ? gl.createQuery() : null; if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          const t0 = performance.now(); cizim(); gl.finish(); sure.push(performance.now() - t0);
          if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); sorgular.push(q); }
        }
        await new Promise((r) => setTimeout(r, 200));
        const gpu = [];
        const bozuk = ext ? gl.getParameter(ext.GPU_DISJOINT_EXT) : true;
        for (const q of sorgular) { if (!bozuk && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
        const yuzde = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))].toFixed(2); };
        const sonuc = { cpuGpu: yuzde(sure, 0.5), cpuGpuP95: yuzde(sure, 0.95), gpu: yuzde(gpu, 0.5), zaman: new Date().toLocaleTimeString("tr-TR"), ornek, isinma };
        setKareOlcum(sonuc);
        return sonuc;
      },
      // ---- 1G API ----
      pet: (tur) => { if (!esas || !petSistemi) return; petSistemi.kaldir(esas); if (tur) petSistemi.ekle(esas, tur); },
      petler: (n, tur = null) => { if (!petSistemi) return; for (const [i, k] of kopyalar.entries()) { petSistemi.kaldir(k.kok); if (i < n) petSistemi.ekle(k.kok, tur ?? PETLER[i % 3]); } },   // stres: ilk n kopyaya pet
      alev: (n) => { const hepsi = [esas, ...kopyalar.map((k) => k.kok)].filter(Boolean); hepsi.forEach((kok, i) => gorunumUygula(kok, { ...(kok.userData.gorunum ?? {}), set: i < n ? 4 : (i % 3) + 1 })); },   // §5.2 stres: n alevli karakter
      kanatlar: (n) => { for (const [i, k] of kopyalar.entries()) kozmetikTak(k.kok, "kanat", i < n); },
      zipla: () => { if (esas) esas.userData.zipla = zaman; },
      vfx: () => ({ ...vfxKit.istatistik, ayar: { ...vfxKit.ayar } }),
      vfxAyar: (o) => Object.assign(vfxKit.ayar, o),
      vitrin: (ac) => vitrinAyarla(ac),
      petSayilari: () => petSistemi?.sayilar() ?? null,
      esas: () => esas, sahne, render, kam,
    };
    window.__deneme = apiRef.current;
    isikAyarla("B+");

    return () => {
      iptal = true; calisiyor = false;
      cancelAnimationFrame(raf); worker?.terminate();
      removeEventListener("resize", boyut); kontrol.dispose();
      sahne.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      sahne.environment?.dispose?.(); render.dispose();
      kap.contains(render.domElement) && kap.removeChild(render.domElement);
      delete window.__deneme;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { apiRef.current?.klip(klip); }, [klip, durum.hazir]);
  useEffect(() => { for (const ad of Object.keys(KOZMETIK)) apiRef.current?.kozmetik(ad, koz[ad]); }, [koz, durum.hazir]);
  useEffect(() => { if (durum.hazir) apiRef.current?.pet(pet); }, [pet, durum.hazir]);
  useEffect(() => { if (durum.hazir) apiRef.current?.vitrin(vitrin); }, [vitrin, durum.hazir]);
  useEffect(() => { apiRef.current?.kopya(kalabalik ? 24 : 0); }, [kalabalik, durum.hazir]);
  useEffect(() => { apiRef.current?.golge(golge); }, [golge]);
  useEffect(() => { apiRef.current?.ao(ao); }, [ao, durum.hazir]);
  useEffect(() => { apiRef.current?.atlas(atlasMod); }, [atlasMod, durum.hazir]);
  useEffect(() => { apiRef.current?.capa(capa); }, [capa, durum.hazir]);
  useEffect(() => { apiRef.current?.cevre(cevre); }, [cevre, durum.hazir]);
  useEffect(() => { apiRef.current?.isik(isik); }, [isik]);
  useEffect(() => { apiRef.current?.kamera(kamera); }, [kamera]);
  useEffect(() => { apiRef.current?.tur(tur); }, [tur, durum.hazir]);
  useEffect(() => { apiRef.current?.set(set); }, [set, durum.hazir]);
  useEffect(() => { apiRef.current?.kediler(kediler); }, [kediler, durum.hazir]);
  useEffect(() => { apiRef.current?.ifade(ifade); }, [ifade, durum.hazir]);
  useEffect(() => { apiRef.current?.agacBoyu(agacKucuk); }, [agacKucuk, durum.hazir]);
  useEffect(() => { if (durum.hazir) apiRef.current?.siluet(siluet); }, [siluet, durum.hazir]);
  useEffect(() => { if (durum.hazir) apiRef.current?.tacVekili(tacVekili); }, [tacVekili, durum.hazir]);

  const D = ({ ac, onClick, children }) => <button className={ac ? "aktif" : ""} onClick={onClick}>{children}</button>;

  return (
    <div className="hd-sayfa">
      <div className="hd-kanvas" ref={kapRef} />
      <div className="hd-ust">
        <a className="hd-geri" href="/">‹ Oyuna dön</a>
        {/* Aşama 1E §0.2: iki metrik etiketli. CPU = yalnız render.render gönderim süresi (sürekli); CPU+GPU = cizim + gl.finish medyanı (istenince) */}
        <div className="hd-olc">
          <b>{olc.cagri}</b> çağrı · <b>{olc.ucgen.toLocaleString("tr-TR")}</b> üçgen · <b>{olc.fps}</b> fps ·{" "}
          <span title="Yalnız CPU gönderim süresi (render.render çevresi). Kare süresi DEĞİL.">CPU {olc.ms.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ms</span> ·{" "}
          <span title="cizim() + gl.finish(), 120 kare ısınma, 300 kare medyan. Düğmeyle ölçülür.">CPU+GPU {kareOlcum ? `${kareOlcum.cpuGpu.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ms (${kareOlcum.zaman})` : "— ms"}</span>
          {kareOlcum?.gpu != null && <> · <span title="EXT_disjoint_timer_query_webgl2, medyan">GPU {kareOlcum.gpu.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ms</span></>}
          {" "}· {olc.kopya} karakter · <span title="Tek paylaşılan InstancedMesh (1 çağrı). tam = tam VFX alan yayıcı sayısı (LOD)">VFX {olc.vfx ?? 0} parçacık / {olc.vfxTam ?? 0} tam</span> · {olc.pet ?? 0} pet
        </div>
      </div>
      {!durum.hazir && <div className="hd-perde">{durum.hata ? "Yüklenemedi: " + durum.hata : "Varlıklar yükleniyor…"}</div>}
      <div className="hd-alt">
        <div className="hd-grup">{KLIPLER.map((k) => <D key={k} ac={klip === k} onClick={() => setKlip(k)}>{k}</D>)}</div>
        <div className="hd-grup">{TURLER.map((t) => <D key={t} ac={tur === t} onClick={() => setTur(t)}>{t}</D>)}</div>
        <div className="hd-grup">{[1, 2, 3, 4].map((n) => <D key={n} ac={set === n} onClick={() => setSet(n)}>{n === 4 ? "kıyafet 4 (alev)" : "kıyafet " + n}</D>)}</div>
        <div className="hd-grup">{Object.keys(KOZMETIK).map((k) => <D key={k} ac={koz[k]} onClick={() => setKoz({ ...koz, [k]: !koz[k], ...(k === "gozluk" && !koz[k] ? { gozlukPremium: false } : {}), ...(k === "gozlukPremium" && !koz[k] ? { gozluk: false } : {}) })}>{k}</D>)}</div>
        <div className="hd-grup">{[[null, "pet yok"], ["kedi", "kedi"], ["kopek", "köpek"], ["kus", "kuş"]].map(([k, ad]) => <D key={ad} ac={pet === k} onClick={() => setPet(k)}>{ad}</D>)}<D ac={false} onClick={() => apiRef.current?.zipla()}>zıpla</D></div>
        <div className="hd-grup">{[["normal", "normal"], ["gulumseme", "gülümseme"], ["saskin", "şaşkın"]].map(([k, ad]) => <D key={k} ac={ifade === k} onClick={() => setIfade(k)}>{ad}</D>)}</div>
        <div className="hd-grup">
          <D ac={kalabalik} onClick={() => setKalabalik(!kalabalik)}>25 karakter</D>
          <D ac={golge} onClick={() => setGolge(!golge)}>gölge</D>
          <D ac={cevre} onClick={() => setCevre(!cevre)}>çevre</D>
          <D ac={kediler} onClick={() => setKediler(!kediler)}>kediler</D>
          <D ac={agacKucuk} onClick={() => setAgacKucuk(!agacKucuk)}>{agacKucuk ? "ağaç: küçük" : "ağaç: normal"}</D>
        </div>
        <div className="hd-grup">
          <D ac={ao} onClick={() => setAo(!ao)}>AO</D>
          <D ac={atlasMod === "yeni"} onClick={() => setAtlasMod(atlasMod === "yeni" ? "eski" : "yeni")}>{atlasMod === "eski" ? "atlas: eski" : "atlas: yeni"}</D>
          <D ac={atlasMod === "yaprakEski"} onClick={() => setAtlasMod(atlasMod === "yaprakEski" ? "yeni" : "yaprakEski")}>yaprak: eski</D>
          <D ac={isik !== "A"} onClick={() => setIsik(isik === "B+" ? "B" : isik === "B" ? "A" : "B+")}>ışık {isik}</D>
          <D ac={capa} onClick={() => setCapa(!capa)}>çapa testi</D>
          <D ac={siluet} onClick={() => setSiluet(!siluet)}>siluet</D>
          <D ac={tacVekili} onClick={() => setTacVekili(!tacVekili)}>taç gölgesi: {tacVekili ? "vekil" : "gerçek"}</D>
        </div>
        <div className="hd-grup">{[["genis", "Geniş"], ["oyun", "Oyun"], ["foto", "Fotoğraf"]].map(([k, ad]) => <D key={k} ac={kamera === k} onClick={() => setKamera(k)}>{ad}</D>)}<D ac={vitrin} onClick={() => setVitrin(!vitrin)}>vitrin</D></div>
        <div className="hd-grup"><D ac={false} onClick={() => apiRef.current?.kareOlc()}>CPU+GPU ölç</D></div>
      </div>
    </div>
  );
}
