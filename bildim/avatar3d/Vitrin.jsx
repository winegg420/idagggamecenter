import {useEffect,useRef,useState} from 'react';
import {sahneKur} from './sahne.js';
import {yerelOku,onizlemeMi as yerelMi} from './yerel.js';
import {ENVANTER_ANAHTAR,envanterGorunumuOku} from './envanter-yerel.js';
import { tt } from '../lib/dil.js';
// Canlı hesap görünümünü değiştirmez; yalnız localhost ve açık önizleme parametresi.
export default function Vitrin(){
  const alan=useRef(),[hata,setHata]=useState('');
  useEffect(()=>{if(!yerelMi())return;let s;const oku=()=>localStorage.getItem(ENVANTER_ANAHTAR)?envanterGorunumuOku(localStorage):yerelOku();try{s=sahneKur(alan.current,oku());}catch(e){setHata(e.message);}const guncelle=()=>{try{s?.guncelle(oku());}catch(e){setHata(e.message);}};const olaylar=['storage','qs-avatar3d','qs-envanter3d'];olaylar.forEach(o=>window.addEventListener(o,guncelle));return()=>{s?.yokEt();olaylar.forEach(o=>window.removeEventListener(o,guncelle));};},[]);
  return <section className="kart"><h2>{tt("3D karakter prototipi")}</h2><div ref={alan} style={{height:440,borderRadius:16,overflow:'hidden'}}/>{hata&&<p role="alert">{hata}</p>}<p>{tt("Yeni 3D karakterini dene. Bu önizlemedeki alışverişler deneme coinleriyle yapılır.")}</p><a className="btn" href="/bildim/avatar3d/gardrop.html">{tt("3D gardırobu aç")}</a></section>;
}
