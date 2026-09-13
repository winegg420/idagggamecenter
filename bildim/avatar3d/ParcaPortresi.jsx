// ============================================================
// PARÇA PORTRESİ KARTI — gardırop listesindeki küçük resim
//
// Sayfada zaten canlı 3B sahne dönüyor ve altbilgide FPS yazıyor. 12 portreyi
// birden üretirsek sahne takılır; iki fren var:
//   1) TEMBEL — kart görünür alana girmeden portre üretilmez
//      (IntersectionObserver).
//   2) SIRALI — kare başına EN FAZLA BİR portre; istekler modül düzeyindeki
//      kuyruğa girer, requestAnimationFrame tek tek boşaltır.
//
// Görsel kutusunun boyu baştan sabit (aspect-ratio: 1) ve hazır olana kadar
// iskelet duruyor: resim gelince düzen zıplamaz.
//
// prefers-reduced-motion altında da küçük resimler GÖRÜNÜR — bunlar durağan
// PNG, hareket değil.
// ============================================================
import React,{useEffect,useRef,useState} from 'react';
import {parcaPortresi} from './portre.js';

// Kuyruk PAYLAŞILIR (portre-kuyrugu.js): listelerdeki avatarlar da aynı
// kuyruğu kullanır, toplam yük kare başına bir render olarak kalır.
import {siraya} from './portre-kuyrugu.js';

/**
 * @param {object} p
 * @param {object} p.gorunum oyuncunun o anki görünümü
 * @param {object} p.parca   envanter.js parçası: {yuva, deger, ad}
 * @param {number} [p.boyut] render kenarı (px)
 */
export default function ParcaPortresi({gorunum,parca,boyut=192}){
 const kutuRef=useRef(null);
 const [kaynak,setKaynak]=useState(null);
 // Portrenin tam olarak neye baktığı: görünüm + bu parça.
 const anahtar=JSON.stringify({...(gorunum||{}),[parca.yuva]:parca.deger});

 useEffect(()=>{
  const kutu=kutuRef.current;
  if(!kutu)return undefined;
  let atildi=false;
  setKaynak(null);

  const uret=()=>{
   if(atildi)return;
   const veri=parcaPortresi(gorunum,parca,boyut);
   if(!atildi&&veri)setKaynak(veri);
  };

  // IntersectionObserver yoksa (çok eski tarayıcı) doğrudan sıraya alınır.
  if(typeof IntersectionObserver!=='function'){siraya(uret);return()=>{atildi=true;};}

  const gozcu=new IntersectionObserver(girisler=>{
   for(const gir of girisler){
    if(!gir.isIntersecting)continue;
    gozcu.disconnect();
    siraya(uret);
   }
  },{rootMargin:'120px'});
  gozcu.observe(kutu);
  return()=>{atildi=true;gozcu.disconnect();};
  // `anahtar` görünümün tamamını temsil ediyor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[anahtar,boyut]);

 return <span className="esya-gorsel" ref={kutuRef}>
  {kaynak?<img src={kaynak} alt="" draggable="false"/>:<span className="esya-iskelet" aria-hidden="true"/>}
 </span>;
}
