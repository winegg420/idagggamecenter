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
  const a = gr.avatar3d && typeof gr.avatar3d === "object" ? gr.avatar3d : null;
  const h = gr.harita && typeof gr.harita === "object" ? gr.harita : null;
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
  const koz = {
    sapka: ["kep", "bere"].includes(a.bas),
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

export class MeydanAvatarlari {
  /** @param {{ ks: import("./karakter.js").KarakterSistemi, temas?: import("./temas.js").TemasGolgeleri }} o */
  constructor({ ks, temas = null }) {
    this.ks = ks; this.temas = temas;
    this.hepsi = new Set();
    this.sinir = 8;         // tam karakter sayısı (oyun_ayarlari.meydan_uc_boyutlu_sinir; 2B ölçümü)
    this.tamSayisi = 0;
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
    if (ad != null) { etiket = isimEtiketi(ad, etiketRenk); etiket.scale.multiplyScalar(ETIKET_OLCEK); etiket.position.y = ETIKET_Y; av.add(etiket); }
    av.userData = {
      kok, bacaklar, kollar, govde, kafa, etiket, ad, yurumeFaz: Math.random() * 6, gorunum: gorunum ?? {}, dans: null,
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

  sil(av) {
    const u = av?.userData; if (!u) return;
    this.hepsi.delete(av);
    this.temas?.sil(av);
    if (u.karakter) { this.ks.sil(u.karakter); if (u.tam) this.tamSayisi = Math.max(0, this.tamSayisi - 1); u.karakter = null; }
    av.removeFromParent();
    if (u.etiket) nesneyiSerbestBirak(u.etiket);
  }

  temizle() { for (const av of [...this.hepsi]) this.sil(av); this.tamSayisi = 0; }
}
