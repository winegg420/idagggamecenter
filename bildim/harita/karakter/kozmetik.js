// ============================================================
// KOZMETİK YUVALARI + TÜR–KOZMETİK OTURMA SÖZLEŞMESİ (Aşama 1G-A.4 → ortak modül, Aşama 2B §1)
//
// 15 yuva karakter GLB'sinde (basYuva, gozlukYuva, boyunYuva, sirtYuva …). Kozmetik GLB'de `kozmetik_<ad>` meshidir;
// türün kendi varyantı varsa o (robot şapkası anten halkalı, vizör), yoksa insanınki kullanılır.
// Sözleşme: kozmetik hacmi ∩ tür dışlama hacmi → politika  gecir · gizle · bicimlendir · it.
// ============================================================
import * as THREE from "three";

/** Kozmetik adı → yuva. gozluk ↔ gozlukPremium aynı yuva, karşılıklı dışlayıcı. */
export const KOZMETIK = { sapka: "basYuva", gozluk: "gozlukYuva", atki: "boyunYuva", gozlukPremium: "gozlukYuva", kanat: "sirtYuva" };

/**
 * Kozmetiği tak / çıkar.
 * @param {import("./karakter.js").KarakterSistemi} ks
 */
export function kozmetikTak(ks, kok, ad, ac) {
  const yuva = kok.getObjectByName(KOZMETIK[ad]); if (!yuva) return;
  if (ac && ad === "gozluk") kozmetikTak(ks, kok, "gozlukPremium", false);
  if (ac && ad === "gozlukPremium") kozmetikTak(ks, kok, "gozluk", false);
  const kaynak = ks.turVeri[kok.userData.tur]?.kozmetikler[ad] ?? ks.turVeri.insan?.kozmetikler[ad];
  const eski = yuva.getObjectByName("kozmetik_" + ad);
  if (eski && !ac) yuva.remove(eski);
  if (!eski && ac && kaynak) { const m = kaynak.clone(); m.castShadow = false; yuva.add(m); sozlesmeUygula(ks, kok, m); }
  if (ad === "kanat") { kok.userData.kanatMesh = ac ? yuva.getObjectByName("kozmetik_kanat") : null; kok.userData.suzulme = ac; if (kok.userData.gorunum) ks.vfxEsle(kok); }   // 1G-B.2: süzülme + parıltı
}

/**
 * 1G-A.4 TÜR–KOZMETİK SÖZLEŞMESİ (çalışma anı).
 *   gecir: hiçbir şey · gizle: tür parçasını çökert (bolge turKulak/turAnten) · bicimlendir: ölçek/kaydırma · it: +Z'ye öteleme
 * Tür: Govde.userData.dislama (küre listesi, bind uzayı). Kozmetik: userData.politika (uret.mjs POLITIKA).
 */
export function sozlesmeUygula(ks, kok, m) {
  const govde = kok.getObjectByName("Govde"), dislama = govde?.userData?.dislama ?? {}, politika = m.userData?.politika ?? {};
  if (!Object.keys(dislama).length || !Object.keys(politika).length) return;
  kok.updateMatrixWorld(true);
  const kutu = new THREE.Box3().setFromObject(m);
  for (const [k, kureler] of Object.entries(dislama)) {
    const p = politika[k]; if (!p) continue;
    const kesisir = kureler.some((q) => kutu.distanceToPoint(new THREE.Vector3(...q.merkez).applyMatrix4(kok.matrixWorld)) <= q.r);
    if (!kesisir) continue;
    const tip = typeof p === "string" ? p : p.tip;
    if (tip === "gizle") { const hedef = kureler[0]?.bolge; if (hedef != null) { govde.userData.gizliBolge = [...(govde.userData.gizliBolge ?? []), hedef]; ks.gorunum(kok, kok.userData.gorunum ?? { set: 1, sac: 1 }); } }
    else if (tip === "bicimlendir") { if (p.olcek) m.scale.set(...p.olcek); if (p.kaydir) m.position.add(new THREE.Vector3(...p.kaydir)); }
    else if (tip === "it") m.position.z += p.mesafe ?? 0.03;
    m.userData.uygulanan = { ...(m.userData.uygulanan ?? {}), [k]: tip };
  }
}

/** Kaplan kuyruğu (tür parçası; sirtYuva). */
export function kuyrukTak(ks, kok) {
  const yuva = kok.getObjectByName("sirtYuva"), kaynak = ks.turVeri.kaplan?.kozmetikler.kuyruk;
  if (!yuva || !kaynak || yuva.getObjectByName("kozmetik_kuyruk")) return;
  const m = kaynak.clone(); m.castShadow = false; yuva.add(m);
}
