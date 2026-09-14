// ============================================================
// KABUL SONRASI YAKLAŞMA — saf mantık (Revizyon Paketi 12, madde 5)
//
// Kahve/balon ikramı ya da meydan okuma kabul edilince iki avatar
// birbirine yürür, aralarında ~1,5 birim kalınca yüz yüze durur, sonra
// etkinlik (ikram jesti / selam) oynar. Toplam süre SABİT: mesafe ne olursa
// olsun yürüyüş aynı sürede biter, hız buna göre ölçeklenir.
//
// Ortak saat = sunucunun kabul anı (`basMs`, istemci saatine çevrilmiş).
// İki istemci aynı anı kullandığı için gösteri iki ekranda aynı anda
// başlar. Geç başlayan istemci IŞINLANMAZ: yürüyüş bulunduğu yerden,
// kalan sürede tamamlanır.
//
// MİMARİ ŞARTI: three.js yok, avatar yok — yalnız sayı girer sayı çıkar.
// ============================================================

export const YAKLASMA_YURU_MS = 1600;
export const YAKLASMA_ETKINLIK_MS = 1900;
export const YAKLASMA_ARA = 1.5;
const EN_KISA_YURU_MS = 400;

function yumusak(f) {
  const t = Math.min(1, Math.max(0, f));
  return t * t * (3 - 2 * t);
}

/**
 * @param {{basMs:number, simdiMs:number, ben:{x:number,z:number}, karsi:{x:number,z:number}}} g
 * @returns {object} yaklaşma planı (yaklasmaKonumu'na verilir)
 */
export function yaklasmaKur({ basMs, simdiMs, ben, karsi }) {
  const yuruBitMs = basMs + YAKLASMA_YURU_MS;
  // Geç gelen istemci: yürüyüş şimdiden başlar, en az 400 ms sürer.
  const yuruBasMs = Math.min(Math.max(basMs, simdiMs), yuruBitMs - EN_KISA_YURU_MS);
  const ortaX = (ben.x + karsi.x) / 2, ortaZ = (ben.z + karsi.z) / 2;
  let dx = karsi.x - ben.x, dz = karsi.z - ben.z;
  const d = Math.hypot(dx, dz);
  if (d > 1e-3) { dx /= d; dz /= d; } else { dx = 0; dz = 1; }
  const yarim = YAKLASMA_ARA / 2;
  return {
    basMs,
    yuruBasMs,
    yuruBitMs: Math.max(yuruBitMs, yuruBasMs + EN_KISA_YURU_MS),
    bitMs: Math.max(yuruBitMs, yuruBasMs + EN_KISA_YURU_MS) + YAKLASMA_ETKINLIK_MS,
    ben: { bas: { ...ben }, hedef: { x: ortaX - dx * yarim, z: ortaZ - dz * yarim }, yuz: Math.atan2(dx, dz) },
    karsi: { bas: { ...karsi }, hedef: { x: ortaX + dx * yarim, z: ortaZ + dz * yarim }, yuz: Math.atan2(-dx, -dz) },
  };
}

/**
 * Planın verilen andaki durumu.
 * @param {object} y yaklasmaKur çıktısı
 * @param {'ben'|'karsi'} taraf
 * @returns {{x:number,z:number,aci:number,yuruyor:boolean,evre:'bekle'|'yuru'|'etkinlik'|'bitti',hiz:number}}
 */
export function yaklasmaKonumu(y, simdiMs, taraf) {
  const s = y[taraf];
  const sure = y.yuruBitMs - y.yuruBasMs;
  const f = (simdiMs - y.yuruBasMs) / sure;
  const e = yumusak(f);
  const x = s.bas.x + (s.hedef.x - s.bas.x) * e;
  const z = s.bas.z + (s.hedef.z - s.bas.z) * e;
  const mesafe = Math.hypot(s.hedef.x - s.bas.x, s.hedef.z - s.bas.z);
  const evre = simdiMs >= y.bitMs ? "bitti" : simdiMs >= y.yuruBitMs ? "etkinlik" : f < 0 ? "bekle" : "yuru";
  const yuruyor = evre === "yuru" && mesafe > 0.05;
  const yuruAci = Math.atan2(s.hedef.x - s.bas.x, s.hedef.z - s.bas.z);
  return {
    x, z,
    aci: yuruyor && mesafe > 0.3 ? yuruAci : s.yuz,
    yuruyor,
    evre,
    // Adım temposu için birim/sn (sabit sürede farklı mesafe = farklı hız).
    hiz: yuruyor ? mesafe / (sure / 1000) : 0,
  };
}

/** Sunucu kabul anını istemci saatine çevirir; okunamazsa şimdi. */
export function kabulAniIstemci(yanitAt, sunucuZamani, simdiMs = Date.now()) {
  const kabul = Date.parse(yanitAt);
  const sunucu = Date.parse(sunucuZamani);
  if (!Number.isFinite(kabul)) return simdiMs;
  const fark = Number.isFinite(sunucu) ? sunucu - simdiMs : 0;
  return kabul - fark;
}
