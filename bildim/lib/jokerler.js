import { tt } from "./dil.js";
// Joker türleri ve arayüz bilgileri (tek kaynak).
// Kurallar ve envanter SUNUCUDA; burası yalnız gösterim.

export const JOKER_BILGI = {
  elli: {
    ad: "50:50",
    aciklama: tt("İki yanlış şık silinir"),
    ikon: "terazi",
    macIci: true,
  },
  sure: {
    ad: tt("+10 sn"),
    aciklama: tt("Soruya 10 saniye ekler"),
    ikon: "saat",
    macIci: true,
  },
  // "Pas" idi: yanlış cevabın cezası olmadığı için soruyu atlamak her zaman
  // rastgele bir şıkka basmaktan kötüydü, joker işlevsizdi. Artık soru
  // atlanmaz; yerine yeni bir soru gelir ve süre baştan başlar.
  soru_degistir: {
    ad: tt("Soru Değiştir"),
    aciklama: tt("Soruyu değiştirir, süre baştan başlar"),
    ikon: "ileriAtla",
    macIci: true,
  },
  // ---- Düello saldırı jokerleri (Paket 14, 4.5) — yalnız Saldırı Hazırlığı'nda ----
  zaman_baskisi: {
    ad: tt("Zaman Baskısı"),
    aciklama: tt("Rakibin cevap süresi 15 sn'den 10 sn'ye düşer"),
    ikon: "hizli",
    macIci: false,
    saldiri: true,
  },
  saldiri_degistir: {
    ad: tt("Soru Değiştir (saldırı)"),
    aciklama: tt("Aynı kategoriden başka bir soru gönderir"),
    ikon: "yenile",
    macIci: false,
    saldiri: true,
  },
  savunma_kilidi: {
    ad: tt("Savunma Kilidi"),
    aciklama: tt("Rakip bu soruda savunma jokeri kullanamaz"),
    ikon: "kilit",
    macIci: false,
    saldiri: true,
  },
  seri_koruma: {
    ad: tt("Seri Koruma"),
    aciklama: tt("Kaçırdığın bir günü telafi eder"),
    ikon: "kalkan",
    macIci: false,
  },
};

export const MAC_ICI_JOKERLER = ["elli", "sure", "soru_degistir"];
export const SALDIRI_JOKERLERI = ["zaman_baskisi", "saldiri_degistir", "savunma_kilidi"];

export function jokerAdi(tur) {
  return JOKER_BILGI[tur]?.ad ?? tur;
}

// Artık emoji değil, <Ikon ad={...} /> için ikon ADI döner.
export function jokerIkon(tur) {
  return JOKER_BILGI[tur]?.ikon ?? "soru";
}

/** RPC'den gelen envanter dizisini { tur: adet } nesnesine çevirir. */
export function envanterNesne(satirlar) {
  const cikti = { elli: 0, sure: 0, soru_degistir: 0, seri_koruma: 0,
    zaman_baskisi: 0, saldiri_degistir: 0, savunma_kilidi: 0 };
  for (const s of satirlar ?? []) cikti[s.tur] = s.adet ?? 0;
  return cikti;
}
