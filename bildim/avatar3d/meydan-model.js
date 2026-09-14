import {modelKur,modelYokEt,ayarDogrula,hareket} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
import {isimEtiketi,nesneyiSerbestBirak} from '../harita/ortak.js';
export function meydanModelKur({ad,gorunum,etiketRenk}){
 let hash=0;for(const c of (gorunum?.karakter||'deniz'))hash=(hash*31+c.charCodeAt(0))>>>0;
 const g=modelKur(ayarDogrula(gorunum?.avatar3d||{...KOLEKSIYON[hash%KOLEKSIYON.length].kimlik,kiyafet:'tisort'}));
 Object.assign(g.userData,{gercek3d:true,ad,gorunum,zaman:0,kafaY:g.userData.kafa.position.y});
 if(ad!=null){const etiket=isimEtiketi(ad,etiketRenk);etiket.position.y=4.15;g.add(etiket);g.userData.etiket=etiket;}
 return g;
}
export function meydanModelSil(g){if(g.userData.etiket)nesneyiSerbestBirak(g.userData.etiket);modelYokEt(g);}
export function meydanModelDegistir(g,gorunum){
 const yeni=meydanModelKur({ad:g.userData.ad,gorunum,etiketRenk:'#20324A'});
 if(g.userData.etiket)nesneyiSerbestBirak(g.userData.etiket);
 g.userData.yokEt();g.clear();
 for(const c of [...yeni.children])g.add(c);
 g.userData=yeni.userData;
}
// `zemin`: ayağın bastığı yükseklik (köprü kemeri; Paket 13). Zıplama bunun
// üstüne eklenir; duruş yalnız zıplamaya bakar — köprüde bacaklar toplanmaz.
export function meydanModelYuru(g,dt,guc,zipla,zemin=0){
 const u=g.userData;u.zaman+=dt*(guc>.05?Math.max(.3,guc):1);
 hareket(g,u.zaman,guc>.05&&zipla<=0?'yuru':'bekle');
 g.position.y=zemin+zipla;
 if(zipla>0)for(const e of u.eklemler){e.bac.rotation.x=-.35;e.diz.rotation.x=.7;e.kol.rotation.x=-.5;}
}
