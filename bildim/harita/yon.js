// ============================================================
// EKRAN YÖNÜ — teşhis + "yatay moda geç"
//
// Sahibi telefonu yan çevirdiğinde meydan dönmüyordu. Ölçüm tarafı (kanvas
// boyutu) çalışıyor; sorun cihazın HİÇ DÖNMEMESİ. En olası sebep: oyun ana
// ekrana eklenmişse, kurulu uygulama manifest'i KURULUM ANINDA okur ve eski
// `"orientation": "portrait"` kilidini taşımaya devam eder. `orientation.
// unlock()` bunu açmaz — o yalnız KODLA konmuş kilidi açar.
//
// Bu yüzden iki şey yapıyoruz:
//   1) Durumu okunur biçimde raporlamak (konsol + HUD),
//   2) Oyuncuya açık bir "yatay moda geç" düğmesi vermek. Kilit yalnız TAM
//      EKRANDA ve Android Chrome'da çalışır; iOS Safari desteklemez, orada
//      düğme uyarı gösterir — hata vermez.
// ============================================================

/** Anlık yön/görüntü durumu. */
export function yonDurumu() {
  let ekran = null, aci = null;
  try {
    ekran = screen.orientation?.type ?? null;
    aci = screen.orientation?.angle ?? null;
  } catch { /* eski tarayıcı */ }
  let kurulu = false;
  try {
    kurulu = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;   // iOS
  } catch { /* yok */ }
  return {
    ekran,
    aci,
    kurulu,
    tamEkran: Boolean(document.fullscreenElement),
    pencere: [window.innerWidth, window.innerHeight],
  };
}

/** Tek satırlık okunur özet (HUD'da gösterilir, ekran görüntüsüyle iletilir). */
export function yonOzeti(d = yonDurumu()) {
  return [
    d.ekran ?? "yön?",
    d.aci === null ? "açı?" : `${d.aci}°`,
    d.kurulu ? "kurulu" : "tarayıcı",
    d.tamEkran ? "tam ekran" : "pencere",
    `${d.pencere[0]}×${d.pencere[1]}`,
  ].join(" · ");
}

/** Kilit desteği var mı (Android Chrome'da var, iOS Safari'de yok). */
export function kilitDesteklenirMi() {
  try {
    return typeof screen?.orientation?.lock === "function";
  } catch {
    return false;
  }
}

/**
 * Yatay moda geçer. Kilit yalnız tam ekranda çalıştığı için önce tam ekrana
 * geçilir.
 * @returns {Promise<{oldu:boolean, mesaj?:string}>}
 */
export async function yatayaGec(kapsayici) {
  try {
    if (!document.fullscreenElement) {
      const istek = kapsayici?.requestFullscreen
        ?? kapsayici?.webkitRequestFullscreen
        ?? document.documentElement.requestFullscreen;
      if (istek) await istek.call(kapsayici ?? document.documentElement);
    }
    if (!kilitDesteklenirMi()) {
      return { oldu: false, mesaj: "Cihazın bunu desteklemiyor — telefonun otomatik döndürme ayarını aç." };
    }
    await screen.orientation.lock("landscape");
    return { oldu: true };
  } catch (e) {
    console.error("[Meydan] yatay kilit:", e);
    return { oldu: false, mesaj: "Cihazın bunu desteklemiyor — telefonun otomatik döndürme ayarını aç." };
  }
}

/** Dikeye döner: kilidi açar, tam ekrandan çıkar. */
export async function dikeyeDon() {
  try { screen.orientation?.unlock?.(); } catch (e) { console.error("[Meydan] unlock:", e); }
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.();
  } catch (e) {
    console.error("[Meydan] tam ekrandan cikilamadi:", e);
  }
}
