// ============================================================
// DİKEY KAYDIRMA ÇUBUĞU GENİŞLİĞİ → --bd-cubuk
//
// NEDEN: `100vw` (ve `50vw`) dikey kaydırma çubuğunu DA sayar. Üst blok
// `calc(50% - 50vw)` ile tam genişliğe taşarken masaüstünde çubuk kadar
// (≈7-8px) fazla taşıyordu; sayfa gerçekten içerik alanından geniş oluyordu
// (ölçüm: .bd-ust-blok sağ kenarı 1192, içerik alanı 1185).
//
// `overflow-x: clip` bunu yalnız GİZLİYORDU; burada gerçekten düzeltiyoruz:
// çubuk genişliği ölçülüp CSS değişkenine yazılır, taşan kurallar bu kadarını
// geri alır. Ölçülemezse değişken 0px kalır ve eski davranış sürer.
// ============================================================

/** Çubuk genişliğini ölçer ve <html> üzerine `--bd-cubuk` olarak yazar. */
export function cubukOlc() {
  try {
    const kok = document.documentElement;
    const genislik = Math.max(0, window.innerWidth - kok.clientWidth);
    kok.style.setProperty("--bd-cubuk", `${genislik}px`);
  } catch {
    /* belge yok (SSR) — değişken tanımsız kalır, CSS 0px varsayar */
  }
}

/**
 * Açılışta bir kez çağrılır.
 *
 * Tek ölçüm YETMEZ: açılış anında sayfa daha kısadır, dikey çubuk henüz yoktur
 * ve ölçüm 0 çıkar. İçerik uzayınca çubuk belirir, bu yüzden belge boyu
 * değiştikçe (ResizeObserver) ve pencere boyutlanınca yeniden ölçülür.
 */
export function cubukBaslat() {
  cubukOlc();
  try {
    window.addEventListener("resize", cubukOlc);
    window.addEventListener("orientationchange", cubukOlc);
    window.addEventListener("load", cubukOlc);
    // İKİ ELEMAN DA gözlenir:
    //   • <body> — içerik uzayınca değişir,
    //   • <html> — çubuk belirdiği AN genişliği daralır (390 → 375). Asıl
    //     yakalamak istediğimiz olay bu. Yalnız gövde gözlenince, veri geç
    //     gelip çubuk sonradan belirdiğinde tetiklenmiyor ve değişken 0px'te
    //     kalıyordu (dükkân sayfasında ölçüldü).
    if (typeof ResizeObserver === "function") {
      const gozcu = new ResizeObserver(cubukOlc);
      gozcu.observe(document.documentElement);
      gozcu.observe(document.body);
    }
    // İlk boyalar arasında çubuk sonradan belirebilir; birkaç kez daha bak.
    for (const ms of [0, 300, 1200, 3000]) setTimeout(cubukOlc, ms);
  } catch {
    /* eski tarayıcı: ilk ölçüm yeterli */
  }
}
