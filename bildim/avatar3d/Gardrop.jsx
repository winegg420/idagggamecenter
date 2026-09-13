import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {sahneKur} from './sahne.js';
import {TENLER,SAC_RENKLERI} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
import {TEMEL,YUVA_ADLARI,parcayiTak,parcayiCikar} from './envanter.js';
import {denemeServisi,ENVANTER_ANAHTAR} from './envanter-yerel.js';
import denemeKatalog from './deneme-katalog.json';
import {onizlemeMi} from './yerel.js';
import './atolye.css';
import './yerlesim.css';
import './gardrop.css';

function Gardrop(){
 const [durum,setDurum]=useState(null),[g,setG]=useState(TEMEL),[tab,setTab]=useState('magaza'),[yuva,setYuva]=useState('hepsi'),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mesgul,setMesgul]=useState(false),[onay,setOnay]=useState(null),[stat,setStat]=useState({}),[mod,setMod]=useState('bekle');
 const alan=useRef(),sahne=useRef(),servis=useRef(),kilit=useRef(false),guncel=useRef(g);guncel.current=g;
 useEffect(()=>{
  if(!onizlemeMi()){setHata('Gardırop önizlemesi henüz açık değil.');return;}
  let aktif=true;
  try{servis.current=denemeServisi(localStorage,denemeKatalog);sahne.current=sahneKur(alan.current,TEMEL,setStat);if(matchMedia('(prefers-reduced-motion: reduce)').matches){sahne.current.animasyon('dur');setMod('dur');}}catch(e){setHata(e.message);}
  const yukle=async()=>{try{const s=await servis.current.yukle();if(aktif){setDurum(s);setG(s.gorunum);}}catch(e){if(aktif)setHata(e.message);}};
  yukle();const degisti=e=>{if(e.key===ENVANTER_ANAHTAR)yukle();};window.addEventListener('storage',degisti);
  return()=>{aktif=false;window.removeEventListener('storage',degisti);sahne.current?.yokEt();};
 },[]);
 useEffect(()=>{try{sahne.current?.guncelle(g);}catch(e){setHata(e.message);}},[g]);
 async function islem(fn,mesaj,uygula=false){
  if(kilit.current)return;kilit.current=true;setMesgul(true);setHata('');
  try{const s=await fn();setDurum(s);if(uygula)setG(s.gorunum);setBilgi(mesaj);setOnay(null);window.dispatchEvent(new Event('qs-envanter3d'));}
  catch(e){setHata(e.message);}finally{kilit.current=false;setMesgul(false);}
 }
 const sahip=durum?.sahip||[],katalog=durum?.katalog||[];
 const kilitli=katalog.filter(p=>g[p.yuva]===p.deger&&!sahip.includes(p.id));
 const fark=durum&&JSON.stringify(g)!==JSON.stringify(durum.gorunum);
 const sec=p=>{setG(a=>parcayiTak(a,p));setBilgi(p.ad+(sahip.includes(p.id)?' seçildi. Kaydederek oyuna uygula.':' deneniyor. Kaydetmek için önce edinmelisin.'));};
 return <div className="atolye gardrop"><header><a href="./index.html">Quiz Square</a><span className="etiket">GARDIROP · ÖNİZLEME</span></header>
 <main><section className="gosterim"><div className="sahne" ref={alan}/><div className="sahne-baslik"><span>KARAKTERİN / KOLEKSİYONUN</span><h1>Üzerinde dene.</h1><p>{kilitli.length?'Önizleme · Henüz sahip olmadığın eşya var.':fark?'Kaydedilmemiş değişiklikler':'Oyuna kaydedilen görünüm'}</p></div>
 <div className="kamera"><button onClick={()=>sahne.current?.yakin(true)}>Yüzü incele</button><button onClick={()=>sahne.current?.yakin(false)}>Tüm karakter</button></div>
 <div className="sahne-alt"><div className="hareketler">{[['bekle','Bekle'],['yuru','Yürü'],['selam','Selam ver']].map(([id,ad])=><button key={id} aria-pressed={mod===id} onClick={()=>{setMod(id);sahne.current?.animasyon(id);}}>{ad}</button>)}</div>
 <button className="kaydet" disabled={!durum||mesgul||!!kilitli.length||!fark} onClick={()=>islem(()=>servis.current.kaydet(guncel.current),'Görünümün kaydedildi. Meydanda aynı kıyafetlerle görüneceksin.',true)}>Görünümü kaydet</button>
 <a className="meydan-link" href="./meydan.html?envanter=1">Kaydedilen karakterle meydana git ↗</a></div></section>
 <aside><div className="cuzdan"><div><small>DENEME CÜZDANI</small><strong>{durum?.bakiye.toLocaleString('tr-TR')??'—'} coin</strong></div><span>Gerçek bakiyeni etkilemez</span></div>
 <p role="status" className="bilgi">{bilgi}</p>{hata&&<p role="alert" className="hata">{hata}</p>}
 <div className="gardrop-sekmeler">{[['magaza','Mağaza'],['envanter','Envanterim'],['kimlik','Karakter']].map(([id,ad])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{ad}</button>)}</div>
 {tab==='kimlik'?<><p>Ten, yüz biçimi ve renkler ücretsiz. Hazır görünüm seçimi takılı saçını ve ekipmanlarını korur.</p><div className="kimlikler">{KOLEKSIYON.map(k=><button key={k.id} onClick={()=>setG(a=>({...a,ten:k.kimlik.ten,yuz:k.kimlik.yuz,sacRenk:k.kimlik.sacRenk}))}>{k.ad}</button>)}</div>
 {[[TENLER,'ten','Ten'],[SAC_RENKLERI,'sacRenk','Saç rengi'],[['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'],'ceketRenk','Ceket rengi']].map(([liste,key,ad])=><fieldset key={key}><legend>{ad}</legend><div className="renkler">{liste.map((r,i)=><button key={r} aria-label={ad+' '+(i+1)} aria-pressed={g[key]===r} style={{background:r}} onClick={()=>setG(a=>({...a,[key]:r}))}/>)}</div></fieldset>)}</>:<>
 <label className="filtre">Kategori<select value={yuva} onChange={e=>setYuva(e.target.value)}><option value="hepsi">Tüm eşyalar</option>{Object.entries(YUVA_ADLARI).map(([id,ad])=><option key={id} value={id}>{ad}</option>)}</select></label>
 <div className="esya-listesi">{katalog.filter(p=>(yuva==='hepsi'||p.yuva===yuva)&&(tab!=='envanter'||sahip.includes(p.id))).map(p=>{
 const sende=sahip.includes(p.id),takili=g[p.yuva]===p.deger;
 return <article key={p.id} className={takili?'takili':''}><div><small>{YUVA_ADLARI[p.yuva]} · {p.odul?'Turnuva ödülü':sende?'Envanterinde':p.fiyat+' coin'}</small><h3>{p.ad}</h3></div><div className="esya-eylem"><button aria-label={p.ad+(sende?' tak':' dene')} aria-pressed={takili} onClick={()=>sec(p)}>{takili?'Üzerinde':sende?'Tak':'Dene'}</button>{takili&&p.yuva!=='kiyafet'&&<button aria-label={p.ad+' çıkar'} onClick={()=>setG(a=>parcayiCikar(a,p.yuva))}>Çıkar</button>}{!sende&&!p.odul&&<button disabled={mesgul} onClick={()=>setOnay(p)} aria-label={p.ad+' satın al'}>Satın al</button>}{!sende&&p.odul&&<span className="odul-kilit">Yalnız ödül</span>}</div></article>;
 })}</div></>}
 <details className="deneme-panel"><summary>Deneme araçları</summary><p>Bu düğmeler yalnız önizleme içindir. Gerçek turnuva ve coin hesabına bağlı değildir.</p><button disabled={mesgul||durum?.oduller?.includes('ilk-turnuva-denemesi')} onClick={()=>islem(()=>servis.current.odulDene(),'Deneme turnuva ödülü geldi: taç ve pelerin envanterinde.')}>Turnuva ödülünü dene</button><button disabled={mesgul} onClick={()=>islem(()=>servis.current.sifirla(),'Deneme cüzdanı ve envanteri yeniden başlatıldı.',true)}>Denemeyi yeniden başlat</button></details>
 <a className="meydan-link" href="./index.html">Serbest tasarım atölyesine dön</a><p className="not">Satın alma ve ödül denemeleri bu tarayıcıda saklanır. Yeni ürün fiyatları örnektir. Serbest atölyedeki seçimler envanter sahipliği vermez.</p></aside></main>
 {onay&&<div className="onay-zemin"><section role="dialog" aria-modal="true" aria-labelledby="satin-baslik" className="satin-onay" onKeyDown={e=>{if(e.key==='Escape'&&!mesgul)setOnay(null);if(e.key==='Tab'){const btns=[...e.currentTarget.querySelectorAll('button:not(:disabled)')];if(btns.length){e.preventDefault();const i=btns.indexOf(document.activeElement);btns[(i+(e.shiftKey?-1:1)+btns.length)%btns.length].focus();}}}}><h2 id="satin-baslik">{onay.ad}</h2><p>{onay.fiyat} deneme coin harcanacak.</p><p>Kalan: {Math.max(0,(durum?.bakiye||0)-onay.fiyat)} coin</p>{durum?.bakiye<onay.fiyat&&<p>Deneme bakiyen yetersiz.</p>}<button autoFocus disabled={mesgul} onClick={()=>setOnay(null)}>Vazgeç</button><button disabled={mesgul||durum?.bakiye<onay.fiyat} onClick={()=>islem(()=>servis.current.satinAl(onay.id),onay.ad+' envanterine eklendi. Takıp kaydedebilirsin.')}>Satın almayı onayla</button></section></div>}
 <footer><span>Önizleme · Envanter ve giydirme</span><output>{stat.fps?stat.fps+' FPS':'Ölçülüyor…'}</output></footer></div>;
}
createRoot(document.getElementById('root')).render(<Gardrop/>);
