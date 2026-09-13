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
  ['ust_atlet','Atlet','kiyafet','atlet',null],
  ['ust_gomlek','Gömlek','kiyafet','gomlek',null],
  ['goz_gunes','Güneş gözlüğü','gozluk','gunes','k2_glasses_gunes'],
  ['goz_kare','Kare gözlük','gozluk','kare',null],
  ['goz_yuvarlak','Yuvarlak gözlük','gozluk','yuvarlak',null],
  ['goz_okuma','Okuma gözlüğü','gozluk','okuma',null],
  ['goz_spor','Spor gözlük','gozluk','spor',null],
  ['sirt_pelerin','Pelerin','pelerin','klasik','k2_top_pelerin'],
  // Not: `pelerin: 'kisa'` modelde var ama dükkâna KONMADI — pelerin
  // etkinlik ödülüdür, varyantını satmak ödülü değersizleştirir.
  ['sakal_tam','Tam sakal','sakal','tam',null],
  ['sakal_keci','Keçi sakalı','sakal','keci',null],
  ['sakal_biyik','Bıyık','sakal','biyik',null],
  ['sakal_favori','Favori','sakal','favori',null],
  ['ayak_spor','Spor ayakkabı','ayakkabi','spor',null],
  ['ayak_bot','Bot','ayakkabi','bot',null],
  ['ayak_terlik','Terlik','ayakkabi','terlik',null],
  ['ayak_sandalet','Sandalet','ayakkabi','sandalet',null],
  ['alt_pantolon','Pantolon','alt','pantolon',null],
  ['alt_sort','Şort','alt','sort',null],
  ['alt_kapri','Kapri','alt','kapri',null],
].map(([id,ad,yuva,deger,eskiKod])=>({id,ad,yuva,deger,eskiKod}));
export const YUVA_ADLARI={sac:'Saç',kiyafet:'Üst giyim',alt:'Alt giyim',ayakkabi:'Ayakkabı',bas:'Baş aksesuarı',gozluk:'Gözlük',sakal:'Sakal',pelerin:'Sırt'};
// Boş değer = o yuvanın ücretsiz/varsayılan hâli. `kiyafet`, `alt` ve
// `ayakkabi` çıplak bırakılamaz; bu yüzden boşları temel parçadır.
export const BOSLAR={sac:'yok',kiyafet:'tisort',alt:'pantolon',ayakkabi:'spor',bas:'yok',gozluk:'yok',sakal:'yok',pelerin:'yok'};
export const TEMEL=ayarDogrula({...BOSLAR,ceket:false});
export function sahiplikDogrula(g,sahip){
  const temiz=ayarDogrula(g);
  for(const p of PARCALAR){
    // Yuvanın varsayılan değeri (tişört, pantolon, spor ayakkabı) herkeste
    // vardır — sahiplik aranmaz, yoksa yeni oyuncu giyinemez.
    if(BOSLAR[p.yuva]===p.deger) continue;
    if(temiz[p.yuva]===p.deger&&!sahip.includes(p.id)) throw new Error(p.ad+' envanterinde yok.');
  }
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
