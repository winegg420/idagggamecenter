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
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
// 2B §1: karakter sistemi ORTAK MODÜLDE (bildim/harita/karakter/) — bu sayfa ve gerçek harita aynı kaynağı kullanır
import { KarakterSistemi, atlasCilala, KLIPLER, TURLER, KOZMETIK, SETLER, TENLER, SACLAR, USTLER, ALTLAR, AYAKLAR } from "../karakter/karakter.js";
import { ifadeAyarla as ifadeAyarlaM } from "../karakter/ifade.js";
import { PetSistemi } from "../karakter/pet.js";               // 1G B.4: kedi · köpek · kuş (tür başına 1 InstancedMesh)
import "./deneme.css";

const KOK = "/meydan/deneme/";
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
// Kıyafet setleri, ton paletleri, pürüz/metal tabloları → karakter/karakter.js

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

    // ---- TEK MALZEME CİLASI (Aşama 1C §5.1) → karakter/karakter.js atlasCilala ----
    const cilala = atlasCilala;

    const yukleyici = new GLTFLoader();
    const dokuYukleyici = new THREE.TextureLoader();
    // 2B §1: karakter sistemi (yükleme, görünüm, kozmetik, ifade, klip, süzülme, VFX) ortak modülden
    const ks = new KarakterSistemi({ sahne, vfxAyar: VFX_AYAR });
    const mixerler = ks.mixerler;
    const turVeri = ks.turVeri;                       // tur → { sahne, klipler, kozmetikler, mesh }
    let esas = null, kopyalar = [], capaGrubu = null, binaMesh = null, propMesh = {};
    let dokular = { yeni: null, eski: null, yaprakEski: null };
    const malzemeler = [];
    const saat = new THREE.Clock();
    let dondur = false;
    const durumu = { tur: "insan", set: 1, koz: { sapka: true, gozluk: true, atki: true, gozlukPremium: false, kanat: false }, klip: "Idle", ifade: "normal" };

    const malzemeTopla = (kok) => { kok.traverse((o) => { if (o.material) { cilala(o.material); if (!malzemeler.includes(o.material)) malzemeler.push(o.material); } }); };

    // ---- Görünüm · ifade · göz kırpma · kozmetik · klip · karakter kurma → karakter/ modülü (ince sarmalayıcılar) ----
    const gorunumUygula = (kok, g) => ks.gorunum(kok, g);
    const ifadeAyarla = (kok, gozAd, agizAd) => ifadeAyarlaM(kok, gozAd, agizAd);
    const canlilar = ks.canlilar;
    const canliSil = (kok) => ks.canliSil(kok);
    const ifadeSec = (kok, ad) => ks.ifade(kok, ad);
    const kozmetikTak = (kok, ad, ac) => ks.kozmetik(kok, ad, ac);
    const klipOynat = (kok, ad, mixer, zaman = null) => ks.klip(kok, ad, zaman);
    /** Yeni karakter kökü: türün GLB'sinden iskelet kopyası + klipler + mixer + kozmetik/kuyruk + görünüm + ifade. */
    const karakterYap = (tur, g, kozmetikler) => (turVeri[tur] ? ks.kur(tur, g, kozmetikler) : null);
    const karakterSil = (kok) => { ks.sil(kok); petSistemi?.kaldir(kok); const j = temasHedefler.findIndex((h) => h.nesne === kok); if (j >= 0) temasHedefler.splice(j, 1); };

    // ---- zemin temas gölgeleri ----
    const temasDoku = dokuYukleyici.load(KOK + "temas.png");
    const temas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: temasDoku, transparent: true, depthWrite: false, opacity: 0.55 }), 200);
    temas.count = 0; temas.frustumCulled = false; temas.renderOrder = 1; sahne.add(temas);
    const temasHedefler = [];
    // ---- 1G K1: TEK paylaşılan VFX kiti — karakter sistemi tutar ----
    const vfxKit = ks.vfx;
    let petSistemi = null;
    // 1G-B.2 süzülme / zıplama görseli / VFX sanal hızı → KarakterSistemi.kare()
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
      ks.yukle(yukleyici),
      yukleyici.loadAsync(KOK + "bina_dukkan.glb"),
      ...PROPLAR.map((p) => yukleyici.loadAsync(KOK + p + ".glb").catch((e) => { console.error("[Deneme] prop:", p, e); return null; })),
      dokuYukleyici.loadAsync(KOK + "atlas_eski.png").catch(() => null),
      dokuYukleyici.loadAsync(KOK + "atlas_yaprakEski.png").catch(() => null),
    ])
      .then((sonuc) => {
        if (iptal) return;
        const b = sonuc[1], propGltf = sonuc.slice(2, 2 + PROPLAR.length);
        const [eskiDoku, yaprakDoku] = sonuc.slice(2 + PROPLAR.length);
        for (const m of ks.malzemeler) if (!malzemeler.includes(m)) malzemeler.push(m);
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
      const t = performance.now();
      kediGuncelle(dt, zaman);
      ks.kare(dt, zaman, kam, { dondur });   // 2B §1: animasyon · kırpma · baş eğimi · kuyruk · süzülme/zıplama · VFX
      petSistemi?.guncelle(dt, zaman);
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
