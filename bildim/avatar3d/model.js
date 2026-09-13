import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ortak ölçü sözleşmesi: bütün ekipmanlar bu iskelete göre üretilir.
// Bu prototip tek insan gövdesidir; mevcut hayvanlara uyum iddiası yoktur.
export const VARSAYILAN = { ten: '#c58b62', sac: 'kisa', sacRenk: '#30211c',
  gozluk: 'yok', ceket: true, pelerin: 'yok', ceketRenk: '#be542d', yuz: 'dengeli',
  bas: 'yok', kiyafet: 'ceket', sakal: 'yok', ayakkabi: 'spor', alt: 'pantolon',
  ayakkabiRenk: '#eee7d8', altRenk: '#253341' };

// ---- yuva değer listeleri — TEK YER ----
// ayarDogrula, katalog ve kart görselleri hepsi buna bakar.
export const YUVA_DEGERLERI = {
  sac:      ['yok', 'kisa', 'uzun', 'rasta'],
  bas:      ['yok', 'kep', 'bere', 'tac', 'duvak'],
  kiyafet:  ['ceket', 'tisort', 'gelinlik', 'atlet', 'gomlek'],
  // GÖZLÜK ve PELERİN ESKİDEN BOOLEAN'DI (`g.gozluk === true`). Çeşit
  // desteklemek için metne çevrildi; eski `true` değeri ayarDogrula'da
  // 'gunes' / 'klasik' karşılığına taşınır — kayıtlı görünümler bozulmaz.
  gozluk:   ['yok', 'gunes', 'kare', 'yuvarlak', 'okuma', 'spor'],
  pelerin:  ['yok', 'klasik', 'kisa'],
  sakal:    ['yok', 'tam', 'keci', 'biyik', 'favori'],
  ayakkabi: ['spor', 'terlik', 'bot', 'sandalet'],
  alt:      ['pantolon', 'sort', 'kapri'],
};
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
  const ustProfil = ayar.kiyafet === 'atlet'
    ? [[.33,-.56],[.38,-.4],[.40,.2],[.36,.33],[.14,.4]]
    : ayar.kiyafet === 'gomlek'
      ? [[.37,-.6],[.42,-.4],[.45,.2],[.45,.46],[.21,.6]]
      : [[.35,-.56],[.4,-.4],[.43,.2],[.43,.43],[.2,.6]];
  const ustGiyim = ekle(govde,govdeGeo(ustProfil),beyaz,[0,0,0],[1,1,1],'Tisort');
  if (ayar.kiyafet === 'gomlek') {
    // Ön dikiş + iki düğme: gömleği tişörtten ayıran en ucuz iki detay.
    ekle(govde,cizgiGeo([[0,-.5,.28],[0,.1,.29],[0,.42,.24]],.012),dikisMal,[0,0,0],[1,1,1],'GomlekOnDikis');
    for(let i=0;i<2;i++) kure(govde,dikisMal,[0,-.16+i*.3,.3],[.032,.032,.016],'GomlekDugme');
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
    altParcalari.push(kapsul(bac, altMal, .196, .29, [0,-.24,0], 'AltUst'));
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

  avatar.userData={kok,govde,kafa,kollar,bacaklar,eklemler,ayar,sacYuva,gozlukYuva,basYuva,elbiseYuva,elbiseUst,capeRoot,pelerin,capeBones,ceketParcalari,sakalYuva,altParcalari,ayakkabiParcalari,yurumeFaz:0,dans:null};
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
