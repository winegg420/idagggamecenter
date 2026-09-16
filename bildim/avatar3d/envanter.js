import { ayarDogrula } from './model.js';
import { tt } from '../lib/dil.js';

// Görsel eşleme fiyat veya sahiplik kararı vermez. Eski eşya kodları korunur.
export const PARCALAR = [
  ['sac_kisa',tt("Kısa saç"),'sac','kisa','k2_hair_kisa'],
  ['sac_uzun',tt("Uzun saç"),'sac','uzun',null],
  ['sac_rasta',tt("Rasta saç"),'sac','rasta','k2_hair_rasta'],
  // Paket 9: yeni saç stilleri
  ['sac_topuz',tt("Topuz"),'sac','topuz',null],
  ['sac_atkuyruk',tt("At kuyruğu"),'sac','atkuyruk',null],
  ['sac_orgu',tt("Örgü"),'sac','orgu',null],
  ['sac_dalgali',tt("Uzun dalgalı"),'sac','dalgali',null],
  ['ust_tisort',tt("Tişört"),'kiyafet','tisort','k2_top_tisort'],
  ['ust_ceket',tt("Ceket"),'kiyafet','ceket','k2_top_ceket'],
  ['ust_gelinlik',tt("Gelinlik"),'kiyafet','gelinlik',null],
  ['bas_kep',tt("Kep"),'bas','kep','k2_hat_kep'],
  ['bas_bere',tt("Bere"),'bas','bere','k2_hat_bere'],
  ['bas_tac',tt("Taç"),'bas','tac','k2_hat_tac'],
  ['bas_duvak',tt("Duvak"),'bas','duvak',null],
  ['ust_atlet',tt("Atlet"),'kiyafet','atlet',null],
  ['ust_gomlek',tt("Gömlek"),'kiyafet','gomlek',null],
  ['goz_gunes',tt("Güneş gözlüğü"),'gozluk','gunes','k2_glasses_gunes'],
  ['goz_kare',tt("Kare gözlük"),'gozluk','kare',null],
  ['goz_yuvarlak',tt("Yuvarlak gözlük"),'gozluk','yuvarlak',null],
  ['goz_okuma',tt("Okuma gözlüğü"),'gozluk','okuma',null],
  ['goz_spor',tt("Spor gözlük"),'gozluk','spor',null],
  ['sirt_pelerin',tt("Pelerin"),'pelerin','klasik','k2_top_pelerin'],
  // Not: `pelerin: 'kisa'` modelde var ama dükkâna KONMADI — pelerin
  // etkinlik ödülüdür, varyantını satmak ödülü değersizleştirir.
  ['sakal_tam',tt("Tam sakal"),'sakal','tam',null],
  ['sakal_keci',tt("Keçi sakalı"),'sakal','keci',null],
  ['sakal_biyik',tt("Bıyık"),'sakal','biyik',null],
  ['sakal_favori',tt("Favori"),'sakal','favori',null],
  ['ayak_spor',tt("Spor ayakkabı"),'ayakkabi','spor',null],
  ['ayak_bot',tt("Bot"),'ayakkabi','bot',null],
  ['ayak_terlik',tt("Terlik"),'ayakkabi','terlik',null],
  ['ayak_sandalet',tt("Sandalet"),'ayakkabi','sandalet',null],
  ['alt_pantolon',tt("Pantolon"),'alt','pantolon',null],
  ['alt_sort',tt("Şort"),'alt','sort',null],
  ['alt_kapri',tt("Kapri"),'alt','kapri',null],
  ['alt_etek',tt("Etek"),'alt','etek',null],
  // ---- Paket 7: yeni üstler, kostümler, ayakkabılar, takılar ----
  ['ust_havai',tt("Havai gömleği"),'kiyafet','havai',null],
  ['ust_cizgili',tt("Çizgili tişört"),'kiyafet','cizgili',null],
  ['ust_oduncu',tt("Oduncu gömleği"),'kiyafet','oduncu',null],
  ['ust_polo',tt("Polo tişört"),'kiyafet','polo',null],
  ['ust_kapusonlu',tt("Kapüşonlu sweatshirt"),'kiyafet','kapusonlu',null],
  ['ust_kot',tt("Kot gömlek"),'kiyafet','kot',null],
  ['ust_tisort_mavi',tt("Mavi tişört"),'kiyafet','tisort_mavi',null],
  ['ust_tisort_sari',tt("Sarı tişört"),'kiyafet','tisort_sari',null],
  ['ust_seytan',tt("Şeytan kostümü"),'kiyafet','seytan',null],
  ['ust_damatlik',tt("Damatlık"),'kiyafet','damatlik',null],
  // Paket 9: kolsuz / göbeği açık üstler
  ['ust_askili',tt("Askılı bluz"),'kiyafet','askili',null],
  ['ust_straplez',tt("Straplez"),'kiyafet','straplez',null],
  ['ust_crop',tt("Crop tişört"),'kiyafet','crop',null],
  ['bas_boynuz',tt("Şeytan boynuzu"),'bas','boynuz',null],
  ['ayak_tokyo',tt("Tokyo terlik"),'ayakkabi','tokyo',null],
  ['ayak_topuklu',tt("Topuklu ayakkabı"),'ayakkabi','topuklu',null],
  ['kolye_altin',tt("Altın kolye"),'kolye','altin',null],
  ['kolye_gumus',tt("Gümüş kolye"),'kolye','gumus',null],
  ['saat_altin',tt("Altın saat"),'saat','altin',null],
  ['saat_gumus',tt("Gümüş saat"),'saat','gumus',null],
  ['kupe_altin',tt("Altın küpe"),'kupe','altin',null],
  ['kupe_gumus',tt("Gümüş küpe"),'kupe','gumus',null],
].map(([id,ad,yuva,deger,eskiKod])=>({id,ad,yuva,deger,eskiKod}));
export const YUVA_ADLARI={sac:tt("Saç"),kiyafet:tt("Üst giyim"),alt:tt("Alt giyim"),ayakkabi:tt("Ayakkabı"),bas:tt("Baş aksesuarı"),gozluk:tt("Gözlük"),kupe:tt("Küpe"),kolye:tt("Kolye"),saat:tt("Saat"),sakal:tt("Sakal"),pelerin:tt("Sırt")};
// Boş değer = o yuvanın ücretsiz/varsayılan hâli. `kiyafet`, `alt` ve
// `ayakkabi` çıplak bırakılamaz; bu yüzden boşları temel parçadır.
export const BOSLAR={sac:'yok',kiyafet:'tisort',alt:'pantolon',ayakkabi:'spor',bas:'yok',gozluk:'yok',sakal:'yok',pelerin:'yok',kolye:'yok',saat:'yok',kupe:'yok'};
export const TEMEL=ayarDogrula({...BOSLAR,ceket:false});
export function sahiplikDogrula(g,sahip){
  const temiz=ayarDogrula(g);
  for(const p of PARCALAR){
    // Yuvanın varsayılan değeri (tişört, pantolon, spor ayakkabı) herkeste
    // vardır — sahiplik aranmaz, yoksa yeni oyuncu giyinemez.
    if(BOSLAR[p.yuva]===p.deger) continue;
    if(temiz[p.yuva]===p.deger&&!sahip.includes(p.id)) throw new Error(p.ad+tt(" envanterinde yok."));
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
