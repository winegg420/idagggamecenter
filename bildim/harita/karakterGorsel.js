// ============================================================
// MEYDAN KARAKTERİ — 3B GÖVDE + UZAKTAKİLER İÇİN PORTRE BILLBOARD'U
//
// MEYDANDA HİÇ 2B KARAKTER YOK (13 Eylül 2026 kararı). İki çizim biçimi
// var, ikisi de AYNI 3B modelden gelir (`bildim/avatar3d/`):
//
//   1) YAKINDAKİLER — gerçek 3B gövde (meydan-model.js). Kalabalık sınırı
//      kadar oyuncu bunu alır (bkz. UC_BOYUTLU_SINIR).
//   2) GERİSİ — aynı modelin TEK KARELİK PORTRESİ (avatar3d/portre.js),
//      256×256 bir tuvale çizilip THREE.Sprite olarak konur. Sprite her
//      zaman kameraya bakar (Don't Starve / Paper Mario yöntemi).
//
// Eskiden 2. yol bildim/karakter/ SVG'lerinden (PatiRun karakterleri)
// besleniyordu; o bağ koptu. `bildim/karakter/` dosyaları depoda duruyor
// ama meydan artık onları çağırmıyor.
//
// UYUMLULUK: döndürülen grubun `userData` şekli avatar.js ile AYNIDIR
// (kok, bacaklar, kollar, govde, kafa, etiket, ad, yurumeFaz, dans).
// Böylece danslar.js, ikramGorsel.js ve yürüme animasyonu değişmeden
// çalışır; o kodlar yalnız boş grupların rotation/position'ını yazar.
//
// PERFORMANS: doku önbelleği görünüm başına TEK dokudur ve referans
// sayılır. 40 oyuncu 5 farklı görünüm kullanıyorsa 5 doku üretilir;
// son kullanan sahneden çıkınca doku dispose edilir.
//
// `karakterPozGuncelle` ve `karakterYonGuncelle` 3B gövdede kendiliğinden
// etkisiz: ikisi de `userData.sprite` yoksa hemen dönüyor (3B gövdede yok).
// Gerçek 3B gövde kameraya değil, gittiği yöne bakar.
// ============================================================
import * as THREE from "three";
import { meydanModelKur, meydanModelSil, meydanModelDegistir } from "../avatar3d/meydan-model.js";
import { isimEtiketi, nesneyiSerbestBirak } from "./ortak.js";
import { yeniPortre } from "../avatar3d/portre.js";
import { siraya } from "../avatar3d/portre-kuyrugu.js";

/** Doku çözünürlüğü — meydanda karakter ekranda en fazla ~200 px. */
const DOKU = 256;
/** Sprite'ın dünya ölçüsü (eski gövde ~4 birim boyundaydı). */
const EN = 3.8;
/** Sprite merkezinin yerden yüksekliği; ayaklar y=0'a otursun. */
const MERKEZ_Y = EN / 2;

// ---- doku önbelleği (anahtar: görünümün JSON özeti) ----
// Aynı görünümü kullanan herkes TEK dokuyu paylaşır, referans sayılır.
//
// PORTRE BOŞ ZAMANDA ÜRETİLİR. Ölçüldü (13 Eylül 2026): yeni bir görünüm
// için portre üretimi ~83 ms. Oyuncu meydana girerken bunu kare içinde
// yapmak donmaya yol açıyordu (8 kişi aynı anda girerse ~0.7 sn). Bu
// yüzden doku HEMEN saydam olarak verilir, resmi sırası gelince dolar —
// karakter bir an sonra beliriverir, sahne hiç takılmaz.
const dokular = new Map();   // anahtar -> { doku, sayac }

/** Görünüm için doku alır, referans sayacını artırır. */
function dokuAl(gorunum) {
  const gor = gorunum ?? {};
  let anahtar;
  try {
    anahtar = JSON.stringify(gor.avatar3d ?? gor.karakter ?? gor);
  } catch {
    anahtar = "varsayilan";
  }

  const kayit = dokular.get(anahtar);
  if (kayit) { kayit.sayac += 1; return kayit.doku; }

  const tuval = document.createElement("canvas");
  tuval.width = DOKU; tuval.height = DOKU;
  const doku = new THREE.CanvasTexture(tuval);
  doku.colorSpace = THREE.SRGBColorSpace;
  doku.generateMipmaps = false;
  doku.minFilter = THREE.LinearFilter;
  dokular.set(anahtar, { doku, sayac: 1 });

  // Sıraya al: kare başına tek portre, boş zamanda.
  siraya(() => {
    // Bu arada son kullanan da çıktıysa boşuna üretme.
    if (!dokular.has(anahtar)) return;
    let uri = null;
    try {
      // 3B MODELİN FOTOĞRAFI — eskiden 2B PatiRun karakteri çiziliyordu.
      // Meydanda artık hiç 2B görsel yok: yakındakiler gerçek 3B gövde,
      // uzaktakiler aynı modelin tek karelik portresi.
      uri = yeniPortre(gor);
    } catch (e) {
      console.error("[Meydan] karakter portresi:", e);
    }
    if (!uri) return;
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
  });

  return doku;
}

/** Referansı bırakır; son kullanan da bırakınca doku serbest kalır. */
function dokuBirak(doku) {
  if (!doku) return;
  for (const [anahtar, k] of dokular) {
    if (k.doku !== doku) continue;
    k.sayac -= 1;
    if (k.sayac <= 0) { k.doku.dispose(); dokular.delete(anahtar); }
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
 * PORTRE BILLBOARD'U — kalabalık sınırının üstündeki oyuncular için.
 * Gövde yerine 3B modelin tek karelik fotoğrafı çizilir; görsel olarak
 * aynı karakter, maliyeti 57 çizim çağrısı yerine 2.
 */
export function billboardAvatarKur({ ad, gorunum, etiketRenk = "#20324A" }) {
  const g = new THREE.Group();

  // GÖVDE KÖKÜ — danslar yalnız burayı oynatır (bkz. avatar.js aynı ayrım).
  const kok = new THREE.Group();
  g.add(kok);

  const gor = gorunum ?? {};
  const doku = dokuAl(gor);
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
  const yeni = dokuAl(gor);
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
export function karakterPozGuncelle() {
  // POZ DEĞİŞTİRME KALKTI. Eskiden 2B karakterin idle/run1/run2 kareleri
  // vardı; billboard artık 3B modelin TEK karelik portresi olduğu için
  // takas edilecek ikinci bir doku yok. Çağıranlar (dunya.js) değişmesin
  // diye fonksiyon duruyor, işlem yapmıyor.
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
