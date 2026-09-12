// ============================================================
// İKRAM GÖRSELLERİ — kahve jesti ve uçan balonlar
//
// Bu dosya YALNIZ görseldir: three.js nesneleri, animasyon eğrileri.
// Kural, coin ve ağ tarafı etkilesim.js'te; o dosya burayı hiç bilmez.
// Karakter modelleri baştan değişirse yalnız BU dosya yeniden yazılır,
// özelliğin kendisi (teklif → kabul → jest) aynen çalışmaya devam eder.
//
// Sözleşme — dışarıya iki şey verilir:
//   kahveBasla(a, b, sn) · balonBasla(veren, alan, sn)  → sahne kurar
//   ikramKaresi(dt)                                     → her karede çağrılır
// İkisi de avatarın `userData.kok / kollar / kafa` parçalarını kullanır
// (danslar.js ile aynı iskelet); başka hiçbir şeye dokunmaz.
// ============================================================

import * as THREE from "three";
import { dansiDurdur } from "./danslar.js";

const BALON_RENKLERI = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xa855f7, 0xf97316];

// Süren gösteriler. Her biri { tur, t, sure, ... }
const gosteriler = [];

/** Avatarın önünde durduğu noktayı verir (kahvede karşı karşıya gelinir). */
function onNokta(av, uzaklik) {
  const yon = new THREE.Vector3(Math.sin(av.rotation.y), 0, Math.cos(av.rotation.y));
  return av.position.clone().add(yon.multiplyScalar(uzaklik));
}

/** İki avatarı birbirine döndürür (yalnız görsel; konumları değişmez). */
function birbirineBak(a, b) {
  const acA = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
  const acB = acA + Math.PI;
  return [acA, acB];
}

function fincanYap() {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.1, 0.2, 10),
    new THREE.MeshLambertMaterial({ color: 0xfdfdfd })
  );
  const kahve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.02, 10),
    new THREE.MeshLambertMaterial({ color: 0x5b3a1e })
  );
  kahve.position.y = 0.09;
  g.add(govde, kahve);
  return g;
}

function balonYap(renk) {
  const g = new THREE.Group();
  const kure = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    new THREE.MeshLambertMaterial({ color: renk })
  );
  kure.scale.y = 1.25;
  const ip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  ip.position.y = -0.6;
  g.add(kure, ip);
  return g;
}

function serbestBirak(nesne) {
  nesne.traverse?.((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else m.material.dispose();
    }
  });
  nesne.parent?.remove(nesne);
}

/**
 * Kahve ikramı: iki karakter karşı karşıya gelir, fincanları kaldırıp
 * yudumlar, aralarda kahkaha atarlar (gövde sarsıntısı + kafa geriye).
 */
export function kahveBasla(sahne, a, b, sure = 15) {
  if (!sahne || !a || !b) return;
  dansiDurdur(a);
  dansiDurdur(b);
  const [acA, acB] = birbirineBak(a, b);
  const fincanA = fincanYap();
  const fincanB = fincanYap();
  sahne.add(fincanA, fincanB);
  gosteriler.push({
    tur: "kahve", t: 0, sure, a, b, acA, acB, fincanA, fincanB,
    eskiAcA: a.rotation.y, eskiAcB: b.rotation.y,
  });
}

/**
 * Balon ikramı: veren elini uzatır, elinden 3-5 balon çıkar; balonlar
 * ALANIN üzerinde yukarı uçar, yükselir ve kaybolur.
 */
export function balonBasla(sahne, veren, alan, sure = 15) {
  if (!sahne || !veren || !alan) return;
  dansiDurdur(veren);
  const adet = 3 + Math.floor(Math.random() * 3);   // 3-5
  const balonlar = [];
  for (let i = 0; i < adet; i++) {
    const b = balonYap(BALON_RENKLERI[(Math.random() * BALON_RENKLERI.length) | 0]);
    b.position.copy(onNokta(veren, 0.6));
    b.position.y = 2.2;
    sahne.add(b);
    balonlar.push({
      nesne: b,
      gecikme: i * 0.25,
      sapmaX: (Math.random() - 0.5) * 1.2,
      sapmaZ: (Math.random() - 0.5) * 1.2,
      hiz: 1.6 + Math.random() * 0.8,
    });
  }
  gosteriler.push({
    tur: "balon", t: 0, sure: Math.min(sure, 6), veren, alan, balonlar,
    baslangic: onNokta(veren, 0.6).clone(),
  });
}

/** Süren gösterileri bir kare ilerletir (HaritaSayfasi döngüsünden). */
export function ikramKaresi(dt) {
  for (let i = gosteriler.length - 1; i >= 0; i--) {
    const g = gosteriler[i];
    g.t += dt;

    if (g.tur === "kahve") {
      const bitti = g.t >= g.sure;
      // Karşı karşıya dur
      g.a.rotation.y = g.acA;
      g.b.rotation.y = g.acB;
      // Yudum ritmi: 3 sn'de bir kaldır-indir; arada kahkaha
      const evre = (g.t % 3) / 3;
      const kaldir = Math.max(0, Math.sin(evre * Math.PI));
      const kahkaha = g.t % 6 > 4.2;
      for (const [av, fincan] of [[g.a, g.fincanA], [g.b, g.fincanB]]) {
        const u = av.userData;
        const kol = u?.kollar?.children?.[1];
        if (kol) kol.rotation.x = -kaldir * 1.25;
        if (u?.kafa) {
          u.kafa.rotation.x = kahkaha ? -0.35 : -kaldir * 0.2;
        }
        if (u?.kok) {
          u.kok.rotation.z = kahkaha ? Math.sin(g.t * 22) * 0.06 : 0;
        }
        const yon = new THREE.Vector3(Math.sin(av.rotation.y), 0, Math.cos(av.rotation.y));
        fincan.position.copy(av.position)
          .add(yon.multiplyScalar(0.42))
          .add(new THREE.Vector3(0, 1.9 + kaldir * 0.55, 0));
      }
      if (bitti) {
        serbestBirak(g.fincanA);
        serbestBirak(g.fincanB);
        dansiDurdur(g.a);
        dansiDurdur(g.b);
        gosteriler.splice(i, 1);
      }
      continue;
    }

    if (g.tur === "balon") {
      // Veren elini uzatır (ilk saniye)
      const kol = g.veren.userData?.kollar?.children?.[1];
      if (kol) kol.rotation.x = -Math.min(1, g.t * 2) * 1.35;

      for (const b of g.balonlar) {
        const t = g.t - b.gecikme;
        if (t < 0) { b.nesne.visible = false; continue; }
        b.nesne.visible = true;
        // Verenin elinden çıkar, ALANIN üzerine geçer, sonra yükselir
        const gecis = Math.min(1, t / 1.2);
        const hedef = g.alan.position;
        b.nesne.position.x = g.baslangic.x + (hedef.x + b.sapmaX - g.baslangic.x) * gecis;
        b.nesne.position.z = g.baslangic.z + (hedef.z + b.sapmaZ - g.baslangic.z) * gecis;
        b.nesne.position.y = 2.2 + t * b.hiz;
        b.nesne.rotation.z = Math.sin(t * 2 + b.gecikme) * 0.15;
        // Yükseldikçe küçülüp kaybolur
        const s = Math.max(0, 1 - Math.max(0, t - 3) / 2.5);
        b.nesne.scale.setScalar(s);
      }

      if (g.t >= g.sure) {
        for (const b of g.balonlar) serbestBirak(b.nesne);
        dansiDurdur(g.veren);
        gosteriler.splice(i, 1);
      }
    }
  }
}

/** Sahne kapanırken her şeyi bırak. */
export function ikramlariTemizle() {
  for (const g of gosteriler) {
    if (g.tur === "kahve") { serbestBirak(g.fincanA); serbestBirak(g.fincanB); }
    else for (const b of g.balonlar) serbestBirak(b.nesne);
  }
  gosteriler.length = 0;
}
