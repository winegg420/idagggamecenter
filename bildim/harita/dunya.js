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
import { avatarKur, avatarGorunumDegistir, avatarEfektleriGuncelle, avatarYokEt } from "./avatar.js";
import { esyaBilgisi, esyaOnbelleginiTemizle } from "./esyalar.js";
export { esyaBilgisi };

// roundRect / canvasDoku / isimEtiketi / nesneyiSerbestBirak ORTAK.JS'e taşındı:
// Görünüm sayfasındaki önizleme de aynı avatarı çiziyor, iki kopya olmamalı.
export { nesneyiSerbestBirak };

const YARICAP = 30; // binaların meydan merkezine uzaklığı
const HAVUZ_YARICAP = 6.6;
const HARITA_SINIRI = 58;

/** Bina listesi — renkler mevcut mod renkleriyle aynı, değiştirme. */
export const BINALAR = [
  { ad: "Meydan Oku", alt: "1v1 düello",        duvar: "#FF5B4A", cati: "#C03225", rota: "/meydan" },
  { ad: "Hızlı Mod",  alt: "60 saniye",         duvar: "#FFB020", cati: "#C98A22", rota: "/hizli-mod" },
  { ad: "Grup Maçı",  alt: "3-5 kişi",          duvar: "#4A9DD9", cati: "#2B6BA3", rota: "/meydan" },
  { ad: "Turnuva",    alt: "her gece 21.00",    duvar: "#A855F7", cati: "#6D21B0", rota: "/turnuva" },
  { ad: "Dükkân",     alt: "joker ve paketler", duvar: "#EC4899", cati: "#A81B62", rota: "/joker" },
  { ad: "Lig",        alt: "haftalık sıralama", duvar: "#2FBF71", cati: "#137A45", rota: "/siralama" },
  { ad: "Hatalarım",  alt: "çalışma odası",     duvar: "#20A4A0", cati: "#0F6B68", rota: "/calisma" },
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
 * @param {object} s  { dusukDonanim:boolean, hareketAzalt:boolean }
 */
export function dunyaKur(kapsayici, s = {}) {
  const dusukDonanim = Boolean(s.dusukDonanim);
  const hareketAzalt = Boolean(s.hareketAzalt);

  let W = kapsayici.clientWidth || window.innerWidth;
  let H = kapsayici.clientHeight || window.innerHeight;

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0xbfe8ff);
  sahne.fog = new THREE.Fog(0xcdeeff, 60, 135);

  const kamera = new THREE.PerspectiveCamera(42, W / H, 0.5, 400);
  const render = new THREE.WebGLRenderer({ antialias: !dusukDonanim, powerPreference: "high-performance" });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.setSize(W, H);
  render.shadowMap.enabled = !dusukDonanim; // düşük donanımda gölge kapalı
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  kapsayici.appendChild(render.domElement);

  // ---------- ışık ----------
  sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0x8fbf7a, 0.95 * Math.PI));
  const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
  gunes.position.set(28, 46, 20);
  gunes.castShadow = !dusukDonanim;
  gunes.shadow.mapSize.set(2048, 2048);
  const d = 62;
  gunes.shadow.camera.left = -d; gunes.shadow.camera.right = d;
  gunes.shadow.camera.top = d;   gunes.shadow.camera.bottom = -d;
  gunes.shadow.camera.far = 140;
  gunes.shadow.bias = -0.0012;
  sahne.add(gunes);

  const engeller = [];
  const binalar = [];

  // ---------- zemin: çim ----------
  const cim = new THREE.Mesh(new THREE.CircleGeometry(66, 64), mat(0x86ce6b));
  cim.rotation.x = -Math.PI / 2; cim.receiveShadow = true; sahne.add(cim);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 42;
    const yama = new THREE.Mesh(
      new THREE.CircleGeometry(2.5 + Math.random() * 4.5, 16),
      mat(Math.random() < 0.5 ? 0x7cc462 : 0x93d677)
    );
    yama.rotation.x = -Math.PI / 2;
    yama.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    yama.receiveShadow = true; sahne.add(yama);
  }

  // ---------- meydan: kaldırım taşı ----------
  const meydan = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 0.35, 64), mat(0xe8dfcb));
  meydan.position.y = 0.17; meydan.receiveShadow = true; sahne.add(meydan);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(17, 0.45, 8, 64), mat(0xc9bc9e));
  halka.rotation.x = Math.PI / 2; halka.position.y = 0.3; halka.castShadow = true; sahne.add(halka);
  for (let k = 0; k < 24; k++) {
    const ac = (k / 24) * Math.PI * 2;
    const cizgi = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 11), mat(0xd6cbb2));
    cizgi.position.set(Math.cos(ac) * 11.2, 0.36, Math.sin(ac) * 11.2);
    cizgi.rotation.y = -ac; sahne.add(cizgi);
  }
  for (let rr = 6; rr <= 15; rr += 3) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.1, 6, 48), mat(0xd6cbb2));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.36; sahne.add(ring);
  }

  // ---------- havuz ----------
  const havuz = new THREE.Group(); sahne.add(havuz);
  const kaide = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.9, 1.1, 32), mat(0xf0e8d6));
  kaide.position.y = 0.7; kaide.castShadow = true; kaide.receiveShadow = true; havuz.add(kaide);
  const kenarlik = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.45, 10, 40), mat(0xdcd1b8));
  kenarlik.rotation.x = Math.PI / 2; kenarlik.position.y = 1.25; kenarlik.castShadow = true; havuz.add(kenarlik);
  const suMat = new THREE.MeshLambertMaterial({ color: 0x4fc3e8, transparent: true, opacity: 0.88 });
  const su = new THREE.Mesh(new THREE.CircleGeometry(5.15, 40), suMat);
  su.rotation.x = -Math.PI / 2; su.position.y = 1.24; havuz.add(su);
  const sutun = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 2.6, 16), mat(0xf0e8d6));
  sutun.position.y = 2.5; sutun.castShadow = true; havuz.add(sutun);
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.4, 28), mat(0xf0e8d6));
  tas.position.y = 3.9; tas.castShadow = true; havuz.add(tas);
  const tepe = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), mat(0xffc53d));
  tepe.position.y = 4.6; tepe.castShadow = true; havuz.add(tepe);
  const jetler = [];
  for (let j = 0; j < 8; j++) {
    const jm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), suMat);
    havuz.add(jm); jetler.push({ m: jm, f: Math.random(), a: (j / 8) * Math.PI * 2 });
  }
  const dalgaMat = suMat.clone();
  const dalga = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 6, 30), dalgaMat);
  dalga.rotation.x = Math.PI / 2; dalga.position.y = 1.28; havuz.add(dalga);

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
    binalar.push({ ad: cfg.ad, alt: cfg.alt, rota: cfg.rota, x: cfg.x, z: cfg.z, g });
  }

  BINALAR.forEach((b, i) => {
    const a = (i / BINALAR.length) * Math.PI * 2 - Math.PI / 2;
    bina({
      ad: b.ad, alt: b.alt, rota: b.rota,
      duvar: parseInt(b.duvar.slice(1), 16), cati: parseInt(b.cati.slice(1), 16), duvarHex: b.duvar,
      x: Math.cos(a) * YARICAP, z: Math.sin(a) * YARICAP,
      w: 9.5, h: 7, d: 8.5,
    });
    const uz = YARICAP - 17 + 2;
    const yol = new THREE.Mesh(new THREE.PlaneGeometry(3.4, uz + 4), mat(0xe8dfcb));
    yol.rotation.x = -Math.PI / 2; yol.rotation.z = -a;
    yol.position.set(Math.cos(a) * (17 + uz / 2 - 2), 0.06, Math.sin(a) * (17 + uz / 2 - 2));
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
  for (let b = 0; b < 6; b++) {
    const ba = (b / 6) * Math.PI * 2 + Math.PI / 6;
    bank(Math.cos(ba) * 12.5, Math.sin(ba) * 12.5, -ba + Math.PI / 2);
  }
  for (let l = 0; l < 8; l++) {
    const la = (l / 8) * Math.PI * 2 + Math.PI / 8;
    lamba(Math.cos(la) * 15.6, Math.sin(la) * 15.6);
  }

  // ağaçlar — meydan çevresindeki 7 ağaç sabit; dış ağaç/çalı sayısı düşük
  // donanımda yarıya iner (referans: 26 ağaç, 34 çalı)
  for (let t = 0; t < 7; t++) {
    const ta = (t / 7) * Math.PI * 2 + Math.PI / 7;
    agac(Math.cos(ta) * 21, Math.sin(ta) * 21, 1, t % 2);
  }
  const disAgac = dusukDonanim ? 13 : 26;
  for (let t2 = 0; t2 < disAgac; t2++) {
    const a2 = Math.random() * Math.PI * 2, r2 = 36 + Math.random() * 24;
    agac(Math.cos(a2) * r2, Math.sin(a2) * r2, 0.85 + Math.random() * 0.5, Math.round(Math.random()));
  }
  const caliSayisi = dusukDonanim ? 17 : 34;
  for (let c2 = 0; c2 < caliSayisi; c2++) {
    const ca = Math.random() * Math.PI * 2, cr = 20 + Math.random() * 40;
    const cal = new THREE.Mesh(new THREE.SphereGeometry(0.75 + Math.random() * 0.6, 10, 8), mat(0x57b063));
    cal.position.set(Math.cos(ca) * cr, 0.5, Math.sin(ca) * cr);
    cal.castShadow = true; sahne.add(cal);
  }

  // bulutlar
  const bulutlar = [];
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
    const bla = Math.random() * Math.PI * 2, blr = 45 + Math.random() * 30;
    bg.position.set(Math.cos(bla) * blr, 22 + Math.random() * 9, Math.sin(bla) * blr);
    bg.userData.hiz = 0.3 + Math.random() * 0.4;
    sahne.add(bg); bulutlar.push(bg);
  }

  // ---------- avatar ----------
  /**
   * @param {string} ad
   * @param {number} govdeRenk  hex sayı
   * @param {number} sacRenk    hex sayı
   * @param {string} etiketRenk css rengi
   */
  /**
   * Avatar kurar. GÖVDE VE EŞYALAR avatar.js'te — Görünüm sayfasındaki
   * önizleme de aynı fonksiyonu çağırır, iki çizim yolu yok.
   *
   * @param {string} ad
   * @param {number} govdeRenk  görünüm kaydı yoksa kullanılacak gövde rengi
   * @param {number} sacRenk    geriye uyum; görünüm kaydı varsa yok sayılır
   * @param {string} etiketRenk
   * @param {object} gorunum    profiles.gorunum
   * @param {object} esyaBilgi  esyaBilgisi(katalog)
   */
  function avatarOlustur(ad, govdeRenk, sacRenk, etiketRenk, gorunum = null, esyaBilgi = {}) {
    // Görünüm kaydı yoksa eski davranış: düz gövde + basit saç.
    const gor = gorunum ?? {
      sac: "sac_01",
      sac_renk: "#" + Number(sacRenk ?? 0x5a3a22).toString(16).padStart(6, "0"),
    };
    const g = avatarKur({ ad, gorunum: gor, bilgi: esyaBilgi, etiketRenk, govdeRenk });
    sahne.add(g);
    return g;
  }

  /** Kıyafet değişimi — sahne yıkılmadan (bkz. avatar.js). */
  function avatarGorunumu(av, gorunum, esyaBilgi = {}) {
    avatarGorunumDegistir(av, gorunum, esyaBilgi);
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
    g.remove(eski);
    eski.material.map?.dispose();
    eski.material.dispose();
    g.add(yeni);
    u.etiket = yeni;
    u.ad = ad;
  }

  /**
   * Avatarı sahneden kaldırıp GPU kaynaklarını bırakır.
   * Eşya geometrileri PAYLAŞILDIĞI için onlar burada dispose EDİLMEZ;
   * sahne kapanınca esyaOnbelleginiTemizle() bırakır (bkz. yokEt).
   */
  function avatarSil(g) {
    sahne.remove(g);
    avatarYokEt(g);
  }

  /** Yürüme animasyonu: guc 0..1 (0 = duruyor). */
  function yurumeAnimasyonu(av, dt, guc) {
    const u = av.userData;
    u.yurumeFaz += dt * (guc > 0.05 ? guc * 10 : 2);
    const sal = Math.sin(u.yurumeFaz) * (guc > 0.05 ? 0.5 : 0.04);
    u.bacaklar.children[0].rotation.x = sal;
    u.bacaklar.children[1].rotation.x = -sal;
    u.kollar.rotation.x = -sal * 0.55;
    av.position.y = guc > 0.05 ? Math.abs(Math.sin(u.yurumeFaz)) * 0.09 : 0;
    // Parıltı halkası / yıldızlar gibi efektler dönsün (bkz. avatar.js)
    avatarEfektleriGuncelle(av, dt);
  }

  /** Yumuşak dönüş — en kısa yaydan hedef açıya. */
  function yumusakDon(av, hedefAci, dt, hiz) {
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
    sp.position.y = 4.8;
    sahne.add(sp);
    balonlar.push({ s: sp, t: 0 });
  }

  // ---------- çarpışma ----------
  function carpismaDuzelt(poz, yaricap) {
    for (let i = 0; i < engeller.length; i++) {
      const e = engeller[i];
      const dx = poz.x - e.x, dz = poz.z - e.z;
      const uz = Math.hypot(dx, dz), min = e.r + yaricap;
      if (uz < min && uz > 0.0001) {
        poz.x = e.x + (dx / uz) * min;
        poz.z = e.z + (dz / uz) * min;
      }
    }
    const d0 = Math.hypot(poz.x, poz.z);
    if (d0 < HAVUZ_YARICAP && d0 > 0.0001) { poz.x = (poz.x / d0) * HAVUZ_YARICAP; poz.z = (poz.z / d0) * HAVUZ_YARICAP; }
    if (d0 > HARITA_SINIRI) { poz.x = (poz.x / d0) * HARITA_SINIRI; poz.z = (poz.z / d0) * HARITA_SINIRI; }
  }

  /** En yakın binayı döndürür (8 birim içinde), yoksa null. */
  function yakinBina(poz) {
    let yakin = null, enYakin = 8;
    for (const b of binalar) {
      const u = Math.hypot(poz.x - b.x, poz.z - b.z);
      if (u < enYakin) { enYakin = u; yakin = b; }
    }
    return yakin;
  }

  // ---------- süs animasyonları + kamera ----------
  const kamHedef = new THREE.Vector3();
  kamera.position.set(-13, 17, 28);

  /** Her karede çağrılır: su, jetler, balonlar, bulutlar, kamera. */
  function guncelle(dt, zaman, ben) {
    if (!hareketAzalt) {
      su.position.y = 1.24 + Math.sin(zaman * 1.6) * 0.03;
      dalga.scale.setScalar(1 + ((zaman % 2.2) / 2.2) * 2.6);
      dalgaMat.opacity = 0.55 * (1 - (zaman % 2.2) / 2.2);
      for (const o of jetler) {
        o.f += dt * 0.85;
        if (o.f > 1) o.f -= 1;
        const h = Math.sin(o.f * Math.PI);
        o.m.position.set(Math.cos(o.a) * (0.5 + o.f * 2.0), 4.4 + h * 1.5 - o.f * 1.2, Math.sin(o.a) * (0.5 + o.f * 2.0));
        o.m.scale.setScalar(0.7 + h * 0.6);
      }
      tepe.rotation.y += dt * 0.8;
      for (const b of bulutlar) {
        b.position.x += dt * b.userData.hiz;
        if (b.position.x > 90) b.position.x = -90;
      }
    }

    for (let i = balonlar.length - 1; i >= 0; i--) {
      const bl = balonlar[i];
      bl.t += dt;
      bl.s.position.y = 4.8 + bl.t * 1.1;
      bl.s.material.opacity = Math.max(0, 1 - bl.t / 2.2);
      if (bl.t > 2.2) {
        sahne.remove(bl.s);
        bl.s.material.map.dispose(); bl.s.material.dispose();
        balonlar.splice(i, 1);
      }
    }

    kamHedef.set(ben.position.x - 13, 17, ben.position.z + 17);
    // Hareket azaltmada kamera yumuşatmadan doğrudan takip eder
    kamera.position.lerp(kamHedef, hareketAzalt ? 1 : Math.min(1, dt * 3.2));
    kamera.lookAt(ben.position.x, 2.2, ben.position.z);

    render.render(sahne, kamera);
  }

  function boyutlandir() {
    W = kapsayici.clientWidth || window.innerWidth;
    H = kapsayici.clientHeight || window.innerHeight;
    kamera.aspect = W / H; kamera.updateProjectionMatrix();
    render.setSize(W, H);
  }

  /** Her şeyi serbest bırakır — sayfa kapanınca sızıntı kalmasın. */
  function yokEt() {
    for (const bl of balonlar) { bl.s.material.map.dispose(); bl.s.material.dispose(); }
    balonlar.length = 0;
    nesneyiSerbestBirak(sahne);
    sahne.clear();
    // Eşya geometrileri/malzemeleri avatarlar arasında paylaşılıyordu;
    // sahne kapanınca burada bırakılır (bkz. esyalar.js).
    esyaOnbelleginiTemizle();
    render.dispose();
    render.forceContextLoss?.();
    if (render.domElement.parentNode) render.domElement.parentNode.removeChild(render.domElement);
  }

  return {
    sahne, kamera, render, engeller, binalar,
    avatarOlustur, avatarSil, avatarAdiDegistir, avatarGorunumu, yurumeAnimasyonu, yumusakDon,
    emojiGoster, carpismaDuzelt, yakinBina,
    guncelle, boyutlandir, yokEt,
  };
}
