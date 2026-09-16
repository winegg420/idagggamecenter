// ============================================================
// HARİTA YENİLEME — AŞAMA 1 / 1B TEST SAHNESİ  (/harita-deneme)
//
// Tek karakter + tek bina, STIL.md ışık kurulumunda, glTF'ten yüklenir.
// Aşama 1: GLB · Mixamo iskeletli animasyon · kozmetik yuvaları · 25 kopya.
// Aşama 1B: AO aç/kapa · atlas eski/yeni · çapa testi (9 kare) · 3 kamera ·
// ışık A/B · çevre instancing (≤ 8 çağrı) · zemin temas gölgesi.
// Oyun koduna dokunmaz; yalnız bu rota. Ölçüm için window.__deneme.
// ============================================================
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as iskeletKopyala } from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./deneme.css";

const KOK = "/meydan/deneme/";
const KLIPLER = ["Idle", "Walk", "Run", "Selam"];
const KOZMETIK = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva" };
const PROPLAR = ["prop_agac_govde", "prop_agac_tac", "prop_lamba", "prop_bank", "prop_saksi", "bordur"];
// Çapa testi kareleri: [klip, zaman]
const CAPA_KARELERI = [["Idle", 0.6], ["Walk", 0.15], ["Walk", 0.5], ["Walk", 0.85], ["Run", 0.1], ["Run", 0.35], ["Run", 0.6], ["Selam", 0.9], ["Selam", 1.4]];
// Kamera ön ayarları: [eğim°, fov, uzaklık, hedef]
const KAMERALAR = {
  genis: { egim: 35, fov: 40, uzak: 30, yaw: 18, hedef: [0, 1.5, 0] },
  oyun: { egim: 22, fov: 48, uzak: 6.5, yaw: 10, hedef: [0, 1.3, 2] },
  foto: { egim: 8, fov: 32, uzak: 3.2, yaw: 25, hedef: [0, 1.25, 2] },
  capa: { egim: 6, fov: 46, uzak: 13, yaw: 0, hedef: [0, 1.0, 3.5] },
};

export default function DenemeSayfasi() {
  const kapRef = useRef(null);
  const apiRef = useRef(null);
  const [durum, setDurum] = useState({ hazir: false, hata: null });
  const [olc, setOlc] = useState({ cagri: 0, ucgen: 0, fps: 0, ms: 0, kopya: 1 });
  const [klip, setKlip] = useState("Idle");
  const [koz, setKoz] = useState({ sapka: true, gozluk: true, atki: true });
  const [kalabalik, setKalabalik] = useState(false);
  const [golge, setGolge] = useState(true);
  const [ao, setAo] = useState(true);
  const [atlasYeni, setAtlasYeni] = useState(true);
  const [capa, setCapa] = useState(false);
  const [cevre, setCevre] = useState(true);
  const [isikB, setIsikB] = useState(true);
  const [kamera, setKamera] = useState("genis");

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;
    let iptal = false;
    let W = kap.clientWidth || innerWidth, H = kap.clientHeight || innerHeight;

    // ---- render + ışık (STIL.md §2.6; Aşama 1B: pozlama 1,12, sis 70) ----
    const render = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    render.setSize(W, H);
    render.shadowMap.enabled = true;
    render.shadowMap.type = THREE.PCFSoftShadowMap;
    render.toneMapping = THREE.ACESFilmicToneMapping;
    render.toneMappingExposure = 1.12;
    kap.appendChild(render.domElement);
    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color(0xbfe8ff);
    sahne.fog = new THREE.Fog(0xcdeeff, 70, 190);
    // Ortam yansıması (envMapIntensity 0,35): oda ortamından PMREM — tek seferlik, çalışma anı maliyeti yok
    try {
      const pmrem = new THREE.PMREMGenerator(render);
      sahne.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch (e) { console.error("[Deneme] ortam haritası:", e); }
    const gok = new THREE.HemisphereLight(0xeaf7ff, 0xd9c9a8, 0.95 * Math.PI);
    sahne.add(gok);
    const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
    gunes.position.set(28, 46, 20);
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(2048, 2048);
    Object.assign(gunes.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 160 });
    gunes.shadow.bias = -0.0012;
    sahne.add(gunes);
    /**
     * Işık A (Aşama 1) / B (Aşama 1B §7): güneş 42° yükseklik, 40° yandan; güneş/gök oranı 1,8;
     * PCF + radius 4 (PCFSoft radius'u yok sayar); gök alt rengi zemin taşı.
     */
    const isikAyarla = (b) => {
      if (b) {
        const el = THREE.MathUtils.degToRad(42), az = THREE.MathUtils.degToRad(40);
        gunes.position.set(Math.sin(az) * Math.cos(el) * 70, Math.sin(el) * 70, Math.cos(az) * Math.cos(el) * 70);
        // Ölçüldü (A/B ekran görüntüleri): 1,6/0,9 + ortam haritası sahneyi pastel beyaza yıkıyordu.
        // Güneş/gök oranı 2,5, ortam haritası 0,25 — renk doygun kalır, form çıkar, beyazlar patlamaz.
        gunes.intensity = 1.15 * Math.PI; gok.intensity = 0.45 * Math.PI; gok.groundColor.set(0xe8dfcb);
        sahne.environmentIntensity = 0.25;
        render.shadowMap.type = THREE.PCFShadowMap; gunes.shadow.radius = 4;
      } else {
        gunes.position.set(28, 46, 20); gunes.intensity = 1.05 * Math.PI; gok.intensity = 0.95 * Math.PI; gok.groundColor.set(0xd9c9a8);
        sahne.environmentIntensity = 0; // Aşama 1'de ortam haritası yoktu
        render.shadowMap.type = THREE.PCFSoftShadowMap; gunes.shadow.radius = 1;
      }
      render.shadowMap.needsUpdate = true;
      sahne.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    };
    const kam = new THREE.PerspectiveCamera(40, W / H, 0.3, 300);
    const kontrol = new OrbitControls(kam, render.domElement);
    kontrol.maxPolarAngle = Math.PI * 0.49;
    kontrol.minDistance = 2; kontrol.maxDistance = 60;
    const kameraAyarla = (ad) => {
      const k = KAMERALAR[ad] ?? KAMERALAR.genis;
      const e = THREE.MathUtils.degToRad(k.egim), yaw = THREE.MathUtils.degToRad(k.yaw);
      kontrol.target.set(...k.hedef);
      kam.position.set(k.hedef[0] + Math.sin(yaw) * Math.cos(e) * k.uzak, k.hedef[1] + Math.sin(e) * k.uzak, k.hedef[2] + Math.cos(yaw) * Math.cos(e) * k.uzak);
      kam.fov = k.fov; kam.updateProjectionMatrix(); kontrol.update();
    };
    kameraAyarla("genis");

    // zemin: kaldırım (yakın) + asfalt şeridi (z 2..10). roughness 0,82 (tam mat değil)
    const zeminMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcb, roughness: 0.82, metalness: 0, envMapIntensity: 0.35 });
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), zeminMat);
    zemin.rotation.x = -Math.PI / 2; zemin.receiveShadow = true; sahne.add(zemin);
    const asfalt = new THREE.Mesh(new THREE.PlaneGeometry(120, 8), new THREE.MeshStandardMaterial({ color: 0x7a808a, roughness: 0.82, envMapIntensity: 0.35 }));
    asfalt.rotation.x = -Math.PI / 2; asfalt.position.set(0, 0.01, 6); asfalt.receiveShadow = true; sahne.add(asfalt);

    const yukleyici = new GLTFLoader();
    const dokuYukleyici = new THREE.TextureLoader();
    const mixerler = [];
    let esas = null, klipler = [], kozmetikKaynak = {}, kopyalar = [], binaMesh = null, capaGrubu = null;
    let atlasEski = null, atlasYeniDoku = null;
    const atlasOrijinal = new Map(); // her GLB kendi Texture nesnesini getirir → malzeme başına saklanır
    const malzemeler = [];
    const saat = new THREE.Clock();
    let dondur = false; // çapa testinde kareler donuk

    const kozmetikTak = (kok, ad, ac) => {
      const yuva = kok.getObjectByName(KOZMETIK[ad]);
      if (!yuva) return;
      const eski = yuva.getObjectByName("kozmetik_" + ad);
      if (eski && !ac) yuva.remove(eski);
      // Kozmetik gölge atmaz (STIL §2.3: küçük parça gölge geçişine girmez) → karakter başına 1 gölge çağrısı
      if (!eski && ac && kozmetikKaynak[ad]) { const m = kozmetikKaynak[ad].clone(); m.castShadow = false; yuva.add(m); }
    };
    const klipOynat = (kok, ad, mixer, zaman = null) => {
      const c = klipler.find((k) => k.name === ad);
      if (!c) return;
      mixer.stopAllAction();
      const a = mixer.clipAction(c); a.reset().play();
      a.time = zaman ?? Math.random() * c.duration;
      if (zaman !== null) mixer.update(0);
    };
    const malzemeTopla = (kok) => { kok.traverse((o) => { if (o.material && !malzemeler.includes(o.material)) malzemeler.push(o.material); }); };

    // ---- zemin temas gölgeleri: tek InstancedMesh, tüm karakter + prop'lar ----
    const temasDoku = dokuYukleyici.load(KOK + "temas.png");
    const temasMat = new THREE.MeshBasicMaterial({ map: temasDoku, transparent: true, depthWrite: false, opacity: 0.55 });
    const temas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), temasMat, 200);
    temas.count = 0; temas.frustumCulled = false; temas.renderOrder = 1; sahne.add(temas);
    const temasHedefler = []; // { nesne, r }
    const tM = new THREE.Matrix4(), tP = new THREE.Vector3(), tQ = new THREE.Quaternion(), tS = new THREE.Vector3();
    const temasGuncelle = () => {
      let i = 0;
      for (const h of temasHedefler) {
        if (!h.nesne.visible || !h.nesne.parent || i >= 200) continue;
        h.nesne.getWorldPosition(tP); tP.y = 0.02;
        tM.compose(tP, tQ, tS.set(h.r, 1, h.r));
        temas.setMatrixAt(i++, tM);
      }
      temas.count = i; temas.instanceMatrix.needsUpdate = true;
    };

    // ---- çevre: her prop tek InstancedMesh, düzenli yerleşim (kaldırım hattı) ----
    const cevreGrubu = new THREE.Group(); cevreGrubu.name = "Cevre"; sahne.add(cevreGrubu);
    const yerlesim = () => {
      const agac = [], lamba = [], bank = [], saksi = [];
      // İki kaldırım hattı: yakın (z=1.2, bina önü) ve uzak (z=10.8). Ağaç her 6 m, lamba aralarda her 12 m.
      for (let x = -36; x <= 36; x += 6) {
        if (Math.abs(x) > 6.5) agac.push([x, 0, 1.2, 0.9 + (Math.abs(x) % 3) * 0.08]);   // bina önü boş kalır
        agac.push([x + 3, 0, 10.8, 0.85 + (Math.abs(x) % 3) * 0.1]);
      }
      agac.push([-39, 0, 10.8, 0.95]); // 24. ağaç
      for (let x = -33; x <= 33; x += 12) { lamba.push([x, 0, 1.4, 0]); lamba.push([x + 6, 0, 10.6, Math.PI]); }
      for (let x = -30; x <= 30; x += 12) { if (Math.abs(x) > 6) bank.push([x, 0, 1.6, 0]); bank.push([x + 6, 0, 10.4, Math.PI]); }
      for (let x = -33; x <= 33; x += 6) { saksi.push([x + 1.5, 0, 1.0, 0.8 + (Math.abs(x) % 2) * 0.35]); saksi.push([x - 1.5, 0, 11.0, 0.9]); }
      return { agac: agac.slice(0, 24), lamba: lamba.slice(0, 12), bank: bank.slice(0, 10), saksi: saksi.slice(0, 16) };
    };
    const cevreKur = (propMesh) => {
      const Y = yerlesim(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      // k: ölçek (olcekli) ya da yön (donerek)
      const kur = (ad, liste, olcekli = false, donerek = false, temasR = 1) => {
        const kaynak = propMesh[ad]; if (!kaynak) return;
        const im = new THREE.InstancedMesh(kaynak.geometry, kaynak.material, liste.length);
        liste.forEach(([x, y, z, k], i) => {
          const olc = olcekli ? k : 1;
          q.setFromEuler(new THREE.Euler(0, donerek ? k : (i * 0.7) % (Math.PI * 2), 0));
          M.compose(p.set(x, y, z), q, s.set(olc, olc, olc)); im.setMatrixAt(i, M);
          if (temasR > 0) temasHedefler.push({ nesne: { visible: true, parent: cevreGrubu, getWorldPosition: (v) => v.set(x, 0, z) }, r: temasR * olc });
        });
        // Küçük prop (bank, saksı) gölge atmaz: temas gölgesi yeter, gölge geçişi çağrısı düşer
        im.castShadow = !/bank|saksi|lamba/.test(ad); im.receiveShadow = true; im.name = ad; cevreGrubu.add(im);
      };
      kur("prop_agac_govde", Y.agac, true, false, 1.6); kur("prop_agac_tac", Y.agac, true, false, 0);
      kur("prop_lamba", Y.lamba, false, true, 0.8); kur("prop_bank", Y.bank, false, true, 2.2); kur("prop_saksi", Y.saksi, true, false, 1.1);
      if (propMesh.bordur) { const b = propMesh.bordur.clone(); b.name = "bordur"; b.receiveShadow = true; b.castShadow = false; cevreGrubu.add(b); } // 16 cm bordür gölgesi görünmez, çağrı harcamaz
      temasGuncelle();
    };

    Promise.all([
      yukleyici.loadAsync(KOK + "karakter_insan.glb"),
      yukleyici.loadAsync(KOK + "bina_dukkan.glb"),
      ...PROPLAR.map((p) => yukleyici.loadAsync(KOK + p + ".glb").catch((e) => { console.error("[Deneme] prop:", p, e); return null; })),
      dokuYukleyici.loadAsync(KOK + "atlas_eski.png").catch(() => null),
    ])
      .then(([k, b, ...kalan]) => {
        if (iptal) return;
        const propGltf = kalan.slice(0, PROPLAR.length), eskiDoku = kalan[PROPLAR.length];
        esas = k.scene;
        klipler = k.animations;
        esas.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        const kozGrup = esas.getObjectByName("Kozmetikler");
        if (kozGrup) { kozGrup.parent.remove(kozGrup); for (const m of kozGrup.children) kozmetikKaynak[m.name.replace("kozmetik_", "")] = m; }
        esas.position.set(0, 0, 2);
        sahne.add(esas);
        const mixer = new THREE.AnimationMixer(esas); mixerler.push(mixer);
        klipOynat(esas, "Idle", mixer);
        for (const ad of Object.keys(KOZMETIK)) kozmetikTak(esas, ad, true);
        temasHedefler.push({ nesne: esas, r: 0.9 });
        malzemeTopla(esas); for (const m of Object.values(kozmetikKaynak)) malzemeTopla(m);
        binaMesh = b.scene;
        binaMesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        binaMesh.position.set(0, 0, -6);
        sahne.add(binaMesh); malzemeTopla(binaMesh);
        // Tabela metni: oyunda olduğu gibi çalışma anında canvas (iki dil)
        const c = document.createElement("canvas"); c.width = 512; c.height = 96;
        const x = c.getContext("2d"); x.font = '800 60px "Baloo 2", "Nunito", sans-serif'; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
        x.shadowColor = "rgba(0,0,0,.3)"; x.shadowOffsetY = 3; x.fillText("Lig · League", 256, 48);
        const doku = new THREE.CanvasTexture(c); doku.colorSpace = THREE.SRGBColorSpace;
        const yazi = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.8), new THREE.MeshBasicMaterial({ map: doku, transparent: true }));
        yazi.position.set(0, 0.18 + 3.8 + 0.28 + 0.46, -6 + 4 + 0.22);
        sahne.add(yazi);
        // çevre prop'ları
        const propMesh = {};
        propGltf.forEach((g, i) => { if (!g) return; g.scene.traverse((o) => { if (o.isMesh) propMesh[PROPLAR[i]] = o; }); });
        cevreKur(propMesh); malzemeTopla(cevreGrubu);
        for (const m of malzemeler) m.envMapIntensity = 0.35;
        // atlas A/B: yeni doku GLB'den geldi; eski doku aynı ayarlarla
        atlasYeniDoku = malzemeler.find((m) => m.map)?.map ?? null;
        if (eskiDoku && atlasYeniDoku) {
          atlasEski = eskiDoku; atlasEski.flipY = false; atlasEski.colorSpace = THREE.SRGBColorSpace;
          atlasEski.wrapS = atlasEski.wrapT = THREE.ClampToEdgeWrapping; atlasEski.needsUpdate = true;
        }
        setDurum({ hazir: true, hata: null });
      })
      .catch((e) => { console.error("[Deneme] yükleme:", e); if (!iptal) setDurum({ hazir: false, hata: String(e?.message ?? e) }); });

    const kopyaAyarla = (n) => {
      for (const k of kopyalar) { sahne.remove(k.kok); k.mixer.stopAllAction(); const i = temasHedefler.findIndex((h) => h.nesne === k.kok); if (i >= 0) temasHedefler.splice(i, 1); }
      kopyalar = []; mixerler.length = Math.min(mixerler.length, 1);
      if (!esas) return;
      for (let i = 0; i < n; i++) {
        const kok = iskeletKopyala(esas);
        const col = i % 6, row = Math.floor(i / 6);
        kok.position.set(-7.5 + col * 3, 0, 4 + row * 2.0);
        kok.rotation.y = (Math.random() - 0.5) * 1.2;
        const mixer = new THREE.AnimationMixer(kok);
        klipOynat(kok, KLIPLER[i % 3], mixer);
        // Kozmetik dağılımı deterministik (%60): ölçüm her yüklemede aynı çıksın
        Object.keys(KOZMETIK).forEach((ad, j) => { const yuva = kok.getObjectByName(KOZMETIK[ad]); yuva?.clear(); kozmetikTak(kok, ad, (i * 7 + j * 3) % 5 < 3); });
        sahne.add(kok); mixerler.push(mixer); kopyalar.push({ kok, mixer }); temasHedefler.push({ nesne: kok, r: 0.9 });
      }
      temasGuncelle();
    };

    /** Çapa testi: 9 donuk kare yan yana, her yuvada 10 cm eksen işareti, tüm kozmetikler takılı. */
    const capaAyarla = (ac) => {
      if (capaGrubu) { sahne.remove(capaGrubu); capaGrubu = null; }
      dondur = ac;
      if (esas) esas.visible = !ac;
      if (!ac || !esas) return;
      kameraAyarla("capa");
      capaGrubu = new THREE.Group(); capaGrubu.name = "CapaTesti";
      CAPA_KARELERI.forEach(([ad, t], i) => {
        const kok = iskeletKopyala(esas); kok.visible = true;
        kok.position.set(-6.4 + i * 1.6, 0, 3.5);
        const mixer = new THREE.AnimationMixer(kok);
        klipOynat(kok, ad, mixer, t);
        for (const k of Object.keys(KOZMETIK)) { const yuva = kok.getObjectByName(KOZMETIK[k]); yuva?.clear(); kozmetikTak(kok, k, true); }
        kok.traverse((o) => { if (/Yuva|capeRoot/.test(o.name)) o.add(new THREE.AxesHelper(0.1)); });
        kok.updateMatrixWorld(true);
        capaGrubu.add(kok);
      });
      sahne.add(capaGrubu);
    };

    // ---- döngü: gizli sekmede (otomasyon) Worker zamanlayıcısı ----
    let kare = 0, sonOlc = performance.now(), sure = 0, calisiyor = true;
    const cizim = () => {
      const dt = Math.min(0.1, saat.getDelta());
      if (!esas) return;
      if (!dondur) for (const m of mixerler) m.update(dt);
      kontrol.update();
      temasGuncelle();
      const t0 = performance.now();
      render.render(sahne, kam);
      sure += performance.now() - t0;
      kare++;
      const simdi = performance.now();
      if (simdi - sonOlc >= 500) {
        const i = render.info.render;
        setOlc({ cagri: i.calls, ucgen: i.triangles, fps: Math.round(kare * 1000 / (simdi - sonOlc)), ms: +(sure / kare).toFixed(2), kopya: 1 + kopyalar.length });
        kare = 0; sure = 0; sonOlc = simdi;
      }
    };
    let raf = 0, worker = null;
    const otomasyon = new URLSearchParams(location.search).has("otomasyon");
    if (otomasyon) {
      worker = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),16)"])));
      worker.onmessage = () => { if (calisiyor) cizim(); };
    } else {
      const dongu = () => { if (!calisiyor) return; if (!document.hidden) cizim(); raf = requestAnimationFrame(dongu); };
      raf = requestAnimationFrame(dongu);
    }
    const boyut = () => { W = kap.clientWidth || innerWidth; H = kap.clientHeight || innerHeight; kam.aspect = W / H; kam.updateProjectionMatrix(); render.setSize(W, H); };
    addEventListener("resize", boyut);

    apiRef.current = {
      klip: (ad) => { if (esas && mixerler[0]) klipOynat(esas, ad, mixerler[0]); },
      kozmetik: (ad, ac) => { if (esas) kozmetikTak(esas, ad, ac); },
      kopya: (n) => kopyaAyarla(n),
      capa: (ac) => capaAyarla(ac),
      cevre: (ac) => { cevreGrubu.visible = ac; },
      golge: (ac) => { render.shadowMap.enabled = ac; sahne.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); },
      ao: (ac) => { for (const m of malzemeler) { m.vertexColors = ac; m.needsUpdate = true; } },
      atlas: (yeni) => {
        if (!atlasEski) return false;
        for (const m of malzemeler) {
          if (!atlasOrijinal.has(m)) { if (!m.map || m.map === temasDoku) continue; atlasOrijinal.set(m, m.map); }
          m.map = yeni ? atlasOrijinal.get(m) : atlasEski; m.needsUpdate = true;
        }
        return true;
      },
      isik: (b) => isikAyarla(b),
      kamera: (ad) => kameraAyarla(ad),
      bak: (p, h) => { kam.position.set(...p); kontrol.target.set(...h); kontrol.update(); },
      olc: () => { const i = render.info.render; return { cagri: i.calls, ucgen: i.triangles, kopya: 1 + kopyalar.length, geometri: render.info.memory.geometries, doku: render.info.memory.textures, program: render.info.programs.length }; },
      kareSuresi: (n = 30) => { const gl = render.getContext(); const t0 = performance.now(); for (let i = 0; i < n; i++) { cizim(); gl.finish(); } return +((performance.now() - t0) / n).toFixed(2); },
      sahne, render, kam, kemikSay: () => { let n = 0; esas?.traverse((o) => { if (o.isBone) n++; }); return n; },
      yuvalar: () => { const l = []; esas?.traverse((o) => { if (/Yuva|capeRoot/.test(o.name)) l.push(o.name); }); return l; },
    };
    window.__deneme = apiRef.current;
    isikAyarla(true);

    return () => {
      iptal = true; calisiyor = false;
      cancelAnimationFrame(raf); worker?.terminate();
      removeEventListener("resize", boyut);
      kontrol.dispose();
      sahne.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      sahne.environment?.dispose?.();
      render.dispose();
      kap.contains(render.domElement) && kap.removeChild(render.domElement);
      delete window.__deneme;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { apiRef.current?.klip(klip); }, [klip, durum.hazir]);
  useEffect(() => { for (const ad of Object.keys(KOZMETIK)) apiRef.current?.kozmetik(ad, koz[ad]); }, [koz, durum.hazir]);
  useEffect(() => { apiRef.current?.kopya(kalabalik ? 24 : 0); }, [kalabalik, durum.hazir]);
  useEffect(() => { apiRef.current?.golge(golge); }, [golge]);
  useEffect(() => { apiRef.current?.ao(ao); }, [ao, durum.hazir]);
  useEffect(() => { apiRef.current?.atlas(atlasYeni); }, [atlasYeni, durum.hazir]);
  useEffect(() => { apiRef.current?.capa(capa); }, [capa, durum.hazir]);
  useEffect(() => { apiRef.current?.cevre(cevre); }, [cevre, durum.hazir]);
  useEffect(() => { apiRef.current?.isik(isikB); }, [isikB]);
  useEffect(() => { apiRef.current?.kamera(kamera); }, [kamera]);

  const D = ({ ac, onClick, children }) => <button className={ac ? "aktif" : ""} onClick={onClick}>{children}</button>;

  return (
    <div className="hd-sayfa">
      <div className="hd-kanvas" ref={kapRef} />
      <div className="hd-ust">
        <a className="hd-geri" href="/">‹ Oyuna dön</a>
        <div className="hd-olc">
          <b>{olc.cagri}</b> çağrı · <b>{olc.ucgen.toLocaleString("tr-TR")}</b> üçgen · <b>{olc.fps}</b> fps · {olc.ms} ms · {olc.kopya} karakter
        </div>
      </div>
      {!durum.hazir && <div className="hd-perde">{durum.hata ? "Yüklenemedi: " + durum.hata : "Varlıklar yükleniyor…"}</div>}
      <div className="hd-alt">
        <div className="hd-grup">
          {KLIPLER.map((k) => <D key={k} ac={klip === k} onClick={() => setKlip(k)}>{k}</D>)}
        </div>
        <div className="hd-grup">
          {Object.keys(KOZMETIK).map((k) => <D key={k} ac={koz[k]} onClick={() => setKoz({ ...koz, [k]: !koz[k] })}>{k}</D>)}
        </div>
        <div className="hd-grup">
          <D ac={kalabalik} onClick={() => setKalabalik(!kalabalik)}>25 karakter</D>
          <D ac={golge} onClick={() => setGolge(!golge)}>gölge</D>
          <D ac={cevre} onClick={() => setCevre(!cevre)}>çevre</D>
        </div>
        <div className="hd-grup">
          <D ac={ao} onClick={() => setAo(!ao)}>AO</D>
          <D ac={atlasYeni} onClick={() => setAtlasYeni(!atlasYeni)}>{atlasYeni ? "atlas: yeni" : "atlas: eski"}</D>
          <D ac={isikB} onClick={() => setIsikB(!isikB)}>{isikB ? "ışık B" : "ışık A"}</D>
          <D ac={capa} onClick={() => setCapa(!capa)}>çapa testi</D>
        </div>
        <div className="hd-grup">
          {[["genis", "Geniş"], ["oyun", "Oyun"], ["foto", "Fotoğraf"]].map(([k, ad]) => <D key={k} ac={kamera === k} onClick={() => setKamera(k)}>{ad}</D>)}
        </div>
      </div>
    </div>
  );
}
