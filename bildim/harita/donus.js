// ============================================================
// MEYDANA DÖNÜŞ — konum hafızası
//
// Meydandan bir maça/turnuvaya giren oyuncu, maç bitince haritaya geri
// döner ve karakteri TAM OLARAK ayrıldığı noktada doğar.
//
// MİMARİ: burada yalnız MANTIK var — konumun nerede saklandığı ve ne zaman
// tüketildiği. 3B model, animasyon ve kamera bu dosyayı hiç bilmez; harita
// görseli baştan değişse bile bu akış aynen çalışır.
//
// Konum sessionStorage'da tutulur: veritabanına yazmaya değmez (oturumluk,
// kişisel ve kaybolursa oyuncu yalnız meydanın ortasında doğar).
// ============================================================

const ANAHTAR = "bildim_meydan_donus";
const OMUR_MS = 2 * 60 * 60 * 1000;   // 2 saat sonra kayıt bayat sayılır

/**
 * Meydandan çıkarken çağrılır.
 * @param {{x:number, z:number, aci:number}} konum
 */
export function donusKaydet(konum) {
  try {
    if (!konum || !Number.isFinite(konum.x) || !Number.isFinite(konum.z)) return;
    sessionStorage.setItem(ANAHTAR, JSON.stringify({
      x: +konum.x.toFixed(2),
      z: +konum.z.toFixed(2),
      aci: +(konum.aci ?? 0).toFixed(3),
      at: Date.now(),
    }));
  } catch {
    /* özel mod: konum hatırlanmaz, oyuncu meydanın ortasında doğar */
  }
}

/** Kayıt varsa döndürür (bayatsa null). Tüketmez. */
export function donusOku() {
  try {
    const ham = sessionStorage.getItem(ANAHTAR);
    if (!ham) return null;
    const d = JSON.parse(ham);
    if (!d || !Number.isFinite(d.x) || Date.now() - (d.at ?? 0) > OMUR_MS) {
      donusTemizle();
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

/** Meydana dönülecek mi? (maç sonu ekranları bunu sorar) */
export function meydanaDonulecek() {
  return donusOku() !== null;
}

export function donusTemizle() {
  try {
    sessionStorage.removeItem(ANAHTAR);
  } catch {
    /* yut */
  }
}
