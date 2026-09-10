// Bildim — cevap geri bildirimi ortak yardımcıları
//
// Beş oyun ekranı (1v1, grup, hızlı maç, hızlı mod, çalışma) aynı geri
// bildirim penceresini kullanır. Süreler ve yardımcılar tek yerde dursun ki
// bir ekranda düzeltilen davranış diğerlerinde eskimesin.

/** Standart geri bildirim penceresi (ms). Cevaptan sonraki soru gelene kadar. */
export const GB_MS = 1400;

/**
 * Hızlı modlarda pencere kısadır: soru başına 5 sn var ve sunucu bir sonraki
 * sorunun süresini CEVAP anında başlatıyor. 700 ms, sunucudaki 1 sn'lik ağ
 * payının içinde kalır (5000 + 700 < 6000), yani hiçbir cevap süre dolmuş
 * sayılmaz. Bu değeri artırma — sunucu mantığına dokunmadan güvenli üst sınır.
 */
export const GB_HIZLI_MS = 700;

/** Kullanıcı hareket azaltma istemiş mi? (her animasyondan önce sorulur) */
export function hareketAzalt() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false; // matchMedia yoksa animasyonlar açık kalsın
  }
}

/**
 * Titreşim. Desteklenmeyen cihazda (iOS Safari) sessizce geçer.
 * desen: sayı ya da [titret, bekle, titret] dizisi.
 */
export function titret(desen) {
  try {
    if (hareketAzalt()) return;
    navigator.vibrate?.(desen);
  } catch {
    /* tarayıcı izin vermedi — dokunsal geri bildirim yok, oyun etkilenmez */
  }
}

/**
 * 1v1 / grup / turnuva puan formülü — sunucudaki hesabın birebir aynısı:
 *   dogru ise 10 + clamp(0..15, ceil(kalan + 1)), değilse 0
 * Sunucu RPC'leri kazanılan puanı geri döndürmüyor; uçan "+16" rozetini
 * çizebilmek için istemci aynı formülü uygular. Skorun kendisi her zaman
 * sunucudan gelir; bu yalnız gösterimdir.
 */
export function macPuani(kalanSn, dogru) {
  if (!dogru) return 0;
  return 10 + Math.max(0, Math.min(15, Math.ceil(kalanSn + 1)));
}
