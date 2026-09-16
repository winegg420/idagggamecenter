import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelKur, modelYokEt, hareket } from './model.js';
import { tt } from '../lib/dil.js';

export function sahneKur(kapsayici, ayar, rapor = () => {}) {
  const sahne = new T.Scene(); sahne.background = new T.Color('#151a23');
  const kamera = new T.PerspectiveCamera(32, 1, .1, 100);
  kamera.position.set(4.1, 3.1, 8); 
  // preserveDrawingBuffer YOK: bu sahne toDataURL almiyor (portre uretimi ayri
  // renderer'da). Acik birakmak surucude arka tamponu zorla saklatiyor ve
  // ANGLE/D3D11'de bellek baskisi yaratiyor.
  const render = new T.WebGLRenderer({ antialias: true, alpha: false });
  render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  render.shadowMap.enabled = true; render.shadowMap.type = T.PCFShadowMap;
  render.toneMapping = T.ACESFilmicToneMapping; render.toneMappingExposure = 1.25;
  kapsayici.appendChild(render.domElement);
  render.domElement.setAttribute('aria-label', tt('Döndürülebilen üç boyutlu karakter'));
  const kontrol = new OrbitControls(kamera, render.domElement);
  kontrol.target.set(0,1.9,0); kontrol.enableDamping=true; kontrol.enablePan=false;
  kontrol.minDistance=3; kontrol.maxDistance=13; kontrol.maxPolarAngle=Math.PI*.54;
  sahne.add(new T.HemisphereLight('#c9ddff','#596477',2));
  const ana=new T.DirectionalLight('#ffe5cc',3.5);ana.position.set(3,7,5);ana.castShadow=true;
  ana.shadow.mapSize.set(1024,1024);ana.shadow.camera.left=-5;ana.shadow.camera.right=5;ana.shadow.camera.top=6;ana.shadow.camera.bottom=-5;ana.shadow.normalBias=.03;sahne.add(ana);
  const kenar=new T.DirectionalLight('#86acff',3);kenar.position.set(-4,3,-4);sahne.add(kenar);
  const dolgu=new T.DirectionalLight('#ffffff',.6);dolgu.position.set(-3,3,4);sahne.add(dolgu);
  const zemin=new T.Mesh(new T.CylinderGeometry(2.3,2.35,.12,64),new T.MeshStandardMaterial({color:'#272f3c',roughness:.8}));
  zemin.position.y=-.06;zemin.receiveShadow=true;sahne.add(zemin);
  const izgara=new T.GridHelper(18,18,'#61748e','#303a4a');izgara.position.y=-.015;izgara.visible=false;sahne.add(izgara);
  let model=modelKur(ayar);sahne.add(model);
  let mod='bekle', meydan=false, dondur=false, aktif=true, son=performance.now(), t=0, kareSay=0, olcum=son, raf;
  const tuslar=new Set();
  const bas=(e)=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();tuslar.add(e.key);}};
  const birak=(e)=>tuslar.delete(e.key);
  window.addEventListener('keydown',bas);window.addEventListener('keyup',birak);
  const odakKaybi=()=>tuslar.clear();window.addEventListener('blur',odakKaybi);
  const boyut=()=>{const w=Math.max(1,kapsayici.clientWidth),h=Math.max(1,kapsayici.clientHeight);render.setSize(w,h);kamera.aspect=w/h;kamera.updateProjectionMatrix();};
  const gozlem=typeof ResizeObserver!=='undefined'?new ResizeObserver(boyut):null;gozlem?.observe(kapsayici);window.addEventListener('resize',boyut);boyut();
  let durumKayip=false, gizliBildirildi=false;
  const contextKaybi=e=>{e.preventDefault();durumKayip=true;rapor({hata:tt("3D görüntü bağlantısı kesildi. Sayfayı yenileyin.")});};
  render.domElement.addEventListener('webglcontextlost',contextKaybi);
  // İLK KARE HER HÂLÜKÂRDA ÇİZİLİR.
  // Eskiden döngü `document.hidden` iken hiç render etmiyordu; sayfa arka
  // planda/otomasyon sekmesinde açıldıysa tuval BOMBOŞ kalıyor, sekme öne
  // gelince bir sonraki kareye kadar öyle duruyordu. Üstelik FPS hiç
  // bildirilmediği için altbilgi sonsuza kadar "Ölçülüyor…" yazıyordu ve
  // sayfa ölü görünüyordu. Artık: en az bir kare çizilir, gizlilik durumu
  // da rapor edilir ki arayüz dürüst bir şey söyleyebilsin.
  let ilkKareCizildi=false;
  function kare(now){
    if(!aktif)return;raf=requestAnimationFrame(kare);
    const dt=Math.min((now-son)/1000,.05);son=now;
    if(durumKayip){kareSay=0;olcum=now;return;}
    if(document.hidden&&ilkKareCizildi){
      kareSay=0;olcum=now;
      if(!gizliBildirildi){gizliBildirildi=true;rapor({gizli:true});}
      return;
    }
    if(gizliBildirildi){gizliBildirildi=false;rapor({gizli:false});}
    t+=dt;
    let hareketMod=mod;
    if(meydan){
      let x=Number(tuslar.has('d')||tuslar.has('ArrowRight'))-Number(tuslar.has('a')||tuslar.has('ArrowLeft'));
      let z=Number(tuslar.has('s')||tuslar.has('ArrowDown'))-Number(tuslar.has('w')||tuslar.has('ArrowUp'));
      if(x||z){const l=Math.hypot(x,z);model.position.x=T.MathUtils.clamp(model.position.x+x/l*dt*2,-5,5);model.position.z=T.MathUtils.clamp(model.position.z+z/l*dt*2,-5,5);model.rotation.y=Math.atan2(x,z);hareketMod='yuru';}
    }
    if(mod!=='dur')hareket(model,t,hareketMod);
    if(dondur)model.rotation.y+=dt*.35;
    kontrol.update();render.render(sahne,kamera);kareSay++;
    if(!ilkKareCizildi){
      ilkKareCizildi=true;
      // İlk kare gizliyken çizildiyse durumu HEMEN bildir: sonraki kare
      // gelmeyeceği için altbilgi yoksa sonsuza kadar "Ölçülüyor…" kalır.
      if(document.hidden&&!gizliBildirildi){gizliBildirildi=true;rapor({gizli:true});}
    }
    if(now-olcum>=1500){rapor({fps:Math.round(kareSay*1000/(now-olcum)),ucgen:render.info.render.triangles,cagri:render.info.render.calls,geometri:render.info.memory.geometries,doku:render.info.memory.textures});kareSay=0;olcum=now;}
  }
  raf=requestAnimationFrame(kare);

  // Sekme öne gelince ölçüm penceresi sıfırlanır: arka planda geçen süre
  // FPS'i sahte biçimde düşük göstermesin.
  const gorunurlukDegisti=()=>{
    if(document.hidden)return;
    son=performance.now();olcum=son;kareSay=0;
  };
  document.addEventListener('visibilitychange',gorunurlukDegisti);
  return {
    guncelle(yeni){const once=model;model=modelKur(yeni);model.position.copy(once.position);model.rotation.copy(once.rotation);sahne.add(model);modelYokEt(once);if(mod==='dur')hareket(model,0,'bekle');},
    animasyon(v){mod=v;if(v==='dur')hareket(model,0,'bekle');},
    donus(v){dondur=v;},
    yakin(v){kontrol.target.set(0,v?3.12:1.9,0);kamera.position.set(v?1.2:4.1,v?3.25:3.1,v?3.2:8);kontrol.update();},
    meydan(v){meydan=v;izgara.visible=v;zemin.visible=!v;model.position.set(0,0,0);model.rotation.y=0;kontrol.target.set(0,1.8,0);kamera.position.set(v?6:4.1,v?6:3.1,v?10:8);},
    async glb(){const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const veri=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});return new Blob([veri],{type:'model/gltf-binary'});},
    yokEt(){aktif=false;cancelAnimationFrame(raf);gozlem?.disconnect();window.removeEventListener('resize',boyut);window.removeEventListener('keydown',bas);window.removeEventListener('keyup',birak);window.removeEventListener('blur',odakKaybi);document.removeEventListener('visibilitychange',gorunurlukDegisti);kontrol.dispose();modelYokEt(model);zemin.geometry.dispose();zemin.material.dispose();izgara.geometry.dispose();izgara.material.dispose();render.dispose();render.forceContextLoss();render.domElement.remove();},
  };
}
