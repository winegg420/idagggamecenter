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

// Renk kategorileri — ayrı "Karakter" sekmesi kalktı, bunlar da
// alttaki tek listeye kategori olarak girdi.
const CEKET_RENKLERI=['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'];
const ALT_RENKLERI=['#253341','#3a3f4a','#5a4632','#2f4a3a','#6b4a55','#1f2933'];
const AYAKKABI_RENKLERI=['#eee7d8','#2b2b30','#c04a34','#3a5a8c','#d9c27a','#8a8f98'];
const RENK_BOLUMLERI=[
 {id:'ten',ad:'Ten',alan:'ten',liste:TENLER},
 {id:'sacRenk',ad:'Saç rengi',alan:'sacRenk',liste:SAC_RENKLERI},
 {id:'ceketRenk',ad:'Ceket rengi',alan:'ceketRenk',liste:CEKET_RENKLERI},
 {id:'altRenk',ad:'Alt giyim rengi',alan:'altRenk',liste:ALT_RENKLERI},
 {id:'ayakkabiRenk',ad:'Ayakkabı rengi',alan:'ayakkabiRenk',liste:AYAKKABI_RENKLERI},
];

// ------------------------------------------------------------
// KATEGORİYE GÖRE OTOMATİK GİZLEME
//
// Sahibinin şikâyeti: "karakterde şapka varken Ege/Maya/Nova gibi hazır
// görünümler arasında gezerken yüzündeki farklılıkları göremiyorum."
// Şapka takılıyken yüz/ten/saç seçerken kafa kapalı kalıyordu.
//
// Çözüm (WoW Shadowlands, Elden Ring, Monster Hunter'daki desen): hangi
// bölüme bakılıyorsa onu ENGELLEYEN yuvalar önizlemede gizlenir.
// GİZLEME YALNIZ ÖNİZLEMEDEDİR — `g` (gerçek seçim) hiç değişmez, kayıt
// ve envanter etkilenmez; bölümden çıkınca parça aynen geri gelir.
// Ayrı "çıplak mod" düğmesi yok, kategoriye göre kendiliğinden olur.
//
// Tablo genişletilebilir: yeni yuva eklenince buraya bir satır yazmak
// yeter. Anahtar = bölüm id'si (yuva adı, renk bölümü ya da 'hazir').
// Değer = o bölüme bakarken gizlenecek yuvalar.
const ENGELLEYENLER={
 hazir:       ['bas','sac','gozluk','sakal'],  // yüz farkları görünsün
 ten:         ['bas','sac','gozluk','sakal'],
 sac:         ['bas'],                          // şapka saçı örter
 sacRenk:     ['bas'],
 gozluk:      ['bas','sac'],                    // kasket siperi/uzun saç gözü örter
 sakal:       ['bas'],
 kiyafet:     ['pelerin'],                      // pelerin gövdeyi örter
 ceketRenk:   ['pelerin'],
 alt:         ['pelerin'],
 altRenk:     ['pelerin'],
 ayakkabi:    ['pelerin'],
 ayakkabiRenk:['pelerin'],
};

/** Önizleme görünümü: aktif bölümü engelleyen yuvalar boşa çekilir. */
function onizlemeyeCevir(gorunum,bolum){
 const gizle=ENGELLEYENLER[bolum];
 if(!gizle||!gizle.length)return gorunum;
 const o={...gorunum};
 for(const yv of gizle) if(BOSLAR[yv]!==undefined) o[yv]=BOSLAR[yv];
 return o;
}

function Gardrop(){
 const [durum,setDurum]=useState(null),[g,setG]=useState(TEMEL),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mesgul,setMesgul]=useState(false),[onay,setOnay]=useState(null),[stat,setStat]=useState({}),[mod,setMod]=useState('bekle');
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
 // AKTİF BÖLÜM — ekranda hangi kategori duruyorsa o. Şerit düğmeleri
 // filtre değil kaydırma olduğu için "aktif" ancak kaydırmadan okunabilir;
 // IntersectionObserver en üstteki görünür bölümü seçer.
 const [aktifBolum,setAktifBolum]=useState(null);
 useEffect(()=>{
  if(!durum)return;   // bölümler ancak katalog gelince basılıyor
  let bekleyen=0;
  // Ekranın üst üçte birindeki yatay çizgiyi HANGİ bölüm kaplıyorsa o
  // aktiftir. "Çizgiye en yakın başlık" denemesi yanlış çıktı: uzun bir
  // bölümün başlığı yukarı kayınca bir SONRAKİ bölüm aktif sanılıyordu.
  const oku=()=>{
   bekleyen=0;
   try{
    // Çizgi SABİT ALANIN ALTINDAN ölçülür: karakter (ve masaüstünde şerit)
    // üstte sticky duruyor; ekranın %34'ü artık onun arkasında kalıyordu ve
    // Gözlük'e bakarken aktif bölüm "Baş aksesuarı" sanılıyordu — ölçüldü.
    // DOM sırasıyla: önce karakter, sonra hemen altına yapışan şerit.
    let ust=0;
    for(const s of document.querySelectorAll('.gardrop .gosterim, .kategori-serit')){
     const k=s.getBoundingClientRect();
     if(getComputedStyle(s).position==='sticky'&&k.top<=Math.max(ust,80)+1)ust=Math.max(ust,k.bottom);
    }
    const cizgi=ust+(innerHeight-ust)*0.3;
    let en=null,enUst=-Infinity,ilkGorunen=null;
    for(const el of document.querySelectorAll('.yuva-bolum')){
     const k=el.getBoundingClientRect();
     if(k.bottom<0||k.top>innerHeight)continue;     // ekran dışı
     if(!ilkGorunen)ilkGorunen=el.id;
     if(k.top<=cizgi&&k.bottom>cizgi&&k.top>enUst){enUst=k.top;en=el.id;}
    }
    const secilen=en||ilkGorunen;
    setAktifBolum(secilen?secilen.replace(/^yuva-/,''):null);
   }catch(e){console.error('[Gardırop] bölüm okunamadı:',e);}
  };
  // setTimeout ile kısılıyor, requestAnimationFrame ile DEĞİL: sekme
  // arka plandayken (otomasyon/gizli sekme) rAF hiç çalışmıyor ve aktif
  // bölüm ilk değerinde donuyordu — ölçüldü.
  const tetik=()=>{if(!bekleyen)bekleyen=setTimeout(oku,60);};
  oku();
  // scroll baloncuk yapmaz; yakalama evresinde dinlenir ki hangi kap
  // kayarsa kaysın duyulsun.
  addEventListener('scroll',tetik,true);addEventListener('resize',tetik);
  return()=>{removeEventListener('scroll',tetik,true);removeEventListener('resize',tetik);if(bekleyen)clearTimeout(bekleyen);};
 },[durum]);

 // Sahneye GİDEN görünüm önizlemedir; `g` (gerçek seçim) değişmez.
 const onizleme=onizlemeyeCevir(g,aktifBolum);
 const onizlemeAnahtari=JSON.stringify(onizleme);
 useEffect(()=>{try{sahne.current?.guncelle(JSON.parse(onizlemeAnahtari));}catch(e){setHata(e.message);}},[onizlemeAnahtari]);
 // Bir şey gizlendiyse oyuncuya söyle: "eşyam kayboldu" paniği olmasın.
 const gizlenen=(ENGELLEYENLER[aktifBolum]||[]).filter(yv=>g[yv]!==BOSLAR[yv]);
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
  // Aktif bölüm ÖNCE burada kesinleşir, kaydırmayı beklemeden: kaydırma
  // olayı bazı ortamlarda (arka plan sekmesi, azaltılmış hareket) hiç
  // gelmiyor ve önizleme kilitli kalıyordu — ölçüldü. Kaydırma dinleyicisi
  // yalnız elle kaydıranlar için ek olarak çalışır.
  setAktifBolum(id);
  try{
   document.getElementById('yuva-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){console.error('[Gardırop] bölüme gidilemedi:',e);}
 };

 /** Bedava dönemde tek tık: onay penceresi açılmaz. */
 const hemenAl=(p)=>islem(()=>servis.current.satinAl(p.id),p.ad+' envanterine eklendi.');

 const sec=p=>{setG(a=>parcayiTak(a,p));setBilgi(p.ad+(sahip.includes(p.id)?' seçildi. Kaydederek oyuna uygula.':' deneniyor. Kaydetmek için önce edinmelisin.'));};
 return <div className="atolye gardrop" data-aktif-bolum={aktifBolum||''}><header><a href="./index.html">Quiz Square</a><span className="etiket">{denemeMi?`GARDIROP · DENEME`:`GARDIROP`}</span></header>
 <main><section className="gosterim"><div className="sahne" ref={alan}/><div className="sahne-baslik"><span>KARAKTERİN / KOLEKSİYONUN</span><h1>Üzerinde dene.</h1><p>{kilitli.length?'Önizleme · Henüz sahip olmadığın eşya var.':fark?'Kaydedilmemiş değişiklikler':'Oyuna kaydedilen görünüm'}</p>
</div>
 {/* Gizleme geçici ve yalnız görsel: oyuncu eşyasının silindiğini sanmasın.
     Kamera düğmelerinin ALTINDA duruyor, üstlerine binmesin diye. */}
 {!!gizlenen.length&&<p className="gecici-gizli">Bu bölümde görünsün diye geçici olarak çıkarıldı: {gizlenen.map(yv=>YUVA_ADLARI[yv]).join(', ')}. Başka bölüme geçince geri gelir.</p>}
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
 {/* KATEGORİ ŞERİDİ — filtre DEĞİL, gezinme.
     Eskiden kategoriler bir <select> arkasındaydı ve tek seferde tek
     kategori görünüyordu. Artık hepsi tek sayfada başlıklı bölümler
     hâlinde; şerit yalnız ilgili bölüme kaydırır. */}
 <nav className="kategori-serit" aria-label="Kozmetik kategorileri">
  {[...Object.entries(YUVA_ADLARI),...RENK_BOLUMLERI.map(b=>[b.id,b.ad]),['hazir','Hazır görünümler']].map(([id,ad])=>
   <button key={id} type="button" aria-pressed={aktifBolum===id} onClick={()=>bolumeGit(id)}>{ad}</button>)}
 </nav>

 {Object.entries(YUVA_ADLARI).map(([yv,yuvaAd])=>{
  const liste=katalog.filter(p=>p.yuva===yv);
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
 })}

 {/* RENKLER — eskiden ayrı "Karakter" sekmesindeydi; sekme kalktı,
     her şey tek listede. Kart yerine renk yuvarlağı kullanılır. */}
 {RENK_BOLUMLERI.map(b=>
  <section key={b.id} id={'yuva-'+b.id} className="yuva-bolum">
   <h2>{b.ad}</h2>
   <div className="renkler" role="group" aria-label={b.ad}>
    {b.liste.map((r,i)=>
     <button key={r} type="button" className={'renk-yuvarlak'+(g[b.alan]===r?' takili':'')}
       aria-label={b.ad+' '+(i+1)} aria-pressed={g[b.alan]===r}
       style={{background:r}} onClick={()=>setG(a=>({...a,[b.alan]:r}))}/>)}
   </div>
  </section>)}

 {/* HAZIR GÖRÜNÜMLER — takılı saç ve ekipmanları korur, yalnız
     ten/yüz/saç rengini uygular. */}
 <section id="yuva-hazir" className="yuva-bolum">
  <h2>Hazır görünümler</h2>
  <div className="kimlikler">
   {KOLEKSIYON.map(k=>
    <button key={k.id} type="button"
      onClick={()=>{setG(a=>({...a,ten:k.kimlik.ten,yuz:k.kimlik.yuz,sacRenk:k.kimlik.sacRenk}));setBilgi(k.ad+' uygulandı.');}}>
     {k.ad}
    </button>)}
  </div>
 </section>
 {denemeMi&&<details className="deneme-panel"><summary>Deneme araçları</summary><p>Bu düğmeler yalnız önizleme içindir. Gerçek turnuva ve coin hesabına bağlı değildir.</p><button disabled={mesgul||durum?.oduller?.includes('ilk-turnuva-denemesi')} onClick={()=>islem(()=>servis.current.odulDene(),'Deneme turnuva ödülü geldi: taç ve pelerin envanterinde.')}>Turnuva ödülünü dene</button><button disabled={mesgul} onClick={()=>islem(()=>servis.current.sifirla(),'Deneme cüzdanı ve envanteri yeniden başlatıldı.',true)}>Denemeyi yeniden başlat</button></details>}
 <a className="meydan-link" href="./index.html">Serbest tasarım atölyesine dön</a><p className="not">Satın alma ve ödül denemeleri bu tarayıcıda saklanır. Yeni ürün fiyatları örnektir. Serbest atölyedeki seçimler envanter sahipliği vermez.</p></aside></main>
 {onay&&<div className="onay-zemin"><section role="dialog" aria-modal="true" aria-labelledby="satin-baslik" className="satin-onay" onKeyDown={e=>{if(e.key==='Escape'&&!mesgul)setOnay(null);if(e.key==='Tab'){const btns=[...e.currentTarget.querySelectorAll('button:not(:disabled)')];if(btns.length){e.preventDefault();const i=btns.indexOf(document.activeElement);btns[(i+(e.shiftKey?-1:1)+btns.length)%btns.length].focus();}}}}><h2 id="satin-baslik">{onay.ad}</h2><p>{onay.fiyat} deneme coin harcanacak.</p><p>Kalan: {Math.max(0,(durum?.bakiye||0)-onay.fiyat)} coin</p>{durum?.bakiye<onay.fiyat&&<p>Deneme bakiyen yetersiz.</p>}<button autoFocus disabled={mesgul} onClick={()=>setOnay(null)}>Vazgeç</button><button disabled={mesgul||durum?.bakiye<onay.fiyat} onClick={()=>islem(()=>servis.current.satinAl(onay.id),onay.ad+' envanterine eklendi. Takıp kaydedebilirsin.')}>Satın almayı onayla</button></section></div>}
 <footer><span>{denemeMi?'Önizleme · Envanter ve giydirme':'Gardırop'}</span><output>{stat.hata?stat.hata:stat.gizli?'Sekme arka planda — çizim duraklatıldı':stat.fps?stat.fps+' FPS':'Ölçülüyor…'}</output></footer></div>;
}
createRoot(document.getElementById('root')).render(<Gardrop/>);
