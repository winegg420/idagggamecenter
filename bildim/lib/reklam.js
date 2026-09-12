// Maç arası geçiş reklamı için sıklık kuralları (tamamı istemci tarafında,
// yalnız reklam GÖSTERİMİNİ sınırlar — ödül/puan kararı değildir).
//
// Kurallar (onaylanmış ekonomi — sayılar oyun_ayarlari'nda):
//   • İlk 3 GÜN hiç reklam yok (hesap oluşturma tarihinden itibaren).
//     Eskiden "ilk 3 maç"tı; yeni oyuncunun ilk günleri korunmuş olmuyordu.
//   • Sonrasında her 3 maçta bir geçiş reklamı
//   • Günde en fazla 10 geçiş reklamı (gösterim tavanı, ödül tavanı ayrı)

import { gecisReklamiGoster } from "./h5ads.js";
import { ayar } from "./ayarlar.js";

const ANAHTAR = "bildim_reklam";
const HER_KAC_MACTA_VARSAYILAN = 3;
const MUAFIYET_GUN_VARSAYILAN = 3;
const GUNLUK_SINIR = 10;

/** Hesap kaç gün önce açıldı? Bilinmiyorsa muafiyet uygulanmaz. */
function hesapYasiGun(kayitTarihi) {
  if (!kayitTarihi) return Infinity;
  const t = new Date(kayitTarihi).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 86400000;
}

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
export async function macBittiReklam(kayitTarihi) {
  const d = oku();
  d.mac += 1;

  const [aralikAyar, muafiyetGun] = await Promise.all([
    ayar("reklam_gecis_mac_araligi", HER_KAC_MACTA_VARSAYILAN),
    ayar("reklam_muafiyet_gun", MUAFIYET_GUN_VARSAYILAN),
  ]);
  const aralik = Math.max(1, aralikAyar);
  const yeniOyuncu = hesapYasiGun(kayitTarihi) < muafiyetGun;

  const uygun =
    !yeniOyuncu &&
    d.mac % aralik === 0 &&
    d.bugunGosterilen < GUNLUK_SINIR;

  if (!uygun) {
    yaz(d);
    return { gosterildi: false, sebep: yeniOyuncu ? "ilk_gunler" : "siklik" };
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
