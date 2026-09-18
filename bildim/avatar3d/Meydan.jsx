// ┌───────────────────────────────────────────────────────────────────────────
// │ DONDURULDU — Eski 3B gardırop / atölye / yerel meydan denemesi
// │ Tarih: 17 Eylül 2026   ·   Paket: 17 §D
// │
// │ Neden: meydanda yeni GLB karakterler (insan · kaplan · robot) yürürken
// │ dükkân ve gardırop eski kutu karakterleri gösteriyordu. Yerine
// │ bildim/vitrin/KarakterVitrini.jsx kondu (rota /bildim/gorunum).
// │
// │ Dosyalar: bildim/avatar3d/ altındaki her şey · üç HTML girişi
// │ (gardrop.html, index.html, meydan.html) açılınca /bildim/gorunum'a yönlenir.
// │ vite.config.js › rollupOptions.input'a DOKUNULMADI (giriş listesi orada durur).
// │
// │ Geri açmak:
// │   1. Üç HTML'in <head>'indeki location.replace satırını kaldır
// │   2. src/App.jsx + src/BildimApp.jsx'te /gorunum → GardropaGit, /gorunum-3b → GorunumPage
// │   3. Layout üst çubuk kısayolunu ve Dükkân › Görünüm sekmesini geri koy
// │   4. Dikkat: vitrin kaydı (gorunum.harita.koz) meydanda eski kaydın önüne geçer
// │
// │ Veri durur: avatar3d_parcalar, avatar3d_sahip, profiles.gorunum.avatar3d.
// │ Bu dosya SİLİNMEZ ve düzenlenmez. Tam liste: kök CLAUDE.md › Dondurulmuşlar.
// └───────────────────────────────────────────────────────────────────────────

import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {dunyaKur} from '../harita/dunya.js';
import {modelKur,modelYokEt,hareket} from './model.js';
import {yerelOku} from './yerel.js';
import {envanterGorunumuOku} from './envanter-yerel.js';
import './atolye.css';
import { tt } from '../lib/dil.js';
function Meydan(){
 const alan=useRef(),dunya=useRef(),tuslar=useRef(new Set()),mod=useRef('bekle');
 const [istatistik,setIstatistik]=useState(tt("Ölçülüyor…")),[hata,setHata]=useState('');
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
    if(now-olcum>1500){setIstatistik(tt("{0} FPS · {1} üçgen · {2} çizim", { 0: Math.round(say*1000/(now-olcum)), 1: d.render.info.render.triangles.toLocaleString('tr-TR'), 2: d.render.info.render.calls }));say=0;olcum=now;}
   };raf=requestAnimationFrame(kare);
  }catch(e){setHata(tt("Meydan açılamadı: ")+e.message);}
  return()=>{aktif=false;cancelAnimationFrame(raf);ro?.disconnect();window.removeEventListener('keydown',bas);window.removeEventListener('keyup',birak);window.removeEventListener('blur',temizle);window.removeEventListener('resize',boyut);modelYokEt(av);d?.yokEt();};
 },[]);
 return <div><header><a href={new URLSearchParams(location.search).get('envanter')==='1'?'./gardrop.html':'./index.html'}>{tt("← Karakter atölyesi")}</a><span className="etiket">{tt("ÇEVRİMDIŞI MEYDAN")}</span></header><div ref={alan} style={{height:'calc(100dvh - 190px)',minHeight:380}}/>
  <div style={{display:'flex',padding:12,gap:8,flexWrap:'wrap',alignItems:'center'}}>{[['sol','←'],['ileri','↑'],['geri','↓'],['sag','→']].map(([k,ad])=><button key={k} aria-label={k} style={{touchAction:'none',minWidth:42}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);tuslar.current.add(k);}} onPointerUp={()=>tuslar.current.delete(k)} onPointerCancel={()=>tuslar.current.delete(k)} onLostPointerCapture={()=>tuslar.current.delete(k)}>{ad}</button>)}<button onClick={()=>mod.current=mod.current==='selam'?'bekle':'selam'}>{tt("Selam ver")}</button><button onClick={()=>dunya.current?.zumla(.8)}>{tt("Yakınlaş")}</button><button onClick={()=>dunya.current?.zumla(1.25)}>{tt("Uzaklaş")}</button><output>{istatistik}</output></div>
  <p style={{margin:'0 16px',fontSize:12,color:'#b8c1cf'}}>{tt("W A S D / yön tuşları · Mevcut oyun haritası, tek yerel karakter. Çevrimiçi oyuncu, alışveriş ve maç bağlantısı yok.")}</p>{hata&&<p role="alert">{hata}</p>}</div>;
}
createRoot(document.getElementById('root')).render(<Meydan/>);
