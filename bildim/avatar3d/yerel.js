import { ayarDogrula, VARSAYILAN } from './model.js';
const ANAHTAR='quizsquare_avatar3d_prototip_v1';
export const yerelMi=()=>typeof location!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
export const onizlemeMi=()=>yerelMi()||import.meta.env.VITE_AVATAR3D_DEMO==='1';
export function yerelOku(){try{return ayarDogrula(JSON.parse(localStorage.getItem(ANAHTAR))||VARSAYILAN);}catch{return {...VARSAYILAN};}}
export function yerelKaydet(g){localStorage.setItem(ANAHTAR,JSON.stringify(ayarDogrula(g)));window.dispatchEvent(new Event('qs-avatar3d'));}
