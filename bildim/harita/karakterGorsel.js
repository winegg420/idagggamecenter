// ============================================================
// MEYDAN — 2B KARAKTERİN 3B SAHNEDEKİ GÖRSELİ (BILLBOARD)
//
// MİMARİ: bu dosya "görünüm kaydı → doku" işinin TEK yeridir. Sahnenin
// kendisi (dunya.js) yalnız burada üretilen nesneyi ekler/çıkarır.
// Harita ileride baştan çizilecek; modeller değişince burası değişir,
// mantık (coin, ağ, etkileşim) durmaya devam eder.
//
// YÖNTEM: oyuncunun `profiles.gorunum` kaydından bildim/karakter/ SVG
// üreticisiyle bir resim çıkarılır, 256×256 bir tuvale çizilip
// THREE.Sprite olarak sahneye konur. Sprite her zaman kameraya bakar
// (Don't Starve / Paper Mario yöntemi), bu yüzden döndürme derdi yok.
//
// ESKİ 3B GÖVDE SİLİNMEDİ: avatar.js + esyalar.js yerinde duruyor ve
// /gorunum-3b önizlemesi onları kullanmaya devam ediyor. Geri dönmek
// için dunya.js'teki import satırını çevirmek yeter.
//
// UYUMLULUK: döndürülen grubun `userData` şekli avatar.js ile AYNIDIR
// (kok, bacaklar, kollar, govde, kafa, etiket, ad, yurumeFaz, dans).
// Böylece danslar.js, ikramGorsel.js ve yürüme animasyonu değişmeden
// çalışır; o kodlar yalnız boş grupların rotation/position'ını yazar.
//
// PERFORMANS: doku önbelleği görünüm+poz başına TEK dokudur ve referans
// sayılır. 40 oyuncu 5 farklı karakter kullanıyorsa 5 doku üretilir;
// son kullanan sahneden çıkınca doku dispose edilir.
// ============================================================
//
// ARTIK 3B GÖVDE ÇİZİLİYOR (13 Eylül 2026). Meydandaki karakter
// bildim/avatar3d/ altındaki gerçek 3B modeldir. Aşağıdaki billboard kodu
// SİLİNMEDİ — yalnız çizim yolundan çıktı; giriş fonksiyonlarının başındaki
// üç satır işi meydan-model.js'e devrediyor. Geri dönmek için o üç satırı
// kaldırmak yeter.
//
// `karakterPozGuncelle` ve `karakterYonGuncelle` 3B modelde kendiliğinden
// etkisiz: ikisi de `userData.sprite` yoksa hemen dönüyor (3B modelde yok).
// Gerçek 3B gövde kameraya değil, gittiği yöne bakar.
// ============================================================
import * as THREE from "three";
import { meydanModelKur, meydanModelSil, meydanModelDegistir } from "../avatar3d/meydan-model.js";
import { isimEtiketi, nesneyiSerbestBirak } from "./ortak.js";
import { avatarUri } from "../karakter/gorunum.js";

/** Doku çözünürlüğü — meydanda karakter ekranda en fazla ~200 px. */
const DOKU = 256;
/** Sprite'ın dünya ölçüsü (eski gövde ~4 birim boyundaydı). */
const EN = 3.8;
/** Sprite merkezinin yerden yüksekliği; ayaklar y=0'a otursun. */
const MERKEZ_Y = EN / 2;

// ---- doku önbelleği (anahtar: avatarUri çıktısı) ----
// avatarUri zaten görünüm+poz özetine göre önbellekli, aynı görünüm için
// hep aynı dizgeyi döndürüyor. O dizgeyi doğrudan anahtar olarak kullanmak
// ikinci bir özet fonksiyonu yazmaktan hem ucuz hem tutarlı.
const dokular = new Map();   // uri -> { doku, sayac }

/** Görünüm+poz için doku alır, referans sayacını artırır. */
function dokuAl(gorunum, poz) {
  let uri;
  try {
    uri = avatarUri(gorunum, poz);
  } catch (e) {
    console.error("[Meydan] karakter uri:", e);
    uri = null;
  }
  if (!uri) return null;

  const kayit = dokular.get(uri);
  if (kayit) { kayit.sayac += 1; return kayit.doku; }

  const tuval = document.createElement("canvas");
  tuval.width = DOKU; tuval.height = DOKU;
  const doku = new THREE.CanvasTexture(tuval);
  doku.colorSpace = THREE.SRGBColorSpace;
  doku.generateMipmaps = false;
  doku.minFilter = THREE.LinearFilter;

  // SVG çözülene kadar tuval saydam kalır (bir kare boş görünür, sorun değil).
  try {
    const resim = new Image();
    resim.onload = () => {
      try {
        tuval.getContext("2d").drawImage(resim, 0, 0, DOKU, DOKU);
        doku.needsUpdate = true;
      } catch (e) { console.error("[Meydan] doku cizimi:", e); }
    };
    resim.onerror = () => console.error("[Meydan] karakter resmi yuklenemedi");
    resim.src = uri;
  } catch (e) {
    console.error("[Meydan] doku:", e);
  }

  dokular.set(uri, { doku, sayac: 1 });
  return doku;
}

/** Referansı bırakır; son kullanan da bırakınca doku serbest kalır. */
function dokuBirak(doku) {
  if (!doku) return;
  for (const [uri, k] of dokular) {
    if (k.doku !== doku) continue;
    k.sayac -= 1;
    if (k.sayac <= 0) { k.doku.dispose(); dokular.delete(uri); }
    return;
  }
}

/** Sahne kapanırken kalan dokuları bırakır (dunya.yokEt çağırır). */
export function karakterDokulariniTemizle() {
  for (const k of dokular.values()) { try { k.doku.dispose(); } catch { /* yut */ } }
  dokular.clear();
  // Sahne kapandı: 3B gövde sayacı da sıfırlanır, yoksa meydana ikinci kez
  // girildiğinde sınır dolu sanılır ve herkes billboard'a düşer.
  ucBoyutluSayisi = 0;
}

// ---- yere düşen gölge (sprite gölge üretmez) ----
// Geometri ve malzeme PAYLAŞILIR; avatar başına dispose EDİLMEZ.
let golgeGeo = null;
let golgeMat = null;
function golgeKur() {
  if (!golgeGeo) golgeGeo = new THREE.CircleGeometry(0.85, 16);
  if (!golgeMat) {
    golgeMat = new THREE.MeshBasicMaterial({
      color: 0x20324a, transparent: true, opacity: 0.18, depthWrite: false,
    });
  }
  const m = new THREE.Mesh(golgeGeo, golgeMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.userData.paylasilan = true;
  return m;
}

/**
 * Meydan karakterini kurar.
 *
 * @param {object} o
 * @param {string|null} o.ad         isim etiketi (null ise çizilmez)
 * @param {object} o.gorunum         profiles.gorunum kaydı
 * @param {string} o.etiketRenk      isim etiketi yazı rengi
 * @returns {THREE.Group}
 */
// ============================================================
// KALABALIK SINIRI — ölçülmüş sayı, tahmin değil
//
// Gerçek 3B gövde gardırop için tasarlandı: tek karakter, yakın plan.
// Ölçüm (13 Eylül 2026, bildim/_test/meydan-3b-test.mjs yanında):
//   karakter başına 57 görünür mesh (= 57 çizim çağrısı), 33.068 üçgen.
// Eski 2B billboard ise karakter başına 2 çizim çağrısıydı.
//
// 12 oyuncu × 57 = 684 çizim çağrısı yalnız karakterler için; telefon GPU'su
// için makul aralık ~100-200. Bu yüzden 3B gövde YAKINDAKİ ilk birkaç
// oyuncuya verilir, gerisi billboard'da kalır — meydan kalabalıkken
// çökmesin. Kendi karakterin sahneye İLK kurulduğu için her zaman 3B.
//
// Sayıyı büyütmek/küçültmek tek satır: ölçüp değiştir, tahmin etme.
export const UC_BOYUTLU_SINIR = 6;
let ucBoyutluSayisi = 0;

/** Kaç oyuncu şu an 3B gövdeyle çiziliyor (test ve ölçüm için). */
export function ucBoyutluAdedi() { return ucBoyutluSayisi; }

export function karakterAvatarKur({ ad, gorunum, etiketRenk = "#20324A" }) {
  if (ucBoyutluSayisi < UC_BOYUTLU_SINIR) {
    try {
      const g = meydanModelKur({ ad, gorunum, etiketRenk });
      ucBoyutluSayisi++;
      return g;
    } catch (e) {
      // 3B model kurulamazsa oyuncu görünmez kalmasın: billboard'a düş.
      console.error("[Meydan] 3B gövde kurulamadi, billboard'a dusuldu:", e);
    }
  }
  return billboardAvatarKur({ ad, gorunum, etiketRenk });
}

/**
 * ESKİ 2B BILLBOARD — çizim yolundan çıktı, geri dönüş için duruyor.
 * Yukarıdaki `karakterAvatarKur` bunun yerine 3B modeli kuruyor.
 */
export function billboardAvatarKur({ ad, gorunum, etiketRenk = "#20324A" }) {
  const g = new THREE.Group();

  // GÖVDE KÖKÜ — danslar yalnız burayı oynatır (bkz. avatar.js aynı ayrım).
  const kok = new THREE.Group();
  g.add(kok);

  const gor = gorunum ?? {};
  const doku = dokuAl(gor, "idle");
  const malzeme = new THREE.SpriteMaterial({
    map: doku, transparent: true, depthWrite: false,
  });
  const sprite = new THREE.Sprite(malzeme);
  sprite.scale.set(EN, EN, 1);
  sprite.position.y = MERKEZ_Y;
  kok.add(sprite);
  kok.add(golgeKur());

  // UYUMLULUK GRUPLARI: danslar.js ve ikramGorsel.js bunların rotation /
  // position değerlerini yazıyor. Billboard'da karşılığı yok ama yazmak
  // zararsız olsun diye gerçek Object3D veriyoruz — kod ayıklanmadı.
  const bacaklar = new THREE.Group();
  bacaklar.add(new THREE.Group(), new THREE.Group());
  const kollar = new THREE.Group();
  const govde = new THREE.Group();
  const kafa = new THREE.Group();
  kok.add(bacaklar, kollar, govde, kafa);

  let etiket = null;
  if (ad != null) {
    etiket = isimEtiketi(ad, etiketRenk);
    etiket.position.y = 4.15;
    g.add(etiket);
  }

  g.userData = {
    kok, bacaklar, kollar, govde, kafa, etiket, ad,
    yurumeFaz: Math.random() * 6, gorunum: gor, dans: null,
    // billboard'a özel
    sprite, doku, poz: "idle", bakisSag: true,
  };
  return g;
}

/**
 * Kıyafet/karakter değişimi — sahne yıkılmadan.
 * Meydanda biri görünümünü değiştirince yalnız bu çağrılır.
 */
export function karakterGorunumDegistir(avatar, gorunum) {
  // 3B model: parçalar iskelete bağlı, doku değiştirmekle olmaz — model
  // yeniden kurulur (meydan-model.js grubun içeriğini yerinde değiştirir).
  if (avatar?.userData?.gercek3d) { meydanModelDegistir(avatar, gorunum); return; }
  const u = avatar?.userData;
  if (!u?.sprite) return;
  const gor = gorunum ?? {};
  const yeni = dokuAl(gor, u.poz ?? "idle");
  if (!yeni) return;
  dokuBirak(u.doku);
  u.doku = yeni;
  u.gorunum = gor;
  u.sprite.material.map = yeni;
  u.sprite.material.needsUpdate = true;
}

/**
 * Yürüyüş karesi: yürürken run1/run2, dururken idle.
 * dunya.js'in yürüme animasyonu her karede çağırır.
 *
 * @param {THREE.Group} avatar
 * @param {boolean} yuruyor
 */
export function karakterPozGuncelle(avatar, yuruyor) {
  const u = avatar?.userData;
  if (!u?.sprite) return;
  const poz = yuruyor
    ? (Math.sin(u.yurumeFaz) >= 0 ? "run1" : "run2")
    : "idle";
  if (poz === u.poz) return;
  const yeni = dokuAl(u.gorunum ?? {}, poz);
  if (!yeni) return;
  dokuBirak(u.doku);
  u.doku = yeni;
  u.poz = poz;
  u.sprite.material.map = yeni;
  u.sprite.material.needsUpdate = true;
}

const _ileri = new THREE.Vector3();
const _sag = new THREE.Vector3();

/**
 * Bakış yönü: karakter ekranda hangi yöne gidiyorsa oraya baksın.
 * Sprite döndürülemediği için yatayda aynalanır (scale.x işareti).
 */
export function karakterYonGuncelle(avatar, kamera) {
  const u = avatar?.userData;
  if (!u?.sprite || !kamera) return;
  _ileri.set(Math.sin(avatar.rotation.y), 0, Math.cos(avatar.rotation.y));
  _sag.setFromMatrixColumn(kamera.matrixWorld, 0);
  _sag.y = 0;
  const nokta = _ileri.dot(_sag);
  // Tam profile yakın açılarda titremesin diye ölü bölge bırakıldı.
  if (Math.abs(nokta) < 0.15) return;
  const sag = nokta > 0;
  if (sag === u.bakisSag) return;
  u.bakisSag = sag;
  u.sprite.scale.x = sag ? EN : -EN;
}

/** Avatarı ve kendine ait kaynakları bırakır. */
export function karakterYokEt(avatar) {
  if (!avatar) return;
  // 3B model kendi geometri/malzemesini tutuyor: meydan-model.js bıraksın,
  // yoksa meydandan çıkan her oyuncu bellekte kalır.
  if (avatar.userData?.gercek3d) {
    meydanModelSil(avatar);
    ucBoyutluSayisi = Math.max(0, ucBoyutluSayisi - 1);
    return;
  }
  const u = avatar.userData ?? {};
  // Paylaşılan gölge geometrisi/malzemesi dispose edilmesin.
  for (const c of u.kok?.children ?? []) {
    if (c.userData?.paylasilan) { u.kok.remove(c); break; }
  }
  dokuBirak(u.doku);
  if (u.sprite) {
    // Doku referansla yönetiliyor; malzeme onu bırakmadan dispose edilsin.
    u.sprite.material.map = null;
    u.sprite.material.dispose();
    u.kok?.remove(u.sprite);
  }
  u.doku = null;
  u.sprite = null;
  nesneyiSerbestBirak(avatar);
}
