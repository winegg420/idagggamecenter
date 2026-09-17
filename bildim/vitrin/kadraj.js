// ============================================================
// KART KADRAJLARI — TEK KAYNAK (Paket 21 §E.2)
//
// Hem iki vitrin ekranı (Görünüm vitrini · Dükkân › Görünüm) hem muayenenin `portre_kadraj` testi buradan okur.
// Burada three.js YOK: vitrin sayfaları three'yi tembel yükler, kadraj tablosu için erken yüklenmesin.
// Kadraj tanımları (fov/konum/bak) vitrinSahne.js › KADRAJ; bu dosya yalnız KOZMETİK → KADRAJ eşlemesi.
// ============================================================

/** Kozmetik kodu → kart kadrajı. Bilinmeyen kozmetik "bas" kadrajıyla çekilir. */
export const KOZMETIK_KADRAJ = {
  pelerin: "sirt",
  kanat: "kanat",
  // Paket 21 §E.2: atkı "bas" kadrajında kadrajın alt kenarında kalıyor, kart satılan şeyi göstermiyordu (ölçüldü).
  atki: "govde",
};
