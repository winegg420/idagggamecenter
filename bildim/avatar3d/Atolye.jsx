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

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TENLER, SAC_RENKLERI, VARSAYILAN } from './model.js';
import { yerelOku, yerelKaydet } from './yerel.js';
import { sahneKur } from './sahne.js';
import './atolye.css';
import './yerlesim.css';
import {KOLEKSIYON,YUZLER,karakterUygula} from './koleksiyon.js';
import './koleksiyon.css';
import { tt } from '../lib/dil.js';

function Atolye(){
  const [ayar,setAyar]=useState(yerelOku),[istatistik,setIstatistik]=useState({}),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mod,setMod]=useState('bekle'),[mekan,setMekan]=useState(false),[yakin,setYakin]=useState(false),[don,setDon]=useState(false);
  const alan=useRef(),sahne=useRef();
  useEffect(()=>{try{sahne.current=sahneKur(alan.current,ayar,setIstatistik);if(matchMedia('(prefers-reduced-motion: reduce)').matches){sahne.current.animasyon('dur');setMod('dur');}}catch(e){setHata(tt("3D sahne açılamadı: ")+e.message);}return()=>sahne.current?.yokEt();},[]);
  useEffect(()=>{try{sahne.current?.guncelle(ayar);yerelKaydet(ayar);}catch(e){setHata(tt("Görünüm güncellenemedi: ")+e.message);}},[ayar]);
  const sec=(k,v)=>setAyar(a=>({...a,[k]:v}));
  const animasyon=v=>{setMod(v);sahne.current?.animasyon(v);};
  const renkler=(liste,k,ad)=><div className="renkler">{liste.map((r,i)=><button key={r} aria-label={ad+' '+(i+1)} aria-pressed={ayar[k]===r} title={r} style={{background:r}} onClick={()=>sec(k,r)}/>)}</div>;
  return <div className="atolye">
    <header><a href="/">Quiz Tactics<span>{tt("Karakter atölyesi")}</span></a><span className="etiket">{tt("KARAKTER ATÖLYESİ")}</span></header>
    <main><section className="gosterim"><div className="sahne" ref={alan}/><div className="sahne-baslik"><span>{tt("ORTAK GÖVDE / İNSAN")}</span><h1>{tt("Senin karakterin.")}</h1><p>{tt("Çevir, yakından bak, hareket ettir.")}</p></div>
      <div className="kamera"><button aria-pressed={yakin} onClick={()=>{setYakin(!yakin);sahne.current?.yakin(!yakin);}}>{tt("Yüzü incele")}</button><button aria-pressed={don} onClick={()=>{setDon(!don);sahne.current?.donus(!don);}}>{tt("360° döndür")}</button><button aria-pressed={mekan} onClick={()=>{setMekan(!mekan);sahne.current?.meydan(!mekan);}}>{tt("Yürüme alanı")}</button></div>
      <div className="sahne-alt"><div className="hareketler">{[['bekle',tt("Bekle")],['yuru',tt("Yürü")],['selam',tt("Selam ver")],['dur',tt("Durdur")]].map(([v,ad])=><button key={v} aria-pressed={mod===v} onClick={()=>animasyon(v)}>{ad}</button>)}</div><small>{mekan?tt("W A S D veya yön tuşlarıyla yürü."):tt("Sürükleyerek çevir · Kaydırarak yakınlaş")}</small></div>
    </section><aside><div className="panel-baslik"><span>{tt("GÖRÜNÜM")}</span><h2>{tt("Kendin oluştur.")}</h2><p>{tt("Seçimler anında 3D karaktere yansır.")}</p></div>
      <details className="hazirlar" open><summary>{KOLEKSIYON.length} {tt("hazır karakter görünümü")}</summary><p>{tt("Karakteri değiştirirken taktığın ekipmanlar korunur.")}</p><div className="karakter-secimi">{KOLEKSIYON.map(k=><button key={k.id} aria-pressed={Object.entries(k.kimlik).every(([alan,v])=>ayar[alan]===v)} onClick={()=>{setAyar(a=>karakterUygula(a,k));setBilgi(k.ad+tt(" seçildi. Ekipmanların korundu."));}}><span className="karakter-ton" style={{background:k.kimlik.ten,borderColor:k.kimlik.sacRenk}}/>{k.ad}</button>)}</div></details>
      <fieldset><legend>{tt("Yüz biçimi")}</legend><div className="secimler">{Object.entries(YUZLER).map(([v,ad])=><button key={v} aria-pressed={ayar.yuz===v} onClick={()=>sec('yuz',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>{tt("Ten rengi")}</legend>{renkler(TENLER,'ten',tt("Ten"))}</fieldset>
      <fieldset><legend>{tt("Saç modeli")}</legend><div className="secimler">{[['yok',tt("Saçsız")],['kisa',tt("Kısa")],['uzun',tt("Uzun")],['rasta',tt("Rasta")]].map(([v,ad])=><button key={v} aria-pressed={ayar.sac===v} onClick={()=>sec('sac',v)}>{ad}</button>)}</div>{renkler(SAC_RENKLERI,'sacRenk',tt("Saç rengi"))}</fieldset>
      <fieldset><legend>{tt("Üst giyim")}</legend><div className="secimler kiyafetler">{[['tisort',tt("Tişört")],['atlet',tt("Atlet")],['gomlek',tt("Gömlek")],['ceket',tt("Ceket")],['gelinlik',tt("Gelinlik")]].map(([v,ad])=><button key={v} aria-pressed={ayar.kiyafet===v} onClick={()=>setAyar(a=>({...a,kiyafet:v,ceket:v==='ceket'}))}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>{tt("Alt giyim")}</legend><div className="secimler">{[['pantolon',tt("Pantolon")],['sort',tt("Şort")],['kapri',tt("Kapri")]].map(([v,ad])=><button key={v} aria-pressed={ayar.alt===v} onClick={()=>sec('alt',v)}>{ad}</button>)}</div>{renkler(['#253341','#3a3f4a','#5a4632','#2f4a3a','#6b4a55','#1f2933'],'altRenk',tt("Alt giyim rengi"))}</fieldset>
      <fieldset><legend>{tt("Ayakkabı")}</legend><div className="secimler">{[['spor',tt("Spor|ayakkabi")],['bot',tt("Bot")],['terlik',tt("Terlik")],['sandalet',tt("Sandalet")]].map(([v,ad])=><button key={v} aria-pressed={ayar.ayakkabi===v} onClick={()=>sec('ayakkabi',v)}>{ad}</button>)}</div>{renkler(['#eee7d8','#2b2b30','#c04a34','#3a5a8c','#d9c27a','#8a8f98'],'ayakkabiRenk',tt("Ayakkabı rengi"))}</fieldset>
      <fieldset><legend>{tt("Baş aksesuarı")}</legend><div className="secimler basliklar">{[['yok',tt("Yok")],['kep',tt("Kep")],['bere',tt("Bere")],['tac',tt("Taç")],['duvak',tt("Duvak")]].map(([v,ad])=><button key={v} aria-pressed={ayar.bas===v} onClick={()=>sec('bas',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>{tt("Sakal")}</legend><div className="secimler">{[['yok',tt("Yok")],['biyik',tt("Bıyık")],['keci',tt("Keçi")],['favori',tt("Favori")],['tam',tt("Tam sakal")]].map(([v,ad])=><button key={v} aria-pressed={ayar.sakal===v} onClick={()=>sec('sakal',v)}>{ad}</button>)}</div></fieldset>
      {/* Gözlük ve pelerin artık METİN yuva (eskiden kutucuk/boolean'dı). */}
      <fieldset><legend>{tt("Gözlük")}</legend><div className="secimler">{[['yok',tt("Yok")],['gunes',tt("Güneş")],['kare',tt("Kare")],['yuvarlak',tt("Yuvarlak")],['okuma',tt("Okuma")],['spor',tt("Spor|ayakkabi")]].map(([v,ad])=><button key={v} aria-pressed={ayar.gozluk===v} onClick={()=>sec('gozluk',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>{tt("Sırt")}</legend><div className="secimler">{[['yok',tt("Yok")],['klasik',tt("Pelerin")],['kisa',tt("Kısa pelerin")]].map(([v,ad])=><button key={v} aria-pressed={ayar.pelerin===v} onClick={()=>sec('pelerin',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>{tt("Ceket rengi")}</legend>{renkler(['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'],'ceketRenk',tt("Ceket rengi"))}</fieldset>
      <div className="eylemler"><a className="oyunda" href="/gorunum?avatar3d=1">{tt("Oyun içindeki görünüm sayfası ↗")}</a><button onClick={()=>{setAyar({...VARSAYILAN});setBilgi(tt("Varsayılan görünüm yüklendi."));}}>{tt("Sıfırla")}</button><button onClick={async()=>{try{const blob=await sahne.current.glb();const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='quizsquare-avatar-prototip.glb';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);setBilgi(tt("3D model indirildi. Hareketler uygulama koduyla oynatılır."));}catch(e){setHata(tt("Model indirilemedi: ")+e.message);}}}>{tt("3D modeli indir (.glb)")}</button></div>
      <a className="oyunda" style={{marginTop:10}} href="./gardrop.html">{tt("Gardırop · Mağaza ve ödülleri dene ↗")}</a>
      <a className="oyunda" style={{marginTop:10}} href="./meydan.html">{tt("Mevcut meydanda dene ↗")}</a>
      <p className="not">{tt("Bu örnek ortak ekipman ve hareket sistemini denemek içindir. Son karakter sanatı değildir. Seçimler yalnız bu tarayıcıya kaydedilir; coin harcanmaz.")}</p>
      <p className="bilgi" role="status">{bilgi}</p>{(hata||istatistik.hata)&&<p role="alert">{hata||istatistik.hata}</p>}
    </aside></main><footer><span>{tt("24 hazır görünüm · 4 yüz biçimi · Ortak ekipman yuvaları")}</span><output aria-label={tt("Performans")}>{istatistik.fps?tt("{0} FPS · {1} üçgen · {2} çizim çağrısı", { 0: istatistik.fps, 1: istatistik.ucgen.toLocaleString('tr-TR'), 2: istatistik.cagri }):tt("Performans ölçülüyor…")}</output></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<Atolye/>);
