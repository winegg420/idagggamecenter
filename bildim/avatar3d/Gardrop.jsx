import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {sahneKur} from './sahne.js';
import {TENLER,SAC_RENKLERI} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
import {TEMEL,YUVA_ADLARI,BOSLAR,parcayiTak,parcayiCikar} from './envanter.js';
import {denemeServisi,ENVANTER_ANAHTAR} from './envanter-yerel.js';
import denemeKatalog from './deneme-katalog.json';
import {denemeCuzdaniMi} from './yerel.js';
import {sunucuServisi} from './envanter-sunucu.js';
import {supabase} from '../../src/lib/supabase.js';
import ParcaPortresi from './ParcaPortresi.jsx';
import {portreMakinesiniKapat,yeniPortre} from './portre.js';
import './atolye.css';
import './yerlesim.css';
import './gardrop.css';

function Gardrop(){
 const [durum,setDurum]=useState(null),[g,setG]=useState(TEMEL),[tab,setTab]=useState('magaza'),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mesgul,setMesgul]=useState(false),[onay,setOnay]=useState(null),[stat,setStat]=useState({}),[mod,setMod]=useState('bekle');
 const [kullanici,setKullanici]=useState(null);
 // Hangi cüzdandayız: giriş yapan oyuncu GERÇEK coin harcar, oturumsuz
 // yerel geliştirme sahte cüzdanda kalır. Etiketler buna göre yazılır —
 // "Gerçek bakiyeni etkilemez" yazısı gerçek bakiyede YALAN olurdu.
 const [denemeMi,setDenemeMi]=useState(false);
 const alan=useRef(),sahne=useRef(),servis=useRef(),kilit=useRef(false),guncel=useRef(g);guncel.current=g;

 /**
  * PORTRE PNG'Sİ — listelerin WebGL açmaması için.
  * Avatar.jsx 19 yerde kullanılıyor, lig tablosunda 25 satır var; her
  * satırda render etmek kabul edilemez (portre başına ~55 ms). Bu yüzden
  * portre KAYDEDERKEN BİR KEZ üretilip Storage'a yüklenir, listeler düz
  * <img> çizer.
  * Portre üretilemezse görünüm kaydı yine geçerlidir — akış durmaz.
  */
 const portreyiYukle=async(gorunum)=>{
  if(!kullanici)return;
  try{
   const veri=yeniPortre({avatar3d:gorunum});
   if(!veri)return;
   const ikili=await (await fetch(veri)).blob();
   const yol=`${kullanici}/portre3b.png`;
   const {error:yuklemeHatasi}=await supabase.storage.from('avatarlar')
     .upload(yol,ikili,{upsert:true,contentType:'image/png'});
   if(yuklemeHatasi)throw yuklemeHatasi;
   const {data:genel}=supabase.storage.from('avatarlar').getPublicUrl(yol);
   // Önbellek kırıcı: aynı adrese yazıyoruz, tarayıcı eskisini göstermesin.
   const {error:kayitHatasi}=await supabase.rpc('avatar3d_portre_kaydet',{p_url:`${genel.publicUrl}?v=${Date.now()}`});
   if(kayitHatasi)throw kayitHatasi;
  }catch(e){console.error('[Gardırop] portre yuklenemedi:',e);}
 };
 useEffect(()=>{
  let aktif=true;
  try{sahne.current=sahneKur(alan.current,TEMEL,setStat);if(matchMedia('(prefers-reduced-motion: reduce)').matches){sahne.current.animasyon('dur');setMod('dur');}}catch(e){setHata(e.message);}
  const yukle=async()=>{try{const s=await servis.current.yukle();if(aktif){setDurum(s);setG(s.gorunum);}}catch(e){if(aktif)setHata(e.message);}};

  // HANGİ CÜZDAN: giriş yapmış oyuncu GERÇEK ekonomide (avatar3d_* RPC),
  // oturumsuz yerel geliştirme deneme cüzdanında çalışır.
  (async()=>{
   try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!aktif)return;
    if(session){servis.current=sunucuServisi(supabase);setKullanici(session.user.id);setDenemeMi(false);}
    else if(denemeCuzdaniMi()){servis.current=denemeServisi(localStorage,denemeKatalog);setDenemeMi(true);}
    else{setHata('Gardıroba girmek için önce giriş yapmalısın.');return;}
    yukle();
   }catch(e){if(aktif)setHata(e.message||'Gardırop açılamadı.');}
  })();

  const degisti=e=>{if(e.key===ENVANTER_ANAHTAR)yukle();};window.addEventListener('storage',degisti);
  return()=>{aktif=false;window.removeEventListener('storage',degisti);sahne.current?.yokEt();portreMakinesiniKapat();};
 },[]);
 useEffect(()=>{try{sahne.current?.guncelle(g);}catch(e){setHata(e.message);}},[g]);
 // Küçük resimler ~250 ms GECİKTİRİLİR: renk paletinde gezerken her
 // tıklamada 12 portre üretilmesin. Canlı sahne anında güncellenmeye
 // devam ediyor (yukarıdaki effect), gecikme yalnız kartlarda.
 const [portreTemeli,setPortreTemeli]=useState(TEMEL);
 useEffect(()=>{const z=setTimeout(()=>setPortreTemeli(g),250);return()=>clearTimeout(z);},[g]);
 async function islem(fn,mesaj,uygula=false){
  if(kilit.current)return;kilit.current=true;setMesgul(true);setHata('');
  try{const s=await fn();setDurum(s);if(uygula)setG(s.gorunum);setBilgi(mesaj);setOnay(null);window.dispatchEvent(new Event('qs-envanter3d'));}
  catch(e){setHata(e.message);}finally{kilit.current=false;setMesgul(false);}
 }
 const sahip=durum?.sahip||[],katalog=durum?.katalog||[];
 const kilitli=katalog.filter(p=>g[p.yuva]===p.deger&&!sahip.includes(p.id));
 // Karakterini hiç kurmamış oyuncu hiçbir şeyi değiştirmeden de kaydedebilsin:
 // yoksa "değişiklik yok" diye Kaydet kapalı kalıyor ve meydan kapısı
 // (karakteri olmayan giremez) hiç açılamıyordu.
 const fark=durum&&(durum.kurulmus===false||JSON.stringify(g)!==JSON.stringify(durum.gorunum));
 // TEST DÖNEMİ: sunucu "bedava" diyorsa fiyat yerine "Ücretsiz" yazılır
 // ve satın alma tek tıkla, onaysız olur. Kararı yine sunucu veriyor
 // (avatar3d_satin_al); burası yalnız görüntü.
 const bedavaMi=durum?.bedavaTest===true;

 /** Kategori şeridi: filtre değil, ilgili bölüme kaydırır. */
 const bolumeGit=(id)=>{
  try{
   document.getElementById('yuva-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){console.error('[Gardırop] bölüme gidilemedi:',e);}
 };

 /** Bedava dönemde tek tık: onay penceresi açılmaz. */
 const hemenAl=(p)=>islem(()=>servis.current.satinAl(p.id),p.ad+' envanterine eklendi.');

 const sec=p=>{setG(a=>parcayiTak(a,p));setBilgi(p.ad+(sahip.includes(p.id)?' seçildi. Kaydederek oyuna uygula.':' deneniyor. Kaydetmek için önce edinmelisin.'));};
 return <div className="atolye gardrop"><header><a href="./index.html">Quiz Square</a><span className="etiket">{denemeMi?`GARDIROP · DENEME`:`GARDIROP`}</span></header>
 <main><section className="gosterim"><div className="sahne" ref={alan}/><div className="sahne-baslik"><span>KARAKTERİN / KOLEKSİYONUN</span><h1>Üzerinde dene.</h1><p>{kilitli.length?'Önizleme · Henüz sahip olmadığın eşya var.':fark?'Kaydedilmemiş değişiklikler':'Oyuna kaydedilen görünüm'}</p></div>
 <div className="kamera"><button onClick={()=>sahne.current?.yakin(true)}>Yüzü incele</button><button onClick={()=>sahne.current?.yakin(false)}>Tüm karakter</button></div>
 <div className="sahne-alt"><div className="hareketler">{[['bekle','Bekle'],['yuru','Yürü'],['selam','Selam ver']].map(([id,ad])=><button key={id} aria-pressed={mod===id} onClick={()=>{setMod(id);sahne.current?.animasyon(id);}}>{ad}</button>)}</div>
 <button className="kaydet" disabled={!durum||mesgul||!!kilitli.length||!fark} onClick={()=>islem(async()=>{
  const s=await servis.current.kaydet(guncel.current);
  // Kayıt tuttuktan SONRA portre üretilir: listeler bu PNG'yi kullanacak.
  await portreyiYukle(guncel.current);
  return s;
 },'Görünümün kaydedildi. Meydanda aynı kıyafetlerle görüneceksin.',true)}>Görünümü kaydet</button>
 <a className="meydan-link" href="./meydan.html?envanter=1">Kaydedilen karakterle meydana git ↗</a></div></section>
 <aside><div className="cuzdan"><div><small>{denemeMi?'DENEME CÜZDANI':'COIN BAKİYEN'}</small><strong>{durum?.bakiye.toLocaleString('tr-TR')??'—'} coin</strong></div><span>{denemeMi?'Gerçek bakiyeni etkilemez':'Satın alınan parçalar bakiyenden düşer'}</span></div>
 <p role="status" className="bilgi">{bilgi}</p>{hata&&<p role="alert" className="hata">{hata}</p>}
 <div className="gardrop-sekmeler">{[['magaza','Mağaza'],['envanter','Envanterim'],['kimlik','Karakter']].map(([id,ad])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{ad}</button>)}</div>
 {tab==='kimlik'?<><p>Ten, yüz biçimi ve renkler ücretsiz. Hazır görünüm seçimi takılı saçını ve ekipmanlarını korur.</p><div className="kimlikler">{KOLEKSIYON.map(k=><button key={k.id} onClick={()=>setG(a=>({...a,ten:k.kimlik.ten,yuz:k.kimlik.yuz,sacRenk:k.kimlik.sacRenk}))}>{k.ad}</button>)}</div>
 {[[TENLER,'ten','Ten'],[SAC_RENKLERI,'sacRenk','Saç rengi'],[['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'],'ceketRenk','Ceket rengi']].map(([liste,key,ad])=><fieldset key={key}><legend>{ad}</legend><div className="renkler">{liste.map((r,i)=><button key={r} aria-label={ad+' '+(i+1)} aria-pressed={g[key]===r} style={{background:r}} onClick={()=>setG(a=>({...a,[key]:r}))}/>)}</div></fieldset>)}</>:<>
 {/* KATEGORİ ŞERİDİ — filtre DEĞİL, gezinme.
     Eskiden kategoriler bir <select> arkasındaydı ve tek seferde tek
     kategori görünüyordu. Artık hepsi tek sayfada başlıklı bölümler
     hâlinde; şerit yalnız ilgili bölüme kaydırır. */}
 <nav className="kategori-serit" aria-label="Kozmetik kategorileri">
  {Object.entries(YUVA_ADLARI).map(([id,ad])=>
   <button key={id} type="button" onClick={()=>bolumeGit(id)}>{ad}</button>)}
 </nav>

 {Object.entries(YUVA_ADLARI).map(([yv,yuvaAd])=>{
  const liste=katalog.filter(p=>p.yuva===yv&&(tab!=='envanter'||sahip.includes(p.id)));
  if(!liste.length)return null;
  const bosTakili=g[yv]===BOSLAR[yv];
  return <section key={yv} id={'yuva-'+yv} className="yuva-bolum">
   <h2>{yuvaAd}</h2>
   <div className="esya-listesi">
    {/* Her bölümün başında "boşalt" seçeneği: oyuncu ayrı düğme aramasın. */}
    <article className={'esya-bos'+(bosTakili?' takili':'')}>
     <button type="button" className="kart-dokun" aria-pressed={bosTakili}
       aria-label={yuvaAd+' yuvasını boşalt'}
       onClick={()=>{setG(a=>parcayiCikar(a,yv));setBilgi(yuvaAd+' çıkarıldı.');}}>
      <span className="esya-gorsel esya-yok" aria-hidden="true">✕</span>
      <h3>{yv==='kiyafet'?'Tişört':'Yok'}</h3>
      <small>{bosTakili?'Üzerinde':'Çıkar'}</small>
     </button>
    </article>

    {liste.map(p=>{
     const sende=sahip.includes(p.id),takili=g[p.yuva]===p.deger;
     return <article key={p.id} className={(takili?'takili':'')+(p.odul&&!sende?' odul':'')}>
      {/* KARTIN KENDİSİ DÜĞME: tıklayınca ara onay olmadan karakterde denenir. */}
      <button type="button" className="kart-dokun" aria-pressed={takili}
        aria-label={p.ad+(sende?' tak':' dene')} onClick={()=>sec(p)}>
       <ParcaPortresi gorunum={portreTemeli} parca={p}/>
       <h3>{p.ad}</h3>
       <small>{takili?'Üzerinde':sende?'Envanterinde':bedavaMi?'Ücretsiz':<><span className="coin" aria-hidden="true">◎</span> {p.fiyat} coin</>}</small>
      </button>
      {/* Nadirlik etiketi bedava dönemde de KALIR: oyuncu normalde nasıl
          kazanılacağını görsün. */}
      {p.odul&&<span className="odul-rozet">{sende?'Turnuva ödülü':<><span aria-hidden="true">🔒</span> Turnuva ödülü</>}</span>}
      <div className="esya-eylem">
       {takili&&yv!=='kiyafet'&&<button type="button" aria-label={p.ad+' çıkar'} onClick={()=>setG(a=>parcayiCikar(a,p.yuva))}>Çıkar</button>}
       {!sende&&(bedavaMi||!p.odul)&&<button type="button" disabled={mesgul}
         aria-label={p.ad+(bedavaMi?' al':' satın al')}
         onClick={()=>bedavaMi?hemenAl(p):setOnay(p)}>{bedavaMi?'Al':'Satın al'}</button>}
       {!sende&&!bedavaMi&&p.odul&&<span className="odul-kilit">Yalnız ödül</span>}
      </div></article>;
    })}
   </div>
  </section>;
 })}</>}
 {denemeMi&&<details className="deneme-panel"><summary>Deneme araçları</summary><p>Bu düğmeler yalnız önizleme içindir. Gerçek turnuva ve coin hesabına bağlı değildir.</p><button disabled={mesgul||durum?.oduller?.includes('ilk-turnuva-denemesi')} onClick={()=>islem(()=>servis.current.odulDene(),'Deneme turnuva ödülü geldi: taç ve pelerin envanterinde.')}>Turnuva ödülünü dene</button><button disabled={mesgul} onClick={()=>islem(()=>servis.current.sifirla(),'Deneme cüzdanı ve envanteri yeniden başlatıldı.',true)}>Denemeyi yeniden başlat</button></details>}
 <a className="meydan-link" href="./index.html">Serbest tasarım atölyesine dön</a><p className="not">Satın alma ve ödül denemeleri bu tarayıcıda saklanır. Yeni ürün fiyatları örnektir. Serbest atölyedeki seçimler envanter sahipliği vermez.</p></aside></main>
 {onay&&<div className="onay-zemin"><section role="dialog" aria-modal="true" aria-labelledby="satin-baslik" className="satin-onay" onKeyDown={e=>{if(e.key==='Escape'&&!mesgul)setOnay(null);if(e.key==='Tab'){const btns=[...e.currentTarget.querySelectorAll('button:not(:disabled)')];if(btns.length){e.preventDefault();const i=btns.indexOf(document.activeElement);btns[(i+(e.shiftKey?-1:1)+btns.length)%btns.length].focus();}}}}><h2 id="satin-baslik">{onay.ad}</h2><p>{onay.fiyat} deneme coin harcanacak.</p><p>Kalan: {Math.max(0,(durum?.bakiye||0)-onay.fiyat)} coin</p>{durum?.bakiye<onay.fiyat&&<p>Deneme bakiyen yetersiz.</p>}<button autoFocus disabled={mesgul} onClick={()=>setOnay(null)}>Vazgeç</button><button disabled={mesgul||durum?.bakiye<onay.fiyat} onClick={()=>islem(()=>servis.current.satinAl(onay.id),onay.ad+' envanterine eklendi. Takıp kaydedebilirsin.')}>Satın almayı onayla</button></section></div>}
 <footer><span>{denemeMi?'Önizleme · Envanter ve giydirme':'Gardırop'}</span><output>{stat.hata?stat.hata:stat.gizli?'Sekme arka planda — çizim duraklatıldı':stat.fps?stat.fps+' FPS':'Ölçülüyor…'}</output></footer></div>;
}
createRoot(document.getElementById('root')).render(<Gardrop/>);
