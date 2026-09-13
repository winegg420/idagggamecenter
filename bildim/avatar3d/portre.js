import * as T from 'three';
import {modelKur,modelYokEt,ayarDogrula} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
// Önbellek sınırı 64 > 160: gardıroptaki 12 parça, oyuncu ten/saç rengini
// değiştirdikçe yeniden üretiliyor; 64 girişte aynı resimler sürekli düşüyordu.
const ONBELLEK_SINIRI=160;
const kayitlar=new Map();let render;

/** Tek paylaşılan renderer — parça portreleri de bunu kullanır, ikinci
 *  WebGL bağlamı açılmaz (tarayıcı bağlam sınırı genelde 16). */
function makine(){
 if(!render){render=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});render.setSize(256,256);render.setPixelRatio(1);render.outputColorSpace=T.SRGBColorSpace;}
 return render;
}

/** LRU: dokunulan sona gider, taşarsa en eskisi düşer. */
function onbellegeYaz(key,uri){
 kayitlar.set(key,uri);
 while(kayitlar.size>ONBELLEK_SINIRI)kayitlar.delete(kayitlar.keys().next().value);
 return uri;
}

export function yeniPortre(g={}){
 const ad=g?.karakter||'deniz';let hash=0;for(const c of ad)hash=(hash*31+c.charCodeAt(0))>>>0;
 const ayar=ayarDogrula(g?.avatar3d||{...KOLEKSIYON[hash%KOLEKSIYON.length].kimlik,kiyafet:'tisort'});
 const key=JSON.stringify(ayar);if(kayitlar.has(key))return kayitlar.get(key);
 let model;
 try{
  const r=makine();r.setSize(256,256,false);
  const sahne=new T.Scene(),kamera=new T.PerspectiveCamera(35,1,.1,40);
  kamera.position.set(0,2.5,8);kamera.lookAt(0,2,0);
  sahne.add(new T.HemisphereLight(0xffffff,0x57647b,2.3));const isik=new T.DirectionalLight(0xffead0,3);isik.position.set(3,6,5);sahne.add(isik);
  model=modelKur(ayar);sahne.add(model);r.render(sahne,kamera);
  return onbellegeYaz(key,r.domElement.toDataURL('image/png'));
 }catch{return null;}finally{if(model)modelYokEt(model);}
}

// ============================================================
// PARÇA PORTRESİ — gardırop kartlarındaki küçük resim
//
// Kart, parçanın OYUNCUNUN KENDİ karakteri üstünde nasıl durduğunu gösterir:
// o anki görünüm alınır, yalnız ilgili yuva o parçayla değiştirilir.
//
// Aynı kamera her parçaya uymaz — kepi tam boy çekersen nokta kadar kalır.
// Çerçeveler TEK yerde dursun ki ileride ayarlamak kolay olsun.
// Ölçüldü (model.js gövdesi): ayak 0.04, gövde 1.95, kafa kutusu 2.53-3.96.
// ============================================================
export const CERCEVE={
 bas:   {fov:24,konum:[0,3.35,4.30],bak:[0,3.20,0]},   // yüz + baş üstü
 govde: {fov:26,konum:[0,2.40,5.20],bak:[0,2.10,0]},   // omuz-bel arası
 tamboy:{fov:30,konum:[0,2.60,9.20],bak:[0,2.00,0]},
 sirt:  {fov:30,konum:[0,2.70,-9.20],bak:[0,2.00,0]},  // hafif geriden: sırt görünsün
};
const YUVA_CERCEVE={sac:'bas',bas:'bas',gozluk:'bas',kiyafet:'govde',pelerin:'sirt'};

/**
 * @param {object} temelGorunum oyuncunun o anki görünümü (ten/saç rengi dahil)
 * @param {object} parca        envanter.js parçası: {yuva, deger}
 * @param {number} [boyut=192]  kare kenarı (px)
 * @returns {string|null} PNG data URI, üretilemezse null
 */
export function parcaPortresi(temelGorunum,parca,boyut=192){
 const yuva=parca?.yuva;if(!yuva)return null;
 const ayar=ayarDogrula({...(temelGorunum||{}),[yuva]:parca.deger});
 const cerceveAdi=YUVA_CERCEVE[yuva]||'tamboy';
 const key=JSON.stringify(ayar)+'|'+cerceveAdi+'|'+boyut;
 if(kayitlar.has(key)){const v=kayitlar.get(key);kayitlar.delete(key);kayitlar.set(key,v);return v;}
 let model;
 try{
  const r=makine();r.setSize(boyut,boyut,false);
  const c=CERCEVE[cerceveAdi];
  const sahne=new T.Scene(),kamera=new T.PerspectiveCamera(c.fov,1,.1,40);
  kamera.position.set(...c.konum);kamera.lookAt(...c.bak);
  sahne.add(new T.HemisphereLight(0xffffff,0x57647b,2.3));const isik=new T.DirectionalLight(0xffead0,3);isik.position.set(3,6,5);sahne.add(isik);
  model=modelKur(ayar);sahne.add(model);r.render(sahne,kamera);
  return onbellegeYaz(key,r.domElement.toDataURL('image/png'));
 }catch(e){console.error('[Portre] parca portresi uretilemedi:',parca?.deger,e);return null;}
 // Model her render sonrası atılır: sahnede avatar birikmesin.
 finally{if(model)modelYokEt(model);}
}

/** Sayfadan çıkarken WebGL bağlamı bırakılsın. */
export function portreMakinesiniKapat(){
 try{render?.dispose();render?.forceContextLoss?.();}catch(e){console.error('[Portre] kapatilamadi:',e);}
 render=null;kayitlar.clear();
}
