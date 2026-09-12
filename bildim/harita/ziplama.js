// ============================================================
// MEYDAN (The Square) — ZIPLAMA
//
// SAF MANTIK: burada three.js, DOM ya da ağ yok. Yalnız "zıplama şu an
// hangi yükseklikte?" sorusunun cevabı var.
//
// MİMARİ ŞARTI (CLAUDE.md): haritanın görseli ve karakterler ileride
// baştan değişecek. Bu yüzden zıplama üç parçaya bölündü:
//   1. Bu dosya   → fizik/his (yükseklik eğrisi, havada mıyım)
//   2. coklu.js   → ağ (poz paketinde `h` alanı)
//   3. dunya.js   → çizim (verilen yüksekliği avatara uygular)
// Modeller değişince yalnız 3. parça değişir; buradaki hiçbir satır değil.
//
// Yükseklik ve süre OYUN AYARI DEĞİL, HİS meselesi — `oyun_ayarlari`'na
// değil, buradaki tek sabite yazılır (görev metnindeki açık karar).
// ============================================================

/** Zıplamanın hissi. Tek yer burası. */
export const ZIPLAMA = {
  yukseklik: 1.9,   // dünya birimi — avatar boyunun yarısından biraz fazla
  sure: 0.62,       // saniye — kalkıştan yere dönüşe kadar
};

/**
 * Parabolik yükseklik: 0'da başlar, ortada tepe yapar, sonda 0'a döner.
 * @param {number} oran 0..1 arası zıplamanın neresindeyiz
 * @returns {number} yükseklik (dünya birimi)
 */
export function ziplamaYuksekligi(oran) {
  if (!(oran > 0) || oran >= 1) return 0;
  return 4 * ZIPLAMA.yukseklik * oran * (1 - oran);
}

/**
 * Tek bir karakterin zıplama durumu.
 * Kullanım: her karede `ilerlet(dt)` çağır, dönen yüksekliği çizime ver.
 */
export function ziplamaKur() {
  let gecen = -1;   // -1: yerde

  return {
    /**
     * Zıplamayı başlatır. Havadayken çağrılırsa hiçbir şey yapmaz —
     * ikinci zıplama yok (görev kuralı).
     * @returns {boolean} zıplama gerçekten başladıysa true
     */
    basla() {
      if (gecen >= 0) return false;
      gecen = 0;
      return true;
    },

    /**
     * Zamanı ilerletir.
     * @param {number} dt saniye
     * @returns {number} bu karedeki yükseklik (yerdeyse 0)
     */
    ilerlet(dt) {
      if (gecen < 0) return 0;
      gecen += dt;
      if (gecen >= ZIPLAMA.sure) { gecen = -1; return 0; }
      return ziplamaYuksekligi(gecen / ZIPLAMA.sure);
    },

    /** Yerde miyim? (düğmenin pasif görünmesi için) */
    get havada() { return gecen >= 0; },

    /** Sahne kapanırken / oyuncu ışınlanırken sıfırla. */
    sifirla() { gecen = -1; },
  };
}
