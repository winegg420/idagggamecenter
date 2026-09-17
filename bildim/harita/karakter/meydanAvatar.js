// ============================================================
// MEYDAN AVATARI — yeni GLB karakterin gerçek haritaya uyarlayıcısı (Aşama 2B §2)
//
// Oynanış kodu (HaritaSayfasi · danslar.js · ikramGorsel.js · dunya.yurumeAnimasyonu) avatarı eski biçimde bekler:
//   grup.userData = { kok, bacaklar[2], kollar[2], govde, kafa, etiket, ad, yurumeFaz, gorunum, dans }
// Bu dosya o biçimi KORUR: sarmalayıcı grup anında döner (GLB yüklenmemiş olsa bile), karakter hazır olunca `kok`
// altına takılır. Danslar/ikram vekil grupların dönüşlerini yazar; her karede bu dönüşler karakter uzayında ilgili
// KEMİĞE eklenir (kafa → Head, gövde → Spine2, kollar → Left/RightArm, bacaklar → Left/RightUpLeg).
//
// Görünüm kaynağı: profiles.gorunum. Gardırop henüz eski biçimde (`avatar3d`) kaydediyor → `profildenGorunum`
// o kaydı yeni karakterin kıyafet seti / saç / ten / renk / kozmetiğine çevirir (tür seçimi gardıropta yok → insan;
// `gorunum.harita.tur` gelirse o kullanılır). Botlar tohumdan çizilir (tür dahil).
//
// KALABALIK SINIRI (UC_BOYUTLU_SINIR yerine): ilk `sinir` karakter TAM (kozmetik + gölge + göz kırpma), sonrası HAFİF
// (kozmetiksiz, gölgesiz, kırpmasız) — aynı model, billboard yok. Sayı oyun_ayarlari.meydan_uc_boyutlu_sinir.
//
// TAÇ + PELERİN (Paket 16 §C): turnuva ödülleri. Karakter GLB'sinde bu iki kozmetik yok ve gövde/atlas/karakter.js
// değişmeyecek → burada, KARAKTER MALZEMESİYLE (aynı atlas: altin / tisort hücresi, yeni doku yok) iki küçük geometri.
// Oyuncu başına klon DEĞİL: bütün oyuncular için TEK taç + TEK pelerin InstancedMesh (oyuncu sayısından bağımsız
// sabit 2 çizim çağrısı; gölge atmaz). Her karede örnek matrisi baş/sırt yuvasından yazılır; pelerin fiziksiz
// hafif sallanır (yürüyüş hızıyla geriye açılır). Yalnız TAM karakterlerde (kozmetik kuralıyla aynı).
// Sözleşme: taç baş yuvasındadır → şapka (kep/bere) aynı anda takılmaz (gardırop kaydı da tek "bas" değeri tutar).
// ============================================================
import * as THREE from "three";
import { isimEtiketi, nesneyiSerbestBirak } from "../ortak.js";
import { TURLER, TENLER, SACLAR, USTLER, ALTLAR, AYAKLAR } from "./karakter.js";
import { YENI_USTLER } from "../../avatar3d/model.js";

const ETIKET_Y = 2.35;          // baş tepesi 1,83 m + pay
const ETIKET_OLCEK = 0.6;       // ortak isimEtiketi 3,6 × 0,9 m (eski 4 m'lik gövde için) → 2,16 × 0,54 m
const BALON_Y = 2.9;            // emoji balonu (dunya.emojiGoster userData.balonY okur)
const YURUME_ESIK = 0.05;
const KOSU_ESIK = 0.55;         // guc > 0,55 → Run klibi
const OYUNCU_HIZ = 9;           // HaritaSayfasi YURUME_HIZI ile aynı ölçek (yalnız klip hızı ve alev için)

// ---------------------------------------------------------------- profil → karakter görünümü
const karma = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const _c = new THREE.Color();
function enYakin(hex, palet, varsayilan = 0) {
  if (typeof hex !== "string" || !/^#[\da-f]{6}$/i.test(hex)) return palet[varsayilan];
  _c.set(hex); let en = palet[0], d = Infinity;
  for (const p of palet) { const x = (p.r - _c.r) ** 2 + (p.g - _c.g) ** 2 + (p.b - _c.b) ** 2; if (x < d) { d = x; en = p; } }
  return en;
}
const SET_SIK = ["ceket", "damatlik", "gomlek", "oduncu", "kot"];
const SET_SPOR = ["kapusonlu", "atlet", "crop"];
const SAC_KISA = ["yok", "kisa"];
const SAC_KUYRUK = ["atkuyruk", "topuz", "orgu"];

/**
 * profiles.gorunum → { tur, g (KarakterSistemi.gorunum girdisi), koz }.
 * @param {object|null} gorunum  profiles.gorunum ({ karakter, avatar3d, harita? })
 * @param {string} yedekTohum     görünüm kaydı yoksa kararlı varsayılan için (ad)
 */
export function profildenGorunum(gorunum, yedekTohum = "") {
  const gr = gorunum && typeof gorunum === "object" ? gorunum : {};
  const h = gr.harita && typeof gr.harita === "object" ? gr.harita : null;
  const sonuc = eskiKayittan(gr, h, yedekTohum);
  // Paket 17 §D: yeni vitrin (KarakterVitrini) kozmetiği gorunum.harita.koz'a yazar — varsa eski avatar3d kaydından
  // türetilenin YERİNE geçer (çıkarılan kozmetik de çıkmış olur). Bilinmeyen anahtar sessizce atlanır.
  if (h?.koz && typeof h.koz === "object") sonuc.koz = vitrinKozmetikleri(h.koz);
  return sonuc;
}

/** Vitrinin yazabileceği kozmetik anahtarları (vitrin_kozmetikleri tablosuyla aynı). Yeni kozmetik → buraya ekle. */
export const KOZ_ANAHTARLARI = ["sapka", "gozluk", "gozlukPremium", "atki", "kanat", "tac", "pelerin"];
export function vitrinKozmetikleri(ham) {
  const koz = {};
  for (const k of KOZ_ANAHTARLARI) {
    const v = ham?.[k];
    if (k === "pelerin") { if (v === true || v === "klasik" || v === "kisa") koz.pelerin = v === true ? "klasik" : v; }
    else if (v === true) koz[k] = true;
  }
  if (koz.tac) koz.sapka = false;                // aynı baş yuvası
  if (koz.gozlukPremium) koz.gozluk = false;     // aynı gözlük yuvası
  return koz;
}

function eskiKayittan(gr, h, yedekTohum) {
  const a = gr.avatar3d && typeof gr.avatar3d === "object" ? gr.avatar3d : null;
  const tur = TURLER.includes(h?.tur) ? h.tur : "insan";
  if (!a) return tohumdanGorunum(gr.karakter ?? yedekTohum, { tur });
  const kiyafet = String(a.kiyafet ?? (a.ceket === false ? "tisort" : "ceket"));
  const set = SET_SIK.includes(kiyafet) ? 2 : SET_SPOR.includes(kiyafet) ? 3 : 1;
  const ustHex = kiyafet === "ceket" ? a.ceketRenk : YENI_USTLER[kiyafet]?.renk ?? a.ceketRenk;
  const g = {
    set, sac: SAC_KISA.includes(a.sac) ? 2 : SAC_KUYRUK.includes(a.sac) ? 3 : 1,
    ten: enYakin(a.ten, TENLER), sacRenk: enYakin(a.sacRenk, SACLAR), ust: enYakin(ustHex, USTLER),
    alt: enYakin(a.altRenk, ALTLAR), ayak: enYakin(a.ayakkabiRenk, AYAKLAR), ceket: enYakin(a.ceketRenk, ALTLAR, 1),
    kurk: new THREE.Color(0xffffff), metal: new THREE.Color(0xdfe3e8), boya: enYakin(ustHex, USTLER),
  };
  const gozluk = String(a.gozluk ?? "yok");
  const pelerin = a.pelerin === true ? "klasik" : ["klasik", "kisa"].includes(a.pelerin) ? a.pelerin : null;
  const koz = {
    tac: a.bas === "tac", pelerin,
    sapka: a.bas !== "tac" && ["kep", "bere"].includes(a.bas),
    gozlukPremium: gozluk === "gunes" || gozluk === "spor",
    gozluk: gozluk !== "yok" && gozluk !== "gunes" && gozluk !== "spor",
  };
  return { tur, g, koz };
}

/** Tohumdan kararlı görünüm (görünüm kaydı olmayan oyuncu · bot). `tur` verilmezse tohumdan seçilir. */
export function tohumdanGorunum(tohum, { tur = null } = {}) {
  const k = karma(tohum), s = (n, kaydir) => (k >>> kaydir) % n;
  const g = {
    set: 1 + s(3, 1), sac: 1 + s(3, 3), ten: TENLER[s(4, 5)], sacRenk: SACLAR[s(4, 7)], ust: USTLER[s(USTLER.length, 9)],
    alt: ALTLAR[s(ALTLAR.length, 12)], ayak: AYAKLAR[s(AYAKLAR.length, 15)], ceket: ALTLAR[s(ALTLAR.length, 17)],
    kurk: new THREE.Color(0xffffff), metal: s(2, 20) ? new THREE.Color(0xdfe3e8) : new THREE.Color(0xf3c98b), boya: USTLER[s(USTLER.length, 22)],
  };
  const koz = { sapka: s(5, 25) < 2, gozluk: s(5, 27) === 0, gozlukPremium: s(5, 27) === 1, atki: s(4, 29) === 0 };
  return { tur: tur ?? TURLER[s(3, 0)], g, koz };
}

// ---------------------------------------------------------------- avatar yöneticisi
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
const sifirMi = (r) => r.x === 0 && r.y === 0 && r.z === 0;

// ---------------------------------------------------------------- taç + pelerin geometrisi (karakter malzemesi biçimi)
const TAC_BOLGE = 24;       // karakter.js METAL_TABLO: metal 0,9 · pürüz 0,22 (altın parlaklığı)
const PELERIN_BOLGE = 17;   // kumaş pürüzü 0,82
const PELERIN_RENK = new THREE.Color("#503b82");   // gardıroptaki pelerinle aynı ton (avatar3d/model.js capeMat)
const EK_KAPASITE = 32;
function ekGeometri(ucgenler, hucre, renk, bolge) {
  const n = ucgenler.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), c = new Float32Array(n * 4), b = new Float32Array(n).fill(bolge);
  const u = hucre ? (hucre.u0 + hucre.u1) / 2 : 0.5, v = hucre ? (hucre.v0 + hucre.v1) / 2 : 0.5;
  ucgenler.forEach((q, i) => { pos.set(q, i * 3); uv[i * 2] = u; uv[i * 2 + 1] = v; c.set([renk.r, renk.g, renk.b, 1], i * 4); });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(c, 4));
  g.setAttribute("_bolge", new THREE.BufferAttribute(b, 1));
  g.computeVertexNormals();
  return g;
}
/** Taç: 10 dilimli açık halka (dış + iç yüz) + 5 sivri diş (iki yüz). Yuva uzayı, başın üstü. 50 üçgen. */
function tacGeometrisi(H) {
  const U = [], n = 10, r0 = 0.165, r1 = 0.185, y0 = 0.045, y1 = 0.125, uc = 0.215;
  const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const dort = (a, b, c, d) => { U.push(a, b, c, a, c, d); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    dort(P(a0, r0, y0), P(a0, r1, y1), P(a1, r1, y1), P(a1, r0, y0));
    dort(P(a1, r0 - 0.012, y0), P(a1, r1 - 0.012, y1), P(a0, r1 - 0.012, y1), P(a0, r0 - 0.012, y0));
    if (i % 2 === 0) {
      const am = (a0 + a1) / 2;
      U.push(P(a0, r1, y1), P(am, r1 + 0.004, uc), P(a1, r1, y1));
      U.push(P(a1, r1 - 0.012, y1), P(am, r1 - 0.008, uc), P(a0, r1 - 0.012, y1));
    }
  }
  return ekGeometri(U, H.altin, new THREE.Color(1.45, 1.3, 1.0), TAC_BOLGE);   // altın hücresi metal ışıkta koyu kalıyordu
}
/** Pelerin: omuzdan (y = 0) aşağı 4 × 3 hafif kavisli şerit, iki yüz. Yerel -Z sırt yönü. 48 üçgen. */
function pelerinGeometrisi(H) {
  const U = [], sat = 4, sut = 3, boy = 0.98, ust = 0.46, alt = 0.64;
  const P = (i, j, kal) => {
    const t = j / sat, gen = ust + (alt - ust) * t, x = (i / sut - 0.5) * gen;
    const z = -(0.02 + 0.06 * t) - 0.05 * (1 - (2 * i / sut - 1) ** 2) - kal;
    return [x, -boy * t, z];
  };
  for (let j = 0; j < sat; j++) for (let i = 0; i < sut; i++) {
    const a = P(i, j, 0), b = P(i + 1, j, 0), c = P(i + 1, j + 1, 0), d = P(i, j + 1, 0);
    U.push(a, c, b, a, d, c);
    const a2 = P(i, j, -0.006), b2 = P(i + 1, j, -0.006), c2 = P(i + 1, j + 1, -0.006), d2 = P(i, j + 1, -0.006);
    U.push(a2, b2, c2, a2, c2, d2);
  }
  return ekGeometri(U.map((q) => q), H.tisort, PELERIN_RENK, PELERIN_BOLGE);
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _bir = new THREE.Vector3(1, 1, 1);
const PELERIN_KAYDIR = new THREE.Vector3(0, 0.52, -0.07);   // sirtYuva (0,94 m) → omuz hattı (~1,44 m)

export class MeydanAvatarlari {
  /** @param {{ ks: import("./karakter.js").KarakterSistemi, temas?: import("./temas.js").TemasGolgeleri }} o */
  constructor({ ks, temas = null }) {
    this.ks = ks; this.temas = temas;
    this.hepsi = new Set();
    this.sinir = 8;         // tam karakter sayısı (oyun_ayarlari.meydan_uc_boyutlu_sinir; 2B ölçümü)
    this.tamSayisi = 0;
    this.ek = null;         // Paket 16 §C: paylaşılan taç/pelerin InstancedMesh'leri (lazy)
  }

  /** Sarmalayıcı grup: HEMEN döner; karakter sistemi hazırsa gövde de takılır, değilse `hazirOlunca()` takar. */
  kur({ ad, gorunum = null, etiketRenk = "#20324A", tohum = null, bot = false, katman = null }) {
    const av = new THREE.Group();
    const kok = new THREE.Group(); av.add(kok);
    const bacaklar = new THREE.Group(); bacaklar.add(new THREE.Group(), new THREE.Group());
    const kollar = new THREE.Group(); kollar.add(new THREE.Group(), new THREE.Group());
    const govde = new THREE.Group(), kafa = new THREE.Group();
    kafa.position.y = 3.05;   // danslar.js taban yüksekliği (gercek3d + kafaY = 3,05 → kafa konumu kullanılmaz)
    kok.add(bacaklar, kollar, govde, kafa);
    let etiket = null;
    const cerceve = gorunum?.lig_cerceve ?? null;   // 2D-E: lig çerçevesi etiketin kenarında
    if (ad != null) { etiket = isimEtiketi(ad, etiketRenk, cerceve); etiket.scale.multiplyScalar(ETIKET_OLCEK); etiket.position.y = ETIKET_Y; av.add(etiket); }
    av.userData = {
      kok, bacaklar, kollar, govde, kafa, etiket, ad, etiketRenk, cerceve, yurumeFaz: Math.random() * 6, gorunum: gorunum ?? {}, dans: null,
      gercek3d: true, kafaY: 3.05, balonY: BALON_Y, yeniKarakter: true, bot, katman, tohum: tohum ?? ad ?? "", karakter: null, tam: false,
    };
    this.hepsi.add(av);
    this.temas?.ekle(av, 0.9);
    if (this.ks.hazir) this.#govdeTak(av);
    return av;
  }

  /** Karakter sistemi yüklenince bekleyen avatarlara gövde takar. */
  hazirOlunca() { for (const av of this.hepsi) if (!av.userData.karakter) this.#govdeTak(av); }

  #cozum(av) {
    const u = av.userData;
    if (!u.bot) return profildenGorunum(u.gorunum, u.tohum);
    // Bot türü sunucu katmanından: 0 → insan, diğerleri kaplan/robot (kimlikten). Böylece iki bot aynı türe düşmez.
    const tur = u.katman == null ? null : Number(u.katman) % 2 === 0 ? "insan" : (karma(u.tohum) % 2 ? "kaplan" : "robot");
    return tohumdanGorunum("bot|" + u.tohum, { tur });
  }

  #govdeTak(av, tamIste = null) {
    const u = av.userData;
    const { tur, g, koz } = this.#cozum(av);
    const tam = tamIste ?? this.tamSayisi < this.sinir;
    const karakter = this.ks.kur(tur, g, tam ? koz : {}, { golge: tam, kirpma: tam });
    if (!karakter) return;
    u.tac = tam && !!koz.tac;
    u.pelerin = tam ? koz.pelerin ?? null : null;
    u.yuvaBas = u.tac ? karakter.getObjectByName("basYuva") : null;
    u.yuvaSirt = u.pelerin ? karakter.getObjectByName("sirtYuva") : null;
    u.pelerinFaz = (karma(u.tohum) % 628) / 100;
    if (tam) this.tamSayisi++;
    u.tam = tam;
    karakter.userData.yonKoku = av;
    u.kok.add(karakter);
    u.karakter = karakter;
    u.kemik = {
      Head: karakter.getObjectByName("Head"), Spine2: karakter.getObjectByName("Spine2"),
      LeftArm: karakter.getObjectByName("LeftArm"), RightArm: karakter.getObjectByName("RightArm"),
      LeftUpLeg: karakter.getObjectByName("LeftUpLeg"), RightUpLeg: karakter.getObjectByName("RightUpLeg"),
    };
    this.ks.klip(karakter, "Idle");
  }

  /**
   * Sınır sonradan değişirse (ayar geç geldi / ölçüm) mevcut karakterlere de uygulanır: katılış sırasıyla ilk `n` tam,
   * gerisi hafif; yalnız durumu değişen gövdeler yeniden kurulur.
   */
  sinirAyarla(n) {
    this.sinir = n;
    let i = 0;
    for (const av of this.hepsi) {
      const u = av.userData;
      if (!u.karakter) continue;
      const iste = i++ < n;
      if (u.tam === iste) continue;
      this.ks.sil(u.karakter); u.karakter = null;
      if (u.tam) this.tamSayisi = Math.max(0, this.tamSayisi - 1);
      this.#govdeTak(av, iste);
    }
  }

  /** Kıyafet/tür değişimi: gövde yeniden kurulur (sahne yıkılmaz). */
  gorunumDegistir(av, gorunum) {
    const u = av?.userData; if (!u?.yeniKarakter) return;
    u.gorunum = gorunum ?? {};
    // 2D-E: lig çerçevesi değiştiyse yalnız etiket yenilenir
    const cerceve = u.gorunum.lig_cerceve ?? null;
    if (cerceve !== u.cerceve && u.etiket && u.ad != null) {
      const eski = u.etiket, yeni = isimEtiketi(u.ad, u.etiketRenk ?? "#20324A", cerceve);
      yeni.position.copy(eski.position); yeni.scale.copy(eski.scale);
      av.remove(eski); eski.material.map?.dispose(); eski.material.dispose();
      av.add(yeni); u.etiket = yeni;
    }
    u.cerceve = cerceve;
    if (!u.karakter) return;
    const tamdi = u.tam;
    this.ks.sil(u.karakter); u.karakter = null;
    if (tamdi) this.tamSayisi = Math.max(0, this.tamSayisi - 1);
    this.#govdeTak(av);
  }

  /** Yürüme karesi (dunya.yurumeAnimasyonu çağırır): klip seçimi, klip hızı, zıplama yüksekliği, alev hızı. */
  yuru(av, dt, guc, zipla = 0, zemin = 0) {
    const u = av.userData, k = u.karakter;
    av.position.y = zemin + zipla;
    if (!k) return;
    const yuruyor = guc > YURUME_ESIK && zipla <= 0;
    const klip = yuruyor ? (guc > KOSU_ESIK ? "Run" : "Walk") : "Idle";
    this.ks.klip(k, klip, null, { gecis: 0.18 });
    const hiz = guc * OYUNCU_HIZ;
    if (k.userData.aksiyon) k.userData.aksiyon.timeScale = klip === "Run" ? Math.min(1.8, Math.max(0.8, hiz / 5)) : klip === "Walk" ? Math.min(1.8, Math.max(0.7, hiz / 2.2)) : 1;
    k.userData.vfxHiz = yuruyor ? hiz : 0;
  }

  /** ks.kare()'den SONRA: dans/ikram vekil dönüşlerini kemiklere ekle (karakter uzayında). */
  vekilleriUygula() {
    this.#vekiller();
    this.#ekleriGuncelle();
  }

  #vekiller() {
    for (const av of this.hepsi) {
      const u = av.userData, k = u.karakter;
      if (!k || !av.parent) continue;
      const kol = u.kollar, bac = u.bacaklar;
      const esler = [
        [u.kafa.rotation, u.kemik.Head], [u.govde.rotation, u.kemik.Spine2],
        [kol.children[0].rotation, u.kemik.LeftArm, kol.rotation], [kol.children[1].rotation, u.kemik.RightArm, kol.rotation],
        [bac.children[0].rotation, u.kemik.LeftUpLeg], [bac.children[1].rotation, u.kemik.RightUpLeg],
      ];
      if (esler.every(([r, , r2]) => sifirMi(r) && (!r2 || sifirMi(r2)))) continue;
      k.updateMatrixWorld(true);
      k.getWorldQuaternion(_q3);   // karakter kökü (dans kok dönüşü dahil)
      for (const [r, kemik, r2] of esler) {
        if (!kemik || (sifirMi(r) && (!r2 || sifirMi(r2)))) continue;
        _q.setFromEuler(_e.set(r.x, r.y, r.z));
        if (r2 && !sifirMi(r2)) _q.premultiply(_q2.setFromEuler(_e.set(r2.x, r2.y, r2.z)));
        // karakter uzayındaki dönüş → dünya: R · d · R⁻¹ ; yeni dünya = o · kemikDünya ; yerel = ebeveynDünya⁻¹ · yeni
        const dunyaD = _q3.clone().multiply(_q).multiply(_q3.clone().invert());
        const yeni = dunyaD.multiply(kemik.getWorldQuaternion(_q2));
        kemik.quaternion.copy(kemik.parent.getWorldQuaternion(_q2).invert().multiply(yeni));
        kemik.updateMatrixWorld(true);
      }
    }
  }

  /** Paylaşılan taç/pelerin örnekleri (lazy; karakter sistemi hazır olunca). Kapasite dolarsa iki katına çıkar. */
  #ekler(gerek) {
    if (!this.ks.hazir || !this.ks.malzeme) return null;
    if (this.ek && this.ek.kapasite >= gerek) return this.ek;
    const kapasite = Math.max(EK_KAPASITE, this.ek ? this.ek.kapasite * 2 : 0, gerek);
    const H = this.ks.hucreler;
    const yap = (geo, ad) => {
      const m = new THREE.InstancedMesh(geo, this.ks.malzeme, kapasite);
      m.name = ad; m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.ks.sahne.add(m);
      return m;
    };
    this.#ekleriBirak();
    this.ek = { kapasite, tac: yap(tacGeometrisi(H), "MeydanTac"), pelerin: yap(pelerinGeometrisi(H), "MeydanPelerin") };
    return this.ek;
  }

  #ekleriBirak() {
    if (!this.ek) return;
    for (const m of [this.ek.tac, this.ek.pelerin]) { m.removeFromParent(); m.geometry.dispose(); m.dispose(); }
    this.ek = null;
  }

  /** Her kare (vekilleriUygula sonunda): taç baş yuvasına, pelerin sırt yuvasına; pelerin hıza göre açılır + hafif sallanır. */
  #ekleriGuncelle() {
    let tacSay = 0, pelSay = 0;
    for (const av of this.hepsi) { const u = av.userData; if (u.karakter && av.parent) { if (u.tac) tacSay++; if (u.pelerin) pelSay++; } }
    if (!tacSay && !pelSay) { if (this.ek && (this.ek.tac.count || this.ek.pelerin.count)) { this.ek.tac.count = 0; this.ek.pelerin.count = 0; } return; }
    const ek = this.#ekler(Math.max(tacSay, pelSay)); if (!ek) return;
    const zaman = performance.now() / 1000;
    let it = 0, ip = 0;
    for (const av of this.hepsi) {
      const u = av.userData, k = u.karakter;
      if (!k || !av.parent || !av.visible) continue;
      if (u.tac && u.yuvaBas) {
        u.yuvaBas.updateWorldMatrix(true, false);
        u.yuvaBas.matrixWorld.decompose(_p, _q, _s);
        ek.tac.setMatrixAt(it++, _m.compose(_p, _q, _bir));
      }
      if (u.pelerin && u.yuvaSirt) {
        u.yuvaSirt.updateWorldMatrix(true, false);
        u.yuvaSirt.matrixWorld.decompose(_p, _q, _s);
        const hiz = k.userData.vfxHiz ?? 0;
        const aci = Math.min(0.55, 0.06 + hiz * 0.05) + Math.sin(zaman * (1.6 + hiz * 0.35) + u.pelerinFaz) * (0.035 + Math.min(hiz, 9) * 0.006);
        _m.compose(_p, _q, _bir).multiply(_m2.makeTranslation(PELERIN_KAYDIR.x, PELERIN_KAYDIR.y, PELERIN_KAYDIR.z));
        _m.multiply(_m2.makeRotationX(-aci)).multiply(_m2.makeScale(1, u.pelerin === "kisa" ? 0.58 : 1, 1));
        ek.pelerin.setMatrixAt(ip++, _m);
      }
    }
    ek.tac.count = it; ek.pelerin.count = ip;
    if (it) ek.tac.instanceMatrix.needsUpdate = true;
    if (ip) ek.pelerin.instanceMatrix.needsUpdate = true;
  }

  sil(av) {
    const u = av?.userData; if (!u) return;
    this.hepsi.delete(av);
    this.temas?.sil(av);
    if (u.karakter) { this.ks.sil(u.karakter); if (u.tam) this.tamSayisi = Math.max(0, this.tamSayisi - 1); u.karakter = null; }
    av.removeFromParent();
    if (u.etiket) nesneyiSerbestBirak(u.etiket);
  }

  temizle() { for (const av of [...this.hepsi]) this.sil(av); this.tamSayisi = 0; this.#ekleriBirak(); }
}
