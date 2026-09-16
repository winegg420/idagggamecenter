// ============================================================
// VARLIK MUAYENESİ — tarayıcı tarafı (Aşama 1E).
// Bir GLB'yi oyunun ışığı (B+) ve malzeme kuralıyla yükler; istenen görünümü çizer, PNG verir.
//   window.muayene.hazirla(ustveri)  → varlığı kur, görünüm listesini döndür
//   window.muayene.ciz(i)            → i. görünümü çiz, PNG dataURL döndür
//   window.muayene.kontakt(bilgi)    → kontakt sayfası (JPEG dataURL)
//
// DİKKAT — KOPYA: malzeme cilası ve varsayılan görünüm (varyant çökertme + ton) oyun test sayfasındaki
// `DenemeSayfasi.jsx › cilala / gorunumUygula`nın sadeleştirilmiş kopyasıdır. Orada değişirse burası da
// güncellenmeli; yoksa muayene oyunda görünenden farklı bir şeyi gösterir.
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const KOK = "/meydan/deneme/";
const BOY = 640;
const KOZ_YUVA = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva", kuyruk: "sirtYuva", gozlukPremium: "gozlukYuva", kanat: "sirtYuva" };

// ---- render + ışık B+ (DenemeSayfasi isikAyarla("B+") ile aynı değerler) ----
const render = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
render.setPixelRatio(1); render.setSize(BOY, BOY);
render.shadowMap.enabled = true; render.shadowMap.type = THREE.PCFShadowMap;
render.toneMapping = THREE.ACESFilmicToneMapping; render.toneMappingExposure = 1.08;
document.body.appendChild(render.domElement);
const sahne = new THREE.Scene();
sahne.environment = new THREE.PMREMGenerator(render).fromScene(new RoomEnvironment(), 0.04).texture;
sahne.environmentIntensity = 0.25;
const gok = new THREE.HemisphereLight(0xeaf7ff, 0xe8dfcb, 0.405 * Math.PI); sahne.add(gok);
const gunes = new THREE.DirectionalLight(0xfff3dc, 1.29 * Math.PI);
gunes.castShadow = true; gunes.shadow.mapSize.set(2048, 2048); gunes.shadow.radius = 3; gunes.shadow.bias = -0.0004;
sahne.add(gunes, gunes.target);

// ---- tek malzeme cilası (DenemeSayfasi.jsx › cilala kopyası) ----
const PURUZ_TABLO = [0.55, 0.65, 0.65, 0.65, 1.0, 0.95, 0.45, 0.9, 0.95, 0.9, 0.35, 0.5, 0.2, 0.3, 0.3, 0.6, 0.15, 0.82, 0.9, 0.6, 0.85, 0.6, 0.9, 0.35, 0.22];
// Bölge → metalness (1G-B.3 malzeme ayrımı): 16 cam 0,45 (aynalı) · 24 premiumMetal 0,9 (altın çerçeve). Robot 'metal' (10) 0 KALIR — 1D görünümü korunur.
const METAL_TABLO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0, 0.9];
const TEN_TEMEL = new THREE.Color("#F2C9A7");
function cilala(m) {
  if (!m || m.userData.cilali) return;
  m.userData.cilali = true; m.envMapIntensity = 0.35; m.vertexColors = true;
  m.customProgramCacheKey = () => "atlas-bolge-v4";
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute float _bolge;\nvarying float vBolge;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvBolge = _bolge;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vBolge;
const float PURUZ[25] = float[25](${PURUZ_TABLO.map((v) => v.toFixed(2)).join(", ")});
const float METAL[25] = float[25](${METAL_TABLO.map((v) => v.toFixed(2)).join(", ")});
float bolgeMetal(float b) { int i = int(clamp(b + 0.5, 0.0, 24.0)); return METAL[i]; }
const vec3 TEN_TEMEL = vec3(${TEN_TEMEL.r.toFixed(4)}, ${TEN_TEMEL.g.toFixed(4)}, ${TEN_TEMEL.b.toFixed(4)});
float bolgePuruz(float b) { int i = int(clamp(b + 0.5, 0.0, 24.0)); return PURUZ[i]; }`)
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

// ---- varsayılan görünüm (DenemeSayfasi gorunumUygula, set 1 · saç 1 · ilk tonlar) ----
const hex = (h) => new THREE.Color(h);
const TON = { ten: hex("#F2C9A7"), sac: hex("#5B3A29"), ust: hex("#F4701F"), alt: hex("#3B5B8C"), ayak: hex("#2B2B30"), notr: hex("#FFFFFF") };
function varsayilanGorunum(mesh) {
  const u = mesh.userData, B = u.bolge; if (!B) return;
  const geo = mesh.geometry = mesh.geometry.clone();
  const pos = geo.attributes.position, bolge = geo.attributes._bolge, c3 = geo.attributes.color;
  const renk = new Float32Array(pos.count * 4);
  const bas = u.merkez.bas, gov = u.merkez.govde;
  for (let i = 0; i < pos.count; i++) {
    const b = bolge.getX(i);
    let c = TON.notr;
    if (b === B.ten) c = TON.ten;
    else if (b === B.sacKase || b === B.sacKisa || b === B.sacKuyruk) { c = TON.sac; if (b !== B.sacKase) pos.setXYZ(i, bas[0], bas[1], bas[2]); }
    else if (b === B.ust || b === B.bilek) c = TON.ust;
    else if (b === B.alt) c = TON.alt;
    else if (b === B.ayakkabi) c = TON.ayak;
    else if (b === B.ceket || b === B.yaka || b === B.kapuson) pos.setXYZ(i, gov[0], gov[1], gov[2]);
    else if (b === B.boya && u.tur === "robot") c = TON.ust;
    else if ((b === B.gozL || b === B.gozR || b === B.agiz) && u.tur === "insan") c = TON.ten;
    const ao = c3 ? c3.getX(i) : 1;
    renk[i * 4] = (c3 ? c3.getX(i) : 1) * c.r; renk[i * 4 + 1] = (c3 ? c3.getY(i) : 1) * c.g; renk[i * 4 + 2] = (c3 ? c3.getZ(i) : 1) * c.b; renk[i * 4 + 3] = ao;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(renk, 4));
  pos.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere();
}

// ---- yardımcılar: zemin gölgesi, y=0 çizgisi ----
const zeminGolge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 }));
zeminGolge.receiveShadow = true; sahne.add(zeminGolge);
const zeminCizgi = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd0342c }));
sahne.add(zeminCizgi);

const yukleyici = new GLTFLoader();
const onbellek = new Map();
const yukle = (ad, klasor = KOK) => { const url = klasor + ad + ".glb"; if (!onbellek.has(url)) onbellek.set(url, yukleyici.loadAsync(url)); return onbellek.get(url); };   // 1H: aday GLB'leri kendi klasöründen (ustveri.klasor)

// ---- 1H GÖVDE KARŞILAŞTIRMASI: düz ten (biçim yargılanır, doku değil) · çıplak (mevcut karakterde saç/ceket/yaka/kapüşon çökertilir) ----
const DUZ_TEN = new THREE.MeshStandardMaterial({ color: new THREE.Color("#F2C9A7"), roughness: 0.82, metalness: 0, name: "duzTen" });
function ciplakYap(mesh) {
  const u = mesh.userData, B = u.bolge; if (!B) return;
  const geo = mesh.geometry = mesh.geometry.clone(), pos = geo.attributes.position, bolge = geo.attributes._bolge, bas = u.merkez.bas, gov = u.merkez.govde;
  for (let i = 0; i < pos.count; i++) { const b = bolge.getX(i); if (b === B.sacKase || b === B.sacKisa || b === B.sacKuyruk) pos.setXYZ(i, bas[0], bas[1], bas[2]); else if (b === B.ceket || b === B.yaka || b === B.kapuson) pos.setXYZ(i, gov[0], gov[1], gov[2]); }
  geo.deleteAttribute("color"); pos.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere();
}

let durum = null;
/** Yalnız GÖRÜNÜR meshlerin kutusu (Box3.setFromObject görünmez kozmetikleri de sayar). Skinned mesh pozlu hesaplanır. */
function gorunurKutu(kok) {
  const kutu = new THREE.Box3();
  kok.traverseVisible((o) => { if (o.isMesh) kutu.union(new THREE.Box3().setFromObject(o, true)); });
  return kutu;
}   // { ustveri, kok, merkez, R, kutu, mixer, klipler, kozmetikler: [Object3D], gorunumler, cizimler: [canvas] }

async function hazirla(ustveri) {
  if (durum?.kok) sahne.remove(durum.kok);
  const gltf = await yukle(ustveri.glb, ustveri.klasor);
  // her hazırlıkta temiz kopya: SkinnedMesh için SkeletonUtils yerine GLB'yi yeniden ayrıştırmak en güvenlisi
  onbellek.delete((ustveri.klasor ?? KOK) + ustveri.glb + ".glb");
  const kok = gltf.scene;
  const karakter = ustveri.tip === "karakter";
  let govde = null;
  const kozKaynak = {};
  kok.traverse((o) => { if (o.isMesh) { if (ustveri.duzTen) o.material = DUZ_TEN; else cilala(o.material); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.name === "Govde" || (!govde && o.isSkinnedMesh)) govde = o; } });
  const grup = kok.getObjectByName("Kozmetikler");
  if (grup) { for (const m of [...grup.children]) kozKaynak[`${ustveri.glb}:${m.name.replace("kozmetik_", "")}`] = m; grup.parent.remove(grup); }
  if (govde && ustveri.duzTen) ciplakYap(govde); else if (govde) varsayilanGorunum(govde);
  // kozmetikler: üstverideki kaynak GLB'den (kaplan insanın şapkasını takar — oyundaki kural) yuvaya takılır
  const kozmetikler = [];
  for (const [ad, kaynakGlb] of Object.entries(ustveri.kozmetik ?? {})) {
    let m = kozKaynak[`${kaynakGlb}:${ad}`];
    if (!m) {
      const g = await yukle(kaynakGlb);
      const k = g.scene.getObjectByName("kozmetik_" + ad);
      if (!k) continue;
      k.traverse((o) => { if (o.isMesh) cilala(o.material); });
      m = k.clone();
    }
    m.castShadow = false;
    const yuva = kok.getObjectByName(KOZ_YUVA[ad]); if (!yuva) continue;
    yuva.add(m); m.visible = false; kozmetikler.push(m);
  }
  sahne.add(kok);
  let mixer = null;
  if (karakter && gltf.animations.length) mixer = new THREE.AnimationMixer(kok);
  // Bağlama pozu = GLB'deki kemik yerel TRS'si. skeleton.pose() KULLANILMAZ: kök kemiğin ebeveyni ölçekli/dönük
  // `Rig` düğümü (kemik değil) olduğundan pose() Hips'e dünya matrisini yerel diye yazar → rig 0,01 ölçek ve −90° X
  // ikinci kez uygulanır (ilk denemede karakter yatık ve 100× büyük çıktı).
  const kemikTRS = [];
  kok.traverse((o) => { if (o.isBone) kemikTRS.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  durum = { ustveri, kok, govde, mixer, klipler: gltf.animations, kozmetikler, cizimler: [], kemikTRS };
  poz("bind");
  const kutu = gorunurKutu(kok);
  durum.kutu = kutu; durum.merkez = kutu.getCenter(new THREE.Vector3()); durum.R = kutu.getSize(new THREE.Vector3()).length() / 2;
  durum.gorunumler = gorunumListesi(ustveri);
  let ucgen = 0, malzeme = new Set();
  kok.traverse((o) => { if (o.isMesh && o.visible !== false) { ucgen += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; malzeme.add(o.material.uuid); } });
  const gl = render.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return { gorunumler: durum.gorunumler.map((g) => g.ad), ucgen, malzeme: malzeme.size, kutu: [kutu.min.toArray(), kutu.max.toArray()], gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?" };
}

/** bind: iskelet bağlama pozu (simetri/ortografik) · idle: Idle klibi 0,5 s (beauty shot, oyundaki duruş) · {klip, zaman}: 1H deformasyon karesi */
function poz(ad) {
  if (!durum.govde?.skeleton) return;
  const istek = typeof ad === "object" ? ad : ad === "idle" ? { klip: "Idle", zaman: 0.5 } : null;
  if (istek && durum.mixer) {
    const k = durum.klipler.find((c) => c.name === istek.klip);
    if (!k && istek.klip === "Dur") { durPozu(); return; }
    durum.mixer.stopAllAction(); const a = durum.mixer.clipAction(k); a.reset().play(); durum.mixer.setTime(istek.zaman);
  } else { durum.mixer?.stopAllAction(); for (const [b, p, q, s] of durum.kemikTRS) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); } }
  durum.kok.updateMatrixWorld(true);
}

/** 1H nötr "Dur" pozu, klibi olmayan (kaynak) karakter için: bağlama pozu + üst kollar dünya Z'de 55° aşağı — hazirla.mjs durPozu ile aynı. */
function durPozu() {
  durum.mixer?.stopAllAction();
  for (const [b, p, q, s] of durum.kemikTRS) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); }
  durum.kok.updateMatrixWorld(true);
  for (const [rol, isaret] of [["solKol", -1], ["sagKol", 1]]) {
    const b = durum.kok.getObjectByName(durum.ustveri.kemikler?.[rol]); if (!b) continue;
    const dunya = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), isaret * THREE.MathUtils.degToRad(55)).multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(dunya)); b.updateMatrixWorld(true);
  }
  durum.kok.updateMatrixWorld(true);
}

function hedefNokta(h) {
  if (Array.isArray(h)) return new THREE.Vector3(...h);
  const k = durum.kok.getObjectByName(h.rol ? durum.ustveri.kemikler?.[h.rol] : h.kemik);   // 1H: rol → adayın kendi kemik adı
  const p = k ? k.getWorldPosition(new THREE.Vector3()) : durum.merkez.clone();
  return p.add(new THREE.Vector3(...(h.ofset ?? [0, 0, 0])));
}

function gorunumListesi(u) {
  const liste = [
    { ad: "ön (+Z)", tip: "orto", yon: [0, 0, 1] }, { ad: "arka (−Z)", tip: "orto", yon: [0, 0, -1] },
    { ad: "sol (−X)", tip: "orto", yon: [-1, 0, 0] }, { ad: "sağ (+X)", tip: "orto", yon: [1, 0, 0] },
    { ad: "üst (+Y)", tip: "orto", yon: [0, 1, 0] }, { ad: "alt (−Y)", tip: "orto", yon: [0, -1, 0] },
  ];
  for (const y of u.yakin ?? []) liste.push({ ad: "yakın: " + y.ad, tip: "yakin", ...y });
  liste.push({ ad: "beauty (perspektif, B+, gölgeli" + (durum.kozmetikler.length ? ", kozmetikli, Idle" : "") + ")", tip: "guzel", ...(u.guzel ?? {}) });
  return liste;
}

/** İfade (1G): göz/ağız yamalarının UV'sini ifade karesine kaydır — DenemeSayfasi ifadeAyarla ile aynı eşleme. */
function ifadeUygula(gozAd = "acik", agizAd = "notr") {
  const mesh = durum.govde; if (!mesh?.userData?.ifade) return;
  const u = mesh.userData, geo = mesh.geometry, uv = geo.attributes.uv, bolge = geo.attributes._bolge;
  if (!durum.temelUV) durum.temelUV = uv.array.slice();
  const T = durum.temelUV, K = u.ifade.kareler, robot = u.tur === "robot";
  const gozNo = u.ifade.goz[robot ? (gozAd === "kirpik" || gozAd === "mutlu" ? "robotKapali" : "robotAcik") : gozAd] ?? u.ifade.temelGoz;
  const agizNo = u.ifade.agiz[robot ? (agizAd === "gulumseme" || agizAd === "sirit" ? "robotGulus" : "robotNotr") : agizAd] ?? u.ifade.temelAgiz;
  const tasi = (i, a0, b0) => { const a = K[a0], b = K[b0]; const ou = T[i * 2], ov = T[i * 2 + 1]; uv.setXY(i, b.u0 + (b.u1 - b.u0) * (ou - a.u0) / (a.u1 - a.u0), b.v0 + (b.v1 - b.v0) * (ov - a.v0) / (a.v1 - a.v0)); };
  for (let i = 0; i < uv.count; i++) { const b = bolge.getX(i); if (b === u.bolge.gozL || b === u.bolge.gozR) tasi(i, u.ifade.temelGoz, gozNo); else if (b === u.bolge.agiz) tasi(i, u.ifade.temelAgiz, agizNo); }
  uv.needsUpdate = true;
}
const IFADE_SET = { normal: ["acik", "notr"], gulumseme: ["mutlu", "gulumseme"], saskin: ["saskin", "saskin"] };

function ciz(i) {
  const g = typeof i === "object" ? i : durum.gorunumler[i], u = durum.ustveri;
  const [gz, ag] = IFADE_SET[g.ifade] ?? IFADE_SET.normal; ifadeUygula(gz, ag);
  const guzel = g.tip === "guzel";
  poz(g.klip ? { klip: g.klip, zaman: g.zaman ?? 0 } : guzel ? "idle" : "bind");
  const premiumVar = durum.kozmetikler.some((k) => k.name === "kozmetik_gozlukPremium");   // 1G-B.3: aynı yuva — görsel sayfada premium gözlük temel gözlüğü dışlar
  for (const m of durum.kozmetikler) m.visible = (guzel || !!g.kozmetik) && !(premiumVar && m.name === "kozmetik_gozluk");
  const kutu = gorunurKutu(durum.kok), merkez = kutu.getCenter(new THREE.Vector3()), R = Math.max(0.05, kutu.getSize(new THREE.Vector3()).length() / 2);
  sahne.background = new THREE.Color(guzel && !u.duzTen ? 0xbfe8ff : 0xdfe7ec);
  // zemin gölgesi ve y=0 çizgisi (havada parça görsel ipucu); alt görünümde ve zemin varlığında gizli
  const altGorunum = g.tip === "orto" && g.yon[1] < 0;
  zeminGolge.visible = !altGorunum && u.zeminGolgesi !== false;
  zeminGolge.scale.setScalar(R * 6); zeminGolge.position.set(merkez.x, 0, merkez.z);
  zeminCizgi.visible = g.tip === "orto" && !altGorunum && u.zeminCizgisi !== false;
  const L = R * 1.6;
  zeminCizgi.geometry.dispose();
  zeminCizgi.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(merkez.x - L, 0, merkez.z), new THREE.Vector3(merkez.x + L, 0, merkez.z), new THREE.Vector3(merkez.x, 0, merkez.z - L), new THREE.Vector3(merkez.x, 0, merkez.z + L)]);
  // güneş: B+ yönü (yükseklik 42°, yan 40°), gölge kamerası varlığı kapsar
  const el = THREE.MathUtils.degToRad(42), az = THREE.MathUtils.degToRad(40);
  gunes.target.position.copy(merkez);
  gunes.position.copy(merkez).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(R * 4));
  Object.assign(gunes.shadow.camera, { left: -R * 1.6, right: R * 1.6, top: R * 1.6, bottom: -R * 1.6, near: 0.01, far: R * 10 });
  gunes.shadow.camera.updateProjectionMatrix(); render.shadowMap.needsUpdate = true;

  let kam;
  if (g.tip === "orto") {
    const d = new THREE.Vector3(...g.yon);
    kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, R * 10);
    kam.up.set(0, 1, 0); if (Math.abs(d.y) > 0.9) kam.up.set(0, 0, d.y > 0 ? -1 : 1);
    kam.position.copy(merkez).addScaledVector(d, R * 4); kam.lookAt(merkez); kam.updateMatrixWorld(true);
    let m = 0; const inv = kam.matrixWorldInverse;
    for (const x of [kutu.min.x, kutu.max.x]) for (const y of [kutu.min.y, kutu.max.y]) for (const z of [kutu.min.z, kutu.max.z]) { const p = new THREE.Vector3(x, y, z).applyMatrix4(inv); m = Math.max(m, Math.abs(p.x), Math.abs(p.y)); }
    m *= 1.08; Object.assign(kam, { left: -m, right: m, top: m, bottom: -m }); kam.updateProjectionMatrix();
  } else if (g.tip === "sabit") {
    // 1H: dünya uzayında SABİT kamera — bütün adaylar aynı boyda, kökü aynı yerde; kamera varlığa göre çerçevelenmez
    kam = new THREE.PerspectiveCamera(g.fov ?? 24, 1, 0.01, 50);
    kam.position.set(...g.kam); kam.lookAt(new THREE.Vector3(...g.hedef));
    Object.assign(gunes.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.01, far: 12 }); gunes.shadow.camera.updateProjectionMatrix();
    gunes.target.position.set(0, 0.9, 0); gunes.position.set(0, 0.9, 0).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(5));
    zeminGolge.scale.setScalar(6); zeminGolge.position.set(0, 0, 0);
  } else if (g.tip === "yakin") {
    kam = new THREE.PerspectiveCamera(g.fov ?? 30, 1, 0.005, R * 20);
    const h = hedefNokta(g.hedef);
    kam.position.copy(h).addScaledVector(new THREE.Vector3(...g.yon).normalize(), g.mesafe);
    kam.lookAt(h);
  } else {
    const fov = g.fov ?? 32, yan = THREE.MathUtils.degToRad(g.az ?? 35), yuk = THREE.MathUtils.degToRad(g.el ?? 12);
    kam = new THREE.PerspectiveCamera(fov, 1, 0.01, R * 30);
    const h = g.hedef ? hedefNokta(g.hedef) : merkez;
    const mesafe = g.mesafe ?? (R / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.02;
    kam.position.copy(h).add(new THREE.Vector3(Math.sin(yan) * Math.cos(yuk), Math.sin(yuk), Math.cos(yan) * Math.cos(yuk)).multiplyScalar(mesafe));
    kam.lookAt(h);
  }
  render.render(sahne, kam);
  const kopya = document.createElement("canvas"); kopya.width = kopya.height = BOY;
  kopya.getContext("2d").drawImage(render.domElement, 0, 0);
  if (typeof i === "number") durum.cizimler[i] = kopya; else durum.sonCizim = kopya;
  return render.domElement.toDataURL("image/png");
}

/**
 * KONTAKT SAYFASI (Adım 3): 10 görünüm (2 × 5) + başlık (varlık, üçgen, malzeme, aday sayısı) + FAIL adayı listesi.
 * bilgi: { varlik, ucgen, malzeme, adaylar: [{test, adalar[], olcu}], susturulanSayisi, tarih }
 * Tek JPEG döner (insanın baktığı ve commit edilen tek dosya; ham PNG'ler git dışı).
 */
function kontakt(bilgi) {
  const K = 480, SUT = 5, ETIKET = 30, UST = 118, SATIR = 21, MAKS = 34;
  const satirlar = bilgi.adaylar.map((a) => `[${a.test}] ${a.adalar.join("  ↔  ")}   ${Object.entries(a.olcu ?? {}).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  const gosterilen = satirlar.slice(0, MAKS);
  const satirSay = Math.ceil(durum.gorunumler.length / SUT);
  const listeY = UST + satirSay * (K + ETIKET) + 16;
  const c = document.createElement("canvas");
  c.width = SUT * K; c.height = listeY + 44 + Math.max(1, gosterilen.length + (satirlar.length > MAKS ? 1 : 0)) * SATIR + 24;
  const x = c.getContext("2d");
  x.fillStyle = "#f6f8fa"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#20324a"; x.font = "800 40px system-ui, sans-serif"; x.fillText(bilgi.varlik, 20, 52);
  x.font = "600 22px system-ui, sans-serif";
  const aday = bilgi.adaylar.length;
  x.fillText(`${bilgi.ucgen.toLocaleString("tr-TR")} üçgen · ${bilgi.malzeme} malzeme · ${aday} FAIL adayı · ${bilgi.susturulanSayisi} üstveriyle susturuldu · ${bilgi.tarih}`, 20, 92);
  x.fillStyle = aday ? "#c0392b" : "#1e8e5a"; x.fillRect(c.width - 230, 26, 210, 60);
  x.fillStyle = "#fff"; x.font = "800 26px system-ui, sans-serif"; x.fillText(aday ? `${aday} ADAY` : "ADAY YOK", c.width - 212, 66);
  durum.gorunumler.forEach((g, i) => {
    const gx = (i % SUT) * K, gy = UST + Math.floor(i / SUT) * (K + ETIKET);
    x.fillStyle = "#20324a"; x.fillRect(gx, gy, K, ETIKET);
    x.fillStyle = "#fff"; x.font = "700 16px system-ui, sans-serif"; x.fillText(`${i + 1}. ${g.ad}`, gx + 10, gy + 21);
    if (durum.cizimler[i]) x.drawImage(durum.cizimler[i], gx, gy + ETIKET, K, K);
    x.strokeStyle = "#f6f8fa"; x.lineWidth = 2; x.strokeRect(gx, gy, K, K + ETIKET);
  });
  x.fillStyle = "#20324a"; x.font = "800 22px system-ui, sans-serif";
  x.fillText(aday ? "FAIL ADAYLARI (insan incelemesine; otomatik red değil)" : "FAIL ADAYI YOK (mekanik testler) — görsel muayene ayrıca yapılır", 20, listeY + 26);
  x.font = "500 15px ui-monospace, Consolas, monospace";
  gosterilen.forEach((s, i) => { x.fillStyle = i % 2 ? "#44546a" : "#20324a"; x.fillText(s.length > 250 ? s.slice(0, 247) + "…" : s, 20, listeY + 44 + (i + 1) * SATIR); });
  if (satirlar.length > MAKS) { x.fillStyle = "#c0392b"; x.fillText(`… +${satirlar.length - MAKS} aday daha — tam liste adaylar.json`, 20, listeY + 44 + (gosterilen.length + 1) * SATIR); }
  return c.toDataURL("image/jpeg", 0.86);
}

/**
 * 1H KARŞILAŞTIRMA SAYFASI: satır = görünüm (sabit kamera / rol hedefli yakın, klip karesi), sütun = aday.
 * Aynı kamera · aynı poz · aynı ölçek · aynı ışık · aynı düz ten. Kaynağı olmayan aday gri "DOSYA YOK" sütunu.
 * sayfa: { baslik, altBaslik, sutunlar: [{ ustveri|null, etiket, satirlar: [string], yokNotu }], satirlar: [{ ad, gorunum }] }
 */
async function karsilastir(sayfa) {
  const K = 400, SOL = 190, UST = 96, ALT = 126, n = sayfa.sutunlar.length, m = sayfa.satirlar.length;
  const c = document.createElement("canvas"); c.width = SOL + n * K; c.height = UST + 40 + m * K + ALT;
  const x = c.getContext("2d");
  x.fillStyle = "#f6f8fa"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#20324a"; x.font = "800 34px system-ui, sans-serif"; x.fillText(sayfa.baslik, 20, 46);
  x.font = "600 18px system-ui, sans-serif"; x.fillText(sayfa.altBaslik ?? "", 20, 78);
  for (let j = 0; j < n; j++) {
    const s = sayfa.sutunlar[j], sx = SOL + j * K;
    x.fillStyle = "#20324a"; x.fillRect(sx, UST, K, 40); x.fillStyle = "#fff"; x.font = "800 17px system-ui, sans-serif";
    x.fillText(s.etiket.length > 40 ? s.etiket.slice(0, 39) + "…" : s.etiket, sx + 10, UST + 26);
    if (s.ustveri) await hazirla(s.ustveri);
    for (let i = 0; i < m; i++) {
      const sy = UST + 40 + i * K;
      if (s.ustveri) { ciz({ ...sayfa.satirlar[i].gorunum }); x.drawImage(durum.sonCizim, sx, sy, K, K); }
      else { x.fillStyle = "#c9d2da"; x.fillRect(sx, sy, K, K); x.fillStyle = "#44546a"; x.font = "800 30px system-ui, sans-serif"; x.fillText("DOSYA YOK", sx + 115, sy + K / 2 - 10); x.font = "600 15px system-ui, sans-serif"; (s.yokNotu ?? "").split("|").forEach((t, k) => x.fillText(t, sx + 20, sy + K / 2 + 22 + k * 20)); }
      x.strokeStyle = "#f6f8fa"; x.lineWidth = 3; x.strokeRect(sx, sy, K, K);
    }
    x.fillStyle = "#20324a"; x.font = "600 16px system-ui, sans-serif";
    (s.satirlar ?? []).forEach((t, k) => x.fillText(t, sx + 10, UST + 40 + m * K + 26 + k * 22));
  }
  sayfa.satirlar.forEach((r, i) => { const sy = UST + 40 + i * K; x.fillStyle = "#20324a"; x.fillRect(0, sy, SOL, K); x.fillStyle = "#fff"; x.font = "800 20px system-ui, sans-serif"; r.ad.split("|").forEach((t, k) => x.fillText(t, 14, sy + K / 2 - 10 + k * 26)); });
  return c.toDataURL("image/jpeg", 0.88);
}

window.muayene = { hazirla, ciz, kontakt, karsilastir, hazir: true };
