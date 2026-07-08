// ============================================================
// Silah ve kalkan veri modeli (tasarım 3.1, 3.2.2).
// Tüm saldırı silahları EŞİT güçte — sadece görsel/tema farkı (tasarım 3.1).
// Varyantlar da kendi içinde eşit güçte (tasarım 3.2.2).
// ============================================================

// Saldırı silahı kategorileri. Her kategori kendi alt varyantlarına sahip.
export const SILAHLAR = [
  {
    anahtar: "kilic", ad: "Kılıç", cizim: "kilic",
    varyantlar: [
      { id: "kilic_1", ad: "Legion Kılıcı" },
      { id: "kilic_2", ad: "Gladius" },
      { id: "kilic_sica", ad: "Sica (kıvrık)", cizim: "sica" },
      { id: "kilic_4", ad: "Uzun Kılıç" },
    ],
  },
  {
    anahtar: "bicak", ad: "Bıçak", cizim: "bicak",
    varyantlar: [
      { id: "bicak_1", ad: "Hançer" },
      { id: "bicak_2", ad: "Pugio" },
      { id: "bicak_3", ad: "Kesici" },
    ],
  },
  {
    anahtar: "cift_bicak", ad: "Çift Bıçak", cizim: "cift_bicak",
    varyantlar: [
      { id: "cift_1", ad: "İkiz Hançer" },
      { id: "cift_2", ad: "Pençeler" },
      { id: "cift_3", ad: "Gölge Bıçaklar" },
    ],
  },
  {
    anahtar: "mizrak", ad: "Mızrak", cizim: "mizrak",
    varyantlar: [
      { id: "mizrak_1", ad: "Hasta" },
      { id: "mizrak_2", ad: "Uzun Mızrak" },
      { id: "mizrak_trident", ad: "Trident (üç dişli)", cizim: "trident" },
    ],
  },
  {
    anahtar: "balta", ad: "Balta", cizim: "balta",
    varyantlar: [
      { id: "balta_1", ad: "Savaş Baltası" },
      { id: "balta_2", ad: "Çift Ağız" },
      { id: "balta_cekic", ad: "Savaş Çekici", cizim: "cekic" },
    ],
  },
  {
    anahtar: "zincirli_topuz", ad: "Zincirli Topuz", cizim: "zincirli_topuz",
    varyantlar: [
      { id: "flail_1", ad: "Flail" },
      { id: "flail_2", ad: "Dikenli Topuz" },
      { id: "flail_3", ad: "Ağır Topuz" },
    ],
  },
];

// Kalkanlar (tasarım 3.2.2: yuvarlak, küçük, kare, şövalye, savaşçı).
export const KALKANLAR = {
  anahtar: "kalkan", ad: "Kalkan",
  varyantlar: [
    { id: "yuvarlak", ad: "Yuvarlak Kalkan", cizim: "yuvarlak" },
    { id: "kucuk", ad: "Küçük Kalkan", cizim: "kucuk" },
    { id: "kare", ad: "Kare Kalkan", cizim: "kare" },
    { id: "sovalye", ad: "Şövalye Kalkanı", cizim: "sovalye" },
    { id: "savasci", ad: "Savaşçı Kalkanı", cizim: "savasci" },
  ],
};

// Amblemler (tasarım 3.2.2: kalkan/zırh üzerine — kartal, aslan, alev...).
export const AMBLEMLER = [
  { id: "yok", ad: "Yok" },
  { id: "kartal", ad: "Kartal" },
  { id: "aslan", ad: "Aslan Başı" },
  { id: "alev", ad: "Alev" },
  { id: "kilic_amblem", ad: "Çapraz Kılıç" },
];

export function silahKategoriBul(anahtar) {
  return SILAHLAR.find((s) => s.anahtar === anahtar) || SILAHLAR[0];
}

// Bir silah varyant id'sinden çizim tipini bul (varyantın kendi cizim'i varsa onu, yoksa kategorininki).
export function silahCizimTipi(anahtar, varyantId) {
  const kat = silahKategoriBul(anahtar);
  const v = kat.varyantlar.find((x) => x.id === varyantId);
  return (v && v.cizim) || kat.cizim;
}

export function kalkanCizimTipi(varyantId) {
  const v = KALKANLAR.varyantlar.find((x) => x.id === varyantId);
  return (v && v.cizim) || "yuvarlak";
}
