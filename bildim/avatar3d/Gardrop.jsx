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
import { tt } from '../lib/dil.js';

// Renk kategorileri — ayrı "Karakter" sekmesi kalktı, bunlar da
// alttaki tek listeye kategori olarak girdi.
const CEKET_RENKLERI=['#be542d','#275c63','#354469','#71344c','#292b30','#c9b899'];
const ALT_RENKLERI=['#253341','#3a3f4a','#5a4632','#2f4a3a','#6b4a55','#1f2933'];
const AYAKKABI_RENKLERI=['#eee7d8','#2b2b30','#c04a34','#3a5a8c','#d9c27a','#8a8f98'];
const RENK_BOLUMLERI=[
 {id:'ten',ad:tt("Ten"),alan:'ten',liste:TENLER},
 {id:'sacRenk',ad:tt("Saç rengi"),alan:'sacRenk',liste:SAC_RENKLERI},
 {id:'ceketRenk',ad:tt("Ceket rengi"),alan:'ceketRenk',liste:CEKET_RENKLERI},
 {id:'altRenk',ad:tt("Alt giyim rengi"),alan:'altRenk',liste:ALT_RENKLERI},
 {id:'ayakkabiRenk',ad:tt("Ayakkabı rengi"),alan:'ayakkabiRenk',liste:AYAKKABI_RENKLERI},
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
 kupe:        ['bas','sac'],                    // bere/uzun saç kulağı örter
 kolye:       ['pelerin','sakal'],              // tam sakal zinciri önden kapatır
 saat:        ['pelerin'],
};

/** Önizleme görünümü: aktif bölümü engelleyen yuvalar boşa çekilir. */
function onizlemeyeCevir(gorunum,bolum){
 const gizle=ENGELLEYENLER[bolum];
 if(!gizle||!gizle.length)return gorunum;
 const o={...gorunum};
 for(const yv of gizle) if(BOSLAR[yv]!==undefined) o[yv]=BOSLAR[yv];
 return o;
}

// ------------------------------------------------------------
// MENÜYE DÖN — hedef
//
// Gardırop SPA'nın dışında, kendi HTML'i olan bir sayfa
// (`/bildim/avatar3d/gardrop.html`); React Router'ın geri yığınına ait
// değil. Oyuncu Quiz Tactics'in hangi ekranından geldiyse oraya döner.
// Güvenli varsayılan `/bildim`:
//   • quizsquare (VITE_MOD=bildim): BildimApp `/bildim`i köke (`/`) indirir
//     → Quiz Tactics ana sayfası.
//   • hub (VITE_MOD yok): `/bildim` Quiz Tactics'in ana sayfasıdır.
// Geliş adresi yalnız AYNI KÖKENDEYSE kullanılır. `/gorunum` hariç tutulur:
// o rota gardıroba yönlendiriyor, oraya dönmek sonsuz döngü olur.
// avatar3d sayfaları (meydan/atölye) da hariç: onlar menü değil.
function menuHedefi(){
 try{
  if(document.referrer){
   const r=new URL(document.referrer);
   if(r.origin===location.origin&&!/\/avatar3d\//.test(r.pathname)&&!/\/gorunum\/?$/.test(r.pathname))
    return r.pathname+r.search+r.hash;
  }
 }catch(e){console.error('[Gardırop] geliş adresi okunamadı:',e);}
 return '/bildim';
}

/** Sayfanın üstünde yapışık duran katmanların (karakter + kayıt çubuğu,
 *  büyük ekranda kategori şeridi) alt kenarı — px, görünüm alanına göre. */
function sabitAltKenari(){
 let ust=0;
 for(const s of document.querySelectorAll('.gardrop .sabit-alan, .gardrop .kategori-serit')){
  if(getComputedStyle(s).position!=='sticky')continue;
  const k=s.getBoundingClientRect();
  if(k.top<=ust+1)ust=Math.max(ust,k.bottom);   // yalnız şu an yapışıksa
 }
 return ust;
}

/** "Uzun saç, Taç +2" — kayıt çubuğu dar ekranda taşmasın. */
const adlariYaz=l=>l.length<=2?l.map(p=>p.ad).join(', '):`${l[0].ad}, ${l[1].ad} +${l.length-2}`;

function Gardrop(){
 const [durum,setDurum]=useState(null),[g,setG]=useState(TEMEL),[hata,setHata]=useState(''),[bilgi,setBilgi]=useState(''),[mesgul,setMesgul]=useState(false),[onay,setOnay]=useState(null),[stat,setStat]=useState({}),[mod,setMod]=useState('bekle');
 const [kullanici,setKullanici]=useState(null);
 // Kaydet düğmesi "Kaydediliyor…" desin; `mesgul` satın almada da true olur.
 const [kaydediyor,setKaydediyor]=useState(false),[yakin,setYakin]=useState(false);
 const [geriHedef]=useState(menuHedefi);
 const kok=useRef(),sabitRef=useRef();
 // KAYDIRINCA KARAKTER KÜÇÜLÜR (Paket 12, madde 1): telefonda yapışık alan
 // karakterle birlikte ekranın yarısını yiyordu. Aşağı kaydırınca sahne
 // 88 px'lik şeride iner, en üste dönünce büyür. Eşik farkı (120 / 12 px)
 // titremeyi önler: küçülen alan sayfayı kısaltıp kaydırmayı geri çekse de
 // durum gidip gelmez. Yükseklik CSS değişkeniyle değişir — transform yok (iOS).
 const [kucukSahne,setKucukSahne]=useState(false);
 useEffect(()=>{
  let mq=null,son=false,bekleyen=0;
  try{mq=matchMedia('(max-width:760px)');}catch{/* eski tarayıcı: hep büyük */}
  const bak=()=>{
   bekleyen=0;
   const y=window.scrollY||0;
   const yeni=!!mq?.matches&&(son?y>12:y>120);
   if(yeni!==son){son=yeni;setKucukSahne(yeni);}
  };
  const kaydir=()=>{if(!bekleyen)bekleyen=requestAnimationFrame(bak);};
  window.addEventListener('scroll',kaydir,{passive:true});
  mq?.addEventListener?.('change',bak);
  bak();
  return()=>{window.removeEventListener('scroll',kaydir);mq?.removeEventListener?.('change',bak);if(bekleyen)cancelAnimationFrame(bekleyen);};
 },[]);
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
    else{setHata(tt("Gardıroba girmek için önce giriş yapmalısın."));return;}
    yukle();
   }catch(e){if(aktif)setHata(e.message||tt("Gardırop açılamadı."));}
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
    // Çizgi SABİT ALANIN ALTINDAN ölçülür: karakter + kayıt çubuğu (ve
    // büyük ekranda şerit) üstte sticky duruyor; ekranın üstü onların
    // arkasında kalıyordu ve Gözlük'e bakarken aktif bölüm "Baş aksesuarı"
    // sanılıyordu — ölçüldü.
    const ust=sabitAltKenari();
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
   const el=document.getElementById('yuva-'+id);if(!el)return;
   // scrollIntoView + scroll-margin yetmiyor: yapışık alanın boyu kayıt
   // mesajına ve ekrana göre değişiyor. Hedefe varınca yapışık kalacak
   // katmanların boyu ölçülüp başlık onların hemen altına getirilir.
   const serit=document.querySelector('.gardrop .kategori-serit');
   const seritYapisik=!!serit&&getComputedStyle(serit).position==='sticky';
   const pay=(sabitRef.current?.offsetHeight||0)+(seritYapisik?serit.offsetHeight:0)+12;
   const azHareket=matchMedia('(prefers-reduced-motion: reduce)').matches;
   scrollTo({top:Math.max(0,el.getBoundingClientRect().top+scrollY-pay),behavior:azHareket?'auto':'smooth'});
  }catch(e){console.error('[Gardırop] bölüme gidilemedi:',e);}
 };

 /** Bedava dönemde tek tık: onay penceresi açılmaz. */
 const hemenAl=(p)=>islem(()=>servis.current.satinAl(p.id),p.ad+tt(" envanterine eklendi."));

 // ------------------------------------------------------------
 // KAYDET NEDEN KAPALI — oyuncuya SÖYLENİR
 //
 // Sahibinin şikâyeti: "Görünümü kaydet'e bazen basılmıyor." Ölçüldü
 // (390 ve 1536 px): düğmenin üstüne katman binmiyordu; düğme SESSİZCE
 // disabled'dı. Sahip olunmayan bir parça denendiğinde (`kilitli`) o parça
 // takılı kalıyor, oyuncu başka yuvada değişiklik yapsa da Kaydet açılmıyordu;
 // sebebi yazan mesaj da kaydırınca ekran dışında kalan panelde duruyordu.
 // Artık kayıt çubuğu yapışık alanda ve durumu kendisi yazıyor.
 const alinabilir=kilitli.filter(p=>!p.odul); // 2D-E: ödül eşyası bedava test döneminde de satılmaz (sunucu da reddeder)
 const toplamFiyat=alinabilir.reduce((t,p)=>t+(Number(p.fiyat)||0),0);
 const bakiyeYetmez=!bedavaMi&&(durum?.bakiye??0)<toplamFiyat;
 /** Parçaları sırayla alır; biri patlarsa envanter tazelenip hata gösterilir. */
 const sirayla=async(liste)=>{
  let s=null;
  try{for(const p of liste)s=await servis.current.satinAl(p.id);return s;}
  catch(e){try{setDurum(await servis.current.yukle());}catch(e2){console.error('[Gardırop] envanter tazelenemedi:',e2);}throw e;}
 };
 const hepsiniAl=()=>{
  if(!alinabilir.length)return;
  if(bedavaMi)islem(()=>sirayla(alinabilir),adlariYaz(alinabilir)+tt(" envanterine eklendi. Şimdi kaydedebilirsin."));
  else setOnay({ad:alinabilir.length===1?alinabilir[0].ad:alinabilir.length+tt(" parça"),fiyat:toplamFiyat,parcalar:alinabilir});
 };
 /** Denenen (sahip olunmayan) parçaları çıkarır: kayıtlı hâl sende varsa ona döner. */
 const denenenleriGeriAl=()=>{
  setG(a=>{
   let o=a;
   for(const p of kilitli){
    const kayitli=durum?.gorunum?.[p.yuva];
    const kayitliSende=kayitli!==undefined&&katalog.some(k=>k.yuva===p.yuva&&k.deger===kayitli&&sahip.includes(k.id));
    o=kayitliSende?parcayiTak(o,{yuva:p.yuva,deger:kayitli}):parcayiCikar(o,p.yuva);
   }
   return o;
  });
  setBilgi(tt("Denediğin parçalar çıkarıldı."));
 };
 const kurulmamis=durum?.kurulmus===false;
 const kayitBasligi=!durum?(hata?tt("Gardırop açılamadı"):tt("Gardırop yükleniyor…"))
  :kaydediyor?tt("Kaydediliyor…")
  :kilitli.length?tt("Sende olmayan {0} deneniyor: {1}", { 0: kilitli.length===1?tt("bir parça"):kilitli.length+tt(" parça"), 1: adlariYaz(kilitli) })
  :kurulmamis?tt("Karakterini bir kez kaydet, meydana öyle girilir.")
  :fark?tt("Kaydedilmemiş değişiklik var.")
  :tt("Kaydedildi. Oyunda bu görünümle görünüyorsun.");

 // Bilgi mesajı kalıcı değil: eski "kaydedildi" yazısı yeni değişiklikte
 // yanıltmasın. Kalıcı durum yukarıdaki başlıkta, her an doğru.
 useEffect(()=>{if(!bilgi)return;const z=setTimeout(()=>setBilgi(''),6000);return()=>clearTimeout(z);},[bilgi]);
 // Yapışık alanın boyu CSS'e verilir: büyük ekranda kategori şeridi tam
 // onun altına yapışır (mesaj uzayıp kısalınca boy değişiyor).
 useEffect(()=>{
  const el=sabitRef.current,k=kok.current;if(!el||!k)return;
  const yaz=()=>{try{k.style.setProperty('--sabit-h',el.offsetHeight+'px');}catch(e){console.error('[Gardırop] boy yazılamadı:',e);}};
  yaz();
  if(typeof ResizeObserver==='undefined'){addEventListener('resize',yaz);return()=>removeEventListener('resize',yaz);}
  const gz=new ResizeObserver(yaz);gz.observe(el);return()=>gz.disconnect();
 },[]);

 const sec=p=>{setG(a=>parcayiTak(a,p));setBilgi(p.ad+(sahip.includes(p.id)?tt(" seçildi. Kaydederek oyuna uygula."):tt(" deneniyor. Kaydetmek için önce edinmelisin.")));};
 const bakiyeYazi=durum?(Number(durum.bakiye)||0).toLocaleString('tr-TR'):'—';
 const kaydetYazi=!durum?tt("Yükleniyor…"):kaydediyor?tt("Kaydediliyor…"):mesgul?tt("Bekle…"):!fark?tt("Kaydedildi ✓"):kurulmamis?tt("Karakterimi kaydet"):tt("Görünümü kaydet");
 return <div ref={kok} className={'atolye gardrop'+(kucukSahne?' kucuk-sahne':'')} data-aktif-bolum={aktifBolum||''}>
 {/* YAPIŞIK ALAN — menü düğmesi, karakter ve kayıt çubuğu HEP görünür.
     Tek sticky kap: iOS kuralı gereği fixed değil, atalarında transform yok. */}
 <div ref={sabitRef} className="sabit-alan">
  <header className="g-ust">
   {/* Ok SVG: "←" karakteri Baloo 2'de yok, bazı cihazlarda hiç çizilmiyordu. */}
   <a className="g-geri" href={geriHedef}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>{tt("Menüye dön")}</a>
   <h1 className="g-baslik">{tt("Gardırop")}{denemeMi&&<span className="g-deneme">{tt("Deneme")}</span>}</h1>
   <p className="g-bakiye" aria-label={(denemeMi?tt("Deneme bakiyesi: "):tt("Coin bakiyen: "))+bakiyeYazi}><span className="coin" aria-hidden="true">◎</span> {bakiyeYazi}</p>
  </header>
  <div className="sabit-orta">
   <section className="gosterim" aria-label={tt("Karakter önizlemesi")}>
    <div className="sahne" ref={alan}/>
    <div className="kamera" role="group" aria-label={tt("Kamera")}>
     <button type="button" aria-pressed={yakin} onClick={()=>{setYakin(true);sahne.current?.yakin(true);}}>{tt("Yüzü incele")}</button>
     <button type="button" aria-pressed={!yakin} onClick={()=>{setYakin(false);sahne.current?.yakin(false);}}>{tt("Tüm karakter")}</button>
    </div>
    {/* Bekle / Yürü / Selam ver düğmeleri kaldırıldı (Paket 12, madde 1):
        gardıropta gereksiz. Karakter varsayılan "bekle" duruşunda kalır;
        sahne.animasyon kodu duruyor (atölye sayfası kullanıyor). */}
   </section>

   {/* KAYIT ÇUBUĞU — düğme hiçbir durumda sessizce kapanmaz: ne olduğunu
       başlık yazar, sahipsiz parça varsa "Al" eylemi Kaydet'in yerine geçer. */}
   <div className={'kayit-cubugu'+(kilitli.length?' uyari':'')+(durum&&!fark&&!kilitli.length?' tamam':'')}>
    <div className="kayit-metin">
     <strong>{kayitBasligi}</strong>
     <span role="status" className="bilgi" hidden={!!hata}>{bilgi}</span>
     {hata&&<span role="alert" className="hata">{hata}</span>}
    </div>
    <div className="kayit-eylem">
     {kilitli.length?<>
      {!!alinabilir.length&&<button type="button" className="birincil" disabled={mesgul||bakiyeYetmez} onClick={hepsiniAl}>
       {mesgul?tt("Alınıyor…"):bakiyeYetmez?tt("Coin yetmiyor"):alinabilir.length===kilitli.length?(kilitli.length===1?'Al':tt("Hepsini al")):tt("Satılanları al")}{!mesgul&&!bakiyeYetmez&&<small>{bedavaMi?tt("Ücretsiz"):toplamFiyat.toLocaleString('tr-TR')+tt(" coin")}</small>}
      </button>}
      <button type="button" disabled={mesgul} onClick={denenenleriGeriAl}>{tt("Geri al")}</button>
     </>:<button type="button" className={'kaydet birincil'+(durum&&!fark?' kayitli':'')} disabled={!durum||mesgul||!fark} onClick={()=>islem(async()=>{
      setKaydediyor(true);
      try{
       const s=await servis.current.kaydet(guncel.current);
       // Kayıt tuttuktan SONRA portre üretilir: listeler bu PNG'yi kullanacak.
       await portreyiYukle(guncel.current);
       return s;
      }finally{setKaydediyor(false);}
     },tt("Görünümün kaydedildi. Meydanda aynı kıyafetlerle görüneceksin."),true)}>{kaydetYazi}</button>}
    </div>
    {!!kilitli.length&&kilitli.length!==alinabilir.length&&<p className="kayit-not">{adlariYaz(kilitli.filter(p=>!alinabilir.includes(p)))} {tt("satılmaz, yalnız turnuva ödülüyle kazanılır.")}</p>}
   </div>

   {/* Gizleme geçici ve yalnız görsel: oyuncu eşyasının silindiğini sanmasın.
       Karakterin ÜSTÜNDE değil, altında ayrı satır: kafayı örtmesin. */}
   {!!gizlenen.length&&<p className="gecici-gizli">{tt("Bu bölümde görünsün diye geçici olarak çıkarıldı:")} {gizlenen.map(yv=>YUVA_ADLARI[yv]).join(', ')}{tt(". Başka bölüme geçince geri gelir.")}</p>}
  </div>
 </div>

 <main><aside>
 <section className="g-giris">
  <h2>{tt("Karakterini giydir")}</h2>
  <p>{tt("Bir karta dokun, karakterinde hemen dene. Sende olmayanı al, sonra")} <b>{tt("Görünümü kaydet")}</b>{tt("’e bas.")}</p>
  <div className="cuzdan"><div><small>{denemeMi?tt("DENEME CÜZDANI"):tt("COIN BAKİYEN")}</small><strong>{bakiyeYazi} {tt("coin")}</strong></div><span>{denemeMi?tt("Gerçek bakiyeni etkilemez"):tt("Satın alınan parçalar bakiyenden düşer")}</span></div>
  {/* "Kaydedilen karakterle meydana git" kaldırıldı (Paket 12, madde 1):
      oyuncu kaydeder, meydana alt menüdeki Meydan sekmesinden kendisi gider. */}
 </section>
 {/* KATEGORİ ŞERİDİ — filtre DEĞİL, gezinme.
     Eskiden kategoriler bir <select> arkasındaydı ve tek seferde tek
     kategori görünüyordu. Artık hepsi tek sayfada başlıklı bölümler
     hâlinde; şerit yalnız ilgili bölüme kaydırır. Yuva sayısı sabit
     varsayılmaz: YUVA_ADLARI'na eklenen her yuva (katalogda parçası
     varsa) kendiliğinden şeride ve listeye girer, şerit satıra sarar. */}
 <nav className="kategori-serit" aria-label={tt("Kozmetik kategorileri")}>
  {[...Object.entries(YUVA_ADLARI).filter(([yv])=>katalog.some(p=>p.yuva===yv)),...RENK_BOLUMLERI.map(b=>[b.id,b.ad]),['hazir',tt("Hazır görünümler")]].map(([id,ad])=>
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
       aria-label={yuvaAd+tt(" yuvasını boşalt")}
       onClick={()=>{setG(a=>parcayiCikar(a,yv));setBilgi(yuvaAd+tt(" çıkarıldı."));}}>
      <span className="esya-gorsel esya-yok" aria-hidden="true">✕</span>
      <h3>{yv==='kiyafet'?tt("Tişört"):tt("Yok")}</h3>
      <small className={'cip '+(bosTakili?'cip-uzerinde':'cip-envanter')}>{bosTakili?tt("Üzerinde"):tt("Çıkar")}</small>
     </button>
    </article>

    {liste.map(p=>{
     const sende=sahip.includes(p.id),takili=g[p.yuva]===p.deger;
     // Kart durumu tek bakışta: Üzerinde / Deneniyor / Envanterinde / Ücretsiz / fiyat.
     const cip=takili&&sende?['uzerinde',tt("Üzerinde")]:takili?['deneniyor',tt("Deneniyor")]:sende?['envanter',tt("Envanterinde")]
      :bedavaMi?['bedava',tt("Ücretsiz")]:p.odul?['odul',tt("Satılmaz")]:['fiyat',<><span className="coin" aria-hidden="true">◎</span> {Number(p.fiyat||0).toLocaleString('tr-TR')} {tt("coin")}</>];
     return <article key={p.id} className={(takili?'takili':'')+(takili&&!sende?' deneniyor':'')+(p.odul&&!sende?' odul':'')}>
      {/* KARTIN KENDİSİ DÜĞME: tıklayınca ara onay olmadan karakterde denenir. */}
      <button type="button" className="kart-dokun" aria-pressed={takili}
        aria-label={p.ad+(sende?tt(" tak"):tt(" dene"))} onClick={()=>sec(p)}>
       <ParcaPortresi gorunum={portreTemeli} parca={p}/>
       <h3 title={p.ad}>{p.ad}</h3>
       {/* Kartın altında TEK satır: hap varsa çip yok. Fiyat/"Ücretsiz" hapın
           içinde yazar; takılıyken yeşil çerçeve + "Çıkar" hapı "Üzerinde" der.
           (Canlı 390 px: çip + hap birlikte kartı 171 px'e çıkarıyordu.) */}
       {!((!sende&&(bedavaMi||!p.odul))||(takili&&yv!=='kiyafet'))&&<small className={'cip cip-'+cip[0]}>{cip[1]}</small>}
      </button>
      {/* Nadirlik etiketi bedava dönemde de KALIR: oyuncu normalde nasıl
          kazanılacağını görsün. */}
      {p.odul&&<span className="odul-rozet">{sende?tt("Turnuva ödülü"):<><span aria-hidden="true">🔒</span> {tt("Turnuva ödülü")}</>}</span>}
      <div className="esya-eylem">
       {takili&&yv!=='kiyafet'&&<button type="button" aria-label={p.ad+tt(" çıkar")} onClick={()=>setG(a=>parcayiCikar(a,p.yuva))}>{tt("Çıkar")}</button>}
       {!sende&&(bedavaMi||!p.odul)&&<button type="button" className="al" disabled={mesgul}
         aria-label={p.ad+(bedavaMi?' al':tt(" satın al"))}
         onClick={()=>bedavaMi?hemenAl(p):setOnay(p)}>{bedavaMi?tt("Ücretsiz al"):<>{Number(p.fiyat||0).toLocaleString('tr-TR')} <span className="coin" aria-hidden="true">◎</span></>}</button>}
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
  <h2>{tt("Hazır görünümler")}</h2>
  <div className="kimlikler">
   {KOLEKSIYON.map(k=>
    <button key={k.id} type="button"
      aria-pressed={g.ten===k.kimlik.ten&&g.yuz===k.kimlik.yuz&&g.sacRenk===k.kimlik.sacRenk}
      onClick={()=>{setG(a=>({...a,ten:k.kimlik.ten,yuz:k.kimlik.yuz,sacRenk:k.kimlik.sacRenk}));setBilgi(k.ad+tt(" uygulandı."));}}>
     {/* Önizleme rozeti (Atolye.jsx'teki desen): ten dolgusu + saç rengi çerçeve. */}
     <span className="kimlik-rozet" aria-hidden="true" style={{background:k.kimlik.ten,borderColor:k.kimlik.sacRenk}}/>
     <span className="kimlik-ad">{k.ad}</span>
    </button>)}
  </div>
 </section>
 {denemeMi&&<details className="deneme-panel"><summary>{tt("Deneme araçları")}</summary><p>{tt("Bu düğmeler yalnız önizleme içindir. Gerçek turnuva ve coin hesabına bağlı değildir.")}</p><button disabled={mesgul||durum?.oduller?.includes('ilk-turnuva-denemesi')} onClick={()=>islem(()=>servis.current.odulDene(),tt("Deneme turnuva ödülü geldi: taç ve pelerin envanterinde."))}>{tt("Turnuva ödülünü dene")}</button><button disabled={mesgul} onClick={()=>islem(()=>servis.current.sifirla(),tt("Deneme cüzdanı ve envanteri yeniden başlatıldı."),true)}>{tt("Denemeyi yeniden başlat")}</button></details>}
 <nav className="g-alt-baglanti" aria-label={tt("Diğer sayfalar")}><a className="meydan-link" href={geriHedef}>{tt("← Menüye dön")}</a><a className="meydan-link" href="./index.html">{tt("Serbest tasarım atölyesine dön")}</a></nav>{denemeMi&&<p className="not">{tt("Satın alma ve ödül denemeleri bu tarayıcıda saklanır. Yeni ürün fiyatları örnektir. Serbest atölyedeki seçimler envanter sahipliği vermez.")}</p>}</aside></main>
 {onay&&<div className="onay-zemin"><section role="dialog" aria-modal="true" aria-labelledby="satin-baslik" className="satin-onay" onKeyDown={e=>{if(e.key==='Escape'&&!mesgul)setOnay(null);if(e.key==='Tab'){const btns=[...e.currentTarget.querySelectorAll('button:not(:disabled)')];if(btns.length){e.preventDefault();const i=btns.indexOf(document.activeElement);btns[(i+(e.shiftKey?-1:1)+btns.length)%btns.length].focus();}}}}><h2 id="satin-baslik">{onay.ad}</h2>
  {onay.parcalar&&<ul className="onay-liste">{onay.parcalar.map(p=><li key={p.id}>{p.ad} <span>{Number(p.fiyat||0).toLocaleString('tr-TR')} {tt("coin")}</span></li>)}</ul>}
  <p>{Number(onay.fiyat||0).toLocaleString('tr-TR')} {denemeMi?tt("deneme "):''}{tt("coin harcanacak.")}</p><p>{tt("Kalan:")} {Math.max(0,(durum?.bakiye||0)-onay.fiyat).toLocaleString('tr-TR')} {tt("coin")}</p>{durum?.bakiye<onay.fiyat&&<p className="hata">{denemeMi?tt("Deneme bakiyen"):tt("Bakiyen")} {tt("yetersiz.")}</p>}
  <div className="onay-eylem"><button type="button" autoFocus disabled={mesgul} onClick={()=>setOnay(null)}>{tt("Vazgeç")}</button><button type="button" className="birincil" disabled={mesgul||durum?.bakiye<onay.fiyat} onClick={()=>{const liste=onay.parcalar||[onay];islem(()=>sirayla(liste),adlariYaz(liste)+tt(" envanterine eklendi. Takıp kaydedebilirsin."));}}>{tt("Satın almayı onayla")}</button></div></section></div>}
 <footer><span>{denemeMi?tt("Önizleme · Envanter ve giydirme"):tt("Gardırop")}</span><output>{stat.hata?stat.hata:stat.gizli?tt("Sekme arka planda — çizim duraklatıldı"):stat.fps?stat.fps+' FPS':tt("Ölçülüyor…")}</output></footer></div>;
}
createRoot(document.getElementById('root')).render(<Gardrop/>);
