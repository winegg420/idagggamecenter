import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TENLER, SAC_RENKLERI, VARSAYILAN } from './model.js';
import { yerelOku, yerelKaydet } from './yerel.js';
import { sahneKur } from './sahne.js';
import './atolye.css';
import './yerlesim.css';
import {KOLEKSIYON,YUZLER,karakterUygula} from './koleksiyon.js';
import './koleksiyon.css';

function Atolye(){
  const [ayar,setAyar]=useState(yerelOku),[istatistik,setIstatistik]=useState({}),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mod,setMod]=useState('bekle'),[mekan,setMekan]=useState(false),[yakin,setYakin]=useState(false),[don,setDon]=useState(false);
  const alan=useRef(),sahne=useRef();
  useEffect(()=>{try{sahne.current=sahneKur(alan.current,ayar,setIstatistik);if(matchMedia('(prefers-reduced-motion: reduce)').matches){sahne.current.animasyon('dur');setMod('dur');}}catch(e){setHata('3D sahne açılamadı: '+e.message);}return()=>sahne.current?.yokEt();},[]);
  useEffect(()=>{try{sahne.current?.guncelle(ayar);yerelKaydet(ayar);}catch(e){setHata('Görünüm güncellenemedi: '+e.message);}},[ayar]);
  const sec=(k,v)=>setAyar(a=>({...a,[k]:v}));
  const animasyon=v=>{setMod(v);sahne.current?.animasyon(v);};
  const renkler=(liste,k,ad)=><div className="renkler">{liste.map((r,i)=><button key={r} aria-label={ad+' '+(i+1)} aria-pressed={ayar[k]===r} title={r} style={{background:r}} onClick={()=>sec(k,r)}/>)}</div>;
  return <div className="atolye">
    <header><a href="/">Quiz Square<span>Karakter atölyesi</span></a><span className="etiket">KARAKTER ATÖLYESİ</span></header>
    <main><section className="gosterim"><div className="sahne" ref={alan}/><div className="sahne-baslik"><span>ORTAK GÖVDE / İNSAN</span><h1>Senin karakterin.</h1><p>Çevir, yakından bak, hareket ettir.</p></div>
      <div className="kamera"><button aria-pressed={yakin} onClick={()=>{setYakin(!yakin);sahne.current?.yakin(!yakin);}}>Yüzü incele</button><button aria-pressed={don} onClick={()=>{setDon(!don);sahne.current?.donus(!don);}}>360° döndür</button><button aria-pressed={mekan} onClick={()=>{setMekan(!mekan);sahne.current?.meydan(!mekan);}}>Yürüme alanı</button></div>
      <div className="sahne-alt"><div className="hareketler">{[['bekle','Bekle'],['yuru','Yürü'],['selam','Selam ver'],['dur','Durdur']].map(([v,ad])=><button key={v} aria-pressed={mod===v} onClick={()=>animasyon(v)}>{ad}</button>)}</div><small>{mekan?'W A S D veya yön tuşlarıyla yürü.':'Sürükleyerek çevir · Kaydırarak yakınlaş'}</small></div>
    </section><aside><div className="panel-baslik"><span>GÖRÜNÜM</span><h2>Kendin oluştur.</h2><p>Seçimler anında 3D karaktere yansır.</p></div>
      <details className="hazirlar" open><summary>24 hazır karakter görünümü</summary><p>Karakteri değiştirirken taktığın ekipmanlar korunur.</p><div className="karakter-secimi">{KOLEKSIYON.map(k=><button key={k.id} aria-pressed={Object.entries(k.kimlik).every(([alan,v])=>ayar[alan]===v)} onClick={()=>{setAyar(a=>karakterUygula(a,k));setBilgi(k.ad+' seçildi. Ekipmanların korundu.');}}><span className="karakter-ton" style={{background:k.kimlik.ten,borderColor:k.kimlik.sacRenk}}/>{k.ad}</button>)}</div></details>
      <fieldset><legend>Yüz biçimi</legend><div className="secimler">{Object.entries(YUZLER).map(([v,ad])=><button key={v} aria-pressed={ayar.yuz===v} onClick={()=>sec('yuz',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>Ten rengi</legend>{renkler(TENLER,'ten','Ten')}</fieldset>
      <fieldset><legend>Saç modeli</legend><div className="secimler">{[['yok','Saçsız'],['kisa','Kısa'],['uzun','Uzun'],['rasta','Rasta']].map(([v,ad])=><button key={v} aria-pressed={ayar.sac===v} onClick={()=>sec('sac',v)}>{ad}</button>)}</div>{renkler(SAC_RENKLERI,'sacRenk','Saç rengi')}</fieldset>
      <fieldset><legend>Kıyafet</legend><div className="secimler kiyafetler">{[['tisort','Tişört'],['ceket','Ceket'],['gelinlik','Gelinlik']].map(([v,ad])=><button key={v} aria-pressed={ayar.kiyafet===v} onClick={()=>setAyar(a=>({...a,kiyafet:v,ceket:v==='ceket'}))}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>Baş aksesuarı</legend><div className="secimler basliklar">{[['yok','Yok'],['kep','Kep'],['bere','Bere'],['tac','Taç'],['duvak','Duvak']].map(([v,ad])=><button key={v} aria-pressed={ayar.bas===v} onClick={()=>sec('bas',v)}>{ad}</button>)}</div></fieldset>
      <fieldset><legend>Ekipmanlar</legend>{[['gozluk','Güneş gözlüğü','Kafa ile birlikte hareket eder'],['pelerin','Pelerin','Hareketli, kemiklere bağlı kumaş']].map(([k,ad,alt])=><label className="ekipman" key={k}><span><b>{ad}</b><small>{alt}</small></span><input type="checkbox" checked={ayar[k]} onChange={e=>sec(k,e.target.checked)}/></label>)}</fieldset>
      <fieldset><legend>Ceket rengi</legend>{renkler(['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'],'ceketRenk','Ceket rengi')}</fieldset>
      <div className="eylemler"><a className="oyunda" href="/gorunum?avatar3d=1">Oyun içindeki görünüm sayfası ↗</a><button onClick={()=>{setAyar({...VARSAYILAN});setBilgi('Varsayılan görünüm yüklendi.');}}>Sıfırla</button><button onClick={async()=>{try{const blob=await sahne.current.glb();const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='quizsquare-avatar-prototip.glb';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);setBilgi('3D model indirildi. Hareketler uygulama koduyla oynatılır.');}catch(e){setHata('Model indirilemedi: '+e.message);}}}>3D modeli indir (.glb)</button></div>
      <a className="oyunda" style={{marginTop:10}} href="./gardrop.html">Gardırop · Mağaza ve ödülleri dene ↗</a>
      <a className="oyunda" style={{marginTop:10}} href="./meydan.html">Mevcut meydanda dene ↗</a>
      <p className="not">Bu örnek ortak ekipman ve hareket sistemini denemek içindir. Son karakter sanatı değildir. Seçimler yalnız bu tarayıcıya kaydedilir; coin harcanmaz.</p>
      <p className="bilgi" role="status">{bilgi}</p>{(hata||istatistik.hata)&&<p role="alert">{hata||istatistik.hata}</p>}
    </aside></main><footer><span>24 hazır görünüm · 4 yüz biçimi · Ortak ekipman yuvaları</span><output aria-label="Performans">{istatistik.fps?`${istatistik.fps} FPS · ${istatistik.ucgen.toLocaleString('tr-TR')} üçgen · ${istatistik.cagri} çizim çağrısı`:'Performans ölçülüyor…'}</output></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<Atolye/>);
