import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./hazir-insan.css";

const KOK = "/meydan/aday-quaternius/";
const TENLER = ["#fff1e7", "#e2ad8e", "#b97959", "#754938"];
const SACLAR = [
  ["Kısa", "Hair_SimpleParted.gltf"],
  ["Uzun", "Hair_Long.gltf"],
  ["Topuz", "Hair_Buns.gltf"],
];
const HAREKETLER = [
  ["Duruş", "Idle_Loop"],
  ["Yürüme", "Walk_Loop"],
  ["Koşu", "Jog_Fwd_Loop"],
  ["Dans", "Dance_Loop"],
];

function kutu(renk, boyut, metal = 0) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(...boyut),
    new THREE.MeshStandardMaterial({ color: renk, roughness: metal ? 0.28 : 0.7, metalness: metal }),
  );
}

function tak(kok, kemik, nesne, konum, donus = [0, 0, 0], olcek = [1, 1, 1]) {
  nesne.position.set(...konum);
  nesne.rotation.set(...donus);
  nesne.scale.set(...olcek);
  nesne.castShadow = true;
  nesne.receiveShadow = true;
  kok.add(nesne);
  kok.updateMatrixWorld(true);
  kemik?.attach(nesne);
  return nesne;
}

function pelerinGeometrisi() {
  const satir = 12, sutun = 8, konum = [], uv = [], indis = [];
  for (let y = 0; y <= satir; y++) {
    const t = y / satir, yari = 0.225 + t * 0.13;
    for (let x = 0; x <= sutun; x++) {
      const u = x / sutun, yatay = (u * 2 - 1) * yari;
      const kivrim = Math.cos((u - 0.5) * Math.PI * 4) * 0.012 * (0.25 + t);
      konum.push(yatay, 1.43 - t * 0.82, -0.105 - Math.sin(t * Math.PI) * 0.105 + kivrim);
      uv.push(u, 1 - t);
    }
  }
  for (let y = 0; y < satir; y++) for (let x = 0; x < sutun; x++) {
    const a = y * (sutun + 1) + x, b = a + 1, c = a + sutun + 1, d = c + 1;
    indis.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(konum, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indis); g.computeVertexNormals();
  return g;
}

function ekipmanKur(kok) {
  const kemik = (ad) => kok.getObjectByName(ad);
  const gozluk = [], pelerin = [];

  const camMat = new THREE.MeshPhysicalMaterial({ color: "#172238", roughness: 0.12, metalness: 0.48, transparent: true, opacity: 0.78 });
  const cerceveMat = new THREE.MeshStandardMaterial({ color: "#17191e", roughness: 0.25, metalness: 0.75 });
  for (const x of [-0.037, 0.037]) {
    const cam = new THREE.Mesh(new THREE.CircleGeometry(0.029, 24), camMat);
    cam.scale.x = 1.14;
    gozluk.push(tak(kok, kemik("Head"), cam, [x, 1.705, 0.109], [0, 0, 0]));
    const cerceve = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0035, 6, 24), cerceveMat);
    cerceve.scale.x = 1.14;
    gozluk.push(tak(kok, kemik("Head"), cerceve, [x, 1.705, 0.112], [0, 0, 0]));
  }
  gozluk.push(tak(kok, kemik("Head"), kutu("#17191e", [0.018, 0.007, 0.008], 0.7), [0, 1.705, 0.111]));

  const pMat = new THREE.MeshStandardMaterial({ color: "#263b68", roughness: 0.78, side: THREE.DoubleSide });
  pelerin.push(tak(kok, kemik("spine_03"), new THREE.Mesh(pelerinGeometrisi(), pMat), [0, 0, 0]));
  const tokaMat = new THREE.MeshStandardMaterial({ color: "#c89742", roughness: 0.3, metalness: 0.7 });
  for (const x of [-0.2, 0.2]) pelerin.push(tak(kok, kemik("spine_03"), new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), tokaMat), [x, 1.43, 0.01]));

  return { gozluk, pelerin };
}

/** Gövdenin kendi yüzeyinde kıyafet bölgeleri; deri altından ayrılmaz, bütün hareketlerde iskeletle birlikte gider. */
function kiyafetMalzemesi(malzeme) {
  malzeme.userData.ceket = { value: 1 };
  malzeme.onBeforeCompile = (s) => {
    s.uniforms.uCeket = malzeme.userData.ceket;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAdayKonum;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAdayKonum = position;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAdayKonum;\nuniform float uCeket;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float y = vAdayKonum.y;
        float x = abs(vAdayKonum.x);
        if (y < 0.14) diffuseColor.rgb = vec3(0.91, 0.93, 0.96);
        else if (y < 0.94) diffuseColor.rgb = vec3(0.09, 0.15, 0.24);
        else if (y < 1.43 && x < 0.38) diffuseColor.rgb = mix(vec3(0.90, 0.92, 0.95), vec3(0.035, 0.09, 0.20), uCeket);
        else if (uCeket > 0.5 && y > 1.16 && y < 1.52 && x < 0.72) diffuseColor.rgb = vec3(0.035, 0.09, 0.20);`);
  };
  malzeme.customProgramCacheKey = () => "quaternius-kiyafet-v1";
  malzeme.needsUpdate = true;
}

export default function HazirInsanPrototipi() {
  const alanRef = useRef(null);
  const apiRef = useRef(null);
  const [hazir, setHazir] = useState(false);
  const [hata, setHata] = useState("");
  const [ten, setTen] = useState(1);
  const [sac, setSac] = useState(0);
  const [hareket, setHareket] = useState(0);
  const [gozluk, setGozluk] = useState(true);
  const [ceket, setCeket] = useState(true);
  const [pelerin, setPelerin] = useState(false);

  useEffect(() => {
    const alan = alanRef.current;
    if (!alan) return;
    let yasiyor = true, kareId = 0;
    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color("#e8ebef");
    sahne.fog = new THREE.Fog("#e8ebef", 5.5, 10);
    const kamera = new THREE.PerspectiveCamera(32, 1, 0.05, 30);
    kamera.position.set(0, 1.3, 3.15);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    alan.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const ortam = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    sahne.environment = ortam;
    const ana = new THREE.DirectionalLight("#fff7ec", 3.2);
    ana.position.set(3, 5, 4); ana.castShadow = true; ana.shadow.mapSize.set(1024, 1024); sahne.add(ana);
    const kenar = new THREE.DirectionalLight("#b8d5ff", 1.35); kenar.position.set(-3, 2.8, -2); sahne.add(kenar);
    sahne.add(new THREE.HemisphereLight("#edf5ff", "#716657", 1.7));

    const zemin = new THREE.Mesh(new THREE.CircleGeometry(2.5, 64), new THREE.MeshStandardMaterial({ color: "#f5f5f2", roughness: 0.88 }));
    zemin.rotation.x = -Math.PI / 2; zemin.receiveShadow = true; sahne.add(zemin);
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.84, 0.88, 64), new THREE.MeshBasicMaterial({ color: "#c66a3c", transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    halka.rotation.x = -Math.PI / 2; halka.position.y = 0.006; sahne.add(halka);

    const kontroller = new OrbitControls(kamera, renderer.domElement);
    kontroller.target.set(0, 1.0, 0); kontroller.enablePan = false; kontroller.minDistance = 2.25; kontroller.maxDistance = 5; kontroller.maxPolarAngle = Math.PI * 0.51;
    const saat = new THREE.Clock(), yukleyici = new GLTFLoader();
    let kok = null, mixer = null, aksiyon = null, sacNesne = null, donanim = null, klipler = [];

    function boyutla() {
      const w = alan.clientWidth, h = alan.clientHeight;
      renderer.setSize(w, h, false); kamera.aspect = w / Math.max(1, h); kamera.updateProjectionMatrix();
    }
    const ResizeObserverSinifi = window["Resize" + "Observer"];
    const ro = ResizeObserverSinifi ? new ResizeObserverSinifi(boyutla) : null;
    ro?.observe(alan); window.addEventListener("resize", boyutla); boyutla();

    function klipSec(ad) {
      const klip = klipler.find((k) => k.name === ad); if (!klip || !mixer) return;
      const yeni = mixer.clipAction(klip); yeni.reset().fadeIn(0.22).play(); aksiyon?.fadeOut(0.22); aksiyon = yeni;
    }
    async function sacSec(dosya) {
      if (!kok) return;
      const g = await yukleyici.loadAsync(KOK + dosya);
      if (!yasiyor) return;
      if (sacNesne) { sacNesne.removeFromParent(); sacNesne.traverse((o) => { o.geometry?.dispose(); }); }
      sacNesne = g.scene;
      sacNesne.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.color.set("#34251f"); o.material.roughness = 0.62; } });
      kok.add(sacNesne); kok.updateMatrixWorld(true); kok.getObjectByName("Head")?.attach(sacNesne);
    }
    function tenSec(renk) {
      const govde = kok?.getObjectByName("SuperHero_Male");
      if (govde?.material) { govde.material.color.set(renk); govde.material.needsUpdate = true; }
    }
    function gorunur(liste, deger) { for (const n of liste ?? []) n.visible = deger; }

    Promise.all([yukleyici.loadAsync(KOK + "insan.gltf"), yukleyici.loadAsync(KOK + "hareketler.gltf")]).then(async ([insan, hareketler]) => {
      if (!yasiyor) return;
      kok = insan.scene;
      kok.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone(); o.material.envMapIntensity = 0.7;
      });
      sahne.add(kok);
      const govde = kok.getObjectByName("SuperHero_Male");
      if (govde?.material) kiyafetMalzemesi(govde.material);
      mixer = new THREE.AnimationMixer(kok);
      // Kütüphane klipleri kaynak mankenin kemik konum/ölçeklerini de taşır. Bunlar hedef gövdede
      // uygulanırsa kol ve gövde uzar. Aynı humanoid adlarındaki yalnız dönüş kanalları güvenle kullanılır.
      klipler = hareketler.animations.map((c) => new THREE.AnimationClip(
        c.name,
        c.duration,
        c.tracks.filter((t) => t.name.endsWith(".quaternion")),
      ));
      donanim = ekipmanKur(kok);
      gorunur(donanim.gozluk, gozluk); gorunur(donanim.pelerin, pelerin);
      if (govde?.material?.userData.ceket) govde.material.userData.ceket.value = ceket ? 1 : 0;
      tenSec(TENLER[ten]); await sacSec(SACLAR[sac][1]); klipSec(HAREKETLER[hareket][1]);
      apiRef.current = {
        klipSec, sacSec, tenSec,
        gorunur: (ad, v) => gorunur(donanim?.[ad], v),
        ceketSec: (v) => { if (govde?.material?.userData.ceket) govde.material.userData.ceket.value = v ? 1 : 0; },
      };
      setHazir(true);
    }).catch((e) => { console.error(e); if (yasiyor) setHata("Model yüklenemedi."); });

    function kare() { kareId = requestAnimationFrame(kare); const dt = Math.min(0.04, saat.getDelta()); mixer?.update(dt); kontroller.update(); renderer.render(sahne, kamera); }
    kare();
    return () => {
      yasiyor = false; cancelAnimationFrame(kareId); ro?.disconnect(); window.removeEventListener("resize", boyutla); kontroller.dispose(); mixer?.stopAllAction();
      sahne.traverse((o) => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose(); });
      ortam.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove(); apiRef.current = null;
    };
  }, []);

  useEffect(() => { if (hazir) apiRef.current?.tenSec(TENLER[ten]); }, [ten, hazir]);
  useEffect(() => { if (hazir) apiRef.current?.sacSec(SACLAR[sac][1]); }, [sac, hazir]);
  useEffect(() => { if (hazir) apiRef.current?.klipSec(HAREKETLER[hareket][1]); }, [hareket, hazir]);
  useEffect(() => { apiRef.current?.gorunur("gozluk", gozluk); }, [gozluk]);
  useEffect(() => { apiRef.current?.ceketSec(ceket); }, [ceket]);
  useEffect(() => { apiRef.current?.gorunur("pelerin", pelerin); }, [pelerin]);

  return (
    <main className="qi-aday">
      <header className="qi-aday__baslik">
        <div><span>QUIZ TACTICS / MODEL LAB</span><h1>Hazır insan prototipi</h1></div>
        <a href="/bildim/harita">Meydana dön</a>
      </header>
      <section className="qi-aday__sahne">
        <div ref={alanRef} className="qi-aday__canvas" aria-label="Döndürülebilir üç boyutlu insan modeli" />
        {!hazir && !hata && <div className="qi-aday__yukleniyor">Model hazırlanıyor…</div>}
        {hata && <div className="qi-aday__yukleniyor qi-aday__hata">{hata}</div>}
        <div className="qi-aday__bilgi"><b>8.953</b><span>üçgen</span><i /><b>CC0</b><span>Quaternius</span></div>
      </section>
      <aside className="qi-aday__panel">
        <div className="qi-aday__grup"><h2>Ten</h2><div className="qi-aday__secimler">{TENLER.map((r, i) => <button key={r} className={ten === i ? "secili" : ""} onClick={() => setTen(i)} aria-label={`Ten ${i + 1}`}><span style={{ background: r }} /></button>)}</div></div>
        <div className="qi-aday__grup"><h2>Saç</h2><div className="qi-aday__dugmeler">{SACLAR.map(([ad], i) => <button key={ad} className={sac === i ? "secili" : ""} onClick={() => setSac(i)}>{ad}</button>)}</div></div>
        <div className="qi-aday__grup"><h2>Hareket</h2><div className="qi-aday__dugmeler">{HAREKETLER.map(([ad], i) => <button key={ad} className={hareket === i ? "secili" : ""} onClick={() => setHareket(i)}>{ad}</button>)}</div></div>
        <div className="qi-aday__grup"><h2>Ekipman</h2><div className="qi-aday__dugmeler qi-aday__dugmeler--uc">{[["Gözlük", gozluk, setGozluk], ["Ceket", ceket, setCeket], ["Pelerin", pelerin, setPelerin]].map(([ad, acik, fn]) => <button key={ad} className={acik ? "secili" : ""} onClick={() => fn(!acik)}>{ad}</button>)}</div></div>
        <p className="qi-aday__not">Sürükleyerek döndür, tekerlekle yakınlaş. Bu rota karşılaştırma prototipidir; mevcut oyuncu görünümünü değiştirmez.</p>
      </aside>
    </main>
  );
}
