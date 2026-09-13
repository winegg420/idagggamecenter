import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {dunyaKur} from '../harita/dunya.js';
import {modelKur,modelYokEt,hareket} from './model.js';
import {yerelOku} from './yerel.js';
import {envanterGorunumuOku} from './envanter-yerel.js';
import './atolye.css';
function Meydan(){
 const alan=useRef(),dunya=useRef(),tuslar=useRef(new Set()),mod=useRef('bekle');
 const [istatistik,setIstatistik]=useState('Ölçülüyor…'),[hata,setHata]=useState('');
 useEffect(()=>{
  let d,av,raf,ro,aktif=true,son=performance.now(),zaman=0,say=0,olcum=son;
  const kodlar={w:'ileri',ArrowUp:'ileri',s:'geri',ArrowDown:'geri',a:'sol',ArrowLeft:'sol',d:'sag',ArrowRight:'sag'};
  const bas=e=>{if(kodlar[e.key]&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();tuslar.current.add(kodlar[e.key]);}};
  const birak=e=>tuslar.current.delete(kodlar[e.key]);const temizle=()=>tuslar.current.clear();
  const boyut=()=>d?.boyutlandir();
  try{
   d=dunyaKur(alan.current,{hareketAzalt:matchMedia('(prefers-reduced-motion: reduce)').matches});dunya.current=d;
   d.render.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
   const giyilen=()=>new URLSearchParams(location.search).get('envanter')==='1'?envanterGorunumuOku(localStorage):yerelOku();
   av=modelKur(giyilen());av.position.set(6,0,6);d.carpismaDuzelt(av.position,.6);d.sahne.add(av);d.zumAyarla(.55);
   window.addEventListener('keydown',bas);window.addEventListener('keyup',birak);window.addEventListener('blur',temizle);window.addEventListener('resize',boyut);
   if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(boyut);ro.observe(alan.current);}
   const kare=now=>{
    if(!aktif)return;raf=requestAnimationFrame(kare);const dt=Math.min((now-son)/1000,.05);son=now;
    if(document.hidden){say=0;olcum=now;return;}zaman+=dt;
    const k=tuslar.current,x=Number(k.has('sag'))-Number(k.has('sol')),z=Number(k.has('geri'))-Number(k.has('ileri')),l=Math.hypot(x,z);
    if(l){av.position.x+=x/l*dt*5;av.position.z+=z/l*dt*5;d.carpismaDuzelt(av.position,.6);d.yumusakDon(av,Math.atan2(x,z),dt,12);}
    hareket(av,zaman,l?'yuru':mod.current);d.guncelle(dt,zaman,av);say++;
    if(now-olcum>1500){setIstatistik(`${Math.round(say*1000/(now-olcum))} FPS · ${d.render.info.render.triangles.toLocaleString('tr-TR')} üçgen · ${d.render.info.render.calls} çizim`);say=0;olcum=now;}
   };raf=requestAnimationFrame(kare);
  }catch(e){setHata('Meydan açılamadı: '+e.message);}
  return()=>{aktif=false;cancelAnimationFrame(raf);ro?.disconnect();window.removeEventListener('keydown',bas);window.removeEventListener('keyup',birak);window.removeEventListener('blur',temizle);window.removeEventListener('resize',boyut);modelYokEt(av);d?.yokEt();};
 },[]);
 return <div><header><a href={new URLSearchParams(location.search).get('envanter')==='1'?'./gardrop.html':'./index.html'}>← Karakter atölyesi</a><span className="etiket">ÇEVRİMDIŞI MEYDAN</span></header><div ref={alan} style={{height:'calc(100dvh - 190px)',minHeight:380}}/>
  <div style={{display:'flex',padding:12,gap:8,flexWrap:'wrap',alignItems:'center'}}>{[['sol','←'],['ileri','↑'],['geri','↓'],['sag','→']].map(([k,ad])=><button key={k} aria-label={k} style={{touchAction:'none',minWidth:42}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);tuslar.current.add(k);}} onPointerUp={()=>tuslar.current.delete(k)} onPointerCancel={()=>tuslar.current.delete(k)} onLostPointerCapture={()=>tuslar.current.delete(k)}>{ad}</button>)}<button onClick={()=>mod.current=mod.current==='selam'?'bekle':'selam'}>Selam ver</button><button onClick={()=>dunya.current?.zumla(.8)}>Yakınlaş</button><button onClick={()=>dunya.current?.zumla(1.25)}>Uzaklaş</button><output>{istatistik}</output></div>
  <p style={{margin:'0 16px',fontSize:12,color:'#b8c1cf'}}>W A S D / yön tuşları · Mevcut oyun haritası, tek yerel karakter. Çevrimiçi oyuncu, alışveriş ve maç bağlantısı yok.</p>{hata&&<p role="alert">{hata}</p>}</div>;
}
createRoot(document.getElementById('root')).render(<Meydan/>);
