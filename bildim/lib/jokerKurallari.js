import { tt } from "./dil.js";

// ============================================================
// JOKER KURALLARI — TEK KAYNAK (Paket 28 B)
//
// NEDEN BU DOSYA VAR: Paket 27'de kurallar değişti ama Dükkân'daki anlatım
// eskisiyle kaldı; oyuncu canlıda "maç başına en fazla 2 joker, arkadaş
// maçlarında sınırsız" yazısını okudu — ikisi de artık yanlıştı. Kural iki
// yerde iki türlü yazıldığı sürece biri hep geride kalır.
//
// KURALI DEĞİŞTİREN BURAYI DEĞİŞTİRİR. Sunucudaki karşılıkları:
//   · toplam hak            → oyun_ayarlari.duello_joker_hak (4)
//   · aynı tür bir kez      → joker_hak_kontrol()
//   · ücretsiz 50:50        → joker_ucretsiz_elli_hakki()  (yalnız serbest 1v1)
//   · turnuva finali/altın  → joker_mac_siniri()           (0 döner)
//
// Sayı `duello_joker_hak` ayarından gelmeli; arayüz onu `joker_mac_durumu`
// ya da `duello_durum` üzerinden zaten biliyor. Bilinmiyorsa 4 varsayılır.
// ============================================================

/**
 * Joker kurallarının tam anlatımı, madde madde.
 * @param {number} [hak] maç başına toplam joker hakkı (sunucudan)
 * @returns {string[]} her biri bir cümle
 */
export function jokerKurallari(hak = 4) {
  return [
    tt("Bir maçta en çok {0} joker kullanabilirsin.", { 0: hak }),
    tt("Aynı jokeri bir maçta yalnız bir kez kullanabilirsin — hakkını farklı jokerlere dağıt."),
    tt("Ücretsiz 50:50 yalnız Serbest Klasik Mod'da; Dereceli maçta ve Düello'da hiçbir joker ücretsiz değil."),
    tt("Turnuva finalinde ve altın soruda joker kullanılamaz."),
    tt("Jokerin bittiyse maçın içinden alabilirsin — dükkâna gitmene gerek yok."),
  ];
}

/** Tek satırlık kısa özet (dar alanlar için). */
export function jokerKuraliOzet(hak = 4) {
  return tt("Maç başına en çok {0} joker · aynı joker bir kez", { 0: hak });
}
