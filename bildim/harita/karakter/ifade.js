// ============================================================
// İFADE + GÖZ KIRPMA (Aşama 1C/1G → ortak modül, Aşama 2B §1)
//
// Yüz atlasa boyalı: göz ve ağız dörtgenlerinin UV'si ifade karesine kaydırılır (geometri karakter başına klon).
// Tüketiciler: harita/deneme/DenemeSayfasi.jsx (laboratuvar) · harita/dunya.js (gerçek harita).
// ============================================================

/** Göz/ağız dörtgenlerinin UV'sini ifade karesine kaydır. Govde görünümü (karakter.js gorunumUygula) kurulmuş olmalı. */
export function ifadeAyarla(kok, gozAd, agizAd) {
  const mesh = kok.getObjectByName("Govde"); if (!mesh?.userData.ozel) return;
  const u = mesh.userData, geo = mesh.geometry, uv = geo.attributes.uv, bolge = geo.attributes._bolge, T = mesh.userData.temel;
  const K = u.ifade.kareler, robot = u.tur === "robot";
  const gozNo = u.ifade.goz[robot ? (gozAd === "kirpik" || gozAd === "mutlu" ? "robotKapali" : "robotAcik") : gozAd] ?? u.ifade.temelGoz;
  const agizNo = u.ifade.agiz[robot ? (agizAd === "gulumseme" || agizAd === "sirit" ? "robotGulus" : "robotNotr") : agizAd] ?? u.ifade.temelAgiz;
  const tasi = (i, kaynakNo, hedefNo) => { const a = K[kaynakNo], b = K[hedefNo]; const ou = T.uv[i * 2], ov = T.uv[i * 2 + 1]; const nu = (ou - a.u0) / (a.u1 - a.u0), nv = (ov - a.v0) / (a.v1 - a.v0); uv.setXY(i, b.u0 + (b.u1 - b.u0) * nu, b.v0 + (b.v1 - b.v0) * nv); };
  for (let i = 0; i < uv.count; i++) {
    const b = bolge.getX(i);
    if (b === u.bolge.gozL || b === u.bolge.gozR) tasi(i, u.ifade.temelGoz, gozNo);
    else if (b === u.bolge.agiz) tasi(i, u.ifade.temelAgiz, agizNo);
  }
  uv.needsUpdate = true;
  kok.userData.ifade = { goz: gozAd, agiz: agizAd };
}

/** Adlı ifade: normal · gulumseme (kaş yukarı + göz kavisi; baş eğimi karakter.js karesinde) · saskin. */
export function ifadeSec(kok, ad) {
  const [goz, agiz] = ad === "gulumseme" ? ["mutlu", "gulumseme"] : ad === "saskin" ? ["saskin", "saskin"] : ["acik", "notr"];
  kok.userData.temelGoz = goz; ifadeAyarla(kok, goz, agiz);
}

/**
 * Göz kırpma: her karakter kendi zamanlayıcısıyla, 120 ms kapalı, 3–6 sn arayla.
 * `canlilar` = Set<{kok, sonraki, kapali}> (KarakterSistemi tutar).
 */
export function canliEkle(canlilar, kok) {
  const c = { kok, sonraki: performance.now() + 1500 + Math.random() * 3500, kapali: 0 };
  canlilar.add(c); kok.userData.canli = c;
}
export function canliSil(canlilar, kok) { if (kok.userData.canli) canlilar.delete(kok.userData.canli); }
export function kirpmaGuncelle(canlilar, t) {
  for (const c of canlilar) {
    if (!c.kok.parent) { canlilar.delete(c); continue; }
    if (c.kok.userData.kirpmaYok) continue;   // hafif (kalabalık) karakter
    const g = c.kok.userData.ifade ?? { goz: "acik", agiz: "notr" };
    if (c.kapali && t > c.kapali) { c.kapali = 0; ifadeAyarla(c.kok, c.kok.userData.temelGoz ?? "acik", g.agiz); c.sonraki = t + 3000 + Math.random() * 3000; }
    else if (!c.kapali && t > c.sonraki) { c.kapali = t + 120; ifadeAyarla(c.kok, "kirpik", g.agiz); }
  }
}
