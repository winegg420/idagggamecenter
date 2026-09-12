// Joker türleri ve arayüz bilgileri (tek kaynak).
// Kurallar ve envanter SUNUCUDA; burası yalnız gösterim.

export const JOKER_BILGI = {
  elli: {
    ad: "50:50",
    aciklama: "İki yanlış şık silinir",
    ikon: "terazi",
    macIci: true,
  },
  sure: {
    ad: "+10 sn",
    aciklama: "Soruya 10 saniye ekler",
    ikon: "saat",
    macIci: true,
  },
  // "Pas" idi: yanlış cevabın cezası olmadığı için soruyu atlamak her zaman
  // rastgele bir şıkka basmaktan kötüydü, joker işlevsizdi. Artık soru
  // atlanmaz; yerine yeni bir soru gelir ve süre baştan başlar.
  soru_degistir: {
    ad: "Soru Değiştir",
    aciklama: "Soruyu değiştirir, süre baştan başlar",
    ikon: "ileriAtla",
    macIci: true,
  },
  seri_koruma: {
    ad: "Seri Koruma",
    aciklama: "Kaçırdığın bir günü telafi eder",
    ikon: "kalkan",
    macIci: false,
  },
};

export const MAC_ICI_JOKERLER = ["elli", "sure", "soru_degistir"];

export function jokerAdi(tur) {
  return JOKER_BILGI[tur]?.ad ?? tur;
}

// Artık emoji değil, <Ikon ad={...} /> için ikon ADI döner.
export function jokerIkon(tur) {
  return JOKER_BILGI[tur]?.ikon ?? "soru";
}

/** RPC'den gelen envanter dizisini { tur: adet } nesnesine çevirir. */
export function envanterNesne(satirlar) {
  const cikti = { elli: 0, sure: 0, soru_degistir: 0, seri_koruma: 0 };
  for (const s of satirlar ?? []) cikti[s.tur] = s.adet ?? 0;
  return cikti;
}
