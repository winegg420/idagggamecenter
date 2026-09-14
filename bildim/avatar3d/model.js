import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ortak ölçü sözleşmesi: bütün ekipmanlar bu iskelete göre üretilir.
// Bu prototip tek insan gövdesidir; mevcut hayvanlara uyum iddiası yoktur.
export const VARSAYILAN = { ten: '#c58b62', sac: 'kisa', sacRenk: '#30211c',
  gozluk: 'yok', ceket: true, pelerin: 'yok', ceketRenk: '#be542d', yuz: 'dengeli',
  bas: 'yok', kiyafet: 'ceket', sakal: 'yok', ayakkabi: 'spor', alt: 'pantolon',
  ayakkabiRenk: '#eee7d8', altRenk: '#253341', kolye: 'yok', saat: 'yok', kupe: 'yok' };

// ---- yuva değer listeleri — TEK YER ----
// ayarDogrula, katalog ve kart görselleri hepsi buna bakar.
export const YUVA_DEGERLERI = {
  // Paket 9: topuz, at kuyruğu, örgü, uzun dalgalı.
  sac:      ['yok', 'kisa', 'uzun', 'rasta', 'topuz', 'atkuyruk', 'orgu', 'dalgali'],
  bas:      ['yok', 'kep', 'bere', 'tac', 'duvak', 'boynuz'],
  // Paket 7: renkli/desenli üstler + iki kostüm (şeytan, damatlık).
  kiyafet:  ['ceket', 'tisort', 'gelinlik', 'atlet', 'gomlek',
             'havai', 'cizgili', 'oduncu', 'polo', 'kapusonlu', 'kot',
             'tisort_mavi', 'tisort_sari', 'seytan', 'damatlik',
             // Paket 9: askılı bluz, straplez, göbeği açık (crop).
             'askili', 'straplez', 'crop'],
  // GÖZLÜK ve PELERİN ESKİDEN BOOLEAN'DI (`g.gozluk === true`). Çeşit
  // desteklemek için metne çevrildi; eski `true` değeri ayarDogrula'da
  // 'gunes' / 'klasik' karşılığına taşınır — kayıtlı görünümler bozulmaz.
  gozluk:   ['yok', 'gunes', 'kare', 'yuvarlak', 'okuma', 'spor'],
  pelerin:  ['yok', 'klasik', 'kisa'],
  sakal:    ['yok', 'tam', 'keci', 'biyik', 'favori'],
  ayakkabi: ['spor', 'terlik', 'bot', 'sandalet', 'tokyo', 'topuklu'],
  alt:      ['pantolon', 'sort', 'kapri', 'etek'],
  // Takılar üç AYRI yuva: kolye, saat ve küpe aynı anda takılabilsin.
  kolye:    ['yok', 'altin', 'gumus'],
  saat:     ['yok', 'altin', 'gumus'],
  kupe:     ['yok', 'altin', 'gumus'],
};

// ---- YENİ ÜST GİYİMLER — renk/desen PARÇAYA GÖMÜLÜ ----
// `ceketRenk` yalnız ceketindir; bu parçalar kendi rengini taşır ki
// "farklı renkler" dükkânda ayrı ürün olarak görünsün.
//   bicim : gövde kabuğunun profili (tisort / gomlek / kapusonlu)
//   kol   : 'kisa' | 'uzun' — kol kabukları
//   bacak : kostüm bacakları da örter (alt giyimin ÜSTÜNE geçer)
const YENI_USTLER = {
  havai:       { renk: '#1aa6b7', desen: 'havai',   tekrar: [3, 2],   kol: 'kisa', bicim: 'gomlek' },
  cizgili:     { renk: '#f6f3ea', desen: 'cizgili', tekrar: [1, 1.5], kol: 'kisa', bicim: 'tisort' },
  oduncu:      { renk: '#b3242b', desen: 'oduncu',  tekrar: [3, 2],   kol: 'uzun', bicim: 'gomlek' },
  polo:        { renk: '#2e8b57', kol: 'kisa', bicim: 'tisort' },
  kapusonlu:   { renk: '#6c5bb5', kol: 'uzun', bicim: 'kapusonlu' },
  kot:         { renk: '#3d6ea8', desen: 'kot',     tekrar: [4, 3],   kol: 'uzun', bicim: 'gomlek' },
  tisort_mavi: { renk: '#2f6fd0', kol: 'kisa', bicim: 'tisort' },
  tisort_sari: { renk: '#f2c230', kol: 'kisa', bicim: 'tisort' },
  seytan:      { renk: '#c0262d', kol: 'uzun', bicim: 'tisort', bacak: '#c0262d' },
  damatlik:    { renk: '#f7f5f0', kol: 'uzun', bicim: 'gomlek', bacak: '#1b1d24', kolRenk: '#1b1d24' },
  // Paket 9 — kol: 'yok' = kolsuz (omuz açık). bicim gövde kabuğunu seçer.
  askili:      { renk: '#e0527a', kol: 'yok',  bicim: 'askili' },
  straplez:    { renk: '#1f2a44', kol: 'yok',  bicim: 'straplez' },
  crop:        { renk: '#f08c3a', kol: 'kisa', bicim: 'crop' },
};

// ---- DESENLİ KUMAŞ DOKULARI ----
// Tuval (canvas) ile bir kez çizilir, modül ömrü boyunca önbellekte kalır:
// gardırop her kart için model kurar, doku her seferinde yeniden çizilmesin.
// Tuval olmayan ortamda (Node testi) null döner; parça düz renge düşer.
const dokuOnbellegi = new Map();
function tuvalAl() {
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas'); c.width = c.height = 256; return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(256, 256);
  } catch { /* dokusuz devam edilir */ }
  return null;
}
function desenCiz(ctx, desen) {
  const TAM = Math.PI * 2;
  // Deseni kenarlardan taşırıp karşı kenara da çizer: doku dikişsiz tekrarlar.
  const sar = (x, y, fn) => {
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      ctx.save(); ctx.translate(x + dx, y + dy); fn(); ctx.restore();
    }
  };
  if (desen === 'havai') {
    ctx.fillStyle = '#1aa6b7'; ctx.fillRect(0, 0, 256, 256);
    for (const [x, y, a] of [[30,40,.6],[150,22,2.2],[212,122,1.1],[88,150,2.8],[40,222,.3],[182,212,1.9],[120,92,.9]]) {
      sar(x, y, () => {
        ctx.rotate(a); ctx.fillStyle = '#1f7a4a';
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, TAM); ctx.fill();
        ctx.strokeStyle = '#8fd694'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke();
      });
    }
    for (const [x, y, renk] of [[70,60,'#ff4f7b'],[192,70,'#ffd23f'],[132,172,'#ff8a3d'],[30,140,'#ffd23f'],[222,200,'#ff4f7b'],[96,236,'#ffffff']]) {
      sar(x, y, () => {
        ctx.fillStyle = renk;
        for (let i = 0; i < 5; i++) { ctx.rotate(TAM / 5); ctx.beginPath(); ctx.ellipse(0, -13, 10, 15, 0, 0, TAM); ctx.fill(); }
        ctx.fillStyle = '#b3123f'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAM); ctx.fill();
        ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAM); ctx.fill();
      });
    }
  } else if (desen === 'cizgili') {
    ctx.fillStyle = '#f6f3ea'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#223a6b';
    for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 32, 256, 14);
  } else if (desen === 'oduncu') {
    ctx.fillStyle = '#b3242b'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(22,14,14,.62)';
    for (const p of [0, 128]) { ctx.fillRect(p, 0, 64, 256); ctx.fillRect(0, p, 256, 64); }
    ctx.fillStyle = 'rgba(22,14,14,.5)';
    for (const p of [98, 226]) { ctx.fillRect(p, 0, 5, 256); ctx.fillRect(0, p, 256, 5); }
  } else if (desen === 'kot') {
    ctx.fillStyle = '#3d6ea8'; ctx.fillRect(0, 0, 256, 256);
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += 8) {
      ctx.strokeStyle = i % 16 ? 'rgba(255,255,255,.10)' : 'rgba(10,20,40,.12)';
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
    }
  }
}
function kumasDokusu(desen, tekrar) {
  const anahtar = desen + '|' + tekrar.join('x');
  if (dokuOnbellegi.has(anahtar)) return dokuOnbellegi.get(anahtar);
  let doku = null;
  const tuval = tuvalAl(), ctx = tuval?.getContext?.('2d');
  if (ctx) {
    desenCiz(ctx, desen);
    doku = new T.CanvasTexture(tuval);
    doku.colorSpace = T.SRGBColorSpace;
    doku.wrapS = doku.wrapT = T.RepeatWrapping;
    doku.repeat.set(...tekrar);
    doku.anisotropy = 4;
  }
  dokuOnbellegi.set(anahtar, doku);
  return doku;
}
export const TENLER = ['#f3d6bc', '#e8b68e', '#c58b62', '#995f3c', '#70442f', '#422c25'];
export const SAC_RENKLERI = ['#30211c', '#141318', '#cba44d', '#9e4026', '#ddd2c3'];
export function ayarDogrula(g = {}) {
  const renk = (v, d) => /^#[\da-f]{6}$/i.test(v) ? v : d;
  const secim = (yuva, deger, varsayilan) =>
    YUVA_DEGERLERI[yuva].includes(deger) ? deger : varsayilan;

  // GERİYE UYUM: eski kayıtlarda gozluk/pelerin BOOLEAN'dı.
  //   true  → ilk çeşit ('gunes' / 'klasik')
  //   false → 'yok'
  // Böylece 14 Eylül öncesi kaydedilmiş görünümler aynen render edilir.
  const eskiBool = (deger, dogruKarsiligi) =>
    deger === true ? dogruKarsiligi : deger === false ? 'yok' : deger;

  const kiyafet = secim('kiyafet', g.kiyafet, g.ceket === false ? 'tisort' : 'ceket');
  return {
    ten: renk(g.ten, VARSAYILAN.ten),
    sac: secim('sac', g.sac, 'kisa'),
    sacRenk: renk(g.sacRenk, VARSAYILAN.sacRenk),
    ceketRenk: renk(g.ceketRenk, VARSAYILAN.ceketRenk),
    gozluk: secim('gozluk', eskiBool(g.gozluk, 'gunes'), 'yok'),
    // `ceket` TÜRETİLMİŞ alan; eski kod ve kayıtlar için duruyor.
    ceket: kiyafet === 'ceket',
    pelerin: secim('pelerin', eskiBool(g.pelerin, 'klasik'), 'yok'),
    kiyafet,
    yuz: ['dengeli','yumusak','koseli','ince'].includes(g.yuz) ? g.yuz : 'dengeli',
    bas: secim('bas', g.bas, 'yok'),
    // ---- Paket 5 ile gelen yuvalar ----
    sakal: secim('sakal', g.sakal, 'yok'),
    ayakkabi: secim('ayakkabi', g.ayakkabi, 'spor'),
    alt: secim('alt', g.alt, 'pantolon'),
    ayakkabiRenk: renk(g.ayakkabiRenk, VARSAYILAN.ayakkabiRenk),
    altRenk: renk(g.altRenk, VARSAYILAN.altRenk),
    // ---- Paket 7: takılar ----
    kolye: secim('kolye', g.kolye, 'yok'),
    saat: secim('saat', g.saat, 'yok'),
    kupe: secim('kupe', g.kupe, 'yok'),
  };
}

export function modelKur(girdi = VARSAYILAN) {
  const ayar = ayarDogrula(girdi), avatar = new T.Group();
  avatar.name = 'QuizSquare_Insan_Prototip';
  const geometriler = new Set(), malzemeler = new Set();
  const mal = (renk, roughness = .72, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color: renk, roughness, metalness }); malzemeler.add(m); return m;
  };
  const ton = (renk, carpan) => new T.Color(renk).multiplyScalar(carpan);
  const ten = mal(ayar.ten,.82), sac = mal(ayar.sacRenk, .78), pantolon = mal('#253341'), ayakkabi = mal('#eee7d8'), beyaz = mal('#fff7e9');
  const koyu = mal('#171b21'), iris = mal('#62462d', .3), ceketMal = mal(ayar.ceketRenk), metal = mal('#d6b778', .27, .72);
  const dikisMal=mal(ton(ayar.ceketRenk,.62)), sacIsik=mal(ton(ayar.sacRenk,1.35)), icTen=mal(ton(ayar.ten,.65));
  const ekle = (parent, geo, mat, pos = [0,0,0], scale = [1,1,1], name = '') => {
    geometriler.add(geo); const m = new T.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.name = name;
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const kureGeo = new T.SphereGeometry(1, 24, 16);
  const kure = (p, m, pos, scale, name) => ekle(p, kureGeo, m, pos, scale, name);
  const kapsul = (p, m, r, h, pos, name) => ekle(p, new T.CapsuleGeometry(r, h, 6, 14), m, pos, [1,1,1], name);
  const cizgiGeo = (noktalar,r=.008,bolum=16) => new T.TubeGeometry(new T.CatmullRomCurve3(noktalar.map(p=>new T.Vector3(...p))),bolum,r,5,false);
  // Bir malzemeye ait küçük çizgiler tek mesh'te birleşir: detay artarken
  // çizim çağrısı her dikiş / fermuar dişi için ayrı ayrı yükselmez.
  const birlestir = (parent,liste,mat,ad) => {const geo=mergeGeometries(liste);liste.forEach(g=>g.dispose());return ekle(parent,geo,mat,[0,0,0],[1,1,1],ad);};
  const govdeGeo = (noktalar,aralik=0) => {
    const geo=new T.LatheGeometry(noktalar.map(p=>new T.Vector2(...p)),40,aralik,Math.PI*2-aralik*2);
    geo.scale(1,1,.62);return geo;
  };
  const kemik = (ad, parent, pos) => { const b = new T.Bone(); b.name = ad; b.position.set(...pos); parent.add(b); return b; };
  const kok = kemik('Kok', avatar, [0,0,0]);
  const bel = kemik('Bel', kok, [0,1.32,0]);
  const govde = kemik('Govde', bel, [0,.63,0]);
  const kafa = kemik('Kafa', govde, [0,1.1,0]);
  const kollar = new T.Group(); govde.add(kollar);
  const bacaklar = new T.Group(); bel.add(bacaklar);
  const eklemler = [], ceketParcalari = [];
  // Alt giyim ve ayakkabı artık AYRI YUVA: mesh'leri burada toplanır
  // (ceketParcalari ile aynı desen). İki bacakta da parça olduğu için
  // tek bir Group yerine dizi tutulur; kemik hiyerarşisi bozulmaz.
  const altParcalari = [], ayakkabiParcalari = [];
  const altMal = mal(ayar.altRenk), aykMal = mal(ayar.ayakkabiRenk);
  // Yumuşak, stilize yüz: kafa ile tüm yüz parçaları birlikte döner.
  const yuzGeo=new T.SphereGeometry(1,40,28), yp=yuzGeo.attributes.position;
  for(let i=0;i<yp.count;i++){
    const x=yp.getX(i),y=yp.getY(i),z=yp.getZ(i);
    // Alt çene daralır; yanaklar üst yüzde kalır. Boyun, göz ve ekipman
    // bağlantı noktaları ilk prototiple aynı koordinatları korur.
    const daralma={dengeli:.3,yumusak:.19,koseli:.09,ince:.4}[ayar.yuz];
    const cene=y<-.12?1-Math.min(.26,(-y-.12)*daralma):1;
    const yanak=ayar.yuz==='yumusak'?1+Math.exp(-Math.pow((y+.18)*4,2))*.025:1;
    yp.setXYZ(i,x*.52*cene*yanak,y*.64+.12,z*.44*(y<-.5?.93:1));
  }
  yuzGeo.computeVertexNormals();ekle(kafa,yuzGeo,ten,[0,0,0],[1,1,1],'Yuz');
  kapsul(govde, ten, .16, .22, [0,.65,0], 'Boyun');
  // ---- ÜST GİYİM (tişört / atlet / gömlek) ----
  // Gövde kabuğu `kiyafet` yuvasına aittir. Atlet omuzları açar (daha dar
  // ve alçak yaka), gömlek biraz daha bol durur ve ön dikişi vardır.
  // YENİ ÜSTLER (Paket 7) kendi rengini/desenini taşır; parçaları
  // `kiyafetParcalari`nda toplanır, kostüm bacakları ayrıca
  // `kostumBacakParcalari`nda (kart görseli alt giyimde onları gizler).
  const ust = YENI_USTLER[ayar.kiyafet] || null;
  const kiyafetParcalari = [], kostumBacakParcalari = [];
  const kumasMal = (tanim, tekrar) => {
    const doku = tanim.desen ? kumasDokusu(tanim.desen, tekrar || tanim.tekrar) : null;
    const m = mal(doku ? '#ffffff' : tanim.renk, .78);
    if (doku) m.map = doku;
    return m;
  };
  const ustMal = ust ? kumasMal(ust) : beyaz;
  const ustKolMal = ust ? (ust.kolRenk ? mal(ust.kolRenk, .6) : kumasMal(ust, ust.desen ? [1.5, 1] : null)) : null;
  const kostumBacakMal = ust?.bacak ? mal(ust.bacak, ust.bacak === '#1b1d24' ? .55 : .6) : null;
  const ustDetayMal = ust ? mal(ton(ust.kolRenk || ust.renk, ayar.kiyafet === 'cizgili' ? .35 : .7)) : null;
  const gomlekBicimi = ayar.kiyafet === 'gomlek' || ust?.bicim === 'gomlek';
  // Paket 9: straplez/askılı gövdesi göğüs hizasında biter (omuz açık),
  // crop göbek üstünde biter. Açık kalan yeri aşağıda ten kabuğu doldurur.
  const acikOmuz = ust?.bicim === 'straplez' || ust?.bicim === 'askili';
  const ustProfil = acikOmuz
    ? [[.34,-.56],[.39,-.4],[.42,.1],[.41,.3],[.39,.34]]
    : ust?.bicim === 'crop'
      ? [[.4,-.22],[.43,.2],[.43,.43],[.2,.6]]
      : ayar.kiyafet === 'atlet'
    ? [[.33,-.56],[.38,-.4],[.40,.2],[.36,.33],[.14,.4]]
    : gomlekBicimi
      ? [[.37,-.6],[.42,-.4],[.45,.2],[.45,.46],[.21,.6]]
      : ust?.bicim === 'kapusonlu'
        ? [[.38,-.6],[.43,-.4],[.46,.2],[.46,.45],[.22,.6]]
        : [[.35,-.56],[.4,-.4],[.43,.2],[.43,.43],[.2,.6]];
  const ustGiyim = ekle(govde,govdeGeo(ustProfil),ustMal,[0,0,0],[1,1,1],'Tisort');
  if (ust) kiyafetParcalari.push(ustGiyim);
  if (acikOmuz) {
    // Omuz ve göğüs üstü ten; kumaşın üst kenarında ince bant.
    ekle(govde, govdeGeo([[.39,.33],[.40,.42],[.34,.52],[.18,.62]]), ten, [0,0,0], [1,1,1], 'AcikOmuz');
    const bant = ekle(govde, new T.TorusGeometry(.395, .02, 8, 40), mal(ton(ust.renk, .7)), [0,.335,0], [1,.62,1], 'UstBant');
    bant.rotation.x = Math.PI / 2; kiyafetParcalari.push(bant);
    if (ust.bicim === 'askili') {
      // İnce askılar: göğüsten omuz üstüne, sırta iner.
      for (const s of [-1, 1]) {
        kiyafetParcalari.push(ekle(govde, cizgiGeo([[s*.2,.33,.24],[s*.24,.5,.17],[s*.25,.56,-.02],[s*.2,.42,-.22]], .018), ustMal, [0,0,0], [1,1,1], 'Aski'));
      }
    }
  } else if (ust?.bicim === 'crop') {
    // Göbek açık: kısa kumaşın altı ten, küçük göbek çukuru.
    ekle(govde, govdeGeo([[.35,-.56],[.39,-.4],[.405,-.2]]), ten, [0,0,0], [1,1,1], 'AcikGobek');
    kure(govde, icTen, [0,-.38,.252], [.018,.026,.01], 'Gobek');
  }
  if (ayar.kiyafet === 'gomlek') {
    // Ön dikiş + iki düğme: gömleği tişörtten ayıran en ucuz iki detay.
    ekle(govde,cizgiGeo([[0,-.5,.28],[0,.1,.29],[0,.42,.24]],.012),dikisMal,[0,0,0],[1,1,1],'GomlekOnDikis');
    for(let i=0;i<2;i++) kure(govde,dikisMal,[0,-.16+i*.3,.3],[.032,.032,.016],'GomlekDugme');
  }
  if (ust) {
    const k = ayar.kiyafet;
    const yakaHalkasi = (r, kalinlik, y, m, ad) => {
      const h = ekle(govde, new T.TorusGeometry(r, kalinlik, 8, 32), m, [0, y, 0], [1, .64, 1], ad);
      h.rotation.x = Math.PI / 2; kiyafetParcalari.push(h); return h;
    };
    if (['havai', 'oduncu', 'kot'].includes(k)) {
      // Gömlek ailesi: ön pat + düğmeler. Havai yakası açık (V), diğerleri kapalı.
      const dugmeMal = k === 'havai' ? mal('#fff7e9', .4) : mal('#e9dcc0', .4);
      kiyafetParcalari.push(ekle(govde, cizgiGeo([[0,-.5,.282],[0,.1,.292],[0,k==='havai'?.36:.42,k==='havai'?.27:.24]],.014), ustDetayMal, [0,0,0], [1,1,1], 'GomlekPat'));
      for (let i = 0; i < (k === 'havai' ? 3 : 4); i++) kiyafetParcalari.push(kure(govde, dugmeMal, [0,-.34+i*.2,.298], [.026,.026,.013], 'GomlekDugme'));
      if (k === 'havai') {
        for (const s of [-1, 1]) {
          const yaka = kure(govde, ustMal, [s*.11,.5,.215], [.13,.045,.11], 'HavaiYaka');
          yaka.rotation.z = s * .75; yaka.rotation.x = -.35; kiyafetParcalari.push(yaka);
        }
      } else {
        yakaHalkasi(.215, .035, .59, ustDetayMal, 'GomlekYaka');
      }
      if (k === 'kot') {
        // İki göğüs cebi: kot gömleğin tanınan detayı.
        for (const s of [-1, 1]) kiyafetParcalari.push(ekle(govde, new T.BoxGeometry(.13,.12,.02), ustDetayMal, [s*.19,.24,.265], [1,1,1], 'KotCep'));
      }
    } else if (k === 'polo') {
      yakaHalkasi(.21, .04, .585, ustDetayMal, 'PoloYaka');
      kiyafetParcalari.push(ekle(govde, cizgiGeo([[0,.22,.275],[0,.42,.245]],.012), ustDetayMal, [0,0,0], [1,1,1], 'PoloPat'));
      for (let i = 0; i < 2; i++) kiyafetParcalari.push(kure(govde, mal('#fff7e9', .4), [0,.26+i*.1,.28], [.022,.022,.011], 'PoloDugme'));
    } else if (k === 'kapusonlu') {
      // Kapüşon ense arkasında omuzlara yaslanır; önde kanguru cebi + iki bağcık.
      kiyafetParcalari.push(kure(govde, ustMal, [0,.64,-.2], [.3,.2,.19], 'Kapuson'));
      yakaHalkasi(.2, .045, .6, ustDetayMal, 'KapusonAgzi');
      kiyafetParcalari.push(kure(govde, ustDetayMal, [0,-.28,.255], [.25,.12,.045], 'KanguruCep'));
      for (const s of [-1, 1]) kiyafetParcalari.push(ekle(govde, cizgiGeo([[s*.06,.56,.18],[s*.065,.42,.265],[s*.07,.28,.29]],.01), beyaz, [0,0,0], [1,1,1], 'KapusonBagcik'));
    } else if (k === 'seytan') {
      // Şeytan kostümü: kırmızı tulum + koyu yaka + kuyruk (kuyruğun ucu mızrak).
      yakaHalkasi(.205, .035, .59, ustDetayMal, 'SeytanYaka');
      const kuyrukYol = new T.CatmullRomCurve3([[0,-.02,-.22],[0,-.3,-.44],[.05,-.62,-.52],[.16,-.82,-.4]].map(p => new T.Vector3(...p)));
      kiyafetParcalari.push(ekle(bel, new T.TubeGeometry(kuyrukYol, 20, .032, 8, false), kostumBacakMal, [0,0,0], [1,1,1], 'SeytanKuyruk'));
      const uc = ekle(bel, new T.ConeGeometry(.085, .17, 4), kostumBacakMal, [.21,-.9,-.36], [1,1,.45], 'SeytanKuyrukUcu');
      uc.rotation.z = -Math.PI * .85; kiyafetParcalari.push(uc);
    } else if (k === 'damatlik') {
      // Damatlık: beyaz gömlek (gövde kabuğu) + önü V açık siyah smokin ceket,
      // saten yaka şeridi, papyon, bel düğmesi ve cep mendili.
      const siyah = mal('#1b1d24', .55), saten = mal('#0b0c10', .28);
      const ceketProfil = [[.39,-.6],[.455,-.5],[.475,-.35],[.48,.08],[.515,.36],[.475,.48],[.235,.61]];
      // V açıklığı: y -.05'in altında kapalı, yakaya doğru .55 radyana açılır.
      const aralik = y => y < -.05 ? .012 : .012 + Math.min(1, (y + .05) / .66) * .55;
      const segment = 40, geo = new T.LatheGeometry(ceketProfil.map(p => new T.Vector2(...p)), segment);
      const gp = geo.attributes.position, sira = ceketProfil.length;
      for (let i = 0; i <= segment; i++) for (let j = 0; j < sira; j++) {
        const [r, y] = ceketProfil[j], a = aralik(y), fi = a + (i / segment) * (Math.PI * 2 - a * 2);
        gp.setXYZ(i * sira + j, r * Math.sin(fi), y, r * Math.cos(fi));
      }
      geo.scale(1, 1, .62); geo.computeVertexNormals();
      const smokin = ekle(govde, geo, siyah, [0,0,0], [1,1,1], 'SmokinCeket');
      smokin.material.side = T.DoubleSide; kiyafetParcalari.push(smokin);
      const seritler = [];
      for (const s of [-1, 1]) {
        const kenar = ceketProfil.filter(([, y]) => y > -.4).map(([r, y]) => {
          const fi = s * aralik(y); return [r * 1.012 * Math.sin(fi), y, r * 1.012 * Math.cos(fi) * .62];
        });
        seritler.push(cizgiGeo(kenar, .028, 24));
      }
      kiyafetParcalari.push(birlestir(govde, seritler, saten, 'SmokinYaka'));
      for (let i = 0; i < 2; i++) kiyafetParcalari.push(kure(govde, siyah, [0,.18+i*.14,.286], [.02,.02,.01], 'GomlekDugme'));
      kiyafetParcalari.push(kure(govde, saten, [0,-.1,.305], [.03,.03,.014], 'SmokinDugme'));
      kiyafetParcalari.push(kure(govde, beyaz, [.27,.34,.285], [.055,.03,.02], 'CepMendili'));
      // Papyon: iki kanat (koni) + ortada düğüm.
      for (const s of [-1, 1]) {
        const kanat = ekle(govde, new T.ConeGeometry(.055, .12, 12), saten, [s*.07,.56,.19], [1,1,.5], 'Papyon');
        kanat.rotation.z = s * Math.PI / 2; kiyafetParcalari.push(kanat);
      }
      kiyafetParcalari.push(kure(govde, saten, [0,.56,.2], [.032,.032,.03], 'PapyonDugum'));
      yakaHalkasi(.2, .03, .6, beyaz, 'GomlekYaka');
    } else if (ust.kol !== 'yok') {
      // Tişört ailesi (çizgili, mavi, sarı, crop): koyu ton yaka ribanası.
      // Kolsuz (askılı/straplez) üstte yaka yok: boyun açık, halka havada kalırdı.
      yakaHalkasi(.2, .03, .585, ustDetayMal, 'TisortYaka');
    }
    if (ust.bacak) {
      // Kostüm kalçası alt giyimin kalçasından biraz büyük: onu tamamen örter.
      const kalca = kure(bel, kostumBacakMal, [0,.05,0], [.425,.265,.265], 'KostumKalca');
      kiyafetParcalari.push(kalca); kostumBacakParcalari.push(kalca);
    }
  }
  // Kalça artık ALT GİYİME ait (eskiden sabit pantolon rengindeydi).
  altParcalari.push(kure(bel, altMal, [0,.05,0], [.41,.25,.25], 'Kalca'));
  for (const s of [-1,1]) {
    kure(kafa, ten, [s*.51,.1,0], [.11,.18,.095], 'Kulak');
    kure(kafa, icTen, [s*.565,.11,.032], [.024,.09,.045], 'KulakIci');
    kure(kafa, beyaz, [s*.205,.2,.386], [.145,.105,.065], 'Goz');
    kure(kafa, iris, [s*.2,.202,.446], [.066,.077,.026], 'Iris');
    kure(kafa, koyu, [s*.198,.2,.467], [.032,.045,.012], 'GozBebegi');
    kure(kafa, beyaz, [s*.198-.014,.223,.48], [.016,.018,.007], 'GozIsigi');
    ekle(kafa,cizgiGeo([[s*.09,.355,.407],[s*.19,.386,.416],[s*.32,.355,.37]],.027),sac,[0,0,0],[1,1,1],'Kas');
    ekle(kafa,cizgiGeo([[s*.07,.22,.424],[s*.19,.299,.448],[s*.335,.22,.411]],.012),icTen,[0,0,0],[1,1,1],'UstGozKapagi');
    const kol = kemik(s < 0 ? 'SolOmuz' : 'SagOmuz', kollar, [s*.54,.46,0]);
    kapsul(kol, ten, .145, .36, [0,-.27,0], 'UstKol');
    const dirsek = kemik(s < 0 ? 'SolDirsek' : 'SagDirsek', kol, [0,-.53,0]);
    kapsul(dirsek, ten, .12, .32, [0,-.22,0], 'AltKol');
    kure(dirsek, ten, [0,-.51,.015], [.13,.18,.085], 'El');
    kure(dirsek, ten, [-s*.1,-.47,.06], [.055,.105,.055], 'Basparmak');
    for (let i=0;i<4;i++) kapsul(dirsek, ten, .026, .08-Math.abs(i-1.5)*.018, [-.082+i*.053,-.636+Math.abs(i-1.5)*.014,.026], 'Parmak');
    const bac = kemik(s < 0 ? 'SolKalca' : 'SagKalca', bacaklar, [s*.225,0,0]);
    const diz = kemik(s < 0 ? 'SolDiz' : 'SagDiz', bac, [0,-.51,0]);

    // ---- ALT GİYİM (pantolon / şort / kapri) ----
    // Eskiden pantolon GÖVDEYE GÖMÜLÜYDÜ: sabit renk, seçilemezdi. Artık
    // `alt` yuvasından okunur ve rengi `altRenk`ten gelir. Bacağın KENDİSİ
    // (ten) hep çizilir; alt giyim onun ÜSTÜNE geçen ayrı kabuktur, böylece
    // şortta baldır teni görünür. Geometri bozulmadı, yalnız hangi mesh'in
    // hangi yuvaya ait olduğu ayrıldı.
    kapsul(bac, ten, .186, .29, [0,-.24,0], 'UstBacak');
    kapsul(diz, ten, .152, .32, [0,-.24,0], 'AltBacak');
    // Etekte bacak başına kabuk yok: etek belde tek parça (aşağıda).
    if (ayar.alt !== 'etek') altParcalari.push(kapsul(bac, altMal, .196, .29, [0,-.24,0], 'AltUst'));
    if (ayar.alt === 'pantolon') {
      altParcalari.push(kapsul(diz, altMal, .162, .32, [0,-.24,0], 'AltPaca'));
    } else if (ayar.alt === 'kapri') {
      // Kapri: paça diz altında biter.
      altParcalari.push(kapsul(diz, altMal, .164, .16, [0,-.16,0], 'AltPaca'));
    }
    // Şortta paça yok; üst parça biraz daha uzun dursun.
    if (ayar.alt === 'sort') altParcalari[altParcalari.length-1].scale.set(1, 1.1, 1);

    // ---- AYAKKABI / TERLİK ----
    // O da gövdeye gömülüydü. Artık `ayakkabi` yuvasından, rengi
    // `ayakkabiRenk`ten. Her çeşit aynı ayak bağlantı noktasını kullanır.
    const ayk = ayar.ayakkabi;
    if (ayk === 'terlik' || ayk === 'sandalet') {
      // Düz taban + üstte bant(lar); topuk yok, parmaklar açık.
      ayakkabiParcalari.push(kure(diz, aykMal, [0,-.7,.1], [.2,.05,.3], 'TerlikTaban'));
      if (ayk === 'terlik') {
        const bant = kure(diz, aykMal, [0,-.645,.2], [.19,.055,.09], 'TerlikBant');
        bant.rotation.x = -.25;
      } else {
        for (let i=0;i<2;i++) {
          const b = kure(diz, aykMal, [0,-.648,.06+i*.17], [.185,.03,.045], 'SandaletBant');
          b.rotation.x = -.2 + i*.12;
        }
      }
    } else if (ayk === 'tokyo' || ayk === 'topuklu') {
      // Paket 7. Renk parçaya gömülüdür; oyuncu "Ayakkabı rengi"ni
      // varsayılandan değiştirdiyse o renk kullanılır.
      const kendiRengi = ayar.ayakkabiRenk === VARSAYILAN.ayakkabiRenk;
      if (ayk === 'tokyo') {
        // Tokyo terlik: kalın beyaz taban, kenarında renkli şerit,
        // parmak arasından iki yana inen renkli bant.
        const bantMal = kendiRengi ? mal('#1f6fd1', .5) : aykMal;
        ayakkabiParcalari.push(kure(diz, mal('#f7f6f1', .7), [0,-.712,.1], [.205,.052,.31], 'TokyoTaban'));
        ayakkabiParcalari.push(kure(diz, bantMal, [0,-.7,.1], [.21,.014,.315], 'TokyoSerit'));
        const bantlar = [];
        for (const yan of [-1, 1]) bantlar.push(cizgiGeo([[0,-.655,.3],[yan*.1,-.64,.2],[yan*.18,-.665,.1]], .022, 12));
        ayakkabiParcalari.push(birlestir(diz, bantlar, bantMal, 'TokyoBant'));
        ayakkabiParcalari.push(kure(diz, bantMal, [0,-.66,.3], [.03,.03,.03], 'TokyoParmakArasi'));
      } else {
        // Topuklu: arkası yükselen yassı parlak gövde, açık ayak üstü (ten),
        // burunda sivrilen uç ve ince uzun topuk.
        const topMal = kendiRengi ? mal('#c0233a', .3) : aykMal;
        ayakkabiParcalari.push(kure(diz, ten, [0,-.64,.06], [.12,.055,.17], 'TopukluAyakUstu'));
        // Burun kısa tutulur: uzun koni yandan diken gibi öne taşıyordu (görsel kontrol).
        const govdeAyk = kure(diz, topMal, [0,-.69,.12], [.155,.068,.26], 'TopukluGovde');
        govdeAyk.rotation.x = .22; ayakkabiParcalari.push(govdeAyk);
        const burun = ekle(diz, new T.ConeGeometry(.1,.1,16), topMal, [0,-.735,.34], [1,1,.45], 'TopukluBurun');
        burun.rotation.x = Math.PI / 2; ayakkabiParcalari.push(burun);
        ayakkabiParcalari.push(ekle(diz, new T.CylinderGeometry(.034,.016,.17,10), topMal, [0,-.685,-.12], [1,1,1], 'Topuk'));
      }
    } else {
      // spor / bot — kapalı ayakkabı. Bot daha yüksek bilekli.
      const yukseklik = ayk === 'bot' ? .185 : .145;
      ayakkabiParcalari.push(kure(diz, aykMal, [0,-.63,.12], [.21,yukseklik,.34], 'Ayakkabi'));
      ayakkabiParcalari.push(kure(diz, beyaz, [0,-.713,.12], [.215,.056,.342], 'Taban'));
      if (ayk === 'bot') {
        ayakkabiParcalari.push(kure(diz, aykMal, [0,-.47,.03], [.185,.13,.2], 'BotBilek'));
      } else {
        for(let i=0;i<3;i++) { const bag = kapsul(diz, beyaz, .018, .17, [0,-.51-i*.023,.17+i*.05], 'Bagcik'); bag.rotation.z=Math.PI/2; ayakkabiParcalari.push(bag); }
      }
      const aykDikis=[];
      for(const yan of [-1,1])aykDikis.push(cizgiGeo([[yan*.187,-.6,-.04],[yan*.205,-.62,.16],[yan*.14,-.655,.37]],.007));
      ayakkabiParcalari.push(birlestir(diz,aykDikis,metal,'AyakkabiYanDikis'));
    }
    eklemler.push({ kol, dirsek, bac, diz, s });
    // ---- YENİ ÜSTLERİN KOLLARI / KOSTÜM BACAKLARI (Paket 7) ----
    if (ust) {
      if (ust.kol === 'kisa') {
        kiyafetParcalari.push(kapsul(kol, ustKolMal, .166, .12, [0,-.13,0], 'KisaKol'));
      } else if (ust.kol === 'uzun') {
        // Paket 9: eskiden kısa olmayan her üst uzun kol alıyordu; kolsuz
        // (askılı/straplez) üstlerde kol kabuğu çizilmez, kol teni görünür.
        kiyafetParcalari.push(kapsul(kol, ustKolMal, .168, .36, [0,-.26,0], 'UzunUstKol'));
        kiyafetParcalari.push(kapsul(dirsek, ustKolMal, .143, .22, [0,-.2,0], 'UzunAltKol'));
        kiyafetParcalari.push(kure(dirsek, ustKolMal, [0,0,0], [.146,.15,.146], 'UzunKolDirsek'));
        // Manşet: damatlıkta beyaz gömlek manşeti, diğerlerinde koyu ton.
        kiyafetParcalari.push(ekle(dirsek, new T.CylinderGeometry(.15,.147,.06,16), ayar.kiyafet === 'damatlik' ? beyaz : ustDetayMal, [0,-.42,0], [1,1,1], 'UzunKolManset'));
      }
      if (ust.bacak) {
        // Alt giyim kabuğunun (r .196 / .162) biraz dışında: şort ya da kapri
        // takılı olsa bile kostüm bacağı tam boy görünür.
        for (const [kemikP, r] of [[bac, .206], [diz, .172]]) {
          const p = kapsul(kemikP, kostumBacakMal, r, kemikP === bac ? .29 : .32, [0,-.24,0], 'KostumBacak');
          kiyafetParcalari.push(p); kostumBacakParcalari.push(p);
        }
      }
    }
    ceketParcalari.push(kapsul(kol, ceketMal, .177, .36, [0,-.26,0], 'CeketUstKol'));
    ceketParcalari.push(kapsul(dirsek, ceketMal, .152, .22, [0,-.2,0], 'CeketAltKol'));
    ceketParcalari.push(kure(dirsek,ceketMal,[0,0,0],[.155,.16,.155],'CeketDirsek'));
    ceketParcalari.push(ekle(dirsek, new T.CylinderGeometry(.163,.16,.09,20), koyu, [0,-.435,0], [1,1,1], 'Manset'));
  }
  kure(kafa, ten, [0,.04,.442], [.085,.115,.107], 'Burun');
  const dudak = mal(ton(ayar.ten,.48));
  const agizYolu = new T.CatmullRomCurve3([new T.Vector3(-.14,-.14,.405),new T.Vector3(0,-.174,.442),new T.Vector3(.14,-.13,.407)]);
  ekle(kafa, new T.TubeGeometry(agizYolu, 16, .016, 6, false), dudak, [0,0,0], [1,1,1], 'Gulumseme');

  // Açık önlü tek ceket gövdesi: iki küresel panel yerine omuzdan bele
  // uzanan kesintisiz siluet. Kollar hâlâ ortak omuz/dirseklerde.
  ceketParcalari.push(ekle(govde,govdeGeo([[.37,-.57],[.44,-.53],[.465,-.39],[.47,.08],[.51,.36],[.47,.48],[.23,.61]],.105),ceketMal,[0,0,0],[1,1,1],'CeketGovde'));
  const dikisler=[],disler=[];
  for (const s of [-1,1]) {
    const fermuar=[[s*.041,-.52,.268],[s*.049,-.2,.294],[s*.05,.2,.305],[s*.044,.47,.279],[s*.027,.59,.15]];
    ceketParcalari.push(ekle(govde,cizgiGeo(fermuar,.009),metal,[0,0,0],[1,1,1],'Fermuar'));
    dikisler.push(cizgiGeo([[s*.265,-.35,.244],[s*.3,-.2,.237],[s*.32,-.08,.226]],.012));
    dikisler.push(cizgiGeo([[s*.4,-.38,.16],[s*.435,.05,.155],[s*.45,.35,.155]],.005));
    for(let i=0;i<25;i++) {const dis=new T.BoxGeometry(.018,.007,.006);dis.translate(s*.047,-.39+i*.03,.302);disler.push(dis);}
  }
  ceketParcalari.push(birlestir(govde,dikisler,dikisMal,'CeketDikisleri'));
  ceketParcalari.push(birlestir(govde,disler,metal,'FermuarDisleri'));
  const altSerit=govdeGeo([[.442,-.55],[.455,-.49],[.457,-.45]],.105);
  ceketParcalari.push(ekle(govde,altSerit,dikisMal,[0,0,0],[1,1,1],'CeketAltRibana'));
  ceketParcalari.push(ekle(govde,govdeGeo([[.235,.56],[.23,.65],[.21,.67]],.3),dikisMal,[0,0,0],[1,1,1],'DikYaka'));
  ceketParcalari.push(kure(govde,metal,[.058,-.37,.313],[.021,.045,.014],'FermuarTutamaci'));
  for(const p of ceketParcalari) p.visible=ayar.ceket;

  // ---- ETEK (Paket 9) — `alt` yuvası, bel kemiğinde tek parça ----
  // Bel kemiği yürürken dönmediği için etek sabit durur; bacaklar içinde
  // salınır. Kumaş iki yüzlü: aşağıdan bakınca iç yüzü boş görünmesin.
  if (ayar.alt === 'etek') {
    const etekMal = mal(ayar.altRenk, .7); etekMal.side = T.DoubleSide;
    const etekProfil = [[.36,.12],[.42,-.02],[.47,-.22],[.51,-.4],[.52,-.45]].map(p => new T.Vector2(...p));
    const etekGovde = new T.LatheGeometry(etekProfil, 40); etekGovde.scale(1, 1, .72);
    altParcalari.push(ekle(bel, etekGovde, etekMal, [0,0,0], [1,1,1], 'Etek'));
    const etekKenari = ekle(bel, new T.TorusGeometry(.52, .018, 6, 48), mal(ton(ayar.altRenk, .7)), [0,-.45,0], [1,.72,1], 'EtekKenari');
    etekKenari.rotation.x = Math.PI / 2; altParcalari.push(etekKenari);
    const etekBeli = ekle(bel, new T.TorusGeometry(.37, .026, 6, 40), mal(ton(ayar.altRenk, .7)), [0,.11,0], [1,.72,1], 'EtekBeli');
    etekBeli.rotation.x = Math.PI / 2; altParcalari.push(etekBeli);
  }

  // Gelinlik bütün kimliklerde aynı bel yuvasına oturur. Etek yürüyüş
  // salınımına yer bırakır; bacaklar içeride kalır, ayakkabılar görünür.
  const elbiseYuva=new T.Group();elbiseYuva.name='ElbiseYuvasi';bel.add(elbiseYuva);elbiseYuva.visible=ayar.kiyafet==='gelinlik';
  const saten=mal('#f3eee4',.48),inci=mal('#fff6e2',.25,.12);
  const etekGeo=govdeGeo([[.79,-1.02],[.78,-.95],[.69,-.62],[.56,-.23],[.43,.17]],0);etekGeo.scale(1,1,1.65);
  const ep=etekGeo.attributes.position;
  for(let i=0;i<ep.count;i++){const v=Math.max(0,-ep.getY(i)),a=Math.atan2(ep.getX(i),ep.getZ(i)),r=1+Math.cos(a*16)*.018*v;ep.setXYZ(i,ep.getX(i)*r,ep.getY(i),ep.getZ(i)*r);}
  etekGeo.computeVertexNormals();ekle(elbiseYuva,etekGeo,saten,[0,0,0],[1,1,1],'GelinlikEtek');
  const elbiseUst=ekle(govde,govdeGeo([[.435,-.53],[.44,-.1],[.49,.32],[.38,.44],[.2,.6]]),saten,[0,0,0],[1,1,1],'GelinlikUst');elbiseUst.visible=elbiseYuva.visible;
  const kusak=ekle(elbiseYuva,new T.TorusGeometry(.429,.028,8,48),inci,[0,.16,0],[1,1,1],'BelKusagi');kusak.rotation.x=Math.PI/2;
  const etekKenar=ekle(elbiseYuva,new T.TorusGeometry(.788,.012,6,64),inci,[0,-1.02,0],[1,1,1.02],'EtekKenar');etekKenar.rotation.x=Math.PI/2;

  // Saçlar aynı kafa yuvasını paylaşır. Ense kilitleri omuz hizasında biter.
  const sacYuva = new T.Group(); sacYuva.name='SacYuvasi'; kafa.add(sacYuva);
  const ustSac=new T.Group();ustSac.name='UstSac';sacYuva.add(ustSac);
  if(['kep','bere'].includes(ayar.bas)){ustSac.visible=false;}
  if (ayar.sac !== 'yok') {
    ekle(ustSac, new T.SphereGeometry(1,24,16,0,Math.PI*2,0,1.42), sac, [0,.22,-.025], [.55,.58,.46], 'SacTabani');
    const tutamlar=[],sacCizgileri=[];
    for(let i=0;i<8;i++) {
      const x=-.4+i*.109;
      const yol=new T.CatmullRomCurve3([new T.Vector3(x,.44,.32),new T.Vector3(x-.07,.64,.36),new T.Vector3(x+.025,.78,.08),new T.Vector3(x+.13,.63,-.23)]);
      const geo=new T.TubeGeometry(yol,20,.105,10,false),p=geo.attributes.position;
      for(let j=0;j<=20;j++){const merkez=yol.getPointAt(j/20);const r=.25+.75*Math.sin(Math.PI*(j/20)*.85);for(let k=0;k<=10;k++){const n=j*11+k;const v=new T.Vector3().fromBufferAttribute(p,n).sub(merkez);v.multiplyScalar(r).add(merkez);p.setXYZ(n,v.x,v.y,v.z);}}
      geo.computeVertexNormals();tutamlar.push(geo);
      sacCizgileri.push(cizgiGeo([[x-.06,.6,.421],[x-.035,.75,.22],[x+.07,.76,.03]],.004,12));
    }
    birlestir(ustSac,tutamlar,sac,'SekilliOnSac');
    birlestir(ustSac,sacCizgileri,sacIsik,'SacAkisCizgileri');
    if (ayar.sac === 'uzun' || ayar.sac === 'rasta') {
      const adet=ayar.sac === 'rasta'?18:10;
      for(let i=0;i<adet;i++) {
        const a=.9+i/(adet-1)*(Math.PI*2-1.8), x=Math.sin(a)*.48, z=Math.cos(a)*.43;
        const yol=new T.CatmullRomCurve3([new T.Vector3(x*.87,.5,z*.87),new T.Vector3(x*1.12,.13,z*1.1),new T.Vector3(x*1.12,-.27,z*1.12),new T.Vector3(x*1.05,-.55,z*1.14)]);
        ekle(sacYuva,new T.TubeGeometry(yol,12,ayar.sac==='rasta'?.055:.09,8,false),sac,[0,0,0],[1,1,1],'SacTutami');
        if(ayar.sac==='rasta' && i%4===0) kure(sacYuva,metal,[x*1.07,-.43,z*1.13],[.06,.05,.06],'SacBoncugu');
      }
    }
    // ---- YENİ SAÇ STİLLERİ (Paket 9) ----
    // Topuz ÜST saça bağlı (kep/bere altında gizlenir); arkaya sarkan at
    // kuyruğu, örgü ve dalgalı tutamlar uzun saç gibi sacYuva'da kalır.
    const lastik = mal('#2b2b33', .5);
    if (ayar.sac === 'dalgali') {
      for (let i = 0; i < 12; i++) {
        const a = .9 + i / 11 * (Math.PI * 2 - 1.8), x = Math.sin(a) * .48, z = Math.cos(a) * .43;
        const nokta = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6, acil = .87 + .26 * Math.min(1, t * 3), dalga = Math.sin(t * Math.PI * 3 + i) * .045;
          nokta.push(new T.Vector3(x * acil + dalga * Math.cos(a), .5 - 1.12 * t, z * acil - dalga * Math.sin(a)));
        }
        ekle(sacYuva, new T.TubeGeometry(new T.CatmullRomCurve3(nokta), 24, .085, 8, false), sac, [0,0,0], [1,1,1], 'DalgaliTutam');
      }
    } else if (ayar.sac === 'topuz') {
      // Başın ÜSTÜNDE: önden bakınca (portre, kart) kısa saçtan ayırt edilsin.
      // İlk denemede ense hizasındaydı ve önden hiç görünmüyordu (görsel kontrol).
      kure(ustSac, sac, [0,.9,-.22], [.2,.18,.2], 'Topuz');
      const l = ekle(ustSac, new T.TorusGeometry(.12, .026, 8, 24), lastik, [0,.8,-.2], [1,1,1], 'TopuzLastik');
      l.rotation.x = -.5;
    } else if (ayar.sac === 'atkuyruk') {
      // YANDAN AT KUYRUĞU: arkada sağda, kulak hizasının altında bağlanır ve
      // sağ omzun önüne iner — önden görünür, sol omuzdaki örgüden ayrılır.
      // (İki denemede ense arkasında / tepede kaldı; öndeki tutamların
      // arkasında kısa saçtan ayırt edilemiyordu — görsel kontrol.)
      const l = ekle(sacYuva, new T.TorusGeometry(.075, .026, 8, 20), lastik, [.25,.05,-.45], [1,1,1], 'AtkuyrukLastik');
      l.rotation.y = .9;
      const yol = new T.CatmullRomCurve3([new T.Vector3(.25,.05,-.47), new T.Vector3(.4,-.1,-.4), new T.Vector3(.5,-.35,-.15), new T.Vector3(.46,-.7,.2)]);
      const geo = new T.TubeGeometry(yol, 20, .1, 10, false), p = geo.attributes.position;
      // Uca doğru incelir (tutam kodundaki yöntem).
      for (let j = 0; j <= 20; j++) {
        const merkez = yol.getPointAt(j / 20), r = 1 - .55 * (j / 20);
        for (let k = 0; k <= 10; k++) {
          const n = j * 11 + k;
          const v = new T.Vector3().fromBufferAttribute(p, n).sub(merkez);
          v.multiplyScalar(r).add(merkez); p.setXYZ(n, v.x, v.y, v.z);
        }
      }
      geo.computeVertexNormals();
      ekle(sacYuva, geo, sac, [0,0,0], [1,1,1], 'Atkuyrugu');
    } else if (ayar.sac === 'orgu') {
      // YAN ÖRGÜ: sol şakaktan omzun önüne sarkar — önden görünür. (İlk
      // denemede ense arkasındaydı, kartta kısa saçtan farkı yoktu.)
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        kure(sacYuva, sac, [-.44 + .08 * t + (i % 2 ? .025 : -.025), .15 - .8 * t, .1 + .22 * t], [.08 - i * .003, .065, .075], 'OrguHalka');
      }
      const l = ekle(sacYuva, new T.TorusGeometry(.045, .018, 8, 18), lastik, [-.35,-.72,.33], [1,1,1], 'OrguLastik');
      l.rotation.x = Math.PI / 2;
    }
  }
  const basYuva=new T.Group();basYuva.name='BasYuvasi';kafa.add(basYuva);
  if(ayar.bas==='kep'||ayar.bas==='bere'){
    const basMal=mal(ayar.bas==='kep'?'#263c54':'#753b54');
    ekle(basYuva,new T.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI/2),basMal,[0,.42,-.025],[.59,.45,.52],'SapkaKubbe');
    const serit=ekle(basYuva,new T.TorusGeometry(.557,.035,8,40),basMal,[0,.43,-.025],[1,.91,1],'SapkaSerit');serit.rotation.x=Math.PI/2;
    if(ayar.bas==='kep'){const siper=kure(basYuva,basMal,[0,.43,.47],[.5,.035,.37],'KepSiper');siper.rotation.x=.06;}
    else kure(basYuva,basMal,[.1,.89,-.1],[.12,.12,.12],'BerePonpon');
  }
  if(ayar.bas==='tac'){
    const halka=ekle(basYuva,new T.TorusGeometry(.515,.034,8,48),metal,[0,.65,0],[1,.9,1],'TacHalka');halka.rotation.x=Math.PI/2;
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2,x=Math.sin(a)*.515,z=Math.cos(a)*.464;ekle(basYuva,new T.ConeGeometry(.068,.22,5),metal,[x,.76,z],[1,1,1],'TacUcu');kure(basYuva,metal,[x,.88,z],[.032,.032,.032],'TacBoncuk');}
  }
  if(ayar.bas==='duvak'){
    const tul=mal('#e7e9f4');tul.transparent=true;tul.opacity=.58;tul.side=T.DoubleSide;tul.depthWrite=false;
    const geo=new T.PlaneGeometry(1.4,1.5,16,20),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const v=.75-p.getY(i),x=p.getX(i);p.setXYZ(i,x*(.65+v*.3),p.getY(i)-.02,-.49-v*.15-Math.cos(x*18)*v*.025);}
    geo.computeVertexNormals();ekle(basYuva,geo,tul,[0,0,0],[1,1,1],'Duvak');
    for(let i=0;i<7;i++){const x=(i-3)*.115;const y=.74-Math.abs(x)*.1;kure(basYuva,inci,[x,y,.02],[.052,.042,.06],'DuvakInci');}
  }
  if(ayar.bas==='boynuz'){
    // Şeytan boynuzu: iki kıvrık koni, uçları hafifçe içe döner.
    const boynuzMal=mal('#b3181f',.45);
    for(const s of [-1,1]){
      const geo=new T.ConeGeometry(.075,.3,14,6),p=geo.attributes.position;
      for(let i=0;i<p.count;i++){const t=(p.getY(i)+.15)/.3;p.setX(i,p.getX(i)-s*.09*t*t);}
      geo.computeVertexNormals();
      const b=ekle(basYuva,geo,boynuzMal,[s*.29,.86,.04],[1,1,1],'Boynuz');b.rotation.z=-s*.5;
    }
  }
  // ---- TAKILAR (Paket 7) — kolye / saat / küpe, üç ayrı yuva ----
  // Altın ve gümüş aynı geometri; yalnız malzeme değişir. Metalik oran
  // düşük tutuldu: sahnede ortam haritası yok, yüksek metalik koyu görünür.
  const takiMal = tur => tur === 'altin' ? mal('#e2b646', .28, .5) : mal('#d9dde3', .24, .5);
  const kolyeYuva = new T.Group(); kolyeYuva.name = 'KolyeYuvasi'; govde.add(kolyeYuva);
  kolyeYuva.visible = ayar.kolye !== 'yok';
  if (kolyeYuva.visible) {
    const m = takiMal(ayar.kolye);
    // Boynun (r .16) dışından dolaşıp göğüste düşen kapalı zincir.
    const yol = new T.CatmullRomCurve3([[0,.665,-.18],[.18,.645,-.07],[.225,.6,.06],[.155,.5,.235],[0,.445,.3],[-.155,.5,.235],[-.225,.6,.06],[-.18,.645,-.07]].map(p => new T.Vector3(...p)), true);
    ekle(kolyeYuva, new T.TubeGeometry(yol, 64, ayar.kolye === 'altin' ? .016 : .012, 6, true), m, [0,0,0], [1,1,1], 'KolyeZincir');
    const madalyon = ekle(kolyeYuva, new T.CylinderGeometry(.055,.055,.016,24), m, [0,.375,.312], [1,1,1], 'KolyeMadalyon');
    madalyon.rotation.x = Math.PI / 2 - .2;
    if (ayar.kolye === 'altin') kure(kolyeYuva, mal('#c0233a', .2, .1), [0,.375,.322], [.022,.022,.012], 'KolyeTas');
  }
  const uzunKol = ayar.kiyafet === 'ceket' || ust?.kol === 'uzun';
  const solDirsek = eklemler.find(e => e.s === -1).dirsek;
  const saatYuva = new T.Group(); saatYuva.name = 'SaatYuvasi'; solDirsek.add(saatYuva);
  saatYuva.visible = ayar.saat !== 'yok';
  if (saatYuva.visible) {
    const m = takiMal(ayar.saat);
    // Uzun kolda kordon kolun üstüne oturur (kol kabuğu daha kalın).
    const R = uzunKol ? .168 : .128;
    const kordon = ekle(saatYuva, new T.TorusGeometry(R, .026, 8, 28), m, [0,-.37,0], [1,1,1], 'SaatKordon');
    kordon.rotation.x = Math.PI / 2;
    const kasa = ekle(saatYuva, new T.CylinderGeometry(.064,.064,.034,24), m, [0,-.37,R+.018], [1,1,1], 'SaatKasa');
    kasa.rotation.x = Math.PI / 2;
    ekle(saatYuva, new T.CircleGeometry(.05, 24), mal('#f4efe2', .35), [0,-.37,R+.036], [1,1,1], 'SaatKadran');
    const akrep = ekle(saatYuva, new T.BoxGeometry(.008,.036,.004), koyu, [.0,-.357,R+.039], [1,1,1], 'SaatAkrep');
    akrep.rotation.z = .9;
  }
  const kupeYuva = new T.Group(); kupeYuva.name = 'KupeYuvasi'; kafa.add(kupeYuva);
  kupeYuva.visible = ayar.kupe !== 'yok';
  if (kupeYuva.visible) {
    const m = takiMal(ayar.kupe);
    for (const s of [-1, 1]) {
      kure(kupeYuva, m, [s*.6,-.035,.03], [.03,.03,.03], 'KupeTopuz');
      const halka = ekle(kupeYuva, new T.TorusGeometry(.048, .012, 8, 24), m, [s*.605,-.11,.03], [1,1,1], 'KupeHalka');
      halka.rotation.y = s * .9;
    }
  }

  // ---- GÖZLÜK — 5 çeşit ----
  // Eskiden tek "güneş gözlüğü" vardı ve yuva BOOLEAN'dı. Artık çeşit
  // seçiliyor; her çeşit aynı bağlantı noktalarını kullanır (göz merkezi
  // y=.2, z≈.5) ki yüz biçimi değişse de yerinden oynamasın.
  const gozlukYuva=new T.Group(); gozlukYuva.name='GozlukYuvasi'; kafa.add(gozlukYuva);
  gozlukYuva.visible = ayar.gozluk !== 'yok';
  if (gozlukYuva.visible) {
    const g = ayar.gozluk;
    // Cam rengi/saydamlığı çeşide göre: güneş koyu, okuma şeffaf.
    const camRenk = g === 'gunes' ? '#172c35' : g === 'spor' ? '#2b3f1f' : '#cfe3ef';
    const cam = mal(camRenk, .18, .35);
    if (g !== 'gunes' && g !== 'spor') { cam.transparent = true; cam.opacity = .34; }
    // Çerçeve: okuma gözlüğü ince altın, diğerleri koyu.
    const cerceveMal = g === 'okuma' ? metal : koyu;
    for (const s of [-1,1]) {
      if (g === 'kare') {
        ekle(gozlukYuva,new T.BoxGeometry(.3,.22,.035),cerceveMal,[s*.205,.2,.492],[1,1,1],'GozlukCerceve');
        ekle(gozlukYuva,new T.PlaneGeometry(.27,.19),cam,[s*.205,.2,.512],[1,1,1],'GozlukCami');
      } else if (g === 'spor') {
        // Tek parça vizör hissi: hafif eğik geniş oval.
        const v=ekle(gozlukYuva,new T.TorusGeometry(.17,.026,8,28),cerceveMal,[s*.2,.2,.49],[1,.62,1],'GozlukCerceve');
        v.rotation.z=s*.12;
        ekle(gozlukYuva,new T.CircleGeometry(.166,28),cam,[s*.2,.2,.5],[1,.62,1],'GozlukCami');
      } else {
        // gunes / yuvarlak / okuma — yuvarlak cam, kalınlık çeşide göre.
        const kalinlik = g === 'okuma' ? .014 : .021;
        const yaricap  = g === 'yuvarlak' ? .14 : .155;
        ekle(gozlukYuva,new T.TorusGeometry(yaricap,kalinlik,8,32),cerceveMal,[s*.205,.2,.497],[1,.78,1],'GozlukCerceve');
        ekle(gozlukYuva,new T.CircleGeometry(yaricap-.004,32),cam,[s*.205,.2,.5],[1,.78,1],
             g==='gunes'?'GunesCami':'GozlukCami');
      }
      const sap=ekle(gozlukYuva,new T.CylinderGeometry(.017,.017,.48,8),cerceveMal,[s*.382,.2,.26],[1,1,1],'GozlukSapi');
      sap.rotation.x=Math.PI/2;
    }
    const kopru=kapsul(gozlukYuva,cerceveMal,.015,.09,[0,.23,.51],'GozlukKoprusu'); kopru.rotation.z=Math.PI/2;
  }

  // ---- SAKAL / BIYIK — tek yuva, 4 çeşit ----
  // Sakal ve bıyık AYNI yuvada: biri takılınca diğeri çıkar (saç yuvasının
  // çalışma mantığı). Hepsi saç malzemesini kullanır ki saç rengiyle uyumlu
  // olsun; çene ve üst dudak bağlantı noktaları yüz biçiminden bağımsızdır.
  const sakalYuva=new T.Group(); sakalYuva.name='SakalYuvasi'; kafa.add(sakalYuva);
  sakalYuva.visible = ayar.sakal !== 'yok';
  if (sakalYuva.visible) {
    const sk = ayar.sakal;
    if (sk === 'tam' || sk === 'keci' || sk === 'favori') {
      // Çene örtüsü: küre parçasından yontulmuş yumuşak kütle.
      const en = sk === 'tam' ? .43 : sk === 'keci' ? .2 : .3;
      const boy = sk === 'tam' ? .3 : sk === 'keci' ? .22 : .34;
      const cene = kure(sakalYuva, sac, [0,-.3,.33], [en,boy,.31], 'SakalCene');
      cene.rotation.x = -.12;
      if (sk === 'tam') {
        // Yanaklara doğru uzanan iki yan parça.
        for (const s of [-1,1]) kure(sakalYuva, sac, [s*.33,-.13,.26], [.13,.2,.2], 'SakalYan');
      }
      if (sk === 'favori') {
        // Favori: kulak önünden çeneye inen iki şerit, çene boş kalır.
        cene.visible = false;
        for (const s of [-1,1]) {
          const f = kure(sakalYuva, sac, [s*.37,-.07,.2], [.075,.23,.16], 'Favori');
          f.rotation.z = -s*.16;
        }
      }
    }
    if (sk === 'tam' || sk === 'biyik') {
      // Bıyık: üst dudak üstünde iki kapsül, ortada hafif boşluk.
      for (const s of [-1,1]) {
        const b = kapsul(sakalYuva, sac, .036, .11, [s*.072,-.155,.44], 'Biyik');
        b.rotation.z = Math.PI/2 + s*.18;
      }
    }
  }

  // Pelerin gerçek SkinnedMesh: dört kemik boyunca ağırlıklı yumuşak bükülme.
  const capeRoot=kemik('PelerinYuvasi',govde,[0,.52,-.32]);
  const capeBones=[capeRoot];
  for(let i=1;i<4;i++) capeBones.push(kemik('Pelerin'+i,capeBones[i-1],[0,-.48,-.12]));
  const capeGeo=new T.PlaneGeometry(1,1,16,24), pos=capeGeo.attributes.position;
  const indices=[], weights=[];
  for(let i=0;i<pos.count;i++) {
    const u=pos.getX(i), v=.5-pos.getY(i), y=-v*1.6;
    pos.setXYZ(i,u*(.83+v*.62),y,-v*.42-Math.cos(u*Math.PI*8)*.035*v);
    const b=Math.min(v*1.6/.48,3), lo=Math.floor(b), hi=Math.min(lo+1,3);
    indices.push(lo,hi,0,0); weights.push(1-(b-lo),b-lo,0,0);
  }
  capeGeo.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
  capeGeo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4)); capeGeo.computeVertexNormals(); geometriler.add(capeGeo);
  const capeMat=mal('#503b82'); capeMat.side=T.DoubleSide;
  const pelerin=new T.SkinnedMesh(capeGeo,capeMat); pelerin.name='Pelerin'; capeRoot.add(pelerin);
  avatar.updateMatrixWorld(true); const iskelet=new T.Skeleton(capeBones); pelerin.bind(iskelet); pelerin.frustumCulled=false;
    pelerin.castShadow=true; pelerin.receiveShadow=true;
  // PELERİN artık metin: 'yok' | 'klasik' | 'kisa'. Kısa pelerin aynı
  // geometriyi kullanır, yalnız boyu kısalır — ikinci bir mesh yok.
  capeRoot.visible = ayar.pelerin !== 'yok';
  if (ayar.pelerin === 'kisa') capeRoot.scale.set(.92, .58, .92);
  for(const s of [-1,1]) kure(capeRoot,metal,[s*.31,-.04,.03],[.046,.046,.03],'PelerinTokasi');

  avatar.userData={kok,govde,kafa,kollar,bacaklar,eklemler,ayar,sacYuva,gozlukYuva,basYuva,elbiseYuva,elbiseUst,capeRoot,pelerin,capeBones,ceketParcalari,sakalYuva,altParcalari,ayakkabiParcalari,kiyafetParcalari,kostumBacakParcalari,kolyeYuva,saatYuva,kupeYuva,yurumeFaz:0,dans:null};
  avatar.userData.yokEt=()=>{iskelet.dispose();geometriler.forEach(g=>g.dispose());malzemeler.forEach(m=>m.dispose());};
  return avatar;
}

export function hareket(avatar,t,mod='bekle') {
  const u=avatar.userData, yuruyor=mod==='yuru', selam=mod==='selam';
  u.kok.position.y=yuruyor?Math.abs(Math.sin(t*6))*.045:Math.sin(t*1.8)*.012;
  u.govde.rotation.set(0,Math.sin(t*(yuruyor?6:1.5))*(yuruyor?.035:.025),0);
  u.kafa.rotation.set(0,Math.sin(t*1.2)*.055,Math.sin(t*1.5)*.018);
  u.elbiseYuva.rotation.z=yuruyor?Math.sin(t*6)*.018:0;
  for(const e of u.eklemler) {
    const f=t*6+(e.s===1?Math.PI:0);
    e.kol.rotation.set(yuruyor?-Math.sin(f)*.38:0,0,e.s*.1);
    e.dirsek.rotation.x=-.1-(yuruyor?Math.max(0,Math.sin(f))*.24:0);
    e.bac.rotation.x=yuruyor?Math.sin(f)*.44:0;
    e.diz.rotation.x=yuruyor?Math.max(0,-Math.sin(f))*.65:0;
    if(selam&&e.s===1) {e.kol.rotation.z=2.3+Math.sin(t*5)*.14;e.dirsek.rotation.x=-.35;}
  }
  pelerinHareket(avatar,t,yuruyor);
}
export function pelerinHareket(avatar,t,yuruyor=false) {
  avatar.userData.capeBones.slice(1).forEach((b,i)=>{b.rotation.x=.08+Math.sin(t*(yuruyor?6:2)-i*.6)*(yuruyor?.13:.04);});
}
export function modelYokEt(avatar) {avatar?.userData?.yokEt?.();avatar?.removeFromParent();}
