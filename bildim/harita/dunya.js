// ============================================================
// MEYDAN (The Square) — DÜNYA (saf three.js, React yok)
//
// AŞAMA 2B: tek harita Taksim — dünya yerlesim.json manifestinden kurulur (yerlesimDunya.js + cevre.js);
// Paket 13'ün prosedürel dünyası (göl, köprü, 7 bina, ilkel ağaç/bank/lamba) kaldırıldı. Burada: ışık,
// karakterler (karakter/), emoji balonu, çarpışma ve kamera takibi.
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
import { esyaBilgisi, esyaOnbelleginiTemizle } from "./esyalar.js";
import { dansBaslat, dansKaresi, dansiDurdur } from "./danslar.js";
import { turnuvaSaatleri } from "../lib/zaman.js";
import { tt } from "../lib/dil.js";
// AŞAMA 2A/2B: dünya yerleşim manifestinden (yerlesim.json) kurulur — konumlar koda gömülü değil.
import { yerlesimKur } from "./yerlesimDunya.js";
import taksimYerlesim from "./yerlesim.json";
// AŞAMA 2B: haritadaki bütün karakterler (kendi oyuncu, uzaktakiler, botlar) yeni GLB karakter — ortak modülden
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { KarakterSistemi, VARLIK_KOK } from "./karakter/karakter.js";
import { MeydanAvatarlari } from "./karakter/meydanAvatar.js";
import { TemasGolgeleri } from "./karakter/temas.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cevreKur, PROPLAR, KediSurusu, binalariBoya } from "./cevre.js";
import { olcumSayaciKur } from "./olcumSayaci.js";
export { esyaBilgisi };

// roundRect / canvasDoku / isimEtiketi / nesneyiSerbestBirak ORTAK.JS'e taşındı:
// Görünüm sayfasındaki önizleme de aynı avatarı çiziyor, iki kopya olmamalı.
export { nesneyiSerbestBirak };


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

// 2B §4D: girilebilir dükkân renkleri — BINALAR paleti AYNEN (CLAUDE.md: değiştirme). Paletinde karşılığı olmayan iki mod
// (Stüdyo, Ayarlar) için ayrı renk: marka turuncusu ve nötr arduvaz. Normal Maç → eski "Grup Maçı" (maç binası), Düello → "Meydan Oku" (1v1).
const paletRenk = (ad) => { const b = BINALAR.find((x) => x.duvar && x.ad === tt(ad)); return b ? { duvar: b.duvar, cati: b.cati } : null; };
const MOD_RENK = {
  "/": paletRenk("Grup Maçı"), "/hizli-mod": paletRenk("Hızlı Mod"), "/duello": paletRenk("Meydan Oku"), "/turnuva": paletRenk("Turnuva"),
  "/siralama": paletRenk("Lig"), "/calisma": paletRenk("Hatalarım"), "/joker": paletRenk("Dükkân"),
  "/gorunum": { duvar: "#F4701F", cati: "#C4581A" }, "/profil": { duvar: "#8A8C96", cati: "#5E606A" },
};




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
 *   yerlesim: yerleşim manifesti; verilmezse Taksim (yerlesim.json). Ölçüm sayfaları kendi kopyasını verebilir.
 */
export function dunyaKur(kapsayici, s = {}) {
  const dusukDonanim = Boolean(s.dusukDonanim);
  const hareketAzalt = Boolean(s.hareketAzalt);
  const yerlesim = s.yerlesim ?? taksimYerlesim;

  let W = kapsayici.clientWidth || window.innerWidth;
  let H = kapsayici.clientHeight || window.innerHeight;

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0xbfe8ff);
  // Greybox gerçek ölçekte ~250 m + arka plan kuşağı (Boğaz ~300 m): sis ve uzak kırpma oraya kadar açılır
  sahne.fog = new THREE.Fog(0xcdeeff, 260, 780);

  // GÖRÜŞ AÇISI: dikeyde 42°, yatayda 48°. Telefon yan çevrilince ekran
  // alçalıyor ve sahne dar bir şeritten bakılıyormuş gibi görünüyordu.
  const fov = () => (W > H ? 48 : 42);
  const kamera = new THREE.PerspectiveCamera(fov(), W / H, 0.5, 1000);
  const render = new THREE.WebGLRenderer({ antialias: !dusukDonanim, powerPreference: "high-performance" });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.setSize(W, H);
  render.shadowMap.enabled = !dusukDonanim; // düşük donanımda gölge kapalı
  // 2B: laboratuvarın B+ ışığı (Aşama 1C §7) — karakter/çevre malzemesi (atlas + bölge cilası) buna göre ayarlı
  render.shadowMap.type = THREE.PCFShadowMap;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.08;
  kapsayici.appendChild(render.domElement);
  const olcum = olcumSayaciKur(render);   // 2C-A: ?olcum=1 göstergesinin verisi
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
    if (!tamam) return null;
    const yukleyici = new GLTFLoader(), proplar = {};
    await Promise.all(PROPLAR.map((ad) => yukleyici.loadAsync(VARLIK_KOK + ad + ".glb")
      .then((g) => g.scene.traverse((o) => { if (o.isMesh) proplar[ad] = o; }))
      .catch((e) => console.error("[Meydan] prop yuklenemedi:", ad, e))));
    for (const m of Object.values(proplar)) ks.cilala(m);
    cevre = cevreKur({ M: yerlesim, gb, sahne, render, proplar, hucreler: ks.hucreler, malzeme: proplar.prop_bank?.material ?? ks.malzeme, temas });
    // 2B §4D: binaları boya (geçici renkli kütle; ayak izleri aynı) + mod renkli levhalar çatının üstünde
    try {
      const boya = binalariBoya({ M: yerlesim, gb, hucreler: ks.hucreler, malzeme: proplar.prop_bank?.material ?? ks.malzeme, modRenk: (rota) => MOD_RENK[rota] ?? null });
      cevre.grup.add(boya.bina); if (boya.arkaplan) cevre.grup.add(boya.arkaplan);
      cevre.binaRenkleri = boya.renkler;
      for (const b of binalar) {
        const r = MOD_RENK[b.rota]; if (!r || !b.g) continue;
        for (const c of [...b.g.children]) if (c.isSprite) { b.g.remove(c); c.material.map?.dispose(); c.material.dispose(); }
        const lv = levha(b.ad, r.duvar); lv.position.set(0, b.yukseklik + 1.9, 0); lv.scale.set(5.4, 1.35, 1); b.g.add(lv);
      }
    } catch (e) { console.error("[Meydan] binalar boyanamadi:", e); }
    // 2B §4: sokak kedileri her yerde (manifest kedi alanları), tek InstancedMesh, yerel; sayı oyun_ayarlari.meydan_kedi_sayisi
    if (proplar.prop_kedi) kediler = new KediSurusu({ M: yerlesim, gb, kaynak: proplar.prop_kedi, sahne, temas, sayi: kediSayisi });
    return cevre;
  }).catch((e) => { console.error("[Meydan] cevre kurulamadi:", e); return null; });

  const engeller = [];
  const binalar = [];
  // Zemin düz (köprü kalktı); imza oynanış kodu için korunuyor — ziplama/ağ paketi yüksekliği zemin + zıplama taşır
  const zeminYuksekligi = () => 0;
  const gb = yerlesimKur({ sahne, manifest: yerlesim, tt, turnuvaAlt: () => tt("günde {0} turnuva", { 0: turnuvaSaatleri().length }) });
  engeller.push(...gb.engeller); binalar.push(...gb.binalar);
  // 2B: greybox kimlik etiketleri canlıda kapalı; ?etiket=1 ile açılır (yerleşim konuşmaları için)
  gb.etiketGoster(new URLSearchParams(window.location.search).has("etiket"));

  // ---------- avatar ----------
  /**
   * Avatar kurar (2B: yeni GLB karakter, karakter/meydanAvatar.js).
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
    if (av?.userData?.yeniKarakter) avatarlar.gorunumDegistir(av, gorunum);
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
   * Paylaşılan geometri/doku karakter sisteminde sayılır (bkz. karakter/meydanAvatar.js).
   */
  function avatarSil(g) {
    if (g?.userData?.yeniKarakter) { avatarlar.sil(g); return; }
    sahne.remove(g);
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
    // 2B: GLB klipleri (Idle/Walk/Run) + zıplama yüksekliği; dans/ikram vekilleri kemiklere karakter karesinde uygulanır
    if (u.yeniKarakter) avatarlar.yuru(av, dt, guc, zipla, zemin);
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
    gb.carpismaDuzelt(poz, yaricap);   // parsel ayak izleri (yönlü kutu) + manifest sınırı
  }

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

  /** Kapı önü noktasından 5 m içindeki girilebilir bina, yoksa null. */
  function yakinBina(poz) {
    return gb.yakinBina(poz);
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

  /** Her karede çağrılır: turnuva ışıması, balonlar, kamera, karakterler, kediler. */
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
    if (kameraSabit) {   // 2A ölçüm/görüntü: sabit kamera (oyun kamerası değil; yalnız ölçüm/hata ayıklama API'si)
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

    const tGonderim = performance.now();
    render.render(sahne, kamera);
    olcum.gonderim(performance.now() - tGonderim);   // 2C-A: CPU = yalnız gönderim (sürekli, ucuz)
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


  return {
    sahne, kamera, render, engeller, binalar,
    // 2A: manifest dünyası bilgisi — doğuş noktası, nokta sorgusu, etiket aç/kapa, özet sayılar
    yerlesim: { dogus: gb.dogus, nokta: gb.nokta, etiketGoster: gb.etiketGoster, ozet: gb.ozet, sinirIcinde: gb.sinirIcinde, manifest: yerlesim },
    kameraSabitle: (o) => { kameraSabit = o && o.konum && o.hedef ? o : null; },
    avatarOlustur, avatarSil, avatarAdiDegistir, avatarGorunumu, yurumeAnimasyonu, yumusakDon,
    emojiGoster, carpismaDuzelt, zeminYuksekligi, yakinBina, turnuvaKapisi, avatarSec,
    dansEttir: (av, kod) => dansBaslat(av, kod),
    // 2B: tam karakter sayısı (oyun_ayarlari.meydan_uc_boyutlu_sinir) · karakter sistemi hazır sözü · ölçüm için yöneticiler
    kalabalikSiniri: (n) => { if (Number.isFinite(n) && n >= 0 && n !== avatarlar.sinir) avatarlar.sinirAyarla(n); return avatarlar.sinir; },
    karakterHazir, karakterler: avatarlar, karakterSistemi: ks, cevreHazir, cevre: () => cevre,
    kediSayisi: (n) => { if (Number.isFinite(n)) { kediSayisi = n; kediler?.sayiAyarla(n); } return kediler?.kediler.length ?? kediSayisi; },
    kediler: () => kediler,
    zumla, zumAyarla, zumOku,
    // 2C-A: ölçüm göstergesi — CPU gönderim sürekli, CPU+GPU yalnız istenince (olcum.olc)
    olcum,
    guncelle, boyutlandir, yokEt,
  };
}
