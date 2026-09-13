// ============================================================
// PARÇA PORTRESİ — kozmetik eşyaların küçük resmi
//
// Gardıroptaki her eşya kartı, o eşyanın OYUNCUNUN KENDİ KARAKTERİ üstünde
// nasıl durduğunu gösterir. Burada üretilen şey tek karelik bir PNG (data
// URI): kart onu <img> olarak basar, kendi 3B sahnesini açmaz.
//
// TEK RENDERER: sayfada zaten canlı bir sahne dönüyor (onizleme.js). Her
// küçük resim için yeni WebGL bağlamı açmak tarayıcının bağlam sınırını
// (genelde 16) yakar. Bu modül modül düzeyinde TEK bir renderer tutar,
// hepsini onunla çizer.
//
// Avatarın kendisi avatar.js'ten gelir — ikinci bir çizim yolu açılmaz.
// ============================================================
import * as THREE from "three";
import { avatarKur, avatarYokEt } from "./avatar.js";

// ---- çerçeveleme ----
// Aynı kamera her eşyaya uymaz: kepi tam boy çekersen nokta kadar kalır.
// Hepsi TEK yerde dursun ki ileride ayarlamak kolay olsun.
// Gövde ölçüleri avatar.js'ten: ayak 0, gövde 1.85, omuz 2.52, kafa 3.05.
export const CERCEVE = {
  // baş hizası — yüz + baş üstü
  bas:      { fov: 24, konum: [0, 3.18, 4.05], bak: [0, 2.98, 0] },
  // göğüs hizası — omuz–bel arası
  govde:    { fov: 26, konum: [0, 2.35, 5.10], bak: [0, 2.10, 0] },
  // ayak hizası
  ayak:     { fov: 26, konum: [0, 0.85, 3.30], bak: [0, 0.50, 0] },
  // tam boy
  tamboy:   { fov: 30, konum: [0, 2.60, 9.20], bak: [0, 2.00, 0] },
  // hafif geriden tam boy — sırt görünsün (pelerin türü parçalar için)
  sirt:     { fov: 30, konum: [0, 2.70, -9.20], bak: [0, 2.00, 0] },
};

// Yuva → çerçeve eşlemesi. Bilinmeyen yuva tam boy çekilir.
const YUVA_CERCEVE = {
  sac: "bas", sapka: "bas", gozluk: "bas", kupe: "bas",
  ust: "govde",
  ayakkabi: "ayak",
  alt: "tamboy", efekt: "tamboy", dans: "tamboy",
  pelerin: "sirt",
};

// ---- önbellek ----
// 12 parça × değişen ten/saç rengi: 160 giriş rahat yetiyor.
const ONBELLEK_SINIRI = 160;
const onbellek = new Map();

function onbellektenAl(anahtar) {
  if (!onbellek.has(anahtar)) return null;
  // LRU: dokunulanı sona taşı, taşma olunca en eskisi düşsün.
  const v = onbellek.get(anahtar);
  onbellek.delete(anahtar);
  onbellek.set(anahtar, v);
  return v;
}

function onbellegeYaz(anahtar, veri) {
  onbellek.set(anahtar, veri);
  while (onbellek.size > ONBELLEK_SINIRI) {
    const ilk = onbellek.keys().next().value;
    onbellek.delete(ilk);
  }
}

/** Ten/saç rengi değişince eski küçük resimler geçersizdir. */
export function portreOnbelleginiTemizle() {
  onbellek.clear();
}

// ---- paylaşılan sahne ----
let sahne = null;
let render = null;

function makineyiKur() {
  if (render) return;
  sahne = new THREE.Scene();
  sahne.background = null;   // saydam: kartın kendi zemini görünsün

  // Işıklar önizlemedekiyle aynı oranlarda olsun ki küçük resim ile canlı
  // sahne aynı görünsün (three 0.185 fiziksel birim → ×π).
  sahne.add(new THREE.HemisphereLight(0xeaf7ff, 0x9fb6c8, 0.95 * Math.PI));
  const gunes = new THREE.DirectionalLight(0xfff3dc, 1.05 * Math.PI);
  gunes.position.set(4, 8, 6);
  sahne.add(gunes);

  render = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

/** Sayfadan çıkarken bağlamı bırak — WebGL bağlamı sızmasın. */
export function portreMakinesiniKapat() {
  try {
    render?.dispose();
    render?.forceContextLoss?.();
  } catch (e) {
    console.error("[Portre] makine kapatilamadi:", e);
  }
  render = null;
  sahne = null;
  onbellek.clear();
}

/**
 * Bir kozmetik parçanın, oyuncunun kendi görünümü üstündeki küçük resmi.
 *
 * @param {object} temelGorunum  oyuncunun o anki görünümü (ten/saç rengi dahil)
 * @param {object} parca         { yuva, deger } — yuva kodu ve eşya kodu
 *                               (deger null ise "çıplak yuva" hâli çizilir)
 * @param {object} bilgi         esyaBilgisi(katalog) çıktısı
 * @param {number} [boyut=192]   kare kenarı (px)
 * @returns {string|null} PNG data URI, üretilemezse null
 */
export function parcaPortresi(temelGorunum, parca, bilgi = {}, boyut = 192) {
  const yuva = parca?.yuva;
  if (!yuva) return null;

  // Render edilecek görünüm: oyuncunun o anki görünümü + YALNIZ o parça.
  // Böylece oyuncu eşyayı kendi karakterinin üstünde görür.
  const ayar = { ...(temelGorunum ?? {}), [yuva]: parca.deger ?? null };
  const cerceveAdi = YUVA_CERCEVE[yuva] ?? "tamboy";
  const anahtar = `${JSON.stringify(ayar)}|${cerceveAdi}|${boyut}`;

  const hazir = onbellektenAl(anahtar);
  if (hazir) return hazir;

  let avatar = null;
  try {
    makineyiKur();
    const c = CERCEVE[cerceveAdi];
    const kamera = new THREE.PerspectiveCamera(c.fov, 1, 0.3, 60);
    kamera.position.set(...c.konum);
    kamera.lookAt(...c.bak);

    avatar = avatarKur({ ad: null, gorunum: ayar, bilgi });
    sahne.add(avatar);

    render.setSize(boyut, boyut, false);
    render.render(sahne, kamera);
    const veri = render.domElement.toDataURL("image/png");
    onbellegeYaz(anahtar, veri);
    return veri;
  } catch (e) {
    console.error("[Portre] parca portresi uretilemedi:", parca?.deger, e);
    return null;
  } finally {
    // Model her render sonrası atılır: sahnede tek avatar birikmesin.
    try {
      if (avatar) { sahne?.remove(avatar); avatarYokEt(avatar); }
    } catch (e) {
      console.error("[Portre] model atilamadi:", e);
    }
  }
}

/**
 * Hazır bir görünümün yüz portresi ("Karakter" sekmesindeki düğmeler için).
 *
 * @param {object} gorunum  tam görünüm kaydı
 * @param {object} bilgi    esyaBilgisi(katalog) çıktısı
 * @param {number} [boyut]  kare kenarı (px)
 */
export function yuzPortresi(gorunum, bilgi = {}, boyut = 128) {
  // Baş çerçevelemesi; "yuva yok" diye parcaPortresi'ne sahte yuva vermeyelim
  // diye görünümü olduğu gibi geçiyoruz.
  return parcaPortresi(gorunum, { yuva: "sac", deger: gorunum?.sac ?? null }, bilgi, boyut);
}
