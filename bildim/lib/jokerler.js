// Joker türleri ve arayüz bilgileri (tek kaynak).
// Kurallar ve envanter SUNUCUDA; burası yalnız gösterim.

export const JOKER_BILGI = {
  elli: {
    ad: "50:50",
    aciklama: "İki yanlış şık silinir",
    ikon: "⚖️",
    macIci: true,
  },
  sure: {
    ad: "+10 sn",
    aciklama: "Soruya 10 saniye ekler",
    ikon: "⏱️",
    macIci: true,
  },
  pas: {
    ad: "Pas",
    aciklama: "Soruyu atlar (puan yok)",
    ikon: "⏭️",
    macIci: true,
  },
  seri_koruma: {
    ad: "Seri Koruma",
    aciklama: "Kaçırdığın bir günü telafi eder",
    ikon: "🛡️",
    macIci: false,
  },
};

export const MAC_ICI_JOKERLER = ["elli", "sure", "pas"];

export function jokerAdi(tur) {
  return JOKER_BILGI[tur]?.ad ?? tur;
}

export function jokerIkon(tur) {
  return JOKER_BILGI[tur]?.ikon ?? "❔";
}

/** RPC'den gelen envanter dizisini { tur: adet } nesnesine çevirir. */
export function envanterNesne(satirlar) {
  const cikti = { elli: 0, sure: 0, pas: 0, seri_koruma: 0 };
  for (const s of satirlar ?? []) cikti[s.tur] = s.adet ?? 0;
  return cikti;
}
