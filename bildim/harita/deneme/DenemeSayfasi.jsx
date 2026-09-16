// ============================================================
// HARİTA YENİLEME — AŞAMA 1 TEST SAHNESİ  (/harita-deneme)
//
// Tek karakter + tek bina, STIL.md ışık kurulumunda, glTF'ten yüklenir.
// Kanıtlanan zincir: GLB yükleme · Mixamo iskeletli animasyon · kozmetik
// yuvaları · karakter başına çizim çağrısı · 25 kopyada FPS.
// Oyun koduna dokunmaz; yalnız bu rota. Ölçüm için window.__deneme.
// ============================================================
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as iskeletKopyala } from "three/addons/utils/SkeletonUtils.js";
import "./deneme.css";

const KOK = "/meydan/deneme/";
const KLIPLER = ["Idle", "Walk", "Run", "Selam"];
const KOZMETIK = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva" };

export default function DenemeSayfasi() {
  const kapRef = useRef(null);
  const apiRef = useRef(null);
  const [durum, setDurum] = useState({ hazir: false, hata: null });
  const [olc, setOlc] = useState({ cagri: 0, ucgen: 0, fps: 0, ms: 0, kopya: 1 });
  const [klip, setKlip] = useState("Idle");
  const [koz, setKoz] = useState({ sapka: true, gozluk: true, atki: false });
  const [kalabalik, setKalabalik] = useState(false);
  const [golge, setGolge] = useState(true);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;
    let iptal = false;
    let W = kap.clientWidth || innerWidth, H = kap.clientHeight || innerHeight;

    // ---- render + ışık (STIL.md §2.6) ----
    const render = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    render.setSize(W, H);
    render.shadowMap.enabled = true;
    render.shadowMap.type = THREE.PCFSoftShadowMap;
    render.toneMapping = THREE.ACESFilmicToneMapping;
    render.toneMappingExposure = 1.0;
    kap.appendChild(render.domElement);
    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color(0xbfe8ff);
    sahne.fog = new THREE.Fog(0xcdeeff, 85, 190);
    sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0xd9c9a8, 0.95 * Math.PI));
    const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
    gunes.position.set(28, 46, 20);
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(2048, 2048);
    Object.assign(gunes.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 140 });
    gunes.shadow.bias = -0.0012;
    sahne.add(gunes);
    const kamera = new THREE.PerspectiveCamera(W > H ? 42 : 48, W / H, 0.3, 300);
    kamera.position.set(7, 6.5, 15);
    const kontrol = new OrbitControls(kamera, render.domElement);
    kontrol.target.set(0, 2.6, -3);
    kontrol.maxPolarAngle = Math.PI * 0.49;
    kontrol.minDistance = 3; kontrol.maxDistance = 40;
    kontrol.update();

    // zemin: kaldırım taşı (atlas yüklenince dokusu bağlanır)
    const zeminMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcb, roughness: 1, metalness: 0 });
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), zeminMat);
    zemin.rotation.x = -Math.PI / 2; zemin.receiveShadow = true; sahne.add(zemin);
    const asfalt = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshStandardMaterial({ color: 0x7a808a, roughness: 1 }));
    asfalt.rotation.x = -Math.PI / 2; asfalt.position.set(0, 0.01, 6); asfalt.receiveShadow = true; sahne.add(asfalt);

    const yukleyici = new GLTFLoader();
    const mixerler = [];
    let esas = null, klipler = [], kozmetikKaynak = {}, kopyalar = [], binaMesh = null;
    const saat = new THREE.Clock();

    const kozmetikTak = (kok, ad, ac) => {
      const yuva = kok.getObjectByName(KOZMETIK[ad]);
      if (!yuva) return;
      const eski = yuva.getObjectByName("kozmetik_" + ad);
      if (eski && !ac) yuva.remove(eski);
      if (!eski && ac && kozmetikKaynak[ad]) { const m = kozmetikKaynak[ad].clone(); m.castShadow = true; yuva.add(m); }
    };
    const klipOynat = (kok, ad, mixer) => {
      const c = klipler.find((k) => k.name === ad);
      if (!c) return;
      mixer.stopAllAction();
      const a = mixer.clipAction(c); a.reset().play();
      a.time = Math.random() * c.duration;
    };

    Promise.all([yukleyici.loadAsync(KOK + "karakter_insan.glb"), yukleyici.loadAsync(KOK + "bina_dukkan.glb")])
      .then(([k, b]) => {
        if (iptal) return;
        esas = k.scene;
        klipler = k.animations;
        // atlas: en yakın filtre değil, ama keskin kenar — mip kapalı değil
        esas.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        const kozGrup = esas.getObjectByName("Kozmetikler");
        if (kozGrup) { kozGrup.parent.remove(kozGrup); for (const m of kozGrup.children) kozmetikKaynak[m.name.replace("kozmetik_", "")] = m; }
        esas.position.set(0, 0, 2);
        sahne.add(esas);
        const mixer = new THREE.AnimationMixer(esas); mixerler.push(mixer);
        klipOynat(esas, "Idle", mixer);
        for (const ad of Object.keys(KOZMETIK)) kozmetikTak(esas, ad, koz[ad]);
        binaMesh = b.scene;
        binaMesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        binaMesh.position.set(0, 0, -6);
        sahne.add(binaMesh);
        // Tabela metni: oyunda olduğu gibi çalışma anında canvas (iki dil)
        const c = document.createElement("canvas"); c.width = 512; c.height = 96;
        const x = c.getContext("2d"); x.font = '800 60px "Baloo 2", "Nunito", sans-serif'; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
        x.shadowColor = "rgba(0,0,0,.3)"; x.shadowOffsetY = 3; x.fillText("Lig · League", 256, 48);
        const doku = new THREE.CanvasTexture(c); doku.colorSpace = THREE.SRGBColorSpace;
        const yazi = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.8), new THREE.MeshBasicMaterial({ map: doku, transparent: true }));
        yazi.position.set(0, 0.18 + 3.8 + 0.28 + 0.46, -6 + 4 + 0.22);
        sahne.add(yazi);
        setDurum({ hazir: true, hata: null });
      })
      .catch((e) => { console.error("[Deneme] yükleme:", e); if (!iptal) setDurum({ hazir: false, hata: String(e?.message ?? e) }); });

    const kopyaAyarla = (n) => {
      for (const k of kopyalar) { sahne.remove(k.kok); k.mixer.stopAllAction(); }
      kopyalar = []; mixerler.length = Math.min(mixerler.length, 1);
      if (!esas) return;
      for (let i = 0; i < n; i++) {
        const kok = iskeletKopyala(esas);
        const col = i % 6, row = Math.floor(i / 6);
        kok.position.set(-7.5 + col * 3, 0, 5 + row * 2.2);
        kok.rotation.y = (Math.random() - 0.5) * 1.2;
        const mixer = new THREE.AnimationMixer(kok);
        klipOynat(kok, KLIPLER[i % 3], mixer);
        for (const ad of Object.keys(KOZMETIK)) { const yuva = kok.getObjectByName(KOZMETIK[ad]); yuva?.clear(); kozmetikTak(kok, ad, Math.random() < 0.6); }
        sahne.add(kok); mixerler.push(mixer); kopyalar.push({ kok, mixer });
      }
    };

    // ---- döngü: gizli sekmede (otomasyon) Worker zamanlayıcısı ----
    let kare = 0, sonOlc = performance.now(), sure = 0, calisiyor = true;
    const cizim = () => {
      const dt = Math.min(0.1, saat.getDelta());
      if (!esas) return;
      for (const m of mixerler) m.update(dt);
      kontrol.update();
      const t0 = performance.now();
      render.render(sahne, kamera);
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
    const boyut = () => { W = kap.clientWidth || innerWidth; H = kap.clientHeight || innerHeight; kamera.aspect = W / H; kamera.fov = W > H ? 42 : 48; kamera.updateProjectionMatrix(); render.setSize(W, H); };
    addEventListener("resize", boyut);

    apiRef.current = {
      klip: (ad) => { if (esas && mixerler[0]) klipOynat(esas, ad, mixerler[0]); },
      kozmetik: (ad, ac) => { if (esas) kozmetikTak(esas, ad, ac); },
      kopya: (n) => kopyaAyarla(n),
      golge: (ac) => { render.shadowMap.enabled = ac; sahne.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); },
      olc: () => { const i = render.info.render; return { cagri: i.calls, ucgen: i.triangles, kopya: 1 + kopyalar.length, geometri: render.info.memory.geometries, doku: render.info.memory.textures, program: render.info.programs.length }; },
      kareSuresi: (n = 30) => { const gl = render.getContext(); const t0 = performance.now(); for (let i = 0; i < n; i++) { cizim(); gl.finish(); } return +((performance.now() - t0) / n).toFixed(2); },
      bak: (p, h) => { kamera.position.set(...p); kontrol.target.set(...h); kontrol.update(); },
      sahne, render, kamera, kemikSay: () => { let n = 0; esas?.traverse((o) => { if (o.isBone) n++; }); return n; },
      yuvalar: () => { const l = []; esas?.traverse((o) => { if (/Yuva|capeRoot/.test(o.name)) l.push(o.name); }); return l; },
    };
    window.__deneme = apiRef.current;

    return () => {
      iptal = true; calisiyor = false;
      cancelAnimationFrame(raf); worker?.terminate();
      removeEventListener("resize", boyut);
      kontrol.dispose();
      sahne.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      render.dispose();
      kap.contains(render.domElement) && kap.removeChild(render.domElement);
      delete window.__deneme;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { apiRef.current?.klip(klip); }, [klip, durum.hazir]);
  useEffect(() => { for (const ad of Object.keys(KOZMETIK)) apiRef.current?.kozmetik(ad, koz[ad]); }, [koz, durum.hazir]);
  useEffect(() => { apiRef.current?.kopya(kalabalik ? 24 : 0); }, [kalabalik, durum.hazir]);
  useEffect(() => { apiRef.current?.golge(golge); }, [golge]);

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
          {KLIPLER.map((k) => <button key={k} className={klip === k ? "aktif" : ""} onClick={() => setKlip(k)}>{k}</button>)}
        </div>
        <div className="hd-grup">
          {Object.keys(KOZMETIK).map((k) => <button key={k} className={koz[k] ? "aktif" : ""} onClick={() => setKoz({ ...koz, [k]: !koz[k] })}>{k}</button>)}
        </div>
        <div className="hd-grup">
          <button className={kalabalik ? "aktif" : ""} onClick={() => setKalabalik(!kalabalik)}>25 karakter</button>
          <button className={golge ? "aktif" : ""} onClick={() => setGolge(!golge)}>gölge</button>
        </div>
      </div>
    </div>
  );
}
