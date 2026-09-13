import * as T from 'three';
import {modelKur,modelYokEt,ayarDogrula} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
const kayitlar=new Map();let render;
export function yeniPortre(g={}){
 const ad=g?.karakter||'deniz';let hash=0;for(const c of ad)hash=(hash*31+c.charCodeAt(0))>>>0;
 const ayar=ayarDogrula(g?.avatar3d||{...KOLEKSIYON[hash%KOLEKSIYON.length].kimlik,kiyafet:'tisort'});
 const key=JSON.stringify(ayar);if(kayitlar.has(key))return kayitlar.get(key);
 let model;
 try{
  if(!render){render=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});render.setSize(256,256);render.setPixelRatio(1);render.outputColorSpace=T.SRGBColorSpace;}
  const sahne=new T.Scene(),kamera=new T.PerspectiveCamera(35,1,.1,40);
  kamera.position.set(0,2.5,8);kamera.lookAt(0,2,0);
  sahne.add(new T.HemisphereLight(0xffffff,0x57647b,2.3));const isik=new T.DirectionalLight(0xffead0,3);isik.position.set(3,6,5);sahne.add(isik);
  model=modelKur(ayar);sahne.add(model);render.render(sahne,kamera);
  const uri=render.domElement.toDataURL('image/png');if(kayitlar.size>=64)kayitlar.delete(kayitlar.keys().next().value);kayitlar.set(key,uri);return uri;
 }catch{return null;}finally{if(model)modelYokEt(model);}
}
