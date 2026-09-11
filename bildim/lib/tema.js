// ============================================================
// AÇIK / KOYU TEMA
//
// Üç durum vardır:
//   "cihaz" → telefonun/işletim sisteminin temasını izler (VARSAYILAN)
//   "acik"  → her zaman açık
//   "koyu"  → her zaman koyu
//
// Oyuncu düğmeye dokununca "cihaz" bırakılır ve seçim localStorage'a yazılır;
// bir daha dokunana kadar o seçim geçerlidir.
//
// Uygulanan tema <html data-tema="acik|koyu"> olarak yazılır; CSS yalnız bu
// özniteliğe bakar. Böylece tek yerden çevrilir, bileşenler bilmek zorunda
// kalmaz.
//
// İLK BOYA: seçim main.jsx'te React'ten ÖNCE uygulanır (temaBaslat), yoksa
// koyu tema seçmiş oyuncu bir kare beyaz ekran görür.
// ============================================================

const ANAHTAR = "bildim_tema";
const dinleyiciler = new Set();
let sistemSorgu = null;

/** localStorage'daki tercih: "cihaz" | "acik" | "koyu". */
export function temaTercihi() {
  try {
    const t = localStorage.getItem(ANAHTAR);
    return t === "acik" || t === "koyu" ? t : "cihaz";
  } catch {
    return "cihaz"; // özel mod / depolama kapalı
  }
}

/** Cihaz koyu tema mı istiyor? */
export function cihazKoyuMu() {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  } catch {
    return false;
  }
}

/** Şu an ekranda olan tema: "acik" | "koyu". */
export function etkinTema() {
  const t = temaTercihi();
  if (t === "cihaz") return cihazKoyuMu() ? "koyu" : "acik";
  return t;
}

function uygula() {
  const tema = etkinTema();
  try {
    const kok = document.documentElement;
    kok.dataset.tema = tema;
    // Tarayıcı varsayılanları (form denetimleri, kaydırma çubuğu) da uysun
    kok.style.colorScheme = tema === "koyu" ? "dark" : "light";
    // Adres çubuğu rengi: koyuda gece laciverti, açıkta gökyüzü
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "koyu" ? "#0B1220" : "#CDEEFF");
  } catch {
    /* SSR / belge yok */
  }
  for (const f of dinleyiciler) {
    try { f(tema); } catch (e) { console.error("[Tema] dinleyici:", e); }
  }
  return tema;
}

/**
 * Uygulama açılırken bir kez çağrılır (main.jsx, React'ten önce).
 * Cihaz teması değişirse ("cihaz" tercihindeyken) canlı olarak uyar.
 */
export function temaBaslat() {
  uygula();
  try {
    sistemSorgu = window.matchMedia?.("(prefers-color-scheme: dark)");
    // Cihaz temasını yalnız "cihaz" tercihindeyken izliyoruz.
    sistemSorgu?.addEventListener?.("change", () => {
      if (temaTercihi() === "cihaz") uygula();
    });
  } catch {
    /* eski tarayıcı: canlı takip yok, ilk uygulama yeterli */
  }
}

/** Açık ↔ koyu çevirir ve seçimi kalıcı yapar. Yeni temayı döndürür. */
export function temaDegistir() {
  const yeni = etkinTema() === "koyu" ? "acik" : "koyu";
  try { localStorage.setItem(ANAHTAR, yeni); } catch { /* özel mod */ }
  return uygula();
}

/** Tema değişince haber ver; abonelikten çıkma fonksiyonu döner. */
export function temayaAbone(fn) {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
}
