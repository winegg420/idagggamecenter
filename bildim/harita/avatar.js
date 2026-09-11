// ============================================================
// AVATAR GÖVDESİ — TEK ÇİZİM YOLU
//
// Meydandaki karakter de, Görünüm sayfasındaki önizleme de buradan çıkar.
// İkinci bir çizim yolu AÇILMAZ (görev kuralı): eşya eklenince her iki yerde
// birden görünür.
//
// Gövde oranı SABİTTİR — oyuncu boy/kilo seçemez. Eşyalar bu ölçülere göre
// hizalanır (bkz. esyalar.js başlığı).
// ============================================================
import * as THREE from "three";
import { isimEtiketi, nesneyiSerbestBirak } from "./ortak.js";
import { gorunumParcalari, esyalariSerbestBirak, renkSayi } from "./esyalar.js";

const TEN_VARSAYILAN = "#F3C89B";

function mat(renk) {
  return new THREE.MeshLambertMaterial({ color: renk });
}

/**
 * Avatarı kurar.
 *
 * @param {object} o
 * @param {string} o.ad          isim etiketi (null ise etiket çizilmez)
 * @param {object} o.gorunum     profiles.gorunum kaydı
 * @param {object} o.bilgi       esyaBilgisi(katalog) çıktısı
 * @param {string} o.etiketRenk  isim etiketi yazı rengi
 * @param {number} o.govdeRenk   görünüm kaydı yoksa kullanılacak gövde rengi
 * @returns {THREE.Group}
 */
export function avatarKur({ ad, gorunum, bilgi = {}, etiketRenk = "#20324A", govdeRenk = 0x3aa0ff }) {
  const g = new THREE.Group();
  // GÖVDE KÖKÜ — isim etiketi DIŞINDA her şey buraya girer.
  //
  // Neden ayrı grup: dans hareketleri gövdeyi eğip döndürüyor, ama avatarın
  // kendi rotation.y'si yürüme yönünü tutuyor (meydanda yumusakDon, Görünüm
  // önizlemesinde tornavida dönüşü). İkisi aynı nesneye yazarsa dans ile yön
  // birbirini eziyor. Dans yalnız "kok"u oynatır.
  const kok = new THREE.Group();
  g.add(kok);
  const gor = gorunum ?? {};
  const ten = renkSayi(gor.ten || TEN_VARSAYILAN, 0xf3c89b);

  // ---- bacaklar ----
  const bacaklar = new THREE.Group(); kok.add(bacaklar);
  for (let sg = -1; sg <= 1; sg += 2) {
    const bac = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 1.1, 8), mat(0x3e4a5c));
    bac.position.set(sg * 0.28, 0.55, 0); bac.castShadow = true; bacaklar.add(bac);
  }

  // ---- gövde ----
  // Üst eşyası varsa gövde onun altında kalır; yine de çizilir ki
  // kıyafetsiz oyuncu görünmez olmasın.
  const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.5, 12), mat(govdeRenk));
  govde.position.y = 1.85; govde.castShadow = true; kok.add(govde);

  // ---- kollar + eller ----
  // Her kol AYRI BİR GRUP ve grubun merkezi OMUZDA (y 2.52). Böylece dans
  // kolu kaldırınca el de kolla birlikte gidiyor; eskiden kol kendi
  // ortasından dönüyordu ve el havada kalıyordu.
  // kollar.rotation.x (yürüme salınımı) eskisi gibi çalışır.
  const kollar = new THREE.Group(); kok.add(kollar);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const taraf = new THREE.Group();
    taraf.position.set(s2 * 0.78, 2.52, 0);
    const kol = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 1.15, 8), mat(govdeRenk));
    kol.position.y = -0.57; kol.castShadow = true; taraf.add(kol);
    const el = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(ten));
    el.position.y = -1.16; taraf.add(el);
    kollar.add(taraf);
  }

  // ---- kafa + gözler ----
  const kafa = new THREE.Mesh(new THREE.SphereGeometry(0.66, 18, 14), mat(ten));
  kafa.position.y = 3.05; kafa.castShadow = true; kok.add(kafa);
  for (let s3 = -1; s3 <= 1; s3 += 2) {
    const goz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(0x20324a));
    goz.position.set(s3 * 0.22, 3.08, 0.58); kok.add(goz);
  }

  // ---- eşyalar ----
  for (const p of gorunumParcalari(gor, bilgi)) kok.add(p);

  // ---- isim etiketi ----
  let etiket = null;
  if (ad != null) {
    etiket = isimEtiketi(ad, etiketRenk);
    etiket.position.y = 4.15;
    g.add(etiket);
  }

  g.userData = { kok, bacaklar, kollar, govde, kafa, etiket, ad, yurumeFaz: Math.random() * 6, gorunum: gor, dans: null };
  return g;
}

/**
 * Avatarın kıyafetini SAHNEYİ YIKMADAN değiştirir.
 * Meydanda biri üstünü değiştirince yalnız bu çağrılır.
 */
export function avatarGorunumDegistir(avatar, gorunum, bilgi = {}) {
  if (!avatar) return;
  esyalariSerbestBirak(avatar);
  const kok = avatar.userData?.kok ?? avatar;
  for (const p of gorunumParcalari(gorunum ?? {}, bilgi)) kok.add(p);
  avatar.userData.gorunum = gorunum ?? {};
}

/** Efektleri döndürür (userData.doner olan eşyalar). */
export function avatarEfektleriGuncelle(avatar, dt) {
  for (const c of (avatar?.userData?.kok ?? avatar)?.children ?? []) {
    const hiz = c.userData?.doner;
    if (hiz) c.rotation.y += hiz * dt;
  }
}

/** Avatarı ve PAYLAŞILMAYAN kaynaklarını bırakır. */
export function avatarYokEt(avatar) {
  if (!avatar) return;
  esyalariSerbestBirak(avatar);   // eşya geometrileri paylaşılıyor, dispose YOK
  nesneyiSerbestBirak(avatar);
}
