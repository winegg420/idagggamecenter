import {katalogEsle,sahiplikDogrula,TEMEL} from './envanter.js';
import {ayarDogrula} from './model.js';
// Bağımlılık dışarıdan verilir. Yerel deneme Supabase'i yüklemez veya çağırmaz.
// avatar3d_* RPC'leri taslak SQL uygulanmadan kullanılmamalıdır.
export function sunucuServisi(supabase){
  async function rpc(ad,args){try{const {data,error}=await supabase.rpc(ad,args);if(error)throw error;return Array.isArray(data)?data[0]:data;}catch(e){throw new Error(e.message||'Sunucuya ulaşılamadı.');}}
  async function yukle(){
    const s=await rpc('avatar3d_katalogum');if(!s)throw new Error('Envanter alınamadı.');
    const bakiye=Number(s.bakiye);if(s.bakiye==null||!Number.isSafeInteger(bakiye)||bakiye<0)throw new Error('Geçersiz sunucu bakiyesi.');
    const katalog=katalogEsle(s);
    // `kurulmus`: oyuncu daha önce karakterini kaydetti mi. Yeni oyuncuda
    // görünüm TEMEL'e eşit olur ve "değişiklik yok" sanılıp Kaydet düğmesi
    // kapalı kalırdı — o zaman karakter hiç kurulamıyordu.
    // `bedavaTest`: test dönemi anahtarı (oyun_ayarlari.kozmetik_bedava_test).
    // Sunucunun sözü; arayüz buna bakarak "Ücretsiz" yazar. Kararı yine
    // sunucu veriyor, bu alan yalnız görüntü içindir.
    return {katalog,bakiye,sahip:katalog.filter(p=>p.sahip).map(p=>p.id),
      gorunum:ayarDogrula(s.avatar3d_gorunum||TEMEL),kurulmus:s.avatar3d_gorunum!=null,
      bedavaTest:s.bedava_test===true};
  }
  return {yukle,
    async satinAl(id){await rpc('avatar3d_satin_al',{p_id:id});return yukle();},
    async kaydet(g){const s=await yukle();await rpc('avatar3d_gorunum_kaydet',{p_gorunum:sahiplikDogrula(g,s.sahip)});return yukle();},
    // Ödül dağıtımı oyuncunun tarayıcısından çağrılamaz; sunucu kararıdır.
  };
}
