// Hazır görünüm tarifleri; aynı gövde ve ekipman ölçü sözleşmesini paylaşırlar.
// Mağaza kimliği veya sahiplik kaydı değildir; yalnız yerel sanat kataloğu.
export const YUZLER = { dengeli: 'Dengeli', yumusak: 'Yumuşak', koseli: 'Köşeli', ince: 'İnce' };
const tarifler = [
 ['deniz','Deniz',2,'kisa',0,'dengeli'],['ada','Ada',0,'uzun',3,'yumusak'],
 ['atlas','Atlas',5,'rasta',1,'koseli'],['duru','Duru',3,'uzun',0,'ince'],
 ['ege','Ege',1,'kisa',2,'koseli'],['maya','Maya',4,'rasta',0,'yumusak'],
 ['kuzey','Kuzey',0,'kisa',1,'ince'],['lina','Lina',2,'uzun',2,'dengeli'],
 ['arda','Arda',3,'kisa',0,'koseli'],['ela','Ela',1,'uzun',3,'yumusak'],
 ['can','Can',4,'yok',0,'dengeli'],['nova','Nova',5,'uzun',1,'ince'],
 ['eren','Eren',2,'rasta',3,'koseli'],['derin','Derin',0,'uzun',1,'dengeli'],
 ['mert','Mert',1,'yok',0,'ince'],['arya','Arya',3,'rasta',2,'yumusak'],
 ['tuna','Tuna',5,'kisa',1,'dengeli'],['selin','Selin',4,'uzun',0,'ince'],
 ['baran','Baran',3,'kisa',3,'yumusak'],['ilay','İlay',2,'uzun',4,'koseli'],
 ['ozan','Ozan',0,'rasta',2,'yumusak'],['rana','Rana',1,'kisa',3,'dengeli'],
 ['toprak','Toprak',4,'kisa',1,'koseli'],['aylin','Aylin',5,'rasta',4,'yumusak'],
];
const tenler=['#f3d6bc','#e8b68e','#c58b62','#995f3c','#70442f','#422c25'];
const saclar=['#30211c','#141318','#cba44d','#9e4026','#ddd2c3'];
export const KOLEKSIYON=tarifler.map(([id,ad,ten,sac,renk,yuz])=>({id,ad,kimlik:{ten:tenler[ten],sac,sacRenk:saclar[renk],yuz}}));
export function karakterUygula(ayar,karakter){return {...ayar,...karakter.kimlik};}
