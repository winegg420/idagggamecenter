// Maç arası geçiş reklamı için sıklık kuralları (tamamı istemci tarafında,
// yalnız reklam GÖSTERİMİNİ sınırlar — ödül/puan kararı değildir).
//
// Kurallar (BILDIM_GOREV4 / Faz 2):
//   • İlk 3 maçta reklam yok (yeni oyuncu rahatsız edilmez)
//   • Sonrasında her 3 maçta bir
//   • Günde en fazla 10 geçiş reklamı

import { gecisReklamiGoster } from "./h5ads.js";

const ANAHTAR = "bildim_reklam";
const ILK_MUAFIYET = 3;
const HER_KAC_MACTA = 3;
const GUNLUK_SINIR = 10;

const bugun = () => new Date().toISOString().slice(0, 10);

function oku() {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    const d = ham ? JSON.parse(ham) : null;
    if (!d || d.gun !== bugun()) {
      return { mac: d?.mac ?? 0, gun: bugun(), bugunGosterilen: 0 };
    }
    return { mac: d.mac ?? 0, gun: d.gun, bugunGosterilen: d.bugunGosterilen ?? 0 };
  } catch {
    return { mac: 0, gun: bugun(), bugunGosterilen: 0 };
  }
}

function yaz(d) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(d));
  } catch {
    /* özel mod — sayaç tutulamaz, reklam gösterilmez */
  }
}

/**
 * Bir maç bittiğinde çağrılır. Kurallar uygunsa geçiş reklamı gösterir.
 * Her durumda çözülür; oyun akışını asla bloklamaz.
 */
export async function macBittiReklam() {
  const d = oku();
  d.mac += 1;

  const uygun =
    d.mac > ILK_MUAFIYET &&
    d.mac % HER_KAC_MACTA === 0 &&
    d.bugunGosterilen < GUNLUK_SINIR;

  if (!uygun) {
    yaz(d);
    return { gosterildi: false, sebep: d.mac <= ILK_MUAFIYET ? "ilk_maclar" : "siklik" };
  }

  try {
    const sonuc = await gecisReklamiGoster();
    if (sonuc?.gosterildi) d.bugunGosterilen += 1;
    yaz(d);
    return sonuc ?? { gosterildi: false };
  } catch {
    yaz(d);
    return { gosterildi: false };
  }
}

/** Test/teşhis için sayaç durumu. */
export function reklamDurumu() {
  return oku();
}
