// ============================================================
// BALIK TUTMA — GÖRSEL KATMAN (Revizyon Paketi 13, Aşama 2)
//
// Olta, misina, şamandıra, balık ve su halkası burada çizilir. Kim tutuyor,
// coin ne zaman düşer — bilmez. Kural ve ödül SUNUCUDA (balik_yakala);
// HaritaSayfasi her "çekiş" anında sunucuya sorar, sonucu buraya
// `balikSonuc(av, 'yakalandi')` ile bildirir. Botlar için de aynı görsel
// çalışır; onlarda sonuç istemcide (tohumlu) seçilir, coin yoktur.
//
// Döngü: at (0,6 sn) → bekle (4-7 sn) → çek (0,8 sn) → yeniden at.
// Çekiş anında HaritaSayfasi'na haber verilir (balikKaresi dönüşü).
// ============================================================

import * as THREE from "three";
import { dansiDurdur } from "./danslar.js";

const AT_SN = 0.6, CEK_SN = 0.8;
const BEKLE_MIN = 4, BEKLE_MAX = 7;
const SU_Y = 0.42;

/** av -> durum */
const aktifler = new Map();

function oltaYap() {
  const g = new THREE.Group();
  const sap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 1.7, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a36 }));
  sap.position.y = 0.85; g.add(sap);
  const tutamak = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0x20324a }));
  tutamak.position.y = 0.12; g.add(tutamak);
  return g;
}

function samandiraYap() {
  const g = new THREE.Group();
  const ust = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff5b4a }));
  const alt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  ust.position.y = 0.06; alt.position.y = -0.06; alt.scale.y = 0.7;
  g.add(ust, alt);
  return g;
}

function balikYap() {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffb020 }));
  govde.scale.set(1.5, 0.75, 0.6); g.add(govde);
  const kuyruk = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 3), new THREE.MeshLambertMaterial({ color: 0xf4701f }));
  kuyruk.rotation.z = Math.PI / 2; kuyruk.position.x = -0.38; g.add(kuyruk);
  return g;
}

function serbestBirak(nesne) {
  nesne.traverse?.((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
  });
  nesne.parent?.remove(nesne);
}

/**
 * Balık tutmaya başlar. `suNoktasi` = oltanın düştüğü yer (x,z; y su seviyesi).
 * `rastgele` verilirse (bot) bekleme süreleri kararlı olur.
 */
export function balikBaslat(sahne, av, suNoktasi, rastgele = Math.random) {
  if (!sahne || !av || aktifler.has(av)) return;
  dansiDurdur(av);
  const olta = oltaYap();
  // Sağ elin önünde, ileri-yukarı eğik. Avatar kökü suya bakacak şekilde
  // döndürülür (HaritaSayfasi yumusakDon ile), bu yüzden yerel +z = ileri.
  olta.position.set(0.42, 1.05, 0.25);
  olta.rotation.x = -1.0;
  av.add(olta);
  const samandira = samandiraYap(); samandira.visible = false; sahne.add(samandira);
  const misinaGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const misina = new THREE.Line(misinaGeo, new THREE.LineBasicMaterial({ color: 0xf7f7f7 }));
  misina.visible = false; sahne.add(misina);
  const halka = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  halka.rotation.x = Math.PI / 2; halka.position.set(suNoktasi.x, SU_Y + 0.02, suNoktasi.z); sahne.add(halka);
  aktifler.set(av, {
    sahne, olta, samandira, misina, halka, rastgele,
    su: { x: suNoktasi.x, z: suNoktasi.z },
    evre: "at", t: 0, bekleSn: BEKLE_MIN + rastgele() * (BEKLE_MAX - BEKLE_MIN),
    balik: null, balikT: 0, halkaT: 99,
  });
}

/** Sunucudan (ya da bot için tohumdan) gelen sonuç: yakalandıysa balık çıkar. */
export function balikSonuc(av, sonuc) {
  const d = aktifler.get(av);
  if (!d || sonuc !== "yakalandi") return;
  if (d.balik) serbestBirak(d.balik);
  d.balik = balikYap();
  d.balik.position.set(d.su.x, SU_Y, d.su.z);
  d.sahne.add(d.balik);
  d.balikT = 0;
  d.halkaT = 0;
}

export function balikTutuyorMu(av) { return aktifler.has(av); }

export function balikDurdur(av) {
  const d = aktifler.get(av);
  if (!d) return;
  serbestBirak(d.olta); serbestBirak(d.samandira); serbestBirak(d.misina); serbestBirak(d.halka);
  if (d.balik) serbestBirak(d.balik);
  aktifler.delete(av);
}

export function baliklariTemizle() {
  for (const av of [...aktifler.keys()]) balikDurdur(av);
}

const _uc = new THREE.Vector3();

/**
 * Bir kare ilerletir. Çekiş anına gelen avatarları döndürür — HaritaSayfasi
 * oyuncu için sunucuya sorar, bot için tohumdan karar verir.
 * @returns {THREE.Object3D[]}
 */
export function balikKaresi(dt) {
  const cekenler = [];
  for (const [av, d] of aktifler) {
    d.t += dt;
    const { olta, samandira, misina } = d;
    // Olta ucu dünya konumu (sapın tepesi)
    _uc.set(0, 1.7, 0); olta.localToWorld(_uc);
    let samandiraY = SU_Y;
    if (d.evre === "at") {
      const f = Math.min(1, d.t / AT_SN);
      olta.rotation.x = -1.6 + f * 0.7;               // geriden öne savur
      samandira.visible = misina.visible = f > 0.35;
      // Şamandıra kavisle suya
      const g = Math.max(0, (f - 0.35) / 0.65);
      samandira.position.set(
        av.position.x + (d.su.x - av.position.x) * g,
        _uc.y + (SU_Y - _uc.y) * g + Math.sin(g * Math.PI) * 1.2,
        av.position.z + (d.su.z - av.position.z) * g
      );
      if (f >= 1) { d.evre = "bekle"; d.t = 0; }
    } else if (d.evre === "bekle") {
      olta.rotation.x = -0.9 + Math.sin(d.t * 2.2) * 0.03;
      samandiraY = SU_Y + Math.sin(d.t * 3) * 0.05;
      samandira.position.set(d.su.x, samandiraY, d.su.z);
      if (d.t >= d.bekleSn) { d.evre = "cek"; d.t = 0; cekenler.push(av); }
    } else {
      // çek: olta kalkar, şamandıra oyuncuya döner
      const f = Math.min(1, d.t / CEK_SN);
      olta.rotation.x = -0.9 - f * 0.7;
      samandira.position.set(
        d.su.x + (av.position.x - d.su.x) * f,
        SU_Y + (_uc.y - SU_Y) * f,
        d.su.z + (av.position.z - d.su.z) * f
      );
      if (f >= 1) {
        d.evre = "at"; d.t = 0;
        d.bekleSn = BEKLE_MIN + d.rastgele() * (BEKLE_MAX - BEKLE_MIN);
        samandira.visible = misina.visible = false;
      }
    }
    if (misina.visible) {
      const p = misina.geometry.attributes.position;
      p.setXYZ(0, _uc.x, _uc.y, _uc.z);
      p.setXYZ(1, samandira.position.x, samandira.position.y, samandira.position.z);
      p.needsUpdate = true;
    }
    // Yakalanan balık: sudan ele sıçrar, sonra kaybolur
    if (d.balik) {
      d.balikT += dt;
      const f = Math.min(1, d.balikT / 0.7);
      d.balik.position.set(
        d.su.x + (av.position.x - d.su.x) * f,
        SU_Y + (_uc.y - SU_Y) * f + Math.sin(f * Math.PI) * 1.4,
        d.su.z + (av.position.z - d.su.z) * f
      );
      d.balik.rotation.y += dt * 6;
      if (d.balikT > 1.3) { serbestBirak(d.balik); d.balik = null; }
    }
    // Su halkası (yakalayınca)
    if (d.halkaT < 1) {
      d.halkaT += dt * 1.4;
      d.halka.scale.setScalar(1 + d.halkaT * 4);
      d.halka.material.opacity = 0.8 * (1 - d.halkaT);
    } else d.halka.material.opacity = 0;
  }
  return cekenler;
}
