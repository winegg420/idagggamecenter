// ============================================================
// MEYDAN (The Square) — DÜNYA (saf three.js, React yok)
//
// QUIZADOR_MEYDAN_REFERANS.html içindeki sahne birebir buraya taşındı:
// ışık, çim + yamalar, kaldırım taşı meydan, havuz, 7 bina, yollar,
// banklar, lambalar, ağaçlar, çalılar, bulutlar, avatar, emoji balonu,
// çarpışma ve kamera takibi.
//
// HaritaSayfasi.jsx yalnız React yaşam döngüsünü ve HUD'u yönetir; three.js'e
// dokunan her şey bu dosyada. Böylece sahne React'ten bağımsız sınanabilir
// ve sayfa kapanınca tek çağrıyla (yokEt) tamamen serbest bırakılır.
//
// NOT — three r128 → 0.185 farkı: yeni sürümde ışıklar fiziksel birim
// kullanıyor (eski "legacy" modu kaldırıldı). Referanstaki 0.95 / 1.05
// yoğunlukları burada olduğu gibi kullanılsa sahne belirgin karanlık çıkıyor;
// eski görünümü korumak için ışıklar π ile çarpıldı (three'nin kendi geçiş
// notundaki dönüşüm).
// ============================================================
import * as THREE from "three";
import { roundRect, canvasDoku, isimEtiketi, nesneyiSerbestBirak } from "./ortak.js";
// MEYDAN KARAKTERİ ARTIK GERÇEK 3B GÖVDE (13 Eylül 2026):
// bildim/avatar3d/ altındaki iskeletli model. Gardıropta ne giyildiyse
// meydanda da o görünür. Çağrılar karakterGorsel.js üzerinden gidiyor;
// o dosya işi meydan-model.js'e devrediyor ve eski 2B billboard kodunu
// `billboardAvatarKur` adıyla yedekte tutuyor.
import {
  karakterAvatarKur, karakterGorunumDegistir, karakterPozGuncelle,
  karakterYonGuncelle, karakterYokEt, karakterDokulariniTemizle,
} from "./karakterGorsel.js";
import { meydanModelYuru } from "../avatar3d/meydan-model.js";
import { esyaBilgisi, esyaOnbelleginiTemizle } from "./esyalar.js";
import { dansBaslat, dansKaresi, dansiDurdur } from "./danslar.js";
import { turnuvaSaatleri } from "../lib/zaman.js";
import { tt } from "../lib/dil.js";
// AŞAMA 2A: yerleşim manifesti (yerlesim.json) verilirse dünya ondan kurulur — konumlar koda gömülü değil.
import { yerlesimKur } from "./yerlesimDunya.js";
// AŞAMA 2B: haritadaki bütün karakterler (kendi oyuncu, uzaktakiler, botlar) yeni GLB karakter — ortak modülden
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { KarakterSistemi, VARLIK_KOK } from "./karakter/karakter.js";
import { MeydanAvatarlari } from "./karakter/meydanAvatar.js";
import { TemasGolgeleri } from "./karakter/temas.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cevreKur, PROPLAR, KediSurusu } from "./cevre.js";
export { esyaBilgisi };

// roundRect / canvasDoku / isimEtiketi / nesneyiSerbestBirak ORTAK.JS'e taşındı:
// Görünüm sayfasındaki önizleme de aynı avatarı çiziyor, iki kopya olmamalı.
export { nesneyiSerbestBirak };

// PAKET 13 — HARİTA BÜYÜDÜ: binalar 30 → 44, göl 6,6 → 14, sınır 58 → 80.
// Taş meydan 17 → 26; bank/lamba/ağaç halkaları buna oranlandı.
const YARICAP = 44; // binaların meydan merkezine uzaklığı
const HAVUZ_YARICAP = 14; // göl yarıçapı (eski çeşme havuzu)
const HARITA_SINIRI = 80;
const MEYDAN_R = 26; // taş meydanın yarıçapı
// KÖPRÜ: gölün üstünden x ekseni boyunca geçen kemer. L = yarı uzunluk
// (kıyıya 1,8 birim taşar), W = güverte genişliği, H = kemerin tepe yüksekliği.
// Kemer yüksekliği tek yerde: zeminYuksekligi(). Çarpışma ve avatar y buna bakar.
const KOPRU = { L: 15.8, W: 3.4, H: 3.0 };

/** Bina listesi — renkler mevcut mod renkleriyle aynı, değiştirme. */
export const BINALAR = [
  { ad: tt("Meydan Oku"), alt: tt("1v1 düello"),        duvar: "#FF5B4A", cati: "#C03225", rota: "/meydan" },
  { ad: tt("Hızlı Mod"),  alt: tt("90 saniye"),         duvar: "#FFB020", cati: "#C98A22", rota: "/hizli-mod" },
  { ad: tt("Grup Maçı"),  alt: tt("3-5 kişi"),          duvar: "#4A9DD9", cati: "#2B6BA3", rota: "/meydan" },
  // Alt yazı sunucudaki turnuva saatlerinden okunur (bkz. lib/zaman.js);
  // saat değişirse levha da değişir.
  { ad: tt("Turnuva"),    alt: null,                duvar: "#A855F7", cati: "#6D21B0", rota: "/turnuva" },
  { ad: tt("Dükkân"),     alt: tt("joker ve paketler"), duvar: "#EC4899", cati: "#A81B62", rota: "/joker" },
  { ad: tt("Lig"),        alt: tt("haftalık sıralama"), duvar: "#2FBF71", cati: "#137A45", rota: "/siralama" },
  { ad: tt("Hatalarım"),  alt: tt("çalışma odası"),     duvar: "#20A4A0", cati: "#0F6B68", rota: "/calisma" },
];

function mat(renk) {
  return new THREE.MeshLambertMaterial({ color: renk });
}



/** Bina tabelası (canvas sprite). */
function levha(metin, renk) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; roundRect(x, 6, 6, 500, 116, 26); x.fill();
  x.fillStyle = renk;      roundRect(x, 6, 6, 500, 100, 26); x.fill();
  x.font = '800 58px "Baloo 2", "Trebuchet MS", sans-serif';
  x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = "rgba(0,0,0,.28)"; x.shadowOffsetY = 3; x.shadowBlur = 0;
  x.fillText(metin, 256, 56);
  const t = canvasDoku(c);
  t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }));
  s.scale.set(7.2, 1.8, 1);
  return s;
}





/**
 * Dünyayı kurar ve döngü/yok etme arayüzünü döndürür.
 *
 * @param {HTMLElement} kapsayici  canvas'ın ekleneceği eleman
 * @param {object} s  { dusukDonanim:boolean, hareketAzalt:boolean, yerlesim?:object }
 *   yerlesim: Aşama 2A manifesti (yerlesim.json). Verilirse greybox dünya MANİFESTTEN kurulur; verilmezse
 *   Paket 13 dünyası (göl, köprü, 7 bina) eskisi gibi. Oynanış (çoklu, kontrol, kamera, zıplama, dans, ikram) iki durumda da aynı.
 */
export function dunyaKur(kapsayici, s = {}) {
  const dusukDonanim = Boolean(s.dusukDonanim);
  const hareketAzalt = Boolean(s.hareketAzalt);
  const yerlesim = s.yerlesim ?? null;

  let W = kapsayici.clientWidth || window.innerWidth;
  let H = kapsayici.clientHeight || window.innerHeight;

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0xbfe8ff);
  // Greybox gerçek ölçekte ~250 m + arka plan kuşağı (Boğaz ~300 m): sis ve uzak kırpma oraya kadar açılır
  sahne.fog = yerlesim ? new THREE.Fog(0xcdeeff, 260, 780) : new THREE.Fog(0xcdeeff, 85, 190);

  // GÖRÜŞ AÇISI: dikeyde 42°, yatayda 48°. Telefon yan çevrilince ekran
  // alçalıyor ve sahne dar bir şeritten bakılıyormuş gibi görünüyordu.
  const fov = () => (W > H ? 48 : 42);
  const kamera = new THREE.PerspectiveCamera(fov(), W / H, 0.5, yerlesim ? 1000 : 400);
  const render = new THREE.WebGLRenderer({ antialias: !dusukDonanim, powerPreference: "high-performance" });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.setSize(W, H);
  render.shadowMap.enabled = !dusukDonanim; // düşük donanımda gölge kapalı
  // 2B: laboratuvarın B+ ışığı (Aşama 1C §7) — karakter/çevre malzemesi (atlas + bölge cilası) buna göre ayarlı
  render.shadowMap.type = THREE.PCFShadowMap;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.08;
  kapsayici.appendChild(render.domElement);
  try { const pmrem = new THREE.PMREMGenerator(render); sahne.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; sahne.environmentIntensity = 0.25; pmrem.dispose(); } catch (e) { console.error("[Meydan] ortam haritasi:", e); }

  // ---------- ışık (B+) ----------
  sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0xe8dfcb, 0.405 * Math.PI));
  const gunes = new THREE.DirectionalLight(0xfff3dc, 1.29 * Math.PI);
  const GUNES_YON = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(40)) * Math.cos(THREE.MathUtils.degToRad(42)), Math.sin(THREE.MathUtils.degToRad(42)), Math.cos(THREE.MathUtils.degToRad(40)) * Math.cos(THREE.MathUtils.degToRad(42))).multiplyScalar(70);
  gunes.position.copy(GUNES_YON);
  gunes.castShadow = !dusukDonanim;
  gunes.shadow.mapSize.set(2048, 2048);
  // 2B: gölge kamerası oyuncuyu izler (harita ~250 m; sabit merkezli gölge İstiklal'in ucuna yetişmiyordu)
  const d = 46;
  gunes.shadow.camera.left = -d; gunes.shadow.camera.right = d;
  gunes.shadow.camera.top = d;   gunes.shadow.camera.bottom = -d;
  gunes.shadow.camera.far = 160;
  gunes.shadow.bias = -0.0012; gunes.shadow.radius = 3;
  sahne.add(gunes, gunes.target);

  // ---------- 2B: karakter sistemi + temas gölgesi + meydan avatarları ----------
  const ks = new KarakterSistemi({ sahne, vfxAyar: { kapasite: 1500, tamSayi: 6, ortaMesafe: 14, uzakMesafe: 28 } });
  const temas = new TemasGolgeleri(sahne, new THREE.TextureLoader().load(VARLIK_KOK + "temas.png"));
  const avatarlar = new MeydanAvatarlari({ ks, temas });
  const karakterHazir = ks.yukle()
    .then(() => { avatarlar.hazirOlunca(); return true; })
    .catch((e) => { console.error("[Meydan] karakterler yuklenemedi:", e); return false; });
  // 2B §3: çevre sanat katmanı (GLB proplar + atlaslı zemin) — karakter atlası/malzemesiyle aynı; konumlar manifestten
  let cevre = null, kediler = null, kediSayisi = 8;
  const cevreHazir = karakterHazir.then(async (tamam) => {
    if (!tamam || !gb) return null;
    const yukleyici = new GLTFLoader(), proplar = {};
    await Promise.all(PROPLAR.map((ad) => yukleyici.loadAsync(VARLIK_KOK + ad + ".glb")
      .then((g) => g.scene.traverse((o) => { if (o.isMesh) proplar[ad] = o; }))
      .catch((e) => console.error("[Meydan] prop yuklenemedi:", ad, e))));
    for (const m of Object.values(proplar)) ks.cilala(m);
    cevre = cevreKur({ M: yerlesim, gb, sahne, render, proplar, hucreler: ks.hucreler, malzeme: proplar.prop_bank?.material ?? ks.malzeme, temas });
    // 2B §4: sokak kedileri her yerde (manifest kedi alanları), tek InstancedMesh, yerel; sayı oyun_ayarlari.meydan_kedi_sayisi
    if (proplar.prop_kedi) kediler = new KediSurusu({ M: yerlesim, gb, kaynak: proplar.prop_kedi, sahne, temas, sayi: kediSayisi });
    return cevre;
  }).catch((e) => { console.error("[Meydan] cevre kurulamadi:", e); return null; });

  const engeller = [];
  const binalar = [];
  // Eski dünyanın dışarıdan kullanılan parçaları (greybox'ta yok): su, dalgalar, bulutlar, köprü/zemin sorguları
  let su = null, kopruUstundeMi = () => false, zeminYuksekligi = () => 0;
  const dalgalar = [], bulutlar = [];
  const gb = yerlesim
    ? yerlesimKur({ sahne, manifest: yerlesim, tt, turnuvaAlt: () => tt("günde {0} turnuva", { 0: turnuvaSaatleri().length }) })
    : null;
  if (gb) { engeller.push(...gb.engeller); binalar.push(...gb.binalar); }
  // 2B: greybox kimlik etiketleri canlıda kapalı; ?etiket=1 ile açılır (yerleşim konuşmaları için)
  if (gb) gb.etiketGoster(new URLSearchParams(window.location.search).has("etiket"));
  if (!gb) {   // ======== PAKET 13 DÜNYASI (manifest yoksa) — içerik değişmedi, girinti bilerek korunuyor ========

  // ---------- zemin: çim ----------
  const cim = new THREE.Mesh(new THREE.CircleGeometry(92, 64), mat(0x86ce6b));
  cim.rotation.x = -Math.PI / 2; cim.receiveShadow = true; sahne.add(cim);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 60;
    const yama = new THREE.Mesh(
      new THREE.CircleGeometry(2.5 + Math.random() * 4.5, 16),
      mat(Math.random() < 0.5 ? 0x7cc462 : 0x93d677)
    );
    yama.rotation.x = -Math.PI / 2;
    yama.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    yama.receiveShadow = true; sahne.add(yama);
  }

  // ---------- meydan: kaldırım taşı ----------
  const meydan = new THREE.Mesh(new THREE.CylinderGeometry(MEYDAN_R, MEYDAN_R, 0.35, 64), mat(0xe8dfcb));
  meydan.position.y = 0.17; meydan.receiveShadow = true; sahne.add(meydan);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(MEYDAN_R, 0.45, 8, 64), mat(0xc9bc9e));
  halka.rotation.x = Math.PI / 2; halka.position.y = 0.3; halka.castShadow = true; sahne.add(halka);
  for (let k = 0; k < 24; k++) {
    const ac = (k / 24) * Math.PI * 2;
    const cizgi = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, MEYDAN_R - HAVUZ_YARICAP - 1), mat(0xd6cbb2));
    const cr = (MEYDAN_R + HAVUZ_YARICAP) / 2;
    cizgi.position.set(Math.cos(ac) * cr, 0.36, Math.sin(ac) * cr);
    cizgi.rotation.y = -ac; sahne.add(cizgi);
  }
  for (let rr = HAVUZ_YARICAP + 2; rr <= MEYDAN_R - 1; rr += 3) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.1, 6, 48), mat(0xd6cbb2));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.36; sahne.add(ring);
  }

  // ---------- göl (Paket 13; eskiden çeşme) ----------
  // Sütun, heykel ve su jetleri kalktı: köprü tam ortadan geçiyor.
  // Su taş meydanın ÜSTÜNE çizilir (y 0,40 > taş 0,35): göl meydana gömülü durur.
  const havuz = new THREE.Group(); sahne.add(havuz);
  const kenarlik = new THREE.Mesh(new THREE.TorusGeometry(HAVUZ_YARICAP, 0.5, 10, 72), mat(0xdcd1b8));
  kenarlik.rotation.x = Math.PI / 2; kenarlik.position.y = 0.45; kenarlik.castShadow = true; havuz.add(kenarlik);
  const suMat = new THREE.MeshLambertMaterial({ color: 0x4fc3e8, transparent: true, opacity: 0.88 });
  su = new THREE.Mesh(new THREE.CircleGeometry(HAVUZ_YARICAP - 0.3, 72), suMat);
  su.rotation.x = -Math.PI / 2; su.position.y = 0.4; havuz.add(su);
  for (let i = 0; i < 3; i++) {
    const dm = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 6, 30), suMat.clone());
    dm.rotation.x = Math.PI / 2; dm.position.set((i - 1) * 7, 0.44, (i % 2 ? -1 : 1) * 5);
    havuz.add(dm); dalgalar.push({ m: dm, f: i / 3 });
  }

  // ---------- köprü ----------
  /** Köprü ayak izinde mi (x boyunca, gölün üstünden)? */
  kopruUstundeMi = function (x, z) {
    return Math.abs(x) <= KOPRU.L && Math.abs(z) <= KOPRU.W / 2;
  };
  /** Kemerin (x) noktasındaki yüksekliği; ayak izi dışında 0. */
  function kemer(x) { return Math.max(0, KOPRU.H * (1 - (x / KOPRU.L) ** 2)); }
  /**
   * Zemin yüksekliği: köprüdeyse kemer, değilse 0. TEK KAYNAK — avatar y,
   * çarpışma ve ağ paketi buna bakar. (Zıplama yüksekliği bunun üstüne eklenir.)
   */
  zeminYuksekligi = function (x, z) { return kopruUstundeMi(x, z) ? kemer(x) : 0; };
  {
    const kopru = new THREE.Group(); sahne.add(kopru);
    const guverteMat = mat(0xe3d9c2), korkulukMat = mat(0xc9bc9e), ayakMat = mat(0xd6cbb2);
    const PARCA = 26, adim = (KOPRU.L * 2) / PARCA;
    for (let i = 0; i < PARCA; i++) {
      const x0 = -KOPRU.L + adim * i, x1 = x0 + adim, xm = (x0 + x1) / 2;
      const y0 = kemer(x0), y1 = kemer(x1);
      const egim = Math.atan2(y1 - y0, adim), boy = Math.hypot(adim, y1 - y0) + 0.06;
      const g = new THREE.Mesh(new THREE.BoxGeometry(boy, 0.32, KOPRU.W), guverteMat);
      g.position.set(xm, 0.35 + (y0 + y1) / 2 - 0.16, 0);
      g.rotation.z = egim; g.castShadow = true; g.receiveShadow = true; kopru.add(g);
      // Korkuluk: iki yanda üst ray + her iki parçada bir dikme
      for (const sg of [-1, 1]) {
        const ray = new THREE.Mesh(new THREE.BoxGeometry(boy, 0.12, 0.12), korkulukMat);
        ray.position.set(xm, 0.35 + (y0 + y1) / 2 + 1.0, sg * (KOPRU.W / 2 - 0.12));
        ray.rotation.z = egim; ray.castShadow = true; kopru.add(ray);
        if (i % 2 === 0) {
          const dikme = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.14), korkulukMat);
          dikme.position.set(x0 + 0.1, 0.35 + kemer(x0 + 0.1) + 0.5, sg * (KOPRU.W / 2 - 0.12));
          dikme.castShadow = true; kopru.add(dikme);
        }
      }
    }
    for (const px of [-7.5, 7.5]) {
      const ayak = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.35 + kemer(px), 12), ayakMat);
      ayak.position.set(px, (0.35 + kemer(px)) / 2, 0); ayak.castShadow = true; kopru.add(ayak);
    }
  }

  // ---------- ağaç ----------
  function agac(x, z, olcek, tip) {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 2.6, 8), mat(0x9a6b43));
    govde.position.y = 1.3; govde.castShadow = true; g.add(govde);
    if (tip === 0) {
      const renkler = [0x4ea85c, 0x5cbb68, 0x45994f];
      for (let i = 0; i < 3; i++) {
        const y = new THREE.Mesh(new THREE.SphereGeometry(1.7 - i * 0.32, 12, 10), mat(renkler[i]));
        y.position.set((Math.random() - 0.5) * 0.7, 3 + i * 1.0, (Math.random() - 0.5) * 0.7);
        y.castShadow = true; g.add(y);
      }
    } else {
      const koni = new THREE.Mesh(new THREE.ConeGeometry(1.75, 3.4, 10), mat(0x3e9a58));
      koni.position.y = 4.0; koni.castShadow = true; g.add(koni);
      const koni2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 10), mat(0x4cae63));
      koni2.position.y = 5.4; koni2.castShadow = true; g.add(koni2);
    }
    g.position.set(x, 0, z); g.scale.setScalar(olcek);
    sahne.add(g);
    engeller.push({ x, z, r: 0.9 * olcek });
  }

  // ---------- bina ----------
  function bina(cfg) {
    const g = new THREE.Group();
    const w = cfg.w || 9, h = cfg.h || 7, dp = cfg.d || 8;

    const govde = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat(cfg.duvar));
    govde.position.y = h / 2; govde.castShadow = true; govde.receiveShadow = true; g.add(govde);

    const taban = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.6, dp + 0.7), mat(0xe8dfcb));
    taban.position.y = 0.3; taban.castShadow = true; g.add(taban);

    const cati = new THREE.Mesh(new THREE.ConeGeometry(w * 0.86, 3.4, 4), mat(cfg.cati));
    cati.position.y = h + 1.7; cati.rotation.y = Math.PI / 4; cati.castShadow = true; g.add(cati);
    const tepelik = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(0xffc53d));
    tepelik.position.y = h + 3.6; tepelik.castShadow = true; g.add(tepelik);

    const kapi = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.4, 0.3), mat(0x8a5a36));
    kapi.position.set(0, 1.7, dp / 2 + 0.12); g.add(kapi);
    const kemer = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.3, 16, 1, false, 0, Math.PI), mat(0x8a5a36)
    );
    kemer.rotation.x = Math.PI / 2; kemer.position.set(0, 3.4, dp / 2 + 0.12); g.add(kemer);

    for (let sg = -1; sg <= 1; sg += 2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.22), mat(0xbfe8ff));
      p.position.set(sg * (w / 2 - 1.8), 4.4, dp / 2 + 0.1); g.add(p);
      const cerceve = new THREE.Mesh(new THREE.BoxGeometry(2.25, 2.25, 0.16), mat(0xffffff));
      cerceve.position.set(sg * (w / 2 - 1.8), 4.4, dp / 2 + 0.06); g.add(cerceve);
    }

    const lv = levha(cfg.ad, cfg.duvarHex);
    lv.position.set(0, h + 5.4, 0);
    g.add(lv);

    for (let s2 = -1; s2 <= 1; s2 += 2) {
      const saksi = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 10), mat(0xe07b4f));
      saksi.position.set(s2 * 2.2, 0.9, dp / 2 + 0.8); saksi.castShadow = true; g.add(saksi);
      const cicek = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), mat(0x5cbb68));
      cicek.position.set(s2 * 2.2, 1.6, dp / 2 + 0.8); cicek.castShadow = true; g.add(cicek);
    }

    g.position.set(cfg.x, 0, cfg.z);
    g.rotation.y = Math.atan2(-cfg.x, -cfg.z); // kapı meydana baksın
    sahne.add(g);

    engeller.push({ x: cfg.x, z: cfg.z, r: Math.max(w, dp) * 0.62 });

    // TURNUVA BİNASI: kapı açılınca ışıyan halka + geri sayım levhası.
    // Normalde ikisi de görünmez; kapiAc() açar (bkz. turnuvaKapisi).
    let isima = null, sayacLevha = null;
    if (cfg.rota === "/turnuva") {
      isima = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(w, dp) * 0.72, 0.22, 10, 40),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85 })
      );
      isima.rotation.x = Math.PI / 2;
      isima.position.y = 0.35;
      isima.visible = false;
      g.add(isima);
    }

    binalar.push({
      // alt null ise turnuva binası: saatler ayar tablosundan gelir
      ad: cfg.ad,
      alt: cfg.alt ?? tt("günde {0} turnuva", { 0: turnuvaSaatleri().length }),
      rota: cfg.rota, x: cfg.x, z: cfg.z, g,
      isima, sayacLevha, yukseklik: h,
    });
  }

  BINALAR.forEach((b, i) => {
    const a = (i / BINALAR.length) * Math.PI * 2 - Math.PI / 2;
    bina({
      ad: b.ad, alt: b.alt, rota: b.rota,
      duvar: parseInt(b.duvar.slice(1), 16), cati: parseInt(b.cati.slice(1), 16), duvarHex: b.duvar,
      x: Math.cos(a) * YARICAP, z: Math.sin(a) * YARICAP,
      w: 9.5, h: 7, d: 8.5,
    });
    const uz = YARICAP - MEYDAN_R + 2;
    const yol = new THREE.Mesh(new THREE.PlaneGeometry(3.4, uz + 4), mat(0xe8dfcb));
    yol.rotation.x = -Math.PI / 2; yol.rotation.z = -a;
    yol.position.set(Math.cos(a) * (MEYDAN_R + uz / 2 - 2), 0.06, Math.sin(a) * (MEYDAN_R + uz / 2 - 2));
    yol.receiveShadow = true; sahne.add(yol);
  });

  // ---------- banklar + lambalar ----------
  function bank(x, z, ac) {
    const g = new THREE.Group();
    const otur = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 1.1), mat(0xb07a4a));
    otur.position.y = 0.85; otur.castShadow = true; g.add(otur);
    const sirt = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.2), mat(0xb07a4a));
    sirt.position.set(0, 1.4, -0.45); sirt.castShadow = true; g.add(sirt);
    for (let sg = -1; sg <= 1; sg += 2) {
      const ay = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.9), mat(0x7c8896));
      ay.position.set(sg * 1.35, 0.43, 0); ay.castShadow = true; g.add(ay);
    }
    g.position.set(x, 0, z); g.rotation.y = ac; sahne.add(g);
    engeller.push({ x, z, r: 1.6 });
  }
  function lamba(x, z) {
    const g = new THREE.Group();
    const dir = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 5, 10), mat(0x46525f));
    dir.position.y = 2.5; dir.castShadow = true; g.add(dir);
    const fen = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff0b8 }));
    fen.position.y = 5.2; g.add(fen);
    const sap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 10), mat(0x46525f));
    sap.position.y = 5.75; g.add(sap);
    g.position.set(x, 0, z); sahne.add(g);
    engeller.push({ x, z, r: 0.6 });
  }
  // Paket 13: iç halka bank 12,5 → 20 (30°'den başlar: 0°/180° köprü uçlarının
  // önü — ölçüldü, bank girişi kapatıyordu), lamba 15,6 → 24. Büyüyen dış alan için ikinci halka bank
  // (36), lamba (37) ve çiçek tarhı (28) — hepsi bina/ağaç açılarından uzak.
  for (let b = 0; b < 6; b++) {
    const ba = (b / 6) * Math.PI * 2 + Math.PI / 6;
    bank(Math.cos(ba) * 20, Math.sin(ba) * 20, -ba + Math.PI / 2);
  }
  for (let b = 0; b < 6; b++) {
    const ba = (b / 6) * Math.PI * 2 + Math.PI / 12;
    bank(Math.cos(ba) * 36, Math.sin(ba) * 36, -ba + Math.PI / 2);
  }
  for (let l = 0; l < 8; l++) {
    const la = (l / 8) * Math.PI * 2 + Math.PI / 8;
    lamba(Math.cos(la) * 24, Math.sin(la) * 24);
    lamba(Math.cos(la) * 37, Math.sin(la) * 37);
  }
  function cicekTarhi(x, z) {
    const g = new THREE.Group();
    const taban = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.4, 12), mat(0xb07a4a));
    taban.position.y = 0.2; taban.castShadow = true; g.add(taban);
    const renkler = [0xff5b4a, 0xffb020, 0xec4899, 0xa855f7, 0xffffff];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, r = i === 0 ? 0 : 0.7;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(renkler[i % renkler.length]));
      c.position.set(Math.cos(a) * r, 0.62, Math.sin(a) * r); g.add(c);
    }
    g.position.set(x, 0, z); sahne.add(g);
    engeller.push({ x, z, r: 1.3 });
  }
  for (let c = 0; c < 5; c++) {
    const ca = (c / 5) * Math.PI * 2 + Math.PI / 10;
    cicekTarhi(Math.cos(ca) * 28, Math.sin(ca) * 28);
  }

  // ağaçlar — meydan çevresindeki 7 ağaç sabit; dış ağaç/çalı sayısı düşük
  // donanımda yarıya iner (referans: 26 ağaç, 34 çalı)
  for (let t = 0; t < 7; t++) {
    const ta = (t / 7) * Math.PI * 2 + Math.PI / 7;
    agac(Math.cos(ta) * 31, Math.sin(ta) * 31, 1, t % 2);
  }
  const disAgac = dusukDonanim ? 13 : 26;
  for (let t2 = 0; t2 < disAgac; t2++) {
    const a2 = Math.random() * Math.PI * 2, r2 = 50 + Math.random() * 36;
    agac(Math.cos(a2) * r2, Math.sin(a2) * r2, 0.85 + Math.random() * 0.5, Math.round(Math.random()));
  }
  const caliSayisi = dusukDonanim ? 17 : 34;
  for (let c2 = 0; c2 < caliSayisi; c2++) {
    const ca = Math.random() * Math.PI * 2, cr = 30 + Math.random() * 58;
    const cal = new THREE.Mesh(new THREE.SphereGeometry(0.75 + Math.random() * 0.6, 10, 8), mat(0x57b063));
    cal.position.set(Math.cos(ca) * cr, 0.5, Math.sin(ca) * cr);
    cal.castShadow = true; sahne.add(cal);
  }

  // bulutlar
  for (let bl = 0; bl < 9; bl++) {
    const bg = new THREE.Group();
    for (let p2 = 0; p2 < 4; p2++) {
      const pf = new THREE.Mesh(
        new THREE.SphereGeometry(2.2 + Math.random() * 1.6, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
      );
      pf.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 3);
      bg.add(pf);
    }
    const bla = Math.random() * Math.PI * 2, blr = 60 + Math.random() * 45;
    bg.position.set(Math.cos(bla) * blr, 22 + Math.random() * 9, Math.sin(bla) * blr);
    bg.userData.hiz = 0.3 + Math.random() * 0.4;
    sahne.add(bg); bulutlar.push(bg);
  }
  }   // ======== /PAKET 13 DÜNYASI ========

  // ---------- avatar ----------
  /**
   * @param {string} ad
   * @param {number} govdeRenk  hex sayı
   * @param {number} sacRenk    hex sayı
   * @param {string} etiketRenk css rengi
   */
  /**
   * Avatar kurar. ÇİZİM karakterGorsel.js'te — /gorunum sayfasındaki
   * önizleme ile aynı SVG üreticisini kullanır, iki çizim yolu yok.
   *
   * @param {string} ad
   * @param {number} govdeRenk  geriye uyum; 2B karakterde kullanılmaz
   * @param {number} sacRenk    geriye uyum; 2B karakterde kullanılmaz
   * @param {string} etiketRenk
   * @param {object} gorunum    profiles.gorunum
   * @param {object} esyaBilgi  geriye uyum; 3B eşya katalogu (kullanılmaz)
   */
  // 2B: yeni GLB karakter (karakter/meydanAvatar.js). govdeRenk/sacRenk/esyaBilgi geriye uyum için imzada kaldı.
  // secenek: { bot, tohum } — bot görünümü tohumdan (tür dahil) çizilir; gerçek oyuncu profiles.gorunum'dan.
  function avatarOlustur(ad, govdeRenk, sacRenk, etiketRenk, gorunum = null, esyaBilgi = {}, secenek = {}) {
    const g = avatarlar.kur({ ad, gorunum, etiketRenk, tohum: secenek.tohum ?? null, bot: Boolean(secenek.bot), katman: secenek.katman ?? null });
    sahne.add(g);
    return g;
  }

  /** Kıyafet değişimi — sahne yıkılmadan: yalnız gövde yeniden kurulur. */
  function avatarGorunumu(av, gorunum, esyaBilgi = {}) {
    if (av?.userData?.yeniKarakter) { avatarlar.gorunumDegistir(av, gorunum); return; }
    karakterGorunumDegistir(av, gorunum);
  }

  /**
   * Avatarın isim etiketini sahneyi yıkmadan değiştirir.
   * Profil geç gelirse avatar önce "Oyuncu" adıyla kurulur, ad gelince
   * yalnız etiket yenilenir — sahne ayakta kalır.
   */
  function avatarAdiDegistir(g, ad, etiketRenk) {
    const u = g?.userData;
    if (!u || !u.etiket || u.ad === ad) return;
    const eski = u.etiket;
    const yeni = isimEtiketi(ad, etiketRenk);
    yeni.position.copy(eski.position);
    yeni.scale.copy(eski.scale);   // 2B: yeni karakterin küçültülmüş etiketi
    g.remove(eski);
    eski.material.map?.dispose();
    eski.material.dispose();
    g.add(yeni);
    u.etiket = yeni;
    u.ad = ad;
  }

  /**
   * Avatarı sahneden kaldırıp GPU kaynaklarını bırakır.
   * Doku REFERANS SAYILIR: aynı görünümü kullanan başka oyuncu kaldıysa
   * doku ayakta kalır, son kullanan çıkınca dispose edilir
   * (bkz. karakterGorsel.js).
   */
  function avatarSil(g) {
    if (g?.userData?.yeniKarakter) { avatarlar.sil(g); return; }
    sahne.remove(g);
    karakterYokEt(g);
  }

  /**
   * Yürüme animasyonu: guc 0..1 (0 = duruyor).
   * @param {number} [zipla] zıplama yüksekliği (0 = yerde). Yüksekliği
   *   ziplama.js hesaplar; burası yalnız uygular — modeller değişse de
   *   zıplama mantığı yerinde kalsın diye (bkz. ziplama.js başlığı).
   */
  function yurumeAnimasyonu(av, dt, guc, zipla = 0, zemin = 0) {
    const u = av.userData;
    // Dans sürerken yürüme animasyonu çalışmaz. Oyuncu yürümeye başlarsa
    // dans kesilir (uzak oyuncuda da: hareket hız paketlerinden anlaşılır).
    if (u.dans) {
      if (guc > 0.05 || zipla > 0) dansiDurdur(av);
      else if (dansKaresi(av, dt)) { return; }
    }
    // 3B GÖVDE: yürüme/bekleme/zıplama duruşunu iskelet üzerinden
    // meydan-model.js veriyor (bacak, diz, kol eklemleri). Aşağıdaki
    // billboard salınımı 2B sprite içindi, 3B modelde karşılığı yok.
    if (u.yeniKarakter) { avatarlar.yuru(av, dt, guc, zipla, zemin); return; }   // 2B: GLB klipleri (Idle/Walk/Run)
    if (u.gercek3d) { meydanModelYuru(av, dt, guc, zipla, zemin); return; }
    // ZIPLARKEN YÜRÜME KESİLİR: bacaklar hafif toplanır, sprite "idle"a
    // döner, adım salınımı hiç işlemez.
    if (zipla > 0) {
      u.bacaklar.children[0].rotation.x = -0.35;
      u.bacaklar.children[1].rotation.x = -0.2;
      u.kollar.rotation.x = -0.5;
      av.position.y = zemin + zipla;
      karakterPozGuncelle(av, false);
      karakterYonGuncelle(av, kamera);
      return;
    }
    u.yurumeFaz += dt * (guc > 0.05 ? guc * 10 : 2);
    const sal = Math.sin(u.yurumeFaz) * (guc > 0.05 ? 0.5 : 0.04);
    u.bacaklar.children[0].rotation.x = sal;
    u.bacaklar.children[1].rotation.x = -sal;
    u.kollar.rotation.x = -sal * 0.55;
    av.position.y = zemin + (guc > 0.05 ? Math.abs(Math.sin(u.yurumeFaz)) * 0.09 : 0);
    // BILLBOARD: yürürken run1/run2, dururken idle; bakış yönü kameraya göre.
    karakterPozGuncelle(av, guc > 0.05);
    karakterYonGuncelle(av, kamera);
    // 3B eşya efektleri (parıltı halkası, yıldız) 2B karakterde yok;
    // avatarEfektleriGuncelle çağrısı bu yüzden kalktı (avatar.js duruyor).
  }

  /** Yumuşak dönüş — en kısa yaydan hedef açıya. */
  // `hiz` VARSAYILANLI: eksik verilince `dt * undefined = NaN` oluyor,
  // rotation.y NaN'a dönüp modelin bütün dünya matrisi bozuluyordu —
  // avatar sahnede "var" ama hiç çizilmiyordu (14 Eyl 2026, meydan botları).
  function yumusakDon(av, hedefAci, dt, hiz = 8) {
    if (!Number.isFinite(av.rotation.y)) av.rotation.y = 0;
    const fark = ((hedefAci - av.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    av.rotation.y += fark * Math.min(1, dt * hiz);
  }

  // ---------- emoji balonu ----------
  const balonlar = [];
  function emojiGoster(hedefAvatar, karakter) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const x = c.getContext("2d");
    x.font = "96px serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(karakter, 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: canvasDoku(c), depthTest: false, depthWrite: false, transparent: true,
    }));
    sp.scale.set(2.2, 2.2, 1);
    sp.position.copy(hedefAvatar.position);
    const balonY = hedefAvatar.userData?.balonY ?? 4.8;   // 2B: yeni karakter 1,83 m (eski gövde ~4 m)
    sp.position.y = hedefAvatar.position.y + balonY;
    sahne.add(sp);
    balonlar.push({ s: sp, t: 0, y0: sp.position.y });
  }

  // ---------- çarpışma ----------
  function carpismaDuzelt(poz, yaricap) {
    if (gb) { gb.carpismaDuzelt(poz, yaricap); return; }   // 2A: parsel ayak izleri (yönlü kutu) + manifest sınırı
    for (let i = 0; i < engeller.length; i++) {
      const e = engeller[i];
      const dx = poz.x - e.x, dz = poz.z - e.z;
      const uz = Math.hypot(dx, dz), min = e.r + yaricap;
      if (uz < min && uz > 0.0001) {
        poz.x = e.x + (dx / uz) * min;
        poz.z = e.z + (dz / uz) * min;
      }
    }
    // KÖPRÜ KORKULUĞU (Paket 13): köprü boyunca yandan çıkılmaz/girilmez.
    // Korkuluk şeridine düşen nokta hangi tarafa yakınsa oraya itilir.
    const koprude = Math.abs(poz.x) <= KOPRU.L;
    const ic = KOPRU.W / 2 - 0.35, dis = KOPRU.W / 2 + 0.7;
    if (koprude) {
      const az = Math.abs(poz.z);
      if (az > ic && az < dis) poz.z = (poz.z < 0 ? -1 : 1) * (az - ic < dis - az ? ic : dis);
    }
    const guvertede = koprude && Math.abs(poz.z) <= ic;
    const d0 = Math.hypot(poz.x, poz.z);
    // Göle girilmez — güverte hariç (üstünden geçilir).
    const kiyi = HAVUZ_YARICAP + 0.5;
    if (d0 < kiyi && d0 > 0.0001 && !guvertede) { poz.x = (poz.x / d0) * kiyi; poz.z = (poz.z / d0) * kiyi; }
    if (d0 > HARITA_SINIRI) { poz.x = (poz.x / d0) * HARITA_SINIRI; poz.z = (poz.z / d0) * HARITA_SINIRI; }
  }

  /** En yakın binayı döndürür (8 birim içinde), yoksa null. */
  /**
   * Turnuva kapısı: turnuvadan önce kupa binası ışımaya başlar ve üstünde
   * geri sayım belirir. `metin` null verilirse kapı kapanır.
   *
   * Levha canvas sprite olduğu için her saniye YENİDEN ÜRETİLMEZ; yalnız
   * metin değişince (saniyede bir) doku yenilenir.
   */
  let sonSayacMetni = null;
  function turnuvaKapisi(metin) {
    const b = binalar.find((x) => x.rota === "/turnuva");
    if (!b) return;
    const acik = Boolean(metin);
    if (b.isima) b.isima.visible = acik;

    if (!acik) {
      if (b.sayacLevha) {
        b.g.remove(b.sayacLevha);
        b.sayacLevha.material.map?.dispose();
        b.sayacLevha.material.dispose();
        b.sayacLevha = null;
      }
      sonSayacMetni = null;
      return;
    }
    if (metin === sonSayacMetni) return;
    sonSayacMetni = metin;
    if (b.sayacLevha) {
      b.g.remove(b.sayacLevha);
      b.sayacLevha.material.map?.dispose();
      b.sayacLevha.material.dispose();
    }
    const lv = levha(metin, "#7C3AED");
    lv.position.set(0, b.yukseklik + 7.2, 0);
    lv.scale.set(6.2, 1.55, 1);
    b.g.add(lv);
    b.sayacLevha = lv;
  }

  function yakinBina(poz) {
    if (gb) return gb.yakinBina(poz);   // 2A: kapı önü noktasından 5 m
    let yakin = null, enYakin = 8;
    for (const b of binalar) {
      const u = Math.hypot(poz.x - b.x, poz.z - b.z);
      if (u < enYakin) { enYakin = u; yakin = b; }
    }
    return yakin;
  }

  // ---------- süs animasyonları + kamera ----------
  //
  // ZUM: kamera oyuncunun arkasında SABİT bir ofsette duruyordu. Artık ofset
  // "zum" ile ölçekleniyor. Dikey bileşen yataydan HIZLI büyüsün diye ayrı
  // üsler kullanılıyor: uzaklaştıkça açı da dikleşir, en uçta gerçek bir kuş
  // bakışı olur. Yaklaşınca kamera omuz hizasına iner.
  const ZUM_EN_AZ = 0.55, ZUM_EN_COK = 3.0;
  const ZUM_ANAHTARI = "bildim_harita_zum";
  let zum = 1;
  try {
    const k = Number(localStorage.getItem(ZUM_ANAHTARI));
    if (Number.isFinite(k) && k > 0) zum = Math.min(ZUM_EN_COK, Math.max(ZUM_EN_AZ, k));
  } catch { /* özel mod */ }
  let zumHedef = zum;

  function zumAyarla(v) {
    if (!Number.isFinite(v)) return zumHedef;
    zumHedef = Math.min(ZUM_EN_COK, Math.max(ZUM_EN_AZ, v));
    try { localStorage.setItem(ZUM_ANAHTARI, String(zumHedef)); } catch { /* özel mod */ }
    return zumHedef;
  }
  /** Çarpanla zumlar (parmak arası / tekerlek / düğme hepsi bunu kullanır). */
  function zumla(carpan) { return zumAyarla(zumHedef * carpan); }
  function zumOku() { return { zum: zumHedef, enAz: ZUM_EN_AZ, enCok: ZUM_EN_COK }; }

  const kamHedef = new THREE.Vector3();
  let kameraSabit = null;   // { konum:[x,y,z], hedef:[x,y,z] } | null
  kamera.position.set(-13, 17, 28);

  /** Her karede çağrılır: su, jetler, balonlar, bulutlar, kamera. */
  function guncelle(dt, zaman, ben) {
    // Turnuva binasının ışıma halkası nabız atsın (kapı açıkken).
    // BURADA olmalı: `zaman` yalnız bu fonksiyonun parametresi. Bir ara
    // yanlışlıkla yakinBina() içine girmişti; yakinBina her karede
    // çağrıldığı için çizim döngüsü ilk karede ReferenceError ile
    // patlıyor ve ekranda "Meydan açılamadı" çıkıyordu.
    for (const b of binalar) {
      if (!b.isima || !b.isima.visible) continue;
      b.isima.material.opacity = 0.55 + Math.sin(zaman * 3.2) * 0.3;
      b.isima.scale.setScalar(1 + Math.sin(zaman * 3.2) * 0.04);
    }

    if (!hareketAzalt && su) {
      su.position.y = 0.4 + Math.sin(zaman * 1.6) * 0.02;
      for (const dl of dalgalar) {
        const f = ((zaman / 3.4) + dl.f) % 1;
        dl.m.scale.setScalar(1 + f * 3.2);
        dl.m.material.opacity = 0.5 * (1 - f);
      }
      for (const b of bulutlar) {
        b.position.x += dt * b.userData.hiz;
        if (b.position.x > 125) b.position.x = -125;
      }
    }

    for (let i = balonlar.length - 1; i >= 0; i--) {
      const bl = balonlar[i];
      bl.t += dt;
      bl.s.position.y = (bl.y0 ?? 4.8) + bl.t * 1.1;
      bl.s.material.opacity = Math.max(0, 1 - bl.t / 2.2);
      if (bl.t > 2.2) {
        sahne.remove(bl.s);
        bl.s.material.map.dispose(); bl.s.material.dispose();
        balonlar.splice(i, 1);
      }
    }

    // Zum yumuşak oturur: düğmeye basınca kamera zıplamasın.
    zum += (zumHedef - zum) * Math.min(1, dt * (hareketAzalt ? 60 : 7));
    const yatay = Math.pow(zum, 0.8);    // uzaklık
    const dikey = Math.pow(zum, 1.25);   // yükseklik (daha hızlı → kuş bakışı)
    if (kameraSabit) {   // 2A ölçüm/görüntü: sabit kamera (oyun kamerası değil; yalnız ?harita=taksim hata ayıklama API'si)
      kamera.position.set(...kameraSabit.konum); kamera.lookAt(...kameraSabit.hedef);
    } else {
    kamHedef.set(ben.position.x - 13 * yatay, 17 * dikey + ben.position.y * 0.6, ben.position.z + 17 * yatay);
    // Hareket azaltmada kamera yumuşatmadan doğrudan takip eder
    kamera.position.lerp(kamHedef, hareketAzalt ? 1 : Math.min(1, dt * 3.2));
    kamera.lookAt(ben.position.x, ben.position.y * 0.6 + 2.2 * Math.min(1, zum), ben.position.z);
    }

    // 2B: karakter karesi (animasyon, göz kırpma, süzülme, VFX) → dans/ikram vekilleri kemiklere → temas gölgeleri
    try { ks.kare(dt, zaman, kamera); avatarlar.vekilleriUygula(); } catch (e) { console.error("[Meydan] karakter karesi:", e); }
    kediler?.guncelle(dt, zaman);
    temas.guncelle();
    gunes.target.position.set(ben.position.x, 0, ben.position.z);
    gunes.position.copy(gunes.target.position).add(GUNES_YON);

    render.render(sahne, kamera);
  }

  function boyutlandir() {
    W = kapsayici.clientWidth || window.innerWidth;
    H = kapsayici.clientHeight || window.innerHeight;
    kamera.aspect = W / H;
    kamera.fov = fov();          // yön değişince görüş açısı da güncellenir
    kamera.updateProjectionMatrix();
    render.setSize(W, H);
  }

  /** Her şeyi serbest bırakır — sayfa kapanınca sızıntı kalmasın. */
  function yokEt() {
    for (const bl of balonlar) { bl.s.material.map.dispose(); bl.s.material.dispose(); }
    balonlar.length = 0;
    try { avatarlar.temizle(); } catch (e) { console.error("[Meydan] avatar temizle:", e); }
    nesneyiSerbestBirak(sahne);
    sahne.clear();
    // Eşya geometrileri/malzemeleri avatarlar arasında paylaşılıyordu;
    // sahne kapanınca burada bırakılır (bkz. esyalar.js).
    esyaOnbelleginiTemizle();
    // Karakter dokuları da oyuncular arasında paylaşılıyor: meydandan çıkıp
    // girince avatar çoğalmasın, bellek büyümesin (bkz. karakterGorsel.js).
    karakterDokulariniTemizle();
    render.dispose();
    render.forceContextLoss?.();
    if (render.domElement.parentNode) render.domElement.parentNode.removeChild(render.domElement);
  }

  // ---- Avatar seçimi (dokunulan oyuncu) ----
  // Görsel katmanın tek katkısı: ekran koordinatını avatara çevirmek.
  // Menünün ne yaptığı ve coin işleri etkilesim.js'te.
  const _isin = new THREE.Raycaster();
  const _nokta = new THREE.Vector2();

  /**
   * Ekrandaki noktada avatar var mı?
   * @param {number} nx -1..1 (yatay), @param {number} ny -1..1 (dikey)
   * @param {THREE.Object3D[]} adaylar tıklanabilir avatar kökleri
   * @returns {THREE.Object3D|null}
   */
  function avatarSec(nx, ny, adaylar) {
    if (!adaylar || adaylar.length === 0) return null;
    _nokta.set(nx, ny);
    _isin.setFromCamera(_nokta, kamera);
    const kesisen = _isin.intersectObjects(adaylar, true);
    if (kesisen.length === 0) return null;
    let n = kesisen[0].object;
    const kume = new Set(adaylar);
    while (n && !kume.has(n)) n = n.parent;
    return n ?? null;
  }

  /**
   * Ekrandaki noktada GÖL suyu var mı? Olta atmak için (Aşama 2).
   * @returns {{x:number,z:number}|null} su yüzeyindeki nokta
   */
  function suSec(nx, ny) {
    if (!su) return null;   // 2A greybox: göl yok (donduruldu)
    _nokta.set(nx, ny);
    _isin.setFromCamera(_nokta, kamera);
    const k = _isin.intersectObject(su, false);
    if (!k.length) return null;
    const p = k[0].point;
    if (Math.hypot(p.x, p.z) > HAVUZ_YARICAP - 0.6) return null;
    return { x: p.x, z: p.z };
  }

  return {
    sahne, kamera, render, engeller, binalar, kopru: gb ? null : KOPRU,
    // 2A: manifest dünyası bilgisi (yoksa null) — doğuş noktası, nokta sorgusu, etiket aç/kapa, özet sayılar
    yerlesim: gb ? { dogus: gb.dogus, nokta: gb.nokta, etiketGoster: gb.etiketGoster, ozet: gb.ozet, sinirIcinde: gb.sinirIcinde, manifest: yerlesim } : null,
    kameraSabitle: (o) => { kameraSabit = o && o.konum && o.hedef ? o : null; },
    avatarOlustur, avatarSil, avatarAdiDegistir, avatarGorunumu, yurumeAnimasyonu, yumusakDon,
    emojiGoster, carpismaDuzelt, zeminYuksekligi, kopruUstundeMi, suSec, yakinBina, turnuvaKapisi, avatarSec,
    dansEttir: (av, kod) => dansBaslat(av, kod),
    // 2B: tam karakter sayısı (oyun_ayarlari.meydan_uc_boyutlu_sinir) · karakter sistemi hazır sözü · ölçüm için yöneticiler
    kalabalikSiniri: (n) => { if (Number.isFinite(n) && n >= 0) avatarlar.sinir = n; return avatarlar.sinir; },
    karakterHazir, karakterler: avatarlar, karakterSistemi: ks, cevreHazir, cevre: () => cevre,
    kediSayisi: (n) => { if (Number.isFinite(n)) { kediSayisi = n; kediler?.sayiAyarla(n); } return kediler?.kediler.length ?? kediSayisi; },
    kediler: () => kediler,
    zumla, zumAyarla, zumOku,
    guncelle, boyutlandir, yokEt,
  };
}
