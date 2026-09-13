// ============================================================
// YEREL DENEME KAPISI
//
// Gardırop ARTIK GERÇEK EKONOMİDE çalışıyor: giriş yapmış oyuncu
// `envanter-sunucu.js` yolunu kullanır (avatar3d_* RPC'leri, gerçek coin).
// Yerel deneme cüzdanı (`envanter-yerel.js`, localStorage + sahte coin)
// yalnız `localhost`ta, oturumsuz geliştirme için kalır.
//
// `onizlemeMi` ARTIK KAPI DEĞİL: eskiden `VITE_AVATAR3D_DEMO=1` yoksa
// gardırop "önizleme henüz açık değil" deyip kapanıyordu. O bayrak
// kaldırılmadı ama kod ona bağımlı değil — tanımlı olsa da olmasa da
// gardırop açılır.
// ============================================================
import { ayarDogrula, VARSAYILAN } from './model.js';

const ANAHTAR='quizsquare_avatar3d_prototip_v1';

export const yerelMi=()=>typeof location!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);

/** Deneme cüzdanı kullanılabilir mi (yalnız yerel geliştirme). */
export const denemeCuzdaniMi=()=>yerelMi()||import.meta.env.VITE_AVATAR3D_DEMO==='1';

/**
 * Geriye uyumluluk: Vitrin.jsx bunu "yerel deneme var mı" diye soruyor.
 * Artık kapı görevi yok, yalnız deneme cüzdanının açık olduğunu söyler.
 */
export const onizlemeMi=denemeCuzdaniMi;

export function yerelOku(){try{return ayarDogrula(JSON.parse(localStorage.getItem(ANAHTAR))||VARSAYILAN);}catch{return {...VARSAYILAN};}}
export function yerelKaydet(g){localStorage.setItem(ANAHTAR,JSON.stringify(ayarDogrula(g)));window.dispatchEvent(new Event('qs-avatar3d'));}
