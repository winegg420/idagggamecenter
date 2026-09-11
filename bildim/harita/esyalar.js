// ============================================================
// AVATAR EŞYALARI — geometrik ilkellerden üretilir
//
// Dışarıdan MODEL DOSYASI İNDİRİLMEZ, satın alınmaz. Her eşya kutu, silindir,
// küre, koni ve halkadan kodla çizilir. Katalog (ad, fiyat, nadirlik) veri
// tabanındadır; buradaki tek şey her eşya KODUNUN nasıl çizileceği.
//
// ÖLÇÜ SÖZLEŞMESİ — gövde oranı sabittir, oyuncu boy/kilo seçemez.
// dunya.js'teki avatar ölçüleri referans alınmıştır:
//   bacak 1.1 (y 0.55) · gövde 1.5 (y 1.85, üst yarıçap 0.62 / alt 0.72)
//   kol y 1.95 · el y 1.36 (x ±0.78) · kafa küre r 0.66 (y 3.05)
//   saç küre r 0.69 (y 3.08) · göz y 3.08 z 0.58
// Her üretici bu ölçülere göre hizalanmış bir THREE.Group döndürür; avatara
// doğrudan eklenir, ayrıca konumlandırma gerekmez.
//
// PAYLAŞIM: aynı eşyayı birden çok kişi giyebilir. Geometriler modül düzeyinde
// bir kez üretilip önbelleğe alınır (GEO), malzemeler renk başına paylaşılır
// (MAT). Avatar sahneden çıkarken `esyalariSerbestBirak` yalnız GRUBU söker;
// paylaşılan geometri/malzeme sahne kapanınca `esyaOnbelleginiTemizle` ile
// bırakılır.
// ============================================================
import * as THREE from "three";

// ---------- paylaşılan kaynaklar ----------
const GEO = new Map();
const MAT = new Map();

function geo(anahtar, uret) {
  let g = GEO.get(anahtar);
  if (!g) { g = uret(); GEO.set(anahtar, g); }
  return g;
}

/** Renk başına tek malzeme — aynı rengi giyen herkes paylaşır. */
function mat(renk) {
  const a = "l" + renk;
  let m = MAT.get(a);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: renk }); MAT.set(a, m); }
  return m;
}

/** Saydam/parlak malzeme (efektler için). */
function matEfekt(renk) {
  const a = "e" + renk;
  let m = MAT.get(a);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.75 });
    MAT.set(a, m);
  }
  return m;
}

function parca(anahtar, uret, renk) {
  return new THREE.Mesh(geo(anahtar, uret), mat(renk));
}

/** "#RRGGBB" → 0xRRGGBB. Geçersizse yedek renk. */
export function renkSayi(metin, yedek = 0xffffff) {
  if (typeof metin !== "string") return yedek;
  const t = metin.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(t)) return yedek;
  return parseInt(t.slice(1), 16);
}

// ============================================================
// SAÇ — küre kesitleriyle üç stilize şekil
// ============================================================
function sacKisa(renk, kucuk) {
  const g = new THREE.Group();
  const r = kucuk ? 0.6 : 0.69;
  const m = new THREE.Mesh(
    geo("sac_kisa" + (kucuk ? "_k" : ""),
      () => new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    mat(renk)
  );
  m.position.y = 3.08;
  m.castShadow = true;
  g.add(m);
  return g;
}

function sacUzun(renk, kucuk) {
  const g = sacKisa(renk, kucuk);
  // Arkaya inen tutam: yassı silindir
  const tutam = parca("sac_tutam",
    () => new THREE.CylinderGeometry(0.5, 0.42, 1.1, 12, 1, true), renk);
  tutam.position.set(0, 2.55, -0.22);
  tutam.scale.set(1, 1, 0.55);
  tutam.castShadow = true;
  g.add(tutam);
  return g;
}

function sacTopuz(renk, kucuk) {
  const g = sacKisa(renk, kucuk);
  const topuz = parca("sac_topuz", () => new THREE.SphereGeometry(0.26, 12, 10), renk);
  topuz.position.set(0, 3.62, -0.12);
  topuz.castShadow = true;
  g.add(topuz);
  return g;
}

// ============================================================
// ŞAPKA — hepsi sac_kisalt: takılınca saç küçülür, içinden taşmaz
// ============================================================
function sapkaKasket(renk) {
  const g = new THREE.Group();
  const kubbe = new THREE.Mesh(
    geo("kasket_kubbe", () => new THREE.SphereGeometry(0.7, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    mat(renk)
  );
  kubbe.position.y = 3.18; kubbe.castShadow = true; g.add(kubbe);
  const siperlik = parca("kasket_siper", () => new THREE.CylinderGeometry(0.66, 0.66, 0.07, 20, 1, false, 0, Math.PI), renk);
  siperlik.position.set(0, 3.17, 0.34);
  siperlik.rotation.y = Math.PI / 2;
  siperlik.scale.set(1, 1, 0.85);
  g.add(siperlik);
  return g;
}

function sapkaSilindir(renk) {
  const g = new THREE.Group();
  const kenar = parca("sil_kenar", () => new THREE.CylinderGeometry(0.95, 0.95, 0.07, 22), renk);
  kenar.position.y = 3.36; kenar.castShadow = true; g.add(kenar);
  const govde = parca("sil_govde", () => new THREE.CylinderGeometry(0.6, 0.62, 0.9, 20), renk);
  govde.position.y = 3.82; govde.castShadow = true; g.add(govde);
  return g;
}

function sapkaBere(renk) {
  const g = new THREE.Group();
  const kap = new THREE.Mesh(
    geo("bere_kap", () => new THREE.SphereGeometry(0.72, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    mat(renk)
  );
  kap.position.y = 3.14; kap.castShadow = true; g.add(kap);
  const katlama = parca("bere_kat", () => new THREE.TorusGeometry(0.66, 0.1, 8, 24), renk);
  katlama.rotation.x = Math.PI / 2; katlama.position.y = 3.18; g.add(katlama);
  const ponpon = parca("bere_ponpon", () => new THREE.SphereGeometry(0.16, 10, 8), renk);
  ponpon.position.y = 3.86; g.add(ponpon);
  return g;
}

function sapkaTac(renk) {
  const g = new THREE.Group();
  const halka = parca("tac_halka", () => new THREE.CylinderGeometry(0.6, 0.62, 0.2, 20), renk);
  halka.position.y = 3.5; halka.castShadow = true; g.add(halka);
  // Beş uç: küçük koniler
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const uc = parca("tac_uc", () => new THREE.ConeGeometry(0.12, 0.34, 8), renk);
    uc.position.set(Math.cos(a) * 0.55, 3.74, Math.sin(a) * 0.55);
    g.add(uc);
  }
  return g;
}

// ============================================================
// GÖZLÜK
// ============================================================
function gozlukYuvarlak(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const cerceve = parca("gzl_halka", () => new THREE.TorusGeometry(0.17, 0.035, 8, 20), renk);
    cerceve.position.set(s * 0.23, 3.08, 0.58);
    g.add(cerceve);
  }
  const kopru = parca("gzl_kopru", () => new THREE.CylinderGeometry(0.028, 0.028, 0.14, 6), renk);
  kopru.rotation.z = Math.PI / 2;
  kopru.position.set(0, 3.08, 0.58);
  g.add(kopru);
  return g;
}

function gozlukGunes(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const cam = parca("gns_cam", () => new THREE.BoxGeometry(0.34, 0.24, 0.05), renk);
    cam.position.set(s * 0.24, 3.08, 0.6);
    g.add(cam);
  }
  const kopru = parca("gns_kopru", () => new THREE.BoxGeometry(0.16, 0.05, 0.05), renk);
  kopru.position.set(0, 3.12, 0.6);
  g.add(kopru);
  for (const s of [-1, 1]) {
    const sap = parca("gns_sap", () => new THREE.BoxGeometry(0.05, 0.05, 0.42), renk);
    sap.position.set(s * 0.41, 3.1, 0.42);
    g.add(sap);
  }
  return g;
}

// ============================================================
// KÜPE
// ============================================================
function kupeHalka(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const h = parca("kupe_halka", () => new THREE.TorusGeometry(0.1, 0.025, 6, 14), renk);
    h.position.set(s * 0.62, 2.92, 0.06);
    h.rotation.y = Math.PI / 2;
    g.add(h);
  }
  return g;
}

function kupeTekTas(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const t = parca("kupe_tas", () => new THREE.OctahedronGeometry(0.09), renk);
    t.position.set(s * 0.63, 2.96, 0.06);
    g.add(t);
  }
  return g;
}

// ============================================================
// ÜST — gövdenin biraz dışına giydirilir (z-fighting olmasın)
// ============================================================
function ustTisort(renk) {
  const g = new THREE.Group();
  const govde = parca("ust_tisort", () => new THREE.CylinderGeometry(0.65, 0.75, 1.5, 12), renk);
  govde.position.y = 1.85; govde.castShadow = true; g.add(govde);
  for (const s of [-1, 1]) {
    const kol = parca("ust_kolboyu", () => new THREE.CylinderGeometry(0.21, 0.19, 0.45, 8), renk);
    kol.position.set(s * 0.78, 2.3, 0);
    g.add(kol);
  }
  return g;
}

function ustCeket(renk) {
  const g = new THREE.Group();
  const govde = parca("ust_ceket", () => new THREE.CylinderGeometry(0.68, 0.79, 1.58, 12), renk);
  govde.position.y = 1.85; govde.castShadow = true; g.add(govde);
  for (const s of [-1, 1]) {
    const kol = parca("ust_ceketkol", () => new THREE.CylinderGeometry(0.22, 0.2, 1.2, 8), renk);
    kol.position.set(s * 0.79, 1.98, 0);
    kol.castShadow = true;
    g.add(kol);
  }
  // Ön açıklık: ince koyu şerit
  const yaka = parca("ust_yaka", () => new THREE.BoxGeometry(0.1, 1.5, 0.06), 0x1a1a1a);
  yaka.position.set(0, 1.85, 0.7);
  g.add(yaka);
  return g;
}

function ustKapusonlu(renk) {
  const g = ustTisort(renk);
  // Kapüşon: ensede yarım küre
  const kapuson = new THREE.Mesh(
    geo("ust_kapuson", () => new THREE.SphereGeometry(0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    mat(renk)
  );
  kapuson.position.set(0, 2.62, -0.28);
  kapuson.rotation.x = Math.PI * 0.85;
  kapuson.castShadow = true;
  g.add(kapuson);
  return g;
}

// ============================================================
// AYAKKABI — bacak altına
// ============================================================
function ayakkabiSpor(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const a = parca("ayk_spor", () => new THREE.BoxGeometry(0.34, 0.22, 0.55), renk);
    a.position.set(s * 0.28, 0.11, 0.08);
    a.castShadow = true;
    g.add(a);
  }
  return g;
}

function ayakkabiTerlik(renk) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const taban = parca("ayk_terlik", () => new THREE.BoxGeometry(0.32, 0.08, 0.5), renk);
    taban.position.set(s * 0.28, 0.04, 0.06);
    g.add(taban);
    const bant = parca("ayk_bant", () => new THREE.BoxGeometry(0.3, 0.07, 0.1), renk);
    bant.position.set(s * 0.28, 0.12, 0.16);
    g.add(bant);
  }
  return g;
}

// ============================================================
// EFEKT — sahne döngüsünde döndürülür (userData.doner)
// ============================================================
function efektParilti(renk) {
  const g = new THREE.Group();
  const halka = new THREE.Mesh(
    geo("efk_halka", () => new THREE.TorusGeometry(1.05, 0.055, 8, 36)),
    matEfekt(renk)
  );
  halka.rotation.x = Math.PI / 2;
  halka.position.y = 0.12;
  g.add(halka);
  g.userData.doner = 1.2;   // rad/sn
  return g;
}

function efektYildizlar(renk) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const y = new THREE.Mesh(geo("efk_yildiz", () => new THREE.OctahedronGeometry(0.13)), matEfekt(renk));
    y.position.set(Math.cos(a) * 0.95, 3.95 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.95);
    g.add(y);
  }
  g.userData.doner = -0.9;
  return g;
}

// ============================================================
// ÜRETİCİ TABLOSU — katalogdaki `kod` ile eşleşir
// Yeni eşya eklemek: DB'ye satır + buraya bir üretici.
// ============================================================
export const URETICILER = {
  sac_01: (renk, s) => sacKisa(renk, s?.sacKisalt),
  sac_02: (renk, s) => sacUzun(renk, s?.sacKisalt),
  sac_03: (renk, s) => sacTopuz(renk, s?.sacKisalt),

  spk_01: (renk) => sapkaKasket(renk),
  spk_02: (renk) => sapkaSilindir(renk),
  spk_03: (renk) => sapkaBere(renk),
  spk_04: (renk) => sapkaTac(renk),

  gzl_01: (renk) => gozlukYuvarlak(renk),
  gzl_02: (renk) => gozlukGunes(renk),

  kup_01: (renk) => kupeHalka(renk),
  kup_02: (renk) => kupeTekTas(renk),

  ust_01: (renk) => ustTisort(renk),
  ust_02: (renk) => ustCeket(renk),
  ust_03: (renk) => ustKapusonlu(renk),

  ayk_01: (renk) => ayakkabiSpor(renk),
  ayk_02: (renk) => ayakkabiTerlik(renk),

  efk_01: (renk) => efektParilti(renk),
  efk_02: (renk) => efektYildizlar(renk),
};

/** Katalog satırlarından kod → varsayılan renk / sac_kisalt tablosu. */
export function esyaBilgisi(katalog) {
  const t = {};
  for (const e of katalog ?? []) {
    t[e.kod] = {
      yuva: e.yuva,
      varsayilanRenk: e.varsayilan_renk,
      boyanabilir: Boolean(e.boyanabilir),
      sacKisalt: Boolean(e.sac_kisalt),
    };
  }
  return t;
}

/**
 * Görünüm kaydından eşya gruplarını üretir.
 *
 * @param {object} gorunum  profiles.gorunum
 * @param {object} bilgi    esyaBilgisi(katalog) çıktısı (yoksa varsayılanlar)
 * @returns {THREE.Group[]} avatara eklenecek gruplar
 */
export function gorunumParcalari(gorunum, bilgi = {}) {
  const g = gorunum ?? {};
  const parcalar = [];
  // Şapka saçı kısaltır: saç şapkanın içinden taşmasın.
  const sapkaKod = g.sapka;
  const sacKisalt = Boolean(sapkaKod && (bilgi[sapkaKod]?.sacKisalt ?? true));

  const ekle = (kod, renkAlani, yedekRenk) => {
    if (!kod) return;
    const uret = URETICILER[kod];
    if (!uret) return;            // katalogda var, üreticisi yok: sessizce atla
    const b = bilgi[kod] ?? {};
    const renk = renkSayi(
      (renkAlani && g[renkAlani]) || b.varsayilanRenk || yedekRenk,
      renkSayi(yedekRenk, 0xcccccc)
    );
    try {
      const p = uret(renk, { sacKisalt });
      p.userData.esyaKod = kod;
      parcalar.push(p);
    } catch (e) {
      console.error("[Meydan] esya uretilemedi:", kod, e);
    }
  };

  ekle(g.sac, "sac_renk", "#5A3A22");
  ekle(g.ust, "ust_renk", "#F4701F");
  ekle(g.alt, null, "#2B3A55");
  ekle(g.ayakkabi, null, "#FFFFFF");
  ekle(g.sapka, null, "#2F6FB0");
  ekle(g.gozluk, null, "#3E4A5C");
  ekle(g.kupe, null, "#FFC53D");
  ekle(g.efekt, null, "#FFC53D");
  return parcalar;
}

/**
 * Avatardan eşyaları söker. Geometri ve malzeme PAYLAŞILDIĞI için burada
 * dispose EDİLMEZ — sahne kapanınca `esyaOnbelleginiTemizle` çağrılır.
 */
export function esyalariSerbestBirak(avatar) {
  // Eşyalar gövde köküne eklenir (bkz. avatar.js); kök yoksa eski yapı.
  const kok = avatar?.userData?.kok ?? avatar;
  const liste = (kok?.children ?? []).filter((c) => c.userData?.esyaKod);
  for (const p of liste) kok.remove(p);
}

/** Sahne kapanırken paylaşılan geometri/malzemeleri bırakır. */
export function esyaOnbelleginiTemizle() {
  for (const g of GEO.values()) { try { g.dispose(); } catch { /* yut */ } }
  GEO.clear();
  for (const m of MAT.values()) { try { m.dispose(); } catch { /* yut */ } }
  MAT.clear();
}
