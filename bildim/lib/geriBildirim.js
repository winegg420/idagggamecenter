// Bildim — cevap geri bildirimi ortak yardımcıları
//
// Beş oyun ekranı (1v1, grup, hızlı maç, hızlı mod, çalışma) aynı geri
// bildirim penceresini kullanır. Süreler ve yardımcılar tek yerde dursun ki
// bir ekranda düzeltilen davranış diğerlerinde eskimesin.

/**
 * Standart geri bildirim penceresi (ms): cevaptan sonra doğru/yanlış bu kadar
 * ekranda kalır, sonra bir sonraki soru gelir.
 *
 * 2000 idi; bota karşı oynarken bekleme fazla geliyordu — doğru/yanlış zaten
 * ilk anda görünüyor, kalan süre boş bekleme oluyordu. Sahibinin kararı:
 * oyuncu bekletilmeyecek, 1 sn yeter.
 */
export const GB_MS = 1000;

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
 *   doğru ise 10, değilse 0.
 *
 * Hız bonusu KALDIRILDI (migration 143): refleks bilgiyi bastırıyordu.
 * `kalanSn` imza uyumu için duruyor, puana etki etmiyor. Skorun kendisi her
 * zaman sunucudan gelir; bu yalnız uçan "+10" rozeti içindir.
 */
export function macPuani(kalanSn, dogru) {
  return dogru ? 10 : 0;
}
