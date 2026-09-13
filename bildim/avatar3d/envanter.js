import { ayarDogrula } from './model.js';

// Görsel eşleme fiyat veya sahiplik kararı vermez. Eski eşya kodları korunur.
export const PARCALAR = [
  ['sac_kisa','Kısa saç','sac','kisa','k2_hair_kisa'],
  ['sac_uzun','Uzun saç','sac','uzun',null],
  ['sac_rasta','Rasta saç','sac','rasta','k2_hair_rasta'],
  ['ust_tisort','Tişört','kiyafet','tisort','k2_top_tisort'],
  ['ust_ceket','Ceket','kiyafet','ceket','k2_top_ceket'],
  ['ust_gelinlik','Gelinlik','kiyafet','gelinlik',null],
  ['bas_kep','Kep','bas','kep','k2_hat_kep'],
  ['bas_bere','Bere','bas','bere','k2_hat_bere'],
  ['bas_tac','Taç','bas','tac','k2_hat_tac'],
  ['bas_duvak','Duvak','bas','duvak',null],
  ['goz_gunes','Güneş gözlüğü','gozluk',true,'k2_glasses_gunes'],
  ['sirt_pelerin','Pelerin','pelerin',true,'k2_top_pelerin'],
].map(([id,ad,yuva,deger,eskiKod])=>({id,ad,yuva,deger,eskiKod}));
export const YUVA_ADLARI={sac:'Saç',kiyafet:'Kıyafet',bas:'Baş aksesuarı',gozluk:'Gözlük',pelerin:'Sırt'};
export const BOSLAR={sac:'yok',kiyafet:'tisort',bas:'yok',gozluk:false,pelerin:false};
export const TEMEL=ayarDogrula({...BOSLAR,ceket:false});
export function sahiplikDogrula(g,sahip){
  const temiz=ayarDogrula(g);
  for(const p of PARCALAR) if(temiz[p.yuva]===p.deger&&!sahip.includes(p.id)) throw new Error(p.ad+' envanterinde yok.');
  return temiz;
}
export function parcayiTak(g,p){return ayarDogrula({...g,[p.yuva]:p.deger});}
export function parcayiCikar(g,yuva){return ayarDogrula({...g,[yuva]:BOSLAR[yuva]});}
export function katalogEsle(sunucu){
  return PARCALAR.map(p=>{
    const kayit=(sunucu.parcalar||[]).find(e=>e.kod===p.eskiKod);
    const yeni=(sunucu.avatar3d_parcalar||[]).find(e=>e.id===p.id);
    // Yeni sunucu kataloğu fiyatı ve aktiflik durumunu belirler; null fiyatı
    // eski fiyata düşürmek ödül/satışa kapalı eşyayı yanlışlıkla satışa açar.
    const e=yeni||kayit;
    const aktif=!!e&&e.aktif!==false;
    return {...p,fiyat:e?.coin_fiyat??null,aktif,odul:e?.nadirlik==='etkinlik',sahip:!!(sunucu.parca_sahip||[]).includes(p.eskiKod)||!!(sunucu.avatar3d_sahip||[]).includes(p.id)};
  });
}
