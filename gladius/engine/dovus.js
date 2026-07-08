// ============================================================
// Dövüş çözümleme (tasarım 3.1): mesafe + açı isabet, kalkan hasar azaltma,
// ölüm/kan. Şimdilik istemci tarafı (yerel); Faz 5'te lag-compensation ile
// sunucuya taşınacak (tasarım 3.10).
// ============================================================

import {
  VURUS_MESAFE, VURUS_ACI_TOLERANS, VURUS_HASAR,
  KALKAN_AZALT_MIN, KALKAN_AZALT_MAX, GUC_CARPAN, ZIRH_AZALT,
} from "../shared/denge.js";

// İki açı arasındaki en kısa mutlak fark.
export function aciFarki(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

// saldiran, bakış yönünde menzil+açı içindeki en yakın hedefe vurur.
// PvP kapalıysa (maymun/boğa fazı) hedefler tehditlerdir, açıksa oyunculardır.
export function vur(durum, saldiran) {
  const pvp = durum.pvpAcik !== false;
  // PvP açıkken oyunculara + (varsa) aslanlara vurulabilir; kapalıyken (maymun/boğa) tehditlere.
  const hedefler = pvp
    ? durum.oyuncular.concat((durum.tehditler || []).filter((t) => t.tip === "aslan"))
    : (durum.tehditler || []);

  let enIyi = null;
  let enYakin = Infinity;

  for (const t of hedefler) {
    if (t === saldiran || t.can <= 0) continue;
    // Düelloda takım arkadaşına vurulmaz (tasarım 3.3.2).
    if (durum.faz === "duello" && saldiran.takim && t.takim === saldiran.takim) continue;
    const dx = t.x - saldiran.x;
    const dy = t.y - saldiran.y;
    const uz = Math.hypot(dx, dy);
    if (uz > VURUS_MESAFE) continue;
    const hedefAci = Math.atan2(dy, dx);
    if (aciFarki(saldiran.aci, hedefAci) > VURUS_ACI_TOLERANS) continue;
    if (uz < enYakin) {
      enYakin = uz;
      enIyi = t;
    }
  }

  if (!enIyi) {
    durum.efektler.push({ tip: "iska", x: saldiran.x, y: saldiran.y, aci: saldiran.aci, t: 0, sure: 0.2 });
    durum.sesler?.push("iska");
    return { isabet: false };
  }

  // Hasar: taban × güç itemi × Altın Dakika (Deathmatch) — tasarım 3.8.1.
  let hasar = (saldiran.hasar || VURUS_HASAR);
  if (saldiran.gucKalan > 0) hasar *= GUC_CARPAN;      // Güç Patlaması itemi
  if (durum.altinDakika) hasar *= 2;                    // Altın Dakika
  let kalkanla = false;
  // Kalkan kalkıksa %70-80 arası şansa bağlı hasar azaltma (tasarım 3.1). (Sadece oyuncular kalkan tutar.)
  if (enIyi.kalkanKalkik) {
    const azalt = KALKAN_AZALT_MIN + Math.random() * (KALKAN_AZALT_MAX - KALKAN_AZALT_MIN);
    hasar *= (1 - azalt);
    kalkanla = true;
  }
  if (enIyi.zirhKalan > 0) hasar *= ZIRH_AZALT;         // Zırh Yükseltmesi itemi (DM)
  enIyi.can -= hasar;

  durum.efektler.push({
    tip: kalkanla ? "kalkan" : "kan",
    x: enIyi.x, y: enIyi.y, aci: saldiran.aci, t: 0,
    sure: kalkanla ? 0.25 : 0.4,
  });
  durum.sesler?.push(kalkanla ? "kalkan" : "isabet");

  if (enIyi.can <= 0) {
    enIyi.can = 0;
    enIyi.oldu = true;
    enIyi.olumAci = saldiran.aci;
    // Oyuncu ölürse kalıcı ceset + kan + kill feed (tehditlerde iz/feed bırakma).
    if (!enIyi.tehdit) {
      durum.kanlar.push({ x: enIyi.x, y: enIyi.y, r: 24 + Math.random() * 12, aci: Math.random() * Math.PI * 2 });
      if (durum.killFeed) {
        durum.killFeed.unshift({ vuran: saldiran.ad, olen: enIyi.ad, t: 0, sure: 5 });
        if (durum.killFeed.length > 5) durum.killFeed.pop();
      }
      // Eleme sayacı (kill streak / istatistik için)
      saldiran.eleme = (saldiran.eleme || 0) + 1;
      // İlk Kan rozeti: round'daki ilk oyuncu ölümünü yapan (tasarım 2.1)
      if (durum.ilkKanId == null) durum.ilkKanId = saldiran.id;
    } else if (enIyi.tip === "aslan") {
      // Aslan Avcısı rozeti için (tasarım 2.1)
      saldiran.aslanEleme = (saldiran.aslanEleme || 0) + 1;
    }
    durum.sesler?.push("olum");
  }

  return { isabet: true, hedef: enIyi, kalkanla, oldu: enIyi.can <= 0 };
}
