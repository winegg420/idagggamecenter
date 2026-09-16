import {PARCALAR,TEMEL,sahiplikDogrula} from './envanter.js';
import { tt } from '../lib/dil.js';
export const ENVANTER_ANAHTAR='qs_avatar3d_deneme_envanter_v1';
// Gerçek ekonomi değildir. Aynı hizmet arayüzü sunucu adaptöründe de kullanılır.
export function denemeServisi(depo,ayar){
  const katalog=PARCALAR.map(p=>({...p,...ayar.parcalar.find(e=>e.id===p.id),aktif:true}));
  const baslangic=()=>({surum:1,bakiye:ayar.bakiye,sahip:katalog.filter(p=>p.fiyat===0).map(p=>p.id),gorunum:TEMEL,oduller:[]});
  const oku=()=>{
    const ham=depo.getItem(ENVANTER_ANAHTAR);
    if(!ham)return baslangic();
    const s=JSON.parse(ham);
    if(s.surum!==1||!Number.isSafeInteger(s.bakiye)||s.bakiye<0||!Array.isArray(s.sahip)||!Array.isArray(s.oduller))throw new Error(tt("Deneme kaydı okunamadı. Denemeyi yeniden başlat."));
    s.gorunum=sahiplikDogrula(s.gorunum,s.sahip);return s;
  };
  const yaz=s=>{depo.setItem(ENVANTER_ANAHTAR,JSON.stringify(s));return {...s,katalog};};
  let sira=Promise.resolve();
  const kilitli=fn=>{
    if(typeof window!=='undefined'&&globalThis.navigator?.locks)return globalThis.navigator.locks.request(ENVANTER_ANAHTAR,fn);
    const sonuc=sira.then(fn);sira=sonuc.catch(()=>{});return sonuc;
  };
  return {
    yukle:async()=>({...oku(),katalog}),
    satinAl:id=>kilitli(()=>{
      const s=oku(),p=katalog.find(p=>p.id===id);
      if(!p)throw new Error(tt("Eşya bulunamadı."));
      if(s.sahip.includes(id))return {...s,katalog};
      if(p.odul||p.fiyat===null)throw new Error(tt("Bu eşya yalnız ödül olarak kazanılır."));
      if(s.bakiye<p.fiyat)throw new Error(tt("Deneme coin bakiyen yetersiz."));
      return yaz({...s,bakiye:s.bakiye-p.fiyat,sahip:[...s.sahip,id]});
    }),
    kaydet:g=>kilitli(()=>{const s=oku();return yaz({...s,gorunum:sahiplikDogrula(g,s.sahip)});}),
    odulDene:()=>kilitli(()=>{
      const s=oku(),olay='ilk-turnuva-denemesi';
      if(s.oduller.includes(olay))return {...s,katalog};
      return yaz({...s,sahip:[...new Set([...s.sahip,'bas_tac','sirt_pelerin'])],oduller:[...s.oduller,olay]});
    }),
    sifirla:()=>kilitli(()=>yaz(baslangic())),
  };
}
export function envanterGorunumuOku(depo){
  const s=JSON.parse(depo.getItem(ENVANTER_ANAHTAR)||'null');
  return s?sahiplikDogrula(s.gorunum,s.sahip):TEMEL;
}
