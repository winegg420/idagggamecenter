import * as T from 'three';
import {modelKur,modelYokEt,ayarDogrula} from './model.js';
import {KOLEKSIYON} from './koleksiyon.js';
// Önbellek sınırı 64 > 160: gardıroptaki 12 parça, oyuncu ten/saç rengini
// değiştirdikçe yeniden üretiliyor; 64 girişte aynı resimler sürekli düşüyordu.
const ONBELLEK_SINIRI=160;
const kayitlar=new Map();let render;

/** Tek paylaşılan renderer — parça portreleri de bunu kullanır, ikinci
 *  WebGL bağlamı açılmaz (tarayıcı bağlam sınırı genelde 16). */
function makine(){
 if(!render){render=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});render.setSize(256,256);render.setPixelRatio(1);render.outputColorSpace=T.SRGBColorSpace;}
 return render;
}

/** LRU: dokunulan sona gider, taşarsa en eskisi düşer. */
function onbellegeYaz(key,uri){
 kayitlar.set(key,uri);
 while(kayitlar.size>ONBELLEK_SINIRI)kayitlar.delete(kayitlar.keys().next().value);
 return uri;
}

export function yeniPortre(g={}){
 const ad=g?.karakter||'deniz';let hash=0;for(const c of ad)hash=(hash*31+c.charCodeAt(0))>>>0;
 const ayar=ayarDogrula(g?.avatar3d||{...KOLEKSIYON[hash%KOLEKSIYON.length].kimlik,kiyafet:'tisort'});
 const key=JSON.stringify(ayar);if(kayitlar.has(key))return kayitlar.get(key);
 let model;
 try{
  const r=makine();r.setSize(256,256,false);
  const sahne=new T.Scene(),kamera=new T.PerspectiveCamera(35,1,.1,40);
  kamera.position.set(0,2.5,8);kamera.lookAt(0,2,0);
  sahne.add(new T.HemisphereLight(0xffffff,0x57647b,2.3));const isik=new T.DirectionalLight(0xffead0,3);isik.position.set(3,6,5);sahne.add(isik);
  model=modelKur(ayar);sahne.add(model);r.render(sahne,kamera);
  return onbellegeYaz(key,r.domElement.toDataURL('image/png'));
 }catch{return null;}finally{if(model)modelYokEt(model);}
}

// ============================================================
// PARÇA PORTRESİ — gardırop kartlarındaki küçük resim
//
// Kart, parçanın OYUNCUNUN KENDİ karakteri üstünde nasıl durduğunu gösterir:
// o anki görünüm alınır, yalnız ilgili yuva o parçayla değiştirilir.
//
// Aynı kamera her parçaya uymaz — kepi tam boy çekersen nokta kadar kalır.
// Çerçeveler TEK yerde dursun ki ileride ayarlamak kolay olsun.
// Ölçüldü (model.js gövdesi): ayak 0.04, gövde 1.95, kafa kutusu 2.53-3.96.
// ============================================================
export const CERCEVE={
 bas:   {fov:24,konum:[0,3.35,4.30],bak:[0,3.20,0]},   // yüz + baş üstü
 govde: {fov:26,konum:[0,2.40,5.20],bak:[0,2.10,0]},   // omuz-bel arası
 tamboy:{fov:30,konum:[0,2.60,9.20],bak:[0,2.00,0]},
 sirt:  {fov:30,konum:[0,2.70,-9.20],bak:[0,2.00,0]},  // hafif geriden: sırt görünsün
};
// Kart görselleri için çerçeveler (eşya tek başına / manken üstünde).
// Kamera değerleri TEK YERDE dursun ki ileride ayarlamak kolay olsun.
CERCEVE.esya_bas     = { fov: 26, konum: [0, 3.80, 2.70], bak: [0, 3.66, 0] };
CERCEVE.esya_gozluk  = { fov: 22, konum: [0, 3.24, 2.10], bak: [0, 3.22, 0] };
CERCEVE.esya_pelerin = { fov: 28, konum: [0, 2.35, -3.60], bak: [0, 2.20, 0] };
CERCEVE.manken_sac   = { fov: 24, konum: [0, 3.30, 3.90], bak: [0, 3.18, 0] };
CERCEVE.manken_kiyafet = { fov: 26, konum: [0, 2.05, 4.60], bak: [0, 1.95, 0] };
// Aşağıdaki üç çerçeve modelden ÖLÇÜLEN kutu merkezlerine göre yazıldı:
// sakal y≈2.77, alt giyim y≈1.16, ayakkabı y≈0.23.
CERCEVE.manken_sakal    = { fov: 24, konum: [0, 2.86, 3.10], bak: [0, 2.82, 0] };
CERCEVE.manken_alt      = { fov: 26, konum: [0, 1.25, 4.00], bak: [0, 1.16, 0] };
CERCEVE.manken_ayakkabi = { fov: 26, konum: [0, .62, 2.50], bak: [0, .23, 0] };
// Takılar (Paket 7) — modelden hesaplanan konumlar: kolye göğüs y≈2.45,
// saat sol el bileği (-.54, 1.58), küpeler kulak altı y≈2.95, x ±.6.
CERCEVE.manken_kolye = { fov: 24, konum: [0, 2.62, 2.70], bak: [0, 2.45, 0] };
CERCEVE.manken_saat  = { fov: 22, konum: [.10, 1.90, 1.90], bak: [-.54, 1.56, 0] };
CERCEVE.manken_kupe  = { fov: 30, konum: [0, 3.05, 2.60], bak: [0, 3.00, 0] };

const YUVA_CERCEVE={sac:'bas',bas:'bas',gozluk:'bas',sakal:'bas',kiyafet:'govde',
 alt:'tamboy',ayakkabi:'tamboy',pelerin:'sirt',kolye:'govde',saat:'govde',kupe:'bas'};

/**
 * @param {object} temelGorunum oyuncunun o anki görünümü (ten/saç rengi dahil)
 * @param {object} parca        envanter.js parçası: {yuva, deger}
 * @param {number} [boyut=192]  kare kenarı (px)
 * @returns {string|null} PNG data URI, üretilemezse null
 */
export function parcaPortresi(temelGorunum,parca,boyut=192){
 const yuva=parca?.yuva;if(!yuva)return null;
 const ayar=ayarDogrula({...(temelGorunum||{}),[yuva]:parca.deger});
 const cerceveAdi=YUVA_CERCEVE[yuva]||'tamboy';
 const key=JSON.stringify(ayar)+'|'+cerceveAdi+'|'+boyut;
 if(kayitlar.has(key)){const v=kayitlar.get(key);kayitlar.delete(key);kayitlar.set(key,v);return v;}
 let model;
 try{
  const r=makine();r.setSize(boyut,boyut,false);
  const c=CERCEVE[cerceveAdi];
  const sahne=new T.Scene(),kamera=new T.PerspectiveCamera(c.fov,1,.1,40);
  kamera.position.set(...c.konum);kamera.lookAt(...c.bak);
  sahne.add(new T.HemisphereLight(0xffffff,0x57647b,2.3));const isik=new T.DirectionalLight(0xffead0,3);isik.position.set(3,6,5);sahne.add(isik);
  model=modelKur(ayar);sahne.add(model);r.render(sahne,kamera);
  return onbellegeYaz(key,r.domElement.toDataURL('image/png'));
 }catch(e){console.error('[Portre] parca portresi uretilemedi:',parca?.deger,e);return null;}
 // Model her render sonrası atılır: sahnede avatar birikmesin.
 finally{if(model)modelYokEt(model);}
}


// ============================================================
// EŞYA PORTRESİ — kartta EŞYANIN KENDİSİ görünür
//
// Sahibinin isteği: "Sadece ekipmanın kendisi çıplak bir şekilde
// gözükecek." Kartlar eskiden parçayı karakterin üstünde gösteriyordu;
// artık:
//
//   bas / gozluk / pelerin  → YALNIZ eşya, karakter yok
//   sac / kiyafet           → yüzsüz GRİ MANKEN üzerinde
//
// Gerekçe (sahibinin): saç ve kıyafet tek başına anlaşılmıyor (havada
// duran saç, düz tişört); aksesuarlar tek başına net.
//
// Aynı paylaşılan renderer kullanılır, ikinci WebGL bağlamı açılmaz.
// ============================================================

/** Bu yuva için manken gerekiyor mu? */
// Sakal/alt/ayakkabı tek başına havada duruyor gibi görünür; gri manken
// üzerinde gösterilir (saç ve kıyafetle aynı gerekçe).
const MANKEN_GEREKEN = { sac: true, kiyafet: true, sakal: true, alt: true, ayakkabi: true,
                         kolye: true, saat: true, kupe: true };

/** Kartta hangi çerçeve kullanılacak. */
const ESYA_CERCEVE = {
  bas:      'esya_bas',
  gozluk:   'esya_gozluk',
  pelerin:  'esya_pelerin',
  sac:      'manken_sac',
  kiyafet:  'manken_kiyafet',
  sakal:    'manken_sakal',
  alt:      'manken_alt',
  ayakkabi: 'manken_ayakkabi',
  kolye:    'manken_kolye',
  saat:     'manken_saat',
  kupe:     'manken_kupe',
};

/** Yüz detayı mesh adları (saç/sakal/küpe kartında yüzsüz manken için). */
const YUZ_DETAYI = /Goz|Iris|Bebek|Kas|Kapak|Kulak|Burun|Gulumseme|Agiz|Dudak|Kirpik/i;

/** Alt ağaçtaki bütün mesh'leri gizler. */
function gizle(kok) {
  if (!kok) return;
  kok.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.visible = false; });
}

/**
 * Alt ağaçtaki mesh'leri MODELİN KENDİ KARARINA göre geri açar.
 *
 * Zorla açmak hataya yol açıyordu: tişört seçiliyken ceket parçaları da
 * görünüyor, "Tişört" kartında ceket çıkıyordu. Model kurulurken hangi
 * parçanın görüneceğine zaten karar veriyor (`ceketParcalari` tişörtte
 * visible=false); o karar `ilkDurum`da saklanıp burada geri yükleniyor.
 */
function geriAc(kok, ilkDurum) {
  if (!kok) return;
  kok.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) o.visible = ilkDurum.get(o) === true;
  });
}

/**
 * Ten renkli mesh'leri düz griye çevirir (yüzsüz manken hissi).
 * Malzeme KLONLANIR; paylaşılan malzemeye dokunulmaz. Klonlar
 * `atilacak` listesine konur ve render sonrası dispose edilir.
 */
function mankenlestir(model, tenRenk, atilacak) {
  const ten = new T.Color(tenRenk);
  // Koyu gri: acik renkli kiyafet (beyaz tisort) mankenle karismasin.
  const gri = new T.Color('#6f747c');
  model.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.material || !o.material.color) return;
    if (!o.material.color.equals(ten)) return;
    const m = o.material.clone();
    m.color.copy(gri);
    o.material = m;
    atilacak.push(m);
  });
}

/**
 * Kart görseli: eşyanın kendisi (gerekirse manken üzerinde).
 *
 * @param {object} temelGorunum oyuncunun o anki görünümü (renkler buradan)
 * @param {object} parca        envanter.js parçası: {yuva, deger}
 * @param {number} [boyut=192]  kare kenarı (px)
 * @returns {string|null} PNG data URI
 */
export function esyaPortresi(temelGorunum, parca, boyut = 192) {
  const yuva = parca?.yuva;
  if (!yuva) return null;
  const manken = Boolean(MANKEN_GEREKEN[yuva]);
  const cerceveAdi = ESYA_CERCEVE[yuva] || 'tamboy';
  const c = CERCEVE[cerceveAdi];
  if (!c) return null;

  // Eşya kendi rengiyle çizilsin diye görünüm renkleri korunur; yuva
  // değeri parçanın kendisi olur.
  // Kolye ve saat kartı TİŞÖRT üstünde çizilir: ceket/uzun kol takılıyken
  // saat kordonu kol kabuğuna göre büyür, kolye ceketin altında kalır.
  const takiKarti = yuva === 'kolye' || yuva === 'saat';
  const ayar = ayarDogrula({ ...(temelGorunum || {}), ...(takiKarti ? { kiyafet: 'tisort', ceket: false } : {}), [yuva]: parca.deger });
  // Önbellek anahtarında YUVA ve MANKEN bayrağı da var: aynı görünüm
  // farklı yuvalar için farklı kart üretir.
  const key = 'esya|' + yuva + '|' + (manken ? 'm' : 'y') + '|'
            + JSON.stringify(ayar) + '|' + boyut;
  if (kayitlar.has(key)) { const v = kayitlar.get(key); kayitlar.delete(key); kayitlar.set(key, v); return v; }

  let model = null;
  const atilacak = [];
  try {
    const r = makine();
    r.setSize(boyut, boyut, false);
    const sahne = new T.Scene();
    const kamera = new T.PerspectiveCamera(c.fov, 1, .1, 40);
    kamera.position.set(...c.konum);
    kamera.lookAt(...c.bak);
    sahne.add(new T.HemisphereLight(0xffffff, 0x57647b, 2.3));
    const isik = new T.DirectionalLight(0xffead0, 3);
    isik.position.set(3, 6, 5);
    sahne.add(isik);

    model = modelKur(ayar);
    const u = model.userData;

    // Modelin kendi görünürlük kararını sakla (hangi kıyafet parçası açık).
    const ilkDurum = new Map();
    model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) ilkDurum.set(o, o.visible);
    });

    // Önce HER ŞEYİ gizle, sonra yalnız gerekeni geri aç.
    gizle(model);

    // Bazı yuvalar tek bir grup, bazıları mesh dizisidir (alt/ayakkabı).
    const yuvaKok = { sac: u.sacYuva, gozluk: u.gozlukYuva, bas: u.basYuva,
                      kiyafet: u.elbiseYuva, pelerin: u.capeRoot,
                      sakal: u.sakalYuva, alt: u.altParcalari,
                      ayakkabi: u.ayakkabiParcalari, kolye: u.kolyeYuva,
                      saat: u.saatYuva, kupe: u.kupeYuva }[yuva];
    for (const kok of [].concat(yuvaKok || [])) geriAc(kok, ilkDurum);

    if (yuva === 'kiyafet') {
      // Kıyafet üç yere dağılmış: etek (elbiseYuva), üst (elbiseUst) ve
      // ceket parçaları. Hangisinin görüneceğine model karar verdi.
      geriAc(u.elbiseUst, ilkDurum);
      for (const parcasi of u.ceketParcalari || []) geriAc(parcasi, ilkDurum);
      // Manken gövde + kollar; kafa KAPALI kalır (yüzsüz).
      geriAc(u.govde, ilkDurum);
      gizle(u.kafa);
      // Takılar gövde/kol ağacında ama kıyafet kartına ait değil.
      gizle(u.kolyeYuva); gizle(u.saatYuva);
      // Kostüm bacakları/kuyruğu bel ağacında: kıyafetin parçası, açılır.
      for (const p of u.kiyafetParcalari || []) geriAc(p, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'kolye') {
      // Yüzsüz büst: boyun + gövde kabuğu gri, zincir üstünde.
      u.govde.traverse((o) => { if ((o.isMesh) && (o.name === 'Boyun' || o.name === 'Tisort')) o.visible = true; });
      u.govde.traverse((o) => {
        if (o.isMesh && o.name === 'Tisort') { const m = o.material.clone(); m.color.set('#6f747c'); o.material = m; atilacak.push(m); }
      });
      geriAc(u.kolyeYuva, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'saat') {
      // Gri kol ve el; saat kordonu bileğin üstünde.
      u.kollar.traverse((o) => { if (o.isMesh && o.material?.color?.equals(new T.Color(ayar.ten))) o.visible = true; });
      geriAc(u.saatYuva, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'kupe') {
      // Gri kafa, yüz detayları kapalı; saç/şapka/gözlük/sakal kapalı.
      geriAc(u.kafa, ilkDurum);
      u.kafa.traverse((o) => { if (o.isMesh && YUZ_DETAYI.test(o.name || '') && !/Kulak$/.test(o.name || '')) o.visible = false; });
      for (const k of [u.sacYuva, u.basYuva, u.gozlukYuva, u.sakalYuva]) gizle(k);
      geriAc(u.kupeYuva, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'sac') {
      // Saç kafanın üstünde durur; kafa gri manken olarak açılır ama
      // YÜZ DETAYLARI kapalı kalır. Ad listesi modelden ölçüldü:
      // Goz, Iris, GozBebegi, GozIsigi, Kas, UstGozKapagi, Burun, Gulumseme,
      // Kulak, KulakIci. ("Gulumseme" = ağız; ilk denemede kaçmıştı.)
      geriAc(u.kafa, ilkDurum);
      u.kafa.traverse((o) => {
        if (!(o.isMesh || o.isSkinnedMesh)) return;
        if (/Goz|Iris|Bebek|Kas|Kapak|Kulak|Burun|Gulumseme|Agiz|Dudak|Kirpik/i.test(o.name || '')) {
          o.visible = false;
        }
      });
      geriAc(u.sacYuva, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'sakal') {
      // Sakal çenede durur: kafa gri manken olarak açılır, yüz detayları
      // kapalı (saçla aynı gerekçe), sakal üstte kalır.
      geriAc(u.kafa, ilkDurum);
      u.kafa.traverse((o) => {
        if (!(o.isMesh || o.isSkinnedMesh)) return;
        if (/Goz|Iris|Bebek|Kas|Kapak|Kulak|Burun|Gulumseme|Agiz|Dudak|Kirpik/i.test(o.name || '')) {
          o.visible = false;
        }
      });
      geriAc(u.sakalYuva, ilkDurum);
      mankenlestir(model, ayar.ten, atilacak);
    } else if (yuva === 'alt' || yuva === 'ayakkabi') {
      // Bacaklar gri manken olarak açılır ki pantolon/ayakkabı boşlukta
      // durmasın. Diğer yuvanın parçaları kapalı kalır.
      // `bacaklar` tek bir T.Group (dizi DEĞİL) — bütün bacak ağacı burada.
      geriAc(u.bacaklar, ilkDurum);
      for (const p of (yuva === 'alt' ? u.ayakkabiParcalari : u.altParcalari) || []) gizle(p);
      for (const p of (yuva === 'alt' ? u.altParcalari : u.ayakkabiParcalari) || []) geriAc(p, ilkDurum);
      // Kostüm bacakları (şeytan/damatlık) alt giyimi örter: kartta gizlenir.
      for (const p of u.kostumBacakParcalari || []) gizle(p);
      mankenlestir(model, ayar.ten, atilacak);
    }

    sahne.add(model);
    r.render(sahne, kamera);
    return onbellegeYaz(key, r.domElement.toDataURL('image/png'));
  } catch (e) {
    console.error('[Portre] esya portresi uretilemedi:', parca?.deger, e);
    return null;
  } finally {
    for (const m of atilacak) { try { m.dispose(); } catch { /* yut */ } }
    if (model) modelYokEt(model);
  }
}

/** Sayfadan çıkarken WebGL bağlamı bırakılsın. */
export function portreMakinesiniKapat(){
 try{render?.dispose();render?.forceContextLoss?.();}catch(e){console.error('[Portre] kapatilamadi:',e);}
 render=null;kayitlar.clear();
}
